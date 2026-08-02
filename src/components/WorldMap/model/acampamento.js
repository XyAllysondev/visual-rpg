/* ════════════════════════════════════════════════════════════════════
 *  O ACAMPAMENTO  (spec 0028 · F6 · AC-8)
 *  --------------------------------------------------------------------
 *  Parar, montar fogueira e deixar a noite passar. Três coisas
 *  acontecem, e elas são separadas de propósito:
 *
 *    1. **o relógio anda**   → `avancarRelogio` (viagem.js)
 *    2. **a comida some**    → `consumirSuprimentos` (viagem.js)
 *    3. **alguém pode chegar** → a emboscada
 *
 *  ── A EMBOSCADA SEGUE A MESMA REGRA DO ENCONTRO (briefing §9) ───────
 *  *"o mestre decide aceitar, trocar ou ignorar antes de o jogador ver
 *  qualquer coisa."* Então `acampar` devolve a **pendência**
 *  (`gm.pendingEncounter`), nunca o documento do jogador. Publicar
 *  continua sendo trabalho de `decidirEncontro`, em `encontros.js` —
 *  não existe aqui nenhum atalho que pule o mestre, e o teste varre as
 *  exports do módulo para provar isso.
 *
 *  ── O QUE ESTE MÓDULO NÃO FAZ ───────────────────────────────────────
 *  **Não inventa regra de sistema.** Suprimento esgotado é propagado
 *  como veio de `consumirSuprimentos` (`esgotou`, `deficit`) — sem fome,
 *  sem exaustão, sem penalidade. `descansoRecuperado` devolve horas e um
 *  rótulo; PV, PE, dado de vida e condição são da ficha, e a ficha tem
 *  sistemas diferentes no Nexus. Aplicar descanso em ficha está **fora
 *  do escopo desta fase**.
 *
 *  ── PUREZA ──────────────────────────────────────────────────────────
 *  Sem React, sem Firebase, sem DOM, sem `Date.now()`, sem `Math.random()`.
 *  A aleatoriedade entra pelo `sorteio`. Nada muta a entrada, e quando
 *  nada muda a `party` volta **pela mesma referência** (padrão de
 *  `revelacao.js`).
 *
 *  Gate: `__tests__/acampamento.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { montarPendencia, periodoDe, sortearEncontro } from "./encontros";
import { avancarRelogio, consumirSuprimentos } from "./viagem";

const ehObjeto = (v) => !!v && typeof v === "object";
const naoNegativo = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * O tipo de nó onde dá para acampar parado.
 *
 * É o id de `NODE_TYPES` em `graph.js` ("Acampamento"). Não se importa a tabela
 * inteira para cá porque este módulo é lógica de mesa e não precisa conhecer o
 * catálogo do editor — mas há teste amarrando a constante ao `NODE_TYPES`, para
 * a string não sair de sincronia em silêncio.
 */
export const TIPO_DE_ACAMPAMENTO = "camp";

/** A recusa de `podeAcampar`, em português, pronta para a tela. */
export const MOTIVO_LUGAR_ERRADO = "O grupo só pode acampar em trânsito ou num acampamento.";

/**
 * A partir de quantas horas o descanso é chamado de **longo**.
 *
 * ⚠️ É **rótulo, não regra**. Não concede nada, não recupera nada, não é
 * requisito de sistema nenhum — serve para a interface dizer "descanso longo"
 * em vez de "8h". `descansoRecuperado` aceita outro limiar por parâmetro
 * justamente porque cada sistema do Nexus corta esse número onde quiser.
 */
export const HORAS_DE_DESCANSO_LONGO = 8;

/* ── podeAcampar ────────────────────────────────────────────────────── */

/**
 * O grupo pode acampar agora?
 *
 * O briefing §9 dá dois casos, e só dois: **em trânsito** (o grupo parou no
 * meio da trilha) **ou em nó do tipo `camp`**. Parar dentro de uma cidade, de
 * uma masmorra ou de um ponto de interesse não é acampar — lá o descanso é
 * cena, e cena é do mestre.
 *
 * Falha fechado: sem contexto, a resposta é não.
 *
 * @param {{noAtual?:object, viajando?:boolean}} [situacao]
 * @returns {{ok:boolean, motivo:string}} `motivo` é `""` quando pode.
 */
export function podeAcampar(situacao) {
  const s = ehObjeto(situacao) ? situacao : {};
  if (s.viajando === true) return { ok: true, motivo: "" };
  if (s.noAtual?.type === TIPO_DE_ACAMPAMENTO) return { ok: true, motivo: "" };
  return { ok: false, motivo: MOTIVO_LUGAR_ERRADO };
}

