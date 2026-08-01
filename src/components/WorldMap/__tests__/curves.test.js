/**
 * Gate da matemática de curva do Mapa-Múndi (spec 0028 · AC-4, F2).
 * Escrito ANTES da implementação. Nada de React, Firebase ou DOM aqui.
 */
import {
  AMOSTRAS_PADRAO,
  comprimentoDaCurva,
  controlePadrao,
  distanciaAoSegmento,
  distanciaAteCurva,
  pontoNaFracao,
  pontosDaCurva,
} from "../model/curves";

const A = { x: 0, y: 0 };
const B = { x: 100, y: 0 };

describe("pontosDaCurva", () => {
  it("sem controles devolve a reta — só as duas pontas", () => {
    expect(pontosDaCurva(A, B)).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(pontosDaCurva(A, B, [])).toHaveLength(2);
    expect(pontosDaCurva(A, B, null)).toHaveLength(2);
  });

  it("um controle amostra uma Bézier quadrática", () => {
    const pts = pontosDaCurva(A, B, [{ x: 50, y: 100 }]);
    expect(pts).toHaveLength(AMOSTRAS_PADRAO + 1);
    // as pontas são exatas
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 0 });
    // o meio é puxado na direção do controle (mas não chega nele)
    const meio = pts[AMOSTRAS_PADRAO / 2];
    expect(meio.y).toBeGreaterThan(0);
    expect(meio.y).toBeLessThan(100);
    expect(meio.x).toBeCloseTo(50, 6);
  });

  it("dois controles amostram uma Bézier cúbica", () => {
    const pts = pontosDaCurva(A, B, [{ x: 0, y: 60 }, { x: 100, y: 60 }]);
    expect(pts).toHaveLength(AMOSTRAS_PADRAO + 1);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 0 });
    expect(pts[AMOSTRAS_PADRAO / 2].y).toBeCloseTo(45, 6); // 3/4 de 60 no t=0.5
  });

  it("mais de dois controles usa os dois primeiros, sem quebrar", () => {
    const pts = pontosDaCurva(A, B, [{ x: 0, y: 60 }, { x: 100, y: 60 }, { x: 9, y: 9 }]);
    expect(pts).toHaveLength(AMOSTRAS_PADRAO + 1);
    expect(pts[AMOSTRAS_PADRAO / 2].y).toBeCloseTo(45, 6);
  });

  it("aceita número de amostras customizado", () => {
    expect(pontosDaCurva(A, B, [{ x: 50, y: 50 }], 4)).toHaveLength(5);
  });

  it("ignora controles malformados", () => {
    const pts = pontosDaCurva(A, B, [null, { x: "a", y: 2 }]);
    expect(pts).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  });

  it("recusa pontas inválidas com mensagem em português", () => {
    expect(() => pontosDaCurva(null, B)).toThrow(/inválid/i);
    expect(() => pontosDaCurva(A, { x: 1 })).toThrow(/números finitos/i);
    expect(() => pontosDaCurva(A, { x: NaN, y: 0 })).toThrow(Error);
  });
});

describe("comprimentoDaCurva", () => {
  it("soma os segmentos da polilinha", () => {
    expect(comprimentoDaCurva([A, B])).toBe(100);
    expect(comprimentoDaCurva([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 14 }])).toBe(15);
  });

  it("devolve 0 para lista vazia, um ponto só ou entrada inválida", () => {
    expect(comprimentoDaCurva([])).toBe(0);
    expect(comprimentoDaCurva([A])).toBe(0);
    expect(comprimentoDaCurva(null)).toBe(0);
  });

  it("a curva é mais longa que a corda entre as pontas", () => {
    const pts = pontosDaCurva(A, B, [{ x: 50, y: 80 }]);
    expect(comprimentoDaCurva(pts)).toBeGreaterThan(100);
  });
});

