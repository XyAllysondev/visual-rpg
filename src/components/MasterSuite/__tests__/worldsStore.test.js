/**
 * Contrato da camada de persistência da Forja do Mestre (spec 0027).
 *
 * O Firestore é 100% mockado: o que está sob teste é o CONTRATO do store —
 * o que ele grava, o que ele apaga junto e o que ele se recusa a fazer.
 *
 * Nota: o CRA liga `resetMocks: true`, então as implementações dos mocks são
 * reinstaladas a cada teste via `__mock.install()`.
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import * as firestore from "firebase/firestore";
import { buildDemoWorld } from "../model/demoWorld";
import {
  createWorld, updateWorld, deleteWorld,
  createEntity, updateEntity, deleteEntity,
  createConnection, deleteConnection,
  createFolder, updateFolder, deleteFolder,
  seedDemoWorld,
  useWorlds, useEntities, useConnections, useActiveWorld,
  activeWorldStorageKey, toNameLower, BATCH_LIMIT,
} from "../worldsStore";

// `auth.currentUser` é lido nas escritas: desde a correção do lote do mundo demo,
// cada documento de subcoleção carrega `ownerUid` para a regra não precisar de
// `get()` (o Firestore limita a 20 access calls por lote).
const UID_LOGADO = "uid-mestre";
jest.mock("../../../firebase", () => ({
  db: { __db: true },
  auth: { currentUser: { uid: "uid-mestre" } },
}));

jest.mock("firebase/firestore", () => {
  const state = { batches: [], listeners: [], autoId: 0 };
  const fns = {
    collection: jest.fn(), doc: jest.fn(), query: jest.fn(), where: jest.fn(),
    orderBy: jest.fn(), onSnapshot: jest.fn(), getDocs: jest.fn(), getDoc: jest.fn(),
    addDoc: jest.fn(), updateDoc: jest.fn(), deleteDoc: jest.fn(),
    serverTimestamp: jest.fn(), writeBatch: jest.fn(),
  };
  const install = () => {
    state.batches.length = 0;
    state.listeners.length = 0;
    state.autoId = 0;
    fns.collection.mockImplementation((_db, ...path) => ({ __type: "collection", path: path.join("/") }));
    fns.doc.mockImplementation((first, ...rest) => {
      if (first && first.__type === "collection") {
        state.autoId += 1;
        const id = `auto-${state.autoId}`;
        return { __type: "doc", id, path: `${first.path}/${id}` };
      }
      return { __type: "doc", id: rest[rest.length - 1], path: rest.join("/") };
    });
    fns.query.mockImplementation((ref, ...clauses) => ({ __type: "query", ref, clauses }));
    fns.where.mockImplementation((field, op, value) => ({ __type: "where", field, op, value }));
    fns.orderBy.mockImplementation((field, dir = "asc") => ({ __type: "orderBy", field, dir }));
    fns.onSnapshot.mockImplementation((q, next, error) => {
      const unsub = jest.fn();
      state.listeners.push({ q, next, error, unsub });
      return unsub;
    });
    fns.getDocs.mockResolvedValue({ docs: [], empty: true, size: 0 });
    fns.getDoc.mockResolvedValue({ exists: () => true, id: "w-1", data: () => ({}) });
    fns.addDoc.mockImplementation(async () => {
      state.autoId += 1;
      return { id: `new-${state.autoId}` };
    });
    fns.updateDoc.mockResolvedValue(undefined);
    fns.deleteDoc.mockResolvedValue(undefined);
    fns.serverTimestamp.mockReturnValue("__ts__");
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

// Mock virtual: o conteúdo do seed é gate do `demoWorld.test.js`; aqui só importa
// que o store consuma a API `buildDemoWorld()` e traduza os ids locais.
jest.mock("../model/demoWorld", () => ({ buildDemoWorld: jest.fn() }), { virtual: true });

/* ── Utilidades ──────────────────────────────────────────────────────────── */

const state = firestore.__mock.state;

const fakeDoc = (id, data) => ({ id, data: () => data, ref: { __type: "doc", id } });
const fakeSnap = (docs) => ({ docs, empty: docs.length === 0, size: docs.length });

