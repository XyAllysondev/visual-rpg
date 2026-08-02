/* ════════════════════════════════════════════════════════════════════
 *  O TEMPO REAL DA MESA  (spec 0028 · F7 · gate do AC-10)
 *  --------------------------------------------------------------------
 *  Três perguntas, e nenhuma delas era respondível antes desta fase:
 *
 *   1. um F5 no meio da estrada devolve o grupo onde ele estava?
 *   2. a viagem transmite DELTA, e não o bitmap inteiro a cada passo?
 *   3. duas telas decidindo o mesmo encontro decidem uma vez só?
 *
 *  Fronteira mockada: só o I/O (`../mesaStore`, `../worldMapStore`). Toda a
 *  política — `model/fogDelta.js`, `Mesa/useNevoaAoVivo.js`,
 *  `Mesa/useViagem.js` — roda de verdade.
 * ════════════════════════════════════════════════════════════════════ */

import React from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
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
  publicarRevelacao, moverGrupo, atualizarParty, atualizarGm, getFundoDaMesa,
  mestreDaInstancia, atualizarViagem, concluirViagem, projecaoDaViagem,
  reservarPendencia, resolverPendencia, salvarDeltaDaNevoa, consolidarNevoaDaMesa,
} from "../mesaStore";
import { useGrafo, useEventos } from "../worldMapStore";
import useNevoaAoVivo from "../Mesa/useNevoaAoVivo";
import {
  clonar, cobrirCirculo, contarReveladas, criarMascara, revelarCirculo, revelarTudo,
} from "../model/fogMask";
import { montarPendencia } from "../model/encontros";
import { MARCA_DA_PAUSA } from "../Mesa/encontrosUi";

const RETANGULO = {
  left: 0, top: 0, width: 900, height: 560, right: 900, bottom: 560, x: 0, y: 0,
  toJSON() { return this; },
};

const MESTRE = "mestre-1";
const CAMPANHA = "camp-1";
const INSTANCIA = `${MESTRE}~mapa-1`;

const INSTANCIAS = [{
  id: INSTANCIA, name: "As Terras Partidas", width: 2400, height: 1600,
  fogEnabled: true, masterUid: MESTRE, startNodeId: "n1", ilustracao: null,
  backgroundRef: null, backgroundUrl: null,
}];

const MOLDE = {
  nos: [
    { id: "n1", name: "Vila Candeia", type: "town", x: 200, y: 200 },
    { id: "n2", name: "Capela Velha", type: "poi", x: 800, y: 400 },
    { id: "n3", name: "Morro do Fogo", type: "poi", x: 1400, y: 250 },
  ],
  trilhas: [
    { id: "t1", fromNodeId: "n1", toNodeId: "n2", travelHours: 6, pathPoints: [{ x: 500, y: 420 }] },
    { id: "t2", fromNodeId: "n2", toNodeId: "n3", travelHours: 3, pathPoints: [] },
  ],
};

const REVELADO = [
  { id: "no_n1", kind: "node", nodeId: "n1", name: "Vila Candeia", type: "town", x: 200, y: 200, state: "visited", description: "", icon: null, color: null },
  { id: "no_n2", kind: "node", nodeId: "n2", name: "Capela Velha", type: "poi", x: 800, y: 400, state: "discovered", description: "", icon: null, color: null },
  { id: "tr_t1", kind: "edge", edgeId: "t1", fromNodeId: "n1", toNodeId: "n2", pathPoints: [{ x: 500, y: 420 }], travelHours: 6, state: "revealed" },
];

const PARTY = {
  id: "estado", currentNodeId: "n1", x: 200, y: 200,
  inGameDatetime: null, supplies: 5, speedModifier: 1, flags: {},
};

let quadros;
let proximoId;

const bombear = (ms) => {
  const pendentes = [...quadros];
  quadros.length = 0;
  act(() => { pendentes.forEach(({ cb }) => cb(ms)); });
};

/** Movimento reduzido ligado = a viagem vira corte seco (o caminho curto). */
const semAnimacao = (reduzido) => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: !!reduzido, addListener() {}, removeListener() {},
  });
};

