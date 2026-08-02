/**
 * ÚNICO lugar do app onde um caminho de coleção do Firestore vira string.
 *
 * Antes da spec 0029 esses literais estavam espalhados: `"campaigns", id, "sharedSheets"`
 * aparecia 8× só no App.jsx. Renomear uma coleção era caça ao texto, e um erro de digitação
 * só aparecia em runtime. Agora renomear quebra `paths.test.js`, não a produção.
 *
 * Cada função devolve um ARRAY de segmentos, para alimentar `docAt`/`colAt` do client.
 * IDs são normalizados para string aqui (o legado passava número em alguns pontos).
 *
 * @see ../../../specs/0029-camada-de-infraestrutura/spec.md (AC-2)
 */

export const USERS = "users";
export const CAMPAIGNS = "campaigns";
export const PUBLIC_SHEETS = "publicSheets";

const CHARACTERS = "characters";
const MESSAGES = "messages";
const TYPING = "typing";
const SHARED_SHEETS = "sharedSheets";
const BESTIARY = "bestiary";
const PENDING_EDITS = "pendingEdits";

/* ── Identidade ─────────────────────────────────────────────── */
export const userDoc = (uid) => [USERS, String(uid)];

/* ── Ficha (personagens do dono) ────────────────────────────── */
export const charactersCol = (uid) => [USERS, String(uid), CHARACTERS];
export const characterDoc = (uid, charId) => [USERS, String(uid), CHARACTERS, String(charId)];

/* ── Campanha ───────────────────────────────────────────────── */
export const campaignsCol = () => [CAMPAIGNS];
export const campaignDoc = (campaignId) => [CAMPAIGNS, String(campaignId)];

/* ── Campanha › chat ────────────────────────────────────────── */
export const messagesCol = (campaignId) => [CAMPAIGNS, String(campaignId), MESSAGES];
export const typingCol = (campaignId) => [CAMPAIGNS, String(campaignId), TYPING];
export const typingDoc = (campaignId, uid) => [CAMPAIGNS, String(campaignId), TYPING, String(uid)];

/* ── Campanha › fichas na mesa ──────────────────────────────── */
export const sharedSheetsCol = (campaignId) => [CAMPAIGNS, String(campaignId), SHARED_SHEETS];
export const sharedSheetDoc = (campaignId, sheetId) =>
  [CAMPAIGNS, String(campaignId), SHARED_SHEETS, String(sheetId)];

/* ── Campanha › bestiário ───────────────────────────────────── */
export const bestiaryCol = (campaignId) => [CAMPAIGNS, String(campaignId), BESTIARY];
export const bestiaryDoc = (campaignId, creatureId) =>
  [CAMPAIGNS, String(campaignId), BESTIARY, String(creatureId)];

/* ── Ficha pública (por link) ───────────────────────────────── */
export const publicSheetDoc = (charId) => [PUBLIC_SHEETS, String(charId)];
export const pendingEditsCol = (charId) => [PUBLIC_SHEETS, String(charId), PENDING_EDITS];
export const pendingEditDoc = (charId, editId) =>
  [PUBLIC_SHEETS, String(charId), PENDING_EDITS, String(editId)];
