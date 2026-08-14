/**
 * Mapa-Múndi — MATEMÁTICA DE CURVA (spec 0028, AC-4 · F2).
 *
 * Trilha não é reta: o briefing (§5) guarda `path_points` em cada aresta, e o
 * design §3 os chama de `pathPoints`. Aqui eles são tratados como **pontos de
 * controle** de uma Bézier — não como a polilinha inteira. Sem controle, a
 * trilha é a reta entre os dois nós.
 *
 * Lógica pura: sem React, sem Firebase, sem DOM, sem `Math.random()` nem
 * `Date.now()`. Tudo determinístico — é o que permite o teste exaustivo e, na
 * F4, o marcador do grupo andar sempre igual sobre a mesma trilha.
 *
 * Convenção de coordenadas: **mundo** (a mesma dos nós), nunca tela. Quem
 * converte é `useMapCamera`.
 *
 * Gate: `__tests__/curves.test.js`.
 */

/**
 * Quantos segmentos a curva ganha ao ser amostrada. 32 é o ponto em que o erro
 * da poligonal já é menor que meio pixel de mundo numa trilha típica, e ainda
 * assim é barato para centenas de trilhas por quadro (design §5.3: trilhas são
 * pintadas em canvas).
 */
export const AMOSTRAS_PADRAO = 32;

/** Curvatura do controle automático: fração do comprimento da trilha. */
export const CURVATURA_PADRAO = 0.15;

const ehPonto = (p) =>
  !!p && typeof p === "object" && Number.isFinite(p.x) && Number.isFinite(p.y);

function exigePonto(p, nome) {
  if (!ehPonto(p)) {
    throw new Error(`${nome} é inválido: x e y precisam ser números finitos.`);
  }
  return { x: p.x, y: p.y };
}

/** Normaliza a lista de controles: aceita um ponto solto, array, ou nada. */
function listaDeControles(controles) {
  if (!controles) return [];
  const bruto = Array.isArray(controles) ? controles : [controles];
  return bruto.filter(ehPonto).map((p) => ({ x: p.x, y: p.y }));
}

const quadratica = (a, c, b, t) => {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
};

const cubica = (a, c1, c2, b, t) => {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * a.x + 3 * uu * t * c1.x + 3 * u * tt * c2.x + tt * t * b.x,
    y: uu * u * a.y + 3 * uu * t * c1.y + 3 * u * tt * c2.y + tt * t * b.y,
  };
};

/**
 * Amostra a trilha em pontos de mundo.
 *
 * - **sem controle** → a reta: devolve exatamente `[from, to]` (2 pontos, sem
 *   arredondamento — a reta não precisa de aproximação);
 * - **1 controle** → Bézier **quadrática**;
 * - **2 ou mais** → Bézier **cúbica** com os dois primeiros (os demais são
 *   ignorados; a UI não oferece mais que dois).
 *
 * Controles malformados são descartados em silêncio — dado velho ou meio
 * gravado degrada para uma trilha mais reta, nunca para uma tela quebrada. Já
 * as **pontas** são exigidas: sem elas não existe trilha, e o erro precisa
 * aparecer em desenvolvimento.
 *
 * @param {{x:number,y:number}} from ponta inicial (posição do nó de origem).
 * @param {{x:number,y:number}} to ponta final (posição do nó de destino).
 * @param {Array<{x:number,y:number}>|{x:number,y:number}|null} [controles]
 * @param {number} [amostras=AMOSTRAS_PADRAO] número de segmentos.
 * @returns {Array<{x:number,y:number}>} polilinha, sempre com as pontas exatas.
 */
export function pontosDaCurva(from, to, controles, amostras = AMOSTRAS_PADRAO) {
  const a = exigePonto(from, "O ponto inicial da curva");
  const b = exigePonto(to, "O ponto final da curva");
  const ctrl = listaDeControles(controles);
  if (ctrl.length === 0) return [a, b];

  const n = Number.isFinite(amostras) && amostras >= 1 ? Math.floor(amostras) : AMOSTRAS_PADRAO;
  const pts = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts[i] = ctrl.length === 1
      ? quadratica(a, ctrl[0], b, t)
      : cubica(a, ctrl[0], ctrl[1], b, t);
  }
  // As pontas voltam exatas: a aritmética de ponto flutuante deixa resíduo em
  // t=0/t=1, e o nó tem que casar com a trilha ao pixel.
  pts[0] = a;
  pts[n] = b;
  return pts;
}

