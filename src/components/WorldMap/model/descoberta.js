/* ════════════════════════════════════════════════════════════════════
 *  O TESTE DE DESCOBERTA  (spec 0028 · F5 · AC-9)
 *  --------------------------------------------------------------------
 *  A trilha secreta com `discoveryCheck` só aparece quando alguém procura
 *  e acha. Este módulo é o que decide "achou ou não achou" e o que isso
 *  faz com o estado de visibilidade da mesa.
 *
 *  ── ESTE MÓDULO NÃO ROLA DADO ───────────────────────────────────────
 *  O AC-9 é literal: *"a rolagem usa o motor de dados já existente do
 *  projeto — nenhum motor paralelo"*. Então `resultadoDaDescoberta`
 *  recebe **o resultado** da rolagem (de `src/domain/dice.js`), nunca o
 *  dado. Não há aleatoriedade aqui, nem relógio: mesma entrada, mesma
 *  saída, sempre.
 *
 *  ── A INVARIANTE DURA: A FALHA NÃO PODE DELATAR O SEGREDO ───────────
 *  *"a falha não revela a existência da trilha ('você não encontra
 *  nada', nunca 'você falhou em achar a passagem secreta')"*.
 *
 *  Uma mensagem vaga não basta. Ela tem de ser **idêntica** — mesma
 *  string, mesmas chaves, mesmo JSON — à de um teste feito onde não há
 *  trilha secreta nenhuma. Qualquer diferença observável (um campo a
 *  mais, um `undefined`, um texto ligeiramente outro) vira um oráculo:
 *  o jogador testa em dois lugares, compara as respostas e descobre
 *  onde há segredo sem nunca passar num teste.
 *
 *  Daí `MENSAGEM_SEM_ACHADO` ser **constante única**, usada nos dois
 *  casos, e a saída ter exatamente duas chaves. E daí `aplicarDescoberta`
 *  devolver, no fracasso, **o mesmo estado por referência**: nem uma
 *  chave vazia sobra no objeto para denunciar que algo foi tentado ali.
 *
 *  ── SOBRE `testesDisponiveis` ───────────────────────────────────────
 *  É função do **lado do mestre**: ela enxerga o molde, que é o segredo
 *  (AC-1). Não pode ser usada para montar a tela do jogador — o que o
 *  jogador vê sai de `projecaoDoJogador` (revelacao.js), e mais nada.
 *
 *  Gate: `__tests__/descoberta.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { vizinhos } from "./graph";
import { criarEstado, ehMaior, estadoDaTrilha, revelarPorDescoberta } from "./revelacao";

/**
 * **A frase única do AC-9.**
 *
 * É a resposta de um teste que falhou numa trilha secreta real **e** a de um
 * teste feito onde não havia nada para achar. As duas têm de ser a mesma
 * string, senão a diferença entrega o segredo. Não mencione trilha, passagem,
 * segredo nem fracasso aqui — o texto não pode admitir que havia algo.
 */
export const MENSAGEM_SEM_ACHADO = "Você não encontra nada.";

/** A resposta do achado. Só aparece quando o teste passou de verdade. */
export const MENSAGEM_ACHADO = "Você encontra uma passagem que não estava à vista.";

const idValido = (v) => typeof v === "string" && v.trim() !== "";
const listaDe = (v) => (Array.isArray(v) ? v : []);
const ehObjeto = (v) => !!v && typeof v === "object";

/** O `discoveryCheck` da trilha, se ele estiver completo. Senão, `null`. */
function testeDaTrilha(trilha) {
  const check = ehObjeto(trilha) ? trilha.discoveryCheck : null;
  if (!ehObjeto(check)) return null;
  if (!idValido(check.skill) || !Number.isFinite(check.dc)) return null;
  return { skill: check.skill, dc: check.dc };
}

