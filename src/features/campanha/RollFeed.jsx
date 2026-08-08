import { useState, useEffect } from "react";
import * as messagesRepo from "../../infrastructure/firestore/messagesRepo";

function RollFeed({ campaignId, uid }) {
  const [rolls, setRolls] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(()=>{
    messagesRepo.deleteExpired(campaignId);
    const unsub = messagesRepo.watchRolls(campaignId, 80, list=>{
      const cutoff = messagesRepo.ttlCutoffMillis();
      // `timestamp` é epoch-ms desde a spec 0032 (AC-5) — antes era o `Timestamp` do SDK e
      // esta tela fazia `.seconds * 1000`. Rolagem sem carimbo do servidor ainda (escrita
      // otimista) chega `null` e cai fora do corte, como já caía com `?? 0`.
      setRolls(list
        .filter(d=>(d.timestamp??0) > cutoff)
        .sort((a,b)=>(b.timestamp??0)-(a.timestamp??0)));
    });
    return unsub;
  },[campaignId]);

  const shown = filter==="mine" ? rolls.filter(r=>r.userId===uid) : rolls;

  const fmtTime = (ts) => {
    if (typeof ts !== "number") return "";
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* filter bar */}
      <div style={{display:"flex",gap:8,padding:"12px 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
        {[["all","Todos"],["mine","Meus"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{
            padding:"5px 16px",borderRadius:6,border:"1px solid",cursor:"pointer",
            fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,transition:"all 0.18s",
            background:filter===v?"#7c3aed":"transparent",
            borderColor:filter===v?"#7c3aed":"rgba(255,255,255,0.12)",
            color:filter===v?"#fff":"rgba(255,255,255,0.5)",
          }}>{l}</button>
        ))}
        <span style={{marginLeft:"auto",fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(255,255,255,0.3)",alignSelf:"center",letterSpacing:1}}>
          {shown.length} rolagem{shown.length!==1?"s":""}
        </span>
      </div>
      {/* cards */}
      <div style={{flex:1,overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
        {shown.length===0 && (
          <div style={{textAlign:"center",color:"rgba(255,255,255,0.25)",fontFamily:"Cinzel,serif",fontSize:11,paddingTop:32}}>
            Nenhuma rolagem ainda.<br/>Use /2d6+3 no chat ou role pela ficha.
          </div>
        )}
        {shown.map(r=>{
          const rd = r.rollData || {};
          const rolls = rd.rolls || [];
          const expr  = rd.expr || r.content?.match(/rolou (.+?) →/i)?.[1] || "?";
          const total = rd.total ?? "?";
          return (
            <div key={r.id} style={{border:"1px solid rgba(124,58,237,0.35)",borderRadius:8,padding:"11px 13px",background:"rgba(124,58,237,0.06)"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"rgba(255,255,255,0.85)",marginBottom:8,fontWeight:600}}>{r.userName}</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:38,height:38,background:"#7c3aed",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#fff",fontWeight:600,marginBottom:2}}>Resultado</div>
                  {rolls.length>0 && <div style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>[{rolls.join(", ")}]</div>}
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{expr}</div>
                </div>
                <div style={{fontSize:26,fontWeight:700,color:"#fff",flexShrink:0}}>= {total}</div>
              </div>
              <div style={{textAlign:"right",fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:6,fontFamily:"Cinzel,serif"}}>{fmtTime(r.timestamp)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RollFeed;
