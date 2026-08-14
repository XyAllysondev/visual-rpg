/* ════════════════════════════════════════════════════════════════════
 *  A FRANJA DE TINTA  (spec 0035 · F1 · AC-4, AC-5, AC-6, AC-7)
 *  --------------------------------------------------------------------
 *  A névoa do mapa-múndi some com um desfoque gaussiano. Funciona, mas
 *  entrega o meio: borda desfocada é borda de software. No mapa que serve de
 *  referência a fronteira do revelado é **tinta** — traços curtos e irregulares
 *  de bico de pena, marcando até onde o cartógrafo desenhou.
 *
 *  Este módulo é a matemática desses traços. Ele não pinta nada e não conhece
 *  canvas: recebe a máscara, devolve segmentos em coordenadas de MUNDO. Quem
 *  pinta é `Editor/CamadaDeNevoa.jsx`.
 *
 *  ── DETERMINISMO NÃO É PREFERÊNCIA, É REQUISITO ─────────────────────
 *  `Math.random()` é **proibido** aqui, como em todo o `model/`. Dois motivos,
 *  e o segundo é o que pega:
 *
 *  1. O teste compara traço a traço. Aleatoriedade real torna isso impossível.
 *  2. A franja é repintada a cada quadro. Com jitter aleatório por quadro, a
 *     borda **ferveria** na tela — o efeito viraria ruído em movimento.
 *
 *  O jitter sai de um LCG semeado pela POSIÇÃO da célula: cada lugar tem seu
 *  próprio desvio, sempre o mesmo, e a borda fica parada enquanto a máscara
 *  não muda. Mesmo padrão de `controlePadrao` em `curves.js`.
 *
 *  ── O SEGREDO NÃO PODE VAZAR PELA FRANJA (AC-7) ─────────────────────
 *  A entrada é **só a máscara que o jogador já possui**. Nada de molde, nada
 *  de grafo, nada de estado de revelação. Se a franja mudasse de forma perto
 *  de um segredo, ela viraria um oráculo: o jogador compararia bordas e
 *  descobriria onde há algo escondido sem nunca testar nada. Segredo não vaza
 *  pelo dado, vaza pela diferença (design 0028 §3).
 *
 *  Gate: `__tests__/franja.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { celulaAcesa } from "./fogMask";

/** Comprimento do traço, em frações da célula. Curto: é pena, não pincel. */
export const COMPRIMENTO_DO_TRACO = 1.35;

/** Quanto o traço pode variar de comprimento, para os dois lados. */
export const VARIACAO_DO_COMPRIMENTO = 0.45;

/** Desvio lateral máximo do pé do traço, em frações da célula. */
export const DESVIO_LATERAL = 0.32;

/**
 * Semente padrão. Trocá-la redesenha a franja inteira — é o botão de "outra
 * caligrafia", não um detalhe de implementação.
 */
export const SEMENTE_PADRAO = 0x5eed;

/* ── LCG minúsculo ────────────────────────────────────────────────────
 * Numerical Recipes. Não é criptografia e não precisa ser: precisa ser
 * barato, espalhado o bastante para o olho não achar padrão, e IGUAL toda
 * vez. `>>> 0` mantém tudo em 32 bits sem sinal. */
function ruido(semente) {
  const n = (Math.imul(semente >>> 0, 1664525) + 1013904223) >>> 0;
  return n / 4294967296; // [0,1)
}

const inteiro = (v) => (Number.isFinite(v) ? Math.round(v) : 0);

/**
 * As células de BORDA da região revelada.
 *
 * Uma célula entra quando está revelada e tem ao menos um vizinho coberto na
 * 4-vizinhança. O miolo fica de fora — é o que faz o custo ser proporcional ao
 * perímetro, não à área (numa grade 600×400, milhares de células em vez de
 * 240 000).
 *
 * **A borda do bitmap conta como coberta**: `celulaAcesa` devolve `false` fora
 * da grade. Sem isso, uma névoa que chega na margem do mapa terminaria sem
 * contorno, e o desenho pareceria cortado a tesoura.
 *
 * O `normal` é para onde o traço aponta: a soma das direções dos vizinhos
 * cobertos, normalizada. Célula cercada de revelado pelos quatro lados tem
 * soma zero — é o miolo, e sai fora.
 *
 * @param {object} mascara máscara de `fogMask.criarMascara`.
 * @returns {Array<{cx:number, cy:number, nx:number, ny:number}>} em coordenadas
 *   de GRADE. Lista vazia para máscara inválida, vazia ou totalmente revelada.
 */
