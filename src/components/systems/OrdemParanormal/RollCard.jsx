import { useState } from "react";
import { totalDaConta } from "./rules";
import ElementoSymbol from "./ElementoSymbol";

/* Spec 0037 — "Mostrar a conta".
 *
 * Em Ordem Paranormal a rolagem É uma escolha entre dados: lança-se um d20 por
 * ponto de atributo e fica-se com o melhor (com atributo 0, dois dados e fica-se
 * com o PIOR). A ficha executava isso certo e mostrava `[10 · 13 · 9]` — três
 * números com o mesmo peso visual, sendo que só um sobreviveu.
 *
 * Aqui o dado que ficou é destacado e os descartados são apagados. O destaque
 * NÃO é só cor: o mantido ganha moldura e os descartados ganham risco, porque
 * quem não separa matizes precisava ler a mesma coisa (AC-2).
 */

/** Índice do dado que sobreviveu. Empate (`[13,13,9]` com kept 13) é
 *  indistinguível por construção — o primeiro leva, e não fingimos saber mais. */
const indiceDoMantido = (rolls, kept) => {
  if (!Array.isArray(rolls) || kept == null) return -1;
  return rolls.indexOf(Number(kept));
};

/** Os d20 individuais: o mantido com moldura, os descartados apagados e riscados. */
export function DiceRow({ rolls, kept, worst = false, cor = "var(--el-glow)" }) {
  if (!Array.isArray(rolls) || rolls.length === 0) return null;
  const iKept = indiceDoMantido(rolls, kept);
  return (
    <div className="op-data" style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", alignItems: "center" }}>
      {rolls.map((d, i) => {
        const mantido = i === iKept;
        return (
          <span
            key={i}
            aria-label={`${d}, ${mantido ? "mantido" : "descartado"}`}
            title={mantido ? (worst ? "ficou com o pior" : "ficou com o melhor") : "descartado"}
            style={{
              minWidth: 26,
              padding: "2px 6px",
              textAlign: "center",
              fontSize: mantido ? 15 : 13,
              fontWeight: mantido ? 700 : 400,
              lineHeight: 1.3,
              borderRadius: 4,
              color: mantido ? cor : "var(--muted)",
              border: mantido ? `1.5px solid ${cor}` : "1.5px solid transparent",
              background: mantido ? "rgba(255,255,255,0.05)" : "transparent",
              opacity: mantido ? 1 : 0.42,
              textDecoration: mantido ? "none" : "line-through",
            }}
          >
            {d}
          </span>
        );
      })}
      {rolls.length > 1 && (
        <span className="op-label" style={{ color: "var(--muted)", marginLeft: 2 }}>
          {worst ? "pior" : "melhor"}
        </span>
      )}
    </div>
  );
}

/** A conta termo a termo. A ordem e os rótulos vêm de `termosDaConta` — este
 *  componente só desenha, para não existir uma segunda opinião sobre a conta. */
export function ContaBreakdown({ conta, total, bonusIgnorado = false }) {
  if (!Array.isArray(conta) || conta.length === 0) return null;
  const soma = total ?? totalDaConta(conta);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {conta.map((termo, i) => (
        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12 }}>
          <span style={{ flex: 1, color: termo.dado ? "var(--el-glow)" : "var(--muted2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {termo.rotulo}
          </span>
          {/* Modificador que só dá dado precisa aparecer mesmo somando 0 — é ele
              que explica por que o bolo tinha um d20 a mais. */}
          {termo.dados ? (
            <span className="op-data" style={{ fontSize: 11, color: "var(--muted)" }}>+{termo.dados}d20</span>
          ) : null}
          <span className="op-data" style={{ minWidth: 34, textAlign: "right", color: "#fff" }}>
            {termo.dado ? termo.valor : `${termo.valor >= 0 ? "+" : ""}${termo.valor}`}
          </span>
        </div>
      ))}
      <div style={{ height: 1, background: "var(--el-border,var(--border2))", margin: "4px 0" }} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="op-label" style={{ flex: 1, color: "var(--el-glow)" }}>Total</span>
        <span className="op-data" style={{ minWidth: 34, textAlign: "right", fontSize: 15, fontWeight: 700, color: "#fff" }}>{soma}</span>
      </div>
      {bonusIgnorado && (
        <div className="op-data" style={{ marginTop: 6, fontSize: 10, lineHeight: 1.5, color: "var(--muted)" }}>
          Atributo 0: rola 2d20 e fica com o pior. Dado de bônus não se aplica.
        </div>
      )}
    </div>
  );
}

/**
 * Card de rolagem normal (canto da viewport). Frente mostra o total e os dados;
 * o verso mostra a conta. Vira pelo botão, fecha nas duas faces.
 *
 * O modal de CRÍTICO não usa este componente — ele já é espetáculo em tela cheia
 * e mostra a conta aberta, sem virar. Um flip lá brigaria com a animação.
 */
export default function RollCard({ roll, onClose, elemento, styleVars }) {
  const [virado, setVirado] = useState(false);
  if (!roll) return null;

  const temConta = Array.isArray(roll.conta) && roll.conta.length > 0;
  const ehAtaque = roll.kind === "attack";

  return (
    <div className="op-corner" style={styleVars} role="status" aria-live="polite">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <ElementoSymbol id={elemento || "ordem"} size={18} />
        <span style={{ flex: 1, fontFamily: "var(--font-title,'Cinzel',serif)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--el-glow)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {roll.attr}
        </span>
        {/* Sem conta (rolagem livre, ataque) não há verso para mostrar — e um
            botão de virar que revela vazio é pior que botão ausente. */}
        {temConta && !ehAtaque && (
          <button
            className="op-corner-x"
            onClick={() => setVirado((v) => !v)}
            aria-pressed={virado}
            aria-label={virado ? "Ver o resultado" : "Ver a conta"}
            title={virado ? "Ver o resultado" : "Ver a conta"}
            style={{ fontSize: 13, letterSpacing: "0.04em" }}
          >
            {virado ? "◂" : "ƒx"}
          </button>
        )}
        <button className="op-corner-x" onClick={onClose} aria-label="Fechar">✕</button>
      </div>

      {virado ? (
        <ContaBreakdown conta={roll.conta} total={roll.result} bonusIgnorado={roll.bonusIgnorado} />
      ) : ehAtaque ? (
        <div style={{ display: "flex" }}>
          <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid var(--el-border)" }}>
            <div style={{ fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 40, color: "var(--el-primary)", lineHeight: 1 }}>{roll.result}</div>
            <div className="op-label">Ataque</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 40, color: "#fff", lineHeight: 1 }}>{roll.dano}</div>
            <div className="op-label">Dano</div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 58, color: "var(--el-primary)", lineHeight: 1, textShadow: "0 0 18px var(--el-glow)" }}>
            {roll.result}
          </div>
          <div className="op-label" style={{ marginTop: 2 }}>resultado</div>
          <div style={{ marginTop: 8 }}>
            <DiceRow rolls={roll.rolls} kept={roll.kept} worst={roll.worst} />
          </div>
          {roll.bonusIgnorado && (
            <div className="op-data" style={{ marginTop: 8, fontSize: 10, lineHeight: 1.5, color: "var(--muted)" }}>
              Dado de bônus não se aplica a atributo 0.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
