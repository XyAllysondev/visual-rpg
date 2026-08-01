/* ════════════════════════════════════════════════════════════════════
 *  EDITOR DO GRAFO — O ÚNICO CSS DO MÓDULO  (spec 0028 · F2 · AC-4)
 *  --------------------------------------------------------------------
 *  Mesmo padrão de `AtelierStyles.jsx`: um <style> montado uma vez na raiz
 *  do editor. Aqui mora só o que inline style não faz — :hover,
 *  :focus-visible, @media e keyframes. Tokens, tipografia e espaçamento
 *  continuam 100% inline (ADR-0004).
 *
 *  ── COMO A CÂMERA CHEGA NO DOM ──────────────────────────────────────
 *  Os nós NÃO são reposicionados um a um quando o mestre arrasta o mapa.
 *  Eles moram numa CAMADA (`.wme-camada`) posicionada em coordenadas de
 *  MUNDO, e a câmera é um único `transform` nessa camada. Arrastar o mapa
 *  custa uma escrita de estilo, não N.
 *
 *  Cada nó fica dentro de uma ÂNCORA (`.wme-ancora`) que aplica a
 *  contra-escala `1/scale`: o ícone tem o mesmo tamanho em qualquer zoom, e
 *  o alvo de toque nunca encolhe abaixo dos 44px do AC de acessibilidade.
 *  Por isso o `transform` de hover mora no BOTÃO, não na âncora — os dois
 *  transforms não brigam.
 *
 *  MOVIMENTO (design §5.4 + AC-11): no ateliê o mapa fica PARADO, porque o
 *  mestre está trabalhando. O que existe aqui é resposta a gesto — o realce
 *  do nó sob o cursor e o pulso do lugar recém-plantado. Nada respira
 *  sozinho, e tudo some com `prefers-reduced-motion`.
 * ════════════════════════════════════════════════════════════════════ */

export function EditorStyles() {
  return (
    <style>{`
  /* ── PALCO ────────────────────────────────────────────────────────── */
  .wme-palco { position:relative; overflow:hidden; touch-action:none;
               -webkit-tap-highlight-color:transparent; user-select:none; }
  .wme-palco[data-ferramenta="mao"]        { cursor:grab; }
  .wme-palco[data-ferramenta="mao"]:active { cursor:grabbing; }
  .wme-palco[data-ferramenta="no"],
  .wme-palco[data-ferramenta="trilha"]     { cursor:crosshair; }

  /* ── CAMADAS ──────────────────────────────────────────────────────── */
  /* A câmera é UM transform por camada. O transform-origin em 0 0 faz
     translate(pan) scale(s) casar exatamente com a conta de useMapCamera. */
  .wme-camada { position:absolute; top:0; left:0; transform-origin:0 0;
                pointer-events:none; will-change:transform; }
  .wme-camada > * { pointer-events:auto; }
  .wme-tela { position:absolute; inset:0; pointer-events:none; }

  /* ── NÓ (DOM — foco, teclado e rótulo; design §5.3) ───────────────── */
  .wme-ancora { position:absolute; transform-origin:50% 50%; }
  .wme-no { display:flex; align-items:center; justify-content:center;
            padding:0; background:none; border:none; cursor:pointer;
            transition:transform .16s cubic-bezier(.65,0,.35,1); }
  .wme-no:hover  { transform:scale(1.14); }
  .wme-no:active { transform:scale(1.02); }
  .wme-no:focus-visible { outline:2px solid var(--gold2,var(--gold)); outline-offset:3px; border-radius:50%; }
  .wme-ancora[data-arrastando="sim"] .wme-no { cursor:grabbing; transition:none; }

  /* O rótulo só aparece com zoom suficiente (decidido no inline style);
     aqui ele só ganha legibilidade sobre qualquer ilustração de fundo. */
  .wme-rotulo { pointer-events:none; white-space:nowrap;
                text-shadow:0 1px 3px rgba(0,0,0,.92), 0 0 8px rgba(0,0,0,.75); }

  /* ── PUNHO DA CURVA ──────────────────────────────────────────────── */
  .wme-punho { cursor:grab; padding:0; background:none; border:none; }
  .wme-punho:active        { cursor:grabbing; }
  .wme-punho:focus-visible { outline:2px solid var(--gold2,var(--gold)); outline-offset:3px; border-radius:50%; }

  /* ── BARRA DE FERRAMENTAS ────────────────────────────────────────── */
  .wme-ferramenta { transition:background .15s ease, color .15s ease, border-color .15s ease; }
  .wme-ferramenta:hover         { background:rgba(255,255,255,.08); color:var(--text); }
  .wme-ferramenta:focus-visible { outline:2px solid var(--gold2,var(--gold)); outline-offset:2px; }

  /* ── PAINEL LATERAL ──────────────────────────────────────────────── */
  .wme-painel { animation:wme-painel-in 200ms cubic-bezier(.16,1,.3,1) both; }
  @keyframes wme-painel-in { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:none} }

  /* ── PULSO DO LUGAR RECÉM-PLANTADO ───────────────────────────────── */
  @keyframes wme-plantado { 0%{transform:scale(.4);opacity:0}
                            60%{transform:scale(1.16);opacity:1}
                            100%{transform:scale(1);opacity:1} }
  .wme-no[data-novo="sim"] { animation:wme-plantado 340ms cubic-bezier(.16,1,.3,1) both; }

  /* ── SELO DE SEGREDO ─────────────────────────────────────────────── */
  /* O que é secreto tem de saltar aos olhos: é a informação que a F4 vai
     proteger, e o mestre precisa enxergar de relance quem sabe o quê. */
  .wme-segredo::after { content:""; position:absolute; inset:-5px; border-radius:50%;
                        border:1px dashed #8a7ad6; opacity:.9; pointer-events:none; }

  /* ── FOCO GERAL DO MÓDULO ────────────────────────────────────────── */
  .wme-focus:focus-visible { outline:2px solid var(--gold2,var(--gold)); outline-offset:2px; }

  /* ── RESPONSIVO ──────────────────────────────────────────────────── */
  @media(max-width:899px){
    .wme-layout { grid-template-columns:1fr !important; }
    .wme-painel { animation:none; }
  }

  /* ── MOVIMENTO REDUZIDO (AC-11) ──────────────────────────────────── */
  @media(prefers-reduced-motion:reduce){
    .wme-no, .wme-no:hover, .wme-no:active { transition:none; transform:none; }
    .wme-no[data-novo="sim"] { animation:none; }
    .wme-painel { animation:none; }
  }
    `}</style>
  );
}

export default EditorStyles;
