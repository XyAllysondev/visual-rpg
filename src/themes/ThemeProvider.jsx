/* ════════════════════════════════════════════════════════════════════════
 *  NEXUS RPG — THEME PROVIDER
 *  ------------------------------------------------------------------------
 *  Bridges the SYSTEM_THEMES registry to the running app.
 *
 *  • <ThemeStyles/>      — render ONCE. Injects all per-system CSS-variable
 *                          blocks (scoped to :root[data-nexus-system="<id>"])
 *                          plus the Google-font @imports every system needs.
 *  • <ThemeProvider>     — sets data-nexus-system on <html> so the matching
 *                          variable block wins, and exposes the active theme
 *                          object through React context.
 *  • useTheme()          — read the active theme object anywhere.
 *
 *  This deliberately drives the SAME variable names the existing UI already
 *  consumes (--bg, --gold, --text, --border, ...), so no component needs to
 *  change for the re-theme to take effect — switching systems repaints the
 *  whole app.
 * ════════════════════════════════════════════════════════════════════════ */

import { createContext, useContext, useEffect, useMemo } from "react";
import { SYSTEM_THEMES, getTheme, DEFAULT_THEME_ID } from "./index";

const ThemeContext = createContext(getTheme(DEFAULT_THEME_ID));

/** Read the currently active system theme object. */
export const useTheme = () => useContext(ThemeContext);

/* hex (#abc | #aabbcc) → [r,g,b] */
const canais = (hex) => {
  const h = String(hex).replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};

/* hex (#abc | #aabbcc) → rgba() with alpha */
const rgba = (hex, a) => {
  const [r, g, b] = canais(hex);
  return `rgba(${r},${g},${b},${a})`;
};

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
/** Escurece um hex por um fator (0 = igual, 1 = preto). */
const escurecer = (hex, f) => `#${canais(hex).map((c) => hex2(c * (1 - f))).join("")}`;
/** Mistura dois hex (t = 0 devolve `a`, t = 1 devolve `b`). */
const misturar = (a, b, t) => {
  const [ar, ag, ab] = canais(a); const [br, bg, bb] = canais(b);
  return `#${hex2(ar + (br - ar) * t)}${hex2(ag + (bg - ag) * t)}${hex2(ab + (bb - ab) * t)}`;
};

/* Flatten a theme into the global CSS custom properties the app reads. */
const toVars = (t) => {
  const c = t.colors;
  const f = t.fonts;
  return [
    `--bg:${c.bg}`,
    `--surface:${c.surface}`,
    `--card:${c.card}`,
    `--card2:${c.card2}`,
    `--border:${c.border}`,
    `--border2:${c.border2}`,
    `--gold:${c.accent}`,
    `--gold2:${c.accent2}`,
    `--gold3:${c.accentDim}`,
    `--gold-glow:${rgba(c.accent, 0.22)}`,
    `--gold-dim:${rgba(c.accent, 0.09)}`,
    /* Degraus de alfa e a LIGA do metal (repaginação 2026-08-05).
       Existem porque a camada `themes/heraldica` precisa de véu de hover,
       preenchimento, sombra projetada e as paradas do degradê da chapa — e
       escrever esses valores como literal ali cravaria o ouro do Ordem
       Paranormal na pele "global": trocar para D&D deixaria os hovers e os
       botões dourados no meio de uma paleta vermelha. Derivando aqui, a
       chapa vira latão em OP, ferro em brasa no D&D e bronze em Tormenta
       sem ninguém tocar em CSS. */
    `--gold-veil:${rgba(c.accent, 0.07)}`,   // véu de hover
    `--gold-wash:${rgba(c.accent, 0.16)}`,   // preenchimento leve
    `--gold-sel:${rgba(c.accent, 0.28)}`,    // seleção de texto
    `--gold-cast:${rgba(c.accent, 0.8)}`,    // sombra projetada do botão
    `--gold-mid:${misturar(c.accent, c.accentDim, 0.5)}`,   // parada média da chapa
    `--gold-deep:${escurecer(c.accentDim, 0.28)}`,          // pé da chapa
    `--gold-face:${misturar(c.muted2, c.text, 0.35)}`,       // base do texto gravado
    `--accent:${c.accent}`,
    `--accent2:${c.accent2}`,
    `--accent-dim:${c.accentDim}`,
    /* Brasão: a cor de IDENTIDADE do sistema (carmesim em OP), a mesma que a
       tela de seleção usa via `getCardAccent`. Antes só existia em JS, então
       o CSS global não tinha como pintar atmosfera com ela — a camada
       `themes/heraldica` precisa dela para as brasas e os selos. */
    `--brasao:${c.cardAccent || c.accent}`,
    `--brasao2:${c.cardAccent2 || c.accent2}`,
    `--brasao-glow:${rgba(c.cardAccent || c.accent, 0.32)}`,
    `--brasao-dim:${rgba(c.cardAccent || c.accent, 0.12)}`,
    `--purple:${c.secondary}`,
    `--purple2:${c.secondaryText}`,
    `--purple-glow:${rgba(c.secondary, 0.3)}`,
    `--purple-dim:${rgba(c.secondary, 0.12)}`,
    `--paranormal:${c.paranormal}`,
    `--paranormal-text:${c.paranormalText}`,
    `--paranormal-glow:${rgba(c.paranormal, 0.45)}`,
    `--danger:${c.danger}`,
    `--danger-text:${c.dangerText}`,
    `--glitch:${c.glitch}`,
    `--text:${c.text}`,
    `--muted:${c.muted}`,
    `--muted2:${c.muted2}`,
    `--font-display:${f.display}`,
    `--font-title:${f.title}`,
    `--font-body:${f.body}`,
    `--font-data:${f.data}`,
  ].join(";");
};

/**
 * Injects every system's variable block + font imports. Render exactly once,
 * high in the tree (next to the existing global <style>). Inert until an
 * ancestor sets [data-nexus-system] on <html>.
 */
export function ThemeStyles() {
  const css = useMemo(() => {
    const imports = Array.from(
      new Set(Object.values(SYSTEM_THEMES).map((t) => t.googleFonts))
    )
      .map((g) => `@import url('https://fonts.googleapis.com/css2?${g}&display=swap');`)
      .join("\n");
    const blocks = Object.values(SYSTEM_THEMES)
      .map((t) => `:root[data-nexus-system="${t.id}"]{${toVars(t)}}`)
      .join("\n");
    return `${imports}\n${blocks}`;
  }, []);
  return <style data-nexus-theme>{css}</style>;
}

/**
 * Activates a system theme: tags <html> and provides the theme via context.
 * @param {{ systemId?: string, children: React.ReactNode }} props
 */
export function ThemeProvider({ systemId, children }) {
  const theme = useMemo(() => getTheme(systemId), [systemId]);
  useEffect(() => {
    document.documentElement.dataset.nexusSystem = theme.id;
  }, [theme.id]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
