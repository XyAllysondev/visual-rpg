/* ════════════════════════════════════════════════════════════════════
 *  A MESA — FILA DE EVENTOS DO MESTRE  (spec 0028 · F5 · AC-8)
 *  --------------------------------------------------------------------
 *  Design §2, S2: *"fila de eventos: o que disparou, o que está armado, o
 *  que ele segurou"*. Três gavetas, e a régua de qual é qual mora em
 *  `eventosUi.filaDoMestre` — pura, testada, sem tela junto.
 *
 *  ── ESTE PAINEL SÓ EXISTE PARA O MESTRE ─────────────────────────────
 *  Ele lê o MOLDE: `gmText`, gatilho, configuração, o que o evento revela.
 *  O componente não é montado no cliente do jogador — e não é uma questão
 *  de esconder com CSS: quem não é dono do molde não tem os dados, porque
 *  as rules negam a leitura (AC-1). Aqui o segredo não é escondido; ele
 *  simplesmente não chega.
 *
 *  ── POR QUE O TEXTO DO MESTRE FICA FECHADO ──────────────────────────
 *  Mesa presencial é tela compartilhada. O `gmText` abre num `<details>`
 *  fechado, com o aviso de que é só dele: um clique consciente é a
 *  diferença entre ler o segredo e projetá-lo na parede sem querer.
 * ════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { filaDoMestre } from "./eventosUi";
import { DANGER_TEXT_AA, FF, FS, FW, HIT, LINE, R, SP, T, btnStyle, campoStyle } from "../Atelier/ui";

/** A cor do que é só do mestre — a mesma da trilha secreta e do ateliê. */
export const COR_DO_MESTRE = "#a99bec";

const tituloDe = (evento) => (evento?.title || "").trim() || "Evento sem título";

function Gaveta({ titulo, dica, itens, children, vazio, testid }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: SP.x2, justifyContent: "space-between" }}>
        <div style={T.section}>{titulo}</div>
        <span style={{ ...T.data, fontSize: FS.tag }}>{itens.length}</span>
      </div>
      {dica ? <div style={{ ...T.meta, fontSize: FS.micro }}>{dica}</div> : null}
      {itens.length === 0 ? (
        <p style={{ ...T.meta, margin: 0 }} data-testid={testid ? `${testid}-vazio` : undefined}>{vazio}</p>
      ) : (
        <ul aria-label={titulo} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: SP.x2 }}>
          {itens.map(children)}
        </ul>
      )}
    </div>
  );
}

/**
 * Um cartão de evento na fila. `acoes` é o que muda entre as três gavetas.
 */
