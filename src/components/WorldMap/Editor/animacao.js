/* ════════════════════════════════════════════════════════════════════
 *  O PORTÃO DO MOVIMENTO  (spec 0028 · F7 · AC-11 · design §5.4)
 *  --------------------------------------------------------------------
 *  Os cinco movimentos do mapa-múndi têm três interruptores em comum, e
 *  todos os três são exigência do AC-11:
 *
 *   1. **`prefers-reduced-motion`** — corta a deriva, o respiro e a tinta,
 *      e troca a revelação por corte seco;
 *   2. **fora do viewport** — nada anima o que ninguém está olhando;
 *   3. **o mestre trabalhando** — no ateliê o mapa fica parado (quem sabe
 *      disso é a tela, e passa como argumento).
 *
 *  Este módulo é o portão. Ele NÃO anima nada: devolve um booleano e um
 *  registrador de nó. Quem anima é o CSS, sempre em `transform`/`opacity`.
 *
 *  ── POR QUE O CSS TAMBÉM CORTA ─────────────────────────────────────
 *  O `matchMedia` daqui decide se o elemento chega a existir no DOM — é o
 *  corte forte, e o único que zera custo. Mas a preferência pode mudar com a
 *  tela aberta (o usuário liga "reduzir movimento" no sistema), e há um
 *  quadro entre o evento e o re-render. Por isso as folhas de estilo do
 *  módulo repetem o corte em `@media(prefers-reduced-motion:reduce)`: é
 *  cinto **e** suspensório, e nenhum dos dois é redundante.
 *
 *  Gate: `__tests__/f7-anim-tela.test.js` (+ `fog-render.test.js` §6).
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";

/** A consulta, escrita num lugar só — é fácil errar a grafia dela. */
export const CONSULTA_DE_MOVIMENTO = "(prefers-reduced-motion: reduce)";

/**
 * `prefers-reduced-motion: reduce` está ligado agora?
 *
 * O jsdom sem `matchMedia` responde "não" de propósito: teste de render não
 * pode virar teste de preferência de sistema.
 *
 * @returns {boolean}
 */
export function movimentoReduzido() {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return !!window.matchMedia(CONSULTA_DE_MOVIMENTO).matches;
  } catch {
    return false;
  }
}

/**
 * O mesmo booleano, mas REATIVO: quem liga "reduzir movimento" no sistema com
 * a mesa aberta vê o mapa parar sem precisar recarregar.
 *
 * Os dois dialetos de `MediaQueryList` são tratados — `addEventListener`
 * (moderno) e `addListener` (Safari antigo, e o dublê de vários testes deste
 * módulo). Nenhum dos dois é obrigatório: sem escuta, o valor inicial vale.
 *
 * @returns {boolean}
 */
export function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(movimentoReduzido);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    let mq = null;
    try { mq = window.matchMedia(CONSULTA_DE_MOVIMENTO); } catch { return undefined; }
    if (!mq) return undefined;

    const aoMudar = (e) => setReduzido(!!(e && "matches" in e ? e.matches : mq.matches));
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", aoMudar);
      return () => mq.removeEventListener("change", aoMudar);
    }
    if (typeof mq.addListener === "function") {
      mq.addListener(aoMudar);
      return () => mq.removeListener(aoMudar);
    }
    return undefined;
  }, []);

  return reduzido;
}

/**
 * O portão completo de um palco: registre o nó e receba se ele pode animar.
 *
 * `registrar` é um **callback ref** de propósito — o palco já usa um para
 * ligar a câmera, e assim os dois convivem sem um segundo `useEffect` que
 * dependeria da ordem de montagem.
 *
 * Sem `IntersectionObserver` (jsdom cru), o padrão é "está visível": um
 * ambiente que não sabe responder não pode ser motivo para o mapa nunca
 * respirar.
 *
 * @param {boolean} [ligada=true] o dono da tela ainda pode desligar tudo —
 *   é assim que o ateliê fica parado enquanto o mestre tem ferramenta na mão.
 * @returns {{registrar:(node:Element|null)=>void, ativo:boolean,
 *            reduzido:boolean, noViewport:boolean}}
 */
export function useAnimacaoAtiva(ligada = true) {
  const reduzido = useMovimentoReduzido();
  const [noViewport, setNoViewport] = useState(true);
  const observadorRef = useRef(null);

  const registrar = useCallback((node) => {
    if (observadorRef.current) {
      observadorRef.current.disconnect();
      observadorRef.current = null;
    }
    if (!node || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(
      (entradas) => { setNoViewport(entradas.some((e) => e.isIntersecting)); },
      { threshold: 0 },
    );
    io.observe(node);
    observadorRef.current = io;
  }, []);

  useEffect(() => () => {
    if (observadorRef.current) {
      observadorRef.current.disconnect();
      observadorRef.current = null;
    }
  }, []);

  return { registrar, ativo: !!ligada && !reduzido && noViewport, reduzido, noViewport };
}

export default useAnimacaoAtiva;
