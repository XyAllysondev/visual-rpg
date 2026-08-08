/* Spec 0039 — a moldura de documento da Ordo Realitas.
 *
 * A criação de agente passa a se ler como um documento sendo EMITIDO: emissor,
 * natureza do documento, número de registro, filete, corpo.
 *
 * ⚠ MOLDURA, NÃO CENÁRIO. A referência que inspirou isto (RPGpedia) desenha papel
 * amassado sobre uma mesa de madeira. Aqui não se desenha cenário nenhum: usa-se
 * a superfície grafite (`--card`), o grão que a ficha já tem (`op-grain`) e o
 * filete de ouro corrompido (`--border2`) que são a identidade DESTE app. Cenário
 * ilustrado é o que faria a tela parecer arte gerada em vez de documento — lição
 * já registrada no `OrdemParanormalSheet` (o halo dourado atrás do nome, 2026-08-02).
 *
 * Nenhuma fonte nova: `Cinzel` (título) e `IBM Plex Mono` (dados) já vêm do tema.
 */

/* Largura do traçado que ocupa o lugar do número antes de o agente ter nome.
 * Tem de casar com "000000/000" para o cabeçalho não pular quando o nome chegar
 * (AC-3) — por isso são os mesmos 10 caracteres, não um traço solto. */
const TRACADO = "——————/———";

export default function DocPanel({ natureza, numero, children, aside }) {
  const emitido = !!numero;
  return (
    <div
      className="op-grain fade"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border2)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* ── Cabeçalho de emissão ── */}
      <div
        style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap",
          padding: "16px 22px 14px",
          background: "rgba(0,0,0,0.22)",
          borderBottom: "1px solid var(--border2)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "Cinzel,serif", fontSize: 15, letterSpacing: "0.22em", color: "var(--gold2)", textTransform: "uppercase", lineHeight: 1.2 }}>
            Ordo Realitas
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono','Share Tech Mono',monospace", fontSize: 10, letterSpacing: "0.06em", color: "var(--muted)", marginTop: 5, lineHeight: 1.6 }}>
            <span>Documento oficial n.º </span>
            {/* `aria-label` explica o traçado; sem isso um leitor de tela leria
                uma fileira de travessões como se fosse conteúdo. */}
            <span
              aria-label={emitido ? `Documento número ${numero}` : "Documento ainda não emitido"}
              style={{ color: emitido ? "var(--gold)" : "var(--muted)", opacity: emitido ? 1 : 0.55 }}
            >
              {emitido ? numero : TRACADO}
            </span>
            <br />
            <span style={{ textTransform: "uppercase", letterSpacing: "0.14em" }}>{natureza}</span>
          </div>
        </div>
        {aside ? <div style={{ flexShrink: 0 }}>{aside}</div> : null}
      </div>

      {/* ── Corpo ── */}
      <div style={{ padding: "24px 22px 26px" }}>{children}</div>
    </div>
  );
}
