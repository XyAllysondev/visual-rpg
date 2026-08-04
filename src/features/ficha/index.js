/* Ficha — o personagem: a grade de fichas, a ficha completa (`FullSheet`), os dois
 * criadores (Ordem Paranormal e D&D/genérico) e a visão pública `/p/{charId}`, que
 * jogadores sem conta abrem por link.
 *
 * Este barril é a porta de entrada da feature (spec 0031, onda C). O `App.jsx` importa
 * daqui só o que ele mesmo monta; o `features/campanha/SharedSheetsPanel` importa a
 * `FullSheet` para exibir a ficha compartilhada na mesa. O miolo (diagrama de atributos,
 * barras de PV/SAN/PE, abas de ajuste, sons e as constantes de regra) é assunto interno.
 */
export { default as SheetList } from "./SheetList";
export { default as Sheet } from "./Sheet";
export { default as FullSheet } from "./FullSheet";
export { default as CharacterCreator } from "./CharacterCreator";
export { default as DnDCharacterCreator } from "./DnDCharacterCreator";
export { default as PublicSheetView } from "./PublicSheetView";
export { default as AttrDiagram } from "./AttrDiagram";
export { default as StepBar } from "./StepBar";
export { default as Bar } from "./Bar";
export { default as SettingsTabs } from "./SettingsTabs";
export { ORIGENS, CLASSES, NEX_STEPS } from "./opConstants";

