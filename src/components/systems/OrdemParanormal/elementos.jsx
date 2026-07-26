/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — ELEMENTOS DE AFINIDADE (canonical Outro Lado lore)
 *  Five elements. Medo is GM-only: players cannot pick it; only a campaign
 *  Mestre may grant it. Persisted to Firestore on the character doc as
 *  `elementoAfinidade` (+ `elementoGmOverride`, `elementoConcedidoPor`).
 *  (Firestore is schemaless — the brief's SQL/Supabase parts are N/A.)
 * ════════════════════════════════════════════════════════════════════════ */

export const ELEMENTOS = {
  morte: {
    id: "morte", name: "Morte", symbolType: "spiral", gmOnly: false,
    primary: "#c8c8c8", accent: "#f0f0f0", glow: "rgba(200,200,200,0.45)", bg: "#151518", border: "#888888",
    emphasis: [], sectionTitle: "Manifestações da Morte",
    sectionHint: "Registre poderes necróticos, contatos com o além e estados transitórios entre vida e morte.",
    description: "Formas espirais. A linha entre vivo e morto se torna permeável.",
    lore: "Rituais: Cicatrização, Rotura. O agente percebe a morte como um estado transitório.",
    crisis: { watermark: "Limiar da Morte", vignette: "rgba(120,90,150,0.34)" },
  },
  sangue: {
    id: "sangue", name: "Sangue", symbolType: "blood-cross", gmOnly: false,
    primary: "#cc0000", accent: "#ff2a2a", glow: "rgba(204,0,0,0.5)", bg: "#2c0a0a", border: "#8b0000",
    emphasis: ["VIG"], sectionTitle: "Laços de Sangue",
    sectionHint: "Mapeie pactos de sangue, vínculos rituais com aliados e inimigos.",
    description: "Quadrados em várias posições com finas linhas onduladas.",
    lore: "Ritual: Espelhar. O sangue é o elo entre dimensões. Vida e poder tornam-se a mesma coisa.",
    crisis: { watermark: "Hemorragia Crítica", vignette: "rgba(180,0,0,0.45)" },
  },
  conhecimento: {
    id: "conhecimento", name: "Conhecimento", symbolType: "triangle-rune", gmOnly: false,
    primary: "#c9a84c", accent: "#d4a017", glow: "rgba(201,168,76,0.5)", bg: "#1b1404", border: "#8b7000",
    emphasis: ["INT"], sectionTitle: "Arquivos Proibidos",
    sectionHint: "Anote pesquisas, sigilos e verdades proibidas que o agente decifrou.",
    description: "Sigilos e letras que formam frases pelos símbolos.",
    lore: "Triângulo dentro de círculo com runas. Conhecimento além dos limites humanos — ao custo da sanidade.",
    crisis: { watermark: "Sobrecarga Cognitiva", vignette: "rgba(0,60,160,0.32)" },
  },
  energia: {
    id: "energia", name: "Energia", symbolType: "diamond", gmOnly: false,
    primary: "#8844cc", accent: "#9b59b6", glow: "rgba(136,68,204,0.5)", bg: "#1f0c31", border: "#5b0099",
    emphasis: ["FOR", "VIG"], sectionTitle: "Surtos de Energia",
    sectionHint: "Acompanhe explosões de energia, sobrecargas e descargas paranormais.",
    description: "Diamante elétrico. O símbolo aparece em vários rituais de Energia.",
    lore: "Ritual: Anfitrião. O corpo torna-se um condutor direto do Outro Lado.",
    crisis: { watermark: "Sobrecarga Energética", vignette: "rgba(110,0,190,0.34)" },
  },
  medo: {
    id: "medo", name: "Medo", symbolType: "fear-glyph", gmOnly: true,
    primary: "#4466cc", accent: "#5b8dd9", glow: "rgba(68,102,204,0.6)", bg: "#0c162c", border: "#1a3399",
    emphasis: [], sectionTitle: "Vestígios do Medo",
    sectionHint: "Registre vislumbres do Pavor Anormal e da Névoa do Outro Lado.",
    description: "Apenas o próprio símbolo. Névoa do Outro Lado e Pavor Anormal.",
    lore: "Rituais: Névoa do Outro Lado, Pavor Anormal. Não é alcançável por todos — concedido pelo Mestre.",
    crisis: { watermark: "Pavor Absoluto", vignette: "rgba(0,0,120,0.5)" },
  },
};

/* Base "Ordem" identity before any element (NEX < 50%). */
export const DEFAULT_ELEMENT_THEME = {
  id: null, name: "Ordem", symbolType: null, gmOnly: false,
  primary: "#c9a84c", accent: "#e8c96d", glow: "rgba(201,168,76,0.4)", bg: "#14141c", border: "rgba(201,168,76,0.34)",
  emphasis: [], crisis: { watermark: "Estado Crítico", vignette: "rgba(229,57,53,0.42)" },
};

export const ELEMENT_UNLOCK_NEX = 50;

/** Elements a player may choose directly (excludes GM-only). */
export const SELECTABLE_ELEMENTS = Object.values(ELEMENTOS).filter((e) => !e.gmOnly);

export const getElementTheme = (id) => ELEMENTOS[id] || DEFAULT_ELEMENT_THEME;
