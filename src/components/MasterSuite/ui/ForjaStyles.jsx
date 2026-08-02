/* ════════════════════════════════════════════════════════════════════
 *  FORJA DO MESTRE — O ÚNICO CSS DA SUÍTE  (spec 0027 · AC-8)
 *  --------------------------------------------------------------------
 *  Mesmo padrão de `ordemStyles.jsx` / `DnDSheetStyles.jsx`: um bloco
 *  <style> montado UMA vez na raiz da Forja. Aqui mora só o que inline
 *  style não faz — grades, @media, :hover, :focus-visible, ::after e
 *  keyframes. Tokens, tipografia e espaçamento continuam 100% inline.
 *
 *  Regra da spec 0017 (AC-1): só `transform` e `opacity` animam. Glow é
 *  pseudo-elemento com opacity, nunca `box-shadow` animado.
 * ════════════════════════════════════════════════════════════════════ */

export function ForjaStyles() {
  return (
    <style>{`
  /* ── GRADES ──────────────────────────────────────────────────────── */
  .forja-grid-cards    { display:grid; grid-template-columns:repeat(auto-fill,minmax(248px,1fr)); gap:14px; }
  .forja-grid-types    { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  .forja-grid-tools    { display:grid; grid-template-columns:repeat(auto-fit,minmax(104px,1fr)); gap:8px; }
  .forja-split         { display:grid; grid-template-columns:1fr 320px; gap:24px; align-items:start; }
  .forja-wiki-body     { display:grid; grid-template-columns:176px 1fr; gap:20px; align-items:start; }

  /* Painel do mundo: a coluna larga é a que tem CONTEÚDO (recentes), não a
   * que tem checklist. 1fr/320px dava 810px para uma linha de 40px. */
  .forja-dash          { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);
                         gap:20px; align-items:start; }

  /* ── LEDGER DE TIPOS (painel do mundo) ───────────────────────────── */
  /* O gap de 1px sobre o fundo-filete DESENHA as réguas do livro-razão —
   * nenhuma borda por célula, nenhum glow, nenhum card flutuando. */
  .forja-ledger { display:grid; grid-template-columns:repeat(auto-fill,minmax(208px,1fr));
                  gap:1px; background:rgba(255,255,255,0.055);
                  border:1px solid rgba(255,255,255,0.08); border-radius:12px; overflow:hidden; }
  .forja-ledger > button,
  .forja-ledger > div { background:var(--surface); }
  .forja-ledger > button { transition:background .14s ease; }
  .forja-ledger > button:hover { background:var(--card); }

  /* ── BANDA DE DOSSIÊ ─────────────────────────────────────────────── */
  /* Come o padding do viewport para virar faixa de ponta a ponta: card
   * arredondado flutuante lê como SaaS; banda full-bleed lê como ficha. */
  .forja-band { margin:-24px -32px 20px; padding:18px 32px 16px;
                background:linear-gradient(180deg,rgba(201,168,76,0.055),transparent 62%),var(--surface);
                border-bottom:1px solid rgba(255,255,255,0.08); }
  .forja-band::after { content:""; display:block; height:2px; width:48px; margin-top:12px;
                       background:linear-gradient(90deg,var(--accent),transparent); }

  /* ── LINHA DA LISTA ──────────────────────────────────────────────── */
  .forja-row { display:grid; grid-template-columns:36px 1fr 120px minmax(0,180px) 84px;
               align-items:center; gap:12px; }

  /* ── HOVER / FOCO ────────────────────────────────────────────────── */
  .forja-card { position:relative; transition:transform .18s cubic-bezier(.65,0,.35,1),
                border-color .18s ease; -webkit-tap-highlight-color:transparent; }
  .forja-card::after { content:""; position:absolute; inset:-1px; border-radius:inherit;
      pointer-events:none; opacity:0; transition:opacity .22s ease;
      box-shadow:0 8px 24px rgba(0,0,0,.45), 0 0 22px var(--forja-glow,transparent); }
  .forja-card:hover { transform:translateY(-2px); border-color:var(--forja-edge,var(--border2)) !important; }
  .forja-card:hover::after,
  .forja-card:focus-visible::after { opacity:1; }
  .forja-card:active { transform:translateY(0); }
  .forja-card[aria-disabled="true"]:hover { transform:none; }
  .forja-card[aria-disabled="true"]:hover::after { opacity:0; }

  .forja-card:focus-visible,
  .forja-focus:focus-visible { outline:2px solid var(--accent2); outline-offset:2px; }

  .forja-row-item { transition:background .15s ease; }
  .forja-row-item:hover { background:var(--card2); }

  /* seta do card de atalho desliza no hover (M12) */
  .forja-arrow { transition:transform .18s cubic-bezier(.65,0,.35,1); }
  .forja-card:hover .forja-arrow { transform:translateX(3px); }

  /* ── RAIL DE FERRAMENTAS (scroll-x sem barra) ────────────────────── */
  .forja-rail { display:flex; gap:2px; overflow-x:auto; scrollbar-width:none;
                scroll-snap-type:x proximity; position:relative; }
  .forja-rail::-webkit-scrollbar { display:none; }
  .forja-rail > button { scroll-snap-align:center; flex-shrink:0; }

  /* ── CHIPS DE FILTRO ─────────────────────────────────────────────── */
  .forja-chips { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; }
  .forja-chips::-webkit-scrollbar { display:none; }

  /* Afordância: rolar sem barra é honesto só se a borda avisar que continua.
   * A máscara desbota os últimos 24px — quem vê texto apagando sabe arrastar. */
  .forja-rail, .forja-chips {
    -webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 24px),transparent 100%);
            mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 24px),transparent 100%);
  }

  /* ── CORPO ROLÁVEL DO MODAL ──────────────────────────────────────── */
  /* Sem isto o conteúdo aparecia FATIADO ao meio sob o header, sem sombra,
   * sem fade e sem divisória — lê como render quebrado, não como scroll. */
  .forja-modal-body {
    overscroll-behavior:contain;
    -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%);
            mask-image:linear-gradient(180deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%);
  }

  /* ── DROPDOWN ────────────────────────────────────────────────────── */
  .forja-menu-item { transition:background .15s ease, color .15s ease; }
  .forja-menu-item:hover { background:var(--gold-dim); }

  /* ── ENTRADA DO MODAL ────────────────────────────────────────────── */
  @keyframes forja-modal-in { from{opacity:0;transform:scale(.97) translateY(8px)}
                              to  {opacity:1;transform:scale(1) translateY(0)} }
  @keyframes forja-overlay-in { from{opacity:0} to{opacity:1} }
  .forja-modal   { animation:forja-modal-in 220ms cubic-bezier(.16,1,.3,1) both; }
  .forja-overlay { animation:forja-overlay-in 160ms ease both; }

  /* ── CONTADOR SOBE AO ENTRAR ─────────────────────────────────────── */
  @keyframes forja-num-rise { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
  .forja-num { animation:forja-num-rise 380ms cubic-bezier(.16,1,.3,1) both;
               animation-delay:calc(var(--i,0) * 40ms); }

  /* ── RESPONSIVO ──────────────────────────────────────────────────── */
  @media(max-width:1023px){
    .forja-split      { grid-template-columns:1fr; gap:20px; }
    .forja-dash       { grid-template-columns:1fr; gap:16px; }
    .forja-wiki-body  { grid-template-columns:1fr; gap:14px; }
  }
  @media(max-width:767px){
    .forja-band       { margin:-16px -12px 14px; padding:14px 12px 12px; }
    .forja-grid-cards { grid-template-columns:1fr; gap:10px; }
    .forja-grid-types { grid-template-columns:repeat(3,1fr); }
    .forja-row        { grid-template-columns:36px 1fr auto; grid-template-areas:"i n t" "i m m";
                        row-gap:2px; }
    .forja-row > .r-icon{ grid-area:i } .forja-row > .r-name{ grid-area:n }
    .forja-row > .r-time{ grid-area:t } .forja-row > .r-meta{ grid-area:m }
    .forja-row > .r-type{ display:none }
    .forja-modal      { width:100% !important; max-width:100% !important;
                        height:100dvh; max-height:100dvh; border-radius:0 !important; }
    @keyframes forja-modal-in { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
  }
  @media(max-width:479px){
    .forja-grid-types { grid-template-columns:repeat(2,1fr); }
  }

  /* ── MOVIMENTO REDUZIDO ──────────────────────────────────────────── */
  @media(prefers-reduced-motion:reduce){
    .forja-card:hover { transform:none; }
    .forja-card:hover .forja-arrow { transform:none; }
    .forja-num { opacity:1 !important; transform:none !important; animation:none !important; }
  }
    `}</style>
  );
}

export default ForjaStyles;
