/* ════════════════════════════════════════════════════════════════════
 *  A MESA — EVENTOS E PROCURA: TRADUÇÕES E ARRUMAÇÃO
 *  (spec 0028 · F5 · AC-1, AC-8, AC-9)
 *  --------------------------------------------------------------------
 *  Só valores e funções puras: nenhum JSX, nenhum hook, nenhum I/O, nenhum
 *  dado aleatório. É a ponte entre `model/eventos.js` (que decide o que
 *  dispara) e as duas telas da mesa (a fila do mestre e o mural do grupo).
 *
 *  ── A LINHA QUE NÃO SE ATRAVESSA ────────────────────────────────────
 *  Tudo neste arquivo que toca o MOLDE é do lado do mestre: `filaDoMestre`
 *  lê `gmText`, gatilho e revelações. Nada disto pode alimentar a tela do
 *  jogador — o que ele vê sai dos documentos de `revealed/`, que já são
 *  públicos por construção (AC-1).
 *
 *  ── E A PROCURA (AC-9) ──────────────────────────────────────────────
 *  A frase da procura NÃO mora aqui. Ela é `MENSAGEM_SEM_ACHADO` /
 *  `MENSAGEM_ACHADO` de `model/descoberta.js`, e reescrevê-la em qualquer
 *  outro lugar recriaria o oráculo que o AC-9 proíbe: duas frases quase
 *  iguais são duas frases diferentes. O que existe aqui é a frase do
 *  jogador que PEDE a procura — e ela é a mesma em todo nó, com segredo
 *  ou sem, porque é dita antes de qualquer resolução.
 *
 *  Gate: `__tests__/evento-mesa.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { GATILHOS, MOTIVOS, getGatilho } from "../model/eventos";

const lista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (typeof v === "string" ? v : "");
const idValido = (v) => typeof v === "string" && v.trim() !== "";

/**
 * O que o JOGADOR lê ao pedir uma procura, antes de o mestre resolver.
 *
 * É a mesma frase em qualquer lugar do mapa. Ela não pode variar com o que
 * existe ali: variar é o vazamento. O cliente do jogador nem sabe se há o que
 * achar — ele não lê o molde.
 */
export const PEDIDO_DE_PROCURA =
  "O grupo vasculha o lugar. O mestre resolve a procura.";

/** O rótulo do botão de procura, igual em todo nó — inclusive onde não há nada. */
export const ROTULO_DA_PROCURA = "Procurar aqui";

/**
 * O título do cartão público de uma procura resolvida.
 *
 * O mesmo título nos dois desfechos, de propósito: "Procura" não diz se achou
 * nem se havia o que achar. Quem diz é o texto — e no fracasso o texto é o
 * mesmo de um lugar vazio.
 */
export const TITULO_DA_PROCURA = "Procura";

/**
 * O id fixo do documento público da procura em `revealed/`.
 *
 * **Fixo, e não um id novo por procura**, porque a contagem de documentos é
 * observável: um id sequencial diria ao jogador quantas vezes o grupo já
 * procurou, e um id só quando acha diria onde há segredo. Um documento só, que
 * sempre carrega a última procura, não conta nada.
 */
export const ID_DA_PROCURA = "busca";

/** Título do cartão de evento quando o mestre não deu um. */
export const EVENTO_SEM_TITULO = "Alguma coisa acontece";

/* ════════════════════════════════════════════════════════════════════
 *  A FILA DO MESTRE  (AC-8 · design §2, S2)
 *  --------------------------------------------------------------------
 *  *"fila de eventos: o que disparou, o que está armado, o que ele
 *  segurou"*. São exatamente três gavetas, e a regra de qual gaveta é:
 *
 *   · DISPAROU  — o id está em `gm.triggeredEventIds`. Vale para qualquer
 *     gatilho: o que já aconteceu, aconteceu.
 *   · NA MÃO    — ainda não disparou e o gatilho não age sozinho
 *     (`manual` e `on_check`). É o que o mestre segura até a hora certa.
 *   · ARMADO    — ainda não disparou e o gatilho age sozinho. É o que pode
 *     sair a qualquer passo do grupo.
 * ══════════════════════════════════════════════════════════════════ */

/** Gatilhos que nunca disparam sozinhos — só pela mão ou pelo teste do mestre. */
export const GATILHOS_NA_MAO = ["manual", "on_check"];

/**
 * Arruma os eventos do molde nas três gavetas da fila do mestre.
 *
 * ⚠️ **Lado do mestre.** Recebe os eventos do molde, com `gmText` e tudo.
 *
 * Evento sem id fica de fora das três: sem id não há como marcá-lo em
 * `gm.triggeredEventIds`, então ele voltaria a disparar a cada passo — e a fila
 * mostraria um item que o mestre não consegue controlar. `validarEvento` acusa
 * isso no ateliê, que é onde tem conserto.
 *
 * @param {Array<object>} eventos eventos do molde.
 * @param {string[]|Set<string>} jaDisparados `gm.triggeredEventIds`.
 * @returns {{disparados:Array, armados:Array, naMao:Array, total:number}}
 *   cada item é `{ evento, gatilho, motivo }` — `gatilho` é a entrada da tabela
 *   `GATILHOS` (com `label` e `hint` em PT-BR) ou `null` se for desconhecido.
 */
