/* ════════════════════════════════════════════════════════════════════
 *  A VIAGEM  (spec 0028 · F4 · AC-6, AC-8, AC-11 movimento 4)
 *  --------------------------------------------------------------------
 *  O percurso do grupo sobre a trilha: onde o marcador está, quanto já
 *  andou, quanta névoa isso abriu, quantas horas custou e quanta comida
 *  sumiu no caminho.
 *
 *  ── DUAS DECISÕES QUE DÃO O "SENTIR" DA VIAGEM ──────────────────────
 *
 *  1. **Velocidade constante.** A posição sai de `pontoNaFracao`, que mede
 *     `t` no COMPRIMENTO REAL da polilinha, não no parâmetro cru da Bézier.
 *     Com o parâmetro cru o marcador acelera nos trechos retos e freia nas
 *     dobras — o olho percebe na hora e a viagem parece um glitch. Há teste
 *     medindo isso: oito passos iguais numa trilha bem curvada têm de
 *     percorrer trechos praticamente iguais.
 *
 *  2. **A névoa abre AO LONGO do caminho, aos pouquinhos** — não só na
 *     chegada. `nevoaDaViagem` revela o trecho JÁ PERCORRIDO a cada quadro
 *     (`revelarAoLongoDe`, F3). É o que faz o mapa se desenhar enquanto o
 *     grupo anda, que é a mecânica inteira do produto.
 *
 *  ── PUREZA ──────────────────────────────────────────────────────────
 *  Sem React, sem Firebase, sem DOM, sem `Date.now()`, sem `Math.random()`.
 *  O tempo entra por parâmetro (`dt`, `horas`), sempre.
 *
 *  A ÚNICA exceção à imutabilidade é `nevoaDaViagem`, que muta a máscara em
 *  lugar e devolve a mesma referência — decisão consciente da F3
 *  (`fogMask.js`): copiar 30 KB a cada quadro da viagem seria desperdício.
 *
 *  Gate: `__tests__/viagem.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { comprimentoDaCurva, partirNoProgresso, pontoNaFracao, pontosDaCurva } from "./curves";
import { revelarAoLongoDe } from "./fogMask";
import { pontasDaTrilha, vizinhos } from "./graph";

/** Horas de um dia de jogo — a base do relógio e do consumo de suprimentos. */
export const HORAS_POR_DIA = 24;

const listaDe = (v) => (Array.isArray(v) ? v : []);
const ehPonto = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const grampear01 = (t) => Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
const naoNegativo = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

/* ── Começar ────────────────────────────────────────────────────────── */

/**
 * Prepara a viagem de `deId` até `paraId` pela `trilha`.
 *
 * Os pontos saem sempre **no sentido da viagem**: se a trilha está gravada ao
 * contrário (`fromNodeId === paraId`), a polilinha é invertida. Sem isso o
 * marcador começaria no destino e andaria de trás para frente — e `pathPoints`
 * são pontos de CONTROLE, então não dá para "ler ao contrário" sem reamostrar.
 *
 * @param {{nos:Array,trilhas:Array}} grafo
 * @param {string} deId nó de origem.
 * @param {string} paraId nó de destino.
 * @param {object} [trilha] a trilha; se omitida, é procurada no grafo.
 * @returns {{deId,paraId,trilhaId,pontos:Array,comprimento:number,horas:number,
 *            progresso:number,posicao:{x,y},chegou:boolean}}
 * @throws {Error} em PT-BR quando falta nó ou não há trilha ligando os dois.
 */
export function iniciarViagem(grafo, deId, paraId, trilha) {
  const nos = listaDe(grafo?.nos);
  const de = nos.find((n) => n?.id === deId);
  const para = nos.find((n) => n?.id === paraId);
  if (!ehPonto(de) || !ehPonto(para)) {
    throw new Error("A viagem precisa de um nó de origem e um nó de destino que existam no mapa.");
  }

  const escolhida = trilha
    || vizinhos(grafo, deId).find(({ outroId }) => outroId === paraId)?.trilha;
  if (!escolhida) {
    throw new Error("Não existe trilha ligando esses dois lugares.");
  }

  const [pontaA] = pontasDaTrilha(escolhida);
  const invertida = pontaA === paraId;
  const amostrados = pontosDaCurva(
    invertida ? { x: para.x, y: para.y } : { x: de.x, y: de.y },
    invertida ? { x: de.x, y: de.y } : { x: para.x, y: para.y },
    escolhida.pathPoints,
  );
  const pontos = (invertida ? amostrados.slice().reverse() : amostrados)
    .map((p) => ({ x: p.x, y: p.y }));

  const comprimento = comprimentoDaCurva(pontos);
  return {
    deId,
    paraId,
    trilhaId: escolhida.id ?? null,
    pontos,
    comprimento,
    horas: Number.isFinite(escolhida.travelHours) ? escolhida.travelHours : 0,
    progresso: comprimento > 0 ? 0 : 1,
    posicao: { x: pontos[0].x, y: pontos[0].y },
    chegou: !(comprimento > 0),
  };
}

