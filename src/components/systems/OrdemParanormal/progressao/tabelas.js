/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — TABELAS OFICIAIS DE PROGRESSÃO
 *  ------------------------------------------------------------------------
 *  Dados puros, conferidos página a página contra o livro de regras
 *  (v1.2, mai/2023 — o PDF que o Andre mantém fora do repo):
 *
 *    Tabela 1.2 (pg. 23) — Progressão de personagem: limite de PE por turno.
 *    Tabela 1.3 (pg. 25) — O Combatente.
 *    Tabela 1.4 (pg. 29) — O Especialista.
 *    Tabela 1.5 (pg. 33) — O Ocultista.
 *    pgs. 24/28/32      — PV/PE/SAN iniciais e por NEX, perícias, proficiências.
 *    pg. 116            — Afinidade: no NEX 50% o agente se liga a um elemento.
 *
 *  Este arquivo NÃO tem lógica: é a transcrição da regra. O motor vive em
 *  `motor.js` e os textos das habilidades vêm de `../rules.js` (catálogo).
 * ════════════════════════════════════════════════════════════════════════ */

/* Os 20 degraus de NEX. O 99% é o teto — 100% exige Desconjuração (pg. 23). */
export const NEX_STEPS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99];

export const NEX_MIN = 5;
export const NEX_MAX = 99;

/* Elementos com que se pode ter afinidade (pg. 116). Medo está de fora: o
 * livro é explícito — "não é possível ter afinidade com Medo". */
export const ELEMENTOS_AFINIDADE = ["conhecimento", "energia", "morte", "sangue"];
export const NEX_AFINIDADE = 50;

/* ── Características das classes (pgs. 24, 28 e 32) ───────────────────────
 * pv/pe/san: { base, porNex } — `base` é o valor inicial em NEX 5% e
 * `porNex` o ganho a cada novo nível de exposição. `vig`/`pre` dizem se o
 * atributo entra na conta (PV soma Vigor, PE soma Presença).
 *
 * periciasFixas       — concedidas de graça pela classe.
 * periciasEscolhaUma  — grupos onde o agente escolhe UMA das listadas.
 * periciasLivres(int) — quantas perícias à escolha, em função do Intelecto.
 * grauTreinamento(int)— quantas perícias sobem de grau nos NEX 35% e 70%.
 *                       ATENÇÃO: o número MUDA por classe (2/5/3 + Int). */
export const CLASSES = {
  combatente: {
    id: "combatente",
    nome: "Combatente",
    pv: { base: 20, porNex: 4, vig: true },
    pe: { base: 2, porNex: 2, pre: true },
    san: { base: 12, porNex: 3 },
    periciasFixas: [],
    periciasEscolhaUma: [["Luta", "Pontaria"], ["Fortitude", "Reflexos"]],
    periciasLivres: (int) => 1 + int,
    proficiencias: ["Armas simples", "Armas táticas", "Proteções leves"],
    grauTreinamento: (int) => 2 + int,
  },
  especialista: {
    id: "especialista",
    nome: "Especialista",
    pv: { base: 16, porNex: 3, vig: true },
    pe: { base: 3, porNex: 3, pre: true },
    san: { base: 16, porNex: 4 },
    periciasFixas: [],
    periciasEscolhaUma: [],
    periciasLivres: (int) => 7 + int,
    proficiencias: ["Armas simples", "Proteções leves"],
    grauTreinamento: (int) => 5 + int,
  },
  ocultista: {
    id: "ocultista",
    nome: "Ocultista",
    pv: { base: 12, porNex: 2, vig: true },
    pe: { base: 4, porNex: 4, pre: true },
    san: { base: 20, porNex: 5 },
    periciasFixas: ["Ocultismo", "Vontade"],
    periciasEscolhaUma: [],
    periciasLivres: (int) => 3 + int,
    proficiencias: ["Armas simples"],
    grauTreinamento: (int) => 3 + int,
  },
};

/* Em que NEX cada poder de trilha chega (pgs. 26, 30 e 34). */
export const NEX_TRILHA = [10, 40, 65, 99];

/* ── Marcos de NEX por classe ─────────────────────────────────────────────
 * Cada entrada é UMA concessão do livro naquele degrau.
 *
 *   tipo 'habilidade'        → texto fixo, entra na ficha sozinho.
 *                              `substitui` aponta o marco anterior que esta
 *                              versão aposenta (Ataque Especial 2→3→4→5 PE),
 *                              para a ficha não acumular quatro cópias.
 *   tipo 'trilha'            → escolher a trilha (só no NEX 10%).
 *   tipo 'habilidade_trilha' → poder da trilha já escolhida; sem escolha.
 *   tipo 'poder_classe'      → escolher um poder da lista da classe.
 *   tipo 'aumento_atributo'  → +1 em um atributo (teto 5).
 *   tipo 'grau_treinamento'  → subir o grau de N perícias treinadas.
 *   tipo 'versatilidade'     → poder de classe OU 1º poder de outra trilha.
 *   tipo 'circulo_ritual'    → libera um círculo (ocultista); o ritual novo de
 *                              cada NEX é tratado à parte, pois vale em TODOS. */
