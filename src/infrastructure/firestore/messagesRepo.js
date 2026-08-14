/**
 * Agregado Chat — `campaigns/{campaignId}/messages` e `campaigns/{campaignId}/typing`.
 *
 * `typing` mora aqui de propósito: não é agregado próprio, é o estado efêmero do mesmo ato
 * (digitar → enviar). Separar daria um repo de duas funções que só faz sentido junto deste.
 *
 * `serverTimestamp`, `Timestamp`, `writeBatch` e `startAfter` não saem daqui (spec 0029 AC-3).
 * O cursor de paginação é OPACO para quem chama.
 *
 * DÍVIDA QUITADA (spec 0032 AC-5): `timestamp` e `updatedAt` saem daqui como **epoch-ms
 * numérico**, nunca mais como `Timestamp` do SDK. Era a última primitiva do SDK a atravessar
 * a fronteira — estava registrada como aceita no ADR-0010. Documento ainda sem carimbo do
 * servidor (escrita otimista) sai com o campo `null`; ver `paraEpochMs` em `client.js`.
 */
import {
  addDoc, setDoc, getDocs, onSnapshot, writeBatch,
  query, where, orderBy, limit, startAfter, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db, docAt, colAt, silent, comDatasEmMs, NOOP_UNSUBSCRIBE } from "./client";
import { criarNormalizador, texto, naoDescartado } from "./schema";
import { messagesCol, typingCol, typingDoc } from "./paths";

/** Mensagens somem depois de 24 h — regra de RETENÇÃO do dado, por isso vive no repo. */
export const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;

/** Corte do TTL como `Timestamp` — só para uso interno; não atravessa a borda. */
const ttlCutoff = () => Timestamp.fromMillis(Date.now() - MESSAGE_TTL_MS);

/** Epoch-ms do corte, para os filtros em memória de quem já recebeu as mensagens. */
export const ttlCutoffMillis = () => Date.now() - MESSAGE_TTL_MS;

/** Campos de data deste agregado: `timestamp` nas mensagens, `updatedAt` no "está digitando". */
const CAMPOS_DE_DATA = ["timestamp", "updatedAt"];

/**
 * Tipos que a fronteira garante (spec 0032 AC-6).
 *
 * `content` é o campo caro: uma mensagem cujo `content` foi gravado como objeto derruba a
 * árvore inteira do React com "Objects are not valid as a React child" — a bolha some, o chat
 * some, e o rastro aponta para o componente, não para o documento. Coagir para `""` deixa a
 * bolha vazia e o log com o ID da mensagem.
 *
 * `rollData` NÃO entra: a UI já a lê com encadeamento opcional, e o formato dela varia por
 * sistema de RPG — descrevê-lo aqui seria a fronteira opinando sobre regra de jogo.
 */
const normalizar = criarNormalizador("messagesRepo.saida", {
  content: texto,
  type: texto,
  userName: texto,
  userId: texto,
  userPhoto: texto,
});

/**
 * Achata o documento, valida os tipos (AC-6) e normaliza as datas (AC-5) — é o único ponto de
 * saída do repo, então basta ele para garantir que nem `Timestamp` do SDK nem campo de tipo
 * inesperado cheguem à UI. `null` quando o documento é para descartar.
 */
const withId = (d) => {
  const dados = normalizar(d.data(), d.id);
  return dados && { id: d.id, ...comDatasEmMs(dados, CAMPOS_DE_DATA) };
};

/**
 * Envia uma mensagem da mesa.
 * @policy silent — falha ao enviar nunca derrubou a tela do chat; preservado (AC-7).
 */
export async function send(campaignId, { userId, userName, userPhoto, content, type, rollData }) {
  // `await` sem `return` de propósito: `addDoc` resolve com um DocumentReference, e devolvê-lo
  // faria uma primitiva do SDK atravessar a fronteira no caminho feliz (viola o AC-3).
  // Ninguém precisa do ID da mensagem — o chat lê tudo pelo snapshot.
  return silent("messagesRepo.send", undefined, async () => {
    await addDoc(colAt(messagesCol(campaignId)), {
      userId,
      userName,
      userPhoto: userPhoto || null,
      content,
      type: type || "text",
      timestamp: serverTimestamp(),
      ...(rollData ? { rollData } : {}),
    });
  });
}

/**
 * Aviso do sistema ("Fulano entrou na campanha"), sem autor humano.
 * @policy silent
 */
