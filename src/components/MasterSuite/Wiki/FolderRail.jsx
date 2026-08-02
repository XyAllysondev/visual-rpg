/* Forja do Mestre — RAIL DE PASTAS DA WIKI (spec 0027, AC-4/AC-8).
 *
 * Árvore de pastas (parentId) à esquerda no desktop; abaixo de 1024px o mesmo controle vira um
 * <select> de 44px. Os dois estão no DOM e a media query de `Wiki/index.jsx` decide qual aparece
 * — `display:none` também tira o escondido da ordem de tabulação.
 */
import React, { useMemo, useRef, useState } from "react";
import { SP, R, FF, FS, FW, LS, LINE, SURF, HIT, T } from "../ui/tokens";
import { Ico } from "../ui/entityIcons";

/** Valor sentinela do filtro "entidades fora de qualquer pasta". */
export const NO_FOLDER = "__sem-pasta__";

/* Borda em propriedades longas (width/style/color) de propósito: quem ativa a pasta
 * sobrescreve SÓ `borderColor`, e misturar o atalho `border` com a longa no mesmo
 * objeto de estilo faz o React avisar no console a cada rerender ("Removing a style
 * property during rerender") — e, pior, deixa a borda em estado imprevisível. */
const itemBase = {
  display: "flex",
  alignItems: "center",
  gap: SP.x2,
  width: "100%",
  minHeight: 36,
  padding: `0 ${SP.x2}px`,
  background: "transparent",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "transparent",
  borderRadius: R.input,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: FF.ui,
  fontSize: FS.body,
  color: "var(--muted2)",
  touchAction: "manipulation",
  transition: "background .15s ease, color .15s ease",
};

/* Aqui o dourado é legítimo: marca a pasta SELECIONADA — estado, não moldura. */
const ativoStyle = {
  background: "var(--gold-dim)",
  borderColor: LINE.gold,
  color: "var(--accent)",
};

const contagemStyle = {
  fontFamily: FF.data,
  fontSize: FS.micro,
  fontVariantNumeric: "tabular-nums",
  color: "var(--muted)",
  marginLeft: "auto",
};

const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };

/** Achata a árvore com profundidade — usada pelo <select> daqui e pelo do modal. */
export function achatarPastas(folders, parentId = null, depth = 0, saida = []) {
  (Array.isArray(folders) ? folders : [])
    .filter((f) => f && (f.parentId ?? null) === parentId)
    .forEach((f) => {
      saida.push({ folder: f, depth });
      achatarPastas(folders, f.id, depth + 1, saida);
    });
  return saida;
}

/**
 * @param {{
 *   folders: Array<{id:string,name:string,parentId:?string}>,
 *   counts: Record<string, number>, totalCount: number, looseCount: number,
 *   activeId: ?string, onSelect: (id: ?string) => void,
 *   onCreate: (name: string) => void, onDelete: (folder: object) => void,
 *   busy?: boolean,
 * }} props
 */
