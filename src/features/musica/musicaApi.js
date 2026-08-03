/**
 * Ponte da trilha sonora com os provedores externos (YouTube e Spotify): lista as playlists
 * da conta vinculada e as faixas de cada uma, e monta o desafio PKCE do login do Spotify.
 *
 * Isto é uma feature (e não infraestrutura) porque nada aqui fala com o Firestore — são as
 * APIs públicas do YouTube/Spotify chamadas com o token que o próprio usuário autorizou para
 * tocar música na mesa. Fora da tela de Trilhas Sonoras esse acesso não tem sentido.
 */

export async function ytFetchPlaylists(token) {
  const r = await fetch(
    "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  if (d.error) throw Object.assign(new Error(d.error.message), { status: d.error.code });
  return d.items || [];
}

export async function ytFetchPlaylistItems(playlistId, token) {
  const r = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  if (d.error) throw Object.assign(new Error(d.error.message), { status: d.error.code });
  return d.items || [];
}

export async function spFetchPlaylists(token) {
  const r = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  if (d.error) throw Object.assign(new Error(d.error.message), { status: d.error.status });
  return d.items || [];
}

export async function spFetchTracks(playlistId, token) {
  const r = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(id,name,duration_ms,artists,album(images)))`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await r.json();
  if (d.error) throw Object.assign(new Error(d.error.message), { status: d.error.status });
  return (d.items || []).filter(i => i.track);
}

export function spRandStr(n) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map(b => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62])
    .join("");
}

export async function spCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