const trilhaMarco = (nex, ordinal) => ({
  nex,
  tipo: nex === 10 ? "trilha" : "habilidade_trilha",
  ref: `trilha_${nex}`,
  rotulo: nex === 10 ? "Trilha (1º poder)" : `Habilidade de trilha (${ordinal}º poder)`,
});

const atributoMarco = (nex) => ({
  nex, tipo: "aumento_atributo", ref: `atributo_${nex}`, rotulo: "Aumento de atributo",
});

const grauMarco = (nex) => ({
  nex, tipo: "grau_treinamento", ref: `grau_${nex}`, rotulo: "Grau de treinamento",
});

const poderMarco = (nex, nomeClasse) => ({
  nex, tipo: "poder_classe", ref: `poder_${nex}`, rotulo: `Poder de ${nomeClasse}`,
});

export const MARCOS = {
  combatente: [
    { nex: 5, tipo: "habilidade", ref: "ataque_especial", nome: "Ataque Especial", custo: "2 PE",
      desc: "Quando faz um ataque, você pode gastar 2 PE para receber +5 no teste de ataque ou na rolagem de dano." },
    trilhaMarco(10, 1),
    poderMarco(15, "combatente"),
    atributoMarco(20),
    { nex: 25, tipo: "habilidade", ref: "ataque_especial_25", substitui: "ataque_especial", nome: "Ataque Especial", custo: "3 PE",
      desc: "Você pode gastar até 3 PE ao atacar, recebendo mais um bônus de +5 — até +10 distribuídos entre o teste de ataque e a rolagem de dano." },
    poderMarco(30, "combatente"),
    grauMarco(35),
    trilhaMarco(40, 2),
    poderMarco(45, "combatente"),
    atributoMarco(50),
    { nex: 50, tipo: "versatilidade", ref: "versatilidade_50", rotulo: "Versatilidade" },
    { nex: 55, tipo: "habilidade", ref: "ataque_especial_55", substitui: "ataque_especial_25", nome: "Ataque Especial", custo: "4 PE",
      desc: "Você pode gastar até 4 PE ao atacar, recebendo até +15 distribuídos entre o teste de ataque e a rolagem de dano." },
    poderMarco(60, "combatente"),
    trilhaMarco(65, 3),
    grauMarco(70),
    poderMarco(75, "combatente"),
    atributoMarco(80),
    { nex: 85, tipo: "habilidade", ref: "ataque_especial_85", substitui: "ataque_especial_55", nome: "Ataque Especial", custo: "5 PE",
      desc: "Você pode gastar até 5 PE ao atacar, recebendo até +20 distribuídos entre o teste de ataque e a rolagem de dano." },
    poderMarco(90, "combatente"),
    atributoMarco(95),
    trilhaMarco(99, 4),
  ],
  especialista: [
    { nex: 5, tipo: "habilidade", ref: "ecletico", nome: "Eclético", custo: "2 PE",
      desc: "Você pode gastar 2 PE para receber os benefícios de ser treinado em uma perícia que esteja usando, mesmo sem ser treinado nela." },
    { nex: 5, tipo: "habilidade", ref: "perito", nome: "Perito", custo: "2 PE",
      desc: "Escolha duas perícias em que seja treinado. Ao fazer um teste com elas, pode gastar 2 PE para somar +1d6 ao resultado." },
    trilhaMarco(10, 1),
    poderMarco(15, "especialista"),
    atributoMarco(20),
    { nex: 25, tipo: "habilidade", ref: "perito_25", substitui: "perito", nome: "Perito", custo: "3 PE",
      desc: "O dado extra do Perito sobe para 1d8, gastando 3 PE." },
    poderMarco(30, "especialista"),
    grauMarco(35),
    { nex: 40, tipo: "habilidade", ref: "engenhosidade", nome: "Engenhosidade", custo: "+2 PE",
      desc: "Ao usar Eclético, você pode gastar 2 PE adicionais para receber os benefícios do grau seguinte na perícia." },
    trilhaMarco(40, 2),
    poderMarco(45, "especialista"),
    atributoMarco(50),
    { nex: 50, tipo: "versatilidade", ref: "versatilidade_50", rotulo: "Versatilidade" },
    { nex: 55, tipo: "habilidade", ref: "perito_55", substitui: "perito_25", nome: "Perito", custo: "4 PE",
      desc: "O dado extra do Perito sobe para 1d10, gastando 4 PE." },
    poderMarco(60, "especialista"),
    trilhaMarco(65, 3),
    grauMarco(70),
    { nex: 75, tipo: "habilidade", ref: "engenhosidade_75", substitui: "engenhosidade", nome: "Engenhosidade", custo: "+4 PE",
      desc: "Ao usar Eclético, você pode gastar 4 PE adicionais para receber os benefícios de expert na perícia." },
    poderMarco(75, "especialista"),
    atributoMarco(80),
    { nex: 85, tipo: "habilidade", ref: "perito_85", substitui: "perito_55", nome: "Perito", custo: "5 PE",
      desc: "O dado extra do Perito sobe para 1d12, gastando 5 PE." },
    poderMarco(90, "especialista"),
    atributoMarco(95),
    trilhaMarco(99, 4),
  ],
  ocultista: [
    { nex: 5, tipo: "habilidade", ref: "escolhido", nome: "Escolhido pelo Outro Lado", custo: "—",
      desc: "Você foi marcado pelo Outro Lado e pode conjurar rituais de 1º círculo. Começa conhecendo três rituais de 1º círculo e, sempre que avança de NEX, aprende mais um ritual de qualquer círculo que já possa conjurar." },
    { nex: 5, tipo: "circulo_ritual", ref: "circulo_1", circulo: 1, rotulo: "Rituais de 1º círculo" },
    trilhaMarco(10, 1),
    poderMarco(15, "ocultista"),
    atributoMarco(20),
    { nex: 25, tipo: "circulo_ritual", ref: "circulo_2", circulo: 2, rotulo: "Rituais de 2º círculo" },
    poderMarco(30, "ocultista"),
    grauMarco(35),
    trilhaMarco(40, 2),
    poderMarco(45, "ocultista"),
    atributoMarco(50),
    { nex: 50, tipo: "versatilidade", ref: "versatilidade_50", rotulo: "Versatilidade" },
    { nex: 55, tipo: "circulo_ritual", ref: "circulo_3", circulo: 3, rotulo: "Rituais de 3º círculo" },
    poderMarco(60, "ocultista"),
    trilhaMarco(65, 3),
    grauMarco(70),
    poderMarco(75, "ocultista"),
    atributoMarco(80),
    { nex: 85, tipo: "circulo_ritual", ref: "circulo_4", circulo: 4, rotulo: "Rituais de 4º círculo" },
    poderMarco(90, "ocultista"),
    atributoMarco(95),
    trilhaMarco(99, 4),
  ],
};

