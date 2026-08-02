/* ════════════════════════════════════════════════════════════════════
 *  OS CINCO MOVIMENTOS NA TELA  (spec 0028 · F7 · AC-11 · design §5.4)
 *  --------------------------------------------------------------------
 *  Este gate monta `Mesa/TelaDaMesa` DIRETO, com uma câmera de mentira e
 *  sem uma linha de `mesaStore`. É de propósito: o que está em julgamento
 *  aqui é o palco — quem anima, quando para, e o que some com
 *  `prefers-reduced-motion`. A mesa inteira (com Firestore, viagem e
 *  console) já tem o seu gate em `mesa-render.test.js`, e amarrar os dois
 *  faria uma mudança de sincronia derrubar um teste de animação.
 *
 *  Os três desligamentos do AC-11, um por vez:
 *   · `prefers-reduced-motion` .... `matchMedia` devolve `matches: true`;
 *   · fora do viewport ............ `IntersectionObserver` responde
 *                                    `isIntersecting: false`;
 *   · o dono da tela pedindo ...... a prop `anima={false}`.
 *
 *  A deriva da névoa (movimento 1) NÃO é conferida aqui: ela é do ateliê e
 *  da mesa igualmente, e o gate dela é `fog-render.test.js` §6.
 * ════════════════════════════════════════════════════════════════════ */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import TelaDaMesa from "../Mesa/TelaDaMesa";
import MesaStyles from "../Mesa/MesaStyles";
import { TINTA_DO_DIA } from "../Mesa/animacaoUi";
import { CICLO_DA_DERIVA } from "../Editor/nevoaStyles";
import { criarMascara } from "../model/fogMask";

/* ── Geometria fingida: o jsdom devolve tudo zerado ──────────────────── */
const RETANGULO = {
  left: 0, top: 0, width: 900, height: 560, right: 900, bottom: 560, x: 0, y: 0,
  toJSON() { return this; },
};

/** A câmera do palco, reduzida ao que `TelaDaMesa` de fato chama. */
const CAMERA = {
  pan: { x: 0, y: 0 },
  scale: 1,
  bindWheel() {},
  bindPan: () => ({}),
  bindPinch: () => ({}),
};

const NOS = [
  { id: "n1", kind: "node", x: 200, y: 200, name: "Vila Candeia", type: "town", estado: "visited" },
  { id: "n2", kind: "node", x: 500, y: 300, name: "Capela Velha", type: "poi", estado: "discovered" },
  { id: "n3", kind: "node", x: 700, y: 260, rumorLabel: "Fogo no morro.", type: "poi", estado: "rumored" },
];

const RASTRO = Array.from({ length: 20 }, (_, i) => ({ x: 200 + i * 15, y: 200 }));

/** O `IntersectionObserver` que responde o que o teste mandar. */
function observadorQueDiz(intersecta) {
  return class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([{ isIntersecting: intersecta }]); }
    unobserve() {}
    disconnect() {}
  };
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
  global.IntersectionObserver = observadorQueDiz(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.ResizeObserver;
  delete global.IntersectionObserver;
  delete window.matchMedia;
  delete window.PointerEvent;
});

/** Liga `prefers-reduced-motion: reduce` (o dublê responde `true` a tudo). */
function pedirMenosMovimento() {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: true, addEventListener() {}, removeEventListener() {},
  });
}

const montar = (props = {}) => render(
  <TelaDaMesa
    nos={NOS}
    trilhas={[]}
    camera={CAMERA}
    mundo={{ largura: 2400, altura: 1600 }}
    noAtualId="n1"
    destinos={[{ noId: "n2", horas: 6 }]}
    marcador={{ x: 200, y: 200 }}
    onClicarNo={() => {}}
    {...props}
  />,
);

const palco = () => screen.getByTestId("wmm-palco");

/* ════════════════════════════════════════════════════════════════════
 *  1 · O INTERRUPTOR DOS CINCO  (AC-11)
 * ══════════════════════════════════════════════════════════════════ */

