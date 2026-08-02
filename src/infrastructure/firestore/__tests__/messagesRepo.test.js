import {
  addDoc, setDoc, getDocs, onSnapshot, writeBatch,
  query, where, orderBy, limit, startAfter, serverTimestamp, Timestamp,
} from "firebase/firestore";
import * as messagesRepo from "../messagesRepo";
import { MESSAGE_TTL_MS, ttlCutoffMillis } from "../messagesRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

const fs = () => require("firebase/firestore");

/** Documento cru do Firestore: `id` e `ref` fora, dados atrás de `data()`. */
const docOf = (id, data) => ({ id, ref: `ref/${id}`, data: () => data });

let batch;

// O preset Jest do CRA usa `resetMocks: true`: o que a fábrica do jest.mock instala é
// apagado antes de cada teste. Tudo o que o repo precisa é reinstalado aqui.
beforeEach(() => {
  fs().doc.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  fs().collection.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  query.mockImplementation((ref, ...rest) => ({ ref, rest }));
  where.mockImplementation((f, op, v) => ({ f, op, v }));
  orderBy.mockImplementation((f, dir) => ({ orderBy: f, dir }));
  limit.mockImplementation((n) => ({ limit: n }));
  startAfter.mockImplementation((c) => ({ startAfter: c }));
  serverTimestamp.mockReturnValue("<serverTimestamp>");
  // `Timestamp` é classe do SDK; o automock não dá implementação aos estáticos, então o
  // corte do TTL voltaria `undefined` e nenhum teste conseguiria olhar para ele.
  Timestamp.fromMillis = jest.fn((ms) => ({ epochMs: ms }));
  addDoc.mockResolvedValue({ id: "m1" });
  setDoc.mockResolvedValue(undefined);
  batch = { delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
  writeBatch.mockReturnValue(batch);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("messagesRepo.send", () => {
  it("grava na subcoleção de mensagens da campanha, com o horário do servidor", async () => {
    await messagesRepo.send("c1", {
      userId: "u1", userName: "Ana", userPhoto: "data:foto", content: "Olá", type: "text",
    });

    const [ref, payload] = addDoc.mock.calls[0];
    expect(ref).toEqual({ path: "campaigns/c1/messages" });
    expect(payload).toEqual({
      userId: "u1",
      userName: "Ana",
      userPhoto: "data:foto",
      content: "Olá",
      type: "text",
      timestamp: "<serverTimestamp>",
    });
    // O horário vem do servidor, não do relógio do jogador: relógio adiantado jogaria a
    // mensagem para o topo do chat de todo mundo.
    expect(serverTimestamp).toHaveBeenCalled();
  });

  it("usuário sem foto grava null explícito, não `undefined`", async () => {
    // `undefined` faz o Firestore rejeitar a escrita inteira; `null` é o "sem foto" que a UI
    // já sabe tratar.
    await messagesRepo.send("c1", { userId: "u1", userName: "Ana", content: "Olá" });
    expect(addDoc.mock.calls[0][1].userPhoto).toBeNull();
  });

  it("mensagem sem tipo declarado é texto", async () => {
    await messagesRepo.send("c1", { userId: "u1", userName: "Ana", content: "Olá" });
    expect(addDoc.mock.calls[0][1].type).toBe("text");
  });

  it("`rollData` só existe no documento quando houve rolagem", async () => {
    // Gravar `rollData: undefined` quebraria a escrita; gravar `null` faria a UI renderizar
    // o card de rolagem vazio em toda mensagem de texto.
    await messagesRepo.send("c1", { userId: "u1", userName: "Ana", content: "Olá" });
    expect(addDoc.mock.calls[0][1]).not.toHaveProperty("rollData");

    await messagesRepo.send("c1", {
      userId: "u1", userName: "Ana", content: "d20", type: "roll", rollData: { total: 17 },
    });
    expect(addDoc.mock.calls[1][1].rollData).toEqual({ total: 17 });
  });

  it("@policy silent — falha ao enviar não rejeita, só loga com o prefixo do repo", async () => {
    // Comportamento herdado e preservado de propósito (AC-7): o chat nunca derrubou a tela
    // por uma mensagem que não subiu.
    addDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(messagesRepo.send("c1", { userId: "u1", content: "x" })).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[messagesRepo.send] falhou:", expect.any(Error));
  });
});

describe("messagesRepo.sendSystem", () => {
  it("avisa a mesa sem autor humano", async () => {
    await messagesRepo.sendSystem("c1", "Ana entrou na campanha.");

    const payload = addDoc.mock.calls[0][1];
    // `userId: "system"` e `type: "system"` são o que a UI usa para renderizar o aviso
    // centralizado, sem avatar e sem balão de autor.
    expect(payload).toMatchObject({
      userId: "system",
      userName: "Sistema",
      userPhoto: null,
      content: "Ana entrou na campanha.",
      type: "system",
    });
  });

  it("@policy silent — aviso que não sobe não derruba a entrada na campanha", async () => {
    addDoc.mockRejectedValue(new Error("offline"));
    await expect(messagesRepo.sendSystem("c1", "x")).resolves.toBeUndefined();
  });
});

describe("messagesRepo.watchRecent", () => {
  const assinar = (docs, pageSize = 3) => {
    let pagina;
    onSnapshot.mockImplementation((_q, next) => { next({ docs }); return () => {}; });
    messagesRepo.watchRecent("c1", pageSize, (p) => { pagina = p; });
    return pagina;
  };

  it("entrega as mensagens em ordem cronológica, mesmo lendo as mais recentes primeiro", () => {
    // O Firestore precisa ordenar DESC para o `limit` pegar as N ÚLTIMAS; a UI, porém,
    // renderiza de cima para baixo. Sem o `.reverse()`, o chat abriria de trás para frente.
    const pagina = assinar([
      docOf("m3", { content: "terceira" }),
      docOf("m2", { content: "segunda" }),
      docOf("m1", { content: "primeira" }),
    ]);

    expect(pagina.messages).toEqual([
      { id: "m1", content: "primeira" },
      { id: "m2", content: "segunda" },
      { id: "m3", content: "terceira" },
    ]);
    expect(orderBy).toHaveBeenCalledWith("timestamp", "desc");
    expect(limit).toHaveBeenCalledWith(3);
  });

  it("lê só o que está dentro do TTL de 24 h", () => {
    const antes = Date.now();
    assinar([]);
    const depois = Date.now();

    const filtroTtl = where.mock.calls.find(([f]) => f === "timestamp");
    expect(filtroTtl[1]).toBe(">=");
    // O corte acompanha o relógio: mensagem mais velha que 24 h nem chega ao cliente.
    expect(filtroTtl[2].epochMs).toBeGreaterThanOrEqual(antes - MESSAGE_TTL_MS);
    expect(filtroTtl[2].epochMs).toBeLessThanOrEqual(depois - MESSAGE_TTL_MS);
    expect(query.mock.calls[0][0]).toEqual({ path: "campaigns/c1/messages" });
  });

  it("hasMore só é verdadeiro quando a página encheu", () => {
    // Página incompleta significa que já se chegou ao começo do histórico visível; anunciar
    // "tem mais" faria a UI oferecer um "carregar antigas" que não traria nada.
    expect(assinar([docOf("m1", {}), docOf("m2", {}), docOf("m3", {})], 3).hasMore).toBe(true);
    expect(assinar([docOf("m1", {}), docOf("m2", {})], 3).hasMore).toBe(false);
    expect(assinar([], 3).hasMore).toBe(false);
  });

  it("o cursor é opaco e volta intacto para `loadOlder`", async () => {
    const maisAntigo = docOf("m1", { content: "primeira" });
    const pagina = assinar([docOf("m2", { content: "segunda" }), maisAntigo]);

    // Quem chama não inspeciona o cursor — só devolve. Este teste amarra as duas pontas:
    // o que `watchRecent` entrega é exatamente o que vira `startAfter` em `loadOlder`.
    getDocs.mockResolvedValue({ docs: [] });
    await messagesRepo.loadOlder("c1", pagina.cursor, 3);
    expect(startAfter).toHaveBeenCalledWith(maisAntigo);
  });

  it("página vazia devolve cursor null", () => {
    expect(assinar([]).cursor).toBeNull();
  });

  it("avisa quem chamou quando a assinatura falha", () => {
    const erro = new Error("permission-denied");
    onSnapshot.mockImplementation((_q, _next, onSnapError) => { onSnapError(erro); return () => {}; });
    const onError = jest.fn();

    messagesRepo.watchRecent("c1", 3, () => {}, onError);

    expect(onError).toHaveBeenCalledWith(erro);
    expect(console.error).toHaveBeenCalledWith("[messagesRepo.watchRecent] falhou:", erro);
  });

  it("sem campaignId, devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = messagesRepo.watchRecent(null, 3, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow(); // idempotente
  });
});

describe("messagesRepo.loadOlder", () => {
  it("pagina a partir do cursor, também em ordem cronológica", async () => {
    getDocs.mockResolvedValue({
      docs: [docOf("m2", { content: "segunda" }), docOf("m1", { content: "primeira" })],
    });

    const r = await messagesRepo.loadOlder("c1", "<cursor>", 2);

    expect(r.messages).toEqual([
      { id: "m1", content: "primeira" },
      { id: "m2", content: "segunda" },
    ]);
    // O novo cursor é o documento MAIS ANTIGO da página: é dele que a próxima continua.
    expect(r.cursor).toMatchObject({ id: "m1" });
    expect(startAfter).toHaveBeenCalledWith("<cursor>");
    expect(query.mock.calls[0][0]).toEqual({ path: "campaigns/c1/messages" });
  });

  it("sem cursor, devolve página vazia sem tocar a rede", async () => {
    // É o estado "ainda não recebi a primeira página": pedir antigas aqui leria a coleção
    // inteira sem `startAfter`.
    await expect(messagesRepo.loadOlder("c1", null, 3)).resolves.toEqual({ messages: [], cursor: null });
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("fim do histórico devolve cursor null", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await expect(messagesRepo.loadOlder("c1", "<cursor>", 3)).resolves.toEqual({ messages: [], cursor: null });
  });

  it("@policy strict — erro REJEITA em vez de virar 'acabou o histórico'", async () => {
    getDocs.mockRejectedValue(new Error("unavailable"));
    await expect(messagesRepo.loadOlder("c1", "<cursor>", 3)).rejects.toThrow("unavailable");
  });
});

describe("messagesRepo.watchRolls", () => {
  it("entrega só as rolagens de dado", () => {
    let entregue;
    onSnapshot.mockImplementation((_q, next) => {
      next({ docs: [docOf("m1", { type: "roll", total: 17 })] });
      return () => {};
    });

    messagesRepo.watchRolls("c1", 20, (list) => { entregue = list; });

    // O feed lateral do mestre é só de rolagens: filtrar no servidor evita baixar o chat
    // inteiro só para descartá-lo no cliente.
    expect(where).toHaveBeenCalledWith("type", "==", "roll");
    expect(limit).toHaveBeenCalledWith(20);
    expect(entregue).toEqual([{ id: "m1", type: "roll", total: 17 }]);
    expect(query.mock.calls[0][0]).toEqual({ path: "campaigns/c1/messages" });
  });

  it("sem campaignId, devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = messagesRepo.watchRolls(null, 20, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();
  });
});

describe("messagesRepo.clearAll", () => {
  it("apaga todas as mensagens numa escrita só", async () => {
    getDocs.mockResolvedValue({ empty: false, docs: [docOf("m1", {}), docOf("m2", {})] });

    await messagesRepo.clearAll("c1");

    // Lote em vez de N `deleteDoc`: o chat de uma sessão longa tem centenas de mensagens, e
    // apagar uma a uma deixaria o chat metade limpo se a conexão caísse no meio.
    expect(batch.delete).toHaveBeenCalledTimes(2);
    expect(batch.delete).toHaveBeenCalledWith("ref/m1");
    expect(batch.commit).toHaveBeenCalled();
  });

  it("coleção vazia não abre lote nem faz commit", async () => {
    // `commit()` de um lote vazio é uma ida à rede que não muda nada.
    getDocs.mockResolvedValue({ empty: true, docs: [] });
    await messagesRepo.clearAll("c1");
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it("@policy silent — falha não rejeita, só loga", async () => {
    batch.commit.mockRejectedValue(new Error("denied"));
    getDocs.mockResolvedValue({ empty: false, docs: [docOf("m1", {})] });

    await expect(messagesRepo.clearAll("c1")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[messagesRepo.clearAll] falhou:", expect.any(Error));
  });
});

describe("messagesRepo.deleteExpired", () => {
  it("apaga só o que já passou das 24 h", async () => {
    getDocs.mockResolvedValue({ empty: false, docs: [docOf("velha", {})] });
    const antes = Date.now();

    await messagesRepo.deleteExpired("c1");

    const filtroTtl = where.mock.calls.find(([f]) => f === "timestamp");
    // `<` (e não `<=` nem `>=`): o corte é o mesmo do `watchRecent`, do outro lado. Se os
    // dois divergissem, existiria mensagem visível que a faxina já apagou — ou o contrário.
    expect(filtroTtl[1]).toBe("<");
    expect(filtroTtl[2].epochMs).toBeGreaterThanOrEqual(antes - MESSAGE_TTL_MS);
    expect(batch.delete).toHaveBeenCalledWith("ref/velha");
    expect(batch.commit).toHaveBeenCalled();
    expect(query.mock.calls[0][0]).toEqual({ path: "campaigns/c1/messages" });
  });

  it("nada expirado não abre lote nem faz commit", async () => {
    getDocs.mockResolvedValue({ empty: true, docs: [] });
    await messagesRepo.deleteExpired("c1");
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it("@policy silent — a faxina falhar não pode atrapalhar quem abriu o chat", async () => {
    getDocs.mockRejectedValue(new Error("unavailable"));
    await expect(messagesRepo.deleteExpired("c1")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[messagesRepo.deleteExpired] falhou:", expect.any(Error)
    );
  });
});

describe("messagesRepo — 'está digitando'", () => {
  it("marca o estado sob `campaigns/{id}/typing/{uid}`", async () => {
    await messagesRepo.setTyping("c1", "u1", "Ana", true);

    // Um doc por usuário (e não um campo no doc da campanha) é o que deixa dois jogadores
    // digitarem ao mesmo tempo sem um sobrescrever o outro.
    expect(setDoc).toHaveBeenCalledWith(
      { path: "campaigns/c1/typing/u1" },
      { userName: "Ana", isTyping: true, updatedAt: "<serverTimestamp>" }
    );
  });

  it("@policy silent — 'está digitando' nunca vale um erro na tela", async () => {
    setDoc.mockRejectedValue(new Error("denied"));
    await expect(messagesRepo.setTyping("c1", "u1", "Ana", true)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[messagesRepo.setTyping] falhou:", expect.any(Error));
  });

  it("watchTyping entrega quem está digitando, com o uid do documento junto", () => {
    let entregue;
    onSnapshot.mockImplementation((_q, next) => {
      next({ docs: [docOf("u2", { userName: "Bruno", isTyping: true })] });
      return () => {};
    });

    messagesRepo.watchTyping("c1", (list) => { entregue = list; });

    // O `id` é o uid: sem ele a UI não conseguiria esconder o próprio "digitando".
    expect(entregue).toEqual([{ id: "u2", userName: "Bruno", isTyping: true }]);
    expect(query.mock.calls[0][0]).toEqual({ path: "campaigns/c1/typing" });
  });

  it("sem campaignId, watchTyping devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = messagesRepo.watchTyping(null, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();
  });
});

describe("messagesRepo — retenção", () => {
  it("o TTL é de 24 h e os dois cortes concordam", () => {
    // `ttlCutoffMillis` é o corte que a UI usa em memória; o corte da query nasce do mesmo
    // `MESSAGE_TTL_MS`. Se um dos dois fosse ajustado sozinho, o chat mostraria mensagem
    // que a faxina já considerou expirada.
    expect(MESSAGE_TTL_MS).toBe(24 * 60 * 60 * 1000);

    const agora = Date.now();
    const corte = ttlCutoffMillis();
    expect(agora - corte).toBeGreaterThanOrEqual(MESSAGE_TTL_MS);
    expect(agora - corte).toBeLessThan(MESSAGE_TTL_MS + 1000);
  });
});
