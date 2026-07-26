import {
  DEFAULT_CELL, cellSize, gridType, isHex, gridOffset, gridScale,
  measurementMode, measurementsFor, hexRadius, hexDistance,
  worldToCell, cellCenter, snapPoint, cellRect,
  measureCells, measure,
  cellSizeFromColumns, cellSizeFromRows, cellsAcross,
  parseGridFromFilename, parseScale, formatScale, gridPattern,
} from '../grid';

const sq = (over = {}) => ({ bgSize: { w: 1400, h: 700 }, grid: { type: 'square', size: 70, ...over } });
const hexV = (over = {}) => ({ grid: { type: 'hexVertical', size: 70, ...over } });
const hexH = (over = {}) => ({ grid: { type: 'hexHorizontal', size: 70, ...over } });

describe('leitura defensiva da cena', () => {
  it('cai no default quando size é ausente, zero, negativo ou não-numérico', () => {
    expect(cellSize(undefined)).toBe(DEFAULT_CELL);
    expect(cellSize({})).toBe(DEFAULT_CELL);
    expect(cellSize({ grid: { size: 0 } })).toBe(DEFAULT_CELL);
    expect(cellSize({ grid: { size: -5 } })).toBe(DEFAULT_CELL);
    expect(cellSize({ grid: { size: 'abc' } })).toBe(DEFAULT_CELL);
    expect(cellSize(sq())).toBe(70);
  });

  it('tipo inválido cai em square', () => {
    expect(gridType({ grid: { type: 'triangular' } })).toBe('square');
    expect(gridType(undefined)).toBe('square');
    expect(gridType(hexV())).toBe('hexVertical');
    expect(isHex(sq())).toBe(false);
    expect(isHex(hexH())).toBe(true);
  });

  it('normaliza o offset para dentro de uma célula, inclusive negativo', () => {
    expect(gridOffset(sq({ offset: { x: 10, y: 20 } }))).toEqual({ x: 10, y: 20 });
    // 80 = uma célula (70) + 10 → equivalente a 10
    expect(gridOffset(sq({ offset: { x: 80, y: 150 } }))).toEqual({ x: 10, y: 10 });
    // negativo entra pela direita: -10 ≡ 60
    expect(gridOffset(sq({ offset: { x: -10, y: -70 } }))).toEqual({ x: 60, y: 0 });
    expect(gridOffset(sq())).toEqual({ x: 0, y: 0 });
  });

  it('gridScale preenche value/unit/digits e rejeita lixo', () => {
    expect(gridScale(sq())).toEqual({ value: 1.5, unit: 'm', digits: 1 });
    expect(gridScale(sq({ scale: { value: 5, unit: 'ft', digits: 0 } })))
      .toEqual({ value: 5, unit: 'ft', digits: 0 });
    expect(gridScale(sq({ scale: { value: -1, unit: '', digits: 99 } })))
      .toEqual({ value: 1.5, unit: 'm', digits: 1 });
  });
});

describe('modo de medição coerente com o tipo de grid', () => {
  it('quadrado recusa "hex" e cai no padrão chessboard', () => {
    expect(measurementMode(sq({ measurement: 'hex' }))).toBe('chessboard');
    expect(measurementMode(sq())).toBe('chessboard');
    expect(measurementMode(sq({ measurement: 'manhattan' }))).toBe('manhattan');
  });

  it('hex recusa "chessboard" e cai no padrão hex', () => {
    expect(measurementMode(hexV({ measurement: 'chessboard' }))).toBe('hex');
    expect(measurementMode(hexV({ measurement: 'euclidean' }))).toBe('euclidean');
    expect(measurementMode(hexH())).toBe('hex');
  });

  it('expõe a lista permitida por tipo', () => {
    expect(measurementsFor('square')).toContain('alternating');
    expect(measurementsFor('square')).not.toContain('hex');
    expect(measurementsFor('hexVertical')).toEqual(['hex', 'euclidean']);
  });
});

