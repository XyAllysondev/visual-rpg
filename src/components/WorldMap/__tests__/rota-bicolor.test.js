/**
 * Gate da ROTA BICOLOR (spec 0035 · F1 · AC-1, AC-2).
 *
 * A rota da viagem deixa de ser um traço só: o que falta andar sai no dourado
 * da trilha, o que já foi andado sai no acento do tema. Aqui se prova que as
 * duas metades se encaixam, que a ordem da pintura é a certa e que o canvas
 * ausente (jsdom) continua sendo no-op em vez de exceção.
 *
 * Nada de React aqui — só a matemática e o contrato com o contexto 2d.
 */
import { trechoPercorrido, trechoRestante } from "../model/viagem";
import { comprimentoDaCurva } from "../model/curves";
import {
  COR_DA_ROTA_RESTANTE,
  RGB_DO_PERCORRIDO_RESERVA,
  pintarRotaBicolor,
  rgbDeCor,
} from "../Mesa/animacaoUi";

/* Trilha reta de 100 unidades, em quatro pontos irregulares — segmentos de
   tamanhos diferentes separam "cortou por comprimento" de "cortou por índice". */
const PONTOS = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 40, y: 0 },
  { x: 100, y: 0 },
];

const viagemEm = (progresso) => ({ id: "v1", pontos: PONTOS, progresso });

/** Contexto 2d de mentira que anota tudo o que recebeu. */
function ctxFalso() {
  const chamadas = { strokeStyle: [], stroke: 0, moveTo: [], lineTo: [] };
  return {
    chamadas,
    save() {}, restore() {},
    setLineDash() {},
    beginPath() {},
    moveTo(x, y) { chamadas.moveTo.push({ x, y }); },
    lineTo(x, y) { chamadas.lineTo.push({ x, y }); },
    stroke() { chamadas.stroke += 1; chamadas.strokeStyle.push(this.strokeStyle); },
    set strokeStyle(v) { this._ss = v; },
    get strokeStyle() { return this._ss; },
    lineWidth: 0, lineCap: "", lineJoin: "",
  };
}

describe("trechoRestante", () => {
  it("é a outra metade de trechoPercorrido — as duas somam a trilha inteira", () => {
    const total = comprimentoDaCurva(PONTOS);
    [0.15, 0.4, 0.5, 0.77].forEach((t) => {
      const andado = comprimentoDaCurva(trechoPercorrido(viagemEm(t)));
      const falta = comprimentoDaCurva(trechoRestante(viagemEm(t)));
      expect(andado + falta).toBeCloseTo(total, 6);
    });
  });

  it("começa exatamente onde o percorrido termina — sem vão sob o marcador", () => {
    const andado = trechoPercorrido(viagemEm(0.63));
    const falta = trechoRestante(viagemEm(0.63));
    const fim = andado[andado.length - 1];
    expect(falta[0].x).toBeCloseTo(fim.x, 6);
    expect(falta[0].y).toBeCloseTo(fim.y, 6);
  });

  it("sempre termina no destino", () => {
    [0, 0.3, 0.9].forEach((t) => {
      const falta = trechoRestante(viagemEm(t));
      expect(falta[falta.length - 1]).toEqual({ x: 100, y: 0 });
    });
  });

  it("no começo é a trilha inteira; no fim, só o destino", () => {
    expect(trechoRestante(viagemEm(0))).toHaveLength(PONTOS.length);
    expect(trechoRestante(viagemEm(1))).toEqual([{ x: 100, y: 0 }]);
  });

  it("aceita a fração por parâmetro, como trechoPercorrido", () => {
    expect(trechoRestante(viagemEm(0.9), 0.25)).toEqual(trechoRestante(viagemEm(0.25)));
  });

  it("viagem sem pontos devolve lista vazia em vez de lançar", () => {
    expect(trechoRestante(null)).toEqual([]);
    expect(trechoRestante({ pontos: [], progresso: 0.5 })).toEqual([]);
  });
});

