/**
 * Contrato do repositório do Mapa-Múndi — lado ATELIÊ (spec 0030, onda 1.5).
 *
 * O que está sob teste é o que o `worldMapStore` deixou de saber: ONDE cada coisa é
 * gravada, o que sai junto num lote, qual é a política de erro de cada operação e o que
 * NÃO toca a rede. O SDK é 100% mockado.
 *
 * O caminho é o teste mais importante daqui. Todo documento tem de nascer sob
 * `users/{uid}/worldmaps/...` — trocar por `campaigns/...` entregaria o molde inteiro,
 * com os segredos do mestre, para os jogadores (ADR-0006, spec 0028 AC-1).
 */
import {
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch, increment,
} from "firebase/firestore";
import * as repo from "../worldMapsRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

const fs = () => require("firebase/firestore");

/** Documento cru do Firestore: `id` fora, dados atrás de `data()`, e a `ref` do SDK. */
const docOf = (id, data = {}) => ({
  id,
  data: jest.fn(() => data),
  ref: { path: `ref/${id}` },
});
const snapOf = (docs) => ({ docs, size: docs.length, empty: docs.length === 0 });
const docExistente = (data) => ({ exists: () => true, id: "x", data: () => data });
const docAusente = { exists: () => false, id: "x", data: () => ({}) };

/** Todos os lotes criados na chamada, com as operações que receberam. */
let lotes = [];