describe("pontoNaFracao", () => {
  const curva = pontosDaCurva(A, B, [{ x: 50, y: 80 }]);

  it("t=0 e t=1 batem com as pontas", () => {
    expect(pontoNaFracao(curva, 0)).toEqual({ x: 0, y: 0 });
    const fim = pontoNaFracao(curva, 1);
    expect(fim.x).toBeCloseTo(100, 9);
    expect(fim.y).toBeCloseTo(0, 9);
  });

  it("interpola pela metade numa reta", () => {
    expect(pontoNaFracao([A, B], 0.5)).toEqual({ x: 50, y: 0 });
    expect(pontoNaFracao([A, B], 0.25)).toEqual({ x: 25, y: 0 });
  });

  it("faz clamp de t fora de [0,1] e de t inválido", () => {
    expect(pontoNaFracao([A, B], -3)).toEqual({ x: 0, y: 0 });
    expect(pontoNaFracao([A, B], 9)).toEqual({ x: 100, y: 0 });
    expect(pontoNaFracao([A, B], NaN)).toEqual({ x: 0, y: 0 });
  });

  it("anda em velocidade constante — passos iguais de t percorrem distâncias iguais", () => {
    const suave = pontosDaCurva(A, B, [controlePadrao(A, B)]);
    const passos = 10;
    const trechos = [];
    for (let i = 0; i < passos; i++) {
      const p = pontoNaFracao(suave, i / passos);
      const q = pontoNaFracao(suave, (i + 1) / passos);
      trechos.push(Math.hypot(q.x - p.x, q.y - p.y));
    }
    const soma = trechos.reduce((s, d) => s + d, 0);
    const media = soma / trechos.length;
    trechos.forEach((d) => expect(Math.abs(d - media) / media).toBeLessThan(0.02));
    // e a soma cobre o comprimento total (erro só da poligonal mais grossa)
    const total = comprimentoDaCurva(suave);
    expect(Math.abs(soma - total) / total).toBeLessThan(0.01);
  });

  it("é diferente do parâmetro cru da Bézier (que anda mais rápido no meio)", () => {
    // numa quadrática assimétrica, arco e parâmetro divergem
    const assim = pontosDaCurva(A, B, [{ x: 95, y: 60 }]);
    const porArco = pontoNaFracao(assim, 0.5);
    const porParametro = assim[AMOSTRAS_PADRAO / 2];
    expect(Math.hypot(porArco.x - porParametro.x, porArco.y - porParametro.y)).toBeGreaterThan(1);
  });

  it("degenerados: um ponto só devolve ele; vazio lança erro em português", () => {
    expect(pontoNaFracao([{ x: 7, y: 9 }], 0.4)).toEqual({ x: 7, y: 9 });
    expect(pontoNaFracao([A, { x: 0, y: 0 }], 0.7)).toEqual({ x: 0, y: 0 });
    expect(() => pontoNaFracao([], 0.5)).toThrow(/curva precisa/i);
  });
});

describe("distanciaAoSegmento", () => {
  it("mede a perpendicular quando a projeção cai dentro do segmento", () => {
    expect(distanciaAoSegmento({ x: 50, y: 10 }, A, B)).toBeCloseTo(10, 9);
  });
  it("mede até a ponta quando a projeção cai fora", () => {
    expect(distanciaAoSegmento({ x: -10, y: 0 }, A, B)).toBeCloseTo(10, 9);
    expect(distanciaAoSegmento({ x: 130, y: 0 }, A, B)).toBeCloseTo(30, 9);
  });
  it("segmento degenerado vira distância ao ponto", () => {
    expect(distanciaAoSegmento({ x: 3, y: 4 }, A, A)).toBeCloseTo(5, 9);
  });
});

describe("distanciaAteCurva", () => {
  const curva = pontosDaCurva(A, B, [{ x: 50, y: 80 }]);

  it("é ~0 para um ponto que está sobre a curva", () => {
    const sobre = pontoNaFracao(curva, 0.37);
    expect(distanciaAteCurva(sobre, curva)).toBeLessThan(0.5);
  });

  it("mede a menor distância para um ponto fora", () => {
    expect(distanciaAteCurva({ x: 50, y: 10 }, [A, B])).toBeCloseTo(10, 9);
    expect(distanciaAteCurva({ x: 200, y: 0 }, [A, B])).toBeCloseTo(100, 9);
  });

  it("entrada inútil devolve Infinity em vez de explodir", () => {
    expect(distanciaAteCurva({ x: 0, y: 0 }, [])).toBe(Infinity);
    expect(distanciaAteCurva(null, [A, B])).toBe(Infinity);
  });

  it("com um ponto só, mede até ele", () => {
    expect(distanciaAteCurva({ x: 0, y: 5 }, [A])).toBeCloseTo(5, 9);
  });
});

describe("controlePadrao", () => {
  it("é determinístico — mesma entrada, mesmo controle", () => {
    expect(controlePadrao(A, B)).toEqual(controlePadrao(A, B));
  });

  it("sai da reta, gerando curvatura suave", () => {
    const c = controlePadrao(A, B);
    expect(c.x).toBeCloseTo(50, 9);
    expect(Math.abs(c.y)).toBeGreaterThan(0);
    expect(Math.abs(c.y)).toBeLessThan(50); // suave, não um laço
  });

  it("a curva resultante não é a reta", () => {
    const pts = pontosDaCurva(A, B, [controlePadrao(A, B)]);
    expect(comprimentoDaCurva(pts)).toBeGreaterThan(100);
  });

  it("escala com o comprimento da trilha", () => {
    const curto = controlePadrao(A, B);
    const longo = controlePadrao(A, { x: 400, y: 0 });
    expect(Math.abs(longo.y)).toBeCloseTo(Math.abs(curto.y) * 4, 6);
  });

  it("pontas coincidentes devolvem o próprio ponto", () => {
    expect(controlePadrao({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });

  it("recusa pontas inválidas", () => {
    expect(() => controlePadrao(null, B)).toThrow(/inválid/i);
  });
});
