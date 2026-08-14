/**
 * Agregado MESA DO MAPA-MÚNDI — `campaigns/{cid}/worldmaps/{instanceId}/**`.
 *
 * Fecha a fronteira do `components/WorldMap/mesaStore.js`, que até a onda 1.5 falava
 * `firebase/firestore` direto (ADR-0010, dívida datada no `overrides` do ESLint).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ESTE REPOSITÓRIO GUARDA O MECANISMO DE SEGREDO — leia antes de mexer.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A arquitetura ATELIÊ/MESA (spec 0028, ADR-0006) não tem servidor para filtrar nada:
 * o que impede o jogador de ver o mapa inteiro é a SEPARAÇÃO DE DOCUMENTO. O molde
 * privado vive em `users/{uid}/worldmaps/**` e a campanha recebe uma instância com só
 * o que já foi revelado. Duas consequências para quem edita este arquivo:
 *
 *  1. `gm` (`.../gm/estado`) é o painel do MESTRE — o jogador nem lê. `party`
 *     (`.../party/estado`) é do grupo inteiro. Trocar um alvo pelo outro num lote
 *     publica o segredo para a mesa sem nenhum sintoma na tela. Os dois têm caminhos
 *     distintos em `paths.js` (`mesaGmDoc` / `mesaPartyDoc`) exatamente para que a
 *     confusão seja impossível de cometer por engano de string.
 *  2. Segredo não vaza pelo dado, vaza pela DIFERENÇA. Por isso `apagarRevelado`
 *     APAGA o documento em vez de gravar `state: 'hidden'`, e por isso este repositório
 *     NUNCA completa um objeto que recebeu: se quem chamou mandou `flags` sem a chave
 *     da pausa, é porque desligar a pausa significa a AUSÊNCIA da chave — gravar
 *     `false` no lugar dela contaria ao jogador que a pausa existe.
 *
 * ── O que é DELE e o que NÃO é (spec 0030 AC-3) ─────────────────────────────
 * Aqui mora caminho, escrita, leitura e política de erro. Fora daqui ficam a névoa em
 * bitmap (1 bit/px, RLE+varint), a viagem por curva em velocidade constante, o sorteio
 * de encontros em duas etapas e as projeções em lista branca do AC-1. **O repositório
 * recebe a névoa já codificada e grava a string.**
 *
 * ── Nenhuma primitiva do SDK atravessa a fronteira (AC-4) ───────────────────
 * `DocumentReference`, `QuerySnapshot`, `WriteBatch`, `Transaction` e `serverTimestamp`
 * morrem neste arquivo. A borda fala em ids de string, objetos planos e:
 *  · `aplicarEmLote(cid, iid, ops)` — o lote vira uma LISTA DE OPERAÇÕES simples
 *    (`{tipo, alvo, docId, dados, carimbar}`), sem ref nenhuma;
 *  · `transacionar(cid, iid, alvo, decidir)` — a transação vira um callback que recebe
 *    o documento como objeto plano e devolve `{resultado, gravar}`. A decisão (que
 *    viagem é essa? que pendência é essa?) continua sendo do store;
 *  · `carimbar: ["updatedAt"]` — o relógio do servidor é pedido por NOME de campo;
 *    o `serverTimestamp()` nunca é montado pela borda.
 *
 * ── DÍVIDA QUITADA (spec 0032 AC-5) ─────────────────────────────────────────
 * `createdAt`, `updatedAt` e `syncedAt` saem daqui como **epoch-ms numérico**, nunca mais
 * como `Timestamp` do SDK — era a última primitiva do SDK a atravessar a fronteira (aceita
 * no ADR-0010). A normalização acontece nos pontos únicos onde o documento é achatado
 * (`listaComId`, `docComId`, `lerMoldeDoAtelie`, `transacionar`, `watchNevoa`).
 *
 * ── Política de erro (AC-7) ─────────────────────────────────────────────────
 * Tudo é `strict` menos `listarNevoa`, porque era o único ponto onde o legado engolia a
 * falha (`getDocs(fogCol(...)).catch(() => ({docs: []}))`, em `limparProgresso`).
 * A spec 0030 preserva comportamento; consertar falha silenciosa é onda 3.
 *
 * @see ../../../docs/architecture/adr/0010-camada-de-infraestrutura.md
 * @see ../../../docs/architecture/adr/0006-mapa-v2-elementos-em-docs.md
 */
