/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — GAME RULES
 *  ------------------------------------------------------------------------
 *  Pure logic shared by the Ordem Paranormal sheet. Fórmulas conferidas
 *  contra o livro oficial (spec 0006) — deslocamento, DT de rituais e
 *  patentes NÃO espelham mais o FullSheet legado do App.jsx.
 * ════════════════════════════════════════════════════════════════════════ */

/* The five attributes, in display order. attrs object is keyed by these. */
export const ATTR_KEYS = ["AGI", "FOR", "INT", "PRE", "VIG"];
export const ATTR_LABELS = {
  AGI: "Agilidade",
  FOR: "Força",
  INT: "Intelecto",
  PRE: "Presença",
  VIG: "Vigor",
};

/* 28 perícias. Markers: '*' = só treinado · '+' = precisa de kit/treino p/ bônus. */
const RAW_PERICIAS = [
  { n: "Acrobacia+", attr: "AGI" }, { n: "Adestramento*", attr: "PRE" }, { n: "Artes*", attr: "PRE" },
  { n: "Atletismo", attr: "FOR" }, { n: "Atualidades", attr: "INT" }, { n: "Ciências*", attr: "INT" },
  { n: "Crime*+", attr: "AGI" }, { n: "Diplomacia", attr: "PRE" }, { n: "Enganação", attr: "PRE" },
  { n: "Fortitude", attr: "VIG" }, { n: "Furtividade+", attr: "AGI" }, { n: "Iniciativa", attr: "AGI" },
  { n: "Intimidação", attr: "PRE" }, { n: "Intuição", attr: "PRE" }, { n: "Investigação", attr: "INT" },
  { n: "Luta", attr: "FOR" }, { n: "Medicina*", attr: "INT" }, { n: "Ocultismo*", attr: "INT" },
  { n: "Percepção", attr: "PRE" }, { n: "Pilotagem*", attr: "AGI" }, { n: "Pontaria", attr: "AGI" },
  { n: "Profissão*", attr: "INT" }, { n: "Reflexos", attr: "AGI" }, { n: "Religião*", attr: "PRE" },
  { n: "Sobrevivência*", attr: "INT" }, { n: "Tática*", attr: "INT" }, { n: "Tecnologia*", attr: "INT" },
  { n: "Vontade", attr: "PRE" },
];

/* Collapsible category each perícia belongs to (center-panel grouping). */
const CATEGORIA = {
  Acrobacia: "gerais", Atletismo: "gerais", Crime: "gerais", Fortitude: "gerais", Furtividade: "gerais",
  Iniciativa: "gerais", Luta: "gerais", Pilotagem: "gerais", Pontaria: "gerais", Reflexos: "gerais", "Sobrevivência": "gerais",
  Atualidades: "tecnicas", "Ciências": "tecnicas", Medicina: "tecnicas", "Profissão": "tecnicas", Tecnologia: "tecnicas", "Tática": "tecnicas",
  Adestramento: "sociais", Artes: "sociais", Diplomacia: "sociais", "Enganação": "sociais", "Intimidação": "sociais",
  "Investigação": "paranormais", "Intuição": "paranormais", Ocultismo: "paranormais", "Percepção": "paranormais", "Religião": "paranormais", Vontade: "paranormais",
};

export const PERICIA_GRUPOS = [
  { id: "gerais", label: "Perícias Gerais" },
  { id: "tecnicas", label: "Perícias Técnicas" },
  { id: "sociais", label: "Perícias Sociais" },
  { id: "paranormais", label: "Perícias Paranormais" },
];

export const PERICIAS = RAW_PERICIAS.map((p) => {
  const base = p.n.replace(/[*+]/g, "");
  return {
    raw: p.n,
    base,
    attr: p.attr,
    onlyTrained: p.n.includes("*"),
    needsKit: p.n.includes("+"),
    categoria: CATEGORIA[base] || "gerais",
  };
});

/* Default trained perícias granted by origem + classe (matches FullSheet). */
export function defaultTrainedSet(origem, classe) {
  const byClass =
    classe?.id === "combatente"
      ? ["Luta", "Pontaria", "Iniciativa", "Atletismo", "Reflexos"]
      : classe?.id === "especialista"
      ? ["Investigação", "Ciências", "Tecnologia", "Percepção"]
      : ["Ocultismo", "Vontade", "Religião", "Intuição"];
  return new Set([
    ...((origem?.skills || []).map((s) => s.replace(/[*+]/g, ""))),
    ...byClass,
  ]);
}

/* Training degree → bonus and tier color. 0 destreinado · 5 treinado · 10 competente · 15 expert
 * ("Competente" é o nome oficial do grau +10 no livro base — spec 0024 AC-3.) */
export const TREINO_TIERS = {
  0: { label: "Destreinado", color: "var(--muted)" },
  5: { label: "Treinado", color: "#4ade80" },
  10: { label: "Competente", color: "#60a5fa" },
  15: { label: "Expert", color: "var(--gold2)" },
};
export const treinoColor = (v) =>
  v >= 15 ? "var(--gold2)" : v >= 10 ? "#60a5fa" : v >= 5 ? "#4ade80" : "var(--muted)";

/* NEX level (5..99) → character "level" (0..19). 99% = level 19. */
export const nexLevel = (nex) => (nex === 99 ? 19 : (nex - 5) / 5);

/* Max PV / SAN / PE at a given NEX for a class (identical to App.jsx nexStats). */
export function nexStats(nexVal, classId, attrs) {
  const base = {
    combatente: { pv: 20 + attrs.VIG, san: 12, pe: 2 + attrs.PRE },
    especialista: { pv: 16 + attrs.VIG, san: 16, pe: 3 + attrs.PRE },
    ocultista: { pv: 12 + attrs.VIG, san: 20, pe: 4 + attrs.PRE },
  }[classId] ?? { pv: 12 + attrs.VIG, san: 20, pe: 4 + attrs.PRE };
  const perNex = {
    combatente: { pv: 4 + attrs.VIG, san: 3, pe: 2 + attrs.PRE },
    especialista: { pv: 3 + attrs.VIG, san: 4, pe: 3 + attrs.PRE },
    ocultista: { pv: 2 + attrs.VIG, san: 5, pe: 4 + attrs.PRE },
  }[classId] ?? { pv: 2 + attrs.VIG, san: 5, pe: 4 + attrs.PRE };
  const lvl = nexLevel(nexVal);
  return {
    pv: base.pv + lvl * perNex.pv,
    san: base.san + lvl * perNex.san,
    pe: base.pe + lvl * perNex.pe,
  };
}

