/* ════════════════════════════════════════════════════════════════════
 *  ATELIÊ DO MESTRE — MAPAS-MÚNDI  (spec 0028 · F1 · AC-2 e AC-3)
 *  --------------------------------------------------------------------
 *  A sub-aba "Mapas-Múndi" da tela Mapas. Aqui o mestre lista, cria,
 *  renomeia, exclui e ilustra os MOLDES — os mapas autorais que vivem em
 *  `users/{uid}/worldmaps/**` e que nenhum jogador alcança (design §3).
 *
 *  COMPONENTE IRMÃO (AC-12): nada aqui entra no `MapEditor`. O editor
 *  tático continua exatamente como está; este módulo não o importa, não o
 *  estende e não compartilha estado com ele.
 *
 *  FRONTEIRA DE I/O: só `../worldMapStore`. Cota vem de `../model/quotas`,
 *  que é lógica pura. Este arquivo não fala com o Firestore.
 * ════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { useWorldMaps, createWorldMap, updateWorldMap, deleteWorldMap } from "../worldMapStore";
import { canAddNode, canCreateMap } from "../model/quotas";
import AtelierStyles from "./AtelierStyles";
import MoldeModal from "./MoldeModal";
import ConfirmarExclusao from "./ConfirmarExclusao";
import MoldeDetalhe, { urlDoFundo } from "./MoldeDetalhe";
import {
  SP, R, FS, T, SURF, LINE, btnStyle, contarNos, tempoRelativo, mensagemDeErro,
} from "./ui";

/* ── CARD DO MOLDE ───────────────────────────────────────────────────
 * O card NÃO é um botão só: abrir, renomear e excluir são três ações e
 * botão dentro de botão é HTML inválido (e leitor de tela se perde). O
 * invólucro é um <article>; dentro dele, o botão de abrir ocupa a área
 * grande e as ações moram numa linha própria. */
function MoldeCard({ molde, onAbrir, onRenomear, onExcluir }) {
  const fundo = urlDoFundo(molde);
  return (
    <article className="wm-card" style={{
      display: "flex", flexDirection: "column",
      background: SURF.card, border: `1px solid ${LINE.raise}`,
      borderRadius: R.card, overflow: "hidden",
    }}>
      <button
        type="button" className="wm-focus"
        onClick={() => onAbrir(molde)}
        aria-label={`Abrir mapa-múndi: ${molde.name || "sem nome"}`}
        style={{
          display: "block", width: "100%", textAlign: "left", padding: 0,
          background: "transparent", border: "none", cursor: "pointer",
        }}
      >
        {/* miniatura do fundo */}
        <div style={{
          position: "relative", height: 116, background: fundo
            ? `center/cover no-repeat url("${fundo}")`
            : "linear-gradient(150deg,rgba(201,168,76,0.10),rgba(176,48,216,0.08))",
          borderBottom: `1px solid ${LINE.hair}`,
        }}>
          {!fundo && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center",
              justifyContent: "center", gap: SP.x2, ...T.meta, fontSize: FS.micro,
            }}>
              <span aria-hidden="true" style={{ fontSize: 22, opacity: 0.5 }}>🗺️</span>
              sem ilustração
            </div>
          )}
        </div>

        <div style={{ padding: `${SP.x3}px ${SP.x4}px ${SP.x2}px` }}>
          <div style={{ ...T.cardTitle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {molde.name || "Sem nome"}
          </div>
          <div style={{ ...T.data, marginTop: SP.x1 }}>
            {contarNos(molde.nodeCount)} · {tempoRelativo(molde.updatedAt)}
          </div>
        </div>
      </button>

      <div style={{
        display: "flex", gap: SP.x2, padding: `0 ${SP.x3}px ${SP.x3}px`, marginTop: "auto",
      }}>
        <button type="button" className="wm-focus wm-act" onClick={() => onRenomear(molde)}
          aria-label={`Renomear ${molde.name || "mapa sem nome"}`}
          style={{ ...btnStyle("quiet", "sm"), flex: 1 }}>
          Renomear
        </button>
        <button type="button" className="wm-focus wm-act" onClick={() => onExcluir(molde)}
          aria-label={`Excluir ${molde.name || "mapa sem nome"}`}
          style={{ ...btnStyle("danger", "sm"), flex: 1 }}>
          Excluir
        </button>
      </div>
    </article>
  );
}

/* ── ESTADO VAZIO ────────────────────────────────────────────────────
 * Ninguém chega aqui sabendo o que é um "mapa-múndi". O vazio explica a
 * mecânica em duas frases e oferece a única saída que importa. */
