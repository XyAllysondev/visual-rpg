/** Regras da Campanha que não dependem de persistência nem de React. */

/**
 * Alfabeto do código de convite: sem `I`, `O`, `0` e `1`.
 *
 * Não é preciosismo — o código é DITADO em voz alta na mesa. "I" vira "1" e "O" vira "0"
 * na transcrição, e o jogador recebe "código inválido" sem entender por quê.
 */
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_LENGTH = 6;

/** Código de convite novo, ex.: `"ABC234"`. */
export const generateInviteCode = () =>
  Array.from(
    { length: INVITE_LENGTH },
    () => INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]
  ).join("");

/** Códigos são comparados sempre em caixa alta — o jogador digita como quiser. */
export const normalizeInviteCode = (code) => String(code || "").trim().toUpperCase();

/**
 * Quantas campanhas ATIVAS do mesmo sistema um usuário pode ter, em cada papel.
 * Vale para mestrar e para jogar — são contagens separadas.
 */
export const MAX_CAMPAIGNS_PER_SYSTEM = 3;

/** Sistema padrão de campanha criada sem sistema escolhido. */
export const DEFAULT_SYSTEM = "Genérico";

/** Máximo de jogadores quando a campanha não define. */
export const DEFAULT_MAX_PLAYERS = 6;

/** Campanha sem `isActive` é ativa — o campo nasceu depois das primeiras campanhas. */
export const isActiveCampaign = (campaign) => campaign?.isActive !== false;

/** Sistema da campanha, com o mesmo fallback usado na criação e na entrada. */
export const systemOf = (campaign) => campaign?.system || DEFAULT_SYSTEM;

/** Campanha lotada? */
export const isFull = (campaign) =>
  (campaign?.members?.length || 0) >= (campaign?.maxPlayers || DEFAULT_MAX_PLAYERS);