/* Derived combat readouts (matches FullSheet).
 * NOTE: a ficha (OrdemParanormalSheet) recalcula Defesa/Esquiva/Deslocamento com os
 * bônus e o homebrew do Cellbit (Esquiva = 10+AGI+Reflexos). Aqui só sobra o que ela
 * de fato consome — `peTurno`. Os campos esquiva/bloqueio mortos foram removidos
 * (assessment-0021 §A). Defesa/deslocamento ficam por estarem cobertos por teste. */
export function deriveStats(attrs, nex) {
  return {
    defesa: 10 + attrs.AGI,
    peTurno: 1 + nexLevel(nex),
    deslocamento: "9m / 6q",
  };
}

/* Sobrecarga (oficial): o teto ABSOLUTO de carga é 2× a carga máxima — acima disso o
 * personagem não consegue carregar mais nada. Entre `cargaMaxima` e o teto ele está
 * sobrecarregado (-5 em Atletismo/Furtividade, -3m de deslocamento). */
export const cargaTeto = (attrs) => 2 * cargaMaxima(attrs);

/* Maior círculo de ritual que o NEX permite aprender (oficial, via assessment-0021 §A):
 * 1º=5%, 2º=25%, 3º=55%, 4º=85%. Usado só para AVISO visual — não trava (decisão Andre). */
export const circuloMaxNex = (nex) =>
  nex >= 85 ? 4 : nex >= 55 ? 3 : nex >= 25 ? 2 : nex >= 5 ? 1 : 0;

/* DT para resistir aos seus rituais (oficial): 10 + NEX/5 + Presença (+ bônus da ficha). */
export function dtRituais(nex, attrs, bonus = 0) {
  return 10 + (nexLevel(nex) + 1) + (attrs?.PRE || 0) + bonus;
}

/*
 * Ordem Paranormal d20 test: roll N d20 (N = attribute, min handling for 0),
 * keep the best (or worst when the attribute is 0). Identical to App.jsx rollOP.
 */
export function rollOP(attrVal) {
  const n = attrVal === 0 ? 2 : attrVal;
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * 20) + 1);
  const result = attrVal === 0 ? Math.min(...rolls) : Math.max(...rolls);
  return { rolls, result, worst: attrVal === 0, crit: rolls.includes(20), dice: "D20" };
}

/* Parse + roll a free expression like "2d6+3" / "1d20" / "d100-5". */
export function rollExpr(expr) {
  const m = String(expr).replace(/\s/g, "").match(/^(\d+)?[dD](\d+)([+-]\d+)?$/);
  if (!m) return null;
  const count = Math.min(parseInt(m[1] || "1", 10), 30);
  const sides = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3], 10) : 0;
  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  const sum = rolls.reduce((a, b) => a + b, 0) + mod;
  return {
    rolls,
    result: sum,
    mod,
    sides,
    count,
    crit: sides === 20 && rolls.includes(20),
    dice: `D${sides}`,
  };
}

/* ── Arsenal v2 (spec 0020) ─────────────────────────────────────────────── */

/* Tipos de dano oficiais de Ordem Paranormal (para o dropdown do editor de ataque). */
export const TIPOS_DANO = [
  "Balístico", "Corte", "Impacto", "Perfuração", "Fogo", "Frio", "Eletricidade",
  "Químico", "Mental", "Medo", "Morte", "Sangue", "Energia", "Conhecimento",
];

/* Alcances comuns (dropdown com opção livre). */
export const ALCANCES = ["Pessoal", "Toque", "Curto", "Médio", "Longo", "Extremo"];

/* Perícias de ataque + o atributo puro, para o dropdown de Perícia do ataque. */
export const PERICIAS_ATAQUE = ["Luta", "Pontaria", "FOR", "AGI", "INT", "PRE", "VIG"];

/**
 * Margem de ameaça: menor resultado no d20 que ainda é crítico.
 * Aceita "20", "19", "19-20", "19+"… → o menor número; default 20; clamp [2,20].
 */
export function critMargin(critico) {
  const m = String(critico ?? "20").match(/\d+/g);
  if (!m) return 20;
  const n = Math.min(...m.map(Number));
  return Math.min(20, Math.max(2, n));
}

/** O d20 MANTIDO (maior) é crítico se atingiu a margem de ameaça. */
export function isCritical(keptDie, critico) {
  return Number(keptDie) >= critMargin(critico);
}

/**
 * Combina o dano de um ataque (spec 0020 AC-2/AC-3). Recebe números JÁ rolados
 * (pureza/testabilidade). No crítico, o dano BASE é multiplicado pelo multiplicador;
 * o dano extra NÃO é multiplicado (dano adicional de efeito, padrão OP). Retorna o
 * total e o breakdown por tipo.
 * @param {number} base       dano base já rolado (inclui atributo de dano)
 * @param {number} mult       multiplicador de crítico (default 2)
 * @param {boolean} isCrit
 * @param {Array<{result:number,tipo?:string}>} extras  danos extra já rolados
 * @param {string} mainType   tipo do dano base
 */
export function combineDamage(base, mult, isCrit, extras = [], mainType = "") {
  const m = Number(mult) > 1 ? Math.floor(Number(mult)) : 2;
  const b = Math.max(0, Math.round(Number(base) || 0));
  const mainTotal = isCrit ? b * m : b;
  const byType = {};
  const addType = (tp, v) => { const k = tp || "—"; byType[k] = (byType[k] || 0) + v; };
  addType(mainType, mainTotal);
  let total = mainTotal;
  for (const e of extras || []) {
    const v = Math.max(0, Math.round(Number(e && e.result) || 0));
    if (!v) continue;
    total += v;
    addType(e.tipo, v);
  }
  return { total, byType };
}

