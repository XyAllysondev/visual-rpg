import { useState } from "react";
import { createPortal } from "react-dom";

function JoinCampaignModal({ onClose, onJoin }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (code.trim().length < 6) { setError("Código deve ter 6 caracteres."); return; }
    setLoading(true); setError("");
    const result = await onJoin(code.trim());
    setLoading(false);
    if (result?.error) setError(result.error);
  };

  return createPortal(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"28px",width:"100%",maxWidth:360,display:"flex",flexDirection:"column",gap:20,boxShadow:"0 24px 64px rgba(0,0,0,0.48)"}}>
        <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:18,background:"linear-gradient(135deg,#b030d8,#c8a8f0)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
          Entrar em Campanha
        </div>
        <div style={{fontFamily:"'Crimson Pro',serif",fontSize:15,color:"var(--muted2)",lineHeight:1.65}}>
          Insira o código de convite de 6 caracteres fornecido pelo Mestre.
        </div>
        {error && <div style={{padding:"10px 14px",background:"rgba(139,32,32,0.18)",border:"1px solid rgba(139,32,32,0.4)",borderRadius:6,fontFamily:"Cinzel,serif",fontSize:11,color:"#e07070",letterSpacing:1}}>{error}</div>}
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Código de Convite</div>
          <input
            value={code}
            onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6))}
            placeholder="EX: AB12CD"
            style={{textAlign:"center",fontSize:22,letterSpacing:8,fontFamily:"Cinzel,serif"}}
            autoFocus
            onKeyDown={e=>{if(e.key==="Enter"&&code.length===6)handleJoin();}}
          />
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} className="btn-ghost" style={{flex:1,padding:"10px 0"}}>Cancelar</button>
          <button onClick={handleJoin} disabled={loading||code.length<6} className="btn-gold" style={{flex:1,padding:"10px 0",opacity:loading||code.length<6?0.5:1}}>
            {loading?"Entrando...":"Entrar"}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

export default JoinCampaignModal;
