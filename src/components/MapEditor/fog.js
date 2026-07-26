/* Geometria pura da fog avançada (spec 0012 / ADR 0006 §7).
 * Shapes: { id, op:'add'|'cut', type:'rect'|'circle'|'poly'|'free', ...geom mundo }. */

/* Douglas-Peucker: simplifica polilinha mantendo os cantos. */
export function simplify(points, eps = 4) {
  if (!points || points.length <= 2) return points || [];
  const dmax = { d: 0, i: 0 };
  const [a, b] = [points[0], points[points.length - 1]];
  const den = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / den;
    if (d > dmax.d) { dmax.d = d; dmax.i = i; }
  }
  if (dmax.d <= eps) return [a, b];
  const left = simplify(points.slice(0, dmax.i + 1), eps);
  const right = simplify(points.slice(dmax.i), eps);
  return [...left.slice(0, -1), ...right];
}

/* Traço livre → polígono fechado simplificado; [] se degenerar (<3 vértices). */
export function strokeToPoly(points, eps = 4) {
  const simp = simplify(points, eps).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  return simp.length >= 3 ? simp : [];
}

export function shapeBBox(s) {
  if (s.type === 'circle') return { x: s.cx - s.r, y: s.cy - s.r, w: 2 * s.r, h: 2 * s.r };
  if (s.type === 'poly' || s.type === 'free') {
    const xs = s.points.map(p => p.x), ys = s.points.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  return { x: s.x, y: s.y, w: s.w, h: s.h };
}

const rectContainsPoint = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const circleContainsPoint = (c, x, y) => Math.hypot(x - c.cx, y - c.cy) <= c.r;

/* outer contém inner por completo? Contêineres rect/círculo são convexos — checar os
 * vértices/extremos do inner basta. Poly como contêiner: false conservador (não podamos). */
export function containsShape(outer, inner) {
  if (outer.type === 'poly' || outer.type === 'free') return false;
  if (outer.type === 'circle' && inner.type === 'circle') return circleInCircle(outer, inner);
  const pts = innerPoints(inner);
  if (!pts.length) return false;
  const inside = outer.type === 'circle'
    ? (p) => circleContainsPoint(outer, p.x, p.y)
    : (p) => rectContainsPoint(outer, p.x, p.y);
  return pts.every(inside);
}

function innerPoints(s) {
  if (s.type === 'circle') return [
    { x: s.cx - s.r, y: s.cy }, { x: s.cx + s.r, y: s.cy },
    { x: s.cx, y: s.cy - s.r }, { x: s.cx, y: s.cy + s.r },
  ];
  if (s.type === 'poly' || s.type === 'free') return s.points || [];
  return [
    { x: s.x, y: s.y }, { x: s.x + s.w, y: s.y },
    { x: s.x, y: s.y + s.h }, { x: s.x + s.w, y: s.y + s.h },
  ];
}

/* Círculo dentro de círculo: exato por distância + raio (os 4 extremos superestimariam). */
function circleInCircle(outer, inner) {
  return Math.hypot(inner.cx - outer.cx, inner.cy - outer.cy) + inner.r <= outer.r;
}

/* Poda por contenção (spec 0012 AC-6): remove um `add` totalmente contido em outro `add`
 * quando NÃO existe `cut` entre eles na ordem (semântica sequencial preservada). */
export function pruneContained(shapes) {
  const dead = new Set();
  const cutBetween = (i, j) => {
    for (let k = Math.min(i, j) + 1; k < Math.max(i, j); k++) {
      if (shapes[k].op === 'cut' && !dead.has(shapes[k].id)) return true;
    }
    return false;
  };
  for (let i = 0; i < shapes.length; i++) {
    for (let j = 0; j < shapes.length; j++) {
      if (i === j) continue;
      const a = shapes[i], b = shapes[j]; // a = candidato a contêiner, b = candidato a podado
      if (a.op !== 'add' || b.op !== 'add') continue;
      if (dead.has(a.id) || dead.has(b.id)) continue;
      if (cutBetween(i, j)) continue;
      if (containsShape(a, b)) dead.add(b.id);
    }
  }
  return dead.size ? shapes.filter(s => !dead.has(s.id)) : shapes;
}

export function pointInShape(s, x, y) {
  if (s.type === 'circle') return circleContainsPoint(s, x, y);
  if (s.type === 'poly' || s.type === 'free') {
    const pts = s.points || [];
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const pi = pts[i], pj = pts[j];
      if ((pi.y > y) !== (pj.y > y) && x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x) {
        inside = !inside;
      }
    }
    return inside;
  }
  return rectContainsPoint(s, x, y);
}

