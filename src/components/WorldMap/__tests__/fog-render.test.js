/* ════════════════════════════════════════════════════════════════════
 *  A NÉVOA NA TELA — GATE VISUAL DO AC-5 E DO AC-11  (spec 0028 · F3)
 *  --------------------------------------------------------------------
 *  Fronteira mockada: só o I/O — `../worldMapStore` e `../fogStore`. Toda a
 *  matemática da máscara (`model/fogMask.js`) e todo o cálculo de opacidade
 *  (`Editor/CamadaDeNevoa.jsx`) rodam de VERDADE: quem decide o que é névoa
 *  aqui é o código de produção, não um dublê.
 *
 *  O jsdom não tem canvas 2D: `getContext` devolve `null`, e tanto
 *  `pintarNevoa` quanto o offscreen tratam isso como no-op de propósito.
 *  Por isso os pixels são conferidos na função pura (`construirPixels`), e o
 *  DOM é conferido pelo que ele promete — a camada existe, o papel está
 *  marcado, a moldura muda, a deriva monta e desmonta.
 *
 *  O preset do CRA roda com `resetMocks: true`: as implementações são
 *  reinstaladas a cada teste no `beforeEach`.
 * ════════════════════════════════════════════════════════════════════ */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../worldMapStore", () => ({
  useGrafo: jest.fn(),
  createNode: jest.fn(),
  updateNode: jest.fn(),
  deleteNode: jest.fn(),
  createEdge: jest.fn(),
  updateEdge: jest.fn(),
  deleteEdge: jest.fn(),
  updateWorldMap: jest.fn(),
}));

jest.mock("../fogStore", () => ({
  useFog: jest.fn(),
  useSalvarFog: jest.fn(),
}));

import EditorDoGrafo from "../Editor";
import { useGrafo, updateWorldMap } from "../worldMapStore";
import { useFog, useSalvarFog } from "../fogStore";
import { criarNo } from "../model/graph";
import { MAPA_PADRAO_ID } from "../model/mapaPadrao";
import {
  contarReveladas, criarMascara, estaRevelado, revelarCirculo,
} from "../model/fogMask";
import {
  OPACIDADE, alfaDaCelula, construirPixels, pintarNevoa, raioDoDesfoque,
} from "../Editor/CamadaDeNevoa";
import { COR_DA_VISAO_DE_JOGADOR, pesoLegivel, percentual, raioValido } from "../Editor/ControlesDaNevoa";

/* ── Geometria fingida: o jsdom devolve tudo zerado ──────────────────── */
const RETANGULO = {
  left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500, x: 0, y: 0,
  toJSON() { return this; },
};

const MOLDE = {
  id: "m1", name: "As Terras Partidas", width: 2400, height: 1600,
  defaultRevealRadius: 150, nodeCount: 1, fogEnabled: true,
};
const SEM_NEVOA = { ...MOLDE, fogEnabled: false };

const VILA = criarNo({ id: "n1", x: 100, y: 100, name: "Vila Candeia", type: "town" });

let agendar;
let salvarAgora;

beforeEach(() => {
  /* O jsdom não implementa `PointerEvent`, e sem ele a Testing Library cai num
     `Event` cru — que descarta `clientX`/`button` e faria o pincel pintar em
     NaN. `MouseEvent` tem exatamente os campos que o palco lê. */
  window.PointerEvent = window.MouseEvent;
  jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RETANGULO);
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([]); }
    disconnect() {}
  };

  useGrafo.mockReturnValue({ nos: [VILA], trilhas: [], loading: false, error: null });
  useFog.mockReturnValue({ mascara: null, bytes: 0, loading: false, error: null });

  agendar = jest.fn();
  salvarAgora = jest.fn();
  useSalvarFog.mockReturnValue({
    agendar, salvarAgora, gravando: false, pendente: false, erro: null, bytes: 0,
    limparErro: jest.fn(),
  });

  updateWorldMap.mockResolvedValue(undefined);
});

afterEach(() => { delete global.ResizeObserver; delete window.matchMedia; delete window.PointerEvent; });

const montar = (props = {}) => render(
  <EditorDoGrafo uid="mestre-1" molde={MOLDE} plan="pago" {...props} />,
);

const palco = () => screen.getByTestId("wm-palco");
const pincelDaBarra = () => screen.getByRole("button", { name: /pincel de névoa/i });
const interruptor = () => screen.getByRole("checkbox", { name: /névoa/i });

