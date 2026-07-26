/* ════════════════════════════════════════════════════════════════════════
 *  useSlidingPill — indicador de nav "shared-layout"  (spec 0017 · AC-4)
 *  ------------------------------------------------------------------------
 *  Um único realce desliza até o item ativo, em vez de cada botão acender e
 *  apagar de golpe. A geometria é medida do DOM vivo (offsets relativos ao
 *  container posicionado), então o realce acompanha o layout real — largura
 *  da sidebar recolhendo, rótulo trocando de idioma, viewport girando.
 *
 *  Por que medir mais de uma vez: o `useLayoutEffect` mede no commit, ANTES
 *  de a transição de largura da sidebar rodar e ANTES de as webfonts (Cinzel)
 *  trocarem as métricas do texto. Sem re-medida o realce congela no tamanho
 *  antigo. Daí o ResizeObserver (container + item ativo) e o `fonts.ready`.
 *
 *  Só transform/opacity animam (AC-1); o `@media (prefers-reduced-motion)`
 *  global neutraliza o deslize sem que este módulo precise saber disso.
 * ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Geometria do item, em coordenadas do `offsetParent`. Puro — testável.
 * @param {HTMLElement|null|undefined} el
 * @returns {{left:number,top:number,width:number,height:number,visible:true}|null}
 */
export function measurePill(el) {
  if (!el) return null;
  return {
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
    visible: true,
  };
}

/** Igualdade de geometria — corta o re-render quando o observer dispara à toa. */
export function samePill(a, b) {
  if (!a || !b) return false;
  return a.left === b.left && a.top === b.top
    && a.width === b.width && a.height === b.height
    && a.visible === b.visible;
}

/**
 * @param {string} activeId  id do item ativo (chave usada em `setItemRef`).
 * @param {string} [depsKey] string que muda quando o layout muda por fora do
 *   ResizeObserver (ex.: `${collapsed}|${lang}`) — força re-medida imediata.
 * @returns {{containerRef:Object, setItemRef:(id:string)=>Function, pill:Object|null}}
 */
export function useSlidingPill(activeId, depsKey = "") {
  const containerRef = useRef(null);
  const itemRefs = useRef({});
  const refSetters = useRef({});
  const [pill, setPill] = useState(null);

  // Identidade estável por id: um ref callback novo a cada render faria o React
  // desanexar/reanexar (null → el) em todo ciclo.
  const setItemRef = useCallback((id) => {
    if (!refSetters.current[id]) {
      refSetters.current[id] = (el) => {
        if (el) itemRefs.current[id] = el;
        else delete itemRefs.current[id];
      };
    }
    return refSetters.current[id];
  }, []);

  const measure = useCallback(() => {
    const next = measurePill(itemRefs.current[activeId]);
    setPill(prev => {
      // Sem item ativo (ex.: seção que não está na barra): some no lugar,
      // sem saltar para a origem.
      if (!next) return prev ? (prev.visible ? { ...prev, visible: false } : prev) : null;
      return samePill(prev, next) ? prev : next;
    });
  }, [activeId]);

  useLayoutEffect(() => { measure(); }, [measure, depsKey]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => measure());
    if (containerRef.current) ro.observe(containerRef.current);
    const el = itemRefs.current[activeId];
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [measure, activeId, depsKey]);

  useEffect(() => {
    const fonts = typeof document !== "undefined" ? document.fonts : null;
    if (!fonts || !fonts.ready || typeof fonts.ready.then !== "function") return undefined;
    let alive = true;
    fonts.ready.then(() => { if (alive) measure(); }).catch(() => {});
    return () => { alive = false; };
  }, [measure]);

  return { containerRef, setItemRef, pill };
}

export default useSlidingPill;
