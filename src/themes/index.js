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
  /* ── ORDEM PARANORMAL — OBSIDIANA E AMETISTA ───────────────────────────
     Repaginação 2026-08-06 (pedido do Andre: "deve ter um tom roxo").
     Substitui o par ouro+carmesim de 2026-08-05. A escala saiu do preto
     neutro para OBSIDIANA VIOLETA — o preto tem sopro roxo em TODOS os
     quatro degraus, que é o que faz a tela ler como roxa mesmo nas áreas
     onde não há acento nenhum. Trocar só o acento pintaria uma faixa roxa
     num app cinza; é a escala que decide a cor de um tema escuro.

     A identidade voltou a ser o ROXO ARCANO da spec 0017 (`#b030d8`) —
     não é uma cor nova, é a que a 0017 escolheu e a repaginação heráldica
     tinha trocado por carmesim. Com isso o SPEC_DEVIATION registrado em
     2026-08-05 no AC-6 está RESOLVIDO por retorno, não por atualização de
     spec: o código voltou ao que a spec dizia.

     Regra de uso, para não virar sopa:
       · ouro    = o que responde ao clique e o que titula (o metal gravado)
       · ametista= identidade e atmosfera (aura, brasas, selo, filete fino)
       · aço     = informação fria (metadado, estado neutro)
       · Outro Lado = violeta-magenta em PREENCHIMENTO SATURADO + halo, nunca
                      só linha ou véu. Depois desta repaginação o roxo deixou
                      de ser exclusivo dele — o que o separa agora é a
                      INTENSIDADE (fill vs véu), não a matiz.                */
  op: {
    id: "op",
    key: "ordem-paranormal",
    name: "Ordem Paranormal",
    sheetComponent: "OrdemParanormalSheet",
    dashboardStyle: "dossier",
    sidebarStyle: "runes",
    colors: {
      /* Escada violeta. Os L* (2,27 · 7,34 · 11,64 · 16,16) são os MESMOS de
         antes de propósito: só a matiz girou. É o que mantém o D&D e o
         Tormenta dentro do ±1,0 L* da spec 0023 AC-2 sem tocar neles. */
      bg: "#0a070f",              // obsidiana
      surface: "#191326",
      card: "#231a35",
      card2: "#2d2245",
      /* Filete fino = ametista (a linha ambiente); filete forte = ouro (a
         borda que enfatiza). Dois papéis que já existiam, agora com duas
         cores — é o que dá hierarquia à linha sem engrossá-la. */
      border: "rgba(176,48,216,0.26)",
      border2: "rgba(198,164,92,0.38)",
      accent: "#c6a45c",          // ouro brunido (luz de vela sobre latão)
      accent2: "#f2ddab",         // realce do ouro — o brilho que corre no metal
      accentDim: "#8a6b2c",
      cardAccent: "#b030d8",      // roxo arcano — identidade (spec 0017, restaurado)
      cardAccent2: "#d870f8",
      secondary: "#5d7896",       // aço frio — o par calmo do ouro
      secondaryText: "#a9c2d8",
      paranormal: "#4a0e6e",      // Outro Lado: violeta profundo (semântica de jogo)
      paranormalText: "#c98ef0",
      danger: "#8b1a1a",          // sangue
      dangerText: "#d85a5a",
      glitch: "#8b0000",
      text: "#ede7f6",            // pergaminho sob luz fria
      muted: "#9c95ad",           // AA 4,5:1 sobre o card2 (5,13:1 — conferido)
      muted2: "#cbc2dc",
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
 * carry a distinct selection-screen identity (OP = arcane purple, as the spec
 * defined; the 2026-08-05 re-skin briefly made it crimson and 2026-08-06 put
 * it back) while its in-system chrome
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