/** Um traço do pincel, de (x1,y1) a (x2,y2) em px de TELA. */
function pincelar(x1, y1, x2, y2) {
  const alvo = palco();
  fireEvent.pointerDown(alvo, { clientX: x1, clientY: y1, button: 0, pointerId: 7 });
  fireEvent.pointerMove(alvo, { clientX: x2, clientY: y2, button: 0, pointerId: 7 });
  fireEvent.pointerUp(alvo, { clientX: x2, clientY: y2, button: 0, pointerId: 7 });
}

/* ════════════════════════════════════════════════════════════════════
 *  1 · AS TRÊS OPACIDADES  (AC-5, lógica pura)
 * ════════════════════════════════════════════════════════════════════ */
describe("as opacidades do AC-5", () => {
  it("o mestre vê a névoa a ~15% e enxerga limpo o que já revelou", () => {
    expect(alfaDaCelula(false, null, "mestre")).toBeCloseTo(0.15, 3);
    expect(alfaDaCelula(true, null, "mestre")).toBe(0);
    expect(OPACIDADE.mestreCoberto).toBeCloseTo(0.15, 3);
  });

  it("o jogador vê OPACO o que nunca viu e ~45% o que já revelou", () => {
    expect(alfaDaCelula(false, null, "jogador")).toBe(1);
    expect(alfaDaCelula(true, null, "jogador")).toBeCloseTo(0.45, 3);
    expect(OPACIDADE.jogadorNuncaVisto).toBe(1);
    expect(OPACIDADE.jogadorRevelado).toBeCloseTo(0.45, 3);
  });

  it("onde o grupo está AGORA, ninguém vê névoa (gancho da F4)", () => {
    expect(alfaDaCelula(true, true, "jogador")).toBe(0);
    expect(alfaDaCelula(false, true, "jogador")).toBe(0);
  });

  it("construirPixels pinta cada célula com o alfa do papel", () => {
    const m = criarMascara(16, 8, 4);      // 4 × 2 células
    revelarCirculo(m, 2, 2, 1);            // só a célula (0,0)

    const mestre = construirPixels(m, null, "mestre");
    expect(mestre[3]).toBe(0);                              // revelada
    expect(mestre[7]).toBe(Math.round(0.15 * 255));         // coberta

    const jogador = construirPixels(m, null, "jogador");
    expect(jogador[3]).toBe(Math.round(0.45 * 255));        // já revelada
    expect(jogador[7]).toBe(255);                           // nunca vista
  });

  it("a máscara do que o grupo enxerga AGORA abre a névoa por cima da explorada", () => {
    const explorada = revelarCirculo(criarMascara(16, 8, 4), 2, 2, 1);
    const agora = revelarCirculo(criarMascara(16, 8, 4), 2, 2, 1);
    const pixels = construirPixels(explorada, agora, "jogador");
    expect(pixels[3]).toBe(0);      // explorada E visível agora → limpo
    expect(pixels[7]).toBe(255);    // nem uma coisa nem outra → opaco
  });

  it("o desfoque acompanha o tamanho da célula na tela, com piso e teto", () => {
    expect(raioDoDesfoque(4, 1)).toBeCloseTo(3.4, 5);
    expect(raioDoDesfoque(4, 0.1)).toBe(2);     // piso: a borda nunca vira degrau
    expect(raioDoDesfoque(4, 40)).toBe(28);     // teto: desfoque gigante é caro
  });

  it("pintarNevoa com contexto nulo é no-op — o jsdom não tem canvas", () => {
    expect(pintarNevoa(null, {})).toEqual({ pintou: false, desfoque: 0 });
  });

  it("pintarNevoa limpa a tela e desiste quando não há máscara", () => {
    const ctx = { clearRect: jest.fn(), setTransform: jest.fn(), drawImage: jest.fn() };
    const r = pintarNevoa(ctx, { largura: 800, altura: 500 });
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(r.pintou).toBe(false);
  });

  it("pintarNevoa estica a grade pela câmera e desfoca a borda", () => {
    const ctx = {
      clearRect: jest.fn(), setTransform: jest.fn(), drawImage: jest.fn(),
      filter: "none", imageSmoothingEnabled: false,
    };
    const m = criarMascara(2400, 1600, 4);
    const r = pintarNevoa(ctx, {
      ctx, mascara: m, papel: "mestre", largura: 800, altura: 500,
      pan: { x: 10, y: 20 }, scale: 0.5, offscreen: { width: 600, height: 400 },
    });
    expect(r.pintou).toBe(true);
    expect(r.desfoque).toBeGreaterThan(0);
    const [, x, y, w, h] = ctx.drawImage.mock.calls[0];
    expect([x, y]).toEqual([10, 20]);
    expect([w, h]).toEqual([1200, 800]);   // 2400×1600 na escala 0,5
    expect(ctx.filter).toBe("none");       // devolvido ao normal no fim
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · A CAMADA NO PALCO
 * ════════════════════════════════════════════════════════════════════ */
describe("a camada de névoa no palco", () => {
  it("com a névoa ligada, a camada existe e anuncia o papel do mestre", () => {
    montar();
    expect(screen.getByTestId("wm-nevoa")).toBeInTheDocument();
    expect(screen.getByTestId("wm-nevoa-canvas")).toHaveAttribute("data-papel", "mestre");
  });

  it("sem névoa ligada, não há camada nem pincel — só o interruptor", () => {
    montar({ molde: SEM_NEVOA });
    expect(screen.queryByTestId("wm-nevoa")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pincel de névoa/i })).not.toBeInTheDocument();
    expect(interruptor()).not.toBeChecked();
  });

  it("o mapa PADRÃO não ganha névoa: é somente leitura e não existe no banco", () => {
    render(<EditorDoGrafo uid="mestre-1" molde={{ id: MAPA_PADRAO_ID, name: "x" }} />);
    expect(screen.queryByRole("group", { name: /névoa do mapa/i })).not.toBeInTheDocument();
    expect(useFog).toHaveBeenCalledWith("", "");
  });

  it("a névoa gravada é adotada como está — o revelado não regride ao recarregar", () => {
    const gravada = revelarCirculo(criarMascara(2400, 1600, 4), 400, 400, 200);
    useFog.mockReturnValue({ mascara: gravada, bytes: 512, loading: false, error: null });
    montar();
    expect(screen.getByTestId("wm-nevoa")).toBeInTheDocument();
    expect(screen.getByTestId("wm-nevoa-estado")).toHaveTextContent(/revelado/i);
  });

  it("névoa gravada de OUTRO tamanho é descartada: recomeça coberta, que é o seguro", () => {
    const deOutroMapa = revelarCirculo(criarMascara(800, 600, 4), 400, 300, 200);
    useFog.mockReturnValue({ mascara: deOutroMapa, bytes: 300, loading: false, error: null });
    montar();
    expect(screen.getByTestId("wm-nevoa-estado")).toHaveTextContent("0% revelado");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · O PINCEL  (AC-5: "o mestre pinta e apaga névoa à mão")
 * ════════════════════════════════════════════════════════════════════ */
describe("o pincel de névoa", () => {
  it("aparece na barra só com a névoa ligada, e tem atalho de teclado", () => {
    montar();
    const botao = pincelDaBarra();
    expect(botao).toHaveAttribute("aria-keyshortcuts", "F");
    expect(botao).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(document, { key: "f" });
    expect(pincelDaBarra()).toHaveAttribute("aria-pressed", "true");
  });

  it("o atalho NÃO acende o pincel quando a névoa está desligada", () => {
    montar({ molde: SEM_NEVOA });
    fireEvent.keyDown(document, { key: "f" });
    expect(screen.getByRole("button", { name: /^selecionar/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("o traço revela a faixa por onde passou e agenda a gravação", async () => {
    montar();
    fireEvent.click(pincelDaBarra());
    pincelar(100, 100, 300, 200);

    await waitFor(() => expect(agendar).toHaveBeenCalled());
    const mascara = agendar.mock.calls.at(-1)[0];
    /* Câmera inicial: pan (0,0), escala 0,5 → tela (100,100) = mundo (200,200). */
    expect(estaRevelado(mascara, 200, 200)).toBe(true);
    expect(estaRevelado(mascara, 600, 400)).toBe(true);
    expect(estaRevelado(mascara, 400, 300)).toBe(true);   // meio do traço
    expect(estaRevelado(mascara, 2000, 1400)).toBe(false);
  });

  it("no modo COBRIR, o mesmo traço apaga o que estava revelado", async () => {
    const gravada = revelarCirculo(criarMascara(2400, 1600, 4), 200, 200, 400);
    useFog.mockReturnValue({ mascara: gravada, bytes: 900, loading: false, error: null });
    montar();

    fireEvent.click(screen.getByRole("radio", { name: /cobrir/i }));
    pincelar(100, 100, 100, 100);

    await waitFor(() => expect(agendar).toHaveBeenCalled());
    expect(estaRevelado(agendar.mock.calls.at(-1)[0], 200, 200)).toBe(false);
  });

  it("escolher o que o pincel faz já liga a ferramenta — sem dois cliques", () => {
    montar();
    fireEvent.click(screen.getByRole("radio", { name: /revelar/i }));
    expect(pincelDaBarra()).toHaveAttribute("aria-pressed", "true");
  });

  it("com o pincel na mão, o clique no vazio NÃO planta lugar nem perde a seleção", () => {
    montar();
    fireEvent.click(screen.getByTestId("wm-no-n1"));
    expect(screen.getByRole("complementary", { name: /editar lugar/i })).toBeInTheDocument();

    fireEvent.click(pincelDaBarra());
    pincelar(400, 300, 400, 300);
    fireEvent.click(palco(), { clientX: 400, clientY: 300 });

    expect(screen.getByRole("complementary", { name: /editar lugar/i })).toBeInTheDocument();
  });

  it("o anel mostra o tamanho real do pincel enquanto o ponteiro anda", () => {
    montar();
    fireEvent.click(pincelDaBarra());
    fireEvent.pointerMove(palco(), { clientX: 200, clientY: 150, pointerId: 3 });

    const anel = screen.getByTestId("wm-nevoa-anel");
    /* Raio padrão 140 em mundo, escala 0,5 → 140 px de diâmetro na tela. */
    expect(anel).toHaveStyle({ width: "140px", height: "140px" });
  });

  it("o tamanho do pincel é ajustável e tem rótulo para leitor de tela", () => {
    montar();
    const controle = screen.getByLabelText(/tamanho do pincel de névoa/i);
    expect(controle).toHaveAttribute("type", "range");
    fireEvent.change(controle, { target: { value: "300" } });
    expect(controle).toHaveValue("300");
  });

  it("`cobrir tudo` e `revelar tudo` mexem no mapa inteiro e agendam a gravação", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /revelar tudo/i }));
    await waitFor(() => expect(agendar).toHaveBeenCalled());
    const cheia = agendar.mock.calls.at(-1)[0];
    expect(contarReveladas(cheia)).toBe(cheia.colunas * cheia.linhas);

    fireEvent.click(screen.getByRole("button", { name: /cobrir tudo/i }));
    await waitFor(() => expect(agendar).toHaveBeenCalledTimes(2));
    expect(contarReveladas(agendar.mock.calls.at(-1)[0])).toBe(0);
  });

  it("traço que não muda nada não gera gravação", () => {
    /* Cobrir onde já está coberto: sem isto, cada movimento do ponteiro sobre
       névoa fechada geraria uma escrita de rede à toa. */
    montar();
    fireEvent.click(screen.getByRole("radio", { name: /cobrir/i }));
    pincelar(400, 300, 420, 320);
    expect(agendar).not.toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · O INTERRUPTOR DA NÉVOA
 * ════════════════════════════════════════════════════════════════════ */
describe("ligar e desligar a névoa", () => {
  it("ligar persiste no molde e faz a camada aparecer na hora", async () => {
    montar({ molde: SEM_NEVOA });
    fireEvent.click(interruptor());

    await waitFor(() => expect(updateWorldMap).toHaveBeenCalledWith("mestre-1", "m1", { fogEnabled: true }));
    expect(screen.getByTestId("wm-nevoa")).toBeInTheDocument();
  });

  it("a falha ao gravar o interruptor desfaz o otimismo e explica em português", async () => {
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    updateWorldMap.mockRejectedValue(Object.assign(new Error("x"), { code: "permission-denied" }));
    montar({ molde: SEM_NEVOA });
    fireEvent.click(interruptor());

    expect(await screen.findByRole("alert")).toHaveTextContent(/não é seu|removido/i);
    expect(screen.queryByTestId("wm-nevoa")).not.toBeInTheDocument();
    erro.mockRestore();
  });

  it("a falha de gravação da máscara vira frase, nunca silêncio", () => {
    useSalvarFog.mockReturnValue({
      agendar, salvarAgora, gravando: false, pendente: false, bytes: 0,
      erro: Object.assign(new Error("x"), { code: "resource-exhausted" }),
      limparErro: jest.fn(),
    });
    montar();
    expect(screen.getByRole("alert")).toHaveTextContent(/a névoa não foi gravada/i);
  });

  it("mostra quanto do mapa está revelado e quanto a névoa está pesando", () => {
    montar();
    expect(screen.getByTestId("wm-nevoa-estado")).toHaveTextContent(/0% revelado ·/);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · VISÃO DO MESTRE / VISÃO DO JOGADOR  (padrão da spec 0012)
 * ════════════════════════════════════════════════════════════════════ */
describe("o alternador de visão", () => {
  it("começa na Visão do Mestre, sem moldura no palco", () => {
    montar();
    const botao = screen.getByRole("button", { name: /ver o mapa como o jogador vê/i });
    expect(botao).toHaveAttribute("aria-pressed", "false");
    expect(palco()).not.toHaveStyle({ border: `2px solid ${COR_DA_VISAO_DE_JOGADOR}` });
  });

  it("alternar troca o papel da névoa e MARCA O PALCO COM BORDA COLORIDA", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /ver o mapa como o jogador vê/i }));

    expect(screen.getByTestId("wm-nevoa-canvas")).toHaveAttribute("data-papel", "jogador");
    expect(palco()).toHaveStyle({ border: `2px solid ${COR_DA_VISAO_DE_JOGADOR}` });
    expect(screen.getByRole("button", { name: /voltar para a visão do mestre/i }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("espiar como jogador NÃO tira nenhuma ferramenta do mestre", () => {
    /* É a razão de os dois estados serem separados e só se juntarem no render
       (`asViewer` da spec 0012). Perder as ferramentas ao espiar seria trocar
       de modo, não de visão. */
    montar();
    fireEvent.click(screen.getByRole("button", { name: /ver o mapa como o jogador vê/i }));

    expect(screen.getByRole("button", { name: /novo lugar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nova trilha/i })).toBeInTheDocument();
    expect(pincelDaBarra()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revelar tudo/i })).toBeEnabled();
  });

  it("o papel REAL de jogador já entra na visão de jogador (gancho da F4)", () => {
    montar({ visaoDeJogador: true });
    expect(screen.getByTestId("wm-nevoa-canvas")).toHaveAttribute("data-papel", "jogador");
    expect(palco()).toHaveStyle({ border: `2px solid ${COR_DA_VISAO_DE_JOGADOR}` });
  });

  it("o modo também é anunciado para quem usa leitor de tela", () => {
    montar();
    expect(screen.getByText(/visão do mestre: você está vendo o mapa inteiro/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ver o mapa como o jogador vê/i }));
    expect(screen.getByText(/visão do jogador: o mapa está sendo mostrado/i)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  6 · A DERIVA  (AC-11)
 * ════════════════════════════════════════════════════════════════════ */
describe("a deriva da névoa (AC-11)", () => {
  it("existe com a névoa parada, em ciclo de ~40 s", () => {
    montar();
    const deriva = screen.getByTestId("wm-nevoa-deriva");
    expect(deriva).toHaveStyle({ animationDuration: "40s" });
  });

  it("PARA enquanto o mestre tem ferramenta de escrita na mão (design §5.4)", () => {
    montar();
    fireEvent.click(pincelDaBarra());
    expect(screen.queryByTestId("wm-nevoa-deriva")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /novo lugar/i }));
    expect(screen.queryByTestId("wm-nevoa-deriva")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mover o mapa/i }));
    expect(screen.getByTestId("wm-nevoa-deriva")).toBeInTheDocument();
  });

  it("`prefers-reduced-motion` corta a deriva — o elemento nem monta", () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true, addEventListener() {}, removeEventListener() {},
    });
    montar();
    expect(screen.getByTestId("wm-nevoa")).toBeInTheDocument();
    expect(screen.queryByTestId("wm-nevoa-deriva")).not.toBeInTheDocument();
  });

  it("nada anima fora do viewport", () => {
    const observadores = [];
    global.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; observadores.push(this); }
      observe() { this.cb([{ isIntersecting: false }]); }
      disconnect() {}
    };
    try {
      montar();
      expect(screen.queryByTestId("wm-nevoa-deriva")).not.toBeInTheDocument();
      expect(observadores.length).toBeGreaterThan(0);
    } finally {
      delete global.IntersectionObserver;
    }
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  7 · RÓTULOS DOS CONTROLES  (lógica pura)
 * ════════════════════════════════════════════════════════════════════ */
describe("rótulos da barra da névoa", () => {
  it("o raio do pincel fica sempre na faixa utilizável", () => {
    expect(raioValido(5)).toBe(20);
    expect(raioValido(9999)).toBe(600);
    expect(raioValido("140")).toBe(140);
    expect(raioValido("abacaxi")).toBe(140);
  });

  it("a fração e o peso são ditos em linguagem de gente", () => {
    expect(percentual(0)).toBe("0%");
    expect(percentual(0.437)).toBe("44%");
    expect(percentual(2)).toBe("100%");
    expect(pesoLegivel(0)).toBe("0 B");
    expect(pesoLegivel(900)).toBe("900 B");
    expect(pesoLegivel(2293)).toBe("2 KB");
  });
});
