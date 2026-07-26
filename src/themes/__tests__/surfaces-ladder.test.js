import { SYSTEM_THEMES, DEFAULT_THEME_ID } from "../index";

/* ════════════════════════════════════════════════════════════════════════
 *  Escada de superfícies (spec 0023 · AC-1, AC-2, AC-3)
 *  ------------------------------------------------------------------------
 *  Trava o que o olho não confere sozinho: que bg < surface < card < card2
 *  em luminância, que os 3 sistemas compartilham a MESMA escada (só mudando
 *  a tonalidade) e que o texto continua legível sobre a superfície mais
 *  clara. Sem isso, o próximo "clareia só um pouquinho o D&D" reabre a
 *  divergência de escalas que a 0023 acabou de fechar.
 *
 *  Os helpers de cor vivem aqui de propósito: o teste é o oráculo, não o
 *  código de produção.
 * ════════════════════════════════════════════════════════════════════════ */

const SURFACES = ["bg", "surface", "card", "card2"];
const HEX = /^#[0-9a-f]{6}$/i;

/** sRGB → luminância relativa (WCAG 2.x). */
function relativeLuminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Luminância relativa → L* (CIE Lab): escala perceptual, 0 (preto) a 100 (branco). */
function lstar(hex) {
  const y = relativeLuminance(hex);
  return y <= 216 / 24389 ? y * (24389 / 27) : Math.cbrt(y) * 116 - 16;
}

/** Razão de contraste WCAG entre duas cores. */
function contrast(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = Object.entries(SYSTEM_THEMES);

describe("escada de superfícies — completude (AC-1)", () => {
  it.each(themes)("%s expõe as 4 superfícies como hex válido", (_id, theme) => {
    SURFACES.forEach(key => {
      expect(theme.colors[key]).toMatch(HEX);
    });
  });
});

describe("escada de superfícies — monotonicidade (AC-1)", () => {
  it.each(themes)("%s clareia a cada degrau: bg < surface < card < card2", (_id, theme) => {
    const ls = SURFACES.map(k => lstar(theme.colors[k]));
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i]).toBeGreaterThan(ls[i - 1]);
    }
  });

  it.each(themes)("%s separa fundo e superfície mais alta o suficiente para o olho", (_id, theme) => {
    // Antes da 0023 esta razão era 1,15:1 — a hierarquia existia no código e não na tela.
    expect(contrast(theme.colors.bg, theme.colors.card2)).toBeGreaterThan(1.25);
  });
});

describe("escada de superfícies — coerência entre sistemas (AC-2)", () => {
  const base = SYSTEM_THEMES[DEFAULT_THEME_ID].colors;

  it.each(themes)("%s fica a ±1,0 L* da escada do tema padrão em cada degrau", (_id, theme) => {
    SURFACES.forEach(key => {
      expect(Math.abs(lstar(theme.colors[key]) - lstar(base[key]))).toBeLessThanOrEqual(1.0);
    });
  });
});

describe("escada de superfícies — contraste AA (AC-3)", () => {
  // card2 é a superfície mais clara: se passa nela, passa nas outras três.
  it.each(themes)("%s mantém text/muted/muted2 ≥ 4,5:1 sobre card2", (_id, theme) => {
    ["text", "muted", "muted2"].forEach(key => {
      expect(contrast(theme.colors[key], theme.colors.card2)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
