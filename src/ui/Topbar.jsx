import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/* Barra superior (spec 0031, onda D). Casca de navegação: migalha de pão (sistema/tela),
 * sino de novidades e o menu do avatar. Recebe tela, sistema, troca de sistema e logout
 * por props (AC-4). O mural de novidades (`NEWS_ITEMS`) é conteúdo editorial editado à
 * mão pelos devs e só este componente o consome, por isso veio junto. */
/* ── Novidades (editado pelos devs) ── */
const NEWS_ITEMS = [
  {
    id: 1, isNew: true,
    title: "Guilda C.R.I.S. no Portal RPG!",
    image: null,
    desc: "Criamos nossa Guilda no Portal RPG! Entre agora para receber skins exclusivas!",
    link: null, linkLabel: "Veja mais aqui!",
  },
  {
    id: 2, isNew: true,
    title: "Marcas Fragmentadas está no CRIS!",
    image: null,
    desc: "A campanha Marcas Fragmentadas chegou ao CRIS com novos conteúdos exclusivos para os membros.",
    link: null, linkLabel: "Saiba mais",
  },
  {
    id: 3, isNew: true,
    title: "@ArquivosConfidenciais vazados no cris!",
    image: null,
    desc: "Documentos sigilosos foram vazados nos arquivos do CRIS. Confira o conteúdo exclusivo!",
    link: null, linkLabel: "Ver arquivos",
  },
  {
    id: 4, isNew: true,
    title: "O @CultodaCriacao chegou no CRIS!",
    image: null,
    desc: "O Culto da Criação fez sua presença marcada no CRIS. Fique atento às novidades.",
    link: null, linkLabel: "Ver mais",
  },
  {
    id: 5, isNew: true,
    title: "Novas armas chegaram no CRIS!",
    image: null,
    desc: "Um novo arsenal está disponível no CRIS. Confira as armas inéditas que chegaram!",
    link: null, linkLabel: "Ver arsenal",
  },
  {
    id: 6, isNew: true,
    title: "A @TocaDosMonstros está no CRIS!",
    image: null,
    desc: "A Toca dos Monstros chegou ao CRIS trazendo criaturas e encontros inéditos.",
    link: null, linkLabel: "Explorar",
  },
  {
    id: 7, isNew: false,
    title: "Criaturas invadem o CRIS!",
    image: null,
    desc: "Uma nova leva de criaturas foi avistada nos arredores do CRIS. Prepare-se, agente.",
    link: null, linkLabel: "Ver criaturas",
  },
];

/* ═══════════════════════════════
   TOPBAR
═══════════════════════════════ */
/* `pendencias` é a contagem de DECISÕES suas esperando ação — a mesma lista que o
 * Painel desenha em "Precisa de você". Um sinal, duas superfícies.
 *
 * Antes o badge saía de `NEWS_ITEMS.filter(isNew)`: um literal no código, ou
 * seja, `6` para todo usuário, para sempre, e `6` de novo depois de lido. Isso
 * não é notificação, é adesivo. As novidades continuam no mural (o sino abre o
 * mesmo modal), só pararam de inflar o número. Zero pendências, zero badge. */
