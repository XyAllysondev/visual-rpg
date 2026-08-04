import { tempoRelativo } from "../../components/MasterSuite/ui/tokens";

/* ═══════════════════════════════
   RETOMAR — a faixa mais alta e a mais barata do Painel
═══════════════════════════════ */
/* Uma linha só: `▸ <label> · <tipo> · <há quanto tempo> →`.
 *
 * Zero Firestore: o alvo vem do `localStorage` (`src/lib/lastVisit.js`), gravado
 * nos três pontos de navegação que o App já tinha. É o que responde "o que eu
 * faço agora?" para quem abre o app pela décima vez.
 *
 * Não é card: `.nx-resume` é filete em cima e filete embaixo, sem fundo, sem
 * raio e sem sombra — a doutrina do `.nx-*` diz que separador é filete de 1px,
 * não caixa.
 *
 * `tempoRelativo` vem dos tokens da Forja, não de uma segunda implementação:
 * duas funções de "há quanto tempo" divergem no primeiro arredondamento. */

const ROTULO = { campanha: "campanha", mapa: "mapa", mundo: "mundo" };

function ResumeBar({ alvo, campaigns = [], onNav, onOpenCampaign }) {
  if (!alvo || !alvo.kind || !alvo.label) return null;

  /* Alvo que sumiu ⇒ a faixa não renderiza. Levar o usuário a uma campanha
     apagada é pior do que não oferecer atalho nenhum. Só `campanha` dá para
     validar aqui sem abrir listener: mapas e mundos moram noutro repositório e
     a tela de destino já sabe lidar com id inexistente. */
  const campanha = alvo.kind === "campanha"
    ? campaigns.find(c => c.id === alvo.id)
    : null;
  if (alvo.kind === "campanha" && !campanha) return null;

  const ir = () => {
    if (alvo.kind === "campanha") { onOpenCampaign?.(campanha); return; }
    onNav?.(alvo.kind === "mapa" ? "map" : "master");
  };

  const quando = alvo.at ? tempoRelativo(alvo.at) : null;

  return (
    <button
      className="nx-resume"
      onClick={ir}
      title={`Retomar ${alvo.label}`}
    >
      <span aria-hidden="true" style={{ color: "var(--gold)", fontSize: 11, flexShrink: 0 }}>▸</span>
      <span style={{
        fontFamily: "Cinzel,serif", fontSize: 14, color: "var(--text)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
      }}>
        Continuar em “{alvo.label}”
      </span>
      <span style={{
        fontSize: 12.5, color: "var(--muted)", flexShrink: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        · {ROTULO[alvo.kind] || alvo.kind}{quando ? ` · ${quando}` : ""}
      </span>
      <span style={{ flex: 1 }} />
      <span aria-hidden="true" style={{ color: "var(--muted)", fontSize: 13, flexShrink: 0 }}>→</span>
    </button>
  );
}

export default ResumeBar;
