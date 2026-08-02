/* Forja do Mestre — BARRA DE FERRAMENTAS DA WIKI (spec 0027, AC-4/AC-8).
 *
 * Busca (o trabalho pesado é do `entityFilters`), filtro por tipo com contagem, filtro por tag,
 * ordenação e alternância grade/lista. Regra dura do AC-4: tipo com contagem zero fica
 * DESABILITADO, nunca escondido — a barra é o inventário do mundo, e um tipo vazio é informação.
 */
import React from "react";
import { ENTITY_TYPES } from "../model/entityTypes";
import { SORT_OPTIONS } from "../model/entityFilters";
import { SP, R, FF, FS, LS, LINE, SURF, HIT, T } from "../ui/tokens";
import { TypeChip, useIsMobile } from "../ui/primitives";
import { ForjaIco, Ico } from "../ui/entityIcons";

/* Borda longhand (width/style/color): os botões de visão trocam só `borderColor`
 * quando ficam ativos, e misturar com o atalho `border` no mesmo objeto gera o
 * aviso do React sobre shorthand + longhand na mesma propriedade. */
const controle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.04)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: LINE.raise,
  borderRadius: R.input,
  color: "var(--muted2)",
  cursor: "pointer",
  touchAction: "manipulation",
  transition: "background .16s ease, color .16s ease, border-color .16s ease",
};

const GRADE_ICO = (
  <>
    <rect x="3.4" y="3.4" width="7.2" height="7.2" rx="1.4" />
    <rect x="13.4" y="3.4" width="7.2" height="7.2" rx="1.4" />
    <rect x="3.4" y="13.4" width="7.2" height="7.2" rx="1.4" />
    <rect x="13.4" y="13.4" width="7.2" height="7.2" rx="1.4" />
  </>
);

const LISTA_ICO = (
  <>
    <line x1="8.4" y1="6" x2="20.4" y2="6" />
    <line x1="8.4" y1="12" x2="20.4" y2="12" />
    <line x1="8.4" y1="18" x2="20.4" y2="18" />
    <circle cx="4.4" cy="6" r="1.2" />
    <circle cx="4.4" cy="12" r="1.2" />
    <circle cx="4.4" cy="18" r="1.2" />
  </>
);

/**
 * @param {{
 *   total: number, results: number,
 *   query: string, onQuery: (q: string) => void,
 *   view: "grade"|"lista", onView: (v: string) => void,
 *   sort: string, onSort: (s: string) => void,
 *   counts: Record<string, number>,
 *   activeTypes: string[], onToggleType: (id: string) => void, onAllTypes: () => void,
 *   tags: string[], activeTags: string[], onToggleTag: (tag: string) => void,
 *   hasFilters: boolean, onClear: () => void,
 * }} props
 */
