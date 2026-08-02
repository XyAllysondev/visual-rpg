/* ════════════════════════════════════════════════════════════════════
 *  EDITOR DO GRAFO — PAINEL DO EVENTO  (spec 0028 · F5 · AC-1, AC-8)
 *  --------------------------------------------------------------------
 *  Briefing §8: *"ancorar evento em nó, trilha ou ponto livre; escolher o
 *  gatilho entre os seis; escrever texto do jogador e texto do mestre;
 *  marcar o que o evento revela"*.
 *
 *  ── AS DUAS COLUNAS DE TEXTO SÃO O CORAÇÃO DESTE PAINEL ─────────────
 *  Um evento tem duas caras, e confundi-las é o erro que queima a cena:
 *   · **texto do jogador** — o que a mesa lê quando o evento sai. Vai para
 *     `campaigns/.../revealed/`, e chega ao cliente do grupo.
 *   · **texto do mestre** — o que só ele lê. NUNCA sai do ateliê: nem no
 *     disparo, nem na projeção, nem por acidente de refactor (a lista
 *     branca de `projecaoDoEvento` decide o que sai, e `gmText` não está
 *     nela).
 *  Por isso o campo do mestre é violeta e diz, com todas as letras, que o
 *  grupo não o lê. É a mesma cor que a trilha secreta usa no palco: no
 *  Nexus, violeta é a cor do que é só do mestre.
 *
 *  ── VALIDAR É AVISAR, NÃO BARRAR ────────────────────────────────────
 *  `validarEvento` (model/eventos.js) devolve os problemas em português e
 *  eles aparecem aqui, antes de salvar. Nenhum deles impede a gravação —
 *  mesma postura de `validarGrafo`: evento pela metade é trabalho em
 *  andamento, e o mestre é quem decide quando ele está pronto.
 * ════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import {
  GATILHOS, GATILHO_PADRAO, RAIO_DE_PROXIMIDADE_PADRAO,
  criarEvento, getGatilho, validarEvento,
} from "../model/eventos";
import { nomeDaTrilha, ondeOEventoEsta } from "./editorUi";
import { AreaDeTexto, Bloco, Escolha, Interruptor, Numero, Texto } from "./Campos";
import { SP, R, FS, FW, T, HIT, LINE, btnStyle, DANGER_TEXT_AA } from "../Atelier/ui";

/** A cor do que é só do mestre — a mesma da trilha secreta. */
export const COR_DO_SEGREDO = "rgba(138,122,214,0.45)";

/** Os três jeitos de ancorar, com o nome que o mestre entende. */
export const ANCORAS = [
  { value: "node", label: "Num lugar" },
  { value: "edge", label: "Numa trilha" },
  { value: "point", label: "Num ponto do mapa" },
];

const texto = (v) => (typeof v === "string" ? v : "");
const nomeDoNo = (no) => (texto(no?.name).trim() || "Lugar sem nome");

