/* ════════════════════════════════════════════════════════════════════
 *  O RODAPÉ  (spec 0036 · AC-1, AC-2)
 *  --------------------------------------------------------------------
 *  Os três itens da direita — Suporte, Discord, Changelog — eram `<span>`
 *  com `cursor:pointer` e hover dourado, **sem `href` e sem `onClick`**.
 *  Tinham cara de botão, respondiam ao mouse e não faziam nada, em TODAS
 *  as telas internas do app.
 *
 *  Botão que não responde é o sinal mais rápido de produto abandonado.
 *  Agora cada um tem destino real:
 *
 *   · Suporte   → `mailto:` (o endereço vive em `lib/links.js`);
 *   · Discord   → o convite do servidor, do mesmo lugar único;
 *   · Changelog → o Roadmap, que já É a página de "o que mudou". Este é
 *     navegação INTERNA, então é `<button>` com `onClick`, não `<a>`: um
 *     `href="/roadmap"` recarregaria o app inteiro para trocar de aba.
 *
 *  Os dois primeiros são `<a>` de verdade, com `rel="noopener noreferrer"`.
 *  Semanticamente importa: leitor de tela, e "abrir em nova aba" com o botão
 *  do meio, só funcionam em elemento que É link.
 * ══════════════════════════════════════════════════════════════════ */

import NexusLogo from "../lib/NexusLogo";
import LicencaOP from "../components/LicencaOP";
import FooterDivider from "./FooterDivider";
import { ALVO_EXTERNO, DISCORD_URL, MAILTO_SUPORTE } from "../lib/links";

/* Um estilo só para os três, seja `<a>` ou `<button>` — o hover não pode
   denunciar qual é qual. `appearance:none` zera o cromo nativo do botão. */
const ITEM = {
  appearance: "none", background: "none", border: "1px solid transparent",
  fontFamily: "var(--font-body,'Inter'),sans-serif", fontSize: 11, fontWeight: 500,
  letterSpacing: "0.07em", color: "var(--muted2)", textDecoration: "none",
  cursor: "pointer", textTransform: "uppercase", whiteSpace: "nowrap",
  display: "flex", alignItems: "center", gap: 7,
  padding: "7px 12px", borderRadius: 6,
  transition: "color .18s ease, border-color .18s ease, background .18s ease",
};

const acender = (e) => {
  e.currentTarget.style.color = "var(--gold)";
  e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)";
  e.currentTarget.style.background = "rgba(201,168,76,0.08)";
};
const apagar = (e) => {
  e.currentTarget.style.color = "var(--muted2)";
  e.currentTarget.style.borderColor = "transparent";
  e.currentTarget.style.background = "none";
};

/**
 * @param {object} props
 * @param {object} [props.system] o sistema ativo — decide se a licença de OP aparece.
 * @param {()=>void} [props.onIrParaRoadmap] navegação interna do "Changelog". Sem ela
 *   o item não é renderizado: melhor um item a menos do que um botão morto (AC-1).
 */
const AppFooter = ({ system, onIrParaRoadmap }) => (
  <div className="nexus-footer" style={{
    borderTop:"1px solid var(--border2)", padding:"12px 24px",
    display:"flex", alignItems:"center", columnGap:18, rowGap:10, flexWrap:"wrap",
    background:"rgba(6,6,6,0.72)",
  }}>
    <div style={{display:"flex", gap:10, alignItems:"center", flexShrink:0}}>
      <NexusLogo size={18}/>
      <span style={{
        fontFamily:"var(--font-title,'Cinzel'),serif", fontSize:11, fontWeight:600,
        letterSpacing:"0.14em", color:"var(--muted2)", textTransform:"uppercase",
        whiteSpace:"nowrap",
      }}>Nexus RPG · v0.1 Beta</span>
    </div>
    {system?.id === "op" && (
      <>
        <FooterDivider/>
        <LicencaOP variant="footer" style={{ flex:"1 1 300px", minWidth:0 }}/>
      </>
    )}
    <div style={{marginLeft:"auto", display:"flex", gap:2, alignItems:"center", flexShrink:0}}>
      {[
        {label:"Suporte", href:MAILTO_SUPORTE, icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>},
        {label:"Discord", href:DISCORD_URL, icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.045.03.06a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>},
        {label:"Changelog", onClick:onIrParaRoadmap, icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>},
      ].map(({label,icon,href,onClick})=>{
        /* Item sem destino não é renderizado. É a regra da spec: apagar a
           promessa é melhor do que fingi-la. */
        if (!href && !onClick) return null;
        const comum = {
          key: label, style: ITEM, title: label,
          "data-rodape": label.toLowerCase(),
          onMouseEnter: acender, onMouseLeave: apagar,
        };
        return href
          ? <a {...comum} href={href} {...ALVO_EXTERNO}>{icon}{label}</a>
          : <button {...comum} type="button" onClick={onClick}>{icon}{label}</button>;
      })}
    </div>
  </div>
);

export default AppFooter;
