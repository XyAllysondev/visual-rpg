/**
 * Mapa-Múndi — camada de persistência do ATELIÊ (spec 0028, F1: AC-1/AC-2/AC-3).
 *
 * Único ponto de contato do Mapa-Múndi com o Firestore. Nenhum componente de
 * `WorldMap/` deve importar `firebase/firestore` direto: tudo passa por aqui,
 * para que o modelo fique num lugar só e possa ser testado com o SDK mockado.
 * Segue o precedente da casa (`MasterSuite/worldsStore.js`).
 *
 * Modelo — só o lado do Ateliê nesta fase (design.md §3):
 *   users/{uid}/worldmaps/{mapId}
 *     name, description, backgroundUrl, backgroundPath, backgroundRef,
 *     backgroundThumb, width, height, fogEnabled, defaultRevealRadius,
 *     nodeCount, createdAt, updatedAt
 *   users/{uid}/worldmaps/{mapId}/media/background          ← a ilustração cheia
 *   users/{uid}/worldmaps/{mapId}/nodes|edges|events/{id}   ← F2 em diante
 *
 * AC-1 (segredo estrutural): este caminho é privado do mestre. As rules negam
 * leitura a qualquer outro uid — jogador NUNCA lê daqui. O que a mesa enxerga
 * nasce em `campaigns/{cid}/...` no ato da revelação (F4). Não abra leitura
 * aqui por conveniência: é o mecanismo de segredo inteiro.
 *
 * Regras da casa:
 *  · entrada inválida vira `Error` em PT-BR; erro do Firestore sobe para quem
 *    chamou (nos hooks, vira o campo `error`). Nada falha em silêncio.
 *  · `createAt`/`updatedAt` usam `serverTimestamp()`; toda escrita mexe em
 *    `updatedAt`.
 *  · a tradução de erro de infra para frase de gente é do
 *    `MasterSuite/model/erros.js` (`mensagemDeErro`) — não existe outro tradutor.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O FUNDO DO MAPA MORA EM DOIS LUGARES POSSÍVEIS — leia antes de mexer
 *
 * Verificação empírica de 2026-08-01 (passo 0 da F1): o bucket do projeto NÃO
 * está provisionado. `POST /v0/b/nexus-rpg-app.firebasestorage.app/o` responde
 * **HTTP 404 "Not Found"** (não 403), e o mesmo para `nexus-rpg-app.appspot.com`;
 * o SDK traduz isso para `storage/unknown` com `serverResponse` vazio. O projeto
 * está no plano **Spark** (`firebase apphosting:backends:list` recusa por plano),
 * e desde out/2024 o Storage exige **Blaze** para criar o bucket padrão.
 *
 * **DECISÃO DO ANDRE (2026-08-01): plano B, por enquanto.** *"vamos fazer no
 * gratuito hoje, quando estivermos finalizando o desenvolvimento do projeto eu
 * faço isso"* (subir para Blaze). Então o fundo vira **base64 no Firestore**,
 * como o resto do app já faz — não é gambiarra, é uma degradação consciente e
 * temporária (ADR-0008, opção B).
 *
 * Por isso `uploadBackground` tem DOIS caminhos, escolhidos por capacidade:
 *
 *   `fundoDisponivel() === true`  → Firebase Storage. O arquivo vai inteiro,
 *      em resolução alta, e o documento guarda só a URL. **Este caminho fica
 *      aqui de propósito, escrito e pronto** — no dia em que o projeto subir
 *      para Blaze, basta `fundoDisponivel()` voltar a `true` (ver a função).
 *
 *   `fundoDisponivel() === false` → base64 no Firestore (hoje). A imagem é
 *      reduzida no cliente em dois estágios (1600px/q0.82 → 1200px/q0.7) e
 *      precisa caber em `LIMITE_FUNDO_BYTES`; se não couber, o envio é
 *      **recusado em português**, nunca gravado pela metade.
 *
 * Onde a imagem base64 é gravada importa tanto quanto o formato: ela vai num
 * documento SEPARADO (`.../worldmaps/{mapId}/media/background`), nunca no doc
 * raiz do mapa. O doc raiz é o que `useWorldMaps` assina — se a ilustração
 * morasse nele, a grade do Ateliê baixaria todos os fundos, inteiros, a cada
 * snapshot. O raiz guarda só o ponteiro (`backgroundRef`), as dimensões e uma
 * **miniatura** de ~200px para o card. Isso é gate de teste, não estilo.
 *
 * QUANDO O BLAZE ENTRAR: (1) provisionar o bucket e publicar `storage.rules`
 * (o bloco `storage` também precisa entrar em `firebase.json`); (2) trocar o
 * corpo de `fundoDisponivel()` para `true`; (3) escrever a migração dos
 * `media/background` já existentes para o Storage — o modelo aceita os dois,
 * mas os mapas antigos não se movem sozinhos; (4) `deleteWorldMap` passa a
 * precisar de `deleteObject` no arquivo (ver o comentário lá).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect } from "react";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, collection, addDoc, query, orderBy,
  onSnapshot, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { mensagemDeErro } from "../MasterSuite/model/erros";
import { canCreateMap, quotaFor } from "./model/quotas";

/* ── Constantes ──────────────────────────────────────────────────────────── */

