/* ════════════════════════════════════════════════════════════════════════
 *  SELO DO MODO DEMO
 *  ------------------------------------------------------------------------
 *  Existe por um motivo só: enquanto o modo demo estiver ligado, tem que
 *  ser IMPOSSÍVEL confundir os dados semeados com dados reais. Fica fixo no
 *  canto, por cima de tudo, e o botão sai da demo e limpa a semente.
 *
 *  Não é UI de produto — some junto com o modo demo.
 * ════════════════════════════════════════════════════════════════════════ */

import { sairDoDemo } from "./demoMode";

export default function DemoBadge() {
  return (
    <div
      role="status"
      aria-label="Modo demonstração ativo — os dados desta tela são fictícios"
      style={{
        /* Topo central: o rodapé da barra lateral tem o perfil e o "sair", e o
           rodapé da página tem os links — os dois cantos de baixo estão
           ocupados. O meio do topbar é o único vão livre em toda tela. */
        position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 99999,
        display: "flex", alignItems: "center", gap: 10,
        padding: "7px 10px 7px 12px", borderRadius: 999,
        background: "rgba(20,14,6,0.92)", border: "1px solid rgba(232,201,109,0.55)",
        boxShadow: "0 10px 30px -12px rgba(0,0,0,0.9)",
        fontFamily: "'Cinzel',serif", fontSize: 9.5, letterSpacing: "0.16em",
        textTransform: "uppercase", color: "#e8c96d",
        backdropFilter: "blur(6px)",
      }}
    >
      <span aria-hidden="true" style={{
        width: 7, height: 7, borderRadius: "50%", background: "#e8c96d",
        boxShadow: "0 0 8px #e8c96d",
      }} />
      <span>Modo demo · dados fictícios</span>
      <button
        type="button"
        onClick={sairDoDemo}
        title="Sair do modo demo e limpar os dados semeados"
        style={{
          background: "none", border: "1px solid rgba(232,201,109,0.4)",
          borderRadius: 999, color: "#e8c96d", cursor: "pointer",
          fontFamily: "'Cinzel',serif", fontSize: 9, letterSpacing: "0.14em",
          textTransform: "uppercase", padding: "3px 9px",
        }}
      >
        Sair
      </button>
    </div>
  );
}
