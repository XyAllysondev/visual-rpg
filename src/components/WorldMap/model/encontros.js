/* ════════════════════════════════════════════════════════════════════
 *  O ENCONTRO ALEATÓRIO  (spec 0028 · F6 · AC-8, AC-1, AC-9)
 *  --------------------------------------------------------------------
 *  O grupo atravessa a trilha; em algum ponto o mapa cobra o pedágio.
 *  Este módulo decide **se** cobra, com que chance, e — acima de tudo —
 *  **por onde o resultado passa antes de virar coisa na tela do jogador**.
 *
 *  ── A REGRA QUE NÃO PODE SER QUEBRADA (briefing §9) ─────────────────
 *
 *    "Ao disparar, pausa a viagem e notifica o mestre com o resultado
 *     rolado; **o mestre decide** aceitar, trocar ou ignorar antes de o
 *     jogador ver qualquer coisa. Nada de encontro aparecendo sem o
 *     mestre saber."
 *
 *  O código materializa isso num caminho de mão única, com três degraus:
 *
 *      sortearEncontro   → { houve, chance, rolagem }    (números, zero texto)
 *      montarPendencia   → gm.pendingEncounter           (o segredo inteiro)
 *      decidirEncontro   → { pendencia: null, publicar } (o mestre decidiu)
 *
 *  **`publicar` só nasce no terceiro degrau.** Nenhuma outra função deste
 *  arquivo devolve documento de jogador — `__tests__/encontros.test.js`
 *  varre TODAS as exports e falha se alguma o fizer. E `sortearEncontro`
 *  não devolve sequer um campo de texto: não há, na saída do sorteio,
 *  nada que uma UI consiga renderizar por engano.
 *
 *  ── AC-1 AQUI: `projecaoDoEncontro` ─────────────────────────────────
 *  Devolve `{ id, title, playerText }`, montado por lista branca literal
 *  — sem espalhamento, sem `delete`, sem "tudo menos". `gmText`, `chance`,
 *  `rolagem` e `sugestao` não existem como chave no payload que vai para
 *  `campaigns/.../revealed/`. Mesma postura de `projecaoDoEvento`.
 *
 *  ── AC-9: NENHUM MOTOR DE DADOS PARALELO ────────────────────────────
 *  Este arquivo não sorteia nada. A aleatoriedade entra pelo parâmetro
 *  `sorteio` (número já sorteado ou função sem argumento), exatamente
 *  como o `on_travel` de `eventos.js`. Quem quiser rolar de verdade usa
 *  `sorteioDeD100`, que é uma ponte fina para `rollDice` de
 *  `src/domain/dice.js` — o motor único do projeto — com o `rng` também
 *  entrando por parâmetro.
 *
 *  ── PUREZA ──────────────────────────────────────────────────────────
 *  Sem React, sem Firebase, sem DOM, sem `Date.now()`, sem `Math.random()`.
 *  Nada muta a entrada.
 *
 *  Gate: `__tests__/encontros.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { rollDice } from "../../../domain/dice";
import { HORAS_POR_DIA } from "./viagem";

const idValido = (v) => typeof v === "string" && v.trim() !== "";
const ehObjeto = (v) => !!v && typeof v === "object";
const texto = (v) => (typeof v === "string" ? v : "");
const grampear01 = (n) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const naoNegativo = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

/* ── Os quatro períodos do dia ──────────────────────────────────────── */

/**
 * Os quatro períodos do briefing, cobrindo as 24 horas sem buraco.
 *
 * `peso` é o multiplicador da chance por hora — **é aqui que "noite e
 * madrugada pesam mais" vira número**. Deixar o peso na tabela (e não
 * espalhado numa fórmula) é o que torna o balanceamento ajustável sem
 * reescrever regra: mudar 1.25 para 1.4 muda a noite inteira do jogo.
 *
 * A escala é ancorada na **tarde = 1** (o período neutro). A manhã abaixo de 1
 * porque é quando o mundo está mais acordado e menos disposto a emboscar.
 */
