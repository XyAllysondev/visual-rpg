import { useState } from "react";
import * as campaignsRepo from "../../infrastructure/firestore/campaignsRepo";

function MembersPanel({ campaign, uid, isMaster }) {
  const memberIds   = campaign.members||[];
  const memberNames = campaign.memberNames||{};
  const admins      = campaign.admins||[];
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard?.writeText(campaign.inviteCode).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };

  const toggleAdmin = async (memberId, isAdminNow) => {
    await campaignsRepo.setAdmin(campaign.id, memberId, !isAdminNow)
      .catch((e)=>console.error("[campanha] alternar admin falhou:", e));
  };

  return (
    /* Teto de leitura. Cada linha de membro tinha 1650 px para um nome de 200:
       os botões "Admin/Remover" ficavam a 1400 px do nome a que pertencem, e o
       olho não fechava a associação. Isso não é espaço, é dispersão. */
    <div style={{overflowY:"auto",minHeight:0,padding:"16px 4px 28px",maxWidth:880,width:"100%",display:"flex",flexDirection:"column",gap:12}}>
      {isMaster && (
        <div style={{padding:"14px 16px",background:"var(--card)",border:"1px solid rgba(176,48,216,0.3)",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:4}}>Código de Convite</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:24,letterSpacing:10,color:"#c8a8f0",userSelect:"all"}}>{campaign.inviteCode}</div>
          </div>
          <button onClick={copyCode} className="btn-ghost" style={{padding:"7px 16px",fontSize:9}}>
            {copied?"✓ Copiado":"Copiar Código"}
          </button>
        </div>
      )}
      <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase",paddingBottom:6,borderBottom:"1px solid var(--border)"}}>
        Membros — {memberIds.length}/{campaign.maxPlayers||6}
      </div>
      {memberIds.map(memberId=>{
        const isSelf        = memberId===uid;
        const isMasterMember= memberId===campaign.masterId;
        const isAdminMember = admins.includes(memberId);
        const name          = memberNames[memberId]||"Agente";
        return (
          <div key={memberId} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:"var(--card)",borderRadius:8,border:"1px solid var(--border)"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,rgba(176,48,216,0.28),rgba(176,48,216,0.08))",border:"1px solid rgba(176,48,216,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Cinzel,serif",fontSize:14,color:"#c8a8f0",flexShrink:0}}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {name}{isSelf&&" (você)"}
              </div>
              <div style={{display:"flex",gap:6,marginTop:2}}>
                {isMasterMember && <span style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#c8a8f0",textTransform:"uppercase"}}>◉ Mestre</span>}
                {isAdminMember && !isMasterMember && <span style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#c9a84c",textTransform:"uppercase"}}>★ Admin</span>}
              </div>
            </div>
            {/* Botão Admin — só mestre pode promover/rebaixar (nunca aplica no próprio mestre) */}
            {isMaster && !isMasterMember && (
              <button onClick={()=>toggleAdmin(memberId, isAdminMember)}
                style={{padding:"4px 8px",borderRadius:4,background: isAdminMember?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${isAdminMember?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.12)"}`,cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color: isAdminMember?"#c9a84c":"var(--muted)",textTransform:"uppercase",transition:"all 0.2s"}}
                title={isAdminMember?"Remover Admin":"Tornar Admin"}>
                {isAdminMember?"★ Admin":"☆ Admin"}
              </button>
            )}
            {/* Botão Remover — só mestre pode remover players (nunca o mestre) */}
            {isMaster && !isMasterMember && (
              <button onClick={async()=>{if(window.confirm(`Remover ${name} da campanha?`)){await campaignsRepo.removeMember(campaign.id, memberId);}}}
                style={{padding:"5px 10px",borderRadius:4,background:"rgba(139,32,32,0.1)",border:"1px solid rgba(139,32,32,0.25)",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#e07070",textTransform:"uppercase",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(139,32,32,0.22)"}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(139,32,32,0.1)"}}>
                Remover
              </button>
            )}
            {/* Botão Sair — apenas para players não-mestre (o mestre NUNCA pode ser expulso, só sai) */}
            {isSelf && !isMasterMember && (
              <button onClick={async()=>{if(window.confirm("Sair desta campanha?")){await campaignsRepo.removeMember(campaign.id, uid);}}}
                style={{padding:"5px 10px",borderRadius:4,background:"rgba(139,32,32,0.1)",border:"1px solid rgba(139,32,32,0.25)",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#e07070",textTransform:"uppercase",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(139,32,32,0.22)"}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(139,32,32,0.1)"}}>
                Sair
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MembersPanel;
