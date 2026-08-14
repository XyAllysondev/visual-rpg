import { useState, useEffect } from "react";
import RichTextEditor from "./shared/RichTextEditor";
import {
  fieldLabel, inputS, btnGold, btnGhost, chip, ModalShell,
  tLabel, tCardTitle, tBody, tStat, tEmpty, tSubtext,
} from "./shared/modalStyles";
import { patenteForPrestigio, cargaMaxima, cargaTeto } from "../rules";
import ITENS_OFICIAIS from "../../../../data/ordemParanormal/itens-oficiais.json";
import { sanitizarHtml } from "../../../../lib/sanitizarHtml";

const TIPOS = [
  { id: "arma", label: "Arma" },
  { id: "municao", label: "Munição" },
  { id: "protecao", label: "Proteção" },
  { id: "geral", label: "Geral" },
  { id: "item_amaldicoado", label: "Item Amald." },
];
const TIPO_LABEL = Object.fromEntries(TIPOS.map((t) => [t.id, t.label]));
const CATEGORIAS = ["0", "I", "II", "III", "IV"];
const HOMEBREW_LIMIT = 50;

const blankItem = (tipo) => ({
  id: Date.now() + Math.random(), nome: "Novo item", tipo,
  proficiencia: "", tipo_arma: "", empunhadura: "", dano: "", dano_secundario: "",
  critico: 20, multiplicador: 2, tipo_dano: "", alcance: "—", categoria: "I",
  espacos: 1, municao: "", melhorias: [], descricao: "", is_equipado: false,
});

/* ═══ Modal: editar item ═══ */
function ItemFormModal({ item, onClose, onSave }) {
  const [it, setIt] = useState({ ...item });
  const set = (k, v) => setIt((p) => ({ ...p, [k]: v }));
  const isArma = it.tipo === "arma";

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const [melhInput, setMelhInput] = useState("");
  const addMelh = () => {
    if (!melhInput.trim()) return;
    set("melhorias", [...(it.melhorias || []), melhInput.trim()]);
    setMelhInput("");
  };

  const grid = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 };
  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

  return (
    <ModalShell title={`Editar ${TIPO_LABEL[it.tipo] || "Item"}`} onClose={onClose}>
      <label style={fieldLabel}>Nome *</label>
      <input value={it.nome} onChange={(e) => set("nome", e.target.value)} style={inputS} autoFocus />

      {isArma ? (
        <>
          <div style={grid2}>
            <div><label style={fieldLabel}>Proficiência</label><input value={it.proficiencia} onChange={(e) => set("proficiencia", e.target.value)} style={inputS} placeholder="Armas Táticas" /></div>
            <div><label style={fieldLabel}>Tipo</label><input value={it.tipo_arma} onChange={(e) => set("tipo_arma", e.target.value)} style={inputS} placeholder="Corpo a Corpo" /></div>
            <div><label style={fieldLabel}>Empunhadura</label><input value={it.empunhadura} onChange={(e) => set("empunhadura", e.target.value)} style={inputS} placeholder="Uma Mão" /></div>
            <div><label style={fieldLabel}>Tipo de Dano</label><input value={it.tipo_dano} onChange={(e) => set("tipo_dano", e.target.value)} style={inputS} placeholder="Corte" /></div>
          </div>
          <div style={grid}>
            <div><label style={fieldLabel}>Dano *</label><input value={it.dano} onChange={(e) => set("dano", e.target.value)} style={inputS} placeholder="1d12" /></div>
            <div><label style={fieldLabel}>Crítico *</label><input type="number" value={it.critico} onChange={(e) => set("critico", parseInt(e.target.value, 10) || 0)} style={inputS} placeholder="20" /></div>
            <div><label style={fieldLabel}>Multiplic. *</label><input type="number" value={it.multiplicador} onChange={(e) => set("multiplicador", parseInt(e.target.value, 10) || 0)} style={inputS} placeholder="2" /></div>
          </div>
          <div style={grid}>
            <div><label style={fieldLabel}>Alcance</label><input value={it.alcance} onChange={(e) => set("alcance", e.target.value)} style={inputS} placeholder="—" /></div>
            <div>
              <label style={fieldLabel}>Categoria</label>
              <select value={it.categoria} onChange={(e) => set("categoria", e.target.value)} style={{ ...inputS, appearance: "auto" }}>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={fieldLabel}>Espaços *</label><input type="number" value={it.espacos} onChange={(e) => set("espacos", parseInt(e.target.value, 10) || 0)} style={inputS} /></div>
          </div>

          <label style={fieldLabel}>Melhorias</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {(it.melhorias || []).map((m, i) => (
              <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 3, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--muted2)", display: "flex", alignItems: "center", gap: 5 }}>
                {m}<button onClick={() => set("melhorias", it.melhorias.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "var(--danger-text)", cursor: "pointer", padding: 0 }}>×</button>
              </span>
            ))}
          </div>
          <input value={melhInput} onChange={(e) => setMelhInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMelh())} placeholder="+ melhoria (Enter)" style={inputS} />
        </>
      ) : (
        <div style={grid2}>
          <div>
            <label style={fieldLabel}>Categoria</label>
            <select value={it.categoria} onChange={(e) => set("categoria", e.target.value)} style={{ ...inputS, appearance: "auto" }}>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={fieldLabel}>Espaços</label><input type="number" value={it.espacos} onChange={(e) => set("espacos", parseInt(e.target.value, 10) || 0)} style={inputS} /></div>
        </div>
      )}

      <label style={fieldLabel}>Descrição</label>
      <RichTextEditor value={it.descricao} onChange={(v) => set("descricao", v)} minHeight={70} />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={btnGhost}>Cancelar</button>
        <button onClick={() => { if (it.nome.trim()) { onSave(it); onClose(); } }} style={btnGold}>Salvar</button>
      </div>
    </ModalShell>
  );
}

