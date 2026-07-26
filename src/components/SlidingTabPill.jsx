/* ════════════════════════════════════════════════════════════════════════
 *  SlidingTabPill — apresentação do realce "shared-layout"  (spec 0022 AC-5)
 *  ------------------------------------------------------------------------
 *  A geometria vem do hook `useSlidingPill`; aqui só desenhamos. Um único
 *  elemento por barra, posicionado no container e deslocado por `transform`
 *  — só transform/opacity animam (0017 AC-1), e o `@media
 *  (prefers-reduced-motion)` global zera a transição sem este componente
 *  precisar saber disso.
 *
 *  O sublinhado é um filho absoluto, não `border-bottom`: borda entraria na
 *  caixa e deixaria o realce mais alto que a aba onde não há `border-box`.
 * ════════════════════════════════════════════════════════════════════════ */

import { EASE_HOVER, DUR_ENTER } from "../themes/motion";

/**
 * @param {object|null} pill        geometria de `useSlidingPill` (null = não renderiza)
 * @param {string} [background]     fundo do realce
 * @param {string} [boxShadow]      ex.: anel `inset 0 0 0 1px …`
 * @param {number} [radius]         raio das bordas
 * @param {string} [underline]      cor do sublinhado (omitido = sem sublinhado)
 * @param {number} [underlineSize]  espessura do sublinhado, px
 * @param {string} [topLine]        `background` da linha de 1px no topo (D&D)
 * @param {number} [zIndex]
 */
export default function SlidingTabPill({
  pill, background, boxShadow, radius = 0,
  underline, underlineSize = 2, topLine, zIndex = 0,
}) {
  if (!pill) return null;
  return (
    <div aria-hidden="true" className="nx-tab-pill" style={{
      position: "absolute", top: 0, left: 0, zIndex, pointerEvents: "none",
      width: pill.width, height: pill.height, borderRadius: radius,
      transform: `translate(${pill.left}px, ${pill.top}px)`,
      opacity: pill.visible ? 1 : 0,
      background, boxShadow,
      transition: `transform ${DUR_ENTER}ms ${EASE_HOVER}, opacity 0.18s ease`,
    }}>
      {topLine && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: topLine }} />
      )}
      {underline && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: underlineSize, background: underline }} />
      )}
    </div>
  );
}