describe('célula ↔ mundo no grid quadrado', () => {
  it('worldToCell respeita o offset', () => {
    expect(worldToCell(sq(), 0, 0)).toEqual({ c: 0, r: 0 });
    expect(worldToCell(sq(), 69.9, 0)).toEqual({ c: 0, r: 0 });
    expect(worldToCell(sq(), 70, 0)).toEqual({ c: 1, r: 0 });
    expect(worldToCell(sq(), -1, 0)).toEqual({ c: -1, r: 0 });
    // com offset 10, a célula 0 vai de 10 a 80
    expect(worldToCell(sq({ offset: { x: 10, y: 0 } }), 9, 0)).toEqual({ c: -1, r: 0 });
    expect(worldToCell(sq({ offset: { x: 10, y: 0 } }), 11, 0)).toEqual({ c: 0, r: 0 });
  });

  it('cellCenter devolve o centro e é idempotente', () => {
    expect(cellCenter(sq(), 5, 5)).toEqual({ x: 35, y: 35 });
    expect(cellCenter(sq(), 71, 5)).toEqual({ x: 105, y: 35 });
    const c = cellCenter(sq({ offset: { x: 10, y: 20 } }), 5, 5);
    expect(c).toEqual({ x: -25, y: -15 });
    expect(cellCenter(sq({ offset: { x: 10, y: 20 } }), c.x, c.y)).toEqual(c);
  });

  it('snapPoint gruda na interseção mais próxima, deslocada pelo offset', () => {
    expect(snapPoint(sq(), 34, 34)).toEqual({ x: 0, y: 0 });
    expect(snapPoint(sq(), 36, 36)).toEqual({ x: 70, y: 70 });
    expect(snapPoint(sq({ offset: { x: 10, y: 10 } }), 12, 12)).toEqual({ x: 10, y: 10 });
    expect(snapPoint(sq({ offset: { x: 10, y: 10 } }), 60, 60)).toEqual({ x: 80, y: 80 });
  });

  it('cellRect posiciona a célula com o offset', () => {
    expect(cellRect(sq(), 0, 0)).toEqual({ x: 0, y: 0, w: 70, h: 70 });
    expect(cellRect(sq(), 2, 1)).toEqual({ x: 140, y: 70, w: 70, h: 70 });
    expect(cellRect(sq({ offset: { x: 5, y: 5 } }), 1, 1)).toEqual({ x: 75, y: 75, w: 70, h: 70 });
  });
});

describe('geometria hex', () => {
  it('R = g/sqrt(3)', () => {
    expect(hexRadius(70)).toBeCloseTo(70 / Math.sqrt(3), 6);
  });

  it('distância de cubo em coordenadas axiais', () => {
    const o = { q: 0, r: 0 };
    expect(hexDistance(o, { q: 0, r: 0 })).toBe(0);
    expect(hexDistance(o, { q: 1, r: 0 })).toBe(1);
    expect(hexDistance(o, { q: 0, r: 1 })).toBe(1);
    expect(hexDistance(o, { q: 1, r: -1 })).toBe(1);   // vizinho pelo eixo s
    expect(hexDistance(o, { q: 1, r: 1 })).toBe(2);    // NÃO é vizinho em axial
    expect(hexDistance(o, { q: 3, r: 0 })).toBe(3);
    expect(hexDistance({ q: 2, r: -1 }, { q: -1, r: 1 })).toBe(3);
  });

  it('pointy-top: centros nos lugares esperados e round-trip estável', () => {
    const s = hexV();
    const R = hexRadius(70);
    expect(cellCenter(s, 0.5, 0.5).x).toBeCloseTo(0, 6);
    expect(cellCenter(s, 0.5, 0.5).y).toBeCloseTo(0, 6);
    // vizinho à direita fica a g; a linha de baixo fica meio passo à direita e 1.5R abaixo
    const right = cellCenter(s, 70, 0);
    expect(right.x).toBeCloseTo(70, 6);
    expect(right.y).toBeCloseTo(0, 6);
    const below = cellCenter(s, 35, 1.5 * R);
    expect(below.x).toBeCloseTo(35, 6);
    expect(below.y).toBeCloseTo(1.5 * R, 6);
    // idempotência: o centro de um centro é ele mesmo
    const c = cellCenter(s, 123, 456);
    const again = cellCenter(s, c.x, c.y);
    expect(again.x).toBeCloseTo(c.x, 6);
    expect(again.y).toBeCloseTo(c.y, 6);
  });

  it('flat-top: eixos trocados em relação ao pointy-top', () => {
    const s = hexH();
    const R = hexRadius(70);
    const down = cellCenter(s, 0, 70);
    expect(down.x).toBeCloseTo(0, 6);
    expect(down.y).toBeCloseTo(70, 6);
    const side = cellCenter(s, 1.5 * R, 35);
    expect(side.x).toBeCloseTo(1.5 * R, 6);
    expect(side.y).toBeCloseTo(35, 6);
  });

  it('snapPoint em hex cai no centro da célula (não existe interseção retangular)', () => {
    const s = hexV();
    expect(snapPoint(s, 3, 3)).toEqual(cellCenter(s, 3, 3));
  });

  it('células vizinhas distintas não colapsam no mesmo centro', () => {
    const s = hexV();
    const a = cellCenter(s, 0, 0);
    const b = cellCenter(s, 70, 0);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(70, 6);
  });
});