function Topbar({ screen, system, onChangeSystem, onLogout, pendencias = 0 }) {
  const labels = { dashboard:"Painel", sheet:"Fichas de Personagem", map:"Editor de Mapas", master:"Ajudante do Mestre", music:"Trilhas Sonoras", party:"Campanhas", roadmap:"Roadmap", planos:"Planos" };
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem("nexus_profile_photo") || "");
  const [profileName,  setProfileName]  = useState(() => localStorage.getItem("nexus_profile_name")  || "Agente");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName,    setEditName]    = useState("");
  const [pendingPhoto, setPendingPhoto] = useState("");

  const [notifOpen, setNotifOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState(NEWS_ITEMS[0]);
  const notifCount = Math.max(0, Number(pendencias) || 0);

  const avatarLetter = profileName.trim().charAt(0).toUpperCase() || "A";

  const openProfile = () => {
    setEditName(profileName);
    setPendingPhoto(profilePhoto);
    setMenuOpen(false);
    setEditingProfile(true);
  };
  const closeProfile = () => setEditingProfile(false);
  const saveProfile = () => {
    const name = editName.trim() || "Agente";
    setProfileName(name);
    setProfilePhoto(pendingPhoto);
    localStorage.setItem("nexus_profile_name", name);
    localStorage.setItem("nexus_profile_photo", pendingPhoto);
    setEditingProfile(false);
  };
  const handlePhotoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPendingPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <>
    <div style={{
      height:56, background:"var(--surface)", borderBottom:"1px solid var(--border)",
      display:"flex", alignItems:"center", padding:"0 24px",
      position:"sticky", top:0, zIndex:50, gap:0,
    }}>

      {/* ── Migalha de pão: Sistema / Tela ──
          Antes eram TRÊS elementos de alturas diferentes empilhados na mesma
          barra de 52px (bloco de título em 2 linhas, filete divisor, e uma
          "aba" roxa com fundo e borda próprios que estourava a barra e ficava
          visivelmente desalinhada). Vira uma linha só: o sistema é o primeiro
          nível da migalha e ele MESMO é o botão de trocar — sem caixa colorida,
          sem repetir o nome do sistema que a tela já mostra no cabeçalho. */}
      <nav aria-label="Você está em" style={{
        display:"flex", alignItems:"center", gap:9, minWidth:0, flexShrink:1,
      }}>
        {system && (
          <>
            <button onClick={onChangeSystem} className="topbar-sys" title="Trocar de sistema" style={{
              display:"flex", alignItems:"center", gap:7, cursor:"pointer", minWidth:0,
              background:"none", border:"none", padding:"4px 2px", borderRadius:4,
              fontFamily:"Cinzel,serif", fontSize:12, letterSpacing:"0.04em",
              color:"var(--muted)", transition:"color 0.2s",
            }}
              onMouseEnter={e=>e.currentTarget.style.color="var(--text)"}
              onMouseLeave={e=>e.currentTarget.style.color="var(--muted)"}
            >
              <span style={{display:"flex",alignItems:"center",flexShrink:0,opacity:0.85}}>
                {system?.svgIcon ? system.svgIcon(false) : system?.icon}
              </span>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{system.name}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                style={{flexShrink:0, opacity:0.5}} aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <span aria-hidden="true" style={{color:"var(--border2)", fontSize:13, flexShrink:0}}>/</span>
          </>
        )}
        <span style={{
          fontFamily:"Cinzel,serif", fontSize:13, color:"var(--text)",
          letterSpacing:"0.03em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        }}>{labels[screen]}</span>
      </nav>

      {/* ── Espaço flexível ── */}
      <div style={{flex:1}}/>

      {/* ── Área direita ──
          "Online" (sempre verde) e "✦ Plano Pro" (estático, não clicável) eram
          enfeite: nenhum dos dois mudava nem levava a lugar nenhum. Enchiam a
          barra de cor e de filetes divisores. O plano vive no menu do perfil. */}
      <div style={{display:"flex", gap:10, alignItems:"center"}}>

        {/* Sino */}
        <button onClick={()=>{ setMenuOpen(false); setSelectedNews(NEWS_ITEMS[0]); setNotifOpen(true); }} style={{
          position:"relative", background:"none", border:"none", cursor:"pointer",
          padding:"4px", display:"flex", alignItems:"center", justifyContent:"center",
          color:"#5a5248", transition:"color 0.2s",
        }}
          onMouseEnter={e=>e.currentTarget.style.color="var(--gold)"}
          onMouseLeave={e=>e.currentTarget.style.color="#5a5248"}
          title={notifCount > 0 ? `${notifCount} pendência(s) e novidades` : "Novidades"}
          aria-label={notifCount > 0 ? `Notificações, ${notifCount} pendente(s)` : "Notificações"}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {notifCount > 0 && (
            <span style={{
              position:"absolute", top:2, right:2,
              width:7, height:7, borderRadius:"50%",
              background:"#e03333", border:"1.5px solid #09080e",
            }}/>
          )}
        </button>

        {/* Avatar + dropdown */}
        <div ref={menuRef} style={{position:"relative"}}>
          <div style={{position:"relative", display:"inline-block"}}>
            <button onClick={()=>setMenuOpen(o=>!o)} style={{
              width:34, height:34, borderRadius:"50%", padding:0,
              background:"none", border:"1px solid #b8962e",
              cursor:"pointer", overflow:"hidden", display:"block",
              transition:"border-color 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--gold2)"; e.currentTarget.style.boxShadow="0 0 8px rgba(201,168,76,0.28)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor="#b8962e"; e.currentTarget.style.boxShadow="none"; }}
            >
              {profilePhoto
                ? <img src={profilePhoto} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                : <span style={{
                    display:"flex",alignItems:"center",justifyContent:"center",
                    width:"100%",height:"100%",
                    fontFamily:"Cinzel,serif", fontSize:13, fontWeight:700,
                    background:"linear-gradient(135deg,rgba(140,60,220,0.35),rgba(100,30,180,0.2))",
                    color:"var(--gold)",
                  }}>{avatarLetter}</span>
              }
            </button>
            {notifCount > 0 && (
              <span style={{
                position:"absolute", bottom:-3, right:-3,
                background:"#b8962e", color:"#050505",
                borderRadius:"50%", minWidth:16, height:16,
                padding:"0 2px", fontSize:9, fontWeight:700, fontFamily:"Cinzel,serif",
                display:"flex", alignItems:"center", justifyContent:"center",
                border:"1.5px solid #09080e", pointerEvents:"none",
              }}>{notifCount}</span>
            )}
          </div>

          {menuOpen && (
            <div style={{
              position:"absolute", top:"calc(100% + 8px)", right:0,
              background:"#0e0c18", border:"1px solid #1e1a2a",
              borderRadius:8, padding:"6px 0", minWidth:196,
              boxShadow:"0 8px 32px rgba(0,0,0,0.48)",
              zIndex:200,
            }}>
              {/* cabeçalho do menu */}
              <div style={{ padding:"10px 16px 10px", borderBottom:"1px solid #1e1a2a", marginBottom:4 }}>
                <div style={{ fontFamily:"Cinzel,serif", fontSize:11, color:"var(--text)", fontWeight:600 }}>{profileName}</div>
                <div style={{ fontFamily:"Cinzel,serif", fontSize:7, letterSpacing:"0.15em", color:"#b8962e", textTransform:"uppercase", marginTop:3 }}>✦ Plano Pro</div>
              </div>

              {[
                { icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, label:"Meu Perfil", badge:0, action:openProfile },
                { icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label:"Notificações", badge:notifCount, action:()=>{ setMenuOpen(false); setSelectedNews(NEWS_ITEMS[0]); setNotifOpen(true); } },
              ].map(({icon,label,badge,action})=>(
                <button key={label} onClick={action} style={{
                  display:"flex", alignItems:"center", gap:10,
                  width:"100%", padding:"9px 16px",
                  background:"none", border:"none", cursor:"pointer",
                  color:"var(--muted2)", fontFamily:"'Crimson Pro',serif",
                  fontSize:14, textAlign:"left", transition:"background 0.15s, color 0.15s",
                }}
                  onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.color="var(--text)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.color="var(--muted2)"; }}
                >
                  <span style={{color:"var(--muted)",display:"flex",flexShrink:0}}>{icon}</span>
                  <span style={{flex:1}}>{label}</span>
                  {badge>0 && <span style={{background:"#c03333",color:"#fff",borderRadius:8,padding:"1px 6px",fontSize:9,fontWeight:700}}>{badge}</span>}
                </button>
              ))}

              <div style={{height:1, background:"#1e1a2a", margin:"4px 0"}}/>

              <button onClick={()=>{ setMenuOpen(false); onLogout(); }} style={{
                display:"flex", alignItems:"center", gap:10,
                width:"100%", padding:"9px 16px",
                background:"none", border:"none", cursor:"pointer",
                color:"#6a4545", fontFamily:"'Crimson Pro',serif",
                fontSize:14, textAlign:"left", transition:"background 0.15s, color 0.15s",
              }}
                onMouseEnter={e=>{ e.currentTarget.style.background="rgba(192,80,80,0.08)"; e.currentTarget.style.color="#c05050"; }}
                onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.color="#6a4545"; }}
              >
                <span style={{display:"flex",flexShrink:0}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </span>
                <span>Sair</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>

    {/* Notifications modal */}
    {notifOpen && createPortal(
      <div onClick={()=>setNotifOpen(false)} style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <div onClick={e=>e.stopPropagation()} style={{
          width:"min(900px, 95vw)", height:"min(560px, 90vh)",
          background:"#0e0e14", border:"1px solid rgba(140,60,220,0.4)",
          borderRadius:16, overflow:"hidden", display:"flex",
          boxShadow:"0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
        }}>
          {/* Left — lista */}
          <div style={{
            width:260, borderRight:"1px solid rgba(140,60,220,0.25)",
            display:"flex", flexDirection:"column", flexShrink:0,
          }}>
            <div style={{
              padding:"20px 20px 14px",
              borderBottom:"1px solid rgba(140,60,220,0.2)",
              fontFamily:"Cinzel,serif", fontSize:15, color:"#fff", letterSpacing:1,
            }}>Novidades</div>
            <div style={{flex:1, overflowY:"auto", padding:"8px 0"}}>
              {NEWS_ITEMS.map(item => (
                <button key={item.id} onClick={()=>setSelectedNews(item)} style={{
                  width:"100%", padding:"12px 18px",
                  background: selectedNews?.id===item.id ? "rgba(140,60,220,0.15)" : "none",
                  border:"none", borderLeft: selectedNews?.id===item.id ? "3px solid rgba(140,60,220,0.8)" : "3px solid transparent",
                  cursor:"pointer", textAlign:"left",
                  display:"flex", alignItems:"center", gap:10,
                  transition:"background 0.15s",
                }}
                  onMouseEnter={e=>{ if(selectedNews?.id!==item.id) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e=>{ if(selectedNews?.id!==item.id) e.currentTarget.style.background="none"; }}
                >
                  <span style={{
                    fontFamily:"Cinzel,serif", fontSize:11, color: selectedNews?.id===item.id ? "#c8a8f0" : "rgba(255,255,255,0.7)",
                    lineHeight:1.4, flex:1,
                  }}>{item.title}</span>
                  {item.isNew && <span style={{width:8, height:8, borderRadius:"50%", background:"#e05555", flexShrink:0}}/>}
                </button>
              ))}
            </div>
          </div>

          {/* Right — conteúdo */}
          <div style={{flex:1, display:"flex", flexDirection:"column", overflowY:"auto"}}>
            {/* Close */}
            <div style={{display:"flex", justifyContent:"flex-end", padding:"14px 18px 0"}}>
              <button onClick={()=>setNotifOpen(false)} style={{
                background:"none", border:"none", cursor:"pointer",
                color:"rgba(255,255,255,0.4)", fontSize:20, lineHeight:1,
                transition:"color 0.2s",
              }}
                onMouseEnter={e=>e.currentTarget.style.color="#fff"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.4)"}
              >✕</button>
            </div>

            {selectedNews && (
              <div style={{padding:"0 32px 32px", display:"flex", flexDirection:"column", gap:20}}>
                <a href={selectedNews.link||"#"} target="_blank" rel="noopener noreferrer" style={{
                  fontFamily:"Cinzel,serif", fontSize:18, color:"#a070e8",
                  textDecoration:"underline", textDecorationColor:"rgba(160,112,232,0.4)",
                  lineHeight:1.3,
                }}>{selectedNews.title}</a>

                {selectedNews.image && (
                  <div style={{borderRadius:10, overflow:"hidden", maxWidth:460, alignSelf:"center"}}>
                    <img src={selectedNews.image} alt={selectedNews.title} style={{width:"100%", display:"block"}}/>
                  </div>
                )}

                <p style={{
                  fontFamily:"Crimson Pro,serif", fontSize:15, color:"rgba(255,255,255,0.85)",
                  lineHeight:1.7, margin:0,
                }}>{selectedNews.desc}</p>

                {selectedNews.linkLabel && (
                  <a href={selectedNews.link||"#"} target="_blank" rel="noopener noreferrer" style={{
                    fontFamily:"Cinzel,serif", fontSize:13, color:"#a070e8",
                    textDecoration:"underline",
                  }}>{selectedNews.linkLabel}</a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    , document.body)}

    {/* Profile modal */}
    {editingProfile && createPortal(
      <div onClick={closeProfile} style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:9999,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <div onClick={e=>e.stopPropagation()} style={{
          background:"var(--surface)", border:"1px solid var(--border2)",
          borderRadius:14, padding:"28px 28px 24px", width:320,
          display:"flex", flexDirection:"column", alignItems:"center", gap:20,
          boxShadow:"0 20px 60px rgba(0,0,0,0.48)",
        }}>
          <div style={{fontFamily:"Cinzel,serif", fontSize:13, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase"}}>Editar Perfil</div>

          {/* Avatar clicável */}
          <div style={{position:"relative", cursor:"pointer"}} onClick={()=>fileInputRef.current?.click()}>
            <div style={{
              width:88, height:88, borderRadius:"50%",
              background:"linear-gradient(135deg,rgba(201,168,76,0.3),rgba(201,168,76,0.1))",
              border:"2px solid var(--gold)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"Cinzel,serif", fontSize:30, color:"var(--gold)",
              overflow:"hidden",
            }}>
              {pendingPhoto
                ? <img src={pendingPhoto} alt="perfil" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                : (editName.trim().charAt(0).toUpperCase() || "A")}
            </div>
            <div style={{
              position:"absolute", inset:0, borderRadius:"50%",
              background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center",
              opacity:0, transition:"opacity 0.2s",
            }}
              onMouseEnter={e=>e.currentTarget.style.opacity=1}
              onMouseLeave={e=>e.currentTarget.style.opacity=0}
            >
              <span style={{fontSize:20}}>📷</span>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoFile}/>
          </div>
          <div style={{fontSize:11, color:"var(--muted)", fontFamily:"Cinzel,serif", letterSpacing:1, marginTop:-12}}>Clique para trocar</div>

          {/* Nome */}
          <div style={{width:"100%"}}>
            <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase", marginBottom:6}}>Nome do Agente</div>
            <input
              value={editName}
              onChange={e=>setEditName(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") saveProfile(); if(e.key==="Escape") closeProfile(); }}
              maxLength={32}
              placeholder="Agente"
              autoFocus
              style={{
                width:"100%", boxSizing:"border-box",
                background:"rgba(255,255,255,0.05)", border:"1px solid var(--border2)",
                borderRadius:6, padding:"9px 12px",
                fontFamily:"Cinzel,serif", fontSize:13, color:"var(--text)",
                outline:"none",
              }}
            />
          </div>

          {/* Botões */}
          <div style={{display:"flex", gap:10, width:"100%"}}>
            <button onClick={closeProfile} style={{
              flex:1, padding:"9px 0", borderRadius:6, cursor:"pointer",
              background:"rgba(255,255,255,0.05)", border:"1px solid var(--border)",
              fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:1, color:"var(--muted)",
              transition:"all 0.2s",
            }}>Cancelar</button>
            <button onClick={saveProfile} className="btn-gold" style={{flex:1, padding:"9px 0", fontSize:11, letterSpacing:1}}>Salvar</button>
          </div>
        </div>
      </div>
    , document.body)}
    </>
  );
}

export default Topbar;
