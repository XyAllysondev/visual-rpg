/* ════════════════════════════════════════════════════════════════════
 *  FORJA DO MESTRE — TOKENS DE UI  (spec 0027 · AC-8)
 *  --------------------------------------------------------------------
 *  Só valores. Nenhum componente, nenhum I/O, nenhum JSX. Escala de 4px.
 *
 *  Regra da casa: **cromo** (bordas, botões, pílula, foco) sai das CSS vars
 *  do tema ativo (`--accent`, `--card`, `--border`…), para que trocar de
 *  sistema (op → dnd → tormenta) repinte a suíte inteira. As **cores de
 *  tipo de entidade** são hex fixos e vêm de `model/entityTypes` — o
 *  usuário aprende "rosa = Personagem" e isso não pode mudar com o tema.
 * ════════════════════════════════════════════════════════════════════ */

/* ── ESPAÇAMENTO (base 4) ─────────────────────────────────────────── */
export const SP = {
  x0: 0, x1: 4, x2: 8, x3: 12, x4: 16,
  x5: 20, x6: 24, x8: 32, x10: 40, x12: 48, x16: 64,
};

/* ── RAIOS ────────────────────────────────────────────────────────── */
export const R = {
  tag: 4,      // tag inline #hash
  input: 6,    // input, botão pequeno
  ctl: 8,      // botão, item de nav, pílula do rail
  card: 10,    // card de entidade, contador, atalho
  panel: 14,   // painel, hero, modal
  pill: 999,   // chip de filtro, badge de tipo
};

/* ── TIPOGRAFIA ───────────────────────────────────────────────────── */
export const FF = {
  display: "var(--font-display,'Cinzel Decorative',serif)",
  title: "var(--font-title,'Cinzel',serif)",
  ui: "Inter,'Inter var',system-ui,-apple-system,sans-serif",
  data: "var(--font-data,'IBM Plex Mono',monospace)",
};

export const FS = {
  micro: 9,   // contador dentro do chip, timestamp mobile
  tag: 10,    // TIPO em caps, rótulo de botão
  label: 11,  // SEÇÃO em caps
  meta: 12,   // subtítulo de card, metadados
  body: 14,   // corpo padrão, item de lista
  lead: 15,   // título de card, corpo do detalhe
  input: 16,  // TODO input/textarea/select — trava o zoom do iOS
  h3: 18,     // título de painel
  h2: 22,     // título do modal
  h1: 26,     // nome da entidade / do mundo
  num: 28,    // número do contador
};

export const FW = { body: 400, med: 500, semi: 600, bold: 700 };

export const LS = {
  label: "0.14em",   // Cinzel caps 11px
  tag: "0.10em",     // Cinzel caps 10px
  nav: "0.08em",     // rail de ferramentas
  display: "0.03em", // Cinzel Decorative
  data: "0.02em",    // mono
  body: "0",         // Inter — nunca apertar corpo
};

export const LH = { tight: 1.25, title: 1.35, body: 1.65, prose: 1.72, meta: 1.5 };

/* ── ELEVAÇÃO ─────────────────────────────────────────────────────── */
export const ELEV = {
  e0: "inset 0 1px 0 rgba(255,255,255,0.035)",                    // repouso
  e1: "0 8px 24px rgba(0,0,0,0.45)",                              // hover
  e2: "0 12px 36px rgba(0,0,0,0.62)",                             // popover
  e3: "0 24px 64px rgba(0,0,0,0.72), 0 0 40px var(--gold-glow)",  // modal
};

/* ── SUPERFÍCIES (escada grafite da spec 0023) ────────────────────── */
export const SURF = {
  page: "var(--bg)",
  rail: "var(--surface)",
  card: "var(--card)",
  raised: "var(--card2)",
  hair: "var(--border)",
  edge: "var(--border2)",
};

/* ── ALVOS / ACESSIBILIDADE ───────────────────────────────────────── */
export const HIT = { desktop: 36, mobile: 44, fab: 56 };
export const FOCUS = { outline: "2px solid var(--accent2)", outlineOffset: 2 };

/* Vermelho de erro/perigo ajustado para AA (spec 0027 · AC-8): o `--danger-text`
 * do tema op (#d85a5a) só chega a ~3.6:1 sobre `--card`/`--card2` (a escada de
 * superfícies da suíte), abaixo do mínimo de 4,5:1 para texto. Usar SÓ onde a cor
 * pinta TEXTO (mensagem de erro, asterisco obrigatório, rótulo do botão "Excluir");
 * ícone/borda continuam com `var(--danger-text)`, que já cumpre o 3:1 exigido para
 * elementos gráficos. Vale ≥4,5:1 sobre --bg/--card/--card2 nos três temas. */
export const DANGER_TEXT_AA = "#e28080";