function Vazio({ onCriar, bloqueado, motivo }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      gap: SP.x3, padding: `${SP.x10}px ${SP.x5}px`,
      background: SURF.rail, border: `1px solid ${LINE.edge}`, borderRadius: R.panel,
    }}>
      <span aria-hidden="true" style={{ fontSize: 46, opacity: 0.4 }}>🧭</span>
      <h3 style={{ ...T.hero, fontSize: FS.h3, margin: 0 }}>Nenhum mapa-múndi ainda</h3>
      <p style={{ ...T.body, margin: 0, color: "var(--muted2)", maxWidth: "56ch" }}>
        Um mapa-múndi é o mundo por cima da mesa tática: cidades, masmorras e estradas sobre
        uma ilustração sua. Na sessão, ele se desenha conforme o grupo viaja — a névoa recua,
        os locais aparecem e o que você escondeu continua escondido.
      </p>
      <p style={{ ...T.meta, margin: 0, maxWidth: "56ch" }}>
        O molde é seu e privado. O mesmo mapa pode ser levado a várias campanhas, cada uma com
        o próprio progresso.
      </p>
      <button type="button" className="wm-focus" onClick={onCriar}
        aria-disabled={bloqueado ? "true" : undefined}
        style={{ ...btnStyle("primary"), marginTop: SP.x2, opacity: bloqueado ? 0.55 : 1 }}>
        Criar meu primeiro mapa-múndi
      </button>
      {bloqueado && motivo ? (
        <div style={{ ...T.meta, fontSize: FS.micro, maxWidth: "48ch" }}>{motivo}</div>
      ) : null}
    </div>
  );
}

