/**
 * A tela de Trilhas Sonoras — onde o mestre vincula YouTube/Spotify ou importa os próprios
 * arquivos de áudio, navega pelas playlists, abre a lista de faixas e manda tocar. Ela fica
 * sempre montada no App para que a música não pare quando se troca de tela.
 *
 * É uma feature porque não é só listagem: guarda o vínculo da conta de música no perfil do
 * usuário (via `usersRepo`), conduz o OAuth do Spotify por PKCE no próprio navegador, mantém
 * as playlists locais no `localStorage` com os arquivos no IndexedDB, e reordena faixas por
 * arraste. Tudo isso é regra da mesa, não casca reutilizável.
 */
import { useState, useEffect, useRef } from "react";
import { auth } from "../../firebase";
import { signInWithPopup, GoogleAuthProvider, reauthenticateWithPopup } from "firebase/auth";
import * as usersRepo from "../../infrastructure/firestore/usersRepo";
import {
  ytFetchPlaylists, ytFetchPlaylistItems,
  spFetchPlaylists, spFetchTracks,
  spRandStr, spCodeChallenge,
} from "./musicaApi";
import { audioDBSave, audioDBDelete, audioDBGetMeta } from "./audioDb";
import { fmtDuration, localGradient, localAccent } from "./musicaUtils";
import CenasSonoras from "./CenasSonoras";
import { lerVinculos, gravarVinculos, vincular, desvincular } from "./cenas";
import MesaDeEfeitos from "./MesaDeEfeitos";
import { lerEfeitos, gravarEfeitos } from "./efeitos";

