/**
 * Contrato do repositório da MESA (spec 0030 · AC-3, AC-4, AC-7).
 *
 * O Firestore é 100% mockado: o que está sob teste é a FRONTEIRA — em que caminho cada
 * operação cai, que primitivas do SDK morrem aqui, e a política de erro de cada função.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OS DOIS TESTES QUE IMPORTAM MAIS QUE OS OUTROS
 *
 *  1. `gm` e `party` são documentos DIFERENTES. O jogador lê `party` e não lê `gm`;
 *     trocá-los publicaria o painel do mestre para a mesa inteira sem nenhum sintoma
 *     na tela. Há um teste que compara os dois caminhos lado a lado.
 *  2. Desligar APAGA em vez de gravar `false`. `apagarRevelado` remove o documento —
 *     não grava `state: 'hidden'` —, e `atualizarParty` grava o objeto `flags` exatamente
 *     como recebeu, sem completar a chave que quem chamou omitiu. Segredo não vaza pelo
 *     dado, vaza pela DIFERENÇA entre "não existe" e "existe desligado".
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
  query, where, serverTimestamp, writeBatch, runTransaction,
} from "firebase/firestore";
import * as mesaRepo from "../mesaRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

const fs = () => require("firebase/firestore");

const CID = "camp-1";
const IID = "mestre-1~mapa-1";
const BASE = `campaigns/${CID}/worldmaps/${IID}`;

/** Documento cru do Firestore: `id` fora, dados atrás de `data()`. */
const docOf = (id, data) => ({ id, data: () => data });
const snapOf = (docs) => ({ docs, empty: docs.length === 0, size: docs.length });
const umDoc = (data) => ({ exists: () => data != null, id: "estado", data: () => data });

/** O último lote criado por `writeBatch`, para inspecionar o que foi enfileirado. */
let lotes = [];

