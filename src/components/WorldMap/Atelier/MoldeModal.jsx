/* ════════════════════════════════════════════════════════════════════
 *  ATELIÊ — CRIAR / RENOMEAR MOLDE  (spec 0028 · F1 · AC-2)
 *  --------------------------------------------------------------------
 *  Nome obrigatório, descrição opcional. O modal não conhece o Firestore:
 *  recebe `onSalvar(payload)` (uma Promise) e cuida só do formulário, do
 *  estado de salvamento e da mensagem de erro — inclusive a recusa por
 *  cota, que o store devolve como Error em português (AC-3).
 *
 *  Acessibilidade: `role="dialog"` + `aria-modal`, foco inicial no campo
 *  Nome, armadilha de foco no Tab, Esc fecha e o foco volta a quem abriu.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SP, R, FF, FS, T, HIT, SURF, LINE, ELEV,
  btnStyle, campoStyle, mensagemDeErro, DANGER_TEXT_AA,
} from "./ui";

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

/**
 * @param {object} props
 * @param {'criar'|'renomear'} props.modo
 * @param {{name?:string,description?:string}} [props.molde]  valores iniciais (renomear)
 * @param {Function} props.onFechar
 * @param {(p:{name:string,description:string})=>Promise<any>} props.onSalvar
 */
