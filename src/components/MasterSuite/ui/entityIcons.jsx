/* ════════════════════════════════════════════════════════════════════
 *  FORJA DO MESTRE — ARTE DOS ÍCONES  (spec 0027 · AC-3, AC-8)
 *  --------------------------------------------------------------------
 *  Mesmo contrato do `RuneIco` do App.jsx: viewBox 24, `fill:none`,
 *  `stroke:currentColor`, strokeWidth 1.6, cantos redondos. A cor vem do
 *  pai (`color`), então o mesmo desenho serve para o chip, o card e o
 *  cabeçalho sem duplicação.
 *
 *  Ícone é o DISCRIMINADOR PRIMÁRIO do tipo; a cor é reforço (D5 do
 *  documento de design / WCAG "color-not-only"). Nenhum tipo aparece na
 *  interface sem ícone + rótulo textual.
 *
 *  Os ids batem com `model/entityTypes.js` — a fonte da verdade do
 *  vocabulário. Este módulo NÃO redefine rótulo, cor ou ordem.
 * ════════════════════════════════════════════════════════════════════ */

import { getEntityType } from "../model/entityTypes";

/**
 * Casca SVG comum. Passe o traçado como `children`.
 * @param {{size?:number, strokeWidth?:number, children:any, title?:string}} props
 */
