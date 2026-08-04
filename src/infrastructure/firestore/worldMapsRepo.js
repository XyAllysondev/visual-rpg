/**
 * Agregado Mapa-Múndi — lado ATELIÊ: `users/{uid}/worldmaps/{mapId}` e as subcoleções
 * `nodes`, `edges`, `events` e `media` do molde.
 *
 * Substitui as chamadas diretas ao SDK que viviam em
 * `components/WorldMap/worldMapStore.js` (spec 0030, onda 1.5 do ADR-0010).
 *
 * ## O ateliê É o mecanismo de segredo — não troque os caminhos
 * O molde mora sob o USUÁRIO, onde as rules negam leitura a qualquer outro uid. O que a
 * mesa enxerga é outra coisa: uma instância em `campaigns/{cid}/worldmaps`, com só o que
 * foi revelado, e cujo dono é o `mesaStore`. Toda função daqui usa os caminhos `atelie*`
 * de `paths.js` — usar um `mesa*` por engano vazaria o mapa inteiro para os jogadores
 * (ADR-0006, spec 0028 AC-1).
 *
 * ## Este repositório é burro de propósito (AC-3)
 * A redução da ilustração em dois estágios, o teto de bytes, o dedup por hash, o cache de
 * módulo e as cotas por plano continuam no `worldMapStore`. Aqui a imagem chega como uma
 * string base64 JÁ pronta e é gravada. Um repositório que soubesse reduzir imagem deixaria
 * de ser porta e viraria uma segunda implementação da feature.
 *
 * ## Nenhuma primitiva do SDK atravessa a borda (AC-4)
 * `DocumentReference`, `QuerySnapshot`, `WriteBatch`, `serverTimestamp()` e `increment()`
 * nascem e morrem aqui. Quem chama fala em ids de string, objetos planos e listas; as
 * escritas em lote entram como operações de alto nível (`apagarMapaEmCascata`,
 * `apagarNoComTrilhas`, `semearGrafo`), não como `WriteBatch` montado de fora.
 *
 * ## Política de erro
 * Tudo é `strict`: o Mapa-Múndi promete que "nada falha em silêncio" e a borda traduz o
 * erro com `MasterSuite/model/erros.js`. A ÚNICA exceção é `lerHashDoFundo`, que o legado
 * já engolia — AC-7 manda preservar a falha silenciosa herdada, não consertá-la.
 */
import {
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch, increment,
} from "firebase/firestore";
import { db, docAt, colAt, comDatasEmMs, NOOP_UNSUBSCRIBE } from "./client";
import {
  userDoc,
  atelieMapsCol, atelieMapDoc,
  atelieNodesCol, atelieNodeDoc,
  atelieEdgesCol, atelieEdgeDoc,
  atelieEventsCol, atelieEventDoc,
  atelieMediaDoc, atelieSubCol,
  FUNDO_DOC_ID,
} from "./paths";

/** Limite duro do Firestore: 500 operações por `writeBatch`. */
export const BATCH_LIMIT = 500;

/**
 * Campos de data do agregado: os mesmos no molde e nas subcoleções `nodes`, `edges` e
 * `events` — todos carimbados com `createdAt`/`updatedAt` pelas escritas deste arquivo.
 * (`media/background` só tem `updatedAt`, e ele nunca sai daqui: `lerFundo` devolve a string.)
 */
const CAMPOS_DE_DATA = ["createdAt", "updatedAt"];

/**
 * `serverTimestamp()` chega `null` no snapshot local (latency compensation) até o servidor
 * confirmar — o que jogaria o mapa recém-criado para o FIM da lista ordenada por
 * `updatedAt`. `serverTimestamps:"estimate"` entrega uma estimativa local no lugar do
 * `null`. Herdado do store; mudar isto muda o que a grade do ateliê mostra.
 *
 * DÍVIDA QUITADA (spec 0032 AC-5): a data sai daqui como epoch-ms NUMÉRICO, nunca mais como
 * `Timestamp` do SDK. A normalização roda DEPOIS da estimativa, sobre o valor estimado — o
 * `serverTimestamps:"estimate"` continua indispensável e não pode ser removido, senão o campo
 * volta a ser `null` no snapshot otimista e o mapa recém-criado cai para o fim da grade.
 */
const paraLista = (snap) =>
  snap.docs.map((d) => ({
    id: d.id,
    ...comDatasEmMs(d.data({ serverTimestamps: "estimate" }), CAMPOS_DE_DATA),
  }));

/** Número finito e não-negativo, ou o padrão. Cópia da régua do store (não há segunda). */
const comoNumero = (valor, padrao = 0) =>
  (Number.isFinite(valor) && valor >= 0 ? valor : padrao);