/*
 * NEX clearance ladder (5% → 99%) for the progression matrix modal.
 * Tiers are decorative "classified clearance" bands; abilities note generic
 * Ordem milestones (full per-class trees come from the character's trilha).
 */
export const NEX_LADDER = [
  { nex: 5, tier: "INICIANTE", note: "Primeiro contato com o Paranormal. Poder de classe inicial." },
  { nex: 10, tier: "INICIANTE", note: "Habilidade de trilha (1º poder)." },
  { nex: 15, tier: "OPERACIONAL", note: "Poder de classe." },
  { nex: 20, tier: "OPERACIONAL", note: "Aumento de atributo." },
  { nex: 25, tier: "OPERACIONAL", note: "Marco de classe (ex.: rituais de 2º círculo para Ocultista)." },
  { nex: 30, tier: "VETERANO", note: "Poder de classe." },
  { nex: 35, tier: "VETERANO", note: "Grau de treinamento (5+INT perícias)." },
  { nex: 40, tier: "VETERANO", note: "Habilidade de trilha (2º poder)." },
  { nex: 45, tier: "VETERANO", note: "Poder de classe." },
  { nex: 50, tier: "ESPECIAL", note: "Aumento de atributo. Versatilidade. Afinidade elemental (escolha do elemento)." },
  { nex: 55, tier: "ESPECIAL", note: "Marco de classe (ex.: rituais de 3º círculo para Ocultista)." },
  { nex: 60, tier: "ESPECIAL", note: "Poder de classe." },
  { nex: 65, tier: "ESPECIAL", note: "Habilidade de trilha (3º poder)." },
  { nex: 70, tier: "CRÍTICO", note: "Grau de treinamento (5+INT perícias)." },
  { nex: 75, tier: "CRÍTICO", note: "Poder de classe." },
  { nex: 80, tier: "CRÍTICO", note: "Aumento de atributo." },
  { nex: 85, tier: "CRÍTICO", note: "Marco de classe (ex.: rituais de 4º círculo para Ocultista)." },
  { nex: 90, tier: "MÁXIMO", note: "Poder de classe. Limiar do Outro Lado." },
  { nex: 95, tier: "MÁXIMO", note: "Aumento de atributo." },
  { nex: 99, tier: "TRANSCENDENTE", note: "Habilidade de trilha (4º e último poder). Agente lendário." },
];

/* ── Classes ── */
export const CLASSES_OP = [
  { id:"combatente",  name:"Combatente",  icon:"⚔️", bonus:"PV +4 · Ataque +2 · Resistência Física" },
  { id:"especialista",name:"Especialista",icon:"🔬", bonus:"PE +4 · Perícia +2 · Conhecimento Amplo" },
  { id:"ocultista",   name:"Ocultista",   icon:"🌀", bonus:"SAN +4 · Rituais +2 · Afinidade Paranormal" },
];

/* ── Poderes nomeados por classe (escolhidos em marcos de NEX) ──
 * Catálogo fiel ao livro base v1.1 (spec 0024) — nomes oficiais, texto parafraseado.
 * Pré-requisitos ficam no início da desc. Fichas antigas guardam CÓPIAS das
 * habilidades adicionadas, então remover entradas daqui não altera ficha nenhuma. */
