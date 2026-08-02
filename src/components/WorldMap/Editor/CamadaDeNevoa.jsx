/* ════════════════════════════════════════════════════════════════════
 *  A CAMADA DE NÉVOA  (spec 0028 · F3 · AC-5, AC-11 · design §5.2 e §5.4)
 *  --------------------------------------------------------------------
 *  Onde ela entra na pilha do palco (ver o cabeçalho de `TelaDoMapa.jsx`):
 *
 *      camada 0 · DOM    ilustração vetorial do mapa padrão
 *      camada 1 · CANVAS ilustração do usuário + trilhas
 *   →  camada 2 · CANVAS **NÉVOA**
 *      camada 3 · DOM    os nós, virtualizados
 *
 *  ACIMA do fundo (senão não esconde nada) e ABAIXO dos nós (senão o mestre
 *  não conseguiria clicar num lugar coberto — e ele PRECISA, é a mesa dele).
 *  Quem esconde o nó do jogador é a projeção da F4, que simplesmente não
 *  copia o nó; nunca a névoa desenhada por cima. Segredo é estrutural, não
 *  visual (AC-1).
 *
 *  ── A BORDA SUAVE ───────────────────────────────────────────────────
 *  A máscara é 1 bit por célula: dentro ou fora, sem meio-termo. Desenhada
 *  crua, a clareira vira um polígono serrilhado que DENUNCIA o raio da
 *  revelação — o jogador leria o raio na tela, e a borda dura é feia. A
 *  suavidade é do RENDER, não do dado: a grade é pintada num canvas do
 *  tamanho da GRADE (600×400, não 2400×1600), esticada com interpolação e
 *  passada por um desfoque proporcional ao tamanho da célula na tela. Custa
 *  um `drawImage` e devolve exatamente a borda de gradiente radial que a
 *  névoa precisa ter.
 *
 *  ── AS TRÊS OPACIDADES (AC-5) ───────────────────────────────────────
 *  · mestre, coberto ............ ~15%  (enxerga o oculto, sem esquecer que está oculto)
 *  · jogador, nunca visto ....... 100%  (não existe para ele)
 *  · jogador, já revelado ....... ~45%  (memória do lugar, sem visão atual)
 *  · qualquer um, onde o grupo está .. 0%
 *
 *  A quarta linha depende de uma SEGUNDA máscara — a do que o grupo enxerga
 *  AGORA — que só nasce na F4, com o grupo no mapa. No ateliê ela não existe,
 *  e é correto que não exista: sem grupo, todo lugar revelado é "lugar onde o
 *  grupo não está", e é assim que a Visão do Jogador o mostra. O `prop`
 *  `mascaraAtual` já está aqui para a F4 ligar sem tocar neste arquivo.
 *
 *  ── A DERIVA (AC-11 · design §5.4, movimento 1) ──────────────────────
 *  Névoa parada é cinza chapado. A deriva é uma textura fria que escorre em
 *  ~40 s por ciclo, em `transform` puro (composto na GPU, zero JavaScript por
 *  quadro), com `mix-blend-mode: soft-light` — que sobre o grafite da névoa
 *  levanta fiapos de luz e sobre a ilustração revelada é praticamente
 *  identidade, porque soft-light com cinza médio não muda o que está embaixo.
 *
 *  Três desligamentos, todos exigidos pelo AC-11:
 *   1. `prefers-reduced-motion` — no CSS **e** aqui, para o elemento nem
 *      existir no DOM de quem pediu menos movimento;
 *   2. fora do viewport — `IntersectionObserver` desmonta a textura;
 *   3. enquanto o mestre trabalha — quem decide é o editor, pela prop
 *      `deriva` (design §5.4: "nada anima enquanto o mestre edita no ateliê").
 * ════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { useMovimentoReduzido } from "./animacao";
import { CICLO_DA_DERIVA } from "./nevoaStyles";

/** As opacidades do AC-5, num lugar só. */
export const OPACIDADE = {
  /** O mestre vê através da névoa, mas nunca esquece que ela está lá. */
  mestreCoberto: 0.15,
  /** Para o jogador, o que nunca foi visto simplesmente não existe. */
  jogadorNuncaVisto: 1,
  /** Já esteve lá, não está agora: lembra o terreno, não enxerga o presente. */
  jogadorRevelado: 0.45,
};

/**
 * O grafite frio da névoa.
 *
 * Literal, não `var(--fog)`: canvas 2D **não resolve CSS custom properties**
 * (mesma nota de `CORES_DA_TRILHA` em `editorUi.js`). O viés é frio de
 * propósito — o dourado dos ícones do Nexus tem de brigar com ela e vencer.
 */
