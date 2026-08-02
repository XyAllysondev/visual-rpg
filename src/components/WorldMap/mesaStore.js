/* ════════════════════════════════════════════════════════════════════
 *  PERSISTÊNCIA DA MESA  (spec 0028 · F4 · AC-1, AC-7, AC-10)
 *  --------------------------------------------------------------------
 *  O lado da CAMPANHA do Mapa-Múndi. O `worldMapStore.js` é dono do
 *  MOLDE (privado do mestre, em `users/{uid}/worldmaps/**`); este arquivo
 *  é dono da INSTÂNCIA — o mesmo mapa levado a uma mesa, com o progresso
 *  daquele grupo.
 *
 *  ════════════════════════════════════════════════════════════════════
 *  ISTO AQUI É O MECANISMO DE SEGREDO — leia antes de mexer em qualquer
 *  linha deste arquivo.
 *  ════════════════════════════════════════════════════════════════════
 *
 *  O AC-1 exige que um jogador com o DevTools aberto **não consiga obter**
 *  nome, posição, descrição ou notas de nó `hidden`, de trilha secreta, nem
 *  o texto de mestre de um evento que não disparou — inspecionando o
 *  tráfego de rede REAL, não a pintura da tela.
 *
 *  Isso não é garantido por filtro de render. É garantido por **separação
 *  de documento**:
 *
 *    · o molde inteiro (com `gmNotes`, `gmText`, `isSecret`,
 *      `discoveryCheck`, nós ocultos e trilhas secretas) vive em
 *      `users/{uid}/worldmaps/**`, que as rules negam a qualquer outro uid;
 *    · a campanha recebe **só o que já foi revelado**, em documentos
 *      criados NO ATO da revelação, com uma projeção de campos em LISTA
 *      BRANCA (`projecaoDoNo`/`projecaoDaTrilha`/`projecaoDoEvento`).
 *
 *  Consequência prática, e ela é inegociável: **nunca** faça
 *  `setDoc(alvo, { ...noDoMolde })` aqui. Espalhar o objeto do molde num
 *  documento da campanha derruba o AC-1 inteiro num único caractere. Toda
 *  cópia passa pelas projeções abaixo, e cada projeção enumera os campos
 *  que saem — nunca os que ficam.
 *
 *  ── O CAMINHO ───────────────────────────────────────────────────────
 *    campaigns/{cid}/worldmaps/{instanceId}
 *      sourceUid, sourceMapId, masterUid, name, width, height, fogEnabled,
 *      backgroundThumb, backgroundRef|backgroundUrl, ilustracao, startNodeId
 *
 *    campaigns/{cid}/worldmaps/{instanceId}/media/background   ← cópia da arte
 *    campaigns/{cid}/worldmaps/{instanceId}/revealed/{docId}   ← só o revelado
 *    campaigns/{cid}/worldmaps/{instanceId}/party/estado
 *    campaigns/{cid}/worldmaps/{instanceId}/fog/estado
 *    campaigns/{cid}/worldmaps/{instanceId}/gm/estado          ← jogador nem lê
 *
 *  O design §3 desenha `party`, `fog` e `gm` como o último segmento do
 *  caminho — o que, no Firestore, é o nome de uma COLEÇÃO (documento e
 *  coleção se alternam). Cada uma delas guarda um único documento de id
 *  fixo, `estado`. É a mesma forma que a mesa tática já usa em
 *  `campaigns/{cid}/map/{docId}` com ids fixos, e é o que permite as rules
 *  do design (`gm` só do mestre, `party` também do jogador que move)
 *  saírem como três blocos separados, sem `if` de id dentro de um bloco só.
 *
 *  ════════════════════════════════════════════════════════════════════
 *  POR QUE O `instanceId` COMEÇA COM O UID DO MESTRE  — e por que isso
 *  não é enfeite
 *  ════════════════════════════════════════════════════════════════════
 *
 *  O Firestore permite no máximo **20 "access calls"** (`get()`/`exists()`
 *  nas rules) por escrita em LOTE — e o orçamento é do lote inteiro, não de
 *  cada documento. `isMaster(campaignId)` é um `get()`. Uma revelação de
 *  região grava dezenas de documentos em `revealed/` num lote só; com a
 *  regra baseada em `get()`, o 21º documento **derruba o lote inteiro** e
 *  nada é revelado.
 *
 *  Isto não é teoria: foi exatamente o bug do mundo demo da Forja
 *  (`firestore.rules`, bloco `worlds/`, ~48 documentos num lote), que nascia
 *  vazio até a regra de escrita passar a ler o `ownerUid` do próprio
 *  documento em vez de fazer `get()`.
 *
 *  Aqui a denormalização é no **id da instância**: `{uidDoMestre}~{mapId}`.
 *  A regra de escrita da subárvore compara o prefixo do id com
 *  `request.auth.uid` — **zero access calls** — e só cai no `isMaster()`
 *  como segunda alternativa (o `||` curto-circuita, então o caminho caro
 *  nem é avaliado no caso comum).
 *
 *  Isso é seguro porque o documento RAIZ da instância só pode ser criado
 *  por quem é mestre da campanha (é uma escrita de documento único: um
 *  `get()`, muito abaixo do teto). Ou seja: só existe instância cujo id
 *  nomeia o mestre, e só o uid nomeado no id escreve na subárvore dela.
 *
 *  ── AC-7: a mesa não depende do molde ───────────────────────────────
 *  `revealed/` guarda **cópia**, não referência. Apagar o molde no ateliê
 *  não apaga nada da mesa: o que já foi revelado é do grupo.
 *  `sincronizarMolde` só ACRESCENTA — o estado de revelação nunca regride
 *  (regra `max` do AC-6), e documento revelado cuja origem sumiu do molde
 *  é deixado em paz.
 *
 *  Gate: `__tests__/mesaStore.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where,
  onSnapshot, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  cabeNoDocumento, criarMascara, desserializar, serializar, TETO_DA_MASCARA_BYTES,
} from "./model/fogMask";
import { construirMapaPadrao, ehMapaPadrao, moldeDoMapaPadrao } from "./model/mapaPadrao";
import { ESTADOS_NO, ESTADOS_TRILHA } from "./model/revelacao";
import { getBackground, NODES, EDGES, USERS, WORLDMAPS as WORLDMAPS_DO_ATELIE } from "./worldMapStore";

/* ── Caminhos ────────────────────────────────────────────────────────── */

export const CAMPAIGNS = "campaigns";
export const WORLDMAPS = "worldmaps";
export const REVEALED = "revealed";
export const PARTY = "party";
export const FOG = "fog";
export const GM = "gm";
export const MEDIA = "media";

/** Id fixo do documento único dentro de `party`, `fog` e `gm`. */
export const ESTADO_DOC_ID = "estado";

/** Id fixo da cópia da ilustração dentro de `media`. */
export const FUNDO_DOC_ID = "background";

/** Valor de `backgroundRef` na instância quando a arte foi copiada para cá. */
export const FUNDO_REF = `${MEDIA}/${FUNDO_DOC_ID}`;

