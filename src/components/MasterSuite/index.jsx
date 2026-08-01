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
 *  Ferramentas das fases 2–8 aparecem com o selo "Em breve" e não
 *  navegam: a suíte inteira fica visível desde o primeiro dia, sem
 *  prometer tela que não existe.
 * ════════════════════════════════════════════════════════════════════ */

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSlidingPill } from "../../hooks/useSlidingPill";
import SlidingTabPill from "../SlidingTabPill";
import { useWorlds, useActiveWorld, useEntities, useConnections, createWorld, seedDemoWorld } from "./worldsStore";
import ForjaStyles from "./ui/ForjaStyles";
import { Ico, ToolIcon } from "./ui/entityIcons";
import { Btn, EmptyState, SkeletonBlock, SoonBadge, useIsMobile } from "./ui/primitives";
import { SP, R, FF, FS, FW, LS, SURF, HIT, ELEV, T, W } from "./ui/tokens";
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
function ErroBox({ titulo, detalhe, onRetry }) {
  return (
    <div role="alert" style={{
      display: "flex", alignItems: "flex-start", gap: SP.x3, padding: SP.x4,
      background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
      borderRadius: R.card,
    }}>
      <span style={{ color: "var(--danger-text)", flexShrink: 0, display: "flex" }}>
        <Ico name="warn" size={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...T.section, color: "var(--danger-text)", marginBottom: SP.x1 }}>{titulo}</div>
        <div style={{ ...T.meta, overflowWrap: "anywhere" }}>{detalhe}</div>
      </div>
      {onRetry ? <Btn kind="ghost" size="sm" onClick={onRetry}>Tentar de novo</Btn> : null}
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

  render() {
    if (this.state.erro) {
      return (
        <ErroBox
          titulo="Esta ferramenta não abriu"
          detalhe={`${this.state.erro.message || "Falha inesperada."} Trocar de ferramenta e voltar costuma resolver; se insistir, recarregue a página.`}
          onRetry={() => this.setState({ erro: null })}
        />
      );
    }
    return this.props.children;
  }
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
          minHeight: isMobile ? HIT.mobile : HIT.desktop, maxWidth: isMobile ? 190 : 240,
          padding: `0 ${SP.x3}px`,
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
                  border: "none", borderLeft: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                  borderRadius: R.input, color: "var(--text)",
                }}
              >
                <span style={{ color: on ? "var(--accent)" : "var(--muted)", display: "flex", flexShrink: 0 }}>
                  <Ico name="world" size={14} />
                </span>
                <span style={{
                  flex: 1, minWidth: 0, fontFamily: FF.ui, fontSize: FS.body, fontWeight: FW.semi,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {w.name}
                </span>
                {w.genre ? (
                  <span style={{ ...T.meta, fontSize: FS.micro, flexShrink: 0 }}>{w.genre}</span>
                ) : null}
              </button>
            );
          })}
          <div style={{ height: 1, background: SURF.hair, margin: `${SP.x1}px 0` }} />
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
function ForjaFria({ onCriar, onDemo, criando, erro }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <EmptyState
        icon={<Ico name="forge" size={112} strokeWidth={1} />}
        tone="var(--accent)"
        title="A forja está fria"
        description="Nenhum mundo forjado ainda. Todo cenário começa com um nome — e uma primeira entidade para povoá-lo."
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

      {erro ? (
        <div style={{ marginBottom: SP.x8 }}>
          <ErroBox titulo="Não foi possível forjar o mundo" detalhe={erro} />
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: SP.x3, marginBottom: SP.x4 }}>
        <span aria-hidden="true" style={{ flex: 1, height: 1, background: SURF.hair }} />
        <span style={{ ...T.section, fontSize: FS.tag }}>O que a forja guarda</span>
        <span aria-hidden="true" style={{ flex: 1, height: 1, background: SURF.hair }} />
      </div>

      <ul className="forja-grid-tools" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {TOOLS.map((t) => (
          <li key={t.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: SP.x2,
            padding: `${SP.x3}px ${SP.x2}px`, borderRadius: R.card,
            background: SURF.card, border: `1px solid ${SURF.hair}`,
            color: "var(--muted)", opacity: 0.45,
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
  const [erroCriar, setErroCriar] = useState("");
  /* Contexto entregue à Wiki quando a navegação vem de fora dela. */
  const [wikiFoco, setWikiFoco] = useState({ type: "", entityId: "", createType: "", createSignal: 0 });

  const { worlds, loading: worldsLoading, error: worldsError } = useWorlds(uid);
  const { activeWorldId, setActiveWorldId } = useActiveWorld(uid);

  /* Sem seleção válida (primeiro acesso, mundo apagado): assume o mais recente. */
  useEffect(() => {
    if (!worlds.length) return;
    if (activeWorldId && worlds.some((w) => w.id === activeWorldId)) return;
    setActiveWorldId(worlds[0].id);
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
    setErroCriar("");
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
    setErroCriar("");
    setCriando("demo");
    try {
      const id = await seedDemoWorld(uid);
      setActiveWorldId(id);
      setTool("painel");
    } catch (err) {
      setErroCriar(err?.message || "Não foi possível criar o mundo demo. Tente de novo em instantes.");
    } finally {
      setCriando(null);
    }
  };

  const semMundo = !worldsLoading && worlds.length === 0;
  const erroDados = entError || connError;

  /* ── Conteúdo do viewport ── */
  let viewport;
  if (!uid) {
    viewport = (
      <EmptyState
        icon={<Ico name="forge" size={96} strokeWidth={1} />}
        title="Entre para forjar"
        description="A Forja guarda os mundos na sua conta. Faça login para começar a construir."
      />
    );
  } else if (worldsError) {
    viewport = (
      <ErroBox
        titulo="Não foi possível carregar seus mundos"
        detalhe={`${worldsError.message || "A conexão caiu no meio do caminho."} Recarregue a página para tentar de novo.`}
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
        erro={erroCriar}
      />
    );
  } else {
    viewport = (
      <>
        {erroDados ? (
          <div style={{ marginBottom: SP.x6 }}>
            <ErroBox
              titulo="O acervo deste mundo não carregou por inteiro"
              detalhe={`${erroDados.message || "A conexão caiu no meio do caminho."} Recarregue a página para tentar de novo.`}
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

  const resumoHeader = world
    ? `${entities.length} ${entities.length === 1 ? "entidade" : "entidades"} · ${connections.length} ${connections.length === 1 ? "conexão" : "conexões"}`
    : "nenhum mundo";

  return (
    <div style={{
      display: "flex", flexDirection: "column", flex: 1, minHeight: 0,
      background: SURF.page, position: "relative",
    }}>
      <ForjaStyles />

      {/* ── HEADER ── */}
      <header style={{
        flexShrink: 0, minHeight: isMobile ? 52 : 60, display: "flex", alignItems: "center",
        gap: SP.x4, padding: isMobile ? `0 ${SP.x3}px` : `0 ${SP.x6}px`,
        background: SURF.rail, borderBottom: `1px solid ${SURF.hair}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: SP.x2, minWidth: 0 }}>
          <span aria-hidden="true" style={{
            color: "var(--accent)", display: "flex",
            filter: "drop-shadow(0 0 6px var(--gold-glow))",
          }}>
            <Ico name="forge" size={22} strokeWidth={1.5} />
          </span>
          {isMobile ? null : (
            <div style={{ minWidth: 0 }}>
              <h1 style={{
                ...T.hero, fontSize: 15, margin: 0,
                background: "linear-gradient(135deg,var(--accent),var(--accent2))",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
                FORJA DO MESTRE
              </h1>
              <div style={{
                ...T.meta, fontFamily: FF.title, fontSize: FS.micro,
                letterSpacing: LS.tag, textTransform: "uppercase",
              }}>
                {resumoHeader}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: SP.x2, minWidth: 0 }}>
          {worlds.length ? (
            <WorldSwitcher
              worlds={worlds}
              activeId={activeWorldId}
              onSelect={setActiveWorldId}
              onCreate={() => setModalMundo(true)}
              isMobile={isMobile}
            />
          ) : null}
          {!isMobile && world ? (
            <Btn kind="primary" icon="plus" onClick={() => novaEntidade()}>Entidade</Btn>
          ) : null}
        </div>
      </header>

      {/* ── RAIL DE FERRAMENTAS ── */}
      <nav
        ref={containerRef}
        className="forja-rail"
        role="tablist"
        aria-label="Ferramentas da Forja"
        onKeyDown={onRailKeyDown}
        style={{
          flexShrink: 0, padding: `${SP.x2}px ${isMobile ? SP.x3 : SP.x6}px`,
          background: SURF.rail, borderBottom: `1px solid ${SURF.hair}`,
        }}
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
                opacity: t.ready ? 1 : 0.55,
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
              {t.ready ? null : <SoonBadge />}
            </button>
          );
        })}
      </nav>

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
          padding: isMobile
            ? `${SP.x4}px ${SP.x3}px ${SP.x16}px`
            : `${SP.x6}px ${SP.x8}px ${SP.x12}px`,
        }}
      >
        <div style={{ maxWidth: W.viewport, margin: "0 auto" }}>{viewport}</div>
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
