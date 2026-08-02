/**
 * Gate da VIAGEM (spec 0028 · AC-6, AC-8, AC-11 movimento 4 · F4).
 *
 * Escrito **antes** da implementação. O que estes testes travam:
 *  · o marcador anda em **velocidade constante** (é o que faz a viagem parecer
 *    viagem, e não um pulo que acelera nas curvas);
 *  · a névoa abre **ao longo do trecho já percorrido** — "ir desbloqueando o
 *    mapa aos pouquinhos", não só na chegada;
 *  · relógio e suprimentos são aritmética pura, sem `Date.now()`.
 */
import { comprimentoDaCurva } from "../model/curves";
import { contarReveladas, criarMascara } from "../model/fogMask";
import { criarGrafo, criarNo, criarTrilha } from "../model/graph";
import {
  avancarRelogio,
  avancarViagem,
  consumirSuprimentos,
  horasDecorridas,
  iniciarViagem,
  nevoaDaViagem,
  trechoPercorrido,
} from "../model/viagem";

/*  a (100,100) ───── t1 (reta, 4h) ───── b (900,100)
 *  b ───── t2 (curvada, 6h) ───── c (900,900)
 *  d (100,100) — no mesmo lugar de "a", para o caso de comprimento zero        */
function grafoBase() {
  const nos = [
    criarNo({ id: "a", x: 100, y: 100, name: "A" }),
    criarNo({ id: "b", x: 900, y: 100, name: "B" }),
    criarNo({ id: "c", x: 900, y: 900, name: "C" }),
    criarNo({ id: "d", x: 100, y: 100, name: "D" }),
  ];
  const trilhas = [
    criarTrilha({ id: "t1", fromId: "a", toId: "b", travelHours: 4 }),
    criarTrilha({
      id: "t2",
      fromId: "b",
      toId: "c",
      travelHours: 6,
      pathPoints: [{ x: 1400, y: 500 }],
    }),
    criarTrilha({ id: "t3", fromId: "a", toId: "d", travelHours: 1 }),
  ];
  return criarGrafo({ nos, trilhas });
}

const trilhaDe = (id) => grafoBase().trilhas.find((t) => t.id === id);

/* ═══════════════════════════════════════════════════════════════════════
 * 1. iniciarViagem
 * ═══════════════════════════════════════════════════════════════════════ */

