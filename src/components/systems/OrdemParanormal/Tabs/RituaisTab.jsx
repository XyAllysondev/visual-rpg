import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import RichTextEditor from "./shared/RichTextEditor";
import ElementoBadge from "./shared/ElementoBadge";
import {
  fieldLabel, inputS, btnGold, btnGhost, overlayS, BannerHeader, ModalShell,
  tLabel, tCardTitle, tEmpty,
} from "./shared/modalStyles";
import RITUAIS_OFICIAIS from "../../../../data/ordemParanormal/rituais-oficiais.json";
import { circuloMaxNex } from "../rules";
import { sanitizarHtml } from "../../../../lib/sanitizarHtml";

const ELEMENTOS = ["conhecimento", "energia", "morte", "sangue", "medo", "varia"];
const CIRCULOS = [1, 2, 3, 4];
const EXECUCOES = ["Padrão", "Movimento", "Livre", "Completa", "Reação"];
const ALCANCES = ["Pessoal", "Toque", "Curto", "Médio", "Longo", "Ilimitado"];
const HOMEBREW_LIMIT = 50;

/* ═══ Dropdown estilizado (substitui <select> nativo, cujo menu aberto
   não pode ser tematizado — é renderizado pelo SO/navegador) ═══ */
function ThemedSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const norm = options.map((o) => (typeof o === "object" ? o : { value: o, label: String(o) }));
  const current = norm.find((o) => String(o.value) === String(value));

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ ...inputS, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left", textTransform: "capitalize" }}>
        <span>{current?.label ?? value}</span>
        <span style={{ fontSize: 9, color: "var(--el-accent)", marginLeft: 8, flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30,
          background: "#13131a", border: "1px solid var(--el-border)", borderRadius: 6,
          boxShadow: "0 10px 28px rgba(0,0,0,0.6)", maxHeight: 220, overflowY: "auto", padding: 4,
        }}>
          {norm.map((o) => {
            const active = String(o.value) === String(value);
            return (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  padding: "7px 10px", borderRadius: 4, cursor: "pointer", fontSize: 14, textTransform: "capitalize",
                  fontFamily: "Inter,system-ui,sans-serif",
                  color: active ? "#000" : "rgba(232,228,217,0.85)",
                  background: active ? "var(--el-accent)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >{o.label}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ Modal: novo/editar ritual ═══ */
function RitualFormModal({ ritual, onClose, onSave }) {
  const [r, setR] = useState(ritual || {
    nome: "", elemento: "conhecimento", circulo: 1, execucao: "Padrão",
    alcance: "Pessoal", area: "", alvo: "", duracao: "", resistencia: "",
    efeito: "", dados: "", dados_discente: "", dados_verdadeiro: "", descricao: "",
  });
  const set = (k, v) => setR((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const submit = () => {
    if (!r.nome.trim()) return;
    onSave({ id: ritual?.id || Date.now(), ...r, circulo: Number(r.circulo) });
    onClose();
  };

  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

  return (
    <ModalShell title={ritual ? "Editar Ritual" : "Novo Ritual"} onClose={onClose}>
      <label style={fieldLabel}>Nome *</label>
      <input value={r.nome} onChange={(e) => set("nome", e.target.value)} style={inputS} autoFocus placeholder="ex: Cicatrização" />

      <div style={grid2}>
        <div>
          <label style={fieldLabel}>Elemento</label>
          <ThemedSelect value={r.elemento} onChange={(v) => set("elemento", v)} options={ELEMENTOS} />
        </div>
        <div>
          <label style={fieldLabel}>Círculo</label>
          <ThemedSelect value={r.circulo} onChange={(v) => set("circulo", v)} options={CIRCULOS.map((c) => ({ value: c, label: `${c}º Círculo` }))} />
        </div>
        <div>
          <label style={fieldLabel}>Execução</label>
          <ThemedSelect value={r.execucao} onChange={(v) => set("execucao", v)} options={EXECUCOES} />
        </div>
        <div>
          <label style={fieldLabel}>Alcance</label>
          <ThemedSelect value={r.alcance} onChange={(v) => set("alcance", v)} options={ALCANCES} />
        </div>
        <div>
          <label style={fieldLabel}>Área</label>
          <input value={r.area} onChange={(e) => set("area", e.target.value)} style={inputS} placeholder="—" />
        </div>
        <div>
          <label style={fieldLabel}>Alvo</label>
          <input value={r.alvo} onChange={(e) => set("alvo", e.target.value)} style={inputS} placeholder="—" />
        </div>
        <div>
          <label style={fieldLabel}>Duração</label>
          <input value={r.duracao} onChange={(e) => set("duracao", e.target.value)} style={inputS} placeholder="Instantânea" />
        </div>
        <div>
          <label style={fieldLabel}>Resistência</label>
          <input value={r.resistencia} onChange={(e) => set("resistencia", e.target.value)} style={inputS} placeholder="—" />
        </div>
      </div>

      <label style={fieldLabel}>Efeito</label>
      <input value={r.efeito} onChange={(e) => set("efeito", e.target.value)} style={inputS} placeholder="Resumo do efeito" />

      <div style={{ ...grid2, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div><label style={fieldLabel}>Dados</label><input value={r.dados} onChange={(e) => set("dados", e.target.value)} style={inputS} placeholder="1d6" /></div>
        <div><label style={fieldLabel}>Discente</label><input value={r.dados_discente} onChange={(e) => set("dados_discente", e.target.value)} style={inputS} placeholder="2d6" /></div>
        <div><label style={fieldLabel}>Verdadeiro</label><input value={r.dados_verdadeiro} onChange={(e) => set("dados_verdadeiro", e.target.value)} style={inputS} placeholder="3d6" /></div>
      </div>

      <label style={fieldLabel}>Descrição</label>
      <RichTextEditor value={r.descricao} onChange={(v) => set("descricao", v)} minHeight={90} placeholder="Descrição do ritual…" />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={btnGhost}>Cancelar</button>
        <button onClick={submit} style={{ ...btnGold, opacity: r.nome.trim() ? 1 : 0.5 }}>{ritual ? "Salvar" : "Adicionar"}</button>
      </div>
    </ModalShell>
  );
}

/* ═══ Modal: adicionar da biblioteca ═══ */
const BADGE = {
  morte: { b: "#c8c8c8", c: "#c8c8c8", bg: "rgba(200,200,200,0.1)", s: "☽", n: "Morte" },
  sangue: { b: "#cc0000", c: "#ef5350", bg: "rgba(204,0,0,0.1)", s: "✚", n: "Sangue" },
  conhecimento: { b: "#c9a84c", c: "#d4a017", bg: "rgba(201,168,76,0.1)", s: "△", n: "Conhecimento" },
  energia: { b: "#8844cc", c: "#9b59b6", bg: "rgba(136,68,204,0.1)", s: "◇", n: "Energia" },
  medo: { b: "#4466cc", c: "#5b8dd9", bg: "rgba(68,102,204,0.1)", s: "◈", n: "Medo" },
  varia: { b: "#888888", c: "#aaaaaa", bg: "rgba(136,136,136,0.1)", s: "~", n: "Varia" },
};
function RowBadge({ el }) {
  const b = BADGE[el] || BADGE.varia;
  return <span style={{ fontFamily: "var(--font-title,'Cinzel',serif)", fontSize: 10, letterSpacing: "0.08em", borderRadius: 4, padding: "2px 10px", border: `1px solid ${b.b}`, color: b.c, background: b.bg, whiteSpace: "nowrap", flexShrink: 0 }}>{b.s} {b.n}</span>;
}

const FONT_CINZEL = "var(--font-title,'Cinzel',serif)";
const FONT_MONO = "var(--font-data,'Share Tech Mono',monospace)";
const FONT_FELL = "var(--font-body,'IM Fell English',serif)";
const FONT_LORE = "'Crimson Pro', 'IM Fell English', serif"; // serifa legível p/ descrições

const addTabBtn = (active) => ({
  fontFamily: FONT_CINZEL, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
  padding: "6px 16px", borderRadius: 6, cursor: "pointer",
  background: active ? "var(--el-accent)" : "transparent",
  color: active ? "#000" : "rgba(232,228,217,0.6)",
  border: active ? "1px solid var(--el-accent)" : "1px solid rgba(255,255,255,0.15)",
});
const addPill = (active, small) => ({
  fontFamily: FONT_CINZEL, fontSize: small ? 9 : 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
  borderRadius: 20, padding: small ? "3px 12px" : "4px 14px", cursor: "pointer", whiteSpace: "nowrap",
  background: active ? "rgba(201,168,76,0.1)" : "transparent",
  color: active ? "var(--el-accent)" : "rgba(232,228,217,0.4)",
  border: active ? "1px solid var(--el-accent)" : "1px solid rgba(255,255,255,0.1)",
});

function AdicionarRituaisModal({ onClose, onAdd, homebrew, conhecidos, onCreateHomebrew, onDeleteHomebrew }) {
  const [tab, setTab] = useState("oficial");
  const [fEl, setFEl] = useState("todos");
  const [fCirc, setFCirc] = useState("todos");
  const [busca, setBusca] = useState("");
  const [openId, setOpenId] = useState(null);
  const [showNewRitual, setShowNewRitual] = useState(false);
  const rowRefs = useRef({});

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  useEffect(() => {
    if (openId != null) rowRefs.current[openId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openId]);

  const source = tab === "oficial" ? RITUAIS_OFICIAIS : homebrew;
  const list = source.filter((r) =>
    (fEl === "todos" || r.elemento === fEl) &&
    (fCirc === "todos" || r.circulo === Number(fCirc)) &&
    (!busca || r.nome.toLowerCase().includes(busca.toLowerCase()))
  );

  const det = (label, val) => (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "baseline" }}>
      <span style={{ fontFamily: FONT_CINZEL, fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--el-accent)" }}>{label}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: "#e8e4d9" }}>{val || "—"}</span>
    </span>
  );

  return createPortal(
    <div onClick={onClose} style={overlayS}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(680px,100%)", maxHeight: "85vh", background: "#0a0a0f",
        border: "1px solid var(--el-border)", boxShadow: "0 0 40px var(--el-glow)",
        borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        {/* ── FIXED HEADER ── */}
        <div style={{ flexShrink: 0, padding: "20px 22px 14px", borderBottom: "1px solid var(--border2)", display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ fontFamily: "var(--font-display,'Cinzel Decorative',serif)", fontSize: 20, fontWeight: 700, color: "#e8e4d9", letterSpacing: "0.08em", margin: 0 }}>Adicionar Rituais</h3>
            <button onClick={onClose} aria-label="Fechar" style={{ background: "none", border: "none", color: "var(--muted2)", fontSize: 24, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>

          <BannerHeader description="Rituais extraídos do sistema base OP, Culto da Criação, Arquivos Confidenciais, Marcas Fragmentadas e Insurgentes." />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setTab("oficial")} style={addTabBtn(tab === "oficial")}>Rituais</button>
            <button onClick={() => setTab("homebrew")} style={addTabBtn(tab === "homebrew")}>Meus Rituais</button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setFEl("todos")} style={addPill(fEl === "todos")}>Todos</button>
            {ELEMENTOS.map((el) => <button key={el} onClick={() => setFEl(el)} style={addPill(fEl === el)}>{el}</button>)}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setFCirc("todos")} style={addPill(fCirc === "todos", true)}>Todos</button>
            {CIRCULOS.map((c) => <button key={c} onClick={() => setFCirc(String(c))} style={addPill(fCirc === String(c), true)}>{c}º Círculo</button>)}
          </div>

          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ritual…"
            className="op-add-search"
            style={{ fontFamily: FONT_MONO, fontSize: 13, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e4d9", borderRadius: 6, padding: "8px 12px", outline: "none" }} />

          {tab === "homebrew" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "rgba(232,228,217,0.4)" }}>Homebrew {homebrew.length}/{HOMEBREW_LIMIT}</div>
              <button onClick={() => setShowNewRitual(true)} disabled={homebrew.length >= HOMEBREW_LIMIT} style={{ ...addTabBtn(false), opacity: homebrew.length >= HOMEBREW_LIMIT ? 0.4 : 1, cursor: homebrew.length >= HOMEBREW_LIMIT ? "default" : "pointer" }}>+ Criar Ritual</button>
            </div>
          )}
        </div>

        {/* ── SCROLLING LIST ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {list.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <div style={{ fontFamily: FONT_FELL, fontStyle: "italic", fontSize: 14, color: "rgba(232,228,217,0.4)", marginBottom: tab === "homebrew" ? 14 : 0 }}>
                {tab === "homebrew" ? "Nenhum ritual homebrew ainda. Crie um ritual exclusivo do seu personagem." : "Nenhum ritual encontrado."}
              </div>
              {tab === "homebrew" && homebrew.length < HOMEBREW_LIMIT && (
                <button onClick={() => setShowNewRitual(true)} style={addTabBtn(false)}>+ Criar Ritual</button>
              )}
            </div>
          ) : list.map((r) => {
            const open = openId === r.id;
            return (
              <div key={r.id} className="op-add-row" ref={(el) => { rowRefs.current[r.id] = el; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 0, minHeight: 44, padding: "0 16px" }}>
                  <span onClick={() => setOpenId(open ? null : r.id)} style={{ cursor: "pointer", fontSize: 10, color: "rgba(232,228,217,0.3)", marginRight: 12 }}>{open ? "▼" : "▶"}</span>
                  <span onClick={() => setOpenId(open ? null : r.id)} style={{ fontFamily: FONT_CINZEL, fontSize: 13, fontWeight: 500, color: "#e8e4d9", letterSpacing: "0.04em", flex: 1, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome}</span>
                  <RowBadge el={r.elemento} />
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: "rgba(232,228,217,0.4)", width: 24, textAlign: "center", margin: "0 6px" }}>{r.circulo}º</span>
                  {tab === "homebrew" && (
                    <button onClick={() => onDeleteHomebrew(r.id)} title="Excluir ritual" aria-label="Excluir ritual"
                      style={{ fontFamily: FONT_CINZEL, fontSize: 14, fontWeight: 700, width: 32, height: 32, borderRadius: 6, background: "none", color: "var(--danger-text,#d85a5a)", border: "1px solid var(--danger-text,#d85a5a)", cursor: "pointer", flexShrink: 0, marginRight: 6 }}>×</button>
                  )}
                  {/* Ritual já conhecido não pode entrar duas vezes — em vez de
                      um "+" que não faz nada, o botão diz que ele já está lá. */}
                  {conhecidos?.has(r.id) ? (
                    <span title="Já está na ficha" aria-label="Já está na ficha"
                      style={{ fontFamily: FONT_CINZEL, fontSize: 13, fontWeight: 700, width: 32, height: 32, borderRadius: 6, border: "1px solid rgba(74,222,128,0.45)", color: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✓</span>
                  ) : (
                    <button onClick={() => onAdd(r)} title="Adicionar à ficha" className="op-add-plus"
                      style={{ fontFamily: FONT_CINZEL, fontSize: 14, fontWeight: 700, width: 32, height: 32, borderRadius: 6, background: "var(--el-accent)", color: "#000", border: "none", cursor: "pointer", flexShrink: 0 }}>+</button>
                  )}
                </div>
                {open && (
                  <div style={{ padding: "0 16px 12px 40px" }}>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 0 8px" }} />
                    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 5 }}>
                      {det("Execução", r.execucao)}{det("Alcance", r.alcance)}{det("Alvo", r.alvo)}
                    </div>
                    {(r.dados || r.dados_discente || r.dados_verdadeiro) && (
                      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 6 }}>
                        {det("Dados", r.dados)}{det("Discente", r.dados_discente)}{det("Verdadeiro", r.dados_verdadeiro)}
                      </div>
                    )}
                    <div style={{ fontFamily: FONT_LORE, fontSize: 15, color: "rgba(232,228,217,0.88)", lineHeight: 1.65 }}
                      dangerouslySetInnerHTML={{ __html: sanitizarHtml(r.descricao || r.efeito || "") }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {showNewRitual && (
        <RitualFormModal
          onClose={() => setShowNewRitual(false)}
          onSave={(r) => { onCreateHomebrew(r); setShowNewRitual(false); setTab("homebrew"); }}
        />
      )}
    </div>,
    document.body
  );
}

const ROMAN = ["", "I", "II", "III", "IV"];
const EXEC_ICON = { "Padrão": "◈", "Padrão Completo": "◈◈", "Movimento": "↝", "Livre": "◦", "Reação": "⟳", "Completa": "◈◈" };

/* ═══ Card de ritual ═══ */
function RitualCard({ r, onEdit, onRemove, onRoll, overNex, maxCirc }) {
  const [open, setOpen] = useState(false);
  const b = BADGE[r.elemento] || BADGE.varia;
  const circ = ROMAN[r.circulo] || String(r.circulo);
  const execIcon = EXEC_ICON[r.execucao] || "◈";
  const cardRef = useRef(null);

  useEffect(() => {
    if (open) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  const pill = (label, val, color = "var(--muted2)") => val ? (
    <span style={{ fontFamily: FONT_MONO, fontSize: 10, padding: "2px 8px", borderRadius: 12,
      border: `1px solid ${color}40`, background: `${color}10`, color, whiteSpace: "nowrap" }}>
      {label && <span style={{ fontFamily: FONT_CINZEL, fontSize: 8, letterSpacing: "0.08em", marginRight: 4, opacity: 0.7 }}>{label}</span>}
      {val}
    </span>
  ) : null;

  return (
    <div ref={cardRef} className="op-ink" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${b.b}25`, borderRadius: 6, overflow: "hidden", transition: "border-color 0.2s" }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = `${b.b}60`}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = `${b.b}25`}>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <span style={{ fontFamily: FONT_CINZEL, fontSize: 11, fontWeight: 700, width: 22, height: 22, borderRadius: "50%",
          border: `1.5px solid ${b.b}80`, background: b.bg, color: b.c,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {circ}
        </span>

        <span style={{ ...tCardTitle, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome}</span>

        {overNex && (
          <span title={`Seu NEX permite até rituais de ${maxCirc}º círculo. Este é de ${r.circulo}º — mestre pode não liberar.`}
            style={{ fontFamily: FONT_CINZEL, fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 3,
              border: "1px solid #e0803060", background: "rgba(224,128,48,0.12)", color: "#e08030", whiteSpace: "nowrap", flexShrink: 0, cursor: "help" }}>
            ⚠ NEX BAIXO
          </span>
        )}

        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          {r.execucao && (
            <span style={{ fontFamily: FONT_CINZEL, fontSize: 9, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 3,
              border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "var(--muted2)", whiteSpace: "nowrap" }}>
              {execIcon} {r.execucao}
            </span>
          )}
          {r.alcance && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, padding: "2px 6px", borderRadius: 3,
              border: "1px solid rgba(120,160,220,0.25)", background: "rgba(120,160,220,0.06)", color: "#7a9ed4", whiteSpace: "nowrap" }}>
              {r.alcance}
            </span>
          )}
          <ElementoBadge elemento={r.elemento} />
        </div>

        {r.dados && (
          <button onClick={(e) => { e.stopPropagation(); onRoll && onRoll(r.nome, r.dados); }}
            style={{ background: "none", border: `1px solid ${b.b}50`, borderRadius: 3, color: b.c, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>🎲</button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 3, color: "var(--muted)", padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>⚙</button>
        <span style={{ fontSize: 10, color: "var(--muted2)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none", display: "inline-block" }}>▼</span>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${b.b}30`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {pill("Alvo", r.alvo)}
            {pill("Área", r.area)}
            {pill("Duração", r.duracao)}
            {pill("Resistência", r.resistencia, "#e08030")}
          </div>

          {(r.dados || r.dados_discente || r.dados_verdadeiro) && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px",
              background: b.bg, borderRadius: 4, border: `1px solid ${b.b}30`, flexWrap: "wrap" }}>
              <span style={{ fontFamily: FONT_CINZEL, fontSize: 9, letterSpacing: "0.08em", color: b.c, textTransform: "uppercase" }}>Dados</span>
              {r.dados && <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: b.c, fontWeight: 700 }}>{r.dados}</span>}
              {r.dados_discente && <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: "var(--muted2)" }}>Disc: {r.dados_discente}</span>}
              {r.dados_verdadeiro && <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: "var(--muted2)" }}>Verd: {r.dados_verdadeiro}</span>}
              {r.dados && (
                <button onClick={() => onRoll && onRoll(r.nome, r.dados)}
                  style={{ marginLeft: "auto", ...btnGhost, fontSize: 11, padding: "2px 10px", borderColor: `${b.b}50`, color: b.c }}>
                  🎲 Rolar
                </button>
              )}
            </div>
          )}

          {r.efeito && (
            <div style={{ fontFamily: FONT_CINZEL, fontSize: 11, color: "var(--muted2)" }}>
              <span style={{ color: b.c, marginRight: 6 }}>Efeito:</span>{r.efeito}
            </div>
          )}
          {r.descricao && (
            <div className="op-rich-render" style={{ fontFamily: FONT_LORE, fontSize: 14, color: "rgba(232,228,217,0.85)", lineHeight: 1.65, paddingTop: 6, borderTop: "1px solid var(--border)" }}
              dangerouslySetInnerHTML={{ __html: sanitizarHtml(r.descricao) }} />
          )}

          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
            <button onClick={onRemove} style={{ ...btnGhost, fontSize: 11, color: "var(--danger-text,#d85a5a)", borderColor: "var(--danger-text,#d85a5a)" }}>Remover</button>
            <button onClick={onEdit} style={{ ...btnGhost, fontSize: 11 }}>Editar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Tab principal ═══ */
export default function RituaisTab({ rituais, setRituais, dtBase, dtBonus, setDtBonus, onRollDados, nex }) {
  const [busca, setBusca] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const maxCirc = circuloMaxNex(nex);  // maior círculo que o NEX libera — só p/ aviso visual

  const homebrew = rituais.filter((r) => r.is_homebrew);
  const filtered = rituais.filter((r) => r.nome?.toLowerCase().includes(busca.toLowerCase()));

  /* O id OFICIAL do ritual é preservado de propósito: é por ele que o motor de
   * progressão (`progressao/motor.js`) sabe o que este agente já conhece. Ao
   * trocá-lo por um número novo, o mesmo ritual voltava a ser oferecido como
   * pendência e podia entrar duas vezes na ficha — nomes iguais, ids
   * diferentes. Ritual já conhecido não entra de novo. */
  const addRitual = (r) => setRituais((arr) => {
    if (r?.id != null && arr.some((x) => x.id === r.id)) return arr;
    return [...arr, { ...r, id: r?.id ?? Date.now() + Math.random(), is_homebrew: r?.is_homebrew ?? false }];
  });
  const saveRitual = (r) => {
    setRituais((arr) => {
      const idx = arr.findIndex((x) => x.id === r.id);
      if (idx === -1) return [...arr, { ...r, is_homebrew: true }];
      return arr.map((x) => x.id === r.id ? r : x);
    });
  };
  const removeRitual = (id) => setRituais((arr) => arr.filter((x) => x.id !== id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...tLabel, display: "flex", alignItems: "center", gap: 6 }}>
          DT RITUAIS
          {/* Oficial: 10 + NEX/5 + Presença (calculada) + bônus editável */}
          <span title="10 + NEX/5 + Presença + bônus"
            style={{ padding: "4px 8px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "var(--el-accent)", fontFamily: "var(--font-data,'Share Tech Mono',monospace)", fontSize: 13 }}>
            {(dtBase || 0) + (dtBonus || 0)}
          </span>
          BÔNUS
          <input type="number" value={dtBonus} onChange={(e) => setDtBonus(parseInt(e.target.value, 10) || 0)}
            style={{ width: 44, padding: "4px 6px", textAlign: "center", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "var(--text)", fontFamily: "var(--font-data,'Share Tech Mono',monospace)", fontSize: 13 }} />
        </span>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Filtrar…" style={{ ...inputS, flex: 1, minWidth: 120, padding: "6px 10px" }} />
        <button onClick={() => setShowAdd(true)} style={{ ...btnGhost, fontSize: 11, whiteSpace: "nowrap" }}>+ Adicionar</button>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ ...btnGold, padding: "6px 14px", fontSize: 10, whiteSpace: "nowrap" }}>+ Novo Ritual</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...tEmpty, textAlign: "center", padding: "32px 0" }}>
          {rituais.length === 0 ? "Nenhum ritual conhecido. Adicione um da biblioteca ou crie um novo." : "Nenhum ritual encontrado."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((r) => (
            <RitualCard key={r.id} r={r}
              overNex={maxCirc > 0 && Number(r.circulo) > maxCirc}
              maxCirc={maxCirc}
              onEdit={() => { setEditing(r); setShowForm(true); }}
              onRemove={() => removeRitual(r.id)}
              onRoll={onRollDados} />
          ))}
        </div>
      )}

      {showForm && <RitualFormModal ritual={editing} onClose={() => setShowForm(false)} onSave={saveRitual} />}
      {showAdd && <AdicionarRituaisModal onClose={() => setShowAdd(false)} onAdd={addRitual} homebrew={homebrew}
        conhecidos={new Set(rituais.map((r) => r.id))} onCreateHomebrew={saveRitual} onDeleteHomebrew={removeRitual} />}
    </div>
  );
}
