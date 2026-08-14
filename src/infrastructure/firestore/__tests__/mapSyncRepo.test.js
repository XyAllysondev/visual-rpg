import {
  onSnapshot, getDoc, getDocs, setDoc, deleteDoc, writeBatch,
  query, where, serverTimestamp,
} from "firebase/firestore";
import * as mapSyncRepo from "../mapSyncRepo";
import { SERVER_TIME } from "../mapSyncRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

const fs = () => require("firebase/firestore");

/** Documento cru do Firestore: `id` fora, dados atrás de `data()`. */
const docOf = (id, data) => ({ id, ref: `ref/${id}`, data: () => data });
/** Snapshot de um documento único. */
const snapOf = (data) => ({ exists: () => data != null, data: () => data });
/** Snapshot de coleção, com o metadado que a mesa usa para ignorar o próprio eco. */
const querySnapOf = (docs, hasPendingWrites = false) => ({ docs, metadata: { hasPendingWrites } });
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
  serverTimestamp.mockReturnValue("<serverTimestamp>");
  setDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  batch = {
    set: jest.fn(), update: jest.fn(), delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };
  writeBatch.mockReturnValue(batch);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

/* ── Assinaturas ────────────────────────────────────────────────────────── */

describe("mapSyncRepo.watchState", () => {
  /* VIRADA DE CONTRATO — spec 0032 (AC-5): o `state` saía do repo exatamente como veio do
     `data()` — e `saveState` carimba `updatedAt` com `serverTimestamp()`, então era o
     `Timestamp` do SDK atravessando a fronteira (dívida aceita no ADR-0010). Agora sai em
     epoch-ms NUMÉRICO. O `null` da mesa não migrada continua sendo `null`. */
  it("assina o ponteiro da cena ativa em `map/state`, com `updatedAt` em epoch-ms", () => {
    onSnapshot.mockImplementation((_ref, next) => {
      next(snapOf({ v: 2, updatedAt: tsSdk(2000) }));
      return () => {};
    });
    let recebido;

    mapSyncRepo.watchState("c1", (s) => { recebido = s; });

    expect(onSnapshot.mock.calls[0][0]).toEqual({ path: "campaigns/c1/map/state" });
    expect(recebido).toEqual({ v: 2, updatedAt: 2000 });
    expect(typeof recebido.updatedAt).toBe("number");
  });

  it("mesa ainda não migrada entrega `null`, não um objeto vazio", () => {
    // O `index.jsx` distingue os dois: `null` é o gatilho da migração lazy v1→v2.
    onSnapshot.mockImplementation((_ref, next) => { next(snapOf(null)); return () => {}; });
    let recebido = "intocado";

    mapSyncRepo.watchState("c1", (s) => { recebido = s; });

    expect(recebido).toBeNull();
  });

  it("sem campaignId, devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = mapSyncRepo.watchState(null, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow(); // idempotente
  });
});

