/**
 * Agregado Mundo (Forja do Mestre) — `worlds/{worldId}` e as subcoleções
 * `entities`, `connections`, `folders`.
 *
 * Substitui as 68 chamadas diretas ao SDK que viviam em
 * `src/components/MasterSuite/worldsStore.js` (onda 1.5, spec 0030 AC-3/AC-4).
 *
 * **Este repo é burro de propósito.** A regra da Forja continua no store:
 * validação em PT-BR, derivação de `nameLower`, recusa de autoligação e de
 * duplicata pelos dois lados (`fromId`/`toId`), e a semeadura do mundo demo
 * (a *Coroa de Cinzas*). Aqui só se endereça, lê, escreve e assina.
 *
 * ## Nenhuma primitiva do SDK atravessa a fronteira (AC-4)
 * - `serverTimestamp()` não sai daqui: quem chama marca o campo com o sentinela
 *   {@link SERVER_TIMESTAMP} e o repositório o traduz na hora de gravar.
 * - `DocumentReference` não sai daqui: o lote é uma lista de operações planas
 *   (ver {@link commitBatch}) e o id de documento gerado no cliente sai como
 *   string por {@link newSubDocId}.
 * - `QuerySnapshot` não sai daqui: toda leitura devolve `{ id, ...campos }`.
 * - `watch*` devolve sempre uma função de cancelamento (idempotente).
 *
 * DÍVIDA QUITADA (spec 0032 AC-5): `createdAt` e `updatedAt` saem daqui como **epoch-ms
 * numérico**, nunca mais como `Timestamp` do SDK — era a última primitiva do SDK a atravessar
 * a fronteira (aceita no ADR-0010). A normalização acontece no ponto único onde o documento é
 * achatado ({@link comId} / {@link comIdEstimado}), então toda leitura e toda assinatura do
 * repositório saem normalizadas de graça. Campo AUSENTE continua ausente.
 *
 * ## Política de erro
 * Tudo é `@policy strict`. É o comportamento herdado (AC-7): o store declara
 * "nada falha em silêncio" e os hooks expõem a falha no campo `error`. Engolir
 * aqui faria a Forja mostrar um acervo vazio no lugar de "não deu para ler".
 *
 * @see ../../../docs/architecture/adr/0010-camada-de-infraestrutura.md
 */
import {
  doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, where, orderBy, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db, docAt, colAt, comDatasEmMs, NOOP_UNSUBSCRIBE } from "./client";
import {
  worldsCol, worldDoc, worldSubCol,
  worldEntitiesCol, worldEntityDoc,
  worldConnectionsCol, worldConnectionDoc,
  worldFoldersCol, worldFolderDoc,
} from "./paths";

/** Limite duro do Firestore: 500 operações por `writeBatch`. */
export const BATCH_LIMIT = 500;

/**
 * Sentinela de "carimbe a hora do servidor neste campo".
 *
 * Existe porque `serverTimestamp()` devolve um `FieldValue` do SDK, e um
 * `FieldValue` no objeto que o store monta seria exatamente a primitiva que o
 * AC-4 proíbe atravessar. O store escreve `updatedAt: SERVER_TIMESTAMP` e a
 * tradução acontece aqui, no último instante antes da escrita.
 *
 * É um objeto congelado (e não a string `"__ts__"`) para nunca colidir com um
 * valor de verdade vindo de um formulário.
 */
export const SERVER_TIMESTAMP = Object.freeze({ __fieldValue: "serverTimestamp" });

/* ── Tradução da fronteira ───────────────────────────────────────────────── */

/**
 * Troca cada sentinela {@link SERVER_TIMESTAMP} por um `serverTimestamp()` de
 * verdade. Percorre só o primeiro nível: os carimbos são sempre campos do topo
 * do documento (`createdAt`/`updatedAt`), e descer em listas como `attributes`
 * custaria caro para nada.
 */
function comCarimbos(data) {
  if (!data || typeof data !== "object") return data;
  const saida = {};
  for (const [campo, valor] of Object.entries(data)) {
    saida[campo] = valor === SERVER_TIMESTAMP ? serverTimestamp() : valor;
  }
  return saida;
}