const comParty = (extra = {}) => {
  useParty.mockReturnValue({ party: { ...PARTY, ...extra }, local: false, loading: false, error: null });
};

beforeEach(() => {
  window.PointerEvent = window.MouseEvent;
  semAnimacao(true);
  jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RETANGULO);
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([]); }
    disconnect() {}
  };
  global.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };

  quadros = [];
  proximoId = 1;
  global.requestAnimationFrame = (cb) => { const id = proximoId++; quadros.push({ id, cb }); return id; };
  global.cancelAnimationFrame = (id) => {
    const i = quadros.findIndex((q) => q.id === id);
    if (i >= 0) quadros.splice(i, 1);
  };

  useInstancias.mockReturnValue({ instancias: INSTANCIAS, loading: false, error: null });
  useReveladoNaMesa.mockReturnValue({
    revelado: REVELADO,
    nos: REVELADO.filter((d) => d.kind === "node"),
    trilhas: REVELADO.filter((d) => d.kind === "edge"),
    eventos: [],
    loading: false,
    error: null,
  });
  comParty();
  useFogDaMesa.mockReturnValue({
    mascara: null, base: null, deltas: [], bytes: 0, rev: 0,
    regrediu: false, local: false, loading: false, error: null,
  });
  useGrafo.mockReturnValue({ nos: MOLDE.nos, trilhas: MOLDE.trilhas, loading: false, error: null });
  useEventos.mockReturnValue({ eventos: [], loading: false, error: null });
  useGmDaMesa.mockReturnValue({ gm: null, loading: false, error: null });
  mestreDaInstancia.mockImplementation((id) => String(id || "").split("~")[0]);

  publicarRevelacao.mockResolvedValue({ gravados: 1, pulados: 0 });
  moverGrupo.mockResolvedValue(undefined);
  atualizarParty.mockResolvedValue(undefined);
  atualizarGm.mockResolvedValue(undefined);
  getFundoDaMesa.mockResolvedValue(null);
  concluirViagem.mockResolvedValue({ aplicou: true, motivo: "" });
  atualizarViagem.mockResolvedValue(undefined);
  projecaoDaViagem.mockImplementation((v, extra = {}) => ({ ...(v || {}), ...extra }));
  reservarPendencia.mockImplementation(async (_c, _i, p) => ({ reservada: true, motivo: "", pendencia: p }));
  resolverPendencia.mockImplementation(async () => ({ decidida: true, motivo: "", pendencia: null }));
  salvarDeltaDaNevoa.mockImplementation(async (_c, _i, _m, o = {}) => ({
    id: `d_00000${o.n || 1}_x`, bytes: 12,
  }));
  consolidarNevoaDaMesa.mockResolvedValue({ bytes: 120, apagados: 0 });
});

afterEach(() => { jest.restoreAllMocks(); });

const montarMestre = (props = {}) => render(
  <MesaDoMapaMundi campaignId={CAMPANHA} uid={MESTRE} isMaster {...props} />,
);

/* ════════════════════════════════════════════════════════════════════
 *  1 · A NÉVOA EM DELTAS  (o coração do AC-10)
 * ══════════════════════════════════════════════════════════════════ */

