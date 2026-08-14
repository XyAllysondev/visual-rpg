import { useState } from "react";
import RichTextEditor from "./shared/RichTextEditor";
import { tLabel } from "./shared/modalStyles";
import {
  ESTADOS_PISTA, estadoPorId, novaPista, mudarEstadoPista,
  removerPista, contarPistas, pistasOrdenadas,
} from "../investigacao";

/* Spec 0040 — o dossiê do caso.
 *
 * A regra que decide o desenho: pista tem ESTADO, e estado descartado precisa
 * ser distinguível de estado aberto por MARCA, não só por cor (AC-2) — a lição
 * que o grau de treino das perícias já nos ensinou na spec 0037.
 */

const secLabel = { ...tLabel, display: "flex", alignItems: "center", gap: 10, marginBottom: 8 };
const filete = { flex: 1, height: 1, background: "linear-gradient(90deg, var(--el-border), transparent)" };

const CorDoEstado = {
  aberta: "var(--el-glow)",
  confirmada: "#4ade80",
  descartada: "var(--muted)",
};

export default function InvestigacaoTab({ investigacao, setInvestigacao, readOnly }) {
  const dados = investigacao || {};
  const pistas = Array.isArray(dados.pistas) ? dados.pistas : [];
  const conta = contarPistas(pistas);

  const [texto, setTexto] = useState("");
  const [origem, setOrigem] = useState("");

  const set = (chave, valor) => setInvestigacao((p) => ({ ...(p || {}), [chave]: valor }));
  const setPistas = (lista) => set("pistas", lista);

  const adicionar = () => {
    const p = novaPista({ texto, origem, id: `pista-${Date.now()}` });
    if (!p) return; // sem texto não há pista
    setPistas([...pistas, p]);
    setTexto(""); setOrigem("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── PISTAS ── */}
      <div>
        <div style={{ ...secLabel, color: "var(--el-accent)" }}>
          <span style={{ whiteSpace: "nowrap" }}>Pistas</span>
          <span style={filete} />
          {/* O cabeçalho conta ABERTAS, não o total: total inclui trabalho
              encerrado e não diz quanto ainda falta perseguir (AC-3). */}
          {conta.total > 0 && (
            <span className="op-data" style={{ fontSize: 9, color: "var(--el-glow)", whiteSpace: "nowrap" }}>
              {conta.abertas} {conta.abertas === 1 ? "aberta" : "abertas"} · {conta.total} no total
            </span>
          )}
        </div>

        {conta.total === 0 ? (
          <div className="op-data" style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7, padding: "4px 0 10px" }}>
            {readOnly
              ? "Nenhuma pista registrada."
              : "Registre o que a mesa levantou e de onde veio. Depois marque cada uma como confirmada ou descartada — pista descartada que continua parecendo viva é o que faz o grupo perseguir o que já eliminou."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {pistasOrdenadas(pistas).map((p) => {
              const est = estadoPorId(p.estado);
              const descartada = p.estado === "descartada";
              return (
                <div key={p.id} className="op-ink" style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px",
                  background: "rgba(0,0,0,0.2)", opacity: descartada ? 0.55 : 1,
                }}>
                  <span aria-hidden="true" title={est.label} style={{
                    flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'IBM Plex Mono','Share Tech Mono',monospace", fontSize: 10,
                    border: `1px solid ${CorDoEstado[p.estado] || CorDoEstado.aberta}`,
                    color: CorDoEstado[p.estado] || CorDoEstado.aberta,
                  }}>{est.marca}</span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, color: descartada ? "var(--muted)" : "var(--text)", lineHeight: 1.5,
                      textDecoration: descartada ? "line-through" : "none",
                    }}>{p.texto}</div>
                    <div className="op-data" style={{ fontSize: 9, color: "var(--muted)", marginTop: 3 }}>
                      <span aria-label={`Estado: ${est.label}`}>{est.label}</span>
                      {p.origem ? ` · ${p.origem}` : ""}
                    </div>
                  </div>

                  {!readOnly && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {ESTADOS_PISTA.filter((e) => e.id !== p.estado).map((e) => (
                        <button key={e.id} onClick={() => setPistas(mudarEstadoPista(pistas, p.id, e.id))}
                          aria-label={`Marcar "${p.texto}" como ${e.label}`} title={e.label}
                          style={{
                            background: "none", border: "1px solid var(--border)", borderRadius: 3,
                            color: CorDoEstado[e.id], cursor: "pointer", padding: "1px 6px", fontSize: 11,
                          }}>{e.marca}</button>
                      ))}
                      <button onClick={() => setPistas(removerPista(pistas, p.id))}
                        aria-label={`Remover "${p.texto}"`} title="Remover"
                        style={{ background: "none", border: "none", color: "var(--danger-text)", cursor: "pointer", padding: "0 2px", fontSize: 13 }}>×</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!readOnly && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              placeholder="A pista" aria-label="Texto da pista"
              style={{ flex: "2 1 200px", minWidth: 0, padding: "5px 8px", fontSize: 12 }} />
            <input value={origem} onChange={(e) => setOrigem(e.target.value)} maxLength={120}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              placeholder="De onde veio" aria-label="Origem da pista"
              style={{ flex: "1 1 140px", minWidth: 0, padding: "5px 8px", fontSize: 12 }} />
            <button onClick={adicionar} disabled={!texto.trim()} aria-label="Registrar pista"
              title={texto.trim() ? "Registrar" : "Escreva a pista primeiro"}
              style={{
                background: "none", border: "1px solid var(--border2)", borderRadius: 3,
                color: texto.trim() ? "var(--el-glow)" : "var(--muted)",
                cursor: texto.trim() ? "pointer" : "not-allowed",
                fontFamily: "Cinzel,serif", fontSize: 9, letterSpacing: 2,
                textTransform: "uppercase", padding: "6px 12px", flexShrink: 0,
              }}>+ Pista</button>
          </div>
        )}
      </div>

      {/* ── NOTAS ── */}
      {[
        { key: "notasCaso", label: "O caso", hint: "O que aconteceu, quem está envolvido, o que não fecha…" },
        { key: "notasCampanha", label: "A campanha", hint: "Fios soltos entre missões, nomes que voltam, o que a Ordem esconde…" },
      ].map((s) => (
        <div key={s.key}>
          <div style={{ ...secLabel, color: "var(--el-accent)" }}>
            <span style={{ whiteSpace: "nowrap" }}>{s.label}</span>
            <span style={filete} />
          </div>
          <RichTextEditor value={dados[s.key]} onChange={(v) => set(s.key, v)} placeholder={s.hint} minHeight={100} />
        </div>
      ))}
    </div>
  );
}
