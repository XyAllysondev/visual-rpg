import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "../i18n/useLocale";
import { useSlidingPill } from "../hooks/useSlidingPill";
import SlidingTabPill from "../components/SlidingTabPill";
import NexusLogo from "../lib/NexusLogo";
import navItems from "./navItems";

/* Menu lateral do desktop (spec 0031, onda D). É o componente mais entrelaçado com o
 * estado de navegação do App — e continua recebendo TUDO por props (AC-4): tela ativa,
 * navegação, colapso, sistema, troca de sistema, logout e contagem de campanhas. O
 * perfil (nome/foto) é dele mesmo, guardado no localStorage, e não passa pelo App. */
function Sidebar({ active, onNav, collapsed, setCollapsed, system, onChangeSystem, onLogout, campaignCount }) {
  const { t, lang, setLang } = useLocale();
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem("nexus_profile_photo") || "");
  const [profileName, setProfileName] = useState(() => localStorage.getItem("nexus_profile_name") || "Agente");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const fileInputRef = useRef(null);
  const [pendingPhoto, setPendingPhoto] = useState("");

  const openEdit = () => { setEditName(profileName); setPendingPhoto(profilePhoto); setEditingProfile(true); };
  const closeEdit = () => setEditingProfile(false);
  const saveEdit = () => {
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
  const avatarLetter = profileName.trim().charAt(0).toUpperCase() || "A";

  // Shared-layout nav indicator (spec 0017 AC-4): a single pill that glides to
  // the active item instead of each button snapping its own background on/off.
  // Measured from the live DOM so it survives collapse/lang-driven size changes;
  // the hook re-measures while the 300ms collapse transition runs (ResizeObserver)
  // and after the webfonts land. The global @media(prefers-reduced-motion)
  // neutralizes the transform slide.
  const { containerRef: navRef, setItemRef, pill } = useSlidingPill(active, `${collapsed}|${lang}`);

  return (
    <div className="sidebar-desktop" style={{
      width: collapsed ? 60 : 220,
      background:"var(--surface)", borderRight:"1px solid var(--border)",
      display:"flex", flexDirection:"column",
      transition:"width 0.3s ease", overflow:"hidden",
      position:"sticky", top:0, height:"100vh", flexShrink:0,
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed?"16px 0":"20px 16px",
        borderBottom:"1px solid var(--border)",
        display:"flex", alignItems:"center",
        justifyContent: collapsed?"center":"flex-start",
        gap:12, cursor:"pointer", position:"relative",
      }} onClick={()=>setCollapsed(c=>!c)}>
        <NexusLogo size={32} />
        {!collapsed && (
          <>
            <div>
              {/* Sem background-clip: o degradê no texto do wordmark rendia uma
                  borda serrilhada no anti-aliasing e é o clichê visual nº 1 de
                  interface gerada por IA. Ouro chapado lê melhor em 14px. */}
              <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:14, fontWeight:700,
                color:"var(--gold)", letterSpacing:2}}>NEXUS</div>
              <div style={{fontFamily:"Cinzel,serif", fontSize:7, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase"}}>RPG System</div>
            </div>
            <svg title="Recolher barra" width={16} height={16} viewBox="0 0 24 24" fill="none"
              stroke="#c9a84c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{marginLeft:"auto", flexShrink:0, opacity:0.75}}>
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </>
        )}
        {collapsed && (
          <svg title="Expandir barra" width={14} height={14} viewBox="0 0 24 24" fill="none"
            stroke="#c9a84c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{opacity:0.75}}>
            <path d="M9 18l6-6-6-6"/>
          </svg>
        )}
      </div>

      {/* O card do sistema ativo saiu daqui (redesign de layout 2026-08-02).
          O nome "Ordem Paranormal" aparecia TRÊS vezes na mesma tela: neste
          card (truncado em "ORDEM PARANO…", porque 220px de barra não cabem),
          na aba da topbar e no herói do painel. Agora existe num lugar só — a
          migalha da topbar, que também é o botão de trocar. Menos ruído e o
          nome deixa de ser cortado. */}

      {/* Nav */}
      <nav ref={navRef} style={{flex:1, padding:"8px 8px", display:"flex", flexDirection:"column", gap:1, position:"relative"}}>
        {/* Sliding active-indicator pill (AC-4) — glides behind the buttons */}
        {/* A pílula continua deslizando (AC-4, spec 0017) — mas em vez de um
            retângulo preenchido + contorno, ela agora é só um filete de 2px na
            borda esquerda mais um véu quase imperceptível. Um bloco colorido
            atrás do item ativo brigava com o ícone e com o texto; o filete
            marca a posição sem virar um segundo plano de fundo. */}
        <SlidingTabPill pill={pill} radius={4}
          background="rgba(255,255,255,0.035)"
          boxShadow={`inset 2px 0 0 0 ${system?.accent || "var(--gold)"}`} />
        {navItems.map(item => {
          const isActive = active === item.id;
          return (
            <button key={item.id} ref={setItemRef(item.id)} onClick={()=>onNav(item.id)}
              title={collapsed ? t("nav."+item.id) : ""}
              style={{
                display:"flex", alignItems:"center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap:10, padding: collapsed ? "10px 0" : "10px 12px",
                background:"transparent",
                border:"none", borderRadius:8,
                cursor:"pointer", position:"relative", zIndex:1,
                fontFamily:"Cinzel,serif", fontSize:11, letterSpacing:"0.05em",
                /* Ativo = texto mais claro. A COR de acento fica só no filete
                   da pílula; texto colorido + fundo colorido + ícone brilhando
                   eram três sinais para dizer a mesma coisa. */
                color: isActive ? "var(--text)" : "var(--muted2)",
                fontWeight: isActive ? 600 : 400,
                transition:"color 0.18s, font-weight 0.18s",
                boxShadow:"none",
              }}
              onMouseEnter={e=>{ if(!isActive){ e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.color="var(--text)"; }}}
              onMouseLeave={e=>{ if(!isActive){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="var(--muted2)"; }}}>
              <span style={{
                display:"flex", alignItems:"center", justifyContent:"center",
                minWidth:20, flexShrink:0,
                color: isActive ? (system?.accent || "var(--gold)") : "var(--muted2)",
                /* sem drop-shadow: ícone com halo é brilho de UI de IA, e em
                   11px o glow só borra o traço do ícone */
                transition:"color 0.18s",
              }}>{item.svg}</span>
              {!collapsed && <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t("nav."+item.id)}</span>}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle button */}
      <button onClick={()=>setCollapsed(c=>!c)} title={collapsed ? "Expandir barra" : "Recolher barra"}
        style={{
          display:"flex", alignItems:"center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap:8, padding: collapsed ? "10px 0" : "10px 14px",
          background:"none", border:"none", borderTop:"1px solid var(--border)",
          cursor:"pointer", color:"var(--muted2)", width:"100%",
          fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:"0.06em",
          transition:"all 0.18s", flexShrink:0,
        }}
        onMouseEnter={e=>{e.currentTarget.style.color="var(--gold)";e.currentTarget.style.background="rgba(201,168,76,0.05)";}}
        onMouseLeave={e=>{e.currentTarget.style.color="var(--muted2)";e.currentTarget.style.background="none";}}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {collapsed
            ? <><path d="M13 17l5-5-5-5"/><path d="M6 17l5-5-5-5"/></>
            : <><path d="M11 17l-5-5 5-5"/><path d="M18 17l-5-5 5-5"/></>}
        </svg>
        {!collapsed && <span>{t("sidebar.collapse")}</span>}
      </button>

      {/* User */}
      {collapsed ? (
        <div style={{
          padding:"12px 0", borderTop:"1px solid var(--border)",
          display:"flex", flexDirection:"column", alignItems:"center", gap:8,
        }}>
          <div onClick={openEdit} title="Editar perfil" style={{
            width:32, height:32, borderRadius:"50%",
            background:"linear-gradient(135deg,rgba(201,168,76,0.3),rgba(201,168,76,0.1))",
            border:"2px solid var(--border2)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"Cinzel,serif", fontSize:13, color:"var(--gold)",
            cursor:"pointer", overflow:"hidden", flexShrink:0,
            transition:"border-color 0.2s",
          }}
            onMouseEnter={e=>e.currentTarget.style.borderColor="var(--gold)"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border2)"}
          >
            {profilePhoto
              ? <img src={profilePhoto} alt="perfil" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : avatarLetter}
          </div>
          <button
            onClick={() => setLang(lang === "pt" ? "en" : "pt")}
            title={lang === "pt" ? "Switch to English" : "Mudar para Português"}
            style={{
              background:"none", border:"1px solid rgba(201,168,76,0.2)", borderRadius:6,
              cursor:"pointer", color:"var(--gold)", padding:"3px 4px",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all 0.2s", width:32, height:22,
              fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:1, fontWeight:700,
            }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(201,168,76,0.1)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="none";}}
          >
            {lang === "pt" ? "PT" : "EN"}
          </button>
          <button onClick={onLogout} title={t("sidebar.logout")} style={{
            background:"none", border:"1px solid rgba(201,168,76,0.2)", borderRadius:6,
            cursor:"pointer", color:"var(--muted2)", padding:"5px",
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"all 0.2s", width:32, height:28,
          }}
            onMouseEnter={e=>{e.currentTarget.style.color="#e07070";e.currentTarget.style.borderColor="rgba(200,80,80,0.5)";e.currentTarget.style.background="rgba(200,60,60,0.08)";}}
            onMouseLeave={e=>{e.currentTarget.style.color="var(--muted2)";e.currentTarget.style.borderColor="rgba(201,168,76,0.2)";e.currentTarget.style.background="none";}}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      ) : (
        <div style={{
          padding:"14px 16px", borderTop:"1px solid var(--border)",
          display:"flex", alignItems:"center", gap:10,
        }}>
          <div onClick={openEdit} title="Editar perfil" style={{
            width:34, height:34, borderRadius:"50%",
            background:"linear-gradient(135deg,rgba(201,168,76,0.3),rgba(201,168,76,0.1))",
            border:"2px solid var(--border2)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"Cinzel,serif", fontSize:13, color:"var(--gold)", flexShrink:0,
            cursor:"pointer", overflow:"hidden", transition:"border-color 0.2s",
          }}
            onMouseEnter={e=>e.currentTarget.style.borderColor="var(--gold)"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border2)"}
          >
            {profilePhoto
              ? <img src={profilePhoto} alt="perfil" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : avatarLetter}
          </div>
          <div style={{overflow:"hidden", flex:1, cursor:"pointer"}} onClick={openEdit} title="Editar perfil">
            <div style={{fontFamily:"Cinzel,serif", fontSize:11, color:"var(--text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{profileName}</div>
            <div style={{fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:1, color:"var(--gold)", textTransform:"uppercase"}}>✦ Pro</div>
          </div>
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === "pt" ? "en" : "pt")}
            title={lang === "pt" ? t("settings.langEN") : t("settings.langPT")}
            style={{
              background:"none", border:"1px solid rgba(201,168,76,0.2)", borderRadius:6,
              cursor:"pointer", color:"var(--gold)", padding:"4px 6px",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all 0.2s", flexShrink:0,
              fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1, fontWeight:700,
            }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(201,168,76,0.1)";e.currentTarget.style.borderColor="rgba(201,168,76,0.5)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.borderColor="rgba(201,168,76,0.2)";}}
          >
            {lang === "pt" ? "PT" : "EN"}
          </button>
          <button onClick={onLogout} title={t("sidebar.logout")} style={{
            background:"none", border:"1px solid rgba(201,168,76,0.2)", borderRadius:6,
            cursor:"pointer", color:"var(--muted2)", padding:"5px",
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"all 0.2s", flexShrink:0,
          }}
            onMouseEnter={e=>{e.currentTarget.style.color="#e07070";e.currentTarget.style.borderColor="rgba(200,80,80,0.5)";e.currentTarget.style.background="rgba(200,60,60,0.08)";}}
            onMouseLeave={e=>{e.currentTarget.style.color="var(--muted2)";e.currentTarget.style.borderColor="rgba(201,168,76,0.2)";e.currentTarget.style.background="none";}}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      )}

      {/* Profile edit modal */}
      {editingProfile && createPortal(
        <div onClick={closeEdit} style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.48)", zIndex:9999,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:"var(--surface)", border:"1px solid var(--border2)",
            borderRadius:12, padding:"28px 28px 24px", width:300,
            display:"flex", flexDirection:"column", alignItems:"center", gap:20,
            boxShadow:"0 20px 60px rgba(0,0,0,0.42)",
          }}>
            <div style={{fontFamily:"Cinzel,serif", fontSize:13, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase"}}>Editar Perfil</div>

            {/* Avatar clicável */}
            <div style={{position:"relative", cursor:"pointer"}} onClick={()=>fileInputRef.current?.click()}>
              <div style={{
                width:80, height:80, borderRadius:"50%",
                background:"linear-gradient(135deg,rgba(201,168,76,0.3),rgba(201,168,76,0.1))",
                border:"2px solid var(--gold)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:"Cinzel,serif", fontSize:28, color:"var(--gold)",
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
                <span style={{fontSize:18}}>📷</span>
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
                onKeyDown={e=>{ if(e.key==="Enter") saveEdit(); if(e.key==="Escape") closeEdit(); }}
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
              <button onClick={closeEdit} style={{
                flex:1, padding:"9px 0", borderRadius:6, cursor:"pointer",
                background:"rgba(255,255,255,0.05)", border:"1px solid var(--border)",
                fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:1, color:"var(--muted)",
                transition:"all 0.2s",
              }}>Cancelar</button>
              <button onClick={saveEdit} className="btn-gold" style={{flex:1, padding:"9px 0", fontSize:11, letterSpacing:1}}>Salvar</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

export default Sidebar;
