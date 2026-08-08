/* Auth — o portão do Nexus: entrar, criar conta, recuperar senha e o atalho do Google,
 * mais a escolha entre sessão persistente ou só desta aba.
 *
 * Este barril é a porta de entrada da feature (spec 0031, onda D). O `App.jsx` importa
 * daqui apenas a tela de `Login`, servida quando o gate `loggedIn` dá falso. O SDK do
 * `firebase/auth` fica INTEIRO deste lado — o App não o importa mais.
 */
export { default as Login } from "./Login";
