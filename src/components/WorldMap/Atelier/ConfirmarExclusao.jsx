/* ════════════════════════════════════════════════════════════════════
 *  ATELIÊ — CONFIRMAR EXCLUSÃO DO MOLDE  (spec 0028 · F1 · AC-2)
 *  --------------------------------------------------------------------
 *  `role="alertdialog"`: o foco entra no botão SEGURO (Cancelar), Esc
 *  cancela e o foco volta a quem abriu. Apagar um molde leva junto nós,
 *  trilhas e a ilustração — o diálogo diz isso antes, não depois.
 *
 *  ── DUAS CONVERSAS DIFERENTES (AC-13) ──────────────────────────────
 *  Tirar o MAPA PADRÃO da lista não é apagar um mapa autoral: nada do
 *  mestre se perde, nada é destruído, e dá para trazer de volta a
 *  qualquer momento. Usar a mesma frase assustadora nos dois casos seria
 *  mentir — ou assustando à toa, ou (pior) ensinando o mestre a ignorar o
 *  aviso quando ele for de verdade. Por isso `padrao` troca título, texto,
 *  rótulo do botão e o cromo de perigo por um cromo neutro.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SP, R, T, FS, SURF, LINE, ELEV, btnStyle, mensagemDeErro } from "./ui";

/**
 * @param {object} props
 * @param {{id:string,name?:string}} props.molde
 * @param {boolean} [props.padrao] o alvo é o mapa padrão do sistema (AC-13)
 * @param {Function} props.onFechar
 * @param {()=>Promise<any>} props.onConfirmar
 */
export default function ConfirmarExclusao({ molde, padrao = false, onFechar, onConfirmar }) {
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
          width: "min(440px,100%)", background: SURF.raised,
          border: `1px solid ${padrao ? LINE.gold : "rgba(216,90,90,0.34)"}`,
          borderRadius: R.panel, boxShadow: ELEV.e3, padding: SP.x5,
        }}
      >
        <h2 id="wm-del-tit" style={{ ...T.hero, fontSize: FS.h3, margin: `0 0 ${SP.x3}px` }}>
          {padrao ? "Tirar o mapa padrão da sua lista?" : "Excluir mapa-múndi?"}
        </h2>
        {padrao ? (
          <p id="wm-del-desc" style={{ ...T.body, margin: 0, color: "var(--muted2)" }}>
            <strong style={{ color: "var(--text)" }}>{molde?.name || "Este mapa"}</strong> é um mapa
            que já vem no Nexus, não um mapa seu. <strong style={{ color: "var(--text)" }}>Nada é
            apagado</strong>: nenhuma cópia que você tenha feito dele se perde, e ele só deixa de
            aparecer aqui. Dá para trazê-lo de volta quando quiser, pelo próprio ateliê.
          </p>
        ) : (
          <p id="wm-del-desc" style={{ ...T.body, margin: 0, color: "var(--muted2)" }}>
            <strong style={{ color: "var(--text)" }}>{molde?.name || "Este mapa"}</strong> some com
            tudo que estiver dentro: nós, trilhas e a ilustração de fundo. Não dá para desfazer.
          </p>
        )}

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
            style={{ ...btnStyle(padrao ? "ghost" : "danger"), opacity: apagando ? 0.6 : 1 }}>
            {padrao
              ? (apagando ? "Tirando…" : "Tirar da lista")
              : (apagando ? "Excluindo…" : "Excluir")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