describe("mapSyncRepo.watchScenes", () => {
  it("filtra `kind == 'scene'` na COLEÇÃO heterogênea `map`", () => {
    // `map/` guarda cenas, imagens em base64 (`img_*`), presenças (`live_*`) e o `state`.
    // Sem o filtro, o painel do mestre baixaria todas as imagens da campanha.
    onSnapshot.mockImplementation((_q, next) => { next(querySnapOf([])); return () => {}; });

    mapSyncRepo.watchScenes("c1", () => {});

    expect(query.mock.calls[0][0]).toEqual({ path: "campaigns/c1/map" });
    expect(where).toHaveBeenCalledWith("kind", "==", "scene");
  });

  /* VIRADA DE CONTRATO — spec 0032 (AC-5): o meta da cena saía cru, com o `updatedAt` que
     `saveSceneMeta` carimba em `serverTimestamp()`. Agora sai em epoch-ms. O `id` DEPOIS do
     spread e o `hasPendingWrites`, que este teste sempre cobriu, continuam iguais — é por eles
     que a mesa ignora o eco otimista da própria escrita. */
  it("junta o id do documento ao meta, entrega `hasPendingWrites` como booleano e `updatedAt` em epoch-ms", () => {
    // Só o booleano atravessa a fronteira — o `SnapshotMetadata` é primitiva do SDK.
    onSnapshot.mockImplementation((_q, next) => {
      next(querySnapOf([docOf("s1", { kind: "scene", name: "Cripta", updatedAt: tsSdk(2000) })], true));
      return () => {};
    });
    let metas, fromSelf;

    mapSyncRepo.watchScenes("c1", (m, f) => { metas = m; fromSelf = f; });

    expect(metas).toEqual([{ kind: "scene", name: "Cripta", updatedAt: 2000, id: "s1" }]);
    expect(fromSelf).toBe(true);
  });

  /* Cena antiga, gravada antes do carimbo: normalizar não pode INVENTAR `updatedAt: null` —
     o `elementDiff` e o autosave de meta comparam o objeto inteiro, e uma chave a mais faria
     a mesa achar que a cena mudou e republicar tudo. */
  it("cena sem carimbo não ganha um `updatedAt` que ela não tinha", () => {
    onSnapshot.mockImplementation((_q, next) => {
      next(querySnapOf([docOf("s1", { kind: "scene", name: "Cripta" })]));
      return () => {};
    });
    let metas;

    mapSyncRepo.watchScenes("c1", (m) => { metas = m; });

    expect(metas).toEqual([{ kind: "scene", name: "Cripta", id: "s1" }]);
    expect("updatedAt" in metas[0]).toBe(false);
  });

  it("sem campaignId, devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = mapSyncRepo.watchScenes(undefined, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();
  });
});

describe("mapSyncRepo.watchElements", () => {
  it("assina a subcoleção de elementos DA CENA", () => {
    onSnapshot.mockImplementation((_ref, next) => { next(querySnapOf([])); return () => {}; });

    mapSyncRepo.watchElements("c1", "s1", () => {});

    expect(onSnapshot.mock.calls[0][0]).toEqual({ path: "campaigns/c1/map/s1/elements" });
  });

  it("entrega o elemento cru, SEM colar o id do documento", () => {
    // O elemento já carrega o próprio `id` no corpo, e é por ele que o reducer casa o
    // estado local. Colar o id de fora era supérfluo e mudaria o objeto comparado no diff.
    onSnapshot.mockImplementation((_ref, next) => {
      next(querySnapOf([docOf("el_1", { id: "el_1", type: "token", x: 3 })], false));
      return () => {};
    });
    let els, fromSelf;

    mapSyncRepo.watchElements("c1", "s1", (e, f) => { els = e; fromSelf = f; });

    expect(els).toEqual([{ id: "el_1", type: "token", x: 3 }]);
    expect(fromSelf).toBe(false);
  });

  it("sem cena, devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = mapSyncRepo.watchElements("c1", null, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();
  });
});

describe("mapSyncRepo.watchLive", () => {
  it("filtra `kind == 'live'` na mesma coleção `map`", () => {
    onSnapshot.mockImplementation((_q, next) => {
      next(querySnapOf([docOf("live_u2", { kind: "live", uid: "u2", at: 10 })]));
      return () => {};
    });
    let presencas;

    mapSyncRepo.watchLive("c1", (p) => { presencas = p; });

    expect(query.mock.calls[0][0]).toEqual({ path: "campaigns/c1/map" });
    expect(where).toHaveBeenCalledWith("kind", "==", "live");
    expect(presencas).toEqual([{ kind: "live", uid: "u2", at: 10 }]);
  });

  it("falha na assinatura só loga com o prefixo do repo", () => {
    const erro = new Error("permission-denied");
    onSnapshot.mockImplementation((_q, _next, onError) => { onError(erro); return () => {}; });

    mapSyncRepo.watchLive("c1", () => {});

    expect(console.error).toHaveBeenCalledWith("[mapSyncRepo.watchLive] falhou:", erro);
  });

  it("sem campaignId, devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = mapSyncRepo.watchLive("", () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();
  });
});

/* ── Leituras pontuais ──────────────────────────────────────────────────── */