export const USERS = "users";
export const WORLDMAPS = "worldmaps";

/** Subcoleções do molde, na ordem em que devem ser varridas ao apagar (F2+). */
export const SUBCOLECOES = ["nodes", "edges", "events"];

/**
 * Subcoleção de mídia do molde e o id fixo do documento do fundo.
 *
 * É documento SEPARADO do doc raiz de propósito: ver o cabeçalho do arquivo.
 * O id é fixo (não content-addressed como em `campaignSync2`) porque um molde
 * tem UM fundo — trocar a ilustração substitui a anterior em vez de acumular
 * lixo que ninguém apaga. O content-addressing sobrevive no campo `hash`, que
 * é o que evita reescrever o mesmo payload (dedup).
 */
export const MEDIA = "media";
export const FUNDO_DOC_ID = "background";

/** Valor de `backgroundRef` no doc raiz quando a ilustração está em base64. */
export const FUNDO_REF = `${MEDIA}/${FUNDO_DOC_ID}`;

/** Limite duro do Firestore: 500 operações por `writeBatch`. */
export const BATCH_LIMIT = 500;

/**
 * Raio de revelação inicial de um mapa novo, em unidades de mundo. É só o ponto
 * de partida: o mestre ajusta por mapa, e cada nó pode ter o seu (`revealRadius`).
 */
export const RAIO_DE_REVELACAO_PADRAO = 120;

/* ── Helpers de validação / normalização ─────────────────────────────────── */

const asText = (value) => (typeof value === "string" ? value.trim() : "");

/** Devolve o texto aparado ou lança `Error` com a mensagem informada. */
function requireText(value, message) {
  const text = asText(value);
  if (!text) throw new Error(message);
  return text;
}

/** Número finito e não-negativo, ou o padrão informado. */
const asNumber = (value, padrao = 0) =>
  (Number.isFinite(value) && value >= 0 ? value : padrao);

/* ── Helpers de caminho ──────────────────────────────────────────────────── */

const mapsCol = (uid) => collection(db, USERS, uid, WORLDMAPS);
const mapRef = (uid, mapId) => doc(db, USERS, uid, WORLDMAPS, mapId);
const subCol = (uid, mapId, nome) => collection(db, USERS, uid, WORLDMAPS, mapId, nome);
const fundoRef = (uid, mapId) =>
  doc(db, USERS, uid, WORLDMAPS, mapId, MEDIA, FUNDO_DOC_ID);

/**
 * `serverTimestamp()` chega `null` no snapshot local (latency compensation) até
 * o servidor confirmar — o que jogaria o mapa recém-criado para o FIM da lista
 * ordenada por `updatedAt` e mostraria "—" no tempo relativo.
 * `serverTimestamps:"estimate"` entrega uma estimativa local no lugar do `null`.
 */
