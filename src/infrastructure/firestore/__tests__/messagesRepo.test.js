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

/** `Timestamp` do SDK como ele chega num snapshot ao vivo — objeto com `.toMillis()`. */
const tsSdk = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

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

  /* VIRADA DE CONTRATO — spec 0032 (AC-5).
     Este teste ASSEVERAVA que o documento saía do repo exatamente como veio do `data()`,
     `timestamp` incluído — ou seja, o `Timestamp` do SDK atravessando a fronteira (dívida
     aceita no ADR-0010). Agora ele asserta o contrário: `timestamp` sai como epoch-ms
     NUMÉRICO. O `.reverse()` que o teste sempre cobriu continua igual. */
  it("entrega as mensagens em ordem cronológica, com `timestamp` em epoch-ms", () => {
    // O Firestore precisa ordenar DESC para o `limit` pegar as N ÚLTIMAS; a UI, porém,
    // renderiza de cima para baixo. Sem o `.reverse()`, o chat abriria de trás para frente.
    const pagina = assinar([
      docOf("m3", { content: "terceira", timestamp: tsSdk(3000) }),
      docOf("m2", { content: "segunda", timestamp: tsSdk(2000) }),
      docOf("m1", { content: "primeira", timestamp: tsSdk(1000) }),
    ]);

    expect(pagina.messages).toEqual([
      { id: "m1", content: "primeira", timestamp: 1000 },
      { id: "m2", content: "segunda", timestamp: 2000 },
      { id: "m3", content: "terceira", timestamp: 3000 },
    ]);
    // Nenhuma primitiva do SDK sobrevive à borda: nada de `.toMillis`/`.toDate` do outro lado.
    pagina.messages.forEach((m) => expect(typeof m.timestamp).toBe("number"));
    expect(orderBy).toHaveBeenCalledWith("timestamp", "desc");
    expect(limit).toHaveBeenCalledWith(3);
  });

  /* AC-5: a data também chega como objeto cru quando o SDK não reidrata a classe (cache,
     serialização). Antes da virada, o chat lia `.toMillis()` — que não existe nessa forma —
     e a mensagem caía no `?? Date.now()`, ganhando a hora errada. */
  it("normaliza também o `{seconds, nanoseconds}` cru vindo de cache", () => {
    const pagina = assinar([docOf("m1", { timestamp: { seconds: 1700, nanoseconds: 250_000_000 } })]);
    expect(pagina.messages[0].timestamp).toBe(1_700_250);
  });

  /* AC-5 — ESCRITA OTIMISTA. Quem envia a mensagem recebe o próprio documento de volta ANTES
     de o servidor carimbar o `serverTimestamp()`: nesse instante `timestamp` é `null`. O
     normalizador devolve `null` (não `0`, que jogaria a mensagem para 1970 e a faria sumir
     pelo corte do TTL da tela). A mensagem continua na lista, e a UI aplica o `?? Date.now()`
     que sempre aplicou. */
  it("mensagem sem carimbo do servidor ainda (escrita otimista) sai com `timestamp: null`", () => {
    const pagina = assinar([
      docOf("m2", { content: "recém-enviada", timestamp: null }),
      docOf("m1", { content: "antiga", timestamp: tsSdk(1000) }),
    ]);

    // Não some da lista, e não vira `0` nem `NaN`.
    expect(pagina.messages).toEqual([
      { id: "m1", content: "antiga", timestamp: 1000 },
      { id: "m2", content: "recém-enviada", timestamp: null },
    ]);
    // O fallback do filtro de TTL da tela (`d.timestamp ?? Date.now()`) ainda funciona: a
    // mensagem passa pelo corte em vez de ser descartada como se fosse de 1970.
    const otimista = pagina.messages[1];
    expect(otimista.timestamp ?? Date.now()).toBeGreaterThan(ttlCutoffMillis());
    // E a formatação de hora (`typeof ts !== "number" → ""`) devolve string vazia sem quebrar.
    expect(typeof otimista.timestamp).not.toBe("number");
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
  /* VIRADA DE CONTRATO — spec 0032 (AC-5): antes este teste asseverava o documento cru, com o
     `Timestamp` do SDK atravessando a fronteira. A página antiga passa pelo MESMO normalizador
     da página ao vivo — se só uma das duas normalizasse, o "carregar anteriores" misturaria
     números e `Timestamp` na mesma lista e o agrupamento de mensagens quebraria na emenda. */
  it("pagina a partir do cursor, em ordem cronológica e com data em epoch-ms", async () => {
    getDocs.mockResolvedValue({
      docs: [
        docOf("m2", { content: "segunda", timestamp: tsSdk(2000) }),
        docOf("m1", { content: "primeira", timestamp: tsSdk(1000) }),
      ],
    });

    const r = await messagesRepo.loadOlder("c1", "<cursor>", 2);

    expect(r.messages).toEqual([
      { id: "m1", content: "primeira", timestamp: 1000 },
      { id: "m2", content: "segunda", timestamp: 2000 },
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
  /* VIRADA DE CONTRATO — spec 0032 (AC-5): o documento saía cru, e as duas telas de rolagem
     (`RollFeed`, `CampaignRollDrawer`) liam `timestamp.seconds * 1000` para filtrar e ordenar.
     Agora sai em epoch-ms e elas só comparam número. */
  it("entrega só as rolagens de dado, com a data em epoch-ms", () => {
    let entregue;
    onSnapshot.mockImplementation((_q, next) => {
      next({ docs: [docOf("m1", { type: "roll", total: 17, timestamp: tsSdk(1_700_000_000_000) })] });
      return () => {};
    });

    messagesRepo.watchRolls("c1", 20, (list) => { entregue = list; });

    // O feed lateral do mestre é só de rolagens: filtrar no servidor evita baixar o chat
    // inteiro só para descartá-lo no cliente.
    expect(where).toHaveBeenCalledWith("type", "==", "roll");
    expect(limit).toHaveBeenCalledWith(20);
    expect(entregue).toEqual([{ id: "m1", type: "roll", total: 17, timestamp: 1_700_000_000_000 }]);
    expect(query.mock.calls[0][0]).toEqual({ path: "campaigns/c1/messages" });
  });

  /* VIRADA DE COMPORTAMENTO — spec 0032 (Q2).
     Até a spec 0031 a query era `where` + `limit` SEM `orderBy`, e o Firestore ordenava por
     ID de documento: o corte trazia rolagens arbitrárias, não as últimas da mesa. O defeito
     ficava invisível enquanto a campanha tinha menos rolagens que o limite. */
  it("ordena por timestamp desc — o limite tem que cortar as MAIS ANTIGAS (Q2)", () => {
    onSnapshot.mockImplementation(() => () => {});
    messagesRepo.watchRolls("c1", 80, () => {});

    expect(orderBy).toHaveBeenCalledWith("timestamp", "desc");
    // Sem esta ordenação o `limit` é uma amostra aleatória. Depende do índice composto
    // (messages: type ASC + timestamp DESC) declarado em `firestore.indexes.json`.
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

  /* VIRADA DE CONTRATO — spec 0032 (AC-5): `updatedAt` também saía como `Timestamp` do SDK, e
     o `CampaignChat` fazia `u.updatedAt?.toMillis?.()` para decidir se o "digitando" expirou
     (5 s). Agora sai em epoch-ms. */
  it("watchTyping entrega quem está digitando, com o uid junto e `updatedAt` em epoch-ms", () => {
    let entregue;
    onSnapshot.mockImplementation((_q, next) => {
      next({ docs: [docOf("u2", { userName: "Bruno", isTyping: true, updatedAt: tsSdk(1_700_000_000_000) })] });
      return () => {};
    });

    messagesRepo.watchTyping("c1", (list) => { entregue = list; });

    // O `id` é o uid: sem ele a UI não conseguiria esconder o próprio "digitando".
    expect(entregue).toEqual([{ id: "u2", userName: "Bruno", isTyping: true, updatedAt: 1_700_000_000_000 }]);
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

/* ════════════════════════════════════════════════
 *  FRONTEIRA VALIDADA — spec 0032 AC-6
 * ════════════════════════════════════════════════ */

describe("messagesRepo — validação de fronteira (AC-6)", () => {
  const entrega = (docs) => {
    let pagina;
    onSnapshot.mockImplementation((_q, next) => { next({ docs }); return () => {}; });
    messagesRepo.watchRecent("camp1", 50, (p) => { pagina = p; });
    return pagina;
  };

  it("mensagem ÍNTEGRA sai idêntica, sem log", () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    const crua = { userId: "u1", userName: "Ana", userPhoto: null, content: "oi", type: "text" };

    const { messages } = entrega([docOf("m1", { ...crua, timestamp: tsSdk(1000) })]);

    expect(messages).toEqual([{ id: "m1", ...crua, timestamp: 1000 }]);
    expect(aviso).not.toHaveBeenCalled();
  });

  it("`content` gravado como OBJETO não chega à borda — ele derrubaria a árvore do React", () => {
    /* "Objects are not valid as a React child" mata o chat inteiro, e a pilha aponta para o
       componente da bolha, nunca para a mensagem que causou. Aqui o id sai no log. */
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { messages } = entrega([
      docOf("m1", { userName: "Ana", content: { texto: "oi" }, type: "text", timestamp: tsSdk(1) }),
    ]);

    expect(messages[0].content).toBe("");
    expect(aviso.mock.calls[0][0]).toContain('[messagesRepo.saida] "m1".content');
  });

  it("`userName` numérico vira texto e a mensagem continua na lista", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const { messages } = entrega([docOf("m1", { userName: 42, content: "oi", timestamp: tsSdk(1) })]);
    expect(messages[0].userName).toBe("42");
  });

  it("mensagem sem `type` (legado, antes do campo existir) atravessa intocada", () => {
    // Ausência continua ausência: a UI já trata `type` indefinido como texto.
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { messages } = entrega([docOf("m1", { userName: "Ana", content: "oi", timestamp: tsSdk(1) })]);

    expect(messages[0]).toEqual({ id: "m1", userName: "Ana", content: "oi", timestamp: 1 });
    expect("type" in messages[0]).toBe(false);
    expect(aviso).not.toHaveBeenCalled();
  });

  it("documento com corpo não-objeto é descartado da página, com log de erro", () => {
    const { messages } = entrega([
      docOf("boa", { userName: "Ana", content: "oi", timestamp: tsSdk(1) }),
      docOf("fantasma", undefined),
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe("boa");
    expect(console.error.mock.calls.map((c) => c[0]).join("\n")).toContain("fantasma");
  });
});
