/* ════════════════════════════════════════════════════════════════════
 *  A MÁSCARA DE NÉVOA — BITMAP, RLE E DELTAS  (spec 0028 · F3 · AC-5)
 *  --------------------------------------------------------------------
 *  Lógica pura: nenhum React, nenhum DOM, nenhum Firebase. Tudo aqui é
 *  função e número — é o que permite testar a névoa inteira sem montar
 *  um canvas nem subir um emulador.
 *
 *  ── POR QUE ISTO É SUBSISTEMA NOVO, E NÃO REUSO ─────────────────────
 *  A névoa do editor tático é uma LISTA DE FORMAS VETORIAIS gravada numa
 *  máscara SVG dentro do documento da cena (F0 §2). Cada corte reescreve
 *  o documento inteiro, e a lista cresce sem limite. Para a revelação
 *  CONTÍNUA da viagem (F4) — dezenas de círculos por trilha percorrida —
 *  isso é insustentável, e o próprio briefing proíbe ("não persista lista
 *  de círculos"). Aqui é BITMAP, e o custo de revelar é constante: acender
 *  bits que já existem, nunca acrescentar itens a uma lista.
 *
 *  ── O FORMATO, E POR QUE ELE CABE NO FIRESTORE ──────────────────────
 *  · 1 bit por pixel (revelado / coberto). Sem cor, sem alfa parcial — a
 *    borda suave é do RENDER, não do dado (ver `CamadaDeNevoa.jsx`).
 *  · Downscale de 4× em relação ao mundo. Num mapa de 2400×1600 a grade
 *    vira 600×400 = 240.000 bits = 30 KB CRUS.
 *  · Compressão por repetição (RLE) com comprimentos em varint, e depois
 *    base64 para virar string de campo do Firestore.
 *
 *  Névoa real é feita de áreas contíguas — linhas inteiras cobertas, linhas
 *  inteiras reveladas. O RLE come isso quase todo: máscara toda coberta são
 *  POUCOS BYTES, e uma máscara com dezenas de clareiras fica na casa das
 *  dezenas de KB. Folga enorme sob o teto de 1 MiB do documento.
 *
 *  Por que não Storage: o bucket não existe e exige plano Blaze (ADR-0008 /
 *  0009). E mesmo com Blaze a máscara muda o tempo todo durante a viagem —
 *  reescrever arquivo grande a cada passo seria ruim de qualquer forma. Daí
 *  `diferenca()` e `mesclar()` existirem desde já: é com eles que a F7 manda
 *  DELTAS pelo tempo real, e não o bitmap inteiro (AC-10).
 *
 *  ── MUTAÇÃO EM LUGAR, DE PROPÓSITO ──────────────────────────────────
 *  `revelarCirculo`, `cobrirCirculo` e `revelarAoLongoDe` MUTAM a máscara
 *  recebida e devolvem a MESMA referência, com `revisao` incrementada.
 *  Copiar 30 KB a cada movimento do pincel (ou a cada passo da viagem)
 *  seria desperdício puro. Quem precisa de imutabilidade chama `clonar()`
 *  antes; quem precisa saber que mudou olha `revisao` — é esse número que
 *  o React usa para repintar, já que a identidade do objeto não muda.
 *
 *  `mesclar` e `diferenca` NÃO mutam: devolvem máscara nova. Eles são
 *  operações de conjunto, não pinceladas.
 *
 *  Gate: `__tests__/fogMask.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

/** Downscale padrão em relação ao mundo (AC-5). 4× é o que a spec decidiu. */
export const ESCALA_PADRAO = 4;

/**
 * Teto de bytes para a máscara serializada.
 *
 * O documento do Firestore tem 1 MiB contando TODOS os campos. 900 KB deixa
 * folga para dimensões, contadores e carimbos de tempo — o mesmo número que
 * `LIMITE_FUNDO_BYTES` usa para a ilustração, pela mesma razão.
 */
export const TETO_DA_MASCARA_BYTES = 900_000;

