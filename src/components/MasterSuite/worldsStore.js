/**
 * Forja do Mestre — regra e estado da persistência (spec 0027, AC-2/AC-3/AC-5/AC-7).
 *
 * Continua sendo o único ponto de contato da suíte com os dados do mundo: nenhum
 * componente da Forja fala com o Firestore. O que mudou na onda 1.5 (spec 0030)
 * é COMO se fala: o SDK sumiu daqui e o endereçamento/escrita/assinatura passou
 * para `infrastructure/firestore/worldsRepo`. O que ficou é o que este arquivo
 * sempre foi de verdade — a regra da Forja:
 *
 *  - validação em português (o que a UI mostra quando o mestre erra);
 *  - `nameLower`, tags e atributos normalizados;
 *  - o cruzamento das conexões pelos DOIS lados (`fromId`/`toId`);
 *  - a semeadura do mundo demo, traduzindo ids locais em ids reais.
 *
 * Modelo:
 *   worlds/{worldId}                  { ownerUid, name, nameLower, description, genre, createdAt, updatedAt }
 *   worlds/{worldId}/entities/{id}    { type, name, nameLower, description, tags[], folderId,
 *                                       attributes[{key,value}], imageUrl, createdAt, updatedAt }
 *   worlds/{worldId}/connections/{id} { fromId, toId, relation, inverse, kind, createdAt }
 *   worlds/{worldId}/folders/{id}     { name, scope:'wiki'|'journal', parentId, order, createdAt, updatedAt }
 *
 * Regras da casa:
 *  - `nameLower` é SEMPRE derivado de `name` (busca insensível a caixa — AC-4).
 *  - `createdAt`/`updatedAt` viajam como o sentinela `SERVER_TIMESTAMP` do repo,
 *    que o traduz na borda; toda escrita mexe em `updatedAt`.
 *  - Nada falha em silêncio: entradas inválidas viram `Error` em PT-BR e erros do
 *    Firestore sobem para quem chamou (nos hooks, viram o campo `error`).
 */
import { useState, useEffect, useCallback } from "react";
import { auth } from "../../firebase";
import * as worldsRepo from "../../infrastructure/firestore/worldsRepo";
import { SERVER_TIMESTAMP } from "../../infrastructure/firestore/worldsRepo";
import { buildDemoWorld } from "./model/demoWorld";

/* ── Constantes ──────────────────────────────────────────────────────────── */

export const WORLDS = "worlds";
export const ENTITIES = "entities";
export const CONNECTIONS = "connections";
export const FOLDERS = "folders";

/** Limite duro do Firestore: 500 operações por lote. Quem o aplica é o repo. */
export { BATCH_LIMIT } from "../../infrastructure/firestore/worldsRepo";

/** Escopos válidos de pasta (wiki = verbetes, journal = páginas do Diário). */
export const FOLDER_SCOPES = ["wiki", "journal"];

/* ── Helpers de validação / normalização ─────────────────────────────────── */

const asText = (value) => (typeof value === "string" ? value.trim() : "");

/** Devolve o texto aparado ou lança `Error` com a mensagem informada. */
function requireText(value, message) {
  const text = asText(value);
  if (!text) throw new Error(message);
  return text;
}

/** `nameLower` canônico — a única forma de derivar o campo de busca. */
export const toNameLower = (name) => asText(name).toLowerCase();

/** Tags viram lista de textos aparados, sem vazios e sem repetição (ignora caixa). */
function sanitizeTags(tags) {
  if (tags == null) return [];
  if (!Array.isArray(tags)) throw new Error("As tags devem ser uma lista de textos.");
  const seen = new Set();
  return tags.reduce((acc, tag) => {
    const text = asText(tag);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) { seen.add(key); acc.push(text); }
    return acc;
  }, []);
}

