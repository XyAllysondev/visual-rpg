/* Rich text do editor de mapas — parser puro, sem React e sem DOM.
 *
 * O Owlbear usa atalhos estilo markdown no editor de texto do canvas (doc /docs/text):
 * `#` título 1, `##` título 2, `*` lista com marcadores, `1` lista numerada, e negrito/
 * itálico inline. Aqui o texto é guardado como STRING (fonte markdown-ish) e convertido em
 * blocos na hora de renderizar — assim o dado que vai pro Firestore continua sendo texto
 * simples, sem árvore de nós para sincronizar nem migração quando o render mudar.
 *
 * Suportado de propósito, e só isso: títulos 1/2, lista com marcador, lista numerada,
 * parágrafo, e inline **negrito** / *itálico*. Sem links, tabelas ou código — nada disso
 * aparece na doc do Owlbear para itens de texto no canvas.
 */

export const FONTS = [
  { id: 'cinzel', label: 'Cinzel', css: "'Cinzel', serif" },
  { id: 'inter',  label: 'Inter',  css: "'Inter', system-ui, sans-serif" },
  { id: 'mono',   label: 'Mono',   css: "'IBM Plex Mono', monospace" },
];

export const fontCss = (id) => (FONTS.find(f => f.id === id) || FONTS[1]).css;

export const DEFAULT_TEXT_STYLE = {
  color: '#f5f5f5',
  fontSize: 28,
  fontId: 'inter',
  align: 'left',
  outlineColor: '#000000',
  outlineWidth: 0,
  width: 340,
};

/* ---------- inline: **negrito** e *itálico* ---------- */

const hasCloser = (line, from, token) => line.indexOf(token, from) !== -1;

/* Quebra uma linha em spans {text, bold, italic}. Marcadores não fechados ficam literais,
 * que é o comportamento menos surpreendente enquanto a pessoa ainda está digitando. */
export function parseInline(line) {
  const out = [];
  let buf = '';
  let bold = false, italic = false;
  const push = () => { if (buf) { out.push({ text: buf, bold, italic }); buf = ''; } };

  for (let i = 0; i < line.length; i++) {
    const two = line.slice(i, i + 2);
    if (two === '**') {
      if (bold) { push(); bold = false; i++; continue; }
      if (hasCloser(line, i + 2, '**')) { push(); bold = true; i++; continue; }
    } else if (line[i] === '*') {
      if (italic) { push(); italic = false; continue; }
      if (hasCloser(line, i + 1, '*')) { push(); italic = true; continue; }
    }
    buf += line[i];
  }
  push();
  return out.length ? out : [{ text: '', bold: false, italic: false }];
}

/* ---------- blocos ---------- */

const RE_H1 = /^#\s+(.*)$/;
const RE_H2 = /^##\s+(.*)$/;
const RE_UL = /^[*-]\s+(.*)$/;
const RE_OL = /^(\d+)[.)]\s+(.*)$/;

/* Texto → blocos. Cada bloco é {type, spans} e, nas listas, {items:[spans]} + `start`. */
export function parseRichText(src) {
  if (typeof src !== 'string' || !src) return [];
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];

  for (const raw of lines) {
    const line = raw.trimEnd();

    const h2 = line.match(RE_H2);
    if (h2) { blocks.push({ type: 'h2', spans: parseInline(h2[1]) }); continue; }

    const h1 = line.match(RE_H1);
    if (h1) { blocks.push({ type: 'h1', spans: parseInline(h1[1]) }); continue; }

    const ul = line.match(RE_UL);
    if (ul) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ul') last.items.push(parseInline(ul[1]));
      else blocks.push({ type: 'ul', items: [parseInline(ul[1])] });
      continue;
    }

    const ol = line.match(RE_OL);
    if (ol) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ol') last.items.push(parseInline(ol[2]));
      else blocks.push({ type: 'ol', items: [parseInline(ol[2])], start: Number(ol[1]) || 1 });
      continue;
    }

    if (!line.trim()) { blocks.push({ type: 'space' }); continue; }
    blocks.push({ type: 'p', spans: parseInline(line) });
  }
  return blocks;
}

/* Escala tipográfica relativa ao tamanho base do item. */
export const BLOCK_SCALE = { h1: 1.7, h2: 1.32, p: 1, ul: 1, ol: 1, space: 0.6 };

/* Texto puro (sem marcação) — rótulo curto na lista de elementos e aria-label. */
export function plainText(src) {
  return parseRichText(src)
    .flatMap(b => (b.type === 'ul' || b.type === 'ol')
      ? b.items.map(spans => spans.map(s => s.text).join(''))
      : [(b.spans || []).map(s => s.text).join('')])
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const previewLabel = (src, max = 24) => {
  const t = plainText(src);
  if (!t) return 'Texto';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/* ---------- atalhos do editor ---------- */

/* Aplica **negrito** / *itálico* ao trecho selecionado (Ctrl+B / Ctrl+I), ou insere o par
 * vazio com o cursor no meio quando não há seleção. Devolve o texto novo e onde deixar a
 * seleção, para o caller reposicionar o cursor no textarea. */
export function toggleWrap(text, start, end, token) {
  const src = typeof text === 'string' ? text : '';
  const a = Math.max(0, Math.min(src.length, start));
  const b = Math.max(a, Math.min(src.length, end));
  const before = src.slice(0, a), sel = src.slice(a, b), after = src.slice(b);
  const n = token.length;

  // já está envolvido por dentro: desfaz
  if (sel.startsWith(token) && sel.endsWith(token) && sel.length >= n * 2) {
    const inner = sel.slice(n, -n);
    return { text: before + inner + after, start: a, end: a + inner.length };
  }
  // envolvido por fora: desfaz
  if (a >= n && src.slice(a - n, a) === token && src.slice(b, b + n) === token) {
    return { text: src.slice(0, a - n) + sel + src.slice(b + n), start: a - n, end: b - n };
  }
  return { text: `${before}${token}${sel}${token}${after}`, start: a + n, end: a + n + sel.length };
}

/* Aplica prefixo de bloco (`# `, `## `, `- `, `1. `) nas linhas tocadas pela seleção.
 * Reaplicar o mesmo prefixo remove — é toggle, como nos editores de verdade. */
export function toggleLinePrefix(text, start, end, prefix) {
  const src = typeof text === 'string' ? text : '';
  const lineStart = src.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nlAfter = src.indexOf('\n', end);
  const lineEnd = nlAfter === -1 ? src.length : nlAfter;

  const chunk = src.slice(lineStart, lineEnd);
  const lines = chunk.split('\n');
  const strip = (l) => l.replace(/^(#{1,2}\s+|[*-]\s+|\d+[.)]\s+)/, '');
  const numbered = /^\d+[.)]\s+$/.test(prefix);
  const allHave = numbered
    ? lines.every(l => RE_OL.test(l))
    : lines.every(l => l.startsWith(prefix));

  const next = lines.map((l, i) => {
    const bare = strip(l);
    if (allHave) return bare;
    return numbered ? `${i + 1}. ${bare}` : prefix + bare;
  }).join('\n');

  const out = src.slice(0, lineStart) + next + src.slice(lineEnd);
  return { text: out, start: lineStart, end: lineStart + next.length };
}