describe("rgbDeCor", () => {
  it("lê hexadecimal de 6 e de 3 dígitos", () => {
    expect(rgbDeCor("#c9a84c")).toBe("201,168,76");
    expect(rgbDeCor("c9a84c")).toBe("201,168,76");
    expect(rgbDeCor("#fff")).toBe("255,255,255");
  });

  it("lê rgb() e rgba(), que é o que o getComputedStyle costuma devolver", () => {
    expect(rgbDeCor("rgb(201, 168, 76)")).toBe("201,168,76");
    expect(rgbDeCor("rgba(176, 48, 216, 0.8)")).toBe("176,48,216");
  });

  it("cai na reserva em vez de devolver cor inválida — trilha invisível é pior", () => {
    [null, undefined, "", "   ", "var(--gold)", "salmão"].forEach((v) => {
      expect(rgbDeCor(v)).toBe(RGB_DO_PERCORRIDO_RESERVA);
    });
  });
});

describe("pintarRotaBicolor", () => {
  it("pinta as duas metades e diz o que pintou (AC-1)", () => {
    const ctx = ctxFalso();
    const saida = pintarRotaBicolor(ctx, {
      percorrido: trechoPercorrido(viagemEm(0.5)),
      restante: trechoRestante(viagemEm(0.5)),
      pan: { x: 0, y: 0 }, scale: 1,
      corDoPercorrido: "#b030d8",
    });

    expect(saida).toEqual({ pintou: true, pintouRestante: true, pintouPercorrido: true });
    expect(ctx.chamadas.stroke).toBeGreaterThan(1);
  });

  it("o restante sai no dourado da trilha, e ANTES do percorrido", () => {
    const ctx = ctxFalso();
    pintarRotaBicolor(ctx, {
      percorrido: trechoPercorrido(viagemEm(0.5)),
      restante: trechoRestante(viagemEm(0.5)),
      pan: { x: 0, y: 0 }, scale: 1,
      corDoPercorrido: "#b030d8",
    });

    // O primeiro traço é o dourado do que falta: quem chega depois manda no
    // pixel do corte, e o corte é onde o marcador está.
    expect(ctx.chamadas.strokeStyle[0]).toBe(COR_DA_ROTA_RESTANTE);
    expect(ctx.chamadas.strokeStyle.slice(1).some((c) => String(c).includes("176,48,216"))).toBe(true);
  });

  it("o percorrido usa o acento do tema, não o dourado do rastro", () => {
    const ctx = ctxFalso();
    pintarRotaBicolor(ctx, {
      percorrido: trechoPercorrido(viagemEm(0.8)),
      restante: [],
      pan: { x: 0, y: 0 }, scale: 1,
      corDoPercorrido: "rgb(176, 48, 216)",
    });
    const tintas = ctx.chamadas.strokeStyle.map(String);
    expect(tintas.every((c) => !c.includes("233,213,160"))).toBe(true);
    expect(tintas.some((c) => c.includes("176,48,216"))).toBe(true);
  });

  it("fora de viagem não pinta nada", () => {
    const ctx = ctxFalso();
    expect(pintarRotaBicolor(ctx, { percorrido: [], restante: [] })).toEqual({
      pintou: false, pintouRestante: false, pintouPercorrido: false,
    });
    expect(ctx.chamadas.stroke).toBe(0);
  });

  it("no comecinho da viagem só o restante aparece", () => {
    const ctx = ctxFalso();
    const saida = pintarRotaBicolor(ctx, {
      percorrido: trechoPercorrido(viagemEm(0)),   // um ponto só
      restante: trechoRestante(viagemEm(0)),
      pan: { x: 0, y: 0 }, scale: 1,
    });
    expect(saida.pintouRestante).toBe(true);
    expect(saida.pintouPercorrido).toBe(false);
  });

  it("ctx nulo é no-op, não exceção (jsdom não tem contexto 2d)", () => {
    expect(pintarRotaBicolor(null, { percorrido: PONTOS, restante: PONTOS })).toEqual({
      pintou: false, pintouRestante: false, pintouPercorrido: false,
    });
    expect(pintarRotaBicolor({}, { percorrido: PONTOS })).toEqual({
      pintou: false, pintouRestante: false, pintouPercorrido: false,
    });
  });

  it("descarta ponto inválido em vez de desenhar NaN no canvas", () => {
    const ctx = ctxFalso();
    pintarRotaBicolor(ctx, {
      percorrido: [{ x: 0, y: 0 }, { x: NaN, y: 2 }, { x: 50, y: 0 }],
      restante: [{ x: 50, y: 0 }, { x: 100, y: 0 }],
      pan: { x: 0, y: 0 }, scale: 1,
    });
    [...ctx.chamadas.moveTo, ...ctx.chamadas.lineTo].forEach((p) => {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    });
  });
});
