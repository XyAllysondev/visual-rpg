/* ════════════════════════════════════════════════════════════════════
 *  A MESA — O ÚNICO CSS DO MÓDULO  (spec 0028 · F4 · AC-11)
 *  --------------------------------------------------------------------
 *  Mesmo padrão de `EditorStyles.jsx`: um <style> montado uma vez na raiz
 *  da mesa, contendo só o que inline style não faz — :hover,
 *  :focus-visible, @media e keyframes. Tokens, tipografia e espaçamento
 *  continuam 100% inline (ADR-0004).
 *
 *  A DIFERENÇA EM RELAÇÃO AO ATELIÊ: aqui o mapa RESPIRA. No ateliê o
 *  mestre está trabalhando e nada se mexe sozinho (design §5.4); na mesa
 *  o grupo está jogando, e os movimentos são parte da mecânica:
 *
 *   · o marcador do grupo flutua parado (movimento 4);
 *   · o nó `rumored` respira com "?" no lugar do ícone (movimento 3);
 *   · o que acabou de ser revelado entra com fade e escala (movimento 2 —
 *     "o momento de recompensa da mecânica inteira").
 *
 *  Tudo em `transform`/`opacity`, tudo desligado por
 *  `prefers-reduced-motion` (AC-11), e a revelação vira corte seco.
 * ════════════════════════════════════════════════════════════════════ */

export function MesaStyles() {
  return (
    <style>{`
  /* ── PALCO ────────────────────────────────────────────────────────── */
  .wmm-palco { position:relative; overflow:hidden; touch-action:none;
               -webkit-tap-highlight-color:transparent; user-select:none; }
  .wmm-palco[data-viajando="sim"] { cursor:progress; }

  /* A câmera é UM transform por camada (mesma conta de useMapCamera). */
  .wmm-camada { position:absolute; top:0; left:0; transform-origin:0 0;
                pointer-events:none; will-change:transform; }
  .wmm-camada > * { pointer-events:auto; }
  .wmm-tela { position:absolute; inset:0; pointer-events:none; }
  .wmm-ancora { position:absolute; transform-origin:50% 50%; }

  /* ── NÓ ───────────────────────────────────────────────────────────── */
  .wmm-no { display:flex; align-items:center; justify-content:center;
            padding:0; background:none; border:none; cursor:pointer;
            transition:transform .16s cubic-bezier(.65,0,.35,1); }
  .wmm-no:hover  { transform:scale(1.12); }
  .wmm-no:active { transform:scale(1.02); }
  .wmm-no:focus-visible { outline:2px solid var(--gold2,var(--gold)); outline-offset:3px; border-radius:50%; }
  /* Sem caminho conhecido daqui: continua focável e anunciável (o leitor de
     tela diz "indisponível"), mas não convida ao clique — AC-8. */
  .wmm-no[aria-disabled="true"] { cursor:default; opacity:.62; }
  .wmm-no[aria-disabled="true"]:hover { transform:none; }

  .wmm-rotulo { pointer-events:none; white-space:nowrap;
                text-shadow:0 1px 3px rgba(0,0,0,.92), 0 0 8px rgba(0,0,0,.75); }

  /* ── REVELAÇÃO (design §5.4, movimento 2 · ~600 ms ease-out) ──────── */
  @keyframes wmm-revelar { from{opacity:0;transform:scale(.72)} to{opacity:1;transform:scale(1)} }
  .wmm-no[data-novo="sim"] { animation:wmm-revelar 600ms cubic-bezier(.16,1,.3,1) both; }

  /* ── NÓ "RUMOR" (movimento 3 · respiro de ~3 s) ───────────────────── */
  @keyframes wmm-respiro { 0%,100%{opacity:.55;transform:scale(.94)} 50%{opacity:1;transform:scale(1.06)} }
  .wmm-rumor { animation:wmm-respiro 3s ease-in-out infinite; }

  /* ── MARCADOR DO GRUPO (movimento 4 · flutua parado) ──────────────── */
  @keyframes wmm-flutuar { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
  .wmm-marcador { animation:wmm-flutuar 2.8s ease-in-out infinite; }
  /* Viajando ele não flutua: já está se movendo, e somar os dois embrulha o olho. */
  .wmm-marcador[data-viajando="sim"] { animation:none; }
  .wmm-marcador:focus-visible { outline:2px solid var(--gold2,var(--gold)); outline-offset:3px; border-radius:50%; }

  /* ── DESTINO ALCANÇÁVEL ───────────────────────────────────────────── */
  @keyframes wmm-convite { 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:.75;transform:scale(1.18)} }
  .wmm-convite { animation:wmm-convite 2.4s ease-in-out infinite; }

  /* ── BOTÕES E LISTAS DO CONSOLE ──────────────────────────────────── */
  .wmm-acao { transition:background .15s ease, color .15s ease, border-color .15s ease; }
  .wmm-acao:hover:not(:disabled) { background:rgba(255,255,255,.08); color:var(--text); }
  .wmm-acao:focus-visible { outline:2px solid var(--gold2,var(--gold)); outline-offset:2px; }
  .wmm-acao:disabled { opacity:.45; cursor:not-allowed; }
  .wmm-focus:focus-visible { outline:2px solid var(--gold2,var(--gold)); outline-offset:2px; }

  .wmm-painel { animation:wmm-painel-in 200ms cubic-bezier(.16,1,.3,1) both; }
  @keyframes wmm-painel-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

  /* ── RESPONSIVO ──────────────────────────────────────────────────── */
  @media(max-width:899px){
    .wmm-layout { grid-template-columns:1fr !important; }
    .wmm-painel { animation:none; }
  }

  /* ── MOVIMENTO REDUZIDO (AC-11) ──────────────────────────────────── */
  @media(prefers-reduced-motion:reduce){
    .wmm-no, .wmm-no:hover, .wmm-no:active { transition:none; transform:none; }
    /* A revelação vira CORTE SECO: o elemento aparece, sem percurso de opacidade. */
    .wmm-no[data-novo="sim"] { animation:none; }
    .wmm-rumor, .wmm-marcador, .wmm-convite { animation:none; }
    .wmm-painel { animation:none; }
  }
    `}</style>
  );
}

export default MesaStyles;