const snapToList = (snap) =>
  snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));

/**
 * Aplica operações em lotes de no máximo `BATCH_LIMIT`, respeitando o limite do
 * Firestore. `ops` é uma lista de `{ type: 'set'|'update'|'delete', ref, data }`.
 * A ordem é preservada: o que precisa acontecer por último deve vir por último.
 */
async function commitOps(ops) {
  if (!ops.length) return;
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      if (op.type === "delete") batch.delete(op.ref);
      else if (op.type === "update") batch.update(op.ref, op.data);
      else batch.set(op.ref, op.data);
    }
    // Sequencial de propósito: lotes são atômicos entre si, não em conjunto.
    await batch.commit(); // eslint-disable-line no-await-in-loop
  }
}

/* ── Cota (AC-3) ─────────────────────────────────────────────────────────── */

/**
 * Quantos mapas o mestre já tem. Só é chamado quando o plano TEM teto — no
 * plano ilimitado a contagem seria uma leitura da coleção inteira à toa.
 *
 * Falha de leitura NÃO libera a criação: sem saber a contagem não dá para
 * afirmar que cabe mais um, então o erro sobe traduzido (AC-3: nada falha em
 * silêncio, e o teto não pode ser burlado por uma query que caiu).
 */
async function contarMapas(uid) {
  try {
    const snap = await getDocs(mapsCol(uid));
    return snap.size;
  } catch (e) {
    console.error("[worldMapStore] falha ao contar os mapas-múndi do mestre:", e);
    throw new Error(
      `Não foi possível conferir quantos mapas-múndi você já tem, então a criação foi cancelada. ${mensagemDeErro(e)}`,
    );
  }
}

/* ── Mapas-múndi (moldes do Ateliê) ──────────────────────────────────────── */

/**
 * Cria um molde de mapa-múndi. Só `name` é obrigatório (AC-2).
 *
 * A cota do plano é checada ANTES de escrever (AC-3): o plano vem em
 * `data.plan`, porque o store não tem como descobri-lo sozinho — quem chama já
 * o tem em mãos (`users/{uid}.plan` / `subscribedSystems`, ver `model/quotas.js`).
 * **Plano ausente é tratado como `free`**, o mais restritivo: é melhor recusar
 * um mestre pagante (que reclama e é destravado) do que estourar a cota calado.
 *
 * Os quatro campos do fundo nascem `null` — o mapa novo não tem ilustração, e
 * qual deles será preenchido depende do caminho que `uploadBackground` tomar
 * (Storage → `backgroundUrl`+`backgroundPath`; base64 → `backgroundRef`+
 * `backgroundThumb`). Ver o cabeçalho do arquivo.
 *
 * @param {string} uid dono do mapa.
 * @param {{name:string, plan?:string, description?:string, width?:number,
 *          height?:number, fogEnabled?:boolean, defaultRevealRadius?:number}} data
 * @returns {Promise<string>} id do mapa criado.
 * @throws {Error} em PT-BR quando falta nome/uid ou quando a cota do plano estourou.
 */