/**
 * Separador entre o uid do mestre e o id do molde dentro do `instanceId`.
 *
 * `~` porque não aparece em uid do Firebase (28 caracteres alfanuméricos) nem
 * em id gerado pelo Firestore (20 alfanuméricos), e porque as rules conseguem
 * fatiar por ele (`instanceId.split('~')[0]`). Trocar este caractere obriga a
 * trocar o `firestore.rules` no mesmo commit.
 */
export const SEPARADOR_DA_INSTANCIA = "~";

/** Limite duro do Firestore: 500 operações por `writeBatch`. */
export const BATCH_LIMIT = 500;

/* ── Validação ───────────────────────────────────────────────────────── */

const texto = (v) => (typeof v === "string" ? v.trim() : "");
const numero = (v, padrao = 0) => (Number.isFinite(v) ? v : padrao);
const lista = (v) => (Array.isArray(v) ? v : []);

function exigir(valor, mensagem) {
  const t = texto(valor);
  if (!t) throw new Error(mensagem);
  return t;
}

/* ── Refs ────────────────────────────────────────────────────────────── */

const instanciasCol = (cid) => collection(db, CAMPAIGNS, cid, WORLDMAPS);
const instanciaRef = (cid, iid) => doc(db, CAMPAIGNS, cid, WORLDMAPS, iid);
const reveladoCol = (cid, iid) => collection(db, CAMPAIGNS, cid, WORLDMAPS, iid, REVEALED);
const reveladoRef = (cid, iid, docId) => doc(db, CAMPAIGNS, cid, WORLDMAPS, iid, REVEALED, docId);
const partyRef = (cid, iid) => doc(db, CAMPAIGNS, cid, WORLDMAPS, iid, PARTY, ESTADO_DOC_ID);
const fogRef = (cid, iid) => doc(db, CAMPAIGNS, cid, WORLDMAPS, iid, FOG, ESTADO_DOC_ID);
const gmRef = (cid, iid) => doc(db, CAMPAIGNS, cid, WORLDMAPS, iid, GM, ESTADO_DOC_ID);
const fundoDaMesaRef = (cid, iid) => doc(db, CAMPAIGNS, cid, WORLDMAPS, iid, MEDIA, FUNDO_DOC_ID);

const snapToList = (snap) =>
  snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));

/**
 * Aplica operações em lotes de no máximo `BATCH_LIMIT`.
 * `ops` é `{ type:'set'|'update'|'delete', ref, data }`, na ordem de execução.
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
    await batch.commit(); // eslint-disable-line no-await-in-loop
  }
}

/* ════════════════════════════════════════════════════════════════════
 *  O ID DA INSTÂNCIA
 * ══════════════════════════════════════════════════════════════════ */

/**
 * O id da instância de um molde numa mesa: `{uidDoMestre}~{mapId}`.
 *
 * É **determinístico** de propósito, por dois motivos:
 *  1. o prefixo é o que as rules leem para autorizar a escrita em lote sem
 *     gastar access call (ver o cabeçalho);
 *  2. levar o MESMO molde à MESMA mesa duas vezes cai no mesmo id, então
 *     `levarParaMesa` consegue recusar em vez de criar uma segunda instância
 *     silenciosa (e, pior, apagar o progresso da primeira).
 *
 * Campanhas diferentes têm caminhos diferentes: o mesmo molde em duas mesas
 * gera dois progressos independentes, como o AC-7 exige.
 *
 * @param {string} uid mestre dono do molde.
 * @param {string} mapId id do molde.
 * @returns {string}
 */
export function idDaInstancia(uid, mapId) {
  const dono = exigir(uid, "É preciso estar autenticado para levar um mapa para a mesa.");
  const molde = exigir(mapId, "Informe qual mapa-múndi vai para a mesa.");
  return `${dono}${SEPARADOR_DA_INSTANCIA}${molde}`;
}

/**
 * O uid do mestre gravado no id da instância, ou `""` quando o id não segue
 * o formato. É a MESMA leitura que as rules fazem — quem quiser saber se
 * pode escrever numa instância pergunta aqui, não ao servidor.
 *
 * @param {string} instanceId
 * @returns {string}
 */
export function mestreDaInstancia(instanceId) {
  const id = texto(instanceId);
  const corte = id.indexOf(SEPARADOR_DA_INSTANCIA);
  return corte > 0 ? id.slice(0, corte) : "";
}

/**
 * O uid informado é o dono desta instância (e portanto consegue escrever na
 * subárvore dela sem depender de `get()` nas rules)?
 */
export function podeEscreverNaInstancia(uid, instanceId) {
  const dono = texto(uid);
  return !!dono && mestreDaInstancia(instanceId) === dono;
}

/* ════════════════════════════════════════════════════════════════════
 *  ESTADOS DE REVELAÇÃO — a regra `max` do AC-6
 *  --------------------------------------------------------------------
 *  "Estado NUNCA regride automaticamente; só o mestre rebaixa."
 *
 *  A ordem NÃO é definida aqui: ela vem de `model/revelacao.js`, que é o dono
 *  da máquina de estados (`aoChegarEm`, `maxEstado`, `projecaoDoJogador`). Este
 *  módulo só a REEXPORTA, para não existirem duas réguas dizendo o que é mais
 *  revelado que o quê.
 *
 *  O que mora aqui é `estadoMaior(escala, a, b)`, que difere do `maxEstado` de
 *  lá num ponto de propósito: `maxEstado` **lança** diante de um estado
 *  desconhecido (é a postura certa no domínio, onde dado torto tem de aparecer),
 *  e aqui a régua é tolerante — um documento antigo com um estado que esta
 *  versão não conhece não pode impedir a mesa de continuar sendo gravada.
 * ══════════════════════════════════════════════════════════════════ */

/** Do mais oculto ao mais revelado. `hidden` nunca é publicado — é a ausência. */
export const ESTADOS_DO_NO = ESTADOS_NO;

/** Idem para a trilha. */
export const ESTADOS_DA_TRILHA = ESTADOS_TRILHA;

const ordemDe = (ordem, estado) => {
  const i = ordem.indexOf(texto(estado));
  return i < 0 ? -1 : i;
};

/**
 * O maior de dois estados, na ordem informada. Estado desconhecido perde para
 * qualquer conhecido; dois desconhecidos devolvem o primeiro válido da ordem
 * (nunca `undefined`, que viraria documento sem estado na mesa).
 */
export function estadoMaior(ordem, a, b) {
  const ia = ordemDe(ordem, a);
  const ib = ordemDe(ordem, b);
  if (ia < 0 && ib < 0) return ordem[1];
  return ordem[Math.max(ia, ib)];
}

