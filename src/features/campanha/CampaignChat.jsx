import { useState, useEffect, useRef } from "react";
import * as messagesRepo from "../../infrastructure/firestore/messagesRepo";
import { rollDice } from "../../domain/dice";
import ChatMessage from "./ChatMessage";
import { fsSendMessage } from "./campanhaApi";

function CampaignChat({ campaignId, uid, userName, userPhoto, isMaster }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [clearing, setClearing] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const LIMIT = 50;

  const clearAllMessages = async () => {
    if (!window.confirm("Apagar todas as mensagens do chat? Esta ação não pode ser desfeita.")) return;
    setClearing(true);
    try {
      await messagesRepo.clearAll(campaignId);
    } catch(e) { console.error(e); }
    setClearing(false);
  };

  useEffect(() => {
    setLoading(true);
    setChatError("");
    messagesRepo.deleteExpired(campaignId);
    const unsub = messagesRepo.watchRecent(campaignId, LIMIT, ({ messages: page, cursor, hasMore: more }) => {
      // A query já corta pelo TTL, mas o filtro em memória fica: mensagem gravada com
      // `serverTimestamp()` chega ao cliente que a enviou com `timestamp` ainda nulo
      // (escrita otimista), e sem este `?? Date.now()` ela sumiria por um instante.
      // `timestamp` é epoch-ms desde a spec 0032 (AC-5) — o repo normaliza, a tela só compara.
      const cutoff = messagesRepo.ttlCutoffMillis();
      setMessages(page.filter(d => (d.timestamp ?? Date.now()) >= cutoff));
      if (cursor) setLastDoc(cursor);
      setHasMore(more);
      setLoading(false);
      setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:"smooth"}),60);
    }, () => {
      setLoading(false);
      setChatError("Não foi possível carregar o chat. Verifique as regras do Firestore (firebase deploy --only firestore:rules).");
    });
    return unsub;
  }, [campaignId]);

  useEffect(() => {
    const unsub = messagesRepo.watchTyping(campaignId, list => {
      const now = Date.now();
      // `updatedAt` também chega em epoch-ms (spec 0032 AC-5); `?? 0` mantém o efeito antigo
      // de considerar EXPIRADO quem ainda não tem carimbo do servidor.
      setTypingUsers(list.filter(u=>u.id!==uid&&u.isTyping&&(now-(u.updatedAt??0))<5000));
    });
    return () => { unsub(); messagesRepo.setTyping(campaignId,uid,userName,false); };
  }, [campaignId,uid,userName]);

  const handleInput = (e) => {
    setInput(e.target.value);
    messagesRepo.setTyping(campaignId,uid,userName,true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(()=>messagesRepo.setTyping(campaignId,uid,userName,false),3000);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    clearTimeout(typingTimeoutRef.current);
    messagesRepo.setTyping(campaignId,uid,userName,false);
    if (text.startsWith("/roll ")||text.startsWith("/r ")||/^\/\d+d\d+([+-]\d+)?$/i.test(text)) {
      const expr = (text.startsWith("/roll ")||text.startsWith("/r "))
        ? text.replace(/^\/(roll|r)\s+/,"")
        : text.slice(1);
      const result = rollDice(expr);
      if (result) {
        await fsSendMessage(campaignId,uid,userName,userPhoto,
          `Rolou ${result.expr} → [${result.rolls.join(", ")}]${result.mod!==0?(result.mod>0?` + ${result.mod}`:` - ${Math.abs(result.mod)}`):"" } = ${result.total}`,
          "roll", result);
      } else {
        await fsSendMessage(campaignId,"system","Sistema",null,"Expressão inválida. Use: /1d20+5","system",null);
      }
      return;
    }
    await fsSendMessage(campaignId,uid,userName,userPhoto,text,"text",null);
  };

  const loadMore = async () => {
    if (!lastDoc||!hasMore) return;
    // `lastDoc` é um cursor OPACO devolvido pelo repositório (spec 0029 AC-3) — a tela
    // não sabe (nem precisa saber) que por baixo é um snapshot do Firestore.
    const { messages: older, cursor } = await messagesRepo.loadOlder(campaignId, lastDoc, LIMIT);
    setMessages(prev=>[...older,...prev]);
    if (cursor) setLastDoc(cursor);
    setHasMore(older.length===LIMIT);
  };

  const grouped = messages.map((msg,i)=>{
    const prev = messages[i-1];
    const isGrouped = prev&&prev.userId===msg.userId&&msg.type==="text"&&prev.type==="text"
      &&((msg.timestamp??0)-(prev.timestamp??0))<120000;
    return {...msg, grouped:isGrouped};
  });

  // `ts` é epoch-ms (spec 0032 AC-5). Mensagem sem carimbo do servidor ainda (escrita
  // otimista) chega `null` e continua sem hora na bolha, como antes.
  const formatTime = (ts) => {
    if (typeof ts !== "number") return "";
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,overflow:"hidden"}}>
      {hasMore && (
        <div style={{textAlign:"center",padding:"8px 0",flexShrink:0}}>
          <button onClick={loadMore} style={{
            background:"rgba(176,48,216,0.10)",border:"1px solid rgba(176,48,216,0.28)",
            borderRadius:20,cursor:"pointer",
            color:"#c8a8f0",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,
            textTransform:"uppercase",padding:"6px 18px",transition:"all 0.18s",
          }}>
            ↑ Carregar mensagens anteriores
          </button>
        </div>
      )}
      <div style={{
        flex:1,overflowY:"auto",padding:"14px 8px",
        display:"flex",flexDirection:"column",gap:4,minHeight:0,
        scrollbarWidth:"thin",scrollbarColor:"rgba(176,48,216,0.25) transparent",
      }}>
        {loading && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,gap:12,padding:"40px 0"}}>
            <div style={{width:28,height:28,border:"2.5px solid rgba(176,48,216,0.2)",borderTopColor:"#b030d8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
            <span style={{fontFamily:"'Crimson Pro',serif",fontSize:14,color:"rgba(200,175,225,0.5)",fontStyle:"italic"}}>Carregando mensagens…</span>
          </div>
        )}
        {chatError && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,gap:12,textAlign:"center",padding:"24px 16px"}}>
            <div style={{fontSize:30,opacity:0.6}}>⚠</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1,color:"#e07070",textTransform:"uppercase"}}>Erro ao carregar chat</div>
            <div style={{fontFamily:"'Crimson Pro',serif",fontSize:15,color:"rgba(220,190,230,0.6)",fontStyle:"italic",maxWidth:380,lineHeight:1.65}}>{chatError}</div>
          </div>
        )}
        {!loading&&!chatError&&messages.length===0 && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,gap:12,textAlign:"center",padding:"40px 16px"}}>
            <div style={{fontSize:36,opacity:0.35}}>💬</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1.5,color:"rgba(200,180,220,0.5)",textTransform:"uppercase"}}>Nenhuma mensagem ainda</div>
            <div style={{fontFamily:"'Crimson Pro',serif",fontSize:15,color:"rgba(200,175,215,0.4)",fontStyle:"italic",lineHeight:1.55}}>
              Use <span style={{fontFamily:"Cinzel,serif",fontSize:13,color:"rgba(200,140,255,0.65)"}}>/ r 1d20+5</span> para rolar dados no chat
            </div>
          </div>
        )}
        {grouped.map(msg=>(
          <ChatMessage key={msg.id} msg={msg} uid={uid} formatTime={formatTime}/>
        ))}
        {typingUsers.length>0 && (
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"6px 12px"}}>
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{
                  width:6,height:6,borderRadius:"50%",
                  background:"rgba(176,48,216,0.55)",
                  animation:`pulse 1.2s ${i*0.2}s infinite`
                }}/>
              ))}
            </div>
            <span style={{fontFamily:"'Crimson Pro',serif",fontSize:14,color:"rgba(200,175,220,0.55)",fontStyle:"italic"}}>
              {typingUsers.map(u=>u.userName).join(", ")} está digitando...
            </span>
          </div>
        )}
        <div ref={messagesEndRef}/>
      </div>
      <div style={{
        padding:"12px 8px 10px",
        borderTop:"1px solid rgba(176,48,216,0.18)",
        display:"flex",flexDirection:"column",gap:8,flexShrink:0,
        background:"rgba(0,0,0,0.18)",
      }}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{flex:1,position:"relative"}}>
            <input
              value={input}
              onChange={handleInput}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
              placeholder="Mensagem… ou /r 1d20+5 para dados"
              style={{
                paddingRight:46,paddingLeft:14,height:42,
                background:"rgba(255,255,255,0.07)",
                border:"1px solid rgba(176,48,216,0.30)",
                borderRadius:10,
                color:"#ede5f8",
                fontFamily:"'Crimson Pro',serif",
                fontSize:16,
                outline:"none",
                width:"100%",
                boxSizing:"border-box",
                transition:"border-color 0.2s",
              }}
            />
            <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:14,opacity:0.4,pointerEvents:"none"}}>🎲</span>
          </div>
          <button onClick={sendMessage} disabled={!input.trim()} style={{
            width:42,height:42,borderRadius:10,flexShrink:0,
            background:input.trim()?"rgba(150,50,220,0.45)":"rgba(255,255,255,0.05)",
            border:input.trim()?"1px solid rgba(190,90,255,0.5)":"1px solid rgba(255,255,255,0.1)",
            cursor:input.trim()?"pointer":"default",
            display:"flex",alignItems:"center",justifyContent:"center",
            color:input.trim()?"#e8d0ff":"rgba(200,175,220,0.3)",
            fontSize:16,transition:"all 0.2s",
            boxShadow:input.trim()?"0 2px 10px rgba(140,40,220,0.3)":"none",
          }}>➤</button>
        </div>
        {/* ação destrutiva rebaixada a link discreto (só aparece quando há o que apagar) —
            a barra vermelha full-width gritava mais que o próprio input de mensagem */}
        {isMaster && messages.length>0 && (
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <button onClick={clearAllMessages} disabled={clearing}
              style={{
                background:"transparent",border:"none",padding:"2px 4px",
                color:"rgba(230,110,110,0.55)",
                fontFamily:"Cinzel,serif",fontSize:8.5,letterSpacing:"0.1em",textTransform:"uppercase",
                cursor:clearing?"default":"pointer",transition:"color 0.2s",
              }}
              onMouseEnter={e=>{if(!clearing)e.currentTarget.style.color="rgba(230,110,110,0.95)";}}
              onMouseLeave={e=>{e.currentTarget.style.color="rgba(230,110,110,0.55)";}}>
              {clearing ? "Limpando…" : "🗑 Apagar histórico"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CampaignChat;
