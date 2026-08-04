function CampaignCard({ campaign, uid, onClick }) {
  const isMaster = campaign.masterId === uid;
  const memberCount = campaign.members?.length || 0;
  const hasCover = !!campaign.coverImage;

  if (hasCover) {
    return (
      <div onClick={onClick} style={{
        borderRadius:10,cursor:"pointer",transition:"all 0.2s",
        position:"relative",overflow:"hidden",
        border:"1px solid var(--border)",
        boxShadow:"0 4px 16px rgba(0,0,0,0.35)",
      }}
        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.55)";e.currentTarget.style.borderColor="rgba(176,48,216,0.45)";}}
        onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.35)";e.currentTarget.style.borderColor="var(--border)";}}>
        {/* Cover image */}
        <div style={{width:"100%",height:160,position:"relative",overflow:"hidden"}}>
          <img src={campaign.coverImage} alt={campaign.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%)"}}/>
          {/* Badges over image */}
          <div style={{position:"absolute",top:8,left:8,display:"flex",gap:6}}>
            <span style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:0.5,color:"rgba(255,255,255,0.85)",background:"rgba(0,0,0,0.55)",padding:"3px 8px",borderRadius:4}}>
              ◎ {memberCount}/{campaign.maxPlayers||6}
            </span>
          </div>
          {isMaster && (
            <div style={{position:"absolute",top:8,right:8,padding:"3px 8px",borderRadius:4,background:"rgba(176,48,216,0.7)",border:"1px solid rgba(176,48,216,0.5)",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#e8d0ff",textTransform:"uppercase"}}>
              Mestre
            </div>
          )}
          {/* Title over image */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"10px 14px 12px"}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:700,color:"#fff",lineHeight:1.3,textShadow:"0 1px 4px rgba(0,0,0,0.55)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {campaign.name}
            </div>
            {campaign.system && (
              <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,color:"rgba(255,220,100,0.9)",textTransform:"uppercase",marginTop:3}}>
                {campaign.system}
              </div>
            )}
          </div>
        </div>
        {/* Bottom info strip */}
        {(campaign.description || !campaign.isActive) && (
          <div style={{padding:"10px 14px",background:"var(--card)"}}>
            {campaign.description && (
              <div style={{fontFamily:"'Crimson Pro',serif",fontSize:13,color:"var(--muted2)",lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                {campaign.description}
              </div>
            )}
            {!campaign.isActive && (
              <span style={{padding:"2px 7px",borderRadius:3,background:"rgba(255,255,255,0.05)",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase",marginTop:6,display:"inline-block"}}>
                Arquivada
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div onClick={onClick} style={{
      background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,
      padding:"18px 18px 16px",cursor:"pointer",transition:"all 0.2s",
      position:"relative",overflow:"hidden",
    }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(176,48,216,0.45)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(176,48,216,0.14)";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,rgba(176,48,216,0.55),transparent)"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10}}>
        <div style={{fontFamily:"Cinzel,serif",fontSize:15,fontWeight:700,color:"var(--text)",flex:1,lineHeight:1.3}}>
          {campaign.name}
        </div>
        {isMaster && (
          <div style={{padding:"3px 8px",borderRadius:4,background:"rgba(176,48,216,0.15)",border:"1px solid rgba(176,48,216,0.3)",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#c8a8f0",textTransform:"uppercase",flexShrink:0}}>
            Mestre
          </div>
        )}
      </div>
      {campaign.description && (
        <div style={{fontFamily:"'Crimson Pro',serif",fontSize:14,color:"var(--muted2)",marginBottom:12,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
          {campaign.description}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {campaign.system && (
          <span style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,color:"var(--gold)",textTransform:"uppercase"}}>{campaign.system}</span>
        )}
        <span style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,color:"var(--muted)"}}>◎ {memberCount}/{campaign.maxPlayers||6}</span>
        {!campaign.isActive && (
          <span style={{padding:"2px 7px",borderRadius:3,background:"rgba(255,255,255,0.05)",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase"}}>
            Arquivada
          </span>
        )}
      </div>
    </div>
  );
}

export default CampaignCard;