import {
  getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
  query, where, serverTimestamp, writeBatch, runTransaction,
} from "firebase/firestore";
import { db, docAt, colAt, silent, comDatasEmMs, NOOP_UNSUBSCRIBE } from "./client";
import {
  campaignsCol, atelieMapDoc, atelieSubCol,
  mesaMapsCol, mesaMapDoc, mesaRevealedCol, mesaRevealedDoc,
  mesaFogCol, mesaFogDoc, mesaGmDoc, mesaPartyDoc, mesaMediaDoc,
  ESTADO_DOC_ID, FUNDO_DOC_ID,
} from "./paths";

/**
 * Reexportados para que o store não precise conhecer `paths.js`. São os ids fixos dos
 * documentos singleton (`party/estado`, `fog/estado`, `gm/estado`, `media/background`).
 */
export { ESTADO_DOC_ID, FUNDO_DOC_ID };

/** Limite duro do Firestore: 500 operações por `writeBatch`. */
export const BATCH_LIMIT = 500;

/* ════════════════════════════════════════════════════════════════════
 *  OS ALVOS — o vocabulário da borda
 *  --------------------------------------------------------------------
 *  Quem chama nomeia um ALVO ("party", "gm", "revelado"…), nunca um caminho.
 *  É o que impede o `mesaStore` de voltar a montar `["campaigns", cid, …]` na
 *  mão e, sobretudo, o que mantém `gm` e `party` separados por construção.
 * ══════════════════════════════════════════════════════════════════ */

const ALVOS = {
  /** Documento raiz da instância — o único cuja regra gasta um `get()`. */
  instancia: (cid, iid) => mesaMapDoc(cid, iid),
  /** Estado do GRUPO. Lido por toda a mesa. */
  party: (cid, iid) => mesaPartyDoc(cid, iid),
  /** Estado do MESTRE. O jogador NÃO lê — é onde o segredo mora. */
  gm: (cid, iid) => mesaGmDoc(cid, iid),
  /** Névoa: `fog/estado` (base consolidada) ou `fog/d_*` (delta), pelo `docId`. */
  fog: (cid, iid, docId) => mesaFogDoc(cid, iid, docId || ESTADO_DOC_ID),
  /** Um item revelado (nó, trilha ou evento já projetado). */
  revelado: (cid, iid, docId) => mesaRevealedDoc(cid, iid, docId),
  /** Cópia da ilustração de fundo, em base64. */
  fundo: (cid, iid) => mesaMediaDoc(cid, iid, FUNDO_DOC_ID),
};

function caminhoDoAlvo(campaignId, instanceId, op) {
  const montar = ALVOS[op?.alvo];
  if (!montar) {
    throw new Error(
      `Alvo desconhecido no lote da mesa: "${op?.alvo}". Isto é um erro de programação `
      + "do Nexus, não algo que você fez.",
    );
  }
  return montar(campaignId, instanceId, op.docId);
}

/**
 * Carimba o relógio do SERVIDOR nos campos pedidos por nome.
 *
 * O `serverTimestamp()` é FieldValue do SDK: montá-lo na borda o faria atravessar a
 * fronteira (AC-4). Quem chama diz `carimbar: ["createdAt", "updatedAt"]` e a primitiva
 * some aqui dentro.
 */
function comCarimbo(dados, carimbar) {
  const campos = Array.isArray(carimbar) ? carimbar : [];
  if (!campos.length) return dados || {};
  const saida = { ...(dados || {}) };
  campos.forEach((campo) => { saida[campo] = serverTimestamp(); });
  return saida;
}

/**
 * Os campos que `comCarimbo` grava com o relógio do servidor — e, por isso, exatamente os que
 * voltam como `Timestamp` do SDK. `syncedAt` entra na lista porque a ressincronização do molde
 * o pede (`carimbar: ["syncedAt", "updatedAt"]` no `mesaStore`).
 *
 * DÍVIDA QUITADA (spec 0032 AC-5): eles saem daqui como epoch-ms NUMÉRICO. Campo AUSENTE
 * continua ausente — o que importa nesta mesa, onde o segredo vaza pela DIFERENÇA: criar
 * `updatedAt: null` num documento revelado que nunca o teve mudaria o que o jogador enxerga.
 */
