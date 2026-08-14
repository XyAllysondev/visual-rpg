import { useState, useEffect, useRef } from "react";

/* ══════════════════════════════════════════
   DICE ROLL POPUP — regra OP (N d20, pega o maior; atributo 0 pega o PIOR)
   vive em src/domain/dice.js → rollOP
══════════════════════════════════════════ */

/* ── Attribute Diagram SVG — clickable nodes with roll popup ── */
const AttrDiagram = ({ attrs, onChange, onEdit, onRoll, readOnly = false }) => {
  const [editing, setEditing] = useState(null);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const positions = {
    AGI: { x:160, y:30  },
    FOR: { x:50,  y:145 },
    INT: { x:270, y:145 },
    PRE: { x:90,  y:260 },
    VIG: { x:230, y:260 },
  };
  const center = { x:160, y:178 };
  const LABELS = { AGI:"AGILIDADE", FOR:"FORÇA", INT:"INTELECTO", PRE:"PRESENÇA", VIG:"VIGOR" };

  const startEdit = (key) => {
    setEditing(key);
    setInputVal(String(attrs[key]));
  };

  const commitEdit = () => {
    if (!editing) return;
    const parsed = parseInt(inputVal, 10);
    const newVal = isNaN(parsed) ? attrs[editing] : Math.max(0, Math.min(99, parsed));
    if (onEdit) onEdit(editing, newVal);
    setEditing(null);
  };

  const RUNES = "ᚠᚢᚦᚨᚱ·ᚲᚷᚹᚺᚾ·ᛁᛃᛇᛈᛉ·ᛊᛏᛒᛖᛗ·ᛚᛜᛞᛟ·";
  const circPath = (cx, cy, r) =>
    `M ${cx - r} ${cy} a ${r} ${r} 0 1 1 ${2*r} 0 a ${r} ${r} 0 1 1 ${-2*r} 0`;
  /* Pentagon order: AGI → INT → VIG → PRE → FOR (clockwise) */
  const pentOrder = ["AGI","INT","VIG","PRE","FOR"];

  return (
    <svg viewBox="-10 -28 340 390" style={{display:"block",width:"100%",height:"auto"}}>
      <defs>
        <radialGradient id="cg-center" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#f5e07a" stopOpacity="1"/>
          <stop offset="55%"  stopColor="#c9a84c" stopOpacity="1"/>
          <stop offset="100%" stopColor="#7a5c18" stopOpacity="1"/>
        </radialGradient>
        <radialGradient id="cg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#c9a84c" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#c9a84c" stopOpacity="0"/>
        </radialGradient>
        <filter id="ag2"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="glow-soft"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        {Object.entries(positions).map(([k,p])=>(
          <path key={k} id={`rp-${k}`} d={circPath(p.x, p.y, 47)} fill="none"/>
        ))}
        <path id="rp-center" d={circPath(center.x, center.y, 59)} fill="none"/>
      </defs>

      <style>{`
        @keyframes sigil-pulse {
          0%, 55%, 100% { fill: rgba(201,168,76,0.60); filter: none; }
          60%  { fill: rgba(255,235,90,1);   filter: drop-shadow(0 0 7px rgba(255,210,60,1)) drop-shadow(0 0 14px rgba(201,168,76,0.7)); }
          72%  { fill: rgba(255,215,65,0.85); filter: drop-shadow(0 0 4px rgba(255,190,40,0.6)); }
          88%  { fill: rgba(201,168,76,0.65); filter: none; }
        }
        .sigil-ring { animation: sigil-pulse 8s ease-in-out infinite; }
        @keyframes sigil-center-pulse {
          0%, 60%, 100% { fill: rgba(30,18,4,0.65); }
          65%  { fill: rgba(80,45,5,1); filter: drop-shadow(0 0 5px rgba(180,120,20,0.6)); }
          80%  { fill: rgba(30,18,4,0.65); filter: none; }
        }
        .sigil-center { animation: sigil-center-pulse 10s ease-in-out infinite; }
      `}</style>

      {/* Pentagon outline between adjacent nodes */}
      <polygon
        points={pentOrder.map(k=>`${positions[k].x},${positions[k].y}`).join(" ")}
        fill="none" stroke="rgba(201,168,76,0.28)" strokeWidth="1.2"/>

      {/* Radial spokes from center to each node */}
      {Object.entries(positions).map(([k,p])=>(
        <line key={k} x1={center.x} y1={center.y} x2={p.x} y2={p.y}
          stroke="rgba(201,168,76,0.32)" strokeWidth="1.2"/>
      ))}

      {/* Center glow halo */}
      <circle cx={center.x} cy={center.y} r="66" fill="url(#cg-glow)"/>

      {/* Center — bright golden fill like the reference image */}
      <circle cx={center.x} cy={center.y} r="52" fill="url(#cg-center)"
        stroke="rgba(201,168,76,0.9)" strokeWidth="1.5" filter="url(#glow-soft)"/>
      <circle cx={center.x} cy={center.y} r="49" fill="none"
        stroke="rgba(255,240,160,0.35)" strokeWidth="0.75"/>
      {/* Rune ring just outside the center circle */}
      <text fontSize="10" className="sigil-center" letterSpacing="2.5">
        <textPath href="#rp-center">{RUNES.repeat(3)}</textPath>
      </text>
      <text x={center.x} y={center.y-5} textAnchor="middle" fontFamily="Cinzel,serif"
        fontSize="11" fill="#1a1004" letterSpacing="2" fontWeight="700">ATRIBUTOS</text>
      <text x={center.x} y={center.y+10} textAnchor="middle" fontFamily="Cinzel,serif"
        fontSize="7" fill="#3a2808" letterSpacing="1">ORDEM PARANORMAL</text>
      <text x={center.x} y={center.y+22} textAnchor="middle" fontFamily="Cinzel,serif"
        fontSize="6.5" fill="#3a2808">Clique p/ rolar</text>

      {/* Attribute nodes */}
      {Object.entries(positions).map(([key,p], i)=>{
        const val = attrs[key];
        const isEditing = editing === key;
        return (
          <g key={key}>
            {/* Outer sigil ring (solid thin border + rune text) */}
            <circle cx={p.x} cy={p.y} r="56" fill="none"
              stroke="rgba(201,168,76,0.20)" strokeWidth="0.75"/>
            <text fontSize="10" className="sigil-ring"
              style={{animationDelay:`${i * 1.6}s`}} letterSpacing="2.5">
              <textPath href={`#rp-${key}`}>{RUNES.repeat(2)}</textPath>
            </text>
            {/* Inner dashed accent ring */}
            <circle cx={p.x} cy={p.y} r="36" fill="none"
              stroke="rgba(201,168,76,0.30)" strokeWidth="0.75" strokeDasharray="1.5,3.5"/>
            {/* Main dark circle */}
            <circle cx={p.x} cy={p.y} r="33" fill="rgba(5,5,5,0.97)"
              stroke={isEditing ? "rgba(201,168,76,0.9)" : "rgba(201,168,76,0.6)"}
              strokeWidth={isEditing ? "2" : "1.5"} filter="url(#ag2)"
              style={{cursor: onRoll && !isEditing ? "pointer" : "default"}}
              onClick={()=> !isEditing && onRoll && onRoll(key)}/>
            <circle cx={p.x} cy={p.y} r="27" fill="#060606"
              stroke="rgba(201,168,76,0.2)" strokeWidth="1"
              style={{cursor: onRoll && !isEditing ? "pointer" : "default"}}
              onClick={()=> !isEditing && onRoll && onRoll(key)}/>
            {/* Value */}
            {isEditing ? (
              <foreignObject x={p.x-21} y={p.y-19} width="42" height="26">
                <input
                  ref={inputRef}
                  type="number" min="0" max="99"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  style={{
                    width:"100%", height:"100%", textAlign:"center",
                    background:"rgba(0,0,0,0.95)",
                    border:"1px solid rgba(201,168,76,0.85)",
                    color:"#e8c96d",
                    fontFamily:"'Cinzel Decorative',serif",
                    fontSize:"15px", fontWeight:"700",
                    borderRadius:"3px", padding:0, outline:"none",
                    boxSizing:"border-box",
                    MozAppearance:"textfield",
                  }}
                />
              </foreignObject>
            ) : (
              <>
                <text x={p.x} y={p.y-2} textAnchor="middle"
                  fontFamily="Cinzel Decorative,serif" fontSize="20"
                  fill="#e8c96d" fontWeight="700"
                  style={{cursor: onEdit ? "text" : onRoll ? "pointer" : "default"}}
                  onClick={e => { e.stopPropagation(); onEdit ? startEdit(key) : onRoll && onRoll(key); }}>
                  {val}
                </text>
                {onEdit && (
                  <line x1={p.x-11} y1={p.y+7} x2={p.x+11} y2={p.y+7}
                    stroke="rgba(201,168,76,0.75)" strokeWidth="1.5" strokeLinecap="round"/>
                )}
              </>
            )}
            <text x={p.x} y={p.y+11} textAnchor="middle" fontFamily="Cinzel,serif"
              fontSize="6.5" fill="#b0a07a" letterSpacing="1"
              style={{cursor: onRoll && !isEditing ? "pointer" : "default"}}
              onClick={()=> !isEditing && onRoll && onRoll(key)}>{LABELS[key]}</text>
            <text x={p.x} y={p.y+21} textAnchor="middle" fontFamily="Cinzel,serif"
              fontSize="10" fill="#c9a84c" fontWeight="600"
              style={{cursor: onRoll && !isEditing ? "pointer" : "default"}}
              onClick={()=> !isEditing && onRoll && onRoll(key)}>{key}</text>
            {/* +/- only in creator mode */}
            {!readOnly && onChange && (
              <>
                <rect x={p.x-27} y={p.y+24} width="18" height="12" rx="3" fill="rgba(201,168,76,0.1)" stroke="rgba(201,168,76,0.3)" strokeWidth="1" style={{cursor:"pointer"}} onClick={()=>onChange(key,-1)}/>
                <text x={p.x-18} y={p.y+33} textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill="#c9a84c" style={{cursor:"pointer"}} onClick={()=>onChange(key,-1)}>−</text>
                <rect x={p.x+9}  y={p.y+24} width="18" height="12" rx="3" fill="rgba(201,168,76,0.1)" stroke="rgba(201,168,76,0.3)" strokeWidth="1" style={{cursor:"pointer"}} onClick={()=>onChange(key,+1)}/>
                <text x={p.x+18} y={p.y+33} textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill="#c9a84c" style={{cursor:"pointer"}} onClick={()=>onChange(key,+1)}>+</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default AttrDiagram;
