/**
 * Agregado Campanha — `campaigns/{campaignId}` (doc raiz).
 *
 * Substitui `fsGetCampaigns`/`fsCreateCamp`/`fsJoinCamp`/`fsLeaveCamp` (useCampaign.js) e
 * as 9 chamadas soltas de `updateDoc(doc(db,"campaigns",…))` do App.jsx.
 *
 * **Este repo é burro de propósito.** O limite de 3 campanhas por sistema e a tradução do
 * erro em mensagem PT-BR ficam no `useCampaign` (camada de aplicação) — aqui só se conta,
 * lê e escreve. As operações são `strict`: quem chama precisa saber que falhou para poder
 * dizer "não deu" ao usuário em vez de mostrar uma lista vazia.
 *
 * `arrayUnion`/`arrayRemove`/`serverTimestamp` NÃO saem daqui (spec 0029 AC-3).
 */
import {
  getDocs, addDoc, updateDoc, onSnapshot,
  query, where, serverTimestamp, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { docAt, colAt, NOOP_UNSUBSCRIBE } from "./client";
import { campaignDoc, campaignsCol } from "./paths";
import { normalizeInviteCode, isActiveCampaign, systemOf } from "../../domain/campaign";

const withId = (d) => ({ id: d.id, ...d.data() });
const byMember = (uid) => query(colAt(campaignsCol()), where("members", "array-contains", uid));

/**
 * Assina as campanhas em que o usuário é membro (mestre ou jogador).
 *
 * @param {(campaigns: object[]) => void} onChange
 * @param {(error: Error) => void} [onError] o hook usa isto para o backoff de reassinatura —
 *   a POLÍTICA de retry é dele, não da infraestrutura.
 * @returns {() => void} unsubscribe
 */
export function watchByMember(uid, onChange, onError) {
  if (!uid) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    byMember(uid),
    (snap) => onChange(snap.docs.map(withId)),
    (e) => {
      console.error("[campaignsRepo.watchByMember] falhou:", e);
      if (onError) onError(e);
    }
  );
}

/** @policy strict @returns {Promise<object[]>} */
export async function listByMember(uid) {
  if (!uid) return [];
  const snap = await getDocs(byMember(uid));
  return snap.docs.map(withId);
}

/**
 * Quantas campanhas ATIVAS o usuário MESTRA num sistema. Só conta — a comparação com o
 * teto é do hook.
 *
 * ATENÇÃO — assimetria HERDADA em relação a `countActiveByMemberAndSystem`: aqui
 * `isActive` vai NA QUERY, lá é filtrado em memória. Campanha antiga sem o campo é
 * invisível para esta contagem e visível para a outra, então um mestre com campanhas
 * legadas fura o teto ao CRIAR e é barrado ao ENTRAR por convite.
 * É exatamente o que o código original fazia (`useCampaign.js` antes da spec 0029) e o
 * AC-7 manda preservar. Uniformizar muda o que o usuário pode fazer — decisão da onda 3.
 *
 * @policy strict @returns {Promise<number>}
 */
export async function countActiveByMasterAndSystem(uid, system) {
  if (!uid) return 0;
  const snap = await getDocs(
    query(
      colAt(campaignsCol()),
      where("masterId", "==", uid),
      where("system", "==", system),
      where("isActive", "==", true)
    )
  );
  return snap.size;
}

/**
 * Quantas campanhas ATIVAS do mesmo sistema o usuário JOGA (inclui as que mestra).
 *
 * Filtra em memória de propósito: `isActive` não pode ir na query porque campanhas
 * antigas não têm o campo, e `where("isActive","==",true)` as excluiria silenciosamente.
 * @policy strict @returns {Promise<number>}
 */
export async function countActiveByMemberAndSystem(uid, system) {
  const list = await listByMember(uid);
  return list.filter((c) => isActiveCampaign(c) && systemOf(c) === system).length;
}

/**
 * Cria a campanha e devolve o ID novo. `createdAt` é carimbado aqui — `serverTimestamp()`
 * é FieldValue do SDK e não pode ser montado pela borda (AC-3).
 * @policy strict @returns {Promise<string>}
 */
export async function create(campaign) {
  const ref = await addDoc(colAt(campaignsCol()), {
    ...campaign,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Acha a campanha ATIVA de um código de convite.
 *
 * Filtra `isActive` em memória pelo mesmo motivo de `countActiveByMemberAndSystem`:
 * campanha antiga sem o campo ainda deve aceitar entrada.
 * @policy strict @returns {Promise<object|null>}
 */
export async function findActiveByInviteCode(code) {
  const snap = await getDocs(
    query(colAt(campaignsCol()), where("inviteCode", "==", normalizeInviteCode(code)))
  );
  const found = snap.docs.find((d) => isActiveCampaign(d.data()));
  return found ? withId(found) : null;
}

/** Entra na campanha: entra na lista de membros e registra o nome de exibição. @policy strict */
export async function addMember(campaignId, uid, userName) {
  await updateDoc(docAt(campaignDoc(campaignId)), {
    members: arrayUnion(uid),
    [`memberNames.${uid}`]: userName,
  });
}

/**
 * Tira o membro da campanha. Sai de `members` E de `admins` — deixar o uid em `admins`
 * devolveria poder de mestre a quem voltasse depois pelo código.
 * @policy strict
 */
export async function removeMember(campaignId, memberId) {
  await updateDoc(docAt(campaignDoc(campaignId)), {
    members: arrayRemove(memberId),
    admins: arrayRemove(memberId),
  });
}

/** Promove/rebaixa um membro a admin. @policy strict */
export async function setAdmin(campaignId, memberId, shouldBeAdmin) {
  await updateDoc(docAt(campaignDoc(campaignId)), {
    admins: shouldBeAdmin ? arrayUnion(memberId) : arrayRemove(memberId),
  });
}

/**
 * Atualização parcial do doc raiz (formulário de ajustes, código novo, arquivar, capa).
 * @param {object} fields campos JÁ prontos — sem FieldValue, que não atravessa a borda.
 * @policy strict
 */
export async function update(campaignId, fields) {
  await updateDoc(docAt(campaignDoc(campaignId)), fields);
}

/**
 * Narração do mestre. Três destinos, e cada um grava num campo diferente:
 * `narracaoTest` (só o mestre lê, para ensaiar), `narracao` (mesa inteira) e
 * `narracaoPrivada.{uid}` (um jogador por vez).
 * @policy strict
 */
export async function setNarracao(campaignId, payload, { testMode, targetIds } = {}) {
  if (testMode) {
    return update(campaignId, { narracaoTest: { ...payload, test: true } });
  }
  if (!targetIds) {
    return update(campaignId, { narracao: payload });
  }
  const fields = {};
  targetIds.forEach((pid) => { fields[`narracaoPrivada.${pid}`] = payload; });
  if (Object.keys(fields).length === 0) return;
  return update(campaignId, fields);
}
