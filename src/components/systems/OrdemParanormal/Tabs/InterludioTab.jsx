import { useState } from "react";
import { tLabel } from "./shared/modalStyles";
import {
  ACOES_INTERLUDIO, REGRA_DA_CENA, MAX_ACOES, CONDICOES_DESCANSO, PRATOS,
  acaoPorId, condicaoPorId, pratoPorId, podeAdicionarAcao,
  calcularRecuperacao, aplicarInterludio, registroVazio, historicoDeInterludios,
} from "../interludio";

/* Spec 0041 — a cena de Interlúdio com os valores do livro.
 *
 * ⚠ O TEXTO DAS REGRAS NÃO MORA AQUI. Vem de `regras-oficiais.json` pelo módulo
 * puro. Este componente só desenha e coleta escolhas.
 *
 * ⚠ E A CONTA TAMBÉM NÃO MORA AQUI. `calcularRecuperacao` é a única fonte —
 * a pré-visualização e a aplicação chamam a MESMA função, senão o número que o
 * jogador vê antes de confirmar poderia diferir do que entra na ficha.
 */

const secLabel = { ...tLabel, display: "flex", alignItems: "center", gap: 10, marginBottom: 8 };
const filete = { flex: 1, height: 1, background: "linear-gradient(90deg, var(--el-border), transparent)" };

const VITAIS = [
  { chave: "pv", label: "PV", cor: "#e53935" },
  { chave: "san", label: "SAN", cor: "var(--paranormal-text)" },
  { chave: "pe", label: "PE", cor: "#00acc1" },
];

const chip = (ativo) => ({
  background: ativo ? "rgba(201,168,76,0.14)" : "rgba(0,0,0,0.2)",
  border: `1px solid ${ativo ? "var(--el-accent)" : "var(--border)"}`,
  borderRadius: 3, cursor: "pointer", padding: "5px 10px",
  fontFamily: "Cinzel,serif", fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
  color: ativo ? "var(--gold2)" : "var(--muted2)", transition: "all 0.18s",
});