const CAMPOS_DE_DATA = ["createdAt", "updatedAt", "syncedAt"];

/**
 * Snapshot de coleção → lista de objetos planos, com o id junto.
 *
 * `serverTimestamps: "estimate"` é herdado do `snapToList` do store: sem ele, um
 * documento acabado de gravar chega com `updatedAt: null` até o servidor confirmar.
 * Ele continua AQUI depois da spec 0032 (AC-5): a normalização para epoch-ms roda sobre a
 * estimativa, não no lugar dela.
 */
const listaComId = (snap) =>
  snap.docs.map((d) => ({
    id: d.id,
    ...comDatasEmMs(d.data({ serverTimestamps: "estimate" }), CAMPOS_DE_DATA),
  }));

/** Documento único → objeto plano com o id, ou `null` quando não existe. */
const docComId = (snap) => (snap.exists()
  ? { id: snap.id, ...comDatasEmMs(snap.data({ serverTimestamps: "estimate" }), CAMPOS_DE_DATA) }
  : null);

/* ════════════════════════════════════════════════════════════════════
 *  LEITURAS PONTUAIS
 * ══════════════════════════════════════════════════════════════════ */

/**
 * A instância já está nesta mesa?
 *
 * Devolve só o booleano de propósito: quem pergunta (`levarParaMesa`) precisa decidir
 * entre recusar e recomeçar, não ler o progresso do grupo.
 *
 * @policy strict @returns {Promise<boolean>}
 */
export async function existeInstancia(campaignId, instanceId) {
  if (!campaignId || !instanceId) return false;
  const snap = await getDoc(docAt(mesaMapDoc(campaignId, instanceId)));
  return snap.exists();
}

/**
 * O documento raiz do MOLDE, no ateliê privado do mestre.
 *
 * Sem `serverTimestamps: "estimate"` — é o que o legado fazia (`raiz.data()` cru), e o
 * molde não tem campo de tempo que a tela leia. As datas passam pelo normalizador da spec
 * 0032 (AC-5) mesmo assim: o molde TEM `createdAt`/`updatedAt` gravados pelo `worldMapsRepo`,
 * e a regra é da fronteira, não de quem a lê hoje.
 *
 * @policy strict @returns {Promise<object|null>} `null` quando o molde não existe mais.
 */
export async function lerMoldeDoAtelie(uid, mapId) {
  if (!uid || !mapId) return null;
  const snap = await getDoc(docAt(atelieMapDoc(uid, mapId)));
  return snap.exists() ? { id: snap.id, ...comDatasEmMs(snap.data(), CAMPOS_DE_DATA) } : null;
}

/**
 * Uma subcoleção do molde (`nodes`, `edges`…), nomeada em tempo de execução.
 *
 * O nome vem do `worldMapStore`, que é o dono do ateliê — este repositório não decide
 * como o molde se chama, só sabe onde ele fica.
 *
 * @policy strict @returns {Promise<object[]>}
 */
export async function listarSubcolecaoDoMolde(uid, mapId, nome) {
  if (!uid || !mapId || !nome) return [];
  return listaComId(await getDocs(colAt(atelieSubCol(uid, mapId, nome))));
}

/**
 * Tudo que já foi revelado nesta mesa — UMA leitura de coleção, não uma por documento.
 * @policy strict @returns {Promise<object[]>}
 */
export async function listarRevelado(campaignId, instanceId) {
  if (!campaignId || !instanceId) return [];
  return listaComId(await getDocs(colAt(mesaRevealedCol(campaignId, instanceId))));
}

/**
 * A coleção inteira da névoa — base consolidada E deltas pendentes.
 *
 * @policy silent — devolve `[]` quando falha. É o único ponto silencioso do repositório,
 *   e ele existe porque o legado escrevia `getDocs(fogCol(...)).catch(() => ({docs: []}))`
 *   dentro de `limparProgresso`: recomeçar a mesa não podia travar porque a névoa não
 *   pôde ser listada. A spec 0030 preserva comportamento (AC-7); o conserto é onda 3.
 *   A única diferença é que agora a falha aparece no console com a tag `[mesaRepo.…]`,
 *   em vez de sumir sem rastro.
 * @returns {Promise<object[]>}
 */
