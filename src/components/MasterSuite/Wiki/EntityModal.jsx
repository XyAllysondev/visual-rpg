/* Forja do Mestre — MODAL DE CRIAR/EDITAR ENTIDADE (spec 0027, AC-3/AC-8).
 *
 * Tipo (os 11), nome (obrigatório), descrição, tags livres e atributos chave/valor arbitrários.
 * Acessibilidade: `role="dialog" aria-modal`, foco preso dentro, Esc fecha, o foco volta para quem
 * abriu, e alteração não salva pede confirmação antes de sumir.
 *
 * Exporta também o `ConfirmDialog` — a mesma casca acessível reusada por toda ação destrutiva da
 * Wiki (apagar entidade, apagar pasta).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ENTITY_TYPES, getEntityType } from "../model/entityTypes";
import { normalize } from "../model/entityFilters";
import { SP, R, FF, FS, FW, LS, ELEV, SURF, HIT, T, tint, DANGER_TEXT_AA } from "../ui/tokens";
import { Btn } from "../ui/primitives";
import { EntityIcon, Ico } from "../ui/entityIcons";
import { achatarPastas } from "./FolderRail";

const FOCAVEIS =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Prende o foco no diálogo, devolve o foco ao gatilho ao fechar, trava o scroll do fundo e
 * transforma Esc em pedido de fechamento.
 */