export async function createWorldMap(uid, data = {}) {
  const ownerUid = requireText(uid, "É preciso estar autenticado para criar um mapa-múndi.");
  const name = requireText(data.name, "Dê um nome ao mapa-múndi antes de criá-lo.");

  const plano = asText(data.plan);
  const temTeto = Number.isFinite(quotaFor(plano).maps);
  const quantos = temTeto ? await contarMapas(ownerUid) : 0;
  const veredito = canCreateMap(plano, quantos);
  if (!veredito.ok) throw new Error(veredito.motivo);

  const ref = await addDoc(mapsCol(ownerUid), {
    name,
    description: asText(data.description),
    // Fundo — caminho Storage (volta com o Blaze):
    backgroundUrl: null,
    backgroundPath: null,
    // Fundo — caminho base64 (hoje): ponteiro para `media/background` + miniatura
    // do card. A ilustração CHEIA nunca entra neste documento.
    backgroundRef: null,
    backgroundThumb: null,
    // 0 = "ainda sem fundo". As dimensões reais vêm da ilustração quando ela existir.
    width: asNumber(data.width, 0),
    height: asNumber(data.height, 0),
    fogEnabled: data.fogEnabled !== false, // névoa ligada por padrão (AC-5)
    defaultRevealRadius: asNumber(data.defaultRevealRadius, RAIO_DE_REVELACAO_PADRAO),
    // Contador denormalizado: é o que a cota de nós (AC-3) e as rules consultam
    // sem varrer a subcoleção. Quem cria/apaga nó em F2 é responsável por mantê-lo.
    nodeCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Atualiza campos do molde. `name`, se vier, é validado (não pode esvaziar).
 *
 * @param {string} uid dono do mapa.
 * @param {string} mapId id do mapa.
 * @param {object} patch campos a alterar.
 * @throws {Error} em PT-BR quando falta uid/mapId ou o patch é inválido.
 */
export async function updateWorldMap(uid, mapId, patch = {}) {
  const ownerUid = requireText(uid, "É preciso estar autenticado para editar um mapa-múndi.");
  const id = requireText(mapId, "Informe qual mapa-múndi deve ser atualizado.");
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("Informe os campos do mapa-múndi que devem ser atualizados.");
  }
  const data = { ...patch, updatedAt: serverTimestamp() };
  if ("name" in patch) {
    data.name = requireText(patch.name, "O nome do mapa-múndi não pode ficar vazio.");
  }
  if ("description" in patch) data.description = asText(patch.description);
  if ("fogEnabled" in patch) data.fogEnabled = patch.fogEnabled !== false;
  if ("defaultRevealRadius" in patch) {
    data.defaultRevealRadius = asNumber(patch.defaultRevealRadius, RAIO_DE_REVELACAO_PADRAO);
  }
  if ("width" in patch) data.width = asNumber(patch.width, 0);
  if ("height" in patch) data.height = asNumber(patch.height, 0);
  // `plan` é insumo da cota, não campo do documento — nunca é persistido.
  delete data.plan;
  await updateDoc(mapRef(ownerUid, id), data);
}

/**
 * Remove o molde e TODAS as suas subcoleções (nós, trilhas, eventos).
 * O Firestore não apaga subcoleção em cascata — a varredura é nossa.
 *
 * O molde sai por ÚLTIMO: se a varredura falhar no meio, o mestre ainda vê o
 * mapa na lista e pode tentar de novo, em vez de ficar com órfãos invisíveis.
 *
 * O documento de mídia (`media/background`) entra no mesmo lote, sem leitura
 * prévia: o id é fixo, e apagar um documento que não existe é no-op no
 * Firestore. Se ele ficasse para trás, a ilustração continuaria ocupando espaço
 * (e cota) num mapa que o mestre acha que sumiu.
 *
 * QUANDO O BLAZE ENTRAR: mapas com `backgroundPath` preenchido também têm um
 * arquivo no bucket. Aqui vai precisar de um `getDoc` do molde + `deleteObject`
 * ANTES do lote — senão o arquivo vira órfão pago.
 *
 * @param {string} uid dono do mapa.
 * @param {string} mapId id do mapa.
 */
export async function deleteWorldMap(uid, mapId) {
  const ownerUid = requireText(uid, "É preciso estar autenticado para remover um mapa-múndi.");
  const id = requireText(mapId, "Informe qual mapa-múndi deve ser removido.");

  const ops = [];
  for (const nome of SUBCOLECOES) {
    const snap = await getDocs(subCol(ownerUid, id, nome)); // eslint-disable-line no-await-in-loop
    snap.docs.forEach((d) => ops.push({ type: "delete", ref: d.ref }));
  }
  ops.push({ type: "delete", ref: fundoRef(ownerUid, id) }); // a ilustração
  ops.push({ type: "delete", ref: mapRef(ownerUid, id) });   // o molde por último
  await commitOps(ops);
  fundoCache.delete(chaveDoFundo(ownerUid, id));
}

/**
 * Lê um molde avulso (sem listener). `null` quando não existe.
 *
 * @param {string} uid dono do mapa.
 * @param {string} mapId id do mapa.
 * @returns {Promise<object|null>}
 */
export async function getWorldMap(uid, mapId) {
  const ownerUid = requireText(uid, "É preciso estar autenticado para abrir um mapa-múndi.");
  const id = requireText(mapId, "Informe qual mapa-múndi deve ser carregado.");
  const snap = await getDoc(mapRef(ownerUid, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* ── Fundo do mapa ───────────────────────────────────────────────────────────
 *
 * Dois caminhos, um contrato só. Ver o cabeçalho do arquivo para o PORQUÊ; aqui
 * está o COMO. A abordagem do base64 é a MESMA da mesa tática
 * (`MapEditor/sync/campaignSync2.js:41-101`) — dois estágios de redução, teto de
 * ~900 KB por documento, hash SHA-256 para dedup e cache de módulo. Não é uma
 * segunda invenção: é o padrão da casa aplicado a outro documento.
 * (`WorldMap/` não importa nada de `MapEditor/` — são componentes irmãos,
 * AC-12 —, então o punhado de linhas abaixo é deliberadamente paralelo.)
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Teto de bytes da ilustração já reduzida. O limite duro de um documento do
 * Firestore é 1 MiB (1.048.576 bytes) contando TODOS os campos; 900 KB deixa
 * folga para `hash`, dimensões e carimbos sem chegar perto da borda — se o doc
 * estourar, o Firestore recusa a escrita inteira.
 */
export const LIMITE_FUNDO_BYTES = 900_000;

/**
 * Teto da miniatura que vai no doc raiz. ~200px em JPEG q0.6 dá alguns KB; este
 * teto é o cinto de segurança que impede a ilustração cheia de escorregar para
 * o doc raiz e ser baixada por `useWorldMaps` a cada snapshot. Se a miniatura
 * passar disso, o doc raiz fica SEM miniatura — o card mostra "sem ilustração",
 * o que é infinitamente melhor do que degradar a grade do Ateliê.
 */
export const TETO_MINIATURA_BYTES = 48_000;

/** Estágios de redução, na ordem. Mesmos números da mesa tática. */
export const ESTAGIOS_DE_REDUCAO = [
  { maxDim: 1600, qualidade: 0.82 },
  { maxDim: 1200, qualidade: 0.7 },
];

/** Miniatura do card da lista: pequena de propósito. */
const MINIATURA = { maxDim: 200, qualidade: 0.6 };

/**
 * Recusa por tamanho, em PT-BR. Exportada para que a tela possa dizer o limite
 * ANTES de o mestre escolher o arquivo, em vez de só no erro.
 */
export const FUNDO_GRANDE_DEMAIS =
  "Esta imagem não cabe no mapa nem depois de reduzida automaticamente (o limite "
  + "é de cerca de 0,9 MB por ilustração). Escolha uma imagem menor, com menos "
  + "detalhe, ou recorte só a área que importa — nada foi salvo.";

/**
 * Aviso honesto sobre ONDE a ilustração está sendo guardada hoje. A tela mostra
 * isto quando `fundoDisponivel()` é `false`, para o mestre entender por que a
 * arte é reduzida.
 */
export const AVISO_FUNDO_NO_DOCUMENTO =
  "Enquanto o armazenamento de arquivos do Nexus não é ligado, a ilustração fica "
  + "guardada dentro do próprio mapa. Ela é reduzida automaticamente e precisa "
  + "caber em cerca de 0,9 MB, então mapas muito grandes perdem um pouco de "
  + "nitidez. Quando o armazenamento entrar, dá para subir a arte em alta.";

/**
 * O caminho do Firebase Storage está de pé?
 *
 * Hoje **não**: o bucket não existe (404 comprovado, plano Spark — ADR-0008).
 * Enquanto isto for `false`, `uploadBackground` grava base64 no Firestore.
 *
 * QUANDO O BLAZE ENTRAR: esta função vira `true` e o caminho do Storage passa a
 * ser usado sozinho. É o ÚNICO interruptor — não espalhe a condição pela tela.
 */
export const fundoDisponivel = () => false;

/* Cache de módulo da ilustração cheia, `uid/mapId` → dataURL. O fundo só muda
 * quando o mestre sobe outro, então reler o documento a cada abertura do molde
 * seria pagar ~900 KB de leitura à toa. Invalidado no upload e na exclusão. */
const fundoCache = new Map();
const chaveDoFundo = (uid, mapId) => `${uid}/${mapId}`;

/* ── Helpers de imagem (só rodam no navegador) ───────────────────────────── */

/** Lê o `File` como dataURL. Rejeita em PT-BR — leitura que falha não é sucesso. */
function lerComoDataURL(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(
        "Não foi possível ler a imagem escolhida. Tente selecionar o arquivo de novo.",
      ));
      reader.readAsDataURL(file);
    } catch (e) {
      console.error("[worldMapStore] leitura do arquivo falhou:", e);
      reject(new Error("Não foi possível ler a imagem escolhida. Tente selecionar o arquivo de novo."));
    }
  });
}

/** Dimensões reais da imagem. `{width:0,height:0}` quando não dá para medir. */
function medir(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width || 0, height: img.height || 0 });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

