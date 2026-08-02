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

import { useCallback, useMemo, useState } from "react";
import {
  useWorldMaps, createWorldMap, updateWorldMap, deleteWorldMap, semearGrafo,
  useMapaPadraoDispensado, dispensarMapaPadrao, restaurarMapaPadrao,
} from "../worldMapStore";
import { canAddNode, canCreateMap } from "../model/quotas";
import {
  MAPA_PADRAO_ID, ehMapaPadrao, listaComPadrao, contarParaCota, clonarMapaPadrao,
} from "../model/mapaPadrao";
import CartografiaPadrao from "../model/CartografiaPadrao";
import AtelierStyles from "./AtelierStyles";
import MoldeModal from "./MoldeModal";
import ConfirmarExclusao from "./ConfirmarExclusao";
import MoldeDetalhe, { urlDoFundo } from "./MoldeDetalhe";
import {
  SP, R, FS, T, SURF, LINE, HIT, btnStyle, contarNos, tempoRelativo, mensagemDeErro,
} from "./ui";

/** Rótulo do botão que traz o padrão de volta. Usado em dois lugares — um só texto. */
export const RESTAURAR_PADRAO = "Trazer o mapa padrão de volta";

/* ── CARD DO MOLDE ───────────────────────────────────────────────────
 * O card NÃO é um botão só: abrir, renomear e excluir são três ações e
 * botão dentro de botão é HTML inválido (e leitor de tela se perde). O
 * invólucro é um <article>; dentro dele, o botão de abrir ocupa a área
 * grande e as ações moram numa linha própria.
 *
 * O MAPA PADRÃO usa o MESMO card (AC-13): a oferta do sistema não pode
 * parecer objeto de segunda classe. Muda só o que precisa mudar — a
 * miniatura é a carta vetorial em vez de uma imagem, o selo diz de onde
 * ele veio, e "Renomear" (que exigiria um documento) dá lugar a "Usar
 * como base". O botão de excluir é igualzinho, com o mesmo rótulo
 * acessível: o mestre tira o padrão da lista pela mesma afordância dos
 * outros mapas. A conversa diferente acontece na confirmação. */
