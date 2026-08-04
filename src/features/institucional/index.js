/* Institucional — o que o Nexus conta sobre si mesmo: a abertura animada da primeira
 * visita na aba (`IntroScreen`) e o roadmap público, com as fases e o convite ao Discord.
 *
 * Este barril é a porta de entrada da feature (spec 0031, onda D). O `App.jsx` importa
 * daqui a intro (servida por um gate antes de tudo, mas DEPOIS das rotas `/p/` e `/cast/`)
 * e a tela de roadmap. O `RoadmapItem` é miolo — só o `RoadmapScreen` o monta.
 */
export { default as IntroScreen } from "./IntroScreen";
export { default as RoadmapScreen } from "./RoadmapScreen";
export { default as RoadmapItem } from "./RoadmapItem";