/**
 * Campos de data do agregado Mundo — os mesmos no documento raiz e nas três subcoleções
 * (`entities`, `connections`, `folders`), porque `comCarimbos` só carimba topo de documento.
 */
const CAMPOS_DE_DATA = ["createdAt", "updatedAt"];

/** Documento cru → objeto plano. Leitura avulsa: sem estimativa de carimbo. */
const comId = (d) => ({ id: d.id, ...comDatasEmMs(d.data(), CAMPOS_DE_DATA) });

/**
 * Mesma coisa, para os `watch*`.
 *
 * `serverTimestamp()` chega `null` no snapshot local (latency compensation) até
 * o servidor confirmar — o que jogaria o doc recém-escrito para o FIM de
 * "recentes" e mostraria "—" no tempo relativo. `serverTimestamps:"estimate"`
 * entrega uma estimativa local no lugar do `null`, corrigida no snapshot seguinte.
 *
 * O `serverTimestamps:"estimate"` continua AQUI de propósito depois da spec 0032 AC-5:
 * a normalização para epoch-ms roda DEPOIS dele, sobre a estimativa. Tirá-lo faria o campo
 * voltar a ser `null` no snapshot otimista e mudaria o que a Forja mostra logo após criar
 * um mundo — a normalização preserva o valor, ela não o substitui.
 */
const comIdEstimado = (d) => ({
  id: d.id,
  ...comDatasEmMs(d.data({ serverTimestamps: "estimate" }), CAMPOS_DE_DATA),
});

/**
 * Mesma leitura de `comIdEstimado`, mais o estado de confirmação de CADA mundo.
 *
 * `d.metadata.hasPendingWrites` é `true` enquanto a escrita existe só no cliente.
 * Isso importa fora daqui: a regra de leitura das subcoleções faz `get()` no
 * documento do mundo, que ainda NÃO existe para o servidor, então assinar o
 * acervo de um mundo pendente volta `permission-denied`. Quem consome usa
 * `pendenteNoServidor` para não escolher sozinho um mundo que o servidor ainda
 * não conhece — e é por isso que o campo nasce aqui: `metadata` é do snapshot,
 * e o snapshot não atravessa a fronteira.
 */
const comIdEPendencia = (d) => ({
  ...comIdEstimado(d),
  pendenteNoServidor: !!(d.metadata && d.metadata.hasPendingWrites),
});

/**
 * Caminho de uma operação de lote. `path` é RELATIVO ao documento do mundo:
 * `[]` é o mundo em si, `["entities", "e-1"]` é o verbete. Assim o nome da
 * coleção raiz continua nascendo só em `paths.js`.
 */
const resolverCaminho = (worldId, path = []) => {
  const [nome, id] = path;
  if (!nome) return worldDoc(worldId);
  return [...worldSubCol(worldId, nome), String(id)];
};

/* ── Mundo (documento raiz) ──────────────────────────────────────────────── */

/**
 * Cria o documento do mundo e devolve o id novo.
 * @param {object} data campos já prontos (carimbos como {@link SERVER_TIMESTAMP}).
 * @policy strict @returns {Promise<string>}
 */
export async function createWorld(data) {
  const ref = await addDoc(colAt(worldsCol()), comCarimbos(data));
  return ref.id;
}

/** Atualização parcial do documento do mundo. @policy strict */
export async function updateWorld(worldId, data) {
  await updateDoc(docAt(worldDoc(worldId)), comCarimbos(data));
}

/**
 * Lê um mundo avulso. `null` quando não existe — distinto de rejeitar, que
 * seria "não deu para procurar".
 * @policy strict @returns {Promise<object|null>}
 */
export async function getWorld(worldId) {
  if (!worldId) return null;
  const snap = await getDoc(docAt(worldDoc(worldId)));
  return snap.exists() ? comId(snap) : null;
}

/* ── Entidades (wiki) ────────────────────────────────────────────────────── */