function MoldeCard({ molde, onAbrir, onRenomear, onExcluir, onUsarComoBase }) {
  const fundo = urlDoFundo(molde);
  const padrao = ehMapaPadrao(molde.id);
  return (
    <article className="wm-card" style={{
      display: "flex", flexDirection: "column",
      background: SURF.card,
      border: `1px solid ${padrao ? LINE.gold : LINE.raise}`,
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
          position: "relative", height: 116, overflow: "hidden", background: fundo
            ? `center/cover no-repeat url("${fundo}")`
            : "linear-gradient(150deg,rgba(201,168,76,0.10),rgba(176,48,216,0.08))",
          borderBottom: `1px solid ${LINE.hair}`,
        }}>
          {/* A arte do padrão é vetorial e mora no app: o card mostra a carta de
              verdade em vez de "sem ilustração" (AC-13). `idPrefix` próprio para
              não colidir com a carta grande quando o molde está aberto. */}
          {padrao && !fundo ? (
            <CartografiaPadrao
              idPrefix="wm-card-padrao" aria-hidden="true" focusable="false"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
          {!fundo && !padrao && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center",
              justifyContent: "center", gap: SP.x2, ...T.meta, fontSize: FS.micro,
            }}>
              <span aria-hidden="true" style={{ fontSize: 22, opacity: 0.5 }}>🗺️</span>
              sem ilustração
            </div>
          )}
          {padrao ? (
            <span style={{
              position: "absolute", top: SP.x2, left: SP.x2,
              padding: `2px ${SP.x2}px`, borderRadius: R.pill,
              background: "rgba(10,10,15,0.78)", border: `1px solid ${LINE.gold}`,
              ...T.btn, fontSize: FS.micro, color: "var(--gold)",
            }}>
              já vem no Nexus
            </span>
          ) : null}
        </div>

        <div style={{ padding: `${SP.x3}px ${SP.x4}px ${SP.x2}px` }}>
          <div style={{ ...T.cardTitle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {molde.name || "Sem nome"}
          </div>
          <div style={{ ...T.data, marginTop: SP.x1 }}>
            {contarNos(molde.nodeCount)} · {padrao ? "pronto para usar" : tempoRelativo(molde.updatedAt)}
          </div>
        </div>
      </button>

      <div style={{
        display: "flex", gap: SP.x2, padding: `0 ${SP.x3}px ${SP.x3}px`, marginTop: "auto",
      }}>
        {padrao ? (
          <button type="button" className="wm-focus wm-act" onClick={() => onUsarComoBase(molde)}
            aria-label={`Usar ${molde.name || "o mapa padrão"} como base de um mapa seu`}
            style={{ ...btnStyle("quiet", "sm"), flex: 1 }}>
            Usar como base
          </button>
        ) : (
          <button type="button" className="wm-focus wm-act" onClick={() => onRenomear(molde)}
            aria-label={`Renomear ${molde.name || "mapa sem nome"}`}
            style={{ ...btnStyle("quiet", "sm"), flex: 1 }}>
            Renomear
          </button>
        )}
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
 * mecânica em duas frases e oferece a única saída que importa.
 *
 * Ele aparece sempre que o mestre não tem mapa PRÓPRIO — inclusive quando
 * o mapa padrão está logo abaixo, porque o card do padrão mostra um mapa
 * pronto mas não ensina o que a coisa faz na sessão. O que muda com o
 * padrão à mostra é só o título: dizer "nenhum mapa-múndi ainda" com um
 * mapa jogável na tela seria falso.
 *
 * Com o padrão DISPENSADO, o vazio é o lugar onde a volta atrás mora
 * (AC-13): descartar por engano não pode custar o conteúdo para sempre, e
 * este é o primeiro lugar onde o mestre vai procurar. */
function Vazio({ onCriar, bloqueado, motivo, padraoAMostra, onRestaurar }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      gap: SP.x3, padding: `${SP.x10}px ${SP.x5}px`,
      background: SURF.rail, border: `1px solid ${LINE.edge}`, borderRadius: R.panel,
    }}>
      <span aria-hidden="true" style={{ fontSize: 46, opacity: 0.4 }}>🧭</span>
      <h3 style={{ ...T.hero, fontSize: FS.h3, margin: 0 }}>
        {padraoAMostra ? "Comece pelo mapa que já vem pronto" : "Nenhum mapa-múndi ainda"}
      </h3>
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

      {!padraoAMostra && onRestaurar ? (
        <>
          <div style={{ ...T.meta, fontSize: FS.micro, maxWidth: "48ch" }}>
            Você tirou o mapa padrão da lista. Ele continua inteiro — é só pedir de volta.
          </div>
          <button type="button" className="wm-focus" onClick={onRestaurar}
            style={{ ...btnStyle("ghost", "sm"), minHeight: HIT.mobile }}>
            {RESTAURAR_PADRAO}
          </button>
        </>
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
  const meusMapas = useMemo(() => (Array.isArray(maps) ? maps : []), [maps]);

  /* A marca de dispensa do padrão mora no perfil do mestre (AC-13). Falha de
   * leitura devolve `dispensado: false` — o padrão continua à mostra, e o erro
   * vira frase logo abaixo em vez de sumiço silencioso. */
  const { dispensado, error: erroPreferencia } = useMapaPadraoDispensado(uid);

  /* A lista que a tela mostra = mapas do mestre + o padrão, quando ele não foi
   * dispensado. Quem monta é `model/mapaPadrao.js`, lógica pura e testada. */
  const lista = useMemo(
    () => listaComPadrao(meusMapas, { dispensado }),
    [meusMapas, dispensado],
  );

  const [modal, setModal] = useState(null);        // null | {modo:'criar'} | {modo:'renomear',molde}
  const [excluindo, setExcluindo] = useState(null);
  const [abertoId, setAbertoId] = useState(null);
  const [aviso, setAviso] = useState("");
  const [falha, setFalha] = useState("");
  const [clonando, setClonando] = useState(false);

  /* Cota é lógica pura — a UI só a lê e explica (AC-3).
   *
   * A contagem passa por `contarParaCota`, NÃO por `lista.length`: o mapa padrão
   * não é documento do mestre e não pode ocupar a única vaga do plano free
   * (AC-13). Com o padrão à mostra, o mestre free continua podendo criar o dele. */
  const quantosContam = useMemo(() => contarParaCota(lista), [lista]);

  const cota = useMemo(() => {
    try { return canCreateMap(plan, quantosContam) || { ok: true }; }
    catch { return { ok: true }; }
  }, [plan, quantosContam]);

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

  /* ── Excluir ────────────────────────────────────────────────────────
   * Duas ações atrás do mesmo botão, e é de propósito (AC-13): para o mestre,
   * tirar o padrão da lista é a mesma afordância de excluir qualquer mapa. O que
   * acontece por baixo é diferente — um apaga documentos, o outro grava uma
   * preferência —, e a confirmação já disse qual dos dois é. */
  const excluir = async () => {
    const alvo = excluindo;
    if (!alvo) return;
    if (ehMapaPadrao(alvo.id)) {
      await dispensarMapaPadrao(uid);
      setExcluindo(null);
      if (abertoId === alvo.id) setAbertoId(null);
      setAviso(
        "O mapa padrão saiu da sua lista. Nada foi apagado — use "
        + `“${RESTAURAR_PADRAO}” para trazê-lo de volta quando quiser.`,
      );
      return;
    }
    await deleteWorldMap(uid, alvo.id);
    setExcluindo(null);
    if (abertoId === alvo.id) setAbertoId(null);
    setAviso(`"${alvo.name || "Mapa"}" excluído.`);
  };

  /* ── Restaurar ──────────────────────────────────────────────────────
   * A volta atrás é caminho de primeira classe, não conserto escondido. */
  const restaurar = useCallback(async () => {
    setFalha("");
    setAviso("");
    try {
      await restaurarMapaPadrao(uid);
      setAviso("O mapa padrão voltou para a sua lista.");
    } catch (err) {
      console.error("[ateliê] não deu para restaurar o mapa padrão:", err);
      setFalha(`O mapa padrão não voltou. ${mensagemDeErro(err)}`);
    }
  }, [uid]);

  /* ── Cópia ao usar (AC-13) ──────────────────────────────────────────
   * O padrão é código e é somente leitura. Para mexer, o mestre leva uma CÓPIA
   * — que é mapa dele, com id do Firestore, exclusão normal e, aí sim, cota.
   * A ordem importa: cria o documento, semeia o grafo, e só então abre. Se o
   * semeio falhar, o mapa fica na lista vazio e o mestre vê o porquê — nunca um
   * mapa aberto que finge ter doze lugares. */
  const usarComoBase = useCallback(async () => {
    if (clonando) return; // dois cliques não podem virar dois mapas
    setFalha("");
    setAviso("");
    if (!cota.ok) { setFalha(motivoDaCota(cota, plan)); return; }
    setClonando(true);
    let novoId = "";
    try {
      const { mapa } = clonarMapaPadrao();
      novoId = await createWorldMap(uid, {
        name: mapa.name,
        description: mapa.description,
        plan,
        width: mapa.width,
        height: mapa.height,
        fogEnabled: mapa.fogEnabled,
        defaultRevealRadius: mapa.defaultRevealRadius,
        origem: MAPA_PADRAO_ID,
      });
      /* O prefixo sai do id do documento: dois clones do mesmo mestre nunca
       * colidem, mesmo criados no mesmo segundo. */
      const { nos, trilhas, mapa: clonado } = clonarMapaPadrao({ prefixo: novoId });
      await semearGrafo(uid, novoId, { nos, trilhas });
      if (clonado.startNodeId) {
        await updateWorldMap(uid, novoId, { startNodeId: clonado.startNodeId });
      }
      setAviso("Cópia criada. Este mapa é seu: mexa à vontade, o original continua intacto.");
      setAbertoId(novoId);
    } catch (err) {
      console.error("[ateliê] a cópia do mapa padrão falhou:", err);
      setFalha(
        novoId
          ? `O mapa foi criado, mas os lugares e as trilhas não entraram. ${mensagemDeErro(err)}`
          : `Não deu para copiar o mapa padrão. ${mensagemDeErro(err)}`,
      );
    } finally {
      setClonando(false);
    }
  }, [clonando, cota, plan, uid]);

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
          /* O plano vai explícito: sem ele, o editor reconstrói o plano a partir do
           * teto de nós (500 ⇒ pago), heurística que quebra em silêncio se a cota
           * mudar. Com a prop, o valor real vence. */
          plan={plan}
          limiteNos={limiteNos}
          onVoltar={() => setAbertoId(null)}
          onRenomear={() => setModal({ modo: "renomear", molde: aberto })}
          onExcluir={() => setExcluindo(aberto)}
          onUsarComoBase={usarComoBase}
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
            {/* A volta atrás também mora aqui, e não só no estado vazio: quem já
                tem mapas próprios nunca veria o vazio de novo (AC-13). */}
            {dispensado ? (
              <button type="button" className="wm-focus" onClick={restaurar}
                style={{ ...btnStyle("quiet", "sm"), flexShrink: 0, minHeight: HIT.mobile }}>
                {RESTAURAR_PADRAO}
              </button>
            ) : null}
            <button type="button" className="wm-focus" onClick={abrirCriacao}
              aria-disabled={cota.ok ? undefined : "true"}
              title={cota.ok ? undefined : motivoDaCota(cota, plan)}
              style={{ ...btnStyle("primary"), flexShrink: 0, opacity: cota.ok ? 1 : 0.55 }}>
              + Novo mapa-múndi
            </button>
          </div>

          {/* ── Preferência ilegível: o padrão fica à mostra, e o mestre
                 sabe por quê. Nada falha em silêncio. ───────────────── */}
          {erroPreferencia ? (
            <div role="status" style={{
              padding: SP.x3, borderRadius: R.card,
              background: "rgba(201,168,76,0.08)", border: "1px solid var(--border2)",
              ...T.meta, color: "var(--text)",
            }}>
              Não deu para conferir suas preferências do ateliê, então o mapa padrão continua à
              mostra. {mensagemDeErro(erroPreferencia)}
            </div>
          ) : null}

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

          {/* ── Conteúdo ─────────────────────────────────────────────
             O painel de boas-vindas aparece enquanto o mestre não tem mapa
             PRÓPRIO — mesmo com o padrão logo abaixo. Um card de mapa pronto
             mostra que existe algo; não explica o que a névoa faz na sessão. */}
          {/* O esqueleto espera os mapas DO MESTRE, não a oferta: mostrar o
              painel de boas-vindas antes de saber se ele já tem cinco mapas
              seria um piscar de tela errado. */}
          {loading && meusMapas.length === 0 ? (
            <Esqueleto />
          ) : (
            <>
              {meusMapas.length === 0 ? (
                <Vazio
                  onCriar={abrirCriacao}
                  bloqueado={!cota.ok}
                  motivo={motivoDaCota(cota, plan)}
                  padraoAMostra={!dispensado}
                  onRestaurar={restaurar}
                />
              ) : null}

              {lista.length > 0 ? (
                <div className="wm-grid">
                  {lista.map((m) => (
                    <MoldeCard
                      key={m.id}
                      molde={m}
                      onAbrir={(x) => { setAviso(""); setFalha(""); setAbertoId(x.id); }}
                      onRenomear={(x) => setModal({ modo: "renomear", molde: x })}
                      onExcluir={(x) => setExcluindo(x)}
                      onUsarComoBase={usarComoBase}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      {/* ── Avisos do ateliê (fora do detalhe e da lista) ─────────── */}
      {clonando ? (
        <div role="status" style={{
          padding: SP.x3, borderRadius: R.card,
          background: "rgba(201,168,76,0.08)", border: "1px solid var(--border2)",
          ...T.meta, color: "var(--text)",
        }}>
          Copiando o mapa padrão para a sua lista…
        </div>
      ) : null}

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
          padrao={ehMapaPadrao(excluindo.id)}
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