describe("mapSyncRepo — leituras da migração", () => {
  it("`readState` lê `map/state`; `readLegacyScene` lê o doc v1 `map/scene`", async () => {
    /* VIRADA DE CONTRATO — spec 0032 (AC-5): as duas leituras devolviam o documento cru. Se só
       o `watchState` normalizasse, a migração leria `Timestamp` e a assinatura leria número
       para o MESMO documento. */
    getDoc.mockResolvedValueOnce(snapOf({ v: 2, activeSceneId: "s1", updatedAt: tsSdk(2000) }));
    await expect(mapSyncRepo.readState("c1"))
      .resolves.toEqual({ v: 2, activeSceneId: "s1", updatedAt: 2000 });
    expect(getDoc).toHaveBeenCalledWith({ path: "campaigns/c1/map/state" });

    getDoc.mockResolvedValueOnce(snapOf({ scene: { elements: [] }, updatedAt: tsSdk(1000) }));
    await expect(mapSyncRepo.readLegacyScene("c1"))
      .resolves.toEqual({ scene: { elements: [] }, updatedAt: 1000 });
    expect(getDoc).toHaveBeenLastCalledWith({ path: "campaigns/c1/map/scene" });
  });

  it("@policy silent MUDO — doc ausente e falha de leitura devolvem `null` sem logar", async () => {
    // Mesa nova não tem nenhum dos dois documentos: logar aqui poluiria o console de toda
    // campanha recém-criada. É o `.catch(() => null)` herdado.
    getDoc.mockResolvedValue(snapOf(null));
    await expect(mapSyncRepo.readState("c1")).resolves.toBeNull();
    await expect(mapSyncRepo.readLegacyScene("c1")).resolves.toBeNull();

    getDoc.mockRejectedValue(new Error("unavailable"));
    await expect(mapSyncRepo.readState("c1")).resolves.toBeNull();
    await expect(mapSyncRepo.readLegacyScene("c1")).resolves.toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("mapSyncRepo.getImageData", () => {
  it("devolve o base64 guardado no campo `data` de `map/{imageId}`", async () => {
    getDoc.mockResolvedValue(snapOf({ kind: "image", data: "data:image/jpeg;base64,AAA" }));

    await expect(mapSyncRepo.getImageData("c1", "img_a_dead")).resolves
      .toBe("data:image/jpeg;base64,AAA");
    expect(getDoc).toHaveBeenCalledWith({ path: "campaigns/c1/map/img_a_dead" });
  });

  it("@policy silent — imagem ausente ou falha viram `null` (o elemento renderiza sem textura)", async () => {
    getDoc.mockResolvedValue(snapOf(null));
    await expect(mapSyncRepo.getImageData("c1", "img_x")).resolves.toBeNull();

    getDoc.mockRejectedValue(new Error("unavailable"));
    await expect(mapSyncRepo.getImageData("c1", "img_x")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith("[mapSyncRepo.getImageData] falhou:", expect.any(Error));
  });
});

describe("mapSyncRepo.imageExists", () => {
  it("responde a checagem de dedup do content-addressing", async () => {
    getDoc.mockResolvedValue(snapOf({ kind: "image", data: "x" }));
    await expect(mapSyncRepo.imageExists("c1", "img_a_dead")).resolves.toBe(true);

    getDoc.mockResolvedValue(snapOf(null));
    await expect(mapSyncRepo.imageExists("c1", "img_a_dead")).resolves.toBe(false);
  });

  it("@policy silent MUDO — falhar a checagem vira 'não existe', sem log", async () => {
    // O pior caso é reescrever o MESMO conteúdo no MESMO id (o id é o hash) — idempotente.
    getDoc.mockRejectedValue(new Error("unavailable"));
    await expect(mapSyncRepo.imageExists("c1", "img_a_dead")).resolves.toBe(false);
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("mapSyncRepo.getCampaignDoc", () => {
  it("lê o doc raiz da campanha (origem da lista de membros)", async () => {
    getDoc.mockResolvedValue(snapOf({ members: ["u1"], memberNames: { u1: "Ana" } }));

    await expect(mapSyncRepo.getCampaignDoc("c1")).resolves
      .toEqual({ members: ["u1"], memberNames: { u1: "Ana" } });
    expect(getDoc).toHaveBeenCalledWith({ path: "campaigns/c1" });
  });

  it("@policy silent — falha devolve `null` e loga", async () => {
    getDoc.mockRejectedValue(new Error("denied"));
    await expect(mapSyncRepo.getCampaignDoc("c1")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith("[mapSyncRepo.getCampaignDoc] falhou:", expect.any(Error));
  });
});

describe("mapSyncRepo.listElementIds", () => {
  it("devolve só os IDS — `DocumentReference` não atravessa a fronteira", async () => {
    getDocs.mockResolvedValue({ docs: [docOf("el_1", {}), docOf("el_2", {})] });

    await expect(mapSyncRepo.listElementIds("c1", "s1")).resolves.toEqual(["el_1", "el_2"]);
    expect(getDocs).toHaveBeenCalledWith({ path: "campaigns/c1/map/s1/elements" });
  });

  it("@policy strict — erro REJEITA em vez de virar 'cena vazia'", async () => {
    // Se virasse lista vazia, o `deleteScene` apagaria a cena achando que não havia
    // elementos — e os elementos ficariam órfãos, invisíveis e cobrando armazenamento.
    getDocs.mockRejectedValue(new Error("unavailable"));
    await expect(mapSyncRepo.listElementIds("c1", "s1")).rejects.toThrow("unavailable");
  });
});

/* ── Escritas ───────────────────────────────────────────────────────────── */

describe("mapSyncRepo.saveImage", () => {
  it("grava a imagem com `kind: 'image'` e horário do servidor, e confirma com `true`", async () => {
    // O `kind` é o que separa a imagem da cena na mesma coleção `map` — sem ele, a
    // assinatura de cenas do mestre baixaria o base64 inteiro.
    await expect(mapSyncRepo.saveImage("c1", "img_a_dead", "data:img")).resolves.toBe(true);

    expect(setDoc).toHaveBeenCalledWith(
      { path: "campaigns/c1/map/img_a_dead" },
      { kind: "image", data: "data:img", updatedAt: "<serverTimestamp>" }
    );
  });

  it("@policy silent — falha devolve `false` e loga (o módulo traduz para `null`)", async () => {
    setDoc.mockRejectedValue(new Error("invalid-argument"));
    await expect(mapSyncRepo.saveImage("c1", "img_1", "data:img")).resolves.toBe(false);
    expect(console.error).toHaveBeenCalledWith("[mapSyncRepo.saveImage] falhou:", expect.any(Error));
  });
});

describe("mapSyncRepo.saveSceneMeta", () => {
  it("grava a meta sob o id da cena, marcada como `kind: 'scene'` e assinada por quem editou", async () => {
    await mapSyncRepo.saveSceneMeta("c1", "s1", { name: "Cripta", grid: { size: 70 } }, "u1");

    expect(setDoc).toHaveBeenCalledWith(
      { path: "campaigns/c1/map/s1" },
      {
        kind: "scene", name: "Cripta", grid: { size: 70 },
        updatedAt: "<serverTimestamp>", updatedBy: "u1",
      }
    );
  });

  /* VIRADA DA ONDA 3 (spec 0032 Q4/AC-4). Até a onda 2 este teste provava o contrário:
     `@policy silent`, resolvia `undefined` e só logava. Era metade do bug — o autosave
     avançava `lastMetaRef` sobre uma escrita que não aconteceu, e `createScene` devolvia o
     id de uma cena inexistente. Agora REJEITA e quem chama decide. */
  it("@policy strict — meta que não grava REJEITA (antes era engolida)", async () => {
    setDoc.mockRejectedValue(new Error("denied"));
    await expect(mapSyncRepo.saveSceneMeta("c1", "s1", {}, "u1")).rejects.toThrow("denied");
  });
});

describe("mapSyncRepo.saveState", () => {
  it("carimba o horário do servidor no ponteiro da cena ativa", async () => {
    await mapSyncRepo.saveState("c1", { v: 2, activeSceneId: "s2", updatedBy: "u1" });

    expect(setDoc).toHaveBeenCalledWith(
      { path: "campaigns/c1/map/state" },
      { v: 2, activeSceneId: "s2", updatedBy: "u1", updatedAt: "<serverTimestamp>" }
    );
  });

  it("@policy silent — trocar de cena e falhar não derruba a mesa", async () => {
    setDoc.mockRejectedValue(new Error("denied"));
    await expect(mapSyncRepo.saveState("c1", { v: 2 })).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[mapSyncRepo.saveState] falhou:", expect.any(Error));
  });
});

describe("mapSyncRepo.updateElementPos", () => {
  it("escreve com merge — é o `affectedKeys` que as rules autorizam ao jogador", async () => {
    // Sem `{ merge: true }` o `setDoc` mandaria o documento inteiro e as rules v2 NEGARIAM
    // a escrita do jogador no modo 'owner'.
    await mapSyncRepo.updateElementPos("c1", "s1", "el_1", { x: 10, y: 20 });

    expect(setDoc).toHaveBeenCalledWith(
      { path: "campaigns/c1/map/s1/elements/el_1" },
      { x: 10, y: 20 },
      { merge: true }
    );
  });

  it("@policy silent — negação das rules não vira erro na tela", async () => {
    // É o caso comum: o jogador arrastou o que não é dele. A UI já devolve o elemento à
    // posição do snapshot.
    setDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(mapSyncRepo.updateElementPos("c1", "s1", "el_1", { x: 1, y: 2 }))
      .resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[mapSyncRepo.updateElementPos] falhou:", expect.any(Error)
    );
  });
});

/* ── Canal ao vivo ──────────────────────────────────────────────────────── */

describe("mapSyncRepo — presença ao vivo", () => {
  it("o uid vai NO ID do documento, no literal `live_{uid}`", () => {
    // Isto é o que permite às `firestore.rules` autorizarem por split de string, sem
    // `get()`. O teto de 20 access calls por lote foi o bug que esvaziou o mundo demo da
    // Forja (spec 0028 F4) — mudar este caminho quebra as rules em produção.
    mapSyncRepo.setLive("c1", "u2", { kind: "live", uid: "u2", at: 123 });

    expect(setDoc).toHaveBeenCalledWith(
      { path: "campaigns/c1/map/live_u2" },
      { kind: "live", uid: "u2", at: 123 }
    );
  });

  it("a presença NÃO leva horário do servidor — o `at` do cliente é que decide o frescor", async () => {
    // `isFresh` compara `at` com o relógio de quem RECEBE; um `serverTimestamp` só chegaria
    // depois do round-trip e já nasceria velho.
    await mapSyncRepo.setLive("c1", "u2", { kind: "live", uid: "u2", at: 123 });
    expect(serverTimestamp).not.toHaveBeenCalled();
  });

  it("@policy silent — presença que não sobe só loga; a próxima janela do throttle tenta de novo", async () => {
    setDoc.mockRejectedValue(new Error("unavailable"));
    await expect(mapSyncRepo.setLive("c1", "u2", {})).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[mapSyncRepo.setLive] falhou:", expect.any(Error));
  });

  it("`clearLive` apaga o mesmo documento `live_{uid}`", async () => {
    await mapSyncRepo.clearLive("c1", "u2");
    expect(deleteDoc).toHaveBeenCalledWith({ path: "campaigns/c1/map/live_u2" });
  });

  it("@policy silent MUDO — sair da mesa sem permissão não loga nada", async () => {
    // Roda na desmontagem (logout, aba fechada), quando a sessão pode já ter perdido a
    // permissão. Logar encheria o console em toda saída normal — e a presença expira
    // sozinha pelo `STALE_MS`.
    deleteDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(mapSyncRepo.clearLive("c1", "u2")).resolves.toBeUndefined();
    expect(console.error).not.toHaveBeenCalled();
  });
});

/* ── Lotes ──────────────────────────────────────────────────────────────── */

describe("mapSyncRepo.commitBatch", () => {
  it("traduz a lista de operações simples para o lote do SDK", () => {
    // A fronteira fala em `{op, path, data}`: `WriteBatch` e `DocumentReference` não
    // atravessam (AC-4).
    mapSyncRepo.commitBatch([
      { op: "set", path: ["campaigns", "c1", "map", "s1", "elements", "el_1"], data: { x: 1 } },
      { op: "update", path: ["campaigns", "c1", "map", "s1"], data: { name: "Cripta" } },
      { op: "delete", path: ["campaigns", "c1", "map", "s1", "elements", "el_2"] },
    ]);

    expect(batch.set).toHaveBeenCalledWith(
      { path: "campaigns/c1/map/s1/elements/el_1" }, { x: 1 }
    );
    expect(batch.update).toHaveBeenCalledWith({ path: "campaigns/c1/map/s1" }, { name: "Cripta" });
    expect(batch.delete).toHaveBeenCalledWith({ path: "campaigns/c1/map/s1/elements/el_2" });
    expect(writeBatch).toHaveBeenCalledTimes(1); // um lote, uma ida à rede
  });

  it("troca `SERVER_TIME` pelo horário do servidor sem que o chamador toque no SDK", async () => {
    await mapSyncRepo.commitBatch([
      { op: "set", path: ["campaigns", "c1", "map", "state"],
        data: { v: 2, updatedAt: SERVER_TIME, updatedBy: "u1" } },
    ]);

    expect(batch.set).toHaveBeenCalledWith(
      { path: "campaigns/c1/map/state" },
      { v: 2, updatedAt: "<serverTimestamp>", updatedBy: "u1" }
    );
  });

  it("não confunde texto do usuário com o marcador de horário", async () => {
    // `SERVER_TIME` é Symbol e não string justamente por isto: o conteúdo de uma nota é
    // texto livre, e nenhuma string é impossível de digitar.
    await mapSyncRepo.commitBatch([
      { op: "set", path: ["campaigns", "c1", "map", "s1", "elements", "el_1"],
        data: { text: "@serverTimestamp", updatedAt: SERVER_TIME } },
    ]);

    expect(batch.set.mock.calls[0][1]).toEqual({
      text: "@serverTimestamp", updatedAt: "<serverTimestamp>",
    });
  });

  it("lote vazio não abre batch nem vai à rede", async () => {
    await mapSyncRepo.commitBatch([]);
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it("@policy strict — falha do commit REJEITA", async () => {
    // É o que faz a migração v1→v2 parar antes de gravar o `state` (seu marcador de
    // conclusão) e rodar de novo na próxima abertura, em vez de deixar a mesa meio migrada.
    batch.commit.mockRejectedValue(new Error("aborted"));
    await expect(mapSyncRepo.commitBatch([
      { op: "delete", path: ["campaigns", "c1", "map", "s1"] },
    ])).rejects.toThrow("aborted");
  });

  it("operação desconhecida rejeita em vez de virar escrita silenciosa a menos", async () => {
    await expect(mapSyncRepo.commitBatch([
      { op: "increment", path: ["campaigns", "c1", "map", "s1"], data: {} },
    ])).rejects.toThrow(/increment/);
    expect(batch.commit).not.toHaveBeenCalled();
  });
});

/* VIRADA DA ONDA 3 (spec 0032 Q4/AC-4).
 *
 * Aqui existia `describe("mapSyncRepo.commitBatchSilent")`, com um teste que TRAVAVA a perda
 * de dados: `@policy silent — PERDA DE DADOS CONHECIDA: a falha é engolida, só loga`. Ele
 * estava certo para o que a onda 1.5 se propunha (preservar comportamento, AC-7), e errado
 * para o usuário: com o autosave avançando a baseline antes de publicar, uma escrita falha
 * sumia do diff para sempre.
 *
 * A onda 3 decidiu a política — o erro PROPAGA e a baseline só avança quando confirma — e a
 * função deixou de existir. O teste vira a asserção oposta: ela não pode voltar por engano. */
describe("mapSyncRepo.commitBatchSilent — removido na onda 3", () => {
  it("não existe mais: publicar elementos usa `commitBatch` (strict) e propaga a falha", () => {
    expect(mapSyncRepo.commitBatchSilent).toBeUndefined();
  });
});

/* ── Caminhos opacos ────────────────────────────────────────────────────── */

describe("mapSyncRepo — caminhos entregues a quem monta lotes", () => {
  it("`elementPath` e `mapDocPath` vêm de `paths.js`, não de literais na UI", () => {
    // É o que permite ao `campaignSync2` descrever um lote sem conhecer nome de coleção.
    expect(mapSyncRepo.elementPath("c1", "s1", "el_1"))
      .toEqual(["campaigns", "c1", "map", "s1", "elements", "el_1"]);
    expect(mapSyncRepo.mapDocPath("c1", "state")).toEqual(["campaigns", "c1", "map", "state"]);
    expect(mapSyncRepo.mapDocPath("c1", "s1")).toEqual(["campaigns", "c1", "map", "s1"]);
  });
});