/** Lista de marcas escrita numa linha ("porta-aberta, fugiu") vira array. */
export function marcasDaLinha(linha) {
  return texto(linha)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

/** Cópia editável do evento, com o `triggerConfig` desdobrado em campos rasos. */
function rascunhoDe(evento) {
  const e = criarEvento(evento);
  const tc = e.triggerConfig || {};
  const chance = Number.isFinite(tc.chance) ? tc.chance : 1;
  return {
    title: e.title,
    playerText: e.playerText,
    gmText: e.gmText,
    trigger: e.trigger || GATILHO_PADRAO,
    ancoraTipo: e.anchor?.type || "point",
    ancoraRef: e.anchor?.refId || "",
    ancoraX: Number.isFinite(e.anchor?.x) ? e.anchor.x : null,
    ancoraY: Number.isFinite(e.anchor?.y) ? e.anchor.y : null,
    raio: Number.isFinite(tc.radius) ? tc.radius : RAIO_DE_PROXIMIDADE_PADRAO,
    pericia: texto(tc.check?.skill),
    cd: Number.isFinite(tc.check?.dc) ? tc.check.dc : null,
    marca: texto(tc.flagKey),
    /* A chance é fração 0–1 no modelo; aqui ela é PORCENTAGEM, porque é assim
       que um mestre pensa ("30% de chance"), e 0,3 num campo numérico convida
       ao erro de digitar 30 e disparar sempre. */
    chancePorcento: Math.round(Math.max(0, Math.min(1, chance)) * 100),
    isRepeatable: !!e.isRepeatable,
    linkedSceneId: e.linkedSceneId || "",
    revelaNos: e.reveals.nodeIds,
    revelaTrilhas: e.reveals.edgeIds,
    revelaMarcas: e.reveals.flags.join(", "),
  };
}

/**
 * O patch normalizado que vai para o store — a forma do design §3.
 *
 * O `triggerConfig` só carrega o que o gatilho escolhido USA. Guardar raio num
 * evento de marca, ou CD num evento de chegada, deixaria dado morto que a mesa
 * teria de aprender a ignorar — e `validarEvento` acusaria um teste que não
 * existe. Cada gatilho grava a sua configuração e nada mais.
 *
 * @param {object} r rascunho do painel.
 * @returns {object} evento normalizado por `criarEvento`.
 */
export function patchDoEvento(r) {
  const config = (() => {
    switch (r.trigger) {
      case "on_proximity":
        return { radius: Number.isFinite(r.raio) && r.raio > 0 ? r.raio : RAIO_DE_PROXIMIDADE_PADRAO };
      case "on_check": {
        const skill = (r.pericia || "").trim();
        return skill && Number.isFinite(r.cd) ? { check: { skill, dc: r.cd } } : null;
      }
      case "flag": {
        const flagKey = (r.marca || "").trim();
        return flagKey ? { flagKey } : null;
      }
      case "on_travel": {
        const pct = Number.isFinite(r.chancePorcento) ? r.chancePorcento : 100;
        return { chance: Math.max(0, Math.min(100, pct)) / 100 };
      }
      default:
        return null;
    }
  })();

  const anchor = r.ancoraTipo === "point"
    ? { type: "point", x: r.ancoraX, y: r.ancoraY }
    : { type: r.ancoraTipo, refId: r.ancoraRef };

  return criarEvento({
    anchor,
    title: r.title,
    playerText: r.playerText,
    gmText: r.gmText,
    trigger: r.trigger,
    triggerConfig: config,
    isRepeatable: r.isRepeatable,
    linkedSceneId: r.linkedSceneId || null,
    reveals: {
      nodeIds: r.revelaNos,
      edgeIds: r.revelaTrilhas,
      flags: marcasDaLinha(r.revelaMarcas),
    },
  });
}

/** Lista de marcação para escolher o que o evento revela. */
function ListaDeRevelacao({ id, titulo, itens, marcados, aoAlternar, vazio }) {
  if (itens.length === 0) {
    return <div style={{ ...T.meta, fontSize: FS.micro }}>{vazio}</div>;
  }
  return (
    <ul
      aria-label={titulo}
      style={{
        listStyle: "none", margin: 0, padding: 0, maxHeight: 168, overflowY: "auto",
        border: `1px solid ${LINE.hair}`, borderRadius: R.ctl,
      }}
    >
      {itens.map((item) => (
        <li key={item.id} style={{ borderBottom: `1px solid ${LINE.hair}` }}>
          <label
            className="wme-focus"
            style={{
              display: "flex", alignItems: "center", gap: SP.x3,
              minHeight: HIT.mobile, padding: `0 ${SP.x3}px`, cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              id={`${id}-${item.id}`}
              checked={marcados.includes(item.id)}
              onChange={() => aoAlternar(item.id)}
              style={{ width: 18, height: 18, accentColor: "var(--gold)", flexShrink: 0 }}
            />
            <span style={{
              flex: 1, minWidth: 0, ...T.body, fontSize: FS.meta,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {item.rotulo}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/**
 * @param {object} props
 * @param {object} props.evento evento do molde (documento de `events/`).
 * @param {Array} props.nos nós do molde, para ancorar e revelar.
 * @param {Array} props.trilhas trilhas do molde, idem.
 * @param {Array<{id:string,name:string}>} [props.cenas] cenas táticas do mestre.
 * @param {boolean} [props.somenteLeitura]
 * @param {(patch:object)=>Promise<any>} props.onSalvar
 * @param {()=>void} props.onRemover
 * @param {()=>void} props.onFechar
 */
export default function PainelDoEvento({
  evento,
  nos = [],
  trilhas = [],
  cenas = [],
  somenteLeitura = false,
  onSalvar,
  onRemover,
  onFechar,
}) {
  const [rascunho, setRascunho] = useState(() => rascunhoDe(evento));
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState("");

  useEffect(() => {
    setRascunho(rascunhoDe(evento));
    setFalha("");
  }, [evento?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const trocar = (campo) => (valor) => setRascunho((r) => ({ ...r, [campo]: valor }));

  const alternarNaLista = (campo) => (id) => setRascunho((r) => {
    const atual = r[campo];
    return {
      ...r,
      [campo]: atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    };
  });

  const grafo = useMemo(() => ({ nos, trilhas }), [nos, trilhas]);
  const gatilho = getGatilho(rascunho.trigger) || getGatilho(GATILHO_PADRAO);

  /* Os problemas são recalculados sobre o RASCUNHO, não sobre o documento
     salvo: avisar depois de gravar seria avisar tarde demais. */
  const problemas = useMemo(
    () => validarEvento({ ...patchDoEvento(rascunho), id: evento?.id || "rascunho" }, grafo),
    [rascunho, grafo, evento?.id],
  );

  const salvar = async () => {
    if (!onSalvar) return;
    setFalha("");
    setSalvando(true);
    try {
      await onSalvar(patchDoEvento(rascunho));
    } catch (err) {
      setFalha(err?.message || "Não foi possível salvar este evento.");
    } finally {
      setSalvando(false);
    }
  };

  const idBase = `wme-evento-${evento?.id || "novo"}`;
  const semTitulo = !rascunho.title.trim();

  return (
    <aside
      className="wme-painel"
      aria-label={`Editar evento: ${rascunho.title.trim() || "sem título"}`}
      data-testid="wme-painel-do-evento"
      style={{ display: "flex", flexDirection: "column", gap: SP.x4 }}
    >
      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: SP.x3 }}>
        <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>✦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...T.section, fontSize: 10 }}>Evento</div>
          <div style={{ ...T.cardTitle, fontSize: FS.body, lineHeight: 1.4 }}>
            {rascunho.title.trim() || "Evento sem título"}
          </div>
        </div>
        <button type="button" className="wme-focus" onClick={onFechar}
          aria-label="Fechar o painel do evento" style={{ ...btnStyle("quiet", "sm") }}>
          ✕
        </button>
      </div>

      <div style={{ ...T.data }} data-testid="wme-evento-resumo">
        {gatilho.label} · {ondeOEventoEsta({ anchor: patchDoEvento(rascunho).anchor }, grafo)}
        {rascunho.isRepeatable ? " · repetível" : ""}
      </div>

      {/* ── Onde ──────────────────────────────────────────────────── */}
      <Bloco titulo="Onde acontece">
        <Escolha
          id={`${idBase}-ancora`}
          label="Âncora"
          dica="O evento pega carona na geometria do mapa: fica em cima de um lugar, no meio de uma trilha, ou num ponto solto."
          valor={rascunho.ancoraTipo}
          aoMudar={trocar("ancoraTipo")}
          opcoes={ANCORAS}
        />

        {rascunho.ancoraTipo === "node" ? (
          <Escolha
            id={`${idBase}-ancora-no`}
            label="Em qual lugar"
            valor={rascunho.ancoraRef}
            aoMudar={trocar("ancoraRef")}
            opcoes={[{ value: "", label: "— escolha um lugar —" },
              ...nos.map((n) => ({ value: n.id, label: nomeDoNo(n) }))]}
          />
        ) : null}

        {rascunho.ancoraTipo === "edge" ? (
          <Escolha
            id={`${idBase}-ancora-trilha`}
            label="Em qual trilha"
            valor={rascunho.ancoraRef}
            aoMudar={trocar("ancoraRef")}
            opcoes={[{ value: "", label: "— escolha uma trilha —" },
              ...trilhas.map((t) => ({ value: t.id, label: nomeDaTrilha(t, nos) }))]}
          />
        ) : null}

        {rascunho.ancoraTipo === "point" ? (
          <div style={{ display: "flex", gap: SP.x3, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 120px" }}>
              <Numero id={`${idBase}-x`} label="X no mapa" valor={rascunho.ancoraX}
                aoMudar={trocar("ancoraX")} min={-100000} max={100000} />
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <Numero id={`${idBase}-y`} label="Y no mapa" valor={rascunho.ancoraY}
                aoMudar={trocar("ancoraY")} min={-100000} max={100000} />
            </div>
          </div>
        ) : null}
      </Bloco>

      {/* ── Gatilho ───────────────────────────────────────────────── */}
      <Bloco titulo="Quando dispara">
        <Escolha
          id={`${idBase}-gatilho`}
          label="Gatilho"
          dica={gatilho.hint}
          valor={rascunho.trigger}
          aoMudar={trocar("trigger")}
          opcoes={GATILHOS.map((g) => ({ value: g.id, label: g.label }))}
        />

        {rascunho.trigger === "on_proximity" ? (
          <Numero
            id={`${idBase}-raio`}
            label="Raio"
            dica="A que distância da âncora o grupo já sente o evento, em unidades do mapa."
            valor={rascunho.raio}
            aoMudar={trocar("raio")}
            min={1}
            max={4000}
            sufixo="unidades"
          />
        ) : null}

        {rascunho.trigger === "on_check" ? (
          <div style={{ display: "flex", gap: SP.x3, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px", minWidth: 0 }}>
              <Texto id={`${idBase}-pericia`} label="Perícia do teste" valor={rascunho.pericia}
                aoMudar={trocar("pericia")} placeholder="Investigação" maxLength={40} />
            </div>
            <div style={{ flex: "0 1 120px" }}>
              <Numero id={`${idBase}-cd`} label="CD" valor={rascunho.cd}
                aoMudar={trocar("cd")} min={1} max={60} />
            </div>
            <div style={{ flexBasis: "100%", ...T.meta, fontSize: FS.micro }}>
              Este evento não sai sozinho: você resolve o teste na mesa e ele dispara só se passar.
            </div>
          </div>
        ) : null}

        {rascunho.trigger === "flag" ? (
          <Texto
            id={`${idBase}-marca`}
            label="Marca do grupo"
            dica="O evento fica armado até esta marca estar ativa no grupo. Outro evento pode acendê-la em “O que revela”."
            valor={rascunho.marca}
            aoMudar={trocar("marca")}
            placeholder="porta-aberta"
            maxLength={40}
          />
        ) : null}

        {rascunho.trigger === "on_travel" ? (
          <Numero
            id={`${idBase}-chance`}
            label="Chance"
            dica="100% é evento roteirizado: acontece sempre que o grupo percorre a trilha. Menos que isso é sorteado na hora da viagem."
            valor={rascunho.chancePorcento}
            aoMudar={trocar("chancePorcento")}
            min={0}
            max={100}
            sufixo="%"
          />
        ) : null}

        <Interruptor
          id={`${idBase}-repetivel`}
          label="Pode acontecer de novo"
          dica="Desligado, o evento dispara uma vez só nesta mesa e nunca mais."
          marcado={rascunho.isRepeatable}
          aoMudar={trocar("isRepeatable")}
        />
      </Bloco>

      {/* ── Os dois textos ────────────────────────────────────────── */}
      <Bloco titulo="O que se lê">
        <Texto
          id={`${idBase}-titulo`}
          label="Título"
          dica="Aparece para o grupo quando o evento sai."
          valor={rascunho.title}
          aoMudar={trocar("title")}
          placeholder="O carroção tombado"
          maxLength={80}
        />

        <AreaDeTexto
          id={`${idBase}-jogador`}
          label="Texto do jogador"
          dica="É isto — e só isto — que chega ao cliente do grupo quando o evento dispara."
          valor={rascunho.playerText}
          aoMudar={trocar("playerText")}
          placeholder="Na curva da estrada, um carroção tombado. Nenhum cavalo à vista."
          linhas={4}
        />

        <AreaDeTexto
          id={`${idBase}-mestre`}
          label="🔒 Texto do mestre"
          dica="Nunca sai daqui. Não é copiado na revelação, não existe no documento que o jogador lê."
          valor={rascunho.gmText}
          aoMudar={trocar("gmText")}
          placeholder="Debaixo da lona, três golens de carne esperando alguém chegar perto."
          linhas={4}
          perigoso
        />

        {cenas.length > 0 ? (
          <Escolha
            id={`${idBase}-cena`}
            label="Cena tática vinculada"
            dica="Quando o evento dispara, você ganha um atalho para levar a mesa direto para esta cena."
            valor={rascunho.linkedSceneId}
            aoMudar={trocar("linkedSceneId")}
            opcoes={[{ value: "", label: "— nenhuma —" },
              ...cenas.map((c) => ({ value: c.id, label: c.name || "Cena sem nome" }))]}
          />
        ) : null}
      </Bloco>

      {/* ── O que revela ──────────────────────────────────────────── */}
      <Bloco titulo="O que revela">
        <div style={{ ...T.meta, fontSize: FS.micro }}>
          Ao disparar, o evento acende isto para o grupo. Revelação nunca regride: marcar um lugar
          que o grupo já visitou não o rebaixa.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SP.x1 }}>
          <div style={{ ...T.section, fontSize: 10 }}>Lugares</div>
          <ListaDeRevelacao
            id={`${idBase}-revela-no`}
            titulo="Lugares que o evento revela"
            itens={nos.map((n) => ({ id: n.id, rotulo: nomeDoNo(n) }))}
            marcados={rascunho.revelaNos}
            aoAlternar={alternarNaLista("revelaNos")}
            vazio="Este mapa ainda não tem lugares."
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SP.x1 }}>
          <div style={{ ...T.section, fontSize: 10 }}>Trilhas</div>
          <ListaDeRevelacao
            id={`${idBase}-revela-trilha`}
            titulo="Trilhas que o evento revela"
            itens={trilhas.map((t) => ({
              id: t.id,
              rotulo: `${t.isSecret ? "🔒 " : ""}${nomeDaTrilha(t, nos)}`,
            }))}
            marcados={rascunho.revelaTrilhas}
            aoAlternar={alternarNaLista("revelaTrilhas")}
            vazio="Este mapa ainda não tem trilhas."
          />
        </div>

        <Texto
          id={`${idBase}-revela-marcas`}
          label="Marcas que acende"
          dica="Separe por vírgula. Elas ficam no grupo e podem armar outros eventos (gatilho “por marca do grupo”)."
          valor={rascunho.revelaMarcas}
          aoMudar={trocar("revelaMarcas")}
          placeholder="porta-aberta, o-conde-sabe"
          maxLength={200}
        />
      </Bloco>

      {/* ── Problemas (diagnóstico, não bloqueio) ─────────────────── */}
      {problemas.length > 0 || semTitulo ? (
        <div
          role="status"
          data-testid="wme-evento-problemas"
          style={{
            padding: SP.x3, borderRadius: R.card,
            background: "rgba(201,168,76,0.08)", border: "1px solid var(--border2)",
          }}
        >
          <div style={{ ...T.section, fontSize: 10, marginBottom: SP.x1 }}>Antes da mesa</div>
          <ul style={{ margin: 0, paddingLeft: SP.x4, ...T.meta, color: "var(--text)" }}>
            {semTitulo ? <li>O evento ainda não tem título — o grupo veria um cartão sem nome.</li> : null}
            {problemas.map((p, i) => (
              <li key={`${p.tipo}-${i}`}>{p.mensagem}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {falha ? (
        <div role="alert" style={{
          padding: SP.x3, borderRadius: R.card, ...T.meta, color: "var(--text)",
          background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
        }}>
          <strong style={{ color: DANGER_TEXT_AA }}>Não salvou. </strong>{falha}
        </div>
      ) : null}

      {/* ── Ações ─────────────────────────────────────────────────── */}
      {!somenteLeitura ? (
        <div style={{ display: "flex", gap: SP.x2, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="wme-focus" onClick={salvar} disabled={salvando}
            data-testid="wme-salvar-evento"
            style={{ ...btnStyle("primary", "sm"), opacity: salvando ? 0.5 : 1, fontWeight: FW.semi }}>
            {salvando ? "Salvando…" : "Salvar evento"}
          </button>
          <button type="button" className="wme-focus" onClick={onRemover}
            style={{ ...btnStyle("danger", "sm") }}>
            Apagar evento
          </button>
        </div>
      ) : null}
    </aside>
  );
}
