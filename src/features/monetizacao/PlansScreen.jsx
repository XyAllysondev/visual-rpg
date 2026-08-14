import { useState } from "react";
import { getCardAccent } from "../../themes";

/* ═══════════════════════════════
   PLANS SCREEN
═══════════════════════════════ */
const PLAN_DEFS = [
  {
    systemId: "op",
    planName: "Agente da Ordem",
    system: "Ordem Paranormal",
    catarseUrl: "https://www.catarse.com.br/nexus-ordem",  // ← atualizar após criar página no Catarse
    features: ["5 fichas de Agente", "Ajudante do Mestre completo", "Campanhas multiplayer", "Trilhas sonoras"],
    badge: "TERROR • INVESTIGAÇÃO",
  },
  {
    systemId: "tormenta",
    planName: "Aventureiro de Arton",
    system: "Tormenta 20",
    catarseUrl: "https://www.catarse.com.br/nexus-tormenta",
    features: ["5 fichas de Personagem", "Ajudante do Mestre completo", "Campanhas multiplayer", "Trilhas sonoras"],
    badge: "FANTASIA • ÉPICO",
  },
  {
    systemId: "dnd",
    planName: "Herói Lendário",
    system: "D&D 5ª Edição",
    catarseUrl: "https://www.catarse.com.br/nexus-dnd",
    features: ["5 fichas de Personagem", "Ajudante do Mestre completo", "Campanhas multiplayer", "Trilhas sonoras"],
    badge: "FANTASIA • COMBATE",
  },
]
  /* A COR sai do registry de temas, igual à tela de seleção (spec 0017 AC-6).
   *
   * Antes cada plano trazia o próprio `accent` escrito à mão, e esta tela era
   * uma SEGUNDA fonte da verdade que ninguém migrou junto com a 0017: o D&D
   * aparecia AZUL (#4a6fa5) e o Tormenta LARANJA, enquanto o mesmo sistema é
   * vermelho e verde em todo o resto do app. O conserto é apagar a cópia, não
   * repintá-la.
   *
   * Merge de 2026-08-14: este conserto tinha sido feito na linha visual, mas
   * dentro do App.jsx monolítico. Como o bloco mudou de arquivo na spec 0031,
   * o merge automático não o trouxe — os três literais voltaram, e foi o
   * teste de guarda systems-accent que pegou. Reaplicado aqui, no lar novo. */
  .map((p) => ({ ...p, ...getCardAccent(p.systemId) }));

export default function PlansScreen({ userPlans = [], currentUser }) {
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
