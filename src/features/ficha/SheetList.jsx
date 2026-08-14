import { useState, useEffect } from "react";
import { getActiveAvatar } from "../../domain/character";
/* quick 007 — mesma função que o dossiê usa por dentro, para a aba da pasta
   e a folha de rosto nunca divergirem de número. */
import { numeroDeProcesso } from "../../components/systems/OrdemParanormal/dossie";

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

  // Apenas personagens deste sistema. Personagens sem systemId (legados) só aparecem em OP.
  const sysChars = characters.filter(c =>
    c.systemId === system?.id || (!c.systemId && system?.id === 'op')
  );

  const filtered = sysChars.filter(c =>
    (c.form?.personagem || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fade nx-page">

      {/* Mesmo cabeçalho do painel e das campanhas (redesign de layout 2026-08-02). Antes era um
          <h2> solto "Agentes: 1/5" — sem sobrancelha, sem filete, com a cota
          grudada no título — e um botão cinza que não era nem primário nem
          fantasma. Terceira tela, terceiro cabeçalho diferente. */}
      <div className="nx-head">
        <div className="nx-head-txt">
          <div className="nx-eyebrow">{system?.name || "Fichas"}</div>
          <h1 className="nx-h1">Agentes</h1>
          <p className="nx-sub">Cada ficha guarda atributos, perícias, inventário e rituais do personagem.</p>
        </div>
        <div className="nx-head-actions">
          <span style={{fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"var(--muted)", letterSpacing:"0.04em"}}>
            {sysChars.length}/5
          </span>
          <button onClick={sysChars.length < 5 ? onCreateChar : undefined} disabled={sysChars.length >= 5}
            className="btn-gold"
            style={{opacity: sysChars.length >= 5 ? 0.45 : 1, cursor: sysChars.length >= 5 ? "not-allowed" : "pointer"}}
            title={sysChars.length >= 5 ? "Limite de 5 fichas atingido" : ""}>
            {sysChars.length >= 5 ? "Limite 5/5" : "+ Novo agente"}
          </button>
        </div>
      </div>

      {/* Busca — só aparece quando há o que filtrar. Um campo de busca sobre
          uma ficha só era moldura sem função. */}
      {sysChars.length > 2 && (
        <div style={{position:"relative"}}>
          <span style={{position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", fontSize:15, pointerEvents:"none"}}>⌕</span>
          <input
            placeholder="Buscar agente"
            value={search}
            onChange={e=>setSearch(e.target.value)}
            aria-label="Buscar agente"
            style={{paddingLeft:40, borderRadius:6, fontSize:14, background:"rgba(255,255,255,0.03)", border:"1px solid var(--border)"}}
          />
        </div>
      )}

      {/* Vazio — alinhado à esquerda, sem emoji de 48px e sem segundo botão
          dourado competindo com o "+ Novo agente" do cabeçalho */}
      {filtered.length === 0 && (
        <div className="nx-empty">
          <div className="nx-empty-t">{search ? "Nenhum agente encontrado" : "Nenhum agente criado"}</div>
          <p className="nx-empty-d">
            {search
              ? "Nenhuma ficha deste sistema bate com o que você digitou."
              : "Use o botão Novo agente acima para criar a primeira ficha deste sistema."}
          </p>
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
              onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(176,48,216,0.5)"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 12px 40px rgba(176,48,216,0.18)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"}}>

              {/* quick 007 — a aba da pasta carrega o MESMO nº de processo que o
                  dossiê mostra por dentro (mesma função, mesmo id ⇒ mesmo
                  número). Veio do App.jsx monolítico no merge de 2026-08-14. */}
              {numeroDeProcesso(String(c.id || c.createdAt || "")) && (
                <span className="h-pasta-aba" aria-hidden="true">OP-{numeroDeProcesso(String(c.id || c.createdAt || ""))}</span>
              )}

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

              {/* Footer — o botão era um bloco roxo #7c3aed preenchido, largura
                  total: um segundo botão primário POR CARD. Com cinco fichas na
                  grade eram cinco blocos roxos gritando ao mesmo tempo, e nenhum
                  deles usava a linguagem de botão do resto do app. Vira o botão
                  secundário da casa (.nx-btn): o card inteiro já é o alvo de
                  clique, então isto é reforço, não o CTA da tela. */}
              <div style={{padding:"14px 18px 18px"}}>
                <button onClick={()=>onSelectChar(c)} className="nx-btn" style={{width:"100%"}}>
                  Acessar ficha
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

export default SheetList;
