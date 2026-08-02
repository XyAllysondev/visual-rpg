import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { ThemeStyles } from "./themes/ThemeProvider";
import { SYSTEM_THEMES, getCardAccent } from "./themes";
import { useSlidingPill } from "./hooks/useSlidingPill";
import SlidingTabPill from "./components/SlidingTabPill";
import { ELEMENTOS, getElementTheme } from "./components/systems/OrdemParanormal/elementos";
import ElementoSymbol from "./components/systems/OrdemParanormal/ElementoSymbol";
import DossierCard from "./components/systems/OrdemParanormal/DossierCard";
import { auth, db } from "./firebase";
import { useAuth } from "./hooks/useAuth";
import { useCharacter } from "./hooks/useCharacter";
import { useCampaign } from "./hooks/useCampaign";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, reauthenticateWithPopup,
  sendPasswordResetEmail, updateProfile,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, deleteField, collection, addDoc, query, orderBy, limit, onSnapshot, getDocs, serverTimestamp, arrayUnion, arrayRemove, where, deleteDoc, startAfter, writeBatch, Timestamp } from "firebase/firestore";
import { roadmapData } from './roadmapData';
import { useLocale } from "./i18n/useLocale";
import MapEditor from './components/MapEditor';
import MasterSuite from './components/MasterSuite';
import WorldMapAtelier from './components/WorldMap/Atelier';
import { saveAsset } from './components/MapEditor/assets/assetLib';
import LicencaOP from "./components/LicencaOP";
import { getActiveAvatar } from "./domain/character";
import { rollDice, rollNotation, rollOP } from "./domain/dice";
import REGRAS_OFICIAIS from "./data/ordemParanormal/regras-oficiais.json";
import RITUAIS_LIB from "./data/ordemParanormal/rituais-oficiais.json";
import ITENS_LIB from "./data/ordemParanormal/itens-oficiais.json";
import MODS_LIB from "./data/ordemParanormal/modificacoes-oficiais.json";
import TOKENS_LIB from "./data/ordemParanormal/tokens-oficiais.json";

// System-specific sheets are code-split (Phase 3 theming architecture).
const OrdemParanormalSheet = lazy(() => import("./components/systems/OrdemParanormal/OrdemParanormalSheet"));
// Construtor de tokens (paper-doll) — pesado em assets, carrega só quando aberto
const TokenBuilder = lazy(() => import("./components/systems/OrdemParanormal/TokenBuilder"));
const DungeonsAndDragonsSheet = lazy(() => import("./components/systems/DungeonsAndDragons/DungeonsAndDragonsSheet"));
// A MESA do mapa-múndi (spec 0028 F4) — só carrega quando o grupo a abre.
const MesaDoMapaMundi = lazy(() => import("./components/WorldMap/Mesa"));

const googleProvider = new GoogleAuthProvider();

/* ── Firestore helpers (fail-silent so app still works if Firestore not enabled) ── */
const fsSetMusicLink = async (uid, svc, data) => {
  try { await setDoc(doc(db, "users", uid), { musicLinks: { [svc]: data } }, { merge: true }); } catch (e) { console.error("[fsSetMusicLink] falhou:", e); }
};
const fsDeleteMusicLink = async (uid, svc) => {
  try { await updateDoc(doc(db, "users", uid), { [`musicLinks.${svc}`]: deleteField() }); } catch (e) { console.error("[fsDeleteMusicLink] falhou:", e); }
};
const fsGetMusicLinks = async (uid) => {
  try { const snap = await getDoc(doc(db, "users", uid)); return snap.exists() ? (snap.data().musicLinks || {}) : {}; } catch (e) { console.error("[fsGetMusicLinks] falhou:", e); return {}; }
};

/* ── Firestore: fichas (fail-silent) ── */

const fsSavePublicSheet = async (charId, data, ownerUid) => {
  try {
    const payload = { ...data, public: true, _updatedAt: Date.now() };
    if (ownerUid) payload.ownerUid = ownerUid;
    await setDoc(doc(db, "publicSheets", String(charId)), payload);
  } catch (e) { console.error("[fsSavePublicSheet] falhou:", e); }
};
const fsRemovePublicSheet = async (charId) => {
  try { await deleteDoc(doc(db, "publicSheets", String(charId))); } catch (e) { console.error("[fsRemovePublicSheet] falhou:", e); }
};
const fsSavePendingEdit = async (charId, proposedData, editorName) => {
  try {
    const id = String(Date.now());
    await setDoc(doc(db, "publicSheets", String(charId), "pendingEdits", id), {
      id, proposedData, editorName: editorName || "Anônimo",
      timestamp: Date.now(), status: "pending",
    });
  } catch (e) { console.error("[fsSavePendingEdit] falhou:", e); }
};
const fsGetPendingEdits = async (charId) => {
  try {
    const snap = await getDocs(collection(db, "publicSheets", String(charId), "pendingEdits"));
    return snap.docs.map(d => d.data()).filter(e => e.status === "pending").sort((a,b) => b.timestamp - a.timestamp);
  } catch (e) { console.error("[fsGetPendingEdits] falhou:", e); return []; }
};
const fsResolvePendingEdit = async (charId, editId, status) => {
  try { await setDoc(doc(db, "publicSheets", String(charId), "pendingEdits", String(editId)), { status }, { merge: true }); } catch (e) { console.error("[fsResolvePendingEdit] falhou:", e); }
};

/* ── Firestore: plano do usuário (fail-silent) ── */
const fsGetUserPlan = async (uid) => {
  if (!uid) return 'free';
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data().plan || 'free') : 'free';
  } catch (e) { console.error("[fsGetUserPlan] falhou:", e); return 'free'; }
};

// REACT_APP_API_URL = URL base do backend na Vercel (ex: https://api.playnexusrpg.com).
// Vazio em dev local → as chamadas caem em caminho relativo do próprio host.
const API_BASE = process.env.REACT_APP_API_URL || '';

/* ── Criação de cobrança PIX ── */
const createPixPayment = async (userId, userEmail) => {
  const res = await fetch(`${API_BASE}/api/create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, userEmail, planName: 'ordem' }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Erro ao gerar PIX'); }
  return res.json();
};

/* ── Dice roller: ver src/domain/dice.js (motor único — spec 0028 AC-9) ── */

/* ── Campaign helpers ── */
const generateInviteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
};

const resizeCoverImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX_W = 640, MAX_H = 420;
      let w = img.width, h = img.height;
      const ratio = Math.min(MAX_W / w, MAX_H / h, 1);
      w = Math.round(w * ratio); h = Math.round(h * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = reject;
    img.src = e.target.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

function CoverPreviewModal({ image: initialImage, onConfirm, onClose }) {
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const lastMouse = useRef({ x: 0, y: 0 });

  const [image, setImage] = useState(initialImage);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imgNatural, setImgNatural] = useState({ w: 640, h: 420 });
  const [contSize, setContSize] = useState({ w: 540, h: 304 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, [image]);

  useEffect(() => { setZoom(1); setPos({ x: 0, y: 0 }); }, [image]);

  const baseScale = imgNatural.w > 0
    ? Math.max(contSize.w / imgNatural.w, contSize.h / imgNatural.h)
    : 1;
  const totalScale = baseScale * zoom;

  const clamp = (x, y, scale) => {
    const hw = Math.max(0, (imgNatural.w * scale - contSize.w) / 2);
    const hh = Math.max(0, (imgNatural.h * scale - contSize.h) / 2);
    return { x: Math.max(-hw, Math.min(hw, x)), y: Math.max(-hh, Math.min(hh, y)) };
  };

  const onImgLoad = (e) => setImgNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight });

  const onMouseDown = (e) => { e.preventDefault(); setIsDragging(true); lastMouse.current = { x: e.clientX, y: e.clientY }; };
  const onMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPos(prev => clamp(prev.x + dx, prev.y + dy, totalScale));
  };
  const onMouseUp = () => setIsDragging(false);

  const onTouchStart = (e) => { if (e.touches.length===1) { setIsDragging(true); lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } };
  const onTouchMove = (e) => {
    if (!isDragging || e.touches.length!==1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - lastMouse.current.x;
    const dy = e.touches[0].clientY - lastMouse.current.y;
    lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setPos(prev => clamp(prev.x + dx, prev.y + dy, totalScale));
  };

  const onZoom = (v) => { setZoom(v); setPos(prev => clamp(prev.x, prev.y, baseScale * v)); };

  const handleConfirm = () => {
    const OUT_W = 640, OUT_H = 360;
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W; canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      const sx = OUT_W / contSize.w, sy = OUT_H / contSize.h;
      ctx.translate(OUT_W/2 + pos.x * sx, OUT_H/2 + pos.y * sy);
      ctx.scale(totalScale * sx, totalScale * sy);
      ctx.drawImage(img, -img.naturalWidth/2, -img.naturalHeight/2);
      onConfirm(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = image;
  };

  const handleNewFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try { setImage(await resizeCoverImage(file)); } catch(_) {}
    e.target.value = "";
  };

  return createPortal(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.62)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--card2)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,width:"100%",maxWidth:600,overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,0.55)"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <span style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:"0.12em",color:"#ccc",textTransform:"uppercase"}}>Ajustar Imagem de Capa</span>
          <span onClick={onClose} style={{cursor:"pointer",opacity:0.45,fontSize:20,color:"#fff",lineHeight:1}}>×</span>
        </div>

        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {/* Crop area */}
          <div
            ref={containerRef}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}
            style={{width:"100%",aspectRatio:"16/9",overflow:"hidden",position:"relative",
              borderRadius:8,background:"#000",cursor:isDragging?"grabbing":"grab",userSelect:"none"}}>
            <img
              src={image} alt="" onLoad={onImgLoad} draggable={false}
              style={{position:"absolute",left:"50%",top:"50%",maxWidth:"none",pointerEvents:"none",userSelect:"none",
                transform:`translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${totalScale})`,
                transformOrigin:"center center"}}
            />
            <div style={{position:"absolute",inset:0,border:"2px solid rgba(176,48,216,0.4)",borderRadius:8,pointerEvents:"none"}}/>
          </div>

          {/* Zoom */}
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#888",letterSpacing:"0.06em",minWidth:36,textTransform:"uppercase"}}>Zoom</span>
            <input type="range" min={1} max={3} step={0.02} value={zoom}
              onChange={e=>onZoom(+e.target.value)}
              style={{flex:1,accentColor:"#9333ea",cursor:"pointer"}}/>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#888",minWidth:36,textAlign:"right"}}>{Math.round(zoom*100)}%</span>
          </div>
          <div style={{fontFamily:"'Crimson Pro',serif",fontSize:13,color:"#666",textAlign:"center",fontStyle:"italic"}}>
            Arraste para reposicionar · Use o slider para ajustar o zoom
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <button onClick={()=>fileInputRef.current?.click()}
            style={{background:"none",border:"none",color:"#999",fontFamily:"Cinzel,serif",fontSize:11,cursor:"pointer",letterSpacing:"0.05em",padding:0,textDecoration:"underline",textUnderlineOffset:3}}>
            Escolher outra imagem
          </button>
          <button onClick={handleConfirm}
            style={{background:"#9333ea",border:"none",color:"#fff",fontFamily:"Cinzel,serif",fontSize:12,fontWeight:700,letterSpacing:"0.08em",padding:"10px 28px",borderRadius:8,cursor:"pointer"}}>
            Confirmar
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleNewFile}/>
      </div>
    </div>
  , document.body);
}


const fsSendMessage = async (campaignId, uid, userName, userPhoto, content, type, rollData) => {
  try {
    await addDoc(collection(db,"campaigns",campaignId,"messages"), {
      userId:uid, userName, userPhoto:userPhoto||null,
      content, type:type||"text", timestamp:serverTimestamp(),
      ...(rollData ? {rollData} : {}),
    });
  } catch(e) { console.error(e); }
};

const MSG_TTL_MS = 24 * 60 * 60 * 1000;
const getMsgCutoff = () => Timestamp.fromMillis(Date.now() - MSG_TTL_MS);

const fsCleanOldMessages = async (campaignId) => {
  try {
    const q = query(
      collection(db, "campaigns", campaignId, "messages"),
      where("timestamp", "<", getMsgCutoff())
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (e) { console.error(e); }
};

const fsSetTyping = async (campaignId, uid, userName, isTyping) => {
  try {
    await setDoc(doc(db,"campaigns",campaignId,"typing",uid), {
      userName, isTyping, updatedAt:serverTimestamp(),
    });
  } catch(_) {}
};

const fsShareSheet = async (campaignId, uid, userName, character, isLive) => {
  try {
    const ref = doc(collection(db,"campaigns",campaignId,"sharedSheets"));
    await setDoc(ref, {
      characterId: String(character.id || character.createdAt || Date.now()),
      ownerId:uid, ownerName:userName,
      characterName: character.form?.personagem || "Sem nome",
      characterData: character, isLive,
      sharedAt: serverTimestamp(),
      permissions: { canView:"members" },
    });
    return ref.id;
  } catch(e) { console.error(e); return null; }
};

/* ─── FONTS & GLOBAL CSS ─── */
const G = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;500;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{-webkit-text-size-adjust:100%}
    /* Fallback de boot (spec 0023). O registry (themes/index.js, via <ThemeStyles/>)
       vence por especificidade — :root[data-nexus-system] é (0,2,0) contra (0,1,0).
       Estes valores espelham a escala grafite do sistema padrão (op) para que o
       primeiro frame e a IntroScreen (que não monta este bloco) não pisquem escuro. */
    :root{
      --bg:#14141c;
      --surface:#1c1c26;
      --card:#24242f;
      --card2:#2c2c39;
      --border:rgba(201,168,76,0.18);
      --border2:rgba(201,168,76,0.34);
      --gold:#c9a84c;
      --gold2:#e8c96d;
      --gold3:#a07830;
      --gold-glow:rgba(201,168,76,0.22);
      --gold-dim:rgba(201,168,76,0.09);
      --text:#e8e4d9;
      --muted:#a89a7c;
      --muted2:#c8b48e;
      --danger:#8b2020;
      --purple:#8e6dbf;
      --purple2:#c8a8f0;
      --purple-glow:rgba(142,109,191,0.3);
      --purple-dim:rgba(142,109,191,0.12);
    }
    body{background:var(--bg);font-family:'Crimson Pro',serif;overflow-x:hidden}
    ::-webkit-scrollbar{width:3px}
    ::-webkit-scrollbar-thumb{background:var(--gold3);border-radius:2px}

    input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
    input[type=number]{-moz-appearance:textfield}
    @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(201,168,76,0.15)}50%{box-shadow:0 0 40px rgba(201,168,76,0.35)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    @keyframes flicker{0%,100%{opacity:1}92%{opacity:1}93%{opacity:0.7}94%{opacity:1}97%{opacity:.85}98%{opacity:1}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes borderGlow{0%,100%{border-color:rgba(201,168,76,0.2)}50%{border-color:rgba(201,168,76,0.6)}}
    @keyframes critAura{0%,100%{box-shadow:0 0 8px 3px rgba(255,215,0,0.9),0 0 22px 8px rgba(255,180,0,0.55),0 0 44px 16px rgba(201,168,76,0.25);color:#ffe86a}50%{box-shadow:0 0 16px 6px rgba(255,215,0,1),0 0 40px 14px rgba(255,180,0,0.8),0 0 70px 28px rgba(201,168,76,0.45);color:#fff5a0}}
    @keyframes critPopupGlow{0%,100%{box-shadow:0 0 0 1px rgba(255,200,0,0.6),0 6px 32px rgba(0,0,0,0.9),0 0 20px rgba(255,180,0,0.25)}50%{box-shadow:0 0 0 1px rgba(255,215,0,0.9),0 6px 32px rgba(0,0,0,0.9),0 0 40px rgba(255,180,0,0.55),0 0 80px rgba(201,168,76,0.2)}}
    @keyframes statCardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes skeletonPulse{0%,100%{opacity:0.35}50%{opacity:0.6}}
    @keyframes live-dot{0%,49%{opacity:1;text-shadow:0 0 6px #4ade80}50%,100%{opacity:0;text-shadow:none}}
    @keyframes live-badge-glow{0%,100%{box-shadow:0 0 0 rgba(74,222,128,0)}50%{box-shadow:0 0 10px rgba(74,222,128,0.5),0 0 20px rgba(74,222,128,0.15)}}
    .logo-float{animation:float 4s ease-in-out infinite}
    .stat-card{cursor:pointer;transition:transform 0.2s ease,box-shadow 0.2s ease,border-color 0.2s ease}
    .stat-card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,0.4);border-color:rgba(255,255,255,0.22)!important}
    .stat-card:hover span[aria-hidden]{opacity:0.9}
    .stat-card:active{transform:translateY(0)}
    .stat-card:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
    .skeleton{background:linear-gradient(90deg,rgba(255,255,255,0.05) 25%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.05) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:4px}
    [role="button"]:focus-visible{outline:2px solid rgba(201,168,76,0.8);outline-offset:3px;border-radius:10px}
    a:focus-visible{outline:2px solid rgba(201,168,76,0.8);outline-offset:2px;border-radius:3px}

    .fade{animation:fadeIn 0.5s ease forwards}
    /* Crossfade do wrapper de telas (spec 0017): SO opacity, sem transform. Um transform
       aqui (mesmo o translateY(0) final retido pelo fill-mode forwards) criaria containing
       block e prenderia descendentes position:fixed (ex.: MapEditor inset:0) dentro do
       wrapper, quebrando o modo tela-cheia. Por isso NAO reusa a classe .fade. */
    @keyframes fadeScreen{from{opacity:0}to{opacity:1}}
    .fade-screen{animation:fadeScreen 0.5s ease}

    .btn-gold{
      font-family:'Cinzel',serif;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;
      padding:12px 24px;border-radius:4px;cursor:pointer;transition:all 0.25s;
      background:linear-gradient(135deg,#c9a84c,#e8c96d,#a07830);
      border:none;color:#050505;font-weight:700;
      box-shadow:0 4px 20px rgba(201,168,76,0.3);
    }
    .btn-gold:hover{filter:brightness(1.15);transform:translateY(-1px);box-shadow:0 6px 30px rgba(201,168,76,0.5)}
    .btn-ghost{
      font-family:'Cinzel',serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;
      padding:11px 22px;border-radius:4px;cursor:pointer;transition:all 0.25s;
      background:transparent;border:1px solid var(--border2);color:var(--gold);
    }
    .btn-ghost:hover{background:var(--gold-dim);border-color:var(--gold)}
    .nav-item{
      font-family:'Cinzel',serif;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;
      padding:8px 14px;border-radius:3px;cursor:pointer;border:none;
      background:transparent;color:var(--muted2);transition:all 0.2s;display:flex;align-items:center;gap:7px;
    }
    .nav-item:hover{background:rgba(255,255,255,0.06);color:var(--text)}
    .nav-item.active{color:var(--purple2);background:var(--purple-dim)}
    input,textarea{
      font-family:'Crimson Pro',serif;font-size:16px;
      background:var(--card2);border:1px solid var(--border);border-radius:5px;
      color:var(--text);outline:none;transition:border-color 0.2s;
      padding:11px 14px;width:100%;
    }
    input:focus,textarea:focus{border-color:rgba(201,168,76,0.5)}
    input::placeholder{color:var(--muted)}

    /* ── MOBILE BOTTOM NAV ── */
    .sidebar-desktop{display:flex}
    .bottomnav{display:none}

    /* ── RESPONSIVE LAYOUTS ── */
    .sheet-grid{display:grid;grid-template-columns:300px 1fr 1fr;gap:14px;align-items:start}
    .dash-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .dash-sessions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .creator-attrs{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start}
    .creator-classes{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
    .system-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
    .topbar-sys{display:flex}
    .main-pad{padding:28px}
    .step-bar{display:flex}
    .step-bar-mobile{display:none}
    .char-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 16px}

    @media(max-width:768px){
      .sidebar-desktop{display:none !important}
      /* hero da campanha: no mobile os botões overlay viram só ícone */
      .camp-hero-btn-label{display:none}
      .bottomnav{
        display:flex;position:fixed;bottom:0;left:0;right:0;z-index:200;
        background:rgba(26,26,35,0.94);border-top:1px solid var(--border);
        backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
        padding:0 0 env(safe-area-inset-bottom,0);
        box-shadow:0 -4px 20px rgba(0,0,0,0.35);
      }
      .bottomnav button{
        flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:3px;padding:10px 2px 8px;background:none;border:none;cursor:pointer;
        font-family:'Cinzel',serif;font-size:10px;letter-spacing:0.4px;text-transform:uppercase;
        color:var(--muted);transition:all 0.2s;min-height:58px;-webkit-tap-highlight-color:transparent;
      }
      .bottomnav button svg{width:20px;height:20px;opacity:0.7;transition:opacity 0.2s}
      .bottomnav button.active{color:var(--gold)}
      .bottomnav button.active svg{opacity:1;filter:drop-shadow(0 0 5px var(--gold))}
      .bottomnav button:active{background:rgba(255,255,255,0.05)}
      .sheet-grid{grid-template-columns:1fr !important}
      .dash-stats{grid-template-columns:1fr}
      .dash-sessions{grid-template-columns:1fr}
      .creator-attrs{grid-template-columns:1fr}
      .creator-classes{grid-template-columns:1fr}
      .system-grid{grid-template-columns:1fr}
      .topbar-sys{display:none}
      .main-pad{padding:16px 12px;padding-bottom:80px}
      .step-bar{display:none}
      .step-bar-mobile{display:flex;overflow-x:auto;gap:0;padding:0 16px;scrollbar-width:none}
      .step-bar-mobile::-webkit-scrollbar{display:none}
      .char-meta{grid-template-columns:repeat(2,1fr)}
      .btn-gold{padding:10px 18px;font-size:0.75rem;letter-spacing:0.08em}
      .btn-ghost{padding:10px 16px}
      .login-card{padding:28px 20px !important;max-width:100% !important}
      main{padding-bottom:calc(72px + env(safe-area-inset-bottom,0)) !important}
      .nexus-footer{display:none}
    }

    @media(max-width:480px){
      .dash-stats{grid-template-columns:1fr}
      .char-meta{grid-template-columns:1fr 1fr}
    }

    /* ── DOSSIER CARD (dashboard OP) ── */
    .op-dossier-card{ -webkit-tap-highlight-color:transparent; }
    @media(max-width:500px){
      .op-dossier-card{ flex-wrap:wrap; padding:10px 12px; gap:10px; }
      .op-dossier-vitals{ min-width:0 !important; width:100%; flex-direction:row !important; align-items:center; gap:12px !important; }
      .op-dossier-vitals>:last-child{ margin-left:auto; }
    }

    /* ── DESKTOP LOGIN LAYOUT ── */
    .login-layout{display:flex;min-height:100vh}
    .login-left{display:none;flex-direction:column;justify-content:center;width:56%;padding:40px 64px;position:relative;overflow-y:auto;border-right:1px solid var(--border)}
    .login-right{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 20px;position:sticky;top:0;height:100vh;overflow-y:auto}

    @media(min-width:1024px){
      .login-left{display:flex}
      .login-right{padding:60px 48px}
      .login-card{max-width:400px !important;width:100% !important}
      .login-logo-mobile{display:none !important}
      .login-quote-mobile{display:none !important}
    }

    /* ── LOGIN MOBILE (<1024px): rola sem cortar ──
       O container antigo (height:100vh + overflow-y:auto + align-items:center) cortava o
       TOPO do card quando ele passava da altura da tela (bug clássico de flex-center com
       overflow). Aqui o container cresce (min-height:100dvh, sem altura fixa) e o card
       centraliza por margin:auto — que, ao contrário de align-items:center, mantém o topo
       rolável quando o conteúdo é mais alto que a viewport. 100dvh evita a barra de URL. */
    @media(max-width:1023px){
      .login-layout{display:block;min-height:100dvh}
      .login-right{
        position:relative !important; height:auto !important; min-height:100dvh;
        overflow:hidden !important; align-items:flex-start;
        padding:calc(20px + env(safe-area-inset-top,0)) 16px calc(24px + env(safe-area-inset-bottom,0)) !important;
      }
      .login-card{margin:auto !important; animation:none !important}
    }

    /* ══ SPEC 0017 — MOTION LANGUAGE + AMBIENT (Higgsfield assets) ══ */
    /* Ambient video/poster backdrop (login + seleção) */
    .nx-ambient{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
    .nx-ambient video,.nx-ambient img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.45}
    .nx-ambient::after{content:"";position:absolute;inset:0;
      background:radial-gradient(ellipse at 50% 25%,transparent 0%,var(--bg) 88%),
                 linear-gradient(to bottom,rgba(0,0,0,0.55),transparent 35%,var(--bg))}
    /* Staggered entrance — parent sets --i on children via inline style */
    @keyframes nx-stagger-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    .nx-stagger>*{opacity:0;animation:nx-stagger-in 0.5s cubic-bezier(0.16,1,0.3,1) both;
      animation-delay:calc(var(--i,0)*70ms)}
    /* Diagonal shimmer sweep (botão / selo) via pseudo-element */
    @keyframes nx-shimmer{0%{transform:translateX(-130%) skewX(-18deg)}60%,100%{transform:translateX(240%) skewX(-18deg)}}
    .nx-shimmer{position:relative;overflow:hidden}
    .nx-shimmer::after{content:"";position:absolute;top:0;left:0;height:100%;width:38%;
      background:linear-gradient(100deg,transparent,rgba(255,255,255,0.35),transparent);
      transform:translateX(-130%) skewX(-18deg);animation:nx-shimmer 4.5s ease-in-out infinite;pointer-events:none}
    /* Per-system idle video inside the selection card icon, revealed on hover */
    .card-idle-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
      opacity:0;transition:opacity 0.35s ease}
    .sys-card:hover .card-idle-vid,.sys-card:focus-visible .card-idle-vid{opacity:1}
    /* Carrossel: dot ativo preenche com o tempo (7s = intervalo do quote) */
    @keyframes nx-dot-fill{from{width:0}to{width:100%}}
    .nx-progress-dot{position:relative;overflow:hidden}
    .nx-progress-dot::after{content:"";position:absolute;left:0;top:0;bottom:0;width:0;
      background:linear-gradient(90deg,var(--gold3),var(--gold2));border-radius:3px;
      animation:nx-dot-fill 7s linear forwards}
    /* Login field — gold underline that DRAWS in on focus (AC-2); focus is essential so it stays under reduced-motion, just snaps */
    .nx-field{position:relative}
    .nx-field::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;border-radius:2px;
      background:linear-gradient(90deg,var(--gold3),var(--gold2),var(--gold3));
      transform:scaleX(0);transform-origin:center;pointer-events:none;
      transition:transform 0.35s cubic-bezier(0.16,1,0.3,1)}
    .nx-field:focus-within::after{transform:scaleX(1)}
    /* Login sigil ring — draws itself once, then breathes; ticks rotate slowly (AC-2) */
    @keyframes nx-sigil-draw{from{stroke-dashoffset:290}to{stroke-dashoffset:0}}
    @keyframes nx-sigil-breathe{0%,100%{opacity:0.5}50%{opacity:0.92}}
    @keyframes nx-sigil-spin{to{transform:rotate(360deg)}}
    .nx-sigil-ring{stroke-dasharray:290;stroke-dashoffset:0;
      animation:nx-sigil-draw 1.5s cubic-bezier(0.16,1,0.3,1) both,nx-sigil-breathe 5s ease-in-out 1.6s infinite}
    .nx-sigil-ticks{transform-origin:50% 50%;animation:nx-sigil-spin 44s linear infinite}

    /* AC-5 — respeitar prefers-reduced-motion: corta movimento ambiente/loops/stagger */
    @media(prefers-reduced-motion:reduce){
      *,*::before,*::after{animation-duration:0.001ms !important;animation-iteration-count:1 !important;
        transition-duration:0.001ms !important;scroll-behavior:auto !important}
      .nx-ambient video{display:none}
      .nx-shimmer::after{display:none}
      .nx-stagger>*{opacity:1 !important;transform:none !important}
      .card-idle-vid{display:none}
    }
  `}</style>
);

/* Estilos base de TODA tela (spec 0023 AC-2): o bloco global + as CSS vars do
   sistema ativo. Antes o <ThemeStyles/> só era montado no shell logado, então
   login/seleção/criadores rodavam numa escala de luminância diferente do resto
   do app. Fica em escopo de módulo de propósito — declarar dentro de App()
   criaria um tipo de componente novo a cada render e remontaria as <style>. */
const Shell = () => (<><G/><ThemeStyles/></>);

/* Reactive prefers-reduced-motion hook (spec 0017 AC-5). Guards JS-driven
   effects (video autoplay, tilt) that CSS @media alone can't stop. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on));
  }, []);
  return reduced;
}

/* Ambient fog backdrop (Higgsfield item 1+6). Static poster under reduced
   motion / slow connections; looping video otherwise. */
function AmbientBackdrop() {
  const reduced = useReducedMotion();
  return (
    <div className="nx-ambient" aria-hidden="true">
      {reduced ? (
        <img src="/assets/higgsfield/video/fog-poster.jpg" alt="" />
      ) : (
        <video
          autoPlay muted loop playsInline
          poster="/assets/higgsfield/video/fog-poster.jpg"
        >
          <source src="/assets/higgsfield/video/fog-loop.webm" type="video/webm" />
          <source src="/assets/higgsfield/video/fog-loop.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}

/* ─── LOGO IMAGE — NEXUS N ─── */
const NexusLogo = ({ size = 40, animate = false }) => (
  <img
    src="/Logo Nexus.jpg"
    alt="Nexus RPG"
    width={size}
    height={size}
    className={animate ? "logo-float" : ""}
    style={{ display:"block", objectFit:"contain" }}
  />
);

/* Arcane rune ring around the login logo — draws itself, then breathes (spec 0017 AC-2).
   Net-new decorative element; reduced-motion is handled by the global @media (ring settles
   static, no spin/breathe). Purely visual: aria-hidden + pointer-events none. */
const NexusSigilRing = ({ size = 160, children }) => {
  const box = Math.round(size * 1.36);
  return (
    <div style={{ position:"relative", width:size, height:size, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
      <svg width={box} height={box} viewBox="0 0 100 100" aria-hidden="true"
        style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", pointerEvents:"none", overflow:"visible" }}>
        <g className="nx-sigil-ticks">
          {Array.from({ length:24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2, r1 = 40.5, r2 = i % 2 ? 44 : 42.5;
            return <line key={i} x1={50 + r1 * Math.cos(a)} y1={50 + r1 * Math.sin(a)}
              x2={50 + r2 * Math.cos(a)} y2={50 + r2 * Math.sin(a)}
              stroke="rgba(201,168,76,0.4)" strokeWidth="0.5" strokeLinecap="round" />;
          })}
        </g>
        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(201,168,76,0.16)" strokeWidth="0.5" strokeDasharray="1.4 3" />
        <circle className="nx-sigil-ring" cx="50" cy="50" r="46" fill="none" stroke="rgba(201,168,76,0.55)" strokeWidth="0.7" />
      </svg>
      {children}
    </div>
  );
};

/* ─── DECORATIVE LINES ─── */
const Deco = () => (
  <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:"50%",width:1,height:"100%",background:"linear-gradient(to bottom,transparent,rgba(201,168,76,0.05),transparent)"}}/>
    <div style={{position:"absolute",top:"50%",left:0,width:"100%",height:1,background:"linear-gradient(to right,transparent,rgba(201,168,76,0.04),transparent)"}}/>
    {/* Corner ornaments */}
    {[["top:0,left:0","0,0,20,0 0,0 0,20"],["top:0,right:0","100,0 80,0 100,0 100,20"],["bottom:0,left:0","0,100 20,100 0,100 0,80"],["bottom:0,right:0","100,100 80,100 100,100 100,80"]].map(([pos],i)=>(
      <div key={i} style={{position:"absolute",...Object.fromEntries(pos.split(",").map(p=>p.split(":"))),width:40,height:40}}>
        <svg width="40" height="40" viewBox="0 0 40 40"><polyline points={["0,0 20,0 0,0 0,20","40,0 20,0 40,0 40,20","0,40 20,40 0,40 0,20","40,40 20,40 40,40 40,20"][i]} fill="none" stroke="rgba(201,168,76,0.2)" strokeWidth="1"/></svg>
      </div>
    ))}
  </div>
);

/* ═══════════════════════════════
   LOGIN PAGE
═══════════════════════════════ */
const NEXUS_QUOTES = [
  { text: "O Outro Lado sempre existiu. Agora você tem as ferramentas para enfrentá-lo.", author: "Nexus · Protocolo de Iniciação" },
  { text: "Cada ficha é um agente. Cada agente carrega o peso do que não pode ser esquecido.", author: "Nexus · Arquivo 001" },
  { text: "A névoa não some — você apenas aprende a caminhar através dela.", author: "Nexus · Manual do Mestre" },
  { text: "Nenhuma sessão é igual. Nenhum horror se repete da mesma forma. Esteja preparado.", author: "Nexus · Diretriz de Campo" },
  { text: "O sistema não joga por você. Ele apenas garante que você não enfrente o escuro sozinho.", author: "Nexus · Fundação" },
  { text: "Conhecimento é a única proteção real. Documente tudo. Esqueça nada.", author: "Nexus · Protocolo Ordo" },
  { text: "Entre agentes, o silêncio é tão importante quanto a narração.", author: "Nexus · Código de Mesa" },
];

function NexusQuote() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * NEXUS_QUOTES.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % NEXUS_QUOTES.length);
        setVisible(true);
      }, 600);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const q = NEXUS_QUOTES[idx];

  return (
    <div style={{
      marginTop: 28,
      position: "relative",
    }}>
      {/* Divider ornament */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <div style={{ flex:1, height:"1px", background:"linear-gradient(to right, transparent, rgba(201,168,76,0.3))" }} />
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <div style={{ width:3, height:3, borderRadius:"50%", background:"var(--gold)", opacity:0.4 }} />
          <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--gold)", opacity:0.7 }} />
          <div style={{ width:3, height:3, borderRadius:"50%", background:"var(--gold)", opacity:0.4 }} />
        </div>
        <div style={{ flex:1, height:"1px", background:"linear-gradient(to left, transparent, rgba(201,168,76,0.3))" }} />
      </div>

      {/* Quote block */}
      <div style={{
        position:"relative",
        padding:"20px 24px",
        background:"linear-gradient(135deg, rgba(201,168,76,0.04), rgba(201,168,76,0.02))",
        border:"1px solid rgba(201,168,76,0.15)",
        borderLeft:"3px solid rgba(201,168,76,0.5)",
        borderRadius:"0 8px 8px 0",
        transition:"opacity 0.5s ease",
        opacity: visible ? 1 : 0,
        minHeight: 90,
      }}>
        {/* Quote icon */}
        <div style={{
          position:"absolute", top:-10, left:16,
          fontFamily:"'Cinzel Decorative',serif", fontSize:28,
          color:"var(--gold)", opacity:0.3, lineHeight:1,
          pointerEvents:"none", userSelect:"none",
        }}>"</div>

        <p style={{
          fontFamily:"Crimson Pro,serif", fontSize:15, fontStyle:"italic",
          color:"var(--text)", lineHeight:1.75, margin:"0 0 10px",
          paddingLeft:8,
        }}>{q.text}</p>

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:16, height:"1px", background:"rgba(201,168,76,0.4)" }} />
          <span style={{
            fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:2,
            color:"var(--gold)", textTransform:"uppercase", opacity:0.7,
          }}>{q.author}</span>
        </div>

        {/* Progress dots */}
        <div style={{ display:"flex", gap:5, justifyContent:"center", marginTop:14 }}>
          {NEXUS_QUOTES.map((_,i) => (
            <div key={i} className={i===idx ? "nx-progress-dot" : ""} onClick={() => { setVisible(false); setTimeout(()=>{ setIdx(i); setVisible(true); },300); }}
              style={{
                width: i===idx ? 16 : 5, height:5, borderRadius:3,
                background: i===idx ? "rgba(201,168,76,0.25)" : "rgba(201,168,76,0.2)",
                transition:"all 0.4s ease", cursor:"pointer",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(() => localStorage.getItem("nx_keep") !== "0");
  const [showPass, setShowPass] = useState(false);

  const applyPersistence = () => {
    const persistence = keepLoggedIn ? browserLocalPersistence : browserSessionPersistence;
    localStorage.setItem("nx_keep", keepLoggedIn ? "1" : "0");
    return setPersistence(auth, persistence);
  };

  const friendlyError = (code) => {
    if (["auth/invalid-credential","auth/wrong-password","auth/user-not-found","auth/invalid-login-credentials"].includes(code))
      return "E-mail ou senha incorretos.";
    if (code === "auth/email-already-in-use") return "Este e-mail já está em uso.";
    if (code === "auth/weak-password") return "Senha muito fraca (mínimo 6 caracteres).";
    if (code === "auth/invalid-email") return "E-mail inválido.";
    if (code === "auth/too-many-requests") return "Muitas tentativas. Tente novamente mais tarde.";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Login com Google cancelado.";
    if (code === "auth/network-request-failed") return "Erro de conexão. Verifique sua internet.";
    return "Ocorreu um erro. Tente novamente.";
  };

  const handle = async () => {
    setError("");
    if (!email || !pass) return;
    setLoading(true);
    try {
      await applyPersistence();
      if (tab === "login") {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        if (name) await updateProfile(cred.user, { displayName: name });
      }
      onLogin();
    } catch (e) {
      console.error("auth error:", e.code, e.message);
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await applyPersistence();
      await signInWithPopup(auth, googleProvider);
      onLogin();
    } catch (e) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError("Digite seu e-mail para recuperar a senha."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError("");
    } catch (e) {
      setError(friendlyError(e.code));
    }
  };

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)", position:"relative", overflow:"hidden"}}>
      <AmbientBackdrop />
      <Deco />

      <div className="login-layout">

        {/* ── LEFT PANEL (desktop only) ── */}
        <div className="login-left">
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 60% 50%,rgba(201,168,76,0.07) 0%,transparent 65%)",pointerEvents:"none"}}/>
          <div style={{position:"relative",zIndex:1}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
              <NexusSigilRing size={160}><NexusLogo size={160} /></NexusSigilRing>
            </div>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:38,fontWeight:700,
                background:"linear-gradient(135deg,#c9a84c,#e8c96d,#a07830)",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                backgroundClip:"text",letterSpacing:8,marginBottom:10}}>⚔ NEXUS</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:4,color:"var(--muted)",textTransform:"uppercase"}}>
                Sistemas de RPG · Inteligência Sobrenatural
              </div>
            </div>

            <div className="nx-stagger" style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {[
                {icon:"◈",title:"Fichas Digitais",desc:"Gerencie personagens com atributos, perícias e inventário completos"},
                {icon:"◉",title:"Ajudante do Mestre",desc:"Wiki do mundo, conexões, diário e ferramentas de mesa para suas campanhas"},
                {icon:"⬙",title:"Mapas Interativos",desc:"Crie e explore mapas colaborativos com sua mesa"},
                {icon:"♪",title:"Trilhas Sonoras",desc:"Atmosfera imersiva com músicas e ambientações para cada cena"},
              ].map(({icon,title,desc},i)=>(
                <div key={title} style={{display:"flex",gap:16,alignItems:"flex-start","--i":i}}>
                  <div style={{width:40,height:40,borderRadius:8,background:"rgba(201,168,76,0.08)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,color:"var(--gold)"}}>
                    {icon}
                  </div>
                  <div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"var(--gold2)",letterSpacing:1,marginBottom:4}}>{title}</div>
                    <div style={{fontFamily:"Crimson Pro,serif",fontSize:14,color:"var(--muted2)",lineHeight:1.55}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <NexusQuote />
          </div>
        </div>

        {/* ── RIGHT PANEL (form) ── */}
        <div className="login-right">
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
            width:600,height:600,borderRadius:"50%",
            background:"radial-gradient(circle,rgba(201,168,76,0.04) 0%,transparent 70%)",
            pointerEvents:"none"}}/>

          <div className="fade login-card" style={{
            width:"100%", maxWidth:440,
            background:"var(--card)", border:"1px solid var(--border2)",
            borderRadius:12, padding:"44px 48px", position:"relative", zIndex:1,
            boxShadow:"0 0 60px rgba(201,168,76,0.08), 0 40px 80px rgba(0,0,0,0.55)",
            animation:"borderGlow 4s ease-in-out infinite",
          }}>
            {/* Logo block — hidden on desktop */}
            <div className="login-logo-mobile" style={{textAlign:"center", marginBottom:32}}>
              <div style={{display:"flex", justifyContent:"center", marginBottom:14, animation:"float 4s ease-in-out infinite"}}>
                <NexusSigilRing size={72}><NexusLogo size={72} /></NexusSigilRing>
              </div>
              <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:26, fontWeight:700,
                background:"linear-gradient(135deg,#c9a84c,#e8c96d,#a07830)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                backgroundClip:"text", letterSpacing:4, marginBottom:4}}>⚔ NEXUS</div>
              <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:4, color:"var(--muted)", textTransform:"uppercase"}}>
                Sistemas de RPG · Inteligência Sobrenatural
              </div>
            </div>

            {/* Tabs */}
            <div style={{display:"flex", borderBottom:"1px solid var(--border)", marginBottom:28}}>
              {["login","register"].map(t => (
                <button key={t} onClick={()=>setTab(t)} style={{
                  flex:1, padding:"10px 0", background:"none", border:"none", cursor:"pointer",
                  fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:2, textTransform:"uppercase",
                  color: tab===t?"var(--gold)":"var(--muted)",
                  borderBottom: tab===t?"2px solid var(--gold)":"2px solid transparent",
                  transition:"all 0.2s", marginBottom:-1,
                }}>{t==="login"?"Entrar":"Criar Conta"}</button>
              ))}
            </div>

            <div style={{display:"flex", flexDirection:"column", gap:14}}>
              {tab==="register" && (
                <div>
                  <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--muted2)", textTransform:"uppercase", marginBottom:7}}>Nome de Agente</div>
                  <div className="nx-field"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome ou codinome" /></div>
                </div>
              )}
              <div>
                <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--muted2)", textTransform:"uppercase", marginBottom:7}}>E-mail</div>
                <div className="nx-field"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="agente@ordo.com" onKeyDown={e=>e.key==="Enter"&&handle()} /></div>
              </div>
              <div>
                <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--muted2)", textTransform:"uppercase", marginBottom:7}}>Senha</div>
                <div className="nx-field" style={{position:"relative"}}>
                  <input type={showPass?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handle()} style={{paddingRight:42,width:"100%"}} />
                  <button type="button" onClick={()=>setShowPass(v=>!v)} aria-label={showPass?"Ocultar senha":"Mostrar senha"} style={{
                    position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                    background:"none", border:"none", cursor:"pointer", padding:4,
                    color:"var(--muted)", display:"flex", alignItems:"center", lineHeight:1,
                  }}>
                    {showPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {tab==="login" && (
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <label htmlFor="keep-logged-in" style={{display:"flex", alignItems:"center", gap:7, cursor:"pointer", userSelect:"none"}}>
                    <input type="checkbox" id="keep-logged-in" checked={keepLoggedIn} onChange={e=>setKeepLoggedIn(e.target.checked)}
                      style={{position:"absolute", opacity:0, width:0, height:0}} />
                    <div style={{
                      width:16, height:16, borderRadius:3, border:"1.5px solid",
                      borderColor: keepLoggedIn ? "var(--gold)" : "var(--border2)",
                      background: keepLoggedIn ? "rgba(201,168,76,0.15)" : "transparent",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      flexShrink:0, transition:"all 0.15s",
                    }}>
                      {keepLoggedIn && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 3.5L4 6.5L9 1" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:1, color: keepLoggedIn ? "var(--gold2)" : "var(--muted2)"}}>Manter conectado</span>
                  </label>
                  <span onClick={handleReset} style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1, color:"var(--muted)", cursor:"pointer", textDecoration:"underline"}}>Esqueci minha senha</span>
                </div>
              )}
              {resetSent && <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#7aad6e",textAlign:"center"}}>E-mail de recuperação enviado!</div>}
              {error && <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#c96a6a",textAlign:"center"}}>{error}</div>}
              <button className="btn-gold nx-shimmer" onClick={handle} disabled={loading} style={{marginTop:8, width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8}}>
                {loading ? (
                  <div style={{width:16,height:16,border:"2px solid rgba(0,0,0,0.3)",borderTopColor:"#050505",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                ) : (tab==="login"?"Acessar o Nexus":"Registrar Agente")}
              </button>
              <div style={{display:"flex", gap:10, alignItems:"center", margin:"4px 0"}}>
                <div style={{flex:1, height:1, background:"var(--border)"}}/><span style={{fontFamily:"Cinzel,serif", fontSize:9, color:"var(--muted)"}}>ou</span><div style={{flex:1, height:1, background:"var(--border)"}}/>
              </div>
              <button className="btn-ghost" onClick={handleGoogle} disabled={loading} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continuar com Google
              </button>
              {tab==="login" && (
                <p style={{textAlign:"center",fontFamily:"Cinzel,serif",fontSize:10,color:"var(--muted)",marginTop:4}}>
                  Não tem conta?{" "}
                  <span onClick={()=>setTab("register")} style={{color:"var(--gold)",cursor:"pointer",textDecoration:"underline"}}>
                    Crie uma agora
                  </span>
                </p>
              )}
            </div>

            {/* Quote — hidden on desktop */}
            <div className="login-quote-mobile">
              <NexusQuote />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════════
   SIDEBAR
═══════════════════════════════ */
const NavIco = ({ d, extra, size=18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p,i)=><path key={i} d={p}/>) : <path d={d}/>}
    {extra}
  </svg>
);

/* Rune icon helper — thin occult SVG at 18×18 */
const RuneIco = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const navItems = [
  { id:"dashboard", label:"Painel",
    svg: (
      <RuneIco>
        {/* Olho da Ordem — all-seeing eye */}
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
        <circle cx="12" cy="12" r="3"/>
        <line x1="12" y1="2" x2="12" y2="5"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
      </RuneIco>
    )},
  { id:"sheet", label:"Fichas",
    svg: (
      <RuneIco>
        {/* Códex arcano — twin-tome with glyphs */}
        <path d="M2 4a2 2 0 0 1 2-2h6v20H4a2 2 0 0 1-2-2V4z"/>
        <path d="M22 4a2 2 0 0 0-2-2h-6v20h6a2 2 0 0 0 2-2V4z"/>
        <line x1="10" y1="2" x2="10" y2="22"/>
        <path d="M5.5 9l2 2-2 2"/>
        <line x1="14" y1="9" x2="18" y2="9"/>
        <line x1="14" y1="14" x2="18" y2="14"/>
      </RuneIco>
    )},
  { id:"map", label:"Mapas",
    svg: (
      <RuneIco>
        {/* Compasso proibido — 8-pointed star in circle */}
        <circle cx="12" cy="12" r="9"/>
        <polygon points="12,5 13.8,10.2 19,12 13.8,13.8 12,19 10.2,13.8 5,12 10.2,10.2"/>
      </RuneIco>
    )},
  { id:"master", label:"Ajudante do Mestre",
    svg: (
      <RuneIco>
        {/* Varinha do Ritual — wand with arcane sparks */}
        <line x1="6" y1="20" x2="18" y2="8"/>
        <path d="M14 4l2 2-8 8-2-2z"/>
        <line x1="10" y1="2" x2="10" y2="5"/>
        <line x1="14" y1="1" x2="16" y2="3"/>
        <line x1="2" y1="10" x2="5" y2="10"/>
        <line x1="1" y1="14" x2="3" y2="16"/>
        <circle cx="5.5" cy="18.5" r="2"/>
      </RuneIco>
    )},
  { id:"music", label:"Trilhas",
    svg: (
      <RuneIco>
        {/* Vórtice Sonoro — spiral frequency rune */}
        <path d="M12 21c4.97 0 9-4.03 9-9S16.97 3 12 3 3 7.03 3 12"/>
        <path d="M12 17c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5"/>
        <circle cx="12" cy="12" r="2"/>
        <line x1="3" y1="12" x2="7" y2="15"/>
        <line x1="3" y1="12" x2="7" y2="9"/>
      </RuneIco>
    )},
  { id:"party", label:"Campanhas",
    svg: (
      <RuneIco>
        {/* Círculos do Coven — three interlocked rings */}
        <circle cx="9" cy="9" r="4.5"/>
        <circle cx="15" cy="9" r="4.5"/>
        <circle cx="12" cy="15.5" r="4.5"/>
      </RuneIco>
    )},
  { id:"roadmap", label:"Roadmap",
    svg: (
      <RuneIco>
        {/* Profecia — scroll with inner sigil */}
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6"/>
        <polygon points="12,10 14,13 12,16 10,13"/>
        <line x1="8" y1="13" x2="10" y2="13"/>
        <line x1="14" y1="13" x2="16" y2="13"/>
      </RuneIco>
    )},
  { id:"planos", label:"Planos",
    svg: (
      <RuneIco>
        {/* Grimório Selado — nested diamonds */}
        <polygon points="12,2 22,12 12,22 2,12"/>
        <polygon points="12,6 18,12 12,18 6,12"/>
        <circle cx="12" cy="12" r="1.8"/>
      </RuneIco>
    )},
];

// Largura da viewport reativa a resize/rotação (o app tinha leituras de window.innerWidth
// sem listener, que não refluíam ao girar o device). Base para layout mobile responsivo.
function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1024));
  useEffect(() => {
    let raf = 0;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setW(window.innerWidth)); };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize); };
  }, []);
  return w;
}
function useIsMobile(bp = 768) { return useViewportWidth() < bp; }

/* Abas do modal de Ajustes (spec 0022 AC-1). O sublinhado roxo virou um único
   elemento que corre entre as abas; as bordas transparentes ficam nos botões só
   para o box-model não mudar de altura. */
function SettingsTabs({ active, onPick, label }) {
  const { containerRef, setItemRef, pill } = useSlidingPill(active);
  return (
    <div ref={containerRef} style={{ display:"flex", gap:0, padding:"12px 24px 0", borderBottom:"1px solid var(--border)", marginTop:8, position:"relative" }}>
      <SlidingTabPill pill={pill} underline="#8b5cf6" />
      {["ficha","stream","idioma"].map(tabId => (
        <button key={tabId} ref={setItemRef(tabId)} onClick={()=>onPick(tabId)} style={{
          background:"none", border:"none", cursor:"pointer",
          fontFamily:"Cinzel,serif", fontSize:12, letterSpacing:1,
          color: active===tabId ? "#fff" : "#666",
          borderBottom:"2px solid transparent",
          padding:"0 4px 10px", marginRight:20, marginBottom:-1,
          transition:"color 0.2s", position:"relative", zIndex:1,
        }}>{label("settings.tabs."+tabId)}</button>
      ))}
    </div>
  );
}

function MobileBottomNav({ active, onNav }) {
  const { t } = useLocale();
  const items = navItems.slice(0, 6);
  // Shared-layout pill (paridade com o Sidebar desktop, spec 0017 AC-4): um único
  // realce desliza horizontalmente até o item ativo, em vez de cada botão acender/
  // apagar de golpe. O hook re-mede sozinho (ResizeObserver + fonts.ready); o
  // viewportW cobre browsers sem ResizeObserver ao girar o device.
  const viewportW = useViewportWidth();
  const { containerRef, setItemRef, pill } = useSlidingPill(active, String(viewportW));
  return (
    <div ref={containerRef} className="bottomnav" style={{ position: "fixed", isolation: "isolate" }}>
      <SlidingTabPill pill={pill} radius={12}
        background="rgba(201,168,76,0.12)"
        boxShadow="inset 0 0 0 1px rgba(201,168,76,0.3)" />
      {items.map(item => (
        <button key={item.id} ref={setItemRef(item.id)}
          className={active === item.id ? "active" : ""} onClick={() => onNav(item.id)}
          style={{ position: "relative", zIndex: 1 }}>
          <span style={{display:"flex",alignItems:"center",justifyContent:"center"}}>{item.svg}</span>
          <span>{t("nav."+item.id)}</span>
        </button>
      ))}
    </div>
  );
}

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
              <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:14, fontWeight:700,
                background:"linear-gradient(135deg,#c9a84c,#e8c96d)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
                letterSpacing:2}}>⚔ NEXUS</div>
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

      {/* Active system pill */}
      {system && !collapsed && (
        <div style={{
          margin:"12px 12px 4px",
          padding:"8px 12px",
          background:`${system.accent}12`,
          border:`1px solid ${system.accent}35`,
          borderRadius:6,
          display:"flex", alignItems:"center", gap:8,
        }}>
          <span style={{display:"flex",alignItems:"center",flexShrink:0}}>{system.svgIcon ? system.svgIcon(false) : system.icon}</span>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:"0.06em", color:system.accent, textTransform:"uppercase", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{system.name}</div>
          </div>
          <button onClick={onChangeSystem} title="Trocar sistema" style={{
            background:"none", border:"none", cursor:"pointer",
            color:"var(--muted)", fontSize:13, padding:"0 2px",
            transition:"color 0.2s",
          }} onMouseEnter={e=>e.target.style.color=system.accent}
             onMouseLeave={e=>e.target.style.color="var(--muted)"}>⇄</button>
        </div>
      )}
      {system && collapsed && (
        <div style={{display:"flex", justifyContent:"center", padding:"8px 0 4px"}} title={system.name}>
          <span style={{display:"flex",alignItems:"center"}}>
            {system.id==="op" ? <OPEnergyIcon size={22}/> : system.id==="dnd" ? <DnDDemonIcon size={22}/> : <span style={{fontSize:16}}>{system.icon}</span>}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav ref={navRef} style={{flex:1, padding:"8px 8px", display:"flex", flexDirection:"column", gap:1, position:"relative"}}>
        {/* Sliding active-indicator pill (AC-4) — glides behind the buttons */}
        <SlidingTabPill pill={pill} radius={8}
          background={system?.accent ? `${system.accent}18` : "var(--purple-dim)"}
          boxShadow={`inset 0 0 0 1px ${system?.accent ? system.accent + "40" : "var(--purple-glow)"}`} />
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
                color: isActive ? (system?.accent || "var(--purple2)") : "var(--muted2)",
                fontWeight: isActive ? 600 : 400,
                transition:"color 0.18s, font-weight 0.18s",
                boxShadow:"none",
              }}
              onMouseEnter={e=>{ if(!isActive){ e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.color="var(--text)"; }}}
              onMouseLeave={e=>{ if(!isActive){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="var(--muted2)"; }}}>
              <span style={{
                display:"flex", alignItems:"center", justifyContent:"center",
                minWidth:20, flexShrink:0,
                color: isActive ? (system?.accent || "var(--purple2)") : "var(--muted2)",
                filter: isActive ? `drop-shadow(0 0 5px ${system?.accent || "var(--purple-glow)"})` : "none",
                transition:"all 0.18s",
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

/* ═══════════════════════════════════════════════════════
   GRUPO — Campaign Management, Chat, Shared Sheets
═══════════════════════════════════════════════════════ */

function CreateCampaignModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [system, setSystem] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const coverInputRef = useRef(null);

  const handleCoverFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCoverLoading(true);
    try { setCoverPreview(await resizeCoverImage(file)); } catch(_) {}
    setCoverLoading(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("Digite o nome da campanha."); return; }
    setLoading(true); setError("");
    const ok = await onCreate({ name:name.trim(), description:desc.trim(), system:system.trim()||"Genérico", maxPlayers, coverImage });
    if (ok?.limitError) { setError(ok.limitError); setLoading(false); return; }
    if (!ok) setError("Erro ao criar campanha. Verifique sua conexão e as regras do Firestore.");
    setLoading(false);
  };

  return (
    <>
    {coverPreview && <CoverPreviewModal image={coverPreview} onConfirm={(img)=>{setCoverImage(img);setCoverPreview(null);}} onClose={()=>setCoverPreview(null)}/>}
    {createPortal(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"28px",width:"100%",maxWidth:440,display:"flex",flexDirection:"column",gap:20,boxShadow:"0 24px 64px rgba(0,0,0,0.48)"}}>
        <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:18,background:"linear-gradient(135deg,#b030d8,#c8a8f0)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
          Nova Campanha
        </div>
        {error && <div style={{padding:"10px 14px",background:"rgba(139,32,32,0.18)",border:"1px solid rgba(139,32,32,0.4)",borderRadius:6,fontFamily:"Cinzel,serif",fontSize:11,color:"#e07070",letterSpacing:1}}>{error}</div>}

        {/* Cover image picker */}
        <input ref={coverInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files?.[0]&&handleCoverFile(e.target.files[0])}/>
        <div
          onClick={()=>coverInputRef.current?.click()}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{e.preventDefault();e.dataTransfer.files?.[0]&&handleCoverFile(e.dataTransfer.files[0]);}}
          style={{position:"relative",width:"100%",height:140,borderRadius:10,overflow:"hidden",cursor:"pointer",border:`2px dashed ${coverImage?"transparent":"rgba(176,48,216,0.3)"}`,background:coverImage?"transparent":"rgba(176,48,216,0.04)",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6}}
          onMouseEnter={e=>{if(!coverImage)e.currentTarget.style.borderColor="rgba(176,48,216,0.6)";}}
          onMouseLeave={e=>{if(!coverImage)e.currentTarget.style.borderColor="rgba(176,48,216,0.3)";}}>
          {coverImage
            ? <>
                <img src={coverImage} alt="capa" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
                <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:0,transition:"opacity 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                  onMouseLeave={e=>e.currentTarget.style.opacity="0"}>
                  <span style={{color:"#fff",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1}}>Trocar imagem</span>
                  <button onClick={e=>{e.stopPropagation();setCoverImage(null);}} style={{background:"rgba(139,32,32,0.6)",border:"1px solid rgba(255,100,100,0.4)",borderRadius:4,color:"#ff9090",cursor:"pointer",fontSize:10,padding:"3px 8px",fontFamily:"Cinzel,serif",letterSpacing:0.5}}>Remover</button>
                </div>
              </>
            : coverLoading
              ? <div style={{width:22,height:22,border:"2px solid rgba(176,48,216,0.3)",borderTopColor:"#b030d8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
              : <>
                  <div style={{fontSize:28,opacity:0.4}}>🖼</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(176,48,216,0.7)",letterSpacing:1}}>Clique ou arraste uma imagem de capa</div>
                  <div style={{fontSize:11,color:"var(--muted)"}}>JPG, PNG, WEBP</div>
                </>
          }
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Nome da Campanha *</div>
            <input value={name} onChange={e=>setName(e.target.value)} maxLength={60} placeholder="Ex: Marcas Fragmentadas" autoFocus/>
          </div>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Descrição</div>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} maxLength={300} placeholder="Uma breve descrição da campanha..." rows={3}
              style={{resize:"vertical",fontFamily:"'Crimson Pro',serif",fontSize:15,background:"var(--card2)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text)",outline:"none",padding:"11px 14px",width:"100%",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Sistema</div>
              <input value={system} onChange={e=>setSystem(e.target.value)} placeholder="Ordem Paranormal..." maxLength={40}/>
            </div>
            <div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Máx. Jogadores</div>
              <input type="number" value={maxPlayers} onChange={e=>setMaxPlayers(Math.max(2,Math.min(20,+e.target.value||6)))} min={2} max={20}/>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} className="btn-ghost" style={{flex:1,padding:"10px 0"}}>Cancelar</button>
          <button onClick={handleCreate} disabled={loading||!name.trim()} className="btn-gold" style={{flex:1,padding:"10px 0",opacity:loading||!name.trim()?0.5:1}}>
            {loading?"Criando...":"Criar Campanha"}
          </button>
        </div>
      </div>
    </div>
  , document.body)}
  </>
  );
}

function JoinCampaignModal({ onClose, onJoin }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (code.trim().length < 6) { setError("Código deve ter 6 caracteres."); return; }
    setLoading(true); setError("");
    const result = await onJoin(code.trim());
    setLoading(false);
    if (result?.error) setError(result.error);
  };

  return createPortal(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:"28px",width:"100%",maxWidth:360,display:"flex",flexDirection:"column",gap:20,boxShadow:"0 24px 64px rgba(0,0,0,0.48)"}}>
        <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:18,background:"linear-gradient(135deg,#b030d8,#c8a8f0)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
          Entrar em Campanha
        </div>
        <div style={{fontFamily:"'Crimson Pro',serif",fontSize:15,color:"var(--muted2)",lineHeight:1.65}}>
          Insira o código de convite de 6 caracteres fornecido pelo Mestre.
        </div>
        {error && <div style={{padding:"10px 14px",background:"rgba(139,32,32,0.18)",border:"1px solid rgba(139,32,32,0.4)",borderRadius:6,fontFamily:"Cinzel,serif",fontSize:11,color:"#e07070",letterSpacing:1}}>{error}</div>}
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Código de Convite</div>
          <input
            value={code}
            onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6))}
            placeholder="EX: AB12CD"
            style={{textAlign:"center",fontSize:22,letterSpacing:8,fontFamily:"Cinzel,serif"}}
            autoFocus
            onKeyDown={e=>{if(e.key==="Enter"&&code.length===6)handleJoin();}}
          />
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} className="btn-ghost" style={{flex:1,padding:"10px 0"}}>Cancelar</button>
          <button onClick={handleJoin} disabled={loading||code.length<6} className="btn-gold" style={{flex:1,padding:"10px 0",opacity:loading||code.length<6?0.5:1}}>
            {loading?"Entrando...":"Entrar"}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}

function CampaignCard({ campaign, uid, onClick }) {
  const isMaster = campaign.masterId === uid;
  const memberCount = campaign.members?.length || 0;
  const hasCover = !!campaign.coverImage;

  if (hasCover) {
    return (
      <div onClick={onClick} style={{
        borderRadius:10,cursor:"pointer",transition:"all 0.2s",
        position:"relative",overflow:"hidden",
        border:"1px solid var(--border)",
        boxShadow:"0 4px 16px rgba(0,0,0,0.35)",
      }}
        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.55)";e.currentTarget.style.borderColor="rgba(176,48,216,0.45)";}}
        onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.35)";e.currentTarget.style.borderColor="var(--border)";}}>
        {/* Cover image */}
        <div style={{width:"100%",height:160,position:"relative",overflow:"hidden"}}>
          <img src={campaign.coverImage} alt={campaign.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%)"}}/>
          {/* Badges over image */}
          <div style={{position:"absolute",top:8,left:8,display:"flex",gap:6}}>
            <span style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:0.5,color:"rgba(255,255,255,0.85)",background:"rgba(0,0,0,0.55)",padding:"3px 8px",borderRadius:4}}>
              ◎ {memberCount}/{campaign.maxPlayers||6}
            </span>
          </div>
          {isMaster && (
            <div style={{position:"absolute",top:8,right:8,padding:"3px 8px",borderRadius:4,background:"rgba(176,48,216,0.7)",border:"1px solid rgba(176,48,216,0.5)",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#e8d0ff",textTransform:"uppercase"}}>
              Mestre
            </div>
          )}
          {/* Title over image */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"10px 14px 12px"}}>
            <div style={{fontFamily:"Cinzel,serif",fontSize:14,fontWeight:700,color:"#fff",lineHeight:1.3,textShadow:"0 1px 4px rgba(0,0,0,0.55)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {campaign.name}
            </div>
            {campaign.system && (
              <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,color:"rgba(255,220,100,0.9)",textTransform:"uppercase",marginTop:3}}>
                {campaign.system}
              </div>
            )}
          </div>
        </div>
        {/* Bottom info strip */}
        {(campaign.description || !campaign.isActive) && (
          <div style={{padding:"10px 14px",background:"var(--card)"}}>
            {campaign.description && (
              <div style={{fontFamily:"'Crimson Pro',serif",fontSize:13,color:"var(--muted2)",lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                {campaign.description}
              </div>
            )}
            {!campaign.isActive && (
              <span style={{padding:"2px 7px",borderRadius:3,background:"rgba(255,255,255,0.05)",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase",marginTop:6,display:"inline-block"}}>
                Arquivada
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div onClick={onClick} style={{
      background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,
      padding:"18px 18px 16px",cursor:"pointer",transition:"all 0.2s",
      position:"relative",overflow:"hidden",
    }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(176,48,216,0.45)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(176,48,216,0.14)";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,rgba(176,48,216,0.55),transparent)"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:10}}>
        <div style={{fontFamily:"Cinzel,serif",fontSize:15,fontWeight:700,color:"var(--text)",flex:1,lineHeight:1.3}}>
          {campaign.name}
        </div>
        {isMaster && (
          <div style={{padding:"3px 8px",borderRadius:4,background:"rgba(176,48,216,0.15)",border:"1px solid rgba(176,48,216,0.3)",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#c8a8f0",textTransform:"uppercase",flexShrink:0}}>
            Mestre
          </div>
        )}
      </div>
      {campaign.description && (
        <div style={{fontFamily:"'Crimson Pro',serif",fontSize:14,color:"var(--muted2)",marginBottom:12,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
          {campaign.description}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {campaign.system && (
          <span style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,color:"var(--gold)",textTransform:"uppercase"}}>{campaign.system}</span>
        )}
        <span style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,color:"var(--muted)"}}>◎ {memberCount}/{campaign.maxPlayers||6}</span>
        {!campaign.isActive && (
          <span style={{padding:"2px 7px",borderRadius:3,background:"rgba(255,255,255,0.05)",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase"}}>
            Arquivada
          </span>
        )}
      </div>
    </div>
  );
}

function CampaignList({ uid, userName, campaigns, loading, onOpenCampaign, onCreateCampaign, onJoinCampaign }) {
  const active = campaigns.filter(c=>c.isActive);
  const archived = campaigns.filter(c=>!c.isActive);
  const masterActive = active.filter(c=>c.masterId===uid);

  if (loading) return (
    <div className="fade" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:320}}>
      <div style={{width:32,height:32,border:"2px solid rgba(176,48,216,0.3)",borderTopColor:"#b030d8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    </div>
  );

  return (
    <div className="fade" style={{display:"flex",flexDirection:"column",gap:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:"0.08em",color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Modo Multijogador</div>
          <h1 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:22,fontWeight:700,display:"flex",alignItems:"baseline",gap:8}}>
            <span style={{background:"linear-gradient(135deg,#b030d8,#c8a8f0)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Campanhas:</span>
            <span style={{fontFamily:"'Cinzel Decorative',serif",fontSize:22,fontWeight:700,color:"#fff",WebkitTextFillColor:"#fff"}}>
              {masterActive.length}/3
            </span>
          </h1>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onJoinCampaign} className="btn-ghost" style={{padding:"9px 18px",fontSize:10}}>◎ Entrar com Código</button>
          <button onClick={onCreateCampaign} className="btn-gold" style={{padding:"9px 18px",fontSize:11}}>+ Nova Campanha</button>
        </div>
      </div>

      {active.length===0&&archived.length===0 && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:320,gap:20,textAlign:"center",
          background:"radial-gradient(ellipse at center,rgba(176,48,216,0.07) 0%,var(--card) 70%)",
          border:"1px dashed rgba(176,48,216,0.22)",borderRadius:12,padding:"40px 20px"}}>
          <div style={{fontSize:56,animation:"float 4s ease-in-out infinite",opacity:0.55}}>◎</div>
          <div>
            <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:18,color:"var(--text)",marginBottom:10}}>Nenhuma Campanha</div>
            <div style={{fontFamily:"'Crimson Pro',serif",fontSize:16,color:"var(--muted2)",maxWidth:340,lineHeight:1.7,fontStyle:"italic"}}>
              Crie uma campanha para ser o Mestre ou entre em uma com o código de convite.
            </div>
          </div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
            <button onClick={onCreateCampaign} className="btn-gold">+ Criar Campanha</button>
            <button onClick={onJoinCampaign} className="btn-ghost">◎ Entrar com Código</button>
          </div>
        </div>
      )}

      {active.length>0 && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase",paddingBottom:6,borderBottom:"1px solid var(--border)"}}>
            Campanhas Ativas — {active.length}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:14}}>
            {active.map(camp=>(
              <CampaignCard key={camp.id} campaign={camp} uid={uid} onClick={()=>onOpenCampaign(camp)}/>
            ))}
          </div>
        </div>
      )}

      {archived.length>0 && (
        <div style={{display:"flex",flexDirection:"column",gap:12,opacity:0.55}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase",paddingBottom:6,borderBottom:"1px solid var(--border)"}}>
            Arquivadas — {archived.length}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:14}}>
            {archived.map(camp=>(
              <CampaignCard key={camp.id} campaign={camp} uid={uid} onClick={()=>onOpenCampaign(camp)}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatMessage({ msg, uid, formatTime }) {
  const isOwn = msg.userId === uid;
  const isSystem = msg.type === "system";
  const isRoll = msg.type === "roll";

  if (isSystem) return (
    <div style={{textAlign:"center",padding:"10px 0",margin:"2px 0"}}>
      <span style={{
        fontFamily:"'Crimson Pro',serif",fontSize:14,
        color:"rgba(210,190,230,0.75)",fontStyle:"italic",
        padding:"5px 18px",
        background:"rgba(176,48,216,0.08)",
        borderRadius:20,border:"1px solid rgba(176,48,216,0.16)"
      }}>
        {msg.content}
      </span>
    </div>
  );

  return (
    <div style={{display:"flex",gap:10,alignItems:"flex-start",padding:"2px 6px",flexDirection:isOwn?"row-reverse":"row"}}>
      <div style={{
        width:36,height:36,borderRadius:"50%",flexShrink:0,
        background: isOwn
          ? "linear-gradient(135deg,rgba(176,48,216,0.55),rgba(110,30,180,0.45))"
          : "linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.07))",
        border: isOwn
          ? "1.5px solid rgba(200,110,255,0.55)"
          : "1.5px solid rgba(255,255,255,0.18)",
        display:msg.grouped?"block":"flex",alignItems:"center",justifyContent:"center",
        fontFamily:"Cinzel,serif",fontSize:14,fontWeight:600,color:"#e8d4ff",
        overflow:"hidden",opacity:msg.grouped?0:1,pointerEvents:"none",
      }}>
        {!msg.grouped && (msg.userPhoto
          ? <img src={msg.userPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          : <span>{msg.userName?.charAt(0)?.toUpperCase()||"?"}</span>)}
      </div>
      <div style={{maxWidth:"74%",display:"flex",flexDirection:"column",gap:3,alignItems:isOwn?"flex-end":"flex-start"}}>
        {!msg.grouped && (
          <div style={{display:"flex",gap:8,alignItems:"baseline",padding:"0 5px",flexDirection:isOwn?"row-reverse":"row"}}>
            {!isOwn && (
              <span style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:0.5,color:"#c4a8e0",fontWeight:600}}>
                {msg.userName}
              </span>
            )}
            <span style={{fontFamily:"'Crimson Pro',serif",fontSize:11,color:"rgba(200,180,220,0.42)"}}>
              {formatTime(msg.timestamp)}
            </span>
          </div>
        )}
        <div style={{
          padding:isRoll?"11px 15px":"9px 14px",
          borderRadius:isOwn?"14px 3px 14px 14px":"3px 14px 14px 14px",
          background: isRoll
            ? "rgba(110,50,190,0.28)"
            : isOwn
              ? "rgba(148,52,210,0.40)"
              : "rgba(255,255,255,0.10)",
          border: isRoll
            ? "1px solid rgba(176,48,216,0.50)"
            : isOwn
              ? "1px solid rgba(190,100,255,0.42)"
              : "1px solid rgba(255,255,255,0.14)",
          fontFamily:isRoll?"Cinzel,serif":"'Crimson Pro',serif",
          fontSize:isRoll?13:17,
          color:isOwn?"#f0e0ff":"#ede5f8",
          lineHeight:1.6,wordBreak:"break-word",
          boxShadow: isOwn
            ? "0 2px 8px rgba(120,40,200,0.22)"
            : "0 1px 4px rgba(0,0,0,0.18)",
        }}>
          {isRoll ? (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <span style={{fontSize:9,letterSpacing:1.5,opacity:0.65,textTransform:"uppercase",color:"#c8a8f0"}}>🎲 Rolagem</span>
              <span style={{fontSize:16,color:"#ecdcff"}}>{msg.content.replace(/\*\*/g,"")}</span>
              {msg.rollData && (
                <span style={{fontSize:12,opacity:0.65,fontFamily:"'Crimson Pro',serif",color:"#bca8dc"}}>
                  [{msg.rollData.rolls?.join(", ")}]{msg.rollData.mod!==0?` ${msg.rollData.mod>0?"+":""}${msg.rollData.mod}`:""}
                </span>
              )}
            </div>
          ) : msg.content}
        </div>
      </div>
    </div>
  );
}

function CampaignChat({ campaignId, uid, userName, userPhoto, isMaster }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [clearing, setClearing] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const LIMIT = 50;

  const clearAllMessages = async () => {
    if (!window.confirm("Apagar todas as mensagens do chat? Esta ação não pode ser desfeita.")) return;
    setClearing(true);
    try {
      const snap = await getDocs(collection(db, "campaigns", campaignId, "messages"));
      const b = writeBatch(db);
      snap.docs.forEach(d => b.delete(d.ref));
      await b.commit();
    } catch(e) { console.error(e); }
    setClearing(false);
  };

  useEffect(() => {
    setLoading(true);
    setChatError("");
    fsCleanOldMessages(campaignId);
    const q = query(
      collection(db,"campaigns",campaignId,"messages"),
      where("timestamp",">=",getMsgCutoff()),
      orderBy("timestamp","desc"),
      limit(LIMIT)
    );
    const unsub = onSnapshot(q, snap => {
      const cutoff = Date.now() - MSG_TTL_MS;
      const msgs = snap.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter(d => (d.timestamp?.toMillis?.() ?? Date.now()) >= cutoff)
        .reverse();
      setMessages(msgs);
      if (snap.docs.length>0) setLastDoc(snap.docs[snap.docs.length-1]);
      setHasMore(snap.docs.length===LIMIT);
      setLoading(false);
      setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:"smooth"}),60);
    }, err => {
      console.error("Chat messages error:", err);
      setLoading(false);
      setChatError("Não foi possível carregar o chat. Verifique as regras do Firestore (firebase deploy --only firestore:rules).");
    });
    return unsub;
  }, [campaignId]);

  useEffect(() => {
    const q = query(collection(db,"campaigns",campaignId,"typing"));
    const unsub = onSnapshot(q, snap => {
      const now = Date.now();
      setTypingUsers(snap.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter(u=>u.id!==uid&&u.isTyping&&(now-(u.updatedAt?.toMillis?.()??0))<5000));
    });
    return () => { unsub(); fsSetTyping(campaignId,uid,userName,false); };
  }, [campaignId,uid,userName]);

  const handleInput = (e) => {
    setInput(e.target.value);
    fsSetTyping(campaignId,uid,userName,true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(()=>fsSetTyping(campaignId,uid,userName,false),3000);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    clearTimeout(typingTimeoutRef.current);
    fsSetTyping(campaignId,uid,userName,false);
    if (text.startsWith("/roll ")||text.startsWith("/r ")||/^\/\d+d\d+([+-]\d+)?$/i.test(text)) {
      const expr = (text.startsWith("/roll ")||text.startsWith("/r "))
        ? text.replace(/^\/(roll|r)\s+/,"")
        : text.slice(1);
      const result = rollDice(expr);
      if (result) {
        await fsSendMessage(campaignId,uid,userName,userPhoto,
          `Rolou ${result.expr} → [${result.rolls.join(", ")}]${result.mod!==0?(result.mod>0?` + ${result.mod}`:` - ${Math.abs(result.mod)}`):"" } = ${result.total}`,
          "roll", result);
      } else {
        await fsSendMessage(campaignId,"system","Sistema",null,"Expressão inválida. Use: /1d20+5","system",null);
      }
      return;
    }
    await fsSendMessage(campaignId,uid,userName,userPhoto,text,"text",null);
  };

  const loadMore = async () => {
    if (!lastDoc||!hasMore) return;
    const q = query(collection(db,"campaigns",campaignId,"messages"),where("timestamp",">=",getMsgCutoff()),orderBy("timestamp","desc"),startAfter(lastDoc),limit(LIMIT));
    const snap = await getDocs(q);
    const older = snap.docs.map(d=>({id:d.id,...d.data()})).reverse();
    setMessages(prev=>[...older,...prev]);
    if (snap.docs.length>0) setLastDoc(snap.docs[snap.docs.length-1]);
    setHasMore(snap.docs.length===LIMIT);
  };

  const grouped = messages.map((msg,i)=>{
    const prev = messages[i-1];
    const isGrouped = prev&&prev.userId===msg.userId&&msg.type==="text"&&prev.type==="text"
      &&((msg.timestamp?.toMillis?.()??0)-(prev.timestamp?.toMillis?.()??0))<120000;
    return {...msg, grouped:isGrouped};
  });

  const formatTime = (ts) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,overflow:"hidden"}}>
      {hasMore && (
        <div style={{textAlign:"center",padding:"8px 0",flexShrink:0}}>
          <button onClick={loadMore} style={{
            background:"rgba(176,48,216,0.10)",border:"1px solid rgba(176,48,216,0.28)",
            borderRadius:20,cursor:"pointer",
            color:"#c8a8f0",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,
            textTransform:"uppercase",padding:"6px 18px",transition:"all 0.18s",
          }}>
            ↑ Carregar mensagens anteriores
          </button>
        </div>
      )}
      <div style={{
        flex:1,overflowY:"auto",padding:"14px 8px",
        display:"flex",flexDirection:"column",gap:4,minHeight:0,
        scrollbarWidth:"thin",scrollbarColor:"rgba(176,48,216,0.25) transparent",
      }}>
        {loading && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,gap:12,padding:"40px 0"}}>
            <div style={{width:28,height:28,border:"2.5px solid rgba(176,48,216,0.2)",borderTopColor:"#b030d8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
            <span style={{fontFamily:"'Crimson Pro',serif",fontSize:14,color:"rgba(200,175,225,0.5)",fontStyle:"italic"}}>Carregando mensagens…</span>
          </div>
        )}
        {chatError && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,gap:12,textAlign:"center",padding:"24px 16px"}}>
            <div style={{fontSize:30,opacity:0.6}}>⚠</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1,color:"#e07070",textTransform:"uppercase"}}>Erro ao carregar chat</div>
            <div style={{fontFamily:"'Crimson Pro',serif",fontSize:15,color:"rgba(220,190,230,0.6)",fontStyle:"italic",maxWidth:380,lineHeight:1.65}}>{chatError}</div>
          </div>
        )}
        {!loading&&!chatError&&messages.length===0 && (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,gap:12,textAlign:"center",padding:"40px 16px"}}>
            <div style={{fontSize:36,opacity:0.35}}>💬</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1.5,color:"rgba(200,180,220,0.5)",textTransform:"uppercase"}}>Nenhuma mensagem ainda</div>
            <div style={{fontFamily:"'Crimson Pro',serif",fontSize:15,color:"rgba(200,175,215,0.4)",fontStyle:"italic",lineHeight:1.55}}>
              Use <span style={{fontFamily:"Cinzel,serif",fontSize:13,color:"rgba(200,140,255,0.65)"}}>/ r 1d20+5</span> para rolar dados no chat
            </div>
          </div>
        )}
        {grouped.map(msg=>(
          <ChatMessage key={msg.id} msg={msg} uid={uid} formatTime={formatTime}/>
        ))}
        {typingUsers.length>0 && (
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"6px 12px"}}>
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{
                  width:6,height:6,borderRadius:"50%",
                  background:"rgba(176,48,216,0.55)",
                  animation:`pulse 1.2s ${i*0.2}s infinite`
                }}/>
              ))}
            </div>
            <span style={{fontFamily:"'Crimson Pro',serif",fontSize:14,color:"rgba(200,175,220,0.55)",fontStyle:"italic"}}>
              {typingUsers.map(u=>u.userName).join(", ")} está digitando...
            </span>
          </div>
        )}
        <div ref={messagesEndRef}/>
      </div>
      <div style={{
        padding:"12px 8px 10px",
        borderTop:"1px solid rgba(176,48,216,0.18)",
        display:"flex",flexDirection:"column",gap:8,flexShrink:0,
        background:"rgba(0,0,0,0.18)",
      }}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{flex:1,position:"relative"}}>
            <input
              value={input}
              onChange={handleInput}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
              placeholder="Mensagem… ou /r 1d20+5 para dados"
              style={{
                paddingRight:46,paddingLeft:14,height:42,
                background:"rgba(255,255,255,0.07)",
                border:"1px solid rgba(176,48,216,0.30)",
                borderRadius:10,
                color:"#ede5f8",
                fontFamily:"'Crimson Pro',serif",
                fontSize:16,
                outline:"none",
                width:"100%",
                boxSizing:"border-box",
                transition:"border-color 0.2s",
              }}
            />
            <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:14,opacity:0.4,pointerEvents:"none"}}>🎲</span>
          </div>
          <button onClick={sendMessage} disabled={!input.trim()} style={{
            width:42,height:42,borderRadius:10,flexShrink:0,
            background:input.trim()?"rgba(150,50,220,0.45)":"rgba(255,255,255,0.05)",
            border:input.trim()?"1px solid rgba(190,90,255,0.5)":"1px solid rgba(255,255,255,0.1)",
            cursor:input.trim()?"pointer":"default",
            display:"flex",alignItems:"center",justifyContent:"center",
            color:input.trim()?"#e8d0ff":"rgba(200,175,220,0.3)",
            fontSize:16,transition:"all 0.2s",
            boxShadow:input.trim()?"0 2px 10px rgba(140,40,220,0.3)":"none",
          }}>➤</button>
        </div>
        {/* ação destrutiva rebaixada a link discreto (só aparece quando há o que apagar) —
            a barra vermelha full-width gritava mais que o próprio input de mensagem */}
        {isMaster && messages.length>0 && (
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <button onClick={clearAllMessages} disabled={clearing}
              style={{
                background:"transparent",border:"none",padding:"2px 4px",
                color:"rgba(230,110,110,0.55)",
                fontFamily:"Cinzel,serif",fontSize:8.5,letterSpacing:"0.1em",textTransform:"uppercase",
                cursor:clearing?"default":"pointer",transition:"color 0.2s",
              }}
              onMouseEnter={e=>{if(!clearing)e.currentTarget.style.color="rgba(230,110,110,0.95)";}}
              onMouseLeave={e=>{e.currentTarget.style.color="rgba(230,110,110,0.55)";}}>
              {clearing ? "Limpando…" : "🗑 Apagar histórico"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SharedSheetCard({ sheet, uid, isMaster, onView, onRemove }) {
  const canRemove = uid===sheet.ownerId||isMaster;
  const char = sheet.characterData;
  const cs = char?.attrs
    ? nexStats(char.nex ?? 5, char.classe?.id, char.attrs)
    : { pv: 0, san: 0 };
  const pvVal  = char?.pv  ?? cs.pv;
  const sanVal = char?.san ?? cs.san;
  return (
    <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:"16px",display:"flex",flexDirection:"column",gap:12,position:"relative",overflow:"hidden"}}>
      {sheet.isLive && (
        <div style={{position:"absolute",top:10,right:10,padding:"2px 7px",borderRadius:3,background:"rgba(106,170,122,0.14)",border:"1px solid rgba(106,170,122,0.3)",fontFamily:"Cinzel,serif",fontSize:7,letterSpacing:1,color:"#6aaa7a",textTransform:"uppercase",display:"flex",alignItems:"center",gap:4}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"#6aaa7a",animation:"pulse 2s infinite"}}/>Ao Vivo
        </div>
      )}
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <div style={{width:48,height:48,borderRadius:8,background:"rgba(176,48,216,0.1)",border:"1px solid rgba(176,48,216,0.22)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,fontSize:22}}>
          {getActiveAvatar(char)?<img src={getActiveAvatar(char)} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🕵️"}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:14,color:"var(--text)",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sheet.characterName}</div>
          <div style={{fontFamily:"'Crimson Pro',serif",fontSize:13,color:"var(--muted2)"}}>{char?.classe?.name||"—"}</div>
        </div>
      </div>
      {char && (
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[
            {label:"PV",  val: String(pvVal),          color:"#e07070"},
            {label:"SAN", val: String(sanVal),          color:"#70a0e0"},
            {label:"NEX", val: `${char.nex ?? 5}%`,    color:"var(--gold)"},
          ].map(s=>(
            <div key={s.label} style={{padding:"3px 8px",borderRadius:4,background:"rgba(255,255,255,0.04)",border:"1px solid var(--border)"}}>
              <span style={{fontFamily:"Cinzel,serif",fontSize:8,color:s.color,letterSpacing:1}}>{s.label} </span>
              <span style={{fontFamily:"Cinzel,serif",fontSize:11,color:"var(--text)"}}>{s.val}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"flex",gap:8}}>
        <button onClick={onView} className="btn-ghost" style={{flex:1,padding:"7px 0",fontSize:9}}>Ver Ficha</button>
        {canRemove && (
          <button onClick={onRemove} style={{padding:"7px 12px",borderRadius:4,background:"rgba(139,32,32,0.1)",border:"1px solid rgba(139,32,32,0.28)",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,color:"#e07070",textTransform:"uppercase",transition:"all 0.2s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(139,32,32,0.24)"}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(139,32,32,0.1)"}}>
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

function SharedSheetsPanel({ campaignId, uid, userName, isMaster, characters }) {
  const [sharedSheets, setSharedSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [viewSheet, setViewSheet] = useState(null);
  const sharedSheetsRef = useRef([]);

  const SHEET_LIMIT = 15;

  useEffect(()=>{
    const q = query(collection(db,"campaigns",campaignId,"sharedSheets"));
    const unsub = onSnapshot(q,snap=>{
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      setSharedSheets(docs);
      sharedSheetsRef.current = docs;
      setLoading(false);
    });
    return unsub;
  },[campaignId]);

  // Sync "Ao Vivo" sheets: whenever characters change or panel finishes loading,
  // push latest character data to Firestore so other members see live updates.
  useEffect(()=>{
    if (loading || !characters?.length) return;
    const myLiveSheets = sharedSheetsRef.current.filter(s => s.ownerId === uid && s.isLive);
    if (!myLiveSheets.length) return;
    myLiveSheets.forEach(sheet => {
      const char = characters.find(c => String(c.id || c.createdAt) === sheet.characterId);
      if (!char) return;
      updateDoc(doc(db,"campaigns",campaignId,"sharedSheets",sheet.id), {
        characterData: char,
        characterName: char.form?.personagem || "Sem nome",
      }).catch(console.error);
    });
  },[characters, loading]);

  const handleShare = async (character, isLive) => {
    if (sharedSheets.length >= SHEET_LIMIT) return;
    const sheetId = await fsShareSheet(campaignId,uid,userName,character,isLive);
    if (sheetId) {
      await fsSendMessage(campaignId,"system","Sistema",null,
        `${userName} compartilhou a ficha de ${character.form?.personagem||"um personagem"}.`,
        "system",null);
    }
    setSharing(false);
  };

  const handleRemove = async (sheetId) => {
    try { await deleteDoc(doc(db,"campaigns",campaignId,"sharedSheets",sheetId)); } catch(e){console.error(e);}
  };

  // Visibility: hide private sheets from non-owner non-master members
  const visibleSheets = sharedSheets.filter(s =>
    s.ownerId === uid || isMaster || !s.characterData?.isPrivate
  );

  // Edit permission for a given sheet
  const canEditSheet = (sheet) => {
    if (sheet.ownerId === uid) return true;
    if (isMaster && sheet.characterData?.allowMasterEdit !== false) return true;
    if (sheet.characterData?.allowAnyEdit === true) return true;
    return false;
  };

  // Save edits made by master/member to the sharedSheets document
  const handleSheetUpdate = async (sheet, updated) => {
    try {
      await updateDoc(doc(db,"campaigns",campaignId,"sharedSheets",sheet.id), {
        characterData: updated,
        characterName: updated.form?.personagem || sheet.characterName,
      });
    } catch(e) { console.error(e); }
  };

  const mySharedCharIds = sharedSheets.filter(s=>s.ownerId===uid).map(s=>s.characterId);
  const availableChars = characters.filter(c=>!mySharedCharIds.includes(String(c.id||c.createdAt)));
  const atLimit = sharedSheets.length >= SHEET_LIMIT;
  const btnDisabled = atLimit || availableChars.length === 0;
  const btnTitle = atLimit
    ? "Limite de 15 fichas atingido"
    : availableChars.length === 0
      ? characters.length === 0
        ? "Crie um personagem primeiro"
        : "Todas as suas fichas já estão compartilhadas"
      : "";

  return (
    <div style={{overflowY:"auto",padding:"16px 4px",display:"flex",flexDirection:"column",gap:16}}>
      {/* Header row: counter + share button */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase"}}>
            Fichas Compartilhadas
          </div>
          <div style={{
            padding:"2px 9px",borderRadius:20,
            background: atLimit ? "rgba(224,112,112,0.12)" : "rgba(176,48,216,0.1)",
            border: `1px solid ${atLimit ? "rgba(224,112,112,0.3)" : "rgba(176,48,216,0.25)"}`,
            fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,
            color: atLimit ? "#e07070" : "var(--purple2)",
          }}>
            {sharedSheets.length}/{SHEET_LIMIT}
          </div>
          {atLimit && (
            <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#e07070",textTransform:"uppercase"}}>
              Limite atingido
            </div>
          )}
        </div>
        {!sharing && (
          <button
            onClick={()=>{ if(!btnDisabled) setSharing(true); }}
            disabled={btnDisabled}
            title={btnTitle}
            className="btn-gold"
            style={{
              padding:"8px 18px",fontSize:10,
              opacity: btnDisabled ? 0.42 : 1,
              cursor: btnDisabled ? "not-allowed" : "pointer",
            }}>
            + Compartilhar Ficha
          </button>
        )}
      </div>

      {/* No characters hint */}
      {!sharing && characters.length === 0 && (
        <div style={{padding:"10px 14px",background:"rgba(176,48,216,0.06)",border:"1px solid rgba(176,48,216,0.18)",borderRadius:8,fontFamily:"'Crimson Pro',serif",fontSize:13,color:"var(--muted)",fontStyle:"italic",textAlign:"center"}}>
          Crie um personagem na aba <strong style={{fontStyle:"normal",color:"var(--purple2)"}}>Fichas</strong> para poder compartilhar nesta campanha.
        </div>
      )}

      {sharing && (
        <div style={{background:"var(--card)",border:"1px solid var(--border2)",borderRadius:10,padding:"16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase"}}>Escolha uma Ficha para Compartilhar</div>
          {availableChars.length === 0 ? (
            <div style={{fontFamily:"'Crimson Pro',serif",fontSize:14,color:"var(--muted)",fontStyle:"italic",textAlign:"center",padding:"16px 0"}}>
              Todas as suas fichas já estão compartilhadas nesta campanha.
            </div>
          ) : availableChars.map(c=>(
            <div key={c.id||c.createdAt} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"var(--card2)",borderRadius:6,border:"1px solid var(--border)",flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:6,background:"rgba(176,48,216,0.1)",border:"1px solid rgba(176,48,216,0.22)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",fontSize:18}}>
                  {getActiveAvatar(c)?<img src={getActiveAvatar(c)} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:"🕵️"}
                </div>
                <div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"var(--text)"}}>{c.form?.personagem||"Sem nome"}</div>
                  <div style={{fontFamily:"'Crimson Pro',serif",fontSize:12,color:"var(--muted)"}}>{c.classe?.name||"—"}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <button onClick={()=>handleShare(c,false)} className="btn-ghost" style={{padding:"6px 12px",fontSize:9}} title="Foto do estado atual — não atualiza automaticamente">Snapshot</button>
                <button onClick={()=>handleShare(c,true)} className="btn-gold" style={{padding:"6px 12px",fontSize:9}} title="Sempre reflete os dados atuais do personagem">● Ao Vivo</button>
              </div>
            </div>
          ))}
          <button onClick={()=>setSharing(false)} className="btn-ghost" style={{alignSelf:"flex-end",padding:"6px 14px",fontSize:9}}>Cancelar</button>
        </div>
      )}

      {loading && (
        <div style={{display:"flex",justifyContent:"center",padding:"40px 0"}}>
          <div style={{width:24,height:24,border:"2px solid rgba(176,48,216,0.3)",borderTopColor:"#b030d8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        </div>
      )}

      {!loading && sharedSheets.length===0 && !sharing && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:180,gap:10,opacity:0.45,textAlign:"center"}}>
          <div style={{fontSize:32}}>◈</div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase"}}>Nenhuma ficha compartilhada</div>
          <div style={{fontFamily:"'Crimson Pro',serif",fontSize:14,color:"var(--muted)",fontStyle:"italic"}}>
            Compartilhe uma ficha para que a campanha possa acompanhar seu personagem.
          </div>
        </div>
      )}

      {visibleSheets.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
          {visibleSheets.map(sheet=>(
            <SharedSheetCard key={sheet.id} sheet={sheet} uid={uid} isMaster={isMaster}
              onView={()=>setViewSheet(sheet)} onRemove={()=>handleRemove(sheet.id)}/>
          ))}
        </div>
      )}

      {viewSheet && createPortal(
        <div onClick={()=>setViewSheet(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9999,overflowY:"auto",padding:"20px"}}>
          <div onClick={e=>e.stopPropagation()} style={{maxWidth:960,margin:"0 auto",background:"var(--bg)",borderRadius:10,overflow:"hidden"}}>
            <FullSheet character={viewSheet.characterData} onBack={()=>setViewSheet(null)}
              onUpdate={canEditSheet(viewSheet) ? (updated)=>handleSheetUpdate(viewSheet,updated) : ()=>{}}
              onRoll={roll=>{ fsSendMessage(campaignId,uid,userName,null,
                `${roll.charName} rolou ${roll.expr||roll.attr} → [${roll.rolls.join(",")}] = ${roll.result}`,
                "roll",{expr:roll.expr||roll.attr,rolls:roll.rolls,total:roll.result,sides:parseInt((roll.dice||"D20").slice(1)),count:roll.rolls.length,crit:roll.crit});
              }}/>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

function MembersPanel({ campaign, uid, isMaster }) {
  const memberIds   = campaign.members||[];
  const memberNames = campaign.memberNames||{};
  const admins      = campaign.admins||[];
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard?.writeText(campaign.inviteCode).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };

  const toggleAdmin = async (memberId, isAdminNow) => {
    const op = isAdminNow ? arrayRemove(memberId) : arrayUnion(memberId);
    await updateDoc(doc(db,"campaigns",campaign.id),{ admins: op }).catch((e)=>console.error("[campanha] alternar admin falhou:", e));
  };

  return (
    <div style={{overflowY:"auto",padding:"16px 4px",display:"flex",flexDirection:"column",gap:12}}>
      {isMaster && (
        <div style={{padding:"14px 16px",background:"var(--card)",border:"1px solid rgba(176,48,216,0.3)",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:4}}>Código de Convite</div>
            <div style={{fontFamily:"Cinzel,serif",fontSize:24,letterSpacing:10,color:"#c8a8f0",userSelect:"all"}}>{campaign.inviteCode}</div>
          </div>
          <button onClick={copyCode} className="btn-ghost" style={{padding:"7px 16px",fontSize:9}}>
            {copied?"✓ Copiado":"Copiar Código"}
          </button>
        </div>
      )}
      <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase",paddingBottom:6,borderBottom:"1px solid var(--border)"}}>
        Membros — {memberIds.length}/{campaign.maxPlayers||6}
      </div>
      {memberIds.map(memberId=>{
        const isSelf        = memberId===uid;
        const isMasterMember= memberId===campaign.masterId;
        const isAdminMember = admins.includes(memberId);
        const name          = memberNames[memberId]||"Agente";
        return (
          <div key={memberId} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:"var(--card)",borderRadius:8,border:"1px solid var(--border)"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,rgba(176,48,216,0.28),rgba(176,48,216,0.08))",border:"1px solid rgba(176,48,216,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Cinzel,serif",fontSize:14,color:"#c8a8f0",flexShrink:0}}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {name}{isSelf&&" (você)"}
              </div>
              <div style={{display:"flex",gap:6,marginTop:2}}>
                {isMasterMember && <span style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#c8a8f0",textTransform:"uppercase"}}>◉ Mestre</span>}
                {isAdminMember && !isMasterMember && <span style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#c9a84c",textTransform:"uppercase"}}>★ Admin</span>}
              </div>
            </div>
            {/* Botão Admin — só mestre pode promover/rebaixar (nunca aplica no próprio mestre) */}
            {isMaster && !isMasterMember && (
              <button onClick={()=>toggleAdmin(memberId, isAdminMember)}
                style={{padding:"4px 8px",borderRadius:4,background: isAdminMember?"rgba(201,168,76,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${isAdminMember?"rgba(201,168,76,0.4)":"rgba(255,255,255,0.12)"}`,cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color: isAdminMember?"#c9a84c":"var(--muted)",textTransform:"uppercase",transition:"all 0.2s"}}
                title={isAdminMember?"Remover Admin":"Tornar Admin"}>
                {isAdminMember?"★ Admin":"☆ Admin"}
              </button>
            )}
            {/* Botão Remover — só mestre pode remover players (nunca o mestre) */}
            {isMaster && !isMasterMember && (
              <button onClick={async()=>{if(window.confirm(`Remover ${name} da campanha?`)){await updateDoc(doc(db,"campaigns",campaign.id),{members:arrayRemove(memberId),admins:arrayRemove(memberId)});}}}
                style={{padding:"5px 10px",borderRadius:4,background:"rgba(139,32,32,0.1)",border:"1px solid rgba(139,32,32,0.25)",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#e07070",textTransform:"uppercase",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(139,32,32,0.22)"}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(139,32,32,0.1)"}}>
                Remover
              </button>
            )}
            {/* Botão Sair — apenas para players não-mestre (o mestre NUNCA pode ser expulso, só sai) */}
            {isSelf && !isMasterMember && (
              <button onClick={async()=>{if(window.confirm("Sair desta campanha?")){await updateDoc(doc(db,"campaigns",campaign.id),{members:arrayRemove(uid),admins:arrayRemove(uid)});}}}
                style={{padding:"5px 10px",borderRadius:4,background:"rgba(139,32,32,0.1)",border:"1px solid rgba(139,32,32,0.25)",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#e07070",textTransform:"uppercase",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(139,32,32,0.22)"}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(139,32,32,0.1)"}}>
                Sair
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MasterSettings({ campaign, onBack, isMaster=true }) {
  const [name, setName] = useState(campaign.name);
  const [system, setSystem] = useState(campaign.system||"");
  const [desc, setDesc] = useState(campaign.description||"");
  const [maxPlayers, setMaxPlayers] = useState(campaign.maxPlayers||6);
  const [coverImage, setCoverImage] = useState(campaign.coverImage||null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const coverInputRef = useRef(null);

  const showMsg = (text) => { setMsg(text); setTimeout(()=>setMsg(""),2500); };

  const handleCoverFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCoverLoading(true);
    try { setCoverPreview(await resizeCoverImage(file)); } catch(_) {}
    setCoverLoading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try { await updateDoc(doc(db,"campaigns",campaign.id),{name:name.trim(),system:system.trim(),description:desc.trim(),maxPlayers,coverImage:coverImage||null}); showMsg("Salvo com sucesso!"); }
    catch(e) { showMsg("Erro ao salvar."); }
    setSaving(false);
  };

  const handleRegenCode = async () => {
    if (!window.confirm("Regenerar o código invalida o código atual. Continuar?")) return;
    const code = generateInviteCode();
    try { await updateDoc(doc(db,"campaigns",campaign.id),{inviteCode:code}); showMsg(`Novo código: ${code}`); }
    catch(e) { showMsg("Erro."); }
  };

  const handleArchive = async () => {
    if (!window.confirm(campaign.isActive?"Arquivar a campanha?":"Reativar a campanha?")) return;
    try { await updateDoc(doc(db,"campaigns",campaign.id),{isActive:!campaign.isActive}); onBack(); }
    catch(e) { console.error("[campanha] falha ao arquivar:", e); showMsg("Erro ao arquivar a campanha. Tente de novo."); }
  };

  return (
    <>
    {coverPreview && <CoverPreviewModal image={coverPreview} onConfirm={(img)=>{setCoverImage(img);setCoverPreview(null);}} onClose={()=>setCoverPreview(null)}/>}
    <div style={{overflowY:"auto",padding:"16px 4px",display:"flex",flexDirection:"column",gap:20}}>
      <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase",paddingBottom:6,borderBottom:"1px solid var(--border)"}}>
        Configurações da Campanha
      </div>
      {msg && (
        <div style={{padding:"10px 14px",background:"rgba(106,170,122,0.14)",border:"1px solid rgba(106,170,122,0.3)",borderRadius:6,fontFamily:"Cinzel,serif",fontSize:11,color:"#6aaa7a",letterSpacing:1}}>
          {msg}
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Cover image */}
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Imagem de Capa</div>
          <input ref={coverInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files?.[0]&&handleCoverFile(e.target.files[0])}/>
          <div
            onClick={()=>coverInputRef.current?.click()}
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{e.preventDefault();e.dataTransfer.files?.[0]&&handleCoverFile(e.dataTransfer.files[0]);}}
            style={{position:"relative",width:"100%",height:120,borderRadius:8,overflow:"hidden",cursor:"pointer",border:`2px dashed ${coverImage?"transparent":"rgba(176,48,216,0.3)"}`,background:coverImage?"transparent":"rgba(176,48,216,0.04)",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:4}}>
            {coverImage
              ? <>
                  <img src={coverImage} alt="capa" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
                  <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:0,transition:"opacity 0.2s"}}
                    onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                    onMouseLeave={e=>e.currentTarget.style.opacity="0"}>
                    <span style={{color:"#fff",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1}}>Trocar</span>
                    <button onClick={e=>{e.stopPropagation();setCoverImage(null);}} style={{background:"rgba(139,32,32,0.6)",border:"1px solid rgba(255,100,100,0.4)",borderRadius:4,color:"#ff9090",cursor:"pointer",fontSize:9,padding:"2px 8px",fontFamily:"Cinzel,serif"}}>Remover</button>
                  </div>
                </>
              : coverLoading
                ? <div style={{width:20,height:20,border:"2px solid rgba(176,48,216,0.3)",borderTopColor:"#b030d8",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                : <>
                    <span style={{fontSize:24,opacity:0.4}}>🖼</span>
                    <span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(176,48,216,0.7)",letterSpacing:1}}>Clique ou arraste uma imagem</span>
                  </>
            }
          </div>
        </div>
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Nome</div>
          <input value={name} onChange={e=>setName(e.target.value)} maxLength={60}/>
        </div>
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Sistema</div>
          <input value={system} onChange={e=>setSystem(e.target.value)} maxLength={40} placeholder="ex: Ordem Paranormal, D&D 5e, Tormenta 20…"/>
        </div>
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Descrição</div>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} maxLength={300} rows={3}
            style={{resize:"vertical",fontFamily:"'Crimson Pro',serif",fontSize:15,background:"var(--card2)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text)",outline:"none",padding:"11px 14px",width:"100%",boxSizing:"border-box"}}/>
        </div>
        <div style={{width:100}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:6}}>Máx. Jogadores</div>
          <input type="number" value={maxPlayers} onChange={e=>setMaxPlayers(Math.max(2,Math.min(20,+e.target.value||6)))} min={2} max={20}/>
        </div>
      </div>
      <button onClick={handleSave} disabled={saving||!name.trim()} className="btn-gold" style={{alignSelf:"flex-start",padding:"9px 22px",opacity:saving||!name.trim()?0.5:1}}>
        {saving?"Salvando...":"Salvar Alterações"}
      </button>
      {/* Ações exclusivas do Mestre — admin não tem acesso */}
      {isMaster && (
        <div style={{display:"flex",flexDirection:"column",gap:12,paddingTop:16,borderTop:"1px solid var(--border)"}}>
          <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:"0.1em",color:"var(--muted)",textTransform:"uppercase"}}>
            Ações do Mestre
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button onClick={handleRegenCode} className="btn-ghost" style={{padding:"9px 18px",fontSize:9}}>
              🔄 Regenerar Código de Convite
            </button>
            <button onClick={handleArchive} style={{
              padding:"9px 18px",borderRadius:4,cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,textTransform:"uppercase",
              background:campaign.isActive?"rgba(139,32,32,0.1)":"rgba(106,170,122,0.1)",
              border:campaign.isActive?"1px solid rgba(139,32,32,0.3)":"1px solid rgba(106,170,122,0.3)",
              color:campaign.isActive?"#e07070":"#6aaa7a",transition:"all 0.2s",
            }}>
              {campaign.isActive?"📁 Arquivar Campanha":"📂 Reativar Campanha"}
            </button>
          </div>
        </div>
      )}
      {!isMaster && (
        <div style={{padding:"10px 14px",background:"rgba(201,168,76,0.07)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:6,fontFamily:"Cinzel,serif",fontSize:10,color:"#c9a84c",letterSpacing:1}}>
          ★ Você é Admin — pode editar nome, descrição e configurações. Apenas o Mestre pode arquivar ou regenerar o código.
        </div>
      )}
    </div>
    </>
  );
}

function SheetRollPanel({ campaigns, uid, userName, userPhoto, onRollReady }) {
  const active = campaigns.filter(c => c.isActive !== false);
  const [selId, setSelId] = useState(() => active[0]?.id ?? null);
  const campaign = active.find(c => c.id === selId) ?? active[0] ?? null;

  useEffect(() => { onRollReady?.(campaign ?? null); }, [campaign?.id]);

  return (
    <div style={{
      width:284, flexShrink:0,
      background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8,
      display:"flex", flexDirection:"column",
      height:"calc(100vh - 150px)", position:"sticky", top:0, overflow:"hidden",
    }}>
      <div style={{padding:"10px 14px 9px", borderBottom:"1px solid var(--border)", flexShrink:0}}>
        <div style={{fontFamily:"Cinzel,serif",fontSize:7,color:"var(--muted)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Campanha</div>
        {active.length > 1 ? (
          <select value={selId??""} onChange={e=>setSelId(e.target.value)}
            style={{background:"transparent",border:"none",color:"var(--text)",fontFamily:"Cinzel,serif",fontSize:11,outline:"none",width:"100%",cursor:"pointer",appearance:"none"}}>
            {active.map(c=><option key={c.id} value={c.id} style={{background:"#2c2c39"}}>{c.name}</option>)}
          </select>
        ) : (
          <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            {campaign?.name ?? "Nenhuma campanha ativa"}
          </div>
        )}
      </div>
      {campaign
        ? <RollFeed campaignId={campaign.id} uid={uid}/>
        : <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:20,textAlign:"center",fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(255,255,255,0.2)",lineHeight:1.6}}>
            Entre em uma campanha<br/>para ver o histórico de dados
          </div>}
    </div>
  );
}

function RollFeed({ campaignId, uid }) {
  const [rolls, setRolls] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(()=>{
    fsCleanOldMessages(campaignId);
    const q = query(
      collection(db,"campaigns",campaignId,"messages"),
      where("type","==","roll"),
      limit(80)
    );
    const unsub = onSnapshot(q, snap=>{
      const cutoff = Date.now() - MSG_TTL_MS;
      const data = snap.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter(d=>(d.timestamp?.seconds??0)*1000 > cutoff)
        .sort((a,b)=>(b.timestamp?.seconds??0)-(a.timestamp?.seconds??0));
      setRolls(data);
    }, ()=>{});
    return unsub;
  },[campaignId]);

  const shown = filter==="mine" ? rolls.filter(r=>r.userId===uid) : rolls;

  const fmtTime = (ts) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* filter bar */}
      <div style={{display:"flex",gap:8,padding:"12px 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
        {[["all","Todos"],["mine","Meus"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{
            padding:"5px 16px",borderRadius:6,border:"1px solid",cursor:"pointer",
            fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,transition:"all 0.18s",
            background:filter===v?"#7c3aed":"transparent",
            borderColor:filter===v?"#7c3aed":"rgba(255,255,255,0.12)",
            color:filter===v?"#fff":"rgba(255,255,255,0.5)",
          }}>{l}</button>
        ))}
        <span style={{marginLeft:"auto",fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(255,255,255,0.3)",alignSelf:"center",letterSpacing:1}}>
          {shown.length} rolagem{shown.length!==1?"s":""}
        </span>
      </div>
      {/* cards */}
      <div style={{flex:1,overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
        {shown.length===0 && (
          <div style={{textAlign:"center",color:"rgba(255,255,255,0.25)",fontFamily:"Cinzel,serif",fontSize:11,paddingTop:32}}>
            Nenhuma rolagem ainda.<br/>Use /2d6+3 no chat ou role pela ficha.
          </div>
        )}
        {shown.map(r=>{
          const rd = r.rollData || {};
          const rolls = rd.rolls || [];
          const expr  = rd.expr || r.content?.match(/rolou (.+?) →/i)?.[1] || "?";
          const total = rd.total ?? "?";
          const sides = rd.sides || 20;
          return (
            <div key={r.id} style={{border:"1px solid rgba(124,58,237,0.35)",borderRadius:8,padding:"11px 13px",background:"rgba(124,58,237,0.06)"}}>
              <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"rgba(255,255,255,0.85)",marginBottom:8,fontWeight:600}}>{r.userName}</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:38,height:38,background:"#7c3aed",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"#fff",fontWeight:600,marginBottom:2}}>Resultado</div>
                  {rolls.length>0 && <div style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>[{rolls.join(", ")}]</div>}
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{expr}</div>
                </div>
                <div style={{fontSize:26,fontWeight:700,color:"#fff",flexShrink:0}}>= {total}</div>
              </div>
              <div style={{textAlign:"right",fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:6,fontFamily:"Cinzel,serif"}}>{fmtTime(r.timestamp)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 *  CAMPAIGN ROLL DRAWER — histórico de rolagens em tempo real (drawer lateral)
 *  Lê campaigns/{id}/messages (type=="roll") via onSnapshot. Cada card usa o
 *  elemento do PERSONAGEM que rolou (rollData.elemento), não o ativo.
 * ════════════════════════════════════════════════════════════════════════ */
function fmtRollTime(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function RollDrawerCard({ r }) {
  const rd = r.rollData || {};
  const el = rd.elemento && ELEMENTOS[rd.elemento] ? ELEMENTOS[rd.elemento] : null;
  const color = el ? el.accent : "#c9a84c";
  const isAttack = rd.kind === "attack";
  return (
    <div className="op-rollcard">
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        {r.userPhoto
          ? <img src={r.userPhoto} alt="" style={{ width:24, height:24, borderRadius:"50%", objectFit:"cover", border:`1px solid ${color}` }} />
          : <span style={{ width:24, height:24, borderRadius:"50%", display:"inline-flex", alignItems:"center", justifyContent:"center", background:`${color}22`, border:`1px solid ${color}`, fontSize:11, color }}>{(rd.charName||r.userName||"?").slice(0,1).toUpperCase()}</span>}
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:13, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rd.charName || r.userName}</span>
      </div>
      <div style={{ border:`1px solid ${color}`, background:`${color}14`, borderRadius:6, padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          {el && <ElementoSymbol id={rd.elemento} size={16} />}
          <span style={{ fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:13, color, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{rd.name || rd.expr}</span>
          {rd.crit && <span style={{ marginLeft:"auto", fontSize:9, fontFamily:"'Share Tech Mono',monospace", color:"#ffe86a", letterSpacing:"0.1em", flexShrink:0 }}>CRÍTICO</span>}
        </div>
        {isAttack ? (
          <div style={{ display:"flex" }}>
            <div style={{ flex:1, textAlign:"center", borderRight:`1px solid ${color}40` }}>
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:34, color, lineHeight:1 }}>{rd.total}</div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:8, letterSpacing:"0.15em", textTransform:"uppercase", color:"var(--muted)", marginTop:3 }}>Ataque</div>
            </div>
            <div style={{ flex:1, textAlign:"center" }}>
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:34, color:"#fff", lineHeight:1 }}>{rd.dano ?? "—"}</div>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:8, letterSpacing:"0.15em", textTransform:"uppercase", color:"var(--muted)", marginTop:3 }}>Dano</div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:48, color, lineHeight:1 }}>{rd.total}</div>
          </div>
        )}
        {Array.isArray(rd.rolls) && rd.rolls.length > 0 && (
          <div style={{ marginTop:8, textAlign:"center", fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"var(--muted2)" }}>[{rd.rolls.join(" · ")}]</div>
        )}
      </div>
      <div style={{ textAlign:"right", marginTop:4, fontFamily:"var(--font-body,'Crimson Pro',serif)", fontStyle:"italic", fontSize:11, color:"var(--muted)" }}>{fmtRollTime(r.timestamp)}</div>
    </div>
  );
}

function CampaignRollDrawer({ campaign, onClose }) {
  const [rolls, setRolls] = useState([]);

  useEffect(() => {
    if (!campaign?.id) return;
    const q = query(collection(db,"campaigns",campaign.id,"messages"), where("type","==","roll"), limit(80));
    const unsub = onSnapshot(q, snap => {
      const cutoff = Date.now() - MSG_TTL_MS;
      const data = snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .filter(d => (d.timestamp?.seconds ?? 0) * 1000 > cutoff)
        .sort((a,b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0))
        .slice(0, 50);
      setRolls(data);
    }, () => {});
    return unsub;
  }, [campaign?.id]);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const drawerVars = { "--el-accent":"#c9a84c", "--el-border":"rgba(201,168,76,0.40)", "--el-glow":"rgba(201,168,76,0.45)" };

  return createPortal(
    <>
      <div className="op-drawer-overlay" onClick={onClose} />
      <div className="op-roll-drawer" style={drawerVars} role="dialog" aria-label="Histórico de rolagens da campanha">
        <div className="op-roll-drawer-head">
          <div style={{ minWidth:0 }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{campaign.name}</div>
            <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:17, color:"var(--gold2)" }}>Resultados <span style={{ color:"var(--muted)" }}>[{rolls.length}]</span></div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background:"none", border:"none", color:"var(--muted2)", fontSize:24, cursor:"pointer", lineHeight:1, flexShrink:0 }}>×</button>
        </div>
        <div className="op-roll-drawer-body">
          {rolls.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 14px", color:"rgba(232,228,217,0.4)", fontStyle:"italic", fontFamily:"var(--font-body,'Crimson Pro',serif)", fontSize:14, lineHeight:1.6 }}>
              Nenhuma rolagem registrada ainda.<br/>As rolagens da campanha aparecem aqui em tempo real.
            </div>
          ) : rolls.map(r => <RollDrawerCard key={r.id} r={r} />)}
        </div>
      </div>
    </>,
    document.body
  );
}

/* ── CAMPAIGN MAP TAB ── */
/* ── Mesa tática (spec 0007 / ADR 0005): o MapEditor é o mapa oficial da campanha.
   O tile-based foi aposentado; o doc legado map/current é ignorado. */
/* Tela de Mapas do menu lateral: escolhe entre a mesa tática e o construtor
   de tokens. Fora de campanha o construtor salva na biblioteca do usuário. */
/* As três superfícies do ateliê (spec 0028 · design §2 · AC-2). "Mesas
   Táticas" e "Tokens" são o que já existia, agora com endereço próprio;
   "Mapas-Múndi" é o componente IRMÃO — nada disso entra no MapEditor. */
const MAPAS_SUBABAS = [
  { id:'mesas',  rotulo:'Mesas Táticas' },
  { id:'mundi',  rotulo:'Mapas-Múndi'  },
  { id:'tokens', rotulo:'Tokens'       },
];

function MapaScreen({ uid, plan = 'free', onBack }) {
  const [aba, setAba] = useState('mesas');   // 'mesas' | 'mundi' | 'tokens'
  const [mesaAberta, setMesaAberta] = useState(false);
  const [flash, setFlash] = useState("");
  const pill = useSlidingPill(aba);

  const salvarToken = async ({ nome, dataUrl }) => {
    if (!uid) { setFlash('Faça login para salvar na biblioteca. Use "Baixar PNG" enquanto isso.'); return; }
    try {
      await saveAsset(db, uid, { type:'character', name:nome, tags:['construtor'], folder:null, data:dataUrl, w:512, h:512 });
      setFlash(`"${nome}" salvo — abra a mesa tática e use a Biblioteca de assets.`);
    } catch (e) {
      console.error('[construtor] salvar token falhou:', e);
      setFlash('Não foi possível salvar. Use "Baixar PNG" como alternativa.');
    }
  };

  /* O MapEditor monta em `position:fixed; inset:0` — é tela cheia por
     construção (F0 §6). O rail de sub-abas não o comporta: abrir a mesa
     continua sendo um early-return, exatamente como antes. */
  if (mesaAberta) return <MapEditor uid={uid} db={db} onBack={()=>setMesaAberta(false)} />;

  /* Teclado do rail: setas movem e ativam, Home/End vão às pontas. */
  const onRailKeyDown = (e) => {
    if (!["ArrowRight","ArrowLeft","Home","End"].includes(e.key)) return;
    const box = pill.containerRef.current;
    if (!box) return;
    const abas = Array.from(box.querySelectorAll('[role="tab"]'));
    if (!abas.length) return;
    const atual = abas.indexOf(document.activeElement);
    const base = atual === -1 ? abas.findIndex(el => el.getAttribute("aria-selected") === "true") : atual;
    let alvo = base;
    if (e.key === "ArrowRight") alvo = (base + 1) % abas.length;
    else if (e.key === "ArrowLeft") alvo = (base - 1 + abas.length) % abas.length;
    else if (e.key === "Home") alvo = 0;
    else alvo = abas.length - 1;
    e.preventDefault();
    const el = abas[alvo];
    el.focus();
    const id = el.getAttribute('data-aba');
    if (id) setAba(id);
  };

  const Card = ({ icone, titulo, texto, cor, onClick }) => (
    <button onClick={onClick} style={{
      flex:'1 1 260px', maxWidth:340, padding:'28px 24px', borderRadius:14, cursor:'pointer', textAlign:'left',
      background:`linear-gradient(160deg, ${cor}18, transparent)`, border:`1px solid ${cor}44`, transition:'all .18s',
    }}
      onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.borderColor=`${cor}99`; e.currentTarget.style.boxShadow=`0 8px 26px rgba(0,0,0,0.45)`; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.borderColor=`${cor}44`; e.currentTarget.style.boxShadow='none'; }}>
      <div style={{ fontSize:40, marginBottom:12 }}>{icone}</div>
      <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:18, color:cor, marginBottom:8 }}>{titulo}</div>
      <div style={{ fontFamily:"var(--font-body,'Crimson Pro',serif)", fontSize:15, color:'var(--muted2)', lineHeight:1.6 }}>{texto}</div>
    </button>
  );

  return (
    <div className="fade" style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div>
        <div style={{ fontFamily:'Cinzel,serif', fontSize:11, letterSpacing:'0.14em', color:'var(--muted)', textTransform:'uppercase', marginBottom:6 }}>Ateliê do Mestre</div>
        <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700,
          background:'linear-gradient(135deg,#c9a84c,#e8c96d)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Mapas</h1>
      </div>

      {/* ── Sub-abas (pill deslizante — o padrão da casa, spec 0017 AC-4) ── */}
      <div ref={pill.containerRef} role="tablist" aria-label="Seções de Mapas" onKeyDown={onRailKeyDown}
        style={{ display:'flex', gap:2, borderBottom:'1px solid var(--border)', position:'relative',
          overflowX:'auto', scrollbarWidth:'none', WebkitOverflowScrolling:'touch', flexShrink:0 }}>
        <SlidingTabPill pill={pill.pill} radius={8} background="var(--gold-dim)" underline="var(--gold)"/>
        {MAPAS_SUBABAS.map(t => {
          const on = aba === t.id;
          return (
            <button key={t.id} type="button" role="tab" data-aba={t.id}
              id={`mapas-aba-${t.id}`} aria-selected={on} aria-controls="mapas-painel"
              tabIndex={on ? 0 : -1}
              ref={pill.setItemRef(t.id)} onClick={()=>setAba(t.id)}
              style={{
                position:'relative', zIndex:1, flexShrink:0, minHeight:44, padding:'0 16px',
                border:'none', background:'transparent', cursor:'pointer',
                fontFamily:'Cinzel,serif', fontSize:11.5, letterSpacing:'0.08em', textTransform:'uppercase',
                fontWeight: on ? 600 : 400,
                color: on ? 'var(--gold2, #e8c96d)' : 'rgba(255,255,255,0.46)',
                transition:'color 0.2s',
              }}
              onMouseEnter={e=>{ if(!on) e.currentTarget.style.color='rgba(255,255,255,0.78)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.color = on ? 'var(--gold2, #e8c96d)' : 'rgba(255,255,255,0.46)'; }}>
              {t.rotulo}
            </button>
          );
        })}
      </div>

      {/* ── Painel ── */}
      <div id="mapas-painel" role="tabpanel" aria-labelledby={`mapas-aba-${aba}`}
        style={ aba === 'tokens'
          ? { display:'flex', flexDirection:'column', height:'calc(100vh - 260px)', minHeight:460, gap:12 }
          : { display:'flex', flexDirection:'column', gap:16 } }>

        {aba === 'mesas' && (
          <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
            <Card icone="🗺️" titulo="Mesa Tática" cor="#b030d8" onClick={()=>setMesaAberta(true)}
              texto="Monte o mapa com imagens, tokens, camadas de névoa e grade — tudo sincronizado com a mesa." />
          </div>
        )}

        {aba === 'mundi' && <WorldMapAtelier uid={uid} plan={plan} />}

        {aba === 'tokens' && (
          <>
            <div style={{ flexShrink:0 }}>
              <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:18, color:'#e0c8ff' }}>Construtor de Tokens</div>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1.4, textTransform:'uppercase', color:'var(--muted)' }}>
                Monte o agente camada por camada
              </div>
            </div>
            <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontFamily:'Crimson Pro,serif' }}>Carregando peças…</div>}>
              <TokenBuilder onSalvar={salvarToken} onFechar={()=>setAba('mesas')} />
            </Suspense>
          </>
        )}
      </div>

      {flash && (
        <div role="status" style={{ padding:'10px 16px', borderRadius:8, background:'rgba(106,170,122,0.12)', border:'1px solid rgba(106,170,122,0.35)',
          color:'#8fd3a0', fontFamily:'Crimson Pro,serif', fontSize:15, maxWidth:520 }}>{flash}</div>
      )}
    </div>
  );
}

function CampaignMapTab({ campaignId, uid, isMaster }) {
  const [mesaAberta, setMesaAberta] = useState(false);
  const [builderAberto, setBuilder] = useState(false);
  /* A MESA do mapa-múndi (spec 0028 F4). Componente irmão do MapEditor, nunca
     uma modalidade dentro dele (AC-12) — e aberto pelos DOIS papéis: o mestre
     orquestra, o jogador viaja (AC-8). */
  const [mundoAberto, setMundoAberto] = useState(false);
  const [flash, setFlash] = useState("");

  /* Token construído entra na biblioteca de assets do usuário como
     'character' — o mesmo tipo que o MapEditor coloca na mesa (spec 0013). */
  const salvarTokenNaBiblioteca = async ({ nome, dataUrl }) => {
    try {
      await saveAsset(db, uid, {
        type: 'character', name: nome, tags: ['construtor'], folder: null,
        data: dataUrl, w: 512, h: 512,
      });
      setFlash(`"${nome}" salvo na biblioteca — abra a mesa tática e use a Biblioteca de assets.`);
      setBuilder(false);
    } catch (e) {
      console.error('[construtor] salvar token falhou:', e);
      setFlash('Não foi possível salvar. Use "Baixar PNG" como alternativa.');
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      {builderAberto ? (
        <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:17, color:'#e0c8ff' }}>Construtor de Tokens</div>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1.4, textTransform:'uppercase', color:'var(--muted)' }}>
                Monte o agente camada por camada
              </div>
            </div>
            <button onClick={()=>setBuilder(false)}
              style={{ padding:'7px 14px', borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1 }}>
              ← Voltar
            </button>
          </div>
          <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontFamily:'Crimson Pro,serif' }}>Carregando peças…</div>}>
            <TokenBuilder onSalvar={salvarTokenNaBiblioteca} onFechar={()=>setBuilder(false)} />
          </Suspense>
        </div>
      ) : mundoAberto ? (
        <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, overflowY:'auto' }}>
          <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontFamily:'Crimson Pro,serif' }}>Abrindo o mapa-múndi…</div>}>
            <MesaDoMapaMundi campaignId={campaignId} uid={uid} isMaster={isMaster}
              onSair={() => setMundoAberto(false)} />
          </Suspense>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:16, textAlign:'center' }}>
          <div style={{ fontSize:58, opacity:0.35 }}>🗺️</div>
          <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:17, color:'var(--gold)', opacity:0.7 }}>Mesa tática</div>
          <div style={{ fontFamily:"var(--font-body,'Crimson Pro',serif)", fontSize:14, color:'var(--muted)', maxWidth:380, lineHeight:1.8 }}>
            {isMaster
              ? 'Monte o mapa com imagens, tokens, camadas e névoa — os jogadores acompanham cada mudança ao vivo.'
              : 'O mapa da sessão abre aqui em tempo real, conforme o Mestre edita.'}
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginTop:8 }}>
            <button onClick={() => setMesaAberta(true)}
              style={{ padding:'10px 22px', borderRadius:8, border:'1px solid rgba(176,48,216,0.5)', background:'rgba(176,48,216,0.15)', color:'#e0c8ff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:11, letterSpacing:1 }}>
              🗺️ Abrir mesa tática
            </button>
            <button onClick={() => setMundoAberto(true)}
              style={{ padding:'10px 22px', borderRadius:8, border:'1px solid rgba(201,168,76,0.5)', background:'rgba(201,168,76,0.12)', color:'var(--gold2)', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:11, letterSpacing:1 }}>
              🧭 Mapa-múndi
            </button>
            <button onClick={() => setBuilder(true)}
              style={{ padding:'10px 22px', borderRadius:8, border:'1px solid rgba(201,168,76,0.5)', background:'rgba(201,168,76,0.12)', color:'var(--gold2)', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:11, letterSpacing:1 }}>
              🎭 Construtor de Tokens
            </button>
          </div>
          {flash && (
            <div style={{ marginTop:6, padding:'8px 14px', borderRadius:8, background:'rgba(106,170,122,0.12)', border:'1px solid rgba(106,170,122,0.35)',
              color:'#8fd3a0', fontFamily:'Crimson Pro,serif', fontSize:14, maxWidth:420 }}>{flash}</div>
          )}
        </div>
      )}
      {mesaAberta && (
        <MapEditor campaignId={campaignId} uid={uid} isMaster={isMaster} db={db}
          onBack={() => setMesaAberta(false)} />
      )}
    </div>
  );
}
/* ── BESTIARY TAB ── */
const BESTIARY_SYSTEMS = ['Genérico','Ordem Paranormal','Tormenta 20','D&D 5e'];
const EMPTY_CREATURE   = { name:'', system:'Genérico', hp:'', ac:'', initiative:'', description:'', attacks:'' };
const EMPTY_OP_CREATURE = {
  name:'', system:'Ordem Paranormal',
  imageUrl:'', vd:'', category:'',
  hpMax:'', hpCurrent:'',
  agi:'', atFor:'', atInt:'', pre:'', vig:'',
  defesa:'', deslocamento:'',
  perPercepcao:'', perIniciativa:'', perFortitude:'', perReflexos:'', perVontade:'',
  sentidos:'', elementosSecundarios:'',
  imunidades:'', resBalistico:'', resImpacto:'', resPerfuracao:'',
  vulnerabilidades:'', presencaPerturbadora:'',
  acoes:[], poderes:[], descricaoTexto:'', enigmas:[],
};


// Condições fiéis ao livro base de Ordem Paranormal (spec 0021). Textos verificados contra
// as fontes oficiais/compilações (Guia Rápido de Regras). São de referência (o app não aplica
// as penalidades automaticamente). Perturbado/Enlouquecendo/Pasmo/Debilitado seguem o homebrew
// que o Andre optou por manter.
const OP_CONDICOES = [
  { nome:'Abalado', cor:'#e09050', descricao:'-2 em testes de perícia. Se ficar abalado novamente, fica Apavorado.' },
  { nome:'Agarrado', cor:'#e09050', descricao:'Fica desprevenido e imóvel, sofre -2 em testes de ataque e só pode atacar com armas leves.' },
  { nome:'Alquebrado', cor:'#b030d8', descricao:'O custo em PE das habilidades e rituais aumenta em +1.' },
  { nome:'Apavorado', cor:'#e07070', descricao:'-5 em testes de perícia e deve fugir da fonte do medo. Se não puder fugir, pode agir, mas não pode se aproximar dela voluntariamente.' },
  { nome:'Atordoado', cor:'#e07070', descricao:'Fica desprevenido e não pode fazer ações.' },
  { nome:'Caído', cor:'#e09050', descricao:'Deitado. -5 em ataques corpo a corpo; deslocamento 1,5m. Ataques CaC contra você recebem +5; à distância, -5. Levantar custa metade do deslocamento.' },
  { nome:'Cego', cor:'#e07070', descricao:'Fica desprevenido e lento; não pode fazer testes de Percepção para observar; -5 em perícias de Força/Agilidade. Seus alvos têm camuflagem total.' },
  { nome:'Confuso', cor:'#e09050', descricao:'Age de modo aleatório: role 1d6 no início do turno para determinar o comportamento (fugir, balbuciar, atacar o mais próximo ou agir normalmente).' },
  { nome:'Debilitado', cor:'#e09050', descricao:'Pode realizar apenas 1 ação por turno (padrão OU movimento). [homebrew]' },
  { nome:'Desprevenido', cor:'#e07070', descricao:'Despreparado para reagir. Sofre -5 na Defesa.' },
  { nome:'Enjoado', cor:'#e09050', descricao:'-2 em ataques e testes de perícia.' },
  { nome:'Exausto', cor:'#e09050', descricao:'Deslocamento reduzido à metade. -5 em testes de ataque e de perícia (também conta como Fatigado).' },
  { nome:'Fatigado', cor:'#f0c040', descricao:'-2 em testes de ataque e de perícia.' },
  { nome:'Imóvel', cor:'#e09050', descricao:'Todas as formas de deslocamento são reduzidas a 0m.' },
  { nome:'Inconsciente', cor:'#e07070', descricao:'Fica indefeso e não pode fazer ações. Acordá-lo gasta uma ação padrão.' },
  { nome:'Indefeso', cor:'#e07070', descricao:'É considerado desprevenido e sofre -10 na Defesa; falha automaticamente em Reflexos e pode sofrer golpe de misericórdia.' },
  { nome:'Lento', cor:'#f0c040', descricao:'Deslocamento reduzido à metade (arredonda p/ baixo). Não pode correr nem fazer investida.' },
  { nome:'Machucado', cor:'#f0c040', descricao:'Com metade ou menos dos PV totais. Pré-requisito para certas habilidades; sem penalidade direta.' },
  { nome:'Morrendo', cor:'#e07070', descricao:'PV em 0. Se iniciar 3 turnos morrendo na mesma cena, morre. Encerrado por Medicina DT 20 ou efeito específico.' },
  { nome:'Paralisado', cor:'#e07070', descricao:'Fica imóvel e indefeso; só pode realizar ações puramente mentais.' },
  { nome:'Pasmo', cor:'#e09050', descricao:'Perde a próxima ação padrão. [homebrew]' },
  { nome:'Perturbado', cor:'#b030d8', descricao:'SAN abaixo da metade. Alucinações e percepção distorcida. [homebrew]' },
  { nome:'Petrificado', cor:'#e07070', descricao:'Fica inconsciente e recebe resistência a dano 10.' },
  { nome:'Sangrando', cor:'#e07070', descricao:'No início do turno, faça um teste de Vigor (DT 15): se falhar, perde 1d6 PV e continua sangrando; se passar, remove a condição.' },
  { nome:'Enlouquecendo', cor:'#e07070', descricao:'SAN chegou a 0. Removido da cena; pode se tornar criatura paranormal a critério do mestre. [homebrew]' },
  { nome:'Surdo', cor:'#f0c040', descricao:'Não pode ouvir. Falha automática em testes que dependam de audição.' },
  { nome:'Vulnerável', cor:'#e09050', descricao:'Sofre dano dobrado de um tipo específico (indicado pelo efeito causador).' },
];


/* ════════════════════════════════════════════════════════════════════════
   FICHA DE CRIATURA (biblioteca de tokens) — tema + efeitos por elemento
   Partículas e auras usam só transform/opacity (0017 AC-1) e respeitam
   prefers-reduced-motion. Cada elemento tem sua assinatura visual:
   Conhecimento = runas douradas · Energia = faíscas com flicker elétrico ·
   Medo = névoa rastejante · Morte = cinzas subindo · Sangue = gotas + pulso.
════════════════════════════════════════════════════════════════════════ */
const TOKEN_FX = {
  Conhecimento: { c:'#f0c040', glyphs:['✦','◈','⟡','ᚱ','ᛟ','ᚨ'], mode:'rise' },
  Energia:      { c:'#57a0ff', glyphs:['✦','•','•'],             mode:'rise', flicker:true },
  Medo:         { c:'#b030d8', glyphs:['•','•'],                 mode:'rise', fog:true },
  Morte:        { c:'#a8b0b8', glyphs:['•','•','•'],             mode:'rise' },
  Sangue:       { c:'#e04040', glyphs:['●','•','•'],             mode:'fall', beat:true },
  Extras:       { c:'#c9a84c', glyphs:['✦','•'],                 mode:'rise' },
};

const TokenFichaFX = () => (
  <style>{`
    .tokfx-hero{ position:relative; overflow:hidden; height:230px; flex-shrink:0;
      background:
        radial-gradient(90% 130% at 50% 105%, color-mix(in srgb, var(--fxc) 26%, transparent), transparent 60%),
        radial-gradient(120% 90% at 50% -10%, rgba(0,0,0,0.55), transparent 55%),
        linear-gradient(180deg, #0a0812, #120d1c); }
    .tokfx-hero::after{ content:""; position:absolute; inset:0; pointer-events:none;
      box-shadow:inset 0 0 70px 12px rgba(0,0,0,0.65); }
    .tokfx-img{ position:absolute; left:50%; top:50%; max-width:78%; max-height:82%;
      transform:translate(-50%,-50%); filter:drop-shadow(0 6px 22px color-mix(in srgb, var(--fxc) 55%, transparent)); }
    .tokfx-p{ position:absolute; bottom:-12px; pointer-events:none; color:var(--fxc); opacity:0;
      text-shadow:0 0 8px var(--fxc); user-select:none; }
    .tokfx-fall .tokfx-p{ bottom:auto; top:-12px; }
    .tokfx-fog{ position:absolute; width:70%; height:60%; border-radius:50%; pointer-events:none;
      background:radial-gradient(circle, color-mix(in srgb, var(--fxc) 22%, transparent), transparent 70%);
      filter:blur(26px); opacity:0.5; }
    .tokfx-flick{ position:absolute; inset:0; pointer-events:none;
      background:radial-gradient(70% 60% at 50% 45%, color-mix(in srgb, var(--fxc) 16%, transparent), transparent 70%); opacity:0; }
    .tokfx-shimmer{ position:absolute; top:0; bottom:0; width:34%; pointer-events:none;
      background:linear-gradient(100deg, transparent, color-mix(in srgb, var(--fxc) 12%, transparent), transparent); }
    .tokfx-statpill{ display:flex; flex-direction:column; align-items:center; gap:2px; min-width:52px;
      padding:7px 10px; border-radius:8px; background:rgba(255,255,255,0.04);
      border:1px solid color-mix(in srgb, var(--fxc) 30%, transparent); }
    @media (prefers-reduced-motion: no-preference){
      .tokfx-img{ animation:tokfx-float 4.5s ease-in-out infinite; }
      .tokfx-beat .tokfx-img{ animation:tokfx-float 4.5s ease-in-out infinite, tokfx-beatglow 1.4s ease-in-out infinite; }
      .tokfx-p{ animation:tokfx-rise var(--dur,7s) linear var(--delay,0s) infinite; }
      .tokfx-fall .tokfx-p{ animation:tokfx-fallanim var(--dur,5s) ease-in var(--delay,0s) infinite; }
      .tokfx-fog{ animation:tokfx-fogdrift 9s ease-in-out infinite alternate; }
      .tokfx-flick{ animation:tokfx-flicker 3.2s steps(1) infinite; }
      .tokfx-shimmer{ animation:tokfx-sweep 5.5s ease-in-out infinite; }
    }
    @keyframes tokfx-float{ 0%,100%{ transform:translate(-50%,-50%) } 50%{ transform:translate(-50%,calc(-50% - 8px)) } }
    @keyframes tokfx-beatglow{ 0%,30%,100%{ filter:drop-shadow(0 6px 20px color-mix(in srgb, var(--fxc) 45%, transparent)) }
      8%{ filter:drop-shadow(0 6px 38px var(--fxc)) } 16%{ filter:drop-shadow(0 6px 26px color-mix(in srgb, var(--fxc) 70%, transparent)) } }
    @keyframes tokfx-rise{ 0%{ transform:translateY(0) translateX(0); opacity:0 } 12%{ opacity:0.85 }
      70%{ opacity:0.5 } 100%{ transform:translateY(-215px) translateX(var(--drift,8px)); opacity:0 } }
    @keyframes tokfx-fallanim{ 0%{ transform:translateY(0); opacity:0 } 10%{ opacity:0.9 }
      100%{ transform:translateY(245px); opacity:0 } }
    @keyframes tokfx-fogdrift{ 0%{ transform:translateX(-16%) } 100%{ transform:translateX(16%) } }
    @keyframes tokfx-flicker{ 0%,100%{ opacity:0 } 7%{ opacity:0.85 } 9%{ opacity:0.1 } 11%{ opacity:0.6 }
      13%{ opacity:0 } 47%{ opacity:0.5 } 49%{ opacity:0 } 78%{ opacity:0.35 } 80%{ opacity:0 } }
    @keyframes tokfx-sweep{ 0%{ transform:translateX(-140%) skewX(-16deg) } 55%,100%{ transform:translateX(340%) skewX(-16deg) } }
  `}</style>
);

/* Extrai o que der do texto da ficha (docx) — tudo opcional, texto manda. */
function parseFichaOP(texto) {
  if (!texto) return { stats: [], sections: [] };
  const grab = (re) => { const m = texto.match(re); return m ? m[1].trim() : null; };
  const stats = [];
  const pv = grab(/(?:\bPV\b|PONTOS DE VIDA)\s*[:\-–]?\s*(\d+)/i);
  const def = grab(/\bDEFESA\b\s*[:\-–]?\s*(\d+)/i);
  const desl = grab(/\bDESLOCAMENTO\b\s*[:\-–]?\s*([0-9]+\s*m?[^\n,;.]{0,18})/i);
  if (pv) stats.push(['PV', pv]); if (def) stats.push(['Defesa', def]); if (desl) stats.push(['Desloc.', desl]);
  ['AGI','FOR','INT','PRE','VIG'].forEach(k => {
    const v = grab(new RegExp(`\\b${k}\\b\\s*[:\\-–]?\\s*(\\d+)`));
    if (v) stats.push([k, v]);
  });
  /* Seções: linha curta em CAIXA-ALTA (ou palavra-chave) vira cabeçalho. */
  const KEYW = /^(AÇÕES|AÇÃO|HABILIDADES|PODERES|ATAQUES?|ESTRATAGEMAS?|DESCRIÇÃO|EQUIPAMENTOS?|RITUAIS|PERÍCIAS|VARIAÇÕES|TESOURO|SANIDADE|PRESENÇA PERTURBADORA|ESTATÍSTICAS)\b/i;
  const sections = [{ title: null, lines: [] }];
  texto.split(/\n/).forEach(raw => {
    const l = raw.trim();
    if (!l) return;
    const isHead = (l.length <= 48 && /[A-ZÀ-Ú]/.test(l) && l === l.toUpperCase() && !/\d{2,}/.test(l)) || KEYW.test(l);
    if (isHead && l.length <= 60) sections.push({ title: l.replace(/[:.]$/, ''), lines: [] });
    else sections[sections.length - 1].lines.push(l);
  });
  return { stats, sections: sections.filter(s => s.title || s.lines.length) };
}

function BestiaryTab({ campaignId }) {
  const [creatures,    setCreatures]   = useState([]);
  const [search,       setSearch]      = useState('');
  const [filterSys,    setFilterSys]   = useState('Todos');
  const [modal,        setModal]       = useState(null);
  const [form,         setForm]        = useState(EMPTY_CREATURE);
  const [saving,       setSaving]      = useState(false);
  const [viewCreature, setViewCreature]= useState(null);
  const [rollResult,   setRollResult]  = useState(null);
  const [opTab,        setOpTab]       = useState('STATUS');
  const [opCombTab,    setOpCombTab]   = useState('AÇÕES');
  const [opExpAcao,    setOpExpAcao]   = useState(null);
  const [bestedTab,    setBestedTab]   = useState('criaturas');
  const [ritualElem,   setRitualElem]  = useState('Todos');
  const [ritualCirc,   setRitualCirc]  = useState(0);
  const [ritualSearch, setRitualSearch]= useState('');
  const [ritualExp,    setRitualExp]   = useState(null);
  const [armaFilter,   setArmaFilter]  = useState('Todos');
  /* Biblioteca de tokens oficiais (importados dos packs de criaturas) */
  const [tokenElem,    setTokenElem]   = useState('Todos');
  const [tokenSearch,  setTokenSearch] = useState('');
  const [tokenView,    setTokenView]   = useState(null);   // criatura da biblioteca aberta
  const [tokenVariant, setTokenVariant]= useState(0);      // variante de token selecionada
  const [tokenTab,     setTokenTab]    = useState('tokens'); // 'tokens' | 'moldes' (variantes MOLDE separadas)

  const SYS_COLORS = { 'Genérico':'#8888aa', 'Ordem Paranormal':'#b030d8', 'Tormenta 20':'#d4621e', 'D&D 5e':'#4a6fa5' };
  const OPC = '#b030d8';
  const isOP = sys => sys === 'Ordem Paranormal';

  useEffect(() => {
    const ref = collection(db, 'campaigns', campaignId, 'bestiary');
    const q   = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setCreatures(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [campaignId]);

  function openNew() { setForm(EMPTY_CREATURE); setModal('new'); }

  /* Cria uma criatura a partir da biblioteca de tokens oficiais: pré-preenche
     nome, VD, token escolhido (caminho estático leve — a imagem vive em
     /public/bestiary-tokens, o Firestore guarda só a URL) e o texto da ficha. */
  function addFromToken(tk, vi = 0) {
    setForm({
      ...EMPTY_OP_CREATURE,
      name: tk.nome,
      vd: tk.vd || '',
      imageUrl: (tk.tokens[vi] || tk.tokens[0]).src,
      descricaoTexto: tk.ficha || '',
    });
    setTokenView(null);
    setModal('new');
  }
  function openEdit(c) {
    if (isOP(c.system)) {
      setForm({
        name:c.name||'', system:'Ordem Paranormal',
        imageUrl:c.imageUrl||'', vd:c.vd||'', category:c.category||'',
        hpMax:c.hpMax||'', hpCurrent:c.hpCurrent||'',
        agi:c.agi||'', atFor:c.atFor||'', atInt:c.atInt||'', pre:c.pre||'', vig:c.vig||'',
        defesa:c.defesa||'', deslocamento:c.deslocamento||'',
        perPercepcao:c.perPercepcao||'', perIniciativa:c.perIniciativa||'',
        perFortitude:c.perFortitude||'', perReflexos:c.perReflexos||'',
        perVontade:c.perVontade||'',
        sentidos:c.sentidos||'', elementosSecundarios:c.elementosSecundarios||'',
        imunidades:c.imunidades||'', resBalistico:c.resBalistico||'',
        resImpacto:c.resImpacto||'', resPerfuracao:c.resPerfuracao||'',
        vulnerabilidades:c.vulnerabilidades||'', presencaPerturbadora:c.presencaPerturbadora||'',
        acoes:c.acoes||[], poderes:c.poderes||[], descricaoTexto:c.descricaoTexto||'', enigmas:c.enigmas||[],
      });
    } else {
      setForm({ name:c.name||'', system:c.system||'Genérico', hp:c.hp||'', ac:c.ac||'', initiative:c.initiative||'', description:c.description||'', attacks:c.attacks||'' });
    }
    setModal(c);
  }

  async function saveCreature() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = { ...form, name: form.name.trim() };
      if (modal === 'new') {
        await addDoc(collection(db, 'campaigns', campaignId, 'bestiary'), { ...data, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'campaigns', campaignId, 'bestiary', modal.id), data);
      }
      setModal(null);
    } catch(_) {}
    setSaving(false);
  }

  async function deleteCreature(id) {
    if (!window.confirm('Remover esta criatura do bestiário?')) return;
    await deleteDoc(doc(db, 'campaigns', campaignId, 'bestiary', id)).catch((e)=>console.error("[bestiário] remover criatura falhou:", e));
  }

  async function updateHP(creature, delta) {
    const max = parseInt(creature.hpMax)||0;
    const cur = parseInt(creature.hpCurrent != null ? creature.hpCurrent : creature.hpMax)||max;
    const next = Math.max(0, Math.min(max, cur + delta));
    await updateDoc(doc(db, 'campaigns', campaignId, 'bestiary', creature.id), { hpCurrent: next }).catch((e)=>console.error("[bestiário] atualizar PV falhou:", e));
    setViewCreature(v => v && v.id === creature.id ? { ...v, hpCurrent: next } : v);
  }

  // Bestiário: dialeto permissivo com contagem obrigatória ("d6" nunca foi aceito aqui).
  // A UI consome { total, rolls, notation } — adaptado aqui, não no domínio.
  function doRoll(notation) {
    const r = rollNotation(notation, { requireCount: true });
    if (r) setRollResult({ total: r.total, rolls: r.rolls, notation });
  }

  const filtered = creatures.filter(c =>
    (filterSys === 'Todos' || c.system === filterSys) &&
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const sL = { fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif', letterSpacing:1, textTransform:'uppercase', display:'block', marginBottom:3 };
  const sI = { background:'var(--card2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', padding:'7px 10px', fontFamily:'Cinzel,serif', fontSize:12, outline:'none', width:'100%', boxSizing:'border-box' };
  const sT = { ...sI, fontFamily:'Crimson Pro,serif', fontSize:13, resize:'vertical', minHeight:52 };

  function fld(label, key, opts={}) {
    const val = form[key] !== undefined ? form[key] : '';
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
        <span style={sL}>{label}</span>
        {opts.textarea
          ? <textarea value={val} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} rows={opts.rows||3} style={sT}/>
          : <input value={val} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
              type={opts.type||'text'} placeholder={opts.placeholder||''}
              style={{ ...sI, ...(opts.mono ? {fontFamily:'monospace',fontSize:13} : {}) }}/>
        }
      </div>
    );
  }

  // OP action helpers
  function opAddAcao()       { setForm(p=>({...p,acoes:[...(p.acoes||[]),{tipo:'PADRÃO',nome:'',conteudo:'texto',descricao:'',ataques:[]}]})); }
  function opRemAcao(i)      { setForm(p=>({...p,acoes:(p.acoes||[]).filter((_,j)=>j!==i)})); }
  function opSetAcao(i,k,v)  { setForm(p=>{ const a=[...(p.acoes||[])]; a[i]={...a[i],[k]:v}; return {...p,acoes:a}; }); }
  function opAddAtk(ai)      { setForm(p=>{ const a=[...(p.acoes||[])]; a[ai]={...a[ai],ataques:[...(a[ai].ataques||[]),{arma:'',alcance:'Corpo a corpo',hits:'',teste:'',dano:'',critico:''}]}; return {...p,acoes:a}; }); }
  function opRemAtk(ai,ji)   { setForm(p=>{ const a=[...(p.acoes||[])]; a[ai]={...a[ai],ataques:(a[ai].ataques||[]).filter((_,j)=>j!==ji)}; return {...p,acoes:a}; }); }
  function opSetAtk(ai,ji,k,v){ setForm(p=>{ const a=[...(p.acoes||[])]; const atk=[...a[ai].ataques]; atk[ji]={...atk[ji],[k]:v}; a[ai]={...a[ai],ataques:atk}; return {...p,acoes:a}; }); }
  function opAddPod()        { setForm(p=>({...p,poderes:[...(p.poderes||[]),{nome:'',desc:''}]})); }
  function opRemPod(i)       { setForm(p=>({...p,poderes:(p.poderes||[]).filter((_,j)=>j!==i)})); }
  function opSetPod(i,k,v)   { setForm(p=>{ const pd=[...(p.poderes||[])]; pd[i]={...pd[i],[k]:v}; return {...p,poderes:pd}; }); }
  function opAddEni()        { setForm(p=>({...p,enigmas:[...(p.enigmas||[]),{titulo:'',texto:''}]})); }
  function opRemEni(i)       { setForm(p=>({...p,enigmas:(p.enigmas||[]).filter((_,j)=>j!==i)})); }
  function opSetEni(i,k,v)   { setForm(p=>{ const en=[...(p.enigmas||[])]; en[i]={...en[i],[k]:v}; return {...p,enigmas:en}; }); }

  const DiceBtn = ({n}) => (
    <button onClick={()=>doRoll(n)} title={`Rolar ${n}`}
      style={{ background:'transparent', border:'none', cursor:'pointer', padding:'2px 3px', color:OPC, display:'inline-flex', alignItems:'center', lineHeight:1 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
    </button>
  );
  const SecH  = ({children}) => <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:14, color:'var(--text)', margin:'14px 0 7px' }}>{children}</div>;
  const InfoL = ({children}) => <div style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', marginBottom:3 }}>{children}</div>;
  const SecF  = ({children}) => <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:2, textTransform:'uppercase', color:OPC, borderBottom:`1px solid rgba(176,48,216,0.3)`, paddingBottom:5, marginBottom:8, marginTop:6 }}>{children}</div>;

  const vc = viewCreature;
  const vcHpMax = vc ? parseInt(vc.hpMax)||0 : 0;
  const vcHpCur = vc ? parseInt(vc.hpCurrent != null ? vc.hpCurrent : vc.hpMax)||vcHpMax : 0;
  const vcHpPct = vcHpMax > 0 ? vcHpCur/vcHpMax : 1;
  const OP_PERICIAS = [['PERCEPÇÃO','perPercepcao'],['INICIATIVA','perIniciativa'],['FORTITUDE','perFortitude'],['REFLEXOS','perReflexos'],['VONTADE','perVontade']];
  const OP_ATTRS    = [['AGI','agi'],['FOR','atFor'],['INT','atInt'],['PRE','pre'],['VIG','vig']];

  const ELEM_COLORS = { Conhecimento:'#f0c040', Energia:'#4080e0', Morte:'#808080', Sangue:'#e04040', Medo:'#b030d8' };
  /* Biblioteca consome os MESMOS dados oficiais da ficha (spec 0025 — fonte única). */
  const CUSTO_CIRCULO = { 1:1, 2:3, 3:6, 4:10 };
  const capElem = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : s;
  const filteredRituais = RITUAIS_LIB.filter(r=>
    (ritualElem==='Todos'||capElem(r.elemento)===ritualElem) &&
    (ritualCirc===0||r.circulo===ritualCirc) &&
    (!ritualSearch||r.nome.toLowerCase().includes(ritualSearch.toLowerCase())||(r.descricao||'').toLowerCase().includes(ritualSearch.toLowerCase())||(r.efeito||'').toLowerCase().includes(ritualSearch.toLowerCase()))
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

      {/* Roll result overlay */}
      {rollResult && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200 }}
          onClick={()=>setRollResult(null)}>
          <div style={{ background:'var(--card)', border:`1px solid ${OPC}55`, borderRadius:12, padding:'28px 36px', textAlign:'center', minWidth:200 }}>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:2, color:'var(--muted)', marginBottom:6 }}>RESULTADO</div>
            <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:52, color:OPC, lineHeight:1 }}>{rollResult.total}</div>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:11, color:'var(--muted)', marginTop:5 }}>{rollResult.notation}</div>
            <div style={{ fontFamily:'Crimson Pro,serif', fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:5 }}>[{rollResult.rolls.join(', ')}]</div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:12 }}>clique para fechar</div>
          </div>
        </div>
      )}

      {/* OP Sheet View Modal */}
      {vc && isOP(vc.system) && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, width:'100%', maxWidth:500, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* Header */}
            <div style={{ position:'relative', height: vc.imageUrl ? 130 : 70, flexShrink:0 }}>
              {vc.imageUrl && <img src={vc.imageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>}
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0.85) 100%)' }}/>
              <div style={{ position:'absolute', top:10, left:12 }}>
                <button onClick={()=>{ setViewCreature(null); openEdit(vc); }}
                  style={{ background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:5, color:'rgba(255,255,255,0.75)', cursor:'pointer', padding:'3px 9px', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>✏️ Editar</button>
              </div>
              <button onClick={()=>{ setViewCreature(null); setOpTab('STATUS'); setOpCombTab('AÇÕES'); setOpExpAcao(null); }}
                style={{ position:'absolute', top:10, right:12, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, color:'rgba(255,255,255,0.8)', cursor:'pointer', padding:'4px 10px', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1 }}>✕</button>
              <div style={{ position:'absolute', bottom:10, left:14 }}>
                <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:17, color:'#fff', textShadow:'0 1px 6px rgba(0,0,0,0.9)', lineHeight:1.2 }}>{vc.name}</div>
                {(vc.vd||vc.category) && <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, color:'rgba(255,255,255,0.7)', marginTop:2 }}>
                  {vc.vd && `VD: ${vc.vd}`}{vc.vd&&vc.category&&' · '}{vc.category}
                </div>}
              </div>
            </div>
            {/* HP Bar */}
            {vcHpMax > 0 && (
              <div style={{ background:'rgba(0,0,0,0.4)', padding:'8px 14px', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', background:'var(--card)', borderRadius:8, overflow:'hidden' }}>
                  <button onClick={()=>updateHP(vc,-10)} style={{ padding:'8px 11px', background:'rgba(255,255,255,0.06)', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14, fontFamily:'monospace' }}>«</button>
                  <button onClick={()=>updateHP(vc,-1)}  style={{ padding:'8px 8px',  background:'rgba(255,255,255,0.04)', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14, fontFamily:'monospace' }}>‹</button>
                  <div style={{ flex:1, position:'relative', textAlign:'center', padding:'8px 0' }}>
                    <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${vcHpPct*100}%`, background:'linear-gradient(90deg,#8b1c1c,#b02020)', opacity:0.7, transition:'width .2s' }}/>
                    <span style={{ position:'relative', fontFamily:'Cinzel,serif', fontSize:15, letterSpacing:2, color:'#fff', fontWeight:600 }}>{vcHpCur} / {vcHpMax}</span>
                  </div>
                  <button onClick={()=>updateHP(vc,1)}   style={{ padding:'8px 8px',  background:'rgba(255,255,255,0.04)', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14, fontFamily:'monospace' }}>›</button>
                  <button onClick={()=>updateHP(vc,10)}  style={{ padding:'8px 11px', background:'rgba(255,255,255,0.06)', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14, fontFamily:'monospace' }}>»</button>
                </div>
              </div>
            )}
            {/* Sheet Tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
              {['STATUS','COMBATE','DESCRIÇÃO'].map(t=>(
                <button key={t} onClick={()=>setOpTab(t)}
                  style={{ flex:1, padding:'10px 4px', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, border:'none', background:'transparent', cursor:'pointer', color:opTab===t?'#fff':'var(--muted)', borderBottom:opTab===t?`2px solid ${OPC}`:'2px solid transparent', transition:'color .15s' }}>
                  {t}
                </button>
              ))}
            </div>
            {/* Content */}
            <div style={{ flex:1, overflowY:'auto', padding:'0 16px 16px' }}>
              {opTab==='STATUS' && (
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, padding:'14px 0 10px' }}>
                    {OP_ATTRS.map(([l,k])=> vc[k] ? (
                      <div key={k} style={{ textAlign:'center' }}>
                        <div style={{ fontSize:8, color:'var(--muted)', fontFamily:'Cinzel,serif', letterSpacing:1, textTransform:'uppercase', marginBottom:3 }}>{l}</div>
                        <div style={{ fontFamily:'Cinzel,serif', fontSize:22, color:'var(--text)', fontWeight:700 }}>{vc[k]}</div>
                      </div>
                    ) : null)}
                  </div>
                  {(vc.defesa||vc.deslocamento) && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>
                      {vc.defesa && <div style={{ textAlign:'center' }}><div style={sL}>DEFESA</div><div style={{ fontFamily:'Cinzel,serif', fontSize:26, color:'var(--text)', fontWeight:700 }}>{vc.defesa}</div></div>}
                      {vc.deslocamento && <div style={{ textAlign:'center' }}><div style={sL}>DESLOCAMENTO</div><div style={{ fontFamily:'Cinzel,serif', fontSize:17, color:'var(--text)', fontWeight:600, marginTop:4 }}>{vc.deslocamento}</div></div>}
                    </div>
                  )}
                  {OP_PERICIAS.some(([,k])=>vc[k]) && (
                    <div>
                      <SecH>Perícias</SecH>
                      {OP_PERICIAS.filter(([,k])=>vc[k]).map(([l,k])=>(
                        <div key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'rgba(255,255,255,0.04)', borderRadius:6, marginBottom:4 }}>
                          <span style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, textTransform:'uppercase', color:'rgba(255,255,255,0.7)' }}>{l}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                            <span style={{ fontFamily:'Cinzel,serif', fontSize:13, color:'var(--text)' }}>{vc[k]}</span>
                            <DiceBtn n={vc[k]}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {vc.sentidos && <div><SecH>Sentidos</SecH>{vc.sentidos.split('\n').map((l,i)=>l.trim()&&<InfoL key={i}>{l}</InfoL>)}</div>}
                  {vc.elementosSecundarios && <div><SecH>Elementos secundários</SecH>{vc.elementosSecundarios.split('\n').map((l,i)=>l.trim()&&<InfoL key={i}>{l}</InfoL>)}</div>}
                  {vc.imunidades && <div><SecH>Imunidades</SecH>{vc.imunidades.split('\n').map((l,i)=>l.trim()&&<InfoL key={i}>{l}</InfoL>)}</div>}
                  {(vc.resBalistico||vc.resImpacto||vc.resPerfuracao) && (
                    <div><SecH>Resistências</SecH>
                      {vc.resBalistico&&<InfoL>BALÍSTICO: {vc.resBalistico}</InfoL>}
                      {vc.resImpacto&&<InfoL>IMPACTO: {vc.resImpacto}</InfoL>}
                      {vc.resPerfuracao&&<InfoL>PERFURAÇÃO: {vc.resPerfuracao}</InfoL>}
                    </div>
                  )}
                  {vc.vulnerabilidades && <div><SecH>Vulnerabilidades</SecH>{vc.vulnerabilidades.split('\n').map((l,i)=>l.trim()&&<InfoL key={i}>{l}</InfoL>)}</div>}
                </div>
              )}
              {opTab==='COMBATE' && (
                <div style={{ paddingTop:12 }}>
                  {vc.presencaPerturbadora && (
                    <div style={{ marginBottom:14 }}>
                      <div style={sL}>PRESENÇA PERTURBADORA</div>
                      <div style={{ fontFamily:'Crimson Pro,serif', fontSize:14, color:'var(--text)' }}>{vc.presencaPerturbadora}</div>
                    </div>
                  )}
                  <div style={{ display:'flex', gap:14, marginBottom:14 }}>
                    {['AÇÕES','PODERES'].map(ct=>(
                      <button key={ct} onClick={()=>setOpCombTab(ct)}
                        style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, border:'none', background:'transparent', cursor:'pointer', color:opCombTab===ct?OPC:'var(--muted)', borderBottom:opCombTab===ct?`1px solid ${OPC}`:'1px solid transparent', padding:'2px 2px 4px' }}>
                        {ct}
                      </button>
                    ))}
                  </div>
                  {opCombTab==='AÇÕES' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {(vc.acoes||[]).length===0 && <div style={{ color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:14, padding:16, textAlign:'center' }}>Nenhuma ação registrada.</div>}
                      {(vc.acoes||[]).map((acao,i)=>{
                        const exp = opExpAcao===i;
                        return (
                          <div key={i} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer' }} onClick={()=>setOpExpAcao(exp?null:i)}>
                              <span style={{ fontSize:13, color:OPC }}>{exp?'∧':'∨'}</span>
                              <span style={{ fontFamily:'Cinzel,serif', fontSize:12, color:'var(--text)', flex:1 }}>
                                <span style={{ color:'rgba(255,255,255,0.45)' }}>{acao.tipo}</span> - {acao.nome}
                              </span>
                            </div>
                            {exp && (
                              <div style={{ padding:'0 14px 12px', borderTop:'1px solid var(--border)' }}>
                                {acao.conteudo==='texto' ? (
                                  <div style={{ fontFamily:'Crimson Pro,serif', fontSize:14, color:'var(--text)', lineHeight:1.7, paddingTop:10 }}>{acao.descricao}</div>
                                ) : (
                                  <div style={{ paddingTop:10, display:'flex', flexDirection:'column', gap:12 }}>
                                    {(acao.ataques||[]).map((atk,j)=>(
                                      <div key={j} style={{ paddingBottom:j<(acao.ataques.length-1)?12:0, borderBottom:j<(acao.ataques.length-1)?'1px solid rgba(255,255,255,0.06)':'none' }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                                          <span style={{ fontFamily:'Cinzel,serif', fontSize:11, color:'var(--text)', textTransform:'uppercase', letterSpacing:0.5 }}>{atk.arma}</span>
                                          {atk.alcance&&<span style={{ fontFamily:'Cinzel,serif', fontSize:9, color:'var(--muted)', letterSpacing:1 }}>{atk.alcance}</span>}
                                          {atk.hits&&<span style={{ fontFamily:'Cinzel,serif', fontSize:9, color:'var(--muted)' }}>{atk.hits}</span>}
                                          {atk.teste&&<DiceBtn n={atk.teste}/>}
                                        </div>
                                        {atk.teste&&<div style={{ fontFamily:'Cinzel,serif', fontSize:10, color:OPC, marginBottom:2 }}>Teste: {atk.teste}</div>}
                                        {atk.dano&&<div>
                                          <div style={{ fontFamily:'Cinzel,serif', fontSize:9, color:OPC, letterSpacing:1 }}>Dano</div>
                                          <div style={{ fontFamily:'Crimson Pro,serif', fontSize:14, color:'var(--text)' }}>{atk.dano}</div>
                                        </div>}
                                        {atk.critico&&<div style={{ fontFamily:'Cinzel,serif', fontSize:10, color:OPC }}>Crítico: {atk.critico}</div>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {opCombTab==='PODERES' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {(vc.poderes||[]).length===0&&<div style={{ color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:14, padding:16, textAlign:'center' }}>Nenhum poder registrado.</div>}
                      {(vc.poderes||[]).map((p,i)=>(
                        <div key={i} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px' }}>
                          {p.nome&&<div style={{ fontFamily:'Cinzel,serif', fontSize:12, color:'var(--text)', marginBottom:4 }}>{p.nome}</div>}
                          {p.desc&&<div style={{ fontFamily:'Crimson Pro,serif', fontSize:14, color:'rgba(255,255,255,0.8)', lineHeight:1.6 }}>{p.desc}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {opTab==='DESCRIÇÃO' && (
                <div style={{ paddingTop:12 }}>
                  {vc.imageUrl&&<img src={vc.imageUrl} alt={vc.name} style={{ width:'100%', borderRadius:8, marginBottom:16, objectFit:'cover', maxHeight:280 }}/>}
                  {vc.descricaoTexto&&<div style={{ fontFamily:'Crimson Pro,serif', fontSize:15, color:'var(--text)', lineHeight:1.8, textAlign:'justify', marginBottom:16, whiteSpace:'pre-wrap' }}>{vc.descricaoTexto}</div>}
                  {(vc.enigmas||[]).map((e,i)=>(
                    <div key={i} style={{ marginBottom:16 }}>
                      {e.titulo&&<div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:14, color:'var(--text)', marginBottom:6, borderBottom:'1px solid var(--border)', paddingBottom:6 }}>{e.titulo}</div>}
                      {e.texto&&<div style={{ fontFamily:'Crimson Pro,serif', fontSize:15, color:'var(--text)', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{e.texto}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {[['criaturas','Criaturas'],['tokens','Tokens'],['rituais','Rituais'],['condicoes','Condições'],['armas','Armas'],['regras','Regras']].map(([k,l])=>(
          <button key={k} onClick={()=>setBestedTab(k)}
            style={{ flex:1, padding:'9px 4px', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, border:'none', background:'transparent', cursor:'pointer', color:bestedTab===k?'#fff':'var(--muted)', borderBottom:bestedTab===k?`2px solid ${OPC}`:'2px solid transparent', textTransform:'uppercase', transition:'color .15s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* CRIATURAS */}
      {bestedTab==='criaturas' && (<>
        <div style={{ display:'flex', gap:8, padding:'8px 4px', alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar criatura…"
            style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'6px 12px', fontFamily:'Crimson Pro,serif', fontSize:14, outline:'none', flex:1, minWidth:140 }}/>
          <select value={filterSys} onChange={e=>setFilterSys(e.target.value)}
            style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', padding:'6px 10px', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, outline:'none', cursor:'pointer' }}>
            <option value="Todos">Todos</option>
            {[...new Set(creatures.map(c=>c.system).filter(Boolean))].map(s=><option key={s}>{s}</option>)}
          </select>
          <button onClick={openNew}
            style={{ padding:'7px 16px', borderRadius:6, border:`1px solid rgba(176,48,216,0.5)`, background:'rgba(176,48,216,0.15)', color:'#e0c8ff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, whiteSpace:'nowrap' }}>
            + Adicionar Criatura
          </button>
        </div>
        <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:6, paddingRight:2 }}>
          {filtered.length===0 && (
            <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:15 }}>
              {creatures.length===0 ? 'Nenhuma criatura no bestiário. Clique em "+ Adicionar Criatura" para começar.' : 'Nenhuma criatura encontrada.'}
            </div>
          )}
          {filtered.map(c=>{
            const col = SYS_COLORS[c.system]||'#8888aa';
            const hpM = parseInt(c.hpMax)||0;
            const hpC = parseInt(c.hpCurrent != null ? c.hpCurrent : c.hpMax)||hpM;
            const hpColor = hpC<=hpM*0.25?'#e07070':hpC<=hpM*0.5?'#e0a050':'#70c870';
            return (
              <div key={c.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', flexShrink:0, transition:'border-color .15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(176,48,216,0.3)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', cursor: isOP(c.system)?'pointer':'default' }}
                  onClick={()=>{ if(isOP(c.system)){ setOpTab('STATUS'); setOpCombTab('AÇÕES'); setOpExpAcao(null); setViewCreature(c); } }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:col, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'Cinzel,serif', fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                    <div style={{ display:'flex', gap:8, marginTop:2, alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ fontSize:9, color:col, fontFamily:'Cinzel,serif', letterSpacing:1 }}>{c.system}</span>
                      {isOP(c.system) ? (
                        <>
                          {c.vd&&<span style={{ fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>VD {c.vd}</span>}
                          {c.category&&<span style={{ fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>{c.category}</span>}
                          {hpM>0&&<span style={{ fontSize:9, color:hpColor, fontFamily:'Cinzel,serif' }}>HP {hpC}/{hpM}</span>}
                        </>
                      ) : (
                        <>
                          {c.hp&&<span style={{ fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>HP {c.hp}</span>}
                          {c.ac&&<span style={{ fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>CA {c.ac}</span>}
                          {c.initiative&&<span style={{ fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>Init {c.initiative}</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={e=>{e.stopPropagation();openEdit(c);}}
                      style={{ padding:'3px 8px', borderRadius:4, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:10 }}>✏️</button>
                    <button onClick={e=>{e.stopPropagation();deleteCreature(c.id);}}
                      style={{ padding:'3px 8px', borderRadius:4, border:'1px solid rgba(139,32,32,0.3)', background:'transparent', color:'#e07070', cursor:'pointer', fontSize:10 }}>🗑</button>
                  </div>
                  {isOP(c.system)&&<span style={{ fontSize:9, color:'var(--muted)', letterSpacing:1 }}>ver ▶</span>}
                </div>
              </div>
            );
          })}
        </div>
      </>)}

      {/* TOKENS OFICIAIS — biblioteca importada dos packs de criaturas */}
      {bestedTab==='tokens' && (()=>{
        const filteredTokens = TOKENS_LIB.filter(tk=>
          (tokenElem==='Todos'||tk.elemento===tokenElem) &&
          (!tokenSearch||tk.nome.toLowerCase().includes(tokenSearch.toLowerCase()))
        );
        const elemCol = (el)=>ELEM_COLORS[el]||'#c9a84c';
        return (<>
        <div style={{ padding:'8px 4px', display:'flex', gap:6, flexShrink:0, flexWrap:'wrap', alignItems:'center' }}>
          <input value={tokenSearch} onChange={e=>setTokenSearch(e.target.value)} placeholder="Buscar criatura…"
            style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'6px 12px', fontFamily:'Crimson Pro,serif', fontSize:14, outline:'none', flex:1, minWidth:140 }}/>
          <select value={tokenElem} onChange={e=>setTokenElem(e.target.value)}
            style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', padding:'6px 10px', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, outline:'none', cursor:'pointer' }}>
            <option value="Todos">Todos Elementos</option>
            {['Conhecimento','Energia','Medo','Morte','Sangue','Extras'].map(e=><option key={e}>{e}</option>)}
          </select>
          <span style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, color:'var(--muted)' }}>{filteredTokens.length} criaturas</span>
        </div>
        <div style={{ overflowY:'auto', flex:1, paddingRight:2 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8 }}>
            {filteredTokens.map(tk=>(
              <button key={tk.id} onClick={()=>{ setTokenVariant(0); setTokenTab('tokens'); setTokenView(tk); }}
                style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:0, cursor:'pointer', overflow:'hidden', textAlign:'left', transition:'border-color .15s, transform .15s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=elemCol(tk.elemento)+'70';e.currentTarget.style.transform='translateY(-2px)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';}}>
                <div style={{ aspectRatio:'1', background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                  <img src={tk.tokens[0].src} alt={tk.nome} loading="lazy" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }}/>
                </div>
                <div style={{ padding:'8px 10px' }}>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:11.5, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tk.nome}</div>
                  <div style={{ display:'flex', gap:6, marginTop:4, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:8.5, color:elemCol(tk.elemento), fontFamily:'Cinzel,serif', letterSpacing:1, textTransform:'uppercase' }}>{tk.elemento}</span>
                    {tk.vd && <span style={{ fontSize:8.5, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>VD {tk.vd}</span>}
                    {tk.tokens.length>1 && <span style={{ fontSize:8.5, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>{tk.tokens.length} tokens</span>}
                    {tk.ficha && (tk.homebrew
                      ? <span title="Ficha não-oficial, criada pelo Nexus" style={{ fontSize:8.5, color:'#c9a84c', fontFamily:'Cinzel,serif' }}>ficha ◆</span>
                      : <span title="Ficha do pack oficial" style={{ fontSize:8.5, color:'#70c870', fontFamily:'Cinzel,serif' }}>ficha ✓</span>)}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {filteredTokens.length===0 && (
            <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:15 }}>Nenhuma criatura encontrada.</div>
          )}
        </div>

        {/* Ficha-dossiê da criatura da biblioteca — tema animado por elemento */}
        {tokenView && (()=>{
          const fx = TOKEN_FX[tokenView.elemento] || TOKEN_FX.Extras;
          const parsed = parseFichaOP(tokenView.ficha);
          const curTok = tokenView.tokens[tokenVariant] || tokenView.tokens[0];
          /* partículas determinísticas por índice (posição/duração/atraso estáveis) */
          const parts = Array.from({length:14},(_,i)=>({
            left:(i*37+11)%94, dur:5.5+(i*1.7)%4.5, delay:(i*0.9)%6,
            size:9+(i*5)%10, glyph:fx.glyphs[i%fx.glyphs.length], drift:((i%2?1:-1)*(6+(i*3)%14)),
          }));
          return (
          <div style={{ position:'fixed', inset:0, background:`radial-gradient(80% 80% at 50% 50%, color-mix(in srgb, ${fx.c} 7%, rgba(0,0,0,0.88)), rgba(0,0,0,0.92))`, display:'flex', alignItems:'center', justifyContent:'center', zIndex:1150, padding:16 }}
            onClick={()=>setTokenView(null)}>
            <TokenFichaFX/>
            <div onClick={e=>e.stopPropagation()} className="fade"
              style={{ '--fxc':fx.c, background:'#0c0a14', border:`1px solid color-mix(in srgb, ${fx.c} 40%, transparent)`,
                borderRadius:14, width:'100%', maxWidth:560, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden',
                boxShadow:`0 24px 90px rgba(0,0,0,0.7), 0 0 40px color-mix(in srgb, ${fx.c} 18%, transparent)` }}>

              {/* HERO animado */}
              <div className={`tokfx-hero${fx.mode==='fall'?' tokfx-fall':''}${fx.beat?' tokfx-beat':''}`}>
                {fx.fog && <>
                  <div className="tokfx-fog" style={{ left:'-10%', bottom:'-18%' }}/>
                  <div className="tokfx-fog" style={{ right:'-10%', bottom:'-8%', animationDelay:'-4.5s' }}/>
                </>}
                {fx.flicker && <div className="tokfx-flick"/>}
                <div className="tokfx-shimmer"/>
                {parts.map((p,i)=>(
                  <span key={i} className="tokfx-p" aria-hidden="true"
                    style={{ left:`${p.left}%`, fontSize:p.size, '--dur':`${p.dur}s`, '--delay':`${p.delay}s`, '--drift':`${p.drift}px` }}>
                    {p.glyph}
                  </span>
                ))}
                <img className="tokfx-img" src={curTok.src} alt={tokenView.nome}/>
                <button onClick={()=>setTokenView(null)} aria-label="Fechar"
                  style={{ position:'absolute', top:10, right:12, zIndex:3, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:7, color:'rgba(255,255,255,0.85)', cursor:'pointer', padding:'5px 11px', fontFamily:'Cinzel,serif', fontSize:10, backdropFilter:'blur(4px)' }}>✕</button>
                {/* nome sobre o hero */}
                <div style={{ position:'absolute', left:0, right:0, bottom:0, padding:'26px 18px 12px', background:'linear-gradient(to top, rgba(6,4,10,0.92), transparent)', zIndex:2 }}>
                  <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:'clamp(17px,3vw,23px)', color:'#fff', lineHeight:1.15,
                    textShadow:`0 0 22px color-mix(in srgb, ${fx.c} 70%, transparent), 0 2px 8px rgba(0,0,0,0.9)` }}>{tokenView.nome}</div>
                  <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                    <span style={{ fontFamily:'Cinzel,serif', fontSize:8.5, letterSpacing:1.4, textTransform:'uppercase', color:fx.c,
                      padding:'3px 9px', borderRadius:20, background:'rgba(0,0,0,0.5)', border:`1px solid color-mix(in srgb, ${fx.c} 45%, transparent)` }}>
                      ◈ {tokenView.elemento}
                    </span>
                    {tokenView.vd && <span style={{ fontFamily:'Cinzel,serif', fontSize:8.5, letterSpacing:1.4, textTransform:'uppercase', color:'rgba(255,255,255,0.8)', padding:'3px 9px', borderRadius:20, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.16)' }}>VD {tokenView.vd}</span>}
                    {tokenView.homebrew && <span title="Ficha não-oficial, criada pelo Nexus" style={{ fontFamily:'Cinzel,serif', fontSize:8.5, letterSpacing:1.4, textTransform:'uppercase', color:'#c9a84c', padding:'3px 9px', borderRadius:20, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(201,168,76,0.4)' }}>◆ Nexus</span>}
                    <span style={{ fontFamily:'Cinzel,serif', fontSize:8.5, letterSpacing:1.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', padding:'3px 9px', borderRadius:20, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.1)' }}>{curTok.label}</span>
                  </div>
                </div>
              </div>

              <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', scrollbarWidth:'thin' }}>
                {/* stats extraídos da ficha */}
                {parsed.stats.length>0 && (
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14, '--fxc':fx.c }}>
                    {parsed.stats.map(([l,v])=>(
                      <div key={l} className="tokfx-statpill">
                        <span style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1.5, color:'rgba(255,255,255,0.65)', textTransform:'uppercase' }}>{l}</span>
                        <span style={{ fontFamily:'Cinzel,serif', fontSize:19, fontWeight:700, color:fx.c, textShadow:`0 0 12px color-mix(in srgb, ${fx.c} 40%, transparent)` }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* variantes de token — MOLDES (bases de impressão/recorte) ficam em aba própria */}
                {tokenView.tokens.length>1 && (()=>{
                  const isMolde = (v)=>/molde/i.test(v.src)||/molde/i.test(v.label||'');
                  const idx = tokenView.tokens.map((v,i)=>({ ...v, i }));
                  const grupos = { tokens: idx.filter(v=>!isMolde(v)), moldes: idx.filter(isMolde) };
                  const ativo = grupos[tokenTab].length ? tokenTab : 'tokens';
                  return (<>
                  {grupos.moldes.length>0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, padding:'8px 10px', borderRadius:10,
                      background:'rgba(255,255,255,0.04)', border:`1px solid color-mix(in srgb, ${fx.c} 25%, transparent)` }}>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:'var(--muted)', flexShrink:0 }}>Galeria:</span>
                      {[['tokens',`◉ Tokens (${grupos.tokens.length})`],['moldes',`▤ Moldes (${grupos.moldes.length})`]].map(([id,lbl])=>(
                        <button key={id} onClick={()=>{ setTokenTab(id); const g=grupos[id]; if(g.length) setTokenVariant(g[0].i); }}
                          style={{ flex:1, padding:'9px 14px', borderRadius:8, cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:11.5, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase',
                            background: ativo===id?fx.c:'transparent',
                            border: ativo===id?`1px solid ${fx.c}`:'1px solid var(--border)',
                            color: ativo===id?'#0c0a14':'var(--muted2)',
                            boxShadow: ativo===id?`0 0 16px color-mix(in srgb, ${fx.c} 55%, transparent)`:'none',
                            transition:'all .15s' }}
                          onMouseEnter={e=>{ if(ativo!==id) e.currentTarget.style.color='#fff'; }}
                          onMouseLeave={e=>{ e.currentTarget.style.color=ativo===id?'#0c0a14':'var(--muted2)'; }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:8, marginBottom:12, scrollbarWidth:'thin' }}>
                    {grupos[ativo].map((v)=>(
                      <button key={v.src} onClick={()=>setTokenVariant(v.i)} title={v.label}
                        style={{ width:54, height:54, flexShrink:0, borderRadius:8, padding:3, cursor:'pointer', background:'rgba(0,0,0,0.4)',
                          border: v.i===tokenVariant?`2px solid ${fx.c}`:'1px solid var(--border)',
                          boxShadow: v.i===tokenVariant?`0 0 12px color-mix(in srgb, ${fx.c} 45%, transparent)`:'none', transition:'all .15s' }}>
                        <img src={v.src} alt={v.label} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
                      </button>
                    ))}
                  </div>
                  </>);
                })()}
                {/* ficha em seções */}
                {parsed.sections.length>0 ? parsed.sections.map((sec,si)=>(
                  <div key={si} style={{ marginBottom:16 }}>
                    {sec.title && (
                      <div style={{ fontFamily:'Cinzel,serif', fontSize:13, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:fx.c,
                        borderBottom:`1px solid color-mix(in srgb, ${fx.c} 40%, transparent)`, paddingBottom:6, marginBottom:10,
                        textShadow:`0 0 14px color-mix(in srgb, ${fx.c} 40%, transparent)` }}>{sec.title}</div>
                    )}
                    {sec.lines.map((ln,li)=>{
                      const m = ln.match(/^([A-ZÀ-Úa-zà-ú][\wÀ-ú' ,()-]{2,44})[.:]\s+(.{10,})/);
                      return (
                        <p key={li} style={{ fontFamily:'Crimson Pro,serif', fontSize:16.5, color:'rgba(240,235,245,0.92)', lineHeight:1.7, margin:'0 0 9px' }}>
                          {m ? <><strong style={{ color:'#fff', fontFamily:'Cinzel,serif', fontSize:13.5 }}>{m[1]}.</strong> {m[2]}</> : ln}
                        </p>
                      );
                    })}
                  </div>
                )) : (
                  <div style={{ textAlign:'center', padding:'22px 12px', color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:14, fontStyle:'italic' }}>
                    Este pack não trouxe ficha em texto — só os tokens. Adicione ao bestiário e preencha os atributos.
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:8, padding:'12px 16px', borderTop:`1px solid color-mix(in srgb, ${fx.c} 25%, transparent)`, flexShrink:0, justifyContent:'flex-end', background:'rgba(0,0,0,0.3)' }}>
                <button onClick={()=>setTokenView(null)} style={{ padding:'8px 16px', borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1 }}>Fechar</button>
                <button onClick={()=>addFromToken(tokenView, tokenVariant)}
                  style={{ padding:'8px 18px', borderRadius:7, cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1,
                    border:`1px solid color-mix(in srgb, ${fx.c} 55%, transparent)`, background:`color-mix(in srgb, ${fx.c} 20%, transparent)`,
                    color:'#fff', textShadow:`0 0 10px color-mix(in srgb, ${fx.c} 60%, transparent)`, transition:'all .18s' }}
                  onMouseEnter={e=>e.currentTarget.style.background=`color-mix(in srgb, ${fx.c} 34%, transparent)`}
                  onMouseLeave={e=>e.currentTarget.style.background=`color-mix(in srgb, ${fx.c} 20%, transparent)`}>
                  + Adicionar ao Bestiário
                </button>
              </div>
            </div>
          </div>
          );
        })()}
        </>);
      })()}

      {/* RITUAIS */}
      {bestedTab==='rituais' && (<>
          <div style={{ padding:'8px 4px', display:'flex', gap:6, flexShrink:0, flexWrap:'wrap' }}>
            <input value={ritualSearch} onChange={e=>setRitualSearch(e.target.value)} placeholder="Buscar ritual…"
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'5px 10px', fontFamily:'Crimson Pro,serif', fontSize:13, outline:'none', flex:1, minWidth:120 }}/>
            <select value={ritualElem} onChange={e=>setRitualElem(e.target.value)}
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', padding:'5px 8px', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, outline:'none', cursor:'pointer' }}>
              <option value="Todos">Todos Elementos</option>
              {['Conhecimento','Energia','Morte','Sangue','Medo'].map(e=><option key={e}>{e}</option>)}
            </select>
            <select value={ritualCirc} onChange={e=>setRitualCirc(Number(e.target.value))}
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', padding:'5px 8px', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, outline:'none', cursor:'pointer' }}>
              <option value={0}>Todos Círculos</option>
              {[1,2,3,4].map(c=><option key={c} value={c}>{c}° Círculo</option>)}
            </select>
          </div>
          <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:4, padding:'0 4px 8px' }}>
            {filteredRituais.length===0 && (
              <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:14 }}>Nenhum ritual encontrado.</div>
            )}
            {filteredRituais.map((r,i)=>{
              const rKey = r.id || (r.elemento+'|'+r.nome+'|'+r.circulo);
              const exp = ritualExp===rKey;
              const ec = ELEM_COLORS[capElem(r.elemento)]||OPC;
              return (
                <div key={rKey+i} style={{ background:'var(--card)', border:`1px solid ${exp ? ec+'55' : 'var(--border)'}`, borderRadius:8, overflow:'hidden', flexShrink:0 /* sem shrink: overflow:hidden zera o min-height e o flex column comprimia os cards em listras */ }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', cursor:'pointer' }} onClick={()=>setRitualExp(exp?null:rKey)}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:ec, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:12, color:'var(--text)' }}>{r.nome}</span>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:9, color:ec, marginLeft:8, letterSpacing:1 }}>{capElem(r.elemento)}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:9, color:'var(--muted)', letterSpacing:1 }}>{r.circulo}° circ.</span>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:9, color:OPC }}>{CUSTO_CIRCULO[r.circulo]} PE</span>
                      <span style={{ fontSize:11, color:'var(--muted)' }}>{exp?'∧':'∨'}</span>
                    </div>
                  </div>
                  {exp && (
                    <div style={{ padding:'0 12px 12px', borderTop:'1px solid var(--border)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px', padding:'8px 0', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>
                        <div><span style={{ color:'var(--muted)' }}>EXECUÇÃO </span><span style={{ color:'var(--text)' }}>{r.execucao}</span></div>
                        <div><span style={{ color:'var(--muted)' }}>ALCANCE </span><span style={{ color:'var(--text)' }}>{r.alcance}</span></div>
                        <div><span style={{ color:'var(--muted)' }}>ALVO </span><span style={{ color:'var(--text)' }}>{r.alvo}</span></div>
                        <div><span style={{ color:'var(--muted)' }}>DURAÇÃO </span><span style={{ color:'var(--text)' }}>{r.duracao}</span></div>
                        {r.resistencia&&r.resistencia!=='-'&&r.resistencia!=='—'&&<div style={{ gridColumn:'1/-1' }}><span style={{ color:'var(--muted)' }}>RESISTÊNCIA </span><span style={{ color:'var(--text)' }}>{r.resistencia}</span></div>}
                      </div>
                      <div style={{ fontFamily:'Crimson Pro,serif', fontSize:13, color:'rgba(255,255,255,0.85)', lineHeight:1.6, marginTop:4 }}
                        dangerouslySetInnerHTML={{ __html: r.descricao || r.efeito || '' }} />
                      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                        <button onClick={()=>doRoll('1d20')} title="Rolar 1d20 para conjurar"
                          style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:5, border:`1px solid ${ec}44`, background:`${ec}11`, color:ec, cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
                          1d20
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      </>)}

      {/* CONDIÇÕES */}
      {bestedTab==='condicoes' && (
        <div style={{ overflowY:'auto', flex:1, padding:'8px 4px' }}>
          <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:2, color:'var(--muted)', textTransform:'uppercase', padding:'4px 2px 10px' }}>Referência de Condições — Ordem Paranormal</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {OP_CONDICOES.map(c=>(
              <div key={c.nome} style={{ display:'flex', alignItems:'flex-start', gap:10, background:'var(--card)', border:`1px solid ${c.cor}33`, borderRadius:8, padding:'10px 12px' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:c.cor, flexShrink:0, marginTop:4 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:11, color:c.cor, letterSpacing:1, marginBottom:3 }}>{c.nome}</div>
                  <div style={{ fontFamily:'Crimson Pro,serif', fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.5 }}>{c.descricao}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REGRAS (spec 0024 — compêndio de referência, como Condições) */}
      {bestedTab==='regras' && (
        <div style={{ overflowY:'auto', flex:1, padding:'8px 4px' }}>
          <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:2, color:'var(--muted)', textTransform:'uppercase', padding:'4px 2px 10px' }}>Regras Básicas — Ordem Paranormal (material não oficial, parafraseado)</div>
          {[['testes','Testes e Dificuldade'],['acoes','Ações de Combate'],['manobras','Manobras'],['recursos','Recursos e Dano'],['interludio','Interlúdio'],['rituais','Rituais — Regras Gerais']].map(([sec,titulo])=>(
            <div key={sec} style={{ marginBottom:16 }}>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:11, color:OPC, letterSpacing:2, textTransform:'uppercase', borderBottom:'1px solid var(--border)', padding:'4px 2px 6px', marginBottom:8 }}>{titulo}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {REGRAS_OFICIAIS.filter(r=>r.secao===sec).map(r=>(
                  <div key={r.id} style={{ display:'flex', alignItems:'flex-start', gap:10, background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:'Cinzel,serif', fontSize:11, color:'var(--text)', letterSpacing:1, marginBottom:3 }}>{r.nome}</div>
                      <div style={{ fontFamily:'Crimson Pro,serif', fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.5 }}>{r.descricao}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ARMAS */}
      {bestedTab==='armas' && (<>
          <div style={{ padding:'8px 4px 4px', flexShrink:0 }}>
            <select value={armaFilter} onChange={e=>setArmaFilter(e.target.value)}
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', padding:'5px 8px', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, outline:'none', cursor:'pointer' }}>
              <option value="Todos">Todas Proficiências</option>
              {['Armas Táticas','Armas de Fogo','Armas Pesadas'].map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ overflowY:'auto', flex:1, padding:'4px 4px 8px' }}>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:2, color:'var(--muted)', textTransform:'uppercase', padding:'4px 2px 8px' }}>Tabela de Armas — Ordem Paranormal</div>
            {['Armas Táticas','Armas de Fogo','Armas Pesadas'].filter(p=>armaFilter==='Todos'||armaFilter===p).map(prof=>{
              /* Mesmos dados oficiais da ficha (spec 0025 — fonte única). */
              const armas = ITENS_LIB.filter(a=>a.tipo==='arma'&&a.proficiencia===prof);
              return (
                <div key={prof} style={{ marginBottom:16 }}>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:2, color:OPC, textTransform:'uppercase', marginBottom:6, borderBottom:`1px solid ${OPC}33`, paddingBottom:4 }}>{prof}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {armas.map(a=>(
                      <div key={a.id} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, padding:'7px 10px', alignItems:'center' }}>
                        <div>
                          <div style={{ fontFamily:'Cinzel,serif', fontSize:11, color:'var(--text)' }}>{a.nome}</div>
                          <div style={{ fontFamily:'Cinzel,serif', fontSize:8, color:'var(--muted)', letterSpacing:1, marginTop:1 }}>
                            {a.tipo_arma} · {a.empunhadura}{a.alcance&&a.alcance!=='—'?` · ${a.alcance}`:''} · Cat. {a.categoria} · {a.espacos} esp.
                          </div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontFamily:'Cinzel,serif', fontSize:13, color:'var(--text)', fontWeight:600 }}>{a.dano}</div>
                          <div style={{ fontFamily:'Cinzel,serif', fontSize:8, color:'var(--muted)', letterSpacing:1 }}>
                            {a.tipo_dano}{(a.critico<20||a.multiplicador>2)?` · crít. ${a.critico}${a.critico<20?'+':''}/×${a.multiplicador}`:''}
                          </div>
                        </div>
                        <button onClick={()=>doRoll(a.dano)} title={`Rolar dano de ${a.nome}`}
                          style={{ background:'transparent', border:'none', cursor:'pointer', padding:'2px 4px', color:OPC, display:'flex', alignItems:'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Modificações (spec 0026 — tabelas 3.5/3.7/3.9 do livro, parafraseadas) */}
            <div style={{ marginTop:8, marginBottom:16 }}>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:2, color:OPC, textTransform:'uppercase', marginBottom:4, borderBottom:`1px solid ${OPC}33`, paddingBottom:4 }}>Modificações</div>
              <div style={{ fontFamily:'Crimson Pro,serif', fontSize:12, color:'var(--muted)', marginBottom:8 }}>
                Cada modificação aumenta a categoria do item em I. Modificações iguais não se acumulam.
              </div>
              {[['armas','Armas (corpo a corpo e disparo)'],['armas_fogo','Armas de Fogo'],['municao','Munições'],['protecao','Proteções'],['acessorio','Acessórios']].map(([apl,titulo])=>(
                <div key={apl} style={{ marginBottom:10 }}>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase', margin:'6px 0 4px' }}>{titulo}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {MODS_LIB.filter(m=>m.aplica===apl).map(m=>(
                      <div key={m.id} style={{ display:'flex', gap:8, background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 10px', alignItems:'baseline' }}>
                        <span style={{ fontFamily:'Cinzel,serif', fontSize:10, color:'var(--text)', whiteSpace:'nowrap' }}>{m.nome}</span>
                        <span style={{ fontFamily:'Crimson Pro,serif', fontSize:12, color:'rgba(255,255,255,0.75)', lineHeight:1.4 }}>{m.efeito}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
      </>)}

      {/* Add/Edit Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:24, width: isOP(form.system)?560:460, maxHeight:'90vh', display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:15, color:'var(--gold)', flexShrink:0 }}>
              {modal==='new' ? 'Nova Criatura' : `Editar: ${modal.name}`}
            </div>
            {modal==='new' && (
              <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
                <span style={sL}>Sistema</span>
                <select value={BESTIARY_SYSTEMS.includes(form.system) ? form.system : '__custom__'} onChange={e=>{
                  const sys=e.target.value;
                  if (sys==='__custom__') setForm({...EMPTY_CREATURE, system:'', name:form.name});
                  else if (isOP(sys)) setForm({...EMPTY_OP_CREATURE, name:form.name});
                  else setForm({...EMPTY_CREATURE, system:sys, name:form.name});
                }} style={sI}>
                  {BESTIARY_SYSTEMS.map(s=><option key={s}>{s}</option>)}
                  <option value="__custom__">Outro (personalizado)…</option>
                </select>
                {!BESTIARY_SYSTEMS.includes(form.system) && (
                  <input value={form.system} onChange={e=>setForm(p=>({...p,system:e.target.value}))}
                    placeholder="Ex: Call of Cthulhu, Vampiro, Pathfinder…"
                    style={{...sI, marginTop:4}}/>
                )}
              </div>
            )}
            <div style={{ overflowY:'auto', flex:1, paddingRight:4, display:'flex', flexDirection:'column', gap:10 }}>
              {isOP(form.system) ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <SecF>Identificação</SecF>
                  {fld('Nome','name',{placeholder:'Nome da criatura'})}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {fld('VD','vd',{placeholder:'ex: 400'})}
                    {fld('Categoria','category',{placeholder:'ex: Relíquia - Médio'})}
                  </div>
                  {fld('URL da Imagem','imageUrl',{placeholder:'https://...'})}
                  <SecF>Pontos de Vida</SecF>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {fld('HP Máximo','hpMax',{placeholder:'ex: 1666'})}
                    {fld('HP Atual','hpCurrent',{placeholder:'igual ao máximo'})}
                  </div>
                  <SecF>Atributos</SecF>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
                    {[['AGI','agi'],['FOR','atFor'],['INT','atInt'],['PRE','pre'],['VIG','vig']].map(([l,k])=>(
                      <div key={k} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <span style={{...sL,textAlign:'center'}}>{l}</span>
                        <input value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                          placeholder="0" style={{...sI,textAlign:'center',fontFamily:'Cinzel,serif',fontSize:16,fontWeight:700}}/>
                      </div>
                    ))}
                  </div>
                  <SecF>Combate Básico</SecF>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {fld('Defesa','defesa',{placeholder:'ex: 66'})}
                    {fld('Deslocamento','deslocamento',{placeholder:'ex: 18m / 12q'})}
                  </div>
                  <SecF>Perícias</SecF>
                  {[['PERCEPÇÃO','perPercepcao'],['INICIATIVA','perIniciativa'],['FORTITUDE','perFortitude'],['REFLEXOS','perReflexos'],['VONTADE','perVontade']].map(([l,k])=>(
                    <div key={k} style={{ display:'grid', gridTemplateColumns:'110px 1fr', gap:8, alignItems:'center' }}>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, color:'rgba(255,255,255,0.6)', textTransform:'uppercase' }}>{l}</span>
                      <input value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                        placeholder="ex: 6d20+25" style={{...sI,fontFamily:'monospace',fontSize:12}}/>
                    </div>
                  ))}
                  <SecF>Propriedades</SecF>
                  {fld('Sentidos','sentidos',{textarea:true,rows:2})}
                  {fld('Elementos Secundários','elementosSecundarios',{textarea:true,rows:2})}
                  {fld('Imunidades','imunidades',{textarea:true,rows:2})}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                    {fld('Res. Balístico','resBalistico',{placeholder:'20'})}
                    {fld('Res. Impacto','resImpacto',{placeholder:'20'})}
                    {fld('Res. Perfuração','resPerfuracao',{placeholder:'20'})}
                  </div>
                  {fld('Vulnerabilidades','vulnerabilidades',{textarea:true,rows:2})}
                  <SecF>Combate</SecF>
                  {fld('Presença Perturbadora','presencaPerturbadora',{textarea:true,rows:2,placeholder:'ex: DT 45 - 10d8 mental'})}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={sL}>AÇÕES</span>
                    <button onClick={opAddAcao} style={{ padding:'3px 10px', borderRadius:5, border:`1px solid rgba(176,48,216,0.4)`, background:'rgba(176,48,216,0.12)', color:'#e0c8ff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>+ Ação</button>
                  </div>
                  {(form.acoes||[]).map((acao,i)=>(
                    <div key={i} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, padding:10 }}>
                      <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                        <select value={acao.tipo} onChange={e=>opSetAcao(i,'tipo',e.target.value)}
                          style={{...sI,width:'auto',flex:'0 0 auto',fontFamily:'Cinzel,serif',fontSize:9}}>
                          {['PADRÃO','PADRÃO COMPLETO','LIVRE','MOVIMENTO','REAÇÃO'].map(t=><option key={t}>{t}</option>)}
                        </select>
                        <input value={acao.nome} onChange={e=>opSetAcao(i,'nome',e.target.value)} placeholder="Nome da ação" style={{...sI,flex:1}}/>
                        <button onClick={()=>opRemAcao(i)} style={{ padding:'4px 7px', borderRadius:4, border:'1px solid rgba(200,80,80,0.3)', background:'transparent', color:'#e07070', cursor:'pointer', fontSize:10, flexShrink:0 }}>✕</button>
                      </div>
                      <div style={{ display:'flex', gap:14, marginBottom:8 }}>
                        {[['texto','Descrição'],['ataques','Ataques']].map(([v,l])=>(
                          <label key={v} style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase' }}>
                            <input type="radio" checked={acao.conteudo===v} onChange={()=>opSetAcao(i,'conteudo',v)} style={{ cursor:'pointer' }}/>
                            {l}
                          </label>
                        ))}
                      </div>
                      {acao.conteudo==='texto' ? (
                        <textarea value={acao.descricao||''} onChange={e=>opSetAcao(i,'descricao',e.target.value)}
                          placeholder="Descrição da ação..." rows={3} style={sT}/>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          {(acao.ataques||[]).map((atk,j)=>(
                            <div key={j} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:6, padding:8 }}>
                              <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                                <input value={atk.arma} onChange={e=>opSetAtk(i,j,'arma',e.target.value)} placeholder="Nome da arma"
                                  style={{...sI,flex:2,fontFamily:'Cinzel,serif',fontSize:10,textTransform:'uppercase'}}/>
                                <input value={atk.alcance} onChange={e=>opSetAtk(i,j,'alcance',e.target.value)} placeholder="Alcance"
                                  style={{...sI,flex:1,fontSize:10}}/>
                                <input value={atk.hits} onChange={e=>opSetAtk(i,j,'hits',e.target.value)} placeholder="Hits"
                                  style={{...sI,width:52,flex:'none',fontSize:10}}/>
                                <button onClick={()=>opRemAtk(i,j)} style={{ padding:'4px 7px', borderRadius:4, border:'1px solid rgba(200,80,80,0.3)', background:'transparent', color:'#e07070', cursor:'pointer', fontSize:10, flexShrink:0 }}>✕</button>
                              </div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                                <div><span style={sL}>Teste</span><input value={atk.teste} onChange={e=>opSetAtk(i,j,'teste',e.target.value)} placeholder="6d20+45" style={{...sI,fontFamily:'monospace',fontSize:11}}/></div>
                                <div><span style={sL}>Dano</span><input value={atk.dano} onChange={e=>opSetAtk(i,j,'dano',e.target.value)} placeholder="2d10 Sangue" style={{...sI,fontFamily:'monospace',fontSize:11}}/></div>
                                <div><span style={sL}>Crítico</span><input value={atk.critico} onChange={e=>opSetAtk(i,j,'critico',e.target.value)} placeholder="x3" style={{...sI,fontFamily:'monospace',fontSize:11}}/></div>
                              </div>
                            </div>
                          ))}
                          <button onClick={()=>opAddAtk(i)} style={{ padding:'5px 10px', borderRadius:5, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)', color:'var(--muted)', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>+ Ataque</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
                    <span style={sL}>PODERES</span>
                    <button onClick={opAddPod} style={{ padding:'3px 10px', borderRadius:5, border:`1px solid rgba(176,48,216,0.4)`, background:'rgba(176,48,216,0.12)', color:'#e0c8ff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>+ Poder</button>
                  </div>
                  {(form.poderes||[]).map((p,i)=>(
                    <div key={i} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, padding:10 }}>
                      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                        <input value={p.nome} onChange={e=>opSetPod(i,'nome',e.target.value)} placeholder="Nome do poder" style={{...sI,flex:1}}/>
                        <button onClick={()=>opRemPod(i)} style={{ padding:'4px 7px', borderRadius:4, border:'1px solid rgba(200,80,80,0.3)', background:'transparent', color:'#e07070', cursor:'pointer', fontSize:10, flexShrink:0 }}>✕</button>
                      </div>
                      <textarea value={p.desc} onChange={e=>opSetPod(i,'desc',e.target.value)} placeholder="Descrição..." rows={3} style={sT}/>
                    </div>
                  ))}
                  <SecF>Descrição</SecF>
                  {fld('Texto de Lore','descricaoTexto',{textarea:true,rows:5})}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={sL}>SEÇÕES / ENIGMAS</span>
                    <button onClick={opAddEni} style={{ padding:'3px 10px', borderRadius:5, border:`1px solid rgba(176,48,216,0.4)`, background:'rgba(176,48,216,0.12)', color:'#e0c8ff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>+ Seção</button>
                  </div>
                  {(form.enigmas||[]).map((e,i)=>(
                    <div key={i} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, padding:10 }}>
                      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                        <input value={e.titulo} onChange={ev=>opSetEni(i,'titulo',ev.target.value)} placeholder="Título (ex: Enigma do Medo)"
                          style={{...sI,flex:1,fontFamily:'Cinzel Decorative,serif',fontSize:11}}/>
                        <button onClick={()=>opRemEni(i)} style={{ padding:'4px 7px', borderRadius:4, border:'1px solid rgba(200,80,80,0.3)', background:'transparent', color:'#e07070', cursor:'pointer', fontSize:10, flexShrink:0 }}>✕</button>
                      </div>
                      <textarea value={e.texto} onChange={ev=>opSetEni(i,'texto',ev.target.value)} placeholder="Texto..." rows={4} style={sT}/>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {modal!=='new' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <span style={sL}>Sistema</span>
                      <select value={BESTIARY_SYSTEMS.includes(form.system) ? form.system : '__custom__'}
                        onChange={e=>{ const v=e.target.value; setForm(p=>({...p,system:v==='__custom__'?'':v})); }} style={sI}>
                        {BESTIARY_SYSTEMS.map(s=><option key={s}>{s}</option>)}
                        <option value="__custom__">Outro (personalizado)…</option>
                      </select>
                      {!BESTIARY_SYSTEMS.includes(form.system) && (
                        <input value={form.system} onChange={e=>setForm(p=>({...p,system:e.target.value}))}
                          placeholder="Ex: Call of Cthulhu, Vampiro, Pathfinder…"
                          style={{...sI, marginTop:4}}/>
                      )}
                    </div>
                  )}
                  {fld('Nome','name')}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                    {fld('HP','hp',{placeholder:'ex: 45'})}
                    {fld('CA / Defesa','ac',{placeholder:'ex: 14'})}
                    {fld('Iniciativa','initiative',{placeholder:'ex: +3'})}
                  </div>
                  {fld('Descrição','description',{textarea:true,rows:3})}
                  {fld('Ataques / Habilidades','attacks',{textarea:true,rows:4})}
                </>
              )}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexShrink:0, marginTop:4 }}>
              <button onClick={()=>setModal(null)} style={{ padding:'7px 16px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:11 }}>Cancelar</button>
              <button onClick={saveCreature} disabled={saving||!form.name.trim()}
                style={{ padding:'7px 16px', borderRadius:6, border:`1px solid rgba(176,48,216,0.5)`, background:'rgba(176,48,216,0.2)', color:'#e0c8ff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:11, opacity:saving||!form.name.trim()?0.5:1 }}>
                {saving?'Salvando…':'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   PAINEL DO MESTRE (GM)
   Opera sobre as fichas compartilhadas da campanha (sharedSheets); o mestre
   já tem permissão de editá-las pelas regras do Firestore. Conceder Medo,
   rolagens privadas e narração global — tudo via os padrões existentes.
═══════════════════════════════ */
function MestrePanel({ campaign, uid, userName, userPhoto }) {
  const [sheets, setSheets] = useState([]);
  const [editing, setEditing] = useState(null);        // sheetId em edição de elemento
  const [confirmMedo, setConfirmMedo] = useState(null); // { sheetId, name }
  const [dice, setDice] = useState("");
  const [gmLog, setGmLog] = useState([]);
  const [narr, setNarr] = useState("");
  const [narrSent, setNarrSent] = useState(false);
  const [narrTarget, setNarrTarget] = useState("all"); // "all" | "specific"
  const [narrTargetIds, setNarrTargetIds] = useState(new Set());
  const [narrImage, setNarrImage] = useState(""); // base64
  const narrImageInputRef = useRef(null);
  const [flashedIds, setFlashedIds] = useState(new Set());
  const prevSheetsRef = useRef({});

  useEffect(() => {
    const qy = query(collection(db, "campaigns", campaign.id, "sharedSheets"));
    return onSnapshot(qy, snap => {
      const newSheets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const changed = new Set();
      newSheets.forEach(s => {
        const cd = s.characterData || {};
        const prev = prevSheetsRef.current[s.id];
        const cur = { pv: cd.pv, san: cd.san, pe: cd.pe, avatar: getActiveAvatar(cd), name: cd.form?.personagem };
        if (prev && (prev.pv !== cur.pv || prev.san !== cur.san || prev.pe !== cur.pe ||
            prev.avatar !== cur.avatar || prev.name !== cur.name)) {
          changed.add(s.id);
        }
        prevSheetsRef.current[s.id] = cur;
      });
      if (changed.size > 0) {
        setFlashedIds(prev => new Set([...prev, ...changed]));
        setTimeout(() => setFlashedIds(prev => {
          const next = new Set(prev);
          changed.forEach(id => next.delete(id));
          return next;
        }), 1500);
      }
      setSheets(newSheets);
    }, () => {});
  }, [campaign.id]);

  const applyElement = async (sheetId, el) => {
    try {
      await updateDoc(doc(db, "campaigns", campaign.id, "sharedSheets", sheetId), {
        "characterData.elementoAfinidade": el,
        "characterData.elementoGmOverride": el === "medo",
        "characterData.elementoConcedidoPor": el === "medo" ? uid : null,
        "characterData.elementoEscolhidoEm": Date.now(),
      });
      if (el === "medo") {
        const s = sheets.find(x => x.id === sheetId);
        const nm = s?.characterData?.form?.personagem || s?.userName || "Agente";
        fsSendMessage(campaign.id, uid, userName, userPhoto, `⟨ O Mestre concedeu o Elemento Medo a ${nm}. Algo mudou nele… ⟩`, "text");
      }
    } catch (e) { console.error(e); }
    setEditing(null); setConfirmMedo(null);
  };

  const chooseEl = (sheetId, el, name) => {
    if (el === "medo") setConfirmMedo({ sheetId, name });
    else applyElement(sheetId, el);
  };

  const doRoll = (reveal) => {
    const r = rollDice(dice);
    if (!r) return;
    setGmLog(l => [{ id: Date.now(), expr: r.expr, rolls: r.rolls, total: r.total, reveal }, ...l].slice(0, 12));
    if (reveal) fsSendMessage(campaign.id, uid, userName, userPhoto, `🎲 Mestre rolou ${r.expr} → [${r.rolls.join(",")}] = ${r.total}`, "roll", { expr: r.expr, rolls: r.rolls, total: r.total, sides: r.sides, count: r.count });
    setDice("");
  };

  const sendNarr = async (testMode = false) => {
    const text = narr.trim();
    if (!text && !narrImage) return;
    const payload = { text, image: narrImage || null, ts: Date.now(), by: userName };
    try {
      if (testMode) {
        await updateDoc(doc(db, "campaigns", campaign.id), { narracaoTest: { ...payload, test: true } });
      } else if (narrTarget === "all") {
        await updateDoc(doc(db, "campaigns", campaign.id), { narracao: payload });
      } else {
        const updates = {};
        narrTargetIds.forEach(pid => { updates[`narracaoPrivada.${pid}`] = payload; });
        if (Object.keys(updates).length > 0) await updateDoc(doc(db, "campaigns", campaign.id), updates);
      }
    } catch(e) { console.error(e); }
    setNarr(""); setNarrImage(""); setNarrSent(true); setTimeout(() => setNarrSent(false), 2500);
  };

  const handleNarrImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { setNarrImage(await resizeCoverImage(file)); } catch(_) {}
    e.target.value = "";
  };

  const toggleNarrTarget = (pid) => setNarrTargetIds(prev => {
    const next = new Set(prev); next.has(pid) ? next.delete(pid) : next.add(pid); return next;
  });

  const lbl = { fontFamily: "Cinzel,serif", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" };
  const card = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 14 };
  const inp = { background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 6, color: "#eee", padding: "8px 10px", fontFamily: "'Share Tech Mono',monospace", width: "100%" };

  const liveSheets = sheets.filter(s => s.isLive);

  return (
    <div className="fade" style={{ overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── MESA AO VIVO ── */}
      {liveSheets.length > 0 && (
        <div style={{ ...card, borderColor: "rgba(74,222,128,0.25)", background: "rgba(0,20,10,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ ...lbl, color: "#4ade80", fontSize: 11 }}>Mesa ao Vivo</span>
            <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:"0.12em", color:"#4ade80",
              padding:"2px 10px 2px 8px", borderRadius:20, background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.35)",
              animation:"live-badge-glow 2s ease-in-out infinite" }}>
              <span style={{ animation:"live-dot 1s step-end infinite", fontSize:9 }}>●</span>
              AO VIVO
            </span>
            <span style={{ ...lbl, marginLeft:"auto" }}>{liveSheets.length} agente{liveSheets.length!==1?"s":""}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:10 }}>
            {liveSheets.map(s => {
              const cd = s.characterData || {};
              const pv = Number(cd.pv ?? cd.pvMax ?? 0), pvMax = Number(cd.pvMax ?? 1);
              const san = Number(cd.san ?? cd.sanMax ?? 0), sanMax = Number(cd.sanMax ?? 1);
              const pe = Number(cd.pe ?? cd.peMax ?? 0), peMax = Number(cd.peMax ?? 1);
              const pvPct = pvMax > 0 ? pv/pvMax : 1;
              const sanPct = sanMax > 0 ? san/sanMax : 1;
              const pePct = peMax > 0 ? pe/peMax : 1;
              const el = cd.elementoAfinidade;
              const elT = getElementTheme(el);
              const accent = el ? elT.accent : "var(--gold)";
              const pvCol = pvPct > 0.6 ? "#43a047" : pvPct > 0.3 ? "#fbc02d" : "#e53935";
              const sanCol = el ? elT.accent : "#7b1fa2";
              const isUnconscious = pv <= 0;
              const isCritical   = !isUnconscious && pvPct < 0.3;
              const isUnstable   = sanPct < 0.3;
              const isExhausted  = pePct < 0.2;
              const isStable     = !isUnconscious && !isCritical && !isUnstable && !isExhausted;
              const isFlashing   = flashedIds.has(s.id);
              const cardBorderColor = isFlashing ? "#4ade80"
                : isUnconscious ? "#888"
                : isCritical ? "#e53935"
                : isUnstable ? "#7b1fa2"
                : accent + "30";
              const cardGlow = isFlashing ? "0 0 14px rgba(74,222,128,0.35)"
                : isCritical ? "0 0 12px rgba(229,57,53,0.3)"
                : isUnconscious ? "0 0 8px rgba(136,136,136,0.2)"
                : "none";
              const name = cd.form?.personagem || s.characterName || "Agente";
              const classe = cd.classe?.name || cd.classe?.id || null;
              return (
                <div key={s.id} style={{
                  background:"rgba(0,0,0,0.45)",
                  border:`1px solid ${cardBorderColor}`,
                  borderRadius:8, padding:"10px 12px", display:"flex", flexDirection:"column", gap:8,
                  transition:"border-color 0.4s ease, box-shadow 0.4s ease",
                  boxShadow: cardGlow,
                  animation: (isCritical || isUnconscious) ? "op-flat-blink 2s ease-in-out infinite" : "none",
                }}>
                  {/* header: avatar + nome + badges */}
                  <div style={{ display:"flex", alignItems:"flex-start", gap:9 }}>
                    <div style={{ position:"relative", flexShrink:0 }}>
                      <div style={{ width:44, height:44, borderRadius:7, border:`2px solid ${accent}70`, overflow:"hidden",
                        background:`${accent}12`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
                        {getActiveAvatar(cd)
                          ? <img key={getActiveAvatar(cd)} src={getActiveAvatar(cd)} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                          : "🕵️"}
                      </div>
                      {isFlashing && (
                        <div style={{ position:"absolute", inset:-2, borderRadius:9,
                          border:"2px solid #4ade80", animation:"op-flat-blink 0.6s ease-in-out 2", pointerEvents:"none" }}/>
                      )}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"Cinzel,serif", fontSize:11, color:"#eee", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:3 }}>{name}</div>
                      <div style={{ fontFamily:"Cinzel,serif", fontSize:8, color:"rgba(255,255,255,0.35)", letterSpacing:"0.05em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:5 }}>
                        {s.ownerName}{classe ? ` · ${classe}` : ""}
                      </div>
                      {/* badges de alerta — múltiplos simultâneos */}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                        {isStable && (
                          <span style={{ fontFamily:"Cinzel,serif", fontSize:7, letterSpacing:"0.1em", padding:"2px 6px", borderRadius:20,
                            border:"1px solid rgba(76,175,125,0.5)", color:"#4caf7d", background:"rgba(76,175,125,0.1)" }}>ESTÁVEL</span>
                        )}
                        {isUnconscious && (
                          <span style={{ fontFamily:"Cinzel,serif", fontSize:7, letterSpacing:"0.1em", padding:"2px 6px", borderRadius:20,
                            border:"1px solid rgba(136,136,136,0.5)", color:"#aaa", background:"rgba(136,136,136,0.12)" }}>INCONSCIENTE</span>
                        )}
                        {isCritical && (
                          <span style={{ fontFamily:"Cinzel,serif", fontSize:7, letterSpacing:"0.1em", padding:"2px 6px", borderRadius:20,
                            border:"1px solid rgba(229,57,53,0.6)", color:"#ef5350", background:"rgba(229,57,53,0.15)",
                            animation:"op-flat-blink 1.2s ease-in-out infinite" }}>⚠ CRÍTICO</span>
                        )}
                        {isUnstable && (
                          <span style={{ fontFamily:"Cinzel,serif", fontSize:7, letterSpacing:"0.1em", padding:"2px 6px", borderRadius:20,
                            border:"1px solid rgba(123,31,162,0.6)", color:"#ce93d8", background:"rgba(123,31,162,0.15)",
                            animation:"op-flat-blink 1.6s ease-in-out infinite" }}>⚠ INSTÁVEL</span>
                        )}
                        {isExhausted && (
                          <span style={{ fontFamily:"Cinzel,serif", fontSize:7, letterSpacing:"0.1em", padding:"2px 6px", borderRadius:20,
                            border:"1px solid rgba(0,172,193,0.5)", color:"#80deea", background:"rgba(0,172,193,0.1)" }}>EXAUSTO</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* barras de vida */}
                  {[
                    {lbl:"PV", val:pv, max:pvMax, pct:pvPct, col:pvCol},
                    {lbl:"SAN", val:san, max:sanMax, pct:sanPct, col:sanCol},
                    {lbl:"PE", val:pe, max:peMax, pct:pePct, col:"#00acc1"},
                  ].map(({lbl:bl,val,max,pct,col})=>(
                    <div key={bl}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                        <span style={{ fontFamily:"Cinzel,serif", fontSize:7, letterSpacing:"0.1em", color:"rgba(255,255,255,0.35)", textTransform:"uppercase" }}>{bl}</span>
                        <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:col, transition:"color 0.3s" }}>{val}/{max}</span>
                      </div>
                      <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${Math.max(0,Math.min(100,pct*100))}%`,
                          background:`linear-gradient(90deg,${col}88,${col})`, boxShadow:`0 0 5px ${col}50`,
                          transition:"width 0.6s ease", borderRadius:2 }}/>
                      </div>
                    </div>
                  ))}
                  {isFlashing && (
                    <div style={{ fontFamily:"Cinzel,serif", fontSize:7, color:"#4ade80", letterSpacing:"0.1em",
                      textAlign:"right", opacity:0.8 }}>● atualizado agora</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AGENTES */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={lbl}>Agentes nesta campanha ({sheets.length})</span>
          <span style={{ ...lbl, color: "rgba(176,48,216,0.8)" }}>Código: {campaign.inviteCode}</span>
        </div>
        {sheets.length === 0 ? (
          <div style={{ ...card, color: "rgba(255,255,255,0.5)", fontFamily: "'Crimson Pro',serif" }}>Nenhuma ficha compartilhada ainda. Peça aos jogadores para compartilhar suas fichas na aba Agentes.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sheets.map(s => {
              const cd = s.characterData || {};
              const nm = cd.form?.personagem || s.userName || "Agente";
              const el = cd.elementoAfinidade;
              const elTheme = el ? ELEMENTOS[el] : null;
              return (
                <div key={s.id} style={card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "rgba(176,48,216,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {getActiveAvatar(cd) ? <img src={getActiveAvatar(cd)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#c89bff" }}>◈</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, color: "#fff" }}>{nm} <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>({s.userName})</span></div>
                      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{cd.classe?.name || "Mundano"} · NEX {cd.nex ?? 5}%</div>
                    </div>
                    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: "rgba(255,255,255,0.7)", display: "flex", gap: 10 }}>
                      <span style={{ color: "#e57373" }}>PV {cd.pv ?? "—"}/{cd.pvMax ?? "—"}</span>
                      <span style={{ color: "#b388e0" }}>SAN {cd.san ?? "—"}/{cd.sanMax ?? "—"}</span>
                      <span style={{ color: "#4dd0e1" }}>PE {cd.pe ?? "—"}/{cd.peMax ?? "—"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {elTheme ? (
                        <span title={cd.elementoGmOverride ? "Concedido pelo Mestre" : elTheme.name} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 5, border: `1px solid ${elTheme.border}`, background: `${elTheme.accent}22` }}>
                          <ElementoSymbol id={el} size={16} /><span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: elTheme.accent }}>{elTheme.name}{cd.elementoGmOverride ? " 🔒" : ""}</span>
                        </span>
                      ) : <span style={{ fontFamily: "'Crimson Pro',serif", fontStyle: "italic", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Não definido</span>}
                      <button onClick={() => setEditing(editing === s.id ? null : s.id)}
                        style={{ background: "rgba(176,48,216,0.15)", border: "1px solid rgba(176,48,216,0.4)", borderRadius: 5, color: "#d8a8ff", padding: "5px 9px", fontFamily: "'Cinzel',serif", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
                        Elemento ▾
                      </button>
                    </div>
                  </div>
                  {editing === s.id && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {Object.values(ELEMENTOS).map(e => (
                        <button key={e.id} onClick={() => chooseEl(s.id, e.id, nm)}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                            border: `1px solid ${el === e.id ? e.accent : "rgba(255,255,255,0.14)"}`, background: el === e.id ? `${e.accent}22` : "rgba(0,0,0,0.3)", color: e.accent, fontFamily: "'Share Tech Mono',monospace", fontSize: 11 }}>
                          <ElementoSymbol id={e.id} size={18} />{e.name}{e.gmOnly ? " 🔒" : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FERRAMENTAS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* ── Dados do Mestre ── */}
        <div style={{ background:"linear-gradient(135deg,rgba(30,10,50,0.7),rgba(10,5,20,0.9))", border:"1px solid rgba(176,48,216,0.2)", borderRadius:12, padding:16, display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, paddingBottom:10, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(176,48,216,0.8)" strokeWidth="1.8"><polygon points="12 2 19 7 19 17 12 22 5 17 5 7 12 2"/><path d="M5 7l7 5 7-5M12 12v10" opacity="0.5"/></svg>
            <span style={{ fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(176,48,216,0.9)" }}>Dados do Mestre</span>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <input value={dice} onChange={e => setDice(e.target.value)} onKeyDown={e => e.key==="Enter" && doRoll(false)}
              placeholder="2d6+3, 1d20…"
              style={{ flex:1, background:"rgba(0,0,0,0.5)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, color:"#e0d0ff", padding:"8px 10px", fontFamily:"'Share Tech Mono',monospace", fontSize:12, outline:"none" }}/>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => doRoll(false)} style={{ flex:1, padding:"7px", borderRadius:7, border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.6)", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1, textTransform:"uppercase", cursor:"pointer" }}>🔒 Privado</button>
            <button onClick={() => doRoll(true)} style={{ flex:1, padding:"7px", borderRadius:7, border:"1px solid rgba(176,48,216,0.55)", background:"rgba(176,48,216,0.2)", color:"#d8a8ff", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1, textTransform:"uppercase", cursor:"pointer" }}>📢 Revelar</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:130, overflowY:"auto" }}>
            {gmLog.length === 0 && <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:12, color:"rgba(255,255,255,0.25)", textAlign:"center", padding:"8px 0" }}>Nenhuma rolagem ainda</div>}
            {gmLog.map(r => (
              <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 8px", borderRadius:5, background:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:"rgba(255,255,255,0.5)" }}>{r.expr} <span style={{ color:"rgba(255,255,255,0.3)" }}>[{r.rolls.join(",")}]</span></span>
                <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:12, fontWeight:700, color: r.reveal?"#d8a8ff":"rgba(255,255,255,0.55)" }}>{r.total} {r.reveal?"📢":"🔒"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Narração Global ── */}
        <div style={{ background:"linear-gradient(135deg,rgba(20,5,35,0.8),rgba(8,4,18,0.95))", border:"1px solid rgba(176,48,216,0.25)", borderRadius:12, padding:16, display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, paddingBottom:10, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(176,48,216,0.8)" strokeWidth="1.8"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            <span style={{ fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(176,48,216,0.9)" }}>Narração Global</span>
          </div>

          {/* Destino */}
          <div style={{ display:"flex", background:"rgba(0,0,0,0.3)", borderRadius:8, padding:3, gap:3 }}>
            {[["all","🌐 Todos"],["specific","👤 Específicos"]].map(([v,l]) => (
              <button key={v} onClick={() => setNarrTarget(v)}
                style={{ flex:1, padding:"6px", borderRadius:6, border:"none", background: narrTarget===v?"rgba(176,48,216,0.35)":"transparent",
                  color: narrTarget===v?"#e8c8ff":"rgba(255,255,255,0.4)", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1,
                  textTransform:"uppercase", cursor:"pointer", transition:"all 0.2s" }}>{l}</button>
            ))}
          </div>

          {/* Seleção de players específicos */}
          {narrTarget === "specific" && (() => {
            const charByOwner = {};
            sheets.forEach(s => { charByOwner[s.ownerId] = { name: s.characterData?.form?.personagem || s.characterName, avatar: getActiveAvatar(s.characterData) }; });
            const players = (campaign.members||[]).map(id => ({ id, char: charByOwner[id] }));
            return players.length > 0 ? (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {players.map(({ id, char }) => {
                  const sel = narrTargetIds.has(id);
                  const name = char?.name || (id === uid ? "Você" : "Jogador");
                  return (
                    <label key={id} onClick={() => toggleNarrTarget(id)}
                      style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", padding:"5px 10px 5px 6px",
                        borderRadius:20, border:`1px solid ${sel?"rgba(176,48,216,0.7)":"rgba(255,255,255,0.1)"}`,
                        background: sel?"rgba(176,48,216,0.18)":"rgba(255,255,255,0.03)", transition:"all 0.18s" }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", overflow:"hidden", flexShrink:0,
                        border:`1.5px solid ${sel?"rgba(176,48,216,0.8)":"rgba(255,255,255,0.2)"}`,
                        background:"rgba(176,48,216,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {char?.avatar ? <img src={char.avatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:10 }}>👤</span>}
                      </div>
                      <span style={{ fontFamily:"Cinzel,serif", fontSize:9, color: sel?"#e8c8ff":"rgba(255,255,255,0.55)", whiteSpace:"nowrap" }}>{name}</span>
                      {sel && <span style={{ fontSize:9, color:"#b030d8" }}>✓</span>}
                    </label>
                  );
                })}
              </div>
            ) : <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:12, color:"rgba(255,255,255,0.3)", padding:"4px 0" }}>Nenhum membro na campanha</div>;
          })()}

          {/* Texto */}
          <textarea value={narr} onChange={e => setNarr(e.target.value)}
            placeholder="Escreva a narração que aparecerá na tela dos jogadores…"
            style={{ background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8,
              color:"#e8e0f0", padding:"10px 12px", fontFamily:"'Crimson Pro',serif", fontSize:14,
              lineHeight:1.5, minHeight:72, resize:"vertical", outline:"none", width:"100%", boxSizing:"border-box" }}/>

          {/* Imagem */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={() => narrImageInputRef.current?.click()}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:7,
                border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.04)",
                color:"rgba(255,255,255,0.55)", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1,
                textTransform:"uppercase", cursor:"pointer" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              Imagem
            </button>
            {narrImage && (
              <button onClick={() => setNarrImage("")}
                style={{ padding:"4px 8px", borderRadius:6, border:"1px solid rgba(255,80,80,0.35)",
                  background:"rgba(255,80,80,0.07)", color:"#f88", fontFamily:"Cinzel,serif", fontSize:9, cursor:"pointer" }}>× Remover</button>
            )}
            <input ref={narrImageInputRef} type="file" accept="image/*" hidden onChange={handleNarrImage}/>
          </div>
          {narrImage && (
            <img src={narrImage} alt="preview"
              style={{ maxWidth:"100%", maxHeight:110, borderRadius:7, objectFit:"contain",
                border:"1px solid rgba(176,48,216,0.25)", background:"rgba(0,0,0,0.3)" }}/>
          )}

          {/* Botões */}
          <div style={{ display:"flex", gap:8, marginTop:2 }}>
            <button onClick={() => sendNarr(true)} disabled={!narr.trim() && !narrImage}
              style={{ flex:1, padding:"9px 6px", borderRadius:8,
                border:`1px solid ${(narr.trim()||narrImage)?"rgba(255,200,70,0.5)":"rgba(255,255,255,0.07)"}`,
                background:(narr.trim()||narrImage)?"rgba(255,200,70,0.1)":"rgba(255,255,255,0.02)",
                color:(narr.trim()||narrImage)?"#ffd060":"rgba(255,255,255,0.25)",
                fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1, textTransform:"uppercase",
                cursor:(narr.trim()||narrImage)?"pointer":"default" }}>
              🧪 Testar
            </button>
            <button onClick={() => sendNarr(false)} disabled={!narr.trim() && !narrImage}
              style={{ flex:2, padding:"9px", borderRadius:8,
                border:`1px solid ${(narr.trim()||narrImage)?"rgba(176,48,216,0.6)":"rgba(255,255,255,0.07)"}`,
                background:(narr.trim()||narrImage)?"linear-gradient(135deg,rgba(120,20,180,0.4),rgba(176,48,216,0.25))":"rgba(255,255,255,0.02)",
                color:(narr.trim()||narrImage)?"#e8c8ff":"rgba(255,255,255,0.25)",
                fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:1, textTransform:"uppercase",
                cursor:(narr.trim()||narrImage)?"pointer":"default",
                boxShadow:(narr.trim()||narrImage)?"0 0 12px rgba(176,48,216,0.2)":"none" }}>
              {narrSent ? "✓ Transmitido" : "📡 Transmitir"}
            </button>
          </div>
        </div>
      </div>

      {confirmMedo && (
        <div onClick={() => setConfirmMedo(null)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,4,12,0.85)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(440px,100%)", background: "#070b16", border: "1px solid rgba(68,102,204,0.5)", borderRadius: 10, padding: 22, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><ElementoSymbol id="medo" size={56} /></div>
            <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 20, color: "#5b8dd9", marginBottom: 8 }}>Conceder Elemento Medo</div>
            <p style={{ fontFamily: "'Crimson Pro',serif", color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 18 }}>
              Você está prestes a conceder o Elemento <b style={{ color: "#5b8dd9" }}>Medo</b> a <b>{confirmMedo.name}</b>. Esta é uma ação narrativa especial e o jogador será notificado. Confirmar?
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmMedo(null)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, color: "#ccc", padding: "9px 18px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Cancelar</button>
              <button onClick={() => applyElement(confirmMedo.sheetId, "medo")} style={{ background: "linear-gradient(135deg,#1a3399,#4466cc)", border: "none", borderRadius: 6, color: "#fff", padding: "9px 18px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>Conceder Medo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Overlay de narração global — escuta narracao (global), narracaoPrivada[uid] e narracaoTest (mestre). */
function NarracaoOverlay({ campaign, uid, isMaster }) {
  const pickLatest = () => {
    const candidates = [
      campaign?.narracao,
      campaign?.narracaoPrivada?.[uid],
      isMaster ? campaign?.narracaoTest : null,
    ].filter(Boolean);
    return candidates.reduce((best, c) => (!best || c.ts > best.ts) ? c : best, null);
  };

  const initTs = Math.max(
    campaign?.narracao?.ts || 0,
    campaign?.narracaoPrivada?.[uid]?.ts || 0,
    campaign?.narracaoTest?.ts || 0,
  );
  const seenRef = useRef(initTs);
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState(null);
  const [typed, setTyped] = useState("");

  const globalTs  = campaign?.narracao?.ts;
  const privateTs = campaign?.narracaoPrivada?.[uid]?.ts;
  const testTs    = campaign?.narracaoTest?.ts;

  useEffect(() => {
    const latest = pickLatest();
    if (latest && latest.ts > seenRef.current) {
      seenRef.current = latest.ts;
      setCurrent(latest);
      setShow(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalTs, privateTs, testTs]);

  useEffect(() => {
    if (!show || !current) return;
    const text = current.text || "";
    let i = 0; setTyped("");
    const iv = setInterval(() => { i++; setTyped(text.slice(0, i)); if (i >= text.length) clearInterval(iv); }, 28);
    return () => clearInterval(iv);
  }, [show, current]);

  if (!show || !current) return null;
  const isTest = !!current.test;
  const text = current.text || "";
  const image = current.image || null;

  return createPortal(
    <div onClick={() => setShow(false)} style={{ position:"fixed", inset:0, zIndex:400, background:"radial-gradient(circle at 50% 40%, rgba(20,4,30,0.9), rgba(0,0,0,0.97))", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:28, cursor:"pointer" }}>
      {isTest && (
        <div style={{ position:"absolute", top:18, left:"50%", transform:"translateX(-50%)", background:"rgba(255,200,50,0.15)", border:"1px solid rgba(255,200,50,0.5)", borderRadius:20, padding:"4px 18px", fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:2, color:"#ffd580", textTransform:"uppercase" }}>
          🧪 Modo Teste — só você está vendo
        </div>
      )}
      <svg width="44" height="44" viewBox="0 0 64 64" fill="none" style={{ marginBottom:image?14:24, opacity:0.8 }}>
        <path d="M3 32c8-14 18-20 29-20s21 6 29 20c-8 14-18 20-29 20S11 46 3 32z" stroke="#b030d8" strokeWidth="1.6"/>
        <circle cx="32" cy="32" r="9" stroke="#b030d8" strokeWidth="1.6"/>
        <circle cx="32" cy="32" r="3.5" fill="#b030d8"/>
      </svg>
      {image && (
        <img src={image} alt="" style={{ maxWidth:"min(680px,88vw)", maxHeight:"38vh", objectFit:"contain", borderRadius:8, marginBottom:20, boxShadow:"0 0 40px rgba(176,48,216,0.3)" }}/>
      )}
      {text && (
        <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:"clamp(18px,3.2vw,30px)", color:"#e8e0f0", textAlign:"center", maxWidth:760, lineHeight:1.6, textShadow:"0 0 24px rgba(176,48,216,0.4)", minHeight:40 }}>
          {typed}<span style={{ opacity:0.6 }}>▌</span>
        </div>
      )}
      <div style={{ marginTop:30, fontFamily:"'Cinzel',serif", fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"rgba(255,255,255,0.4)" }}>
        — transmissão do mestre · clique para fechar —
      </div>
    </div>,
    document.body
  );
}

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

  /* ── Live-sync: always push character changes to sharedSheets regardless of active tab ── */
  const liveSheetsRef = useRef([]);
  useEffect(() => {
    const q = query(collection(db, "campaigns", campaign.id, "sharedSheets"));
    const unsub = onSnapshot(q, snap => {
      liveSheetsRef.current = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.ownerId === uid && s.isLive);
    });
    return unsub;
  }, [campaign.id, uid]);

  useEffect(() => {
    if (!characters?.length || !liveSheetsRef.current.length) return;
    liveSheetsRef.current.forEach(sheet => {
      const char = characters.find(c => String(c.id || c.createdAt) === sheet.characterId);
      if (!char) return;
      updateDoc(doc(db, "campaigns", campaign.id, "sharedSheets", sheet.id), {
        characterData: char,
        characterName: char.form?.personagem || "Sem nome",
      }).catch(console.error);
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
    try { await updateDoc(doc(db, "campaigns", campaign.id), { coverImage: img }); } catch(_) {}
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
    <div className="fade" style={{display:"flex",flexDirection:"column",height:"calc(100vh - 136px)",minHeight:400,gap:0}}>

      {/* ── Banner de capa (hero) ──
          As ações moram AQUI, como overlays discretos — a barra de botões que
          duplicava abas (Adicionar Agentes → aba Agentes, Editar Campanha →
          aba Gerenciar) foi removida: navegação só pelas abas, ações só no hero. */}
      <input ref={coverInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files?.[0]&&handleCoverUpload(e.target.files[0])}/>
      <div style={{position:"relative",width:"100%",height:campaign.coverImage?200:110,borderRadius:12,overflow:"hidden",flexShrink:0,
        border:"1px solid rgba(176,48,216,0.18)",
        background:campaign.coverImage?"transparent":"radial-gradient(120% 160% at 20% 0%,rgba(176,48,216,0.22),rgba(176,48,216,0.03) 60%),linear-gradient(180deg,rgba(20,14,26,0.9),rgba(10,8,14,0.95))"}}>
        {campaign.coverImage && <img src={campaign.coverImage} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0.10) 34%,rgba(0,0,0,0.78) 100%)"}}/>

        {/* topo: voltar (esq) + ações do mestre (dir) */}
        <div style={{position:"absolute",top:10,left:12,right:12,display:"flex",alignItems:"center",gap:8,zIndex:2}}>
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
        <div style={{position:"absolute",bottom:14,left:16,right:16,display:"flex",alignItems:"flex-end",gap:12,zIndex:2}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"clamp(19px,2.6vw,26px)",color:"#fff",lineHeight:1.15,
              textShadow:"0 2px 10px rgba(0,0,0,0.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {campaign.name}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6,flexWrap:"wrap"}}>
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
          <button onClick={()=>setShowInvite(v=>!v)} title="Mostrar o código de convite"
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
        overflowX:"auto",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
        <SlidingTabPill pill={tabsPill.pill} radius={8} background="rgba(176,48,216,0.14)" underline="#b030d8"/>
        {tabs.map(tab=>{
          const active = activeTab===tab.id;
          return (
            <button key={tab.id} ref={tabsPill.setItemRef(tab.id)} onClick={()=>setActiveTab(tab.id)} style={{
              padding:"11px 15px",border:"none",cursor:"pointer",flexShrink:0,background:"transparent",
              fontFamily:"Cinzel,serif",fontSize:11.5,letterSpacing:"0.08em",textTransform:"uppercase",
              color: active ? "#e8d4ff" : "rgba(255,255,255,0.42)",
              transition:"color 0.2s",display:"flex",alignItems:"center",gap:7,
              position:"relative",zIndex:1,
            }}
              onMouseEnter={e=>{if(!active)e.currentTarget.style.color="rgba(255,255,255,0.75)";}}
              onMouseLeave={e=>{e.currentTarget.style.color=active?"#e8d4ff":"rgba(255,255,255,0.42)";}}>
              <span style={{opacity: active ? 1 : 0.55, display:"flex", alignItems:"center"}}>{tab.svg}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Conteúdo ── */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",paddingTop:10}}>
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

/* ═══════════════════════════════
   PLANS SCREEN
═══════════════════════════════ */
const PLAN_DEFS = [
  {
    systemId: "op",
    planName: "Agente da Ordem",
    system: "Ordem Paranormal",
    accent: "#b030d8",
    accentGlow: "rgba(176,48,216,0.25)",
    catarseUrl: "https://www.catarse.com.br/nexus-ordem",  // ← atualizar após criar página no Catarse
    features: ["5 fichas de Agente", "Ajudante do Mestre completo", "Campanhas multiplayer", "Trilhas sonoras"],
    badge: "TERROR • INVESTIGAÇÃO",
  },
  {
    systemId: "tormenta",
    planName: "Aventureiro de Arton",
    system: "Tormenta 20",
    accent: "#d4621e",
    accentGlow: "rgba(212,98,30,0.25)",
    catarseUrl: "https://www.catarse.com.br/nexus-tormenta",
    features: ["5 fichas de Personagem", "Ajudante do Mestre completo", "Campanhas multiplayer", "Trilhas sonoras"],
    badge: "FANTASIA • ÉPICO",
  },
  {
    systemId: "dnd",
    planName: "Herói Lendário",
    system: "D&D 5ª Edição",
    accent: "#4a6fa5",
    accentGlow: "rgba(74,111,165,0.25)",
    catarseUrl: "https://www.catarse.com.br/nexus-dnd",
    features: ["5 fichas de Personagem", "Ajudante do Mestre completo", "Campanhas multiplayer", "Trilhas sonoras"],
    badge: "FANTASIA • COMBATE",
  },
];

function PlansScreen({ userPlans = [], currentUser }) {
  const [hov, setHov] = useState(null);

  const openCatarse = (url, systemId) => {
    // Inclui userId na URL para o webhook conseguir identificar o usuário
    const uid = currentUser?.uid || '';
    const full = uid ? `${url}?ref=${uid}` : url;
    window.open(full, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fade" style={{ maxWidth: 900, margin: "0 auto", padding: "8px 0 48px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontFamily: "Cinzel,serif", fontSize: 10, letterSpacing: "0.25em", color: "var(--gold)", textTransform: "uppercase", marginBottom: 10 }}>
          ◈ Nexus RPG · Planos
        </div>
        <h1 style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 28, background: "linear-gradient(135deg,#c9a84c,#e8c96d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 12 }}>
          Escolha seu Sistema
        </h1>
        <p style={{ fontFamily: "'Crimson Pro',serif", fontSize: 17, color: "var(--muted2)", maxWidth: 480, margin: "0 auto" }}>
          Assine o plano do sistema que você joga e desbloqueie fichas ilimitadas, IA sem restrições e campanhas multiplayer.
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
        {PLAN_DEFS.map((plan, i) => {
          const active = userPlans.includes(plan.systemId);
          const isHov = hov === plan.systemId;
          return (
            <div key={plan.systemId}
              onMouseEnter={() => setHov(plan.systemId)}
              onMouseLeave={() => setHov(null)}
              style={{
                background: `linear-gradient(160deg, rgba(14,12,24,0.98) 0%, rgba(10,8,18,0.99) 100%)`,
                border: `1px solid ${isHov || active ? plan.accent + "80" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 14,
                padding: "28px 24px 24px",
                display: "flex", flexDirection: "column", gap: 0,
                position: "relative", overflow: "hidden",
                boxShadow: isHov ? `0 0 40px ${plan.accentGlow}` : "none",
                transition: "all 0.22s",
                animation: `statCardIn 0.4s ease ${i * 0.1}s both`,
              }}>

              {/* Glow blob */}
              <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: plan.accent + "12", filter: "blur(40px)", pointerEvents: "none" }}/>

              {/* Badge do sistema */}
              <div style={{ fontFamily: "Cinzel,serif", fontSize: 8, letterSpacing: "0.18em", color: plan.accent, textTransform: "uppercase", marginBottom: 14 }}>
                {plan.badge}
              </div>

              {/* Nome do sistema */}
              <div style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 17, color: "#e8e0d0", marginBottom: 2 }}>
                {plan.system}
              </div>

              {/* Nome do plano */}
              <div style={{ fontFamily: "Cinzel,serif", fontSize: 11, color: plan.accent, letterSpacing: "0.06em", marginBottom: 20, opacity: 0.9 }}>
                {plan.planName}
              </div>

              {/* Preço */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 20 }}>
                <span style={{ fontFamily: "Cinzel,serif", fontSize: 13, color: "var(--muted2)" }}>R$</span>
                <span style={{ fontFamily: "'Cinzel Decorative',serif", fontSize: 34, color: "#f0e8d4", lineHeight: 1 }}>19,90</span>
                <span style={{ fontFamily: "Cinzel,serif", fontSize: 11, color: "var(--muted)", marginLeft: 2 }}>/mês</span>
              </div>

              {/* Divisor */}
              <div style={{ height: 1, background: `linear-gradient(90deg, ${plan.accent}40, transparent)`, marginBottom: 18 }}/>

              {/* Features */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: plan.accent, fontSize: 14, flexShrink: 0 }}>✓</span>
                    <span style={{ fontFamily: "'Crimson Pro',serif", fontSize: 15, color: "var(--muted2)" }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* Botão */}
              {active ? (
                <div style={{
                  padding: "12px 0", borderRadius: 7, textAlign: "center",
                  background: `${plan.accent}18`, border: `1px solid ${plan.accent}60`,
                  fontFamily: "Cinzel,serif", fontSize: 11, letterSpacing: "0.1em",
                  color: plan.accent, textTransform: "uppercase",
                }}>
                  ✓ Plano Ativo
                </div>
              ) : (
                <button onClick={() => openCatarse(plan.catarseUrl, plan.systemId)} style={{
                  padding: "13px 0", borderRadius: 7, cursor: "pointer", border: "none",
                  background: isHov
                    ? `linear-gradient(135deg, ${plan.accent}, ${plan.accent}cc)`
                    : `linear-gradient(135deg, ${plan.accent}cc, ${plan.accent}99)`,
                  color: "#fff", fontFamily: "Cinzel,serif", fontSize: 11,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  boxShadow: isHov ? `0 4px 20px ${plan.accentGlow}` : "none",
                  transition: "all 0.2s",
                }}>
                  Assinar no Catarse
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Nota */}
      <div style={{ textAlign: "center", marginTop: 28, fontFamily: "'Crimson Pro',serif", fontSize: 14, color: "var(--muted)", fontStyle: "italic" }}>
        Pagamento seguro via Catarse · PIX, cartão de crédito ou boleto · Cancele quando quiser
      </div>
    </div>
  );
}

/* ═══════════════════════════════
   UPGRADE MODAL — Plano Ordem
═══════════════════════════════ */
function UpgradeModal({ onClose, onGoToPlans }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"min(420px,100%)", background:"#0e0c18", border:"1px solid rgba(201,168,76,0.35)",
        borderRadius:16, padding:"32px 28px 28px", boxShadow:"0 24px 80px rgba(0,0,0,0.62)", textAlign:"center", position:"relative",
      }}>
        <button onClick={onClose} style={{ position:"absolute", top:14, right:16, background:"none", border:"none", color:"var(--muted)", cursor:"pointer", fontSize:18 }}>✕</button>
        <div style={{ fontSize:36, marginBottom:12 }}>⚡</div>
        <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:20, background:"linear-gradient(135deg,#c9a84c,#e8c96d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:10 }}>
          Limite atingido
        </div>
        <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:16, color:"var(--muted2)", marginBottom:24, lineHeight:1.5 }}>
          O plano gratuito permite 1 ficha por sistema.<br/>Assine o plano do seu sistema favorito para desbloquear até 5 fichas e muito mais.
        </div>
        <button className="btn-gold" onClick={onGoToPlans} style={{ width:"100%", padding:"13px 0", fontSize:13, letterSpacing:"0.08em" }}>
          Ver Planos — a partir de R$ 19,90/mês
        </button>
        <div style={{ fontFamily:"Crimson Pro,serif", fontSize:13, color:"var(--muted)", marginTop:10 }}>
          Cancele quando quiser · Pagamento via Catarse
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════
   DASHBOARD
═══════════════════════════════ */
function Dashboard({ system, onCreateChar, characters, sessions, onSelectChar, onNav, userPlans = [], onShowUpgrade }) {
  const locale = useLocale();
  const sT = locale.t;
  const accent = system?.accent || "var(--gold)";
  const accentText = system?.accentText || system?.accent || "var(--gold)";
  const isSubscribed = userPlans.includes(system?.id);
  const charLimit = isSubscribed ? 5 : 1;

  const sysChars = characters.filter(c =>
    c.systemId === system?.id || (!c.systemId && system?.id === 'op')
  );

  const SvgScroll  = ({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>;
  const SvgMapPin  = ({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>;
  const SvgClock   = ({c})=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;

  /* "Sessões com IA" removido a pedido do Andre (2026-07-25) — 3 atalhos restantes */
  const stats = [
    { label:"Fichas Criadas", val: String(sysChars.length), svg:<SvgScroll c={accent}/>,   color: accent,   nav:"sheet", hint:"Ver fichas" },
    { label:"Mapas",          val: "0",                     svg:<SvgMapPin c="#7a9ed4"/>,   color:"#7a9ed4", nav:"map",   hint:"Abrir mapas" },
    { label:"Horas Jogadas",  val: "0h",                    svg:<SvgClock  c="#6aaa7a"/>,   color:"#6aaa7a", nav:"party", hint:"Ver campanhas" },
  ];

  /* ── Empty state helpers ── */
  const EmptyChars = () => (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      minHeight:180, padding:"28px 20px", gap:12, textAlign:"center",
      background:"radial-gradient(ellipse at center, rgba(201,168,76,0.06) 0%, var(--card) 70%)",
      border:"1px dashed rgba(201,168,76,0.18)", borderRadius:8,
    }}>
      <div style={{opacity:0.35, color:"var(--gold)"}}><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg></div>
      <div style={{fontFamily:"Cinzel,serif", fontSize:12, letterSpacing:"0.08em", color:"var(--muted)", textTransform:"uppercase"}}>
        Nenhum personagem criado
      </div>
      <div style={{fontFamily:"Crimson Pro,serif", fontSize:16, color:"var(--muted)", fontStyle:"italic", maxWidth:280}}>
        Crie sua primeira ficha de agente e ela aparecerá aqui.
      </div>
      <button className="btn-gold" onClick={onCreateChar}>
        + Criar Primeiro Agente
      </button>
    </div>
  );

  return (
    <div className="fade" style={{display:"flex", flexDirection:"column", gap:24}}>

      {/* ── Hero unificado ──
          O banner do sistema e o header "Bem-vindo" viviam empilhados e o
          subtítulo repetia o nome do sistema (ORDEM PARANORMAL 2×). Agora é um
          bloco único: identidade à esquerda, o ÚNICO CTA primário à direita. */}
      <div style={{
        position:"relative", overflow:"hidden",
        padding:"22px 24px",
        background:`radial-gradient(130% 200% at 0% 0%, ${system?.accent}1c, transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent)`,
        border:`1px solid ${system?.accent}30`,
        borderRadius:12, display:"flex", alignItems:"center", gap:18, flexWrap:"wrap",
      }}>
        <div aria-hidden="true" style={{
          width:56, height:56, borderRadius:14, flexShrink:0, fontSize:28,
          background:`${system?.accent}14`, border:`1px solid ${system?.accent}38`,
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:`0 0 18px ${system?.accent}22`,
        }}>{system?.svgIcon ? system.svgIcon(false) : system?.icon}</div>
        <div style={{flex:1, minWidth:220}}>
          <div style={{fontFamily:"Cinzel,serif", fontSize:11, letterSpacing:"0.14em", color:"var(--muted)", textTransform:"uppercase", marginBottom:5}}>
            {sT("dashboard.welcome")}
          </div>
          <div style={{display:"flex", alignItems:"center", gap:12, flexWrap:"wrap"}}>
            <h1 style={{fontFamily:"'Cinzel Decorative',serif", fontSize:"clamp(20px,2.4vw,26px)", fontWeight:700, lineHeight:1.15,
              background:`linear-gradient(135deg,${accent},#e8c96d)`,
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text"}}>{system?.name}</h1>
            {/* Subscription seal — shimmering gold when PRO, static when free (AC-4) */}
            <span className={isSubscribed ? "nx-shimmer" : ""}
              title={isSubscribed ? "Assinante deste sistema" : "Plano gratuito — assine para desbloquear"}
              style={{
                display:"inline-flex", alignItems:"center", gap:5, flexShrink:0,
                padding:"4px 11px", borderRadius:20,
                fontFamily:"Cinzel,serif", fontSize:9, fontWeight:700,
                letterSpacing:"0.14em", textTransform:"uppercase",
                background: isSubscribed ? "linear-gradient(135deg,#c9a84c,#e8c96d)" : "rgba(255,255,255,0.05)",
                color: isSubscribed ? "#1a1410" : "var(--muted)",
                border: isSubscribed ? "none" : "1px solid var(--border2)",
                boxShadow: isSubscribed ? "0 2px 12px rgba(201,168,76,0.4)" : "none",
              }}>
              {isSubscribed ? "★ Pro" : "Livre"}
            </span>
          </div>
          {system?.desc && (
            <div style={{fontFamily:"Crimson Pro,serif", fontSize:15, color:"var(--muted2)", fontStyle:"italic", marginTop:6, maxWidth:520, lineHeight:1.45}}>
              {system.desc}
            </div>
          )}
        </div>
        <button
          className="btn-gold"
          style={{flexShrink:0, opacity: sysChars.length >= charLimit ? 0.45 : 1, cursor: sysChars.length >= charLimit ? "not-allowed" : "pointer"}}
          onClick={() => {
            if (sysChars.length >= charLimit) { onShowUpgrade?.(); }
            else onCreateChar();
          }}
          title={sysChars.length >= charLimit ? (!isSubscribed ? "Assine o plano deste sistema para criar mais fichas." : `Limite de ${charLimit} fichas atingido`) : ""}
        >
          {sysChars.length >= charLimit
            ? (!isSubscribed ? "⚡ Ver Planos" : `Limite atingido (${charLimit}/${charLimit})`)
            : `+ Nova Ficha`}
        </button>
      </div>

      {/* Stats — atalhos horizontais: número e rótulo na mesma linha de leitura,
          seta à direita deixa claro que o card navega (affordance de clique) */}
      <div className="dash-stats">
        {stats.map((s,i)=>(
          <button key={s.label} className="stat-card" title={s.hint}
            onClick={()=>onNav && onNav(s.nav)}
            style={{
              background:"var(--card)", border:"1px solid var(--border)",
              borderRadius:10, padding:"14px 16px", textAlign:"left", cursor:"pointer",
              display:"flex", alignItems:"center", gap:14, minHeight:72,
              animation:`statCardIn 0.4s ease ${i*0.08}s both`,
            }}>
            <div aria-hidden="true" style={{
              width:44, height:44, borderRadius:11, flexShrink:0,
              background:`${s.color}16`, border:`1px solid ${s.color}38`,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>{s.svg}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:"1.55rem", color:s.color, lineHeight:1.05, fontVariantNumeric:"tabular-nums"}}>{s.val}</div>
              <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:"0.1em", color:"var(--muted)", textTransform:"uppercase", marginTop:4}}>{s.label}</div>
            </div>
            <span aria-hidden="true" style={{color:s.color, opacity:0.4, fontSize:14, flexShrink:0}}>→</span>
          </button>
        ))}
      </div>

      {/* Characters */}
      <div>
        <div style={{fontFamily:"Cinzel,serif", fontSize:14, letterSpacing:"0.08em", color:accentText, textTransform:"uppercase", marginBottom:14}}>
          Seus Personagens
        </div>
        {sysChars.length === 0 ? <EmptyChars/> : (
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
            {sysChars.map((c,i)=> system?.id === "op"
              ? <DossierCard key={i} character={c} systemAccent={system?.accent} onClick={()=>onSelectChar && onSelectChar(c)} />
              : (
              <div key={i} style={{
                background:"var(--card)", border:"1px solid var(--border)", borderRadius:8,
                padding:"14px 18px", display:"flex", alignItems:"center", gap:16,
                cursor:"pointer", transition:"border-color 0.2s",
              }} onClick={()=>onSelectChar && onSelectChar(c)}
                 onMouseEnter={e=>e.currentTarget.style.borderColor=system?.accent+"60"}
                 onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                <div style={{
                  width:72, height:72, borderRadius:8, flexShrink:0,
                  background:`${accent}18`, border:`1px solid ${accent}30`,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:30,
                  overflow:"hidden",
                }}>
                  {getActiveAvatar(c)
                    ? <img src={getActiveAvatar(c)} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    : "🕵️"}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontFamily:"Cinzel,serif", fontSize:17, color:"var(--text)", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                    {c.form?.personagem || "Sem nome"}
                  </div>
                  <div style={{fontFamily:"Cinzel,serif", fontSize:12, letterSpacing:1, color:"var(--muted)", textTransform:"uppercase"}}>
                    {c.classe?.name || "—"} · {c.origem?.name || "—"} · {system?.name}
                  </div>
                </div>
                <div style={{display:"flex", flexDirection:"column", gap:4, minWidth:100}}>
                  <span style={{fontFamily:"Cinzel,serif", fontSize:11, color:"var(--muted)"}}>NEX {c.nex ?? 5}%</span>
                  <div style={{height:4, background:"rgba(255,255,255,0.06)", borderRadius:2}}>
                    <div style={{height:"100%", width:`${c.nex ?? 5}%`, background:`linear-gradient(90deg,${system?.accent||"var(--gold3)"},var(--gold))`, borderRadius:2}}/>
                  </div>
                </div>
                <span style={{fontFamily:"Cinzel,serif", fontSize:11, color:accent, opacity:0.5, flexShrink:0}}>→</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção "Últimas Sessões com IA" removida a pedido do Andre (2026-07-25) —
          os personagens são o conteúdo central do painel */}
    </div>
  );
}

/* ═══════════════════════════════
   SHEET LIST — Agent Grid
═══════════════════════════════ */
function SheetList({ characters, system, onCreateChar, onSelectChar, onDeleteChar, onUpdateChar }) {
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState("");
  const [hoverCard, setHoverCard] = useState(null);
  const [adjustCard, setAdjustCard] = useState(null);
  const [charAdjust, setCharAdjust] = useState({});
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);
  const purple = "#7c3aed";
  const purpleHover = "#6d28d9";

  // Apenas personagens deste sistema. Personagens sem systemId (legados) só aparecem em OP.
  const sysChars = characters.filter(c =>
    c.systemId === system?.id || (!c.systemId && system?.id === 'op')
  );

  const filtered = sysChars.filter(c =>
    (c.form?.personagem || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fade" style={{display:"flex", flexDirection:"column", gap:20}}>

      {/* Header row */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <h2 style={{fontFamily:"Cinzel,serif", fontSize:20, fontWeight:700, color:"var(--text)", letterSpacing:1}}>
          Agentes: {sysChars.length}/5
        </h2>
        <button onClick={sysChars.length < 5 ? onCreateChar : undefined} disabled={sysChars.length >= 5} style={{
          fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:2, textTransform:"uppercase",
          padding:"9px 20px", borderRadius:6, cursor: sysChars.length >= 5 ? "not-allowed" : "pointer",
          background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.14)",
          color: sysChars.length >= 5 ? "var(--muted)" : "var(--text)", transition:"all 0.2s",
          opacity: sysChars.length >= 5 ? 0.5 : 1,
        }}
          onMouseEnter={e=>{ if(sysChars.length < 5) e.currentTarget.style.background="rgba(255,255,255,0.12)" }}
          onMouseLeave={e=>{ if(sysChars.length < 5) e.currentTarget.style.background="rgba(255,255,255,0.07)" }}
          title={sysChars.length >= 5 ? "Limite de 5 fichas atingido" : ""}>
          {sysChars.length >= 5 ? "Limite atingido" : "Novo Agente"}
        </button>
      </div>

      {/* Search */}
      <div style={{position:"relative"}}>
        <span style={{position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", fontSize:17, pointerEvents:"none"}}>🔍</span>
        <input
          placeholder="Buscar"
          value={search}
          onChange={e=>setSearch(e.target.value)}
          style={{paddingLeft:44, borderRadius:8, fontSize:15, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)"}}
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px", gap:16, textAlign:"center"}}>
          <div style={{fontSize:48, opacity:0.2}}>🕵️</div>
          <div style={{fontFamily:"Cinzel,serif", fontSize:13, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase"}}>
            {search ? "Nenhum agente encontrado" : "Nenhum agente criado"}
          </div>
          {!search && (
            <button className="btn-gold" onClick={onCreateChar} style={{fontSize:12, padding:"10px 24px", marginTop:4}}>
              + Criar Agente
            </button>
          )}
        </div>
      )}

      {/* Cards grid */}
      {filtered.length > 0 && (
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:18}}>
          {filtered.map((c, i) => (
            <div key={i} style={{
              background:"var(--card)", borderRadius:14,
              border:"1px solid rgba(255,255,255,0.07)",
              position:"relative", overflow:"hidden",
              transition:"border-color 0.22s, transform 0.22s, box-shadow 0.22s",
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(124,58,237,0.5)"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 12px 40px rgba(124,58,237,0.18)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"}}>

              {/* Gear + menu */}
              <div style={{position:"absolute", top:12, right:14, zIndex:3}}>
                <button onClick={(e)=>{e.stopPropagation(); setMenuOpen(menuOpen===i?null:i);}} title="Opções" aria-label="Opções da ficha"
                  style={{background:"none", border:"none", fontSize:18, color:"rgba(255,255,255,0.3)", cursor:"pointer", lineHeight:1, padding:2}}>⚙</button>
                {menuOpen===i && (
                  <>
                    <div onClick={()=>setMenuOpen(null)} style={{position:"fixed", inset:0, zIndex:2}}/>
                    <div style={{position:"absolute", top:30, right:0, zIndex:4, background:"#15110a", border:"1px solid var(--border2)", borderRadius:8, minWidth:164, boxShadow:"0 8px 32px rgba(0,0,0,0.48)", overflow:"hidden"}}>
                      <button onClick={()=>{ setMenuOpen(null); setConfirmDelete(c); }}
                        style={{display:"flex", alignItems:"center", gap:8, width:"100%", textAlign:"left", background:"none", border:"none", color:"#e57373", padding:"11px 16px", fontFamily:"Cinzel,serif", fontSize:11, letterSpacing:1, cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(229,57,53,0.12)"}
                        onMouseLeave={e=>e.currentTarget.style.background="none"}>
                        🗑 Excluir Ficha
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Avatar (full-width top) */}
              <div style={{
                width:"100%", height:180,
                background:"rgba(124,58,237,0.10)",
                borderBottom:"1px solid rgba(255,255,255,0.06)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:56, overflow:"hidden", position:"relative",
              }}
                onMouseEnter={() => setHoverCard(i)}
                onMouseLeave={() => { if (adjustCard !== i) setHoverCard(null); }}
              >
                {getActiveAvatar(c)
                  ? <img src={getActiveAvatar(c)} alt="" style={{
                      width:"100%", height:"100%", objectFit:"cover",
                      objectPosition:`center ${charAdjust[c.id||c.createdAt] ?? c.form?.avatarPosY ?? 50}%`,
                    }}/>
                  : <span style={{opacity:0.18}}>🕵️</span>}
                {/* subtle gradient overlay */}
                <div style={{position:"absolute",bottom:0,left:0,right:0,height:60,background:"linear-gradient(to top, rgba(12,12,20,0.8), transparent)", pointerEvents:"none"}}/>

                {/* Adjust mode overlay */}
                {adjustCard === i ? (
                  <div onClick={e => e.stopPropagation()} style={{
                    position:"absolute", inset:0, zIndex:6,
                    background:"rgba(0,0,0,0.68)",
                    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10,
                  }}>
                    <div style={{color:"rgba(255,255,255,0.65)", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1.5, textTransform:"uppercase"}}>Ajustar Posição</div>
                    <input type="range" min={0} max={100}
                      value={charAdjust[c.id||c.createdAt] ?? c.form?.avatarPosY ?? 50}
                      onChange={e => {
                        const key = c.id||c.createdAt;
                        setCharAdjust(prev => ({...prev, [key]: +e.target.value}));
                      }}
                      style={{width:"72%", accentColor:"#7c3aed", cursor:"pointer"}}
                    />
                    <div style={{display:"flex", gap:8}}>
                      <button onClick={e => {
                        e.stopPropagation();
                        const key = c.id||c.createdAt;
                        const newY = charAdjust[key] ?? c.form?.avatarPosY ?? 50;
                        onUpdateChar?.({ ...c, form: { ...c.form, avatarPosY: newY } });
                        setAdjustCard(null); setHoverCard(null);
                      }} style={{background:"#7c3aed", border:"none", color:"#fff", borderRadius:5, padding:"5px 14px", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1, cursor:"pointer"}}>Salvar</button>
                      <button onClick={e => {
                        e.stopPropagation();
                        const key = c.id||c.createdAt;
                        setCharAdjust(prev => { const n={...prev}; delete n[key]; return n; });
                        setAdjustCard(null); setHoverCard(null);
                      }} style={{background:"transparent", border:"1px solid rgba(255,255,255,0.2)", color:"rgba(255,255,255,0.5)", borderRadius:5, padding:"5px 12px", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1, cursor:"pointer"}}>Cancelar</button>
                    </div>
                  </div>
                ) : (hoverCard === i && getActiveAvatar(c)) ? (
                  <button onClick={e => { e.stopPropagation(); setAdjustCard(i); }} style={{
                    position:"absolute", bottom:8, left:8, zIndex:5,
                    background:"rgba(0,0,0,0.72)", border:"1px solid rgba(255,255,255,0.18)",
                    color:"rgba(255,255,255,0.75)", borderRadius:5, padding:"4px 9px",
                    fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:1, cursor:"pointer",
                    textTransform:"uppercase",
                  }}>⤢ Ajustar</button>
                ) : null}
              </div>

              {/* Info */}
              <div style={{padding:"16px 18px 0"}}>
                <div style={{fontFamily:"Cinzel,serif", fontSize:19, fontWeight:700, color:"#fff", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                  {c.form?.personagem || "Sem nome"}
                </div>
                <div style={{fontFamily:"Inter,system-ui,sans-serif", fontSize:14, color:"rgba(255,255,255,0.5)", marginBottom:4}}>
                  {c.classe?.name || "—"}
                </div>
                <div style={{fontFamily:"Inter,system-ui,sans-serif", fontSize:12, color:"rgba(255,255,255,0.25)"}}>
                  Registrado em {c.createdAt || "—"}
                </div>
              </div>

              {/* Footer */}
              <div style={{padding:"16px 18px 18px"}}>
                <button onClick={()=>onSelectChar(c)} style={{
                  width:"100%", background:purple, color:"#fff", border:"none",
                  borderRadius:8, padding:"11px 0",
                  fontFamily:"Cinzel,serif", fontSize:11, letterSpacing:1.5,
                  textTransform:"uppercase", cursor:"pointer", transition:"background 0.2s",
                }}
                  onMouseEnter={e=>{e.currentTarget.style.background=purpleHover}}
                  onMouseLeave={e=>{e.currentTarget.style.background=purple}}>
                  Acessar Ficha
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmação de exclusão — tema dossiê */}
      {confirmDelete && (
        <div onClick={()=>setConfirmDelete(null)} style={{position:"fixed", inset:0, zIndex:300, background:"rgba(3,3,7,0.85)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"min(440px,100%)", background:"#0d0b07", border:"1px solid var(--border2)", borderRadius:10, padding:24, boxShadow:"0 0 40px rgba(0,0,0,0.7), inset 0 0 30px rgba(0,0,0,0.5)"}}>
            <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:18, color:"var(--gold2)", marginBottom:12, textAlign:"center"}}>Excluir Ficha</div>
            <p style={{fontFamily:"Crimson Pro,serif", fontSize:15, color:"var(--muted2)", lineHeight:1.6, textAlign:"center", marginBottom:22}}>
              Tem certeza que deseja excluir a ficha de <b style={{color:"var(--text)"}}>{confirmDelete.form?.personagem || "Sem nome"}</b>? Esta ação é permanente e irreversível.
            </p>
            <div style={{display:"flex", gap:10, justifyContent:"center"}}>
              <button className="btn-ghost" onClick={()=>setConfirmDelete(null)}>Cancelar</button>
              <button onClick={()=>{ const nm = confirmDelete.form?.personagem || "Sem nome"; onDeleteChar?.(confirmDelete); setConfirmDelete(null); setToast(`Ficha de ${nm} excluída.`); }}
                style={{background:"linear-gradient(135deg,#8b1a1a,#c62828)", border:"none", color:"#fff", borderRadius:6, padding:"11px 20px", fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:1.5, textTransform:"uppercase", fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(198,40,40,0.3)"}}>
                Excluir Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fade" style={{position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", zIndex:320, background:"#15110a", border:"1px solid var(--border2)", borderRadius:8, padding:"12px 22px", fontFamily:"Cinzel,serif", fontSize:12, letterSpacing:1, color:"var(--gold2)", boxShadow:"0 8px 30px rgba(0,0,0,0.42)"}}>
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   CHARACTER SHEET
═══════════════════════════════ */
function Sheet({ system }) {
  const accent = system?.accent || "var(--gold)";
  const isOP = system?.id === "op";
  const isDnD = system?.id === "dnd";
  const [hp, setHp] = useState(isOP ? 18 : isDnD ? 58 : 18);
  const [pe, setPe] = useState(isOP ? 12 : 10);
  const [san, setSan] = useState(isOP ? 9 : 10);
  const hpMax = isOP ? 24 : isDnD ? 72 : 24;
  const peMax = isOP ? 16 : 12;
  const sanMax = isOP ? 12 : 10;

  const Ctrl = ({val, set, max, color, label, icon}) => (
    <div style={{background:"var(--card)", border:"1px solid var(--border)", borderRadius:8, padding:16}}>
      <div style={{display:"flex", gap:6, alignItems:"center", marginBottom:8}}>
        <span>{icon}</span>
        <span style={{fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase"}}>{label}</span>
      </div>
      <div style={{display:"flex", alignItems:"baseline", gap:4, marginBottom:10}}>
        <span style={{fontFamily:"'Cinzel Decorative',serif", fontSize:30, color}}>{val}</span>
        <span style={{fontFamily:"Cinzel,serif", fontSize:14, color:"var(--muted)"}}>/{max}</span>
      </div>
      <div style={{height:5, background:"rgba(255,255,255,0.06)", borderRadius:3, marginBottom:10, overflow:"hidden"}}>
        <div style={{height:"100%", width:`${(val/max)*100}%`, background:color, borderRadius:3, transition:"width 0.3s"}}/>
      </div>
      <div style={{display:"flex", gap:6}}>
        {[-1,+1].map(d=>(
          <button key={d} onClick={()=>set(v=>Math.max(0,Math.min(max,v+d)))} style={{
            flex:1, padding:"5px 0", cursor:"pointer",
            background:"rgba(255,255,255,0.03)", border:"1px solid var(--border)",
            borderRadius:4, color:"var(--text)", fontFamily:"Cinzel,serif", fontSize:14,
            transition:"all 0.15s",
          }}>{d<0?"−":"+"}</button>
        ))}
      </div>
    </div>
  );

  const attrs = isOP
    ? [{n:"Força",v:12},{n:"Agilidade",v:15},{n:"Intelecto",v:17},{n:"Presença",v:9},{n:"Vigor",v:11}]
    : isDnD
    ? [{n:"Força",v:16},{n:"Destreza",v:14},{n:"Constituição",v:15},{n:"Inteligência",v:10},{n:"Sabedoria",v:12},{n:"Carisma",v:8}]
    : [{n:"Atributo 1",v:12},{n:"Atributo 2",v:10},{n:"Atributo 3",v:14}];

  const skills2 = isOP
    ? [{n:"Investigação",b:"+4",p:4},{n:"Ocultismo",b:"+3",p:3},{n:"Percepção",b:"+3",p:3},{n:"Furtividade",b:"+2",p:2},{n:"Medicina",b:"+2",p:2},{n:"Atletismo",b:"+1",p:1},{n:"Persuasão",b:"+1",p:1}]
    : isDnD
    ? [{n:"Percepção",b:"+5",p:4},{n:"Sobrevivência",b:"+4",p:3},{n:"Atletismo",b:"+5",p:3},{n:"Furtividade",b:"+4",p:2},{n:"Natureza",b:"+2",p:2},{n:"Persuasão",b:"+1",p:1}]
    : [{n:"Perícia 1",b:"+3",p:3},{n:"Perícia 2",b:"+2",p:2},{n:"Perícia 3",b:"+1",p:1}];

  return (
    <div className="fade" style={{display:"flex", flexDirection:"column", gap:20}}>
      {/* Hero */}
      <div style={{
        background:"var(--card)", border:"1px solid var(--border2)",
        borderRadius:10, padding:24, display:"flex", gap:20, position:"relative", overflow:"hidden",
      }}>
        <div style={{position:"absolute",top:0,right:0,width:300,height:"100%",
          background:"linear-gradient(to left,rgba(201,168,76,0.03),transparent)",pointerEvents:"none"}}/>
        <div style={{
          width:76, height:76, borderRadius:10, flexShrink:0,
          background:"linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.05))",
          border:"2px solid var(--border2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32,
          boxShadow:"0 0 24px rgba(201,168,76,0.15)",
        }}>🕵️</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:3, color:"var(--muted)", textTransform:"uppercase", marginBottom:5}}>
            {isOP ? "Agente · Ordem Paranormal · NEEx São Paulo" : isDnD ? "Herói · D&D 5ª Edição · Campanha do Rei Sombrio" : `Personagem · ${system?.name}`}
          </div>
          <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:20, color:"var(--text)", marginBottom:4, animation:"flicker 8s infinite"}}>Dra. Helena Voss</div>
          <div style={{fontFamily:"Crimson Pro,serif", fontSize:14, color:"var(--muted2)", fontStyle:"italic", marginBottom:10}}>Pesquisadora do Sobrenatural · Trilha: Especialista</div>
          <div style={{display:"flex", gap:6}}>
            {["NEX 45%","Veterana","Paranóica"].map(t=>(
              <span key={t} style={{
                fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:1,
                padding:"3px 10px", borderRadius:20,
                border:"1px solid var(--border2)", color:"var(--gold)",
              }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"Cinzel,serif", fontSize:8, color:"var(--muted)", letterSpacing:2, textTransform:"uppercase", marginBottom:4}}>XP</div>
          <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:28, color:"var(--gold)"}}>3.2k</div>
          <div style={{fontFamily:"Cinzel,serif", fontSize:8, color:"var(--muted)"}}>/ 4.000</div>
        </div>
      </div>

      {/* Vitals */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
        <Ctrl val={hp} set={setHp} max={hpMax} color="#b03020" label="Pontos de Vida" icon="❤️"/>
        <Ctrl val={pe} set={setPe} max={peMax} color={accent} label={isOP?"Pontos de Esforço":"Pontos de Magia"} icon="⚡"/>
        <Ctrl val={san} set={setSan} max={sanMax} color="#7a5ea8" label={isOP?"Sanidade":"Inspiração"} icon={isOP?"🧠":"✨"}/>
      </div>

      {/* Attrs + Skills */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <div style={{background:"var(--card)", border:"1px solid var(--border)", borderRadius:8, padding:18}}>
          <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--gold)", textTransform:"uppercase", marginBottom:14}}>Atributos</div>
          {attrs.map(a=>(
            <div key={a.n} style={{marginBottom:10}}>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:4}}>
                <span style={{fontFamily:"Crimson Pro,serif", fontSize:14, color:"var(--text)"}}>{a.n}</span>
                <span style={{fontFamily:"Cinzel,serif", fontSize:12, color:"var(--gold)"}}>{a.v}</span>
              </div>
              <div style={{height:4, background:"rgba(255,255,255,0.05)", borderRadius:2, overflow:"hidden"}}>
                <div style={{height:"100%", width:`${(a.v/20)*100}%`, background:"linear-gradient(90deg,var(--gold3),var(--gold2))", borderRadius:2}}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{background:"var(--card)", border:"1px solid var(--border)", borderRadius:8, padding:18}}>
          <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--gold)", textTransform:"uppercase", marginBottom:14}}>Perícias</div>
          {skills2.map(s=>(
            <div key={s.n} style={{display:"flex", alignItems:"center", gap:8, marginBottom:9}}>
              <div style={{width:6, height:6, borderRadius:"50%", background: s.p>2?"var(--gold)":"var(--muted)", flexShrink:0}}/>
              <span style={{fontFamily:"Crimson Pro,serif", fontSize:14, color:"var(--text)", flex:1}}>{s.n}</span>
              <span style={{fontFamily:"Cinzel,serif", fontSize:11, color:"var(--gold)", minWidth:24}}>{s.b}</span>
              <div style={{display:"flex", gap:2}}>
                {[0,1,2,3,4].map(i=>(
                  <div key={i} style={{width:7, height:7, borderRadius:1, background: i<s.p?"var(--gold)":"rgba(255,255,255,0.06)"}}/>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rituais */}
      <div style={{background:"var(--card)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:8, padding:18}}>
        <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--gold)", textTransform:"uppercase", marginBottom:14}}>Rituais Conhecidos</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {[{n:"Visão do Além",c:"2 PE",d:"Enxerga entidades e rastros do Outro Lado por 1 cena."},{n:"Escudo Paranormal",c:"3 PE",d:"Barreira etérea que absorve dano de entidades."},{n:"Âncora Espiritual",c:"4 PE",d:"Impede manifestação de entidades por toda a cena."}].map(r=>(
            <div key={r.n} style={{
              display:"flex", gap:14, padding:"10px 14px",
              background:"rgba(201,168,76,0.04)", border:"1px solid rgba(201,168,76,0.12)",
              borderRadius:6,
            }}>
              <span style={{fontFamily:"Cinzel,serif", fontSize:9, color:"var(--gold)", border:"1px solid var(--border2)", borderRadius:3, padding:"3px 8px", height:"fit-content", whiteSpace:"nowrap"}}>{r.c}</span>
              <div>
                <div style={{fontFamily:"Cinzel,serif", fontSize:12, color:"var(--text)", marginBottom:2}}>{r.n}</div>
                <div style={{fontFamily:"Crimson Pro,serif", fontSize:13, color:"var(--muted2)", fontStyle:"italic"}}>{r.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════
   PLACEHOLDER SCREENS
═══════════════════════════════ */
function PlaceholderScreen({ icon, title, desc, badge }) {
  return (
    <div className="fade" style={{
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      minHeight:400, gap:20, textAlign:"center",
    }}>
      <div style={{fontSize:64, animation:"float 4s ease-in-out infinite"}}>{icon}</div>
      <div>
        <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:22,
          background:"linear-gradient(135deg,#c9a84c,#e8c96d)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
          marginBottom:8}}>{title}</div>
        <div style={{fontFamily:"Crimson Pro,serif", fontSize:16, color:"var(--muted2)", maxWidth:400, lineHeight:1.7}}>{desc}</div>
      </div>
      {badge && <div style={{padding:"6px 18px", borderRadius:20, border:"1px solid var(--border2)", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--gold)", textTransform:"uppercase"}}>{badge}</div>}
    </div>
  );
}

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
function Topbar({ screen, system, onChangeSystem, onLogout }) {
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
  const notifCount = NEWS_ITEMS.filter(n => n.isNew).length;

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
      height:52, background:"var(--surface)", borderBottom:"1px solid var(--border)",
      display:"flex", alignItems:"center", padding:"0 20px",
      position:"sticky", top:0, zIndex:50, gap:0,
    }}>

      {/* ── Título da página ── */}
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", gap:2, flexShrink:0 }}>
        <div style={{ fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:"0.2em", color:"var(--gold)", textTransform:"uppercase", lineHeight:1 }}>◈ Nexus RPG</div>
        <div style={{ fontFamily:"Cinzel,serif", fontSize:13, color:"#e0d8c8", textTransform:"uppercase", letterSpacing:"0.06em", lineHeight:1 }}>{labels[screen]}</div>
      </div>

      {/* ── Divisor ── */}
      <div style={{ width:1, height:28, background:"#2a2215", margin:"0 14px", flexShrink:0 }}/>

      {/* ── Seletor de sistema ── */}
      {system && (
        <button onClick={onChangeSystem} className="topbar-sys" style={{
          display:"flex", alignItems:"center", gap:7, cursor:"pointer",
          padding:"5px 11px", borderRadius:6, flexShrink:0,
          background:"#110f1a", border:"1px solid rgba(150,80,200,0.35)",
          fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:"0.12em",
          color:"#c090e0", textTransform:"uppercase", transition:"border-color 0.2s",
        }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(150,80,200,0.6)"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(150,80,200,0.35)"}
          title="Trocar sistema"
        >
          <span style={{display:"flex",alignItems:"center"}}>{system?.svgIcon ? system.svgIcon(false) : system?.icon}</span>
          <span>{system.name}</span>
          <span style={{color:"var(--muted)",fontSize:12,transition:"color 0.2s"}}
            onMouseEnter={e=>e.currentTarget.style.color="var(--gold)"}
            onMouseLeave={e=>e.currentTarget.style.color="var(--muted)"}
          >⇄</span>
        </button>
      )}

      {/* ── Espaço flexível ── */}
      <div style={{flex:1}}/>

      {/* ── Área direita ── */}
      <div style={{display:"flex", gap:10, alignItems:"center"}}>

        {/* Status online */}
        <div style={{display:"flex", gap:5, alignItems:"center"}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"#50b464",boxShadow:"0 0 5px #50b464",animation:"pulse 2s infinite"}}/>
          <span style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:"0.1em",color:"#6ecb82",textTransform:"uppercase"}}>Online</span>
        </div>

        <div style={{width:1,height:18,background:"#2a2215"}}/>

        {/* Plano Pro */}
        <div style={{
          padding:"3px 10px", borderRadius:20, cursor:"default",
          background:"rgba(180,140,30,0.12)", border:"1px solid rgba(184,150,46,0.35)",
          fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:"0.15em",
          color:"#b8962e", textTransform:"uppercase", transition:"border-color 0.2s",
        }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(184,150,46,0.6)"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(184,150,46,0.35)"}
        >✦ Plano Pro</div>

        <div style={{width:1,height:18,background:"#2a2215"}}/>

        {/* Sino */}
        <button onClick={()=>{ setMenuOpen(false); setSelectedNews(NEWS_ITEMS[0]); setNotifOpen(true); }} style={{
          position:"relative", background:"none", border:"none", cursor:"pointer",
          padding:"4px", display:"flex", alignItems:"center", justifyContent:"center",
          color:"#5a5248", transition:"color 0.2s",
        }}
          onMouseEnter={e=>e.currentTarget.style.color="var(--gold)"}
          onMouseLeave={e=>e.currentTarget.style.color="#5a5248"}
          title="Notificações"
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

/* ─── ORDEM PARANORMAL — ÍCONE DE ENERGIA ─── */
const OPEnergyIcon = ({ size = 48, glow = false }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ display:"block", filter: glow ? "drop-shadow(0 0 8px rgba(180,60,220,0.9)) drop-shadow(0 0 20px rgba(140,30,200,0.5))" : "drop-shadow(0 0 4px rgba(180,60,220,0.5))" }}>
    <defs>
      <radialGradient id="opGrad" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stopColor="#e060f0" />
        <stop offset="50%" stopColor="#b030d8" />
        <stop offset="100%" stopColor="#6010a0" />
      </radialGradient>
      <radialGradient id="opGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#c040e8" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#8020c0" stopOpacity="0" />
      </radialGradient>
      <filter id="opBlur">
        <feGaussianBlur stdDeviation="1.2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    {/* Ambient glow behind */}
    <circle cx="50" cy="52" r="30" fill="url(#opGlow)" />

    {/* Flores estilizadas na base */}
    {/* Caule central */}
    <path d="M50 88 Q50 72 50 62" stroke="url(#opGrad)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    {/* Caules laterais */}
    <path d="M50 80 Q44 74 38 70" stroke="url(#opGrad)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    <path d="M50 80 Q56 74 62 70" stroke="url(#opGrad)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    <path d="M50 76 Q42 72 35 72" stroke="url(#opGrad)" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    <path d="M50 76 Q58 72 65 72" stroke="url(#opGrad)" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    {/* Pétalas esquerda */}
    <ellipse cx="35" cy="68" rx="5" ry="3" fill="none" stroke="#b030d8" strokeWidth="1" opacity="0.6" transform="rotate(-30,35,68)"/>
    <ellipse cx="38" cy="65" rx="4" ry="2.5" fill="none" stroke="#c040e8" strokeWidth="0.8" opacity="0.5" transform="rotate(20,38,65)"/>
    {/* Pétalas direita */}
    <ellipse cx="65" cy="68" rx="5" ry="3" fill="none" stroke="#b030d8" strokeWidth="1" opacity="0.6" transform="rotate(30,65,68)"/>
    <ellipse cx="62" cy="65" rx="4" ry="2.5" fill="none" stroke="#c040e8" strokeWidth="0.8" opacity="0.5" transform="rotate(-20,62,65)"/>
    {/* Botão floral central base */}
    <circle cx="50" cy="88" r="2.5" fill="#b030d8" opacity="0.7" filter="url(#opBlur)"/>
    <circle cx="38" cy="70" r="2" fill="#9020c0" opacity="0.6"/>
    <circle cx="62" cy="70" r="2" fill="#9020c0" opacity="0.6"/>

    {/* Raios de energia — as chamas serpenteantes */}
    {/* Raio esquerdo */}
    <path d="M36 60 Q30 48 34 36 Q38 24 32 14"
      stroke="url(#opGrad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.55" filter="url(#opBlur)"/>
    {/* Raio direito */}
    <path d="M64 60 Q70 48 66 36 Q62 24 68 14"
      stroke="url(#opGrad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.55" filter="url(#opBlur)"/>
    {/* Raio central secundário */}
    <path d="M50 60 Q46 48 50 36 Q54 26 48 16"
      stroke="#c040e8" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.35" filter="url(#opBlur)"/>

    {/* ── Símbolo principal — forma geométrica angular (V+seta+chama) ── */}
    {/* Flecha/chama central superior */}
    <path d="M50 14 L44 26 L48 24 L44 38 L50 30 L56 38 L52 24 L56 26 Z"
      fill="url(#opGrad)" filter="url(#opBlur)" opacity="0.95"/>
    {/* Corpo do V */}
    <path d="M38 34 L50 54 L62 34"
      stroke="url(#opGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#opBlur)"/>
    {/* Traço horizontal/asa esquerda */}
    <path d="M32 40 L44 40" stroke="#d050f0" strokeWidth="2" strokeLinecap="round" opacity="0.8" filter="url(#opBlur)"/>
    {/* Traço horizontal/asa direita */}
    <path d="M56 40 L68 40" stroke="#d050f0" strokeWidth="2" strokeLinecap="round" opacity="0.8" filter="url(#opBlur)"/>
    {/* Gancho esquerdo */}
    <path d="M32 40 Q28 46 32 52" stroke="#b030d8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>
    {/* Gancho direito */}
    <path d="M68 40 Q72 46 68 52" stroke="#b030d8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>

    {/* Ponto central brilhante */}
    <circle cx="50" cy="54" r="3" fill="#e060f0" filter="url(#opBlur)"/>
    <circle cx="50" cy="54" r="1.5" fill="#ffffff" opacity="0.8"/>

    {/* Micro partículas */}
    {[[40,20],[60,18],[34,30],[66,28],[43,50],[57,50]].map(([x,y],i)=>(
      <circle key={i} cx={x} cy={y} r="1" fill="#d050f0" opacity={0.4 + (i%3)*0.15} filter="url(#opBlur)"/>
    ))}
  </svg>
);

/* ═══════════════════════════════
   SYSTEM SELECT
═══════════════════════════════ */
/* ─── D&D — ÍCONE D20 DEMONÍACO ─── */
const DnDDemonIcon = ({ size = 48, glow = false }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ display:"block", filter: glow
      ? "drop-shadow(0 0 8px rgba(220,60,60,0.95)) drop-shadow(0 0 22px rgba(180,30,30,0.6))"
      : "drop-shadow(0 0 4px rgba(200,50,50,0.55))" }}>
    <defs>
      <radialGradient id="dndFace" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stopColor="#f07040"/>
        <stop offset="45%" stopColor="#c03020"/>
        <stop offset="100%" stopColor="#6a0808"/>
      </radialGradient>
      <radialGradient id="dndEye" cx="42%" cy="38%" r="58%">
        <stop offset="0%" stopColor="#ffe080"/>
        <stop offset="40%" stopColor="#e0a020"/>
        <stop offset="100%" stopColor="#804000"/>
      </radialGradient>
      <radialGradient id="dndGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#c03020" stopOpacity="0.35"/>
        <stop offset="100%" stopColor="#800010" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="demonGlow" cx="50%" cy="20%" r="50%">
        <stop offset="0%" stopColor="#ff4040" stopOpacity="0.5"/>
        <stop offset="100%" stopColor="#800010" stopOpacity="0"/>
      </radialGradient>
      <filter id="dndBlur">
        <feGaussianBlur stdDeviation="1" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="dndSoft">
        <feGaussianBlur stdDeviation="0.6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    {/* Ambient red glow */}
    <circle cx="50" cy="55" r="36" fill="url(#dndGlow)"/>
    {/* Demon glow top */}
    <ellipse cx="50" cy="18" rx="28" ry="16" fill="url(#demonGlow)"/>

    {/* ── Demon creature top ── */}
    {/* Head silhouette */}
    <ellipse cx="50" cy="16" rx="10" ry="8" fill="#1a0a0a" filter="url(#dndSoft)"/>
    {/* Left wing */}
    <path d="M40 16 Q28 8 18 12 Q24 18 30 20 Q22 20 16 26 Q26 22 36 22"
      fill="#1a0a0a" filter="url(#dndSoft)"/>
    {/* Right wing */}
    <path d="M60 16 Q72 8 82 12 Q76 18 70 20 Q78 20 84 26 Q74 22 64 22"
      fill="#1a0a0a" filter="url(#dndSoft)"/>
    {/* Glowing red eyes */}
    <circle cx="46" cy="14" r="2.5" fill="#ff2020" filter="url(#dndBlur)"/>
    <circle cx="54" cy="14" r="2.5" fill="#ff2020" filter="url(#dndBlur)"/>
    <circle cx="46" cy="14" r="1.2" fill="#ffaaaa"/>
    <circle cx="54" cy="14" r="1.2" fill="#ffaaaa"/>

    {/* ── Tentacles ── */}
    {/* Left tentacles */}
    <path d="M30 48 Q18 42 14 50 Q10 58 16 62" stroke="#1e0808" strokeWidth="3.5" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    <path d="M32 56 Q20 55 16 64 Q14 72 20 74" stroke="#1e0808" strokeWidth="3" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    <path d="M34 64 Q24 68 22 78 Q24 84 20 88" stroke="#1e0808" strokeWidth="2.5" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    {/* Curl ends left */}
    <path d="M16 62 Q12 66 16 68 Q20 70 18 66" stroke="#1e0808" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M20 74 Q16 80 20 82 Q24 82 22 78" stroke="#1e0808" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    {/* Right tentacles */}
    <path d="M70 48 Q82 42 86 50 Q90 58 84 62" stroke="#1e0808" strokeWidth="3.5" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    <path d="M68 56 Q80 55 84 64 Q86 72 80 74" stroke="#1e0808" strokeWidth="3" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    <path d="M66 64 Q76 68 78 78 Q76 84 80 88" stroke="#1e0808" strokeWidth="2.5" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    {/* Curl ends right */}
    <path d="M84 62 Q88 66 84 68 Q80 70 82 66" stroke="#1e0808" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M80 74 Q84 80 80 82 Q76 82 78 78" stroke="#1e0808" strokeWidth="1.8" strokeLinecap="round" fill="none"/>

    {/* ── D20 icosahedron ── */}
    {/* Outer polygon — 20-sided approximated as layered shapes */}
    {/* Main d20 shape — icosahedron front face */}
    <polygon points="50,24 72,34 78,56 64,74 36,74 22,56 28,34"
      fill="url(#dndFace)" stroke="#2a0808" strokeWidth="1.5" filter="url(#dndSoft)"/>
    {/* Inner edge structure */}
    {/* Top triangle */}
    <polygon points="50,28 68,38 32,38"
      fill="none" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    {/* Middle band lines */}
    <line x1="32" y1="38" x2="22" y2="56" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    <line x1="68" y1="38" x2="78" y2="56" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    <line x1="22" y1="56" x2="36" y2="74" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    <line x1="78" y1="56" x2="64" y2="74" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    <line x1="36" y1="74" x2="64" y2="74" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    {/* Center vertical */}
    <line x1="50" y1="28" x2="50" y2="74" stroke="#2a0808" strokeWidth="1" opacity="0.5"/>
    {/* Horizontal mid */}
    <line x1="22" y1="56" x2="78" y2="56" stroke="#2a0808" strokeWidth="1" opacity="0.5"/>
    {/* Diagonals from mid-top */}
    <line x1="32" y1="38" x2="64" y2="74" stroke="#2a0808" strokeWidth="0.8" opacity="0.4"/>
    <line x1="68" y1="38" x2="36" y2="74" stroke="#2a0808" strokeWidth="0.8" opacity="0.4"/>

    {/* ── Central triangle with eye ── */}
    <polygon points="50,32 66,56 34,56"
      fill="#2a0808" stroke="#e08020" strokeWidth="1" filter="url(#dndBlur)" opacity="0.9"/>
    {/* Eye white glow */}
    <ellipse cx="50" cy="46" rx="10" ry="6" fill="#e09020" filter="url(#dndBlur)" opacity="0.8"/>
    {/* Iris */}
    <ellipse cx="50" cy="46" rx="7" ry="5" fill="url(#dndEye)"/>
    <ellipse cx="50" cy="46" rx="7" ry="5" fill="none" stroke="#c07010" strokeWidth="0.8" opacity="0.7"/>
    {/* Slit pupil */}
    <ellipse cx="50" cy="46" rx="2" ry="4.5" fill="#1a0800"/>
    <ellipse cx="50" cy="46" rx="2" ry="4.5" fill="none" stroke="#c07010" strokeWidth="0.5" opacity="0.6"/>
    {/* Glint */}
    <ellipse cx="47" cy="43.5" rx="2" ry="1.2" fill="#ffffff" opacity="0.6" transform="rotate(-20,47,43.5)"/>

    {/* ── Numbers on d20 faces ── */}
    <text x="50" y="35" textAnchor="middle" fontFamily="serif" fontSize="4" fill="#f0c060" opacity="0.9" fontWeight="bold">20</text>
    <text x="26" y="50" textAnchor="middle" fontFamily="serif" fontSize="4" fill="#f0c060" opacity="0.8">12</text>
    <text x="74" y="50" textAnchor="middle" fontFamily="serif" fontSize="4" fill="#f0c060" opacity="0.8">14</text>
    <text x="38" y="69" textAnchor="middle" fontFamily="serif" fontSize="4" fill="#f0c060" opacity="0.8">8</text>
    <text x="62" y="69" textAnchor="middle" fontFamily="serif" fontSize="4" fill="#f0c060" opacity="0.8">16</text>
    <text x="50" y="73" textAnchor="middle" fontFamily="serif" fontSize="3.5" fill="#f0c060" opacity="0.7">10</text>

    {/* ── Blood drips ── */}
    <path d="M42 74 Q41 80 42 85 Q43 88 42 92" stroke="#800010" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8"/>
    <path d="M50 74 Q50 82 49 88 Q48 92 50 95" stroke="#800010" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7"/>
    <path d="M58 74 Q59 80 58 84 Q57 86 58 88" stroke="#800010" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
    <ellipse cx="42" cy="92" rx="2" ry="1.5" fill="#800010" opacity="0.7"/>
    <ellipse cx="49" cy="95" rx="1.8" ry="1.2" fill="#800010" opacity="0.6"/>
  </svg>
);

const SYSTEMS = [
  {
    id: "op",
    name: "Ordem Paranormal",
    subtitle: "Ordem Paranormal",
    icon: null,
    emblem: "/assets/higgsfield/img/emblem-op.webp",
    idle: "/assets/higgsfield/video/idle-op",
    svgIcon: (glow) => <OPEnergyIcon size={48} glow={glow} />,
    desc: "Enfrente o Outro Lado. Investigue o inexplicável. Sobreviva ao horror sobrenatural.",
    tags: ["Terror","Investigação","Sobrenatural"],
    /* accent derived from theme registry — see getCardAccent overlay below (spec 0017 AC-6) */
    available: true,
  },
  {
    id: "dnd",
    name: "Dungeons & Dragons",
    subtitle: "5ª Edição",
    icon: null,
    emblem: "/assets/higgsfield/img/emblem-dnd.webp",
    idle: "/assets/higgsfield/video/idle-dnd",
    svgIcon: (glow) => <DnDDemonIcon size={48} glow={glow} />,
    desc: "A aventura épica de fantasia mais jogada do mundo. Masmorras, dragões e heróis lendários.",
    tags: ["Fantasia","Combate","Épico"],
    /* accent derived from theme registry (dragon red) — getCardAccent overlay (spec 0017 AC-6) */
    available: false,   // decisão do Andre (2026-07-25): fica em "EM BREVE" até liberar
  },
  {
    id: "tormenta",
    name: "Tormenta 20",
    subtitle: "Sistema Nacional",
    icon: null,
    emblem: "/assets/higgsfield/img/emblem-tormenta.webp",
    idle: "/assets/higgsfield/video/idle-tormenta",
    svgIcon: (glow) => <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" fill={glow?"rgba(210,100,30,0.18)":"rgba(210,100,30,0.08)"} stroke={glow?"#e8622a":"#c45520"} strokeWidth={glow?2:1.5}/><path d="M24 10 L28 20 L38 20 L30 27 L33 37 L24 31 L15 37 L18 27 L10 20 L20 20 Z" fill={glow?"rgba(232,98,42,0.5)":"rgba(196,85,32,0.35)"} stroke={glow?"#ff8c42":"#e8622a"} strokeWidth="1.2"/></svg>,
    desc: "O maior RPG nacional. Fantasia épica com heróis, deuses e a sombra da Tormenta sobre Arton.",
    tags: ["Fantasia","Épico","Nacional"],
    /* accent derived from theme registry (verdant green) — getCardAccent overlay (spec 0017 AC-6) */
    available: false,   // decisão do Andre (2026-07-25): fica em "EM BREVE" até liberar
  },
  {
    id: "3det",
    name: "3D&T Alpha",
    subtitle: "Sistema Nacional",
    icon: "🎌",
    desc: "O clássico sistema brasileiro inspirado em anime e mangá. Simples, rápido e cheio de estilo.",
    tags: ["Anime","Ação","Nacional"],
    accent: "#7a4fa0",
    accentText: "#b87ee0",
    accentGlow: "rgba(122,79,160,0.25)",
    available: true,
    hidden: true,
  },
  {
    id: "call",
    name: "Call of Cthulhu",
    subtitle: "7ª Edição",
    icon: "🐙",
    desc: "Mergulhe na ficção lovecraftiana. Investigadores frágeis contra horrores cósmicos indescritíveis.",
    tags: ["Lovecraft","Horror","Investigação"],
    accent: "#3a6e5a",
    accentText: "#5ec4a0",
    accentGlow: "rgba(58,110,90,0.25)",
    available: false,
    hidden: true,
  },
  {
    id: "vampire",
    name: "Vampire: The Masquerade",
    subtitle: "5ª Edição",
    icon: "🩸",
    desc: "Política, traição e sobrevivência entre as trevas eternas da noite. Você é a criatura das sombras.",
    tags: ["Vampiro","Político","Dark"],
    accent: "#6b1a1a",
    accentText: "#d04545",
    accentGlow: "rgba(107,26,26,0.25)",
    available: false,
    hidden: true,
  },
  {
    id: "custom",
    name: "Sistema Personalizado",
    subtitle: "Em Breve",
    icon: "⚙️",
    desc: "Crie seu próprio sistema do zero. Defina atributos, mecânicas e regras como quiser.",
    tags: ["Custom","Livre","Beta"],
    accent: "#5a5a3a",
    accentText: "#a8a870",
    accentGlow: "rgba(90,90,58,0.2)",
    available: false,
    hidden: true,
  },
]
  /* `hidden` tira o card da vitrine sem apagar a definição (decisão do Andre
   * 2026-07-25: "o resto pode sumir POR ENQUANTO"). Voltar é remover a flag.
   * `available:false` continua sendo o gate de ENTRADA — ver handleSelect e a
   * restauração de `nexus_system`.
   *
   * AC-6: for every system that has a theme in the registry, its card accent is
   * DERIVED from that same registry (single source of truth) — killing the old
   * divergence (D&D card was blue, theme red). Systems without a theme yet
   * (3D&T, Call, Vampire, Custom) keep their literal accent until themed. */
  .map((s) => (SYSTEM_THEMES[s.id] ? { ...s, ...getCardAccent(s.id) } : s));

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
            <a
              href="https://discord.gg/nexusrpg"
              target="_blank"
              rel="noopener noreferrer"
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

/* ═══════════════════════════════
   CHARACTER CREATOR — OP NEXUS
═══════════════════════════════ */

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

/* ── Step progress bar ── */
const StepBar = ({ current }) => {
  const steps = ["Atributos","Origem","Classe","Toques Finais"];
  return (
    <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:0, marginBottom:36}}>
      {steps.map((s,i)=>(
        <div key={s} style={{display:"flex", alignItems:"center"}}>
          <div style={{
            fontFamily:"Cinzel,serif", fontSize:12, letterSpacing:1.5,
            color: i===current?"var(--gold)":i<current?"var(--muted2)":"var(--muted)",
            fontWeight: i===current?"600":"400",
            borderBottom: i===current?"2px solid var(--gold)":"2px solid transparent",
            paddingBottom:4, transition:"all 0.3s",
          }}>{s}</div>
          {i<steps.length-1 && (
            <div style={{width:50,height:1,margin:"0 14px",background:i<current?"rgba(201,168,76,0.5)":"rgba(201,168,76,0.15)"}}/>
          )}
        </div>
      ))}
    </div>
  );
};

const ORIGENS = [
  { id:"academico",    name:"Acadêmico",              skills:["Ciências","Investigação"],      power:"Saber é Poder. Quando faz um teste usando Intelecto, pode gastar 2 PE para receber +5 nesse teste." },
  { id:"saude",        name:"Agente de Saúde",         skills:["Intuição","Medicina"],          power:"Técnica Medicinal. Sempre que cura um personagem, adiciona seu Intelecto no total de PV curados." },
  { id:"artista",      name:"Artista",                 skills:["Artes","Enganação"],            power:"Magnum Opus. Uma vez por missão, pode fazer um personagem te reconhecer, recebendo +5 em testes de Presença contra ele." },
  { id:"atleta",       name:"Atleta",                  skills:["Acrobacia","Atletismo"],        power:"110%. Quando faz um teste de perícia usando Força ou Agilidade (exceto Luta e Pontaria) pode gastar 2 PE para receber +5." },
  { id:"criminoso",    name:"Criminoso",               skills:["Crime","Furtividade"],          power:"O Crime Compensa. No final de uma missão, escolha um item encontrado. Na próxima missão, inclua-o no inventário sem contar no limite." },
  { id:"cultista",     name:"Cultista Arrependido",    skills:["Ocultismo","Religião"],         power:"Traços do Outro Lado. Você possui um poder paranormal à sua escolha. Porém, começa com metade da Sanidade normal." },
  { id:"desgarrado",   name:"Desgarrado",              skills:["Fortitude","Sobrevivência"],    power:"Calejado. Você recebe +1 PV para cada 5% de NEX." },
  { id:"engenheiro",   name:"Engenheiro",              skills:["Profissão","Tecnologia"],       power:"Ferramenta Favorita. Um item à sua escolha (exceto armas) conta como uma categoria abaixo." },
  { id:"executivo",    name:"Executivo",               skills:["Diplomacia","Profissão"],       power:"Processo Otimizado. Em testes estendidos ou para revisar documentos, pode gastar 2 PE para receber +5." },
  { id:"investigador", name:"Investigador",            skills:["Investigação","Percepção"],     power:"Faro para Pistas. Uma vez por cena, quando procurar pistas, pode gastar 1 PE para receber +5 no teste." },
  { id:"lutador",      name:"Lutador",                 skills:["Luta","Reflexos"],              power:"Mão Pesada. Você recebe +2 em rolagens de dano com ataques corpo a corpo." },
  { id:"magnata",      name:"Magnata",                 skills:["Diplomacia","Pilotagem"],       power:"Patrocinador da Ordem. Seu limite de crédito é sempre considerado um acima do atual." },
  { id:"mercenario",   name:"Mercenário",              skills:["Iniciativa","Intimidação"],     power:"Posição de Combate. No primeiro turno de cada cena de ação, pode gastar 2 PE para receber uma ação de movimento adicional." },
  { id:"militar",      name:"Militar",                 skills:["Pontaria","Tática"],            power:"Para Bellum. Você recebe +2 em rolagens de dano com armas de fogo." },
  { id:"policial",     name:"Policial",                skills:["Percepção","Pontaria"],         power:"Patrulha. Você recebe +2 em Defesa." },
  { id:"religioso",    name:"Religioso",               skills:["Religião","Vontade"],           power:"Acalentar. Recebe +5 em testes de Religião para acalmar. Quando acalma uma pessoa, ela recebe 1d6 + Presença de SAN." },
  { id:"servidor",     name:"Servidor Público",        skills:["Intuição","Vontade"],           power:"Espírito Cívico. Sempre que faz um teste para ajudar, pode gastar 1 PE para aumentar o bônus concedido em +2." },
  { id:"ti",           name:"T.I.",                    skills:["Investigação","Tecnologia"],    power:"Motor de Busca. Com acesso à internet, pode gastar 2 PE para substituir qualquer perícia por um teste de Tecnologia." },
  { id:"universitario",name:"Universitário",           skills:["Atualidades","Investigação"],  power:"Dedicação. Recebe +1 PE, mais 1 PE a cada NEX ímpar. Seu limite de PE por turno aumenta em 1." },
  { id:"vitima",       name:"Vítima",                  skills:["Reflexos","Vontade"],           power:"Cicatrizes Psicológicas. Você recebe +1 de Sanidade para cada 5% de NEX." },
  { id:"amnésico",     name:"Amnésico",                skills:["À escolha","À escolha"],        power:"Vislumbres do Passado. Uma vez por sessão, teste de Intelecto (DT 10) para reconhecer pessoas/lugares. Se passar, recebe 1d4 PE temporários." },
  { id:"chef",         name:"Chef",                    skills:["Fortitude","Profissão"],         power:"Ingrediente Secreto. Uma vez por missão, durante uma ação de interlúdio, prepare uma refeição especial. Todos que comerem recebem 1d6 + Presença de PV temporários que duram até o início da próxima cena de ação." },
  { id:"operario",     name:"Operário",                skills:["Atletismo","Profissão"],          power:"Mão na Massa. Você reduz em 2 horas o tempo necessário para trabalhar em tarefas manuais e recebe +2 em testes de perícia para construir, reparar ou modificar objetos." },
  { id:"teorico",      name:"Teórico da Conspiração",  skills:["Investigação","Ocultismo"],       power:"Eu Já Sabia. Você não se abala tanto com entidades ou anomalias. Afinal, sempre soube que isso tudo existia. Você recebe resistência a dano mental igual ao seu Intelecto." },
  { id:"rural",        name:"Trabalhador Rural",        skills:["Adestramento","Sobrevivência"],   power:"Desbravador. Quando faz um teste de Adestramento, Atletismo ou Sobrevivência em terrenos abertos, pode gastar 1 PE para receber +5 nesse teste." },
];

/* ── Ordem Paranormal: Trilhas por classe ── */
const CLASS_TRAILS = {
  combatente:  [{id:"atirador_c",name:"Atirador"},{id:"chefe",name:"Chefe"},{id:"guerreiro",name:"Guerreiro"}],
  especialista:[{id:"atirador_e",name:"Atirador de Elite"},{id:"medico",name:"Médico de Campo"},{id:"negociador",name:"Negociador"}],
  ocultista:   [{id:"iluminado",name:"Iluminado"},{id:"graduado",name:"Graduado"},{id:"intuitivo",name:"Intuitivo"}],
};

/* ── Habilidades de Trilha ── */
const TRAIL_ABILITIES = {
  atirador_c:{
    10:{name:"Tiro Preciso",     cost:"—",          desc:"Você ignora bônus de cobertura em seus ataques com armas de disparo e pode atacar além do alcance normal sem penalidade."},
    40:{name:"Ponto Fraco",      cost:"2 PE",        desc:"Uma vez por rodada, ao acertar com arma de disparo, gaste 2 PE para causar dano adicional igual ao seu valor de Agilidade."},
    65:{name:"Tiro Mortal",      cost:"—",           desc:"Seus ataques com armas de disparo ignoram resistência a dano físico dos alvos."},
    99:{name:"Bala de Prata",    cost:"5 PE",        desc:"Uma vez por cena, faça um ataque com arma de disparo com vantagem. Se acertar, causa o dano máximo possível."},
  },
  chefe:{
    10:{name:"Inspirar Confiança",cost:"2 PE (reação)",desc:"Faça um aliado em alcance curto rolar novamente um teste recém realizado."},
    40:{name:"Estrategista",      cost:"1 PE/aliado", desc:"Use uma ação padrão para direcionar aliados (limitado pelo INT). No próximo turno deles, ganham uma ação de movimento adicional."},
    65:{name:"Brecha na Guarda",  cost:"2 PE (reação)",desc:"Quando um aliado causar dano em um inimigo no alcance curto, você ou outro aliado pode fazer um ataque adicional contra o mesmo inimigo."},
    99:{name:"Oficial Comandante",cost:"5 PE",        desc:"Cada aliado em alcance médio recebe uma ação padrão adicional no próximo turno."},
  },
  guerreiro:{
    10:{name:"Técnica Letal",   cost:"—",           desc:"+2 na margem de ameaça com todos os ataques corpo a corpo."},
    40:{name:"Revidar",         cost:"2 PE (reação)",desc:"Sempre que bloquear um ataque, faça um ataque corpo a corpo no inimigo que o atacou."},
    65:{name:"Força Opressora", cost:"1 PE",         desc:"Quando acerta um ataque corpo a corpo, realize uma manobra derrubar ou empurrar como ação livre."},
    99:{name:"Potência Máxima", cost:"—",            desc:"Quando usa Ataque Especial com armas corpo a corpo, todos os dados de dano são considerados o resultado máximo."},
  },
  atirador_e:{
    10:{name:"Foco Total",       cost:"—",     desc:"Quando usa a ação mirar, você recebe +5 no teste de ataque e +1d6 na rolagem de dano."},
    40:{name:"Execução",         cost:"—",     desc:"Se um alvo está inconsciente ou não sabe que você está lá, seu ataque causa dano máximo."},
    65:{name:"Tiro Perfurante",  cost:"—",     desc:"Seus ataques com armas de fogo podem atingir todos os alvos em linha reta no alcance da arma."},
    99:{name:"Sniper Lendário",  cost:"5 PE",  desc:"Uma vez por cena, faça um ataque que ignora todos os bônus de Defesa, resistência e cobertura do alvo."},
  },
  medico:{
    10:{name:"Paramédico",      cost:"2 PE",   desc:"Use uma ação padrão e 2 PE para curar 2d10 PV de si mesmo ou de um aliado adjacente. Em NEX 40%, 65% e 99%, cura +1d10 PV por +1 PE."},
    40:{name:"Equipe de Trauma",cost:"2 PE",   desc:"Use uma ação padrão e 2 PE para remover uma condição negativa (exceto morrendo) de um aliado adjacente."},
    65:{name:"Resgate",         cost:"—",      desc:"Uma vez por rodada, se em alcance curto de aliado machucado ou morrendo, aproxime-se como ação livre. Ao curar, você e o aliado recebem +5 na Defesa até o próximo turno."},
    99:{name:"Reanimação",      cost:"10 PE",  desc:"Uma vez por cena, gaste uma ação completa e 10 PE para trazer de volta à vida um personagem que morreu na mesma cena (exceto dano massivo)."},
  },
  negociador:{
    10:{name:"Eloquência",          cost:"1 PE/alvo",desc:"Use uma ação completa e 1 PE por alvo para afetá-los com sua fala. Faça Diplomacia, Enganação ou Intimidação contra a Vontade deles."},
    40:{name:"Persuasão Profunda",  cost:"—",       desc:"Quando usa Eloquência e vence por 10 ou mais, o alvo fica sob efeito por toda a cena."},
    65:{name:"Psicologia Aplicada", cost:"3 PE",    desc:"Uma vez por cena, teste de Intuição (DT 15) para descobrir uma fraqueza ou motivação. Receba +5 em testes de Presença contra esse personagem."},
    99:{name:"Mestre das Palavras", cost:"—",       desc:"Você pode usar Eloquência como ação padrão. Aliados em alcance curto recebem +5 em testes de Presença."},
  },
  iluminado:{
    10:{name:"Canalizar Energia", cost:"1 PE",    desc:"Gaste uma ação padrão e 1 PE para canalizar energia paranormal, recebendo PE temporários igual ao círculo do ritual utilizado."},
    40:{name:"Toque do Outro Lado",cost:"+2 PE",  desc:"Ao lançar um ritual, gaste 2 PE extras para aumentar seu efeito em 50% (dano, cura, duração ou área)."},
    65:{name:"Transcender a Dor", cost:"1 PE/5dmg",desc:"Quando recebe dano, pode gastar 1 PE por 5 pontos de dano para convertê-lo de PV para Sanidade."},
    99:{name:"Medo Tangível",     cost:"—",       desc:"Você aprende o ritual Medo Tangível."},
  },
  graduado:{
    10:{name:"Saber Ampliado",       cost:"—", desc:"Aprenda um ritual de 1° círculo adicional. Toda vez que ganha acesso a um novo círculo, aprende um ritual adicional daquele círculo."},
    40:{name:"Grimório Ritualístico", cost:"—", desc:"Crie um grimório especial. Aprenda rituais de 1° ou 2° círculos iguais ao seu INT. O grimório ocupa 1 espaço no inventário."},
    65:{name:"Rituais Eficientes",    cost:"—", desc:"A DT para resistir a todos os seus rituais aumenta em +5."},
    99:{name:"Conhecendo o Medo",     cost:"—", desc:"Você aprende o ritual Conhecendo o Medo."},
  },
  intuitivo:{
    10:{name:"Mente Sã",       cost:"—",    desc:"Você recebe resistência paranormal +5 (+5 em testes de resistência contra efeitos paranormais)."},
    40:{name:"Barreira Mental", cost:"—",   desc:"Quando passa em um teste de resistência contra efeito paranormal, recupera 1d6 de Sanidade."},
    65:{name:"Vontade de Ferro",cost:"2 PE",desc:"Role novamente um teste de resistência contra efeito paranormal. Seu valor máximo de Sanidade aumenta em 10."},
    99:{name:"Além do Alcance", cost:"—",  desc:"Imune a efeitos de medo paranormal e sua Sanidade não pode ser reduzida abaixo de 1 por efeitos paranormais."},
  },
};

/* ── Habilidades Base por Classe (excluindo trilha) ── */
const CLASS_BASE_ABILITIES = {
  combatente:[
    {nex:5,  name:"Ataque Especial",    cost:"2 PE",  desc:"Quando faz um ataque, gaste 2 PE para receber +5 no teste de ataque ou na rolagem de dano."},
    {nex:10, name:"Habilidade de Trilha",cost:"—",   desc:"Escolha uma trilha de Combatente e receba seu 1° poder."},
    {nex:15, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:20, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo à sua escolha em +1 (máximo 5)."},
    {nex:25, name:"Ataque Especial ↑",  cost:"3 PE", desc:"Gaste 3 PE para receber +10 (em bônus de +5) no ataque ou dano."},
    {nex:30, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:35, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; seu grau de treinamento nelas aumenta em um."},
    {nex:40, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 2° poder da sua trilha de Combatente."},
    {nex:45, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:50, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:50, name:"Versatilidade",      cost:"—",    desc:"Escolha um poder de combatente ou o 1° poder de uma trilha que não a sua."},
    {nex:55, name:"Ataque Especial ↑",  cost:"4 PE", desc:"Gaste 4 PE para receber +15 no ataque ou dano."},
    {nex:60, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:65, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 3° poder da sua trilha de Combatente."},
    {nex:70, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:75, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:80, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:85, name:"Ataque Especial ↑",  cost:"5 PE", desc:"Gaste 5 PE para receber +20 no ataque ou dano."},
    {nex:90, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:95, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:99, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 4° e último poder da sua trilha de Combatente."},
  ],
  especialista:[
    {nex:5,  name:"Eclético",           cost:"2 PE",  desc:"Gaste 2 PE para receber os benefícios de ser treinado em qualquer perícia usada."},
    {nex:5,  name:"Perito (1d6)",       cost:"2 PE",  desc:"Escolha duas perícias treinadas. Gaste 2 PE para somar +1d6 no resultado do teste."},
    {nex:10, name:"Habilidade de Trilha",cost:"—",   desc:"Escolha uma trilha de Especialista e receba seu 1° poder."},
    {nex:15, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:20, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:25, name:"Perito (1d8)",       cost:"3 PE",  desc:"Gaste 3 PE para somar +1d8 no resultado do teste."},
    {nex:30, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:35, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:40, name:"Engenhosidade",      cost:"+2 PE", desc:"Ao usar Eclético, gaste +2 PE adicionais para receber os benefícios de veterano na perícia."},
    {nex:40, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 2° poder da sua trilha de Especialista."},
    {nex:45, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:50, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:50, name:"Versatilidade",      cost:"—",    desc:"Escolha um poder de especialista ou o 1° poder de uma trilha que não a sua."},
    {nex:55, name:"Perito (1d10)",      cost:"4 PE",  desc:"Gaste 4 PE para somar +1d10 no resultado do teste."},
    {nex:60, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:65, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 3° poder da sua trilha de Especialista."},
    {nex:70, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:75, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:75, name:"Engenhosidade Avançada",cost:"+4 PE",desc:"Ao usar Eclético, gaste +4 PE adicionais para receber benefícios de expert na perícia."},
    {nex:80, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:85, name:"Perito (1d12)",      cost:"5 PE",  desc:"Gaste 5 PE para somar +1d12 no resultado do teste."},
    {nex:90, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:95, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:99, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 4° e último poder da sua trilha de Especialista."},
  ],
  ocultista:[
    {nex:5,  name:"Escolhido pelo Outro Lado",cost:"—", desc:"Lança rituais de 1° círculo. Começa com 3 rituais de 1° círculo. Aprende 1 ritual adicional a cada NEX."},
    {nex:10, name:"Habilidade de Trilha",     cost:"—", desc:"Escolha uma trilha de Ocultista e receba seu 1° poder."},
    {nex:15, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:20, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:25, name:"Rituais de 2° Círculo",    cost:"—", desc:"Você agora pode lançar rituais de 2° círculo."},
    {nex:30, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:35, name:"Grau de Treinamento",      cost:"—", desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:40, name:"Habilidade de Trilha",     cost:"—", desc:"Receba o 2° poder da sua trilha de Ocultista."},
    {nex:45, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:50, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:50, name:"Versatilidade",            cost:"—", desc:"Escolha um poder de ocultista ou o 1° poder de uma trilha que não a sua."},
    {nex:55, name:"Rituais de 3° Círculo",    cost:"—", desc:"Você agora pode lançar rituais de 3° círculo."},
    {nex:60, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:65, name:"Habilidade de Trilha",     cost:"—", desc:"Receba o 3° poder da sua trilha de Ocultista."},
    {nex:70, name:"Grau de Treinamento",      cost:"—", desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:75, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:80, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:85, name:"Rituais de 4° Círculo",    cost:"—", desc:"Você agora pode lançar rituais de 4° círculo."},
    {nex:90, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:95, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:99, name:"Habilidade de Trilha",     cost:"—", desc:"Receba o 4° e último poder da sua trilha de Ocultista."},
  ],
};

const CLASSES = [
  {
    id:"combatente", name:"Combatente", icon:"⚔️",
    desc:"Treinado para lutar com todo tipo de armas, e com a força e a coragem para encarar os perigos de frente.",
    detail:"Do mercenário especialista em armas de fogo até o perito em espadas, combatentes apresentam uma gama enorme de habilidades e técnicas especiais que aprimoram sua eficiência no campo de batalha.",
    bonus:"PV +4 · Ataque +2 · Resistência Física",
  },
  {
    id:"especialista", name:"Especialista", icon:"🔬",
    desc:"Um agente que confia mais em esperteza do que em força bruta. Se vale de conhecimento técnico e raciocínio rápido.",
    detail:"Cientistas, inventores, pesquisadores e técnicos de vários tipos são exemplos de especialistas, tão variados quanto as áreas do conhecimento e da tecnologia.",
    bonus:"PE +4 · Perícia +2 · Conhecimento Amplo",
  },
  {
    id:"ocultista", name:"Ocultista", icon:"🌀",
    desc:"O Outro Lado é misterioso, perigoso e, de certa forma, cativante. Possui talento para se conectar com elementos paranormais.",
    detail:"Ao contrário da crença popular, ocultistas não são intrinsecamente malignos. São agentes que buscam compreender e dominar os mistérios paranormais para usá-los contra o próprio Outro Lado.",
    bonus:"SAN +4 · Rituais +2 · Afinidade Paranormal",
  },
];

/* ── D&D 5e / generic character creator ─────────────────────────────── */
const DND_CLASSES = ["Bárbaro","Bardo","Bruxo","Clérigo","Druida","Feiticeiro","Guerreiro","Ladino","Mago","Monge","Paladino","Patrulheiro"];
const DND_RACES   = ["Anão","Elfo","Halfling","Humano","Draconato","Gnomo","Meio-Elfo","Meio-Orc","Tiefling"];
const DND_THEMES  = { Bárbaro:"#e53935",Bardo:"#ab47bc",Bruxo:"#7e57c2",Clérigo:"#f9a825",Druida:"#43a047",Feiticeiro:"#ef6c00",Guerreiro:"#1976d2",Ladino:"#546e7a",Mago:"#5c6bc0",Monge:"#00838f",Paladino:"#f57f17",Patrulheiro:"#2e7d32" };

function DnDCharacterCreator({ onFinish, onCancel }) {
  const [name,   setName]   = useState("");
  const [classe, setClasse] = useState("");
  const [raca,   setRaca]   = useState("");
  const [err,    setErr]    = useState("");
  const accent = DND_THEMES[classe] || "#c9a84c";
  const sI = { width:"100%", background:"rgba(0,0,0,0.45)", border:"1px solid rgba(201,168,76,0.25)", borderRadius:6, color:"#e8d9b0", padding:"10px 14px", fontSize:14, fontFamily:"'IM Fell English',serif", outline:"none", boxSizing:"border-box" };
  return (
    <div style={{ minHeight:"100vh", background:"#0a0804", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"min(480px,100%)", background:"#110e08", border:`1px solid ${accent}55`, borderRadius:12, padding:"36px 32px", boxShadow:`0 0 60px ${accent}22` }}>
        <div style={{ marginBottom:28, textAlign:"center" }}>
          <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:11, letterSpacing:3, color:"rgba(201,168,76,0.5)", textTransform:"uppercase", marginBottom:6 }}>Dungeons & Dragons 5ª Ed.</div>
          <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:22, color:accent, margin:0, textShadow:`0 0 20px ${accent}88` }}>Nova Ficha de Herói</h1>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <div>
            <div style={{ fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:2, color:"rgba(201,168,76,0.6)", textTransform:"uppercase", marginBottom:6 }}>Nome do Personagem *</div>
            <input value={name} onChange={e=>{ setName(e.target.value); setErr(""); }} placeholder="Ex: Aragorn, Gandalf…" style={sI} autoFocus/>
            {err && <div style={{ color:"#e57373", fontSize:11, marginTop:4, fontFamily:"Cinzel,serif" }}>{err}</div>}
          </div>
          <div>
            <div style={{ fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:2, color:"rgba(201,168,76,0.6)", textTransform:"uppercase", marginBottom:6 }}>Classe</div>
            <select value={classe} onChange={e=>setClasse(e.target.value)} style={{ ...sI, appearance:"auto", cursor:"pointer" }}>
              <option value="">— Escolher depois —</option>
              {DND_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:2, color:"rgba(201,168,76,0.6)", textTransform:"uppercase", marginBottom:6 }}>Raça</div>
            <select value={raca} onChange={e=>setRaca(e.target.value)} style={{ ...sI, appearance:"auto", cursor:"pointer" }}>
              <option value="">— Escolher depois —</option>
              {DND_RACES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:28 }}>
          <button onClick={onCancel} style={{ flex:1, background:"transparent", border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.5)", borderRadius:7, padding:"12px 0", fontFamily:"Cinzel,serif", fontSize:11, letterSpacing:1.5, textTransform:"uppercase", cursor:"pointer" }}>Cancelar</button>
          <button onClick={()=>{ if(!name.trim()){setErr("Dê um nome ao seu personagem.");return;} onFinish({ form:{ personagem:name.trim(), raca, classe } }); }}
            style={{ flex:2, background:`linear-gradient(135deg,${accent}cc,${accent}88)`, border:"none", color:"#fff", borderRadius:7, padding:"12px 0", fontFamily:"'Cinzel Decorative',serif", fontSize:12, letterSpacing:1, cursor:"pointer", boxShadow:`0 4px 20px ${accent}44` }}>
            Criar Personagem
          </button>
        </div>
      </div>
    </div>
  );
}

function CharacterCreator({ onFinish, onCancel }) {
  const [step, setStep] = useState(0);
  const [attrs, setAttrs] = useState({ AGI:1, FOR:1, INT:1, PRE:1, VIG:1 });
  const [pontos, setPontos] = useState(4);
  const [origem, setOrigem] = useState(null);
  const [classe, setClasse] = useState(null);
  const [form, setForm] = useState({ personagem:"", jogador:"", aparencia:"", personalidade:"", historico:"", objetivo:"", avatar:"" });
  const avatarInputRef = useRef(null);
  const aiArtEnabled = localStorage.getItem("nexus_ai_art") === "1";
  const [aiComingSoon, setAiComingSoon] = useState(false);
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, avatar: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const totalUsed = Object.values(attrs).reduce((a,b)=>a+b,0) - 5;
  const pontosRestantes = 4 - totalUsed;

  const changeAttr = (key, delta) => {
    const next = attrs[key] + delta;
    if (next < 0 || next > 3) return;
    if (delta > 0 && pontosRestantes <= 0) return;
    setAttrs(a => ({ ...a, [key]: next }));
  };

  const S = { // shared styles
    section: { background:"var(--card)", border:"1px solid var(--border)", borderRadius:10, padding:24 },
    label: { fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase", marginBottom:6, display:"block" },
    h2: { fontFamily:"'Cinzel Decorative',serif", fontSize:24, background:"linear-gradient(135deg,#c9a84c,#e8c96d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", marginBottom:14 },
    desc: { fontFamily:"Crimson Pro,serif", fontSize:18, color:"var(--muted2)", lineHeight:1.8, fontStyle:"italic" },
  };

  /* STEP 0 — ATRIBUTOS */
  const StepAtributos = () => (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, alignItems:"start"}}>
      <div>
        <div style={S.h2}>Distribua seus Atributos</div>
        <p style={S.desc}>
          Quando você cria um personagem, todos os seus atributos começam em <strong style={{color:"var(--gold)"}}>1</strong> e você recebe <strong style={{color:"var(--gold)"}}>4 pontos</strong> para distribuir entre eles como quiser. Você também pode reduzir um atributo para 0 para receber <strong style={{color:"var(--gold)"}}>1 ponto adicional</strong>. O valor máximo inicial que você pode ter em cada atributo é <strong style={{color:"var(--gold)"}}>3</strong>.<br/><br/>
          <em>Ao rolar um teste, você rola N dados d20 iguais ao valor do atributo e usa o <strong style={{color:"var(--gold)"}}>maior resultado</strong>. Se o atributo for 0, rola 2d20 e usa o <strong style={{color:"#c05050"}}>pior</strong>.</em>
        </p>
        <div style={{marginTop:24, display:"flex", flexDirection:"column", gap:12}}>
          {/* Points remaining */}
          <div style={{
            display:"flex", alignItems:"center", gap:12,
            padding:"12px 16px", borderRadius:8,
            background: pontosRestantes > 0 ? "rgba(201,168,76,0.07)" : pontosRestantes === 0 ? "rgba(76,175,80,0.07)" : "rgba(139,32,32,0.1)",
            border: `1px solid ${pontosRestantes > 0 ? "rgba(201,168,76,0.3)" : pontosRestantes === 0 ? "rgba(76,175,80,0.3)" : "rgba(200,50,50,0.4)"}`,
          }}>
            <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:28, color: pontosRestantes>0?"var(--gold)":pontosRestantes===0?"#4caf50":"#c03020"}}>{Math.max(0,pontosRestantes)}</div>
            <div>
              <div style={{fontFamily:"Cinzel,serif", fontSize:13, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase"}}>Pontos Restantes</div>
              <div style={{fontFamily:"Crimson Pro,serif", fontSize:16, color:"var(--muted2)", fontStyle:"italic"}}>
                {pontosRestantes>0?"Distribua os pontos nos atributos →":pontosRestantes===0?"✓ Todos os pontos distribuídos":"Você reduziu atributos e ganhou pontos extras"}
              </div>
            </div>
          </div>
          {/* Attr list for mobile/reference */}
          {Object.entries(attrs).map(([k,v])=>{
            const labels = { AGI:"Agilidade", FOR:"Força", INT:"Intelecto", PRE:"Presença", VIG:"Vigor" };
            return (
              <div key={k} style={{display:"flex", alignItems:"center", gap:10}}>
                <span style={{fontFamily:"Cinzel,serif", fontSize:13, color:"var(--gold)", width:36}}>{k}</span>
                <span style={{fontFamily:"Crimson Pro,serif", fontSize:17, color:"var(--muted2)", flex:1}}>{labels[k]}</span>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <button onClick={()=>changeAttr(k,-1)} style={{width:30,height:30,borderRadius:4,border:"1px solid var(--border2)",background:"transparent",color:"var(--gold)",cursor:"pointer",fontFamily:"serif",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                  <div style={{width:36,textAlign:"center",fontFamily:"Cinzel,serif",fontSize:20,color:"var(--text)",fontWeight:600}}>{v}</div>
                  <button onClick={()=>changeAttr(k,+1)} style={{width:30,height:30,borderRadius:4,border:"1px solid var(--border2)",background:"transparent",color:"var(--gold)",cursor:"pointer",fontFamily:"serif",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                </div>
                <div style={{width:60,height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(v/5)*100}%`,background:"linear-gradient(90deg,var(--gold3),var(--gold2))",borderRadius:2,transition:"width 0.2s"}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* SVG Diagram */}
      <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:16}}>
        <AttrDiagram attrs={attrs} onChange={changeAttr} onRoll={null}/>
        <div style={{fontFamily:"Cinzel,serif", fontSize:11, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase", textAlign:"center"}}>
          Clique nos botões do diagrama ou use a lista
        </div>
      </div>
    </div>
  );

  /* STEP 1 — ORIGEM */
  const StepOrigem = () => {
    const [search, setSearch] = useState("");
    const filtered = ORIGENS.filter(o=>o.name.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="fade" style={{display:"flex", flexDirection:"column", gap:20}}>
        <div>
          <div style={S.h2}>Escolha sua Origem</div>
          <p style={S.desc}>
            O que seu personagem fazia antes de se envolver com o paranormal e ingressar na Ordem da Realidade? A origem representa como a vida pregressa influencia sua carreira de investigador.<br/>
            <strong style={{color:"var(--gold)", fontStyle:"normal"}}>Ao escolher uma origem, você recebe duas perícias treinadas e um poder da origem.</strong>
          </p>
          <div style={{marginTop:16, padding:"10px 14px", background:"var(--gold-dim)", border:"1px solid var(--border)", borderRadius:6}}>
            <span style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1, color:"var(--muted2)"}}>Perícias concedidas serão adicionadas automaticamente. Perícias opcionais podem ser adicionadas ao agente após sua criação.</span>
          </div>
        </div>
        {/* Search */}
        <div style={{position:"relative"}}>
          <span style={{position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", fontSize:16}}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar origem..." style={{paddingLeft:38}}/>
        </div>
        {/* Origem cards */}
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {filtered.map(o=>{
            const isSelected = origem?.id === o.id;
            return (
              <div key={o.id} style={{
                borderRadius:8, overflow:"hidden",
                border:`1px solid ${isSelected?"rgba(201,168,76,0.5)":"var(--border)"}`,
                background: isSelected?"rgba(201,168,76,0.05)":"var(--card)",
                transition:"all 0.2s",
              }}>
                <div style={{
                  display:"flex", alignItems:"center", gap:12,
                  padding:"14px 18px", cursor:"pointer",
                }} onClick={()=>setOrigem(o)}>
                  <div style={{
                    width:8, height:8, borderRadius:"50%",
                    background: isSelected?"var(--gold)":"var(--muted)",
                    transition:"background 0.2s", flexShrink:0,
                  }}/>
                  <span style={{fontFamily:"Cinzel,serif", fontSize:14, color:"var(--text)", flex:1}}>{o.name}</span>
                  <div style={{display:"flex", gap:6}}>
                    {o.skills.map(s=>(
                      <span key={s} style={{fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:1, padding:"2px 8px", borderRadius:20, border:"1px solid rgba(201,168,76,0.2)", color:"var(--muted2)"}}>{s}</span>
                    ))}
                  </div>
                  <button style={{
                    padding:"6px 16px", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2,
                    textTransform:"uppercase", cursor:"pointer", borderRadius:4, transition:"all 0.2s",
                    background: isSelected?"linear-gradient(135deg,#c9a84c,#e8c96d,#a07830)":"transparent",
                    border: isSelected?"none":"1px solid var(--border2)",
                    color: isSelected?"#050505":"var(--gold)",
                    fontWeight: isSelected?"700":"400",
                  }} onClick={(e)=>{e.stopPropagation();setOrigem(o);}}>
                    {isSelected?"✓ Escolhida":"Escolher"}
                  </button>
                </div>
                {/* Expanded info */}
                {isSelected && (
                  <div style={{padding:"0 18px 14px 38px", borderTop:"1px solid var(--border)"}}>
                    <div style={{paddingTop:12, fontFamily:"Crimson Pro,serif", fontSize:14, color:"var(--muted2)", fontStyle:"italic", lineHeight:1.65}}>
                      <strong style={{color:"var(--gold)", fontStyle:"normal"}}>Poder: </strong>{o.power}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* STEP 2 — CLASSE */
  const ClassIcon = ({id}) => {
    if (id === "combatente") return (
      <svg viewBox="0 0 80 96" width="68" height="68" fill="none">
        {/* left wing */}
        <path d="M38 44 C30 36 16 33 4 18 C13 23 21 23 27 30 C19 21 13 11 16 3 C23 14 28 23 34 35" fill="#8B1A1A"/>
        <path d="M34 35 C28 28 20 26 14 30 C20 30 27 33 35 40" fill="#7B1414" opacity="0.7"/>
        {/* right wing */}
        <path d="M42 44 C50 36 64 33 76 18 C67 23 59 23 53 30 C61 21 67 11 64 3 C57 14 52 23 46 35" fill="#8B1A1A"/>
        <path d="M46 35 C52 28 60 26 66 30 C60 30 53 33 45 40" fill="#7B1414" opacity="0.7"/>
        {/* blade */}
        <polygon points="40,3 44,46 40,55 36,46" fill="#C0392B"/>
        {/* blood drip tip */}
        <path d="M40 55 L37 60 L40 68 L43 60 Z" fill="#E74C3C" opacity="0.85"/>
        {/* cross guard */}
        <path d="M26 48 C33 45 47 45 54 48 C47 51 33 51 26 48Z" fill="#922B21"/>
        {/* handle */}
        <rect x="38" y="51" width="4" height="18" rx="2" fill="#7B241C"/>
        {/* pommel */}
        <ellipse cx="40" cy="72" rx="6" ry="5" fill="#922B21"/>
        <ellipse cx="40" cy="72" rx="3" ry="2.5" fill="#C0392B" opacity="0.6"/>
      </svg>
    );
    if (id === "especialista") return (
      <svg viewBox="0 0 80 80" width="68" height="68" fill="none">
        {/* outer star / sunburst */}
        <polygon points="40,2 43,28 62,14 49,34 76,34 52,44 68,66 42,52 44,78 40,54 36,78 38,52 12,66 28,44 4,34 31,34 18,14 37,28" fill="none" stroke="#7B2FBE" strokeWidth="1.2" opacity="0.8"/>
        {/* inner ring */}
        <circle cx="40" cy="40" r="14" fill="none" stroke="#9B59B6" strokeWidth="1.5"/>
        {/* eye outline */}
        <path d="M26 40 Q40 28 54 40 Q40 52 26 40Z" fill="#4A235A" stroke="#9B59B6" strokeWidth="1"/>
        {/* iris */}
        <circle cx="40" cy="40" r="7" fill="#7B2FBE"/>
        {/* pupil */}
        <circle cx="40" cy="40" r="4" fill="#1a0828"/>
        {/* spiral in pupil */}
        <path d="M40 38 Q42 38 42 40 Q42 42 40 42 Q38 42 38 40 Q38 39 39 38.5" fill="none" stroke="#9B59B6" strokeWidth="0.8"/>
        {/* corner glows */}
        <circle cx="40" cy="4"  r="2" fill="#A569BD" opacity="0.7"/>
        <circle cx="76" cy="40" r="2" fill="#A569BD" opacity="0.7"/>
        <circle cx="40" cy="76" r="2" fill="#A569BD" opacity="0.7"/>
        <circle cx="4"  cy="40" r="2" fill="#A569BD" opacity="0.7"/>
      </svg>
    );
    /* ocultista */
    return (
      <svg viewBox="0 0 80 80" width="68" height="68" fill="none">
        {/* outer rune ring */}
        <circle cx="40" cy="40" r="37" stroke="#6C3483" strokeWidth="1" strokeDasharray="3 4" opacity="0.9"/>
        <circle cx="40" cy="40" r="31" stroke="#7D3C98" strokeWidth="0.8" opacity="0.6"/>
        {/* dark void */}
        <circle cx="40" cy="40" r="11" fill="#12052a"/>
        <circle cx="40" cy="40" r="11" stroke="#8E44AD" strokeWidth="1.5"/>
        {/* cardinal flame spikes */}
        <path d="M40 29 C37 23 32 18 35 11 C38 18 40 23 40 29Z" fill="#7B2FBE"/>
        <path d="M40 29 C43 23 48 18 45 11 C42 18 40 23 40 29Z" fill="#6C3483"/>
        <path d="M51 40 C57 37 62 32 69 35 C62 38 57 40 51 40Z" fill="#7B2FBE"/>
        <path d="M51 40 C57 43 62 48 69 45 C62 42 57 40 51 40Z" fill="#6C3483"/>
        <path d="M40 51 C37 57 32 62 35 69 C38 62 40 57 40 51Z" fill="#7B2FBE"/>
        <path d="M40 51 C43 57 48 62 45 69 C42 62 40 57 40 51Z" fill="#6C3483"/>
        <path d="M29 40 C23 37 18 32 11 35 C18 38 23 40 29 40Z" fill="#7B2FBE"/>
        <path d="M29 40 C23 43 18 48 11 45 C18 42 23 40 29 40Z" fill="#6C3483"/>
        {/* diagonal spikes */}
        <path d="M32 32 C26 25 23 18 17 17 C22 23 27 28 32 32Z" fill="#8E44AD" opacity="0.8"/>
        <path d="M48 32 C54 25 57 18 63 17 C58 23 53 28 48 32Z" fill="#8E44AD" opacity="0.8"/>
        <path d="M48 48 C54 55 57 62 63 63 C58 57 53 52 48 48Z" fill="#8E44AD" opacity="0.8"/>
        <path d="M32 48 C26 55 23 62 17 63 C22 57 27 52 32 48Z" fill="#8E44AD" opacity="0.8"/>
        {/* rune ticks on outer ring */}
        {[0,30,60,90,120,150,180,210,240,270,300,330].map(a=>(
          <line key={a}
            x1={40+34*Math.cos(a*Math.PI/180)} y1={40+34*Math.sin(a*Math.PI/180)}
            x2={40+37*Math.cos(a*Math.PI/180)} y2={40+37*Math.sin(a*Math.PI/180)}
            stroke="#9B59B6" strokeWidth="1.5" opacity="0.7"/>
        ))}
      </svg>
    );
  };

  const StepClasse = () => (
    <div className="fade" style={{display:"flex", flexDirection:"column", gap:20}}>
      <div>
        <div style={S.h2}>Escolha sua Classe</div>
        <p style={S.desc}>
          Sua classe indica o treinamento que você recebeu na Ordem para enfrentar os perigos do Outro Lado. Em termos de jogo, é a sua característica mais importante, pois define o que você faz e qual é o seu papel no grupo de investigadores.
        </p>
        <p style={{...S.desc, marginTop:10}}>
          <strong style={{color:"var(--gold)", fontStyle:"normal"}}>Perícias concedidas serão adicionadas automaticamente.</strong> Como uma alternativa, você pode não escolher uma classe e começar como <span style={{color:"var(--gold)"}}>Mundano</span>.
        </p>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16}}>
        {CLASSES.map(c=>{
          const isSel = classe?.id === c.id;
          return (
            <div key={c.id} onClick={()=>setClasse(c)} style={{
              background: isSel?"rgba(201,168,76,0.06)":"var(--card)",
              border:`1px solid ${isSel?"rgba(201,168,76,0.5)":"var(--border)"}`,
              borderRadius:10, padding:22, cursor:"pointer",
              transition:"all 0.25s",
              transform: isSel?"translateY(-2px)":"none",
              boxShadow: isSel?"0 8px 30px rgba(201,168,76,0.1)":"none",
              position:"relative", overflow:"hidden",
            }}>
              {isSel && <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,var(--gold),transparent)"}}/>}
              <div style={{marginBottom:14}}><ClassIcon id={c.id}/></div>
              <div style={{fontFamily:"Cinzel,serif", fontSize:20, fontWeight:600, color:"var(--text)", marginBottom:8, borderBottom:`1px solid ${isSel?"rgba(201,168,76,0.3)":"var(--border)"}`, paddingBottom:10}}>{c.name}</div>
              <p style={{fontFamily:"Crimson Pro,serif", fontSize:16, color:"var(--text)", fontWeight:600, lineHeight:1.65, marginBottom:10}}>{c.desc}</p>
              <p style={{fontFamily:"Crimson Pro,serif", fontSize:15, color:"var(--muted2)", lineHeight:1.7, marginBottom:14, fontStyle:"italic"}}>{c.detail}</p>
              <div style={{fontFamily:"Cinzel,serif", fontSize:11, letterSpacing:1.5, color:"var(--gold)", textTransform:"uppercase", padding:"8px 12px", borderRadius:4, border:"1px solid rgba(201,168,76,0.2)", background:"rgba(201,168,76,0.05)"}}>{c.bonus}</div>
              {isSel && (
                <div style={{marginTop:12}}>
                  <button className="btn-gold" style={{width:"100%", padding:"8px 0", fontSize:11, letterSpacing:2}}>✓ Classe Selecionada</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* STEP 3 — TOQUES FINAIS — renderizado inline para evitar perda de foco */
  const renderStepFinal = () => (
    <div className="fade" style={{display:"flex", flexDirection:"column", gap:20}}>
      <div style={{display:"flex", flexWrap:"wrap", justifyContent:"space-between", alignItems:"flex-start", gap:12}}>
        <div style={{flex:1, minWidth:200}}>
          <div style={S.h2}>Toques Finais</div>
          <p style={S.desc}>
            Até aqui, você definiu as características mecânicas de sua ficha — mas um bom personagem é mais do que apenas números. Agora, vamos trabalhar na descrição de seu agente, definindo aspectos como nome, gênero e idade.
          </p>
        </div>
        <button className="btn-gold" onClick={()=>{ if(form.personagem) onFinish({attrs,origem,classe,form}); }} style={{flexShrink:0}}>
          Finalizar Ficha
        </button>
      </div>

      {/* Avatar upload */}
      <div style={{display:"flex", alignItems:"center", gap:20}}>
        <input ref={avatarInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarFile}/>
        <div
          onClick={()=>avatarInputRef.current?.click()}
          style={{
            width:100, height:100, borderRadius:10, flexShrink:0,
            background:"rgba(201,168,76,0.08)", border:"2px dashed rgba(201,168,76,0.35)",
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", overflow:"hidden", transition:"border-color 0.2s",
            position:"relative",
          }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(201,168,76,0.7)"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(201,168,76,0.35)"}
          title="Clique para enviar imagem do personagem"
        >
          {form.avatar ? (
            <img src={form.avatar} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          ) : (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:32}}>🕵️</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"var(--muted2)",letterSpacing:1,marginTop:4}}>FOTO</div>
            </div>
          )}
        </div>
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"var(--gold)",marginBottom:4}}>Imagem do Personagem</div>
          <div style={{fontFamily:"Crimson Pro,serif",fontSize:13,color:"var(--muted2)",marginBottom:10}}>
            Clique no quadro para enviar uma foto ou ilustração do seu agente.
          </div>
          <div style={{display:"flex", flexWrap:"wrap", gap:8, alignItems:"center"}}>
            {form.avatar && (
              <button onClick={()=>setForm(f=>({...f,avatar:""}))} style={{
                background:"none", border:"1px solid rgba(255,255,255,0.12)", borderRadius:4,
                color:"var(--muted2)", cursor:"pointer", fontFamily:"Cinzel,serif",
                fontSize:10, letterSpacing:1, padding:"5px 12px",
              }}>Remover imagem</button>
            )}
            {aiArtEnabled && (
              <div>
                <button
                  onClick={() => setAiComingSoon(s => !s)}
                  style={{
                    background: aiComingSoon
                      ? "linear-gradient(135deg,#3b1f6a,#5b2d9e)"
                      : "linear-gradient(135deg,#2a1550,#4a2080)",
                    border:"1px solid #8b5cf660",
                    borderRadius:4, cursor:"pointer",
                    fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:1,
                    color:"#c4a0f5", padding:"5px 14px",
                    display:"flex", alignItems:"center", gap:6,
                    transition:"all 0.2s",
                  }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#8b5cf6"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#8b5cf660"}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Gerar com IA
                </button>
                {aiComingSoon && (
                  <div style={{
                    marginTop:8, padding:"10px 14px",
                    background:"rgba(139,92,246,0.08)", border:"1px solid rgba(139,92,246,0.25)",
                    borderRadius:6, maxWidth:260,
                  }}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color:"#8b5cf6",marginBottom:4}}>✦ EM DESENVOLVIMENTO</div>
                    <div style={{fontFamily:"Crimson Pro,serif",fontSize:13,color:"var(--muted2)",lineHeight:1.5}}>
                      Integração Higgsfield chegando em breve. Você poderá descrever seu agente e gerar um retrato com IA.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <div>
          <label style={S.label}>Personagem</label>
          <input value={form.personagem} onChange={e=>setForm(f=>({...f,personagem:e.target.value}))} placeholder="Nome do personagem"/>
        </div>
        <div>
          <label style={S.label}>Jogador</label>
          <input value={form.jogador} onChange={e=>setForm(f=>({...f,jogador:e.target.value}))} placeholder="Nome do jogador"/>
        </div>
      </div>
      <div>
        <label style={S.label}>Aparência</label>
        <textarea value={form.aparencia} onChange={e=>setForm(f=>({...f,aparencia:e.target.value}))} placeholder="Nome, gênero, idade, descrição física..." rows={4} style={{resize:"vertical"}}/>
      </div>
      <div>
        <label style={S.label}>Personalidade</label>
        <textarea value={form.personalidade} onChange={e=>setForm(f=>({...f,personalidade:e.target.value}))} placeholder="Traços marcantes, opiniões, ideais..." rows={4} style={{resize:"vertical"}}/>
      </div>
      <div>
        <label style={S.label}>Histórico</label>
        <textarea value={form.historico} onChange={e=>setForm(f=>({...f,historico:e.target.value}))} placeholder="Infância, relação com a família, contato com o Paranormal, eventos bons e ruins..." rows={4} style={{resize:"vertical"}}/>
      </div>
      <div>
        <label style={S.label}>Objetivo</label>
        <textarea value={form.objetivo} onChange={e=>setForm(f=>({...f,objetivo:e.target.value}))} placeholder="Por que ele faz parte da Ordem? Por que luta contra o Outro Lado?" rows={3} style={{resize:"vertical"}}/>
      </div>
    </div>
  );

  const canNext = [
    pontosRestantes === 0,
    origem !== null,
    classe !== null,
    true,
  ][step];

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", overflowY:"auto" }}>
      {/* Header */}
      <div style={{
        padding:"18px 32px", borderBottom:"1px solid var(--border2)",
        display:"flex", alignItems:"center", gap:16,
        background:"rgba(8,8,8,0.97)", backdropFilter:"blur(10px)",
        position:"sticky", top:0, zIndex:50,
      }}>
        <NexusLogo size={28}/>
        <div style={{fontFamily:"Cinzel,serif", fontSize:13, color:"var(--gold2)", letterSpacing:1}}>Nova Ficha de Agente</div>
        <div style={{height:1, flex:1, background:"var(--border2)"}}/>
        <span style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"#d870f8", textTransform:"uppercase", textShadow:"0 0 10px rgba(180,50,220,0.7)"}}>
          🌀 Ordem Paranormal · 2ª Ed.
        </span>
        <button onClick={onCancel} style={{background:"none", border:"1px solid var(--border2)", borderRadius:4, color:"var(--muted2)", cursor:"pointer", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, textTransform:"uppercase", padding:"6px 14px", transition:"all 0.2s"}}
          onMouseEnter={e=>{e.currentTarget.style.color="var(--gold)";e.currentTarget.style.borderColor="var(--gold)";}}
          onMouseLeave={e=>{e.currentTarget.style.color="var(--muted2)";e.currentTarget.style.borderColor="var(--border2)";}}
        >Cancelar</button>
      </div>

      <div style={{maxWidth:900, margin:"0 auto", padding:"40px 28px"}}>
        <StepBar current={step}/>

        {/* Step content */}
        <div style={{marginBottom:32}}>
          {step===0 && <StepAtributos/>}
          {step===1 && <StepOrigem/>}
          {step===2 && <StepClasse/>}
          {step===3 && renderStepFinal()}
        </div>

        {/* Navigation */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:24, borderTop:"1px solid var(--border)"}}>
          <button onClick={()=>step>0&&setStep(s=>s-1)} style={{
            background:"none", border:"1px solid var(--border)", borderRadius:4,
            color: step>0?"var(--muted2)":"var(--muted)", cursor: step>0?"pointer":"not-allowed",
            fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:2, textTransform:"uppercase", padding:"10px 20px",
            opacity: step>0?1:0.3,
          }}>← Voltar</button>

          <div style={{display:"flex", gap:8}}>
            {[0,1,2,3].map(i=>(
              <div key={i} style={{width:i===step?20:6,height:6,borderRadius:3,background:i<=step?"var(--gold)":"rgba(201,168,76,0.2)",transition:"all 0.3s"}}/>
            ))}
          </div>

          {step < 3 ? (
            <button onClick={()=>canNext&&setStep(s=>s+1)} className={canNext?"btn-gold":""} style={!canNext?{
              background:"rgba(201,168,76,0.05)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:4,
              color:"var(--muted)", cursor:"not-allowed", fontFamily:"Cinzel,serif", fontSize:10,
              letterSpacing:2, textTransform:"uppercase", padding:"10px 24px",
            }:{}}>
              Próximo →
            </button>
          ) : (
            <button className="btn-gold" onClick={()=>{ if(form.personagem) onFinish({attrs,origem,classe,form}); }}
              style={{opacity: form.personagem?1:0.4, cursor:form.personagem?"pointer":"not-allowed"}}>
              Criar Agente ✦
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── NEX progression (Ordem Paranormal 2ª Ed.) ── */
const NEX_STEPS = [5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,99];
function nexStats(nexVal, classId, attrs) {
  const base = {
    combatente:   { pv: 20 + attrs.VIG, san: 12, pe: 2 + attrs.PRE },
    especialista: { pv: 16 + attrs.VIG, san: 16, pe: 3 + attrs.PRE },
    ocultista:    { pv: 12 + attrs.VIG, san: 20, pe: 4 + attrs.PRE },
  }[classId] ?? { pv: 12 + attrs.VIG, san: 20, pe: 4 + attrs.PRE };
  const perNex = {
    combatente:   { pv: 4 + attrs.VIG, san: 3, pe: 2 + attrs.PRE },
    especialista: { pv: 3 + attrs.VIG, san: 4, pe: 3 + attrs.PRE },
    ocultista:    { pv: 2 + attrs.VIG, san: 5, pe: 4 + attrs.PRE },
  }[classId] ?? { pv: 2 + attrs.VIG, san: 5, pe: 4 + attrs.PRE };
  const lvl = nexVal === 99 ? 19 : (nexVal - 5) / 5;
  return { pv: base.pv + lvl*perNex.pv, san: base.san + lvl*perNex.san, pe: base.pe + lvl*perNex.pe };
}

/* ── Aura sound (Web Audio API) ── */
function startAuraSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master gain — fade in over 1.5 s
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 1.5);
    master.connect(ctx.destination);

    // Simple reverb via feedback delay
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.35;
    const fbGain = ctx.createGain();
    fbGain.gain.value = 0.45;
    delay.connect(fbGain);
    fbGain.connect(delay);
    delay.connect(master);

    // LFO — slow shimmer at 0.7 Hz
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.7;
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain);
    lfo.start();

    // Chord: A3 · C#4 · E4 · A4 · E5 (golden major chord)
    const freqs = [220, 277.18, 329.63, 440, 659.25];
    const detunes = [0, 1.5, -1.2, 0.8, -0.6];
    const oscs = freqs.map((freq, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq + detunes[i];
      g.gain.value = 0.22 / freqs.length;
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(delay);
      g.connect(master);
      osc.start();
      return osc;
    });

    return { ctx, oscs, lfo, master };
  } catch { return null; }
}

function stopAuraSound(sound) {
  if (!sound) return;
  const { ctx, oscs, lfo, master } = sound;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  setTimeout(() => { oscs.forEach(o => { try { o.stop(); } catch { /* já parado */ } }); try { lfo.stop(); } catch { /* já parado */ } ctx.close(); }, 900);
}

/* ── Dice rolling sound (Web Audio API) ── */
function playDiceRollSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Simulate multiple dice hits: 6 impacts, decreasing in volume and spacing
    const hitTimes   = [0, 0.07, 0.16, 0.27, 0.37, 0.46];
    const hitVolumes = [0.55, 0.48, 0.38, 0.28, 0.18, 0.10];

    hitTimes.forEach((t, i) => {
      const bufLen = Math.floor(ctx.sampleRate * 0.055);
      const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data   = buf.getChannelData(0);
      for (let j = 0; j < bufLen; j++) {
        // White noise with fast exponential decay
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufLen * 0.18));
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;

      // Bandpass filter — gives each hit a slightly different "body"
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900 + Math.random() * 900;
      bp.Q.value = 1.8;

      // High-shelf adds the hard "click" of dice on table
      const shelf = ctx.createBiquadFilter();
      shelf.type = "highshelf";
      shelf.frequency.value = 4000;
      shelf.gain.value = 6;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(hitVolumes[i], ctx.currentTime + t);

      src.connect(bp);
      bp.connect(shelf);
      shelf.connect(gain);
      gain.connect(ctx.destination);
      src.start(ctx.currentTime + t);
    });

    setTimeout(() => ctx.close(), 1200);
  } catch (e) { console.warn("[áudio] efeito sonoro falhou:", e); }
}

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

/* ═══════════════════════════════
   FICHA COMPLETA — NEXUS SHEET
   Layout inspirado no CRIS com
   identidade visual Nexus
═══════════════════════════════ */
function FullSheet({ character, onBack, onUpdate, onRoll, showPanel, onTogglePanel }) {
  const { t: sT, lang: appLang, setLang: setAppLang } = useLocale();
  const { attrs: initAttrs } = character;
  const [attrs,  setAttrs]  = useState(initAttrs);
  const [origem, setOrigem] = useState(character.origem ?? null);
  const [classe, setClasse] = useState(character.classe ?? null);
  const [form,   setForm]   = useState(character.form   ?? {});
  const [skillTreino, setSkillTreino] = useState(character.skillTreino ?? {});
  const [skillOutros, setSkillOutros] = useState(character.skillOutros ?? {});
  const [treinoOpen, setTreinoOpen] = useState(null);
  const [outrosEditing, setOutrosEditing] = useState(null);
  const [skillAttr, setSkillAttr] = useState(character.skillAttr ?? {});
  const [attrOpen, setAttrOpen] = useState(null);
  const [pdBonus, setPdBonus] = useState(character.pdBonus ?? 0);
  const [pdEditing, setPdEditing] = useState(false);
  const handleAttrEdit = (key, val) => setAttrs(a => ({ ...a, [key]: val }));

  // ── Base stats at saved NEX (or 5% for new characters)
  const initNex = character.nex ?? 5;
  const cs0 = nexStats(initNex, classe?.id, initAttrs);

  const [pvMax,  setPvMax]  = useState(character.pvMax  ?? cs0.pv);
  const [sanMax, setSanMax] = useState(character.sanMax ?? cs0.san);
  const [peMax,  setPeMax]  = useState(character.peMax  ?? cs0.pe);
  const [hp,  setHp]  = useState(character.pv  ?? cs0.pv);
  const [san, setSan] = useState(character.san ?? cs0.san);
  const [pe,  setPe]  = useState(character.pe  ?? cs0.pe);
  const [nex, setNex] = useState(initNex);
  const [showNexMenu, setShowNexMenu] = useState(false);
  const [attrEditMode, setAttrEditMode] = useState(false);
  const nexBtnRef    = useRef(null);
  const auraRef      = useRef(null);
  const avatarInputRef = useRef(null);
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        setForm(f => ({ ...f, avatar: canvas.toDataURL('image/jpeg', 0.82) }));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  const [activeTab, setActiveTab] = useState("combate");
  const [showSettings,    setShowSettings]    = useState(false);
  const [settingsTab,     setSettingsTab]     = useState("ficha");
  const [isPrivate,       setIsPrivate]       = useState(character.isPrivate       ?? false);
  const [allowMasterEdit, setAllowMasterEdit] = useState(character.allowMasterEdit ?? true);
  const [allowAnyEdit,    setAllowAnyEdit]    = useState(character.allowAnyEdit    ?? false);
  const [aiArt, setAiArt] = useState(() => localStorage.getItem("nexus_ai_art") === "1");
  const toggleAiArt = (val) => { localStorage.setItem("nexus_ai_art", val ? "1" : "0"); setAiArt(val); };
  const [diceInput, setDiceInput] = useState("");
  const [rollPopup, setRollPopup] = useState(null);
  const [attacks, setAttacks] = useState(character.attacks ?? []);
  const [atkModal, setAtkModal] = useState(null); // null | {mode:"create"|"edit", idx:number|null, data:{...}}
  const [expandedAtkIdx, setExpandedAtkIdx] = useState(null);
  const [skills, setSkills] = useState(character.skills ?? []);
  const [trilha, setTrilha] = useState(character.trilha ?? null);
  const [rituais, setRituais] = useState(character.rituais ?? []);
  const [skillFilter, setSkillFilter] = useState("");
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [skillDraft, setSkillDraft] = useState({ name:"Nova Habilidade", image:"", desc:"Minha nova habilidade" });
  const skillImgRef = useRef(null);
  const skillEditorRef = useRef(null);
  const handleSkillImg = (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value="";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image(); img.onload = () => {
        const MAX=300, scale=Math.min(1,MAX/Math.max(img.width,img.height));
        const c=document.createElement('canvas'); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        setSkillDraft(d=>({...d,image:c.toDataURL('image/jpeg',0.8)}));
      }; img.src=ev.target.result;
    }; reader.readAsDataURL(file);
  };
  const openSkillModal = () => {
    setSkillDraft({ name:"Nova Habilidade", image:"", desc:"Minha nova habilidade" });
    setShowSkillModal(true);
    setTimeout(()=>{ if(skillEditorRef.current) skillEditorRef.current.innerHTML="Minha nova habilidade"; },50);
  };
  const confirmSkill = () => {
    const name = skillDraft.name.trim() || "Nova Habilidade";
    const desc = skillEditorRef.current?.innerHTML || skillDraft.desc;
    const s = { id:Date.now(), name, image:skillDraft.image, desc, type:"passiva", cost:"" };
    setSkills(v=>[...v,s]); setOpenSkillId(s.id); setShowSkillModal(false);
  };
  const [openSkillId, setOpenSkillId] = useState(null);
  const [newSkillName, setNewSkillName] = useState("");
  const [desc, setDesc] = useState({
    anotacoes: form.anotacoes || "",
    aparencia: form.aparencia || "",
    personalidade: form.personalidade || "",
    historico: form.historico || "",
  });

  useEffect(() => {
    if (rollPopup?.crit) {
      auraRef.current = startAuraSound();
    } else {
      stopAuraSound(auraRef.current);
      auraRef.current = null;
    }
    return () => { stopAuraSound(auraRef.current); auraRef.current = null; };
  }, [rollPopup?.crit]);

  useEffect(() => {
    if (rollPopup?.rolls?.length && !rollPopup.crit) {
      playDiceRollSound();
    }
  }, [rollPopup]);

  // Auto-save: persist ALL sheet state whenever anything changes
  const _isMounted = useRef(false);
  useEffect(() => {
    if (!_isMounted.current) { _isMounted.current = true; return; }
    onUpdate?.({
      ...character,
      attrs,
      form: { ...form, ...desc },
      origem,
      classe,
      skillTreino,
      skillOutros,
      skillAttr,
      pdBonus,
      nex,
      pv: hp,
      san,
      pe,
      pvMax,
      sanMax,
      peMax,
      attacks,
      skills,
      trilha,
      rituais,
      isPrivate,
      allowMasterEdit,
      allowAnyEdit,
    });
  }, [attrs, form, desc, origem, classe, skillTreino, skillOutros, skillAttr, pdBonus, nex, hp, san, pe, pvMax, sanMax, peMax, attacks, skills, trilha, rituais, isPrivate, allowMasterEdit, allowAnyEdit]);

  // derived
  const defesa   = 10 + attrs.AGI;
  const esquiva  = attrs.AGI;
  const bloqueio = 0;
  const peturno  = 1 + (nex === 99 ? 19 : (nex - 5) / 5);
  const desl     = `${6 + attrs.AGI}m / ${4 + attrs.AGI}q`;

  const handleAttrRoll = (key) => {
    const res = rollOP(attrs[key]);
    const LABEL = { AGI:"Agilidade", FOR:"Força", INT:"Intelecto", PRE:"Presença", VIG:"Vigor" };
    const popup = { attr: LABEL[key], key, ...res };
    setRollPopup(popup);
    onRoll?.({ ...popup, charName: form.personagem || character.form?.personagem || "Agente" });
  };

  const handleNexChange = (newNex) => {
    const ns = nexStats(newNex, classe?.id, attrs);
    setPvMax(ns.pv);  setHp(v  => Math.min(v, ns.pv));
    setSanMax(ns.san); setSan(v => Math.min(v, ns.san));
    setPeMax(ns.pe);  setPe(v  => Math.min(v, ns.pe));
    setNex(newNex);
    setShowNexMenu(false);
  };

  // Recalculate max stats whenever class changes
  const _classMounted = useRef(false);
  useEffect(() => {
    if (!_classMounted.current) { _classMounted.current = true; return; }
    const ns = nexStats(nex, classe?.id, attrs);
    setPvMax(ns.pv);  setHp(v  => Math.min(v, ns.pv));
    setSanMax(ns.san); setSan(v => Math.min(v, ns.san));
    setPeMax(ns.pe);  setPe(v  => Math.min(v, ns.pe));
  }, [classe?.id]);

  // Qualquer mudança de atributo recalcula PV (VIG), PE (PRE) e SAN (classe)
  const _attrsMounted = useRef(false);
  useEffect(() => {
    if (!_attrsMounted.current) { _attrsMounted.current = true; return; }
    const ns = nexStats(nex, classe?.id, attrs);
    setPvMax(ns.pv);
    setHp(v => Math.min(v, ns.pv));
    setSanMax(ns.san);
    setPeMax(ns.pe);
    setPe(v => Math.min(v, ns.pe));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrs.AGI, attrs.FOR, attrs.INT, attrs.PRE, attrs.VIG]);

  const rollFreeInput = () => {
    // Campo livre da ficha: notação permissiva (N opcional, sem tetos), mas âncorada —
    // o usuário digitou a expressão inteira, então lixo em volta continua sendo erro.
    const r = /^(\d+)?[dD](\d+)([+-]\d+)?$/.test(diceInput) ? rollNotation(diceInput) : null;
    if (!r) { setRollPopup({ attr:"Erro", rolls:[], result:"Ex: 1d20+3", worst:false }); return; }
    const crit=r.sides===20&&r.rolls.includes(20);
    const popup = { attr:diceInput.toUpperCase(), rolls:r.rolls, result:r.total, worst:false, crit, dice:`D${r.sides}`, expr:diceInput };
    setRollPopup(popup);
    onRoll?.({ ...popup, charName: form.personagem || character.form?.personagem || "Agente" });
  };

  // perícias
  const pericias = [
    {n:"Acrobacia+",    attr:"AGI"},{n:"Adestramento*",attr:"PRE"},{n:"Artes*",       attr:"PRE"},
    {n:"Atletismo",     attr:"FOR"},{n:"Atualidades",  attr:"INT"},{n:"Ciências*",    attr:"INT"},
    {n:"Crime*+",       attr:"AGI"},{n:"Diplomacia",   attr:"PRE"},{n:"Enganação",    attr:"PRE"},
    {n:"Fortitude",     attr:"VIG"},{n:"Furtividade+", attr:"AGI"},{n:"Iniciativa",   attr:"AGI"},
    {n:"Intimidação",   attr:"PRE"},{n:"Intuição",     attr:"PRE"},{n:"Investigação", attr:"INT"},
    {n:"Luta",          attr:"FOR"},{n:"Medicina*",    attr:"INT"},{n:"Ocultismo*",   attr:"INT"},
    {n:"Percepção",     attr:"PRE"},{n:"Pilotagem*",   attr:"AGI"},{n:"Pontaria",     attr:"AGI"},
    {n:"Profissão*",    attr:"INT"},{n:"Reflexos",     attr:"AGI"},{n:"Religião*",    attr:"PRE"},
    {n:"Sobrevivência*",attr:"INT"},{n:"Tática*",      attr:"INT"},{n:"Tecnologia*",  attr:"INT"},
    {n:"Vontade",       attr:"PRE"},
  ];

  const trainedSkills = new Set([
    ...(origem?.skills?.map(s=>s.replace(/[*+]/g,""))||[]),
    ...(classe?.id==="combatente"?["Luta","Pontaria","Iniciativa","Atletismo","Reflexos"]:
        classe?.id==="especialista"?["Investigação","Ciências","Tecnologia","Percepção"]:
        ["Ocultismo","Vontade","Religião","Intuição"]),
  ]);
  const treinoColor = v => v===5?"#4ade80":v===10?"#60a5fa":v===15?"#c9a84c":"var(--muted)";
  const getT = (n) => {
    const base = n.replace(/[*+]/g,"");
    const defaultVal = trainedSkills.has(base) ? 5 : 0;
    const val = skillTreino[base] ?? defaultVal;
    return val > 0 ? { bonus: val, color:"#7a5fd4" } : { bonus:0, color:"var(--muted)" };
  };

  useEffect(() => {
    if (!treinoOpen) return;
    const close = () => setTreinoOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [treinoOpen]);

  useEffect(() => {
    if (!attrOpen) return;
    const close = () => setAttrOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [attrOpen]);

  const tabs = ["combate","poderes","habilidades","rituais","inventário","descrição"];

  /* ── left col width (isMobile reativo: reflui ao girar o device) */
  const isMobile = useIsMobile();
  const leftW = isMobile ? "100%" : 310;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0,position:"relative",fontFamily:"Crimson Pro,serif"}}>

      {/* ── NEX dropdown (fixed, escapes overflow:hidden) ── */}
      {showNexMenu && (() => {
        const r = nexBtnRef.current?.getBoundingClientRect() ?? {bottom:0,left:0,width:80};
        return (
          <div style={{position:"fixed",top:r.bottom+4,left:r.left,width:Math.max(r.width,72),zIndex:9998,background:"var(--card2)",border:"1px solid rgba(201,168,76,0.5)",borderRadius:6,boxShadow:"0 6px 24px rgba(0,0,0,0.62)",maxHeight:220,overflowY:"auto"}}
            onMouseLeave={()=>setShowNexMenu(false)}>
            {NEX_STEPS.map(v=>(
              <div key={v} onClick={()=>handleNexChange(v)}
                style={{padding:"7px 10px",fontFamily:"Cinzel,serif",fontSize:11,textAlign:"center",cursor:"pointer",
                  color: v===nex?"var(--gold)":"var(--muted2)",
                  background: v===nex?"rgba(201,168,76,0.14)":"transparent",
                  borderLeft: v===nex?"2px solid var(--gold)":"2px solid transparent",
                  transition:"background 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(201,168,76,0.08)"}
                onMouseLeave={e=>e.currentTarget.style.background=v===nex?"rgba(201,168,76,0.14)":"transparent"}>
                {v}%
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Settings modal ── */}
      {showSettings && createPortal(
        <div onClick={()=>setShowSettings(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--card2)",border:"1px solid var(--border2)",borderRadius:12,width:560,maxWidth:"95vw",boxShadow:"0 24px 64px rgba(0,0,0,0.55)",overflow:"hidden"}}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px 0"}}>
              <span style={{fontFamily:"Cinzel,serif",fontSize:16,color:"#fff",fontWeight:600}}>{sT("settings.title")}</span>
              <button onClick={()=>setShowSettings(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#888",fontSize:18,lineHeight:1,padding:4}}>✕</button>
            </div>
            {/* Tabs — indicador deslizante (spec 0022 AC-1) */}
            <SettingsTabs active={settingsTab} onPick={setSettingsTab} label={sT} />
            {/* Content */}
            <div style={{padding:"24px 24px 28px",display:"flex",flexDirection:"column",gap:24}}>
              {settingsTab==="ficha" && (<>
                {/* Classe para cálculo */}
                <div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#fff",marginBottom:10}}>Classe para cálculo de atributos</div>
                  <div style={{position:"relative",display:"inline-block"}}>
                    <select value={classe?.id||""} onChange={e=>{ const c=CLASSES.find(c=>c.id===e.target.value)||null; setClasse(c); }}
                      style={{background:"var(--card2)",border:"1px solid var(--border2)",borderRadius:6,color:"#fff",fontFamily:"Cinzel,serif",fontSize:12,padding:"8px 32px 8px 12px",cursor:"pointer",appearance:"none",outline:"none"}}>
                      <option value="" style={{background:"#2c2c39"}}>—</option>
                      {CLASSES.map(c=><option key={c.id} value={c.id} style={{background:"#2c2c39"}}>{c.name}</option>)}
                    </select>
                    <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#888",fontSize:10}}>▼</span>
                  </div>
                </div>
                {/* Trilha */}
                {classe && (
                  <div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#fff",marginBottom:10}}>Trilha de {classe.name}</div>
                    <div style={{fontFamily:"Crimson Pro,serif",fontSize:12,color:"#666",marginBottom:10,lineHeight:1.5}}>
                      Escolhida em NEX 10%. Define poderes especiais recebidos em NEX 10%, 40%, 65% e 99%.
                    </div>
                    <div style={{position:"relative",display:"inline-block"}}>
                      <select value={trilha?.id||""}
                        onChange={e=>{const ts=CLASS_TRAILS[classe.id]||[];setTrilha(ts.find(t=>t.id===e.target.value)||null);}}
                        style={{background:"var(--card2)",border:"1px solid var(--border2)",borderRadius:6,color:"#fff",fontFamily:"Cinzel,serif",fontSize:12,padding:"8px 32px 8px 12px",cursor:"pointer",appearance:"none",outline:"none"}}>
                        <option value="" style={{background:"#2c2c39"}}>— Nenhuma —</option>
                        {(CLASS_TRAILS[classe.id]||[]).map(t=>(
                          <option key={t.id} value={t.id} style={{background:"#2c2c39"}}>{t.name}</option>
                        ))}
                      </select>
                      <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#888",fontSize:10}}>▼</span>
                    </div>
                  </div>
                )}
                {/* Origem */}
                <div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#fff",marginBottom:10}}>Origem do Agente</div>
                  <div style={{position:"relative",display:"inline-block"}}>
                    <select value={origem?.id||""} onChange={e=>setOrigem(ORIGENS.find(o=>o.id===e.target.value)||null)}
                      style={{background:"var(--card2)",border:"1px solid var(--border2)",borderRadius:6,color:"#fff",fontFamily:"Cinzel,serif",fontSize:12,padding:"8px 32px 8px 12px",cursor:"pointer",appearance:"none",outline:"none"}}>
                      <option value="" style={{background:"#2c2c39"}}>—</option>
                      {ORIGENS.map(o=><option key={o.id} value={o.id} style={{background:"#2c2c39"}}>{o.name}</option>)}
                    </select>
                    <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#888",fontSize:10}}>▼</span>
                  </div>
                </div>
                {/* Ficha privada */}
                {[
                  { label:"Ficha privada", desc:"Apenas você e o mestre da campanha poderão visualizar a ficha. A ficha ainda aparece no Escudo do Mestre para outros jogadores", val:isPrivate, set:setIsPrivate },
                  { label:"Permitir que o Mestre da campanha edite minha ficha", val:allowMasterEdit, set:setAllowMasterEdit },
                  { label:"Permitir que qualquer pessoa edite minha ficha", desc:"Atenção: com essa opção ligada qualquer pessoa pode editar sua ficha. É recomendado deixar essa opção ligada por apenas um curto período de tempo", val:allowAnyEdit, set:setAllowAnyEdit },
                ].map(({label,desc,val,set})=>(
                  <div key={label}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#fff",marginBottom:desc?6:10}}>{label}</div>
                    {desc && <div style={{fontSize:12,color:"#666",marginBottom:10,lineHeight:1.5}}>{desc}</div>}
                    <div style={{display:"inline-flex",border:"1px solid var(--border2)",borderRadius:6,overflow:"hidden"}}>
                      <button onClick={()=>set(false)} style={{padding:"8px 20px",background:!val?"#8b5cf6":"transparent",border:"none",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color:!val?"#fff":"#666",transition:"all 0.2s"}}>DESLIGADO</button>
                      <button onClick={()=>set(true)}  style={{padding:"8px 20px",background: val?"#8b5cf6":"transparent",border:"none",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color: val?"#fff":"#666",transition:"all 0.2s"}}>LIGADO</button>
                    </div>
                  </div>
                ))}
                {/* Geração de Arte com IA */}
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#fff"}}>Geração de Arte com IA</div>
                    <span style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#8b5cf6",border:"1px solid #8b5cf633",borderRadius:4,padding:"1px 6px"}}>BETA</span>
                  </div>
                  <div style={{fontSize:12,color:"#666",marginBottom:10,lineHeight:1.5}}>
                    Habilita o botão "Gerar com IA" no upload de retrato do personagem. Usa Higgsfield para criar imagens a partir de uma descrição.
                  </div>
                  <div style={{display:"inline-flex",border:"1px solid var(--border2)",borderRadius:6,overflow:"hidden"}}>
                    <button onClick={()=>toggleAiArt(false)} style={{padding:"8px 20px",background:!aiArt?"#8b5cf6":"transparent",border:"none",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color:!aiArt?"#fff":"#666",transition:"all 0.2s"}}>DESLIGADO</button>
                    <button onClick={()=>toggleAiArt(true)}  style={{padding:"8px 20px",background: aiArt?"#8b5cf6":"transparent",border:"none",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color: aiArt?"#fff":"#666",transition:"all 0.2s"}}>LIGADO</button>
                  </div>
                </div>
              </>)}
              {settingsTab==="stream" && (
                <div style={{color:"#666",fontFamily:"Cinzel,serif",fontSize:12,textAlign:"center",padding:"20px 0"}}>Em breve</div>
              )}
              {settingsTab==="idioma" && (
                <div style={{display:"flex",flexDirection:"column",gap:20}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#fff"}}>{sT("settings.language")}</div>
                  <div style={{display:"flex",gap:12}}>
                    {[{id:"pt",label:sT("settings.langPT")},{id:"en",label:sT("settings.langEN")}].map(opt=>(
                      <button key={opt.id} onClick={()=>setAppLang(opt.id)} style={{
                        flex:1, padding:"14px 12px",
                        background: appLang===opt.id ? "#8b5cf620" : "#1a1a1a",
                        border: appLang===opt.id ? "2px solid #8b5cf6" : "2px solid #333",
                        borderRadius:8, cursor:"pointer",
                        fontFamily:"Cinzel,serif", fontSize:12, letterSpacing:1,
                        color: appLang===opt.id ? "#fff" : "#666",
                        transition:"all 0.2s",
                      }}>
                        <div style={{fontSize:22,marginBottom:6}}>{opt.id==="pt" ? "🇧🇷" : "🇺🇸"}</div>
                        {opt.label}
                        {appLang===opt.id && <div style={{fontSize:9,color:"#8b5cf6",marginTop:4,letterSpacing:2}}>✦ ATIVO</div>}
                      </button>
                    ))}
                  </div>
                  <div style={{fontFamily:"'Crimson Pro',serif",fontSize:12,color:"#555",lineHeight:1.6}}>
                    {sT("settings.langHint")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Nova Habilidade modal ── */}
      {showSkillModal && createPortal(
        <div onClick={()=>setShowSkillModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--card2)",border:"1px solid var(--border2)",borderRadius:12,width:620,maxWidth:"95vw",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.62)"}}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px 16px",borderBottom:"1px solid var(--border)"}}>
              <span style={{fontFamily:"Cinzel,serif",fontSize:17,color:"#fff",fontWeight:600}}>Nova Habilidade</span>
              <button onClick={()=>setShowSkillModal(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#666",fontSize:20,lineHeight:1,padding:4}} onMouseEnter={e=>e.currentTarget.style.color="#fff"} onMouseLeave={e=>e.currentTarget.style.color="#666"}>✕</button>
            </div>
            {/* Body */}
            <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:18,overflowY:"auto"}}>
              {/* Nome */}
              <div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#aaa",marginBottom:8}}>Nome<span style={{color:"#8b5cf6"}}>*</span></div>
                <input value={skillDraft.name} onChange={e=>setSkillDraft(d=>({...d,name:e.target.value}))}
                  autoFocus
                  style={{width:"100%",boxSizing:"border-box",background:"var(--card2)",border:"1px solid var(--border2)",borderRadius:6,color:"#fff",fontFamily:"Cinzel,serif",fontSize:14,padding:"10px 14px",outline:"none"}}
                  onFocus={e=>e.target.style.borderColor="#8b5cf6"} onBlur={e=>e.target.style.borderColor="#333"}/>
              </div>
              {/* Imagem */}
              <div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#aaa",marginBottom:8}}>Imagem<span style={{color:"#8b5cf6",fontSize:9,marginLeft:4}}>opcional</span></div>
                <div onClick={()=>skillImgRef.current?.click()} style={{
                  width:100,height:100,borderRadius:8,border:"2px dashed #333",cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",
                  background:"var(--card2)",transition:"border-color 0.2s",
                }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#8b5cf6"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#333"}>
                  {skillDraft.image
                    ? <img src={skillDraft.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    : <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
                </div>
                <input ref={skillImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleSkillImg}/>
                {skillDraft.image && <button onClick={()=>setSkillDraft(d=>({...d,image:""}))} style={{marginTop:6,background:"none",border:"none",cursor:"pointer",color:"#666",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1}}>Remover imagem</button>}
              </div>
              {/* Descrição */}
              <div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"#aaa",marginBottom:8}}>
                  Descrição<span style={{color:"#8b5cf6"}}>*</span>
                  <span style={{fontFamily:"Crimson Pro,serif",fontSize:11,color:"#555",marginLeft:8,fontStyle:"italic"}}>utilize negrito para aplicar a cor roxo</span>
                </div>
                {/* Toolbar */}
                <div style={{display:"flex",gap:2,padding:"6px 10px",background:"var(--card2)",border:"1px solid var(--border2)",borderBottom:"none",borderRadius:"6px 6px 0 0"}}>
                  {[
                    { label:"B", style:{fontWeight:700}, cmd:"bold" },
                    { label:"I", style:{fontStyle:"italic"}, cmd:"italic" },
                    { label:"U", style:{textDecoration:"underline"}, cmd:"underline" },
                  ].map(({label,style,cmd})=>(
                    <button key={cmd} onMouseDown={e=>{ e.preventDefault(); document.execCommand(cmd); skillEditorRef.current?.focus(); }}
                      style={{...style,background:"none",border:"1px solid transparent",borderRadius:4,cursor:"pointer",color:"#ccc",width:28,height:26,fontSize:13,fontFamily:"Georgia,serif",transition:"all 0.15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.background="#2a2a2a";e.currentTarget.style.borderColor="#444";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.borderColor="transparent";}}
                    >{label}</button>
                  ))}
                </div>
                {/* Editor */}
                <div ref={skillEditorRef} contentEditable suppressContentEditableWarning
                  style={{minHeight:180,padding:"12px 14px",background:"var(--card)",border:"1px solid var(--border2)",borderRadius:"0 0 6px 6px",
                    color:"#ddd",fontFamily:"Crimson Pro,serif",fontSize:14,lineHeight:1.75,outline:"none",
                    overflowY:"auto"}}
                  onFocus={e=>e.currentTarget.style.borderColor="#8b5cf6"}
                  onBlur={e=>e.currentTarget.style.borderColor="#333"}
                />
                <style>{`.skill-rich-editor b,.skill-rich-editor strong{color:#8b5cf6}`}</style>
              </div>
            </div>
            {/* Footer */}
            <div style={{display:"flex",justifyContent:"flex-end",gap:12,padding:"16px 24px",borderTop:"1px solid #222"}}>
              <button onClick={()=>setShowSkillModal(false)} style={{padding:"10px 24px",background:"none",border:"1px solid var(--border2)",borderRadius:8,cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1,color:"#888",transition:"all 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#555"} onMouseLeave={e=>e.currentTarget.style.borderColor="#333"}>Cancelar</button>
              <button onClick={confirmSkill} style={{padding:"10px 28px",background:"#7c3aed",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:1,color:"#fff",transition:"all 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#6d28d9"} onMouseLeave={e=>e.currentTarget.style.background="#7c3aed"}>Adicionar</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Attack Modal ── */}
      {atkModal && createPortal((() => {
        const ATK_TYPES = ["Balístico","Conhecimento","Corte","Eletricidade","Energia","Fogo","Frio","Impacto","Medo","Mental","Morte","Perfuração","Sangue","Químico"];
        const ATK_RANGES = ["-","Curto","Médio","Longo","Extremo","Ilimitado"];
        const ATK_SKILLS = ["Acrobacia","Adestramento","Atletismo","Atualidades","Ciências","Crime","Diplomacia","Enganação","Fortitude","Furtividade","Iniciativa","Intimidação","Intuição","Investigação","Luta","Medicina","Ocultismo","Percepção","Pilotagem","Pontaria","Profissão","Reflexos","Religião","Sobrevivência","Tecnologia","Tática","Vontade"];
        const ATK_ATTRS = ["Nenhum","Agilidade","Força","Intelecto","Presença","Vigor"];
        const d = atkModal.data;
        const setD = fn => setAtkModal(m=>({...m, data: fn(m.data)}));
        const inputStyle = {width:"100%",boxSizing:"border-box",background:"var(--card2)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,color:"#e0e0e0",fontFamily:"Cinzel,serif",fontSize:13,padding:"7px 10px",outline:"none"};
        const selectStyle = {...inputStyle,cursor:"pointer",appearance:"none"};
        const labelStyle = {fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(255,255,255,0.5)",marginBottom:4,display:"block"};
        const save = () => {
          if(!d.name.trim()) return;
          if(atkModal.mode==="create") setAttacks(a=>[...a,{...d}]);
          else setAttacks(a=>a.map((x,i)=>i===atkModal.idx?{...d}:x));
          setAtkModal(null);
        };
        return (
          <div onClick={()=>setAtkModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:40,overflowY:"auto"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:"var(--card2)",border:"1px solid var(--border2)",borderRadius:8,width:520,maxWidth:"95vw",boxShadow:"0 24px 64px rgba(0,0,0,0.62)",marginBottom:40}}>
              {/* Header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 22px 16px",borderBottom:"1px solid #1e1e1e"}}>
                <span style={{fontFamily:"Cinzel,serif",fontSize:18,color:"#e0e0e0",fontWeight:700}}>{atkModal.mode==="create"?"Novo Ataque":"Editar Ataque"}</span>
                <button onClick={()=>setAtkModal(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:20,lineHeight:1}}>✕</button>
              </div>
              {/* Body */}
              <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:14}}>
                {/* Nome */}
                <div>
                  <label style={labelStyle}>Nome*</label>
                  <input value={d.name} onChange={e=>setD(x=>({...x,name:e.target.value}))} style={inputStyle}/>
                </div>
                {/* Dano / Crítico / Multiplicador */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                  <div>
                    <label style={labelStyle}>Dano*</label>
                    <input value={d.dmg} onChange={e=>setD(x=>({...x,dmg:e.target.value}))} style={inputStyle}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Crítico* <span style={{fontWeight:400,fontSize:9,color:"rgba(255,255,255,0.3)"}}>1–20</span></label>
                    <input type="number" min="1" max="20" value={d.crit}
                      onChange={e=>{ const v=Math.max(1,Math.min(20,parseInt(e.target.value)||20)); setD(x=>({...x,crit:String(v)})); }}
                      style={inputStyle}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Multiplicador*</label>
                    <input type="number" min="1" value={d.mult}
                      onChange={e=>{ const v=Math.max(1,parseInt(e.target.value)||2); setD(x=>({...x,mult:String(v)})); }}
                      style={inputStyle}/>
                  </div>
                </div>
                {/* Ataque Bônus / Tipo de Dano */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12}}>
                  <div>
                    <label style={labelStyle}>Ataque Bônus</label>
                    <input value={d.bonus} onChange={e=>setD(x=>({...x,bonus:e.target.value}))} style={inputStyle}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo de Dano</label>
                    <select value={d.type} onChange={e=>setD(x=>({...x,type:e.target.value}))} style={selectStyle}>
                      {ATK_TYPES.map(t=><option key={t} value={t} style={{background:"#2c2c39"}}>{t}</option>)}
                    </select>
                  </div>
                </div>
                {/* Alcance / Perícia / Atributo Dano */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                  <div>
                    <label style={labelStyle}>Alcance</label>
                    <select value={d.range} onChange={e=>setD(x=>({...x,range:e.target.value}))} style={selectStyle}>
                      {ATK_RANGES.map(r=><option key={r} value={r} style={{background:"#2c2c39"}}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Perícia</label>
                    <select value={d.skill} onChange={e=>setD(x=>({...x,skill:e.target.value}))} style={selectStyle}>
                      {ATK_SKILLS.map(s=><option key={s} value={s} style={{background:"#2c2c39"}}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Atributo Dano</label>
                    <select value={d.attrDmg} onChange={e=>setD(x=>({...x,attrDmg:e.target.value}))} style={selectStyle}>
                      {ATK_ATTRS.map(a=><option key={a} value={a} style={{background:"#2c2c39"}}>{a}</option>)}
                    </select>
                  </div>
                </div>
                {/* Dano Extra */}
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{fontFamily:"Cinzel,serif",fontSize:13,color:"#e0e0e0"}}>Dano extra:</span>
                    <button onClick={()=>setD(x=>({...x,extraDmg:[...(x.extraDmg||[]),{dmg:"1d6",type:"Balístico"}]}))}
                      style={{background:"#7c3aed",border:"none",borderRadius:4,color:"#fff",fontFamily:"Cinzel,serif",fontSize:10,padding:"5px 12px",cursor:"pointer"}}>
                      Adicionar
                    </button>
                  </div>
                  {(d.extraDmg||[]).map((ex,ei)=>(
                    <div key={ei} style={{display:"flex",gap:10,alignItems:"center",marginBottom:8,padding:"10px 12px",borderLeft:"3px solid #7c3aed",background:"rgba(124,58,237,0.05)",borderRadius:"0 4px 4px 0"}}>
                      <div style={{flex:1}}>
                        <label style={labelStyle}>Dano*</label>
                        <input value={ex.dmg} onChange={e=>setD(x=>({...x,extraDmg:x.extraDmg.map((v,j)=>j===ei?{...v,dmg:e.target.value}:v)}))} style={inputStyle}/>
                      </div>
                      <div style={{flex:1}}>
                        <label style={labelStyle}>Tipo*</label>
                        <select value={ex.type} onChange={e=>setD(x=>({...x,extraDmg:x.extraDmg.map((v,j)=>j===ei?{...v,type:e.target.value}:v)}))} style={selectStyle}>
                          {ATK_TYPES.map(t=><option key={t} value={t} style={{background:"#2c2c39"}}>{t}</option>)}
                        </select>
                      </div>
                      <button onClick={()=>setD(x=>({...x,extraDmg:x.extraDmg.filter((_,j)=>j!==ei)}))}
                        style={{background:"#7c3aed",border:"none",borderRadius:4,color:"#fff",fontFamily:"Cinzel,serif",fontSize:10,padding:"5px 10px",cursor:"pointer",alignSelf:"flex-end",marginBottom:0}}>
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
                {/* Anotações */}
                <div>
                  <label style={{...labelStyle,marginBottom:6}}>Anotações <span style={{fontWeight:400,color:"rgba(255,255,255,0.3)",fontSize:9}}>(utilize negrito para aplicar a cor roxo)</span></label>
                  <div style={{border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,overflow:"hidden"}}>
                    {/* Toolbar */}
                    <div style={{display:"flex",gap:2,padding:"6px 8px",background:"rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
                      {[
                        {cmd:"bold",label:"B",style:{fontWeight:"bold"}},
                        {cmd:"italic",label:"I",style:{fontStyle:"italic"}},
                        {cmd:"underline",label:"U",style:{textDecoration:"underline"}},
                      ].map(({cmd,label,style:s})=>(
                        <button key={cmd} onMouseDown={e=>{e.preventDefault();document.execCommand(cmd,false,null);}}
                          style={{background:"none",border:"none",color:"rgba(255,255,255,0.7)",cursor:"pointer",fontFamily:"serif",fontSize:14,padding:"2px 8px",borderRadius:3,...s,transition:"background 0.15s"}}
                          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}
                          onMouseLeave={e=>e.currentTarget.style.background="none"}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {/* Editor */}
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      dangerouslySetInnerHTML={{__html: d.notes||""}}
                      onInput={e=>setD(x=>({...x,notes:e.currentTarget.innerHTML}))}
                      style={{
                        minHeight:120,padding:"10px 12px",outline:"none",
                        background:"var(--card)",color:"#d0d0d0",
                        fontFamily:"Crimson Pro,serif",fontSize:14,lineHeight:1.7,
                      }}
                    />
                  </div>
                </div>

                {/* Imagem */}
                <div>
                  <label style={labelStyle}>Imagem</label>
                  {d.img
                    ? <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <img src={d.img} alt="" style={{width:80,height:80,objectFit:"cover",borderRadius:4,border:"1px solid #2a2a2a"}}/>
                        <button onClick={()=>setD(x=>({...x,img:""}))} style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",borderRadius:4,color:"rgba(255,255,255,0.5)",fontFamily:"Cinzel,serif",fontSize:10,padding:"4px 10px",cursor:"pointer"}}>Remover</button>
                      </div>
                    : <label style={{display:"flex",alignItems:"center",justifyContent:"center",width:80,height:80,border:"1px solid rgba(255,255,255,0.15)",borderRadius:4,cursor:"pointer",background:"rgba(255,255,255,0.03)"}}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                          const file=e.target.files[0]; if(!file) return;
                          const reader=new FileReader();
                          reader.onload=ev=>{
                            const img=new Image();
                            img.onload=()=>{
                              const MAX=240;
                              const scale=Math.min(1,MAX/Math.max(img.width,img.height));
                              const canvas=document.createElement("canvas");
                              canvas.width=Math.round(img.width*scale);
                              canvas.height=Math.round(img.height*scale);
                              canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
                              setD(x=>({...x,img:canvas.toDataURL("image/jpeg",0.75)}));
                            };
                            img.src=ev.target.result;
                          };
                          reader.readAsDataURL(file);
                        }}/>
                      </label>
                  }
                </div>
              </div>
              {/* Footer */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:10,padding:"14px 22px",borderTop:"1px solid #1e1e1e"}}>
                <button onClick={()=>setAtkModal(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",fontFamily:"Cinzel,serif",fontSize:12,cursor:"pointer",padding:"8px 16px"}}>Cancelar</button>
                <button onClick={save} style={{background:"#7c3aed",border:"none",borderRadius:4,color:"#fff",fontFamily:"Cinzel,serif",fontSize:12,padding:"8px 20px",cursor:"pointer"}}>
                  {atkModal.mode==="create"?"Adicionar":"Salvar"}
                </button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* ── Roll popup ── */}
      {rollPopup && (() => {
        const isAttack = rollPopup.type==="attack";
        return (
          <div
            onMouseEnter={e=>{ const t=e.currentTarget.querySelector(".roll-dice-detail"); if(t) t.style.opacity="1"; }}
            onMouseLeave={e=>{ const t=e.currentTarget.querySelector(".roll-dice-detail"); if(t) t.style.opacity="0"; }}
            style={{
              position:"fixed",bottom:16,right:16,zIndex:9999,
              background:rollPopup.crit?"rgba(16,12,0,0.98)":"rgba(18,14,26,0.98)",
              border:`1px solid ${rollPopup.crit?"rgba(255,200,0,0.5)":"rgba(201,168,76,0.35)"}`,
              borderRadius:10,padding:"14px 18px",minWidth:220,
              boxShadow:"0 6px 32px rgba(0,0,0,0.62)",
              animation:rollPopup.crit?"critPopupGlow 1.4s ease-in-out infinite":"fadeIn 0.25s ease",
            }}>
            {/* Tooltip: dados rolados — aparece no hover */}
            <div className="roll-dice-detail" style={{
              position:"absolute",bottom:"100%",right:0,marginBottom:6,
              background:"rgba(0,0,0,0.92)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:6,padding:"6px 10px",whiteSpace:"nowrap",
              fontFamily:"Cinzel,serif",fontSize:10,color:"rgba(255,255,255,0.6)",
              opacity:0,transition:"opacity 0.18s",pointerEvents:"none",
            }}>
              {isAttack
                ? `${rollPopup.skill}${rollPopup.attrKey?" ("+rollPopup.attrKey+")":""} = [${rollPopup.rolls.join(", ")}]${rollPopup.worst?" → pior":" → maior"}`
                : `[${rollPopup.rolls.join(", ")}]${rollPopup.worst?" → pior":" → maior"}`
              }
              {isAttack && rollPopup.dmgRolls?.length>0 && (
                <span style={{marginLeft:8,color:rollPopup.crit?"#ffe86a":"rgba(255,255,255,0.5)"}}>
                  Dano: [{rollPopup.dmgRolls.join(", ")}]{rollPopup.crit?" ✦":""}
                </span>
              )}
            </div>

            {/* Header: nome + fechar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <span style={{fontFamily:"Cinzel,serif",fontSize:11,color:rollPopup.crit?"#ffe86a":"var(--gold)",fontWeight:600,letterSpacing:0.5}}>
                {isAttack ? rollPopup.name : rollPopup.attr}
                {rollPopup.crit && <span style={{marginLeft:6,fontSize:9,letterSpacing:1,color:"#ffe86a"}}> CRÍTICO</span>}
              </span>
              <button onClick={()=>setRollPopup(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:13,lineHeight:1,padding:0}}>✕</button>
            </div>

            {/* Values */}
            {isAttack ? (
              <div style={{display:"flex",alignItems:"center",gap:0}}>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:30,color:rollPopup.crit?"#ffe86a":"var(--gold2)",fontWeight:700,lineHeight:1}}>{rollPopup.ataque}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.3)",marginTop:4,textTransform:"uppercase"}}>Ataque</div>
                </div>
                <div style={{width:1,height:48,background:"rgba(255,255,255,0.08)",flexShrink:0}}/>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:30,color:rollPopup.crit?"#f97316":"#e07a5f",fontWeight:700,lineHeight:1}}>{rollPopup.dmgTotal||0}</div>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.3)",marginTop:4,textTransform:"uppercase"}}>Dano</div>
                </div>
              </div>
            ) : (
              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                <span style={{fontFamily:"Crimson Pro,serif",fontSize:12,color:"var(--muted2)"}}>=</span>
                <span style={{fontFamily:"'Cinzel Decorative',serif",fontSize:32,color:rollPopup.crit?"#ffe86a":"var(--gold2)",fontWeight:700,lineHeight:1}}>{rollPopup.result}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Top header bar ── */}
      <div style={{
        marginBottom:12, borderRadius:10, overflow:"hidden",
        background:"linear-gradient(105deg, rgba(14,11,20,0.98) 0%, rgba(20,16,30,0.96) 60%, rgba(12,10,18,0.98) 100%)",
        border:"1px solid rgba(201,168,76,0.18)",
        boxShadow:"0 4px 24px rgba(0,0,0,0.5)",
        position:"relative",
      }}>
        {/* Decorative gold line top */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,rgba(201,168,76,0.5) 30%,rgba(201,168,76,0.5) 70%,transparent)"}}/>
        {/* Glow behind avatar */}
        <div style={{position:"absolute",top:0,left:0,width:180,height:"100%",background:"radial-gradient(ellipse at 20% 50%, rgba(201,168,76,0.07) 0%, transparent 70%)",pointerEvents:"none"}}/>

        <div style={{display:"flex",alignItems:"center",gap:0,padding:"18px 20px",position:"relative"}}>

          {/* Avatar */}
          <div onClick={()=>avatarInputRef.current?.click()} title="Trocar foto"
            style={{width:90,height:90,borderRadius:10,flexShrink:0,overflow:"hidden",cursor:"pointer",position:"relative",
              border:"2px solid rgba(201,168,76,0.4)",
              boxShadow:"0 0 0 1px rgba(201,168,76,0.1), 0 4px 20px rgba(0,0,0,0.42)",
              background:"rgba(201,168,76,0.06)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,
            }}
            onMouseEnter={e=>{ const ov=e.currentTarget.querySelector('.av-ov'); if(ov) ov.style.opacity=1; }}
            onMouseLeave={e=>{ const ov=e.currentTarget.querySelector('.av-ov'); if(ov) ov.style.opacity=0; }}
          >
            {form.avatar ? <img src={form.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : "🕵️"}
            <div className="av-ov" style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.42)",display:"flex",alignItems:"center",justifyContent:"center",opacity:0,transition:"opacity 0.2s"}}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(201,168,76,0.9)" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarFile}/>
          </div>

          {/* Name + fields */}
          <div style={{flex:1,minWidth:0,paddingLeft:20}}>
            {/* Character name — prominent */}
            <input
              value={form.personagem} placeholder="Nome do Personagem"
              onChange={e=>setForm(f=>({...f,personagem:e.target.value}))}
              style={{
                display:"block", width:"100%", boxSizing:"border-box",
                background:"transparent", border:"none", outline:"none",
                fontFamily:"'Cinzel Decorative',serif", fontSize:22, fontWeight:700,
                letterSpacing:2, lineHeight:1.1, marginBottom:10,
                background:"linear-gradient(135deg,#c9a84c,#e8c96d,#c9a84c)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
                cursor:"text",
              }}
            />
            {/* Info fields row */}
            <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"wrap"}}>
              {[
                { label:"Jogador", node:
                  <input value={form.jogador||""} onChange={e=>setForm(f=>({...f,jogador:e.target.value}))} placeholder="—"
                    style={{background:"transparent",border:"none",outline:"none",fontFamily:"Cinzel,serif",fontSize:13,color:"rgba(232,201,109,0.9)",width:"100%",cursor:"text"}}
                    onFocus={e=>e.target.style.color="var(--gold)"} onBlur={e=>e.target.style.color="rgba(232,201,109,0.9)"}/>
                },
                { label:"Origem", node:
                  <select value={origem?.id||""} onChange={e=>setOrigem(ORIGENS.find(o=>o.id===e.target.value)||null)}
                    style={{background:"transparent",border:"none",outline:"none",fontFamily:"Cinzel,serif",fontSize:13,color:"rgba(232,201,109,0.9)",width:"100%",cursor:"pointer",appearance:"none"}}>
                    <option value="" style={{background:"#2c2c39"}}>—</option>
                    {ORIGENS.map(o=><option key={o.id} value={o.id} style={{background:"#2c2c39"}}>{o.name}</option>)}
                  </select>
                },
                { label:"Classe", node:
                  <select value={classe?.id||""} onChange={e=>setClasse(CLASSES.find(c=>c.id===e.target.value)||null)}
                    style={{background:"transparent",border:"none",outline:"none",fontFamily:"Cinzel,serif",fontSize:13,color:"rgba(232,201,109,0.9)",width:"100%",cursor:"pointer",appearance:"none"}}>
                    <option value="" style={{background:"#2c2c39"}}>—</option>
                    {CLASSES.map(c=><option key={c.id} value={c.id} style={{background:"#2c2c39"}}>{c.name}</option>)}
                  </select>
                },
              ].map(({label,node},i)=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:0}}>
                  {i>0 && <div style={{width:1,height:28,background:"rgba(201,168,76,0.18)",margin:"0 14px"}}/>}
                  <div style={{minWidth:90}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:2,color:"rgba(201,168,76,0.85)",textTransform:"uppercase",marginBottom:4}}>{label}</div>
                    {node}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Voltar */}
          <button onClick={onBack} title="Voltar para fichas"
            style={{flexShrink:0,marginLeft:16,display:"flex",alignItems:"center",gap:6,
              background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.22)",
              borderRadius:8,cursor:"pointer",padding:"8px 16px",
              fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"rgba(201,168,76,0.7)",
              textTransform:"uppercase",transition:"all 0.2s",whiteSpace:"nowrap"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(201,168,76,0.12)";e.currentTarget.style.borderColor="rgba(201,168,76,0.45)";e.currentTarget.style.color="var(--gold)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(201,168,76,0.06)";e.currentTarget.style.borderColor="rgba(201,168,76,0.22)";e.currentTarget.style.color="rgba(201,168,76,0.7)";}}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Voltar
          </button>
        </div>
        {/* Decorative gold line bottom */}
        <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(201,168,76,0.25) 30%,rgba(201,168,76,0.25) 70%,transparent)"}}/>
      </div>

      {/* ── Main 3-col layout ── */}
      <div style={{display:"grid",gridTemplateColumns:"340px 1fr 1fr",gap:10,alignItems:"start"}}>

        {/* ════ LEFT COL ════ */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>

          {/* Attribute diagram */}
          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 6px 14px",overflow:"hidden",position:"relative"}}>
            <button onClick={()=>setAttrEditMode(v=>!v)}
              title={attrEditMode ? "Confirmar edição" : "Editar atributos"}
              style={{
                position:"absolute",top:8,right:8,zIndex:2,
                background:attrEditMode?"rgba(201,168,76,0.15)":"none",
                border:attrEditMode?"1px solid rgba(201,168,76,0.5)":"1px solid transparent",
                borderRadius:6,cursor:"pointer",padding:"4px 6px",
                color:attrEditMode?"var(--gold)":"var(--muted2)",
                display:"flex",alignItems:"center",transition:"all 0.2s",
              }}
              onMouseEnter={e=>{if(!attrEditMode){e.currentTarget.style.color="var(--gold)";e.currentTarget.style.borderColor="rgba(201,168,76,0.3)";}}}
              onMouseLeave={e=>{if(!attrEditMode){e.currentTarget.style.color="var(--muted2)";e.currentTarget.style.borderColor="transparent";}}}
            >
              {attrEditMode
                ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              }
            </button>
            <AttrDiagram attrs={attrs} onRoll={handleAttrRoll} onEdit={attrEditMode ? handleAttrEdit : null}/>
            {/* NEX + PD/turno + Deslocamento */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginTop:10,padding:"0 8px"}}>
              {/* NEX — clicável */}
              <div ref={nexBtnRef} onClick={()=>setShowNexMenu(v=>!v)}
                style={{background:"var(--card2)",border:`1px solid ${showNexMenu?"rgba(201,168,76,0.7)":"var(--border)"}`,borderRadius:4,padding:"7px 4px",textAlign:"center",cursor:"pointer",userSelect:"none",position:"relative"}}>
                <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"var(--muted2)",letterSpacing:1,textTransform:"uppercase"}}>NEX ▾</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"var(--gold)",fontWeight:600}}>{nex}%</div>
              </div>
              {/* PD/turno + Desl estáticos */}
              <div style={{background:"var(--card2)",border:"1px solid var(--border)",borderRadius:4,padding:"7px 4px",textAlign:"center"}}>
                <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"var(--muted2)",letterSpacing:1,textTransform:"uppercase"}}>PD / TURNO</div>
                {pdEditing ? (
                  <input
                    autoFocus type="number" min={0} max={999}
                    defaultValue={pdBonus}
                    onBlur={e=>{const v=Math.max(0,Math.min(999,parseInt(e.target.value)||0));setPdBonus(v);setPdEditing(false);}}
                    onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape"){const v=Math.max(0,Math.min(999,parseInt(e.target.value)||0));setPdBonus(v);setPdEditing(false);}}}
                    style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid var(--gold)",textAlign:"center",fontFamily:"Cinzel,serif",fontSize:13,color:"var(--gold)",fontWeight:600,padding:0,outline:"none",MozAppearance:"textfield"}}
                  />
                ) : (
                  <div onClick={()=>setPdEditing(true)} style={{fontFamily:"Cinzel,serif",fontSize:13,color:"var(--gold)",fontWeight:600,cursor:"pointer",userSelect:"none"}}>{peturno+pdBonus}</div>
                )}
              </div>
              <div style={{background:"var(--card2)",border:"1px solid var(--border)",borderRadius:4,padding:"7px 4px",textAlign:"center"}}>
                <div style={{fontFamily:"Cinzel,serif",fontSize:8,color:"var(--muted2)",letterSpacing:1,textTransform:"uppercase"}}>DESLOCAMENTO</div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"var(--gold)",fontWeight:600}}>{desl}</div>
              </div>
            </div>
          </div>

          {/* Bars */}
          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,padding:"12px 12px 6px"}}>
            <Bar val={hp}  set={setHp}  max={pvMax}  setMax={setPvMax}  color="#8b2020" label="VIDA"/>
            <Bar val={san} set={setSan} max={sanMax} setMax={setSanMax} color="#5a2090" label="DETERMINAÇÃO"/>
            <Bar val={pe}  set={setPe}  max={peMax}  setMax={setPeMax}  color="#0e7a8a" label="ESFORÇO"/>
          </div>

          {/* Defense block */}
          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,padding:"12px 14px"}}>
            {/* DEFESA main badge */}
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
              <div style={{
                width:54,height:54,borderRadius:8,flexShrink:0,
                background:"rgba(201,168,76,0.08)",border:"2px solid rgba(201,168,76,0.4)",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                boxShadow:"0 0 12px rgba(201,168,76,0.1)",
              }}>
                <span style={{fontFamily:"'Cinzel Decorative',serif",fontSize:20,color:"var(--gold)",lineHeight:1,fontWeight:700}}>{defesa}</span>
              </div>
              <div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,color:"var(--gold)",textTransform:"uppercase",marginBottom:4}}>DEFESA</div>
                <div style={{fontFamily:"Crimson Pro,serif",fontSize:14,color:"var(--muted2)"}}>= 10 + AGI <span style={{color:"var(--gold)"}}>+{attrs.AGI}</span></div>
                <div style={{display:"flex",gap:16,marginTop:4}}>
                  <div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,color:"var(--muted2)",textTransform:"uppercase"}}>BLOQUEIO</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:16,color:"var(--text)",fontWeight:600}}>{bloqueio}</div>
                  </div>
                  <div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,color:"var(--muted2)",textTransform:"uppercase"}}>ESQUIVA</div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:16,color:"var(--text)",fontWeight:600}}>{esquiva}</div>
                  </div>
                </div>
              </div>
            </div>
            {/* Proteção / Resistências / Proficiências */}
            {[{l:"PROTEÇÃO",v:"—"},{l:"RESISTÊNCIAS",v:"—"},{l:"PROFICIÊNCIAS",v:`+${Math.floor(nex/20)+2}`}].map(({l,v})=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderTop:"1px solid var(--border)"}}>
                <span style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1.5,color:"var(--muted2)",textTransform:"uppercase"}}>{l}</span>
                <span style={{fontFamily:"Cinzel,serif",fontSize:13,color:"var(--text)"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ════ CENTER — Perícias ════ */}
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,display:"flex",flexDirection:"column"}}>
          {/* Header */}
          <div style={{display:"grid",gridTemplateColumns:"22px 1fr 50px 42px 44px 42px",gap:"0 4px",padding:"9px 10px",borderBottom:"1px solid var(--border)",background:"rgba(201,168,76,0.06)"}}>
            <div/>
            <div style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:2,color:"var(--gold)",textTransform:"uppercase"}}>PERÍCIA</div>
            {["DADOS","BÔNUS","Treino","Outros"].map(h=>(
              <div key={h} style={{fontFamily:"Cinzel,serif",fontSize:8,color:"var(--muted2)",letterSpacing:1,textTransform:"uppercase",textAlign:"center"}}>{h}</div>
            ))}
          </div>
          {/* Rows */}
          <div>
            {pericias.map((p,i)=>{
              const base = p.n.replace(/[*+]/g,"");
              const cur = skillTreino[base] ?? (trainedSkills.has(base)?5:0);
              const attrKey = skillAttr[base] ?? p.attr;
              const t = getT(p.n);
              const outros = skillOutros[base] ?? 0;
              const totalBonus = t.bonus + outros;
              const isTrained = t.bonus>0;
              return (
                <div key={p.n}
                  style={{display:"grid",gridTemplateColumns:"22px 1fr 50px 42px 44px 42px",gap:"0 4px",alignItems:"center",padding:"6px 10px",background:i%2===0?"transparent":"rgba(255,255,255,0.018)",borderBottom:"1px solid rgba(201,168,76,0.05)",cursor:"pointer",transition:"background 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(201,168,76,0.08)"}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"rgba(255,255,255,0.018)"}
                  onClick={()=>{
                    const res=rollOP(attrs[attrKey]);
                    const total=res.result+totalBonus;
                    setRollPopup({attr:`${base} (${attrKey})`,rolls:res.rolls,result:total,worst:res.worst,crit:res.crit,dice:res.dice});
                  }}>
                  <span style={{fontSize:11,color:treinoColor(cur),textAlign:"center"}}>⬡</span>
                  <span style={{fontFamily:"Crimson Pro,serif",fontSize:15,color:cur>0?treinoColor(cur):"var(--text)",userSelect:"none"}}>{p.n}</span>
                  {(()=>{
                    const isOpen=attrOpen===base;
                    return (
                      <div style={{position:"relative",textAlign:"center"}}>
                        <span
                          onClick={e=>{e.stopPropagation();setAttrOpen(isOpen?null:base);}}
                          style={{fontFamily:"Cinzel,serif",fontSize:10,color:cur>0?treinoColor(cur):"var(--muted2)",cursor:"pointer",userSelect:"none"}}
                        >({attrKey})</span>
                        {isOpen&&(
                          <div onClick={e=>e.stopPropagation()} style={{position:"absolute",zIndex:200,left:"50%",transform:"translateX(-50%)",top:"100%",marginTop:4,background:"var(--card)",border:"1px solid var(--border)",borderRadius:6,overflow:"hidden",minWidth:52,boxShadow:"0 4px 16px rgba(0,0,0,0.5)"}}>
                            {["AGI","FOR","INT","PRE","VIG"].map(a=>(
                              <div key={a}
                                onClick={e=>{
                                  e.stopPropagation();
                                  const updated={...skillAttr,[base]:a};
                                  setSkillAttr(updated);
                                  setAttrOpen(null);
                                }}
                                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.12)"}
                                onMouseLeave={e=>e.currentTarget.style.background=attrKey===a?"rgba(255,255,255,0.07)":"transparent"}
                                style={{padding:"6px 0",textAlign:"center",fontFamily:"Cinzel,serif",fontSize:10,color:attrKey===a?(cur>0?treinoColor(cur):"var(--gold)"):"var(--muted2)",fontWeight:attrKey===a?"700":"400",cursor:"pointer",background:attrKey===a?"rgba(255,255,255,0.07)":"transparent",borderBottom:a!=="VIG"?"1px solid var(--border)":"none"}}
                              >{a}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <span style={{fontFamily:"Cinzel,serif",fontSize:11,color:cur>0?treinoColor(cur):"var(--muted)",textAlign:"center"}}>({totalBonus})</span>
                  {(()=>{
                    const isOpen=treinoOpen===base;
                    return (
                      <div style={{position:"relative",textAlign:"center"}}>
                        <span
                          onClick={e=>{e.stopPropagation();setTreinoOpen(isOpen?null:base);}}
                          style={{fontFamily:"Cinzel,serif",fontSize:11,color:treinoColor(cur),fontWeight:cur>0?"700":"400",cursor:"pointer",userSelect:"none"}}
                        >{cur}</span>
                        {isOpen&&(
                          <div onClick={e=>e.stopPropagation()} style={{position:"absolute",zIndex:200,left:"50%",transform:"translateX(-50%)",top:"100%",marginTop:4,background:"var(--card)",border:"1px solid var(--border)",borderRadius:6,overflow:"hidden",minWidth:44,boxShadow:"0 4px 16px rgba(0,0,0,0.5)"}}>
                            {[0,5,10,15].map(v=>(
                              <div key={v}
                                onClick={e=>{
                                  e.stopPropagation();
                                  const updated={...skillTreino,[base]:v};
                                  setSkillTreino(updated);
                                  setTreinoOpen(null);
                                }}
                                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.12)"}
                                onMouseLeave={e=>e.currentTarget.style.background=cur===v?"rgba(255,255,255,0.07)":"transparent"}
                                style={{padding:"6px 0",textAlign:"center",fontFamily:"Cinzel,serif",fontSize:11,color:treinoColor(v),fontWeight:v>0?"700":"400",cursor:"pointer",background:cur===v?"rgba(255,255,255,0.07)":"transparent",borderBottom:v!==15?"1px solid var(--border)":"none"}}
                              >{v}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {(()=>{
                    const outrosVal = skillOutros[base] ?? 0;
                    const isEditing = outrosEditing === base;
                    const saveOutros = (raw) => {
                      const v = Math.max(0, Math.min(99, parseInt(raw)||0));
                      const updated = {...skillOutros, [base]: v};
                      setSkillOutros(updated);
                      setOutrosEditing(null);
                    };
                    return isEditing ? (
                      <input
                        autoFocus type="number" min={0} max={99}
                        defaultValue={outrosVal}
                        onClick={e=>e.stopPropagation()}
                        onBlur={e=>saveOutros(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")saveOutros(e.target.value);}}
                        style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${treinoColor(cur)}`,textAlign:"center",fontFamily:"Cinzel,serif",fontSize:11,color:cur>0?treinoColor(cur):"var(--text)",padding:"0 2px",outline:"none",MozAppearance:"textfield"}}
                      />
                    ) : (
                      <span
                        onClick={e=>{e.stopPropagation();setOutrosEditing(base);}}
                        style={{fontFamily:"Cinzel,serif",fontSize:11,color:cur>0?treinoColor(cur):"var(--muted)",textAlign:"center",cursor:"pointer",userSelect:"none",display:"block"}}
                      >{outrosVal}</span>
                    );
                  })()}
                </div>
              );
            })}
            {/* Footer note */}
            <div style={{padding:"10px 10px",borderTop:"1px solid var(--border)",fontFamily:"Crimson Pro,serif",fontSize:12,color:"var(--muted2)",fontStyle:"italic",textAlign:"center"}}>
              * Somente treinado · + Somente treinado com Bônus
            </div>
          </div>
        </div>

        {/* ════ RIGHT — Combate / Tabs ════ */}
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,display:"flex",flexDirection:"column"}}>
          {/* Tab bar */}
          <div style={{display:"flex",borderBottom:"1px solid var(--border)",background:"rgba(0,0,0,0.25)",alignItems:"center"}}>
            {(()=>{
              const TICONS = {
                combate:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>,
                poderes:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
                habilidades: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
                rituais:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>,
                "inventário":<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
                "descrição": <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>,
              };
              const TLBLS = { combate:"Combate", poderes:"Poderes", habilidades:"Skills", rituais:"Rituais", "inventário":"Itens", "descrição":"Diário" };
              return tabs.map(t=>(
                <button key={t} onClick={()=>setActiveTab(t)} style={{
                  flex:1,padding:"10px 2px 9px",background:"none",border:"none",cursor:"pointer",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                  fontFamily:"Cinzel,serif",fontSize:7.5,letterSpacing:0.8,textTransform:"uppercase",
                  color:activeTab===t?"var(--gold)":"rgba(255,255,255,0.28)",
                  borderBottom:activeTab===t?"2px solid var(--gold)":"2px solid transparent",
                  marginBottom:-1,transition:"all 0.18s",
                  background:activeTab===t?"rgba(201,168,76,0.04)":"none",
                }}
                  onMouseEnter={e=>{if(activeTab!==t)e.currentTarget.style.color="rgba(255,255,255,0.55)";}}
                  onMouseLeave={e=>{if(activeTab!==t)e.currentTarget.style.color="rgba(255,255,255,0.28)";}}>
                  <span style={{opacity:activeTab===t?1:0.55}}>{TICONS[t]}</span>
                  {TLBLS[t]||t}
                </button>
              ));
            })()}
            {onTogglePanel && (
              <button onClick={onTogglePanel} title={showPanel ? "Fechar histórico de dados" : "Histórico de dados da campanha"}
                style={{flexShrink:0,background:showPanel?"rgba(124,58,237,0.18)":"none",
                  border:showPanel?"1px solid rgba(124,58,237,0.5)":"1px solid transparent",
                  borderRadius:6,cursor:"pointer",
                  padding:"5px 8px",color:showPanel?"#a78bfa":"var(--muted2)",display:"flex",alignItems:"center",transition:"all 0.2s",margin:"4px 0 4px 4px"}}
                onMouseEnter={e=>{ if(!showPanel){ e.currentTarget.style.color="#a78bfa"; e.currentTarget.style.background="rgba(124,58,237,0.1)"; }}}
                onMouseLeave={e=>{ if(!showPanel){ e.currentTarget.style.color="var(--muted2)"; e.currentTarget.style.background="none"; }}}
              >
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
                  <line x1="12" y1="2" x2="12" y2="22"/>
                  <path d="M2 8.5l10 7 10-7"/>
                </svg>
              </button>
            )}
            <button onClick={()=>setShowSettings(true)} title="Configurações da ficha"
              style={{marginLeft: onTogglePanel ? 0 : "auto",flexShrink:0,background:"none",border:"none",cursor:"pointer",
                padding:"8px 10px",color:"var(--muted2)",display:"flex",alignItems:"center",transition:"color 0.2s"}}
              onMouseEnter={e=>e.currentTarget.style.color="var(--gold)"}
              onMouseLeave={e=>e.currentTarget.style.color="var(--muted2)"}
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>

          <div style={{padding:14}}>

            {/* ── COMBATE ── */}
            {activeTab==="combate" && (
              <div style={{display:"flex",flexDirection:"column"}}>

                {/* ── Lançar Dados ── */}
                <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:2.5,color:"rgba(201,168,76,0.55)",textTransform:"uppercase",marginBottom:9}}>Lançar Dados</div>
                  <div style={{display:"flex",gap:7}}>
                    <input value={diceInput} onChange={e=>setDiceInput(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&rollFreeInput()}
                      placeholder="2d6+3 · 1d20 · 4d4..."
                      style={{flex:1,background:"rgba(0,0,0,0.35)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,color:"var(--text)",fontFamily:"Cinzel,serif",fontSize:12,padding:"9px 12px",outline:"none",transition:"border-color 0.18s"}}
                      onFocus={e=>e.target.style.borderColor="rgba(201,168,76,0.45)"}
                      onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}/>
                    <button onClick={rollFreeInput} style={{padding:"0 16px",background:"rgba(201,168,76,0.12)",border:"1px solid rgba(201,168,76,0.35)",borderRadius:6,color:"var(--gold)",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:2,textTransform:"uppercase",transition:"all 0.18s",whiteSpace:"nowrap"}}
                      onMouseEnter={e=>{e.currentTarget.style.background="rgba(201,168,76,0.22)";e.currentTarget.style.borderColor="rgba(201,168,76,0.6)";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="rgba(201,168,76,0.12)";e.currentTarget.style.borderColor="rgba(201,168,76,0.35)";}}>
                      Rolar
                    </button>
                  </div>
                </div>

                {/* ── Testes Rápidos ── */}
                <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                  <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:2.5,color:"rgba(255,255,255,0.22)",textTransform:"uppercase",marginBottom:9}}>Testes Rápidos</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5}}>
                    {[
                      {key:"AGI",label:"AGI",color:"#60a5fa"},
                      {key:"FOR",label:"FOR",color:"#f87171"},
                      {key:"INT",label:"INT",color:"#a78bfa"},
                      {key:"PRE",label:"PRE",color:"#34d399"},
                      {key:"VIG",label:"VIG",color:"#fb923c"},
                    ].map(({key,label,color})=>(
                      <button key={key} onClick={()=>handleAttrRoll(key)} title={`Rolar ${key} (${attrs[key]||0}d20)`}
                        style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"9px 4px 8px",gap:4,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,cursor:"pointer",transition:"all 0.18s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background=`${color}18`;e.currentTarget.style.borderColor=`${color}45`;e.currentTarget.style.transform="translateY(-2px)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.025)";e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";e.currentTarget.style.transform="none";}}>
                        <span style={{fontFamily:"'Cinzel Decorative',serif",fontSize:17,fontWeight:700,color,lineHeight:1}}>{attrs[key]??0}</span>
                        <span style={{fontFamily:"Cinzel,serif",fontSize:7,letterSpacing:1,color:"rgba(255,255,255,0.32)",textTransform:"uppercase"}}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Ataques ── */}
                <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:2.5,color:"rgba(255,255,255,0.22)",textTransform:"uppercase"}}>Ataques</span>
                    <button onClick={()=>setAtkModal({mode:"create",idx:null,data:{name:"Novo Ataque",dmg:"1d4",crit:"20",mult:"2",bonus:"0",type:"Balístico",range:"-",skill:"Luta",attrDmg:"Força",extraDmg:[],img:"",notes:""}})}
                      style={{display:"flex",alignItems:"center",gap:4,padding:"4px 11px",background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.28)",borderRadius:20,cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"var(--gold)",transition:"all 0.18s"}}
                      onMouseEnter={e=>e.currentTarget.style.opacity="0.75"}
                      onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Novo
                    </button>
                  </div>

                  {/* Lista de ataques */}
                  {attacks.length===0 ? (
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"22px 0 10px"}}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>
                      </svg>
                      <span style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.18)",textTransform:"uppercase"}}>Nenhum Ataque</span>
                    </div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {attacks.map((atk,i)=>{
                        const expanded = expandedAtkIdx === i;
                        const extraStr = (atk.extraDmg||[]).map(e=>`${e.dmg} ${e.type}`).join(", ");
                        return (
                          <div key={i} style={{background:"var(--card2)",border:"1px solid var(--border)",borderRadius:6,overflow:"hidden"}}>
                            {/* Header row */}
                            <div style={{display:"flex",alignItems:"center",padding:"10px 12px",gap:10,cursor:"pointer",borderBottom:expanded?"1px solid var(--border)":"none"}}
                              onClick={()=>setExpandedAtkIdx(expanded?null:i)}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeLinecap="round"
                                style={{transition:"transform 0.2s",transform:expanded?"rotate(0deg)":"rotate(-90deg)",flexShrink:0}}>
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                              <div style={{flex:1}}>
                                <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"var(--text)",fontWeight:700}}>{atk.name}</div>
                                <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:2}}>
                                  Dano: {atk.dmg||"—"}&nbsp;&nbsp;Crítico: x{atk.mult||"2"}
                                </div>
                              </div>
                              {/* Dice roll icon */}
                              <button onClick={e=>{
                                e.stopPropagation();
                                // Teste de ataque: d20 pool baseado no atributo do ataque
                                const ATTR_MAP={"Agilidade":"AGI","Força":"FOR","Intelecto":"INT","Presença":"PRE","Vigor":"VIG","Nenhum":null};
                                const attrKey=ATTR_MAP[atk.attrDmg]||null;
                                const attrVal=attrKey ? (attrs[attrKey]||1) : 1;
                                const pool=rollOP(attrVal);
                                const atkBonus=parseInt(atk.bonus||"0");
                                const critThreshold=parseInt(atk.crit||"20");
                                // Margem de ameaça da arma vence o crit "qualquer 20" do rollOP.
                                const crit=pool.result>=critThreshold;
                                // Calcula dano (crítico = resultado × multiplicador)
                                const dmg=rollNotation(atk.dmg||"");
                                let dmgRolls=[],dmgTotal=0;
                                if(dmg){
                                  dmgRolls=dmg.rolls;
                                  dmgTotal=crit ? dmg.total*parseInt(atk.mult||"2") : dmg.total;
                                }
                                setRollPopup({
                                  type:"attack",
                                  name:atk.name,
                                  skill:atk.skill||"",
                                  attrKey:attrKey||"",
                                  rolls:pool.rolls,
                                  ataque:pool.result+atkBonus,
                                  dmgRolls,
                                  dmgTotal,
                                  worst:pool.worst,
                                  crit,
                                  dice:"D20"
                                });
                              }} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:"rgba(255,255,255,0.4)",transition:"color 0.18s"}}
                                onMouseEnter={e=>e.currentTarget.style.color="#c9a84c"}
                                onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.4)"}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                </svg>
                              </button>
                            </div>
                            {/* Expanded details */}
                            {expanded && (
                              <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:4}}>
                                {atk.img && (
                                  <img src={atk.img} alt="" style={{width:64,height:64,objectFit:"cover",borderRadius:4,border:"1px solid rgba(255,255,255,0.1)",marginBottom:4}}/>
                                )}
                                {[
                                  ["Ataque Bônus", atk.bonus||"0"],
                                  ["Tipo de Dano", atk.type||"—"],
                                  extraStr?["Dano Extra", extraStr]:null,
                                  ["Alcance", atk.range||"—"],
                                  ["Perícia", atk.skill||"—"],
                                  ["Atributo Dano", atk.attrDmg||"—"],
                                ].filter(Boolean).map(([label,val])=>(
                                  <div key={label} style={{display:"flex",gap:6,fontFamily:"Cinzel,serif",fontSize:10}}>
                                    <span style={{color:"#7c5fbf",minWidth:110}}>{label}:</span>
                                    <span style={{color:"var(--text)"}}>{val}</span>
                                  </div>
                                ))}
                                {atk.notes && (
                                  <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.07)",fontFamily:"Crimson Pro,serif",fontSize:13,color:"rgba(255,255,255,0.55)",lineHeight:1.7}}
                                    dangerouslySetInnerHTML={{__html: atk.notes.replace(/<strong>/g,'<strong style="color:#a78bfa;font-weight:700">')}}/>
                                )}
                                <div style={{display:"flex",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                                  <button onClick={()=>setAttacks(a=>a.filter((_,j)=>j!==i))}
                                    style={{background:"none",border:"none",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:10,color:"#f87171",padding:0}}>
                                    Remover
                                  </button>
                                  <button onClick={()=>setAtkModal({mode:"edit",idx:i,data:{...atk}})}
                                    style={{background:"none",border:"none",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:10,color:"#4ade80",padding:0}}>
                                    Editar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PODERES ── */}
            {activeTab==="poderes" && (
              <div style={{display:"flex",flexDirection:"column",gap:20}}>

                {/* Poder de Origem */}
                {origem && (
                  <div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--gold)",textTransform:"uppercase",marginBottom:10}}>
                      Poder de Origem · {origem.name}
                    </div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:12,color:"var(--text)",marginBottom:4}}>{origem.power.split(".")[0]}.</div>
                    <div style={{fontFamily:"Crimson Pro,serif",fontSize:13,color:"var(--muted2)",lineHeight:1.7,marginBottom:8}}>
                      {origem.power.split(".").slice(1).join(".").trim()}
                    </div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"var(--muted)",letterSpacing:1}}>
                      Perícias: {origem.skills.join(" · ")}
                    </div>
                  </div>
                )}

                {/* Poderes de Classe */}
                {classe && (() => {
                  const nexNum = nex === 99 ? 99 : nex;
                  const baseEarned = (CLASS_BASE_ABILITIES[classe.id] || []).filter(a=>a.nex<=nexNum);
                  const trailEarned = trilha
                    ? Object.entries(TRAIL_ABILITIES[trilha.id]||{})
                        .filter(([n])=>parseInt(n)<=nexNum)
                        .map(([n,a])=>({...a,nex:parseInt(n),isTrilha:true}))
                    : [];

                  const all = [
                    ...baseEarned.map(a=>({...a,isTrilha:false})),
                    ...trailEarned,
                  ].sort((a,b)=>a.nex-b.nex||(a.name<b.name?-1:1));

                  const groups = {};
                  all.forEach(a=>{ if(!groups[a.nex]) groups[a.nex]=[]; groups[a.nex].push(a); });

                  const baseUpcoming = (CLASS_BASE_ABILITIES[classe.id]||[]).filter(a=>a.nex>nexNum);
                  const nextNex = NEX_STEPS.find(n=>n>nexNum);

                  return (
                    <div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--gold)",textTransform:"uppercase"}}>
                          Poderes de {classe.name}
                        </div>
                        {nex>=10 && (
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase"}}>Trilha</span>
                            <select value={trilha?.id||""}
                              onChange={e=>{const ts=CLASS_TRAILS[classe.id]||[];setTrilha(ts.find(t=>t.id===e.target.value)||null);}}
                              style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:4,
                                color:"var(--text)",fontFamily:"Cinzel,serif",fontSize:9,padding:"4px 8px",
                                cursor:"pointer",outline:"none"}}>
                              <option value="" style={{background:"#2c2c39"}}>— Escolher —</option>
                              {(CLASS_TRAILS[classe.id]||[]).map(t=>(
                                <option key={t.id} value={t.id} style={{background:"#2c2c39"}}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {Object.entries(groups).map(([nexLvl,abils])=>(
                        <div key={nexLvl} style={{marginBottom:14}}>
                          <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                            NEX {nexLvl}%
                            <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}}/>
                          </div>
                          {abils.map((a,i)=>(
                            <div key={i} style={{marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                              <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:3}}>
                                <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:a.isTrilha?"#b8a0f0":"var(--text)"}}>{a.name}</span>
                                {a.cost!=="—"&&<span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"var(--muted)"}}>{a.cost}</span>}
                                {a.isTrilha&&trilha&&<span style={{fontFamily:"Cinzel,serif",fontSize:8,color:"#9b80e8",letterSpacing:1}}>· {trilha.name}</span>}
                              </div>
                              <div style={{fontFamily:"Crimson Pro,serif",fontSize:13,color:"var(--muted2)",lineHeight:1.7}}>{a.desc}</div>
                            </div>
                          ))}
                        </div>
                      ))}

                      {nextNex && baseUpcoming.filter(a=>a.nex===nextNex).length>0 && (
                        <div style={{opacity:0.4}}>
                          <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"var(--muted)",textTransform:"uppercase",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                            Próximo — NEX {nextNex}%
                            <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}}/>
                          </div>
                          {baseUpcoming.filter(a=>a.nex===nextNex).map((a,i)=>(
                            <div key={i} style={{marginBottom:6}}>
                              <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:"var(--muted)"}}>{a.name}</span>
                              {a.cost!=="—"&&<span style={{fontFamily:"Cinzel,serif",fontSize:9,color:"var(--muted)",marginLeft:8}}>{a.cost}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {!classe && !origem && (
                  <div style={{textAlign:"center",padding:"20px 0",fontFamily:"Crimson Pro,serif",fontSize:13,color:"var(--muted)",fontStyle:"italic"}}>
                    Nenhuma classe ou origem selecionada.
                  </div>
                )}
              </div>
            )}

            {/* ── HABILIDADES ── */}
            {activeTab==="habilidades" && (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {/* Header: filter + Adicionar */}
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input
                    value={skillFilter} onChange={e=>setSkillFilter(e.target.value)}
                    placeholder="Filtrar habilidades"
                    style={{flex:1,fontSize:12,padding:"7px 10px"}}
                  />
                  <button onClick={openSkillModal}
                    style={{padding:"7px 16px",background:"#7c3aed",border:"1px solid #7c3aed",borderRadius:6,cursor:"pointer",
                      fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color:"#fff",whiteSpace:"nowrap",transition:"all 0.2s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#6d28d9"}
                    onMouseLeave={e=>e.currentTarget.style.background="#7c3aed"}>
                    + Adicionar
                  </button>
                </div>

                {/* Skills list */}
                {skills.filter(s=>s.name.toLowerCase().includes(skillFilter.toLowerCase())).length === 0 && !showAddSkill && (
                  <div style={{textAlign:"center",padding:"20px 0",fontFamily:"Crimson Pro,serif",fontSize:13,color:"var(--muted)",fontStyle:"italic"}}>
                    {skillFilter ? "Nenhuma habilidade encontrada." : "Nenhuma habilidade adicionada."}
                  </div>
                )}
                {skills
                  .filter(s=>s.name.toLowerCase().includes(skillFilter.toLowerCase()))
                  .map(skill=>{
                    const open = openSkillId === skill.id;
                    return (
                      <div key={skill.id} style={{background:"var(--card2)",border:"1px solid var(--border)",borderRadius:6,overflow:"hidden"}}>
                        {/* Row header */}
                        <div onClick={()=>setOpenSkillId(open ? null : skill.id)}
                          style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",cursor:"pointer",userSelect:"none"}}>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{transition:"transform 0.2s",transform:open?"rotate(0deg)":"rotate(-90deg)",flexShrink:0}}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                          <span style={{fontFamily:"Cinzel,serif",fontSize:12,color:"var(--text)",flex:1}}>{skill.name}</span>
                          <button onClick={e=>{e.stopPropagation();setSkills(v=>v.filter(s=>s.id!==skill.id));if(openSkillId===skill.id)setOpenSkillId(null);}}
                            style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>✕</button>
                        </div>
                        {/* Expanded content */}
                        {open && (
                          <div style={{padding:"0 14px 12px",display:"flex",flexDirection:"column",gap:8,borderTop:"1px solid var(--border)"}}>
                            <div style={{display:"flex",gap:8,paddingTop:10}}>
                              <select value={skill.type}
                                onChange={e=>setSkills(v=>v.map(s=>s.id===skill.id?{...s,type:e.target.value}:s))}
                                style={{background:"var(--card)",border:"1px solid var(--border2)",borderRadius:4,color:"var(--muted2)",fontFamily:"Cinzel,serif",fontSize:10,padding:"5px 8px",cursor:"pointer",outline:"none"}}>
                                {["passiva","ativa","reação"].map(t=><option key={t} value={t} style={{background:"#2c2c39"}}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                              </select>
                              <input value={skill.cost}
                                onChange={e=>setSkills(v=>v.map(s=>s.id===skill.id?{...s,cost:e.target.value}:s))}
                                placeholder="Custo (ex: 2 PE)"
                                style={{flex:1,fontSize:12,padding:"5px 10px"}}/>
                            </div>
                            <textarea value={skill.desc}
                              onChange={e=>setSkills(v=>v.map(s=>s.id===skill.id?{...s,desc:e.target.value}:s))}
                              placeholder="Descrição da habilidade..."
                              rows={3}
                              style={{width:"100%",boxSizing:"border-box",fontSize:13,padding:"7px 10px",fontFamily:"Crimson Pro,serif",lineHeight:1.6,resize:"vertical"}}/>
                          </div>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            )}

            {/* ── RITUAIS ── */}
            {activeTab==="rituais" && (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {/* Header */}
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--gold)",textTransform:"uppercase"}}>Rituais Conhecidos</div>
                    {classe?.id==="ocultista" && nex && (
                      <div style={{fontFamily:"Crimson Pro,serif",fontSize:11,color:"var(--muted)",fontStyle:"italic",marginTop:2}}>
                        Círculos disponíveis: {nex>=85?"1° – 4°":nex>=55?"1° – 3°":nex>=25?"1° – 2°":"apenas 1°"}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={()=>{
                      const novo={id:Date.now(),name:"Novo Ritual",circulo:1,elemento:"",custo:"",desc:""};
                      setRituais(r=>[...r,novo]);
                      setOpenSkillId(`ritual_${novo.id}`);
                    }}
                    style={{padding:"7px 14px",background:"rgba(122,95,212,0.12)",border:"1px solid rgba(122,95,212,0.35)",borderRadius:6,cursor:"pointer",
                      fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:1,color:"#9b80e8",whiteSpace:"nowrap",transition:"all 0.2s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(122,95,212,0.22)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(122,95,212,0.12)"}>
                    + Ritual
                  </button>
                </div>

                {rituais.length===0 ? (
                  <div style={{textAlign:"center",padding:"20px 0"}}>
                    <div style={{fontSize:28,marginBottom:8,opacity:0.5}}>🌀</div>
                    <div style={{fontFamily:"Crimson Pro,serif",fontSize:13,color:"var(--muted)",fontStyle:"italic",lineHeight:1.65}}>
                      {classe?.id==="ocultista"
                        ? "Adicione os rituais que seu personagem conhece."
                        : "Rituais são especializados em ocultistas, mas qualquer agente pode aprender com o poder Transcender."}
                    </div>
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {/* Group by circle */}
                    {[1,2,3,4].map(circulo=>{
                      const grupo = rituais.filter(r=>r.circulo===circulo);
                      if(grupo.length===0) return null;
                      return (
                        <div key={circulo}>
                          <div style={{fontFamily:"Cinzel,serif",fontSize:8,letterSpacing:1,color:"#9b80e8",textTransform:"uppercase",margin:"8px 0 4px",display:"flex",alignItems:"center",gap:6}}>
                            <span>{circulo}° Círculo</span>
                            <div style={{flex:1,height:1,background:"rgba(122,95,212,0.15)"}}/>
                          </div>
                          {grupo.map((r,idx)=>{
                            const open = openSkillId===`ritual_${r.id}`;
                            return (
                              <div key={r.id} style={{background:"var(--card2)",border:"1px solid rgba(122,95,212,0.2)",borderRadius:6,overflow:"hidden",marginBottom:3}}>
                                <div onClick={()=>setOpenSkillId(open?null:`ritual_${r.id}`)}
                                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",userSelect:"none"}}>
                                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                    style={{transition:"transform 0.2s",transform:open?"rotate(0deg)":"rotate(-90deg)",flexShrink:0}}>
                                    <polyline points="6 9 12 15 18 9"/>
                                  </svg>
                                  <span style={{fontFamily:"Cinzel,serif",fontSize:11,color:"var(--text)",flex:1}}>{r.name}</span>
                                  {r.elemento&&(
                                    <span style={{fontFamily:"Cinzel,serif",fontSize:8,padding:"2px 7px",borderRadius:10,background:"rgba(0,0,0,0.3)",border:"1px solid var(--border)",color:"var(--muted2)"}}>
                                      {r.elemento}
                                    </span>
                                  )}
                                  {r.custo&&(
                                    <span style={{fontFamily:"Cinzel,serif",fontSize:8,padding:"2px 7px",borderRadius:10,border:"1px solid rgba(201,168,76,0.2)",color:"var(--gold)"}}>
                                      {r.custo}
                                    </span>
                                  )}
                                  <button onClick={e=>{e.stopPropagation();setRituais(v=>v.filter(x=>x.id!==r.id));if(openSkillId===`ritual_${r.id}`)setOpenSkillId(null);}}
                                    style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>✕</button>
                                </div>
                                {open && (
                                  <div style={{padding:"0 14px 14px",display:"flex",flexDirection:"column",gap:8,borderTop:"1px solid rgba(122,95,212,0.12)"}}>
                                    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8,paddingTop:10}}>
                                      <div>
                                        <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"var(--muted)",marginBottom:4}}>Nome</div>
                                        <input value={r.name}
                                          onChange={e=>setRituais(v=>v.map(x=>x.id===r.id?{...x,name:e.target.value}:x))}
                                          style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"6px 8px"}}/>
                                      </div>
                                      <div>
                                        <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"var(--muted)",marginBottom:4}}>Círculo</div>
                                        <select value={r.circulo}
                                          onChange={e=>setRituais(v=>v.map(x=>x.id===r.id?{...x,circulo:parseInt(e.target.value)}:x))}
                                          style={{width:"100%",background:"var(--card)",border:"1px solid var(--border2)",borderRadius:4,color:"var(--muted2)",fontFamily:"Cinzel,serif",fontSize:11,padding:"6px 8px",cursor:"pointer",outline:"none"}}>
                                          <option value={1} style={{background:"#2c2c39"}}>1° Círculo</option>
                                          <option value={2} style={{background:"#2c2c39"}}>2° Círculo</option>
                                          <option value={3} style={{background:"#2c2c39"}}>3° Círculo</option>
                                          <option value={4} style={{background:"#2c2c39"}}>4° Círculo</option>
                                        </select>
                                      </div>
                                      <div>
                                        <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"var(--muted)",marginBottom:4}}>Custo em PE</div>
                                        <input value={r.custo}
                                          onChange={e=>setRituais(v=>v.map(x=>x.id===r.id?{...x,custo:e.target.value}:x))}
                                          placeholder="Ex: 3 PE"
                                          style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"6px 8px"}}/>
                                      </div>
                                    </div>
                                    <div>
                                      <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"var(--muted)",marginBottom:4}}>Elemento</div>
                                      <input value={r.elemento}
                                        onChange={e=>setRituais(v=>v.map(x=>x.id===r.id?{...x,elemento:e.target.value}:x))}
                                        placeholder="Ex: Fogo, Morte, Mente..."
                                        style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"6px 8px"}}/>
                                    </div>
                                    <div>
                                      <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"var(--muted)",marginBottom:4}}>Descrição / Efeito</div>
                                      <textarea value={r.desc}
                                        onChange={e=>setRituais(v=>v.map(x=>x.id===r.id?{...x,desc:e.target.value}:x))}
                                        placeholder="Descreva o efeito do ritual..."
                                        rows={3}
                                        style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"7px 10px",fontFamily:"Crimson Pro,serif",lineHeight:1.6,resize:"vertical"}}/>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── INVENTÁRIO ── */}
            {activeTab==="inventário" && (
              <div>
                <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"var(--gold)",textTransform:"uppercase",marginBottom:8}}>Equipamentos</div>
                <div style={{fontFamily:"Crimson Pro,serif",fontSize:13,color:"var(--muted2)",fontStyle:"italic",marginBottom:10}}>Capacidade de carga baseada em Patente e NEX.</div>
                <button style={{width:"100%",padding:"8px",background:"rgba(201,168,76,0.05)",border:"1px solid var(--border)",borderRadius:4,color:"var(--muted2)",cursor:"pointer",fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,textTransform:"uppercase"}}>+ Adicionar Item</button>
              </div>
            )}

            {/* ── DESCRIÇÃO ── */}
            {activeTab==="descrição" && (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {[
                  ["Anotações","anotacoes",120],
                  ["Aparência","aparencia",90],
                  ["Personalidade","personalidade",90],
                  ["Histórico","historico",90],
                ].map(([label,key,minH])=>(
                  <div key={key}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:9,letterSpacing:2,color:"#e8e8e8",textTransform:"uppercase",marginBottom:6,fontWeight:700}}>{label}</div>
                    <textarea
                      value={desc[key]}
                      onChange={e=>setDesc(d=>({...d,[key]:e.target.value}))}
                      style={{
                        width:"100%",
                        minHeight:minH,
                        background:"var(--card2)",
                        border:"1px solid rgba(255,255,255,0.15)",
                        borderRadius:4,
                        color:"#cccccc",
                        fontFamily:"Crimson Pro,serif",
                        fontSize:14,
                        lineHeight:1.7,
                        padding:"8px 10px",
                        resize:"vertical",
                        boxSizing:"border-box",
                        outline:"none",
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════
   MUSIC SCREEN
═══════════════════════════════ */

async function ytFetchPlaylists(token) {
  const r = await fetch(
    "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  if (d.error) throw Object.assign(new Error(d.error.message), { status: d.error.code });
  return d.items || [];
}

async function ytFetchPlaylistItems(playlistId, token) {
  const r = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  if (d.error) throw Object.assign(new Error(d.error.message), { status: d.error.code });
  return d.items || [];
}

async function spFetchPlaylists(token) {
  const r = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  if (d.error) throw Object.assign(new Error(d.error.message), { status: d.error.status });
  return d.items || [];
}

async function spFetchTracks(playlistId, token) {
  const r = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(id,name,duration_ms,artists,album(images)))`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  if (d.error) throw Object.assign(new Error(d.error.message), { status: d.error.status });
  return (d.items || []).filter(i => i.track);
}

function spRandStr(n) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map(b => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62])
    .join("");
}

async function spCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtSeconds(s) {
  if (!s || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/* ── IndexedDB helpers for local audio storage ── */
function openAudioDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open("nexus_audio", 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}
async function audioDBSave(id, name, buf) {
  const db = await openAudioDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put({ id, name, buf });
    tx.oncomplete = res;
    tx.onerror = e => rej(e.target.error);
  });
}
async function audioDBGet(id) {
  const db = await openAudioDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("files", "readonly");
    const req = tx.objectStore("files").get(id);
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}
async function audioDBDelete(id) {
  const db = await openAudioDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").delete(id);
    tx.oncomplete = res;
    tx.onerror = e => rej(e.target.error);
  });
}
async function audioDBGetMeta() {
  const db = await openAudioDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("files", "readonly");
    const req = tx.objectStore("files").getAll();
    req.onsuccess = e => res((e.target.result || []).map(f => ({ id: f.id, name: f.name })));
    req.onerror = e => rej(e.target.error);
  });
}
function localHue(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = ((h << 5) - h + str.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}
function localGradient(name) {
  const hue = localHue(name || "playlist");
  return `linear-gradient(135deg, hsl(${hue},55%,20%), hsl(${(hue + 55) % 360},65%,36%))`;
}
function localAccent(name) {
  const hue = localHue(name || "playlist");
  return `hsl(${hue},65%,62%)`;
}

/* ── Local MP3 Player Bar ── */
function LocalMusicBar({ nowPlaying, onNowPlaying }) {
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  const nowPlayingRef = useRef(nowPlaying);
  const currentIdxRef = useRef(nowPlaying?.startIdx || 0);
  const seekingRef = useRef(false);
  const onNowPlayingRef = useRef(onNowPlaying);
  const loadTrackRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(nowPlaying?.startIdx || 0);

  useEffect(() => { nowPlayingRef.current = nowPlaying; }, [nowPlaying]);
  useEffect(() => { onNowPlayingRef.current = onNowPlaying; }, [onNowPlaying]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  seekingRef.current = seeking;

  loadTrackRef.current = async (idx) => {
    const tr = nowPlayingRef.current?.tracks || [];
    if (!tr[idx]) return;
    try {
      const file = await audioDBGet(tr[idx].id);
      if (!file?.buf) return;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const blob = new Blob([file.buf], { type: "audio/mpeg" });
      blobUrlRef.current = URL.createObjectURL(blob);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = blobUrlRef.current;
      setCurrentTime(0);
      audioRef.current.play().catch((e) => console.warn("[música] play bloqueado pelo navegador:", e));
    } catch (e) { console.warn("[música] trocar faixa falhou:", e); }
  };

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    const onTime = () => { if (!seekingRef.current) setCurrentTime(a.currentTime); };
    const onDur = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      const rep = nowPlayingRef.current?.repeat || "none";
      const tr = nowPlayingRef.current?.tracks || [];
      const idx = currentIdxRef.current;
      if (rep === "one") { a.currentTime = 0; a.play().catch((e) => console.warn("[música] repetir faixa falhou:", e)); return; }
      if (idx + 1 < tr.length) {
        const next = idx + 1;
        setCurrentIdx(next); currentIdxRef.current = next;
        onNowPlayingRef.current(prev => prev ? { ...prev, startIdx: next } : prev);
        loadTrackRef.current(next);
      } else if (rep === "all" && tr.length > 0) {
        setCurrentIdx(0); currentIdxRef.current = 0;
        onNowPlayingRef.current(prev => prev ? { ...prev, startIdx: 0 } : prev);
        loadTrackRef.current(0);
      } else {
        setIsPlaying(false);
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const idx = nowPlaying?.startIdx ?? 0;
    setCurrentIdx(idx); currentIdxRef.current = idx;
    setCurrentTime(0); setDuration(0);
    loadTrackRef.current && loadTrackRef.current(idx);
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying?.playlistId]);

  const tracks = nowPlaying?.tracks || [];
  const repeat = nowPlaying?.repeat || "none";
  const track = tracks[currentIdx];
  const plName = nowPlaying?.playlistName || "";
  const accent = localAccent(plName);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const gold = "var(--gold)";
  const btnCtrl = { background: "transparent", border: "none", cursor: "pointer", color: "var(--muted2)", fontSize: 20, padding: "4px 8px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s" };

  const togglePlay = () => { const a = audioRef.current; if (!a) return; isPlaying ? a.pause() : a.play().catch((e) => console.warn("[música] play bloqueado pelo navegador:", e)); };
  const prevTrack = () => {
    if (currentIdx === 0) return;
    const idx = currentIdx - 1;
    setCurrentIdx(idx); currentIdxRef.current = idx;
    onNowPlaying(prev => prev ? { ...prev, startIdx: idx } : prev);
    loadTrackRef.current(idx);
  };
  const nextTrack = () => {
    if (currentIdx + 1 >= tracks.length) return;
    const idx = currentIdx + 1;
    setCurrentIdx(idx); currentIdxRef.current = idx;
    onNowPlaying(prev => prev ? { ...prev, startIdx: idx } : prev);
    loadTrackRef.current(idx);
  };
  const cycleRepeat = () => {
    const modes = ["none", "all", "one"];
    const next = modes[(modes.indexOf(repeat) + 1) % 3];
    onNowPlaying(prev => ({ ...prev, repeat: next }));
  };
  const stop = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    onNowPlaying(null);
  };

  return (
    <div style={{ background: "rgba(8,8,8,0.97)", borderTop: "1px solid var(--border2)", padding: "8px 24px 10px", backdropFilter: "blur(16px)" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ width: 42, height: 42, borderRadius: 6, flexShrink: 0, background: localGradient(plName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎵</div>
        <div style={{ minWidth: 0, width: 200, flexShrink: 0 }}>
          <div style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {track?.name?.replace(/\.[^.]+$/, "") || plName}
          </div>
          <div style={{ fontSize: 11, color: accent, marginTop: 2 }}>♪ Local</div>
          {tracks.length > 0 && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{currentIdx + 1} / {tracks.length}</div>}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", margin: "0 auto" }}>
          <button onClick={cycleRepeat} title="Repetição" style={{ ...btnCtrl, color: repeat !== "none" ? gold : "var(--muted)", padding: "4px 6px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              {repeat === "one" && <line x1="12" y1="12" x2="12" y2="12" strokeWidth="3.5" />}
            </svg>
          </button>
          <button onClick={prevTrack} disabled={currentIdx === 0} style={{ ...btnCtrl, opacity: currentIdx === 0 ? 0.35 : 1 }}
            onMouseEnter={e => { if (currentIdx > 0) e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted2)"}>⏮</button>
          <button onClick={togglePlay} style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#c9a84c,#e8c96d)", border: "none", cursor: "pointer", fontSize: 16, color: "#050505", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 14px rgba(201,168,76,0.45)", transition: "transform 0.15s, box-shadow 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.65)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 14px rgba(201,168,76,0.45)"; }}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button onClick={nextTrack} disabled={currentIdx + 1 >= tracks.length} style={{ ...btnCtrl, opacity: currentIdx + 1 >= tracks.length ? 0.35 : 1 }}
            onMouseEnter={e => { if (currentIdx + 1 < tracks.length) e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted2)"}>⏭</button>
        </div>
        <button onClick={stop} style={{ ...btnCtrl, border: "1px solid var(--border)", width: 30, height: 30, borderRadius: 4, fontSize: 14, color: "var(--muted)" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>✕</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums", minWidth: 32, textAlign: "right" }}>{fmtSeconds(currentTime)}</span>
        <div style={{ flex: 1, position: "relative", height: 16, display: "flex", alignItems: "center", cursor: "pointer" }}
          onClick={e => {
            if (!audioRef.current || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const t = ratio * duration;
            audioRef.current.currentTime = t; setCurrentTime(t);
          }}>
          <div style={{ position: "absolute", inset: "6px 0", borderRadius: 3, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: `${progress}%`, borderRadius: 3, background: "linear-gradient(90deg,#a07830,#e8c96d)", transition: seeking ? "none" : "width 0.3s linear" }} />
          <div style={{ position: "absolute", left: `${progress}%`, top: "50%", transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: "50%", background: gold, boxShadow: "0 0 6px rgba(201,168,76,0.7)", transition: seeking ? "none" : "left 0.3s linear", pointerEvents: "none" }} />
          <input type="range" min={0} max={duration || 1} value={currentTime} step={0.1}
            onChange={e => { const v = Number(e.target.value); setCurrentTime(v); if (audioRef.current) audioRef.current.currentTime = v; }}
            onMouseDown={() => setSeeking(true)} onMouseUp={() => setSeeking(false)}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", margin: 0 }} />
        </div>
        <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums", minWidth: 32 }}>{fmtSeconds(duration)}</span>
      </div>
    </div>
  );
}

/* ── Persistent Music Player Bar ── */
function MusicPlayerBar({ nowPlaying, onNowPlaying, ytPlayerRef }) {
  const [ytState, setYtState] = useState(-1);
  const [displayIdx, setDisplayIdx] = useState(nowPlaying?.startIdx || 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const pollRef = useRef(null);
  const displayIdxRef = useRef(displayIdx);
  const seekingRef = useRef(seeking);
  const autoplayTimerRef = useRef(null);
  const apiTimeoutRef = useRef(null);
  displayIdxRef.current = displayIdx;
  seekingRef.current = seeking;
  const gold = "var(--gold)";

  /* init / reinit YouTube IFrame player when playlist changes */
  useEffect(() => {
    if (nowPlaying?.svc !== "youtube") return;
    setCurrentTime(0);
    setDuration(0);
    setAutoplayBlocked(false);
    setPlayerError(null);
    setPlayerReady(false);
    if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current);
    if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);

    const ytErrors = { 2: "ID inválido", 5: "Erro HTML5", 100: "Vídeo não encontrado ou removido", 101: "Playlist privada — torne-a pública ou não listada no YouTube para reproduzir", 150: "Playlist privada — torne-a pública ou não listada no YouTube para reproduzir" };

    const create = () => {
      // If player already exists, load new playlist without recreating
      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadPlaylist === "function") {
        try {
          ytPlayerRef.current.loadPlaylist({ listType: "playlist", list: nowPlaying.playlistId, index: nowPlaying.startIdx || 0 });
          setPlayerReady(true);
          autoplayTimerRef.current = setTimeout(() => {
            const p = ytPlayerRef.current;
            if (p && typeof p.getPlayerState === "function" && p.getPlayerState() !== 1) setAutoplayBlocked(true);
          }, 3000);
          return;
        } catch (e) { console.warn("[música] reutilizar player YT falhou — recriando:", e); }
      }
      // Destroy old player if exists
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch { /* best-effort: player já destruído */ }
        ytPlayerRef.current = null;
      }
      // Find or recreate the host element (YouTube destroys it on destroy())
      let host = document.getElementById("yt-player-host");
      if (!host) {
        host = document.createElement("div");
        host.id = "yt-player-host";
        host.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none";
        document.body.appendChild(host);
      }
      ytPlayerRef.current = new window.YT.Player(host, {
        height: 1, width: 1,
        playerVars: {
          listType: "playlist", list: nowPlaying.playlistId,
          index: nowPlaying.startIdx || 0,
          autoplay: 1, controls: 0, fs: 0, rel: 0,
          origin: window.location.origin,
        },
        events: {
          onStateChange: e => {
            setYtState(e.data);
            if (e.data === 1) { setAutoplayBlocked(false); setPlayerError(null); if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current); }
          },
          onReady: e => {
            setPlayerReady(true);
            e.target.playVideo();
            setDisplayIdx(e.target.getPlaylistIndex() || 0);
            autoplayTimerRef.current = setTimeout(() => {
              const p = ytPlayerRef.current;
              if (p && typeof p.getPlayerState === "function" && p.getPlayerState() !== 1) setAutoplayBlocked(true);
            }, 3000);
          },
          onError: e => setPlayerError(ytErrors[e.data] || `Erro ${e.data}`),
        },
      });
    };

    const tryCreate = () => {
      if (window.YT?.Player) {
        create();
      } else {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (prev) prev(); create(); };
        // Timeout: if API never loads (blocked by AdBlocker etc.)
        apiTimeoutRef.current = setTimeout(() => {
          if (!window.YT?.Player) setPlayerError("Player YouTube não carregou. Desative extensões e recarregue a página.");
        }, 10000);
      }
    };

    tryCreate();
    return () => {
      if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current);
      if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying?.playlistId]);

  /* poll current track index + progress */
  useEffect(() => {
    if (nowPlaying?.svc !== "youtube") return;
    pollRef.current = setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p || typeof p.getPlaylistIndex !== "function") return;
      const idx = p.getPlaylistIndex();
      if (idx >= 0 && idx !== displayIdxRef.current) {
        setDisplayIdx(idx);
        onNowPlaying(prev => prev ? { ...prev, startIdx: idx } : prev);
      }
      if (!seekingRef.current) {
        if (typeof p.getCurrentTime === "function") setCurrentTime(Math.floor(p.getCurrentTime()));
        if (typeof p.getDuration === "function") setDuration(Math.floor(p.getDuration()));
      }
    }, 800);
    return () => clearInterval(pollRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying?.svc]);

  /* handle repeat one */
  useEffect(() => {
    if (ytState !== 0 || !ytPlayerRef.current) return;
    if (nowPlaying?.repeat === "one") { ytPlayerRef.current.seekTo(0); ytPlayerRef.current.playVideo(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytState]);

  const isPlaying = ytState === 1;
  const tracks = nowPlaying?.tracks || [];
  const currentTrack = tracks[displayIdx];
  const thumb = currentTrack?.snippet?.thumbnails?.default?.url || nowPlaying?.playlistThumb || "";
  const title = currentTrack?.snippet?.title || nowPlaying?.playlistName || "";
  const channel = currentTrack?.snippet?.videoOwnerChannelTitle || "";
  const repeat = nowPlaying?.repeat || "none";

  const togglePlay = () => { const p = ytPlayerRef.current; if (!p) return; setAutoplayBlocked(false); setPlayerError(null); isPlaying ? p.pauseVideo() : p.playVideo(); };
  const prevTrack = () => { const p = ytPlayerRef.current; if (!p) return; displayIdx === 0 ? p.playVideoAt(Math.max(0, tracks.length - 1)) : p.previousVideo(); };
  const nextTrack = () => ytPlayerRef.current?.nextVideo();
  const cycleRepeat = () => {
    const modes = ["none", "all", "one"];
    const next = modes[(modes.indexOf(repeat) + 1) % 3];
    onNowPlaying(prev => ({ ...prev, repeat: next }));
    if (ytPlayerRef.current?.setLoop) ytPlayerRef.current.setLoop(next === "all");
  };
  const stop = () => {
    if (ytPlayerRef.current) { try { ytPlayerRef.current.stopVideo(); ytPlayerRef.current.destroy(); } catch { /* best-effort: player já destruído */ } ytPlayerRef.current = null; }
    onNowPlaying(null);
  };

  const btnCtrl = {
    background: "transparent", border: "none", cursor: "pointer",
    color: "var(--muted2)", fontSize: 20, padding: "4px 8px", lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s",
  };

  /* Local MP3 */
  if (nowPlaying?.svc === "local") return <LocalMusicBar nowPlaying={nowPlaying} onNowPlaying={onNowPlaying} />;

  /* Spotify: embed iframe (no SDK without Premium) */
  if (nowPlaying?.svc === "spotify") {
    return (
      <div style={{ background: "rgba(8,8,8,0.97)", borderTop: "1px solid var(--border2)", padding: "10px 20px", display: "flex", gap: 14, alignItems: "center", backdropFilter: "blur(16px)" }}>
        <div style={{ width: 46, height: 46, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {nowPlaying.playlistThumb ? <img src={nowPlaying.playlistThumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "var(--muted)", fontSize: 20 }}>♪</span>}
        </div>
        <div style={{ minWidth: 0, maxWidth: 160, flexShrink: 0 }}>
          <div style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nowPlaying.playlistName}</div>
          <div style={{ fontSize: 11, color: "#1db954", marginTop: 2 }}>● Spotify</div>
        </div>
        <div style={{ flex: 1, maxWidth: 520 }}>
          <iframe title={`Spotify: ${nowPlaying.playlistName}`}
            src={`https://open.spotify.com/embed/playlist/${nowPlaying.playlistId}?utm_source=generator&theme=0`}
            width="100%" height="72" style={{ border: "none", borderRadius: 6, display: "block" }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
        </div>
        <button onClick={stop} style={{ ...btnCtrl, border: "1px solid var(--border)", width: 30, height: 30, borderRadius: 4, color: "var(--muted)" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>✕</button>
      </div>
    );
  }

  /* YouTube: full controls */
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{ background: "rgba(8,8,8,0.97)", borderTop: "1px solid var(--border2)", padding: "8px 24px 10px", backdropFilter: "blur(16px)" }}>
      {playerError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0 3px", color: "#e07070", fontFamily: "Cinzel,serif", fontSize: 9, letterSpacing: 0.5 }}>
          <span>⚠</span><span>{playerError}</span>
        </div>
      )}
      {/* Row 1: thumb + info + controls + stop */}
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {/* Thumb */}
        <div style={{ width: 42, height: 42, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {thumb ? <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "var(--muted)", fontSize: 20 }}>♪</span>}
        </div>
        {/* Info */}
        <div style={{ minWidth: 0, width: 200, flexShrink: 0 }}>
          <div style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{channel}</div>
          {tracks.length > 0 && <div style={{ fontSize: 10, color: "#ff4444", marginTop: 1 }}>{displayIdx + 1} / {tracks.length}</div>}
        </div>
        {/* Controls */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", margin: "0 auto" }}>
          <button onClick={cycleRepeat} title={repeat === "none" ? "Sem repetição" : repeat === "all" ? "Repetir playlist" : "Repetir música"}
            style={{ ...btnCtrl, color: repeat !== "none" ? gold : "var(--muted)", padding: "4px 6px" }}>
            {repeat === "one" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                <line x1="12" y1="12" x2="12" y2="12" strokeWidth="3" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            )}
          </button>
          <button onClick={prevTrack} style={btnCtrl}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted2)"}>⏮</button>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {autoplayBlocked && !playerError && (
              <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: "rgba(201,168,76,0.12)", border: "1px solid var(--border2)", borderRadius: 4, padding: "3px 8px", whiteSpace: "nowrap", fontFamily: "Cinzel,serif", fontSize: 8, color: "var(--gold2)", letterSpacing: 0.5, pointerEvents: "none" }}>
                Clique para iniciar
              </div>
            )}
            <button onClick={togglePlay} disabled={!!playerError} style={{
              width: 42, height: 42, borderRadius: "50%",
              background: playerError ? "rgba(60,30,30,0.8)" : "linear-gradient(135deg,#c9a84c,#e8c96d)",
              border: playerError ? "1px solid #8b2020" : "none",
              cursor: playerError ? "not-allowed" : "pointer",
              fontSize: playerReady ? 16 : 13, color: "#050505", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: autoplayBlocked ? "0 0 0 3px rgba(201,168,76,0.5), 0 2px 14px rgba(201,168,76,0.45)" : "0 2px 14px rgba(201,168,76,0.45)",
              transition: "transform 0.15s, box-shadow 0.15s",
              animation: autoplayBlocked && !playerError ? "pulse 1.2s ease-in-out infinite" : "none",
            }}
              onMouseEnter={e => { if (!playerError) { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.65)"; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = autoplayBlocked ? "0 0 0 3px rgba(201,168,76,0.5), 0 2px 14px rgba(201,168,76,0.45)" : "0 2px 14px rgba(201,168,76,0.45)"; }}>
              {playerError ? "⚠" : !playerReady ? <div style={{ width: 14, height: 14, border: "2px solid rgba(5,5,5,0.3)", borderTopColor: "#050505", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : isPlaying ? "⏸" : "▶"}
            </button>
          </div>
          <button onClick={nextTrack} style={btnCtrl}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted2)"}>⏭</button>
        </div>
        {/* Stop */}
        <button onClick={stop} style={{ ...btnCtrl, border: "1px solid var(--border)", width: 30, height: 30, borderRadius: 4, fontSize: 14, color: "var(--muted)" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>✕</button>
      </div>
      {/* Row 2: progress bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums", minWidth: 32, textAlign: "right" }}>{fmtSeconds(currentTime)}</span>
        <div style={{ flex: 1, position: "relative", height: 16, display: "flex", alignItems: "center", cursor: "pointer" }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const seekTo = Math.floor(ratio * (duration || 0));
            setCurrentTime(seekTo);
            ytPlayerRef.current?.seekTo(seekTo, true);
          }}>
          {/* Track */}
          <div style={{ position: "absolute", inset: "6px 0", borderRadius: 3, background: "rgba(255,255,255,0.1)" }} />
          {/* Fill */}
          <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: `${progress}%`, borderRadius: 3, background: "linear-gradient(90deg,#a07830,#e8c96d)", transition: seeking ? "none" : "width 0.4s linear" }} />
          {/* Thumb */}
          <div style={{ position: "absolute", left: `${progress}%`, top: "50%", transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: "50%", background: "var(--gold)", boxShadow: "0 0 6px rgba(201,168,76,0.7)", transition: seeking ? "none" : "left 0.4s linear", pointerEvents: "none" }} />
          {/* Invisible range input for drag support */}
          <input type="range" min={0} max={duration || 1} value={currentTime} step={1}
            onChange={e => setCurrentTime(Number(e.target.value))}
            onMouseDown={() => setSeeking(true)}
            onMouseUp={e => { setSeeking(false); ytPlayerRef.current?.seekTo(Number(e.target.value), true); }}
            onTouchStart={() => setSeeking(true)}
            onTouchEnd={e => { setSeeking(false); ytPlayerRef.current?.seekTo(Number(e.target.value), true); }}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", margin: 0 }} />
        </div>
        <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums", minWidth: 32 }}>{fmtSeconds(duration)}</span>
      </div>
    </div>
  );
}

function MusicScreen({ nowPlaying, onNowPlaying, musicTokens, onMusicTokens, ytPlayerRef }) {
  const ytToken = musicTokens.yt;
  const spToken = musicTokens.sp;
  const setYtToken = t => onMusicTokens(prev => ({ ...prev, yt: t }));
  const setSpToken = t => onMusicTokens(prev => ({ ...prev, sp: t }));

  const [spClientId, setSpClientId] = useState(() => localStorage.getItem("nx_sp_cid") || "");
  const [spClientIdDraft, setSpClientIdDraft] = useState(() => localStorage.getItem("nx_sp_cid") || "");
  const [ytPlaylists, setYtPlaylists] = useState([]);
  const [spPlaylists, setSpPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tab, setTab] = useState(() => (localStorage.getItem("nx_yt_token") || localStorage.getItem("nx_sp_token")) ? "youtube" : "local");
  const [loading, setLoading] = useState("");
  const [err, setErr] = useState("");
  const [spSetupOpen, setSpSetupOpen] = useState(false);
  const dragRef = useRef(null);
  const dragOverRef = useRef(null);

  /* ── Local MP3 state ── */
  const [localPlaylists, setLocalPlaylists] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nx_local_playlists") || "[]"); } catch { return []; }
  });
  const [importedFiles, setImportedFiles] = useState([]);
  const [createPlOpen, setCreatePlOpen] = useState(false);
  const [newPlName, setNewPlName] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());
  const [localDragging, setLocalDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingPl, setEditingPl] = useState(null);
  const [localSearch, setLocalSearch] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const fileInputRef = useRef(null);

  /* ── Persist local playlists ── */
  useEffect(() => {
    localStorage.setItem("nx_local_playlists", JSON.stringify(localPlaylists));
  }, [localPlaylists]);

  /* ── Load imported file metadata from IndexedDB on mount ── */
  useEffect(() => {
    audioDBGetMeta().then(setImportedFiles).catch((e) => console.error("[música] ler arquivos importados (IndexedDB) falhou:", e));
  }, []);

  /* ── Spotify OAuth callback handler ── */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get("code");
    const state = p.get("state");
    const savedState = localStorage.getItem("nx_sp_state");
    if (code && state && state === savedState) {
      window.history.replaceState({}, "", window.location.pathname);
      const cid = localStorage.getItem("nx_sp_cid");
      const ver = localStorage.getItem("nx_sp_ver");
      if (cid && ver) handleSpCallback(code, cid, ver);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load playlists on mount if tokens already exist in localStorage ── */
  useEffect(() => {
    if (ytToken) {
      ytFetchPlaylists(ytToken)
        .then(items => { setYtPlaylists(items); setTab("youtube"); })
        .catch(() => { localStorage.removeItem("nx_yt_token"); localStorage.removeItem("nx_yt_exp"); setYtToken(null); });
    }
    if (spToken) {
      spFetchPlaylists(spToken)
        .then(items => { setSpPlaylists(items); if (!ytToken) setTab("spotify"); })
        .catch(() => { localStorage.removeItem("nx_sp_token"); localStorage.removeItem("nx_sp_exp"); setSpToken(null); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSpCallback = async (code, cid, ver) => {
    setLoading("spotify");
    try {
      const redirectUri = window.location.origin + window.location.pathname.replace(/\/+$/, "");
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: cid,
        code_verifier: ver,
      });
      const r = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error_description || d.error);
      const exp = Date.now() + d.expires_in * 1000;
      localStorage.setItem("nx_sp_token", d.access_token);
      localStorage.setItem("nx_sp_exp", String(exp));
      setSpToken(d.access_token);
      const items = await spFetchPlaylists(d.access_token);
      setSpPlaylists(items);
      setTab("spotify");
      const uid = auth.currentUser?.uid;
      if (uid) await fsSetMusicLink(uid, "spotify", { clientId: cid, connectedAt: Date.now() });
    } catch (e) {
      setErr("Spotify: " + e.message);
    } finally {
      setLoading("");
      localStorage.removeItem("nx_sp_ver");
      localStorage.removeItem("nx_sp_state");
    }
  };

  const connectYouTube = async () => {
    setErr(""); setLoading("youtube");
    try {
      const prov = new GoogleAuthProvider();
      prov.addScope("https://www.googleapis.com/auth/youtube.readonly");
      prov.setCustomParameters({ prompt: "consent" });
      const user = auth.currentUser;
      const isGoogleUser = user?.providerData?.some(p => p.providerId === "google.com");
      const result = isGoogleUser
        ? await reauthenticateWithPopup(user, prov)
        : await signInWithPopup(auth, prov);
      const cred = GoogleAuthProvider.credentialFromResult(result);
      if (!cred?.accessToken) throw new Error("Token não obtido.");
      const token = cred.accessToken;
      const exp = Date.now() + 3500 * 1000; // ~1h
      const ytEmail = result.user.email || "";
      const ytName = result.user.displayName || "";
      localStorage.setItem("nx_yt_token", token);
      localStorage.setItem("nx_yt_exp", String(exp));
      localStorage.setItem("nx_yt_email", ytEmail);
      setYtToken(token);
      const items = await ytFetchPlaylists(token);
      setYtPlaylists(items);
      setTab("youtube");
      if (user?.uid) await fsSetMusicLink(user.uid, "youtube", { email: ytEmail, name: ytName, connectedAt: Date.now() });
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        setErr("YouTube: " + (e.message || "Tente novamente."));
      }
    } finally {
      setLoading("");
    }
  };

  const connectSpotify = async (overrideCid) => {
    const cid = overrideCid || spClientId;
    if (!cid) { setSpSetupOpen(true); return; }
    const ver = spRandStr(64);
    const state = spRandStr(16);
    localStorage.setItem("nx_sp_ver", ver);
    localStorage.setItem("nx_sp_state", state);
    localStorage.setItem("nx_sp_cid", cid);
    const challenge = await spCodeChallenge(ver);
    const redirectUri = window.location.origin + window.location.pathname.replace(/\/+$/, "");
    window.location.href = "https://accounts.spotify.com/authorize?" + new URLSearchParams({
      client_id: cid,
      response_type: "code",
      redirect_uri: redirectUri,
      code_challenge_method: "S256",
      code_challenge: challenge,
      state,
      scope: "playlist-read-private playlist-read-collaborative user-read-private",
    });
  };

  const disconnectYT = () => {
    localStorage.removeItem("nx_yt_token"); localStorage.removeItem("nx_yt_exp"); localStorage.removeItem("nx_yt_email");
    setYtToken(null); setYtPlaylists([]);
    if (selectedPlaylist?.svc === "youtube") setSelectedPlaylist(null);
    if (nowPlaying?.svc === "youtube") onNowPlaying(null);
    const uid = auth.currentUser?.uid;
    if (uid) fsDeleteMusicLink(uid, "youtube");
  };
  const disconnectSP = () => {
    localStorage.removeItem("nx_sp_token"); localStorage.removeItem("nx_sp_exp"); localStorage.removeItem("nx_sp_email");
    setSpToken(null); setSpPlaylists([]);
    if (selectedPlaylist?.svc === "spotify") setSelectedPlaylist(null);
    if (nowPlaying?.svc === "spotify") onNowPlaying(null);
    const uid = auth.currentUser?.uid;
    if (uid) fsDeleteMusicLink(uid, "spotify");
  };

  /* ── Local MP3 functions ── */
  const importMp3Files = async (files) => {
    setImporting(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(file.name)) continue;
        const id = `lf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const buf = await file.arrayBuffer();
        await audioDBSave(id, file.name, buf);
      }
      const meta = await audioDBGetMeta();
      setImportedFiles(meta);
    } catch (e) { console.error("[música] importar arquivos falhou:", e); } finally {
      setImporting(false);
    }
  };

  const createLocalPlaylist = () => {
    if (!newPlName.trim() || selectedFileIds.size === 0) return;
    const id = editingPl ? editingPl.id : `lpl_${Date.now()}`;
    const trackIds = [...selectedFileIds];
    if (editingPl) {
      setLocalPlaylists(prev => prev.map(pl => pl.id === id ? { ...pl, name: newPlName.trim(), trackIds } : pl));
    } else {
      setLocalPlaylists(prev => [...prev, { id, name: newPlName.trim(), trackIds }]);
    }
    setCreatePlOpen(false); setNewPlName(""); setSelectedFileIds(new Set()); setEditingPl(null);
  };

  const deleteLocalPlaylist = (plId) => {
    setLocalPlaylists(prev => prev.filter(pl => pl.id !== plId));
    if (nowPlaying?.playlistId === plId) onNowPlaying(null);
    if (selectedPlaylist?.id === plId) { setSelectedPlaylist(null); setTracks([]); }
  };

  const deleteImportedFile = async (fileId) => {
    await audioDBDelete(fileId);
    setImportedFiles(prev => prev.filter(f => f.id !== fileId));
    setLocalPlaylists(prev =>
      prev.map(pl => ({ ...pl, trackIds: pl.trackIds.filter(id => id !== fileId) }))
          .filter(pl => pl.trackIds.length > 0)
    );
  };

  const openLocalPlaylist = (pl) => {
    const tracks = pl.trackIds.map(id => importedFiles.find(f => f.id === id)).filter(Boolean);
    setSelectedPlaylist({ id: pl.id, name: pl.name, svc: "local", count: tracks.length });
    setTracks(tracks);
  };

  const playLocalPlaylist = (pl, startIdx = 0) => {
    const tracks = pl.trackIds.map(id => importedFiles.find(f => f.id === id)).filter(Boolean);
    if (tracks.length === 0) return;
    onNowPlaying({ svc: "local", playlistId: pl.id, playlistName: pl.name, startIdx, tracks, repeat: nowPlaying?.repeat || "none" });
  };

  const playLocalTrack = (idx) => {
    if (!selectedPlaylist || selectedPlaylist.svc !== "local") return;
    const pl = localPlaylists.find(p => p.id === selectedPlaylist.id);
    if (!pl) return;
    const allTracks = pl.trackIds.map(id => importedFiles.find(f => f.id === id)).filter(Boolean);
    onNowPlaying({ svc: "local", playlistId: pl.id, playlistName: pl.name, startIdx: idx, tracks: allTracks, repeat: nowPlaying?.repeat || "none" });
  };

  const openEditPlaylist = (pl) => {
    setEditingPl(pl);
    setNewPlName(pl.name);
    setSelectedFileIds(new Set(pl.trackIds));
    setCreatePlOpen(true);
  };

  const openPlaylist = async (pl, svc) => {
    const name = svc === "youtube" ? pl.snippet?.title : pl.name;
    const thumb = svc === "youtube"
      ? (pl.snippet?.thumbnails?.medium?.url || pl.snippet?.thumbnails?.default?.url)
      : pl.images?.[0]?.url;
    const count = svc === "youtube" ? pl.contentDetails?.itemCount : pl.tracks?.total;
    setSelectedPlaylist({ id: pl.id, name, thumb, count, svc });
    setTracks([]);
    setTracksLoading(true);
    try {
      const rawItems = svc === "youtube"
        ? await ytFetchPlaylistItems(pl.id, ytToken)
        : await spFetchTracks(pl.id, spToken);
      const items = svc === "youtube"
        ? rawItems.map((item, i) => ({ ...item, _ytIdx: i }))
        : rawItems;
      setTracks(items);
    } catch (e) {
      setErr("Erro ao carregar faixas: " + e.message);
    } finally {
      setTracksLoading(false);
    }
  };

  const reorderTracks = (from, to) => {
    setTracks(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  const playTrack = (localIdx) => {
    const pl = selectedPlaylist;
    const isYt = pl.svc === "youtube";
    const ytIdx = isYt ? (tracks[localIdx]?._ytIdx ?? localIdx) : localIdx;
    const samePlaylist = nowPlaying?.playlistId === pl.id && nowPlaying?.svc === pl.svc;
    if (samePlaylist && isYt && ytPlayerRef?.current) {
      ytPlayerRef.current.playVideoAt(ytIdx);
      onNowPlaying(prev => prev ? { ...prev, startIdx: ytIdx } : prev);
      return;
    }
    const ytOrderedTracks = isYt
      ? [...tracks].sort((a, b) => (a._ytIdx ?? 0) - (b._ytIdx ?? 0))
      : tracks;
    onNowPlaying({
      svc: pl.svc, playlistId: pl.id, playlistName: pl.name,
      playlistThumb: pl.thumb, trackCount: pl.count,
      startIdx: ytIdx, tracks: ytOrderedTracks,
      repeat: nowPlaying?.repeat || "none",
    });
  };

  const isConnected = ytToken || spToken;
  const currentList = tab === "youtube" ? ytPlaylists : tab === "spotify" ? spPlaylists : localPlaylists;
  const isTabConnected = tab === "youtube" ? !!ytToken : tab === "spotify" ? !!spToken : true;
  const gold = "var(--gold)";
  const card = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 };
  const isPlayingThis = (pl, svc) => nowPlaying?.playlistId === pl.id && nowPlaying?.svc === svc;
  const ytEmail = localStorage.getItem("nx_yt_email") || "";
  const ytTokenExpired = !ytToken && !!ytEmail;

  return (
    <div className="fade" style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        {selectedPlaylist && (
          <button onClick={() => { setSelectedPlaylist(null); setTracks([]); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted2)", fontSize: 20, padding: "2px 6px", lineHeight: 1 }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted2)"}
          >←</button>
        )}
        <div style={{ fontSize: 24, color: gold }}>♪</div>
        <div>
          <div style={{ fontFamily: "Cinzel Decorative,serif", fontSize: 17, color: gold, letterSpacing: 2 }}>
            {selectedPlaylist ? selectedPlaylist.name : "Trilhas Sonoras"}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
            {selectedPlaylist
              ? `${tracks.length || selectedPlaylist.count || 0} faixas · ${selectedPlaylist.svc === "youtube" ? "YouTube" : selectedPlaylist.svc === "spotify" ? "Spotify" : "Local"}`
              : "Vincule YouTube ou Spotify, ou importe seus próprios arquivos MP3"}
          </div>
        </div>
        {(isConnected || ytTokenExpired) && !selectedPlaylist && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* YouTube badge */}
            {(ytToken || ytTokenExpired) && (() => {
              const expired = ytTokenExpired;
              const color = expired ? "var(--muted)" : "#ff4444";
              return (
                <div key="youtube" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, border: `1px solid ${expired ? "var(--border2)" : "#ff4444"}`, background: expired ? "transparent" : "rgba(255,68,68,0.08)", transition: "all 0.2s" }}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill={color}><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {ytEmail && <span style={{ fontFamily: "Cinzel,serif", fontSize: 8, color, letterSpacing: 0.5 }}>{ytEmail}</span>}
                    {expired && <span style={{ fontSize: 9, color: "#e07070", fontFamily: "Cinzel,serif", letterSpacing: 0.5 }}>Sessão expirada</span>}
                  </div>
                  {expired ? (
                    <button onClick={connectYouTube} style={{ background: "rgba(255,68,68,0.12)", border: "1px solid #ff4444", borderRadius: 4, cursor: "pointer", color: "#ff4444", fontSize: 8, fontFamily: "Cinzel,serif", padding: "2px 7px", letterSpacing: 1 }}>
                      Reconectar
                    </button>
                  ) : (
                    <button onClick={disconnectYT} title="Desconectar YouTube" style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,68,68,0.5)", fontSize: 14, padding: "0 2px", lineHeight: 1, display: "flex", alignItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ff4444"}
                      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,68,68,0.5)"}>✕</button>
                  )}
                </div>
              );
            })()}
            {/* Spotify badge */}
            {spToken && (
              <div key="spotify" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, border: "1px solid #1db954", background: "rgba(29,185,84,0.08)", transition: "all 0.2s" }}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="#1db954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                <span style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "#1db954", letterSpacing: 0.5 }}>Spotify</span>
                <button onClick={disconnectSP} title="Desconectar Spotify" style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(29,185,84,0.5)", fontSize: 14, padding: "0 2px", lineHeight: 1, display: "flex", alignItems: "center" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#1db954"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(29,185,84,0.5)"}>✕</button>
              </div>
            )}
          </div>
        )}
        {selectedPlaylist && (
          <button className="btn-gold" style={{ marginLeft: "auto", padding: "8px 18px", fontSize: 10 }}
            onClick={() => selectedPlaylist.svc === "local" ? playLocalTrack(0) : playTrack(0)}>
            ▶ Tocar tudo
          </button>
        )}
      </div>

      {err && (
        <div style={{ ...card, padding: "10px 14px", marginBottom: 16, borderColor: "rgba(139,32,32,0.5)", background: "rgba(139,32,32,0.1)", color: "#e07070", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{err}</span><span style={{ cursor: "pointer", marginLeft: 12 }} onClick={() => setErr("")}>✕</span>
        </div>
      )}

      {/* ── Connect view ── */}
      {!isConnected && !ytTokenExpired && tab !== "local" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600, margin: "48px auto" }}>
          {[
            { svc: "youtube", label: "YouTube", color: "#ff4444", bg: "rgba(255,68,68,0.06)",
              icon: <svg viewBox="0 0 24 24" width="38" height="38" fill="#ff4444"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
              desc: "Acesse suas playlists do YouTube durante a sessão de RPG", onClick: connectYouTube, isLoading: loading === "youtube" },
            { svc: "spotify", label: "Spotify", color: "#1db954", bg: "rgba(29,185,84,0.06)",
              icon: <svg viewBox="0 0 24 24" width="38" height="38" fill="#1db954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>,
              desc: "Toque suas playlists do Spotify enquanto joga", onClick: () => connectSpotify(), isLoading: loading === "spotify" },
          ].map(({ svc, label, color, bg, icon, desc, onClick, isLoading }) => (
            <div key={svc} onClick={isLoading ? undefined : onClick}
              style={{ ...card, padding: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, cursor: isLoading ? "default" : "pointer", transition: "all 0.25s" }}
              onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = bg; e.currentTarget.style.transform = "translateY(-2px)"; }}}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--card)"; e.currentTarget.style.transform = "none"; }}>
              {icon}
              <div style={{ fontFamily: "Cinzel,serif", fontSize: 13, letterSpacing: 2, color }}>{label}</div>
              <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
              <button className="btn-ghost" disabled={isLoading} style={{ marginTop: 4, borderColor: color, color, opacity: isLoading ? 0.6 : 1 }}>
                {isLoading ? <span style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 12, height: 12, border: `1.5px solid ${color}`, borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />Conectando...</span> : `Conectar ${label}`}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Playlist grid ── */}
      {(isConnected || ytTokenExpired || tab === "local") && !selectedPlaylist && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { id: "youtube", label: "▶ YouTube", connected: !!ytToken, color: "#ff4444", bg: "rgba(255,68,68,0.08)" },
              { id: "spotify", label: "● Spotify", connected: !!spToken, color: "#1db954", bg: "rgba(29,185,84,0.08)" },
              { id: "local", label: "♪ Local", connected: true, color: "var(--gold)", bg: "rgba(201,168,76,0.08)" },
            ].map(t => (
              <div key={t.id}
                onClick={() => {
                  if (t.id === "local") { setTab("local"); setSelectedPlaylist(null); setTracks([]); }
                  else if (t.connected) { setTab(t.id); setSelectedPlaylist(null); setTracks([]); }
                  else t.id === "youtube" ? connectYouTube() : connectSpotify();
                }}
                style={{ padding: "6px 18px", borderRadius: 20, cursor: "pointer", fontFamily: "Cinzel,serif", fontSize: 11, letterSpacing: 1, border: `1px solid ${tab === t.id ? t.color : "var(--border)"}`, background: tab === t.id ? t.bg : "transparent", color: t.connected ? (tab === t.id ? t.color : "var(--muted2)") : "var(--muted)", transition: "all 0.2s" }}>
                {t.label}{!t.connected && <span style={{ fontSize: 9, marginLeft: 4 }}>(conectar)</span>}
              </div>
            ))}
            {loading && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12, marginLeft: 8 }}><div style={{ width: 12, height: 12, border: "1.5px solid var(--border)", borderTopColor: gold, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Carregando...</div>}
            {importing && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12, marginLeft: 8 }}><div style={{ width: 12, height: 12, border: "1.5px solid var(--border)", borderTopColor: gold, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Importando...</div>}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              {tab === "local" && (
                <>
                  <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus" multiple style={{ display: "none" }}
                    onChange={e => { if (e.target.files?.length) importMp3Files(e.target.files); e.target.value = ""; }} />
                  <button className="btn-ghost" style={{ fontSize: 10, padding: "5px 14px", display: "flex", alignItems: "center", gap: 6 }}
                    onClick={() => fileInputRef.current?.click()}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Importar MP3
                  </button>
                  <button className="btn-gold" style={{ fontSize: 10, padding: "5px 14px" }}
                    onClick={() => { setEditingPl(null); setNewPlName(""); setSelectedFileIds(new Set()); setCreatePlOpen(true); }}>
                    + Criar Playlist
                  </button>
                </>
              )}
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{currentList.length > 0 && `${currentList.length} playlist${currentList.length !== 1 ? "s" : ""}`}</div>
            </div>
          </div>
          {tab === "local" ? (
            /* ── Local tab content ── */
            <div>
              {/* Drag & drop import zone */}
              <div
                onDragOver={e => { e.preventDefault(); setLocalDragging(true); }}
                onDragLeave={() => setLocalDragging(false)}
                onDrop={e => { e.preventDefault(); setLocalDragging(false); if (e.dataTransfer.files?.length) importMp3Files(e.dataTransfer.files); }}
                style={{ border: `2px dashed ${localDragging ? "var(--gold)" : "var(--border2)"}`, borderRadius: 14, padding: "32px 24px", textAlign: "center", marginBottom: 20, background: localDragging ? "rgba(201,168,76,0.08)" : "var(--card)", transition: "all 0.2s", cursor: "pointer", position: "relative", overflow: "hidden" }}
                onClick={() => fileInputRef.current?.click()}>
                {localDragging && <div style={{ position: "absolute", inset: 0, background: "rgba(201,168,76,0.04)", animation: "pulse 0.6s ease-in-out infinite alternate" }} />}
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎵</div>
                <div style={{ fontFamily: "Cinzel,serif", fontSize: 12, color: localDragging ? "var(--gold)" : "var(--gold2)", letterSpacing: 1.5, marginBottom: 6, transition: "color 0.2s" }}>
                  {localDragging ? "Solte os arquivos aqui!" : "Arraste arquivos de áudio ou clique para importar"}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 0.5 }}>MP3 · WAV · OGG · FLAC · M4A · AAC · OPUS</div>
                {importing && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--gold)", fontSize: 12 }}>
                    <div style={{ width: 12, height: 12, border: "1.5px solid var(--border)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Importando arquivos...
                  </div>
                )}
              </div>

              {/* Library stats + controls bar */}
              {importedFiles.length > 0 && (
                <div style={{ marginBottom: 20, padding: "12px 16px", ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎶</div>
                    <div>
                      <div style={{ fontFamily: "Cinzel,serif", fontSize: 10, color: "var(--gold2)", letterSpacing: 1 }}>Biblioteca Local</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>
                        {importedFiles.length} arquivo{importedFiles.length !== 1 ? "s" : ""} · {localPlaylists.length} playlist{localPlaylists.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  {/* Search filter */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", minWidth: 180 }}>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>⌕</span>
                    <input
                      value={localSearch}
                      onChange={e => setLocalSearch(e.target.value)}
                      placeholder="Buscar playlists..."
                      style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 12, width: "100%" }}
                    />
                    {localSearch && <span style={{ cursor: "pointer", color: "var(--muted)", fontSize: 11 }} onClick={() => setLocalSearch("")}>✕</span>}
                  </div>
                  <button className="btn-ghost" style={{ fontSize: 10, padding: "5px 12px", whiteSpace: "nowrap" }}
                    onClick={() => setShowLibrary(v => !v)}>
                    {showLibrary ? "▲ Ocultar arquivos" : "▼ Ver arquivos"}
                  </button>
                  <button className="btn-gold" style={{ fontSize: 10, padding: "5px 14px", whiteSpace: "nowrap" }}
                    onClick={() => { setEditingPl(null); setNewPlName(""); setSelectedFileIds(new Set()); setCreatePlOpen(true); }}>
                    + Nova Playlist
                  </button>
                </div>
              )}

              {/* Expandable file library */}
              {showLibrary && importedFiles.length > 0 && (
                <div style={{ ...card, marginBottom: 20, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "Cinzel,serif", fontSize: 10, color: "var(--gold2)", letterSpacing: 1 }}>Todos os Arquivos</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>({importedFiles.length})</span>
                  </div>
                  <div style={{ maxHeight: 240, overflowY: "auto" }}>
                    {importedFiles.map((f, i) => (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", borderBottom: i < importedFiles.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--card2)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>🎵</span>
                        <span style={{ flex: 1, fontSize: 12, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name?.replace(/\.[^.]+$/, "") || f.name}</span>
                        <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>{f.name?.split(".").pop()?.toUpperCase()}</span>
                        <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, padding: "0 4px", flexShrink: 0 }}
                          title="Remover arquivo"
                          onClick={() => { if (window.confirm(`Remover "${f.name}" da biblioteca?`)) deleteImportedFile(f.id); }}
                          onMouseEnter={e => e.currentTarget.style.color = "#e07070"}
                          onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Local playlists grid */}
              {localPlaylists.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--muted)" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎼</div>
                  <div style={{ marginBottom: 6, fontFamily: "Cinzel,serif", fontSize: 12, color: "var(--muted2)", letterSpacing: 1.5 }}>Nenhuma playlist local ainda</div>
                  <div style={{ fontSize: 12, marginBottom: 20, color: "var(--muted)" }}>Importe arquivos de áudio acima e crie sua primeira playlist</div>
                  {importedFiles.length > 0 && (
                    <button className="btn-gold" style={{ fontSize: 11, padding: "8px 20px" }}
                      onClick={() => { setEditingPl(null); setNewPlName(""); setSelectedFileIds(new Set()); setCreatePlOpen(true); }}>
                      + Criar Playlist
                    </button>
                  )}
                </div>
              ) : (() => {
                const filtered = localSearch.trim()
                  ? localPlaylists.filter(pl => pl.name.toLowerCase().includes(localSearch.toLowerCase()))
                  : localPlaylists;
                return filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)", fontSize: 12 }}>Nenhuma playlist encontrada para "{localSearch}"</div>
                ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
                  {filtered.map(pl => {
                    const playing = nowPlaying?.playlistId === pl.id && nowPlaying?.svc === "local";
                    const accentColor = localAccent(pl.name);
                    const trackCount = pl.trackIds.length;
                    return (
                      <div key={pl.id} onClick={() => openLocalPlaylist(pl)}
                        style={{ ...card, padding: 10, cursor: "pointer", transition: "all 0.2s", border: `1px solid ${playing ? accentColor : "var(--border)"}`, background: playing ? "rgba(201,168,76,0.05)" : "var(--card)", position: "relative" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.transform = "translateY(-2px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = playing ? accentColor : "var(--border)"; e.currentTarget.style.transform = "none"; }}>
                        {/* Cover art */}
                        <div style={{ width: "100%", aspectRatio: "1", borderRadius: 6, marginBottom: 8, background: localGradient(pl.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, position: "relative" }}>
                          🎵
                          {playing && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, borderRadius: 6 }}>▶</div>}
                        </div>
                        <div style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{pl.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{trackCount} faixa{trackCount !== 1 ? "s" : ""}</div>
                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                          <button style={{ flex: 1, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 4, cursor: "pointer", color: "var(--gold2)", fontSize: 9, fontFamily: "Cinzel,serif", padding: "3px 0" }}
                            onClick={e => { e.stopPropagation(); playLocalPlaylist(pl); }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,168,76,0.22)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(201,168,76,0.12)"; }}>▶ Tocar</button>
                          <button style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--muted)", fontSize: 10, padding: "3px 6px" }}
                            onClick={e => { e.stopPropagation(); openEditPlaylist(pl); }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>✎</button>
                          <button style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--muted)", fontSize: 10, padding: "3px 6px" }}
                            onClick={e => { e.stopPropagation(); if (window.confirm(`Excluir "${pl.name}"?`)) deleteLocalPlaylist(pl.id); }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(139,32,32,0.5)"; e.currentTarget.style.color = "#e07070"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                );
              })()}
            </div>
          ) : !isTabConnected ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>♪</div>
              <div style={{ marginBottom: 16 }}>Conecte sua conta para ver as playlists</div>
              <button className="btn-ghost" onClick={() => tab === "youtube" ? connectYouTube() : connectSpotify()}>Conectar {tab === "youtube" ? "YouTube" : "Spotify"}</button>
            </div>
          ) : currentList.length === 0 && !loading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}><div style={{ fontSize: 32, marginBottom: 12 }}>♪</div><div>Nenhuma playlist encontrada.</div></div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
              {currentList.map(pl => {
                const isYt = tab === "youtube";
                const thumb = isYt ? (pl.snippet?.thumbnails?.medium?.url || pl.snippet?.thumbnails?.default?.url) : pl.images?.[0]?.url;
                const name = isYt ? pl.snippet?.title : pl.name;
                const count = isYt ? pl.contentDetails?.itemCount : pl.tracks?.total;
                const playing = isPlayingThis(pl, tab);
                const accent = tab === "youtube" ? "#ff4444" : "#1db954";
                return (
                  <div key={pl.id} onClick={() => openPlaylist(pl, tab)}
                    style={{ ...card, padding: 10, cursor: "pointer", transition: "all 0.2s", border: `1px solid ${playing ? accent : "var(--border)"}`, background: playing ? (tab === "youtube" ? "rgba(255,68,68,0.05)" : "rgba(29,185,84,0.05)") : "var(--card)" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = playing ? accent : "var(--border)"; e.currentTarget.style.transform = "none"; }}>
                    <div style={{ width: "100%", aspectRatio: "1", borderRadius: 4, overflow: "hidden", marginBottom: 8, background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      {thumb ? <img src={thumb} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 28, color: "var(--muted)" }}>♪</span>}
                      {playing && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: accent }}>▶</div>}
                    </div>
                    <div style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{name}</div>
                    {count != null && <div style={{ fontSize: 11, color: "var(--muted)" }}>{count} faixas</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Track list ── */}
      {(isConnected || ytTokenExpired || tab === "local") && selectedPlaylist && (
        <div>
          {tracksLoading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
              <div style={{ width: 28, height: 28, border: "2px solid var(--border)", borderTopColor: gold, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              Carregando faixas...
            </div>
          ) : tracks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}><div style={{ fontSize: 32, marginBottom: 12 }}>♪</div><div>Nenhuma faixa encontrada.</div></div>
          ) : selectedPlaylist.svc === "local" ? (
            /* ── Local track list ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {tracks.map((item, idx) => {
                const nowLocalIdx = nowPlaying?.playlistId === selectedPlaylist.id && nowPlaying?.svc === "local" ? (nowPlaying?.startIdx ?? -1) : -1;
                const isCurrentTrack = nowLocalIdx === idx;
                const accentColor = localAccent(selectedPlaylist.name);
                return (
                  <div key={item.id || idx}
                    draggable
                    onDragStart={e => { dragRef.current = idx; e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnter={() => { dragOverRef.current = idx; }}
                    onDragOver={e => e.preventDefault()}
                    onDragEnd={() => {
                      const from = dragRef.current; const to = dragOverRef.current;
                      dragRef.current = null; dragOverRef.current = null;
                      if (from !== null && to !== null && from !== to) reorderTracks(from, to);
                    }}
                    onClick={() => playLocalTrack(idx)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 6, cursor: "pointer", transition: "background 0.15s", background: isCurrentTrack ? "rgba(201,168,76,0.08)" : "transparent" }}
                    onMouseEnter={e => { if (!isCurrentTrack) e.currentTarget.style.background = "var(--card)"; }}
                    onMouseLeave={e => { if (!isCurrentTrack) e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ width: 14, flexShrink: 0, display: "flex", flexDirection: "column", gap: 3, alignItems: "center", justifyContent: "center", cursor: "grab", opacity: 0.35 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.35"}>
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                    </div>
                    <div style={{ width: 24, textAlign: "center", flexShrink: 0, fontSize: 12, color: isCurrentTrack ? accentColor : "var(--muted)", fontFamily: "Cinzel,serif" }}>
                      {isCurrentTrack ? "▶" : idx + 1}
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0, background: localGradient(selectedPlaylist.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎵</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: isCurrentTrack ? accentColor : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.name?.replace(/\.[^.]+$/, "") || "Sem nome"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Arquivo local</div>
                    </div>
                    <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 14, padding: "2px 6px", flexShrink: 0 }}
                      title="Remover da biblioteca"
                      onClick={e => { e.stopPropagation(); if (window.confirm(`Remover "${item.name}" da biblioteca?`)) deleteImportedFile(item.id); }}
                      onMouseEnter={e => e.currentTarget.style.color = "#e07070"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}>✕</button>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── YouTube / Spotify track list ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {tracks.map((item, idx) => {
                const isYt = selectedPlaylist.svc === "youtube";
                const title = isYt ? item.snippet?.title : item.track?.name;
                const thumb = isYt
                  ? (item.snippet?.thumbnails?.default?.url)
                  : item.track?.album?.images?.[2]?.url || item.track?.album?.images?.[0]?.url;
                const sub = isYt
                  ? item.snippet?.videoOwnerChannelTitle
                  : item.track?.artists?.map(a => a.name).join(", ");
                const dur = !isYt && item.track?.duration_ms ? fmtDuration(item.track.duration_ms) : null;
                const nowYtIdx = nowPlaying?.playlistId === selectedPlaylist.id ? (nowPlaying?.startIdx ?? -1) : -1;
                const isCurrentTrack = isYt ? (item._ytIdx === nowYtIdx) : (nowYtIdx === idx);
                const accent = isYt ? "#ff4444" : "#1db954";

                return (
                  <div key={idx}
                    draggable
                    onDragStart={e => { dragRef.current = idx; e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnter={() => { dragOverRef.current = idx; }}
                    onDragOver={e => e.preventDefault()}
                    onDragEnd={() => {
                      const from = dragRef.current;
                      const to = dragOverRef.current;
                      dragRef.current = null;
                      dragOverRef.current = null;
                      if (from !== null && to !== null && from !== to) reorderTracks(from, to);
                    }}
                    onClick={() => playTrack(idx)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 6, cursor: "pointer", transition: "background 0.15s", background: isCurrentTrack ? (isYt ? "rgba(255,68,68,0.07)" : "rgba(29,185,84,0.07)") : "transparent" }}
                    onMouseEnter={e => { if (!isCurrentTrack) e.currentTarget.style.background = "var(--card)"; }}
                    onMouseLeave={e => { if (!isCurrentTrack) e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ width: 14, flexShrink: 0, display: "flex", flexDirection: "column", gap: 3, alignItems: "center", justifyContent: "center", cursor: "grab", opacity: 0.35 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "0.35"}>
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                    </div>
                    <div style={{ width: 24, textAlign: "center", flexShrink: 0, fontSize: 12, color: isCurrentTrack ? accent : "var(--muted)", fontFamily: "Cinzel,serif" }}>
                      {isCurrentTrack ? "▶" : idx + 1}
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {thumb ? <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, color: "var(--muted)" }}>♪</span>}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: isCurrentTrack ? accent : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
                    </div>
                    {dur && <div style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{dur}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Criar / Editar Playlist Local Modal ── */}
      {createPlOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setCreatePlOpen(false); setEditingPl(null); } }}>
          <div style={{ ...card, padding: 0, maxWidth: 560, width: "100%", background: "var(--surface)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: newPlName ? localGradient(newPlName) : "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "background 0.3s" }}>🎵</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Cinzel,serif", fontSize: 13, color: gold, letterSpacing: 2 }}>{editingPl ? "Editar Playlist" : "Nova Playlist"}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{selectedFileIds.size} faixa{selectedFileIds.size !== 1 ? "s" : ""} selecionada{selectedFileIds.size !== 1 ? "s" : ""}</div>
              </div>
              <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 20, padding: "2px 6px" }}
                onClick={() => { setCreatePlOpen(false); setEditingPl(null); }}>✕</button>
            </div>
            {/* Name input */}
            <div style={{ padding: "16px 24px 0" }}>
              <input value={newPlName} onChange={e => setNewPlName(e.target.value)}
                placeholder="Nome da playlist..."
                style={{ width: "100%", boxSizing: "border-box", fontFamily: "Cinzel,serif", fontSize: 13 }}
                onKeyDown={e => { if (e.key === "Enter" && newPlName.trim() && selectedFileIds.size > 0) createLocalPlaylist(); }} />
            </div>
            {/* File list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 16px" }}>
              {importedFiles.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🎵</div>
                  <div style={{ marginBottom: 12 }}>Nenhum arquivo importado ainda</div>
                  <button className="btn-ghost" style={{ fontSize: 10 }} onClick={() => { setCreatePlOpen(false); fileInputRef.current?.click(); }}>Importar MP3</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontFamily: "Cinzel,serif", fontSize: 10, color: "var(--muted2)", letterSpacing: 1 }}>BIBLIOTECA LOCAL · {importedFiles.length} arquivo{importedFiles.length !== 1 ? "s" : ""}</div>
                    <button style={{ background: "transparent", border: "none", cursor: "pointer", color: selectedFileIds.size === importedFiles.length ? gold : "var(--muted)", fontSize: 10, fontFamily: "Cinzel,serif", letterSpacing: 1 }}
                      onClick={() => setSelectedFileIds(selectedFileIds.size === importedFiles.length ? new Set() : new Set(importedFiles.map(f => f.id)))}>
                      {selectedFileIds.size === importedFiles.length ? "Desmarcar todos" : "Selecionar todos"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {importedFiles.map(f => {
                      const checked = selectedFileIds.has(f.id);
                      return (
                        <div key={f.id} onClick={() => {
                          setSelectedFileIds(prev => {
                            const n = new Set(prev);
                            checked ? n.delete(f.id) : n.add(f.id);
                            return n;
                          });
                        }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 6, cursor: "pointer", transition: "background 0.15s", background: checked ? "rgba(201,168,76,0.07)" : "transparent", border: `1px solid ${checked ? "rgba(201,168,76,0.2)" : "transparent"}` }}
                          onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--card)"; }}
                          onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${checked ? gold : "var(--border2)"}`, background: checked ? gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                            {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <div style={{ fontSize: 14, flexShrink: 0 }}>🎵</div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, color: checked ? "var(--gold2)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {f.name?.replace(/\.[^.]+$/, "") || "Sem nome"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => { setCreatePlOpen(false); setEditingPl(null); }}>Cancelar</button>
              <button className="btn-gold" disabled={!newPlName.trim() || selectedFileIds.size === 0} onClick={createLocalPlaylist}
                style={{ opacity: !newPlName.trim() || selectedFileIds.size === 0 ? 0.5 : 1 }}>
                {editingPl ? "Salvar" : "Criar Playlist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spotify Setup Modal */}
      {spSetupOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setSpSetupOpen(false); }}
        >
          <div style={{ ...card, padding: 28, maxWidth: 480, width: "90%", background: "var(--surface)" }}>
            <div style={{ fontFamily: "Cinzel,serif", fontSize: 14, color: gold, letterSpacing: 2, marginBottom: 6 }}>
              Configurar Spotify
            </div>
            <p style={{ color: "var(--muted2)", fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              Crie um app em{" "}
              <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "#1db954" }}>
                developer.spotify.com
              </a>
              , copie o <strong style={{ color: "var(--text)" }}>Client ID</strong> e adicione como URI de redirecionamento:
            </p>
            <code style={{
              display: "block", background: "var(--card2)", padding: "8px 12px", borderRadius: 4,
              fontSize: 12, color: "var(--gold2)", marginBottom: 16, wordBreak: "break-all",
              border: "1px solid var(--border)",
            }}>
              {window.location.origin + window.location.pathname.replace(/\/+$/, "")}
            </code>
            <input
              value={spClientIdDraft}
              onChange={e => setSpClientIdDraft(e.target.value)}
              placeholder="Cole aqui o Client ID do Spotify..."
              style={{ marginBottom: 14 }}
              onKeyDown={e => {
                if (e.key === "Enter" && spClientIdDraft.trim()) {
                  const cid = spClientIdDraft.trim();
                  setSpClientId(cid); setSpSetupOpen(false); connectSpotify(cid);
                }
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setSpSetupOpen(false)}>Cancelar</button>
              <button className="btn-gold"
                disabled={!spClientIdDraft.trim()}
                onClick={() => {
                  const cid = spClientIdDraft.trim();
                  if (cid) { setSpClientId(cid); setSpSetupOpen(false); connectSpotify(cid); }
                }}>
                Salvar e Conectar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   ROOT
═══════════════════════════════ */
/* ═══════════════════════════════
   ROADMAP
═══════════════════════════════ */
const ROADMAP_STATUS = {
  done:    { dot:"#4caf50", badge:"Pronto",    bg:"rgba(76,175,80,0.1)",    color:"#7ecb82", border:"rgba(76,175,80,0.28)" },
  planned: { dot:"#8e6dbf", badge:"Planejado", bg:"rgba(142,109,191,0.1)", color:"#c8a8f0", border:"rgba(142,109,191,0.28)" },
  backlog: { dot:"#3d3554", badge:"Backlog",   bg:"rgba(50,45,70,0.5)",    color:"#6b6488", border:"rgba(80,72,108,0.3)" },
};

const PHASE_STATUS = {
  done:    { label:"Concluído",    color:"#7ecb82", bg:"rgba(76,175,80,0.08)",    border:"rgba(76,175,80,0.28)",    pulse:false },
  current: { label:"Em andamento", color:"#c9a84c", bg:"rgba(201,168,76,0.08)",  border:"rgba(201,168,76,0.35)",   pulse:true  },
  future:  { label:"Futuro",       color:"#c8a8f0", bg:"rgba(142,109,191,0.08)", border:"rgba(142,109,191,0.28)",  pulse:false },
};

function RoadmapItem({ item }) {
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

function IntroScreen({ onDone }) {
  const [fading, setFading] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const finish = useRef(() => {
    setFading(true);
    setTimeout(() => doneRef.current(), 700);
  }).current;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "#000",
      opacity: fading ? 0 : 1,
      transition: "opacity 0.7s ease",
      pointerEvents: fading ? "none" : "auto",
    }}>
      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finish}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      >
        <source src="/intro.mp4" type="video/mp4" />
      </video>
      <span
        onClick={finish}
        style={{
          position: "absolute", bottom: 28, right: 28, zIndex: 2,
          fontFamily: "Cinzel, serif", fontSize: 11, letterSpacing: 2,
          textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
          cursor: "pointer", userSelect: "none",
          transition: "color 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.9)"}
        onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
      >
        Toque para pular
      </span>
    </div>
  );
}

function RoadmapScreen() {
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

/* ── Ficha pública (rota /p/:charId, sem login) ─────────────────────── */
/* ── ROTA DE TRANSMISSÃO: /cast/{campaignId} (doc Owlbear /docs/casting) ──
 * Janela dedicada para jogar em mesa presencial: você abre numa segunda tela (TV) e ela
 * mostra a mesa em **VISÃO DE JOGADOR** — `isMaster={false}` mesmo estando logado como
 * mestre, então a névoa fica opaca na TV, que é justamente o ponto (no Owlbear o
 * dispositivo de transmissão entra como jogador e não vê através da névoa).
 * Sem chrome do app: é mapa em tela cheia. A câmera acompanha o mestre pelo Sync View que
 * já existe, porque a TV normalmente não recebe input. */
function CastView({ campaignId }) {
  const [uid, setUid] = useState(auth.currentUser?.uid || null);
  const [ready, setReady] = useState(!!auth.currentUser);

  useEffect(() => onAuthStateChanged(auth, u => { setUid(u?.uid || null); setReady(true); }), []);

  const center = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07070d', color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', padding: 24 };

  if (!ready) return (<><Shell/><div style={center}><div style={{ width: 32, height: 32, border: '2px solid rgba(201,168,76,0.3)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div></>);
  if (!uid) return (<><Shell/><div style={center}>Entre na mesma conta neste navegador para transmitir a mesa.</div></>);

  return (
    <><Shell/>
      <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
        <MapEditor campaignId={campaignId} uid={uid} isMaster={false} db={db} />
      </div>
    </>
  );
}

function PublicSheetView({ charId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editorName, setEditorName] = useState("");
  const [editedChar, setEditedChar] = useState(null);
  const [submitState, setSubmitState] = useState("idle"); // idle | submitting | done
  const editedCharRef = useRef(null); // always current (sync), independent of debounce
  const flushSaveRef = useRef(null);  // assigned by OrdemParanormalSheet to flush debounce

  const urlParams = new URLSearchParams(window.location.search);
  const editorToken = urlParams.get("editor");

  useEffect(() => {
    getDoc(doc(db, "publicSheets", charId))
      .then(snap => {
        const d = snap.exists() ? snap.data() : null;
        setData(d);
        if (d) { setEditedChar(d); editedCharRef.current = d; }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [charId]);

  const isEditorMode = !!(editorToken && data && editorToken === data.editToken);

  const handleSubmitSuggestion = async () => {
    if (!editorName.trim()) { alert("Digite seu nome antes de enviar."); return; }
    setSubmitState("submitting");
    // flush debounce: forces onUpdate(latest.current) synchronously → updates editedCharRef
    flushSaveRef.current?.();
    await fsSavePendingEdit(charId, editedCharRef.current || data, editorName.trim());
    setSubmitState("done");
  };

  const bg = "var(--bg,#14141c)";
  const gold = "var(--gold,#c9a84c)";
  const green = "#4ade80";

  if (loading) return (
    <div style={{ minHeight:"100vh", background:bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:32, height:32, border:"2px solid rgba(201,168,76,0.3)", borderTopColor:gold, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
    </div>
  );

  if (!data || !data.public) return (
    <div style={{ minHeight:"100vh", background:bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:24 }}>
      <Shell/>
      <div style={{ fontFamily:"Cinzel,serif", fontSize:28, color:gold }}>◈</div>
      <div style={{ fontFamily:"Cinzel,serif", fontSize:16, color:"#eee", textAlign:"center" }}>Ficha não disponível publicamente</div>
      <div style={{ fontFamily:"Cinzel,serif", fontSize:11, color:"rgba(255,255,255,0.4)", textAlign:"center" }}>Este dossiê não foi compartilhado ou foi removido.</div>
      <a href="/" style={{ fontFamily:"Cinzel,serif", fontSize:11, color:gold, textDecoration:"none", padding:"8px 20px", border:`1px solid ${gold}50`, borderRadius:6, marginTop:8 }}>← Voltar ao Nexus RPG</a>
    </div>
  );

  if (submitState === "done") return (
    <div style={{ minHeight:"100vh", background:bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:24 }}>
      <Shell/>
      <div style={{ fontFamily:"Cinzel,serif", fontSize:32, color:green }}>✓</div>
      <div style={{ fontFamily:"Cinzel,serif", fontSize:16, color:"#eee", textAlign:"center" }}>Sugestão enviada!</div>
      <div style={{ fontFamily:"Cinzel,serif", fontSize:11, color:"rgba(255,255,255,0.45)", textAlign:"center", maxWidth:320 }}>
        O dono da ficha vai revisar suas alterações e aprovar o que quiser.
      </div>
      <a href="/" style={{ fontFamily:"Cinzel,serif", fontSize:11, color:gold, textDecoration:"none", padding:"8px 20px", border:`1px solid ${gold}50`, borderRadius:6, marginTop:8 }}>Criar minha própria ficha →</a>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:bg }}>
      <Shell/>
      {/* Banner */}
      <div style={{ background: isEditorMode ? "rgba(74,222,128,0.07)" : "rgba(201,168,76,0.07)", borderBottom:`1px solid ${isEditorMode ? "rgba(74,222,128,0.2)" : "rgba(201,168,76,0.18)"}`, padding:"8px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <NexusLogo size={16}/>
          <span style={{ fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:"0.12em", color: isEditorMode ? green : gold, textTransform:"uppercase" }}>
            Nexus RPG · {isEditorMode ? "Modo Editor" : "Ficha Pública"}
          </span>
          {isEditorMode && <span style={{ fontFamily:"Cinzel,serif", fontSize:8, color:green, padding:"2px 8px", borderRadius:20, background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.25)" }}>✏ você pode editar</span>}
        </div>
        {isEditorMode ? (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <input value={editorName} onChange={e=>setEditorName(e.target.value)} placeholder="Seu nome"
              style={{ background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:4, color:"#eee", padding:"5px 10px", fontSize:11, fontFamily:"Cinzel,serif", width:140 }}/>
            <button onClick={handleSubmitSuggestion} disabled={submitState==="submitting"}
              style={{ fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", padding:"5px 14px", borderRadius:4, border:`1px solid ${green}60`, background:`rgba(74,222,128,0.1)`, color:green }}>
              {submitState==="submitting" ? "Enviando…" : "Enviar Sugestão"}
            </button>
          </div>
        ) : (
          <a href="/" style={{ fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:"0.1em", color:gold, textDecoration:"none", padding:"5px 14px", border:`1px solid ${gold}50`, borderRadius:4, textTransform:"uppercase" }}>Criar minha ficha →</a>
        )}
      </div>
      {/* Sheet */}
      <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", flex:1 }}>
        <Suspense fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60}}><div style={{width:28,height:28,border:"2px solid rgba(201,168,76,0.3)",borderTopColor:gold,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/></div>}>
          <OrdemParanormalSheet
            character={editedChar || data}
            readOnly={!isEditorMode}
            onBack={isEditorMode ? null : () => { window.location.href = "/"; }}
            onRoll={null}
            defaultEditMode={isEditorMode}
            flushSaveRef={isEditorMode ? flushSaveRef : undefined}
            onUpdate={isEditorMode ? (updated) => { editedCharRef.current = updated; setEditedChar(updated); } : null}
          />
        </Suspense>
      </div>
    </div>
  );
}

/* Divisória vertical entre os blocos do rodapé — sem ela a linha vira um
 * amontoado de textos que o olho não consegue separar. */
const FooterDivider = () => (
  <span aria-hidden="true" style={{ width:1, height:20, background:"var(--border2)", flexShrink:0 }}/>
);

const AppFooter = ({ system }) => (
  <div className="nexus-footer" style={{
    borderTop:"1px solid var(--border2)", padding:"12px 24px",
    display:"flex", alignItems:"center", columnGap:18, rowGap:10, flexWrap:"wrap",
    background:"rgba(6,6,6,0.72)",
  }}>
    <div style={{display:"flex", gap:10, alignItems:"center", flexShrink:0}}>
      <NexusLogo size={18}/>
      <span style={{
        fontFamily:"var(--font-title,'Cinzel'),serif", fontSize:11, fontWeight:600,
        letterSpacing:"0.14em", color:"var(--muted2)", textTransform:"uppercase",
        whiteSpace:"nowrap",
      }}>Nexus RPG · v0.1 Beta</span>
    </div>
    {system?.id === "op" && (
      <>
        <FooterDivider/>
        <LicencaOP variant="footer" style={{ flex:"1 1 300px", minWidth:0 }}/>
      </>
    )}
    <div style={{marginLeft:"auto", display:"flex", gap:2, alignItems:"center", flexShrink:0}}>
      {[
        {label:"Suporte", icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>},
        {label:"Discord", icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.045.03.06a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>},
        {label:"Changelog", icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>},
      ].map(({label,icon})=>(
        <span key={label} style={{
          fontFamily:"var(--font-body,'Inter'),sans-serif", fontSize:11, fontWeight:500,
          letterSpacing:"0.07em", color:"var(--muted2)",
          cursor:"pointer", textTransform:"uppercase", whiteSpace:"nowrap",
          display:"flex", alignItems:"center", gap:7,
          padding:"7px 12px", borderRadius:6,
          border:"1px solid transparent",
          transition:"color .18s ease, border-color .18s ease, background .18s ease",
        }}
          onMouseEnter={e=>{e.currentTarget.style.color="var(--gold)";e.currentTarget.style.borderColor="rgba(201,168,76,0.3)";e.currentTarget.style.background="rgba(201,168,76,0.08)";}}
          onMouseLeave={e=>{e.currentTarget.style.color="var(--muted2)";e.currentTarget.style.borderColor="transparent";e.currentTarget.style.background="none";}}
        >
          {icon}{label}
        </span>
      ))}
    </div>
  </div>
);

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
  const sessKey = activeSystem ? `nexus_sessions_${activeSystem.id}` : null;
  const [sessions, setSessions] = useState(() => {
    try {
      const sys = JSON.parse(localStorage.getItem('nexus_system') || 'null');
      const key = sys ? `nexus_sessions_${sys.id}` : null;
      return key ? JSON.parse(localStorage.getItem(key) || '[]') : [];
    } catch { return []; }
  });
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
  const liveSheetRefsRef   = useRef({}); // { characterId: [docRef] }

  // Global live-sheet tracker — stays active regardless of which screen is open
  const campaignsRef = useRef([]);
  campaignsRef.current = campaigns;
  useEffect(() => {
    if (!currentUser?.uid) { liveSheetRefsRef.current = {}; return; }
    const uid = currentUser.uid;
    const camps = campaignsRef.current;
    if (!camps.length) return;
    const unsubs = camps.map(camp =>
      onSnapshot(collection(db, "campaigns", camp.id, "sharedSheets"), snap => {
        const next = { ...liveSheetRefsRef.current };
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.ownerId !== uid) return;
          const cId = data.characterId;
          if (!next[cId]) next[cId] = [];
          next[cId] = next[cId].filter(r => r.id !== d.id);
          if (data.isLive) next[cId].push(d.ref);
          if (!next[cId].length) delete next[cId];
        });
        liveSheetRefsRef.current = next;
      }, () => {})
    );
    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, campaigns.map(c => c.id).join('|')]);

  // Escuta plano em tempo real — ativa automaticamente após PIX pago
  useEffect(() => {
    if (!currentUser) { setUserPlans([]); return; }
    const unsub = onSnapshot(doc(db, "users", currentUser.uid), snap => {
      if (snap.exists()) setUserPlans(snap.data().subscribedSystems || []);
    }, () => {});
    return unsub;
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
    if (!activeSystem) return;
    const key = `nexus_sessions_${activeSystem.id}`;
    try { setSessions(JSON.parse(localStorage.getItem(key) || '[]')); } catch { setSessions([]); }
  }, [activeSystem?.id]);
  useEffect(() => {
    if (sessKey) localStorage.setItem(sessKey, JSON.stringify(sessions));
  }, [sessions, sessKey]);
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
    fsGetPendingEdits(cId).then(setPendingEdits);
  };
  const handleApprovePendingEdit = async (edit, mergedChar) => {
    if (!createdChar) return;
    const cId = String(createdChar.id || createdChar.createdAt);
    const keep = { id: createdChar.id, createdAt: createdChar.createdAt, systemId: createdChar.systemId, public: createdChar.public, editToken: createdChar.editToken, ownerUid: currentUser?.uid };
    const final = mergedChar ? { ...mergedChar, ...keep } : { ...createdChar, ...edit.proposedData, ...keep };
    setCreatedChar(final);
    saveCharacter(final);
    fsSavePublicSheet(cId, final, currentUser?.uid);
    await fsResolvePendingEdit(cId, edit.id, "approved");
    setPendingEdits(prev => prev.filter(e => e.id !== edit.id));
  };
  const handleRejectPendingEdit = async (edit) => {
    if (!createdChar) return;
    const cId = String(createdChar.id || createdChar.createdAt);
    await fsResolvePendingEdit(cId, edit.id, "rejected");
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
        if (updated.public) fsSavePublicSheet(cId, updated, currentUser?.uid);
        else fsRemovePublicSheet(cId);
        // Sync to live sharedSheets via global ref (always active)
        (liveSheetRefsRef.current[cId] || []).forEach(ref =>
          updateDoc(ref, {
            characterData: updated,
            characterName: updated.form?.personagem || "Sem nome",
          }).catch(console.error)
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
      case "dashboard": return <Dashboard system={activeSystem} onCreateChar={()=>setCreatingChar(true)} characters={characters} sessions={sessions} onSelectChar={c=>{ setCreatedChar(c); setScreen("sheet"); }} onNav={setScreen} userPlans={userPlans} onShowUpgrade={()=>setScreen("planos")}/>;
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
              onOpenCampaign={setSelectedCampaign}
              onCreateCampaign={()=>setShowCreateCampaign(true)}
              onJoinCampaign={()=>setShowJoinCampaign(true)}/>
            {showCreateCampaign && <CreateCampaignModal onClose={()=>setShowCreateCampaign(false)} onCreate={async(data)=>{const r=await createCampaign(data);if(r&&!r.limitError){setShowCreateCampaign(false);return true;}return r||false;}}/>}
            {showJoinCampaign && <JoinCampaignModal onClose={()=>setShowJoinCampaign(false)} onJoin={async(code)=>{const r=await joinCampaign(code);if(!r?.error)setShowJoinCampaign(false);return r;}}/>}
          </>
        );
      }
      default: return <Dashboard system={activeSystem} onCreateChar={()=>setCreatingChar(true)} characters={characters} sessions={sessions} onNav={setScreen} userPlans={userPlans} onShowUpgrade={()=>setScreen("planos")}/>;
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
          <Topbar screen={screen} system={activeSystem} onChangeSystem={()=>setActiveSystem(null)} onLogout={logout}/>
          {/* hidden div that hosts the YT IFrame player — never unmounts */}
          <div id="yt-player-host" style={{ position:"fixed", top:-9999, left:-9999, width:1, height:1, pointerEvents:"none" }} />
          <main style={{flex:1, overflowY: (screen==="master" || (screen==="sheet" && createdChar && activeSystem?.id==="op")) ? "hidden" : "auto", padding: screen==="master" ? 0 : ((screen==="sheet" && createdChar && activeSystem?.id==="op") ? "12px 14px" : "20px 20px"), paddingBottom: screen==="master" ? 0 : ((screen==="sheet" && createdChar && activeSystem?.id==="op") ? 12 : (nowPlaying ? 112 : 20)), display:"flex", flexDirection:"column", minHeight:0}}>
            {/* MusicScreen is always mounted so audio persists across navigation */}
            <div style={{ display: screen === "music" ? "block" : "none" }}>
              <MusicScreen nowPlaying={nowPlaying} onNowPlaying={setNowPlaying} musicTokens={musicTokens} onMusicTokens={setMusicTokens} ytPlayerRef={ytPlayerRef} />
            </div>
            {screen !== "music" && <div key={screen} className="fade-screen" style={(screen==="master" || (screen==="sheet" && createdChar && activeSystem?.id==="op")) ? {flex:1, display:"flex", flexDirection:"column", minHeight:0} : {}}>{renderScreen()}</div>}
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
