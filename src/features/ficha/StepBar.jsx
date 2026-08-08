import { useSlidingPill } from "../../hooks/useSlidingPill";
import SlidingTabPill from "../../components/SlidingTabPill";

/* Spec 0039 — a barra de passos passou a falar a língua do app.
 *
 * Antes eram rótulos com sublinhado estático, e essa era a ÚNICA barra do Nexus
 * fora da gramática do indicador deslizante (`useSlidingPill`, spec 0022) que as
 * abas da ficha e da mesa já usam. Agora usa o mesmo mecanismo e o mesmo
 * componente de pílula.
 *
 * Passo cumprido, atual e futuro se distinguem por MARCA, não só por cor (AC-4):
 * cumprido leva "✓", atual leva o número do passo em destaque, futuro leva o
 * número apagado. Depender de matiz sozinho deixaria a barra ilegível para quem
 * não separa ouro de cinza — e este projeto já pagou essa conta na spec 0037,
 * no grau de treino das perícias.
 */
export const PASSOS = ["Admissão", "Atributos", "Origem", "Classe", "Autenticação"];

const StepBar = ({ current, onPick }) => {
  const { containerRef, setItemRef, pill } = useSlidingPill(String(current));

  return (
    <div
      ref={containerRef}
      role="list"
      aria-label="Passos da criação de agente"
      style={{
        display: "flex", alignItems: "stretch", justifyContent: "center",
        gap: 0, marginBottom: 30, position: "relative", flexWrap: "wrap",
      }}
    >
      <SlidingTabPill pill={pill} background="rgba(201,168,76,0.10)" underline="var(--gold)" />
      {PASSOS.map((rotulo, i) => {
        const cumprido = i < current;
        const atual = i === current;
        /* Voltar é permitido; pular para frente não — as travas de avanço são
         * as do `canNext`, e um atalho aqui as contornaria. */
        const clicavel = !!onPick && cumprido;
        return (
          <div key={rotulo} role="listitem" style={{ display: "flex", alignItems: "center" }}>
            <button
              ref={setItemRef(String(i))}
              onClick={() => clicavel && onPick(i)}
              disabled={!clicavel}
              aria-current={atual ? "step" : undefined}
              aria-label={`Passo ${i + 1} de ${PASSOS.length}: ${rotulo}${cumprido ? " (cumprido)" : atual ? " (atual)" : " (pendente)"}`}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "none", border: "none",
                padding: "7px 14px 9px",
                cursor: clicavel ? "pointer" : "default",
                position: "relative", zIndex: 1,
                fontFamily: "Cinzel,serif", fontSize: 11, letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: atual ? "var(--gold2)" : cumprido ? "var(--muted2)" : "var(--muted)",
                opacity: atual || cumprido ? 1 : 0.55,
                transition: "color 0.25s, opacity 0.25s",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontFamily: "'IBM Plex Mono','Share Tech Mono',monospace",
                  fontSize: 9, lineHeight: 1,
                  width: 16, height: 16, borderRadius: "50%",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  border: `1px solid ${atual ? "var(--gold)" : "var(--border2)"}`,
                  background: cumprido ? "var(--border2)" : "transparent",
                  color: atual ? "var(--gold2)" : "var(--muted2)",
                }}
              >
                {cumprido ? "✓" : i + 1}
              </span>
              {rotulo}
            </button>
            {i < PASSOS.length - 1 && (
              <div
                aria-hidden="true"
                style={{
                  width: 26, height: 1, flexShrink: 0,
                  background: cumprido ? "var(--border2)" : "var(--border)",
                  transition: "background 0.25s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepBar;
