/* ════════════════════════════════════════════════════════════════════
 *  OS CINCO MOVIMENTOS — A MATEMÁTICA  (spec 0028 · F7 · AC-11 · design §5.4)
 *  --------------------------------------------------------------------
 *  Só funções puras e tabelas: nenhum JSX, nenhum hook, nenhum I/O. Quem
 *  anima é o CSS (`MesaStyles.jsx`), sempre em `transform`/`opacity`; quem
 *  decide SE anima é `Editor/animacao.js`. Aqui moram os números — e é aqui
 *  que o teste os aponta, sem precisar de canvas nem de relógio de parede.
 *
 *  ── MOVIMENTO 5 · A TINTA DE HORA DO DIA ────────────────────────────
 *  *"a ilustração recebe uma camada de cor puxada de `party.inGameDatetime`:
 *  quente ao meio-dia, âmbar no poente, fria e azulada à noite"*.
 *
 *  Três decisões que valem ser ditas em voz alta:
 *
 *  1. **A tinta mora ABAIXO dos nós.** Ela entra entre a ilustração e a
 *     névoa — nunca por cima dos ícones nem dos rótulos. Por isso a cor do
 *     que se lê não muda em período nenhum: o que muda é só o fundo, e a
 *     conta de contraste vira figura-contra-fundo, não figura-tingida.
 *
 *  2. **O alfa é o freio.** Os períodos claros (manhã, tarde) carregam alfa
 *     baixo justamente porque clarear o fundo é o que aproximaria o fundo do
 *     rótulo claro. Medido sobre o palco do módulo, o PIOR caso dos quatro
 *     períodos é 8,79:1 — bem acima dos 4,5:1 do AC. Sobre uma ilustração
 *     clara do usuário quem garante o piso é a placa do rótulo
 *     (`.wmm-rotulo` em `MesaStyles.jsx`: ≥5,14:1 até sobre branco puro).
 *
 *  3. **Sem relógio, sem tinta.** `inGameDatetime` nasce `null` (a instância
 *     começa sem tempo corrido). Tingir uma mesa que ainda não tem hora seria
 *     inventar ficção; o neutro é a resposta honesta, e a tinta acende sozinha
 *     no primeiro avanço de relógio.
 *
 *  Gate: `__tests__/f7-anim-tinta.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { periodoDoDia, COR_DO_RASTRO, pintarPercurso } from "./mesaUi";

const lista = (v) => (Array.isArray(v) ? v : []);
const ehPonto = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/* ════════════════════════════════════════════════════════════════════
 *  MOVIMENTO 5 · A TINTA DE HORA DO DIA
 * ══════════════════════════════════════════════════════════════════ */

/** Os quatro períodos, na ordem do dia — a mesma lista de `periodoDoDia`. */
export const PERIODOS = Object.freeze(["madrugada", "manhã", "tarde", "noite"]);

/**
 * As paradas de cada degradê, em DADO — não em texto.
 *
 * O CSS é gerado a partir daqui (`degrade`), e não escrito à mão, justamente
 * para o teste de contraste poder medir os MESMOS números que o navegador vai
 * compor. Uma cor mexida aqui é uma cor medida lá; não há como as duas
 * versões divergirem em silêncio.
 *
 * `cor` é RGB puro e `alfa` é o peso da parada — o maior alfa de cada período
 * é o ponto onde a tinta mais pesa, e é sobre ele que a conta de contraste do
 * cabeçalho foi feita.
 */
const PALETA = Object.freeze({
  madrugada: {
    /* Antes do sol: azul profundo, o mais frio e o mais pesado dos quatro. */
    forma: "linear-gradient(180deg",
    paradas: [
      { cor: [16, 26, 66], alfa: 0.36, em: "0%" },
      { cor: [12, 20, 52], alfa: 0.28, em: "100%" },
    ],
    rotulo: "Madrugada",
  },
  "manhã": {
    /* Luz nova entrando de canto: clara, quase sem peso — o alfa mais baixo. */
    forma: "radial-gradient(120% 100% at 22% 8%",
    paradas: [
      { cor: [255, 232, 190], alfa: 0.09, em: "0%" },
      { cor: [214, 226, 242], alfa: 0.05, em: "100%" },
    ],
    rotulo: "Manhã",
  },
  tarde: {
    /* Quente no alto, âmbar embaixo: é o meio-dia virando poente. */
    forma: "linear-gradient(180deg",
    paradas: [
      { cor: [255, 196, 120], alfa: 0.07, em: "0%" },
      { cor: [255, 150, 62], alfa: 0.13, em: "100%" },
    ],
    rotulo: "Tarde",
  },
  noite: {
    /* Fria e azulada, mais densa nas bordas — a vinheta faz o mapa recolher. */
    forma: "radial-gradient(120% 100% at 50% 38%",
    paradas: [
      { cor: [34, 52, 116], alfa: 0.22, em: "0%" },
      { cor: [16, 26, 64], alfa: 0.30, em: "100%" },
    ],
    rotulo: "Noite",
  },
});

