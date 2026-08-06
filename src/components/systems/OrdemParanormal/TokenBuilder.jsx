/* ════════════════════════════════════════════════════════════════════════
 *  CONSTRUTOR DE TOKENS — paper-doll para Ordem Paranormal
 *
 *  As peças do pack NÃO têm registro entre si (cada uma foi desenhada num
 *  enquadramento próprio — constatado compondo os originais). Por isso o
 *  builder usa ÂNCORAS por camada: a peça entra no lugar certo do corpo em
 *  escala adequada, e o usuário afina com arrasto (mover), roda do mouse /
 *  botões (escala) e espelhamento. Exporta PNG 512×512 circular.
 * ════════════════════════════════════════════════════════════════════════ */
import React, { useState, useRef, useMemo, useCallback } from "react";
import CAMADAS from "../../../data/ordemParanormal/builder-pecas.json";

const SIZE = 512;
const OPC = "#a3282c";

/* Onde cada camada "nasce" sobre o molde: centro (x,y em 0..1) e escala
 * (fração do canvas). Valores calibrados para os moldes chibi do pack. */
const ANCORAS = {
  molde:     { x: 0.50, y: 0.52, s: 0.90 },
  cicatriz:  { x: 0.44, y: 0.28, s: 0.13 },
  tatuagem:  { x: 0.50, y: 0.58, s: 0.18 },
  roupa:     { x: 0.50, y: 0.64, s: 0.50 },
  cabelo:    { x: 0.50, y: 0.25, s: 0.40 },
  barba:     { x: 0.50, y: 0.37, s: 0.22 },
  equipavel: { x: 0.50, y: 0.58, s: 0.42 },
  arma:      { x: 0.68, y: 0.60, s: 0.38 },
  parte:     { x: 0.50, y: 0.50, s: 0.45 },
};

/* Peças de cabeça (chapéus, bandanas, óculos…) vivem na camada Roupas mas
 * ancoram na CABEÇA do molde, não no torso. */
const ancoraPara = (camadaId, peca) => {
  const txt = `${peca.cat || ""} ${peca.sub || ""} ${peca.nome || ""}`;
  if (camadaId === "roupa" && /cabe[cç]|chap[eé]u|capuz|m[aá]scara|[oó]culos|boina|bon[eé]|bandana|touca|capacete|tiara|coroa/i.test(txt))
    return { x: 0.50, y: 0.26, s: 0.40 };
  if (camadaId === "equipavel" && /cabe[cç]|m[aá]scara|[oó]culos|capacete/i.test(txt))
    return { x: 0.50, y: 0.27, s: 0.36 };
  return ANCORAS[camadaId] || { x: 0.5, y: 0.5, s: 0.4 };
};

const ANEIS = [
  { id: "nenhum",   nome: "Sem anel",     cor: null },
  { id: "ordem",    nome: "Ordem",        cor: "#c9a84c" },
  { id: "aliado",   nome: "Aliado",       cor: "#4a9d5f" },
  { id: "inimigo",  nome: "Inimigo",      cor: "#c23b3b" },
  { id: "sangue",   nome: "Sangue",       cor: "#e04040" },
  { id: "morte",    nome: "Morte",        cor: "#a8b0b8" },
  { id: "energia",  nome: "Energia",      cor: "#57a0ff" },
  { id: "medo",     nome: "Medo",         cor: "#a3282c" },
  { id: "conhecim", nome: "Conhecimento", cor: "#f0c040" },
];

/* Tons de pele aplicados ao MOLDE via multiply — a arte é branca com linhas
 * escuras, então a cor tinge o corpo e preserva o traço. */
const PELES = [
  { id: "original", nome: "Original",  cor: null },
  { id: "clara",    nome: "Clara",     cor: "#f7e3cf" },
  { id: "media",    nome: "Média",     cor: "#eec39a" },
  { id: "morena",   nome: "Morena",    cor: "#c98f5e" },
  { id: "escura",   nome: "Escura",    cor: "#8d5a3b" },
  { id: "retinta",  nome: "Retinta",   cor: "#5a3a28" },
  { id: "palida",   nome: "Pálida",    cor: "#cfd2dd" },
  { id: "cadaver",  nome: "Cadavérica",cor: "#aebfae" },
  { id: "sangue",   nome: "Sangue",    cor: "#c96a6a" },
  { id: "paranormal",nome:"Paranormal",cor: "#a882c9" },
];

