import RichTextEditor from "./shared/RichTextEditor";
import { tLabel } from "./shared/modalStyles";

const SECOES = [
  { key: "anotacoes", label: "Anotações", hint: "Idade, sonhos, detalhes diversos…" },
  { key: "aparencia", label: "Aparência", hint: "Como o agente se apresenta fisicamente…" },
  { key: "personalidade", label: "Personalidade", hint: "Traços, maneirismos, valores…" },
  { key: "historico", label: "Histórico", hint: "Passado, origem, eventos marcantes…" },
  { key: "objetivo", label: "Objetivo", hint: "Metas, motivações, o que busca…" },
];

const secLabel = {
  ...tLabel, display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
};

/* NÃO existe mais uma seção "Notas do Mestre" aqui, e a ausência é deliberada.
 *
 * Ela dependia de `character.viewerIsMaster`, prop que NENHUM lugar do código
 * jamais preencheu — a seção nunca apareceu para ninguém. E ligá-la seria pior do
 * que deixá-la morta: a ficha da mesa vive em `campaigns/{id}/sharedSheets/{id}`,
 * cuja regra é `allow read: if isMember(campaignId)`. Toda nota escrita ali seria
 * legível pelo SDK por qualquer JOGADOR da campanha — exatamente quem o rótulo
 * "visível apenas ao Mestre" promete excluir.
 *
 * Fazer de verdade exige documento separado (ex.: `campaigns/{id}/gmNotes/{charId}`)
 * com regra de leitura restrita ao mestre — decisão de fronteira, ou seja, ADR antes
 * do código. O mapa-múndi resolveu o problema idêntico assim: ADR-0012 e a
 * `projecaoDoNo`, que garante que campo de mestre não chega ao DOM do jogador. */
export default function DescricaoTab({ descricao, setDescricao }) {
  const d = descricao || {};
  const set = (key, val) => setDescricao((p) => ({ ...(p || {}), [key]: val }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {SECOES.map((s) => (
        <div key={s.key}>
          <div style={{ ...secLabel, color: "var(--el-accent)" }}>
            <span style={{ whiteSpace: "nowrap" }}>{s.label}</span>
            <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, var(--el-border), transparent)" }} />
          </div>
          <RichTextEditor value={d[s.key]} onChange={(v) => set(s.key, v)} placeholder={s.hint} minHeight={s.key === "anotacoes" || s.key === "historico" ? 110 : 80} />
        </div>
      ))}
    </div>
  );
}
