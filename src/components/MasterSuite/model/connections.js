/* Forja do Mestre — CONEXÕES TIPADAS (spec 0027, AC-5) e os recortes que o grafo consome.
 *
 * Uma conexão é uma aresta DIRECIONADA com rótulo em português e um inverso: `A CONTÉM B`
 * aparece em B como `CONTIDO EM A`. Relações simétricas (ALIADO DE, PARCEIRO DE) têm inverso
 * igual ao rótulo. Lógica pura: nada de React, nada de Firestore.
 *
 * Invariantes garantidas aqui:
 *   · nunca uma entidade se conecta a ela mesma (makeConnection lança);
 *   · nunca a mesma relação entre a mesma dupla duas vezes, em qualquer sentido (isDuplicate);
 *   · aresta com uma ponta fora do recorte não entra no grafo (graphData).
 */

import { normalize, toList, filterEntities } from "./entityFilters";

/* ---------- categorias (a legenda de cor do grafo) ---------- */

export const RELATION_KINDS = [
  { id: "family", label: "Família", color: "#c084fc" },
  { id: "alliance", label: "Aliança", color: "#4ade80" },
  { id: "conflict", label: "Conflito", color: "#f87171" },
  { id: "other", label: "Outras", color: "#a89a7c" },
];

export const RELATION_KIND_IDS = RELATION_KINDS.map((k) => k.id);

const DEFAULT_KIND = RELATION_KINDS[RELATION_KINDS.length - 1];   // "other"

/** Resolve a categoria por id; id desconhecido cai em "Outras". Nunca lança. */
export function getRelationKind(id) {
  return RELATION_KINDS.find((k) => k.id === id) || DEFAULT_KIND;
}

/* ---------- relações prontas ---------- */

export const DEFAULT_RELATION_LABEL = "RELACIONADO A";

/* Rótulos em CAIXA ALTA porque é assim que aparecem no cartão da entidade e na aresta. */
export const RELATION_PRESETS = [
  { id: "contains", label: "CONTÉM", inverse: "CONTIDO EM", kind: "other" },
  { id: "member", label: "MEMBRO DE", inverse: "TEM COMO MEMBRO", kind: "alliance" },
  { id: "leader", label: "LIDERA", inverse: "LIDERADO POR", kind: "alliance" },
  { id: "serves", label: "SERVE A", inverse: "SERVIDO POR", kind: "alliance" },
  { id: "ally", label: "ALIADO DE", inverse: "ALIADO DE", kind: "alliance" },
  { id: "enemy", label: "INIMIGO DE", inverse: "INIMIGO DE", kind: "conflict" },
  { id: "rival", label: "RIVAL DE", inverse: "RIVAL DE", kind: "conflict" },
  { id: "killed", label: "MATOU", inverse: "MORTO POR", kind: "conflict" },
  { id: "parent", label: "PROGENITOR DE", inverse: "FILHO DE", kind: "family" },
  { id: "partner", label: "PARCEIRO DE", inverse: "PARCEIRO DE", kind: "family" },
  { id: "sibling", label: "IRMÃO DE", inverse: "IRMÃO DE", kind: "family" },
  { id: "owns", label: "POSSUI", inverse: "PERTENCE A", kind: "other" },
  { id: "created", label: "CRIOU", inverse: "CRIADO POR", kind: "other" },
  { id: "lives", label: "HABITA", inverse: "HABITADO POR", kind: "other" },
  { id: "guards", label: "GUARDA", inverse: "GUARDADO POR", kind: "other" },
  { id: "worships", label: "CULTUA", inverse: "CULTUADO POR", kind: "other" },
  { id: "happened", label: "ACONTECEU EM", inverse: "PALCO DE", kind: "other" },
  { id: "participated", label: "PARTICIPOU DE", inverse: "TEVE COMO PARTICIPANTE", kind: "other" },
  { id: "connects", label: "LIGA A", inverse: "LIGADO A", kind: "other" },
  { id: "mentions", label: "CITA", inverse: "CITADO EM", kind: "other" },
];

export const RELATION_PRESET_IDS = RELATION_PRESETS.map((p) => p.id);

/** Acha o preset pelo id OU pelo rótulo (ignorando acento e caixa). Devolve null se não houver. */
export function getRelationPreset(idOrLabel) {
  const key = normalize(idOrLabel);
  if (!key) return null;
  return RELATION_PRESETS.find(
    (p) => normalize(p.id) === key || normalize(p.label) === key,
  ) || null;
}

/* ---------- criação ---------- */

