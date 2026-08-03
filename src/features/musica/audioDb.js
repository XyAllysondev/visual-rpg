/**
 * Biblioteca de áudio local da trilha sonora — o acervo de MP3 que o mestre importa
 * do próprio computador para tocar na mesa sem depender de YouTube nem de Spotify.
 *
 * Isto é uma feature (e não infraestrutura compartilhada) porque o IndexedDB `nexus_audio`
 * só existe por causa da tela de Trilhas Sonoras: o arquivo de áudio nunca sobe para o
 * Firestore, ele fica no navegador de quem importou. Nenhuma outra parte do Nexus lê daqui.
 */

/* ── IndexedDB helpers for local audio storage ── */
export function openAudioDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open("nexus_audio", 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}
export async function audioDBSave(id, name, buf) {
  const db = await openAudioDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put({ id, name, buf });
    tx.oncomplete = res;
    tx.onerror = e => rej(e.target.error);
  });
}
export async function audioDBGet(id) {
  const db = await openAudioDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("files", "readonly");
    const req = tx.objectStore("files").get(id);
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}
export async function audioDBDelete(id) {
  const db = await openAudioDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").delete(id);
    tx.oncomplete = res;
    tx.onerror = e => rej(e.target.error);
  });
}
export async function audioDBGetMeta() {
  const db = await openAudioDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("files", "readonly");
    const req = tx.objectStore("files").getAll();
    req.onsuccess = e => res((e.target.result || []).map(f => ({ id: f.id, name: f.name })));
    req.onerror = e => rej(e.target.error);
  });
}
