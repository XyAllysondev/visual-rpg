/* ═══════════════════════════════
   UPGRADE MODAL — Plano Ordem
═══════════════════════════════ */
export default function UpgradeModal({ onClose, onGoToPlans }) {
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