export default function InterludioTab({ vitais, interludios, onAplicar, readOnly }) {
  const [acoes, setAcoes] = useState([]);
  const [condicao, setCondicao] = useState("normal");
  const [prato, setPrato] = useState(null);
  const [relaxantes, setRelaxantes] = useState(1);
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState("");

  const historico = historicoDeInterludios(interludios);
  const escolha = { acoes, condicao, prato, relaxantes, nota };
  const previa = calcularRecuperacao(vitais, escolha);

  const dorme = acoes.includes("interludio-dormir");
  const relaxa = acoes.includes("interludio-relaxar");
  const come = acoes.includes("interludio-alimentar");
  const usaDescanso = dorme || relaxa;

  const alternar = (id) => {
    setErro("");
    setAcoes((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      if (!podeAdicionarAcao(atual, id)) {
        setErro(`O livro permite até ${MAX_ACOES} ações por interlúdio — desmarque uma para trocar.`);
        return atual;
      }
      return [...atual, id];
    });
  };

  const registrar = () => {
    const r = aplicarInterludio(vitais, { ...escolha, id: `int-${Date.now()}` });
    if (!r.ok) { setErro(r.motivo); return; }
    setErro("");
    onAplicar(r);
    setAcoes([]); setPrato(null); setNota(""); setRelaxantes(1); setCondicao("normal");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── A CENA ── */}
      {REGRA_DA_CENA && (
        <div className="op-ink" style={{ padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderLeft: "2px solid var(--el-accent)" }}>
          <div className="op-label" style={{ color: "var(--el-glow)", marginBottom: 4 }}>{REGRA_DA_CENA.nome}</div>
          <div style={{ fontFamily: "'Crimson Pro',serif", fontSize: 14, color: "var(--muted2)", lineHeight: 1.65 }}>
            {REGRA_DA_CENA.descricao}
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          {/* ── AÇÕES ── */}
          <div>
            <div style={{ ...secLabel, color: "var(--el-accent)" }}>
              <span style={{ whiteSpace: "nowrap" }}>Ações</span>
              <span style={filete} />
              <span className="op-data" style={{ fontSize: 9, color: acoes.length >= MAX_ACOES ? "var(--el-glow)" : "var(--muted)", whiteSpace: "nowrap" }}>
                {acoes.length} de {MAX_ACOES}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 8 }}>
              {ACOES_INTERLUDIO.map((a) => {
                const ativa = acoes.includes(a.id);
                const cheio = !ativa && acoes.length >= MAX_ACOES;
                return (
                  <button key={a.id} onClick={() => alternar(a.id)}
                    aria-pressed={ativa} aria-label={`${a.nome}${ativa ? " (escolhida)" : ""}`}
                    style={{
                      textAlign: "left", cursor: "pointer", padding: "10px 12px", borderRadius: 4,
                      background: ativa ? "rgba(201,168,76,0.12)" : "rgba(0,0,0,0.2)",
                      border: `1px solid ${ativa ? "var(--el-accent)" : "var(--border)"}`,
                      opacity: cheio ? 0.5 : 1, transition: "all 0.18s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span aria-hidden="true" style={{
                        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, border: `1px solid ${ativa ? "var(--el-accent)" : "var(--border2)"}`,
                        color: "var(--el-glow)",
                      }}>{ativa ? "✓" : ""}</span>
                      <span style={{ fontFamily: "Cinzel,serif", fontSize: 12, letterSpacing: 1, color: ativa ? "var(--gold2)" : "var(--text)", textTransform: "uppercase" }}>
                        {a.nome}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'Crimson Pro',serif", fontSize: 13, color: "var(--muted2)", lineHeight: 1.55 }}>
                      {a.descricao}
                    </div>
                  </button>
                );
              })}
            </div>
            {erro && <div style={{ color: "var(--danger-text)", fontSize: 12, marginTop: 8 }}>{erro}</div>}
          </div>

          {/* ── CONDIÇÃO DO DESCANSO (só se dormir/relaxar) ── */}
          {usaDescanso && (
            <div>
              <div style={{ ...secLabel, color: "var(--el-accent)" }}>
                <span style={{ whiteSpace: "nowrap" }}>Condição do descanso</span>
                <span style={filete} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {CONDICOES_DESCANSO.map((c) => (
                  <button key={c.id} onClick={() => setCondicao(c.id)} aria-pressed={condicao === c.id}
                    aria-label={`${c.label}${condicao === c.id ? " (escolhida)" : ""}`}
                    title={c.exemplo} style={chip(condicao === c.id)}>{c.label}</button>
                ))}
              </div>
              <div className="op-data" style={{ fontSize: 9, color: "var(--muted)", marginTop: 6 }}>
                {condicaoPorId(condicao).exemplo}
              </div>
            </div>
          )}

          {/* ── PRATO (só se alimentar-se) ── */}
          {come && (
            <div>
              <div style={{ ...secLabel, color: "var(--el-accent)" }}>
                <span style={{ whiteSpace: "nowrap" }}>Refeição</span>
                <span style={filete} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PRATOS.map((p) => (
                  <button key={p.id} onClick={() => setPrato(prato === p.id ? null : p.id)}
                    aria-pressed={prato === p.id} aria-label={`${p.label}${prato === p.id ? " (escolhido)" : ""}`}
                    title={p.efeito} style={chip(prato === p.id)}>{p.label}</button>
                ))}
              </div>
              {prato && (
                <div className="op-data" style={{ fontSize: 9, color: "var(--muted)", marginTop: 6 }}>
                  {pratoPorId(prato).efeito}
                </div>
              )}
            </div>
          )}

          {/* ── PRÉ-VISUALIZAÇÃO + REGISTRAR ── */}
          <div>
            <div style={{ ...secLabel, color: "var(--el-accent)" }}>
              <span style={{ whiteSpace: "nowrap" }}>O que isto recupera</span>
              <span style={filete} />
            </div>
            <div className="op-ink" style={{ padding: "10px 12px", background: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              {VITAIS.map((v) => (
                <div key={v.chave} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 24, lineHeight: 1, color: previa[v.chave] > 0 ? v.cor : "var(--muted)" }}>
                    +{previa[v.chave]}
                  </div>
                  <div className="op-label" style={{ color: "var(--muted)" }}>{v.label}</div>
                </div>
              ))}
              <div style={{ flex: 1, minWidth: 140 }}>
                <div className="op-data" style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.6 }}>
                  {usaDescanso
                    ? `Base: limite de PE por rodada (${vitais?.peTurno ?? 0}) × ${condicaoPorId(condicao).label.toLowerCase()}. O que passar do seu máximo é descartado.`
                    : "Ler, Exercitar-se, Manutenção e Revisar o Caso não recuperam pontos — o benefício delas é na próxima cena."}
                </div>
              </div>
            </div>

            {relaxa && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <span className="op-data" style={{ fontSize: 10, color: "var(--muted2)" }}>Quantos relaxaram neste interlúdio (contando você)</span>
                <input type="number" min={1} value={relaxantes} aria-label="Quantos relaxaram neste interlúdio"
                  onChange={(e) => setRelaxantes(e.target.value)}
                  style={{ width: 58, textAlign: "center", padding: "4px 6px", fontSize: 13 }} />
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
              <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500}
                placeholder="O que o agente fez (opcional)" aria-label="Nota do interlúdio"
                style={{ flex: "1 1 220px", minWidth: 0, padding: "6px 8px", fontSize: 12 }} />
              <button onClick={registrar} disabled={acoes.length === 0} aria-label="Registrar interlúdio"
                title={acoes.length ? "Aplicar e registrar" : "Escolha ao menos uma ação"}
                style={{
                  background: "none", border: `1px solid ${acoes.length ? "var(--el-accent)" : "var(--border)"}`,
                  borderRadius: 3, color: acoes.length ? "var(--el-glow)" : "var(--muted)",
                  cursor: acoes.length ? "pointer" : "not-allowed", flexShrink: 0,
                  fontFamily: "Cinzel,serif", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "8px 14px",
                }}>Registrar</button>
            </div>
          </div>
        </>
      )}

      {/* ── HISTÓRICO ── */}
      <div>
        <div style={{ ...secLabel, color: "var(--el-accent)" }}>
          <span style={{ whiteSpace: "nowrap" }}>Interlúdios anteriores</span>
          <span style={filete} />
          {historico.length > 0 && <span className="op-data" style={{ fontSize: 9, color: "var(--muted)" }}>{historico.length}</span>}
        </div>
        {historico.length === 0 ? (
          <div className="op-data" style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
            Nenhum interlúdio registrado. É aqui que dá para revisar o que o agente fez entre as missões.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {historico.map((r, i) => (
              <div key={r.id || i} className="op-ink" style={{ padding: "8px 10px", background: "rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "Cinzel,serif", fontSize: 11, letterSpacing: 1, color: "var(--gold2)", textTransform: "uppercase" }}>
                    {(r.acoesNomes || []).join(" + ") || (r.acoes || []).map((a) => acaoPorId(a)?.nome || a).join(" + ")}
                  </span>
                  {r.condicao && (
                    <span className="op-data" style={{ fontSize: 9, color: "var(--muted)" }}>{condicaoPorId(r.condicao).label}</span>
                  )}
                  {r.prato && (
                    <span className="op-data" style={{ fontSize: 9, color: "var(--muted)" }}>{pratoPorId(r.prato)?.label}</span>
                  )}
                  <span style={{ flex: 1 }} />
                  {registroVazio(r) ? (
                    <span className="op-data" style={{ fontSize: 9, color: "var(--muted)" }}>sem recuperação</span>
                  ) : (
                    <span className="op-data" style={{ fontSize: 10, display: "flex", gap: 8 }}>
                      {VITAIS.filter((v) => r[v.chave] > 0).map((v) => (
                        <span key={v.chave} style={{ color: v.cor }}>+{r[v.chave]} {v.label}</span>
                      ))}
                    </span>
                  )}
                </div>
                {r.nota && (
                  <div style={{ fontFamily: "'Crimson Pro',serif", fontSize: 13, color: "var(--muted2)", lineHeight: 1.55, marginTop: 4 }}>
                    {r.nota}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
