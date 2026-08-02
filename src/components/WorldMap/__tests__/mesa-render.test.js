/* ════════════════════════════════════════════════════════════════════
 *  A MESA NA TELA — GATE DOS DOIS PAPÉIS  (spec 0028 · F4 · AC-6/8/10/11)
 *  --------------------------------------------------------------------
 *  Fronteira mockada: só o I/O — `../mesaStore` e `../worldMapStore`. Toda
 *  a regra (`model/revelacao.js`, `model/viagem.js`, `model/fogMask.js`) e
 *  toda a tradução (`Mesa/mesaUi.js`) rodam de VERDADE: quem decide o que é
 *  visível, o que é clicável e o que a névoa abre é o código de produção.
 *
 *  O jsdom não tem canvas 2D (`getContext` devolve `null`) nem
 *  `requestAnimationFrame` com relógio real — os dois são dublados aqui, e
 *  o rAF é BOMBEADO À MÃO para a viagem poder ser inspecionada quadro a
 *  quadro. É a única forma honesta de testar "a névoa abre AO LONGO do
 *  caminho, não só na chegada".
 *
 *  O preset do CRA roda com `resetMocks: true`: tudo é reinstalado no
 *  `beforeEach`.
 * ════════════════════════════════════════════════════════════════════ */

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../mesaStore", () => ({
  useInstancias: jest.fn(),
  useReveladoNaMesa: jest.fn(),
  useParty: jest.fn(),
  useFogDaMesa: jest.fn(),
  publicarRevelacao: jest.fn(),
  moverGrupo: jest.fn(),
  atualizarParty: jest.fn(),
  salvarFogDaMesa: jest.fn(),
  getFundoDaMesa: jest.fn(),
  mestreDaInstancia: jest.fn(),
  /* F5: a mesa passou a ler o painel do mestre (`gm/estado`) e a marcar nele
     o que já disparou. O dublê acompanha; o gate dos eventos é
     `evento-mesa.test.js`. */
  useGmDaMesa: jest.fn(),
  atualizarGm: jest.fn(),
}));

jest.mock("../worldMapStore", () => ({
  useGrafo: jest.fn(),
  useEventos: jest.fn(),
}));

import MesaDoMapaMundi from "../Mesa";
import {
  useInstancias, useReveladoNaMesa, useParty, useFogDaMesa,
  publicarRevelacao, moverGrupo, atualizarParty, salvarFogDaMesa, getFundoDaMesa,
  mestreDaInstancia, useGmDaMesa, atualizarGm,
} from "../mesaStore";
import { useGrafo, useEventos } from "../worldMapStore";
import { criarMascara, contarReveladas } from "../model/fogMask";

/* ── Geometria fingida: o jsdom devolve tudo zerado ──────────────────── */
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
  fogEnabled: true, masterUid: MESTRE, startNodeId: "n1", ilustracao: null,
  backgroundRef: null, backgroundUrl: null,
}];

/* O molde do mestre: quatro lugares, e um deles atrás de trilha secreta. */
const MOLDE = {
  nos: [
    { id: "n1", name: "Vila Candeia", type: "town", x: 200, y: 200 },
    { id: "n2", name: "Capela Velha", type: "poi", x: 800, y: 400 },
    { id: "n3", name: "Morro do Fogo", type: "poi", x: 1400, y: 250, rumorLabel: "Fogo no morro." },
    { id: "n4", name: "Cripta Selada", type: "secret", x: 900, y: 900 },
  ],
  trilhas: [
    { id: "t1", fromNodeId: "n1", toNodeId: "n2", travelHours: 6, pathPoints: [{ x: 500, y: 420 }] },
    { id: "t2", fromNodeId: "n2", toNodeId: "n3", travelHours: 3, pathPoints: [] },
    { id: "t3", fromNodeId: "n2", toNodeId: "n4", travelHours: 1, pathPoints: [], isSecret: true },
  ],
};

/* O que a mesa já revelou: a vila visitada, a capela descoberta, a trilha
   entre as duas revelada. A cripta e a trilha secreta NÃO estão aqui — e é
   por isso que o cliente do jogador não as tem. */
