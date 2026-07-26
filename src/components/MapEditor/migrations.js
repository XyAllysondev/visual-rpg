/* Migração de cenas para o schema v2 (spec 0009 / ADR 0006). Funções puras. */
import { SCHEMA_V, SCHEMA_V2, DEFAULT_LAYERS_V2, defaultGrid, defaultFog, defaultPermissions } from './schema';

/* v1 → v2: layer-objects→Prop, layer-tokens→Personagem; Mapa e Desenho mantêm o id. */
const LAYER_REMAP = { 'layer-objects': 'layer-prop', 'layer-tokens': 'layer-character' };

/* fogCells ["c,r", ...] → shapes rect (op:add) com merge horizontal por linha. */
export function fogCellsToShapes(cells, gridSize) {
  if (!cells || !cells.length) return [];
  const byRow = new Map();
  for (const key of cells) {
    const [c, r] = key.split(',').map(Number);
    if (!byRow.has(r)) byRow.set(r, []);
    byRow.get(r).push(c);
  }
  const shapes = [];
  for (const [r, cols] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    cols.sort((a, b) => a - b);
    let start = cols[0], prev = cols[0];
    // Sem contador mutável capturado pelo closure (era `i++` aqui dentro, e o ESLint
    // reclamava com razão): os ids saem do índice final, depois do laço.
    const flush = (end) => shapes.push({
      op: 'add', type: 'rect',
      x: start * gridSize, y: r * gridSize, w: (end - start + 1) * gridSize, h: gridSize,
    });
    for (let k = 1; k < cols.length; k++) {
      if (cols[k] === prev + 1) { prev = cols[k]; continue; }
      flush(prev); start = prev = cols[k];
    }
    flush(prev);
  }
  return shapes.map((s, k) => ({ ...s, id: `fog_m${k}` }));
}

/* Migra UMA cena (qualquer versão ≤ v2) para v2. Idempotente. */
export function migrateSceneV2(sc) {
  if (sc.schemaV >= SCHEMA_V2) return sc;
  const gridSize = sc.gridSize || 70;

  const layers = DEFAULT_LAYERS_V2.map(def => {
    const legacyId = Object.keys(LAYER_REMAP).find(k => LAYER_REMAP[k] === def.id) || def.id;
    const old = (sc.layers || []).find(l => l.id === def.id || l.id === legacyId);
    return old ? { ...def, visible: old.visible !== false, locked: !!old.locked, opacity: old.opacity ?? 1 } : def;
  });

  const elements = (sc.elements || []).map((el, i) => ({
    ...el,
    layerId: el.type === 'note' ? 'layer-note' : (LAYER_REMAP[el.layerId] || el.layerId || 'layer-prop'),
    ownerId: el.ownerId ?? null,
    parentId: el.parentId ?? null,
    z: el.z ?? i,
    rotation: el.rotation ?? 0,
  }));

  const { fogCells: _f, gridSize: _g, ...rest } = sc;
  return {
    ...rest,
    schemaV: SCHEMA_V2,
    layers, elements,
    grid: sc.grid || { ...defaultGrid(), size: gridSize },
    fog: sc.fog?.v === 2 ? sc.fog : { ...defaultFog(), shapes: fogCellsToShapes(sc.fogCells, gridSize) },
    permissions: sc.permissions || defaultPermissions(),
    bgSize: sc.bgSize || { w: 3000, h: 2000 },
  };
}

/* v2 → v3: o grid ganha `offset` (alinhamento com a grade da imagem) e `scale.digits`
 * (precisão), e o `measurement` legado vira 'chessboard'.
 *
 * Por que reescrever o `measurement`: até aqui o campo era CONFIG MORTA — o grid.js era um
 * módulo órfão e o index.jsx media sempre por Math.hypot, então o 'euclidean' que a v2
 * gravava nunca foi lido nem escolhido por ninguém. Trocar por 'chessboard' (padrão D&D 5e
 * e do Owlbear) corrige um default, não sobrescreve decisão de usuário. Depois desta
 * migração o campo é editável na UI e o guard de schemaV impede que uma escolha real seja
 * revertida numa segunda passada. Idempotente. */
export function migrateSceneV3(sc) {
  if (sc.schemaV >= SCHEMA_V) return sc;
  const d = defaultGrid();
  const g = sc.grid || d;
  const scale = g.scale || d.scale;
  const legacyMeasurement = !g.measurement || g.measurement === 'euclidean';
  return {
    ...sc,
    schemaV: SCHEMA_V,
    grid: {
      ...d,
      ...g,
      offset: { x: Number(g.offset?.x) || 0, y: Number(g.offset?.y) || 0 },
      measurement: legacyMeasurement ? d.measurement : g.measurement,
      scale: {
        value: Number(scale.value) > 0 ? Number(scale.value) : d.scale.value,
        unit: scale.unit || d.scale.unit,
        digits: Number.isFinite(Number(scale.digits)) ? Number(scale.digits) : d.scale.digits,
      },
    },
  };
}
