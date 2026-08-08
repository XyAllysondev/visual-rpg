import REGRAS_OFICIAIS from "../../../data/ordemParanormal/regras-oficiais.json";

/* ════════════════════════════════════════════════════════════════════════
 *  INTERLÚDIO — a cena de descanso do livro (spec 0040)
 *
 *  Módulo PURO: sem React, sem Firestore, sem I/O.
 *
 *  ⚠ AS AÇÕES NÃO SÃO ESCRITAS AQUI. Elas saem de
 *  `data/ordemParanormal/regras-oficiais.json` (`secao: "interludio"`), que é a
 *  transcrição do livro feita na spec 0026. Duplicar o texto aqui criaria uma
 *  segunda régua para a mesma regra — a dívida que o `STATE` já registra em
 *  `opConstants.js` (duas tabelas de trilha divergentes).
 *
 *  ⚠ E OS VALORES DE RECUPERAÇÃO NÃO EXISTEM NO REPO. As entradas do JSON dizem
 *  "(Resumo — valores no livro.)". Então este módulo NÃO calcula quanto se
 *  recupera: ele recebe o número de quem tem o livro na mão e aplica a parte da
 *  regra que nós TEMOS por escrito — `interludio-geral`: "Nenhuma recuperação
 *  ultrapassa o máximo do personagem". Inventar os valores seria inventar regra.
 * ════════════════════════════════════════════════════════════════════════ */

/** A entrada que descreve a CENA, não uma ação escolhível. */
const ID_DA_CENA = "interludio-geral";

/**
 * As seis ações de interlúdio, na ordem do livro, lidas da transcrição oficial.
 * `nome` e `descricao` vêm do JSON — o componente só desenha.
 */
export const ACOES_INTERLUDIO = Object.values(REGRAS_OFICIAIS)
  .filter((r) => r && r.secao === "interludio" && r.id !== ID_DA_CENA)
  .map((r) => ({ id: r.id, nome: r.nome, descricao: r.descricao }));

/** A regra da cena em si, para a aba poder citá-la sem reescrevê-la. */
export const REGRA_DA_CENA =
  Object.values(REGRAS_OFICIAIS).find((r) => r && r.id === ID_DA_CENA) || null;

export const acaoPorId = (id) => ACOES_INTERLUDIO.find((a) => a.id === id) || null;

/** Inteiro > 0. Lixo, negativo e `NaN` viram 0 — recuperação negativa seria dano
 *  disfarçado de descanso, e o campo é digitado à mão. */
const ganhoLimpo = (v) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Aplica um interlúdio a um estado de vitais.
 *
 * @param {{pv:number,pvMax:number,san:number,sanMax:number,pe:number,peMax:number}} vitais
 * @param {{acao:string, pv?:number, san?:number, pe?:number, nota?:string, id?:string}} pedido
 * @returns {{ok:boolean, motivo?:string, vitais?:object, registro?:object}}
 *
 * O `registro` guarda o que foi EFETIVAMENTE recuperado, não o que foi pedido:
 * é o histórico que responde "o que meu agente fez entre as missões", e um
 * número que não aconteceu ali seria mentira no livro-razão.
 */
export function aplicarInterludio(vitais, pedido) {
  const acao = acaoPorId(pedido?.acao);
  if (!acao) return { ok: false, motivo: "Escolha uma ação de interlúdio." };

  const v = vitais || {};
  const teto = (atual, max) => {
    const a = Math.floor(Number(atual)) || 0;
    const m = Math.floor(Number(max));
    /* Sem máximo conhecido não há como grampear — e deixar passar seria a única
     * forma de a recuperação ultrapassar o teto. Nesse caso não recupera nada. */
    return Number.isFinite(m) && m > 0 ? { a, m } : null;
  };

  const recuperado = {};
  const novos = {};
  for (const [chave, atual, max] of [
    ["pv", v.pv, v.pvMax],
    ["san", v.san, v.sanMax],
    ["pe", v.pe, v.peMax],
  ]) {
    const t = teto(atual, max);
    const querido = ganhoLimpo(pedido?.[chave]);
    if (!t || querido === 0) {
      novos[chave] = t ? t.a : Math.floor(Number(atual)) || 0;
      recuperado[chave] = 0;
      continue;
    }
    const alvo = Math.min(t.m, t.a + querido);
    novos[chave] = alvo;
    recuperado[chave] = alvo - t.a;
  }

  return {
    ok: true,
    vitais: { ...v, pv: novos.pv, san: novos.san, pe: novos.pe },
    registro: {
      id: pedido?.id || `int-${acao.id}`,
      acao: acao.id,
      acaoNome: acao.nome,
      pv: recuperado.pv,
      san: recuperado.san,
      pe: recuperado.pe,
      nota: String(pedido?.nota ?? "").slice(0, 500),
    },
  };
}

/** Nada recuperado é informação — "descansei e não mudou nada" é um resultado. */
export const registroVazio = (r) => !r || (!r.pv && !r.san && !r.pe);

/** Histórico com o mais recente primeiro, tolerante a lixo do Firestore. */
export const historicoDeInterludios = (lista) =>
  (Array.isArray(lista) ? lista : []).filter((r) => r && r.acao).slice().reverse();