const REVELADO = [
  { id: "no_n1", kind: "node", nodeId: "n1", name: "Vila Candeia", type: "town", x: 200, y: 200, state: "visited", description: "", icon: null, color: null },
  { id: "no_n2", kind: "node", nodeId: "n2", name: "Capela Velha", type: "poi", x: 800, y: 400, state: "discovered", description: "", icon: null, color: null },
  { id: "tr_t1", kind: "edge", edgeId: "t1", fromNodeId: "n1", toNodeId: "n2", pathPoints: [{ x: 500, y: 420 }], travelHours: 6, state: "revealed" },
];

const PARTY = { id: "estado", currentNodeId: "n1", x: 200, y: 200, inGameDatetime: null, supplies: 5, speedModifier: 1, flags: {} };

/* ── O rAF bombeado à mão ────────────────────────────────────────────── */
let quadros;
let proximoId;

function bombear(ms) {
  const pendentes = [...quadros];
  quadros.length = 0;
  act(() => { pendentes.forEach(({ cb }) => cb(ms)); });
}

beforeEach(() => {
  window.PointerEvent = window.MouseEvent;
  jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RETANGULO);
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([]); }
    disconnect() {}
  };
  global.IntersectionObserver = class {
    observe() {} disconnect() {} unobserve() {}
  };

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
  useParty.mockReturnValue({ party: PARTY, loading: false, error: null });
  useFogDaMesa.mockReturnValue({ mascara: null, bytes: 0, loading: false, error: null });
  useGrafo.mockReturnValue({ nos: MOLDE.nos, trilhas: MOLDE.trilhas, loading: false, error: null });
  useEventos.mockReturnValue({ eventos: [], loading: false, error: null });
  useGmDaMesa.mockReturnValue({ gm: null, loading: false, error: null });
  atualizarGm.mockResolvedValue(undefined);
  mestreDaInstancia.mockImplementation((id) => String(id || "").split("~")[0]);

  publicarRevelacao.mockResolvedValue({ gravados: 2, pulados: 0 });
  moverGrupo.mockResolvedValue(undefined);
  atualizarParty.mockResolvedValue(undefined);
  salvarFogDaMesa.mockResolvedValue({ bytes: 10 });
  getFundoDaMesa.mockResolvedValue(null);
});

afterEach(() => { jest.restoreAllMocks(); });

const montarMestre = (props = {}) => render(
  <MesaDoMapaMundi campaignId={CAMPANHA} uid={MESTRE} isMaster {...props} />,
);
const montarJogador = (props = {}) => render(
  <MesaDoMapaMundi campaignId={CAMPANHA} uid={JOGADOR} isMaster={false} {...props} />,
);

/* ════════════════════════════════════════════════════════════════════
 *  O JOGADOR  (AC-8)
 * ══════════════════════════════════════════════════════════════════ */