/* Tinge uma imagem carregada: multiply da cor + restaura o alpha original. */
const tingir = (img, cor) => {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "multiply";
  x.fillStyle = cor; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = "destination-in";
  x.drawImage(img, 0, 0);
  return c;
};

const FUNDOS = [
  { id: "transp", nome: "Transparente", cor: null },
  { id: "escuro", nome: "Escuro",       cor: "#14121c" },
  { id: "pedra",  nome: "Pedra",        cor: "#3a3a42" },
  { id: "sangue", nome: "Sangue",       cor: "#3b1414" },
  { id: "musgo",  nome: "Musgo",        cor: "#1e2b1e" },
  { id: "claro",  nome: "Claro",        cor: "#d8d4cc" },
];

export default function TokenBuilder({ onSalvar, onFechar, nomeInicial = "" }) {
  /* sel[camadaId] = { peca, x, y, s, flip } */
  const [sel, setSel]            = useState({});
  const [camadaAtiva, setCamada] = useState(CAMADAS[0]?.id || "molde");
  const [busca, setBusca]        = useState("");
  const [catFiltro, setCat]      = useState("Todas");
  const [anel, setAnel]          = useState("ordem");
  const [fundo, setFundo]        = useState("escuro");
  const [pele, setPele]          = useState("original");
  const [moldeTingido, setMoldeTingido] = useState(null);   // dataURL do molde com a pele aplicada
  const [nome, setNome]          = useState(nomeInicial);
  const [salvando, setSalvando]  = useState(false);
  const canvasRef  = useRef(null);
  const previewRef = useRef(null);
  const dragRef    = useRef(null);   // { camadaId, startX, startY, origX, origY }

  const camada   = CAMADAS.find((c) => c.id === camadaAtiva) || CAMADAS[0];
  const anelCor  = ANEIS.find((a) => a.id === anel)?.cor;
  const fundoCor = FUNDOS.find((f) => f.id === fundo)?.cor;
  const peleCor  = PELES.find((p) => p.id === pele)?.cor;

  /* pré-tinge o molde para o preview sempre que a peça ou a pele mudar */
  const moldeSrc = sel.molde?.peca.src;
  React.useEffect(() => {
    if (!moldeSrc || !peleCor) { setMoldeTingido(null); return; }
    let vivo = true;
    const im = new Image();
    im.onload = () => { if (vivo) try { setMoldeTingido(tingir(im, peleCor).toDataURL("image/png")); } catch (_) { setMoldeTingido(null); } };
    im.onerror = () => vivo && setMoldeTingido(null);
    im.src = moldeSrc;
    return () => { vivo = false; };
  }, [moldeSrc, peleCor]);

  const cats = useMemo(
    () => (camada ? ["Todas", ...Array.from(new Set(camada.pecas.map((p) => p.cat).filter(Boolean)))] : []),
    [camada]
  );

  const pecasVisiveis = useMemo(() => {
    if (!camada) return [];
    const q = busca.trim().toLowerCase();
    return camada.pecas.filter((p) =>
      (catFiltro === "Todas" || p.cat === catFiltro) &&
      (!q || p.nome.toLowerCase().includes(q) || (p.sub || "").toLowerCase().includes(q))
    );
  }, [camada, busca, catFiltro]);

  const empilhadas = useMemo(
    () => CAMADAS.filter((c) => sel[c.id]).sort((a, b) => a.z - b.z).map((c) => ({ camada: c, item: sel[c.id] })),
    [sel]
  );

  const escolher = (peca) => setSel((s) => {
    const atual = s[camadaAtiva];
    if (atual?.peca.id === peca.id) return { ...s, [camadaAtiva]: undefined };  // toggle off
    // troca de peça na mesma camada mantém o ajuste manual; peça nova usa a âncora
    const base = atual || ancoraPara(camadaAtiva, peca);
    return { ...s, [camadaAtiva]: { peca, x: base.x, y: base.y, s: base.s, flip: atual?.flip || false } };
  });

  const mudar = (camadaId, patch) => setSel((s) =>
    s[camadaId] ? { ...s, [camadaId]: { ...s[camadaId], ...patch } } : s);

  const sortear = () => {
    const novo = {};
    for (const c of CAMADAS) {
      if (c.id === "parte") continue;                       // partes caídas só manualmente
      if (!c.obrigatoria && Math.random() > 0.55) continue;
      const p = c.pecas[Math.floor(Math.random() * c.pecas.length)];
      if (p) novo[c.id] = { peca: p, ...ancoraPara(c.id, p), flip: false };
    }
    setSel(novo);
  };

  /* ── interação no preview: arrastar move a peça da camada ativa; roda escala ── */
  const posRelativa = (e) => {
    const r = previewRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const onPointerDown = (e) => {
    if (!sel[camadaAtiva]) return;
    const p = posRelativa(e);
    dragRef.current = { camadaId: camadaAtiva, startX: p.x, startY: p.y, origX: sel[camadaAtiva].x, origY: sel[camadaAtiva].y };
    previewRef.current.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const p = posRelativa(e);
    mudar(d.camadaId, { x: Math.min(1.2, Math.max(-0.2, d.origX + p.x - d.startX)),
                        y: Math.min(1.2, Math.max(-0.2, d.origY + p.y - d.startY)) });
  };
  const onPointerUp = () => { dragRef.current = null; };
  const onWheel = (e) => {
    if (!sel[camadaAtiva]) return;
    e.preventDefault();
    const fator = e.deltaY < 0 ? 1.06 : 0.94;
    mudar(camadaAtiva, { s: Math.min(1.6, Math.max(0.05, sel[camadaAtiva].s * fator)) });
  };

  /* ── exportação: desenha no canvas exatamente como no preview ── */
  const renderizar = useCallback(async () => {
    const cv = canvasRef.current || document.createElement("canvas");
    cv.width = SIZE; cv.height = SIZE;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, SIZE, SIZE);

    if (fundoCor) {
      ctx.save();
      ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 6, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = fundoCor; ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 6, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    for (const { camada: cam, item } of empilhadas) {
      let img = await new Promise((res, rej) => {
        const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = item.peca.src;
      }).catch(() => null);
      if (!img) continue;
      if (cam.id === "molde" && peleCor) {
        try { img = tingir(img, peleCor); } catch (_) {}
      }
      const box = item.s * SIZE;
      const escala = Math.min(box / img.width, box / img.height);
      const w = img.width * escala, h = img.height * escala;
      const cx = item.x * SIZE, cy = item.y * SIZE;
      ctx.save();
      ctx.translate(cx, cy);
      if (item.flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.restore();

    if (anelCor) {
      ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 8, 0, Math.PI * 2);
      ctx.lineWidth = 14; ctx.strokeStyle = anelCor; ctx.stroke();
      ctx.beginPath(); ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 16, 0, Math.PI * 2);
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.stroke();
    }
    return cv.toDataURL("image/png");
  }, [empilhadas, anelCor, fundoCor, peleCor]);

  const baixar = async () => {
    const url = await renderizar();
    const a = document.createElement("a");
    a.href = url; a.download = `${(nome || "token").replace(/[^\w-]+/g, "_")}.png`;
    a.click();
  };

  const salvar = async () => {
    if (!onSalvar) return;
    setSalvando(true);
    try { await onSalvar({ nome: nome.trim() || "Token", dataUrl: await renderizar() }); }
    finally { setSalvando(false); }
  };

  const L = { fontFamily: "Cinzel,serif", fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--muted)" };
  const ativa = sel[camadaAtiva];

  if (!CAMADAS.length) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontFamily: "Crimson Pro,serif" }}>
      Nenhuma peça importada para o construtor.
    </div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 10 }}>
      <style>{`
        .tb-peca{ cursor:pointer; border-radius:8px; background:rgba(255,255,255,0.05);
          border:1px solid var(--border); transition:transform .12s, border-color .12s, box-shadow .12s; }
        .tb-peca:hover{ transform:translateY(-2px); border-color:${OPC}88; }
        .tb-peca.on{ border:2px solid ${OPC}; box-shadow:0 0 14px ${OPC}66; }
        .tb-camada{ cursor:pointer; white-space:nowrap; font-family:Cinzel,serif; font-size:10px;
          letter-spacing:1.2px; text-transform:uppercase; padding:8px 14px; border-radius:8px;
          background:transparent; border:1px solid var(--border); color:var(--muted2); transition:all .15s; }
        .tb-camada:hover{ color:#fff; }
        .tb-camada.on{ background:${OPC}; border-color:${OPC}; color:#fff; font-weight:700; box-shadow:0 0 16px ${OPC}66; }
        .tb-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(84px,1fr)); gap:8px; }
        .tb-ctl{ padding:6px 10px; border-radius:7px; cursor:pointer; background:rgba(255,255,255,0.06);
          border:1px solid var(--border); color:var(--muted2); font-family:Cinzel,serif; font-size:10px;
          letter-spacing:1px; transition:all .15s; }
        .tb-ctl:hover{ color:#fff; border-color:${OPC}88; }
        @media(max-width:900px){ .tb-cols{ grid-template-columns:1fr !important; } }
      `}</style>

      {/* seletor de camadas */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, flexShrink: 0 }}>
        {CAMADAS.map((c) => (
          <button key={c.id} className={`tb-camada${camadaAtiva === c.id ? " on" : ""}`}
            onClick={() => { setCamada(c.id); setCat("Todas"); setBusca(""); }}>
            {c.nome}{sel[c.id] ? " ●" : ""} <span style={{ opacity: 0.6 }}>({c.pecas.length})</span>
          </button>
        ))}
      </div>

      <div className="tb-cols" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12, flex: 1, minHeight: 0 }}>
        {/* ── PREVIEW + CONTROLES ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
          <div ref={previewRef}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onWheel={onWheel}
            style={{
              position: "relative", width: "100%", aspectRatio: "1", borderRadius: "50%", overflow: "hidden",
              background: fundoCor || "repeating-conic-gradient(#2a2a32 0% 25%, #1e1e26 0% 50%) 50%/22px 22px",
              border: anelCor ? `7px solid ${anelCor}` : "1px solid var(--border)",
              boxShadow: anelCor ? `0 0 24px ${anelCor}55` : "none", flexShrink: 0,
              cursor: ativa ? "grab" : "default", touchAction: "none", userSelect: "none",
            }}>
            {empilhadas.map(({ camada: c, item }) => (
              <img key={c.id} src={c.id === "molde" && moldeTingido ? moldeTingido : item.peca.src} alt={item.peca.nome} draggable={false}
                style={{
                  position: "absolute",
                  left: `${(item.x - item.s / 2) * 100}%`, top: `${(item.y - item.s / 2) * 100}%`,
                  width: `${item.s * 100}%`, height: `${item.s * 100}%`,
                  objectFit: "contain", zIndex: c.z, pointerEvents: "none",
                  transform: item.flip ? "scaleX(-1)" : "none",
                  outline: c.id === camadaAtiva ? `1.5px dashed ${OPC}aa` : "none", outlineOffset: 2,
                }} />
            ))}
            {!empilhadas.length && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                textAlign: "center", padding: 20, ...L, fontSize: 10 }}>
                Escolha um molde para começar
              </div>
            )}
          </div>

          {/* controles da peça ativa */}
          {ativa ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
              <span style={{ ...L, marginRight: 2 }}>{camada.nome}:</span>
              <button className="tb-ctl" title="Diminuir (ou roda do mouse)" onClick={() => mudar(camadaAtiva, { s: Math.max(0.05, ativa.s * 0.9) })}>−</button>
              <button className="tb-ctl" title="Aumentar (ou roda do mouse)" onClick={() => mudar(camadaAtiva, { s: Math.min(1.6, ativa.s * 1.1) })}>+</button>
              <button className="tb-ctl" title="Espelhar" onClick={() => mudar(camadaAtiva, { flip: !ativa.flip })}>⇋</button>
              <button className="tb-ctl" title="Voltar à posição padrão" onClick={() => mudar(camadaAtiva, { ...ancoraPara(camadaAtiva, ativa.peca) })}>↺</button>
              <button className="tb-ctl" title="Remover peça" style={{ color: "#e07070" }} onClick={() => setSel((s) => ({ ...s, [camadaAtiva]: undefined }))}>✕</button>
              <span style={{ ...L, fontSize: 8, width: "100%" }}>arraste no círculo para mover · roda do mouse para escala</span>
            </div>
          ) : (
            <div style={{ ...L, fontSize: 8.5 }}>Escolha uma peça de {camada.nome} — ela entra já posicionada; depois arraste para ajustar.</div>
          )}

          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do token…"
            style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)",
              padding: "9px 12px", fontFamily: "Crimson Pro,serif", fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box" }} />

          <div>
            <div style={{ ...L, marginBottom: 5 }}>Pele</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {PELES.map((p) => (
                <button key={p.id} onClick={() => setPele(p.id)} title={p.nome}
                  style={{ width: 26, height: 26, borderRadius: "50%", cursor: "pointer",
                    background: p.cor || "#ffffff",
                    border: pele === p.id ? "2px solid #fff" : "1px solid var(--border)",
                    boxShadow: pele === p.id ? `0 0 10px ${p.cor || "#fff"}99` : "none" }}>
                  {!p.cor && <span style={{ color: "#333", fontSize: 11, lineHeight: 1, fontWeight: 700 }}>○</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ ...L, marginBottom: 5 }}>Anel</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {ANEIS.map((a) => (
                <button key={a.id} onClick={() => setAnel(a.id)} title={a.nome}
                  style={{ width: 26, height: 26, borderRadius: "50%", cursor: "pointer",
                    background: a.cor || "transparent",
                    border: anel === a.id ? "2px solid #fff" : "1px solid var(--border)",
                    boxShadow: anel === a.id ? `0 0 10px ${a.cor || "#fff"}88` : "none" }}>
                  {!a.cor && <span style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1 }}>∅</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ ...L, marginBottom: 5 }}>Fundo</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {FUNDOS.map((f) => (
                <button key={f.id} onClick={() => setFundo(f.id)} title={f.nome}
                  style={{ width: 26, height: 26, borderRadius: 6, cursor: "pointer",
                    background: f.cor || "repeating-conic-gradient(#2a2a32 0% 25%, #1e1e26 0% 50%) 50%/8px 8px",
                    border: fundo === f.id ? "2px solid #fff" : "1px solid var(--border)" }} />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="tb-ctl" onClick={sortear}>⚄ Sortear</button>
            <button className="tb-ctl" onClick={() => setSel({})}>✕ Limpar</button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={baixar} disabled={!empilhadas.length}
              style={{ ...btn("rgba(255,255,255,0.07)", "var(--text)"), flex: 1, opacity: empilhadas.length ? 1 : 0.4 }}>
              ⭳ Baixar PNG
            </button>
            {onSalvar && (
              <button onClick={salvar} disabled={!empilhadas.length || salvando}
                style={{ ...btn(`${OPC}33`, "#fff"), flex: 1, border: `1px solid ${OPC}`, opacity: empilhadas.length ? 1 : 0.4 }}>
                {salvando ? "Salvando…" : "✔ Usar no Mapa"}
              </button>
            )}
            {onFechar && <button onClick={onFechar} style={btn("transparent", "var(--muted)")}>Fechar</button>}
          </div>
        </div>

        {/* ── GALERIA DA CAMADA ── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar em ${camada.nome}…`}
              style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)",
                padding: "7px 12px", fontFamily: "Crimson Pro,serif", fontSize: 14, outline: "none", flex: 1, minWidth: 140 }} />
            {cats.length > 2 && (
              <select value={catFiltro} onChange={(e) => setCat(e.target.value)}
                style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)",
                  padding: "7px 10px", fontFamily: "Cinzel,serif", fontSize: 10, letterSpacing: 1, outline: "none", cursor: "pointer" }}>
                {cats.map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
            <span style={L}>{pecasVisiveis.length} peças</span>
          </div>

          <div className="tb-grid" style={{ overflowY: "auto", flex: 1, minHeight: 0, paddingRight: 4, alignContent: "start" }}>
            {pecasVisiveis.map((p) => {
              const on = sel[camadaAtiva]?.peca.id === p.id;
              return (
                <button key={p.id} className={`tb-peca${on ? " on" : ""}`} onClick={() => escolher(p)}
                  title={`${p.nome}${p.sub ? ` · ${p.sub}` : ""}`}
                  style={{ padding: 4, aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src={p.src} alt={p.nome} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </button>
              );
            })}
            {!pecasVisiveis.length && (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 30, color: "var(--muted)", fontFamily: "Crimson Pro,serif", fontSize: 14 }}>
                Nenhuma peça encontrada.
              </div>
            )}
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

const btn = (bg, cor) => ({
  padding: "9px 14px", borderRadius: 8, cursor: "pointer", background: bg,
  border: "1px solid var(--border)", color: cor,
  fontFamily: "Cinzel,serif", fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase",
  transition: "all .15s", whiteSpace: "nowrap",
});
