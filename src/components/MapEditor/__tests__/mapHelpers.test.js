import { layerZIndex, collectOrphanImageIds, gridZIndex, fogZIndex, overlayZIndex } from '../mapHelpers';
import { cellCenter } from '../grid';

/* O snap ao centro (AC-9 da spec 0019) migrou de `mapHelpers.cellCenterSnap` para
 * `grid.cellCenter`, que é offset-aware e suporta hex. O AC continua coberto aqui para
 * manter a rastreabilidade, e o grid.test.js cobre offset/hex em profundidade. */
describe('snap ao centro da célula (AC-9, agora via grid.js)', () => {
  const sc = { grid: { type: 'square', size: 70 } };

  it('gruda no CENTRO da célula, não na interseção da grade', () => {
    // gs=70 → centros em 35, 105, 175… (nunca em múltiplos de 70)
    expect(cellCenter(sc, 10, 10)).toEqual({ x: 35, y: 35 });
    expect(cellCenter(sc, 69, 1)).toEqual({ x: 35, y: 35 });
    expect(cellCenter(sc, 71, 71)).toEqual({ x: 105, y: 105 });
  });
  it('é idempotente sobre um centro de célula', () => {
    const c = cellCenter(sc, 200, 200);
    expect(cellCenter(sc, c.x, c.y)).toEqual(c);
  });
  it('tolera gridSize inválido (fallback 70)', () => {
    expect(cellCenter({ grid: { size: 0 } }, 10, 10)).toEqual({ x: 35, y: 35 });
  });
});

describe('layerZIndex (AC-3)', () => {
  it('a ordem da camada domina o z do elemento', () => {
    // qualquer elemento de uma camada acima fica sobre qualquer um da camada abaixo
    expect(layerZIndex(1, -49999)).toBeGreaterThan(layerZIndex(0, 49999));
  });
  it('dentro da mesma camada, maior z fica na frente', () => {
    expect(layerZIndex(2, 5)).toBeGreaterThan(layerZIndex(2, 4));
  });
  it('z é clampado para não invadir a camada vizinha', () => {
    expect(layerZIndex(0, 1e9)).toBeLessThan(layerZIndex(1, -1e9));
  });
  it('tolera entradas inválidas', () => {
    expect(layerZIndex(NaN, NaN)).toBe(50000);
  });
});

describe('collectOrphanImageIds (AC-11)', () => {
  const scenes = [
    { id: 's1', elements: [{ id: 'e1', imageId: 'img_a' }, { id: 'e2', type: 'token' }] },
    { id: 's2', elements: [{ id: 'e3', imageId: 'img_b' }] },
  ];
  it('lista só os ids não referenciados por nenhum elemento', () => {
    const store = { img_a: 'x', img_b: 'y', img_orphan: 'z' };
    expect(collectOrphanImageIds(scenes, store)).toEqual(['img_orphan']);
  });
  it('preserva fundo legado chaveado pelo id da cena', () => {
    const store = { s1: 'bg', img_a: 'x', img_b: 'y' };
    expect(collectOrphanImageIds(scenes, store)).toEqual([]);
  });
  it('retorna vazio quando tudo é usado ou store vazio', () => {
    expect(collectOrphanImageIds(scenes, {})).toEqual([]);
    expect(collectOrphanImageIds([], { a: 1 })).toEqual(['a']);
  });
});

/* Ordem da pilha de render. Isto existe porque grade e névoa estavam com z-index FIXO (6 e
 * 200) enquanto os elementos usam layerZIndex (~100k a ~700k): a névoa ficava abaixo de todo
 * token e um inimigo em sala coberta aparecia para o jogador. O teste trava a ordem. */
describe('pilha de render (grade / névoa / overlays)', () => {
  const LAYERS = 7; // DEFAULT_LAYERS_V2
  const MAP = 0, DRAWING = 1, TOP = LAYERS - 1;
  const maxOf = idx => layerZIndex(idx, 49999);
  const minOf = idx => layerZIndex(idx, -49999);

  it('a grade fica ACIMA da camada Mapa (senão a imagem do mapa cobre a grade)', () => {
    expect(gridZIndex()).toBeGreaterThan(maxOf(MAP));
  });

  it('e ABAIXO da camada Desenho (o desenho é o marcador sobre a mesa)', () => {
    expect(gridZIndex()).toBeLessThan(minOf(DRAWING));
  });

  it('a névoa fica acima de TODAS as camadas — inclusive tokens', () => {
    expect(fogZIndex(LAYERS)).toBeGreaterThan(maxOf(TOP));
    for (let i = 0; i < LAYERS; i++) {
      expect(fogZIndex(LAYERS)).toBeGreaterThan(maxOf(i));
    }
  });

  it('régua, pings e editor de texto ficam acima da névoa', () => {
    expect(overlayZIndex(LAYERS)).toBeGreaterThan(fogZIndex(LAYERS));
  });

  it('a névoa acompanha o número de camadas (camada nova não passa por cima dela)', () => {
    const oito = 8;
    expect(fogZIndex(oito)).toBeGreaterThan(maxOf(oito - 1));
  });

  it('layerCount inválido não colapsa a névoa para dentro dos elementos', () => {
    expect(fogZIndex(0)).toBeGreaterThan(maxOf(0));
    expect(fogZIndex(undefined)).toBeGreaterThan(maxOf(0));
    expect(fogZIndex(NaN)).toBeGreaterThan(maxOf(0));
  });
});