/** @policy strict @returns {Promise<string>} id da entidade criada */
export async function createEntity(worldId, data) {
  const ref = await addDoc(colAt(worldEntitiesCol(worldId)), comCarimbos(data));
  return ref.id;
}

/** @policy strict */
export async function updateEntity(worldId, entityId, data) {
  await updateDoc(docAt(worldEntityDoc(worldId, entityId)), comCarimbos(data));
}

/**
 * Verbetes de uma pasta. Query de igualdade simples — a exclusão de pasta usa
 * isto para devolver as entidades à raiz sem apagá-las.
 * @policy strict @returns {Promise<object[]>}
 */
export async function listEntitiesInFolder(worldId, folderId) {
  if (!worldId) return [];
  const snap = await getDocs(
    query(colAt(worldEntitiesCol(worldId)), where("folderId", "==", folderId))
  );
  return snap.docs.map(comId);
}

/* ── Conexões ────────────────────────────────────────────────────────────── */

/** @policy strict @returns {Promise<string>} id da conexão criada */
export async function createConnection(worldId, data) {
  const ref = await addDoc(colAt(worldConnectionsCol(worldId)), comCarimbos(data));
  return ref.id;
}

/** @policy strict */
export async function deleteConnection(worldId, connectionId) {
  await deleteDoc(docAt(worldConnectionDoc(worldId, connectionId)));
}

/**
 * Conexões que tocam uma entidade por UM dos lados (`campo` é `"fromId"` ou
 * `"toId"`). São duas buscas separadas de propósito: o Firestore não faz OR
 * entre campos diferentes, e é o store que cruza os dois lados e deduplica.
 * @policy strict @returns {Promise<object[]>}
 */
export async function listConnectionsByEndpoint(worldId, campo, valor) {
  if (!worldId) return [];
  const snap = await getDocs(
    query(colAt(worldConnectionsCol(worldId)), where(campo, "==", valor))
  );
  return snap.docs.map(comId);
}

/**
 * Conexões de um par ordenado de entidades. Quem chama roda duas vezes,
 * invertendo os argumentos, para pegar a duplicata que chega pelo lado inverso.
 * @policy strict @returns {Promise<object[]>}
 */
export async function listConnectionsBetween(worldId, fromId, toId) {
  if (!worldId) return [];
  const snap = await getDocs(
    query(
      colAt(worldConnectionsCol(worldId)),
      where("fromId", "==", fromId),
      where("toId", "==", toId)
    )
  );
  return snap.docs.map(comId);
}

/* ── Pastas ──────────────────────────────────────────────────────────────── */

/** @policy strict @returns {Promise<string>} id da pasta criada */
export async function createFolder(worldId, data) {
  const ref = await addDoc(colAt(worldFoldersCol(worldId)), comCarimbos(data));
  return ref.id;
}

/** @policy strict */
export async function updateFolder(worldId, folderId, data) {
  await updateDoc(docAt(worldFolderDoc(worldId, folderId)), comCarimbos(data));
}

/** Lê uma pasta avulsa. `null` quando não existe. @policy strict */
export async function getFolder(worldId, folderId) {
  if (!worldId || !folderId) return null;
  const snap = await getDoc(docAt(worldFolderDoc(worldId, folderId)));
  return snap.exists() ? comId(snap) : null;
}

/** Subpastas diretas de uma pasta. @policy strict @returns {Promise<object[]>} */
export async function listChildFolders(worldId, folderId) {
  if (!worldId) return [];
  const snap = await getDocs(
    query(colAt(worldFoldersCol(worldId)), where("parentId", "==", folderId))
  );
  return snap.docs.map(comId);
}

/* ── Subcoleção genérica ─────────────────────────────────────────────────── */

/**
 * Todos os documentos de uma subcoleção do mundo, sem filtro nem ordenação.
 *
 * Existe porque apagar um mundo é varrer as três subcoleções em laço: o
 * Firestore não apaga subcoleção em cascata. Genérica de propósito — três
 * funções idênticas só mudariam o nome.
 *
 * @param {string} nome `"entities"`, `"connections"` ou `"folders"`.
 * @policy strict @returns {Promise<object[]>}
 */
