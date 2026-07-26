import { useState, useEffect, useRef, useReducer } from 'react';
import { historyReducer, initialHistoryState } from './reducer.js';
import { DEFAULT_LAYERS_V2 } from './schema'; // fallback correto (7 camadas V2, não as 4 v1 antigas)
import {
  subscribeMapState, subscribeScenes, subscribeElements, getImage, saveImage,
  saveSceneMeta, publishElements, setActiveScene as fsSetActiveScene,
  createScene as fsCreateScene, deleteScene as fsDeleteScene, migrateFirestoreV2,
  updateElementPos, getCampaignMembers,
} from './sync/campaignSync2.js';
import { byId } from './sync/elementDiff.js';
import { makeLivePublisher, subscribeLive, isFresh } from './sync/live.js';
import { canMove, canCreate, nextPerm, PERM_LABELS } from './permissions.js';
import { anchorOf, findAttachTarget, subtreeIds, wouldCycle, dupSubtree } from './attach.js';
import { strokeToPoly, pruneContained, hitFogShape, toggleCut, joinShapes, splitShapes, expandGroups } from './fog.js';
import FogLayer from './FogLayer.jsx';
import { newElementId } from './schema.js';
import { layerZIndex, collectOrphanImageIds, gridZIndex, fogZIndex, overlayZIndex } from './mapHelpers.js';
import {
  cellSize, cellCenter, snapPoint, worldToCell, gridType, gridOffset, isHex, gridPattern,
  measure as measureGrid, measurementMode, measurementsFor, gridScale,
  cellsAcross, cellSizeFromColumns, cellSizeFromRows, parseGridFromFilename, parseScale, formatScale,
  GRID_TYPES, GRID_TYPE_LABELS, MEASUREMENT_LABELS,
} from './grid.js';
import { MapIcon } from './icons.jsx';
import PingsOverlay from './PingsOverlay.jsx';
import AssetDock from './AssetDock.jsx';
import { TextItem, TextEditorOverlay } from './TextItem.jsx';
import { DEFAULT_TEXT_STYLE, plainText, previewLabel } from './richText.js';
import {
  subscribeAssets, saveAsset, deleteAsset, ASSET_SOFT_CAP,
  layerForAssetType, assetTypeForElement, assetPlacesAsToken, assetPlacesAsNote,
} from './assets/assetLib.js';

const TOOLS = [
  { id: 'select',  label: 'Selecionar (V)', icon: 'select' },
  { id: 'token',   label: 'Token (T)',      icon: 'token' },
  { id: 'draw',    label: 'Desenhar (D)',   icon: 'draw' },
  { id: 'fog',     label: 'Névoa — cobrir (F)', icon: 'fog' },
  { id: 'reveal',  label: 'Revelar névoa (R)',  icon: 'reveal' },
  { id: 'note',    label: 'Nota (N)',       icon: 'note' },
  { id: 'text',    label: 'Texto (E)',      icon: 'text' },
  { id: 'measure', label: 'Medir (M)',      icon: 'measure' },
  { id: 'pointer', label: 'Apontar',        icon: 'pointer' },
];
const VIEWER_TOOLS = ['select', 'measure', 'pointer']; // sempre liberadas ao jogador
/* Ferramenta → camada em que ela cria. O jogador ganha a ferramenta quando o `create`
 * daquela camada está ligado (doc /docs/permissions). Névoa/revelar são só do mestre. */
const TOOL_LAYER = { token: 'layer-character', draw: 'layer-drawing', note: 'layer-note', text: 'layer-note' };
const COLORS = ['#4ade80','#60a5fa','#f87171','#fbbf24','#c084fc','#f472b6','#34d399','#fb923c','#e2e8f0','#a3e635'];

/* Condições de token (spec 0008 AC-4) e espessuras de desenho (AC-1). */
const CONDICOES = [
  { e: '☠️', n: 'Morto' }, { e: '😵', n: 'Atordoado' }, { e: '🩸', n: 'Ferido' },
  { e: '🛡️', n: 'Protegido' }, { e: '💤', n: 'Inconsciente' }, { e: '🔥', n: 'Em chamas' },
  { e: '☣️', n: 'Envenenado' }, { e: '👁️', n: 'Marcado' },
];
const DRAW_WIDTHS = [2, 4, 7];

/* Estilos de traço do Owlbear (/docs/drawing → Stroke Style). O dash escala com a
 * espessura, senão em traço grosso o tracejado vira quase contínuo. */
const DASH = {
  solid:  () => undefined,
  dashed: (w) => `${w * 3},${w * 2}`,
  dotted: (w) => `${Math.max(0.5, w * 0.1)},${w * 1.8}`,
};
export const STROKE_STYLES = Object.keys(DASH);

/* Shape de um elemento drawing — points normalizados ao bbox; rect/círculo usam só w/h.
 * `fill`/`fillOpacity` eram hardcoded em 'none': desenho servia para contorno, nunca para
 * área de efeito (a doc do Owlbear trata preenchimento como controle de primeira classe). */
function DrawingShape({ d }) {
  const sw = d.strokeWidth;
  const p = {
    fill: d.fill && d.fill !== 'none' ? d.fill : 'none',
    fillOpacity: d.fill && d.fill !== 'none' ? (d.fillOpacity ?? 0.25) : undefined,
    stroke: d.color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round',
    strokeDasharray: (DASH[d.strokeStyle] || DASH.solid)(sw),
  };
  if (d.shape === 'line') { const a = d.points[0], b = d.points[1] || a; return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...p} fill="none" fillOpacity={undefined} />; }
  if (d.shape === 'rect') return <rect x={sw / 2} y={sw / 2} width={Math.max(1, d.w - sw)} height={Math.max(1, d.h - sw)} {...p} />;
  if (d.shape === 'circle') return <ellipse cx={d.w / 2} cy={d.h / 2} rx={Math.max(1, (d.w - sw) / 2)} ry={Math.max(1, (d.h - sw) / 2)} {...p} />;
  // Traço livre fechado quando tem preenchimento — polyline aberta não pinta área direito.
  const pts = d.points.map(pt => `${pt.x},${pt.y}`).join(' ');
  return p.fill !== 'none'
    ? <polygon points={pts} {...p} />
    : <polyline points={pts} {...p} />;
}