/** Atributos viram lista de `{ key, value }` com chave obrigatória. */
function sanitizeAttributes(attributes) {
  if (attributes == null) return [];
  if (!Array.isArray(attributes)) {
    throw new Error("Os atributos devem ser uma lista de pares chave/valor.");
  }
  return attributes.reduce((acc, attr) => {
    const key = asText(attr?.key);
    if (!key) return acc;
    const raw = attr?.value;
    acc.push({ key, value: raw == null ? "" : String(raw).trim() });
    return acc;
  }, []);
}

/**
 * Dono gravado em CADA documento das subcoleções.
 *
 * Por que denormalizar: a regra de escrita precisa saber o dono, e resolvê-lo com
 * `get()` no documento do mundo custa uma "access call" por documento. O Firestore
 * permite no máximo 20 por escrita em lote — o mundo demo grava ~48 docs de uma vez
 * e o lote inteiro era negado. Com o dono no próprio documento a regra é O(1) e o
 * lote não tem teto.
 */
function ownerUidAtual() {
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) throw new Error("É preciso estar autenticado para escrever neste mundo.");
  return uid;
}

/* ── Mundos ──────────────────────────────────────────────────────────────── */

/**
 * Cria um mundo do mestre. Só `name` é obrigatório (AC-2).
 *
 * `demo` é gravado no documento: o seed (`model/demoWorld`) já marcava o mundo como
 * demonstração e o campo era descartado aqui — contrato mentindo. Persistir custa um
 * booleano e é o que permite distinguir depois o mundo de exemplo do mundo autoral
 * (selo na UI, "recriar demo", suporte). Mundo criado à mão grava `false`.
 *
 * @returns {Promise<string>} id do mundo criado.
 */
export async function createWorld(uid, { name, description, genre, demo } = {}) {
  const ownerUid = requireText(uid, "É preciso estar autenticado para criar um mundo.");
  const worldName = requireText(name, "Dê um nome ao mundo antes de criá-lo.");
  return worldsRepo.createWorld({
    ownerUid,
    name: worldName,
    nameLower: toNameLower(worldName),
    description: asText(description),
    genre: asText(genre),
    demo: demo === true,
    createdAt: SERVER_TIMESTAMP,
    updatedAt: SERVER_TIMESTAMP,
  });
}

/** Atualiza campos do mundo. `name`, se vier, é validado e re-deriva `nameLower`. */
export async function updateWorld(worldId, patch = {}) {
  const id = requireText(worldId, "Informe qual mundo deve ser atualizado.");
  if (!patch || typeof patch !== "object") {
    throw new Error("Informe os campos do mundo que devem ser atualizados.");
  }
  const data = { ...patch, updatedAt: SERVER_TIMESTAMP };
  if ("name" in patch) {
    const worldName = requireText(patch.name, "O nome do mundo não pode ficar vazio.");
    data.name = worldName;
    data.nameLower = toNameLower(worldName);
  }
  await worldsRepo.updateWorld(id, data);
}

/**
 * Marca o mundo como "mexido agora" — usado pela UI depois de editar conteúdo,
 * para que `useWorlds` (ordenado por `updatedAt`) reflita o uso recente.
 */
export async function touchWorld(worldId) {
  const id = requireText(worldId, "Informe qual mundo deve ser atualizado.");
  await worldsRepo.updateWorld(id, { updatedAt: SERVER_TIMESTAMP });
}

/**
 * Remove o mundo e TODAS as suas subcoleções (entidades, conexões, pastas).
 * O Firestore não apaga subcoleções em cascata — a varredura é nossa.
 */
export async function deleteWorld(worldId) {
  const id = requireText(worldId, "Informe qual mundo deve ser removido.");
  const ops = [];
  for (const nome of [ENTITIES, CONNECTIONS, FOLDERS]) {
    const docs = await worldsRepo.listSubcollection(id, nome); // eslint-disable-line no-await-in-loop
    docs.forEach((d) => ops.push({ op: "delete", path: [nome, d.id] }));
  }
  ops.push({ op: "delete", path: [] }); // o mundo por último
  await worldsRepo.commitBatch(id, ops);
}

