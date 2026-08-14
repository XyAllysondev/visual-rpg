/* Ícone de navegação genérico — recebe o(s) `d` do path e desenha em 18×18.
 *
 * Saiu do App.jsx na spec 0031 (onda D) junto com o resto da casca. Hoje NENHUM
 * chamador o monta (o menu usa o `RuneIco`), mas ele é preservado tal e qual —
 * esta spec é um MOVE, não uma limpeza (AC-5). Apagar é outra decisão. */
const NavIco = ({ d, extra, size=18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p,i)=><path key={i} d={p}/>) : <path d={d}/>}
    {extra}
  </svg>
);

export default NavIco;
