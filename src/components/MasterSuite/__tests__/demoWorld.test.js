/* Testes da spec 0027 (AC-7) — o mundo demo precisa ser coerente e determinístico:
 * ids locais e estáveis (sem Date.now/Math.random), nenhuma aresta apontando pro vazio. */
import { buildDemoWorld } from "../model/demoWorld";
import { ENTITY_TYPE_IDS } from "../model/entityTypes";
import { RELATION_KINDS, connectionsOf, orphanEntities } from "../model/connections";

const demo = buildDemoWorld();
const ids = new Set(demo.entities.map((e) => e.id));
const tipos = new Set(demo.entities.map((e) => e.type));

describe("buildDemoWorld — forma do seed", () => {
  it("devolve mundo, entidades e conexões", () => {
    expect(demo.world).toEqual(expect.objectContaining({
      id: expect.any(String), name: expect.any(String), description: expect.any(String),
    }));
    expect(Array.isArray(demo.entities)).toBe(true);
    expect(Array.isArray(demo.connections)).toBe(true);
  });

  it("é determinístico e devolve objetos novos a cada chamada", () => {
    const outro = buildDemoWorld();
    expect(outro).toEqual(demo);
    expect(outro.entities).not.toBe(demo.entities);
    expect(outro.entities[0]).not.toBe(demo.entities[0]);
  });
});

describe("AC-7 — conteúdo suficiente pra exercitar wiki, grafo e genealogia", () => {
  it("tem pelo menos 14 entidades cobrindo 5+ tipos (aqui, 6+)", () => {
    expect(demo.entities.length).toBeGreaterThanOrEqual(14);
    expect(tipos.size).toBeGreaterThanOrEqual(6);
  });

  it("todo tipo usado é um dos 11 da spec", () => {
    [...tipos].forEach((t) => expect(ENTITY_TYPE_IDS).toContain(t));
  });

  it("tem pelo menos 10 conexões (AC-7 pede 8)", () => {
    expect(demo.connections.length).toBeGreaterThanOrEqual(10);
  });

  it("nenhuma conexão referencia id inexistente", () => {
    demo.connections.forEach((c) => {
      expect(ids.has(c.fromId)).toBe(true);
      expect(ids.has(c.toId)).toBe(true);
    });
  });

  it("nenhuma autoligação", () => {
    demo.connections.forEach((c) => expect(c.fromId).not.toBe(c.toId));
  });

  it("ids são únicos, locais e estáveis (prefixo demo-)", () => {
    expect(ids.size).toBe(demo.entities.length);
    demo.entities.forEach((e) => expect(e.id).toMatch(/^demo-[a-z]+-\d+$/));
    expect(new Set(demo.connections.map((c) => c.id)).size).toBe(demo.connections.length);
  });

  it("toda entidade tem nome, descrição e tags", () => {
    demo.entities.forEach((e) => {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(10);
      expect(Array.isArray(e.tags)).toBe(true);
    });
  });
});

describe("AC-7 — laços prontos pro grafo e pra genealogia", () => {
  const kinds = RELATION_KINDS.map((k) => k.id);

  it("toda conexão tem relação, inverso e categoria válida", () => {
    demo.connections.forEach((c) => {
      expect(c.relation.length).toBeGreaterThan(0);
      expect(c.inverse.length).toBeGreaterThan(0);
      expect(kinds).toContain(c.kind);
    });
  });

  it("tem laço de progenitor e de parceria (genealogia da Fase 6)", () => {
    const rels = demo.connections.map((c) => c.relation);
    expect(rels).toContain("PROGENITOR DE");
    expect(rels).toContain("PARCEIRO DE");
    expect(demo.connections.filter((c) => c.kind === "family").length).toBeGreaterThanOrEqual(3);
  });

  it("usa as três categorias fortes do grafo", () => {
    ["family", "alliance", "conflict"].forEach((k) => {
      expect(demo.connections.some((c) => c.kind === k)).toBe(true);
    });
  });

  it("nenhuma entidade nasce órfã — o grafo abre povoado", () => {
    expect(orphanEntities(demo.entities, demo.connections)).toEqual([]);
  });

  it("cada personagem enxerga suas conexões dos dois lados", () => {
    demo.entities.filter((e) => e.type === "character").forEach((p) => {
      const vistas = connectionsOf(demo.connections, p.id);
      expect(vistas.length).toBeGreaterThan(0);
      vistas.forEach((v) => {
        expect(ids.has(v.otherId)).toBe(true);
        expect(v.label.length).toBeGreaterThan(0);
      });
    });
  });
});
