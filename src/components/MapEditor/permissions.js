/* Permissões client-side do mapa (spec 0010 / ADR 0006 §6). Espelham as rules —
 * o gate real é o Firestore; aqui é UX (bloquear drag/cursor). Funções puras. */

const perm = (scene, layerId, action) => scene?.permissions?.[layerId]?.[action] ?? false;
const layerOf = (scene, layerId) => (scene?.layers || []).find(l => l.id === layerId);

export function canMove(scene, el, uid, isMaster) {
  if (isMaster) return true;
  if (!el || el.locked || !uid) return false;
  if (layerOf(scene, el.layerId)?.locked) return false;
  const p = perm(scene, el.layerId, 'update');
  if (p === 'all') return true;
  if (p === 'owner') return el.ownerId === uid;
  return false;
}

export function canCreate(scene, layerId, uid, isMaster) {
  if (isMaster) return true;
  if (!uid) return false;
  if (layerOf(scene, layerId)?.locked) return false;
  return perm(scene, layerId, 'create') === true;
}

export function canDelete(scene, el, uid, isMaster) {
  if (isMaster) return true;
  if (!el || el.locked || !uid) return false;
  if (layerOf(scene, el.layerId)?.locked) return false;
  const p = perm(scene, el.layerId, 'delete');
  if (p === 'all') return true;
  if (p === 'owner') return el.ownerId === uid;
  return false;
}

/* Modos por eixo, na ordem em que a UI cicla. `create` é booleano (a doc do Owlbear trata
 * criar como sim/não; não existe "criar só o que é seu"). */
export const UPDATE_MODES = ['none', 'owner', 'all'];
export const DELETE_MODES = ['none', 'owner', 'all'];

export const PERM_LABELS = {
  update: { none: 'só o mestre move', owner: 'dono move o próprio', all: 'todos movem' },
  delete: { none: 'só o mestre apaga', owner: 'dono apaga o próprio', all: 'todos apagam' },
  create: { false: 'só o mestre cria', true: 'jogadores criam' },
};

/** Próximo valor do ciclo de um eixo de permissão da camada. */
export function nextPerm(action, current) {
  if (action === 'create') return !current;
  const modes = action === 'delete' ? DELETE_MODES : UPDATE_MODES;
  const i = modes.indexOf(current);
  return modes[(i < 0 ? 0 : i + 1) % modes.length];
}

/** Camadas em que o jogador pode criar — define quais ferramentas ele recebe. */
export function creatableLayers(scene, uid, isMaster) {
  return (scene?.layers || [])
    .filter(l => canCreate(scene, l.id, uid, isMaster))
    .map(l => l.id);
}
