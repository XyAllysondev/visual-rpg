/* Forja do Mestre — PÁGINA DA ENTIDADE (spec 0027, AC-3/AC-5/AC-8).
 *
 * Descrição, atributos e conexões. As conexões chegam já viradas para o lado desta entidade
 * (`connectionsOf`): "A CONTÉM B" aparece em B como "CONTIDO EM A". Criar passa por
 * `makeConnection` + `isDuplicate` ANTES de tocar no banco — autoligação e duplicata morrem aqui,
 * com mensagem em português na tela, nunca em silêncio.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getEntityType } from "../model/entityTypes";
import { sortEntities } from "../model/entityFilters";
import {
  RELATION_PRESETS,
  connectionsOf,
  isDuplicate,
  makeConnection,
} from "../model/connections";
import { SP, R, FF, FS, LINE, HIT, W, T, tempoRelativo, DANGER_TEXT_AA } from "../ui/tokens";
import { Btn } from "../ui/primitives";
import { EntityIcon, Ico } from "../ui/entityIcons";

const LIVRE = "__livre__";

const painel = {
  background: "var(--surface)",
  border: `1px solid ${LINE.edge}`,
  borderRadius: R.panel,
  padding: SP.x4,
};

const campo = {
  minHeight: HIT.mobile,
  padding: `0 ${SP.x2}px`,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: R.input,
  color: "var(--text)",
  fontFamily: FF.ui,
  fontSize: FS.input,
  outline: "none",
};

const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };

/**
 * @param {{
 *   entity: object, entities: Array, connections: Array,
 *   onBack: () => void, onEdit: () => void, onDelete: () => void,
 *   onOpenEntity: (id: string) => void,
 *   onCreateConnection: (conn: object) => void,
 *   onDeleteConnection: (conn: object) => void,
 *   busy?: boolean,
 * }} props
 */
