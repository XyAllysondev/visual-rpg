/* ════════════════════════════════════════════════════════════════════
 *  O CSS DA NÉVOA — E DA DERIVA  (spec 0028 · F3/F7 · AC-5, AC-11)
 *  --------------------------------------------------------------------
 *  Uma string, não um componente: `EditorStyles.jsx` e `MesaStyles.jsx` a
 *  interpolam nas suas próprias folhas.
 *
 *  ── POR QUE ELA SAIU DE `EditorStyles.jsx` (F7) ─────────────────────
 *  A névoa é do ateliê **e** da mesa — `Mesa/TelaDaMesa.jsx` reusa o mesmo
 *  `CamadaDeNevoa`. Mas o `<style>` do editor só é montado pelo editor, e a
 *  mesa monta o dela. Resultado até a F7: na mesa, `.wmf-deriva` chegava ao
 *  DOM sem uma linha de estilo — sem posição, sem textura e sem animação.
 *  O movimento 1 do design §5.4 simplesmente não existia onde ele mais
 *  importa, que é a mesa em que o grupo está jogando.
 *
 *  Duplicar as regras nas duas folhas resolveria e apodreceria: são duas
 *  cópias de um efeito que precisa continuar idêntico nos dois lugares.
 *  Uma string compartilhada é a resposta — o componente é um, o estilo é um.
 *
 *  Gate: `__tests__/fog-render.test.js` §6 (o ateliê) e
 *  `__tests__/f7-anim-tela.test.js` (a mesa).
 * ════════════════════════════════════════════════════════════════════ */

/** Ciclo da deriva, em segundos (design §5.4, movimento 1). */
export const CICLO_DA_DERIVA = 40;

export const CSS_DA_NEVOA = `
  /* ── NÉVOA (F3 · AC-5 e AC-11) ───────────────────────────────────── */
  /* A camada não recebe evento: quem clica num lugar coberto é o mestre, e
     ele precisa conseguir — o segredo é estrutural, não uma cortina por cima
     (ver o cabeçalho de CamadaDeNevoa.jsx). */
  .wmf-nevoa { position:absolute; inset:0; pointer-events:none; overflow:hidden; }

  /* A DERIVA (design §5.4, movimento 1). Só transform — composto na GPU, sem
     uma linha de JavaScript por quadro. O tamanho de cada camada divide o
     deslocamento (520 = 2x260 = 4x130), então o ciclo fecha sem emenda.
     O soft-light com tons claros levanta fiapos de luz sobre o grafite da
     névoa e é quase identidade sobre a ilustração já revelada. */
  .wmf-deriva {
    position:absolute; inset:-640px; pointer-events:none;
    opacity:.42; mix-blend-mode:soft-light; will-change:transform;
    background-repeat:repeat;
    background-size:520px 520px, 260px 260px, 130px 130px;
    background-image:
      radial-gradient(closest-side at 30% 38%, rgba(196,212,246,.55), rgba(196,212,246,0)),
      radial-gradient(closest-side at 70% 24%, rgba(148,168,214,.40), rgba(148,168,214,0)),
      radial-gradient(closest-side at 45% 78%, rgba(112,134,186,.30), rgba(112,134,186,0));
    animation-name:wmf-deriva;
    animation-timing-function:linear;
    animation-iteration-count:infinite;
  }
  @keyframes wmf-deriva {
    from { transform:translate3d(0,0,0); }
    to   { transform:translate3d(-520px,520px,0); }
  }

  /* O palco parado para a deriva junto com os outros quatro movimentos:
     fora do viewport, com movimento reduzido, ou com o mapa pedido parado
     (ver o portao em Editor/animacao.js). O componente ja desmonta o
     elemento nesses casos; a regra e o cinto de seguranca. */
  [data-anima="nao"] .wmf-deriva { animation:none; }

  /* ── MOVIMENTO REDUZIDO (AC-11) ──────────────────────────────────── */
  /* Quem pediu menos movimento nao recebe a deriva. O componente ja nao monta
     o elemento (matchMedia), e o CSS e o cinto de seguranca para o caso de a
     preferencia mudar com a tela aberta. */
  @media(prefers-reduced-motion:reduce){
    .wmf-deriva { animation:none; display:none; }
  }
`;

export default CSS_DA_NEVOA;
