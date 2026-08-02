/* ════════════════════════════════════════════════════════════════════
 *  O CONSOLE DO MESTRE  (spec 0028 · F4 · AC-8 · design §2, S2)
 *  --------------------------------------------------------------------
 *  *"o mestre decide o que liberar para eles de extra que está oculto, que
 *  nem é no jogo pathfinder"* — pedido do Andre, e é este arquivo.
 *
 *  ── POR QUE A GAVETA DO OCULTO É UMA LISTA, E NÃO UM MENU ───────────
 *  Para decidir o que dar, o mestre precisa ENXERGAR o que tem. Uma lista
 *  com tudo que o grupo ainda não viu — nome, estado atual e o selo de
 *  segredo — é o inventário da generosidade dele. Um menu escondido faria
 *  o mestre esquecer que a masmorra existe, e a mecânica morre por
 *  esquecimento, não por falta de botão.
 *
 *  ── A ESCADA DA REVELAÇÃO ───────────────────────────────────────────
 *  Revelar não é ligar/desligar: o mestre escolhe ATÉ ONDE acende.
 *   · rumor      — "ouve-se falar de alguma coisa ali" (sem nome, sem ícone)
 *   · descoberto — o lugar existe no mapa, com nome
 *   · visitado   — como se o grupo já tivesse estado lá
 *  Trilha só tem um degrau útil aqui: revelada. `revelarManualmente`
 *  aplica `max`, então pedir menos do que já existe não rebaixa nada — e
 *  isso é o AC-6, não um detalhe desta tela.
 *
 *  ── VISÃO DO MESTRE / VISÃO DO JOGADOR ──────────────────────────────
 *  Mesmo contrato da F3 (`Editor/ControlesDaNevoa.jsx`): dois estados que
 *  se juntam só no render, moldura colorida no palco, e **espiar não tira
 *  ferramenta nenhuma**. Quem desliga ferramenta é o papel real, nunca a
 *  visão.
 * ════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { formatarHoras } from "../Editor/editorUi";
import { COR_DA_VISAO_DE_JOGADOR } from "../Editor/ControlesDaNevoa";
import {
  NOME_DO_ESTADO_DA_TRILHA, NOME_DO_ESTADO_DO_NO, formatarRelogio,
  formatarSuprimentos, nomeNaMesa,
} from "./mesaUi";
import { DANGER_TEXT_AA, FF, FS, FW, HIT, LINE, R, SP, T, btnStyle, campoStyle } from "../Atelier/ui";

/** Os degraus que o "Revelar agora" oferece para um lugar. */
export const DEGRAUS_DO_NO = [
  { valor: "rumored", label: "Rumor", dica: "O grupo ouve falar de algo ali. Sem nome, sem ícone." },
  { valor: "discovered", label: "Descoberto", dica: "O lugar entra no mapa, com nome." },
  { valor: "visited", label: "Visitado", dica: "Como se o grupo já tivesse estado lá." },
];

/* `SP.x3` entre os filhos, não `SP.x2`: cinco seções × três filhos são ~60 px
   de respiro que antes não cabiam — e agora cabem, porque a coluna rola. */
const Secao = ({ titulo, children, acao }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: SP.x3 }}>
    <div style={{ display: "flex", alignItems: "center", gap: SP.x2, justifyContent: "space-between" }}>
      <div style={T.section}>{titulo}</div>
      {acao}
    </div>
    {children}
  </div>
);

/**
 * @param {object} props
 * @param {object|null} props.noAtual onde o grupo está (nó do molde).
 * @param {Array} props.destinos saída de `destinosPossiveis`.
 * @param {(destino:object)=>void} props.onViajar
 * @param {{nos:Array,trilhas:Array,total:number,ocultos:number}} props.estoque
 *   saída de `estoqueOculto` — o que ainda dá para liberar.
 * @param {(pedido:{nos:string[],trilhas:string[],ateEstado:object,abrirNevoa:boolean})=>void} props.onRevelar
 * @param {(noId:string)=>void} props.onMoverPara move o grupo à força.
 * @param {boolean} props.espiando visão do jogador ligada.
 * @param {(v:boolean)=>void} props.onEspiar
 * @param {object|null} props.party
 * @param {(patch:object)=>void} props.onAjustarGrupo relógio e suprimentos.
 * @param {boolean} [props.ocupado]
 * @param {string} [props.falha]
 * @param {boolean} [props.pausada] a viagem está parada (F6).
 * @param {(v:boolean)=>void} [props.onPausar] pausa/retoma **à mão**.
 * @param {boolean} [props.temEncontro] há pendência esperando decisão.
 * @param {()=>void} [props.onAbrirEncontro] reabre o diálogo da decisão.
 */
