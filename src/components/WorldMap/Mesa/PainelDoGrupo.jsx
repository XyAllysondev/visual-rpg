/* ════════════════════════════════════════════════════════════════════
 *  O PAINEL DO GRUPO  (spec 0028 · F4 · AC-8 · design §2, S3)
 *  --------------------------------------------------------------------
 *  O que o JOGADOR tem, e só isso:
 *
 *    "o jogador vê a ilustração sob a névoa, os nós descobertos, as trilhas
 *     reveladas, o marcador do grupo, o relógio e os suprimentos.
 *     Participa: clica num nó adjacente para viajar."
 *
 *  O que ele NÃO tem (design §2, S3 + spec 0007 AC-2): painel de cenas,
 *  painel de camadas, ferramenta de autoria. Este arquivo é o inventário
 *  fechado da participação do jogador — se algo de autoria aparecer aqui, é
 *  regressão de contrato, não funcionalidade nova.
 *
 *  Os destinos são a MESMA lista que acende os nós no palco
 *  (`destinosPossiveis`), em texto: quem joga no celular, com o mapa
 *  afastado, precisa de uma lista tocável de 44px, não de alvos de 12px.
 * ════════════════════════════════════════════════════════════════════ */

import { formatarHoras } from "../Editor/editorUi";
import {
  formatarRelogio, formatarSuprimentos, nomeNaMesa, periodoDoDia,
} from "./mesaUi";
import { FF, FS, FW, HIT, LINE, R, SP, T, btnStyle } from "../Atelier/ui";

const Dado = ({ rotulo, valor, dica }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ ...T.section, fontSize: FS.micro }}>{rotulo}</div>
    <div
      style={{
        fontFamily: FF.data, fontSize: FS.body, fontWeight: FW.semi,
        color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}
      title={dica || undefined}
    >
      {valor}
    </div>
  </div>
);

/**
 * @param {object} props
 * @param {object|null} props.party documento do grupo.
 * @param {object|null} props.noAtual o nó onde o grupo está (já projetado).
 * @param {Array} props.destinos saída de `destinosPossiveis`.
 * @param {(destino:object)=>void} props.onViajar
 * @param {boolean} [props.viajando]
 * @param {boolean} [props.podeMover] o papel de quem olha pode mover o grupo.
 * @param {string} [props.aviso] a recusa mais recente, em PT-BR.
 */
export default function PainelDoGrupo({
  party = null,
  noAtual = null,
  destinos = [],
  onViajar,
  viajando = false,
  podeMover = true,
  aviso = "",
}) {
  const relogio = party?.inGameDatetime;
  const suprimentos = party?.supplies;

  return (
    <section
      className="wmm-painel"
      aria-label="O grupo"
      style={{
        display: "flex", flexDirection: "column", gap: SP.x3,
        padding: SP.x4, background: "var(--card)",
        border: `1px solid ${LINE.edge}`, borderRadius: R.panel,
      }}
    >
      {/* ── Onde, quando, com o quê ─────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.x3 }}>
        <Dado rotulo="O grupo está em" valor={nomeNaMesa(noAtual)} />
        <Dado rotulo="Relógio" valor={formatarRelogio(relogio)} />
        <Dado rotulo="Período" valor={periodoDoDia(relogio)} />
        <Dado
          rotulo="Suprimentos"
          valor={formatarSuprimentos(suprimentos)}
          dica={Number.isFinite(suprimentos) ? "Cai a cada dia de viagem." : "A mesa não está contando comida."}
        />
      </div>

      {/* ── Para onde dá para ir (AC-8) ─────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
        <div style={T.section}>Daqui dá para ir</div>

        {destinos.length === 0 ? (
          <p style={{ ...T.meta, margin: 0 }}>
            Nenhum caminho conhecido sai daqui. Investiguem o lugar, ou esperem o mestre abrir a trilha.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: SP.x2 }}>
            {destinos.map((d) => (
              <li key={d.noId}>
                <button
                  type="button"
                  className="wmm-acao"
                  data-testid={`wmm-destino-${d.noId}`}
                  disabled={viajando || !podeMover}
                  onClick={() => onViajar && onViajar(d)}
                  aria-label={`Viajar para ${nomeNaMesa(d.no)}, ${formatarHoras(d.horas)}`}
                  style={{
                    ...btnStyle("ghost"),
                    width: "100%", justifyContent: "space-between",
                    minHeight: HIT.mobile, textTransform: "none",
                    fontFamily: FF.ui, fontSize: FS.body, letterSpacing: "normal",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {nomeNaMesa(d.no)}
                  </span>
                  <span style={{ ...T.data, flexShrink: 0 }}>{formatarHoras(d.horas)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!podeMover ? (
          <p style={{ ...T.meta, margin: 0 }}>
            Só o mestre move o grupo nesta mesa.
          </p>
        ) : null}
      </div>

      {/* ── A recusa, palavra por palavra (AC-8/AC-9) ────────────────── */}
      {aviso ? (
        <p
          data-testid="wmm-aviso-do-grupo"
          style={{
            margin: 0, padding: SP.x2, borderRadius: R.ctl,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${LINE.raise}`, ...T.meta, color: "var(--text)",
          }}
        >
          {aviso}
        </p>
      ) : null}
    </section>
  );
}
