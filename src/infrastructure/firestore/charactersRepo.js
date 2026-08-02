/**
 * Agregado Ficha — `users/{uid}/characters/{charId}`.
 *
 * Substitui `fsSaveChar`/`fsDeleteChar`/`fsLoadChars` de `useCharacter.js`.
 *
 * **Estas operações são `strict` de propósito.** Foi uma correção consciente do
 * assessment-0021 (grupo C): quando falhavam em silêncio, a sincronização entre dispositivos
 * quebrava calada e o usuário via aquilo como PERDA DE FICHA. O hook precisa distinguir
 * "não tem ficha" de "não consegui ler" — por isso o erro sobe.
 */
import { getDocs, setDoc, deleteDoc, query, where } from "firebase/firestore";
import { docAt, colAt } from "./client";
import { charactersCol, characterDoc } from "./paths";
import { characterKey } from "../../domain/character";

/**
 * Fichas do dono num sistema (`ordemParanormal`, `dungeonsAndDragons`, …).
 *
 * Devolve `[]` em coleção vazia; REJEITA em erro real — é essa diferença que permite ao
 * `useCharacter` avisar o usuário em vez de mostrar uma lista vazia mentirosa.
 *
 * `_updatedAt` é metadado de persistência e não volta para a borda: a ficha em memória
 * precisa ser comparável com a do `localStorage`, que nunca teve esse campo.
 *
 * @policy strict
 * @returns {Promise<object[]>}
 */
export async function listBySystem(uid, systemId) {
  if (!uid) return [];
  const snap = await getDocs(
    query(colAt(charactersCol(uid)), where("systemId", "==", systemId))
  );
  return snap.docs.map((d) => {
    const { _updatedAt, ...character } = d.data();
    return character;
  });
}

/**
 * @policy strict — quem chama trata a falha (a ficha fica salva localmente).
 */
export async function save(uid, character) {
  if (!uid || !character) return;
  await setDoc(docAt(characterDoc(uid, characterKey(character))), {
    ...character,
    _updatedAt: Date.now(),
  });
}

/** @policy strict */
export async function remove(uid, character) {
  if (!uid || !character) return;
  await deleteDoc(docAt(characterDoc(uid, characterKey(character))));
}
