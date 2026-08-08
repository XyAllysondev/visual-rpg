import { lazy } from "react";

/* Fichas por sistema — code-split (arquitetura de temas, fase 3). O `lazy()` mora aqui, e
   não no App.jsx, porque DUAS telas montam a ficha de Ordem Paranormal: o shell logado
   (App) e a visão pública (`features/ficha/PublicSheetView`). Um único `lazy()` para as
   duas — declarar um em cada arquivo criaria dois componentes distintos para o mesmo chunk.
   Continua lazy de propósito: virar import estático incharia o bundle inicial. */
const OrdemParanormalSheet = lazy(() => import("../components/systems/OrdemParanormal/OrdemParanormalSheet"));
const DungeonsAndDragonsSheet = lazy(() => import("../components/systems/DungeonsAndDragons/DungeonsAndDragonsSheet"));

/* Qual ficha abre para qual sistema. Mora aqui, junto dos `lazy()`, porque agora
   são TRÊS telas montando ficha: o shell logado, a visão pública e a mesa
   (`features/campanha/SharedSheetsPanel`) — e a mesa abria a `FullSheet` legada
   para todo mundo, inclusive para Ordem Paranormal.

   Ficha SEM `systemId` é de Ordem Paranormal: o campo só passou a ser gravado
   depois que o app ganhou um segundo sistema, e o próprio App usa esse default
   (`!c.systemId && activeSystem?.id === 'op'`). `null` significa "não há ficha
   específica para este sistema" — quem chama decide (a mesa cai na FullSheet). */
export function fichaDoSistema(dados) {
  const sys = dados?.systemId || "op";
  if (sys === "op") return OrdemParanormalSheet;
  if (sys === "dnd") return DungeonsAndDragonsSheet;
  return null;
}

export { OrdemParanormalSheet, DungeonsAndDragonsSheet };

