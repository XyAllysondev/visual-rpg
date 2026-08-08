import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/* Overlay de narração global — escuta narracao (global), narracaoPrivada[uid] e narracaoTest (mestre). */
function NarracaoOverlay({ campaign, uid, isMaster }) {
  const pickLatest = () => {
    const candidates = [
      campaign?.narracao,
      campaign?.narracaoPrivada?.[uid],
      isMaster ? campaign?.narracaoTest : null,
    ].filter(Boolean);
    return candidates.reduce((best, c) => (!best || c.ts > best.ts) ? c : best, null);
  };

  const initTs = Math.max(
    campaign?.narracao?.ts || 0,
    campaign?.narracaoPrivada?.[uid]?.ts || 0,
    campaign?.narracaoTest?.ts || 0,
  );
  const seenRef = useRef(initTs);
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState(null);
  const [typed, setTyped] = useState("");

  const globalTs  = campaign?.narracao?.ts;
  const privateTs = campaign?.narracaoPrivada?.[uid]?.ts;
  const testTs    = campaign?.narracaoTest?.ts;

  useEffect(() => {
    const latest = pickLatest();
    if (latest && latest.ts > seenRef.current) {
      seenRef.current = latest.ts;
      setCurrent(latest);
      setShow(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalTs, privateTs, testTs]);

  useEffect(() => {
    if (!show || !current) return;
    const text = current.text || "";
    let i = 0; setTyped("");
    const iv = setInterval(() => { i++; setTyped(text.slice(0, i)); if (i >= text.length) clearInterval(iv); }, 28);
    return () => clearInterval(iv);
  }, [show, current]);

  if (!show || !current) return null;
  const isTest = !!current.test;
  const text = current.text || "";
  const image = current.image || null;

  return createPortal(
    <div onClick={() => setShow(false)} style={{ position:"fixed", inset:0, zIndex:400, background:"radial-gradient(circle at 50% 40%, rgba(20,4,30,0.9), rgba(0,0,0,0.97))", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:28, cursor:"pointer" }}>
      {isTest && (
        <div style={{ position:"absolute", top:18, left:"50%", transform:"translateX(-50%)", background:"rgba(255,200,50,0.15)", border:"1px solid rgba(255,200,50,0.5)", borderRadius:20, padding:"4px 18px", fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:2, color:"#ffd580", textTransform:"uppercase" }}>
          🧪 Modo Teste — só você está vendo
        </div>
      )}
      <svg width="44" height="44" viewBox="0 0 64 64" fill="none" style={{ marginBottom:image?14:24, opacity:0.8 }}>
        <path d="M3 32c8-14 18-20 29-20s21 6 29 20c-8 14-18 20-29 20S11 46 3 32z" stroke="#b030d8" strokeWidth="1.6"/>
        <circle cx="32" cy="32" r="9" stroke="#b030d8" strokeWidth="1.6"/>
        <circle cx="32" cy="32" r="3.5" fill="#b030d8"/>
      </svg>
      {image && (
        <img src={image} alt="" style={{ maxWidth:"min(680px,88vw)", maxHeight:"38vh", objectFit:"contain", borderRadius:8, marginBottom:20, boxShadow:"0 0 40px rgba(176,48,216,0.3)" }}/>
      )}
      {text && (
        <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:"clamp(18px,3.2vw,30px)", color:"#e8e0f0", textAlign:"center", maxWidth:760, lineHeight:1.6, textShadow:"0 0 24px rgba(176,48,216,0.4)", minHeight:40 }}>
          {typed}<span style={{ opacity:0.6 }}>▌</span>
        </div>
      )}
      <div style={{ marginTop:30, fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"rgba(255,255,255,0.4)" }}>
        — transmissão do mestre · clique para fechar —
      </div>
    </div>,
    document.body
  );
}

export default NarracaoOverlay;
