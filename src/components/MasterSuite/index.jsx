/* ════════════════════════════════════════════════════════════════════
 *  FORJA DO MESTRE — CASCA DA SUÍTE  (spec 0027 · AC-2, AC-8, AC-9)
 *  --------------------------------------------------------------------
 *  Header (sigilo + seletor de mundo + ação primária), rail horizontal de
 *  ferramentas com a pílula deslizante da spec 0022, roteamento interno
 *  por `React.lazy` e o estado vazio de "nenhum mundo ainda".
 *
 *  Encaixe no shell do app: `screen==="master"` já entrega
 *  `main{overflowY:hidden; padding:0}` e um wrapper `flex:1; minHeight:0`
 *  (App.jsx). Portanto a Forja é uma coluna flex que ocupa tudo, com
 *  header e rail fixos e UM único container rolável — o viewport da
 *  ferramenta. Nada aqui rola a página.
 *
 *  Ferramentas das fases 2–8 continuam visíveis e não navegam — mas o
 *  "Em breve" virou ESTADO do próprio item (opacidade + `aria-disabled` +
 *  nome acessível), não um selo ao lado. Sete selos gastavam ≈420px de
 *  largura repetindo a mesma palavra e empurravam Genealogia e Mesa para
 *  fora da tela num rail que rolava sem avisar.
 *
 *  A suíte NÃO reapresenta o próprio nome: a topbar do app já imprime
 *  "Ajudante do Mestre". "Forja do Mestre" é o codinome interno da spec
 *  0027 e vive em comentário e spec, nunca na tela.
 * ════════════════════════════════════════════════════════════════════ */

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSlidingPill } from "../../hooks/useSlidingPill";
import SlidingTabPill from "../SlidingTabPill";
import { useWorlds, useActiveWorld, useEntities, useConnections, createWorld, seedDemoWorld } from "./worldsStore";
import { codigoDeErro, mensagemDeErro } from "./model/erros";
import ForjaStyles from "./ui/ForjaStyles";
import { Ico, ToolIcon } from "./ui/entityIcons";
import { Btn, EmptyState, SkeletonBlock, useIsMobile } from "./ui/primitives";
import { SP, R, FF, FS, FW, LS, LINE, SURF, HIT, ELEV, T, W } from "./ui/tokens";
import WorldModal from "./WorldModal";

const Dashboard = lazy(() => import("./Dashboard"));
const Wiki = lazy(() => import("./Wiki"));

/* As 9 ferramentas da suíte. `ready` marca o que a Fase 1 entrega. */
export const TOOLS = [
  { id: "painel", label: "Painel", ready: true },
  { id: "wiki", label: "Wiki", ready: true },
  { id: "grafo", label: "Grafo" },
  { id: "diario", label: "Diário" },
  { id: "cronos", label: "Cronos" },
  { id: "calendario", label: "Calendário" },
  { id: "ideias", label: "Ideias" },
  { id: "genealogia", label: "Genealogia" },
  { id: "mesa", label: "Mesa" },
];

/* ── Erro (causa + saída, nunca só "deu erro") ───────────────────────── */
function ErroBox({ titulo, detalhe, onRetry, onFechar }) {
  return (
    <div role="alert" style={{
      display: "flex", alignItems: "flex-start", gap: SP.x3, padding: SP.x4,
      background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
      borderRadius: R.panel,
    }}>
      <span style={{ color: "var(--danger-text)", flexShrink: 0, display: "flex" }}>
        <Ico name="warn" size={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...T.section, color: "var(--danger-text)", marginBottom: SP.x1 }}>{titulo}</div>
        <div style={{ ...T.meta, overflowWrap: "anywhere" }}>{detalhe}</div>
      </div>
      {onRetry ? <Btn kind="ghost" size="sm" onClick={onRetry}>Tentar de novo</Btn> : null}
      {onFechar ? (
        <Btn kind="quiet" size="sm" onClick={onFechar} aria-label="Dispensar o aviso de erro">
          Dispensar
        </Btn>
      ) : null}
    </div>
  );
}

/* Protege a casca de um erro dentro de uma ferramenta (inclusive falha de
 * carregamento do chunk lazy) — a Forja não pode derrubar o app inteiro. */
class ToolBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.erro) this.setState({ erro: null });
  }

  componentDidCatch(erro) {
    /* Mensagem de SDK/bundler fala inglês e fala com o programador: fica no
     * console, para depuração. A tela recebe frase curta em PT + uma saída. */
    if (typeof console !== "undefined") console.warn("[Forja] ferramenta quebrou:", erro);
  }

  render() {
    if (this.state.erro) {
      return (
        <ErroBox
          titulo="Esta ferramenta não abriu"
          detalhe="Falha inesperada dentro da ferramenta."
          onRetry={() => this.setState({ erro: null })}
        />
      );
    }
    return this.props.children;
  }
}

/* Falha de LEITURA do acervo tem duas causas que valem 95% dos casos, e para
 * elas a frase longa de `model/erros` (causa + saída, pensada para escrita)
 * vira parágrafo dentro do bloco de maior peso cromático da tela. Aqui basta
 * a causa em uma linha — a saída é o botão "Tentar de novo" ao lado. Qualquer
 * outro código continua caindo na tradução completa; texto cru do SDK, nunca. */
const ACERVO_CURTO = {
  "permission-denied": "Sem permissão de leitura neste mundo.",
  unavailable: "A conexão caiu no meio do caminho.",
  "network-request-failed": "A conexão caiu no meio do caminho.",
};

function detalheDoAcervo(erro) {
  return ACERVO_CURTO[codigoDeErro(erro)] || mensagemDeErro(erro);
}

