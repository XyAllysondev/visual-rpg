/* Overlay de presença ao vivo (spec 0010): pings, apontadores e réguas dos participantes.
 * Renderizado DENTRO do div transformado do mundo — coords de mundo direto. */
import { useEffect, useState } from 'react';
import { isFresh, STALE_MS, PING_MS } from './sync/live';

export default function PingsOverlay({ lives, selfUid, scale, mapW, mapH, zIndex = 300 }) {
  const [, setTick] = useState(0);
  const hasContent = lives.some(l => l.ping || l.pointer || l.ruler);
  useEffect(() => {
    if (!hasContent) return;
    const t = setInterval(() => setTick(x => x + 1), 500); // expira pings/staleness sem novo snapshot
    return () => clearInterval(t);
  }, [hasContent]);

  const now = Date.now();
  const others = lives.filter(l => l.uid !== selfUid);
  const pings = lives.filter(l => l.ping && isFresh({ at: l.ping.at }, now, PING_MS));
  const pointers = others.filter(l => l.pointer && isFresh(l, now, STALE_MS));
  const rulers = others.filter(l => l.ruler && isFresh(l, now, STALE_MS));
  if (!pings.length && !pointers.length && !rulers.length) return null;

  const nameTag = (l, x, y) => (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, 8px)', background: 'rgba(0,0,0,0.75)', color: l.color || '#fff', padding: '1px 7px', borderRadius: 4, fontSize: 11 / scale, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
      {l.name || 'Jogador'}
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex }}>
      <style>{`@keyframes nxPing{0%{transform:scale(0.3);opacity:1}100%{transform:scale(2.2);opacity:0}}`}</style>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: mapW, height: mapH, overflow: 'visible' }} xmlns="http://www.w3.org/2000/svg">
        {rulers.map(l => (
          <g key={'r' + l.uid}>
            <line x1={l.ruler.x1} y1={l.ruler.y1} x2={l.ruler.x2} y2={l.ruler.y2}
              stroke={l.color || '#fbbf24'} strokeWidth={2 / scale} strokeDasharray={`${6 / scale},${4 / scale}`} />
            <circle cx={l.ruler.x2} cy={l.ruler.y2} r={4 / scale} fill={l.color || '#fbbf24'} />
          </g>
        ))}
      </svg>
      {pings.map(l => (
        <div key={'p' + l.uid}>
          {[0, 0.5].map(delay => (
            <div key={delay} style={{ position: 'absolute', left: l.ping.x - 22, top: l.ping.y - 22, width: 44, height: 44, borderRadius: '50%', border: `3px solid ${l.color || '#fbbf24'}`, animation: `nxPing 1.1s ease-out ${delay}s infinite`, pointerEvents: 'none' }} />
          ))}
          <div style={{ position: 'absolute', left: l.ping.x - 5, top: l.ping.y - 5, width: 10, height: 10, borderRadius: '50%', background: l.color || '#fbbf24' }} />
          {nameTag(l, l.ping.x, l.ping.y + 12)}
        </div>
      ))}
      {pointers.map(l => (
        <div key={'c' + l.uid}>
          <div style={{ position: 'absolute', left: l.pointer.x - 7, top: l.pointer.y - 7, width: 14, height: 14, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: l.color || '#60a5fa', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.6)' }} />
          {nameTag(l, l.pointer.x, l.pointer.y + 8)}
        </div>
      ))}
    </div>
  );
}