export function ForjaIco({ size = 20, strokeWidth = 1.6, title, children, ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ── OS 11 TIPOS ──────────────────────────────────────────────────────
 * A leitura simbólica de cada um está no comentário: o desenho precisa
 * ser reconhecível a 14px, então nada de detalhe abaixo de ~1,5px. */
export const ENTITY_ICONS = {
  /* Sigilo do Pensamento — círculo + triângulo inscrito */
  concept: (
    <>
      <circle cx="12" cy="10" r="6.2" />
      <polygon points="12,6.2 15.6,12.4 8.4,12.4" />
      <line x1="9.2" y1="18.4" x2="14.8" y2="18.4" />
      <line x1="10.2" y1="21" x2="13.8" y2="21" />
    </>
  ),
  /* Crânio bestial — chifres + presas */
  creature: (
    <>
      <path d="M5 4.2c2.4 1 3.4 2.9 3.4 4.6" />
      <path d="M19 4.2c-2.4 1-3.4 2.9-3.4 4.6" />
      <path d="M12 20.6c-4 0-6.6-2.9-6.6-6.6S8 7.4 12 7.4s6.6 2.9 6.6 6.6-2.6 6.6-6.6 6.6z" />
      <circle cx="9.6" cy="13.4" r="1.05" />
      <circle cx="14.4" cy="13.4" r="1.05" />
      <path d="M10.3 17.7l1.7-1.7 1.7 1.7" />
    </>
  ),
  /* Auréola — círculo radiante de 8 raios */
  deity: (
    <>
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1.35" />
      <path d="M12 1.8v3.4M12 18.8v3.4M1.8 12h3.4M18.8 12h3.4" />
      <path d="M4.8 4.8l2.4 2.4M16.8 16.8l2.4 2.4M19.2 4.8l-2.4 2.4M7.2 16.8l-2.4 2.4" />
    </>
  ),
  /* Ampulheta — o tempo que virou */
  event: (
    <>
      <line x1="6.5" y1="2.6" x2="17.5" y2="2.6" />
      <line x1="6.5" y1="21.4" x2="17.5" y2="21.4" />
      <path d="M8.2 2.6c0 4.2 3.8 5.6 3.8 9.4 0-3.8 3.8-5.2 3.8-9.4" />
      <path d="M8.2 21.4c0-4.2 3.8-5.6 3.8-9.4 0 3.8 3.8 5.2 3.8 9.4" />
      <circle cx="12" cy="12" r="0.9" />
    </>
  ),
  /* Chave-relicário */
  item: (
    <>
      <circle cx="8" cy="8" r="4.2" />
      <circle cx="8" cy="8" r="1.3" />
      <line x1="11" y1="11" x2="20.4" y2="20.4" />
      <path d="M16.6 16.6l-2.3 2.3" />
      <path d="M18.6 18.6l-2.3 2.3" />
    </>
  ),
  /* Marco de fronteira — pino + losango */
  location: (
    <>
      <path d="M12 21.6s7-6.1 7-11.1a7 7 0 1 0-14 0c0 5 7 11.1 7 11.1z" />
      <polygon points="12,6.6 15.2,10.5 12,14.4 8.8,10.5" />
    </>
  ),
  /* Brasão selado — escudo + sigilo */
  organization: (
    <>
      <path d="M12 2.4l8 3v6.2c0 4.9-3.4 8.9-8 10.2-4.6-1.3-8-5.3-8-10.2V5.4z" />
      <circle cx="12" cy="10" r="2.1" />
      <path d="M8.2 15.8c1-1.5 2.3-2.2 3.8-2.2s2.8.7 3.8 2.2" />
    </>
  ),
  /* Silhueta em dossiê — busto + cantos de moldura */
  character: (
    <>
      <circle cx="12" cy="8.4" r="3.8" />
      <path d="M5.4 20.6c0-3.7 2.9-6.4 6.6-6.4s6.6 2.7 6.6 6.4" />
      <path d="M3 6.4V3.4h3" />
      <path d="M21 6.4V3.4h-3" />
    </>
  ),
  /* Estirpe — forquilha de linhagem */
  race: (
    <>
      <line x1="12" y1="21.4" x2="12" y2="12.8" />
      <path d="M12 12.8L6.6 7.4" />
      <path d="M12 12.8l5.4-5.4" />
      <circle cx="12" cy="4.4" r="2" />
      <circle cx="5.2" cy="5.8" r="2" />
      <circle cx="18.8" cy="5.8" r="2" />
    </>
  ),
  /* Pergaminho lacrado — folha + selo (o único tipo "meta") */
  sessionSummary: (
    <>
      <path d="M6 2.6h8.2L19 7.4v14H6z" />
      <path d="M14.2 2.6v4.8H19" />
      <line x1="8.8" y1="12.2" x2="16.2" y2="12.2" />
      <line x1="8.8" y1="15.2" x2="16.2" y2="15.2" />
      <line x1="8.8" y1="18.2" x2="13.2" y2="18.2" />
      <circle cx="16.2" cy="18.2" r="1.4" />
    </>
  ),
  /* Trilha marcada — dois nós + caminho sinuoso */
  route: (
    <>
      <circle cx="5.4" cy="18.6" r="2.2" />
      <circle cx="18.6" cy="5.4" r="2.2" />
      <path d="M7.5 17.6c3.2-.7 4-2.5 3-4.7s-.2-4 3-4.7" />
    </>
  ),
  /* Fallback do tipo desconhecido (importação/legado) — losango vazado */
  unknown: (
    <>
      <polygon points="12,3 21,12 12,21 3,12" />
      <line x1="12" y1="8.6" x2="12" y2="13" />
      <circle cx="12" cy="16.2" r="0.9" />
    </>
  ),
};

/**
 * Ícone de um tipo de entidade. A cor **não** é aplicada aqui: vem do pai
 * via `color`, para o mesmo desenho servir chip (tint), card (cor pura) e
 * estado vazio (cor com opacidade).
 * @param {{type:string, size?:number, strokeWidth?:number, title?:string}} props
 */
export function EntityIcon({ type, size = 24, strokeWidth = 1.6, title }) {
  const path = ENTITY_ICONS[type] || ENTITY_ICONS.unknown;
  return <ForjaIco size={size} strokeWidth={strokeWidth} title={title}>{path}</ForjaIco>;
}

/**
 * Cor canônica do tipo, direto da fonte da verdade (`model/entityTypes`).
 * Atalho para quem já tem o id e não quer importar o modelo inteiro.
 */
export const entityColor = (type) => getEntityType(type).color;

/* ── FERRAMENTAS DA SUÍTE (rail interno) ─────────────────────────── */
export const TOOL_ICONS = {
  painel: (
    <>
      <rect x="3" y="3" width="7.6" height="7.6" rx="1.4" />
      <rect x="13.4" y="3" width="7.6" height="7.6" rx="1.4" />
      <rect x="3" y="13.4" width="7.6" height="7.6" rx="1.4" />
      <polygon points="17.2,13.4 21,21 13.4,21" />
    </>
  ),
  wiki: (
    <>
      <path d="M12 5.6C10.2 4 7.8 3.2 4.6 3.2A1.6 1.6 0 0 0 3 4.8v12.6c0 .9.7 1.6 1.6 1.6 3.2 0 5.6.8 7.4 2.4 1.8-1.6 4.2-2.4 7.4-2.4.9 0 1.6-.7 1.6-1.6V4.8c0-.9-.7-1.6-1.6-1.6-3.2 0-5.6.8-7.4 2.4z" />
      <line x1="12" y1="5.6" x2="12" y2="21.4" />
    </>
  ),
  grafo: (
    <>
      <circle cx="5" cy="6" r="2.4" />
      <circle cx="19" cy="8" r="2.4" />
      <circle cx="12" cy="18.4" r="2.4" />
      <path d="M7.3 6.7l9.4.9M6.3 8.1l4.6 8M17.5 10.2L13.4 16.4" />
    </>
  ),
  diario: (
    <>
      <path d="M4.6 3.4h10a2.4 2.4 0 0 1 2.4 2.4v14.8H7a2.4 2.4 0 0 1-2.4-2.4z" />
      <path d="M4.6 17.2H17" />
      <line x1="8" y1="7.4" x2="13.6" y2="7.4" />
      <line x1="8" y1="11" x2="13.6" y2="11" />
      <path d="M20.4 3.2c-2.4 2.2-3.6 4.8-3.8 8" />
    </>
  ),
  cronos: (
    <>
      <line x1="2.6" y1="12" x2="21.4" y2="12" />
      <circle cx="6.6" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="17.4" cy="12" r="2" />
      <path d="M6.6 10V6.4M12 14v3.6M17.4 10V6.4" />
    </>
  ),
  calendario: (
    <>
      <rect x="3.2" y="4.8" width="17.6" height="16" rx="2" />
      <line x1="3.2" y1="9.6" x2="20.8" y2="9.6" />
      <line x1="8" y1="2.6" x2="8" y2="6.4" />
      <line x1="16" y1="2.6" x2="16" y2="6.4" />
      <polygon points="12,12.4 13.4,15.2 16.4,15.6 14.2,17.7 14.8,20.6 12,19.2 9.2,20.6 9.8,17.7 7.6,15.6 10.6,15.2" />
    </>
  ),
  ideias: (
    <>
      <polygon points="11,2.6 12.9,7.5 17.8,9.4 12.9,11.3 11,16.2 9.1,11.3 4.2,9.4 9.1,7.5" />
      <polygon points="18.4,14.6 19.3,16.9 21.6,17.8 19.3,18.7 18.4,21 17.5,18.7 15.2,17.8 17.5,16.9" />
    </>
  ),
  genealogia: (
    <>
      <rect x="9" y="2.6" width="6" height="4.2" rx="1" />
      <rect x="2.6" y="17.2" width="6" height="4.2" rx="1" />
      <rect x="15.4" y="17.2" width="6" height="4.2" rx="1" />
      <path d="M12 6.8v6.6" />
      <path d="M5.6 17.2v-3.8h12.8v3.8" />
    </>
  ),
  mesa: (
    <>
      <path d="M12 2.6l8.4 4.8v9.2L12 21.4 3.6 16.6V7.4z" />
      <path d="M3.6 7.4L12 12.2l8.4-4.8" />
      <path d="M12 12.2v9.2" />
    </>
  ),
};

/**
 * Ícone de uma ferramenta da suíte.
 * @param {{name:string, size?:number, strokeWidth?:number, title?:string}} props
 */
export function ToolIcon({ name, size = 18, strokeWidth = 1.6, title }) {
  const path = TOOL_ICONS[name] || TOOL_ICONS.painel;
  return <ForjaIco size={size} strokeWidth={strokeWidth} title={title}>{path}</ForjaIco>;
}

/* ── GLIFOS DE INTERFACE ─────────────────────────────────────────────
 * Ações e sinais. Usados pelo `Btn` (prop `icon`) e pelos estados. */
export const UI_ICONS = {
  plus: (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
  close: (<><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>),
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  arrowRight: (<><line x1="4" y1="12" x2="19" y2="12" /><path d="M13 6l6 6-6 6" /></>),
  arrowLeft: (<><line x1="20" y1="12" x2="5" y2="12" /><path d="M11 6l-6 6 6 6" /></>),
  check: <path d="M4.5 12.6l4.8 4.8L19.5 7.2" />,
  search: (<><circle cx="10.6" cy="10.6" r="6.6" /><line x1="15.4" y1="15.4" x2="20.6" y2="20.6" /></>),
  trash: (
    <>
      <path d="M4.6 6.4h14.8" />
      <path d="M9.4 6.4V4.2h5.2v2.2" />
      <path d="M6.6 6.4l.9 13.2h9l.9-13.2" />
      <line x1="10.4" y1="10" x2="10.7" y2="16.4" />
      <line x1="13.6" y1="10" x2="13.3" y2="16.4" />
    </>
  ),
  edit: (<><path d="M4 20l1-4.4L15.6 5a2.1 2.1 0 0 1 3 3L8 18.6z" /><line x1="13.6" y1="7" x2="17" y2="10.4" /></>),
  spark: (
    <>
      <polygon points="11,2.6 12.9,7.5 17.8,9.4 12.9,11.3 11,16.2 9.1,11.3 4.2,9.4 9.1,7.5" />
      <polygon points="18.4,14.6 19.3,16.9 21.6,17.8 19.3,18.7 18.4,21 17.5,18.7 15.2,17.8 17.5,16.9" />
    </>
  ),
  /* Losango do mundo — o mesmo sigilo do seletor e do estado vazio */
  world: (<><polygon points="12,3 21,12 12,21 3,12" /><polygon points="12,7 17,12 12,17 7,12" /></>),
  forge: (
    <>
      <polygon points="12,2 22,12 12,22 2,12" />
      <polygon points="12,6 18,12 12,18 6,12" />
      <circle cx="12" cy="12" r="1.8" />
    </>
  ),
  warn: (<><path d="M12 2.6L22 20.4H2z" /><line x1="12" y1="9.4" x2="12" y2="14.6" /><circle cx="12" cy="17.4" r=".9" /></>),
  folder: <path d="M3.4 5.8h5.4l2 2.6h9.8v11.8H3.4z" />,
  link: (
    <>
      <path d="M10.4 13.6a4 4 0 0 0 5.6 0l2.8-2.8a4 4 0 0 0-5.6-5.6l-1.4 1.4" />
      <path d="M13.6 10.4a4 4 0 0 0-5.6 0l-2.8 2.8a4 4 0 0 0 5.6 5.6l1.4-1.4" />
    </>
  ),
};

/**
 * Glifo de interface por nome.
 * @param {{name:string, size?:number, strokeWidth?:number, title?:string}} props
 */
export function Ico({ name, size = 16, strokeWidth = 1.8, title }) {
  const path = UI_ICONS[name];
  if (!path) return null;
  return <ForjaIco size={size} strokeWidth={strokeWidth} title={title}>{path}</ForjaIco>;
}

export default EntityIcon;
