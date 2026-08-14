import { useState, useEffect, useRef } from "react";

// ── Dual-layer animated bar: lead (fast) + ghost trail (delayed on damage)
function Bar({val, set, max, setMax, color, label}) {
  const [editVal,    setEditVal]    = useState(false);
  const [editMax,    setEditMax]    = useState(false);
  const [displayVal, setDisplayVal] = useState(val);
  const [leadPct,    setLeadPct]    = useState(max > 0 ? val / max : 0);
  const [trailPct,   setTrailPct]   = useState(max > 0 ? val / max : 0);

  const curLeadRef  = useRef(max > 0 ? val / max : 0);
  const curTrailRef = useRef(max > 0 ? val / max : 0);
  const curNumRef   = useRef(val);
  const leadRaf  = useRef(null);
  const trailRaf = useRef(null);
  const numRaf   = useRef(null);

  useEffect(() => {
    const target   = max > 0 ? val / max : 0;
    const isDamage = target < curLeadRef.current - 0.001;

    cancelAnimationFrame(leadRaf.current);
    const lFrom = curLeadRef.current, lDur = 380, lT0 = performance.now();
    const animLead = (now) => {
      const t = Math.min((now - lT0) / lDur, 1);
      const e = 1 - Math.pow(1 - t, 3);
      const v = lFrom + (target - lFrom) * e;
      curLeadRef.current = v; setLeadPct(v);
      if (t < 1) leadRaf.current = requestAnimationFrame(animLead);
    };
    leadRaf.current = requestAnimationFrame(animLead);

    cancelAnimationFrame(trailRaf.current);
    const tFrom = curTrailRef.current, delay = isDamage ? 520 : 0, tDur = isDamage ? 950 : 420, tT0 = performance.now();
    const animTrail = (now) => {
      const elapsed = now - tT0;
      if (elapsed < delay) { trailRaf.current = requestAnimationFrame(animTrail); return; }
      const t = Math.min((elapsed - delay) / tDur, 1);
      const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
      const v = tFrom + (target - tFrom) * e;
      curTrailRef.current = v; setTrailPct(v);
      if (t < 1) trailRaf.current = requestAnimationFrame(animTrail);
    };
    trailRaf.current = requestAnimationFrame(animTrail);

    cancelAnimationFrame(numRaf.current);
    const nFrom = curNumRef.current, nT0 = performance.now();
    const animNum = (now) => {
      const t = Math.min((now - nT0) / lDur, 1);
      const e = 1 - Math.pow(1 - t, 3);
      const v = nFrom + (val - nFrom) * e;
      curNumRef.current = v; setDisplayVal(Math.round(v));
      if (t < 1) numRaf.current = requestAnimationFrame(animNum);
    };
    numRaf.current = requestAnimationFrame(animNum);

    return () => { cancelAnimationFrame(leadRaf.current); cancelAnimationFrame(trailRaf.current); cancelAnimationFrame(numRaf.current); };
  }, [val, max]);

  const commitVal = (raw) => { const v = parseInt(raw); if (!isNaN(v) && v >= 0) set(v); setEditVal(false); };
  const commitMax = (raw) => { const v = parseInt(raw); if (!isNaN(v) && v > 0) setMax(v); setEditMax(false); };

  const leadFill  = leadPct > 0.6 ? color : leadPct > 0.3 ? color+"bb" : leadPct > 0.1 ? color+"77" : color+"44";
  const inpStyle  = {textAlign:"center",fontFamily:"Cinzel,serif",fontSize:13,fontWeight:700,color:"white",background:"transparent",border:"none",outline:"2px solid rgba(255,255,255,0.35)",borderRadius:2,height:"70%",minWidth:0,MozAppearance:"textfield"};
  const btnL = {background:"rgba(0,0,0,0.3)",border:"none",borderRight:"1px solid rgba(255,255,255,0.06)",color:"white",cursor:"pointer",padding:"0 8px",height:"100%",fontSize:13,flexShrink:0};
  const btnR = {background:"rgba(0,0,0,0.3)",border:"none",borderLeft:"1px solid rgba(255,255,255,0.06)",color:"white",cursor:"pointer",padding:"0 8px",height:"100%",fontSize:13,flexShrink:0};

  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:3}}>
        <span style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,color:"var(--muted2)",textTransform:"uppercase"}}>{label}</span>
      </div>
      <div style={{position:"relative",height:34,borderRadius:4,overflow:"hidden",background:"rgba(0,0,0,0.42)",border:"1px solid rgba(255,255,255,0.05)"}}>
        {/* Ghost trail — stays behind, drains slowly on damage */}
        <div style={{position:"absolute",inset:0,width:`${trailPct*100}%`,background:color+"44",transition:"background 0.4s"}}/>
        {/* Lead bar — fast response */}
        <div style={{position:"absolute",inset:0,width:`${leadPct*100}%`,background:leadFill,transition:"background 0.4s",minWidth:val>0?3:0}}/>
        <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",height:"100%"}}>
          <button onClick={()=>set(v=>Math.max(0,v-5))} style={btnL}>«</button>
          <button onClick={()=>set(v=>Math.max(0,v-1))} style={{...btnL,borderRight:"1px solid rgba(255,255,255,0.04)"}}>‹</button>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,height:"100%"}}>
            {editVal ? (
              <input autoFocus type="number" defaultValue={val}
                onBlur={e=>commitVal(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")commitVal(e.target.value);if(e.key==="Escape")setEditVal(false);}}
                onClick={e=>e.stopPropagation()} style={{...inpStyle,width:60}}/>
            ) : (
              <span onClick={()=>setEditVal(true)} style={{fontFamily:"Cinzel,serif",fontSize:13,fontWeight:700,color:"white",textShadow:"0 1px 6px rgba(0,0,0,0.62)",cursor:"pointer",userSelect:"none",borderBottom:"1px dashed rgba(255,255,255,0.35)",lineHeight:1.3}}>{displayVal}</span>
            )}
            <span style={{fontFamily:"Cinzel,serif",fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.45)",userSelect:"none"}}>/</span>
            {editMax ? (
              <input autoFocus type="number" defaultValue={max}
                onBlur={e=>commitMax(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")commitMax(e.target.value);if(e.key==="Escape")setEditMax(false);}}
                onClick={e=>e.stopPropagation()} style={{...inpStyle,width:60}}/>
            ) : (
              <span onClick={()=>setEditMax(true)} style={{fontFamily:"Cinzel,serif",fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.7)",textShadow:"0 1px 6px rgba(0,0,0,0.62)",cursor:"pointer",userSelect:"none",borderBottom:"1px dashed rgba(255,255,255,0.25)",lineHeight:1.3}}>{max}</span>
            )}
          </div>
          <button onClick={()=>set(v=>Math.min(max,v+1))} style={{...btnR,borderLeft:"1px solid rgba(255,255,255,0.04)"}}>›</button>
          <button onClick={()=>set(v=>Math.min(max,v+5))} style={btnR}>»</button>
        </div>
      </div>
    </div>
  );
}

export default Bar;