export default function FolderRail({
  folders = [],
  counts = {},
  totalCount = 0,
  looseCount = 0,
  activeId = null,
  onSelect,
  onCreate,
  onDelete,
  busy = false,
}) {
  const [abertas, setAbertas] = useState(() => new Set());
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const novaRef = useRef(null);

  const porPai = useMemo(() => {
    const mapa = new Map();
    (folders || []).filter(Boolean).forEach((f) => {
      const pai = f.parentId ?? null;
      if (!mapa.has(pai)) mapa.set(pai, []);
      mapa.get(pai).push(f);
    });
    return mapa;
  }, [folders]);

  const planas = useMemo(() => achatarPastas(folders), [folders]);

  const alternar = (id) =>
    setAbertas((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const confirmarCriacao = async () => {
    const limpo = nome.trim();
    if (!limpo || !onCreate) return;
    // Só fecha o formulário quando a escrita confirmar — fechar antes faz uma
    // falha de rede parecer sucesso (a pasta "some" sem nenhum aviso no contexto).
    const ok = await onCreate(limpo);
    if (ok === false) return;
    setNome("");
    setCriando(false);
  };

  const cancelarCriacao = () => {
    setNome("");
    setCriando(false);
    if (novaRef.current) novaRef.current.focus();
  };

  const renderNivel = (parentId, depth) => {
    const filhas = porPai.get(parentId) || [];
    if (!filhas.length) return null;
    return filhas.map((f) => {
      const temFilhas = (porPai.get(f.id) || []).length > 0;
      const aberta = abertas.has(f.id);
      const on = activeId === f.id;
      return (
        <li key={f.id} style={{ listStyle: "none" }}>
          <div style={{ display: "flex", alignItems: "center", paddingLeft: depth * 14 }}>
            {temFilhas ? (
              <button
                type="button"
                className="forja-focus"
                onClick={() => alternar(f.id)}
                aria-expanded={aberta}
                aria-label={`${aberta ? "Recolher" : "Expandir"} a pasta ${f.name}`}
                style={{
                  ...itemBase,
                  width: 24,
                  minWidth: 24,
                  justifyContent: "center",
                  padding: 0,
                  color: "var(--muted)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "flex",
                    transform: aberta ? "none" : "rotate(-90deg)",
                    transition: "transform .18s ease",
                  }}
                >
                  <Ico name="chevronDown" size={13} />
                </span>
              </button>
            ) : (
              <span style={{ width: 24, minWidth: 24 }} aria-hidden="true" />
            )}

            <button
              type="button"
              className="forja-focus"
              onClick={() => onSelect && onSelect(f.id)}
              aria-current={on ? "true" : undefined}
              style={{ ...itemBase, ...(on ? ativoStyle : null), flex: 1, minWidth: 0 }}
            >
              <span style={{ display: "flex", color: on ? "var(--accent)" : "var(--muted)" }}>
                <Ico name="folder" size={15} />
              </span>
              <span style={ellipsis} title={f.name}>
                {f.name}
              </span>
              <span style={contagemStyle}>{counts[f.id] || 0}</span>
            </button>

            {on && onDelete && (
              <button
                type="button"
                className="forja-focus"
                onClick={() => onDelete(f)}
                disabled={busy}
                aria-label={`Excluir a pasta ${f.name}`}
                title="Excluir pasta"
                style={{
                  ...itemBase,
                  width: 32,
                  minWidth: 32,
                  justifyContent: "center",
                  padding: 0,
                  color: "var(--danger-text)",
                }}
              >
                <Ico name="trash" size={14} />
              </button>
            )}
          </div>
          {temFilhas && aberta && (
            <ul style={{ margin: 0, padding: 0 }}>{renderNivel(f.id, depth + 1)}</ul>
          )}
        </li>
      );
    });
  };

  const fixos = [
    { id: null, rotulo: "Tudo", contagem: totalCount },
    { id: NO_FOLDER, rotulo: "Sem pasta", contagem: looseCount },
  ];

  return (
    <>
      {/* ── mobile: o rail vira um select ── */}
      <div className="wk-folder-mobile" style={{ marginBottom: SP.x3 }}>
        <label style={{ display: "flex", alignItems: "center", gap: SP.x2 }}>
          <span style={{ ...T.section, fontSize: FS.micro, whiteSpace: "nowrap" }}>Pasta</span>
          <select
            className="forja-focus"
            value={activeId === null ? "" : activeId}
            onChange={(e) => onSelect && onSelect(e.target.value === "" ? null : e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: HIT.mobile,
              padding: `0 ${SP.x2}px`,
              background: SURF.raised,
              border: `1px solid ${LINE.raise}`,
              borderRadius: R.input,
              color: "var(--text)",
              fontFamily: FF.ui,
              fontSize: FS.input,
            }}
          >
            <option value="">Tudo ({totalCount})</option>
            <option value={NO_FOLDER}>Sem pasta ({looseCount})</option>
            {planas.map(({ folder, depth }) => (
              <option key={folder.id} value={folder.id}>
                {`${"— ".repeat(depth)}${folder.name} (${counts[folder.id] || 0})`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── desktop: COLUNA, não cartão ──────────────────────────────────
        * Era uma caixa de 200×175px com borda dourada e raio, encostada à
        * esquerda e terminando no meio do nada enquanto a grade seguia — um
        * cartãozinho perdido. Um filete vertical faz o trabalho. */}
      <nav
        className="wk-folders"
        aria-label="Pastas da wiki"
        style={{
          background: "transparent",
          borderRight: `1px solid ${LINE.hair}`,
          borderRadius: 0,
          padding: `0 ${SP.x3}px 0 0`,
        }}
      >
        <div style={{ ...T.section, padding: `${SP.x1}px ${SP.x2}px ${SP.x2}px` }}>Pastas</div>

        <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {fixos.map((f) => {
            const on = activeId === f.id;
            return (
              <li key={f.rotulo} style={{ listStyle: "none" }}>
                <button
                  type="button"
                  className="forja-focus"
                  onClick={() => onSelect && onSelect(f.id)}
                  aria-current={on ? "true" : undefined}
                  style={{ ...itemBase, ...(on ? ativoStyle : null) }}
                >
                  <span style={{ display: "flex", color: on ? "var(--accent)" : "var(--muted)" }}>
                    <Ico name="folder" size={15} />
                  </span>
                  <span style={ellipsis}>{f.rotulo}</span>
                  <span style={contagemStyle}>{f.contagem}</span>
                </button>
              </li>
            );
          })}
          {renderNivel(null, 0)}
        </ul>

        <div style={{ marginTop: SP.x2, borderTop: `1px solid ${LINE.hair}`, paddingTop: SP.x2 }}>
          {criando ? (
            <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
              <input
                autoFocus
                className="forja-focus"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmarCriacao();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    cancelarCriacao();
                  }
                }}
                aria-label="Nome da nova pasta"
                placeholder="Nome da pasta"
                style={{
                  width: "100%",
                  minHeight: HIT.mobile,
                  boxSizing: "border-box",
                  padding: `0 ${SP.x2}px`,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: R.input,
                  color: "var(--text)",
                  fontFamily: FF.ui,
                  fontSize: FS.input,
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: SP.x2 }}>
                <button
                  type="button"
                  className="forja-focus"
                  onClick={confirmarCriacao}
                  disabled={!nome.trim() || busy}
                  style={{
                    ...itemBase,
                    justifyContent: "center",
                    background: "var(--gold-dim)",
                    borderColor: LINE.gold,
                    color: "var(--accent)",
                    fontFamily: FF.title,
                    fontSize: FS.tag,
                    fontWeight: FW.bold,
                    letterSpacing: LS.tag,
                    textTransform: "uppercase",
                    opacity: !nome.trim() || busy ? 0.45 : 1,
                    cursor: !nome.trim() || busy ? "not-allowed" : "pointer",
                  }}
                >
                  Criar
                </button>
                <button
                  type="button"
                  className="forja-focus"
                  onClick={cancelarCriacao}
                  style={{ ...itemBase, justifyContent: "center", fontSize: FS.meta }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              ref={novaRef}
              type="button"
              className="forja-focus"
              onClick={() => setCriando(true)}
              style={{ ...itemBase, color: "var(--accent)" }}
            >
              <Ico name="plus" size={14} />
              Nova pasta
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
