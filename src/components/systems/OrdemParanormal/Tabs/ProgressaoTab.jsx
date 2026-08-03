/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — ABA PROGRESSÃO
 *  ------------------------------------------------------------------------
 *  Painel de controle da evolução do agente. Não é uma tela de leitura: é
 *  daqui que se sobe de NEX, se resolve o que ficou pendente e se corrige um
 *  NEX digitado errado.
 *
 *  Três blocos:
 *    1. Avanço        — o botão grande + o aviso de pendências.
 *    2. Derivados     — tudo que o motor calcula, com a conta à mostra.
 *    3. Linha do tempo— os 20 degraus, o que cada um deu e o que falta.
 * ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { CLASSES_OP, CLASS_TRAILS, TRAIL_ABILITIES } from "../rules";
import { NEX_STEPS, NEX_MAX } from "../progressao/tabelas";
import { derivar, pendencias, proximoNex, nexAnterior, linhaDoTempo, reverterPara } from "../progressao/motor";
import EvolucaoModal from "../EvolucaoModal";
import { tCardTitle, tBody, tStat, tLabel, tEmpty, tSubtext, btnGhost, btnGold } from "./shared/modalStyles";

const ROTULO_TIPO = {
  habilidade: "Habilidade de classe",
  trilha: "Trilha",
  habilidade_trilha: "Poder de trilha",
  poder_classe: "Poder de classe",
  versatilidade: "Versatilidade",
  aumento_atributo: "Atributo",
  grau_treinamento: "Treinamento",
  circulo_ritual: "Rituais",
  ritual: "Ritual",
  afinidade: "Afinidade",
};

const faixa = (nex) =>
  nex >= 99 ? "Transcendente" : nex >= 75 ? "Lendário" : nex >= 50 ? "Especialista" : nex >= 25 ? "Veterano" : "Iniciante";

