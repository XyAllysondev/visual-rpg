import { useState, useEffect, useRef, Suspense } from "react";
import { useAuth } from "./hooks/useAuth";
import { useCharacter } from "./hooks/useCharacter";
import { useCampaign } from "./hooks/useCampaign";
/* O SDK do `firebase/auth` também não é mais importado aqui (spec 0031, onda D): ele
   ficou inteiro dentro de `features/auth/Login`, que é quem chama login, cadastro,
   recuperação de senha e persistência de sessão. */
/* O SDK do Firestore NÃO é importado aqui (spec 0029 AC-1). Todo acesso a dados passa
   pelos repositórios de `src/infrastructure/firestore/`, importados logo abaixo. */
import { useLocale } from "./i18n/useLocale";
import MasterSuite from './components/MasterSuite';
/* Trilhas Sonoras (spec 0031). A `LocalMusicBar` também mora nessa feature, mas quem a usa é
   a própria `MusicPlayerBar` — o App só conhece a tela e a barra de "tocando agora". */
import { MusicPlayerBar, MusicScreen } from "./features/musica";
/* Campanhas (spec 0031). O barril é a porta de entrada da feature. O App só conhece o
   que ele mesmo monta — a lista, o detalhe, os três modais, o painel de rolagens da
   ficha e o `fsSendMessage`, que ele usa para publicar na mesa ativa a rolagem feita
   dentro da ficha. Chat, bestiário, mesa tática e narração são miolo da feature. */
import {
  CampaignList, CampaignDetail, CreateCampaignModal, JoinCampaignModal,
  SheetRollPanel, CampaignRollDrawer, fsSendMessage,
} from "./features/campanha";
import * as usersRepo from "./infrastructure/firestore/usersRepo";
import * as publicSheetsRepo from "./infrastructure/firestore/publicSheetsRepo";
import * as sharedSheetsRepo from "./infrastructure/firestore/sharedSheetsRepo";
/* Casca visual e helpers que a ficha também usa (spec 0031, onda C) — ver o comentário
   dentro de cada módulo para o porquê de terem saído daqui. */
import Shell from "./lib/appShell";
import { OrdemParanormalSheet, DungeonsAndDragonsSheet } from "./lib/lazySystemSheets";
/* Ficha (spec 0031, onda C). O barril é a porta de entrada da feature: o App só conhece
   a grade de fichas, a ficha completa, os dois criadores e a visão pública por link. */
import {
  SheetList, FullSheet, CharacterCreator, DnDCharacterCreator, PublicSheetView,
} from "./features/ficha";
/* Institucional (spec 0031, onda D): a abertura animada e o roadmap público. */
import { IntroScreen, RoadmapScreen } from "./features/institucional";
/* Monetização (spec 0031, onda D): a tela de planos e o modal de cota estourada. */
import { PlansScreen, UpgradeModal } from "./features/monetizacao";
/* Sistemas (spec 0031, onda D): a vitrine e o catálogo. O App consulta `SYSTEMS` na
   restauração do `nexus_system` do localStorage — ver o comentário lá embaixo. */
import { SYSTEMS, SystemSelect } from "./features/sistemas";
/* Painel (spec 0031, onda D). O hook de dados do Painel mora na feature e só faz
 * leitura one-shot (`getDocs`) — o Painel não abre listener novo nenhum. Ele é
 * chamado AQUI, uma vez, porque a mesma contagem de pendências alimenta duas
 * superfícies: o bloco "Precisa de você" e o sino da Topbar. */
