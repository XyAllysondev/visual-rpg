/* ════════════════════════════════════════════════════════════════════
 *  ENCONTROS, ACAMPAMENTO E A PAUSA NA MESA
 *  (spec 0028 · F6 · AC-8, AC-10, AC-12 · briefing §9)
 *  --------------------------------------------------------------------
 *  A regra que este arquivo existe para provar, literal do briefing §9:
 *
 *    "pausa a viagem e notifica o mestre com o resultado rolado; o mestre
 *     decide aceitar, trocar ou ignorar ANTES DE O JOGADOR VER QUALQUER
 *     COISA."
 *
 *  Três provas, e as três são sobre o que o jogador NÃO recebe:
 *
 *   1. **a pendência nunca chega ao cliente do jogador** — nem por render,
 *      nem por rede: `useGmDaMesa` é chamado com `ehMestre = false` e o
 *      HTML dele não contém uma letra do encontro;
 *   2. **o HTML do jogador durante a pausa é IGUAL** ao de uma pausa que
 *      nasceu da mão do mestre, sem encontro nenhum. Não "parecido":
 *      idêntico caractere a caractere. Se um dia alguém acrescentar um
 *      "por quê" à pausa, este teste cai;
 *   3. **ignorar não deixa rastro** — nenhuma escrita em `revealed/`,
 *      nenhum id em `triggeredEventIds`, nada.
 *
 *  Fronteira mockada: só o I/O (`../mesaStore`, `../worldMapStore`). Todo o
 *  modelo (`model/encontros.js`, `model/acampamento.js`, `model/viagem.js`)
 *  e o motor de dados rodam de VERDADE; a aleatoriedade é fixada por
 *  `jest.spyOn(Math, "random")`, que é o gancho que `dice.js` promete.
 * ════════════════════════════════════════════════════════════════════ */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../mesaStore", () => ({
  useInstancias: jest.fn(),
  useReveladoNaMesa: jest.fn(),
  useParty: jest.fn(),
  useFogDaMesa: jest.fn(),
  useGmDaMesa: jest.fn(),
  publicarRevelacao: jest.fn(),
  moverGrupo: jest.fn(),
  atualizarParty: jest.fn(),
  atualizarGm: jest.fn(),
  getFundoDaMesa: jest.fn(),
  mestreDaInstancia: jest.fn(),
  atualizarViagem: jest.fn(),
  concluirViagem: jest.fn(),
  projecaoDaViagem: jest.fn(),
  reservarPendencia: jest.fn(),
  resolverPendencia: jest.fn(),
  salvarDeltaDaNevoa: jest.fn(),
  consolidarNevoaDaMesa: jest.fn(),
}));

jest.mock("../worldMapStore", () => ({
  useGrafo: jest.fn(),
  useEventos: jest.fn(),
}));

import MesaDoMapaMundi from "../Mesa";
import {
  useInstancias, useReveladoNaMesa, useParty, useFogDaMesa, useGmDaMesa,
  publicarRevelacao, moverGrupo, atualizarParty, atualizarGm,
  getFundoDaMesa, mestreDaInstancia,
} from "../mesaStore";
import {
  atualizarViagem, concluirViagem, projecaoDaViagem, reservarPendencia, resolverPendencia,
  salvarDeltaDaNevoa, consolidarNevoaDaMesa,
} from "../mesaStore";
import { useGrafo, useEventos } from "../worldMapStore";
import { criarEvento } from "../model/eventos";
import { montarPendencia } from "../model/encontros";
import { MOTIVO_LUGAR_ERRADO } from "../model/acampamento";
import {
  MARCA_DA_PAUSA, MARCA_DO_PERIGO, TEXTO_DA_PAUSA,
  assinaturaDaPendencia, candidatosAEncontro, flagsComPausa, formatarChance,
  formatarRolagem, idDoEncontro, nomesSugeridos, perigoDaRegiao, sugestaoDeEncontro,
  temPendencia, viagemPausada, avisoDeSuprimentos, detalheDeSuprimentos,
} from "../Mesa/encontrosUi";

/* ── Cenário ─────────────────────────────────────────────────────────── */

const RETANGULO = {
  left: 0, top: 0, width: 900, height: 560, right: 900, bottom: 560, x: 0, y: 0,
  toJSON() { return this; },
};

const MESTRE = "mestre-1";
const JOGADOR = "jogador-9";
const CAMPANHA = "camp-1";
const INSTANCIA = `${MESTRE}~mapa-1`;

