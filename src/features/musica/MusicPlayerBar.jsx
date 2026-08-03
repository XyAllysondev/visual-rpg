/**
 * A barra de "tocando agora" que acompanha a mesa inteira — fica fixa no rodapé em qualquer
 * tela e escolhe o player conforme a origem da trilha: MP3 local (delega para a LocalMusicBar),
 * Spotify (embed, porque sem Premium não há SDK) ou YouTube (IFrame API, com controles próprios).
 *
 * É uma feature porque concentra as manhas de tocar música durante o jogo: reaproveita o player
 * do YouTube em vez de recriá-lo a cada playlist, recria o host que a API destrói, detecta
 * autoplay bloqueado pelo navegador e traduz os erros do YouTube (playlist privada, bloqueio de
 * extensão) para o texto que o mestre entende no meio da sessão.
 */
import { useState, useEffect, useRef } from "react";
import LocalMusicBar from "./LocalMusicBar";
import { fmtSeconds } from "./musicaUtils";

/* ── Persistent Music Player Bar ── */
export default function MusicPlayerBar({ nowPlaying, onNowPlaying, ytPlayerRef }) {
  const [ytState, setYtState] = useState(-1);
  const [displayIdx, setDisplayIdx] = useState(nowPlaying?.startIdx || 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const pollRef = useRef(null);
  const displayIdxRef = useRef(displayIdx);
  const seekingRef = useRef(seeking);
  const autoplayTimerRef = useRef(null);
  const apiTimeoutRef = useRef(null);
  displayIdxRef.current = displayIdx;
  seekingRef.current = seeking;
  const gold = "var(--gold)";

  /* init / reinit YouTube IFrame player when playlist changes */
  useEffect(() => {
    if (nowPlaying?.svc !== "youtube") return;
    setCurrentTime(0);
    setDuration(0);
    setAutoplayBlocked(false);
    setPlayerError(null);
    setPlayerReady(false);
    if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current);
    if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);

    const ytErrors = { 2: "ID inválido", 5: "Erro HTML5", 100: "Vídeo não encontrado ou removido", 101: "Playlist privada — torne-a pública ou não listada no YouTube para reproduzir", 150: "Playlist privada — torne-a pública ou não listada no YouTube para reproduzir" };

    const create = () => {
      // If player already exists, load new playlist without recreating
      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadPlaylist === "function") {
        try {
          ytPlayerRef.current.loadPlaylist({ listType: "playlist", list: nowPlaying.playlistId, index: nowPlaying.startIdx || 0 });
          setPlayerReady(true);
          autoplayTimerRef.current = setTimeout(() => {
            const p = ytPlayerRef.current;
            if (p && typeof p.getPlayerState === "function" && p.getPlayerState() !== 1) setAutoplayBlocked(true);
          }, 3000);
          return;
        } catch (e) { console.warn("[música] reutilizar player YT falhou — recriando:", e); }
      }
      // Destroy old player if exists
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch { /* best-effort: player já destruído */ }
        ytPlayerRef.current = null;
      }
      // Find or recreate the host element (YouTube destroys it on destroy())
      let host = document.getElementById("yt-player-host");
      if (!host) {
        host = document.createElement("div");
        host.id = "yt-player-host";
        host.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none";
        document.body.appendChild(host);
      }
      ytPlayerRef.current = new window.YT.Player(host, {
        height: 1, width: 1,
        playerVars: {
          listType: "playlist", list: nowPlaying.playlistId,
          index: nowPlaying.startIdx || 0,
          autoplay: 1, controls: 0, fs: 0, rel: 0,
          origin: window.location.origin,
        },
        events: {
          onStateChange: e => {
            setYtState(e.data);
            if (e.data === 1) { setAutoplayBlocked(false); setPlayerError(null); if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current); }
          },
          onReady: e => {
            setPlayerReady(true);
            e.target.playVideo();
            setDisplayIdx(e.target.getPlaylistIndex() || 0);
            autoplayTimerRef.current = setTimeout(() => {
              const p = ytPlayerRef.current;
              if (p && typeof p.getPlayerState === "function" && p.getPlayerState() !== 1) setAutoplayBlocked(true);
            }, 3000);
          },
          onError: e => setPlayerError(ytErrors[e.data] || `Erro ${e.data}`),
        },
      });
    };

    const tryCreate = () => {
      if (window.YT?.Player) {
        create();
      } else {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (prev) prev(); create(); };
        // Timeout: if API never loads (blocked by AdBlocker etc.)
        apiTimeoutRef.current = setTimeout(() => {
          if (!window.YT?.Player) setPlayerError("Player YouTube não carregou. Desative extensões e recarregue a página.");
        }, 10000);
      }
    };

    tryCreate();
    return () => {
      if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current);
      if (apiTimeoutRef.current) clearTimeout(apiTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying?.playlistId]);

  /* poll current track index + progress */
  useEffect(() => {
    if (nowPlaying?.svc !== "youtube") return;
    pollRef.current = setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p || typeof p.getPlaylistIndex !== "function") return;
      const idx = p.getPlaylistIndex();
      if (idx >= 0 && idx !== displayIdxRef.current) {
        setDisplayIdx(idx);
        onNowPlaying(prev => prev ? { ...prev, startIdx: idx } : prev);
      }
      if (!seekingRef.current) {
        if (typeof p.getCurrentTime === "function") setCurrentTime(Math.floor(p.getCurrentTime()));
        if (typeof p.getDuration === "function") setDuration(Math.floor(p.getDuration()));
      }
    }, 800);
    return () => clearInterval(pollRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying?.svc]);

  /* handle repeat one */
  useEffect(() => {
    if (ytState !== 0 || !ytPlayerRef.current) return;
    if (nowPlaying?.repeat === "one") { ytPlayerRef.current.seekTo(0); ytPlayerRef.current.playVideo(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytState]);

  const isPlaying = ytState === 1;
  const tracks = nowPlaying?.tracks || [];
  const currentTrack = tracks[displayIdx];
  const thumb = currentTrack?.snippet?.thumbnails?.default?.url || nowPlaying?.playlistThumb || "";
  const title = currentTrack?.snippet?.title || nowPlaying?.playlistName || "";
  const channel = currentTrack?.snippet?.videoOwnerChannelTitle || "";
  const repeat = nowPlaying?.repeat || "none";

  const togglePlay = () => { const p = ytPlayerRef.current; if (!p) return; setAutoplayBlocked(false); setPlayerError(null); isPlaying ? p.pauseVideo() : p.playVideo(); };
  const prevTrack = () => { const p = ytPlayerRef.current; if (!p) return; displayIdx === 0 ? p.playVideoAt(Math.max(0, tracks.length - 1)) : p.previousVideo(); };
  const nextTrack = () => ytPlayerRef.current?.nextVideo();
  const cycleRepeat = () => {
    const modes = ["none", "all", "one"];
    const next = modes[(modes.indexOf(repeat) + 1) % 3];
    onNowPlaying(prev => ({ ...prev, repeat: next }));
    if (ytPlayerRef.current?.setLoop) ytPlayerRef.current.setLoop(next === "all");
  };
  const stop = () => {
    if (ytPlayerRef.current) { try { ytPlayerRef.current.stopVideo(); ytPlayerRef.current.destroy(); } catch { /* best-effort: player já destruído */ } ytPlayerRef.current = null; }
    onNowPlaying(null);
  };

  const btnCtrl = {
    background: "transparent", border: "none", cursor: "pointer",
    color: "var(--muted2)", fontSize: 20, padding: "4px 8px", lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s",
  };

  /* Local MP3 */
  if (nowPlaying?.svc === "local") return <LocalMusicBar nowPlaying={nowPlaying} onNowPlaying={onNowPlaying} />;

  /* Spotify: embed iframe (no SDK without Premium) */
  if (nowPlaying?.svc === "spotify") {
    return (
      <div style={{ background: "rgba(8,8,8,0.97)", borderTop: "1px solid var(--border2)", padding: "10px 20px", display: "flex", gap: 14, alignItems: "center", backdropFilter: "blur(16px)" }}>
        <div style={{ width: 46, height: 46, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {nowPlaying.playlistThumb ? <img src={nowPlaying.playlistThumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "var(--muted)", fontSize: 20 }}>♪</span>}
        </div>
        <div style={{ minWidth: 0, maxWidth: 160, flexShrink: 0 }}>
          <div style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nowPlaying.playlistName}</div>
          <div style={{ fontSize: 11, color: "#1db954", marginTop: 2 }}>● Spotify</div>
        </div>
        <div style={{ flex: 1, maxWidth: 520 }}>
          <iframe title={`Spotify: ${nowPlaying.playlistName}`}
            src={`https://open.spotify.com/embed/playlist/${nowPlaying.playlistId}?utm_source=generator&theme=0`}
            width="100%" height="72" style={{ border: "none", borderRadius: 6, display: "block" }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
        </div>
        <button onClick={stop} style={{ ...btnCtrl, border: "1px solid var(--border)", width: 30, height: 30, borderRadius: 4, color: "var(--muted)" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>✕</button>
      </div>
    );
  }

  /* YouTube: full controls */
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{ background: "rgba(8,8,8,0.97)", borderTop: "1px solid var(--border2)", padding: "8px 24px 10px", backdropFilter: "blur(16px)" }}>
      {playerError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0 3px", color: "#e07070", fontFamily: "Cinzel,serif", fontSize: 9, letterSpacing: 0.5 }}>
          <span>⚠</span><span>{playerError}</span>
        </div>
      )}
      {/* Row 1: thumb + info + controls + stop */}
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {/* Thumb */}
        <div style={{ width: 42, height: 42, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {thumb ? <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "var(--muted)", fontSize: 20 }}>♪</span>}
        </div>
        {/* Info */}
        <div style={{ minWidth: 0, width: 200, flexShrink: 0 }}>
          <div style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{channel}</div>
          {tracks.length > 0 && <div style={{ fontSize: 10, color: "#ff4444", marginTop: 1 }}>{displayIdx + 1} / {tracks.length}</div>}
        </div>
        {/* Controls */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", margin: "0 auto" }}>
          <button onClick={cycleRepeat} title={repeat === "none" ? "Sem repetição" : repeat === "all" ? "Repetir playlist" : "Repetir música"}
            style={{ ...btnCtrl, color: repeat !== "none" ? gold : "var(--muted)", padding: "4px 6px" }}>
            {repeat === "one" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                <line x1="12" y1="12" x2="12" y2="12" strokeWidth="3" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            )}
          </button>
          <button onClick={prevTrack} style={btnCtrl}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted2)"}>⏮</button>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {autoplayBlocked && !playerError && (
              <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: "rgba(201,168,76,0.12)", border: "1px solid var(--border2)", borderRadius: 4, padding: "3px 8px", whiteSpace: "nowrap", fontFamily: "Cinzel,serif", fontSize: 8, color: "var(--gold2)", letterSpacing: 0.5, pointerEvents: "none" }}>
                Clique para iniciar
              </div>
            )}
            <button onClick={togglePlay} disabled={!!playerError} style={{
              width: 42, height: 42, borderRadius: "50%",
              background: playerError ? "rgba(60,30,30,0.8)" : "linear-gradient(135deg,#c9a84c,#e8c96d)",
              border: playerError ? "1px solid #8b2020" : "none",
              cursor: playerError ? "not-allowed" : "pointer",
              fontSize: playerReady ? 16 : 13, color: "#050505", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: autoplayBlocked ? "0 0 0 3px rgba(201,168,76,0.5), 0 2px 14px rgba(201,168,76,0.45)" : "0 2px 14px rgba(201,168,76,0.45)",
              transition: "transform 0.15s, box-shadow 0.15s",
              animation: autoplayBlocked && !playerError ? "pulse 1.2s ease-in-out infinite" : "none",
            }}
              onMouseEnter={e => { if (!playerError) { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.65)"; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = autoplayBlocked ? "0 0 0 3px rgba(201,168,76,0.5), 0 2px 14px rgba(201,168,76,0.45)" : "0 2px 14px rgba(201,168,76,0.45)"; }}>
              {playerError ? "⚠" : !playerReady ? <div style={{ width: 14, height: 14, border: "2px solid rgba(5,5,5,0.3)", borderTopColor: "#050505", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : isPlaying ? "⏸" : "▶"}
            </button>
          </div>
          <button onClick={nextTrack} style={btnCtrl}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted2)"}>⏭</button>
        </div>
        {/* Stop */}
        <button onClick={stop} style={{ ...btnCtrl, border: "1px solid var(--border)", width: 30, height: 30, borderRadius: 4, fontSize: 14, color: "var(--muted)" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>✕</button>
      </div>
      {/* Row 2: progress bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums", minWidth: 32, textAlign: "right" }}>{fmtSeconds(currentTime)}</span>
        <div style={{ flex: 1, position: "relative", height: 16, display: "flex", alignItems: "center", cursor: "pointer" }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const seekTo = Math.floor(ratio * (duration || 0));
            setCurrentTime(seekTo);
            ytPlayerRef.current?.seekTo(seekTo, true);
          }}>
          {/* Track */}
          <div style={{ position: "absolute", inset: "6px 0", borderRadius: 3, background: "rgba(255,255,255,0.1)" }} />
          {/* Fill */}
          <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: `${progress}%`, borderRadius: 3, background: "linear-gradient(90deg,#a07830,#e8c96d)", transition: seeking ? "none" : "width 0.4s linear" }} />
          {/* Thumb */}
          <div style={{ position: "absolute", left: `${progress}%`, top: "50%", transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: "50%", background: "var(--gold)", boxShadow: "0 0 6px rgba(201,168,76,0.7)", transition: seeking ? "none" : "left 0.4s linear", pointerEvents: "none" }} />
          {/* Invisible range input for drag support */}
          <input type="range" min={0} max={duration || 1} value={currentTime} step={1}
            onChange={e => setCurrentTime(Number(e.target.value))}
            onMouseDown={() => setSeeking(true)}
            onMouseUp={e => { setSeeking(false); ytPlayerRef.current?.seekTo(Number(e.target.value), true); }}
            onTouchStart={() => setSeeking(true)}
            onTouchEnd={e => { setSeeking(false); ytPlayerRef.current?.seekTo(Number(e.target.value), true); }}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", margin: 0 }} />
        </div>
        <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums", minWidth: 32 }}>{fmtSeconds(duration)}</span>
      </div>
    </div>
  );
}