/* ── Andar ──────────────────────────────────────────────────────────── */

/**
 * Um passo da viagem. **Não muta** — devolve uma viagem nova.
 *
 * `velocidade` é em unidades de mundo por unidade de `dt` (use o `dt` do
 * `requestAnimationFrame` em segundos e a velocidade em unidades/segundo).
 * **Omitida**, ela vira o comprimento da trilha inteira — aí `dt` passa a ser
 * a fração da viagem, e `avancarViagem(v, 1)` completa o percurso. É o atalho
 * que os testes e a UI de "pular para o fim" usam.
 *
 * `dt` ou `velocidade` inválidos (NaN, negativos) não movem nada: o progresso é
 * **monotônico**, nunca anda para trás — isso é a mesma invariante do AC-6
 * aplicada ao movimento (a névoa que a viagem abriu não pode desabrir).
 *
 * @param {object} viagem
 * @param {number} dt
 * @param {number} [velocidade]
 * @returns {object} viagem nova, com `progresso`, `posicao` e `chegou`.
 */
export function avancarViagem(viagem, dt, velocidade) {
  if (!viagem || typeof viagem !== "object") return viagem;

  const pontos = listaDe(viagem.pontos).filter(ehPonto);
  const comprimento = Number.isFinite(viagem.comprimento)
    ? viagem.comprimento
    : comprimentoDaCurva(pontos);

  if (!(comprimento > 0) || pontos.length === 0) {
    // Trilha de comprimento zero: já se está lá. Nada de divisão por zero.
    return {
      ...viagem,
      progresso: 1,
      posicao: pontos.length ? { ...pontos[pontos.length - 1] } : { ...(viagem.posicao || {}) },
      chegou: true,
    };
  }

  // Velocidade ausente = a viagem inteira por unidade de dt.
  // Velocidade presente mas inválida = parado (não é o mesmo que ausente).
  const v = velocidade === undefined || velocidade === null
    ? comprimento
    : naoNegativo(velocidade);

  const avanco = naoNegativo(dt) * v;
  const progresso = grampear01((Number.isFinite(viagem.progresso) ? viagem.progresso : 0)
    + avanco / comprimento);

  return {
    ...viagem,
    progresso,
    // Em t=1 a posição é o último ponto EXATO — o marcador tem de casar com o
    // nó, sem resíduo de ponto flutuante.
    posicao: progresso >= 1 ? { ...pontos[pontos.length - 1] } : pontoNaFracao(pontos, progresso),
    chegou: progresso >= 1,
  };
}

/**
 * O trecho da trilha que o grupo **já andou**, do começo até a posição atual.
 *
 * É a entrada de `nevoaDaViagem`, e existe separada porque também serve para
 * desenhar o rastro da viagem na tela (o "caminho percorrido" do AC-11).
 *
 * @param {object} viagem
 * @param {number} [ate] fração; padrão é o progresso da viagem.
 * @returns {Array<{x:number,y:number}>} sempre começa na origem.
 */
export function trechoPercorrido(viagem, ate) {
  const pontos = listaDe(viagem?.pontos).filter(ehPonto);
  if (pontos.length === 0) return [];

  const t = grampear01(ate === undefined ? viagem?.progresso : ate);
  if (t <= 0) return [{ ...pontos[0] }];
  if (t >= 1) return pontos.map((p) => ({ x: p.x, y: p.y }));

  const alvo = comprimentoDaCurva(pontos) * t;
  const trecho = [{ ...pontos[0] }];
  let percorrido = 0;
  for (let i = 1; i < pontos.length; i += 1) {
    const seg = Math.hypot(pontos[i].x - pontos[i - 1].x, pontos[i].y - pontos[i - 1].y);
    if (percorrido + seg >= alvo) break;
    percorrido += seg;
    trecho.push({ ...pontos[i] });
  }

  const atual = pontoNaFracao(pontos, t);
  const ultimo = trecho[trecho.length - 1];
  if (ultimo.x !== atual.x || ultimo.y !== atual.y) trecho.push(atual);
  return trecho;
}

/**
 * O trecho da trilha que **falta andar**, da posição atual até o destino.
 *
 * Irmão de `trechoPercorrido`, e existe pelo mesmo motivo que ele: a rota
 * bicolor da spec 0035 (AC-1) precisa das duas metades para pintá-las em cores
 * diferentes — o que já foi andado numa, o que falta na outra.
 *
 * O corte vem de `partirNoProgresso`, a mesma régua de comprimento de arco que
 * `trechoPercorrido` usa. **Não é uma segunda implementação do corte**: as duas
 * metades compartilham o ponto exato onde o marcador está, e por isso não
 * aparece vão na junção.
 *
 * @param {object} viagem
 * @param {number} [de] fração; padrão é o progresso da viagem.
 * @returns {Array<{x:number,y:number}>} sempre termina no destino.
 */
