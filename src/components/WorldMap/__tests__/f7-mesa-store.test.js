/**
 * A PERSISTÊNCIA DO TEMPO REAL (spec 0028 · F7 · gate do AC-10).
 *
 * O que está sob teste é o CONTRATO da escrita: onde o delta de névoa é
 * gravado, o que a consolidação apaga, e — o mais importante — que a chegada
 * da viagem e a decisão do encontro acontecem **uma vez só**, mesmo com duas
 * telas fazendo a mesma coisa no mesmo instante.
 *
 * O Firestore é 100% mockado, no mesmo padrão de `mesaStore.test.js`. A
 * transação é o dublê que importa: ela lê o documento como ele ESTÁ, então
 * chamar duas vezes em sequência reproduz fielmente a corrida entre duas abas
 * (a segunda encontra o mundo que a primeira deixou).
 */
import { renderHook, act } from "@testing-library/react";
import {
  salvarDeltaDaNevoa, consolidarNevoaDaMesa, useFogDaMesa,
  moverGrupo, atualizarViagem, concluirViagem, projecaoDaViagem,
  reservarPendencia, resolverPendencia,
  CAMPOS_DO_MOVIMENTO, CAMPOS_DA_VIAGEM,
} from "../mesaStore";
import {
  criarMascara, revelarCirculo, serializar, contarReveladas, clonar,
} from "../model/fogMask";
import { diferenca } from "../model/fogMask";
import { ehDelta } from "../model/fogDelta";

jest.mock("../../../firebase", () => ({ db: { __db: true }, auth: { currentUser: { uid: "mestre-1" } } }));

jest.mock("firebase/firestore", () => {
  const state = { docs: new Map(), listeners: [], setDocs: [], updateDocs: [], batches: [] };
  const fns = {
    collection: jest.fn(), doc: jest.fn(), query: jest.fn(), where: jest.fn(),
    onSnapshot: jest.fn(), getDocs: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(),
    updateDoc: jest.fn(), deleteDoc: jest.fn(), serverTimestamp: jest.fn(),
    writeBatch: jest.fn(), runTransaction: jest.fn(),
  };
  const install = () => {
    state.docs.clear();
    state.listeners.length = 0;
    state.setDocs.length = 0;
    state.updateDocs.length = 0;
    state.batches.length = 0;

    fns.collection.mockImplementation((_db, ...p) => ({ __type: "collection", path: p.join("/") }));
    fns.doc.mockImplementation((first, ...rest) => (
      first && first.__type === "collection"
        ? { __type: "doc", id: "auto", path: `${first.path}/auto` }
        : { __type: "doc", id: rest[rest.length - 1], path: rest.join("/") }
    ));
    fns.onSnapshot.mockImplementation((alvo, next, error) => {
      const unsub = jest.fn();
      state.listeners.push({ alvo, next, error, unsub });
      return unsub;
    });
    fns.getDocs.mockImplementation(async () => ({ docs: [], empty: true, size: 0 }));
    fns.getDoc.mockImplementation(async (ref) => {
      const d = state.docs.get(ref.path);
      return { exists: () => !!d, id: ref.id, data: () => d || {} };
    });
    fns.setDoc.mockImplementation(async (ref, data, opts) => {
      state.setDocs.push({ ref, data, opts });
      state.docs.set(ref.path, opts?.merge ? { ...(state.docs.get(ref.path) || {}), ...data } : data);
    });
    fns.updateDoc.mockImplementation(async (ref, data) => {
      state.updateDocs.push({ ref, data });
      state.docs.set(ref.path, { ...(state.docs.get(ref.path) || {}), ...data });
    });
    fns.deleteDoc.mockImplementation(async (ref) => { state.docs.delete(ref.path); });
    fns.serverTimestamp.mockReturnValue("__ts__");
    fns.writeBatch.mockImplementation(() => {
      const batch = { sets: [], deletes: [], committed: false };
      batch.set = jest.fn((ref, data) => { batch.sets.push({ ref, data }); state.docs.set(ref.path, data); });
      batch.update = jest.fn();
      batch.delete = jest.fn((ref) => { batch.deletes.push(ref.path); state.docs.delete(ref.path); });
      batch.commit = jest.fn(async () => { batch.committed = true; });
      state.batches.push(batch);
      return batch;
    });
    /* A transação de verdade relê o documento e falha se ele mudou. Aqui a
       leitura é sempre a do estado ATUAL, que é o suficiente para reproduzir a
       corrida entre duas abas em sequência. */
    fns.runTransaction.mockImplementation(async (_db, fn) => fn({
      get: async (ref) => {
        const d = state.docs.get(ref.path);
        return { exists: () => !!d, id: ref.id, data: () => d || {} };
      },
      set: (ref, data, opts) => {
        state.setDocs.push({ ref, data, opts, tx: true });
        state.docs.set(ref.path, opts?.merge ? { ...(state.docs.get(ref.path) || {}), ...data } : data);
      },
      update: (ref, data) => {
        state.updateDocs.push({ ref, data, tx: true });
        state.docs.set(ref.path, { ...(state.docs.get(ref.path) || {}), ...data });
      },
      delete: (ref) => state.docs.delete(ref.path),
    }));
  };
  install();
  return { __esModule: true, ...fns, __state: state, __install: install };
});

