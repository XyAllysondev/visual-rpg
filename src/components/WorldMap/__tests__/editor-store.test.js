/* ════════════════════════════════════════════════════════════════════
 *  O GRAFO NO FIRESTORE — CONTRATO DA PERSISTÊNCIA  (spec 0028 · F2 · AC-4)
 *  --------------------------------------------------------------------
 *  O Firestore é 100% mockado: o que está sob teste é o CONTRATO — ONDE
 *  cada nó e cada trilha são gravados, o que sai junto na exclusão, o que
 *  o contador denormalizado faz, e o que o store se RECUSA a fazer.
 *  Mesmo padrão de `worldMapStore.test.js` (F1).
 *
 *  As duas regras que mais importam aqui, porque a F4 depende delas:
 *   · um documento por item, nas subcoleções `nodes` e `edges` do molde
 *     (design §3) — nunca um array dentro do doc do mapa;
 *   · apagar um nó apaga as trilhas que o tocam, no MESMO lote.
 * ════════════════════════════════════════════════════════════════════ */

import * as firestore from "firebase/firestore";
import {
  createNode, updateNode, deleteNode,
  createEdge, updateEdge, deleteEdge,
  semearGrafo, useGrafo, NODES, EDGES,
} from "../worldMapStore";
import { renderHook, act } from "@testing-library/react";

jest.mock("../../../firebase", () => ({
  db: { __db: true },
  auth: { currentUser: { uid: "mestre-1" } },
}));

jest.mock("firebase/firestore", () => {
  const state = { batches: [], listeners: [], autoId: 0, deletados: [] };
  const fns = {
    collection: jest.fn(), doc: jest.fn(), onSnapshot: jest.fn(),
    getDocs: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(), addDoc: jest.fn(),
    updateDoc: jest.fn(), deleteDoc: jest.fn(), serverTimestamp: jest.fn(),
    writeBatch: jest.fn(), increment: jest.fn(), query: jest.fn(), orderBy: jest.fn(),
  };
  const install = () => {
    state.batches.length = 0;
    state.listeners.length = 0;
    state.deletados.length = 0;
    state.autoId = 0;
    fns.collection.mockImplementation((_db, ...path) => ({ __type: "collection", path: path.join("/") }));
    fns.doc.mockImplementation((first, ...rest) => {
      if (first && first.__type === "collection") {
        state.autoId += 1;
        return { __type: "doc", id: `auto-${state.autoId}`, path: `${first.path}/auto-${state.autoId}` };
      }
      return { __type: "doc", id: rest[rest.length - 1], path: rest.join("/") };
    });
    fns.query.mockImplementation((ref) => ref);
    fns.orderBy.mockImplementation((field) => ({ __type: "orderBy", field }));
    fns.onSnapshot.mockImplementation((ref, next, error) => {
      const unsub = jest.fn();
      state.listeners.push({ ref, next, error, unsub });
      return unsub;
    });
    fns.getDocs.mockResolvedValue({ docs: [], empty: true, size: 0 });
    fns.getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
    fns.setDoc.mockResolvedValue(undefined);
    fns.updateDoc.mockResolvedValue(undefined);
    fns.deleteDoc.mockImplementation(async (ref) => { state.deletados.push(ref); });
    fns.addDoc.mockImplementation(async () => {
      state.autoId += 1;
      return { id: `new-${state.autoId}` };
    });
    fns.serverTimestamp.mockReturnValue("__ts__");
    fns.increment.mockImplementation((n) => ({ __inc: n }));
    fns.writeBatch.mockImplementation(() => {
      const batch = { sets: [], updates: [], deletes: [], committed: false };
      batch.set = jest.fn((ref, data) => batch.sets.push({ ref, data }));
      batch.update = jest.fn((ref, data) => batch.updates.push({ ref, data }));
      batch.delete = jest.fn((ref) => batch.deletes.push(ref));
      batch.commit = jest.fn(async () => { batch.committed = true; });
      state.batches.push(batch);
      return batch;
    });
  };
  install();
  return { ...fns, __mock: { state, install } };
});

const state = firestore.__mock.state;
const fakeDoc = (id, data = {}) => ({ id, data: () => data, ref: { __type: "doc", id } });
const fakeSnap = (docs) => ({ docs, empty: docs.length === 0, size: docs.length });
const caminhos = (refs) => refs.map((r) => r.path);
const todosDeletes = () => state.batches.flatMap((b) => b.deletes);
const todosUpdates = () => state.batches.flatMap((b) => b.updates);

