import {
  parseNotation, parseNotationLoose, rollDice, rollNotation, rollOP, rollPool, rollDie,
  MAX_DICE_COUNT, MAX_DICE_SIDES,
} from "../dice";

/* rng determinístico: devolve a sequência dada, em ordem, e repete a última se acabar.
 * Valores são o retorno cru de Math.random() em [0,1), então face = floor(v*sides)+1. */
const seq = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
/* Açúcar: rng que produz exatamente as faces pedidas num dado de `sides` lados.
 * Usa o MEIO do intervalo de cada face para não depender de arredondamento de ponto flutuante. */
const faces = (sides, ...wanted) => seq(...wanted.map((f) => (f - 0.5) / sides));

describe("parseNotation (canônico)", () => {
  test("aceita NdM com e sem modificador", () => {
    expect(parseNotation("2d6+3")).toEqual({ count: 2, sides: 6, mod: 3, expr: "2d6+3" });
    expect(parseNotation("1d20")).toEqual({ count: 1, sides: 20, mod: 0, expr: "1d20" });
    expect(parseNotation("1d100-5")).toEqual({ count: 1, sides: 100, mod: -5, expr: "1d100-5" });
  });

  test("normaliza espaços e maiúsculas", () => {
    expect(parseNotation(" 2 D 6 + 3 ")).toEqual({ count: 2, sides: 6, mod: 3, expr: "2d6+3" });
  });

  test("recusa notação inválida", () => {
    for (const bad of ["", "d20", "abc", "2d", "d", "2x6", "2d6+", "rolar 2d6", "2d6 extra", "-2d6"]) {
      expect(parseNotation(bad)).toBeNull();
    }
  });

  test("grampeia os tetos: 21 dados vira 20, 101 lados vira 100", () => {
    expect(parseNotation("21d6").count).toBe(MAX_DICE_COUNT);
    expect(parseNotation("999d6").count).toBe(MAX_DICE_COUNT);
    expect(parseNotation("1d101").sides).toBe(MAX_DICE_SIDES);
    expect(parseNotation("20d100")).toEqual({ count: 20, sides: 100, mod: 0, expr: "20d100" });
  });
});

describe("rollDice (canônico)", () => {
  test("soma correta com rng determinístico", () => {
    const r = rollDice("3d6", { rng: faces(6, 4, 2, 6) });
    expect(r.rolls).toEqual([4, 2, 6]);
    expect(r.total).toBe(12);
    expect(r).toEqual({ expr: "3d6", rolls: [4, 2, 6], mod: 0, total: 12, sides: 6, count: 3 });
  });

  test("modificador positivo e negativo entram no total, não nos dados", () => {
    const pos = rollDice("2d6+3", { rng: faces(6, 4, 2) });
    expect(pos.rolls).toEqual([4, 2]);
    expect(pos.mod).toBe(3);
    expect(pos.total).toBe(9);

    const neg = rollDice("2d6-3", { rng: faces(6, 4, 2) });
    expect(neg.mod).toBe(-3);
    expect(neg.total).toBe(3);
  });

  test("expressão inválida devolve null", () => {
    expect(rollDice("nada", { rng: seq(0.5) })).toBeNull();
  });

  test("os tetos limitam a quantidade de dados realmente rolada", () => {
    expect(rollDice("21d6", { rng: seq(0) }).rolls).toHaveLength(MAX_DICE_COUNT);
    // 1d101 grampeado em 1d100: rng no topo do intervalo dá a face 100, nunca 101.
    expect(rollDice("1d101", { rng: seq(0.999999) }).rolls).toEqual([100]);
  });

  test("faces ficam sempre em [1, sides]", () => {
    expect(rollDice("1d6", { rng: seq(0) }).rolls).toEqual([1]);
    expect(rollDice("1d6", { rng: seq(0.999999) }).rolls).toEqual([6]);
  });
});

describe("parseNotationLoose / rollNotation (permissivo)", () => {
  test("contagem opcional e sem tetos", () => {
    expect(parseNotationLoose("d6")).toEqual({ count: 1, sides: 6, mod: 0 });
    expect(parseNotationLoose("50d200")).toEqual({ count: 50, sides: 200, mod: 0 });
  });

  test("encontra a notação no meio de um texto", () => {
    expect(parseNotationLoose("Dano 2d6+3 de corte")).toEqual({ count: 2, sides: 6, mod: 3 });
  });

  test("requireCount exige o N (dialeto do bestiário)", () => {
    expect(parseNotationLoose("d6", { requireCount: true })).toBeNull();
    expect(parseNotationLoose("1d6", { requireCount: true })).toEqual({ count: 1, sides: 6, mod: 0 });
  });

  test("rollNotation soma dados + modificador", () => {
    const r = rollNotation("2d8-1", { rng: faces(8, 7, 3) });
    expect(r.rolls).toEqual([7, 3]);
    expect(r.total).toBe(9);
    expect(r.sides).toBe(8);
    expect(r.count).toBe(2);
  });

  test("rollNotation devolve null quando não há notação", () => {
    expect(rollNotation("sem dados", { rng: seq(0.5) })).toBeNull();
  });
});

describe("rollOP (regra de Ordem Paranormal)", () => {
  test("atributo 1 rola 1d20", () => {
    const r = rollOP(1, { rng: faces(20, 13) });
    expect(r.rolls).toEqual([13]);
    expect(r.result).toBe(13);
    expect(r.worst).toBe(false);
    expect(r.dice).toBe("D20");
  });

  test("atributo 3 rola 3d20 e fica com o maior", () => {
    const r = rollOP(3, { rng: faces(20, 4, 17, 9) });
    expect(r.rolls).toEqual([4, 17, 9]);
    expect(r.result).toBe(17);
    expect(r.worst).toBe(false);
  });

  test("atributo 5 rola 5d20 e fica com o maior", () => {
    const r = rollOP(5, { rng: faces(20, 2, 11, 8, 19, 3) });
    expect(r.rolls).toHaveLength(5);
    expect(r.result).toBe(19);
  });

  test("atributo 0 rola 2d20 e fica com o PIOR", () => {
    const r = rollOP(0, { rng: faces(20, 18, 5) });
    expect(r.rolls).toEqual([18, 5]);
    expect(r.result).toBe(5);
    expect(r.worst).toBe(true);
  });

  test("crítico é qualquer 20 no pool, mesmo com atributo 0", () => {
    expect(rollOP(2, { rng: faces(20, 20, 7) }).crit).toBe(true);
    expect(rollOP(2, { rng: faces(20, 19, 7) }).crit).toBe(false);
    // Atributo 0: o 20 aparece mas o resultado mantido é o pior — crit segue true.
    const zero = rollOP(0, { rng: faces(20, 20, 3) });
    expect(zero.result).toBe(3);
    expect(zero.crit).toBe(true);
  });
});

describe("primitivas", () => {
  test("rollDie e rollPool respeitam sides e count", () => {
    expect(rollDie(20, seq(0))).toBe(1);
    expect(rollDie(20, seq(0.999999))).toBe(20);
    expect(rollPool(4, 6, seq(0))).toEqual([1, 1, 1, 1]);
  });

  test("sem rng injetado cai no Math.random e continua no intervalo", () => {
    const r = rollDice("5d10");
    expect(r.rolls).toHaveLength(5);
    r.rolls.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    });
  });
});
