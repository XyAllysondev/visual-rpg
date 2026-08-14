import { useState, useEffect } from "react";

/* Hooks de viewport. Saíram do App.jsx (spec 0031, onda C): o `useViewportWidth` serve a
   navegação mobile e o `useIsMobile` dimensiona os dials de atributo da ficha de Ordem
   Paranormal (`AttrConstellation`) — lá o tamanho PRECISA vir do JS, porque vai inline no
   elemento e estilo inline vence @media. Um módulo só para os dois — cópia seria
   divergência (AC-7). */

// Largura da viewport reativa a resize/rotação (o app tinha leituras de window.innerWidth
// sem listener, que não refluíam ao girar o device). Base para layout mobile responsivo.
function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1024));
  useEffect(() => {
    let raf = 0;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setW(window.innerWidth)); };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize); };
  }, []);
  return w;
}
function useIsMobile(bp = 768) { return useViewportWidth() < bp; }

export { useViewportWidth, useIsMobile };
