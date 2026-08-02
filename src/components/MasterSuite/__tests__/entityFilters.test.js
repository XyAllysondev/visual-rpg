/* Testes da spec 0027 (AC-4) — navegação da wiki: busca, filtro, ordenação e contagem.
 * Lógica pura: nada de React nem de Firestore (Timestamp entra só como `{ seconds }`). */
import {
  normalize, searchEntities, filterEntities, sortEntities,
  countByType, collectTags, SORT_OPTIONS,
} from "../model/entityFilters";
import { ENTITY_TYPE_IDS } from "../model/entityTypes";

/* e1..e4 cobrem acento, caixa, pasta, tag e updatedAt em formatos diferentes. */
const e1 = {
  id: "e1", type: "location", name: "Muralha Cinzenta",
  description: "Barreira antiga do vale.", tags: ["fronteira"],
  folderId: "norte", updatedAt: { seconds: 300 },     // Timestamp-like → 300000ms
};
const e2 = {
  id: "e2", type: "character", name: "Ana Cordeiro",
  description: "Guarda a muralha do norte.", tags: ["Guarda"],
  folderId: "norte", updatedAt: 2000,                 // millis cru
};
const e3 = {
  id: "e3", type: "organization", name: "Órgão dos Sinos",
  description: "Conselho da vila.", tags: ["fronteira", "política"],
  folderId: "sul", updatedAt: { seconds: 100 },
};
const e4 = {
  id: "e4", type: "creature", name: "Ébano",
  description: "Bicho do brejo.", tags: [],           // sem updatedAt
};
const ents = [e1, e2, e3, e4];
const ids = (list) => list.map((e) => e.id);

describe("normalize", () => {
  it("tira acento e caixa", () => {
    expect(normalize("Órgão")).toBe("orgao");
    expect(normalize("MURALHA")).toBe("muralha");
    expect(normalize("Coração de Aço")).toBe("coracao de aco");
    expect(normalize("  Ébano  ")).toBe("ebano");
  });
  it("aceita lixo sem lançar", () => {
    expect(normalize(null)).toBe("");
    expect(normalize(undefined)).toBe("");
    expect(normalize(42)).toBe("42");
  });
});

describe("searchEntities — insensível a acento e caixa (AC-4)", () => {
  it("query vazia devolve tudo", () => {
    expect(ids(searchEntities(ents, ""))).toEqual(ids(ents));
    expect(ids(searchEntities(ents, "   "))).toEqual(ids(ents));
    expect(ids(searchEntities(ents, null))).toEqual(ids(ents));
  });
  it("'Muralha' acha 'muralha' no nome e na descrição", () => {
    expect(ids(searchEntities(ents, "Muralha"))).toEqual(["e1", "e2"]);
  });
  it("'orgao' acha 'Órgão'", () => {
    expect(ids(searchEntities(ents, "orgao"))).toEqual(["e3"]);
  });
  it("busca nas tags", () => {
    expect(ids(searchEntities(ents, "POLITICA"))).toEqual(["e3"]);
  });
  it("vários termos somam (E lógico) e a ordem não importa", () => {
    expect(ids(searchEntities(ents, "cinzenta muralha"))).toEqual(["e1"]);
    expect(ids(searchEntities(ents, "muralha inexistente"))).toEqual([]);
  });
  it("lista inválida devolve vazio", () => {
    expect(searchEntities(null, "x")).toEqual([]);
  });
});