export function trechoRestante(viagem, de) {
  const pontos = listaDe(viagem?.pontos).filter(ehPonto);
  if (pontos.length === 0) return [];

  const t = grampear01(de === undefined ? viagem?.progresso : de);
  return partirNoProgresso(pontos, t).restante;
}

/**
 * Abre a névoa ao longo do trecho já percorrido — **"ir desbloqueando o mapa
 * aos pouquinhos"**, que é o pedido original e o que o design §5.4 descreve.
 *
 * Revela o prefixo inteiro a cada chamada, não só o pedaço novo. É de propósito:
 * revelar é união de conjuntos (idempotente), então repetir não custa estado
 * errado, e chamar a cada quadro fica imune a quadro perdido ou a `dt` grande.
 *
 * **Muta a máscara** e devolve a mesma referência — contrato da F3
 * (`fogMask.js`); quem precisa do valor anterior chama `clonar` antes.
 *
 * @param {object} mascara
 * @param {object} viagem
 * @param {number} raio em unidades de mundo.
 * @returns {object} a própria máscara.
 */
export function nevoaDaViagem(mascara, viagem, raio) {
  const trecho = trechoPercorrido(viagem);
  if (trecho.length === 0) return mascara;
  return revelarAoLongoDe(mascara, trecho, raio);
}

/* ── Tempo de jogo ──────────────────────────────────────────────────── */

/**
 * Quantas horas de jogo a viagem já custou — proporcional ao percurso, porque
 * é assim que o relógio anda enquanto o marcador se move.
 *
 * @returns {number} 0 quando não há viagem.
 */
export function horasDecorridas(viagem) {
  const horas = Number.isFinite(viagem?.horas) ? viagem.horas : 0;
  return horas * grampear01(viagem?.progresso);
}

/**
 * Avança (ou volta) o relógio de jogo. Aritmética pura — **nada de `Date`**: o
 * tempo do mundo do jogo não tem nada a ver com o relógio do navegador, e um
 * `Date` traria fuso horário e horário de verão para dentro de uma ficção.
 *
 * Dois formatos, os dois aceitos, e a saída tem sempre o formato da entrada:
 * - `{ dia, hora, minuto }` — o relógio de jogo (dia começa em 1);
 * - `number` — horas absolutas desde o começo da campanha.
 *
 * Nunca vai antes do começo (dia 1, 00:00): o mestre pode voltar o relógio, mas
 * "antes do dia 1" não significa nada. Minutos são arredondados ao inteiro.
 *
 * @param {{dia:number,hora:number,minuto:number}|number|null} dataHora
 * @param {number} horas pode ser negativo (o mestre corrigindo).
 * @returns {{dia:number,hora:number,minuto:number}|number}
 */
export function avancarRelogio(dataHora, horas) {
  const delta = Number.isFinite(horas) ? horas : 0;

  if (typeof dataHora === "number") {
    return Math.max(0, Number.isFinite(dataHora) ? dataHora + delta : delta);
  }

  const dia = Number.isFinite(dataHora?.dia) ? dataHora.dia : 1;
  const hora = Number.isFinite(dataHora?.hora) ? dataHora.hora : 0;
  const minuto = Number.isFinite(dataHora?.minuto) ? dataHora.minuto : 0;

  const total = Math.max(
    0,
    Math.round(((dia - 1) * HORAS_POR_DIA + hora + delta) * 60 + minuto),
  );
  return {
    dia: Math.floor(total / (HORAS_POR_DIA * 60)) + 1,
    hora: Math.floor(total / 60) % HORAS_POR_DIA,
    minuto: total % 60,
  };
}

/* ── Suprimentos ────────────────────────────────────────────────────── */

/**
 * Consome suprimento pelo tempo viajado.
 *
 * O estoque **nunca fica negativo**: o que faltou vira `deficit`, e é com ele
 * que a mesa decide o que fazer (fome, exaustão, o mestre improvisando). Zerar
 * em silêncio esconderia do mestre o tamanho do problema.
 *
 * @param {number} suprimentos estoque atual (ausente ou inválido = 0).
 * @param {number} horas horas viajadas (negativo não devolve comida).
 * @param {number} porDia consumo por dia de jogo (0 = grupo que não consome).
 * @returns {{restante:number, consumido:number, esgotou:boolean, deficit:number}}
 */
export function consumirSuprimentos(suprimentos, horas, porDia) {
  const estoque = naoNegativo(suprimentos);
  const pedido = (naoNegativo(horas) / HORAS_POR_DIA) * naoNegativo(porDia);
  const consumido = Math.min(estoque, pedido);
  const restante = estoque - consumido;
  return {
    restante,
    consumido,
    esgotou: pedido > 0 && restante <= 0,
    deficit: pedido - consumido,
  };
}