export const CLASS_POWERS = {
  combatente: [
    {id:"acuidade_arma",   name:"Acuidade com Arma",       cost:"—",    desc:"Pré: AGI 1. Com armas corpo a corpo leves ou de arremesso, você pode usar Agilidade no lugar de Força nos testes de ataque e nas rolagens de dano."},
    {id:"atq_oportunidade",name:"Ataque de Oportunidade",  cost:"1 PE (reação)", desc:"Quando um inimigo sai voluntariamente de um espaço adjacente ao seu, gaste uma reação e 1 PE para fazer um ataque corpo a corpo contra ele."},
    {id:"comb_defensivo",  name:"Combate Defensivo",       cost:"1 PE", desc:"Pré: INT 1. Ao agredir, gaste 1 PE para receber +5 na Defesa até o seu próximo turno, sofrendo −1d nos testes de ataque."},
    {id:"comb_duas_armas", name:"Combater com Duas Armas", cost:"2 PE", desc:"Pré: AGI 2, treinado em Luta ou Pontaria. Empunhando duas armas, gaste 2 PE para fazer um ataque com cada uma, sofrendo −1d em todos os testes de ataque."},
    {id:"competencia_per", name:"Competência em Perícia",  cost:"—",    desc:"Pré: NEX 35%. Escolha uma perícia treinada: seu grau nela sobe para competente (+10)."},
    {id:"determinacao_fis",name:"Determinação Física",     cost:"2 PE", desc:"Uma vez por cena, gaste 2 PE para realizar uma ação de investigação adicional usando Força ou Agilidade."},
    {id:"expert_pericia",  name:"Expert em Perícia",       cost:"—",    desc:"Pré: NEX 70%. Escolha uma perícia competente: seu grau nela sobe para expert (+15)."},
    {id:"golpe_demolidor", name:"Golpe Demolidor",         cost:"1 PE", desc:"Pré: FOR 2, treinado em Luta. Ao atacar objetos ou quebrar estruturas, gaste 1 PE para causar dois dados extras de dano."},
    {id:"golpe_pesado",    name:"Golpe Pesado",            cost:"—",    desc:"O dano das suas armas corpo a corpo aumenta em um passo (ex.: 1d8 → 1d10)."},
    {id:"presteza_atletica",name:"Presteza Atlética",      cost:"1 PE", desc:"Gaste 1 PE para facilitar uma ação de investigação com Força ou Agilidade; um aliado ajudado recebe +1d."},
    {id:"protecao_pesada", name:"Proteção Pesada",         cost:"—",    desc:"Pré: NEX 30%. Você recebe proficiência com proteções pesadas."},
    {id:"saque_rapido",    name:"Saque Rápido",            cost:"—",    desc:"Pré: treinado em Iniciativa. Você saca ou guarda itens como ação livre e o tempo de recarga das suas armas diminui em uma categoria."},
    {id:"segurar_gatilho", name:"Segurar o Gatilho",       cost:"PE progressivo", desc:"Pré: NEX 60%. Com armas de fogo, faça ataques adicionais no turno gastando PE crescente (1 PE no primeiro extra, 2 no segundo…)."},
    {id:"tanque_guerra",   name:"Tanque de Guerra",        cost:"—",    desc:"Pré: Proteção Pesada. Suas proteções ocupam 1 espaço a menos e não impõem penalidade de Agilidade."},
    {id:"tiro_certeiro",   name:"Tiro Certeiro",           cost:"—",    desc:"Pré: treinado em Pontaria. Soma sua Agilidade nas rolagens de dano com armas de disparo e ignora a penalidade por atirar engajado em corpo a corpo."},
    {id:"tiro_cobertura",  name:"Tiro de Cobertura",       cost:"1 PE", desc:"Use uma ação padrão e 1 PE para forçar um alvo a se proteger: teste de Pontaria oposto pela Vontade dele; se vencer, ele perde a próxima ação."},
    {id:"transcender",     name:"Transcender",             cost:"—",    desc:"Você aceita o Outro Lado: escolhe um poder paranormal e perde Sanidade em troca. Pode ser escolhido mais de uma vez."},
    {id:"treinamento_per", name:"Treinamento em Perícia",  cost:"—",    desc:"Você se torna treinado em duas perícias à sua escolha. Pode ser escolhido mais de uma vez."},
  ],
  especialista: [
    {id:"acuidade_arma",   name:"Acuidade com Arma",       cost:"—",    desc:"Pré: AGI 1. Com armas corpo a corpo leves ou de arremesso, você pode usar Agilidade no lugar de Força nos testes de ataque e nas rolagens de dano."},
    {id:"balistica_avancada",name:"Balística Avançada",    cost:"—",    desc:"Você recebe proficiência com armas de fogo longas."},
    {id:"competencia_per", name:"Competência em Perícia",  cost:"—",    desc:"Pré: NEX 35%. Escolha uma perícia treinada: seu grau nela sobe para competente (+10)."},
    {id:"conhecimento_apl",name:"Conhecimento Aplicado",   cost:"2 PE", desc:"Escolha duas perícias de Intelecto: você recebe +1d em ações de investigação com elas e pode gastar 2 PE para receber +5 no próximo teste ligado a uma pista."},
    {id:"expedito_explosivos",name:"Expedito em Explosivos",cost:"—",   desc:"Você soma seu Intelecto na DT dos seus explosivos e pode excluir da área um número de alvos igual ao seu Intelecto."},
    {id:"expert_pericia",  name:"Expert em Perícia",       cost:"—",    desc:"Pré: NEX 70%. Escolha uma perícia competente: seu grau nela sobe para expert (+15)."},
    {id:"hacker",          name:"Hacker",                  cost:"—",    desc:"Pré: treinado em Tecnologia. Você recebe +5 em Tecnologia para invadir sistemas e o tempo da invasão cai para uma ação completa."},
    {id:"kit_aprimorado",  name:"Kit Aprimorado",          cost:"—",    desc:"Kits de perícia contam como uma categoria abaixo para você."},
    {id:"movimento_tatico",name:"Movimento Tático",        cost:"1 PE", desc:"Pré: treinado em Atletismo. Gaste 1 PE para ignorar penalidades de terreno difícil no seu deslocamento neste turno."},
    {id:"na_trilha_certa", name:"Na Trilha Certa",         cost:"1 PE", desc:"Após um sucesso em ação de investigação, gaste 1 PE para receber +1d cumulativo na próxima ação de investigação da mesma cena."},
    {id:"ninja_urbano",    name:"Ninja Urbano",            cost:"—",    desc:"Você recebe proficiência com armas táticas."},
    {id:"pensamento_agil", name:"Pensamento Ágil",         cost:"2 PE", desc:"Uma vez por rodada, gaste 2 PE para realizar uma ação de investigação adicional."},
    {id:"primeira_impressao",name:"Primeira Impressão",    cost:"—",    desc:"Você recebe +2d no primeiro teste de perícia social que fizer em uma cena."},
    {id:"transcender",     name:"Transcender",             cost:"—",    desc:"Você aceita o Outro Lado: escolhe um poder paranormal e perde Sanidade em troca. Pode ser escolhido mais de uma vez."},
    {id:"treinamento_per", name:"Treinamento em Perícia",  cost:"—",    desc:"Você se torna treinado em duas perícias à sua escolha. Pode ser escolhido mais de uma vez."},
  ],
  ocultista: [
    {id:"camuflar_ocultismo",name:"Camuflar Ocultismo",    cost:"2 PE", desc:"Ação livre para ocultar seus símbolos e marcas paranormais; gaste 2 PE para conjurar um ritual sem gestos ou palavras perceptíveis."},
    {id:"competencia_per", name:"Competência em Perícia",  cost:"—",    desc:"Pré: NEX 35%. Escolha uma perícia treinada: seu grau nela sobe para competente (+10)."},
    {id:"envolto_misterio",name:"Envolto em Mistério",     cost:"—",    desc:"Você recebe +5 em Enganação e Intimidação contra quem não é treinado em Ocultismo."},
    {id:"especialista_elem",name:"Especialista em Elemento",cost:"—",   desc:"Escolha um elemento: a DT para resistir aos seus rituais desse elemento aumenta em +2."},
    {id:"expert_pericia",  name:"Expert em Perícia",       cost:"—",    desc:"Pré: NEX 70%. Escolha uma perícia competente: seu grau nela sobe para expert (+15)."},
    {id:"ferramentas_para",name:"Ferramentas Paranormais", cost:"—",    desc:"Uma vez por cena, você ativa um equipamento paranormal sem pagar o custo dele."},
    {id:"fluxo_poder",     name:"Fluxo de Poder",          cost:"—",    desc:"Pré: NEX 60%. Você pode manter dois rituais sustentados ao mesmo tempo com a mesma ação livre."},
    {id:"guiado_paranormal",name:"Guiado pelo Paranormal", cost:"2 PE", desc:"Uma vez por cena, gaste 2 PE para realizar uma ação de investigação adicional."},
    {id:"identificacao_para",name:"Identificação Paranormal",cost:"—",  desc:"Você recebe +10 em Ocultismo para identificar criaturas, objetos e rituais."},
    {id:"intuicao_para",   name:"Intuição Paranormal",     cost:"—",    desc:"Você soma Intelecto ou Presença (o maior) ao facilitar ações de investigação ligadas ao paranormal."},
    {id:"mestre_elemento", name:"Mestre em Elemento",      cost:"—",    desc:"Pré: Especialista no elemento, NEX 45%. O custo dos seus rituais desse elemento diminui em 1 PE."},
    {id:"ritual_potente",  name:"Ritual Potente",          cost:"—",    desc:"Pré: INT 1. Você soma seu Intelecto nas rolagens de dano ou cura dos seus rituais."},
    {id:"ritual_predileto",name:"Ritual Predileto",        cost:"—",    desc:"Escolha um ritual que conhece: o custo dele diminui em 1 PE (mínimo 1). Pode ser escolhido mais de uma vez, para rituais diferentes."},
    {id:"tatuagem_ritual", name:"Tatuagem Ritualística",   cost:"—",    desc:"Rituais com alcance pessoal que tenham você como alvo custam 1 PE a menos."},
    {id:"transcender",     name:"Transcender",             cost:"—",    desc:"Você aceita o Outro Lado: escolhe um poder paranormal e perde Sanidade em troca. Pode ser escolhido mais de uma vez."},
    {id:"treinamento_per", name:"Treinamento em Perícia",  cost:"—",    desc:"Você se torna treinado em duas perícias à sua escolha. Pode ser escolhido mais de uma vez."},
  ],
};