/**
 * Redesenha a imagem num canvas menor e devolve JPEG.
 * `null` quando o navegador não conseguiu (sem 2d context, imagem corrompida) —
 * quem chama trata o `null` mantendo o original e recusa mais adiante se ainda
 * não couber. Nunca devolve algo que finge ter reduzido.
 */
function reduzir(dataUrl, maxDim, qualidade) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const largura = img.width || 1;
        const altura = img.height || 1;
        const escala = Math.min(1, maxDim / Math.max(largura, altura));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(largura * escala));
        canvas.height = Math.max(1, Math.round(altura * escala));
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const saida = canvas.toDataURL("image/jpeg", qualidade);
        // `data:,` é o que o canvas devolve quando não há nada desenhado.
        resolve(typeof saida === "string" && saida.length > 32
          ? { dataUrl: saida, width: canvas.width, height: canvas.height }
          : null);
      } catch (e) {
        console.error("[worldMapStore] redução da ilustração falhou:", e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Miniatura do card, ou `null` (com aviso no console) se não deu ou ficou grande. */
async function miniaturaDe(dataUrl) {
  const pequena = await reduzir(dataUrl, MINIATURA.maxDim, MINIATURA.qualidade);
  if (!pequena) {
    console.warn("[worldMapStore] não foi possível gerar a miniatura do fundo; o card fica sem prévia.");
    return null;
  }
  if (pequena.dataUrl.length > TETO_MINIATURA_BYTES) {
    console.warn("[worldMapStore] miniatura acima do teto; o card fica sem prévia para não inchar a lista.");
    return null;
  }
  return pequena.dataUrl;
}

/**
 * SHA-256 → 16 hex. Só serve para dedup (evitar reescrever payload idêntico);
 * se `crypto.subtle` não existir, um valor aleatório apenas desliga o dedup —
 * nunca faz o upload falhar.
 */
async function hashDataUrl(dataUrl) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dataUrl));
    return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

