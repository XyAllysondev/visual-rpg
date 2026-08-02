/* ════════════════════════════════════════════════════════════════════
 *  A MESA — O ÚNICO CSS DO MÓDULO  (spec 0028 · F4/F7 · AC-11)
 *  --------------------------------------------------------------------
 *  Mesmo padrão de `EditorStyles.jsx`: um <style> montado uma vez na raiz
 *  da mesa, contendo só o que inline style não faz — :hover,
 *  :focus-visible, @media e keyframes. Tokens, tipografia e espaçamento
 *  continuam 100% inline (ADR-0004).
 *
 *  A DIFERENÇA EM RELAÇÃO AO ATELIÊ: aqui o mapa RESPIRA. No ateliê o
 *  mestre está trabalhando e nada se mexe sozinho (design §5.4); na mesa
 *  o grupo está jogando, e os movimentos são parte da mecânica. Os cinco,
 *  na ordem do design §5.4:
 *
 *   1 · deriva da névoa ....... `Editor/nevoaStyles.js`, montado aqui também;
 *   2 · revelação ............. a névoa RECUA e o ícone NASCE (~600 ms ease-out);
 *   3 · nó `rumored` .......... brilho difuso respirando em ~3 s, com "?";
 *   4 · marcador do grupo ..... flutua parado, tomba na direção da viagem,
 *                               e deixa um rastro que desvanece;
 *   5 · tinta de hora do dia .. quatro camadas fixas, uma só em `opacity`.
 *
 *  ── UM INTERRUPTOR PARA OS CINCO ────────────────────────────────────
 *  `.wmm-palco[data-anima="nao"]` desliga TUDO de uma vez. O atributo vem de
 *  `useAnimacaoAtiva` (`Editor/animacao.js`), que junta os três motivos do
 *  AC-11: movimento reduzido, palco fora do viewport, e o dono da tela
 *  pedindo o mapa parado. Um seletor, cinco movimentos, nenhum esquecido.
 *
 *  O `@media(prefers-reduced-motion:reduce)` no fim REPETE o corte de
 *  propósito: se a preferência mudar com a mesa aberta, o CSS já parou o
 *  mapa no quadro seguinte, sem esperar o React re-renderizar.
 *
 *  Tudo em `transform`/`opacity` — nada de `left`, `top`, `width` ou
 *  `filter` em laço (design §5.4).
 * ════════════════════════════════════════════════════════════════════ */

import { CSS_DA_NEVOA } from "../Editor/nevoaStyles";

