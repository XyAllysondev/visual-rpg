/* ════════════════════════════════════════════════════════════════════
 *  O ACAMPAMENTO NA TELA  (spec 0028 · F6 · AC-8, AC-10)
 *  --------------------------------------------------------------------
 *  Acampar é uma TROCA: horas por descanso, comida por horas. Por isso a
 *  tela mostra as duas colunas — **antes** e **depois** — antes de o mestre
 *  clicar. Mostrar só o resultado esconderia o preço, e o mestre descobriria
 *  que a despensa acabou depois de ela ter acabado.
 *
 *  ── A CONTA DA PRÉVIA É A MESMA DA EXECUÇÃO ─────────────────────────
 *  `avancarRelogio` e `consumirSuprimentos` são as funções puras que
 *  `model/acampamento.js` usa por dentro. A prévia chama exatamente elas —
 *  não uma segunda aritmética que poderia divergir do que vai acontecer.
 *  O que a prévia NÃO faz é sortear: a emboscada só é rolada no clique, uma
 *  vez, e vai direto para a decisão do mestre (AC-8).
 *
 *  ── NENHUMA PENALIDADE INVENTADA ────────────────────────────────────
 *  Quando a comida acaba, a tela diz que acabou e quanto faltou. Não diz
 *  "-2 em testes" nem "1 nível de exaustão": o Nexus roda sistemas
 *  diferentes e essa regra não é nossa de escrever. A decisão volta para o
 *  mestre, com o número na mão.
 * ══════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { avancarRelogio, consumirSuprimentos } from "../model/viagem";
import { descansoRecuperado } from "../model/acampamento";
import { PERIGO_MAXIMO } from "../model/encontros";
import { formatarRelogio, formatarSuprimentos, periodoDoDia } from "./mesaUi";
import {
  HORAS_DE_ACAMPAMENTO, HORAS_PADRAO_DE_ACAMPAMENTO, avisoDeSuprimentos,
} from "./encontrosUi";
import { FF, FS, FW, HIT, LINE, R, SP, T, btnStyle, campoStyle } from "../Atelier/ui";

const Coluna = ({ titulo, relogio, suprimentos, destaque = false }) => (
  <div
    style={{
      flex: "1 1 140px", minWidth: 0, padding: SP.x3, borderRadius: R.ctl,
      border: `1px solid ${destaque ? "var(--border2)" : LINE.hair}`,
      background: destaque ? "rgba(201,168,76,0.07)" : "rgba(255,255,255,0.03)",
    }}
  >
    <div style={{ ...T.section, fontSize: FS.micro }}>{titulo}</div>
    <div
      style={{
        fontFamily: FF.data, fontSize: FS.body, fontWeight: FW.semi,
        color: destaque ? "var(--gold2,var(--gold))" : "var(--text)",
      }}
    >
      {formatarRelogio(relogio)}
    </div>
    <div style={{ ...T.data, fontSize: FS.micro }}>
      {periodoDoDia(relogio)} · {formatarSuprimentos(suprimentos)}
    </div>
  </div>
);

/**
 * @param {object} props
 * @param {object|null} props.party
 * @param {number} props.consumoPorDia
 * @param {{ok:boolean, motivo:string}} props.permissao saída de `podeAcampar`.
 * @param {number} props.perigo perigo da REGIÃO (0–5), do mestre.
 * @param {(n:number)=>void} props.onPerigo
 * @param {(horas:number)=>void} props.onAcampar
 * @param {{suprimentos:object, descanso:object}|null} [props.resultado] o que o
 *   último acampamento produziu — o "depois" que virou presente.
 * @param {boolean} [props.ocupado]
 */
