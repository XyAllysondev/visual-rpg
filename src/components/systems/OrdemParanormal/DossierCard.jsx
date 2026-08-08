/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — DOSSIER CARD
 *  Rich character card for the Dashboard: avatar + element badge + NEX +
 *  PV/SAN bars + life-status tag. Replaces the flat list row for OP chars.
 * ════════════════════════════════════════════════════════════════════════ */

import { getElementTheme } from "./elementos";
import ElementoSymbol from "./ElementoSymbol";
import { getActiveAvatar } from "../../../domain/character";
import { nexStats } from "../../../lib/nexStats";

const PV_CRITICO = 0.3;

function statusInfo(pv, pvMax) {
  const ratio = pvMax > 0 ? Number(pv) / Number(pvMax) : 1;
  if (Number(pv) <= 0)    return { label: "INCONSCIENTE", color: "#888888", bg: "rgba(120,120,120,0.15)" };
  if (ratio < PV_CRITICO) return { label: "CRÍTICO",      color: "#e08030", bg: "rgba(200,80,0,0.15)"   };
  return                         { label: "ESTÁVEL",       color: "#4caf7d", bg: "rgba(40,160,90,0.12)"  };
}

function VitalBar({ value, max, color, label }) {
  const pct = max > 0 ? Math.min(100, Math.round((Number(value) / Number(max)) * 100)) : 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "Cinzel,serif", fontSize: 9, letterSpacing: "0.07em", color: "var(--muted)", textTransform: "uppercase" }}>
          {label}
        </span>
        <span style={{ fontFamily: "Cinzel,serif", fontSize: 9, color }}>
          {Number(value)}/{Number(max)}
        </span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          borderRadius: 3,
          transition: "width 0.4s ease",
          boxShadow: `0 0 6px ${color}60`,
        }} />
      </div>
    </div>
  );
}

export default function DossierCard({ character: c, systemAccent, onClick }) {
  const elId    = c.elementoAfinidade || null;
  const elTheme = getElementTheme(elId);
  const accent  = elId ? elTheme.accent : (systemAccent || "var(--gold)");
  const glow    = elId ? elTheme.glow   : "rgba(201,168,76,0.25)";

  const nex    = Number(c.nex ?? 5);
  /* Ficha recém-criada não tem vitais gravados — o criador só persiste atributos,
   * origem, classe e NEX; os máximos nascem quando a ficha é aberta. Sem este
   * fallback o card lia 0/1 e carimbava INCONSCIENTE em um agente que acabou de
   * entrar na Ordem. `nexStats` é o mesmo cálculo que o card de ficha
   * compartilhada usa (lib/nexStats), não uma segunda régua. */
  const derivado = nexStats(nex, c.classe?.id, {
    VIG: Number(c.attrs?.VIG) || 0, PRE: Number(c.attrs?.PRE) || 0,
  });
  const pvMax  = Number(c.pvMax  ?? derivado.pv)  || 1;
  const sanMax = Number(c.sanMax ?? derivado.san) || 1;
  const pv     = Number(c.pv  ?? pvMax);
  const san    = Number(c.san ?? sanMax);

  const status = statusInfo(pv, pvMax);

  return (
    <div
      className="op-dossier-card"
      onClick={onClick}
      style={{
        background: "var(--card)",
        border: `1px solid ${accent}40`,
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        cursor: "pointer",
        transition: "border-color 0.2s, box-shadow 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${accent}80`;
        e.currentTarget.style.boxShadow   = `0 0 20px ${glow}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = `${accent}40`;
        e.currentTarget.style.boxShadow   = "none";
      }}
    >
      {/* Ambient element glow strip at top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${accent}80, transparent)`,
        opacity: elId ? 1 : 0.4,
      }} />

      {/* Avatar + element badge */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 10,
          border: `2px solid ${accent}60`,
          boxShadow: `0 0 14px ${glow}`,
          overflow: "hidden",
          background: `${accent}12`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30,
        }}>
          {getActiveAvatar(c)
            ? <img src={getActiveAvatar(c)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : "🕵️"
          }
        </div>

        {elId && (
          <div style={{
            position: "absolute", bottom: -4, right: -4,
            width: 28, height: 28,
            background: "var(--card)",
            border: `1.5px solid ${accent}70`,
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 8px ${glow}`,
          }}>
            <ElementoSymbol id={elId} size={18} animated={true} />
          </div>
        )}
      </div>

      {/* Name + class/origin + NEX bar */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
        <div>
          <div style={{
            fontFamily: "'Cinzel Decorative',serif", fontSize: 15,
            color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            marginBottom: 3,
          }}>
            {c.form?.personagem || "Sem nome"}
          </div>
          <div style={{
            fontFamily: "Cinzel,serif", fontSize: 10, letterSpacing: "0.06em",
            color: "var(--muted)", textTransform: "uppercase",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {[c.classe?.name, c.origem?.name, elId ? elTheme.name : null]
              .filter(Boolean).join(" · ") || "Agente da Ordem"}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontFamily: "Cinzel,serif", fontSize: 9, letterSpacing: "0.07em", color: "var(--muted)", textTransform: "uppercase" }}>NEX</span>
            <span style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: accent }}>{nex}%</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${nex}%`,
              background: `linear-gradient(90deg, ${accent}80, ${accent})`,
              borderRadius: 2, transition: "width 0.5s ease",
              boxShadow: `0 0 8px ${glow}`,
            }} />
          </div>
        </div>
      </div>

      {/* Vitals column */}
      <div className="op-dossier-vitals" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 110, flexShrink: 0 }}>
        <VitalBar value={pv}  max={pvMax}  color="#e05555" label="PV"  />
        <VitalBar value={san} max={sanMax} color="#5577cc" label="SAN" />

        <div style={{
          alignSelf: "flex-end",
          padding: "2px 10px",
          borderRadius: 20,
          border: `1px solid ${status.color}60`,
          background: status.bg,
          fontFamily: "Cinzel,serif", fontSize: 8,
          letterSpacing: "0.1em", color: status.color,
          textTransform: "uppercase",
        }}>
          {status.label}
        </div>
      </div>

      <span style={{ fontFamily: "Cinzel,serif", fontSize: 11, color: accent, opacity: 0.5, flexShrink: 0 }}>→</span>
    </div>
  );
}
