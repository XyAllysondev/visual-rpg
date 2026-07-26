/* Math de grid — FONTE ÚNICA da verdade para célula, offset, snap, alinhamento e medição.
 *
 * Antes desta spec este módulo era ÓRFÃO: ninguém o importava e o index.jsx duplicava a
 * matemática inline (gridSize, snap, medição por Math.hypot), o que deixava `grid.type`,
 * `grid.offset`, `grid.measurement`, `grid.color`, `grid.opacity` e `grid.lineWidth` como
 * config morta. Tudo que mexe com grid passa a entrar por aqui.
 *
 * Tipos de grid (paridade Owlbear):
 *   'square'         — células quadradas
 *   'hexVertical'    — hex de ponta pra cima (pointy-top), colunas escalonadas
 *   'hexHorizontal'  — hex de topo plano (flat-top), linhas escalonadas
 *
 * Modos de medição (doc oficial /docs/measure):
 *   quadrado → 'chessboard' (Chebyshev, padrão D&D 5e), 'alternating' (5-10-5, D&D 3.5),
 *              'euclidean', 'manhattan'
 *   hex      → 'hex' (distância em hexes), 'euclidean'
 *
 * Convenção de `size` (g): distância entre CENTROS de células vizinhas no eixo denso —
 * lado do quadrado no grid quadrado, largura do hex no pointy-top, altura no flat-top.
 * Assim um token de "1 célula" tem tamanho g nos três tipos.
 */

export const DEFAULT_CELL = 70;

export const GRID_TYPES = ['square', 'hexVertical', 'hexHorizontal'];
export const SQUARE_MEASUREMENTS = ['chessboard', 'alternating', 'euclidean', 'manhattan'];
export const HEX_MEASUREMENTS = ['hex', 'euclidean'];

export const MEASUREMENT_LABELS = {
  chessboard:  'Xadrez (D&D 5e)',
  alternating: 'Diagonal alternada (D&D 3.5)',
  euclidean:   'Euclidiana',
  manhattan:   'Manhattan',
  hex:         'Hexágonos',
};

export const GRID_TYPE_LABELS = {
  square:        'Quadrado',
  hexVertical:   'Hex (ponta em cima)',
  hexHorizontal: 'Hex (topo plano)',
};

/* ---------- leitura defensiva da cena ---------- */

export function cellSize(scene) {
  const s = Number(scene?.grid?.size);
  return Number.isFinite(s) && s > 0 ? s : DEFAULT_CELL;
}

export function gridType(scene) {
  const t = scene?.grid?.type;
  return GRID_TYPES.includes(t) ? t : 'square';
}

export const isHex = (scene) => gridType(scene) !== 'square';

/* Offset de alinhamento: desloca a origem do grid para casar com a grade desenhada na
 * imagem do mapa. Normalizado para [0, g) — offsets maiores que uma célula são
 * equivalentes a offsets dentro da primeira. */
export function gridOffset(scene) {
  const g = cellSize(scene);
  const o = scene?.grid?.offset;
  const norm = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || g <= 0) return 0;
    return ((n % g) + g) % g;
  };
  return { x: norm(o?.x), y: norm(o?.y) };
}

/* Escala de medição: quanto vale 1 célula no mundo do jogo. `digits` controla a precisão
 * exibida (Owlbear deriva do jeito que você digita: "5.00mi" → 2 casas). */
export function gridScale(scene) {
  const sc = scene?.grid?.scale;
  const v = Number(sc?.value);
  const d = Number(sc?.digits);
  return {
    value: Number.isFinite(v) && v > 0 ? v : 1.5,
    unit: typeof sc?.unit === 'string' && sc.unit ? sc.unit : 'm',
    digits: Number.isFinite(d) && d >= 0 && d <= 4 ? Math.round(d) : 1,
  };
}

/* Modo de medição válido PARA O TIPO de grid atual. Um grid hex não aceita 'chessboard';
 * um quadrado não aceita 'hex'. Valor inválido cai no padrão do tipo. */
export function measurementMode(scene) {
  const allowed = isHex(scene) ? HEX_MEASUREMENTS : SQUARE_MEASUREMENTS;
  const m = scene?.grid?.measurement;
  if (allowed.includes(m)) return m;
  return isHex(scene) ? 'hex' : 'chessboard';
}

export const measurementsFor = (type) =>
  type === 'square' ? SQUARE_MEASUREMENTS : HEX_MEASUREMENTS;

/* ---------- geometria hex ---------- */

/* Circunraio a partir de `size`. Em pointy-top a largura do hex é sqrt(3)·R; em flat-top
 * é a altura que vale sqrt(3)·R. Nos dois casos R = g/sqrt(3). */
