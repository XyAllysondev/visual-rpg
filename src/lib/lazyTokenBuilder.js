import { lazy } from "react";

/* Construtor de tokens (paper-doll) — pesado em assets, carrega só quando aberto.
   Mora aqui, e não no App.jsx, porque DUAS telas o abrem: a tela de Mapas do menu
   lateral (`MapaScreen`, ainda no App) e a aba Mapas da campanha
   (`features/campanha/CampaignMapTab`). Um único `lazy()` para as duas — declarar
   um em cada arquivo criaria dois componentes distintos para o mesmo chunk. */
const TokenBuilder = lazy(() => import("../components/systems/OrdemParanormal/TokenBuilder"));

export default TokenBuilder;