describe("a mesa do jogador", () => {
  it("desenha só o que já foi revelado — o oculto não chega nem ao DOM (AC-1)", () => {
    montarJogador();
    expect(screen.getByTestId("wmm-no-n1")).toBeInTheDocument();
    expect(screen.getByTestId("wmm-no-n2")).toBeInTheDocument();
    expect(screen.queryByTestId("wmm-no-n4")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("Cripta Selada");
  });

  it("mostra o marcador do grupo, o relógio e os suprimentos", () => {
    montarJogador();
    expect(screen.getByTestId("wmm-marcador")).toBeInTheDocument();
    expect(screen.getByText("Dia 1 · 00:00")).toBeInTheDocument();
    expect(screen.getByText("5 rações")).toBeInTheDocument();
  });

  it("não tem console do mestre, nem painel de cenas, nem de camadas (spec 0007 AC-2)", () => {
    montarJogador();
    expect(screen.queryByTestId("wmm-revelar-agora")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wmm-visao-do-jogador")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /console do mestre/i })).not.toBeInTheDocument();
  });

  it("oferece o nó adjacente por trilha revelada como destino", () => {
    montarJogador();
    expect(screen.getByTestId("wmm-destino-n2")).toBeInTheDocument();
    expect(screen.getByTestId("wmm-no-n2")).toHaveAttribute("data-destino", "sim");
  });

  it("nó sem trilha revelada não é porta: recusa com a frase de `podeViajarPara`", () => {
    /* O rumor entra no revelado, mas nenhuma trilha chega até ele. */
    useReveladoNaMesa.mockReturnValue({
      revelado: [
        ...REVELADO,
        { id: "no_n3", kind: "node", nodeId: "n3", x: 1400, y: 250, state: "rumored", rumorLabel: "Fogo no morro." },
      ],
      nos: [], trilhas: [], eventos: [], loading: false, error: null,
    });
    montarJogador();

    const rumor = screen.getByTestId("wmm-no-n3");
    expect(rumor).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(rumor);
    expect(screen.getByTestId("wmm-aviso-do-grupo"))
      .toHaveTextContent("Não há caminho conhecido daqui até lá.");
    expect(moverGrupo).not.toHaveBeenCalled();
  });

  it("o rumor não entrega o nome do lugar", () => {
    useReveladoNaMesa.mockReturnValue({
      revelado: [
        ...REVELADO,
        { id: "no_n3", kind: "node", nodeId: "n3", x: 1400, y: 250, state: "rumored", rumorLabel: "Fogo no morro." },
      ],
      nos: [], trilhas: [], eventos: [], loading: false, error: null,
    });
    montarJogador();
    expect(document.body.innerHTML).not.toContain("Morro do Fogo");
    expect(screen.getByTestId("wmm-no-n3")).toHaveAttribute("title", "Fogo no morro.");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  A VIAGEM  (o pedido do Andre)
 * ══════════════════════════════════════════════════════════════════ */

describe("a viagem", () => {
  it("percorre a linha e abre a névoa AO LONGO do caminho, não só na chegada", async () => {
    const mascara = criarMascara(2400, 1600);
    useFogDaMesa.mockReturnValue({ mascara, bytes: 0, loading: false, error: null });

    montarJogador();
    expect(contarReveladas(mascara)).toBe(0);

    fireEvent.click(screen.getByTestId("wmm-destino-n2"));

    // Primeiro quadro: o grupo mal saiu — mas a névoa JÁ abriu na saída.
    bombear(0);
    const naSaida = contarReveladas(mascara);
    expect(naSaida).toBeGreaterThan(0);

    // Um pedaço do caminho: mais névoa aberta, e o marcador ainda a caminho.
    bombear(300);
    const noMeio = contarReveladas(mascara);
    expect(noMeio).toBeGreaterThan(naSaida);
    expect(screen.getByTestId("wmm-marcador")).toHaveAttribute("data-viajando", "sim");

    // Até chegar. O `dt` é grampeado, então a chegada leva vários quadros.
    for (let t = 600; t <= 6000 && screen.queryByTestId("wmm-marcador")?.getAttribute("data-viajando"); t += 100) {
      bombear(t);
    }
    expect(contarReveladas(mascara)).toBeGreaterThan(noMeio);
  });

  it("grava o movimento do grupo na PARTIDA, para o outro cliente animar junto", () => {
    montarJogador();
    fireEvent.click(screen.getByTestId("wmm-destino-n2"));
    expect(moverGrupo).toHaveBeenCalledWith(CAMPANHA, INSTANCIA, expect.objectContaining({
      nodeId: "n2", x: 800, y: 400, quem: JOGADOR,
    }));
  });

  it("anuncia a partida em `aria-live` (AC-11)", () => {
    montarJogador();
    fireEvent.click(screen.getByTestId("wmm-destino-n2"));
    expect(screen.getByTestId("wmm-anuncio")).toHaveTextContent("O grupo partiu para Capela Velha.");
  });

  it("cancela o quadro pendente ao desmontar — nada anima numa tela morta", () => {
    const { unmount } = montarJogador();
    fireEvent.click(screen.getByTestId("wmm-destino-n2"));
    bombear(0);
    expect(quadros.length).toBeGreaterThan(0);
    unmount();
    expect(quadros).toHaveLength(0);
  });

  it("com `prefers-reduced-motion` a viagem é instantânea, mas a névoa abre igual (AC-11)", () => {
    const mascara = criarMascara(2400, 1600);
    useFogDaMesa.mockReturnValue({ mascara, bytes: 0, loading: false, error: null });
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addListener() {}, removeListener() {} });

    montarJogador();
    fireEvent.click(screen.getByTestId("wmm-destino-n2"));

    // Nenhum quadro foi pedido: não há percurso animado.
    expect(quadros).toHaveLength(0);
    // E, ainda assim, a névoa do caminho inteiro está aberta.
    expect(contarReveladas(mascara)).toBeGreaterThan(0);
    expect(screen.getByTestId("wmm-marcador")).not.toHaveAttribute("data-viajando");
  });

  it("o mestre publica a revelação da chegada e faz o relógio andar (AC-6, AC-10)", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addListener() {}, removeListener() {} });
    montarMestre();

    fireEvent.click(screen.getByTestId("wmm-mestre-destino-n2"));

    await waitFor(() => expect(publicarRevelacao).toHaveBeenCalled());
    const [, , conteudo] = publicarRevelacao.mock.calls[0];

    // A capela vira `visited`; a trilha percorrida vira `traveled`; o morro
    // entra como `discovered` — e NADA além disso (AC-6).
    expect(conteudo.nos.find((x) => x.no.id === "n2").state).toBe("visited");
    expect(conteudo.nos.find((x) => x.no.id === "n3").state).toBe("discovered");
    expect(conteudo.trilhas.find((x) => x.trilha.id === "t1").state).toBe("traveled");
    // A CRIPTA fica de fora: a trilha até ela é secreta.
    expect(conteudo.nos.find((x) => x.no.id === "n4")).toBeUndefined();
    expect(conteudo.trilhas.find((x) => x.trilha.id === "t3")).toBeUndefined();

    await waitFor(() => expect(atualizarParty).toHaveBeenCalledWith(
      CAMPANHA, INSTANCIA,
      expect.objectContaining({ inGameDatetime: { dia: 1, hora: 6, minuto: 0 } }),
    ));
    // Seis horas de estrada custam um quarto de ração por dia de consumo.
    expect(atualizarParty.mock.calls[0][2].supplies).toBeCloseTo(4.75, 5);
  });

  it("o jogador NÃO publica revelação — só o mestre alcança o molde (design §3)", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addListener() {}, removeListener() {} });
    montarJogador();
    fireEvent.click(screen.getByTestId("wmm-destino-n2"));
    await waitFor(() => expect(moverGrupo).toHaveBeenCalled());
    expect(publicarRevelacao).not.toHaveBeenCalled();
    expect(atualizarParty).not.toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  O CONSOLE DO MESTRE  (AC-8)
 * ══════════════════════════════════════════════════════════════════ */

describe("o console do mestre", () => {
  it("mostra o mapa inteiro, inclusive o que o grupo não viu", () => {
    montarMestre();
    expect(screen.getByTestId("wmm-no-n4")).toBeInTheDocument();
    expect(screen.getByText("Visão do mestre")).toBeInTheDocument();
  });

  it("deixa óbvio o que ainda está oculto — é o que ele tem para dar", () => {
    montarMestre();
    // n3 e n4 ocultos; t2 e t3 ocultas.
    expect(screen.getByTestId("wmm-contagem-oculta")).toHaveTextContent("4 ocultos");
    expect(screen.getByLabelText(/Lugar Cripta Selada.*segredo/i)).toBeInTheDocument();
  });

  it("'Revelar agora' publica o que o mestre escolheu, no degrau escolhido", async () => {
    montarMestre();

    fireEvent.click(screen.getByLabelText(/Lugar Cripta Selada/i));
    fireEvent.click(screen.getByTestId("wmm-revelar-agora"));

    await waitFor(() => expect(publicarRevelacao).toHaveBeenCalled());
    const [, , conteudo] = publicarRevelacao.mock.calls[0];
    expect(conteudo.nos).toHaveLength(1);
    expect(conteudo.nos[0].no.id).toBe("n4");
    expect(conteudo.nos[0].state).toBe("discovered");
  });

  it("revela a trilha SECRETA quando o mestre manda — é o caminho legítimo (AC-6)", async () => {
    montarMestre();
    fireEvent.click(screen.getByLabelText(/Trilha Capela Velha ↔ Cripta Selada/i));
    fireEvent.click(screen.getByTestId("wmm-revelar-agora"));

    await waitFor(() => expect(publicarRevelacao).toHaveBeenCalled());
    const [, , conteudo] = publicarRevelacao.mock.calls[0];
    expect(conteudo.trilhas[0].trilha.id).toBe("t3");
    expect(conteudo.trilhas[0].state).toBe("revealed");
  });

  it("abre a névoa em volta do que liberou, e grava a névoa da mesa", async () => {
    const mascara = criarMascara(2400, 1600);
    useFogDaMesa.mockReturnValue({ mascara, bytes: 0, loading: false, error: null });
    montarMestre();

    fireEvent.click(screen.getByLabelText(/Lugar Morro do Fogo/i));
    fireEvent.click(screen.getByTestId("wmm-revelar-agora"));

    await waitFor(() => expect(salvarFogDaMesa).toHaveBeenCalled());
    expect(contarReveladas(mascara)).toBeGreaterThan(0);
  });

  it("pedir menos do que já existe não rebaixa nada, e diz isso (AC-6)", async () => {
    montarMestre();
    fireEvent.click(screen.getByLabelText(/Lugar Capela Velha/i));
    fireEvent.click(screen.getByLabelText(/^Rumor$/i));
    fireEvent.click(screen.getByTestId("wmm-revelar-agora"));

    await waitFor(() => expect(screen.getByTestId("wmm-anuncio"))
      .toHaveTextContent("Isso já estava revelado para o grupo."));
    expect(publicarRevelacao).not.toHaveBeenCalled();
  });

  it("move o grupo à mão, mesmo sem trilha revelada — ele conduz a mesa", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addListener() {}, removeListener() {} });
    montarMestre();
    fireEvent.click(screen.getByLabelText("Mover o grupo para Cripta Selada"));
    await waitFor(() => expect(moverGrupo).toHaveBeenCalledWith(
      CAMPANHA, INSTANCIA, expect.objectContaining({ nodeId: "n4" }),
    ));
  });

  it("faz o relógio andar sozinho — o mestre é dono do tempo", async () => {
    montarMestre();
    fireEvent.click(screen.getByLabelText("Avançar 8 horas"));
    await waitFor(() => expect(atualizarParty).toHaveBeenCalledWith(
      CAMPANHA, INSTANCIA, { inGameDatetime: { dia: 1, hora: 8, minuto: 0 } },
    ));
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  VISÃO DO MESTRE / VISÃO DO JOGADOR  (padrão da F3)
 * ══════════════════════════════════════════════════════════════════ */

describe("o alternador de visão", () => {
  it("espiar esconde o que o jogador não vê, e marca o palco com moldura", () => {
    montarMestre();
    expect(screen.getByTestId("wmm-no-n4")).toBeInTheDocument();
    expect(screen.getByTestId("wmm-palco")).not.toHaveStyle({ border: "2px solid #8a7ad6" });

    fireEvent.click(screen.getByTestId("wmm-visao-do-jogador"));

    expect(screen.queryByTestId("wmm-no-n4")).not.toBeInTheDocument();
    expect(screen.getByTestId("wmm-palco")).toHaveStyle({ border: "2px solid #8a7ad6" });
    expect(screen.getByText("Visão do jogador")).toBeInTheDocument();
  });

  it("espiar NÃO tira as ferramentas do mestre (spec 0012)", () => {
    montarMestre();
    fireEvent.click(screen.getByTestId("wmm-visao-do-jogador"));
    expect(screen.getByTestId("wmm-revelar-agora")).toBeInTheDocument();
    expect(screen.getByTestId("wmm-contagem-oculta")).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  ESTADOS DE BORDA
 * ══════════════════════════════════════════════════════════════════ */

describe("a mesa sem mapa", () => {
  it("explica o caminho ao mestre, e a espera ao jogador (AC-7)", () => {
    useInstancias.mockReturnValue({ instancias: [], loading: false, error: null });

    const { unmount } = montarMestre();
    expect(screen.getByTestId("wmm-sem-mapa")).toHaveTextContent(/Levar para a mesa/i);
    unmount();

    montarJogador();
    expect(screen.getByTestId("wmm-sem-mapa")).toHaveTextContent(/O mestre ainda não trouxe/i);
  });

  it("um mestre que não é dono do molde joga com a projeção, sem console", () => {
    montarMestre({ uid: "outro-mestre" });
    expect(screen.queryByTestId("wmm-revelar-agora")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wmm-no-n4")).not.toBeInTheDocument();
    expect(screen.getByText(/trazido por outro mestre/i)).toBeInTheDocument();
  });
});