/* ── uploadBackground ────────────────────────────────────────────────────── */

/**
 * Sobe a ilustração de fundo do molde.
 *
 * A assinatura e o retorno são os MESMOS nos dois caminhos, para que a tela não
 * precise saber onde a imagem foi parar:
 *   · Storage → `url` é a download URL e `path` é o caminho no bucket;
 *   · base64  → `url` é a própria dataURL e `path` é `null`.
 *
 * @param {string} uid dono do mapa.
 * @param {string} mapId id do mapa.
 * @param {File} file imagem escolhida pelo mestre.
 * @returns {Promise<{url:string, path:string|null, width:number, height:number}>}
 * @throws {Error} em PT-BR quando falta uid/mapId/arquivo, quando a imagem não
 *   cabe nem reduzida, ou quando a escrita é recusada pelo servidor.
 */
export async function uploadBackground(uid, mapId, file) {
  const ownerUid = requireText(uid, "É preciso estar autenticado para enviar a ilustração do mapa.");
  const id = requireText(mapId, "Informe a qual mapa-múndi a ilustração pertence.");
  if (!file) throw new Error("Escolha uma imagem antes de enviar.");

  return fundoDisponivel()
    ? subirParaStorage(ownerUid, id, file)
    : subirParaFirestore(ownerUid, id, file);
}

