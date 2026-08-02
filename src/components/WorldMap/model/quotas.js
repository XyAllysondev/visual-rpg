/**
 * Mapa-Múndi — COTA POR PLANO (spec 0028, AC-3).
 *
 * Lógica pura: sem React, sem Firebase, sem I/O. É o oráculo que a tela e o
 * `worldMapStore` consultam antes de deixar o mestre criar mais um mapa ou
 * plantar mais um nó. Gate: `__tests__/quotas.test.js`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOBRE OS NOMES DE PLANO — leia antes de mexer
 *
 * O projeto NÃO tem hoje um identificador de plano pago. O que existe de fato:
 *
 *  · `users/{uid}.plan` — string, e a ÚNICA valor que o projeto escreve/aceita é
 *    `'free'`. As rules travam isso na criação (`firestore.rules:13`:
 *    `request.resource.data.plan == 'free'`) e `fsGetUserPlan` (`App.jsx:86-92`)
 *    devolve `'free'` como padrão. Obs.: `fsGetUserPlan` está DEFINIDO e nunca é
 *    chamado — é código morto hoje.
 *
 *  · `users/{uid}.subscribedSystems` — array de ids de SISTEMA (`'op'`,
 *    `'tormenta'`, `'dnd'`), escrito só pelo webhook de pagamento
 *    (`api/payment-webhook.js:46-70`) e lido em `App.jsx:11695` para o estado
 *    `userPlans`. É este array — não o campo `plan` — que hoje diz se o usuário
 *    pagou (`App.jsx:11808`: assinante tem 5 fichas, o resto tem 1).
 *
 *  · `api/create-payment.js:17,23` usa `planName: 'ordem'` (nome do plano de
 *    COBRANÇA, com preço), e `PLAN_DEFS[].planName` (`App.jsx:4982-5013`) são
 *    rótulos de vitrine ("Agente da Ordem"…), não identificadores.
 *
 * Portanto: `'free'` é real; `'pro'` NÃO é uma string que o projeto grave em
 * lugar nenhum — é a chave interna desta tabela para "tem plano pago". Por isso
 * `quotaFor` aceita os identificadores REAIS como sinônimos de pago (`'ordem'`,
 * `'op'`, `'tormenta'`, `'dnd'`), além de `'pro'`. Quando o campo `plan` ganhar
 * um valor pago de verdade, acrescente-o em `SINONIMOS_PAGO` — não invente um
 * segundo mapa de planos.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Teto de cada plano. `Infinity` = sem limite (AC-3). */
export const PLAN_QUOTAS = {
  free: { maps: 1, nodes: 25 },
  pro: { maps: Infinity, nodes: 500 },
};

/** Plano assumido quando não dá para saber qual é — sempre o mais restritivo. */
export const PLANO_PADRAO = "free";

/**
 * Identificadores que, no projeto real, significam "este usuário pagou".
 *
 * Inclui: `'pago'` (a palavra que a própria spec 0028 usa no AC-3 — *"Dado um
 * mestre no plano pago"* — e o termo do design.md), `'pro'` (chave interna de
 * `PLAN_QUOTAS`), os ids de sistema gravados em `subscribedSystems` e o nome do
 * plano de cobrança de `create-payment.js`.
 */
export const SINONIMOS_PAGO = ["pago", "pro", "ordem", "op", "tormenta", "dnd"];

/** Identificadores que significam "plano gratuito". */
export const SINONIMOS_FREE = ["free", "gratuito", "gratis"];

const texto = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/**
 * Contagem confiável: qualquer coisa que não seja número finito e não-negativo
 * vira 0. Chamadas reais vêm de `snap.size`, então isso só cobre engano de quem
 * chama — e o lado seguro aqui é "ainda não tem nada", nunca `NaN` vazando para
 * a comparação (que devolveria `false` e travaria o mestre sem explicação).
 */
const contagem = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** "1 mapa" / "3 mapas" — evita "1 mapas" na tela. */
const plural = (n, singular, pluralForma) => `${n} ${n === 1 ? singular : pluralForma}`;

/**
 * Cota do plano informado. Nome desconhecido, vazio ou de tipo errado cai no
 * plano mais restritivo (`free`) — nunca libera por engano.
 *
 * @param {string} plan identificador do plano (ver o cabeçalho deste arquivo).
 * @returns {{ maps: number, nodes: number }} cópia da cota (não é a tabela viva).
 */
export function quotaFor(plan) {
  const nome = texto(plan);
  const chave = SINONIMOS_PAGO.includes(nome) ? "pro" : PLANO_PADRAO;
  // `SINONIMOS_FREE` é explícito de propósito: documenta o que já cai no padrão.
  const quota = PLAN_QUOTAS[chave] || PLAN_QUOTAS[PLANO_PADRAO];
  return { ...quota };
}

/** `true` quando o identificador é reconhecido (pago ou gratuito). */
export function planoConhecido(plan) {
  const nome = texto(plan);
  return SINONIMOS_PAGO.includes(nome) || SINONIMOS_FREE.includes(nome);
}

/**
 * O mestre pode criar mais um mapa-múndi? (AC-3)
 *
 * @param {string} plan plano do usuário.
 * @param {number} mapCount quantos mapas ele JÁ tem.
 * @returns {{ ok: boolean, limite: number, motivo: string }} `motivo` é sempre
 *   uma frase em PT-BR pronta para a tela — tanto na recusa (explica o limite e
 *   o caminho) quanto na liberação (diz quanto ainda cabe).
 */
export function canCreateMap(plan, mapCount) {
  const limite = quotaFor(plan).maps;
  const atual = contagem(mapCount);
  const ok = atual < limite;

  if (limite === Infinity) {
    return { ok: true, limite, motivo: "Seu plano permite mapas-múndi ilimitados." };
  }
  if (!ok) {
    return {
      ok: false,
      limite,
      motivo: `Seu plano permite ${plural(limite, "mapa-múndi", "mapas-múndi")}, e você já tem `
        + `${plural(atual, "mapa", "mapas")}. Apague um mapa que não usa mais, ou assine um plano `
        + "para ter mapas-múndi ilimitados.",
    };
  }
  const restam = limite - atual;
  return {
    ok: true,
    limite,
    motivo: `Você ainda pode criar ${plural(restam, "mapa-múndi", "mapas-múndi")} neste plano.`,
  };
}

/**
 * O mestre pode plantar mais um nó neste mapa? (AC-3)
 *
 * @param {string} plan plano do usuário.
 * @param {number} nodeCount quantos nós o mapa JÁ tem.
 * @returns {{ ok: boolean, limite: number, motivo: string }} ver `canCreateMap`.
 */
export function canAddNode(plan, nodeCount) {
  const limite = quotaFor(plan).nodes;
  const atual = contagem(nodeCount);
  const ok = atual < limite;

  if (limite === Infinity) {
    return { ok: true, limite, motivo: "Seu plano permite nós ilimitados neste mapa." };
  }
  if (!ok) {
    const tetoPago = PLAN_QUOTAS.pro.nodes;
    const saida = limite < tetoPago
      ? `Apague algum nó, ou assine um plano para chegar a ${tetoPago} nós por mapa.`
      : "Apague algum nó antes de plantar outro.";
    return {
      ok: false,
      limite,
      motivo: `Seu plano permite ${plural(limite, "nó", "nós")} por mapa-múndi, e este mapa já tem `
        + `${plural(atual, "nó", "nós")}. ${saida}`,
    };
  }
  const restam = limite - atual;
  return {
    ok: true,
    limite,
    motivo: `Você ainda pode plantar ${plural(restam, "nó", "nós")} neste mapa.`,
  };
}