/** As paradas viram um degradê CSS — o único lugar onde isso é montado. */
function degrade({ forma, paradas }) {
  const stops = paradas
    .map((p) => `rgba(${p.cor.join(",")},${p.alfa}) ${p.em}`)
    .join(", ");
  return `${forma}, ${stops})`;
}

/**
 * A paleta pronta para a tela: `fundo` (CSS), `alfa` (o maior do degradê),
 * `paradas` (o dado que o teste de contraste mede) e `rotulo`.
 */
export const TINTA_DO_DIA = Object.freeze(PERIODOS.reduce((acc, p) => {
  const base = PALETA[p];
  acc[p] = Object.freeze({
    alfa: base.paradas.reduce((maior, x) => Math.max(maior, x.alfa), 0),
    fundo: degrade(base),
    paradas: Object.freeze(base.paradas.map((x) => Object.freeze({ ...x }))),
    rotulo: base.rotulo,
  });
  return acc;
}, {}));

/** Quanto dura a passagem de um período para o outro (ms). Sem salto. */
export const TRAVESSIA_DA_TINTA = 1400;

/**
 * O período que a tinta deve pintar, ou `null` quando não há relógio.
 *
 * @param {number|{dia:number,hora:number,minuto:number}|null|undefined} relogio
 *   o `party.inGameDatetime` cru — **não** o normalizado por `relogioDe`, que
 *   inventaria a meia-noite do dia 1 para uma mesa que ainda não tem hora.
 * @returns {'madrugada'|'manhã'|'tarde'|'noite'|null}
 */
export function periodoDaTinta(relogio) {
  if (relogio === null || relogio === undefined) return null;
  if (typeof relogio === "number") return Number.isFinite(relogio) ? periodoDoDia(relogio) : null;
  if (typeof relogio !== "object") return null;
  const temHora = Number.isFinite(relogio.hora) || Number.isFinite(relogio.dia);
  return temHora ? periodoDoDia(relogio) : null;
}

/**
 * A tinta inteira de um relógio: período, cor e alfa.
 *
 * @returns {{periodo:string, alfa:number, fundo:string, rotulo:string}|null}
 *   `null` = neutro (sem relógio) — a mesa fica com a cor da ilustração.
 */
export function tintaDoRelogio(relogio) {
  const periodo = periodoDaTinta(relogio);
  if (!periodo) return null;
  const tinta = TINTA_DO_DIA[periodo];
  return tinta ? { periodo, ...tinta } : null;
}

/* ════════════════════════════════════════════════════════════════════
 *  MOVIMENTO 4 · O MARCADOR — A INCLINAÇÃO
 *  --------------------------------------------------------------------
 *  *"leve inclinação na direção do movimento"*. A bandeira não gira com o
 *  rumo (isso a deixaria de cabeça para baixo indo para a esquerda): ela
 *  TOMBA para o lado em que está indo, como quem se inclina contra o vento.
 *  Logo, só a componente horizontal manda — `cos` do ângulo, e nada mais.
 * ══════════════════════════════════════════════════════════════════ */

/** O tombo máximo, em graus. Mais que isto e o marcador vira desenho animado. */
export const INCLINACAO_MAXIMA = 11;

/** Quantos pontos para trás olhar: um só treme, muitos atrasam a resposta. */
export const PONTOS_DE_RUMO = 6;

/**
 * O tombo do marcador, em graus, a partir do trecho já percorrido.
 *
 * Positivo = tombando para a direita (indo para a direita). Parado, zero —
 * o AC-11 pede flutuação para o grupo parado, não inclinação.
 *
 * @param {Array<{x:number,y:number}>} pontos o rastro desta viagem.
 * @param {boolean} [viajando]
 * @returns {number} graus, sempre em `[-INCLINACAO_MAXIMA, INCLINACAO_MAXIMA]`.
 */
export function inclinacaoDoMarcador(pontos, viajando = true) {
  if (!viajando) return 0;
  const p = lista(pontos).filter(ehPonto);
  if (p.length < 2) return 0;

  const fim = p[p.length - 1];
  const inicio = p[Math.max(0, p.length - 1 - PONTOS_DE_RUMO)];
  const dx = fim.x - inicio.x;
  const dy = fim.y - inicio.y;
  const dist = Math.hypot(dx, dy);
  if (!(dist > 0)) return 0;

  const grau = (dx / dist) * INCLINACAO_MAXIMA;
  return Math.round(grau * 10) / 10;
}

