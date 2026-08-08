import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ELEMENTOS } from "../../components/systems/OrdemParanormal/elementos";
import ElementoSymbol from "../../components/systems/OrdemParanormal/ElementoSymbol";
import * as messagesRepo from "../../infrastructure/firestore/messagesRepo";

/* ════════════════════════════════════════════════════════════════════════
 *  CAMPAIGN ROLL DRAWER — histórico de rolagens em tempo real (drawer lateral)
 *  Lê campaigns/{id}/messages (type=="roll") via onSnapshot. Cada card usa o
 *  elemento do PERSONAGEM que rolou (rollData.elemento), não o ativo.
 * ════════════════════════════════════════════════════════════════════════ */
/* `ts` é epoch-ms (spec 0032 AC-5): o repositório normaliza, esta tela não conhece mais o
   formato do banco. Rolagem sem carimbo do servidor ainda chega `null` e fica sem hora. */
function fmtRollTime(ts) {
  if (typeof ts !== "number") return "";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function RollDrawerCard({ r }) {
  const rd = r.rollData || {};
  const el = rd.elemento && ELEMENTOS[rd.elemento] ? ELEMENTOS[rd.elemento] : null;
  const color = el ? el.accent : "#c9a84c";
  const isAttack = rd.kind === "attack";
  return (
    <div className="op-rollcard">
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        {r.userPhoto
          ? <img src={r.userPhoto} alt="" style={{ width:24, height:24, borderRadius:"50%", objectFit:"cover", border:`1px solid ${color}` }} />
          : <span style={{ width:24, height:24, borderRadius:"50%", display:"inline-flex", alignItems:"center", justifyContent:"center", background:`${color}22`, border:`1px solid ${color}`, fontSize:11, color }}>{(rd.charName||r.userName||"?").slice(0,1).toUpperCase()}</span>}
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rd.charName || r.userName}</span>
      </div>
      <div style={{ border:`1px solid ${color}`, background:`${color}14`, borderRadius:6, padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          {el && <ElementoSymbol id={rd.elemento} size={16} />}
          <span style={{ fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:13, color, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rd.name || rd.expr}</span>
          {rd.crit && <span style={{ marginLeft:"auto", fontSize:9, fontFamily:"'Share Tech Mono',monospace", color:"#ffe86a", letterSpacing:"0.1em", flexShrink:0 }}>CRÍTICO</span>}
        </div>
        {isAttack ? (
          <div style={{ display:"flex" }}>
            <div style={{ flex:1, textAlign:"center", borderRight:`1px solid ${color}40` }}>
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:34, color, lineHeight:1 }}>{rd.total}</div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:8, letterSpacing:"0.15em", textTransform:"uppercase", color:"var(--muted)", marginTop:3 }}>Ataque</div>
            </div>
            <div style={{ flex:1, textAlign:"center" }}>
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:34, color:"#fff", lineHeight:1 }}>{rd.dano ?? "—"}</div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:8, letterSpacing:"0.15em", textTransform:"uppercase", color:"var(--muted)", marginTop:3 }}>Dano</div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:48, color, lineHeight:1 }}>{rd.total}</div>
          </div>
        )}
        {Array.isArray(rd.rolls) && rd.rolls.length > 0 && (
          <div style={{ marginTop:8, textAlign:"center", fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--muted2)" }}>[{rd.rolls.join(" · ")}]</div>
        )}
      </div>
      <div style={{ textAlign:"right", marginTop:4, fontFamily:"var(--font-body,'Crimson Pro',serif)", fontStyle:"italic", fontSize:11, color:"var(--muted)" }}>{fmtRollTime(r.timestamp)}</div>
    </div>
  );
}

function CampaignRollDrawer({ campaign, onClose }) {
  const [rolls, setRolls] = useState([]);

  useEffect(() => {
    if (!campaign?.id) return;
    const unsub = messagesRepo.watchRolls(campaign.id, 80, list => {
      const cutoff = messagesRepo.ttlCutoffMillis();
      setRolls(list
        // epoch-ms (spec 0032 AC-5); antes esta tela lia `.seconds` do `Timestamp` do SDK.
        .filter(d => (d.timestamp ?? 0) > cutoff)
        .sort((a,b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
        .slice(0, 50));
    });
    return unsub;
  }, [campaign?.id]);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const drawerVars = { "--el-accent":"#c9a84c", "--el-border":"rgba(201,168,76,0.40)", "--el-glow":"rgba(201,168,76,0.45)" };

  return createPortal(
    <>
      <div className="op-drawer-overlay" onClick={onClose} />
      <div className="op-roll-drawer" style={drawerVars} role="dialog" aria-label="Histórico de rolagens da campanha">
        <div className="op-roll-drawer-head">
          <div style={{ minWidth:0 }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{campaign.name}</div>
            <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:17, color:"var(--gold2)" }}>Resultados <span style={{ color:"var(--muted)" }}>[{rolls.length}]</span></div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background:"none", border:"none", color:"var(--muted2)", fontSize:24, cursor:"pointer", lineHeight:1, flexShrink:0 }}>×</button>
        </div>
        <div className="op-roll-drawer-body">
          {rolls.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 14px", color:"rgba(232,228,217,0.4)", fontStyle:"italic", fontFamily:"var(--font-body,'Crimson Pro',serif)", fontSize:14, lineHeight:1.6 }}>
              Nenhuma rolagem registrada ainda.<br/>As rolagens da campanha aparecem aqui em tempo real.
            </div>
          ) : rolls.map(r => <RollDrawerCard key={r.id} r={r} />)}
        </div>
      </div>
    </>,
    document.body
  );
}

export default CampaignRollDrawer;
