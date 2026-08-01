/* ════════════════════════════════════════════════════════════════════
 *  EDITOR DO GRAFO — CONFIRMAR REMOÇÃO  (spec 0028 · F2 · AC-4)
 *  --------------------------------------------------------------------
 *  Apagar um lugar leva junto TODAS as trilhas que chegam nele — a regra é
 *  de `model/graph.js` (`removerNo`) e o diálogo diz quantas, antes, não
 *  depois. Trilha órfã não pode existir, então não há como oferecer "apagar
 *  só o lugar".
 *
 *  `role="alertdialog"`, foco inicial no botão SEGURO, Esc cancela, Tab
 *  circula dentro do diálogo e o foco volta a quem abriu.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SP, R, T, FS, SURF, ELEV, btnStyle, mensagemDeErro } from "../Atelier/ui";

const FOCAVEIS = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

/**
 * @param {object} props
 * @param {string} props.titulo
 * @param {React.ReactNode} props.descricao
 * @param {string} [props.rotuloConfirmar]
 * @param {()=>void} props.onFechar
 * @param {()=>Promise<any>} props.onConfirmar
 */
export default function ConfirmarRemocao({
  titulo,
  descricao,
  rotuloConfirmar = "Apagar",
  onFechar,
  onConfirmar,
}) {
  const [apagando, setApagando] = useState(false);
  const [falha, setFalha] = useState("");
  const caixaRef = useRef(null);
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
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); return; }
      if (e.key !== "Tab") return;
      const box = caixaRef.current;
      if (!box) return;
      const itens = Array.from(box.querySelectorAll(FOCAVEIS));
      if (!itens.length) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
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
        position: "fixed", inset: 0, zIndex: 430, padding: SP.x4,
        background: "rgba(8,8,14,0.84)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        ref={caixaRef}
        className="wm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wme-conf-tit"
        aria-describedby="wme-conf-desc"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(440px,100%)", background: SURF.raised,
          border: "1px solid rgba(216,90,90,0.34)", borderRadius: R.panel,
          boxShadow: ELEV.e3, padding: SP.x5,
        }}
      >
        <h2 id="wme-conf-tit" style={{ ...T.hero, fontSize: FS.h3, margin: `0 0 ${SP.x3}px` }}>
          {titulo}
        </h2>
        <div id="wme-conf-desc" style={{ ...T.body, color: "var(--muted2)" }}>
          {descricao}
        </div>

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
          <button type="button" ref={cancelarRef} className="wme-focus" onClick={fechar} disabled={apagando}
            style={{ ...btnStyle("quiet"), opacity: apagando ? 0.5 : 1 }}>
            Cancelar
          </button>
          <button type="button" className="wme-focus" onClick={confirmar} disabled={apagando}
            style={{ ...btnStyle("danger"), opacity: apagando ? 0.6 : 1 }}>
            {apagando ? "Apagando…" : rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
