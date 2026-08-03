/**
 * Apoio visual e de leitura da trilha sonora: transforma milissegundos/segundos no tempo que
 * aparece no player e deriva uma cor estável a partir do nome da playlist local (que não tem
 * capa vinda de provedor nenhum — a cor é a capa).
 *
 * Isto vive na feature, e não em `src/ui/`, porque as três funções de cor existem só para dar
 * identidade às playlists locais de música; nenhuma outra tela do Nexus colore por nome.
 */

export function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtSeconds(s) {
  if (!s || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function localHue(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = ((h << 5) - h + str.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}
export function localGradient(name) {
  const hue = localHue(name || "playlist");
  return `linear-gradient(135deg, hsl(${hue},55%,20%), hsl(${(hue + 55) % 360},65%,36%))`;
}
export function localAccent(name) {
  const hue = localHue(name || "playlist");
  return `hsl(${hue},65%,62%)`;
}
