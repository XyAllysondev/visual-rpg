import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "../../i18n/useLocale";
import { rollNotation, rollOP } from "../../domain/dice";
import { nexStats } from "../../lib/nexStats";
import { useIsMobile } from "../../lib/useViewport";
import SettingsTabs from "./SettingsTabs";
import AttrDiagram from "./AttrDiagram";
import Bar from "./Bar";
import { ORIGENS, CLASS_TRAILS, TRAIL_ABILITIES, CLASS_BASE_ABILITIES, CLASSES, NEX_STEPS } from "./opConstants";
import { startAuraSound, stopAuraSound, playDiceRollSound } from "./fichaSons";

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

export default FullSheet;