/* ── Trilhas por classe ── */
export const CLASS_TRAILS = {
  combatente:  [
    {id:"aniquilador",  name:"Aniquilador"},
    {id:"comandante",   name:"Comandante de Campo"},
    {id:"guerreiro",    name:"Guerreiro"},
    {id:"op_especiais", name:"Operações Especiais"},
    {id:"tropa_choque", name:"Tropa de Choque"},
  ],
  especialista:[
    {id:"atirador_e",  name:"Atirador de Elite"},
    {id:"infiltrador", name:"Infiltrador"},
    {id:"medico",      name:"Médico de Campo"},
    {id:"negociador",  name:"Negociador"},
    {id:"tecnico",     name:"Técnico"},
  ],
  ocultista:   [
    {id:"conduite",    name:"Conduíte"},
    {id:"flagelador",  name:"Flagelador"},
    {id:"graduado",    name:"Graduado"},
    {id:"intuitivo",   name:"Intuitivo"},
    {id:"lamina_para", name:"Lâmina Paranormal"},
  ],
};

/* ── Poderes de Trilha (NEX 10/40/65/99) ── */
export const TRAIL_ABILITIES = {
  aniquilador:{
    10:{name:"Ataque Poderoso",  cost:"—",    desc:"Você pode aceitar −2 no teste de ataque para receber +1d10 na rolagem de dano com armas corpo a corpo ou pesadas."},
    40:{name:"Destruidor",       cost:"2 PE", desc:"Ao acertar um ataque, gaste 2 PE para ignorar a resistência a dano físico do alvo. O dano não pode ser reduzido por nenhum meio."},
    65:{name:"Incontível",       cost:"—",    desc:"Você não pode ser imobilizado, agarrado ou derrubado involuntariamente. Se sofrer essas condições, remove-as como ação livre."},
    99:{name:"Força Bruta",      cost:"5 PE", desc:"Uma vez por cena, declare Força Bruta antes de atacar. O ataque acerta automaticamente e causa o dano máximo possível, ignorando todas as resistências."},
  },
  comandante:{
    10:{name:"Inspirar Confiança",cost:"2 PE (reação)",desc:"Faça um aliado em alcance curto rolar novamente um teste recém realizado, usando o melhor resultado."},
    40:{name:"Estrategista",      cost:"1 PE/aliado",  desc:"Use uma ação padrão para coordenar aliados (máximo INT). No próximo turno, cada aliado coordenado ganha uma ação de movimento adicional."},
    65:{name:"Brecha na Guarda",  cost:"2 PE (reação)",desc:"Quando um aliado acerta um inimigo em alcance curto, você ou outro aliado pode imediatamente fazer um ataque gratuito contra esse mesmo inimigo."},
    99:{name:"Oficial Comandante",cost:"5 PE",         desc:"Cada aliado em alcance médio recebe uma ação padrão adicional no próximo turno. Eles podem usá-la apenas para atacar ou se mover."},
  },
  guerreiro:{
    10:{name:"Técnica Letal",   cost:"—",            desc:"+2 na margem de ameaça com todos os ataques corpo a corpo. Quando ameaça crítico, rola dano duas vezes e escolhe o maior."},
    40:{name:"Revidar",         cost:"2 PE (reação)", desc:"Sempre que bloquear ou esquivar de um ataque com sucesso, faça imediatamente um ataque corpo a corpo no inimigo que o atacou."},
    65:{name:"Força Opressora", cost:"1 PE",          desc:"Quando acerta um ataque corpo a corpo, realize uma manobra derrubar ou empurrar como ação livre sem teste oposto."},
    99:{name:"Potência Máxima", cost:"—",             desc:"Quando usa Ataque Especial com armas corpo a corpo, todos os dados de dano são considerados o resultado máximo possível."},
  },
  op_especiais:{
    10:{name:"Furtividade Tática", cost:"—",    desc:"Você pode se mover à velocidade total sem penalidade em testes de Furtividade. Quando ataca de surpresa, causa +2d6 de dano."},
    40:{name:"Ponto Fraco",        cost:"2 PE", desc:"Uma vez por rodada, ao acertar um ataque, gaste 2 PE para causar dano adicional igual ao seu valor de Agilidade e reduzir a Defesa do alvo em 2 até o fim da rodada."},
    65:{name:"Execução",           cost:"3 PE", desc:"Contra um alvo com metade ou menos de seus PV máximos, gaste 3 PE para que seu ataque cause o dobro do dano total."},
    99:{name:"Fantasma",           cost:"5 PE", desc:"Uma vez por cena, torne-se invisível por até 1 minuto. Ataques enquanto invisível acertam automaticamente e causam dano máximo."},
  },
  tropa_choque:{
    10:{name:"Resistência Tática", cost:"—",            desc:"Você recebe resistência a dano físico (balístico, cortante, contundente) igual à metade do seu valor de Vigor (mínimo 1)."},
    40:{name:"Escudo Humano",      cost:"2 PE (reação)", desc:"Quando um aliado adjacente for alvo de um ataque, use sua reação para interpor-se. Você recebe o dano no lugar do aliado."},
    65:{name:"Obstáculo",          cost:"1 PE",          desc:"Inimigos que se movam através do seu alcance corpo a corpo devem passar em Atletismo (DT 10 + seu VIG) ou param o movimento."},
    99:{name:"Fortaleza",          cost:"—",             desc:"Seu valor máximo de PV aumenta em 20. Quando reduzido a 0 PV, você pode, uma vez por cena, continuar agindo com 1 PV por mais uma rodada."},
  },
  infiltrador:{
    10:{name:"Ataque Furtivo",     cost:"—",    desc:"Uma vez por rodada, ao atingir com ataque corpo a corpo ou em alcance curto um alvo desprevenido — ou que você esteja flanqueando —, você causa +1d6 de dano do mesmo tipo da arma. O dano extra aumenta para +2d6 no NEX 40%, +4d6 no 65% e +8d6 no 99%."},
    40:{name:"Gatuno",             cost:"—",    desc:"Você recebe +5 em Atletismo e Crime e pode se deslocar com velocidade normal enquanto se esconde, sem sofrer penalidade no teste de Furtividade."},
    65:{name:"Assassinar",         cost:"3 PE", desc:"Gaste uma ação de movimento e 3 PE para estudar um alvo em alcance curto. Até o fim do seu próximo turno, o primeiro Ataque Furtivo que causar dano nele tem os dados de dano extras dobrados."},
    99:{name:"Sombra Fugaz",       cost:"—",    desc:"Você se move como um fantasma: não sofre penalidades em testes de Furtividade por atacar ou realizar outras ações chamativas."},
  },
  tecnico:{
    10:{name:"Inventário Otimizado",cost:"—",    desc:"Você soma seu Intelecto à Força para calcular a capacidade de carga, podendo carregar o equipamento de toda a equipe."},
    40:{name:"Remendão",            cost:"1 PE", desc:"Gaste uma ação completa e 1 PE para remover a condição Quebrado de um equipamento adjacente até o fim da cena. Além disso, equipamentos gerais contam como uma categoria abaixo para você."},
    65:{name:"Improvisar",          cost:"2 PE+",desc:"Com materiais ao seu redor, gaste uma ação completa e 2 PE (+2 PE por categoria do item) para montar um equipamento geral à sua escolha."},
    99:{name:"Preparado para Tudo", cost:"3 PE/cat.", desc:"Quando precisar de um equipamento de investigação ou combate (exceto armas) que não esteja no seu inventário, gaste 3 PE por categoria do item: você o tinha guardado no fundo da mochila."},
  },
  atirador_e:{
    10:{name:"Foco Total",       cost:"—",     desc:"Quando usa a ação mirar, você recebe +5 no teste de ataque e +1d6 na rolagem de dano."},
    40:{name:"Execução",         cost:"—",     desc:"Se um alvo está inconsciente ou não sabe que você está lá, seu ataque causa dano máximo."},
    65:{name:"Tiro Perfurante",  cost:"—",     desc:"Seus ataques com armas de fogo podem atingir todos os alvos em linha reta no alcance da arma."},
    99:{name:"Sniper Lendário",  cost:"5 PE",  desc:"Uma vez por cena, faça um ataque que ignora todos os bônus de Defesa, resistência e cobertura do alvo."},
  },
  medico:{
    10:{name:"Paramédico",      cost:"2 PE",   desc:"Use uma ação padrão e 2 PE para curar 2d10 PV de si mesmo ou de um aliado adjacente."},
    40:{name:"Equipe de Trauma",cost:"2 PE",   desc:"Use uma ação padrão e 2 PE para remover uma condição negativa (exceto morrendo) de um aliado adjacente."},
    65:{name:"Resgate",         cost:"—",      desc:"Uma vez por rodada, se em alcance curto de aliado machucado ou morrendo, aproxime-se como ação livre. Ao curar, você e o aliado recebem +5 na Defesa até o próximo turno."},
    99:{name:"Reanimação",      cost:"10 PE",  desc:"Uma vez por cena, gaste uma ação completa e 10 PE para trazer de volta à vida um personagem que morreu na mesma cena (exceto dano massivo)."},
  },
  negociador:{
    10:{name:"Eloquência",          cost:"1 PE/alvo",desc:"Use uma ação completa e 1 PE por alvo para afetá-los com sua fala. Faça Diplomacia, Enganação ou Intimidação contra a Vontade deles."},
    40:{name:"Persuasão Profunda",  cost:"—",       desc:"Quando usa Eloquência e vence por 10 ou mais, o alvo fica sob efeito por toda a cena."},
    65:{name:"Psicologia Aplicada", cost:"3 PE",    desc:"Uma vez por cena, teste de Intuição (DT 15) para descobrir uma fraqueza ou motivação. Receba +5 em testes de Presença contra esse personagem."},
    99:{name:"Mestre das Palavras", cost:"—",       desc:"Você pode usar Eloquência como ação padrão. Aliados em alcance curto recebem +5 em testes de Presença."},
  },
  conduite:{
    10:{name:"Ampliar Ritual",    cost:"2 PE",    desc:"Ao lançar um ritual, gaste 2 PE para aumentar seu efeito em 50% — dano, cura, duração ou área afetada."},
    40:{name:"Acelerar Ritual",   cost:"3 PE",    desc:"Reduza a execução de um ritual em uma categoria (longa→completa→padrão→livre). Gaste 3 PE ao declarar a aceleração."},
    65:{name:"Anular Ritual",     cost:"4 PE (reação)",desc:"Quando um ritual for lançado em alcance médio, use sua reação e gaste 4 PE para realizar um teste de Ocultismo oposto. Se vencer, o ritual é anulado sem efeito."},
    99:{name:"Canalizar o Medo", cost:"5 PE",    desc:"Uma vez por cena, canaliza o pavor coletivo em alcance médio. Todos os inimigos que falharem em Vontade (DT 8 + NEX/10) ficam Abalados e sofrem 4d10 de dano paranormal."},
  },
  flagelador:{
    10:{name:"Aura de Sofrimento",cost:"2 PE",   desc:"Ative como ação livre. Inimigos que iniciarem o turno adjacentes a você devem passar em Fortitude (DT 10 + PRE) ou sofrem 1d6 de dano paranormal e ficam com −1 em todos os testes até o fim da rodada."},
    40:{name:"Açoite Paranormal", cost:"2 PE",   desc:"Ataque paranormal em alcance médio: teste de Ocultismo vs. Reflexos do alvo. Se acertar, causa 2d8 de dano paranormal e o alvo perde sua próxima ação de movimento."},
    65:{name:"Punição Ritualística",cost:"3 PE", desc:"Ao causar dano paranormal em um alvo, você pode gastar 3 PE para que ele sofra o mesmo valor de dano novamente no início do próximo turno, sem direito a resistência."},
    99:{name:"Terror Encarnado",  cost:"5 PE",   desc:"Uma vez por cena, manifeste o terror do Outro Lado. Todos os inimigos em alcance curto devem passar em Vontade (DT 8 + PRE) ou ficam Apavorados por 3 rodadas e sofrem 3d10 de dano paranormal."},
  },
  graduado:{
    10:{name:"Saber Ampliado",       cost:"—", desc:"Aprenda um ritual de 1° círculo adicional. Toda vez que ganha acesso a um novo círculo, aprende um ritual adicional daquele círculo."},
    40:{name:"Grimório Ritualístico", cost:"—", desc:"Crie um grimório especial. Aprenda rituais de 1° ou 2° círculos iguais ao seu INT. O grimório ocupa 1 espaço no inventário."},
    65:{name:"Rituais Eficientes",    cost:"—", desc:"A DT para resistir a todos os seus rituais aumenta em +5."},
    99:{name:"Conhecendo o Medo",     cost:"—", desc:"Você aprende o ritual Conhecendo o Medo."},
  },
  intuitivo:{
    10:{name:"Mente Sã",       cost:"—",    desc:"Você recebe resistência paranormal +5 (+5 em testes de resistência contra efeitos paranormais)."},
    40:{name:"Barreira Mental", cost:"—",   desc:"Quando passa em um teste de resistência contra efeito paranormal, recupera 1d6 de Sanidade."},
    65:{name:"Vontade de Ferro",cost:"2 PE",desc:"Role novamente um teste de resistência contra efeito paranormal. Seu valor máximo de Sanidade aumenta em 10."},
    99:{name:"Além do Alcance", cost:"—",  desc:"Imune a efeitos de medo paranormal e sua Sanidade não pode ser reduzida abaixo de 1 por efeitos paranormais."},
  },
  lamina_para:{
    10:{name:"Lâmina de Éter",      cost:"1 PE",  desc:"Manifeste uma lâmina de energia paranormal. Ela causa 1d8 de dano paranormal, usa PRE no lugar de FOR nos testes de ataque e ignora armaduras não-mágicas."},
    40:{name:"Golpe Ritual",         cost:"2 PE",  desc:"Ao acertar com a Lâmina de Éter, gaste 2 PE para infundir um ritual de 1° círculo no golpe, aplicando seu efeito ao alvo automaticamente (sem teste oposto)."},
    65:{name:"Corte Dimensional",    cost:"3 PE",  desc:"Seu ataque com a Lâmina de Éter atravessa dimensões — ignora cobertura, resistência física e pode atingir alvos etéreos ou invisíveis."},
    99:{name:"Execução Paranormal",  cost:"5 PE",  desc:"Uma vez por cena, declare antes de atacar. Se acertar, o alvo sofre dano máximo da Lâmina de Éter mais 5d10 de dano paranormal e deve passar em Fortitude (DT 8 + PRE) ou cair inconsciente."},
  },
};

