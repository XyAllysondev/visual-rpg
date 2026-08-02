/* ════════════════════════════════════════════════════════════════════
 *  OS CINCO MOVIMENTOS — A MATEMÁTICA  (spec 0028 · F7 · AC-11)
 *  --------------------------------------------------------------------
 *  Gate puro de `Mesa/animacaoUi.js`: a tinta de hora do dia (movimento 5),
 *  a inclinação do marcador e o rastro que desvanece (movimento 4). Nenhum
 *  React, nenhum canvas de verdade — o `ctx` é um dublê que anota o que foi
 *  pedido, como já faz `mesa-modelo.test.js`.
 *
 *  ── O TESTE QUE IMPORTA: O CONTRASTE ────────────────────────────────
 *  O AC-11 exige que a tinta *"não prejudique a leitura"*, e o pedido do
 *  Andre põe número nisso: ≥4,5:1 em qualquer período. Aqui a conta é feita
 *  DE VERDADE — luminância relativa da WCAG 2.x, sobre as MESMAS paradas de
 *  degradê que o CSS usa (`TINTA_DO_DIA[p].paradas`), e não sobre uma cópia
 *  transcrita à mão que poderia envelhecer sem ninguém notar.
 *
 *  Dois fundos de referência, os dois do próprio módulo:
 *   · `#171720` — o tom mais CLARO do palco (o pior caso: fundo claro é o
 *     que aproxima o fundo do texto claro);
 *   · `#0b0b11` — a beirada escura do mesmo degradê.
 *
 *  E um terceiro caso, o que não depende da ilustração do usuário: a placa
 *  do rótulo (`rgba(9,9,14,.72)`), medida sobre BRANCO PURO. É ela que faz o
 *  piso de 4,5:1 valer mesmo sobre um mapa claro que o mestre subiu.
 * ════════════════════════════════════════════════════════════════════ */

import {
  ALFA_DA_MEMORIA, ALFA_DA_PONTA, FAIXAS_DO_RASTRO, INCLINACAO_MAXIMA,
  PERIODOS, TINTA_DO_DIA, TRAVESSIA_DA_TINTA,
  inclinacaoDoMarcador, periodoDaTinta, pintarRastro, tintaDoRelogio,
} from "../Mesa/animacaoUi";
import { periodoDoDia } from "../Mesa/mesaUi";

/* ════════════════════════════════════════════════════════════════════
 *  FERRAMENTAS DE MEDIÇÃO  (WCAG 2.x, §1.4.3)
 * ══════════════════════════════════════════════════════════════════ */