describe("iniciarViagem", () => {
  it("nasce parada, no comprimento e nas horas da trilha", () => {
    const v = iniciarViagem(grafoBase(), "a", "b", trilhaDe("t1"));
    expect(v.progresso).toBe(0);
    expect(v.horas).toBe(4);
    expect(v.comprimento).toBe(800);
    expect(v.chegou).toBe(false);
  });

  it("os pontos vão do nó de origem ao nó de destino, nessa ordem", () => {
    const v = iniciarViagem(grafoBase(), "a", "b", trilhaDe("t1"));
    expect(v.pontos[0]).toEqual({ x: 100, y: 100 });
    expect(v.pontos[v.pontos.length - 1]).toEqual({ x: 900, y: 100 });
  });

  it("INVERTE quando a trilha está gravada ao contrário do sentido da viagem", () => {
    const v = iniciarViagem(grafoBase(), "b", "a", trilhaDe("t1"));
    expect(v.pontos[0]).toEqual({ x: 900, y: 100 });
    expect(v.pontos[v.pontos.length - 1]).toEqual({ x: 100, y: 100 });
    expect(v.comprimento).toBe(800);
  });

  it("a trilha curvada é amostrada, não virada em reta", () => {
    const v = iniciarViagem(grafoBase(), "b", "c", trilhaDe("t2"));
    expect(v.pontos.length).toBeGreaterThan(2);
    expect(v.comprimento).toBeGreaterThan(800);
    expect(v.comprimento).toBeCloseTo(comprimentoDaCurva(v.pontos), 6);
  });

  it("a curva invertida tem o mesmo comprimento da curva no sentido original", () => {
    const ida = iniciarViagem(grafoBase(), "b", "c", trilhaDe("t2"));
    const volta = iniciarViagem(grafoBase(), "c", "b", trilhaDe("t2"));
    expect(volta.comprimento).toBeCloseTo(ida.comprimento, 6);
    expect(volta.pontos[0]).toEqual(ida.pontos[ida.pontos.length - 1]);
  });

  it("guarda de onde veio, para onde vai e por qual trilha", () => {
    const v = iniciarViagem(grafoBase(), "a", "b", trilhaDe("t1"));
    expect(v.deId).toBe("a");
    expect(v.paraId).toBe("b");
    expect(v.trilhaId).toBe("t1");
    expect(v.posicao).toEqual({ x: 100, y: 100 });
  });

  it("acha a trilha sozinha quando não recebe uma", () => {
    const v = iniciarViagem(grafoBase(), "a", "b");
    expect(v.trilhaId).toBe("t1");
  });

  it("recusa em português quando não há trilha ligando os dois", () => {
    expect(() => iniciarViagem(grafoBase(), "a", "c")).toThrow(/trilha/i);
  });

  it("recusa quando um dos nós não existe", () => {
    expect(() => iniciarViagem(grafoBase(), "a", "fantasma")).toThrow(/nó|no\b/i);
  });

  it("dois nós no mesmo lugar dão comprimento zero — e a viagem já nasce chegada", () => {
    const v = iniciarViagem(grafoBase(), "a", "d", trilhaDe("t3"));
    expect(v.comprimento).toBe(0);
    expect(v.chegou).toBe(true);
  });

  it("não muta o grafo", () => {
    const g = grafoBase();
    const copia = JSON.parse(JSON.stringify(g));
    iniciarViagem(g, "a", "b");
    expect(g).toEqual(copia);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 2. avancarViagem — o coração do movimento 4 do AC-11
 * ═══════════════════════════════════════════════════════════════════════ */

describe("avancarViagem", () => {
  const viagemReta = () => iniciarViagem(grafoBase(), "a", "b", trilhaDe("t1"));

  it("anda a distância pedida: dt × velocidade em unidades de mundo", () => {
    const v = avancarViagem(viagemReta(), 2, 100);
    expect(v.progresso).toBeCloseTo(200 / 800, 10);
    expect(v.posicao).toEqual({ x: 300, y: 100 });
  });

  it("não muta a viagem recebida", () => {
    const antes = viagemReta();
    avancarViagem(antes, 2, 100);
    expect(antes.progresso).toBe(0);
    expect(antes.posicao).toEqual({ x: 100, y: 100 });
  });

  it("o progresso é MONOTÔNICO: dez passos seguidos nunca voltam", () => {
    let v = viagemReta();
    let anterior = -1;
    for (let i = 0; i < 10; i += 1) {
      v = avancarViagem(v, 1, 50);
      expect(v.progresso).toBeGreaterThanOrEqual(anterior);
      anterior = v.progresso;
    }
  });

  it("dt negativo não faz o grupo andar para trás", () => {
    const v = avancarViagem(avancarViagem(viagemReta(), 2, 100), -5, 100);
    expect(v.progresso).toBeCloseTo(200 / 800, 10);
  });

  it("dt ou velocidade inválidos não movem nada", () => {
    expect(avancarViagem(viagemReta(), NaN, 100).progresso).toBe(0);
    expect(avancarViagem(viagemReta(), 1, -3).progresso).toBe(0);
  });

  it("CHEGADA EXATA em t=1: a posição é o nó de destino, sem sobra de ponto flutuante", () => {
    const v = avancarViagem(viagemReta(), 1, 100000);
    expect(v.progresso).toBe(1);
    expect(v.chegou).toBe(true);
    expect(v.posicao).toEqual({ x: 900, y: 100 });
  });

  it("chegou só é verdadeiro no fim", () => {
    expect(avancarViagem(viagemReta(), 1, 100).chegou).toBe(false);
    expect(avancarViagem(viagemReta(), 7.99, 100).chegou).toBe(false);
    expect(avancarViagem(viagemReta(), 8, 100).chegou).toBe(true);
  });

  it("avançar depois de chegar continua chegado, sem passar de 1", () => {
    const v = avancarViagem(avancarViagem(viagemReta(), 8, 100), 8, 100);
    expect(v.progresso).toBe(1);
    expect(v.chegou).toBe(true);
  });

  it("sem velocidade, dt é a FRAÇÃO da viagem inteira (dt=1 completa)", () => {
    expect(avancarViagem(viagemReta(), 0.25).progresso).toBeCloseTo(0.25, 10);
    expect(avancarViagem(viagemReta(), 1).chegou).toBe(true);
  });

  it("comprimento zero chega no primeiro passo, sem divisão por zero", () => {
    const v = avancarViagem(iniciarViagem(grafoBase(), "a", "d", trilhaDe("t3")), 1, 10);
    expect(v.progresso).toBe(1);
    expect(v.chegou).toBe(true);
    expect(Number.isFinite(v.posicao.x)).toBe(true);
  });

  it("VELOCIDADE CONSTANTE numa trilha curvada: passos iguais percorrem trechos iguais", () => {
    let v = iniciarViagem(grafoBase(), "b", "c", trilhaDe("t2"));
    const passos = 8;
    const dt = v.comprimento / passos;
    const cordas = [];
    for (let i = 0; i < passos; i += 1) {
      const antes = v.posicao;
      v = avancarViagem(v, dt, 1);
      cordas.push(Math.hypot(v.posicao.x - antes.x, v.posicao.y - antes.y));
    }
    expect(v.chegou).toBe(true);
    const maior = Math.max(...cordas);
    const menor = Math.min(...cordas);
    // Com parâmetro cru de Bézier essa razão passaria de 1,5 numa curva destas.
    expect(maior / menor).toBeLessThan(1.05);
  });

  it("o progresso cresce em passos iguais para dt iguais", () => {
    let v = iniciarViagem(grafoBase(), "b", "c", trilhaDe("t2"));
    const dt = 10;
    const um = avancarViagem(v, dt, 1);
    const dois = avancarViagem(um, dt, 1);
    expect(dois.progresso - um.progresso).toBeCloseTo(um.progresso - v.progresso, 10);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 3. A névoa abrindo aos pouquinhos
 * ═══════════════════════════════════════════════════════════════════════ */

describe("trechoPercorrido", () => {
  it("no começo é só o ponto de partida", () => {
    const v = iniciarViagem(grafoBase(), "a", "b", trilhaDe("t1"));
    expect(trechoPercorrido(v)).toEqual([{ x: 100, y: 100 }]);
  });

  it("no fim é a trilha inteira", () => {
    const v = avancarViagem(iniciarViagem(grafoBase(), "b", "c", trilhaDe("t2")), 1);
    const todos = iniciarViagem(grafoBase(), "b", "c", trilhaDe("t2")).pontos;
    expect(trechoPercorrido(v)).toEqual(todos);
  });

  it("no meio, começa na origem e termina na posição atual", () => {
    const v = avancarViagem(iniciarViagem(grafoBase(), "a", "b", trilhaDe("t1")), 0.5);
    const trecho = trechoPercorrido(v);
    expect(trecho[0]).toEqual({ x: 100, y: 100 });
    expect(trecho[trecho.length - 1]).toEqual(v.posicao);
    expect(comprimentoDaCurva(trecho)).toBeCloseTo(400, 6);
  });
});

describe("nevoaDaViagem", () => {
  const emProgresso = (t) => {
    const v = iniciarViagem(grafoBase(), "a", "b", trilhaDe("t1"));
    return avancarViagem(v, t);
  };

  it("revela ao longo do trecho já percorrido, não só na chegada", () => {
    const m = criarMascara(1000, 1000, 4);
    nevoaDaViagem(m, emProgresso(0.2), 40);
    const em20 = contarReveladas(m);

    const m2 = criarMascara(1000, 1000, 4);
    nevoaDaViagem(m2, emProgresso(0.5), 40);
    const em50 = contarReveladas(m2);

    expect(em20).toBeGreaterThan(0);
    expect(em50).toBeGreaterThan(em20);
  });

  it("no começo já revela ao redor do ponto de partida", () => {
    const m = criarMascara(1000, 1000, 4);
    nevoaDaViagem(m, emProgresso(0), 40);
    expect(contarReveladas(m)).toBeGreaterThan(0);
  });

  it("no fim revela a trilha inteira", () => {
    const m = criarMascara(1000, 1000, 4);
    nevoaDaViagem(m, emProgresso(1), 40);
    const meio = criarMascara(1000, 1000, 4);
    nevoaDaViagem(meio, emProgresso(0.5), 40);
    expect(contarReveladas(m)).toBeGreaterThan(contarReveladas(meio));
  });

  it("MUTA a máscara e devolve a mesma referência (decisão da F3)", () => {
    const m = criarMascara(1000, 1000, 4);
    expect(nevoaDaViagem(m, emProgresso(0.5), 40)).toBe(m);
    expect(m.revisao).toBeGreaterThan(0);
  });

  it("raio inválido não quebra e não revela nada", () => {
    const m = criarMascara(1000, 1000, 4);
    nevoaDaViagem(m, emProgresso(0.5), 0);
    expect(contarReveladas(m)).toBe(0);
  });

  it("viagem ausente não quebra", () => {
    const m = criarMascara(1000, 1000, 4);
    expect(nevoaDaViagem(m, null, 40)).toBe(m);
    expect(contarReveladas(m)).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 4. Relógio de jogo
 * ═══════════════════════════════════════════════════════════════════════ */

describe("horasDecorridas", () => {
  it("é zero no começo e o total no fim", () => {
    const v = iniciarViagem(grafoBase(), "a", "b", trilhaDe("t1"));
    expect(horasDecorridas(v)).toBe(0);
    expect(horasDecorridas(avancarViagem(v, 1))).toBe(4);
  });

  it("é proporcional ao progresso", () => {
    const v = avancarViagem(iniciarViagem(grafoBase(), "a", "b", trilhaDe("t1")), 0.5);
    expect(horasDecorridas(v)).toBeCloseTo(2, 10);
  });

  it("viagem ausente não decorre tempo nenhum", () => {
    expect(horasDecorridas(null)).toBe(0);
  });
});

describe("avancarRelogio", () => {
  it("soma horas dentro do mesmo dia", () => {
    expect(avancarRelogio({ dia: 1, hora: 8, minuto: 0 }, 4))
      .toEqual({ dia: 1, hora: 12, minuto: 0 });
  });

  it("vira o dia quando passa da meia-noite", () => {
    expect(avancarRelogio({ dia: 1, hora: 22, minuto: 0 }, 4))
      .toEqual({ dia: 2, hora: 2, minuto: 0 });
  });

  it("vira vários dias de uma vez", () => {
    expect(avancarRelogio({ dia: 1, hora: 0, minuto: 0 }, 50))
      .toEqual({ dia: 3, hora: 2, minuto: 0 });
  });

  it("fração de hora vira minuto", () => {
    expect(avancarRelogio({ dia: 1, hora: 8, minuto: 30 }, 1.5))
      .toEqual({ dia: 1, hora: 10, minuto: 0 });
  });

  it("normaliza um relógio gravado torto", () => {
    expect(avancarRelogio({ dia: 1, hora: 30, minuto: 90 }, 0))
      .toEqual({ dia: 2, hora: 7, minuto: 30 });
  });

  it("aceita relógio ausente e começa no dia 1", () => {
    expect(avancarRelogio(null, 2)).toEqual({ dia: 1, hora: 2, minuto: 0 });
  });

  it("o mestre pode voltar o relógio", () => {
    expect(avancarRelogio({ dia: 2, hora: 2, minuto: 0 }, -4))
      .toEqual({ dia: 1, hora: 22, minuto: 0 });
  });

  it("nunca vai antes do começo da campanha", () => {
    expect(avancarRelogio({ dia: 1, hora: 1, minuto: 0 }, -999))
      .toEqual({ dia: 1, hora: 0, minuto: 0 });
  });

  it("com número, devolve número — quem guarda horas absolutas continua podendo", () => {
    expect(avancarRelogio(0, 5)).toBe(5);
    expect(avancarRelogio(10, -3)).toBe(7);
    expect(avancarRelogio(1, -99)).toBe(0);
  });

  it("horas inválidas não mexem no relógio", () => {
    expect(avancarRelogio({ dia: 3, hora: 4, minuto: 5 }, NaN))
      .toEqual({ dia: 3, hora: 4, minuto: 5 });
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 5. Suprimentos
 * ═══════════════════════════════════════════════════════════════════════ */

describe("consumirSuprimentos", () => {
  it("um dia inteiro come a ração de um dia", () => {
    expect(consumirSuprimentos(10, 24, 2)).toEqual({
      restante: 8, consumido: 2, esgotou: false, deficit: 0,
    });
  });

  it("meio dia come metade", () => {
    const r = consumirSuprimentos(10, 12, 2);
    expect(r.consumido).toBeCloseTo(1, 10);
    expect(r.restante).toBeCloseTo(9, 10);
  });

  it("nunca fica negativo — sobra vira déficit", () => {
    const r = consumirSuprimentos(1, 48, 2);
    expect(r.restante).toBe(0);
    expect(r.consumido).toBe(1);
    expect(r.deficit).toBe(3);
    expect(r.esgotou).toBe(true);
  });

  it("acabar exatamente no zero já é esgotar", () => {
    const r = consumirSuprimentos(2, 24, 2);
    expect(r.restante).toBe(0);
    expect(r.esgotou).toBe(true);
    expect(r.deficit).toBe(0);
  });

  it("viagem de zero hora não come nada", () => {
    expect(consumirSuprimentos(5, 0, 2).restante).toBe(5);
  });

  it("sem consumo por dia, nada é gasto (grupo que não precisa comer)", () => {
    expect(consumirSuprimentos(5, 100, 0).consumido).toBe(0);
  });

  it("suprimento ausente ou inválido conta como zero", () => {
    const r = consumirSuprimentos(undefined, 24, 2);
    expect(r.restante).toBe(0);
    expect(r.esgotou).toBe(true);
    expect(r.deficit).toBe(2);
  });

  it("horas negativas não devolvem comida", () => {
    expect(consumirSuprimentos(5, -24, 2)).toEqual({
      restante: 5, consumido: 0, esgotou: false, deficit: 0,
    });
  });
});
