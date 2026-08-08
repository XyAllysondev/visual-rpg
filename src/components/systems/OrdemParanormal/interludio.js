import REGRAS_OFICIAIS from "../../../data/ordemParanormal/regras-oficiais.json";

/* ════════════════════════════════════════════════════════════════════════
 *  INTERLÚDIO — a cena de descanso do livro (specs 0040 e 0041)
 *
 *  Módulo PURO: sem React, sem Firestore, sem I/O.
 *
 *  ⚠ AS AÇÕES NÃO SÃO ESCRITAS AQUI. Saem de `regras-oficiais.json`
 *  (`secao: "interludio"`). Duplicar o texto criaria uma segunda régua para a
 *  mesma regra — a dívida que o STATE já registra em `opConstants.js`.
 *
 *  ⚠ A SPEC 0040 IMPLEMENTOU DUAS REGRAS ERRADAS, e a 0041 as corrige:
 *    1. "uma ação por interlúdio" — o livro permite ATÉ DUAS.
 *    2. faltava "Exercitar-se", e "Consertar" chama-se "Manutenção".
 *  E a 0040 dizia que os valores de recuperação não existiam no repo. Existiam
 *  no LIVRO, e agora estão transcritos: dormir e relaxar recuperam o LIMITE DE
 *  PE POR RODADA vezes a condição do descanso. O nosso `deriveStats().peTurno`
 *  JÁ É esse limite — o exemplo do livro (NEX 35% → limite 7) confere com
 *  `1 + nexLevel(35)` = 7. Nada precisou ser inventado.
 * ════════════════════════════════════════════════════════════════════════ */

const ID_DA_CENA = "interludio-geral";

/** Ações escolhíveis, na ordem do livro. */
export const ACOES_INTERLUDIO = Object.values(REGRAS_OFICIAIS)
  .filter((r) => r && r.secao === "interludio" && r.id !== ID_DA_CENA)
  .map((r) => ({ id: r.id, nome: r.nome, descricao: r.descricao }));

export const REGRA_DA_CENA =
  Object.values(REGRAS_OFICIAIS).find((r) => r && r.id === ID_DA_CENA) || null;

export const acaoPorId = (id) => ACOES_INTERLUDIO.find((a) => a.id === id) || null;

/** O livro: "um personagem pode fazer até DUAS das ações a seguir". */
export const MAX_ACOES = 2;

/** Só Revisar o Caso pode ser repetida no mesmo interlúdio (o livro diz isso
 *  explicitamente dela, e só dela). Dormir, relaxar e alimentar-se dizem
 *  "uma vez por interlúdio". */
const REPETIVEL = new Set(["interludio-revisar"]);

/**
 * A escada de condições do descanso. A ordem importa: o prato nutritivo/
 * energético "sobe um degrau", e o exemplo do livro (confortável → triplicada)
 * só fecha se a escada for esta.
 */
export const CONDICOES_DESCANSO = [
  { id: "precaria", label: "Precária", mult: 0.5, exemplo: "dentro do carro, tenda de acampamento" },
  { id: "normal", label: "Normal", mult: 1, exemplo: "quarto simples, cama e banheiro funcionais" },
  { id: "confortavel", label: "Confortável", mult: 2, exemplo: "hotel ou pousada três estrelas" },
  { id: "luxuosa", label: "Luxuosa", mult: 3, exemplo: "hotel de luxo, tratamento vip, spa" },
];

const IDX_CONDICAO = CONDICOES_DESCANSO.reduce((m, c, i) => ({ ...m, [c.id]: i }), {});
export const condicaoPorId = (id) =>
  CONDICOES_DESCANSO.find((c) => c.id === id) || CONDICOES_DESCANSO[1]; // normal é o padrão do livro

/** Um degrau acima na escada, sem passar do topo. */
const subirDegrau = (idCondicao) => {
  const i = IDX_CONDICAO[idCondicao] ?? 1;
  return CONDICOES_DESCANSO[Math.min(i + 1, CONDICOES_DESCANSO.length - 1)];
};

/** Os quatro pratos da ação Alimentar-se e o que cada um faz. */
export const PRATOS = [
  { id: "favorito", label: "Prato Favorito", efeito: "+2 Sanidade se você relaxar" },
  { id: "nutritivo", label: "Prato Nutritivo", efeito: "sobe um degrau na recuperação de PV ao dormir" },
  { id: "energetico", label: "Prato Energético", efeito: "sobe um degrau na recuperação de PE ao dormir" },
  { id: "rapido", label: "Prato Rápido", efeito: "+5 no teste de revisar o caso" },
];
export const pratoPorId = (id) => PRATOS.find((p) => p.id === id) || null;

/**
 * Recuperação base de uma ação de descanso.
 *
 * ⚠ DECISÃO DE ARREDONDAMENTO, não regra do livro: a condição precária vale
 * "metade", e meio ponto de PV não existe. Arredondo PARA BAIXO. O livro que
 * temos não diz o sentido, e escolher para cima seria mais generoso do que o
 * texto autoriza. Se a mesa preferir o contrário, é ajuste de uma linha — mas é
 * decisão de produto, não efeito colateral.
 */
export const recuperacaoBase = (peTurno, idCondicao) => {
  const base = Math.floor(Number(peTurno));
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.floor(base * condicaoPorId(idCondicao).mult);
};