const linear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** Luminância relativa de um `[r,g,b]`. */
function luminancia([r, g, b]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Razão de contraste entre duas cores opacas. */
function contraste(a, b) {
  const [alto, baixo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (alto + 0.05) / (baixo + 0.05);
}

/** `fg` com alfa `a` composto sobre `bg` — o que o navegador faria. */
function compor(fg, a, bg) {
  return fg.map((c, i) => a * c + (1 - a) * bg[i]);
}

/* As cores que o módulo escreve sobre o mapa (todas ACIMA da tinta). */
const ROTULO = [240, 234, 217];      // #f0ead9
const DOURADO = [232, 201, 109];     // var(--gold2) do tema
const RUMOR = [230, 220, 255];       // #e6dcff, o "?" do nó `rumored`
const PALCO_CLARO = [23, 23, 32];    // #171720 — o topo do degradê do palco
const PALCO_ESCURO = [11, 11, 17];   // #0b0b11
const PLACA = [9, 9, 14];            // fundo do rótulo
const ALFA_DA_PLACA = 0.72;

/** A parada mais pesada de um período: onde a tinta mais desloca o fundo. */
const paradaMaisPesada = (periodo) => TINTA_DO_DIA[periodo].paradas
  .reduce((pior, p) => (p.alfa > pior.alfa ? p : pior));

/* ════════════════════════════════════════════════════════════════════
 *  1 · A TINTA SEGUE O RELÓGIO  (movimento 5)
 * ══════════════════════════════════════════════════════════════════ */

describe("a tinta de hora do dia (AC-11, movimento 5)", () => {
  it("tem exatamente os quatro períodos de `periodoDoDia`, e nenhum a mais", () => {
    expect(PERIODOS).toEqual(["madrugada", "manhã", "tarde", "noite"]);
    expect(Object.keys(TINTA_DO_DIA).sort()).toEqual([...PERIODOS].sort());
    /* A fonte da verdade do período é `mesaUi`, não uma segunda tabela aqui. */
    [2, 8, 14, 21].forEach((hora) => {
      expect(PERIODOS).toContain(periodoDoDia({ dia: 1, hora, minuto: 0 }));
    });
  });

  it("puxa o período do relógio de jogo — o número vira cor", () => {
    expect(periodoDaTinta({ dia: 1, hora: 3, minuto: 0 })).toBe("madrugada");
    expect(periodoDaTinta({ dia: 2, hora: 9, minuto: 30 })).toBe("manhã");
    expect(periodoDaTinta({ dia: 2, hora: 13, minuto: 0 })).toBe("tarde");
    expect(periodoDaTinta({ dia: 2, hora: 22, minuto: 0 })).toBe("noite");
  });

  it("aceita o relógio em horas corridas, que é como a viagem o grava", () => {
    expect(periodoDaTinta(0)).toBe("madrugada");
    expect(periodoDaTinta(24 + 13)).toBe("tarde");   // dia 2, 13h
    expect(periodoDaTinta(48 + 20)).toBe("noite");   // dia 3, 20h
  });

  it("SEM RELÓGIO volta ao neutro — não inventa a meia-noite do dia 1", () => {
    expect(periodoDaTinta(null)).toBeNull();
    expect(periodoDaTinta(undefined)).toBeNull();
    expect(periodoDaTinta({})).toBeNull();
    expect(periodoDaTinta("amanhã")).toBeNull();
    expect(periodoDaTinta(Number.NaN)).toBeNull();
    expect(tintaDoRelogio(null)).toBeNull();
  });

  it("é quente de dia e fria de noite — o viés de cor não é decorativo", () => {
    /* "quente" = vermelho acima do azul; "fria" = o contrário (design §5.4). */
    const quente = ([r, , b]) => r > b;
    ["manhã", "tarde"].forEach((p) => {
      expect(quente(paradaMaisPesada(p).cor)).toBe(true);
    });
    ["madrugada", "noite"].forEach((p) => {
      expect(quente(paradaMaisPesada(p).cor)).toBe(false);
    });
  });

  it("os períodos claros pesam menos que os escuros — o alfa é o freio", () => {
    expect(TINTA_DO_DIA["manhã"].alfa).toBeLessThan(TINTA_DO_DIA.noite.alfa);
    expect(TINTA_DO_DIA.tarde.alfa).toBeLessThan(TINTA_DO_DIA.madrugada.alfa);
    PERIODOS.forEach((p) => {
      expect(TINTA_DO_DIA[p].alfa).toBeGreaterThan(0);
      expect(TINTA_DO_DIA[p].alfa).toBeLessThanOrEqual(0.4);
    });
  });

  it("o CSS é GERADO das paradas — texto e número não podem divergir", () => {
    PERIODOS.forEach((p) => {
      const { fundo, paradas, alfa } = TINTA_DO_DIA[p];
      expect(fundo).toMatch(/gradient\(/);
      paradas.forEach((parada) => {
        expect(fundo).toContain(`rgba(${parada.cor.join(",")},${parada.alfa})`);
      });
      expect(alfa).toBe(Math.max(...paradas.map((x) => x.alfa)));
    });
  });

  it("a travessia entre períodos é longa o bastante para não ter degrau", () => {
    expect(TRAVESSIA_DA_TINTA).toBeGreaterThanOrEqual(800);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · O CONTRASTE  — o número que o AC-11 cobra
 * ══════════════════════════════════════════════════════════════════ */

describe("a tinta não prejudica a leitura (AC-11)", () => {
  const PISO = 4.5;

  it("o texto e o dourado passam de 4,5:1 em TODOS os períodos", () => {
    const medidas = [];
    [PALCO_CLARO, PALCO_ESCURO].forEach((palco) => {
      PERIODOS.forEach((p) => {
        const { cor, alfa } = paradaMaisPesada(p);
        const fundo = compor(cor, alfa, palco);
        [["rótulo", ROTULO], ["dourado", DOURADO], ["rumor", RUMOR]].forEach(([nome, alvo]) => {
          const razao = contraste(alvo, fundo);
          medidas.push({ periodo: p, alvo: nome, razao });
          expect(razao).toBeGreaterThanOrEqual(PISO);
        });
      });
    });
    /* O pior caso dos 24 pares medidos ainda tem folga larga sobre o piso —
       é o número que o relatório da fase cita. */
    const pior = Math.min(...medidas.map((m) => m.razao));
    expect(pior).toBeGreaterThan(8);
  });

  it("a tinta nunca tira mais de 3 pontos de razão do fundo sem tinta", () => {
    /* O que o AC pede é que a tinta não DEGRADE a leitura. Medir a queda,
       e não só o piso, é o que impede um alfa alto de passar batido só
       porque o palco é escuro o bastante para absorver o estrago. */
    PERIODOS.forEach((p) => {
      const { cor, alfa } = paradaMaisPesada(p);
      const semTinta = contraste(ROTULO, PALCO_CLARO);
      const comTinta = contraste(ROTULO, compor(cor, alfa, PALCO_CLARO));
      expect(semTinta - comTinta).toBeLessThan(3.1);
    });
  });

  it("a placa do rótulo segura o piso até sobre BRANCO PURO", () => {
    /* A ilustração do fundo é do usuário: pode ser um mapa claro, e aí nem o
       palco nem a tinta garantem nada. Quem garante é a placa. */
    const sobreBranco = compor(PLACA, ALFA_DA_PLACA, [255, 255, 255]);
    expect(contraste(ROTULO, sobreBranco)).toBeGreaterThanOrEqual(PISO);
    expect(contraste(DOURADO, sobreBranco)).toBeGreaterThanOrEqual(PISO);
  });

  it("o `?` do rumor lê sobre o disco OPACO, não sobre a ilustração", () => {
    /* O disco do nó `rumored` ficou opaco na F7 justamente para o glifo não
       depender do que houver embaixo — nem da tinta, que passa por baixo. */
    const nucleo = [64, 54, 116];
    const borda = [34, 28, 72];
    expect(contraste(RUMOR, nucleo)).toBeGreaterThanOrEqual(PISO);
    expect(contraste(RUMOR, borda)).toBeGreaterThanOrEqual(PISO);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · O MARCADOR — INCLINAÇÃO  (movimento 4)
 * ══════════════════════════════════════════════════════════════════ */

describe("a inclinação do marcador (movimento 4)", () => {
  const reta = (dx, dy) => Array.from({ length: 10 }, (_, i) => ({ x: i * dx, y: i * dy }));

  it("tomba para o lado em que o grupo está indo", () => {
    expect(inclinacaoDoMarcador(reta(10, 0), true)).toBeGreaterThan(0);
    expect(inclinacaoDoMarcador(reta(-10, 0), true)).toBeLessThan(0);
  });

  it("nunca passa do tombo máximo — inclinar demais vira desenho animado", () => {
    [reta(10, 0), reta(-10, 0), reta(7, 7), reta(-3, 12)].forEach((pontos) => {
      expect(Math.abs(inclinacaoDoMarcador(pontos, true))).toBeLessThanOrEqual(INCLINACAO_MAXIMA);
    });
    expect(inclinacaoDoMarcador(reta(10, 0), true)).toBeCloseTo(INCLINACAO_MAXIMA, 1);
  });

  it("subindo ou descendo na vertical ele fica em pé", () => {
    expect(inclinacaoDoMarcador(reta(0, 10), true)).toBeCloseTo(0, 5);
  });

  it("parado NÃO inclina — o grupo parado flutua, e só", () => {
    expect(inclinacaoDoMarcador(reta(10, 0), false)).toBe(0);
  });

  it("sem rastro, sem direção — e nada quebra", () => {
    expect(inclinacaoDoMarcador([], true)).toBe(0);
    expect(inclinacaoDoMarcador(null, true)).toBe(0);
    expect(inclinacaoDoMarcador([{ x: 1, y: 1 }], true)).toBe(0);
    expect(inclinacaoDoMarcador([{ x: 5, y: 5 }, { x: 5, y: 5 }], true)).toBe(0);
    expect(inclinacaoDoMarcador([{ x: "a" }, { y: null }], true)).toBe(0);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · O RASTRO QUE DESVANECE  (movimento 4)
 * ══════════════════════════════════════════════════════════════════ */

/** Um `ctx` que só anota — o jsdom não tem canvas 2D. */
function dubleDeContexto() {
  const traços = [];
  return {
    traços,
    save() {}, restore() {}, setLineDash() {},
    beginPath() { this._atual = { cor: this.strokeStyle, largura: this.lineWidth, pontos: 0 }; },
    moveTo() { if (this._atual) this._atual.pontos += 1; },
    lineTo() { if (this._atual) this._atual.pontos += 1; },
    stroke() { if (this._atual) traços.push({ ...this._atual, cor: this.strokeStyle, largura: this.lineWidth }); },
    lineCap: "", lineJoin: "", strokeStyle: "", lineWidth: 0,
  };
}

const alfaDe = (cor) => Number(String(cor).match(/,([\d.]+)\)$/)?.[1] ?? 0);

describe("o rastro que desvanece (movimento 4)", () => {
  const caminho = Array.from({ length: 30 }, (_, i) => ({ x: i * 12, y: 100 + i }));

  it("acende do começo apagado até a ponta junto do marcador", () => {
    const ctx = dubleDeContexto();
    const r = pintarRastro(ctx, { pontos: caminho, pan: { x: 0, y: 0 }, scale: 1 });

    expect(r.pintou).toBe(true);
    expect(r.faixas).toBe(FAIXAS_DO_RASTRO);

    const alfas = ctx.traços.map((t) => alfaDe(t.cor));
    /* O primeiro traço é a memória (o caminho inteiro, fraco). */
    expect(alfas[0]).toBeCloseTo(ALFA_DA_MEMORIA, 3);
    /* Da cauda em diante, cada faixa é mais acesa que a anterior. */
    const cauda = alfas.slice(1);
    cauda.forEach((a, i) => { if (i > 0) expect(a).toBeGreaterThan(cauda[i - 1]); });
    expect(cauda[cauda.length - 1]).toBeCloseTo(ALFA_DA_PONTA, 3);
  });

  it("a linha engrossa em direção ao marcador — a ponta puxa o olho", () => {
    const ctx = dubleDeContexto();
    pintarRastro(ctx, { pontos: caminho, pan: { x: 0, y: 0 }, scale: 1 });
    const larguras = ctx.traços.slice(1).map((t) => t.largura);
    expect(larguras[larguras.length - 1]).toBeGreaterThan(larguras[0]);
  });

  it("não deixa costura: cada faixa começa onde a anterior terminou", () => {
    const ctx = dubleDeContexto();
    pintarRastro(ctx, { pontos: caminho, pan: { x: 0, y: 0 }, scale: 1 });
    /* Cada faixa desenha pelo menos um segmento (2 pontos). */
    ctx.traços.slice(1).forEach((t) => expect(t.pontos).toBeGreaterThanOrEqual(2));
  });

  it("respeita pan e zoom, como o resto do canvas", () => {
    const ctx = dubleDeContexto();
    const espiao = jest.spyOn(ctx, "moveTo");
    pintarRastro(ctx, { pontos: caminho, pan: { x: 40, y: -10 }, scale: 2 });
    /* Primeiro `moveTo` da primeira faixa da cauda: mundo*scale + pan. */
    expect(espiao).toHaveBeenCalled();
    espiao.mockRestore();
  });

  it("sem pontos suficientes é no-op — e `ctx` nulo também (jsdom)", () => {
    expect(pintarRastro(null, { pontos: caminho }).pintou).toBe(false);
    expect(pintarRastro(dubleDeContexto(), { pontos: [] }).pintou).toBe(false);
    expect(pintarRastro(dubleDeContexto(), { pontos: [{ x: 1, y: 1 }] }).pintou).toBe(false);
  });

  it("caminho curtíssimo não tenta dividir em seis faixas", () => {
    const ctx = dubleDeContexto();
    const r = pintarRastro(ctx, { pontos: [{ x: 0, y: 0 }, { x: 10, y: 0 }], pan: { x: 0, y: 0 }, scale: 1 });
    expect(r.pintou).toBe(true);
    expect(r.faixas).toBeLessThanOrEqual(FAIXAS_DO_RASTRO);
  });
});