/* ── shared item modal styles (explicit colors, no CSS vars) ── */
const IMO = {
  overlay: { position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-end", justifyContent:"center" },
  sheet:   { width:"min(740px,100%)", height:"90vh", background:"#111118", display:"flex", flexDirection:"column", borderRadius:"16px 16px 0 0", border:"1px solid rgba(255,255,255,0.1)", overflow:"hidden" },
  header:  { padding:"16px 20px 12px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 },
  title:   { fontFamily:"'Cinzel Decorative',serif", fontSize:17, color:"#c9a84c", margin:0 },
  close:   { background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:28, cursor:"pointer", lineHeight:1, padding:"0 4px" },
  banner:  { padding:"10px 20px", background:"rgba(255,255,255,0.02)", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 },
  bannerT: { fontFamily:"'Cinzel',serif", fontSize:11, color:"#c9a84c", letterSpacing:"0.1em", marginBottom:3 },
  bannerD: { fontFamily:"Inter,system-ui,sans-serif", fontSize:12, color:"rgba(255,255,255,0.45)", lineHeight:1.5 },
  bannerL: { color:"var(--el-accent,#c6a45c)", textDecoration:"underline", cursor:"pointer" },
  tabRow:  { display:"flex", gap:0, padding:"10px 20px 0", flexShrink:0 },
  tab:     (a) => ({ fontFamily:"Inter,system-ui,sans-serif", fontSize:13, fontWeight:600, padding:"8px 18px", cursor:"pointer", borderRadius:"6px 6px 0 0", background:a?"var(--el-accent,#c6a45c)":"rgba(255,255,255,0.04)", color:a?"#fff":"rgba(255,255,255,0.4)", border:`1px solid ${a?"var(--el-accent,#c6a45c)":"rgba(255,255,255,0.08)"}`, borderBottom:a?"1px solid #111118":"1px solid rgba(255,255,255,0.08)", position:"relative", zIndex:a?2:1 }),
  chipRow: { display:"flex", gap:6, padding:"10px 20px", overflowX:"auto", scrollbarWidth:"none", flexShrink:0, borderBottom:"1px solid rgba(255,255,255,0.06)" },
  chip:    (a) => ({ fontFamily:"Inter,system-ui,sans-serif", fontSize:11, fontWeight:500, padding:"5px 14px", borderRadius:20, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, background:a?"var(--el-accent,#c6a45c)":"rgba(255,255,255,0.06)", color:a?"#fff":"rgba(255,255,255,0.55)", border:`1px solid ${a?"var(--el-accent,#c6a45c)":"rgba(255,255,255,0.1)"}`, transition:"all 0.15s" }),
  search:  { margin:"0 20px 0", position:"relative", flexShrink:0, padding:"10px 0" },
  sInput:  { width:"100%", padding:"9px 14px 9px 36px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#e8e4d9", fontFamily:"Inter,system-ui,sans-serif", fontSize:13, outline:"none", boxSizing:"border-box" },
  list:    { flex:1, overflowY:"auto", padding:"0 20px 20px" },
  row:     { display:"flex", alignItems:"center", gap:10, padding:"12px 0", borderBottom:"1px solid rgba(255,255,255,0.06)", cursor:"pointer" },
  arrow:   { fontSize:11, color:"rgba(255,255,255,0.25)", flexShrink:0, transition:"transform 0.15s", display:"inline-block" },
  name:    { fontFamily:"Inter,system-ui,sans-serif", fontSize:14, fontWeight:500, color:"#e8e4d9", flex:1 },
  sub:     { fontFamily:"Inter,system-ui,sans-serif", fontSize:11, color:"rgba(255,255,255,0.38)", marginTop:2 },
  dano:    { fontFamily:"'Share Tech Mono',monospace", fontSize:12, color:"rgba(198,164,92,0.85)", marginRight:6, flexShrink:0 },
  addBtn:  { width:32, height:32, borderRadius:6, border:"none", background:"var(--el-accent,#c6a45c)", color:"#fff", fontSize:20, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" },
  expand:  { padding:"8px 0 4px", fontFamily:"Inter,system-ui,sans-serif", fontSize:13, color:"rgba(232,228,217,0.65)", lineHeight:1.65 },
  statRow: { display:"flex", gap:10, flexWrap:"wrap", marginBottom:6 },
  stat:    { fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"rgba(198,164,92,0.7)", background:"rgba(198,164,92,0.08)", padding:"2px 7px", borderRadius:3 },
};

/* ═══ Modal: adicionar da biblioteca ═══ */
function AdicionarItensModal({ onClose, onAdd, homebrew }) {
  const [tab, setTab] = useState("oficial");
  const [fTipo, setFTipo] = useState("arma");
  const [busca, setBusca] = useState("");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const source = tab === "oficial" ? ITENS_OFICIAIS : homebrew;
  const list = source.filter((it) =>
    it.tipo === fTipo && (!busca || it.nome.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div style={IMO.overlay} onClick={onClose}>
      <div style={IMO.sheet} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={IMO.header}>
          <h3 style={IMO.title}>Adicionar Itens</h3>
          <button style={IMO.close} onClick={onClose}>×</button>
        </div>

        {/* Banner */}
        <div style={IMO.banner}>
          <div style={IMO.bannerT}>✦ Conteúdo do livro base — material não oficial</div>
          <div style={IMO.bannerD}>
            Conteúdo extraído do sistema base de Ordem Paranormal e de suas expansões oficiais.{" "}
            <a href="https://ordemparanormal.com.br" target="_blank" rel="noreferrer" style={IMO.bannerL}>Veja mais em ordemparanormal.com.br</a>
          </div>
        </div>

        {/* Main tabs */}
        <div style={IMO.tabRow}>
          {[["oficial","Itens"],["homebrew","Meus Itens"]].map(([id,lbl]) => (
            <button key={id} style={IMO.tab(tab===id)} onClick={() => setTab(id)}>{lbl}</button>
          ))}
        </div>

        {/* Tipo chips */}
        <div style={IMO.chipRow}>
          {TIPOS.map(t => (
            <button key={t.id} style={IMO.chip(fTipo===t.id)} onClick={() => setFTipo(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* Search */}
        <div style={IMO.search}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"rgba(255,255,255,0.3)", pointerEvents:"none" }}>🔍</span>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." style={IMO.sInput} />
        </div>

        {/* List */}
        <div style={IMO.list}>
          {tab === "homebrew" && (
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:"rgba(255,255,255,0.35)", marginBottom:10 }}>
              Homebrew: {homebrew.length}/{HOMEBREW_LIMIT}
            </div>
          )}
          {list.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", fontFamily:"Inter,system-ui,sans-serif", fontSize:13, color:"rgba(255,255,255,0.3)", fontStyle:"italic" }}>
              Nenhum item encontrado.
            </div>
          ) : list.map(it => {
            const open = openId === it.id;
            return (
              <div key={it.id}>
                <div style={IMO.row} onClick={() => setOpenId(open ? null : it.id)}>
                  <span style={{ ...IMO.arrow, transform: open ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={IMO.name}>{it.nome}</div>
                    {it.proficiencia && (
                      <div style={IMO.sub}>{[it.proficiencia, it.tipo_arma, it.empunhadura].filter(Boolean).join(" · ")}</div>
                    )}
                  </div>
                  {it.dano && <span style={IMO.dano}>{it.dano}</span>}
                  <button onClick={e => { e.stopPropagation(); onAdd(it); }} style={IMO.addBtn} title="Adicionar à ficha">+</button>
                </div>
                {open && (
                  <div style={{ paddingLeft:22, paddingBottom:8 }}>
                    {it.dano && (
                      <div style={IMO.statRow}>
                        {it.categoria && <span style={IMO.stat}>Cat. {it.categoria}</span>}
                        {it.dano && <span style={IMO.stat}>Dano {it.dano}</span>}
                        {it.critico > 0 && <span style={IMO.stat}>Crít {it.critico}/×{it.multiplicador}</span>}
                        {it.tipo_dano && <span style={IMO.stat}>{it.tipo_dano}</span>}
                        {it.alcance && it.alcance !== "—" && <span style={IMO.stat}>{it.alcance}</span>}
                        {it.espacos > 0 && <span style={IMO.stat}>{it.espacos} espaço{it.espacos !== 1 ? "s" : ""}</span>}
                      </div>
                    )}
                    <div style={IMO.expand}>{it.descricao}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ Card de item ═══ */
function ItemCard({ it, onEdit, onRemove, onToggleEquip, onRollDano }) {
  const [open, setOpen] = useState(false);
  const isArma = it.tipo === "arma";

  return (
    <div className="op-ink" style={{ background: it.is_equipado ? "rgba(201,168,76,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${it.is_equipado ? "var(--el-border)" : "rgba(255,255,255,0.07)"}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <span style={{ fontSize: 11, color: "var(--el-accent)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)", display: "inline-block" }}>▼</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={tCardTitle}>{it.nome}</span>
          {isArma && (it.dano || it.critico) && (
            <span style={{ ...tStat, fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
              {it.dano && `Dano: ${it.dano}`}{it.critico ? ` · Crít: x${it.multiplicador}` : ""}
            </span>
          )}
        </div>
        <label onClick={(e) => e.stopPropagation()} title="Equipado" style={{ display: "flex", cursor: "pointer" }}>
          <input type="checkbox" checked={!!it.is_equipado} onChange={() => onToggleEquip()} style={{ accentColor: "var(--el-accent)", cursor: "pointer" }} />
        </label>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 3, color: "var(--muted)", padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>⚙</button>
      </div>
      {open && (
        <div style={{ borderTop: "1px solid var(--el-border)", padding: "12px 14px" }}>
          {isArma && (
            <>
              <div style={{ ...tSubtext, marginBottom: 6 }}>
                {[it.proficiencia, it.tipo_arma, it.empunhadura].filter(Boolean).join(" · ")}
              </div>
              <div style={{ ...tStat, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--text)", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                {it.categoria && <span>Categoria: {it.categoria}</span>}
                {it.tipo_dano && <span>Tipo: {it.tipo_dano}</span>}
                {it.espacos != null && <span>Espaços: {it.espacos}</span>}
                {it.alcance && it.alcance !== "—" && <span>Alcance: {it.alcance}</span>}
              </div>
            </>
          )}
          {(it.melhorias || []).length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {it.melhorias.map((m, i) => <span key={i} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 3, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--muted2)" }}>{m}</span>)}
            </div>
          )}
          {it.descricao && <div className="op-rich-render" style={tBody} dangerouslySetInnerHTML={{ __html: sanitizarHtml(it.descricao) }} />}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
            <button onClick={onRemove} style={{ ...btnGhost, fontSize: 11, color: "var(--danger-text,#d85a5a)", borderColor: "var(--danger-text,#d85a5a)" }}>Remover</button>
            {isArma && it.dano && <button onClick={() => onRollDano(it.nome, it.dano)} style={{ ...btnGhost, fontSize: 11 }}>🎲 Rolar Dano</button>}
            <button onClick={onEdit} style={{ ...btnGhost, fontSize: 11 }}>Editar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* small inline stat editor */
function InlineNum({ value, onChange, w = 44 }) {
  return <input type="number" value={value} onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
    style={{ width: w, padding: "3px 5px", textAlign: "center", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#e8e4d9", fontFamily: "var(--font-data,'Share Tech Mono',monospace)", fontSize: 13 }} />;
}
/* read-only stat pill — used for values derived from Patente/NEX/Força, not hand-edited */
function StatPill({ value, over }) {
  return <span style={{
    minWidth: 36, padding: "3px 8px", textAlign: "center", display: "inline-block",
    background: over ? "rgba(229,57,53,0.12)" : "rgba(0,0,0,0.4)",
    border: `1px solid ${over ? "#e53935" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 4, color: over ? "#ff6b6b" : "#e8e4d9",
    fontFamily: "var(--font-data,'Share Tech Mono',monospace)", fontSize: 13,
  }}>{value}</span>;
}

/* ═══ Tab principal ═══ */
export default function InventarioTab({ inventario, setInventario, onRollDados, attrs, nex }) {
  const inv = inventario || {};
  const itens = inv.itens || [];
  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const setInv = (patch) => setInventario((p) => ({ ...(p || {}), ...patch }));
  const setItens = (updater) => setInventario((p) => ({ ...(p || {}), itens: typeof updater === "function" ? updater((p || {}).itens || []) : updater }));

  const homebrew = itens.filter((it) => it.is_homebrew);
  const filtered = itens.filter((it) => it.nome?.toLowerCase().includes(busca.toLowerCase()));

  const addItem = (it) => setItens((arr) => [...arr, { ...it, id: Date.now() + Math.random(), is_homebrew: it.is_homebrew ?? false }]);
  /* O item que entra na lista e o item que vai para o modal têm de ser o MESMO
   * objeto: `saveItem` substitui a entrada inteira pelo que o modal devolve, e
   * mandar para lá uma cópia sem `is_homebrew` fazia o item recém-criado sumir
   * de "Meus Itens" assim que era salvo pela primeira vez.
   *
   * O teto de homebrew é o mesmo que a aba de Rituais já aplica — lá o botão de
   * criar desliga ao bater no limite. Aqui o "x/50" era exibido e NUNCA cobrado. */
  const noLimite = homebrew.length >= HOMEBREW_LIMIT;
  const novoItem = (tipo) => {
    if (noLimite) return;
    const it = { ...blankItem(tipo), is_homebrew: true };
    setItens((arr) => [...arr, it]);
    setEditing(it);
  };
  const saveItem = (it) => setItens((arr) => arr.map((x) => x.id === it.id ? it : x));
  const removeItem = (id) => setItens((arr) => arr.filter((x) => x.id !== id));
  const toggleEquip = (id) => setItens((arr) => arr.map((x) => x.id === id ? { ...x, is_equipado: !x.is_equipado } : x));

  /* Patente oficial vem dos Pontos de Prestígio (spec 0006); limites e carga são calculados. */
  const patente = patenteForPrestigio(inv.pontos_prestigio);
  const limites = patente.limiteItens; // [Cat.0, I, II, III, IV] — null = ilimitado
  const itemCategoria = (it) => CATEGORIAS.includes(it.categoria) ? it.categoria : "I";
  const noInv = CATEGORIAS.map((cat) => itens.filter((it) => itemCategoria(it) === cat).length);
  const categoriaOver = limites.some((lim, i) => lim != null && noInv[i] > lim);

  const cargaAtual = itens.reduce((s, it) => s + (Number(it.espacos) || 0), 0);
  const max = cargaMaxima(attrs);

  const statRow = { ...tLabel, display: "flex", alignItems: "center", gap: 8 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* toolbar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Filtrar itens…" style={{ ...inputS, flex: 1, padding: "6px 10px" }} />
        <button onClick={() => setShowAdd(true)} style={{ ...btnGhost, fontSize: 11, whiteSpace: "nowrap" }}>+ Adicionar</button>
      </div>

      {/* stats header */}
      <div className="op-ink" style={{ padding: "12px 14px", background: "rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <div style={statRow}>Pontos de Prestígio <InlineNum value={inv.pontos_prestigio || 0} onChange={(v) => setInv({ pontos_prestigio: v })} /></div>
          <div style={statRow}>Patente <StatPill value={patente.nome} /> <span style={{ ...tSubtext, fontSize: 10 }}>{inv.pontos_prestigio || 0} PP</span></div>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={statRow}>
            Limite de Itens {limites.map((v, i) => <StatPill key={i} value={v == null ? "∞" : v} />)}
            {categoriaOver && <span style={{ fontSize: 9, color: "#e53935", fontFamily: "var(--font-title,'Cinzel',serif)", letterSpacing: "0.06em" }}>LIMITE EXCEDIDO</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={statRow}>No Inventário {noInv.map((v, i) => <StatPill key={i} value={v} over={limites[i] != null && v > limites[i]} />)}</div>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={statRow}>Limite de Crédito <StatPill value={patente.limiteCredito} /></div>
        </div>
        {/* Carga — visual bar */}
        {(() => {
          const teto = cargaTeto(attrs);               // teto absoluto = 2× a carga máxima (oficial)
          const over = cargaAtual > max;               // sobrecarregado (entre max e teto)
          const atStop = cargaAtual > teto;             // acima do teto absoluto: não carrega mais
          const pct = Math.min(100, Math.round((cargaAtual / max) * 100));
          const barColor = atStop ? "#b71c1c" : over ? "#e53935" : pct > 75 ? "#fbc02d" : "#4caf50";
          const cinzel = "var(--font-title,'Cinzel',serif)";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ ...tLabel, fontSize: 9 }}>CARGA</span>
                <span style={{ fontFamily: "var(--font-data,'Share Tech Mono',monospace)", fontSize: 12, color: barColor, display: "flex", alignItems: "center", gap: 4 }}>
                  {cargaAtual} / {max} espaços
                  {atStop
                    ? <span style={{ fontSize: 9, color: "#b71c1c", fontFamily: cinzel, letterSpacing: "0.06em" }}>ACIMA DO TETO</span>
                    : over && <span style={{ fontSize: 9, color: "#e53935", fontFamily: cinzel, letterSpacing: "0.06em" }}>SOBRECARREGADO</span>}
                </span>
              </div>
              <div style={{ height: 6, background: "rgba(0,0,0,0.4)", borderRadius: 3, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}99, ${barColor})`, borderRadius: 3, transition: "width 0.3s ease, background 0.3s ease", boxShadow: `0 0 6px ${barColor}60` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ ...tSubtext, fontSize: 9 }}>Teto absoluto: {teto} espaços (2× o máximo)</span>
                {over && (
                  <span style={{ fontSize: 9, color: atStop ? "#ff8a80" : "#fbc02d", fontFamily: "var(--font-data,'Share Tech Mono',monospace)" }}>
                    {atStop ? "Não pode carregar mais nada" : "−5 Atletismo/Furtividade · −3m deslocamento"}
                  </span>
                )}
              </div>
            </div>
          );
        })()}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid var(--border)", alignItems: "center" }}>
          <span style={{ ...tLabel, fontSize: 9, color: "var(--muted)", marginRight: 4 }}>Novo:</span>
          {TIPOS.map((t) => (
            <button key={t.id} onClick={() => novoItem(t.id)} disabled={noLimite}
              title={noLimite ? `Limite de ${HOMEBREW_LIMIT} itens próprios atingido` : `Criar ${t.label.toLowerCase()}`}
              style={{ ...chip(false), fontSize: 10, opacity: noLimite ? 0.4 : 1, cursor: noLimite ? "not-allowed" : "pointer" }}>
              {t.label}
            </button>
          ))}
          <span style={{ ...tSubtext, fontSize: 9, marginLeft: "auto", color: noLimite ? "#e53935" : "var(--muted)" }}>
            {homebrew.length}/{HOMEBREW_LIMIT} próprios
          </span>
        </div>
      </div>

      {/* lista */}
      {filtered.length === 0 ? (
        <div style={{ ...tEmpty, textAlign: "center", padding: "24px 0" }}>
          {itens.length === 0 ? "Inventário vazio. Adicione itens acima." : "Nenhum item encontrado."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((it) => (
            <ItemCard key={it.id} it={it}
              onEdit={() => setEditing(it)}
              onRemove={() => removeItem(it.id)}
              onToggleEquip={() => toggleEquip(it.id)}
              onRollDano={onRollDados} />
          ))}
        </div>
      )}

      {editing && <ItemFormModal item={editing} onClose={() => setEditing(null)} onSave={saveItem} />}
      {showAdd && <AdicionarItensModal onClose={() => setShowAdd(false)} onAdd={addItem} homebrew={homebrew} />}
    </div>
  );
}
