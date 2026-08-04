import { useState, useEffect } from "react";
import RollFeed from "./RollFeed";

function SheetRollPanel({ campaigns, uid, userName, userPhoto, onRollReady }) {
  const active = campaigns.filter(c => c.isActive !== false);
  const [selId, setSelId] = useState(() => active[0]?.id ?? null);
  const campaign = active.find(c => c.id === selId) ?? active[0] ?? null;

  useEffect(() => { onRollReady?.(campaign ?? null); }, [campaign?.id]);

  return (
    <div style={{
      width:284, flexShrink:0,
      background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8,
      display:"flex", flexDirection:"column",
      height:"calc(100vh - 150px)", position:"sticky", top:0, overflow:"hidden",
    }}>
      <div style={{padding:"10px 14px 9px", borderBottom:"1px solid var(--border)", flexShrink:0}}>
        <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"var(--muted)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Campanha</div>
        {active.length > 1 ? (
          <select value={selId??""} onChange={e=>setSelId(e.target.value)}
            style={{background:"transparent",border:"none",color:"var(--text)",fontFamily:"Cinzel,serif",fontSize:11,outline:"none",width:"100%",cursor:"pointer",appearance:"none"}}>
            {active.map(c=><option key={c.id} value={c.id} style={{background:"#2c2c39"}}>{c.name}</option>)}
          </select>
        ) : (
          <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            {campaign?.name ?? "Nenhuma campanha ativa"}
          </div>
        )}
      </div>
      {campaign
        ? <RollFeed campaignId={campaign.id} uid={uid}/>
        : <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:20,textAlign:"center",fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(255,255,255,0.2)",lineHeight:1.6}}>
            Entre em uma campanha<br/>para ver o histórico de dados
          </div>}
    </div>
  );
}

export default SheetRollPanel;
