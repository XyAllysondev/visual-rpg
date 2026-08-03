/**
 * Agregado Mesa Tática — `campaigns/{campaignId}/map/*` (cenas, elementos, imagens e o
 * canal ao vivo).
 *
 * Substitui as 40 chamadas de Firestore de `MapEditor/sync/campaignSync2.js` e
 * `MapEditor/sync/live.js` (spec 0030, onda 1.5). Os dois são a mesma feature — a mesa —
 * e compartilham a coleção `map`, por isso um repositório só.
 *
 * ## O que NÃO mora aqui (AC-3)
 * O **diff de elementos** (`elementDiff.js`), a redução de imagem em dois estágios e a
 * migração v1→v2 continuam no `campaignSync2`. Este repo recebe dado pronto: um lote de
 * operações, um objeto de cena limpo, uma string de imagem já comprimida.
 *
 * ## Como um lote atravessa a fronteira (AC-4)
 * `writeBatch` é primitiva do SDK e não sai daqui. Quem chama monta uma lista de operações
 * simples — `{ op: 'set'|'update'|'delete', path: string[], data?: object }` — e o repo
 * traduz. Os `path` vêm de `elementPath`/`mapDocPath`, que reexportam `paths.js`: o módulo
 * de UI nunca digita um segmento de coleção.
 *
 * ## PERDA DE DADOS SILENCIOSA CONHECIDA — documentada, não consertada
 * `commitBatchSilent` engole a falha do commit. É o que o `publishElements` sempre fez, e
 * combinado com o autosave do `MapEditor/index.jsx` — que avança a baseline
 * (`lastPubRef.current = next`) ANTES de publicar, sem `await` — produz este bug real:
 *
 *   > se a escrita falha, a alteração nunca mais entra num diff, porque a baseline já
 *   > considera que ela foi publicada. O mestre vê o elemento na tela dele; a mesa nunca o
 *   > recebe, e nenhum erro aparece.
 *
 * Está registrado no `docs/STATE.md`. Consertar exige decidir política de retry (repetir?
 * reverter a baseline? avisar o mestre?) — é escopo da ONDA 3. A onda 1.5 só move o acesso
 * a dados, e concentra a falha AQUI para que ela fique visível num lugar só (AC-7).
 */
import {
  onSnapshot, getDoc, getDocs, setDoc, deleteDoc, writeBatch,
  query, where, serverTimestamp,
} from "firebase/firestore";
import { db, docAt, colAt, silent, NOOP_UNSUBSCRIBE } from "./client";
import {
  campaignDoc, mapScenesCol, mapElementsCol, mapElementDoc, mapLiveDoc, mapDoc,
} from "./paths";

/** Documento avulso que guarda o ponteiro da cena ativa (`map/state`). */
const STATE_DOC_ID = "state";
/** Documento v1 da mesa, que a migração lê e depois marca com `migratedTo`. */
const LEGACY_SCENE_DOC_ID = "scene";

/**
 * Marcador de "carimbe o horário do servidor aqui", para os lotes.
 *
 * `serverTimestamp()` é FieldValue do SDK e não pode ser montado pela borda (AC-4), mas a
 * migração precisa de `updatedAt` em documentos diferentes DENTRO do mesmo lote. Um Symbol
 * (e não a string `"@serverTimestamp"`) porque o valor de um campo pode ser texto do
 * usuário — o conteúdo de uma nota, por exemplo — e nenhuma string é impossível de digitar.
 */
export const SERVER_TIME = Symbol("serverTimestamp");

/** Troca os `SERVER_TIME` de primeiro nível pelo FieldValue. Não recursivo: os documentos
 *  da mesa carimbam o horário na raiz, e varrer o objeto inteiro custaria em cada elemento
 *  de cada lote. */
function stamp(data) {
  if (!data) return data;
  let out = data;
  for (const [k, v] of Object.entries(data)) {
    if (v !== SERVER_TIME) continue;
    if (out === data) out = { ...data };
    out[k] = serverTimestamp();
  }
  return out;
}

/* ── Caminhos opacos para montar lotes ──────────────────────────────────────
   Devolvem o array de segmentos de `paths.js`. Quem chama trata como token opaco:
   monta a op, entrega ao `commitBatch` e nunca inspeciona. É o que permite ao
   `campaignSync2` descrever um lote sem conhecer nomes de coleção. */

