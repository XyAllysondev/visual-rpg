/* Sync v2 do mapa da mesa (spec 0009 / ADR 0006).
 * Firestore: campaigns/{id}/map/state (ponteiro) + map/{sceneId} (kind:'scene', meta sem
 * elements) + map/{sceneId}/elements/{elId} (um doc por elemento) + map/img_* (imagens
 * imutáveis; novos ids content-addressed img_a_<hash16>).
 *
 * O acesso ao Firestore vive em `infrastructure/firestore/mapSyncRepo` desde a onda 1.5
 * (spec 0030 / ADR-0010). O que ficou AQUI é o que não é acesso a dado: o diff de
 * elementos, a redução de imagem em dois estágios, o cache de imagens e a migração v1→v2.
 * O repositório recebe dado pronto — ou uma lista de operações de lote. */
import {
  watchState, watchScenes, watchElements,
  readState, readLegacyScene, getImageData, imageExists, getCampaignDoc, listElementIds,
  saveImage as repoSaveImage, saveSceneMeta as repoSaveSceneMeta, saveState,
  updateElementPos as repoUpdateElementPos,
  commitBatch, commitBatchSilent, elementPath, mapDocPath, SERVER_TIME,
} from '../../../infrastructure/firestore/mapSyncRepo';
import { diffElements, chunkOps } from './elementDiff';
import { newScene, newSceneId } from '../schema';
import { migrateSceneV2 } from '../migrations';

/* Firestore não aceita undefined — clone JSON remove. */
const clean = (x) => JSON.parse(JSON.stringify(x));

/* ── Assinaturas ─────────────────────────────────────────────────────────── */
/* O parâmetro `db` continua na assinatura de todas as funções, ignorado: `index.jsx` e
   `App.jsx` ainda chamam `fn(db, campaignId, …)` em 20 pontos, e eles pertencem a outra
   onda. Some quando os chamadores forem migrados. */

export function subscribeMapState(db, cid, cb) {
  return watchState(cid, cb);
}

/* Metadados de todas as cenas (painel do mestre + cena ativa de todos). */
export function subscribeScenes(db, cid, cb) {
  return watchScenes(cid, cb);
}

export function subscribeElements(db, cid, sceneId, cb) {
  return watchElements(cid, sceneId, cb);
}

/* ── Imagens (imutáveis → leitura on-demand + cache de módulo) ───────────── */

/* O cache mora aqui, e não no repositório, porque ele nunca invalida: é a IMUTABILIDADE da
   imagem (o id é o hash do conteúdo) que o torna correto, e isso é regra do formato da
   mesa, não da persistência. */
const imgCache = new Map();

export async function getImage(db, cid, imageId) {
  const key = `${cid}/${imageId}`;
  if (imgCache.has(key)) return imgCache.get(key);
  const data = await getImageData(cid, imageId);
  if (data) imgCache.set(key, data);
  return data;
}

const DOC_SAFE = 900_000;

function downscale(dataUrl, maxDim, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * r));
      c.height = Math.max(1, Math.round(img.height * r));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/* SHA-256 → 16 hex (ids img_a_*); fallback aleatório se crypto.subtle indisponível. */
export async function hashDataUrl(dataUrl) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataUrl));
    return [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
}

/* Sobe imagem reduzida. Com imageId (fluxo legado img_/img_tok_) preserva o id; sem, usa
 * content-addressing img_a_<hash16> com dedup (checa antes de gravar — base p/ 0013).
 * Os dois estágios de redução ficam aqui: é regra de formato da mesa (o teto de 900 KB é o
 * tamanho seguro de um documento), não de persistência. */
export async function saveImage(db, cid, imageId, dataUrl) {
  let data = dataUrl;
  if (data.length > DOC_SAFE) data = (await downscale(data, 1600, 0.82)) || data;
  if (data.length > DOC_SAFE) data = (await downscale(data, 1200, 0.7)) || data;
  if (data.length > DOC_SAFE) {
    alert('Imagem grande demais para a mesa mesmo após redução — use um arquivo menor.');
    return null;
  }
  let id = imageId;
  if (!id) {
    id = 'img_a_' + await hashDataUrl(data);
    if (await imageExists(cid, id)) return { imageId: id, data };
  }
  if (!await repoSaveImage(cid, id, data)) return null;
  imgCache.set(`${cid}/${id}`, data);
  return { imageId: id, data };
}

/* ── Escrita de cena/elementos (mestre) ──────────────────────────────────── */

/* Meta da cena (sem elements). */
export function saveSceneMeta(db, cid, uid, scene) {
  const { elements: _e, ...meta } = scene;
  return repoSaveSceneMeta(cid, scene.id, clean(meta), uid);
}