describe('medição por modo', () => {
  // pontos no centro das células (c, r)
  const p = (c, r) => ({ x: c * 70 + 35, y: r * 70 + 35 });

  it('chessboard conta o maior eixo (D&D 5e)', () => {
    const s = sq({ measurement: 'chessboard' });
    expect(measureCells(s, p(0, 0), p(3, 0))).toBe(3);
    expect(measureCells(s, p(0, 0), p(3, 3))).toBe(3);
    expect(measureCells(s, p(0, 0), p(1, 3))).toBe(3);
  });

  it('manhattan soma os eixos', () => {
    const s = sq({ measurement: 'manhattan' });
    expect(measureCells(s, p(0, 0), p(3, 0))).toBe(3);
    expect(measureCells(s, p(0, 0), p(3, 3))).toBe(6);
  });

  it('alternating cobra 2 a cada segunda diagonal (D&D 3.5)', () => {
    const s = sq({ measurement: 'alternating' });
    expect(measureCells(s, p(0, 0), p(1, 1))).toBe(1); // 1ª diagonal = 1
    expect(measureCells(s, p(0, 0), p(2, 2))).toBe(3); // 2ª diagonal = 2 → 1+2
    expect(measureCells(s, p(0, 0), p(3, 3))).toBe(4);
    expect(measureCells(s, p(0, 0), p(4, 4))).toBe(6);
    expect(measureCells(s, p(0, 0), p(4, 0))).toBe(4); // reto não muda
    expect(measureCells(s, p(0, 0), p(4, 1))).toBe(4); // 3 retos + 1 diagonal
  });

  it('euclidean é contínuo e ignora a grade', () => {
    const s = sq({ measurement: 'euclidean' });
    expect(measureCells(s, { x: 0, y: 0 }, { x: 70, y: 0 })).toBeCloseTo(1, 6);
    expect(measureCells(s, { x: 0, y: 0 }, { x: 35, y: 0 })).toBeCloseTo(0.5, 6);
    expect(measureCells(s, { x: 0, y: 0 }, { x: 70, y: 70 })).toBeCloseTo(Math.SQRT2, 6);
  });

  it('hex conta hexágonos percorridos', () => {
    const s = hexV({ measurement: 'hex' });
    const a = cellCenter(s, 0, 0);
    const b = cellCenter(s, 140, 0); // dois passos à direita
    expect(measureCells(s, a, b)).toBe(2);
    expect(measureCells(s, a, a)).toBe(0);
  });

  it('measure aplica escala, unidade e precisão', () => {
    const s = sq({ measurement: 'chessboard', scale: { value: 1.5, unit: 'm', digits: 1 } });
    expect(measure(s, p(0, 0), p(2, 0))).toEqual({ cells: 2, dist: 3, unit: 'm', mode: 'chessboard' });

    const ft = sq({ measurement: 'chessboard', scale: { value: 5, unit: 'ft', digits: 0 } });
    expect(measure(ft, p(0, 0), p(3, 0))).toEqual({ cells: 3, dist: 15, unit: 'ft', mode: 'chessboard' });

    // euclidiana produz fração → respeita os dígitos configurados
    const mi = sq({ measurement: 'euclidean', scale: { value: 5, unit: 'mi', digits: 2 } });
    const out = measure(mi, { x: 0, y: 0 }, { x: 70, y: 70 });
    expect(out.cells).toBeCloseTo(1.41, 2);
    expect(out.dist).toBeCloseTo(7.07, 2);
    expect(out.unit).toBe('mi');
  });
});

