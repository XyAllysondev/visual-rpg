import { useState, useRef } from "react";
import * as campaignsRepo from "../../infrastructure/firestore/campaignsRepo";
import CoverPreviewModal from "./CoverPreviewModal";
import { generateInviteCode, resizeCoverImage } from "./campanhaHelpers";

function MasterSettings({ campaign, onBack, isMaster=true }) {
  const [name, setName] = useState(campaign.name);
  const [system, setSystem] = useState(campaign.system||"");
  const [desc, setDesc] = useState(campaign.description||"");
  const [maxPlayers, setMaxPlayers] = useState(campaign.maxPlayers||6);
  const [coverImage, setCoverImage] = useState(campaign.coverImage||null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const coverInputRef = useRef(null);

  const showMsg = (text) => { setMsg(text); setTimeout(()=>setMsg(""),2500); };

  const handleCoverFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCoverLoading(true);
    try { setCoverPreview(await resizeCoverImage(file)); } catch(_) {}
    setCoverLoading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await campaignsRepo.update(campaign.id,{name:name.trim(),system:system.trim(),description:desc.trim(),maxPlayers,coverImage:coverImage||null}); showMsg("Salvo com sucesso!"); }
    catch(e) { showMsg("Erro ao salvar."); }
    setSaving(false);
  };

  const handleRegenCode = async () => {
    if (!window.confirm("Regenerar o código invalida o código atual. Continuar?")) return;
    const code = generateInviteCode();
    try { await campaignsRepo.update(campaign.id,{inviteCode:code}); showMsg(`Novo código: ${code}`); }
    catch(e) { showMsg("Erro."); }
  };

  const handleArchive = async () => {
    if (!window.confirm(campaign.isActive?"Arquivar a campanha?":"Reativar a campanha?")) return;
    try { await campaignsRepo.update(campaign.id,{isActive:!campaign.isActive}); onBack(); }
    catch(e) { console.error("[campanha] falha ao arquivar:", e); showMsg("Erro ao arquivar a campanha. Tente de novo."); }
  };

  return (
    <>
    {coverPreview && <CoverPreviewModal image={coverPreview} onConfirm={(img)=>{setCoverImage(img);setCoverPreview(null);}} onClose={()=>setCoverPreview(null)}/>}
    {/* O campo "Nome" tinha 1652 px para um texto de 16 caracteres. Um formulário
        de 1652 px não é espaçoso — é ilegível. 880 é a coluna de leitura. */}
    <div style={{overflowY:"auto",minHeight:0,padding:"16px 4px 28px",maxWidth:880,width:"100%",display:"flex",flexDirection:"column",gap:20}}>
      <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase",paddingBottom:6,borderBottom:"1px solid var(--border)"}}>
        Configurações da Campanha
      </div>
      {msg && (
        <div style={{padding:"10px 14px",background:"rgba(106,170,122,0.14)",border:"1px solid rgba(106,170,122,0.3)",borderRadius:6,fontFamily:"Cinzel,serif",fontSize:11,color:"#6aaa7a",letterSpacing:1}}>
          {msg}
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Cover image */}
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Imagem de Capa</div>
          <input ref={coverInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files?.[0]&&handleCoverFile(e.target.files[0])}/>
          <div
            onClick={()=>coverInputRef.current?.click()}
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{e.preventDefault();e.dataTransfer.files?.[0]&&handleCoverFile(e.dataTransfer.files[0]);}}
            style={{position:"relative",width:"100%",height:120,borderRadius:8,overflow:"hidden",cursor:"pointer",border:`2px dashed ${coverImage?"transparent":"rgba(176,48,216,0.3)"}`,background:coverImage?"transparent":"rgba(176,48,216,0.04)",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:4}}>
            {coverImage
              ? <>
                  <img src={coverImage} alt="capa" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
                  <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:0,transition:"opacity 0.2s"}}
                    onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                    onMouseLeave={e=>e.currentTarget.style.opacity="0"}>
                    <span style={{color:"#fff",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1}}>Trocar</span>
                    <button onClick={e=>{e.stopPropagation();setCoverImage(null);}} style={{background:"rgba(139,32,32,0.6)",border:"1px solid rgba(255,100,100,0.4)",borderRadius:4,color:"#ff9090",cursor:"pointer",fontSize:9,padding:"2px 8px",fontFamily:"Cinzel,serif"}}>Remover</button>
                  </div>
                </>
              : coverLoading
                ? <div style={{width:20,height:20,border:"2px solid rgba(176,48,216,0.3)",borderTopColor:"#b030d8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                : <>
                    <span style={{fontSize:24,opacity:0.4}}>🖼</span>
                    <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(176,48,216,0.7)",letterSpacing:1}}>Clique ou arraste uma imagem</span>
                  </>
            }
          </div>
        </div>
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Nome</div>
          <input value={name} onChange={e=>setName(e.target.value)} maxLength={60}/>
        </div>
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Sistema</div>
          <input value={system} onChange={e=>setSystem(e.target.value)} maxLength={40} placeholder="ex: Ordem Paranormal, D&D 5e, Tormenta 20…"/>
        </div>
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Descrição</div>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} maxLength={300} rows={3}
            style={{resize:"vertical",fontFamily:"'Crimson Pro',serif",fontSize:15,background:"var(--card2)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text)",outline:"none",padding:"11px 14px",width:"100%",boxSizing:"border-box"}}/>
        </div>
        <div style={{width:100}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Máx. Jogadores</div>
          <input type="number" value={maxPlayers} onChange={e=>setMaxPlayers(Math.max(2,Math.min(20,+e.target.value||6)))} min={2} max={20}/>
        </div>
      </div>
      <button onClick={handleSave} disabled={saving||!name.trim()} className="btn-gold" style={{alignSelf:"flex-start",padding:"9px 22px",opacity:saving||!name.trim()?0.5:1}}>
        {saving?"Salvando...":"Salvar Alterações"}
      </button>
      {/* Ações exclusivas do Mestre — admin não tem acesso */}
      {isMaster && (
        <div style={{display:"flex",flexDirection:"column",gap:12,paddingTop:16,borderTop:"1px solid var(--border)"}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>
            Ações do Mestre
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button onClick={handleRegenCode} className="btn-ghost" style={{padding:"9px 18px",fontSize:9}}>
              🔄 Regenerar Código de Convite
            </button>
            <button onClick={handleArchive} style={{
              padding:"9px 18px",borderRadius:4,cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,textTransform:"uppercase",
              background:campaign.isActive?"rgba(139,32,32,0.1)":"rgba(106,170,122,0.1)",
              border:campaign.isActive?"1px solid rgba(139,32,32,0.3)":"1px solid rgba(106,170,122,0.3)",
              color:campaign.isActive?"#e07070":"#6aaa7a",transition:"all 0.2s",
            }}>
              {campaign.isActive?"📁 Arquivar Campanha":"📂 Reativar Campanha"}
            </button>
          </div>
        </div>
      )}
      {!isMaster && (
        <div style={{padding:"10px 14px",background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:6,fontFamily:"Cinzel,serif",fontSize:10,color:"#c9a84c",letterSpacing:1}}>
          ★ Você é Admin — pode editar nome, descrição e configurações. Apenas o Mestre pode arquivar ou regenerar o código.
        </div>
      )}
    </div>
    </>
  );
}

export default MasterSettings;
