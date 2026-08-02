/**
 * Agregado Chat — `campaigns/{campaignId}/messages` e `campaigns/{campaignId}/typing`.
 *
 * `typing` mora aqui de propósito: não é agregado próprio, é o estado efêmero do mesmo ato
 * (digitar → enviar). Separar daria um repo de duas funções que só faz sentido junto deste.
 *
 * `serverTimestamp`, `Timestamp`, `writeBatch` e `startAfter` não saem daqui (spec 0029 AC-3).
 * O cursor de paginação é OPACO para quem chama.
 *
 * NOTA (dívida do ADR-0010): o campo `timestamp` que volta nas mensagens ainda é o
 * `Timestamp` do SDK — a UI lê `msg.timestamp.seconds` em vários pontos e normalizar aqui
 * mudaria comportamento. Normalização entra na onda 3.
 */
import {
  addDoc, setDoc, getDocs, onSnapshot, writeBatch,
  query, where, orderBy, limit, startAfter, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db, docAt, colAt, silent, NOOP_UNSUBSCRIBE } from "./client";
import { messagesCol, typingCol, typingDoc } from "./paths";

/** Mensagens somem depois de 24 h — regra de RETENÇÃO do dado, por isso vive no repo. */
export const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;

/** Corte do TTL como `Timestamp` — só para uso interno; não atravessa a borda. */
const ttlCutoff = () => Timestamp.fromMillis(Date.now() - MESSAGE_TTL_MS);

/** Epoch-ms do corte, para os filtros em memória de quem já recebeu as mensagens. */
export const ttlCutoffMillis = () => Date.now() - MESSAGE_TTL_MS;

const withId = (d) => ({ id: d.id, ...d.data() });

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
      messages: snap.docs.map(withId).reverse(),
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
    messages: snap.docs.map(withId).reverse(),
    cursor: snap.docs[snap.docs.length - 1] || null,
  };
}

/**
 * Assina só as rolagens de dado (feed lateral e histórico do mestre).
 * @returns {() => void} unsubscribe
 */
export function watchRolls(campaignId, maxItems, onChange) {
  if (!campaignId) return NOOP_UNSUBSCRIBE;
  // SEM `orderBy` de propósito — é o comportamento herdado (AC-7). Consequência real: o
  // Firestore ordena por ID de documento, então o corte de `maxItems` traz rolagens
  // ARBITRÁRIAS, não as mais recentes. As duas telas que consomem isto reordenam e cortam
  // em memória, o que mascara o problema enquanto a campanha tem menos de `maxItems`
  // rolagens no período. Ordenar aqui exigiria índice composto e mudaria o que o usuário vê
  // — vira decisão da onda 3, não desta spec.
  const q = query(colAt(messagesCol(campaignId)), where("type", "==", "roll"), limit(maxItems));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(withId)),
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
    (snap) => onChange(snap.docs.map(withId)),
    (e) => console.error("[messagesRepo.watchTyping] falhou:", e)
  );
}