/**
 * As trilhas secretas **testáveis** a partir do nó onde o grupo está.
 *
 * ⚠️ **Lado do mestre.** Esta função lê o molde inteiro — inclusive o que o
 * jogador não pode saber que existe. Ela alimenta o console do mestre ("o grupo
 * pode procurar aqui"), e **nunca** a tela do jogador. Montar a tela do jogador
 * com o retorno daqui violaria o AC-1 de forma silenciosa: bastaria a presença
 * de um botão "procurar" para denunciar onde há segredo.
 *
 * Fica de fora:
 * - trilha **não secreta** — não há o que descobrir nela;
 * - trilha secreta **sem** `discoveryCheck` completo — essa só sai por gatilho
 *   ou pela mão do mestre, nunca por teste;
 * - trilha secreta **já revelada** — o grupo já achou.
 *
 * @param {{nos:object,trilhas:object}} estado estado de visibilidade da mesa.
 * @param {{nos:Array,trilhas:Array}} grafo o molde.
 * @param {string} noId onde o grupo está.
 * @returns {Array<{trilhaId:string, trilha:object, teste:{skill:string,dc:number},
 *                  outroId:string|null}>}
 */
export function testesDisponiveis(estado, grafo, noId) {
  if (!idValido(noId)) return [];

  return vizinhos(grafo, noId).reduce((saida, { trilha, outroId }) => {
    if (!trilha?.isSecret || !idValido(trilha?.id)) return saida;
    const teste = testeDaTrilha(trilha);
    if (!teste) return saida;
    if (ehMaior(estadoDaTrilha(estado, trilha.id), "hidden")) return saida; // já achada
    saida.push({ trilhaId: trilha.id, trilha, teste, outroId: outroId ?? null });
    return saida;
  }, []);
}

/** O total da rolagem, venha ele como número ou como o objeto do motor de dados. */
function totalDaRolagem(rolagem) {
  const bruto = ehObjeto(rolagem) ? rolagem.total : rolagem;
  return Number.isFinite(bruto) ? bruto : null;
}

/**
 * O grupo achou?
 *
 * **A rolagem vem de fora** — `rollDice`/`rollOP` de `src/domain/dice.js`, o
 * motor único do projeto (AC-9). Aceita o total cru (`18`) ou o objeto do motor
 * (`{ total: 18 }`), porque o console do mestre tem os dois na mão.
 *
 * Todo caminho que não seja um sucesso comprovado cai **na mesma saída**:
 * trilha inexistente, trilha aberta, trilha secreta sem teste, rolagem torta ou
 * rolagem abaixo da CD devolvem, todos, `{ sucesso:false, mensagem:
 * MENSAGEM_SEM_ACHADO }` — objeto de duas chaves, idêntico caractere a
 * caractere. É essa igualdade que faz o segredo continuar segredo, e é ela que
 * o teste trava.
 *
 * @param {object|null} trilha a trilha secreta, ou `null` quando não há nenhuma.
 * @param {number|{total:number}} rolagem o resultado já rolado.
 * @returns {{sucesso:boolean, mensagem:string}} exatamente duas chaves.
 */
export function resultadoDaDescoberta(trilha, rolagem) {
  const semAchado = { sucesso: false, mensagem: MENSAGEM_SEM_ACHADO };

  const teste = testeDaTrilha(trilha);
  if (!teste) return semAchado;

  const total = totalDaRolagem(rolagem);
  if (total === null) return semAchado;
  if (total < teste.dc) return semAchado;

  return { sucesso: true, mensagem: MENSAGEM_ACHADO };
}

/**
 * O que a descoberta faz com o estado da mesa.
 *
 * - **sucesso** → `revelarPorDescoberta`: a trilha vira `revealed` e os nós das
 *   duas pontas viram `max(estado, 'discovered')`. Continua sendo `max`: nada
 *   regride (AC-6).
 * - **fracasso** → **o mesmo estado, pela mesma referência**. Não é um estado
 *   novo e igual: é o objeto original. Nada mudou, nada foi tentado, nada
 *   sobrou no documento para o jogador comparar depois — e o React pula o
 *   render de graça.
 *
 * @param {{nos:object,trilhas:object}} estado
 * @param {{nos:Array,trilhas:Array}} grafo
 * @param {string} trilhaId
 * @param {boolean} sucesso o veredito de `resultadoDaDescoberta`.
 * @returns {{estado:object, mudou:boolean, nosAlterados:Array, trilhasAlteradas:Array}}
 */
export function aplicarDescoberta(estado, grafo, trilhaId, sucesso) {
  if (!sucesso) {
    return {
      estado: ehObjeto(estado) ? estado : criarEstado(),
      mudou: false,
      nosAlterados: [],
      trilhasAlteradas: [],
    };
  }

  const trilhas = listaDe(grafo?.trilhas);
  return revelarPorDescoberta(estado, { nos: listaDe(grafo?.nos), trilhas }, trilhaId);
}