export default function MapEditor({ onBack, campaignId, uid, isMaster, db }) {
  // Modo campanha (spec 0007): mestre edita a mesa (Firestore), jogador vê ao vivo (read-only).
  const campaignMode = !!campaignId;
  const viewer = campaignMode && !isMaster;
  const [hst, dispatch] = useReducer(historyReducer, campaignMode ? 'campaign' : null, initialHistoryState);
  const scenes  = hst.present;
  const canUndo = hst.past.length > 0;
  const canRedo = hst.future.length > 0;

  const [activeScene,     setActiveScene]     = useState(() => scenes[0]?.id || 's1');
  const [bgImages,        setBgImages]        = useState(() => {
    if (campaignMode) return {};
    try { return JSON.parse(localStorage.getItem('nexus_scene_bgs') || '{}'); } catch { return {}; }
  });
  const [imageStore,      setImageStore]      = useState(() => {
    if (campaignMode) return {};
    try { return JSON.parse(localStorage.getItem('nexus_image_bgs') || '{}'); } catch { return {}; }
  });
  const [pan,             setPan]             = useState({ x: 60, y: 60 });
  const [scale,           setScale]           = useState(1);
  const [showGrid,        setShowGrid]        = useState(true);
  const [tool,            setTool]            = useState('select');
  const [tokColor,        setTokColor]        = useState('#4ade80');
  const [tokLabel,        setTokLabel]        = useState('');
  const [measureLine,     setMeasureLine]     = useState(null);
  const [selIds,          setSelIds]          = useState(new Set());
  const [ctxMenu,         setCtxMenu]         = useState(null);
  // Clima: derivado de scene.weather (ver abaixo) — persistido via PATCH_SCENE p/ sincronizar a mesa.
  const [showLeft,        setShowLeft]        = useState(true);
  const [snapGrid,        setSnapGrid]        = useState(true);   // spec 0019: snap ligado por padrão
  const [gridPanel,       setGridPanel]       = useState(false);  // painel de Controles de Grade
  const [textEdit,        setTextEdit]        = useState(null);   // id do texto em edição in-place
  const [casting,         setCasting]         = useState(false);  // transmissão p/ segunda tela ativa
  const [flash,           setFlash]           = useState(null);  // aviso temporário (camada travada, quota…)
  const [boxSel,          setBoxSel]          = useState(null);
  const [layerPickerOpen, setLayerPickerOpen] = useState(false);
  const [,                setDragTick]        = useState(0);
  /* spec 0008 — desenho e upgrades de token */
  const [drawMode,   setDrawMode]   = useState('free'); // free | line | rect | circle
  const [drawColor,  setDrawColor]  = useState('#f87171');
  const [drawWidth,  setDrawWidth]  = useState(4);
  const [drawFill,        setDrawFill]        = useState('none');   // preenchimento (área de efeito)
  const [drawFillOpacity, setDrawFillOpacity] = useState(0.25);
  const [drawStroke,      setDrawStroke]      = useState('solid');  // solid | dashed | dotted
  const [drawLive,   setDrawLive]   = useState(null);   // preview do traço (coords de mundo)
  const [tokSize,    setTokSize]    = useState(1);      // multiplicador da célula (P/M/G/E)
  const [tokImageId, setTokImageId] = useState(null);   // imagem aplicada aos próximos tokens
  /* spec 0009 — sync v2 (state → cena ativa → elements) */
  const [campState,  setCampState]  = useState(null);   // doc map/state ({ v, activeSceneId })
  const [stateLoaded, setStateLoaded] = useState(false); // 1º snapshot de map/state chegou (loading)
  const [campScenes, setCampScenes] = useState([]);     // metas kind:'scene' (painel + cena ativa)
  const [remoteEls,  setRemoteEls]  = useState(null);   // elementos da cena ativa (snapshot)
  /* spec 0010 — interação do jogador / canal live */
  const [lives,        setLives]        = useState([]); // docs live_* de todos
  const [followMaster, setFollowMaster] = useState(true);
  const [camOn,        setCamOn]        = useState(false);
  const [assignMenu,   setAssignMenu]   = useState(null); // { elId, members: [{uid,name}] }
  const livePubRef      = useRef(null);
  const moveThrottleRef = useRef(0);
  /* spec 0012 — fog avançada */
  const [fogShape,      setFogShape]      = useState('rect'); // rect|circle|poly|free
  const [fogEdit,       setFogEdit]       = useState(false);  // sub-modo edição 🧽
  const [fogSel,        setFogSel]        = useState(() => new Set()); // ids das shapes de fog selecionadas
  const [fogDraft,      setFogDraft]      = useState(null);   // preview de poly/free pendente
  const [previewPlayer, setPreviewPlayer] = useState(false);  // 👁 visão do jogador (AC-5)
  const fogPolyRef = useRef(null);  // polígono clique-a-clique pendente
  const fogFreeRef = useRef(null);  // traço livre em andamento
  /* spec 0013 — biblioteca de assets do usuário */
  const [assets,   setAssets]   = useState([]);     // docs users/{uid}/assets/*
  const [dockOpen, setDockOpen] = useState(false);  // dock 🎒 aberto
  const [promptModal, setPromptModal] = useState(null); // modal in-app (substitui window.prompt) — { title, fields, resolve }

  const containerRef     = useRef(null);
  const bgInputRef       = useRef(null);
  const panRef           = useRef(null);
  const fogRef           = useRef(false);
  const fogModeRef       = useRef('add');
  const measureRef       = useRef(null);
  const boxRef           = useRef(null);
  const dragRef          = useRef(null);
  const resizeRef        = useRef(null);
  const rotateRef        = useRef(null);
  const drawRef          = useRef(null);
  const fogDragRef       = useRef(null);
  const pointersRef      = useRef(new Map()); // toque: pointerId → {x,y} de cada dedo ativo
  const pinchRef         = useRef(null);      // gesto de 2 dedos em andamento (zoom + pan)
  const tokImgInputRef   = useRef(null);
  const replaceInputRef  = useRef(null); // spec 0011 AC-7: substituir imagem
  const replaceTargetRef = useRef(null);
  const migrationDoneRef = useRef(false);
  const elementDownRef   = useRef(false);
  const flashTimerRef    = useRef(null);
  const stateRef         = useRef({});
  const dragRafRef       = useRef(0); // coalesce dos re-renders de arraste/resize/rotate (1 por frame)
  const castRef          = useRef(null); // conexão/janela da transmissão ativa
  /* Ctrl/Cmd segurado desliga o snap SÓ durante aquele gesto (docs /docs/images e /docs/fog).
   * É o que permite encostar um token fora da grade sem ter que desligar o snap da cena. */
  const modKeyRef        = useRef(false);

  const scene    = scenes.find(s => s.id === activeScene) || scenes[0];
  const elements = scene.elements || [];
  const gridSize = cellSize(scene); // fonte única: grid.js valida/normaliza
  const bgSize   = scene.bgSize   || { w: 3000, h: 2000 };
  const layers   = scene.layers   || DEFAULT_LAYERS_V2;
  const layerOrder = Object.fromEntries(layers.map((l, i) => [l.id, i]));
  const weather  = scene.weather ?? null; // clima agora vive na cena (sincroniza p/ a mesa)
  const mapW     = bgSize.w;
  const mapH     = bgSize.h;
  /* Ferramentas do jogador saem das permissões de criação da cena. Na prática hoje isto
   * devolve sempre VIEWER_TOOLS, porque nenhuma UI liga `create` — foi revertida de
   * propósito enquanto o jogador não tiver caminho de escrita (ver comentário no painel de
   * camadas). A lógica fica pronta para quando esse caminho existir.
   * Declarado aqui em cima porque um efeito logo abaixo usa `allowedKey` como dependência,
   * que é avaliada durante o render. */
  const allowedTools = viewer
    ? TOOLS.filter(t => VIEWER_TOOLS.includes(t.id) || (TOOL_LAYER[t.id] && canCreate(scene, TOOL_LAYER[t.id], uid, false)))
    : TOOLS;
  const allowedKey = allowedTools.map(t => t.id).join(',');

  stateRef.current = { pan, scale, scene, tool, selIds, elements, gridSize, snapGrid, imageStore, fogShape, fogEdit, fogSel };

  function screenToWorld(sx, sy) {
    const { pan: p, scale: s } = stateRef.current;
    return { x: (sx - p.x) / s, y: (sy - p.y) / s };
  }
  function clientXY(e) {
    const r = containerRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  /* Snap de vértice (interseção da grade). Delega ao grid.js, então respeita o offset de
   * alinhamento e o tipo de grid — em hex não há interseção retangular e cai no centro. */
  const snapOff = () => !stateRef.current.snapGrid || modKeyRef.current;
  function snap(x, y) {
    if (snapOff()) return { x, y };
    return snapPoint(stateRef.current.scene, x, y);
  }
  /* Snap de token: centro da célula (não a interseção) — spec 0019 AC-9. */
  function snapToken(x, y) {
    if (snapOff()) return { x, y };
    return cellCenter(stateRef.current.scene, x, y);
  }
  /* Aviso temporário no canto (camada travada, quota de armazenamento…). */
  function showFlash(msg) {
    setFlash(msg);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), 2600);
  }
  /* Prompt in-app (substitui window.prompt — modal com tema do editor). Resolve com um
   * objeto { [field.key]: valor } ao confirmar, ou null ao cancelar. `fields` = [{ key,
   * label, value?, placeholder? }]. */
  function askPrompt(title, fields) {
    return new Promise((resolve) => {
      setPromptModal({ title, fields: fields.map(f => ({ ...f, value: f.value || '' })), resolve });
    });
  }
  function closePrompt(result) {
    setPromptModal((m) => { m?.resolve(result); return null; });
  }
  /* Re-render do arraste/resize/rotate coalescido em 1 por frame (as posições ao vivo já vivem
   * em refs — dragTick só dispara o repaint; dispositivos de toque emitem >60 pointermove/s). */
  function scheduleDragRender() {
    if (dragRafRef.current) return;
    dragRafRef.current = requestAnimationFrame(() => { dragRafRef.current = 0; setDragTick(t => t + 1); });
  }
  /* Reordena camadas (spec 0019 AC-2). delta>0 = sobe no empilhamento (topo do painel). */
  function moveLayer(id, delta) {
    const arr = [...(stateRef.current.scene.layers || DEFAULT_LAYERS_V2)];
    const i = arr.findIndex(l => l.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    dispatch({ type: 'REORDER_LAYERS', sceneId: stateRef.current.scene.id, layers: arr });
  }

  /* Névoa por arrasto (0009: rect célula-alinhado; 0012 AC-1: círculo centro→raio):
     o arrasto vira UMA shape aplicada sobre as shapes-base do mousedown (preview ao vivo). */
  function applyFogDrag(wx, wy) {
    const drag = fogDragRef.current; if (!drag) return;
    const sc = stateRef.current.scene;
    const op = fogModeRef.current === 'add' ? 'add' : 'cut';
    let shape;
    if (drag.kind === 'circle') {
      shape = { id: drag.shapeId, op, type: 'circle', cx: Math.round(drag.wx), cy: Math.round(drag.wy), r: Math.max(6, Math.round(Math.hypot(wx - drag.wx, wy - drag.wy))) };
    } else if (isHex(sc)) {
      // "Retângulo por células" não tem sentido em favo de mel: cobre a área arrastada crua.
      const x1 = Math.min(drag.wx, wx), y1 = Math.min(drag.wy, wy);
      shape = { id: drag.shapeId, op, type: 'rect', x: Math.round(x1), y: Math.round(y1),
        w: Math.max(6, Math.round(Math.abs(wx - drag.wx))), h: Math.max(6, Math.round(Math.abs(wy - drag.wy))) };
    } else {
      // Alinha às células via grid.js, então o offset de alinhamento é respeitado.
      const gs = cellSize(sc), o = gridOffset(sc);
      const a = worldToCell(sc, Math.min(drag.wx, wx), Math.min(drag.wy, wy));
      const b = worldToCell(sc, Math.max(drag.wx, wx), Math.max(drag.wy, wy));
      shape = { id: drag.shapeId, op, type: 'rect',
        x: a.c * gs + o.x, y: a.r * gs + o.y,
        w: (b.c - a.c + 1) * gs, h: (b.r - a.r + 1) * gs };
    }
    dispatch({ type: 'PATCH_SCENE', sceneId: sc.id, coalesceKey: drag.shapeId, patch: {
      fog: { v: 2, fillAll: !!sc.fog?.fillAll, shapes: [...drag.base, shape] },
    } });
  }
  /* Poda por contenção no commit (spec 0012 AC-6) — dispatch extra só quando muda. */
  function pruneFog() {
    const sc = stateRef.current.scene;
    const shapes = sc.fog?.shapes || [];
    const pruned = pruneContained(shapes);
    if (pruned !== shapes) upScene({ fog: { ...sc.fog, shapes: pruned } });
  }
  function commitFogShape(op, type, points) {
    if (!points || points.length < 3) return; // degenerado → sem efeito (borda da spec)
    const sc = stateRef.current.scene;
    const shape = { id: 'fog_' + Date.now(), op, type, points };
    upScene({ fog: { v: 2, fillAll: !!sc.fog?.fillAll, shapes: pruneContained([...(sc.fog?.shapes || []), shape]) } });
  }
  function commitFogPoly() {
    const pend = fogPolyRef.current;
    fogPolyRef.current = null; setFogDraft(null);
    if (pend) commitFogShape(pend.op, 'poly', pend.pts.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })));
  }
  /* Cortar/Recobrir a névoa selecionada (doc Owlbear /docs/fog): o fluxo de encontro é
   * pré-desenhar as salas e ir alternando durante a sessão. Coalesce por seleção para o
   * undo não virar uma entrada por sala quando você alterna várias de uma vez. */
  function toggleFogCut() {
    const sc = stateRef.current.scene;
    const sel = stateRef.current.fogSel;
    if (!sel?.size) return;
    const shapes = sc.fog?.shapes || [];
    const next = toggleCut(shapes, [...sel]);
    if (next === shapes) return;
    upScene({ fog: { ...sc.fog, shapes: next } });
  }

  /* Join: as formas passam a alternar juntas (salão com reentrâncias vira uma unidade). */
  function joinFogShapes() {
    const sc = stateRef.current.scene;
    const sel = stateRef.current.fogSel;
    if (!sel || sel.size < 2) { showFlash('Selecione 2 ou mais formas (Shift+clique) para juntar.'); return; }
    const shapes = sc.fog?.shapes || [];
    const next = joinShapes(shapes, [...sel]);
    if (next === shapes) return;
    upScene({ fog: { ...sc.fog, shapes: next } });
    showFlash('Formas juntas — cortar uma agora revela todas.');
  }

  function splitFogShapes() {
    const sc = stateRef.current.scene;
    const sel = stateRef.current.fogSel;
    if (!sel?.size) return;
    const shapes = sc.fog?.shapes || [];
    const next = splitShapes(shapes, [...sel]);
    if (next === shapes) { showFlash('Nenhuma das formas selecionadas está em grupo.'); return; }
    upScene({ fog: { ...sc.fog, shapes: next } });
  }

  function removeFogShape(ids) {
    const sc = stateRef.current.scene;
    const shapes = sc.fog?.shapes || [];
    const kill = expandGroups(shapes, ids instanceof Set ? [...ids] : [ids]);
    upScene({ fog: { ...sc.fog, shapes: shapes.filter(s => !kill.has(s.id)) } });
    setFogSel(new Set());
  }

  function upScene(patch) { dispatch({ type: 'PATCH_SCENE', sceneId: stateRef.current.scene.id, patch }); }
  /* Metadados v2 (ownerId/parentId/z) entram em todo elemento novo; spread do el preserva os
     campos de um duplicado. */
  function addEl(el)       { dispatch({ type: 'ADD_ELEMENT',    sceneId: stateRef.current.scene.id, element: { ownerId: uid ?? null, parentId: null, z: Date.now(), rotation: 0, ...el } }); }
  function updateEl(id, p) { dispatch({ type: 'UPDATE_ELEMENT', sceneId: stateRef.current.scene.id, id, patch: p }); }
  function deleteEl(id)    { dispatch({ type: 'DELETE_ELEMENT', sceneId: stateRef.current.scene.id, id }); }
  /* Digitar num texto coalesce numa ÚNICA entrada de undo — sem isso cada tecla vira um
   * passo e o Ctrl+Z fica inútil (mesmo mecanismo do arrasto de fog, spec 0019 AC-7). */
  function updateElText(id, text) { dispatch({ type: 'UPDATE_ELEMENT', sceneId: stateRef.current.scene.id, id, patch: { text }, coalesceKey: `text:${id}` }); }

  /* ── TRANSMISSÃO / CASTING (doc Owlbear /docs/casting) ──
   * Abre a mesa em VISÃO DE JOGADOR numa segunda tela, para mesa presencial. Usa a
   * Presentation API quando o navegador oferece (Chrome/Edge com tela ESTENDIDA — espelhada
   * não conta — ou Chromecast) e cai para uma janela comum, que o mestre arrasta para a TV.
   * A rota /cast força `isMaster={false}`, então a névoa fica opaca na TV. */
  function openCastWindow(url) {
    const w = window.open(url, 'nexus-cast', 'width=1280,height=720');
    if (!w) { showFlash('O navegador bloqueou a janela — libere pop-ups para este site.'); return; }
    castRef.current = { close: () => { try { w.close(); } catch (e) { /* já fechada */ } } };
    setCasting(true);
    showFlash('Transmissão aberta — arraste a janela para a TV e aperte F11.');
  }

  function startCast() {
    if (!campaignId) { showFlash('A transmissão existe só em mesa de campanha.'); return; }
    const url = `${window.location.origin}/cast/${encodeURIComponent(campaignId)}`;
    const PR = window.PresentationRequest;
    if (PR) {
      try {
        const req = new PR([url]);
        req.start().then(conn => {
          castRef.current = { close: () => { try { conn.terminate(); } catch (e) { /* já encerrada */ } } };
          setCasting(true);
          showFlash('Transmitindo — a TV mostra a visão do jogador.');
        }).catch(() => openCastWindow(url)); // usuário cancelou ou não há tela estendida
        return;
      } catch (e) { /* navegador tem a API mas recusou — cai na janela */ }
    }
    openCastWindow(url);
  }

  function stopCast() {
    castRef.current?.close();
    castRef.current = null;
    setCasting(false);
  }

  /* Encerra a transmissão junto com o editor. Sem isto, sair da tela do mapa com a
   * transmissão ligada deixa a janela/conexão órfã — e o botão de parar some junto com o
   * componente, então não sobra caminho para fechá-la. */
  useEffect(() => () => { castRef.current?.close(); castRef.current = null; }, []);
  function deleteEls(ids)  { dispatch({ type: 'DELETE_ELEMENTS', sceneId: stateRef.current.scene.id, ids }); }

  // Persistência local (spec 0019 AC-10): a falha de quota NÃO é mais engolida em silêncio —
  // loga e avisa, senão o usuário perde trabalho sem sinal (política da spec quick/001).
  const persistLocal = (key, value) => {
    if (campaignMode) return;
    try { localStorage.setItem(key, value); }
    catch (e) {
      console.error(`[MapEditor] falha ao salvar ${key} (quota?):`, e);
      showFlash('⚠ Armazenamento cheio — o mapa pode não ser salvo. Apague cenas/imagens grandes.');
    }
  };
  useEffect(() => { persistLocal('nexus_scenes_v1', JSON.stringify(scenes)); }, [scenes, campaignMode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { persistLocal('nexus_scene_bgs', JSON.stringify(bgImages)); }, [bgImages, campaignMode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { persistLocal('nexus_image_bgs', JSON.stringify(imageStore)); }, [imageStore, campaignMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Varre imagens órfãs UMA vez na montagem (spec 0019 AC-11) — sem histórico ainda, o que
  // não está em `scenes` é lixo real acumulado (undo/delete/migração v1→v2 que vazaram).
  useEffect(() => {
    if (campaignMode) return;
    const orphans = collectOrphanImageIds(scenes, imageStore);
    if (!orphans.length) return;
    const drop = (obj) => { const n = { ...obj }; orphans.forEach(id => delete n[id]); return n; };
    setImageStore(prev => drop(prev));
    setBgImages(prev => (orphans.some(id => id in prev) ? drop(prev) : prev));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── modo campanha: sync v2 (spec 0009 / ADR 0006) ── */
  const loadedRef   = useRef(false);      // 1ª carga da cena ativa concluída (libera autosave)
  const uploadedRef = useRef(new Set());  // imagens já persistidas (evita re-upload/eco)
  const fetchingRef = useRef(new Set());  // imagens em download (getDoc on-demand)
  const lastPubRef  = useRef({});         // último byId publicado (base do diff)
  const lastMetaRef = useRef('');         // último meta JSON salvo (evita write por drag)

  /* migração lazy (mestre) + assinaturas de state e metas de cena */
  useEffect(() => {
    if (!campaignMode || !db) return;
    let unsubState, unsubScenes, cancelled = false;
    (async () => {
      if (isMaster) {
        try { await migrateFirestoreV2(db, campaignId, uid); }
        catch (e) { console.error('[mesa] migração v2 falhou:', e); }
      }
      if (cancelled) return;
      unsubState  = subscribeMapState(db, campaignId, (s) => { setCampState(s); setStateLoaded(true); });
      unsubScenes = subscribeScenes(db, campaignId, (metas) => setCampScenes(metas));
    })();
    return () => { cancelled = true; unsubState?.(); unsubScenes?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  /* elementos da cena ativa (re-assina na troca de cena) */
  useEffect(() => {
    if (!campaignMode || !db) return;
    const sid = campState?.activeSceneId;
    if (!sid) return;
    loadedRef.current = false;
    setRemoteEls(null);
    const unsub = subscribeElements(db, campaignId, sid, (els, fromSelf) => {
      // Mestre ignora o eco dos próprios batches após a 1ª carga.
      if (isMaster && fromSelf && loadedRef.current) return;
      setRemoteEls(els);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campState?.activeSceneId]);

  /* montagem: meta + elementos → cena única no reducer (jogador aplica tudo; mestre só 1ª carga) */
  useEffect(() => {
    if (!campaignMode) return;
    const sid = campState?.activeSceneId;
    if (!sid || remoteEls === null) return;
    const meta = campScenes.find(s => s.id === sid)
      || (campScenes.length ? campScenes[0] : null); // cena ativa apagada → 1ª disponível
    if (!meta) return;
    if (isMaster && loadedRef.current && activeScene === meta.id) return;
    const assembled = { ...meta, elements: [...remoteEls].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)) };
    dispatch({ type: 'LOAD_SCENES', scenes: [assembled] });
    setActiveScene(meta.id);
    lastPubRef.current = byId(assembled.elements);
    const { elements: _e, ...m } = assembled;
    lastMetaRef.current = JSON.stringify(m);
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campState, campScenes, remoteEls]);

  /* mestre: autosave v2 — meta da cena (debounce 1s, só quando o meta muda) */
  useEffect(() => {
    if (!campaignMode || !isMaster || !db || !loadedRef.current) return;
    const t = setTimeout(() => {
      const sc = scenes.find((s) => s.id === activeScene) || scenes[0];
      if (!sc) return;
      const { elements: _e, ...meta } = sc;
      const json = JSON.stringify(meta);
      if (json === lastMetaRef.current) return;
      lastMetaRef.current = json;
      saveSceneMeta(db, campaignId, uid, sc);
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, activeScene]);

  /* mestre: autosave v2 — elementos por diff batcheado (debounce 300ms) */
  useEffect(() => {
    if (!campaignMode || !isMaster || !db || !loadedRef.current) return;
    const t = setTimeout(() => {
      const sc = scenes.find((s) => s.id === activeScene) || scenes[0];
      if (!sc) return;
      const next = byId(sc.elements);
      const prev = lastPubRef.current;
      lastPubRef.current = next;
      publishElements(db, campaignId, sc.id, prev, next);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, activeScene]);

  /* mestre: sobe imagens novas (reduzidas) e alinha o store local ao que foi salvo */
  useEffect(() => {
    if (!campaignMode || !isMaster || !db) return;
    Object.entries(imageStore).forEach(([id, data]) => {
      if (!id.startsWith('img_') || uploadedRef.current.has(id)) return;
      uploadedRef.current.add(id);
      saveImage(db, campaignId, id, data).then((r) => {
        if (r && r.data !== data) setImageStore((prev) => ({ ...prev, [id]: r.data }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageStore]);

  /* spec 0013: biblioteca do usuário (independe de campanha — coleção users/{uid}) */
  useEffect(() => {
    if (!db || !uid || viewer) return;
    return subscribeAssets(db, uid, setAssets);
  }, [db, uid, viewer]);

  /* ── spec 0010: canal live (ping/apontador/régua/câmera) ── */
  useEffect(() => {
    if (!campaignMode || !db || !uid) return;
    const name = localStorage.getItem('nexus_profile_name') || (isMaster ? 'Mestre' : 'Jogador');
    const color = COLORS[[...String(uid)].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];
    livePubRef.current = makeLivePublisher(db, campaignId, uid, { name, color, master: !!isMaster });
    const unsub = subscribeLive(db, campaignId, setLives);
    return () => { unsub(); livePubRef.current?.destroy(); livePubRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, uid]);

  /* apontador desliga ao trocar de ferramenta */
  useEffect(() => {
    if (tool !== 'pointer') livePubRef.current?.publish({ pointer: null });
  }, [tool]);

  /* mestre: Sync View — publica a câmera enquanto ligado (AC-6) */
  useEffect(() => {
    if (!campaignMode || !isMaster || !livePubRef.current) return;
    livePubRef.current.publish(camOn ? { cam: { x: pan.x, y: pan.y, s: scale }, camOn: true } : { camOn: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camOn, pan, scale]);

  /* Se o mestre revogar a permissão enquanto o jogador está com a ferramenta na mão, ela
   * some da barra — sem isto ele continuaria clicando numa ferramenta que não existe mais. */
  useEffect(() => {
    if (viewer && !allowedKey.split(',').includes(tool)) setTool('select');
  }, [viewer, allowedKey, tool]);

  /* jogador: segue a câmera do mestre até pan/zoom manual (AC-6) */
  const masterCam = viewer ? lives.find(l => l.master && l.camOn && isFresh(l)) : null;
  useEffect(() => {
    if (!viewer || !followMaster || !masterCam?.cam) return;
    setPan({ x: masterCam.cam.x, y: masterCam.cam.y });
    setScale(masterCam.cam.s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, followMaster, masterCam?.cam?.x, masterCam?.cam?.y, masterCam?.cam?.s]);

  /* todos: baixa on-demand imagens referenciadas que faltam no store (fim do onSnapshot global) */
  useEffect(() => {
    if (!campaignMode || !db) return;
    elements.forEach((el) => {
      const id = el.imageId;
      if (!id || imageStore[id] || fetchingRef.current.has(id)) return;
      fetchingRef.current.add(id);
      getImage(db, campaignId, id).then((data) => {
        uploadedRef.current.add(id); // já existe no servidor — não re-subir
        if (data) setImageStore((prev) => ({ ...prev, [id]: data }));
        fetchingRef.current.delete(id);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, imageStore]);

  /* one-time migration: old single bgImages → image elements */
  useEffect(() => {
    if (migrationDoneRef.current || campaignMode) return;
    migrationDoneRef.current = true;
    scenes.forEach(sc => {
      const hasBg = bgImages[sc.id];
      const hasImgEl = (sc.elements || []).some(el => el.type === 'image');
      if (hasBg && !hasImgEl) {
        setImageStore(prev => ({ ...prev, [sc.id]: hasBg }));
        dispatch({ type: 'ADD_ELEMENT', sceneId: sc.id, element: {
          id: Date.now() + (Math.random() * 999 | 0),
          type: 'image', layerId: 'layer-map',
          x: 0, y: 0, w: sc.bgSize?.w || 3000, h: sc.bgSize?.h || 2000,
          rotation: 0, imageId: sc.id,
          hidden: false, locked: false, spectre: false,
        }});
      }
    });
  }, []); // eslint-disable-line

  function loadBg(file) {
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const { scene: sc } = stateRef.current;
        // Downscale (spec 0019 AC-11): cap ~2048px + JPEG — evita estourar a quota do
        // localStorage com fundos em resolução total (o maior ofensor de perda de trabalho).
        const cap = 2048;
        const r = Math.min(1, cap / Math.max(img.width, img.height));
        let dataUrl = ev.target.result, w = img.width, h = img.height;
        if (r < 1) {
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * r));
          c.height = Math.max(1, Math.round(img.height * r));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          dataUrl = c.toDataURL('image/jpeg', 0.85); w = c.width; h = c.height;
        }
        const imageId = 'img_' + Date.now();
        const ck = 'loadbg:' + imageId; // coalesce as 2 dispatches num único passo de undo
        setImageStore(prev => ({ ...prev, [imageId]: dataUrl }));
        dispatch({ type: 'PATCH_SCENE', sceneId: sc.id, coalesceKey: ck, patch: { bgSize: { w, h } } });
        /* Alinhamento automático pelo nome do arquivo, como no Owlbear: "mapa_49x28.jpg"
         * significa 49 colunas por 28 linhas, então a célula sai da divisão. */
        const fromName = parseGridFromFilename(file.name);
        if (fromName) {
          const out = cellSizeFromColumns({ w, h }, fromName.columns);
          if (out && out.size > 0) {
            dispatch({ type: 'PATCH_SCENE', sceneId: sc.id, coalesceKey: ck, patch: {
              grid: { ...(sc.grid || {}), size: out.size, offset: { x: 0, y: 0 } },
            }});
            showFlash(`Grade detectada no nome do arquivo: ${fromName.columns}×${fromName.rows} células`);
          }
        }
        dispatch({ type: 'ADD_ELEMENT', sceneId: sc.id, coalesceKey: ck, element: {
          id: newElementId(), type: 'image', layerId: 'layer-map',
          x: 0, y: 0, w, h, rotation: 0, imageId,
          hidden: false, locked: false, spectre: false,
        }});
        const maxW = (containerRef.current?.clientWidth  || window.innerWidth  - 80) * 0.9;
        const maxH = (containerRef.current?.clientHeight || window.innerHeight - 120) * 0.9;
        setScale(Math.min(1, maxW / w, maxH / h));
        setPan({ x: 30, y: 30 });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* Token com imagem (spec 0008 AC-2): reduz a ~256px; img_tok_* sobe pelo pipeline de campanha. */
  function loadTokenImage(file) {
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, 256 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * r));
        c.height = Math.max(1, Math.round(img.height * r));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const id = 'img_tok_' + Date.now();
        setImageStore(prev => ({ ...prev, [id]: c.toDataURL('image/jpeg', 0.85) }));
        setTokImageId(id);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* Substituir imagem mantendo posição/tamanho/rotação (spec 0011 AC-7). */
  function replaceImage(file) {
    const elId = replaceTargetRef.current;
    if (!file?.type.startsWith('image/') || !elId) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        // Downscale igual ao loadBg (spec 0019 AC-11) — antes gravava full-res e driblava a quota.
        const cap = 2048;
        const r = Math.min(1, cap / Math.max(img.width, img.height));
        let dataUrl = ev.target.result, w = img.width, h = img.height;
        if (r < 1) {
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * r));
          c.height = Math.max(1, Math.round(img.height * r));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          dataUrl = c.toDataURL('image/jpeg', 0.85); w = c.width; h = c.height;
        }
        const imageId = 'img_' + Date.now();
        setImageStore(prev => ({ ...prev, [imageId]: dataUrl }));
        updateEl(elId, { imageId, w, h });
        replaceTargetRef.current = null;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ── spec 0013: biblioteca de assets ─────────────────────────────────────── */
  /* Reduz a ~256px p/ thumbnail de asset; devolve {data,w,h,hash} (hash barato p/ dedup local). */
  function reduceForAsset(dataUrl) {
    return new Promise(resolve => {
      if (!dataUrl) { resolve(null); return; }
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, 256 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * r));
        c.height = Math.max(1, Math.round(img.height * r));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const data = c.toDataURL('image/jpeg', 0.85);
        let h = 5381; for (let i = 0; i < data.length; i += 97) h = ((h * 33) ^ data.charCodeAt(i)) >>> 0;
        resolve({ data, w: c.width, h: c.height, hash: h.toString(16) });
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  /* Salvar um token/imagem/nota da cena na biblioteca (AC-1). */
  async function saveToLibrary(el) {
    if (!el) return;
    if (!db || !uid) { showFlash('Faça login para usar a biblioteca de assets.'); return; }
    if (assets.length >= ASSET_SOFT_CAP) { showFlash(`Limite de ${ASSET_SOFT_CAP} assets atingido — remova alguns antes de salvar.`); return; }
    const type = assetTypeForElement(el);
    const raw = el.imageId ? stateRef.current.imageStore[el.imageId] : null;
    if (!raw && type !== 'note') { showFlash('Este elemento não tem imagem para salvar na biblioteca.'); return; }
    const res = await askPrompt('Salvar na biblioteca', [
      { key: 'name', label: 'Nome do asset', value: el.label || (el.text || '').slice(0, 24) || 'Asset' },
      { key: 'tags', label: 'Tags (separadas por vírgula)', placeholder: 'ex.: chefe, floresta' },
    ]);
    if (res == null) return;
    const name = res.name;
    const tags = (res.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const red = raw ? await reduceForAsset(raw) : null;
    saveAsset(db, uid, {
      type, name: name.trim() || 'Asset', tags, folder: null,
      data: red?.data || null, hash: red?.hash || null, w: red?.w || null, h: red?.h || null,
    });
  }

  /* Colocar um asset na cena (AC-3/AC-4): imagem copiada p/ a campanha com dedup por hash. */
  async function placeAsset(asset, worldPos) {
    if (!asset) return;
    const wp = worldPos || screenToWorld(
      (containerRef.current?.clientWidth || 800) / 2,
      (containerRef.current?.clientHeight || 600) / 2,
    );
    const type = asset.type;
    const layerId = layerForAssetType(type);
    let imageId = null;
    if (asset.data) {
      if (campaignMode) {
        const r = await saveImage(db, campaignId, null, asset.data); // null → img_a_<hash16> com dedup (0009)
        if (!r) return;
        imageId = r.imageId;
        uploadedRef.current.add(imageId); // já no servidor — não re-subir
        setImageStore(prev => (prev[imageId] ? prev : { ...prev, [imageId]: r.data }));
      } else {
        imageId = 'img_a_' + (asset.hash || asset.id || Date.now().toString(36)); // dedup local por hash
        setImageStore(prev => (prev[imageId] ? prev : { ...prev, [imageId]: asset.data }));
      }
    }
    const base = { id: Date.now() + (Math.random() * 999 | 0), layerId, hidden: false, locked: false, spectre: false };
    if (assetPlacesAsNote(type)) {
      addEl({ ...base, type: 'note', x: Math.round(wp.x), y: Math.round(wp.y), text: asset.name || 'Nota' });
    } else if (assetPlacesAsToken(type)) {
      addEl({ ...base, type: 'token', x: Math.round(wp.x), y: Math.round(wp.y),
        color: tokColor, label: (asset.name || '?').slice(0, 12), size: Math.max(18, Math.round(gridSize)), imageId, conditions: [] });
    } else {
      const w = asset.w || 200, h = asset.h || 200;
      addEl({ ...base, type: 'image', x: Math.round(wp.x - w / 2), y: Math.round(wp.y - h / 2), w, h, imageId });
    }
  }

  function toggleCondition(id, emoji) {
    const el = stateRef.current.elements.find(e => e.id === id);
    if (!el) return;
    const cur = el.conditions || [];
    updateEl(id, { conditions: cur.includes(emoji) ? cur.filter(c => c !== emoji) : [...cur, emoji] });
  }

  /* Multi-cena (spec 0009 AC-3): no modo campanha as cenas vivem no Firestore
     (metas em campScenes) e a ativa é o ponteiro map/state. */
  async function addScene() {
    if (campaignMode) {
      const id = await fsCreateScene(db, campaignId, uid, 'Cena ' + (campScenes.length + 1));
      await fsSetActiveScene(db, campaignId, uid, id);
      return;
    }
    const id = 's' + Date.now();
    dispatch({ type: 'ADD_SCENE', id });
    setActiveScene(id);
  }
  async function deleteScene(id) {
    if (campaignMode) {
      if (campScenes.length <= 1) return;
      const next = campScenes.find(s => s.id !== id);
      if (campState?.activeSceneId === id) await fsSetActiveScene(db, campaignId, uid, next.id);
      await fsDeleteScene(db, campaignId, id);
      return;
    }
    if (scenes.length <= 1) return;
    const next = scenes.find(s => s.id !== id);
    dispatch({ type: 'DELETE_SCENE', sceneId: id });
    setBgImages(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (activeScene === id) setActiveScene(next.id);
  }
  async function renameScene(id) {
    const list = campaignMode ? campScenes : scenes;
    const sc = list.find(s => s.id === id);
    const res = await askPrompt('Renomear cena', [{ key: 'name', label: 'Nome da cena', value: sc?.name || 'Cena' }]);
    const n = res?.name;
    if (!n?.trim()) return;
    if (campaignMode && id !== activeScene) { saveSceneMeta(db, campaignId, uid, { ...sc, name: n.trim() }); return; }
    dispatch({ type: 'RENAME_SCENE', sceneId: id, name: n.trim() });
  }
  function switchScene(id) {
    if (campaignMode) { if (isMaster && id !== campState?.activeSceneId) fsSetActiveScene(db, campaignId, uid, id); return; }
    setActiveScene(id);
  }

  function toggleHide(id)    { const el = stateRef.current.elements.find(e => e.id === id); if (el) updateEl(id, { hidden: !el.hidden }); }
  function toggleLock(id)    { const el = stateRef.current.elements.find(e => e.id === id); if (el) updateEl(id, { locked: !el.locked }); }
  function toggleSpectre(id) { const el = stateRef.current.elements.find(e => e.id === id); if (el) updateEl(id, { spectre: !el.spectre }); }
  /* Duplicar traz a subárvore junto (spec 0011 AC-5). */
  function dupEl(id) {
    const { elements: els, scene: sc } = stateRef.current;
    const copies = dupSubtree(els, id, newElementId);
    if (copies.length) dispatch({ type: 'ADD_ELEMENTS', sceneId: sc.id, elements: copies });
  }
  /* Z-order dentro da camada (spec 0011 AC-6). */
  function bringToFront(id) {
    const { elements: els } = stateRef.current;
    const el = els.find(e => e.id === id); if (!el) return;
    const zs = els.filter(e => e.layerId === el.layerId).map(e => e.z ?? 0);
    updateEl(id, { z: Math.max(...zs) + 1 });
  }
  function sendToBack(id) {
    const { elements: els } = stateRef.current;
    const el = els.find(e => e.id === id); if (!el) return;
    const zs = els.filter(e => e.layerId === el.layerId).map(e => e.z ?? 0);
    updateEl(id, { z: Math.min(...zs) - 1 });
  }
  async function editLabel(id) {
    const el = stateRef.current.elements.find(e => e.id === id);
    const res = await askPrompt('Rótulo do elemento', [{ key: 'label', label: 'Rótulo', value: el?.label || '' }]);
    if (res !== null) updateEl(id, { label: (res.label || '').trim() || '?' });
  }
  /* Cria uma nota no ponto (x,y) do mundo pedindo o texto via modal in-app. */
  async function promptNote(x, y) {
    const res = await askPrompt('Nova nota', [{ key: 'text', label: 'Texto da nota', placeholder: 'Anotação visível no mapa', multiline: true }]);
    const txt = res?.text?.trim();
    if (txt) addEl({ id: newElementId(), type: 'note', layerId: 'layer-note', x, y, text: txt, hidden: false, locked: false, spectre: false });
  }
  /* A nota era um beco sem saída: criada, nunca editável — não tinha menu de contexto, o
   * duplo-clique só pingava e o clique-direito era engolido pelo `onElementDown`. Texto vazio
   * apaga a nota, senão ela vira um card amarelo em branco impossível de resolver. */
  async function editNote(id) {
    const el = stateRef.current.scene.elements?.find(e => e.id === id);
    if (!el) return;
    const res = await askPrompt('Editar nota', [{ key: 'text', label: 'Texto da nota', value: el.text || '', multiline: true }]);
    if (res == null) return;
    const txt = res.text.trim();
    if (txt) updateEl(id, { text: txt });
    else deleteEl(id);
  }
  /* "Cobrir tudo" = Fill Fog do Owlbear: liga a névoa infinita e **preserva as formas**.
   * Antes isto gravava `shapes: []` e apagava a preparação inteira — com o fluxo de
   * Cortar/Recobrir isso é destrutivo, porque as salas pré-desenhadas SÃO o trabalho. Com as
   * formas preservadas, uma sala já cortada continua sendo um buraco na névoa infinita, que é
   * exatamente o exemplo 1 da doc. */
  function coverFog() {
    const sc = stateRef.current.scene;
    upScene({ fog: { ...(sc.fog || { v: 2 }), v: 2, fillAll: true } });
  }
  /* "Revelar tudo" também não apaga nada: desliga a névoa infinita e marca toda forma como
   * cortada. Some tudo da vista do jogador, mas a geometria sobrevive para você recobrir
   * sala por sala depois. Para apagar de verdade, use o modo edição (Shift+clique, Delete). */
  function clearFog() {
    const sc = stateRef.current.scene;
    const shapes = (sc.fog?.shapes || []).map(s => (s.op === 'cut' ? s : { ...s, op: 'cut' }));
    upScene({ fog: { ...(sc.fog || { v: 2 }), v: 2, fillAll: false, shapes } });
  }
  function autoFog() {
    const { scene: sc, gridSize: gs } = stateRef.current;
    const cols = Math.ceil(sc.bgSize.w / gs), rows = Math.ceil(sc.bgSize.h / gs);
    const border = [
      { x: 0, y: 0, w: cols * gs, h: 2 * gs },
      { x: 0, y: (rows - 2) * gs, w: cols * gs, h: 2 * gs },
      { x: 0, y: 0, w: 2 * gs, h: rows * gs },
      { x: (cols - 2) * gs, y: 0, w: 2 * gs, h: rows * gs },
    ].map((r, i) => ({ id: `fog_b${Date.now()}${i}`, op: 'add', type: 'rect', ...r }));
    upScene({ fog: { v: 2, fillAll: !!sc.fog?.fillAll, shapes: [...(sc.fog?.shapes || []), ...border] } });
  }
  function alignSelected(axis, dir) {
    const { elements: els, selIds: sids, scene: sc } = stateRef.current;
    const sel = els.filter(el => sids.has(el.id));
    if (sel.length < 2) return;
    let v;
    if (dir === 'min') v = Math.min(...sel.map(t => t[axis]));
    else if (dir === 'max') v = Math.max(...sel.map(t => t[axis]));
    else v = sel.reduce((s, t) => s + t[axis], 0) / sel.length;
    sel.forEach(t => dispatch({ type: 'UPDATE_ELEMENT', sceneId: sc.id, id: t.id, patch: { [axis]: v } }));
  }
  function batchToggle(prop) {
    const { elements: els, selIds: sids, scene: sc } = stateRef.current;
    const sel = els.filter(el => sids.has(el.id));
    const anyActive = sel.some(el => el[prop]);
    sel.forEach(el => dispatch({ type: 'UPDATE_ELEMENT', sceneId: sc.id, id: el.id, patch: { [prop]: !anyActive } }));
  }
  function batchSetLayer(layerId) {
    const { elements: els, selIds: sids, scene: sc } = stateRef.current;
    els.filter(el => sids.has(el.id)).forEach(el =>
      dispatch({ type: 'UPDATE_ELEMENT', sceneId: sc.id, id: el.id, patch: { layerId } })
    );
  }
  /* spec 0010 AC-2/AC-3 — controles do mestre */
  async function openAssignMenu(elId) {
    const members = await getCampaignMembers(db, campaignId);
    setAssignMenu({ elId, members });
  }
  function cyclePerm(layerId, action = 'update') {
    const { scene: sc } = stateRef.current;
    const cur = action === 'create'
      ? !!sc.permissions?.[layerId]?.create
      : (sc.permissions?.[layerId]?.[action] || 'none');
    const next = nextPerm(action, cur);
    upScene({ permissions: { ...(sc.permissions || {}), [layerId]: { ...(sc.permissions?.[layerId] || {}), [action]: next } } });
  }
  function dupSelected() {
    const { elements: els, selIds: sids, scene: sc } = stateRef.current;
    // Descendente de outro selecionado não vira raiz (senão duplicaria 2×).
    const selected = [...sids];
    const covered = new Set();
    selected.forEach(id => subtreeIds(els, id).forEach(d => { if (d !== id) covered.add(d); }));
    const roots = selected.filter(id => !covered.has(id));
    const copies = roots.flatMap(id => dupSubtree(els, id, newElementId));
    if (copies.length) dispatch({ type: 'ADD_ELEMENTS', sceneId: sc.id, elements: copies });
  }

  useEffect(() => {
    function onKey(e) {
      const { selIds: sids, elements: els, scene: sc } = stateRef.current;
      // Jogador (spec 0010): sem atalhos destrutivos/de edição — só Esc limpa a seleção.
      if (viewer) { if (e.key === 'Escape') setSelIds(new Set()); return; }
      // Fog 0012: Enter fecha polígono pendente; Esc cancela; Delete apaga forma selecionada.
      if (fogPolyRef.current) {
        if (e.key === 'Enter') { e.preventDefault(); commitFogPoly(); return; }
        if (e.key === 'Escape') { fogPolyRef.current = null; setFogDraft(null); return; }
      }
      if (stateRef.current.fogSel?.size && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault(); removeFogShape(stateRef.current.fogSel); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); dispatch({ type: 'UNDO' }); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); dispatch({ type: 'REDO' }); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const lm = {};
        (stateRef.current.scene.layers || DEFAULT_LAYERS_V2).forEach(l => { lm[l.id] = l; });
        setSelIds(new Set(stateRef.current.elements.filter(el => {
          const l = lm[el.layerId]; return l?.visible && !l?.locked;
        }).map(el => el.id)));
        return;
      }
      // Atalhos de ferramenta (spec 0008 AC-6) — ignorados ao digitar e no modo jogador.
      const tag = e.target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && !viewer) {
        const hot = { v: 'select', t: 'token', d: 'draw', f: 'fog', r: 'reveal', n: 'note', e: 'text', m: 'measure' }[e.key.toLowerCase()];
        if (hot) { setTool(hot); return; }
        if (e.key.toLowerCase() === 'g') { setShowGrid(g => !g); return; }
      }
      if (sids.size === 0) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteEls([...sids]); setSelIds(new Set()); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        [...sids].forEach(id => {
          const el = els.find(e2 => e2.id === id);
          if (el) dispatch({ type: 'ADD_ELEMENT', sceneId: sc.id, element: { ...el, id: Date.now() + (Math.random() * 999 | 0), x: el.x + 30, y: el.y + 30 } });
        });
      }
      if (e.key === 'Escape') { setSelIds(new Set()); setLayerPickerOpen(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line

  function onElementDown(e, el) {
    modKeyRef.current = !!(e.ctrlKey || e.metaKey);
    const { selIds: sids, elements: els, scene: sc } = stateRef.current;
    const lm = {};
    (sc.layers || DEFAULT_LAYERS_V2).forEach(l => { lm[l.id] = l; });
    const layerLocked = !!(lm[el.layerId]?.locked);
    e.stopPropagation();
    elementDownRef.current = true;
    // Toque: registra o dedo e prende os eventos ao container (drag sobrevive ao sair da
    // viewport — some com o bug de "solta ao encostar na toolbar"). Se virar 2 dedos, o
    // container assume o pinch e este arrasto é cancelado no onDown.
    if (e.pointerId != null) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { containerRef.current?.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    }
    if (e.button === 2) return;
    // Jogador (spec 0010 AC-1): só interage com o que as permissões da cena autorizam.
    if (viewer && !canMove(sc, el, uid, false)) return;
    if (e.shiftKey) {
      setSelIds(prev => { const n = new Set(prev); n.has(el.id) ? n.delete(el.id) : n.add(el.id); return n; });
      return;
    }
    // Camada/elemento travado (spec 0019 AC-1/AC-4): não seleciona nem arrasta por clique
    // — coerente com o marquee, que já ignora travados —, mas dá feedback em vez de silêncio.
    if (el.locked || layerLocked) {
      showFlash(layerLocked
        ? `🔒 Camada "${lm[el.layerId]?.name || ''}" travada — destrave no painel para editar`
        : '🔒 Elemento travado — destrave para editar');
      return;
    }
    if (!sids.has(el.id)) setSelIds(new Set([el.id]));
    {
      const { x: sx, y: sy } = clientXY(e); const wp = screenToWorld(sx, sy);
      const sel = sids.has(el.id) ? sids : new Set([el.id]);
      const origins = {};
      const draggableIds = [];
      els.filter(e2 => sel.has(e2.id)).forEach(e2 => {
        if (e2.locked || lm[e2.layerId]?.locked) return;
        origins[e2.id] = { ox: wp.x - e2.x, oy: wp.y - e2.y };
        draggableIds.push(e2.id);
      });
      // Auto-grudar (spec 0011): a subárvore acompanha o pai no arrasto, MAS filhos travados
      // ficam parados (spec 0019 AC-4) — não driblam o cadeado por estarem anexados.
      const expanded = new Set(draggableIds);
      draggableIds.forEach(id => subtreeIds(els, id).forEach(d => expanded.add(d)));
      expanded.forEach(id => {
        if (origins[id]) return;
        const e2 = els.find(x => x.id === id);
        if (e2 && !e2.locked && !lm[e2.layerId]?.locked) origins[id] = { ox: wp.x - e2.x, oy: wp.y - e2.y };
      });
      dragRef.current = { ids: [...expanded].filter(id => origins[id]), rootIds: draggableIds, origins, positions: null };
    }
  }

  /* Entra no gesto de 2 dedos: cancela qualquer ação de 1 dedo em andamento SEM efetivar
     (o elemento volta à última posição salva) e memoriza distância/centro/escala iniciais. */
  function beginPinch() {
    dragRef.current = null; drawRef.current = null; boxRef.current = null; setBoxSel(null);
    fogRef.current = false; fogDragRef.current = null; fogFreeRef.current = null; setFogDraft(null);
    measureRef.current = null; setMeasureLine(null);
    resizeRef.current = null; rotateRef.current = null; panRef.current = null;
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const r = containerRef.current.getBoundingClientRect();
    pinchRef.current = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top,
      startScale: stateRef.current.scale,
      startPan: { ...stateRef.current.pan },
    };
    if (viewer) setFollowMaster(false); // gesto de navegação solta o Sync View (AC-6)
  }

  /* Passo do pinch: zoom pela razão de distância (centrado no ponto médio inicial) +
     pan pelo deslocamento do centro entre os dois dedos. */
  function applyPinch() {
    const pin = pinchRef.current; if (!pin) return;
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const r = containerRef.current.getBoundingClientRect();
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const midX = (a.x + b.x) / 2 - r.left, midY = (a.y + b.y) / 2 - r.top;
    const ns = Math.max(0.08, Math.min(6, pin.startScale * (dist / (pin.dist || 1))));
    // mantém o ponto sob o centro do gesto fixo enquanto escala, e soma o arrasto do centro
    const px = pin.startPan.x, py = pin.startPan.y, s0 = pin.startScale;
    setPan({
      x: midX - (pin.cx - px) * ns / s0 + (midX - pin.cx),
      y: midY - (pin.cy - py) * ns / s0 + (midY - pin.cy),
    });
    setScale(ns);
  }

  function onDown(e) {
    modKeyRef.current = !!(e.ctrlKey || e.metaKey);
    // Toque: contabiliza o dedo. Ao chegar no 2º, o container assume o gesto de pinch/pan.
    if (e.pointerId != null) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
      if (pointersRef.current.size >= 2) { elementDownRef.current = false; beginPinch(); return; }
    }
    if (elementDownRef.current) { elementDownRef.current = false; return; }
    setCtxMenu(null); setLayerPickerOpen(false);
    const { tool: t } = stateRef.current;
    const { x: sx, y: sy } = clientXY(e);
    const wp = screenToWorld(sx, sy);

    if (e.button === 2) { e.preventDefault(); if (!viewer) setCtxMenu({ x: e.clientX, y: e.clientY, type: 'map' }); return; }
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panRef.current = { mx: e.clientX, my: e.clientY, ox: stateRef.current.pan.x, oy: stateRef.current.pan.y }; return;
    }
    if (e.button !== 0) return;

    if (t === 'select') {
      if (!e.shiftKey) setSelIds(new Set());
      boxRef.current = { sx, sy };
      setBoxSel({ x1: sx, y1: sy, x2: sx, y2: sy });
      return;
    }
    if (t === 'fog' || t === 'reveal') {
      const op = t === 'fog' ? 'add' : 'cut';
      const fs = stateRef.current.fogShape;
      if (stateRef.current.fogEdit) { // sub-modo edição (spec 0012 AC-7)
        const hitS = hitFogShape(stateRef.current.scene.fog?.shapes || [], wp.x, wp.y);
        // Shift+clique acumula (necessário para o Join); clique simples troca a seleção.
        setFogSel(prev => {
          if (!hitS) return e.shiftKey ? prev : new Set();
          if (!e.shiftKey) return new Set([hitS.id]);
          const next = new Set(prev);
          if (next.has(hitS.id)) next.delete(hitS.id); else next.add(hitS.id);
          return next;
        });
        return;
      }
      if (fs === 'poly') { // clique-a-clique (AC-2); fecha perto do 1º ponto
        const pend = fogPolyRef.current;
        if (!pend) fogPolyRef.current = { op, pts: [{ x: wp.x, y: wp.y }] };
        else {
          const first = pend.pts[0];
          if (pend.pts.length >= 3 && Math.hypot(wp.x - first.x, wp.y - first.y) < 12 / stateRef.current.scale) { commitFogPoly(); return; }
          pend.pts.push({ x: wp.x, y: wp.y });
        }
        setFogDraft({ type: 'poly', op, pts: [...fogPolyRef.current.pts] });
        return;
      }
      fogRef.current = true; fogModeRef.current = t === 'fog' ? 'add' : 'del';
      if (fs === 'free') { // traço livre (AC-3) — commit no onUp
        fogFreeRef.current = { op, pts: [{ x: wp.x, y: wp.y }] };
        setFogDraft({ type: 'free', op, pts: [...fogFreeRef.current.pts] });
        return;
      }
      fogDragRef.current = { kind: fs === 'circle' ? 'circle' : 'rect', wx: wp.x, wy: wp.y, base: [...(stateRef.current.scene.fog?.shapes || [])], shapeId: 'fog_' + Date.now() };
      applyFogDrag(wp.x, wp.y);
    } else if (t === 'token') {
      const sn = snapToken(wp.x, wp.y);
      addEl({ id: newElementId(), type: 'token', layerId: 'layer-character', x: sn.x, y: sn.y, color: tokColor, label: tokLabel || '?', size: Math.max(18, Math.round(stateRef.current.gridSize * tokSize)), imageId: tokImageId, conditions: [], hidden: false, locked: false, spectre: false });
    } else if (t === 'draw') {
      drawRef.current = { shape: drawMode, color: drawColor, strokeWidth: drawWidth, fill: drawFill, fillOpacity: drawFillOpacity, strokeStyle: drawStroke, pts: [{ x: wp.x, y: wp.y }] };
      setDrawLive({ ...drawRef.current, pts: [...drawRef.current.pts] });
    } else if (t === 'note') {
      promptNote(wp.x, wp.y);
    } else if (t === 'text') {
      // Clicar cria o item e já abre o editor in-place (doc Owlbear /docs/text).
      const id = newElementId();
      addEl({ id, type: 'text', layerId: 'layer-note', x: Math.round(wp.x), y: Math.round(wp.y),
        text: '', ...DEFAULT_TEXT_STYLE, hidden: false, locked: false, spectre: false });
      setTextEdit(id);
    } else if (t === 'measure') {
      measureRef.current = { x1: wp.x, y1: wp.y }; setMeasureLine({ x1: wp.x, y1: wp.y, x2: wp.x, y2: wp.y });
    }
  }

  function onMove(e) {
    modKeyRef.current = !!(e.ctrlKey || e.metaKey);
    // Toque: atualiza a posição do dedo; se há gesto de 2 dedos, faz zoom+pan e sai.
    if (e.pointerId != null && pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinchRef.current) { applyPinch(); return; }
    if (panRef.current) {
      const { mx, my, ox, oy } = panRef.current;
      if (viewer) setFollowMaster(false); // pan manual solta o Sync View (AC-6)
      setPan({ x: ox + e.clientX - mx, y: oy + e.clientY - my }); return;
    }
    // Polígono de fog pendente: preview do próximo segmento até o cursor (spec 0012 AC-2).
    if (fogPolyRef.current && !fogRef.current) {
      const { x: sx, y: sy } = clientXY(e); const wp = screenToWorld(sx, sy);
      setFogDraft({ type: 'poly', op: fogPolyRef.current.op, pts: [...fogPolyRef.current.pts], cursor: wp });
      return;
    }
    // Apontador (spec 0010 AC-5): publica a posição contínua, sem depender de drag.
    if (stateRef.current.tool === 'pointer') {
      const { x: sx, y: sy } = clientXY(e); const wp = screenToWorld(sx, sy);
      livePubRef.current?.publish({ pointer: { x: wp.x, y: wp.y } });
      return;
    }
    if (resizeRef.current) {
      const { x: sx, y: sy } = clientXY(e); const wp = screenToWorld(sx, sy);
      const { corner, startMouse, startEl } = resizeRef.current;
      let { x, y, w, h } = startEl;
      const dx = wp.x - startMouse.wx, dy = wp.y - startMouse.wy;
      if (corner.includes('E')) w = Math.max(20, startEl.w + dx);
      if (corner.includes('S')) h = Math.max(20, startEl.h + dy);
      if (corner.includes('W')) { x = startEl.x + dx; w = Math.max(20, startEl.w - dx); if (w === 20) x = startEl.x + startEl.w - 20; }
      if (corner.includes('N')) { y = startEl.y + dy; h = Math.max(20, startEl.h - dy); if (h === 20) y = startEl.y + startEl.h - 20; }
      resizeRef.current.live = { x, y, w, h };
      scheduleDragRender(); return;
    }
    if (rotateRef.current) {
      const { x: sx, y: sy } = clientXY(e);
      const { cx, cy, startAngle, startRotation } = rotateRef.current;
      const angle = Math.atan2(sy - cy, sx - cx) * 180 / Math.PI;
      rotateRef.current.liveRotation = startRotation + (angle - startAngle);
      scheduleDragRender(); return;
    }
    if (dragRef.current) {
      const { x: sx, y: sy } = clientXY(e); const wp = screenToWorld(sx, sy);
      const { ids, origins } = dragRef.current;
      const positions = {};
      ids.forEach(id => {
        const orig = origins[id]; if (!orig) return;
        const el2 = stateRef.current.elements.find(x => x.id === id);
        const sn = el2?.type === 'token'
          ? snapToken(wp.x - orig.ox, wp.y - orig.oy)
          : snap(wp.x - orig.ox, wp.y - orig.oy);
        positions[id] = { x: sn.x, y: sn.y };
      });
      dragRef.current.positions = positions;
      // Jogador movendo o próprio token: sync ao vivo com throttle ~300ms (AC-1);
      // subárvore filtrada pelo canMove (rules negariam o resto).
      if (viewer && campaignMode && Date.now() - moveThrottleRef.current > 300) {
        moveThrottleRef.current = Date.now();
        const sid = stateRef.current.scene.id;
        Object.entries(positions).forEach(([id, pos]) => {
          const e2 = stateRef.current.elements.find(x => x.id === id);
          if (e2 && canMove(stateRef.current.scene, e2, uid, false)) updateElementPos(db, campaignId, sid, id, pos);
        });
      }
      scheduleDragRender(); return;
    }
    if (boxRef.current) {
      const { x: sx, y: sy } = clientXY(e);
      setBoxSel(prev => prev ? { ...prev, x2: sx, y2: sy } : null); return;
    }
    if (fogRef.current) {
      const { x: sx, y: sy } = clientXY(e); const wp = screenToWorld(sx, sy);
      if (fogFreeRef.current) { // traço livre acumula pontos; commit no onUp (AC-3)
        fogFreeRef.current.pts.push({ x: wp.x, y: wp.y });
        setFogDraft({ type: 'free', op: fogFreeRef.current.op, pts: [...fogFreeRef.current.pts] });
        return;
      }
      applyFogDrag(wp.x, wp.y); return;
    }
    if (drawRef.current) {
      const { x: sx, y: sy } = clientXY(e); const wp = screenToWorld(sx, sy);
      const d = drawRef.current;
      if (d.shape === 'free') d.pts.push({ x: wp.x, y: wp.y });
      else d.pts[1] = { x: wp.x, y: wp.y };
      setDrawLive({ ...d, pts: [...d.pts] }); return;
    }
    if (measureRef.current) {
      const { x: sx, y: sy } = clientXY(e); const wp = screenToWorld(sx, sy);
      setMeasureLine({ ...measureRef.current, x2: wp.x, y2: wp.y });
      // Régua compartilhada (AC-5)
      livePubRef.current?.publish({ ruler: { x1: measureRef.current.x1, y1: measureRef.current.y1, x2: wp.x, y2: wp.y } });
    }
  }

  function onUp(e) {
    modKeyRef.current = false; // o override do snap vale só durante o gesto
    // Toque: baixa o dedo e solta a captura. Encerrando o pinch, não retoma ação de 1 dedo
    // (evita salto) — o dedo restante fica ocioso até nova toque.
    if (e.pointerId != null) {
      pointersRef.current.delete(e.pointerId);
      try { e.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    }
    if (pinchRef.current) {
      if (pointersRef.current.size < 2) pinchRef.current = null;
      return;
    }
    if (dragRafRef.current) { cancelAnimationFrame(dragRafRef.current); dragRafRef.current = 0; } // o commit abaixo já re-renderiza
    const wasInteracting = !!dragRef.current || !!resizeRef.current || !!rotateRef.current;
    if (resizeRef.current?.live) {
      dispatch({ type: 'UPDATE_ELEMENT', sceneId: stateRef.current.scene.id, id: resizeRef.current.elId, patch: resizeRef.current.live });
    }
    if (rotateRef.current && rotateRef.current.liveRotation !== rotateRef.current.startRotation) {
      dispatch({ type: 'UPDATE_ELEMENT', sceneId: stateRef.current.scene.id, id: rotateRef.current.elId, patch: { rotation: rotateRef.current.liveRotation } });
    }
    if (dragRef.current?.positions) {
      dispatch({ type: 'MOVE_ELEMENTS', sceneId: stateRef.current.scene.id, positions: dragRef.current.positions });
      // Jogador: posição final no soltar — só dos elementos que as permissões autorizam (AC-1).
      if (viewer && campaignMode) {
        const sid = stateRef.current.scene.id;
        Object.entries(dragRef.current.positions).forEach(([id, pos]) => {
          const e2 = stateRef.current.elements.find(x => x.id === id);
          if (e2 && canMove(stateRef.current.scene, e2, uid, false)) updateElementPos(db, campaignId, sid, id, pos);
        });
      }
      // Auto-grudar no soltar (spec 0011, só editor): 1 raiz arrastada decide grudar/desanexar.
      const roots = dragRef.current.rootIds || [];
      if (!viewer && roots.length === 1) {
        const els = stateRef.current.elements;
        const el = els.find(e2 => e2.id === roots[0]);
        const pos = dragRef.current.positions[roots[0]];
        if (el && pos) {
          const moved = { ...el, x: pos.x, y: pos.y };
          const a = anchorOf(moved);
          const target = findAttachTarget(stateRef.current.scene, els, moved, a.x, a.y);
          const newParent = target && !wouldCycle(els, el.id, target.id) ? target.id : null;
          if ((el.parentId ?? null) !== newParent) updateEl(el.id, { parentId: newParent });
        }
      }
    }
    if (boxRef.current && boxSel && !wasInteracting) {
      const { x1, y1, x2, y2 } = boxSel;
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
      const { pan: p, scale: s, elements: els, scene: sc } = stateRef.current;
      const lm = {}; (sc.layers || DEFAULT_LAYERS_V2).forEach(l => { lm[l.id] = l; });
      const hit = new Set();
      els.forEach(el => {
        const l = lm[el.layerId]; if (!l?.visible || l?.locked) return;
        const cx = el.w != null ? el.x + el.w / 2 : el.x;
        const cy = el.w != null ? el.y + (el.h || 0) / 2 : el.y;
        const ex = cx * s + p.x, ey = cy * s + p.y;
        if (ex >= minX && ex <= maxX && ey >= minY && ey <= maxY) hit.add(el.id);
      });
      if (e?.shiftKey) setSelIds(prev => { const n = new Set(prev); hit.forEach(id => n.add(id)); return n; });
      else setSelIds(hit);
    }
    if (drawRef.current) {
      const d = drawRef.current;
      if (d.pts.length > 1) {
        const xs = d.pts.map(p => p.x), ys = d.pts.map(p => p.y);
        const minX = Math.min(...xs), minY = Math.min(...ys);
        const w = Math.max(d.strokeWidth + 2, Math.max(...xs) - minX);
        const h = Math.max(d.strokeWidth + 2, Math.max(...ys) - minY);
        addEl({
          id: newElementId(), type: 'drawing', layerId: 'layer-drawing', x: minX, y: minY, w, h,
          shape: d.shape, color: d.color, strokeWidth: d.strokeWidth,
          fill: d.fill || 'none', fillOpacity: d.fillOpacity ?? 0.25, strokeStyle: d.strokeStyle || 'solid',
          points: d.pts.map(p => ({ x: Math.round(p.x - minX), y: Math.round(p.y - minY) })),
          hidden: false, locked: false, spectre: false,
        });
      }
      drawRef.current = null; setDrawLive(null);
    }
    // Fog 0012: commit do traço livre (AC-3) e poda pós-arrasto rect/círculo (AC-6).
    if (fogFreeRef.current) {
      const { op, pts } = fogFreeRef.current;
      fogFreeRef.current = null; setFogDraft(null);
      commitFogShape(op, 'free', strokeToPoly(pts, 4));
    } else if (fogRef.current && fogDragRef.current) {
      pruneFog();
    }
    elementDownRef.current = false;
    panRef.current = null; dragRef.current = null; resizeRef.current = null; rotateRef.current = null;
    if (measureRef.current) { livePubRef.current?.publish({ ruler: null }); setMeasureLine(null); } // spec 0019 AC-6: régua não gruda
    fogRef.current = false; fogDragRef.current = null; measureRef.current = null; boxRef.current = null; setBoxSel(null);
  }

  /* Duplo-clique: fecha polígono de fog pendente (spec 0012 AC-2) ou pinga (spec 0010 AC-4). */
  function onDoubleClick(e) {
    if (fogPolyRef.current) { commitFogPoly(); return; }
    if (!campaignMode) return;
    const { x: sx, y: sy } = clientXY(e);
    const wp = screenToWorld(sx, sy);
    livePubRef.current?.publish({ ping: { x: wp.x, y: wp.y, at: Date.now() } });
  }

  /* Zoom pela roda: listener NÃO-passivo (spec 0019 AC-8) — o onWheel do React é passivo,
     então preventDefault era ignorado e a página rolava junto. Centra no cursor. */
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const handler = (e) => {
      e.preventDefault();
      if (viewer) setFollowMaster(false);
      const r = node.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const { pan: p, scale: s } = stateRef.current;
      const ns = Math.max(0.08, Math.min(6, s * (e.deltaY < 0 ? 1.12 : 0.89)));
      setPan({ x: sx - (sx - p.x) * ns / s, y: sy - (sy - p.y) * ns / s });
      setScale(ns);
    };
    node.addEventListener('wheel', handler, { passive: false });
    return () => node.removeEventListener('wheel', handler);
  }, [viewer]);

  /* Zoom centrado num ponto de tela (px do container). Usado por +/− (centro da viewport). */
  function zoomAt(px, py, factor) {
    const { pan: p, scale: s } = stateRef.current;
    const ns = Math.max(0.08, Math.min(6, s * factor));
    setPan({ x: px - (px - p.x) * ns / s, y: py - (py - p.y) * ns / s });
    setScale(ns);
  }
  function zoomButton(factor) {
    const r = containerRef.current?.getBoundingClientRect();
    zoomAt((r?.width || 0) / 2, (r?.height || 0) / 2, factor);
  }
  /* Enquadra o mapa (bgSize) dentro do container — botão "home" (AC-8). */
  function fitToScreen() {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) { setScale(1); setPan({ x: 60, y: 60 }); return; }
    const { w, h } = stateRef.current.scene.bgSize || { w: mapW, h: mapH };
    const ns = Math.max(0.08, Math.min(6, Math.min((r.width - 80) / w, (r.height - 80) / h)));
    setScale(ns);
    setPan({ x: (r.width - w * ns) / 2, y: (r.height - h * ns) / 2 });
  }

  /* Medição pelo modo da cena (xadrez/alternada/euclidiana/manhattan/hex) — antes era
   * Math.hypot fixo, ignorando `grid.measurement`. */
  const measured = measureLine
    ? measureGrid(scene, { x: measureLine.x1, y: measureLine.y1 }, { x: measureLine.x2, y: measureLine.y2 })
    : null;
  const measureDist = measured ? measured.cells : 0;
  const fog        = scene.fog || { v: 2, fillAll: false, shapes: [] };
  const asViewer   = viewer || previewPlayer; // spec 0012 AC-5 (preview visão do jogador)
  const gridHalf   = 50000; // world-px padding in each direction for "infinite" grid illusion
  /* Tile do pattern conforme o tipo (quadrado ou favo de mel) e fase que traz a origem do
   * mundo + o offset de alinhamento para cima de uma linha da grade. */
  const gridTile   = gridPattern(gridType(scene), gridSize);
  const gOff       = gridOffset(scene);
  const gridPatX   = ((gridHalf + gOff.x) % gridTile.w + gridTile.w) % gridTile.w;
  const gridPatY   = ((gridHalf + gOff.y) % gridTile.h + gridTile.h) % gridTile.h;

  /* Pilha de render — derivada de `layerZIndex` em mapHelpers.js, com teste que trava a
   * ordem. Ver o comentário longo lá: fixar esses números foi o que deixava a névoa abaixo
   * dos tokens (inimigo em sala coberta aparecia para o jogador). */
  const Z_GRID    = gridZIndex();
  const Z_FOG     = fogZIndex(layers.length);
  const Z_OVERLAY = overlayZIndex(layers.length);
  const cursor     = panRef.current ? 'grabbing' : tool === 'fog' || tool === 'reveal' ? 'cell' : tool === 'token' || tool === 'note' || tool === 'measure' || tool === 'draw' ? 'crosshair' : 'default';
  const singleSel  = selIds.size === 1 ? elements.find(el => el.id === [...selIds][0]) : null;
  const textEditEl = textEdit ? elements.find(el => el.id === textEdit) : null;
  const anyHidden  = selIds.size > 0 && [...selIds].some(id => elements.find(e => e.id === id)?.hidden);
  const anyLocked  = selIds.size > 0 && [...selIds].some(id => elements.find(e => e.id === id)?.locked);
  const hasImgEls  = elements.some(el => el.type === 'image');
  /* Modo campanha: enquanto o 1º snapshot do Firestore não chegou (ou trocou de cena e os
   * elementos ainda não hidrataram), mostra loading em vez da cena default vazia do reducer. */
  const hydrating  = campaignMode && !!db && (!stateLoaded || (!!campState?.activeSceneId && remoteEls === null));

  const TB = active => ({
    width: 38, height: 38, borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 18, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'rgba(168,85,247,0.2)' : 'transparent',
    color: active ? '#a855f7' : 'rgba(255,255,255,0.5)',
    boxShadow: active ? 'inset 0 0 0 1px rgba(168,85,247,0.5)' : 'none',
    transition: 'all 0.12s',
  });
  const topBtn = { padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' };
  const actBtn = active => ({ width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)', color: active ? '#a855f7' : 'rgba(255,255,255,0.6)', transition: 'all 0.12s' });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#2e2e42', display: 'flex', flexDirection: 'column', userSelect: 'none', fontFamily: 'Inter,system-ui,sans-serif' }}
      onClick={() => { setCtxMenu(null); setLayerPickerOpen(false); }}>
      <style>{`@keyframes rain{0%{transform:translateY(-10px) rotate(15deg);opacity:0}10%{opacity:0.7}90%{opacity:0.7}100%{transform:translateY(110vh) rotate(15deg);opacity:0}}@keyframes snow{0%{transform:translateY(-10px) translateX(0);opacity:0}10%{opacity:0.85}50%{transform:translateY(50vh) translateX(20px)}90%{opacity:0.85}100%{transform:translateY(110vh) translateX(-10px);opacity:0}}@keyframes fogDrift{0%{transform:translateX(-5%)}50%{transform:translateX(5%)}100%{transform:translateX(-5%)}}.map-toolbar-scroll::-webkit-scrollbar{width:0;height:0;display:none}@keyframes mapspin{to{transform:rotate(360deg)}}.map-top-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex-shrink:1}@media(max-width:720px){.map-top-hide{display:none!important}}@media(max-width:560px){.map-btn-label{display:none}}`}</style>

      {/* TOP BAR */}
      <div style={{ height: 48, background: '#22222f', borderBottom: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', flexShrink: 0, zIndex: 10 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, transition: 'color 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
            title="Voltar"><MapIcon name="back" size={15} /> Voltar</button>
        )}
        <div className="map-top-hide" style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        <span className="map-top-hide" style={{ fontFamily: 'Cinzel Decorative,serif', fontSize: 11, color: '#c9a84c', letterSpacing: 2, whiteSpace: 'nowrap' }}>⚔ NEXUS</span>
        <div className="map-top-hide" style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        <span className="map-top-hide" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{campaignMode ? (viewer ? 'Mesa tática · ao vivo' : 'Mesa tática') : 'Editor de Mapas'}</span>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        <span className="map-top-name" style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{scene.name}</span>
        <div style={{ flex: 1 }} />
        {!viewer && (<>
        <button disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })} title="Desfazer" style={{ ...topBtn, opacity: canUndo ? 1 : 0.3 }}><MapIcon name="undo" size={15} /> <span className="map-btn-label">Desfazer</span></button>
        <button disabled={!canRedo} onClick={() => dispatch({ type: 'REDO' })} title="Refazer" style={{ ...topBtn, opacity: canRedo ? 1 : 0.3 }}><MapIcon name="redo" size={15} /> <span className="map-btn-label">Refazer</span></button>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        <button style={topBtn} title="Adicionar Imagem" onClick={() => bgInputRef.current?.click()}><MapIcon name="image" size={15} /> <span className="map-btn-label">Adicionar Imagem</span></button>
        <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { loadBg(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={replaceInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { replaceImage(e.target.files?.[0]); e.target.value = ''; }} />
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        </>)}
        <button title="Enquadrar o mapa na tela" style={{ ...topBtn, padding: '5px 8px' }} onClick={fitToScreen}><MapIcon name="fit" /></button>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', minWidth: 36 }}>{Math.round(scale * 100)}%</span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* LEFT PANEL */}
        {showLeft && !viewer && (
          <div style={{ width: 210, flexShrink: 0, background: '#22222f', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ flex: 1, fontFamily: 'Cinzel,serif', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Cenas</span>
              <button onClick={addScene} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }} title="Nova cena">+</button>
              <button onClick={() => setShowLeft(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '2px 2px', display: 'flex', alignItems: 'center' }} title="Recolher painel"><MapIcon name="collapseL" size={16} /></button>
            </div>
            <div style={{ display: 'flex', overflowX: 'auto', padding: '0 8px 8px', gap: 6, flexShrink: 0 }}>
              {(campaignMode ? campScenes : scenes).map(sc => {
                const firstImgEl = ((sc.id === activeScene ? elements : sc.elements) || []).find(el => el.type === 'image');
                const thumbSrc = firstImgEl ? imageStore[firstImgEl.imageId] : bgImages[sc.id];
                return (
                  <div key={sc.id} onClick={() => switchScene(sc.id)}
                    style={{ flexShrink: 0, width: 72, borderRadius: 6, cursor: 'pointer', border: `1px solid ${sc.id === activeScene ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.06)'}`, background: sc.id === activeScene ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
                    <div style={{ aspectRatio: '16/9', background: '#1c1c28', position: 'relative', overflow: 'hidden' }}>
                      {thumbSrc ? <img src={thumbSrc} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} /> : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2, color: '#fff' }}><MapIcon name="image" size={16} /></div>}
                      {sc.id === activeScene && <div style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: '#a855f7' }} />}
                    </div>
                    <div style={{ padding: '3px 4px 4px', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <span style={{ flex: 1, fontSize: 9, color: sc.id === activeScene ? '#fff' : 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name}</span>
                      <button onClick={e => { e.stopPropagation(); renameScene(sc.id); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '1px 2px', display: 'flex' }} title="Renomear" aria-label="Renomear cena"><MapIcon name="draw" size={12} /></button>
                      {(campaignMode ? campScenes : scenes).length > 1 && <button onClick={e => { e.stopPropagation(); deleteScene(sc.id); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '1px 2px', display: 'flex' }} title="Excluir" aria-label="Excluir cena"><MapIcon name="close" size={12} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
            <div style={{ padding: '8px 12px 4px', flexShrink: 0 }}>
              <span style={{ fontFamily: 'Cinzel,serif', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Camadas</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
              {[...layers].reverse().map(layer => {
                const cnt = elements.filter(el => el.layerId === layer.id).length;
                const idx = layers.findIndex(l => l.id === layer.id);
                const lbtn = { background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)' };
                return (
                  <div key={layer.id} style={{ marginBottom: 4, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 6px' }}>
                      <button onClick={() => dispatch({ type: 'SET_LAYER_PROP', sceneId: scene.id, layerId: layer.id, prop: 'visible', value: !layer.visible })}
                        style={{ ...lbtn, opacity: layer.visible ? 1 : 0.35 }} title={layer.visible ? 'Ocultar camada' : 'Mostrar camada'}><MapIcon name={layer.visible ? 'eye' : 'eyeOff'} size={15} /></button>
                      <button onClick={() => dispatch({ type: 'SET_LAYER_PROP', sceneId: scene.id, layerId: layer.id, prop: 'locked', value: !layer.locked })}
                        style={{ ...lbtn, opacity: layer.locked ? 1 : 0.35, color: layer.locked ? '#fbbf24' : 'rgba(255,255,255,0.7)' }} title={layer.locked ? 'Destravar camada' : 'Travar camada'}><MapIcon name={layer.locked ? 'lock' : 'unlock'} size={15} /></button>
                      {/* Só o eixo MOVER tem UI, de propósito.
                          Cheguei a expor "criar" e "apagar" aqui (doc Owlbear /docs/permissions),
                          mas revertido: o jogador NÃO tem caminho de escrita para criar/apagar —
                          `publishElements` roda só no efeito `isMaster`, e a única escrita do
                          jogador é `updateElementPos` (x/y). Ligar esses eixos daria a ferramenta
                          e o objeto sumiria no próximo snapshot. Expor controle que não funciona é
                          pior que não ter controle. Reabrir junto com o caminho de escrita do
                          jogador — ver STATE. */}
                      {campaignMode && !viewer && (() => {
                        const p = scene.permissions?.[layer.id]?.update || 'none';
                        const icon = p === 'owner' ? 'person' : p === 'all' ? 'group' : 'noentry';
                        const label = PERM_LABELS.update[p];
                        return (
                          <button onClick={() => cyclePerm(layer.id, 'update')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', opacity: p === 'none' ? 0.3 : 1, color: 'rgba(255,255,255,0.7)' }}
                            title={`Jogadores: ${label} (clique para alternar)`}
                            aria-label={`Permissão da camada ${layer.name}: ${label}`}><MapIcon name={icon} size={14} /></button>
                        );
                      })()}
                      <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.65)', marginLeft: 2 }}>{layer.name}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginRight: 2 }}>{cnt}</span>
                      <button onClick={() => moveLayer(layer.id, +1)} disabled={idx >= layers.length - 1}
                        style={{ ...lbtn, opacity: idx >= layers.length - 1 ? 0.15 : 0.6, cursor: idx >= layers.length - 1 ? 'default' : 'pointer' }} title="Subir camada"><MapIcon name="chevUp" size={13} /></button>
                      <button onClick={() => moveLayer(layer.id, -1)} disabled={idx <= 0}
                        style={{ ...lbtn, opacity: idx <= 0 ? 0.15 : 0.6, cursor: idx <= 0 ? 'default' : 'pointer' }} title="Descer camada"><MapIcon name="chevDown" size={13} /></button>
                    </div>
                    <div style={{ padding: '0 6px 4px' }}>
                      <input type="range" min={0} max={1} step={0.05} value={layer.opacity}
                        onChange={e => dispatch({ type: 'SET_LAYER_PROP', sceneId: scene.id, layerId: layer.id, prop: 'opacity', value: +e.target.value, coalesceKey: 'op:' + layer.id })}
                        style={{ width: '100%', height: 3, cursor: 'pointer', accentColor: '#a855f7' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Alça para reabrir o painel recolhido (spec 0019 AC-13) */}
        {!showLeft && !viewer && (
          <button onClick={() => setShowLeft(true)} title="Mostrar cenas e camadas"
            style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 30, width: 22, height: 64, borderRadius: '0 10px 10px 0', border: '1px solid rgba(255,255,255,0.14)', borderLeft: 'none', background: 'rgba(38,38,62,0.92)', backdropFilter: 'blur(16px)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapIcon name="expandR" size={15} />
          </button>
        )}

        {/* MAP CANVAS */}
        <div ref={containerRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor, touchAction: 'none' }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          onDoubleClick={onDoubleClick}
          onContextMenu={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const assetId = e.dataTransfer.getData('application/x-nexus-asset'); // spec 0013 AC-3
            if (assetId) {
              const asset = assets.find(a => a.id === assetId);
              if (asset) { const { x: sx, y: sy } = clientXY(e); placeAsset(asset, screenToWorld(sx, sy)); }
              return;
            }
            loadBg(e.dataTransfer.files?.[0]);
          }} onDragOver={e => e.preventDefault()}>

          {!hasImgEls && !bgImages[scene.id] && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, pointerEvents: 'none' }}>
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.14 }} xmlns="http://www.w3.org/2000/svg">
                <defs><pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.2" fill="#fff" /></pattern></defs>
                <rect width="100%" height="100%" fill="url(#dots)" />
              </svg>
              <div style={{ opacity: 0.15, color: '#fff' }}><MapIcon name="image" size={56} /></div>
              {viewer ? (
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: 13, letterSpacing: 3, color: 'rgba(255,255,255,0.12)' }}>AGUARDANDO O MESTRE PREPARAR A CENA</div>
              ) : (<>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: 13, letterSpacing: 3, color: 'rgba(255,255,255,0.12)' }}>ARRASTE UMA IMAGEM AQUI</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.08)' }}>ou clique em "Adicionar Imagem" acima</div>
              </>)}
            </div>
          )}

          {/* spec 0010: viewer interage por elemento (canMove) — sem pointer-events global */}
          <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: '0 0', width: mapW, height: mapH }}>

            {/* IMAGE ELEMENTS */}
            {elements.filter(el => el.type === 'image' && (!asViewer || (!el.hidden && !el.spectre))).sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map(img => {
              const layer = layers.find(l => l.id === img.layerId);
              if (layer && !layer.visible) return null;
              const src = imageStore[img.imageId];
              if (!src) return null;
              const isSel = selIds.has(img.id);
              const isSingleSel = isSel && selIds.size === 1;
              const livePos    = dragRef.current?.positions?.[img.id];
              const liveResize = resizeRef.current?.elId === img.id ? resizeRef.current.live : null;
              const liveRot    = rotateRef.current?.elId === img.id ? rotateRef.current.liveRotation : (img.rotation || 0);
              const px = liveResize?.x ?? livePos?.x ?? img.x;
              const py = liveResize?.y ?? livePos?.y ?? img.y;
              const pw = liveResize?.w ?? img.w;
              const ph = liveResize?.h ?? img.h;
              const opacity = (img.hidden ? 0.25 : 1) * (layer?.opacity ?? 1);
              return (
                <div key={img.id}
                  style={{ position: 'absolute', left: px, top: py, width: pw, height: ph, transform: `rotate(${liveRot}deg)`, transformOrigin: 'center center', opacity, outline: isSel ? '2px solid #a855f7' : 'none', outlineOffset: 1, cursor: (img.locked || layer?.locked) ? 'default' : 'grab', zIndex: layerZIndex(layerOrder[img.layerId] ?? 0, img.z), pointerEvents: (viewer || img.locked || layer?.locked) ? 'none' : 'auto' }}
                  onPointerDown={e => onElementDown(e, img)}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setSelIds(new Set([img.id])); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'image', elId: img.id }); }}>
                  <img src={src} draggable={false} alt={img.alt || ''} style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
                  {img.locked && <span style={{ position: 'absolute', top: 4, left: 4, fontSize: 10, background: 'rgba(0,0,0,0.7)', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}><MapIcon name="lock" size={9} /></span>}
                  {isSingleSel && !img.locked && (<>
                    {[['NW','nw-resize',{top:-5,left:-5}],['NE','ne-resize',{top:-5,right:-5}],['SW','sw-resize',{bottom:-5,left:-5}],['SE','se-resize',{bottom:-5,right:-5}]].map(([key, cur, pos]) => (
                      <div key={key}
                        style={{ position: 'absolute', width: 10, height: 10, background: '#a855f7', border: '2px solid #fff', borderRadius: 2, cursor: cur, zIndex: 6, ...pos }}
                        onPointerDown={e => {
                          e.stopPropagation(); e.preventDefault();
                          elementDownRef.current = true;
                          try { containerRef.current?.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
                          const { x: sx, y: sy } = clientXY(e);
                          const wp = screenToWorld(sx, sy);
                          resizeRef.current = { elId: img.id, corner: key, startMouse: { wx: wp.x, wy: wp.y }, startEl: { x: img.x, y: img.y, w: img.w, h: img.h } };
                        }} />
                    ))}
                    <div
                      style={{ position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: '#fbbf24', border: '2px solid #fff', cursor: 'crosshair', zIndex: 6 }}
                      onPointerDown={e => {
                        e.stopPropagation(); e.preventDefault();
                        elementDownRef.current = true;
                        try { containerRef.current?.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
                        const rect = containerRef.current.getBoundingClientRect();
                        const { pan: p, scale: s } = stateRef.current;
                        const cx = (img.x + img.w / 2) * s + p.x;
                        const cy = (img.y + img.h / 2) * s + p.y;
                        const msx = e.clientX - rect.left, msy = e.clientY - rect.top;
                        rotateRef.current = { elId: img.id, cx, cy, startAngle: Math.atan2(msy - cy, msx - cx) * 180 / Math.PI, startRotation: img.rotation || 0, liveRotation: img.rotation || 0 };
                      }} />
                  </>)}
                </div>
              );
            })}

            {/* GRID — oversized SVG gives seamless coverage 50 000 world-px beyond scene bounds */}
            {showGrid && (
              <svg style={{ position: 'absolute', top: -gridHalf, left: -gridHalf, width: mapW + 2 * gridHalf, height: mapH + 2 * gridHalf, pointerEvents: 'none', zIndex: Z_GRID }} xmlns="http://www.w3.org/2000/svg">
                <defs><pattern id="mapgrid" width={gridTile.w} height={gridTile.h} patternUnits="userSpaceOnUse" x={gridPatX} y={gridPatY}><path d={gridTile.d} fill="none" stroke={scene.grid?.color || 'rgba(255,255,255,0.32)'} strokeWidth={scene.grid?.lineWidth ?? 1} /></pattern></defs>
                <rect width="100%" height="100%" fill="url(#mapgrid)" opacity={scene.grid?.opacity ?? 1} />
              </svg>
            )}

            {/* FOG v2 (spec 0012) — mask sequencial + draft + seleção no FogLayer */}
            <FogLayer fog={fog} mapW={mapW} mapH={mapH} gridHalf={gridHalf} asViewer={asViewer}
              draft={fogDraft} selectedIds={fogSel} editMode={fogEdit && !viewer} scale={scale} zIndex={Z_FOG} />

            {/* TOKENS */}
            {elements.filter(el => el.type === 'token' && (!asViewer || (!el.hidden && !el.spectre))).sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map(t => {
              const tokLayer = layers.find(l => l.id === t.layerId);
              if (tokLayer && !tokLayer.visible) return null;
              const isSel = selIds.has(t.id);
              const livePos = dragRef.current?.positions?.[t.id];
              const px = livePos ? livePos.x : t.x;
              const py = livePos ? livePos.y : t.y;
              const opacity = (t.hidden ? 0.25 : t.spectre ? 0.45 : 1) * (tokLayer?.opacity ?? 1);
              const tokImg = t.imageId ? imageStore[t.imageId] : null;
              return (
                <div key={t.id} style={{
                  position: 'absolute', left: px - t.size / 2, top: py - t.size / 2, width: t.size, height: t.size,
                  borderRadius: '50%', background: tokImg ? '#22222f' : t.color, opacity,
                  border: isSel ? '2.5px solid #a855f7' : `2.5px solid ${tokImg ? t.color : 'rgba(255,255,255,0.85)'}`,
                  boxShadow: isSel ? `0 0 0 3px rgba(168,85,247,0.5),0 0 14px ${t.color}99` : `0 0 14px ${t.color}99,0 2px 8px rgba(0,0,0,0.5)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(11, Math.round(t.size * 0.3)), fontWeight: 700, color: '#fff',
                  filter: t.spectre ? 'blur(1.5px)' : 'none', cursor: viewer ? (canMove(scene, t, uid, false) ? 'grab' : 'not-allowed') : ((t.locked || tokLayer?.locked) ? 'not-allowed' : 'grab'), zIndex: layerZIndex(layerOrder[t.layerId] ?? 0, t.z),
                  pointerEvents: viewer && !canMove(scene, t, uid, false) ? 'none' : undefined,
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)', transition: 'opacity 0.2s,box-shadow 0.15s',
                }}
                  onPointerDown={e => onElementDown(e, t)}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); if (viewer) return; setSelIds(new Set([t.id])); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'token', tokenId: t.id }); }}>
                  {tokImg
                    ? <img src={tokImg} draggable={false} alt={t.label || 'Token'} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', pointerEvents: 'none' }} />
                    : (t.label || '?').charAt(0).toUpperCase()}
                  {(t.conditions || []).length > 0 && (
                    <div style={{ position: 'absolute', top: -Math.max(10, t.size * 0.22), left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1, whiteSpace: 'nowrap', fontSize: Math.max(10, Math.round(t.size * 0.26)), filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))', pointerEvents: 'none' }}>
                      {(t.conditions || []).map((c, i) => <span key={i}>{c}</span>)}
                    </div>
                  )}
                  {tokImg && t.label && t.label !== '?' && (
                    <div style={{ position: 'absolute', bottom: -17, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', borderRadius: 4, padding: '1px 6px', fontSize: 10, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{t.label}</div>
                  )}
                  {t.locked && <span style={{ position: 'absolute', top: -5, right: -5, fontSize: 9, background: 'rgba(0,0,0,0.75)', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}><MapIcon name="lock" size={9} /></span>}
                </div>
              );
            })}

            {/* DRAWINGS (spec 0008 AC-1) */}
            {elements.filter(el => el.type === 'drawing' && (!asViewer || (!el.hidden && !el.spectre))).sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map(d => {
              const dLayer = layers.find(l => l.id === d.layerId);
              if (dLayer && !dLayer.visible) return null;
              const isSel = selIds.has(d.id);
              const livePos = dragRef.current?.positions?.[d.id];
              const px = livePos ? livePos.x : d.x;
              const py = livePos ? livePos.y : d.y;
              const opacity = (d.hidden ? 0.3 : d.spectre ? 0.5 : 1) * (dLayer?.opacity ?? 1);
              return (
                <div key={d.id}
                  style={{ position: 'absolute', left: px, top: py, width: d.w, height: d.h, opacity, zIndex: layerZIndex(layerOrder[d.layerId] ?? 0, d.z), outline: isSel ? '1.5px dashed #a855f7' : 'none', outlineOffset: 2, cursor: (d.locked || dLayer?.locked) ? 'default' : 'grab', pointerEvents: 'none', filter: d.spectre ? 'blur(1px)' : 'none' }}>
                  {/* Só o TRAÇO é clicável (não a bbox transparente) — spec 0019 AC-5 */}
                  <svg width={Math.max(1, d.w)} height={Math.max(1, d.h)} style={{ display: 'block', overflow: 'visible', pointerEvents: (viewer || d.locked || dLayer?.locked) ? 'none' : 'visiblePainted', cursor: 'grab' }} xmlns="http://www.w3.org/2000/svg"
                    onPointerDown={e => onElementDown(e, d)}
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setSelIds(new Set([d.id])); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'image', elId: d.id }); }}>
                    <DrawingShape d={d} />
                  </svg>
                </div>
              );
            })}

            {/* preview do traço em andamento */}
            {drawLive && drawLive.pts.length > 0 && (
              <svg style={{ position: 'absolute', top: 0, left: 0, width: mapW, height: mapH, pointerEvents: 'none', zIndex: Z_OVERLAY, overflow: 'visible' }} xmlns="http://www.w3.org/2000/svg">
                {(() => {
                  const pts = drawLive.pts, a = pts[0], b = pts[pts.length - 1];
                  // O preview precisa mostrar preenchimento e estilo de traço, senão o
                  // resultado só aparece depois de soltar o mouse e vira tentativa e erro.
                  const hasFill = drawLive.fill && drawLive.fill !== 'none';
                  const p = {
                    fill: hasFill ? drawLive.fill : 'none',
                    fillOpacity: hasFill ? (drawLive.fillOpacity ?? 0.25) : undefined,
                    stroke: drawLive.color, strokeWidth: drawLive.strokeWidth,
                    strokeDasharray: (DASH[drawLive.strokeStyle] || DASH.solid)(drawLive.strokeWidth),
                    strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.9,
                  };
                  if (drawLive.shape === 'line') return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...p} />;
                  if (drawLive.shape === 'rect') return <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} {...p} />;
                  if (drawLive.shape === 'circle') return <ellipse cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} rx={Math.abs(b.x - a.x) / 2} ry={Math.abs(b.y - a.y) / 2} {...p} />;
                  return <polyline points={pts.map(pt => `${pt.x},${pt.y}`).join(' ')} {...p} />;
                })()}
              </svg>
            )}

            {/* NOTES */}
            {elements.filter(el => el.type === 'note' && (!asViewer || (!el.hidden && !el.spectre))).sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map(n => {
              const noteLayer = layers.find(l => l.id === n.layerId);
              if (noteLayer && !noteLayer.visible) return null;
              const isSel = selIds.has(n.id);
              const livePos = dragRef.current?.positions?.[n.id];
              const px = livePos ? livePos.x : n.x;
              const py = livePos ? livePos.y : n.y;
              return (
                <div key={n.id}
                  style={{ position: 'absolute', left: px, top: py, background: '#fbbf24', color: '#1a1500', padding: '8px 10px', borderRadius: 4, fontSize: 12, maxWidth: 160, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxShadow: isSel ? '0 0 0 2px #a855f7,3px 4px 12px rgba(0,0,0,0.5)' : '3px 4px 12px rgba(0,0,0,0.5)', zIndex: layerZIndex(layerOrder[n.layerId] ?? 0, n.z), opacity: (n.hidden ? 0.35 : 1) * (noteLayer?.opacity ?? 1), cursor: (n.locked || noteLayer?.locked) ? 'default' : 'grab',
                    /* `rotation` era campo morto: o migrations gravava e o render nunca lia. */
                    transform: n.rotation ? `rotate(${n.rotation}deg)` : undefined, transformOrigin: 'top left' }}
                  onPointerDown={e => onElementDown(e, n)}
                  onDoubleClick={e => { e.stopPropagation(); if (!viewer && !n.locked && !noteLayer?.locked) editNote(n.id); }}>
                  {n.text}
                  {n.locked && <span style={{ position: 'absolute', top: -5, right: -5, fontSize: 9, background: 'rgba(0,0,0,0.75)', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}><MapIcon name="lock" size={9} /></span>}
                  {!viewer && <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); deleteEl(n.id); }}
                    style={{ position: 'absolute', top: -7, right: -7, width: 17, height: 17, borderRadius: '50%', background: '#33333f', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }}>×</button>}
                </div>
              );
            })}

            {/* TEXTO RICO (doc Owlbear /docs/text) — o item em edição some daqui, pois o
                overlay desenha o textarea no lugar dele. */}
            {elements.filter(el => el.type === 'text' && (!asViewer || (!el.hidden && !el.spectre)))
              .sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map(t => {
                const tLayer = layers.find(l => l.id === t.layerId);
                if (tLayer && !tLayer.visible) return null;
                if (textEdit === t.id) return null;
                const livePos = dragRef.current?.positions?.[t.id];
                return (
                  <TextItem key={t.id}
                    el={livePos ? { ...t, x: livePos.x, y: livePos.y } : t}
                    selected={selIds.has(t.id)}
                    dim={(t.hidden ? 0.35 : 1) * (tLayer?.opacity ?? 1)}
                    zIndex={layerZIndex(layerOrder[t.layerId] ?? 0, t.z)}
                    onPointerDown={e => onElementDown(e, t)}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      if (!viewer && !t.locked && !tLayer?.locked) setTextEdit(t.id);
                    }} />
                );
              })}

            {!viewer && textEditEl && (
              <TextEditorOverlay el={textEditEl} zIndex={Z_OVERLAY}
                onChange={txt => updateElText(textEditEl.id, txt)}
                onPatch={p => updateEl(textEditEl.id, p)}
                onDone={() => {
                  // Texto vazio não vira item fantasma no canvas.
                  if (!plainText(textEditEl.text)) deleteEl(textEditEl.id);
                  setTextEdit(null);
                }} />
            )}

            {/* MEASURE */}
            {measureLine && (
              <svg style={{ position: 'absolute', top: 0, left: 0, width: mapW, height: mapH, pointerEvents: 'none', zIndex: Z_OVERLAY }} xmlns="http://www.w3.org/2000/svg">
                <line x1={measureLine.x1} y1={measureLine.y1} x2={measureLine.x2} y2={measureLine.y2} stroke="#fbbf24" strokeWidth={2 / scale} strokeDasharray={`${6 / scale},${4 / scale}`} />
                <circle cx={measureLine.x1} cy={measureLine.y1} r={5 / scale} fill="#fbbf24" />
                <circle cx={measureLine.x2} cy={measureLine.y2} r={5 / scale} fill="#fbbf24" />
                {measureDist > 0 && <text x={(measureLine.x1 + measureLine.x2) / 2} y={(measureLine.y1 + measureLine.y2) / 2 - 10 / scale} fill="#fbbf24" fontSize={13 / scale} textAnchor="middle" fontFamily="Inter,system-ui,sans-serif" fontWeight="700">{measureDist} cel</text>}
              </svg>
            )}

            {/* PRESENÇA AO VIVO (spec 0010): pings, apontadores e réguas dos participantes */}
            {campaignMode && lives.length > 0 && (
              <PingsOverlay lives={lives} selfUid={uid} scale={scale} mapW={mapW} mapH={mapH} zIndex={Z_OVERLAY} />
            )}
          </div>

          {boxSel && (
            <div style={{ position: 'absolute', left: Math.min(boxSel.x1, boxSel.x2), top: Math.min(boxSel.y1, boxSel.y2), width: Math.abs(boxSel.x2 - boxSel.x1), height: Math.abs(boxSel.y2 - boxSel.y1), border: '1.5px dashed rgba(168,85,247,0.8)', background: 'rgba(168,85,247,0.08)', pointerEvents: 'none', zIndex: 40 }} />
          )}

          {weather === 'rain' && <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 25 }}>{Array.from({ length: 80 }, (_, i) => <div key={i} style={{ position: 'absolute', left: `${(i * 13) % 100}%`, top: `${-10 - (i * 7) % 20}%`, width: 1.5, height: `${10 + (i * 3) % 15}px`, background: `rgba(174,214,241,${0.3 + (i % 5) * 0.08})`, animation: `rain ${0.5 + (i % 6) * 0.1}s linear ${(i % 10) * 0.2}s infinite` }} />)}</div>}
          {weather === 'snow' && <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 25 }}>{Array.from({ length: 60 }, (_, i) => <div key={i} style={{ position: 'absolute', left: `${(i * 17) % 100}%`, top: `${-(i * 3) % 10}%`, width: `${3 + (i % 4)}px`, height: `${3 + (i % 4)}px`, borderRadius: '50%', background: `rgba(255,255,255,${0.5 + (i % 5) * 0.1})`, animation: `snow ${2 + (i % 6) * 0.5}s ease-in-out ${(i % 8) * 0.5}s infinite` }} />)}</div>}
          {weather === 'fog' && <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 25 }}>{[0, 1, 2].map(i => <div key={i} style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse ${150 + i * 60}% ${80 + i * 30}% at ${20 + i * 30}% ${30 + i * 20}%, rgba(180,190,200,0.18) 0%, transparent 70%)`, animation: `fogDrift ${8 + i * 4}s ease-in-out ${i * 3}s infinite` }} />)}<div style={{ position: 'absolute', inset: 0, background: 'rgba(150,170,190,0.08)' }} /></div>}

          <div style={{ position: 'absolute', bottom: 10, left: 10, fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', pointerEvents: 'none' }}>{Math.round(scale * 100)}% · {Math.round(gridSize)}px · {GRID_TYPE_LABELS[gridType(scene)]} · {MEASUREMENT_LABELS[measurementMode(scene)]}{snapGrid ? ' · snap' : ''}</div>

          {/* Aviso temporário (spec 0019 AC-1/AC-10): camada travada, quota cheia… */}
          {flash && (
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: 'rgba(29,29,40,0.96)', border: '1px solid rgba(251,191,36,0.4)', color: '#fde68a', borderRadius: 10, padding: '9px 18px', fontSize: 12.5, fontFamily: 'Inter,system-ui,sans-serif', boxShadow: '0 8px 30px rgba(0,0,0,0.6)', pointerEvents: 'none', maxWidth: '80%', textAlign: 'center' }}>{flash}</div>
          )}
        </div>

        {/* RIGHT TOOLBAR — nunca corta: limita a altura e rola por dentro (spec 0019 AC-13) */}
        <div className="map-toolbar-scroll" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 30, display: 'flex', flexDirection: 'column', gap: 2, background: 'rgba(38,38,62,0.92)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: 6, maxHeight: 'calc(100% - 20px)', overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
          {allowedTools.map(t => <button key={t.id} title={t.label} onClick={() => setTool(t.id)} style={TB(tool === t.id)}><MapIcon name={t.icon} size={20} /></button>)}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
          {!viewer && campaignMode && (
            <button title={camOn ? 'Parar transmissão de câmera' : 'Sync View — transmitir minha câmera'} onClick={() => setCamOn(v => !v)} style={TB(camOn)}><MapIcon name="cast" size={20} /></button>
          )}
          {!viewer && campaignMode && (
            <button
              title={casting ? 'Parar a transmissão na segunda tela' : 'Transmitir numa segunda tela / TV (visão de jogador)'}
              aria-label={casting ? 'Parar transmissão' : 'Transmitir numa segunda tela'}
              onClick={() => (casting ? stopCast() : startCast())} style={TB(casting)}><MapIcon name="panel" size={20} /></button>
          )}
          {viewer && masterCam && !followMaster && (
            <button title="Seguir a câmera do mestre" onClick={() => setFollowMaster(true)} style={TB(false)}><MapIcon name="follow" size={20} /></button>
          )}
          <button title="Aproximar (zoom +)" onClick={() => zoomButton(1.2)} style={TB(false)}><MapIcon name="zoomIn" /></button>
          <button title="Afastar (zoom −)" onClick={() => zoomButton(1 / 1.2)} style={TB(false)}><MapIcon name="zoomOut" /></button>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
          <button title="Mostrar/ocultar grade" onClick={() => setShowGrid(g => !g)} style={TB(showGrid)}><MapIcon name="grid" size={20} /></button>
          {!viewer && (
            <button title="Controles de grade (tipo, alinhamento, medição, escala)" aria-label="Controles de grade"
              onClick={() => setGridPanel(v => !v)} style={TB(gridPanel)}><MapIcon name="target" size={19} /></button>
          )}
          {!viewer && (<>
          <button title={snapGrid ? 'Snap à grade: ligado' : 'Snap à grade: desligado'} onClick={() => setSnapGrid(g => !g)} style={TB(snapGrid)}><MapIcon name="snap" size={19} /></button>
          <button title="Revelar toda a névoa" onClick={clearFog} style={TB(false)}><MapIcon name="revealAll" size={20} /></button>
          <button title="Cobrir tudo com névoa" onClick={coverFog} style={TB(false)}><MapIcon name="coverAll" size={19} /></button>
          <button title="Painel de cenas e camadas" onClick={() => setShowLeft(v => !v)} style={TB(showLeft)}><MapIcon name="panel" size={20} /></button>
          {db && uid && (
            <button title="Biblioteca de assets" onClick={() => setDockOpen(v => !v)} style={TB(dockOpen)}><MapIcon name="library" size={20} /></button>
          )}
          </>)}
        </div>

        {tool === 'token' && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: 'rgba(38,38,62,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Cor:</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{COLORS.map(c => <button key={c} onClick={() => setTokColor(c)} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: tokColor === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />)}</div>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
            <input value={tokLabel} onChange={e => setTokLabel(e.target.value)} placeholder="Rótulo" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 12px', color: '#fff', fontSize: 12, width: 100, outline: 'none' }} />
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: tokColor, border: '2px solid rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{(tokLabel || '?').charAt(0).toUpperCase()}</div>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Tam:</span>
            {[['P', 0.5], ['M', 1], ['G', 2], ['E', 3]].map(([l, v]) => (
              <button key={l} title={`${v}× célula`} onClick={() => setTokSize(v)} style={{ ...TB(tokSize === v), width: 26, height: 26, borderRadius: 6, fontSize: 11 }}>{l}</button>
            ))}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
            <button title="Token com imagem (retrato)" aria-label="Token com imagem" onClick={() => tokImgInputRef.current?.click()} style={{ ...TB(!!tokImageId), width: 28, height: 28, borderRadius: 6 }}><MapIcon name="image" size={16} /></button>
            {tokImageId && imageStore[tokImageId] && (
              <img src={imageStore[tokImageId]} alt="" title="Clique para remover a imagem" onClick={() => setTokImageId(null)}
                style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${tokColor}`, cursor: 'pointer' }} />
            )}
            <input ref={tokImgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { loadTokenImage(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        )}

        {tool === 'draw' && !viewer && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: 'rgba(38,38,62,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {[['free', 'draw', 'Traço livre'], ['line', 'shapeLine', 'Linha'], ['rect', 'shapeRect', 'Retângulo'], ['circle', 'shapeCircle', 'Círculo']].map(([m, ic, tt]) => (
              <button key={m} title={tt} aria-label={tt} onClick={() => setDrawMode(m)} style={{ ...TB(drawMode === m), width: 30, height: 30, borderRadius: 8 }}><MapIcon name={ic} size={16} /></button>
            ))}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
            {COLORS.map(c => (
              <button key={c} onClick={() => setDrawColor(c)} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: drawColor === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
            {DRAW_WIDTHS.map(w => (
              <button key={w} title={`Espessura ${w}px`} onClick={() => setDrawWidth(w)} style={{ ...TB(drawWidth === w), width: 30, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 14, height: w, background: '#fff', borderRadius: w }} />
              </button>
            ))}

            {/* Estilo do traço (doc /docs/drawing → Stroke Style) */}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
            {[['solid', '───'], ['dashed', '╌╌╌'], ['dotted', '·····']].map(([s, glyph]) => (
              <button key={s} title={`Traço ${s === 'solid' ? 'sólido' : s === 'dashed' ? 'tracejado' : 'pontilhado'}`}
                aria-label={`Estilo de traço ${s}`} onClick={() => setDrawStroke(s)}
                style={{ ...TB(drawStroke === s), width: 32, height: 26, borderRadius: 8, fontSize: 11, letterSpacing: -1 }}>{glyph}</button>
            ))}

            {/* Preenchimento — o que transforma desenho em área de efeito de magia */}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Preencher:</span>
            <button title="Sem preenchimento" aria-label="Sem preenchimento" onClick={() => setDrawFill('none')}
              style={{ width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', background: 'transparent', border: drawFill === 'none' ? '2px solid #fff' : '2px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 1, padding: 0 }}>∅</button>
            <button title="Preencher com a cor do traço" aria-label="Preencher com a cor do traço" onClick={() => setDrawFill(drawColor)}
              style={{ width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', background: drawColor, opacity: 0.55, border: drawFill === drawColor ? '2px solid #fff' : '2px solid transparent' }} />
            {drawFill !== 'none' && (
              <input type="range" min="0.05" max="0.9" step="0.05" value={drawFillOpacity}
                title={`Opacidade do preenchimento: ${Math.round(drawFillOpacity * 100)}%`}
                aria-label="Opacidade do preenchimento"
                onChange={e => setDrawFillOpacity(Number(e.target.value))}
                style={{ width: 70, accentColor: '#a855f7' }} />
            )}
          </div>
        )}

        {/* CONTROLES DE GRADE — tipo, alinhamento (linhas×colunas + offset), medição e escala.
            Antes disto o único ajuste de grade era o tamanho de célula escondido na
            sub-toolbar de névoa, e type/offset/measurement/color/opacity eram config morta. */}
        {gridPanel && !viewer && (
          <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
            style={{ position: 'absolute', top: 16, right: 68, zIndex: 45, width: 264, maxHeight: 'calc(100% - 32px)', overflowY: 'auto', background: 'rgba(38,38,62,0.97)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>CONTROLES DE GRADE</span>
              <button title="Fechar" aria-label="Fechar controles de grade" onClick={() => setGridPanel(false)}
                style={{ ...TB(false), width: 24, height: 24, borderRadius: 6 }}><MapIcon name="close" size={13} /></button>
            </div>

            {/* Tipo de grade. Ao trocar, o modo de medição é normalizado para um válido do tipo. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>TIPO</span>
              {GRID_TYPES.map(t => (
                <button key={t} onClick={() => {
                  const allowed = measurementsFor(t);
                  const cur = scene.grid?.measurement;
                  upScene({ grid: { ...scene.grid, type: t, measurement: allowed.includes(cur) ? cur : allowed[0] } });
                }} style={{ ...TB(gridType(scene) === t), width: '100%', height: 30, borderRadius: 8, fontSize: 11, justifyContent: 'flex-start', padding: '0 10px' }}>
                  {GRID_TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Alinhamento manual do Owlbear: informe quantas células a imagem tem. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>ALINHAMENTO — CÉLULAS NA CENA</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['Colunas', 'columns'], ['Linhas', 'rows']].map(([label, kind]) => {
                  const across = cellsAcross(scene);
                  const val = across[kind] == null ? '' : Math.round(across[kind] * 100) / 100;
                  return (
                    <label key={kind} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{label}</span>
                      <input key={`${kind}-${Math.round(gridSize * 100)}`} type="number" min="1" max="400" defaultValue={val}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        onBlur={e => {
                          const n = Number(e.target.value);
                          const out = kind === 'columns' ? cellSizeFromColumns(scene.bgSize, n) : cellSizeFromRows(scene.bgSize, n);
                          if (out && out.size > 0) upScene({ grid: { ...scene.grid, size: out.size } });
                        }}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', fontSize: 12, padding: '5px 7px', fontFamily: 'monospace' }} />
                    </label>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', flex: 1 }}>Célula</span>
                <button title="Diminuir célula" onClick={() => upScene({ grid: { ...scene.grid, size: Math.max(8, gridSize - 1) } })} style={{ ...TB(false), width: 24, height: 24, borderRadius: 6, fontSize: 13 }}>-</button>
                <span style={{ fontSize: 12, color: '#fff', fontFamily: 'monospace', minWidth: 46, textAlign: 'center' }}>{Math.round(gridSize * 10) / 10}px</span>
                <button title="Aumentar célula" onClick={() => upScene({ grid: { ...scene.grid, size: Math.min(400, gridSize + 1) } })} style={{ ...TB(false), width: 24, height: 24, borderRadius: 6, fontSize: 13 }}>+</button>
              </div>
            </div>

            {/* Offset: desloca a origem da grade para casar com a grade desenhada na imagem. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>OFFSET (PX)</span>
              {[['X', 'x'], ['Y', 'y']].map(([label, axis]) => (
                <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', width: 12 }}>{label}</span>
                  {[-5, -1, 1, 5].map(step => (
                    <button key={step} title={`${step > 0 ? '+' : ''}${step}px em ${label}`}
                      onClick={() => upScene({ grid: { ...scene.grid, offset: { ...gOff, [axis]: gOff[axis] + step } } })}
                      style={{ ...TB(false), flex: 1, height: 24, borderRadius: 6, fontSize: 10, fontFamily: 'monospace' }}>
                      {step > 0 ? `+${step}` : step}
                    </button>
                  ))}
                  <span style={{ fontSize: 11, color: '#fff', fontFamily: 'monospace', minWidth: 34, textAlign: 'right' }}>{Math.round(gOff[axis] * 10) / 10}</span>
                </div>
              ))}
              {(gOff.x !== 0 || gOff.y !== 0) && (
                <button onClick={() => upScene({ grid: { ...scene.grid, offset: { x: 0, y: 0 } } })}
                  style={{ ...TB(false), width: '100%', height: 24, borderRadius: 6, fontSize: 10 }}>Zerar offset</button>
              )}
            </div>

            {/* Modo de medição — só os válidos para o tipo de grade atual. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>MEDIÇÃO</span>
              {measurementsFor(gridType(scene)).map(m => (
                <button key={m} onClick={() => upScene({ grid: { ...scene.grid, measurement: m } })}
                  style={{ ...TB(measurementMode(scene) === m), width: '100%', height: 28, borderRadius: 8, fontSize: 11, justifyContent: 'flex-start', padding: '0 10px' }}>
                  {MEASUREMENT_LABELS[m]}
                </button>
              ))}
            </div>

            {/* Escala: quanto vale 1 célula. A precisão vem dos decimais digitados. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>ESCALA POR CÉLULA</span>
              <input key={`scale-${scene.id}-${gridScale(scene).value}-${gridScale(scene).unit}`}
                defaultValue={formatScale(gridScale(scene))} placeholder="1.5m"
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                onBlur={e => {
                  const p = parseScale(e.target.value);
                  if (p) upScene({ grid: { ...scene.grid, scale: p } });
                  else { e.target.value = formatScale(gridScale(scene)); showFlash('Escala inválida — use algo como 1.5m, 5ft ou 5.00mi'); }
                }}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', fontSize: 12, padding: '6px 8px', fontFamily: 'monospace' }} />
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>
                Os decimais definem a precisão: "5.00mi" mede com 2 casas.
              </span>
            </div>

            {/* Aparência da grade — campos que existiam no schema mas ninguém lia. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>APARÊNCIA</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', flex: 1 }}>Opacidade</span>
                <input type="range" min="0" max="1" step="0.05" value={scene.grid?.opacity ?? 1}
                  onChange={e => upScene({ grid: { ...scene.grid, opacity: Number(e.target.value) } })}
                  style={{ flex: 2, accentColor: '#a855f7' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', flex: 1 }}>Espessura</span>
                <input type="range" min="0.4" max="4" step="0.2" value={scene.grid?.lineWidth ?? 1}
                  onChange={e => upScene({ grid: { ...scene.grid, lineWidth: Number(e.target.value) } })}
                  style={{ flex: 2, accentColor: '#a855f7' }} />
              </div>
            </div>
          </div>
        )}

        {(tool === 'fog' || tool === 'reveal') && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: 'rgba(38,38,62,0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Formas (spec 0012 AC-1..3) */}
            {[['rect', 'shapeRect', 'Retângulo (células)'], ['circle', 'shapeCircle', 'Círculo'], ['poly', 'shapePoly', 'Polígono (clique a clique; Enter/duplo-clique fecha; Esc cancela)'], ['free', 'draw', 'Traço livre']].map(([m, ic, tt]) => (
              <button key={m} title={tt} aria-label={tt} onClick={() => { setFogShape(m); setFogEdit(false); fogPolyRef.current = null; setFogDraft(null); }} style={{ ...TB(fogShape === m && !fogEdit), width: 30, height: 30, borderRadius: 8 }}><MapIcon name={ic} size={16} /></button>
            ))}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
            <button title="Editar formas de fog (clique seleciona, Shift+clique acumula; Delete apaga). Âmbar = coberta, verde = revelada." onClick={() => { setFogEdit(v => !v); setFogSel(new Set()); fogPolyRef.current = null; setFogDraft(null); }} style={{ ...TB(fogEdit), width: 30, height: 30, borderRadius: 8 }}><MapIcon name="brush" size={17} /></button>
            {fogEdit && fogSel.size > 0 && (<>
              {/* Cortar/Recobrir — o fluxo de encontro do Owlbear: a forma fica, só troca de papel. */}
              <button
                title="Cortar (revelar) ou recobrir a seleção — a forma continua lá para você alternar quando quiser"
                onClick={toggleFogCut}
                style={{ ...TB(false), width: 'auto', padding: '0 10px', height: 30, borderRadius: 8, fontSize: 11, gap: 6, color: '#4ade80' }}>
                <MapIcon name="reveal" size={14} /> Cortar / Recobrir
              </button>
              <button title="Juntar as formas selecionadas: cortar uma passa a revelar todas" onClick={joinFogShapes}
                style={{ ...TB(false), width: 'auto', padding: '0 9px', height: 30, borderRadius: 8, fontSize: 11, gap: 5 }}>
                <MapIcon name="target" size={13} /> Juntar
              </button>
              <button title="Separar o grupo das formas selecionadas" onClick={splitFogShapes}
                style={{ ...TB(false), width: 'auto', padding: '0 9px', height: 30, borderRadius: 8, fontSize: 11, gap: 5 }}>
                <MapIcon name="unlink" size={13} /> Separar
              </button>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{fogSel.size} sel</span>
              <button title="Apagar formas selecionadas" onClick={() => removeFogShape(fogSel)} style={{ ...TB(false), width: 'auto', padding: '0 10px', height: 30, borderRadius: 8, fontSize: 11, color: 'rgba(248,113,113,0.85)', gap: 6 }}><MapIcon name="trash" size={14} /> Apagar</button>
            </>)}
            {!fogEdit && (<>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Cor:</span>
              {['#000000', '#0d0d1a', '#1e1b4b', '#3b0764', '#422006'].map(c => (
                <button key={c} title={`Cor da névoa ${c}`} aria-label={`Cor da névoa ${c}`}
                  onClick={() => upScene({ fog: { ...scene.fog, color: c } })}
                  style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', background: c, flexShrink: 0, boxShadow: (scene.fog?.color || '#000000') === c ? '0 0 0 2px #a855f7' : '0 0 0 1px rgba(255,255,255,0.25)' }} />
              ))}
            </>)}
            <button title={previewPlayer ? 'Voltar à visão do mestre' : 'Ver como o jogador vê (preview)'} onClick={() => setPreviewPlayer(v => !v)} style={{ ...TB(previewPlayer), width: 30, height: 30, borderRadius: 8 }}><MapIcon name="eye" size={17} /></button>
            {fogShape === 'rect' && !fogEdit && (<>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Célula:</span>
              <button onClick={() => upScene({ grid: { ...scene.grid, size: Math.max(20, gridSize - 10) } })} style={{ ...TB(false), width: 28, height: 28, borderRadius: 6, fontSize: 14 }}>-</button>
              <span style={{ fontSize: 13, color: '#fff', fontFamily: 'monospace', minWidth: 32, textAlign: 'center' }}>{gridSize}</span>
              <button onClick={() => upScene({ grid: { ...scene.grid, size: Math.min(200, gridSize + 10) } })} style={{ ...TB(false), width: 28, height: 28, borderRadius: 6, fontSize: 14 }}>+</button>
            </>)}
          </div>
        )}

        {measureLine && measureDist > 0 && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 10, padding: '8px 18px', fontSize: 13, color: '#fbbf24', fontFamily: 'monospace' }}>
            {measured.cells} {isHex(scene) ? 'hex' : 'cel'} ({measured.dist} {measured.unit}) · {MEASUREMENT_LABELS[measured.mode]}
          </div>
        )}

        {/* UNIFIED ACTION TOOLBAR */}
        {!viewer && selIds.size > 0 && !measureLine && tool === 'select' && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'rgba(29,29,40,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={e => e.stopPropagation()}>

            {selIds.size > 1 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginRight: 4, whiteSpace: 'nowrap' }}>{selIds.size} sel</span>}

            <button title={anyHidden ? 'Mostrar' : 'Ocultar'} onClick={() => batchToggle('hidden')} style={actBtn(anyHidden)}><MapIcon name={anyHidden ? 'eyeOff' : 'eye'} /></button>
            <button title={anyLocked ? 'Destravar' : 'Travar'} onClick={() => batchToggle('locked')} style={actBtn(anyLocked)}><MapIcon name={anyLocked ? 'lock' : 'unlock'} /></button>

            {/* Layer picker */}
            <div style={{ position: 'relative' }}>
              <button title="Mover para camada" onClick={e => { e.stopPropagation(); setLayerPickerOpen(v => !v); }}
                style={{ height: 40, padding: '0 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, background: layerPickerOpen ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)', color: layerPickerOpen ? '#a855f7' : 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                {layers.find(l => l.id === singleSel?.layerId)?.name || 'Camada'} ▾
              </button>
              {layerPickerOpen && (
                <div style={{ position: 'absolute', bottom: '110%', left: 0, background: 'rgba(29,29,40,0.98)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 0', zIndex: 60, minWidth: 130 }}
                  onClick={e => e.stopPropagation()}>
                  {layers.map(l => (
                    <button key={l.id} onClick={() => { batchSetLayer(l.id); setLayerPickerOpen(false); }}
                      style={{ display: 'block', width: '100%', padding: '7px 14px', background: singleSel?.layerId === l.id ? 'rgba(168,85,247,0.12)' : 'none', border: 'none', color: singleSel?.layerId === l.id ? '#a855f7' : 'rgba(255,255,255,0.8)', cursor: 'pointer', textAlign: 'left', fontSize: 12 }}>
                      {l.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button title="Duplicar (Ctrl+D)" onClick={dupSelected} style={actBtn(false)}><MapIcon name="duplicate" /></button>

            {singleSel?.type === 'token' && (<>
              <button title="Editar rótulo" onClick={() => editLabel(singleSel.id)} style={actBtn(false)}><MapIcon name="text" /></button>
              <button title={singleSel.spectre ? 'Remover espectro' : 'Espectro (visível só p/ o mestre)'} onClick={() => toggleSpectre(singleSel.id)} style={actBtn(singleSel.spectre)}><MapIcon name="spectre" /></button>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
              {[['P', 0.5], ['M', 1], ['G', 2], ['E', 3]].map(([l, v]) => (
                <button key={l} title={`Tamanho ${v}× célula`} onClick={() => updateEl(singleSel.id, { size: Math.max(18, Math.round(gridSize * v)) })}
                  style={actBtn(Math.abs(singleSel.size - gridSize * v) < 2)}>{l}</button>
              ))}
            </>)}

            {singleSel?.type === 'image' && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', padding: '0 6px' }}>{Math.round(singleSel.w)}×{Math.round(singleSel.h)}</span>
            )}

            {selIds.size > 1 && (<>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
              {[
                { icon: 'alignL',  title: 'Alinhar à esquerda',    action: () => alignSelected('x', 'min') },
                { icon: 'alignCX', title: 'Centralizar horizontal', action: () => alignSelected('x', 'mid') },
                { icon: 'alignR',  title: 'Alinhar à direita',      action: () => alignSelected('x', 'max') },
                { icon: 'alignT',  title: 'Alinhar ao topo',        action: () => alignSelected('y', 'min') },
                { icon: 'alignCY', title: 'Centralizar vertical',   action: () => alignSelected('y', 'mid') },
                { icon: 'alignB',  title: 'Alinhar à base',         action: () => alignSelected('y', 'max') },
              ].map((btn, i) => (
                <button key={i} title={btn.title} onClick={btn.action} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)' }}><MapIcon name={btn.icon} size={16} /></button>
              ))}
            </>)}

            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
            <button title="Deletar (Del)" onClick={() => { deleteEls([...selIds]); setSelIds(new Set()); }}
              style={{ ...actBtn(false), color: 'rgba(248,113,113,0.75)' }}><MapIcon name="trash" /></button>

            {singleSel?.type === 'token' && (<>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: singleSel.color || '#888', border: '2px solid rgba(255,255,255,0.5)' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{singleSel.label}</span>
              </div>
            </>)}

            {/* Editar nota/texto pela barra de ações — o duplo-clique também abre, mas em
                elemento pequeno ou em toque acertar o duplo-clique é frustrante. */}
            {(singleSel?.type === 'note' || singleSel?.type === 'text') && (
              <button title={singleSel.type === 'note' ? 'Editar nota' : 'Editar texto'}
                aria-label={singleSel.type === 'note' ? 'Editar nota' : 'Editar texto'}
                onClick={() => (singleSel.type === 'note' ? editNote(singleSel.id) : setTextEdit(singleSel.id))}
                style={actBtn(false)}><MapIcon name="text" /></button>
            )}
            {singleSel?.type === 'note' && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 4 }}>{previewLabel(singleSel.text)}</span>
            )}
            {singleSel?.type === 'text' && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 4 }}>{previewLabel(singleSel.text)}</span>
            )}
          </div>
        )}

        {/* ATRIBUIR DONO (spec 0010 AC-2) */}
        {assignMenu && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setAssignMenu(null)}>
            <div style={{ background: 'rgba(29,29,40,0.98)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: '14px 0', minWidth: 240, maxHeight: '60%', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ padding: '0 18px 10px', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Atribuir token a…</div>
              {assignMenu.members.map(m => {
                const isOwner = elements.find(e2 => e2.id === assignMenu.elId)?.ownerId === m.uid;
                return (
                  <button key={m.uid}
                    onClick={() => { updateEl(assignMenu.elId, { ownerId: m.uid }); setAssignMenu(null); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 18px', background: isOwner ? 'rgba(168,85,247,0.12)' : 'none', border: 'none', color: isOwner ? '#a855f7' : 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 13 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isOwner ? 'rgba(168,85,247,0.12)' : 'none'; }}>
                    {isOwner ? '✓ ' : ''}{m.name}{m.uid === uid ? ' (você)' : ''}
                  </button>
                );
              })}
              {!assignMenu.members.length && <div style={{ padding: '6px 18px', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Nenhum membro encontrado.</div>}
            </div>
          </div>
        )}

        {/* CONTEXT MENU */}
        {/* BIBLIOTECA DE ASSETS (spec 0013) — dock inferior, só mestre logado */}
        {dockOpen && !viewer && db && uid && (
          <AssetDock assets={assets} onPlace={placeAsset}
            onDelete={id => deleteAsset(db, uid, id)} onClose={() => setDockOpen(false)} />
        )}

        {ctxMenu && (
          <div style={{ position: 'fixed', left: Math.min(ctxMenu.x, window.innerWidth - 220), top: Math.min(ctxMenu.y, window.innerHeight - 340), zIndex: 2000, background: 'rgba(29,29,40,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '6px 0', minWidth: 210, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', fontFamily: 'Inter,system-ui,sans-serif' }}
            onClick={e => e.stopPropagation()}>
            {ctxMenu.type === 'token' ? (<>
              {[
                { icon: elements.find(e => e.id === ctxMenu.tokenId)?.hidden ? 'eyeOff' : 'eye', label: elements.find(e => e.id === ctxMenu.tokenId)?.hidden ? 'Mostrar Token' : 'Ocultar Token', action: () => { toggleHide(ctxMenu.tokenId); setCtxMenu(null); } },
                { icon: elements.find(e => e.id === ctxMenu.tokenId)?.locked ? 'unlock' : 'lock', label: elements.find(e => e.id === ctxMenu.tokenId)?.locked ? 'Destravar' : 'Travar', action: () => { toggleLock(ctxMenu.tokenId); setCtxMenu(null); } },
                { icon: 'duplicate', label: 'Duplicar', action: () => { dupEl(ctxMenu.tokenId); setCtxMenu(null); } },
                { icon: 'text', label: 'Editar Rótulo', action: () => { editLabel(ctxMenu.tokenId); setCtxMenu(null); } },
                { icon: 'spectre', label: elements.find(e => e.id === ctxMenu.tokenId)?.spectre ? 'Remover Espectro' : 'Espectro', action: () => { toggleSpectre(ctxMenu.tokenId); setCtxMenu(null); } },
                ...(campaignMode ? [{ icon: 'target', label: 'Atribuir a…', action: () => { openAssignMenu(ctxMenu.tokenId); setCtxMenu(null); } }] : []),
                ...(elements.find(e => e.id === ctxMenu.tokenId)?.parentId ? [{ icon: 'unlink', label: 'Desanexar', action: () => { updateEl(ctxMenu.tokenId, { parentId: null }); setCtxMenu(null); } }] : []),
                { icon: 'chevUp', label: 'Trazer para frente', action: () => { bringToFront(ctxMenu.tokenId); setCtxMenu(null); } },
                { icon: 'chevDown', label: 'Enviar para trás', action: () => { sendToBack(ctxMenu.tokenId); setCtxMenu(null); } },
                ...(db && uid ? [{ icon: 'library', label: 'Salvar na biblioteca', action: () => { saveToLibrary(elements.find(e => e.id === ctxMenu.tokenId)); setCtxMenu(null); } }] : []),
              ].map((item, i) => (
                <button key={i} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}><MapIcon name={item.icon} size={15} style={{ opacity: 0.7, flexShrink: 0 }} />{item.label}</button>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
              <div style={{ padding: '4px 14px 2px', fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>CONDIÇÕES</div>
              <div style={{ padding: '2px 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 200 }}>
                {CONDICOES.map(c => {
                  const on = (elements.find(e2 => e2.id === ctxMenu.tokenId)?.conditions || []).includes(c.e);
                  return (
                    <button key={c.e} title={c.n} onClick={() => toggleCondition(ctxMenu.tokenId, c.e)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: on ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', fontSize: 14 }}>{c.e}</button>
                  );
                })}
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
              <button onClick={() => { deleteEl(ctxMenu.tokenId); setCtxMenu(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', color: 'rgba(248,113,113,0.85)', cursor: 'pointer', fontSize: 13 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}><MapIcon name="trash" size={15} style={{ flexShrink: 0 }} />Deletar Token</button>
            </>) : ctxMenu.type === 'image' ? (<>
              {[
                { icon: elements.find(e => e.id === ctxMenu.elId)?.hidden ? 'eyeOff' : 'eye', label: elements.find(e => e.id === ctxMenu.elId)?.hidden ? 'Mostrar' : 'Ocultar', action: () => { toggleHide(ctxMenu.elId); setCtxMenu(null); } },
                { icon: elements.find(e => e.id === ctxMenu.elId)?.locked ? 'unlock' : 'lock', label: elements.find(e => e.id === ctxMenu.elId)?.locked ? 'Destravar' : 'Travar', action: () => { toggleLock(ctxMenu.elId); setCtxMenu(null); } },
                { icon: 'duplicate', label: 'Duplicar', action: () => { dupEl(ctxMenu.elId); setCtxMenu(null); } },
                ...(elements.find(e => e.id === ctxMenu.elId)?.parentId ? [{ icon: 'unlink', label: 'Desanexar', action: () => { updateEl(ctxMenu.elId, { parentId: null }); setCtxMenu(null); } }] : []),
                { icon: 'chevUp', label: 'Trazer para frente', action: () => { bringToFront(ctxMenu.elId); setCtxMenu(null); } },
                { icon: 'chevDown', label: 'Enviar para trás', action: () => { sendToBack(ctxMenu.elId); setCtxMenu(null); } },
                ...(elements.find(e => e.id === ctxMenu.elId)?.type === 'image' ? [{ icon: 'image', label: 'Substituir imagem…', action: () => { replaceTargetRef.current = ctxMenu.elId; replaceInputRef.current?.click(); setCtxMenu(null); } }] : []),
                ...(db && uid ? [{ icon: 'library', label: 'Salvar na biblioteca', action: () => { saveToLibrary(elements.find(e => e.id === ctxMenu.elId)); setCtxMenu(null); } }] : []),
              ].map((item, i) => (
                <button key={i} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}><MapIcon name={item.icon} size={15} style={{ opacity: 0.7, flexShrink: 0 }} />{item.label}</button>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
              <button onClick={() => { deleteEl(ctxMenu.elId); setCtxMenu(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', color: 'rgba(248,113,113,0.85)', cursor: 'pointer', fontSize: 13 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}><MapIcon name="trash" size={15} style={{ flexShrink: 0 }} />Deletar Imagem</button>
            </>) : (<>
              <div style={{ padding: '6px 16px 2px', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase' }}>Mapa</div>
              {[
                { icon: 'image', label: 'Adicionar Imagem', action: () => { bgInputRef.current?.click(); setCtxMenu(null); } },
                { icon: 'grid', label: 'Mostrar/Ocultar Grade', action: () => { setShowGrid(g => !g); setCtxMenu(null); } },
              ].map((item, i) => (
                <button key={i} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}><MapIcon name={item.icon} size={15} style={{ opacity: 0.7, flexShrink: 0 }} />{item.label}</button>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
              <div style={{ padding: '6px 16px 2px', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase' }}>Clima</div>
              {[{ icon: 'rain', label: 'Chuva', val: 'rain' }, { icon: 'snow', label: 'Neve', val: 'snow' }, { icon: 'weatherFog', label: 'Névoa Densa', val: 'fog' }, { icon: 'close', label: 'Limpar Clima', val: null }].map((item, i) => (
                <button key={i} onClick={() => { dispatch({ type: 'PATCH_SCENE', sceneId: scene.id, patch: { weather: weather === item.val ? null : item.val } }); setCtxMenu(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 16px', background: weather === item.val && item.val ? 'rgba(168,85,247,0.1)' : 'none', border: 'none', color: weather === item.val && item.val ? '#a855f7' : 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={e => { e.currentTarget.style.background = weather === item.val && item.val ? 'rgba(168,85,247,0.1)' : 'none'; }}><MapIcon name={item.icon} size={15} style={{ opacity: 0.75, flexShrink: 0 }} />{item.label}</button>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
              <div style={{ padding: '6px 16px 2px', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase' }}>Névoa de Guerra</div>
              {[
                { icon: 'coverAll', label: 'Cobrir com Névoa', action: () => { coverFog(); setCtxMenu(null); } },
                { icon: 'fog', label: 'Auto Névoa (bordas)', action: () => { autoFog(); setCtxMenu(null); } },
                { icon: 'revealAll', label: 'Revelar Tudo', action: () => { clearFog(); setCtxMenu(null); } },
              ].map((item, i) => (
                <button key={i} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}><MapIcon name={item.icon} size={15} style={{ opacity: 0.7, flexShrink: 0 }} />{item.label}</button>
              ))}
            </>)}
          </div>
        )}
      </div>

      {hydrating && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 650, background: 'rgba(34,34,46,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(168,85,247,0.2)', borderTopColor: '#a855f7', animation: 'mapspin 0.8s linear infinite' }} />
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 13, color: 'rgba(233,213,255,0.7)', letterSpacing: 1 }}>Carregando a mesa…</div>
        </div>
      )}

      {promptModal && (
        <div onPointerDown={e => { if (e.target === e.currentTarget) closePrompt(null); }}
          style={{ position: 'absolute', inset: 0, zIndex: 700, background: 'rgba(20,20,28,0.72)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,system-ui,sans-serif' }}>
          <form onSubmit={e => { e.preventDefault(); closePrompt(Object.fromEntries(promptModal.fields.map(f => [f.key, f.value]))); }}
            style={{ width: 'min(92vw, 380px)', background: 'linear-gradient(180deg,#1a1a34,#131327)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 14, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: 15, color: '#e9d5ff', marginBottom: 14, letterSpacing: 0.5 }}>{promptModal.title}</div>
            {promptModal.fields.map((f, i) => (
              <label key={f.key} style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>{f.label}</span>
                {(() => {
                  const onEdit = e => { const v = e.target.value; setPromptModal(m => m && ({ ...m, fields: m.fields.map(x => x.key === f.key ? { ...x, value: v } : x) })); };
                  const box = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none' };
                  /* Campo multilinha: nota de mesa em uma linha é limitante demais. Aqui Enter
                   * quebra linha e Ctrl/Cmd+Enter confirma — Enter sozinho não pode submeter. */
                  if (f.multiline) return (
                    <textarea autoFocus={i === 0} value={f.value} placeholder={f.placeholder || ''} rows={5}
                      onChange={onEdit}
                      onKeyDown={e => {
                        if (e.key === 'Escape') { e.preventDefault(); closePrompt(null); return; }
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
                      }}
                      style={{ ...box, minHeight: 96, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.45 }} />
                  );
                  return (
                    <input autoFocus={i === 0} value={f.value} placeholder={f.placeholder || ''}
                      onChange={onEdit}
                      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); closePrompt(null); } }}
                      style={box} />
                  );
                })()}
              </label>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button type="button" onClick={() => closePrompt(null)} style={{ padding: '8px 16px', background: 'none', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button type="submit" style={{ padding: '8px 18px', background: 'rgba(168,85,247,0.9)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>OK</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
