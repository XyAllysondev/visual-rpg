/* ════════════════════════════════════════════════════════════════════
 *  FORJA DO MESTRE — PRIMITIVAS DE UI  (spec 0027 · AC-8)
 *  --------------------------------------------------------------------
 *  Os tijolos que toda ferramenta da suíte reusa: botão, selo de tipo,
 *  chip de filtro, estado vazio e esqueleto de carregamento.
 *
 *  Inline style + CSS vars, como o resto do app. As classes utilitárias
 *  (`forja-focus`, `forja-card`, `skeleton`) vêm de `<ForjaStyles/>` e do
 *  bloco global do App.jsx — aqui não se declara CSS.
 * ════════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react";
import { getEntityType } from "../model/entityTypes";
import { EntityIcon, Ico } from "./entityIcons";
import { SP, R, FF, FS, FW, LS, SURF, HIT, T, tint, DANGER_TEXT_AA } from "./tokens";

/* ── VIEWPORT ─────────────────────────────────────────────────────────
 * O `useIsMobile` do App.jsx não é exportado; a suíte tem o seu, com o
 * mesmo breakpoint (768) e o mesmo cuidado com rotação de device. */
export function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1024));
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setW(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return w;
}

/** `true` abaixo de 768px — o mesmo corte que a bottomnav do app usa. */
export function useIsMobile(bp = 768) {
  return useViewportWidth() < bp;
}

/* ── BOTÃO ───────────────────────────────────────────────────────────── */

const BTN_KIND = {
  primary: {
    background: "linear-gradient(135deg,var(--accent2),var(--accent))",
    color: "#0a0a0f", border: "1px solid transparent",
  },
  ghost: { background: "transparent", color: "var(--accent)", border: "1px solid var(--border2)" },
  quiet: {
    background: "rgba(255,255,255,0.04)", color: "var(--muted2)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  danger: {
    /* texto em DANGER_TEXT_AA (não `var(--danger-text)`): este botão às vezes fica
     * sobre --card/--card2, onde a cor de perigo do tema não atinge 4,5:1 (AC-8) */
    background: "transparent", color: DANGER_TEXT_AA,
    border: "1px solid rgba(216,90,90,0.36)",
  },
};

/**
 * Botão único da suíte.
 * @param {{kind?:'primary'|'ghost'|'quiet'|'danger', size?:'sm'|'md'|'lg',
 *          icon?:string, iconRight?:string, loading?:boolean, disabled?:boolean,
 *          block?:boolean, children?:any}} props
 */
