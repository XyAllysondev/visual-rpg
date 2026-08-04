/**
 * Contrato do repositório do agregado Mundo (Forja do Mestre) — spec 0030.
 *
 * O que está sob teste é a BORDA: qual caminho cada operação toca, quais
 * cláusulas a query carrega, o que atravessa a fronteira e o que não atravessa.
 * A regra da Forja (validação, `nameLower`, cruzamento de conexões, semeadura do
 * mundo demo) é gate de `MasterSuite/__tests__/worldsStore.test.js`.
 */
import {
  getDoc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, where, orderBy, serverTimestamp, writeBatch,
} from "firebase/firestore";
import * as worldsRepo from "../worldsRepo";
import { SERVER_TIMESTAMP, BATCH_LIMIT } from "../worldsRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: { __db: true }, auth: {} }));

const fs = () => require("firebase/firestore");

/** Documento cru do Firestore, como o SDK entrega — `id` fora, dados atrás de `data()`. */
const docOf = (id, data, metadata) => ({
  id,
  data: jest.fn(() => data),
  ...(metadata ? { metadata } : {}),
});
const snapOf = (docs) => ({ docs, size: docs.length, empty: docs.length === 0 });

/** `Timestamp` do SDK como ele chega num snapshot ao vivo — objeto com `.toMillis()`. */
const tsSdk = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

/** Lotes criados pelo `writeBatch` mockado, na ordem. */
let lotes = [];
/** Contador do id gerado no cliente por `doc(collectionRef)`. */
let autoId = 0;

