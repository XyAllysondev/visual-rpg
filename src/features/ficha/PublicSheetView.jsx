import { useState, useEffect, useRef, Suspense } from "react";
import * as publicSheetsRepo from "../../infrastructure/firestore/publicSheetsRepo";
import Shell from "../../lib/appShell";
import NexusLogo from "../../lib/NexusLogo";
import { OrdemParanormalSheet } from "../../lib/lazySystemSheets";

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
    publicSheetsRepo.get(charId)
      .then(d => {
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
    await publicSheetsRepo.savePendingEdit(charId, editedCharRef.current || data, editorName.trim());
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
            /* A ficha SEMPRE desenha o "← Voltar". Com `onBack` nulo no modo
               editor, o botão existia e não fazia nada — controle morto bem na
               única tela que um convidado de fora enxerga. Sair é a mesma coisa
               nos dois modos; o que o editor perde ao sair é a sugestão ainda
               não enviada, e por isso ele confirma antes. */
            onBack={() => {
              if (isEditorMode && !window.confirm("Sair sem enviar suas sugestões?")) return;
              window.location.href = "/";
            }}
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

export default PublicSheetView;