export default function ConsoleDoMestre({
  noAtual = null,
  destinos = [],
  onViajar,
  estoque = { nos: [], trilhas: [], total: 0, ocultos: 0 },
  onRevelar,
  onMoverPara,
  espiando = false,
  onEspiar,
  party = null,
  onAjustarGrupo,
  ocupado = false,
  falha = "",
  pausada = false,
  onPausar,
  temEncontro = false,
  onAbrirEncontro,
}) {
  const [marcados, setMarcados] = useState(() => new Set());
  const [degrau, setDegrau] = useState("discovered");
  const [abrirNevoa, setAbrirNevoa] = useState(true);
  const [filtro, setFiltro] = useState("");

  const alternar = (chave) => {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave); else proximo.add(chave);
      return proximo;
    });
  };

  const itens = useMemo(() => {
    const busca = filtro.trim().toLocaleLowerCase("pt-BR");
    const casa = (i) => !busca || i.nome.toLocaleLowerCase("pt-BR").includes(busca);
    return [
      ...estoque.nos.filter(casa).map((i) => ({ ...i, chave: `no:${i.id}` })),
      ...estoque.trilhas.filter(casa).map((i) => ({ ...i, chave: `tr:${i.id}` })),
    ];
  }, [estoque, filtro]);

  const revelar = () => {
    const nos = [];
    const trilhas = [];
    marcados.forEach((chave) => {
      const [tipo, ...resto] = chave.split(":");
      const id = resto.join(":");
      if (tipo === "no") nos.push(id); else trilhas.push(id);
    });
    if (nos.length + trilhas.length === 0) return;
    if (onRevelar) {
      onRevelar({
        nos,
        trilhas,
        ateEstado: { no: degrau, trilha: "revealed" },
        abrirNevoa,
      });
    }
    setMarcados(new Set());
  };

  return (
    <section
      className="wmm-painel"
      aria-label="Console do mestre"
      style={{
        display: "flex", flexDirection: "column", gap: SP.x4,
        padding: SP.x4, background: "var(--card)",
        border: `1px solid ${espiando ? COR_DA_VISAO_DE_JOGADOR : LINE.edge}`,
        borderRadius: R.panel,
      }}
    >
      {/* ══ 1 · ONDE O GRUPO ESTÁ, E PARA ONDE PODE IR ══════════════ */}
      <Secao titulo="O grupo">
        <div style={{ ...T.body, fontWeight: FW.semi }}>{nomeNaMesa(noAtual)}</div>
        <div style={T.data}>
          {formatarRelogio(party?.inGameDatetime)} · {formatarSuprimentos(party?.supplies)}
        </div>

        {destinos.length === 0 ? (
          <p style={{ ...T.meta, margin: 0 }}>
            Nenhuma trilha sai daqui. Libere uma abaixo ou mova o grupo.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: SP.x2 }}>
            {destinos.map((d) => (
              <li key={d.noId}>
                <button
                  type="button"
                  className="wmm-acao"
                  data-testid={`wmm-mestre-destino-${d.noId}`}
                  disabled={ocupado || pausada}
                  onClick={() => onViajar && onViajar(d)}
                  aria-label={`Levar o grupo até ${nomeNaMesa(d.no)}, ${formatarHoras(d.horas)}`}
                  style={{
                    ...btnStyle("quiet", "sm"), textTransform: "none",
                    fontFamily: FF.ui, fontSize: FS.meta, letterSpacing: "normal",
                  }}
                >
                  {nomeNaMesa(d.no)} · {formatarHoras(d.horas)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {/* ══ 1.5 · A VIAGEM: PARAR E SEGUIR  (F6 · AC-8) ══════════════
          A pausa manual não é enfeite: é o que impede a EXISTÊNCIA da
          pausa de denunciar o encontro. Se ela só aparecesse quando o dado
          pedisse encontro, o grupo aprenderia a lê-la em duas sessões —
          e o segredo teria vazado pela forma, não pelo conteúdo. */}
      <Secao titulo="A viagem">
        <div style={{ display: "flex", gap: SP.x2, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="wmm-acao"
            data-testid="wmm-pausar-viagem"
            disabled={ocupado}
            aria-pressed={pausada}
            onClick={() => onPausar && onPausar(!pausada)}
            style={{ ...btnStyle(pausada ? "ghost" : "quiet", "sm"), minHeight: HIT.mobile }}
          >
            {pausada ? "Retomar a viagem" : "Parar a viagem"}
          </button>

          {temEncontro ? (
            <button
              type="button"
              className="wmm-acao"
              data-testid="wmm-reabrir-encontro"
              disabled={ocupado}
              onClick={() => onAbrirEncontro && onAbrirEncontro()}
              style={{ ...btnStyle("primary", "sm"), minHeight: HIT.mobile }}
            >
              Resolver o encontro
            </button>
          ) : null}
        </div>
        <p style={{ ...T.meta, margin: 0 }}>
          {pausada
            ? "O grupo vê que a viagem parou — e nada além disso."
            : "Trava os destinos. O grupo não vê o motivo."}
        </p>
      </Secao>

      {/* ══ 2 · REVELAR AGORA — a gaveta do oculto ══════════════════ */}
      <Secao
        titulo="Revelar agora"
        acao={
          <span style={{ ...T.data, fontSize: FS.tag }} data-testid="wmm-contagem-oculta">
            {estoque.ocultos} oculto{estoque.ocultos === 1 ? "" : "s"} · {estoque.total} disponíve{estoque.total === 1 ? "l" : "is"}
          </span>
        }
      >
        <p style={{ ...T.meta, margin: 0 }}>
          Marque o que revelar e escolha até onde acende.
        </p>

        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Procurar lugar ou trilha…"
          aria-label="Procurar no que ainda está oculto"
          className="wmm-focus"
          style={{ ...campoStyle(false), fontSize: FS.body }}
        />

        {itens.length === 0 ? (
          <p style={{ ...T.meta, margin: 0 }} data-testid="wmm-oculto-vazio">
            {estoque.total === 0
              ? "O grupo já viu tudo o que existe neste mapa."
              : "Nada com esse nome no que ainda está oculto."}
          </p>
        ) : (
          <ul
            aria-label="O que ainda está oculto"
            style={{
              /* Eram 236 px de janela para 1260 px de itens — dentro de um
                 scroll de 774 px, que por sua vez rolava o mapa. Três níveis
                 de rolagem para marcar uma caixinha. A coluna já rola sozinha
                 agora (`.wmm-coluna`), então esta janela pode ser gente. */
              listStyle: "none", margin: 0, padding: 0, maxHeight: 420, overflowY: "auto",
              border: `1px solid ${LINE.hair}`, borderRadius: R.ctl,
            }}
          >
            {itens.map((item) => (
              <li key={item.chave} style={{ borderBottom: `1px solid ${LINE.hair}` }}>
                <label
                  className="wmm-focus"
                  style={{
                    display: "flex", alignItems: "center", gap: SP.x3,
                    minHeight: HIT.mobile, padding: `0 ${SP.x3}px`, cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={marcados.has(item.chave)}
                    onChange={() => alternar(item.chave)}
                    aria-label={`${item.tipo === "no" ? "Lugar" : "Trilha"} ${item.nome}, ${item.tipo === "no" ? NOME_DO_ESTADO_DO_NO[item.estado] : NOME_DO_ESTADO_DA_TRILHA[item.estado]}${item.secreto ? ", segredo" : ""}`}
                    style={{ width: 18, height: 18, accentColor: "var(--gold2,var(--gold))", flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block", ...T.body, fontSize: FS.meta,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}
                    >
                      {item.tipo === "no" ? "◆" : "⤳"} {item.nome}
                    </span>
                    <span style={{ ...T.data, fontSize: FS.micro }}>
                      {item.tipo === "no"
                        ? NOME_DO_ESTADO_DO_NO[item.estado]
                        : `${NOME_DO_ESTADO_DA_TRILHA[item.estado]}${Number.isFinite(item.horas) ? ` · ${formatarHoras(item.horas)}` : ""}`}
                      {item.secreto ? " · segredo" : ""}
                    </span>
                  </span>
                  {item.tipo === "no" ? (
                    <button
                      type="button"
                      className="wmm-acao"
                      disabled={ocupado}
                      onClick={(e) => { e.preventDefault(); if (onMoverPara) onMoverPara(item.id); }}
                      aria-label={`Mover o grupo para ${item.nome}`}
                      title="Mover o grupo para cá"
                      style={{ ...btnStyle("quiet", "sm"), minWidth: HIT.desktop, flexShrink: 0 }}
                    >
                      ➤
                    </button>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        )}

        {/* Até onde acende */}
        <fieldset
          style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: SP.x2,
            border: "none", margin: 0, padding: 0,
          }}
        >
          <legend style={{ ...T.section, fontSize: FS.micro, padding: 0 }}>Acender até</legend>
          {DEGRAUS_DO_NO.map((d) => (
            <label
              key={d.valor}
              className="wmm-focus"
              title={d.dica}
              style={{
                display: "inline-flex", alignItems: "center", gap: SP.x1,
                minHeight: HIT.desktop, padding: `0 ${SP.x2}px`, cursor: "pointer",
                borderRadius: R.pill,
                border: `1px solid ${degrau === d.valor ? "var(--border2)" : LINE.raise}`,
                color: degrau === d.valor ? "var(--gold2,var(--gold))" : "var(--muted2)",
                ...T.btn, fontSize: FS.tag,
              }}
            >
              <input
                type="radio"
                name="wmm-degrau"
                checked={degrau === d.valor}
                onChange={() => setDegrau(d.valor)}
                style={{ width: 14, height: 14, accentColor: "var(--gold2,var(--gold))" }}
              />
              {d.label}
            </label>
          ))}
        </fieldset>

        <label
          className="wmm-focus"
          style={{ display: "inline-flex", alignItems: "center", gap: SP.x2, minHeight: HIT.desktop, cursor: "pointer", ...T.meta }}
        >
          <input
            type="checkbox"
            checked={abrirNevoa}
            onChange={(e) => setAbrirNevoa(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--gold2,var(--gold))" }}
          />
          Abrir a névoa em volta dos lugares liberados
        </label>

        <button
          type="button"
          className="wmm-acao"
          data-testid="wmm-revelar-agora"
          disabled={ocupado || marcados.size === 0}
          onClick={revelar}
          style={{ ...btnStyle("primary"), width: "100%" }}
        >
          Revelar agora{marcados.size > 0 ? ` (${marcados.size})` : ""}
        </button>
      </Secao>

      {/* ══ 3 · O RITMO DA MESA — relógio e comida ══════════════════ */}
      <Secao titulo="Relógio e suprimentos">
        <div style={{ display: "flex", flexWrap: "wrap", gap: SP.x2, alignItems: "center" }}>
          {[-1, 1, 8].map((h) => (
            <button
              key={h}
              type="button"
              className="wmm-acao"
              disabled={ocupado}
              onClick={() => onAjustarGrupo && onAjustarGrupo({ horas: h })}
              aria-label={h < 0 ? `Voltar ${Math.abs(h)} hora` : `Avançar ${h} hora${h === 1 ? "" : "s"}`}
              style={{ ...btnStyle("quiet", "sm") }}
            >
              {h > 0 ? `+${h} h` : `${h} h`}
            </button>
          ))}
          <label
            className="wmm-focus"
            style={{ display: "inline-flex", alignItems: "center", gap: SP.x2, ...T.meta }}
          >
            Rações
            <input
              type="number"
              min="0"
              step="1"
              value={Number.isFinite(party?.supplies) ? party.supplies : ""}
              placeholder="—"
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                if (onAjustarGrupo) onAjustarGrupo({ supplies: v });
              }}
              aria-label="Rações do grupo"
              style={{ ...campoStyle(false), width: 92, minHeight: HIT.desktop, fontSize: FS.body }}
            />
          </label>
        </div>
      </Secao>

      {/* ══ 4 · VISÃO DO MESTRE / VISÃO DO JOGADOR ══════════════════ */}
      <Secao titulo="Visão">
        <label
          className="wmm-focus"
          style={{
            display: "inline-flex", alignItems: "center", gap: SP.x2,
            minHeight: HIT.mobile, padding: `0 ${SP.x2}px`, cursor: "pointer",
            borderRadius: R.ctl,
            border: `1px solid ${espiando ? COR_DA_VISAO_DE_JOGADOR : LINE.raise}`,
            ...T.btn, fontSize: FS.tag,
            color: espiando ? COR_DA_VISAO_DE_JOGADOR : "var(--muted2)",
          }}
        >
          <input
            type="checkbox"
            data-testid="wmm-visao-do-jogador"
            checked={espiando}
            onChange={(e) => onEspiar && onEspiar(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: COR_DA_VISAO_DE_JOGADOR, cursor: "inherit" }}
          />
          Ver como o jogador vê
        </label>
        <p style={{ ...T.meta, margin: 0 }}>
          {espiando
            ? "Visão do jogador: o mapa está sendo mostrado como o grupo o vê. Suas ferramentas continuam aqui."
            : "Visão do mestre: você está vendo o mapa inteiro, inclusive o que ainda está oculto."}
        </p>
      </Secao>

      {falha ? (
        <p
          role="alert"
          data-testid="wmm-falha-do-mestre"
          style={{ margin: 0, ...T.meta, color: DANGER_TEXT_AA }}
        >
          {falha}
        </p>
      ) : null}
    </section>
  );
}
