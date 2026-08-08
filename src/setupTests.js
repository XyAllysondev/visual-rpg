/* ════════════════════════════════════════════════════════════════════════
 *  SETUP GLOBAL DAS SUÍTES — carregado pelo CRA (o react-scripts registra
 *  `src/setupTests.js` em setupFilesAfterEach quando o arquivo existe).
 *  ------------------------------------------------------------------------
 *  Existe por UM motivo concreto: a suíte inteira roda em ~160s com
 *  `--runInBand`, e o timeout padrão de `findBy*` do Testing Library é de
 *  1000ms. Sob carga (build em paralelo, máquina ocupada), suítes que passam
 *  sozinhas estouravam esse 1s e reprovavam de forma intermitente — em
 *  2026-08-07 aconteceu com `WorldMap/f7-tempo-real` numa rodada e com
 *  `MasterSuite/forja-render` em outra, ambas verdes 3/3 quando rodadas
 *  isoladas. Gate que reprova por relógio não mede código: ensina o time a
 *  reexecutar até passar, que é exatamente como uma regressão de verdade
 *  passa batida.
 *
 *  O `jest.setTimeout` sobe JUNTO, por necessidade: se o teto do teste (5s
 *  padrão) ficasse abaixo do teto da espera, uma espera que falha DE VERDADE
 *  morreria com "Exceeded timeout of 5000 ms" em vez da mensagem do Testing
 *  Library dizendo qual elemento não apareceu.
 *
 *  Isto não esconde teste lento: espera que passa continua resolvendo assim
 *  que o elemento aparece — o teto só muda quanto tempo ela ACEITA esperar
 *  antes de desistir.
 * ════════════════════════════════════════════════════════════════════════ */
import "@testing-library/jest-dom";
import { configure } from "@testing-library/dom";

configure({ asyncUtilTimeout: 4000 });
jest.setTimeout(20000);
