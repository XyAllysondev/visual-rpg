import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useSlidingPill } from "../../hooks/useSlidingPill";
import SlidingTabPill from "../../components/SlidingTabPill";
import * as campaignsRepo from "../../infrastructure/firestore/campaignsRepo";
import * as sharedSheetsRepo from "../../infrastructure/firestore/sharedSheetsRepo";
import { resizeCoverImage } from "./campanhaHelpers";
import CoverPreviewModal from "./CoverPreviewModal";
import CampaignChat from "./CampaignChat";
import SharedSheetsPanel from "./SharedSheetsPanel";
import MembersPanel from "./MembersPanel";
import MasterSettings from "./MasterSettings";
import MestrePanel from "./MestrePanel";
import NarracaoOverlay from "./NarracaoOverlay";
import RollFeed from "./RollFeed";
import BestiaryTab from "./BestiaryTab";
import CampaignMapTab from "./CampaignMapTab";

/* ── O HERO DE DUAS ALTURAS ────────────────────────────────────────────
   A capa é ambientação: ela diz "esta campanha é este lugar". Nas abas em que
   o mestre TRABALHA (Mapas, Mestre, Bestiário, Gerenciar) ela não entrega uma
   única informação que o título de 15 px não entregue — e cobra 200 px de tela
   por isso, em todo viewport. Nessas abas ela encolhe para uma faixa de 64 px
   (56 no celular) e vira textura; nas outras continua alta. */
const ABAS_DE_TRABALHO = new Set(["map", "mestre", "bestiary", "settings"]);

