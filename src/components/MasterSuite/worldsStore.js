/**
 * Forja do Mestre — camada de persistência (spec 0027, AC-2/AC-3/AC-5/AC-7).
 *
 * Único ponto de contato da suíte com o Firestore. Nenhum componente da Forja
 * deve importar `firebase/firestore` diretamente: tudo passa por aqui, para que
 * o modelo de dados fique num lugar só e possa ser testado com o SDK mockado.
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
 *  - `createdAt`/`updatedAt` usam `serverTimestamp()`; toda escrita mexe em `updatedAt`.
 *  - Nada falha em silêncio: entradas inválidas viram `Error` em PT-BR e erros do
 *    Firestore sobem para quem chamou (nos hooks, viram o campo `error`).
 */
import { useState, useEffect, useCallback } from "react";
import {
  doc, getDoc, updateDoc, collection, addDoc, query, orderBy,
  onSnapshot, getDocs, serverTimestamp, where, deleteDoc, writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { buildDemoWorld } from "./model/demoWorld";

/* ── Constantes ──────────────────────────────────────────────────────────── */

export const WORLDS = "worlds";
export const ENTITIES = "entities";
export const CONNECTIONS = "connections";
export const FOLDERS = "folders";

/** Limite duro do Firestore: 500 operações por `writeBatch`. */
export const BATCH_LIMIT = 500;

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

/* ── Helpers de caminho ──────────────────────────────────────────────────── */

const worldsCol = () => collection(db, WORLDS);
const worldRef = (worldId) => doc(db, WORLDS, worldId);
const subCol = (worldId, name) => collection(db, WORLDS, worldId, name);
const subRef = (worldId, name, id) => doc(db, WORLDS, worldId, name, id);

const snapToList = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

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

/* ── Mundos ──────────────────────────────────────────────────────────────── */

/**
 * Cria um mundo do mestre. Só `name` é obrigatório (AC-2).
 * @returns {Promise<string>} id do mundo criado.
 */
export async function createWorld(uid, { name, description, genre } = {}) {
  const ownerUid = requireText(uid, "É preciso estar autenticado para criar um mundo.");
  const worldName = requireText(name, "Dê um nome ao mundo antes de criá-lo.");
  const ref = await addDoc(worldsCol(), {
    ownerUid,
    name: worldName,
    nameLower: toNameLower(worldName),
    description: asText(description),
    genre: asText(genre),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Atualiza campos do mundo. `name`, se vier, é validado e re-deriva `nameLower`. */
export async function updateWorld(worldId, patch = {}) {
  const id = requireText(worldId, "Informe qual mundo deve ser atualizado.");
  if (!patch || typeof patch !== "object") {
    throw new Error("Informe os campos do mundo que devem ser atualizados.");
  }
  const data = { ...patch, updatedAt: serverTimestamp() };
  if ("name" in patch) {
    const worldName = requireText(patch.name, "O nome do mundo não pode ficar vazio.");
    data.name = worldName;
    data.nameLower = toNameLower(worldName);
  }
  await updateDoc(worldRef(id), data);
}

/**
 * Marca o mundo como "mexido agora" — usado pela UI depois de editar conteúdo,
 * para que `useWorlds` (ordenado por `updatedAt`) reflita o uso recente.
 */
export async function touchWorld(worldId) {
  const id = requireText(worldId, "Informe qual mundo deve ser atualizado.");
  await updateDoc(worldRef(id), { updatedAt: serverTimestamp() });
}

/**
 * Remove o mundo e TODAS as suas subcoleções (entidades, conexões, pastas).
 * O Firestore não apaga subcoleções em cascata — a varredura é nossa.
 */
export async function deleteWorld(worldId) {
  const id = requireText(worldId, "Informe qual mundo deve ser removido.");
  const ops = [];
  for (const name of [ENTITIES, CONNECTIONS, FOLDERS]) {
    const snap = await getDocs(subCol(id, name)); // eslint-disable-line no-await-in-loop
    snap.docs.forEach((d) => ops.push({ type: "delete", ref: d.ref }));
  }
  ops.push({ type: "delete", ref: worldRef(id) }); // o mundo por último
  await commitOps(ops);
}

/** Lê um mundo avulso (sem listener). `null` se não existir. */
export async function getWorld(worldId) {
  const id = requireText(worldId, "Informe qual mundo deve ser carregado.");
  const snap = await getDoc(worldRef(id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
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
  const ref = await addDoc(subCol(id, ENTITIES), {
    type,
    name,
    nameLower: toNameLower(name),
    description: asText(data.description),
    tags: sanitizeTags(data.tags),
    folderId: asText(data.folderId) || null,
    attributes: sanitizeAttributes(data.attributes),
    imageUrl: asText(data.imageUrl) || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Atualiza um verbete. `name`/`tags`/`attributes` passam pelas mesmas regras da criação. */
export async function updateEntity(worldId, entityId, patch = {}) {
  const id = requireText(worldId, "Selecione um mundo antes de editar a entidade.");
  const docId = requireText(entityId, "Informe qual entidade deve ser atualizada.");
  if (!patch || typeof patch !== "object") {
    throw new Error("Informe os campos da entidade que devem ser atualizados.");
  }
  const data = { ...patch, updatedAt: serverTimestamp() };
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
  await updateDoc(subRef(id, ENTITIES, docId), data);
}

/**
 * Remove o verbete E as conexões que o referenciam (AC-5: nada de arestas órfãs).
 * Entidade e conexões saem no mesmo lote sempre que couberem nos 500.
 */
export async function deleteEntity(worldId, entityId) {
  const id = requireText(worldId, "Selecione um mundo antes de remover a entidade.");
  const docId = requireText(entityId, "Informe qual entidade deve ser removida.");
  const connections = subCol(id, CONNECTIONS);
  const [fromSnap, toSnap] = await Promise.all([
    getDocs(query(connections, where("fromId", "==", docId))),
    getDocs(query(connections, where("toId", "==", docId))),
  ]);
  const seen = new Set();
  const ops = [];
  for (const d of [...fromSnap.docs, ...toSnap.docs]) {
    if (seen.has(d.id)) continue; // autoligação legada apareceria nas duas buscas
    seen.add(d.id);
    ops.push({ type: "delete", ref: d.ref });
  }
  ops.push({ type: "delete", ref: subRef(id, ENTITIES, docId) });
  await commitOps(ops);
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
  const collectionRef = subCol(id, CONNECTIONS);
  const [directSnap, reverseSnap] = await Promise.all([
    getDocs(query(collectionRef, where("fromId", "==", fromId), where("toId", "==", toId))),
    getDocs(query(collectionRef, where("fromId", "==", toId), where("toId", "==", fromId))),
  ]);
  const wanted = relation.toLowerCase();
  const duplicated = [
    ...directSnap.docs.map((d) => asText(d.data().relation)),
    ...reverseSnap.docs.map((d) => asText(d.data().inverse)),
  ].some((label) => label.toLowerCase() === wanted);
  if (duplicated) {
    throw new Error("Essa conexão já existe entre as duas entidades.");
  }
  const ref = await addDoc(collectionRef, {
    fromId,
    toId,
    relation,
    inverse,
    kind: asText(conn.kind) || null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Remove uma conexão (a UI pode chamar a partir de qualquer um dos dois lados). */
export async function deleteConnection(worldId, connectionId) {
  const id = requireText(worldId, "Selecione um mundo antes de remover a conexão.");
  const docId = requireText(connectionId, "Informe qual conexão deve ser removida.");
  await deleteDoc(subRef(id, CONNECTIONS, docId));
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
  const ref = await addDoc(subCol(id, FOLDERS), {
    name,
    scope,
    parentId: asText(data.parentId) || null,
    order: Number.isFinite(data.order) ? data.order : 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Atualiza uma pasta (renomear, mover, reordenar). */
export async function updateFolder(worldId, folderId, patch = {}) {
  const id = requireText(worldId, "Selecione um mundo antes de editar a pasta.");
  const docId = requireText(folderId, "Informe qual pasta deve ser atualizada.");
  if (!patch || typeof patch !== "object") {
    throw new Error("Informe os campos da pasta que devem ser atualizados.");
  }
  const data = { ...patch, updatedAt: serverTimestamp() };
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
  await updateDoc(subRef(id, FOLDERS, docId), data);
}

/**
 * Remove a pasta SEM apagar o que estava dentro: as entidades voltam para a raiz
 * (`folderId: null`) e as subpastas sobem um nível (herdam o `parentId` da pasta
 * removida). A exclusão da pasta vai no fim da fila, depois das realocações.
 */
export async function deleteFolder(worldId, folderId) {
  const id = requireText(worldId, "Selecione um mundo antes de remover a pasta.");
  const docId = requireText(folderId, "Informe qual pasta deve ser removida.");
  const ref = subRef(id, FOLDERS, docId);
  const snap = await getDoc(ref);
  const parentId = snap.exists() ? (snap.data().parentId ?? null) : null;

  const [entitySnap, childSnap] = await Promise.all([
    getDocs(query(subCol(id, ENTITIES), where("folderId", "==", docId))),
    getDocs(query(subCol(id, FOLDERS), where("parentId", "==", docId))),
  ]);

  const ops = [];
  entitySnap.docs.forEach((d) => ops.push({
    type: "update", ref: d.ref, data: { folderId: null, updatedAt: serverTimestamp() },
  }));
  childSnap.docs.forEach((d) => ops.push({
    type: "update", ref: d.ref, data: { parentId, updatedAt: serverTimestamp() },
  }));
  ops.push({ type: "delete", ref });
  await commitOps(ops);
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
  const localToReal = new Map();
  const ops = [];

  for (const entity of seed.entities) {
    const localId = asText(entity?.id ?? entity?.localId);
    if (!localId) throw new Error("Uma entidade do mundo demo está sem id local.");
    if (localToReal.has(localId)) {
      throw new Error(`O mundo demo tem o id local repetido: "${localId}".`);
    }
    const name = requireText(entity.name, "Uma entidade do mundo demo está sem nome.");
    const type = requireText(entity.type, `A entidade "${name}" do mundo demo está sem tipo.`);
    const ref = doc(subCol(worldId, ENTITIES)); // id gerado pelo cliente
    localToReal.set(localId, ref.id);
    ops.push({
      type: "set",
      ref,
      data: {
        type,
        name,
        nameLower: toNameLower(name),
        description: asText(entity.description),
        tags: sanitizeTags(entity.tags),
        folderId: null,
        attributes: sanitizeAttributes(entity.attributes),
        imageUrl: asText(entity.imageUrl) || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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
      type: "set",
      ref: doc(subCol(worldId, CONNECTIONS)),
      data: {
        fromId,
        toId,
        relation,
        inverse: asText(conn.inverse) || relation,
        kind: asText(conn.kind) || null,
        createdAt: serverTimestamp(),
      },
    });
  }

  await commitOps(ops);
  return worldId;
}

/* ── Hooks ───────────────────────────────────────────────────────────────── */

/**
 * Assina uma coleção e devolve `{ data, loading, error }`.
 * `buildQuery` devolve a query ou `null` (nada para assinar → lista vazia).
 */
function useCollection(buildQuery, deps) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = buildQuery();
    if (!q) { setData([]); setLoading(false); setError(null); return undefined; }
    setLoading(true);
    setError(null);
    const unsub = onSnapshot(
      q,
      (snap) => { setData(snapToList(snap)); setLoading(false); },
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
 * ATENÇÃO (infra): filtro de igualdade em `ownerUid` + ordenação por `updatedAt`
 * exige um ÍNDICE COMPOSTO em `worlds` (ownerUid ASC, updatedAt DESC). Sem ele o
 * Firestore recusa a query e o erro chega em `error` com o link de criação do
 * índice no console. Criar antes de liberar a Forja em produção.
 */
export function useWorlds(uid) {
  const { data, loading, error } = useCollection(
    () => (uid
      ? query(worldsCol(), where("ownerUid", "==", uid), orderBy("updatedAt", "desc"))
      : null),
    [uid],
  );
  return { worlds: data, loading, error };
}

/** Verbetes do mundo ativo (AC-3/AC-4). Ordenação fina fica com a UI. */
export function useEntities(worldId) {
  const { data, loading, error } = useCollection(
    () => (worldId ? query(subCol(worldId, ENTITIES), orderBy("updatedAt", "desc")) : null),
    [worldId],
  );
  return { entities: data, loading, error };
}

/** Conexões do mundo ativo (AC-5). */
export function useConnections(worldId) {
  const { data, loading, error } = useCollection(
    () => (worldId ? query(subCol(worldId, CONNECTIONS), orderBy("createdAt", "desc")) : null),
    [worldId],
  );
  return { connections: data, loading, error };
}

/** Pastas do mundo ativo. */
export function useFolders(worldId) {
  const { data, loading, error } = useCollection(
    () => (worldId ? query(subCol(worldId, FOLDERS), orderBy("order", "asc")) : null),
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
    getDoc(worldRef(activeWorldId))
      .then((snap) => {
        if (cancelled || snap.exists()) return;
        writeStoredWorld(uid, null);
        setActive(null);
      })
      .catch((e) => {
        // Offline/permissão: mantém a seleção e avisa — não some com o mundo do mestre.
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