/** Marca de formato. Trocar o layout do payload obriga a trocar isto. */
export const MARCA = "nvf1";

/* ── Base64 sem dependência ───────────────────────────────────────────
 * `btoa` existe no navegador e no jsdom, mas não é garantido em todo
 * runtime (e `Buffer` não existe no navegador). Vinte linhas resolvem os
 * dois lados sem acrescentar pacote nenhum ao projeto. */

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const REVERSO = (() => {
  const mapa = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALFABETO.length; i += 1) mapa[ALFABETO.charCodeAt(i)] = i;
  return mapa;
})();

/** Bytes → base64 padrão (com o padding `=`). */
export function bytesParaBase64(bytes) {
  let saida = "";
  const n = bytes.length;
  for (let i = 0; i < n; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < n ? bytes[i + 1] : 0;
    const b2 = i + 2 < n ? bytes[i + 2] : 0;
    saida += ALFABETO[b0 >> 2];
    saida += ALFABETO[((b0 & 3) << 4) | (b1 >> 4)];
    saida += i + 1 < n ? ALFABETO[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    saida += i + 2 < n ? ALFABETO[b2 & 63] : "=";
  }
  return saida;
}

/** base64 → bytes. Recusa caractere fora do alfabeto em vez de adivinhar. */
export function base64ParaBytes(texto) {
  const limpo = String(texto).replace(/=+$/, "");
  const n = limpo.length;
  const saida = new Uint8Array(Math.floor((n * 6) / 8));
  let acumulador = 0;
  let bits = 0;
  let fora = 0;
  for (let i = 0; i < n; i += 1) {
    const codigo = limpo.charCodeAt(i);
    const valor = codigo < 128 ? REVERSO[codigo] : -1;
    if (valor < 0) throw new Error("A névoa gravada está corrompida: o texto não é base64 válido.");
    acumulador = (acumulador << 6) | valor;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      saida[fora] = (acumulador >> bits) & 0xff;
      fora += 1;
    }
  }
  return saida.subarray(0, fora);
}

/* ── Varint (LEB128) ──────────────────────────────────────────────────
 * Comprimento de repetição vai de 1 a algumas centenas de milhares. Um
 * inteiro de 32 bits fixo gastaria 4 bytes sempre; o varint gasta 1 byte
 * para repetições curtas (que são a maioria nas bordas dos círculos) e 3
 * para as longas. */