beforeEach(() => { firestore.__mock.install(); });

/* ════════════════════════════════════════════════════════════════════
 *  1 · NÓS
 * ════════════════════════════════════════════════════════════════════ */
describe("createNode", () => {
  it("grava um documento na subcoleção `nodes` do molde (design §3)", async () => {
    const id = await createNode("mestre-1", "m1", { x: 10, y: 20 }, { plan: "pago", nodeCount: 0 });

    expect(id).toBe("new-1");
    const [ref, data] = firestore.addDoc.mock.calls[0];
    expect(ref.path).toBe(`users/mestre-1/worldmaps/m1/${NODES}`);
    expect(data).toMatchObject({ x: 10, y: 20, type: "poi", name: "Novo local" });
    /* O `id` é a chave do documento, nunca um campo dentro dele. */
    expect(data).not.toHaveProperty("id");
    expect(data.createdAt).toBe("__ts__");
  });

  it("incrementa o contador denormalizado do molde", async () => {
    await createNode("mestre-1", "m1", { x: 1, y: 2 }, { plan: "pago", nodeCount: 7 });
    const [ref, patch] = firestore.updateDoc.mock.calls[0];
    expect(ref.path).toBe("users/mestre-1/worldmaps/m1");
    expect(patch.nodeCount).toEqual({ __inc: 1 });
  });

  it("recusa além da cota do plano ANTES de escrever (AC-3)", async () => {
    await expect(
      createNode("mestre-1", "m1", { x: 1, y: 1 }, { plan: "free", nodeCount: 25 }),
    ).rejects.toThrow(/Seu plano permite 25 nós por mapa-múndi/);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it("plano ausente é tratado como free — o lado seguro", async () => {
    await expect(
      createNode("mestre-1", "m1", { x: 1, y: 1 }, { nodeCount: 25 }),
    ).rejects.toThrow(/assine um plano/i);
  });

  it("delega a validação a `criarNo` e não inventa uma segunda régua", async () => {
    await expect(createNode("mestre-1", "m1", { x: "aqui", y: 2 }, { plan: "pago" }))
      .rejects.toThrow(/coordenadas x e y numéricas/);
    await expect(createNode("mestre-1", "m1", { x: 1, y: 2, type: "vilarejo" }, { plan: "pago" }))
      .rejects.toThrow(/Tipo de nó desconhecido/);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it("exige autenticação e mapa, em português", async () => {
    await expect(createNode("", "m1", { x: 1, y: 1 })).rejects.toThrow(/autenticado/);
    await expect(createNode("mestre-1", "", { x: 1, y: 1 })).rejects.toThrow(/Informe em qual mapa/);
  });
});

describe("updateNode", () => {
  it("escreve no documento do nó e envelhece o molde", async () => {
    await updateNode("mestre-1", "m1", "n1", { name: "Vila Candeia" });
    const [ref, data] = firestore.updateDoc.mock.calls[0];
    expect(ref.path).toBe(`users/mestre-1/worldmaps/m1/${NODES}/n1`);
    expect(data).toEqual({ name: "Vila Candeia", updatedAt: "__ts__" });
    /* A lista do ateliê ordena por `updatedAt` do molde. */
    expect(firestore.updateDoc.mock.calls[1][0].path).toBe("users/mestre-1/worldmaps/m1");
  });

  it("não deixa o `id` virar campo do documento", async () => {
    await updateNode("mestre-1", "m1", "n1", { id: "outro", name: "x" });
    expect(firestore.updateDoc.mock.calls[0][1]).not.toHaveProperty("id");
  });

  it("recusa mover para coordenada que não é número", async () => {
    await expect(updateNode("mestre-1", "m1", "n1", { x: 10 })).rejects.toThrow(/numéricas/);
    await expect(updateNode("mestre-1", "m1", "n1", { x: NaN, y: 3 })).rejects.toThrow(/numéricas/);
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it("recusa patch que não é objeto", async () => {
    await expect(updateNode("mestre-1", "m1", "n1", [1, 2])).rejects.toThrow(/campos do nó/);
  });
});

describe("deleteNode", () => {
  const TRILHAS = [
    { id: "t1", fromNodeId: "n1", toNodeId: "n2" },
    { id: "t2", fromNodeId: "n3", toNodeId: "n1" },
    { id: "t3", fromNodeId: "n2", toNodeId: "n3" },
  ];

  it("apaga o nó E as trilhas que o tocam, no mesmo lote", async () => {
    const r = await deleteNode("mestre-1", "m1", "n1", { trilhas: TRILHAS, nodeCount: 3 });

    expect(r.trilhasRemovidas).toBe(2);
    const paths = caminhos(todosDeletes());
    expect(paths).toContain(`users/mestre-1/worldmaps/m1/${EDGES}/t1`);
    expect(paths).toContain(`users/mestre-1/worldmaps/m1/${EDGES}/t2`);
    expect(paths).toContain(`users/mestre-1/worldmaps/m1/${NODES}/n1`);
    /* A trilha que não toca o nó sobrevive. */
    expect(paths).not.toContain(`users/mestre-1/worldmaps/m1/${EDGES}/t3`);
    expect(state.batches.every((b) => b.committed)).toBe(true);
  });

  it("decrementa o contador no mesmo lote", async () => {
    await deleteNode("mestre-1", "m1", "n1", { trilhas: [], nodeCount: 4 });
    const patch = todosUpdates().find((u) => u.ref.path === "users/mestre-1/worldmaps/m1");
    expect(patch.data.nodeCount).toEqual({ __inc: -1 });
  });

  it("sem a lista de trilhas em mãos, varre a subcoleção — nunca deixa órfã", async () => {
    firestore.getDocs.mockResolvedValue(fakeSnap([
      fakeDoc("t9", { fromNodeId: "n1", toNodeId: "n5" }),
    ]));
    const r = await deleteNode("mestre-1", "m1", "n1");
    expect(firestore.getDocs).toHaveBeenCalled();
    expect(r.trilhasRemovidas).toBe(1);
    expect(caminhos(todosDeletes())).toContain(`users/mestre-1/worldmaps/m1/${EDGES}/t9`);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · TRILHAS
 * ════════════════════════════════════════════════════════════════════ */
describe("createEdge", () => {
  it("grava na subcoleção `edges`, com o par canônico do design §3", async () => {
    const id = await createEdge("mestre-1", "m1", { fromId: "n1", toId: "n2", travelHours: 4 });

    expect(id).toBe("new-1");
    const [ref, data] = firestore.addDoc.mock.calls[0];
    expect(ref.path).toBe(`users/mestre-1/worldmaps/m1/${EDGES}`);
    /* `criarTrilha` aceita `fromId`, mas grava SEMPRE `fromNodeId`. */
    expect(data.fromNodeId).toBe("n1");
    expect(data.toNodeId).toBe("n2");
    expect(data).not.toHaveProperty("fromId");
    expect(data.travelHours).toBe(4);
    expect(data.isSecret).toBe(false);
  });

  it("recusa autoligação — a régua é `criarTrilha`", async () => {
    await expect(createEdge("mestre-1", "m1", { fromId: "n1", toId: "n1" }))
      .rejects.toThrow(/não pode ligar um nó a ele mesmo/);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it("recusa duplicata em qualquer sentido — a régua é `trilhaDuplicada`", async () => {
    const existentes = [{ id: "t1", fromNodeId: "n2", toNodeId: "n1" }];
    await expect(createEdge("mestre-1", "m1", { fromId: "n1", toId: "n2" }, { trilhas: existentes }))
      .rejects.toThrow(/Já existe uma trilha ligando esses dois lugares/);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it("guarda o teste de descoberta e o segredo como o design §3 define", async () => {
    await createEdge("mestre-1", "m1", {
      fromId: "n1", toId: "n2", isSecret: true, isOneWay: true,
      discoveryCheck: { skill: "Ocultismo", dc: 22 }, dangerLevel: 5,
    });
    const data = firestore.addDoc.mock.calls[0][1];
    expect(data.isSecret).toBe(true);
    expect(data.isOneWay).toBe(true);
    expect(data.discoveryCheck).toEqual({ skill: "Ocultismo", dc: 22 });
    expect(data.dangerLevel).toBe(5);
  });
});

describe("updateEdge / deleteEdge", () => {
  it("atualiza o documento certo", async () => {
    await updateEdge("mestre-1", "m1", "t1", { travelHours: 9 });
    expect(firestore.updateDoc.mock.calls[0][0].path)
      .toBe(`users/mestre-1/worldmaps/m1/${EDGES}/t1`);
    expect(firestore.updateDoc.mock.calls[0][1].travelHours).toBe(9);
  });

  it("recusa pontos de controle que não são lista", async () => {
    await expect(updateEdge("mestre-1", "m1", "t1", { pathPoints: "curvo" }))
      .rejects.toThrow(/lista de \{ x, y \}/);
  });

  it("apagar a trilha não toca nos nós", async () => {
    await deleteEdge("mestre-1", "m1", "t1");
    expect(state.deletados).toHaveLength(1);
    expect(state.deletados[0].path).toBe(`users/mestre-1/worldmaps/m1/${EDGES}/t1`);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · SEMEAR (cópia ao usar do mapa padrão — AC-13)
 * ════════════════════════════════════════════════════════════════════ */
describe("semearGrafo", () => {
  it("grava nós e trilhas com os ids combinados, em lote, e acerta o contador", async () => {
    const r = await semearGrafo("mestre-1", "m2", {
      nos: [{ id: "copia-no-1", x: 1, y: 2 }, { id: "copia-no-2", x: 3, y: 4 }],
      trilhas: [{ id: "copia-trilha-1", fromNodeId: "copia-no-1", toNodeId: "copia-no-2" }],
    });

    expect(r).toEqual({ nos: 2, trilhas: 1 });
    const sets = state.batches.flatMap((b) => b.sets);
    expect(caminhos(sets.map((s) => s.ref))).toEqual([
      `users/mestre-1/worldmaps/m2/${NODES}/copia-no-1`,
      `users/mestre-1/worldmaps/m2/${NODES}/copia-no-2`,
      `users/mestre-1/worldmaps/m2/${EDGES}/copia-trilha-1`,
    ]);
    const contador = todosUpdates().find((u) => u.ref.path === "users/mestre-1/worldmaps/m2");
    expect(contador.data.nodeCount).toBe(2);
  });

  it("ignora item sem id — inventar um quebraria as pontas das trilhas", async () => {
    const r = await semearGrafo("mestre-1", "m2", {
      nos: [{ x: 1, y: 2 }],
      trilhas: [{ fromNodeId: "a", toNodeId: "b" }],
    });
    expect(r).toEqual({ nos: 0, trilhas: 0 });
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · useGrafo
 * ════════════════════════════════════════════════════════════════════ */
describe("useGrafo", () => {
  it("assina as DUAS subcoleções e só sai de `loading` quando as duas chegam", () => {
    const { result } = renderHook(() => useGrafo("mestre-1", "m1"));
    expect(result.current.loading).toBe(true);
    expect(state.listeners).toHaveLength(2);
    expect(state.listeners.map((l) => l.ref.path)).toEqual([
      `users/mestre-1/worldmaps/m1/${NODES}`,
      `users/mestre-1/worldmaps/m1/${EDGES}`,
    ]);

    /* Só os nós chegaram — meio grafo desenharia trilha sem nó. */
    act(() => { state.listeners[0].next(fakeSnap([fakeDoc("n1", { x: 1, y: 2 })])); });
    expect(result.current.loading).toBe(true);
    expect(result.current.nos).toEqual([{ id: "n1", x: 1, y: 2 }]);

    act(() => { state.listeners[1].next(fakeSnap([fakeDoc("t1", { fromNodeId: "n1" })])); });
    expect(result.current.loading).toBe(false);
    expect(result.current.trilhas).toEqual([{ id: "t1", fromNodeId: "n1" }]);
  });

  it("um contador não bastaria: o mesmo listener disparando duas vezes não conclui", () => {
    const { result } = renderHook(() => useGrafo("mestre-1", "m1"));
    act(() => { state.listeners[0].next(fakeSnap([])); });
    act(() => { state.listeners[0].next(fakeSnap([fakeDoc("n1", { x: 0, y: 0 })])); });
    expect(result.current.loading).toBe(true);
  });

  it("sem uid ou sem mapa não assina nada — é o caso do mapa padrão (AC-13)", () => {
    const { result } = renderHook(() => useGrafo("", ""));
    expect(state.listeners).toHaveLength(0);
    expect(result.current).toEqual({ nos: [], trilhas: [], loading: false, error: null });
  });

  it("a falha do listener sobe crua e destrava a tela", () => {
    const { result } = renderHook(() => useGrafo("mestre-1", "m1"));
    const erro = Object.assign(new Error("negado"), { code: "permission-denied" });
    act(() => { state.listeners[0].error(erro); });
    expect(result.current.error).toBe(erro);
    expect(result.current.loading).toBe(false);
  });

  it("desfaz as duas assinaturas ao desmontar", () => {
    const { unmount } = renderHook(() => useGrafo("mestre-1", "m1"));
    unmount();
    expect(state.listeners.every((l) => l.unsub.mock.calls.length === 1)).toBe(true);
  });
});