export function contornoDaMascara(mascara) {
  if (!mascara || !mascara.bits || !Number.isFinite(mascara.colunas) || !Number.isFinite(mascara.linhas)) {
    return [];
  }

  const { colunas, linhas } = mascara;
  const saida = [];

  for (let cy = 0; cy < linhas; cy += 1) {
    for (let cx = 0; cx < colunas; cx += 1) {
      if (!celulaAcesa(mascara, cx, cy)) continue;

      /* Cada vizinho coberto empurra o normal para o lado dele. */
      let nx = 0;
      let ny = 0;
      if (!celulaAcesa(mascara, cx - 1, cy)) nx -= 1;
      if (!celulaAcesa(mascara, cx + 1, cy)) nx += 1;
      if (!celulaAcesa(mascara, cx, cy - 1)) ny -= 1;
      if (!celulaAcesa(mascara, cx, cy + 1)) ny += 1;

      if (nx === 0 && ny === 0) continue; // miolo: nenhum vizinho coberto

      const norma = Math.hypot(nx, ny);
      saida.push({ cx, cy, nx: nx / norma, ny: ny / norma });
    }
  }

  return saida;
}

/**
 * Os traços da franja, em coordenadas de MUNDO.
 *
 * Cada célula de contorno vira um risco que sai de dentro do revelado e aponta
 * para fora, com comprimento e desvio lateral próprios. É a irregularidade que
 * faz parecer pena; um contorno de comprimento constante parece contorno de
 * software, que é justamente o que estamos trocando.
 *
 * @param {Array<{cx,cy,nx,ny}>} contorno saída de `contornoDaMascara`.
 * @param {object} [opcoes]
 * @param {number} [opcoes.escala] tamanho da célula em unidades de mundo.
 *   Padrão 1 — quem chama passa `mascara.escala`.
 * @param {number} [opcoes.semente]
 * @returns {Array<{x1:number,y1:number,x2:number,y2:number}>}
 */
export function tracosDaFranja(contorno, opcoes = {}) {
  const celulas = Array.isArray(contorno) ? contorno : [];
  if (celulas.length === 0) return [];

  const escala = Number.isFinite(opcoes.escala) && opcoes.escala > 0 ? opcoes.escala : 1;
  const semente = Number.isFinite(opcoes.semente) ? inteiro(opcoes.semente) : SEMENTE_PADRAO;

  const saida = [];
  for (let i = 0; i < celulas.length; i += 1) {
    const c = celulas[i];
    if (!c || !Number.isFinite(c.cx) || !Number.isFinite(c.cy)) continue;
    if (!Number.isFinite(c.nx) || !Number.isFinite(c.ny)) continue;
    if (c.nx === 0 && c.ny === 0) continue;

    /* A semente sai da POSIÇÃO da célula, não do índice na lista: assim o
       traço de um lugar continua o mesmo quando a região cresce e a ordem da
       varredura muda. Sem isso a franja inteira se redesenharia a cada
       revelação, e a borda antiga piscaria sem motivo. */
    const chave = (inteiro(c.cy) * 73856093) ^ (inteiro(c.cx) * 19349663) ^ semente;
    const r1 = ruido(chave);
    const r2 = ruido(chave + 0x9e3779b9);

    const comprimento = (COMPRIMENTO_DO_TRACO + (r1 * 2 - 1) * VARIACAO_DO_COMPRIMENTO) * escala;
    if (comprimento <= 0) continue;

    const desvio = (r2 * 2 - 1) * DESVIO_LATERAL * escala;
    /* Perpendicular ao normal — é por onde o pé do traço escorrega. */
    const px = -c.ny;
    const py = c.nx;

    /* Centro da célula em coordenadas de mundo, já com o desvio lateral. */
    const mx = (c.cx + 0.5) * escala + px * desvio;
    const my = (c.cy + 0.5) * escala + py * desvio;

    saida.push({
      x1: mx - c.nx * comprimento * 0.35,
      y1: my - c.ny * comprimento * 0.35,
      x2: mx + c.nx * comprimento * 0.65,
      y2: my + c.ny * comprimento * 0.65,
    });
  }

  return saida;
}

/**
 * Atalho: da máscara direto aos traços, já na escala dela.
 *
 * @param {object} mascara
 * @param {number} [semente]
 * @returns {Array<{x1:number,y1:number,x2:number,y2:number}>}
 */
export function franjaDaMascara(mascara, semente) {
  const contorno = contornoDaMascara(mascara);
  if (contorno.length === 0) return [];
  return tracosDaFranja(contorno, {
    escala: mascara?.escala,
    semente: Number.isFinite(semente) ? semente : SEMENTE_PADRAO,
  });
}