const SQRT3 = Math.sqrt(3);
export const hexRadius = (g) => g / SQRT3;

/* Mundo → coordenada axial fracionária (Red Blob Games). */
function worldToAxialFrac(type, x, y, R) {
  if (type === 'hexHorizontal') { // flat-top
    return { q: (2 / 3) * x / R, r: (-x / 3 + (SQRT3 / 3) * y) / R };
  }
  // pointy-top
  return { q: ((SQRT3 / 3) * x - y / 3) / R, r: (2 / 3) * y / R };
}

/* Arredondamento axial via cubo — o ingênuo (Math.round em q e r) erra nas bordas. */
function axialRound(qf, rf) {
  const sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

function axialToWorld(type, q, r, R) {
  if (type === 'hexHorizontal') {
    return { x: R * 1.5 * q, y: R * SQRT3 * (r + q / 2) };
  }
  return { x: R * SQRT3 * (q + r / 2), y: R * 1.5 * r };
}

/* Distância em hexes entre duas axiais (distância de cubo). */
export function hexDistance(a, b) {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/* ---------- célula ↔ mundo ---------- */

/* Índice da célula que contém o ponto. Quadrado → {c, r}; hex → {q, r}. */
export function worldToCell(scene, x, y) {
  const g = cellSize(scene), o = gridOffset(scene), t = gridType(scene);
  const px = x - o.x, py = y - o.y;
  if (t === 'square') return { c: Math.floor(px / g), r: Math.floor(py / g) };
  const f = worldToAxialFrac(t, px, py, hexRadius(g));
  return axialRound(f.q, f.r);
}

/* Centro da célula, em coordenadas de mundo. */
export function cellCenter(scene, x, y) {
  const g = cellSize(scene), o = gridOffset(scene), t = gridType(scene);
  if (t === 'square') {
    const cell = worldToCell(scene, x, y);
    return { x: cell.c * g + g / 2 + o.x, y: cell.r * g + g / 2 + o.y };
  }
  const { q, r } = worldToCell(scene, x, y);
  const w = axialToWorld(t, q, r, hexRadius(g));
  return { x: w.x + o.x, y: w.y + o.y };
}

/* Snap "de vértice": interseções da grade no quadrado; nos hex não existe grade retangular,
 * então cai no centro da célula (que é o comportamento útil e o que o Owlbear faz). */
export function snapPoint(scene, x, y) {
  const g = cellSize(scene), o = gridOffset(scene);
  if (isHex(scene)) return cellCenter(scene, x, y);
  return { x: Math.round((x - o.x) / g) * g + o.x, y: Math.round((y - o.y) / g) * g + o.y };
}

/* Retângulo da célula quadrada (usado pela fog alinhada a células). */
export function cellRect(scene, c, r) {
  const g = cellSize(scene), o = gridOffset(scene);
  return { x: c * g + o.x, y: r * g + o.y, w: g, h: g };
}

/* ---------- medição ---------- */

/* Distância em CÉLULAS entre dois pontos de mundo, conforme o modo da cena.
 * Os modos de grade (chessboard/alternating/manhattan/hex) contam células percorridas e
 * portanto são inteiros; 'euclidean' é contínuo e não se prende à grade. */
export function measureCells(scene, a, b) {
  const g = cellSize(scene);
  const mode = measurementMode(scene);

  if (mode === 'euclidean') return Math.hypot(b.x - a.x, b.y - a.y) / g;

  if (mode === 'hex') {
    return hexDistance(worldToCell(scene, a.x, a.y), worldToCell(scene, b.x, b.y));
  }

  const ca = worldToCell(scene, a.x, a.y);
  const cb = worldToCell(scene, b.x, b.y);
  const dc = Math.abs(cb.c - ca.c), dr = Math.abs(cb.r - ca.r);

  if (mode === 'manhattan') return dc + dr;
  if (mode === 'chessboard') return Math.max(dc, dr);
  // 'alternating' (D&D 3.5): cada 2ª diagonal custa 2.
  const diag = Math.min(dc, dr), straight = Math.max(dc, dr) - diag;
  return straight + diag + Math.floor(diag / 2);
}

const roundTo = (n, digits) => {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
};

/* Medição pronta para exibir. `cells` respeita o modo; `dist`/`unit` aplicam a escala da
 * cena com a precisão configurada. */
export function measure(scene, a, b) {
  const { value, unit, digits } = gridScale(scene);
  const cells = measureCells(scene, a, b);
  return {
    cells: roundTo(cells, Number.isInteger(cells) ? 0 : digits),
    dist: roundTo(cells * value, digits),
    unit,
    mode: measurementMode(scene),
  };
}

/* ---------- alinhamento ---------- */

/* Controle manual do Owlbear: você informa quantas COLUNAS (ou linhas) de grade a imagem
 * tem, e o tamanho da célula sai da divisão. Retorna também o valor implícito do outro
 * eixo, para a UI mostrar se a imagem não fecha em células inteiras. */
export function cellSizeFromColumns(bgSize, columns) {
  const w = Number(bgSize?.w), c = Number(columns);
  if (!Number.isFinite(w) || !Number.isFinite(c) || c <= 0) return null;
  const size = w / c;
  return { size, impliedRows: Number(bgSize?.h) > 0 ? bgSize.h / size : null };
}

export function cellSizeFromRows(bgSize, rows) {
  const h = Number(bgSize?.h), r = Number(rows);
  if (!Number.isFinite(h) || !Number.isFinite(r) || r <= 0) return null;
  const size = h / r;
  return { size, impliedColumns: Number(bgSize?.w) > 0 ? bgSize.w / size : null };
}

/* Quantas colunas/linhas o grid atual produz sobre a cena (para preencher a UI). */
export function cellsAcross(scene) {
  const g = cellSize(scene);
  const bg = scene?.bgSize;
  const w = Number(bg?.w), h = Number(bg?.h);
  return {
    columns: Number.isFinite(w) && g > 0 ? w / g : null,
    rows: Number.isFinite(h) && g > 0 ? h / g : null,
  };
}

/* Owlbear lê as dimensões do grid no NOME do arquivo ("mapa_49x28.jpg" → 49 colunas,
 * 28 linhas). Limitamos a 200 para não confundir com resolução ("1920x1080"). */
const MAX_FILENAME_CELLS = 200;

export function parseGridFromFilename(name) {
  if (typeof name !== 'string') return null;
  const base = name.replace(/\.[a-z0-9]+$/i, '');
  const re = /(\d{1,4})\s*[x×]\s*(\d{1,4})/gi;
  let m, best = null;
  while ((m = re.exec(base)) !== null) {
    const columns = Number(m[1]), rows = Number(m[2]);
    if (columns < 2 || rows < 2) continue;
    if (columns > MAX_FILENAME_CELLS || rows > MAX_FILENAME_CELLS) continue;
    best = { columns, rows }; // o último casamento ganha (sufixos costumam vir no fim)
  }
  return best;
}

/* Escala digitada pelo usuário ("5ft", "1.5 m", "5.00mi") → valor, unidade e precisão.
 * A precisão vem da quantidade de decimais digitada, como no Owlbear. */
export function parseScale(text) {
  if (typeof text !== 'string') return null;
  const m = text.trim().match(/^(\d+(?:[.,](\d+))?)\s*([a-zA-Zµ"']*)$/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value, unit: m[3] || 'm', digits: Math.min(4, (m[2] || '').length) };
}

export const formatScale = ({ value, unit, digits }) =>
  `${Number(value).toFixed(Number.isFinite(digits) ? digits : 1)}${unit}`;

/* ---------- render ---------- */

function hexPolygon(cx, cy, R, pointy) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const rad = (Math.PI / 180) * (60 * i + (pointy ? 90 : 0));
    pts.push([cx + R * Math.cos(rad), cy + R * Math.sin(rad)]);
  }
  return pts;
}

const fmt = (n) => (Math.round(n * 1000) / 1000).toString();
const polyPath = (pts) => `M ${pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' L ')} Z`;

/* Tile de <pattern> que, repetido, produz a grade. No quadrado é o L clássico; no hex é um
 * bloco periódico com 5 hexágonos (os 4 dos cantos entram cortados e se completam nos
 * tiles vizinhos — a geometria do favo é periódica, então fecha exato). */
export function gridPattern(type, g) {
  if (type !== 'hexVertical' && type !== 'hexHorizontal') {
    return { w: g, h: g, d: `M ${fmt(g)} 0 L 0 0 0 ${fmt(g)}` };
  }
  const R = hexRadius(g);
  const pointy = type === 'hexVertical';
  const w = pointy ? g : 3 * R;
  const h = pointy ? 3 * R : g;
  const centers = pointy
    ? [[0, 0], [w, 0], [0, h], [w, h], [w / 2, 1.5 * R]]
    : [[0, 0], [0, h], [w, 0], [w, h], [1.5 * R, h / 2]];
  return { w, h, d: centers.map(([cx, cy]) => polyPath(hexPolygon(cx, cy, R, pointy))).join(' ') };
}
