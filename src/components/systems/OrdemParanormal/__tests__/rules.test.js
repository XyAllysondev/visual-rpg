/* Testes da spec 0006 — rules.js fiel ao livro oficial de Ordem Paranormal.
 * Valores esperados verificados contra o livro (ver spec 0006, tabela de verificação). */
import {
  nexLevel, nexStats, deriveStats, dtRituais,
  PATENTES, patenteForPrestigio, cargaMaxima, cargaTeto, circuloMaxNex, defaultTrainedSet,
  rollOP, rollExpr, rollPayload, NEX_LADDER, treinoColor,
} from "../rules";

afterEach(() => jest.restoreAllMocks());

describe("nexLevel", () => {
  it("mapeia NEX 5..99 para nível 0..19", () => {
    expect(nexLevel(5)).toBe(0);
    expect(nexLevel(10)).toBe(1);
    expect(nexLevel(50)).toBe(9);
    expect(nexLevel(99)).toBe(19);
  });
});

describe("nexStats — AC-1 (fórmulas oficiais por classe)", () => {
  it("combatente: PV 20+VIG (+4+VIG/NEX), SAN 12 (+3), PE 2+PRE (+2+PRE)", () => {
    const a = { VIG: 3, PRE: 1 };
    expect(nexStats(5, "combatente", a)).toEqual({ pv: 23, san: 12, pe: 3 });
    expect(nexStats(50, "combatente", a)).toEqual({ pv: 86, san: 39, pe: 30 });
  });
  it("especialista: PV 16+VIG (+3+VIG/NEX), SAN 16 (+4), PE 3+PRE (+3+PRE)", () => {
    const a = { VIG: 1, PRE: 2 };
    expect(nexStats(5, "especialista", a)).toEqual({ pv: 17, san: 16, pe: 5 });
    expect(nexStats(50, "especialista", a)).toEqual({ pv: 53, san: 52, pe: 50 });
  });
  it("ocultista: PV 12+VIG (+2+VIG/NEX), SAN 20 (+5), PE 4+PRE (+4+PRE)", () => {
    const a = { VIG: 2, PRE: 5 };
    expect(nexStats(5, "ocultista", a)).toEqual({ pv: 14, san: 20, pe: 9 });
    // Exemplo fixado na spec: NEX 99, VIG 2, PRE 5 → PV 90 / PE 180 / SAN 115
    expect(nexStats(99, "ocultista", a)).toEqual({ pv: 90, san: 115, pe: 180 });
  });
  it("classe desconhecida usa o fallback (ocultista)", () => {
    expect(nexStats(5, "nao-existe", { VIG: 0, PRE: 0 })).toEqual({ pv: 12, san: 20, pe: 4 });
  });
});

describe("deriveStats — AC-1/AC-3", () => {
  it("peTurno = NEX/5 (limite oficial de PE por rodada)", () => {
    expect(deriveStats({ AGI: 0 }, 5).peTurno).toBe(1);
    expect(deriveStats({ AGI: 0 }, 50).peTurno).toBe(10);
    expect(deriveStats({ AGI: 0 }, 99).peTurno).toBe(20);
  });
  it("defesa = 10 + AGI", () => {
    expect(deriveStats({ AGI: 2 }, 5).defesa).toBe(12);
  });
  it("deslocamento padrão oficial = 9m / 6q, sem AGI", () => {
    expect(deriveStats({ AGI: 4 }, 5).deslocamento).toBe("9m / 6q");
  });
});

describe("cargaTeto — assessment-0021 §A (sobrecarga)", () => {
  it("teto absoluto = 2× a carga máxima", () => {
    expect(cargaTeto({ FOR: 0 })).toBe(cargaMaxima({ FOR: 0 }) * 2); // 10
    expect(cargaTeto({ FOR: 3 })).toBe(40);  // (5 + 15) × 2
    expect(cargaTeto({})).toBe(10);
  });
});