function escreverVarint(saida, valor) {
  let v = valor >>> 0;
  while (v >= 0x80) {
    saida.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  saida.push(v);
}

function lerVarint(bytes, posicao) {
  let resultado = 0;
  let deslocamento = 0;
  let i = posicao;
  for (;;) {
    if (i >= bytes.length) {
      throw new Error("A névoa gravada está incompleta: o fluxo termina no meio de um número.");
    }
    const byte = bytes[i];
    i += 1;
    resultado += (byte & 0x7f) * 2 ** deslocamento;
    if ((byte & 0x80) === 0) break;
    deslocamento += 7;
    if (deslocamento > 35) {
      throw new Error("A névoa gravada está corrompida: número de repetição fora de faixa.");
    }
  }
  return [resultado, i];
}

/* ── Construção ─────────────────────────────────────────────────────── */

const inteiroPositivo = (valor) => Number.isFinite(valor) && valor > 0;

/**
 * Uma máscara nova, com **tudo coberto**.
 *
 * Tudo coberto é o estado inicial certo: a mesa começa às escuras e a
 * revelação só acrescenta (AC-6). Nascer revelada entregaria o mapa inteiro
 * no primeiro carregamento.
 *
 * @param {number} largura largura do MUNDO, em unidades de mundo.
 * @param {number} altura altura do MUNDO.
 * @param {number} [escala=4] downscale da grade em relação ao mundo.
 * @returns {{largura:number,altura:number,escala:number,colunas:number,linhas:number,bits:Uint8Array,revisao:number}}
 * @throws {Error} em PT-BR quando as dimensões não fazem sentido.
 */
export function criarMascara(largura, altura, escala = ESCALA_PADRAO) {
  if (!inteiroPositivo(largura) || !inteiroPositivo(altura)) {
    throw new Error("A névoa precisa saber o tamanho do mapa: largura e altura têm de ser números maiores que zero.");
  }
  if (!inteiroPositivo(escala)) {
    throw new Error("A escala da névoa precisa ser um número maior que zero.");
  }
  const l = Math.round(largura);
  const a = Math.round(altura);
  const e = Math.round(escala);
  const colunas = Math.max(1, Math.ceil(l / e));
  const linhas = Math.max(1, Math.ceil(a / e));
  return {
    largura: l,
    altura: a,
    escala: e,
    colunas,
    linhas,
    bits: new Uint8Array(Math.ceil((colunas * linhas) / 8)),
    revisao: 0,
  };
}

/**
 * A máscara a usar neste molde: a gravada, se ela couber no mundo atual; senão
 * uma nova, toda coberta.
 *
 * O "se couber" existe porque o mestre pode trocar a ilustração por uma de
 * outro tamanho depois de já ter névoa. Reaproveitar a máscara antiga esticaria
 * o revelado para o lugar errado — melhor recomeçar coberto, que é o estado
 * seguro: nada vaza.
 *
 * @param {object|null} gravada
 * @param {{largura:number, altura:number}} mundo
 * @param {number} [escala]
 * @returns {object}
 */
export function mascaraParaOMundo(gravada, mundo, escala) {
  const largura = Math.round(mundo?.largura || 0);
  const altura = Math.round(mundo?.altura || 0);
  if (gravada && gravada.largura === largura && gravada.altura === altura) return gravada;
  return criarMascara(largura, altura, escala);
}

/** Cópia independente: mexer nela não mexe na original. */
export function clonar(mascara) {
  exigirMascara(mascara);
  return { ...mascara, bits: Uint8Array.from(mascara.bits), revisao: mascara.revisao || 0 };
}

function exigirMascara(mascara) {
  if (!mascara || typeof mascara !== "object" || !(mascara.bits instanceof Uint8Array)) {
    throw new Error("Isto não é uma máscara de névoa válida.");
  }
  return mascara;
}

/** Duas máscaras falam da mesma grade? (pré-requisito de `mesclar`/`diferenca`) */
export function mesmaGrade(a, b) {
  return !!a && !!b
    && a.colunas === b.colunas && a.linhas === b.linhas
    && a.escala === b.escala
    && a.largura === b.largura && a.altura === b.altura;
}

/** Comparação byte a byte — usada nos testes e para decidir se vale gravar. */
export function iguais(a, b) {
  if (!mesmaGrade(a, b)) return false;
  if (a.bits.length !== b.bits.length) return false;
  for (let i = 0; i < a.bits.length; i += 1) if (a.bits[i] !== b.bits[i]) return false;
  return true;
}

/* ── Leitura e escrita de célula ─────────────────────────────────────── */

const lerCelula = (m, cx, cy) => {
  const i = cy * m.colunas + cx;
  return (m.bits[i >> 3] >> (i & 7)) & 1;
};

/**
 * A célula `(cx, cy)` está revelada?
 *
 * `estaRevelado` responde a mesma pergunta em coordenadas de MUNDO; esta
 * responde em coordenadas de GRADE, que é o que quem varre o bitmap célula a
 * célula tem na mão — hoje, a franja de tinta da spec 0035.
 *
 * Existe para que o layout do bit (`cy * colunas + cx`, byte `i >> 3`, bit
 * `i & 7`) continue morando **só aqui**. Um segundo módulo reimplementando o
 * índice é uma divergência esperando para acontecer.
 *
 * Fora da grade devolve `false` — o lado de fora do mapa é coberto, e é isso
 * que faz a borda do bitmap virar contorno.
 *
 * @param {object} mascara
 * @param {number} cx coluna.
 * @param {number} cy linha.
 * @returns {boolean}
 */
export function celulaAcesa(mascara, cx, cy) {
  if (!mascara || !mascara.bits) return false;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false;
  if (cx < 0 || cy < 0 || cx >= mascara.colunas || cy >= mascara.linhas) return false;
  return lerCelula(mascara, cx, cy) === 1;
}

const acenderCelula = (m, cx, cy) => {
  const i = cy * m.colunas + cx;
  m.bits[i >> 3] |= 1 << (i & 7);
};

const apagarCelula = (m, cx, cy) => {
  const i = cy * m.colunas + cx;
  m.bits[i >> 3] &= ~(1 << (i & 7)) & 0xff;
};

/**
 * O ponto de MUNDO `(x, y)` já foi revelado?
 *
 * Fora do mapa devolve `false`: não existe território revelado onde não
 * existe território.
 *
 * @param {object} mascara
 * @param {number} x coordenada de mundo.
 * @param {number} y coordenada de mundo.
 * @returns {boolean}
 */
export function estaRevelado(mascara, x, y) {
  exigirMascara(mascara);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const cx = Math.floor(x / mascara.escala);
  const cy = Math.floor(y / mascara.escala);
  if (cx < 0 || cy < 0 || cx >= mascara.colunas || cy >= mascara.linhas) return false;
  return lerCelula(mascara, cx, cy) === 1;
}

/**
 * Acende ou apaga o disco de centro `(x, y)` e raio `raio`, em coordenadas de
 * MUNDO — a conversão para a grade é problema desta função, não de quem chama.
 *
 * A célula que contém o centro entra SEMPRE (quando o raio é positivo). Sem
 * isso, um raio menor que meia célula não revelaria nada e o pincel pareceria
 * quebrado — o mestre clicaria e não aconteceria coisa alguma.
 *
 * @returns {number} quantas células mudaram de estado.
 */
function marcarDisco(mascara, x, y, raio, aceso) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(raio) || raio <= 0) return 0;

  const { escala, colunas, linhas } = mascara;
  const cxc = x / escala;
  const cyc = y / escala;
  const r = raio / escala;
  const r2 = r * r;

  let mudadas = 0;
  const tocar = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= colunas || cy >= linhas) return;
    const atual = lerCelula(mascara, cx, cy);
    if (atual === (aceso ? 1 : 0)) return;
    if (aceso) acenderCelula(mascara, cx, cy);
    else apagarCelula(mascara, cx, cy);
    mudadas += 1;
  };

  const y0 = Math.max(0, Math.floor(cyc - r));
  const y1 = Math.min(linhas - 1, Math.ceil(cyc + r));
  for (let cy = y0; cy <= y1; cy += 1) {
    const dy = cy + 0.5 - cyc;
    const restante = r2 - dy * dy;
    if (restante < 0) continue;
    const meia = Math.sqrt(restante);
    const x0 = Math.max(0, Math.floor(cxc - meia));
    const x1 = Math.min(colunas - 1, Math.ceil(cxc + meia));
    for (let cx = x0; cx <= x1; cx += 1) {
      const dx = cx + 0.5 - cxc;
      if (dx * dx + dy * dy <= r2) tocar(cx, cy);
    }
  }

  // A célula do centro entra sempre — ver o JSDoc.
  tocar(Math.floor(cxc), Math.floor(cyc));
  return mudadas;
}

