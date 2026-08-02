/* Testes da spec 0027 (AC-5) — conexões tipadas: inverso, deduplicação, autoligação, órfãs,
 * e os recortes que o grafo (Fase 2) vai consumir. Lógica pura. */
import {
  RELATION_KINDS, RELATION_PRESETS, makeConnection, isDuplicate, connectionsOf,
  orphanEntities, graphData, graphInsights, getRelationPreset, getRelationKind,
} from "../model/connections";

const HEX = /^#[0-9a-f]{6}$/i;

const ent = (id, type, name) => ({ id, type, name });
const ents = [
  ent("p1", "character", "Herculana"),
  ent("p2", "character", "Bento"),
  ent("p3", "character", "Rosalva"),
  ent("l1", "location", "Vila Candeia"),
  ent("c1", "creature", "Corta-Sono"),   // órfã de propósito
];

const conexoes = () => [
  makeConnection({ fromId: "p1", toId: "p2", relation: "parent" }),   // família
  makeConnection({ fromId: "p2", toId: "p3", relation: "partner" }),  // família
  makeConnection({ fromId: "p2", toId: "l1", relation: "leader" }),   // aliança
  makeConnection({ fromId: "p1", toId: "p3", relation: "enemy" }),    // conflito
];

describe("RELATION_KINDS — categorias do grafo", () => {
  it("são exatamente família, aliança, conflito e outras, com rótulo PT e cor hex", () => {
    expect(RELATION_KINDS.map((k) => k.id)).toEqual(["family", "alliance", "conflict", "other"]);
    expect(RELATION_KINDS.map((k) => k.label)).toEqual(["Família", "Aliança", "Conflito", "Outras"]);
    RELATION_KINDS.forEach((k) => expect(k.color).toMatch(HEX));
    expect(new Set(RELATION_KINDS.map((k) => k.color)).size).toBe(4);
  });
  it("getRelationKind cai em 'other' com id desconhecido", () => {
    expect(getRelationKind("family").label).toBe("Família");
    expect(getRelationKind("seila").id).toBe("other");
    expect(getRelationKind(undefined).id).toBe("other");
  });
});

describe("RELATION_PRESETS — relações prontas com inverso", () => {
  it("tem pelo menos 8 presets, todos com id, rótulo, inverso e categoria válida", () => {
    expect(RELATION_PRESETS.length).toBeGreaterThanOrEqual(8);
    const kinds = RELATION_KINDS.map((k) => k.id);
    RELATION_PRESETS.forEach((p) => {
      expect(typeof p.id).toBe("string");
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.inverse.length).toBeGreaterThan(0);
      expect(kinds).toContain(p.kind);
    });
    expect(new Set(RELATION_PRESETS.map((p) => p.id)).size).toBe(RELATION_PRESETS.length);
  });
  it("inclui o par CONTÉM/CONTIDO EM da spec e os laços de genealogia", () => {
    expect(getRelationPreset("contains")).toMatchObject({
      label: "CONTÉM", inverse: "CONTIDO EM", kind: "other",
    });
    expect(getRelationPreset("parent")).toMatchObject({ label: "PROGENITOR DE", kind: "family" });
    expect(getRelationPreset("partner").kind).toBe("family");
    expect(getRelationPreset("sibling").kind).toBe("family");
    expect(getRelationPreset("member").kind).toBe("alliance");
    expect(getRelationPreset("enemy").kind).toBe("conflict");
  });
  it("acha o preset pelo rótulo também, e devolve null pro que não existe", () => {
    expect(getRelationPreset("contém").id).toBe("contains");
    expect(getRelationPreset("CONTEM").id).toBe("contains");
    expect(getRelationPreset("relação inventada")).toBeNull();
    expect(getRelationPreset(null)).toBeNull();
  });
});