/**
 * Comprimento real da polilinha — a soma dos segmentos.
 * Base do "quanto já andei" da F4 (o marcador anda por comprimento, não por
 * parâmetro da Bézier).
 *
 * @param {Array<{x:number,y:number}>} pontos
 * @returns {number} 0 para lista vazia, de um ponto só ou inválida.
 */
export function comprimentoDaCurva(pontos) {
  if (!Array.isArray(pontos) || pontos.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < pontos.length; i++) {
    const p = pontos[i - 1];
    const q = pontos[i];
    if (!ehPonto(p) || !ehPonto(q)) continue;
    total += Math.hypot(q.x - p.x, q.y - p.y);
  }
  return total;
}

/**
 * Posição em `t ∈ [0,1]` medida no **comprimento real** da curva.
 *
 * A diferença para o parâmetro cru da Bézier importa: com o parâmetro, o
 * marcador acelera nos trechos retos e freia nas dobras. Por comprimento, ele
 * anda em velocidade constante — que é o que o olho espera de um grupo viajando.
 *
 * `t` fora de [0,1] é grampeado; `t` inválido vira 0.
 *
 * @param {Array<{x:number,y:number}>} pontos polilinha (de `pontosDaCurva`).
 * @param {number} t fração do comprimento.
 * @returns {{x:number,y:number}}
 * @throws {Error} quando não há ponto nenhum.
 */
export function pontoNaFracao(pontos, t) {
  const pts = (Array.isArray(pontos) ? pontos : []).filter(ehPonto);
  if (pts.length === 0) {
    throw new Error("A curva precisa de ao menos um ponto para localizar uma fração.");
  }
  if (pts.length === 1) return { ...pts[0] };

  const f = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const total = comprimentoDaCurva(pts);
  if (total === 0) return { ...pts[0] };

  const alvo = total * f;
  let percorrido = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const seg = Math.hypot(q.x - p.x, q.y - p.y);
    const ultimo = i === pts.length - 1;
    if (percorrido + seg >= alvo || ultimo) {
      const k = seg === 0 ? 0 : Math.min(1, Math.max(0, (alvo - percorrido) / seg));
      return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
    }
    percorrido += seg;
  }
  return { ...pts[pts.length - 1] }; // inalcançável, mas nunca devolve undefined
}

/**
 * Parte a polilinha no progresso `t`, medido no **comprimento real** — a mesma
 * régua de `pontoNaFracao`, e por isso o corte cai exatamente onde o marcador
 * do grupo está desenhado.
 *
 * Serve à rota bicolor da spec 0035 (AC-1): o trecho já andado é pintado numa
 * cor e o que falta em outra. As duas metades **compartilham o ponto de corte**
 * — ele é o último de `percorrido` e o primeiro de `restante` —, senão sobra um
 * vão de meio pixel na junção, bem embaixo do marcador, que é justamente onde o
 * olho está.
 *
 * O corte é **interpolado dentro do segmento**, nunca arredondado para o vértice
 * mais próximo: com as 32 amostras do padrão, arredondar faz a junção pular de
 * vértice em vértice enquanto o marcador desliza contínuo (AC-2).
 *
 * @param {Array<{x:number,y:number}>} pontos polilinha (de `pontosDaCurva`).
 * @param {number} t fração do comprimento; fora de [0,1] é grampeado, inválido vira 0.
 * @returns {{percorrido:Array<{x:number,y:number}>, restante:Array<{x:number,y:number}>}}
 *   Nunca lança e nunca devolve `undefined`: lista vazia entra, duas listas
 *   vazias saem.
 */