export async function sendSystem(campaignId, content) {
  return send(campaignId, {
    userId: "system",
    userName: "Sistema",
    userPhoto: null,
    content,
    type: "system",
  });
}

/**
 * Assina as N mensagens mais recentes dentro do TTL.
 *
 * @param {(page: {messages: object[], cursor: unknown, hasMore: boolean}) => void} onChange
 *   `cursor` é opaco — devolva-o a `loadOlder` sem inspecionar (AC-3).
 * @returns {() => void} unsubscribe
 */
export function watchRecent(campaignId, pageSize, onChange, onError) {
  if (!campaignId) return NOOP_UNSUBSCRIBE;
  const q = query(
    colAt(messagesCol(campaignId)),
    where("timestamp", ">=", ttlCutoff()),
    orderBy("timestamp", "desc"),
    limit(pageSize)
  );
  return onSnapshot(
    q,
    (snap) => onChange({
      messages: snap.docs.map(withId).filter(naoDescartado).reverse(),
      cursor: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.docs.length === pageSize,
    }),
    (e) => {
      console.error("[messagesRepo.watchRecent] falhou:", e);
      if (onError) onError(e);
    }
  );
}

/**
 * Página anterior, a partir do cursor devolvido por `watchRecent`/`loadOlder`.
 * @policy strict @returns {Promise<{messages: object[], cursor: unknown}>}
 */
export async function loadOlder(campaignId, cursor, pageSize) {
  if (!cursor) return { messages: [], cursor: null };
  const snap = await getDocs(query(
    colAt(messagesCol(campaignId)),
    where("timestamp", ">=", ttlCutoff()),
    orderBy("timestamp", "desc"),
    startAfter(cursor),
    limit(pageSize)
  ));
  return {
    messages: snap.docs.map(withId).filter(naoDescartado).reverse(),
    cursor: snap.docs[snap.docs.length - 1] || null,
  };
}

/**
 * Assina só as rolagens de dado (feed lateral e histórico do mestre).
 * @returns {() => void} unsubscribe
 */
export function watchRolls(campaignId, maxItems, onChange) {
  if (!campaignId) return NOOP_UNSUBSCRIBE;
  /* `orderBy` ADICIONADO na spec 0032 (Q2). Sem ele — como era até a spec 0031 — o Firestore
     ordena por ID de documento, e o `limit` cortava rolagens ARBITRÁRIAS em vez das mais
     recentes. As telas reordenam em memória, o que escondia o defeito enquanto a campanha
     tinha menos de `maxItems` rolagens no período; passando disso, o mestre simplesmente não
     via as últimas jogadas da mesa.

     ⚠ DEPENDE DE ÍNDICE COMPOSTO (`messages`: type ASC + timestamp DESC), declarado em
     `firestore.indexes.json`. O índice tem de estar NO AR ANTES deste código — senão a
     assinatura falha e o feed fica vazio. Ordem de deploy:
     `firebase deploy --only firestore:indexes` e só depois o build. */
  const q = query(
    colAt(messagesCol(campaignId)),
    where("type", "==", "roll"),
    orderBy("timestamp", "desc"),
    limit(maxItems)
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(withId).filter(naoDescartado)),
    (e) => console.error("[messagesRepo.watchRolls] falhou:", e)
  );
}

/** Apaga TODAS as mensagens (ação do mestre). @policy silent */
export async function clearAll(campaignId) {
  return silent("messagesRepo.clearAll", undefined, async () => {
    const snap = await getDocs(colAt(messagesCol(campaignId)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  });
}

/** Faxina do TTL: apaga o que passou de 24 h. @policy silent */
export async function deleteExpired(campaignId) {
  return silent("messagesRepo.deleteExpired", undefined, async () => {
    const snap = await getDocs(query(
      colAt(messagesCol(campaignId)),
      where("timestamp", "<", ttlCutoff())
    ));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  });
}

/** @policy silent — "está digitando" nunca vale um erro na tela. */
export async function setTyping(campaignId, uid, userName, isTyping) {
  return silent("messagesRepo.setTyping", undefined, () =>
    setDoc(docAt(typingDoc(campaignId, uid)), {
      userName, isTyping, updatedAt: serverTimestamp(),
    })
  );
}

/** @returns {() => void} unsubscribe */
export function watchTyping(campaignId, onChange) {
  if (!campaignId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    query(colAt(typingCol(campaignId))),
    (snap) => onChange(snap.docs.map(withId).filter(naoDescartado)),
    (e) => console.error("[messagesRepo.watchTyping] falhou:", e)
  );
}
