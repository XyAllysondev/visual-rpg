import { useState } from "react";

/* ═══════════════════════════════
   ROADMAP
═══════════════════════════════ */
const ROADMAP_STATUS = {
  done:    { dot:"#4caf50", badge:"Pronto",    bg:"rgba(76,175,80,0.1)",    color:"#7ecb82", border:"rgba(76,175,80,0.28)" },
  planned: { dot:"#8e6dbf", badge:"Planejado", bg:"rgba(142,109,191,0.1)", color:"#c8a8f0", border:"rgba(142,109,191,0.28)" },
  backlog: { dot:"#3d3554", badge:"Backlog",   bg:"rgba(50,45,70,0.5)",    color:"#6b6488", border:"rgba(80,72,108,0.3)" },
};

export default function RoadmapItem({ item }) {
  const [hov, setHov] = useState(false);
  const s = ROADMAP_STATUS[item.status];
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"7px 10px", borderRadius:5,
        background: hov ? "rgba(255,255,255,0.03)" : "transparent",
        border:`1px solid ${hov ? "rgba(201,168,76,0.1)" : "transparent"}`,
        transition:"all 0.18s",
      }}
    >
      <div style={{
        width:7, height:7, borderRadius:"50%", background:s.dot, flexShrink:0,
        boxShadow: item.status === "done" ? `0 0 5px ${s.dot}99` : "none",
      }}/>
      <span style={{
        fontFamily:"'Crimson Pro',serif", fontSize:14, flex:1,
        color: item.status === "backlog" ? "var(--muted)" : "var(--muted2)",
        lineHeight:1.3,
      }}>{item.nome}</span>
      <div style={{
        padding:"2px 8px", borderRadius:3, flexShrink:0,
        background:s.bg, color:s.color, border:`1px solid ${s.border}`,
        fontFamily:"Cinzel,serif", fontSize:7, letterSpacing:"0.1em", textTransform:"uppercase",
      }}>{s.badge}</div>
    </div>
  );
}
