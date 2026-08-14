/* ═══════════════════════════════
   PRECISA DE VOCÊ — o único bloco do Painel com acento
═══════════════════════════════ */
/* Cada item é DECISÃO PENDENTE ou EVENTO VIVO. Nunca lembrete genérico, nunca
 * "dica do dia": se o item não some sozinho quando o usuário age, ele não entra.
 *
 * Vazio ⇒ o bloco não existe. Nada de "Tudo em dia ✓" — um bloco permanente que
 * na esmagadora maioria dos dias só diz "nada aqui" é ruído com cara de sinal.
 *
 * Três fontes, nesta ordem de urgência:
 *   1. Edições sugeridas na ficha pública — o fluxo existe inteiro
 *      (`savePendingEdit`/`resolvePendingEdit`) e não havia NENHUMA superfície
 *      que avisasse. Alguém sugeria e a sugestão morria lá.
 *   2. Fichas suas ao vivo numa mesa — custo marginal zero: o listener global já
 *      roda no App, só gravava num ref que ninguém observava.
 *   3. Campanha sua com vaga aberta — derivada de `campaigns`, já em memória.
 *      No máximo UMA, e por último: é a menos urgente das três.
 *
 * Máximo 4 itens. Lista que rola não é "precisa de você", é caixa de entrada. */

const MAX_ITENS = 4;

/* Montagem pura — separada do JSX de propósito: é o que o teste consegue
 * exercitar sem renderizar, e é a MESMA contagem que alimenta o sino da
 * Topbar (um sinal, duas superfícies). */
export function montarPendencias({
  pendentes = [], liveSheets = {}, characters = [], campaigns = [], uid = "",
} = {}) {
  const itens = [];

  /* 1 · Edições sugeridas — mais sugestões primeiro */
  [...pendentes]
    .sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0))
    .forEach(p => {
      const n = p.quantidade || 0;
      itens.push({
        id: `edit:${p.charId}`,
        tipo: "edicao",
        marca: "!",
        texto: `${n} ${n === 1 ? "edição sugerida" : "edições sugeridas"} em “${p.charNome || "ficha"}”`,
        acao: "Revisar",
        charId: p.charId,
      });
    });

  /* 2 · Fichas ao vivo — `liveSheets` é { charId: [{campaignId, sheetId}] } */
  Object.entries(liveSheets || {}).forEach(([charId, coords]) => {
    if (!Array.isArray(coords) || coords.length === 0) return;
    const char = characters.find(c => String(c.id || c.createdAt) === String(charId));
    const nome = char?.form?.personagem || char?.name || "Sua ficha";
    const camp = campaigns.find(c => c.id === coords[0]?.campaignId);
    itens.push({
      id: `live:${charId}`,
      tipo: "vivo",
      marca: "●",
      texto: camp
        ? `“${nome}” está ao vivo na mesa de ${camp.name}`
        : `“${nome}” está ao vivo numa mesa`,
      acao: "Abrir",
      charId,
      campanha: camp || null,
    });
  });

  /* 3 · Uma campanha sua com vaga aberta */
  const comVaga = campaigns.find(c =>
    c.masterId === uid && c.isActive !== false &&
    (c.members?.length || 0) < (c.maxPlayers || 6)
  );
  if (comVaga) {
    const livres = (comVaga.maxPlayers || 6) - (comVaga.members?.length || 0);
    itens.push({
      id: `vaga:${comVaga.id}`,
      tipo: "vaga",
      marca: "○",
      texto: `${comVaga.name} tem ${livres} ${livres === 1 ? "vaga aberta" : "vagas abertas"}`,
      acao: "Convidar",
      campanha: comVaga,
    });
  }

  return itens.slice(0, MAX_ITENS);
}

function NeedsYou({
  pendentes, liveSheets, characters = [], campaigns = [], uid = "",
  onSelectChar, onOpenCampaign,
}) {
  const itens = montarPendencias({ pendentes, liveSheets, characters, campaigns, uid });
  if (itens.length === 0) return null;

  const abrir = (item) => {
    if (item.campanha && item.tipo !== "edicao") { onOpenCampaign?.(item.campanha); return; }
    const char = characters.find(c => String(c.id || c.createdAt) === String(item.charId));
    if (char) onSelectChar?.(char);
  };

  return (
    <section aria-labelledby="nx-precisa">
      <div className="nx-sec">
        <span className="nx-sec-t" id="nx-precisa">Precisa de você</span>
      </div>
      <div className="nx-list">
        {itens.map(item => (
          <button key={item.id} className="nx-row" onClick={() => abrir(item)}>
            {/* O acento é pontuação: um caractere dourado, não um chip de fundo */}
            <span aria-hidden="true" style={{
              width: 12, flexShrink: 0, textAlign: "center", fontSize: 12,
              color: item.tipo === "vaga" ? "var(--muted)" : "var(--gold)",
            }}>{item.marca}</span>
            <span className="nx-row-t" style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
              {item.texto}
            </span>
            <span style={{
              fontFamily: "Cinzel,serif", fontSize: 10, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--muted)", flexShrink: 0,
            }}>{item.acao}</span>
            <span aria-hidden="true" style={{ color: "var(--muted)", fontSize: 13, flexShrink: 0 }}>→</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default NeedsYou;
