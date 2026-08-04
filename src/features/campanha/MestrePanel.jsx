import { useState, useEffect, useRef } from "react";
import { ELEMENTOS, getElementTheme } from "../../components/systems/OrdemParanormal/elementos";
import ElementoSymbol from "../../components/systems/OrdemParanormal/ElementoSymbol";
import * as campaignsRepo from "../../infrastructure/firestore/campaignsRepo";
import * as sharedSheetsRepo from "../../infrastructure/firestore/sharedSheetsRepo";
import { getActiveAvatar } from "../../domain/character";
import { rollDice } from "../../domain/dice";
import { resizeCoverImage } from "./campanhaHelpers";
import { fsSendMessage } from "./campanhaApi";

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
    return sharedSheetsRepo.watchByCampaign(campaign.id, newSheets => {
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
    });
  }, [campaign.id]);

  const applyElement = async (sheetId, el) => {
    try {
      await sharedSheetsRepo.applyElement(campaign.id, sheetId, { elemento: el, uid });
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
      await campaignsRepo.setNarracao(campaign.id, payload, {
        testMode,
        targetIds: (!testMode && narrTarget !== "all") ? narrTargetIds : undefined,
      });
    } catch(e) { console.error("[narração] envio falhou:", e); }
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
    /* Os dois cartões paravam em 821 px cada e deixavam 519 px de preto embaixo.
       Com teto de 1280 eles distribuem a largura em vez de sobrar dela. */
    <div className="fade" style={{ overflowY: "auto", minHeight: 0, paddingRight: 4, paddingBottom: 28, maxWidth: 1280, width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>

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

export default MestrePanel;
