/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — ATTRIBUTE CIRCLE
 *  Restored original runic dial, elevated: rotating glyph ring (60s, faster on
 *  hover), aged-gold decorative ring, deep radial-gradient core, glowing
 *  Cinzel number, element-tinted aura. Click rolls; click number edits.
 *  Requires the keyframes/classes from ordemStyles.jsx (rendered by the sheet).
 *
 *  Props: name (full label) · abbr · value · elementTheme · onRoll · edit · onEdit · emphasis
 * ════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react";

const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";

export default function AttributeCircle({ name, abbr, value, elementTheme, onRoll, edit, onEdit, emphasis, size = 96 }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const glow = elementTheme?.glow || "#e8c96d";
  const rune = elementTheme?.rune || "#c9a84c";
  const numFont = Math.round(size * 0.31);
  const editFont = Math.round(size * 0.22);

  const commit = () => {
    const n = Math.max(0, Math.min(99, parseInt(draft, 10) || 0));
    onEdit?.(n);
    setEditing(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div
        className={`op-dial ${emphasis ? "op-emph" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`${name} ${value} — rolar`}
        onClick={() => !edit && onRoll?.()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !edit && onRoll?.()}
        /* O tamanho vem por prop e é aplicado inline — quem decide é o
           AttrConstellation, que lê a viewport. Tentar encolher o dial por
           media query em ordemStyles não funciona: estilo inline vence
           @media, e as regras de 76px/66px ficavam inertes. */
        style={{ cursor: edit ? "default" : "pointer", width: size, height: size }}
      >
        <div className="op-dial-aura" />
        <svg viewBox="0 0 96 96" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id={`op-core-${abbr}`} cx="50%" cy="42%" r="60%">
              <stop offset="0%" stopColor="#15131c" />
              <stop offset="60%" stopColor="#0a0910" />
              <stop offset="100%" stopColor="#040308" />
            </radialGradient>
            <path id={`op-runepath-${abbr}`} d="M48 48 m-40 0 a40 40 0 1 1 80 0 a40 40 0 1 1 -80 0" fill="none" />
          </defs>

          {/* rotating outer runic ring */}
          <g className="op-dial-rune">
            <circle cx="48" cy="48" r="44" fill="none" stroke={rune} strokeOpacity="0.16" strokeWidth="0.75" />
            <text fontSize="8.5" fill={rune} fillOpacity="0.5" letterSpacing="3.2"
              fontFamily="var(--font-data,'Share Tech Mono',monospace)">
              <textPath href={`#op-runepath-${abbr}`}>{RUNES}</textPath>
            </text>
          </g>

          {/* middle decorative ring */}
          <circle className="op-dial-ring2" cx="48" cy="48" r="33" fill="none" stroke="#c9a84c" strokeOpacity="0.55" strokeWidth="1.4" />
          <circle cx="48" cy="48" r="29" fill="none" stroke="#c9a84c" strokeOpacity="0.22" strokeWidth="0.75" strokeDasharray="1.5,3.5" />

          {/* deep core */}
          <circle cx="48" cy="48" r="27" fill={`url(#op-core-${abbr})`} stroke="#000" strokeWidth="1" />
        </svg>

        {editing ? (
          <input
            autoFocus
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            style={{
              position: "absolute", top: "32%", left: "30%", width: "40%", height: "36%", textAlign: "center",
              background: "rgba(0,0,0,0.95)", border: `1px solid ${glow}`, color: glow,
              fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: editFont, fontWeight: 700, borderRadius: 4, padding: 0,
            }}
          />
        ) : (
          <div
            className="op-dial-num"
            onClick={(e) => { if (edit) { e.stopPropagation(); setEditing(true); } }}
            style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: numFont, color: glow, textShadow: `0 0 12px ${glow}88, 0 0 2px ${glow}`, cursor: edit ? "text" : "pointer",
            }}
          >
            {value}
          </div>
        )}
      </div>
      <span className="op-data" style={{ fontSize: 11, letterSpacing: "0.12em", color: rune, fontWeight: 700 }}>{abbr}</span>
      <span style={{ fontFamily: "var(--font-body,'IM Fell English',serif)", fontStyle: "italic", fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.04em" }}>{name}</span>
    </div>
  );
}
