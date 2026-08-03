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
/* Desde a onda 1.5 (spec 0030) nenhuma linha daqui fala `firebase/firestore`: caminho,
   lote, transação e política de erro moram no repositório. O que ficou neste arquivo é
   o que É deste arquivo — as projeções da lista branca, a régua de estados, o formato
   dos documentos e as decisões das corridas entre abas. */
import * as mesaRepo from "../../infrastructure/firestore/mesaRepo";
import {
  cabeNoDocumento, criarMascara, desserializar, serializar, TETO_DA_MASCARA_BYTES,
} from "./model/fogMask";
import { ehDelta, idDoDelta, mesclarRecebidos } from "./model/fogDelta";
import { construirMapaPadrao, ehMapaPadrao, moldeDoMapaPadrao } from "./model/mapaPadrao";
import { ESTADOS_NO, ESTADOS_TRILHA } from "./model/revelacao";
/* `USERS`/`WORLDMAPS` saíram desta lista porque só existiam para montar o caminho do
   ateliê à mão — quem o monta agora é `paths.js` (`atelieMapDoc`/`atelieSubCol`). Os
   exports continuam existindo no `worldMapStore`; deixá-los importados sem uso viraria
   aviso de lint, e aviso de lint reprova o build com `CI=true`. */
import { getBackground, NODES, EDGES } from "./worldMapStore";

/* ── Nomes das coleções ──────────────────────────────────────────────────
   Continuam exportados porque a tela e os testes os leem, mas eles NÃO montam
   mais caminho nenhum: quem endereça documento é `infrastructure/firestore/paths.js`,
   via os ALVOS do `mesaRepo`. Renomear uma coleção se faz lá, e lá quebra teste. */

export const CAMPAIGNS = "campaigns";
export const WORLDMAPS = "worldmaps";
export const REVEALED = "revealed";
export const PARTY = "party";
export const FOG = "fog";
export const GM = "gm";
export const MEDIA = "media";

/** Id fixo do documento único dentro de `party`, `fog` e `gm`. */
export const ESTADO_DOC_ID = mesaRepo.ESTADO_DOC_ID;

/** Id fixo da cópia da ilustração dentro de `media`. */
export const FUNDO_DOC_ID = mesaRepo.FUNDO_DOC_ID;

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

/** Limite duro do Firestore: 500 operações por lote. Quem o aplica é o repositório. */
export const BATCH_LIMIT = mesaRepo.BATCH_LIMIT;

/* ── Validação ───────────────────────────────────────────────────────── */

const texto = (v) => (typeof v === "string" ? v.trim() : "");
const numero = (v, padrao = 0) => (Number.isFinite(v) ? v : padrao);
const lista = (v) => (Array.isArray(v) ? v : []);

function exigir(valor, mensagem) {
  const t = texto(valor);
  if (!t) throw new Error(mensagem);
  return t;
}

