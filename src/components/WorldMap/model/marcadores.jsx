/* ════════════════════════════════════════════════════════════════════
 *  AS RUNAS DO LUGAR  (spec 0035 · F2 · M3)
 *  --------------------------------------------------------------------
 *  Os lugares do mapa-múndi eram discos coloridos com emoji. Emoji tem três
 *  problemas num mapa: é desenhado pelo SISTEMA (muda de cara entre Windows,
 *  Android e iOS), vem com cor própria que briga com a cor do nó, e não tem
 *  nada a ver com a caligrafia gótica do resto do Nexus.
 *
 *  Estas são as seis runas que os substituem — traço, não preenchimento, no
 *  mesmo dialeto do `src/ui/RuneIco.jsx` (viewBox 24, `currentColor`, cantos
 *  arredondados). **Não importam o RuneIco**: ele mora na casca do app
 *  (`src/ui/`), e o mapa-múndi não atravessa essa fronteira para pegar um
 *  ícone. A semelhança é de estilo, não de dependência.
 *
 *  ── O QUE ESTE MÓDULO NÃO FAZ ───────────────────────────────────────
 *  Não decide o que aparece. `ICONES_POR_TIPO` e `iconeDoNo` continuam em
 *  `Editor/TelaDoMapa.jsx`, intocados: quando o mestre escolhe um ícone
 *  próprio para o lugar, é ELE que aparece — a runa é só o padrão de cada
 *  tipo. E o nó `rumored` não chega aqui: rumor não tem ícone concreto
 *  (design 0028 §5.4), mostra "?" e mais nada.
 *
 *  Gate: `__tests__/marcadores.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

/** Os seis tipos de lugar que o `graph.js` define. */
export const TIPOS_COM_RUNA = ["town", "dungeon", "poi", "camp", "quest", "secret"];

/**
 * O traço de cada runa. Só a geometria — o `<svg>` em volta é do `RunaDoLugar`,
 * para os seis compartilharem espessura, cor e cantos sem repetição.
 */
const TRACOS = {
  /* Vila: dois telhados e uma porta. O que se vê de longe numa vila é
     silhueta de telhado, não parede. */
  town: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M5 20.5v-6l4-3 4 3v6" />
      <path d="M13 20.5v-4.2l3-2.4 3 2.4v4.2" />
      <path d="M8.2 20.5v-3.4h1.7v3.4" />
    </>
  ),
  /* Masmorra: um arco de entrada com a boca escura por dentro. */
  dungeon: (
    <>
      <path d="M4 21V11.5a8 8 0 0 1 16 0V21" />
      <path d="M9 21v-7.5a3 3 0 0 1 6 0V21" />
      <path d="M9 16.5h6" />
    </>
  ),
  /* Ponto de interesse: o losango de marco topográfico. */
  poi: (
    <>
      <path d="M12 2.8l4.6 9.2-4.6 9.2-4.6-9.2z" />
      <circle cx="12" cy="12" r="1.7" />
    </>
  ),
  /* Acampamento: a chama sobre as achas cruzadas. */
  camp: (
    <>
      <path d="M12 3.6c2.5 2.7 3.7 4.9 3.7 6.6a3.7 3.7 0 1 1-7.4 0c0-1.7 1.2-3.9 3.7-6.6z" />
      <path d="M4.5 20.5l15-4.2" />
      <path d="M19.5 20.5l-15-4.2" />
    </>
  ),
  /* Missão: o brasão com a marca de chamado. */
  quest: (
    <>
      <path d="M12 2.6l8.2 3.9v5.6c0 4.3-3.3 7.8-8.2 9-4.9-1.2-8.2-4.7-8.2-9V6.5z" />
      <path d="M12 7.8v4.9" />
      <circle cx="12" cy="15.9" r="0.95" fill="currentColor" stroke="none" />
    </>
  ),
  /* Segredo: a fechadura. Fica no ateliê do mestre — o jogador nunca vê um
     nó marcado como segredo (a projeção dele não carrega o tipo). */
  secret: (
    <>
      <circle cx="12" cy="9.6" r="3.4" />
      <path d="M10.3 12.6L8.8 20h6.4l-1.5-7.4" />
    </>
  ),
};

/** Runa de reserva quando o tipo é desconhecido — o mesmo padrão de `iconeDoNo`. */
const TIPO_DE_RESERVA = "poi";

/** O tipo que a runa vai desenhar de fato — o pedido, ou a reserva. */
export function tipoDaRuna(tipo) {
  return TRACOS[tipo] ? tipo : TIPO_DE_RESERVA;
}

/**
 * A runa de um tipo de lugar.
 *
 * @param {object} props
 * @param {string} props.tipo um de `TIPOS_COM_RUNA`; desconhecido cai em `poi`.
 * @param {number} [props.size=17] lado do quadrado, em px de tela.
 * @returns {JSX.Element} sempre um `<svg>` — nunca `null`, para o lugar jamais
 *   aparecer como disco vazio por causa de um tipo que ninguém previu.
 */
export default function RunaDoLugar({ tipo, size = 17 }) {
  const escolhido = tipoDaRuna(tipo);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-runa={escolhido}
    >
      {TRACOS[escolhido]}
    </svg>
  );
}