export const COR_DA_NEVOA = { r: 11, g: 14, b: 24 };

/* Ciclo da deriva, em segundos (design §5.4). Mora junto do CSS que ele
   comanda — reexportado aqui porque é daqui que a tela o consome. */
export { CICLO_DA_DERIVA } from "./nevoaStyles";

/** Nome do papel → só dois, e o padrão é o mais protetor. */
const ehMestre = (papel) => papel === "mestre";

/**
 * O alfa (0–1) de uma célula, dadas as duas máscaras e o papel.
 *
 * Função pura e minúscula de propósito: é ELA que o teste do AC-5 aponta,
 * sem precisar de canvas nenhum.
 *
 * @param {boolean} revelado a célula já foi explorada alguma vez?
 * @param {boolean|null} visivelAgora o grupo enxerga a célula neste momento?
 *   `null` = "não há grupo" (ateliê), tratado como "não enxerga".
 * @param {'mestre'|'jogador'} papel
 * @returns {number}
 */
export function alfaDaCelula(revelado, visivelAgora, papel) {
  if (ehMestre(papel)) return revelado ? 0 : OPACIDADE.mestreCoberto;
  if (visivelAgora) return 0;
  return revelado ? OPACIDADE.jogadorRevelado : OPACIDADE.jogadorNuncaVisto;
}

/**
 * Os pixels da névoa, na resolução da GRADE (não do mundo).
 *
 * Devolve RGBA pronto para virar `ImageData`. Puro: nenhum canvas, nenhum DOM
 * — dá para conferir célula a célula no teste.
 *
 * @param {object} mascara máscara explorada (`model/fogMask.js`).
 * @param {object|null} mascaraAtual o que o grupo enxerga agora (F4).
 * @param {'mestre'|'jogador'} papel
 * @returns {Uint8ClampedArray} `colunas * linhas * 4` bytes.
 */
export function construirPixels(mascara, mascaraAtual, papel) {
  const { colunas, linhas, bits } = mascara;
  const total = colunas * linhas;
  const pixels = new Uint8ClampedArray(total * 4);
  const { r, g, b } = COR_DA_NEVOA;
  const temAtual = !!mascaraAtual
    && mascaraAtual.colunas === colunas && mascaraAtual.linhas === linhas;

  for (let i = 0; i < total; i += 1) {
    const revelado = ((bits[i >> 3] >> (i & 7)) & 1) === 1;
    const agora = temAtual
      ? ((mascaraAtual.bits[i >> 3] >> (i & 7)) & 1) === 1
      : null;
    const p = i * 4;
    pixels[p] = r;
    pixels[p + 1] = g;
    pixels[p + 2] = b;
    pixels[p + 3] = Math.round(alfaDaCelula(revelado, agora, papel) * 255);
  }
  return pixels;
}

/**
 * Raio do desfoque, em px de tela.
 *
 * Uma célula da grade mede `escala * scale` px na tela. O desfoque acompanha
 * isso — com o mapa afastado a borda continua macia sem virar mancha, e com o
 * mapa aproximado ela não vira degrau de escada. O teto existe porque desfoque
 * gigante é caro e some com a informação.
 */
export function raioDoDesfoque(escala, scale) {
  const celula = Math.max(1, (escala || 4) * (scale > 0 ? scale : 1));
  return Math.max(2, Math.min(28, celula * 0.85));
}

/**
 * Pinta a névoa no contexto 2D recebido.
 *
 * `ctx` nulo é no-op de propósito: no jsdom não existe contexto 2D e o smoke
 * de render não pode quebrar por causa disso (mesmo contrato de `pintarMapa`).
 *
 * @returns {{pintou:boolean, desfoque:number}} o que aconteceu — é o que o
 *   teste inspeciona sem precisar de pixels.
 */
export function pintarNevoa(ctx, opcoes = {}) {
  const {
    mascara = null, mascaraAtual = null, papel = "mestre",
    largura = 0, altura = 0, dpr = 1, pan = { x: 0, y: 0 }, scale = 1,
    offscreen = null,
  } = opcoes;

  const resultado = { pintou: false, desfoque: 0 };
  if (!ctx || typeof ctx.clearRect !== "function") return resultado;

  const razao = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  ctx.setTransform(razao, 0, 0, razao, 0, 0);
  ctx.clearRect(0, 0, largura, altura);
  if (!mascara || !mascara.bits || !offscreen) return resultado;

  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const px = Number.isFinite(pan?.x) ? pan.x : 0;
  const py = Number.isFinite(pan?.y) ? pan.y : 0;

  const desfoque = raioDoDesfoque(mascara.escala, s);
  resultado.desfoque = desfoque;

  try {
    if ("imageSmoothingEnabled" in ctx) ctx.imageSmoothingEnabled = true;
    if ("filter" in ctx) ctx.filter = `blur(${desfoque.toFixed(2)}px)`;
    /* A grade cobre o mundo inteiro: `colunas * escala` pode passar da largura
       do mundo por até uma célula, e é o que queremos — a névoa tem de chegar
       na borda, não parar antes dela. */
    ctx.drawImage(
      offscreen,
      px, py,
      mascara.colunas * mascara.escala * s,
      mascara.linhas * mascara.escala * s,
    );
    resultado.pintou = true;
  } catch (e) {
    console.warn("[névoa] não deu para pintar a máscara:", e);
  } finally {
    if ("filter" in ctx) ctx.filter = "none";
  }
  return resultado;
}