/**
 * Revela um círculo. **Muta** `mascara` e devolve a mesma referência.
 *
 * @param {object} mascara
 * @param {number} x centro, em coordenadas de mundo.
 * @param {number} y centro, em coordenadas de mundo.
 * @param {number} raio em unidades de mundo.
 * @returns {object} a própria máscara, com `revisao` incrementada se algo mudou.
 */
export function revelarCirculo(mascara, x, y, raio) {
  exigirMascara(mascara);
  const mudadas = marcarDisco(mascara, x, y, raio, true);
  if (mudadas > 0) mascara.revisao = (mascara.revisao || 0) + 1;
  return mascara;
}

/**
 * Cobre um círculo de volta — o pincel do mestre apagando o que revelou
 * demais. É a única operação que ANDA PARA TRÁS, e por isso é manual: a
 * revelação automática da F4 nunca regride (AC-6).
 *
 * @returns {object} a própria máscara.
 */
export function cobrirCirculo(mascara, x, y, raio) {
  exigirMascara(mascara);
  const mudadas = marcarDisco(mascara, x, y, raio, false);
  if (mudadas > 0) mascara.revisao = (mascara.revisao || 0) + 1;
  return mascara;
}

/**
 * Revela ao longo de uma polilinha — uma "cápsula" de raio constante.
 *
 * **É o que a F4 usa para a névoa abrir durante a viagem** (design §5.4, item
 * 4: "ao viajar, percorre a curva da trilha... com a névoa abrindo
 * continuamente ao longo do caminho"). Também é o que faz o pincel do mestre
 * pintar um traço contínuo em vez de uma fileira de bolinhas separadas quando
 * o ponteiro anda rápido.
 *
 * A amostragem é por passo de meio raio: com o passo maior que o raio
 * sobrariam buracos entre um disco e o seguinte.
 *
 * @param {object} mascara
 * @param {Array<{x:number,y:number}>} pontos em coordenadas de mundo.
 * @param {number} raio
 * @returns {object} a própria máscara.
 */