/** Lê um mundo avulso (sem listener). `null` se não existir. */
export async function getWorld(worldId) {
  const id = requireText(worldId, "Informe qual mundo deve ser carregado.");
  return worldsRepo.getWorld(id);
}

/* ── Entidades (wiki) ────────────────────────────────────────────────────── */

/**
 * Cria um verbete da wiki. `type` e `name` são obrigatórios (AC-3); a validação
 * do conjunto dos 11 tipos vive em `model/entityTypes` (gate `entityTypes.test.js`).
 * @returns {Promise<string>} id da entidade criada.
 */
export async function createEntity(worldId, data = {}) {
  const id = requireText(worldId, "Selecione um mundo antes de criar a entidade.");
  const name = requireText(data.name, "Dê um nome à entidade antes de salvá-la.");
  const type = requireText(data.type, "Escolha o tipo da entidade antes de salvá-la.");
  return worldsRepo.createEntity(id, {
    ownerUid: ownerUidAtual(),
    type,
    name,
    nameLower: toNameLower(name),
    description: asText(data.description),
    tags: sanitizeTags(data.tags),
    folderId: asText(data.folderId) || null,
    attributes: sanitizeAttributes(data.attributes),
    imageUrl: asText(data.imageUrl) || null,
    createdAt: SERVER_TIMESTAMP,
    updatedAt: SERVER_TIMESTAMP,
  });
}

/** Atualiza um verbete. `name`/`tags`/`attributes` passam pelas mesmas regras da criação. */
export async function updateEntity(worldId, entityId, patch = {}) {
  const id = requireText(worldId, "Selecione um mundo antes de editar a entidade.");
  const docId = requireText(entityId, "Informe qual entidade deve ser atualizada.");
  if (!patch || typeof patch !== "object") {
    throw new Error("Informe os campos da entidade que devem ser atualizados.");
  }
  const data = { ...patch, updatedAt: SERVER_TIMESTAMP };
  if ("name" in patch) {
    const name = requireText(patch.name, "O nome da entidade não pode ficar vazio.");
    data.name = name;
    data.nameLower = toNameLower(name);
  }
  if ("type" in patch) {
    data.type = requireText(patch.type, "O tipo da entidade não pode ficar vazio.");
  }
  if ("tags" in patch) data.tags = sanitizeTags(patch.tags);
  if ("attributes" in patch) data.attributes = sanitizeAttributes(patch.attributes);
  if ("folderId" in patch) data.folderId = asText(patch.folderId) || null;
  await worldsRepo.updateEntity(id, docId, data);
}

/**
 * Remove o verbete E as conexões que o referenciam (AC-5: nada de arestas órfãs).
 * Entidade e conexões saem no mesmo lote sempre que couberem nos 500.
 *
 * As duas buscas (origem e destino) são nossas, não do repositório: cruzar os
 * lados e decidir que uma autoligação só pode ser apagada uma vez é regra da
 * Forja, não endereçamento.
 */
export async function deleteEntity(worldId, entityId) {
  const id = requireText(worldId, "Selecione um mundo antes de remover a entidade.");
  const docId = requireText(entityId, "Informe qual entidade deve ser removida.");
  const [comoOrigem, comoDestino] = await Promise.all([
    worldsRepo.listConnectionsByEndpoint(id, "fromId", docId),
    worldsRepo.listConnectionsByEndpoint(id, "toId", docId),
  ]);
  const seen = new Set();
  const ops = [];
  for (const conn of [...comoOrigem, ...comoDestino]) {
    if (seen.has(conn.id)) continue; // autoligação legada apareceria nas duas buscas
    seen.add(conn.id);
    ops.push({ op: "delete", path: [CONNECTIONS, conn.id] });
  }
  ops.push({ op: "delete", path: [ENTITIES, docId] });
  await worldsRepo.commitBatch(id, ops);
}

