/* ════════════════════════════════════════════════════════════════════
 *  FORJA DO MESTRE — PAINEL DO MUNDO  (spec 0027 · AC-6)
 *  --------------------------------------------------------------------
 *  Contagem por tipo (11 cards que levam à Wiki já filtrada), editados
 *  recentemente com filtro por tipo, checklist de primeiros passos vindo
 *  do estado REAL do mundo e atalhos.
 *
 *  Toda a agregação vem de `model/dashboardStats` — este arquivo só
 *  desenha. Nada de contagem improvisada aqui.
 * ════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { ENTITY_TYPES, getEntityType } from "../model/entityTypes";
import { worldStats, firstSteps } from "../model/dashboardStats";
import { EntityIcon, Ico, ToolIcon } from "../ui/entityIcons";
import {
  Btn, EmptyState, SectionTitle, Skeleton, SoonBadge, TypeBadge, useIsMobile,
} from "../ui/primitives";
import { SP, R, FF, FS, FW, LS, SURF, HIT, T, W, tint, tempoRelativo } from "../ui/tokens";

/* Passos que dependem de ferramentas das fases 2–8: informam, mas não navegam. */
const PASSO_EM_BREVE = { journal: "Fase 3", graph: "Fase 2" };

/* ── Painel-caixa reusado pelos dois blocos do meio ─────────────────── */
function Painel({ titulo, acao, children, labelId }) {
  return (
    <section
      aria-labelledby={labelId}
      style={{
        background: SURF.card, border: `1px solid ${SURF.hair}`,
        borderRadius: R.panel, overflow: "hidden",
      }}
    >
      <header style={{
        display: "flex", alignItems: "center", gap: SP.x3, minHeight: 44,
        padding: `0 ${SP.x4}px`, borderBottom: `1px solid ${SURF.hair}`,
      }}>
        <h3 id={labelId} style={{ ...T.section, margin: 0 }}>{titulo}</h3>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: SP.x2 }}>{acao}</span>
      </header>
      {children}
    </section>
  );
}