import { Dashboard, useDashboardData } from "./features/dashboard";
/* Última visita — `localStorage` puro, sem React e sem Firestore. */
import * as lastVisit from "./lib/lastVisit";
/* Mapa (spec 0031, onda D): o ateliê do menu lateral e a janela de transmissão. */
import { MapaScreen, CastView } from "./features/mapa";
/* Autenticação (spec 0031, onda D): o portão de entrada. */
import { Login } from "./features/auth";
/* Casca reusável (spec 0031, onda D — AC-3). Estes componentes não têm regra de negócio:
 * ornamentos, itens do menu e rodapé. O `Deco` já existia em `src/ui/` desde antes, mas o
 * App ainda declarava uma cópia própria — duplicata morta, agora resolvida importando daqui.
 * A névoa (`ui/AmbientBackdrop`), o anel do sigilo e as citações saíram junto e hoje só o
 * `features/auth/Login` os monta, por isso não aparecem mais nesta lista. */
import Deco from "./ui/Deco";
import AppFooter from "./ui/AppFooter";
import Sidebar from "./ui/Sidebar";
import Topbar from "./ui/Topbar";
import MobileBottomNav from "./ui/MobileBottomNav";

/* ── Dice roller: ver src/domain/dice.js (motor único — spec 0028 AC-9) ── */

