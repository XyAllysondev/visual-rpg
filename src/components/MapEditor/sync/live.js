/* Canal efêmero live_{uid} (spec 0010 / ADR 0006 §5): ping, apontador, régua e câmera.
 * Throttle 250ms (trailing) no publisher; receptor descarta payload velho (staleness).
 *
 * O acesso ao Firestore vive em `infrastructure/firestore/mapSyncRepo` desde a onda 1.5
 * (spec 0030 / ADR-0010). Aqui ficam o throttle e a regra de frescor — as duas coisas que
 * dependem do relógio do cliente, e por isso não são infraestrutura. */
import { setLive, clearLive, watchLive } from '../../../infrastructure/firestore/mapSyncRepo';

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

/* `db` continua na assinatura, ignorado: `MapEditor/index.jsx` ainda chama
   `makeLivePublisher(db, …)` e ele pertence a outra onda. */
export function makeLivePublisher(db, cid, uid, base = {}, throttleMs = 250) {
  let state = {};
  /* `at` é o relógio do CLIENTE de propósito: quem recebe compara com o próprio relógio
     em `isFresh`, e um `serverTimestamp` só chegaria depois do round-trip. */
  const write = () => setLive(cid, uid, { kind: 'live', uid, at: Date.now(), ...base, ...state });
  const throttledWrite = makeThrottle(write, throttleMs);
  return {
    publish(patch) { state = { ...state, ...patch }; throttledWrite(); },
    destroy() { clearLive(cid, uid); },
  };
}

export function subscribeLive(db, cid, cb) {
  return watchLive(cid, cb);
}