const slug = (text) => normalize(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* Id determinístico: mesmo par + mesma relação ⇒ mesmo id. Sem Date.now/Math.random, o mundo
 * demo e qualquer import ficam reprodutíveis (e o Firestore ganha um doc id estável). */
const connectionId = (fromId, toId, relation) => `conn-${fromId}-${slug(relation)}-${toId}`;

/**
 * Monta e normaliza uma conexão.
 * @param {{fromId:string, toId:string, relation?:string, kind?:string}} input
 *   `relation` aceita id de preset ("parent"), rótulo de preset ("PROGENITOR DE") ou texto livre.
 * @throws quando falta uma das entidades ou quando é autoligação (AC-5).
 */
export function makeConnection(input = {}) {
  const fromId = String(input?.fromId ?? "").trim();
  const toId = String(input?.toId ?? "").trim();
  if (!fromId || !toId) throw new Error("Uma conexão precisa de duas entidades.");
  if (fromId === toId) throw new Error("Uma entidade não pode se conectar a si mesma.");

  const preset = getRelationPreset(input?.relation);
  const livre = String(input?.relation ?? "").trim();
  const relation = preset
    ? preset.label
    : (livre ? livre.toLocaleUpperCase("pt-BR") : DEFAULT_RELATION_LABEL);
  // relação livre é tratada como simétrica: sem preset, ninguém sabe o inverso.
  const inverse = preset ? preset.inverse : relation;
  const kind = RELATION_KIND_IDS.includes(input?.kind)
    ? input.kind
    : (preset ? preset.kind : DEFAULT_KIND.id);

  return {
    id: connectionId(fromId, toId, relation),
    fromId,
    toId,
    relation,
    inverse,
    kind,
    presetId: preset ? preset.id : null,
  };
}

/* ---------- consultas ---------- */

const asArray = (v) => (Array.isArray(v) ? v : []);

/**
 * A mesma relação entre a mesma dupla já existe? O sentido não importa:
 * `A CONTÉM B`, `B CONTÉM A` (mesma relação invertida) e `B CONTIDO EM A` (escrita pelo inverso)
 * são todas a mesma aresta.
 */
export function isDuplicate(connections, candidate) {
  if (!candidate) return false;
  const from = String(candidate.fromId ?? "");
  const to = String(candidate.toId ?? "");
  if (!from || !to) return false;
  const rel = normalize(candidate.relation ?? DEFAULT_RELATION_LABEL);
  const inv = normalize(candidate.inverse ?? candidate.relation ?? DEFAULT_RELATION_LABEL);

  return asArray(connections).some((c) => {
    if (!c) return false;
    const direta = c.fromId === from && c.toId === to;
    const invertida = c.fromId === to && c.toId === from;
    if (!direta && !invertida) return false;
    const cRel = normalize(c.relation ?? DEFAULT_RELATION_LABEL);
    if (direta) return cRel === rel;
    const cInv = normalize(c.inverse ?? c.relation ?? DEFAULT_RELATION_LABEL);
    return cRel === rel || cRel === inv || cInv === rel;
  });
}

/**
 * Conexões de uma entidade já vistas do lado dela: quando a entidade é o DESTINO, o rótulo
 * exibido é o inverso (AC-5 — "A CONTÉM B" aparece em B como "CONTIDO EM A").
 * @returns {Array<{connection:object, otherId:string, label:string, outgoing:boolean}>}
 */
export function connectionsOf(connections, entityId) {
  const id = String(entityId ?? "");
  if (!id) return [];
  return asArray(connections)
    .filter((c) => c && (c.fromId === id || c.toId === id))
    .map((c) => {
      const outgoing = c.fromId === id;
      const direta = c.relation || DEFAULT_RELATION_LABEL;
      return {
        connection: c,
        otherId: outgoing ? c.toId : c.fromId,
        label: outgoing ? direta : (c.inverse || direta),
        outgoing,
      };
    });
}

/** Entidades que não aparecem em nenhuma ponta de nenhuma conexão. */
export function orphanEntities(entities, connections) {
  const tocadas = new Set();
  asArray(connections).forEach((c) => {
    if (!c) return;
    tocadas.add(c.fromId);
    tocadas.add(c.toId);
  });
  return asArray(entities).filter((e) => e && !tocadas.has(e.id));
}

/**
 * Recorte do grafo: filtra os nós (tipo + busca) e, depois, as arestas (categoria), jogando
 * fora toda aresta que perdeu uma das pontas.
 * @returns {{nodes: Array, edges: Array}}
 */
export function graphData(entities, connections, options = {}) {
  const { types, kinds, query } = options || {};
  const nodes = filterEntities(entities, { types, query });
  const vivos = new Set(nodes.map((n) => n?.id));
  const kindList = toList(kinds).map((k) => String(k));

  const edges = asArray(connections).filter((c) => {
    if (!c) return false;
    if (kindList.length && !kindList.includes(c.kind || DEFAULT_KIND.id)) return false;
    return vivos.has(c.fromId) && vivos.has(c.toId);
  });

  return { nodes, edges };
}

/**
 * Números do grafo pro painel: quanto do mundo está tecido e quem é o centro dele.
 * @returns {{total:number, connected:number, orphans:number,
 *            mostConnected:Array<{id:string,name:string,degree:number}>, byKind:object}}
 */
export function graphInsights(entities, connections, options = {}) {
  const lista = asArray(entities).filter(Boolean);
  const limite = Number.isFinite(options?.limit) && options.limit > 0
    ? Math.floor(options.limit)
    : 5;

  const grau = new Map();
  lista.forEach((e) => grau.set(e.id, 0));

  const byKind = {};
  RELATION_KIND_IDS.forEach((k) => { byKind[k] = 0; });

  asArray(connections).filter(Boolean).forEach((c) => {
    const k = RELATION_KIND_IDS.includes(c.kind) ? c.kind : DEFAULT_KIND.id;
    byKind[k] += 1;
    if (grau.has(c.fromId)) grau.set(c.fromId, grau.get(c.fromId) + 1);
    if (grau.has(c.toId)) grau.set(c.toId, grau.get(c.toId) + 1);
  });

  const connected = lista.filter((e) => (grau.get(e.id) || 0) > 0).length;

  const mostConnected = lista
    .map((e) => ({ id: e.id, name: String(e.name ?? ""), degree: grau.get(e.id) || 0 }))
    .filter((x) => x.degree > 0)
    .sort((a, b) => (b.degree - a.degree)
      || a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }))
    .slice(0, limite);

  return { total: lista.length, connected, orphans: lista.length - connected, mostConnected, byKind };
}
