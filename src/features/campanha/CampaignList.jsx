import CampaignCard from "./CampaignCard";

function CampaignList({ uid, userName, campaigns, loading, onOpenCampaign, onCreateCampaign, onJoinCampaign }) {
  const active = campaigns.filter(c=>c.isActive);
  const archived = campaigns.filter(c=>!c.isActive);
  const masterActive = active.filter(c=>c.masterId===uid);

  if (loading) return (
    <div className="fade" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:320}}>
      <div style={{width:32,height:32,border:"2px solid rgba(176,48,216,0.3)",borderTopColor:"#b030d8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    </div>
  );

  return (
    <div className="fade nx-page">
      {/* Mesmo cabeçalho do painel. Antes o título era "Campanhas: 0/3" com
          "Campanhas:" em degradê roxo e o "0/3" em branco puro — dois estilos
          numa frase de duas palavras, e a cota colada no título. A cota vira
          um número na faixa abaixo, onde números moram. */}
      <div className="nx-head">
        <div className="nx-head-txt">
          <div className="nx-eyebrow">Modo multijogador</div>
          <h1 className="nx-h1">Campanhas</h1>
          <p className="nx-sub">Mesas com chat, fichas compartilhadas, rolagens e mapas ao vivo.</p>
        </div>
        <div className="nx-head-actions">
          <button onClick={onJoinCampaign} className="nx-btn">Entrar com código</button>
          <button onClick={onCreateCampaign} className="btn-gold">+ Nova campanha</button>
        </div>
      </div>

      <div className="nx-stats" style={{"--nx-cols":3}}>
        <div className="nx-stat" style={{cursor:"default"}}>
          <span className="nx-stat-num">{masterActive.length}<span style={{color:"var(--muted)",fontSize:17}}>/3</span></span>
          <span className="nx-stat-cap">Como mestre</span>
        </div>
        <div className="nx-stat" style={{cursor:"default"}}>
          <span className="nx-stat-num">{active.length - masterActive.length}</span>
          <span className="nx-stat-cap">Como jogador</span>
        </div>
        <div className="nx-stat" style={{cursor:"default"}}>
          <span className="nx-stat-num">{archived.length}</span>
          <span className="nx-stat-cap">Arquivadas</span>
        </div>
      </div>

      {active.length===0&&archived.length===0 && (
        /* O vazio tinha um ◎ de 56px flutuando em loop, um degradê radial roxo,
           borda tracejada e OS MESMOS DOIS BOTÕES que já estão no cabeçalho —
           quatro botões para duas ações. Agora é texto alinhado à esquerda. */
        <div className="nx-empty">
          <div className="nx-empty-t">Nenhuma campanha</div>
          <p className="nx-empty-d">
            Crie uma campanha para mestrar a sua mesa, ou use o código de convite
            que o mestre te passou para entrar em uma existente.
          </p>
        </div>
      )}

      {active.length>0 && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="nx-sec"><span className="nx-sec-t">Ativas — {active.length}</span></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:16}}>
            {active.map(camp=>(
              <CampaignCard key={camp.id} campaign={camp} uid={uid} onClick={()=>onOpenCampaign(camp)}/>
            ))}
          </div>
        </div>
      )}

      {archived.length>0 && (
        <div style={{display:"flex",flexDirection:"column",gap:14,opacity:0.55}}>
          <div className="nx-sec"><span className="nx-sec-t">Arquivadas — {archived.length}</span></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:16}}>
            {archived.map(camp=>(
              <CampaignCard key={camp.id} campaign={camp} uid={uid} onClick={()=>onOpenCampaign(camp)}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CampaignList;