export default function MusicScreen({ nowPlaying, onNowPlaying, musicTokens, onMusicTokens, ytPlayerRef }) {
  const ytToken = musicTokens.yt;
  const spToken = musicTokens.sp;
  const setYtToken = t => onMusicTokens(prev => ({ ...prev, yt: t }));
  const setSpToken = t => onMusicTokens(prev => ({ ...prev, sp: t }));

  const [spClientId, setSpClientId] = useState(() => localStorage.getItem("nx_sp_cid") || "");
  const [spClientIdDraft, setSpClientIdDraft] = useState(() => localStorage.getItem("nx_sp_cid") || "");
  const [ytPlaylists, setYtPlaylists] = useState([]);
  const [spPlaylists, setSpPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tab, setTab] = useState(() => (localStorage.getItem("nx_yt_token") || localStorage.getItem("nx_sp_token")) ? "youtube" : "local");
  const [loading, setLoading] = useState("");
  const [err, setErr] = useState("");
  const [spSetupOpen, setSpSetupOpen] = useState(false);
  const dragRef = useRef(null);
  const dragOverRef = useRef(null);

  /* ── Local MP3 state ── */
  const [localPlaylists, setLocalPlaylists] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nx_local_playlists") || "[]"); } catch { return []; }
  });
  const [importedFiles, setImportedFiles] = useState([]);
  const [createPlOpen, setCreatePlOpen] = useState(false);
  const [newPlName, setNewPlName] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());
  const [localDragging, setLocalDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingPl, setEditingPl] = useState(null);
  const [localSearch, setLocalSearch] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const fileInputRef = useRef(null);

  /* ── Persist local playlists ── */
  useEffect(() => {
    localStorage.setItem("nx_local_playlists", JSON.stringify(localPlaylists));
  }, [localPlaylists]);

  /* ── Cenas da mesa: qual playlist toca em cada momento da sessão ── */
  const [vinculosCena, setVinculosCena] = useState(() => lerVinculos());
  useEffect(() => { gravarVinculos(vinculosCena); }, [vinculosCena]);

  /* ── Mesa de efeitos: disparos de um toque, por cima da trilha ── */
  const [efeitos, setEfeitos] = useState(() => lerEfeitos());
  useEffect(() => { gravarEfeitos(efeitos); }, [efeitos]);

  /* ── Load imported file metadata from IndexedDB on mount ── */
  useEffect(() => {
    audioDBGetMeta().then(setImportedFiles).catch((e) => console.error("[música] ler arquivos importados (IndexedDB) falhou:", e));
  }, []);

  /* ── Spotify OAuth callback handler ── */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get("code");
    const state = p.get("state");
    const savedState = localStorage.getItem("nx_sp_state");
    if (code && state && state === savedState) {
      window.history.replaceState({}, "", window.location.pathname);
      const cid = localStorage.getItem("nx_sp_cid");
      const ver = localStorage.getItem("nx_sp_ver");
      if (cid && ver) handleSpCallback(code, cid, ver);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load playlists on mount if tokens already exist in localStorage ── */
  useEffect(() => {
    if (ytToken) {
      ytFetchPlaylists(ytToken)
        .then(items => { setYtPlaylists(items); setTab("youtube"); })
        .catch(() => { localStorage.removeItem("nx_yt_token"); localStorage.removeItem("nx_yt_exp"); setYtToken(null); });
    }
    if (spToken) {
      spFetchPlaylists(spToken)
        .then(items => { setSpPlaylists(items); if (!ytToken) setTab("spotify"); })
        .catch(() => { localStorage.removeItem("nx_sp_token"); localStorage.removeItem("nx_sp_exp"); setSpToken(null); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSpCallback = async (code, cid, ver) => {
    setLoading("spotify");
    try {
      const redirectUri = window.location.origin + window.location.pathname.replace(/\/+$/, "");
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: cid,
        code_verifier: ver,
      });
      const r = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error_description || d.error);
      const exp = Date.now() + d.expires_in * 1000;
      localStorage.setItem("nx_sp_token", d.access_token);
      localStorage.setItem("nx_sp_exp", String(exp));
      setSpToken(d.access_token);
      const items = await spFetchPlaylists(d.access_token);
      setSpPlaylists(items);
      setTab("spotify");
      const uid = auth.currentUser?.uid;
      if (uid) await usersRepo.setMusicLink(uid, "spotify", { clientId: cid, connectedAt: Date.now() });
    } catch (e) {
      setErr("Spotify: " + e.message);
    } finally {
      setLoading("");
      localStorage.removeItem("nx_sp_ver");
      localStorage.removeItem("nx_sp_state");
    }
  };

  const connectYouTube = async () => {
    setErr(""); setLoading("youtube");
    try {
      const prov = new GoogleAuthProvider();
      prov.addScope("https://www.googleapis.com/auth/youtube.readonly");
      prov.setCustomParameters({ prompt: "consent" });
      const user = auth.currentUser;
      const isGoogleUser = user?.providerData?.some(p => p.providerId === "google.com");
      const result = isGoogleUser
        ? await reauthenticateWithPopup(user, prov)
        : await signInWithPopup(auth, prov);
      const cred = GoogleAuthProvider.credentialFromResult(result);
      if (!cred?.accessToken) throw new Error("Token não obtido.");
      const token = cred.accessToken;
      const exp = Date.now() + 3500 * 1000; // ~1h
      const ytEmail = result.user.email || "";
      const ytName = result.user.displayName || "";
      localStorage.setItem("nx_yt_token", token);
      localStorage.setItem("nx_yt_exp", String(exp));
      localStorage.setItem("nx_yt_email", ytEmail);
      setYtToken(token);
      const items = await ytFetchPlaylists(token);
      setYtPlaylists(items);
      setTab("youtube");
      if (user?.uid) await usersRepo.setMusicLink(user.uid, "youtube", { email: ytEmail, name: ytName, connectedAt: Date.now() });
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        setErr("YouTube: " + (e.message || "Tente novamente."));
      }
    } finally {
      setLoading("");
    }
  };

  const connectSpotify = async (overrideCid) => {
    const cid = overrideCid || spClientId;
    if (!cid) { setSpSetupOpen(true); return; }
    const ver = spRandStr(64);
    const state = spRandStr(16);
    localStorage.setItem("nx_sp_ver", ver);
    localStorage.setItem("nx_sp_state", state);
    localStorage.setItem("nx_sp_cid", cid);
    const challenge = await spCodeChallenge(ver);
    const redirectUri = window.location.origin + window.location.pathname.replace(/\/+$/, "");
    window.location.href = "https://accounts.spotify.com/authorize?" + new URLSearchParams({
      client_id: cid,
      response_type: "code",
      redirect_uri: redirectUri,
      code_challenge_method: "S256",
      code_challenge: challenge,
      state,
      scope: "playlist-read-private playlist-read-collaborative user-read-private",
    });
  };

  const disconnectYT = () => {
    localStorage.removeItem("nx_yt_token"); localStorage.removeItem("nx_yt_exp"); localStorage.removeItem("nx_yt_email");
    setYtToken(null); setYtPlaylists([]);
    if (selectedPlaylist?.svc === "youtube") setSelectedPlaylist(null);
    if (nowPlaying?.svc === "youtube") onNowPlaying(null);
    const uid = auth.currentUser?.uid;
    if (uid) usersRepo.deleteMusicLink(uid, "youtube");
  };
  const disconnectSP = () => {
    localStorage.removeItem("nx_sp_token"); localStorage.removeItem("nx_sp_exp"); localStorage.removeItem("nx_sp_email");
    setSpToken(null); setSpPlaylists([]);
    if (selectedPlaylist?.svc === "spotify") setSelectedPlaylist(null);
    if (nowPlaying?.svc === "spotify") onNowPlaying(null);
    const uid = auth.currentUser?.uid;
    if (uid) usersRepo.deleteMusicLink(uid, "spotify");
  };

  /* ── Local MP3 functions ── */
  const importMp3Files = async (files) => {
    setImporting(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(file.name)) continue;
        const id = `lf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const buf = await file.arrayBuffer();
        await audioDBSave(id, file.name, buf);
      }
      const meta = await audioDBGetMeta();
      setImportedFiles(meta);
    } catch (e) { console.error("[música] importar arquivos falhou:", e); } finally {
      setImporting(false);
    }
  };

  const createLocalPlaylist = () => {
    if (!newPlName.trim() || selectedFileIds.size === 0) return;
    const id = editingPl ? editingPl.id : `lpl_${Date.now()}`;
    const trackIds = [...selectedFileIds];
    if (editingPl) {
      setLocalPlaylists(prev => prev.map(pl => pl.id === id ? { ...pl, name: newPlName.trim(), trackIds } : pl));
    } else {
      setLocalPlaylists(prev => [...prev, { id, name: newPlName.trim(), trackIds }]);
    }
    setCreatePlOpen(false); setNewPlName(""); setSelectedFileIds(new Set()); setEditingPl(null);
  };

  const deleteLocalPlaylist = (plId) => {
    setLocalPlaylists(prev => prev.filter(pl => pl.id !== plId));
    if (nowPlaying?.playlistId === plId) onNowPlaying(null);
    if (selectedPlaylist?.id === plId) { setSelectedPlaylist(null); setTracks([]); }
  };

  const deleteImportedFile = async (fileId) => {
    await audioDBDelete(fileId);
    setImportedFiles(prev => prev.filter(f => f.id !== fileId));
    setLocalPlaylists(prev =>
      prev.map(pl => ({ ...pl, trackIds: pl.trackIds.filter(id => id !== fileId) }))
          .filter(pl => pl.trackIds.length > 0)
    );
  };

  const openLocalPlaylist = (pl) => {
    const tracks = pl.trackIds.map(id => importedFiles.find(f => f.id === id)).filter(Boolean);
    setSelectedPlaylist({ id: pl.id, name: pl.name, svc: "local", count: tracks.length });
    setTracks(tracks);
  };

  const playLocalPlaylist = (pl, startIdx = 0) => {
    const tracks = pl.trackIds.map(id => importedFiles.find(f => f.id === id)).filter(Boolean);
    if (tracks.length === 0) return;
    onNowPlaying({ svc: "local", playlistId: pl.id, playlistName: pl.name, startIdx, tracks, repeat: nowPlaying?.repeat || "none" });
  };

  const playLocalTrack = (idx) => {
    if (!selectedPlaylist || selectedPlaylist.svc !== "local") return;
    const pl = localPlaylists.find(p => p.id === selectedPlaylist.id);
    if (!pl) return;
    const allTracks = pl.trackIds.map(id => importedFiles.find(f => f.id === id)).filter(Boolean);
    onNowPlaying({ svc: "local", playlistId: pl.id, playlistName: pl.name, startIdx: idx, tracks: allTracks, repeat: nowPlaying?.repeat || "none" });
  };

  /* Toca a playlist vinculada a uma cena. É o caminho de UM clique com a mesa
     rodando, então ele não navega nem abre nada — só troca o que está tocando.
     Local resolve na hora; YouTube/Spotify precisam buscar as faixas antes, e
     é por isso que o erro aqui é silencioso na tela e explícito no aviso: no
     meio da narração, um alerta vermelho atrapalha mais que a música errada. */
  const tocarCena = async (vinculo) => {
    if (!vinculo) return;
    if (vinculo.svc === "local") {
      const pl = localPlaylists.find(p => String(p.id) === vinculo.playlistId);
      if (pl) playLocalPlaylist(pl);
      return;
    }
    const lista = vinculo.svc === "youtube" ? ytPlaylists : spPlaylists;
    const pl = lista.find(p => String(p.id) === vinculo.playlistId);
    if (!pl) { setErr("A playlist desta cena não está mais na conta vinculada."); return; }
    const token = vinculo.svc === "youtube" ? ytToken : spToken;
    if (!token) { setErr(`Reconecte o ${vinculo.svc === "youtube" ? "YouTube" : "Spotify"} para tocar esta cena.`); return; }
    try {
      const brutas = vinculo.svc === "youtube"
        ? await ytFetchPlaylistItems(pl.id, token)
        : await spFetchTracks(pl.id, token);
      const faixas = vinculo.svc === "youtube"
        ? brutas.map((item, i) => ({ ...item, _ytIdx: i }))
        : brutas;
      if (faixas.length === 0) { setErr("Esta playlist está vazia."); return; }
      onNowPlaying({
        svc: vinculo.svc, playlistId: pl.id,
        playlistName: vinculo.svc === "youtube" ? pl.snippet?.title : pl.name,
        playlistThumb: vinculo.svc === "youtube"
          ? (pl.snippet?.thumbnails?.medium?.url || pl.snippet?.thumbnails?.default?.url)
          : pl.images?.[0]?.url,
        trackCount: faixas.length, startIdx: 0, tracks: faixas,
        repeat: nowPlaying?.repeat || "none",
      });
    } catch (e) {
      setErr("Não deu para tocar a trilha desta cena: " + e.message);
    }
  };

  const openEditPlaylist = (pl) => {
    setEditingPl(pl);
    setNewPlName(pl.name);
    setSelectedFileIds(new Set(pl.trackIds));
    setCreatePlOpen(true);
  };

  const openPlaylist = async (pl, svc) => {
    const name = svc === "youtube" ? pl.snippet?.title : pl.name;
    const thumb = svc === "youtube"
      ? (pl.snippet?.thumbnails?.medium?.url || pl.snippet?.thumbnails?.default?.url)
      : pl.images?.[0]?.url;
    const count = svc === "youtube" ? pl.contentDetails?.itemCount : pl.tracks?.total;
    setSelectedPlaylist({ id: pl.id, name, thumb, count, svc });
    setTracks([]);
    setTracksLoading(true);
    try {
      const rawItems = svc === "youtube"
        ? await ytFetchPlaylistItems(pl.id, ytToken)
        : await spFetchTracks(pl.id, spToken);
      const items = svc === "youtube"
        ? rawItems.map((item, i) => ({ ...item, _ytIdx: i }))
        : rawItems;
      setTracks(items);
    } catch (e) {
      setErr("Erro ao carregar faixas: " + e.message);
    } finally {
      setTracksLoading(false);
    }
  };

  const reorderTracks = (from, to) => {
    setTracks(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  const playTrack = (localIdx) => {
    const pl = selectedPlaylist;
    const isYt = pl.svc === "youtube";
    const ytIdx = isYt ? (tracks[localIdx]?._ytIdx ?? localIdx) : localIdx;
    const samePlaylist = nowPlaying?.playlistId === pl.id && nowPlaying?.svc === pl.svc;
    if (samePlaylist && isYt && ytPlayerRef?.current) {
      ytPlayerRef.current.playVideoAt(ytIdx);
      onNowPlaying(prev => prev ? { ...prev, startIdx: ytIdx } : prev);
      return;
    }
    const ytOrderedTracks = isYt
      ? [...tracks].sort((a, b) => (a._ytIdx ?? 0) - (b._ytIdx ?? 0))
      : tracks;
    onNowPlaying({
      svc: pl.svc, playlistId: pl.id, playlistName: pl.name,
      playlistThumb: pl.thumb, trackCount: pl.count,
      startIdx: ytIdx, tracks: ytOrderedTracks,
      repeat: nowPlaying?.repeat || "none",
    });
  };

  const isConnected = ytToken || spToken;
  const currentList = tab === "youtube" ? ytPlaylists : tab === "spotify" ? spPlaylists : localPlaylists;
  const isTabConnected = tab === "youtube" ? !!ytToken : tab === "spotify" ? !!spToken : true;
  const gold = "var(--gold)";
  const card = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 };
  const isPlayingThis = (pl, svc) => nowPlaying?.playlistId === pl.id && nowPlaying?.svc === svc;
  const ytEmail = localStorage.getItem("nx_yt_email") || "";
  const ytTokenExpired = !ytToken && !!ytEmail;

  return (
    <div className="fade" style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        {selectedPlaylist && (
          <button onClick={() => { setSelectedPlaylist(null); setTracks([]); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted2)", fontSize: 20, padding: "2px 6px", lineHeight: 1 }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted2)"}
          >←</button>
        )}
        <div style={{ fontSize: 24, color: gold }}>♪</div>
        <div>
          <div style={{ fontFamily: "Cinzel Decorative,serif", fontSize: 17, color: gold, letterSpacing: 2 }}>
            {selectedPlaylist ? selectedPlaylist.name : "Trilhas Sonoras"}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
            {selectedPlaylist
              ? `${tracks.length || selectedPlaylist.count || 0} faixas · ${selectedPlaylist.svc === "youtube" ? "YouTube" : selectedPlaylist.svc === "spotify" ? "Spotify" : "Local"}`
              : "Vincule YouTube ou Spotify, ou importe seus próprios arquivos MP3"}
          </div>
        </div>
        {(isConnected || ytTokenExpired) && !selectedPlaylist && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* YouTube badge */}
            {(ytToken || ytTokenExpired) && (() => {
              const expired = ytTokenExpired;
              const color = expired ? "var(--muted)" : "#ff4444";
              return (
                <div key="youtube" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, border: `1px solid ${expired ? "var(--border2)" : "#ff4444"}`, background: expired ? "transparent" : "rgba(255,68,68,0.08)", transition: "all 0.2s" }}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill={color}><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {ytEmail && <span style={{ fontFamily: "Cinzel,serif", fontSize: 8, color, letterSpacing: 0.5 }}>{ytEmail}</span>}
                    {expired && <span style={{ fontSize: 9, color: "#e07070", fontFamily: "Cinzel,serif", letterSpacing: 0.5 }}>Sessão expirada</span>}
                  </div>
                  {expired ? (
                    <button onClick={connectYouTube} style={{ background: "rgba(255,68,68,0.12)", border: "1px solid #ff4444", borderRadius: 4, cursor: "pointer", color: "#ff4444", fontSize: 8, fontFamily: "Cinzel,serif", padding: "2px 7px", letterSpacing: 1 }}>
                      Reconectar
                    </button>
                  ) : (
                    <button onClick={disconnectYT} title="Desconectar YouTube" style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,68,68,0.5)", fontSize: 14, padding: "0 2px", lineHeight: 1, display: "flex", alignItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ff4444"}
                      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,68,68,0.5)"}>✕</button>
                  )}
                </div>
              );
            })()}
            {/* Spotify badge */}
            {spToken && (
              <div key="spotify" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, border: "1px solid #1db954", background: "rgba(29,185,84,0.08)", transition: "all 0.2s" }}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="#1db954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                <span style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "#1db954", letterSpacing: 0.5 }}>Spotify</span>
                <button onClick={disconnectSP} title="Desconectar Spotify" style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(29,185,84,0.5)", fontSize: 14, padding: "0 2px", lineHeight: 1, display: "flex", alignItems: "center" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#1db954"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(29,185,84,0.5)"}>✕</button>
              </div>
            )}
          </div>
        )}
        {selectedPlaylist && (
          <button className="btn-gold" style={{ marginLeft: "auto", padding: "8px 18px", fontSize: 10 }}
            onClick={() => selectedPlaylist.svc === "local" ? playLocalTrack(0) : playTrack(0)}>
            ▶ Tocar tudo
          </button>
        )}
      </div>

      {err && (
        <div style={{ ...card, padding: "10px 14px", marginBottom: 16, borderColor: "rgba(139,32,32,0.5)", background: "rgba(139,32,32,0.1)", color: "#e07070", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{err}</span><span style={{ cursor: "pointer", marginLeft: 12 }} onClick={() => setErr("")}>✕</span>
        </div>
      )}

      {/* ── Connect view ── */}
      {!isConnected && !ytTokenExpired && tab !== "local" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600, margin: "48px auto" }}>
          {[
            { svc: "youtube", label: "YouTube", color: "#ff4444", bg: "rgba(255,68,68,0.06)",
              icon: <svg viewBox="0 0 24 24" width="38" height="38" fill="#ff4444"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
              desc: "Acesse suas playlists do YouTube durante a sessão de RPG", onClick: connectYouTube, isLoading: loading === "youtube" },
            { svc: "spotify", label: "Spotify", color: "#1db954", bg: "rgba(29,185,84,0.06)",
              icon: <svg viewBox="0 0 24 24" width="38" height="38" fill="#1db954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>,
              desc: "Toque suas playlists do Spotify enquanto joga", onClick: () => connectSpotify(), isLoading: loading === "spotify" },
          ].map(({ svc, label, color, bg, icon, desc, onClick, isLoading }) => (
            <div key={svc} onClick={isLoading ? undefined : onClick}
              style={{ ...card, padding: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, cursor: isLoading ? "default" : "pointer", transition: "all 0.25s" }}
              onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = bg; e.currentTarget.style.transform = "translateY(-2px)"; }}}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--card)"; e.currentTarget.style.transform = "none"; }}>
              {icon}
              <div style={{ fontFamily: "Cinzel,serif", fontSize: 13, letterSpacing: 2, color }}>{label}</div>
              <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
              <button className="btn-ghost" disabled={isLoading} style={{ marginTop: 4, borderColor: color, color, opacity: isLoading ? 0.6 : 1 }}>
                {isLoading ? <span style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 12, height: 12, border: `1.5px solid ${color}`, borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />Conectando...</span> : `Conectar ${label}`}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Cenas da mesa ──
          Fica ACIMA da grade e some quando o mestre entra numa playlist: o
          objetivo é ser a primeira coisa à mão durante a sessão, não competir
          com a navegação do acervo. */}
      {!selectedPlaylist && (
        <CenasSonoras
          vinculos={vinculosCena}
          playlistsPorServico={{ local: localPlaylists, youtube: ytPlaylists, spotify: spPlaylists }}
          nowPlaying={nowPlaying}
          onTocar={tocarCena}
          onVincular={(cenaId, pl) => setVinculosCena(v => vincular(v, cenaId, pl))}
          onDesvincular={(cenaId) => setVinculosCena(v => desvincular(v, cenaId))}
        />
      )}

      {/* ── Mesa de efeitos ──
          Logo abaixo das Cenas e some junto com elas: as duas são o painel de
          quem está narrando. Cena troca a trilha; efeito dispara por cima. */}
      {!selectedPlaylist && (
        <MesaDeEfeitos efeitos={efeitos} onMudar={setEfeitos} />
      )}

      {/* ── Playlist grid ── */}
      {(isConnected || ytTokenExpired || tab === "local") && !selectedPlaylist && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { id: "youtube", label: "▶ YouTube", connected: !!ytToken, color: "#ff4444", bg: "rgba(255,68,68,0.08)" },
              { id: "spotify", label: "● Spotify", connected: !!spToken, color: "#1db954", bg: "rgba(29,185,84,0.08)" },
              { id: "local", label: "♪ Local", connected: true, color: "var(--gold)", bg: "rgba(201,168,76,0.08)" },
            ].map(t => (
              <div key={t.id}
                onClick={() => {
                  if (t.id === "local") { setTab("local"); setSelectedPlaylist(null); setTracks([]); }
                  else if (t.connected) { setTab(t.id); setSelectedPlaylist(null); setTracks([]); }
                  else t.id === "youtube" ? connectYouTube() : connectSpotify();
                }}
                style={{ padding: "6px 18px", borderRadius: 20, cursor: "pointer", fontFamily: "Cinzel,serif", fontSize: 11, letterSpacing: 1, border: `1px solid ${tab === t.id ? t.color : "var(--border)"}`, background: tab === t.id ? t.bg : "transparent", color: t.connected ? (tab === t.id ? t.color : "var(--muted2)") : "var(--muted)", transition: "all 0.2s" }}>
                {t.label}{!t.connected && <span style={{ fontSize: 9, marginLeft: 4 }}>(conectar)</span>}
              </div>
            ))}
            {loading && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12, marginLeft: 8 }}><div style={{ width: 12, height: 12, border: "1.5px solid var(--border)", borderTopColor: gold, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Carregando...</div>}
            {importing && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12, marginLeft: 8 }}><div style={{ width: 12, height: 12, border: "1.5px solid var(--border)", borderTopColor: gold, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Importando...</div>}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              {tab === "local" && (
                <>
                  <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus" multiple style={{ display: "none" }}
                    onChange={e => { if (e.target.files?.length) importMp3Files(e.target.files); e.target.value = ""; }} />
                  <button className="btn-ghost" style={{ fontSize: 10, padding: "5px 14px", display: "flex", alignItems: "center", gap: 6 }}
                    onClick={() => fileInputRef.current?.click()}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Importar MP3
                  </button>
                  <button className="btn-gold" style={{ fontSize: 10, padding: "5px 14px" }}
                    onClick={() => { setEditingPl(null); setNewPlName(""); setSelectedFileIds(new Set()); setCreatePlOpen(true); }}>
                    + Criar Playlist
                  </button>
                </>
              )}
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{currentList.length > 0 && `${currentList.length} playlist${currentList.length !== 1 ? "s" : ""}`}</div>
            </div>
          </div>
          {tab === "local" ? (
            /* ── Local tab content ── */
            <div>
              {/* Drag & drop import zone */}
              <div
                onDragOver={e => { e.preventDefault(); setLocalDragging(true); }}
                onDragLeave={() => setLocalDragging(false)}
                onDrop={e => { e.preventDefault(); setLocalDragging(false); if (e.dataTransfer.files?.length) importMp3Files(e.dataTransfer.files); }}
                style={{ border: `2px dashed ${localDragging ? "var(--gold)" : "var(--border2)"}`, borderRadius: 14, padding: "32px 24px", textAlign: "center", marginBottom: 20, background: localDragging ? "rgba(201,168,76,0.08)" : "var(--card)", transition: "all 0.2s", cursor: "pointer", position: "relative", overflow: "hidden" }}
                onClick={() => fileInputRef.current?.click()}>
                {localDragging && <div style={{ position: "absolute", inset: 0, background: "rgba(201,168,76,0.04)", animation: "pulse 0.6s ease-in-out infinite alternate" }} />}
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎵</div>
                <div style={{ fontFamily: "Cinzel,serif", fontSize: 12, color: localDragging ? "var(--gold)" : "var(--gold2)", letterSpacing: 1.5, marginBottom: 6, transition: "color 0.2s" }}>
                  {localDragging ? "Solte os arquivos aqui!" : "Arraste arquivos de áudio ou clique para importar"}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 0.5 }}>MP3 · WAV · OGG · FLAC · M4A · AAC · OPUS</div>
                {importing && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--gold)", fontSize: 12 }}>
                    <div style={{ width: 12, height: 12, border: "1.5px solid var(--border)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Importando arquivos...
                  </div>
                )}
              </div>

              {/* Library stats + controls bar */}
              {importedFiles.length > 0 && (
                <div style={{ marginBottom: 20, padding: "12px 16px", ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎶</div>
                    <div>
                      <div style={{ fontFamily: "Cinzel,serif", fontSize: 10, color: "var(--gold2)", letterSpacing: 1 }}>Biblioteca Local</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>
                        {importedFiles.length} arquivo{importedFiles.length !== 1 ? "s" : ""} · {localPlaylists.length} playlist{localPlaylists.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  {/* Search filter */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", minWidth: 180 }}>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>⌕</span>
                    <input
                      value={localSearch}
                      onChange={e => setLocalSearch(e.target.value)}
                      placeholder="Buscar playlists..."
                      style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 12, width: "100%" }}
                    />
                    {localSearch && <span style={{ cursor: "pointer", color: "var(--muted)", fontSize: 11 }} onClick={() => setLocalSearch("")}>✕</span>}
                  </div>
                  <button className="btn-ghost" style={{ fontSize: 10, padding: "5px 12px", whiteSpace: "nowrap" }}
                    onClick={() => setShowLibrary(v => !v)}>
                    {showLibrary ? "▲ Ocultar arquivos" : "▼ Ver arquivos"}
                  </button>
                  <button className="btn-gold" style={{ fontSize: 10, padding: "5px 14px", whiteSpace: "nowrap" }}
                    onClick={() => { setEditingPl(null); setNewPlName(""); setSelectedFileIds(new Set()); setCreatePlOpen(true); }}>
                    + Nova Playlist
                  </button>
                </div>
              )}

              {/* Expandable file library */}
              {showLibrary && importedFiles.length > 0 && (
                <div style={{ ...card, marginBottom: 20, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "Cinzel,serif", fontSize: 10, color: "var(--gold2)", letterSpacing: 1 }}>Todos os Arquivos</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>({importedFiles.length})</span>
                  </div>
                  <div style={{ maxHeight: 240, overflowY: "auto" }}>
                    {importedFiles.map((f, i) => (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", borderBottom: i < importedFiles.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--card2)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>🎵</span>
                        <span style={{ flex: 1, fontSize: 12, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name?.replace(/\.[^.]+$/, "") || f.name}</span>
                        <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>{f.name?.split(".").pop()?.toUpperCase()}</span>
                        <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, padding: "0 4px", flexShrink: 0 }}
                          title="Remover arquivo"
                          onClick={() => { if (window.confirm(`Remover "${f.name}" da biblioteca?`)) deleteImportedFile(f.id); }}
                          onMouseEnter={e => e.currentTarget.style.color = "#e07070"}
                          onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Local playlists grid */}
              {localPlaylists.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--muted)" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎼</div>
                  <div style={{ marginBottom: 6, fontFamily: "Cinzel,serif", fontSize: 12, color: "var(--muted2)", letterSpacing: 1.5 }}>Nenhuma playlist local ainda</div>
                  <div style={{ fontSize: 12, marginBottom: 20, color: "var(--muted)" }}>Importe arquivos de áudio acima e crie sua primeira playlist</div>
                  {importedFiles.length > 0 && (
                    <button className="btn-gold" style={{ fontSize: 11, padding: "8px 20px" }}
                      onClick={() => { setEditingPl(null); setNewPlName(""); setSelectedFileIds(new Set()); setCreatePlOpen(true); }}>
                      + Criar Playlist
                    </button>
                  )}
                </div>
              ) : (() => {
                const filtered = localSearch.trim()
                  ? localPlaylists.filter(pl => pl.name.toLowerCase().includes(localSearch.toLowerCase()))
                  : localPlaylists;
                return filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)", fontSize: 12 }}>Nenhuma playlist encontrada para "{localSearch}"</div>
                ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
                  {filtered.map(pl => {
                    const playing = nowPlaying?.playlistId === pl.id && nowPlaying?.svc === "local";
                    const accentColor = localAccent(pl.name);
                    const trackCount = pl.trackIds.length;
                    return (
                      <div key={pl.id} onClick={() => openLocalPlaylist(pl)}
                        style={{ ...card, padding: 10, cursor: "pointer", transition: "all 0.2s", border: `1px solid ${playing ? accentColor : "var(--border)"}`, background: playing ? "rgba(201,168,76,0.05)" : "var(--card)", position: "relative" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.transform = "translateY(-2px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = playing ? accentColor : "var(--border)"; e.currentTarget.style.transform = "none"; }}>
                        {/* Cover art */}
                        <div style={{ width: "100%", aspectRatio: "1", borderRadius: 6, marginBottom: 8, background: localGradient(pl.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, position: "relative" }}>
                          🎵
                          {playing && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, borderRadius: 6 }}>▶</div>}
                        </div>
                        <div style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{pl.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{trackCount} faixa{trackCount !== 1 ? "s" : ""}</div>
                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                          <button style={{ flex: 1, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 4, cursor: "pointer", color: "var(--gold2)", fontSize: 9, fontFamily: "Cinzel,serif", padding: "3px 0" }}
                            onClick={e => { e.stopPropagation(); playLocalPlaylist(pl); }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,168,76,0.22)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(201,168,76,0.12)"; }}>▶ Tocar</button>
                          <button style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--muted)", fontSize: 10, padding: "3px 6px" }}
                            onClick={e => { e.stopPropagation(); openEditPlaylist(pl); }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>✎</button>
                          <button style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--muted)", fontSize: 10, padding: "3px 6px" }}
                            onClick={e => { e.stopPropagation(); if (window.confirm(`Excluir "${pl.name}"?`)) deleteLocalPlaylist(pl.id); }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(139,32,32,0.5)"; e.currentTarget.style.color = "#e07070"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                );
              })()}
            </div>
          ) : !isTabConnected ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>♪</div>
              <div style={{ marginBottom: 16 }}>Conecte sua conta para ver as playlists</div>
              <button className="btn-ghost" onClick={() => tab === "youtube" ? connectYouTube() : connectSpotify()}>Conectar {tab === "youtube" ? "YouTube" : "Spotify"}</button>
            </div>
          ) : currentList.length === 0 && !loading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}><div style={{ fontSize: 32, marginBottom: 12 }}>♪</div><div>Nenhuma playlist encontrada.</div></div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
              {currentList.map(pl => {
                const isYt = tab === "youtube";
                const thumb = isYt ? (pl.snippet?.thumbnails?.medium?.url || pl.snippet?.thumbnails?.default?.url) : pl.images?.[0]?.url;
                const name = isYt ? pl.snippet?.title : pl.name;
                const count = isYt ? pl.contentDetails?.itemCount : pl.tracks?.total;
                const playing = isPlayingThis(pl, tab);
                const accent = tab === "youtube" ? "#ff4444" : "#1db954";
                return (
                  <div key={pl.id} onClick={() => openPlaylist(pl, tab)}
                    style={{ ...card, padding: 10, cursor: "pointer", transition: "all 0.2s", border: `1px solid ${playing ? accent : "var(--border)"}`, background: playing ? (tab === "youtube" ? "rgba(255,68,68,0.05)" : "rgba(29,185,84,0.05)") : "var(--card)" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = playing ? accent : "var(--border)"; e.currentTarget.style.transform = "none"; }}>
                    <div style={{ width: "100%", aspectRatio: "1", borderRadius: 4, overflow: "hidden", marginBottom: 8, background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      {thumb ? <img src={thumb} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 28, color: "var(--muted)" }}>♪</span>}
                      {playing && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: accent }}>▶</div>}
                    </div>
                    <div style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{name}</div>
                    {count != null && <div style={{ fontSize: 11, color: "var(--muted)" }}>{count} faixas</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Track list ── */}
      {(isConnected || ytTokenExpired || tab === "local") && selectedPlaylist && (
        <div>
          {tracksLoading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
              <div style={{ width: 28, height: 28, border: "2px solid var(--border)", borderTopColor: gold, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              Carregando faixas...
            </div>
          ) : tracks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}><div style={{ fontSize: 32, marginBottom: 12 }}>♪</div><div>Nenhuma faixa encontrada.</div></div>
          ) : selectedPlaylist.svc === "local" ? (
            /* ── Local track list ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {tracks.map((item, idx) => {
                const nowLocalIdx = nowPlaying?.playlistId === selectedPlaylist.id && nowPlaying?.svc === "local" ? (nowPlaying?.startIdx ?? -1) : -1;
                const isCurrentTrack = nowLocalIdx === idx;
                const accentColor = localAccent(selectedPlaylist.name);
                return (
                  <div key={item.id || idx}
                    draggable
                    onDragStart={e => { dragRef.current = idx; e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnter={() => { dragOverRef.current = idx; }}
                    onDragOver={e => e.preventDefault()}
                    onDragEnd={() => {
                      const from = dragRef.current; const to = dragOverRef.current;
                      dragRef.current = null; dragOverRef.current = null;
                      if (from !== null && to !== null && from !== to) reorderTracks(from, to);
                    }}
                    onClick={() => playLocalTrack(idx)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 6, cursor: "pointer", transition: "background 0.15s", background: isCurrentTrack ? "rgba(201,168,76,0.08)" : "transparent" }}
                    onMouseEnter={e => { if (!isCurrentTrack) e.currentTarget.style.background = "var(--card)"; }}
                    onMouseLeave={e => { if (!isCurrentTrack) e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ width: 14, flexShrink: 0, display: "flex", flexDirection: "column", gap: 3, alignItems: "center", justifyContent: "center", cursor: "grab", opacity: 0.35 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.35"}>
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                    </div>
                    <div style={{ width: 24, textAlign: "center", flexShrink: 0, fontSize: 12, color: isCurrentTrack ? accentColor : "var(--muted)", fontFamily: "Cinzel,serif" }}>
                      {isCurrentTrack ? "▶" : idx + 1}
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0, background: localGradient(selectedPlaylist.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎵</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: isCurrentTrack ? accentColor : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.name?.replace(/\.[^.]+$/, "") || "Sem nome"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Arquivo local</div>
                    </div>
                    <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 14, padding: "2px 6px", flexShrink: 0 }}
                      title="Remover da biblioteca"
                      onClick={e => { e.stopPropagation(); if (window.confirm(`Remover "${item.name}" da biblioteca?`)) deleteImportedFile(item.id); }}
                      onMouseEnter={e => e.currentTarget.style.color = "#e07070"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}>✕</button>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── YouTube / Spotify track list ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {tracks.map((item, idx) => {
                const isYt = selectedPlaylist.svc === "youtube";
                const title = isYt ? item.snippet?.title : item.track?.name;
                const thumb = isYt
                  ? (item.snippet?.thumbnails?.default?.url)
                  : item.track?.album?.images?.[2]?.url || item.track?.album?.images?.[0]?.url;
                const sub = isYt
                  ? item.snippet?.videoOwnerChannelTitle
                  : item.track?.artists?.map(a => a.name).join(", ");
                const dur = !isYt && item.track?.duration_ms ? fmtDuration(item.track.duration_ms) : null;
                const nowYtIdx = nowPlaying?.playlistId === selectedPlaylist.id ? (nowPlaying?.startIdx ?? -1) : -1;
                const isCurrentTrack = isYt ? (item._ytIdx === nowYtIdx) : (nowYtIdx === idx);
                const accent = isYt ? "#ff4444" : "#1db954";

                return (
                  <div key={idx}
                    draggable
                    onDragStart={e => { dragRef.current = idx; e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnter={() => { dragOverRef.current = idx; }}
                    onDragOver={e => e.preventDefault()}
                    onDragEnd={() => {
                      const from = dragRef.current;
                      const to = dragOverRef.current;
                      dragRef.current = null;
                      dragOverRef.current = null;
                      if (from !== null && to !== null && from !== to) reorderTracks(from, to);
                    }}
                    onClick={() => playTrack(idx)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 6, cursor: "pointer", transition: "background 0.15s", background: isCurrentTrack ? (isYt ? "rgba(255,68,68,0.07)" : "rgba(29,185,84,0.07)") : "transparent" }}
                    onMouseEnter={e => { if (!isCurrentTrack) e.currentTarget.style.background = "var(--card)"; }}
                    onMouseLeave={e => { if (!isCurrentTrack) e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ width: 14, flexShrink: 0, display: "flex", flexDirection: "column", gap: 3, alignItems: "center", justifyContent: "center", cursor: "grab", opacity: 0.35 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "0.35"}>
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                      <div style={{ width: 10, height: 1.5, borderRadius: 1, background: "var(--gold)" }} />
                    </div>
                    <div style={{ width: 24, textAlign: "center", flexShrink: 0, fontSize: 12, color: isCurrentTrack ? accent : "var(--muted)", fontFamily: "Cinzel,serif" }}>
                      {isCurrentTrack ? "▶" : idx + 1}
                    </div>
                    <div style={{ width: 40, height: 40, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {thumb ? <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16, color: "var(--muted)" }}>♪</span>}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: isCurrentTrack ? accent : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
                    </div>
                    {dur && <div style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{dur}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Criar / Editar Playlist Local Modal ── */}
      {createPlOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setCreatePlOpen(false); setEditingPl(null); } }}>
          <div style={{ ...card, padding: 0, maxWidth: 560, width: "100%", background: "var(--surface)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: newPlName ? localGradient(newPlName) : "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "background 0.3s" }}>🎵</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Cinzel,serif", fontSize: 13, color: gold, letterSpacing: 2 }}>{editingPl ? "Editar Playlist" : "Nova Playlist"}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{selectedFileIds.size} faixa{selectedFileIds.size !== 1 ? "s" : ""} selecionada{selectedFileIds.size !== 1 ? "s" : ""}</div>
              </div>
              <button style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 20, padding: "2px 6px" }}
                onClick={() => { setCreatePlOpen(false); setEditingPl(null); }}>✕</button>
            </div>
            {/* Name input */}
            <div style={{ padding: "16px 24px 0" }}>
              <input value={newPlName} onChange={e => setNewPlName(e.target.value)}
                placeholder="Nome da playlist..."
                style={{ width: "100%", boxSizing: "border-box", fontFamily: "Cinzel,serif", fontSize: 13 }}
                onKeyDown={e => { if (e.key === "Enter" && newPlName.trim() && selectedFileIds.size > 0) createLocalPlaylist(); }} />
            </div>
            {/* File list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 16px" }}>
              {importedFiles.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🎵</div>
                  <div style={{ marginBottom: 12 }}>Nenhum arquivo importado ainda</div>
                  <button className="btn-ghost" style={{ fontSize: 10 }} onClick={() => { setCreatePlOpen(false); fileInputRef.current?.click(); }}>Importar MP3</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontFamily: "Cinzel,serif", fontSize: 10, color: "var(--muted2)", letterSpacing: 1 }}>BIBLIOTECA LOCAL · {importedFiles.length} arquivo{importedFiles.length !== 1 ? "s" : ""}</div>
                    <button style={{ background: "transparent", border: "none", cursor: "pointer", color: selectedFileIds.size === importedFiles.length ? gold : "var(--muted)", fontSize: 10, fontFamily: "Cinzel,serif", letterSpacing: 1 }}
                      onClick={() => setSelectedFileIds(selectedFileIds.size === importedFiles.length ? new Set() : new Set(importedFiles.map(f => f.id)))}>
                      {selectedFileIds.size === importedFiles.length ? "Desmarcar todos" : "Selecionar todos"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {importedFiles.map(f => {
                      const checked = selectedFileIds.has(f.id);
                      return (
                        <div key={f.id} onClick={() => {
                          setSelectedFileIds(prev => {
                            const n = new Set(prev);
                            checked ? n.delete(f.id) : n.add(f.id);
                            return n;
                          });
                        }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 6, cursor: "pointer", transition: "background 0.15s", background: checked ? "rgba(201,168,76,0.07)" : "transparent", border: `1px solid ${checked ? "rgba(201,168,76,0.2)" : "transparent"}` }}
                          onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--card)"; }}
                          onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${checked ? gold : "var(--border2)"}`, background: checked ? gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                            {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <div style={{ fontSize: 14, flexShrink: 0 }}>🎵</div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, color: checked ? "var(--gold2)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {f.name?.replace(/\.[^.]+$/, "") || "Sem nome"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => { setCreatePlOpen(false); setEditingPl(null); }}>Cancelar</button>
              <button className="btn-gold" disabled={!newPlName.trim() || selectedFileIds.size === 0} onClick={createLocalPlaylist}
                style={{ opacity: !newPlName.trim() || selectedFileIds.size === 0 ? 0.5 : 1 }}>
                {editingPl ? "Salvar" : "Criar Playlist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spotify Setup Modal */}
      {spSetupOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setSpSetupOpen(false); }}
        >
          <div style={{ ...card, padding: 28, maxWidth: 480, width: "90%", background: "var(--surface)" }}>
            <div style={{ fontFamily: "Cinzel,serif", fontSize: 14, color: gold, letterSpacing: 2, marginBottom: 6 }}>
              Configurar Spotify
            </div>
            <p style={{ color: "var(--muted2)", fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              Crie um app em{" "}
              <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "#1db954" }}>
                developer.spotify.com
              </a>
              , copie o <strong style={{ color: "var(--text)" }}>Client ID</strong> e adicione como URI de redirecionamento:
            </p>
            <code style={{
              display: "block", background: "var(--card2)", padding: "8px 12px", borderRadius: 4,
              fontSize: 12, color: "var(--gold2)", marginBottom: 16, wordBreak: "break-all",
              border: "1px solid var(--border)",
            }}>
              {window.location.origin + window.location.pathname.replace(/\/+$/, "")}
            </code>
            <input
              value={spClientIdDraft}
              onChange={e => setSpClientIdDraft(e.target.value)}
              placeholder="Cole aqui o Client ID do Spotify..."
              style={{ marginBottom: 14 }}
              onKeyDown={e => {
                if (e.key === "Enter" && spClientIdDraft.trim()) {
                  const cid = spClientIdDraft.trim();
                  setSpClientId(cid); setSpSetupOpen(false); connectSpotify(cid);
                }
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setSpSetupOpen(false)}>Cancelar</button>
              <button className="btn-gold"
                disabled={!spClientIdDraft.trim()}
                onClick={() => {
                  const cid = spClientIdDraft.trim();
                  if (cid) { setSpClientId(cid); setSpSetupOpen(false); connectSpotify(cid); }
                }}>
                Salvar e Conectar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