/* ── Conexões ────────────────────────────────────────────────────────────── */

/**
 * Cria uma conexão tipada entre duas entidades (AC-5).
 * Recusa autoligação e duplicata da mesma relação — inclusive quando a duplicata
 * chega pelo lado inverso (`A CONTÉM B` já existe ⇒ `B CONTIDO EM A` é recusado).
 * @returns {Promise<string>} id da conexão criada.
 */
export async function createConnection(worldId, conn = {}) {
  const id = requireText(worldId, "Selecione um mundo antes de criar a conexão.");
  const fromId = requireText(conn.fromId, "Escolha a entidade de origem da conexão.");
  const toId = requireText(conn.toId, "Escolha a entidade de destino da conexão.");
  const relation = requireText(conn.relation, "Descreva a relação entre as duas entidades.");
  if (fromId === toId) {
    throw new Error("Uma entidade não pode ser conectada a ela mesma.");
  }
  const inverse = asText(conn.inverse) || relation;
  const [diretas, inversas] = await Promise.all([
    worldsRepo.listConnectionsBetween(id, fromId, toId),
    worldsRepo.listConnectionsBetween(id, toId, fromId),
  ]);
  const wanted = relation.toLowerCase();
  const duplicated = [
    ...diretas.map((c) => asText(c.relation)),
    ...inversas.map((c) => asText(c.inverse)),
  ].some((label) => label.toLowerCase() === wanted);
  if (duplicated) {
    throw new Error("Essa conexão já existe entre as duas entidades.");
  }
  return worldsRepo.createConnection(id, {
    ownerUid: ownerUidAtual(),
    fromId,
    toId,
    relation,
    inverse,
    kind: asText(conn.kind) || null,
    createdAt: SERVER_TIMESTAMP,
  });
}

/** Remove uma conexão (a UI pode chamar a partir de qualquer um dos dois lados). */
export async function deleteConnection(worldId, connectionId) {
  const id = requireText(worldId, "Selecione um mundo antes de remover a conexão.");
  const docId = requireText(connectionId, "Informe qual conexão deve ser removida.");
  await worldsRepo.deleteConnection(id, docId);
}

/* ── Pastas ──────────────────────────────────────────────────────────────── */

/** Cria uma pasta de wiki ou de diário. @returns {Promise<string>} id da pasta. */
export async function createFolder(worldId, data = {}) {
  const id = requireText(worldId, "Selecione um mundo antes de criar a pasta.");
  const name = requireText(data.name, "Dê um nome à pasta antes de criá-la.");
  const scope = asText(data.scope) || "wiki";
  if (!FOLDER_SCOPES.includes(scope)) {
    throw new Error(`Escopo de pasta inválido: "${scope}". Use "wiki" ou "journal".`);
  }
  return worldsRepo.createFolder(id, {
    ownerUid: ownerUidAtual(),
    name,
    scope,
    parentId: asText(data.parentId) || null,
    order: Number.isFinite(data.order) ? data.order : 0,
    createdAt: SERVER_TIMESTAMP,
    updatedAt: SERVER_TIMESTAMP,
  });
}

/** Atualiza uma pasta (renomear, mover, reordenar). */
export async function updateFolder(worldId, folderId, patch = {}) {
  const id = requireText(worldId, "Selecione um mundo antes de editar a pasta.");
  const docId = requireText(folderId, "Informe qual pasta deve ser atualizada.");
  if (!patch || typeof patch !== "object") {
    throw new Error("Informe os campos da pasta que devem ser atualizados.");
  }
  const data = { ...patch, updatedAt: SERVER_TIMESTAMP };
  if ("name" in patch) {
    data.name = requireText(patch.name, "O nome da pasta não pode ficar vazio.");
  }
  if ("scope" in patch) {
    const scope = asText(patch.scope);
    if (!FOLDER_SCOPES.includes(scope)) {
      throw new Error(`Escopo de pasta inválido: "${scope}". Use "wiki" ou "journal".`);
    }
    data.scope = scope;
  }
  if ("parentId" in patch) {
    const parentId = asText(patch.parentId) || null;
    if (parentId === docId) throw new Error("Uma pasta não pode ser filha dela mesma.");
    data.parentId = parentId;
  }
  await worldsRepo.updateFolder(id, docId, data);
}