export async function listarNevoa(campaignId, instanceId) {
  if (!campaignId || !instanceId) return [];
  return silent("mesaRepo.listarNevoa", [], async () =>
    listaComId(await getDocs(colAt(mesaFogCol(campaignId, instanceId)))));
}

/**
 * A ilustração copiada para a mesa (dataURL em base64), sob demanda.
 *
 * `null` quando a instância não tem arte própria — mapa padrão vetorial ou fundo no
 * Storage. Devolve só a string: o documento inteiro não interessa à tela.
 *
 * @policy strict @returns {Promise<string|null>}
 */
export async function lerFundoDaMesa(campaignId, instanceId) {
  if (!campaignId || !instanceId) return null;
  const snap = await getDoc(docAt(mesaMediaDoc(campaignId, instanceId, FUNDO_DOC_ID)));
  return snap.exists() ? (snap.data()?.data || null) : null;
}

/* ════════════════════════════════════════════════════════════════════
 *  ESCRITAS PONTUAIS
 * ══════════════════════════════════════════════════════════════════ */

/**
 * Grava um delta de névoa em `fog/{docId}`.
 *
 * O payload chega PRONTO — bitmap já serializado pelo `model/fogMask.js`. Nenhuma
 * codificação acontece aqui (AC-3).
 *
 * @policy strict
 */
export async function salvarNevoaDelta(campaignId, instanceId, docId, dados) {
  await setDoc(
    docAt(mesaFogDoc(campaignId, instanceId, docId)),
    comCarimbo(dados, ["updatedAt"]),
  );
}

/**
 * APAGA um documento de `revealed/` — e apagar é o ponto, não um detalhe.
 *
 * Rebaixar um lugar a "oculto" **não** grava `state: 'hidden'`: o documento some. Um
 * documento que existisse com o estado `hidden` diria ao jogador *"há alguma coisa aqui
 * que você não pode ver"*, que é precisamente o que o AC-1 proíbe — o segredo vaza pela
 * DIFERENÇA entre "não existe" e "existe escondido". Ver `mesaRepo.test.js`.
 *
 * @policy strict
 */
export async function apagarRevelado(campaignId, instanceId, docId) {
  await deleteDoc(docAt(mesaRevealedDoc(campaignId, instanceId, docId)));
}

/**
 * Atualização parcial de um documento de `revealed/` (o mestre rebaixa a um estado que
 * ainda é visível — de `visited` para `rumored`, por exemplo).
 *
 * @param {object} campos campos JÁ prontos, sem FieldValue.
 * @policy strict
 */
export async function atualizarRevelado(campaignId, instanceId, docId, campos) {
  await updateDoc(
    docAt(mesaRevealedDoc(campaignId, instanceId, docId)),
    comCarimbo(campos, ["updatedAt"]),
  );
}

/**
 * Atualização parcial de `party/estado` — o estado do GRUPO.
 *
 * **Grava exatamente as chaves recebidas.** Não completa objeto ausente e não converte
 * ausência em `false`: quando o store desliga a pausa da viagem, ele manda o objeto
 * `flags` SEM a chave da pausa, e é assim que ela tem de chegar ao banco. Quem decide
 * quais campos cabem na regra do jogador (`onlyUpdatingFields`) é o store.
 *
 * @param {object} campos campos JÁ prontos, sem FieldValue.
 * @policy strict
 */
export async function atualizarParty(campaignId, instanceId, campos) {
  await updateDoc(
    docAt(mesaPartyDoc(campaignId, instanceId)),
    comCarimbo(campos, ["updatedAt"]),
  );
}

/**
 * Mescla campos em `gm/estado` — o painel do MESTRE, que o jogador nem lê.
 *
 * `merge: true` porque o painel nasce em `levarParaMesa` e daí em diante só recebe
 * remendos (o rascunho, os eventos disparados, a pendência do encontro).
 *
 * @param {object} campos campos JÁ prontos, sem FieldValue.
 * @policy strict
 */
