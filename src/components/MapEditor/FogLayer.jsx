/* Render da fog v2 (spec 0012 / ADR 0006 §7) — mask SVG sequencial extraída do index.jsx:
 * base branca se fillAll; add pinta branco (cobre), cut pinta preto (revela), na ordem.
 * Também desenha o draft (polígono/traço pendente) e os contornos no sub-modo edição. */
import { memo } from 'react';
import { fogFill } from './fog.js';

function shapeSvg(s, fill) {
  if (s.type === 'circle') return <circle key={s.id} cx={s.cx} cy={s.cy} r={s.r} fill={fill} />;
  if (s.type === 'poly' || s.type === 'free') {
    return <polygon key={s.id} points={(s.points || []).map(p => `${p.x},${p.y}`).join(' ')} fill={fill} />;
  }
  return <rect key={s.id} x={s.x} y={s.y} width={s.w} height={s.h} fill={fill} />;
}

/* `key` vai como atributo literal, NÃO dentro do objeto espalhado: o React avisa (e a forma
 * está depreciada) quando `key` chega por spread, e como isto virou item de `.map()` a
 * reconciliação passaria a depender do índice, remontando os contornos ao reordenar shapes. */
function shapeOutline(s, stroke, scale, strong) {
  const p = {
    fill: 'none', stroke,
    strokeWidth: (strong ? 2.5 : 1.5) / scale,
    strokeDasharray: strong ? `${6 / scale},${4 / scale}` : undefined,
  };
  if (s.type === 'circle') return <circle key={s.id} cx={s.cx} cy={s.cy} r={s.r} {...p} />;
  if (s.type === 'poly' || s.type === 'free') {
    return <polygon key={s.id} points={(s.points || []).map(pt => `${pt.x},${pt.y}`).join(' ')} {...p} />;
  }
  return <rect key={s.id} x={s.x} y={s.y} width={s.w} height={s.h} {...p} />;
}

/* Cores dos contornos no sub-modo edição. O mestre precisa ver, de relance, quais salas
 * estão cobertas e quais já foram reveladas — sem isso o fluxo de pré-desenhar a névoa e
 * ir cortando durante a sessão vira adivinhação. */
const COVERED  = '#fbbf24'; // âmbar: névoa cobrindo
const REVEALED = '#4ade80'; // verde: cortada, jogador vê
const PICKED   = '#a855f7'; // roxo: selecionada agora

/* `zIndex` vem do chamador porque precisa ficar acima de TODAS as camadas de elementos, e
 * esse teto depende de quantas camadas a cena tem. Fixo aqui (era 200) a névoa ficava sob os
 * tokens e não escondia ninguém. */
const FogLayer = memo(function FogLayer({
  fog, mapW, mapH, gridHalf, asViewer, draft, selectedIds, editMode, scale = 1, zIndex = 200,
}) {
  const shapes = fog?.shapes || [];
  const hasFog = fog?.fillAll || shapes.length > 0;
  const F = gridHalf;
  const picked = selectedIds || null;
  const draftColor = draft?.op === 'cut' ? '#f87171' : '#fbbf24';
  const fill = fogFill(fog?.color, asViewer ? 0.98 : 0.88);

  const showOutlines = !asViewer && (editMode || !!(picked && picked.size));

  return (
    <>
      {hasFog && (
        <svg style={{ position: 'absolute', top: 0, left: 0, width: mapW, height: mapH, pointerEvents: 'none', zIndex, overflow: 'visible' }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="nx-fog-mask" maskUnits="userSpaceOnUse" x={-F} y={-F} width={mapW + 2 * F} height={mapH + 2 * F}>
              <rect x={-F} y={-F} width={mapW + 2 * F} height={mapH + 2 * F} fill={fog.fillAll ? '#fff' : '#000'} />
              {shapes.map(s => shapeSvg(s, s.op === 'add' ? '#fff' : '#000'))}
            </mask>
          </defs>
          <rect x={-F} y={-F} width={mapW + 2 * F} height={mapH + 2 * F} fill={fill} mask="url(#nx-fog-mask)" />
        </svg>
      )}

      {(draft || showOutlines) && (
        <svg style={{ position: 'absolute', top: 0, left: 0, width: mapW, height: mapH, pointerEvents: 'none', zIndex: zIndex + 6, overflow: 'visible' }} xmlns="http://www.w3.org/2000/svg">
          {showOutlines && shapes.map(s => {
            const isPicked = !!picked?.has(s.id);
            if (!editMode && !isPicked) return null;
            const stroke = isPicked ? PICKED : (s.op === 'cut' ? REVEALED : COVERED);
            return shapeOutline(s, stroke, scale, isPicked);
          })}
          {draft && (() => {
            const pts = draft.pts || [];
            const all = draft.cursor ? [...pts, draft.cursor] : pts;
            return (
              <g>
                <polyline points={all.map(p => `${p.x},${p.y}`).join(' ')} fill={`${draftColor}22`}
                  stroke={draftColor} strokeWidth={2 / scale} strokeDasharray={`${6 / scale},${4 / scale}`} />
                {pts[0] && draft.type === 'poly' && (
                  <circle cx={pts[0].x} cy={pts[0].y} r={6 / scale} fill="none" stroke={draftColor} strokeWidth={2 / scale} />
                )}
              </g>
            );
          })()}
        </svg>
      )}
    </>
  );
});

export default FogLayer;
