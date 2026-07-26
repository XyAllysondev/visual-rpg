import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { DnDSheetStyles } from "./DnDSheetStyles";
import { useSlidingPill } from "../../../hooks/useSlidingPill";
import SlidingTabPill from "../../SlidingTabPill";
import talentos   from "../../../data/dungeonsAndDragons/talentos.json";
import magiasData from "../../../data/dungeonsAndDragons/magias.json";
import regrasData from "../../../data/dungeonsAndDragons/regras.json";

/* ── constants ── */
const ATTR_KEYS   = ["FOR","DES","CON","INT","SAB","CAR"];
const ATTR_FULL   = { FOR:"Força",DES:"Destreza",CON:"Constituição",INT:"Inteligência",SAB:"Sabedoria",CAR:"Carisma" };
const HAB_MAP     = { Forca:"FOR",Destreza:"DES",Constituicao:"CON",Inteligencia:"INT",Sabedoria:"SAB",Carisma:"CAR" };
const PERICIAS    = (regrasData.pericias||[]).map(p=>({ nome:p.nome, attr:HAB_MAP[p.habilidade]??p.habilidade }));
const PROF_TABLE  = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6];
const GOLD        = "#c9a84c";
const GOLD_HI     = "#f0d278";

const SCHOOL_COLORS = {
  Abjuração:"#4fc3f7",Adivinhação:"#ce93d8",Conjuração:"#a5d6a7",
  Encantamento:"#f48fb1",Evocação:"#ef9a9a",Ilusão:"#b39ddb",
  Necromancia:"#80cbc4",Transmutação:"#ffcc80",
};

const CLASS_THEMES = {
  "Bárbaro":     { accent:"#e53935",glow:"#ff7043",crisis:"rgba(229,57,53,0.44)",   word:"FÚRIA",    icon:"⚔" },
  "Bardo":       { accent:"#ab47bc",glow:"#e040fb",crisis:"rgba(171,71,188,0.40)",  word:"MELODIA",  icon:"♪" },
  "Bruxo":       { accent:"#7e57c2",glow:"#b39ddb",crisis:"rgba(126,87,194,0.44)",  word:"PACTO",    icon:"👁" },
  "Clérigo":     { accent:"#f9a825",glow:"#ffca28",crisis:"rgba(249,168,37,0.34)",  word:"DIVINO",   icon:"✝" },
  "Druida":      { accent:"#43a047",glow:"#66bb6a",crisis:"rgba(67,160,71,0.38)",   word:"NATUREZA", icon:"🌿" },
  "Feiticeiro":  { accent:"#ef6c00",glow:"#ffa726",crisis:"rgba(239,108,0,0.40)",   word:"MAGIA",    icon:"✨" },
  "Guerreiro":   { accent:"#1976d2",glow:"#64b5f6",crisis:"rgba(25,118,210,0.40)",  word:"BATALHA",  icon:"🛡" },
  "Ladino":      { accent:"#546e7a",glow:"#90a4ae",crisis:"rgba(84,110,122,0.40)",  word:"SOMBRAS",  icon:"🗡" },
  "Mago":        { accent:"#5c6bc0",glow:"#9fa8da",crisis:"rgba(92,107,192,0.44)",  word:"ARCANISMO",icon:"📜" },
  "Monge":       { accent:"#00838f",glow:"#4dd0e1",crisis:"rgba(0,131,143,0.40)",   word:"KI",       icon:"☯" },
  "Paladino":    { accent:"#f57f17",glow:"#ffcc02",crisis:"rgba(245,127,23,0.40)",  word:"SAGRADO",  icon:"⚜" },
  "Patrulheiro": { accent:"#2e7d32",glow:"#81c784",crisis:"rgba(46,125,50,0.38)",   word:"FLORESTA", icon:"🏹" },
};
const DEF_THEME = { accent:GOLD,glow:GOLD_HI,crisis:"rgba(196,30,58,0.40)",word:"AVENTURA",icon:"⚔" };

/* ── helpers ── */
const atMod   = s => Math.floor((s-10)/2);
const fmtMod  = m => m>=0?`+${m}`:`${m}`;
const pb      = n => PROF_TABLE[Math.min(n,20)]??2;
const pvColor = p => p>0.6?"#4caf50":p>0.3?"#fbc02d":"#e53935";
const d20     = () => Math.floor(Math.random()*20)+1;
const rollX   = e => {
  const m=e.toLowerCase().replace(/\s/g,"").match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if(!m) return null;
  const rs=Array.from({length:+m[1]},()=>Math.floor(Math.random()*+m[2])+1);
  return { rolls:rs, total:rs.reduce((a,b)=>a+b,0)+(m[3]?parseInt(m[3]):0) };
};
const defAttrs=()=>({FOR:10,DES:10,CON:10,INT:10,SAB:10,CAR:10});

/* ══════════════════════════════════════════════════════
   ORNATE FRAME PANEL (SVG corners)
══════════════════════════════════════════════════════ */
function Frame({ children, style, className="", accent=GOLD, parch=false }) {
  const a = accent;
  return (
    <div className={`dnd-card${parch?" dnd-card-parch":""} ${className}`} style={{ position:"relative", ...style }}>
      {/* SVG ornate border */}
      <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",overflow:"visible" }}
        viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* inner faint border */}
        <rect x="2.5" y="2.5" width="95" height="95" fill="none"
          stroke={a} strokeOpacity="0.1" strokeWidth="0.4" vectorEffect="non-scaling-stroke"/>
        {/* TL */}
        <path d="M 0 20 L 0 0 L 20 0" fill="none" stroke={a} strokeOpacity="0.85" strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>
        <path d="M 3.5 20 L 3.5 3.5 L 20 3.5" fill="none" stroke={a} strokeOpacity="0.28" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
        <circle cx="3.5" cy="3.5" r="1.6" fill={a} fillOpacity="0.55" vectorEffect="non-scaling-stroke"/>
        {/* TR */}
        <path d="M 80 0 L 100 0 L 100 20" fill="none" stroke={a} strokeOpacity="0.85" strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>
        <path d="M 80 3.5 L 96.5 3.5 L 96.5 20" fill="none" stroke={a} strokeOpacity="0.28" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
        <circle cx="96.5" cy="3.5" r="1.6" fill={a} fillOpacity="0.55" vectorEffect="non-scaling-stroke"/>
        {/* BR */}
        <path d="M 100 80 L 100 100 L 80 100" fill="none" stroke={a} strokeOpacity="0.85" strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>
        <path d="M 96.5 80 L 96.5 96.5 L 80 96.5" fill="none" stroke={a} strokeOpacity="0.28" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
        <circle cx="96.5" cy="96.5" r="1.6" fill={a} fillOpacity="0.55" vectorEffect="non-scaling-stroke"/>
        {/* BL */}
        <path d="M 20 100 L 0 100 L 0 80" fill="none" stroke={a} strokeOpacity="0.85" strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>
        <path d="M 20 96.5 L 3.5 96.5 L 3.5 80" fill="none" stroke={a} strokeOpacity="0.28" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
        <circle cx="3.5" cy="96.5" r="1.6" fill={a} fillOpacity="0.55" vectorEffect="non-scaling-stroke"/>
      </svg>
      <div style={{ position:"relative", zIndex:1 }}>{children}</div>
    </div>
  );
}