export default function EntityDetail({
  entity,
  entities = [],
  connections = [],
  onBack,
  onEdit,
  onDelete,
  onOpenEntity,
  onCreateConnection,
  onDeleteConnection,
  busy = false,
}) {
  const [conectando, setConectando] = useState(false);
  const [alvo, setAlvo] = useState("");
  const [relacao, setRelacao] = useState(RELATION_PRESETS[0].id);
  const [rotuloLivre, setRotuloLivre] = useState("");
  const [erro, setErro] = useState(null);

  const porId = useMemo(() => {
    const mapa = new Map();
    (entities || []).forEach((e) => e && mapa.set(e.id, e));
    return mapa;
  }, [entities]);

  const vinculos = useMemo(
    () => (entity ? connectionsOf(connections, entity.id) : []),
    [connections, entity],
  );

  const candidatas = useMemo(
    () => sortEntities((entities || []).filter((e) => e && e.id !== entity?.id), "az"),
    [entities, entity],
  );

  /* O formulário de conexão é inline, mas se comporta como diálogo: Esc fecha.
   * O listener é no documento (e não no <div>) porque o mestre pode ter tirado o
   * foco do formulário; sem isto o Esc não fazia nada em lugar nenhum da página. */
  const fecharConexao = useCallback(() => {
    setConectando(false);
    setErro(null);
  }, []);

  useEffect(() => {
    if (!conectando) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      fecharConexao();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [conectando, fecharConexao]);

  if (!entity) return null;

  const tipo = getEntityType(entity.type);
  const tags = Array.isArray(entity.tags) ? entity.tags : [];
  const atributos = Array.isArray(entity.attributes) ? entity.attributes : [];

  const criarConexao = () => {
    setErro(null);
    const rotulo = relacao === LIVRE ? rotuloLivre.trim() : relacao;
    if (relacao === LIVRE && !rotulo) {
      setErro("Escreva o rótulo da relação.");
      return;
    }
    let candidata;
    try {
      candidata = makeConnection({ fromId: entity.id, toId: alvo, relation: rotulo });
    } catch (e) {
      setErro((e && e.message) || "Não foi possível montar a conexão.");
      return;
    }
    if (isDuplicate(connections, candidata)) {
      setErro("Essa conexão já existe entre as duas entidades.");
      return;
    }
    if (!onCreateConnection) return;
    // Fecha o formulário só depois que o servidor confirmar — fechar antes faz
    // uma falha (rede, duplicata vinda de outra aba) parecer sucesso.
    Promise.resolve(onCreateConnection(candidata)).then((ok) => {
      if (ok === false) {
        setErro("A conexão não foi salva. Verifique a rede e tente de novo.");
        return;
      }
      setAlvo("");
      setRotuloLivre("");
      setConectando(false);
    });
  };

  /* Verbete recém-criado não tem atributo nem conexão: aí os dois painéis do
   * aside colapsam num só ("Ficha"), e este formulário é o mesmo nos dois
   * caminhos — um único lugar que sabe conectar. */
  const fichaVazia = atributos.length === 0 && vinculos.length === 0;

  const formularioConexao = conectando ? (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
      <label htmlFor="wk-conn-alvo" style={{ ...T.section, fontSize: 10 }}>
        Entidade
      </label>
      <select
        id="wk-conn-alvo"
        className="forja-focus"
        value={alvo}
        onChange={(e) => setAlvo(e.target.value)}
        style={campo}
      >
        <option value="">Escolha a entidade…</option>
        {candidatas.map((e) => (
          <option key={e.id} value={e.id}>
            {`${e.name} · ${getEntityType(e.type).label}`}
          </option>
        ))}
      </select>

      <label htmlFor="wk-conn-rel" style={{ ...T.section, fontSize: 10 }}>
        Relação
      </label>
      <select
        id="wk-conn-rel"
        className="forja-focus"
        value={relacao}
        onChange={(e) => setRelacao(e.target.value)}
        style={campo}
      >
        {RELATION_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {`${p.label} · do outro lado: ${p.inverse}`}
          </option>
        ))}
        <option value={LIVRE}>Outro rótulo…</option>
      </select>

      {relacao === LIVRE && (
        <input
          className="forja-focus"
          value={rotuloLivre}
          onChange={(e) => setRotuloLivre(e.target.value)}
          aria-label="Rótulo livre da relação"
          placeholder="Ex.: DEVE FAVOR A"
          style={{ ...campo, padding: `0 ${SP.x3}px` }}
        />
      )}

      {erro && (
        <div role="alert" style={{ ...T.meta, fontSize: FS.micro, color: DANGER_TEXT_AA }}>
          {erro}
        </div>
      )}

      <div style={{ display: "flex", gap: SP.x2 }}>
        <Btn kind="primary" size="sm" icon="link" onClick={criarConexao} disabled={busy}>
          Conectar
        </Btn>
        <Btn kind="quiet" size="sm" onClick={fecharConexao}>
          Cancelar
        </Btn>
      </div>
    </div>
  ) : (
    <Btn kind="quiet" size="sm" icon="plus" onClick={() => setConectando(true)} disabled={busy}>
      Conectar entidade
    </Btn>
  );

  return (
    <div>
      {/* ── trilha + ações ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SP.x2,
          flexWrap: "wrap",
          marginBottom: SP.x4,
        }}
      >
        <Btn kind="quiet" size="sm" icon="arrowLeft" onClick={onBack}>
          Wiki
        </Btn>
        <span aria-hidden="true" style={{ ...T.meta, opacity: 0.5 }}>
          /
        </span>
        <span style={{ ...T.typeTag, color: tipo.color }}>{tipo.label}</span>
        <span aria-hidden="true" style={{ ...T.meta, opacity: 0.5 }}>
          /
        </span>
        <span style={{ ...T.meta, flex: 1, minWidth: 80, ...ellipsis }} title={entity.name}>
          {entity.name}
        </span>

        <Btn kind="ghost" size="sm" icon="edit" onClick={onEdit} disabled={busy}>
          Editar
        </Btn>
        {/* Ação destrutiva não precisa competir de igual para igual com "Editar":
          * o gatilho fica quieto (ícone de lixeira + rótulo já são inequívocos)
          * e o diálogo de confirmação continua vermelho — é lá que a decisão
          * acontece, e o diálogo já era a melhor tela do produto. */}
        <Btn
          kind="quiet"
          size="sm"
          icon="trash"
          /* Nada de dois diálogos empilhados: o formulário de conexão sai da tela
           * antes de a confirmação de exclusão entrar. Nada é perdido — o
           * formulário ainda não tinha gravado nada. */
          onClick={() => {
            fecharConexao();
            if (onDelete) onDelete();
          }}
          disabled={busy}
        >
          Excluir
        </Btn>
      </div>

      {/* ── hero ── */}
      <header
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: R.panel,
          /* a faixa da esquerda troca de cor a cada entidade aberta: bordas em
           * propriedades longas para não misturar com o atalho `border`. */
          borderTop: `1px solid ${LINE.edge}`,
          borderRight: `1px solid ${LINE.edge}`,
          borderBottom: `1px solid ${LINE.edge}`,
          /* A faixa de 4px já identifica o tipo. O radial-gradient da cor do
           * tipo cobria 152px de hero, comia contraste do nome e é o efeito que
           * todo gerador de UI produz — bonito por 3 segundos, genérico depois. */
          borderLeft: `4px solid ${tipo.color}`,
          background: "var(--surface)",
          marginBottom: SP.x6,
        }}
      >
        {entity.imageUrl && (
          <>
            <img
              src={entity.imageUrl}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(20,20,28,0.35) 0%, rgba(20,20,28,0.92) 88%)",
              }}
            />
          </>
        )}
        <div
          style={{
            position: "relative",
            padding: SP.x5,
            display: "flex",
            flexDirection: "column",
            gap: SP.x2,
            minHeight: 112,
            justifyContent: "flex-end",
          }}
        >
          {/* Sem repetir o tipo: a trilha logo acima já imprime "LOCAL" na cor
            * dele, 30px daqui. Duas vezes o tipo e duas vezes o nome em 90px. */}
          <h1 style={{ ...T.hero, margin: 0 }}>{entity.name}</h1>
          <div style={T.meta}>Editado {tempoRelativo(entity.updatedAt)}</div>
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: SP.x2, flexWrap: "wrap", marginTop: SP.x1 }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    ...T.meta,
                    fontSize: FS.micro,
                    padding: `3px ${SP.x2}px`,
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${LINE.hair}`,
                    borderRadius: R.tag,
                    color: "var(--muted2)",
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── corpo ── */}
      <div className="forja-split">
        <section style={painel} aria-labelledby="wk-desc-title">
          <h2 id="wk-desc-title" style={{ ...T.section, margin: `0 0 ${SP.x3}px` }}>
            Descrição
          </h2>
          {entity.description ? (
            <p style={{ ...T.prose, margin: 0, whiteSpace: "pre-wrap", maxWidth: W.measure }}>
              {entity.description}
            </p>
          ) : (
            <p style={{ ...T.empty, margin: 0 }}>Sem descrição.</p>
          )}
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: SP.x4 }}>
          {/* Ficha vazia: UM painel de ~96px em vez de três caixas, três bordas,
            * três títulos em caixa alta e 250px de altura para dizer que não há
            * nada. Assim que aparece atributo ou conexão, os dois painéis voltam. */}
          {fichaVazia ? (
            <section style={painel} aria-labelledby="wk-ficha-title">
              <h2 id="wk-ficha-title" style={{ ...T.section, margin: `0 0 ${SP.x2}px` }}>
                Ficha
              </h2>
              <p style={{ ...T.empty, margin: 0, minHeight: 32, lineHeight: "32px" }}>Sem atributos.</p>
              <p style={{ ...T.empty, margin: `0 0 ${SP.x3}px`, minHeight: 32, lineHeight: "32px" }}>
                Sem conexões.
              </p>
              {formularioConexao}
            </section>
          ) : (
          <>
          {/* atributos */}
          <section style={painel} aria-labelledby="wk-attr-title">
            <h2 id="wk-attr-title" style={{ ...T.section, margin: `0 0 ${SP.x3}px` }}>
              Atributos
            </h2>
            {atributos.length ? (
              <dl style={{ margin: 0 }}>
                {atributos.map((a, i) => (
                  <div
                    key={`${a.key}-${i}`}
                    className="wk-attr-line"
                    style={{
                      padding: `${SP.x2}px 0`,
                      borderTop: i === 0 ? "none" : `1px solid ${LINE.hair}`,
                    }}
                  >
                    <dt style={{ ...T.section, fontSize: 10, margin: 0 }}>{a.key}</dt>
                    <dd style={{ ...T.data, fontSize: 13, color: "var(--text)", margin: 0 }}>
                      {a.value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p style={{ ...T.empty, margin: 0 }}>Sem atributos.</p>
            )}
          </section>

          {/* conexões */}
          <section style={painel} aria-labelledby="wk-conn-title">
            <h2 id="wk-conn-title" style={{ ...T.section, margin: `0 0 ${SP.x3}px` }}>
              Conexões · {vinculos.length}
            </h2>

            {vinculos.length === 0 && !conectando && (
              <p style={{ ...T.empty, margin: `0 0 ${SP.x3}px` }}>Sem conexões.</p>
            )}

            {vinculos.length > 0 && (
              <ul style={{ listStyle: "none", margin: `0 0 ${SP.x3}px`, padding: 0 }}>
                {vinculos.map(({ connection, otherId, label }) => {
                  const outra = porId.get(otherId);
                  const tipoOutra = getEntityType(outra?.type);
                  return (
                    <li
                      key={connection.id || `${connection.fromId}-${connection.toId}-${label}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: SP.x2,
                        borderTop: `1px solid ${LINE.hair}`,
                      }}
                    >
                      <button
                        type="button"
                        className="forja-focus"
                        onClick={() => outra && onOpenEntity && onOpenEntity(outra.id)}
                        disabled={!outra}
                        title={outra ? `Abrir ${outra.name}` : "Entidade removida"}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: SP.x2,
                          flex: 1,
                          minWidth: 0,
                          minHeight: HIT.mobile,
                          padding: `${SP.x1}px ${SP.x1}px`,
                          background: "transparent",
                          border: "none",
                          borderRadius: R.input,
                          cursor: outra ? "pointer" : "not-allowed",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ display: "flex", color: tipoOutra.color, flexShrink: 0 }}>
                          <EntityIcon type={outra?.type} size={16} />
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              ...T.cardTitle,
                              fontSize: FS.body,
                              display: "block",
                              ...ellipsis,
                            }}
                          >
                            {outra ? outra.name : "Entidade removida"}
                          </span>
                          <span style={{ ...T.meta, fontSize: FS.micro, color: "var(--muted)" }}>
                            {label}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="forja-focus"
                        onClick={() => onDeleteConnection && onDeleteConnection(connection)}
                        disabled={busy}
                        aria-label={`Remover a conexão ${label} ${outra ? outra.name : ""}`.trim()}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: HIT.mobile,
                          minHeight: HIT.mobile,
                          background: "transparent",
                          border: "none",
                          borderRadius: R.input,
                          cursor: "pointer",
                          color: "var(--muted)",
                        }}
                      >
                        <Ico name="close" size={15} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {formularioConexao}
          </section>
          </>
          )}
        </aside>
      </div>
    </div>
  );
}
