/* Painel — a primeira tela de quem entra num sistema: os números que saem de estado real,
 * a lista de personagens do sistema ativo e o trilho de contexto (ferramentas e cota do
 * plano). O `PlaceholderScreen` é o cartaz de "ainda não existe" usado por telas em obra.
 *
 * Este barril é a porta de entrada da feature (spec 0031, onda D). O `App.jsx` importa
 * daqui o painel; a cota de fichas continua chegando por prop (`userPlans`), sem store
 * global (AC-4).
 */
export { default as Dashboard } from "./Dashboard";
export { default as PlaceholderScreen } from "./PlaceholderScreen";
/* Blocos do Painel novo — exportados porque o App precisa da MESMA contagem de
 * pendências que o "Precisa de você" mostra, para alimentar o sino da Topbar
 * (um sinal, duas superfícies) e do hook que devolve os dados da tela. */
export { default as ResumeBar } from "./ResumeBar";
export { default as NeedsYou, montarPendencias } from "./NeedsYou";
export { default as PrepChecklist } from "./PrepChecklist";
export { default as useDashboardData } from "./useDashboardData";
