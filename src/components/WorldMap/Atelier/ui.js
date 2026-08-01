/* ════════════════════════════════════════════════════════════════════
 *  ATELIÊ DO MESTRE — TOKENS E UTILITÁRIOS  (spec 0028 · F1 · AC-2)
 *  --------------------------------------------------------------------
 *  Só valores e funções puras. Nenhum JSX, nenhum I/O.
 *
 *  Regra da casa (ADR-0004): inline style + CSS custom properties. O cromo
 *  (fundo, borda, acento, foco) sai das vars do tema ativo — trocar de
 *  sistema repinta o ateliê sem tocar em componente nenhum.
 * ════════════════════════════════════════════════════════════════════ */

import { codigoDeErro, mensagemDeErro as mensagemDaCasa } from "../../MasterSuite/model/erros";

/* ── ESPAÇAMENTO (base 4) ─────────────────────────────────────────── */
export const SP = { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, x8: 32, x10: 40 };

/* ── RAIOS ────────────────────────────────────────────────────────── */
export const R = { input: 5, ctl: 6, card: 8, panel: 12, pill: 999 };

/* ── TIPOGRAFIA ───────────────────────────────────────────────────── */
export const FF = {
  display: "var(--font-display,'Cinzel Decorative',serif)",
  title: "var(--font-title,'Cinzel',serif)",
  ui: "var(--font-body,Inter,'Segoe UI',sans-serif)",
  data: "var(--font-data,'IBM Plex Mono',monospace)",
};

export const FS = { micro: 9, tag: 10, label: 11, meta: 12, body: 14, lead: 15, input: 16, h3: 18, h2: 22, h1: 26 };
export const FW = { body: 400, med: 500, semi: 600, bold: 700 };
export const LS = { label: "0.14em", tag: "0.10em", nav: "0.08em", display: "0.03em" };

/* ── SUPERFÍCIES E FILETES ────────────────────────────────────────── */
/* Estrutura é NEUTRA; o dourado marca SÓ interação (mesma regra da 0027). */
export const SURF = { page: "var(--bg)", rail: "var(--surface)", card: "var(--card)", raised: "var(--card2)" };
export const LINE = {
  hair: "rgba(255,255,255,0.055)",
  edge: "rgba(255,255,255,0.08)",
  raise: "rgba(255,255,255,0.13)",
  gold: "var(--border2)",
};

export const ELEV = {
  e1: "0 8px 24px rgba(0,0,0,0.45)",
  e3: "0 24px 64px rgba(0,0,0,0.72), 0 0 40px var(--gold-glow)",
};

/* ── ALVOS / ACESSIBILIDADE ───────────────────────────────────────── */
export const HIT = { desktop: 36, mobile: 44 };

/* Vermelho de erro com ≥4,5:1 sobre a escada grafite (o `--danger-text` do
 * tema op fica em ~3,6:1 e só serve para ícone/borda). */
export const DANGER_TEXT_AA = "#e28080";

/* ── ESTILOS DE TEXTO DERIVADOS ───────────────────────────────────── */
export const T = {
  section: {
    fontFamily: FF.title, fontSize: FS.label, fontWeight: FW.bold,
    letterSpacing: LS.label, textTransform: "uppercase", color: "var(--muted2)",
  },
  hero: {
    fontFamily: FF.display, fontSize: FS.h1, fontWeight: FW.bold,
    letterSpacing: LS.display, lineHeight: 1.25, color: "var(--text)",
  },
  cardTitle: {
    fontFamily: FF.ui, fontSize: FS.lead, fontWeight: FW.semi,
    lineHeight: 1.35, color: "var(--text)",
  },
  body: { fontFamily: FF.ui, fontSize: FS.body, lineHeight: 1.65, color: "var(--text)" },
  meta: { fontFamily: FF.ui, fontSize: FS.meta, lineHeight: 1.5, color: "var(--muted)" },
  data: {
    fontFamily: FF.data, fontSize: 12, letterSpacing: "0.02em",
    fontVariantNumeric: "tabular-nums", color: "var(--muted2)",
  },
  btn: {
    fontFamily: FF.title, fontSize: FS.tag, fontWeight: FW.bold,
    letterSpacing: LS.tag, textTransform: "uppercase",
  },
};