export function revelarAoLongoDe(mascara, pontos, raio) {
  return marcarAoLongoDe(mascara, pontos, raio, true);
}

/**
 * O inverso: fecha a névoa ao longo da polilinha. É o traço contínuo do pincel
 * do mestre no modo "cobrir" — sem ele, mover o ponteiro rápido deixaria uma
 * fileira de bolinhas em vez de um traço.
 */
export function cobrirAoLongoDe(mascara, pontos, raio) {
  return marcarAoLongoDe(mascara, pontos, raio, false);
}

function marcarAoLongoDe(mascara, pontos, raio, aceso) {
  exigirMascara(mascara);
  const lista = (Array.isArray(pontos) ? pontos : [])
    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!lista.length || !Number.isFinite(raio) || raio <= 0) return mascara;

  const revisaoAntes = mascara.revisao || 0;
  let mudadas = marcarDisco(mascara, lista[0].x, lista[0].y, raio, aceso);

  const passo = Math.max(mascara.escala, raio / 2);
  for (let i = 1; i < lista.length; i += 1) {
    const a = lista[i - 1];
    const b = lista[i];
    const distancia = Math.hypot(b.x - a.x, b.y - a.y);
    const fatias = Math.max(1, Math.ceil(distancia / passo));
    for (let k = 1; k <= fatias; k += 1) {
      const t = k / fatias;
      mudadas += marcarDisco(mascara, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, raio, aceso);
    }
  }

  if (mudadas > 0) mascara.revisao = revisaoAntes + 1;
  return mascara;
}

/** Revela o mapa inteiro. Atalho do mestre — e do teste do caso extremo. */
export function revelarTudo(mascara) {
  exigirMascara(mascara);
  mascara.bits.fill(0xff);
  zerarSobra(mascara);
  mascara.revisao = (mascara.revisao || 0) + 1;
  return mascara;
}

/** Cobre o mapa inteiro (volta ao estado de nascença). */
export function cobrirTudo(mascara) {
  exigirMascara(mascara);
  mascara.bits.fill(0);
  mascara.revisao = (mascara.revisao || 0) + 1;
  return mascara;
}

/**
 * Zera os bits de enchimento do último byte.
 *
 * A grade quase nunca é múltiplo de 8, então sobram bits sem célula nenhuma.
 * Se eles ficassem acesos, `contarReveladas` mentiria e `iguais` diria que duas
 * máscaras equivalentes são diferentes. Fora daqui, ninguém acende sobra: as
 * escritas passam todas por `acenderCelula`, que é indexada por célula real.
 */