/**
 * Remove a pasta SEM apagar o que estava dentro: as entidades voltam para a raiz
 * (`folderId: null`) e as subpastas sobem um nível (herdam o `parentId` da pasta
 * removida). A exclusão da pasta vai no fim da fila, depois das realocações.
 */
export async function deleteFolder(worldId, folderId) {
  const id = requireText(worldId, "Selecione um mundo antes de remover a pasta.");
  const docId = requireText(folderId, "Informe qual pasta deve ser removida.");
  const pasta = await worldsRepo.getFolder(id, docId);
  const parentId = pasta ? (pasta.parentId ?? null) : null;

  const [entidades, subpastas] = await Promise.all([
    worldsRepo.listEntitiesInFolder(id, docId),
    worldsRepo.listChildFolders(id, docId),
  ]);

  const ops = [];
  entidades.forEach((e) => ops.push({
    op: "update", path: [ENTITIES, e.id], data: { folderId: null, updatedAt: SERVER_TIMESTAMP },
  }));
  subpastas.forEach((f) => ops.push({
    op: "update", path: [FOLDERS, f.id], data: { parentId, updatedAt: SERVER_TIMESTAMP },
  }));
  ops.push({ op: "delete", path: [FOLDERS, docId] });
  await worldsRepo.commitBatch(id, ops);
}

/* ── Mundo demo (AC-7) ───────────────────────────────────────────────────── */

/**
 * Cria o mundo de demonstração com entidades e conexões já ligadas.
 *
 * O seed (`model/demoWorld`) usa ids locais estáveis (`demo-personagem-1`…);
 * aqui esses ids são trocados pelos ids reais que o Firestore gera, para que as
 * conexões apontem para documentos de verdade.
 *
 * @returns {Promise<string>} id do mundo criado.
 */
export async function seedDemoWorld(uid) {
  const ownerUid = requireText(uid, "É preciso estar autenticado para criar o mundo demo.");
  const seed = buildDemoWorld();
  if (!seed || !Array.isArray(seed.entities) || !Array.isArray(seed.connections)) {
    throw new Error("O conteúdo do mundo demo está indisponível ou corrompido.");
  }

  const worldId = await createWorld(ownerUid, seed.world || {});
  try {
    await popularDemo(worldId, seed);
  } catch (e) {
    /* O documento do mundo JÁ existe quando o conteúdo falha: sem esta marca a UI
     * não tem como saber que sobrou um mundo vazio na conta do mestre — e era assim
     * que o demo nascia vazio sem ninguém avisar. Quem chama decide o que dizer. */
    if (e && typeof e === "object") {
      e.worldId = worldId;
      e.mundoParcial = true;
    }
    throw e;
  }
  return worldId;
}

/**
 * Grava entidades e conexões do seed no mundo já criado.
 *
 * Os ids são reservados ANTES da escrita (`newSubDocId`) justamente para que as
 * conexões já nasçam apontando para os documentos certos — entidades e arestas
 * entram no MESMO lote, e um lote não pode ler o id que ele próprio vai gerar.
 */
