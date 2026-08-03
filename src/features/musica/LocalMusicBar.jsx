/**
 * A barra que toca os MP3 importados pelo mestre — o player que fica fixo no rodapé quando a
 * trilha em execução vem da biblioteca local: play/pause, faixa anterior/próxima, repetição
 * (nenhuma/playlist/faixa), busca na linha do tempo e encerrar.
 *
 * É uma feature porque carrega regra da mesa, não casca reutilizável: ela lê o arquivo do
 * IndexedDB, cria a URL de blob, avança sozinha ao fim da faixa conforme o modo de repetição
 * e devolve o índice atual para o estado de "tocando agora" que o App mantém.
 */
import { useState, useEffect, useRef } from "react";
import { audioDBGet } from "./audioDb";
import { fmtSeconds, localGradient, localAccent } from "./musicaUtils";

/* ── Local MP3 Player Bar ── */
export default function LocalMusicBar({ nowPlaying, onNowPlaying }) {
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  const nowPlayingRef = useRef(nowPlaying);
  const currentIdxRef = useRef(nowPlaying?.startIdx || 0);
  const seekingRef = useRef(false);
  const onNowPlayingRef = useRef(onNowPlaying);
  const loadTrackRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(nowPlaying?.startIdx || 0);

  useEffect(() => { nowPlayingRef.current = nowPlaying; }, [nowPlaying]);
  useEffect(() => { onNowPlayingRef.current = onNowPlaying; }, [onNowPlaying]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  seekingRef.current = seeking;

  loadTrackRef.current = async (idx) => {
    const tr = nowPlayingRef.current?.tracks || [];
    if (!tr[idx]) return;
    try {
      const file = await audioDBGet(tr[idx].id);
      if (!file?.buf) return;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const blob = new Blob([file.buf], { type: "audio/mpeg" });
      blobUrlRef.current = URL.createObjectURL(blob);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = blobUrlRef.current;
      setCurrentTime(0);
      audioRef.current.play().catch((e) => console.warn("[música] play bloqueado pelo navegador:", e));
    } catch (e) { console.warn("[música] trocar faixa falhou:", e); }
  };

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    const onTime = () => { if (!seekingRef.current) setCurrentTime(a.currentTime); };
    const onDur = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      const rep = nowPlayingRef.current?.repeat || "none";
      const tr = nowPlayingRef.current?.tracks || [];
      const idx = currentIdxRef.current;
      if (rep === "one") { a.currentTime = 0; a.play().catch((e) => console.warn("[música] repetir faixa falhou:", e)); return; }
      if (idx + 1 < tr.length) {
        const next = idx + 1;
        setCurrentIdx(next); currentIdxRef.current = next;
        onNowPlayingRef.current(prev => prev ? { ...prev, startIdx: next } : prev);
        loadTrackRef.current(next);
      } else if (rep === "all" && tr.length > 0) {
        setCurrentIdx(0); currentIdxRef.current = 0;
        onNowPlayingRef.current(prev => prev ? { ...prev, startIdx: 0 } : prev);
        loadTrackRef.current(0);
      } else {
        setIsPlaying(false);
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const idx = nowPlaying?.startIdx ?? 0;
    setCurrentIdx(idx); currentIdxRef.current = idx;
    setCurrentTime(0); setDuration(0);
    loadTrackRef.current && loadTrackRef.current(idx);
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying?.playlistId]);

  const tracks = nowPlaying?.tracks || [];
  const repeat = nowPlaying?.repeat || "none";
  const track = tracks[currentIdx];
  const plName = nowPlaying?.playlistName || "";
  const accent = localAccent(plName);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const gold = "var(--gold)";
  const btnCtrl = { background: "transparent", border: "none", cursor: "pointer", color: "var(--muted2)", fontSize: 20, padding: "4px 8px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.15s" };

  const togglePlay = () => { const a = audioRef.current; if (!a) return; isPlaying ? a.pause() : a.play().catch((e) => console.warn("[música] play bloqueado pelo navegador:", e)); };
  const prevTrack = () => {
    if (currentIdx === 0) return;
    const idx = currentIdx - 1;
    setCurrentIdx(idx); currentIdxRef.current = idx;
    onNowPlaying(prev => prev ? { ...prev, startIdx: idx } : prev);
    loadTrackRef.current(idx);
  };
  const nextTrack = () => {
    if (currentIdx + 1 >= tracks.length) return;
    const idx = currentIdx + 1;
    setCurrentIdx(idx); currentIdxRef.current = idx;
    onNowPlaying(prev => prev ? { ...prev, startIdx: idx } : prev);
    loadTrackRef.current(idx);
  };
  const cycleRepeat = () => {
    const modes = ["none", "all", "one"];
    const next = modes[(modes.indexOf(repeat) + 1) % 3];
    onNowPlaying(prev => ({ ...prev, repeat: next }));
  };
  const stop = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    onNowPlaying(null);
  };

  return (
    <div style={{ background: "rgba(8,8,8,0.97)", borderTop: "1px solid var(--border2)", padding: "8px 24px 10px", backdropFilter: "blur(16px)" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ width: 42, height: 42, borderRadius: 6, flexShrink: 0, background: localGradient(plName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎵</div>
        <div style={{ minWidth: 0, width: 200, flexShrink: 0 }}>
          <div style={{ fontFamily: "Cinzel,serif", fontSize: 9, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {track?.name?.replace(/\.[^.]+$/, "") || plName}
          </div>
          <div style={{ fontSize: 11, color: accent, marginTop: 2 }}>♪ Local</div>
          {tracks.length > 0 && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{currentIdx + 1} / {tracks.length}</div>}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", margin: "0 auto" }}>
          <button onClick={cycleRepeat} title="Repetição" style={{ ...btnCtrl, color: repeat !== "none" ? gold : "var(--muted)", padding: "4px 6px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              {repeat === "one" && <line x1="12" y1="12" x2="12" y2="12" strokeWidth="3.5" />}
            </svg>
          </button>
          <button onClick={prevTrack} disabled={currentIdx === 0} style={{ ...btnCtrl, opacity: currentIdx === 0 ? 0.35 : 1 }}
            onMouseEnter={e => { if (currentIdx > 0) e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted2)"}>⏮</button>
          <button onClick={togglePlay} style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#c9a84c,#e8c96d)", border: "none", cursor: "pointer", fontSize: 16, color: "#050505", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 14px rgba(201,168,76,0.45)", transition: "transform 0.15s, box-shadow 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.65)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 14px rgba(201,168,76,0.45)"; }}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button onClick={nextTrack} disabled={currentIdx + 1 >= tracks.length} style={{ ...btnCtrl, opacity: currentIdx + 1 >= tracks.length ? 0.35 : 1 }}
            onMouseEnter={e => { if (currentIdx + 1 < tracks.length) e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted2)"}>⏭</button>
        </div>
        <button onClick={stop} style={{ ...btnCtrl, border: "1px solid var(--border)", width: 30, height: 30, borderRadius: 4, fontSize: 14, color: "var(--muted)" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>✕</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums", minWidth: 32, textAlign: "right" }}>{fmtSeconds(currentTime)}</span>
        <div style={{ flex: 1, position: "relative", height: 16, display: "flex", alignItems: "center", cursor: "pointer" }}
          onClick={e => {
            if (!audioRef.current || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const t = ratio * duration;
            audioRef.current.currentTime = t; setCurrentTime(t);
          }}>
          <div style={{ position: "absolute", inset: "6px 0", borderRadius: 3, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: `${progress}%`, borderRadius: 3, background: "linear-gradient(90deg,#a07830,#e8c96d)", transition: seeking ? "none" : "width 0.3s linear" }} />
          <div style={{ position: "absolute", left: `${progress}%`, top: "50%", transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: "50%", background: gold, boxShadow: "0 0 6px rgba(201,168,76,0.7)", transition: seeking ? "none" : "left 0.3s linear", pointerEvents: "none" }} />
          <input type="range" min={0} max={duration || 1} value={currentTime} step={0.1}
            onChange={e => { const v = Number(e.target.value); setCurrentTime(v); if (audioRef.current) audioRef.current.currentTime = v; }}
            onMouseDown={() => setSeeking(true)} onMouseUp={() => setSeeking(false)}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", margin: 0 }} />
        </div>
        <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums", minWidth: 32 }}>{fmtSeconds(duration)}</span>
      </div>
    </div>
  );
}
