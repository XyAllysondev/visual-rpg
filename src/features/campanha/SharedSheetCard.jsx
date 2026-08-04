import { getActiveAvatar } from "../../domain/character";
import { nexStats } from "../../lib/nexStats";

function SharedSheetCard({ sheet, uid, isMaster, onView, onRemove }) {
  const canRemove = uid===sheet.ownerId||isMaster;
  const char = sheet.characterData;
  const cs = char?.attrs
    ? nexStats(char.nex ?? 5, char.classe?.id, char.attrs)
    : { pv: 0, san: 0 };
  const pvVal  = char?.pv  ?? cs.pv;
  const sanVal = char?.san ?? cs.san;
  return (
    <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:"16px",display:"flex",flexDirection:"column",gap:12,position:"relative",overflow:"hidden"}}>
      {sheet.isLive && (
        <div style={{position:"absolute",top:10,right:10,padding:"2px 7px",borderRadius:3,background:"rgba(106,170,122,0.14)",border:"1px solid rgba(106,170,122,0.3)",fontFamily:"Cinzel,serif",fontSize:7,letterSpacing:1,color:"#6aaa7a",textTransform:"uppercase",display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"#6aaa7a",animation:"pulse 2s infinite"}}/>Ao Vivo
        </div>
      )}
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <div style={{width:48,height:48,borderRadius:8,background:"rgba(176,48,216,0.1)",border:"1px solid rgba(176,48,216,0.22)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,fontSize:22}}>
          {getActiveAvatar(char)?<img src={getActiveAvatar(char)} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🕵️"}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:14,color:"var(--text)",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sheet.characterName}</div>
          <div style={{fontFamily:"'Crimson Pro',serif",fontSize:13,color:"var(--muted2)"}}>{char?.classe?.name||"—"}</div>
        </div>
      </div>
      {char && (
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[
            {label:"PV",  val: String(pvVal),          color:"#e07070"},
            {label:"SAN", val: String(sanVal),          color:"#70a0e0"},
            {label:"NEX", val: `${char.nex ?? 5}%`,    color:"var(--gold)"},
          ].map(s=>(
            <div key={s.label} style={{padding:"3px 8px",borderRadius:4,background:"rgba(255,255,255,0.04)",border:"1px solid var(--border)"}}>
              <span style={{fontFamily:"Cinzel,serif",fontSize:8,color:s.color,letterSpacing:1}}>{s.label} </span>
              <span style={{fontFamily:"Cinzel,serif",fontSize:11,color:"var(--text)"}}>{s.val}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"flex",gap:8}}>
        <button onClick={onView} className="btn-ghost" style={{flex:1,padding:"7px 0",fontSize:9}}>Ver Ficha</button>
        {canRemove && (
          <button onClick={onRemove} style={{padding:"7px 12px",borderRadius:4,background:"rgba(139,32,32,0.1)",border:"1px solid rgba(139,32,32,0.28)",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,color:"#e07070",textTransform:"uppercase",transition:"all 0.2s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(139,32,32,0.24)"}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(139,32,32,0.1)"}}>
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

export default SharedSheetCard;
