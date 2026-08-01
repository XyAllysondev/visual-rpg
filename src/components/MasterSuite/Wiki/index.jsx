/* Forja do Mestre — WIKI (spec 0027, AC-3/AC-4/AC-5/AC-8).
 *
 * Ferramenta completa do acervo: barra de filtros, rail de pastas, grade/lista e o roteamento
 * interno entre a listagem e a página da entidade (estado local — esta aba do app não usa router).
 *
 * Divisão de responsabilidades:
 *   · TODA busca/filtro/ordenação/contagem vem de `model/entityFilters`;
 *   · TODA leitura de conexão vem de `model/connections`;
 *   · TODA escrita passa pelo `worldsStore` (Firestore);
 *   · o cromo (botão, chip, vazio, esqueleto, ícone) vem de `ui/`.
 * Este arquivo só orquestra estado de tela.
 *
 * Contrato com a casca: `<Wiki worldId entities connections loading />` mais quatro props
 * opcionais de navegação — `initialType`, `initialEntityId`, `createType` e `createSignal`
 * (contador: toda MUDANÇA dele é um pedido de "nova entidade").
 *
 * A Wiki roda dentro do viewport rolável da casca (`#forja-panel`): nada aqui cria um segundo
 * scroller vertical, e a barra sticky gruda no topo daquele container.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collectTags, countByType, filterEntities, sortEntities } from "../model/entityFilters";
import { getEntityType } from "../model/entityTypes";
import { mensagemDeErro } from "../model/erros";
import {
  createConnection,
  createEntity,
  createFolder,
  deleteConnection,
  deleteEntity,
  deleteFolder,
  updateEntity,
  useFolders,
} from "../worldsStore";
import { SP, R, FS, LINE, SURF, T } from "../ui/tokens";
import { Btn, EmptyState, Skeleton } from "../ui/primitives";
import { EntityIcon, Ico } from "../ui/entityIcons";
import EntityCard from "./EntityCard";
import EntityRow from "./EntityRow";
import EntityDetail from "./EntityDetail";
import EntityModal, { ConfirmDialog } from "./EntityModal";
import FolderRail, { NO_FOLDER } from "./FolderRail";
import WikiToolbar from "./WikiToolbar";

const DEBOUNCE_BUSCA = 220;
const ESPERA_SKELETON = 300;

/* ── CSS exclusivo da Wiki ────────────────────────────────────────────────
 * Complementa o `<ForjaStyles/>` da casca (que já traz .forja-grid-cards, .forja-row,
 * .forja-split, .forja-card, .forja-chips, .forja-modal…). Aqui só o que é da Wiki e
 * inline style não faz: a troca rail↔select das pastas e duas grades de formulário. */
const WikiStyles = () => (
  <style>{`
  .wk-folder-mobile { display:none; }
  .wk-only-mobile   { display:none; }
  .wk-two-cols { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .wk-attr-row { display:grid; grid-template-columns:1fr 1fr 44px; gap:8px; align-items:center; }
  .wk-attr-line{ display:grid; grid-template-columns:110px 1fr; gap:8px; align-items:baseline; }
  @media(max-width:1023px){
    .wk-folders       { display:none; }
    .wk-folder-mobile { display:block; }
  }
  @media(max-width:767px){
    .wk-only-mobile { display:inline; }
  }
  @media(max-width:559px){
    .wk-two-cols  { grid-template-columns:1fr; }
    .wk-attr-line { grid-template-columns:1fr; }
  }
  `}</style>
);

/* ── Wiki ────────────────────────────────────────────────────────────────── */

/**
 * @param {{
 *   worldId: ?string, entities: Array, connections: Array,
 *   loading?: boolean,
 *   initialType?: ?string, initialEntityId?: ?string,
 *   createType?: ?string, createSignal?: number,
 * }} props
 */
