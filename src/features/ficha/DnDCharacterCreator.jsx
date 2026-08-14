import { useState } from "react";
import { DND_CLASSES, DND_RACES, DND_THEMES } from "./opConstants";

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

export default DnDCharacterCreator;
