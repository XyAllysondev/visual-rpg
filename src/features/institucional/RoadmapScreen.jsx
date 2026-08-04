import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { roadmapData } from "../../roadmapData";
import RoadmapItem from "./RoadmapItem";

const PHASE_STATUS = {
  done:    { label:"Concluído",    color:"#7ecb82", bg:"rgba(76,175,80,0.08)",    border:"rgba(76,175,80,0.28)",    pulse:false },
  current: { label:"Em andamento", color:"#c9a84c", bg:"rgba(201,168,76,0.08)",  border:"rgba(201,168,76,0.35)",   pulse:true  },
  future:  { label:"Futuro",       color:"#c8a8f0", bg:"rgba(142,109,191,0.08)", border:"rgba(142,109,191,0.28)",  pulse:false },
};

export default function RoadmapScreen() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let W = window.innerWidth, H = window.innerHeight;

    const mkParticles = () => Array.from({ length: 100 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.5 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
    }));

    let particles = mkParticles();

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
      particles = mkParticles();
    };
    canvas.width = W; canvas.height = H;
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -2) p.x = W + 2; else if (p.x > W + 2) p.x = -2;
        if (p.y < -2) p.y = H + 2; else if (p.y > H + 2) p.y = -2;
        p.phase += p.speed * 0.01;
        const alpha = 0.1 + 0.2 * Math.sin(p.phase);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(80,200,255,${alpha})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      {/* Canvas fora de qualquer div com transform — evita o bug de containing-block */}
      {createPortal(
        <canvas ref={canvasRef} style={{
          position:"fixed", top:0, left:0, width:"100vw", height:"100vh",
          pointerEvents:"none", zIndex:0,
        }}/>,
        document.body
      )}

      <div className="fade" style={{ maxWidth:760, margin:"0 auto", padding:"8px 0 40px" }}>
        {/* Hero */}
        <div style={{ textAlign:"center", padding:"20px 0 32px" }}>
          <div style={{ fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:"0.2em", color:"var(--gold)", textTransform:"uppercase", marginBottom:14 }}>◈ Roadmap</div>
          <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:26, fontWeight:700, color:"var(--text)", marginBottom:10, lineHeight:1.25 }}>
            O futuro do{" "}
            <span style={{ background:"linear-gradient(135deg,#c9a84c,#e8c96d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Nexus</span>
          </h1>
          <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:15, color:"var(--muted2)", lineHeight:1.7 }}>
            Cada feature sendo construída com a comunidade.
          </p>
        </div>

        {/* Phases */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {roadmapData.map((fase) => {
            const ps = PHASE_STATUS[fase.status];
            return (
              <div key={fase.fase} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
                <div style={{
                  padding:"18px 24px 14px",
                  borderBottom:"1px solid var(--border)",
                  background: fase.status === "done" ? "rgba(76,175,80,0.03)" : fase.status === "current" ? "rgba(201,168,76,0.03)" : "rgba(142,109,191,0.03)",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
                    <span style={{ fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:"0.18em", color:"var(--muted)", textTransform:"uppercase" }}>FASE {fase.fase}</span>
                    <div style={{
                      padding:"3px 10px", borderRadius:20,
                      background:ps.bg, color:ps.color, border:`1px solid ${ps.border}`,
                      fontFamily:"Cinzel,serif", fontSize:7, letterSpacing:"0.1em", textTransform:"uppercase",
                      animation: ps.pulse ? "pulse 2s infinite" : "none",
                    }}>{ps.label}</div>
                  </div>
                  <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:15, color:"var(--text)", marginBottom:5 }}>{fase.nome}</div>
                  <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:13, color:"var(--muted2)", lineHeight:1.5 }}>{fase.descricao}</div>
                </div>
                <div style={{ padding:"14px 20px 18px" }}>
                  {fase.sections.map((sec, si) => (
                    <div key={si} style={{ marginBottom: si < fase.sections.length - 1 ? 16 : 0 }}>
                      {sec.label && (
                        <div style={{ fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:"0.18em", color:"var(--muted)", textTransform:"uppercase", marginBottom:6, paddingBottom:5, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>{sec.label}</div>
                      )}
                      <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                        {sec.items.map((item, ii) => <RoadmapItem key={ii} item={item} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Card */}
        <div style={{
          marginTop:40, padding:"52px 32px 44px", borderRadius:16, textAlign:"center",
          background:"linear-gradient(160deg,rgba(26,22,14,0.98) 0%,rgba(18,16,10,0.99) 100%)",
          border:"1px solid var(--border2)",
          boxShadow:"0 0 60px var(--gold-dim), inset 0 1px 0 rgba(201,168,76,0.07)",
          position:"relative", overflow:"hidden",
        }}>
          {/* ambient glow */}
          <div style={{
            position:"absolute", top:"40%", left:"50%", transform:"translate(-50%,-50%)",
            width:480, height:220, pointerEvents:"none",
            background:"radial-gradient(ellipse at center, var(--gold-dim) 0%, transparent 70%)",
          }}/>

          {/* thumbs up icon */}
          <div style={{ marginBottom:20, position:"relative" }}>
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none"
              stroke="var(--gold)" strokeWidth="1.4"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ filter:"drop-shadow(0 0 8px var(--gold-glow))" }}>
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
          </div>

          {/* title */}
          <div style={{
            fontFamily:"'Cinzel Decorative',serif", fontSize:20, fontWeight:700,
            color:"var(--text)", marginBottom:14, letterSpacing:"0.02em",
            position:"relative",
          }}>
            Tem uma ideia incrível?
          </div>

          {/* body */}
          <p style={{
            fontFamily:"'Crimson Pro',serif", fontSize:16, color:"var(--muted2)",
            lineHeight:1.75, maxWidth:460, margin:"0 auto 32px", position:"relative",
          }}>
            O Nexus é construído com a comunidade. Vote nas próximas features ou sugira algo novo no nosso Discord.
          </p>

          {/* button */}
          <a href="https://discord.gg/nexusrpg" target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none", position:"relative" }}>
            <button className="btn-gold"
              style={{ padding:"14px 36px", fontSize:"0.78rem", letterSpacing:"0.12em" }}
              onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-2px)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform=""; }}
            >
              Entrar no Discord
            </button>
          </a>
        </div>
      </div>
    </>
  );
}