/* ════════════════════════════════════════════════════════════════════
 *  O COMPONENTE
 * ════════════════════════════════════════════════════════════════════ */

/**
 * @param {object} props
 * @param {object|null} props.mascara máscara explorada.
 * @param {object|null} [props.mascaraAtual] o que o grupo enxerga agora (F4).
 * @param {'mestre'|'jogador'} [props.papel]
 * @param {{x:number,y:number}} props.pan
 * @param {number} props.scale
 * @param {number} props.largura largura do palco, em px de CSS.
 * @param {number} props.altura altura do palco, em px de CSS.
 * @param {boolean} [props.deriva] liga o movimento do AC-11.
 */
export default function CamadaDeNevoa({
  mascara = null,
  mascaraAtual = null,
  papel = "mestre",
  pan = { x: 0, y: 0 },
  scale = 1,
  largura = 0,
  altura = 0,
  deriva = false,
}) {
  const raizRef = useRef(null);
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const [noViewport, setNoViewport] = useState(true);

  const revisao = mascara?.revisao || 0;
  const revisaoAtual = mascaraAtual?.revisao || 0;

  /* Reativo: quem liga "reduzir movimento" no sistema com o mapa aberto vê a
     deriva sumir do DOM na hora, sem recarregar (ver `Editor/animacao.js`). */
  const reduzido = useMovimentoReduzido();

  /* ── Nada anima fora do viewport (AC-11) ───────────────────────────── */
  useEffect(() => {
    const node = raizRef.current;
    if (!node || typeof IntersectionObserver !== "function") return undefined;
    const io = new IntersectionObserver(
      (entradas) => { setNoViewport(entradas.some((e) => e.isIntersecting)); },
      { threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  /* ── Offscreen: um canvas do tamanho da GRADE, reaproveitado ───────── */
  useEffect(() => {
    if (!mascara || typeof document === "undefined") { offscreenRef.current = null; return; }
    let off = offscreenRef.current;
    if (!off || off.width !== mascara.colunas || off.height !== mascara.linhas) {
      off = document.createElement("canvas");
      off.width = mascara.colunas;
      off.height = mascara.linhas;
      offscreenRef.current = off;
    }
    let octx = null;
    try { octx = off.getContext ? off.getContext("2d") : null; } catch { octx = null; }
    if (!octx || typeof octx.putImageData !== "function") return;

    const pixels = construirPixels(mascara, mascaraAtual, papel);
    const imagem = octx.createImageData(mascara.colunas, mascara.linhas);
    imagem.data.set(pixels);
    octx.putImageData(imagem, 0, 0);
  }, [mascara, revisao, mascaraAtual, revisaoAtual, papel]);

  /* ── Pintura da camada visível ─────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    if (largura > 0 && altura > 0) {
      canvas.width = Math.round(largura * dpr);
      canvas.height = Math.round(altura * dpr);
    }
    let ctx = null;
    try { ctx = canvas.getContext ? canvas.getContext("2d") : null; } catch { ctx = null; }

    pintarNevoa(ctx, {
      mascara, mascaraAtual, papel, largura, altura, dpr, pan, scale,
      offscreen: offscreenRef.current,
    });
  }, [mascara, revisao, mascaraAtual, revisaoAtual, papel, pan, scale, largura, altura]);

  if (!mascara) return null;

  const animando = deriva && !reduzido && noViewport;

  return (
    <div ref={raizRef} className="wmf-nevoa" aria-hidden="true" data-testid="wm-nevoa">
      <canvas
        ref={canvasRef}
        data-testid="wm-nevoa-canvas"
        data-papel={papel}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {animando ? (
        <div
          className="wmf-deriva"
          data-testid="wm-nevoa-deriva"
          style={{ animationDuration: `${CICLO_DA_DERIVA}s` }}
        />
      ) : null}
    </div>
  );
}
