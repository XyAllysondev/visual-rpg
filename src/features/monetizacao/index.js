/* Monetização — os planos por sistema e o momento em que a cota do plano livre estoura.
 *
 * Este barril é a porta de entrada da feature (spec 0031, onda D). O `App.jsx` importa
 * daqui a tela de planos e o modal de limite; o `createPixPayment` mora no
 * `monetizacaoApi` porque é o outro caminho de cobrança (PIX direto pelo backend na
 * Vercel), ao lado do Catarse que a `PlansScreen` abre.
 */
export { default as PlansScreen } from "./PlansScreen";
export { default as UpgradeModal } from "./UpgradeModal";
export { createPixPayment } from "./monetizacaoApi";