function CampaignDetail({ campaign, uid, userName, userPhoto, characters, onBack }) {
  const [activeTab, setActiveTab] = useState("chat");
  const [showInvite, setShowInvite] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverPreview, setCoverPreview] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const isMaster = campaign.masterId === uid;
  const isAdmin  = !isMaster && (campaign.admins||[]).includes(uid);
  const coverInputRef = useRef(null);
  // pill deslizante nas abas — mesmo padrão do Sidebar/ficha OP (spec 0022 AC-5)
  const tabsPill = useSlidingPill(activeTab);

  /* ── A ALTURA ÚTIL, MEDIDA ────────────────────────────────────────────
     O `calc(100vh - 136px)` que morava aqui era um número inventado: sobrepunha
     11 px do rodapé em 1920×1080 e enfiava 8 px por baixo da barra inferior em
     390×844. Só que passar para `flex:1` puro também não resolve — a coluna do
     shell é `minHeight:100vh`, nunca `height`, então NENHUM ancestral tem altura
     definida e o `flex:1` cai de volta no conteúdo (o palco crescia até 2456 px).
     Então medimos: onde esta caixa começa, e o que ainda precisa caber embaixo
     dela (padding do `main`, barra de música, nav do celular, rodapé). É a mesma
     conta do 136, com a diferença de ser verdade em qualquer viewport e refeita
     quando qualquer uma das peças muda de tamanho. */
  const raizRef = useRef(null);
  const [alturaUtil, setAlturaUtil] = useState(null);
  useLayoutEffect(() => {
    const el = raizRef.current;
    if (!el || typeof window === "undefined") return undefined;
    const medir = () => {
      const topo = el.getBoundingClientRect().top;
      const main = el.closest("main");
      let abaixo = 0;
      if (main) {
        abaixo += parseFloat(getComputedStyle(main).paddingBottom) || 0;
        let irmao = main.nextElementSibling;
        while (irmao) {
          const r = irmao.getBoundingClientRect();
          if (getComputedStyle(irmao).position !== "fixed") abaixo += r.height;
          irmao = irmao.nextElementSibling;
        }
      }
      const util = Math.round(window.innerHeight - topo - abaixo);
      setAlturaUtil(Number.isFinite(util) && util > 320 ? util : null);
    };
    medir();
    window.addEventListener("resize", medir);
    let ro;
    if (typeof ResizeObserver === "function" && el.closest("main")?.parentElement) {
      ro = new ResizeObserver(medir);
      ro.observe(el.closest("main").parentElement);
    }
    return () => { window.removeEventListener("resize", medir); if (ro) ro.disconnect(); };
  }, []);

  /* ── A faixa de abas transborda? ──────────────────────────────────────
     Em 390 px ela tem 906 px de conteúdo em 350 de janela: 5 das 8 abas
     ficam fora, sem seta, sem sombra, sem indicador. A esmaecida da borda
     só faz sentido quando há mesmo algo escondido — daí a medida. */
  const [temMaisAbas, setTemMaisAbas] = useState(false);
  useEffect(() => {
    const el = tabsPill.containerRef.current;
    if (!el) return undefined;
    const medir = () => setTemMaisAbas(el.scrollWidth > el.clientWidth + 4);
    medir();
    if (typeof ResizeObserver !== "function") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
    // `isMaster`/`isAdmin` mudam a QUANTIDADE de abas — e por isso o transbordo.
  }, [tabsPill.containerRef, isMaster, isAdmin]);

  /* Trocar de aba pelo teclado (ou por código) não pode deixar a aba ativa
     fora da vista — o realce correria para um lugar que ninguém vê. */
  useEffect(() => {
    const el = tabsPill.containerRef.current?.querySelector('[data-ativa="1"]');
    if (!el?.scrollIntoView) return;
    const parado = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion:reduce)").matches : true;
    el.scrollIntoView({ inline:"center", block:"nearest", behavior: parado ? "auto" : "smooth" });
  }, [activeTab, tabsPill.containerRef]);

  /* ── Live-sync: always push character changes to sharedSheets regardless of active tab ── */
  const liveSheetsRef = useRef([]);
  useEffect(() => {
    return sharedSheetsRepo.watchByCampaign(campaign.id, list => {
      liveSheetsRef.current = list.filter(s => s.ownerId === uid && s.isLive);
    });
  }, [campaign.id, uid]);

  useEffect(() => {
    if (!characters?.length || !liveSheetsRef.current.length) return;
    liveSheetsRef.current.forEach(sheet => {
      const char = characters.find(c => String(c.id || c.createdAt) === sheet.characterId);
      if (!char) return;
      sharedSheetsRepo.updateCharacterData({ campaignId: campaign.id, sheetId: sheet.id }, char);
    });
  }, [characters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCoverUpload = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCoverUploading(true);
    try {
      const img = await resizeCoverImage(file);
      setCoverPreview(img);
    } catch(_) {}
    setCoverUploading(false);
  };

  const confirmCoverUpload = async (img) => {
    try { await campaignsRepo.update(campaign.id, { coverImage: img }); } catch(e) { console.error("[campanha] salvar capa falhou:", e); }
    setCoverPreview(null);
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(campaign.inviteCode || "").catch((e)=>console.warn("[campanha] copiar código de convite falhou:", e));
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const SvgCamera  = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
  const SvgSparkle = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
  const SvgUserPlus= ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>;
  const SvgSettings= ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  const SvgChat    = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
  const SvgUsers   = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;

  const SvgDice = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="2" x2="12" y2="22"/><path d="M2 8.5l10 7 10-7"/></svg>;

  const SvgMap      = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>;
  const SvgBestiary = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c-1.5 0-2.8.6-3.7 1.6C7 4.8 6 4.5 5 5c-.5.3-.8.8-.8 1.4 0 .4.1.8.4 1.1C3.6 8.3 3 9.6 3 11c0 1.2.4 2.3 1 3.2-.6.5-1 1.2-1 2 0 .6.2 1.1.5 1.6C3.9 18.7 5 19.5 6.3 20c1 .4 2.4.7 3.7.8V22h4v-1.2c1.3-.1 2.7-.4 3.7-.8 1.3-.5 2.4-1.3 2.8-2.2.3-.5.5-1 .5-1.6 0-.8-.4-1.5-1-2 .6-.9 1-2 1-3.2 0-1.4-.6-2.7-1.6-3.5.3-.3.4-.7.4-1.1 0-.6-.3-1.1-.8-1.4-1-.5-2-.2-3.3-.4C14.8 2.6 13.5 2 12 2z"/><path d="M9 11c0 .6-.4 1-1 1s-1-.4-1-1 .4-1 1-1 1 .4 1 1z" fill="currentColor" stroke="none"/><path d="M17 11c0 .6-.4 1-1 1s-1-.4-1-1 .4-1 1-1 1 .4 1 1z" fill="currentColor" stroke="none"/><path d="M9.5 15.5s.8 1 2.5 1 2.5-1 2.5-1"/><path d="M7 8.5c.5-.8 1.5-1 2.5-.5"/><path d="M17 8.5c-.5-.8-1.5-1-2.5-.5"/></svg>;

  const heroCompacto = ABAS_DE_TRABALHO.has(activeTab);
  const alturaHero   = heroCompacto ? 64 : (campaign.coverImage ? 168 : 96);

  const tabs = [
    { id:"chat",     label:"Chat",      svg:<SvgChat/> },
    { id:"sheets",   label:"Agentes",   svg:<SvgSparkle/> },
    { id:"rolls",    label:"Rolagens",  svg:<SvgDice/> },
    { id:"members",  label:"Jogadores", svg:<SvgUsers/> },
    { id:"map",      label:"Mapas",     svg:<SvgMap/> },
    ...(isMaster ? [{ id:"mestre", label:"Mestre", svg:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }] : []),
    ...(isMaster ? [{ id:"bestiary", label:"Bestiário", svg:<SvgBestiary/> }] : []),
    ...((isMaster||isAdmin) ? [{ id:"settings", label:"Gerenciar", svg:<SvgSettings/> }] : []),
  ];

  return (
    <>
    {coverPreview && <CoverPreviewModal image={coverPreview} onConfirm={confirmCoverUpload} onClose={()=>setCoverPreview(null)}/>}
    <NarracaoOverlay campaign={campaign} uid={uid} isMaster={isMaster}/>
    {/* A altura vem do FLUXO, não de aritmética: o `main` já é uma coluna flex
        com altura definida (viewport − topbar − rodapé − barra de música). O
        antigo `calc(100vh - 136px)` era um número chutado — sobrepunha 11 px do
        rodapé no desktop e enfiava 8 px por baixo da barra inferior no celular. */}
    <div ref={raizRef} className="fade camp-root" style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,gap:0,
      height:alturaUtil ?? undefined, maxHeight:alturaUtil ?? undefined}}>

      {/* ── Banner de capa (hero) ──
          As ações moram AQUI, como overlays discretos — a barra de botões que
          duplicava abas (Adicionar Agentes → aba Agentes, Editar Campanha →
          aba Gerenciar) foi removida: navegação só pelas abas, ações só no hero. */}
      <input ref={coverInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files?.[0]&&handleCoverUpload(e.target.files[0])}/>
      {/* Compacto, o hero deixa de ser duas faixas sobrepostas e vira UMA linha
          flex: as duas linhas absolutas passam a `position:static` e se ordenam
          — voltar/capa/ajustar, depois título, depois convidar. É o que resolve
          a colisão medida entre "← VOLTAR" e o nome da campanha em 390 px. */}
      <div className="camp-hero" data-compacto={heroCompacto?1:0}
        style={{position:"relative",width:"100%",height:alturaHero,borderRadius:12,overflow:"hidden",flexShrink:0,
        display:heroCompacto?"flex":"block",alignItems:"center",gap:8,padding:heroCompacto?"0 12px":0,
        transition:"height .22s cubic-bezier(.22,1,.36,1)",
        border:"1px solid rgba(176,48,216,0.18)",
        background:campaign.coverImage?"transparent":"radial-gradient(120% 160% at 20% 0%,rgba(176,48,216,0.22),rgba(176,48,216,0.03) 60%),linear-gradient(180deg,rgba(20,14,26,0.9),rgba(10,8,14,0.95))"}}>
        {campaign.coverImage && <img className="camp-hero-img" src={campaign.coverImage} alt=""
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",display:"block",
            opacity:heroCompacto?0.4:1,transition:"opacity .22s ease"}}/>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0.10) 34%,rgba(0,0,0,0.78) 100%)",pointerEvents:"none"}}/>

        {/* topo: voltar (esq) + ações do mestre (dir) */}
        <div className="camp-hero-topo" style={{position:heroCompacto?"static":"absolute",order:0,flexShrink:0,
          top:10,left:12,right:12,display:"flex",alignItems:"center",gap:8,zIndex:2}}>
          <button onClick={onBack} title="Voltar às campanhas" style={{
            display:"flex",alignItems:"center",gap:6,
            background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.16)",borderRadius:8,cursor:"pointer",
            color:"rgba(255,255,255,0.85)",padding:"6px 12px",fontFamily:"Cinzel,serif",fontSize:9,
            letterSpacing:1,textTransform:"uppercase",backdropFilter:"blur(6px)",transition:"all 0.2s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,0,0,0.72)";e.currentTarget.style.color="#fff";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,0,0,0.5)";e.currentTarget.style.color="rgba(255,255,255,0.85)";}}>
            ← Voltar
          </button>
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            {isMaster && (
              <button onClick={()=>coverInputRef.current?.click()} disabled={coverUploading} title="Trocar a foto de capa"
                style={{display:"flex",alignItems:"center",gap:6,background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.16)",borderRadius:8,
                  cursor:coverUploading?"default":"pointer",color:"rgba(255,255,255,0.8)",padding:"6px 12px",fontFamily:"Cinzel,serif",fontSize:9,
                  letterSpacing:1,textTransform:"uppercase",backdropFilter:"blur(6px)",transition:"all 0.2s",opacity:coverUploading?0.5:1}}
                onMouseEnter={e=>{if(!coverUploading){e.currentTarget.style.background="rgba(0,0,0,0.72)";e.currentTarget.style.color="#fff";}}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,0,0,0.5)";e.currentTarget.style.color="rgba(255,255,255,0.8)";}}>
                {coverUploading?<span style={{fontSize:12}}>⏳</span>:<SvgCamera/>}
                <span className="camp-hero-btn-label">{coverUploading?"Enviando…":"Capa"}</span>
              </button>
            )}
            {isMaster && campaign.coverImage && (
              <button onClick={()=>setCoverPreview(campaign.coverImage)} title="Reenquadrar a capa"
                style={{background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.16)",borderRadius:8,cursor:"pointer",
                  color:"rgba(255,255,255,0.8)",padding:"6px 12px",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,
                  textTransform:"uppercase",backdropFilter:"blur(6px)",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,0,0,0.72)";e.currentTarget.style.color="#fff";}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,0,0,0.5)";e.currentTarget.style.color="rgba(255,255,255,0.8)";}}>
                ✦ Ajustar
              </button>
            )}
          </div>
        </div>

        {/* base: título + meta (esq) e CTA convidar (dir) */}
        <div className="camp-hero-base" style={{position:heroCompacto?"static":"absolute",order:1,flex:heroCompacto?1:undefined,minWidth:0,
          bottom:14,left:16,right:16,display:"flex",alignItems:heroCompacto?"center":"flex-end",gap:12,zIndex:2}}>
          <div style={{flex:1,minWidth:0}}>
            <div className="camp-hero-titulo" style={{fontFamily:"'Cinzel Decorative',serif",fontSize:heroCompacto?15:"clamp(19px,2.6vw,26px)",color:"#fff",lineHeight:1.15,
              textShadow:"0 2px 10px rgba(0,0,0,0.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {campaign.name}
            </div>
            <div className="camp-hero-chips" style={{display:heroCompacto?"none":"flex",alignItems:"center",gap:6,marginTop:6,flexWrap:"wrap"}}>
              {campaign.system&&(
                <span style={{fontFamily:"Cinzel,serif",fontSize:8.5,letterSpacing:1.2,color:"rgba(255,222,120,0.95)",textTransform:"uppercase",
                  padding:"3px 9px",background:"rgba(0,0,0,0.45)",border:"1px solid rgba(255,220,100,0.28)",borderRadius:20,backdropFilter:"blur(4px)"}}>
                  {campaign.system}
                </span>
              )}
              <span title="Jogadores na campanha" style={{fontFamily:"Cinzel,serif",fontSize:8.5,letterSpacing:1.2,color:"rgba(255,255,255,0.75)",textTransform:"uppercase",
                padding:"3px 9px",background:"rgba(0,0,0,0.45)",border:"1px solid rgba(255,255,255,0.16)",borderRadius:20,backdropFilter:"blur(4px)"}}>
                ◎ {campaign.members?.length||1}/{campaign.maxPlayers||6} jogadores
              </span>
              {isMaster&&(
                <span style={{fontFamily:"Cinzel,serif",fontSize:8.5,letterSpacing:1.2,color:"#e0c8ff",textTransform:"uppercase",
                  padding:"3px 9px",background:"rgba(176,48,216,0.4)",border:"1px solid rgba(200,140,255,0.4)",borderRadius:20,backdropFilter:"blur(4px)"}}>
                  ✦ Mestre
                </span>
              )}
            </div>
          </div>
          {/* Compacto, os chips somem — o contador de jogadores, que era o único
              deles com informação viva, continua legível aqui no `title`. */}
          <button onClick={()=>setShowInvite(v=>!v)}
            title={`Mostrar o código de convite · ${campaign.members?.length||1}/${campaign.maxPlayers||6} jogadores`}
            style={{display:"flex",alignItems:"center",gap:7,flexShrink:0,
              background:showInvite?"rgba(176,48,216,0.5)":"linear-gradient(135deg,rgba(176,48,216,0.55),rgba(120,30,180,0.55))",
              border:"1px solid rgba(200,140,255,0.5)",borderRadius:9,cursor:"pointer",
              color:"#f0e4ff",padding:"8px 16px",fontFamily:"Cinzel,serif",fontSize:10,
              letterSpacing:"0.08em",textTransform:"uppercase",backdropFilter:"blur(6px)",
              boxShadow:"0 2px 12px rgba(140,40,220,0.35)",transition:"all 0.2s"}}
            onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 3px 18px rgba(160,60,240,0.5)";e.currentTarget.style.transform="translateY(-1px)";}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 2px 12px rgba(140,40,220,0.35)";e.currentTarget.style.transform="none";}}>
            <SvgUserPlus/><span className="camp-hero-btn-label">Convidar</span>
          </button>
        </div>
      </div>

      {/* ── Painel código de convite ── */}
      {showInvite && (
        <div className="fade" style={{padding:"14px 18px",marginTop:10,
          background:"linear-gradient(135deg,rgba(176,48,216,0.10),rgba(176,48,216,0.03))",
          border:"1px solid rgba(176,48,216,0.28)",borderRadius:10,
          display:"flex",alignItems:"center",gap:16,flexShrink:0,flexWrap:"wrap"}}>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"var(--muted)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:5}}>
              Código de convite · compartilhe com seus jogadores
            </div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:24,letterSpacing:9,color:"#d4b0ff",fontWeight:700,textShadow:"0 0 18px rgba(176,48,216,0.4)"}}>
              {campaign.inviteCode||"------"}
            </div>
          </div>
          <button onClick={copyInviteCode} style={{
            marginLeft:"auto",padding:"9px 20px",background:inviteCopied?"rgba(106,170,122,0.18)":"rgba(176,48,216,0.18)",
            border:`1px solid ${inviteCopied?"rgba(106,170,122,0.45)":"rgba(176,48,216,0.45)"}`,
            borderRadius:8,cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,
            color:inviteCopied?"#7bc48b":"#d4b0ff",transition:"all 0.2s",textTransform:"uppercase",
          }}>{inviteCopied?"✓ Copiado!":"⧉ Copiar código"}</button>
          <button onClick={()=>setShowInvite(false)} aria-label="Fechar" style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:17,lineHeight:1,padding:"2px 4px"}}>✕</button>
        </div>
      )}

      {/* ── Tabs (pill deslizante — um único realce corre até a aba ativa) ── */}
      <div ref={tabsPill.containerRef} style={{display:"flex",gap:2,borderBottom:"1px solid var(--border)",flexShrink:0,marginTop:12,position:"relative",
        overflowX:"auto",scrollbarWidth:"none",WebkitOverflowScrolling:"touch",scrollSnapType:"x proximity",
        /* 5 de 8 abas ficavam fora da tela em 390 px sem nenhum sinal de que
           havia mais. A esmaecida na borda direita é esse sinal — e só existe
           quando de fato há aba escondida (`temMaisAbas`). */
        ...(temMaisAbas ? {
          maskImage:"linear-gradient(to right,#000 0,#000 calc(100% - 28px),transparent 100%)",
          WebkitMaskImage:"linear-gradient(to right,#000 0,#000 calc(100% - 28px),transparent 100%)",
        } : {})}}>
        <SlidingTabPill pill={tabsPill.pill} radius={8} background="rgba(176,48,216,0.14)" underline="#b030d8"/>
        {tabs.map(tab=>{
          const active = activeTab===tab.id;
          return (
            /* 13px de padding = 44 px de alvo (a regra da casa, `Atelier/ui.js`
               → HIT.mobile). E 0,52 de opacidade em vez de 0,42: sobre #14141c
               o rótulo inativo saía em 4,10:1 — reprovado. Agora dá 5,63:1. */
            <button key={tab.id} ref={tabsPill.setItemRef(tab.id)} onClick={()=>setActiveTab(tab.id)}
              data-ativa={active?1:0} style={{
              padding:"13px 15px",border:"none",cursor:"pointer",flexShrink:0,background:"transparent",
              fontFamily:"Cinzel,serif",fontSize:11.5,letterSpacing:"0.08em",textTransform:"uppercase",
              color: active ? "#e8d4ff" : "rgba(255,255,255,0.52)",
              transition:"color 0.2s",display:"flex",alignItems:"center",gap:7,
              position:"relative",zIndex:1,scrollSnapAlign:"center",
            }}
              onMouseEnter={e=>{if(!active)e.currentTarget.style.color="rgba(255,255,255,0.82)";}}
              onMouseLeave={e=>{e.currentTarget.style.color=active?"#e8d4ff":"rgba(255,255,255,0.52)";}}>
              <span style={{opacity: active ? 1 : 0.55, display:"flex", alignItems:"center"}}>{tab.svg}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Conteúdo ── */}
      <div style={{flex:1,minHeight:0,overflow:"hidden",display:"flex",flexDirection:"column",paddingTop:14}}>
        {activeTab==="chat"     && <CampaignChat campaignId={campaign.id} uid={uid} userName={userName} userPhoto={userPhoto} isMaster={isMaster}/>}
        {activeTab==="sheets"   && <SharedSheetsPanel campaignId={campaign.id} uid={uid} userName={userName} isMaster={isMaster} characters={characters}/>}
        {activeTab==="rolls"    && <RollFeed campaignId={campaign.id} uid={uid}/>}
        {activeTab==="members"  && <MembersPanel campaign={campaign} uid={uid} isMaster={isMaster}/>}
        {activeTab==="map"      && <CampaignMapTab campaignId={campaign.id} uid={uid} isMaster={isMaster}/>}
        {activeTab==="mestre"   && isMaster && <MestrePanel campaign={campaign} uid={uid} userName={userName} userPhoto={userPhoto}/>}
        {activeTab==="bestiary" && isMaster && <BestiaryTab campaignId={campaign.id}/>}
        {activeTab==="settings" && (isMaster||isAdmin) && <MasterSettings campaign={campaign} onBack={onBack} isMaster={isMaster}/>}
      </div>
    </div>
    </>
  );
}

export default CampaignDetail;