export async function mesclarGm(campaignId, instanceId, campos) {
  await setDoc(
    docAt(mesaGmDoc(campaignId, instanceId)),
    comCarimbo(campos, ["updatedAt"]),
    { merge: true },
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  O LOTE
 * ══════════════════════════════════════════════════════════════════ */

/**
 * Aplica uma lista de operações em lotes de no máximo `BATCH_LIMIT`.
 *
 * O `WriteBatch` do SDK não atravessa a fronteira (AC-4): quem chama descreve o que quer
 * e a ordem em que quer, com objetos planos.
 *
 * O fatiamento em 500 é regra do Firestore, não do domínio — por isso mora aqui. E o
 * lote inteiro cai dentro da subárvore de UMA instância de propósito: é o id dela que
 * autoriza a escrita nas `firestore.rules` sem gastar access call (o teto de 20 por lote
 * foi o bug que esvaziou o mundo demo da Forja).
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {Array<{tipo:'set'|'update'|'delete', alvo:string, docId?:string,
 *                dados?:object, carimbar?:string[]}>} ops na ordem de execução.
 * @returns {Promise<number>} quantas operações foram enviadas.
 * @policy strict
 */
export async function aplicarEmLote(campaignId, instanceId, ops = []) {
  const lista = Array.isArray(ops) ? ops : [];
  if (!lista.length) return 0;

  for (let i = 0; i < lista.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const op of lista.slice(i, i + BATCH_LIMIT)) {
      const ref = docAt(caminhoDoAlvo(campaignId, instanceId, op));
      if (op.tipo === "delete") batch.delete(ref);
      else if (op.tipo === "update") batch.update(ref, comCarimbo(op.dados, op.carimbar));
      else batch.set(ref, comCarimbo(op.dados, op.carimbar));
    }
    await batch.commit(); // eslint-disable-line no-await-in-loop
  }
  return lista.length;
}

/* ════════════════════════════════════════════════════════════════════
 *  A TRANSAÇÃO
 * ══════════════════════════════════════════════════════════════════ */

/**
 * Lê um documento da mesa e grava sobre ele **na mesma transação**.
 *
 * Existe porque duas abas do mestre podem ver a mesma chegada (ou o mesmo encontro) no
 * mesmo instante. Quem decide o que fazer com o que está gravado é o STORE — a regra
 * "é esta viagem mesmo?", "esta pendência já foi decidida?" é domínio, não infraestrutura.
 * O que este módulo garante é só que a leitura e a escrita são atômicas e que o
 * `Transaction` do SDK não escapa daqui.
 *
 * @param {string} campaignId
 * @param {string} instanceId
 * @param {'instancia'|'party'|'gm'|'fog'|'revelado'|'fundo'} alvo
 * @param {(atual: object|null) => ({resultado?: any, gravar?: object, carimbar?: string[]})} decidir
 *   recebe o documento como OBJETO PLANO (`null` se não existe) e devolve o que gravar.
 *   Sem `gravar`, nada é escrito — é assim que "quem chegou depois" não mexe em nada.
 * @returns {Promise<any>} o `resultado` que `decidir` devolveu.
 * @policy strict
 */
export function transacionar(campaignId, instanceId, alvo, decidir) {
  const ref = docAt(caminhoDoAlvo(campaignId, instanceId, { alvo }));
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    // Datas em epoch-ms também aqui (spec 0032 AC-5): `decidir` é código do store, do outro
    // lado da fronteira. O que ele devolve em `gravar` é montado do zero — nenhuma decisão
    // repassa o documento lido —, então normalizar a leitura não muda o que é escrito.
    const atual = snap.exists() ? comDatasEmMs(snap.data(), CAMPOS_DE_DATA) : null;
    const decisao = (await decidir(atual)) || {};
    if (decisao.gravar) {
      tx.set(ref, comCarimbo(decisao.gravar, decisao.carimbar || ["updatedAt"]), { merge: true });
    }
    return decisao.resultado;
  });
}

/* ════════════════════════════════════════════════════════════════════
 *  ASSINATURAS EM TEMPO REAL
 *  --------------------------------------------------------------------
 *  Todas devolvem um unsubscribe — inclusive quando não assinam nada, para
 *  quem chama nunca precisar de `if (unsub) unsub()`. Chamar duas vezes é
 *  seguro. O erro sobe CRU para quem assinou: traduzir é da tela.
 * ══════════════════════════════════════════════════════════════════ */

