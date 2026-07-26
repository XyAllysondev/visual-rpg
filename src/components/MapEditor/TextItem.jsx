/* Item de texto do canvas (doc Owlbear /docs/text) — apresentação pura.
 * A lógica (parser, atalhos) mora em richText.js; aqui só se desenha. */
import { useRef, useEffect } from 'react';
import {
  parseRichText, BLOCK_SCALE, fontCss, DEFAULT_TEXT_STYLE,
  toggleWrap, toggleLinePrefix, FONTS,
} from './richText.js';
import { MapIcon } from './icons.jsx';

const style = (el) => ({ ...DEFAULT_TEXT_STYLE, ...el });

const Spans = ({ spans }) => spans.map((s, i) => (
  <span key={i} style={{ fontWeight: s.bold ? 700 : 400, fontStyle: s.italic ? 'italic' : 'normal' }}>
    {s.text}
  </span>
));

function Blocks({ src }) {
  const blocks = parseRichText(src);
  if (!blocks.length) return null;
  return blocks.map((b, i) => {
    if (b.type === 'space') return <div key={i} style={{ height: `${BLOCK_SCALE.space}em` }} />;
    if (b.type === 'ul' || b.type === 'ol') {
      const Tag = b.type === 'ul' ? 'ul' : 'ol';
      return (
        <Tag key={i} start={b.type === 'ol' ? b.start : undefined}
          style={{ margin: '0.15em 0', paddingLeft: '1.2em' }}>
          {b.items.map((spans, j) => <li key={j}><Spans spans={spans} /></li>)}
        </Tag>
      );
    }
    const scale = BLOCK_SCALE[b.type] || 1;
    return (
      <div key={i} style={{ fontSize: `${scale}em`, fontWeight: (b.type === 'h1' || b.type === 'h2') ? 700 : undefined, margin: b.type === 'p' ? 0 : '0.2em 0 0.1em' }}>
        <Spans spans={b.spans} />
      </div>
    );
  });
}

/* Contorno via -webkit-text-stroke com paint-order, para o traço não comer a letra. */
const outlineStyle = (st) => (st.outlineWidth > 0 ? {
  WebkitTextStrokeWidth: `${st.outlineWidth}px`,
  WebkitTextStrokeColor: st.outlineColor,
  paintOrder: 'stroke fill',
} : null);

export function TextItem({ el, selected, dim, zIndex, onPointerDown, onDoubleClick }) {
  const st = style(el);
  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'absolute', left: el.x, top: el.y, width: st.width, zIndex,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        transformOrigin: 'top left',
        fontFamily: fontCss(st.fontId), fontSize: st.fontSize, color: st.color,
        textAlign: st.align, lineHeight: 1.25, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        opacity: dim, cursor: el.locked ? 'default' : 'grab',
        outline: selected ? '2px solid #a855f7' : 'none', outlineOffset: 4,
        ...outlineStyle(st),
      }}>
      <Blocks src={el.text} />
      {el.locked && (
        <span style={{ position: 'absolute', top: -6, right: -6, background: 'rgba(0,0,0,0.75)', borderRadius: '50%', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
          <MapIcon name="lock" size={9} />
        </span>
      )}
    </div>
  );
}

const SIZES = [16, 20, 28, 40, 56, 80];
const COLORS = ['#f5f5f5', '#fbbf24', '#a855f7', '#4ade80', '#f87171', '#60a5fa', '#1a1a1a'];

/* Editor in-place: textarea sobre o item + barra de estilo. Atalhos da doc do Owlbear —
 * Ctrl+B, Ctrl+I e Shift+Enter para concluir. */
