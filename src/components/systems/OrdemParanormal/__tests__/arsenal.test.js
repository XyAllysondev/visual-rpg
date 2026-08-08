/* Testes da spec 0020 — Arsenal v2 (crítico com margem/multiplicador + dano por tipo). */
import { critMargin, isCritical, combineDamage, attackSkillBonus } from "../rules";

describe("critMargin (AC-2)", () => {
  it("lê a margem de vários formatos", () => {
    expect(critMargin("20")).toBe(20);
    expect(critMargin("19")).toBe(19);
    expect(critMargin("19-20")).toBe(19);
    expect(critMargin("18+")).toBe(18);
  });
  it("default 20 e clamp em entradas ruins", () => {
    expect(critMargin(undefined)).toBe(20);
    expect(critMargin("abc")).toBe(20);
    expect(critMargin("1")).toBe(2);   // mínimo 2
    expect(critMargin("99")).toBe(20);  // máximo 20
  });
});

describe("isCritical (AC-2)", () => {
  it("crítico quando o d20 mantido atinge a margem", () => {
    expect(isCritical(19, "19")).toBe(true);
    expect(isCritical(20, "19")).toBe(true);
    expect(isCritical(18, "19")).toBe(false);
    expect(isCritical(20, "20")).toBe(true);
    expect(isCritical(19, "20")).toBe(false);
  });
});

describe("combineDamage (AC-2/AC-3/AC-4)", () => {
  it("sem crítico: total = base", () => {
    const r = combineDamage(10, 2, false, [], "Corte");
    expect(r.total).toBe(10);
    expect(r.byType).toEqual({ Corte: 10 });
  });
  it("crítico multiplica SÓ o dano base pelo multiplicador", () => {
    const r = combineDamage(10, 3, true, [{ result: 4, tipo: "Fogo" }], "Corte");
    expect(r.total).toBe(34);            // 10*3 + 4
    expect(r.byType).toEqual({ Corte: 30, Fogo: 4 });
  });
  it("dano extra soma e agrupa por tipo (extra do mesmo tipo do base acumula)", () => {
    const r = combineDamage(6, 2, false, [{ result: 3, tipo: "Balístico" }, { result: 2, tipo: "Balístico" }], "Balístico");
    expect(r.total).toBe(11);
    expect(r.byType).toEqual({ "Balístico": 11 });
  });
  it("defaults retrocompatíveis (mult inválido → 2; sem extras; sem tipo)", () => {
    const r = combineDamage(8, undefined, true, undefined, "");
    expect(r.total).toBe(16);            // 8*2
    expect(r.byType).toEqual({ "—": 16 });
  });
  it("ignora extras zerados/ inválidos", () => {
    const r = combineDamage(5, 2, false, [{ result: 0, tipo: "Fogo" }, { result: NaN }], "Corte");
    expect(r.total).toBe(5);
    expect(r.byType).toEqual({ Corte: 5 });
  });
});

/* O ataque com perícia usa o MESMO bônus do teste de perícia da coluna do meio.
 * Enquanto só o treino era somado, a mesma Luta valia menos no Arsenal do que
 * na lista de perícias, com os dois números visíveis na mesma tela. */
describe("attackSkillBonus", () => {
  const treino = { Luta: 10, Pontaria: 5 };
  const outros = { Luta: 3, Pontaria: 0 };

  it("soma grau de treinamento E o bônus da coluna Outros", () => {
    expect(attackSkillBonus("Luta", treino, outros)).toBe(13);
  });
  it("sem bônus extra, é só o treino", () => {
    expect(attackSkillBonus("Pontaria", treino, outros)).toBe(5);
  });
  it("perícia destreinada não dá bônus", () => {
    expect(attackSkillBonus("Ocultismo", treino, outros)).toBe(0);
  });
  it("atributo puro não recebe bônus de perícia (o atributo já deu os dados)", () => {
    expect(attackSkillBonus("FOR", { FOR: 10 }, { FOR: 5 })).toBe(0);
    expect(attackSkillBonus("AGI", treino, outros)).toBe(0);
  });
  it("ataque sem perícia declarada (shape antigo) não quebra", () => {
    expect(attackSkillBonus(undefined, treino, outros)).toBe(0);
    expect(attackSkillBonus("", treino, outros)).toBe(0);
    expect(attackSkillBonus("Luta")).toBe(0);
  });
  it("valores não numéricos contam como zero, nunca NaN", () => {
    expect(attackSkillBonus("Luta", { Luta: "x" }, { Luta: null })).toBe(0);
    expect(attackSkillBonus("Luta", { Luta: "10" }, { Luta: "2" })).toBe(12);
  });
});
