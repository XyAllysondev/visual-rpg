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
  /* ── ORDEM PARANORMAL — FERRO E BRASÃO ─────────────────────────────────
     Repaginação 2026-08-05 (pedido do Andre: "pique Game of Thrones").
     A escala saiu do grafite arroxeado para PRETO FORJADO com ferro frio, e
     o acento único (ouro corrompido) virou um par heráldico: OURO BRUNIDO de
     luz de vela + CARMESIM de brasão. É a gramática da abertura da série —
     metal quente sobre preto — e não uma paleta nova por gosto.

     Regra de uso, para não virar sopa:
       · ouro    = o que responde ao clique e o que titula
       · carmesim= identidade/atmosfera (aura, selo do ativo, brasão)
       · aço     = informação fria (metadado, estado neutro)
       · violeta = SÓ o Outro Lado (rituais, afinidade) — é semântica de jogo,
                   não decoração, por isso sobreviveu à troca.                */
  op: {
    id: "op",
    key: "ordem-paranormal",
    name: "Ordem Paranormal",
    sheetComponent: "OrdemParanormalSheet",
    dashboardStyle: "dossier",
    sidebarStyle: "runes",
    colors: {
      bg: "#08080b",              // preto forjado
      surface: "#15161b",         // ferro
      card: "#1d1f24",
      card2: "#26282f",
      border: "rgba(198,164,92,0.16)",
      border2: "rgba(198,164,92,0.34)",
      accent: "#c6a45c",          // ouro brunido (luz de vela sobre latão)
      accent2: "#f2ddab",         // realce do ouro — o brilho que corre no metal
      accentDim: "#8a6b2c",
      cardAccent: "#a3282c",      // carmesim de brasão — identidade e atmosfera
      cardAccent2: "#e0645a",
      secondary: "#5d7896",       // aço frio — o par calmo do ouro
      secondaryText: "#a9c2d8",
      paranormal: "#4a0e6e",      // Outro Lado: violeta profundo (semântica de jogo)
      paranormalText: "#b87ee0",
      danger: "#8b1a1a",          // sangue
      dangerText: "#d85a5a",
      glitch: "#8b0000",
      text: "#eae3d2",            // pergaminho
      muted: "#97907f",           // AA 4,5:1 sobre o card2 (a escala escureceu, o muted não pode)
      muted2: "#c8bda4",
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

  /* ── D&D 5e — tavern firelight (placeholder palette) ─────────────────────
     Superfícies reescalonadas em 2026-08-05 junto com a repaginação do OP.
     A MATIZ é a mesma (madeira/fogo de taverna) — só o L* desceu para a
     escada nova. É requisito da spec 0023 AC-2: os sistemas compartilham a
     mesma escada de luminância e divergem só na tonalidade. Escurecer o tema
     padrão sem trazer os outros junto reabriria a divergência que a 0023
     fechou (e o teste `surfaces-ladder` pega isso na hora).                */
  dnd: {
    id: "dnd",
    key: "dnd-5e",
    name: "Dungeons & Dragons",
    sheetComponent: "DnD5eSheet",
    dashboardStyle: "tavern-board",
    sidebarStyle: "heraldic",
    colors: {
      bg: "#0a0806",
      surface: "#1c1510",
      card: "#261d15",
      card2: "#30271c",
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

  /* ── TORMENTA 20 — verdant Arton (placeholder palette) ───────────────────
     Superfícies reescalonadas em 2026-08-05 pelo mesmo motivo do D&D acima:
     a escada é compartilhada, a matiz (verde de Arton) não muda.           */
  tormenta: {
    id: "tormenta",
    key: "tormenta20",
    name: "Tormenta 20",
    sheetComponent: "Tormenta20Sheet",
    dashboardStyle: "scroll",
    sidebarStyle: "fantasy",
    colors: {
      bg: "#060906",
      surface: "#111811",
      card: "#192118",
      card2: "#202b20",
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
 * carry a distinct selection-screen identity (OP = heraldic crimson since the
 * 2026-08-05 re-skin; it was arcane purple before) while its in-system chrome
 * stays on `accent` (gold); systems without it fall back to `accent`, so D&D =
 * red and Tormenta = green with no divergence. What AC-6 pins is the MECHANISM
 * — one registry, no hardcoded card colours — not the particular hues.
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
