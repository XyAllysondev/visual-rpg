import { useState, useEffect } from "react";

/* Reactive prefers-reduced-motion hook (spec 0017 AC-5). Guards JS-driven
   effects (video autoplay, tilt) that CSS @media alone can't stop.

   Saiu do App.jsx (spec 0031, onda D) porque DOIS lugares o consomem: o
   `ui/AmbientBackdrop` (névoa em vídeo) e a vitrine de sistemas
   (`features/sistemas/SystemSelect`, que pausa o vídeo idle do card no hover).
   Copiar seria divergência garantida (AC-7). */
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on));
  }, []);
  return reduced;
}