describe("makeConnection", () => {
  it("resolve o preset e devolve a aresta normalizada", () => {
    const c = makeConnection({ fromId: " l1 ", toId: "p1", relation: "contains" });
    expect(c).toMatchObject({
      fromId: "l1", toId: "p1", relation: "CONTÉM", inverse: "CONTIDO EM",
      kind: "other", presetId: "contains",
    });
    expect(typeof c.id).toBe("string");
  });
  it("id é determinístico (mesma entrada ⇒ mesmo id)", () => {
    const a = makeConnection({ fromId: "l1", toId: "p1", relation: "contains" });
    const b = makeConnection({ fromId: "l1", toId: "p1", relation: "CONTÉM" });
    expect(a.id).toBe(b.id);
  });
  it("relação livre vira maiúscula e é simétrica por padrão", () => {
    const c = makeConnection({ fromId: "p1", toId: "p2", relation: "  devoto de  " });
    expect(c.relation).toBe("DEVOTO DE");
    expect(c.inverse).toBe("DEVOTO DE");
    expect(c.kind).toBe("other");
    expect(c.presetId).toBeNull();
  });
  it("relação vazia cai no rótulo genérico", () => {
    expect(makeConnection({ fromId: "p1", toId: "p2" }).relation).toBe("RELACIONADO A");
  });
  it("kind explícito ganha do preset; kind inválido cai no do preset", () => {
    expect(makeConnection({ fromId: "p1", toId: "p2", relation: "contains", kind: "conflict" }).kind)
      .toBe("conflict");
    expect(makeConnection({ fromId: "p1", toId: "p2", relation: "parent", kind: "seila" }).kind)
      .toBe("family");
  });
  it("lança na autoligação", () => {
    expect(() => makeConnection({ fromId: "p1", toId: "p1", relation: "ally" }))
      .toThrow(/si mesma/i);
  });
  it("lança quando falta um dos lados", () => {
    expect(() => makeConnection({ toId: "p2", relation: "ally" })).toThrow(/duas entidades/i);
    expect(() => makeConnection({ fromId: "p1", relation: "ally" })).toThrow(/duas entidades/i);
    expect(() => makeConnection({ fromId: "  ", toId: "p2" })).toThrow(/duas entidades/i);
    expect(() => makeConnection()).toThrow(/duas entidades/i);
  });
});

describe("isDuplicate — mesma dupla + mesma relação, em qualquer sentido", () => {
  const base = [makeConnection({ fromId: "a", toId: "b", relation: "contains" })];

  it("pega a repetição idêntica", () => {
    expect(isDuplicate(base, makeConnection({ fromId: "a", toId: "b", relation: "contains" })))
      .toBe(true);
  });
  it("pega a repetição invertida com a mesma relação", () => {
    expect(isDuplicate(base, makeConnection({ fromId: "b", toId: "a", relation: "contains" })))
      .toBe(true);
  });
  it("pega a repetição escrita pelo inverso (B CONTIDO EM A)", () => {
    expect(isDuplicate(base, makeConnection({ fromId: "b", toId: "a", relation: "CONTIDO EM" })))
      .toBe(true);
  });
  it("relação diferente entre a mesma dupla NÃO é duplicata", () => {
    expect(isDuplicate(base, makeConnection({ fromId: "a", toId: "b", relation: "enemy" })))
      .toBe(false);
  });
  it("outra dupla não é duplicata; entradas inválidas devolvem false", () => {
    expect(isDuplicate(base, makeConnection({ fromId: "a", toId: "c", relation: "contains" })))
      .toBe(false);
    expect(isDuplicate(base, null)).toBe(false);
    expect(isDuplicate(null, base[0])).toBe(false);
  });
});

