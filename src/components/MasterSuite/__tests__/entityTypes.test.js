/* Testes da spec 0027 (AC-3) — as 11 espécies de entidade da Forja do Mestre.
 * Contrato de dados puro: sem React, sem Firebase. */
import {
  ENTITY_TYPES, ENTITY_TYPE_IDS, FALLBACK_ENTITY_TYPE, getEntityType,
} from "../model/entityTypes";

const HEX = /^#[0-9a-f]{6}$/i;

describe("ENTITY_TYPES — os 11 tipos exatos da spec", () => {
  it("tem exatamente os 11 ids, na ordem alfabética dos rótulos PT", () => {
    expect(ENTITY_TYPE_IDS).toEqual([
      "concept", "creature", "deity", "event", "item", "location",
      "organization", "character", "race", "sessionSummary", "route",
    ]);
    expect(ENTITY_TYPES).toHaveLength(11);
  });

  it("não repete id, rótulo, plural nem cor", () => {
    const uniq = (key) => new Set(ENTITY_TYPES.map((t) => t[key])).size;
    expect(uniq("id")).toBe(11);
    expect(uniq("label")).toBe(11);
    expect(uniq("plural")).toBe(11);
    expect(uniq("color")).toBe(11);
  });

  it("todo tipo tem rótulo PT, plural, cor hex e dica", () => {
    ENTITY_TYPES.forEach((t) => {
      expect(typeof t.label).toBe("string");
      expect(t.label.length).toBeGreaterThan(0);
      expect(typeof t.plural).toBe("string");
      expect(t.plural.length).toBeGreaterThan(0);
      expect(t.color).toMatch(HEX);
      expect(typeof t.hint).toBe("string");
      expect(t.hint.length).toBeGreaterThan(10);
    });
  });

  it("os rótulos são os combinados na spec", () => {
    const label = (id) => getEntityType(id).label;
    expect(label("concept")).toBe("Conceito");
    expect(label("creature")).toBe("Criatura");
    expect(label("deity")).toBe("Divindade");
    expect(label("event")).toBe("Evento");
    expect(label("item")).toBe("Item");
    expect(label("location")).toBe("Local");
    expect(label("organization")).toBe("Organização");
    expect(label("character")).toBe("Personagem");
    expect(label("race")).toBe("Raça");
    expect(label("sessionSummary")).toBe("Resumo de Sessão");
    expect(label("route")).toBe("Rota");
  });

  it("os plurais são os combinados na spec", () => {
    expect(ENTITY_TYPES.map((t) => t.plural)).toEqual([
      "Conceitos", "Criaturas", "Divindades", "Eventos", "Itens", "Locais",
      "Organizações", "Personagens", "Raças", "Resumos de Sessão", "Rotas",
    ]);
  });

  it("não define ícone aqui (a arte mora em outro módulo)", () => {
    ENTITY_TYPES.forEach((t) => expect(t.icon).toBeUndefined());
  });
});

describe("getEntityType — nunca lança", () => {
  it("devolve o tipo pedido quando existe", () => {
    expect(getEntityType("character").id).toBe("character");
    expect(getEntityType("route")).toBe(ENTITY_TYPES[10]);
  });

  it("id inexistente ou lixo cai no tipo genérico", () => {
    [undefined, null, "", "nao-existe", 42, {}, [], NaN].forEach((bad) => {
      expect(() => getEntityType(bad)).not.toThrow();
      expect(getEntityType(bad)).toBe(FALLBACK_ENTITY_TYPE);
    });
  });

  it("o fallback é utilizável na UI (rótulo, plural, cor, dica)", () => {
    expect(typeof FALLBACK_ENTITY_TYPE.label).toBe("string");
    expect(typeof FALLBACK_ENTITY_TYPE.plural).toBe("string");
    expect(FALLBACK_ENTITY_TYPE.color).toMatch(HEX);
    expect(typeof FALLBACK_ENTITY_TYPE.hint).toBe("string");
    expect(ENTITY_TYPE_IDS).not.toContain(FALLBACK_ENTITY_TYPE.id);
  });
});