export function MesaStyles() {
  return (
    <style>{`
  /* ── MOVIMENTO 1 · A DERIVA DA NÉVOA ─────────────────────────────────
     A mesma névoa do ateliê (a mesa reusa 'Editor/CamadaDeNevoa'), e por
     isso o mesmo CSS. Até a F7 estas regras só viviam em 'EditorStyles.jsx',
     que a mesa nunca monta: '.wmf-deriva' chegava ao DOM sem posição, sem
     textura e sem animação, e o movimento 1 não existia justamente onde o
     grupo joga. Ver o cabeçalho de 'Editor/nevoaStyles.js'. */
  ${CSS_DA_NEVOA}

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

  /* A PLACA DO RÓTULO: a sombra sozinha só garante leitura sobre fundo
     escuro, e a ilustração do fundo é do usuário — pode ser um mapa claro.
     A placa é o piso: rgba(9,9,14,.72) sobre BRANCO PURO ainda devolve
     6,90:1 para o texto claro e 5,14:1 para o dourado do destino (AC-11:
     "a tinta não pode prejudicar a leitura"). Ela fica ACIMA da tinta —
     nenhum período a alcança. */
  .wmm-rotulo { pointer-events:none; white-space:nowrap;
                background:rgba(9,9,14,.72); padding:1px 6px; border-radius:5px;
                text-shadow:0 1px 3px rgba(0,0,0,.92), 0 0 8px rgba(0,0,0,.75); }

  /* ════════════════════════════════════════════════════════════════════
   *  MOVIMENTO 2 · A REVELAÇÃO  (~600 ms, ease-out)
   *  ------------------------------------------------------------------
   *  *"É o momento de recompensa da mecânica inteira — é aqui que vale
   *  gastar cuidado."* Três coisas acontecem no mesmo intervalo:
   *
   *   a) a NÉVOA RECUA — não some. Um disco da cor da névoa (o mesmo
   *      'COR_DA_NEVOA' do canvas) parte de cima do lugar e é EMPURRADO para
   *      fora, crescendo enquanto rareia. O olho lê "a névoa abriu ali",
   *      não "a névoa foi apagada";
   *   b) o ÍCONE NASCE — entra pequeno, ultrapassa um pouco o tamanho final
   *      e assenta. É o passo a mais em relação ao pulso simples da F4: um
   *      fade linear pisca, o overshoot dá peso ao que chegou;
   *   c) um HALO DOURADO se abre e se apaga, na cor do acento — o
   *      "achei!" que o ícone sozinho não diz.
   *
   *  Os três terminam juntos, e todos em 'transform'/'opacity'.
   * ════════════════════════════════════════════════════════════════════ */
  @keyframes wmm-revelar {
    0%   { opacity:0; transform:scale(.55); }
    38%  { opacity:1; transform:scale(1.14); }
    64%  { opacity:1; transform:scale(.965); }
    100% { opacity:1; transform:scale(1); }
  }
  .wmm-no[data-novo="sim"] { animation:wmm-revelar 600ms cubic-bezier(.22,1,.36,1) both; }

  /* A névoa recuando: cresce e rareia, com a borda mole do gradiente fazendo
     o papel do desfoque (que é caro e não compõe na GPU). */
  @keyframes wmm-recuo {
    0%   { opacity:.92; transform:scale(.55); }
    100% { opacity:0;   transform:scale(2.3); }
  }
  .wmm-recuo { animation:wmm-recuo 600ms cubic-bezier(.16,1,.3,1) both; }

  /* O halo de nascimento: abre depressa, apaga devagar. */
  @keyframes wmm-nascer {
    0%   { opacity:0;   transform:scale(.35); }
    22%  { opacity:.85; transform:scale(1.05); }
    100% { opacity:0;   transform:scale(2.05); }
  }
  .wmm-nascer { animation:wmm-nascer 600ms cubic-bezier(.16,1,.3,1) both; }

  /* ════════════════════════════════════════════════════════════════════
   *  MOVIMENTO 3 · O NÓ 'rumored' RESPIRANDO  (~3 s)
   *  ------------------------------------------------------------------
   *  *"brilho difuso com '?' que pulsa devagar"*. Quem pulsa é o BRILHO, não
   *  o "?": piscar a opacidade do glifo custaria legibilidade a cada ciclo,
   *  e o rumor já é a informação mais frágil do mapa. O disco fica opaco e
   *  parado; o halo em volta é que enche e esvazia o peito.
   * ════════════════════════════════════════════════════════════════════ */
  @keyframes wmm-respiro {
    0%,100% { opacity:.30; transform:scale(.86); }
    50%     { opacity:.78; transform:scale(1.16); }
  }
  .wmm-rumor-halo { animation:wmm-respiro 3s ease-in-out infinite; }
  /* Um segundo halo, mais lento e defasado: dois ciclos que não coincidem dão
     ao brilho a irregularidade de coisa viva, em vez de metrônomo. */
  .wmm-rumor-halo[data-eco="sim"] { animation-duration:4.6s; animation-delay:-1.4s; opacity:.5; }

  /* ── MOVIMENTO 4 · MARCADOR DO GRUPO ─────────────────────────────── */
  /* Dois elementos aninhados porque são dois 'transform' que não podem
     brigar: o TOMBO (direção) mora no invólucro e é transição; a FLUTUAÇÃO
     mora no disco e é keyframe. */
  .wmm-tombo { display:block; transform-origin:50% 85%;
               transition:transform 280ms cubic-bezier(.22,1,.36,1); }
  @keyframes wmm-flutuar { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
  .wmm-marcador { animation:wmm-flutuar 2.8s ease-in-out infinite; }
  /* Viajando ele não flutua: já está se movendo, e somar os dois embrulha o olho. */
  .wmm-marcador[data-viajando="sim"] { animation:none; }
  .wmm-marcador:focus-visible { outline:2px solid var(--gold2,var(--gold)); outline-offset:3px; border-radius:50%; }

  /* ── DESTINO ALCANÇÁVEL ───────────────────────────────────────────── */
  @keyframes wmm-convite { 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:.75;transform:scale(1.18)} }
  .wmm-convite { animation:wmm-convite 2.4s ease-in-out infinite; }

  /* ════════════════════════════════════════════════════════════════════
   *  MOVIMENTO 5 · A TINTA DE HORA DO DIA
   *  ------------------------------------------------------------------
   *  Quatro camadas fixas empilhadas; só 'opacity' se move, e devagar
   *  (1,4 s) — a passagem de tarde para noite não pode ter degrau. Ver
   *  'TintaDoDia.jsx' para por que não é uma camada mudando de cor.
   * ════════════════════════════════════════════════════════════════════ */
  .wmm-tinta { position:absolute; inset:0; pointer-events:none; overflow:hidden;
               border-radius:inherit; }
  .wmm-tinta-camada { position:absolute; inset:0; display:block; pointer-events:none;
                      transition:opacity 1400ms cubic-bezier(.4,0,.2,1); }

  /* ════════════════════════════════════════════════════════════════════
   *  O INTERRUPTOR DOS CINCO  (AC-11)
   *  ------------------------------------------------------------------
   *  Fora do viewport, ou com movimento reduzido, ou com o mapa pedido
   *  parado: 'data-anima="nao"' e nada respira. A tinta CONTINUA na cor
   *  certa — cor não é movimento —, só perde a travessia; quem a corta de
   *  vez é o 'prefers-reduced-motion', logo abaixo, como o AC manda.
   * ════════════════════════════════════════════════════════════════════ */
  .wmm-palco[data-anima="nao"] .wmm-rumor-halo,
  .wmm-palco[data-anima="nao"] .wmm-marcador,
  .wmm-palco[data-anima="nao"] .wmm-convite,
  .wmm-palco[data-anima="nao"] .wmm-recuo,
  .wmm-palco[data-anima="nao"] .wmm-nascer,
  .wmm-palco[data-anima="nao"] .wmm-no[data-novo="sim"] { animation:none; }
  .wmm-palco[data-anima="nao"] .wmm-tombo,
  .wmm-palco[data-anima="nao"] .wmm-tinta-camada { transition:none; }

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
  /* O React já não monta a tinta, o recuo nem os halos para quem pediu menos
     movimento ('useAnimacaoAtiva'). Este bloco é o cinto de segurança para o
     caso de a preferência mudar com a mesa aberta — e para o 'display:none'
     da tinta, que o AC-11 manda CORTAR, não apenas parar. */
  @media(prefers-reduced-motion:reduce){
    .wmm-no, .wmm-no:hover, .wmm-no:active { transition:none; transform:none; }
    /* A revelação vira CORTE SECO: o elemento aparece, sem percurso de opacidade. */
    .wmm-no[data-novo="sim"] { animation:none; }
    .wmm-rumor-halo, .wmm-marcador, .wmm-convite,
    .wmm-recuo, .wmm-nascer { animation:none; }
    .wmm-recuo, .wmm-nascer { display:none; }
    .wmm-tombo { transition:none; transform:none !important; }
    /* AC-11: 'prefers-reduced-motion' corta a deriva, o respiro E A TINTA. */
    .wmm-tinta { display:none; }
    .wmm-painel { animation:none; }
  }
    `}</style>
  );
}

export default MesaStyles;