describe('alinhamento', () => {
  it('colunas informadas definem o tamanho da célula', () => {
    expect(cellSizeFromColumns({ w: 1400, h: 700 }, 20)).toEqual({ size: 70, impliedRows: 10 });
    expect(cellSizeFromColumns({ w: 1400 }, 0)).toBeNull();
    expect(cellSizeFromColumns({ w: 1400 }, -3)).toBeNull();
    expect(cellSizeFromColumns(null, 20)).toBeNull();
  });

  it('linhas informadas definem o tamanho da célula', () => {
    expect(cellSizeFromRows({ w: 1400, h: 700 }, 10)).toEqual({ size: 70, impliedColumns: 20 });
    expect(cellSizeFromRows({ h: 700 }, 0)).toBeNull();
  });

  it('cellsAcross descreve a grade atual sobre a cena', () => {
    expect(cellsAcross(sq())).toEqual({ columns: 20, rows: 10 });
    expect(cellsAcross({ grid: { size: 70 } })).toEqual({ columns: null, rows: null });
  });

  it('lê as dimensões do grid no nome do arquivo', () => {
    expect(parseGridFromFilename('mapa_49x28.jpg')).toEqual({ columns: 49, rows: 28 });
    expect(parseGridFromFilename('40x22.png')).toEqual({ columns: 40, rows: 22 });
    expect(parseGridFromFilename('taverna 30 x 20.webp')).toEqual({ columns: 30, rows: 20 });
    expect(parseGridFromFilename('cripta_12×8.jpg')).toEqual({ columns: 12, rows: 8 });
  });

  it('não confunde resolução com grade', () => {
    expect(parseGridFromFilename('mapa_1920x1080.jpg')).toBeNull();
    expect(parseGridFromFilename('render_4096x4096.png')).toBeNull();
    expect(parseGridFromFilename('sem_numeros.jpg')).toBeNull();
    expect(parseGridFromFilename(null)).toBeNull();
    expect(parseGridFromFilename('1x1.png')).toBeNull(); // grade de 1 célula não faz sentido
  });

  it('quando há resolução E grade, a grade do fim do nome ganha', () => {
    expect(parseGridFromFilename('mapa_1920x1080_40x22.jpg')).toEqual({ columns: 40, rows: 22 });
  });
});

describe('escala digitada', () => {
  it('extrai valor, unidade e precisão', () => {
    expect(parseScale('5ft')).toEqual({ value: 5, unit: 'ft', digits: 0 });
    expect(parseScale('1.5m')).toEqual({ value: 1.5, unit: 'm', digits: 1 });
    expect(parseScale('1,5 m')).toEqual({ value: 1.5, unit: 'm', digits: 1 });
    expect(parseScale('5.00mi')).toEqual({ value: 5, unit: 'mi', digits: 2 });
    expect(parseScale('  10 km ')).toEqual({ value: 10, unit: 'km', digits: 0 });
    expect(parseScale('3')).toEqual({ value: 3, unit: 'm', digits: 0 });
  });

  it('rejeita entrada inválida', () => {
    expect(parseScale('')).toBeNull();
    expect(parseScale('abc')).toBeNull();
    expect(parseScale('0m')).toBeNull();
    expect(parseScale('-5m')).toBeNull();
    expect(parseScale(null)).toBeNull();
  });

  it('formatScale espelha o parse', () => {
    expect(formatScale({ value: 5, unit: 'mi', digits: 2 })).toBe('5.00mi');
    expect(formatScale({ value: 1.5, unit: 'm', digits: 1 })).toBe('1.5m');
    expect(formatScale(parseScale('5ft'))).toBe('5ft');
  });
});

describe('tile do pattern de render', () => {
  it('quadrado é o L clássico do tamanho da célula', () => {
    const p = gridPattern('square', 70);
    expect(p.w).toBe(70);
    expect(p.h).toBe(70);
    expect(p.d).toBe('M 70 0 L 0 0 0 70');
  });

  it('pointy-top: tile de g por 3R', () => {
    const p = gridPattern('hexVertical', 70);
    expect(p.w).toBeCloseTo(70, 6);
    expect(p.h).toBeCloseTo(3 * hexRadius(70), 6);
    expect((p.d.match(/M /g) || []).length).toBe(5); // 5 hexágonos por tile
  });

  it('flat-top: tile de 3R por g', () => {
    const p = gridPattern('hexHorizontal', 70);
    expect(p.w).toBeCloseTo(3 * hexRadius(70), 6);
    expect(p.h).toBeCloseTo(70, 6);
    expect((p.d.match(/M /g) || []).length).toBe(5);
  });

  it('tipo desconhecido cai no tile quadrado', () => {
    expect(gridPattern('triangular', 50).d).toBe('M 50 0 L 0 0 0 50');
  });
});