/** @returns {string[]} caminho de um elemento da cena. */
export const elementPath = (campaignId, sceneId, elementId) =>
  mapElementDoc(campaignId, sceneId, elementId);

/** @returns {string[]} caminho de um documento avulso sob `map/` (cena, `state`, imagem). */
export const mapDocPath = (campaignId, ...segmentos) => mapDoc(campaignId, ...segmentos);

/* ── Assinaturas ────────────────────────────────────────────────────────────
   Todas devolvem unsubscribe; sem id devolvem o cancelamento inerte (chamar duas vezes é
   seguro). `hasPendingWrites` atravessa como BOOLEANO — o `SnapshotMetadata` fica aqui. */

/**
 * Assina o ponteiro da cena ativa. Entrega `null` quando a mesa ainda não foi migrada.
 * @param {(state: object|null) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function watchState(campaignId, onChange) {
  if (!campaignId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    docAt(mapDoc(campaignId, STATE_DOC_ID)),
    (snap) => onChange(snap.exists() ? snap.data() : null),
    (e) => console.error("[mapSyncRepo.watchState] falhou:", e)
  );
}

/**
 * Assina os METADADOS de todas as cenas (sem os elementos).
 *
 * O filtro `kind == "scene"` não é cosmético: `map/` é uma coleção heterogênea — guarda
 * cenas, imagens (`img_*`), presenças (`live_*`) e o `state`. Sem ele, o painel do mestre
 * baixaria todas as imagens em base64 da campanha.
 *
 * @param {(metas: object[], fromSelf: boolean) => void} onChange `fromSelf` diz que o
 *   snapshot é o eco otimista da própria escrita — a UI usa isso para não se sobrescrever.
 * @returns {() => void} unsubscribe
 */
export function watchScenes(campaignId, onChange) {
  if (!campaignId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    query(colAt(mapScenesCol(campaignId)), where("kind", "==", "scene")),
    (snap) => onChange(
      snap.docs.map((d) => ({ ...d.data(), id: d.id })),
      snap.metadata.hasPendingWrites
    ),
    (e) => console.error("[mapSyncRepo.watchScenes] falhou:", e)
  );
}

/**
 * Assina os elementos de UMA cena — um documento por elemento (ADR-0006 §2).
 *
 * Sem `id` no objeto: o elemento já carrega o próprio `id` no corpo, e é por ele que o
 * reducer da mesa casa o estado local. Herdado (AC-7).
 *
 * @param {(elementos: object[], fromSelf: boolean) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function watchElements(campaignId, sceneId, onChange) {
  if (!campaignId || !sceneId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    colAt(mapElementsCol(campaignId, sceneId)),
    (snap) => onChange(snap.docs.map((d) => d.data()), snap.metadata.hasPendingWrites),
    (e) => console.error("[mapSyncRepo.watchElements] falhou:", e)
  );
}

/**
 * Assina as presenças ao vivo da mesa (ping, apontador, régua, câmera).
 * @param {(presencas: object[]) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function watchLive(campaignId, onChange) {
  if (!campaignId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    query(colAt(mapScenesCol(campaignId)), where("kind", "==", "live")),
    (snap) => onChange(snap.docs.map((d) => d.data())),
    (e) => console.error("[mapSyncRepo.watchLive] falhou:", e)
  );
}

/* ── Leituras pontuais ──────────────────────────────────────────────────── */

/**
 * Lê o ponteiro da cena ativa uma vez (a migração precisa saber se já rodou).
 * @policy silent MUDO — nem loga. Herdado: a migração trata "não consegui ler" e "não
 *   existe" do mesmo jeito, e um erro no console aqui apareceria em toda mesa nova.
 * @returns {Promise<object|null>}
 */