const INSTANCIAS = [{
  id: INSTANCIA, name: "As Terras Partidas", width: 2400, height: 1600,
  fogEnabled: false, masterUid: MESTRE, startNodeId: "n1", ilustracao: null,
  backgroundRef: null, backgroundUrl: null,
}];

/** `t1` é perigosa (nível 5); `t3` é estrada batida (nível 0, nunca rola). */
const MOLDE = {
  nos: [
    { id: "n1", name: "Vila Candeia", type: "town", x: 200, y: 200 },
    { id: "n2", name: "Passo do Corvo", type: "poi", x: 800, y: 400 },
    { id: "n3", name: "Fogueira Velha", type: "camp", x: 400, y: 900 },
  ],
  trilhas: [
    { id: "t1", fromNodeId: "n1", toNodeId: "n2", travelHours: 9, pathPoints: [], dangerLevel: 5 },
    { id: "t3", fromNodeId: "n1", toNodeId: "n3", travelHours: 4, pathPoints: [], dangerLevel: 0 },
  ],
};

const REVELADO = [
  { id: "no_n1", kind: "node", nodeId: "n1", name: "Vila Candeia", type: "town", x: 200, y: 200, state: "visited", description: "", icon: null, color: null },
  { id: "no_n2", kind: "node", nodeId: "n2", name: "Passo do Corvo", type: "poi", x: 800, y: 400, state: "discovered", description: "", icon: null, color: null },
  { id: "no_n3", kind: "node", nodeId: "n3", name: "Fogueira Velha", type: "camp", x: 400, y: 900, state: "discovered", description: "", icon: null, color: null },
  { id: "tr_t1", kind: "edge", edgeId: "t1", fromNodeId: "n1", toNodeId: "n2", pathPoints: [], travelHours: 9, state: "revealed" },
  { id: "tr_t3", kind: "edge", edgeId: "t3", fromNodeId: "n1", toNodeId: "n3", pathPoints: [], travelHours: 4, state: "revealed" },
];

/** O encontro que o mestre guardou na gaveta "Na sua mão" — a sugestão. */
const EV_LOBOS = criarEvento({
  id: "ev-lobos",
  anchor: { type: "point", x: 500, y: 500 },
  title: "Lobos na neblina",
  playerText: "Olhos amarelos acompanham a marcha, fora do alcance da tocha.",
  gmText: "São três, e o alfa está ferido.",
  trigger: "manual",
});

const EV_MERCADOR = criarEvento({
  id: "ev-mercador",
  anchor: { type: "point", x: 600, y: 600 },
  title: "O mercador quebrado",
  playerText: "Uma carroça tombada, e um homem xingando o eixo.",
  trigger: "manual",
});

const EVENTOS = [EV_LOBOS, EV_MERCADOR];

const partyEm = (noId, extra = {}) => ({
  id: "estado", currentNodeId: noId, x: 0, y: 0,
  inGameDatetime: { dia: 2, hora: 20, minuto: 0 },   // noite: peso 1,25
  supplies: 5, speedModifier: 1, flags: {},
  ...extra,
});

/* ── Montagem ────────────────────────────────────────────────────────── */

function comCenario({
  molde = MOLDE, eventos = EVENTOS, revelado = REVELADO,
  party = partyEm("n1"), gm = null,
} = {}) {
  useInstancias.mockReturnValue({ instancias: INSTANCIAS, loading: false, error: null });
  useReveladoNaMesa.mockReturnValue({
    revelado,
    nos: revelado.filter((d) => d.kind === "node"),
    trilhas: revelado.filter((d) => d.kind === "edge"),
    eventos: revelado.filter((d) => d.kind === "event"),
    loading: false,
    error: null,
  });
  useParty.mockReturnValue({ party, loading: false, error: null });
  useFogDaMesa.mockReturnValue({ mascara: null, bytes: 0, loading: false, error: null });
  useGmDaMesa.mockReturnValue({ gm, loading: false, error: null });
  useGrafo.mockReturnValue({ nos: molde.nos, trilhas: molde.trilhas, loading: false, error: null });
  useEventos.mockReturnValue({ eventos, loading: false, error: null });
}

const montarMestre = (props = {}) => render(
  <MesaDoMapaMundi campaignId={CAMPANHA} uid={MESTRE} isMaster {...props} />,
);
const montarJogador = (props = {}) => render(
  <MesaDoMapaMundi campaignId={CAMPANHA} uid={JOGADOR} isMaster={false} {...props} />,
);