/* ── Como este arquivo endereça documento ────────────────────────────────
 *
 *  Não endereça. Toda operação nomeia um ALVO do `mesaRepo` — `"instancia"`,
 *  `"party"`, `"gm"`, `"fog"`, `"revelado"`, `"fundo"` — e o repositório traduz
 *  para o caminho de `paths.js`.
 *
 *  Isso vale um parágrafo porque é o que mantém o segredo mecânico: `"gm"` e
 *  `"party"` são documentos DIFERENTES (o jogador lê um e não lê o outro), e a
 *  diferença entre eles deixou de ser uma string a um caractere de distância no
 *  meio de um `doc(db, …)` de sete segmentos.
 *
 *  O carimbo de tempo do servidor também não se monta aqui: pede-se por nome
 *  (`carimbar: ["updatedAt"]`), porque `serverTimestamp()` é FieldValue do SDK e
 *  não pode atravessar a fronteira (spec 0030 AC-4).
 * ────────────────────────────────────────────────────────────────────── */

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
  const raiz = await mesaRepo.lerMoldeDoAtelie(uid, mapId);
  if (!raiz) {
    throw new Error("Este mapa-múndi não existe mais no seu ateliê. Atualize a lista e tente de novo.");
  }
  /* `NODES`/`EDGES` continuam vindo do `worldMapStore`: quem é dono do formato do
     ateliê é ele, não a persistência da mesa. */
  const [nos, trilhas] = await Promise.all([
    mesaRepo.listarSubcolecaoDoMolde(uid, mapId, NODES),
    mesaRepo.listarSubcolecaoDoMolde(uid, mapId, EDGES),
  ]);
  return { mapa: raiz, nos, trilhas };
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

  const jaExiste = await mesaRepo.existeInstancia(cid, instanceId);
  if (jaExiste && !opcoes.recomecar) throw new Error(INSTANCIA_JA_EXISTE);

  const { mapa, nos, trilhas } = await lerMolde(dono, molde);
  const inicio = noInicial(mapa, nos);

  /* Recomeçar limpa o que havia antes — inclusive as revelações. É o único
     caminho que regride o revelado, e ele é explícito e pedido. */
  if (jaExiste && opcoes.recomecar) await limparProgresso(cid, instanceId);

  const ops = [];

  ops.push({
    tipo: "set",
    alvo: "instancia",
    dados: {
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
    },
    carimbar: ["createdAt", "updatedAt"],
  });

  ops.push({
    tipo: "set",
    alvo: "party",
    dados: {
      currentNodeId: inicio?.id || null,
      x: numero(inicio?.x, 0),
      y: numero(inicio?.y, 0),
      /* Relógio e suprimentos são da F6: nascem neutros em vez de inventarem
         um formato que a fase seguinte teria de desfazer. */
      inGameDatetime: null,
      supplies: null,
      speedModifier: 1,
      flags: {},
    },
    carimbar: ["updatedAt"],
  });

  ops.push({
    tipo: "set",
    alvo: "gm",
    dados: {
      triggeredEventIds: [],
      pendingEncounter: null,
      gmScratch: "",
    },
    carimbar: ["updatedAt"],
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
      tipo: "set",
      alvo: "fog", // sem `docId` → `fog/estado`, a base consolidada
      dados: {
        data,
        largura: fechada.largura,
        altura: fechada.altura,
        escala: fechada.escala,
        bytes: data.length,
      },
      carimbar: ["updatedAt"],
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
        tipo: "set",
        alvo: "fundo",
        dados: { kind: "background", data: arte, bytes: arte.length },
        carimbar: ["updatedAt"],
      });
      /* Sem carimbo, de propósito: era assim no legado. Este `update` é o remate
         de uma criação que acabou de gravar `updatedAt` duas linhas acima. */
      ops.push({ tipo: "update", alvo: "instancia", dados: { backgroundRef: FUNDO_REF } });
    }
  }

  await mesaRepo.aplicarEmLote(cid, instanceId, ops);
  return { instanceId, startNodeId: inicio?.id || null, nos: nos.length, trilhas: trilhas.length };
}

