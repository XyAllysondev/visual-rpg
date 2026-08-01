/* ════════════════════════════════════════════════════════════════════
 *  FORJA DO MESTRE — FORJAR MUNDO  (spec 0027 · AC-2)
 *  --------------------------------------------------------------------
 *  Nome obrigatório; descrição e gênero opcionais. O modal não conhece o
 *  Firestore: recebe `onCreate(payload)` (uma Promise) e cuida só do
 *  formulário, do estado de salvamento e da mensagem de erro.
 *
 *  Acessibilidade: `role="dialog"` + `aria-modal`, foco inicial no campo
 *  Nome, armadilha de foco no Tab, Esc fecha (com confirmação quando há
 *  alterações) e o foco volta para quem abriu.
 * ════════════════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Btn } from "./ui/primitives";
import { Ico } from "./ui/entityIcons";
import { SP, R, FF, FS, SURF, HIT, ELEV, T, DANGER_TEXT_AA } from "./ui/tokens";

const GENEROS = [
  "Horror paranormal", "Fantasia medieval", "Fantasia sombria", "Cyberpunk",
  "Pós-apocalíptico", "Investigação urbana", "Space opera", "Steampunk",
];

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

const campoStyle = (erro) => ({
  width: "100%", boxSizing: "border-box",
  minHeight: HIT.mobile, padding: `10px ${SP.x3}px`,
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${erro ? "rgba(216,90,90,0.55)" : "rgba(255,255,255,0.12)"}`,
  borderRadius: R.input, color: "var(--text)",
  fontFamily: FF.ui, fontSize: FS.input, outline: "none",
  transition: "border-color .18s ease, background .18s ease",
});

/**
 * @param {{onClose:Function, onCreate:(payload:{name:string,description:string,genre:string})=>Promise<any>}} props
 */
