/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — ATTRIBUTE CONSTELLATION
 *  Five runic dials arranged in a pentagon (no central orb) joined by faint
 *  element-colored constellation lines. Click a dial to roll; edit mode lets
 *  you type the value or step it.
 *  Props: attrs · accent · onRoll(key) · onEdit(key,val)|null · edit
 * ════════════════════════════════════════════════════════════════════════ */

import AttributeCircle from "./AttributeCircle";
import { ATTR_LABELS } from "./rules";
import { useLocale } from "../../../i18n/useLocale";
import { useIsMobile } from "../../../lib/useViewport";

/* pentagon points as % of the box: AGI top, then clockwise */
const POS = {
  AGI: { x: 50, y: 15 },
  INT: { x: 84, y: 46 },
  VIG: { x: 67, y: 80 },
  PRE: { x: 33, y: 80 },
  FOR: { x: 16, y: 46 },
};
const EDGE_ORDER = ["AGI", "INT", "VIG", "PRE", "FOR"];

export default function AttrConstellation({ attrs, accent = "#e8c96d", onRoll, onEdit, edit, size }) {
  const { t } = useLocale();
  /* O dial é dimensionado aqui, não em CSS: o tamanho vai inline no
     AttributeCircle e estilo inline vence @media — as regras de .op-dial para
     telas estreitas nunca valiam. Em 480px cinco dials de 76px com os rótulos
     embaixo passavam da caixa de 320px de altura e encostavam no cartão de NEX. */
  const compacto = useIsMobile(481);
  const dialSize = size ?? (compacto ? 66 : 76);
  const elementTheme = { glow: accent, rune: accent };
  const pts = EDGE_ORDER.map((k) => `${POS[k].x},${POS[k].y}`).join(" ");

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 300, height: compacto ? 290 : 320, margin: "0 auto" }}>
      {/* constellation lines */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
        <polygon points={pts} fill="none" stroke={accent} strokeOpacity="0.22" strokeWidth="1" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 3px ${accent}55)` }} />
        {EDGE_ORDER.map((k) => (
          <circle key={k} cx={POS[k].x} cy={POS[k].y} r="1.4" fill={accent} fillOpacity="0.5" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      {/* dials */}
      {Object.keys(POS).map((k) => (
        <div key={k} style={{ position: "absolute", left: `${POS[k].x}%`, top: `${POS[k].y}%`, transform: "translate(-50%,-50%)" }}>
          <AttributeCircle
            abbr={k}
            name={t("op.attrs." + k) || ATTR_LABELS[k]}
            value={attrs[k] ?? 0}
            size={dialSize}
            elementTheme={elementTheme}
            edit={edit}
            onRoll={() => onRoll?.(k)}
            onEdit={(v) => onEdit?.(k, v)}
          />
        </div>
      ))}
    </div>
  );
}