/* Forma sob o cursor — a ÚLTIMA na ordem (topmost na mask) vence. */
export function hitFogShape(shapes, x, y) {
  for (let i = (shapes || []).length - 1; i >= 0; i--) {
    if (pointInShape(shapes[i], x, y)) return shapes[i];
  }
  return null;
}

/* ───────────── Cortar / Recobrir e grupos (doc Owlbear /docs/fog) ─────────────
 *
 * O fluxo de encontro do Owlbear é: pré-desenhar a névoa de todas as salas ANTES da sessão
 * e, conforme os jogadores entram, alternar cada forma entre coberta e cortada. Aqui isso é
 * virar o `op` da forma que já existe ('add' cobre, 'cut' revela) — a geometria não muda.
 *
 * `groupId` implementa o Join: formas do mesmo grupo alternam JUNTAS. É para o caso do
 * salão com reentrâncias, onde revelar forma por forma seria tedioso. (A doc mostra que o
 * propósito do Join é agrupar para o Cut valer de uma vez — não é união visual.) */

let _grp = 0;
export const newGroupId = () => `g_${Date.now()}_${(_grp++).toString(36)}`;

/* Expande uma seleção de ids para incluir todo o grupo de cada forma tocada. */
export function expandGroups(shapes, ids) {
  const picked = new Set(ids || []);
  const groups = new Set();
  for (const s of shapes || []) if (picked.has(s.id) && s.groupId) groups.add(s.groupId);
  if (!groups.size) return picked;
  const out = new Set(picked);
  for (const s of shapes) if (s.groupId && groups.has(s.groupId)) out.add(s.id);
  return out;
}

/* Alterna cobrir↔cortar. Duas decisões que importam:
 * 1) Seleção mista (umas cobertas, outras cortadas) vira TODA cortada — revelar é a
 *    intenção dominante de quem clicou.
 * 2) As formas tocadas vão para o FIM do array. A mask é sequencial, então um `cut` só
 *    revela o que foi pintado antes dele: sem subir para o topo, cortar uma sala que um
 *    `add` posterior cobre não faria nada visível. */
export function toggleCut(shapes, ids) {
  const list = shapes || [];
  const target = expandGroups(list, ids);
  if (!target.size) return list;
  const anyCovered = list.some(s => target.has(s.id) && s.op !== 'cut');
  const op = anyCovered ? 'cut' : 'add';
  const touched = [], rest = [];
  for (const s of list) (target.has(s.id) ? touched : rest).push(s);
  if (!touched.length) return list;
  return [...rest, ...touched.map(s => (s.op === op ? s : { ...s, op }))];
}

/* Join: dá um groupId comum às formas selecionadas (mínimo 2 para fazer sentido). */
export function joinShapes(shapes, ids, groupId = newGroupId()) {
  const list = shapes || [];
  const target = expandGroups(list, ids);
  if (target.size < 2) return list;
  return list.map(s => (target.has(s.id) ? { ...s, groupId } : s));
}

/* Desfaz o Join das formas selecionadas. */
export function splitShapes(shapes, ids) {
  const list = shapes || [];
  const target = expandGroups(list, ids);
  let changed = false;
  const out = list.map(s => {
    if (!target.has(s.id) || !s.groupId) return s;
    changed = true;
    const { groupId: _g, ...rest } = s;
    return rest;
  });
  return changed ? out : list;
}

/* Cor da névoa (Fog Style do Owlbear) → rgba com a opacidade do papel de quem olha.
 * Aceita hex #rgb/#rrggbb; qualquer outra coisa cai no preto. */
export function fogFill(color, alpha) {
  const hex = typeof color === 'string' ? color.trim() : '';
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  let r = 0, g = 0, b = 0;
  if (m6) { r = parseInt(m6[1], 16); g = parseInt(m6[2], 16); b = parseInt(m6[3], 16); }
  else if (m3) { r = parseInt(m3[1] + m3[1], 16); g = parseInt(m3[2] + m3[2], 16); b = parseInt(m3[3] + m3[3], 16); }
  return `rgba(${r},${g},${b},${alpha})`;
}