/** Pode adicionar esta ação à seleção atual? */
export function podeAdicionarAcao(acoes, id) {
  const lista = Array.isArray(acoes) ? acoes : [];
  if (!acaoPorId(id)) return false;
  if (lista.length >= MAX_ACOES) return false;
  if (lista.includes(id) && !REPETIVEL.has(id)) return false;
  return true;
}

/**
 * Calcula o que um interlúdio recupera — sem grampear ainda.
 * Separado de `aplicarInterludio` para a interface poder PRÉ-VISUALIZAR os
 * números antes de o jogador confirmar.
 *
 * @param {{peTurno:number}} ficha
 * @param {{acoes:string[], condicao?:string, prato?:string, relaxantes?:number}} escolha
 */
export function calcularRecuperacao(ficha, escolha) {
  const acoes = (Array.isArray(escolha?.acoes) ? escolha.acoes : []).filter(acaoPorId);
  const peTurno = Math.floor(Number(ficha?.peTurno)) || 0;
  const condicao = escolha?.condicao || "normal";
  const prato = acoes.includes("interludio-alimentar") ? pratoPorId(escolha?.prato) : null;
  const out = { pv: 0, san: 0, pe: 0 };

  if (acoes.includes("interludio-dormir")) {
    /* Prato nutritivo/energético sobem um degrau — só o de PV ou só o de PE,
     * conforme o prato, e não os dois. */
    const condPv = prato?.id === "nutritivo" ? subirDegrau(condicao).id : condicao;
    const condPe = prato?.id === "energetico" ? subirDegrau(condicao).id : condicao;
    out.pv += recuperacaoBase(peTurno, condPv);
    out.pe += recuperacaoBase(peTurno, condPe);
  }

  if (acoes.includes("interludio-relaxar")) {
    out.san += recuperacaoBase(peTurno, condicao);
    /* "Para cada personagem que realizar essa ação no mesmo interlúdio, TODOS
     * os participantes recuperam 1 ponto de Sanidade adicional" — inclusive o
     * próprio, que é por isso que o padrão é 1 e não 0. */
    const relaxantes = Math.max(1, Math.floor(Number(escolha?.relaxantes)) || 1);
    out.san += relaxantes;
    if (prato?.id === "favorito") out.san += 2;
  }

  return out;
}

/**
 * Aplica o interlúdio, grampeando ao máximo do personagem.
 * `registro.pv/san/pe` guarda o EFETIVAMENTE recuperado — histórico com número
 * que não aconteceu é mentira no livro-razão.
 */
export function aplicarInterludio(vitais, escolha) {
  const acoes = (Array.isArray(escolha?.acoes) ? escolha.acoes : []).filter(acaoPorId);
  if (acoes.length === 0) return { ok: false, motivo: "Escolha ao menos uma ação de interlúdio." };
  if (acoes.length > MAX_ACOES) return { ok: false, motivo: `O livro permite até ${MAX_ACOES} ações por interlúdio.` };

  const ganho = calcularRecuperacao(vitais, escolha);
  const v = vitais || {};
  const novos = {};
  const recuperado = {};

  for (const [chave, atual, max] of [
    ["pv", v.pv, v.pvMax],
    ["san", v.san, v.sanMax],
    ["pe", v.pe, v.peMax],
  ]) {
    const a = Math.floor(Number(atual)) || 0;
    const m = Math.floor(Number(max));
    /* Sem máximo conhecido não há como grampear, e deixar passar seria a única
     * forma de a recuperação furar o teto. */
    if (!Number.isFinite(m) || m <= 0) { novos[chave] = a; recuperado[chave] = 0; continue; }
    const alvo = Math.min(m, a + Math.max(0, ganho[chave]));
    novos[chave] = alvo;
    recuperado[chave] = alvo - a;
  }

  const usaDescanso = acoes.includes("interludio-dormir") || acoes.includes("interludio-relaxar");

  return {
    ok: true,
    vitais: { ...v, pv: novos.pv, san: novos.san, pe: novos.pe },
    registro: {
      id: escolha?.id || `int-${acoes.join("+")}`,
      acoes,
      acoesNomes: acoes.map((id) => acaoPorId(id).nome),
      condicao: usaDescanso ? condicaoPorId(escolha?.condicao).id : null,
      prato: acoes.includes("interludio-alimentar") ? (pratoPorId(escolha?.prato)?.id ?? null) : null,
      pv: recuperado.pv,
      san: recuperado.san,
      pe: recuperado.pe,
      nota: String(escolha?.nota ?? "").slice(0, 500),
    },
  };
}

/** Nada recuperado é informação — Ler e Manutenção não recuperam nada e são
 *  ações legítimas. */
export const registroVazio = (r) => !r || (!r.pv && !r.san && !r.pe);

/** Histórico com o mais recente primeiro, tolerante a lixo do Firestore.
 *  Aceita o formato antigo (`acao` singular, spec 0040) para não sumir com
 *  interlúdios já gravados em produção. */
export const historicoDeInterludios = (lista) =>
  (Array.isArray(lista) ? lista : [])
    .filter((r) => r && (Array.isArray(r.acoes) ? r.acoes.length > 0 : !!r.acao))
    .map((r) => (Array.isArray(r.acoes) ? r : { ...r, acoes: [r.acao], acoesNomes: [r.acaoNome || r.acao] }))
    .slice()
    .reverse();