/**
 * Caminho base64 (hoje). Reduz até caber, grava a ilustração num documento
 * separado e deixa no doc raiz só o ponteiro, as dimensões e a miniatura.
 */
async function subirParaFirestore(uid, mapId, file) {
  let data = await lerComoDataURL(file);
  if (!data || !data.startsWith("data:")) {
    throw new Error("O arquivo escolhido não parece uma imagem válida. Tente outro.");
  }
  let { width, height } = await medir(data);

  /* Dois estágios, na ordem — o segundo só roda se o primeiro não bastou. */
  if (data.length > LIMITE_FUNDO_BYTES) {
    const menor = await reduzir(data, ESTAGIOS_DE_REDUCAO[0].maxDim, ESTAGIOS_DE_REDUCAO[0].qualidade);
    if (menor) ({ dataUrl: data, width, height } = menor);
  }
  if (data.length > LIMITE_FUNDO_BYTES) {
    const menor = await reduzir(data, ESTAGIOS_DE_REDUCAO[1].maxDim, ESTAGIOS_DE_REDUCAO[1].qualidade);
    if (menor) ({ dataUrl: data, width, height } = menor);
  }
  /* Recusa ANTES de escrever: um documento acima do limite é rejeitado inteiro
   * pelo Firestore, e o mestre ficaria com um erro do SDK em inglês. */
  if (data.length > LIMITE_FUNDO_BYTES) throw new Error(FUNDO_GRANDE_DEMAIS);

  const miniatura = await miniaturaDe(data);
  const hash = await hashDataUrl(data);

  /* Dedup: se o documento já tem exatamente esta imagem, não reescreve ~900 KB
   * à toa. A falha da leitura não impede o upload — só desliga o dedup. */
  const alvo = fundoRef(uid, mapId);
  const atual = await getDoc(alvo).catch((e) => {
    console.warn("[worldMapStore] não deu para conferir o fundo atual (dedup desligado):", e);
    return null;
  });
  const jaEstaLa = !!atual && atual.exists() && atual.data()?.hash === hash;

  if (!jaEstaLa) {
    await setDoc(alvo, {
      kind: "background",
      data,
      hash,
      width,
      height,
      bytes: data.length,
      updatedAt: serverTimestamp(),
    });
  }

  /* O doc raiz recebe SÓ o ponteiro e a miniatura — nunca `data`. Este objeto é
   * gate de teste (`worldMapStore.test.js`): a lista de mapas é assinada em
   * tempo real e não pode trafegar a ilustração inteira a cada snapshot. */
  await updateDoc(mapRef(uid, mapId), {
    backgroundRef: FUNDO_REF,
    backgroundThumb: miniatura,
    backgroundUrl: null,   // limpa o caminho Storage: a fonte da verdade é uma só
    backgroundPath: null,
    width,
    height,
    updatedAt: serverTimestamp(),
  });

  fundoCache.set(chaveDoFundo(uid, mapId), data);
  return { url: data, path: null, width, height };
}

/**
 * Caminho Firebase Storage. **Não é código morto: é o caminho que volta a valer
 * no dia em que `fundoDisponivel()` virar `true`** (plano Blaze). O import é
 * dinâmico de propósito — enquanto o bucket não existe, `firebase/storage` não
 * precisa entrar no bundle inicial nem ser inicializado.
 */
