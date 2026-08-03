/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — ASSISTENTE DE EVOLUÇÃO
 *  ------------------------------------------------------------------------
 *  A cara do motor de progressão. Dois modos:
 *
 *    "avanco"    — subir um degrau de NEX. Mostra primeiro TUDO que o livro
 *                  concede sozinho (PV, PE, SAN, limite de PE, círculo de
 *                  ritual, habilidades de texto fixo, poder de trilha) e só
 *                  então pergunta o que o livro manda o jogador escolher.
 *    "auditoria" — ficha antiga, preenchida à mão: resolve de uma vez tudo o
 *                  que ficou devendo, sem mexer no NEX.
 *
 *  Nenhuma opção inválida é oferecida sem explicação: pré-requisito não
 *  cumprido aparece esmaecido, com o motivo escrito.
 * ════════════════════════════════════════════════════════════════════════ */

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { planoDeAvanco, pendencias, aplicar, derivar } from "./progressao/motor";
import ElementoSymbol from "./ElementoSymbol";
import { getElementTheme } from "./elementos";
import { modalTitle, btnGold, btnGhost, tCardTitle, tBody, tStat, tLabel, tSubtext, inputS } from "./Tabs/shared/modalStyles";

const S = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.86)",
    backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  },
  painel: {
    width: "min(720px, 100%)", maxHeight: "92vh", display: "flex", flexDirection: "column",
    background: "linear-gradient(180deg,#111119,#0b0b12)", border: "1px solid var(--el-border,rgba(201,168,76,0.3))",
    borderRadius: 12, boxShadow: "0 0 60px rgba(0,0,0,0.8)", overflow: "hidden",
  },
  cabecalho: { padding: "18px 22px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  corpo: { flex: 1, overflowY: "auto", padding: "18px 22px" },
  rodape: {
    padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.07)",
    display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.3)", flexWrap: "wrap",
  },
  trilho: { height: 6, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginTop: 10 },
  preenchimento: (pct) => ({
    height: "100%", width: `${pct}%`, borderRadius: 3,
    background: "linear-gradient(90deg,var(--el-primary,#7b1fa2),var(--el-accent,#c9a84c))",
    boxShadow: "0 0 10px var(--el-glow,rgba(201,168,76,0.5))", transition: "width .45s ease",
  }),
  linhaGanho: {
    display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 10,
    padding: "11px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)", marginBottom: 6,
  },
  ganhoNum: { fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 19, lineHeight: 1 },
  cartao: (sel, off) => ({
    textAlign: "left", width: "100%", display: "block", cursor: off ? "not-allowed" : "pointer",
    padding: "12px 14px", borderRadius: 8, marginBottom: 7, transition: "border-color .15s, background .15s",
    background: sel ? "rgba(201,168,76,0.10)" : "rgba(255,255,255,0.02)",
    border: `1px solid ${sel ? "var(--el-accent,#c9a84c)" : "rgba(255,255,255,0.08)"}`,
    opacity: off ? 0.42 : 1,
  }),
  marcador: (sel) => ({
    width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
    border: `1px solid ${sel ? "var(--el-accent,#c9a84c)" : "rgba(255,255,255,0.2)"}`,
    background: sel ? "var(--el-accent,#c9a84c)" : "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#0a0a0f", fontSize: 11, fontWeight: 700, lineHeight: 1,
  }),
  aviso: {
    padding: "9px 12px", borderRadius: 6, background: "rgba(216,90,90,0.08)",
    border: "1px solid rgba(216,90,90,0.25)", color: "#e2a1a1", fontSize: 12, marginTop: 8,
  },
  ponto: (estado) => ({
    width: estado === "atual" ? 18 : 6, height: 6, borderRadius: 3,
    background: estado === "vazio" ? "rgba(255,255,255,0.15)" : "var(--el-accent,#c9a84c)",
    transition: "width .25s ease",
  }),
};

const temValor = (v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "");

