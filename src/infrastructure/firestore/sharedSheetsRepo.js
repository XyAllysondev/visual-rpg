/**
 * Agregado Ficha na mesa — `campaigns/{campaignId}/sharedSheets`.
 *
 * Este repo existe, acima de tudo, para fechar UM vazamento concreto (spec 0029 AC-3):
 * o `App.jsx` guardava o `DocumentReference` cru de cada snapshot dentro de um `useRef`
 * (`liveSheetRefsRef`) e escrevia nele ~200 linhas depois, com o listener que produziu a
 * `ref` já podendo estar desmontado. Um handle vivo do SDK sobrevivendo ao seu próprio
 * listener é bomba silenciosa: nada no tipo avisa, e a escrita "funciona" até não funcionar.
 *
 * A troca: `watchLiveRefsByCharacter` devolve COORDENADAS EM STRING
 * (`{ [characterId]: [{ campaignId, sheetId }] }`) e `updateCharacterData` recebe essas
 * coordenadas de volta. Nenhum `DocumentReference`, `QuerySnapshot`, `Timestamp` ou
 * FieldValue atravessa a fronteira — `serverTimestamp()` fica aqui dentro.
 *
 * Política: o legado engolia o erro em TODAS as operações deste agregado
 * (`catch(e){console.error(e)}` ou `.catch(console.error)`), então tudo nasce `silent`.
 * A spec 0029 preserva comportamento (AC-7); consertar falha silenciosa é da onda 3.
 */
import { addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { docAt, colAt, silent, NOOP_UNSUBSCRIBE } from "./client";
import { sharedSheetsCol, sharedSheetDoc } from "./paths";
import { characterKey } from "../../domain/character";

const withId = (d) => ({ id: d.id, ...d.data() });

/** Nome exibido na mesa. O fallback é o do legado — ficha sem nome não vira `undefined`. */
const nomeExibido = (character, fallback = "Sem nome") =>
  character?.form?.personagem || fallback;

/**
 * Compartilha a ficha com a mesa e devolve o ID do doc criado.
 *
 * O `characterId` NÃO é reinventado aqui: vem de `characterKey` (domínio), o mesmo critério
 * que decide o doc em `users/{uid}/characters`. É ele que casa a ficha da mesa com a ficha
 * do dono na sincronização "ao vivo" — se divergirem, o live-sync para de achar o personagem.
 *
 * @param {string} campaignId
 * @param {{uid: string, userName: string, character: object, isLive: boolean}} params
 * @policy silent
 * @returns {Promise<string|null>} o `sheetId` novo, ou `null` se falhou — quem chama usa o
 *   `null` como "não anuncie no chat" (era assim no `fsShareSheet`, preservado no AC-7).
 */
export async function share(campaignId, { uid, userName, character, isLive }) {
  return silent("sharedSheetsRepo.share", null, async () => {
    const ref = await addDoc(colAt(sharedSheetsCol(campaignId)), {
      characterId: characterKey(character),
      ownerId: uid,
      ownerName: userName,
      characterName: nomeExibido(character),
      characterData: character,
      isLive,
      sharedAt: serverTimestamp(),
      permissions: { canView: "members" },
    });
    return ref.id;
  });
}

/**
 * Assina TODAS as fichas da mesa de uma campanha.
 *
 * Entrega objetos planos `{id, ...dados}` — o snapshot não sai daqui. A filtragem por
 * visibilidade/permissão continua na UI: é regra de apresentação, não de persistência.
 *
 * @param {(sheets: object[]) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function watchByCampaign(campaignId, onChange, onError) {
  if (!campaignId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    colAt(sharedSheetsCol(campaignId)),
    (snap) => onChange(snap.docs.map(withId)),
    (e) => {
      console.error("[sharedSheetsRepo.watchByCampaign] falhou:", e);
      if (onError) onError(e);
    }
  );
}

/**
 * Empurra o estado atual da ficha para o doc da mesa (o "ao vivo").
 *
 * A coordenada é um par de strings, NÃO um `DocumentReference` — é exatamente esta
 * assinatura que fecha o vazamento descrito no topo do arquivo.
 *
 * @param {{campaignId: string, sheetId: string}} coord vindo de `watchLiveRefsByCharacter`
 * @param {object} character ficha completa do dono
 * @param {{fallbackName?: string}} [opts] o painel de edição prefere manter o nome que já
 *   estava no doc quando a ficha editada vem sem nome; o live-sync usa o padrão "Sem nome".
 * @policy silent — o legado fazia `.catch(console.error)`; falhar aqui nunca derrubou a tela.
 * @returns {Promise<void>}
 */
export async function updateCharacterData({ campaignId, sheetId }, character, opts = {}) {
  return silent("sharedSheetsRepo.updateCharacterData", undefined, () =>
    updateDoc(docAt(sharedSheetDoc(campaignId, sheetId)), {
      characterData: character,
      characterName: nomeExibido(character, opts.fallbackName || "Sem nome"),
    })
  );
}

/**
 * Tira a ficha da mesa.
 * @policy silent @returns {Promise<void>}
 */
export async function remove(campaignId, sheetId) {
  return silent("sharedSheetsRepo.remove", undefined, () =>
    deleteDoc(docAt(sharedSheetDoc(campaignId, sheetId)))
  );
}

/**
 * O mestre define o Elemento da ficha na mesa.
 *
 * Grava com NOTAÇÃO DE PONTO de propósito: um `updateDoc` com o objeto `characterData`
 * inteiro sobrescreveria PV/SAN/PE que o jogador está mexendo no mesmo instante. Os quatro
 * campos são os do legado (`App.jsx` › MestrePanel.applyElement):
 *
 * - `elementoAfinidade`     — o elemento escolhido
 * - `elementoGmOverride`    — só `medo` é imposição do mestre; os outros o jogador poderia ter
 * - `elementoConcedidoPor`  — quem concedeu, e só faz sentido no `medo`; senão volta a `null`
 * - `elementoEscolhidoEm`   — epoch-ms local (o legado usa `Date.now()`, não `serverTimestamp`;
 *                             trocar mudaria o tipo lido pela UI, o que o AC-7 proíbe)
 *
 * @param {{elemento: string, uid: string}} params
 * @policy silent @returns {Promise<void>}
 */
export async function applyElement(campaignId, sheetId, { elemento, uid }) {
  return silent("sharedSheetsRepo.applyElement", undefined, () =>
    updateDoc(docAt(sharedSheetDoc(campaignId, sheetId)), {
      "characterData.elementoAfinidade": elemento,
      "characterData.elementoGmOverride": elemento === "medo",
      "characterData.elementoConcedidoPor": elemento === "medo" ? uid : null,
      "characterData.elementoEscolhidoEm": Date.now(),
    })
  );
}

/**
 * Rastreador global das fichas "ao vivo" do usuário, em TODAS as campanhas dele.
 *
 * É a peça central do AC-3. Assina uma coleção por campanha e mantém, na closure, um mapa
 * acumulado que é entregue por cópia a cada snapshot:
 *
 * ```
 * { [characterId]: [{ campaignId: "abc", sheetId: "xyz" }, …] }
 * ```
 *
 * Só coordenadas em string — jamais `d.ref`. O mapa acumula ENTRE campanhas de propósito:
 * a mesma ficha pode estar ao vivo em duas mesas ao mesmo tempo, e uma edição precisa chegar
 * às duas. Filtra `ownerId === uid && isLive`, como o legado; ficha que deixa de ser "ao vivo"
 * sai da lista, e o `characterId` some do mapa quando fica sem nenhuma.
 *
 * Herda do legado (AC-7) uma limitação conhecida: doc APAGADO não é removido do mapa, porque
 * ele simplesmente deixa de aparecer no snapshot. A escrita órfã resultante é `silent` e
 * some no próximo `updateCharacterData`. Consertar isso muda comportamento — fica pra onda 3.
 *
 * @param {string[]} campaignIds
 * @param {string} uid
 * @param {(porPersonagem: Record<string, {campaignId: string, sheetId: string}[]>) => void} onChange
 * @returns {() => void} unsubscribe ÚNICO e idempotente — cancela as N assinaturas de uma vez,
 *   para que quem chama não precise guardar (nem esquecer) um array de cancelamentos.
 */
export function watchLiveRefsByCharacter(campaignIds, uid, onChange) {
  if (!uid || !campaignIds || campaignIds.length === 0) return NOOP_UNSUBSCRIBE;

  // Estado do agregador vive na closure: nasce e morre com a assinatura, ao contrário do
  // `useRef` do legado, que sobrevivia ao listener que o alimentava.
  let porPersonagem = {};

  const unsubs = campaignIds.map((rawId) => {
    const campaignId = String(rawId);
    return onSnapshot(
      colAt(sharedSheetsCol(campaignId)),
      (snap) => {
        const next = { ...porPersonagem };
        snap.docs.forEach((d) => {
          const data = d.data() || {};
          if (data.ownerId !== uid) return;
          const cId = data.characterId;
          // Remove a coordenada antiga DESTE doc antes de decidir se ele volta: é o que
          // faz "desligar o ao vivo" sumir do mapa em vez de duplicar a entrada.
          const restantes = (next[cId] || []).filter(
            (c) => !(c.campaignId === campaignId && c.sheetId === d.id)
          );
          if (data.isLive) restantes.push({ campaignId, sheetId: d.id });
          if (restantes.length) next[cId] = restantes;
          else delete next[cId];
        });
        porPersonagem = next;
        onChange({ ...porPersonagem });
      },
      (e) => console.error("[sharedSheetsRepo.watchLiveRefsByCharacter] falhou:", e)
    );
  });

  let cancelado = false;
  return () => {
    if (cancelado) return;
    cancelado = true;
    unsubs.forEach((u) => u());
  };
}