describe("circuloMaxNex — assessment-0021 §A (aviso de círculo por NEX)", () => {
  it("libera 1º=5%, 2º=25%, 3º=55%, 4º=85%", () => {
    expect(circuloMaxNex(4)).toBe(0);
    expect(circuloMaxNex(5)).toBe(1);
    expect(circuloMaxNex(24)).toBe(1);
    expect(circuloMaxNex(25)).toBe(2);
    expect(circuloMaxNex(54)).toBe(2);
    expect(circuloMaxNex(55)).toBe(3);
    expect(circuloMaxNex(84)).toBe(3);
    expect(circuloMaxNex(85)).toBe(4);
    expect(circuloMaxNex(99)).toBe(4);
  });
});

describe("dtRituais — AC-2 (exemplos oficiais)", () => {
  it("NEX 5%, PRE 3 → DT 14; NEX 99%, PRE 5 → DT 35", () => {
    expect(dtRituais(5, { PRE: 3 })).toBe(14);
    expect(dtRituais(99, { PRE: 5 })).toBe(35);
  });
  it("soma bônus e usa NEX/5 com o mesmo arredondamento do peTurno", () => {
    expect(dtRituais(50, { PRE: 2 })).toBe(22);      // 10 + 10 + 2
    expect(dtRituais(50, { PRE: 2 }, 3)).toBe(25);   // + bônus
  });
});

describe("PATENTES + patenteForPrestigio — AC-4 (tabela oficial)", () => {
  it("são exatamente as 5 patentes oficiais, em ordem de prestígio", () => {
    expect(PATENTES.map((p) => p.nome)).toEqual([
      "Recruta", "Operador", "Agente especial", "Oficial de operações", "Agente de elite",
    ]);
    expect(PATENTES.map((p) => p.prestigioMin)).toEqual([0, 20, 50, 100, 200]);
    expect(PATENTES.map((p) => p.limiteCredito)).toEqual([
      "Baixo", "Médio", "Médio", "Alto", "Ilimitado",
    ]);
  });
  it("limites de itens I–IV oficiais (cat. 0 ilimitada)", () => {
    expect(PATENTES[0].limiteItens).toEqual([null, 2, 0, 0, 0]);
    expect(PATENTES[1].limiteItens).toEqual([null, 3, 1, 0, 0]);
    expect(PATENTES[2].limiteItens).toEqual([null, 3, 2, 1, 0]);
    expect(PATENTES[3].limiteItens).toEqual([null, 3, 3, 2, 1]);
    expect(PATENTES[4].limiteItens).toEqual([null, 3, 3, 3, 2]);
  });
  it("deriva a patente por Pontos de Prestígio (bordas inclusas)", () => {
    expect(patenteForPrestigio(0).nome).toBe("Recruta");
    expect(patenteForPrestigio(19).nome).toBe("Recruta");
    expect(patenteForPrestigio(20).nome).toBe("Operador");
    expect(patenteForPrestigio(49).nome).toBe("Operador");
    expect(patenteForPrestigio(50).nome).toBe("Agente especial");
    expect(patenteForPrestigio(100).nome).toBe("Oficial de operações");
    expect(patenteForPrestigio(200).nome).toBe("Agente de elite");
    expect(patenteForPrestigio(999).nome).toBe("Agente de elite");
  });
  it("PP ausente ou negativo ⇒ Recruta", () => {
    expect(patenteForPrestigio(undefined).nome).toBe("Recruta");
    expect(patenteForPrestigio(-5).nome).toBe("Recruta");
  });
});

describe("cargaMaxima", () => {
  it("5 espaços + 5 por ponto de Força; sem attrs ⇒ 5", () => {
    expect(cargaMaxima({ FOR: 2 })).toBe(15);
    expect(cargaMaxima({})).toBe(5);
    expect(cargaMaxima(undefined)).toBe(5);
  });
});