export function TextEditorOverlay({ el, onChange, onPatch, onDone, zIndex = 400 }) {
  const ref = useRef(null);
  const rafRef = useRef(0);
  const st = style(el);

  useEffect(() => { ref.current?.focus(); }, []);
  // Cancela o reposicionamento de cursor pendente: sem isto, aplicar Ctrl+B e concluir no
  // mesmo frame roda focus/setSelectionRange num nó já desmontado.
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const apply = (fn) => {
    const ta = ref.current;
    if (!ta) return;
    const out = fn(el.text || '', ta.selectionStart, ta.selectionEnd);
    onChange(out.text);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.focus();
      ref.current.setSelectionRange(out.start, out.end);
    });
  };

  const onKeyDown = (e) => {
    e.stopPropagation(); // o canvas tem atalhos de 1 tecla (V/T/D/F…) — não podem disparar aqui
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onDone(); return; }
    if (e.key === 'Escape') { e.preventDefault(); onDone(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); apply((t, a, b) => toggleWrap(t, a, b, '**')); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); apply((t, a, b) => toggleWrap(t, a, b, '*')); }
  };

  const btn = {
    height: 26, minWidth: 26, padding: '0 7px', borderRadius: 6, border: 'none', cursor: 'pointer',
    background: 'transparent', color: 'rgba(255,255,255,0.72)', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ position: 'absolute', left: el.x, top: el.y, zIndex }}
      onPointerDown={e => e.stopPropagation()}>

      {/* barra de estilo, acima do item */}
      <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', width: 'max-content', maxWidth: 420, background: 'rgba(13,13,24,0.97)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: 6 }}>

        {COLORS.map(c => (
          <button key={c} title={`Cor ${c}`} aria-label={`Cor ${c}`} aria-pressed={st.color === c} onClick={() => onPatch({ color: c })}
            style={{ ...btn, minWidth: 18, width: 18, height: 18, borderRadius: '50%', background: c, boxShadow: st.color === c ? '0 0 0 2px #a855f7' : '0 0 0 1px rgba(255,255,255,0.25)' }} />
        ))}

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

        <select value={st.fontId} onChange={e => onPatch({ fontId: e.target.value })}
          title="Fonte" aria-label="Fonte"
          style={{ ...btn, background: 'rgba(255,255,255,0.06)', fontSize: 11 }}>
          {FONTS.map(f => <option key={f.id} value={f.id} style={{ background: '#16162e' }}>{f.label}</option>)}
        </select>

        <select value={st.fontSize} onChange={e => onPatch({ fontSize: Number(e.target.value) })}
          title="Tamanho" aria-label="Tamanho do texto"
          style={{ ...btn, background: 'rgba(255,255,255,0.06)', fontSize: 11 }}>
          {SIZES.map(s => <option key={s} value={s} style={{ background: '#16162e' }}>{s}</option>)}
        </select>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

        <button title="Negrito (Ctrl+B)" aria-label="Negrito" onClick={() => apply((t, a, b) => toggleWrap(t, a, b, '**'))} style={{ ...btn, fontWeight: 800 }}>B</button>
        <button title="Itálico (Ctrl+I)" aria-label="Itálico" onClick={() => apply((t, a, b) => toggleWrap(t, a, b, '*'))} style={{ ...btn, fontStyle: 'italic', fontFamily: 'serif' }}>I</button>
        <button title="Título 1 (#)" aria-label="Título 1" onClick={() => apply((t, a, b) => toggleLinePrefix(t, a, b, '# '))} style={{ ...btn, fontWeight: 700 }}>H1</button>
        <button title="Título 2 (##)" aria-label="Título 2" onClick={() => apply((t, a, b) => toggleLinePrefix(t, a, b, '## '))} style={{ ...btn, fontWeight: 700, fontSize: 10 }}>H2</button>
        <button title="Lista com marcadores (*)" aria-label="Lista com marcadores" onClick={() => apply((t, a, b) => toggleLinePrefix(t, a, b, '- '))} style={btn}>•</button>
        <button title="Lista numerada (1.)" aria-label="Lista numerada" onClick={() => apply((t, a, b) => toggleLinePrefix(t, a, b, '1. '))} style={{ ...btn, fontSize: 10 }}>1.</button>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

        {[0, 1, 2, 4].map(w => (
          <button key={w} title={w === 0 ? 'Sem contorno' : `Contorno ${w}px`} aria-label={w === 0 ? 'Sem contorno' : `Contorno ${w}px`}
            aria-pressed={st.outlineWidth === w} onClick={() => onPatch({ outlineWidth: w })}
            style={{ ...btn, fontSize: 10, background: st.outlineWidth === w ? 'rgba(168,85,247,0.2)' : 'transparent', color: st.outlineWidth === w ? '#a855f7' : 'rgba(255,255,255,0.72)' }}>
            {w === 0 ? '—' : `${w}px`}
          </button>
        ))}

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

        <button title="Concluir (Shift+Enter)" aria-label="Concluir edição de texto" onClick={onDone}
          style={{ ...btn, background: 'rgba(74,222,128,0.16)', color: '#4ade80', gap: 5 }}>
          <MapIcon name="close" size={11} /> Pronto
        </button>
      </div>

      <textarea
        ref={ref}
        value={el.text || ''}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Escreva…  # título · - lista · **negrito**"
        aria-label="Texto do item no mapa"
        spellCheck={false}
        style={{
          width: st.width, minHeight: Math.max(48, st.fontSize * 2), resize: 'both',
          fontFamily: fontCss(st.fontId), fontSize: st.fontSize, color: st.color,
          textAlign: st.align, lineHeight: 1.25,
          background: 'rgba(13,13,24,0.88)', border: '1px solid #a855f7', borderRadius: 6,
          padding: 6, outline: 'none', caretColor: '#a855f7',
        }} />
    </div>
  );
}