const firestore = require("firebase/firestore");
const state = firestore.__state;

const CID = "camp-1";
const IID = "mestre-1~mapa-1";
const BASE = `campaigns/${CID}/worldmaps/${IID}`;

beforeEach(() => {
  jest.clearAllMocks();
  firestore.__install();
});

const mascaraCom = (x, y, r) => {
  const m = criarMascara(1200, 800);
  revelarCirculo(m, x, y, r);
  return m;
};

/* ════════════════════════════════════════════════════════════════════
 *  1 · O DELTA DE NÉVOA COMO DOCUMENTO
 * ══════════════════════════════════════════════════════════════════ */

describe("o delta na coleção da névoa", () => {
  test("mora em `fog/d_*` — a MESMA coleção da base, sem regra nova", async () => {
    const delta = mascaraCom(300, 300, 60);
    const r = await salvarDeltaDaNevoa(CID, IID, delta, { sessao: "aba1", n: 1 });

    const gravado = state.setDocs.at(-1);
    expect(gravado.ref.path).toBe(`${BASE}/fog/${r.id}`);
    expect(ehDelta(r.id)).toBe(true);
    expect(gravado.data.kind).toBe("delta");
    expect(gravado.data.data).toBe(serializar(delta));
    expect(r.bytes).toBeGreaterThan(0);
  });

  test("o delta é bitmap e mais nada — não conta O QUE foi revelado", async () => {
    await salvarDeltaDaNevoa(CID, IID, mascaraCom(300, 300, 60), { sessao: "aba1", n: 1 });
    const texto = JSON.stringify(state.setDocs.at(-1).data);
    ["name", "nodeId", "edgeId", "gmNotes", "gmText", "rumorLabel", "playerText"]
      .forEach((campo) => expect(texto).not.toContain(campo));
  });

  test("sem delta não se grava nada — a recusa é em português", async () => {
    await expect(salvarDeltaDaNevoa(CID, IID, null)).rejects.toThrow(/névoa/i);
    expect(state.setDocs).toHaveLength(0);
  });
});