export default function Wiki({
  worldId,
  entities,
  connections,
  loading = false,
  initialType = null,
  initialEntityId = null,
  createType = null,
  createSignal = 0,
}) {
  const lista = useMemo(
    () => (Array.isArray(entities) ? entities.filter(Boolean) : []),
    [entities],
  );
  const arestas = useMemo(
    () => (Array.isArray(connections) ? connections.filter(Boolean) : []),
    [connections],
  );
  const { folders } = useFolders(worldId);

  /* ── estado de navegação ── */
  const [query, setQuery] = useState("");
  const [busca, setBusca] = useState("");
  const [tiposSel, setTiposSel] = useState(() => (initialType ? [initialType] : []));
  const [tagsSel, setTagsSel] = useState([]);
  const [pastaSel, setPastaSel] = useState(null);
  const [ordem, setOrdem] = useState("recent");
  const [visao, setVisao] = useState("grade");
  const [selecionadaId, setSelecionadaId] = useState(initialEntityId || null);

  /* ── estado de escrita ── */
  const [modal, setModal] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroEscrita, setErroEscrita] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [mostrarSkeleton, setMostrarSkeleton] = useState(false);

  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  /* busca com debounce — o filtro só corre quando o mestre para de digitar */
  useEffect(() => {
    const t = setTimeout(() => setBusca(query), DEBOUNCE_BUSCA);
    return () => clearTimeout(t);
  }, [query]);

  /* o esqueleto só aparece se a espera passar de 300ms (piscar é pior que esperar) */
  useEffect(() => {
    if (!loading) {
      setMostrarSkeleton(false);
      return undefined;
    }
    const t = setTimeout(() => setMostrarSkeleton(true), ESPERA_SKELETON);
    return () => clearTimeout(t);
  }, [loading]);

  /* o aviso de sucesso some sozinho */
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  /* entidade aberta que sumiu (apagada aqui ou noutro dispositivo) volta para a lista */
  useEffect(() => {
    if (!selecionadaId || loading) return;
    if (!lista.some((e) => e.id === selecionadaId)) setSelecionadaId(null);
  }, [lista, selecionadaId, loading]);

  /* ── derivados (a lógica é toda do model) ── */
  const contagens = useMemo(() => countByType(lista), [lista]);
  const todasTags = useMemo(() => collectTags(lista), [lista]);

  const escopo = useMemo(
    () => (pastaSel === NO_FOLDER ? lista.filter((e) => !e.folderId) : lista),
    [lista, pastaSel],
  );

  const filtradas = useMemo(
    () =>
      filterEntities(escopo, {
        types: tiposSel,
        tags: tagsSel,
        folderId: pastaSel === NO_FOLDER ? null : pastaSel,
        query: busca,
      }),
    [escopo, tiposSel, tagsSel, pastaSel, busca],
  );

  const ordenadas = useMemo(() => sortEntities(filtradas, ordem), [filtradas, ordem]);

  const contagemPastas = useMemo(() => {
    const mapa = {};
    lista.forEach((e) => {
      if (e.folderId) mapa[e.folderId] = (mapa[e.folderId] || 0) + 1;
    });
    return mapa;
  }, [lista]);

  const soltas = useMemo(() => lista.filter((e) => !e.folderId).length, [lista]);

  const selecionada = useMemo(
    () => lista.find((e) => e.id === selecionadaId) || null,
    [lista, selecionadaId],
  );

  const temFiltro = Boolean(busca || tiposSel.length || tagsSel.length || pastaSel !== null);

  /* ── ações de escrita ── */
  const executar = useCallback(async (acao, mensagemOk) => {
    setOcupado(true);
    setErroEscrita(null);
    try {
      await acao();
      if (vivo.current && mensagemOk) setAviso(mensagemOk);
      return true;
    } catch (e) {
      if (vivo.current) setErroEscrita(mensagemDeErro(e));
      return false;
    } finally {
      if (vivo.current) setOcupado(false);
    }
  }, []);

  const abrirCriacao = useCallback(
    (tipo) =>
      setModal({
        mode: "criar",
        entity: {
          type: tipo || undefined,
          folderId: pastaSel && pastaSel !== NO_FOLDER ? pastaSel : "",
        },
      }),
    [pastaSel],
  );

  /* ── pedidos vindos da casca ── */
  useEffect(() => {
    if (!initialType) return;
    setTiposSel([initialType]);
    setSelecionadaId(null);
  }, [initialType]);

  useEffect(() => {
    if (initialEntityId) setSelecionadaId(initialEntityId);
  }, [initialEntityId]);

  /* `createSignal` é um contador: o que importa é a MUDANÇA, não o valor. */
  const ultimoSinal = useRef(0);
  useEffect(() => {
    const sinal = Number(createSignal) || 0;
    if (sinal === ultimoSinal.current) return;
    ultimoSinal.current = sinal;
    if (sinal <= 0) return;
    setSelecionadaId(null);
    abrirCriacao(createType);
  }, [createSignal, createType, abrirCriacao]);

  const limparFiltros = useCallback(() => {
    setQuery("");
    setBusca("");
    setTiposSel([]);
    setTagsSel([]);
    setPastaSel(null);
  }, []);

  /* Entidade recém-criada não pode nascer invisível: com um filtro de tipo/pasta/
   * busca ativo, salvar um "Local" enquanto o filtro é "Personagem" devolvia a tela
   * "Nada encontrado" — parece que a criação falhou. Das saídas possíveis (avisar e
   * oferecer um botão, abrir o verbete, limpar os filtros), limpar é a menos
   * surpreendente: o mestre acabou de dizer o que quer ver, a lista passa a mostrar
   * exatamente isso, e o aviso explica o que mudou (nada é desfeito em silêncio). */
  const revelarCriada = useCallback(
    (payload) => {
      const candidata = {
        id: "__recem-criada__",
        ...payload,
        folderId: payload?.folderId || null,
      };
      const passa = filterEntities([candidata], {
        types: tiposSel,
        tags: tagsSel,
        folderId: pastaSel === NO_FOLDER ? null : pastaSel,
        query: busca,
      }).length > 0;
      const forade = pastaSel === NO_FOLDER && candidata.folderId;
      if (passa && !forade) return false;
      limparFiltros();
      return true;
    },
    [busca, limparFiltros, pastaSel, tagsSel, tiposSel],
  );

  const salvar = useCallback(
    async (payload) => {
      if (!worldId) {
        setErroEscrita("Selecione um mundo antes de salvar a entidade.");
        return;
      }
      const editando = modal?.mode === "editar";
      /* O aviso nomeia o que foi salvo, com o gênero do tipo ("Alvo QA criado."
       * / "Muralha Cinzenta criada."): "Entidade criada." não confirma NADA —
       * o mestre não sabe se salvou o que ele acabou de escrever. */
      const a = getEntityType(payload?.type).artigo === "a" ? "a" : "o";
      const nome = String(payload?.name || "").trim() || "Entidade";
      const ok = await executar(
        () =>
          editando
            ? updateEntity(worldId, modal.entity.id, payload)
            : createEntity(worldId, payload),
        editando ? `${nome} atualizad${a}.` : `${nome} criad${a}.`,
      );
      if (ok && vivo.current) {
        setModal(null);
        if (!editando && revelarCriada(payload)) {
          setAviso(`${nome} criad${a}. Os filtros foram limpos para aparecer na lista.`);
        }
      }
    },
    [executar, modal, revelarCriada, worldId],
  );

  const pedirExclusao = useCallback(
    (entidade) =>
      setConfirmacao({
        title: "Excluir entidade?",
        message: `“${entidade.name}” sai do mundo junto com todas as conexões dela. Não dá para desfazer.`,
        confirmLabel: "Excluir",
        acao: async () => {
          const ok = await executar(
            () => deleteEntity(worldId, entidade.id),
            "Entidade excluída.",
          );
          if (ok && vivo.current) {
            setConfirmacao(null);
            setModal(null);
            setSelecionadaId((atual) => (atual === entidade.id ? null : atual));
          }
        },
      }),
    [executar, worldId],
  );

  const pedirExclusaoPasta = useCallback(
    (pasta) =>
      setConfirmacao({
        title: "Excluir pasta?",
        message: `“${pasta.name}” some, mas nada se perde: as entidades voltam para a raiz e as subpastas sobem um nível.`,
        confirmLabel: "Excluir pasta",
        acao: async () => {
          const ok = await executar(() => deleteFolder(worldId, pasta.id), "Pasta excluída.");
          if (ok && vivo.current) {
            setConfirmacao(null);
            setPastaSel((atual) => (atual === pasta.id ? null : atual));
          }
        },
      }),
    [executar, worldId],
  );

  const criarPasta = useCallback(
    (nome) => executar(() => createFolder(worldId, { name: nome, scope: "wiki" }), "Pasta criada."),
    [executar, worldId],
  );

  const conectar = useCallback(
    (conn) => {
      /* O aviso mostra a aresta que passou a existir, não a categoria dela. */
      const nomeDe = (id) => lista.find((e) => e.id === id)?.name || "?";
      return executar(
        () =>
          createConnection(worldId, {
            fromId: conn.fromId,
            toId: conn.toId,
            relation: conn.relation,
            inverse: conn.inverse,
            kind: conn.kind,
          }),
        `${nomeDe(conn.fromId)} → ${nomeDe(conn.toId)} · ${conn.relation}`,
      );
    },
    [executar, lista, worldId],
  );

  const desconectar = useCallback(
    (conn) => executar(() => deleteConnection(worldId, conn.id), "Conexão removida."),
    [executar, worldId],
  );

  const alternarTipo = useCallback(
    (id) =>
      setTiposSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [],
  );

  const alternarTag = useCallback(
    (tag) =>
      setTagsSel((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag])),
    [],
  );

  /* ── blocos de UI ── */

  const bannerErro = (texto, aoFechar) => (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: SP.x3,
        padding: SP.x4,
        marginBottom: SP.x4,
        background: "rgba(139,26,26,0.10)",
        border: "1px solid rgba(216,90,90,0.34)",
        borderRadius: R.card,
      }}
    >
      <span style={{ color: "var(--danger-text)", flexShrink: 0, display: "flex" }}>
        <Ico name="warn" size={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...T.section, color: "var(--danger-text)", marginBottom: SP.x1 }}>
          Não deu certo
        </div>
        <div style={T.meta}>{texto}</div>
      </div>
      {aoFechar && (
        <button
          type="button"
          className="forja-focus"
          onClick={aoFechar}
          aria-label="Dispensar o aviso de erro"
          style={{
            display: "flex",
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--muted2)",
          }}
        >
          <Ico name="close" size={16} />
        </button>
      )}
    </div>
  );

  const esqueleto = (
    <div className="forja-grid-cards" role="status" aria-live="polite" aria-label="Carregando o acervo…">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: SURF.card,
            border: `1px solid ${LINE.raise}`,
            borderRadius: R.card,
            overflow: "hidden",
          }}
        >
          <Skeleton h={84} r={0} />
          <div style={{ padding: SP.x4, display: "flex", flexDirection: "column", gap: SP.x2 }}>
            <Skeleton w="40%" h={10} />
            <Skeleton w="90%" h={14} />
            <Skeleton w="60%" h={12} />
          </div>
        </div>
      ))}
    </div>
  );

  const vazioDoMundo = (
    <EmptyState
      icon={<EntityIcon type="location" size={64} />}
      title="Acervo vazio"
      description="Nenhum verbete neste mundo."
      actions={
        <>
          <Btn kind="primary" icon="plus" onClick={() => abrirCriacao("location")}>
            Criar Local
          </Btn>
          <Btn kind="ghost" icon="plus" onClick={() => abrirCriacao("character")}>
            Criar Personagem
          </Btn>
        </>
      }
    />
  );

  const vazioDoFiltro = (() => {
    const tipoUnico = tiposSel.length === 1 ? getEntityType(tiposSel[0]) : null;
    const descricao = busca
      ? `Nenhuma entidade combina com “${busca}”.`
      : tipoUnico
        ? `Nenhum ${tipoUnico.label} com esses filtros.`
        : "Nada com esses filtros.";
    return (
      <EmptyState
        icon={tipoUnico ? <EntityIcon type={tipoUnico.id} size={56} /> : <Ico name="search" size={56} />}
        tone={tipoUnico ? tipoUnico.color : undefined}
        title="Sem correspondência"
        description={descricao}
        actions={
          <>
            <Btn kind="ghost" onClick={limparFiltros}>
              Limpar filtros
            </Btn>
            <Btn kind="primary" icon="plus" onClick={() => abrirCriacao(tipoUnico?.id)}>
              Criar entidade
            </Btn>
          </>
        }
      />
    );
  })();

  const resultados =
    visao === "grade" ? (
      <div className="forja-grid-cards nx-stagger">
        {ordenadas.map((e, i) => (
          <EntityCard key={e.id} entity={e} index={i} onOpen={() => setSelecionadaId(e.id)} />
        ))}
      </div>
    ) : (
      <div style={{ border: `1px solid ${LINE.edge}`, borderRadius: R.panel, overflow: "hidden" }}>
        {ordenadas.map((e) => (
          <EntityRow key={e.id} entity={e} onOpen={() => setSelecionadaId(e.id)} />
        ))}
      </div>
    );

  /* ── render ── */

  if (!worldId) {
    return (
      <>
        <WikiStyles />
        <EmptyState
          icon={<Ico name="world" size={56} />}
          title="Nenhum mundo ativo"
          description="Escolha ou forje um mundo no topo da Forja para abrir o acervo dele."
        />
      </>
    );
  }

  return (
    <>
      <WikiStyles />

      {erroEscrita && !modal && bannerErro(erroEscrita, () => setErroEscrita(null))}

      {selecionada ? (
        <EntityDetail
          entity={selecionada}
          entities={lista}
          connections={arestas}
          busy={ocupado}
          onBack={() => setSelecionadaId(null)}
          onEdit={() => setModal({ mode: "editar", entity: selecionada })}
          onDelete={() => pedirExclusao(selecionada)}
          onOpenEntity={(id) => setSelecionadaId(id)}
          onCreateConnection={conectar}
          onDeleteConnection={desconectar}
        />
      ) : (
        <>
          {/* cabeçalho da ferramenta */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SP.x3,
              flexWrap: "wrap",
              marginBottom: SP.x4,
            }}
          >
            {/* Sem subtítulo com a contagem: a linha de resultados da toolbar já
              * imprime o número, e ele lá é vivo (muda com o filtro). */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ ...T.hero, fontSize: 20, margin: 0 }}>Acervo</h1>
            </div>
            <Btn kind="primary" icon="plus" onClick={() => abrirCriacao()}>
              Nova entidade
            </Btn>
          </div>

          <WikiToolbar
            total={lista.length}
            results={ordenadas.length}
            query={query}
            onQuery={setQuery}
            view={visao}
            onView={setVisao}
            sort={ordem}
            onSort={setOrdem}
            counts={contagens}
            activeTypes={tiposSel}
            onToggleType={alternarTipo}
            onAllTypes={() => setTiposSel([])}
            tags={todasTags}
            activeTags={tagsSel}
            onToggleTag={alternarTag}
            hasFilters={temFiltro}
            onClear={limparFiltros}
          />

          <div className="forja-wiki-body">
            <FolderRail
              folders={folders || []}
              counts={contagemPastas}
              totalCount={lista.length}
              looseCount={soltas}
              activeId={pastaSel}
              onSelect={setPastaSel}
              onCreate={criarPasta}
              onDelete={pedirExclusaoPasta}
              busy={ocupado}
            />

            <div style={{ minWidth: 0 }}>
              {loading && lista.length === 0
                ? mostrarSkeleton
                  ? esqueleto
                  : null
                : lista.length === 0
                  ? vazioDoMundo
                  : ordenadas.length === 0
                    ? vazioDoFiltro
                    : resultados}
            </div>
          </div>
        </>
      )}

      {/* aviso de sucesso — nunca rouba o foco */}
      {aviso && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "calc(84px + env(safe-area-inset-bottom,0px))",
            transform: "translateX(-50%)",
            zIndex: 380,
            display: "flex",
            alignItems: "center",
            gap: SP.x2,
            padding: `10px ${SP.x4}px`,
            background: SURF.raised,
            border: "1px solid var(--border2)",
            borderRadius: R.pill,
            color: "var(--accent)",
            boxShadow: "0 12px 36px rgba(0,0,0,0.62)",
            ...T.meta,
            fontSize: FS.meta,
          }}
        >
          <Ico name="check" size={14} />
          {aviso}
        </div>
      )}

      {modal && (
        <EntityModal
          key={`${modal.mode}-${modal.entity?.id || "novo"}`}
          mode={modal.mode}
          initial={modal.entity}
          folders={folders || []}
          allTags={todasTags}
          saving={ocupado}
          error={erroEscrita}
          onSave={salvar}
          onDelete={
            modal.mode === "editar" && modal.entity ? () => pedirExclusao(modal.entity) : undefined
          }
          onClose={() => {
            setModal(null);
            setErroEscrita(null);
          }}
        />
      )}

      {confirmacao && (
        <ConfirmDialog
          title={confirmacao.title}
          message={confirmacao.message}
          confirmLabel={confirmacao.confirmLabel}
          busy={ocupado}
          onConfirm={confirmacao.acao}
          onCancel={() => setConfirmacao(null)}
        />
      )}
    </>
  );
}
