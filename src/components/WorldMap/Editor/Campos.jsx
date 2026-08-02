/* ════════════════════════════════════════════════════════════════════
 *  EDITOR DO GRAFO — CAMPOS DE FORMULÁRIO  (spec 0028 · F2 · AC-4)
 *  --------------------------------------------------------------------
 *  Os painéis do nó e da trilha pedem quinze campos entre os dois. Sem uma
 *  peça comum, cada um repetiria `<label htmlFor>`, o texto de ajuda e o
 *  `aria-describedby` — e é sempre o `aria-describedby` que se perde na
 *  cópia. Aqui ele é estrutural: quem passa `dica` ganha a ligação.
 *
 *  Estilo: reusa `campoStyle` do ateliê (ADR-0004, inline + CSS vars). Não
 *  há um segundo sistema de formulário no módulo.
 * ════════════════════════════════════════════════════════════════════ */

import { SP, R, FF, FS, FW, T, HIT, LINE, campoStyle } from "../Atelier/ui";

/**
 * Rótulo + campo + ajuda, com o `aria-describedby` já ligado.
 *
 * @param {object} props
 * @param {string} props.id id do controle (o `children` deve usá-lo).
 * @param {string} props.label
 * @param {string} [props.dica] texto de ajuda, ligado por `aria-describedby`.
 * @param {(idDaDica:string|undefined)=>React.ReactNode} props.children
 */
export function Campo({ id, label, dica, children }) {
  const idDaDica = dica ? `${id}-dica` : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.x1 }}>
      <label htmlFor={id} style={{ ...T.section, fontSize: 10 }}>{label}</label>
      {children(idDaDica)}
      {dica ? (
        <div id={idDaDica} style={{ ...T.meta, fontSize: FS.micro }}>{dica}</div>
      ) : null}
    </div>
  );
}

/** Campo de uma linha. */
export function Texto({ id, label, dica, valor, aoMudar, placeholder, maxLength = 120 }) {
  return (
    <Campo id={id} label={label} dica={dica}>
      {(idDaDica) => (
        <input
          id={id}
          className="wme-focus"
          value={valor ?? ""}
          onChange={(e) => aoMudar(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-describedby={idDaDica}
          style={{ ...campoStyle(false), fontSize: FS.body }}
        />
      )}
    </Campo>
  );
}

/** Campo de várias linhas. */
export function AreaDeTexto({ id, label, dica, valor, aoMudar, placeholder, linhas = 4, maxLength = 1200, perigoso }) {
  return (
    <Campo id={id} label={label} dica={dica}>
      {(idDaDica) => (
        <textarea
          id={id}
          className="wme-focus"
          value={valor ?? ""}
          onChange={(e) => aoMudar(e.target.value)}
          placeholder={placeholder}
          rows={linhas}
          maxLength={maxLength}
          aria-describedby={idDaDica}
          style={{
            ...campoStyle(false),
            minHeight: 22 * linhas,
            padding: SP.x3,
            lineHeight: 1.6,
            resize: "vertical",
            fontFamily: FF.ui,
            fontSize: FS.body,
            /* O campo de segredo tem cara de segredo: quem bate o olho no
               painel sabe o que não pode chegar ao jogador (AC-1/AC-4). */
            ...(perigoso ? {
              background: "rgba(138,122,214,0.10)",
              border: "1px solid rgba(138,122,214,0.45)",
            } : null),
          }}
        />
      )}
    </Campo>
  );
}

/** Campo numérico. `valor` vazio vira `null` — "não definido" não é zero. */
export function Numero({ id, label, dica, valor, aoMudar, min = 0, max, passo = 1, placeholder, sufixo }) {
  return (
    <Campo id={id} label={label} dica={dica}>
      {(idDaDica) => (
        <div style={{ display: "flex", alignItems: "center", gap: SP.x2 }}>
          <input
            id={id}
            type="number"
            className="wme-focus"
            value={valor === null || valor === undefined ? "" : valor}
            onChange={(e) => {
              const bruto = e.target.value;
              if (bruto === "") { aoMudar(null); return; }
              const n = Number(bruto);
              aoMudar(Number.isFinite(n) ? n : null);
            }}
            min={min}
            max={max}
            step={passo}
            placeholder={placeholder}
            aria-describedby={idDaDica}
            style={{ ...campoStyle(false), fontSize: FS.body, maxWidth: 160 }}
          />
          {sufixo ? <span style={{ ...T.meta }}>{sufixo}</span> : null}
        </div>
      )}
    </Campo>
  );
}

/** Escolha entre opções `{ value, label }`. */
export function Escolha({ id, label, dica, valor, aoMudar, opcoes = [] }) {
  return (
    <Campo id={id} label={label} dica={dica}>
      {(idDaDica) => (
        <select
          id={id}
          className="wme-focus"
          value={valor ?? ""}
          onChange={(e) => aoMudar(e.target.value)}
          aria-describedby={idDaDica}
          style={{ ...campoStyle(false), fontSize: FS.body, cursor: "pointer" }}
        >
          {opcoes.map((o) => (
            <option key={String(o.value)} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </Campo>
  );
}

/**
 * Sim/não. É `<input type="checkbox">` dentro de um `<label>`, e não um
 * `div role="switch"` improvisado: o controle nativo já vem com teclado,
 * estado e semântica corretos de graça.
 */
export function Interruptor({ id, label, dica, marcado, aoMudar, destaque }) {
  const idDaDica = dica ? `${id}-dica` : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.x1 }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: SP.x3,
          minHeight: HIT.mobile,
          padding: `0 ${SP.x3}px`,
          borderRadius: R.ctl,
          cursor: "pointer",
          border: `1px solid ${destaque && marcado ? "rgba(138,122,214,0.55)" : LINE.raise}`,
          background: destaque && marcado ? "rgba(138,122,214,0.12)" : "rgba(255,255,255,0.03)",
        }}
      >
        <input
          id={id}
          type="checkbox"
          className="wme-focus"
          checked={!!marcado}
          onChange={(e) => aoMudar(e.target.checked)}
          aria-describedby={idDaDica}
          style={{ width: 18, height: 18, accentColor: "var(--gold)", cursor: "pointer" }}
        />
        <span style={{ fontFamily: FF.ui, fontSize: FS.body, fontWeight: FW.med, color: "var(--text)" }}>
          {label}
        </span>
      </label>
      {dica ? (
        <div id={idDaDica} style={{ ...T.meta, fontSize: FS.micro }}>{dica}</div>
      ) : null}
    </div>
  );
}

/** Título de bloco dentro de um painel. */
export function Bloco({ titulo, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.x3 }}>
      <div style={{ ...T.section, borderBottom: `1px solid ${LINE.hair}`, paddingBottom: SP.x1 }}>
        {titulo}
      </div>
      {children}
    </div>
  );
}
