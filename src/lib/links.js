/* ════════════════════════════════════════════════════════════════════
 *  OS ENDEREÇOS QUE APONTAM PARA FORA  (spec 0036 · AC-2)
 *  --------------------------------------------------------------------
 *  Tudo que sai do app mora aqui. Um endereço, um lugar.
 *
 *  ── POR QUE ISTO EXISTE ─────────────────────────────────────────────
 *  O convite do Discord estava literal em DOIS componentes
 *  (`RoadmapScreen.jsx` e `SystemSelect.jsx`) e citado num terceiro. Ele
 *  expirou, e o produto passou meses convidando gente para uma porta
 *  fechada — em três telas ao mesmo tempo, sem ninguém perceber, porque
 *  não havia um lugar para olhar. Endereço duplicado não é questão de
 *  estilo: é o motivo pelo qual o conserto não aconteceu.
 *
 *  Regra: **nenhum `href` externo literal dentro de componente.** Se
 *  aparecer um, o gate `__tests__/links.test.js` reprova.
 * ══════════════════════════════════════════════════════════════════ */

/**
 * O convite do servidor "NEXUS RPG SYSTEM".
 *
 * ⚠️ **ESTE CONVITE EXPIRA.** A API do Discord devolve
 * `expires_at: 2026-09-06T15:49:23Z` para ele — é o mesmo defeito que matou o
 * convite anterior (`discord.gg/nexusrpg`, hoje HTTP 404 na API de convites).
 *
 * Para trocar por um permanente: no Discord, **Convidar pessoas → Editar link
 * de convite → Expira após: Nunca · Usos: Sem limite → Gerar novo link**. A
 * validade de um convite já criado não muda; tem de ser um novo. Trocado o
 * valor aqui, o produto inteiro passa a apontar para o novo.
 */
export const DISCORD_URL = "https://discord.gg/F7jkErsqt";

/**
 * Quando o convite acima morre, em ISO (`YYYY-MM-DD`).
 *
 * Não é decoração: `__tests__/links.test.js` compara esta data com o relógio e
 * **falha o gate** quando ela chega. É o alarme que faltou da última vez —
 * assim o convite morre num teste vermelho, e não na cara de um visitante.
 *
 * Com um convite permanente, troque por `null` e o alarme se desliga sozinho.
 */
export const DISCORD_EXPIRA_EM = "2026-09-06";

/**
 * O e-mail de suporte.
 *
 * ⚠️ **Precisa estar roteando ANTES do deploy.** O encaminhamento é criado no
 * painel da Cloudflare (o DNS do domínio está lá): Email → Email Routing →
 * regra `suporte@` → caixa de destino confirmada. Publicar um `mailto:` que
 * ninguém lê é o mesmo defeito que esta spec veio consertar, só que mais
 * difícil de perceber — a mensagem some em silêncio, sem nem um 404.
 */
export const EMAIL_SUPORTE = "suporte@playnexusrpg.com";

/** O `href` do botão de suporte, com assunto pronto. */
export const MAILTO_SUPORTE =
  `mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent("Suporte — Nexus RPG")}`;

/** A licença da comunidade de Ordem Paranormal (spec 0003). */
export const LICENCA_OP_URL = "https://ordemparanormal.com.br/licenca";

/** O site oficial de Ordem Paranormal, citado nos banners de conteúdo. */
export const SITE_OP_URL = "https://ordemparanormal.com.br";

/** Atributos de todo link externo — `noopener` fecha o acesso ao `window` pai. */
export const ALVO_EXTERNO = Object.freeze({
  target: "_blank",
  rel: "noopener noreferrer",
});