/* ── Progressão Base por Classe (não-trilha) ── */
export const CLASS_BASE_ABILITIES = {
  combatente:[
    {nex:5,  name:"Ataque Especial",    cost:"2 PE",  desc:"Quando faz um ataque, gaste 2 PE para receber +5 no teste de ataque ou na rolagem de dano."},
    {nex:10, name:"Habilidade de Trilha",cost:"—",   desc:"Escolha uma trilha de Combatente e receba seu 1° poder.", isTrilhaMark:true},
    {nex:15, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:20, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo à sua escolha em +1 (máximo 5)."},
    {nex:25, name:"Ataque Especial ↑",  cost:"3 PE", desc:"Gaste 3 PE para receber +10 no ataque ou dano."},
    {nex:30, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:35, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; seu grau de treinamento nelas aumenta em um."},
    {nex:40, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 2° poder da sua trilha de Combatente.", isTrilhaMark:true},
    {nex:45, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:50, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:50, name:"Versatilidade",      cost:"—",    desc:"Escolha um poder de combatente ou o 1° poder de uma trilha que não a sua."},
    {nex:55, name:"Ataque Especial ↑",  cost:"4 PE", desc:"Gaste 4 PE para receber +15 no ataque ou dano."},
    {nex:60, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:65, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 3° poder da sua trilha de Combatente.", isTrilhaMark:true},
    {nex:70, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:75, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:80, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:85, name:"Ataque Especial ↑",  cost:"5 PE", desc:"Gaste 5 PE para receber +20 no ataque ou dano."},
    {nex:90, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:95, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:99, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 4° e último poder da sua trilha de Combatente.", isTrilhaMark:true},
  ],
  especialista:[
    {nex:5,  name:"Eclético",           cost:"2 PE",  desc:"Gaste 2 PE para receber os benefícios de ser treinado em qualquer perícia usada."},
    {nex:5,  name:"Perito (1d6)",       cost:"2 PE",  desc:"Escolha duas perícias treinadas. Gaste 2 PE para somar +1d6 no resultado do teste."},
    {nex:10, name:"Habilidade de Trilha",cost:"—",   desc:"Escolha uma trilha de Especialista e receba seu 1° poder.", isTrilhaMark:true},
    {nex:15, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:20, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:25, name:"Perito (1d8)",       cost:"3 PE",  desc:"Gaste 3 PE para somar +1d8 no resultado do teste."},
    {nex:30, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:35, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:40, name:"Engenhosidade",      cost:"+2 PE", desc:"Ao usar Eclético, gaste +2 PE adicionais para receber os benefícios de competente na perícia."},
    {nex:40, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 2° poder da sua trilha de Especialista.", isTrilhaMark:true},
    {nex:45, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:50, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:50, name:"Versatilidade",      cost:"—",    desc:"Escolha um poder de especialista ou o 1° poder de uma trilha que não a sua."},
    {nex:55, name:"Perito (1d10)",      cost:"4 PE",  desc:"Gaste 4 PE para somar +1d10 no resultado do teste."},
    {nex:60, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:65, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 3° poder da sua trilha de Especialista.", isTrilhaMark:true},
    {nex:70, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:75, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:75, name:"Engenhosidade Avançada",cost:"+4 PE",desc:"Ao usar Eclético, gaste +4 PE adicionais para receber benefícios de expert na perícia."},
    {nex:80, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:85, name:"Perito (1d12)",      cost:"5 PE",  desc:"Gaste 5 PE para somar +1d12 no resultado do teste."},
    {nex:90, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:95, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:99, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 4° e último poder da sua trilha de Especialista.", isTrilhaMark:true},
  ],
  ocultista:[
    {nex:5,  name:"Escolhido pelo Outro Lado",cost:"—", desc:"Lança rituais de 1° círculo. Começa com 3 rituais de 1° círculo."},
    {nex:10, name:"Habilidade de Trilha",     cost:"—", desc:"Escolha uma trilha de Ocultista e receba seu 1° poder.", isTrilhaMark:true},
    {nex:15, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:20, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:25, name:"Rituais de 2° Círculo",    cost:"—", desc:"Você agora pode lançar rituais de 2° círculo."},
    {nex:30, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:35, name:"Grau de Treinamento",      cost:"—", desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:40, name:"Habilidade de Trilha",     cost:"—", desc:"Receba o 2° poder da sua trilha de Ocultista.", isTrilhaMark:true},
    {nex:45, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:50, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:50, name:"Versatilidade",            cost:"—", desc:"Escolha um poder de ocultista ou o 1° poder de uma trilha que não a sua."},
    {nex:55, name:"Rituais de 3° Círculo",    cost:"—", desc:"Você agora pode lançar rituais de 3° círculo."},
    {nex:60, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:65, name:"Habilidade de Trilha",     cost:"—", desc:"Receba o 3° poder da sua trilha de Ocultista.", isTrilhaMark:true},
    {nex:70, name:"Grau de Treinamento",      cost:"—", desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:75, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:80, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:85, name:"Rituais de 4° Círculo",    cost:"—", desc:"Você agora pode lançar rituais de 4° círculo."},
    {nex:90, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:95, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:99, name:"Habilidade de Trilha",     cost:"—", desc:"Receba o 4° e último poder da sua trilha de Ocultista.", isTrilhaMark:true},
  ],
};

/*
 * ── Patentes (tabela oficial, spec 0006) ──
 * Patente é concedida por Pontos de Prestígio (PP), não por NEX. Limite de
 * itens por categoria [Cat. 0, I, II, III, IV] (null = ilimitado) e limite
 * de crédito correspondente.
 */
export const PATENTES = [
  { nome: "Recruta",              prestigioMin: 0,   limiteItens: [null, 2, 0, 0, 0], limiteCredito: "Baixo" },
  { nome: "Operador",             prestigioMin: 20,  limiteItens: [null, 3, 1, 0, 0], limiteCredito: "Médio" },
  { nome: "Agente especial",      prestigioMin: 50,  limiteItens: [null, 3, 2, 1, 0], limiteCredito: "Médio" },
  { nome: "Oficial de operações", prestigioMin: 100, limiteItens: [null, 3, 3, 2, 1], limiteCredito: "Alto" },
  { nome: "Agente de elite",      prestigioMin: 200, limiteItens: [null, 3, 3, 3, 2], limiteCredito: "Ilimitado" },
];

export function patenteForPrestigio(pp) {
  const v = Number(pp) || 0;
  return [...PATENTES].reverse().find((p) => v >= p.prestigioMin) || PATENTES[0];
}

/* Capacidade de carga (em espaços) — baseada em Força. Mesma ressalva acima. */
export function cargaMaxima(attrs) {
  return 5 + (attrs?.FOR || 0) * 5;
}

/* Format a roll for the campaign feed / onRoll bridge (matches App handleRoll). */
export function rollPayload(label, res, charName, elemento) {
  return {
    attr: label,
    name: label,
    expr: res.expr || label,
    rolls: res.rolls,
    result: res.result,
    dice: res.dice || "D20",
    crit: !!res.crit,
    worst: !!res.worst,
    kind: res.kind || null,          // 'attack' | null
    dano: res.dano ?? null,          // total do dano (ataques)
    danoRolls: res.danoRolls ?? null,
    rollType: res.rollType || null,  // 'attribute'|'skill'|'attack'|'custom'
    elemento: elemento || null,      // elemento do personagem que rolou
    charName,
  };
}
