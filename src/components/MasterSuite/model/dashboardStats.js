/* Forja do Mestre — PAINEL DO MUNDO (spec 0027, AC-6).
 *
 * Agregações do painel e o checklist de primeiros passos, que reflete o estado REAL do mundo
 * (nada de marcação manual). Lógica pura: entra lista, sai objeto.
 */

import { countByType, sortEntities, filterEntities } from "./entityFilters";

const asArray = (v) => (Array.isArray(v) ? v : []);

/**
 * Números do mundo pro painel.
 * `recent` é uma função porque o painel troca de limite e de tipo sem recalcular a contagem.
 * @returns {{total:number, byType:object, recent:(limit?:number, typeId?:string)=>Array}}
 */
export function worldStats(entities) {
  const lista = asArray(entities).filter(Boolean);
  const byType = countByType(lista);

  const recent = (limit = 5, typeId) => {
    const base = typeId ? filterEntities(lista, { types: [typeId] }) : lista;
    const n = Number(limit);
    const take = Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
    return sortEntities(base, "recent").slice(0, take);
  };

  return { total: lista.length, byType, recent };
}

/* Ordem do checklist = ordem de aparição na tela. */
export const FIRST_STEP_IDS = ["world", "character", "location", "connection", "journal", "graph"];

const LABELS = {
  world: "Criar o seu primeiro mundo",
  character: "Adicionar um personagem",
  location: "Criar um local",
  connection: "Conectar duas entidades",
  journal: "Escrever a primeira página do diário",
  graph: "Explorar o grafo do mundo",
};

/**
 * Checklist de primeiros passos.
 * O diário é o único passo que a lógica pura não consegue inferir da wiki — chega por flag:
 * explícita em `options.hasJournalEntry` ou carimbada no próprio mundo
 * (`world.hasJournalEntry` / `world.journalCount`).
 * "Explorar o grafo" abre junto com a primeira conexão: é quando o grafo deixa de ser poeira.
 * @returns {Array<{id:string, label:string, done:boolean}>}
 */
export function firstSteps(world, entities, connections, options = {}) {
  const lista = asArray(entities).filter(Boolean);
  const arestas = asArray(connections).filter(Boolean);
  const temTipo = (type) => lista.some((e) => e?.type === type);

  const temMundo = !!(world && (world.id || world.name));
  const flag = options?.hasJournalEntry;
  const temDiario = flag !== undefined
    ? !!flag
    : (world?.hasJournalEntry === true || Number(world?.journalCount) > 0);

  const done = {
    world: temMundo,
    character: temTipo("character"),
    location: temTipo("location"),
    connection: arestas.length >= 1,
    journal: temDiario,
    graph: arestas.length >= 1,
  };

  return FIRST_STEP_IDS.map((id) => ({ id, label: LABELS[id], done: done[id] }));
}
