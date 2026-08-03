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

/* ═══════════════════════════════════════════════════════════════
   ONDA 1.5 (spec 0030) — caminhos dos stores de feature.
   ═══════════════════════════════════════════════════════════════ */

export const WORLDS = "worlds";
const WORLDMAPS = "worldmaps";
const ASSETS = "assets";
const MAP = "map";
const ELEMENTS = "elements";

/* Subcoleções do mapa-múndi */
const NODES = "nodes";
const EDGES = "edges";
const EVENTS = "events";
const MEDIA = "media";
const FOG = "fog";
const REVEALED = "revealed";
const GM = "gm";
const PARTY = "party";

/* Subcoleções da Forja do Mestre */
const ENTITIES = "entities";
const CONNECTIONS = "connections";
const FOLDERS = "folders";

/**
 * IDs de documento fixos. São singletons: cada instância tem UM estado, UM fundo.
 * Ficam aqui e não nos stores porque errar a string aqui é o mesmo tipo de bug que
 * errar o nome da coleção — some sem erro e ressurge como "sumiu meu mapa".
 */
export const ESTADO_DOC_ID = "estado";
export const FUNDO_DOC_ID = "background";
export const FOG_DOC_ID = "fog";

/* ── Mapa-múndi › ATELIÊ (molde privado do mestre) ───────────────
   A separação ateliê/mesa É o mecanismo de segredo do projeto (ADR-0006, spec 0028):
   o molde vive sob o usuário, e a campanha só recebe o que foi revelado. Confundir
   estes dois caminhos vazaria o mapa inteiro para os jogadores. */
export const atelieMapsCol = (uid) => [USERS, String(uid), WORLDMAPS];
export const atelieMapDoc = (uid, mapId) => [USERS, String(uid), WORLDMAPS, String(mapId)];
export const atelieNodesCol = (uid, mapId) => [...atelieMapDoc(uid, mapId), NODES];
export const atelieNodeDoc = (uid, mapId, nodeId) => [...atelieNodesCol(uid, mapId), String(nodeId)];
export const atelieEdgesCol = (uid, mapId) => [...atelieMapDoc(uid, mapId), EDGES];
export const atelieEdgeDoc = (uid, mapId, edgeId) => [...atelieEdgesCol(uid, mapId), String(edgeId)];
export const atelieEventsCol = (uid, mapId) => [...atelieMapDoc(uid, mapId), EVENTS];
export const atelieEventDoc = (uid, mapId, eventId) => [...atelieEventsCol(uid, mapId), String(eventId)];
export const atelieMediaDoc = (uid, mapId, docId) => [...atelieMapDoc(uid, mapId), MEDIA, String(docId)];
/** Subcoleção nomeada em tempo de execução (o store itera sobre as filhas do molde). */
export const atelieSubCol = (uid, mapId, nome) => [...atelieMapDoc(uid, mapId), String(nome)];

/* ── Mapa-múndi › MESA (instância publicada na campanha) ───────── */
export const mesaMapsCol = (campaignId) => [CAMPAIGNS, String(campaignId), WORLDMAPS];
export const mesaMapDoc = (campaignId, instanciaId) =>
  [CAMPAIGNS, String(campaignId), WORLDMAPS, String(instanciaId)];
export const mesaFogCol = (campaignId, instanciaId) => [...mesaMapDoc(campaignId, instanciaId), FOG];
export const mesaFogDoc = (campaignId, instanciaId, docId) =>
  [...mesaFogCol(campaignId, instanciaId), String(docId)];
export const mesaRevealedCol = (campaignId, instanciaId) => [...mesaMapDoc(campaignId, instanciaId), REVEALED];
export const mesaRevealedDoc = (campaignId, instanciaId, docId) =>
  [...mesaRevealedCol(campaignId, instanciaId), String(docId)];
/** Estado do mestre — o jogador NÃO lê este documento (é onde mora o segredo). */
export const mesaGmDoc = (campaignId, instanciaId) =>
  [...mesaMapDoc(campaignId, instanciaId), GM, ESTADO_DOC_ID];
export const mesaPartyDoc = (campaignId, instanciaId) =>
  [...mesaMapDoc(campaignId, instanciaId), PARTY, ESTADO_DOC_ID];
export const mesaMediaDoc = (campaignId, instanciaId, docId) =>
  [...mesaMapDoc(campaignId, instanciaId), MEDIA, String(docId)];

/* ── Forja do Mestre (mundos) ───────────────────────────────── */
export const worldsCol = () => [WORLDS];
export const worldDoc = (worldId) => [WORLDS, String(worldId)];
export const worldEntitiesCol = (worldId) => [WORLDS, String(worldId), ENTITIES];
export const worldEntityDoc = (worldId, id) => [...worldEntitiesCol(worldId), String(id)];
export const worldConnectionsCol = (worldId) => [WORLDS, String(worldId), CONNECTIONS];
export const worldConnectionDoc = (worldId, id) => [...worldConnectionsCol(worldId), String(id)];
export const worldFoldersCol = (worldId) => [WORLDS, String(worldId), FOLDERS];
export const worldFolderDoc = (worldId, id) => [...worldFoldersCol(worldId), String(id)];
/** Subcoleção nomeada em tempo de execução (`subCol(id, ENTITIES|CONNECTIONS|FOLDERS)`). */
export const worldSubCol = (worldId, nome) => [WORLDS, String(worldId), String(nome)];

/* ── Biblioteca de assets do MapEditor ──────────────────────── */
export const assetsCol = (uid) => [USERS, String(uid), ASSETS];
export const assetDoc = (uid, assetId) => [USERS, String(uid), ASSETS, String(assetId)];

/* ── Mesa tática do MapEditor (cenas e elementos) ───────────── */
export const mapScenesCol = (campaignId) => [CAMPAIGNS, String(campaignId), MAP];
export const mapSceneDoc = (campaignId, sceneId) => [CAMPAIGNS, String(campaignId), MAP, String(sceneId)];
export const mapElementsCol = (campaignId, sceneId) => [...mapSceneDoc(campaignId, sceneId), ELEMENTS];
export const mapElementDoc = (campaignId, sceneId, elementId) =>
  [...mapElementsCol(campaignId, sceneId), String(elementId)];
/**
 * Presença ao vivo do jogador. O uid vai NO ID do documento de propósito: é o que permite
 * às `firestore.rules` autorizar por split de string, sem `get()` — o teto de 20 access
 * calls por lote foi o bug que esvaziou o mundo demo da Forja (spec 0028 F4).
 */
export const mapLiveDoc = (campaignId, uid) => [CAMPAIGNS, String(campaignId), MAP, `live_${uid}`];
/** Documento avulso sob `map/` (ex.: `map/state`, o canal de troca de cena). */
export const mapDoc = (campaignId, ...segmentos) =>
  [CAMPAIGNS, String(campaignId), MAP, ...segmentos.map(String)];
