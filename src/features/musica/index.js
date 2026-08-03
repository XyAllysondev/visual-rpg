/**
 * Trilhas Sonoras — a música que toca durante a sessão de RPG, do vínculo com YouTube/Spotify
 * até os MP3 que o mestre importa do próprio computador.
 *
 * Este barril é a porta de entrada da feature: o `App.jsx` importa daqui as três peças de topo
 * (a tela e as duas barras de reprodução) e não conhece nada do miolo — nem o IndexedDB da
 * biblioteca local, nem o PKCE do Spotify, nem as manhas do player do YouTube.
 */
export { default as LocalMusicBar } from "./LocalMusicBar";
export { default as MusicPlayerBar } from "./MusicPlayerBar";
export { default as MusicScreen } from "./MusicScreen";
