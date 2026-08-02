/**
 * Agregado Identidade — `users/{uid}`.
 *
 * Guarda perfil, plano e os links de música da campanha. Substitui `fsEnsureUserDoc`
 * (useAuth.js) e o trio `fsSetMusicLink`/`fsDeleteMusicLink`/`fsGetMusicLinks` (App.jsx:52-60).
 *
 * Todas as operações são `silent` porque era assim que o legado se comportava — a spec 0029
 * preserva comportamento (AC-7). Consertar essas falhas mudas é escopo da onda 3.
 */
import { getDoc, setDoc, updateDoc, onSnapshot, deleteField } from "firebase/firestore";
import { docAt, silent, NOOP_UNSUBSCRIBE } from "./client";
import { userDoc } from "./paths";

/**
 * Cria o doc do usuário SÓ se não existir, e sincroniza o e-mail se ele mudou.
 *
 * Nunca sobrescreve `plan`/`subscribedSystems` — são exclusivos do backend (spec 0004
 * AC-1/AC-2). Antes dessa regra, todo login resetava o plano do usuário pagante.
 *
 * @policy silent — falha só loga; o login segue.
 */
export async function ensureDoc(uid, email) {
  if (!uid) return;
  return silent("usersRepo.ensureDoc", undefined, async () => {
    const ref = docAt(userDoc(uid));
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { email, plan: "free" });
    } else if (email && snap.data().email !== email) {
      await setDoc(ref, { email }, { merge: true });
    }
  });
}

/**
 * @policy silent — devolve `{}` se falhar (indistinguível de "nenhum link"; era assim antes).
 * @returns {Promise<Record<string, object>>} mapa serviço → dados do link
 */
export async function getMusicLinks(uid) {
  if (!uid) return {};
  return silent("usersRepo.getMusicLinks", {}, async () => {
    const snap = await getDoc(docAt(userDoc(uid)));
    return snap.exists() ? snap.data().musicLinks || {} : {};
  });
}

/** @policy silent */
export async function setMusicLink(uid, service, data) {
  if (!uid) return;
  return silent("usersRepo.setMusicLink", undefined, () =>
    setDoc(docAt(userDoc(uid)), { musicLinks: { [service]: data } }, { merge: true })
  );
}

/** @policy silent */
export async function deleteMusicLink(uid, service) {
  if (!uid) return;
  // `deleteField()` é FieldValue do SDK e não pode vazar para a borda (AC-3) — some aqui.
  return silent("usersRepo.deleteMusicLink", undefined, () =>
    updateDoc(docAt(userDoc(uid)), { [`musicLinks.${service}`]: deleteField() })
  );
}

/**
 * Assina os sistemas pagos do usuário. É o canal que ativa o plano automaticamente
 * assim que o webhook do PIX grava o doc — por isso é `onSnapshot`, não leitura única.
 *
 * @param {(systems: string[]) => void} onChange recebe SEMPRE um array (vazio se o doc sumiu)
 * @returns {() => void} unsubscribe
 * @policy silent — erro de assinatura não derruba a tela, como no legado (App.jsx:11875).
 */
export function watchSubscribedSystems(uid, onChange) {
  if (!uid) return NOOP_UNSUBSCRIBE;
  return onSnapshot(
    docAt(userDoc(uid)),
    (snap) => onChange(snap.exists() ? snap.data().subscribedSystems || [] : []),
    (e) => console.error("[usersRepo.watchSubscribedSystems] falhou:", e)
  );
}