// O preset Jest do CRA usa `resetMocks: true`: o que a fábrica do `jest.mock` instala é
// apagado antes de cada teste. Tudo o que o repositório precisa é reinstalado aqui.
beforeEach(() => {
  lotes = [];
  fs().doc.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  fs().collection.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  query.mockImplementation((ref, ...rest) => ({ ref, rest }));
  where.mockImplementation((f, op, v) => `${f} ${op} ${v}`);
  serverTimestamp.mockReturnValue("<serverTimestamp>");
  getDoc.mockResolvedValue(umDoc(null));
  getDocs.mockResolvedValue(snapOf([]));
  setDoc.mockResolvedValue(undefined);
  updateDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  writeBatch.mockImplementation(() => {
    const lote = { sets: [], updates: [], deletes: [], commits: 0 };
    lote.set = jest.fn((ref, data) => lote.sets.push({ path: ref.path, data }));
    lote.update = jest.fn((ref, data) => lote.updates.push({ path: ref.path, data }));
    lote.delete = jest.fn((ref) => lote.deletes.push(ref.path));
    lote.commit = jest.fn(async () => { lote.commits += 1; });
    lotes.push(lote);
    return lote;
  });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => { jest.restoreAllMocks(); });

/* ════════════════════════════════════════════════════════════════════
 *  1 · OS CAMINHOS — e a separação que guarda o segredo
 * ══════════════════════════════════════════════════════════════════ */

describe("os caminhos de cada operação", () => {
  it("O PAINEL DO MESTRE E O ESTADO DO GRUPO SÃO DOCUMENTOS DIFERENTES", async () => {
    await mesaRepo.mesclarGm(CID, IID, { gmScratch: "o culto se reúne na terça" });
    await mesaRepo.atualizarParty(CID, IID, { supplies: 4 });

    const caminhoGm = setDoc.mock.calls[0][0].path;
    const caminhoParty = updateDoc.mock.calls[0][0].path;

    expect(caminhoGm).toBe(`${BASE}/gm/estado`);
    expect(caminhoParty).toBe(`${BASE}/party/estado`);
    /* Não é redundante com as duas linhas acima: é o que falha se um dia alguém
       "simplificar" os dois alvos num só. As rules negam `gm/` ao jogador e liberam
       `party/`; um caminho só significaria o mestre publicando os próprios segredos. */
    expect(caminhoGm).not.toBe(caminhoParty);
    expect(setDoc.mock.calls[0][2]).toEqual({ merge: true });
  });

  it("a névoa sem docId é a base consolidada; com docId é um delta, na MESMA coleção", async () => {
    await mesaRepo.aplicarEmLote(CID, IID, [
      { tipo: "set", alvo: "fog", dados: { kind: "base" } },
      { tipo: "delete", alvo: "fog", docId: "d_000001_aba1" },
    ]);
    expect(lotes[0].sets[0].path).toBe(`${BASE}/fog/estado`);
    /* Delta e base na mesma coleção é decisão de rules: `match /fog/{docId}` cobre os
       dois, então o delta entra sem regra nova e sem gastar access call. */
    expect(lotes[0].deletes).toEqual([`${BASE}/fog/d_000001_aba1`]);
  });

  it("o revelado, a instância e a ilustração caem cada um no seu lugar", async () => {
    await mesaRepo.aplicarEmLote(CID, IID, [
      { tipo: "set", alvo: "revelado", docId: "no_n1", dados: {} },
      { tipo: "update", alvo: "instancia", dados: { backgroundRef: "media/background" } },
      { tipo: "delete", alvo: "fundo" },
    ]);
    expect(lotes[0].sets[0].path).toBe(`${BASE}/revealed/no_n1`);
    expect(lotes[0].updates[0].path).toBe(BASE);
    expect(lotes[0].deletes).toEqual([`${BASE}/media/background`]);
  });

  it("o molde é lido no ATELIÊ privado, sob `users/`, nunca sob `campaigns/`", async () => {
    getDoc.mockResolvedValue({ exists: () => true, id: "mapa-1", data: () => ({ name: "Coroa" }) });
    getDocs.mockResolvedValue(snapOf([docOf("n1", { name: "Vila" })]));

    await expect(mesaRepo.lerMoldeDoAtelie("mestre-1", "mapa-1"))
      .resolves.toEqual({ id: "mapa-1", name: "Coroa" });
    expect(getDoc.mock.calls[0][0].path).toBe("users/mestre-1/worldmaps/mapa-1");

    await mesaRepo.listarSubcolecaoDoMolde("mestre-1", "mapa-1", "nodes");
    expect(getDocs.mock.calls[0][0].path).toBe("users/mestre-1/worldmaps/mapa-1/nodes");
  });

  it("as campanhas do mestre saem da coleção raiz, filtradas por `masterId`", () => {
    mesaRepo.watchCampanhasDoMestre("mestre-1", () => {});
    expect(query).toHaveBeenCalledWith({ path: "campaigns" }, "masterId == mestre-1");
  });

  it("as assinaturas apontam para a coleção/documento certos", () => {
    onSnapshot.mockImplementation(() => () => {});
    mesaRepo.watchInstancias(CID, () => {});
    mesaRepo.watchRevelado(CID, IID, () => {});
    mesaRepo.watchParty(CID, IID, () => {});
    mesaRepo.watchNevoa(CID, IID, () => {});
    mesaRepo.watchGm(CID, IID, () => {});

    expect(onSnapshot.mock.calls.map((c) => c[0].path)).toEqual([
      `campaigns/${CID}/worldmaps`,
      `${BASE}/revealed`,
      `${BASE}/party/estado`,
      `${BASE}/fog`,
      `${BASE}/gm/estado`,
    ]);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · DESLIGAR APAGA — o teste que preserva o segredo
 * ══════════════════════════════════════════════════════════════════ */

describe("desligar APAGA em vez de gravar `false`", () => {
  it("`apagarRevelado` REMOVE o documento — nunca grava `state: 'hidden'`", async () => {
    await mesaRepo.apagarRevelado(CID, IID, "no_n1");

    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(deleteDoc.mock.calls[0][0].path).toBe(`${BASE}/revealed/no_n1`);

    /* O ponto do teste: NENHUMA escrita acontece. Um documento sobrevivente com
       `state: 'hidden'` (ou `visivel: false`) contaria ao jogador que existe alguma
       coisa ali para descobrir — o segredo vaza pela DIFERENÇA, não pelo dado. */
    expect(setDoc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it("`atualizarParty` grava as `flags` EXATAMENTE como recebeu — a pausa desligada é ausência", async () => {
    /* É assim que o `model/encontros.js` desliga a pausa: devolve o objeto SEM a chave.
       Se o repositório completasse o que falta (`{...padrao, ...campos}`) ou convertesse
       ausência em `false`, ele estaria contando ao jogador que a pausa existe. */
    await mesaRepo.atualizarParty(CID, IID, { flags: { perigo: 3 } });

    const gravado = updateDoc.mock.calls[0][1];
    expect(gravado.flags).toEqual({ perigo: 3 });
    expect("pausa" in gravado.flags).toBe(false);
    expect(gravado.flags.pausa).toBeUndefined();
    /* E nada além do que veio, fora o carimbo de tempo. */
    expect(Object.keys(gravado).sort()).toEqual(["flags", "updatedAt"]);
  });

  it("`mesclarGm` não inventa campo nenhum no painel do mestre", async () => {
    await mesaRepo.mesclarGm(CID, IID, { triggeredEventIds: ["ev-lobos"] });
    expect(Object.keys(setDoc.mock.calls[0][1]).sort()).toEqual(["triggeredEventIds", "updatedAt"]);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · NENHUMA PRIMITIVA DO SDK ATRAVESSA A FRONTEIRA (AC-4)
 * ══════════════════════════════════════════════════════════════════ */

describe("as primitivas do SDK morrem aqui", () => {
  it("`carimbar` vira `serverTimestamp()` — a FieldValue nunca é montada pela borda", async () => {
    await mesaRepo.aplicarEmLote(CID, IID, [{
      tipo: "set",
      alvo: "instancia",
      dados: { name: "Coroa de Cinzas" },
      carimbar: ["createdAt", "updatedAt"],
    }]);

    expect(lotes[0].sets[0].data).toEqual({
      name: "Coroa de Cinzas",
      createdAt: "<serverTimestamp>",
      updatedAt: "<serverTimestamp>",
    });
    expect(serverTimestamp).toHaveBeenCalledTimes(2);
  });

  it("sem `carimbar`, nada de tempo é acrescentado (há escrita no legado que não carimba)", async () => {
    await mesaRepo.aplicarEmLote(CID, IID, [
      { tipo: "update", alvo: "instancia", dados: { backgroundRef: "media/background" } },
    ]);
    expect(lotes[0].updates[0].data).toEqual({ backgroundRef: "media/background" });
    expect(serverTimestamp).not.toHaveBeenCalled();
  });

  it("as leituras devolvem objetos planos com o id junto — nunca um QuerySnapshot", async () => {
    getDocs.mockResolvedValue(snapOf([
      docOf("no_n1", { kind: "node", nodeId: "n1", state: "visited" }),
      docOf("tr_e1", { kind: "edge", edgeId: "e1", state: "revealed" }),
    ]));

    const lista = await mesaRepo.listarRevelado(CID, IID);
    expect(lista).toEqual([
      { id: "no_n1", kind: "node", nodeId: "n1", state: "visited" },
      { id: "tr_e1", kind: "edge", edgeId: "e1", state: "revealed" },
    ]);
    expect(lista[0].ref).toBeUndefined();
  });

  it("`existeInstancia` devolve booleano, não o documento", async () => {
    getDoc.mockResolvedValue({ exists: () => true, id: IID, data: () => ({ name: "x" }) });
    await expect(mesaRepo.existeInstancia(CID, IID)).resolves.toBe(true);

    getDoc.mockResolvedValue({ exists: () => false, id: IID, data: () => ({}) });
    await expect(mesaRepo.existeInstancia(CID, IID)).resolves.toBe(false);
  });

  it("`lerFundoDaMesa` devolve só a dataURL, e `null` quando não há arte própria", async () => {
    getDoc.mockResolvedValue({ exists: () => true, id: "background", data: () => ({ data: "data:image/x" }) });
    await expect(mesaRepo.lerFundoDaMesa(CID, IID)).resolves.toBe("data:image/x");
    expect(getDoc.mock.calls[0][0].path).toBe(`${BASE}/media/background`);

    getDoc.mockResolvedValue({ exists: () => false, id: "background", data: () => ({}) });
    await expect(mesaRepo.lerFundoDaMesa(CID, IID)).resolves.toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · A TRADUÇÃO DO LOTE
 * ══════════════════════════════════════════════════════════════════ */

describe("aplicarEmLote", () => {
  it("traduz cada tipo para a operação certa do lote, na ordem pedida", async () => {
    const enviadas = await mesaRepo.aplicarEmLote(CID, IID, [
      { tipo: "set", alvo: "party", dados: { x: 1 } },
      { tipo: "update", alvo: "instancia", dados: { name: "n" } },
      { tipo: "delete", alvo: "gm" },
    ]);

    expect(enviadas).toBe(3);
    expect(lotes).toHaveLength(1);
    expect(lotes[0].sets).toHaveLength(1);
    expect(lotes[0].updates).toHaveLength(1);
    expect(lotes[0].deletes).toEqual([`${BASE}/gm/estado`]);
    expect(lotes[0].commits).toBe(1);
  });

  it("tipo desconhecido cai em `set` — é o padrão herdado do `commitOps` do store", async () => {
    await mesaRepo.aplicarEmLote(CID, IID, [{ alvo: "party", dados: { x: 1 } }]);
    expect(lotes[0].sets).toHaveLength(1);
  });

  it("fatia em lotes de 500 — o limite duro do Firestore", async () => {
    const ops = Array.from({ length: 620 }, (_, i) => ({
      tipo: "set", alvo: "revelado", docId: `no_${i}`, dados: { i },
    }));
    await mesaRepo.aplicarEmLote(CID, IID, ops);

    expect(mesaRepo.BATCH_LIMIT).toBe(500);
    expect(lotes).toHaveLength(2);
    expect(lotes[0].sets).toHaveLength(500);
    expect(lotes[1].sets).toHaveLength(120);
    lotes.forEach((l) => expect(l.commits).toBe(1));
  });

  it("lista vazia não abre lote nenhum — revelação repetida não custa escrita", async () => {
    await expect(mesaRepo.aplicarEmLote(CID, IID, [])).resolves.toBe(0);
    await expect(mesaRepo.aplicarEmLote(CID, IID)).resolves.toBe(0);
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it("alvo desconhecido recusa em português, antes de abrir o lote", async () => {
    await expect(
      mesaRepo.aplicarEmLote(CID, IID, [{ tipo: "set", alvo: "inventado", dados: {} }]),
    ).rejects.toThrow(/Alvo desconhecido/i);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · A TRANSAÇÃO — a decisão é de quem chama
 * ══════════════════════════════════════════════════════════════════ */

describe("transacionar", () => {
  /** Dublê fiel: a transação lê o documento como ele ESTÁ e grava sobre ele. */
  const comDocumento = (dados) => {
    const guardado = { atual: dados };
    const escritas = [];
    runTransaction.mockImplementation(async (_db, fn) => fn({
      get: async (ref) => ({
        exists: () => guardado.atual != null,
        id: ref.path.split("/").pop(),
        data: () => guardado.atual,
      }),
      set: (ref, data, opts) => {
        escritas.push({ path: ref.path, data, opts });
        guardado.atual = opts?.merge ? { ...(guardado.atual || {}), ...data } : data;
      },
    }));
    return escritas;
  };

  it("entrega o documento como OBJETO PLANO e grava o que a decisão pediu, com merge", async () => {
    const escritas = comDocumento({ pendingEncounter: null });
    let visto;

    const r = await mesaRepo.transacionar(CID, IID, "gm", (atual) => {
      visto = atual;
      return { resultado: { reservada: true }, gravar: { pendingEncounter: { id: "p1" } } };
    });

    expect(visto).toEqual({ pendingEncounter: null });   // sem `exists()`, sem `data()`
    expect(r).toEqual({ reservada: true });
    expect(escritas[0].path).toBe(`${BASE}/gm/estado`);
    expect(escritas[0].opts).toEqual({ merge: true });
    expect(escritas[0].data).toEqual({
      pendingEncounter: { id: "p1" },
      updatedAt: "<serverTimestamp>",
    });
  });

  it("sem `gravar`, NADA é escrito — é assim que quem chega depois não mexe em nada", async () => {
    const escritas = comDocumento({ pendingEncounter: { id: "p1" } });
    const r = await mesaRepo.transacionar(CID, IID, "gm", () => ({
      resultado: { reservada: false, motivo: "ja-ha-pendencia" },
    }));
    expect(r).toEqual({ reservada: false, motivo: "ja-ha-pendencia" });
    expect(escritas).toHaveLength(0);
  });

  it("documento inexistente chega como `null`, não como objeto vazio", async () => {
    comDocumento(null);
    let visto = "não chamou";
    await mesaRepo.transacionar(CID, IID, "party", (atual) => { visto = atual; return {}; });
    expect(visto).toBeNull();
  });

  it("a decisão escolhe o alvo, e `party` não é `gm`", async () => {
    const escritas = comDocumento({});
    await mesaRepo.transacionar(CID, IID, "party", () => ({ gravar: { viagem: null } }));
    expect(escritas[0].path).toBe(`${BASE}/party/estado`);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  6 · POLÍTICA DE ERRO (AC-7)
 * ══════════════════════════════════════════════════════════════════ */

describe("política de erro", () => {
  it("`listarNevoa` é a ÚNICA silenciosa: devolve [] e loga com a tag do repo", async () => {
    /* O legado escrevia `getDocs(fogCol(...)).catch(() => ({docs: []}))` dentro de
       `limparProgresso`: recomeçar a mesa não podia travar porque a névoa não pôde ser
       listada. A spec 0030 PRESERVA comportamento; consertar isso é onda 3. */
    getDocs.mockRejectedValue(new Error("permission-denied"));

    await expect(mesaRepo.listarNevoa(CID, IID)).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("[mesaRepo.listarNevoa]"),
      expect.any(Error),
    );
  });

  it("as demais leituras são `strict`: a falha sobe para quem chamou decidir", async () => {
    const erro = new Error("permission-denied");
    getDocs.mockRejectedValue(erro);
    getDoc.mockRejectedValue(erro);

    await expect(mesaRepo.listarRevelado(CID, IID)).rejects.toThrow(erro);
    await expect(mesaRepo.listarSubcolecaoDoMolde("u", "m", "nodes")).rejects.toThrow(erro);
    await expect(mesaRepo.existeInstancia(CID, IID)).rejects.toThrow(erro);
    await expect(mesaRepo.lerMoldeDoAtelie("u", "m")).rejects.toThrow(erro);
    await expect(mesaRepo.lerFundoDaMesa(CID, IID)).rejects.toThrow(erro);
  });

  it("as escritas são `strict`: perder uma revelação não pode passar despercebido", async () => {
    const erro = new Error("offline");
    setDoc.mockRejectedValue(erro);
    updateDoc.mockRejectedValue(erro);
    deleteDoc.mockRejectedValue(erro);

    await expect(mesaRepo.mesclarGm(CID, IID, { gmScratch: "x" })).rejects.toThrow(erro);
    await expect(mesaRepo.atualizarParty(CID, IID, { x: 1 })).rejects.toThrow(erro);
    await expect(mesaRepo.atualizarRevelado(CID, IID, "no_n1", { state: "rumored" })).rejects.toThrow(erro);
    await expect(mesaRepo.apagarRevelado(CID, IID, "no_n1")).rejects.toThrow(erro);
    await expect(mesaRepo.salvarNevoaDelta(CID, IID, "d_1_a", { data: "x" })).rejects.toThrow(erro);
  });

  it("o erro da assinatura sobe CRU para quem assinou — traduzir é da tela", () => {
    const erro = Object.assign(new Error("negado"), { code: "permission-denied" });
    onSnapshot.mockImplementation((_alvo, _next, onErr) => { onErr(erro); return () => {}; });
    const onError = jest.fn();

    mesaRepo.watchInstancias(CID, () => {}, onError);
    expect(onError).toHaveBeenCalledWith(erro);
  });

  it("assinatura sem `onError` não quebra — só deixa rastro no console", () => {
    onSnapshot.mockImplementation((_alvo, _next, onErr) => { onErr(new Error("offline")); return () => {}; });
    expect(() => mesaRepo.watchGm(CID, IID, () => {})).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  7 · IDS FALSY — retorno cedo, sem tocar a rede
 * ══════════════════════════════════════════════════════════════════ */

describe("id ausente", () => {
  it("as leituras devolvem o vazio documentado sem chamar o Firestore", async () => {
    await expect(mesaRepo.existeInstancia("", IID)).resolves.toBe(false);
    await expect(mesaRepo.existeInstancia(CID, "")).resolves.toBe(false);
    await expect(mesaRepo.lerMoldeDoAtelie("", "m")).resolves.toBeNull();
    await expect(mesaRepo.lerMoldeDoAtelie("u", null)).resolves.toBeNull();
    await expect(mesaRepo.listarSubcolecaoDoMolde("u", "m", "")).resolves.toEqual([]);
    await expect(mesaRepo.listarRevelado(CID, "")).resolves.toEqual([]);
    await expect(mesaRepo.listarNevoa("", IID)).resolves.toEqual([]);
    await expect(mesaRepo.lerFundoDaMesa(CID, undefined)).resolves.toBeNull();

    expect(getDoc).not.toHaveBeenCalled();
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("os `watch*` devolvem um unsubscribe inerte, e chamá-lo duas vezes é seguro", () => {
    const unsubs = [
      mesaRepo.watchInstancias("", () => {}),
      mesaRepo.watchRevelado(CID, "", () => {}),
      mesaRepo.watchParty("", IID, () => {}),
      mesaRepo.watchNevoa(CID, null, () => {}),
      mesaRepo.watchGm(undefined, IID, () => {}),
      mesaRepo.watchCampanhasDoMestre("", () => {}),
    ];

    expect(onSnapshot).not.toHaveBeenCalled();
    /* Chamar duas vezes é o caso real: o `useEffect` desfaz na troca de id E na
       desmontagem. Sem isto, cada tela precisaria de um `if (unsub) unsub()`. */
    unsubs.forEach((unsub) => {
      expect(typeof unsub).toBe("function");
      expect(() => { unsub(); unsub(); }).not.toThrow();
    });
  });

  it("o unsubscribe REAL é o que o SDK devolveu, e também aguenta duas chamadas", () => {
    const cancelar = jest.fn();
    onSnapshot.mockReturnValue(cancelar);

    const unsub = mesaRepo.watchRevelado(CID, IID, () => {});
    unsub();
    unsub();
    expect(cancelar).toHaveBeenCalledTimes(2);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  8 · O QUE AS ASSINATURAS ENTREGAM
 * ══════════════════════════════════════════════════════════════════ */

describe("o formato entregue pelas assinaturas", () => {
  const emitir = (snap) => {
    onSnapshot.mockImplementation((_alvo, next) => { next(snap); return () => {}; });
  };

  it("`watchRevelado` entrega a lista com o id junto", () => {
    emitir(snapOf([docOf("no_n1", { kind: "node", nodeId: "n1" })]));
    let recebido;
    mesaRepo.watchRevelado(CID, IID, (lista) => { recebido = lista; });
    expect(recebido).toEqual([{ id: "no_n1", kind: "node", nodeId: "n1" }]);
  });

  it("`watchParty` repassa `hasPendingWrites` — o eco da própria escrita", () => {
    emitir({
      exists: () => true,
      id: "estado",
      data: () => ({ currentNodeId: "n2" }),
      metadata: { hasPendingWrites: true },
    });
    let recebido;
    mesaRepo.watchParty(CID, IID, (e) => { recebido = e; });
    expect(recebido).toEqual({ party: { id: "estado", currentNodeId: "n2" }, local: true });
  });

  it("`watchParty` entrega `party: null` quando o documento não existe", () => {
    emitir({ exists: () => false, id: "estado", data: () => ({}) });
    let recebido;
    mesaRepo.watchParty(CID, IID, (e) => { recebido = e; });
    expect(recebido).toEqual({ party: null, local: false });
  });

  it("`watchNevoa` entrega os documentos CRUS — desserializar bitmap não é da infra", () => {
    emitir(snapOf([
      docOf("estado", { kind: "base", data: "AAA", bytes: 3 }),
      docOf("d_000001_aba1", { kind: "delta", data: "BBB" }),
    ]));
    let recebido;
    mesaRepo.watchNevoa(CID, IID, (e) => { recebido = e; });

    /* `dados` num campo próprio: o payload da névoa mora numa chave chamada `data`,
       e achatá-la ao lado de `id` só convidaria a colisão. */
    expect(recebido.docs).toEqual([
      { id: "estado", dados: { kind: "base", data: "AAA", bytes: 3 } },
      { id: "d_000001_aba1", dados: { kind: "delta", data: "BBB" } },
    ]);
    expect(recebido.local).toBe(false);
  });

  it("`watchGm` entrega o painel do mestre como objeto plano", () => {
    emitir({ exists: () => true, id: "estado", data: () => ({ gmScratch: "s" }) });
    let recebido;
    mesaRepo.watchGm(CID, IID, (gm) => { recebido = gm; });
    expect(recebido).toEqual({ id: "estado", gmScratch: "s" });
  });
});