/**
 * Aplica operações em lotes de no máximo `BATCH_LIMIT`. `ops` é uma lista de
 * `{ type: 'set'|'update'|'delete', ref, data }` montada AQUI DENTRO — o `WriteBatch` e as
 * `DocumentReference` não saem do módulo. A ordem é preservada: o que precisa acontecer
 * por último deve vir por último.
 */
async function commitOps(ops) {
  if (!ops.length) return;
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      if (op.type === "delete") batch.delete(op.ref);
      else if (op.type === "update") batch.update(op.ref, op.data);
      else batch.set(op.ref, op.data);
    }
    // Sequencial de propósito: lotes são atômicos entre si, não em conjunto.
    await batch.commit(); // eslint-disable-line no-await-in-loop
  }
}

/**
 * O `increment` do SDK, com degradação honesta.
 *
 * Existe porque o dublê de `firebase/firestore` de uma suíte pode não trazer o `increment`.
 * Sem ele, cai no valor absoluto que quem chamou já tem em mãos — o contador continua
 * certo, só perde a proteção contra duas abas gravando ao mesmo tempo. Fica AQUI e não no
 * store porque `increment()` é FieldValue: não pode atravessar a borda (AC-4).
 */
function passoDaContagem(delta, absoluto) {
  if (typeof increment === "function") return increment(delta);
  return Math.max(0, comoNumero(absoluto, 0) + delta);
}

/* ── Molde (doc raiz do mapa) ────────────────────────────────────────────── */

/**
 * Quantos moldes o mestre tem. Só CONTA — comparar com o teto do plano é do store
 * (`model/quotas.js`), e a decisão de cancelar a criação quando esta leitura falha
 * também.
 * @policy strict @returns {Promise<number>}
 */
export async function contarMapas(uid) {
  if (!uid) return 0;
  const snap = await getDocs(colAt(atelieMapsCol(uid)));
  return snap.size;
}

/**
 * Cria o molde e devolve o id novo. `createdAt`/`updatedAt` são carimbados aqui —
 * `serverTimestamp()` é FieldValue do SDK e não pode ser montado pela borda (AC-4).
 * @param {object} campos documento JÁ validado e normalizado pelo store.
 * @policy strict @returns {Promise<string>}
 */