/* ── Pré-requisitos dos poderes de classe ────────────────────────────────
 * Chave = id em CLASS_POWERS (../rules.js). Sem entrada = sem pré-requisito.
 *   attrs       — valores mínimos de atributo
 *   nex         — NEX mínimo
 *   treinado    — precisa ser treinado em TODAS as perícias listadas
 *   treinadoUma — precisa ser treinado em PELO MENOS UMA das listadas
 *   poder       — precisa já ter escolhido este outro poder
 *   repetivel   — pode ser escolhido mais de uma vez (pg. 22) */
export const PRE_REQUISITOS = {
  /* combatente */
  acuidade_arma: { attrs: { AGI: 1 } },
  comb_defensivo: { attrs: { INT: 2 } },
  comb_duas_armas: { attrs: { AGI: 3 }, treinadoUma: ["Luta", "Pontaria"] },
  competencia_per: { nex: 35 },
  expert_pericia: { nex: 70 },
  golpe_demolidor: { attrs: { FOR: 2 }, treinado: ["Luta"] },
  protecao_pesada: { nex: 30 },
  saque_rapido: { treinado: ["Iniciativa"] },
  segurar_gatilho: { nex: 60 },
  tanque_guerra: { poder: "protecao_pesada" },
  tiro_certeiro: { treinado: ["Pontaria"] },
  transcender: { repetivel: true },
  treinamento_per: { repetivel: true },
  /* especialista */
  hacker: { treinado: ["Tecnologia"] },
  movimento_tatico: { treinado: ["Atletismo"] },
  /* ocultista */
  fluxo_poder: { nex: 60 },
  mestre_elemento: { poder: "especialista_elem", nex: 45 },
  ritual_predileto: { repetivel: true },
  ritual_potente: { attrs: { INT: 1 } },
};

/* ── Poderes de origem que escalam com o NEX ─────────────────────────────
 * As três origens cujo poder muda um número da ficha a cada NEX. Sem isso o
 * jogador teria que somar na mão a cada missão — que é exatamente o que
 * este motor existe para eliminar. Textos conferidos no livro (pgs. 19-21). */
export const BONUS_ORIGEM = {
  desgarrado: {
    poder: "Calejado",
    pv: (nex) => Math.floor(nex / 5),
    nota: "Calejado: +1 PV para cada 5% de NEX.",
  },
  vitima: {
    poder: "Cicatrizes Psicológicas",
    san: (nex) => Math.floor(nex / 5),
    nota: "Cicatrizes Psicológicas: +1 de Sanidade para cada 5% de NEX.",
  },
  universitario: {
    poder: "Dedicação",
    /* +1 PE de saída e mais 1 a cada NEX ímpar (15%, 25%, …). */
    pe: (nex) => 1 + [15, 25, 35, 45, 55, 65, 75, 85, 95].filter((t) => nex >= t).length,
    limitePe: () => 1,
    nota: "Dedicação: +1 PE, mais 1 PE a cada NEX ímpar, e +1 no limite de PE por turno.",
  },
};

/* Círculo máximo de ritual liberado por NEX (Escolhido pelo Outro Lado). */
export const CIRCULO_POR_NEX = [
  { nex: 85, circulo: 4 },
  { nex: 55, circulo: 3 },
  { nex: 25, circulo: 2 },
  { nex: 5, circulo: 1 },
];