/* ── acampar ────────────────────────────────────────────────────────── */

/**
 * Passar o tempo acampado.
 *
 * O que ele faz, em ordem:
 * 1. **relógio** — `avancarRelogio(party.inGameDatetime, horas)`;
 * 2. **suprimentos** — `consumirSuprimentos(party.supplies, horas, consumoPorDia)`,
 *    devolvido **inteiro** (`restante`, `consumido`, `esgotou`, `deficit`). Se
 *    a comida acabou, quem diz é o `esgotou`; o que a mesa faz com isso é da
 *    mesa. Este módulo não inventa penalidade;
 * 3. **emboscada** — sorteia contra `chanceDeEmboscada` usando o `sorteio` que
 *    veio de fora e, se disparar, devolve a **pendência do mestre**.
 *
 * A `party` volta **pela mesma referência** quando `horas <= 0`: acampar zero
 * horas não é acampar, e o React pula o render de graça. Fora disso volta um
 * objeto novo, com todos os campos que não são deste módulo preservados
 * (posição, `flags`, `speedModifier`).
 *
 * A emboscada é datada com o período em que o grupo **montou** o acampamento —
 * é a hora que o mestre tem na tela quando aperta "Acampar", e é a que faz
 * sentido narrar ("vocês param ao anoitecer e...").
 *
 * `chanceDeEmboscada` é uma **fração de 0 a 1** e vem de fora: ela é da região
 * e do lugar, não de uma aresta, então quem a calcula é a mesa (podendo usar
 * `chanceDeEncontro` para isso). Sem ela, ninguém aparece. Sem `sorteio`,
 * também não — este módulo não sorteia sozinho.
 *
 * @param {{party?:object, horas?:number, consumoPorDia?:number,
 *          sorteio?:number|Function, chanceDeEmboscada?:number,
 *          sugestao?:object}} [pedido] `sugestao` é o encontro que o mestre
 *   verá como proposta; sem ela a pendência chega vazia e ele escreve na hora.
 * @returns {{party:object, emboscada:object|null, relogio:object|number,
 *            suprimentos:{restante:number,consumido:number,esgotou:boolean,deficit:number}}}
 */
export function acampar(pedido) {
  const p = ehObjeto(pedido) ? pedido : {};
  const base = ehObjeto(p.party) ? p.party : null;
  const horas = naoNegativo(p.horas);

  const relogio = avancarRelogio(base?.inGameDatetime, horas);
  const suprimentos = consumirSuprimentos(base?.supplies, horas, p.consumoPorDia);

  // Nada de novo quando não se passou tempo — mesma referência, como revelacao.js.
  const party = horas > 0 || !base
    ? { ...(base || {}), inGameDatetime: relogio, supplies: suprimentos.restante }
    : base;

  const sorteado = sortearEncontro({ chance: p.chanceDeEmboscada }, p.sorteio);
  const emboscada = sorteado.houve
    ? montarPendencia({
      origem: "acampamento",
      noId: base?.currentNodeId,
      periodo: periodoDe(base?.inGameDatetime),
      chance: sorteado.chance,
      rolagem: sorteado.rolagem,
      sugestao: p.sugestao,
    })
    : null;

  return { party, emboscada, relogio, suprimentos };
}

/* ── descansoRecuperado ─────────────────────────────────────────────── */

/**
 * O que o descanso devolve — **de propósito genérico**.
 *
 * Horas e um rótulo. Nada de PV, PE, dado de vida, sanidade ou condição: o
 * Nexus roda sistemas diferentes, e o que 8 horas de sono fazem numa ficha
 * depende do sistema dela. **Aplicar o descanso na ficha está fora do escopo
 * desta fase** — quem fizer isso um dia lê `horas` daqui e resolve com as
 * regras do seu próprio sistema.
 *
 * O `limiarLongo` existe para não fossilizar as 8 horas dentro da regra: é só
 * onde o rótulo vira "longo".
 *
 * @param {{horas?:number, limiarLongo?:number}} [entrada]
 * @returns {{horas:number, longo:boolean, rotulo:string}}
 */
export function descansoRecuperado(entrada) {
  const e = ehObjeto(entrada) ? entrada : {};
  const horas = naoNegativo(e.horas);
  const limiar = Number.isFinite(e.limiarLongo) && e.limiarLongo > 0
    ? e.limiarLongo
    : HORAS_DE_DESCANSO_LONGO;

  const longo = horas >= limiar;
  const rotulo = horas <= 0 ? "Sem descanso" : (longo ? "Descanso longo" : "Descanso curto");

  return { horas, longo, rotulo };
}
