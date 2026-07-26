import { migrateSceneV2, migrateSceneV3, fogCellsToShapes } from '../migrations';
import { SCHEMA_V, SCHEMA_V2, DEFAULT_LAYERS_V2 } from '../schema';

const legacyScene = {
  id: 's1', name: 'Cena 1',
  layers: [
    { id: 'layer-map', name: 'Mapa', type: 'map', visible: true, locked: true, opacity: 1 },
    { id: 'layer-tokens', name: 'Tokens', type: 'tokens', visible: false, locked: true, opacity: 0.5 },
    { id: 'layer-objects', name: 'Objetos', type: 'objects', visible: true, locked: false, opacity: 1 },
    { id: 'layer-drawing', name: 'Desenho', type: 'drawing', visible: true, locked: false, opacity: 1 },
  ],
  elements: [
    { id: 'e1', type: 'token', layerId: 'layer-tokens', x: 70, y: 70, color: '#f00', label: 'A' },
    { id: 'e2', type: 'image', layerId: 'layer-map', x: 0, y: 0, w: 100, h: 100, rotation: 45 },
    { id: 'e3', type: 'note', layerId: 'layer-objects', x: 10, y: 10, text: 'oi' },
    { id: 'e4', type: 'drawing', layerId: 'layer-drawing', x: 0, y: 0, points: [] },
  ],
  fogCells: ['2,1', '3,1', '5,1', '2,2'],
  gridSize: 70,
  bgSize: { w: 3000, h: 2000 },
};

describe('fogCellsToShapes', () => {
  it('mescla células contíguas por linha e separa gaps', () => {
    const shapes = fogCellsToShapes(['2,1', '3,1', '5,1', '2,2'], 70);
    expect(shapes).toHaveLength(3);
    expect(shapes[0]).toMatchObject({ op: 'add', type: 'rect', x: 140, y: 70, w: 140, h: 70 });
    expect(shapes[1]).toMatchObject({ x: 350, y: 70, w: 70, h: 70 });
    expect(shapes[2]).toMatchObject({ x: 140, y: 140, w: 70, h: 70 });
  });
  it('vazio → []', () => {
    expect(fogCellsToShapes([], 70)).toEqual([]);
    expect(fogCellsToShapes(undefined, 70)).toEqual([]);
  });
});

describe('migrateSceneV2', () => {
  const v2 = migrateSceneV2(legacyScene);

  it('remapeia camadas 4→7 preservando estado', () => {
    expect(v2.layers.map(l => l.id)).toEqual(DEFAULT_LAYERS_V2.map(l => l.id));
    const chars = v2.layers.find(l => l.id === 'layer-character');
    expect(chars).toMatchObject({ visible: false, locked: true, opacity: 0.5 }); // veio de layer-tokens
  });

  it('remapeia elementos e injeta ownerId/parentId/z/rotation', () => {
    const byId = Object.fromEntries(v2.elements.map(e => [e.id, e]));
    expect(byId.e1.layerId).toBe('layer-character');
    expect(byId.e3.layerId).toBe('layer-note');
    expect(byId.e4.layerId).toBe('layer-drawing');
    expect(byId.e1).toMatchObject({ ownerId: null, parentId: null, z: 0, rotation: 0 });
    expect(byId.e2.rotation).toBe(45); // preservada
    expect(v2.elements.map(e => e.z)).toEqual([0, 1, 2, 3]);
  });

  it('converte fog e grid e remove campos v1', () => {
    expect(v2.fog.v).toBe(2);
    expect(v2.fog.shapes).toHaveLength(3);
    expect(v2.grid).toMatchObject({ type: 'square', size: 70, measurement: 'chessboard' });
    expect(v2.fogCells).toBeUndefined();
    expect(v2.gridSize).toBeUndefined();
    expect(v2.schemaV).toBe(SCHEMA_V2); // a v2 para no seu degrau; a v3 é outra função
    expect(v2.permissions['layer-character']).toEqual({ update: 'owner' });
  });

  it('é idempotente (v2 entra, v2 idêntica sai)', () => {
    expect(migrateSceneV2(v2)).toBe(v2);
  });
});

describe('migrateSceneV3', () => {
  /* Cena como a v2 gravava: measurement morto em 'euclidean', sem offset, escala sem digits. */
  const v2Scene = {
    id: 's1', schemaV: 2, elements: [], layers: DEFAULT_LAYERS_V2,
    grid: { type: 'square', size: 70, color: 'rgba(255,255,255,0.32)', opacity: 1, lineWidth: 1, measurement: 'euclidean', scale: { value: 1.5, unit: 'm' } },
    bgSize: { w: 3000, h: 2000 },
  };

  it('injeta offset e precisão de escala sem mexer no resto do grid', () => {
    const v3 = migrateSceneV3(v2Scene);
    expect(v3.schemaV).toBe(SCHEMA_V);
    expect(v3.grid.offset).toEqual({ x: 0, y: 0 });
    expect(v3.grid.scale).toEqual({ value: 1.5, unit: 'm', digits: 1 });
    expect(v3.grid).toMatchObject({ type: 'square', size: 70, lineWidth: 1, opacity: 1 });
  });

  it("troca o 'euclidean' morto da v2 por 'chessboard'", () => {
    expect(migrateSceneV3(v2Scene).grid.measurement).toBe('chessboard');
  });

  it('preserva escolha real de medição (qualquer valor que não seja o default morto)', () => {
    const escolhido = { ...v2Scene, grid: { ...v2Scene.grid, measurement: 'manhattan' } };
    expect(migrateSceneV3(escolhido).grid.measurement).toBe('manhattan');
  });

  it('preserva size, escala e unidade customizados', () => {
    const custom = { ...v2Scene, grid: { ...v2Scene.grid, size: 100, scale: { value: 5, unit: 'ft' } } };
    const v3 = migrateSceneV3(custom);
    expect(v3.grid.size).toBe(100);
    expect(v3.grid.scale).toEqual({ value: 5, unit: 'ft', digits: 1 });
  });

  it('cena sem grid nenhum ganha o grid default completo', () => {
    const v3 = migrateSceneV3({ id: 's2', schemaV: 2, elements: [], layers: DEFAULT_LAYERS_V2 });
    expect(v3.grid).toMatchObject({ type: 'square', size: 70, measurement: 'chessboard' });
    expect(v3.grid.offset).toEqual({ x: 0, y: 0 });
  });

  it('é idempotente — segunda passada não reverte escolha do usuário', () => {
    const v3 = migrateSceneV3(v2Scene);
    expect(migrateSceneV3(v3)).toBe(v3);
    // usuário escolhe euclidiana DEPOIS de migrar: o guard de schemaV protege
    const escolheuEuclidiana = { ...v3, grid: { ...v3.grid, measurement: 'euclidean' } };
    expect(migrateSceneV3(escolheuEuclidiana).grid.measurement).toBe('euclidean');
  });

  it('offset inválido ou ausente não virá NaN', () => {
    const sujo = { ...v2Scene, grid: { ...v2Scene.grid, offset: { x: 'abc', y: null } } };
    expect(migrateSceneV3(sujo).grid.offset).toEqual({ x: 0, y: 0 });
  });
});