/** Apaga tudo que pende da instância, menos o documento raiz. */
async function limparProgresso(cid, instanceId) {
  const revelados = await mesaRepo.listarRevelado(cid, instanceId);
  const ops = revelados.map((d) => ({ tipo: "delete", alvo: "revelado", docId: d.id }));
  /* A névoa é uma COLEÇÃO desde a F7 (base consolidada + deltas pendentes).
     Apagar só `fog/estado` deixaria os deltas órfãos, e a mesa recomeçada
     nasceria com pedaços do mapa antigo já abertos.
     `listarNevoa` é a única leitura `silent` do repositório: o legado engolia a
     falha aqui para que recomeçar nunca travasse (AC-7 preserva). */
  const nevoa = await mesaRepo.listarNevoa(cid, instanceId);
  nevoa.forEach((d) => ops.push({ tipo: "delete", alvo: "fog", docId: d.id }));
  ops.push({ tipo: "delete", alvo: "party" });
  ops.push({ tipo: "delete", alvo: "fog" });
  ops.push({ tipo: "delete", alvo: "gm" });
  await mesaRepo.aplicarEmLote(cid, instanceId, ops);
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
  await mesaRepo.aplicarEmLote(cid, iid, [
    { tipo: "delete", alvo: "fundo" },
    { tipo: "delete", alvo: "instancia" },
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
    : await mesaRepo.listarRevelado(cid, iid);
  jaTem.forEach((d) => { if (d?.id) anteriores.set(d.id, d); });

  const ops = [];
  let pulados = 0;

  const enfileirar = (docId, novo) => {
    const antes = anteriores.get(docId);
    if (antes && mesmoDocumento(antes, { ...novo, id: docId })) { pulados += 1; return; }
    ops.push({ tipo: "set", alvo: "revelado", docId, dados: novo, carimbar: ["updatedAt"] });
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

  await mesaRepo.aplicarEmLote(cid, iid, ops);
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
  /* APAGA o documento — não grava `state: "hidden"`. Um documento com estado oculto
     contaria ao jogador que há alguma coisa ali para descobrir, e o segredo vaza pela
     DIFERENÇA, não pelo dado. `hidden` é a ausência (ver `ESTADOS_DO_NO`). */
  if (!novo || novo === "hidden") {
    await mesaRepo.apagarRevelado(cid, iid, alvo);
    return;
  }
  await mesaRepo.atualizarRevelado(cid, iid, alvo, { state: novo });
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

  const revelados = await mesaRepo.listarRevelado(cid, iid);

  const ops = [{
    tipo: "update",
    alvo: "instancia",
    dados: cabecalhoDaInstancia(mapa),
    carimbar: ["syncedAt", "updatedAt"],
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
      tipo: "set",
      alvo: "revelado",
      docId: atual.id,
      dados: novo,
      carimbar: ["updatedAt"],
    });
    atualizados += 1;
  });

  await mesaRepo.aplicarEmLote(cid, iid, ops);
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
export const CAMPOS_DO_MOVIMENTO = ["currentNodeId", "x", "y", "movedBy", "viagem", "updatedAt"];

/**
 * O estado da VIAGEM EM CURSO, gravado em `party.viagem` (F7 · AC-10).
 *
 * Por que ele existe: até a F6 a viagem só vivia na memória do cliente que a
 * começou. Recarregar a página no meio dela perdia o percurso, o outro cliente
 * refazia o trajeto por conta própria a partir de `currentNodeId`, e "acampar
 * em trânsito" era letra morta porque ninguém sabia dizer que o grupo estava
 * *entre* dois lugares.
 *
 * Por que ele cabe na regra do JOGADOR (está em `CAMPOS_DO_MOVIMENTO`): quem
 * viaja é quem grava, e o jogador também viaja (AC-8). Nada aqui é segredo —
 * a trilha e os dois nós já estão em `revealed/` para ele poder tê-la clicado.
 * Um jogador mal-intencionado consegue escrever uma viagem falsa exatamente
 * como já conseguia escrever um `currentNodeId` falso; a superfície não muda.
 *
 * `id` é o que torna a CHEGADA idempotente: quem conclui grava `viagem: null`
 * dentro de uma transação que confere o id, então duas abas do mestre não
 * adiantam o relógio duas vezes pela mesma estrada (ver `concluirViagem`).
 */
export const CAMPOS_DA_VIAGEM = [
  "id", "trilhaId", "deId", "paraId", "progresso", "iniciadaEm", "horas", "porQuem",
];

/**
 * Monta o documento da viagem em curso, sem campo a mais nem a menos.
 *
 * Enumera o que sai, como as projeções do AC-1 — não porque haja segredo aqui,
 * mas porque `party` é lido pelo grupo inteiro e um `...viagem` espalhado
 * levaria para lá o objeto de animação completo (a polilinha amostrada, que
 * pode ter centenas de pontos, a cada gravação).
 *
 * @param {object} viagem a viagem do `model/viagem.js`, ou o documento já pronto.
 * @param {{id?:string, iniciadaEm?:number, porQuem?:string, progresso?:number}} [extra]
 * @returns {object|null} `null` quando não há viagem descritível.
 */
export function projecaoDaViagem(viagem, extra = {}) {
  if (!viagem || typeof viagem !== "object") return null;
  const paraId = texto(viagem.paraId);
  const deId = texto(viagem.deId);
  if (!paraId || !deId) return null;

  const progresso = Number.isFinite(extra.progresso) ? extra.progresso : viagem.progresso;
  return {
    id: texto(extra.id) || texto(viagem.id) || `${deId}>${paraId}`,
    trilhaId: texto(viagem.trilhaId) || null,
    deId,
    paraId,
    progresso: Math.min(1, Math.max(0, Number.isFinite(progresso) ? progresso : 0)),
    iniciadaEm: Number.isFinite(extra.iniciadaEm)
      ? extra.iniciadaEm
      : (Number.isFinite(viagem.iniciadaEm) ? viagem.iniciadaEm : null),
    horas: numero(viagem.horas, 0),
    porQuem: texto(extra.porQuem) || texto(viagem.porQuem) || null,
  };
}

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
 * `viagem` (F7) é o estado do percurso em curso. Ausente, o campo não é tocado;
 * `null` explícito o apaga (é como a chegada e o cancelamento fecham a viagem).
 *
 * @param {{nodeId?:string, x:number, y:number, quem?:string, viagem?:object|null}} destino
 */
export async function moverGrupo(campaignId, instanceId, destino = {}) {
  const cid = exigir(campaignId, "Informe em qual campanha o grupo está.");
  const iid = exigir(instanceId, "Informe em qual mapa da mesa o grupo está.");
  if (!Number.isFinite(destino.x) || !Number.isFinite(destino.y)) {
    throw new Error("O grupo precisa de coordenadas x e y numéricas para se mover.");
  }
  const data = {
    currentNodeId: texto(destino.nodeId) || null,
    x: destino.x,
    y: destino.y,
    movedBy: texto(destino.quem) || null,
  };
  /* `viagem` só entra quando quem chama a informou: mover SEM falar da viagem não pode
     apagar o percurso de quem está viajando. O `updatedAt` é carimbado pelo repositório. */
  if ("viagem" in destino) data.viagem = destino.viagem || null;
  await mesaRepo.atualizarParty(cid, iid, data);
}

/**
 * Grava só o andamento da viagem — o "onde o grupo está AGORA, entre dois
 * lugares" (F7 · AC-10).
 *
 * Escrita separada de propósito: ela é a única que acontece **durante** o
 * percurso, e escreve um campo só, dentro da lista que a regra do jogador
 * aceita. Quem chama é responsável por não chamá-la a cada quadro — a Mesa a
 * envia por marco de progresso, não por animação (ver `MARCOS_DA_VIAGEM`).
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {object|null} viagem já projetada por `projecaoDaViagem`, ou `null`.
 */
export async function atualizarViagem(campaignId, instanceId, viagem) {
  const cid = exigir(campaignId, "Informe em qual campanha o grupo está.");
  const iid = exigir(instanceId, "Informe em qual mapa da mesa o grupo está.");
  await mesaRepo.atualizarParty(cid, iid, { viagem: viagem || null });
}

/**
 * Fecha a viagem — **uma vez só, custe o que custar** (F7).
 *
 * Duas abas do mesmo mestre (ou o mestre e o jogador) podem ver a chegada no
 * mesmo instante. Sem coordenação, as duas adiantariam o relógio e comeriam a
 * comida do grupo pela mesma estrada. A transação lê `party.viagem`, confere o
 * `id` e só então aplica: quem chegar primeiro vence, quem chegar depois recebe
 * `{aplicou:false}` e não escreve nada.
 *
 * Repare no que NÃO está condicionado a isto: a publicação da revelação. Ela é
 * idempotente por construção (`publicarRevelacao` pula documento idêntico), e
 * perder revelação porque a outra aba "chegou primeiro" seria muito pior do que
 * gravá-la duas vezes.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {string} viagemId o `id` da viagem que se acredita estar em curso.
 * @param {object} [patch] o que aplicar JUNTO do fechamento (relógio, comida).
 * @returns {Promise<{aplicou:boolean, motivo:string}>}
 */
export async function concluirViagem(campaignId, instanceId, viagemId, patch = {}) {
  const cid = exigir(campaignId, "Informe em qual campanha o grupo está.");
  const iid = exigir(instanceId, "Informe em qual mapa da mesa o grupo está.");
  const alvo = texto(viagemId);
  const permitidos = ["currentNodeId", "x", "y", "inGameDatetime", "supplies", "speedModifier", "flags"];

  /* A DECISÃO é daqui: qual viagem é essa, e se ela ainda está de pé. O repositório só
     garante que ler e escrever aconteçam como uma coisa só. */
  return mesaRepo.transacionar(cid, iid, "party", (atual) => {
    const emCurso = atual?.viagem || null;

    /* Já fechada por outro cliente (ou por outra aba desta mesma pessoa). Não é
       erro: é a corrida acontecendo e sendo resolvida. Sem `gravar`, nada é escrito. */
    if (alvo && emCurso && texto(emCurso.id) && texto(emCurso.id) !== alvo) {
      return { resultado: { aplicou: false, motivo: "outra-viagem" } };
    }
    if (alvo && !emCurso) return { resultado: { aplicou: false, motivo: "ja-concluida" } };

    const gravar = { viagem: null };
    permitidos.forEach((campo) => { if (campo in patch) gravar[campo] = patch[campo]; });
    return { resultado: { aplicou: true, motivo: "" }, gravar, carimbar: ["updatedAt"] };
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
  const permitidos = [
    "currentNodeId", "x", "y", "inGameDatetime", "supplies", "speedModifier", "flags", "viagem",
  ];
  /* `campo in patch` e não `patch[campo] !== undefined`: desligar a pausa da viagem
     manda `flags` SEM a chave da pausa, e desligar um encontro é a AUSÊNCIA do campo,
     nunca um `false` gravado. Gravar `false` diria ao jogador que a coisa existe. */
  const data = {};
  permitidos.forEach((campo) => { if (campo in patch) data[campo] = patch[campo]; });
  if (Object.keys(data).length === 0) {
    throw new Error("Informe o que deve mudar no grupo.");
  }
  await mesaRepo.atualizarParty(cid, iid, data);
}

/*  ── POR QUE NÃO EXISTE MAIS UM "salvarFogDaMesa" ───────────────────
 *  Até a F6 havia uma função que gravava o bitmap inteiro em `fog/estado`, e
 *  a mesa a chamava a cada chegada e a cada revelação. O AC-10 proíbe isso
 *  durante a viagem, e uma função exportada que faz exatamente o proibido é
 *  uma armadilha: quem a chamasse quebraria o contrato sem perceber, porque a
 *  tela continuaria correta.
 *
 *  Agora só existem DUAS portas, e as duas obedecem a política de
 *  `model/fogDelta.js`: `salvarDeltaDaNevoa` (o passo) e
 *  `consolidarNevoaDaMesa` (o flush). Quem decide qual das duas usar é
 *  `planejarTransmissao`, nunca quem chama.
 */

/**
 * Grava **um delta** de névoa (F7 · AC-10).
 *
 * O delta é a mesma coisa que a máscara — bitmap, mesmo formato serializado —
 * só que com bits apenas nas células que acabaram de acender. Ele **não conta
 * o que foi revelado**: não tem nome de lugar, não tem trilha, não tem evento.
 * É geometria pura, e a geometria daquele pedaço já está sendo desenhada na
 * tela do jogador no mesmo instante.
 *
 * Mora na MESMA coleção `fog/` da base consolidada, com id prefixado por `d_`.
 * Isso é decisão, não acaso: a regra do `firestore.rules` é
 * `match /fog/{docId}`, então o delta entra sem regra nova e sem gastar access
 * call — o teto de 20 por lote continua intocado (F4).
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {object} delta máscara-delta (saída de `planejarTransmissao`).
 * @param {{sessao?:string, n?:number}} [opcoes] sessão da aba e contador local.
 * @returns {Promise<{id:string, bytes:number}>}
 */
export async function salvarDeltaDaNevoa(campaignId, instanceId, delta, opcoes = {}) {
  const cid = exigir(campaignId, "Informe em qual campanha o mapa está.");
  const iid = exigir(instanceId, "Informe de qual mapa da mesa é a névoa.");
  if (!delta || !delta.bits) throw new Error("Não há névoa nova para transmitir neste mapa.");

  const id = idDoDelta(opcoes.sessao, opcoes.n);
  /* A CODIFICAÇÃO é daqui (RLE+varint, `model/fogMask.js`). O repositório recebe a
     string pronta e grava — nenhum bit é mexido do outro lado da fronteira (AC-3). */
  const data = serializar(delta);
  await mesaRepo.salvarNevoaDelta(cid, iid, id, {
    kind: "delta",
    data,
    largura: delta.largura,
    altura: delta.altura,
    escala: delta.escala,
    bytes: data.length,
    porQuem: texto(opcoes.sessao) || null,
  });
  return { id, bytes: data.length };
}

/**
 * Consolida a névoa: grava o bitmap inteiro e **apaga os deltas que ele já
 * contém**, num lote só (F7 · AC-10, *"flush consolidado"*).
 *
 * Apagar na mesma escrita é o que torna a leitura trivial do outro lado: a
 * máscara é sempre `base + todos os deltas presentes`. Não há número de
 * sequência para conferir, não há delta a "pular". Um delta gravado no meio do
 * caminho — que portanto não está na lista de apagados — simplesmente
 * sobrevive e continua sendo aplicado; como aplicar delta é união, aplicá-lo
 * sobre uma base que já o continha não muda nada.
 *
 * `regrediu` marca a consolidação nascida de um RECOBRIMENTO. É o único sinal
 * que autoriza o outro cliente a **substituir** a máscara local em vez de
 * mesclar — sem ele, o pincel do mestre seria desfeito pela própria mesclagem
 * do jogador (ver `aplicarRemota` em `model/fogDelta.js`).
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {object} mascara a máscara inteira.
 * @param {{deltas?:string[], regrediu?:boolean, teto?:number}} [opcoes]
 * @returns {Promise<{bytes:number, apagados:number}>}
 */
export async function consolidarNevoaDaMesa(campaignId, instanceId, mascara, opcoes = {}) {
  const cid = exigir(campaignId, "Informe em qual campanha o mapa está.");
  const iid = exigir(instanceId, "Informe de qual mapa da mesa é a névoa.");
  if (!mascara || !mascara.bits) throw new Error("Não há névoa para gravar neste mapa.");

  const teto = Number.isFinite(opcoes.teto) && opcoes.teto > 0 ? opcoes.teto : TETO_DA_MASCARA_BYTES;
  const cabe = cabeNoDocumento(mascara, teto);
  if (!cabe.ok) throw new Error(cabe.motivo);

  const data = serializar(mascara);
  const apagar = lista(opcoes.deltas).filter((id) => ehDelta(id));

  const ops = [{
    tipo: "set",
    alvo: "fog", // sem `docId` → `fog/estado`
    dados: {
      kind: "base",
      data,
      largura: mascara.largura,
      altura: mascara.altura,
      escala: mascara.escala,
      bytes: data.length,
      /* Contador de consolidações: é por ele que o outro cliente distingue
         "a mesma base de novo" de "uma base nova que preciso considerar".
         `Date.now()` e não o relógio do servidor de propósito — o outro cliente só
         precisa saber que MUDOU, e um número já resolvido dispensa a ida à rede. */
      rev: Date.now(),
      regrediu: !!opcoes.regrediu,
    },
    carimbar: ["updatedAt"],
  }];
  apagar.forEach((id) => ops.push({ tipo: "delete", alvo: "fog", docId: id }));

  await mesaRepo.aplicarEmLote(cid, iid, ops);
  return { bytes: data.length, apagados: apagar.length };
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
  const data = {};
  permitidos.forEach((campo) => { if (campo in patch) data[campo] = patch[campo]; });
  if (Object.keys(data).length === 0) {
    throw new Error("Informe o que deve mudar no painel do mestre.");
  }
  await mesaRepo.mesclarGm(cid, iid, data);
}

/* ════════════════════════════════════════════════════════════════════
 *  A PENDÊNCIA DO ENCONTRO, EM TEMPO REAL  (F7 · AC-8, AC-10)
 *  --------------------------------------------------------------------
 *  `gm/estado` é assinado por `useGmDaMesa`, então DUAS ABAS do mesmo
 *  mestre veem a mesma pendência ao mesmo tempo. Até a F6 as duas podiam
 *  decidir: a primeira publicava o encontro e limpava a pendência, a
 *  segunda — com o snapshot ainda velho na tela — publicava de novo.
 *
 *  As duas funções abaixo transformam isso em decisão ÚNICA, e a garantia
 *  é do servidor, não da tela: a transação lê o documento, confere de que
 *  pendência se trata, e só então escreve. Quem chega depois recebe
 *  `false` e vê a pendência sumir — que é a resposta certa, porque ela
 *  realmente já não existe.
 * ══════════════════════════════════════════════════════════════════ */

/**
 * Reserva a vaga da pendência: só grava se **não houver** nenhuma.
 *
 * O sorteio da estrada roda no cliente do mestre; com duas abas abertas, as
 * duas sorteiam. Sem esta reserva, a segunda sobrescreveria a pendência que a
 * primeira criou — e o mestre decidiria sobre um encontro que substituiu outro
 * que ele nunca viu.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {object} pendencia já montada (`model/encontros.js`), com `id`.
 * @returns {Promise<{reservada:boolean, motivo:string}>}
 */
export async function reservarPendencia(campaignId, instanceId, pendencia) {
  const cid = exigir(campaignId, "Informe em qual campanha o mapa está.");
  const iid = exigir(instanceId, "Informe qual mapa da mesa deve mudar.");
  if (!pendencia || typeof pendencia !== "object") {
    throw new Error("Não há encontro para pôr na fila do mestre.");
  }

  /* Alvo `"gm"`, nunca `"party"`: a pendência é o sorteio ainda não decidido, e o
     jogador não pode sequer saber que houve sorteio. */
  return mesaRepo.transacionar(cid, iid, "gm", (atual) => {
    if (atual?.pendingEncounter) return { resultado: { reservada: false, motivo: "ja-ha-pendencia" } };
    return {
      resultado: { reservada: true, motivo: "" },
      gravar: { pendingEncounter: pendencia },
      carimbar: ["updatedAt"],
    };
  });
}

/**
 * Resolve a pendência **uma vez só**: quem decidir primeiro vence.
 *
 * Confere o `id` da pendência que está gravada contra o que quem decide tinha
 * na tela. Diferente (ou ausente) significa que outra aba já decidiu — e aí
 * nada é escrito e nada é publicado.
 *
 * Pendência LEGADA (gravada antes desta versão, portanto sem `id`) é aceita:
 * recusar deixaria a mesa travada com um diálogo que não fecha, o que é pior
 * do que a corrida que esta função previne. É um caso que se extingue sozinho
 * na primeira decisão.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {string} pendenciaId
 * @param {object} [patch] o que gravar junto (`triggeredEventIds`, por exemplo).
 * @returns {Promise<{decidida:boolean, motivo:string, pendencia:object|null}>}
 *   `pendencia` é a que estava gravada — quem decidiu precisa dela para
 *   devolvê-la ao lugar se a publicação falhar depois.
 */
export async function resolverPendencia(campaignId, instanceId, pendenciaId, patch = {}) {
  const cid = exigir(campaignId, "Informe em qual campanha o mapa está.");
  const iid = exigir(instanceId, "Informe qual mapa da mesa deve mudar.");
  const alvo = texto(pendenciaId);
  const permitidos = ["triggeredEventIds", "gmScratch"];

  return mesaRepo.transacionar(cid, iid, "gm", (atual) => {
    const emCurso = atual?.pendingEncounter || null;

    if (!emCurso) return { resultado: { decidida: false, motivo: "ja-decidida", pendencia: null } };
    const idGravado = texto(emCurso.id);
    if (alvo && idGravado && idGravado !== alvo) {
      return { resultado: { decidida: false, motivo: "outra-pendencia", pendencia: emCurso } };
    }

    /* `pendingEncounter: null` e não a ausência do campo: aqui o `null` É o dado —
       ele diz "não há nada aguardando decisão", que é o que a tela do mestre lê para
       fechar o diálogo. Diferente do `flags` de `atualizarParty`, onde a ausência é
       que carrega o significado. */
    const gravar = { pendingEncounter: null };
    permitidos.forEach((campo) => { if (campo in patch) gravar[campo] = patch[campo]; });
    return {
      resultado: { decidida: true, motivo: "", pendencia: emCurso },
      gravar,
      carimbar: ["updatedAt"],
    };
  });
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
  return mesaRepo.lerFundoDaMesa(cid, iid);
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
    const unsub = mesaRepo.watchInstancias(
      campaignId,
      (instancias) => setEstado({ instancias, loading: false, error: null }),
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
    const unsub = mesaRepo.watchRevelado(
      campaignId,
      instanceId,
      (revelado) => setEstado({ revelado, loading: false, error: null }),
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
    const unsub = mesaRepo.watchParty(
      campaignId,
      instanceId,
      /* `local` é o eco da própria escrita (ver `useFogDaMesa`): o Firestore entrega o
         movimento otimista antes do servidor confirmar, e quem já animou o percurso
         localmente não pode animá-lo de novo por causa dele. */
      ({ party, local }) => setEstado({ party, local, loading: false, error: null }),
      (err) => setEstado({ party: null, local: false, loading: false, error: err }),
    );
    return () => unsub();
  }, [campaignId, instanceId]);

  return estado;
}

const VAZIO_DA_NEVOA = Object.freeze({
  mascara: null, base: null, deltas: [], bytes: 0, rev: 0,
  regrediu: false, local: false, loading: false, error: null,
});

/**
 * A névoa daquele grupo, em tempo real — **base consolidada + deltas** (F7).
 *
 * Assina a COLEÇÃO `fog/`, não só o documento `estado`: desde o AC-10 a
 * revelação da viagem trafega em deltas (`fog/d_*`), e o que o outro cliente
 * tem de ver é a soma. A soma é feita aqui, por união, então ordem de chegada,
 * repetição e delta duplicado dão sempre o mesmo resultado.
 *
 * `local` repassa `metadata.hasPendingWrites` — é o eco da PRÓPRIA escrita
 * deste cliente, que o Firestore entrega otimisticamente antes de o servidor
 * confirmar. A Mesa o usa para não reprocessar o que ela mesma acabou de
 * mandar (o mesmo padrão de `MapEditor/sync/campaignSync2.js`).
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @returns {{mascara:object|null, base:object|null, deltas:object[], bytes:number,
 *            rev:number, regrediu:boolean, local:boolean,
 *            loading:boolean, error:Error|null}}
 */
export function useFogDaMesa(campaignId, instanceId) {
  const [estado, setEstado] = useState(VAZIO_DA_NEVOA);

  useEffect(() => {
    if (!campaignId || !instanceId) { setEstado(VAZIO_DA_NEVOA); return undefined; }
    setEstado({ ...VAZIO_DA_NEVOA, loading: true });

    /* O repositório entrega os documentos crus; DESSERIALIZAR e SOMAR é daqui — o
       bitmap é do `model/fogMask.js`, e a soma por união é o que faz ordem de
       chegada, repetição e delta duplicado darem sempre o mesmo resultado (AC-3). */
    const unsub = mesaRepo.watchNevoa(
      campaignId,
      instanceId,
      ({ docs, local }) => {
        let base = null;
        let bytes = 0;
        let rev = 0;
        let regrediu = false;
        const deltas = [];
        const ids = [];

        docs.forEach(({ id, dados }) => {
          if (ehDelta(id)) {
            const m = decodificarFog(dados);
            if (m) { deltas.push(m); ids.push(id); }
            return;
          }
          if (id !== ESTADO_DOC_ID) return;
          base = decodificarFog(dados);
          bytes = Number.isFinite(dados?.bytes) ? dados.bytes : 0;
          rev = Number.isFinite(dados?.rev) ? dados.rev : 0;
          regrediu = !!dados?.regrediu;
        });

        setEstado({
          mascara: mesclarRecebidos(base, deltas),
          base,
          deltas: ids,
          bytes,
          rev,
          regrediu,
          local,
          loading: false,
          error: null,
        });
      },
      (err) => setEstado({ ...VAZIO_DA_NEVOA, error: err }),
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
    const unsub = mesaRepo.watchGm(
      campaignId,
      instanceId,
      (gm) => setEstado({ gm, loading: false, error: null }),
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
    const unsub = mesaRepo.watchCampanhasDoMestre(
      uid,
      (lista) => {
        const todas = lista
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