/* Publica só o diff de elementos em batches. Devolve true se algo foi escrito.
 *
 * ATENÇÃO — perda de dados silenciosa CONHECIDA e preservada (AC-7): `commitBatchSilent`
 * engole a falha do commit, e o autosave do `index.jsx` avança a baseline
 * (`lastPubRef.current = next`) ANTES de chamar esta função. Se a escrita falha, a
 * alteração nunca mais entra num diff. O conserto exige decidir política de retry e é
 * escopo da onda 3 — o problema está documentado no JSDoc do `mapSyncRepo`. */
export async function publishElements(db, cid, sceneId, prevById, nextById) {
  const { adds, updates, deletes } = diffElements(prevById, nextById);
  if (!adds.length && !updates.length && !deletes.length) return false;
  const ops = [
    ...[...adds, ...updates].map(el => ({
      op: 'set', path: elementPath(cid, sceneId, el.id), data: clean(el),
    })),
    ...deletes.map(id => ({ op: 'delete', path: elementPath(cid, sceneId, id) })),
  ];
  /* Fatia pelo teto de 500 ops/batch do Firestore antes de entregar ao repositório. */
  for (const chunk of chunkOps(ops)) await commitBatchSilent(chunk);
  return true;
}

/* Membros da campanha p/ "Atribuir a…" (spec 0010 AC-2). */
export async function getCampaignMembers(db, cid) {
  const d = await getCampaignDoc(cid) || {};
  return (d.members || []).map(m => ({ uid: m, name: d.memberNames?.[m] || m.slice(0, 6) }));
}

/* Update de posição do PRÓPRIO elemento (jogador, spec 0010): merge só de x/y(/rotation)
 * — exatamente o affectedKeys que as rules v2 autorizam no modo 'owner'. */
export function updateElementPos(db, cid, sceneId, elId, pos) {
  return repoUpdateElementPos(cid, sceneId, elId, pos);
}

export function setActiveScene(db, cid, uid, sceneId) {
  return saveState(cid, { v: 2, activeSceneId: sceneId, updatedBy: uid });
}

export async function createScene(db, cid, uid, name) {
  const sc = newScene(name || 'Nova cena', newSceneId());
  await saveSceneMeta(db, cid, uid, sc);
  return sc.id;
}

export async function deleteScene(db, cid, sceneId) {
  try {
    const ids = await listElementIds(cid, sceneId);
    const ops = [
      ...ids.map(id => ({ op: 'delete', path: elementPath(cid, sceneId, id) })),
      { op: 'delete', path: mapDocPath(cid, sceneId) },
    ];
    /* Lotes em série, e o doc da cena no fim: se um lote falhar, o `commitBatch` (strict)
       propaga para o catch abaixo e a cena continua existindo com os elementos restantes —
       melhor que uma cena fantasma sem elementos. */
    for (const chunk of chunkOps(ops)) await commitBatch(chunk);
  } catch (e) { console.error('[mesa] deleteScene falhou:', e); }
}

/* ── Migração lazy v1→v2 (só mestre; idempotente — state.v2 é o marcador) ── */

export async function migrateFirestoreV2(db, cid, uid) {
  const state = await readState(cid);
  if (state && state.v >= 2) return state;

  const legacyDoc = await readLegacyScene(cid);
  const legacy = legacyDoc?.scene && !legacyDoc.migratedTo ? legacyDoc.scene : null;

  const sceneId = legacy ? 's_legacy' : newSceneId();
  const sceneV2 = legacy
    ? { ...migrateSceneV2(legacy), id: sceneId }
    : newScene('Cena 1', sceneId);
  const { elements, ...meta } = sceneV2;

  // Cena + elementos primeiro; state (marcador de conclusão) + tombstone no último batch.
  // `SERVER_TIME` é o marcador do horário do servidor: `serverTimestamp()` é FieldValue do
  // SDK e não atravessa a fronteira da infraestrutura (ADR-0010).
  const ops = [
    { op: 'set', path: mapDocPath(cid, sceneId),
      data: { kind: 'scene', ...clean(meta), updatedAt: SERVER_TIME, updatedBy: uid } },
    ...elements.map(el => ({
      op: 'set', path: elementPath(cid, sceneId, el.id), data: clean(el),
    })),
    { op: 'set', path: mapDocPath(cid, 'state'),
      data: { v: 2, activeSceneId: sceneId, updatedAt: SERVER_TIME, updatedBy: uid } },
  ];
  if (legacy) ops.push({
    op: 'set', path: mapDocPath(cid, 'scene'),
    data: {
      engine: 'scene', migratedTo: sceneId, scene: null,
      updatedAt: SERVER_TIME, updatedBy: uid,
    },
  });
  /* `commitBatch` é strict aqui de propósito: abortar antes do marcador `state` faz a
     migração rodar de novo na próxima abertura, em vez de deixar a mesa meio migrada. */
  for (const chunk of chunkOps(ops)) await commitBatch(chunk);
  return { v: 2, activeSceneId: sceneId };
}