async function popularDemo(worldId, seed) {
  const localToReal = new Map();
  const dono = ownerUidAtual();
  const ops = [];

  for (const entity of seed.entities) {
    const localId = asText(entity?.id ?? entity?.localId);
    if (!localId) throw new Error("Uma entidade do mundo demo está sem id local.");
    if (localToReal.has(localId)) {
      throw new Error(`O mundo demo tem o id local repetido: "${localId}".`);
    }
    const name = requireText(entity.name, "Uma entidade do mundo demo está sem nome.");
    const type = requireText(entity.type, `A entidade "${name}" do mundo demo está sem tipo.`);
    const realId = worldsRepo.newSubDocId(worldId, ENTITIES); // id gerado pelo cliente
    localToReal.set(localId, realId);
    ops.push({
      op: "set",
      path: [ENTITIES, realId],
      data: {
        ownerUid: dono,
        type,
        name,
        nameLower: toNameLower(name),
        description: asText(entity.description),
        tags: sanitizeTags(entity.tags),
        folderId: null,
        attributes: sanitizeAttributes(entity.attributes),
        imageUrl: asText(entity.imageUrl) || null,
        createdAt: SERVER_TIMESTAMP,
        updatedAt: SERVER_TIMESTAMP,
      },
    });
  }

  for (const conn of seed.connections) {
    const fromLocal = asText(conn?.fromId ?? conn?.from);
    const toLocal = asText(conn?.toId ?? conn?.to);
    const fromId = localToReal.get(fromLocal);
    const toId = localToReal.get(toLocal);
    if (!fromId || !toId) {
      throw new Error(`Conexão do mundo demo aponta para uma entidade inexistente: "${fromLocal}" → "${toLocal}".`);
    }
    const relation = requireText(conn.relation, "Uma conexão do mundo demo está sem relação.");
    ops.push({
      op: "set",
      path: [CONNECTIONS, worldsRepo.newSubDocId(worldId, CONNECTIONS)],
      data: {
        ownerUid: dono,
        fromId,
        toId,
        relation,
        inverse: asText(conn.inverse) || relation,
        kind: asText(conn.kind) || null,
        createdAt: SERVER_TIMESTAMP,
      },
    });
  }

  await worldsRepo.commitBatch(worldId, ops);
}

/* ── Hooks ───────────────────────────────────────────────────────────────── */

/**
 * Assina uma coleção e devolve `{ data, loading, error }`.
 *
 * `montarAssinatura` devolve a função de assinatura do repositório — ou `null`
 * quando não há nada para assinar (sem uid, sem mundo ativo). Retornar `null` e
 * não assinar é o que mantém a Forja quieta enquanto o mestre não escolheu nada:
 * `loading` fica `false` e a lista fica vazia sem tocar a rede.
 */
function useCollection(montarAssinatura, deps) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const assinar = montarAssinatura();
    if (!assinar) { setData([]); setLoading(false); setError(null); return undefined; }
    setLoading(true);
    setError(null);
    const unsub = assinar(
      (lista) => { setData(lista); setLoading(false); },
      (err) => { setError(err); setData([]); setLoading(false); },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

/**
 * Mundos do mestre, do mais recente para o mais antigo (AC-2).
 *
 * Cada mundo carrega `pendenteNoServidor` (ver `worldsRepo`): `true` enquanto
 * a criação só existe no cliente. Ler o acervo de um mundo pendente é negado.
 *
 * ATENÇÃO (infra): a query do repositório (igualdade em `ownerUid` + ordenação
 * por `updatedAt` desc) exige um ÍNDICE COMPOSTO em `worlds`. Sem ele o
 * Firestore recusa a query e o erro chega em `error` com o link de criação do
 * índice no console.
 */
export function useWorlds(uid) {
  const { data, loading, error } = useCollection(
    () => (uid
      ? (onChange, onError) => worldsRepo.watchWorldsByOwner(uid, onChange, onError)
      : null),
    [uid],
  );
  return { worlds: data, loading, error };
}

/** Verbetes do mundo ativo (AC-3/AC-4). Ordenação fina fica com a UI. */
export function useEntities(worldId) {
  const { data, loading, error } = useCollection(
    () => (worldId
      ? (onChange, onError) => worldsRepo.watchSubcollection(
        worldId, ENTITIES, { campo: "updatedAt", direcao: "desc" }, onChange, onError)
      : null),
    [worldId],
  );
  return { entities: data, loading, error };
}

/** Conexões do mundo ativo (AC-5). */
export function useConnections(worldId) {
  const { data, loading, error } = useCollection(
    () => (worldId
      ? (onChange, onError) => worldsRepo.watchSubcollection(
        worldId, CONNECTIONS, { campo: "createdAt", direcao: "desc" }, onChange, onError)
      : null),
    [worldId],
  );
  return { connections: data, loading, error };
}

/** Pastas do mundo ativo. */
export function useFolders(worldId) {
  const { data, loading, error } = useCollection(
    () => (worldId
      ? (onChange, onError) => worldsRepo.watchSubcollection(
        worldId, FOLDERS, { campo: "order", direcao: "asc" }, onChange, onError)
      : null),
    [worldId],
  );
  return { folders: data, loading, error };
}

/* ── Mundo ativo (persistido por usuário) ────────────────────────────────── */

/** Chave do `localStorage` que guarda o mundo ativo de cada mestre (AC-2). */
export const activeWorldStorageKey = (uid) => `nexus.forja.activeWorld.${uid}`;

function safeStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch (_) {
    return null; // Safari em navegação privada bloqueia o acesso
  }
}