/** Fixa toda a aleatoriedade da mesa numa fração só. */
const comSorte = (valor) => jest.spyOn(Math, "random").mockReturnValue(valor);

/**
 * A última pendência posta na fila do mestre.
 *
 * Desde a F7 ela nasce por `reservarPendencia` — uma TRANSAÇÃO que só grava se
 * não houver outra — em vez de um `atualizarGm` cego. É o que faz duas abas do
 * mestre sorteando ao mesmo tempo não sobrescreverem uma à outra (AC-10).
 */
const ultimaPendencia = () => {
  const chamada = reservarPendencia.mock.calls.at(-1);
  return chamada ? chamada[2] : undefined;
};

/** O patch da última DECISÃO reivindicada (`resolverPendencia`). */
const ultimaDecisao = () => {
  const chamada = resolverPendencia.mock.calls.at(-1);
  return chamada ? chamada[3] : undefined;
};

/** As `flags` do grupo gravadas por `atualizarParty`, na última escrita. */
const ultimasFlags = () => {
  const chamada = atualizarParty.mock.calls
    .filter(([, , patch]) => patch && "flags" in patch)
    .at(-1);
  return chamada ? chamada[2].flags : undefined;
};

const eventosPublicados = () => publicarRevelacao.mock.calls
  .flatMap(([, , conteudo]) => conteudo?.eventos || []);

beforeEach(() => {
  window.PointerEvent = window.MouseEvent;
  /* Movimento reduzido: a viagem vira corte seco e `aoChegar` roda dentro do
     clique — é o caminho honesto de testar a chegada sem bombear rAF à mão. */
  window.matchMedia = jest.fn().mockReturnValue({ matches: true, addListener() {}, removeListener() {} });
  jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RETANGULO);
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([]); }
    disconnect() {}
  };
  global.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);

  mestreDaInstancia.mockImplementation((id) => String(id || "").split("~")[0]);
  publicarRevelacao.mockResolvedValue({ gravados: 1, pulados: 0 });
  moverGrupo.mockResolvedValue(undefined);
  atualizarParty.mockResolvedValue(undefined);
  atualizarGm.mockResolvedValue(undefined);
  getFundoDaMesa.mockResolvedValue(null);
  /* ── F7 (tempo real) ───────────────────────────────────────────────
     A chegada agora fecha `party.viagem` por transação e a decisão do
     encontro é reivindicada antes de publicar. Sem estes dublês nada disso
     resolve, e a mesa para na primeira estrada. */
  concluirViagem.mockResolvedValue({ aplicou: true, motivo: "" });
  atualizarViagem.mockResolvedValue(undefined);
  projecaoDaViagem.mockImplementation((v, extra = {}) => ({ ...(v || {}), ...extra }));
  reservarPendencia.mockImplementation(async (_c, _i, p) => ({ reservada: true, motivo: "", pendencia: p }));
  resolverPendencia.mockImplementation(async () => ({ decidida: true, motivo: "", pendencia: null }));
  salvarDeltaDaNevoa.mockResolvedValue({ id: "d_000001_teste", bytes: 12 });
  consolidarNevoaDaMesa.mockResolvedValue({ bytes: 120, apagados: 0 });
  comCenario();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.ResizeObserver;
  delete global.IntersectionObserver;
  delete window.PointerEvent;
  delete window.matchMedia;
});

/* ════════════════════════════════════════════════════════════════════
 *  1 · A LÓGICA PURA DA PAUSA E DA SUGESTÃO
 * ════════════════════════════════════════════════════════════════════ */
describe("encontrosUi — a pausa é muda", () => {
  it("a marca é um booleano só, e desligar APAGA a chave", () => {
    expect(flagsComPausa({}, true)).toEqual({ [MARCA_DA_PAUSA]: true });
    /* Nem `false`, nem `motivo`, nem carimbo: a chave some. Um `false`
       gravado contaria que houve uma pausa ali antes. */
    expect(flagsComPausa({ [MARCA_DA_PAUSA]: true }, false)).toEqual({});
    expect(Object.keys(flagsComPausa({ a: true }, true))).toEqual(["a", MARCA_DA_PAUSA]);
  });

  it("não escreve à toa quando nada mudaria", () => {
    expect(flagsComPausa({ [MARCA_DA_PAUSA]: true }, true)).toBeNull();
    expect(flagsComPausa({}, false)).toBeNull();
    expect(flagsComPausa(null, false)).toBeNull();
  });

  it("`viagemPausada` lê só o booleano — nada de valor-verdade frouxo", () => {
    expect(viagemPausada({ flags: { [MARCA_DA_PAUSA]: true } })).toBe(true);
    expect(viagemPausada({ flags: { [MARCA_DA_PAUSA]: "sim" } })).toBe(false);
    expect(viagemPausada(null)).toBe(false);
  });

  it("a frase da pausa não fala de encontro, de mestre decidindo, nem de perigo", () => {
    expect(TEXTO_DA_PAUSA).not.toMatch(/encontro|emboscad|decid|monstro|perigo|rolagem|sorte/i);
  });
});