/* ── CAMPO DE FORMULÁRIO ──────────────────────────────────────────── */
/** Estilo de input/textarea. `erro` pinta a borda de perigo. */
export const campoStyle = (erro) => ({
  width: "100%", boxSizing: "border-box",
  minHeight: HIT.mobile, padding: `10px ${SP.x3}px`,
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${erro ? "rgba(216,90,90,0.55)" : LINE.raise}`,
  borderRadius: R.input, color: "var(--text)",
  fontFamily: FF.ui, fontSize: FS.input, outline: "none",
  transition: "border-color .18s ease, background .18s ease",
});

/* ── BOTÃO ────────────────────────────────────────────────────────── */
const BTN_KIND = {
  primary: { background: "linear-gradient(135deg,var(--gold2,var(--gold)),var(--gold))", color: "#0a0a0f", border: "1px solid transparent" },
  ghost: { background: "transparent", color: "var(--gold)", border: "1px solid var(--border2)" },
  quiet: { background: "rgba(255,255,255,0.04)", color: "var(--muted2)", border: `1px solid ${LINE.raise}` },
  danger: { background: "transparent", color: DANGER_TEXT_AA, border: "1px solid rgba(216,90,90,0.36)" },
};

/**
 * Estilo do botão do ateliê. O alvo nunca desce de 44px — o app é usado
 * em mesa, no celular, com o dedo.
 * @param {'primary'|'ghost'|'quiet'|'danger'} kind
 * @param {'sm'|'md'} size
 */
export const btnStyle = (kind = "ghost", size = "md") => ({
  ...BTN_KIND[kind] || BTN_KIND.ghost,
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: SP.x2,
  minHeight: size === "sm" ? 34 : 40, padding: `0 ${size === "sm" ? SP.x3 : SP.x4}px`,
  borderRadius: R.ctl, cursor: "pointer", ...T.btn,
  transition: "background .16s ease, border-color .16s ease, color .16s ease",
  touchAction: "manipulation",
});

/* ── DATA RELATIVA (PT-BR) ────────────────────────────────────────── */
/**
 * "agora", "há 2 min", "há 3 d", "12/03/2026". Aceita millis, Date, ISO ou
 * Timestamp do Firestore (o store pode devolver qualquer um dos quatro).
 * @param {*} value
 * @returns {string}
 */
export function tempoRelativo(value) {
  const ms = paraMillis(value);
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

function paraMillis(value) {
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

/* ── PLURAL ───────────────────────────────────────────────────────── */
/** `contar(0,'nó','nós')` → "nenhum nó". Evita "0 nós" no card vazio. */
export function contarNos(n) {
  const q = Number.isFinite(n) ? n : 0;
  if (q === 0) return "nenhum nó";
  return q === 1 ? "1 nó" : `${q} nós`;
}

/* ── TRADUÇÃO DE ERRO ─────────────────────────────────────────────────
 * O tradutor da casa é `MasterSuite/model/erros.js` — o `worldMapStore` já
 * importa de lá e o cabeçalho dele diz, com todas as letras, que não existe
 * outro. Aqui não se duplica: só se sobrescreve o punhado de casos em que a
 * frase genérica fala de MUNDO (vocabulário da Forja) onde o mestre está
 * olhando um MAPA, e os códigos do Storage, que o tradutor genérico achata
 * em "unknown" ao remover o prefixo do produto.
 *
 * Nesta fase o upload está bloqueado por infraestrutura (bucket não
 * provisionado, plano Spark — ver o topo do `worldMapStore`), e o store
 * recusa com um `Error` em PT-BR que passa direto pelo tradutor. As frases
 * de Storage abaixo são a rede de segurança para quando ele for destravado. */

const MENSAGENS_MAPA = {
  "permission-denied":
    "Este mapa-múndi não é seu — ou foi removido enquanto você olhava. Volte para a lista e recarregue para ver o estado atual.",
};

/** Códigos do Cloud Storage, que o tradutor genérico não distingue. */
const MENSAGENS_STORAGE = {
  unauthorized:
    "O envio de imagem não está liberado nesta conta. A ilustração de fundo depende do armazenamento de arquivos — avise a equipe do Nexus.",
  "retry-limit-exceeded":
    "O envio demorou demais e foi cancelado. Tente uma imagem menor ou uma conexão melhor.",
  "quota-exceeded":
    "O espaço de armazenamento acabou. Apague uma ilustração antiga antes de subir outra.",
  canceled: "O envio foi cancelado antes de terminar.",
  "object-not-found": "A ilustração não está mais no servidor. Suba a imagem de novo.",
  unknown:
    "O envio de imagem falhou e o servidor não explicou o motivo. Se persistir, o Firebase Storage pode não estar habilitado neste projeto.",
};

/**
 * Mensagem em PT-BR para qualquer falha vinda do store, no vocabulário do
 * ateliê. Delega ao tradutor da casa tudo que não for específico daqui.
 * @param {*} err
 * @returns {string}
 */
export function mensagemDeErro(err) {
  const bruto = typeof err === "object" && err ? String(err.code || "").toLowerCase() : "";
  if (bruto.startsWith("storage/")) {
    const chave = bruto.slice("storage/".length);
    if (MENSAGENS_STORAGE[chave]) return MENSAGENS_STORAGE[chave];
  }
  const codigo = codigoDeErro(err);
  if (codigo && MENSAGENS_MAPA[codigo]) return MENSAGENS_MAPA[codigo];
  return mensagemDaCasa(err);
}
