/* ════════════════════════════════════════════════════════════════════
 *  ATELIÊ — CONFIRMAR EXCLUSÃO DO MOLDE  (spec 0028 · F1 · AC-2)
 *  --------------------------------------------------------------------
 *  `role="alertdialog"`: o foco entra no botão SEGURO (Cancelar), Esc
 *  cancela e o foco volta a quem abriu. Apagar um molde leva junto nós,
 *  trilhas e a ilustração — o diálogo diz isso antes, não depois.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SP, R, T, FS, SURF, LINE, ELEV, btnStyle, mensagemDeErro } from "./ui";

/**
 * @param {object} props
 * @param {{id:string,name?:string}} props.molde
 * @param {Function} props.onFechar
 * @param {()=>Promise<any>} props.onConfirmar
 */
export default function ConfirmarExclusao({ molde, onFechar, onConfirmar }) {
  const [apagando, setApagando] = useState(false);
  const [falha, setFalha] = useState("");
  const cancelarRef = useRef(null);
  const gatilhoRef = useRef(null);

  useEffect(() => {
    gatilhoRef.current = typeof document !== "undefined" ? document.activeElement : null;
    const alvo = cancelarRef.current;
    const t = setTimeout(() => { if (alvo) alvo.focus(); }, 30);
    return () => {
      clearTimeout(t);
      const el = gatilhoRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, []);

  const fechar = useCallback(() => { if (!apagando) onFechar(); }, [apagando, onFechar]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); fechar(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fechar]);

  const confirmar = async () => {
    setFalha("");
    setApagando(true);
    try {
      await onConfirmar();
    } catch (err) {
      setFalha(mensagemDeErro(err));
      setApagando(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="wm-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 420, padding: SP.x4,
        background: "rgba(8,8,14,0.84)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        className="wm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wm-del-tit"
        aria-describedby="wm-del-desc"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(440px,100%)", background: SURF.raised, border: "1px solid rgba(216,90,90,0.34)",
          borderRadius: R.panel, boxShadow: ELEV.e3, padding: SP.x5,
        }}
      >
        <h2 id="wm-del-tit" style={{ ...T.hero, fontSize: FS.h3, margin: `0 0 ${SP.x3}px` }}>
          Excluir mapa-múndi?
        </h2>
        <p id="wm-del-desc" style={{ ...T.body, margin: 0, color: "var(--muted2)" }}>
          <strong style={{ color: "var(--text)" }}>{molde?.name || "Este mapa"}</strong> some com
          tudo que estiver dentro: nós, trilhas e a ilustração de fundo. Não dá para desfazer.
        </p>

        {falha ? (
          <div role="alert" style={{
            marginTop: SP.x4, padding: SP.x3, borderRadius: R.card,
            background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
            ...T.meta, color: "var(--text)",
          }}>
            {falha}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: SP.x2, marginTop: SP.x5 }}>
          <button type="button" ref={cancelarRef} className="wm-focus" onClick={fechar} disabled={apagando}
            style={{ ...btnStyle("quiet"), opacity: apagando ? 0.5 : 1 }}>
            Cancelar
          </button>
          <button type="button" className="wm-focus" onClick={confirmar} disabled={apagando}
            style={{ ...btnStyle("danger"), opacity: apagando ? 0.6 : 1 }}>
            {apagando ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
