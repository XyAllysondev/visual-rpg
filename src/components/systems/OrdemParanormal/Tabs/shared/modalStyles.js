import { createPortal } from "react-dom";

/* ════════════════════════════════════════════════════════════════════════
 *  NEXUS TYPOGRAPHY SYSTEM — shared tokens for all OP tab components.
 *  Fonts come from CSS vars set by ThemeProvider:
 *    --font-title   = Cinzel             --font-display = Cinzel Decorative
 *    --font-body    = IM Fell English    --font-data    = Share Tech Mono
 *
 *  Readability principle: Cinzel/Fell are thematic accents only.
 *  All body / description / label text uses Inter for screen legibility.
 * ════════════════════════════════════════════════════════════════════════ */
export const FONT = {
  cinzel: "var(--font-title,'Cinzel',serif)",
  decorative: "var(--font-display,'Cinzel Decorative',serif)",
  fell: "var(--font-body,'IM Fell English',serif)",
  mono: "var(--font-data,'Share Tech Mono',monospace)",
  ui: "Inter,'Inter var',system-ui,-apple-system,sans-serif",
};

/* Section headers / labels (PONTOS DE PRESTÍGIO, PATENTE, NOVO…) */
export const tLabel = {
  fontFamily: FONT.cinzel, fontSize: 11, fontWeight: 700,
  letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--el-accent)",
};

/* Card titles / ability + item names */
export const tCardTitle = {
  fontFamily: FONT.ui, fontSize: 14, fontWeight: 600,
  letterSpacing: "0.01em", color: "var(--text,#e8e4d9)",
};

/* Special section titles (SURTOS DE ENERGIA…) */
export const tSectionTitle = {
  fontFamily: FONT.decorative, fontSize: 14, fontWeight: 700,
  letterSpacing: "0.08em", color: "var(--el-primary)",
};

/* Body text / descriptions — readable sans-serif, not italic by default */
export const tBody = {
  fontFamily: FONT.ui, fontSize: 14, lineHeight: 1.72, color: "rgba(232,228,217,0.88)",
};

/* Lore / flavour text — italic Fell only for explicit flavour passages */
export const tLore = {
  fontFamily: FONT.fell, fontSize: 14, fontStyle: "italic", lineHeight: 1.7, color: "#e8e4d9",
};

/* Stats / numbers / dice notation / values */
export const tStat = {
  fontFamily: FONT.mono, fontSize: 13, color: "var(--el-accent)",
};

/* Button labels */
export const tButton = {
  fontFamily: FONT.cinzel, fontSize: 11, fontWeight: 700,
  letterSpacing: "0.1em", textTransform: "uppercase",
};

/* Empty state messages */
export const tEmpty = {
  fontFamily: FONT.ui, fontStyle: "italic", fontSize: 13,
  color: "rgba(232,228,217,0.35)", lineHeight: 1.6,
};

/* Subtext / metadata (small descriptions, timestamps, tags) */
export const tSubtext = {
  fontFamily: FONT.ui, fontSize: 12, color: "rgba(232,228,217,0.45)", lineHeight: 1.5,
};

/* shared modal + form styling for all OP tabs */
export const overlayS = {
  position: "fixed", inset: 0, zIndex: 120, background: "rgba(8,8,14,0.82)",
  backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
export const modalS = {
  width: "min(620px,100%)", maxHeight: "88vh", overflow: "auto", padding: 22,
  background: "var(--card2,#2c2c39)", border: "1px solid var(--el-border)",
  boxShadow: "0 0 40px var(--el-glow)", borderRadius: 8,
};
export const modalTitle = {
  fontFamily: FONT.decorative, fontSize: 18,
  color: "var(--el-accent)", margin: 0,
};
export const fieldLabel = {
  ...tLabel, display: "block", marginBottom: 5, marginTop: 14, fontSize: 10,
};
export const inputS = {
  width: "100%", padding: "8px 12px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
  color: "rgba(232,228,217,0.9)",
  fontFamily: FONT.ui, fontSize: 16, outline: "none", // 16px evita o zoom automático do iOS ao focar
  boxSizing: "border-box",
};
export const btnGold = {
  ...tButton, padding: "9px 22px",
  background: "var(--el-accent)", color: "#0a0a0f",
  border: "none", borderRadius: 6, cursor: "pointer",
  fontSize: 11,
};
export const btnGhost = {
  ...tButton, padding: "9px 16px",
  background: "transparent", color: "var(--muted2,rgba(255,255,255,0.45))",
  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, cursor: "pointer",
  fontSize: 11,
};
export const chip = (active) => ({
  ...tButton, fontSize: 10, padding: "5px 13px", borderRadius: 16, cursor: "pointer",
  background: active ? "var(--el-accent)" : "rgba(255,255,255,0.05)",
  color: active ? "#0a0a0f" : "rgba(232,228,217,0.5)",
  border: `1px solid ${active ? "var(--el-accent)" : "rgba(255,255,255,0.1)"}`,
  whiteSpace: "nowrap", transition: "all 0.15s",
});

/* OP official-content banner */
export function BannerHeader({ description }) {
  return (
    <div style={{ background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 8, padding: "14px 18px" }}>
      <div style={{ fontFamily: FONT.cinzel, fontSize: 11, color: "#c9a84c", letterSpacing: "0.1em", marginBottom: 5 }}>✦ Conteúdo do livro base — material não oficial</div>
      <div style={{ fontFamily: FONT.ui, fontSize: 13, color: "rgba(232,228,217,0.6)", lineHeight: 1.6 }}>
        {description || "Conteúdo extraído do sistema base de Ordem Paranormal e de suas expansões oficiais."}
      </div>
      <a href="https://ordemparanormal.com.br" target="_blank" rel="noreferrer" className="op-banner-link"
        style={{ display: "inline-block", marginTop: 6, fontFamily: FONT.cinzel, fontSize: 11, color: "var(--el-accent)", textDecoration: "none" }}>
        Veja mais em ordemparanormal.com.br
      </a>
    </div>
  );
}

export function ModalShell({ title, onClose, children, width }) {
  return createPortal(
    <div onClick={onClose} style={overlayS}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modalS, ...(width ? { width } : {}) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={modalTitle}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 26, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
