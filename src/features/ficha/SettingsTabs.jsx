import { useSlidingPill } from "../../hooks/useSlidingPill";
import SlidingTabPill from "../../components/SlidingTabPill";

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

export default SettingsTabs;
