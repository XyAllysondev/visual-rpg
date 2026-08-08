import { useState } from "react";
import { tLabel } from "./shared/modalStyles";
import {
  ACOES_INTERLUDIO, REGRA_DA_CENA, aplicarInterludio,
  registroVazio, historicoDeInterludios,
} from "../interludio";

/* Spec 0040 — a cena de Interlúdio do livro.
 *
 * ⚠ O TEXTO DAS AÇÕES NÃO MORA AQUI. Vem de `regras-oficiais.json` por
 * `ACOES_INTERLUDIO` — este componente só desenha. Reescrever a regra aqui
 * criaria uma segunda régua para a mesma coisa.
 *
 * ⚠ E NÃO EXISTE VALOR SUGERIDO DE RECUPERAÇÃO. A transcrição diz "(Resumo —
 * valores no livro.)", então os números são digitados por quem tem o livro na
 * mão. O que o app garante é o que a regra da cena diz por escrito: nenhuma
 * recuperação passa do máximo. Preencher um valor "provável" seria inventar regra.
 */

const secLabel = { ...tLabel, display: "flex", alignItems: "center", gap: 10, marginBottom: 8 };
const filete = { flex: 1, height: 1, background: "linear-gradient(90deg, var(--el-border), transparent)" };

const VITAIS = [
  { chave: "pv", label: "PV", cor: "#e53935" },
  { chave: "san", label: "SAN", cor: "var(--paranormal-text)" },
  { chave: "pe", label: "PE", cor: "#00acc1" },
];

export default function InterludioTab({ vitais, interludios, onAplicar, readOnly }) {
  const [acao, setAcao] = useState(null);
  const [ganhos, setGanhos] = useState({ pv: "", san: "", pe: "" });
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState("");

  const historico = historicoDeInterludios(interludios);

  const registrar = () => {
    const r = aplicarInterludio(vitais, { ...ganhos, acao, nota, id: `int-${Date.now()}` });
    if (!r.ok) { setErro(r.motivo); return; }
    setErro("");
    onAplicar(r);
    setAcao(null); setGanhos({ pv: "", san: "", pe: "" }); setNota("");
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

      {/* ── ESCOLHER A AÇÃO ── */}
      {!readOnly && (
        <div>
          <div style={{ ...secLabel, color: "var(--el-accent)" }}>
            <span style={{ whiteSpace: "nowrap" }}>Ação do interlúdio</span>
            <span style={filete} />
            <span className="op-data" style={{ fontSize: 9, color: "var(--muted)", whiteSpace: "nowrap" }}>escolha uma</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 8 }}>
            {ACOES_INTERLUDIO.map((a) => {
              const ativa = acao === a.id;
              return (
                <button key={a.id} onClick={() => setAcao(ativa ? null : a.id)}
                  aria-pressed={ativa} aria-label={`${a.nome}${ativa ? " (escolhida)" : ""}`}
                  style={{
                    textAlign: "left", cursor: "pointer", padding: "10px 12px", borderRadius: 4,
                    background: ativa ? "rgba(201,168,76,0.12)" : "rgba(0,0,0,0.2)",
                    border: `1px solid ${ativa ? "var(--el-accent)" : "var(--border)"}`,
                    transition: "all 0.18s",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {/* Marca, não só cor: a escolha tem de se ler sem depender de matiz. */}
                    <span aria-hidden="true" style={{
                      width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
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

          {/* ── QUANTO RECUPEROU ── */}
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            {VITAIS.map((v) => (
              <div key={v.chave}>
                <div className="op-label" style={{ color: "var(--muted)", marginBottom: 3 }}>+{v.label}</div>
                <input type="number" min={0} value={ganhos[v.chave]} aria-label={`Recuperação de ${v.label}`}
                  onChange={(e) => setGanhos((g) => ({ ...g, [v.chave]: e.target.value }))}
                  style={{ width: 62, textAlign: "center", padding: "5px 6px", fontSize: 13, color: v.cor }} />
              </div>
            ))}
            <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500}
              placeholder="O que o agente fez (opcional)" aria-label="Nota do interlúdio"
              style={{ flex: "1 1 200px", minWidth: 0, padding: "6px 8px", fontSize: 12 }} />
            <button onClick={registrar} disabled={!acao} aria-label="Registrar interlúdio"
              title={acao ? "Aplicar e registrar" : "Escolha uma ação primeiro"}
              style={{
                background: "none", border: `1px solid ${acao ? "var(--el-accent)" : "var(--border)"}`,
                borderRadius: 3, color: acao ? "var(--el-glow)" : "var(--muted)",
                cursor: acao ? "pointer" : "not-allowed", flexShrink: 0,
                fontFamily: "Cinzel,serif", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "8px 14px",
              }}>Registrar</button>
          </div>

          <div className="op-data" style={{ fontSize: 9, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
            Os valores de recuperação estão na tabela do livro — informe o que a mesa aplicou.
            A ficha garante que nada passe do seu máximo.
          </div>
          {erro && <div style={{ color: "var(--danger-text)", fontSize: 12, marginTop: 6 }}>{erro}</div>}
        </div>
      )}

      {/* ── HISTÓRICO ── */}
      <div>
        <div style={{ ...secLabel, color: "var(--el-accent)" }}>
          <span style={{ whiteSpace: "nowrap" }}>Interlúdios anteriores</span>
          <span style={filete} />
          {historico.length > 0 && (
            <span className="op-data" style={{ fontSize: 9, color: "var(--muted)" }}>{historico.length}</span>
          )}
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
                    {r.acaoNome || r.acao}
                  </span>
                  <span style={{ flex: 1 }} />
                  {/* "Descansei e não mudou nada" é um resultado, não um erro. */}
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