/* ── HERO do mundo ──────────────────────────────────────────────────── */
function Hero({ world, total, conexoes, tiposUsados, isMobile }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: R.panel,
      minHeight: isMobile ? 132 : 164, display: "flex", flexDirection: "column",
      justifyContent: "flex-end", padding: isMobile ? SP.x4 : SP.x5,
      background: "radial-gradient(ellipse at 30% 0%, var(--gold-dim), transparent 70%), var(--surface)",
      border: `1px solid ${SURF.hair}`, marginBottom: SP.x8,
    }}>
      <span aria-hidden="true" style={{
        position: "absolute", right: -12, top: -18, color: "var(--accent)", opacity: 0.06,
        display: "flex", pointerEvents: "none",
      }}>
        <Ico name="forge" size={176} strokeWidth={0.9} />
      </span>

      <div style={{
        display: "flex", alignItems: "flex-end", gap: SP.x6,
        flexDirection: isMobile ? "column" : "row", position: "relative",
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: SP.x2, marginBottom: SP.x2, color: "var(--accent)" }}>
            <Ico name="world" size={14} />
            <span style={{ ...T.section, color: "var(--accent)" }}>Mundo ativo</span>
          </div>
          <h2 style={{ ...T.hero, fontSize: isMobile ? 21 : FS.h1, margin: 0, overflowWrap: "anywhere" }}>
            {world?.name || "Sem nome"}
          </h2>
          {world?.genre ? (
            <div style={{ ...T.data, fontSize: FS.meta, marginTop: SP.x2 }}>{world.genre}</div>
          ) : null}
          {world?.description ? (
            <p style={{
              ...T.meta, margin: `${SP.x2}px 0 0`, maxWidth: 620,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {world.description}
            </p>
          ) : null}
        </div>

        <dl style={{
          display: "flex", gap: isMobile ? SP.x6 : SP.x8, margin: 0, flexShrink: 0,
          alignSelf: isMobile ? "flex-start" : "flex-end",
        }}>
          {[
            ["entidades", total],
            ["conexões", conexoes],
            ["tipos", tiposUsados],
          ].map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dd style={{ ...T.num, fontSize: 20, margin: 0 }}>{valor}</dd>
              <dt style={{
                fontFamily: FF.title, fontSize: FS.micro, letterSpacing: LS.tag,
                textTransform: "uppercase", color: "var(--muted)", marginTop: 2,
              }}>
                {rotulo}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/* ── Card contador de um tipo ───────────────────────────────────────── */
function ContadorTipo({ tipo, n, index, onClick }) {
  return (
    <button
      type="button"
      className="forja-card forja-num forja-focus"
      onClick={onClick}
      aria-label={`${n} ${n === 1 ? tipo.label : tipo.plural} — abrir na Wiki`}
      style={{
        "--forja-glow": tint(tipo.color, 0.26),
        "--forja-edge": tint(tipo.color, 0.5),
        "--i": Math.min(index, 11),
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SP.x2,
        padding: `${SP.x3}px ${SP.x4}px`, minHeight: 96, cursor: "pointer", textAlign: "left",
        background: SURF.card, border: `1px solid ${SURF.hair}`, borderRadius: R.card,
        opacity: n === 0 ? 0.55 : 1, transition: "opacity .2s ease",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <span style={{ color: tipo.color, display: "flex" }}><EntityIcon type={tipo.id} size={18} /></span>
        <span style={{ ...T.num, color: n === 0 ? "var(--muted)" : tipo.color }}>{n}</span>
      </span>
      <span style={{ ...T.typeTag, color: "var(--muted2)" }}>{tipo.label}</span>
    </button>
  );
}

/* ── Item do checklist ──────────────────────────────────────────────── */
function PassoItem({ passo, acao, ultimo }) {
  const emBreve = PASSO_EM_BREVE[passo.id];
  const clicavel = !passo.done && !!acao;

  const miolo = (
    <>
      <span aria-hidden="true" style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: passo.done ? "var(--accent)" : "transparent",
        border: passo.done ? "none" : "1.5px solid var(--border2)",
        color: "#14141c",
      }}>
        {passo.done ? <Ico name="check" size={11} strokeWidth={2.6} /> : null}
      </span>
      <span style={{
        fontFamily: FF.ui, fontSize: 13, lineHeight: 1.4, textAlign: "left", flex: 1, minWidth: 0,
        color: passo.done ? "var(--muted)" : "var(--text)",
        textDecoration: passo.done ? "line-through" : "none",
        opacity: passo.done ? 0.6 : 1,
      }}>
        {passo.label}
      </span>
      {!passo.done && emBreve ? <SoonBadge>{emBreve}</SoonBadge> : null}
      {clicavel ? (
        <span aria-hidden="true" className="forja-arrow" style={{ color: "var(--muted)", display: "flex", flexShrink: 0 }}>
          <Ico name="chevronRight" size={14} />
        </span>
      ) : null}
    </>
  );

  const estilo = {
    display: "flex", alignItems: "center", gap: SP.x3, width: "100%",
    minHeight: HIT.mobile, padding: `0 ${SP.x4}px`, textAlign: "left",
    borderBottom: ultimo ? "none" : `1px solid ${SURF.hair}`,
  };

  if (!clicavel) {
    return <li style={{ ...estilo, listStyle: "none" }}>{miolo}</li>;
  }
  return (
    <li style={{ listStyle: "none" }}>
      <button
        type="button" onClick={acao} className="forja-focus forja-row-item"
        style={{ ...estilo, background: "transparent", border: "none", borderBottom: estilo.borderBottom, cursor: "pointer" }}
      >
        {miolo}
      </button>
    </li>
  );
}

/* ── Card de atalho ─────────────────────────────────────────────────── */
function Atalho({ icone, rotulo, onClick, soon }) {
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      /* `aria-disabled` em vez de `disabled`: o atalho continua alcançável por
         teclado, então quem navega por Tab também descobre o "Em breve". */
      aria-disabled={soon ? "true" : undefined}
      className="forja-card forja-focus"
      style={{
        display: "flex", alignItems: "center", gap: SP.x3, minHeight: 72,
        padding: `0 ${SP.x4}px`, textAlign: "left", cursor: soon ? "default" : "pointer",
        background: SURF.card, border: `1px solid ${SURF.hair}`, borderRadius: R.card,
        opacity: soon ? 0.55 : 1,
      }}
    >
      <span style={{ color: "var(--accent)", display: "flex", flexShrink: 0 }}>{icone}</span>
      <span style={{
        fontFamily: FF.title, fontSize: FS.label, fontWeight: FW.semi, letterSpacing: LS.nav,
        textTransform: "uppercase", color: "var(--text)", flex: 1, minWidth: 0,
      }}>
        {rotulo}
      </span>
      {soon ? <SoonBadge /> : (
        <span aria-hidden="true" className="forja-arrow" style={{ color: "var(--muted)", display: "flex" }}>
          <Ico name="arrowRight" size={16} />
        </span>
      )}
    </button>
  );
}

/**
 * Painel do mundo ativo.
 * @param {{world:object, entities:Array, connections:Array, loading?:boolean,
 *          onOpenType:(typeId:string)=>void, onOpenEntity:(entity:object)=>void,
 *          onNavigate:(toolId:string)=>void, onNewEntity:(typeId?:string)=>void}} props
 */
export default function Dashboard({
  world, entities, connections, loading,
  onOpenType, onOpenEntity, onNavigate, onNewEntity,
}) {
  const isMobile = useIsMobile();
  const [filtroRecentes, setFiltroRecentes] = useState("");

  const lista = useMemo(() => (Array.isArray(entities) ? entities : []), [entities]);
  const arestas = useMemo(() => (Array.isArray(connections) ? connections : []), [connections]);

  const stats = useMemo(() => worldStats(lista), [lista]);
  const recentes = useMemo(
    () => stats.recent(6, filtroRecentes || undefined),
    [stats, filtroRecentes],
  );
  const passos = useMemo(
    () => firstSteps(world, lista, arestas),
    [world, lista, arestas],
  );

  const feitos = passos.filter((p) => p.done).length;
  const progresso = passos.length ? Math.round((feitos / passos.length) * 100) : 0;
  const tiposUsados = ENTITY_TYPES.filter((t) => (stats.byType[t.id] || 0) > 0).length;

  const acaoDoPasso = {
    character: () => onNewEntity("character"),
    location: () => onNewEntity("location"),
    connection: () => onNavigate("wiki"),
  };

  return (
    <div>
      <Hero
        world={world}
        total={stats.total}
        conexoes={arestas.length}
        tiposUsados={tiposUsados}
        isMobile={isMobile}
      />

      {/* ── ACERVO ───────────────────────────────────────────────── */}
      <SectionTitle
        id="forja-acervo"
        action={<Btn kind="quiet" size="sm" iconRight="arrowRight" onClick={() => onNavigate("wiki")}>Ver tudo</Btn>}
      >
        Acervo
      </SectionTitle>

      {loading ? (
        <div className="forja-grid-counters" role="status" aria-live="polite" aria-label="Carregando o acervo">
          {ENTITY_TYPES.map((t) => (
            <div key={t.id} style={{
              minHeight: 96, padding: `${SP.x3}px ${SP.x4}px`, display: "flex",
              flexDirection: "column", justifyContent: "space-between",
              background: SURF.card, border: `1px solid ${SURF.hair}`, borderRadius: R.card,
            }}>
              <Skeleton w={28} h={40} />
              <Skeleton w="70%" h={10} />
            </div>
          ))}
        </div>
      ) : (
        <div className="forja-grid-counters">
          {ENTITY_TYPES.map((t, i) => (
            <ContadorTipo
              key={t.id}
              tipo={t}
              n={stats.byType[t.id] || 0}
              index={i}
              onClick={() => onOpenType(t.id)}
            />
          ))}
        </div>
      )}

      {/* ── RECENTES + PRIMEIROS PASSOS ──────────────────────────── */}
      <div className="forja-split" style={{ marginTop: SP.x8 }}>
        <Painel
          labelId="forja-recentes"
          titulo="Editados recentemente"
          acao={
            <>
              <label htmlFor="forja-recentes-tipo" style={{
                ...T.meta, fontSize: FS.micro, textTransform: "uppercase", letterSpacing: LS.tag,
              }}>
                Tipo
              </label>
              <select
                id="forja-recentes-tipo"
                value={filtroRecentes}
                onChange={(e) => setFiltroRecentes(e.target.value)}
                className="forja-focus"
                style={{
                  minHeight: isMobile ? HIT.mobile : 30, maxWidth: 168,
                  padding: `0 ${SP.x2}px`, background: SURF.raised,
                  border: `1px solid ${SURF.hair}`, borderRadius: R.input,
                  color: "var(--text)", fontFamily: FF.ui,
                  fontSize: isMobile ? FS.input : FS.meta, cursor: "pointer",
                }}
              >
                <option value="">Todos</option>
                {ENTITY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </>
          }
        >
          {loading ? (
            <div style={{ padding: SP.x4, display: "flex", flexDirection: "column", gap: SP.x4 }}
              role="status" aria-live="polite" aria-label="Carregando os registros recentes">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} w={i % 2 ? "62%" : "84%"} h={14} />)}
            </div>
          ) : recentes.length === 0 ? (
            <EmptyState
              compact
              icon={<ToolIcon name="wiki" size={44} />}
              title={filtroRecentes ? "Nada deste tipo ainda" : "Nada editado ainda"}
              description={
                filtroRecentes
                  ? `Este mundo ainda não tem ${getEntityType(filtroRecentes).plural.toLowerCase()}.`
                  : "Assim que você criar ou editar um verbete, ele aparece aqui."
              }
              actions={
                <Btn kind="ghost" size="sm" icon="plus" onClick={() => onNewEntity(filtroRecentes || undefined)}>
                  {filtroRecentes ? `Criar ${getEntityType(filtroRecentes).label}` : "Nova entidade"}
                </Btn>
              }
            />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {recentes.map((e, i) => {
                const t = getEntityType(e.type);
                return (
                  <li key={e.id || `${e.name}-${i}`}>
                    <button
                      type="button"
                      className="forja-row-item forja-focus"
                      onClick={() => onOpenEntity(e)}
                      style={{
                        display: "flex", alignItems: "center", gap: SP.x3, width: "100%",
                        minHeight: isMobile ? HIT.mobile : 46, padding: `0 ${SP.x4}px`,
                        background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                        borderBottom: i === recentes.length - 1 ? "none" : `1px solid ${SURF.hair}`,
                      }}
                    >
                      <span style={{ color: t.color, display: "flex", flexShrink: 0 }}>
                        <EntityIcon type={t.id} size={18} />
                      </span>
                      <span style={{
                        fontFamily: FF.ui, fontSize: FS.body, color: "var(--text)", flex: 1, minWidth: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {e.name}
                      </span>
                      {isMobile ? null : <TypeBadge type={t.id} />}
                      <span style={{ ...T.data, fontSize: FS.micro, flexShrink: 0, textAlign: "right" }}>
                        {tempoRelativo(e.updatedAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>

        <Painel
          labelId="forja-passos"
          titulo="Primeiros passos"
          acao={<span style={{ ...T.data, fontSize: FS.meta }}>{feitos}/{passos.length}</span>}
        >
          <div style={{ padding: `${SP.x4}px ${SP.x4}px 0` }}>
            <div
              role="progressbar"
              aria-valuenow={progresso}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso dos primeiros passos"
              style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}
            >
              <div style={{
                width: `${progresso}%`, height: "100%", borderRadius: 999,
                background: "linear-gradient(90deg,var(--accent-dim),var(--accent2))",
                transition: "width .5s ease",
              }} />
            </div>
            <div style={{ ...T.meta, fontSize: FS.micro, marginTop: SP.x2, marginBottom: SP.x2 }}>
              {progresso}% do caminho até um mundo jogável.
            </div>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {passos.map((p, i) => (
              <PassoItem
                key={p.id}
                passo={p}
                acao={acaoDoPasso[p.id]}
                ultimo={i === passos.length - 1}
              />
            ))}
          </ul>
        </Painel>
      </div>

      {/* ── ATALHOS ──────────────────────────────────────────────── */}
      <div style={{ marginTop: SP.x8 }}>
        <SectionTitle id="forja-atalhos">Atalhos</SectionTitle>
        <div className="forja-grid-shortcuts">
          <Atalho icone={<Ico name="plus" size={20} />} rotulo="Nova entidade" onClick={() => onNewEntity()} />
          <Atalho icone={<ToolIcon name="wiki" size={20} />} rotulo="Abrir a Wiki" onClick={() => onNavigate("wiki")} />
          <Atalho
            icone={<EntityIcon type="sessionSummary" size={20} />}
            rotulo="Registrar sessão"
            onClick={() => onNewEntity("sessionSummary")}
          />
          <Atalho icone={<ToolIcon name="grafo" size={20} />} rotulo="Ver o grafo" soon />
        </div>
      </div>

      <div style={{ height: SP.x8, maxWidth: W.viewport }} />
    </div>
  );
}
