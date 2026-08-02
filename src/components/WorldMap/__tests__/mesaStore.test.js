/**
 * Contrato da PERSISTÊNCIA DA MESA (spec 0028 · F4 · gate de AC-1, AC-7, AC-10).
 *
 * O Firestore é 100% mockado: o que está sob teste é o CONTRATO do store — o que
 * ele grava, ONDE grava, e sobretudo **o que ele se recusa a gravar**. Segue o
 * padrão de `worldMapStore.test.js`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O TESTE MAIS IMPORTANTE DESTE ARQUIVO
 *
 * `publicarRevelacao` é o único caminho por onde dado do ateliê chega ao cliente
 * do jogador. Se `gmNotes`, `gmText`, `isSecret` ou `discoveryCheck` passarem por
 * ali, o AC-1 cai inteiro — e cai em silêncio, porque a tela continua bonita. Por
 * isso a varredura abaixo é RECURSIVA e olha chaves E valores de tudo que foi
 * gravado, em vez de conferir campo a campo o que o teste lembrou de conferir.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from "fs";
import path from "path";
import { renderHook } from "@testing-library/react";
import * as firestore from "firebase/firestore";
import {
  idDaInstancia, mestreDaInstancia, podeEscreverNaInstancia,
  levarParaMesa, publicarRevelacao, publicarProjecao, sincronizarMolde, moverGrupo, atualizarParty,
  consolidarNevoaDaMesa, rebaixarRevelacao, removerDaMesa,
  projecaoDoNo, projecaoDaTrilha, projecaoDoEvento, garantirSemSegredo, estadoMaior,
  useInstancias, useReveladoNaMesa, useParty, useFogDaMesa, useGmDaMesa,
  idReveladoDoNo, idReveladoDaTrilha, idReveladoDoEvento,
  CAMPOS_VENENOSOS, CAMPOS_DO_MOVIMENTO, ESTADOS_DO_NO, ESTADOS_DA_TRILHA,
  INSTANCIA_JA_EXISTE, SEPARADOR_DA_INSTANCIA, SEGREDO_NA_PROJECAO, BATCH_LIMIT,
} from "../mesaStore";
import { MAPA_PADRAO_ID, MAPA_PADRAO_LARGURA, MAPA_PADRAO_ALTURA } from "../model/mapaPadrao";
import {
  criarEstado, projecaoDoJogador, ESTADOS_NO, ESTADOS_TRILHA,
} from "../model/revelacao";
import { criarMascara, revelarTudo } from "../model/fogMask";

jest.mock("../../../firebase", () => ({
  db: { __db: true },
  auth: { currentUser: { uid: "mestre-1" } },
}));

jest.mock("firebase/firestore", () => {
  const state = {
    docs: new Map(),      // path → { exists, data }
    cols: new Map(),      // path → [ {id, data} ]
    batches: [], listeners: [], autoId: 0,
    setDocs: [], updateDocs: [], deleteDocs: [],
  };
  const fns = {
    collection: jest.fn(), doc: jest.fn(), query: jest.fn(), where: jest.fn(),
    onSnapshot: jest.fn(), getDocs: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(),
    updateDoc: jest.fn(), deleteDoc: jest.fn(), addDoc: jest.fn(),
    orderBy: jest.fn(), serverTimestamp: jest.fn(), writeBatch: jest.fn(), increment: jest.fn(),
  };
  const install = () => {
    state.docs.clear();
    state.cols.clear();
    state.batches.length = 0;
    state.listeners.length = 0;
    state.setDocs.length = 0;
    state.updateDocs.length = 0;
    state.deleteDocs.length = 0;
    state.autoId = 0;

    fns.collection.mockImplementation((_db, ...p) => ({ __type: "collection", path: p.join("/") }));
    fns.doc.mockImplementation((first, ...rest) => {
      if (first && first.__type === "collection") {
        state.autoId += 1;
        return { __type: "doc", id: `auto-${state.autoId}`, path: `${first.path}/auto-${state.autoId}` };
      }
      return { __type: "doc", id: rest[rest.length - 1], path: rest.join("/") };
    });
    fns.query.mockImplementation((ref, ...clauses) => ({ __type: "query", ref, clauses, path: ref?.path }));
    fns.where.mockImplementation((campo, op, valor) => ({ __type: "where", campo, op, valor }));
    fns.orderBy.mockImplementation((field, dir = "asc") => ({ __type: "orderBy", field, dir }));
    fns.onSnapshot.mockImplementation((alvo, next, error) => {
      const unsub = jest.fn();
      state.listeners.push({ alvo, next, error, unsub });
      return unsub;
    });
    fns.getDoc.mockImplementation(async (ref) => {
      const achado = state.docs.get(ref.path);
      return {
        exists: () => !!achado,
        id: ref.id,
        data: () => (achado ? achado : {}),
      };
    });
    fns.getDocs.mockImplementation(async (alvo) => {
      const p = alvo?.__type === "query" ? alvo.path : alvo?.path;
      const docs = (state.cols.get(p) || []).map((d) => ({
        id: d.id,
        data: () => d.data,
        ref: { __type: "doc", id: d.id, path: `${p}/${d.id}` },
      }));
      return { docs, empty: docs.length === 0, size: docs.length };
    });
    fns.setDoc.mockImplementation(async (ref, data, opts) => {
      state.setDocs.push({ ref, data, opts });
    });
    fns.updateDoc.mockImplementation(async (ref, data) => { state.updateDocs.push({ ref, data }); });
    fns.deleteDoc.mockImplementation(async (ref) => { state.deleteDocs.push({ ref }); });
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

/* ── Utilidades do teste ─────────────────────────────────────────────── */

