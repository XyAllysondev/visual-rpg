/**
 * Gate da FRANJA DE TINTA (spec 0035 · F1 · AC-4, AC-5, AC-6, AC-7).
 *
 * A fronteira do revelado deixa de ser um desfoque e vira traço de pena. Aqui
 * se prova que o contorno é só a casca, que os traços são os MESMOS toda vez
 * (senão a borda ferve na tela) e que nada além da própria máscara entra na
 * conta — o que é o AC-7, e é o que impede a franja de virar oráculo de segredo.
 */
import { criarMascara, revelarCirculo, revelarTudo, celulaAcesa } from "../model/fogMask";
import {
  COMPRIMENTO_DO_TRACO,
  DESVIO_LATERAL,
  SEMENTE_PADRAO,
  VARIACAO_DO_COMPRIMENTO,
  contornoDaMascara,
  franjaDaMascara,
  tracosDaFranja,
} from "../model/franja";

/** Mapa pequeno, escala 4 → grade de 25×25. Barato e ainda assim realista. */
const nova = () => criarMascara(100, 100, 4);

describe("celulaAcesa", () => {
  it("lê a grade e trata o lado de fora como coberto", () => {
    const m = nova();
    revelarCirculo(m, 50, 50, 12);
    expect(celulaAcesa(m, 12, 12)).toBe(true);
    expect(celulaAcesa(m, -1, 12)).toBe(false);
    expect(celulaAcesa(m, 999, 12)).toBe(false);
    expect(celulaAcesa(null, 0, 0)).toBe(false);
  });
});

describe("contornoDaMascara", () => {
  it("devolve só a casca, nunca o miolo (AC-4)", () => {
    const m = nova();
    revelarCirculo(m, 50, 50, 20);
    const contorno = contornoDaMascara(m);

    expect(contorno.length).toBeGreaterThan(0);
    contorno.forEach(({ cx, cy }) => {
      // toda célula do contorno está revelada...
      expect(celulaAcesa(m, cx, cy)).toBe(true);
      // ...e tem ao menos um vizinho coberto
      const vizinhoCoberto =
        !celulaAcesa(m, cx - 1, cy) || !celulaAcesa(m, cx + 1, cy) ||
        !celulaAcesa(m, cx, cy - 1) || !celulaAcesa(m, cx, cy + 1);
      expect(vizinhoCoberto).toBe(true);
    });

    // O centro do círculo é miolo e NÃO pode estar na lista.
    const centro = contorno.find((c) => c.cx === 12 && c.cy === 12);
    expect(centro).toBeUndefined();
  });

  it("é o perímetro, não a área — bem menor que o total revelado", () => {
    const m = nova();
    revelarCirculo(m, 50, 50, 30);

    let reveladas = 0;
    for (let cy = 0; cy < m.linhas; cy += 1) {
      for (let cx = 0; cx < m.colunas; cx += 1) if (celulaAcesa(m, cx, cy)) reveladas += 1;
    }
    expect(contornoDaMascara(m).length).toBeLessThan(reveladas / 2);
  });

  it("o normal aponta para fora e tem norma 1", () => {
    const m = nova();
    revelarCirculo(m, 50, 50, 20);
    contornoDaMascara(m).forEach(({ nx, ny }) => {
      expect(Math.hypot(nx, ny)).toBeCloseTo(1, 6);
    });
  });

  it("máscara vazia não tem contorno (AC-6)", () => {
    expect(contornoDaMascara(nova())).toEqual([]);
  });

  it("máscara totalmente revelada só tem a moldura da grade (AC-6)", () => {
    // Sem célula coberta no miolo não há fronteira; a borda do bitmap conta
    // como coberta, então sobra só o anel externo — e ele É contorno legítimo.
    const m = nova();
    revelarTudo(m);
    contornoDaMascara(m).forEach(({ cx, cy }) => {
      const naBorda = cx === 0 || cy === 0 || cx === m.colunas - 1 || cy === m.linhas - 1;
      expect(naBorda).toBe(true);
    });
  });

  it("entrada inválida devolve lista vazia em vez de lançar", () => {
    expect(contornoDaMascara(null)).toEqual([]);
    expect(contornoDaMascara({})).toEqual([]);
    expect(contornoDaMascara({ bits: null, colunas: 4, linhas: 4 })).toEqual([]);
  });
});

