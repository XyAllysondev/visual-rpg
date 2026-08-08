/* Arcane rune ring around the login logo — draws itself, then breathes (spec 0017 AC-2).
   Net-new decorative element; reduced-motion is handled by the global @media (ring settles
   static, no spin/breathe). Purely visual: aria-hidden + pointer-events none. */
const NexusSigilRing = ({ size = 160, children }) => {
  const box = Math.round(size * 1.36);
  return (
    <div style={{ position:"relative", width:size, height:size, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
      <svg width={box} height={box} viewBox="0 0 100 100" aria-hidden="true"
        style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", pointerEvents:"none", overflow:"visible" }}>
        <g className="nx-sigil-ticks">
          {Array.from({ length:24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2, r1 = 40.5, r2 = i % 2 ? 44 : 42.5;
            return <line key={i} x1={50 + r1 * Math.cos(a)} y1={50 + r1 * Math.sin(a)}
              x2={50 + r2 * Math.cos(a)} y2={50 + r2 * Math.sin(a)}
              stroke="rgba(201,168,76,0.4)" strokeWidth="0.5" strokeLinecap="round" />;
          })}
        </g>
        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(201,168,76,0.16)" strokeWidth="0.5" strokeDasharray="1.4 3" />
        <circle className="nx-sigil-ring" cx="50" cy="50" r="46" fill="none" stroke="rgba(201,168,76,0.55)" strokeWidth="0.7" />
      </svg>
      {children}
    </div>
  );
};

export default NexusSigilRing;