function useDialogA11y(ref, onEscape) {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const anterior = document.activeElement;
    const alvo =
      node.querySelector("[data-dialog-autofocus]") || node.querySelector(FOCAVEIS) || node;
    if (alvo && typeof alvo.focus === "function") alvo.focus();

    const scrollAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const aoTeclar = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        if (escapeRef.current) escapeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focaveis = Array.from(node.querySelectorAll(FOCAVEIS)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    node.addEventListener("keydown", aoTeclar);
    return () => {
      node.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = scrollAnterior;
      if (anterior && typeof anterior.focus === "function") anterior.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ── Casca compartilhada ─────────────────────────────────────────────────── */

function DialogShell({ labelledBy, describedBy, role = "dialog", onDismiss, largura, children }) {
  const ref = useRef(null);
  useDialogA11y(ref, onDismiss);

  return createPortal(
    <div
      className="forja-overlay"
      onMouseDown={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        padding: SP.x4,
        background: "rgba(8,8,14,0.84)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        ref={ref}
        className="forja-modal"
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: `min(${largura}px, 100%)`,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          background: SURF.raised,
          border: "1px solid var(--border2)",
          borderRadius: R.panel,
          boxShadow: ELEV.e3,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ── Confirmação (toda ação destrutiva passa por aqui) ───────────────────── */

/**
 * @param {{ title: string, message: string, confirmLabel?: string, danger?: boolean,
 *           busy?: boolean, onConfirm: () => void, onCancel: () => void }} props
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Excluir",
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <DialogShell
      role="alertdialog"
      labelledBy="wk-confirm-title"
      describedBy="wk-confirm-msg"
      onDismiss={busy ? () => {} : onCancel}
      largura={440}
    >
      <div style={{ padding: `${SP.x5}px ${SP.x5}px ${SP.x4}px` }}>
        <h2
          id="wk-confirm-title"
          style={{ ...T.hero, fontSize: FS.h3, margin: 0, color: DANGER_TEXT_AA }}
        >
          {title}
        </h2>
        <p id="wk-confirm-msg" style={{ ...T.body, marginTop: SP.x3, marginBottom: 0 }}>
          {message}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: SP.x2,
          padding: `${SP.x3}px ${SP.x5}px calc(${SP.x4}px + env(safe-area-inset-bottom,0px))`,
          borderTop: `1px solid ${SURF.hair}`,
        }}
      >
        {/* o foco inicial cai no "Cancelar": ação destrutiva não começa com o dedo no gatilho */}
        <Btn kind="quiet" onClick={onCancel} disabled={busy}>
          Cancelar
        </Btn>
        <Btn
          kind={danger ? "danger" : "primary"}
          icon={danger ? "trash" : undefined}
          onClick={onConfirm}
          loading={busy}
        >
          {confirmLabel}
        </Btn>
      </div>
    </DialogShell>
  );
}

/* ── Campos ──────────────────────────────────────────────────────────────── */

const labelStyle = { ...T.section, display: "block", marginBottom: SP.x2, fontSize: 10 };

const campoStyle = (err) => ({
  width: "100%",
  minHeight: HIT.mobile,
  padding: `10px ${SP.x3}px`,
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${err ? "rgba(216,90,90,0.55)" : "rgba(255,255,255,0.12)"}`,
  borderRadius: R.input,
  color: "var(--text)",
  fontFamily: FF.ui,
  fontSize: FS.input,
  outline: "none",
  transition: "border-color .18s ease, background .18s ease",
});

let seqAtributo = 0;
const novaLinha = (key = "", value = "") => ({ uid: `attr-${(seqAtributo += 1)}`, key, value });

const listaAtributos = (attrs) =>
  (Array.isArray(attrs) ? attrs : [])
    .filter(Boolean)
    .map((a) => novaLinha(String(a.key ?? ""), String(a.value ?? "")));

/* ── Modal ───────────────────────────────────────────────────────────────── */

/**
 * @param {{
 *   mode: "criar"|"editar", initial?: object, folders?: Array, allTags?: string[],
 *   saving?: boolean, error?: ?string,
 *   onSave: (payload: object) => void, onDelete?: () => void, onClose: () => void,
 * }} props
 */
export default function EntityModal({
  mode = "criar",
  initial = null,
  folders = [],
  allTags = [],
  saving = false,
  error = null,
  onSave,
  onDelete,
  onClose,
}) {
  const [type, setType] = useState(initial?.type || ENTITY_TYPES[0].id);
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [tags, setTags] = useState(() =>
    Array.isArray(initial?.tags) ? initial.tags.map(String) : [],
  );
  const [tagInput, setTagInput] = useState("");
  const [folderId, setFolderId] = useState(initial?.folderId || "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [attrs, setAttrs] = useState(() => listaAtributos(initial?.attributes));
  const [erroNome, setErroNome] = useState(null);
  const [descartando, setDescartando] = useState(false);

  const nomeRef = useRef(null);
  const inicialRef = useRef(null);

  const payload = useMemo(
    () => ({
      type,
      name: name.trim(),
      description: description.trim(),
      tags: tags.map((t) => t.trim()).filter(Boolean),
      folderId: folderId || null,
      imageUrl: imageUrl.trim(),
      attributes: attrs
        .map((a) => ({ key: a.key.trim(), value: a.value.trim() }))
        .filter((a) => a.key),
    }),
    [type, name, description, tags, folderId, imageUrl, attrs],
  );

  /* baseline do "sujo": o payload do primeiro render, congelado */
  if (inicialRef.current === null) inicialRef.current = JSON.stringify(payload);
  const sujo = JSON.stringify(payload) !== inicialRef.current;

  const pastasPlanas = useMemo(() => achatarPastas(folders || []), [folders]);

  const sugestoes = useMemo(() => {
    const usadas = new Set(tags.map(normalize));
    return (allTags || []).filter((t) => !usadas.has(normalize(t))).slice(0, 6);
  }, [allTags, tags]);

  const pedirFechamento = useCallback(() => {
    if (saving) return;
    if (sujo) setDescartando(true);
    else onClose();
  }, [saving, sujo, onClose]);

  const adicionarTag = (bruta) => {
    const limpa = String(bruta || "").trim().replace(/^#/, "");
    if (!limpa) return;
    setTags((prev) =>
      prev.some((t) => normalize(t) === normalize(limpa)) ? prev : [...prev, limpa],
    );
    setTagInput("");
  };

  const submeter = (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (!payload.name) {
      setErroNome("Dê um nome à entidade antes de salvar.");
      if (nomeRef.current) nomeRef.current.focus();
      return;
    }
    setErroNome(null);
    if (onSave) onSave(payload);
  };

  const tipoAtual = getEntityType(type);

  return (
    <DialogShell labelledBy="wk-modal-title" onDismiss={pedirFechamento} largura={680}>
      {/* ── header ── */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: SP.x3,
          padding: `${SP.x4}px ${SP.x5}px`,
          borderBottom: `1px solid ${SURF.hair}`,
        }}
      >
        <h2
          id="wk-modal-title"
          style={{ ...T.hero, fontSize: FS.h2, margin: 0, color: "var(--accent2)" }}
        >
          {mode === "criar" ? "Nova entidade" : "Editar entidade"}
        </h2>
        <button
          type="button"
          className="forja-focus"
          onClick={pedirFechamento}
          aria-label="Fechar"
          style={{
            marginLeft: "auto",
            width: HIT.mobile,
            height: HIT.mobile,
            background: "none",
            border: "none",
            borderRadius: R.input,
            cursor: "pointer",
            color: "var(--muted2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ico name="close" size={20} />
        </button>
      </div>

      {/* ── corpo ── */}
      <form
        onSubmit={submeter}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: SP.x5,
          opacity: saving ? 0.65 : 1,
          pointerEvents: saving ? "none" : "auto",
        }}
      >
        {error && (
          <div
            role="alert"
            style={{
              display: "flex",
              gap: SP.x3,
              padding: SP.x3,
              marginBottom: SP.x4,
              background: "rgba(139,26,26,0.10)",
              border: "1px solid rgba(216,90,90,0.34)",
              borderRadius: R.card,
              ...T.meta,
              color: DANGER_TEXT_AA,
            }}
          >
            <span style={{ display: "flex", flexShrink: 0 }}>
              <Ico name="warn" size={18} />
            </span>
            <span>{error}</span>
          </div>
        )}

        {/* tipo */}
        <span style={labelStyle} id="wk-tipo-label">
          Tipo
        </span>
        <div
          className="forja-grid-types"
          role="radiogroup"
          aria-labelledby="wk-tipo-label"
          onKeyDown={(e) => {
            const idx = ENTITY_TYPES.findIndex((t) => t.id === type);
            let prox = null;
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              prox = (idx + 1) % ENTITY_TYPES.length;
            }
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              prox = (idx - 1 + ENTITY_TYPES.length) % ENTITY_TYPES.length;
            }
            if (prox === null) return;
            e.preventDefault();
            setType(ENTITY_TYPES[prox].id);
            const alvo = e.currentTarget.querySelectorAll("[role='radio']")[prox];
            if (alvo) alvo.focus();
          }}
        >
          {ENTITY_TYPES.map((t) => {
            const on = t.id === type;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                title={t.hint}
                className="forja-focus"
                onClick={() => setType(t.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: SP.x1,
                  minHeight: 72,
                  padding: SP.x2,
                  cursor: "pointer",
                  borderRadius: R.input,
                  touchAction: "manipulation",
                  background: on ? t.color : tint(t.color, 0.08),
                  border: `1px solid ${on ? t.color : tint(t.color, 0.24)}`,
                  color: on ? "#14141c" : t.color,
                  transition: "background .15s ease, color .15s ease, border-color .15s ease",
                }}
              >
                <EntityIcon type={t.id} size={22} />
                <span
                  style={{
                    fontFamily: FF.title,
                    fontSize: FS.tag,
                    fontWeight: FW.semi,
                    letterSpacing: LS.tag,
                    textTransform: "uppercase",
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* nome */}
        <label htmlFor="wk-nome" style={{ ...labelStyle, marginTop: SP.x5 }}>
          Nome <span style={{ color: DANGER_TEXT_AA }}>*</span>
        </label>
        <input
          id="wk-nome"
          ref={nomeRef}
          data-dialog-autofocus
          className="forja-focus"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (erroNome && e.target.value.trim()) setErroNome(null);
          }}
          onBlur={() => setErroNome(name.trim() ? null : "Dê um nome à entidade antes de salvar.")}
          aria-invalid={erroNome ? "true" : undefined}
          aria-describedby={erroNome ? "wk-nome-erro" : undefined}
          placeholder={`Nome — ${tipoAtual.label}`}
          style={campoStyle(erroNome)}
        />
        {erroNome && (
          <div
            id="wk-nome-erro"
            role="alert"
            style={{ ...T.meta, fontSize: FS.micro, marginTop: SP.x1, color: DANGER_TEXT_AA }}
          >
            {erroNome}
          </div>
        )}

        {/* descrição */}
        <label htmlFor="wk-desc" style={{ ...labelStyle, marginTop: SP.x4 }}>
          Descrição
        </label>
        <textarea
          id="wk-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="forja-focus"
          rows={7}
          placeholder="O que o mestre precisa lembrar sobre isto na hora da mesa."
          style={{ ...campoStyle(false), minHeight: 150, lineHeight: 1.65, resize: "vertical" }}
        />

        {/* tags */}
        <span style={{ ...labelStyle, marginTop: SP.x4 }} id="wk-tags-label">
          Tags
        </span>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: SP.x2,
            alignItems: "center",
            padding: SP.x2,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: R.input,
          }}
        >
          {tags.map((t) => (
            <span
              key={t}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: SP.x1,
                padding: `4px ${SP.x2}px`,
                background: "var(--gold-dim)",
                border: "1px solid var(--border2)",
                borderRadius: R.pill,
                color: "var(--accent)",
                fontFamily: FF.ui,
                fontSize: FS.meta,
              }}
            >
              #{t}
              <button
                type="button"
                className="forja-focus"
                onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                aria-label={`Remover a tag ${t}`}
                style={{
                  display: "flex",
                  width: 22,
                  height: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                }}
              >
                <Ico name="close" size={12} />
              </button>
            </span>
          ))}
          <input
            aria-labelledby="wk-tags-label"
            className="forja-focus"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                adicionarTag(tagInput);
              } else if (e.key === "Backspace" && !tagInput && tags.length) {
                setTags((prev) => prev.slice(0, -1));
              }
            }}
            onBlur={() => adicionarTag(tagInput)}
            placeholder="digite e tecle Enter"
            style={{
              flex: "1 1 140px",
              minWidth: 120,
              minHeight: 32,
              background: "transparent",
              border: "none",
              color: "var(--text)",
              fontFamily: FF.ui,
              fontSize: FS.input,
              outline: "none",
            }}
          />
        </div>
        {sugestoes.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: SP.x2,
              marginTop: SP.x2,
              alignItems: "center",
            }}
          >
            <span style={{ ...T.meta, fontSize: FS.micro }}>Já usadas neste mundo:</span>
            {sugestoes.map((t) => (
              <button
                key={t}
                type="button"
                className="forja-focus"
                onClick={() => adicionarTag(t)}
                style={{
                  padding: `4px ${SP.x2}px`,
                  background: "transparent",
                  border: `1px solid ${SURF.hair}`,
                  borderRadius: R.tag,
                  cursor: "pointer",
                  color: "var(--muted2)",
                  fontFamily: FF.ui,
                  fontSize: FS.micro,
                }}
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        {/* pasta + imagem */}
        <div className="wk-two-cols" style={{ marginTop: SP.x4 }}>
          <div>
            <label htmlFor="wk-pasta" style={labelStyle}>
              Pasta
            </label>
            <select
              id="wk-pasta"
              value={folderId || ""}
              onChange={(e) => setFolderId(e.target.value)}
              className="forja-focus"
              style={{ ...campoStyle(false), cursor: "pointer" }}
            >
              <option value="">Sem pasta</option>
              {pastasPlanas.map(({ folder, depth }) => (
                <option key={folder.id} value={folder.id}>
                  {`${"— ".repeat(depth)}${folder.name}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wk-imagem" style={labelStyle}>
              Imagem (URL)
            </label>
            <input
              id="wk-imagem"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="forja-focus"
              placeholder="https://…"
              style={campoStyle(false)}
            />
          </div>
        </div>

        {/* atributos */}
        <span style={{ ...labelStyle, marginTop: SP.x5 }}>Atributos</span>
        {attrs.length === 0 && (
          <p style={{ ...T.empty, margin: `0 0 ${SP.x2}px` }}>
            Sem atributos ainda. Idade, patente, população, elemento — o que fizer sentido para
            este tipo.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
          {attrs.map((linha, i) => (
            <div key={linha.uid} className="wk-attr-row">
              <input
                value={linha.key}
                onChange={(e) =>
                  setAttrs((prev) =>
                    prev.map((x) => (x.uid === linha.uid ? { ...x, key: e.target.value } : x)),
                  )
                }
                className="forja-focus"
                aria-label={`Nome do atributo ${i + 1}`}
                placeholder="Chave"
                style={campoStyle(false)}
              />
              <input
                value={linha.value}
                onChange={(e) =>
                  setAttrs((prev) =>
                    prev.map((x) => (x.uid === linha.uid ? { ...x, value: e.target.value } : x)),
                  )
                }
                className="forja-focus"
                aria-label={`Valor do atributo ${i + 1}`}
                placeholder="Valor"
                style={campoStyle(false)}
              />
              <button
                type="button"
                className="forja-focus"
                onClick={() => setAttrs((prev) => prev.filter((x) => x.uid !== linha.uid))}
                aria-label={`Remover o atributo ${linha.key || i + 1}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: HIT.mobile,
                  minHeight: HIT.mobile,
                  background: "transparent",
                  border: `1px solid ${SURF.hair}`,
                  borderRadius: R.input,
                  cursor: "pointer",
                  color: "var(--muted2)",
                }}
              >
                <Ico name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: SP.x2 }}>
          <Btn
            kind="quiet"
            size="sm"
            icon="plus"
            onClick={() => setAttrs((prev) => [...prev, novaLinha()])}
          >
            Adicionar atributo
          </Btn>
        </div>
      </form>

      {/* ── footer ── */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: SP.x2,
          flexWrap: "wrap",
          padding: `${SP.x3}px ${SP.x5}px calc(${SP.x3}px + env(safe-area-inset-bottom,0px))`,
          borderTop: `1px solid ${SURF.hair}`,
        }}
      >
        {descartando ? (
          <>
            <span role="alert" style={{ ...T.meta, flex: 1, minWidth: 160 }}>
              Descartar as alterações?
            </span>
            <Btn kind="quiet" onClick={() => setDescartando(false)}>
              Continuar editando
            </Btn>
            <Btn kind="danger" onClick={onClose}>
              Descartar
            </Btn>
          </>
        ) : (
          <>
            {mode === "editar" && onDelete && (
              <Btn kind="danger" size="sm" icon="trash" onClick={onDelete} disabled={saving}>
                Excluir
              </Btn>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: SP.x2 }}>
              <Btn kind="quiet" onClick={pedirFechamento} disabled={saving}>
                Cancelar
              </Btn>
              <Btn
                kind="primary"
                icon="spark"
                onClick={submeter}
                loading={saving}
                disabled={!name.trim()}
              >
                Salvar
              </Btn>
            </div>
          </>
        )}
      </div>
    </DialogShell>
  );
}
