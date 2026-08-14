/**
 * Agregado Bestiário — `campaigns/{campaignId}/bestiary` (criaturas do mestre).
 *
 * Substitui os 5 acessos crus do `BestiaryTab` (App.jsx): a assinatura ordenada, o
 * `addDoc`/`updateDoc` do formulário, o `deleteDoc` e a escrita de PV.
 *
 * **Burro de propósito.** O clamp de PV (`[0, hpMax]`) e o fallback "sem `hpCurrent` vale
 * `hpMax`" são regra de negócio e moram em `domain/creature.js`; aqui só chega o número
 * pronto. `serverTimestamp` e `orderBy` não saem daqui (spec 0029 AC-3).
 *
 * **Política.** Tudo é `silent`: no legado o formulário era um `try/catch(_){}` MUDO e a
 * remoção/PV logavam num `.catch`. A spec 0029 preserva comportamento (AC-7) — o que muda
 * é só o prefixo do log, que passa a ser `[bestiaryRepo.<op>]` (AC-4).
 */
import { addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { docAt, colAt, silent, comDatasEmMs, NOOP_UNSUBSCRIBE } from "./client";
import { criarNormalizador, texto, naoDescartado } from "./schema";
import { bestiaryCol, bestiaryDoc } from "./paths";

/** Campo de data deste agregado: quando a criatura entrou no bestiário. */
const CAMPOS_DE_DATA = ["createdAt"];

/**
 * Tipos que a fronteira garante (spec 0032 AC-6). Só os textuais.
 *
 * **`hpMax`/`hpCurrent` ficam de fora DE PROPÓSITO** — e essa é a decisão que mais importa
 * neste agregado. O formulário do bestiário grava PV como STRING LIVRE: `"18 (2d8+4)"` é dado
 * VÁLIDO e comum nas 77 fichas já cadastradas. Coagir para número transformaria a nota de
 * rolagem do mestre em `18` (ou em `null`) e apagaria informação que ele digitou de propósito.
 * A régua do PV é `domain/creature.js`, que é total sobre lixo (`toInt` tolerante) e já
 * devolve número para quem precisa de número. Uma segunda régua aqui só criaria divergência.
 *
 * `name`/`system` entram porque são TEXTO e são usados como texto: a busca do bestiário faz
 * `.toLowerCase()` no nome, e um nome numérico (criatura chamada "13") derruba a busca inteira.
 */
const normalizar = criarNormalizador("bestiaryRepo.saida", {
  name: texto,
  system: texto,
  description: texto,
});

/* Ponto único de saída: valida os tipos (AC-6) e normaliza `createdAt` para epoch-ms (AC-5).
   Nenhuma tela lê a data hoje — ela existe para a ordenação, que roda no servidor —, mas
   deixá-la crua manteria uma via aberta para o `Timestamp` do SDK atravessar a fronteira. */
const withId = (d) => {
  const dados = normalizar(d.data(), d.id);
  return dados && { id: d.id, ...comDatasEmMs(dados, CAMPOS_DE_DATA) };
};

/**
 * Assina o bestiário da campanha, da criatura mais nova para a mais velha.
 *
 * @param {string} campaignId
 * @param {(creatures: object[]) => void} onChange recebe objetos planos `{id, ...dados}`
 * @returns {() => void} unsubscribe (inerte e idempotente se `campaignId` for vazio)
 */
export function watchByCampaign(campaignId, onChange) {
  if (!campaignId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    query(colAt(bestiaryCol(campaignId)), orderBy("createdAt", "desc")),
    (snap) => onChange(snap.docs.map(withId).filter(naoDescartado)),
    (e) => console.error("[bestiaryRepo.watchByCampaign] falhou:", e)
  );
}

/**
 * Adiciona uma criatura. `createdAt` é carimbado aqui porque `serverTimestamp()` é FieldValue
 * do SDK e é o campo pelo qual `watchByCampaign` ordena — quem chama não precisa saber disso.
 *
 * Não devolve o `DocumentReference` do `addDoc`: handle do SDK não atravessa a fronteira (AC-3).
 *
 * @policy silent — fallback `false`.
 * @returns {Promise<boolean>} `true` se gravou. O legado só fechava o modal dentro do `try`,
 *   então quem chama precisa deste booleano para manter o formulário aberto quando falha.
 */
export async function create(campaignId, data) {
  return silent("bestiaryRepo.create", false, async () => {
    await addDoc(colAt(bestiaryCol(campaignId)), { ...data, createdAt: serverTimestamp() });
    return true;
  });
}

/**
 * Sobrescreve os campos editados no formulário.
 *
 * @param {object} data campos já prontos — sem FieldValue (AC-3)
 * @policy silent — fallback `false`, mesmo contrato de `create`.
 * @returns {Promise<boolean>}
 */
export async function update(campaignId, creatureId, data) {
  return silent("bestiaryRepo.update", false, async () => {
    await updateDoc(docAt(bestiaryDoc(campaignId, creatureId)), data);
    return true;
  });
}

/**
 * Tira a criatura do bestiário. A confirmação (`window.confirm`) é da UI, não daqui.
 * @policy silent — fallback `undefined`; o legado seguia em frente e a lista se corrigia
 *   sozinha no próximo snapshot.
 */
export async function remove(campaignId, creatureId) {
  return silent("bestiaryRepo.remove", undefined, () =>
    deleteDoc(docAt(bestiaryDoc(campaignId, creatureId)))
  );
}

/**
 * Grava o PV atual da criatura.
 *
 * @param {number} hpCurrent valor FINAL, já limitado por `clampHp` (domain/creature.js) —
 *   o repo não decide quanto de dano cabe.
 * @policy silent — fallback `undefined`. A UI já atualiza o estado local otimisticamente;
 *   falhar aqui só desfaz no próximo snapshot, como sempre foi.
 */
export async function setHp(campaignId, creatureId, hpCurrent) {
  return silent("bestiaryRepo.setHp", undefined, () =>
    updateDoc(docAt(bestiaryDoc(campaignId, creatureId)), { hpCurrent })
  );
}