describe("a consolidação", () => {
  test("grava a base e APAGA os deltas dela, no mesmo lote", async () => {
    const inteira = mascaraCom(400, 400, 200);
    const r = await consolidarNevoaDaMesa(CID, IID, inteira, {
      deltas: ["d_000001_aba1", "d_000002_aba1"],
    });

    const lote = state.batches.at(-1);
    expect(lote.committed).toBe(true);
    expect(lote.sets.at(0).ref.path).toBe(`${BASE}/fog/estado`);
    expect(lote.deletes).toEqual([`${BASE}/fog/d_000001_aba1`, `${BASE}/fog/d_000002_aba1`]);
    expect(r.apagados).toBe(2);
  });

  test("nunca apaga a base achando que ela é delta", async () => {
    await consolidarNevoaDaMesa(CID, IID, mascaraCom(400, 400, 60), {
      deltas: ["estado", "d_000001_aba1"],
    });
    const lote = state.batches.at(-1);
    expect(lote.deletes).toEqual([`${BASE}/fog/d_000001_aba1`]);
  });

  test("marca a RECOBERTURA — é o único sinal que autoriza substituir do outro lado", async () => {
    await consolidarNevoaDaMesa(CID, IID, mascaraCom(400, 400, 60), { regrediu: true });
    expect(state.batches.at(-1).sets.at(0).data.regrediu).toBe(true);

    await consolidarNevoaDaMesa(CID, IID, mascaraCom(400, 400, 60));
    expect(state.batches.at(-1).sets.at(0).data.regrediu).toBe(false);
  });

  test("recusa o que não cabe no documento, antes de tentar gravar", async () => {
    await expect(
      consolidarNevoaDaMesa(CID, IID, mascaraCom(400, 400, 60), { teto: 4 }),
    ).rejects.toThrow(/grande demais/i);
    expect(state.batches).toHaveLength(0);
  });
});