export async function criarMapa(uid, campos) {
  const ref = await addDoc(colAt(atelieMapsCol(uid)), {
    ...campos,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Atualização parcial do doc raiz. Todo caminho de escrita passa por aqui para que
 * `updatedAt` — que é o que ordena a lista do ateliê — nunca fique para trás.
 * @param {object} campos campos JÁ prontos, sem FieldValue.
 * @policy strict
 */
export async function atualizarMapa(uid, mapId, campos = {}) {
  await updateDoc(docAt(atelieMapDoc(uid, mapId)), { ...campos, updatedAt: serverTimestamp() });
}

/**
 * Envelhece o molde sem mudar mais nada. É o que mantém o mapa no topo da lista quando o
 * que mudou foi um nó, uma trilha ou um evento — documentos que vivem nas subcoleções.
 * @policy strict
 */
export async function tocarMapa(uid, mapId) {
  await atualizarMapa(uid, mapId, {});
}

/**
 * Lê um molde avulso. `null` quando não existe.
 *
 * Sem `serverTimestamps:"estimate"` de propósito: quem chama abre UM mapa, não ordena
 * uma lista — é o comportamento herdado do store (AC-7). As datas ainda passam pelo
 * normalizador da spec 0032 (AC-5): sem estimativa o campo pode chegar `null`, e `null`
 * atravessa como `null` — o que sai daqui nunca é `Timestamp` do SDK.
 * @policy strict @returns {Promise<object|null>}
 */
export async function lerMapa(uid, mapId) {
  if (!uid || !mapId) return null;
  const snap = await getDoc(docAt(atelieMapDoc(uid, mapId)));
  return snap.exists() ? { id: snap.id, ...comDatasEmMs(snap.data(), CAMPOS_DE_DATA) } : null;
}

/**
 * Apaga o molde e TODAS as suas subcoleções. O Firestore não apaga subcoleção em cascata —
 * a varredura é nossa, e é por isso que ela mora no repositório: `d.ref` é
 * `DocumentReference`, e sair daqui com ela na mão quebraria o AC-4.
 *
 * A ordem importa: o molde sai por ÚLTIMO. Se a varredura falhar no meio, o mestre ainda
 * vê o mapa na lista e tenta de novo, em vez de ficar com órfãos invisíveis.
 *
 * O documento de mídia entra no mesmo lote sem leitura prévia — o id é fixo, e apagar
 * documento inexistente é no-op no Firestore.
 *
 * @param {string[]} subcolecoes nomes das filhas a varrer, na ordem.
 * @policy strict
 */
export async function apagarMapaEmCascata(uid, mapId, subcolecoes = []) {
  const ops = [];
  for (const nome of subcolecoes) {
    const snap = await getDocs(colAt(atelieSubCol(uid, mapId, nome))); // eslint-disable-line no-await-in-loop
    snap.docs.forEach((d) => ops.push({ type: "delete", ref: d.ref }));
  }
  ops.push({ type: "delete", ref: docAt(atelieMediaDoc(uid, mapId, FUNDO_DOC_ID)) });
  ops.push({ type: "delete", ref: docAt(atelieMapDoc(uid, mapId)) });
  await commitOps(ops);
}

/**
 * Assina os moldes do mestre, do mais recente para o mais antigo.
 *
 * Não loga o erro: quem chama (`useWorldMaps`) o expõe cru na tela, e um `console.error`
 * aqui só duplicaria o rastro. `orderBy('updatedAt')` sozinho numa subcoleção NÃO exige
 * índice composto — a posse está no caminho do documento, não num campo.
 *
 * @param {(maps: object[]) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function observarMapas(uid, onChange, onError) {
  if (!uid) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    query(colAt(atelieMapsCol(uid)), orderBy("updatedAt", "desc")),
    (snap) => onChange(paraLista(snap)),
    (e) => { if (onError) onError(e); },
  );
}

/* ── Ilustração de fundo (`media/background`) ────────────────────────────── */

/**
 * Hash da ilustração já gravada, para o dedup do store. `null` quando não há fundo.
 *
 * @policy silent — fallback `null` (o store apenas DESLIGA o dedup e sobe a imagem de
 * novo). Loga com `console.warn`, e não com o envelope `silent()` do `client.js`, porque
 * era assim que o legado avisava: a suíte do `worldMapStore` cobra o `warn`, e AC-7 manda
 * preservar o comportamento herdado — inclusive o do log.
 *
 * @returns {Promise<string|null>}
 */
export async function lerHashDoFundo(uid, mapId) {
  try {
    const snap = await getDoc(docAt(atelieMediaDoc(uid, mapId, FUNDO_DOC_ID)));
    return snap.exists() ? (snap.data()?.hash ?? null) : null;
  } catch (e) {
    console.warn("[worldMapsRepo.lerHashDoFundo] não deu para conferir o fundo atual (dedup desligado):", e);
    return null;
  }
}

/**
 * Grava a ilustração cheia no documento SEPARADO de mídia.
 *
 * Separado do doc raiz não é estilo: o raiz é o que `useWorldMaps` assina em tempo real, e
 * uma ilustração de ~900 KB lá dentro faria a grade do ateliê baixar todos os fundos a
 * cada snapshot.
 *
 * @param {object} campos ilustração JÁ reduzida e medida pelo store (`data`, `hash`,
 *   `width`, `height`, `bytes`). O repositório não reduz nada (AC-3).
 * @policy strict
 */
export async function gravarFundo(uid, mapId, campos) {
  await setDoc(docAt(atelieMediaDoc(uid, mapId, FUNDO_DOC_ID)), {
    ...campos,
    updatedAt: serverTimestamp(),
  });
}

/**
 * A ilustração cheia, sob demanda. `null` quando o mapa não tem fundo em base64 (nunca
 * subiu, ou o fundo está no Storage e mora em `backgroundUrl`).
 *
 * O cache de módulo que evita reler ~900 KB fica no store — é política de UI.
 * @policy strict @returns {Promise<string|null>}
 */
export async function lerFundo(uid, mapId) {
  if (!uid || !mapId) return null;
  const snap = await getDoc(docAt(atelieMediaDoc(uid, mapId, FUNDO_DOC_ID)));
  return snap.exists() ? (snap.data()?.data || null) : null;
}

/* ── Perfil do mestre (marca de dispensa do mapa padrão) ─────────────────── */

/**
 * Assina o documento de perfil. Entrega os dados CRUS (ou `null` se o doc não existe) —
 * quem interpreta é `model/mapaPadrao.padraoDispensado`, que é a régua única.
 *
 * @param {(dados: object|null) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function observarPerfil(uid, onChange, onError) {
  if (!uid) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    docAt(userDoc(uid)),
    (snap) => onChange(snap.exists() ? snap.data() : null),
    (e) => { if (onError) onError(e); },
  );
}

/**
 * Marca (ou apaga) a dispensa do mapa padrão no perfil do mestre.
 *
 * `setDoc(..., {merge:true})` e não `updateDoc`: o documento de perfil pode não existir
 * ainda (conta antiga), e `updateDoc` falha em documento inexistente. O merge cria só o
 * campo, sem encostar em `plan` nem em `subscribedSystems` — o que é também o que faz a
 * escrita passar tanto na regra de `create` quanto na de `update`.
 *
 * Os NOMES dos campos vêm de fora (`model/mapaPadrao.js`) de propósito: o vocabulário do
 * domínio é de lá; o que é da infraestrutura é só o carimbo de data.
 *
 * @param {string} campoValor nome do campo booleano.
 * @param {string} campoData nome do campo de data (recebe `serverTimestamp()` ou `null`).
 * @policy strict
 */
export async function marcarDispensaDoPadrao(uid, campoValor, campoData, valor) {
  await setDoc(
    docAt(userDoc(uid)),
    { [campoValor]: valor, [campoData]: valor ? serverTimestamp() : null },
    { merge: true },
  );
}

/* ── Grafo do molde: nós e trilhas ───────────────────────────────────────── */

/**
 * Planta um nó na subcoleção `nodes`. Um documento por item, nunca um array no doc do
 * mapa — é o que permite 500 nós, mover UM nó gravando UM documento, e a projeção da F4
 * copiar documento a documento.
 * @param {object} campos nó JÁ validado por `model/graph.criarNo`, sem o `id`.
 * @policy strict @returns {Promise<string>} id do nó criado.
 */
export async function adicionarNo(uid, mapId, campos) {
  const ref = await addDoc(colAt(atelieNodesCol(uid, mapId)), {
    ...campos,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Altera campos de um nó. Não mexe em `nodeCount`: a quantidade não mudou. @policy strict */
export async function atualizarNo(uid, mapId, nodeId, campos) {
  await updateDoc(docAt(atelieNodeDoc(uid, mapId, nodeId)), {
    ...campos,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Mexe no contador denormalizado do doc raiz — o número que a cota (AC-3) e as rules
 * consultam sem varrer a subcoleção.
 *
 * @param {number} delta +1 ao plantar, -1 ao remover.
 * @param {number} absoluto contagem que o chamador já tem em mãos, usada só quando o
 *   `increment()` do SDK não está disponível (ver `passoDaContagem`).
 * @policy strict
 */
export async function ajustarContagemDeNos(uid, mapId, delta, absoluto) {
  await updateDoc(docAt(atelieMapDoc(uid, mapId)), {
    nodeCount: passoDaContagem(delta, absoluto),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Todas as trilhas do molde. É a varredura de segurança de `deleteNode` quando a tela não
 * tem a lista em mãos — o Firestore não faz `OR` entre dois campos numa query.
 * @policy strict @returns {Promise<object[]>}
 */
export async function listarTrilhas(uid, mapId) {
  if (!uid || !mapId) return [];
  const snap = await getDocs(colAt(atelieEdgesCol(uid, mapId)));
  return paraLista(snap);
}

/**
 * Apaga um nó, as trilhas indicadas e ajusta o contador — TUDO no mesmo lote: ou o nó e as
 * trilhas somem juntos, ou nada some. Trilha órfã não sobrevive a um nó apagado.
 *
 * QUAIS trilhas tocam o nó é decisão do store (`model/graph.pontasDaTrilha`); aqui chegam
 * só os ids.
 *
 * @param {{trilhaIds?: string[], contagem?: {delta:number, absoluto:number}}} opcoes
 * @policy strict
 */
export async function apagarNoComTrilhas(uid, mapId, nodeId, opcoes = {}) {
  const { trilhaIds = [], contagem = { delta: -1, absoluto: 0 } } = opcoes;
  const ops = trilhaIds.map((edgeId) => ({
    type: "delete",
    ref: docAt(atelieEdgeDoc(uid, mapId, edgeId)),
  }));
  ops.push({ type: "delete", ref: docAt(atelieNodeDoc(uid, mapId, nodeId)) });
  ops.push({
    type: "update",
    ref: docAt(atelieMapDoc(uid, mapId)),
    data: {
      nodeCount: passoDaContagem(contagem.delta, contagem.absoluto),
      updatedAt: serverTimestamp(),
    },
  });
  await commitOps(ops);
}

/**
 * Liga dois nós. A recusa de autoligação e de duplicata é do `model/graph.js` — chega aqui
 * só o que já passou pela régua.
 * @policy strict @returns {Promise<string>} id da trilha criada.
 */
export async function adicionarTrilha(uid, mapId, campos) {
  const ref = await addDoc(colAt(atelieEdgesCol(uid, mapId)), {
    ...campos,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Altera campos de uma trilha. @policy strict */
export async function atualizarTrilha(uid, mapId, edgeId, campos) {
  await updateDoc(docAt(atelieEdgeDoc(uid, mapId, edgeId)), {
    ...campos,
    updatedAt: serverTimestamp(),
  });
}

/** Apaga uma trilha. Os nós continuam onde estavam. @policy strict */
export async function apagarTrilha(uid, mapId, edgeId) {
  await deleteDoc(docAt(atelieEdgeDoc(uid, mapId, edgeId)));
}

/**
 * Grava um grafo inteiro de uma vez, com ids explícitos — é o que a cópia do mapa padrão
 * precisa (AC-13). Em bloco, e não um `addDoc` por vez, para o mapa não ficar meio semeado
 * se a rede cair no meio.
 *
 * Os nós vão ANTES das trilhas: mesma ordem do legado, e a que faz sentido para quem lê o
 * lote depois.
 *
 * @param {{nos?: {id:string, dados:object}[], trilhas?: {id:string, dados:object}[],
 *          nodeCount?: number}} grafo itens JÁ filtrados por quem chama (sem id, sem doc).
 * @policy strict
 */
export async function semearGrafo(uid, mapId, grafo = {}) {
  const { nos = [], trilhas = [], nodeCount = 0 } = grafo;
  const carimbo = () => ({ createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  const ops = [
    ...nos.map(({ id, dados }) => ({
      type: "set",
      ref: docAt(atelieNodeDoc(uid, mapId, id)),
      data: { ...dados, ...carimbo() },
    })),
    ...trilhas.map(({ id, dados }) => ({
      type: "set",
      ref: docAt(atelieEdgeDoc(uid, mapId, id)),
      data: { ...dados, ...carimbo() },
    })),
    {
      type: "update",
      ref: docAt(atelieMapDoc(uid, mapId)),
      data: { nodeCount, updatedAt: serverTimestamp() },
    },
  ];
  await commitOps(ops);
}

/**
 * Assina os nós do molde. Sem `query`: a subcoleção inteira, como o legado.
 * @returns {() => void} unsubscribe
 */
export function observarNos(uid, mapId, onChange, onError) {
  if (!uid || !mapId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    colAt(atelieNodesCol(uid, mapId)),
    (snap) => onChange(paraLista(snap)),
    (e) => { if (onError) onError(e); },
  );
}

/**
 * Assina as trilhas do molde. Assinatura separada da dos nós porque o Firestore não junta
 * subcoleções num listener só — quem decide quando o grafo está "completo" é o hook.
 * @returns {() => void} unsubscribe
 */
export function observarTrilhas(uid, mapId, onChange, onError) {
  if (!uid || !mapId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    colAt(atelieEdgesCol(uid, mapId)),
    (snap) => onChange(paraLista(snap)),
    (e) => { if (onError) onError(e); },
  );
}

/* ── Eventos do molde ────────────────────────────────────────────────────── */

/**
 * Ancora um evento no molde.
 *
 * O evento é o documento com DUAS caras — a que o grupo lê e a que só o mestre vê. As duas
 * moram no mesmo documento, e é seguro justamente porque este caminho é o do ateliê. O que
 * vai para a campanha é a projeção por lista branca do `mesaStore`.
 * @policy strict @returns {Promise<string>} id do evento criado.
 */
export async function adicionarEvento(uid, mapId, campos) {
  const ref = await addDoc(colAt(atelieEventsCol(uid, mapId)), {
    ...campos,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Altera campos de um evento. @policy strict */
export async function atualizarEvento(uid, mapId, eventId, campos) {
  await updateDoc(docAt(atelieEventDoc(uid, mapId, eventId)), {
    ...campos,
    updatedAt: serverTimestamp(),
  });
}

/** Apaga um evento. Nós e trilhas continuam onde estavam. @policy strict */
export async function apagarEvento(uid, mapId, eventId) {
  await deleteDoc(docAt(atelieEventDoc(uid, mapId, eventId)));
}

/**
 * Assina os eventos do molde. A mesa do jogador NUNCA assina isto — só o cliente do
 * mestre, que é o dono do documento.
 * @returns {() => void} unsubscribe
 */
export function observarEventos(uid, mapId, onChange, onError) {
  if (!uid || !mapId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    colAt(atelieEventsCol(uid, mapId)),
    (snap) => onChange(paraLista(snap)),
    (e) => { if (onError) onError(e); },
  );
}