/** Repassa o erro cru ao assinante e deixa rastro no console com a tag do repo. */
const aoFalhar = (tag, onError) => (e) => {
  console.error(`[mesaRepo.${tag}] falhou:`, e);
  if (onError) onError(e);
};

/**
 * Os mapas-múndi que estão nesta mesa.
 * @param {(instancias: object[]) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function watchInstancias(campaignId, onChange, onError) {
  if (!campaignId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    colAt(mesaMapsCol(campaignId)),
    (snap) => onChange(listaComId(snap)),
    aoFalhar("watchInstancias", onError),
  );
}

/**
 * O que já foi revelado — a ÚNICA fonte do mapa para o jogador (AC-1).
 * @param {(revelado: object[]) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function watchRevelado(campaignId, instanceId, onChange, onError) {
  if (!campaignId || !instanceId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    colAt(mesaRevealedCol(campaignId, instanceId)),
    (snap) => onChange(listaComId(snap)),
    aoFalhar("watchRevelado", onError),
  );
}

/**
 * Onde o grupo está, que horas são, quanta comida resta.
 *
 * `local` repassa `metadata.hasPendingWrites` — o eco da PRÓPRIA escrita deste cliente,
 * que o Firestore entrega otimisticamente antes de o servidor confirmar. Quem já animou
 * o percurso não pode animá-lo de novo por causa dele.
 *
 * @param {(estado: {party: object|null, local: boolean}) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function watchParty(campaignId, instanceId, onChange, onError) {
  if (!campaignId || !instanceId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    docAt(mesaPartyDoc(campaignId, instanceId)),
    (snap) => onChange({ party: docComId(snap), local: !!snap.metadata?.hasPendingWrites }),
    aoFalhar("watchParty", onError),
  );
}

/**
 * A COLEÇÃO da névoa — base consolidada e deltas juntos.
 *
 * Entrega os documentos crus (`{id, dados}`) porque quem sabe desserializar bitmap é o
 * `model/fogMask.js`, não a infraestrutura. O `dados` fica num campo próprio de propósito:
 * o payload da névoa mora numa chave chamada `data`, e achatá-la ao lado de `id` só
 * convidaria a colisão.
 *
 * @param {(estado: {docs: Array<{id:string, dados:object}>, local: boolean}) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function watchNevoa(campaignId, instanceId, onChange, onError) {
  if (!campaignId || !instanceId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    colAt(mesaFogCol(campaignId, instanceId)),
    (snap) => onChange({
      // `dados` também sai com a data em epoch-ms (spec 0032 AC-5) — o payload do bitmap
      // segue cru, que é o que `model/fogMask.js` desserializa.
      docs: snap.docs.map((d) => ({ id: d.id, dados: comDatasEmMs(d.data(), CAMPOS_DE_DATA) })),
      local: !!snap.metadata?.hasPendingWrites,
    }),
    aoFalhar("watchNevoa", onError),
  );
}

/**
 * O painel do mestre.
 *
 * Quem chama é responsável por só assinar quando quem olha É o mestre: as rules já negam
 * a leitura ao jogador, e assinar assim mesmo encheria o console dele de
 * `permission-denied` por um documento que ele não deve sequer tentar ler.
 *
 * @param {(gm: object|null) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function watchGm(campaignId, instanceId, onChange, onError) {
  if (!campaignId || !instanceId) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    docAt(mesaGmDoc(campaignId, instanceId)),
    (snap) => onChange(docComId(snap)),
    aoFalhar("watchGm", onError),
  );
}

/**
 * As campanhas em que este usuário é o MESTRE — o destino possível de "Levar para a mesa".
 *
 * Sem `orderBy`: `where` + `orderBy` em campos diferentes exigiria índice composto. A
 * ordenação e o filtro de campanha arquivada ficam no store, que é curto o bastante.
 *
 * @param {(campanhas: object[]) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function watchCampanhasDoMestre(uid, onChange, onError) {
  if (!uid) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    query(colAt(campaignsCol()), where("masterId", "==", uid)),
    (snap) => onChange(listaComId(snap)),
    aoFalhar("watchCampanhasDoMestre", onError),
  );
}