// O preset Jest do CRA usa `resetMocks: true`: o que a fábrica do jest.mock instala é
// apagado antes de cada teste. Tudo o que o repositório precisa é reinstalado aqui.
beforeEach(() => {
  lotes = [];
  fs().doc.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  fs().collection.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  query.mockImplementation((ref, ...rest) => ({ ref, rest }));
  orderBy.mockImplementation((campo, dir) => `orderBy:${campo}:${dir}`);
  serverTimestamp.mockReturnValue("<ts>");
  increment.mockImplementation((n) => ({ __inc: n }));
  getDoc.mockResolvedValue(docAusente);
  getDocs.mockResolvedValue(snapOf([]));
  setDoc.mockResolvedValue(undefined);
  updateDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  addDoc.mockResolvedValue({ id: "gerado-1" });
  writeBatch.mockImplementation(() => {
    const ops = [];
    const lote = {
      ops,
      committed: false,
      set: jest.fn((ref, data) => ops.push({ type: "set", ref, data })),
      update: jest.fn((ref, data) => ops.push({ type: "update", ref, data })),
      delete: jest.fn((ref) => ops.push({ type: "delete", ref })),
      commit: jest.fn(async () => { lote.committed = true; }),
    };
    lotes.push(lote);
    return lote;
  });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

const opsDosLotes = () => lotes.flatMap((l) => l.ops);
const caminhos = (ops) => ops.map((o) => o.ref.path);

/* ════════════════════════════════════════════════════════════════════════
 *  A FRONTEIRA DO SEGREDO
 * ════════════════════════════════════════════════════════════════════════ */

describe("worldMapsRepo — o molde mora no ateliê, nunca na campanha", () => {
  it("toda escrita do molde nasce sob `users/{uid}/worldmaps`", async () => {
    await repo.criarMapa("u1", { name: "Aurora" });
    await repo.atualizarMapa("u1", "m1", { name: "X" });
    await repo.adicionarNo("u1", "m1", { x: 1 });
    await repo.adicionarTrilha("u1", "m1", {});
    await repo.adicionarEvento("u1", "m1", {});
    await repo.gravarFundo("u1", "m1", { data: "data:," });

    const alvos = [
      ...addDoc.mock.calls.map((c) => c[0].path),
      ...updateDoc.mock.calls.map((c) => c[0].path),
      ...setDoc.mock.calls.map((c) => c[0].path),
    ];
    expect(alvos.length).toBeGreaterThan(0);
    // Um único caminho aqui apontando para `campaigns/` entregaria o mapa inteiro —
    // gmText, gatilhos e trilhas secretas — para quem só deveria ver o revelado.
    alvos.forEach((p) => expect(p.startsWith("users/u1/worldmaps")).toBe(true));
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  MOLDE (doc raiz)
 * ════════════════════════════════════════════════════════════════════════ */

describe("worldMapsRepo.contarMapas", () => {
  it("conta os moldes do mestre na coleção do ateliê", async () => {
    getDocs.mockResolvedValue(snapOf([docOf("m1"), docOf("m2")]));

    await expect(repo.contarMapas("u1")).resolves.toBe(2);
    expect(fs().collection).toHaveBeenCalledWith({}, "users", "u1", "worldmaps");
  });

  it("sem uid, devolve 0 sem tocar a rede", async () => {
    await expect(repo.contarMapas("")).resolves.toBe(0);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("@policy strict — a falha REJEITA; contar 0 liberaria estourar a cota", async () => {
    getDocs.mockRejectedValue(new Error("permission-denied"));
    await expect(repo.contarMapas("u1")).rejects.toThrow("permission-denied");
  });
});

describe("worldMapsRepo.criarMapa", () => {
  it("grava na coleção do ateliê, carimba as duas datas e devolve o id novo", async () => {
    const id = await repo.criarMapa("u1", { name: "Aurora", nodeCount: 0 });

    expect(id).toBe("gerado-1");
    expect(addDoc).toHaveBeenCalledWith(
      { path: "users/u1/worldmaps" },
      { name: "Aurora", nodeCount: 0, createdAt: "<ts>", updatedAt: "<ts>" },
    );
    // `serverTimestamp()` é FieldValue: nasce e morre dentro da infraestrutura (AC-4).
    expect(serverTimestamp).toHaveBeenCalled();
  });

  it("devolve o ID em string — DocumentReference não atravessa a fronteira", async () => {
    expect(typeof await repo.criarMapa("u1", {})).toBe("string");
  });

  it("@policy strict", async () => {
    addDoc.mockRejectedValue(new Error("quota"));
    await expect(repo.criarMapa("u1", {})).rejects.toThrow("quota");
  });
});

describe("worldMapsRepo.atualizarMapa / tocarMapa", () => {
  it("atualiza o doc raiz e sempre envelhece `updatedAt`", async () => {
    await repo.atualizarMapa("u1", "m1", { fogEnabled: false });
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "users/u1/worldmaps/m1" },
      { fogEnabled: false, updatedAt: "<ts>" },
    );
  });

  it("`tocarMapa` escreve SÓ a data — é o que reordena a lista do ateliê", async () => {
    await repo.tocarMapa("u1", "m1");
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "users/u1/worldmaps/m1" }, { updatedAt: "<ts>" },
    );
  });

  it("@policy strict", async () => {
    updateDoc.mockRejectedValue(new Error("denied"));
    await expect(repo.atualizarMapa("u1", "m1", {})).rejects.toThrow("denied");
  });
});

describe("worldMapsRepo.lerMapa", () => {
  it("junta o id do documento aos dados", async () => {
    getDoc.mockResolvedValue({ exists: () => true, id: "m1", data: () => ({ name: "Aurora" }) });

    await expect(repo.lerMapa("u1", "m1")).resolves.toEqual({ id: "m1", name: "Aurora" });
    expect(fs().doc).toHaveBeenCalledWith({}, "users", "u1", "worldmaps", "m1");
  });

  it("devolve null quando o molde não existe", async () => {
    await expect(repo.lerMapa("u1", "m1")).resolves.toBeNull();
  });

  it("sem uid ou sem mapId, devolve null sem tocar a rede", async () => {
    await expect(repo.lerMapa("", "m1")).resolves.toBeNull();
    await expect(repo.lerMapa("u1", "")).resolves.toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("@policy strict", async () => {
    getDoc.mockRejectedValue(new Error("unavailable"));
    await expect(repo.lerMapa("u1", "m1")).rejects.toThrow("unavailable");
  });
});

describe("worldMapsRepo.apagarMapaEmCascata", () => {
  it("varre as filhas, apaga a ilustração e deixa o molde por ÚLTIMO", async () => {
    getDocs
      .mockResolvedValueOnce(snapOf([docOf("n1"), docOf("n2")]))
      .mockResolvedValueOnce(snapOf([docOf("e1")]))
      .mockResolvedValueOnce(snapOf([]));

    await repo.apagarMapaEmCascata("u1", "m1", ["nodes", "edges", "events"]);

    const ops = opsDosLotes();
    expect(ops).toHaveLength(5); // 3 filhos + mídia + molde
    expect(ops.every((o) => o.type === "delete")).toBe(true);
    /* Se a ilustração ficasse para trás, continuaria ocupando espaço num mapa que o
     * mestre acha que sumiu. */
    expect(caminhos(ops)).toContain("users/u1/worldmaps/m1/media/background");
    /* O molde por último: se a varredura cair no meio, o mapa ainda aparece na lista e o
     * mestre tenta de novo, em vez de ficar com órfãos invisíveis. */
    expect(ops[ops.length - 1].ref.path).toBe("users/u1/worldmaps/m1");
    expect(lotes.every((l) => l.committed)).toBe(true);
  });

  it("fatia em lotes de 500 — é o limite duro do Firestore", async () => {
    getDocs.mockResolvedValue(snapOf(Array.from({ length: 700 }, (_, i) => docOf(`n${i}`))));

    await repo.apagarMapaEmCascata("u1", "m1", ["nodes"]);

    expect(lotes).toHaveLength(2);
    expect(lotes[0].ops).toHaveLength(repo.BATCH_LIMIT);
    expect(opsDosLotes()).toHaveLength(702); // 700 nós + mídia + molde
  });

  it("sem filha nenhuma, ainda apaga mídia e molde num lote só", async () => {
    await repo.apagarMapaEmCascata("u1", "m1", []);
    expect(lotes).toHaveLength(1);
    expect(opsDosLotes()).toHaveLength(2);
  });

  it("@policy strict — falha na varredura REJEITA e não apaga o molde", async () => {
    getDocs.mockRejectedValue(new Error("unavailable"));
    await expect(repo.apagarMapaEmCascata("u1", "m1", ["nodes"])).rejects.toThrow("unavailable");
    expect(writeBatch).not.toHaveBeenCalled();
  });
});

describe("worldMapsRepo.observarMapas", () => {
  it("assina a coleção do ateliê ordenada por `updatedAt` e junta o id", () => {
    let entregue;
    onSnapshot.mockImplementation((_q, next) => { next(snapOf([docOf("m1", { name: "Aurora" })])); return () => {}; });

    repo.observarMapas("u1", (lista) => { entregue = lista; });

    expect(entregue).toEqual([{ id: "m1", name: "Aurora" }]);
    expect(orderBy).toHaveBeenCalledWith("updatedAt", "desc");
    expect(query).toHaveBeenCalledWith({ path: "users/u1/worldmaps" }, "orderBy:updatedAt:desc");
  });

  it("pede a estimativa local do carimbo do servidor", () => {
    const d = docOf("m1", {});
    onSnapshot.mockImplementation((_q, next) => { next(snapOf([d])); return () => {}; });

    repo.observarMapas("u1", () => {});

    /* Sem `estimate`, `updatedAt` chega `null` até o servidor confirmar e o mapa
     * recém-criado despenca para o fim da lista ordenada por ele. */
    expect(d.data).toHaveBeenCalledWith({ serverTimestamps: "estimate" });
  });

  it("entrega o erro a quem chamou em vez de engolir", () => {
    const erro = new Error("permission-denied");
    onSnapshot.mockImplementation((_q, _next, onErr) => { onErr(erro); return () => {}; });
    const onError = jest.fn();

    repo.observarMapas("u1", () => {}, onError);
    expect(onError).toHaveBeenCalledWith(erro);
  });

  it("não quebra quando quem chamou não passou onError", () => {
    onSnapshot.mockImplementation((_q, _next, onErr) => { onErr(new Error("offline")); return () => {}; });
    expect(() => repo.observarMapas("u1", () => {})).not.toThrow();
  });

  it("sem uid, devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = repo.observarMapas(null, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow(); // idempotente
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  ILUSTRAÇÃO DE FUNDO
 * ════════════════════════════════════════════════════════════════════════ */

describe("worldMapsRepo.lerHashDoFundo", () => {
  it("lê o hash do documento de mídia", async () => {
    getDoc.mockResolvedValue(docExistente({ hash: "abc123", data: "data:image/jpeg;base64,AA" }));

    await expect(repo.lerHashDoFundo("u1", "m1")).resolves.toBe("abc123");
    expect(fs().doc).toHaveBeenCalledWith({}, "users", "u1", "worldmaps", "m1", "media", "background");
  });

  it("devolve null quando não há fundo, ou quando o fundo não tem hash", async () => {
    await expect(repo.lerHashDoFundo("u1", "m1")).resolves.toBeNull();
    getDoc.mockResolvedValue(docExistente({ data: "data:," }));
    await expect(repo.lerHashDoFundo("u1", "m1")).resolves.toBeNull();
  });

  it("@policy silent — erro vira null e um console.warn; o upload continua", async () => {
    /* Herdado (AC-7): esta leitura serve SÓ para o dedup. Rejeitar aqui impediria o
     * mestre de trocar a ilustração por causa de uma leitura que nem era necessária.
     * O aviso é `warn`, e não `error`, porque era assim que o legado avisava. */
    getDoc.mockRejectedValue(new Error("unavailable"));

    await expect(repo.lerHashDoFundo("u1", "m1")).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("[worldMapsRepo.lerHashDoFundo]"),
      expect.any(Error),
    );
  });
});

describe("worldMapsRepo.gravarFundo", () => {
  it("grava a ilustração no documento SEPARADO de mídia, com carimbo", async () => {
    await repo.gravarFundo("u1", "m1", { kind: "background", data: "data:image/jpeg;base64,AA", hash: "h" });

    /* Documento separado do raiz não é estilo: o raiz é assinado em tempo real por
     * `useWorldMaps`, e ~900 KB lá dentro fariam a grade baixar todos os fundos. */
    expect(setDoc).toHaveBeenCalledWith(
      { path: "users/u1/worldmaps/m1/media/background" },
      { kind: "background", data: "data:image/jpeg;base64,AA", hash: "h", updatedAt: "<ts>" },
    );
  });

  it("@policy strict — a recusa da escrita sobe para a tela dizer por quê", async () => {
    setDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(repo.gravarFundo("u1", "m1", {})).rejects.toThrow("permission-denied");
  });
});

describe("worldMapsRepo.lerFundo", () => {
  it("devolve a dataURL guardada no campo `data`", async () => {
    getDoc.mockResolvedValue(docExistente({ data: "data:image/jpeg;base64,AAA" }));
    await expect(repo.lerFundo("u1", "m1")).resolves.toBe("data:image/jpeg;base64,AAA");
  });

  it("devolve null quando o mapa não tem ilustração em base64", async () => {
    await expect(repo.lerFundo("u1", "m1")).resolves.toBeNull();
    getDoc.mockResolvedValue(docExistente({}));
    await expect(repo.lerFundo("u1", "m1")).resolves.toBeNull();
  });

  it("sem uid ou sem mapId, devolve null sem tocar a rede", async () => {
    await expect(repo.lerFundo("", "m1")).resolves.toBeNull();
    await expect(repo.lerFundo("u1", null)).resolves.toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("@policy strict — erro REJEITA; um mapa sem fundo não é o mesmo que um erro", async () => {
    getDoc.mockRejectedValue(new Error("unavailable"));
    await expect(repo.lerFundo("u1", "m1")).rejects.toThrow("unavailable");
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  PERFIL — a marca de dispensa do mapa padrão
 * ════════════════════════════════════════════════════════════════════════ */

describe("worldMapsRepo.observarPerfil", () => {
  it("entrega os dados crus do perfil — quem interpreta é o domínio", () => {
    let entregue = "nada";
    onSnapshot.mockImplementation((_ref, next) => { next(docExistente({ mapaPadraoDispensado: true })); return () => {}; });

    repo.observarPerfil("u1", (d) => { entregue = d; });

    expect(entregue).toEqual({ mapaPadraoDispensado: true });
    expect(fs().doc).toHaveBeenCalledWith({}, "users", "u1");
  });

  it("perfil inexistente vira null, não um objeto vazio", () => {
    let entregue = "nada";
    onSnapshot.mockImplementation((_ref, next) => { next(docAusente); return () => {}; });
    repo.observarPerfil("u1", (d) => { entregue = d; });
    expect(entregue).toBeNull();
  });

  it("repassa o erro e, sem uid, não assina nada", () => {
    const erro = new Error("denied");
    onSnapshot.mockImplementation((_ref, _next, onErr) => { onErr(erro); return () => {}; });
    const onError = jest.fn();
    repo.observarPerfil("u1", () => {}, onError);
    expect(onError).toHaveBeenCalledWith(erro);

    onSnapshot.mockClear();
    const unsub = repo.observarPerfil("", () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();
  });
});

describe("worldMapsRepo.marcarDispensaDoPadrao", () => {
  it("faz merge no perfil e carimba a data ao dispensar", async () => {
    await repo.marcarDispensaDoPadrao("u1", "mapaPadraoDispensado", "mapaPadraoDispensadoEm", true);

    /* `merge:true` e não `updateDoc`: o perfil pode não existir ainda (conta antiga), e
     * o merge não encosta em `plan` nem em `subscribedSystems`. */
    expect(setDoc).toHaveBeenCalledWith(
      { path: "users/u1" },
      { mapaPadraoDispensado: true, mapaPadraoDispensadoEm: "<ts>" },
      { merge: true },
    );
  });

  it("ao restaurar, limpa a data em vez de carimbar", async () => {
    await repo.marcarDispensaDoPadrao("u1", "mapaPadraoDispensado", "mapaPadraoDispensadoEm", false);
    expect(setDoc.mock.calls[0][1]).toEqual({
      mapaPadraoDispensado: false, mapaPadraoDispensadoEm: null,
    });
  });

  it("@policy strict", async () => {
    setDoc.mockRejectedValue(new Error("denied"));
    await expect(repo.marcarDispensaDoPadrao("u1", "a", "b", true)).rejects.toThrow("denied");
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  GRAFO — nós e trilhas
 * ════════════════════════════════════════════════════════════════════════ */

describe("worldMapsRepo — nós", () => {
  it("adicionarNo grava um documento na subcoleção `nodes`", async () => {
    const id = await repo.adicionarNo("u1", "m1", { x: 10, y: 20 });

    expect(id).toBe("gerado-1");
    expect(addDoc).toHaveBeenCalledWith(
      { path: "users/u1/worldmaps/m1/nodes" },
      { x: 10, y: 20, createdAt: "<ts>", updatedAt: "<ts>" },
    );
  });

  it("atualizarNo escreve no documento do nó e envelhece só ele", async () => {
    await repo.atualizarNo("u1", "m1", "n1", { name: "Vila Candeia" });
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "users/u1/worldmaps/m1/nodes/n1" },
      { name: "Vila Candeia", updatedAt: "<ts>" },
    );
  });

  it("ajustarContagemDeNos usa `increment` para não perder contagem entre abas", async () => {
    await repo.ajustarContagemDeNos("u1", "m1", 1, 7);

    expect(updateDoc).toHaveBeenCalledWith(
      { path: "users/u1/worldmaps/m1" },
      { nodeCount: { __inc: 1 }, updatedAt: "<ts>" },
    );
    expect(increment).toHaveBeenCalledWith(1);
  });

  it("sem `increment` no SDK, cai no absoluto e nunca fica negativo", async () => {
    /* Degradação honesta: um dublê de `firebase/firestore` pode não trazer o
     * `increment`. O contador continua certo, só perde a proteção contra duas abas. */
    const real = fs().increment;
    fs().increment = undefined;
    try {
      await repo.ajustarContagemDeNos("u1", "m1", -1, 4);
      expect(updateDoc.mock.calls[0][1].nodeCount).toBe(3);

      await repo.ajustarContagemDeNos("u1", "m1", -1, 0);
      expect(updateDoc.mock.calls[1][1].nodeCount).toBe(0);
    } finally {
      fs().increment = real;
    }
  });

  it("@policy strict — falha ao plantar nó REJEITA", async () => {
    addDoc.mockRejectedValue(new Error("denied"));
    await expect(repo.adicionarNo("u1", "m1", {})).rejects.toThrow("denied");
  });
});

describe("worldMapsRepo.apagarNoComTrilhas", () => {
  it("apaga trilhas, nó e contador no MESMO lote, nessa ordem", async () => {
    await repo.apagarNoComTrilhas("u1", "m1", "n1", {
      trilhaIds: ["t1", "t2"],
      contagem: { delta: -1, absoluto: 3 },
    });

    /* Um lote só: ou o nó e as trilhas somem juntos, ou nada some — trilha órfã não
     * sobrevive a um nó apagado. */
    expect(lotes).toHaveLength(1);
    const ops = opsDosLotes();
    expect(caminhos(ops)).toEqual([
      "users/u1/worldmaps/m1/edges/t1",
      "users/u1/worldmaps/m1/edges/t2",
      "users/u1/worldmaps/m1/nodes/n1",
      "users/u1/worldmaps/m1",
    ]);
    expect(ops[3]).toMatchObject({ type: "update", data: { nodeCount: { __inc: -1 }, updatedAt: "<ts>" } });
    expect(lotes[0].committed).toBe(true);
  });

  it("sem trilhas incidentes, ainda apaga o nó e corrige o contador", async () => {
    await repo.apagarNoComTrilhas("u1", "m1", "n1");
    expect(caminhos(opsDosLotes())).toEqual([
      "users/u1/worldmaps/m1/nodes/n1",
      "users/u1/worldmaps/m1",
    ]);
  });

  it("@policy strict", async () => {
    writeBatch.mockImplementation(() => ({
      set: jest.fn(), update: jest.fn(), delete: jest.fn(),
      commit: jest.fn().mockRejectedValue(new Error("aborted")),
    }));
    await expect(repo.apagarNoComTrilhas("u1", "m1", "n1")).rejects.toThrow("aborted");
  });
});

describe("worldMapsRepo — trilhas", () => {
  it("adicionarTrilha grava na subcoleção `edges`", async () => {
    await repo.adicionarTrilha("u1", "m1", { fromNodeId: "n1", toNodeId: "n2" });
    expect(addDoc.mock.calls[0][0].path).toBe("users/u1/worldmaps/m1/edges");
    expect(addDoc.mock.calls[0][1]).toMatchObject({ fromNodeId: "n1", createdAt: "<ts>" });
  });

  it("atualizarTrilha e apagarTrilha miram o documento certo", async () => {
    await repo.atualizarTrilha("u1", "m1", "t1", { travelHours: 9 });
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "users/u1/worldmaps/m1/edges/t1" }, { travelHours: 9, updatedAt: "<ts>" },
    );

    await repo.apagarTrilha("u1", "m1", "t1");
    expect(deleteDoc).toHaveBeenCalledWith({ path: "users/u1/worldmaps/m1/edges/t1" });
  });

  it("listarTrilhas devolve a subcoleção inteira com os ids", async () => {
    getDocs.mockResolvedValue(snapOf([docOf("t1", { fromNodeId: "n1" })]));
    await expect(repo.listarTrilhas("u1", "m1")).resolves.toEqual([{ id: "t1", fromNodeId: "n1" }]);
    expect(fs().collection).toHaveBeenCalledWith({}, "users", "u1", "worldmaps", "m1", "edges");
  });

  it("listarTrilhas sem uid ou sem mapId devolve [] sem tocar a rede", async () => {
    await expect(repo.listarTrilhas("", "m1")).resolves.toEqual([]);
    await expect(repo.listarTrilhas("u1", "")).resolves.toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("@policy strict — a varredura que falha REJEITA, senão apagaria o nó deixando órfãs", async () => {
    getDocs.mockRejectedValue(new Error("unavailable"));
    await expect(repo.listarTrilhas("u1", "m1")).rejects.toThrow("unavailable");
  });
});

describe("worldMapsRepo.semearGrafo", () => {
  it("grava nós ANTES de trilhas, com os ids combinados, e acerta o contador", async () => {
    await repo.semearGrafo("u1", "m2", {
      nos: [{ id: "no-1", dados: { x: 1 } }, { id: "no-2", dados: { x: 3 } }],
      trilhas: [{ id: "tr-1", dados: { fromNodeId: "no-1" } }],
      nodeCount: 2,
    });

    const ops = opsDosLotes();
    expect(caminhos(ops)).toEqual([
      "users/u1/worldmaps/m2/nodes/no-1",
      "users/u1/worldmaps/m2/nodes/no-2",
      "users/u1/worldmaps/m2/edges/tr-1",
      "users/u1/worldmaps/m2",
    ]);
    expect(ops[0]).toMatchObject({ type: "set", data: { x: 1, createdAt: "<ts>", updatedAt: "<ts>" } });
    /* Aqui o contador é ABSOLUTO, não `increment`: o molde acabou de nascer e o número
     * de nós é exatamente o que foi semeado. */
    expect(ops[3].data).toEqual({ nodeCount: 2, updatedAt: "<ts>" });
    expect(increment).not.toHaveBeenCalled();
  });

  it("grafo vazio ainda zera o contador do molde num lote só", async () => {
    await repo.semearGrafo("u1", "m2", {});
    expect(opsDosLotes()).toHaveLength(1);
    expect(opsDosLotes()[0].data).toEqual({ nodeCount: 0, updatedAt: "<ts>" });
  });

  it("@policy strict", async () => {
    writeBatch.mockImplementation(() => ({
      set: jest.fn(), update: jest.fn(), delete: jest.fn(),
      commit: jest.fn().mockRejectedValue(new Error("aborted")),
    }));
    await expect(repo.semearGrafo("u1", "m2", {})).rejects.toThrow("aborted");
  });
});

describe("worldMapsRepo.observarNos / observarTrilhas", () => {
  it("assinam as subcoleções direto, sem `query`", () => {
    onSnapshot.mockImplementation(() => () => {});

    repo.observarNos("u1", "m1", () => {});
    repo.observarTrilhas("u1", "m1", () => {});

    expect(onSnapshot.mock.calls[0][0]).toEqual({ path: "users/u1/worldmaps/m1/nodes" });
    expect(onSnapshot.mock.calls[1][0]).toEqual({ path: "users/u1/worldmaps/m1/edges" });
    // Sem filtro nem ordem: o grafo inteiro é desenhado de uma vez.
    expect(query).not.toHaveBeenCalled();
  });

  it("entregam a lista com o id do documento e repassam o erro", () => {
    let nos;
    const erro = new Error("denied");
    onSnapshot.mockImplementationOnce((_ref, next) => { next(snapOf([docOf("n1", { x: 1 })])); return () => {}; });
    repo.observarNos("u1", "m1", (l) => { nos = l; });
    expect(nos).toEqual([{ id: "n1", x: 1 }]);

    const onError = jest.fn();
    onSnapshot.mockImplementationOnce((_ref, _next, onErr) => { onErr(erro); return () => {}; });
    repo.observarTrilhas("u1", "m1", () => {}, onError);
    expect(onError).toHaveBeenCalledWith(erro);
  });

  it("sem uid ou sem mapId, devolvem unsubscribe inerte e não assinam nada", () => {
    /* É o caso do mapa PADRÃO: ele não existe no Firestore (AC-13), e a tela chama o
     * hook sem condicional. */
    const a = repo.observarNos("", "m1", () => {});
    const b = repo.observarTrilhas("u1", "", () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { a(); a(); b(); b(); }).not.toThrow();
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  EVENTOS
 * ════════════════════════════════════════════════════════════════════════ */

describe("worldMapsRepo — eventos", () => {
  it("gravam na subcoleção `events` do molde, onde o segredo do mestre é protegido", async () => {
    await repo.adicionarEvento("u1", "m1", { title: "A porta range", gmText: "é uma armadilha" });
    expect(addDoc.mock.calls[0][0].path).toBe("users/u1/worldmaps/m1/events");
    /* `gmText` só pode viver aqui: no ateliê as rules negam leitura a outro uid. O que
     * chega à campanha é a projeção por lista branca do `mesaStore`. */
    expect(addDoc.mock.calls[0][1].gmText).toBe("é uma armadilha");

    await repo.atualizarEvento("u1", "m1", "ev1", { title: "X" });
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "users/u1/worldmaps/m1/events/ev1" }, { title: "X", updatedAt: "<ts>" },
    );

    await repo.apagarEvento("u1", "m1", "ev1");
    expect(deleteDoc).toHaveBeenCalledWith({ path: "users/u1/worldmaps/m1/events/ev1" });
  });

  it("observarEventos assina a subcoleção e entrega a lista com id", () => {
    let eventos;
    onSnapshot.mockImplementation((_ref, next) => { next(snapOf([docOf("ev1", { title: "X" })])); return () => {}; });

    repo.observarEventos("u1", "m1", (l) => { eventos = l; });

    expect(onSnapshot.mock.calls[0][0]).toEqual({ path: "users/u1/worldmaps/m1/events" });
    expect(eventos).toEqual([{ id: "ev1", title: "X" }]);
  });

  it("sem mapId, não assina nada e o unsubscribe é idempotente", () => {
    const unsub = repo.observarEventos("u1", "", () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();
  });

  it("@policy strict", async () => {
    deleteDoc.mockRejectedValue(new Error("denied"));
    await expect(repo.apagarEvento("u1", "m1", "ev1")).rejects.toThrow("denied");
  });
});