/* ── ESQUELETO ───────────────────────────────────────────────────────── */
function Esqueleto() {
  return (
    <div className="wm-grid" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="wm-skel" style={{
          height: 196, background: SURF.card, border: `1px solid ${LINE.hair}`, borderRadius: R.card,
        }} />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  ATELIÊ
 * ════════════════════════════════════════════════════════════════════ */

/**
 * @param {object} props
 * @param {string} props.uid   dono dos moldes; sem ele não há o que ler
 * @param {string} [props.plan] plano do usuário ('free' | 'pago') — cota (AC-3)
 */
export default function Atelier({ uid, plan = "free" }) {
  const { maps, loading, error } = useWorldMaps(uid);
  const lista = useMemo(() => (Array.isArray(maps) ? maps : []), [maps]);

  const [modal, setModal] = useState(null);        // null | {modo:'criar'} | {modo:'renomear',molde}
  const [excluindo, setExcluindo] = useState(null);
  const [abertoId, setAbertoId] = useState(null);
  const [aviso, setAviso] = useState("");
  const [falha, setFalha] = useState("");

  /* Cota é lógica pura — a UI só a lê e explica (AC-3). */
  const cota = useMemo(() => {
    try { return canCreateMap(plan, lista.length) || { ok: true }; }
    catch { return { ok: true }; }
  }, [plan, lista.length]);

  const limiteNos = useMemo(() => {
    try { return canAddNode(plan, 0)?.limite; }
    catch { return undefined; }
  }, [plan]);

  /* Se o molde aberto sumir (excluído em outra aba, leitura recarregada),
   * `aberto` fica nulo e a tela cai de volta na lista — nunca num vazio
   * sem explicação. */
  const aberto = abertoId ? lista.find((m) => m.id === abertoId) : null;

  const abrirCriacao = () => {
    setFalha("");
    setAviso("");
    if (!cota.ok) {
      /* Nunca falha em silêncio: o clique bloqueado vira explicação. */
      setFalha(motivoDaCota(cota, plan));
      return;
    }
    setModal({ modo: "criar" });
  };

  const criar = async ({ name, description }) => {
    /* `plan` é insumo da cota, não campo do documento: o store checa o teto
     * antes de escrever e recusa com Error em PT-BR (AC-3). Sem ele, o store
     * assume `free` — por isso a tela é obrigada a passar adiante. */
    const id = await createWorldMap(uid, { name, description, plan });
    setModal(null);
    setAviso(`"${name}" criado. Suba a ilustração de fundo para começar.`);
    if (id) setAbertoId(id);
  };

  const renomear = async ({ name, description }) => {
    const alvo = modal?.molde;
    if (!alvo) return;
    await updateWorldMap(uid, alvo.id, { name, description });
    setModal(null);
    setAviso("Mapa atualizado.");
  };

  const excluir = async () => {
    const alvo = excluindo;
    if (!alvo) return;
    await deleteWorldMap(uid, alvo.id);
    setExcluindo(null);
    if (abertoId === alvo.id) setAbertoId(null);
    setAviso(`"${alvo.name || "Mapa"}" excluído.`);
  };

  /* ── Sem login: não há molde a ler ─────────────────────────────── */
  if (!uid) {
    return (
      <section aria-label="Mapas-Múndi" style={{ padding: `${SP.x10}px 0` }}>
        <AtelierStyles />
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: SP.x3,
          padding: SP.x8, background: SURF.rail, border: `1px solid ${LINE.edge}`, borderRadius: R.panel,
        }}>
          <span aria-hidden="true" style={{ fontSize: 40, opacity: 0.4 }}>🧭</span>
          <h3 style={{ ...T.hero, fontSize: FS.h3, margin: 0 }}>Entre para abrir o ateliê</h3>
          <p style={{ ...T.meta, margin: 0, maxWidth: "48ch" }}>
            Os mapas-múndi ficam guardados na sua conta, privados — só você lê o que está
            escondido neles.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Mapas-Múndi" style={{ display: "flex", flexDirection: "column", gap: SP.x4 }}>
      <AtelierStyles />

      {aberto ? (
        <MoldeDetalhe
          molde={aberto}
          uid={uid}
          limiteNos={limiteNos}
          onVoltar={() => setAbertoId(null)}
          onRenomear={() => setModal({ modo: "renomear", molde: aberto })}
          onExcluir={() => setExcluindo(aberto)}
        />
      ) : (
        <>
          {/* ── Barra de título e ação ─────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: SP.x3, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <h2 style={{ ...T.hero, fontSize: FS.h3, margin: 0 }}>Mapas-Múndi</h2>
              <div style={{ ...T.meta, marginTop: 2 }}>
                O mundo por cima da mesa — seus moldes, privados, prontos para levar a qualquer campanha.
              </div>
            </div>
            <button type="button" className="wm-focus" onClick={abrirCriacao}
              aria-disabled={cota.ok ? undefined : "true"}
              title={cota.ok ? undefined : motivoDaCota(cota, plan)}
              style={{ ...btnStyle("primary"), flexShrink: 0, opacity: cota.ok ? 1 : 0.55 }}>
              + Novo mapa-múndi
            </button>
          </div>

          {/* ── Cota (AC-3): o limite explica o caminho ─────────────── */}
          {!cota.ok && (
            <div role="status" style={{
              display: "flex", alignItems: "flex-start", gap: SP.x3, padding: SP.x4,
              background: "rgba(201,168,76,0.08)", border: "1px solid var(--border2)",
              borderRadius: R.card,
            }}>
              <span aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }}>🔒</span>
              <div>
                <div style={{ ...T.section, fontSize: 10, marginBottom: SP.x1 }}>Limite do plano</div>
                <div style={{ ...T.meta, color: "var(--text)" }}>{motivoDaCota(cota, plan)}</div>
                <div style={{ ...T.meta, marginTop: SP.x2 }}>
                  Assine o plano do seu sistema em <strong>Planos</strong> para ter mapas ilimitados —
                  ou exclua um mapa que não usa mais para abrir espaço.
                </div>
              </div>
            </div>
          )}

          {/* ── Falha de leitura ───────────────────────────────────── */}
          {error && (
            <div role="alert" style={{
              padding: SP.x4, borderRadius: R.card,
              background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
              ...T.meta, color: "var(--text)",
            }}>
              <strong>Os mapas não carregaram. </strong>{mensagemDeErro(error)}
            </div>
          )}

          {/* ── Conteúdo ───────────────────────────────────────────── */}
          {loading && lista.length === 0 ? (
            <Esqueleto />
          ) : lista.length === 0 ? (
            <Vazio onCriar={abrirCriacao} bloqueado={!cota.ok} motivo={motivoDaCota(cota, plan)} />
          ) : (
            <div className="wm-grid">
              {lista.map((m) => (
                <MoldeCard
                  key={m.id}
                  molde={m}
                  onAbrir={(x) => { setAviso(""); setFalha(""); setAbertoId(x.id); }}
                  onRenomear={(x) => setModal({ modo: "renomear", molde: x })}
                  onExcluir={(x) => setExcluindo(x)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Avisos do ateliê (fora do detalhe e da lista) ─────────── */}
      {falha ? (
        <div role="alert" style={{
          padding: SP.x3, borderRadius: R.card,
          background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
          ...T.meta, color: "var(--text)",
        }}>{falha}</div>
      ) : null}

      {aviso ? (
        <div role="status" style={{
          padding: SP.x3, borderRadius: R.card,
          background: "rgba(106,170,122,0.12)", border: "1px solid rgba(106,170,122,0.35)",
          ...T.meta, color: "#8fd3a0",
        }}>{aviso}</div>
      ) : null}

      {modal ? (
        <MoldeModal
          modo={modal.modo}
          molde={modal.molde}
          onFechar={() => setModal(null)}
          onSalvar={modal.modo === "criar" ? criar : renomear}
        />
      ) : null}

      {excluindo ? (
        <ConfirmarExclusao
          molde={excluindo}
          onFechar={() => setExcluindo(null)}
          onConfirmar={excluir}
        />
      ) : null}
    </section>
  );
}

/* ── MOTIVO DA COTA ───────────────────────────────────────────────────
 * `canCreateMap` já devolve `motivo` em português; quando não devolve, a
 * frase é montada a partir do `limite`. O mestre nunca vê "false". */
export function motivoDaCota(cota, plan) {
  if (!cota || cota.ok) return "";
  if (cota.motivo) return cota.motivo;
  const limite = cota.limite;
  const quantos = Number.isFinite(limite)
    ? (limite === 1 ? "1 mapa-múndi" : `${limite} mapas-múndi`)
    : "o número de mapas do seu plano";
  return `O plano ${plan === "free" ? "gratuito" : "atual"} permite ${quantos}.`;
}