export default function WikiToolbar({
  total = 0,
  results = 0,
  query = "",
  onQuery,
  view = "grade",
  onView,
  sort = "recent",
  onSort,
  counts = {},
  activeTypes = [],
  onToggleType,
  onAllTypes,
  tags = [],
  activeTags = [],
  onToggleTag,
  hasFilters = false,
  onClear,
}) {
  const isMobile = useIsMobile();
  const semTipo = activeTypes.length === 0;
  /* Alvo de 44px é inegociável no toque; no desktop 36px basta e devolve
   * altura à área de resultados (a barra media 190px para filtrar 2 itens). */
  const ctlH = isMobile ? HIT.mobile : 36;

  return (
    /* Faixa de controle, não caixa: a toolbar empilhava mais um cartão com
     * borda dourada e raio sobre um fundo já cheio de cartões. */
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 6,
        display: "flex",
        flexDirection: "column",
        gap: SP.x2,
        padding: `${SP.x3}px 0`,
        marginBottom: SP.x4,
        background: SURF.page,
        borderBottom: `1px solid ${LINE.hair}`,
      }}
    >
      {/* ── linha 1: busca · visão · ordenação ── */}
      <div style={{ display: "flex", alignItems: "center", gap: SP.x2, flexWrap: "wrap" }}>
        <div className="nx-field" style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: SP.x3,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              display: "flex",
              pointerEvents: "none",
            }}
          >
            <Ico name="search" size={16} />
          </span>
          <input
            type="search"
            className="forja-focus"
            value={query}
            onChange={(e) => onQuery && onQuery(e.target.value)}
            aria-label={`Buscar entre ${total} ${total === 1 ? "entidade" : "entidades"}`}
            /* a contagem saiu do placeholder: ela vive na linha de resultados,
             * onde muda com o filtro e não fica mentindo enquanto se digita */
            placeholder="Buscar no acervo"
            style={{
              width: "100%",
              minHeight: ctlH,
              boxSizing: "border-box",
              padding: `0 ${query ? 42 : SP.x3}px 0 38px`,
              background: "var(--card)",
              border: `1px solid ${LINE.raise}`,
              borderRadius: R.ctl,
              color: "var(--text)",
              fontFamily: FF.ui,
              fontSize: FS.input,
              outline: "none",
            }}
          />
          {query && (
            <button
              type="button"
              className="forja-focus"
              onClick={() => onQuery && onQuery("")}
              aria-label="Limpar a busca"
              style={{
                ...controle,
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 32,
                height: 32,
                background: "transparent",
                borderStyle: "none",
              }}
            >
              <Ico name="close" size={16} />
            </button>
          )}
        </div>

        <div role="group" aria-label="Modo de visualização" style={{ display: "flex", gap: 4 }}>
          {[
            { id: "grade", rotulo: "Ver em grade", desenho: GRADE_ICO },
            { id: "lista", rotulo: "Ver em lista", desenho: LISTA_ICO },
          ].map((op) => {
            const on = view === op.id;
            return (
              <button
                key={op.id}
                type="button"
                className="forja-focus"
                onClick={() => onView && onView(op.id)}
                aria-pressed={on}
                aria-label={op.rotulo}
                title={op.rotulo}
                style={{
                  ...controle,
                  width: ctlH,
                  minHeight: ctlH,
                  /* borda dourada SÓ no ativo — é o único sinal de estado aqui */
                  background: on ? "var(--gold-dim)" : controle.background,
                  borderColor: on ? LINE.gold : LINE.raise,
                  color: on ? "var(--accent)" : "var(--muted2)",
                }}
              >
                <ForjaIco size={17}>{op.desenho}</ForjaIco>
              </button>
            );
          })}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: SP.x2 }}>
          <span style={{ ...T.section, fontSize: FS.micro, whiteSpace: "nowrap" }}>Ordenar</span>
          <select
            value={sort}
            onChange={(e) => onSort && onSort(e.target.value)}
            className="forja-focus"
            style={{
              minHeight: ctlH,
              padding: `0 ${SP.x2}px`,
              background: "var(--card)",
              border: `1px solid ${LINE.raise}`,
              borderRadius: R.input,
              color: "var(--text)",
              fontFamily: FF.ui,
              /* 16px trava o zoom do iOS — só relaxa quando não há toque */
              fontSize: isMobile ? FS.input : FS.meta,
              cursor: "pointer",
            }}
          >
            {SORT_OPTIONS.map((op) => (
              <option key={op.id} value={op.id}>
                {op.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── linha 2: chips de tipo (contagem zero = desabilitado, nunca sumido) ── */}
      <div className="forja-chips" role="group" aria-label="Filtrar por tipo de entidade">
        <TypeChip
          type={null}
          count={total}
          active={semTipo}
          onClick={() => onAllTypes && onAllTypes()}
          label="Todos"
        />
        {ENTITY_TYPES.map((t) => {
          const n = counts[t.id] || 0;
          return (
            <TypeChip
              key={t.id}
              type={t.id}
              count={n}
              active={activeTypes.includes(t.id)}
              disabled={n === 0}
              onClick={() => onToggleType && onToggleType(t.id)}
            />
          );
        })}
      </div>

      {/* ── linha 3: tags + contagem viva + limpar (eram duas linhas) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: SP.x3, flexWrap: "wrap" }}>
        {tags.length > 0 && (
          <div
            className="forja-chips"
            role="group"
            aria-label="Filtrar por tag"
            style={{ flex: "1 1 200px", minWidth: 0 }}
          >
            {tags.map((tag) => {
              const on = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className="forja-focus"
                  onClick={() => onToggleTag && onToggleTag(tag)}
                  aria-pressed={on}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    flexShrink: 0,
                    minHeight: isMobile ? HIT.mobile : 30,
                    padding: `0 ${SP.x3}px`,
                    borderRadius: R.pill,
                    cursor: "pointer",
                    touchAction: "manipulation",
                    background: on ? "var(--gold-dim)" : "rgba(255,255,255,0.04)",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: on ? LINE.gold : LINE.raise,
                    color: on ? "var(--accent)" : "var(--muted2)",
                    fontFamily: FF.ui,
                    fontSize: FS.meta,
                  }}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        )}

        <div
          aria-live="polite"
          style={{ ...T.meta, flex: tags.length ? "0 0 auto" : "1 1 auto", minWidth: 0, marginLeft: "auto" }}
        >
          {results} {results === 1 ? "resultado" : "resultados"}
          {query ? ` · “${query}”` : ""}
        </div>
        {hasFilters && (
          <button
            type="button"
            className="forja-focus"
            onClick={() => onClear && onClear()}
            style={{
              ...controle,
              minHeight: isMobile ? HIT.mobile : 30,
              padding: `0 ${SP.x3}px`,
              gap: SP.x1,
              borderColor: LINE.raise,
              fontFamily: FF.title,
              fontSize: FS.tag,
              letterSpacing: LS.tag,
              textTransform: "uppercase",
            }}
          >
            <Ico name="close" size={13} />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