/* ── MOVIMENTO (reexporta os tokens oficiais da spec 0017) ────────── */
export { EASE_ENTER, EASE_HOVER, DUR_MICRO, DUR_ENTER, staggerDelay } from "../../../themes/motion";
export const DUR_EXIT = 140;       // saída sempre mais rápida que a entrada
export const DUR_MODAL = 220;
export const DEBOUNCE_BUSCA = 220; // ms

/* ── LARGURAS ─────────────────────────────────────────────────────── */
export const W = {
  viewport: 1320,   // maxWidth do conteúdo, centrado
  aside: 320,       // coluna direita
  folders: 200,     // rail de pastas da Wiki
  cardMin: 248,     // minmax da grade de entidades
  counterMin: 152,  // minmax da grade de contadores
  measure: "68ch",  // medida de leitura
};

/* ── ESTILOS DE TEXTO DERIVADOS ───────────────────────────────────── */
export const T = {
  /* SEÇÃO — "ACERVO", "CONEXÕES" */
  section: {
    fontFamily: FF.title, fontSize: FS.label, fontWeight: FW.bold,
    letterSpacing: LS.label, textTransform: "uppercase", color: "var(--muted2)",
  },
  /* TIPO da entidade — a cor entra por prop */
  typeTag: {
    fontFamily: FF.title, fontSize: FS.tag, fontWeight: FW.semi,
    letterSpacing: LS.tag, textTransform: "uppercase",
  },
  /* Nome grande (mundo, entidade) */
  hero: {
    fontFamily: FF.display, fontSize: FS.h1, fontWeight: FW.bold,
    letterSpacing: LS.display, lineHeight: LH.tight, color: "var(--text)",
  },
  /* Título de card */
  cardTitle: {
    fontFamily: FF.ui, fontSize: FS.lead, fontWeight: FW.semi,
    lineHeight: LH.title, color: "var(--text)",
  },
  /* Corpo — cor pelo tema, nunca hex fixo (AC-8) */
  body: {
    fontFamily: FF.ui, fontSize: FS.body, fontWeight: FW.body,
    lineHeight: LH.body, color: "var(--text)",
  },
  prose: {
    fontFamily: FF.ui, fontSize: FS.lead, lineHeight: LH.prose,
    color: "var(--text)", maxWidth: W.measure,
  },
  /* Metadados */
  meta: { fontFamily: FF.ui, fontSize: FS.meta, lineHeight: LH.meta, color: "var(--muted)" },
  /* Números / datas / valores k-v */
  num: {
    fontFamily: FF.data, fontSize: FS.num, fontWeight: FW.med,
    letterSpacing: LS.data, fontVariantNumeric: "tabular-nums", color: "var(--text)",
  },
  data: {
    fontFamily: FF.data, fontSize: 13, letterSpacing: LS.data,
    fontVariantNumeric: "tabular-nums", color: "var(--muted2)",
  },
  /* Rótulo de botão */
  btn: {
    fontFamily: FF.title, fontSize: FS.tag, fontWeight: FW.bold,
    letterSpacing: LS.tag, textTransform: "uppercase",
  },
  /* Vazio inline */
  empty: {
    fontFamily: FF.ui, fontSize: 13, fontStyle: "italic",
    color: "var(--muted)", lineHeight: LH.body,
  },
};

/* ── DERIVAÇÃO DE COR DE TIPO ─────────────────────────────────────── */
/**
 * Aplica alfa a um hex de 6 dígitos (`#rrggbb` → `#rrggbbaa`).
 * Fundo do chip → 0.14 · borda → 0.38 · glow → 0.28 · faixa → cor pura.
 * Tolerante: valor inválido volta como veio (nunca quebra o render).
 * @param {string} hex
 * @param {number} a  0..1
 * @returns {string}
 */
export function tint(hex, a) {
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const alpha = Math.max(0, Math.min(1, Number.isFinite(a) ? a : 1));
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}

/**
 * Data relativa em PT-BR, curta ("agora", "há 2 min", "há 3 d", "12/03/2026").
 * Aceita millis, Date, ISO ou Timestamp-like do Firestore.
 * @param {*} value
 * @returns {string}
 */
export function tempoRelativo(value) {
  const ms = toMillisLocal(value);
  if (ms === null) return "—";
  const diff = Date.now() - ms;
  if (diff < 0) return "agora";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} d`;
  return new Date(ms).toLocaleDateString("pt-BR");
}

/* Conversão local de carimbo — evita acoplar a camada de UI ao módulo de filtros. */
function toMillisLocal(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "object") {
    if (typeof value.toMillis === "function") {
      const t = Number(value.toMillis());
      return Number.isFinite(t) ? t : null;
    }
    const secs = Number(value.seconds ?? value._seconds);
    if (Number.isFinite(secs)) return secs * 1000;
  }
  return null;
}