/* ════════════════════════════════════════════════════════════════════
 *  AS PROJEÇÕES PÚBLICAS — a lista branca do AC-1
 *  --------------------------------------------------------------------
 *  Cada função abaixo ENUMERA o que sai do ateliê. Nada é espalhado com
 *  `...`. Um campo novo no molde não vaza por omissão: ele simplesmente
 *  não aparece na mesa até alguém escrevê-lo aqui, conscientemente.
 * ══════════════════════════════════════════════════════════════════ */

/**
 * Campos que NUNCA podem aparecer num documento da campanha.
 *
 * Não é o mecanismo (o mecanismo é a lista branca) — é o **alarme**. Está
 * exportado porque o gate de teste varre o objeto gravado atrás de cada um
 * deles, e porque `garantirSemSegredo` o usa como última barreira em tempo de
 * execução, para o caso de alguém acrescentar um `...molde` num refactor.
 */
export const CAMPOS_VENENOSOS = [
  "gmNotes", "gmText", "gmScratch", "isSecret", "discoveryCheck",
  "trigger", "triggerConfig", "reveals", "anchor", "isRepeatable",
  "linkedSceneId", "revealRadius", "dangerLevel", "isFastTravel",
];

/**
 * `isOneWay` NÃO está na lista acima, e a ausência é decisão, não descuido.
 *
 * O design §3 não o cita na projeção da trilha, mas `model/revelacao.js`
 * (`projecaoDoJogador`) o inclui com a razão certa: **sem ele o cliente do
 * jogador não consegue decidir o que é clicável** (AC-8, *"nó descoberto mas não
 * conectado não é clicável"*), e ele não é segredo — a trilha já está revelada
 * quando chega aqui. As duas projeções concordam de propósito; se um dia
 * discordarem, a de `revelacao.js` é a que manda, porque é ela que decide o que
 * é visível.
 */

/** Frase da recusa quando um segredo tenta escapar. Exportada para o teste. */
export const SEGREDO_NA_PROJECAO =
  "Um campo de mestre tentou entrar num documento da campanha e a gravação foi "
  + "cancelada. Isto é um erro de programação do Nexus, não algo que você fez.";

/**
 * Última barreira: recusa o objeto se ele carregar qualquer campo de mestre.
 *
 * Com a lista branca isto é inalcançável — e é justamente por isso que ele
 * existe. Se um dia alguém trocar uma projeção por um espalhamento, a mesa
 * quebra ALTO, aqui, em vez de vazar em silêncio para o cliente do jogador.
 *
 * @param {object} obj
 * @returns {object} o próprio objeto, para encadear.
 * @throws {Error} em PT-BR quando encontra um campo venenoso.
 */
export function garantirSemSegredo(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const achado = CAMPOS_VENENOSOS.find((campo) => campo in obj);
  if (achado) {
    console.error(`[mesaStore] campo de mestre "${achado}" barrado antes de ir para a campanha.`);
    throw new Error(SEGREDO_NA_PROJECAO);
  }
  return obj;
}

/* ── Ids dos documentos de `revealed/` ───────────────────────────────── */

/**
 * O design §3 escreve `revealed/{nodeId|edgeId}`. O prefixo por espécie está
 * aqui porque nada garante que um id de nó e um id de trilha não colidam (o
 * mapa padrão usa ids autorais, e uma colisão sobrescreveria um lugar com um
 * caminho — em silêncio). O id de origem continua no documento, em
 * `nodeId`/`edgeId`/`eventId`, para ninguém precisar fatiar string.
 */
export const PREFIXO_DO_NO = "no_";
export const PREFIXO_DA_TRILHA = "tr_";
export const PREFIXO_DO_EVENTO = "ev_";

export const idReveladoDoNo = (nodeId) => `${PREFIXO_DO_NO}${nodeId}`;
export const idReveladoDaTrilha = (edgeId) => `${PREFIXO_DA_TRILHA}${edgeId}`;
export const idReveladoDoEvento = (eventId) => `${PREFIXO_DO_EVENTO}${eventId}`;

/**
 * A projeção pública de um nó (design §3).
 *
 * **Nó `rumored` vai sem nome e sem descrição** — e também sem tipo, ícone e
 * cor. O grupo ouviu falar de "alguma coisa ali"; o desenho é um brilho com
 * "?" (design §5.4, movimento 3), não um ícone de masmorra que já entrega o
 * que o lugar é. Sai apenas onde ele fica e o rumor que se conta dele.
 *
 * @param {object} no nó do molde.
 * @param {string} [state='discovered'] estado da revelação.
 * @returns {object} documento pronto para `revealed/`.
 * @throws {Error} em PT-BR quando o nó não tem id ou coordenadas.
 */
export function projecaoDoNo(no, state = "discovered") {
  const nodeId = exigir(no?.id, "Não dá para revelar um nó sem id.");
  if (!Number.isFinite(no?.x) || !Number.isFinite(no?.y)) {
    throw new Error("Não dá para revelar um nó sem coordenadas x e y numéricas.");
  }
  const estado = estadoMaior(ESTADOS_DO_NO, state, "rumored");
  const rumor = texto(no?.rumorLabel);

  if (estado === "rumored") {
    return garantirSemSegredo({
      kind: "node",
      nodeId,
      x: no.x,
      y: no.y,
      state: "rumored",
      rumorLabel: rumor || "Ouve-se falar de alguma coisa por aqui.",
    });
  }

  return garantirSemSegredo({
    kind: "node",
    nodeId,
    name: texto(no?.name),
    description: typeof no?.description === "string" ? no.description : "",
    type: texto(no?.type) || "poi",
    x: no.x,
    y: no.y,
    icon: no?.icon ?? null,
    color: texto(no?.color) || null,
    state: estado,
    rumorLabel: rumor,
  });
}

/**
 * A projeção pública de uma trilha (design §3).
 *
 * `isSecret`, `discoveryCheck` e `dangerLevel` **não saem** — a trilha só
 * chega aqui depois de revelada, e o que a tornava secreta é assunto do
 * ateliê. Uma trilha revelada é uma trilha como outra qualquer.
 *
 * @param {object} trilha trilha do molde.
 * @param {string} [state='revealed']
 * @returns {object}
 */
export function projecaoDaTrilha(trilha, state = "revealed") {
  const edgeId = exigir(trilha?.id, "Não dá para revelar uma trilha sem id.");
  const de = texto(trilha?.fromNodeId ?? trilha?.fromId);
  const para = texto(trilha?.toNodeId ?? trilha?.toId);
  if (!de || !para) {
    throw new Error("Não dá para revelar uma trilha sem os dois nós que ela liga.");
  }
  const pontos = lista(trilha?.pathPoints)
    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ x: p.x, y: p.y }));

  return garantirSemSegredo({
    kind: "edge",
    edgeId,
    fromNodeId: de,
    toNodeId: para,
    pathPoints: pontos,
    travelHours: numero(trilha?.travelHours, 1),
    isOneWay: !!trilha?.isOneWay,
    state: estadoMaior(ESTADOS_DA_TRILHA, state, "revealed"),
  });
}