/* ═══════════════════════════════
   ROOT
═══════════════════════════════ */
/* ── Ficha pública (rota /p/:charId, sem login) ─────────────────────── */
export default function App() {
  const { t: sT, lang: appLang, setLang: setAppLang } = useLocale();
  const [introPlayed, setIntroPlayed] = useState(() => sessionStorage.getItem("nx_intro") === "1");
  const { currentUser, authLoading, userName: hookUserName, userPhoto: hookUserPhoto, logout } = useAuth();
  const loggedIn = authLoading ? null : !!currentUser;
  const { campaigns, campsLoading: campaignsLoading, createCampaign, joinCampaign, leaveCampaign } = useCampaign(currentUser?.uid, hookUserName);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showJoinCampaign, setShowJoinCampaign] = useState(false);
  const [activeSystem, setActiveSystem] = useState(() => {
    try {
      const s = localStorage.getItem('nexus_system');
      const saved = s ? JSON.parse(s) : null;
      // Um sistema que saiu do ar não pode ser retomado pelo cache — senão quem já
      // tinha entrado em D&D/Tormenta voltaria direto para lá, furando o "EM BREVE".
      return saved && SYSTEMS.some(x => x.id === saved.id && x.available) ? saved : null;
    } catch { return null; }
  });
  const [screen, setScreen] = useState(() => localStorage.getItem('nexus_screen') || "dashboard");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nexus_sidebar_collapsed') === 'true');
  const [showRollPanel, setShowRollPanel] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [creatingChar, setCreatingChar] = useState(false);
  const [createdChar, setCreatedChar] = useState(null);
  const { characters, setCharacters, charsLoading, saveError, clearSaveError, saveCharacter, deleteCharacter } = useCharacter(currentUser?.uid, activeSystem?.id);
  /* O estado `sessions` foi removido: `setSessions` só era chamado para reler o
     MESMO array vazio do localStorage — nada em lugar nenhum do app adicionava
     uma sessão. Eram três efeitos e uma chave de storage sustentando um zero
     permanente com cara de dado. */
  const [userPlans, setUserPlans] = useState([]);  // array de system IDs assinados: ['op','tormenta','dnd']
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [musicTokens, setMusicTokens] = useState(() => {
    const now = Date.now();
    const ytToken = localStorage.getItem("nx_yt_token");
    const ytExp = Number(localStorage.getItem("nx_yt_exp") || 0);
    const spToken = localStorage.getItem("nx_sp_token");
    const spExp = Number(localStorage.getItem("nx_sp_exp") || 0);
    return {
      yt: ytToken && now < ytExp ? ytToken : null,
      sp: spToken && now < spExp ? spToken : null,
    };
  });
  const ytPlayerRef        = useRef(null);
  const rollCampaignRef    = useRef(null);
  /* { characterId: [{campaignId, sheetId}] } — COORDENADAS, não handles do Firestore.
     Antes da spec 0029 isto guardava `DocumentReference` cru vindo do snapshot, e a
     escrita lá embaixo usava a ref direto. Era uma bomba silenciosa: a ref sobrevive à
     desmontagem do listener que a produziu, então continuava gravável depois que a
     assinatura já tinha morrido. Agora só atravessa string (AC-3). */
  /* Virou ESTADO porque agora tem leitor de tela: o Painel mostra "sua ficha
     está ao vivo na mesa X". Enquanto era só `useRef`, o listener global rodava
     e ninguém via o resultado.
     O ref continua espelhado — `handleSheetUpdate` lê o valor de dentro de um
     callback e precisa do valor CORRENTE, não do capturado no render. */
  const liveSheetRefsRef   = useRef({});
  const [liveSheets, setLiveSheets] = useState({});

  // Global live-sheet tracker — stays active regardless of which screen is open
  const campaignsRef = useRef([]);
  campaignsRef.current = campaigns;
  /* O snapshot reemite a cada escrita numa mesa aberta. Sem esta comparação,
     cada reemissão viraria um `setState` no App — ou seja, re-render em cascata
     da árvore inteira (ficha, mesa, mapa) por um mapa que não mudou. */
  const aplicarLiveSheets = (mapa) => {
    liveSheetRefsRef.current = mapa;
    setLiveSheets(prev =>
      JSON.stringify(prev) === JSON.stringify(mapa) ? prev : mapa
    );
  };
  useEffect(() => {
    // O repo não emite nada quando não há uid/campanha, então zerar é responsabilidade daqui.
    if (!currentUser?.uid) { aplicarLiveSheets({}); return; }
    const camps = campaignsRef.current;
    if (!camps.length) return;
    return sharedSheetsRepo.watchLiveRefsByCharacter(
      camps.map(c => c.id),
      currentUser.uid,
      aplicarLiveSheets
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, campaigns.map(c => c.id).join('|')]);

  /* ── Dados do Painel + sino ──
     Uma chamada só. `pendentes` é a MESMA lista que o "Precisa de você" desenha
     e que o sino conta: um sinal, duas superfícies. */
  const dadosPainel = useDashboardData({ uid: currentUser?.uid || "", characters, campaigns });

  /* ── Última visita ──
     Grava nos pontos de navegação que já existiam. Fica num efeito, e não no
     `renderScreen`, porque `renderScreen` roda a cada render: registrar lá
     reescreveria o carimbo a cada digitada em qualquer campo da tela. */
  useEffect(() => {
    if (screen === "map")    lastVisit.registrar({ kind:"mapa",  id:"editor", label:"Editor de Mapas" });
    if (screen === "master") lastVisit.registrar({ kind:"mundo", id:"forja",  label:"Forja do Mestre" });
  }, [screen]);

  const abrirCampanha = (camp) => {
    if (!camp) return;
    lastVisit.registrar({ kind:"campanha", id:camp.id, label:camp.name });
    setSelectedCampaign(camp);
    setScreen("party");
  };

  // Escuta plano em tempo real — ativa automaticamente após PIX pago
  useEffect(() => {
    if (!currentUser) { setUserPlans([]); return; }
    return usersRepo.watchSubscribedSystems(currentUser.uid, setUserPlans);
  }, [currentUser?.uid]);

  useEffect(() => {
    setSelectedCampaign(prev => prev ? (campaigns.find(c => c.id === prev.id) || null) : null);
  }, [campaigns]);

  useEffect(() => {
    if (activeSystem) localStorage.setItem('nexus_system', JSON.stringify(activeSystem));
    else localStorage.removeItem('nexus_system');
  }, [activeSystem]);

  // Apply the active system's visual identity (drives global CSS variables).
  useEffect(() => {
    document.documentElement.dataset.nexusSystem = activeSystem?.id || 'op';
  }, [activeSystem?.id]);

  useEffect(() => { localStorage.setItem('nexus_screen', screen); }, [screen]);

  // ── URL routing ──────────────────────────────────────────────────────────────
  const SCREEN_PATH = { dashboard:'/painel', sheet:'/fichas', map:'/mapas', master:'/mestre', music:'/trilhas', party:'/campanhas', roadmap:'/roadmap', planos:'/planos' };
  const PATH_SCREEN = Object.fromEntries(Object.entries(SCREEN_PATH).map(([k,v])=>[v,k]));

  // State → URL: push whenever navigation state changes
  useEffect(() => {
    if (window.location.pathname.startsWith('/p/')) return; // rota pública — não redirecionar
    if (loggedIn === null) return; // still loading auth
    if (!loggedIn) { if (window.location.pathname !== '/login') window.history.replaceState({},'','/login'); return; }
    if (!activeSystem) { if (window.location.pathname !== '/sistema') window.history.replaceState({},'','/sistema'); return; }
    let path;
    if (screen === 'sheet' && createdChar) path = `/fichas/${String(createdChar.id || createdChar.createdAt)}`;
    else if (screen === 'party' && selectedCampaign) path = `/campanhas/${selectedCampaign.id}`;
    else path = SCREEN_PATH[screen] || '/painel';
    if (window.location.pathname !== path) window.history.pushState({},'', path);
  }, [screen, createdChar, selectedCampaign, loggedIn, activeSystem]);

  // URL → State: apply URL path once after auth+system are ready
  const _urlInit = useRef(false);
  useEffect(() => {
    if (!loggedIn || !activeSystem || _urlInit.current) return;
    _urlInit.current = true;
    const path = window.location.pathname;
    const fichaM = path.match(/^\/fichas\/(.+)$/);
    const campM  = path.match(/^\/campanhas\/(.+)$/);
    if (fichaM)      { setScreen('sheet'); }
    else if (campM)  { setScreen('party'); }
    else { const s = PATH_SCREEN[path]; if (s) setScreen(s); }
  }, [loggedIn, activeSystem]);

  // When characters load after a deep link to /fichas/:id, restore the character
  useEffect(() => {
    if (!loggedIn || !activeSystem) return;
    const fichaM = window.location.pathname.match(/^\/fichas\/(.+)$/);
    if (fichaM && screen === 'sheet' && !createdChar && characters.length > 0) {
      const char = characters.find(c => String(c.id || c.createdAt) === fichaM[1]);
      if (char) setCreatedChar(char);
    }
  }, [characters, screen, loggedIn, activeSystem]);

  // Popstate: handle browser back / forward
  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname;
      const fichaM = path.match(/^\/fichas\/(.+)$/);
      const campM  = path.match(/^\/campanhas\/(.+)$/);
      if (fichaM) {
        const char = characters.find(c => String(c.id || c.createdAt) === fichaM[1]);
        setScreen('sheet'); setCreatedChar(char || null);
      } else if (path === '/fichas') {
        setScreen('sheet'); setCreatedChar(null);
      } else if (campM) {
        const camp = campaigns.find(c => c.id === campM[1]);
        setScreen('party'); if (camp) setSelectedCampaign(camp);
      } else if (path === '/campanhas') {
        setScreen('party'); setSelectedCampaign(null);
      } else {
        const s = PATH_SCREEN[path] || 'dashboard';
        setScreen(s); setCreatedChar(null); setSelectedCampaign(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [characters, campaigns]);
  useEffect(() => { setCreatedChar(null); }, [activeSystem?.id]);
  useEffect(() => {
    localStorage.setItem('nexus_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  /* load YouTube IFrame API once */
  useEffect(() => {
    if (document.getElementById("yt-api-script")) return;
    const tag = document.createElement("script");
    tag.id = "yt-api-script";
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }, []);

  const handleFinishChar = (char) => {
    const sysCharCount = characters.filter(c =>
      c.systemId === activeSystem?.id || (!c.systemId && activeSystem?.id === 'op')
    ).length;

    // Limites: assinante do sistema=5, free=1
    const limit = userPlans.includes(activeSystem?.id) ? 5 : 1;
    if (sysCharCount >= limit) {
      setCreatingChar(false);
      setShowUpgrade(true);
      return;
    }

    const d = new Date();
    const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
    const charWithDate = { ...char, id: Date.now(), nex: 5, createdAt: dateStr, systemId: activeSystem?.id };
    saveCharacter(charWithDate);
    setCreatedChar(charWithDate);
    setCreatingChar(false);
    setScreen("sheet");
  };

  const [pendingEdits, setPendingEdits] = useState([]);
  const handleLoadPendingEdits = () => {
    if (!createdChar?.public) return;
    const cId = String(createdChar.id || createdChar.createdAt);
    publicSheetsRepo.listPendingEdits(cId).then(setPendingEdits);
  };
  const handleApprovePendingEdit = async (edit, mergedChar) => {
    if (!createdChar) return;
    const cId = String(createdChar.id || createdChar.createdAt);
    const keep = { id: createdChar.id, createdAt: createdChar.createdAt, systemId: createdChar.systemId, public: createdChar.public, editToken: createdChar.editToken, ownerUid: currentUser?.uid };
    const final = mergedChar ? { ...mergedChar, ...keep } : { ...createdChar, ...edit.proposedData, ...keep };
    setCreatedChar(final);
    saveCharacter(final);
    publicSheetsRepo.save(cId, final, currentUser?.uid);
    await publicSheetsRepo.resolvePendingEdit(cId, edit.id, "approved");
    setPendingEdits(prev => prev.filter(e => e.id !== edit.id));
  };
  const handleRejectPendingEdit = async (edit) => {
    if (!createdChar) return;
    const cId = String(createdChar.id || createdChar.createdAt);
    await publicSheetsRepo.resolvePendingEdit(cId, edit.id, "rejected");
    setPendingEdits(prev => prev.filter(e => e.id !== edit.id));
  };

  const renderScreen = () => {
    const sysName = activeSystem?.name || "Sistema";
    if (creatingChar) return null;
    if (createdChar && screen === "sheet") {
      const uid    = currentUser?.uid || "";
      const uName  = localStorage.getItem("nexus_profile_name") || currentUser?.displayName || "Agente";
      const uPhoto = localStorage.getItem("nexus_profile_photo") || "";
      const activeRollCampaign = campaigns.filter(c => c.isActive !== false)[0] ?? null;
      const handleRoll = (roll) => {
        const c = rollCampaignRef.current || activeRollCampaign;
        if (!c) return;
        const isAtk = roll.kind === "attack";
        fsSendMessage(c.id, uid, uName, uPhoto,
          `${roll.charName} rolou ${roll.expr||roll.attr} → [${roll.rolls.join(",")}] = ${roll.result}`,
          "roll", {
            expr: roll.expr || roll.attr, rolls: roll.rolls, total: roll.result,
            sides: parseInt((roll.dice||"D20").slice(1)), count: roll.rolls.length, crit: !!roll.crit,
            name: roll.name || roll.attr || roll.expr, kind: roll.kind || null, rollType: roll.rollType || null,
            elemento: roll.elemento || null, charName: roll.charName || uName,
            dano: isAtk ? (roll.dano ?? null) : null,
          });
      };
      const handleSheetUpdate = (updated) => {
        setCreatedChar(updated);
        saveCharacter(updated);
        const cId = String(updated.id || updated.createdAt);
        if (updated.public) publicSheetsRepo.save(cId, updated, currentUser?.uid);
        else publicSheetsRepo.remove(cId);
        // Sync to live sharedSheets via global ref (always active)
        (liveSheetRefsRef.current[cId] || []).forEach(coord =>
          sharedSheetsRepo.updateCharacterData(coord, updated)
        );
      };
      const sheetFallback = (
        <div style={{minHeight:"50vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:32,height:32,border:"2px solid rgba(201,168,76,0.3)",borderTopColor:"var(--gold)",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        </div>
      );
      const opFill = activeSystem?.id === "op";
      return (
        <div style={opFill ? {display:"flex",gap:12,alignItems:"stretch",flex:1,minHeight:0} : {display:"flex",gap:12,alignItems:"start"}}>
          <div style={opFill ? {flex:1,minWidth:0,display:"flex",flexDirection:"column",minHeight:0} : {flex:1,minWidth:0}}>
            {activeSystem?.id === "op" ? (
              <>
                <Suspense fallback={sheetFallback}>
                  <OrdemParanormalSheet character={createdChar} charId={String(createdChar.id || createdChar.createdAt)} onBack={()=>{ setCreatedChar(null); setHistoryOpen(false); }} onRoll={handleRoll} onUpdate={handleSheetUpdate} pendingEdits={pendingEdits} onLoadPendingEdits={handleLoadPendingEdits} onApprovePendingEdit={handleApprovePendingEdit} onRejectPendingEdit={handleRejectPendingEdit}
                    rollCampaign={activeRollCampaign} onOpenHistory={()=>setHistoryOpen(true)}/>
                </Suspense>
                {historyOpen && activeRollCampaign && <CampaignRollDrawer campaign={activeRollCampaign} onClose={()=>setHistoryOpen(false)}/>}
              </>
            ) : activeSystem?.id === "dnd" ? (
              <Suspense fallback={sheetFallback}>
                <DungeonsAndDragonsSheet character={createdChar} onBack={()=>setCreatedChar(null)} onRoll={handleRoll} onUpdate={handleSheetUpdate}/>
              </Suspense>
            ) : (
              <FullSheet character={createdChar} onBack={()=>setCreatedChar(null)} onRoll={handleRoll}
                showPanel={showRollPanel} onTogglePanel={()=>setShowRollPanel(v=>!v)}
                onUpdate={handleSheetUpdate}/>
            )}
          </div>
          {showRollPanel && (
            <SheetRollPanel campaigns={campaigns} uid={uid} userName={uName} userPhoto={uPhoto}
              onRollReady={c => { rollCampaignRef.current = c; }}/>
          )}
        </div>
      );
    }
    switch(screen){
      case "dashboard": return <Dashboard system={activeSystem} onCreateChar={()=>setCreatingChar(true)} characters={characters} onSelectChar={c=>{ setCreatedChar(c); setScreen("sheet"); }} onNav={setScreen} userPlans={userPlans} onShowUpgrade={()=>setScreen("planos")}
        uid={currentUser?.uid || ""} campaigns={campaigns} liveSheets={liveSheets} dados={dadosPainel}
        onOpenCampaign={abrirCampanha} onCreateCampaign={()=>{ setScreen("party"); setShowCreateCampaign(true); }}/>;
      case "sheet":     return <SheetList characters={characters} system={activeSystem} onCreateChar={()=>setCreatingChar(true)} onSelectChar={c=>{ setCreatedChar(c); }} onDeleteChar={(c)=>{ deleteCharacter(c); if (createdChar && ((createdChar.id && createdChar.id===c.id) || (!createdChar.id && createdChar.createdAt===c.createdAt))) setCreatedChar(null); }} onUpdateChar={(c)=>saveCharacter(c)}/>;
      /* `plan` vem do MESMO mecanismo que o resto do app usa para cota:
         `userPlans` é o array `subscribedSystems` do doc do usuário, escutado
         em tempo real e preenchido pelo webhook do PIX. Assinar qualquer
         sistema é o que já destrava limites (fichas, App.jsx:11808) — aqui
         destrava a cota de mapas-múndi (spec 0028 · AC-3).
         `'pro'` é a chave interna de "plano pago" em `WorldMap/model/quotas`;
         não é string que o projeto grave em lugar nenhum. Não inventar outra. */
      case "map":       return <MapaScreen uid={currentUser?.uid || ""} plan={userPlans.length > 0 ? 'pro' : 'free'} onBack={()=>setScreen("dashboard")} />;
      case "master":    return <MasterSuite system={activeSystem} uid={currentUser?.uid || ""} />;
      case "roadmap":   return <RoadmapScreen />;
      case "planos":    return <PlansScreen userPlans={userPlans} currentUser={currentUser}/>;
      case "party": {
        const uid = currentUser?.uid || "";
        const userName = localStorage.getItem("nexus_profile_name") || currentUser?.displayName || "Agente";
        const userPhoto = localStorage.getItem("nexus_profile_photo") || currentUser?.photoURL || "";
        if (selectedCampaign) {
          const live = campaigns.find(c=>c.id===selectedCampaign.id) || selectedCampaign;
          return (
            <>
              <CampaignDetail campaign={live} uid={uid} userName={userName} userPhoto={userPhoto}
                characters={characters} onBack={()=>setSelectedCampaign(null)}/>
              {showCreateCampaign && <CreateCampaignModal onClose={()=>setShowCreateCampaign(false)} onCreate={async(data)=>{const r=await createCampaign(data);if(r&&!r.limitError){setShowCreateCampaign(false);return true;}return r||false;}}/>}
              {showJoinCampaign && <JoinCampaignModal onClose={()=>setShowJoinCampaign(false)} onJoin={async(code)=>{const r=await joinCampaign(code);if(!r?.error)setShowJoinCampaign(false);return r;}}/>}
            </>
          );
        }
        return (
          <>
            <CampaignList uid={uid} userName={userName} campaigns={campaigns} loading={campaignsLoading}
              onOpenCampaign={abrirCampanha}
              onCreateCampaign={()=>setShowCreateCampaign(true)}
              onJoinCampaign={()=>setShowJoinCampaign(true)}/>
            {showCreateCampaign && <CreateCampaignModal onClose={()=>setShowCreateCampaign(false)} onCreate={async(data)=>{const r=await createCampaign(data);if(r&&!r.limitError){setShowCreateCampaign(false);return true;}return r||false;}}/>}
            {showJoinCampaign && <JoinCampaignModal onClose={()=>setShowJoinCampaign(false)} onJoin={async(code)=>{const r=await joinCampaign(code);if(!r?.error)setShowJoinCampaign(false);return r;}}/>}
          </>
        );
      }
      default: return <Dashboard system={activeSystem} onCreateChar={()=>setCreatingChar(true)} characters={characters} onNav={setScreen} userPlans={userPlans} onShowUpgrade={()=>setScreen("planos")}
        uid={currentUser?.uid || ""} campaigns={campaigns} liveSheets={liveSheets} dados={dadosPainel}
        onOpenCampaign={abrirCampanha} onCreateCampaign={()=>{ setScreen("party"); setShowCreateCampaign(true); }}/>;
    }
  };

  /* Rotas diretas vêm ANTES da intro. `introPlayed` sai do sessionStorage, que é por aba —
   * a janela de transmissão e o link público são sempre sessão nova, então a intro animada
   * apareceria toda vez antes do conteúdo. Numa TV isso é exatamente o que não se quer. */

  // Rota pública — sem login necessário
  const _pubM = window.location.pathname.match(/^\/p\/(.+)$/);
  if (_pubM) return <PublicSheetView charId={_pubM[1]} />;

  // Rota de transmissão (doc Owlbear /docs/casting) — janela/tela secundária da mesa.
  const _castM = window.location.pathname.match(/^\/cast\/(.+)$/);
  if (_castM) return <CastView campaignId={decodeURIComponent(_castM[1])} />;

  if (!introPlayed) return (
    <IntroScreen onDone={() => { sessionStorage.setItem("nx_intro", "1"); setIntroPlayed(true); }} />
  );

  if (loggedIn === null) return (<><Shell/><div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)"}}><div style={{width:32,height:32,border:"2px solid rgba(201,168,76,0.3)",borderTopColor:"var(--gold)",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/></div></>);
  if (!loggedIn) return (<><Shell/><Login onLogin={()=>{}}/></>);
  if (!activeSystem) return (<><Shell/><SystemSelect onSelect={sys => setActiveSystem(sys)} onLogout={logout}/></>);

  if (creatingChar) {
    if (activeSystem?.id === "dnd") return (
      <><Shell/><DnDCharacterCreator onFinish={handleFinishChar} onCancel={()=>setCreatingChar(false)}/></>
    );
    return (
      <><Shell/><CharacterCreator onFinish={handleFinishChar} onCancel={()=>setCreatingChar(false)}/></>
    );
  }

  return (
    <>
      <Shell/>
      <Deco/>
      {saveError && (
        <div role="alert" style={{position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:9000, background:"#2a1414", border:"1px solid rgba(224,112,112,0.5)", color:"#f0b0b0", borderRadius:8, padding:"10px 16px 10px 18px", fontSize:13, maxWidth:"90%", display:"flex", alignItems:"center", gap:12, boxShadow:"0 8px 30px rgba(0,0,0,0.42)"}}>
          <span>⚠ {saveError}</span>
          <button onClick={clearSaveError} style={{background:"none", border:"none", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:16, lineHeight:1}}>×</button>
        </div>
      )}
      <div style={{display:"flex", minHeight:"100vh", background: screen === "roadmap" ? "transparent" : "var(--bg)", position:"relative", zIndex:1}}>
        <Sidebar active={screen} onNav={setScreen} collapsed={collapsed} setCollapsed={setCollapsed} system={activeSystem} onChangeSystem={()=>setActiveSystem(null)} onLogout={logout} campaignCount={campaigns.filter(c=>c.isActive&&c.masterId===currentUser?.uid).length}/>
        <div style={{flex:1, display:"flex", flexDirection:"column", minWidth:0, overflow:"hidden"}}>
          <Topbar screen={screen} system={activeSystem} onChangeSystem={()=>setActiveSystem(null)} onLogout={logout}
            pendencias={dadosPainel.pendentes?.length || 0}/>
          {/* hidden div that hosts the YT IFrame player — never unmounts */}
          <div id="yt-player-host" style={{ position:"fixed", top:-9999, left:-9999, width:1, height:1, pointerEvents:"none" }} />
          <main style={{flex:1, overflowY: (screen==="master" || (screen==="sheet" && createdChar && activeSystem?.id==="op")) ? "hidden" : "auto", padding: screen==="master" ? 0 : ((screen==="sheet" && createdChar && activeSystem?.id==="op") ? "12px 14px" : "20px 20px"), paddingBottom: screen==="master" ? 0 : ((screen==="sheet" && createdChar && activeSystem?.id==="op") ? 12 : (nowPlaying ? 112 : 20)), display:"flex", flexDirection:"column", minHeight:0}}>
            {/* MusicScreen is always mounted so audio persists across navigation */}
            <div style={{ display: screen === "music" ? "block" : "none" }}>
              <MusicScreen nowPlaying={nowPlaying} onNowPlaying={setNowPlaying} musicTokens={musicTokens} onMusicTokens={setMusicTokens} ytPlayerRef={ytPlayerRef} />
            </div>
            {/* A campanha ABERTA é uma tela de trabalho: participa do flex para que a
                altura venha do fluxo (ver `camp-root`). A LISTA de campanhas continua
                fluindo normalmente — ela cresce com o conteúdo e rola no `main`. */}
            {screen !== "music" && <div key={screen} className="fade-screen" style={(screen==="master" || (screen==="party" && !!selectedCampaign) || (screen==="sheet" && createdChar && activeSystem?.id==="op")) ? {flex:1, display:"flex", flexDirection:"column", minHeight:0} : {}}>{renderScreen()}</div>}
          </main>
          {nowPlaying && <MusicPlayerBar nowPlaying={nowPlaying} onNowPlaying={setNowPlaying} ytPlayerRef={ytPlayerRef} />}
          <MobileBottomNav active={screen} onNav={setScreen}/>
          <AppFooter system={activeSystem}/>
        </div>
      </div>
      {showUpgrade && <UpgradeModal onClose={()=>setShowUpgrade(false)} onGoToPlans={()=>{setShowUpgrade(false);setScreen("planos");}}/>}
    </>
  );
}

