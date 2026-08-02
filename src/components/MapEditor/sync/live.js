/* Canal efêmero live_{uid} (spec 0010 / ADR 0006 §5): ping, apontador, régua e câmera.
 * Throttle 250ms (trailing) no publisher; receptor descarta payload velho (staleness). */
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, where } from 'firebase/firestore';

export const STALE_MS = 6000;
export const PING_MS = 3000;

export const isFresh = (entry, now = Date.now(), staleMs = STALE_MS) =>
  entry?.at != null && now - entry.at <= staleMs;

/* Throttle trailing puro: garante 1 chamada por janela, sempre com o último argumento.
 * Os timers padrão são embrulhados em seta de propósito: `{ set: setTimeout }` faria
 * `timers.set(...)` chamar o `setTimeout` do navegador com `this` = objeto literal, e o
 * Chrome responde com `TypeError: Illegal invocation` (tela preta ao abrir a mesa tática).
 * A seta chama o global sem receptor, que é o que a WebIDL exige. */
export function makeThrottle(fn, ms, nowFn = Date.now,
  timers = { set: (cb, wait) => setTimeout(cb, wait), clear: (id) => clearTimeout(id) }) {
  let last = -Infinity, timer = null, pending;
  const fire = () => { last = nowFn(); timer = null; fn(pending); };
  return (arg) => {
    pending = arg;
    if (timer) return;
    const wait = Math.max(0, ms - (nowFn() - last));
    if (wait === 0) fire();
    else timer = timers.set(fire, wait);
  };
}

export function makeLivePublisher(db, cid, uid, base = {}, throttleMs = 250) {
  const ref = doc(db, 'campaigns', cid, 'map', 'live_' + uid);
  let state = {};
  const write = () =>
    setDoc(ref, { kind: 'live', uid, at: Date.now(), ...base, ...state })
      .catch((e) => console.error('[mesa] live falhou:', e));
  const throttledWrite = makeThrottle(write, throttleMs);
  return {
    publish(patch) { state = { ...state, ...patch }; throttledWrite(); },
    destroy() { deleteDoc(ref).catch(() => {}); },
  };
}

export function subscribeLive(db, cid, cb) {
  return onSnapshot(query(collection(db, 'campaigns', cid, 'map'), where('kind', '==', 'live')),
    (snap) => cb(snap.docs.map(d => d.data())),
    (e) => console.error('[mesa] snapshot live falhou:', e));
}