/**
 * A projeção pública de um evento: **só o texto do jogador**.
 *
 * `gmText`, `trigger` e `triggerConfig` ficam no ateliê. O que dispara o
 * evento é assunto do mestre; o grupo lê o que aconteceu, não a máquina.
 *
 * @param {object} evento
 * @returns {object}
 */
export function projecaoDoEvento(evento) {
  const eventId = exigir(evento?.id, "Não dá para publicar um evento sem id.");
  return garantirSemSegredo({
    kind: "event",
    eventId,
    title: texto(evento?.title),
    playerText: typeof evento?.playerText === "string" ? evento.playerText : "",
    state: "revealed",
  });
}

/* ════════════════════════════════════════════════════════════════════
 *  LEVAR PARA A MESA  (AC-7)
 * ══════════════════════════════════════════════════════════════════ */

/** Recusa de instância duplicada. Exportada para a tela poder reconhecê-la. */
export const INSTANCIA_JA_EXISTE =
  "Este mapa-múndi já está nesta mesa. Abra-o na campanha para continuar de onde o "
  + "grupo parou, ou use \"Sincronizar\" para trazer o que você mudou no ateliê — "
  + "levar de novo apagaria o progresso do grupo.";

/**
 * O molde completo (documento + nós + trilhas), venha ele do Firestore ou do
 * código. O mapa padrão (AC-13) **não existe no banco**: ele é montado por
 * `construirMapaPadrao()`. Sem este desvio, levar o padrão para a mesa criaria
 * uma instância vazia — o mapa que o Nexus oferece pronto seria o único que
 * não funciona na mesa.
 */
async function lerMolde(uid, mapId) {
  if (ehMapaPadrao(mapId)) {
    const { mapa, nos, trilhas } = construirMapaPadrao();
    return { mapa: { ...moldeDoMapaPadrao(), ...mapa, id: mapId }, nos, trilhas };
  }
  const raiz = await getDoc(doc(db, USERS, uid, WORLDMAPS_DO_ATELIE, mapId));
  if (!raiz.exists()) {
    throw new Error("Este mapa-múndi não existe mais no seu ateliê. Atualize a lista e tente de novo.");
  }
  const [nos, trilhas] = await Promise.all([
    getDocs(collection(db, USERS, uid, WORLDMAPS_DO_ATELIE, mapId, NODES)),
    getDocs(collection(db, USERS, uid, WORLDMAPS_DO_ATELIE, mapId, EDGES)),
  ]);
  return {
    mapa: { id: raiz.id, ...raiz.data() },
    nos: snapToList(nos),
    trilhas: snapToList(trilhas),
  };
}

/** O nó onde o grupo começa: o declarado no molde ou, na falta, o primeiro. */
function noInicial(mapa, nos) {
  const declarado = texto(mapa?.startNodeId);
  const achado = declarado ? nos.find((n) => n?.id === declarado) : null;
  return achado || nos.find((n) => Number.isFinite(n?.x) && Number.isFinite(n?.y)) || null;
}

/**
 * Os campos DESCRITIVOS que a instância copia do molde. Nenhum deles é
 * segredo: são o nome do mapa, o tamanho do mundo e como achar a ilustração.
 * O grafo NÃO entra aqui — ele só chega pela revelação.
 */
function cabecalhoDaInstancia(mapa) {
  return garantirSemSegredo({
    name: texto(mapa?.name) || "Mapa-múndi",
    description: typeof mapa?.description === "string" ? mapa.description : "",
    width: numero(mapa?.width, 0),
    height: numero(mapa?.height, 0),
    fogEnabled: mapa?.fogEnabled !== false,
    /* O raio de revelação do MOLDE precisa atravessar para a mesa. Sem ele, a
     * chegada num nó sem raio próprio cai no padrão do módulo, e o ajuste que o
     * mestre fez no ateliê não faz nada — configuração que existe e não age é
     * pior que configuração que não existe. Não é segredo: define o quanto a
     * névoa abre, que é justamente o que o jogador vê acontecer. */
    defaultRevealRadius: numero(mapa?.defaultRevealRadius, 0) || null,
    /* Ilustração: a vetorial do mapa padrão viaja como NOME de componente (não
     * é dado de usuário); a do Storage viaja como URL; a base64 é copiada para
     * `media/background` desta instância, porque o jogador não alcança o
     * documento do ateliê onde a original mora. */
    ilustracao: texto(mapa?.ilustracao) || null,
    backgroundUrl: mapa?.backgroundUrl || null,
    backgroundThumb: mapa?.backgroundThumb || null,
  });
}

/**
 * Leva um molde para uma campanha (AC-7).
 *
 * Nasce uma instância com o grupo no nó inicial, **névoa fechada** e **zero
 * revelações** — `revealed/` começa vazia, e é assim que o AC-1 se sustenta:
 * o que o jogador ainda não descobriu não existe em documento que ele leia.
 *
 * O mesmo molde levado a duas campanhas gera dois progressos independentes
 * (caminhos diferentes). Levado DUAS VEZES à mesma campanha é recusado, com
 * frase em português: o id é determinístico, e sobrescrever apagaria o
 * progresso do grupo. `{ recomecar: true }` é o caminho explícito para quem
 * realmente quer zerar.
 *
 * @param {string} uid mestre dono do molde.
 * @param {string} mapId id do molde no ateliê (ou o id do mapa padrão).
 * @param {string} campaignId campanha de destino.
 * @param {{recomecar?:boolean}} [opcoes]
 * @returns {Promise<{instanceId:string, startNodeId:string|null, nos:number, trilhas:number}>}
 * @throws {Error} em PT-BR.
 */