describe("filterEntities — combinável (AC-4)", () => {
  it("sem filtro nenhum devolve tudo", () => {
    expect(ids(filterEntities(ents, {}))).toEqual(ids(ents));
    expect(ids(filterEntities(ents))).toEqual(ids(ents));
    expect(ids(filterEntities(ents, { types: [], tags: [] }))).toEqual(ids(ents));
  });
  it("tipo é OU dentro da categoria", () => {
    expect(ids(filterEntities(ents, { types: ["location", "creature"] }))).toEqual(["e1", "e4"]);
    expect(ids(filterEntities(ents, { types: "character" }))).toEqual(["e2"]);
  });
  it("tag ignora acento e caixa", () => {
    expect(ids(filterEntities(ents, { tags: ["Fronteira"] }))).toEqual(["e1", "e3"]);
    expect(ids(filterEntities(ents, { tags: ["politica"] }))).toEqual(["e3"]);
  });
  it("pasta filtra pelo folderId", () => {
    expect(ids(filterEntities(ents, { folderId: "norte" }))).toEqual(["e1", "e2"]);
  });
  it("categorias diferentes são E lógico", () => {
    expect(ids(filterEntities(ents, {
      types: ["location"], folderId: "norte", tags: ["fronteira"], query: "barreira",
    }))).toEqual(["e1"]);
    expect(filterEntities(ents, { types: ["character"], tags: ["fronteira"] })).toEqual([]);
  });
  it("não muta a lista original", () => {
    const copia = [...ents];
    filterEntities(ents, { types: ["location"] });
    expect(ents).toEqual(copia);
  });
});

describe("sortEntities (AC-4)", () => {
  it("expõe as quatro ordenações com rótulo PT", () => {
    expect(SORT_OPTIONS.map((o) => o.id)).toEqual(["az", "za", "recent", "oldest"]);
    SORT_OPTIONS.forEach((o) => expect(typeof o.label).toBe("string"));
  });
  it("A→Z usa a ordem alfabética do português (É depois de A, Ó depois de M)", () => {
    expect(ids(sortEntities(ents, "az"))).toEqual(["e2", "e4", "e1", "e3"]);
  });
  it("Z→A é o espelho", () => {
    expect(ids(sortEntities(ents, "za"))).toEqual(["e3", "e1", "e4", "e2"]);
  });
  it("recentes usa updatedAt (Timestamp-like ou millis) do maior pro menor", () => {
    expect(ids(sortEntities(ents, "recent"))).toEqual(["e1", "e3", "e2", "e4"]);
  });
  it("antigos é do menor pro maior, e quem não tem data continua no fim", () => {
    expect(ids(sortEntities(ents, "oldest"))).toEqual(["e2", "e3", "e1", "e4"]);
  });
  it("id de ordenação desconhecido cai em A→Z e nada lança", () => {
    expect(ids(sortEntities(ents, "seila"))).toEqual(["e2", "e4", "e1", "e3"]);
    expect(ids(sortEntities(ents))).toEqual(["e2", "e4", "e1", "e3"]);
    expect(sortEntities(null, "az")).toEqual([]);
  });
  it("devolve nova lista, sem mutar a original", () => {
    const saida = sortEntities(ents, "za");
    expect(saida).not.toBe(ents);
    expect(ids(ents)).toEqual(["e1", "e2", "e3", "e4"]);
  });
});

describe("countByType (AC-4 — contagem zero não some)", () => {
  it("cobre os 11 tipos, zerando os ausentes", () => {
    const c = countByType(ents);
    expect(Object.keys(c).sort()).toEqual([...ENTITY_TYPE_IDS].sort());
    expect(c.location).toBe(1);
    expect(c.character).toBe(1);
    expect(c.organization).toBe(1);
    expect(c.creature).toBe(1);
    expect(c.deity).toBe(0);
    expect(c.sessionSummary).toBe(0);
    expect(c.route).toBe(0);
  });
  it("lista vazia zera tudo e tipo desconhecido não cria chave", () => {
    const c = countByType([{ id: "x", type: "tipo-que-nao-existe" }]);
    expect(Object.keys(c)).toHaveLength(11);
    expect(Object.values(c).every((n) => n === 0)).toBe(true);
    expect(Object.values(countByType(null)).every((n) => n === 0)).toBe(true);
  });
});

describe("collectTags", () => {
  it("devolve tags únicas em ordem alfabética PT-BR", () => {
    expect(collectTags(ents)).toEqual(["fronteira", "Guarda", "política"]);
  });
  it("deduplica ignorando acento e caixa, mantendo a primeira grafia", () => {
    expect(collectTags([
      { tags: ["Órfã", "sertão"] },
      { tags: ["orfa", "SERTAO", "  "] },
      { tags: null },
    ])).toEqual(["Órfã", "sertão"]);
  });
  it("lista inválida devolve vazio", () => {
    expect(collectTags(null)).toEqual([]);
  });
});