function CartaoDoEvento({ item, acoes, mostrarSegredo = true }) {
  const { evento, gatilho } = item;
  const revela = evento.reveals || {};
  const quantos = (revela.nodeIds?.length || 0) + (revela.edgeIds?.length || 0) + (revela.flags?.length || 0);

  return (
    <li
      data-testid={`wmm-evento-${evento.id}`}
      style={{
        padding: SP.x3, borderRadius: R.ctl,
        border: `1px solid ${LINE.hair}`, background: "rgba(255,255,255,0.03)",
        display: "flex", flexDirection: "column", gap: SP.x2,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: SP.x2, flexWrap: "wrap" }}>
        <span aria-hidden="true" style={{ color: "var(--gold2,var(--gold))" }}>✦</span>
        <span style={{ ...T.body, fontSize: FS.meta, fontWeight: FW.semi, flex: 1, minWidth: 0 }}>
          {tituloDe(evento)}
        </span>
        <span style={{ ...T.data, fontSize: FS.micro }}>
          {gatilho ? gatilho.label : "gatilho desconhecido"}
          {evento.isRepeatable ? " · repetível" : ""}
        </span>
      </div>

      {evento.playerText ? (
        <p style={{ ...T.meta, margin: 0 }}>{evento.playerText}</p>
      ) : (
        <p style={{ ...T.meta, margin: 0, fontStyle: "italic" }}>
          Sem texto do jogador — o grupo veria um cartão vazio.
        </p>
      )}

      {mostrarSegredo && evento.gmText ? (
        <details
          data-testid={`wmm-gmtext-${evento.id}`}
          style={{
            borderRadius: R.ctl, padding: `${SP.x1}px ${SP.x2}px`,
            border: `1px solid ${COR_DO_MESTRE}55`, background: "rgba(138,122,214,0.10)",
          }}
        >
          <summary
            className="wmm-focus"
            style={{
              cursor: "pointer", minHeight: HIT.desktop, display: "flex", alignItems: "center",
              ...T.btn, fontSize: FS.tag, color: COR_DO_MESTRE,
            }}
          >
            🔒 Só para você
          </summary>
          <p style={{ ...T.meta, margin: `${SP.x2}px 0 0`, color: "var(--text)" }}>{evento.gmText}</p>
        </details>
      ) : null}

      {quantos > 0 ? (
        <div style={{ ...T.data, fontSize: FS.micro }}>
          revela {revela.nodeIds?.length || 0} lugar(es), {revela.edgeIds?.length || 0} trilha(s)
          {revela.flags?.length ? `, ${revela.flags.length} marca(s)` : ""}
        </div>
      ) : null}

      {acoes ? (
        <div style={{ display: "flex", gap: SP.x2, flexWrap: "wrap", alignItems: "center" }}>{acoes}</div>
      ) : null}
    </li>
  );
}

/**
 * @param {object} props
 * @param {Array} props.eventos eventos do MOLDE (só o mestre os tem).
 * @param {string[]} props.disparados `gm.triggeredEventIds`.
 * @param {(evento:object)=>void} props.onDisparar solta o evento na mesa.
 * @param {(evento:object, bonus:number)=>void} [props.onResolverTeste] rola o
 *   teste de um evento `on_check` — a rolagem usa `src/domain/dice.js` lá em cima.
 * @param {(sceneId:string, evento:object)=>void} [props.onEntrarNaCena]
 * @param {boolean} [props.ocupado]
 * @param {boolean} [props.carregando]
 */
