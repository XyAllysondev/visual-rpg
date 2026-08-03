/* Biblioteca de assets do usuário (spec 0013 / ADR 0006 §4).
 * users/{uid}/assets/{assetId} = { type, name, tags[], folder, data, hash, w, h }.
 *
 * O acesso ao Firestore vive em `infrastructure/firestore/assetsRepo` desde a onda 1.5
 * (spec 0030 / ADR-0010). Aqui ficam as regras do domínio da biblioteca: mapeamento
 * tipo↔camada, filtro, tags e geração de id. */
import * as assetsRepo from '../../../infrastructure/firestore/assetsRepo';

export const ASSET_TYPES = ['map', 'prop', 'mount', 'character', 'attachment', 'note'];
export const ASSET_TYPE_LABEL = {
  map: 'Mapas', prop: 'Props', mount: 'Montarias',
  character: 'Personagens', attachment: 'Anexos', note: 'Notas',
};
export const ASSET_SOFT_CAP = 300;

const TYPE_LAYER = {
  map: 'layer-map', prop: 'layer-prop', mount: 'layer-mount',
  character: 'layer-character', attachment: 'layer-attachment', note: 'layer-note',
};
const LAYER_TYPE = Object.fromEntries(Object.entries(TYPE_LAYER).map(([t, l]) => [l, t]));

export const layerForAssetType = (type) => TYPE_LAYER[type] || 'layer-prop';

/* Tipo de asset ao salvar um elemento da cena na biblioteca. */
export function assetTypeForElement(el) {
  if (el.type === 'note') return 'note';
  return LAYER_TYPE[el.layerId] || (el.type === 'token' ? 'character' : 'prop');
}

/* Elementos criados: mapa/prop/montaria = image; personagem/anexo = token com imagem; nota. */
export const assetPlacesAsToken = (type) => type === 'character' || type === 'attachment';
export const assetPlacesAsNote = (type) => type === 'note';

export function filterAssets(assets, { q = '', tag = null } = {}) {
  const needle = q.trim().toLowerCase();
  return (assets || []).filter(a =>
    (!needle || (a.name || '').toLowerCase().includes(needle)) &&
    (!tag || (a.tags || []).includes(tag)));
}

export function assetTags(assets) {
  const set = new Set();
  (assets || []).forEach(a => (a.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

let _seq = 0;
export const newAssetId = () => `as_${Date.now()}_${(_seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/* ── Persistência (delegada ao repositório) ──────────────────────────────────
   O parâmetro `db` continua na assinatura das três funções, ignorado: `MapEditor/index.jsx`
   e o `App.jsx` chamam `saveAsset(db, uid, …)` em 3 pontos, e eles pertencem a outra onda.
   Some quando os chamadores forem migrados. */

export function subscribeAssets(db, uid, cb) {
  return assetsRepo.watchAll(uid, cb);
}

/* O id é gerado AQUI e não no repo: `newAssetId` é a identidade do asset na biblioteca
   (a doca já o usa antes de qualquer ida à rede), e o repositório é burro por decisão
   do ADR-0010. */
export function saveAsset(db, uid, asset) {
  const id = asset.id || newAssetId();
  return assetsRepo.save(uid, { ...asset, id });
}

export function deleteAsset(db, uid, id) {
  return assetsRepo.remove(uid, id);
}