/* ── ornamental divider ── */
function OrnDiv({ label, accent=GOLD }) {
  const col = `${accent}cc`;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:9, margin:"0" }}>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg,transparent,${accent}55)` }}/>
      <span style={{ color:`${accent}88`, fontSize:9 }}>◆</span>
      <span style={{ fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:"0.24em",
        textTransform:"uppercase", color:col, fontWeight:700 }}>{label}</span>
      <span style={{ color:`${accent}88`, fontSize:9 }}>◆</span>
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg,${accent}55,transparent)` }}/>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   OCTAGONAL PORTRAIT
══════════════════════════════════════════════════════ */
function OctPortrait({ src, theme, onClick }) {
  const clip = "polygon(29% 0%,71% 0%,100% 29%,100% 71%,71% 100%,29% 100%,0% 71%,0% 29%)";
  return (
    <div style={{ position:"relative", width:186, height:186, margin:"0 auto", cursor:"pointer" }}
      onClick={onClick} role="button" tabIndex={0} aria-label="Retrato do personagem">
      {/* aura glow */}
      <div style={{ position:"absolute", inset:-10, clipPath:clip,
        background:`radial-gradient(ellipse,${theme.glow}33 0%,${theme.accent}18 55%,transparent 80%)`,
        filter:"blur(10px)" }} className="dnd-portrait-aura"/>
      {/* gold ring */}
      <div style={{ position:"absolute", inset:-3, clipPath:clip,
        background:`linear-gradient(135deg,${theme.glow}dd 0%,${theme.accent}88 45%,${theme.glow}aa 100%)` }}/>
      {/* dark inner border */}
      <div style={{ position:"absolute", inset:-1, clipPath:clip, background:"rgba(16,12,26,0.95)" }}/>
      {/* portrait image */}
      <div style={{ position:"absolute", inset:2, clipPath:clip, overflow:"hidden",
        background:"linear-gradient(180deg,rgba(30,22,44,0.9),rgba(10,8,18,0.95))" }}>
        {src ? (
          <img src={src} alt="Personagem" style={{ width:"100%",height:"100%",objectFit:"cover",
            filter:"sepia(0.28) contrast(1.08) brightness(0.9)" }}/>
        ) : (
          <div style={{ width:"100%",height:"100%",display:"flex",flexDirection:"column",
            alignItems:"center",justifyContent:"center",gap:6 }}>
            <span style={{ fontSize:56, opacity:0.28, filter:`drop-shadow(0 0 16px ${theme.glow})` }}>{theme.icon}</span>
            <span style={{ fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:"0.15em",
              color:GOLD,opacity:0.55 }}>SEM RETRATO</span>
          </div>
        )}
        {/* inner vignette */}
        <div style={{ position:"absolute",inset:0,boxShadow:"inset 0 0 50px rgba(0,0,0,0.82)",pointerEvents:"none" }}/>
        {/* class colour overlay at bottom */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,height:28,
          background:`linear-gradient(0deg,${theme.accent}44,transparent)`,pointerEvents:"none" }}/>
      </div>
      {/* octagon vertex dots */}
      {[[29,0],[71,0],[100,29],[100,71],[71,100],[29,100],[0,71],[0,29]].map(([px,py],i)=>(
        <div key={i} style={{ position:"absolute",
          left:`calc(${px}% - 3px)`, top:`calc(${py}% - 3px)`,
          width:6, height:6, borderRadius:"50%",
          background:theme.glow, opacity:0.7,
          boxShadow:`0 0 8px ${theme.glow}`, pointerEvents:"none" }}/>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ATTRIBUTE BOX — carved stone
══════════════════════════════════════════════════════ */
function AttrBox({ abbr, value, theme, edit, onRoll, onEdit }) {
  const [ed, setEd] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  const m = atMod(value);
  const commit = () => { onEdit?.(Math.max(1,Math.min(30,parseInt(draft)||10))); setEd(false); };
  return (
    <div className="dnd-attr-box" style={{ "--accent":theme.accent }}
      title={ATTR_FULL[abbr]} onClick={()=>!edit&&onRoll?.()}>
      <div className="dnd-attr-abbr">{abbr}</div>
      {ed ? (
        <input autoFocus type="number" value={draft} onChange={e=>setDraft(e.target.value)}
          onBlur={commit} onKeyDown={e=>{ if(e.key==="Enter") commit(); if(e.key==="Escape") setEd(false); }}
          style={{ width:54,textAlign:"center",fontSize:22,background:"rgba(0,0,0,0.92)",
            border:`1px solid ${theme.glow}`,color:theme.glow,fontFamily:"Cinzel Decorative,serif",
            fontWeight:700,borderRadius:2,padding:0 }}/>
      ) : (
        <div className="dnd-attr-score" onClick={e=>{ if(edit){e.stopPropagation();setEd(true);} }}>{value}</div>
      )}
      <div className="dnd-attr-mod" style={{ color:m>=0?theme.glow:"#e57373" }}>{fmtMod(m)}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SHIELD CA
══════════════════════════════════════════════════════ */
function ShieldCA({ ca, theme }) {
  return (
    <div className="dnd-shield-wrap">
      <svg width="58" height="66" viewBox="0 0 58 66">
        <defs>
          <linearGradient id="shG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.accent} stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0.55"/>
          </linearGradient>
          <filter id="shGlow">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* outer shadow */}
        <path d="M6 6 H52 V42 L29 62 L6 42 Z" fill="rgba(0,0,0,0.6)" transform="translate(1,2)"/>
        {/* main shield */}
        <path d="M4 4 H54 V40 L29 60 L4 40 Z" fill="url(#shG)"
          stroke={theme.accent} strokeWidth="1.5" strokeOpacity="0.8" filter="url(#shGlow)"/>
        {/* inner double border */}
        <path d="M8 8 H50 V38 L29 54 L8 38 Z" fill="none"
          stroke={theme.accent} strokeWidth="0.7" strokeOpacity="0.3"/>
        <path d="M12 12 H46 V36 L29 48 L12 36 Z" fill="none"
          stroke={theme.accent} strokeWidth="0.4" strokeOpacity="0.15"/>
        {/* value */}
        <text x="29" y="36" textAnchor="middle" fill={theme.glow}
          fontSize="22" fontFamily="Cinzel Decorative,serif" fontWeight="700"
          style={{ textShadow:`0 0 14px ${theme.glow}` }}>{ca}</text>
      </svg>
      <span style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.22em",
        textTransform:"uppercase",color:"var(--cream-dim,#9a8a74)",fontWeight:600 }}>CA</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   D20 icon SVG
══════════════════════════════════════════════════════ */
function D20({ size=24, color=GOLD }) {
  return (
    <svg width={size} height={Math.round(size*1.1)} viewBox="0 0 40 44" fill="none">
      <path d="M20 2 L38 12 V32 L20 42 L2 32 V12 Z" stroke={color} strokeWidth="1.6" fill="rgba(0,0,0,0.4)"/>
      <path d="M20 2 L38 12 L20 20 L2 12 Z" stroke={color} strokeWidth="0.8" strokeOpacity="0.45" fill="none"/>
      <line x1="20" y1="20" x2="20" y2="42" stroke={color} strokeWidth="0.7" strokeOpacity="0.3"/>
      <line x1="20" y1="20" x2="38" y2="12" stroke={color} strokeWidth="0.5" strokeOpacity="0.25"/>
      <line x1="20" y1="20" x2="2"  y2="12" stroke={color} strokeWidth="0.5" strokeOpacity="0.25"/>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════
   D20 BACKGROUND WATERMARK
══════════════════════════════════════════════════════ */
function D20Bg({ color=GOLD }) {
  return (
    <div className="dnd-d20-bg">
      <svg viewBox="-5 -5 110 110" fill="none">
        <polygon points="50,2 98,26 98,74 50,98 2,74 2,26"
          stroke={color} strokeWidth="0.5" strokeOpacity="0.9"/>
        {/* face edges from top */}
        <line x1="50" y1="2"  x2="2"  y2="26" stroke={color} strokeWidth="0.4" strokeOpacity="0.8"/>
        <line x1="50" y1="2"  x2="98" y2="26" stroke={color} strokeWidth="0.4" strokeOpacity="0.8"/>
        <line x1="50" y1="2"  x2="50" y2="50" stroke={color} strokeWidth="0.35" strokeOpacity="0.6"/>
        <line x1="2"  y1="26" x2="98" y2="74" stroke={color} strokeWidth="0.3" strokeOpacity="0.5"/>
        <line x1="98" y1="26" x2="2"  y2="74" stroke={color} strokeWidth="0.3" strokeOpacity="0.5"/>
        <line x1="2"  y1="74" x2="50" y2="50" stroke={color} strokeWidth="0.35" strokeOpacity="0.6"/>
        <line x1="98" y1="74" x2="50" y2="50" stroke={color} strokeWidth="0.35" strokeOpacity="0.6"/>
        <line x1="50" y1="98" x2="50" y2="50" stroke={color} strokeWidth="0.35" strokeOpacity="0.6"/>
        <line x1="2"  y1="26" x2="2"  y2="74" stroke={color} strokeWidth="0.25" strokeOpacity="0.5"/>
        <line x1="98" y1="26" x2="98" y2="74" stroke={color} strokeWidth="0.25" strokeOpacity="0.5"/>
        <text x="50" y="62" textAnchor="middle" fill={color} fillOpacity="0.9"
          fontSize="22" fontFamily="Cinzel Decorative,serif" fontWeight="700">20</text>
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   HP BAR — crystal gem style
══════════════════════════════════════════════════════ */
function HPBar({ pv, pvMax, pvTemp, theme, onPv, onPvMax, onPvTemp, edit }) {
  const [showQ, setShowQ] = useState(false);
  const [amt, setAmt] = useState("");
  const [mode, setMode] = useState("dmg");
  const pct = pvMax>0 ? Math.max(0,Math.min(1,pv/pvMax)) : 0;
  const col = pvColor(pct);
  const apply=()=>{ const n=parseInt(amt,10);if(!n||n<0)return;
    if(mode==="dmg") onPv(Math.max(0,pv-n)); else onPv(Math.min(pvMax,pv+n)); setAmt(""); };

  return (
    <Frame style={{ padding:"14px 14px 12px" }}>
      <OrnDiv label="Pontos de Vida"/>
      <div style={{ display:"flex", alignItems:"flex-end", gap:14, margin:"10px 0 8px" }}>
        {/* Large HP number */}
        <div>
          <div className="dnd-hp-num" style={{ color:col, textShadow:`0 0 28px ${col}66` }}>{pv}</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:4, marginTop:2,
            fontFamily:"Cinzel,serif", fontSize:11, color:"var(--cream-dim,#9a8a74)" }}>
            <span style={{ opacity:0.45 }}>/</span>
            {edit ? (
              <input type="number" defaultValue={pvMax} onBlur={e=>onPvMax?.(Math.max(1,+e.target.value||1))}
                style={{ width:42,background:"rgba(0,0,0,0.8)",border:`1px solid ${GOLD}35`,
                  color:"var(--cream)",fontFamily:"Cinzel,serif",fontSize:13,textAlign:"center",borderRadius:2 }}/>
            ) : <span style={{ opacity:0.65 }}>{pvMax}</span>}
          </div>
        </div>

        {/* Crystal bar */}
        <div style={{ flex:1 }}>
          {/* Gem pips (small dots) */}
          <div style={{ display:"flex", gap:2, marginBottom:5, flexWrap:"wrap" }}>
            {Array.from({length:Math.min(pvMax,20)},(_,i)=>(
              <div key={i} style={{ flex:"0 0 auto", width:"calc(5% - 2px)", minWidth:5, height:10,
                borderRadius:1, transition:"all 0.25s",
                background:i<pv/(pvMax/Math.min(pvMax,20))?col:"rgba(255,255,255,0.06)",
                boxShadow:i<pv/(pvMax/Math.min(pvMax,20))?`0 0 6px ${col}88`:undefined,
                border:`1px solid ${i<pv/(pvMax/Math.min(pvMax,20))?col+"66":"rgba(255,255,255,0.06)"}` }}/>
            ))}
          </div>
          {/* Continuous bar */}
          <div className="dnd-hp-crystal">
            <div className="dnd-hp-fill"
              style={{ width:`${pct*100}%`, background:`linear-gradient(90deg,${col}88,${col})`,
                boxShadow:`0 0 14px ${col}44` }}/>
          </div>
          {/* controls */}
          <div style={{ display:"flex", gap:5, marginTop:7, alignItems:"center" }}>
            {[-5,-1].map(n=>(
              <button key={n} className="mn-btn" onClick={()=>onPv(Math.max(0,pv+n))}>{n}</button>
            ))}
            <div style={{ flex:1 }}/>
            {[1,5].map(n=>(
              <button key={n} className="mn-btn" onClick={()=>onPv(Math.min(pvMax,pv+n))}>+{n}</button>
            ))}
            <button onClick={()=>setShowQ(v=>!v)}
              style={{ width:28,height:26,border:`1px solid ${showQ?col:col+"44"}`,
                background:showQ?`${col}22`:"transparent",borderRadius:2,
                cursor:"pointer",color:showQ?col:"var(--cream-dim)",fontSize:13,
                display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }}>⚡</button>
          </div>
        </div>
      </div>

      {showQ && (
        <div style={{ display:"flex",gap:8,alignItems:"center",padding:"8px 10px",
          background:"rgba(0,0,0,0.45)",borderRadius:3,border:"1px solid rgba(201,168,76,0.15)",
          flexWrap:"wrap" }}>
          <div style={{ display:"flex",borderRadius:2,overflow:"hidden",border:"1px solid rgba(201,168,76,0.25)",flexShrink:0 }}>
            {[["dmg","DMG"],["heal","CURA"]].map(([mv,lbl])=>(
              <button key={mv} onClick={()=>setMode(mv)}
                style={{ padding:"3px 10px",fontSize:9,fontFamily:"Cinzel,serif",letterSpacing:"0.1em",
                  cursor:"pointer",border:"none",background:mode===mv?"rgba(201,168,76,0.22)":"transparent",
                  color:mode===mv?"var(--gold)":"var(--cream-dim)",transition:"background 0.15s" }}>{lbl}</button>
            ))}
          </div>
          <input type="number" min={0} value={amt} onChange={e=>setAmt(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&apply()} placeholder="qtd" autoFocus
            style={{ width:50,padding:"3px 7px",fontSize:14,background:"rgba(0,0,0,0.75)",
              border:`1px solid ${col}55`,color:col,borderRadius:2,
              fontFamily:"Cinzel,serif",textAlign:"center" }}/>
          <button onClick={apply}
            style={{ padding:"3px 13px",borderRadius:2,border:`1px solid ${col}55`,
              background:`${col}12`,color:col,fontFamily:"Cinzel,serif",
              fontSize:10,letterSpacing:"0.08em",cursor:"pointer" }}>
            {mode==="dmg"?"Aplicar":"Curar"}
          </button>
          <button onClick={()=>{onPv(pvMax);setShowQ(false);}}
            style={{ marginLeft:"auto",padding:"3px 10px",borderRadius:2,
              border:"1px solid rgba(74,222,128,0.28)",background:"rgba(74,222,128,0.07)",
              color:"#4ade80",fontSize:9,fontFamily:"Cinzel,serif",letterSpacing:"0.08em",cursor:"pointer" }}>MAX</button>
        </div>
      )}

      {(edit||pvTemp>0) && (
        <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:10,
          paddingTop:10,borderTop:"1px solid rgba(179,157,219,0.12)" }}>
          <span style={{ fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:"0.18em",color:"#b39ddb",fontWeight:700 }}>PV TEMP</span>
          <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:6 }}>
            <button className="mn-btn" onClick={()=>onPvTemp(Math.max(0,pvTemp-1))} style={{ color:"#e57373" }}>−</button>
            <span style={{ fontFamily:"Cinzel Decorative,serif",fontSize:22,color:"#b39ddb",
              minWidth:32,textAlign:"center",textShadow:"0 0 12px #b39ddb66" }}>{pvTemp}</span>
            <button className="mn-btn" onClick={()=>onPvTemp(pvTemp+1)} style={{ color:"#81c784" }}>+</button>
          </div>
        </div>
      )}
    </Frame>
  );
}

/* ══════════════════════════════════════════════════════
   DICE OVERLAY
══════════════════════════════════════════════════════ */
function DiceOverlay({ roll, onClose }) {
  const isCrit=roll.d20===20; const isFail=roll.d20===1;
  return (
    <div className="dnd-overlay" onClick={onClose}>
      <div className={`dnd-roll-card${isCrit?" crit":""}`} onClick={e=>e.stopPropagation()}>
        {/* SVG corners */}
        {[[" top:-1px;left:-1px;border-top:2px solid;border-left:2px solid",
           " top:-1px;right:-1px;border-top:2px solid;border-right:2px solid",
           " bottom:-1px;left:-1px;border-bottom:2px solid;border-left:2px solid",
           " bottom:-1px;right:-1px;border-bottom:2px solid;border-right:2px solid"]].map(()=>
          [["top:-1px","left:-1px","borderTop:`2px solid ${GOLD}`","borderLeft:`2px solid ${GOLD}`"],
           ["top:-1px","right:-1px","borderTop:`2px solid ${GOLD}`","borderRight:`2px solid ${GOLD}`"],
           ["bottom:-1px","left:-1px","borderBottom:`2px solid ${GOLD}`","borderLeft:`2px solid ${GOLD}`"],
           ["bottom:-1px","right:-1px","borderBottom:`2px solid ${GOLD}`","borderRight:`2px solid ${GOLD}`"]
          ].map((_,ci)=>(
            <span key={ci} style={{ position:"absolute",width:14,height:14,pointerEvents:"none",
              ...(ci===0?{top:-1,left:-1,borderTop:`2px solid ${GOLD}`,borderLeft:`2px solid ${GOLD}`}:
                 ci===1?{top:-1,right:-1,borderTop:`2px solid ${GOLD}`,borderRight:`2px solid ${GOLD}`}:
                 ci===2?{bottom:-1,left:-1,borderBottom:`2px solid ${GOLD}`,borderLeft:`2px solid ${GOLD}`}:
                        {bottom:-1,right:-1,borderBottom:`2px solid ${GOLD}`,borderRight:`2px solid ${GOLD}`}) }}/>
          ))
        )}

        {isCrit&&<div className="dnd-crit-badge">⚔ ACERTO CRÍTICO ⚔</div>}
        {isFail&&<div style={{ textAlign:"center",fontFamily:"Cinzel,serif",fontSize:11,
          letterSpacing:"0.3em",color:"#e57373",marginBottom:4 }}>— FALHA CRÍTICA —</div>}

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:20 }}>
          <div>
            <div style={{ fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:"0.2em",
              textTransform:"uppercase",color:GOLD,marginBottom:10 }}>{roll.label}</div>
            <div className="dnd-result-num"
              style={{ color:isCrit?GOLD_HI:isFail?"#e57373":"var(--cream,#ede0c4)",
                textShadow:isCrit?`0 0 50px ${GOLD},0 0 25px ${GOLD_HI}`:"none" }}>
              {roll.total}
            </div>
            <div style={{ fontFamily:"Share Tech Mono,monospace",fontSize:12,
              color:"var(--cream-dim,#9a8a74)",marginTop:8 }}>
              d20={roll.d20}{roll.bonus!==0&&` ${fmtMod(roll.bonus)}`}
              {roll.rolls?.length>1&&` [${roll.rolls.join("+")}]`}
            </div>
          </div>
          <div className="dnd-d20-spin" style={{ flexShrink:0,marginTop:6 }}>
            <D20 size={68} color={isCrit?GOLD_HI:isFail?"#e57373":GOLD}/>
          </div>
        </div>
        <button onClick={onClose}
          style={{ position:"absolute",top:10,right:14,background:"none",border:"none",
            color:"var(--cream-dim)",fontSize:20,cursor:"pointer",opacity:0.65 }}>×</button>
      </div>
    </div>
  );
}

function CornerCard({ roll, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,4200); return()=>clearTimeout(t); },[onClose]);
  const isCrit=roll.d20===20; const isFail=roll.d20===1;
  return (
    <div className="dnd-corner-card">
      {[{top:-1,left:-1,borderTop:`2px solid ${GOLD}`,borderLeft:`2px solid ${GOLD}`},
        {top:-1,right:-1,borderTop:`2px solid ${GOLD}`,borderRight:`2px solid ${GOLD}`},
        {bottom:-1,left:-1,borderBottom:`2px solid ${GOLD}`,borderLeft:`2px solid ${GOLD}`},
        {bottom:-1,right:-1,borderBottom:`2px solid ${GOLD}`,borderRight:`2px solid ${GOLD}`},
      ].map((s,i)=><span key={i} style={{ position:"absolute",width:11,height:11,pointerEvents:"none",...s }}/>)}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12 }}>
        <div>
          <div style={{ fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:"0.18em",
            textTransform:"uppercase",color:GOLD,marginBottom:6 }}>{roll.label}</div>
          <div style={{ fontFamily:"Cinzel Decorative,serif",fontSize:44,lineHeight:1,
            color:isCrit?GOLD_HI:isFail?"#e57373":"var(--cream,#ede0c4)",
            textShadow:isCrit?`0 0 28px ${GOLD}`:undefined }}>
            {roll.total}
          </div>
          <div style={{ fontFamily:"Share Tech Mono,monospace",fontSize:11,
            color:"var(--cream-dim,#9a8a74)",marginTop:4 }}>
            {isCrit?"⚔ CRÍTICO":isFail?"💀 FALHA":`d20 = ${roll.d20}`}
            {roll.bonus!==0&&` ${fmtMod(roll.bonus)}`}
          </div>
        </div>
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0 }}>
          <D20 size={34} color={isCrit?GOLD_HI:isFail?"#e57373":GOLD}/>
          <button onClick={onClose}
            style={{ background:"none",border:"none",color:"var(--cream-dim)",cursor:"pointer",fontSize:15 }}>×</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SPELL CARD
