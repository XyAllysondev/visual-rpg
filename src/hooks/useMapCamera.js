/* ════════════════════════════════════════════════════════════════════════
 *  useMapCamera — pan/zoom reutilizável  (spec 0028 · F2, design §6 "extrair antes")
 *  ------------------------------------------------------------------------
 *  A câmera do editor tático nasceu inline em `MapEditor/index.jsx`: `pan` e
 *  `scale` em estado (`:107-108`), `screenToWorld` solto no meio do arquivo
 *  (`:210-213`), a roda num efeito com listener não-passivo (`:1374-1389`),
 *  `zoomAt`/`fitToScreen` logo abaixo (`:1392-1410`) — e `worldToScreen` nem
 *  existindo, duplicado à mão em dois pontos do render (`:1326` e `:1659`).
 *
 *  Este hook é a MESMA matemática, extraída para o mapa-múndi usar.
 *
 *  ⚠ AC-12: o `MapEditor` NÃO foi tocado. Ele segue com a câmera dele e as 12
 *  suítes de teste em cima. Migrá-lo para este hook é outra tarefa, fora desta
 *  fase — aqui só copiamos o comportamento, para não haver duas físicas de
 *  navegação diferentes no produto.
 *
 *  Convenções:
 *   · "tela" = pixels relativos ao CANTO SUPERIOR ESQUERDO do container
 *     (não `clientX` cru) — use `eventoParaTela(e)` para converter;
 *   · "mundo" = as coordenadas dos nós/trilhas;
 *   · `screenToWorld` e `worldToScreen` são inversas exatas uma da outra.
 *
 *  Gate: `__tests__/useMapCamera.test.js`.
 * ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";

/** Escala mínima/máxima do editor tático — mesma sensação de zoom no mundo. */
export const ESCALA_MINIMA = 0.08;
export const ESCALA_MAXIMA = 6;

/** Passo de zoom da roda, idêntico ao do editor (`index.jsx:1383`). */
export const PASSO_DA_RODA = { aproximar: 1.12, afastar: 0.89 };

/** Folga em pixels de tela ao enquadrar o mundo inteiro. */
export const MARGEM_DE_ENQUADRE = 80;

const ehNumero = (n) => Number.isFinite(n);
const ehPonto = (p) => !!p && typeof p === "object" && ehNumero(p.x) && ehNumero(p.y);

/**
 * Junta objetos de handlers (`{ onPointerDown, ... }`) num só, chamando todos na
 * ordem em que foram passados. É o que permite usar `bindPan` e `bindPinch` no
 * mesmo elemento sem um sobrescrever o outro.
 *
 * @param {...(object|null|undefined)} objs
 * @returns {object}
 */
export function juntarHandlers(...objs) {
  const alvo = {};
  objs.filter(Boolean).forEach((obj) => {
    Object.keys(obj).forEach((chave) => {
      const fn = obj[chave];
      if (typeof fn !== "function") return;
      const anterior = alvo[chave];
      alvo[chave] = anterior
        ? (...args) => { anterior(...args); fn(...args); }
        : fn;
    });
  });
  return alvo;
}

/**
 * Normaliza o "mundo" que se quer enquadrar. Aceita `{ w, h }`, `{ largura,
 * altura }` ou a caixa de `limitesDoGrafo` (`{ minX, minY, maxX, maxY }`).
 * @returns {{minX:number,minY:number,w:number,h:number}|null}
 */
function normalizarMundo(mundo) {
  if (!mundo || typeof mundo !== "object") return null;

  if (ehNumero(mundo.minX) && ehNumero(mundo.minY) && ehNumero(mundo.maxX) && ehNumero(mundo.maxY)) {
    return {
      minX: mundo.minX,
      minY: mundo.minY,
      w: Math.max(mundo.maxX - mundo.minX, 1),
      h: Math.max(mundo.maxY - mundo.minY, 1),
    };
  }

  const w = ehNumero(mundo.w) ? mundo.w : mundo.largura;
  const h = ehNumero(mundo.h) ? mundo.h : mundo.altura;
  if (!ehNumero(w) || !ehNumero(h)) return null;
  return { minX: 0, minY: 0, w: Math.max(w, 1), h: Math.max(h, 1) };
}

/**
 * Câmera de mapa: pan, zoom e conversão de coordenadas.
 *
 * @param {object} [opcoes]
 * @param {number} [opcoes.minScale=0.08]
 * @param {number} [opcoes.maxScale=6]
 * @param {{pan?:{x:number,y:number}, scale?:number}} [opcoes.initial]
 * @param {{aproximar:number, afastar:number}} [opcoes.passoZoom]
 * @param {(origem:string)=>void} [opcoes.aoNavegar] chamado a cada gesto de
 *   navegação do usuário (`'roda'`, `'pan'`, `'pinch'`, `'zoom'`). O editor
 *   tático usa isso para soltar o "seguir o mestre"; o mapa-múndi vai usar para
 *   parar as animações enquanto o mestre mexe (AC-11).
 * @returns {object} ver o `return` no fim do arquivo.
 */