function zerarSobra(mascara) {
  const total = mascara.colunas * mascara.linhas;
  const sobra = mascara.bits.length * 8 - total;
  if (sobra <= 0) return;
  const ultimo = mascara.bits.length - 1;
  mascara.bits[ultimo] &= (0xff >> sobra) & 0xff;
}

/* ── Conjuntos: mesclar e diferença (insumo do delta da F7) ──────────── */

const POPCOUNT = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) t[i] = (i & 1) + t[i >> 1];
  return t;
})();

/** Quantas células estão reveladas. */
export function contarReveladas(mascara) {
  exigirMascara(mascara);
  let total = 0;
  for (let i = 0; i < mascara.bits.length; i += 1) total += POPCOUNT[mascara.bits[i]];
  return total;
}

/** Fração revelada do mapa, de 0 a 1 — o número que a UI mostra ao mestre. */
export function fracaoRevelada(mascara) {
  exigirMascara(mascara);
  const total = mascara.colunas * mascara.linhas;
  return total > 0 ? contarReveladas(mascara) / total : 0;
}

function exigirMesmaGrade(a, b) {
  exigirMascara(a);
  exigirMascara(b);
  if (!mesmaGrade(a, b)) {
    throw new Error("As duas névoas falam de mapas de tamanhos diferentes e não podem ser combinadas.");
  }
}

/**
 * União das áreas reveladas — **máscara nova**, sem mutar nenhuma das duas.
 *
 * É a operação que aplica um delta: `mesclar(local, deltaRecebido)`. Como é
 * união, ela é idempotente (`mesclar(a, a)` = `a`) e comutativa — que é
 * exatamente o que o tempo real precisa, porque a mesma revelação pode chegar
 * duas vezes por caminhos diferentes e não pode dar resultado diferente.
 *
 * @throws {Error} se as grades não baterem.
 */
export function mesclar(a, b) {
  exigirMesmaGrade(a, b);
  const saida = clonar(a);
  for (let i = 0; i < saida.bits.length; i += 1) saida.bits[i] |= b.bits[i];
  saida.revisao = (a.revisao || 0) + 1;
  return saida;
}

/**
 * O que foi revelado de `antes` para `depois` — **o delta a transmitir** (AC-10).
 *
 * Só captura o que ACENDEU (`depois AND NOT antes`). Recobrir é operação
 * manual do mestre e não vira delta: o contrato do tempo real é
 * `mesclar(antes, diferenca(antes, depois)) === depois`, e essa igualdade só
 * vale enquanto a revelação não regride — que é justamente a invariante do
 * AC-6. Quando o mestre apaga névoa à mão, o que trafega é a máscara
 * consolidada, não um delta.
 *
 * @returns {object} máscara nova, com bits só nas células que nasceram agora.
 */
export function diferenca(antes, depois) {
  exigirMesmaGrade(antes, depois);
  const saida = criarMascara(depois.largura, depois.altura, depois.escala);
  for (let i = 0; i < saida.bits.length; i += 1) {
    saida.bits[i] = depois.bits[i] & ~antes.bits[i] & 0xff;
  }
  return saida;
}

/** O delta está vazio? (nada mudou → nada a transmitir, nada a gravar) */
export function vazia(mascara) {
  exigirMascara(mascara);
  for (let i = 0; i < mascara.bits.length; i += 1) if (mascara.bits[i] !== 0) return false;
  return true;
}

/* ── Serialização (RLE + base64) ────────────────────────────────────── */

/**
 * A máscara como string compacta.
 *
 * Formato: `nvf1:<largura>:<altura>:<escala>:<base64 do RLE>`.
 *
 * O RLE é uma sequência de comprimentos em varint, alternando o valor a cada
 * comprimento e **começando sempre pelo COBERTO**. Se a primeira célula já
 * está revelada, o fluxo começa com um comprimento zero — custa um byte e
 * dispensa gravar o valor de cada repetição.
 *
 * O cabeçalho fica em texto claro de propósito: dá para olhar o documento no
 * console do Firestore e saber de que mapa aquela névoa é, sem decodificar
 * nada.
 *
 * @param {object} mascara
 * @returns {string}
 */
