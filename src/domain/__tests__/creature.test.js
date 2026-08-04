import { clampHp, currentHp, maxHp } from "../creature";

describe("creature.maxHp", () => {
  it("aceita o PV gravado como string — é assim que o formulário do bestiário grava", () => {
    expect(maxHp({ hpMax: "18" })).toBe(18);
  });

  it("PV máximo ilegível vale 0 (criatura sem barra de vida), não NaN", () => {
    expect(maxHp({ hpMax: "" })).toBe(0);
    expect(maxHp({})).toBe(0);
    expect(maxHp(null)).toBe(0);
  });

  it("tolera sufixo na string, como o legado", () => {
    expect(maxHp({ hpMax: "18 (2d8+4)" })).toBe(18);
  });
});

describe("creature.currentHp", () => {
  it("criatura recém-adicionada (sem hpCurrent) está intacta: vale o hpMax", () => {
    expect(currentHp({ hpMax: "18" })).toBe(18);
  });

  it("criatura ferida vale o hpCurrent gravado", () => {
    expect(currentHp({ hpMax: 18, hpCurrent: 5 })).toBe(5);
  });

  /* VIRADA DE COMPORTAMENTO — spec 0032 (Q3).
     Este teste travava o quirk oposto: até a spec 0031, `currentHp({hpCurrent: 0})` devolvia
     `hpMax`, porque o legado fazia `parseInt(...) || max` e `0` é falsy — a criatura abatida
     "revivia" na próxima leitura da tela. A spec 0029 preservou o defeito de propósito (AC-7),
     para que a refatoração fosse a comportamento constante. Agora ele foi consertado.
     O teste não foi apagado: foi INVERTIDO, para que o histórico da decisão fique legível. */
  it("criatura caída continua caída: hpCurrent 0 vale 0, não o PV cheio", () => {
    expect(currentHp({ hpMax: 18, hpCurrent: 0 })).toBe(0);
    expect(currentHp({ hpMax: "18", hpCurrent: "0" })).toBe(0);
  });

  it("hpCurrent ilegível vale 0 — mas sem ressuscitar a criatura", () => {
    // `toInt` segue tolerante com a string livre do formulário; o que mudou é que o
    // resultado 0 agora é respeitado em vez de cair no `hpMax`.
    expect(currentHp({ hpMax: 18, hpCurrent: "abc" })).toBe(0);
  });

  it("a distinção é ausência, não falsidade: só sem hpCurrent a criatura está intacta", () => {
    expect(currentHp({ hpMax: 18 })).toBe(18);
    expect(currentHp({ hpMax: 18, hpCurrent: null })).toBe(18);
    expect(currentHp({ hpMax: 18, hpCurrent: undefined })).toBe(18);
  });
});

describe("creature.clampHp", () => {
  it("cura não passa do PV máximo", () => {
    expect(clampHp({ hpMax: "18", hpCurrent: 15 }, +10)).toBe(18);
  });

  it("dano não leva o PV abaixo de zero", () => {
    expect(clampHp({ hpMax: "18", hpCurrent: 3 }, -50)).toBe(0);
  });

  it("aplica o delta normalmente dentro dos limites", () => {
    expect(clampHp({ hpMax: 18, hpCurrent: 12 }, -5)).toBe(7);
    expect(clampHp({ hpMax: 18, hpCurrent: 12 }, +3)).toBe(15);
  });

  it("criatura sem hpCurrent sofre dano a partir do hpMax", () => {
    expect(clampHp({ hpMax: "18" }, -4)).toBe(14);
  });

  it("PV máximo não numérico prende tudo em 0 — o piso vence o teto", () => {
    // Com `hpMax` ilegível o teto é 0, então nem cura funciona: é o comportamento legado,
    // e é o que impede a criatura de ganhar PV do nada.
    expect(clampHp({ hpMax: "—" }, +10)).toBe(0);
    expect(clampHp({ hpMax: "" }, -3)).toBe(0);
  });

  it("delta zero devolve o PV atual, sem efeito colateral", () => {
    expect(clampHp({ hpMax: 18, hpCurrent: 9 }, 0)).toBe(9);
  });
});