/* ── Cartão de opção ───────────────────────────────────────────────────── */
function Opcao({ opcao, selecionada, onToggle, simbolo }) {
  const off = !opcao.disponivel;
  return (
    <button
      type="button"
      style={S.cartao(selecionada, off)}
      disabled={off}
      aria-pressed={selecionada}
      onClick={() => !off && onToggle(opcao.id)}
      onMouseEnter={(e) => { if (!off && !selecionada) e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)"; }}
      onMouseLeave={(e) => { if (!selecionada) e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={S.marcador(selecionada)}>{selecionada ? "✓" : ""}</span>
        {simbolo}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ ...tCardTitle, fontSize: 13.5 }}>{opcao.nome}</span>
            {opcao.custo && opcao.custo !== "—" && (
              <span style={{ ...tStat, fontSize: 10, color: "#63a0f0" }}>{opcao.custo}</span>
            )}
          </div>
          {opcao.desc && (
            <div style={{ ...tBody, fontSize: 12.5, lineHeight: 1.55, marginTop: 4, color: "rgba(232,228,217,0.7)" }}>
              {opcao.desc}
            </div>
          )}
          {off && opcao.motivo && (
            <div style={{ ...tSubtext, fontSize: 11, marginTop: 5, color: "#c98a8a" }}>🔒 {opcao.motivo}</div>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── Passo de escolha ──────────────────────────────────────────────────── */
function PassoEscolha({ pendencia, valor, setValor }) {
  const [busca, setBusca] = useState("");
  const multiplo = pendencia.quantidade > 1;
  const escolhidos = useMemo(() => (Array.isArray(valor) ? valor : valor ? [valor] : []), [valor]);

  const alternar = (id) => {
    if (!multiplo) { setValor(escolhidos[0] === id ? "" : id); return; }
    setValor(
      escolhidos.includes(id)
        ? escolhidos.filter((x) => x !== id)
        : escolhidos.length >= pendencia.quantidade ? escolhidos : [...escolhidos, id],
    );
  };

  const filtradas = pendencia.opcoes.filter(
    (o) => !busca || `${o.nome} ${o.desc || ""}`.toLowerCase().includes(busca.toLowerCase()),
  );
  const cheio = multiplo && escolhidos.length >= pendencia.quantidade;

  return (
    <div>
      <div style={{ ...tLabel, fontSize: 10, marginBottom: 4 }}>NEX {pendencia.nex}%</div>
      <h3 style={{ ...modalTitle, fontSize: 18, margin: "0 0 6px" }}>{pendencia.titulo}</h3>
      <p style={{ ...tBody, fontSize: 13, lineHeight: 1.6, margin: "0 0 14px", color: "rgba(232,228,217,0.65)" }}>
        {pendencia.descricao}
      </p>

      {multiplo && (
        <div style={{ ...tStat, fontSize: 11, marginBottom: 10, color: cheio ? "#4ade80" : "var(--el-accent,#c9a84c)" }}>
          {escolhidos.length} de {pendencia.quantidade} escolhidas{cheio ? " ✓" : ""}
        </div>
      )}

      {pendencia.opcoes.length > 8 && (
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar…"
          style={{ ...inputS, marginBottom: 10 }}
          aria-label={`Buscar em ${pendencia.titulo}`}
        />
      )}

      {filtradas.length === 0 ? (
        <div style={{ ...tSubtext, textAlign: "center", padding: 30 }}>Nada encontrado.</div>
      ) : (
        filtradas.map((o) => {
          const semVaga = cheio && !escolhidos.includes(o.id);
          return (
            <Opcao
              key={o.id}
              opcao={semVaga
                ? { ...o, disponivel: false, motivo: `Você já escolheu ${pendencia.quantidade}. Desmarque uma para trocar.` }
                : o}
              selecionada={escolhidos.includes(o.id)}
              onToggle={alternar}
              simbolo={pendencia.tipo === "afinidade"
                ? <ElementoSymbol id={o.id} size={20} color={getElementTheme(o.id).accent} />
                : null}
            />
          );
        })
      )}
    </div>
  );
}

/* ── Passo do que é automático ─────────────────────────────────────────── */
function PassoAutomatico({ plano, ficha }) {
  const d = derivar(ficha);
  return (
    <div>
      <div style={{ ...tLabel, fontSize: 10, marginBottom: 4 }}>Concedido pelo livro</div>
      <h3 style={{ ...modalTitle, fontSize: 18, margin: "0 0 6px" }}>Isso o sistema já aplica sozinho</h3>
      <p style={{ ...tBody, fontSize: 13, lineHeight: 1.6, margin: "0 0 16px", color: "rgba(232,228,217,0.65)" }}>
        Nada aqui precisa ser digitado: são os valores que a tabela da sua classe determina no NEX {plano.para}%.
      </p>

      {plano.automaticos.map((g) => (
        <div key={g.rotulo} style={S.linhaGanho}>
          <span style={{ ...tBody, fontSize: 13.5, fontStyle: "normal" }}>{g.rotulo}</span>
          <span style={{ ...S.ganhoNum, color: "var(--muted,rgba(255,255,255,0.4))" }}>{g.de}{g.sufixo}</span>
          <span style={{ color: "var(--muted,rgba(255,255,255,0.35))", fontSize: 15 }}>→</span>
          <span style={{ ...S.ganhoNum, color: "var(--el-accent,#c9a84c)" }}>
            {g.para}{g.sufixo}
            <span style={{ ...tStat, fontSize: 10, color: "#4ade80", marginLeft: 6 }}>+{g.ganho}</span>
          </span>
        </div>
      ))}

      {plano.habilidadesAutomaticas.length > 0 && (
        <>
          <div style={{ ...tLabel, fontSize: 10, margin: "18px 0 8px" }}>Habilidades que chegam sozinhas</div>
          {plano.habilidadesAutomaticas.map((h, i) => (
            <div key={`${h.nex}-${i}`} style={{ padding: "11px 14px", borderRadius: 8, marginBottom: 6, background: "rgba(201,168,76,0.05)", border: "1px solid var(--el-border,rgba(201,168,76,0.2))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ ...tStat, fontSize: 10, background: "rgba(201,168,76,0.14)", padding: "2px 6px", borderRadius: 3 }}>NEX {h.nex}%</span>
                <span style={{ ...tCardTitle, fontSize: 13.5 }}>{h.nome}</span>
                {h.custo && h.custo !== "—" && <span style={{ ...tStat, fontSize: 10, color: "#63a0f0" }}>{h.custo}</span>}
                {h.substitui && <span style={{ ...tSubtext, fontSize: 10 }}>substitui a versão anterior</span>}
              </div>
              <div style={{ ...tBody, fontSize: 12.5, lineHeight: 1.55, color: "rgba(232,228,217,0.7)" }}>{h.desc}</div>
            </div>
          ))}
        </>
      )}

      {d.bonusOrigem && (
        <div style={{ ...tSubtext, fontSize: 11.5, marginTop: 14, padding: "9px 12px", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
          ✦ Sua origem também escala com o NEX — {d.bonusOrigem.nota} Já está somado acima.
        </div>
      )}

      {plano.automaticos.length === 0 && plano.habilidadesAutomaticas.length === 0 && (
        <div style={{ ...tSubtext, textAlign: "center", padding: 24 }}>Nada automático neste degrau.</div>
      )}
    </div>
  );
}

/* ── Passo final ───────────────────────────────────────────────────────── */
function PassoResumo({ passos, escolhas, modo, plano }) {
  const escolhaPassos = passos.filter((p) => p.tipo !== "__auto__");
  const pendentes = escolhaPassos.filter((p) => !temValor(escolhas[p.id]));
  return (
    <div>
      <div style={{ ...tLabel, fontSize: 10, marginBottom: 4 }}>Conferência</div>
      <h3 style={{ ...modalTitle, fontSize: 18, margin: "0 0 14px" }}>
        {modo === "avanco" ? `Confirmar avanço para NEX ${plano?.para}%` : "Confirmar as escolhas"}
      </h3>

      {escolhaPassos.length === 0 && (
        <div style={{ ...tBody, fontSize: 13, color: "rgba(232,228,217,0.65)" }}>
          Este degrau não pede nenhuma escolha — é só confirmar.
        </div>
      )}

      {escolhaPassos.map((p) => {
        const v = escolhas[p.id];
        const nomes = (Array.isArray(v) ? v : v ? [v] : [])
          .map((id) => (p.opcoes.find((o) => o.id === id) || {}).nome || id);
        return (
          <div key={p.id} style={{ ...S.linhaGanho, gridTemplateColumns: "1fr 1.4fr" }}>
            <span style={{ ...tBody, fontSize: 13, fontStyle: "normal" }}>{p.titulo}</span>
            <span style={{ ...tStat, fontSize: 12, color: nomes.length ? "var(--el-accent,#c9a84c)" : "#c98a8a", textAlign: "right" }}>
              {nomes.length ? nomes.join(" · ") : "deixado para depois"}
            </span>
          </div>
        );
      })}

      {pendentes.length > 0 && (
        <div style={S.aviso}>
          {pendentes.length} escolha{pendentes.length > 1 ? "s ficam" : " fica"} pendente. A ficha avança do mesmo jeito e
          o aviso continua na aba Progressão até você decidir.
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 *  MODAL
 * ══════════════════════════════════════════════════════════════════════════ */
export default function EvolucaoModal({ ficha, nexAlvo, modo = "avanco", onAplicar, onClose }) {
  const plano = useMemo(
    () => (modo === "avanco" ? planoDeAvanco(ficha, nexAlvo) : null),
    [ficha, nexAlvo, modo],
  );

  const escolhasPendentes = useMemo(
    () => (modo === "avanco" ? plano.escolhas : pendencias(ficha)),
    [modo, plano, ficha],
  );

  /* passo sintético do "automático" só existe quando há algo a mostrar */
  const passos = useMemo(() => {
    const temAuto = modo === "avanco" && (plano.automaticos.length > 0 || plano.habilidadesAutomaticas.length > 0);
    return [...(temAuto ? [{ id: "__auto__", tipo: "__auto__" }] : []), ...escolhasPendentes];
  }, [modo, plano, escolhasPendentes]);

  const [indice, setIndice] = useState(0);
  const [escolhas, setEscolhas] = useState({});

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const total = passos.length + 1; // +1 = resumo
  const noResumo = indice >= passos.length;
  const atual = noResumo ? null : passos[indice];
  const pct = Math.round(((indice + 1) / total) * 100);

  const confirmar = () => {
    onAplicar(aplicar(ficha, escolhas, modo === "avanco" ? { nex: plano.para } : {}));
    onClose?.();
  };

  const podeAvancar = !atual || atual.tipo === "__auto__" || temValor(escolhas[atual.id]);

  return createPortal(
    <div style={S.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Assistente de evolução">
      <div style={S.painel} onClick={(e) => e.stopPropagation()}>

        {/* ── cabeçalho ── */}
        <div style={S.cabecalho}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...tLabel, fontSize: 10 }}>
              {modo === "avanco" ? "Nível de Exposição Paranormal" : "Pendências de progressão"}
            </span>
            {modo === "avanco" && (
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 22, color: "var(--el-accent,#c9a84c)" }}>
                {plano.de}% <span style={{ color: "var(--muted,rgba(255,255,255,0.35))", fontSize: 16 }}>→</span> {plano.para}%
              </span>
            )}
          </div>
          <div style={S.trilho}><div style={S.preenchimento(pct)} /></div>
          <div style={{ display: "flex", gap: 5, marginTop: 10, alignItems: "center" }}>
            {passos.map((p, i) => (
              <span key={p.id} style={S.ponto(i === indice ? "atual" : i < indice ? "feito" : "vazio")} />
            ))}
            <span style={S.ponto(noResumo ? "atual" : "vazio")} />
            <span style={{ ...tSubtext, fontSize: 10, marginLeft: "auto" }}>
              {Math.min(indice + 1, total)} de {total}
            </span>
          </div>
        </div>

        {/* ── corpo ── */}
        <div style={S.corpo}>
          {noResumo ? (
            <PassoResumo passos={passos} escolhas={escolhas} modo={modo} plano={plano} />
          ) : atual.tipo === "__auto__" ? (
            <PassoAutomatico plano={plano} ficha={ficha} />
          ) : (
            <PassoEscolha
              key={atual.id}
              pendencia={atual}
              valor={escolhas[atual.id]}
              setValor={(v) => setEscolhas((e) => ({ ...e, [atual.id]: v }))}
            />
          )}
        </div>

        {/* ── rodapé ── */}
        <div style={S.rodape}>
          <button style={btnGhost} onClick={indice === 0 ? onClose : () => setIndice((i) => i - 1)}>
            {indice === 0 ? "Cancelar" : "← Voltar"}
          </button>
          <div style={{ flex: 1 }} />
          {!noResumo && atual?.tipo !== "__auto__" && (
            <button style={{ ...btnGhost, opacity: 0.75 }} onClick={() => setIndice((i) => i + 1)} title="Deixar esta escolha pendente">
              Decidir depois
            </button>
          )}
          {noResumo ? (
            <button style={btnGold} onClick={confirmar}>
              {modo === "avanco" ? "Evoluir agente" : "Aplicar escolhas"}
            </button>
          ) : (
            <button
              style={{ ...btnGold, opacity: podeAvancar ? 1 : 0.45, cursor: podeAvancar ? "pointer" : "not-allowed" }}
              disabled={!podeAvancar}
              onClick={() => setIndice((i) => i + 1)}
            >
              Continuar →
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