export function useMapCamera(opcoes = {}) {
  const {
    minScale = ESCALA_MINIMA,
    maxScale = ESCALA_MAXIMA,
    initial,
    passoZoom = PASSO_DA_RODA,
    aoNavegar,
  } = opcoes;

  /* Valores iniciais congelados no 1º render — trocar `initial` depois não
     deve puxar a câmera do usuário de volta no meio de um gesto. */
  const inicialRef = useRef(null);
  if (inicialRef.current === null) {
    inicialRef.current = {
      pan: { x: initial?.pan?.x ?? 0, y: initial?.pan?.y ?? 0 },
      scale: ehNumero(initial?.scale) ? initial.scale : 1,
    };
  }

  const [camera, setCamera] = useState(() => ({
    pan: { ...inicialRef.current.pan },
    scale: Math.max(minScale, Math.min(maxScale, inicialRef.current.scale)),
  }));

  /* Espelhos de leitura: os handlers de ponteiro/roda são estáveis e precisam
     enxergar o valor atual sem se recriar a cada frame — mesmo padrão do
     `stateRef` do editor (`index.jsx:208`). */
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const cfgRef = useRef(null);
  cfgRef.current = { minScale, maxScale, passoZoom, aoNavegar };

  const containerRef = useRef(null);
  const panRef = useRef(null);       // arraste de 1 ponteiro em andamento
  const dedosRef = useRef(new Map()); // pointerId → posição (toque)
  const pinchRef = useRef(null);      // gesto de 2 dedos em andamento
  const noRodaRef = useRef(null);
  const handlerRodaRef = useRef(null);

  /** Escala grampeada; `null` quando o valor nem número é. */
  const clampEscala = useCallback((s) => {
    if (!ehNumero(s)) return null;
    const { minScale: mn, maxScale: mx } = cfgRef.current;
    return Math.max(mn, Math.min(mx, s));
  }, []);

  const avisarNavegacao = useCallback((origem) => {
    const fn = cfgRef.current.aoNavegar;
    if (typeof fn === "function") fn(origem);
  }, []);

  const retanguloDoContainer = useCallback(() => {
    const r = containerRef.current?.getBoundingClientRect?.();
    return r || { left: 0, top: 0, width: 0, height: 0 };
  }, []);

  /* ── Estado ───────────────────────────────────────────────────────────── */

  /** Aceita `{x,y}` ou uma função `pan => {x,y}`. Valor inválido é ignorado. */
  const setPan = useCallback((valor) => {
    setCamera((c) => {
      const novo = typeof valor === "function" ? valor(c.pan) : valor;
      if (!ehPonto(novo)) return c;
      if (novo.x === c.pan.x && novo.y === c.pan.y) return c;
      return { ...c, pan: { x: novo.x, y: novo.y } };
    });
  }, []);

  /** Aceita número ou `escala => número`. Sempre grampeado; inválido é ignorado. */
  const setScale = useCallback((valor) => {
    setCamera((c) => {
      const bruto = typeof valor === "function" ? valor(c.scale) : valor;
      const ns = clampEscala(bruto);
      if (ns === null || ns === c.scale) return c;
      return { ...c, scale: ns };
    });
  }, [clampEscala]);

  /* ── Coordenadas ──────────────────────────────────────────────────────── */

  /** Tela (px do container) → mundo. Inversa exata de `worldToScreen`. */
  const screenToWorld = useCallback((sx, sy) => {
    const { pan, scale } = cameraRef.current;
    return { x: (sx - pan.x) / scale, y: (sy - pan.y) / scale };
  }, []);

  /** Mundo → tela (px do container). Inversa exata de `screenToWorld`. */
  const worldToScreen = useCallback((wx, wy) => {
    const { pan, scale } = cameraRef.current;
    return { x: wx * scale + pan.x, y: wy * scale + pan.y };
  }, []);

  /** Evento de ponteiro/mouse → px do container. */
  const eventoParaTela = useCallback((e) => {
    const r = retanguloDoContainer();
    return { x: e.clientX - (r.left || 0), y: e.clientY - (r.top || 0) };
  }, [retanguloDoContainer]);

  /* ── Zoom ─────────────────────────────────────────────────────────────── */

  /**
   * Zoom centrado num ponto de tela: o pedaço de mundo que estava sob o cursor
   * continua sob o cursor. Mesma fórmula do editor (`index.jsx:1392-1397`).
   */
  const zoomAt = useCallback((px, py, fator) => {
    if (!ehNumero(px) || !ehNumero(py) || !ehNumero(fator)) return;
    setCamera((c) => {
      const ns = clampEscala(c.scale * fator);
      if (ns === null || ns === c.scale) return c;
      return {
        scale: ns,
        pan: {
          x: px - (px - c.pan.x) * ns / c.scale,
          y: py - (py - c.pan.y) * ns / c.scale,
        },
      };
    });
  }, [clampEscala]);

  /**
   * Enquadra o mundo no container, centralizado, com margem.
   *
   * @param {{w?:number,h?:number,largura?:number,altura?:number,minX?:number,minY?:number,maxX?:number,maxY?:number}} mundo
   *   tamanho do mapa, ou a caixa de `limitesDoGrafo` (enquadra só o que existe).
   * @param {{viewport?:{width:number,height:number}, margem?:number}} [op]
   *   `viewport` sobrescreve a medida do container (útil em teste e em canvas
   *   fora do fluxo). Sem container medível, a câmera volta ao estado inicial —
   *   nunca gera `NaN` (que travaria o render inteiro).
   */
  const fitToScreen = useCallback((mundo, op) => {
    const caixa = normalizarMundo(mundo);
    if (!caixa) return;

    const r = op?.viewport || retanguloDoContainer();
    const largura = r?.width;
    const altura = r?.height;
    if (!ehNumero(largura) || !ehNumero(altura) || largura <= 0 || altura <= 0) {
      setCamera({
        pan: { ...inicialRef.current.pan },
        scale: clampEscala(inicialRef.current.scale) ?? 1,
      });
      return;
    }

    const margem = ehNumero(op?.margem) ? op.margem : MARGEM_DE_ENQUADRE;
    const ns = clampEscala(Math.min((largura - margem) / caixa.w, (altura - margem) / caixa.h));
    if (ns === null) return;

    setCamera({
      scale: ns,
      pan: {
        x: (largura - caixa.w * ns) / 2 - caixa.minX * ns,
        y: (altura - caixa.h * ns) / 2 - caixa.minY * ns,
      },
    });
  }, [clampEscala, retanguloDoContainer]);

  /* ── Roda ─────────────────────────────────────────────────────────────── */

  const desligarRoda = useCallback(() => {
    if (noRodaRef.current && handlerRodaRef.current) {
      noRodaRef.current.removeEventListener("wheel", handlerRodaRef.current);
    }
    noRodaRef.current = null;
    handlerRodaRef.current = null;
  }, []);

  /**
   * Liga a roda do mouse a um elemento — e registra esse elemento como a
   * referência de geometria da câmera (o mesmo `containerRef`).
   *
   * Serve como **ref callback**: `<div ref={bindWheel}>`. React chama com o nó
   * na montagem e com `null` na desmontagem, então o listener se limpa sozinho.
   * Também dá para chamar à mão; o retorno é a função que desliga.
   *
   * O listener é **não-passivo** de propósito: o `onWheel` do React é passivo e
   * o `preventDefault()` seria ignorado, deixando a página rolar junto com o
   * zoom (o editor tático documenta isso em `index.jsx:1372-1373`).
   */
  const bindWheel = useCallback((node) => {
    if (noRodaRef.current === node) return desligarRoda;
    desligarRoda();

    if (!node || typeof node.addEventListener !== "function") {
      containerRef.current = null;
      return desligarRoda;
    }

    const handler = (e) => {
      e.preventDefault();
      const r = node.getBoundingClientRect?.() || { left: 0, top: 0 };
      const sx = e.clientX - (r.left || 0);
      const sy = e.clientY - (r.top || 0);
      const passo = cfgRef.current.passoZoom || PASSO_DA_RODA;
      zoomAt(sx, sy, e.deltaY < 0 ? passo.aproximar : passo.afastar);
      avisarNavegacao("roda");
    };

    node.addEventListener("wheel", handler, { passive: false });
    noRodaRef.current = node;
    handlerRodaRef.current = handler;
    containerRef.current = node;
    return desligarRoda;
  }, [desligarRoda, zoomAt, avisarNavegacao]);

  useEffect(() => desligarRoda, [desligarRoda]);

  /* ── Pinch (2 dedos) ──────────────────────────────────────────────────── */

  const encerrarPan = useCallback(() => { panRef.current = null; }, []);

  const iniciarPinch = useCallback(() => {
    encerrarPan(); // o gesto de 2 dedos cancela o arraste de 1 dedo, sem efetivar
    const pts = [...dedosRef.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const r = retanguloDoContainer();
    pinchRef.current = {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      cx: (a.x + b.x) / 2 - (r.left || 0),
      cy: (a.y + b.y) / 2 - (r.top || 0),
      startScale: cameraRef.current.scale,
      startPan: { ...cameraRef.current.pan },
    };
  }, [encerrarPan, retanguloDoContainer]);

  const aplicarPinch = useCallback(() => {
    const pin = pinchRef.current;
    if (!pin) return;
    const pts = [...dedosRef.current.values()];
    if (pts.length < 2) return;

    const [a, b] = pts;
    const r = retanguloDoContainer();
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const midX = (a.x + b.x) / 2 - (r.left || 0);
    const midY = (a.y + b.y) / 2 - (r.top || 0);
    const ns = clampEscala(pin.startScale * (dist / (pin.dist || 1)));
    if (ns === null) return;

    // Mantém fixo o ponto sob o centro do gesto enquanto escala, e soma o
    // arrasto do centro entre os dois dedos (mesma conta de `index.jsx:1086-1093`).
    const s0 = pin.startScale;
    setCamera({
      scale: ns,
      pan: {
        x: midX - (pin.cx - pin.startPan.x) * ns / s0 + (midX - pin.cx),
        y: midY - (pin.cy - pin.startPan.y) * ns / s0 + (midY - pin.cy),
      },
    });
    avisarNavegacao("pinch");
  }, [clampEscala, retanguloDoContainer, avisarNavegacao]);

  /* ── Binds de ponteiro ────────────────────────────────────────────────── */

  /**
   * Handlers de arraste para panorâmica.
   * @param {{botoes?:number[]}} [op] botões do mouse que iniciam o pan
   *   (padrão: esquerdo e do meio). No toque, `button` é 0.
   * @returns {{onPointerDown:Function,onPointerMove:Function,onPointerUp:Function,onPointerCancel:Function}}
   */
  const bindPan = useCallback((op) => {
    const botoes = Array.isArray(op?.botoes) ? op.botoes : [0, 1];

    const soltar = (e) => {
      encerrarPan();
      if (e?.pointerId != null) {
        try { e.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
      }
    };

    return {
      onPointerDown(e) {
        if (pinchRef.current) return;
        if (e?.button != null && !botoes.includes(e.button)) return;
        panRef.current = {
          mx: e.clientX,
          my: e.clientY,
          ox: cameraRef.current.pan.x,
          oy: cameraRef.current.pan.y,
        };
        if (e?.pointerId != null) {
          try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
        }
      },
      onPointerMove(e) {
        if (pinchRef.current || !panRef.current) return;
        const { mx, my, ox, oy } = panRef.current;
        setPan({ x: ox + e.clientX - mx, y: oy + e.clientY - my });
        avisarNavegacao("pan");
      },
      onPointerUp: soltar,
      onPointerCancel: soltar,
    };
  }, [encerrarPan, setPan, avisarNavegacao]);

  /**
   * Handlers de pinça de dois dedos (zoom + pan simultâneos), como o editor já
   * faz. Componha com `bindPan` via `juntarHandlers` — a pinça cancela o
   * arraste de um dedo em andamento.
   * @returns {{onPointerDown:Function,onPointerMove:Function,onPointerUp:Function,onPointerCancel:Function}}
   */
  const bindPinch = useCallback(() => {
    const soltar = (e) => {
      if (e?.pointerId != null) dedosRef.current.delete(e.pointerId);
      // Encerrando a pinça, NÃO retomamos a ação de um dedo — evita o salto do
      // mapa quando um dedo sobe antes do outro.
      if (pinchRef.current && dedosRef.current.size < 2) pinchRef.current = null;
    };

    return {
      onPointerDown(e) {
        if (e?.pointerId == null) return;
        dedosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (dedosRef.current.size >= 2) iniciarPinch();
      },
      onPointerMove(e) {
        if (e?.pointerId != null && dedosRef.current.has(e.pointerId)) {
          dedosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        if (pinchRef.current) aplicarPinch();
      },
      onPointerUp: soltar,
      onPointerCancel: soltar,
    };
  }, [iniciarPinch, aplicarPinch]);

  /** Valores atuais sem esperar re-render — para uso dentro de handlers. */
  const lerCamera = useCallback(() => ({ ...cameraRef.current }), []);
  const estaPanoramando = useCallback(() => !!panRef.current, []);
  const estaPinchando = useCallback(() => !!pinchRef.current, []);

  return {
    /* estado */
    pan: camera.pan,
    scale: camera.scale,
    setPan,
    setScale,
    lerCamera,
    /* geometria */
    containerRef,
    screenToWorld,
    worldToScreen,
    eventoParaTela,
    /* navegação */
    zoomAt,
    fitToScreen,
    bindWheel,
    bindPan,
    bindPinch,
    estaPanoramando,
    estaPinchando,
  };
}

export default useMapCamera;
