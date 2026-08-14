import { useState } from "react";
import { useSlidingPill } from "../../../../hooks/useSlidingPill";
import SlidingTabPill from "../../../SlidingTabPill";
import DescricaoTab from "./DescricaoTab";
import InvestigacaoTab from "./InvestigacaoTab";
import InterludioTab from "./InterludioTab";

/* Spec 0040 — o Dossiê: três sub-abas dentro da aba que era só "Descrição".
 *
 * ⚠ POR QUE SUB-ABAS E NÃO DUAS ABAS NOVAS NO TOPO.
 * A barra de abas da ficha JÁ QUEBROU com seis — está no histórico do repo
 * (`fix(ficha): abas somem quando são seis`). Investigação e Interlúdio como
 * abas de topo dariam OITO e reintroduziriam o defeito. Foi o próprio Andre quem
 * apontou o caminho ("podem ficar junto lá de descrição"), e ele é o certo:
 * as três tratam do MESMO objeto — o dossiê do agente e do caso.
 *
 * Se algum dia a barra suportar mais abas, promover estas duas é uma linha —
 * mas não sem antes conferir o defeito das seis.
 */

const SUB = [
  { id: "agente", label: "Agente" },
  { id: "investigacao", label: "Investigação" },
  { id: "interludio", label: "Interlúdio" },
];

export default function DossieTab({
  descricao, setDescricao,
  investigacao, setInvestigacao,
  vitais, interludios, onAplicarInterludio,
  readOnly,
}) {
  const [sub, setSub] = useState("agente");
  const pill = useSlidingPill(sub);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div ref={pill.containerRef} role="tablist" aria-label="Seções do dossiê"
        style={{ display: "flex", gap: 0, position: "relative", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
        <SlidingTabPill pill={pill.pill} background="rgba(201,168,76,0.08)" underline="var(--el-accent)" />
        {SUB.map((s) => {
          const ativa = sub === s.id;
          return (
            <button key={s.id} ref={pill.setItemRef(s.id)} onClick={() => setSub(s.id)}
              role="tab" aria-selected={ativa}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "7px 14px 9px", position: "relative", zIndex: 1,
                fontFamily: "Cinzel,serif", fontSize: 11, letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: ativa ? "var(--gold2)" : "var(--muted)",
                transition: "color 0.2s",
              }}>{s.label}</button>
          );
        })}
      </div>

      {sub === "agente" && <DescricaoTab descricao={descricao} setDescricao={setDescricao} />}
      {sub === "investigacao" && (
        <InvestigacaoTab investigacao={investigacao} setInvestigacao={setInvestigacao} readOnly={readOnly} />
      )}
      {sub === "interludio" && (
        <InterludioTab vitais={vitais} interludios={interludios} onAplicar={onAplicarInterludio} readOnly={readOnly} />
      )}
    </div>
  );
}