describe("a névoa trafega em deltas", () => {
  const MUNDO = { largura: 1200, altura: 800 };

  /** Monta o canal de transmissão com uma máscara viva, como a Mesa faz. */
  const canal = (mascara) => {
    let revisao = 1;
    const r = renderHook(({ m, rev }) => useNevoaAoVivo({
      campaignId: CAMPANHA, instanciaId: INSTANCIA, mascara: m, revisao: rev, ativo: true,
    }), { initialProps: { m: mascara, rev: revisao } });
    return {
      ...r,
      mexer: (fn) => {
        fn(mascara);
        revisao += 1;
        r.rerender({ m: mascara, rev: revisao });
      },
    };
  };

  it("a PRIMEIRA escrita é a máscara inteira; da segunda em diante, delta", async () => {
    const m = criarMascara(MUNDO.largura, MUNDO.altura);
    revelarCirculo(m, 200, 200, 60);
    const c = canal(m);

    await act(async () => { await c.result.current.transmitir(); });
    expect(consolidarNevoaDaMesa).toHaveBeenCalledTimes(1);
    expect(salvarDeltaDaNevoa).not.toHaveBeenCalled();

    c.mexer((mask) => revelarCirculo(mask, 900, 600, 60));
    await act(async () => { await c.result.current.transmitir(); });

    expect(salvarDeltaDaNevoa).toHaveBeenCalledTimes(1);
    expect(consolidarNevoaDaMesa).toHaveBeenCalledTimes(1);   // NÃO gravou o bitmap de novo
  });

  it("a chegada consolida e leva os ids dos deltas daquela viagem para apagar", async () => {
    const m = criarMascara(MUNDO.largura, MUNDO.altura);
    revelarCirculo(m, 100, 100, 40);
    const c = canal(m);

    await act(async () => { await c.result.current.transmitir(); });          // base
    c.mexer((mask) => revelarCirculo(mask, 400, 300, 40));
    await act(async () => { await c.result.current.transmitir(); });          // delta 1
    c.mexer((mask) => revelarCirculo(mask, 700, 500, 40));
    await act(async () => { await c.result.current.transmitir(); });          // delta 2
    expect(salvarDeltaDaNevoa).toHaveBeenCalledTimes(2);

    c.mexer((mask) => revelarCirculo(mask, 900, 700, 40));
    await act(async () => { await c.result.current.transmitir({ fim: true }); });

    const [, , , opcoes] = consolidarNevoaDaMesa.mock.calls.at(-1);
    expect(opcoes.deltas).toEqual(["d_000001_x", "d_000002_x"]);
    expect(opcoes.regrediu).toBe(false);
  });

  it("RECOBRIR sai consolidado e marcado, nunca como delta", async () => {
    const m = criarMascara(MUNDO.largura, MUNDO.altura);
    revelarTudo(m);
    const c = canal(m);

    await act(async () => { await c.result.current.transmitir(); });          // base
    c.mexer((mask) => cobrirCirculo(mask, 600, 400, 120));                    // o pincel apaga
    await act(async () => { await c.result.current.transmitir(); });

    expect(salvarDeltaDaNevoa).not.toHaveBeenCalled();
    expect(consolidarNevoaDaMesa).toHaveBeenCalledTimes(2);
    expect(consolidarNevoaDaMesa.mock.calls.at(-1)[3].regrediu).toBe(true);
  });

  it("nada mudou, nada é transmitido", async () => {
    const m = criarMascara(MUNDO.largura, MUNDO.altura);
    revelarCirculo(m, 200, 200, 60);
    const c = canal(m);

    await act(async () => { await c.result.current.transmitir(); });
    const r = await act(async () => c.result.current.transmitir());
    expect(r.tipo).toBe("nada");
    expect(salvarDeltaDaNevoa).not.toHaveBeenCalled();
  });

  it("escrita que FALHA não perde revelação: ela volta no delta seguinte", async () => {
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    const m = criarMascara(MUNDO.largura, MUNDO.altura);
    revelarCirculo(m, 200, 200, 60);
    const c = canal(m);

    await act(async () => { await c.result.current.transmitir(); });          // base ok
    const naBase = contarReveladas(m);

    salvarDeltaDaNevoa.mockRejectedValueOnce(new Error("rede caiu"));
    c.mexer((mask) => revelarCirculo(mask, 900, 600, 60));
    await act(async () => { await c.result.current.transmitir(); });          // falhou

    /* A máscara local continua com tudo: a mesa não travou nem desfez o que o
       grupo já viu abrir na tela. */
    expect(contarReveladas(m)).toBeGreaterThan(naBase);

    c.mexer((mask) => revelarCirculo(mask, 950, 650, 20));
    await act(async () => { await c.result.current.transmitir(); });

    /* O delta seguinte carrega TUDO que a base ainda não tem — inclusive o que
       a escrita que falhou levaria. Nada precisou de fila nem de retry: é a
       união fazendo o trabalho. */
    const enviado = salvarDeltaDaNevoa.mock.calls.at(-1)[2];
    expect(contarReveladas(enviado)).toBe(contarReveladas(m) - naBase);
    expect(contarReveladas(enviado)).toBeGreaterThan(0);
    erro.mockRestore();
  });

  it("o que chegou do servidor não é reenviado", async () => {
    const m = criarMascara(MUNDO.largura, MUNDO.altura);
    revelarCirculo(m, 200, 200, 60);
    const c = canal(m);

    /* Chegou de outro cliente e já foi absorvido na máscara local. */
    const remota = clonar(m);
    act(() => { c.result.current.registrarRemota(remota, true); });

    const r = await act(async () => c.result.current.transmitir());
    expect(r.tipo).toBe("nada");
    expect(salvarDeltaDaNevoa).not.toHaveBeenCalled();
    expect(consolidarNevoaDaMesa).not.toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · A VIAGEM PERSISTIDA
 * ══════════════════════════════════════════════════════════════════ */

describe("a viagem sobrevive ao recarregamento", () => {
  it("partir grava o percurso JUNTO do destino (`party.viagem`)", async () => {
    montarMestre();
    fireEvent.click(await screen.findByTestId("wmm-destino-n2"));

    await waitFor(() => expect(moverGrupo).toHaveBeenCalled());
    const [, , destino] = moverGrupo.mock.calls.at(-1);
    expect(destino.nodeId).toBe("n2");
    expect(destino.viagem).toEqual(expect.objectContaining({
      deId: "n1", paraId: "n2", trilhaId: "t1", progresso: 0,
    }));
    expect(destino.viagem.id).toEqual(expect.any(String));
  });

  it("abrir a mesa com viagem em curso RETOMA o percurso — não teleporta", async () => {
    /* É o F5 no meio da estrada: a mesa nasce sem nada na memória e o único
       lugar que sabe onde o grupo estava é `party.viagem`. */
    comParty({
      currentNodeId: "n2",
      viagem: {
        id: "v-em-curso", deId: "n1", paraId: "n2", trilhaId: "t1",
        progresso: 0.5, iniciadaEm: 1000, horas: 6,
      },
    });
    montarMestre();

    /* Retomou a MESMA viagem (o id atravessou), e o fecho confere esse id. */
    await waitFor(() => expect(concluirViagem).toHaveBeenCalledWith(
      CAMPANHA, INSTANCIA, "v-em-curso", expect.any(Object),
    ));
    /* E não regravou o movimento: quem retoma não repete a partida. */
    expect(moverGrupo).not.toHaveBeenCalled();
  });

  it("retomar não vira laço: o eco do mesmo documento não abre outra viagem", async () => {
    comParty({
      currentNodeId: "n2",
      viagem: { id: "v-1", deId: "n1", paraId: "n2", trilhaId: "t1", progresso: 0.2, horas: 6 },
    });
    const { rerender } = montarMestre();
    await waitFor(() => expect(concluirViagem).toHaveBeenCalledTimes(1));

    rerender(<MesaDoMapaMundi campaignId={CAMPANHA} uid={MESTRE} isMaster />);
    await act(async () => {});
    expect(concluirViagem).toHaveBeenCalledTimes(1);
  });

  it("sem `party.viagem` a mesa ainda reconstrói o percurso pelo destino (F4)", async () => {
    /* Mesa antiga (ou movimento à força do mestre): o documento não diz por
       qual trilha o grupo foi, e o caminho da F4 continua valendo. */
    const { rerender } = montarMestre();
    await screen.findByTestId("wmm-destino-n2");

    comParty({ currentNodeId: "n2" });
    rerender(<MesaDoMapaMundi campaignId={CAMPANHA} uid={MESTRE} isMaster />);

    await waitFor(() => expect(screen.getByTestId("wmm-anuncio")).toHaveTextContent(/Capela Velha/i));
    expect(concluirViagem).toHaveBeenCalled();
  });

  it("a chegada de OUTRA tela não adianta o relógio duas vezes", async () => {
    concluirViagem.mockResolvedValue({ aplicou: false, motivo: "ja-concluida" });
    comParty({
      currentNodeId: "n2",
      viagem: { id: "v-2", deId: "n1", paraId: "n2", trilhaId: "t1", progresso: 0.9, horas: 6 },
    });
    montarMestre();

    await waitFor(() => expect(concluirViagem).toHaveBeenCalled());
    /* Nada de encontro, nada de consolidação de névoa: esta tela chegou
       depois e não paga a estrada de novo. */
    await act(async () => {});
    expect(reservarPendencia).not.toHaveBeenCalled();
  });
});

describe("acampar em trânsito deixa de ser letra morta", () => {
  it("a pausa para o marcador no meio da estrada e o acampamento libera", async () => {
    semAnimacao(false);                       // com percurso animado
    comParty({ flags: {} });
    const { rerender } = montarMestre();

    fireEvent.click(await screen.findByTestId("wmm-destino-n2"));
    bombear(16);                              // o grupo saiu da vila

    /* O mestre pausa: a viagem para ONDE ESTÁ. */
    comParty({ flags: { [MARCA_DA_PAUSA]: true } });
    rerender(<MesaDoMapaMundi campaignId={CAMPANHA} uid={MESTRE} isMaster />);

    await waitFor(() => expect(screen.getByTestId("wmm-acampar")).not.toBeDisabled());
    /* E o andamento foi gravado — senão um F5 aqui perderia o trecho andado. */
    await waitFor(() => expect(atualizarViagem).toHaveBeenCalled());
    expect(concluirViagem).not.toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · A DECISÃO ÚNICA DO ENCONTRO
 * ══════════════════════════════════════════════════════════════════ */

describe("duas abas do mestre decidindo o mesmo encontro", () => {
  const abrir = () => {
    const pendencia = {
      ...montarPendencia({
        origem: "viagem", trilhaId: "t1", noId: "n2", periodo: "noite",
        chance: 0.4, rolagem: 0.1,
        sugestao: { id: "ev-lobos", title: "Lobos na neblina", playerText: "Uivos." },
      }),
      id: "pend-1",
    };
    comParty({ currentNodeId: "n2", flags: { [MARCA_DA_PAUSA]: true } });
    useGmDaMesa.mockReturnValue({
      gm: { pendingEncounter: pendencia, triggeredEventIds: [] }, loading: false, error: null,
    });
    return montarMestre();
  };

  it("a aba que ganha REIVINDICA antes de publicar — a ordem é o mecanismo", async () => {
    abrir();
    fireEvent.click(await screen.findByTestId("wmm-encontro-aceitar"));

    await waitFor(() => expect(publicarRevelacao).toHaveBeenCalled());
    expect(resolverPendencia).toHaveBeenCalledWith(
      CAMPANHA, INSTANCIA, "pend-1", expect.objectContaining({ triggeredEventIds: ["ev-lobos"] }),
    );
    /* Reivindicar vem ANTES de publicar: invertido, as duas abas publicariam. */
    const ordemDaReivindicacao = resolverPendencia.mock.invocationCallOrder[0];
    const ordemDaPublicacao = publicarRevelacao.mock.invocationCallOrder[0];
    expect(ordemDaReivindicacao).toBeLessThan(ordemDaPublicacao);
  });

  it("a aba que PERDE não publica nada, e vê a pendência sumir", async () => {
    resolverPendencia.mockResolvedValue({ decidida: false, motivo: "ja-decidida", pendencia: null });
    abrir();
    fireEvent.click(await screen.findByTestId("wmm-encontro-aceitar"));

    await waitFor(() => expect(resolverPendencia).toHaveBeenCalled());
    expect(publicarRevelacao).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("wmm-anuncio"))
      .toHaveTextContent(/já foi resolvido em outra tela/i));
    await waitFor(() => expect(screen.queryByTestId("wmm-encontro-do-mestre")).not.toBeInTheDocument());
  });

  it("publicação que falha DEVOLVE a pendência para a fila do mestre", async () => {
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    publicarRevelacao.mockRejectedValue(new Error("rede caiu"));
    resolverPendencia.mockImplementation(async () => ({
      decidida: true, motivo: "", pendencia: { id: "pend-1", origem: "viagem" },
    }));
    abrir();
    fireEvent.click(await screen.findByTestId("wmm-encontro-aceitar"));

    await waitFor(() => expect(atualizarGm).toHaveBeenCalledWith(
      CAMPANHA, INSTANCIA,
      expect.objectContaining({ pendingEncounter: expect.objectContaining({ id: "pend-1" }) }),
    ));
    erro.mockRestore();
  });
});