export const PERIODOS = Object.freeze(
  [
    { id: "madrugada", label: "Madrugada", horaInicial: 0, horaFinal: 5, peso: 1.5 },
    { id: "manha", label: "Manhã", horaInicial: 6, horaFinal: 11, peso: 0.75 },
    { id: "tarde", label: "Tarde", horaInicial: 12, horaFinal: 17, peso: 1 },
    { id: "noite", label: "Noite", horaInicial: 18, horaFinal: 23, peso: 1.25 },
  ].map((p) => Object.freeze(p)),
);

/**
 * Chance de encontro **por hora de viagem**, indexada pelo `dangerLevel` da
 * trilha (0–5, a mesma escala de `NIVEIS_DE_PERIGO` do editor).
 *
 * Índice 0 é zero por contrato, não por acaso: o editor descreve o nível 0 como
 * *"Estrada batida, sem rolagem de encontro"*. A curva cresce mais que linear
 * de propósito — do nível 3 para o 5 o salto tem de ser sentido na mesa, senão
 * "Mortal" e "Arriscado" viram a mesma coisa na prática.
 */
export const CHANCE_POR_HORA = Object.freeze([0, 0.02, 0.04, 0.07, 0.11, 0.16]);

/** O teto da escala de perigo — o mesmo do editor (`NIVEIS_DE_PERIGO`). */
export const PERIGO_MAXIMO = CHANCE_POR_HORA.length - 1;

/** As três decisões do mestre, na ordem do briefing. */
export const DECISOES = Object.freeze(["aceitar", "trocar", "ignorar"]);

/** As duas origens possíveis de uma pendência: a trilha ou a fogueira. */
export const ORIGENS = Object.freeze(["viagem", "acampamento"]);

/** A entrada da tabela de períodos, ou `null`. Devolve o objeto congelado. */
export function getPeriodo(id) {
  return PERIODOS.find((p) => p.id === id) || null;
}

/**
 * O peso do período na chance por hora.
 *
 * Período desconhecido vale **1 (neutro)**: nem infla nem zera. Um id torto não
 * pode virar nem "encontro garantido" nem "estrada segura" em silêncio — as
 * duas coisas seriam decisões de jogo tomadas por um bug.
 */
export function pesoDoPeriodo(periodo) {
  const p = getPeriodo(periodo);
  return p ? p.peso : 1;
}

/**
 * Em que período do dia o relógio de jogo está.
 *
 * Aceita os **dois formatos** de `avancarRelogio` (`viagem.js`), porque é dele
 * que o valor vem:
 * - `{ dia, hora, minuto }` — o relógio de jogo;
 * - `number` — horas absolutas desde o começo da campanha.
 *
 * Relógio ausente ou torto vale como o começo da campanha (dia 1, 00:00 →
 * madrugada), que é exatamente o que `avancarRelogio(null, 0)` devolve. Manter
 * a mesma convenção nos dois lugares evita que "sem relógio" signifique uma
 * coisa no tempo e outra no encontro.
 *
 * @param {{dia:number,hora:number,minuto:number}|number|null} dataHora
 * @returns {string} `madrugada` · `manha` · `tarde` · `noite`.
 */
export function periodoDe(dataHora) {
  const absolutas = typeof dataHora === "number" && Number.isFinite(dataHora)
    ? dataHora
    : null;

  const hora = absolutas !== null
    ? Math.floor(((absolutas % HORAS_POR_DIA) + HORAS_POR_DIA) % HORAS_POR_DIA)
    : Math.floor(
      ((Number.isFinite(dataHora?.hora) ? dataHora.hora : 0) % HORAS_POR_DIA + HORAS_POR_DIA)
        % HORAS_POR_DIA,
    );

  const achado = PERIODOS.find((p) => hora >= p.horaInicial && hora <= p.horaFinal);
  return (achado || PERIODOS[0]).id;
}

/* ── A fórmula ──────────────────────────────────────────────────────── */