export async function listSubcollection(worldId, nome) {
  if (!worldId) return [];
  const snap = await getDocs(colAt(worldSubCol(worldId, nome)));
  return snap.docs.map(comId);
}

/**
 * Reserva um id de documento SEM escrever nada.
 *
 * É o que permite ao store montar as conexões do mundo demo já apontando para
 * os ids reais das entidades, num lote só. Devolve **string**: a
 * `DocumentReference` que o SDK gera morre aqui dentro (AC-4).
 *
 * @returns {string}
 */
export function newSubDocId(worldId, nome) {
  return doc(colAt(worldSubCol(worldId, nome))).id;
}

/* ── Lote ────────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} OperacaoDeLote
 * @property {"set"|"update"|"delete"} op
 * @property {string[]} path caminho RELATIVO ao mundo: `[]` (o mundo) ou
 *   `[nomeDaSubcolecao, idDoDocumento]`.
 * @property {object} [data] campos prontos; carimbos como {@link SERVER_TIMESTAMP}.
 */

/**
 * Aplica as operações em lotes de no máximo {@link BATCH_LIMIT}.
 *
 * A ordem é preservada: o que precisa acontecer por último (apagar o documento
 * do mundo, apagar a pasta depois de realocar o que estava dentro) deve vir por
 * último na lista.
 *
 * Os lotes são commitados em SEQUÊNCIA de propósito — cada `writeBatch` é
 * atômico em si, o conjunto não é. Rodar em paralelo não daria atomicidade
 * nenhuma e só espalharia a escrita parcial de um jeito mais difícil de ler.
 *
 * @param {string} worldId
 * @param {OperacaoDeLote[]} ops
 * @policy strict
 */
export async function commitBatch(worldId, ops = []) {
  if (!worldId || !ops.length) return;
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      const ref = docAt(resolverCaminho(worldId, op.path));
      if (op.op === "delete") batch.delete(ref);
      else if (op.op === "update") batch.update(ref, comCarimbos(op.data));
      else batch.set(ref, comCarimbos(op.data));
    }
    await batch.commit(); // eslint-disable-line no-await-in-loop
  }
}

/* ── Assinaturas ─────────────────────────────────────────────────────────── */

/**
 * Mundos de um mestre, do mais recente para o mais antigo.
 *
 * ATENÇÃO (infra): filtro de igualdade em `ownerUid` + ordenação por
 * `updatedAt` exige um ÍNDICE COMPOSTO em `worlds` (ownerUid ASC, updatedAt
 * DESC). Sem ele o Firestore RECUSA a query e o erro chega no `onError` com o
 * link de criação do índice. Trocar o `where` por filtro em memória, ou mexer
 * na ordenação, invalida o índice que já está em produção.
 *
 * O erro vai para `onError` e NÃO é logado aqui: quem chama (`useWorlds`) o
 * expõe no campo `error` e a Forja mostra a mensagem na tela. Logar também só
 * duplicaria o ruído.
 *
 * @param {(mundos: object[]) => void} onChange recebe `{id, ..., pendenteNoServidor}`
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function watchWorldsByOwner(uid, onChange, onError) {
  if (!uid) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    query(colAt(worldsCol()), where("ownerUid", "==", uid), orderBy("updatedAt", "desc")),
    (snap) => onChange(snap.docs.map(comIdEPendencia)),
    (e) => { if (onError) onError(e); }
  );
}

/**
 * Assina uma subcoleção do mundo ordenada por um campo.
 *
 * @param {string} nome `"entities"`, `"connections"` ou `"folders"`.
 * @param {{campo: string, direcao: "asc"|"desc"}} ordem
 * @param {(docs: object[]) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function watchSubcollection(worldId, nome, ordem, onChange, onError) {
  if (!worldId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    query(colAt(worldSubCol(worldId, nome)), orderBy(ordem.campo, ordem.direcao)),
    (snap) => onChange(snap.docs.map(comIdEstimado)),
    (e) => { if (onError) onError(e); }
  );
}
