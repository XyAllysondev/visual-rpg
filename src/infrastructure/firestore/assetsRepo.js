/**
 * Agregado Biblioteca de Assets — `users/{uid}/assets/{assetId}`.
 *
 * Substitui as 3 funções de Firestore de `MapEditor/assets/assetLib.js` (spec 0030, onda 1.5).
 * O documento é `{ type, name, tags[], folder, data, hash, w, h, id, updatedAt }`, onde `data`
 * é a imagem em base64 — por isso o `assetLib` continua dono da COMPRESSÃO e do dedup por
 * hash: o repo recebe o asset pronto e só o grava (AC-3).
 *
 * O id do documento é gerado pelo `assetLib` (`newAssetId`) e vem DENTRO do asset. Ele é
 * escrito também como campo `id` — redundante com o id do documento, mas é o formato que os
 * assets já gravados têm, e a UI lê `asset.id` de objetos que nem sempre passaram pelo
 * snapshot. Preservado (AC-7).
 *
 * `serverTimestamp` não sai daqui (AC-4).
 */
import { onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { docAt, colAt, silent, comDatasEmMs, NOOP_UNSUBSCRIBE } from "./client";
import { assetsCol, assetDoc } from "./paths";

/**
 * O único campo de data do asset. DÍVIDA QUITADA (spec 0032 AC-5): sai como **epoch-ms
 * numérico**, nunca mais como `Timestamp` do SDK. Asset antigo sem carimbo continua sem o
 * campo — `comDatasEmMs` não cria chave que não existia.
 */
const CAMPOS_DE_DATA = ["updatedAt"];

/**
 * O `id` vem DEPOIS do spread de propósito: o id do documento é a verdade, e um campo `id`
 * divergente no corpo (asset copiado à mão, importação antiga) apontaria a UI para um
 * documento que não existe. É o que o `subscribeAssets` original já fazia.
 */
const withId = (d) => ({ ...comDatasEmMs(d.data(), CAMPOS_DE_DATA), id: d.id });

/**
 * Assina a biblioteca inteira do usuário.
 *
 * Sem paginação de propósito: o `ASSET_SOFT_CAP` (300) do `assetLib` é o que segura o
 * tamanho, e a doca precisa de todos os assets em memória para filtrar por nome/tag sem
 * ida à rede.
 *
 * @param {string} uid
 * @param {(assets: object[]) => void} onChange
 * @returns {() => void} unsubscribe (inerte e idempotente quando `uid` é falsy)
 */
export function watchAll(uid, onChange) {
  if (!uid) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    colAt(assetsCol(uid)),
    (snap) => onChange(snap.docs.map(withId)),
    (e) => console.error("[assetsRepo.watchAll] falhou:", e)
  );
}

/**
 * Grava (cria ou substitui) um asset. `setDoc` sem `merge` de propósito: salvar de novo é
 * "esta é a versão nova do asset", e um merge deixaria tags removidas para trás.
 *
 * @param {string} uid
 * @param {object} asset asset JÁ pronto — com `id` (o `assetLib` gera) e a imagem já
 *   comprimida. Sem FieldValue: `updatedAt` é carimbado aqui.
 * @policy silent — falha ao salvar nunca derrubou a doca de assets; o usuário vê o asset
 *   sumir no próximo snapshot. Herdado e preservado (AC-7). Devolve `undefined` sempre.
 */
export async function save(uid, asset) {
  return silent("assetsRepo.save", undefined, () =>
    setDoc(docAt(assetDoc(uid, asset.id)), { ...asset, updatedAt: serverTimestamp() })
  );
}

/**
 * Apaga um asset da biblioteca.
 * @policy silent — herdado; devolve `undefined` sempre.
 */
export async function remove(uid, assetId) {
  return silent("assetsRepo.remove", undefined, () => deleteDoc(docAt(assetDoc(uid, assetId))));
}
