/* ════════════════════════════════════════════════════════════════════
 *  A MESA — O MURAL DO GRUPO  (spec 0028 · F5 · AC-1, AC-9)
 *  --------------------------------------------------------------------
 *  O que aconteceu com o grupo, do lado de quem joga. Duas coisas:
 *   1. os eventos que já dispararam — só `title` e `playerText`;
 *   2. **Procurar aqui**, o teste de descoberta do AC-9.
 *
 *  ── ESTE COMPONENTE NÃO CONHECE O MOLDE ─────────────────────────────
 *  Ele recebe os documentos de `campaigns/.../revealed/` já projetados, e
 *  nada mais. Não recebe `testesDisponiveis`, não recebe trilha, não
 *  recebe evento do ateliê. Se um dia alguém tentar passar o molde por
 *  aqui para "melhorar a tela", o AC-1 cai — e é por isso que a assinatura
 *  não tem por onde recebê-lo.
 *
 *  ── AS DUAS REGRAS DURAS DA PROCURA (AC-9) ──────────────────────────
 *  1. **O botão existe em todo nó.** Não aparece "quando há segredo" —
 *     isso seria o mapa apontando onde procurar. Ele está sempre aqui,
 *     com o mesmo rótulo, habilitado do mesmo jeito.
 *  2. **A resposta do fracasso é idêntica à de um lugar vazio.** A frase
 *     vem de `MENSAGEM_SEM_ACHADO` (model/descoberta.js) e chega pronta
 *     nesta prop. O bloco que a mostra não tem `title`, nem `data-*` de
 *     desfecho, nem classe condicional, nem cor diferente: comparar o HTML
 *     dos dois casos tem de dar a MESMA string, e `evento-mesa.test.js`
 *     compara. Um `data-sucesso="false"` aqui já seria o oráculo.
 * ════════════════════════════════════════════════════════════════════ */

import { EVENTO_SEM_TITULO, ROTULO_DA_PROCURA } from "./eventosUi";
import { FF, FS, FW, HIT, LINE, R, SP, T, btnStyle } from "../Atelier/ui";

const lista = (v) => (Array.isArray(v) ? v : []);

/**
 * @param {object} props
 * @param {Array<{id:string, eventId?:string, title?:string, playerText?:string}>}
 *   props.eventos documentos públicos de `revealed/` (kind `event`).
 * @param {()=>void} [props.onProcurar]
 * @param {boolean} [props.procurando]
 * @param {string} [props.resultadoDaProcura] a frase já resolvida. **Nunca**
 *   montada aqui: vem das constantes de `model/descoberta.js`.
 * @param {boolean} [props.ocupado]
 */
export default function EventosDoGrupo({
  eventos = [],
  onProcurar,
  procurando = false,
  resultadoDaProcura = "",
  ocupado = false,
}) {
  const cartoes = lista(eventos);

  return (
    <section
      className="wmm-painel"
      aria-label="O que aconteceu"
      data-testid="wmm-mural-do-grupo"
      style={{
        display: "flex", flexDirection: "column", gap: SP.x3,
        padding: SP.x4, background: "var(--card)",
        border: `1px solid ${LINE.edge}`, borderRadius: R.panel,
      }}
    >
      <div style={{ fontFamily: FF.display, fontSize: FS.body, color: "var(--gold2,var(--gold))" }}>
        O que aconteceu
      </div>

      {/* ── Os eventos já disparados ───────────────────────────────── */}
      {cartoes.length === 0 ? (
        <p style={{ ...T.meta, margin: 0 }} data-testid="wmm-sem-eventos">
          Nada aconteceu com o grupo neste mapa ainda.
        </p>
      ) : (
        <ul
          aria-label="Eventos que aconteceram"
          style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: SP.x2 }}
        >
          {cartoes.map((ev) => (
            <li
              key={ev.id}
              data-testid={`wmm-cartao-${ev.eventId || ev.id}`}
              style={{
                padding: SP.x3, borderRadius: R.ctl,
                border: `1px solid ${LINE.hair}`, background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ ...T.body, fontSize: FS.meta, fontWeight: FW.semi }}>
                <span aria-hidden="true" style={{ color: "var(--gold2,var(--gold))" }}>✦ </span>
                {(ev.title || "").trim() || EVENTO_SEM_TITULO}
              </div>
              {ev.playerText ? (
                <p style={{ ...T.meta, margin: `${SP.x2}px 0 0`, color: "var(--text)" }}>{ev.playerText}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* ── A procura (AC-9) ───────────────────────────────────────── */}
      {onProcurar ? (
        <div style={{ display: "flex", flexDirection: "column", gap: SP.x2, paddingTop: SP.x2, borderTop: `1px solid ${LINE.hair}` }}>
          <button
            type="button"
            className="wmm-acao"
            data-testid="wmm-procurar"
            disabled={ocupado || procurando}
            onClick={onProcurar}
            style={{ ...btnStyle("quiet"), width: "100%", minHeight: HIT.mobile }}
          >
            {procurando ? "Procurando…" : ROTULO_DA_PROCURA}
          </button>
          <p style={{ ...T.meta, margin: 0, fontSize: FS.micro }}>
            Vale em qualquer lugar do mapa. Nem sempre há o que achar.
          </p>

          {/* O bloco do resultado. Sem cor, sem ícone, sem atributo que
              distinga desfecho: o HTML de "não achou nada" tem de ser
              idêntico ao de "não havia nada". Ver o cabeçalho. */}
          <p
            role="status"
            aria-live="polite"
            data-testid="wmm-resultado-da-procura"
            style={{ margin: 0, minHeight: 20, ...T.meta, color: "var(--text)" }}
          >
            {resultadoDaProcura}
          </p>
        </div>
      ) : null}
    </section>
  );
}
