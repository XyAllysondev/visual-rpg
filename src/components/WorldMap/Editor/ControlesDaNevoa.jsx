/* ════════════════════════════════════════════════════════════════════
 *  CONTROLES DA NÉVOA  (spec 0028 · F3 · AC-5)
 *  --------------------------------------------------------------------
 *  A barra que o mestre usa para mandar na névoa: ligar, escolher se o
 *  pincel revela ou cobre, o tamanho do pincel, os dois atalhos brutos
 *  (cobrir tudo / revelar tudo) e o alternador de visão.
 *
 *  ── O ALTERNADOR DE VISÃO (padrão da spec 0012) ─────────────────────
 *  Dois estados SEPARADOS que se juntam só no render:
 *
 *      papelReal   — quem a pessoa é de verdade (na F4, o jogador na mesa)
 *      previsão    — o mestre pedindo "me mostra como o jogador vê"
 *      comoJogador = papelReal === 'jogador' || previsão      ← só no render
 *
 *  É por isso que o mestre não perde nenhuma ferramenta ao espiar: quem
 *  desliga as ferramentas é `somenteLeitura`, não a visão. O editor tático
 *  faz igual (`MapEditor/index.jsx:1419`, `asViewer = viewer || previewPlayer`)
 *  e este módulo copia o padrão em vez de inventar outro.
 *
 *  E o modo é marcado por **borda colorida no palco**, não só por um ícone
 *  aceso: o mestre precisa saber, de relance e no meio da sessão, que o que
 *  ele está vendo não é a verdade. Ícone aceso num canto se esquece; moldura
 *  violeta em volta do mapa inteiro, não.
 * ════════════════════════════════════════════════════════════════════ */

import { SP, R, FS, FW, T, HIT, LINE, btnStyle } from "../Atelier/ui";

/** Raio do pincel em unidades de MUNDO — a mesma régua do raio de revelação. */
export const RAIO_MINIMO = 20;
export const RAIO_MAXIMO = 600;
export const RAIO_PADRAO = 140;

/** A cor que marca "você está vendo como o jogador". A mesma do segredo. */
export const COR_DA_VISAO_DE_JOGADOR = "#8a7ad6";

/** Grampeia o raio do pincel na faixa utilizável. */
export function raioValido(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return RAIO_PADRAO;
  return Math.max(RAIO_MINIMO, Math.min(RAIO_MAXIMO, Math.round(n)));
}

/** "31%" — a fração revelada em linguagem de gente. */
export function percentual(fracao) {
  const f = Number.isFinite(fracao) ? Math.max(0, Math.min(1, fracao)) : 0;
  return `${Math.round(f * 100)}%`;
}

/** "12 KB" · "840 B" — o peso da névoa, para o mestre saber se cabe. */
export function pesoLegivel(bytes) {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (n < 1024) return `${n} B`;
  return `${Math.round(n / 1024)} KB`;
}

const Separador = () => (
  <div aria-hidden="true" style={{ width: 1, height: 22, background: LINE.edge, flexShrink: 0 }} />
);

/**
 * @param {object} props
 * @param {boolean} props.ligada névoa habilitada neste molde.
 * @param {(v:boolean)=>void} props.onLigar
 * @param {'revelar'|'cobrir'} props.modo o que o pincel faz.
 * @param {(m:'revelar'|'cobrir')=>void} props.onModo
 * @param {number} props.raio raio do pincel, em unidades de mundo.
 * @param {(r:number)=>void} props.onRaio
 * @param {boolean} props.previsaoDeJogador o mestre está espiando a visão do jogador.
 * @param {(v:boolean)=>void} props.onPrevisao
 * @param {()=>void} props.onCobrirTudo
 * @param {()=>void} props.onRevelarTudo
 * @param {number} props.fracao fração revelada (0–1).
 * @param {number} props.bytes tamanho da névoa serializada.
 * @param {boolean} [props.gravando]
 * @param {boolean} [props.pendente]
 * @param {boolean} [props.somenteLeitura]
 */
