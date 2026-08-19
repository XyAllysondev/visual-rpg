/* ════════════════════════════════════════════════════════════════════════
 *  CARROSSEL DE BRASÕES — o fundo da vitrine de sistemas
 *  ------------------------------------------------------------------------
 *  Substitui o sigilo genérico do `HeraldicAmbience` (circunferência com
 *  hexagrama) nesta tela. O sigilo genérico não dizia NADA sobre as casas:
 *  era ornamento igual para os três sistemas. Aqui o fundo passa a ser o
 *  brasão de cada casa, um de cada vez.
 *
 *  A ARTE JÁ EXISTIA e não estava sendo usada: `idle-<sistema>.mp4/webm` são
 *  os três brasões ANIMADOS (960×960, o traço pulsando). Estavam declarados
 *  em `systems.jsx` como `idle:` e nenhuma tela os montava.
 *
 *  COMO O PRETO SOME: os vídeos vêm com fundo preto chapado, não alfa. Em
 *  `mix-blend-mode:screen` o preto vira transparente e só o brilho fica —
 *  por isso o brasão parece flutuar sobre a névoa em vez de morar dentro de
 *  um quadrado. É também o motivo de NÃO precisarmos de versão com alfa.
 *
 *  QUEM MANDA NO QUE APARECE:
 *    · ninguém sob o mouse -> rodízio automático, um brasão a cada 7s
 *    · card sob o mouse    -> trava naquele brasão (o fundo responde à mão)
 *
 *  Só o vídeo visível toca; os outros ficam pausados (`pause()`), senão
 *  seriam três decodificações simultâneas de vídeo o tempo todo.
 * ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";

const TROCA_MS = 7000;

/* `prefers-reduced-motion` não é preferência estética: para quem sente
   enjoo com movimento, um brasão girando em tela cheia é sintoma. Nesse
   caso o carrossel não roda nem anima — mostra um brasão parado. */
const querParado = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
};

export default function CarrosselDeBrasoes({ sistemas = [], focado = null }) {
  /* Só entram os que têm arte. Um sistema sem `idle` (3D&T, Call…) não pode
     virar um buraco no rodízio. */
  const casas = sistemas.filter((s) => s.idle);
  const [i, setI] = useState(0);
  const refs = useRef([]);
  const parado = querParado();

  /* Quando há card sob o mouse, o índice é o dele — o rodízio se cala. */
  const iFocado = casas.findIndex((s) => s.id === focado);
  const ativo = iFocado >= 0 ? iFocado : i;

  useEffect(() => {
    if (parado || iFocado >= 0 || casas.length < 2) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % casas.length), TROCA_MS);
    return () => clearInterval(t);
  }, [parado, iFocado, casas.length]);

  /* Toca só o visível. Sem isto, três vídeos decodificando de uma vez —
     custo que aparece em máquina fraca justamente na primeira tela do app. */
  useEffect(() => {
    refs.current.forEach((v, n) => {
      if (!v) return;
      if (n === ativo) { const p = v.play(); if (p?.catch) p.catch(() => {}); }
      else v.pause();
    });
  }, [ativo]);

  if (!casas.length) return null;

  return (
    <div aria-hidden="true" style={{
      position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
      display: "grid", placeItems: "center", overflow: "hidden",
    }}>
      {casas.map((s, n) => (
        <video
          key={s.id}
          ref={(el) => { refs.current[n] = el; }}
          muted loop playsInline preload="auto"
          poster={s.emblem}
          style={{
            gridArea: "1 / 1",
            width: "min(92vmin, 900px)", height: "min(92vmin, 900px)",
            objectFit: "contain",
            mixBlendMode: "screen",
            /* O preto do vídeo NÃO é puro (#0a0a0a e não #000), então em
               `screen` ele clareia de leve e desenha uma CAIXA retangular
               visível sobre a névoa — apareceu na primeira foto. A máscara
               radial dissolve a borda antes que ela chegue ao canto: o que
               sobra é o brilho do brasão, sem moldura. */
            maskImage: "radial-gradient(circle at 50% 50%, #000 48%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 48%, transparent 70%)",
            opacity: n === ativo ? 0.34 : 0,
            /* O brasão focado cresce de leve: a tela inteira reage ao card,
               não só a moldura dele. */
            transform: n === ativo && iFocado >= 0 ? "scale(1.06)" : "scale(1)",
            transition: parado ? "none" : "opacity 1.6s ease, transform 1.6s ease",
            filter: "saturate(1.15)",
          }}
        >
          <source src={`${s.idle}.webm`} type="video/webm" />
          <source src={`${s.idle}.mp4`} type="video/mp4" />
        </video>
      ))}
    </div>
  );
}