describe("defaultTrainedSet", () => {
  /* Spec 0033: só entra aqui o que o livro concede SEM escolha. As perícias
   * de classe do combatente e do especialista são escolhas do jogador (viram
   * pendências no motor de progressão), não um conjunto fixo. */
  it("traz as perícias da origem sem os marcadores * e +", () => {
    const s = defaultTrainedSet({ skills: ["Medicina*", "Crime*+"] }, { id: "combatente" });
    expect(s.has("Medicina")).toBe(true);
    expect(s.has("Crime")).toBe(true);
  });
  it("combatente não ganha perícia de classe de graça — ele escolhe", () => {
    const s = defaultTrainedSet({ skills: [] }, { id: "combatente" });
    ["Luta", "Pontaria", "Iniciativa", "Atletismo", "Reflexos", "Fortitude"]
      .forEach((p) => expect(s.has(p)).toBe(false));
  });
  it("especialista também escolhe todas as 7+Int", () => {
    expect(defaultTrainedSet({ skills: [] }, { id: "especialista" }).size).toBe(0);
  });
  it("ocultista recebe Ocultismo e Vontade fixos (e é o fallback sem classe)", () => {
    const s = defaultTrainedSet(null, { id: "ocultista" });
    expect(s.has("Ocultismo")).toBe(true);
    expect(s.has("Vontade")).toBe(true);
    expect(s.size).toBe(2);
    const semClasse = defaultTrainedSet(null, null);
    expect(semClasse.has("Ocultismo")).toBe(true);
    expect(semClasse.has("Vontade")).toBe(true);
  });
});

describe("rollOP", () => {
  it("atributo 0 ⇒ rola 2d20 e fica com o PIOR", () => {
    jest.spyOn(Math, "random").mockReturnValueOnce(0.99).mockReturnValueOnce(0.0);
    const r = rollOP(0);
    expect(r.rolls).toEqual([20, 1]);
    expect(r.result).toBe(1);
    expect(r.worst).toBe(true);
  });
  it("atributo N ⇒ rola N d20 e fica com o MELHOR; 20 marca crit", () => {
    jest.spyOn(Math, "random")
      .mockReturnValueOnce(0.0).mockReturnValueOnce(0.5).mockReturnValueOnce(0.99);
    const r = rollOP(3);
    expect(r.rolls).toEqual([1, 11, 20]);
    expect(r.result).toBe(20);
    expect(r.worst).toBe(false);
    expect(r.crit).toBe(true);
  });
});

describe("rollExpr", () => {
  it("interpreta 2d6+3", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    const r = rollExpr("2d6+3");
    expect(r.rolls).toEqual([4, 4]);
    expect(r.result).toBe(11);
    expect(r.mod).toBe(3);
    expect(r.dice).toBe("D6");
  });
  it("d20 sem contagem = 1 dado; 20 natural marca crit", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.99);
    const r = rollExpr("d20");
    expect(r.count).toBe(1);
    expect(r.crit).toBe(true);
  });
  it("expressão inválida ⇒ null; contagem limitada a 30", () => {
    expect(rollExpr("abc")).toBeNull();
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    expect(rollExpr("50d6").count).toBe(30);
  });
});

describe("rollPayload", () => {
  it("normaliza o payload do feed", () => {
    const p = rollPayload("Luta", { rolls: [5], result: 5, dice: "D20" }, "Ana", "morte");
    expect(p).toMatchObject({
      attr: "Luta", name: "Luta", result: 5, dice: "D20",
      crit: false, worst: false, charName: "Ana", elemento: "morte",
    });
  });
});

describe("NEX_LADDER — AC-5 (marcos oficiais)", () => {
  const nexesWhere = (re) => NEX_LADDER.filter((r) => re.test(r.note)).map((r) => r.nex);
  it("habilidade de trilha só em 10/40/65/99", () => {
    expect(nexesWhere(/trilha/i)).toEqual([10, 40, 65, 99]);
  });
  it("aumento de atributo só em 20/50/80/95", () => {
    expect(nexesWhere(/atributo/i)).toEqual([20, 50, 80, 95]);
  });
  it("grau de treinamento em 35/70", () => {
    expect(nexesWhere(/treinamento/i)).toEqual([35, 70]);
  });
  it("afinidade elemental APENAS no NEX 50 (nada de elemento no 15)", () => {
    expect(nexesWhere(/afinidade|elemento/i)).toEqual([50]);
  });
});

describe("treinoColor", () => {
  it("mapeia grau de treino para a cor do tier", () => {
    expect(treinoColor(0)).toBe("var(--muted)");
    expect(treinoColor(5)).toBe("#4ade80");
    expect(treinoColor(10)).toBe("#60a5fa");
    expect(treinoColor(15)).toBe("var(--gold2)");
  });
});