const UID = "mestre-1";
const CID = "campanha-1";
const MAP = "molde-1";
const IID = `${UID}${SEPARADOR_DA_INSTANCIA}${MAP}`;
const BASE = `campaigns/${CID}/worldmaps/${IID}`;

const porDoc = (p, data) => state.docs.set(p, data);
const porCol = (p, docs) => state.cols.set(p, docs);

/** Tudo que foi gravado (set/update) em lote, achatado. */
const gravados = () => state.batches.flatMap((b) => [...b.sets, ...b.updates]);
const caminhosGravados = () => gravados().map((o) => o.ref.path);
const apagados = () => state.batches.flatMap((b) => b.deletes).map((r) => r.path);

const gravadoEm = (p) => gravados().find((o) => o.ref.path === p)?.data;

/**
 * Varredura recursiva: devolve TODAS as chaves e todos os valores de texto de
 * um objeto, em qualquer profundidade. É o que transforma "conferi os campos
 * que lembrei" em "conferi o payload inteiro".
 */
function varrer(valor, chaves = [], textos = []) {
  if (typeof valor === "string") { textos.push(valor); return { chaves, textos }; }
  if (Array.isArray(valor)) { valor.forEach((v) => varrer(v, chaves, textos)); return { chaves, textos }; }
  if (valor && typeof valor === "object") {
    Object.keys(valor).forEach((k) => { chaves.push(k); varrer(valor[k], chaves, textos); });
  }
  return { chaves, textos };
}

/* Um molde de mesa com TUDO que não pode vazar. Cada segredo tem uma frase
   inconfundível, para a varredura poder procurar pelo texto e não só pela chave. */
const NO_VISIVEL = {
  id: "n1", name: "Vila do Pouso", description: "Casario baixo à beira do rio.",
  type: "town", x: 100, y: 200, icon: "town", color: "#e0b34a",
  rumorLabel: "Dizem que há gente boa ali",
  gmNotes: "SEGREDO-DO-MESTRE-NO: o prefeito é o culto disfarçado.",
  linkedSceneId: "cena-42", revealRadius: 190, isFastTravel: true,
};
const NO_SECRETO = {
  id: "n2", name: "Cova do Dono", description: "Fenda que respira.",
  type: "secret", x: 900, y: 120, icon: null, color: "#8a7ad6",
  rumorLabel: "Uma fresta na pedra",
  gmNotes: "SEGREDO-DO-MESTRE-COVA: o Dono acorda no terceiro dia.",
};
const TRILHA_SECRETA = {
  id: "e1", fromNodeId: "n1", toNodeId: "n2", pathPoints: [{ x: 500, y: 160 }],
  travelHours: 6, isSecret: true, isOneWay: true, dangerLevel: 3,
  discoveryCheck: { pericia: "Investigação", cd: 20 },
  gmNotes: "SEGREDO-DO-MESTRE-TRILHA: a passagem some ao amanhecer.",
};
const EVENTO = {
  id: "ev1", title: "O sino toca sozinho", playerText: "Um sino soa ao longe, três vezes.",
  gmText: "SEGREDO-DO-MESTRE-EVENTO: é o culto chamando os seus.",
  trigger: "onArrive", triggerConfig: { nodeId: "n1" }, isRepeatable: false, reveals: ["n2"],
};

const MOLDE = {
  name: "Coroa de Cinzas", description: "Sertão alagado.",
  width: 2400, height: 1600, fogEnabled: true, startNodeId: "n1",
  backgroundRef: null, backgroundThumb: "data:image/jpeg;base64,mini",
};

function montarMolde({ mapa = MOLDE, nos = [NO_VISIVEL, NO_SECRETO], trilhas = [TRILHA_SECRETA] } = {}) {
  porDoc(`users/${UID}/worldmaps/${MAP}`, mapa);
  porCol(`users/${UID}/worldmaps/${MAP}/nodes`, nos.map((n) => ({ id: n.id, data: n })));
  porCol(`users/${UID}/worldmaps/${MAP}/edges`, trilhas.map((t) => ({ id: t.id, data: t })));
}