export function filaDoMestre(eventos, jaDisparados) {
  const feitos = jaDisparados instanceof Set
    ? jaDisparados
    : new Set(lista(jaDisparados).filter(idValido));

  const saida = { disparados: [], armados: [], naMao: [], total: 0 };

  lista(eventos).forEach((evento) => {
    if (!evento || typeof evento !== "object" || !idValido(evento.id)) return;
    const gatilho = getGatilho(evento.trigger);
    const item = {
      evento,
      gatilho,
      motivo: MOTIVOS[evento.trigger] || "",
    };
    saida.total += 1;

    if (feitos.has(evento.id)) { saida.disparados.push(item); return; }
    if (GATILHOS_NA_MAO.includes(evento.trigger)) { saida.naMao.push(item); return; }
    saida.armados.push(item);
  });

  return saida;
}

/**
 * O contexto de `avaliarGatilhos` para um passo da mesa.
 *
 * Existe para a tela não montar o objeto à mão em dois lugares (a chegada e a
 * viagem) e esquecer o `grafo` num deles — **sem `grafo`, a proximidade com
 * âncora de nó ou de trilha não dispara** (o módulo falha fechado, de
 * propósito), e o evento simplesmente não aconteceria, sem erro nenhum na tela.
 *
 * As `flags` do grupo chegam como mapa (`party.flags`) ou lista; `temFlag` do
 * modelo aceita as duas, então elas passam como estão.
 *
 * @param {object} passo `{ noId, trilhaId, posicao }`
 * @param {object} fontes `{ molde, party, sorteio }` — `sorteio` é número ou
 *   função, e é o ÚNICO lugar por onde a aleatoriedade entra.
 * @returns {object} contexto para `avaliarGatilhos`.
 */
export function contextoDoPasso(passo = {}, fontes = {}) {
  return {
    noId: idValido(passo.noId) ? passo.noId : undefined,
    trilhaId: idValido(passo.trilhaId) ? passo.trilhaId : undefined,
    posicao: passo.posicao && Number.isFinite(passo.posicao.x) && Number.isFinite(passo.posicao.y)
      ? { x: passo.posicao.x, y: passo.posicao.y }
      : undefined,
    flags: fontes.party?.flags,
    grafo: fontes.molde || undefined,
    sorteio: fontes.sorteio,
  };
}

/**
 * As marcas do evento somadas às que o grupo já tinha, sempre como MAPA.
 *
 * `party.flags` pode ter nascido lista (o modelo aceita as duas formas na
 * leitura), mas gravar sempre mapa evita o caso em que duas escritas quase
 * simultâneas trocam a forma do campo e uma marca some sem ninguém notar.
 *
 * @param {object|Array|null} atuais `party.flags`.
 * @param {string[]} novas marcas devolvidas por `aplicarEvento`.
 * @returns {object|null} `null` quando nada mudaria — para não gravar à toa.
 */
export function flagsComAsNovas(atuais, novas) {
  const marcas = lista(novas).filter(idValido);
  if (marcas.length === 0) return null;

  const base = Array.isArray(atuais)
    ? atuais.filter(idValido).reduce((acc, m) => { acc[m] = true; return acc; }, {})
    : (atuais && typeof atuais === "object" ? { ...atuais } : {});

  let mudou = false;
  marcas.forEach((m) => { if (base[m] !== true) { base[m] = true; mudou = true; } });
  return mudou ? base : null;
}

/**
 * O anúncio de `aria-live` de um disparo, do lado do JOGADOR.
 *
 * Diz o título e nada mais da máquina: nem gatilho, nem motivo, nem o que foi
 * revelado por baixo. O texto público completo está no cartão; o anúncio é o
 * empurrão para quem usa leitor de tela ir lê-lo.
 */
export function anuncioDoEvento(projecoes) {
  const titulos = lista(projecoes)
    .map((p) => texto(p?.title).trim() || EVENTO_SEM_TITULO);
  if (titulos.length === 0) return "";
  if (titulos.length === 1) return `Aconteceu alguma coisa: ${titulos[0]}.`;
  return `Aconteceram ${titulos.length} coisas: ${titulos.join("; ")}.`;
}

/** O rótulo do gatilho em PT-BR, para a fila do mestre. */
export function rotuloDoGatilho(trigger) {
  const g = GATILHOS.find((x) => x.id === trigger);
  return g ? g.label : "Gatilho desconhecido";
}
