/* Testes da spec 0027 (AC-6) — Painel do mundo: agregação por tipo, editadas recentemente
 * e o checklist de primeiros passos refletindo o estado real. Lógica pura. */
import { worldStats, firstSteps, FIRST_STEP_IDS } from "../model/dashboardStats";
import { ENTITY_TYPE_IDS } from "../model/entityTypes";

const ent = (id, type, name, updatedAt) => ({ id, type, name, updatedAt });
const ents = [
  ent("a", "character", "Herculana", 500),
  ent("b", "character", "Bento", 900),
  ent("c", "location", "Vila Candeia", 700),
  ent("d", "item", "Facão do Meio-Dia", 100),
  ent("e", "location", "Serra do Anhangá", { seconds: 2 }),   // 2000ms → o mais recente
];
const mundo = { id: "w1", name: "Coroa de Cinzas" };
const conexao = { fromId: "a", toId: "b", relation: "PROGENITOR DE", kind: "family" };

describe("worldStats", () => {
  it("conta o total e agrega por tipo cobrindo os 11", () => {
    const s = worldStats(ents);
    expect(s.total).toBe(5);
    expect(Object.keys(s.byType).sort()).toEqual([...ENTITY_TYPE_IDS].sort());
    expect(s.byType.character).toBe(2);
    expect(s.byType.location).toBe(2);
    expect(s.byType.item).toBe(1);
    expect(s.byType.deity).toBe(0);
  });

  it("recent(limit) devolve as editadas mais recentemente", () => {
    const s = worldStats(ents);
    expect(s.recent(3).map((e) => e.id)).toEqual(["e", "b", "c"]);
    expect(s.recent(1).map((e) => e.id)).toEqual(["e"]);
    expect(s.recent(99)).toHaveLength(5);
    expect(s.recent()).toHaveLength(5);          // padrão = 5
  });

  it("recent aceita filtro por tipo (AC-6)", () => {
    const s = worldStats(ents);
    expect(s.recent(5, "location").map((e) => e.id)).toEqual(["e", "c"]);
    expect(s.recent(5, "deity")).toEqual([]);
  });

  it("mundo vazio não quebra", () => {
    const s = worldStats(null);
    expect(s.total).toBe(0);
    expect(s.recent(5)).toEqual([]);
    expect(Object.values(s.byType).every((n) => n === 0)).toBe(true);
  });
});

describe("firstSteps — checklist reflete o estado real (AC-6)", () => {
  const doneOf = (steps) => steps.filter((s) => s.done).map((s) => s.id);

  it("tem os seis passos, com rótulo PT e id estável", () => {
    const steps = firstSteps(null, [], []);
    expect(steps.map((s) => s.id)).toEqual(FIRST_STEP_IDS);
    expect(FIRST_STEP_IDS).toEqual([
      "world", "character", "location", "connection", "journal", "graph",
    ]);
    steps.forEach((s) => {
      expect(typeof s.label).toBe("string");
      expect(s.label.length).toBeGreaterThan(3);
      expect(typeof s.done).toBe("boolean");
    });
  });

  it("sem mundo nenhum passo está feito", () => {
    expect(doneOf(firstSteps(null, [], []))).toEqual([]);
    expect(doneOf(firstSteps(undefined, null, null))).toEqual([]);
  });

  it("criar o mundo marca só o primeiro passo", () => {
    expect(doneOf(firstSteps(mundo, [], []))).toEqual(["world"]);
  });

  it("adicionar personagem marca o passo do personagem", () => {
    expect(doneOf(firstSteps(mundo, [ent("a", "character", "Bento")], [])))
      .toEqual(["world", "character"]);
  });

  it("criar local marca o passo do local", () => {
    expect(doneOf(firstSteps(mundo, [ent("c", "location", "Vila")], [])))
      .toEqual(["world", "location"]);
  });

  it("uma conexão marca conectar, mas NÃO o grafo (Fase 2, ainda não abre)", () => {
    // O painel rotula este passo como "Fase 2". Dar como concluído algo que o
    // mestre não tem como fazer é mentir para ele — o passo só vale quando a
    // ferramenta existir.
    expect(doneOf(firstSteps(mundo, ents, [conexao])))
      .toEqual(["world", "character", "location", "connection"]);
  });

  it("o diário vem por flag (a suíte informa se já existe página)", () => {
    expect(doneOf(firstSteps(mundo, [], [], { hasJournalEntry: true })))
      .toEqual(["world", "journal"]);
    expect(doneOf(firstSteps({ ...mundo, journalCount: 3 }, [], [])))
      .toEqual(["world", "journal"]);
    expect(doneOf(firstSteps({ ...mundo, hasJournalEntry: true }, [], [])))
      .toEqual(["world", "journal"]);
    expect(doneOf(firstSteps({ ...mundo, journalCount: 0 }, [], []))).toEqual(["world"]);
  });

  it("mundo completo marca tudo que é possível hoje — o grafo fica para a Fase 2", () => {
    const steps = firstSteps(mundo, ents, [conexao], { hasJournalEntry: true });
    const pendentes = steps.filter((s) => !s.done).map((s) => s.id);
    expect(pendentes).toEqual(["graph"]);
  });
});