export default function WorldModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [erro, setErro] = useState("");
  const [falha, setFalha] = useState("");
  const [saving, setSaving] = useState(false);

  const dialogRef = useRef(null);
  const nomeRef = useRef(null);
  const gatilhoRef = useRef(null);

  const sujo = !!(name.trim() || description.trim() || genre.trim());

  /* Guarda quem abriu e devolve o foco ao desmontar. */
  useEffect(() => {
    gatilhoRef.current = typeof document !== "undefined" ? document.activeElement : null;
    const alvo = nomeRef.current;
    const t = setTimeout(() => { if (alvo) alvo.focus(); }, 30);
    return () => {
      clearTimeout(t);
      const el = gatilhoRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, []);

  const tentarFechar = useCallback(() => {
    if (saving) return;
    if (sujo && typeof window !== "undefined"
      && !window.confirm("Descartar as alterações e fechar?")) return;
    onClose();
  }, [saving, sujo, onClose]);

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
      setErro("Dê um nome ao mundo antes de criá-lo.");
      if (nomeRef.current) nomeRef.current.focus();
      return;
    }
    setErro("");
    setFalha("");
    setSaving(true);
    try {
      await onCreate({ name: nome, description: description.trim(), genre: genre.trim() });
    } catch (err) {
      setFalha(err?.message || "Não foi possível criar o mundo. Tente de novo em instantes.");
      setSaving(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="forja-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) tentarFechar(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 400, padding: SP.x4,
        background: "rgba(8,8,14,0.84)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <form
        ref={dialogRef}
        className="forja-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forja-world-modal-tit"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submeter}
        style={{
          width: "min(560px,100%)", maxHeight: "88vh", display: "flex", flexDirection: "column",
          background: SURF.raised, border: "1px solid var(--border2)",
          borderRadius: R.panel, boxShadow: ELEV.e3, overflow: "hidden",
        }}
      >
        {/* header */}
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: SP.x3,
          padding: `${SP.x4}px ${SP.x5}px`, borderBottom: `1px solid ${SURF.hair}`,
        }}>
          <span style={{ color: "var(--accent)", display: "flex" }}><Ico name="forge" size={20} /></span>
          <h2 id="forja-world-modal-tit" style={{ ...T.hero, fontSize: FS.h2, margin: 0, color: "var(--accent2)" }}>
            Forjar mundo
          </h2>
          <button
            type="button" onClick={tentarFechar} aria-label="Fechar" className="forja-focus"
            style={{
              marginLeft: "auto", width: HIT.mobile, height: HIT.mobile, background: "none",
              border: "none", borderRadius: R.input, cursor: "pointer", color: "var(--muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Ico name="close" size={20} />
          </button>
        </div>

        {/* corpo */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: SP.x5 }}>
          <label htmlFor="forja-world-name" style={{ ...T.section, display: "block", fontSize: 10, marginBottom: SP.x2 }}>
            Nome<span style={{ color: DANGER_TEXT_AA, marginLeft: 3 }}>*</span>
          </label>
          <input
            id="forja-world-name" ref={nomeRef} value={name}
            className="forja-focus"
            onChange={(e) => { setName(e.target.value); if (erro) setErro(""); }}
            onBlur={() => setErro(name.trim() ? "" : "Dê um nome ao mundo antes de criá-lo.")}
            placeholder="Vale de Cinzas"
            maxLength={80}
            aria-invalid={!!erro}
            aria-describedby={erro ? "forja-world-name-err" : undefined}
            style={campoStyle(erro)}
          />
          {erro ? (
            <div id="forja-world-name-err" role="alert"
              style={{ ...T.meta, fontSize: FS.micro, marginTop: SP.x1, color: DANGER_TEXT_AA }}>
              {erro}
            </div>
          ) : null}

          <label htmlFor="forja-world-genre" style={{ ...T.section, display: "block", fontSize: 10, margin: `${SP.x4}px 0 ${SP.x2}px` }}>
            Gênero <span style={{ color: "var(--muted)", letterSpacing: 0, textTransform: "none" }}>(opcional)</span>
          </label>
          <input
            id="forja-world-genre" value={genre} onChange={(e) => setGenre(e.target.value)}
            className="forja-focus"
            list="forja-generos" placeholder="Horror paranormal" maxLength={60}
            style={campoStyle(false)}
          />
          <datalist id="forja-generos">
            {GENEROS.map((g) => <option key={g} value={g} />)}
          </datalist>

          <label htmlFor="forja-world-desc" style={{ ...T.section, display: "block", fontSize: 10, margin: `${SP.x4}px 0 ${SP.x2}px` }}>
            Descrição <span style={{ color: "var(--muted)", letterSpacing: 0, textTransform: "none" }}>(opcional)</span>
          </label>
          <textarea
            id="forja-world-desc" value={description} onChange={(e) => setDescription(e.target.value)}
            className="forja-focus"
            rows={5} maxLength={600}
            placeholder="Uma bacia industrial esquecida onde a chuva cai preta desde o Incidente."
            style={{ ...campoStyle(false), minHeight: 120, padding: SP.x3, lineHeight: 1.65, resize: "vertical" }}
          />
          <div style={{ ...T.meta, fontSize: FS.micro, marginTop: SP.x1 }}>
            Dá para mudar tudo isso depois — o mundo só precisa de um nome para começar.
          </div>

          {falha ? (
            <div role="alert" style={{
              display: "flex", alignItems: "flex-start", gap: SP.x3, marginTop: SP.x4, padding: SP.x3,
              background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
              borderRadius: R.card,
            }}>
              <span style={{ color: "var(--danger-text)", flexShrink: 0, display: "flex" }}>
                <Ico name="warn" size={18} />
              </span>
              <div style={{ ...T.meta, color: "var(--text)" }}>{falha}</div>
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: SP.x2,
          padding: `${SP.x3}px ${SP.x5}px calc(${SP.x3}px + env(safe-area-inset-bottom,0px))`,
          borderTop: `1px solid ${SURF.hair}`,
        }}>
          <div style={{ marginLeft: "auto", display: "flex", gap: SP.x2 }}>
            <Btn kind="quiet" onClick={tentarFechar} disabled={saving}>Cancelar</Btn>
            <Btn kind="primary" icon="spark" type="submit" loading={saving} disabled={!name.trim()}>
              Forjar
            </Btn>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
