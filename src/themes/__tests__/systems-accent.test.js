import { getCardAccent, getTheme, SYSTEM_THEMES } from "../index";

/* AC-6: the selection-screen accent for a themed system derives from the SAME
 * registry that themes it inside. `App.jsx`'s SYSTEMS array spreads
 * `getCardAccent(id)` verbatim for every system present in SYSTEM_THEMES, so
 * asserting on the resolver here IS asserting on the card accent — without
 * importing App.jsx (which would drag Firebase into jsdom). */

describe("getCardAccent — single source of truth (AC-6)", () => {
  /* SPEC_DEVIATION RESOLVIDA (2026-08-06). A repaginação heráldica de
   * 2026-08-05 tinha trocado a identidade de card do OP de ROXO ARCANO para
   * carmesim, e isso foi registrado aqui como divergência consciente. Em
   * 2026-08-06 o Andre pediu o roxo de volta ("ordem paranormal deve ter um
   * tom roxo"), então o `cardAccent` voltou ao #b030d8 que a spec 0017 tinha
   * escolhido. A divergência fechou por RETORNO ao que a spec dizia — não
   * por atualização de spec. O que segue divergindo é só o ouro de chrome
   * (#c9a84c → #c6a45c), que a repaginação escureceu de propósito.
   *
   * Este caso testa em duas camadas: primeiro a regra que sobrevive a
   * qualquer repaginação, depois os literais vigentes — que seguem aqui de
   * propósito, para que uma troca ACIDENTAL de paleta ainda falhe. */
  it("OP mantém identidade de card distinta do chrome interno", () => {
    const cores = getTheme("op").colors;
    const { accent, accentText } = getCardAccent("op");

    // a regra (independe da paleta)
    expect(accent).toBe(cores.cardAccent);
    expect(accentText).toBe(cores.cardAccent2);
    expect(accent).not.toBe(cores.accent);

    // a paleta vigente
    expect(accent).toBe("#b030d8");        // roxo arcano (spec 0017)
    expect(accentText).toBe("#d870f8");
    expect(cores.accent).toBe("#c6a45c");   // ouro brunido (chrome interno)
  });

  /* A escala violeta é o que faz a tela LER como roxa. Trocar só o acento
   * pintaria uma faixa roxa num app cinza — foi exatamente o erro que a
   * repaginação de 2026-08-06 corrigiu, e sem trava aqui ele volta na
   * primeira vez que alguém "só clarear um pouco o fundo". */
  it("a escala de superfícies do OP tem sopro violeta em todos os degraus", () => {
    const c = getTheme("op").colors;
    ["bg", "surface", "card", "card2"].forEach((k) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c[k].slice(i, i + 2), 16));
      expect(b).toBeGreaterThan(r);   // azul acima do vermelho…
      expect(r).toBeGreaterThan(g);   // …e vermelho acima do verde = violeta
    });
  });

  it("D&D card accent === its theme accent (red), fixing the old blue divergence", () => {
    expect(getCardAccent("dnd").accent).toBe(getTheme("dnd").colors.accent);
    expect(getCardAccent("dnd").accent).toBe("#c0392b");
    expect(getCardAccent("dnd").accent).not.toBe("#4a6fa5"); // the old hardcoded blue
  });

  it("Tormenta card accent === its theme accent (verdant green)", () => {
    expect(getCardAccent("tormenta").accent).toBe(getTheme("tormenta").colors.accent);
    expect(getCardAccent("tormenta").accent).toBe("#2e7d32");
  });

  it("falls back to `accent` for any themed system lacking `cardAccent`", () => {
    for (const id of Object.keys(SYSTEM_THEMES)) {
      const c = getTheme(id).colors;
      const expected = c.cardAccent || c.accent;
      expect(getCardAccent(id).accent).toBe(expected);
    }
  });

  it("always returns a usable rgba glow", () => {
    expect(getCardAccent("dnd").accentGlow).toMatch(/^rgba\(\d+,\d+,\d+,0\.32\)$/);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  A tela de PLANOS também obedece ao AC-6 (fechado em 2026-08-06)
 *  ------------------------------------------------------------------------
 *  A spec 0017 matou a cor de sistema escrita à mão na tela de SELEÇÃO, mas
 *  `PLAN_DEFS` (tela de Planos) ficou para trás com a própria cópia: o D&D
 *  aparecia AZUL (#4a6fa5 — o mesmo literal que o caso acima já proíbe) e o
 *  Tormenta LARANJA, contra o vermelho e o verde que o registry define. Como
 *  os dois sistemas estão em "EM BREVE", ninguém percebeu até a repaginação
 *  heráldica deixar a divergência gritante.
 *
 *  Este teste lê o FONTE de propósito: importar o App.jsx arrastaria o
 *  Firebase para o jsdom (o comentário no topo deste arquivo explica), e o
 *  que precisa ser travado é justamente a AUSÊNCIA de literal na definição.
 * ════════════════════════════════════════════════════════════════════════ */
describe("PLAN_DEFS não reintroduz cor de sistema escrita à mão (AC-6)", () => {
  const fs = require("fs");
  const path = require("path");
  const fonte = fs.readFileSync(path.join(__dirname, "..", "..", "App.jsx"), "utf8");
  const ini = fonte.indexOf("const PLAN_DEFS");
  const bruto = fonte.slice(ini, fonte.indexOf("function PlansScreen", ini));
  /* Tira os comentários ANTES de checar: o guarda olha CÓDIGO, não prosa. O
   * comentário que explica o conserto cita o "#4a6fa5" de propósito (é o que
   * dá sentido à regra) e sem isto o teste acusaria a própria explicação. */
  const bloco = bruto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("encontra o bloco (guarda contra o teste virar no-op se renomearem)", () => {
    expect(ini).toBeGreaterThan(-1);
    expect(bloco).toContain("systemId: \"dnd\"");
  });

  it("não declara accent/accentGlow — a cor vem do registry", () => {
    expect(bloco).not.toMatch(/\baccent:/);
    expect(bloco).not.toMatch(/\baccentGlow:/);
    expect(bloco).toContain("getCardAccent(p.systemId)");
  });

  it("não traz de volta o azul do D&D nem o laranja do Tormenta", () => {
    expect(bloco).not.toContain("#4a6fa5");
    expect(bloco).not.toContain("#d4621e");
  });
});
