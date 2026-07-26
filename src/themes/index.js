/* ════════════════════════════════════════════════════════════════════════
 *  NEXUS RPG — SYSTEM THEME REGISTRY
 *  ------------------------------------------------------------------------
 *  One visual identity per supported RPG system. The keys here MUST match the
 *  `id` field of the entries in the SYSTEMS array inside App.jsx
 *  ('op' | 'dnd' | 'tormenta' | ...), so the app can theme itself from
 *  `activeSystem.id` with zero extra plumbing.
 *
 *  These themes drive the GLOBAL CSS custom properties the whole app already
 *  reads (`--bg`, `--gold`, `--text`, `--border`, ...). Switching systems
 *  re-paints every screen. Only Ordem Paranormal is fully realised for now;
 *  D&D 5e and Tormenta 20 carry correct palettes for their placeholder sheets.
 * ════════════════════════════════════════════════════════════════════════ */

export const SYSTEM_THEMES = {
  /* ── ORDEM PARANORMAL — corrupted-gold horror dossier ──────────────────── */
  op: {
    id: "op",
    key: "ordem-paranormal",
    name: "Ordem Paranormal",
    sheetComponent: "OrdemParanormalSheet",
    dashboardStyle: "dossier",
    sidebarStyle: "runes",
    colors: {
      bg: "#14141c",
      surface: "#1c1c26",
      card: "#24242f",
      card2: "#2c2c39",
      border: "rgba(201,168,76,0.18)",
      border2: "rgba(201,168,76,0.34)",
      accent: "#c9a84c",          // corrupted gold
      accent2: "#e8c96d",
      accentDim: "#a07830",
      cardAccent: "#b030d8",      // arcane 'Outro Lado' purple — card/selection identity only (spec 0017 Q1)
      cardAccent2: "#d870f8",
      secondary: "#8e6dbf",       // keeps legacy --purple readable
      secondaryText: "#c8a8f0",
      paranormal: "#4a0e6e",      // deep Outro Lado violet (fills/rituals)
      paranormalText: "#b87ee0",
      danger: "#8b1a1a",          // corruption blood red
      dangerText: "#d85a5a",
      glitch: "#8b0000",
      text: "#e8e4d9",            // aged paper
      muted: "#a89a7c",           // spec 0023: subiu p/ manter AA 4,5:1 sobre o card2 grafite
      muted2: "#c8b48e",
    },
    fonts: {
      display: "'Cinzel Decorative', serif", // nome do personagem / números de destaque — NÃO mexer (aprovado)
      title: "'Cinzel', serif",              // labels / section heads
      body: "'Inter', 'Segoe UI', sans-serif",          // parágrafos/inputs — legibilidade (era IM Fell English)
      data: "'IBM Plex Mono', 'Share Tech Mono', monospace", // stats / readouts — legibilidade
    },
    googleFonts:
      "family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;500;600;700&family=Inter:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&family=Share+Tech+Mono&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400",
  },

  /* ── D&D 5e — tavern firelight (placeholder palette) ───────────────────── */
  dnd: {
    id: "dnd",
    key: "dnd-5e",
    name: "Dungeons & Dragons",
    sheetComponent: "DnD5eSheet",
    dashboardStyle: "tavern-board",
    sidebarStyle: "heraldic",
    colors: {
      bg: "#1a140f",
      surface: "#231b13",
      card: "#2d231a",
      card2: "#372b1f",
      border: "rgba(192,57,43,0.20)",
      border2: "rgba(192,57,43,0.38)",
      accent: "#c0392b",
      accent2: "#e07a5a",
      accentDim: "#8b2c20",
      secondary: "#8b6914",
      secondaryText: "#d4a93a",
      paranormal: "#5a3a14",
      paranormalText: "#d4a93a",
      danger: "#7a1f12",
      dangerText: "#e07a5a",
      glitch: "#c0392b",
      text: "#f0e6d2",
      muted: "#a89678",           // spec 0023: AA sobre o card2 grafite
      muted2: "#cdb98e",
    },
    fonts: {
      display: "'MedievalSharp', 'Cinzel Decorative', serif",
      title: "'Cinzel', serif",
      body: "'Palatino Linotype', 'Crimson Pro', serif",
      data: "'Courier Prime', 'Share Tech Mono', monospace",
    },
    googleFonts:
      "family=MedievalSharp&family=Cinzel:wght@400;600;700&family=Courier+Prime&family=Crimson+Pro:ital,wght@0,400;0,600;1,400",
  },

  /* ── TORMENTA 20 — verdant Arton (placeholder palette) ─────────────────── */
  tormenta: {
    id: "tormenta",
    key: "tormenta20",
    name: "Tormenta 20",
    sheetComponent: "Tormenta20Sheet",
    dashboardStyle: "scroll",
    sidebarStyle: "fantasy",
    colors: {
      bg: "#10170f",
      surface: "#161f15",
      card: "#1e281d",
      card2: "#243023",
      border: "rgba(46,125,50,0.22)",
      border2: "rgba(46,125,50,0.40)",
      accent: "#2e7d32",
      accent2: "#5cb860",
      accentDim: "#1f5722",
      secondary: "#b8860b",
      secondaryText: "#e0c050",
      paranormal: "#7a4a0b",
      paranormalText: "#e0c050",
      danger: "#7a3a12",
      dangerText: "#e08a4a",
      glitch: "#2e7d32",
      text: "#e6f0d8",
      muted: "#94a87a",           // spec 0023: AA sobre o card2 grafite
      muted2: "#bcd098",
    },
    fonts: {
      display: "'Pirata One', 'Cinzel Decorative', serif",
      title: "'Cinzel', serif",
      body: "'Lora', 'Crimson Pro', serif",
      data: "'Source Code Pro', 'Share Tech Mono', monospace",
    },
    googleFonts:
      "family=Pirata+One&family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Source+Code+Pro:wght@400;600",
  },
};

export const DEFAULT_THEME_ID = "op";

/** Resolve a theme by system id, always returning a valid theme. */
export const getTheme = (systemId) =>
  SYSTEM_THEMES[systemId] || SYSTEM_THEMES[DEFAULT_THEME_ID];

/** Which fully-themed sheet component a system maps to (used for lazy routing). */
export const getSheetComponent = (systemId) => getTheme(systemId).sheetComponent;

/**
 * Resolve the accent a system shows on the SELECTION SCREEN / cards.
 * Single source of truth for AC-6: the card accent derives from the same
 * registry that themes the system from the inside. `cardAccent` lets a system
 * carry a distinct selection-screen identity (OP = arcane purple) while its
 * in-system chrome stays on `accent` (gold); systems without it fall back to
 * `accent`, so D&D = red and Tormenta = green with no divergence.
 * @returns {{ accent: string, accentText: string, accentGlow: string }}
 */
export const getCardAccent = (systemId) => {
  const c = getTheme(systemId).colors;
  const accent = c.cardAccent || c.accent;
  const accentText = c.cardAccent2 || c.accent2;
  const h = String(accent).replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return { accent, accentText, accentGlow: `rgba(${r},${g},${b},0.32)` };
};
