/* ════════════════════════════════════════════════════════════════════
 *  EDITOR DO GRAFO — BARRA DE FERRAMENTAS  (spec 0028 · F2 · AC-4)
 *  --------------------------------------------------------------------
 *  Quatro ferramentas, o enquadrar-tudo e o zoom. A barra é `role="toolbar"`
 *  com `aria-pressed` na ferramenta ativa — quem usa leitor de tela ouve
 *  qual está ligada, não só que existem quatro botões.
 *
 *  Cada botão carrega a tecla de atalho no `title` e no `aria-keyshortcuts`,
 *  porque a descoberta do atalho não pode depender de o mestre ler
 *  documentação que não existe.
 * ════════════════════════════════════════════════════════════════════ */

import { ferramentasDisponiveis, getFerramenta } from "./editorUi";
import { SP, R, FS, FW, T, HIT, LINE, btnStyle } from "../Atelier/ui";

/**
 * @param {object} props
 * @param {string} props.ferramenta id da ferramenta ativa.
 * @param {(id:string)=>void} props.onFerramenta
 * @param {()=>void} props.onEnquadrar
 * @param {(fator:number)=>void} props.onZoom
 * @param {number} props.escala escala atual da câmera (para o rótulo em %).
 * @param {boolean} [props.somenteLeitura] esconde o que escreve.
 * @param {boolean} [props.comNevoa] o molde está com névoa ligada — só então o
 *   pincel de névoa aparece (oferecer pincel que não pinta nada seria mentira).
 */
export default function BarraDeFerramentas({
  ferramenta,
  onFerramenta,
  onEnquadrar,
  onZoom,
  escala = 1,
  somenteLeitura = false,
  comNevoa = false,
}) {
  const ativa = getFerramenta(ferramenta);
  const disponiveis = ferramentasDisponiveis({ somenteLeitura, comNevoa });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
      <div
        role="toolbar"
        aria-label="Ferramentas do mapa"
        style={{
          display: "flex",
          alignItems: "center",
          gap: SP.x2,
          flexWrap: "wrap",
          padding: SP.x2,
          background: "var(--card)",
          border: `1px solid ${LINE.edge}`,
          borderRadius: R.card,
        }}
      >
        {disponiveis.map((f) => {
          const ligada = f.id === ferramenta;
          return (
            <button
              key={f.id}
              type="button"
              className="wme-ferramenta"
              aria-pressed={ligada}
              aria-keyshortcuts={f.atalho}
              title={`${f.label} (${f.atalho}) — ${f.dica}`}
              onClick={() => onFerramenta(f.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: SP.x2,
                minHeight: HIT.mobile,
                padding: `0 ${SP.x3}px`,
                borderRadius: R.ctl,
                cursor: "pointer",
                background: ligada ? "rgba(201,168,76,0.16)" : "transparent",
                border: `1px solid ${ligada ? "var(--border2)" : "transparent"}`,
                color: ligada ? "var(--gold2,var(--gold))" : "var(--muted2)",
                ...T.btn,
                fontSize: FS.tag,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{f.icone}</span>
              {f.label}
              <span
                aria-hidden="true"
                style={{
                  marginLeft: 2,
                  padding: "1px 4px",
                  borderRadius: 3,
                  fontSize: FS.micro,
                  fontWeight: FW.med,
                  letterSpacing: 0,
                  background: "rgba(255,255,255,0.07)",
                  color: "var(--muted)",
                }}
              >
                {f.atalho}
              </span>
            </button>
          );
        })}

        <div style={{ flex: 1, minWidth: SP.x2 }} />

        <button
          type="button"
          className="wme-focus wme-ferramenta"
          onClick={() => onZoom(1 / 1.25)}
          aria-label="Afastar o mapa"
          style={{ ...btnStyle("quiet", "sm"), minWidth: HIT.desktop, minHeight: HIT.mobile }}
        >
          −
        </button>
        <span
          aria-live="polite"
          style={{ ...T.data, minWidth: 52, textAlign: "center" }}
        >
          {Math.round((escala || 1) * 100)}%
        </span>
        <button
          type="button"
          className="wme-focus wme-ferramenta"
          onClick={() => onZoom(1.25)}
          aria-label="Aproximar o mapa"
          style={{ ...btnStyle("quiet", "sm"), minWidth: HIT.desktop, minHeight: HIT.mobile }}
        >
          +
        </button>
        <button
          type="button"
          className="wme-focus wme-ferramenta"
          onClick={onEnquadrar}
          title="Ajusta o zoom para caber todos os lugares na tela"
          style={{ ...btnStyle("ghost", "sm"), minHeight: HIT.mobile }}
        >
          Enquadrar tudo
        </button>
      </div>

      {/* A dica da ferramenta ativa fica visível: é o que ensina a usar sem
          manual. `aria-live` sem `role="status"` de propósito — ela é ajuda
          permanente, não um aviso do sistema, e ocupar o papel de "status" da
          tela roubaria o anúncio dos avisos que realmente importam. */}
      <div aria-live="polite" style={{ ...T.meta, fontSize: FS.micro, paddingLeft: SP.x1 }}>
        {ativa.dica}
      </div>
    </div>
  );
}