async function subirParaStorage(uid, mapId, file) {
  const { getStorage, ref: arquivoRef, uploadBytes, getDownloadURL } = await import("firebase/storage");

  const tipo = file.type || "image/png";
  const extensao = (tipo.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "") || "png";
  const caminho = `worldmaps/${uid}/${mapId}/background.${extensao}`;

  const alvo = arquivoRef(getStorage(), caminho);
  await uploadBytes(alvo, file, { contentType: tipo });
  const url = await getDownloadURL(alvo);

  /* Dimensões e miniatura saem do arquivo local: subir e depois baixar a
   * própria imagem para medir seria absurdo. Se a leitura local falhar, o
   * upload continua válido — só o card fica sem prévia. */
  const local = await lerComoDataURL(file).catch(() => "");
  const { width, height } = local ? await medir(local) : { width: 0, height: 0 };
  const miniatura = local ? await miniaturaDe(local) : null;

  await updateDoc(mapRef(uid, mapId), {
    backgroundUrl: url,
    backgroundPath: caminho,
    backgroundRef: null,   // a fonte da verdade passa a ser o arquivo
    backgroundThumb: miniatura,
    width,
    height,
    updatedAt: serverTimestamp(),
  });

  fundoCache.delete(chaveDoFundo(uid, mapId));
  return { url, path: caminho, width, height };
}

/**
 * Ilustração CHEIA do molde, sob demanda. `null` quando o mapa não tem fundo em
 * base64 (nunca subiu, ou o fundo está no Storage e mora em `backgroundUrl`).
 *
 * Existe porque o doc raiz guarda só a miniatura: a tela do molde aberto pede
 * a imagem de verdade aqui, uma vez, e o cache de módulo cobre as reaberturas.
 * O erro de leitura SOBE — quem chama mostra a frase; nada falha em silêncio.
 *
 * @param {string} uid dono do mapa.
 * @param {string} mapId id do mapa.
 * @returns {Promise<string|null>} dataURL da ilustração, ou `null`.
 */
export async function getBackground(uid, mapId) {
  const ownerUid = requireText(uid, "É preciso estar autenticado para abrir a ilustração do mapa.");
  const id = requireText(mapId, "Informe de qual mapa-múndi é a ilustração.");

  const chave = chaveDoFundo(ownerUid, id);
  if (fundoCache.has(chave)) return fundoCache.get(chave);

  const snap = await getDoc(fundoRef(ownerUid, id));
  const data = snap.exists() ? (snap.data()?.data || null) : null;
  if (data) fundoCache.set(chave, data);
  return data;
}

/* ── Hooks ───────────────────────────────────────────────────────────────── */

/**
 * Moldes do mestre, do mais recente para o mais antigo (AC-2).
 *
 * Sem uid não assina nada e devolve lista vazia — não é erro, é "ninguém logado
 * ainda". O listener é desfeito na troca de uid e na desmontagem.
 *
 * `error` é o erro CRU (tem `.code`, útil para decidir); a frase para a tela sai
 * de `mensagemDeErro(error)` — o tradutor único da casa.
 *
 * Infra: `orderBy('updatedAt')` sozinho numa subcoleção NÃO exige índice
 * composto (diferente de `useWorlds`, que filtra por `ownerUid`) — a posse aqui
 * está no caminho do documento, não num campo.
 *
 * @param {string} uid dono dos mapas.
 * @returns {{ maps: object[], loading: boolean, error: Error|null }}
 */
export function useWorldMaps(uid) {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) { setMaps([]); setLoading(false); setError(null); return undefined; }
    setLoading(true);
    setError(null);
    const unsub = onSnapshot(
      query(mapsCol(uid), orderBy("updatedAt", "desc")),
      (snap) => { setMaps(snapToList(snap)); setLoading(false); },
      (err) => { setError(err); setMaps([]); setLoading(false); },
    );
    return () => unsub();
  }, [uid]);

  return { maps, loading, error };
}
