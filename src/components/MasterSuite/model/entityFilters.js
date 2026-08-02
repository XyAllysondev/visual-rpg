/* Forja do Mestre — NAVEGAÇÃO DA WIKI (spec 0027, AC-4).
 *
 * Busca, filtro, ordenação, contagem por tipo e coleta de tags. Lógica pura: recebe listas
 * simples e devolve listas novas — nada de React, nada de Firestore. `updatedAt` chega em
 * qualquer formato razoável (millis, Date, ISO ou Timestamp-like `{ seconds }`).
 *
 * Regra de combinação (AC-4): E lógico ENTRE categorias, OU dentro de cada categoria.
 * Parâmetro ausente/vazio não filtra nada.
 */

import { ENTITY_TYPE_IDS } from "./entityTypes";

const DIACRITICS = /[\u0300-\u036f]/g;

/** minúsculas + sem acento + sem espaço nas pontas. Base de toda comparação textual. */
export function normalize(str) {
  if (str === null || str === undefined) return "";
  return String(str).normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();
}

/** Aceita array, Set, string solta, null — devolve sempre um array. */
export function toList(value) {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof Set !== "undefined" && value instanceof Set) return Array.from(value);
  return [value];
}

const asArray = (v) => (Array.isArray(v) ? v : []);

/* Campos varridos pela busca: nome, descrição e tags (AC-4). O separador evita que um termo
 * "vaze" de um campo pro outro por acidente de concatenação. */
const haystack = (entity) => [
  normalize(entity?.name),
  normalize(entity?.description),
  asArray(entity?.tags).map(normalize).join(" "),
].join("  ");

/** Busca textual insensível a acento e caixa. Todos os termos precisam casar (E lógico). */
export function searchEntities(entities, query) {
  const list = asArray(entities);
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return list.slice();
  return list.filter((e) => {
    const hay = haystack(e);
    return terms.every((t) => hay.includes(t));
  });
}

/**
 * Filtros combináveis da wiki.
 * @param {Array} entities
 * @param {{types?, tags?, folderId?, query?}} options — ausente/vazio = não filtra
 */
export function filterEntities(entities, options = {}) {
  const { types, tags, folderId, query } = options || {};
  let out = asArray(entities).slice();

  const typeList = toList(types).map((t) => String(t));
  if (typeList.length) out = out.filter((e) => typeList.includes(e?.type));

  const tagList = toList(tags).map(normalize).filter(Boolean);
  if (tagList.length) {
    out = out.filter((e) => {
      const own = asArray(e?.tags).map(normalize);
      return tagList.some((t) => own.includes(t));
    });
  }

  if (folderId !== undefined && folderId !== null && folderId !== "") {
    out = out.filter((e) => e?.folderId === folderId);
  }

  if (normalize(query)) out = searchEntities(out, query);

  return out;
}

/* ---------- ordenação ---------- */

export const SORT_OPTIONS = [
  { id: "az", label: "A → Z" },
  { id: "za", label: "Z → A" },
  { id: "recent", label: "Editados recentemente" },
  { id: "oldest", label: "Mais antigos" },
];

export const SORT_IDS = SORT_OPTIONS.map((o) => o.id);

/** Converte qualquer carimbo de data em millis; devolve null quando não dá pra saber. */
export function toMillis(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "object") {
    if (typeof value.toMillis === "function") {
      const t = Number(value.toMillis());
      return Number.isFinite(t) ? t : null;
    }
    const secs = Number(value.seconds ?? value._seconds);
    if (Number.isFinite(secs)) {
      const nanos = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
      return secs * 1000 + (Number.isFinite(nanos) ? Math.floor(nanos / 1e6) : 0);
    }
  }
  return null;
}

const byName = (a, b) =>
  String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "pt-BR", { sensitivity: "base" });

/**
 * Ordena sem mutar a lista original.
 * Decisão: entidade SEM data conhecida afunda pro fim tanto em "recentes" quanto em "antigos" —
 * "não sei quando foi" não é o mesmo que "foi no começo dos tempos".
 */
export function sortEntities(entities, sortId = "az") {
  const out = asArray(entities).slice();
  const mode = SORT_IDS.includes(sortId) ? sortId : "az";

  if (mode === "az") return out.sort(byName);
  if (mode === "za") return out.sort((a, b) => byName(b, a));

  const dir = mode === "recent" ? -1 : 1;
  return out.sort((a, b) => {
    const ta = toMillis(a?.updatedAt);
    const tb = toMillis(b?.updatedAt);
    if (ta === null && tb === null) return byName(a, b);
    if (ta === null) return 1;
    if (tb === null) return -1;
    if (ta === tb) return byName(a, b);
    return (ta - tb) * dir;
  });
}

/* ---------- agregações ---------- */

/** Contagem por tipo cobrindo SEMPRE os 11 (AC-4: contagem zero não some da barra). */
export function countByType(entities) {
  const out = {};
  ENTITY_TYPE_IDS.forEach((id) => { out[id] = 0; });
  asArray(entities).forEach((e) => {
    const t = e?.type;
    if (typeof t === "string" && Object.prototype.hasOwnProperty.call(out, t)) out[t] += 1;
  });
  return out;
}

/** Tags únicas (dedupe sem acento/caixa, mantendo a primeira grafia), em ordem PT-BR. */
export function collectTags(entities) {
  const seen = new Map();
  asArray(entities).forEach((e) => {
    asArray(e?.tags).forEach((tag) => {
      const raw = String(tag ?? "").trim();
      const key = normalize(raw);
      if (key && !seen.has(key)) seen.set(key, raw);
    });
  });
  return Array.from(seen.values())
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}
