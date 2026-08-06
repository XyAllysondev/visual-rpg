import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import RichTextEditor from "./shared/RichTextEditor";
import {
  overlayS, modalTitle, fieldLabel, inputS, btnGold, btnGhost,
  tCardTitle, tBody, tStat, tEmpty, FONT,
} from "./shared/modalStyles";
import { CLASS_POWERS, CLASS_TRAILS, TRAIL_ABILITIES, CLASSES_OP } from "../rules";
import PODERES_PARANORMAIS from "../../../../data/ordemParanormal/poderes-paranormais.json";

/* ── image downscale ── */
const downscale = (file, max = 360) => new Promise((res) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.78));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

/* ── style tokens ── */
const S = {
  modal: {
    position: "fixed", inset: 0, zIndex: 200,
    background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    width: "min(740px, 100%)", height: "90vh",
    background: "#111118", display: "flex", flexDirection: "column",
    borderRadius: "16px 16px 0 0", border: "1px solid rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  header: {
    padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  closeBtn: {
    background: "none", border: "none", color: "rgba(255,255,255,0.5)",
    fontSize: 28, cursor: "pointer", lineHeight: 1, padding: "0 4px",
  },
  banner: {
    padding: "12px 20px", background: "rgba(255,255,255,0.02)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  bannerImgs: { display: "flex", gap: 10, marginBottom: 8 },
  bannerThumb: { width: 72, height: 48, objectFit: "cover", borderRadius: 4, background: "rgba(255,255,255,0.05)" },
  bannerText: { fontFamily: "Inter,system-ui,sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 },
  bannerLink: { color: "var(--el-accent,#c6a45c)", textDecoration: "underline", cursor: "pointer" },
  mainTabRow: { display: "flex", gap: 0, padding: "10px 20px 0" },
  mainTab: (active) => ({
    fontFamily: "Inter,system-ui,sans-serif", fontSize: 13, fontWeight: 600,
    padding: "8px 18px", cursor: "pointer", borderRadius: "6px 6px 0 0",
    background: active ? "var(--el-accent,#c6a45c)" : "rgba(255,255,255,0.04)",
    color: active ? "#fff" : "rgba(255,255,255,0.45)",
    border: `1px solid ${active ? "var(--el-accent,#c6a45c)" : "rgba(255,255,255,0.08)"}`,
    borderBottom: active ? "1px solid #111118" : "1px solid rgba(255,255,255,0.08)",
    marginBottom: active ? -1 : 0, position: "relative", zIndex: active ? 2 : 1,
  }),
  catRow: {
    display: "flex", gap: 4, padding: "12px 20px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)", overflowX: "auto",
    scrollbarWidth: "none",
  },
  catTab: (active) => ({
    fontFamily: "Inter,system-ui,sans-serif", fontSize: 12, fontWeight: 500,
    padding: "6px 14px 10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
    background: "none", border: "none",
    color: active ? "#fff" : "rgba(255,255,255,0.4)",
    borderBottom: `2px solid ${active ? "var(--el-accent,#c6a45c)" : "transparent"}`,
    transition: "all 0.15s",
  }),
  chipRow: {
    display: "flex", gap: 6, padding: "10px 20px",
    overflowX: "auto", scrollbarWidth: "none", flexShrink: 0,
  },
  chip: (active) => ({
    fontFamily: "Inter,system-ui,sans-serif", fontSize: 11, fontWeight: 500,
    padding: "5px 12px", borderRadius: 20, cursor: "pointer", whiteSpace: "nowrap",
    flexShrink: 0,
    background: active ? "var(--el-accent,#c6a45c)" : "rgba(255,255,255,0.06)",
    color: active ? "#fff" : "rgba(255,255,255,0.55)",
    border: `1px solid ${active ? "var(--el-accent,#c6a45c)" : "rgba(255,255,255,0.1)"}`,
    transition: "all 0.15s",
  }),
  searchWrap: { padding: "0 20px 10px" },
  searchInput: {
    width: "100%", padding: "9px 14px 9px 38px", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
    color: "#fff", fontFamily: "Inter,system-ui,sans-serif", fontSize: 13, boxSizing: "border-box",
    outline: "none",
  },
  list: { flex: 1, overflowY: "auto", padding: "0 20px 20px" },
  abilityRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "14px 4px", borderBottom: "1px solid rgba(255,255,255,0.07)", cursor: "pointer",
    transition: "background 0.15s",
  },
  abilityName: {
    fontFamily: "Inter,system-ui,sans-serif", fontSize: 14, fontWeight: 600,
    color: "#e8e4d9", flex: 1, letterSpacing: "0.01em",
  },
  abilityCost: {
    fontFamily: "'Share Tech Mono',monospace", fontSize: 11,
    color: "rgba(198,164,92,0.8)", marginRight: 8,
  },
  addBtn: {
    width: 38, height: 38, borderRadius: 8, border: "none",
    background: "var(--el-accent,#c6a45c)", color: "#fff",
    fontSize: 22, fontWeight: 300, cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "opacity 0.15s, transform 0.1s",
  },
  expandDesc: {
    fontFamily: "Inter,system-ui,sans-serif", fontSize: 13, lineHeight: 1.65,
    color: "rgba(232,228,217,0.7)", padding: "8px 0 4px",
  },
};

/* ═══ Banner with book thumbnails ═══ */
const BOOK_COVERS = [
  { alt: "Ordem Paranormal", bg: "#2a0a3a" },
  { alt: "Arquivos Confidenciais", bg: "#1a2a0a" },
  { alt: "Marcas Fragmentadas", bg: "#2a1a0a" },
  { alt: "Insurgentes", bg: "#0a1a2a" },
];

function BookBanner() {
  return (
    <div style={S.banner}>
      <div style={S.bannerImgs}>
        {BOOK_COVERS.map(b => (
          <div key={b.alt} style={{ ...S.bannerThumb, background: b.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontFamily: FONT.cinzel, fontSize: 8, color: "rgba(255,255,255,0.5)", textAlign:"center", padding: 4 }}>{b.alt}</span>
          </div>
        ))}
      </div>
      <div style={S.bannerText}>
        Conteúdo do livro base de Ordem Paranormal — material não oficial. Veja mais{" "}
        <a href="https://ordemparanormal.com.br" target="_blank" rel="noreferrer" style={S.bannerLink}>aqui</a>
      </div>
    </div>
  );
}

/* ═══ Ability expandable row ═══ */
function AbilityRow({ name, cost, desc, onAdd, added }) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef(null);

  useEffect(() => {
    if (open) rowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  return (
    <div ref={rowRef}>
      <div style={S.abilityRow} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", transition:"transform 0.2s", display:"inline-block", transform: open ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
        <span style={S.abilityName}>{name}</span>
        {cost && cost !== "—" && <span style={S.abilityCost}>{cost}</span>}
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          style={{ ...S.addBtn, opacity: added ? 0.4 : 1 }}
          title={added ? "Já adicionado" : "Adicionar à ficha"}
        >+</button>
      </div>
      {open && <div style={S.expandDesc}>{desc}</div>}
    </div>
  );
}

/* ═══ MAIN MODAL: Adicionar Habilidades ═══ */
const CATS = [
  { id: "combatente",          label: "Combatente" },
  { id: "especialista",        label: "Especialista" },
  { id: "ocultista",           label: "Ocultista" },
  { id: "origens",             label: "Origens" },
  { id: "poderes_paranormais", label: "Poderes Paranormais" },
];

function AdicionarHabilidadesModal({ onClose, onAdd, habilidades, nex, classe }) {
  const [mainTab, setMainTab] = useState("habilidades");
  const [cat, setCat] = useState(classe?.id || "combatente");
  const [chip, setChip] = useState("__base__");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  useEffect(() => { setChip(cat === "poderes_paranormais" ? "geral" : "__base__"); setSearch(""); }, [cat]);

  /* build chips for selected category */
  const isOrigens = cat === "origens";
  const isPoderes = cat === "poderes_paranormais";
  const ELEM_CHIPS = [
    { id: "geral", label: "Gerais" }, { id: "conhecimento", label: "Conhecimento" },
    { id: "energia", label: "Energia" }, { id: "morte", label: "Morte" }, { id: "sangue", label: "Sangue" },
  ];
  const trails = (!isOrigens && !isPoderes) ? (CLASS_TRAILS[cat] || []) : [];
  const chips = isOrigens
    ? []
    : isPoderes
    ? ELEM_CHIPS
    : [{ id: "__base__", label: `Poderes de ${CLASSES_OP.find(c => c.id === cat)?.name || cat}` }, ...trails.map(t => ({ id: t.id, label: t.name }))];

  /* build ability list for selected chip */
  const abilities = (() => {
    if (isOrigens) return [];
    if (isPoderes) {
      /* Poderes Paranormais do livro v1.4 (spec 0026) — obtidos via Transcender. */
      return PODERES_PARANORMAIS.filter(p => p.elemento === chip).map(p => ({
        id: p.id,
        name: p.nome,
        cost: "—",
        desc: `${p.prereq && p.prereq !== "—" ? `Pré-requisito: ${p.prereq}. ` : ""}${p.descricao}${p.afinidade ? ` — Afinidade: ${p.afinidade}` : ""}`,
      }));
    }
    if (chip === "__base__") return CLASS_POWERS[cat] || [];
    const ta = TRAIL_ABILITIES[chip];
    if (!ta) return [];
    return [10, 40, 65, 99].map(n => ta[n] ? { id: `${chip}_${n}`, name: ta[n].name, cost: ta[n].cost, desc: ta[n].desc, nexReq: n } : null).filter(Boolean);
  })();

  const filtered = abilities.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.desc.toLowerCase().includes(search.toLowerCase()));

  const isAdded = (name) => habilidades.some(h => h.nome === name);

  return createPortal(
    <div style={S.modal} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={S.header}>
          <h3 style={{ ...modalTitle, fontSize: 17 }}>Adicionar Habilidades</h3>
          <button style={S.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* ── Book banner ── */}
        <BookBanner />

        {/* ── Main tabs ── */}
        <div style={S.mainTabRow}>
          {[["habilidades","Habilidades"],["minhas","Minhas Habilidades"]].map(([id,lbl]) => (
            <button key={id} style={S.mainTab(mainTab===id)} onClick={() => setMainTab(id)}>{lbl}</button>
          ))}
        </div>

        {/* ── Official content (Habilidades tab) ── */}
        {mainTab === "habilidades" && (
          <>
            {/* Category tabs */}
            <div style={S.catRow}>
              {CATS.map(c => (
                <button key={c.id} style={S.catTab(cat===c.id)} onClick={() => setCat(c.id)}>{c.label}</button>
              ))}
            </div>

            {/* Chips */}
            {chips.length > 0 && (
              <div style={S.chipRow}>
                {chips.map(ch => (
                  <button key={ch.id} style={S.chip(chip===ch.id)} onClick={() => setChip(ch.id)}>{ch.label}</button>
                ))}
              </div>
            )}

            {/* Search */}
            <div style={{ ...S.searchWrap, position: "relative" }}>
              <span style={{ position:"absolute", left: 34, top:"50%", transform:"translateY(-50%)", fontSize: 14, color: "rgba(255,255,255,0.3)" }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar" style={S.searchInput} />
            </div>

            {/* Ability list */}
            <div style={S.list}>
              {cat === "origens" ? (
                <div style={{ ...tEmpty, textAlign:"center", padding: "40px 0", fontFamily:"Inter,system-ui,sans-serif", fontSize: 13 }}>
                  Origens são configuradas na aba Descrição.
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ ...tEmpty, textAlign:"center", padding: "40px 0", fontFamily:"Inter,system-ui,sans-serif", fontSize: 13 }}>
                  {search ? "Nenhuma habilidade encontrada." : "Nenhuma habilidade disponível para este filtro."}
                </div>
              ) : (
                filtered.map(a => (
                  <div key={a.id}>
                    {a.nexReq && nex < a.nexReq && (
                      <div style={{ display:"flex", alignItems:"center", gap: 6, padding:"4px 0 0" }}>
                        <span style={{ ...tStat, fontSize: 10, background:"rgba(255,100,100,0.1)", color:"rgba(255,100,100,0.7)", padding:"2px 6px", borderRadius: 3 }}>NEX {a.nexReq}% necessário</span>
                      </div>
                    )}
                    <AbilityRow
                      name={a.nexReq ? `NEX ${a.nexReq}% — ${a.name}` : a.name}
                      cost={a.cost}
                      desc={a.desc}
                      added={isAdded(a.name)}
                      onAdd={() => onAdd({
                        id: Date.now() + Math.random(),
                        nome: a.name,
                        descricao: a.cost && a.cost !== "—" ? `<b>Custo:</b> ${a.cost}<br><br>${a.desc}` : a.desc,
                        dados: "",
                        imagem_url: "",
                      })}
                    />
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── Minhas Habilidades ── */}
        {mainTab === "minhas" && (
          <div style={S.list}>
            {habilidades.length === 0 ? (
              <div style={{ ...tEmpty, textAlign:"center", padding: "40px 0", fontFamily:"Inter,system-ui,sans-serif", fontSize: 13 }}>
                Nenhuma habilidade adicionada ainda.
              </div>
            ) : (
              habilidades.map((h, i) => (
                <div key={h.id || i} style={{ ...S.abilityRow, cursor:"default" }}>
                  <span style={S.abilityName}>{h.nome}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ═══ Modal: nova habilidade personalizada ═══ */
function NovaHabilidadeModal({ onClose, onAdd }) {
  const [nome, setNome] = useState("");
  const [desc, setDesc] = useState("");
  const [dados, setDados] = useState("");
  const [img, setImg] = useState("");
  const fileRef = useRef();

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const onImgFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImg(await downscale(file));
  };

  const submit = () => {
    if (!nome.trim()) return;
    onAdd({ id: Date.now(), nome: nome.trim(), descricao: desc, dados, imagem_url: img });
    onClose();
  };

  return createPortal(
    <div onClick={onClose} style={{ ...overlayS, zIndex: 250 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width:"min(560px,100%)", maxHeight:"88vh", overflow:"auto", padding: 22, background:"#0d0d14", border:"1px solid var(--el-border)", boxShadow:"0 0 40px var(--el-glow)", borderRadius: 10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 12 }}>
          <h3 style={{ ...modalTitle, fontSize: 16 }}>Nova Habilidade</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize: 24, cursor:"pointer" }}>×</button>
        </div>
        <label style={fieldLabel}>Nome *</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} style={inputS} placeholder="Nome da habilidade" autoFocus />
        <label style={fieldLabel}>Imagem (opcional)</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={onImgFile} style={{ display:"none" }} />
        <div onClick={() => fileRef.current?.click()} style={{ height: 80, border:"1px dashed rgba(255,255,255,0.12)", borderRadius: 6, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", overflow:"hidden", background:"rgba(0,0,0,0.3)", marginBottom: 4 }}>
          {img ? <img src={img} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ color:"rgba(255,255,255,0.25)", fontSize: 13 }}>📷 clique para enviar</span>}
        </div>
        <label style={fieldLabel}>Descrição</label>
        <RichTextEditor value={desc} onChange={setDesc} placeholder="Descreva a habilidade…" minHeight={80} />
        <label style={fieldLabel}>Dados (opcional)</label>
        <input value={dados} onChange={(e) => setDados(e.target.value)} style={inputS} placeholder="ex: 1d10+2d6" />
        <div style={{ display:"flex", justifyContent:"flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
          <button onClick={submit} style={{ ...btnGold, opacity: nome.trim() ? 1 : 0.5 }}>Adicionar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══ Card de habilidade ═══ */
function HabilidadeCard({ hab, onEdit, onRemove, onRoll }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...hab });
  const save = () => { onEdit(draft); setEditing(false); };
  const cardRef = useRef(null);

  useEffect(() => {
    if (open) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  return (
    <div ref={cardRef} style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius: 8, overflow:"hidden", transition:"border-color 0.2s", marginBottom: 6 }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--el-border)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}>
      <div style={{ display:"flex", alignItems:"center", gap: 8, padding:"11px 14px", cursor:"pointer" }} onClick={() => !editing && setOpen(v => !v)}>
        <span style={{ fontSize: 11, color:"var(--el-accent)", transition:"transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)", display:"inline-block" }}>▼</span>
        <span style={{ ...tCardTitle, flex: 1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:"Inter,system-ui,sans-serif", fontSize: 14 }}>{hab.nome}</span>
        {hab.dados && (
          <button onClick={(e) => { e.stopPropagation(); onRoll && onRoll(hab.nome, hab.dados); }}
            style={{ background:"none", border:"1px solid var(--border)", borderRadius: 4, color:"var(--el-accent)", padding:"4px 8px", cursor:"pointer", fontSize: 12 }}>🎲</button>
        )}
        <button onClick={(e) => { e.stopPropagation(); setEditing(true); setOpen(true); }}
          style={{ background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius: 4, color:"rgba(255,255,255,0.4)", padding:"4px 8px", cursor:"pointer", fontSize: 11 }}>⚙</button>
      </div>

      {open && (
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"12px 14px" }}>
          {editing ? (
            <div style={{ display:"flex", flexDirection:"column", gap: 8 }}>
              <input value={draft.nome} onChange={(e) => setDraft(d => ({ ...d, nome: e.target.value }))} style={inputS} />
              <label style={fieldLabel}>Dados</label>
              <input value={draft.dados} onChange={(e) => setDraft(d => ({ ...d, dados: e.target.value }))} style={inputS} placeholder="ex: 1d10+2d6" />
              <label style={fieldLabel}>Descrição</label>
              <RichTextEditor value={draft.descricao} onChange={(v) => setDraft(d => ({ ...d, descricao: v }))} minHeight={80} />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop: 6 }}>
                <button onClick={() => onRemove()} style={{ ...btnGhost, fontSize: 11, color:"#d85a5a", borderColor:"#d85a5a" }}>Remover</button>
                <div style={{ display:"flex", gap: 8 }}>
                  <button onClick={() => setEditing(false)} style={btnGhost}>Cancelar</button>
                  <button onClick={save} style={btnGold}>Salvar</button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {hab.imagem_url && <img src={hab.imagem_url} alt="" style={{ width:"100%", maxHeight: 150, objectFit:"cover", borderRadius: 4, marginBottom: 10 }} />}
              {hab.descricao ? (
                <div className="op-rich-render" style={{ ...tBody, fontFamily:"Inter,system-ui,sans-serif", fontSize: 14, fontStyle:"normal", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: hab.descricao }} />
              ) : (
                <div style={{ ...tEmpty, fontFamily:"Inter,system-ui,sans-serif", fontSize: 13 }}>Sem descrição.</div>
              )}
              {hab.dados && (
                <div style={{ marginTop: 10, display:"flex", alignItems:"center", gap: 10, paddingTop: 8, borderTop:"1px solid var(--border)" }}>
                  <span style={tStat}>{hab.dados}</span>
                  <button onClick={() => onRoll && onRoll(hab.nome, hab.dados)} style={{ ...btnGhost, fontSize: 11, padding:"4px 12px" }}>🎲 Rolar</button>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"flex-end", gap: 8, marginTop: 10, paddingTop: 8, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={() => onRemove()} style={{ ...btnGhost, fontSize: 11, color:"#d85a5a", borderColor:"#d85a5a" }}>Remover</button>
                <button onClick={() => setEditing(true)} style={{ ...btnGhost, fontSize: 11 }}>Editar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ Tab principal ═══ */
export default function HabilidadesTab({ habilidades, setHabilidades, onRollDados, nex, classe }) {
  const [filter, setFilter] = useState("");
  const [showAdicionar, setShowAdicionar] = useState(false);
  const [showNova, setShowNova] = useState(false);

  const filtered = habilidades.filter((h) => h.nome?.toLowerCase().includes(filter.toLowerCase()));

  const addHab = (hab) => setHabilidades((arr) => [...arr, hab]);
  const editHab = (idx, patch) => setHabilidades((arr) => arr.map((h, i) => i === idx ? { ...h, ...patch } : h));
  const removeHab = (idx) => setHabilidades((arr) => arr.filter((_, i) => i !== idx));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap: 10 }}>
      {/* toolbar */}
      <div style={{ display:"flex", gap: 8, alignItems:"center", flexWrap:"wrap" }}>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="🔍 Filtrar habilidades…"
          style={{ ...inputS, flex: 1, minWidth: 120, padding:"7px 10px", fontFamily:"Inter,system-ui,sans-serif", fontSize: 13 }} />
        <button onClick={() => setShowNova(true)} style={{ ...btnGhost, padding:"7px 14px", fontSize: 11, whiteSpace:"nowrap" }}>+ Nova</button>
        <button onClick={() => setShowAdicionar(true)} style={{ ...btnGold, padding:"7px 14px", fontSize: 11, whiteSpace:"nowrap" }}>+ Adicionar</button>
      </div>

      {/* lista */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"32px 0", fontFamily:"Inter,system-ui,sans-serif", fontSize: 13, color:"rgba(232,228,217,0.3)", fontStyle:"italic" }}>
          {habilidades.length === 0 ? "Nenhuma habilidade. Use + Adicionar para buscar poderes da classe." : "Nenhuma habilidade encontrada."}
        </div>
      ) : (
        filtered.map((h, fi) => {
          const realIdx = habilidades.indexOf(h);
          return (
            <HabilidadeCard key={h.id || fi} hab={h}
              onEdit={(patch) => editHab(realIdx, patch)}
              onRemove={() => removeHab(realIdx)}
              onRoll={onRollDados}
            />
          );
        })
      )}

      {showAdicionar && (
        <AdicionarHabilidadesModal
          onClose={() => setShowAdicionar(false)}
          onAdd={(h) => { addHab(h); }}
          habilidades={habilidades}
          nex={nex ?? 5}
          classe={classe}
        />
      )}
      {showNova && <NovaHabilidadeModal onClose={() => setShowNova(false)} onAdd={addHab} />}
    </div>
  );
}