export function Btn({
  kind = "ghost", size = "md", icon, iconRight, loading, disabled,
  block, children, style, className, ...rest
}) {
  const isMobile = useIsMobile();
  const base = size === "sm" ? 32 : size === "lg" ? 46 : 38;
  const h = isMobile ? Math.max(base, HIT.mobile) : base;
  const off = disabled || loading;

  return (
    <button
      type="button"
      {...rest}
      disabled={off}
      className={`forja-focus${className ? ` ${className}` : ""}`}
      style={{
        ...(BTN_KIND[kind] || BTN_KIND.ghost),
        ...T.btn,
        display: block ? "flex" : "inline-flex",
        width: block ? "100%" : undefined,
        alignItems: "center", justifyContent: "center", gap: SP.x2,
        minHeight: h, padding: `0 ${size === "sm" ? SP.x3 : SP.x4}px`,
        borderRadius: R.input,
        cursor: off ? "not-allowed" : "pointer",
        opacity: off ? 0.42 : 1,
        transition: "filter .18s ease, transform .12s ease, background .18s ease",
        touchAction: "manipulation",
        ...style,
      }}
      onMouseEnter={(e) => { if (!off) e.currentTarget.style.filter = "brightness(1.14)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}
      onMouseDown={(e) => { if (!off) e.currentTarget.style.transform = "translateY(1px)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "none"; }}
    >
      {loading ? (
        <span
          aria-hidden="true"
          style={{
            width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
            border: "2px solid currentColor", borderTopColor: "transparent",
            animation: "spin .8s linear infinite",
          }}
        />
      ) : (icon ? <Ico name={icon} size={14} /> : null)}
      {children}
      {iconRight ? <Ico name={iconRight} size={14} /> : null}
    </button>
  );
}

/* ── SELO DE TIPO (leitura) ──────────────────────────────────────────── */

/**
 * Ícone + rótulo do tipo. Nunca só a cor (WCAG "color-not-only").
 * @param {{type:string, size?:'sm'|'lg', short?:boolean}} props
 */
export function TypeBadge({ type, size = "sm", short }) {
  const t = getEntityType(type);
  const label = short && t.label.length > 12 ? t.label.split(" ")[0] : t.label;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: SP.x1, color: t.color, minWidth: 0 }}>
      <EntityIcon type={t.id} size={size === "lg" ? 18 : 14} />
      <span style={{
        ...T.typeTag, fontSize: size === "lg" ? FS.label : FS.tag,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    </span>
  );
}

/* ── CHIP DE TIPO (filtro) ───────────────────────────────────────────── */

/**
 * Chip de filtro. Tint = inativo, fill = ativo — a mesma gramática dos
 * chips do dossiê OP, então nunca há ambiguidade com o dourado do tema.
 * `type` nulo = chip "Todos".
 * @param {{type?:string|null, count?:number, active?:boolean, disabled?:boolean,
 *          onClick?:Function, label?:string}} props
 */
export function TypeChip({ type, count, active, disabled, onClick, label }) {
  const isMobile = useIsMobile();
  const t = type ? getEntityType(type) : null;
  const c = t ? t.color : "var(--accent)";
  const texto = label || (t ? t.label : "Todos");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={!!active}
      className="forja-focus"
      style={{
        display: "inline-flex", alignItems: "center", gap: SP.x2, flexShrink: 0,
        minHeight: isMobile ? HIT.mobile : 34,
        padding: `0 ${SP.x3}px`, borderRadius: R.pill,
        cursor: disabled ? "not-allowed" : "pointer",
        background: active ? c : (t ? tint(c, 0.12) : "var(--gold-dim)"),
        border: `1px solid ${active ? c : (t ? tint(c, 0.34) : "var(--border2)")}`,
        color: active ? "#14141c" : c,
        opacity: disabled ? 0.45 : 1,
        transition: "background .15s ease, color .15s ease, border-color .15s ease",
        touchAction: "manipulation",
      }}
    >
      {t ? <EntityIcon type={t.id} size={14} /> : null}
      <span style={T.typeTag}>{texto}</span>
      {count === undefined ? null : (
        <span style={{
          fontFamily: FF.data, fontSize: FS.micro, fontVariantNumeric: "tabular-nums",
          opacity: active ? 0.78 : 0.66,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ── ESTADO VAZIO ────────────────────────────────────────────────────── */

/**
 * Vazio SEMPRE com contexto: título próprio, uma frase que explica e ao
 * menos uma saída. Nada de "nenhum resultado" genérico.
 * @param {{icon?:any, title:string, description?:string, actions?:any,
 *          compact?:boolean, tone?:string}} props
 */
export function EmptyState({ icon, title, description, actions, compact, tone }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", gap: SP.x4,
      padding: compact ? `${SP.x8}px ${SP.x4}px` : `${SP.x12}px ${SP.x4}px`,
    }}>
      {icon ? (
        <span aria-hidden="true" style={{ color: tone || "var(--muted)", opacity: 0.34, display: "flex" }}>
          {icon}
        </span>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: SP.x2, alignItems: "center" }}>
        <h3 style={{
          ...T.hero, fontSize: compact ? FS.h3 : 20, margin: 0,
          color: "var(--accent2)", letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {title}
        </h3>
        {description ? (
          <p style={{ ...T.meta, fontSize: 13, margin: 0, maxWidth: 400 }}>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div style={{ display: "flex", gap: SP.x3, flexWrap: "wrap", justifyContent: "center" }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/* ── ESQUELETO ───────────────────────────────────────────────────────── */

/**
 * Barra/caixa de carregamento com a classe global `.skeleton`.
 * A caixa precisa ter a medida do conteúdo real (CLS ≈ 0).
 * @param {{w?:number|string, h?:number, r?:number, style?:object}} props
 */
export function Skeleton({ w = "100%", h = 12, r = 4, style }) {
  return (
    <span
      aria-hidden="true"
      className="skeleton"
      style={{ display: "block", width: w, height: h, borderRadius: r, ...style }}
    />
  );
}

/** Bloco de carregamento acessível: anuncia o estado e desenha N barras. */
export function SkeletonBlock({ rows = 3, label = "Carregando…" }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}
      style={{ display: "flex", flexDirection: "column", gap: SP.x3, padding: SP.x4 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} w={i % 3 === 0 ? "58%" : i % 3 === 1 ? "92%" : "44%"} h={14} />
      ))}
    </div>
  );
}

/* ── TÍTULO DE SEÇÃO ─────────────────────────────────────────────────── */

/**
 * "A C E R V O ────────── [ação]". Filete de 1px que come o espaço livre.
 * @param {{children:any, action?:any, id?:string}} props
 */
export function SectionTitle({ children, action, id }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: SP.x3, marginBottom: SP.x4 }}>
      <h2 id={id} style={{ ...T.section, margin: 0, flexShrink: 0 }}>{children}</h2>
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: SURF.hair }} />
      {action}
    </div>
  );
}

/* ── SELO "EM BREVE" ─────────────────────────────────────────────────── */

/** Marca as ferramentas das fases 2–8 — informa sem prometer data. */
export function SoonBadge({ children = "Em breve" }) {
  return (
    <span style={{
      fontFamily: FF.title, fontSize: FS.micro, fontWeight: FW.semi, letterSpacing: LS.tag,
      textTransform: "uppercase", padding: "2px 6px", borderRadius: R.tag,
      background: "rgba(255,255,255,0.06)", border: `1px solid ${SURF.hair}`,
      color: "var(--muted)", whiteSpace: "nowrap", lineHeight: 1.4,
    }}>
      {children}
    </span>
  );
}