══════════════════════════════════════════════════════ */
function SpellCard({ spell }) {
  const [open,setOpen]=useState(false);
  const col=SCHOOL_COLORS[spell.escola]||GOLD;
  return (
    <div className="dnd-spell-row">
      <div onClick={()=>setOpen(o=>!o)}
        style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",
          background:open?"rgba(201,168,76,0.03)":"rgba(255,255,255,0.016)" }}>
        <div style={{ background:`${col}18`,border:`1px solid ${col}55`,borderRadius:2,
          padding:"2px 8px",fontFamily:"Cinzel,serif",fontSize:8,color:col,
          letterSpacing:"0.1em",flexShrink:0 }}>
          {spell.nivel===0?"TRUQUE":`N${spell.nivel}`}
        </div>
        <span style={{ fontFamily:"Cinzel,serif",fontSize:12,color:"var(--cream,#ede0c4)",flex:1 }}>{spell.nome}</span>
        <span style={{ fontFamily:"Crimson Pro,serif",fontSize:12,color:`${col}99`,flexShrink:0 }}>{spell.escola}</span>
        {spell.ritual&&<span style={{ fontFamily:"Cinzel,serif",fontSize:7,color:GOLD,
          border:`1px solid ${GOLD}44`,padding:"1px 5px",borderRadius:2,letterSpacing:"0.1em",flexShrink:0 }}>RITUAL</span>}
        <span style={{ color:"var(--cream-dim,#9a8a74)",fontSize:10,
          transform:open?"rotate(90deg)":"none",transition:"transform 0.2s",flexShrink:0 }}>▶</span>
      </div>
      {open&&(
        <div style={{ padding:"0 14px 14px",borderTop:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"10px 0" }}>
            {[["Tempo de Conjuração",spell.tempo_conjuracao],["Alcance",spell.alcance],
              ["Componentes",spell.componentes],["Duração",spell.duracao]].map(([k,v])=>(
              <div key={k}>
                <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.18em",
                  textTransform:"uppercase",color:`${col}aa`,marginBottom:3 }}>{k}</div>
                <span style={{ fontFamily:"Crimson Pro,serif",fontSize:14,color:"var(--cream-dim,#9a8a74)" }}>{v}</span>
              </div>
            ))}
          </div>
          <p style={{ fontFamily:"Crimson Pro,serif",fontSize:15,color:"var(--cream-dim,#9a8a74)",
            lineHeight:1.68,margin:0 }}>{spell.descricao}</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function DungeonsAndDragonsSheet({ character, onBack, onUpdate, onRoll }) {
  const [attrs,      setAttrs]      = useState(character.dndAttrs ?? defAttrs());
  const [nivel,      setNivel]      = useState(character.nivel    ?? 1);
  const [pv,         setPv]         = useState(character.pv       ?? 10);
  const [pvMax,      setPvMax]      = useState(character.pvMax    ?? 10);
  const [pvTemp,     setPvTemp]     = useState(character.pvTemp   ?? 0);
  const [ca,         setCa]         = useState(character.ca       ?? 10);
  const [speed,      setSpeed]      = useState(character.speed    ?? 9);
  const [form, setForm] = useState(character.form ?? {
    personagem:"",jogador:"",raca:"",classe:"",antecedente:"",
    alinhamento:"",aparencia:"",personalidade:"",historico:"",
    objetivo:"",anotacoes:"",avatar:"",
  });
  const [pericias,   setPericias]   = useState(character.pericias   ?? {});
  const [expertises, setExpertises] = useState(character.expertises ?? {});
  const [attacks,    setAttacks]    = useState(character.attacks    ?? []);
  const [atkModal,   setAtkModal]   = useState(null);
  const [spellQ,     setSpellQ]     = useState("");
  const [spellLvl,   setSpellLvl]  = useState("all");
  const [spellSlots, setSpellSlots] = useState(character.spellSlots ?? Object.fromEntries(
    [1,2,3,4,5,6,7,8,9].map(n=>[n,{max:0,used:0}])
  ));
  const [inventario, setInventario] = useState(character.inventario ?? []);
  const [gold,       setGold]       = useState(character.gold       ?? {pp:0,po:0,pe:0,pc:0});
  const [invIn,      setInvIn]      = useState({nome:"",qtd:1,peso:"",desc:""});
  const [myTal,      setMyTal]      = useState(character.myTalentos ?? []);
  const [dSaves,     setDSaves]     = useState(character.deathSaves ?? {successes:0,failures:0});
  const [insp,       setInsp]       = useState(character.inspiration ?? false);
  const [resists,    setResists]    = useState(character.resistencias ?? []);

  const [activeTab, setActiveTab]  = useState("pericias");
  /* Indicador deslizante da barra de abas (spec 0022 AC-1). */
  const tabsPill = useSlidingPill(activeTab);
  const [mobileSec, setMobileSec]  = useState("ficha");
  const [editMode,  setEditMode]   = useState(false);
  const [skillQ,    setSkillQ]     = useState("");
  const [roll,      setRoll]       = useState(null);
  const [diceInp,   setDiceInp]    = useState("");
  const [dirty,     setDirty]      = useState(false);
  const [savedAt,   setSavedAt]    = useState(null);
  const [showHelp,  setShowHelp]   = useState(false);
  const diceRef  = useRef(null);
  const avatarRef= useRef(null);

  const profB = pb(nivel);
  const theme  = CLASS_THEMES[form.classe] || DEF_THEME;
  const pvPct  = pvMax>0 ? pv/pvMax : 0;
  const wounded= pvPct<0.3;
  const charName = form.personagem || character.form?.personagem || "Herói Sem Nome";

  const rootVars = {
    "--dnd-accent": theme.accent,
    "--dnd-glow":   theme.glow,
    "--dnd-crisis": theme.crisis,
  };

  /* auto-save */
  const latest=useRef({}); const dirtyRef=useRef(false); const saveTimer=useRef(null);
  const snapshot=useMemo(()=>({ ...character, dndAttrs:attrs, nivel, pv, pvMax, pvTemp, ca, speed,
    form, pericias, expertises, attacks, spellSlots, inventario, gold,
    myTalentos:myTal, deathSaves:dSaves, inspiration:insp, resistencias:resists,
  }),[attrs,nivel,pv,pvMax,pvTemp,ca,speed,form,pericias,expertises,attacks,spellSlots,inventario,gold,myTal,dSaves,insp,resists,character]);
  latest.current=snapshot;
  const once=useRef(false);
  useEffect(()=>{ if(!once.current){once.current=true;return;} dirtyRef.current=true; setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{ onUpdate?.(latest.current); dirtyRef.current=false; setDirty(false); setSavedAt(Date.now()); },900);
    return()=>clearTimeout(saveTimer.current);
  },[snapshot]);
  useEffect(()=>()=>{ clearTimeout(saveTimer.current); if(dirtyRef.current) onUpdate?.(latest.current); },[]);
  const handleBack=()=>{ clearTimeout(saveTimer.current); if(dirtyRef.current) onUpdate?.(latest.current); onBack?.(); };

  const handleAvatar=e=>{ const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader(); r.onload=ev=>{ const img=new Image(); img.onload=()=>{
      const MAX=400,sc=Math.min(1,MAX/Math.max(img.width,img.height));
      const c=document.createElement("canvas"); c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      setForm(f=>({...f,avatar:c.toDataURL("image/jpeg",0.82)}));
    }; img.src=ev.target.result; }; r.readAsDataURL(f); e.target.value=""; };

  const fireRoll=useCallback((label,d20v,bonus=0,rolls=null)=>{
    const total=d20v+bonus; setRoll({label,d20:d20v,bonus,total,rolls});
    onRoll?.({charName,attr:label,rolls:[d20v],result:total,dice:"D20"});
  },[charName,onRoll]);

  const rollAttr =k=>fireRoll(ATTR_FULL[k],d20(),atMod(attrs[k]));
  const rollSave =k=>{ const tr=!!pericias[`save_${k}`]; fireRoll(`Salv. ${ATTR_FULL[k]}`,d20(),atMod(attrs[k])+(tr?profB:0)); };
  const rollSkill=p=>{ const tr=!!pericias[p.nome]; const ex=!!expertises[p.nome];
    fireRoll(p.nome,d20(),atMod(attrs[p.attr]??10)+(ex?profB*2:tr?profB:0)); };
  const rollAtk  =a=>fireRoll(a.nome||"Ataque",d20(),parseInt(a.bonus)||0);
  const rollFree =()=>{ if(!diceInp.trim()) return;
    if(/\d+d\d+/i.test(diceInp)){ const r=rollX(diceInp); if(r) setRoll({label:diceInp.toUpperCase(),d20:r.rolls[0],bonus:0,total:r.total,rolls:r.rolls}); }
    else fireRoll(diceInp.toUpperCase(),d20(),0); setDiceInp(""); };

  useEffect(()=>{
    const h=e=>{ const t=e.target; if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA")) return;
      if(e.key==="r"||e.key==="R"){ e.preventDefault(); setActiveTab("combate"); setTimeout(()=>diceRef.current?.focus(),30); }
      else if(e.key==="e"||e.key==="E") setEditMode(v=>!v);
      else if(["1","2","3","4","5","6"].includes(e.key)) rollAttr(ATTR_KEYS[+e.key-1]); };
    window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h);
  },[attrs]);

  const filteredSpells=useMemo(()=>(magiasData.magias||[]).filter(s=>{
    const lv=spellLvl==="all"||String(s.nivel)===spellLvl;
    const q=!spellQ||s.nome.toLowerCase().includes(spellQ.toLowerCase())||(s.escola||"").toLowerCase().includes(spellQ.toLowerCase());
    return lv&&q;
  }),[spellQ,spellLvl]);

  /* ── SIDEBAR ── */
  const renderSidebar=()=>(
    <div className={`dnd-sidebar dnd-stagger${mobileSec!=="ficha"?" dnd-mob-hide":""}`}>
      {/* Portrait */}
      <Frame style={{ padding:"18px 14px 14px" }}>
        <OctPortrait src={form.avatar} theme={theme} onClick={()=>avatarRef.current?.click()}/>
        <input ref={avatarRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleAvatar}/>
        <div style={{ textAlign:"center", marginTop:12 }}>
          {editMode ? (
            <input value={form.personagem||""} onChange={e=>setForm(f=>({...f,personagem:e.target.value}))}
              placeholder="Nome do Personagem"
              style={{ ...INP, fontFamily:"Cinzel,serif",fontSize:14,textAlign:"center",background:"rgba(0,0,0,0.65)" }}/>
          ) : (
            <div style={{ fontFamily:"Cinzel Decorative,Cinzel,serif",fontSize:15,
              color:GOLD_HI,letterSpacing:"0.04em",lineHeight:1.2 }}>
              {form.personagem||"Nome do Personagem"}
            </div>
          )}
        </div>
        {/* badges */}
        <div style={{ display:"flex",gap:5,flexWrap:"wrap",justifyContent:"center",marginTop:8 }}>
          {[form.raca||"Sem raça", form.alinhamento||"Neutro"].map((v,i)=>(
            <span key={i} style={{ fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:"0.1em",
              color:"var(--cream-dim,#9a8a74)",background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.08)",borderRadius:2,padding:"2px 7px" }}>{v}</span>
          ))}
        </div>
        {editMode && (
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10 }}>
            {[["raca","Raça"],["antecedente","Antecedente"],["alinhamento","Alinhamento"],["jogador","Jogador"]].map(([k,l])=>(
              <div key={k}>
                <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.15em",color:GOLD,marginBottom:2 }}>{l}</div>
                <input value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={INP}/>
              </div>
            ))}
          </div>
        )}
      </Frame>

      {/* Level + Prof */}
      <Frame style={{ padding:"12px 14px" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <OrnDiv label="Nível"/>
            <div style={{ display:"flex",alignItems:"baseline",gap:8,marginTop:6 }}>
              <span style={{ fontFamily:"Cinzel Decorative,serif",fontSize:36,color:GOLD_HI,
                lineHeight:1,textShadow:`0 0 20px ${GOLD}44` }}>{nivel}</span>
              {editMode&&(
                <span style={{ display:"flex",gap:4 }}>
                  <button className="mn-btn" onClick={()=>setNivel(n=>Math.max(1,n-1))}>−</button>
                  <button className="mn-btn" onClick={()=>setNivel(n=>Math.min(20,n+1))}>+</button>
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign:"center",padding:"8px 14px",background:"rgba(201,168,76,0.06)",
            border:`1px solid ${GOLD}28`,borderRadius:2 }}>
            <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.18em",
              color:"var(--cream-dim,#9a8a74)",marginBottom:4 }}>PROF. BÔNUS</div>
            <div style={{ fontFamily:"Cinzel Decorative,serif",fontSize:28,color:theme.glow,lineHeight:1,
              textShadow:`0 0 16px ${theme.glow}55` }}>{fmtMod(profB)}</div>
          </div>
        </div>
        {/* XP-style level bar */}
        <div style={{ marginTop:10,height:6,background:"rgba(0,0,0,0.6)",borderRadius:2,
          overflow:"hidden",border:"1px solid rgba(201,168,76,0.14)" }}>
          <div style={{ height:"100%",width:`${(nivel/20)*100}%`,
            background:`linear-gradient(90deg,${theme.accent}88,${theme.glow})`,
            boxShadow:`0 0 12px ${theme.glow}55`,transition:"width 0.55s cubic-bezier(.4,.1,.3,1)" }}/>
        </div>
        <div style={{ display:"flex",justifyContent:"space-between",marginTop:3 }}>
          <span style={{ fontFamily:"Cinzel,serif",fontSize:8,color:"var(--cream-dim,#9a8a74)",letterSpacing:"0.1em" }}>I</span>
          <span style={{ fontFamily:"Cinzel,serif",fontSize:8,color:"var(--cream-dim,#9a8a74)",letterSpacing:"0.1em" }}>XX</span>
        </div>
      </Frame>

      {/* Attributes 2x3 */}
      <Frame style={{ padding:"14px 12px" }}>
        <OrnDiv label="Atributos"/>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:12 }}>
          {ATTR_KEYS.map(k=>(
            <AttrBox key={k} abbr={k} value={attrs[k]??10} theme={theme} edit={editMode}
              onRoll={()=>rollAttr(k)}
              onEdit={editMode?(v)=>setAttrs(a=>({...a,[k]:v})):null}/>
          ))}
        </div>
        {/* quick roll row */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,marginTop:8 }}>
          {ATTR_KEYS.map((k,i)=>(
            <button key={k} onClick={()=>rollAttr(k)}
              style={{ background:"none",border:"none",cursor:"pointer",
                color:"var(--cream-dim,#9a8a74)",fontSize:10,fontFamily:"Cinzel,serif",
                letterSpacing:0,padding:"3px 0",opacity:0.55,
                transition:"opacity 0.15s" }}
              onMouseEnter={e=>e.currentTarget.style.opacity="1"}
              onMouseLeave={e=>e.currentTarget.style.opacity="0.55"}>
              {i+1}
            </button>
          ))}
        </div>
      </Frame>

      {/* Combat stats */}
      <Frame style={{ padding:"12px 14px" }}>
        <OrnDiv label="Combate"/>
        <div style={{ display:"flex",justifyContent:"space-around",alignItems:"flex-end",gap:6,marginTop:12 }}>
          <ShieldCA ca={ca} theme={theme}/>
          {/* Initiative circle */}
          <div style={{ textAlign:"center" }}>
            <div style={{ width:52,height:52,borderRadius:"50%",margin:"0 auto",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontFamily:"Cinzel Decorative,serif",fontSize:22,color:"var(--cream,#ede0c4)",
              background:"linear-gradient(180deg,rgba(26,20,40,0.95),rgba(14,11,24,0.98))",
              border:`1px solid rgba(201,168,76,0.3)`,
              boxShadow:"inset 0 2px 6px rgba(0,0,0,0.7)" }}>
              {fmtMod(atMod(attrs.DES))}
            </div>
            <span style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.18em",
              textTransform:"uppercase",color:"var(--cream-dim,#9a8a74)",display:"block",marginTop:5 }}>Iniciativa</span>
          </div>
          {/* Speed */}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"Cinzel Decorative,serif",fontSize:22,
              color:"var(--cream,#ede0c4)",lineHeight:1 }}>{speed}m</div>
            <span style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.18em",
              textTransform:"uppercase",color:"var(--cream-dim,#9a8a74)",display:"block",marginTop:5 }}>Velocidade</span>
          </div>
        </div>
        {editMode&&(
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12 }}>
            <div>
              <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.14em",color:GOLD,marginBottom:3 }}>CA</div>
              <input type="number" value={ca} onChange={e=>setCa(+e.target.value)} style={INP}/>
            </div>
            <div>
              <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.14em",color:GOLD,marginBottom:3 }}>Velocidade</div>
              <input value={speed} onChange={e=>setSpeed(parseInt(e.target.value)||9)} style={INP}/>
            </div>
          </div>
        )}
        {/* Resistances */}
        {(resists.length>0||editMode)&&(
          <div style={{ marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            <OrnDiv label="Resistências"/>
            <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginTop:7 }}>
              {resists.map((r,i)=>(
                <span key={i} style={{ fontFamily:"Crimson Pro,serif",fontSize:12,padding:"2px 7px",
                  borderRadius:2,background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.2)",
                  color:"var(--cream-dim,#9a8a74)",display:"flex",alignItems:"center",gap:4 }}>
                  {r}
                  {editMode&&<button onClick={()=>setResists(a=>a.filter((_,j)=>j!==i))}
                    style={{ background:"none",border:"none",color:"#e57373",cursor:"pointer",padding:0,fontSize:12 }}>×</button>}
                </span>
              ))}
              {editMode&&(
                <input placeholder="+ adicionar"
                  onKeyDown={e=>{ if(e.key==="Enter"&&e.currentTarget.value.trim()){
                    setResists(a=>[...a,e.currentTarget.value.trim()]); e.currentTarget.value=""; }}}
                  style={{ ...INP,width:80,fontSize:11,padding:"2px 6px" }}/>
              )}
            </div>
          </div>
        )}
      </Frame>

      {/* HP */}
      <HPBar pv={pv} pvMax={pvMax} pvTemp={pvTemp} theme={theme}
        onPv={setPv} onPvMax={setPvMax} onPvTemp={setPvTemp} edit={editMode}/>

      {/* Death saves + Inspiration */}
      <Frame style={{ padding:"12px 14px" }}>
        <OrnDiv label="Salvaguardas de Morte"/>
        <div style={{ display:"flex",gap:12,justifyContent:"space-between",alignItems:"center",marginTop:10 }}>
          {[["Sucesso","successes","#81c784"],["Falha","failures","#e57373"]].map(([t,k,c])=>(
            <div key={k}>
              <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.16em",
                textTransform:"uppercase",color:c,marginBottom:7,fontWeight:700 }}>{t}</div>
              <div style={{ display:"flex",gap:5 }}>
                {[0,1,2].map(i=>(
                  <button key={i} className={`dnd-save-pip${dSaves[k]>i?" on":""}`}
                    style={{ color:c,background:dSaves[k]>i?c:"transparent" }}
                    onClick={()=>setDSaves(d=>({...d,[k]:d[k]===i+1?i:i+1}))}/>
                ))}
              </div>
            </div>
          ))}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.12em",
              color:"var(--cream-dim,#9a8a74)",marginBottom:7 }}>INSPIRAÇÃO</div>
            <button onClick={()=>setInsp(v=>!v)}
              style={{ width:32,height:32,borderRadius:"50%",
                border:`2px solid ${insp?GOLD:"rgba(255,255,255,0.14)"}`,
                background:insp?"rgba(201,168,76,0.2)":"transparent",
                cursor:"pointer",fontSize:16,padding:0,
                color:insp?GOLD:"var(--cream-dim,#9a8a74)",
                transition:"all 0.18s",boxShadow:insp?`0 0 14px ${GOLD}55`:undefined }}>
              {insp?"★":"☆"}
            </button>
          </div>
        </div>
      </Frame>

      {/* Rest */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
        {[["CURTO","rgba(76,175,80,0.07)","rgba(76,175,80,0.28)","#81c784",
          ()=>setPv(Math.min(pvMax,pv+Math.max(1,atMod(attrs.CON))))],
          ["LONGO",`${theme.accent}10`,`${theme.accent}50`,theme.glow,
          ()=>{ setPv(pvMax);setPvTemp(0);setDSaves({successes:0,failures:0});
            setSpellSlots(s=>Object.fromEntries(Object.entries(s).map(([k,v])=>[k,{...v,used:0}]))); }],
        ].map(([l,bg,bd,c,fn])=>(
          <button key={l} onClick={fn}
            style={{ padding:"11px 0",background:bg,border:`1px solid ${bd}`,borderRadius:2,
              color:c,fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:"0.14em",cursor:"pointer",
              transition:"all 0.18s",boxShadow:`0 0 0 0 ${c}` }}
            onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 14px -4px ${c}`}
            onMouseLeave={e=>e.currentTarget.style.boxShadow=`0 0 0 0 ${c}`}>
            DESCANSO {l}
          </button>
        ))}
      </div>
    </div>
  );

  /* ── PERÍCIAS ── */
  const renderPericias=()=>{
    const filtered=PERICIAS.filter(p=>!skillQ||p.nome.toLowerCase().includes(skillQ.toLowerCase()));
    return (
      <div>
        <div style={{ padding:"10px 14px",borderBottom:"1px solid rgba(201,168,76,0.08)",
          background:"rgba(0,0,0,0.25)" }}>
          <input value={skillQ} onChange={e=>setSkillQ(e.target.value)}
            placeholder="🔍  filtrar perícia…"
            style={{ ...INP,background:"rgba(0,0,0,0.55)",fontFamily:"Crimson Pro,serif",fontSize:14 }}/>
        </div>
        {/* Saving throws */}
        {!skillQ&&(
          <div style={{ borderBottom:"1px solid rgba(201,168,76,0.1)",paddingBottom:4 }}>
            <div style={{ padding:"10px 14px 4px",fontFamily:"Cinzel,serif",fontSize:9,
              letterSpacing:"0.18em",textTransform:"uppercase",color:GOLD }}>
              ◆ Salvaguardas de Atributo
            </div>
            {ATTR_KEYS.map(k=>{
              const tr=!!pericias[`save_${k}`]; const b=atMod(attrs[k])+(tr?profB:0);
              return (
                <div key={k} className="dnd-skill-row"
                  onClick={()=>editMode?setPericias(p=>({...p,[`save_${k}`]:!p[`save_${k}`]})):rollSave(k)}>
                  <div style={{ width:11,height:11,borderRadius:"50%",flexShrink:0,
                    border:`1.5px solid ${tr?theme.glow:"rgba(255,255,255,0.2)"}`,
                    background:tr?theme.glow+"88":"transparent",transition:"all 0.15s" }}/>
                  <span style={{ color:tr?"var(--cream,#ede0c4)":"var(--cream-dim,#9a8a74)" }}>{ATTR_FULL[k]}</span>
                  <span style={{ textAlign:"center",fontFamily:"Cinzel,serif",fontSize:10,
                    color:"var(--cream-dim,#9a8a74)" }}>{k}</span>
                  <span style={{ textAlign:"center",fontFamily:"Cinzel,serif",fontSize:12,
                    fontWeight:700,color:tr?theme.glow:"var(--cream-dim,#9a8a74)" }}>{fmtMod(b)}</span>
                  <button className="dnd-roll-sm" onClick={e=>{e.stopPropagation();rollSave(k);}}>🎲</button>
                </div>
              );
            })}
          </div>
        )}
        {/* Skill header */}
        <div className="dnd-skill-row" style={{ background:"rgba(0,0,0,0.35)",cursor:"default",
          borderBottom:`1px solid ${GOLD}22`,
          fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.16em",
          textTransform:"uppercase",color:"var(--cream-dim,#9a8a74)" }}>
          <span/><span>Perícia</span>
          <span style={{ textAlign:"center" }}>Atr</span>
          <span style={{ textAlign:"center" }}>Bônus</span>
          <span/>
        </div>
        {filtered.map(p=>{
          const tr=!!pericias[p.nome]; const ex=!!expertises[p.nome];
          const b=atMod(attrs[p.attr]??10)+(ex?profB*2:tr?profB:0);
          return (
            <div key={p.nome} className="dnd-skill-row">
              <span style={{ color:ex?theme.glow:tr?theme.glow+"77":"rgba(255,255,255,0.16)",
                fontSize:14,cursor:"pointer",textAlign:"center" }}
                onClick={()=>{
                  if(!tr) setPericias(x=>({...x,[p.nome]:true}));
                  else if(!ex) setExpertises(x=>({...x,[p.nome]:true}));
                  else { setPericias(x=>{const n={...x};delete n[p.nome];return n;});
                         setExpertises(x=>{const n={...x};delete n[p.nome];return n;}); }
                }}>
                {ex?"◆":tr?"◇":"◇"}
              </span>
              <span style={{ color:tr?"var(--cream,#ede0c4)":"var(--cream-dim,#9a8a74)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}
                onClick={()=>rollSkill(p)}>{p.nome}</span>
              <span style={{ textAlign:"center",fontFamily:"Cinzel,serif",fontSize:9,
                color:"var(--cream-dim,#9a8a74)" }}>{p.attr}</span>
              <span style={{ textAlign:"center",fontFamily:"Cinzel,serif",fontSize:12,
                fontWeight:700,color:tr?theme.glow:"var(--cream-dim,#9a8a74)" }}>({fmtMod(b)})</span>
              <button className="dnd-roll-sm" onClick={()=>rollSkill(p)}>🎲</button>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── COMBATE ── */
  const renderCombate=()=>(
    <div style={{ display:"flex",flexDirection:"column",gap:14,padding:"14px" }}>
      <Frame style={{ padding:"14px" }}>
        <OrnDiv label="Rolagem de Dados"/>
        <div style={{ display:"flex",gap:8,marginTop:12 }}>
          <input ref={diceRef} value={diceInp} onChange={e=>setDiceInp(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&rollFree()} className="dnd-scroll-inp"
            style={{ flex:1 }} placeholder="2d6+3 · 1d20 · nome do teste…"/>
          <button onClick={rollFree} className="dnd-roll-btn-main">
            <D20 size={16} color="#06040b"/>ROLAR
          </button>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:10 }}>
          {["d4","d6","d8","d10","d12","d20","d100","2d6"].map(d=>(
            <button key={d} className="dnd-die-btn"
              onClick={()=>{ const r=rollX((d.match(/^\d+d/)?"":"1")+d); if(r) setRoll({label:d.toUpperCase(),d20:r.rolls[0],bonus:0,total:r.total,rolls:r.rolls}); }}>
              {d}
            </button>
          ))}
        </div>
      </Frame>

      {/* Quick attr tests */}
      <Frame style={{ padding:"14px" }}>
        <OrnDiv label="Testes Rápidos"/>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:12 }}>
          {ATTR_KEYS.map((k,i)=>(
            <div key={k} onClick={()=>rollAttr(k)} role="button" tabIndex={0}
              onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&rollAttr(k)}
              style={{ textAlign:"center",padding:"10px 4px",cursor:"pointer",
                background:"rgba(0,0,0,0.32)",border:"1px solid rgba(201,168,76,0.16)",
                borderRadius:2,transition:"all 0.18s",position:"relative" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=theme.accent;
                e.currentTarget.style.background=`${theme.accent}10`; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgba(201,168,76,0.16)";
                e.currentTarget.style.background="rgba(0,0,0,0.32)"; }}>
              <span style={{ position:"absolute",top:4,right:5,fontFamily:"Cinzel,serif",
                fontSize:9,color:"rgba(201,168,76,0.4)" }}>{i+1}</span>
              <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.18em",
                textTransform:"uppercase",color:GOLD,marginBottom:5 }}>{ATTR_FULL[k].slice(0,3)}</div>
              <div style={{ fontFamily:"Cinzel Decorative,serif",fontSize:26,
                color:theme.glow,lineHeight:1 }}>{attrs[k]}</div>
              <div style={{ fontFamily:"Cinzel,serif",fontSize:11,fontWeight:700,
                color:"var(--cream-dim,#9a8a74)",marginTop:4 }}>{fmtMod(atMod(attrs[k]))}</div>
            </div>
          ))}
        </div>
      </Frame>

      {/* Arsenal */}
      <Frame style={{ padding:"14px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
          <OrnDiv label="Arsenal"/>
          <button onClick={()=>setAtkModal({nome:"",bonus:"",dano:"",tipo:""})}
            style={{ marginLeft:12,padding:"5px 14px",background:`${theme.accent}18`,
              border:`1px solid ${theme.accent}55`,borderRadius:2,
              color:theme.glow,fontFamily:"Cinzel,serif",fontSize:9,
              letterSpacing:"0.12em",cursor:"pointer" }}>+ ADICIONAR</button>
        </div>
        {attacks.length===0 ? (
          <div style={{ fontFamily:"Crimson Pro,serif",fontSize:16,color:"var(--cream-dim,#9a8a74)",
            textAlign:"center",padding:"16px 0",fontStyle:"italic",opacity:0.55 }}>
            Nenhum ataque cadastrado.
          </div>
        ) : attacks.map((a,i)=>(
          <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 60px 80px 60px 28px",
            gap:6,alignItems:"center",padding:"9px 12px",marginBottom:6,
            background:"rgba(0,0,0,0.28)",border:"1px solid rgba(255,255,255,0.06)",
            borderRadius:2,transition:"border-color 0.18s" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=`${theme.accent}55`}
            onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.06)"}>
            <span style={{ fontFamily:"Cinzel,serif",fontSize:12,color:"var(--cream,#ede0c4)",cursor:"pointer" }} onClick={()=>rollAtk(a)}>{a.nome}</span>
            <span style={{ fontFamily:"Cinzel,serif",fontSize:12,color:theme.glow,cursor:"pointer" }} onClick={()=>rollAtk(a)}>{a.bonus||"—"}</span>
            <span style={{ fontFamily:"Crimson Pro,serif",fontSize:13,color:"#ef9a9a",cursor:"pointer" }}
              onClick={()=>{ const r=rollX(a.dano); if(r) setRoll({label:`${a.nome} — Dano`,d20:r.rolls[0],bonus:0,total:r.total,rolls:r.rolls}); }}>
              {a.dano||"—"}
            </span>
            <span style={{ fontFamily:"Crimson Pro,serif",fontSize:12,color:"var(--cream-dim,#9a8a74)" }}>{a.tipo||"—"}</span>
            <button onClick={()=>setAttacks(v=>v.filter((_,j)=>j!==i))}
              style={{ background:"none",border:"none",color:"var(--cream-dim,#9a8a74)",cursor:"pointer",fontSize:15,opacity:0.5 }}>×</button>
          </div>
        ))}
      </Frame>

      {/* Spell slots */}
      <Frame style={{ padding:"14px" }}>
        <OrnDiv label="Espaços de Magia"/>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:12 }}>
          {[1,2,3,4,5,6,7,8,9].map(lvl=>{
            const s=spellSlots[lvl]; const avail=s.max-s.used;
            return (
              <div key={lvl} style={{ textAlign:"center",padding:"9px 6px",
                background:"rgba(0,0,0,0.32)",border:`1px solid ${avail>0?theme.accent+"44":"rgba(255,255,255,0.07)"}`,
                borderRadius:2,transition:"all 0.2s" }}>
                <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.15em",
                  color:"var(--cream-dim,#9a8a74)",marginBottom:5 }}>NÍVEL {lvl}</div>
                <div style={{ fontFamily:"Cinzel Decorative,serif",fontSize:22,
                  color:avail>0?theme.glow:"rgba(255,255,255,0.2)",lineHeight:1 }}>
                  {avail}<span style={{ fontSize:10,color:"var(--cream-dim,#9a8a74)",fontFamily:"Cinzel,serif" }}>/{s.max}</span>
                </div>
                <div style={{ display:"flex",justifyContent:"center",gap:3,marginTop:6 }}>
                  {Array.from({length:Math.max(s.max,0)},(_,i)=>(
                    <div key={i} onClick={()=>setSpellSlots(x=>({...x,[lvl]:{...x[lvl],used:i<s.used?i:i+1}}))}
                      style={{ width:8,height:8,borderRadius:"50%",cursor:"pointer",
                        background:i<s.used?"transparent":theme.glow,
                        border:`1px solid ${i<s.used?"rgba(255,255,255,0.16)":theme.glow}`,
                        boxShadow:i<s.used?"none":`0 0 6px ${theme.glow}77`,transition:"all 0.15s" }}/>
                  ))}
                </div>
                {editMode&&(
                  <input type="number" value={s.max} min={0} max={9}
                    onChange={e=>setSpellSlots(x=>({...x,[lvl]:{...x[lvl],max:+e.target.value}}))}
                    style={{ ...INP,fontSize:11,marginTop:6,textAlign:"center",padding:"2px 4px" }}/>
                )}
              </div>
            );
          })}
        </div>
      </Frame>
    </div>
  );

  /* ── MAGIAS ── */
  const renderMagias=()=>(
    <div style={{ display:"flex",flexDirection:"column",gap:10,padding:"14px" }}>
      <div style={{ display:"flex",gap:8 }}>
        <input value={spellQ} onChange={e=>setSpellQ(e.target.value)}
          placeholder="Buscar magia ou escola…" className="dnd-scroll-inp" style={{ flex:1 }}/>
        <select value={spellLvl} onChange={e=>setSpellLvl(e.target.value)}
          style={{ ...INP,width:"auto",minWidth:90,padding:"4px 8px",
            background:"rgba(8,6,16,0.92)",border:"1px solid rgba(201,168,76,0.3)" }}>
          <option value="all">Todos</option>
          <option value="0">Truques</option>
          {[1,2,3,4,5,6,7,8,9].map(n=><option key={n} value={String(n)}>Nível {n}</option>)}
        </select>
      </div>
      <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.15em",
        color:"var(--cream-dim,#9a8a74)",textTransform:"uppercase" }}>
        {filteredSpells.length} magias encontradas
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
        {filteredSpells.map((s,i)=><SpellCard key={i} spell={s}/>)}
      </div>
    </div>
  );

  /* ── INVENTÁRIO ── */
  const renderInventario=()=>(
    <div style={{ display:"flex",flexDirection:"column",gap:12,padding:"14px" }}>
      <Frame style={{ padding:"12px 14px" }}>
        <OrnDiv label="Riqueza"/>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:12 }}>
          {[["pp","Platina","#b0bec5"],["po","Ouro",GOLD],["pe","Prata","#90a4ae"],["pc","Cobre","#bf8660"]].map(([k,l,c])=>(
            <div key={k} style={{ textAlign:"center" }}>
              <div style={{ width:30,height:30,borderRadius:"50%",background:`${c}18`,
                border:`1.5px solid ${c}55`,margin:"0 auto 8px",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:14,color:c,fontFamily:"Cinzel,serif" }}>{l[0]}</div>
              <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.14em",
                color:c,marginBottom:5 }}>{l.toUpperCase()}</div>
              {editMode ? (
                <input type="number" value={gold[k]} min={0}
                  onChange={e=>setGold(g=>({...g,[k]:+e.target.value}))}
                  style={{ ...INP,textAlign:"center",fontFamily:"Cinzel Decorative,serif",fontSize:18 }}/>
              ) : (
                <div style={{ fontFamily:"Cinzel Decorative,serif",fontSize:24,color:c,lineHeight:1 }}>{gold[k]}</div>
              )}
            </div>
          ))}
        </div>
      </Frame>

      <Frame style={{ padding:"12px 14px" }}>
        <OrnDiv label="Adicionar Item"/>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 44px 64px",gap:6,marginTop:10,marginBottom:6 }}>
          <input value={invIn.nome} onChange={e=>setInvIn(x=>({...x,nome:e.target.value}))} placeholder="Nome" style={INP}/>
          <input type="number" value={invIn.qtd} min={1} onChange={e=>setInvIn(x=>({...x,qtd:+e.target.value}))} style={INP}/>
          <input value={invIn.peso} onChange={e=>setInvIn(x=>({...x,peso:e.target.value}))} placeholder="Peso" style={INP}/>
        </div>
        <input value={invIn.desc} onChange={e=>setInvIn(x=>({...x,desc:e.target.value}))}
          placeholder="Descrição (opcional)" style={{ ...INP,marginBottom:8 }}/>
        <button onClick={()=>{ if(!invIn.nome.trim()) return;
          setInventario(v=>[...v,{...invIn,id:Date.now()}]); setInvIn({nome:"",qtd:1,peso:"",desc:""}); }}
          style={{ width:"100%",padding:"9px 0",background:`${theme.accent}18`,
            border:`1px solid ${theme.accent}55`,borderRadius:2,
            color:theme.glow,fontFamily:"Cinzel,serif",fontSize:10,
            letterSpacing:"0.14em",cursor:"pointer" }}>
          ADICIONAR AO INVENTÁRIO
        </button>
      </Frame>

      {inventario.length===0 ? (
        <div style={{ fontFamily:"Crimson Pro,serif",fontSize:16,color:"var(--cream-dim,#9a8a74)",
          textAlign:"center",padding:"24px",fontStyle:"italic",opacity:0.5 }}>
          A mochila está vazia. A masmorra aguarda…
        </div>
      ) : inventario.map((item,i)=>(
        <div key={item.id||i} className="dnd-item-row">
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"Cinzel,serif",fontSize:12,color:"var(--cream,#ede0c4)" }}>{item.nome}</div>
            {item.desc&&<div style={{ fontFamily:"Crimson Pro,serif",fontSize:13,color:"var(--cream-dim,#9a8a74)",marginTop:2 }}>{item.desc}</div>}
          </div>
          <span style={{ fontFamily:"Cinzel,serif",fontSize:11,color:"var(--cream-dim,#9a8a74)",flexShrink:0 }}>×{item.qtd}</span>
          {item.peso&&<span style={{ fontFamily:"Cinzel,serif",fontSize:11,color:"var(--cream-dim,#9a8a74)",minWidth:38,textAlign:"right",flexShrink:0 }}>{item.peso}kg</span>}
          <button onClick={()=>setInventario(v=>v.filter((_,j)=>j!==i))}
            style={{ background:"none",border:"none",color:"var(--cream-dim,#9a8a74)",cursor:"pointer",fontSize:15,opacity:0.45 }}>×</button>
        </div>
      ))}
    </div>
  );

  /* ── DESCRIÇÃO ── */
  const renderDescricao=()=>(
    <div style={{ display:"flex",flexDirection:"column",gap:12,padding:"14px" }}>
      {editMode&&(
        <Frame style={{ padding:"14px" }}>
          <OrnDiv label="Identidade"/>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12 }}>
            {[["personagem","Nome"],["raca","Raça"],["classe","Classe"],
              ["antecedente","Antecedente"],["alinhamento","Alinhamento"],["jogador","Jogador"]].map(([k,l])=>(
              <div key={k}>
                <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.14em",color:GOLD,marginBottom:3 }}>{l.toUpperCase()}</div>
                <input value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={INP}/>
              </div>
            ))}
          </div>
        </Frame>
      )}
      {[["aparencia","Aparência","Descreva a aparência do personagem…"],
        ["personalidade","Personalidade & Ideais","Traços de personalidade, ideais, vínculos e fraquezas."],
        ["historico","Histórico","A história de vida e os eventos que moldaram este aventureiro."],
        ["objetivo","Objetivos","O que motiva e impulsiona este personagem?"],
        ["anotacoes","Anotações de Sessão","Segredos, pistas, NPCs, eventos importantes…"],
      ].map(([k,lbl,ph])=>(
        <Frame key={k} style={{ padding:"14px" }}>
          <OrnDiv label={lbl}/>
          {editMode ? (
            <textarea value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
              placeholder={ph} rows={4}
              style={{ ...INP,resize:"vertical",lineHeight:1.68,fontFamily:"Crimson Pro,serif",
                fontSize:15,marginTop:10 }}/>
          ) : (
            <div style={{ fontFamily:"Crimson Pro,serif",fontSize:16,
              color:form[k]?"var(--cream,#ede0c4)":"var(--cream-dim,#9a8a74)",
              lineHeight:1.7,fontStyle:form[k]?"normal":"italic",
              whiteSpace:"pre-wrap",marginTop:10,minHeight:22 }}>
              {form[k]||ph}
            </div>
          )}
        </Frame>
      ))}

      <Frame style={{ padding:"14px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <OrnDiv label="Talentos"/>
          {editMode&&(
            <select value="" onChange={e=>{ const t=talentos.find(x=>x.nome===e.target.value);
              if(t&&!myTal.find(x=>x.nome===t.nome)) setMyTal(v=>[...v,t]); }}
              style={{ ...INP,width:"auto",marginLeft:12,fontSize:12 }}>
              <option value="">+ adicionar…</option>
              {talentos.map(t=><option key={t.nome} value={t.nome}>{t.nome}</option>)}
            </select>
          )}
        </div>
        {myTal.length===0 ? (
          <div style={{ fontFamily:"Crimson Pro,serif",fontSize:16,color:"var(--cream-dim,#9a8a74)",fontStyle:"italic",opacity:0.55 }}>
            Nenhum talento selecionado.
          </div>
        ) : myTal.map((t,i)=>(
          <div key={i} style={{ marginBottom:10,padding:"10px 12px",borderRadius:2,
            background:`${theme.accent}08`,border:`1px solid ${theme.accent}22` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
              <span style={{ fontFamily:"Cinzel,serif",fontSize:12,color:theme.glow }}>{t.nome}</span>
              {editMode&&<button onClick={()=>setMyTal(v=>v.filter((_,j)=>j!==i))}
                style={{ background:"none",border:"none",color:"var(--cream-dim,#9a8a74)",cursor:"pointer",fontSize:13 }}>×</button>}
            </div>
            <div style={{ fontFamily:"Crimson Pro,serif",fontSize:14,color:"var(--cream-dim,#9a8a74)",lineHeight:1.65 }}>{t.beneficio}</div>
          </div>
        ))}
      </Frame>
    </div>
  );

  const TABS=[["pericias","⬡ Perícias"],["combate","⚔ Combate"],
    ["magias","✦ Magias"],["inventario","⚖ Inventário"],["descricao","📜 Descrição"]];
  const TAB_RENDER={pericias:renderPericias,combate:renderCombate,
    magias:renderMagias,inventario:renderInventario,descricao:renderDescricao};

  /* ══════ ROOT ══════ */
  return (
    <div className="dnd-root dnd-fill dnd-bg dnd-grain" style={{ ...rootVars, position:"relative" }}>
      <DnDSheetStyles/>
      <D20Bg color={GOLD}/>

      {/* Vignette */}
      <div className={`dnd-vignette${wounded?" on":""}`}/>
      {wounded&&<div className="dnd-watermark">{theme.word}</div>}

      {/* ══ DRAMATIC HEADER ══ */}
      <div className="dnd-banner" style={{ position:"sticky",top:0,zIndex:10 }}>
        {/* Top controls bar */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"10px 20px 8px",borderBottom:"1px solid rgba(201,168,76,0.1)",flexWrap:"wrap",gap:8 }}>
          <button onClick={handleBack}
            style={{ background:"none",border:"1px solid rgba(201,168,76,0.28)",borderRadius:2,
              color:"var(--cream-dim,#9a8a74)",cursor:"pointer",padding:"6px 16px",
              fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:"0.12em",transition:"all 0.18s",flexShrink:0 }}
            onMouseEnter={e=>{e.currentTarget.style.color=GOLD;e.currentTarget.style.borderColor=GOLD;}}
            onMouseLeave={e=>{e.currentTarget.style.color="var(--cream-dim,#9a8a74)";e.currentTarget.style.borderColor="rgba(201,168,76,0.28)";}}>
            ← VOLTAR
          </button>

          {/* Class + Race + Level info */}
          <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",flex:1,justifyContent:"center" }}>
            {[form.classe||"Aventureiro",form.raca||"Sem raça",`Nível ${nivel}`,form.antecedente].filter(Boolean).map((v,i,arr)=>(
              <span key={i} style={{ display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:"0.2em",
                  textTransform:"uppercase",color:i===0?theme.glow:"var(--cream-dim,#9a8a74)",
                  fontWeight:i===0?700:400 }}>{v}</span>
                {i<arr.length-1&&<span style={{ color:"rgba(201,168,76,0.3)",fontSize:8 }}>·</span>}
              </span>
            ))}
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
            {savedAt&&!dirty&&(
              <span style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.1em",
                color:"rgba(201,168,76,0.4)",textTransform:"uppercase" }}>✓ salvo</span>
            )}
            <button onClick={()=>setShowHelp(v=>!v)}
              style={{ background:"none",border:"1px solid rgba(201,168,76,0.2)",borderRadius:2,
                color:"var(--cream-dim,#9a8a74)",cursor:"pointer",width:30,height:30,
                fontFamily:"Cinzel,serif",fontSize:12,transition:"all 0.15s" }}>?</button>
            <button onClick={()=>setEditMode(v=>!v)}
              style={{ background:editMode?`${theme.accent}18`:"none",
                border:`1px solid ${editMode?theme.accent:"rgba(201,168,76,0.22)"}`,
                borderRadius:2,color:editMode?theme.glow:"var(--cream-dim,#9a8a74)",
                cursor:"pointer",padding:"6px 16px",
                fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:"0.1em",transition:"all 0.18s" }}>
              {editMode?"🔓 EDITANDO":"🔒 TRAVADO"}
            </button>
          </div>
        </div>

        {/* Character name band */}
        <div style={{ padding:"14px 24px 16px",position:"relative",textAlign:"center" }}>
          {/* Class seal left */}
          <div style={{ position:"absolute",left:20,top:"50%",transform:"translateY(-50%)" }}>
            <div className="dnd-seal">
              <span style={{ fontSize:26,filter:`drop-shadow(0 0 10px ${theme.glow})`,position:"relative",zIndex:1 }}>
                {theme.icon}
              </span>
            </div>
          </div>

          {/* Top ornament */}
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:8,justifyContent:"center" }}>
            <div style={{ width:80,height:1,background:`linear-gradient(90deg,transparent,${GOLD}66)` }}/>
            <span style={{ color:GOLD,fontSize:10 }}>❖</span>
            <span style={{ color:`${GOLD}88`,fontSize:8 }}>◆</span>
            <span style={{ color:GOLD,fontSize:10 }}>❖</span>
            <div style={{ width:80,height:1,background:`linear-gradient(90deg,${GOLD}66,transparent)` }}/>
          </div>

          {/* HUGE character name */}
          <h1 className={`dnd-name-glitch${wounded?" on":""}`}
            style={{ fontFamily:"Cinzel Decorative,Cinzel,serif",
              fontSize:"clamp(24px,4vw,52px)", color:GOLD_HI, lineHeight:1.05, margin:0,
              letterSpacing:"0.06em",
              textShadow:`0 0 50px ${theme.glow}44, 0 4px 24px rgba(0,0,0,0.9)` }}>
            {charName}
          </h1>

          {/* Bottom ornament */}
          <div style={{ display:"flex",alignItems:"center",gap:12,marginTop:8,justifyContent:"center" }}>
            <div style={{ width:80,height:1,background:`linear-gradient(90deg,transparent,${GOLD}44)` }}/>
            <span style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.3em",
              textTransform:"uppercase",color:`${GOLD}88` }}>{form.classe||"Aventureiro"}</span>
            <div style={{ width:80,height:1,background:`linear-gradient(90deg,${GOLD}44,transparent)` }}/>
          </div>
        </div>

        {showHelp&&(
          <div style={{ margin:"0 20px 10px",padding:"8px 14px",
            background:"rgba(0,0,0,0.5)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:2,
            display:"flex",gap:20,flexWrap:"wrap" }}>
            {[["R","abrir rolador"],["E","modo edição"],["1–6","testar atributos"]].map(([k,v])=>(
              <span key={k} style={{ fontFamily:"Share Tech Mono,monospace",fontSize:11,
                color:"var(--cream-dim,#9a8a74)" }}>
                <strong style={{ color:GOLD }}>{k}</strong>  {v}
              </span>
            ))}
          </div>
        )}

        {/* Mobile nav */}
        <div className="dnd-mob-nav" style={{ marginTop:0 }}>
          {[["ficha","⚔ Ficha"],["habilidades","⬡ Habilidades"]].map(([id,lbl])=>(
            <button key={id} className={`dnd-mob-btn${mobileSec===id?" on":""}`}
              onClick={()=>setMobileSec(id)}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* ══ MAIN LAYOUT ══ */}
      <div className="dnd-layout" style={{ padding:"14px 18px 28px",gap:16 }}>
        {renderSidebar()}

        {/* Right panel */}
        <div className={`dnd-main${mobileSec==="ficha"&&typeof window!=="undefined"&&window.innerWidth<=768?" dnd-mob-hide":""}`}
          style={{ border:"1px solid rgba(201,168,76,0.14)",borderRadius:2,
            background:"rgba(6,4,12,0.7)",overflow:"hidden" }}>
          <div className="dnd-tabs" ref={tabsPill.containerRef} style={{ position:"sticky",top:0,zIndex:5 }}>
            <SlidingTabPill pill={tabsPill.pill} background="rgba(201,168,76,0.08)"
              underline="var(--gold)" topLine="linear-gradient(90deg,transparent,var(--gold-hi),transparent)" />
            {TABS.map(([id,lbl])=>(
              <button key={id} ref={tabsPill.setItemRef(id)} className={`dnd-tab${activeTab===id?" on":""}`} onClick={()=>setActiveTab(id)}>{lbl}</button>
            ))}
          </div>
          {(TAB_RENDER[activeTab]||TAB_RENDER.pericias)()}
        </div>
      </div>

      {/* Attack modal */}
      {atkModal&&(
        <div onClick={()=>setAtkModal(null)}
          style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:5000,
            display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <div onClick={e=>e.stopPropagation()}
            style={{ background:"#09070f",borderRadius:3,padding:26,
              width:"100%",maxWidth:390,position:"relative" }}>
            <Frame accent={theme.accent} style={{ position:"absolute",inset:0,borderRadius:3,border:`1px solid ${theme.accent}55` }}>
              <div/>
            </Frame>
            <div style={{ position:"relative",zIndex:2 }}>
              <OrnDiv label="Novo Ataque" accent={theme.accent}/>
              <div style={{ marginTop:14,display:"flex",flexDirection:"column",gap:10 }}>
                {[["nome","Nome do Ataque"],["bonus","Bônus (ex: +5)"],["dano","Dano (ex: 2d6+3)"],["tipo","Tipo (ex: Cortante)"]].map(([k,l])=>(
                  <div key={k}>
                    <div style={{ fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.14em",
                      color:theme.glow,marginBottom:3 }}>{l.toUpperCase()}</div>
                    <input value={atkModal[k]||""} onChange={e=>setAtkModal(m=>({...m,[k]:e.target.value}))} style={INP}/>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex",gap:10,marginTop:18 }}>
                <button onClick={()=>setAtkModal(null)}
                  style={{ flex:1,padding:"9px 0",background:"none",
                    border:"1px solid rgba(255,255,255,0.1)",borderRadius:2,
                    color:"var(--cream-dim,#9a8a74)",fontFamily:"Cinzel,serif",
                    fontSize:10,letterSpacing:"0.1em",cursor:"pointer" }}>CANCELAR</button>
                <button onClick={()=>{ if(atkModal.nome.trim()){setAttacks(v=>[...v,atkModal]);setAtkModal(null);} }}
                  style={{ flex:1,padding:"9px 0",background:`${theme.accent}28`,
                    border:`1px solid ${theme.accent}77`,borderRadius:2,
                    color:theme.glow,fontFamily:"Cinzel,serif",fontSize:10,
                    letterSpacing:"0.1em",cursor:"pointer" }}>ADICIONAR</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dice results */}
      {roll&&(roll.d20===20||roll.d20===1 ? (
        <DiceOverlay roll={roll} onClose={()=>setRoll(null)}/>
      ) : (
        <CornerCard roll={roll} onClose={()=>setRoll(null)}/>
      ))}
    </div>
  );
}

const INP = {
  width:"100%", background:"rgba(8,6,16,0.88)", border:"1px solid rgba(201,168,76,0.22)",
  borderRadius:2, color:"var(--cream,#ede0c4)", fontFamily:"Crimson Pro,serif", fontSize:15,
  padding:"5px 9px", boxSizing:"border-box", outline:"none",
};
