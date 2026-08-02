/* ════════════════════════════════════════════════════════════════════
 *  FORJA DO MESTRE — PAINEL DO MUNDO  (spec 0027 · AC-6)
 *  --------------------------------------------------------------------
 *  Banda de dossiê do mundo ativo, ledger de tipos (só o que EXISTE, com
 *  os vazios a um clique), editados recentemente com filtro por tipo e o
 *  preparo do mundo vindo do estado REAL — nada de marcação manual.
 *
 *  Toda a agregação vem de `model/dashboardStats` — este arquivo só
 *  desenha. Nada de contagem improvisada aqui.
 *
 *  Por que ledger e não grade de 11 contadores: onze caixas idênticas, dez
 *  delas dizendo "0", com número colorido + glow colorido + borda colorida
 *  em cada uma, gastavam 195px do espaço mais nobre da tela para dizer que
 *  o mundo está vazio. O ledger mostra o inventário — e cor só no ícone.
 * ════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { ENTITY_TYPES, getEntityType } from "../model/entityTypes";
import { worldStats, firstSteps } from "../model/dashboardStats";
import { EntityIcon, Ico, ToolIcon } from "../ui/entityIcons";
import {
  Btn, EmptyState, SectionTitle, Skeleton, SoonBadge, TypeBadge, useIsMobile,
} from "../ui/primitives";
import { SP, R, FF, FS, LS, LINE, HIT, T, tempoRelativo } from "../ui/tokens";

/* Passos que dependem de ferramentas das fases 2–8: informam, mas não navegam. */
const PASSO_EM_BREVE = { journal: "Fase 3", graph: "Fase 2" };

/* ── Painel-caixa reusado pelos dois blocos do meio ─────────────────── */
function Painel({ titulo, acao, children, labelId }) {
  return (
    <section
      aria-labelledby={labelId}
      style={{
        /* superfície de painel: filete NEUTRO. O dourado ficou reservado
         * para o que responde ao clique (ver `LINE` em ui/tokens). */
        background: "var(--surface)", border: `1px solid ${LINE.edge}`,
        borderRadius: R.panel, overflow: "hidden",
      }}
    >
      <header style={{
        display: "flex", alignItems: "center", gap: SP.x3, minHeight: 38,
        padding: `0 ${SP.x4}px`, borderBottom: `1px solid ${LINE.hair}`,
      }}>
        <h3 id={labelId} style={{ ...T.section, margin: 0 }}>{titulo}</h3>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: SP.x2 }}>{acao}</span>
      </header>
      {children}
    </section>
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
    borderBottom: ultimo ? "none" : `1px solid ${LINE.hair}`,
  };

  if (!clicavel) {
    return <li style={{ ...estilo, listStyle: "none" }}>{miolo}</li>;
  }
  return (
    <li style={{ listStyle: "none" }}>
      <button
        type="button" onClick={acao} className="forja-focus forja-row-item"
        /* `borderBottom` vem do `estilo` e muda com a posição na lista: zerar as
         * outras três bordas com as propriedades longas (e não com o atalho
         * `border`) evita o aviso do React sobre shorthand + longhand. */
        style={{
          ...estilo,
          background: "transparent",
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
          cursor: "pointer",
        }}
      >
        {miolo}
      </button>
    </li>
  );
}

