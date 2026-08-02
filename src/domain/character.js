/* Lógica pura de personagem (camada domain — não importa React nem Firebase).
 * Fases do personagem (spec 0005): a fase "Normal" é virtual e corresponde a form.avatar;
 * form.phases[] guarda apenas as fases adicionais ({ id, label, image, imageAI? }). */

export const NORMAL_PHASE_ID = "normal";

// Aceita a ficha completa ({ form, ... }) ou o form solto.
const formOf = (char) => (char && char.form) || char || {};

/**
 * Identidade da ficha: o ID sob o qual ela é gravada e reencontrada.
 *
 * Fichas antigas não têm `id` — nasceram identificadas pelo `createdAt` (epoch-ms numérico).
 * A regra `id || createdAt` é o que mantém essas fichas acessíveis, e por isso é DOMÍNIO,
 * não detalhe de persistência: o mesmo critério decide o doc no Firestore (`charactersRepo`),
 * o casamento da ficha na mesa (`sharedSheets.characterId`) e a deduplicação local.
 *
 * O fallback para `Date.now()` preserva o comportamento legado — ficha sem `id` nem
 * `createdAt` ganha um ID novo em vez de gravar em `characters/undefined`.
 */
export const characterKey = (char) =>
  String((char && (char.id || char.createdAt)) || Date.now());

/** Duas fichas são a mesma? Espelha `characterKey` para comparação em memória. */
export const isSameCharacter = (a, b) =>
  !!a && !!b && ((a.id && a.id === b.id) || (!a.id && a.createdAt === b.createdAt));

export function getActivePhase(char) {
  const form = formOf(char);
  const phases = Array.isArray(form.phases) ? form.phases : [];
  const id = form.activePhaseId;
  if (!id || id === NORMAL_PHASE_ID) return null;
  const phase = phases.find((p) => p && p.id === id);
  return phase && phase.image ? phase : null;
}

export function getActiveAvatar(char) {
  const phase = getActivePhase(char);
  if (phase) return phase.image;
  return formOf(char).avatar || "";
}

export function isActiveAvatarAI(char) {
  const phase = getActivePhase(char);
  if (phase) return !!phase.imageAI;
  return !!formOf(char).avatarAI;
}