export default function ControlesDaNevoa({
  ligada,
  onLigar,
  modo = "revelar",
  onModo,
  raio = RAIO_PADRAO,
  onRaio,
  previsaoDeJogador = false,
  onPrevisao,
  onCobrirTudo,
  onRevelarTudo,
  fracao = 0,
  bytes = 0,
  gravando = false,
  pendente = false,
  somenteLeitura = false,
}) {
  return (
    <div
      role="group"
      aria-label="Névoa do mapa"
      style={{
        display: "flex", alignItems: "center", gap: SP.x3, flexWrap: "wrap",
        padding: SP.x2, background: "var(--card)",
        border: `1px solid ${previsaoDeJogador ? COR_DA_VISAO_DE_JOGADOR : LINE.edge}`,
        borderRadius: R.card,
      }}
    >
      {/* ── Ligar/desligar ────────────────────────────────────────── */}
      <label
        className="wme-focus"
        style={{
          display: "inline-flex", alignItems: "center", gap: SP.x2,
          minHeight: HIT.mobile, padding: `0 ${SP.x2}px`, cursor: somenteLeitura ? "default" : "pointer",
          ...T.btn, fontSize: FS.tag, color: ligada ? "var(--gold2,var(--gold))" : "var(--muted2)",
        }}
      >
        <input
          type="checkbox"
          checked={!!ligada}
          disabled={somenteLeitura}
          onChange={(e) => onLigar && onLigar(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: "var(--gold2,var(--gold))", cursor: "inherit" }}
        />
        <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>🌫️</span>
        Névoa
      </label>

      {ligada ? (
        <>
          <Separador />

          {/* ── O que o pincel faz ────────────────────────────────── */}
          <div role="radiogroup" aria-label="O que o pincel de névoa faz" style={{ display: "flex", gap: SP.x1 }}>
            {[
              { id: "revelar", rotulo: "Revelar", icone: "◌", dica: "O pincel abre a névoa por onde passa." },
              { id: "cobrir", rotulo: "Cobrir", icone: "●", dica: "O pincel fecha a névoa de volta." },
            ].map((opcao) => {
              const ativo = modo === opcao.id;
              return (
                <button
                  key={opcao.id}
                  type="button"
                  role="radio"
                  className="wme-ferramenta"
                  aria-checked={ativo}
                  title={opcao.dica}
                  disabled={somenteLeitura}
                  onClick={() => onModo && onModo(opcao.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: SP.x2,
                    minHeight: HIT.mobile, padding: `0 ${SP.x3}px`, borderRadius: R.ctl,
                    cursor: somenteLeitura ? "not-allowed" : "pointer",
                    background: ativo ? "rgba(201,168,76,0.16)" : "transparent",
                    border: `1px solid ${ativo ? "var(--border2)" : "transparent"}`,
                    color: ativo ? "var(--gold2,var(--gold))" : "var(--muted2)",
                    ...T.btn, fontSize: FS.tag,
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>{opcao.icone}</span>
                  {opcao.rotulo}
                </button>
              );
            })}
          </div>

          {/* ── Tamanho do pincel ─────────────────────────────────── */}
          <label
            style={{
              display: "inline-flex", alignItems: "center", gap: SP.x2,
              minHeight: HIT.mobile, ...T.meta, fontSize: FS.micro,
            }}
          >
            Pincel
            <input
              className="wme-focus"
              type="range"
              min={RAIO_MINIMO}
              max={RAIO_MAXIMO}
              step={10}
              value={raioValido(raio)}
              disabled={somenteLeitura}
              aria-label="Tamanho do pincel de névoa"
              aria-valuetext={`raio de ${raioValido(raio)} unidades`}
              onChange={(e) => onRaio && onRaio(raioValido(e.target.value))}
              style={{ width: 118, accentColor: "var(--gold2,var(--gold))", cursor: "pointer" }}
            />
            <span style={{ ...T.data, minWidth: 34, textAlign: "right" }}>{raioValido(raio)}</span>
          </label>

          <Separador />

          {/* ── Atalhos brutos ────────────────────────────────────── */}
          <button
            type="button"
            className="wme-focus wme-ferramenta"
            onClick={onCobrirTudo}
            disabled={somenteLeitura}
            title="Fecha a névoa sobre o mapa inteiro — o estado com que a mesa começa."
            style={{ ...btnStyle("quiet", "sm"), minHeight: HIT.mobile }}
          >
            Cobrir tudo
          </button>
          <button
            type="button"
            className="wme-focus wme-ferramenta"
            onClick={onRevelarTudo}
            disabled={somenteLeitura}
            title="Abre a névoa sobre o mapa inteiro."
            style={{ ...btnStyle("quiet", "sm"), minHeight: HIT.mobile }}
          >
            Revelar tudo
          </button>
        </>
      ) : null}

      <div style={{ flex: 1, minWidth: SP.x2 }} />

      {/* ── Estado da névoa ───────────────────────────────────────── */}
      {ligada ? (
        <span style={{ ...T.data, fontSize: FS.micro }} data-testid="wm-nevoa-estado">
          {percentual(fracao)} revelado · {pesoLegivel(bytes)}
          {gravando ? " · gravando…" : pendente ? " · alterações não gravadas" : ""}
        </span>
      ) : null}

      {/* ── Visão do Mestre / Visão do Jogador ────────────────────── */}
      <button
        type="button"
        className="wme-focus wme-ferramenta"
        aria-pressed={previsaoDeJogador}
        aria-label={previsaoDeJogador
          ? "Voltar para a Visão do Mestre"
          : "Ver o mapa como o jogador vê"}
        title={previsaoDeJogador
          ? "Você está vendo como o jogador. Clique para voltar à Visão do Mestre."
          : "Mostra o mapa como o jogador vê, sem tirar nenhuma ferramenta de você."}
        onClick={() => onPrevisao && onPrevisao(!previsaoDeJogador)}
        style={{
          display: "inline-flex", alignItems: "center", gap: SP.x2,
          minHeight: HIT.mobile, padding: `0 ${SP.x3}px`, borderRadius: R.ctl, cursor: "pointer",
          background: previsaoDeJogador ? "rgba(138,122,214,0.20)" : "transparent",
          border: `1px solid ${previsaoDeJogador ? COR_DA_VISAO_DE_JOGADOR : LINE.raise}`,
          color: previsaoDeJogador ? "#c9befb" : "var(--muted2)",
          ...T.btn, fontSize: FS.tag, fontWeight: FW.bold,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{previsaoDeJogador ? "👁" : "🎭"}</span>
        {previsaoDeJogador ? "Visão do jogador" : "Visão do mestre"}
      </button>
    </div>
  );
}
