import { newScene } from './schema';
import { migrateSceneV2, migrateSceneV3 } from './migrations';

/* Camadas v1 — mantidas só para as fases 1/2 da migração (cenas pré-v2). */
export const DEFAULT_LAYERS = [
  { id: 'layer-map',     name: 'Mapa',    type: 'map',     visible: true, locked: true,  opacity: 1 },
  { id: 'layer-tokens',  name: 'Tokens',  type: 'tokens',  visible: true, locked: false, opacity: 1 },
  { id: 'layer-objects', name: 'Objetos', type: 'objects', visible: true, locked: false, opacity: 1 },
  { id: 'layer-drawing', name: 'Desenho', type: 'drawing', visible: true, locked: false, opacity: 1 },
];

export function migrateScene(sc) {
  let out = sc;
  // Phase 1: migrate legacy tokens/notes arrays → elements[]
  if (!out.elements) {
    const elements = [
      ...(out.tokens || []).map(t => ({
        id: t.id, type: 'token', layerId: 'layer-tokens',
        x: t.x, y: t.y, color: t.color || '#4ade80', label: t.label || '?', size: t.size || 36,
        hidden: false, locked: false, spectre: false,
      })),
      ...(out.notes || []).map(n => ({
        id: n.id, type: 'note', layerId: 'layer-objects',
        x: n.x, y: n.y, text: n.text || '',
        hidden: false, locked: false, spectre: false,
      })),
    ];
    const { tokens: _t, notes: _n, ...rest } = out;
    out = { ...rest, layers: DEFAULT_LAYERS, elements };
  }
  // Phase 2: add layers if still missing (scenes saved before layers were introduced)
  if (!out.layers) out = { ...out, layers: DEFAULT_LAYERS };
  // Phase 3: schema v2 (spec 0009 / ADR 0006) — 7 camadas, fog shapes, grid objeto
  out = migrateSceneV2(out);
  // Phase 4: schema v3 — grid ganha offset de alinhamento, precisão de escala e modo de
  // medição de verdade (o 'euclidean' da v2 era config morta).
  out = migrateSceneV3(out);
  return out;
}

function coreReducer(scenes, action) {
  const sid = action.sceneId;
  const patch = (id, p) => scenes.map(s => s.id === id ? { ...s, ...p } : s);

  switch (action.type) {
    case 'ADD_SCENE': {
      const sc = newScene('Cena ' + (scenes.length + 1), action.id);
      return [...scenes, sc];
    }
    case 'DELETE_SCENE':
      return scenes.filter(s => s.id !== sid);
    case 'RENAME_SCENE':
      return patch(sid, { name: action.name });
    case 'PATCH_SCENE':
      return patch(sid, action.patch);
    case 'ADD_ELEMENT': {
      const sc = scenes.find(s => s.id === sid);
      return patch(sid, { elements: [...sc.elements, action.element] });
    }
    case 'UPDATE_ELEMENT': {
      const sc = scenes.find(s => s.id === sid);
      return patch(sid, { elements: sc.elements.map(el => el.id === action.id ? { ...el, ...action.patch } : el) });
    }
    case 'DELETE_ELEMENT': {
      const sc = scenes.find(s => s.id === sid);
      // Apagar pai DESANEXA os filhos (spec 0011 AC-4) — não os apaga.
      return patch(sid, { elements: sc.elements.filter(el => el.id !== action.id)
        .map(el => el.parentId === action.id ? { ...el, parentId: null } : el) });
    }
    case 'DELETE_ELEMENTS': {
      const sc = scenes.find(s => s.id === sid);
      const ids = new Set(action.ids);
      return patch(sid, { elements: sc.elements.filter(el => !ids.has(el.id))
        .map(el => ids.has(el.parentId) ? { ...el, parentId: null } : el) });
    }
    case 'MOVE_ELEMENTS': {
      const sc = scenes.find(s => s.id === sid);
      const pos = action.positions;
      return patch(sid, { elements: sc.elements.map(el => pos[el.id] ? { ...el, ...pos[el.id] } : el) });
    }
    case 'ADD_ELEMENTS': {
      const sc = scenes.find(s => s.id === sid);
      return patch(sid, { elements: [...sc.elements, ...action.elements] });
    }
    case 'SET_LAYER_PROP': {
      const sc = scenes.find(s => s.id === sid);
      return patch(sid, { layers: (sc.layers || DEFAULT_LAYERS).map(l => l.id === action.layerId ? { ...l, [action.prop]: action.value } : l) });
    }
    case 'REORDER_LAYERS':
      return patch(sid, { layers: action.layers });
    default:
      return scenes;
  }
}

const MAX_HISTORY = 50;

export function historyReducer(state, action) {
  // Carga vinda do Firestore (modo campanha, spec 0007): substitui tudo e zera o histórico.
  if (action.type === 'LOAD_SCENES') {
    return { past: [], present: action.scenes.map(migrateScene), future: [], coalesceKey: null };
  }
  if (action.type === 'UNDO') {
    if (!state.past.length) return state;
    const past = [...state.past];
    const present = past.pop();
    return { past, present, future: [state.present, ...state.future].slice(0, MAX_HISTORY), coalesceKey: null };
  }
  if (action.type === 'REDO') {
    if (!state.future.length) return state;
    const [present, ...future] = state.future;
    return { past: [...state.past, state.present].slice(-MAX_HISTORY), present, future, coalesceKey: null };
  }
  const next = coreReducer(state.present, action);
  if (next === state.present) return state;
  // Coalescência (spec 0019 AC-7): passos consecutivos do MESMO arrasto (fog, slider de
  // opacidade) substituem a última entrada em vez de empilhar dezenas de passos de undo.
  // O `coalesceKey` é único por interação (ex.: id da shape de fog), então arrastos distintos
  // não se fundem.
  if (action.coalesceKey && action.coalesceKey === state.coalesceKey) {
    return { ...state, present: next, future: [] };
  }
  return {
    past: [...state.past, state.present].slice(-MAX_HISTORY),
    present: next,
    future: [],
    coalesceKey: action.coalesceKey || null,
  };
}

export function initialHistoryState(mode) {
  let scenes;
  // Modo campanha não lê as cenas pessoais do localStorage — hidrata do Firestore depois.
  if (mode !== 'campaign') try {
    const raw = JSON.parse(localStorage.getItem('nexus_scenes_v1') || 'null');
    if (raw && raw.length) scenes = raw.map(migrateScene);
  } catch (e) { console.error('[MapEditor] falha ao carregar cenas do localStorage:', e); }
  if (!scenes) {
    scenes = [newScene('Cena 1', 's1')];
  }
  return { past: [], present: scenes, future: [], coalesceKey: null };
}