export default function Acampamento({
  party = null,
  consumoPorDia = 1,
  permissao = { ok: false, motivo: "" },
  perigo = 1,
  onPerigo,
  onAcampar,
  resultado = null,
  ocupado = false,
}) {
  const [horas, setHoras] = useState(HORAS_PADRAO_DE_ACAMPAMENTO);

  const previa = useMemo(() => {
    const depois = avancarRelogio(party?.inGameDatetime ?? null, horas);
    const comida = consumirSuprimentos(party?.supplies, horas, consumoPorDia);
    return { depois, comida, descanso: descansoRecuperado({ horas }) };
  }, [party?.inGameDatetime, party?.supplies, horas, consumoPorDia]);

  const avisoDaPrevia = avisoDeSuprimentos(previa.comida);
  const avisoDoResultado = resultado ? avisoDeSuprimentos(resultado.suprimentos) : "";

  return (
    <section
      className="wmm-painel"
      aria-label="Acampamento"
      data-testid="wmm-acampamento"
      style={{
        display: "flex", flexDirection: "column", gap: SP.x3,
        padding: SP.x4, background: "var(--card)",
        border: `1px solid ${LINE.edge}`, borderRadius: R.panel,
      }}
    >
      <div>
        <div style={{ fontFamily: FF.display, fontSize: FS.body, color: "var(--gold2,var(--gold))" }}>
          Acampar
        </div>
        <div style={T.meta}>
          {permissao.ok
            ? "Parar, montar fogueira e deixar o tempo passar."
            : permissao.motivo}
        </div>
      </div>

      {/* ── Quantas horas ─────────────────────────────────────────────── */}
      <fieldset
        style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: SP.x2,
          border: "none", margin: 0, padding: 0,
        }}
      >
        <legend style={{ ...T.section, fontSize: FS.micro, padding: 0 }}>Por quanto tempo</legend>
        {HORAS_DE_ACAMPAMENTO.map((h) => (
          <label
            key={h}
            className="wmm-focus"
            style={{
              display: "inline-flex", alignItems: "center", gap: SP.x1,
              minHeight: HIT.mobile, padding: `0 ${SP.x3}px`, cursor: "pointer",
              borderRadius: R.pill,
              border: `1px solid ${horas === h ? "var(--border2)" : LINE.raise}`,
              color: horas === h ? "var(--gold2,var(--gold))" : "var(--muted2)",
              ...T.btn, fontSize: FS.tag,
            }}
          >
            <input
              type="radio"
              name="wmm-horas-de-acampamento"
              checked={horas === h}
              onChange={() => setHoras(h)}
              aria-label={`Acampar por ${h} horas`}
              style={{ width: 14, height: 14, accentColor: "var(--gold2,var(--gold))" }}
            />
            {h} h
          </label>
        ))}
        <span style={{ ...T.data, fontSize: FS.micro }}>{previa.descanso.rotulo}</span>
      </fieldset>

      {/* ── Antes e depois ────────────────────────────────────────────── */}
      <div
        data-testid="wmm-acampamento-previa"
        style={{ display: "flex", gap: SP.x2, flexWrap: "wrap", alignItems: "stretch" }}
      >
        <Coluna titulo="Agora" relogio={party?.inGameDatetime} suprimentos={party?.supplies} />
        <div aria-hidden="true" style={{ alignSelf: "center", ...T.data, fontSize: FS.body }}>→</div>
        <Coluna titulo="Depois" relogio={previa.depois} suprimentos={previa.comida.restante} destaque />
      </div>

      {avisoDaPrevia ? (
        <p data-testid="wmm-acampamento-aviso" style={{ ...T.meta, margin: 0, color: "var(--text)" }}>
          {avisoDaPrevia}
        </p>
      ) : null}

      {/* ── O perigo da região ────────────────────────────────────────── */}
      <label
        className="wmm-focus"
        style={{ display: "inline-flex", alignItems: "center", gap: SP.x2, ...T.meta, flexWrap: "wrap" }}
      >
        Perigo da região (0–{PERIGO_MAXIMO})
        <input
          type="number"
          min="0"
          max={PERIGO_MAXIMO}
          step="1"
          value={perigo}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (onPerigo && Number.isFinite(v)) onPerigo(v);
          }}
          aria-label="Perigo da região onde o grupo acampa, de 0 a 5"
          data-testid="wmm-perigo-da-regiao"
          style={{ ...campoStyle(false), width: 84, minHeight: HIT.desktop, fontSize: FS.body }}
        />
        <span style={{ ...T.data, fontSize: FS.micro }}>
          É daqui que sai a chance de emboscada. Zero desliga.
        </span>
      </label>

      <button
        type="button"
        className="wmm-acao"
        data-testid="wmm-acampar"
        disabled={ocupado || !permissao.ok}
        onClick={() => onAcampar && onAcampar(horas)}
        style={{ ...btnStyle("primary"), width: "100%", minHeight: HIT.mobile }}
      >
        Acampar {horas} h
      </button>

      {/* ── O que o último acampamento fez ───────────────────────────── */}
      {resultado ? (
        <div
          data-testid="wmm-acampamento-resultado"
          role="status"
          aria-live="polite"
          style={{
            padding: SP.x3, borderRadius: R.ctl,
            background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE.hair}`,
          }}
        >
          <div style={{ ...T.section, fontSize: FS.micro }}>{resultado.descanso.rotulo}</div>
          <div style={{ ...T.meta, color: "var(--text)" }}>
            {formatarRelogio(party?.inGameDatetime)} · {formatarSuprimentos(party?.supplies)}
          </div>
          {avisoDoResultado ? (
            <div style={{ ...T.meta, marginTop: SP.x1, color: "var(--text)" }}>{avisoDoResultado}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