describe("tracosDaFranja", () => {
  const contornoDe = (raio = 20) => {
    const m = nova();
    revelarCirculo(m, 50, 50, raio);
    return { m, contorno: contornoDaMascara(m) };
  };

  it("é determinística — mesma máscara e mesma semente, mesmos traços (AC-5)", () => {
    const { contorno } = contornoDe();
    const a = tracosDaFranja(contorno, { escala: 4, semente: 123 });
    const b = tracosDaFranja(contorno, { escala: 4, semente: 123 });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("duas máscaras iguais produzem franjas iguais", () => {
    const um = contornoDe();
    const dois = contornoDe();
    expect(franjaDaMascara(um.m)).toEqual(franjaDaMascara(dois.m));
  });

  it("o traço de um lugar não muda quando a região cresce em outro canto", () => {
    // É o que impede a borda antiga de piscar a cada revelação nova.
    const m = nova();
    revelarCirculo(m, 30, 30, 10);
    const antes = franjaDaMascara(m);
    const alvo = antes[0];

    revelarCirculo(m, 80, 80, 8); // outra ilha, longe da primeira
    const depois = franjaDaMascara(m);

    const igual = depois.find(
      (t) => Math.abs(t.x1 - alvo.x1) < 1e-9 && Math.abs(t.y1 - alvo.y1) < 1e-9,
    );
    expect(igual).toBeDefined();
    expect(igual).toEqual(alvo);
  });

  it("sementes diferentes desenham caligrafias diferentes", () => {
    const { contorno } = contornoDe();
    const a = tracosDaFranja(contorno, { escala: 4, semente: 1 });
    const b = tracosDaFranja(contorno, { escala: 4, semente: 2 });
    expect(a).toHaveLength(b.length);
    expect(a).not.toEqual(b);
  });

  it("os traços são irregulares — não é contorno de software", () => {
    const { contorno } = contornoDe(30);
    const comprimentos = tracosDaFranja(contorno, { escala: 4 })
      .map((t) => Math.hypot(t.x2 - t.x1, t.y2 - t.y1));
    const menor = Math.min(...comprimentos);
    const maior = Math.max(...comprimentos);
    expect(maior).toBeGreaterThan(menor); // varia de verdade
    // ...mas dentro da faixa declarada, sem traço absurdo
    const teto = (COMPRIMENTO_DO_TRACO + VARIACAO_DO_COMPRIMENTO) * 4 + 1e-6;
    const piso = (COMPRIMENTO_DO_TRACO - VARIACAO_DO_COMPRIMENTO) * 4 - 1e-6;
    expect(maior).toBeLessThanOrEqual(teto);
    expect(menor).toBeGreaterThanOrEqual(piso);
  });

  it("a escala leva os traços para coordenadas de mundo", () => {
    const { contorno } = contornoDe();
    const um = tracosDaFranja(contorno, { escala: 1, semente: 7 });
    const quatro = tracosDaFranja(contorno, { escala: 4, semente: 7 });
    expect(quatro[0].x1).toBeCloseTo(um[0].x1 * 4, 6);
    expect(quatro[0].y2).toBeCloseTo(um[0].y2 * 4, 6);
  });

  it("o desvio LATERAL respeita o teto declarado", () => {
    /* Só a componente perpendicular à normal é "desvio lateral". Ao longo da
       normal o traço é assimétrico de propósito — 0,35 para dentro e 0,65 para
       fora, porque pena que marca fronteira morde para fora. Medir a distância
       crua ao centro misturaria as duas coisas. */
    const { contorno } = contornoDe();
    const escala = 4;
    tracosDaFranja(contorno, { escala }).forEach((t, i) => {
      const c = contorno[i];
      const meioX = (t.x1 + t.x2) / 2;
      const meioY = (t.y1 + t.y2) / 2;
      const dx = meioX - (c.cx + 0.5) * escala;
      const dy = meioY - (c.cy + 0.5) * escala;
      const lateral = Math.abs(dx * -c.ny + dy * c.nx); // projeção na perpendicular
      expect(lateral).toBeLessThanOrEqual(DESVIO_LATERAL * escala + 1e-6);
    });
  });

  it("o traço morde mais para fora do que para dentro", () => {
    /* É o que diferencia franja de contorno centrado: a tinta transborda a
       fronteira, ela não a ladeia. */
    const { contorno } = contornoDe();
    const escala = 4;
    tracosDaFranja(contorno, { escala }).forEach((t, i) => {
      const c = contorno[i];
      const centroX = (c.cx + 0.5) * escala;
      const centroY = (c.cy + 0.5) * escala;
      const paraDentro = (t.x1 - centroX) * c.nx + (t.y1 - centroY) * c.ny;
      const paraFora = (t.x2 - centroX) * c.nx + (t.y2 - centroY) * c.ny;
      expect(paraFora).toBeGreaterThan(Math.abs(paraDentro));
    });
  });

  it("nunca devolve NaN — o canvas não desenha número inválido", () => {
    const { contorno } = contornoDe();
    tracosDaFranja(contorno, { escala: 4 }).forEach((t) => {
      [t.x1, t.y1, t.x2, t.y2].forEach((v) => expect(Number.isFinite(v)).toBe(true));
    });
  });

  it("contorno vazio ou inválido não produz traço (AC-6)", () => {
    expect(tracosDaFranja([])).toEqual([]);
    expect(tracosDaFranja(null)).toEqual([]);
    expect(tracosDaFranja([{ cx: NaN, cy: 1, nx: 1, ny: 0 }])).toEqual([]);
    expect(tracosDaFranja([{ cx: 1, cy: 1, nx: 0, ny: 0 }])).toEqual([]);
  });

  it("não usa Math.random — o teste seria impossível e a borda ferveria", () => {
    const original = Math.random;
    Math.random = () => { throw new Error("Math.random é proibido no model/"); };
    try {
      const { m } = contornoDe();
      expect(() => franjaDaMascara(m)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });
});

describe("franjaDaMascara", () => {
  it("usa a escala da própria máscara", () => {
    const m = nova();
    revelarCirculo(m, 50, 50, 20);
    expect(franjaDaMascara(m)).toEqual(
      tracosDaFranja(contornoDaMascara(m), { escala: m.escala, semente: SEMENTE_PADRAO }),
    );
  });

  it("máscara vazia devolve lista vazia (AC-6)", () => {
    expect(franjaDaMascara(nova())).toEqual([]);
    expect(franjaDaMascara(null)).toEqual([]);
  });

  it("só a máscara entra na conta — nada de molde nem de grafo (AC-7)", () => {
    // A assinatura tem exatamente dois parâmetros: máscara e semente. Não há
    // por onde um segredo do molde entrar, e é isso que o AC-7 exige.
    expect(franjaDaMascara).toHaveLength(2);
  });
});