describe("o interruptor dos cinco movimentos (AC-11)", () => {
  it("o palco anuncia que está animando, e o CSS se pendura nisso", () => {
    montar();
    expect(palco()).toHaveAttribute("data-anima", "sim");
  });

  it("`prefers-reduced-motion` desliga o palco inteiro", () => {
    pedirMenosMovimento();
    montar();
    expect(palco()).toHaveAttribute("data-anima", "nao");
  });

  it("FORA DO VIEWPORT nada anima", () => {
    global.IntersectionObserver = observadorQueDiz(false);
    montar();
    expect(palco()).toHaveAttribute("data-anima", "nao");
  });

  it("quem embute a mesa também pode pedir o mapa parado", () => {
    montar({ anima: false });
    expect(palco()).toHaveAttribute("data-anima", "nao");
  });

  it("sem `IntersectionObserver` o mapa respira — ambiente mudo não é veto", () => {
    delete global.IntersectionObserver;
    montar();
    expect(palco()).toHaveAttribute("data-anima", "sim");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  1½ · A DERIVA DA NÉVOA CHEGA À MESA  (movimento 1)
 *  --------------------------------------------------------------------
 *  Até a F7, `.wmf-deriva` montava na mesa sem uma linha de CSS: as regras
 *  moravam só em `EditorStyles.jsx`, que a mesa nunca monta. O movimento
 *  existia no DOM e não existia na tela. Estes dois testes travam a
 *  correção — o elemento **e** a folha que o faz andar.
 * ══════════════════════════════════════════════════════════════════ */

describe("a deriva da névoa na mesa (movimento 1)", () => {
  const NEVOA = { mascara: criarMascara(2400, 1600, 8), papel: "mestre", deriva: true };

  it("a textura monta com o ciclo de ~40 s", () => {
    montar({ nevoa: NEVOA });
    expect(screen.getByTestId("wm-nevoa-deriva"))
      .toHaveStyle({ animationDuration: `${CICLO_DA_DERIVA}s` });
  });

  it("a folha de estilo DA MESA carrega as regras da névoa", () => {
    const { container } = render(<MesaStyles />);
    const css = container.textContent;
    expect(css).toContain(".wmf-deriva");
    expect(css).toContain("@keyframes wmf-deriva");
    expect(css).toContain(".wmf-nevoa");
  });

  it("`prefers-reduced-motion` corta a deriva também aqui", () => {
    pedirMenosMovimento();
    montar({ nevoa: NEVOA });
    expect(screen.queryByTestId("wm-nevoa-deriva")).not.toBeInTheDocument();
  });

  it("fora do viewport a textura nem monta", () => {
    global.IntersectionObserver = observadorQueDiz(false);
    montar({ nevoa: NEVOA });
    expect(screen.queryByTestId("wm-nevoa-deriva")).not.toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · A REVELAÇÃO  (movimento 2)
 * ══════════════════════════════════════════════════════════════════ */

describe("a revelação (movimento 2)", () => {
  it("a névoa RECUA e o ícone NASCE — não é um pisca só", () => {
    montar({ recemRevelados: ["n2"] });
    expect(screen.getByTestId("wmm-no-n2")).toHaveAttribute("data-novo", "sim");
    /* O disco da névoa sendo empurrado para fora... */
    expect(screen.getByTestId("wmm-recuo-n2")).toBeInTheDocument();
    /* ...e o halo dourado do "achei!". */
    expect(screen.getByTestId("wmm-nascer-n2")).toBeInTheDocument();
  });

  it("a cerimônia é SÓ de quem acabou de acender", () => {
    montar({ recemRevelados: ["n2"] });
    expect(screen.queryByTestId("wmm-recuo-n1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wmm-nascer-n1")).not.toBeInTheDocument();
    expect(screen.getByTestId("wmm-no-n1")).not.toHaveAttribute("data-novo");
  });

  it("com movimento reduzido vira CORTE SECO: o lugar aparece, e pronto", () => {
    pedirMenosMovimento();
    montar({ recemRevelados: ["n2"] });
    /* O nó continua lá — o que some é a cerimônia em volta dele. */
    expect(screen.getByTestId("wmm-no-n2")).toBeInTheDocument();
    expect(screen.queryByTestId("wmm-recuo-n2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wmm-nascer-n2")).not.toBeInTheDocument();
  });

  it("fora do viewport também não há cerimônia", () => {
    global.IntersectionObserver = observadorQueDiz(false);
    montar({ recemRevelados: ["n2"] });
    expect(screen.getByTestId("wmm-no-n2")).toBeInTheDocument();
    expect(screen.queryByTestId("wmm-recuo-n2")).not.toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · O NÓ `rumored` RESPIRANDO  (movimento 3)
 * ══════════════════════════════════════════════════════════════════ */

describe("o respiro do rumor (movimento 3)", () => {
  it("o rumor tem brilho difuso e '?' no lugar do ícone concreto", () => {
    montar();
    expect(screen.getByTestId("wmm-rumor-halo-n3")).toBeInTheDocument();
    expect(screen.getByTestId("wmm-disco-n3")).toHaveTextContent("?");
  });

  it("quem NÃO é rumor não ganha halo — o brilho é a informação", () => {
    montar();
    expect(screen.queryByTestId("wmm-rumor-halo-n1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wmm-rumor-halo-n2")).not.toBeInTheDocument();
  });

  it("o '?' NÃO pisca junto do brilho — ele fica parado e legível", () => {
    montar();
    /* Quem carrega a classe do respiro é o halo, nunca o disco do glifo. */
    expect(screen.getByTestId("wmm-rumor-halo-n3").className).toContain("wmm-rumor-halo");
    expect(screen.getByTestId("wmm-disco-n3").className).not.toContain("wmm-rumor-halo");
  });

  it("com movimento reduzido o rumor continua existindo — só não respira", () => {
    pedirMenosMovimento();
    montar();
    /* O halo é DESENHO, não movimento: some a animação (no CSS), não o nó. */
    expect(screen.getByTestId("wmm-disco-n3")).toHaveTextContent("?");
    expect(palco()).toHaveAttribute("data-anima", "nao");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · O MARCADOR DO GRUPO  (movimento 4)
 * ══════════════════════════════════════════════════════════════════ */

describe("o marcador do grupo (movimento 4)", () => {
  it("parado ele flutua e fica em pé", () => {
    montar();
    expect(screen.getByTestId("wmm-marcador")).toBeInTheDocument();
    expect(screen.getByTestId("wmm-tombo")).toHaveStyle({ transform: "rotate(0deg)" });
  });

  it("viajando para a direita, tomba para a direita", () => {
    montar({ rastro: RASTRO, viajando: true, marcador: { x: 485, y: 200 } });
    const tombo = screen.getByTestId("wmm-tombo");
    const graus = Number(tombo.getAttribute("data-tombo"));
    expect(graus).toBeGreaterThan(0);
    expect(tombo).toHaveStyle({ transform: `rotate(${graus}deg)` });
  });

  it("viajando para a esquerda, tomba para a esquerda", () => {
    const voltando = RASTRO.map((p) => ({ x: -p.x, y: p.y }));
    montar({ rastro: voltando, viajando: true });
    expect(Number(screen.getByTestId("wmm-tombo").getAttribute("data-tombo"))).toBeLessThan(0);
  });

  it("o tombo é `transform`, e some com movimento reduzido", () => {
    pedirMenosMovimento();
    montar({ rastro: RASTRO, viajando: true });
    expect(screen.getByTestId("wmm-tombo")).toHaveStyle({ transform: "rotate(0deg)" });
  });

  it("viajando ele não flutua: dois movimentos somados embrulham o olho", () => {
    montar({ rastro: RASTRO, viajando: true });
    expect(screen.getByTestId("wmm-marcador")).toHaveAttribute("data-viajando", "sim");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · A TINTA DE HORA DO DIA  (movimento 5)
 * ══════════════════════════════════════════════════════════════════ */

describe("a tinta de hora do dia na tela (movimento 5)", () => {
  it("acende a camada do período que o relógio marca", () => {
    montar({ relogio: { dia: 2, hora: 14, minuto: 0 } });
    expect(screen.getByTestId("wmm-tinta")).toHaveAttribute("data-periodo", "tarde");
    const acesas = document.querySelectorAll('.wmm-tinta-camada[data-acesa="sim"]');
    expect(acesas).toHaveLength(1);
    expect(acesas[0]).toHaveAttribute("data-periodo", "tarde");
  });

  it("as quatro camadas ficam MONTADAS — a travessia é `opacity`, não troca de cor", () => {
    montar({ relogio: { dia: 1, hora: 22, minuto: 0 } });
    expect(document.querySelectorAll(".wmm-tinta-camada")).toHaveLength(4);
    const noite = document.querySelector('.wmm-tinta-camada[data-periodo="noite"]');
    expect(noite).toHaveStyle({ opacity: "1", background: TINTA_DO_DIA.noite.fundo });
    const tarde = document.querySelector('.wmm-tinta-camada[data-periodo="tarde"]');
    expect(tarde).toHaveStyle({ opacity: "0" });
  });

  it("muda de camada quando o relógio vira o período", () => {
    const { rerender } = render(
      <TelaDaMesa
        nos={NOS} trilhas={[]} camera={CAMERA} mundo={{ largura: 2400, altura: 1600 }}
        onClicarNo={() => {}} relogio={{ dia: 1, hora: 10, minuto: 0 }}
      />,
    );
    expect(screen.getByTestId("wmm-tinta")).toHaveAttribute("data-periodo", "manhã");
    rerender(
      <TelaDaMesa
        nos={NOS} trilhas={[]} camera={CAMERA} mundo={{ largura: 2400, altura: 1600 }}
        onClicarNo={() => {}} relogio={{ dia: 1, hora: 20, minuto: 0 }}
      />,
    );
    expect(screen.getByTestId("wmm-tinta")).toHaveAttribute("data-periodo", "noite");
  });

  it("SEM RELÓGIO fica neutra — nenhuma camada acesa", () => {
    montar({ relogio: null });
    expect(screen.getByTestId("wmm-tinta")).toHaveAttribute("data-periodo", "neutro");
    expect(document.querySelectorAll('.wmm-tinta-camada[data-acesa="sim"]')).toHaveLength(0);
  });

  it("`prefers-reduced-motion` CORTA a tinta — o AC-11 a lista com a deriva", () => {
    pedirMenosMovimento();
    montar({ relogio: { dia: 1, hora: 22, minuto: 0 } });
    expect(screen.queryByTestId("wmm-tinta")).not.toBeInTheDocument();
  });

  it("fora do viewport a COR fica — o que para é a travessia", () => {
    /* Cor não é movimento: sumir com a tinta ao rolar a página faria a mesa
       piscar de volta ao neutro. Quem para a travessia é o `data-anima`. */
    global.IntersectionObserver = observadorQueDiz(false);
    montar({ relogio: { dia: 1, hora: 22, minuto: 0 } });
    expect(screen.getByTestId("wmm-tinta")).toHaveAttribute("data-periodo", "noite");
    expect(palco()).toHaveAttribute("data-anima", "nao");
  });

  it("a tinta entra ABAIXO dos nós — nenhum ícone é tingido", () => {
    montar({ relogio: { dia: 1, hora: 14, minuto: 0 } });
    const tinta = screen.getByTestId("wmm-tinta");
    const no = screen.getByTestId("wmm-no-n1");
    /* `compareDocumentPosition` com FOLLOWING (4) = a tinta vem ANTES do nó
       na ordem do documento, logo é pintada por baixo dele. */
    expect(tinta.compareDocumentPosition(no) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
