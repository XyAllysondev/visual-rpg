import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import CoverPreviewModal from "./CoverPreviewModal";
import { resizeCoverImage } from "./campanhaHelpers";

function CreateCampaignModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [system, setSystem] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const coverInputRef = useRef(null);

  const handleCoverFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCoverLoading(true);
    try { setCoverPreview(await resizeCoverImage(file)); } catch(_) {}
    setCoverLoading(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("Digite o nome da campanha."); return; }
    setLoading(true); setError("");
    const ok = await onCreate({ name:name.trim(), description:desc.trim(), system:system.trim()||"Genérico", maxPlayers, coverImage });
    if (ok?.limitError) { setError(ok.limitError); setLoading(false); return; }
    if (!ok) setError("Erro ao criar campanha. Verifique sua conexão e as regras do Firestore.");
    setLoading(false);
  };

  return (
    <>
    {coverPreview && <CoverPreviewModal image={coverPreview} onConfirm={(img)=>{setCoverImage(img);setCoverPreview(null);}} onClose={()=>setCoverPreview(null)}/>}
    {createPortal(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"28px",width:"100%",maxWidth:440,display:"flex",flexDirection:"column",gap:20,boxShadow:"0 24px 64px rgba(0,0,0,0.48)"}}>
        <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:18,background:"linear-gradient(135deg,#b030d8,#c8a8f0)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
          Nova Campanha
        </div>
        {error && <div style={{padding:"10px 14px",background:"rgba(139,32,32,0.18)",border:"1px solid rgba(139,32,32,0.4)",borderRadius:6,fontFamily:"Cinzel,serif",fontSize:11,color:"#e07070",letterSpacing:1}}>{error}</div>}

        {/* Cover image picker */}
        <input ref={coverInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files?.[0]&&handleCoverFile(e.target.files[0])}/>
        <div
          onClick={()=>coverInputRef.current?.click()}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{e.preventDefault();e.dataTransfer.files?.[0]&&handleCoverFile(e.dataTransfer.files[0]);}}
          style={{position:"relative",width:"100%",height:140,borderRadius:10,overflow:"hidden",cursor:"pointer",border:`2px dashed ${coverImage?"transparent":"rgba(176,48,216,0.3)"}`,background:coverImage?"transparent":"rgba(176,48,216,0.04)",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6}}
          onMouseEnter={e=>{if(!coverImage)e.currentTarget.style.borderColor="rgba(176,48,216,0.6)";}}
          onMouseLeave={e=>{if(!coverImage)e.currentTarget.style.borderColor="rgba(176,48,216,0.3)";}}>
          {coverImage
            ? <>
                <img src={coverImage} alt="capa" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
                <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:0,transition:"opacity 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                  onMouseLeave={e=>e.currentTarget.style.opacity="0"}>
                  <span style={{color:"#fff",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1}}>Trocar imagem</span>
                  <button onClick={e=>{e.stopPropagation();setCoverImage(null);}} style={{background:"rgba(139,32,32,0.6)",border:"1px solid rgba(255,100,100,0.4)",borderRadius:4,color:"#ff9090",cursor:"pointer",fontSize:10,padding:"3px 8px",fontFamily:"Cinzel,serif",letterSpacing:0.5}}>Remover</button>
                </div>
              </>
            : coverLoading
              ? <div style={{width:22,height:22,border:"2px solid rgba(176,48,216,0.3)",borderTopColor:"#b030d8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
              : <>
                  <div style={{fontSize:28,opacity:0.4}}>🖼</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(176,48,216,0.7)",letterSpacing:1}}>Clique ou arraste uma imagem de capa</div>
                  <div style={{fontSize:11,color:"var(--muted)"}}>JPG, PNG, WEBP</div>
                </>
          }
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Nome da Campanha *</div>
            <input value={name} onChange={e=>setName(e.target.value)} maxLength={60} placeholder="Ex: Marcas Fragmentadas" autoFocus/>
          </div>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Descrição</div>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} maxLength={300} placeholder="Uma breve descrição da campanha..." rows={3}
              style={{resize:"vertical",fontFamily:"'Crimson Pro',serif",fontSize:15,background:"var(--card2)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text)",outline:"none",padding:"11px 14px",width:"100%",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Sistema</div>
              <input value={system} onChange={e=>setSystem(e.target.value)} placeholder="Ordem Paranormal..." maxLength={40}/>
            </div>
            <div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Máx. Jogadores</div>
              <input type="number" value={maxPlayers} onChange={e=>setMaxPlayers(Math.max(2,Math.min(20,+e.target.value||6)))} min={2} max={20}/>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} className="btn-ghost" style={{flex:1,padding:"10px 0"}}>Cancelar</button>
          <button onClick={handleCreate} disabled={loading||!name.trim()} className="btn-gold" style={{flex:1,padding:"10px 0",opacity:loading||!name.trim()?0.5:1}}>
            {loading?"Criando...":"Criar Campanha"}
          </button>
        </div>
      </div>
    </div>
  , document.body)}
  </>
  );
}

export default CreateCampaignModal;
