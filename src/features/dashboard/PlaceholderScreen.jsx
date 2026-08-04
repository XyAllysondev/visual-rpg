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

export default PlaceholderScreen;
