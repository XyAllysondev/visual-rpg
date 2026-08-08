import { useState } from "react";
import { SYSTEMS } from "./systems";
import NexusLogo from "../../lib/NexusLogo";
import { ALVO_EXTERNO, DISCORD_URL } from "../../lib/links";
import useReducedMotion from "../../lib/useReducedMotion";
import AmbientBackdrop from "../../ui/AmbientBackdrop";
import Deco from "../../ui/Deco";

/* ═══════════════════════════════
   SYSTEM SELECT
═══════════════════════════════ */
function SystemSelect({ onSelect, onLogout }) {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const reduced = useReducedMotion();

  const handleSelect = (sys) => {
    if (!sys.available) return;
    setSelected(sys.id);
    setTimeout(() => onSelect(sys), 900);
  };

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column", position:"relative", overflow:"hidden"}}>
      <AmbientBackdrop />
      <Deco/>

      {/* Ambient glow */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        background: hovered
          ? `radial-gradient(ellipse at center, ${SYSTEMS.find(s=>s.id===hovered)?.accentGlow||"transparent"} 0%, transparent 65%)`
          : "radial-gradient(ellipse at center, rgba(201,168,76,0.03) 0%, transparent 60%)",
        transition:"background 0.6s ease",
      }}/>

      {/* ── Navbar ── */}
      <nav style={{
        position:"sticky", top:0, zIndex:20, flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 32px", height:64,
        background:"rgba(13,13,13,0.9)", borderBottom:"1px solid rgba(201,168,76,0.12)",
        backdropFilter:"blur(12px)",
      }}>
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <NexusLogo size={48}/>
          <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:14, fontWeight:700,
            background:"linear-gradient(135deg,#c9a84c,#e8c96d)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
            letterSpacing:2}}>⚔ NEXUS</div>
        </div>
        <button onClick={onLogout} style={{
          background:"none", border:"1px solid rgba(201,168,76,0.2)", borderRadius:8,
          cursor:"pointer", color:"var(--muted)", padding:"7px 16px",
          display:"flex", alignItems:"center", gap:7,
          fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1, textTransform:"uppercase",
          transition:"all 0.2s",
        }}
          onMouseEnter={e=>{e.currentTarget.style.color="#c96a6a";e.currentTarget.style.borderColor="rgba(201,100,100,0.4)";}}
          onMouseLeave={e=>{e.currentTarget.style.color="var(--muted)";e.currentTarget.style.borderColor="rgba(201,168,76,0.2)";}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sair
        </button>
      </nav>

      {/* ── Main content ── */}
      <div style={{position:"relative", zIndex:1, flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"48px 24px 60px", width:"100%"}}>
        <div style={{width:"100%", maxWidth:1040}}>

          {/* Hero */}
          <div style={{textAlign:"center", marginBottom:48}}>
            <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:11, letterSpacing:5,
              color:"var(--muted)", textTransform:"uppercase", marginBottom:10}}>
              Bem-vindo ao Nexus
            </div>
            <h1 style={{
              fontFamily:"'Cinzel Decorative',serif", fontSize:"clamp(20px,4vw,32px)", fontWeight:700,
              background:"linear-gradient(135deg,#c9a84c,#e8c96d,#a07830)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
              letterSpacing:2, marginBottom:12,
            }}>Escolha seu Sistema</h1>
            <p style={{fontFamily:"Crimson Pro,serif", fontSize:16, color:"var(--muted2)", fontStyle:"italic", lineHeight:1.6}}>
              Cada mundo tem suas próprias leis. Qual você vai enfrentar hoje?
            </p>
          </div>

          {/* Grid */}
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(290px, 1fr))", gap:18, alignItems:"stretch"}}>
            {SYSTEMS.filter(s => !s.hidden).map((sys, i) => {
              const isHov = hovered === sys.id;
              const isSel = selected === sys.id;
              const showSubtitle = sys.subtitle && sys.subtitle !== sys.name;
              return (
                <div
                  key={sys.id}
                  className="sys-card"
                  role={sys.available ? "button" : undefined}
                  tabIndex={sys.available ? 0 : undefined}
                  aria-label={sys.available ? `Acessar sistema ${sys.name}` : `${sys.name} — em breve`}
                  onMouseEnter={() => setHovered(sys.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleSelect(sys)}
                  onKeyDown={e => (e.key==="Enter"||e.key===" ") && handleSelect(sys)}
                  style={{
                    position:"relative", borderRadius:10, overflow:"hidden",
                    border:`1px solid ${isHov && sys.available ? sys.accent+"90" : isSel ? sys.accent+"80" : "rgba(201,168,76,0.1)"}`,
                    background: isHov && sys.available
                      ? `linear-gradient(135deg, ${sys.accent}12, rgba(5,5,5,0.95))`
                      : "var(--card)",
                    cursor: sys.available ? "pointer" : "not-allowed",
                    opacity: sys.available ? 1 : 0.9,
                    transition:"all 0.25s ease",
                    transform: isHov && sys.available ? "translateY(-4px)" : "none",
                    boxShadow: isHov && sys.available
                      ? `0 12px 40px ${sys.accentGlow}, 0 0 0 1px ${sys.accent}40`
                      : "none",
                    animation:`fadeIn 0.4s ease ${i*0.07}s both`,
                    display:"flex", flexDirection:"column", height:"100%",
                  }}
                >
                  {/* "Em Breve" badge */}
                  {!sys.available && (
                    <div style={{
                      position:"absolute", top:12, right:12,
                      fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:2,
                      color:"#c9a84c", textTransform:"uppercase",
                      background:"rgba(201,168,76,0.14)", border:"1px solid rgba(201,168,76,0.35)",
                      borderRadius:20, padding:"3px 10px",
                    }}>Em breve</div>
                  )}

                  {/* Selected pulse overlay */}
                  {isSel && (
                    <div style={{
                      position:"absolute", inset:0,
                      background:`radial-gradient(circle, ${sys.accent}30, transparent 70%)`,
                      animation:"glow 0.8s ease infinite", pointerEvents:"none",
                    }}/>
                  )}

                  {/* Top accent line */}
                  <div style={{
                    height:2, flexShrink:0,
                    background: (isHov && sys.available) || isSel
                      ? `linear-gradient(90deg, transparent, ${sys.accent}, transparent)`
                      : "transparent",
                    transition:"background 0.25s",
                  }}/>

                  <div style={{padding:"22px 20px 20px", display:"flex", flexDirection:"column", flex:1}}>
                    {/* Icon + name */}
                    <div style={{display:"flex", gap:14, alignItems:"flex-start", marginBottom:14}}>
                      <div style={{
                        width:48, height:48, borderRadius:10, flexShrink:0,
                        background: sys.svgIcon ? "rgba(80,0,120,0.2)" : `${sys.accent}18`,
                        border:`1px solid ${sys.svgIcon ? "rgba(180,60,220,0.35)" : sys.accent+"40"}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:24, overflow:"hidden",
                        boxShadow: isHov && sys.available
                          ? sys.svgIcon
                            ? "0 0 20px rgba(180,60,220,0.5), 0 0 40px rgba(140,30,200,0.25)"
                            : `0 0 16px ${sys.accentGlow}`
                          : "none",
                        transition:"box-shadow 0.25s", position:"relative",
                      }}>
                        {sys.emblem ? (
                          <>
                            <img src={sys.emblem} alt="" style={{width:"100%", height:"100%", objectFit:"contain"}} />
                            {isHov && sys.available && sys.idle && !reduced && (
                              <video className="card-idle-vid" autoPlay muted loop playsInline preload="none">
                                <source src={sys.idle + ".webm"} type="video/webm" />
                                <source src={sys.idle + ".mp4"} type="video/mp4" />
                              </video>
                            )}
                          </>
                        ) : sys.svgIcon ? sys.svgIcon(isHov || isSel) : sys.icon}
                      </div>
                      <div>
                        <div style={{
                          fontFamily:"Cinzel,serif", fontSize:13, fontWeight:600,
                          color:"var(--text)", marginBottom: showSubtitle ? 3 : 0, lineHeight:1.3,
                        }}>{sys.name}</div>
                        {showSubtitle && (
                          <div style={{fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:1.5,
                            color: isHov && sys.available ? sys.accent : "var(--muted)",
                            textTransform:"uppercase", transition:"color 0.25s",
                          }}>{sys.subtitle}</div>
                        )}
                      </div>
                    </div>

                    {/* Descrição — skeleton só quando o card ainda NÃO tem conteúdo.
                        SPEC_DEVIATION (0017 AC-3): a spec mandava skeleton para todo
                        `available:false`. Com D&D e Tormenta gated por decisão de
                        lançamento (2026-07-25) — e não por falta de conteúdo — apagar a
                        descrição deixaria dois cards vazios na vitrine. O skeleton segue
                        valendo para sistemas sem `desc`. */}
                    {sys.desc ? (
                      <p style={{
                        fontFamily:"Crimson Pro,serif", fontSize:14,
                        color:"var(--muted2)",
                        lineHeight:1.65, marginBottom:14, fontStyle:"italic", flex:1,
                      }}>{sys.desc}</p>
                    ) : (
                      <div style={{display:"flex", flexDirection:"column", gap:8, marginBottom:14, flex:1}} aria-hidden="true">
                        <div className="skeleton" style={{height:11, width:"92%"}}/>
                        <div className="skeleton" style={{height:11, width:"84%"}}/>
                        <div className="skeleton" style={{height:11, width:"70%"}}/>
                      </div>
                    )}

                    {/* Tags — skeleton pills quando o card não tem conteúdo (ver acima) */}
                    {sys.tags?.length ? (
                      <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:16}}>
                        {sys.tags.map(t => (
                          <span key={t} style={{
                            fontFamily:"Cinzel,serif", fontSize:11, letterSpacing:1,
                            textTransform:"uppercase", padding:"4px 10px",
                            minHeight:24, display:"inline-flex", alignItems:"center",
                            borderRadius:20,
                            border:`1px solid ${isHov ? sys.accent+"60" : "rgba(201,168,76,0.15)"}`,
                            color: isHov ? sys.accent : "var(--muted)",
                            transition:"all 0.25s",
                          }}>{t}</span>
                        ))}
                      </div>
                    ) : (
                      <div style={{display:"flex", gap:6, marginBottom:16}} aria-hidden="true">
                        <div className="skeleton" style={{height:24, width:66, borderRadius:20}}/>
                        <div className="skeleton" style={{height:24, width:52, borderRadius:20}}/>
                      </div>
                    )}

                    {/* CTA footer */}
                    <div style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      borderTop:`1px solid ${isHov && sys.available ? sys.accent+"30" : "rgba(255,255,255,0.05)"}`,
                      paddingTop:12, marginTop:"auto", transition:"border-color 0.25s",
                    }}>
                      <span style={{
                        fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2,
                        textTransform:"uppercase",
                        color: isSel ? sys.accent : isHov && sys.available ? "var(--text)" : "var(--muted)",
                        transition:"color 0.25s",
                      }}>
                        {!sys.available ? "Em breve" : isSel ? "Entrando..." : "Acessar sistema"}
                      </span>
                      <span style={{
                        fontSize:16,
                        color: isHov && sys.available ? sys.accent : "var(--muted)",
                        transition:"all 0.25s",
                        transform: isHov && sys.available ? "translateX(3px)" : "none",
                        display:"inline-flex", alignItems:"center",
                      }}>
                        {isSel
                          ? <span style={{display:"inline-block", width:14, height:14, border:`2px solid ${sys.accent}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite"}}/>
                          : sys.available ? "→" : "–"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{textAlign:"center", marginTop:48, paddingBottom:8}}>
            {/* Endereço em `lib/links.js` — spec 0036, AC-2. */}
            <a
              href={DISCORD_URL}
              {...ALVO_EXTERNO}
              style={{
                fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--muted)",
                textTransform:"uppercase", textDecoration:"none",
                display:"inline-flex", alignItems:"center", gap:8, transition:"color 0.2s",
              }}
              onMouseEnter={e=>e.currentTarget.style.color="var(--gold)"}
              onMouseLeave={e=>e.currentTarget.style.color="var(--muted)"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.01.043.027.057a19.91 19.91 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Mais sistemas chegando · Sugira no Discord
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
export default SystemSelect;