export default function MoldeModal({ modo = "criar", molde, onFechar, onSalvar }) {
  const criando = modo === "criar";
  const [name, setName] = useState(molde?.name || "");
  const [description, setDescription] = useState(molde?.description || "");
  const [erro, setErro] = useState("");
  const [falha, setFalha] = useState("");
  const [salvando, setSalvando] = useState(false);

  const dialogRef = useRef(null);
  const nomeRef = useRef(null);
  const gatilhoRef = useRef(null);

  const sujo = criando
    ? !!(name.trim() || description.trim())
    : name.trim() !== (molde?.name || "") || description.trim() !== (molde?.description || "");

  /* Guarda quem abriu e devolve o foco ao desmontar. */
  useEffect(() => {
    gatilhoRef.current = typeof document !== "undefined" ? document.activeElement : null;
    const alvo = nomeRef.current;
    const t = setTimeout(() => { if (alvo) { alvo.focus(); alvo.select?.(); } }, 30);
    return () => {
      clearTimeout(t);
      const el = gatilhoRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, []);

  const tentarFechar = useCallback(() => {
    if (salvando) return;
    if (sujo && typeof window !== "undefined"
      && !window.confirm("Descartar as alterações e fechar?")) return;
    onFechar();
  }, [salvando, sujo, onFechar]);

  /* Esc fecha; Tab circula dentro do diálogo. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); tentarFechar(); return; }
      if (e.key !== "Tab") return;
      const box = dialogRef.current;
      if (!box) return;
      const itens = Array.from(box.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!itens.length) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tentarFechar]);

  const submeter = async (e) => {
    if (e) e.preventDefault();
    const nome = name.trim();
    if (!nome) {
      setErro("Dê um nome ao mapa-múndi antes de continuar.");
      if (nomeRef.current) nomeRef.current.focus();
      return;
    }
    setErro("");
    setFalha("");
    setSalvando(true);
    try {
      await onSalvar({ name: nome, description: description.trim() });
    } catch (err) {
      /* A recusa por cota chega aqui: o mestre vê o motivo, não um vazio
       * que não acontece nada quando ele clica (AC-3). */
      setFalha(mensagemDeErro(err));
      setSalvando(false);
    }
  };

  if (typeof document === "undefined") return null;

  const titulo = criando ? "Novo mapa-múndi" : "Renomear mapa-múndi";

  return createPortal(
    <div
      className="wm-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) tentarFechar(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 400, padding: SP.x4,
        background: "rgba(8,8,14,0.84)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <form
        ref={dialogRef}
        className="wm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wm-modal-tit"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submeter}
        style={{
          width: "min(540px,100%)", maxHeight: "88vh", display: "flex", flexDirection: "column",
          background: SURF.raised, border: "1px solid var(--border2)",
          borderRadius: R.panel, boxShadow: ELEV.e3, overflow: "hidden",
        }}
      >
        {/* header */}
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: SP.x3,
          padding: `${SP.x4}px ${SP.x5}px`, borderBottom: `1px solid ${LINE.edge}`,
        }}>
          <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>🗺️</span>
          <h2 id="wm-modal-tit" style={{ ...T.hero, fontSize: FS.h2, margin: 0, color: "var(--gold2,var(--gold))" }}>
            {titulo}
          </h2>
          <button
            type="button" onClick={tentarFechar} aria-label="Fechar" className="wm-focus"
            style={{
              marginLeft: "auto", width: HIT.mobile, height: HIT.mobile, background: "none",
              border: "none", borderRadius: R.input, cursor: "pointer", color: "var(--muted)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        {/* corpo */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: SP.x5 }}>
          <label htmlFor="wm-molde-nome" style={{ ...T.section, display: "block", fontSize: 10, marginBottom: SP.x2 }}>
            Nome<span style={{ color: DANGER_TEXT_AA, marginLeft: 3 }}>*</span>
          </label>
          <input
            id="wm-molde-nome" ref={nomeRef} value={name}
            className="wm-focus"
            onChange={(e) => { setName(e.target.value); if (erro) setErro(""); }}
            placeholder="As Terras Partidas"
            maxLength={80}
            aria-invalid={erro ? "true" : undefined}
            aria-describedby={erro ? "wm-molde-nome-err" : undefined}
            style={campoStyle(!!erro)}
          />
          {erro ? (
            <div id="wm-molde-nome-err" role="alert"
              style={{ ...T.meta, fontSize: FS.micro, marginTop: SP.x1, color: DANGER_TEXT_AA }}>
              {erro}
            </div>
          ) : null}

          <label htmlFor="wm-molde-desc" style={{ ...T.section, display: "block", fontSize: 10, margin: `${SP.x4}px 0 ${SP.x2}px` }}>
            Descrição <span style={{ color: "var(--muted)", letterSpacing: 0, textTransform: "none" }}>(opcional)</span>
          </label>
          <textarea
            id="wm-molde-desc" value={description} onChange={(e) => setDescription(e.target.value)}
            className="wm-focus"
            rows={4} maxLength={600}
            placeholder="Um continente rachado ao meio pelo Incidente, com estradas que ninguém mais percorre inteiras."
            style={{ ...campoStyle(false), minHeight: 104, padding: SP.x3, lineHeight: 1.65, resize: "vertical", fontFamily: FF.ui }}
          />
          <div style={{ ...T.meta, fontSize: FS.micro, marginTop: SP.x1 }}>
            Só o nome é obrigatório. A ilustração de fundo entra depois, dentro do mapa.
          </div>

          {falha ? (
            <div role="alert" style={{
              display: "flex", alignItems: "flex-start", gap: SP.x3, marginTop: SP.x4, padding: SP.x3,
              background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
              borderRadius: R.card,
            }}>
              <span aria-hidden="true" style={{ color: "var(--danger-text)", flexShrink: 0 }}>⚠</span>
              <div style={{ ...T.meta, color: "var(--text)" }}>{falha}</div>
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: SP.x2,
          padding: `${SP.x3}px ${SP.x5}px calc(${SP.x3}px + env(safe-area-inset-bottom,0px))`,
          borderTop: `1px solid ${LINE.edge}`,
        }}>
          <div style={{ marginLeft: "auto", display: "flex", gap: SP.x2 }}>
            <button type="button" className="wm-focus" onClick={tentarFechar} disabled={salvando}
              style={{ ...btnStyle("quiet"), opacity: salvando ? 0.5 : 1 }}>
              Cancelar
            </button>
            <button type="submit" className="wm-focus" disabled={salvando || !name.trim()}
              style={{ ...btnStyle("primary"), opacity: (salvando || !name.trim()) ? 0.55 : 1,
                cursor: (salvando || !name.trim()) ? "default" : "pointer" }}>
              {salvando ? "Salvando…" : (criando ? "Criar mapa" : "Salvar")}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