export async function readState(campaignId) {
  try {
    const snap = await getDoc(docAt(mapDoc(campaignId, STATE_DOC_ID)));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

/**
 * Lê o documento v1 da mesa (`map/scene`), origem da migração lazy.
 * @policy silent MUDO — mesma razão de `readState`.
 * @returns {Promise<object|null>}
 */
export async function readLegacyScene(campaignId) {
  try {
    const snap = await getDoc(docAt(mapDoc(campaignId, LEGACY_SCENE_DOC_ID)));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

/**
 * Lê o base64 de uma imagem da mesa. Imagens são IMUTÁVEIS — é isso que autoriza o cache
 * de módulo do `campaignSync2` a nunca invalidar.
 * @policy silent — devolve `null` (a UI mostra o elemento sem textura).
 * @returns {Promise<string|null>}
 */
export async function getImageData(campaignId, imageId) {
  return silent("mapSyncRepo.getImageData", null, async () => {
    const snap = await getDoc(docAt(mapDoc(campaignId, imageId)));
    return (snap.exists() ? snap.data().data : null) ?? null;
  });
}

/**
 * Existe imagem com este id? É a checagem de dedup do content-addressing `img_a_<hash16>`.
 * @policy silent MUDO — herdado (`.catch(() => null)`): falhar a checagem vira "não
 *   existe", e o `saveImage` seguinte reescreve o mesmo conteúdo no mesmo id. Idempotente,
 *   custa uma escrita, não corrompe nada.
 * @returns {Promise<boolean>}
 */
export async function imageExists(campaignId, imageId) {
  try {
    const snap = await getDoc(docAt(mapDoc(campaignId, imageId)));
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * Membros da campanha, para o "Atribuir a…" (spec 0010 AC-2).
 *
 * Lê `campaigns/{id}` — documento de OUTRO agregado. Fica aqui porque `campaignsRepo` não
 * expõe leitura por id, e abri-lo é mudança fora do escopo da onda 1.5. Quando expuser,
 * este método vira uma linha de encaminhamento.
 *
 * @policy silent — devolve `null`; o `campaignSync2` traduz para lista vazia, como antes.
 * @returns {Promise<object|null>}
 */
export async function getCampaignDoc(campaignId) {
  return silent("mapSyncRepo.getCampaignDoc", null, async () => {
    const snap = await getDoc(docAt(campaignDoc(campaignId)));
    return snap.data() ?? null;
  });
}

/**
 * IDs dos elementos de uma cena — o que o `deleteScene` precisa para montar o lote de
 * exclusão. Só os ids: `DocumentReference` não atravessa a fronteira (AC-4).
 * @policy strict — quem chama precisa distinguir "cena sem elementos" de "não consegui
 *   listar"; apagar a cena achando que ela estava vazia deixaria elementos órfãos.
 * @returns {Promise<string[]>}
 */
export async function listElementIds(campaignId, sceneId) {
  const snap = await getDocs(colAt(mapElementsCol(campaignId, sceneId)));
  return snap.docs.map((d) => d.id);
}

/* ── Escritas ───────────────────────────────────────────────────────────── */

/**
 * Sobe uma imagem da mesa. Recebe o base64 JÁ reduzido — os dois estágios de downscale e o
 * teto de tamanho são do `campaignSync2` (AC-3).
 * @policy silent — devolve `false` no erro; o módulo traduz para `null` e a UI mantém a
 *   imagem só no estado local. Herdado (AC-7).
 * @returns {Promise<boolean>} gravou?
 */
export async function saveImage(campaignId, imageId, data) {
  return silent("mapSyncRepo.saveImage", false, async () => {
    await setDoc(docAt(mapDoc(campaignId, imageId)), {
      kind: "image", data, updatedAt: serverTimestamp(),
    });
    return true;
  });
}

/**
 * Grava os metadados da cena (sem os elementos — eles são documentos próprios).
 * @param {object} meta já sem `elements` e já sem `undefined` (o módulo limpa).
 * @policy silent — autosave de meta que falha nunca interrompeu a edição. Herdado.
 */
export async function saveSceneMeta(campaignId, sceneId, meta, uid) {
  return silent("mapSyncRepo.saveSceneMeta", undefined, () =>
    setDoc(docAt(mapDoc(campaignId, sceneId)), {
      kind: "scene", ...meta, updatedAt: serverTimestamp(), updatedBy: uid,
    })
  );
}

/**
 * Grava o ponteiro da cena ativa (`map/state`) — o canal de troca de cena da mesa.
 * @param {object} state `{ v, activeSceneId, updatedBy }`; `updatedAt` é carimbado aqui.
 * @policy silent — herdado.
 */
export async function saveState(campaignId, state) {
  return silent("mapSyncRepo.saveState", undefined, () =>
    setDoc(docAt(mapDoc(campaignId, STATE_DOC_ID)), { ...state, updatedAt: serverTimestamp() })
  );
}

/**
 * Move o elemento — merge só dos campos de posição.
 *
 * `{ merge: true }` é obrigatório aqui e não é detalhe de performance: é exatamente o
 * `affectedKeys` que as `firestore.rules` v2 autorizam no modo `owner`. Um `setDoc` inteiro
 * do jogador seria NEGADO pelas rules.
 *
 * @param {{x:number, y:number, rotation?:number}} pos
 * @policy silent — o caso comum de falha é a própria negação das rules (o jogador tentou
 *   mover o que não é dele); a UI já devolve o elemento à posição do snapshot. Herdado.
 */
export async function updateElementPos(campaignId, sceneId, elementId, pos) {
  return silent("mapSyncRepo.updateElementPos", undefined, () =>
    setDoc(docAt(mapElementDoc(campaignId, sceneId, elementId)), pos, { merge: true })
  );
}

/* ── Canal ao vivo ──────────────────────────────────────────────────────── */

/**
 * Publica a presença do jogador em `map/live_{uid}`.
 *
 * **O uid vai NO ID do documento e isso não pode mudar.** É o que permite às
 * `firestore.rules` autorizarem a escrita por split de string, sem `get()` — o teto de 20
 * access calls por lote foi o bug que esvaziou o mundo demo da Forja (spec 0028 F4).
 *
 * @param {object} payload `{ kind:'live', uid, at, name, color, master, ... }` — o `at` é o
 *   relógio do CLIENTE de propósito: quem recebe compara com o próprio relógio para
 *   descartar presença velha, e `serverTimestamp` só chegaria depois do round-trip.
 * @policy silent — a presença é efêmera; a próxima janela do throttle tenta de novo.
 */
export async function setLive(campaignId, uid, payload) {
  return silent("mapSyncRepo.setLive", undefined, () =>
    setDoc(docAt(mapLiveDoc(campaignId, uid)), payload)
  );
}

/**
 * Apaga a presença ao sair da mesa.
 * @policy silent MUDO — nem loga, herdado (`.catch(() => {})`). Roda na desmontagem, quando
 *   a sessão pode já ter perdido a permissão (logout, fechar a aba); logar aqui encheria o
 *   console de erro em toda saída normal. E a presença expira sozinha pelo `STALE_MS`.
 */
export async function clearLive(campaignId, uid) {
  try {
    await deleteDoc(docAt(mapLiveDoc(campaignId, uid)));
  } catch {
    /* silêncio herdado — ver JSDoc */
  }
}

/* ── Lotes ──────────────────────────────────────────────────────────────── */

/**
 * @typedef {{op: 'set'|'update'|'delete', path: string[], data?: object}} BatchOp
 */

/** Traduz UMA operação simples para o `WriteBatch` do SDK. */
function applyOp(batch, { op, path, data }) {
  const ref = docAt(path);
  if (op === "set") return batch.set(ref, stamp(data));
  if (op === "update") return batch.update(ref, stamp(data));
  if (op === "delete") return batch.delete(ref);
  throw new Error(`operação de lote desconhecida: ${op}`);
}

/** Um lote, uma ida à rede. Quem chama já fatiou em pedaços ≤ 500 (`chunkOps`). */
async function runBatch(ops) {
  if (!ops || ops.length === 0) return;
  const batch = writeBatch(db);
  ops.forEach((o) => applyOp(batch, o));
  await batch.commit();
}

/**
 * Executa um lote de operações atômicas.
 *
 * @param {BatchOp[]} ops operações JÁ fatiadas pelo teto de 500 do Firestore. Use
 *   `SERVER_TIME` como valor de campo para o horário do servidor.
 * @policy strict — usado pela exclusão de cena e pela migração v1→v2, onde parar no
 *   primeiro erro é o que evita meia-migração: o `state` (marcador de conclusão) está no
 *   último lote de propósito, então abortar antes dele faz a migração rodar de novo.
 */
export async function commitBatch(ops) {
  return runBatch(ops);
}

/**
 * Idem, mas engolindo a falha.
 *
 * @policy silent — **é a perda de dados silenciosa documentada no topo deste arquivo.**
 *   Existe só para o `publishElements`, cujo autosave avança a baseline antes de publicar:
 *   se este commit falha, a alteração não volta em nenhum diff futuro. Preservado
 *   deliberadamente (AC-7) — a política de retry é decisão da onda 3. **Não use em código
 *   novo.**
 * @param {BatchOp[]} ops
 */
export async function commitBatchSilent(ops) {
  return silent("mapSyncRepo.commitBatchSilent", undefined, () => runBatch(ops));
}