// O preset Jest do CRA usa `resetMocks: true`: o que a fábrica do jest.mock instala
// é apagado antes de cada teste. Tudo o que o repo precisa é reinstalado aqui.
beforeEach(() => {
  lotes = [];
  autoId = 0;

  fs().collection.mockImplementation((_db, ...seg) => ({ __col: true, path: seg.join("/") }));
  fs().doc.mockImplementation((primeiro, ...resto) => {
    // `doc(collectionRef)` — overload que RESERVA um id sem escrever nada.
    if (primeiro && primeiro.__col) {
      autoId += 1;
      return { id: `auto-${autoId}`, path: `${primeiro.path}/auto-${autoId}` };
    }
    return { id: resto[resto.length - 1], path: resto.join("/") };
  });
  query.mockImplementation((ref, ...clauses) => ({ ref, clauses }));
  where.mockImplementation((campo, op, valor) => ({ where: campo, op, valor }));
  orderBy.mockImplementation((campo, direcao) => ({ orderBy: campo, direcao }));
  serverTimestamp.mockReturnValue("<serverTimestamp>");
  addDoc.mockResolvedValue({ id: "novo-1" });
  updateDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  getDocs.mockResolvedValue(snapOf([]));
  getDoc.mockResolvedValue({ exists: () => false, id: "x", data: () => ({}) });
  writeBatch.mockImplementation(() => {
    // `seq` guarda a ordem real das chamadas: apagar a pasta DEPOIS de realocar
    // o que estava dentro só funciona se o lote respeitar a fila.
    const lote = { sets: [], updates: [], deletes: [], seq: [], commitado: false };
    lote.set = jest.fn((ref, data) => { lote.sets.push({ ref, data }); lote.seq.push(["set", ref.path]); });
    lote.update = jest.fn((ref, data) => { lote.updates.push({ ref, data }); lote.seq.push(["update", ref.path]); });
    lote.delete = jest.fn((ref) => { lote.deletes.push(ref); lote.seq.push(["delete", ref.path]); });
    lote.commit = jest.fn(async () => { lote.commitado = true; });
    lotes.push(lote);
    return lote;
  });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

/* ── Carimbo de tempo (AC-4) ─────────────────────────────────────────────── */

describe("SERVER_TIMESTAMP", () => {
  it("é um sentinela inerte — não é o FieldValue do SDK", () => {
    // Se quem chama recebesse `serverTimestamp()`, a primitiva do SDK teria
    // atravessado a fronteira, que é exatamente o que o AC-4 proíbe.
    expect(typeof SERVER_TIMESTAMP).toBe("object");
    expect(Object.isFrozen(SERVER_TIMESTAMP)).toBe(true);
    expect(serverTimestamp).not.toHaveBeenCalled();
  });

  it("vira `serverTimestamp()` só na hora de gravar", async () => {
    await worldsRepo.createWorld({ name: "Coroa de Cinzas", createdAt: SERVER_TIMESTAMP });

    expect(addDoc.mock.calls[0][1]).toEqual({
      name: "Coroa de Cinzas", createdAt: "<serverTimestamp>",
    });
    expect(serverTimestamp).toHaveBeenCalledTimes(1);
  });

  it("não confunde um texto qualquer com o sentinela", async () => {
    // O sentinela é objeto congelado, e não a string "__ts__", justamente para
    // que um campo digitado pelo mestre nunca vire carimbo por acidente.
    await worldsRepo.createWorld({ name: "__ts__", description: "serverTimestamp" });

    expect(addDoc.mock.calls[0][1]).toEqual({ name: "__ts__", description: "serverTimestamp" });
    expect(serverTimestamp).not.toHaveBeenCalled();
  });
});

/* ── Mundo (documento raiz) ──────────────────────────────────────────────── */

describe("worldsRepo — documento do mundo", () => {
  it("createWorld grava na coleção raiz `worlds` e devolve o id em string", async () => {
    const id = await worldsRepo.createWorld({ ownerUid: "u1", name: "Aurora" });

    expect(addDoc.mock.calls[0][0]).toMatchObject({ path: "worlds" });
    expect(id).toBe("novo-1");
    // `DocumentReference` não atravessa a fronteira (AC-4).
    expect(typeof id).toBe("string");
  });

  it("updateWorld escreve em `worlds/{worldId}`", async () => {
    await worldsRepo.updateWorld("w-1", { updatedAt: SERVER_TIMESTAMP });

    expect(updateDoc).toHaveBeenCalledWith(
      { id: "w-1", path: "worlds/w-1" },
      { updatedAt: "<serverTimestamp>" }
    );
  });

  /* VIRADA DE CONTRATO — spec 0032 (AC-5): a leitura avulsa também devolvia o documento cru.
     Se só as assinaturas normalizassem, a mesma tela receberia número pelo `watch` e
     `Timestamp` pelo `getWorld` — duas formas do mesmo campo no mesmo componente. */
  it("getWorld devolve `{id, ...campos}` com as datas em epoch-ms", async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      id: "w-1",
      data: () => ({ name: "Aurora", createdAt: tsSdk(1000), updatedAt: tsSdk(2000) }),
    });

    await expect(worldsRepo.getWorld("w-1")).resolves.toEqual({
      id: "w-1", name: "Aurora", createdAt: 1000, updatedAt: 2000,
    });
    expect(getDoc).toHaveBeenCalledWith({ id: "w-1", path: "worlds/w-1" });
  });

  it("getWorld devolve null quando o documento não existe", async () => {
    // `null` é "não achei" — distinto de rejeitar, que é "não deu para procurar".
    // `useActiveWorld` usa essa diferença para não apagar a seleção do mestre
    // quando o app está offline.
    await expect(worldsRepo.getWorld("w-morto")).resolves.toBeNull();
  });

  it("getWorld sem id devolve null sem tocar a rede", async () => {
    await expect(worldsRepo.getWorld("")).resolves.toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("@policy strict — falha de leitura REJEITA", async () => {
    getDoc.mockRejectedValue(new Error("unavailable"));
    await expect(worldsRepo.getWorld("w-1")).rejects.toThrow("unavailable");
  });

  it("@policy strict — falha de escrita REJEITA", async () => {
    addDoc.mockRejectedValue(new Error("quota"));
    await expect(worldsRepo.createWorld({ name: "X" })).rejects.toThrow("quota");
  });
});

/* ── Entidades ───────────────────────────────────────────────────────────── */

describe("worldsRepo — entidades", () => {
  it("createEntity grava em `worlds/{id}/entities`", async () => {
    const id = await worldsRepo.createEntity("w-1", { name: "Ada" });

    expect(addDoc.mock.calls[0][0]).toMatchObject({ path: "worlds/w-1/entities" });
    expect(id).toBe("novo-1");
  });

  it("updateEntity escreve em `worlds/{id}/entities/{entityId}`", async () => {
    await worldsRepo.updateEntity("w-1", "e-1", { description: "nova" });

    expect(updateDoc).toHaveBeenCalledWith(
      { id: "e-1", path: "worlds/w-1/entities/e-1" },
      { description: "nova" }
    );
  });

  it("listEntitiesInFolder filtra por `folderId` em igualdade", async () => {
    getDocs.mockResolvedValue(snapOf([docOf("e-1", { name: "Ada" })]));

    await expect(worldsRepo.listEntitiesInFolder("w-1", "f-1")).resolves.toEqual([
      { id: "e-1", name: "Ada" },
    ]);
    expect(query).toHaveBeenCalledWith(
      { __col: true, path: "worlds/w-1/entities" },
      { where: "folderId", op: "==", valor: "f-1" }
    );
  });

  it("listEntitiesInFolder sem mundo devolve [] sem tocar a rede", async () => {
    await expect(worldsRepo.listEntitiesInFolder(null, "f-1")).resolves.toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});

/* ── Conexões ────────────────────────────────────────────────────────────── */

describe("worldsRepo — conexões", () => {
  it("createConnection grava em `worlds/{id}/connections`", async () => {
    await worldsRepo.createConnection("w-1", { fromId: "e-1", toId: "e-2" });
    expect(addDoc.mock.calls[0][0]).toMatchObject({ path: "worlds/w-1/connections" });
  });

  it("deleteConnection apaga `worlds/{id}/connections/{connId}`", async () => {
    await worldsRepo.deleteConnection("w-1", "c-1");
    expect(deleteDoc).toHaveBeenCalledWith({ id: "c-1", path: "worlds/w-1/connections/c-1" });
  });

  it("listConnectionsByEndpoint busca por UM lado de cada vez", async () => {
    // São duas buscas separadas porque o Firestore não faz OR entre campos
    // diferentes. Quem cruza os dois lados e deduplica é o store.
    getDocs.mockResolvedValue(snapOf([docOf("c-1", { relation: "HABITA" })]));

    await expect(worldsRepo.listConnectionsByEndpoint("w-1", "fromId", "e-1")).resolves.toEqual([
      { id: "c-1", relation: "HABITA" },
    ]);
    expect(query).toHaveBeenCalledWith(
      { __col: true, path: "worlds/w-1/connections" },
      { where: "fromId", op: "==", valor: "e-1" }
    );

    await worldsRepo.listConnectionsByEndpoint("w-1", "toId", "e-1");
    expect(query).toHaveBeenLastCalledWith(
      { __col: true, path: "worlds/w-1/connections" },
      { where: "toId", op: "==", valor: "e-1" }
    );
  });

  it("listConnectionsBetween leva os dois `where` na MESMA query", async () => {
    await worldsRepo.listConnectionsBetween("w-1", "e-1", "e-2");

    expect(query).toHaveBeenCalledWith(
      { __col: true, path: "worlds/w-1/connections" },
      { where: "fromId", op: "==", valor: "e-1" },
      { where: "toId", op: "==", valor: "e-2" }
    );
  });

  it("listConnectionsBetween sem mundo devolve [] sem tocar a rede", async () => {
    await expect(worldsRepo.listConnectionsBetween(undefined, "a", "b")).resolves.toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});

/* ── Pastas ──────────────────────────────────────────────────────────────── */

describe("worldsRepo — pastas", () => {
  it("createFolder grava em `worlds/{id}/folders`", async () => {
    await worldsRepo.createFolder("w-1", { name: "Panteão" });
    expect(addDoc.mock.calls[0][0]).toMatchObject({ path: "worlds/w-1/folders" });
  });

  it("updateFolder escreve em `worlds/{id}/folders/{folderId}`", async () => {
    await worldsRepo.updateFolder("w-1", "f-1", { name: "Reinos" });
    expect(updateDoc).toHaveBeenCalledWith(
      { id: "f-1", path: "worlds/w-1/folders/f-1" }, { name: "Reinos" }
    );
  });

  it("getFolder devolve a pasta ou null, e nada sem id", async () => {
    getDoc.mockResolvedValue({ exists: () => true, id: "f-1", data: () => ({ parentId: "f-pai" }) });
    await expect(worldsRepo.getFolder("w-1", "f-1")).resolves.toEqual({ id: "f-1", parentId: "f-pai" });
    expect(getDoc).toHaveBeenCalledWith({ id: "f-1", path: "worlds/w-1/folders/f-1" });

    getDoc.mockResolvedValue({ exists: () => false, id: "f-9", data: () => ({}) });
    await expect(worldsRepo.getFolder("w-1", "f-9")).resolves.toBeNull();

    getDoc.mockClear();
    await expect(worldsRepo.getFolder("w-1", "")).resolves.toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("listChildFolders filtra por `parentId` em igualdade", async () => {
    await worldsRepo.listChildFolders("w-1", "f-1");
    expect(query).toHaveBeenCalledWith(
      { __col: true, path: "worlds/w-1/folders" },
      { where: "parentId", op: "==", valor: "f-1" }
    );
  });
});

/* ── Subcoleção genérica e id reservado ──────────────────────────────────── */

describe("worldsRepo.listSubcollection", () => {
  it("lê a subcoleção inteira, SEM query — é a varredura da exclusão em cascata", async () => {
    getDocs.mockResolvedValue(snapOf([docOf("e-1", {}), docOf("e-2", {})]));

    await expect(worldsRepo.listSubcollection("w-1", "entities")).resolves.toEqual([
      { id: "e-1" }, { id: "e-2" },
    ]);
    expect(getDocs).toHaveBeenCalledWith({ __col: true, path: "worlds/w-1/entities" });
    expect(query).not.toHaveBeenCalled();
  });

  it("aceita as três subcoleções pelo nome", async () => {
    await worldsRepo.listSubcollection("w-1", "connections");
    await worldsRepo.listSubcollection("w-1", "folders");

    expect(getDocs.mock.calls.map(([ref]) => ref.path)).toEqual([
      "worlds/w-1/connections", "worlds/w-1/folders",
    ]);
  });

  it("sem mundo devolve [] sem tocar a rede", async () => {
    await expect(worldsRepo.listSubcollection("", "entities")).resolves.toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});

describe("worldsRepo.newSubDocId", () => {
  it("reserva um id SEM escrever nada e devolve string", async () => {
    const a = worldsRepo.newSubDocId("w-1", "entities");
    const b = worldsRepo.newSubDocId("w-1", "entities");

    expect(typeof a).toBe("string");
    expect(a).not.toBe(b);
    // Reservar não é gravar: é o que permite às conexões do mundo demo já
    // nascerem apontando para as entidades, no MESMO lote.
    expect(addDoc).not.toHaveBeenCalled();
    expect(writeBatch).not.toHaveBeenCalled();
  });
});

/* ── Lote ────────────────────────────────────────────────────────────────── */

describe("worldsRepo.commitBatch", () => {
  it("traduz cada operação para o caminho certo (mundo e subcoleções)", async () => {
    await worldsRepo.commitBatch("w-1", [
      { op: "set", path: ["entities", "e-1"], data: { name: "Ada", createdAt: SERVER_TIMESTAMP } },
      { op: "update", path: ["folders", "f-2"], data: { parentId: "f-pai" } },
      { op: "delete", path: ["connections", "c-1"] },
      { op: "delete", path: [] }, // o mundo em si
    ]);

    expect(lotes).toHaveLength(1);
    const [lote] = lotes;
    expect(lote.sets[0].ref.path).toBe("worlds/w-1/entities/e-1");
    expect(lote.sets[0].data).toEqual({ name: "Ada", createdAt: "<serverTimestamp>" });
    expect(lote.updates[0].ref.path).toBe("worlds/w-1/folders/f-2");
    expect(lote.deletes.map((r) => r.path)).toEqual([
      "worlds/w-1/connections/c-1", "worlds/w-1",
    ]);
    expect(lote.commitado).toBe(true);
  });

  it("preserva a ORDEM das operações dentro do lote", async () => {
    // O que precisa acontecer por último (apagar a pasta depois de realocar o
    // que estava dentro) só funciona porque a ordem é respeitada.
    await worldsRepo.commitBatch("w-1", [
      { op: "update", path: ["entities", "e-1"], data: { folderId: null } },
      { op: "delete", path: ["folders", "f-1"] },
    ]);

    expect(lotes[0].seq).toEqual([
      ["update", "worlds/w-1/entities/e-1"],
      ["delete", "worlds/w-1/folders/f-1"],
    ]);
  });

  it("respeita o teto de 500 operações por lote", async () => {
    const ops = Array.from({ length: BATCH_LIMIT + 1 }, (_, i) => ({
      op: "delete", path: ["entities", `e-${i}`],
    }));

    await worldsRepo.commitBatch("w-1", ops);

    expect(BATCH_LIMIT).toBe(500);
    expect(lotes).toHaveLength(2);
    expect(lotes[0].deletes).toHaveLength(BATCH_LIMIT);
    expect(lotes[1].deletes).toHaveLength(1);
    expect(lotes.every((l) => l.commitado)).toBe(true);
  });

  it("lista vazia não abre lote nenhum", async () => {
    await worldsRepo.commitBatch("w-1", []);
    await worldsRepo.commitBatch("w-1");
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it("sem mundo, não escreve nada", async () => {
    await worldsRepo.commitBatch("", [{ op: "delete", path: ["entities", "e-1"] }]);
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it("@policy strict — lote negado REJEITA (é o que marca o mundo demo como parcial)", async () => {
    writeBatch.mockImplementation(() => ({
      set: jest.fn(), update: jest.fn(), delete: jest.fn(),
      commit: jest.fn(async () => {
        const e = new Error("Missing or insufficient permissions.");
        e.code = "permission-denied";
        throw e;
      }),
    }));

    await expect(
      worldsRepo.commitBatch("w-1", [{ op: "delete", path: [] }])
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});

/* ── Assinaturas ─────────────────────────────────────────────────────────── */

describe("worldsRepo.watchWorldsByOwner", () => {
  it("mantém a query do ÍNDICE COMPOSTO: where(ownerUid) + orderBy(updatedAt desc)", () => {
    onSnapshot.mockReturnValue(() => {});

    worldsRepo.watchWorldsByOwner("u1", () => {});

    // Mudar campo, operador ou ordenação aqui invalida o índice composto que já
    // está em produção — a query passa a ser RECUSADA pelo Firestore.
    expect(query).toHaveBeenCalledWith(
      { __col: true, path: "worlds" },
      { where: "ownerUid", op: "==", valor: "u1" },
      { orderBy: "updatedAt", direcao: "desc" }
    );
  });

  /* VIRADA DE CONTRATO — spec 0032 (AC-5).
     Este teste ASSEVERAVA que o documento saía do repo exatamente como veio do `data()`.
     Com uma data no acervo, isso significava o `Timestamp` do SDK atravessando a fronteira
     (dívida aceita no ADR-0010) — a `MasterSuite` só não quebrava porque `entityFilters
     .toMillis` e `ui/tokens.tempoRelativo` já aceitavam as duas formas. Agora o contrato é
     um só: `createdAt`/`updatedAt` saem em epoch-ms NUMÉRICO. O `pendenteNoServidor` e a
     estimativa de carimbo, que o teste sempre cobriu, continuam iguais. */
  it("entrega objetos planos com o id, a pendência de escrita e as datas em epoch-ms", () => {
    let entregue;
    const pendente = docOf(
      "w-novo",
      { name: "Coroa de Cinzas", createdAt: tsSdk(1000), updatedAt: tsSdk(2000) },
      { hasPendingWrites: true },
    );
    const confirmado = docOf("w-velho", { name: "Aurora", updatedAt: tsSdk(500) }, { hasPendingWrites: false });
    onSnapshot.mockImplementation((_q, next) => { next(snapOf([pendente, confirmado])); return () => {}; });

    worldsRepo.watchWorldsByOwner("u1", (lista) => { entregue = lista; });

    // `metadata` é do snapshot e não atravessa a fronteira: vira um booleano.
    // Sem ele, a casca escolheria sozinha um mundo que o servidor ainda não
    // conhece — e a leitura da subcoleção volta `permission-denied`.
    expect(entregue).toEqual([
      { id: "w-novo", name: "Coroa de Cinzas", createdAt: 1000, updatedAt: 2000, pendenteNoServidor: true },
      { id: "w-velho", name: "Aurora", updatedAt: 500, pendenteNoServidor: false },
    ]);
    // Nenhuma primitiva do SDK sobrevive à borda: nada de `.toMillis`/`.toDate` do outro lado.
    entregue.forEach((m) => expect(typeof m.updatedAt).toBe("number"));
    // `createdAt` NÃO foi inventado no mundo que não o tinha — campo ausente continua ausente.
    expect("createdAt" in entregue[1]).toBe(false);
    // `serverTimestamps:"estimate"` evita o `null` do carimbo ainda não confirmado,
    // que jogaria o mundo recém-criado para o fim de "recentes". A normalização roda DEPOIS
    // dele, sobre a estimativa — remover o `estimate` traria o `null` de volta.
    expect(pendente.data).toHaveBeenCalledWith({ serverTimestamps: "estimate" });
  });

  /* Escrita otimista: o `estimate` cobre o caso normal, mas um snapshot que ainda chegue com
     o carimbo vazio não pode virar `0` (1970, o fim da lista) nem `Date.now()` (data
     inventada). Sai `null`, e quem consome aplica o fallback que já aplicava. */
  it("carimbo ainda não resolvido sai como `null`, não como 0 nem como agora", () => {
    let entregue;
    onSnapshot.mockImplementation((_q, next) => {
      next(snapOf([docOf("w-1", { name: "Recém-criado", updatedAt: null })]));
      return () => {};
    });

    worldsRepo.watchWorldsByOwner("u1", (lista) => { entregue = lista; });
    expect(entregue).toEqual([{ id: "w-1", name: "Recém-criado", updatedAt: null, pendenteNoServidor: false }]);
  });

  it("mundo sem metadata não quebra a leitura", () => {
    let entregue;
    onSnapshot.mockImplementation((_q, next) => { next(snapOf([docOf("w-1", {})])); return () => {}; });

    worldsRepo.watchWorldsByOwner("u1", (lista) => { entregue = lista; });
    expect(entregue).toEqual([{ id: "w-1", pendenteNoServidor: false }]);
  });

  it("repassa o erro do listener para quem chamou", () => {
    const erro = new Error("permission-denied");
    onSnapshot.mockImplementation((_q, _next, onErro) => { onErro(erro); return () => {}; });
    const onError = jest.fn();

    worldsRepo.watchWorldsByOwner("u1", () => {}, onError);

    // O hook expõe isso no campo `error` e a Forja mostra na tela. Engolir aqui
    // deixaria o mestre olhando uma lista vazia sem explicação.
    expect(onError).toHaveBeenCalledWith(erro);
  });

  it("não quebra quando quem chamou não passou onError", () => {
    onSnapshot.mockImplementation((_q, _next, onErro) => { onErro(new Error("offline")); return () => {}; });
    expect(() => worldsRepo.watchWorldsByOwner("u1", () => {})).not.toThrow();
  });

  it("sem uid, devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = worldsRepo.watchWorldsByOwner(null, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow(); // idempotente
  });

  it("devolve o cancelamento do próprio listener", () => {
    const unsub = jest.fn();
    onSnapshot.mockReturnValue(unsub);

    worldsRepo.watchWorldsByOwner("u1", () => {})();
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});

describe("worldsRepo.watchSubcollection", () => {
  it("assina a subcoleção do mundo com a ordenação pedida", () => {
    onSnapshot.mockReturnValue(() => {});

    worldsRepo.watchSubcollection("w-1", "entities", { campo: "updatedAt", direcao: "desc" }, () => {});
    expect(query).toHaveBeenLastCalledWith(
      { __col: true, path: "worlds/w-1/entities" },
      { orderBy: "updatedAt", direcao: "desc" }
    );

    worldsRepo.watchSubcollection("w-1", "connections", { campo: "createdAt", direcao: "desc" }, () => {});
    expect(query).toHaveBeenLastCalledWith(
      { __col: true, path: "worlds/w-1/connections" },
      { orderBy: "createdAt", direcao: "desc" }
    );

    worldsRepo.watchSubcollection("w-1", "folders", { campo: "order", direcao: "asc" }, () => {});
    expect(query).toHaveBeenLastCalledWith(
      { __col: true, path: "worlds/w-1/folders" },
      { orderBy: "order", direcao: "asc" }
    );
  });

  /* VIRADA DE CONTRATO — spec 0032 (AC-5): o verbete saía cru, e a `MasterSuite` ordenava a
     wiki por `updatedAt` com um `Timestamp` do SDK na mão. Agora sai em epoch-ms — a ordenação
     de `entityFilters.sortEntities` compara número e o resultado na tela é o mesmo. */
  it("entrega objetos planos, sem `pendenteNoServidor` e com as datas em epoch-ms", () => {
    let entregue;
    const d = docOf("e-1", { name: "Ada", createdAt: tsSdk(10), updatedAt: tsSdk(20) });
    onSnapshot.mockImplementation((_q, next) => { next(snapOf([d])); return () => {}; });

    worldsRepo.watchSubcollection("w-1", "entities", { campo: "updatedAt", direcao: "desc" },
      (lista) => { entregue = lista; });

    expect(entregue).toEqual([{ id: "e-1", name: "Ada", createdAt: 10, updatedAt: 20 }]);
    expect(d.data).toHaveBeenCalledWith({ serverTimestamps: "estimate" });
  });

  it("repassa o erro do listener", () => {
    const erro = new Error("index-not-found");
    onSnapshot.mockImplementation((_q, _next, onErro) => { onErro(erro); return () => {}; });
    const onError = jest.fn();

    worldsRepo.watchSubcollection("w-1", "entities", { campo: "order", direcao: "asc" }, () => {}, onError);
    expect(onError).toHaveBeenCalledWith(erro);
  });

  it("sem mundo ativo, devolve unsubscribe inerte e não assina nada", () => {
    const unsub = worldsRepo.watchSubcollection(null, "entities", { campo: "order", direcao: "asc" }, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();
  });
});
