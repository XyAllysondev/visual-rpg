/* ─── ORDEM PARANORMAL — ÍCONE DE ENERGIA ─── */
const OPEnergyIcon = ({ size = 48, glow = false }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ display:"block", filter: glow ? "drop-shadow(0 0 8px rgba(180,60,220,0.9)) drop-shadow(0 0 20px rgba(140,30,200,0.5))" : "drop-shadow(0 0 4px rgba(180,60,220,0.5))" }}>
    <defs>
      <radialGradient id="opGrad" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stopColor="#e060f0" />
        <stop offset="50%" stopColor="#b030d8" />
        <stop offset="100%" stopColor="#6010a0" />
      </radialGradient>
      <radialGradient id="opGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#c040e8" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#8020c0" stopOpacity="0" />
      </radialGradient>
      <filter id="opBlur">
        <feGaussianBlur stdDeviation="1.2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    {/* Ambient glow behind */}
    <circle cx="50" cy="52" r="30" fill="url(#opGlow)" />

    {/* Flores estilizadas na base */}
    {/* Caule central */}
    <path d="M50 88 Q50 72 50 62" stroke="url(#opGrad)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    {/* Caules laterais */}
    <path d="M50 80 Q44 74 38 70" stroke="url(#opGrad)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    <path d="M50 80 Q56 74 62 70" stroke="url(#opGrad)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    <path d="M50 76 Q42 72 35 72" stroke="url(#opGrad)" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    <path d="M50 76 Q58 72 65 72" stroke="url(#opGrad)" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    {/* Pétalas esquerda */}
    <ellipse cx="35" cy="68" rx="5" ry="3" fill="none" stroke="#b030d8" strokeWidth="1" opacity="0.6" transform="rotate(-30,35,68)"/>
    <ellipse cx="38" cy="65" rx="4" ry="2.5" fill="none" stroke="#c040e8" strokeWidth="0.8" opacity="0.5" transform="rotate(20,38,65)"/>
    {/* Pétalas direita */}
    <ellipse cx="65" cy="68" rx="5" ry="3" fill="none" stroke="#b030d8" strokeWidth="1" opacity="0.6" transform="rotate(30,65,68)"/>
    <ellipse cx="62" cy="65" rx="4" ry="2.5" fill="none" stroke="#c040e8" strokeWidth="0.8" opacity="0.5" transform="rotate(-20,62,65)"/>
    {/* Botão floral central base */}
    <circle cx="50" cy="88" r="2.5" fill="#b030d8" opacity="0.7" filter="url(#opBlur)"/>
    <circle cx="38" cy="70" r="2" fill="#9020c0" opacity="0.6"/>
    <circle cx="62" cy="70" r="2" fill="#9020c0" opacity="0.6"/>

    {/* Raios de energia — as chamas serpenteantes */}
    {/* Raio esquerdo */}
    <path d="M36 60 Q30 48 34 36 Q38 24 32 14"
      stroke="url(#opGrad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.55" filter="url(#opBlur)"/>
    {/* Raio direito */}
    <path d="M64 60 Q70 48 66 36 Q62 24 68 14"
      stroke="url(#opGrad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.55" filter="url(#opBlur)"/>
    {/* Raio central secundário */}
    <path d="M50 60 Q46 48 50 36 Q54 26 48 16"
      stroke="#c040e8" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.35" filter="url(#opBlur)"/>

    {/* ── Símbolo principal — forma geométrica angular (V+seta+chama) ── */}
    {/* Flecha/chama central superior */}
    <path d="M50 14 L44 26 L48 24 L44 38 L50 30 L56 38 L52 24 L56 26 Z"
      fill="url(#opGrad)" filter="url(#opBlur)" opacity="0.95"/>
    {/* Corpo do V */}
    <path d="M38 34 L50 54 L62 34"
      stroke="url(#opGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#opBlur)"/>
    {/* Traço horizontal/asa esquerda */}
    <path d="M32 40 L44 40" stroke="#d050f0" strokeWidth="2" strokeLinecap="round" opacity="0.8" filter="url(#opBlur)"/>
    {/* Traço horizontal/asa direita */}
    <path d="M56 40 L68 40" stroke="#d050f0" strokeWidth="2" strokeLinecap="round" opacity="0.8" filter="url(#opBlur)"/>
    {/* Gancho esquerdo */}
    <path d="M32 40 Q28 46 32 52" stroke="#b030d8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>
    {/* Gancho direito */}
    <path d="M68 40 Q72 46 68 52" stroke="#b030d8" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>

    {/* Ponto central brilhante */}
    <circle cx="50" cy="54" r="3" fill="#e060f0" filter="url(#opBlur)"/>
    <circle cx="50" cy="54" r="1.5" fill="#ffffff" opacity="0.8"/>

    {/* Micro partículas */}
    {[[40,20],[60,18],[34,30],[66,28],[43,50],[57,50]].map(([x,y],i)=>(
      <circle key={i} cx={x} cy={y} r="1" fill="#d050f0" opacity={0.4 + (i%3)*0.15} filter="url(#opBlur)"/>
    ))}
  </svg>
);

export default OPEnergyIcon;
