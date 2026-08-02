/* Motor de dados (camada domain — não importa React, Firebase nem nada de framework).
 *
 * Fonte única de rolagem do Nexus. Antes desta extração existiam cinco implementações
 * inline no App.jsx (mais uma sexta em systems/OrdemParanormal/rules.js), nenhuma
 * exportada e nenhuma testada. A spec 0028 (AC-9) proíbe motor de dados paralelo:
 * qualquer feature nova que precise rolar dados importa daqui.
 *
 * Dois dialetos de notação convivem no app e ambos estão preservados:
 *  - CANÔNICO  (`parseNotation`)      → "NdM±K" âncorado, contagem obrigatória, com tetos.
 *    Usado pelo comando /roll do chat e pelo painel do mestre.
 *  - PERMISSIVO (`parseNotationLoose`) → varredura sem âncora, contagem opcional, sem tetos.
 *    Usado pelo bestiário, pelo campo livre da ficha e pelo dano dos ataques.
 * Não unifique os dois sem decisão de produto: o teto do canônico é uma proteção de UI
 * (o chat aceita texto arbitrário do jogador) e o permissivo lê strings de conteúdo
 * ("2d6+3" escrito dentro do dano de um ataque), onde recusar seria regressão visível.
 */

/* Tetos do dialeto canônico. Grampeiam (não recusam): "21d6" vira 20d6, "1d101" vira 1d100. */
export const MAX_DICE_COUNT = 20;
export const MAX_DICE_SIDES = 100;

/* O rng é injetável em todas as funções para teste determinístico. O padrão é escrito como
 * parâmetro default (`rng = Math.random`), avaliado A CADA CHAMADA de propósito: guardar a
 * referência no topo do módulo faria `jest.spyOn(Math, "random")` deixar de interceptar,
 * quebrando as suítes que já mockam assim. */

/** Um dado de `sides` lados: inteiro em [1, sides]. */
export function rollDie(sides, rng = Math.random) {
  return Math.floor(rng() * sides) + 1;
}

/** `count` dados de `sides` lados, na ordem rolada. */
export function rollPool(count, sides, rng = Math.random) {
  return Array.from({ length: count }, () => rollDie(sides, rng));
}

/**
 * Parser CANÔNICO de "NdM±K" (ex.: "2d6+3", "1d20", "1d100-5").
 * Ignora espaços, aceita maiúsculas, exige a expressão inteira (âncoras ^$) e a contagem.
 * Grampeia count em MAX_DICE_COUNT e sides em MAX_DICE_SIDES.
 * @returns {{count:number, sides:number, mod:number, expr:string}|null}
 */
export function parseNotation(expr) {
  const clean = String(expr).replace(/\s/g, "").toLowerCase();
  const match = clean.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!match) return null;
  return {
    count: Math.min(parseInt(match[1], 10), MAX_DICE_COUNT),
    sides: Math.min(parseInt(match[2], 10), MAX_DICE_SIDES),
    mod: match[3] ? parseInt(match[3], 10) : 0,
    expr: clean,
  };
}

/**
 * Parser PERMISSIVO: procura "NdM±K" em qualquer lugar da string, sem tetos.
 * @param {string} expr
 * @param {{requireCount?: boolean}} [options] `requireCount` exige o N antes do "d"
 *   (dialeto do bestiário, onde "d6" nunca foi aceito). Padrão: N opcional, default 1.
 * @returns {{count:number, sides:number, mod:number}|null}
 */
export function parseNotationLoose(expr, { requireCount = false } = {}) {
  const re = requireCount ? /(\d+)d(\d+)([+-]\d+)?/i : /(\d+)?[dD](\d+)([+-]\d+)?/;
  const m = String(expr).match(re);
  if (!m) return null;
  return {
    count: parseInt(m[1] || "1", 10),
    sides: parseInt(m[2], 10),
    mod: m[3] ? parseInt(m[3], 10) : 0,
  };
}

/**
 * Rolagem canônica de "NdM±K". Formato de retorno consumido pelo chat, pelo painel do
 * mestre e pelas mensagens persistidas no Firestore — não mexa nos nomes dos campos.
 * @returns {{expr:string, rolls:number[], mod:number, total:number, sides:number, count:number}|null}
 */
export function rollDice(expr, { rng = Math.random } = {}) {
  const parsed = parseNotation(expr);
  if (!parsed) return null;
  const { count, sides, mod } = parsed;
  const rolls = rollPool(count, sides, rng);
  const total = rolls.reduce((a, b) => a + b, 0) + mod;
  return { expr: parsed.expr, rolls, mod, total, sides, count };
}

/**
 * Rolagem permissiva de "NdM±K" (sem tetos, N opcional).
 * @returns {{rolls:number[], total:number, mod:number, sides:number, count:number}|null}
 */
export function rollNotation(expr, { rng = Math.random, requireCount = false } = {}) {
  const parsed = parseNotationLoose(expr, { requireCount });
  if (!parsed) return null;
  const { count, sides, mod } = parsed;
  const rolls = rollPool(count, sides, rng);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + mod, mod, sides, count };
}

/**
 * Teste de d20 de Ordem Paranormal: rola N d20 (N = valor do atributo) e fica com o MAIOR.
 * Caso especial do atributo 0: rola 2d20 e fica com o PIOR (`worst: true`).
 * `crit` é qualquer 20 no pool — a margem de ameaça por arma é decidida no ponto de uso.
 * @returns {{rolls:number[], result:number, worst:boolean, crit:boolean, dice:string}}
 */
export function rollOP(attrVal, { rng = Math.random } = {}) {
  const n = attrVal === 0 ? 2 : attrVal;
  const rolls = rollPool(n, 20, rng);
  const result = attrVal === 0 ? Math.min(...rolls) : Math.max(...rolls);
  return { rolls, result, worst: attrVal === 0, crit: rolls.includes(20), dice: "D20" };
}
