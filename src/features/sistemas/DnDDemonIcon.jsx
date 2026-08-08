/* ─── D&D — ÍCONE D20 DEMONÍACO ─── */
const DnDDemonIcon = ({ size = 48, glow = false }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ display:"block", filter: glow
      ? "drop-shadow(0 0 8px rgba(220,60,60,0.95)) drop-shadow(0 0 22px rgba(180,30,30,0.6))"
      : "drop-shadow(0 0 4px rgba(200,50,50,0.55))" }}>
    <defs>
      <radialGradient id="dndFace" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stopColor="#f07040"/>
        <stop offset="45%" stopColor="#c03020"/>
        <stop offset="100%" stopColor="#6a0808"/>
      </radialGradient>
      <radialGradient id="dndEye" cx="42%" cy="38%" r="58%">
        <stop offset="0%" stopColor="#ffe080"/>
        <stop offset="40%" stopColor="#e0a020"/>
        <stop offset="100%" stopColor="#804000"/>
      </radialGradient>
      <radialGradient id="dndGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#c03020" stopOpacity="0.35"/>
        <stop offset="100%" stopColor="#800010" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id="demonGlow" cx="50%" cy="20%" r="50%">
        <stop offset="0%" stopColor="#ff4040" stopOpacity="0.5"/>
        <stop offset="100%" stopColor="#800010" stopOpacity="0"/>
      </radialGradient>
      <filter id="dndBlur">
        <feGaussianBlur stdDeviation="1" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="dndSoft">
        <feGaussianBlur stdDeviation="0.6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    {/* Ambient red glow */}
    <circle cx="50" cy="55" r="36" fill="url(#dndGlow)"/>
    {/* Demon glow top */}
    <ellipse cx="50" cy="18" rx="28" ry="16" fill="url(#demonGlow)"/>

    {/* ── Demon creature top ── */}
    {/* Head silhouette */}
    <ellipse cx="50" cy="16" rx="10" ry="8" fill="#1a0a0a" filter="url(#dndSoft)"/>
    {/* Left wing */}
    <path d="M40 16 Q28 8 18 12 Q24 18 30 20 Q22 20 16 26 Q26 22 36 22"
      fill="#1a0a0a" filter="url(#dndSoft)"/>
    {/* Right wing */}
    <path d="M60 16 Q72 8 82 12 Q76 18 70 20 Q78 20 84 26 Q74 22 64 22"
      fill="#1a0a0a" filter="url(#dndSoft)"/>
    {/* Glowing red eyes */}
    <circle cx="46" cy="14" r="2.5" fill="#ff2020" filter="url(#dndBlur)"/>
    <circle cx="54" cy="14" r="2.5" fill="#ff2020" filter="url(#dndBlur)"/>
    <circle cx="46" cy="14" r="1.2" fill="#ffaaaa"/>
    <circle cx="54" cy="14" r="1.2" fill="#ffaaaa"/>

    {/* ── Tentacles ── */}
    {/* Left tentacles */}
    <path d="M30 48 Q18 42 14 50 Q10 58 16 62" stroke="#1e0808" strokeWidth="3.5" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    <path d="M32 56 Q20 55 16 64 Q14 72 20 74" stroke="#1e0808" strokeWidth="3" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    <path d="M34 64 Q24 68 22 78 Q24 84 20 88" stroke="#1e0808" strokeWidth="2.5" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    {/* Curl ends left */}
    <path d="M16 62 Q12 66 16 68 Q20 70 18 66" stroke="#1e0808" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M20 74 Q16 80 20 82 Q24 82 22 78" stroke="#1e0808" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    {/* Right tentacles */}
    <path d="M70 48 Q82 42 86 50 Q90 58 84 62" stroke="#1e0808" strokeWidth="3.5" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    <path d="M68 56 Q80 55 84 64 Q86 72 80 74" stroke="#1e0808" strokeWidth="3" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    <path d="M66 64 Q76 68 78 78 Q76 84 80 88" stroke="#1e0808" strokeWidth="2.5" strokeLinecap="round" fill="none" filter="url(#dndSoft)"/>
    {/* Curl ends right */}
    <path d="M84 62 Q88 66 84 68 Q80 70 82 66" stroke="#1e0808" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M80 74 Q84 80 80 82 Q76 82 78 78" stroke="#1e0808" strokeWidth="1.8" strokeLinecap="round" fill="none"/>

    {/* ── D20 icosahedron ── */}
    {/* Outer polygon — 20-sided approximated as layered shapes */}
    {/* Main d20 shape — icosahedron front face */}
    <polygon points="50,24 72,34 78,56 64,74 36,74 22,56 28,34"
      fill="url(#dndFace)" stroke="#2a0808" strokeWidth="1.5" filter="url(#dndSoft)"/>
    {/* Inner edge structure */}
    {/* Top triangle */}
    <polygon points="50,28 68,38 32,38"
      fill="none" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    {/* Middle band lines */}
    <line x1="32" y1="38" x2="22" y2="56" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    <line x1="68" y1="38" x2="78" y2="56" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    <line x1="22" y1="56" x2="36" y2="74" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    <line x1="78" y1="56" x2="64" y2="74" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    <line x1="36" y1="74" x2="64" y2="74" stroke="#2a0808" strokeWidth="1.2" opacity="0.8"/>
    {/* Center vertical */}
    <line x1="50" y1="28" x2="50" y2="74" stroke="#2a0808" strokeWidth="1" opacity="0.5"/>
    {/* Horizontal mid */}
    <line x1="22" y1="56" x2="78" y2="56" stroke="#2a0808" strokeWidth="1" opacity="0.5"/>
    {/* Diagonals from mid-top */}
    <line x1="32" y1="38" x2="64" y2="74" stroke="#2a0808" strokeWidth="0.8" opacity="0.4"/>
    <line x1="68" y1="38" x2="36" y2="74" stroke="#2a0808" strokeWidth="0.8" opacity="0.4"/>

    {/* ── Central triangle with eye ── */}
    <polygon points="50,32 66,56 34,56"
      fill="#2a0808" stroke="#e08020" strokeWidth="1" filter="url(#dndBlur)" opacity="0.9"/>
    {/* Eye white glow */}
    <ellipse cx="50" cy="46" rx="10" ry="6" fill="#e09020" filter="url(#dndBlur)" opacity="0.8"/>
    {/* Iris */}
    <ellipse cx="50" cy="46" rx="7" ry="5" fill="url(#dndEye)"/>
    <ellipse cx="50" cy="46" rx="7" ry="5" fill="none" stroke="#c07010" strokeWidth="0.8" opacity="0.7"/>
    {/* Slit pupil */}
    <ellipse cx="50" cy="46" rx="2" ry="4.5" fill="#1a0800"/>
    <ellipse cx="50" cy="46" rx="2" ry="4.5" fill="none" stroke="#c07010" strokeWidth="0.5" opacity="0.6"/>
    {/* Glint */}
    <ellipse cx="47" cy="43.5" rx="2" ry="1.2" fill="#ffffff" opacity="0.6" transform="rotate(-20,47,43.5)"/>

    {/* ── Numbers on d20 faces ── */}
    <text x="50" y="35" textAnchor="middle" fontFamily="serif" fontSize="4" fill="#f0c060" opacity="0.9" fontWeight="bold">20</text>
    <text x="26" y="50" textAnchor="middle" fontFamily="serif" fontSize="4" fill="#f0c060" opacity="0.8">12</text>
    <text x="74" y="50" textAnchor="middle" fontFamily="serif" fontSize="4" fill="#f0c060" opacity="0.8">14</text>
    <text x="38" y="69" textAnchor="middle" fontFamily="serif" fontSize="4" fill="#f0c060" opacity="0.8">8</text>
    <text x="62" y="69" textAnchor="middle" fontFamily="serif" fontSize="4" fill="#f0c060" opacity="0.8">16</text>
    <text x="50" y="73" textAnchor="middle" fontFamily="serif" fontSize="3.5" fill="#f0c060" opacity="0.7">10</text>

    {/* ── Blood drips ── */}
    <path d="M42 74 Q41 80 42 85 Q43 88 42 92" stroke="#800010" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8"/>
    <path d="M50 74 Q50 82 49 88 Q48 92 50 95" stroke="#800010" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7"/>
    <path d="M58 74 Q59 80 58 84 Q57 86 58 88" stroke="#800010" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
    <ellipse cx="42" cy="92" rx="2" ry="1.5" fill="#800010" opacity="0.7"/>
    <ellipse cx="49" cy="95" rx="1.8" ry="1.2" fill="#800010" opacity="0.6"/>
  </svg>
);

export default DnDDemonIcon;