/**
 * A chance de o grupo encontrar alguma coisa neste trecho — fração de 0 a 1.
 *
 * ── A FÓRMULA, POR EXTENSO ─────────────────────────────────────────────
 *
 *     p_hora = CHANCE_POR_HORA[perigo] × peso(período) × modificador
 *     chance = 1 − (1 − p_hora) ^ horas
 *
 * Lida em português: **a cada hora de trilha o mundo faz uma tentativa**, com
 * probabilidade `p_hora`; a chance do trecho inteiro é a de *pelo menos uma*
 * tentativa dar certo. É por isso que a conta é `1 − (1 − p)^h` e não `p × h`:
 * a multiplicação estoura de 1 numa viagem longa (com `p = 0.11`, dez horas
 * dariam "110% de chance"), e a composição não estoura nunca — ela satura, que
 * é o comportamento certo. Viajar 48 horas por lugar perigoso fica *quase*
 * certo, nunca *impossível de escapar*.
 *
 * Os três fatores, e por que cada um está aí (briefing §9: *"a chance deriva do
 * `danger_level` da aresta + região + horário"*):
 *
 * 1. **Perigo da trilha** (`dangerLevel`, 0–5) — a tabela `CHANCE_POR_HORA`.
 *    **Perigo 0 devolve 0 e sai**, antes de qualquer outra conta: nenhum
 *    horário, nenhuma duração e nenhum modificador ressuscitam uma estrada
 *    segura. É a única regra dura da fórmula.
 * 2. **Horário** (`periodo`) — o `peso` da tabela `PERIODOS`. Madrugada 1.5,
 *    noite 1.25, tarde 1, manhã 0.75.
 * 3. **Duração** (`horas`) — o expoente. Trecho mais longo, mais chance.
 *
 * E o `modificador`, que é a porta da **região** e do que mais a mesa quiser:
 * um multiplicador de `p_hora`. `1` é neutro (o padrão), `1.5` é uma região
 * infestada, `0.5` é um grupo com batedor bom, `0` desliga. Um valor torto
 * (NaN, negativo) vira 1 — neutro, nunca zero: um bug não pode desligar os
 * encontros da campanha inteira sem ninguém perceber.
 *
 * Ajustar o jogo é mexer nas duas tabelas do topo do arquivo. A fórmula não
 * precisa mudar.
 *
 * @param {{dangerLevel?:number, periodo?:string, horas?:number, modificador?:number}} [entrada]
 * @returns {number} fração de 0 a 1.
 */
export function chanceDeEncontro(entrada) {
  const e = ehObjeto(entrada) ? entrada : {};

  const perigo = Math.max(
    0,
    Math.min(PERIGO_MAXIMO, Number.isFinite(e.dangerLevel) ? Math.round(e.dangerLevel) : 0),
  );
  if (perigo === 0) return 0; // regra dura: estrada segura é estrada segura.

  const horas = naoNegativo(e.horas);
  if (horas === 0) return 0;

  const modificador = Number.isFinite(e.modificador) && e.modificador >= 0 ? e.modificador : 1;
  const porHora = grampear01(CHANCE_POR_HORA[perigo] * pesoDoPeriodo(e.periodo) * modificador);
  if (porHora <= 0) return 0;

  return grampear01(1 - (1 - porHora) ** horas);
}

/* ── O sorteio — aleatoriedade por parâmetro ────────────────────────── */

/** O sorteio chega como número já sorteado ou como função sem argumento. */
function valorDoSorteio(sorteio) {
  const v = typeof sorteio === "function" ? sorteio() : sorteio;
  return Number.isFinite(v) ? v : null;
}

/**
 * Uma fração de 0 a 1 vinda de **1d100 rolado no motor único do projeto**
 * (`rollDice`, `src/domain/dice.js`) — o AC-9 proíbe motor paralelo, então esta
 * é a ponte oficial entre a mesa e o `sorteio` deste módulo.
 *
 * O mapeamento é 1..100 → 0.00..0.99 (`(total − 1) / 100`), que é o intervalo
 * meio-aberto que `sortearEncontro` espera. Para mostrar o dado ao mestre,
 * `Math.round(fracao * 100) + 1` devolve a face rolada.
 *
 * O `rng` entra por parâmetro — **sem ele devolve `null`** e nada dispara. Este
 * arquivo não conhece `Math.random`.
 *
 * @param {Function} rng gerador de [0,1), o mesmo contrato de `dice.js`.
 * @returns {number|null}
 */