describe("encontrosUi — de onde vem a sugestão", () => {
  it("só eventos `manual` ainda não disparados entram na gaveta", () => {
    expect(candidatosAEncontro(EVENTOS, []).map((e) => e.id))
      .toEqual(["ev-lobos", "ev-mercador"]);
    expect(candidatosAEncontro(EVENTOS, new Set(["ev-lobos"])).map((e) => e.id))
      .toEqual(["ev-mercador"]);
    expect(candidatosAEncontro(null, null)).toEqual([]);
  });

  it("o sorteio escolhe um deles, e nunca inventa monstro quando a gaveta esvazia", () => {
    expect(sugestaoDeEncontro(EVENTOS, [], 0).id).toBe("ev-lobos");
    expect(sugestaoDeEncontro(EVENTOS, [], 0.99).id).toBe("ev-mercador");
    expect(sugestaoDeEncontro(EVENTOS, ["ev-lobos", "ev-mercador"], 0)).toBeNull();
    expect(sugestaoDeEncontro([], [], 0)).toBeNull();
  });

  it("as alternativas da troca não repetem a sugestão já mostrada", () => {
    expect(nomesSugeridos(EVENTOS, [], "ev-lobos")).toEqual(["O mercador quebrado"]);
  });
});

describe("encontrosUi — números, ids e avisos", () => {
  it("chance e rolagem aceitam fração e percentual sem virar 0%", () => {
    expect(formatarChance(0.385)).toBe("38,5%");
    expect(formatarChance(38.5)).toBe("38,5%");
    expect(formatarChance(null)).toBe("—");
    expect(formatarRolagem(0.12)).toBe("12");
    expect(formatarRolagem(undefined)).toBe("—");
  });

  it("o id do encontro improvisado sai do RELÓGIO, nunca de um contador", () => {
    /* Contador entregaria, pelos buracos na sequência, quantos encontros o
       mestre ignorou. O relógio já é público. */
    expect(idDoEncontro({ dia: 3, hora: 7, minuto: 40 })).toBe("encontro-d3-07");
    expect(idDoEncontro({ dia: 3, hora: 7, minuto: 5 }))
      .toBe(idDoEncontro({ dia: 3, hora: 7, minuto: 55 }));
    expect(idDoEncontro(null)).toBe("encontro-d1-00");
  });

  /* REFINO DE LAYOUT (2026-08-02): a FRASE deixou de carregar a fração.
     "faltaram 0,3 ração(ões)" é o resto da divisão — a máquina falando — e
     ocupava a linha inteira da coluna de 340 px com o que o mestre não
     decide. A consequência ficou na frase; o número foi para o atributo
     "title", via detalheDeSuprimentos(). O contrato que este teste guarda (dizer a
     verdade sobre a comida SEM inventar penalidade de regra) continua
     inteiro — agora verificado nas duas pontas. */
  it("o aviso de comida diz a consequência, o detalhe guarda o número, e nenhum dos dois inventa regra", () => {
    const aviso = avisoDeSuprimentos({ esgotou: true, deficit: 0.5, restante: 0 });
    expect(aviso).toMatch(/a comida acabou/i);
    expect(aviso).not.toMatch(/-\d|exaust|fome|condi[çc]|penalidad|dano/i);
    /* O número existe, só não está na frase. */
    expect(aviso).not.toMatch(/0,5/);
    expect(detalheDeSuprimentos({ esgotou: true, deficit: 0.5, restante: 0 })).toMatch(/faltaram 0,5/i);
    expect(detalheDeSuprimentos({ esgotou: false, deficit: 0, restante: 3 })).toBe("");
    expect(detalheDeSuprimentos(null)).toBe("");
    expect(avisoDeSuprimentos({ esgotou: false, deficit: 0, restante: 3 })).toBe("");
    expect(avisoDeSuprimentos(null)).toBe("");
  });

  it("a assinatura é estável para o mesmo conteúdo — é o que segura o 'decidir depois'", () => {
    const a = montarPendencia({ origem: "viagem", trilhaId: "t1", chance: 0.4, rolagem: 0.1, sugestao: EV_LOBOS });
    const b = montarPendencia({ origem: "viagem", trilhaId: "t1", chance: 0.4, rolagem: 0.1, sugestao: EV_LOBOS });
    expect(assinaturaDaPendencia(a)).toBe(assinaturaDaPendencia(b));
    expect(assinaturaDaPendencia(null)).toBe("");
    expect(temPendencia({ pendingEncounter: a })).toBe(true);
    expect(temPendencia({ pendingEncounter: null })).toBe(false);
  });

  it("o perigo da região é do mestre, com padrão baixo e teto na escala do editor", () => {
    expect(perigoDaRegiao(null)).toBe(1);
    expect(perigoDaRegiao({ flags: { [MARCA_DO_PERIGO]: 4 } })).toBe(4);
    expect(perigoDaRegiao({ flags: { [MARCA_DO_PERIGO]: 99 } })).toBe(5);
    expect(perigoDaRegiao({ flags: { [MARCA_DO_PERIGO]: -3 } })).toBe(0);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · O SORTEIO PARA NA MÃO DO MESTRE  (briefing §9)
 * ════════════════════════════════════════════════════════════════════ */
describe("o encontro da estrada", () => {
  it("a viagem por trilha perigosa pausa a mesa e grava a pendência em `gm`", async () => {
    comSorte(0);                                  // d100 = 1 → fração 0 → rolou
    montarMestre();

    fireEvent.click(await screen.findByTestId("wmm-destino-n2"));

    await waitFor(() => expect(ultimaPendencia()).toBeTruthy());
    const p = ultimaPendencia();
    expect(p.origem).toBe("viagem");
    expect(p.trilhaId).toBe("t1");
    expect(p.periodo).toBe("noite");              // partiu às 20h
    expect(p.chance).toBeGreaterThan(0);
    expect(p.sugestao.id).toBe("ev-lobos");

    /* E a mesa PAROU — no documento do grupo, sem motivo nenhum junto. */
    await waitFor(() => expect(ultimasFlags()).toEqual({ [MARCA_DA_PAUSA]: true }));

    /* Nada foi publicado para o grupo: nenhuma escrita em `revealed/` carrega
       evento nesta viagem (a chegada publica NÓS, não o encontro). */
    expect(eventosPublicados()).toHaveLength(0);
  });

  it("estrada de perigo 0 não pausa nada, aconteça o que acontecer no dado", async () => {
    comSorte(0);
    montarMestre();

    fireEvent.click(await screen.findByTestId("wmm-destino-n3"));
    /* O sinal de "a chegada aconteceu" é o FECHO da viagem: desde a F7 é ele
       que paga a estrada (relógio e comida), não mais um `atualizarParty`. */
    await waitFor(() => expect(concluirViagem).toHaveBeenCalled());

    expect(ultimaPendencia()).toBeUndefined();
    expect(ultimasFlags()).toBeUndefined();
  });

  it("o diálogo mostra a conta, o que saiu e as três decisões", async () => {
    const pendencia = montarPendencia({
      origem: "viagem", trilhaId: "t1", noId: "n2", periodo: "noite",
      chance: 0.4, rolagem: 0.12, sugestao: EV_LOBOS,
    });
    comCenario({ party: partyEm("n2", { flags: { [MARCA_DA_PAUSA]: true } }), gm: { pendingEncounter: pendencia } });
    montarMestre();

    const dialogo = await screen.findByTestId("wmm-encontro-do-mestre");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("wmm-encontro-rolagem")).toHaveTextContent("40%");
    expect(screen.getByTestId("wmm-encontro-rolagem")).toHaveTextContent("12");
    expect(screen.getByTestId("wmm-encontro-sugestao")).toHaveTextContent("Lobos na neblina");
    ["aceitar", "trocar", "ignorar"].forEach((d) => {
      expect(screen.getByTestId(`wmm-encontro-${d}`)).toBeInTheDocument();
    });
  });

  it("Esc não decide: fecha o diálogo e deixa a pendência e a pausa de pé", async () => {
    const pendencia = montarPendencia({ chance: 0.4, rolagem: 0.1, sugestao: EV_LOBOS });
    comCenario({ party: partyEm("n2", { flags: { [MARCA_DA_PAUSA]: true } }), gm: { pendingEncounter: pendencia } });
    montarMestre();

    await screen.findByTestId("wmm-encontro-do-mestre");
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByTestId("wmm-encontro-do-mestre")).not.toBeInTheDocument());
    expect(resolverPendencia).not.toHaveBeenCalled();
    expect(publicarRevelacao).not.toHaveBeenCalled();
    /* E há como voltar a ela — senão a mesa ficaria parada sem destravamento. */
    expect(screen.getByTestId("wmm-reabrir-encontro")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wmm-reabrir-encontro"));
    expect(await screen.findByTestId("wmm-encontro-do-mestre")).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · AS TRÊS DECISÕES  (AC-8)
 * ════════════════════════════════════════════════════════════════════ */
describe("o mestre decide", () => {
  const abrirComPendencia = (sugestao = EV_LOBOS) => {
    const pendencia = montarPendencia({
      origem: "viagem", trilhaId: "t1", noId: "n2", periodo: "noite",
      chance: 0.4, rolagem: 0.1, sugestao,
    });
    comCenario({
      party: partyEm("n2", { flags: { [MARCA_DA_PAUSA]: true } }),
      gm: { pendingEncounter: pendencia, triggeredEventIds: [] },
    });
    return montarMestre();
  };

  it("ACEITAR publica só as três chaves públicas, e nada do texto do mestre", async () => {
    abrirComPendencia();
    fireEvent.click(await screen.findByTestId("wmm-encontro-aceitar"));

    await waitFor(() => expect(publicarRevelacao).toHaveBeenCalled());
    const publicados = eventosPublicados();
    expect(publicados).toHaveLength(1);
    expect(Object.keys(publicados[0]).sort()).toEqual(["id", "playerText", "title"]);
    expect(JSON.stringify(publicados[0])).not.toContain("alfa está ferido");

    /* A pendência é encerrada — pela transação, que é o que a torna ÚNICA — e a
       sugestão é CONSUMIDA (não sai de novo). */
    await waitFor(() => {
      expect(resolverPendencia).toHaveBeenCalled();
      expect(ultimaDecisao().triggeredEventIds).toContain("ev-lobos");
    });
    /* E a viagem volta a andar. */
    await waitFor(() => expect(ultimasFlags()).toEqual({}));
  });

  it("TROCAR publica o que o mestre escreveu, e nunca o encontro descartado", async () => {
    abrirComPendencia();
    fireEvent.click(await screen.findByTestId("wmm-encontro-trocar"));

    fireEvent.change(screen.getByTestId("wmm-encontro-titulo"), { target: { value: "Um sino ao longe" } });
    fireEvent.change(screen.getByTestId("wmm-encontro-texto"), { target: { value: "Alguém toca um sino, três vezes." } });
    fireEvent.click(screen.getByTestId("wmm-encontro-confirmar-troca"));

    await waitFor(() => expect(publicarRevelacao).toHaveBeenCalled());
    const [publicado] = eventosPublicados();
    expect(publicado.title).toBe("Um sino ao longe");
    expect(publicado.playerText).toBe("Alguém toca um sino, três vezes.");
    expect(JSON.stringify(eventosPublicados())).not.toContain("Lobos na neblina");
    /* Trocar não consome a sugestão: o mestre disse "agora não", não "nunca". */
    expect(ultimaDecisao().triggeredEventIds).toBeUndefined();
  });

  it("IGNORAR não deixa rastro nenhum — nem documento, nem id, nem marca", async () => {
    abrirComPendencia();
    fireEvent.click(await screen.findByTestId("wmm-encontro-ignorar"));

    await waitFor(() => expect(resolverPendencia).toHaveBeenCalled());

    /* A prova: NADA foi escrito na coleção que o jogador lê. */
    expect(publicarRevelacao).not.toHaveBeenCalled();
    expect(ultimaDecisao()).toEqual({});
    /* E a única coisa que muda para o grupo é a viagem voltar a andar. */
    await waitFor(() => expect(ultimasFlags()).toEqual({}));
  });

  it("sem nada na gaveta, ACEITAR fica desabilitado — não se inventa um monstro", async () => {
    const pendencia = montarPendencia({ chance: 0.4, rolagem: 0.1 });   // sugestao: null
    comCenario({
      party: partyEm("n2", { flags: { [MARCA_DA_PAUSA]: true } }),
      gm: { pendingEncounter: pendencia },
    });
    montarMestre();

    expect(await screen.findByTestId("wmm-encontro-aceitar")).toBeDisabled();
    expect(screen.getByTestId("wmm-encontro-trocar")).toBeEnabled();
    expect(screen.getByTestId("wmm-encontro-ignorar")).toBeEnabled();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · O QUE O JOGADOR VÊ  — as duas provas que sustentam o AC-8
 * ════════════════════════════════════════════════════════════════════ */
describe("o cliente do jogador durante a pausa", () => {
  const PENDENCIA = montarPendencia({
    origem: "viagem", trilhaId: "t1", noId: "n2", periodo: "noite",
    chance: 0.4, rolagem: 0.1, sugestao: EV_LOBOS,
  });

  it("NÃO assina o documento do mestre — a pendência nem chega pela rede", () => {
    comCenario({ party: partyEm("n2", { flags: { [MARCA_DA_PAUSA]: true } }), gm: { pendingEncounter: PENDENCIA } });
    montarJogador();
    /* `ehMestre = false` → `useGmDaMesa` não abre listener nenhum. Não é
       filtro de render: o documento não é lido. */
    expect(useGmDaMesa).toHaveBeenCalledWith(CAMPANHA, INSTANCIA, false);
    expect(useGrafo).toHaveBeenCalledWith("", "");
    expect(useEventos).toHaveBeenCalledWith("", "");
  });

  it("vê a pausa, e nada do encontro aparece no HTML dele", () => {
    comCenario({ party: partyEm("n2", { flags: { [MARCA_DA_PAUSA]: true } }), gm: { pendingEncounter: PENDENCIA } });
    const { container } = montarJogador();

    expect(screen.getByTestId("wmm-viagem-pausada")).toHaveTextContent(TEXTO_DA_PAUSA);
    const html = container.innerHTML;
    expect(html).not.toContain("Lobos na neblina");
    expect(html).not.toContain("alfa está ferido");
    expect(html).not.toMatch(/encontro|emboscad|rolagem|chance/i);
    /* E o diálogo do mestre não existe no cliente dele. */
    expect(screen.queryByTestId("wmm-encontro-do-mestre")).not.toBeInTheDocument();
  });

  it("os destinos ficam travados enquanto a viagem está parada", () => {
    comCenario({ party: partyEm("n1", { flags: { [MARCA_DA_PAUSA]: true } }) });
    montarJogador();
    expect(screen.getByTestId("wmm-destino-n2")).toBeDisabled();
  });

  /* ── A PROVA DA IDENTIDADE ──────────────────────────────────────────
     O mesmo grupo, a mesma hora, o mesmo mapa. A única diferença entre os
     dois casos é DE ONDE veio a pausa. Se a interface do jogador deixar
     escapar essa diferença — por texto, por atributo, por classe —, este
     teste falha. É a tradução literal de "antes de o jogador ver qualquer
     coisa". */
  it("o HTML do jogador é IDÊNTICO na pausa com encontro e na pausa sem encontro", () => {
    const flagsPausadas = flagsComPausa({}, true);

    comCenario({
      party: partyEm("n2", { flags: flagsPausadas }),
      gm: { pendingEncounter: PENDENCIA },          // houve encontro
    });
    const comEncontro = montarJogador();
    const htmlComEncontro = comEncontro.container.innerHTML;
    comEncontro.unmount();

    comCenario({
      party: partyEm("n2", { flags: flagsPausadas }),
      gm: null,                                     // o mestre só pausou a mão
    });
    const semEncontro = montarJogador();
    expect(semEncontro.container.innerHTML).toBe(htmlComEncontro);
  });

  it("e o documento do grupo é o mesmo nos dois casos — a pausa não guarda porquê", async () => {
    /* Caso A: a pausa nasceu do encontro. */
    comSorte(0);
    const viagem = montarMestre();
    fireEvent.click(await screen.findByTestId("wmm-destino-n2"));
    await waitFor(() => expect(ultimasFlags()).toBeTruthy());
    const flagsDoEncontro = ultimasFlags();
    viagem.unmount();
    jest.clearAllMocks();

    /* Caso B: o mestre parou a viagem com a própria mão. */
    comCenario({ party: partyEm("n1") });
    montarMestre();
    fireEvent.click(screen.getByTestId("wmm-pausar-viagem"));
    await waitFor(() => expect(ultimasFlags()).toBeTruthy());

    expect(JSON.stringify(ultimasFlags())).toBe(JSON.stringify(flagsDoEncontro));
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · O ACAMPAMENTO  (AC-8, AC-10)
 * ════════════════════════════════════════════════════════════════════ */
describe("acampar", () => {
  it("é oferecido em nó de acampamento e recusado com motivo em outro lugar", async () => {
    comCenario({ party: partyEm("n1") });          // n1 é cidade
    const vila = montarMestre();
    expect(await screen.findByTestId("wmm-acampar")).toBeDisabled();
    expect(screen.getByTestId("wmm-acampamento")).toHaveTextContent(MOTIVO_LUGAR_ERRADO);
    vila.unmount();

    comCenario({ party: partyEm("n3") });          // n3 é `camp`
    montarMestre();
    expect(await screen.findByTestId("wmm-acampar")).toBeEnabled();
  });

  it("mostra relógio e suprimentos ANTES e DEPOIS antes de o mestre clicar", async () => {
    comCenario({ party: partyEm("n3") });          // dia 2, 20:00, 5 rações
    montarMestre();

    const previa = await screen.findByTestId("wmm-acampamento-previa");
    expect(previa).toHaveTextContent("Dia 2 · 20:00");
    expect(previa).toHaveTextContent("Dia 3 · 04:00");        // +8 h
    expect(previa).toHaveTextContent("5 rações");
    expect(previa).toHaveTextContent("4,7 rações");           // 8/24 de ração
  });

  it("avança o relógio e come a comida, sem inventar penalidade quando ela acaba", async () => {
    comSorte(0.99);                                // não emboscar
    comCenario({ party: partyEm("n3", { supplies: 0.1, flags: { [MARCA_DO_PERIGO]: 0 } }) });
    montarMestre();

    /* REFINO DE LAYOUT (2026-08-02): a fração saiu da FRASE e foi para o
       atributo "title" — a linha visível diz a consequência, e o resto da
       divisão fica a um hover de distância. Verificado nas duas pontas para
       que o número não possa sumir em silêncio. */
    const avisoDaComida = screen.getByTestId("wmm-acampamento-aviso");
    expect(avisoDaComida).toHaveTextContent(/a comida acabou/i);
    expect(avisoDaComida.getAttribute("title")).toMatch(/faltaram/i);
    expect(avisoDaComida.textContent)
      .not.toMatch(/exaust|fome|-\d|condi[çc]/i);

    fireEvent.click(screen.getByTestId("wmm-acampar"));
    await waitFor(() => expect(atualizarParty).toHaveBeenCalled());

    const patch = atualizarParty.mock.calls.at(-1)[2];
    expect(patch.inGameDatetime).toEqual({ dia: 3, hora: 4, minuto: 0 });
    expect(patch.supplies).toBe(0);
    /* Perigo 0 na região: ninguém aparece, e nada pausa. */
    expect(ultimaPendencia()).toBeUndefined();
  });

  it("a mesa que não conta comida continua sem contar — não se inventa despensa vazia", async () => {
    comSorte(0.99);
    comCenario({ party: partyEm("n3", { supplies: null, flags: { [MARCA_DO_PERIGO]: 0 } }) });
    montarMestre();

    fireEvent.click(await screen.findByTestId("wmm-acampar"));
    await waitFor(() => expect(atualizarParty).toHaveBeenCalled());
    expect("supplies" in atualizarParty.mock.calls.at(-1)[2]).toBe(false);
  });

  it("a emboscada segue o MESMO caminho de duas etapas do encontro da estrada", async () => {
    comSorte(0);                                   // d100 = 1 → emboscou
    comCenario({ party: partyEm("n3", { flags: { [MARCA_DO_PERIGO]: 5 } }) });
    montarMestre();

    fireEvent.click(await screen.findByTestId("wmm-acampar"));
    await waitFor(() => expect(ultimaPendencia()).toBeTruthy());

    const p = ultimaPendencia();
    expect(p.origem).toBe("acampamento");
    expect(p.sugestao.id).toBe("ev-lobos");
    /* Nada foi para o grupo: a emboscada também espera a decisão. */
    expect(eventosPublicados()).toHaveLength(0);
    /* E a pausa foi gravada junto com o relógio, na mesma escrita. */
    const patch = atualizarParty.mock.calls.at(-1)[2];
    expect(patch.flags).toEqual({ [MARCA_DO_PERIGO]: 5, [MARCA_DA_PAUSA]: true });
  });

  it("o painel do acampamento não existe no cliente do jogador", () => {
    comCenario({ party: partyEm("n3") });
    montarJogador();
    expect(screen.queryByTestId("wmm-acampamento")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wmm-pausar-viagem")).not.toBeInTheDocument();
  });
});