/* ── Barra de NEX ──────────────────────────────────────────────────────── */
function BarraNex({ nex }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ ...tLabel, fontSize: 11 }}>Nível de Exposição Paranormal</span>
        <span style={{ fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 26, color: "var(--el-accent)", lineHeight: 1 }}>
          {nex}%
        </span>
      </div>
      <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${(nex / NEX_MAX) * 100}%`, borderRadius: 4,
          background: "linear-gradient(90deg,var(--el-primary),var(--el-accent))",
          boxShadow: "0 0 10px var(--el-glow)", transition: "width .5s ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ ...tSubtext, fontSize: 10 }}>5%</span>
        <span style={{ ...tSubtext, fontSize: 11, color: "var(--el-accent)" }}>{faixa(nex)}</span>
        <span style={{ ...tSubtext, fontSize: 10 }}>99%</span>
      </div>
    </div>
  );
}

/* ── Cartão de valor derivado ──────────────────────────────────────────── */
function Derivado({ rotulo, valor, conta }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ ...tLabel, fontSize: 9, marginBottom: 3 }}>{rotulo}</div>
      <div style={{ fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 21, color: "var(--el-accent)", lineHeight: 1.1 }}>{valor}</div>
      {conta && <div style={{ ...tSubtext, fontSize: 10, marginTop: 3 }}>{conta}</div>}
    </div>
  );
}

function resumoResolucao(item) {
  const r = item.resolucao;
  if (!r) return item.exigeEscolha ? "—" : "automático";
  if (r.atributo) return `+1 ${r.atributo}`;
  if (r.trilha) return r.trilha;
  if (r.poder) return String(r.poder).replace("trilha:", "");
  if (r.elemento) return r.elemento;
  if (r.graus?.length) return r.graus.map((g) => g.pericia).join(", ");
  if (r.pericias?.length) return r.pericias.join(", ");
  if (r.rituais?.length) return `${r.rituais.length} ritual(is)`;
  return "feito";
}

/* ── Degrau da linha do tempo ──────────────────────────────────────────── */
function Degrau({ passo }) {
  const [aberto, setAberto] = useState(false);
  const pendentes = passo.itens.filter((i) => i.pendente).length;
  const cor = passo.atual ? "var(--el-accent)" : passo.alcancado ? "rgba(201,168,76,0.55)" : "rgba(255,255,255,0.18)";

  return (
    <div
      onClick={() => setAberto((v) => !v)}
      style={{
        display: "grid", gridTemplateColumns: "54px 1fr auto", gap: 10, alignItems: "center", cursor: "pointer",
        padding: "9px 12px", borderRadius: 6, marginBottom: 5,
        background: passo.atual ? "rgba(201,168,76,0.10)" : passo.alcancado ? "rgba(255,255,255,0.025)" : "transparent",
        border: `1px solid ${passo.atual ? "var(--el-accent)" : passo.alcancado ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.035)"}`,
        opacity: passo.alcancado ? 1 : 0.5,
      }}
    >
      <span style={{ fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 16, color: cor }}>{passo.nex}%</span>
      <span style={{ ...tBody, fontSize: 12.5, fontStyle: "normal", color: "var(--muted2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: aberto ? "normal" : "nowrap" }}>
        {passo.itens.length === 0 ? "—" : passo.itens.map((i) => i.rotulo).join(" · ")}
      </span>
      {pendentes > 0 && passo.alcancado ? (
        <span style={{ ...tStat, fontSize: 9, color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 10, padding: "2px 7px", whiteSpace: "nowrap" }}>
          {pendentes} pendente{pendentes > 1 ? "s" : ""}
        </span>
      ) : passo.alcancado ? (
        <span style={{ fontSize: 11, color: "#4ade80" }}>✓</span>
      ) : (
        <span style={{ fontSize: 10, color: "var(--muted)" }}>🔒</span>
      )}

      {aberto && passo.itens.length > 0 && (
        <div style={{ gridColumn: "1 / -1", paddingTop: 8, marginTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {passo.itens.map((i) => (
            <div key={i.id} style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ ...tStat, fontSize: 9, color: "var(--muted)", minWidth: 116 }}>{ROTULO_TIPO[i.tipo] || i.tipo}</span>
              <span style={{ ...tBody, fontSize: 12, fontStyle: "normal", flex: 1 }}>{i.rotulo}</span>
              <span style={{ ...tSubtext, fontSize: 11, color: i.pendente ? "#fbbf24" : "var(--el-accent)" }}>
                {i.pendente ? "a escolher" : resumoResolucao(i)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 *  ABA
 * ══════════════════════════════════════════════════════════════════════════ */
export default function ProgressaoTab({ ficha, onAplicar, readOnly }) {
  const [assistente, setAssistente] = useState(null); // { modo, nexAlvo } | null

  const d = useMemo(() => derivar(ficha), [ficha]);
  const abertas = useMemo(() => pendencias(ficha), [ficha]);
  const linha = useMemo(() => linhaDoTempo(ficha), [ficha]);

  const classeId = ficha?.classe?.id || ficha?.classe;
  const classeMeta = CLASSES_OP.find((c) => c.id === classeId);
  const trilhaId = ficha?.trilha?.id || ficha?.trilha;
  const trilhaMeta = (CLASS_TRAILS[classeId] || []).find((t) => t.id === trilhaId);
  const proximo = proximoNex(ficha?.nex);
  const anterior = nexAnterior(ficha?.nex);
  const editavel = !readOnly && !!onAplicar;

  if (!classeId) {
    return (
      <div style={{ ...tEmpty, textAlign: "center", padding: 40 }}>
        Defina a classe do agente para o motor de progressão trabalhar.
      </div>
    );
  }

  const rebaixar = () => {
    if (!anterior) return;
    const aviso =
      `Voltar para NEX ${anterior}%?\n\n` +
      "O motor desfaz só o que ele concedeu acima desse ponto (pontos de atributo, graus de treinamento, " +
      "rituais aprendidos e habilidades de classe/trilha). Nada que você escreveu à mão é apagado.";
    if (window.confirm(aviso)) onAplicar(reverterPara(ficha, anterior));
  };

  return (
    <div style={{ padding: "4px 0" }}>
      <BarraNex nex={d.nex} />

      {/* ── 1. Avanço ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {editavel && proximo && (
          <button style={{ ...btnGold, padding: "10px 18px" }} onClick={() => setAssistente({ modo: "avanco", nexAlvo: proximo })}>
            ▲ Evoluir para NEX {proximo}%
          </button>
        )}
        {editavel && !proximo && (
          <span style={{ ...tStat, fontSize: 12, color: "var(--el-accent)", alignSelf: "center" }}>
            NEX 99% — o teto da exposição paranormal.
          </span>
        )}
        {editavel && abertas.length > 0 && (
          <button style={{ ...btnGhost, borderColor: "rgba(251,191,36,0.5)", color: "#fbbf24" }}
            onClick={() => setAssistente({ modo: "auditoria" })}>
            ⚠ Resolver {abertas.length} pendência{abertas.length > 1 ? "s" : ""}
          </button>
        )}
        {editavel && anterior && (
          <button style={{ ...btnGhost, marginLeft: "auto" }} onClick={rebaixar} title="Corrigir um NEX definido por engano">
            ▼ Voltar para {anterior}%
          </button>
        )}
      </div>

      {abertas.length > 0 && (
        <div style={{ padding: "11px 14px", borderRadius: 8, marginBottom: 16, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.28)" }}>
          <div style={{ ...tStat, fontSize: 11, color: "#fbbf24", marginBottom: 5 }}>PROGRESSÃO INCOMPLETA</div>
          <div style={{ ...tBody, fontSize: 12.5, lineHeight: 1.55, color: "rgba(232,228,217,0.75)" }}>
            O livro concede a este agente {abertas.length} escolha{abertas.length > 1 ? "s que ainda não foram feitas" : " que ainda não foi feita"}
            {": "}
            {abertas.slice(0, 4).map((p) => `${p.titulo} (NEX ${p.nex}%)`).join(", ")}
            {abertas.length > 4 ? ` e mais ${abertas.length - 4}.` : "."}
          </div>
        </div>
      )}

      {/* ── 2. Derivados ── */}
      <div style={{ ...tLabel, fontSize: 10, marginBottom: 8 }}>Calculado pelo livro — não se digita</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))", gap: 8, marginBottom: 8 }}>
        <Derivado rotulo="PV máximo" valor={d.pvMax} conta={`+${d.ganhoPorNivel.pv} por NEX`} />
        <Derivado rotulo="PE máximo" valor={d.peMax} conta={`+${d.ganhoPorNivel.pe} por NEX`} />
        <Derivado rotulo="Sanidade máxima" valor={d.sanMax} conta={`+${d.ganhoPorNivel.san} por NEX`} />
        <Derivado rotulo="Limite de PE / turno" valor={d.limitePeTurno} conta="Tabela 1.2" />
        <Derivado rotulo="Círculo de ritual" valor={`${d.circuloMax}º`} conta="5 · 25 · 55 · 85" />
        <Derivado rotulo="DT dos seus rituais" valor={d.dtRituais} conta="10 + NEX/5 + Presença" />
      </div>

      {d.bonusOrigem && (
        <div style={{ ...tSubtext, fontSize: 11.5, marginBottom: 16, padding: "9px 12px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          ✦ <b style={{ color: "var(--el-accent)" }}>{d.bonusOrigem.poder}</b> — {d.bonusOrigem.nota} Já somado acima
          {d.bonusOrigem.pv ? ` (+${d.bonusOrigem.pv} PV)` : ""}
          {d.bonusOrigem.pe ? ` (+${d.bonusOrigem.pe} PE)` : ""}
          {d.bonusOrigem.san ? ` (+${d.bonusOrigem.san} SAN)` : ""}.
        </div>
      )}

      {/* ── Classe / trilha / proficiências ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", marginBottom: 16, background: "rgba(255,255,255,0.03)", border: "1px solid var(--el-border)", borderRadius: 8 }}>
        <span style={{ fontSize: 26 }}>{classeMeta?.icon || "⚡"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...tCardTitle, fontSize: 14 }}>
            {classeMeta?.name || classeId}
            {trilhaMeta && <span style={{ color: "var(--el-accent)" }}> · {trilhaMeta.name}</span>}
          </div>
          <div style={{ ...tSubtext, fontSize: 11 }}>Proficiências: {d.proficiencias.join(" · ")}</div>
          {!trilhaMeta && d.nex >= 10 && (
            <div style={{ ...tSubtext, fontSize: 11, color: "#fbbf24" }}>Trilha ainda não escolhida.</div>
          )}
        </div>
      </div>

      {/* Poderes da trilha escolhida */}
      {trilhaMeta && (
        <>
          <div style={{ ...tLabel, fontSize: 10, marginBottom: 8 }}>Trilha {trilhaMeta.name}</div>
          {[10, 40, 65, 99].map((n) => {
            const ab = (TRAIL_ABILITIES[trilhaId] || {})[n];
            if (!ab) return null;
            const liberado = d.nex >= n;
            return (
              <div key={n} style={{
                padding: "11px 14px", borderRadius: 8, marginBottom: 6, opacity: liberado ? 1 : 0.42,
                background: liberado ? "rgba(201,168,76,0.06)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${liberado ? "var(--el-border)" : "rgba(255,255,255,0.06)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ ...tStat, fontSize: 10, background: "rgba(201,168,76,0.12)", padding: "2px 6px", borderRadius: 3 }}>NEX {n}%</span>
                  <span style={{ ...tCardTitle, fontSize: 13 }}>{ab.name}</span>
                  {ab.cost && ab.cost !== "—" && <span style={{ ...tStat, fontSize: 10, color: "#63a0f0" }}>{ab.cost}</span>}
                  {liberado && <span style={{ fontSize: 10, color: "#4ade80" }}>✓ na ficha</span>}
                </div>
                <div style={{ ...tBody, fontSize: 12, lineHeight: 1.55 }}>{ab.desc}</div>
              </div>
            );
          })}
        </>
      )}

      {/* ── 3. Linha do tempo ── */}
      <div style={{ ...tLabel, fontSize: 10, margin: "18px 0 8px" }}>Linha do tempo — {NEX_STEPS.length} degraus</div>
      {linha.map((passo) => <Degrau key={passo.nex} passo={passo} />)}

      {assistente && (
        <EvolucaoModal
          ficha={ficha}
          modo={assistente.modo}
          nexAlvo={assistente.nexAlvo}
          onAplicar={onAplicar}
          onClose={() => setAssistente(null)}
        />
      )}
    </div>
  );
}