function readStoredWorld(uid) {
  const storage = safeStorage();
  if (!storage || !uid) return null;
  try {
    return storage.getItem(activeWorldStorageKey(uid)) || null;
  } catch (e) {
    console.warn("Forja do Mestre: não foi possível ler o mundo ativo salvo.", e);
    return null;
  }
}

function writeStoredWorld(uid, worldId) {
  const storage = safeStorage();
  if (!storage || !uid) return;
  try {
    if (worldId) storage.setItem(activeWorldStorageKey(uid), worldId);
    else storage.removeItem(activeWorldStorageKey(uid));
  } catch (e) {
    console.warn("Forja do Mestre: não foi possível salvar o mundo ativo.", e);
  }
}

/**
 * Mundo ativo do mestre, preservado entre reloads (AC-2).
 *
 * Guarda o id no `localStorage` numa chave por usuário e confere no Firestore se
 * o mundo ainda existe — se foi apagado (aqui ou em outro dispositivo), limpa a
 * seleção em vez de deixar a Forja apontando para o vazio. Falha de rede não
 * limpa nada: só a ausência confirmada do documento limpa.
 *
 * @returns {{ activeWorldId: string|null, setActiveWorldId: (id: string|null) => void }}
 */
export function useActiveWorld(uid) {
  const [activeWorldId, setActive] = useState(null);

  useEffect(() => {
    setActive(uid ? readStoredWorld(uid) : null);
  }, [uid]);

  useEffect(() => {
    if (!uid || !activeWorldId) return undefined;
    let cancelled = false;
    worldsRepo.getWorld(activeWorldId)
      .then((mundo) => {
        if (cancelled || mundo) return;
        writeStoredWorld(uid, null);
        setActive(null);
      })
      .catch((e) => {
        // Documento inexistente cai como `permission-denied` (a regra lê
        // `resource.data.ownerUid`, e `resource` é nulo quando o doc não existe).
        // Na prática significa a mesma coisa que "não é mais seu": limpa a seleção
        // presa, senão a Forja fica travada num mundo fantasma do localStorage.
        if (!cancelled && e && e.code === "permission-denied") {
          writeStoredWorld(uid, null);
          setActive(null);
          return;
        }
        // Offline/rede: mantém a seleção e avisa — não some com o mundo do mestre.
        console.warn("Forja do Mestre: não foi possível conferir o mundo ativo.", e);
      });
    return () => { cancelled = true; };
  }, [uid, activeWorldId]);

  const setActiveWorldId = useCallback((worldId) => {
    const next = asText(worldId) || null;
    setActive(next);
    writeStoredWorld(uid, next);
  }, [uid]);

  return { activeWorldId, setActiveWorldId };
}