export function sorteioDeD100(rng) {
  if (typeof rng !== "function") return null;
  const rolagem = rollDice("1d100", { rng });
  if (!rolagem || !Number.isFinite(rolagem.total)) return null;
  return (rolagem.total - 1) / 100;
}

/**
 * Rolou encontro?
 *
 * **Devolve três valores e nada mais: `{ houve, chance, rolagem }`.** Nenhum
 * deles é texto. É de propósito, e é a primeira metade da regra do briefing §9:
 * o sorteio, sozinho, não produz nada que a UI consiga mostrar ao jogador —
 * nem por engano, nem por espalhamento de objeto. Para virar coisa na tela é
 * preciso passar por `montarPendencia` e, depois, por `decidirEncontro`.
 *
 * A borda é meio-aberta (`rolagem < chance`), como em `eventos.js`: com chance
 * 0 nada dispara, com chance 1 tudo dispara.
 *
 * Dois atalhos no contexto, para quem já tem parte da conta feita:
 * - `dataHora` no lugar de `periodo` — o período é derivado por `periodoDe`;
 * - `chance` pronta — entra direta e o `dangerLevel` é ignorado. É o caso da
 *   emboscada do acampamento, cuja chance vem da região e não de uma aresta.
 *
 * @param {{dangerLevel?:number, periodo?:string, horas?:number, modificador?:number,
 *          dataHora?:object|number, chance?:number}} [contexto]
 * @param {number|Function} [sorteio] fração de 0 a 1, ou função que a devolva.
 * @returns {{houve:boolean, chance:number, rolagem:number|null}}
 */
export function sortearEncontro(contexto, sorteio) {
  const ctx = ehObjeto(contexto) ? contexto : {};

  const periodo = ctx.periodo !== undefined && ctx.periodo !== null
    ? ctx.periodo
    : (ctx.dataHora !== undefined ? periodoDe(ctx.dataHora) : undefined);

  const chance = Number.isFinite(ctx.chance)
    ? grampear01(ctx.chance)
    : chanceDeEncontro({ ...ctx, periodo });

  if (chance <= 0) return { houve: false, chance: 0, rolagem: valorDoSorteio(sorteio) };
  if (chance >= 1) return { houve: true, chance: 1, rolagem: valorDoSorteio(sorteio) };

  const rolagem = valorDoSorteio(sorteio);
  // Sem sorteio não se dispara: a alternativa seria este módulo sortear sozinho.
  if (rolagem === null) return { houve: false, chance, rolagem: null };

  return { houve: rolagem < chance, chance, rolagem };
}

/* ── A pendência — o que SÓ o mestre vê ─────────────────────────────── */

/**
 * O objeto que vai para `gm.pendingEncounter` (design §3) e **para de lá**.
 *
 * É o documento do mestre: carrega a `sugestao` inteira (com `gmText`, tabela,
 * o que houver), a `chance` calculada e a `rolagem` que saiu. O jogador nunca
 * lê este caminho — as rules já negam `gm/` a ele, e este módulo não tem
 * nenhuma função que transforme a pendência em documento público sem passar
 * por `decidirEncontro`.
 *
 * A `sugestao` sai **pela referência original**, e não copiada: quem chama é o
 * cliente do mestre e precisa do documento inteiro para decidir. Mesma escolha
 * de `avaliarGatilhos` em `eventos.js`.
 *
 * Campos ausentes viram `null` (nunca `undefined`) — o Firestore recusa
 * `undefined`, e uma pendência meio montada não pode quebrar a gravação.
 *
 * @param {{trilhaId?:string, noId?:string, periodo?:string, chance?:number,
 *          rolagem?:number, sugestao?:object, origem?:string}} [entrada]
 * @returns {{origem:string, trilhaId:string|null, noId:string|null,
 *            periodo:string|null, chance:number, rolagem:number|null,
 *            sugestao:object|null}}
 */
