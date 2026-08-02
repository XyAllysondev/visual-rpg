/* ════════════════════════════════════════════════════════════════════
 *  ATELIÊ DO MESTRE — O ÚNICO CSS DO MÓDULO  (spec 0028 · F1)
 *  --------------------------------------------------------------------
 *  Mesmo padrão de `ordemStyles.jsx` e `ForjaStyles.jsx`: um <style>
 *  montado uma vez na raiz. Aqui mora só o que inline style não faz —
 *  grade, @media, :hover, :focus-visible e keyframes. Tokens, tipografia
 *  e espaçamento continuam 100% inline.
 *
 *  Regra da spec 0017 (AC-1): só `transform` e `opacity` animam.
 * ════════════════════════════════════════════════════════════════════ */

export function AtelierStyles() {
  return (
    <style>{`
  /* ── GRADE DE MOLDES ─────────────────────────────────────────────── */
  .wm-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(248px,1fr)); gap:14px; }

  /* ── CARD DO MOLDE ───────────────────────────────────────────────── */
  .wm-card { position:relative; transition:transform .18s cubic-bezier(.65,0,.35,1), border-color .18s ease;
             -webkit-tap-highlight-color:transparent; }
  .wm-card::after { content:""; position:absolute; inset:-1px; border-radius:inherit; pointer-events:none;
                    opacity:0; transition:opacity .22s ease;
                    box-shadow:0 8px 24px rgba(0,0,0,.45), 0 0 22px var(--gold-glow); }
  .wm-card:hover { transform:translateY(-2px); border-color:var(--border2) !important; }
  .wm-card:hover::after, .wm-card:focus-within::after { opacity:1; }
  .wm-card:active { transform:translateY(0); }

  /* ── FOCO VISÍVEL ────────────────────────────────────────────────── */
  .wm-focus:focus-visible { outline:2px solid var(--gold2,var(--gold)); outline-offset:2px; }

  /* ── AÇÕES DO CARD ───────────────────────────────────────────────── */
  .wm-act { transition:background .15s ease, color .15s ease, border-color .15s ease; }
  .wm-act:hover { background:rgba(255,255,255,0.07); color:var(--text); }

  /* ── ZONA DE ENVIO DA ILUSTRAÇÃO ─────────────────────────────────── */
  .wm-drop { transition:border-color .18s ease, background .18s ease; }
  .wm-drop:hover, .wm-drop:focus-within { border-color:var(--border2); background:rgba(201,168,76,0.05); }

  /* ── ESQUELETO DE CARREGAMENTO ───────────────────────────────────── */
  @keyframes wm-pulse { 0%,100%{opacity:.45} 50%{opacity:.8} }
  .wm-skel { animation:wm-pulse 1.4s ease-in-out infinite; }

  /* ── ENTRADA DO MODAL ────────────────────────────────────────────── */
  @keyframes wm-modal-in   { from{opacity:0;transform:scale(.97) translateY(8px)} to{opacity:1;transform:none} }
  @keyframes wm-overlay-in { from{opacity:0} to{opacity:1} }
  .wm-modal   { animation:wm-modal-in 220ms cubic-bezier(.16,1,.3,1) both; }
  .wm-overlay { animation:wm-overlay-in 160ms ease both; }

  /* ── RESPONSIVO ──────────────────────────────────────────────────── */
  @media(max-width:767px){
    .wm-grid  { grid-template-columns:1fr; gap:10px; }
    .wm-modal { width:100% !important; max-width:100% !important;
                height:100dvh; max-height:100dvh; border-radius:0 !important; }
    @keyframes wm-modal-in { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
  }

  /* ── MOVIMENTO REDUZIDO ──────────────────────────────────────────── */
  @media(prefers-reduced-motion:reduce){
    .wm-card:hover { transform:none; }
    .wm-skel  { animation:none; opacity:.6; }
    .wm-modal, .wm-overlay { animation:none; }
  }
    `}</style>
  );
}

export default AtelierStyles;