describe("connectionsOf — a relação vista de cada lado (AC-5)", () => {
  const cs = conexoes();

  it("do lado de origem mostra a relação direta", () => {
    const v = connectionsOf(cs, "p1");
    expect(v).toHaveLength(2);
    expect(v[0]).toMatchObject({ otherId: "p2", label: "PROGENITOR DE", outgoing: true });
    expect(v[0].connection).toBe(cs[0]);
  });
  it("do lado de destino mostra o inverso", () => {
    const v = connectionsOf(cs, "p2");
    expect(v.find((x) => x.otherId === "p1")).toMatchObject({
      label: "FILHO DE", outgoing: false,
    });
  });
  it("relação simétrica mostra o mesmo rótulo nos dois lados", () => {
    const [, parceria] = cs;
    expect(connectionsOf(cs, "p2").find((x) => x.otherId === "p3").label).toBe("PARCEIRO DE");
    expect(connectionsOf(cs, "p3").find((x) => x.otherId === "p2").label).toBe("PARCEIRO DE");
    expect(parceria.relation).toBe("PARCEIRO DE");
  });
  it("entidade sem conexão devolve vazio", () => {
    expect(connectionsOf(cs, "c1")).toEqual([]);
    expect(connectionsOf(cs, "")).toEqual([]);
    expect(connectionsOf(null, "p1")).toEqual([]);
  });
});

describe("orphanEntities", () => {
  it("lista quem não aparece em nenhuma ponta", () => {
    expect(orphanEntities(ents, conexoes()).map((e) => e.id)).toEqual(["c1"]);
  });
  it("sem conexão nenhuma, todo mundo é órfão", () => {
    expect(orphanEntities(ents, []).map((e) => e.id)).toEqual(["p1", "p2", "p3", "l1", "c1"]);
    expect(orphanEntities(ents, null)).toHaveLength(5);
  });
});

describe("graphData — recorte do grafo", () => {
  const cs = conexoes();

  it("sem filtro devolve o mundo inteiro", () => {
    const g = graphData(ents, cs, {});
    expect(g.nodes).toHaveLength(5);
    expect(g.edges).toHaveLength(4);
  });
  it("descarta a aresta quando uma das pontas foi filtrada fora", () => {
    const g = graphData(ents, cs, { types: ["character"] });
    expect(g.nodes.map((n) => n.id)).toEqual(["p1", "p2", "p3"]);
    // p2 → l1 (LIDERA) some junto com o local
    expect(g.edges.map((e) => e.toId)).not.toContain("l1");
    expect(g.edges).toHaveLength(3);
  });
  it("filtra por categoria de relação", () => {
    const g = graphData(ents, cs, { kinds: ["family"] });
    expect(g.edges).toHaveLength(2);
    expect(g.edges.every((e) => e.kind === "family")).toBe(true);
    expect(g.nodes).toHaveLength(5);           // nós continuam; só as arestas afinam
  });
  it("busca textual também recorta os nós", () => {
    const g = graphData(ents, cs, { query: "herculana" });
    expect(g.nodes.map((n) => n.id)).toEqual(["p1"]);
    expect(g.edges).toEqual([]);               // sem par, nenhuma aresta sobrevive
  });
  it("aresta órfã (ponta inexistente) não entra", () => {
    const g = graphData(ents, [...cs, { fromId: "p1", toId: "fantasma", kind: "other" }], {});
    expect(g.edges).toHaveLength(4);
  });
});

describe("graphInsights", () => {
  it("conta total, conectadas, órfãs, grau e categorias", () => {
    const i = graphInsights(ents, conexoes());
    expect(i.total).toBe(5);
    expect(i.connected).toBe(4);
    expect(i.orphans).toBe(1);
    expect(i.byKind).toEqual({ family: 2, alliance: 1, conflict: 1, other: 0 });
    expect(i.mostConnected[0]).toEqual({ id: "p2", name: "Bento", degree: 3 });
    // empate de grau desempata pelo nome (Herculana antes de Rosalva)
    expect(i.mostConnected.map((x) => x.id)).toEqual(["p2", "p1", "p3", "l1"]);
    expect(i.mostConnected.every((x) => x.degree > 0)).toBe(true);
  });
  it("mundo vazio não quebra", () => {
    expect(graphInsights([], [])).toMatchObject({ total: 0, connected: 0, orphans: 0 });
    expect(graphInsights(null, null).mostConnected).toEqual([]);
  });
});
