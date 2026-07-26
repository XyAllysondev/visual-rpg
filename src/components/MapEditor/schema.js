/* Schema v2 do mapa (spec 0009 / ADR 0006).
 * 7 camadas Owlbear (Mapa, Desenho, Prop, Montaria, Personagem, Anexo, Nota),
 * grid como objeto, fog por shapes, permissions por camada. */

export const SCHEMA_V = 3;
/* v2 tem constante própria porque a migração v1→v2 não deve re-rodar quando o schema
 * corrente avança — cada degrau tem seu guard. */
export const SCHEMA_V2 = 2;

/* Ordem = ordem de render (base → topo), como no Owlbear: desenho fica entre o mapa e as
 * demais imagens. */
export const DEFAULT_LAYERS_V2 = [
  { id: 'layer-map',        name: 'Mapa',        type: 'map',        visible: true, locked: true,  opacity: 1 },
  { id: 'layer-drawing',    name: 'Desenho',     type: 'drawing',    visible: true, locked: false, opacity: 1 },
  { id: 'layer-prop',       name: 'Props',       type: 'prop',       visible: true, locked: false, opacity: 1 },
  { id: 'layer-mount',      name: 'Montarias',   type: 'mount',      visible: true, locked: false, opacity: 1 },
  { id: 'layer-character',  name: 'Personagens', type: 'character',  visible: true, locked: false, opacity: 1 },
  { id: 'layer-attachment', name: 'Anexos',      type: 'attachment', visible: true, locked: false, opacity: 1 },
  { id: 'layer-note',       name: 'Notas',       type: 'note',       visible: true, locked: false, opacity: 1 },
];

/* `offset` alinha a origem da grade com a grade desenhada na imagem do mapa.
 * `measurement` = 'chessboard' (Chebyshev) é o padrão de D&D 5e e do Owlbear.
 * `scale.digits` guarda a precisão que o usuário digitou ("5.00mi" → 2 casas). */
export const defaultGrid = () => ({
  type: 'square', size: 70, offset: { x: 0, y: 0 },
  color: 'rgba(255,255,255,0.32)', opacity: 1, lineWidth: 1,
  measurement: 'chessboard', scale: { value: 1.5, unit: 'm', digits: 1 },
});

/* `color` = Fog Style do Owlbear. A opacidade não é campo: sai do papel de quem olha
 * (mestre vê translúcido para trabalhar, jogador vê praticamente opaco). */
export const defaultFog = () => ({ v: 2, fillAll: false, color: '#000000', shapes: [] });

/* Dormente até a spec 0010 — as rules já leem este objeto. */
export const defaultPermissions = () => ({ 'layer-character': { update: 'owner' } });

let _seq = 0;
export const newElementId = () => `el_${Date.now()}_${(_seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const newSceneId = () => `s_${Date.now()}`;

export function newScene(name = 'Cena 1', id = newSceneId()) {
  return {
    id, name, schemaV: SCHEMA_V,
    layers: DEFAULT_LAYERS_V2, elements: [],
    grid: defaultGrid(), fog: defaultFog(), permissions: defaultPermissions(),
    bgSize: { w: 3000, h: 2000 },
  };
}
