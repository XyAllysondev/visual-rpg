/* Regras da Criatura do bestiário (camada domain — não importa React nem Firebase).
 *
 * O cálculo de PV vivia dentro de `BestiaryTab.updateHP` no App.jsx, colado na escrita do
 * Firestore. Ele é regra de negócio, não persistência: "PV nunca passa do máximo nem fica
 * negativo" vale em qualquer tela e continuaria valendo com outro banco. O repositório só
 * grava o número já calculado (spec 0029 — o repo é burro de propósito). */

/** Piso do PV: uma criatura pode chegar a 0, nunca a menos. */
export const MIN_HP = 0;

/**
 * Lê um campo de PV como inteiro.
 *
 * `parseInt` sem radix é herança literal do legado, e é tolerante de propósito: o formulário
 * do bestiário grava PV como STRING livre, então `""`, `undefined` e `"18 (2d8+4)"` chegam
 * aqui. Trocar por `Number()` mudaria comportamento (`Number("18 (2d8+4)")` é `NaN`) e a
 * spec 0029 preserva o que existe (AC-7).
 */
const toInt = (v) => parseInt(v) || 0;

/** PV máximo da criatura. Sem `hpMax` legível, a criatura não tem barra de vida: 0. */
export const maxHp = (creature) => toInt(creature && creature.hpMax);

/**
 * PV atual.
 *
 * Criatura recém-adicionada não tem `hpCurrent` gravado — está intacta, logo vale `hpMax`.
 *
 * QUIRK PRESERVADO (AC-7): o `|| max` do legado faz uma criatura com `hpCurrent` igual a 0
 * ser lida como PV cheio, porque `0` é falsy. Consertar isso muda o comportamento de quem
 * já tem criatura caída no banco — é decisão de outra spec, não efeito colateral desta.
 */
export const currentHp = (creature) => {
  const max = maxHp(creature);
  const raw = creature && creature.hpCurrent != null ? creature.hpCurrent : creature && creature.hpMax;
  return toInt(raw) || max;
};

/**
 * Aplica `delta` ao PV atual e devolve o valor já dentro dos limites `[0, hpMax]`.
 *
 * @param {object} creature criatura como está no banco (`hpMax`/`hpCurrent` podem ser string)
 * @param {number} delta    dano é negativo, cura é positiva
 * @returns {number} novo `hpCurrent`, pronto para gravar
 */
export const clampHp = (creature, delta) =>
  Math.max(MIN_HP, Math.min(maxHp(creature), currentHp(creature) + delta));
