/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — ELEMENTO DE AFINIDADE: selection vision
 *  Non-dismissible. Players pick from the four selectable elements (Medo is
 *  GM-only and shown as a locked warning). Then confirm — permanent.
 *  The sheet handles the post-confirm eruption transition + persistence.
 *  Props: onChoose(elementId)
 * ════════════════════════════════════════════════════════════════════════ */

import { useState, useMemo } from "react";
import { SELECTABLE_ELEMENTS, getElementTheme } from "./elementos";
import ElementoSymbol from "./ElementoSymbol";

export default function ElementoAfinidadeModal({ onChoose }) {
  const [picked, setPicked] = useState(null);
  const sel = picked ? getElementTheme(picked) : null;

  const particles = useMemo(
    () => Array.from({ length: 18 }, (_, i) => {
      const el = SELECTABLE_ELEMENTS[i % SELECTABLE_ELEMENTS.length];
      return { left: Math.random() * 100, bottom: Math.random() * 40, dur: 4 + Math.random() * 5, delay: Math.random() * 4, color: el.accent };
    }),
    []
  );

  return (
    <div className="op-el-veil" role="dialog" aria-modal="true" aria-label="Escolher elemento de afinidade">
      {particles.map((p, i) => (
        <span key={i} className="op-el-particle" style={{ left: `${p.left}%`, bottom: `${p.bottom}%`, background: p.color, boxShadow: `0 0 8px ${p.color}`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />
      ))}

      {!sel ? (
        <div style={{ width: "min(840px,100%)", position: "relative", zIndex: 1 }}>
          <div className="op-el-title">⟨ O Outro Lado Chama ⟩</div>
          <p style={{ textAlign: "center", color: "var(--muted2)", fontFamily: "var(--font-body,'IM Fell English',serif)", fontStyle: "italic", fontSize: 15, margin: "10px 0 22px" }}>
            Seu agente desenvolveu uma afinidade paranormal. Esta escolha é permanente e irreversível.
          </p>
          {/* Quatro colunas FIXAS viravam quatro cartões de ~78px num celular de
              360px — símbolo, nome e descrição espremidos justo na tela que
              marca o NEX 50%. Com `auto-fit`+`minmax` o desktop mantém as quatro
              (840/4 = 210 > 170) e o celular quebra em duas. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            {SELECTABLE_ELEMENTS.map((el) => (
              <div key={el.id} className="op-el-card" role="button" tabIndex={0}
                onClick={() => setPicked(el.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPicked(el.id)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = el.accent; e.currentTarget.style.boxShadow = `0 0 28px ${el.glow}, inset 0 0 30px ${el.bg}`; e.currentTarget.style.transform = "translateY(-3px) scale(1.05)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                aria-label={el.name}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><ElementoSymbol id={el.id} size={56} /></div>
                <div style={{ fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 18, color: el.accent, textAlign: "center" }}>{el.name}</div>
                <p style={{ fontFamily: "var(--font-body,'IM Fell English',serif)", fontSize: 12.5, color: "var(--muted2)", lineHeight: 1.45, margin: "6px 0 8px", textAlign: "center", minHeight: 54 }}>{el.description}</p>
                <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                  <span style={{ width: 24, height: 8, borderRadius: 2, background: el.bg, border: `1px solid ${el.border}` }} />
                  <span style={{ width: 14, height: 8, borderRadius: 2, background: el.primary }} />
                  <span style={{ width: 14, height: 8, borderRadius: 2, background: el.accent }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, padding: "10px 14px", border: "1px solid rgba(68,102,204,0.4)", borderRadius: 4, background: "rgba(0,8,20,0.5)", display: "flex", gap: 10, alignItems: "center" }}>
            <ElementoSymbol id="medo" size={30} />
            <div style={{ fontFamily: "var(--font-body,'IM Fell English',serif)", fontSize: 13, color: "#9bb3e0" }}>
              <b style={{ color: "#5b8dd9" }}>⚠ Medo</b> não está disponível para seleção direta. Apenas o Mestre da Campanha pode conceder este elemento a agentes especiais.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ width: "min(460px,100%)", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}><ElementoSymbol id={sel.id} size={92} /></div>
          <div style={{ fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 32, color: sel.accent, marginBottom: 8 }}>{sel.name}</div>
          <p style={{ fontFamily: "var(--font-body,'IM Fell English',serif)", fontStyle: "italic", color: "var(--muted2)", fontSize: 15, margin: "0 0 8px" }}>{sel.lore}</p>
          <p style={{ fontFamily: "var(--font-body,'IM Fell English',serif)", color: "var(--muted)", fontSize: 13, margin: "0 0 22px" }}>Você tem certeza? Esta escolha moldará permanentemente seu agente.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn-ghost" onClick={() => setPicked(null)}>← Voltar</button>
            <button className="btn-gold" onClick={() => onChoose(sel.id)} style={{ background: `linear-gradient(135deg, ${sel.primary}, ${sel.accent})`, color: "#0a0a0a", boxShadow: `0 4px 24px ${sel.glow}` }}>Confirmar</button>
          </div>
        </div>
      )}
    </div>
  );
}
