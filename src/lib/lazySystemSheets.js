import { lazy } from "react";

/* Fichas por sistema — code-split (arquitetura de temas, fase 3). O `lazy()` mora aqui, e
   não no App.jsx, porque DUAS telas montam a ficha de Ordem Paranormal: o shell logado
   (App) e a visão pública (`features/ficha/PublicSheetView`). Um único `lazy()` para as
   duas — declarar um em cada arquivo criaria dois componentes distintos para o mesmo chunk.
   Continua lazy de propósito: virar import estático incharia o bundle inicial. */
const OrdemParanormalSheet = lazy(() => import("../components/systems/OrdemParanormal/OrdemParanormalSheet"));
const DungeonsAndDragonsSheet = lazy(() => import("../components/systems/DungeonsAndDragons/DungeonsAndDragonsSheet"));

export { OrdemParanormalSheet, DungeonsAndDragonsSheet };

