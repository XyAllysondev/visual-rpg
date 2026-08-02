/**
 * Agregado Ficha Pública — `publicSheets/{charId}` e `.../pendingEdits/{editId}`.
 *
 * É a ficha compartilhada por link: qualquer um com o endereço lê, e pode PROPOR uma
 * edição, que fica pendente até o dono aprovar. Substitui as 5 funções `fs*` do App.jsx
 * e a leitura de `PublicSheetView`.
 *
 * Tudo aqui é `@policy silent` — era o comportamento do legado, e a spec 0029 preserva
 * comportamento (AC-7). Falha ao publicar não pode derrubar a ficha do usuário, que
 * continua salva localmente e no `charactersRepo`.
 *
 * NOTA: as datas deste agregado são epoch-ms (`Date.now()`), NÃO `Timestamp` do Firestore.
 * É proposital: a ficha pública é lida por quem não está autenticado, e o `editId` É o
 * timestamp — precisa ser um número comparável sem o SDK.
 */
import { getDoc, setDoc, deleteDoc, getDocs } from "firebase/firestore";
import { docAt, colAt, silent } from "./client";
import { publicSheetDoc, pendingEditsCol, pendingEditDoc } from "./paths";

/**
 * @policy silent — devolve `null` se falhar OU se a ficha não existir. A tela pública
 *   trata os dois casos com a mesma mensagem ("ficha não encontrada"), então distinguir
 *   aqui não mudaria nada para o usuário.
 * @returns {Promise<object|null>}
 */
export async function get(charId) {
  if (!charId) return null;
  return silent("publicSheetsRepo.get", null, async () => {
    const snap = await getDoc(docAt(publicSheetDoc(charId)));
    return snap.exists() ? snap.data() : null;
  });
}

/**
 * Publica (ou republica) a ficha.
 *
 * `ownerUid` só entra no payload quando existe: fichas publicadas antes desse campo não
 * têm dono registrado, e gravar `ownerUid: undefined` faria o Firestore recusar a escrita.
 *
 * @policy silent
 */
export async function save(charId, data, ownerUid) {
  if (!charId) return;
  return silent("publicSheetsRepo.save", undefined, () => {
    const payload = { ...data, public: true, _updatedAt: Date.now() };
    if (ownerUid) payload.ownerUid = ownerUid;
    return setDoc(docAt(publicSheetDoc(charId)), payload);
  });
}

/** Despublica a ficha. @policy silent */
export async function remove(charId) {
  if (!charId) return;
  return silent("publicSheetsRepo.remove", undefined, () =>
    deleteDoc(docAt(publicSheetDoc(charId)))
  );
}

/**
 * Registra uma proposta de edição de quem abriu a ficha pelo link.
 *
 * O ID do documento É o instante da proposta. Isso dá ordenação natural e evita colisão
 * sem precisar de contador — duas propostas no mesmo milissegundo são um cenário que não
 * existe no fluxo (uma pessoa clicando "sugerir").
 *
 * @policy silent
 */
export async function savePendingEdit(charId, proposedData, editorName) {
  if (!charId) return;
  return silent("publicSheetsRepo.savePendingEdit", undefined, () => {
    const id = String(Date.now());
    return setDoc(docAt(pendingEditDoc(charId, id)), {
      id,
      proposedData,
      editorName: editorName || "Anônimo",
      timestamp: Date.now(),
      status: "pending",
    });
  });
}

/**
 * Propostas ainda não resolvidas, da mais recente para a mais antiga.
 *
 * A ordenação é decrescente porque o dono revisa de cima para baixo e a proposta mais
 * nova é a que reflete a ficha mais atual — aprovar uma antiga por cima de uma nova
 * reverteria trabalho.
 *
 * O filtro `status === "pending"` é em memória (e não uma query) porque a coleção é
 * pequena por ficha e uma query com `where` exigiria índice composto junto da ordenação.
 *
 * @policy silent — devolve `[]` se falhar.
 * @returns {Promise<object[]>}
 */
export async function listPendingEdits(charId) {
  if (!charId) return [];
  return silent("publicSheetsRepo.listPendingEdits", [], async () => {
    const snap = await getDocs(colAt(pendingEditsCol(charId)));
    return snap.docs
      .map((d) => d.data())
      .filter((e) => e.status === "pending")
      .sort((a, b) => b.timestamp - a.timestamp);
  });
}

/**
 * Aprova/rejeita uma proposta.
 *
 * Grava por merge para não apagar `proposedData` — o histórico da proposta continua
 * legível depois de resolvida.
 *
 * @param {"approved"|"rejected"} status
 * @policy silent
 */
export async function resolvePendingEdit(charId, editId, status) {
  if (!charId || !editId) return;
  return silent("publicSheetsRepo.resolvePendingEdit", undefined, () =>
    setDoc(docAt(pendingEditDoc(charId, editId)), { status }, { merge: true })
  );
}