beforeEach(() => {
  firestore.__mock.install();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => { jest.restoreAllMocks(); });

/* ════════════════════════════════════════════════════════════════════
 *  O ID DA INSTÂNCIA — a denormalização que salva o lote
 * ══════════════════════════════════════════════════════════════════ */

describe("id da instância", () => {
  test("carrega o uid do mestre no prefixo, para as rules lerem sem get()", () => {
    expect(idDaInstancia(UID, MAP)).toBe(`${UID}${SEPARADOR_DA_INSTANCIA}${MAP}`);
    expect(mestreDaInstancia(idDaInstancia(UID, MAP))).toBe(UID);
    expect(podeEscreverNaInstancia(UID, IID)).toBe(true);
    expect(podeEscreverNaInstancia("jogador-9", IID)).toBe(false);
  });

  test("id fora do formato não autoriza ninguém", () => {
    expect(mestreDaInstancia("solto")).toBe("");
    expect(mestreDaInstancia("")).toBe("");
    expect(podeEscreverNaInstancia(UID, "solto")).toBe(false);
    expect(podeEscreverNaInstancia("", IID)).toBe(false);
  });

  test("é determinístico: o mesmo molde na mesma mesa é sempre a mesma instância", () => {
    expect(idDaInstancia(UID, MAP)).toBe(idDaInstancia(UID, MAP));
  });

  test("recusa em português sem uid ou sem mapa", () => {
    expect(() => idDaInstancia("", MAP)).toThrow(/autenticado/i);
    expect(() => idDaInstancia(UID, "")).toThrow(/qual mapa/i);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  AS PROJEÇÕES — a lista branca do AC-1
 * ══════════════════════════════════════════════════════════════════ */

describe("projeções públicas (AC-1)", () => {
  test("o nó revelado não leva nenhum campo de mestre", () => {
    const p = projecaoDoNo(NO_VISIVEL, "discovered");
    CAMPOS_VENENOSOS.forEach((campo) => expect(p).not.toHaveProperty(campo));
    expect(JSON.stringify(p)).not.toMatch(/SEGREDO-DO-MESTRE/);
    expect(p).toMatchObject({ kind: "node", nodeId: "n1", name: "Vila do Pouso", state: "discovered" });
  });

  test("nó `rumored` vai SEM nome e SEM descrição — só o rumor e onde ele fica", () => {
    const p = projecaoDoNo(NO_SECRETO, "rumored");
    expect(p).not.toHaveProperty("name");
    expect(p).not.toHaveProperty("description");
    expect(p).not.toHaveProperty("type");
    expect(p).not.toHaveProperty("icon");
    expect(p).not.toHaveProperty("color");
    expect(p).toEqual({
      kind: "node", nodeId: "n2", x: 900, y: 120,
      state: "rumored", rumorLabel: "Uma fresta na pedra",
    });
    expect(JSON.stringify(p)).not.toMatch(/Cova do Dono|Fenda que respira/);
  });

  test("a trilha revelada não leva `isSecret`, `discoveryCheck` nem `dangerLevel`", () => {
    const p = projecaoDaTrilha(TRILHA_SECRETA, "revealed");
    CAMPOS_VENENOSOS.forEach((campo) => expect(p).not.toHaveProperty(campo));
    expect(p).toEqual({
      kind: "edge", edgeId: "e1", fromNodeId: "n1", toNodeId: "n2",
      pathPoints: [{ x: 500, y: 160 }], travelHours: 6, isOneWay: true, state: "revealed",
    });
    /* `isOneWay` sai de propósito: o AC-8 precisa dele para decidir o que é
       clicável, e a trilha já está revelada. Mesma decisão de `revelacao.js`. */
    expect(CAMPOS_VENENOSOS).not.toContain("isOneWay");
  });

  test("o evento publicado leva só o texto do jogador", () => {
    const p = projecaoDoEvento(EVENTO);
    expect(p).toEqual({
      kind: "event", eventId: "ev1", title: "O sino toca sozinho",
      playerText: "Um sino soa ao longe, três vezes.", state: "revealed",
    });
    expect(JSON.stringify(p)).not.toMatch(/SEGREDO-DO-MESTRE/);
  });

  test("`garantirSemSegredo` é o alarme: recusa em PT-BR se um campo de mestre passar", () => {
    expect(() => garantirSemSegredo({ name: "x", gmNotes: "vaza" })).toThrow(SEGREDO_NA_PROJECAO);
    expect(() => garantirSemSegredo({ name: "x", gmText: "vaza" })).toThrow(SEGREDO_NA_PROJECAO);
    expect(() => garantirSemSegredo({ name: "x", isSecret: false })).toThrow(SEGREDO_NA_PROJECAO);
    expect(garantirSemSegredo({ name: "x" })).toEqual({ name: "x" });
  });

  test("recusa nó sem id ou sem coordenadas, em português", () => {
    expect(() => projecaoDoNo({ x: 1, y: 2 })).toThrow(/sem id/i);
    expect(() => projecaoDoNo({ id: "n", x: "a", y: 2 })).toThrow(/coordenadas/i);
  });

  test("`estadoMaior` nunca deixa o estado regredir", () => {
    expect(estadoMaior(ESTADOS_DO_NO, "discovered", "visited")).toBe("visited");
    expect(estadoMaior(ESTADOS_DO_NO, "visited", "rumored")).toBe("visited");
    expect(estadoMaior(ESTADOS_DA_TRILHA, "revealed", "traveled")).toBe("traveled");
    expect(estadoMaior(ESTADOS_DO_NO, "inexistente", undefined)).toBe("rumored");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  LEVAR PARA A MESA  (AC-7)
 * ══════════════════════════════════════════════════════════════════ */

describe("levarParaMesa (AC-7)", () => {
  test("nasce com o grupo no nó inicial, névoa fechada e ZERO revelações", async () => {
    montarMolde();
    const r = await levarParaMesa(UID, MAP, CID);

    expect(r.instanceId).toBe(IID);
    expect(r.startNodeId).toBe("n1");

    /* Nenhum documento em `revealed/` — o segredo não é filtrado, ele não existe. */
    expect(caminhosGravados().some((p) => p.includes("/revealed/"))).toBe(false);

    const instancia = gravadoEm(BASE);
    expect(instancia).toMatchObject({
      name: "Coroa de Cinzas", width: 2400, height: 1600, fogEnabled: true,
      sourceUid: UID, sourceMapId: MAP, masterUid: UID, startNodeId: "n1",
    });

    const party = gravadoEm(`${BASE}/party/estado`);
    expect(party).toMatchObject({ currentNodeId: "n1", x: 100, y: 200, speedModifier: 1 });

    const gm = gravadoEm(`${BASE}/gm/estado`);
    expect(gm).toMatchObject({ triggeredEventIds: [], pendingEncounter: null, gmScratch: "" });

    const fog = gravadoEm(`${BASE}/fog/estado`);
    expect(fog.largura).toBe(2400);
    expect(typeof fog.data).toBe("string");
  });

  test("nada do molde vaza para a instância — nem nome de nó, nem nota de mestre", async () => {
    montarMolde();
    await levarParaMesa(UID, MAP, CID);

    /* A varredura é do que o JOGADOR alcança. `gm/estado` fica de fora de
       propósito: é o painel do mestre, ele nasce com `gmScratch` por design §3,
       e as rules negam a leitura ao jogador (há teste próprio para isso). */
    const doJogador = gravados().filter((o) => !o.ref.path.includes("/gm/"));
    const { chaves, textos } = varrer(doJogador.map((o) => o.data));
    CAMPOS_VENENOSOS.forEach((campo) => expect(chaves).not.toContain(campo));
    textos.forEach((t) => expect(t).not.toMatch(/SEGREDO-DO-MESTRE/));
    /* Nem os nomes dos lugares: a instância não é uma cópia do grafo. */
    textos.forEach((t) => expect(t).not.toMatch(/Cova do Dono/));
  });

  test("a névoa nasce FECHADA — a máscara serializada é a de tudo coberto", async () => {
    montarMolde();
    await levarParaMesa(UID, MAP, CID);
    const { serializar } = require("../model/fogMask");
    const fechada = serializar(criarMascara(2400, 1600));
    expect(gravadoEm(`${BASE}/fog/estado`).data).toBe(fechada);
    /* E não é a de tudo aberto — o teste acima passaria por engano se a
       serialização fosse constante. */
    expect(gravadoEm(`${BASE}/fog/estado`).data).not.toBe(serializar(revelarTudo(criarMascara(2400, 1600))));
  });

  test("levar o MESMO molde à MESMA mesa duas vezes é recusado em português", async () => {
    montarMolde();
    porDoc(BASE, { name: "já está lá" });
    await expect(levarParaMesa(UID, MAP, CID)).rejects.toThrow(INSTANCIA_JA_EXISTE);
    expect(state.batches).toHaveLength(0);
  });

  test("`recomecar` limpa o progresso antigo antes de recriar", async () => {
    montarMolde();
    porDoc(BASE, { name: "já está lá" });
    porCol(`${BASE}/revealed`, [{ id: "no_n1", data: { kind: "node", nodeId: "n1", state: "visited" } }]);

    await levarParaMesa(UID, MAP, CID, { recomecar: true });
    expect(apagados()).toContain(`${BASE}/revealed/no_n1`);
    expect(apagados()).toContain(`${BASE}/party/estado`);
    expect(gravadoEm(BASE)).toBeTruthy();
  });

  test("o mesmo molde em DUAS mesas gera dois caminhos independentes", async () => {
    montarMolde();
    await levarParaMesa(UID, MAP, CID);
    await levarParaMesa(UID, MAP, "campanha-2");
    const paths = caminhosGravados();
    expect(paths).toContain(`campaigns/${CID}/worldmaps/${IID}`);
    expect(paths).toContain(`campaigns/campanha-2/worldmaps/${IID}`);
  });

  test("o MAPA PADRÃO vai para a mesa mesmo não existindo no Firestore (AC-13)", async () => {
    const r = await levarParaMesa(UID, MAPA_PADRAO_ID, CID);
    const base = `campaigns/${CID}/worldmaps/${UID}${SEPARADOR_DA_INSTANCIA}${MAPA_PADRAO_ID}`;
    expect(r.instanceId).toBe(`${UID}${SEPARADOR_DA_INSTANCIA}${MAPA_PADRAO_ID}`);
    expect(r.nos).toBeGreaterThanOrEqual(8);
    const instancia = gravadoEm(base);
    expect(instancia.width).toBe(MAPA_PADRAO_LARGURA);
    expect(instancia.height).toBe(MAPA_PADRAO_ALTURA);
    expect(instancia.ilustracao).toBe("CartografiaPadrao");
    expect(gravadoEm(`${base}/party/estado`).currentNodeId).toBeTruthy();
    /* Nem o padrão leva segredo: ele tem `gmNotes` em todos os nós. */
    const { textos } = varrer(gravados().map((o) => o.data));
    expect(textos.join(" ")).not.toMatch(/Dono do Escuro/);
  });

  test("molde inexistente recusa com frase de gente, sem gravar nada", async () => {
    await expect(levarParaMesa(UID, "sumiu", CID)).rejects.toThrow(/não existe mais no seu ateliê/i);
    expect(state.batches).toHaveLength(0);
  });

  test("exige uid, mapa e campanha", async () => {
    await expect(levarParaMesa("", MAP, CID)).rejects.toThrow(/autenticado/i);
    await expect(levarParaMesa(UID, MAP, "")).rejects.toThrow(/campanha/i);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  PUBLICAR A REVELAÇÃO — o coração do AC-1
 * ══════════════════════════════════════════════════════════════════ */

describe("publicarRevelacao (AC-1 + AC-6)", () => {
  test("grava em revealed/ e NUNCA leva gmNotes, gmText, isSecret ou discoveryCheck", async () => {
    await publicarRevelacao(CID, IID, {
      nos: [{ ...NO_VISIVEL, state: "visited" }],
      trilhas: [{ ...TRILHA_SECRETA, state: "revealed" }],
      eventos: [EVENTO],
    });

    const escritos = gravados();
    expect(escritos).toHaveLength(3);

    const { chaves, textos } = varrer(escritos.map((o) => o.data));
    CAMPOS_VENENOSOS.forEach((campo) => expect(chaves).not.toContain(campo));
    textos.forEach((t) => expect(t).not.toMatch(/SEGREDO-DO-MESTRE/));
    /* Nem a perícia do teste de descoberta, que entregaria a existência da trilha. */
    expect(JSON.stringify(escritos)).not.toMatch(/Investigação/);

    expect(caminhosGravados().sort()).toEqual([
      `${BASE}/revealed/${idReveladoDaTrilha("e1")}`,
      `${BASE}/revealed/${idReveladoDoEvento("ev1")}`,
      `${BASE}/revealed/${idReveladoDoNo("n1")}`,
    ].sort());
  });

  test("nó revelado como `rumored` vai sem nome e sem descrição", async () => {
    await publicarRevelacao(CID, IID, { nos: [{ no: NO_SECRETO, state: "rumored" }] });
    const doc = gravadoEm(`${BASE}/revealed/${idReveladoDoNo("n2")}`);
    expect(doc.state).toBe("rumored");
    expect(doc).not.toHaveProperty("name");
    expect(doc).not.toHaveProperty("description");
    expect(doc.rumorLabel).toBe("Uma fresta na pedra");
    expect(JSON.stringify(doc)).not.toMatch(/Cova do Dono/);
  });

  test("NÃO regride: `visited` não volta a `discovered` numa republicação", async () => {
    porCol(`${BASE}/revealed`, [{
      id: idReveladoDoNo("n1"),
      data: { kind: "node", nodeId: "n1", name: "Vila do Pouso", state: "visited" },
    }]);
    await publicarRevelacao(CID, IID, { nos: [{ ...NO_VISIVEL, state: "discovered" }] });
    expect(gravadoEm(`${BASE}/revealed/${idReveladoDoNo("n1")}`).state).toBe("visited");
  });

  test("nó já `discovered` sobe para `visited` — acrescentar sempre pode", async () => {
    porCol(`${BASE}/revealed`, [{
      id: idReveladoDoNo("n1"),
      data: { kind: "node", nodeId: "n1", state: "discovered" },
    }]);
    await publicarRevelacao(CID, IID, { nos: [{ ...NO_VISIVEL, state: "visited" }] });
    expect(gravadoEm(`${BASE}/revealed/${idReveladoDoNo("n1")}`).state).toBe("visited");
  });

  test("revelação repetida idêntica não custa escrita", async () => {
    const igual = { ...projecaoDoNo(NO_VISIVEL, "discovered") };
    porCol(`${BASE}/revealed`, [{ id: idReveladoDoNo("n1"), data: igual }]);
    const r = await publicarRevelacao(CID, IID, { nos: [{ ...NO_VISIVEL, state: "discovered" }] });
    expect(r).toEqual({ gravados: 0, pulados: 1 });
    expect(state.batches).toHaveLength(0);
  });

  test("aceita `{ no, state }` e o objeto cru com `state` dentro", async () => {
    await publicarRevelacao(CID, IID, {
      nos: [{ no: NO_VISIVEL, state: "visited" }, { ...NO_SECRETO, state: "discovered" }],
    });
    expect(gravadoEm(`${BASE}/revealed/${idReveladoDoNo("n1")}`).state).toBe("visited");
    expect(gravadoEm(`${BASE}/revealed/${idReveladoDoNo("n2")}`).state).toBe("discovered");
  });

  test("`existentes` dispensa a leitura da coleção", async () => {
    await publicarRevelacao(
      CID, IID,
      { nos: [{ ...NO_VISIVEL, state: "discovered" }] },
      { existentes: [{ id: idReveladoDoNo("n1"), kind: "node", nodeId: "n1", state: "visited" }] },
    );
    expect(firestore.getDocs).not.toHaveBeenCalled();
    expect(gravadoEm(`${BASE}/revealed/${idReveladoDoNo("n1")}`).state).toBe("visited");
  });

  test("nada a revelar não abre lote nenhum", async () => {
    const r = await publicarRevelacao(CID, IID, {});
    expect(r).toEqual({ gravados: 0, pulados: 0 });
    expect(state.batches).toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  ENCAIXE COM `model/revelacao.js` — o domínio decide o QUE, o store o COMO
 * ══════════════════════════════════════════════════════════════════ */

describe("publicarProjecao × projecaoDoJogador", () => {
  test("a saída do domínio vira documento sem passar nenhum segredo", async () => {
    const grafo = { nos: [NO_VISIVEL, NO_SECRETO], trilhas: [TRILHA_SECRETA] };
    const estado = criarEstado({
      nos: { n1: "visited", n2: "rumored" },
      trilhas: { e1: "revealed" },
    });
    const projecao = projecaoDoJogador(estado, grafo);

    await publicarProjecao(CID, IID, projecao);

    const { chaves, textos } = varrer(gravados().map((o) => o.data));
    CAMPOS_VENENOSOS.forEach((campo) => expect(chaves).not.toContain(campo));
    textos.forEach((t) => expect(t).not.toMatch(/SEGREDO-DO-MESTRE/));

    /* O `estado` do domínio vira o `state` do design §3, sem perder o degrau. */
    expect(gravadoEm(`${BASE}/revealed/${idReveladoDoNo("n1")}`).state).toBe("visited");
    const rumorado = gravadoEm(`${BASE}/revealed/${idReveladoDoNo("n2")}`);
    expect(rumorado.state).toBe("rumored");
    expect(rumorado).not.toHaveProperty("name");
  });

  test("nó `hidden` do domínio nunca chega a virar documento", async () => {
    const grafo = { nos: [NO_VISIVEL, NO_SECRETO], trilhas: [TRILHA_SECRETA] };
    const projecao = projecaoDoJogador(criarEstado({ nos: { n1: "visited" } }), grafo);
    await publicarProjecao(CID, IID, projecao);
    expect(caminhosGravados()).toEqual([`${BASE}/revealed/${idReveladoDoNo("n1")}`]);
  });

  test("as duas escalas de estado são a MESMA lista — não há duas réguas", () => {
    expect(ESTADOS_DO_NO).toBe(ESTADOS_NO);
    expect(ESTADOS_DA_TRILHA).toBe(ESTADOS_TRILHA);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  O TETO DE 20 ACCESS CALLS DAS RULES
 *  --------------------------------------------------------------------
 *  Jest não avalia `firestore.rules`. O que dá para provar aqui é o que
 *  faz a regra barata ser aplicável: (1) toda escrita do lote cai dentro
 *  da subárvore da instância, cujo id nomeia o mestre; (2) o lote NÃO
 *  encosta no documento raiz (única regra que gasta `get()`); (3) o
 *  arquivo de rules realmente põe a condição sem `get()` na frente.
 * ══════════════════════════════════════════════════════════════════ */

describe("lote grande de revelação não estoura o teto de access calls", () => {
  const RULES = fs.readFileSync(path.join(__dirname, "../../../../firestore.rules"), "utf8");

  const muitosNos = (quantos) => Array.from({ length: quantos }, (_, i) => ({
    id: `n${i}`, name: `Lugar ${i}`, description: "", type: "poi",
    x: i * 3, y: i * 5, gmNotes: `SEGREDO-DO-MESTRE-${i}`, state: "discovered",
  }));

  test("300 revelações caem todas em revealed/, sob um id que nomeia o mestre", async () => {
    const r = await publicarRevelacao(CID, IID, { nos: muitosNos(300) });
    expect(r.gravados).toBe(300);

    const paths = caminhosGravados();
    expect(paths).toHaveLength(300);
    paths.forEach((p) => expect(p.startsWith(`${BASE}/revealed/`)).toBe(true));
    /* É o prefixo do id que autoriza a escrita sem `get()`. */
    expect(mestreDaInstancia(IID)).toBe(UID);
  });

  test("o lote NÃO toca o documento raiz da instância (a única regra com get())", async () => {
    await publicarRevelacao(CID, IID, { nos: muitosNos(60) });
    expect(caminhosGravados()).not.toContain(BASE);
  });

  test("respeita o limite de 500 operações por lote do Firestore", async () => {
    await publicarRevelacao(CID, IID, { nos: muitosNos(620) });
    expect(state.batches.length).toBe(2);
    state.batches.forEach((b) => expect(b.sets.length + b.updates.length).toBeLessThanOrEqual(BATCH_LIMIT));
    state.batches.forEach((b) => expect(b.committed).toBe(true));
  });

  test("as rules declaram o bloco da mesa e o gate barato ANTES do isMaster()", () => {
    /* O bloco existe (subcoleção não herda regra do pai — tem de ser explícito). */
    expect(RULES).toMatch(/match \/worldmaps\/\{instanceId\}/);
    expect(RULES).toMatch(/match \/revealed\/\{docId\}/);
    expect(RULES).toMatch(/match \/party\/\{docId\}/);
    expect(RULES).toMatch(/match \/fog\/\{docId\}/);
    expect(RULES).toMatch(/match \/gm\/\{docId\}/);

    /* O helper sem access call, lendo o próprio id do documento. */
    expect(RULES).toMatch(/function donoDaInstancia\(instanceId\)/);
    expect(RULES).toMatch(new RegExp(`instanceId\\.split\\('\\${SEPARADOR_DA_INSTANCIA}'\\)\\[0\\] == request\\.auth\\.uid`));

    /* Em TODA condição que combina os dois, o barato vem primeiro — é o `||`
       curto-circuitando que mantém o lote dentro do teto. */
    const combinadas = RULES.match(/donoDaInstancia\(instanceId\)[^;]*?isMaster\(campaignId\)/g) || [];
    expect(combinadas.length).toBeGreaterThanOrEqual(5);
    expect(RULES).not.toMatch(/isMaster\(campaignId\) \|\| donoDaInstancia/);
  });

  test("as rules mantêm o segredo: o jogador nem lê o documento do mestre", () => {
    const blocoGm = RULES.slice(RULES.indexOf("match /gm/{docId}"));
    const fim = blocoGm.indexOf("}");
    expect(blocoGm.slice(0, fim)).not.toMatch(/isMember/);

    /* E o molde continua trancado no ateliê — nada aqui pode ter afrouxado. */
    expect(RULES).toMatch(/match \/worldmaps\/\{mapId\} \{\s*\n\s*allow read, write: if request\.auth != null && request\.auth\.uid == userId;/);
  });

  test("o movimento do jogador nas rules é o mesmo conjunto de campos do store", () => {
    const linha = RULES.match(/onlyUpdatingFields\(\[([^\]]*)\]\)[^\n]*\n?/g)
      .find((l) => l.includes("currentNodeId"));
    CAMPOS_DO_MOVIMENTO.forEach((campo) => expect(linha).toContain(`'${campo}'`));
    /* E nada além deles — o jogador não mexe no relógio nem nos suprimentos. */
    const dentro = (linha.match(/'([a-zA-Z]+)'/g) || []).map((s) => s.replace(/'/g, ""));
    expect(dentro.sort()).toEqual([...CAMPOS_DO_MOVIMENTO].sort());
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  SINCRONIZAR — só acrescenta (AC-7)
 * ══════════════════════════════════════════════════════════════════ */

describe("sincronizarMolde (AC-7)", () => {
  test("traz o que mudou no molde sem mexer no estado da revelação", async () => {
    montarMolde({ nos: [{ ...NO_VISIVEL, name: "Vila Renomeada" }, NO_SECRETO] });
    porCol(`${BASE}/revealed`, [{
      id: idReveladoDoNo("n1"),
      data: { kind: "node", nodeId: "n1", name: "Vila do Pouso", state: "visited" },
    }]);

    const r = await sincronizarMolde(UID, MAP, CID);
    const doc = gravadoEm(`${BASE}/revealed/${idReveladoDoNo("n1")}`);
    expect(doc.name).toBe("Vila Renomeada");
    expect(doc.state).toBe("visited");     // NUNCA regride
    expect(r.atualizados).toBe(1);
    expect(JSON.stringify(doc)).not.toMatch(/SEGREDO-DO-MESTRE/);
  });

  test("não revela nada de novo: nó que o molde ganhou continua fora da mesa", async () => {
    montarMolde({ nos: [NO_VISIVEL, NO_SECRETO, { id: "n9", name: "Novo", x: 1, y: 1, type: "poi" }] });
    porCol(`${BASE}/revealed`, [{
      id: idReveladoDoNo("n1"), data: { kind: "node", nodeId: "n1", name: "Vila do Pouso", state: "visited" },
    }]);
    await sincronizarMolde(UID, MAP, CID);
    expect(caminhosGravados()).not.toContain(`${BASE}/revealed/${idReveladoDoNo("n9")}`);
  });

  test("APAGAR O MOLDE NÃO QUEBRA A MESA: o revelado é cópia, não referência", async () => {
    /* O molde ficou sem nós e sem trilhas (o mestre apagou tudo no ateliê). */
    montarMolde({ nos: [], trilhas: [] });
    porCol(`${BASE}/revealed`, [
      { id: idReveladoDoNo("n1"), data: { kind: "node", nodeId: "n1", name: "Vila do Pouso", state: "visited" } },
      { id: idReveladoDaTrilha("e1"), data: { kind: "edge", edgeId: "e1", fromNodeId: "n1", toNodeId: "n2", state: "traveled" } },
    ]);

    const r = await sincronizarMolde(UID, MAP, CID);
    expect(r.orfaos).toBe(2);
    expect(apagados()).toHaveLength(0);                        // nada é apagado
    expect(caminhosGravados()).not.toContain(`${BASE}/revealed/${idReveladoDoNo("n1")}`);
  });

  test("o cabeçalho da instância é atualizado, e ele não carrega grafo nenhum", async () => {
    montarMolde({ mapa: { ...MOLDE, name: "Outro nome", width: 1000, height: 800 } });
    const r = await sincronizarMolde(UID, MAP, CID);
    const cab = gravados().find((o) => o.ref.path === BASE)?.data;
    expect(cab).toMatchObject({ name: "Outro nome", width: 1000, height: 800 });
    expect(cab).not.toHaveProperty("nodes");
    expect(r.atualizados).toBe(0);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  GRUPO, NÉVOA, PAINEL DO MESTRE
 * ══════════════════════════════════════════════════════════════════ */

describe("grupo, névoa e painel", () => {
  test("moverGrupo escreve SÓ os campos que a regra do jogador permite", async () => {
    await moverGrupo(CID, IID, { nodeId: "n2", x: 900, y: 120, quem: "jogador-9" });
    const { ref, data } = state.updateDocs[0];
    expect(ref.path).toBe(`${BASE}/party/estado`);
    /* Subconjunto, não igualdade: desde a F7 `viagem` está na lista permitida
       mas só é escrito quando há percurso — mover sem viagem não pode apagar
       o percurso de quem estava viajando. O que a regra proíbe é escrever ALÉM
       da lista; escrever menos é sempre válido. */
    expect(CAMPOS_DO_MOVIMENTO).toEqual(expect.arrayContaining(Object.keys(data)));
    expect(Object.keys(data)).toContain("currentNodeId");
    expect(Object.keys(data)).not.toContain("viagem");
  });

  test("moverGrupo recusa destino sem coordenadas", async () => {
    await expect(moverGrupo(CID, IID, { nodeId: "n2" })).rejects.toThrow(/coordenadas/i);
    expect(state.updateDocs).toHaveLength(0);
  });

  test("atualizarParty ignora campo que não é do grupo", async () => {
    await atualizarParty(CID, IID, { supplies: 4, gmScratch: "não é aqui" });
    expect(state.updateDocs[0].data).toEqual({ supplies: 4, updatedAt: "__ts__" });
  });

  test("consolidar grava no caminho da campanha e recusa o que não cabe", async () => {
    /* Desde a F7 não há mais um gravador cru da máscara: a única porta para o
       bitmap inteiro é a CONSOLIDAÇÃO (AC-10). O gate fino dela — inclusive o
       apagamento dos deltas — está em `f7-mesa-store.test.js`. */
    const m = criarMascara(400, 400);
    const r = await consolidarNevoaDaMesa(CID, IID, m);
    expect(state.batches.at(-1).sets[0].ref.path).toBe(`${BASE}/fog/estado`);
    expect(r.bytes).toBeGreaterThan(0);

    await expect(consolidarNevoaDaMesa(CID, IID, m, { teto: 4 })).rejects.toThrow();
    await expect(consolidarNevoaDaMesa(CID, IID, null)).rejects.toThrow(/névoa/i);
  });

  test("rebaixar sem estado remove o documento — é o único caminho que regride", async () => {
    await rebaixarRevelacao(CID, IID, idReveladoDoNo("n1"));
    expect(state.deleteDocs[0].ref.path).toBe(`${BASE}/revealed/${idReveladoDoNo("n1")}`);

    await rebaixarRevelacao(CID, IID, idReveladoDoNo("n1"), "rumored");
    expect(state.updateDocs[0].data.state).toBe("rumored");
  });

  test("removerDaMesa apaga o progresso e a instância, nunca o molde", async () => {
    porCol(`${BASE}/revealed`, [{ id: "no_n1", data: {} }]);
    await removerDaMesa(CID, IID);
    const fora = apagados();
    expect(fora).toContain(`${BASE}/revealed/no_n1`);
    expect(fora).toContain(BASE);
    expect(fora.some((p) => p.startsWith("users/"))).toBe(false);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  HOOKS
 * ══════════════════════════════════════════════════════════════════ */

describe("hooks", () => {
  test("sem campanha ou sem instância não assinam nada", () => {
    renderHook(() => useInstancias(""));
    renderHook(() => useReveladoNaMesa(CID, ""));
    renderHook(() => useParty("", IID));
    renderHook(() => useFogDaMesa(CID, ""));
    expect(state.listeners).toHaveLength(0);
  });

  test("useReveladoNaMesa separa nós, trilhas e eventos", () => {
    const { result } = renderHook(() => useReveladoNaMesa(CID, IID));
    expect(state.listeners[0].alvo.path).toBe(`${BASE}/revealed`);
    const { act } = require("@testing-library/react");
    act(() => {
      state.listeners[0].next({
        docs: [
          { id: "no_n1", data: () => ({ kind: "node", nodeId: "n1" }) },
          { id: "tr_e1", data: () => ({ kind: "edge", edgeId: "e1" }) },
          { id: "ev_ev1", data: () => ({ kind: "event", eventId: "ev1" }) },
        ],
      });
    });
    expect(result.current.nos).toHaveLength(1);
    expect(result.current.trilhas).toHaveLength(1);
    expect(result.current.eventos).toHaveLength(1);
  });

  test("useGmDaMesa SÓ monta o listener quando quem olha é o mestre", () => {
    renderHook(() => useGmDaMesa(CID, IID, false));
    expect(state.listeners).toHaveLength(0);

    renderHook(() => useGmDaMesa(CID, IID, true));
    expect(state.listeners).toHaveLength(1);
    expect(state.listeners[0].alvo.path).toBe(`${BASE}/gm/estado`);
  });

  test("useInstancias devolve o erro cru para a tela traduzir", () => {
    const { result } = renderHook(() => useInstancias(CID));
    const { act } = require("@testing-library/react");
    const erro = Object.assign(new Error("negado"), { code: "permission-denied" });
    act(() => { state.listeners[0].error(erro); });
    expect(result.current.error).toBe(erro);
    expect(result.current.instancias).toEqual([]);
  });
});