/* ── Seletor de mundo ────────────────────────────────────────────────── */
function WorldSwitcher({ worlds, activeId, onSelect, onCreate, isMobile }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const btnRef = useRef(null);
  const world = worlds.find((w) => w.id === activeId) || null;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      if (btnRef.current) btnRef.current.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const escolher = (id) => {
    setOpen(false);
    if (id !== activeId) onSelect(id);
    if (btnRef.current) btnRef.current.focus();
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <button
        type="button" ref={btnRef} className="forja-focus"
        aria-haspopup="true" aria-expanded={open}
        aria-label={world ? `Mundo ativo: ${world.name}. Trocar de mundo` : "Escolher mundo"}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: SP.x2,
          minHeight: isMobile ? HIT.mobile : HIT.desktop,
          /* O botão se dimensiona pelo conteúdo; `maxWidth` é só o teto.
           * No mobile o seletor divide a MESMA faixa com o rail: 132px deixa
           * ~190px para o rail (Painel + Wiki visíveis sem arrastar). O nome
           * completo do mundo aparece na banda do painel, logo abaixo.
           * No desktop o seletor tem uma faixa só dele, então o teto sobe para
           * 320px: com 240 um nome de tamanho comum já raspava a reticência. */
          maxWidth: isMobile ? 132 : 320,
          padding: `0 ${SP.x2}px`,
          background: "var(--gold-dim)", border: "1px solid var(--border2)", borderRadius: R.ctl,
          cursor: "pointer", color: "var(--accent2)",
          fontFamily: FF.title, fontSize: FS.label, fontWeight: FW.semi, letterSpacing: LS.nav,
          transition: "background .18s ease, border-color .18s ease", touchAction: "manipulation",
        }}
      >
        <span style={{ display: "flex", flexShrink: 0 }}><Ico name="world" size={15} /></span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {world ? world.name : "Nenhum mundo"}
        </span>
        <span aria-hidden="true" style={{
          display: "flex", marginLeft: "auto",
          transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease",
        }}>
          <Ico name="chevronDown" size={13} />
        </span>
      </button>

      {open ? (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60,
          minWidth: 260, maxWidth: "min(320px, 86vw)", maxHeight: 340, overflowY: "auto",
          background: SURF.raised, border: "1px solid var(--border2)",
          borderRadius: R.card, boxShadow: ELEV.e2, padding: SP.x1,
        }}>
          {worlds.map((w) => {
            const on = w.id === activeId;
            return (
              <button
                key={w.id} type="button" onClick={() => escolher(w.id)}
                className="forja-menu-item forja-focus"
                aria-current={on ? "true" : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: SP.x3, width: "100%",
                  minHeight: 48, padding: `0 ${SP.x3}px`, textAlign: "left", cursor: "pointer",
                  background: on ? "var(--gold-dim)" : "transparent",
                  /* `borderLeft` muda com a seleção: as outras três somem por
                   * propriedade longa, nunca pelo atalho `border` (misturar os
                   * dois no mesmo objeto faz o React reclamar no rerender). */
                  borderTop: "none", borderRight: "none", borderBottom: "none",
                  borderLeft: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                  borderRadius: R.input, color: "var(--text)",
                }}
              >
                <span style={{ color: on ? "var(--accent)" : "var(--muted)", display: "flex", flexShrink: 0 }}>
                  <Ico name="world" size={14} />
                </span>
                {/* Só o nome. O gênero tinha `flexShrink:0` e o nome não, então
                  * "Coroa de Cinzas" truncava em "Coroa d…" para caber
                  * "Fantasia sombria brasileira" ao lado — o único dado que
                  * importa aqui era o único que encolhia. O gênero já aparece
                  * na banda do painel e não ajuda a escolher um mundo. */}
                <span style={{
                  flex: 1, minWidth: 0, fontFamily: FF.ui, fontSize: FS.body, fontWeight: FW.semi,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {w.name}
                </span>
              </button>
            );
          })}
          <div style={{ height: 1, background: LINE.hair, margin: `${SP.x1}px 0` }} />
          <button
            type="button" onClick={() => { setOpen(false); onCreate(); }}
            className="forja-menu-item forja-focus"
            style={{
              display: "flex", alignItems: "center", gap: SP.x2, width: "100%",
              minHeight: HIT.mobile, padding: `0 ${SP.x3}px`, cursor: "pointer",
              background: "transparent", border: "none", borderRadius: R.input,
              color: "var(--accent)", ...T.btn, justifyContent: "flex-start",
            }}
          >
            <Ico name="plus" size={14} />
            Novo mundo
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ── Estado vazio: nenhum mundo (AC-2) ───────────────────────────────── */
function ForjaFria({ onCriar, onDemo, criando }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <EmptyState
        icon={<Ico name="forge" size={112} strokeWidth={1} />}
        tone="var(--accent)"
        title="A forja está fria"
        description="Nenhum mundo ainda."
        actions={
          <>
            <Btn
              kind="primary" size="lg" icon="spark" className="nx-shimmer"
              onClick={onCriar} loading={criando === "mundo"} disabled={!!criando}
            >
              Criar meu primeiro mundo
            </Btn>
            <Btn kind="ghost" size="lg" icon="world" onClick={onDemo} loading={criando === "demo"} disabled={!!criando}>
              Criar mundo demo
            </Btn>
          </>
        }
      />

      <div style={{ display: "flex", alignItems: "center", gap: SP.x3, marginBottom: SP.x4 }}>
        <span aria-hidden="true" style={{ flex: 1, height: 1, background: LINE.hair }} />
        <span style={{ ...T.section, fontSize: FS.tag }}>Ferramentas</span>
        <span aria-hidden="true" style={{ flex: 1, height: 1, background: LINE.hair }} />
      </div>

      {/* Inventário decorativo: nada aqui é clicável, então nada aqui ganha
        * fundo de card nem borda dourada — não pode competir com os 2 CTAs. */}
      <ul className="forja-grid-tools" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {TOOLS.map((t) => (
          <li key={t.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: SP.x2,
            padding: `${SP.x3}px ${SP.x2}px`, borderRadius: R.panel,
            background: "transparent", border: `1px solid ${LINE.hair}`,
            color: "var(--muted)", opacity: 0.34,
          }}>
            <ToolIcon name={t.id} size={22} />
            <span style={{ ...T.typeTag, textAlign: "center" }}>{t.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── A suíte ─────────────────────────────────────────────────────────── */

/**
 * Raiz da Forja do Mestre.
 *
 * `system` (o sistema de RPG ativo) chega do App.jsx e fica reservado para as
 * ferramentas que forem integrar com o conteúdo do sistema (ex.: puxar uma
 * criatura do bestiário OP). O visual não depende dele: o tema já chega por
 * CSS vars, então a casca renderiza igual em op/dnd/tormenta.
 *
 * @param {{system?:object, uid?:string}} props
 */
export default function MasterSuite({ uid }) {
  const isMobile = useIsMobile();
  const [tool, setTool] = useState("painel");
  const [modalMundo, setModalMundo] = useState(false);
  const [criando, setCriando] = useState(null);   // 'mundo' | 'demo' | null
  /* `{titulo, detalhe}` — mostrado ONDE O MESTRE ESTIVER, não só no estado vazio. */
  const [erroCriar, setErroCriar] = useState(null);
  /* Contexto entregue à Wiki quando a navegação vem de fora dela. */
  const [wikiFoco, setWikiFoco] = useState({ type: "", entityId: "", createType: "", createSignal: 0 });

  const { worlds, loading: worldsLoading, error: worldsError } = useWorlds(uid);
  const { activeWorldId, setActiveWorldId } = useActiveWorld(uid);

  /* Sem seleção válida (primeiro acesso, mundo apagado): assume o mais recente
   * QUE O SERVIDOR JÁ CONHECE.
   *
   * O snapshot do `onSnapshot` chega antes da confirmação da escrita (latency
   * compensation), e a regra de leitura das subcoleções faz `get()` no documento
   * do mundo — que ainda não existe lá. Auto-selecionar um mundo pendente abria
   * o acervo com `permission-denied` e pintava um banner de erro logo depois de
   * criar o mundo demo. Seleção EXPLÍCITA (`criarMundo`/`criarDemo`) continua
   * valendo: o id vem de um `addDoc` já confirmado pelo servidor. */
  useEffect(() => {
    if (!worlds.length) return;
    if (activeWorldId && worlds.some((w) => w.id === activeWorldId)) return;
    const confirmado = worlds.find((w) => !w.pendenteNoServidor);
    if (confirmado) setActiveWorldId(confirmado.id);
  }, [worlds, activeWorldId, setActiveWorldId]);

  const world = useMemo(
    () => worlds.find((w) => w.id === activeWorldId) || null,
    [worlds, activeWorldId],
  );
  const worldId = world ? world.id : null;

  const { entities, loading: entLoading, error: entError } = useEntities(worldId);
  const { connections, error: connError } = useConnections(worldId);

  const { containerRef, setItemRef, pill } = useSlidingPill(tool, `${isMobile}|${worldId || ""}`);

  const irPara = useCallback((id) => {
    const alvo = TOOLS.find((t) => t.id === id);
    if (!alvo || !alvo.ready) return;
    setTool(id);
  }, []);

  const abrirTipo = useCallback((typeId) => {
    setWikiFoco((f) => ({ ...f, type: typeId, entityId: "" }));
    setTool("wiki");
  }, []);

  const abrirEntidade = useCallback((entidade) => {
    setWikiFoco((f) => ({ ...f, type: "", entityId: entidade?.id || "" }));
    setTool("wiki");
  }, []);

  const novaEntidade = useCallback((typeId) => {
    setWikiFoco((f) => ({ ...f, createType: typeId || "", createSignal: f.createSignal + 1 }));
    setTool("wiki");
  }, []);

  /* Teclado do rail: setas movem e ativam, Home/End vão às pontas. */
  const onRailKeyDown = (e) => {
    const teclas = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!teclas.includes(e.key)) return;
    const box = containerRef.current;
    if (!box) return;
    const abas = Array.from(box.querySelectorAll('[role="tab"]'));
    if (!abas.length) return;
    const atual = abas.indexOf(document.activeElement);
    const base = atual === -1 ? abas.findIndex((el) => el.getAttribute("aria-selected") === "true") : atual;
    let alvo = base;
    if (e.key === "ArrowRight") alvo = (base + 1) % abas.length;
    else if (e.key === "ArrowLeft") alvo = (base - 1 + abas.length) % abas.length;
    else if (e.key === "Home") alvo = 0;
    else alvo = abas.length - 1;
    e.preventDefault();
    const el = abas[alvo];
    el.focus();
    const id = el.getAttribute("data-tool");
    const ferramenta = TOOLS.find((t) => t.id === id);
    if (ferramenta && ferramenta.ready) setTool(id);
  };

  const criarMundo = async ({ name, description, genre }) => {
    setErroCriar(null);
    setCriando("mundo");
    try {
      const id = await createWorld(uid, { name, description, genre });
      setActiveWorldId(id);
      setTool("painel");
      setModalMundo(false);
    } finally {
      setCriando(null);
    }
  };

  const criarDemo = async () => {
    setErroCriar(null);
    setCriando("demo");
    try {
      const id = await seedDemoWorld(uid);
      setActiveWorldId(id);
      setTool("painel");
    } catch (err) {
      /* O documento do mundo nasce ANTES do conteúdo: quando o seed falha depois
       * disso, o mestre fica com um mundo pela metade e a tela troca sozinha para o
       * Painel (o estado vazio some) — era aí que a mensagem se perdia. Levar o
       * mestre para o mundo que sobrou e dizer o que aconteceu é mais honesto do que
       * deixá-lo achando que a criação nem começou. */
      if (err && err.worldId) {
        setActiveWorldId(err.worldId);
        setTool("painel");
        setErroCriar({
          titulo: "O mundo demo ficou pela metade",
          detalhe:
            `O mundo “Coroa de Cinzas” foi criado, mas o conteúdo dele não entrou. ${mensagemDeErro(err)} `
            + "Você está nele agora, vazio: crie as entidades à mão, ou exclua o mundo e tente o demo de novo.",
        });
      } else {
        setErroCriar({
          titulo: "Não foi possível forjar o mundo demo",
          detalhe: mensagemDeErro(err),
        });
      }
    } finally {
      setCriando(null);
    }
  };

  const semMundo = !worldsLoading && worlds.length === 0;

  /* Enquanto a criação do mundo não voltou do servidor, a regra da subcoleção
   * (que faz `get()` no documento do mundo) nega a leitura do acervo. Esse
   * `permission-denied` é a corrida da latency compensation, não uma falha do
   * mestre: some sozinho quando a confirmação chega e o listener é refeito.
   * Silenciá-lo APENAS enquanto o mundo está pendente é a regra mais simples que
   * continua correta — qualquer outro código, e o mesmo código num mundo já
   * confirmado, vira banner na hora. */
  const erroBruto = entError || connError;
  const erroDados = erroBruto
    && world && world.pendenteNoServidor
    && codigoDeErro(erroBruto) === "permission-denied"
    ? null
    : erroBruto;

  /* Texto cru do SDK fala inglês e fala com o programador: fica no console,
   * uma vez por erro (não a cada render). A tela recebe frase curta em PT. */
  useEffect(() => {
    if (erroDados) console.warn("[Forja] acervo não carregou:", erroDados);
  }, [erroDados]);

  /* ── Conteúdo do viewport ── */
  let viewport;
  if (!uid) {
    viewport = (
      <EmptyState
        icon={<Ico name="forge" size={96} strokeWidth={1} />}
        title="Entre para forjar"
        description="Faça login para abrir seus mundos."
      />
    );
  } else if (worldsError) {
    viewport = (
      <ErroBox
        titulo="Não foi possível carregar seus mundos"
        detalhe={mensagemDeErro(worldsError)}
      />
    );
  } else if (worldsLoading && !worlds.length) {
    viewport = <SkeletonBlock rows={5} label="Carregando seus mundos" />;
  } else if (semMundo) {
    viewport = (
      <ForjaFria
        onCriar={() => setModalMundo(true)}
        onDemo={criarDemo}
        criando={criando}
      />
    );
  } else {
    viewport = (
      <>
        {erroDados ? (
          <div style={{ marginBottom: SP.x6 }}>
            <ErroBox
              titulo="O acervo não carregou"
              detalhe={detalheDoAcervo(erroDados)}
              onRetry={() => window.location.reload()}
            />
          </div>
        ) : null}
        <ToolBoundary resetKey={`${tool}|${worldId}`}>
          <Suspense fallback={<SkeletonBlock rows={6} label="Abrindo a ferramenta" />}>
            {tool === "wiki" ? (
              <Wiki
                worldId={worldId}
                entities={entities}
                connections={connections}
                loading={entLoading}
                initialType={wikiFoco.type}
                initialEntityId={wikiFoco.entityId}
                createType={wikiFoco.createType}
                createSignal={wikiFoco.createSignal}
              />
            ) : (
              <Dashboard
                world={world}
                entities={entities}
                connections={connections}
                loading={entLoading}
                onOpenType={abrirTipo}
                onOpenEntity={abrirEntidade}
                onNavigate={irPara}
                onNewEntity={novaEntidade}
              />
            )}
          </Suspense>
        </ToolBoundary>
      </>
    );
  }

  /* O sigilo é a única marca da suíte na casca: o nome já está na topbar do
   * app, e o resumo do acervo já está na banda do painel. */
  const sigilo = (
    <span aria-hidden="true" style={{
      color: "var(--accent)", display: "flex", flexShrink: 0,
      filter: "drop-shadow(0 0 6px var(--gold-glow))",
    }}>
      <Ico name="forge" size={22} strokeWidth={1.5} />
    </span>
  );

  const seletor = worlds.length ? (
    <WorldSwitcher
      worlds={worlds}
      activeId={activeWorldId}
      onSelect={setActiveWorldId}
      onCreate={() => setModalMundo(true)}
      isMobile={isMobile}
    />
  ) : null;

  /* ── RAIL DE FERRAMENTAS ──────────────────────────────────────────────
   * A máscara de rolagem (`.forja-rail`, em ForjaStyles) desbota os últimos
   * 24px do ELEMENTO — inclusive o fundo dele. Por isso o fundo e a divisória
   * moram sempre no invólucro, e o <nav> é transparente: senão a faixa
   * apareceria com um talho degradê na ponta direita. */
  const rail = (
    <nav
      ref={containerRef}
      className="forja-rail"
      role="tablist"
      aria-label="Ferramentas da Forja"
      onKeyDown={onRailKeyDown}
      style={{ flex: 1, minWidth: 0, background: "transparent" }}
    >
      <SlidingTabPill
        pill={pill} radius={R.ctl}
        background="var(--gold-dim)" boxShadow="inset 0 0 0 1px var(--border2)"
      />
      {TOOLS.map((t) => {
        const on = tool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            ref={setItemRef(t.id)}
            data-tool={t.id}
            role="tab"
            id={`forja-tab-${t.id}`}
            aria-selected={on}
            aria-controls="forja-panel"
            aria-disabled={t.ready ? undefined : "true"}
            /* O "Em breve" vive no NOME ACESSÍVEL e no `title`, não num selo:
             * sete selos custavam ≈420px e faziam Genealogia e Mesa caírem
             * fora da tela. Leitor de tela e mouse continuam sabendo. */
            aria-label={t.ready ? undefined : `${t.label} — em breve`}
            title={t.ready ? undefined : "Em breve"}
            tabIndex={on ? 0 : -1}
            onClick={() => irPara(t.id)}
            className="forja-focus"
            style={{
              position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: SP.x2,
              minHeight: isMobile ? HIT.mobile : HIT.desktop, padding: `0 ${SP.x3}px`,
              background: "transparent", border: "none", borderRadius: R.ctl,
              cursor: t.ready ? "pointer" : "default",
              fontFamily: FF.title, fontSize: FS.label, fontWeight: on ? FW.semi : FW.body,
              letterSpacing: LS.nav, whiteSpace: "nowrap",
              color: on ? "var(--accent)" : "var(--muted2)",
              opacity: t.ready ? 1 : 0.42,
              transition: "color .18s ease, opacity .18s ease", touchAction: "manipulation",
            }}
          >
            <span aria-hidden="true" style={{
              display: "flex",
              filter: on ? "drop-shadow(0 0 5px var(--gold-glow))" : "none",
              transition: "filter .18s ease",
            }}>
              <ToolIcon name={t.id} size={17} />
            </span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div style={{
      display: "flex", flexDirection: "column", flex: 1, minHeight: 0,
      background: SURF.page, position: "relative",
    }}>
      <ForjaStyles />

      {/* ── CASCA: no mobile, header e rail são UMA faixa ──────────────
        * Topbar do app + header da Forja + rail eram três barras com o mesmo
        * fundo e a mesma divisória — 162px de cromo no desktop, 18% da tela
        * no mobile, e os dois primeiros títulos diziam a mesma coisa. */}
      {isMobile ? (
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: SP.x2,
          minHeight: 52, padding: `0 ${SP.x3}px`,
          background: SURF.rail, borderBottom: `1px solid ${LINE.edge}`,
        }}>
          {sigilo}
          {seletor}
          {seletor ? (
            <span aria-hidden="true" style={{
              width: 1, alignSelf: "stretch", margin: `${SP.x2}px 0`,
              background: LINE.edge, flexShrink: 0,
            }} />
          ) : null}
          {rail}
        </div>
      ) : (
        /* Desktop também vira UMA faixa (redesign de layout 2026-08-02). Eram duas empilhadas —
         * um header de 52px que carregava o sigilo sozinho na ponta esquerda
         * e o seletor+botão lá na direita, com um vão morto de ~900px no meio,
         * mais o rail de abas logo abaixo. Somadas à topbar do app davam três
         * barras de cromo antes de qualquer conteúdo, e o sigilo órfão lia
         * como sobra de layout. Agora é o mesmo arranjo do mobile: sigilo,
         * abas (que já rolam sozinhas via `.forja-rail`), e as ações à
         * direita depois de um filete. */
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: SP.x3,
          minHeight: 52, padding: `${SP.x1}px ${SP.x6}px`,
          background: SURF.rail, borderBottom: `1px solid ${LINE.edge}`,
        }}>
          {sigilo}
          {rail}
          <span aria-hidden="true" style={{
            width: 1, alignSelf: "stretch", margin: `${SP.x2}px 0`,
            background: LINE.edge, flexShrink: 0,
          }} />
          <div style={{ display: "flex", alignItems: "center", gap: SP.x2, minWidth: 0, flexShrink: 0 }}>
            {seletor}
            {world ? <Btn kind="primary" icon="plus" onClick={() => novaEntidade()}>Entidade</Btn> : null}
          </div>
        </div>
      )}

      {/* ── VIEWPORT DA FERRAMENTA (o único container rolável) ── */}
      <div
        id="forja-panel"
        role="tabpanel"
        aria-labelledby={`forja-tab-${tool}`}
        tabIndex={-1}
        key={tool}
        className="fade-screen"
        style={{
          flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
          /* o padding lateral daqui é o que a `.forja-band` come com margem
           * negativa (-24/-32 no desktop, -16/-12 no mobile) para virar
           * faixa de ponta a ponta — mexer aqui exige mexer lá. */
          padding: isMobile
            ? `${SP.x4}px ${SP.x3}px ${SP.x16}px`
            : `${SP.x6}px ${SP.x8}px ${SP.x10}px`,
        }}
      >
        <div style={{ maxWidth: W.viewport, margin: "0 auto" }}>
          {/* Falha de criação vive AQUI, fora dos ramos do viewport: criar um mundo
            * muda a tela (o estado vazio some), e o aviso não pode sumir junto. */}
          {erroCriar ? (
            <div style={{ marginBottom: SP.x6 }}>
              <ErroBox
                titulo={erroCriar.titulo}
                detalhe={erroCriar.detalhe}
                onFechar={() => setErroCriar(null)}
              />
            </div>
          ) : null}
          {viewport}
        </div>
      </div>

      {/* ── FAB mobile ── */}
      {isMobile && world ? (
        <button
          type="button"
          onClick={() => novaEntidade()}
          aria-label="Nova entidade"
          className="forja-focus"
          style={{
            position: "fixed", right: SP.x4,
            bottom: "calc(72px + env(safe-area-inset-bottom,0px) + 12px)", zIndex: 150,
            width: HIT.fab, height: HIT.fab, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "linear-gradient(135deg,var(--accent2),var(--accent))",
            color: "#0a0a0f", boxShadow: "0 8px 24px rgba(0,0,0,.5), 0 0 20px var(--gold-glow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform .18s cubic-bezier(.65,0,.35,1)", touchAction: "manipulation",
          }}
          onTouchStart={(e) => { e.currentTarget.style.transform = "scale(.94)"; }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          <Ico name="plus" size={24} strokeWidth={2} />
        </button>
      ) : null}

      {modalMundo ? (
        <WorldModal onClose={() => setModalMundo(false)} onCreate={criarMundo} />
      ) : null}
    </div>
  );
}