export async function levarParaMesa(uid, mapId, campaignId, opcoes = {}) {
  const dono = exigir(uid, "É preciso estar autenticado para levar um mapa para a mesa.");
  const molde = exigir(mapId, "Informe qual mapa-múndi vai para a mesa.");
  const cid = exigir(campaignId, "Escolha a campanha que vai receber o mapa.");
  const instanceId = idDaInstancia(dono, molde);

  const jaExiste = await getDoc(instanciaRef(cid, instanceId));
  if (jaExiste.exists() && !opcoes.recomecar) throw new Error(INSTANCIA_JA_EXISTE);

  const { mapa, nos, trilhas } = await lerMolde(dono, molde);
  const inicio = noInicial(mapa, nos);

  /* Recomeçar limpa o que havia antes — inclusive as revelações. É o único
     caminho que regride o revelado, e ele é explícito e pedido. */
  if (jaExiste.exists() && opcoes.recomecar) await limparProgresso(cid, instanceId);

  const ops = [];

  ops.push({
    type: "set",
    ref: instanciaRef(cid, instanceId),
    data: {
      ...cabecalhoDaInstancia(mapa),
      /* Ponteiro para o molde — é RASTRO, não dependência: o jogador não
         alcança este caminho, e a mesa continua jogável se ele sumir (AC-7). */
      sourceUid: dono,
      sourceMapId: molde,
      /* Denormalização que as rules leem sem `get()` (ver o cabeçalho). O id
         já carrega o uid; o campo existe para diagnóstico e para a tela não
         precisar fatiar string. */
      masterUid: dono,
      startNodeId: inicio?.id || null,
      backgroundRef: null, // preenchido abaixo quando a arte é copiada
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  });

  ops.push({
    type: "set",
    ref: partyRef(cid, instanceId),
    data: {
      currentNodeId: inicio?.id || null,
      x: numero(inicio?.x, 0),
      y: numero(inicio?.y, 0),
      /* Relógio e suprimentos são da F6: nascem neutros em vez de inventarem
         um formato que a fase seguinte teria de desfazer. */
      inGameDatetime: null,
      supplies: null,
      speedModifier: 1,
      flags: {},
      updatedAt: serverTimestamp(),
    },
  });

  ops.push({
    type: "set",
    ref: gmRef(cid, instanceId),
    data: {
      triggeredEventIds: [],
      pendingEncounter: null,
      gmScratch: "",
      updatedAt: serverTimestamp(),
    },
  });

  /* Névoa FECHADA. A máscara toda em zero é o estado coberto (`fogMask.js`);
     sem dimensões não há grade possível, e aí a ausência do documento é a
     mesma coisa — a Mesa cria a máscara quando souber o tamanho do mundo. */
  const largura = Math.round(numero(mapa?.width, 0));
  const altura = Math.round(numero(mapa?.height, 0));
  if (largura > 0 && altura > 0) {
    const fechada = criarMascara(largura, altura);
    const data = serializar(fechada);
    ops.push({
      type: "set",
      ref: fogRef(cid, instanceId),
      data: {
        data,
        largura: fechada.largura,
        altura: fechada.altura,
        escala: fechada.escala,
        bytes: data.length,
        updatedAt: serverTimestamp(),
      },
    });
  }

  /* A ilustração em base64 é copiada para a instância: o jogador não pode ler
     `users/{uid}/worldmaps/**`, então sem a cópia o mapa chegaria sem arte.
     A duplicação por campanha é o custo conhecido do plano B (design §5.1). */
  if (texto(mapa?.backgroundRef)) {
    const arte = await getBackground(dono, molde).catch((e) => {
      console.warn("[mesaStore] a ilustração do molde não pôde ser copiada para a mesa:", e);
      return null;
    });
    if (arte) {
      ops.push({
        type: "set",
        ref: fundoDaMesaRef(cid, instanceId),
        data: { kind: "background", data: arte, bytes: arte.length, updatedAt: serverTimestamp() },
      });
      ops.push({
        type: "update",
        ref: instanciaRef(cid, instanceId),
        data: { backgroundRef: FUNDO_REF },
      });
    }
  }

  await commitOps(ops);
  return { instanceId, startNodeId: inicio?.id || null, nos: nos.length, trilhas: trilhas.length };
}

/** Apaga tudo que pende da instância, menos o documento raiz. */
async function limparProgresso(cid, instanceId) {
  const revelados = await getDocs(reveladoCol(cid, instanceId));
  const ops = revelados.docs.map((d) => ({ type: "delete", ref: d.ref }));
  ops.push({ type: "delete", ref: partyRef(cid, instanceId) });
  ops.push({ type: "delete", ref: fogRef(cid, instanceId) });
  ops.push({ type: "delete", ref: gmRef(cid, instanceId) });
  await commitOps(ops);
}

/**
 * Tira a instância da mesa. O molde no ateliê não é tocado — some o progresso
 * daquele grupo, não o mapa do mestre.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 */
export async function removerDaMesa(campaignId, instanceId) {
  const cid = exigir(campaignId, "Informe de qual campanha o mapa deve sair.");
  const iid = exigir(instanceId, "Informe qual mapa da mesa deve sair.");
  await limparProgresso(cid, iid);
  await commitOps([
    { type: "delete", ref: fundoDaMesaRef(cid, iid) },
    { type: "delete", ref: instanciaRef(cid, iid) },
  ]);
}

/* ════════════════════════════════════════════════════════════════════
 *  PUBLICAR A REVELAÇÃO  (AC-1 + AC-6)
 * ══════════════════════════════════════════════════════════════════ */

/** Aceita `{ no, state }`, `{ trilha, state }`, `{ evento }` ou o objeto cru. */
function desembrulhar(item, chave) {
  if (!item || typeof item !== "object") return { alvo: null, state: null };
  if (item[chave] && typeof item[chave] === "object") {
    return { alvo: item[chave], state: texto(item.state || item.estado) || null };
  }
  return { alvo: item, state: texto(item.state || item.estado) || null };
}

/** Dois documentos de `revealed/` são iguais no que importa gravar? */
function mesmoDocumento(a, b) {
  if (!a || !b) return false;
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
  chaves.delete("updatedAt");
  for (const k of chaves) {
    const va = a[k];
    const vb = b[k];
    if (typeof va === "object" || typeof vb === "object") {
      if (JSON.stringify(va ?? null) !== JSON.stringify(vb ?? null)) return false;
    } else if ((va ?? null) !== (vb ?? null)) return false;
  }
  return true;
}

/**
 * Grava em `revealed/` o que acabou de ser revelado (AC-1).
 *
 * **Copia só os campos públicos.** `gmNotes`, `gmText`, `isSecret` e
 * `discoveryCheck` nunca entram — não porque são filtrados, mas porque as
 * projeções enumeram o que sai. Nó `rumored` vai sem nome e sem descrição.
 *
 * **Nunca regride** (AC-6): um nó já `visited` não volta a `discovered` porque
 * alguém republicou; o estado gravado é o `max` entre o que havia e o que
 * chegou. Documento idêntico ao que já está lá é pulado — revelação repetida
 * não custa escrita.
 *
 * **Não estoura o teto de access calls das rules**: só escreve dentro de
 * `revealed/`, cuja regra é autorizada pelo prefixo do `instanceId` (zero
 * `get()`). Um lote de dezenas de documentos passa inteiro. Ver o cabeçalho.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {{nos?:Array, trilhas?:Array, eventos?:Array}} conteudo
 * @param {{existentes?:Array}} [opcoes] o que a tela já tem de `useReveladoNaMesa`,
 *   para dispensar a leitura da coleção.
 * @returns {Promise<{gravados:number, pulados:number}>}
 */
export async function publicarRevelacao(campaignId, instanceId, conteudo = {}, opcoes = {}) {
  const cid = exigir(campaignId, "Informe em qual campanha a revelação acontece.");
  const iid = exigir(instanceId, "Informe em qual mapa da mesa a revelação acontece.");

  const nos = lista(conteudo.nos);
  const trilhas = lista(conteudo.trilhas);
  const eventos = lista(conteudo.eventos);
  if (nos.length + trilhas.length + eventos.length === 0) return { gravados: 0, pulados: 0 };

  /* O que já está revelado, para não regredir nem reescrever à toa. Uma
     leitura de coleção, não uma por documento. */
  const anteriores = new Map();
  const jaTem = Array.isArray(opcoes.existentes)
    ? opcoes.existentes
    : snapToList(await getDocs(reveladoCol(cid, iid)));
  jaTem.forEach((d) => { if (d?.id) anteriores.set(d.id, d); });

  const ops = [];
  let pulados = 0;

  const enfileirar = (docId, novo) => {
    const antes = anteriores.get(docId);
    if (antes && mesmoDocumento(antes, { ...novo, id: docId })) { pulados += 1; return; }
    ops.push({
      type: "set",
      ref: reveladoRef(cid, iid, docId),
      data: { ...novo, updatedAt: serverTimestamp() },
    });
  };

  nos.forEach((item) => {
    const { alvo, state } = desembrulhar(item, "no");
    if (!alvo) return;
    const docId = idReveladoDoNo(texto(alvo.id));
    const antes = anteriores.get(docId);
    const estado = estadoMaior(ESTADOS_DO_NO, state || "discovered", antes?.state);
    enfileirar(docId, projecaoDoNo(alvo, estado));
  });

  trilhas.forEach((item) => {
    const { alvo, state } = desembrulhar(item, "trilha");
    if (!alvo) return;
    const docId = idReveladoDaTrilha(texto(alvo.id));
    const antes = anteriores.get(docId);
    const estado = estadoMaior(ESTADOS_DA_TRILHA, state || "revealed", antes?.state);
    enfileirar(docId, projecaoDaTrilha(alvo, estado));
  });

  eventos.forEach((item) => {
    const { alvo } = desembrulhar(item, "evento");
    if (!alvo) return;
    enfileirar(idReveladoDoEvento(texto(alvo.id)), projecaoDoEvento(alvo));
  });

  await commitOps(ops);
  return { gravados: ops.length, pulados };
}

/**
 * Publica a projeção que `model/revelacao.js` montou (`projecaoDoJogador`).
 *
 * É o encaixe entre o DOMÍNIO e a PERSISTÊNCIA: `projecaoDoJogador(estado,
 * grafo)` decide **o que** o grupo pode ver (nó `hidden` some, trilha cuja outra
 * ponta está oculta some, `rumored` vai sem nome); `publicarRevelacao` decide
 * **como isso vira documento** e reprojeta cada item pela lista branca daqui.
 *
 * As duas camadas fazem a mesma promessa de propósito. Não é redundância inútil:
 * a de lá é lógica pura e testável sem banco; a daqui é a última coisa que roda
 * antes de o dado sair da máquina do mestre. Uma das duas falhando não vaza.
 *
 * A saída de `projecaoDoJogador` usa `estado` no lugar de `state` e `id` no
 * lugar de `nodeId`/`edgeId`; `publicarRevelacao` aceita as duas formas, e o
 * documento gravado segue o design §3 (`state`).
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {{nos?:Array, trilhas?:Array}} projecao saída de `projecaoDoJogador`.
 * @param {{eventos?:Array, existentes?:Array}} [opcoes]
 * @returns {Promise<{gravados:number, pulados:number}>}
 */
export function publicarProjecao(campaignId, instanceId, projecao = {}, opcoes = {}) {
  return publicarRevelacao(
    campaignId,
    instanceId,
    { nos: projecao.nos, trilhas: projecao.trilhas, eventos: opcoes.eventos },
    opcoes,
  );
}

/**
 * O mestre rebaixa um nó/trilha à mão — o único caminho que regride (AC-6:
 * *"só o mestre rebaixa"*). Sem estado, o documento sai de `revealed/` e o
 * lugar volta a não existir para o grupo.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {string} docId id do documento em `revealed/` (ver `idReveladoDoNo`).
 * @param {string|null} [estado] novo estado, ou `null`/`'hidden'` para remover.
 */
export async function rebaixarRevelacao(campaignId, instanceId, docId, estado = null) {
  const cid = exigir(campaignId, "Informe em qual campanha o mapa está.");
  const iid = exigir(instanceId, "Informe qual mapa da mesa deve mudar.");
  const alvo = exigir(docId, "Informe o que deve ser rebaixado.");
  const novo = texto(estado);
  if (!novo || novo === "hidden") {
    await deleteDoc(reveladoRef(cid, iid, alvo));
    return;
  }
  await updateDoc(reveladoRef(cid, iid, alvo), { state: novo, updatedAt: serverTimestamp() });
}

/* ════════════════════════════════════════════════════════════════════
 *  SINCRONIZAR O MOLDE  (AC-7)
 * ══════════════════════════════════════════════════════════════════ */

/**
 * Traz para a mesa o que mudou no molde — **só acrescentando**.
 *
 * O que faz:
 *  · atualiza o cabeçalho da instância (nome, tamanho, névoa, ilustração);
 *  · reescreve a projeção pública dos documentos JÁ revelados cuja origem
 *    ainda existe no molde, **mantendo o estado** (renomear um lugar no
 *    ateliê chega à mesa; o progresso não é tocado).
 *
 * O que NÃO faz, de propósito:
 *  · não revela nada de novo — nó novo no molde entra `hidden`, isto é,
 *    simplesmente não existe em `revealed/` até alguém revelar;
 *  · não apaga documento revelado cuja origem sumiu do molde. Esse é o AC-7
 *    por extenso: `revealed/` é CÓPIA, não referência. Apagar o molde não
 *    pode quebrar a mesa.
 *
 * @param {string} uid mestre dono do molde.
 * @param {string} mapId id do molde.
 * @param {string} campaignId
 * @param {string} [instanceId] padrão: o id determinístico de `uid`+`mapId`.
 * @returns {Promise<{atualizados:number, preservados:number, orfaos:number}>}
 */
export async function sincronizarMolde(uid, mapId, campaignId, instanceId) {
  const dono = exigir(uid, "É preciso estar autenticado para sincronizar o mapa.");
  const molde = exigir(mapId, "Informe qual mapa-múndi deve ser sincronizado.");
  const cid = exigir(campaignId, "Informe com qual campanha sincronizar.");
  const iid = texto(instanceId) || idDaInstancia(dono, molde);

  const { mapa, nos, trilhas } = await lerMolde(dono, molde);
  const porNo = new Map(nos.filter((n) => texto(n?.id)).map((n) => [n.id, n]));
  const porTrilha = new Map(trilhas.filter((t) => texto(t?.id)).map((t) => [t.id, t]));

  const revelados = snapToList(await getDocs(reveladoCol(cid, iid)));

  const ops = [{
    type: "update",
    ref: instanciaRef(cid, iid),
    data: { ...cabecalhoDaInstancia(mapa), syncedAt: serverTimestamp(), updatedAt: serverTimestamp() },
  }];

  let atualizados = 0;
  let preservados = 0;
  let orfaos = 0;

  revelados.forEach((atual) => {
    const origem = atual.kind === "node"
      ? porNo.get(atual.nodeId)
      : (atual.kind === "edge" ? porTrilha.get(atual.edgeId) : null);

    if (!origem) { orfaos += 1; return; } // cópia sobrevive ao molde (AC-7)

    /* O ESTADO É O DA MESA, sempre. `estadoMaior` com o próprio estado é
       redundante por construção — está escrito assim para que a intenção
       ("nunca regride") continue legível se alguém mexer aqui. */
    const novo = atual.kind === "node"
      ? projecaoDoNo(origem, estadoMaior(ESTADOS_DO_NO, atual.state, atual.state))
      : projecaoDaTrilha(origem, estadoMaior(ESTADOS_DA_TRILHA, atual.state, atual.state));

    if (mesmoDocumento(atual, { ...novo, id: atual.id })) { preservados += 1; return; }
    ops.push({
      type: "set",
      ref: reveladoRef(cid, iid, atual.id),
      data: { ...novo, updatedAt: serverTimestamp() },
    });
    atualizados += 1;
  });

  await commitOps(ops);
  return { atualizados, preservados, orfaos };
}

/* ════════════════════════════════════════════════════════════════════
 *  O GRUPO, A NÉVOA E O PAINEL DO MESTRE
 * ══════════════════════════════════════════════════════════════════ */

/**
 * Campos que o JOGADOR pode alterar em `party/estado` ao mover o grupo.
 *
 * Esta lista é o espelho exato do `onlyUpdatingFields([...])` da regra em
 * `firestore.rules`. Mudou aqui, muda lá — senão o movimento do jogador passa
 * a ser negado pelo servidor sem nenhuma pista na tela.
 */
export const CAMPOS_DO_MOVIMENTO = ["currentNodeId", "x", "y", "movedBy", "updatedAt"];

/**
 * Move o marcador do grupo (AC-8: *"o jogador clica em nó adjacente por trilha
 * revelada para viajar"*).
 *
 * Escreve **só** os campos de movimento, para caber na regra do jogador. Quem
 * é mestre e quer mexer no relógio, nos suprimentos ou nas bandeiras usa
 * `atualizarParty`.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {{nodeId?:string, x:number, y:number, quem?:string}} destino
 */
export async function moverGrupo(campaignId, instanceId, destino = {}) {
  const cid = exigir(campaignId, "Informe em qual campanha o grupo está.");
  const iid = exigir(instanceId, "Informe em qual mapa da mesa o grupo está.");
  if (!Number.isFinite(destino.x) || !Number.isFinite(destino.y)) {
    throw new Error("O grupo precisa de coordenadas x e y numéricas para se mover.");
  }
  await updateDoc(partyRef(cid, iid), {
    currentNodeId: texto(destino.nodeId) || null,
    x: destino.x,
    y: destino.y,
    movedBy: texto(destino.quem) || null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Atualiza o estado do grupo — relógio, suprimentos, ritmo, bandeiras.
 * **Só o mestre**, pelas rules. Campos desconhecidos são ignorados: a régua do
 * que existe em `party` é o design §3, não o objeto que quem chama montou.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {object} patch
 */
export async function atualizarParty(campaignId, instanceId, patch = {}) {
  const cid = exigir(campaignId, "Informe em qual campanha o grupo está.");
  const iid = exigir(instanceId, "Informe em qual mapa da mesa o grupo está.");
  const permitidos = ["currentNodeId", "x", "y", "inGameDatetime", "supplies", "speedModifier", "flags"];
  const data = { updatedAt: serverTimestamp() };
  permitidos.forEach((campo) => { if (campo in patch) data[campo] = patch[campo]; });
  if (Object.keys(data).length === 1) {
    throw new Error("Informe o que deve mudar no grupo.");
  }
  await updateDoc(partyRef(cid, iid), data);
}

/**
 * Grava a névoa DA MESA. Mesmo formato serializado da F3 (`model/fogMask.js`)
 * — o que muda é só o caminho: o progresso da névoa é por grupo, não por molde.
 *
 * Recusa em português quando o payload não cabe no documento, antes de tentar.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {object} mascara máscara de `model/fogMask.js`.
 * @param {{teto?:number}} [opcoes]
 * @returns {Promise<{bytes:number}>}
 */
export async function salvarFogDaMesa(campaignId, instanceId, mascara, opcoes = {}) {
  const cid = exigir(campaignId, "Informe em qual campanha o mapa está.");
  const iid = exigir(instanceId, "Informe de qual mapa da mesa é a névoa.");
  if (!mascara || !mascara.bits) throw new Error("Não há névoa para gravar neste mapa.");

  const teto = Number.isFinite(opcoes.teto) && opcoes.teto > 0 ? opcoes.teto : TETO_DA_MASCARA_BYTES;
  const cabe = cabeNoDocumento(mascara, teto);
  if (!cabe.ok) throw new Error(cabe.motivo);

  const data = serializar(mascara);
  await setDoc(fogRef(cid, iid), {
    data,
    largura: mascara.largura,
    altura: mascara.altura,
    escala: mascara.escala,
    bytes: data.length,
    updatedAt: serverTimestamp(),
  });
  return { bytes: data.length };
}

/** Documento → máscara, tolerando payload quebrado (mesma postura do `fogStore`). */
function decodificarFog(dados) {
  const bruto = dados && typeof dados.data === "string" ? dados.data : "";
  if (!bruto) return null;
  try {
    return desserializar(bruto);
  } catch (err) {
    console.error("[mesaStore] a névoa da mesa não pôde ser lida e foi ignorada:", err);
    return null;
  }
}

/**
 * Anota no painel do mestre (`gm/estado`). O jogador **nem lê** este documento.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {object} patch `{ triggeredEventIds?, pendingEncounter?, gmScratch? }`
 */
export async function atualizarGm(campaignId, instanceId, patch = {}) {
  const cid = exigir(campaignId, "Informe em qual campanha o mapa está.");
  const iid = exigir(instanceId, "Informe qual mapa da mesa deve mudar.");
  const permitidos = ["triggeredEventIds", "pendingEncounter", "gmScratch"];
  const data = { updatedAt: serverTimestamp() };
  permitidos.forEach((campo) => { if (campo in patch) data[campo] = patch[campo]; });
  if (Object.keys(data).length === 1) {
    throw new Error("Informe o que deve mudar no painel do mestre.");
  }
  await setDoc(gmRef(cid, iid), data, { merge: true });
}

/**
 * A ilustração copiada para a mesa, sob demanda. `null` quando a instância não
 * tem arte em base64 (mapa padrão vetorial, ou fundo no Storage).
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @returns {Promise<string|null>} dataURL.
 */
export async function getFundoDaMesa(campaignId, instanceId) {
  const cid = exigir(campaignId, "Informe em qual campanha o mapa está.");
  const iid = exigir(instanceId, "Informe de qual mapa da mesa é a ilustração.");
  const snap = await getDoc(fundoDaMesaRef(cid, iid));
  return snap.exists() ? (snap.data()?.data || null) : null;
}

/* ════════════════════════════════════════════════════════════════════
 *  HOOKS
 *  --------------------------------------------------------------------
 *  Todos seguem a mesma postura do resto da casa: sem id não assinam nada
 *  e devolvem vazio (não é erro, é "ainda não há mesa aberta"); o erro CRU
 *  sobe no campo `error` para a tela traduzir; o listener é desfeito na
 *  troca de id e na desmontagem.
 * ══════════════════════════════════════════════════════════════════ */

/**
 * Os mapas-múndi que estão nesta mesa.
 *
 * @param {string} campaignId
 * @returns {{instancias:object[], loading:boolean, error:Error|null}}
 */
export function useInstancias(campaignId) {
  const [estado, setEstado] = useState({ instancias: [], loading: false, error: null });

  useEffect(() => {
    if (!campaignId) { setEstado({ instancias: [], loading: false, error: null }); return undefined; }
    setEstado({ instancias: [], loading: true, error: null });
    const unsub = onSnapshot(
      instanciasCol(campaignId),
      (snap) => setEstado({ instancias: snapToList(snap), loading: false, error: null }),
      (err) => setEstado({ instancias: [], loading: false, error: err }),
    );
    return () => unsub();
  }, [campaignId]);

  return estado;
}

/**
 * O que já foi revelado nesta mesa — nós, trilhas e eventos públicos.
 *
 * É a ÚNICA fonte do mapa para o jogador. O que não está aqui não existe para
 * ele, nem na rede (AC-1).
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @returns {{revelado:object[], nos:object[], trilhas:object[], eventos:object[], loading:boolean, error:Error|null}}
 */
export function useReveladoNaMesa(campaignId, instanceId) {
  const [estado, setEstado] = useState({ revelado: [], loading: false, error: null });

  useEffect(() => {
    if (!campaignId || !instanceId) {
      setEstado({ revelado: [], loading: false, error: null });
      return undefined;
    }
    setEstado({ revelado: [], loading: true, error: null });
    const unsub = onSnapshot(
      reveladoCol(campaignId, instanceId),
      (snap) => setEstado({ revelado: snapToList(snap), loading: false, error: null }),
      (err) => setEstado({ revelado: [], loading: false, error: err }),
    );
    return () => unsub();
  }, [campaignId, instanceId]);

  const revelado = estado.revelado;
  return {
    ...estado,
    nos: revelado.filter((d) => d.kind === "node"),
    trilhas: revelado.filter((d) => d.kind === "edge"),
    eventos: revelado.filter((d) => d.kind === "event"),
  };
}

/**
 * Onde o grupo está, que horas são e quanto ainda há de comida.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @returns {{party:object|null, loading:boolean, error:Error|null}}
 */
export function useParty(campaignId, instanceId) {
  const [estado, setEstado] = useState({ party: null, loading: false, error: null });

  useEffect(() => {
    if (!campaignId || !instanceId) { setEstado({ party: null, loading: false, error: null }); return undefined; }
    setEstado({ party: null, loading: true, error: null });
    const unsub = onSnapshot(
      partyRef(campaignId, instanceId),
      (snap) => setEstado({
        party: snap.exists() ? { id: snap.id, ...snap.data({ serverTimestamps: "estimate" }) } : null,
        loading: false,
        error: null,
      }),
      (err) => setEstado({ party: null, loading: false, error: err }),
    );
    return () => unsub();
  }, [campaignId, instanceId]);

  return estado;
}

/**
 * A névoa daquele grupo, em tempo real. `mascara` é `null` enquanto ninguém
 * gravou névoa — a Mesa cria a primeira quando souber o tamanho do mundo.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @returns {{mascara:object|null, bytes:number, loading:boolean, error:Error|null}}
 */
export function useFogDaMesa(campaignId, instanceId) {
  const [estado, setEstado] = useState({ mascara: null, bytes: 0, loading: false, error: null });

  useEffect(() => {
    if (!campaignId || !instanceId) {
      setEstado({ mascara: null, bytes: 0, loading: false, error: null });
      return undefined;
    }
    setEstado({ mascara: null, bytes: 0, loading: true, error: null });
    const unsub = onSnapshot(
      fogRef(campaignId, instanceId),
      (snap) => {
        const dados = snap.exists() ? snap.data() : null;
        setEstado({
          mascara: dados ? decodificarFog(dados) : null,
          bytes: dados && Number.isFinite(dados.bytes) ? dados.bytes : 0,
          loading: false,
          error: null,
        });
      },
      (err) => setEstado({ mascara: null, bytes: 0, loading: false, error: err }),
    );
    return () => unsub();
  }, [campaignId, instanceId]);

  return estado;
}

/**
 * O painel do mestre — eventos disparados, encontro aguardando decisão, rascunho.
 *
 * **Só monta o listener se `ehMestre` for verdadeiro.** As rules já negam a
 * leitura ao jogador; não assinar é o que evita o cliente dele passar a vida
 * tomando `permission-denied` no console por um documento que ele não deve
 * sequer tentar ler.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {boolean} ehMestre
 * @returns {{gm:object|null, loading:boolean, error:Error|null}}
 */
export function useGmDaMesa(campaignId, instanceId, ehMestre) {
  const [estado, setEstado] = useState({ gm: null, loading: false, error: null });

  useEffect(() => {
    if (!campaignId || !instanceId || !ehMestre) {
      setEstado({ gm: null, loading: false, error: null });
      return undefined;
    }
    setEstado({ gm: null, loading: true, error: null });
    const unsub = onSnapshot(
      gmRef(campaignId, instanceId),
      (snap) => setEstado({
        gm: snap.exists() ? { id: snap.id, ...snap.data({ serverTimestamps: "estimate" }) } : null,
        loading: false,
        error: null,
      }),
      (err) => setEstado({ gm: null, loading: false, error: err }),
    );
    return () => unsub();
  }, [campaignId, instanceId, ehMestre]);

  return estado;
}

/**
 * As campanhas em que este usuário é o MESTRE — o destino possível de
 * "Levar para a mesa →" (AC-7).
 *
 * Sem `orderBy` de propósito: `where` + `orderBy` em campos diferentes exigiria
 * índice composto no Firestore, e a lista é curta o bastante para ordenar aqui.
 * Campanha arquivada (`isActive === false`) fica de fora — não se leva mapa
 * para uma mesa encerrada.
 *
 * @param {string} uid
 * @returns {{campanhas:object[], loading:boolean, error:Error|null}}
 */
export function useCampanhasDoMestre(uid) {
  const [estado, setEstado] = useState({ campanhas: [], loading: false, error: null });

  useEffect(() => {
    if (!uid) { setEstado({ campanhas: [], loading: false, error: null }); return undefined; }
    setEstado({ campanhas: [], loading: true, error: null });
    const unsub = onSnapshot(
      query(collection(db, CAMPAIGNS), where("masterId", "==", uid)),
      (snap) => {
        const todas = snapToList(snap)
          .filter((c) => c.isActive !== false)
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
        setEstado({ campanhas: todas, loading: false, error: null });
      },
      (err) => setEstado({ campanhas: [], loading: false, error: err }),
    );
    return () => unsub();
  }, [uid]);

  return estado;
}