const lastBatch = () => state.batches[state.batches.length - 1];
const allDeletes = () => state.batches.flatMap((b) => b.deletes);
const allUpdates = () => state.batches.flatMap((b) => b.updates);

beforeEach(() => {
  firestore.__mock.install();
  window.localStorage.clear();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* ── Mundos ──────────────────────────────────────────────────────────────── */

describe("createWorld", () => {
  it("exige um nome (AC-2)", async () => {
    await expect(createWorld("mestre-1", { name: "   " })).rejects.toThrow(/nome/i);
    await expect(createWorld("mestre-1", {})).rejects.toThrow(/nome/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  // OBS-1 do E2E: o seed marcava `demo: true` e o store jogava fora — depois de
  // criado, não havia como distinguir o mundo de exemplo do mundo autoral.
  it("persiste a marca `demo` (e grava false quando o mundo é autoral)", async () => {
    await createWorld("mestre-1", { name: "Aurora" });
    expect(firestore.addDoc.mock.calls[0][1]).toMatchObject({ demo: false });

    await createWorld("mestre-1", { name: "Coroa de Cinzas", demo: true });
    expect(firestore.addDoc.mock.calls[1][1]).toMatchObject({ demo: true });
  });

  it("exige um usuário autenticado", async () => {
    await expect(createWorld("", { name: "Aurora" })).rejects.toThrow(/autenticado/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it("grava ownerUid, nameLower e os carimbos de tempo, e devolve o id", async () => {
    const id = await createWorld("mestre-1", { name: "  Véu de Aurora  ", genre: "Horror" });
    expect(id).toBe("new-1");
    const [, data] = firestore.addDoc.mock.calls[0];
    expect(data).toMatchObject({
      ownerUid: "mestre-1",
      name: "Véu de Aurora",
      nameLower: "véu de aurora",
      description: "",
      genre: "Horror",
      createdAt: "__ts__",
      updatedAt: "__ts__",
    });
  });
});

describe("updateWorld", () => {
  it("re-deriva nameLower e sempre carimba updatedAt", async () => {
    await updateWorld("w-1", { name: "Novo NOME", genre: "Fantasia" });
    const [, data] = firestore.updateDoc.mock.calls[0];
    expect(data.nameLower).toBe("novo nome");
    expect(data.updatedAt).toBe("__ts__");
  });

  it("recusa nome vazio e mundo sem id", async () => {
    await expect(updateWorld("w-1", { name: "  " })).rejects.toThrow(/nome/i);
    await expect(updateWorld("", { genre: "x" })).rejects.toThrow(/mundo/i);
  });
});

describe("deleteWorld", () => {
  it("apaga as subcoleções respeitando o limite de 500 por lote", async () => {
    const entities = Array.from({ length: 700 }, (_, i) => fakeDoc(`e-${i}`, {}));
    firestore.getDocs
      .mockResolvedValueOnce(fakeSnap(entities))   // entities
      .mockResolvedValueOnce(fakeSnap([]))         // connections
      .mockResolvedValueOnce(fakeSnap([]));        // folders

    await deleteWorld("w-1");

    // 700 entidades + o próprio mundo = 701 operações → 2 lotes.
    expect(state.batches).toHaveLength(2);
    expect(state.batches[0].deletes).toHaveLength(BATCH_LIMIT);
    expect(allDeletes()).toHaveLength(701);
    expect(state.batches.every((b) => b.committed)).toBe(true);
    // o doc do mundo sai por último
    const last = allDeletes()[700];
    expect(last.path).toBe("worlds/w-1");
  });
});

/* ── Entidades ───────────────────────────────────────────────────────────── */

describe("createEntity", () => {
  it("grava nameLower em minúsculas para a busca (AC-3/AC-4)", async () => {
    const id = await createEntity("w-1", { type: "personagem", name: "  Coveiro do SÉTIMO Selo " });
    expect(id).toBe("new-1");
    const [ref, data] = firestore.addDoc.mock.calls[0];
    expect(ref.path).toBe("worlds/w-1/entities");
    expect(data.name).toBe("Coveiro do SÉTIMO Selo");
    expect(data.nameLower).toBe("coveiro do sétimo selo");
    expect(data.nameLower).toBe(toNameLower(data.name));
    expect(data).toMatchObject({
      type: "personagem", tags: [], attributes: [], folderId: null, imageUrl: null,
      createdAt: "__ts__", updatedAt: "__ts__",
    });
  });

  it("normaliza tags (sem vazios nem repetidas) e atributos (chave obrigatória)", async () => {
    await createEntity("w-1", {
      type: "local", name: "Vale",
      tags: [" ruínas ", "RUÍNAS", "", null, "ermo"],
      attributes: [{ key: " Clima ", value: " frio " }, { key: "", value: "x" }, { key: "Perigo", value: 3 }],
    });
    const [, data] = firestore.addDoc.mock.calls[0];
    expect(data.tags).toEqual(["ruínas", "ermo"]);
    expect(data.attributes).toEqual([{ key: "Clima", value: "frio" }, { key: "Perigo", value: "3" }]);
  });

  it("exige mundo, nome e tipo", async () => {
    await expect(createEntity("", { type: "item", name: "X" })).rejects.toThrow(/mundo/i);
    await expect(createEntity("w-1", { type: "item" })).rejects.toThrow(/nome/i);
    await expect(createEntity("w-1", { name: "X" })).rejects.toThrow(/tipo/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });
});

describe("updateEntity", () => {
  it("re-deriva nameLower na edição", async () => {
    await updateEntity("w-1", "e-1", { name: "Coveiro REDIVIVO" });
    const [ref, data] = firestore.updateDoc.mock.calls[0];
    expect(ref.path).toBe("worlds/w-1/entities/e-1");
    expect(data.nameLower).toBe("coveiro redivivo");
    expect(data.updatedAt).toBe("__ts__");
  });

  it("não inventa nameLower quando o nome não é tocado", async () => {
    await updateEntity("w-1", "e-1", { description: "nova descrição" });
    const [, data] = firestore.updateDoc.mock.calls[0];
    expect(data).not.toHaveProperty("nameLower");
    expect(data.updatedAt).toBe("__ts__");
  });
});

describe("deleteEntity", () => {
  it("apaga também as conexões que referenciam a entidade (AC-5)", async () => {
    firestore.getDocs
      .mockResolvedValueOnce(fakeSnap([fakeDoc("c-1", {}), fakeDoc("c-2", {})])) // fromId == e-1
      .mockResolvedValueOnce(fakeSnap([fakeDoc("c-2", {}), fakeDoc("c-3", {})])); // toId == e-1

    await deleteEntity("w-1", "e-1");

    expect(firestore.where).toHaveBeenCalledWith("fromId", "==", "e-1");
    expect(firestore.where).toHaveBeenCalledWith("toId", "==", "e-1");

    const deleted = allDeletes();
    // c-2 aparece nas duas buscas e não pode ser apagada duas vezes
    expect(deleted.map((r) => r.id)).toEqual(["c-1", "c-2", "c-3", "e-1"]);
    expect(deleted[3].path).toBe("worlds/w-1/entities/e-1");
    expect(lastBatch().committed).toBe(true);
  });

  it("apaga a entidade mesmo sem conexões", async () => {
    await deleteEntity("w-1", "e-1");
    expect(allDeletes()).toHaveLength(1);
    expect(allDeletes()[0].path).toBe("worlds/w-1/entities/e-1");
  });
});

/* ── Conexões ────────────────────────────────────────────────────────────── */

describe("createConnection", () => {
  it("nunca conecta uma entidade a ela mesma (AC-5)", async () => {
    await expect(
      createConnection("w-1", { fromId: "e-1", toId: "e-1", relation: "CONTÉM" })
    ).rejects.toThrow(/ela mesma/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it("recusa duplicata da mesma relação no mesmo sentido (AC-5)", async () => {
    firestore.getDocs
      .mockResolvedValueOnce(fakeSnap([fakeDoc("c-1", { relation: "contém", inverse: "contido em" })]))
      .mockResolvedValueOnce(fakeSnap([]));
    await expect(
      createConnection("w-1", { fromId: "e-1", toId: "e-2", relation: "CONTÉM" })
    ).rejects.toThrow(/já existe/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it("recusa duplicata que chega pelo lado inverso (AC-5)", async () => {
    firestore.getDocs
      .mockResolvedValueOnce(fakeSnap([]))
      .mockResolvedValueOnce(fakeSnap([fakeDoc("c-1", { relation: "CONTÉM", inverse: "CONTIDO EM" })]));
    await expect(
      createConnection("w-1", { fromId: "e-2", toId: "e-1", relation: "contido em" })
    ).rejects.toThrow(/já existe/i);
  });

  it("grava a conexão com inverso padrão igual à relação", async () => {
    const id = await createConnection("w-1", { fromId: "e-1", toId: "e-2", relation: "ALIANÇA" });
    expect(id).toBe("new-1");
    const [ref, data] = firestore.addDoc.mock.calls[0];
    expect(ref.path).toBe("worlds/w-1/connections");
    expect(data).toMatchObject({
      fromId: "e-1", toId: "e-2", relation: "ALIANÇA", inverse: "ALIANÇA",
      kind: null, createdAt: "__ts__",
    });
  });

  it("exige origem, destino e relação", async () => {
    await expect(createConnection("w-1", { toId: "e-2", relation: "X" })).rejects.toThrow(/origem/i);
    await expect(createConnection("w-1", { fromId: "e-1", relation: "X" })).rejects.toThrow(/destino/i);
    await expect(createConnection("w-1", { fromId: "e-1", toId: "e-2" })).rejects.toThrow(/relação/i);
  });
});

describe("deleteConnection", () => {
  it("remove o documento da conexão", async () => {
    await deleteConnection("w-1", "c-1");
    expect(firestore.deleteDoc).toHaveBeenCalledTimes(1);
    expect(firestore.deleteDoc.mock.calls[0][0].path).toBe("worlds/w-1/connections/c-1");
  });

  it("exige o id da conexão", async () => {
    await expect(deleteConnection("w-1", "")).rejects.toThrow(/conexão/i);
  });
});

/* ── Pastas ──────────────────────────────────────────────────────────────── */

describe("createFolder / updateFolder", () => {
  it("cria com escopo wiki por padrão", async () => {
    await createFolder("w-1", { name: " Panteão " });
    const [, data] = firestore.addDoc.mock.calls[0];
    expect(data).toMatchObject({ name: "Panteão", scope: "wiki", parentId: null, order: 0 });
  });

  it("recusa escopo inválido e nome vazio", async () => {
    await expect(createFolder("w-1", { name: "X", scope: "grafo" })).rejects.toThrow(/escopo/i);
    await expect(createFolder("w-1", { name: " " })).rejects.toThrow(/nome/i);
    await expect(updateFolder("w-1", "f-1", { parentId: "f-1" })).rejects.toThrow(/ela mesma/i);
  });
});

describe("deleteFolder", () => {
  it("NÃO apaga as entidades: elas voltam para a raiz", async () => {
    firestore.getDoc.mockResolvedValueOnce({
      exists: () => true, id: "f-1", data: () => ({ name: "Panteão", parentId: "f-pai" }),
    });
    firestore.getDocs
      .mockResolvedValueOnce(fakeSnap([fakeDoc("e-1", {}), fakeDoc("e-2", {})])) // folderId == f-1
      .mockResolvedValueOnce(fakeSnap([fakeDoc("f-2", {})]));                    // parentId == f-1

    await deleteFolder("w-1", "f-1");

    const updates = allUpdates();
    expect(updates.filter((u) => u.data.folderId === null).map((u) => u.ref.id)).toEqual(["e-1", "e-2"]);
    // subpasta sobe um nível, herdando o pai da pasta removida
    expect(updates.find((u) => u.ref.id === "f-2").data.parentId).toBe("f-pai");

    // a ÚNICA exclusão é a da própria pasta
    const deleted = allDeletes();
    expect(deleted).toHaveLength(1);
    expect(deleted[0].path).toBe("worlds/w-1/folders/f-1");
    expect(firestore.deleteDoc).not.toHaveBeenCalled();
  });
});

/* ── Mundo demo (AC-7) ───────────────────────────────────────────────────── */

describe("ownerUid nas subcoleções (lote do mundo demo)", () => {
  // O Firestore permite no máximo 20 `get()` por escrita em lote. Enquanto a regra
  // resolvia o dono com `get()` por documento, o lote de ~48 docs do mundo demo era
  // negado inteiro e o mundo nascia vazio. Cada documento carregar `ownerUid` é o
  // que mantém a regra O(1) — se isto quebrar, o mundo demo volta a nascer vazio.
  it("createEntity grava ownerUid do usuário logado", async () => {
    firestore.addDoc.mockResolvedValue({ id: "e-1" });
    await createEntity("w-1", { type: "location", name: "Vila" });
    expect(firestore.addDoc.mock.calls[0][1]).toMatchObject({ ownerUid: UID_LOGADO });
  });

  it("createConnection grava ownerUid do usuário logado", async () => {
    firestore.getDocs.mockResolvedValue({ docs: [], size: 0, empty: true });
    firestore.addDoc.mockResolvedValue({ id: "c-1" });
    await createConnection("w-1", { fromId: "a", toId: "b", relation: "CONTÉM" });
    expect(firestore.addDoc.mock.calls[0][1]).toMatchObject({ ownerUid: UID_LOGADO });
  });

  it("createFolder grava ownerUid do usuário logado", async () => {
    firestore.addDoc.mockResolvedValue({ id: "f-1" });
    await createFolder("w-1", { name: "Reinos" });
    expect(firestore.addDoc.mock.calls[0][1]).toMatchObject({ ownerUid: UID_LOGADO });
  });
});

describe("seedDemoWorld", () => {
  const seed = () => ({
    world: { name: "Ruínas de Aurora", description: "Mundo demo", genre: "Horror" },
    entities: [
      { id: "demo-personagem-1", type: "personagem", name: "Ada Vasques" },
      { id: "demo-local-1", type: "local", name: "Vale Cinzento" },
    ],
    connections: [
      { fromId: "demo-personagem-1", toId: "demo-local-1", relation: "HABITA", inverse: "ABRIGA" },
    ],
  });

  it("traduz os ids locais do seed para os ids reais do Firestore", async () => {
    buildDemoWorld.mockReturnValue(seed());

    const worldId = await seedDemoWorld("mestre-1");
    expect(worldId).toBe("new-1");

    const sets = state.batches.flatMap((b) => b.sets);
    const ada = sets.find((s) => s.data.name === "Ada Vasques");
    const vale = sets.find((s) => s.data.name === "Vale Cinzento");
    const conn = sets.find((s) => s.data.relation);

    expect(ada.data.nameLower).toBe("ada vasques");
    expect(conn.data.fromId).toBe(ada.ref.id);
    expect(conn.data.toId).toBe(vale.ref.id);
    expect(conn.data.fromId).not.toBe("demo-personagem-1");
    expect(conn.data.inverse).toBe("ABRIGA");
    expect(state.batches.every((b) => b.committed)).toBe(true);
  });

  it("falha alto quando a conexão do seed aponta para id inexistente", async () => {
    const broken = seed();
    broken.connections.push({ fromId: "demo-personagem-1", toId: "demo-fantasma-9", relation: "TEME" });
    buildDemoWorld.mockReturnValue(broken);
    await expect(seedDemoWorld("mestre-1")).rejects.toThrow(/inexistente/i);
  });

  it("exige usuário autenticado", async () => {
    await expect(seedDemoWorld(null)).rejects.toThrow(/autenticado/i);
    expect(buildDemoWorld).not.toHaveBeenCalled();
  });

  it("leva a marca `demo` do seed para o documento do mundo (OBS-1)", async () => {
    const comMarca = seed();
    comMarca.world = { ...comMarca.world, demo: true };
    buildDemoWorld.mockReturnValue(comMarca);

    await seedDemoWorld("mestre-1");

    expect(firestore.addDoc.mock.calls[0][1]).toMatchObject({
      name: "Ruínas de Aurora",
      demo: true,
    });
  });

  // BUG-2 do E2E: o doc do mundo é criado ANTES do conteúdo. Quando o lote falha,
  // sobra um mundo vazio na conta do mestre — e quem chama precisa saber disso para
  // conseguir contar a verdade na tela (a UI não tem outro jeito de descobrir).
  it("entrega o id do mundo órfão quando o conteúdo falha depois da criação", async () => {
    const quebrado = seed();
    quebrado.connections.push({ fromId: "demo-personagem-1", toId: "demo-fantasma-9", relation: "TEME" });
    buildDemoWorld.mockReturnValue(quebrado);

    const erro = await seedDemoWorld("mestre-1").catch((e) => e);

    expect(erro.message).toMatch(/inexistente/i);
    expect(erro.worldId).toBe("new-1");
    expect(erro.mundoParcial).toBe(true);
  });

  it("marca o mundo como parcial quando o lote é negado pelo Firestore", async () => {
    buildDemoWorld.mockReturnValue(seed());
    firestore.writeBatch.mockImplementation(() => ({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn(async () => {
        const e = new Error("Missing or insufficient permissions.");
        e.name = "FirebaseError";
        e.code = "permission-denied";
        throw e;
      }),
    }));

    const erro = await seedDemoWorld("mestre-1").catch((e) => e);

    expect(erro.code).toBe("permission-denied");
    expect(erro.worldId).toBe("new-1");
    expect(erro.mundoParcial).toBe(true);
  });
});

/* ── Hooks ───────────────────────────────────────────────────────────────── */

describe("useWorlds", () => {
  it("assina os mundos do dono ordenados por updatedAt e cancela no unmount", () => {
    const { result, unmount } = renderHook(() => useWorlds("mestre-1"));

    expect(firestore.where).toHaveBeenCalledWith("ownerUid", "==", "mestre-1");
    expect(firestore.orderBy).toHaveBeenCalledWith("updatedAt", "desc");
    expect(result.current.loading).toBe(true);

    act(() => {
      state.listeners[0].next(fakeSnap([fakeDoc("w-1", { name: "Aurora" })]));
    });
    expect(result.current.worlds).toEqual([
      { id: "w-1", name: "Aurora", pendenteNoServidor: false },
    ]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    const { unsub } = state.listeners[0];
    expect(unsub).not.toHaveBeenCalled();
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  /* O snapshot LOCAL chega antes do servidor confirmar a escrita. Sem este campo
   * a casca não tem como distinguir um mundo que existe de um mundo que só existe
   * aqui — e a regra da subcoleção nega a leitura do segundo. */
  it("marca o mundo com escrita ainda pendente no servidor", () => {
    const { result } = renderHook(() => useWorlds("mestre-1"));

    act(() => {
      state.listeners[0].next({
        docs: [
          {
            id: "w-novo",
            data: () => ({ name: "Coroa de Cinzas" }),
            metadata: { hasPendingWrites: true, fromCache: true },
          },
          {
            id: "w-velho",
            data: () => ({ name: "Aurora" }),
            metadata: { hasPendingWrites: false, fromCache: false },
          },
        ],
        empty: false,
        size: 2,
      });
    });

    expect(result.current.worlds.map((w) => [w.id, w.pendenteNoServidor])).toEqual([
      ["w-novo", true],
      ["w-velho", false],
    ]);
  });

  it("não assina nada sem uid", () => {
    const { result } = renderHook(() => useWorlds(null));
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
    expect(result.current.worlds).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("expõe o erro do listener em vez de engolir", () => {
    const { result } = renderHook(() => useWorlds("mestre-1"));
    const boom = new Error("permission-denied");
    act(() => { state.listeners[0].error(boom); });
    expect(result.current.error).toBe(boom);
    expect(result.current.loading).toBe(false);
  });
});

describe("useEntities / useConnections", () => {
  it("assinam as subcoleções do mundo e cancelam no unmount", () => {
    const entitiesHook = renderHook(() => useEntities("w-1"));
    const connectionsHook = renderHook(() => useConnections("w-1"));

    expect(state.listeners).toHaveLength(2);
    expect(state.listeners[0].q.ref.path).toBe("worlds/w-1/entities");
    expect(state.listeners[1].q.ref.path).toBe("worlds/w-1/connections");

    act(() => {
      state.listeners[0].next(fakeSnap([fakeDoc("e-1", { name: "Ada" })]));
      state.listeners[1].next(fakeSnap([fakeDoc("c-1", { relation: "HABITA" })]));
    });
    expect(entitiesHook.result.current.entities).toEqual([{ id: "e-1", name: "Ada" }]);
    expect(connectionsHook.result.current.connections).toEqual([{ id: "c-1", relation: "HABITA" }]);

    const [entitiesSub, connectionsSub] = state.listeners;
    entitiesHook.unmount();
    connectionsHook.unmount();
    expect(entitiesSub.unsub).toHaveBeenCalledTimes(1);
    expect(connectionsSub.unsub).toHaveBeenCalledTimes(1);
  });

  it("não assinam nada sem mundo ativo", () => {
    renderHook(() => useEntities(null));
    renderHook(() => useConnections(undefined));
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
  });
});

describe("useActiveWorld", () => {
  it("recupera o mundo ativo do localStorage por usuário (AC-2)", async () => {
    window.localStorage.setItem(activeWorldStorageKey("mestre-1"), "w-1");
    const { result } = renderHook(() => useActiveWorld("mestre-1"));
    await waitFor(() => expect(result.current.activeWorldId).toBe("w-1"));
  });

  it("persiste a troca de mundo na chave do usuário", async () => {
    const { result } = renderHook(() => useActiveWorld("mestre-1"));
    act(() => { result.current.setActiveWorldId("w-9"); });
    await waitFor(() => expect(result.current.activeWorldId).toBe("w-9"));
    expect(window.localStorage.getItem(activeWorldStorageKey("mestre-1"))).toBe("w-9");

    act(() => { result.current.setActiveWorldId(null); });
    await waitFor(() => expect(result.current.activeWorldId).toBeNull());
    expect(window.localStorage.getItem(activeWorldStorageKey("mestre-1"))).toBeNull();
  });

  it("limpa a seleção quando o mundo não existe mais", async () => {
    window.localStorage.setItem(activeWorldStorageKey("mestre-1"), "w-morto");
    firestore.getDoc.mockResolvedValue({ exists: () => false, id: "w-morto", data: () => ({}) });

    const { result } = renderHook(() => useActiveWorld("mestre-1"));
    await waitFor(() => expect(result.current.activeWorldId).toBeNull());
    expect(window.localStorage.getItem(activeWorldStorageKey("mestre-1"))).toBeNull();
  });

  it("mantém a seleção quando a checagem falha (offline), sem apagar nada", async () => {
    window.localStorage.setItem(activeWorldStorageKey("mestre-1"), "w-1");
    firestore.getDoc.mockRejectedValue(new Error("unavailable"));

    const { result } = renderHook(() => useActiveWorld("mestre-1"));
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(result.current.activeWorldId).toBe("w-1");
    expect(window.localStorage.getItem(activeWorldStorageKey("mestre-1"))).toBe("w-1");
  });

  it("limpa a seleção quando o mundo guardado dá permission-denied (mundo fantasma)", async () => {
    // Doc inexistente cai como `permission-denied` porque a regra lê
    // `resource.data.ownerUid` e `resource` é nulo. Se não limpar, a Forja fica
    // presa num mundo que não existe mais.
    window.localStorage.setItem(activeWorldStorageKey("mestre-1"), "w-fantasma");
    const erro = new Error("Missing or insufficient permissions.");
    erro.code = "permission-denied";
    firestore.getDoc.mockRejectedValue(erro);

    const { result } = renderHook(() => useActiveWorld("mestre-1"));
    await waitFor(() => expect(result.current.activeWorldId).toBeNull());
    expect(window.localStorage.getItem(activeWorldStorageKey("mestre-1"))).toBeNull();
  });

  it("ignora o storage quando não há usuário", () => {
    const { result } = renderHook(() => useActiveWorld(null));
    expect(result.current.activeWorldId).toBeNull();
    act(() => { result.current.setActiveWorldId("w-1"); });
    expect(window.localStorage.getItem(activeWorldStorageKey("null"))).toBeNull();
  });
});
