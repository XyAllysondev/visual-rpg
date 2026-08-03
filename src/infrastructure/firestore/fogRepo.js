/**
 * Agregado Névoa do molde — `users/{uid}/worldmaps/{mapId}/media/fog`.
 *
 * Substitui as 6 chamadas cruas ao SDK que viviam em `components/WorldMap/fogStore.js`
 * (spec 0030, onda 1.5). O documento é um singleton: um molde tem UMA névoa, id fixo
 * (`FOG_DOC_ID`), e gravar substitui — não acumula.
 *
 * **Burro de propósito (AC-3).** A névoa é um bitmap comprimido (1 bit/px, downscale 4×,
 * RLE+varint) e TODA essa codificação mora em `WorldMap/model/fogMask.js`. Aqui a névoa é
 * uma string opaca: chega pronta em `save` e sai intacta em `get`. Um repositório que
 * soubesse comprimir névoa deixaria de ser porta e viraria uma segunda implementação da
 * feature — quem lê `fogMask.js` deixaria de saber qual das duas está no ar.
 *
 * Pela mesma razão a RECUSA por tamanho (`cabeNoDocumento`) fica no store: é regra de
 * negócio sobre o payload, e o repo não mede o que não sabe interpretar. O que não cabe
 * nunca chega aqui.
 *
 * **Política.** Tudo é `strict`: o legado propagava todo erro de I/O — `lerFog`/`salvarFog`/
 * `apagarFog` não tinham `try/catch`, e o `useFog` entregava o erro cru para a tela traduzir.
 * A onda 1.5 preserva comportamento (AC-7). A única falha engolida da névoa é a do payload
 * corrompido, e ela é do DECODIFICADOR — continua no store, onde sempre esteve.
 *
 * @see ../../../docs/architecture/adr/0010-camada-de-infraestrutura.md
 */
import { getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { docAt, NOOP_UNSUBSCRIBE } from "./client";
import { atelieMediaDoc, FOG_DOC_ID } from "./paths";

/**
 * O registro persistido da névoa, em campos planos.
 *
 * `data` é a máscara serializada e atravessa a fronteira SEM ser tocada. Os demais campos
 * são metadados baratos: existem para a UI responder "que mapa é este e quanto ele pesa"
 * sem precisar decodificar nada.
 *
 * @typedef {object} RegistroDeNevoa
 * @property {string} data     máscara serializada (opaca para este módulo)
 * @property {number} largura  largura do mundo em px
 * @property {number} altura   altura do mundo em px
 * @property {number} escala   fator do downscale da máscara
 * @property {number} bytes    tamanho de `data`
 */

const refDaNevoa = (uid, mapId) => docAt(atelieMediaDoc(uid, mapId, FOG_DOC_ID));

/**
 * Documento → registro plano.
 *
 * A projeção é explícita para deixar o `updatedAt` (um `Timestamp` do SDK) do lado de cá
 * da fronteira: nenhuma primitiva do SDK atravessa (AC-4), e ninguém na borda lê esse campo.
 * `data` sai como veio — inclusive torto: validar payload é do decodificador, no store.
 */
const registroDe = (dados) => ({
  data: dados.data,
  largura: dados.largura,
  altura: dados.altura,
  escala: dados.escala,
  bytes: dados.bytes,
});

/**
 * A névoa gravada, uma vez.
 *
 * @param {string} uid dono do molde
 * @param {string} mapId id do molde
 * @returns {Promise<RegistroDeNevoa|null>} `null` quando o molde nunca teve névoa
 * @policy strict — a Promise rejeita; quem chama traduz (o store recusa em PT-BR antes,
 *   e é por isso que o retorno cedo abaixo é defesa, não caminho quente).
 */
export async function get(uid, mapId) {
  if (!uid || !mapId) return null;
  const snap = await getDoc(refDaNevoa(uid, mapId));
  if (!snap.exists()) return null;
  return registroDe(snap.data() || {});
}

/**
 * Substitui a névoa do molde. Sem `merge`: a máscara se reescreve inteira, e um merge
 * deixaria para trás campos de uma névoa de outro tamanho.
 *
 * `updatedAt` é carimbado aqui porque `serverTimestamp()` é FieldValue do SDK e não pode
 * atravessar a fronteira (AC-4). Fora dele, o payload gravado é EXATAMENTE o que o store
 * passou — o repo não transforma névoa.
 *
 * @param {string} uid
 * @param {string} mapId
 * @param {RegistroDeNevoa} registro já serializado e já aprovado no teto de bytes
 * @returns {Promise<void>}
 * @policy strict — quem chama precisa saber que a névoa não foi ao banco.
 */
export async function save(uid, mapId, registro) {
  if (!uid || !mapId) return;
  await setDoc(refDaNevoa(uid, mapId), { ...registro, updatedAt: serverTimestamp() });
}

/**
 * Apaga a névoa. O molde continua de pé — some só a máscara, e o próximo carregamento
 * nasce com tudo coberto.
 *
 * @policy strict
 */
export async function remove(uid, mapId) {
  if (!uid || !mapId) return;
  await deleteDoc(refDaNevoa(uid, mapId));
}

/**
 * Assina a névoa do molde em tempo real.
 *
 * Sem uid ou sem mapId devolve um cancelamento inerte em vez de assinar — não é erro, é
 * "não há molde aberto". É o que permite o MAPA PADRÃO (que não existe no Firestore) usar
 * o hook sem condicional.
 *
 * @param {string} uid
 * @param {string} mapId
 * @param {(registro: RegistroDeNevoa|null) => void} aoDado `null` quando o doc não existe
 * @param {(erro: Error) => void} [aoErro]
 * @returns {() => void} unsubscribe (inerte e idempotente quando não assinou)
 * @policy strict — o erro do listener é entregue CRU a `aoErro`, sem log e sem fallback:
 *   a tela da névoa distingue `permission-denied` de queda de rede pelo `code`.
 */
export function watch(uid, mapId, aoDado, aoErro) {
  if (!uid || !mapId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    refDaNevoa(uid, mapId),
    (snap) => aoDado(snap.exists() ? registroDe(snap.data() || {}) : null),
    (e) => { if (aoErro) aoErro(e); }
  );
}