/* ════════════════════════════════════════════════════════════════════
 *  MOVIMENTO 4 · O RASTRO QUE DESVANECE
 *  --------------------------------------------------------------------
 *  O rastro chapado diz "o grupo andou por aqui". O rastro que desvanece diz
 *  a mesma coisa **e** para onde ele está indo: a ponta acesa puxa o olho até
 *  o marcador, e o começo apagado vira memória em vez de informação nova.
 *
 *  Custa poucas passadas, não uma por segmento: o caminho inteiro sai numa
 *  linha fraca (a memória) e só a CAUDA é dividida em faixas que acendem.
 *  As faixas se sobrepõem por um ponto — sem isso apareceria costura entre
 *  elas, que é exatamente o defeito que o efeito deveria esconder.
 * ══════════════════════════════════════════════════════════════════ */

/** Em quantas faixas a cauda acende. Seis já lê como degradê. */
export const FAIXAS_DO_RASTRO = 6;

/** Que fração final do percurso é "cauda". O resto é memória. */
export const FRACAO_DA_CAUDA = 0.45;

export const ALFA_DA_MEMORIA = 0.22;
export const ALFA_DA_PONTA = 0.95;

/** O dourado do rastro sem o alfa — o alfa é o que varia por faixa. */
export const RASTRO_RGB = "233,213,160";

/**
 * Pinta o rastro com desvanecimento: memória fraca no começo, ponta acesa
 * junto do marcador.
 *
 * @param {CanvasRenderingContext2D|null} ctx `null` é no-op (jsdom).
 * @param {{pontos:Array, pan:{x,y}, scale:number}} opcoes
 * @returns {{pintou:boolean, faixas:number}} o que o teste inspeciona sem pixels.
 */
export function pintarRastro(ctx, opcoes = {}) {
  const pontos = lista(opcoes.pontos).filter(ehPonto);
  if (!ctx || typeof ctx.beginPath !== "function" || pontos.length < 2) {
    return { pintou: false, faixas: 0 };
  }

  /* A tinta do rastro é o dourado, salvo quando quem chama manda outra — é o
     que a rota bicolor da 0035 faz para o trecho percorrido sair no acento do
     tema. Sem `rgb`, nada muda para quem já chamava. */
  const rgb = typeof opcoes.rgb === "string" && opcoes.rgb.trim() ? opcoes.rgb : RASTRO_RGB;

  /* 1 · O caminho inteiro, apagado: a memória de onde o grupo veio. */
  pintarPercurso(ctx, {
    pontos, pan: opcoes.pan, scale: opcoes.scale,
    cor: `rgba(${rgb},${ALFA_DA_MEMORIA})`,
  });

  /* 2 · A cauda, em faixas que acendem até o marcador. */
  const s = Number.isFinite(opcoes.scale) && opcoes.scale > 0 ? opcoes.scale : 1;
  const px = Number.isFinite(opcoes.pan?.x) ? opcoes.pan.x : 0;
  const py = Number.isFinite(opcoes.pan?.y) ? opcoes.pan.y : 0;

  const inicioDaCauda = Math.max(0, Math.floor(pontos.length * (1 - FRACAO_DA_CAUDA)));
  const cauda = pontos.slice(inicioDaCauda);
  if (cauda.length < 2) return { pintou: true, faixas: 0 };

  const faixas = Math.min(FAIXAS_DO_RASTRO, cauda.length - 1);
  const porFaixa = (cauda.length - 1) / faixas;
  const largura = Math.max(2.5, 4.2 * Math.max(0.55, Math.min(2.2, s)));

  ctx.save?.();
  if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let f = 0; f < faixas; f += 1) {
    const t = faixas === 1 ? 1 : f / (faixas - 1);
    const alfa = ALFA_DA_MEMORIA + (ALFA_DA_PONTA - ALFA_DA_MEMORIA) * t;
    const de = Math.round(f * porFaixa);
    /* `+1` de sobreposição: a faixa termina onde a próxima começa. */
    const ate = Math.min(cauda.length - 1, Math.round((f + 1) * porFaixa));
    if (ate <= de) continue;

    ctx.strokeStyle = `rgba(${rgb},${alfa.toFixed(3)})`;
    ctx.lineWidth = largura * (0.72 + 0.28 * t);
    ctx.beginPath();
    ctx.moveTo(cauda[de].x * s + px, cauda[de].y * s + py);
    for (let i = de + 1; i <= ate; i += 1) {
      ctx.lineTo(cauda[i].x * s + px, cauda[i].y * s + py);
    }
    ctx.stroke();
  }
  ctx.restore?.();

  return { pintou: true, faixas };
}

