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

/**
 * Assinatura derivada do nome, para o fecho da criação de personagem (spec 0038).
 * Primeiro nome inteiro, sobrenomes abreviados: "Kael de Souza Nightingale" →
 * "Kael S. N.".
 *
 * Devolve `""` quando não há nome — e o chamador usa isso como "não há o que
 * assinar". Nome vazio não pode virar assinatura em branco plausível: o gesto de
 * assinar é o que cria o personagem, e assinar o nada criaria um agente sem nome.
 *
 * Partículas de ligação (de, da, do, dos, das, e) não viram inicial — "de S." em
 * vez de "S." leria como erro de quem assinou, não como abreviação.
 */
const PARTICULAS = new Set(["de", "da", "do", "dos", "das", "e", "del", "von", "van"]);

/**
 * Número de registro do dossiê, derivado do nome (spec 0039).
 *
 * ⚠ DETERMINÍSTICO POR CONTRATO. A tentação é `Math.random()` — e um documento
 * cujo número muda a cada render não é documento, é enfeite. O mesmo nome
 * sempre emite o mesmo número; nome vazio não emite número nenhum (devolve "",
 * e o cabeçalho desenha um traçado no lugar em vez de inventar dígitos).
 *
 * Hash FNV-1a de 32 bits — barato, sem dependência, e espalha o suficiente para
 * que dois nomes parecidos não caiam no mesmo número.
 */
export function numeroDeDossie(nome) {
  const limpo = String(nome ?? "").trim();
  if (!limpo) return "";
  let h = 0x811c9dc5;
  for (let i = 0; i < limpo.length; i++) {
    h ^= limpo.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const serie = String(h % 900000 + 100000);            // 6 dígitos, nunca começa em 0
  const volume = String((h >>> 16) % 900 + 100);        // 3 dígitos
  return `${serie}/${volume}`;
}

export function assinaturaDe(nome) {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  const [primeiro, ...resto] = partes;
  const iniciais = resto
    .filter((p) => !PARTICULAS.has(p.toLowerCase()))
    .map((p) => `${p[0].toUpperCase()}.`);
  return [primeiro, ...iniciais].join(" ");
}