export function montarPendencia(entrada) {
  const e = ehObjeto(entrada) ? entrada : {};
  return {
    origem: e.origem === "acampamento" ? "acampamento" : "viagem",
    trilhaId: idValido(e.trilhaId) ? e.trilhaId : null,
    noId: idValido(e.noId) ? e.noId : null,
    periodo: getPeriodo(e.periodo) ? e.periodo : null,
    chance: grampear01(e.chance),
    rolagem: Number.isFinite(e.rolagem) ? e.rolagem : null,
    sugestao: ehObjeto(e.sugestao) ? e.sugestao : null,
  };
}

/* ── projecaoDoEncontro — o AC-1 aplicado aqui ──────────────────────── */

/**
 * O que o jogador pode ver de um encontro — **e só isso**.
 *
 * Lista branca literal de três campos, escritos à mão: sem espalhamento, sem
 * `delete`, sem "tudo menos". Campo novo no documento do mestre não escorrega
 * para cá por acidente — é a mesma construção de `projecaoDoEvento`, e pela
 * mesma razão: depois que o dado é copiado para `revealed/`, as rules não têm
 * mais como consertar o vazamento.
 *
 * Fora, para sempre: `gmText`, `chance`, `rolagem`, `sugestao`, `dangerLevel` e
 * qualquer outra coisa. O teste varre o JSON serializado.
 *
 * @param {object} encontro
 * @returns {{id:string, title:string, playerText:string}|null} objeto novo;
 *   `null` quando não há id (não há documento onde gravá-lo).
 */
export function projecaoDoEncontro(encontro) {
  if (!ehObjeto(encontro) || !idValido(encontro.id)) return null;
  return {
    id: encontro.id,
    title: texto(encontro.title),
    playerText: texto(encontro.playerText),
  };
}

/* ── decidirEncontro — a única porta para o jogador ─────────────────── */

/**
 * **O mestre decide.** Esta é a única função do módulo que produz `publicar`.
 *
 * - `aceitar` — publica a projeção da `sugestao` que estava na pendência;
 * - `trocar` — publica a projeção do `substituto`, e **nunca** cai de volta na
 *   sugestão original (trocar é trocar; se o substituto não veio, não se
 *   publica nada — publicar o descartado seria o pior erro possível aqui);
 * - `ignorar` — publica `null`. Não é texto vazio nem objeto vazio: é a
 *   ausência do documento. Nada é escrito, o jogador não vê nem o rastro.
 *
 * Nos três casos a pendência é **encerrada** (`pendencia: null`): a decisão foi
 * tomada, `gm.pendingEncounter` volta a ficar vazio e a viagem pode seguir.
 *
 * Uma decisão **desconhecida** não decide nada: a pendência volta intacta, pela
 * mesma referência, e `publicar` é `null`. Falhar fechado é o único
 * comportamento aceitável — um valor torto não pode nem publicar por conta
 * própria nem apagar em silêncio um encontro que o mestre ainda não viu.
 *
 * Publicar o que sai daqui é gravar `{ kind:'encounter', ...publicar }` em
 * `campaigns/{cid}/worldmaps/{iid}/revealed/`. Este módulo não sabe que o
 * Firestore existe.
 *
 * @param {object} pendencia o objeto de `montarPendencia`.
 * @param {'aceitar'|'trocar'|'ignorar'} decisao
 * @param {object} [substituto] o encontro que o mestre pôs no lugar.
 * @returns {{pendencia:object|null, publicar:{id,title,playerText}|null}}
 */
export function decidirEncontro(pendencia, decisao, substituto) {
  if (decisao === "ignorar") return { pendencia: null, publicar: null };
  if (decisao === "aceitar") {
    return { pendencia: null, publicar: projecaoDoEncontro(pendencia?.sugestao) };
  }
  if (decisao === "trocar") {
    return { pendencia: null, publicar: projecaoDoEncontro(substituto) };
  }
  // Decisão que não é decisão: nada acontece, e a pendência continua de pé.
  return { pendencia: ehObjeto(pendencia) ? pendencia : null, publicar: null };
}