export default function FilaDeEventos({
  eventos = [],
  disparados = [],
  onDisparar,
  onResolverTeste,
  onEntrarNaCena,
  ocupado = false,
  carregando = false,
}) {
  const [bonus, setBonus] = useState(0);
  const fila = useMemo(() => filaDoMestre(eventos, disparados), [eventos, disparados]);

  const botaoDisparar = (evento) => (
    <button
      type="button"
      className="wmm-acao"
      data-testid={`wmm-disparar-${evento.id}`}
      disabled={ocupado}
      onClick={() => onDisparar && onDisparar(evento)}
      style={{ ...btnStyle("primary", "sm") }}
    >
      Soltar na mesa
    </button>
  );

  const botaoDaCena = (evento) => (
    onEntrarNaCena && evento.linkedSceneId ? (
      <button
        type="button"
        className="wmm-acao"
        data-testid={`wmm-cena-${evento.id}`}
        onClick={() => onEntrarNaCena(evento.linkedSceneId, evento)}
        style={{ ...btnStyle("quiet", "sm") }}
      >
        Entrar na cena
      </button>
    ) : null
  );

  return (
    <section
      className="wmm-painel"
      aria-label="Fila de eventos"
      data-testid="wmm-fila-de-eventos"
      style={{
        display: "flex", flexDirection: "column", gap: SP.x4,
        padding: SP.x4, background: "var(--card)",
        border: `1px solid ${LINE.edge}`, borderRadius: R.panel,
      }}
    >
      <div>
        <div style={{ fontFamily: FF.display, fontSize: FS.body, color: "var(--gold2,var(--gold))" }}>
          Eventos
        </div>
        <div style={{ ...T.meta }}>
          {carregando
            ? "carregando os eventos do molde…"
            : `${fila.total} no mapa · ${fila.disparados.length} já aconteceram`}
        </div>
      </div>

      {/* ══ 1 · O QUE JÁ DISPAROU ══════════════════════════════════ */}
      <Gaveta
        titulo="Já aconteceu"
        itens={fila.disparados}
        vazio="Nada disparou nesta mesa ainda."
        testid="wmm-disparados"
      >
        {(item) => (
          <CartaoDoEvento
            key={item.evento.id}
            item={item}
            acoes={
              <>
                <span style={{ ...T.data, fontSize: FS.micro }}>{item.motivo}</span>
                {botaoDaCena(item.evento)}
                {item.evento.isRepeatable ? botaoDisparar(item.evento) : null}
              </>
            }
          />
        )}
      </Gaveta>

      {/* ══ 2 · O QUE ESTÁ ARMADO ══════════════════════════════════ */}
      <Gaveta
        titulo="Armado"
        dica="Sai sozinho quando o grupo cumprir o gatilho. Você pode antecipar."
        itens={fila.armados}
        vazio="Nenhum evento armado neste mapa."
        testid="wmm-armados"
      >
        {(item) => (
          <CartaoDoEvento
            key={item.evento.id}
            item={item}
            acoes={<>{botaoDisparar(item.evento)}{botaoDaCena(item.evento)}</>}
          />
        )}
      </Gaveta>

      {/* ══ 3 · O QUE VOCÊ SEGUROU ═════════════════════════════════ */}
      <Gaveta
        titulo="Na sua mão"
        dica="Não acontece sozinho: espera você soltar, ou um teste passar."
        itens={fila.naMao}
        vazio="Nada esperando na sua mão."
        testid="wmm-namao"
      >
        {(item) => (
          <CartaoDoEvento
            key={item.evento.id}
            item={item}
            acoes={
              <>
                {botaoDisparar(item.evento)}
                {item.evento.trigger === "on_check" && onResolverTeste ? (
                  <button
                    type="button"
                    className="wmm-acao"
                    data-testid={`wmm-teste-${item.evento.id}`}
                    disabled={ocupado}
                    onClick={() => onResolverTeste(item.evento, bonus)}
                    title={`Rola 1d20 + bônus contra a CD ${item.evento.triggerConfig?.check?.dc ?? "—"}`}
                    style={{ ...btnStyle("quiet", "sm") }}
                  >
                    Rolar {item.evento.triggerConfig?.check?.skill || "o teste"}
                    {Number.isFinite(item.evento.triggerConfig?.check?.dc)
                      ? ` (CD ${item.evento.triggerConfig.check.dc})`
                      : ""}
                  </button>
                ) : null}
                {botaoDaCena(item.evento)}
              </>
            }
          />
        )}
      </Gaveta>

      {/* O bônus é do MESTRE e vale para as rolagens desta tela — a ficha do
          personagem não chega aqui, e inventar um modificador seria pior do
          que deixá-lo explícito. */}
      {onResolverTeste ? (
        <label
          className="wmm-focus"
          style={{ display: "inline-flex", alignItems: "center", gap: SP.x2, ...T.meta }}
        >
          Bônus nas rolagens
          <input
            type="number"
            value={bonus}
            step="1"
            onChange={(e) => setBonus(Number(e.target.value) || 0)}
            aria-label="Bônus somado às rolagens de teste desta mesa"
            data-testid="wmm-bonus-do-teste"
            style={{ ...campoStyle(false), width: 84, minHeight: HIT.desktop, fontSize: FS.body }}
          />
        </label>
      ) : null}

      {fila.total === 0 && !carregando ? (
        <p style={{ ...T.meta, margin: 0, color: DANGER_TEXT_AA }}>
          Este mapa não tem evento nenhum. Ancore os seus na aba Mapas, com a ferramenta de evento.
        </p>
      ) : null}
    </section>
  );
}