describe("useFogDaMesa lê base + deltas", () => {
  const emitir = (docs) => {
    act(() => {
      state.listeners[0].next({ docs, metadata: { hasPendingWrites: false } });
    });
  };

  test("a máscara é a soma — e a soma é a mesma da máquina que gravou", () => {
    const antes = mascaraCom(200, 200, 80);
    const depois = clonar(antes);
    revelarCirculo(depois, 900, 500, 80);
    const delta = diferenca(antes, depois);

    const { result } = renderHook(() => useFogDaMesa(CID, IID));
    expect(state.listeners[0].alvo.path).toBe(`${BASE}/fog`);

    emitir([
      { id: "estado", data: () => ({ data: serializar(antes), bytes: 10, rev: 5 }) },
      { id: "d_000001_aba1", data: () => ({ kind: "delta", data: serializar(delta) }) },
    ]);

    expect(contarReveladas(result.current.mascara)).toBe(contarReveladas(depois));
    expect(result.current.deltas).toEqual(["d_000001_aba1"]);
    expect(result.current.rev).toBe(5);
  });

  test("delta corrompido é ignorado, e o resto da névoa continua de pé", () => {
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    const base = mascaraCom(200, 200, 80);
    const { result } = renderHook(() => useFogDaMesa(CID, IID));
    emitir([
      { id: "estado", data: () => ({ data: serializar(base) }) },
      { id: "d_000001_aba1", data: () => ({ data: "isto-não-é-névoa" }) },
    ]);
    expect(contarReveladas(result.current.mascara)).toBe(contarReveladas(base));
    erro.mockRestore();
  });

  test("repassa `hasPendingWrites` — é o eco da própria escrita (campaignSync2)", () => {
    const { result } = renderHook(() => useFogDaMesa(CID, IID));
    act(() => {
      state.listeners[0].next({
        docs: [{ id: "estado", data: () => ({ data: serializar(mascaraCom(1, 1, 5)) }) }],
        metadata: { hasPendingWrites: true },
      });
    });
    expect(result.current.local).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · O ESTADO DA VIAGEM
 * ══════════════════════════════════════════════════════════════════ */

describe("a viagem persistida", () => {
  test("`viagem` está na lista de campos que a regra do jogador aceita", () => {
    /* Espelho do `onlyUpdatingFields` do firestore.rules. Divergir aqui faz o
       movimento do jogador ser negado pelo servidor sem pista nenhuma na tela. */
    expect(CAMPOS_DO_MOVIMENTO).toContain("viagem");
  });

  test("a projeção enumera os campos — a polilinha da animação NÃO vai junto", () => {
    const doc = projecaoDaViagem({
      deId: "n1", paraId: "n2", trilhaId: "t1", horas: 6, progresso: 0.4,
      pontos: new Array(400).fill({ x: 1, y: 2 }),   // o objeto de animação
      posicao: { x: 3, y: 4 },
      comprimento: 900,
    }, { id: "v1", iniciadaEm: 1234, porQuem: "mestre-1" });

    expect(Object.keys(doc).sort()).toEqual([...CAMPOS_DA_VIAGEM].sort());
    expect(JSON.stringify(doc)).not.toContain("pontos");
    expect(doc.progresso).toBe(0.4);
    expect(doc.id).toBe("v1");
  });

  test("progresso fora de faixa é grampeado, e sem os dois nós não há viagem", () => {
    expect(projecaoDaViagem({ deId: "n1", paraId: "n2", progresso: 9 }).progresso).toBe(1);
    expect(projecaoDaViagem({ deId: "n1", paraId: "n2", progresso: -3 }).progresso).toBe(0);
    expect(projecaoDaViagem({ deId: "n1" })).toBeNull();
    expect(projecaoDaViagem(null)).toBeNull();
  });

  test("moverGrupo leva o percurso JUNTO do destino, numa escrita só", async () => {
    const viagem = projecaoDaViagem({ deId: "n1", paraId: "n2", trilhaId: "t1" }, { id: "v1" });
    await moverGrupo(CID, IID, { nodeId: "n2", x: 8, y: 9, quem: "jogador-1", viagem });
    const { data } = state.updateDocs.at(-1);
    expect(data.viagem.id).toBe("v1");
    expect(Object.keys(data).every((k) => CAMPOS_DO_MOVIMENTO.includes(k))).toBe(true);
  });

  test("mover SEM informar viagem não apaga o percurso de quem está viajando", async () => {
    await moverGrupo(CID, IID, { nodeId: "n2", x: 8, y: 9 });
    expect("viagem" in state.updateDocs.at(-1).data).toBe(false);

    await moverGrupo(CID, IID, { nodeId: "n2", x: 8, y: 9, viagem: null });
    expect(state.updateDocs.at(-1).data.viagem).toBeNull();
  });

  test("atualizarViagem escreve só o andamento — cabe na regra do jogador", async () => {
    await atualizarViagem(CID, IID, projecaoDaViagem({ deId: "n1", paraId: "n2", progresso: 0.6 }));
    const { ref, data } = state.updateDocs.at(-1);
    expect(ref.path).toBe(`${BASE}/party/estado`);
    expect(Object.keys(data).sort()).toEqual(["updatedAt", "viagem"]);
    expect(data.viagem.progresso).toBe(0.6);
  });
});

describe("a chegada acontece UMA VEZ SÓ", () => {
  const comViagemEmCurso = (id = "v1") => {
    state.docs.set(`${BASE}/party/estado`, {
      currentNodeId: "n1", inGameDatetime: { dia: 1, hora: 0, minuto: 0 }, supplies: 5,
      viagem: { id, deId: "n1", paraId: "n2", progresso: 0.9 },
    });
  };

  test("duas telas concluindo a mesma estrada: só a primeira paga o preço", async () => {
    comViagemEmCurso("v1");
    const patch = { inGameDatetime: { dia: 1, hora: 6, minuto: 0 }, supplies: 4.75 };

    const primeira = await concluirViagem(CID, IID, "v1", patch);
    const segunda = await concluirViagem(CID, IID, "v1", patch);

    expect(primeira.aplicou).toBe(true);
    expect(segunda.aplicou).toBe(false);
    expect(segunda.motivo).toBe("ja-concluida");

    /* Uma escrita, um relógio adiantado. */
    const escritas = state.setDocs.filter((s) => s.ref.path === `${BASE}/party/estado`);
    expect(escritas).toHaveLength(1);
    expect(escritas[0].data.inGameDatetime).toEqual({ dia: 1, hora: 6, minuto: 0 });
    expect(escritas[0].data.viagem).toBeNull();
  });

  test("chegar de uma viagem que já não é a atual não mexe em nada", async () => {
    comViagemEmCurso("v2");
    const r = await concluirViagem(CID, IID, "v1", { inGameDatetime: { dia: 9, hora: 0, minuto: 0 } });
    expect(r.aplicou).toBe(false);
    expect(r.motivo).toBe("outra-viagem");
    expect(state.docs.get(`${BASE}/party/estado`).viagem.id).toBe("v2");
  });

  test("o fecho só grava campos do grupo — nada de campo inventado", async () => {
    comViagemEmCurso("v1");
    await concluirViagem(CID, IID, "v1", { supplies: 3, gmScratch: "não é aqui", pendingEncounter: {} });
    const gravado = state.setDocs.at(-1).data;
    expect(gravado.supplies).toBe(3);
    expect("gmScratch" in gravado).toBe(false);
    expect("pendingEncounter" in gravado).toBe(false);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · A PENDÊNCIA DO ENCONTRO
 * ══════════════════════════════════════════════════════════════════ */

describe("a decisão do encontro é única e idempotente", () => {
  const PENDENCIA = { id: "pend-1", origem: "viagem", noId: "n2", sugestao: { id: "ev-lobos" } };

  test("duas abas sorteando: só a primeira põe a pendência na fila", async () => {
    const a = await reservarPendencia(CID, IID, PENDENCIA);
    const b = await reservarPendencia(CID, IID, { ...PENDENCIA, id: "pend-2" });

    expect(a.reservada).toBe(true);
    expect(b.reservada).toBe(false);
    expect(b.motivo).toBe("ja-ha-pendencia");
    expect(state.docs.get(`${BASE}/gm/estado`).pendingEncounter.id).toBe("pend-1");
  });

  test("duas abas decidindo: quem decide primeiro vence, a segunda não decide de novo", async () => {
    await reservarPendencia(CID, IID, PENDENCIA);

    const primeira = await resolverPendencia(CID, IID, "pend-1", { triggeredEventIds: ["ev-lobos"] });
    const segunda = await resolverPendencia(CID, IID, "pend-1", { triggeredEventIds: ["ev-lobos"] });

    expect(primeira.decidida).toBe(true);
    expect(primeira.pendencia.id).toBe("pend-1");   // devolvível se a publicação falhar
    expect(segunda.decidida).toBe(false);
    expect(segunda.motivo).toBe("ja-decidida");
    expect(state.docs.get(`${BASE}/gm/estado`).pendingEncounter).toBeNull();
  });

  test("decidir sobre uma pendência que já foi trocada por outra não a apaga", async () => {
    await reservarPendencia(CID, IID, { ...PENDENCIA, id: "pend-nova" });
    const r = await resolverPendencia(CID, IID, "pend-velha", {});
    expect(r.decidida).toBe(false);
    expect(r.motivo).toBe("outra-pendencia");
    expect(state.docs.get(`${BASE}/gm/estado`).pendingEncounter.id).toBe("pend-nova");
  });

  test("pendência LEGADA (sem id) é decidível — a mesa não pode ficar travada", async () => {
    state.docs.set(`${BASE}/gm/estado`, { pendingEncounter: { origem: "viagem", noId: "n2" } });
    const r = await resolverPendencia(CID, IID, "", {});
    expect(r.decidida).toBe(true);
    expect(state.docs.get(`${BASE}/gm/estado`).pendingEncounter).toBeNull();
  });

  test("a decisão não escreve campo fora do painel do mestre", async () => {
    await reservarPendencia(CID, IID, PENDENCIA);
    await resolverPendencia(CID, IID, "pend-1", { triggeredEventIds: ["a"], supplies: 99 });
    const gravado = state.setDocs.at(-1).data;
    expect(gravado.triggeredEventIds).toEqual(["a"]);
    expect("supplies" in gravado).toBe(false);
  });
});
