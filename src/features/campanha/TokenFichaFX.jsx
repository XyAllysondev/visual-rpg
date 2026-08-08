/* ════════════════════════════════════════════════════════════════════════
   FICHA DE CRIATURA (biblioteca de tokens) — tema + efeitos por elemento
   Partículas e auras usam só transform/opacity (0017 AC-1) e respeitam
   prefers-reduced-motion. Cada elemento tem sua assinatura visual:
   Conhecimento = runas douradas · Energia = faíscas com flicker elétrico ·
   Medo = névoa rastejante · Morte = cinzas subindo · Sangue = gotas + pulso.
════════════════════════════════════════════════════════════════════════ */
const TOKEN_FX = {
  Conhecimento: { c:'#f0c040', glyphs:['✦','◈','⟡','ᚱ','ᛟ','ᚨ'], mode:'rise' },
  Energia:      { c:'#57a0ff', glyphs:['✦','•','•'],             mode:'rise', flicker:true },
  Medo:         { c:'#b030d8', glyphs:['•','•'],                 mode:'rise', fog:true },
  Morte:        { c:'#a8b0b8', glyphs:['•','•','•'],             mode:'rise' },
  Sangue:       { c:'#e04040', glyphs:['●','•','•'],             mode:'fall', beat:true },
  Extras:       { c:'#c9a84c', glyphs:['✦','•'],                 mode:'rise' },
};

const TokenFichaFX = () => (
  <style>{`
    .tokfx-hero{ position:relative; overflow:hidden; height:230px; flex-shrink:0;
      background:
        radial-gradient(90% 130% at 50% 105%, color-mix(in srgb, var(--fxc) 26%, transparent), transparent 60%),
        radial-gradient(120% 90% at 50% -10%, rgba(0,0,0,0.55), transparent 55%),
        linear-gradient(180deg, #0a0812, #120d1c); }
    .tokfx-hero::after{ content:""; position:absolute; inset:0; pointer-events:none;
      box-shadow:inset 0 0 70px 12px rgba(0,0,0,0.65); }
    .tokfx-img{ position:absolute; left:50%; top:50%; max-width:78%; max-height:82%;
      transform:translate(-50%,-50%); filter:drop-shadow(0 6px 22px color-mix(in srgb, var(--fxc) 55%, transparent)); }
    .tokfx-p{ position:absolute; bottom:-12px; pointer-events:none; color:var(--fxc); opacity:0;
      text-shadow:0 0 8px var(--fxc); user-select:none; }
    .tokfx-fall .tokfx-p{ bottom:auto; top:-12px; }
    .tokfx-fog{ position:absolute; width:70%; height:60%; border-radius:50%; pointer-events:none;
      background:radial-gradient(circle, color-mix(in srgb, var(--fxc) 22%, transparent), transparent 70%);
      filter:blur(26px); opacity:0.5; }
    .tokfx-flick{ position:absolute; inset:0; pointer-events:none;
      background:radial-gradient(70% 60% at 50% 45%, color-mix(in srgb, var(--fxc) 16%, transparent), transparent 70%); opacity:0; }
    .tokfx-shimmer{ position:absolute; top:0; bottom:0; width:34%; pointer-events:none;
      background:linear-gradient(100deg, transparent, color-mix(in srgb, var(--fxc) 12%, transparent), transparent); }
    .tokfx-statpill{ display:flex; flex-direction:column; align-items:center; gap:2px; min-width:52px;
      padding:7px 10px; border-radius:8px; background:rgba(255,255,255,0.04);
      border:1px solid color-mix(in srgb, var(--fxc) 30%, transparent); }
    @media (prefers-reduced-motion: no-preference){
      .tokfx-img{ animation:tokfx-float 4.5s ease-in-out infinite; }
      .tokfx-beat .tokfx-img{ animation:tokfx-float 4.5s ease-in-out infinite, tokfx-beatglow 1.4s ease-in-out infinite; }
      .tokfx-p{ animation:tokfx-rise var(--dur,7s) linear var(--delay,0s) infinite; }
      .tokfx-fall .tokfx-p{ animation:tokfx-fallanim var(--dur,5s) ease-in var(--delay,0s) infinite; }
      .tokfx-fog{ animation:tokfx-fogdrift 9s ease-in-out infinite alternate; }
      .tokfx-flick{ animation:tokfx-flicker 3.2s steps(1) infinite; }
      .tokfx-shimmer{ animation:tokfx-sweep 5.5s ease-in-out infinite; }
    }
    @keyframes tokfx-float{ 0%,100%{ transform:translate(-50%,-50%) } 50%{ transform:translate(-50%,calc(-50% - 8px)) } }
    @keyframes tokfx-beatglow{ 0%,30%,100%{ filter:drop-shadow(0 6px 20px color-mix(in srgb, var(--fxc) 45%, transparent)) }
      8%{ filter:drop-shadow(0 6px 38px var(--fxc)) } 16%{ filter:drop-shadow(0 6px 26px color-mix(in srgb, var(--fxc) 70%, transparent)) } }
    @keyframes tokfx-rise{ 0%{ transform:translateY(0) translateX(0); opacity:0 } 12%{ opacity:0.85 }
      70%{ opacity:0.5 } 100%{ transform:translateY(-215px) translateX(var(--drift,8px)); opacity:0 } }
    @keyframes tokfx-fallanim{ 0%{ transform:translateY(0); opacity:0 } 10%{ opacity:0.9 }
      100%{ transform:translateY(245px); opacity:0 } }
    @keyframes tokfx-fogdrift{ 0%{ transform:translateX(-16%) } 100%{ transform:translateX(16%) } }
    @keyframes tokfx-flicker{ 0%,100%{ opacity:0 } 7%{ opacity:0.85 } 9%{ opacity:0.1 } 11%{ opacity:0.6 }
      13%{ opacity:0 } 47%{ opacity:0.5 } 49%{ opacity:0 } 78%{ opacity:0.35 } 80%{ opacity:0 } }
    @keyframes tokfx-sweep{ 0%{ transform:translateX(-140%) skewX(-16deg) } 55%,100%{ transform:translateX(340%) skewX(-16deg) } }
  `}</style>
);

export { TOKEN_FX };
export default TokenFichaFX;