export function serializar(mascara) {
  exigirMascara(mascara);
  const total = mascara.colunas * mascara.linhas;
  const bytes = [];

  let valorAtual = 0;      // o fluxo começa pelo coberto, por convenção
  let comprimento = 0;
  for (let i = 0; i < total; i += 1) {
    const bit = (mascara.bits[i >> 3] >> (i & 7)) & 1;
    if (bit === valorAtual) {
      comprimento += 1;
    } else {
      escreverVarint(bytes, comprimento);
      valorAtual = bit;
      comprimento = 1;
    }
  }
  escreverVarint(bytes, comprimento);

  const corpo = bytesParaBase64(Uint8Array.from(bytes));
  return `${MARCA}:${mascara.largura}:${mascara.altura}:${mascara.escala}:${corpo}`;
}

/**
 * A máscara de volta, **idêntica bit a bit** à que foi serializada.
 *
 * Texto vazio ou nulo devolve `null` (é "ainda não há névoa gravada", não um
 * erro). Texto presente mas quebrado lança `Error` em PT-BR — corromper em
 * silêncio revelaria ou esconderia o mapa errado, e isso é pior do que uma
 * mensagem na tela.
 *
 * @param {string} texto
 * @returns {object|null}
 */
export function desserializar(texto) {
  if (texto === null || texto === undefined || texto === "") return null;
  if (typeof texto !== "string") {
    throw new Error("A névoa gravada não é texto e não pôde ser lida.");
  }
  const partes = texto.split(":");
  if (partes.length !== 5 || partes[0] !== MARCA) {
    throw new Error("A névoa gravada está num formato que esta versão do Nexus não conhece.");
  }
  const largura = Number(partes[1]);
  const altura = Number(partes[2]);
  const escala = Number(partes[3]);
  const mascara = criarMascara(largura, altura, escala); // valida as dimensões

  const bytes = base64ParaBytes(partes[4]);
  const total = mascara.colunas * mascara.linhas;

  let posicao = 0;
  let valorAtual = 0;
  let escrito = 0;
  while (posicao < bytes.length && escrito < total) {
    const [comprimento, proxima] = lerVarint(bytes, posicao);
    posicao = proxima;
    if (valorAtual === 1) {
      const fim = Math.min(total, escrito + comprimento);
      for (let i = escrito; i < fim; i += 1) mascara.bits[i >> 3] |= 1 << (i & 7);
    }
    escrito += comprimento;
    valorAtual = valorAtual === 1 ? 0 : 1;
  }

  if (escrito !== total) {
    throw new Error("A névoa gravada não bate com o tamanho do mapa e foi recusada.");
  }
  return mascara;
}

/**
 * Quantos bytes a máscara ocupa depois de serializada.
 *
 * O payload é ASCII puro (base64 + dígitos + `:`), então byte = caractere —
 * não há surpresa de UTF-8 aqui. É este número que a UI mostra e que
 * `fogStore` compara com o teto antes de tentar gravar.
 *
 * @param {object} mascara
 * @returns {number}
 */
export function tamanhoSerializado(mascara) {
  return serializar(mascara).length;
}

/**
 * A máscara cabe no documento do Firestore?
 *
 * @returns {{ok:boolean, bytes:number, teto:number, motivo:string}}
 */
export function cabeNoDocumento(mascara, teto = TETO_DA_MASCARA_BYTES) {
  const bytes = tamanhoSerializado(mascara);
  if (bytes <= teto) return { ok: true, bytes, teto, motivo: "" };
  return {
    ok: false,
    bytes,
    teto,
    motivo: `A névoa deste mapa ficou grande demais para ser gravada (${Math.round(bytes / 1024)} KB, o limite é ${Math.round(teto / 1024)} KB). Diminua o mapa ou aumente a escala da névoa.`,
  };
}