export function partirNoProgresso(pontos, t) {
  const pts = (Array.isArray(pontos) ? pontos : []).filter(ehPonto).map((p) => ({ x: p.x, y: p.y }));
  if (pts.length === 0) return { percorrido: [], restante: [] };
  if (pts.length === 1) return { percorrido: [{ ...pts[0] }], restante: [{ ...pts[0] }] };

  const f = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const total = comprimentoDaCurva(pts);

  // Curva degenerada (todos os pontos no mesmo lugar): não há o que partir, e
  // dividir pelo comprimento zero adiante daria NaN.
  if (total === 0) return { percorrido: [{ ...pts[0] }], restante: pts.map((p) => ({ ...p })) };
  if (f <= 0) return { percorrido: [{ ...pts[0] }], restante: pts.map((p) => ({ ...p })) };
  if (f >= 1) return { percorrido: pts.map((p) => ({ ...p })), restante: [{ ...pts[pts.length - 1] }] };

  const alvo = total * f;
  let percorridoAte = 0;

  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    const seg = Math.hypot(q.x - p.x, q.y - p.y);

    if (percorridoAte + seg >= alvo) {
      const k = seg === 0 ? 0 : Math.min(1, Math.max(0, (alvo - percorridoAte) / seg));
      const corte = { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
      return {
        percorrido: [...pts.slice(0, i), corte],
        restante: [{ ...corte }, ...pts.slice(i)],
      };
    }
    percorridoAte += seg;
  }

  // Inalcançável com `f < 1` e `total > 0`, mas o resíduo de ponto flutuante
  // não pode virar um retorno vazio na tela do jogador.
  return { percorrido: pts.map((p) => ({ ...p })), restante: [{ ...pts[pts.length - 1] }] };
}

/**
 * Menor distância de um ponto a um segmento (projeção grampeada nas pontas).
 * @returns {number}
 */
export function distanciaAoSegmento(ponto, a, b) {
  if (!ehPonto(ponto) || !ehPonto(a) || !ehPonto(b)) return Infinity;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const den = dx * dx + dy * dy;
  const k = den === 0 ? 0 : Math.min(1, Math.max(0, ((ponto.x - a.x) * dx + (ponto.y - a.y) * dy) / den));
  return Math.hypot(ponto.x - (a.x + dx * k), ponto.y - (a.y + dy * k));
}

/**
 * Menor distância de um ponto à polilinha — o hit-test de "cliquei nessa
 * trilha?". Compara contra a curva amostrada, não contra a corda: numa trilha
 * bem curvada as duas coisas ficam longe uma da outra.
 *
 * @returns {number} `Infinity` quando não há geometria para comparar.
 */
export function distanciaAteCurva(ponto, pontos) {
  if (!ehPonto(ponto)) return Infinity;
  const pts = (Array.isArray(pontos) ? pontos : []).filter(ehPonto);
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) return Math.hypot(ponto.x - pts[0].x, ponto.y - pts[0].y);

  let menor = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const d = distanciaAoSegmento(ponto, pts[i - 1], pts[i]);
    if (d < menor) menor = d;
  }
  return menor;
}

/**
 * Controle sugerido para uma trilha nova: desloca o meio da reta pela
 * perpendicular, numa fração do próprio comprimento.
 *
 * **Determinístico de propósito** — nada de `Math.random()`. Duas trilhas
 * paralelas nascem com a mesma curvatura, e o mapa padrão (AC-13) tem sempre o
 * mesmo desenho. O lado é sempre o mesmo (perpendicular à esquerda do sentido
 * origem→destino), então inverter as pontas espelha a curva, o que é o
 * comportamento que o mestre espera ao redesenhar a trilha ao contrário.
 *
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} [curvatura=CURVATURA_PADRAO] fração do comprimento.
 * @returns {{x:number,y:number}} o próprio ponto quando as pontas coincidem.
 */
export function controlePadrao(from, to, curvatura = CURVATURA_PADRAO) {
  const a = exigePonto(from, "O ponto inicial da curva");
  const b = exigePonto(to, "O ponto final da curva");
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: a.x, y: a.y };

  const c = Number.isFinite(curvatura) ? curvatura : CURVATURA_PADRAO;
  const desvio = len * c;
  return {
    x: (a.x + b.x) / 2 + (-dy / len) * desvio,
    y: (a.y + b.y) / 2 + (dx / len) * desvio,
  };
}