/* ── Linha do ledger ────────────────────────────────────────────────── */
function LinhaTipo({ tipo, n, isMobile, onClick }) {
  return (
    <button
      type="button"
      className="forja-focus"
      onClick={onClick}
      aria-label={`${n} ${n === 1 ? tipo.label : tipo.plural} — abrir na Wiki`}
      style={{
        display: "flex", alignItems: "center", gap: SP.x3,
        minHeight: isMobile ? HIT.mobile : 42, padding: `0 ${SP.x4}px`,
        /* a régua do ledger é o gap de 1px da grade: célula sem borda nenhuma */
        background: "transparent", border: "none",
        cursor: "pointer", textAlign: "left",
        opacity: n === 0 ? 0.42 : 1,
      }}
    >
      <span style={{ color: tipo.color, display: "flex", flexShrink: 0 }}>
        <EntityIcon type={tipo.id} size={16} />
      </span>
      <span style={{
        ...T.typeTag, color: "var(--muted2)", flex: 1, minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {tipo.label}
      </span>
      <span style={{ ...T.ledgerNum, flexShrink: 0 }}>{n}</span>
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
  const [verVazios, setVerVazios] = useState(false);

  const lista = useMemo(() => (Array.isArray(entities) ? entities : []), [entities]);
  const arestas = useMemo(() => (Array.isArray(connections) ? connections : []), [connections]);

  const stats = useMemo(() => worldStats(lista), [lista]);
  const recentes = useMemo(
    () => stats.recent(10, filtroRecentes || undefined),
    [stats, filtroRecentes],
  );
  const passos = useMemo(
    () => firstSteps(world, lista, arestas),
    [world, lista, arestas],
  );

  const feitos = passos.filter((p) => p.done).length;
  const progresso = passos.length ? Math.round((feitos / passos.length) * 100) : 0;
  const preparoAberto = feitos < passos.length;

  /* Ledger: primeiro o que EXISTE, do mais povoado ao menos; os vazios ficam
   * atrás de um clique (não somem — sumir apagaria informação). */
  const usados = useMemo(
    () => ENTITY_TYPES
      .map((t) => ({ t, n: stats.byType[t.id] || 0 }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.t.label.localeCompare(b.t.label, "pt-BR")),
    [stats],
  );
  const vazios = useMemo(
    () => ENTITY_TYPES.filter((t) => !(stats.byType[t.id] > 0)).map((t) => ({ t, n: 0 })),
    [stats],
  );
  const linhas = verVazios ? [...usados, ...vazios] : usados;
  const tiposUsados = usados.length;

  const acaoDoPasso = {
    character: () => onNewEntity("character"),
    location: () => onNewEntity("location"),
    connection: () => onNavigate("wiki"),
  };

  const total = stats.total;
  const conexoes = arestas.length;

  return (
    <div>
      {/* ── BANDA DO MUNDO ATIVO ─────────────────────────────────────
        * Sem watermark de 176px, sem raio, sem <dl> encostado na borda
        * direita a 700px do título: os três números são lidos junto ao
        * nome do mundo, que é a informação que o mestre veio ver. */}
      <header className="forja-band">
        <div style={{ ...T.section, color: "var(--accent)", marginBottom: SP.x1 }}>Mundo ativo</div>
        <h1 style={{
          ...T.hero, fontSize: isMobile ? 22 : 30, margin: 0, overflowWrap: "anywhere",
        }}>
          {world?.name || "Sem nome"}
        </h1>
        <div style={{
          ...T.data, fontSize: FS.meta, color: "var(--muted2)", marginTop: SP.x2,
          display: "flex", gap: SP.x2, flexWrap: "wrap",
        }}>
          <span>{total} {total === 1 ? "entidade" : "entidades"}</span>
          <span aria-hidden="true">·</span>
          <span>{conexoes} {conexoes === 1 ? "conexão" : "conexões"}</span>
          <span aria-hidden="true">·</span>
          <span>{tiposUsados} de {ENTITY_TYPES.length} tipos</span>
          {world?.genre ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{world.genre}</span>
            </>
          ) : null}
        </div>
        {world?.description ? (
          <p style={{
            ...T.meta, fontSize: 13, margin: `${SP.x3}px 0 0`, maxWidth: "68ch",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {world.description}
          </p>
        ) : null}
      </header>

      {/* ── ACERVO ───────────────────────────────────────────────── */}
      <SectionTitle
        id="forja-acervo"
        action={<Btn kind="quiet" size="sm" iconRight="arrowRight" onClick={() => onNavigate("wiki")}>Ver tudo</Btn>}
      >
        Acervo
      </SectionTitle>

      {loading ? (
        <div className="forja-ledger" role="status" aria-live="polite" aria-label="Carregando o acervo">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{
              minHeight: isMobile ? HIT.mobile : 42, padding: `0 ${SP.x4}px`,
              display: "flex", alignItems: "center", gap: SP.x3,
            }}>
              <Skeleton w={16} h={16} r={3} />
              <Skeleton w="52%" h={10} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {linhas.length ? (
            <div className="forja-ledger">
              {linhas.map(({ t, n }) => (
                <LinhaTipo
                  key={t.id}
                  tipo={t}
                  n={n}
                  isMobile={isMobile}
                  onClick={() => onOpenType(t.id)}
                />
              ))}
            </div>
          ) : null}
          {vazios.length ? (
            <button
              type="button"
              className="forja-focus"
              onClick={() => setVerVazios((v) => !v)}
              aria-expanded={verVazios}
              style={{
                ...T.meta, fontSize: FS.meta, color: "var(--muted)",
                background: "none", border: "none", cursor: "pointer",
                minHeight: isMobile ? HIT.mobile : 30,
                padding: `${SP.x2}px 2px 0`, textAlign: "left",
              }}
            >
              {verVazios
                ? "Ocultar tipos vazios"
                : `${vazios.length} ${vazios.length === 1 ? "tipo vazio" : "tipos vazios"}`}
            </button>
          ) : null}
        </>
      )}

      {/* ── RECENTES + PREPARO DO MUNDO ──────────────────────────── */}
      <div
        className="forja-dash"
        style={{
          marginTop: SP.x6,
          /* preparo cumprido some da tela — e aí a coluna larga fica com tudo */
          gridTemplateColumns: preparoAberto ? undefined : "minmax(0,1fr)",
        }}
      >
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
                  minHeight: isMobile ? HIT.mobile : 28, maxWidth: 168,
                  padding: `0 ${SP.x2}px`, background: "var(--card)",
                  border: `1px solid ${LINE.raise}`, borderRadius: R.input,
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
              title={filtroRecentes ? `Nenhum ${getEntityType(filtroRecentes).label}` : "Nada editado"}
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
                        minHeight: isMobile ? HIT.mobile : 40, padding: `0 ${SP.x4}px`,
                        background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                        borderBottom: i === recentes.length - 1 ? "none" : `1px solid ${LINE.hair}`,
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

        {preparoAberto ? (
          <Painel
            labelId="forja-passos"
            titulo="Preparo do mundo"
            acao={<span style={{ ...T.data, fontSize: FS.meta }}>{feitos}/{passos.length}</span>}
          >
            {/* Filete chapado: a fração no cabeçalho já diz o número. Barra com
              * gradiente + porcentagem + fração + lista = quatro desenhos do
              * mesmo dado. O `role` fica — leitor de tela precisa do progresso. */}
            <div
              role="progressbar"
              aria-valuenow={progresso}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso do preparo do mundo"
              style={{ height: 2, background: "rgba(255,255,255,0.06)" }}
            >
              <div style={{ width: `${progresso}%`, height: "100%", background: "var(--accent)" }} />
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
        ) : null}
      </div>
    </div>
  );
}
