function ChatMessage({ msg, uid, formatTime }) {
  const isOwn = msg.userId === uid;
  const isSystem = msg.type === "system";
  const isRoll = msg.type === "roll";

  if (isSystem) return (
    <div style={{textAlign:"center",padding:"10px 0",margin:"2px 0"}}>
      <span style={{
        fontFamily:"'Crimson Pro',serif",fontSize:14,
        color:"rgba(210,190,230,0.75)",fontStyle:"italic",
        padding:"5px 18px",
        background:"rgba(176,48,216,0.08)",
        borderRadius:20,border:"1px solid rgba(176,48,216,0.16)"
      }}>
        {msg.content}
      </span>
    </div>
  );

  return (
    <div style={{display:"flex",gap:10,alignItems:"flex-start",padding:"2px 6px",flexDirection:isOwn?"row-reverse":"row"}}>
      <div style={{
        width:36,height:36,borderRadius:"50%",flexShrink:0,
        background: isOwn
          ? "linear-gradient(135deg,rgba(176,48,216,0.55),rgba(110,30,180,0.45))"
          : "linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.07))",
        border: isOwn
          ? "1.5px solid rgba(200,110,255,0.55)"
          : "1.5px solid rgba(255,255,255,0.18)",
        display:msg.grouped?"block":"flex",alignItems:"center",justifyContent:"center",
        fontFamily:"Cinzel,serif",fontSize:14,fontWeight:600,color:"#e8d4ff",
        overflow:"hidden",opacity:msg.grouped?0:1,pointerEvents:"none",
      }}>
        {!msg.grouped && (msg.userPhoto
          ? <img src={msg.userPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          : <span>{msg.userName?.charAt(0)?.toUpperCase()||"?"}</span>)}
      </div>
      <div style={{maxWidth:"74%",display:"flex",flexDirection:"column",gap:3,alignItems:isOwn?"flex-end":"flex-start"}}>
        {!msg.grouped && (
          <div style={{display:"flex",gap:8,alignItems:"baseline",padding:"0 5px",flexDirection:isOwn?"row-reverse":"row"}}>
            {!isOwn && (
              <span style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:0.5,color:"#c4a8e0",fontWeight:600}}>
                {msg.userName}
              </span>
            )}
            <span style={{fontFamily:"'Crimson Pro',serif",fontSize:11,color:"rgba(200,180,220,0.42)"}}>
              {formatTime(msg.timestamp)}
            </span>
          </div>
        )}
        <div style={{
          padding:isRoll?"11px 15px":"9px 14px",
          borderRadius:isOwn?"14px 3px 14px 14px":"3px 14px 14px 14px",
          background: isRoll
            ? "rgba(110,50,190,0.28)"
            : isOwn
              ? "rgba(148,52,210,0.40)"
              : "rgba(255,255,255,0.10)",
          border: isRoll
            ? "1px solid rgba(176,48,216,0.50)"
            : isOwn
              ? "1px solid rgba(190,100,255,0.42)"
              : "1px solid rgba(255,255,255,0.14)",
          fontFamily:isRoll?"Cinzel,serif":"'Crimson Pro',serif",
          fontSize:isRoll?13:17,
          color:isOwn?"#f0e0ff":"#ede5f8",
          lineHeight:1.6,wordBreak:"break-word",
          boxShadow: isOwn
            ? "0 2px 8px rgba(120,40,200,0.22)"
            : "0 1px 4px rgba(0,0,0,0.18)",
        }}>
          {isRoll ? (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={{fontSize:9,letterSpacing:1.5,opacity:0.65,textTransform:"uppercase",color:"#c8a8f0"}}>🎲 Rolagem</span>
              <span style={{fontSize:16,color:"#ecdcff"}}>{msg.content.replace(/\*\*/g,"")}</span>
              {msg.rollData && (
                <span style={{fontSize:12,opacity:0.65,fontFamily:"'Crimson Pro',serif",color:"#bca8dc"}}>
                  [{msg.rollData.rolls?.join(", ")}]{msg.rollData.mod!==0?` ${msg.rollData.mod>0?"+":""}${msg.rollData.mod}`:""}
                </span>
              )}
            </div>
          ) : msg.content}
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;
