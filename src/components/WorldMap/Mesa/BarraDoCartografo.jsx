/* ════════════════════════════════════════════════════════════════════
 *  A BARRA DO CARTÓGRAFO  (spec 0035 · F2 · M4)
 *  --------------------------------------------------------------------
 *  Uma faixa no alto do palco com três coisas, e só três: onde o grupo está,
 *  em que ponto do dia, e que horas são. É o que o mapa da referência põe no
 *  topo e o que a mesa do Nexus não tinha — o jogador precisava clicar para
 *  saber onde estava, e o relógio só existia dentro do console do mestre.
 *
 *  ── O CALENDÁRIO É CONTADOR DE DIAS, NÃO DATA ───────────────────────
 *  O plano desta spec dizia "data gregoriana em PT-BR". **O dado desmentiu o
 *  plano, e o dado ganha.** `party.inGameDatetime` guarda `{dia, hora, minuto}`
 *  ou um número de horas corridas — dias decorridos de campanha, não uma data
 *  de calendário. Formatar isso como "05/08/2026" seria inventar uma ficção que
 *  o Nexus não tem. A casa já resolveu esse texto: `formatarRelogio` devolve
 *  "Dia 3 · 14:05", e é ele que aparece aqui. Uma fonte só.
 *
 *  ── SEM RELÓGIO, SEM MENTIRA ────────────────────────────────────────
 *  `inGameDatetime` nasce `null`: a instância começa sem tempo corrido. Nesse
 *  caso a barra mostra o lugar e **esconde o mostrador e a hora** — campo
 *  ausente continua ausente (ADR-0011). O relógio acende sozinho no primeiro
 *  avanço, que é o mesmo contrato da tinta de hora do dia.
 *
 *  ── O MOSTRADOR ─────────────────────────────────────────────────────
 *  Um disco com o sol ou a lua girando pela hora. O período vem de
 *  `periodoDoDia`, o MESMO que a `TintaDoDia` usa — não há tabela paralela de
 *  limites de hora neste arquivo, e é de propósito: duas tabelas divergem.
 *
 *  Gate: `__tests__/barra-cartografo.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { formatarRelogio, periodoDoDia } from "./mesaUi";
import { FF, FS, FW, LS } from "../Atelier/ui";

/** É noite ou madrugada? Então quem gira é a lua. */
const NOTURNO = new Set(["madrugada", "noite"]);

/**
 * O ângulo do astro no mostrador, em graus.
 *
 * Meia-noite embaixo, meio-dia em cima — é como um relógio de sol se lê. A
 * volta inteira leva um dia de jogo.
 *
 * @param {*} relogio `inGameDatetime`.
 * @returns {number} 0 a 360.
 */
export function anguloDoAstro(relogio) {
  const r = relogio;
  let horas;
  if (typeof r === "number" && Number.isFinite(r)) horas = r % 24;
  else if (r && typeof r === "object") {
    const h = Number.isFinite(r.hora) ? r.hora : 0;
    const m = Number.isFinite(r.minuto) ? r.minuto : 0;
    horas = h + m / 60;
  } else horas = 0;

  const bruto = (horas / 24) * 360 + 180; // +180 põe meia-noite embaixo
  return ((bruto % 360) + 360) % 360;
}

/**
 * @param {object} props
 * @param {string} [props.ondeEsta] nome do lugar atual, já resolvido pela tela.
 * @param {*} [props.relogio] `party.inGameDatetime`; `null` esconde o tempo.
 * @param {boolean} [props.viajando]
 * @param {boolean} [props.anima] portão de movimento (AC-8).
 */
export default function BarraDoCartografo({
  ondeEsta = "", relogio = null, viajando = false, anima = true,
}) {
  const temTempo = relogio !== null && relogio !== undefined;
  const periodo = temTempo ? periodoDoDia(relogio) : null;
  const noturno = periodo ? NOTURNO.has(periodo) : false;
  const angulo = temTempo ? anguloDoAstro(relogio) : 0;

  const lugar = viajando ? "Viagem em grupo" : (ondeEsta || "Lugar desconhecido");

  return (
    <div className="wmm-cartografo" data-testid="wmm-cartografo" data-periodo={periodo || undefined}>
      <span
        className="wmm-cartografo-lugar"
        data-testid="wmm-cartografo-lugar"
        style={{
          fontFamily: FF.title,
          fontSize: FS.label,
          fontWeight: FW.semi,
          letterSpacing: LS.nav,
          fontVariant: "small-caps",
        }}
      >
        {lugar}
      </span>

      {temTempo ? (
        <>
          <span
            className="wmm-mostrador"
            data-testid="wmm-mostrador"
            data-astro={noturno ? "lua" : "sol"}
            aria-hidden="true"
          >
            <span
              className="wmm-astro"
              data-anima={anima ? "sim" : "nao"}
              style={{ transform: `rotate(${angulo}deg)` }}
            >
              <span className="wmm-astro-corpo" />
            </span>
          </span>

          <span
            className="wmm-cartografo-hora"
            data-testid="wmm-cartografo-hora"
            style={{
              fontFamily: FF.data,
              fontSize: FS.meta,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.04em",
            }}
          >
            {formatarRelogio(relogio)}
          </span>
        </>
      ) : null}
    </div>
  );
}