/* ════════════════════════════════════════════════════════════════════
 *  A ROTA BICOLOR  (spec 0035 · F1 · AC-1)
 *  --------------------------------------------------------------------
 *  Durante a viagem a trilha deixa de ser um traço só: o que o grupo já andou
 *  sai no acento do tema, o que falta sai no dourado da trilha. O marcador
 *  fica na junção, e por isso a rota responde de relance a duas perguntas que
 *  antes exigiam contar o rastro — "de onde eu vim" e "quanto falta".
 *
 *  As duas metades vêm de `partirNoProgresso` (`model/curves.js`), que corta
 *  por comprimento de arco e devolve o ponto de corte nas DUAS listas. Não
 *  há dois cortes a divergir, e por isso não existe vão sob o marcador.
 *
 *  A ORDEM DA PINTURA IMPORTA: o restante primeiro, o percorrido por cima.
 *  Elas se encostam no ponto de corte, e a que chega depois manda no pixel
 *  compartilhado — que é onde o marcador está.
 * ══════════════════════════════════════════════════════════════════ */

/** Dourado do trecho que falta andar — o mesmo da trilha normal do editor. */
export const COR_DA_ROTA_RESTANTE = "rgba(214,196,150,0.72)";

/** Acento de reserva, quando o tema não puder ser lido (SSR, teste, canvas solto). */
export const RGB_DO_PERCORRIDO_RESERVA = "176,48,216";

/**
 * Os três canais de uma cor CSS, no formato `"r,g,b"` que o rastro espera.
 *
 * O canvas 2D não resolve `var(--…)`, então o acento chega aqui já resolvido
 * pelo `getComputedStyle` — mas resolvido pode ser `#c9a84c` ou
 * `rgb(201, 168, 76)`, dependendo do navegador. Os dois entram; o que não for
 * reconhecido cai na reserva, porque uma trilha invisível é pior que uma
 * trilha da cor errada.
 *
 * @param {string} cor
 * @returns {string} `"r,g,b"`
 */
export function rgbDeCor(cor) {
  const texto = typeof cor === "string" ? cor.trim() : "";
  if (!texto) return RGB_DO_PERCORRIDO_RESERVA;

  const hex = texto.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const [r, g, b] = hex.split("");
    return `${parseInt(r + r, 16)},${parseInt(g + g, 16)},${parseInt(b + b, 16)}`;
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)}`;
  }

  const m = texto.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (m) return `${Math.round(+m[1])},${Math.round(+m[2])},${Math.round(+m[3])}`;

  return RGB_DO_PERCORRIDO_RESERVA;
}

/**
 * Pinta a rota da viagem em duas cores.
 *
 * Delega o trecho percorrido a `pintarRastro` — não repete a matemática das
 * faixas —, só trocando a tinta pelo acento. O desvanecimento continua ali:
 * memória fraca atrás, ponta acesa junto do marcador.
 *
 * @param {CanvasRenderingContext2D|null} ctx `null` é no-op (jsdom).
 * @param {object} opcoes
 * @param {Array<{x:number,y:number}>} [opcoes.percorrido]
 * @param {Array<{x:number,y:number}>} [opcoes.restante]
 * @param {{x:number,y:number}} [opcoes.pan]
 * @param {number} [opcoes.scale]
 * @param {string} [opcoes.corDoPercorrido] acento do tema, já resolvido.
 * @returns {{pintou:boolean, pintouRestante:boolean, pintouPercorrido:boolean}}
 *   o que o teste inspeciona sem precisar de pixels.
 */
export function pintarRotaBicolor(ctx, opcoes = {}) {
  const percorrido = lista(opcoes.percorrido).filter(ehPonto);
  const restante = lista(opcoes.restante).filter(ehPonto);
  const nada = { pintou: false, pintouRestante: false, pintouPercorrido: false };
  if (!ctx || typeof ctx.beginPath !== "function") return nada;

  /* 1 · O que falta, no dourado da trilha. Vai primeiro: o percorrido cobre
     o pixel do corte, e o corte é onde o marcador está. */
  const pintouRestante = restante.length >= 2 && pintarPercurso(ctx, {
    pontos: restante, pan: opcoes.pan, scale: opcoes.scale, cor: COR_DA_ROTA_RESTANTE,
  }).pintou;

  /* 2 · O que já foi andado, no acento — com o desvanecimento do movimento 4. */
  const pintouPercorrido = pintarRastro(ctx, {
    pontos: percorrido, pan: opcoes.pan, scale: opcoes.scale,
    rgb: rgbDeCor(opcoes.corDoPercorrido),
  }).pintou;

  return {
    pintou: !!pintouRestante || !!pintouPercorrido,
    pintouRestante: !!pintouRestante,
    pintouPercorrido: !!pintouPercorrido,
  };
}

/* O dourado cheio continua sendo o de `mesaUi` — reexportado para quem só
   quer a cor, sem carregar dois nomes para a mesma tinta. */
export { COR_DO_RASTRO };
