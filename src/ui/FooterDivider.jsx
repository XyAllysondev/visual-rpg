/* Divisória vertical entre os blocos do rodapé — sem ela a linha vira um
 * amontoado de textos que o olho não consegue separar. */
const FooterDivider = () => (
  <span aria-hidden="true" style={{ width:1, height:20, background:"var(--border2)", flexShrink:0 }}/>
);

export default FooterDivider;
