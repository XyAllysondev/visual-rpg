/* Sistemas — o catálogo de sistemas de RPG que o Nexus atende (Ordem Paranormal, D&D,
 * Tormenta…) e a vitrine onde o jogador escolhe em qual vai entrar.
 *
 * Este barril é a porta de entrada da feature (spec 0031, onda D). O `App.jsx` importa
 * daqui a vitrine e a lista `SYSTEMS` — que ele consulta na restauração do
 * `nexus_system` do localStorage, para não deixar um sistema fora do ar voltar pelo cache.
 * Os dois ícones desenhados à mão (energia paranormal e o d20 demoníaco) são miolo: quem
 * os monta é a própria definição de sistema, pelo `svgIcon`.
 */
export { default as SYSTEMS } from "./systems";
export { default as SystemSelect } from "./SystemSelect";
export { default as OPEnergyIcon } from "./OPEnergyIcon";
export { default as DnDDemonIcon } from "./DnDDemonIcon";
