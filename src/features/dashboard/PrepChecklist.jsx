/* ═══════════════════════════════
   PREPARO DO MUNDO — checklist que envelhece bem
═══════════════════════════════ */
/* Porte enxuto do `PassoItem` da Forja (`MasterSuite/Dashboard`) para a
 * gramática `.nx-*`. O que veio junto: círculo de 18px, texto riscado quando
 * feito, `→` só quando o passo é clicável.
 *
 * O que NÃO veio, de propósito:
 *   · barra de progresso — "3/4" já é a barra, em quatro caracteres;
 *   · `SoonBadge` — passo que não dá para fazer não é passo, é anúncio.
 *
 * Quatro passos na ordem do mestre: mundo na Forja → mapa → campanha → ficha.
 * Completos os quatro, o bloco some PARA SEMPRE (`nexus_prep_done`). Painel que
 * ainda ensina o básico ao usuário de seis meses envelheceu mal. */

export const CHAVE_PREP_DONE = "nexus_prep_done";

function PrepChecklist({ passos = [], concluido = false, onNav }) {
  if (concluido || passos.length === 0) return null;

  const feitos = passos.filter(p => p.done).length;
  if (feitos >= passos.length) {
    /* Rede de segurança: se o hook ainda não gravou a marca (primeira renderização
       depois do quarto passo), grava aqui — some agora e não volta. */
    try { localStorage.setItem(CHAVE_PREP_DONE, "1"); } catch { /* modo privado */ }
    return null;
  }

  return (
    <section aria-labelledby="nx-preparo">
      <div className="nx-sec">
        <span className="nx-sec-t" id="nx-preparo">Preparo do mundo</span>
        <span className="nx-sec-a" style={{ cursor: "default" }}>{feitos}/{passos.length}</span>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {passos.map(p => {
          const clicavel = !p.done && !!p.nav;
          const miolo = (
            <>
              <span aria-hidden="true" style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, lineHeight: 1,
                background: p.done ? "var(--gold)" : "transparent",
                border: p.done ? "none" : "1.5px solid var(--border2)",
                color: "#14141c",
              }}>{p.done ? "✓" : null}</span>
              <span style={{
                fontSize: 13.5, lineHeight: 1.4, flex: 1, minWidth: 0,
                color: p.done ? "var(--muted)" : "var(--text)",
                textDecoration: p.done ? "line-through" : "none",
                opacity: p.done ? 0.6 : 1,
              }}>{p.label}</span>
              {clicavel && (
                <span aria-hidden="true" style={{ color: "var(--muted)", fontSize: 13, flexShrink: 0 }}>→</span>
              )}
            </>
          );
          return clicavel
            ? <li key={p.id} style={{ listStyle: "none" }}>
                <button className="nx-check" onClick={() => onNav?.(p.nav)}>{miolo}</button>
              </li>
            : <li key={p.id} className="nx-check" style={{ listStyle: "none" }}>{miolo}</li>;
        })}
      </ul>
    </section>
  );
}

export default PrepChecklist;
