/* Mapa — o ateliê do mestre no menu lateral (mesas táticas, mapas-múndi e o construtor
 * de tokens) e a janela de transmissão `/cast/{campaignId}`, que espelha a mesa numa
 * segunda tela em VISÃO DE JOGADOR.
 *
 * Este barril é a porta de entrada da feature (spec 0031, onda D). O `App.jsx` importa
 * daqui a tela e a rota de transmissão — que é servida por early-return ANTES do gate da
 * intro, de propósito (senão a TV tocaria a animação de abertura). O `MapEditor` e o
 * `WorldMap/Atelier` continuam onde estão: esta feature só os monta.
 */
export { default as MapaScreen } from "./MapaScreen";
export { default as CastView } from "./CastView";
