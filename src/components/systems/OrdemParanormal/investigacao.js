/* ════════════════════════════════════════════════════════════════════════
 *  INVESTIGAÇÃO — o dossiê do caso (spec 0040)
 *
 *  Módulo PURO: sem React, sem Firestore, sem I/O.
 *
 *  A aba Descrição cobre o PERSONAGEM. Aqui mora o CASO: as pistas que a mesa
 *  levantou, de onde vieram e o que já foi descartado.
 *
 *  O estado da pista é o ponto todo. Numa bola de texto em "Anotações", pista
 *  descartada fica indistinguível de pista viva — e é essa confusão que trava
 *  investigação na mesa: alguém volta a perseguir o que o grupo já eliminou.
 * ════════════════════════════════════════════════════════════════════════ */

export const ESTADOS_PISTA = [
  { id: "aberta", label: "Aberta", marca: "?" },
  { id: "confirmada", label: "Confirmada", marca: "✓" },
  { id: "descartada", label: "Descartada", marca: "✕" },
];

const IDS_ESTADO = ESTADOS_PISTA.map((e) => e.id);
export const estadoPorId = (id) => ESTADOS_PISTA.find((e) => e.id === id) || ESTADOS_PISTA[0];

/**
 * Cria uma pista. Nasce SEMPRE "aberta": uma pista que já entra confirmada não
 * foi investigada, foi assumida.
 * @returns {{id:string,texto:string,origem:string,estado:string}|null} `null` sem texto —
 *   pista sem texto é uma linha vazia na lista, não um registro.
 */
export function novaPista({ texto, origem, id } = {}) {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  return {
    id: id || `pista-${t.toLowerCase().replace(/\s+/g, "-").slice(0, 24)}`,
    texto: t.slice(0, 300),
    origem: String(origem ?? "").trim().slice(0, 120),
    estado: "aberta",
  };
}

/** Troca o estado de uma pista. Estado desconhecido é ignorado — o Firestore é
 *  schemaless e uma string errada não pode virar um quarto estado. */
export function mudarEstadoPista(pistas, id, estado) {
  if (!IDS_ESTADO.includes(estado)) return Array.isArray(pistas) ? pistas : [];
  return (Array.isArray(pistas) ? pistas : []).map((p) =>
    p && p.id === id ? { ...p, estado } : p,
  );
}

export const removerPista = (pistas, id) =>
  (Array.isArray(pistas) ? pistas : []).filter((p) => p && p.id !== id);

/**
 * Contagem por estado. `abertas` é o número que vai no cabeçalho: o total conta
 * trabalho já encerrado e não diz quanto ainda falta perseguir.
 */
export function contarPistas(pistas) {
  const lista = (Array.isArray(pistas) ? pistas : []).filter(Boolean);
  const conta = { total: lista.length, abertas: 0, confirmadas: 0, descartadas: 0 };
  for (const p of lista) {
    if (p.estado === "confirmada") conta.confirmadas++;
    else if (p.estado === "descartada") conta.descartadas++;
    else conta.abertas++; // estado ausente/desconhecido conta como aberta
  }
  return conta;
}

/** Abertas primeiro, descartadas por último — a lista se ordena pelo que ainda
 *  exige ação, não pela ordem em que foi digitada. */
const PESO = { aberta: 0, confirmada: 1, descartada: 2 };
export const pistasOrdenadas = (pistas) =>
  (Array.isArray(pistas) ? pistas : [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => (PESO[a.estado] ?? 0) - (PESO[b.estado] ?? 0));
