/* ════════════════════════════════════════════════════════════════════
 *  EDITOR DO GRAFO — O PALCO  (spec 0028 · F2 · AC-4, design §5.3)
 *  --------------------------------------------------------------------
 *  O RENDER HÍBRIDO, e por que ele é assim:
 *
 *   ┌─ camada 0 · DOM ──── ilustração do mapa padrão (SVG vetorial) ─────┐
 *   │  Só existe no mapa padrão (AC-13). Fica em DOM, e não rasterizada  │
 *   │  no canvas, porque o AC-13 promete nitidez em QUALQUER zoom — e é  │
 *   │  um elemento só, então não custa nada.                             │
 *   ├─ camada 1 · CANVAS ─ ilustração do usuário + TODAS as trilhas ─────┤
 *   │  Centenas de curvas em SVG seriam centenas de nós de DOM que       │
 *   │  ninguém foca. Vão para o canvas, pintadas por `pintarMapa`.       │
 *   ├─ camada 2 · CANVAS ─ a NÉVOA (F3 · AC-5) ──────────────────────────┤
 *   │  Acima do fundo (senão não esconde) e abaixo dos nós (senão o      │
 *   │  mestre não clicaria num lugar coberto). Ver `CamadaDeNevoa.jsx`.  │
 *   ├─ camada 3 · DOM ──── os nós, VIRTUALIZADOS por viewport ───────────┤
 *   │  Nó é interativo: precisa de foco, teclado, `aria-label` e alvo de │
 *   │  44px. Isso não existe em canvas. Só os nós dentro da caixa visível │
 *   │  viram DOM (`nosVisiveis`), então 500 nós custam o mesmo que 30.    │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 *  A CÂMERA é um `transform` por camada — não N reposicionamentos. Ver o
 *  cabeçalho de `EditorStyles.jsx`.
 *
 *  Este componente não fala com o Firestore e não decide regra de negócio:
 *  ele desenha e avisa o que o mestre fez. Quem grava é o `index.jsx`.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { juntarHandlers } from "../../../hooks/useMapCamera";
import { getNodeType, noEmPonto, trilhaEmPonto } from "../model/graph";
import {
  caixaDoViewport, nosVisiveis, pontoDeControle, pintarMapa, rotuloDoNo,
  CORES_DA_TRILHA,
} from "./editorUi";
import CamadaDeNevoa from "./CamadaDeNevoa";
import RunaDoLugar from "../model/marcadores";
import { SP, R, FF, FS, FW, T } from "../Atelier/ui";

/** Diâmetro do nó em px de TELA (não de mundo): não encolhe com o zoom. */
const TAMANHO_DO_NO = 30;

/** Alvo de toque mínimo — o app é usado em mesa, no celular, com o dedo. */
const ALVO_MINIMO = 44;

/** Acima desta escala o nome do lugar cabe na tela sem virar sopa de letras. */
export const ZOOM_PARA_ROTULO = 0.42;

/** Deslocamento em px de tela abaixo do qual um arraste ainda conta como clique. */
const TOLERANCIA_DE_CLIQUE = 4;

/** Ícone padrão de cada tipo, quando o mestre não escolheu um. */
export const ICONES_POR_TIPO = {
  town: "🏘️",
  dungeon: "🕳️",
  poi: "🧭",
  camp: "🔥",
  quest: "❗",
  secret: "🔒",
};

/** O ícone a desenhar: o do nó, ou o do tipo. */
export function iconeDoNo(no) {
  const proprio = typeof no?.icon === "string" ? no.icon.trim() : "";
  if (proprio) return proprio;
  return ICONES_POR_TIPO[no?.type] || ICONES_POR_TIPO.poi;
}

/**
 * O dourado do tema, resolvido para um valor que o canvas entenda.
 * `strokeStyle = "var(--gold)"` é ignorado em silêncio pelo canvas 2D.
 */
function lerAcento(elemento) {
  try {
    if (!elemento || typeof window === "undefined" || !window.getComputedStyle) {
      return CORES_DA_TRILHA.acentoDeReserva;
    }
    const estilo = window.getComputedStyle(elemento);
    const gold = (estilo.getPropertyValue("--gold2") || estilo.getPropertyValue("--gold") || "").trim();
    return gold || CORES_DA_TRILHA.acentoDeReserva;
  } catch {
    return CORES_DA_TRILHA.acentoDeReserva;
  }
}

/* ════════════════════════════════════════════════════════════════════
 *  UM NÓ
 * ════════════════════════════════════════════════════════════════════ */

function NoDoMapa({
  no, escala, selecionado, ligando, recemCriado, arrastando,
  onPointerDown, onClicar, onTeclado,
}) {
  const tipo = getNodeType(no.type);
  const cor = (typeof no.color === "string" && no.color) || tipo.color;
  const secreto = no.type === "secret";
  const mostrarRotulo = escala >= ZOOM_PARA_ROTULO;

  /* A marca do lugar (spec 0035 · M3): o ícone que o MESTRE escolheu continua
     mandando — só o padrão de cada tipo deixou de ser emoji e virou runa. */
  const temIconeProprio = typeof no.icon === "string" && no.icon.trim() !== "";
  const marca = temIconeProprio ? iconeDoNo(no) : <RunaDoLugar tipo={no.type} />;

  return (
    <div
      className="wme-ancora"
      data-arrastando={arrastando ? "sim" : undefined}
      style={{
        left: no.x,
        top: no.y,
        /* Contra-escala: o ícone tem sempre o mesmo tamanho na tela, com zoom
           aproximado ou afastado. É isso que mantém o alvo de toque honesto. */
        transform: `translate(-50%,-50%) scale(${1 / (escala || 1)})`,
      }}
    >
      <button
        type="button"
        className={`wme-no${secreto ? " wme-segredo" : ""}`}
        data-novo={recemCriado ? "sim" : undefined}
        data-testid={`wm-no-${no.id}`}
        aria-label={rotuloDoNo(no)}
        aria-pressed={selecionado || undefined}
        title={no.name || "Lugar sem nome"}
        onPointerDown={onPointerDown}
        onClick={onClicar}
        onKeyDown={onTeclado}
        style={{
          position: "relative",
          width: ALVO_MINIMO,
          height: ALVO_MINIMO,
        }}
      >
        {/* O disco visível é menor que o alvo de toque: o alvo é invisível e
            generoso, o desenho é preciso. */}
        <span
          aria-hidden="true"
          style={{
            width: TAMANHO_DO_NO,
            height: TAMANHO_DO_NO,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            lineHeight: 1,
            background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.22), ${cor} 68%)`,
            border: selecionado
              ? "2px solid var(--gold2,var(--gold))"
              : `2px solid rgba(12,12,18,${secreto ? 0.55 : 0.75})`,
            boxShadow: ligando
              ? "0 0 0 3px var(--gold2,var(--gold)), 0 4px 12px rgba(0,0,0,.6)"
              : "0 3px 10px rgba(0,0,0,.62)",
          }}
        >
          {marca}
        </span>

        {mostrarRotulo ? (
          <span
            className="wme-rotulo"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "calc(50% + 17px)",
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: FF.ui,
              fontSize: FS.label,
              fontWeight: FW.semi,
              color: selecionado ? "var(--gold2,var(--gold))" : "#f0ead9",
              maxWidth: 150,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {no.name || "Sem nome"}
          </span>
        ) : null}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  O PALCO
 * ════════════════════════════════════════════════════════════════════ */

/**
 * @param {object} props
 * @param {Array} props.nos
 * @param {Array} props.trilhas
 * @param {object} props.camera retorno de `useMapCamera`.
 * @param {string} props.ferramenta id da ferramenta ativa.
 * @param {{tipo:'no'|'trilha', id:string}|null} props.selecao
 * @param {string|null} props.ligandoDe id do primeiro nó da trilha em construção.
 * @param {string|null} props.recemCriadoId nó que acabou de nascer (pulso de entrada).
 * @param {CanvasImageSource|null} props.imagemFundo ilustração já carregada.
 * @param {{largura:number,altura:number}|null} props.mundo tamanho da ilustração.
 * @param {React.ComponentType|null} props.Cartografia ilustração vetorial (mapa padrão).
 * @param {boolean} props.somenteLeitura
 * @param {(no:object)=>void} props.onClicarNo
 * @param {(ponto:{x:number,y:number})=>void} props.onClicarVazio
 * @param {(trilha:object)=>void} props.onClicarTrilha
 * @param {(noId:string, ponto:{x:number,y:number})=>void} props.onArrastarNo durante o arraste.
 * @param {(noId:string, ponto:{x:number,y:number})=>void} props.onSoltarNo ao largar.
 * @param {(trilhaId:string, ponto:{x:number,y:number})=>void} props.onCurvarTrilha
 * @param {(trilhaId:string, ponto:{x:number,y:number})=>void} props.onSoltarCurva
 * @param {number} props.altura altura do palco em px.
 * @param {object|null} props.nevoa props de `CamadaDeNevoa` (máscara, papel, deriva).
 * @param {{raio:number, modo:'revelar'|'cobrir'}|null} props.pincel pincel de névoa ativo.
 * @param {(de:{x:number,y:number}, para:{x:number,y:number})=>void} props.onPincel
 * @param {string|null} props.destaque cor da moldura do palco (marca a Visão do
 *   Jogador — AC-5: o modo se anuncia por borda, não só por ícone).
 * @param {Array<{id:string,x:number,y:number,rotulo:string,titulo:string,secreto:boolean}>}
 *   [props.eventos] selos de evento já POSICIONADOS (F5). A tela não resolve
 *   âncora: quem faz isso é `posicaoDoEvento` em `editorUi.js`, que é pura.
 * @param {string|null} [props.eventoSelecionadoId]
 * @param {(eventoId:string)=>void} [props.onClicarEvento]
 */
export default function TelaDoMapa({
  nos = [],
  trilhas = [],
  camera,
  ferramenta = "selecionar",
  selecao = null,
  ligandoDe = null,
  recemCriadoId = null,
  imagemFundo = null,
  mundo = null,
  Cartografia = null,
  somenteLeitura = false,
  onClicarNo,
  onClicarVazio,
  onClicarTrilha,
  onArrastarNo,
  onSoltarNo,
  onCurvarTrilha,
  onSoltarCurva,
  altura = 560,
  nevoa = null,
  pincel = null,
  onPincel,
  destaque = null,
  eventos = [],
  eventoSelecionadoId = null,
  onClicarEvento,
}) {
  const palcoRef = useRef(null);
  const canvasRef = useRef(null);
  const [tamanho, setTamanho] = useState({ largura: 0, altura: 0 });
  const [arrastandoId, setArrastandoId] = useState(null);
  const arrasteRef = useRef(null);   // arraste de nó em andamento
  const punhoRef = useRef(null);     // arraste do punho da curva
  const cliqueRef = useRef(null);    // origem do gesto, para separar clique de pan
  const pincelRef = useRef(null);    // traço do pincel de névoa em andamento
  /* Onde desenhar o anel do pincel, em px de TELA. Fica em estado porque é
     puramente visual — e some quando o ponteiro sai do palco. */
  const [anel, setAnel] = useState(null);

  const { pan, scale } = camera;

  /* ── Medida do container ───────────────────────────────────────────
     A virtualização depende do tamanho real; sem ele, `nosVisiveis` devolve
     tudo (ver o JSDoc lá) — nunca uma tela vazia. */
  useEffect(() => {
    const node = palcoRef.current;
    if (!node) return undefined;

    const medir = () => {
      const r = node.getBoundingClientRect?.();
      if (!r) return;
      setTamanho((atual) => (
        atual.largura === r.width && atual.altura === r.height
          ? atual
          : { largura: r.width, altura: r.height }
      ));
    };
    medir();

    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(medir);
      ro.observe(node);
      return () => ro.disconnect();
    }
    // jsdom e navegadores antigos não têm ResizeObserver: a janela basta.
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  /* ── Virtualização (design §5.3) ───────────────────────────────────── */
  const caixa = useMemo(
    () => (tamanho.largura > 0
      ? caixaDoViewport(pan, scale, tamanho.largura, tamanho.altura)
      : null),
    [pan, scale, tamanho.largura, tamanho.altura],
  );
  const visiveis = useMemo(() => nosVisiveis(nos, caixa), [nos, caixa]);

  /* ── Pintura do canvas ─────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const largura = tamanho.largura || 0;
    const alturaPx = tamanho.altura || 0;
    if (largura > 0 && alturaPx > 0) {
      canvas.width = Math.round(largura * dpr);
      canvas.height = Math.round(alturaPx * dpr);
    }

    /* No jsdom `getContext` não existe de verdade e devolve null — `pintarMapa`
       trata isso como no-op, então o smoke de render não quebra por canvas. */
    let ctx = null;
    try { ctx = canvas.getContext ? canvas.getContext("2d") : null; } catch { ctx = null; }

    pintarMapa(ctx, {
      largura,
      altura: alturaPx,
      dpr,
      pan,
      scale,
      nos,
      trilhas,
      imagem: imagemFundo,
      mundo,
      trilhaSelecionada: selecao?.tipo === "trilha" ? selecao.id : null,
      corDeAcento: lerAcento(palcoRef.current),
    });
  }, [nos, trilhas, pan, scale, tamanho, imagemFundo, mundo, selecao]);

  /* ── Câmera: roda, pan e pinça ─────────────────────────────────────── */
  const ligarPalco = useCallback((node) => {
    palcoRef.current = node;
    camera.bindWheel(node); // ref callback: registra a roda e a geometria
  }, [camera]);

  /* Com a mão, o botão esquerdo arrasta o mapa. Nas outras ferramentas o
     esquerdo é da ferramenta e só o botão do meio faz pan — o mesmo contrato
     do editor tático. */
  const handlers = useMemo(() => juntarHandlers(
    camera.bindPan({ botoes: ferramenta === "mao" ? [0, 1] : [1] }),
    camera.bindPinch(),
  ), [camera, ferramenta]);

  const paraMundo = useCallback((e) => {
    const tela = camera.eventoParaTela(e);
    return camera.screenToWorld(tela.x, tela.y);
  }, [camera]);

  /* ── Arraste de nó ─────────────────────────────────────────────────── */
  const iniciarArrasteDoNo = useCallback((no) => (e) => {
    if (somenteLeitura || ferramenta !== "selecionar" || e.button !== 0) return;
    e.stopPropagation();
    arrasteRef.current = {
      id: no.id,
      origem: paraMundo(e),
      inicio: { x: no.x, y: no.y },
      moveu: false,
    };
    setArrastandoId(no.id);
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
  }, [somenteLeitura, ferramenta, paraMundo]);

  /* ── Pincel de névoa (AC-5) ────────────────────────────────────────────
     O traço é contínuo: cada movimento do ponteiro manda o SEGMENTO entre o
     ponto anterior e o atual, não um ponto solto. É `revelarAoLongoDe` que
     transforma isso em cápsula — com pontos soltos, mover o mouse rápido
     deixaria uma fileira de bolinhas separadas em vez de um traço. */
  const pincelAtivo = !!pincel && ferramenta === "nevoa" && !somenteLeitura;

  const pincelar = useCallback((e) => {
    if (!pincelAtivo || !onPincel) return;
    const agora = paraMundo(e);
    const anterior = pincelRef.current?.ultimo || agora;
    pincelRef.current = { ultimo: agora };
    onPincel(anterior, agora);
  }, [pincelAtivo, onPincel, paraMundo]);

  /* ── Gestos no palco ───────────────────────────────────────────────── */
  const aoDescer = useCallback((e) => {
    cliqueRef.current = { x: e.clientX, y: e.clientY, alvo: e.target };
    /* `!e.button` e não `=== 0`: no jsdom o PointerEvent não existe e o botão
       chega `undefined`. Botão do meio (1) e direito (2) são truthy, então a
       regra continua sendo "só o botão esquerdo pinta". */
    if (pincelAtivo && !e.button) {
      pincelRef.current = null;
      pincelar(e);
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    }
  }, [pincelAtivo, pincelar]);

  const aoMover = useCallback((e) => {
    if (pincelAtivo) {
      const tela = camera.eventoParaTela(e);
      setAnel({ x: tela.x, y: tela.y });
      if (pincelRef.current) { pincelar(e); return; }
    } else if (anel) {
      setAnel(null);
    }

    const arraste = arrasteRef.current;
    if (arraste) {
      const agora = paraMundo(e);
      const destino = {
        x: arraste.inicio.x + (agora.x - arraste.origem.x),
        y: arraste.inicio.y + (agora.y - arraste.origem.y),
      };
      arraste.moveu = true;
      arraste.ultimo = destino;
      if (onArrastarNo) onArrastarNo(arraste.id, destino);
      return;
    }
    const punho = punhoRef.current;
    if (punho) {
      const agora = paraMundo(e);
      punho.ultimo = agora;
      punho.moveu = true;
      if (onCurvarTrilha) onCurvarTrilha(punho.id, agora);
    }
  }, [paraMundo, onArrastarNo, onCurvarTrilha, pincelAtivo, pincelar, camera, anel]);

  const aoSubir = useCallback(() => {
    pincelRef.current = null;
    const arraste = arrasteRef.current;
    if (arraste) {
      arrasteRef.current = null;
      setArrastandoId(null);
      if (arraste.moveu && arraste.ultimo && onSoltarNo) onSoltarNo(arraste.id, arraste.ultimo);
    }
    const punho = punhoRef.current;
    if (punho) {
      punhoRef.current = null;
      if (punho.moveu && punho.ultimo && onSoltarCurva) onSoltarCurva(punho.id, punho.ultimo);
    }
  }, [onSoltarNo, onSoltarCurva]);

  /**
   * Clique no vazio do palco. Só conta como clique se o ponteiro praticamente
   * não andou — senão todo arraste de mapa terminaria plantando um nó.
   */
  const aoClicarPalco = useCallback((e) => {
    const origem = cliqueRef.current;
    cliqueRef.current = null;
    if (!origem) return;
    if (Math.hypot(e.clientX - origem.x, e.clientY - origem.y) > TOLERANCIA_DE_CLIQUE) return;
    // Cliques em nó/punho param a propagação; o que chega aqui é o palco.
    if (origem.alvo !== e.currentTarget && e.target !== e.currentTarget) return;
    if (ferramenta === "mao") return;
    /* Com o pincel de névoa, o clique já foi consumido pelo traço — plantar um
       lugar ou perder a seleção aqui seria efeito colateral que ninguém pediu. */
    if (ferramenta === "nevoa") return;

    const ponto = paraMundo(e);

    /* Antes de tratar como vazio, pergunta ao grafo se o clique caiu numa
       trilha — a trilha é pintada em canvas e não recebe evento sozinha, o
       hit-test é geométrico (`trilhaEmPonto`, já testado em `graph.test.js`).
       A tolerância cresce quando o mapa está afastado: 8 unidades de mundo com
       zoom 0,1 seriam menos de um pixel de tela. */
    /* A ferramenta de evento também precisa do hit-test: ancorar um evento
       NUMA TRILHA é clicar na curva dela, e a curva é canvas. */
    if (ferramenta === "selecionar" || ferramenta === "evento") {
      const perto = noEmPonto(nos, ponto);
      if (perto && onClicarNo) { onClicarNo(perto); return; }
      const tolerancia = Math.max(8, 10 / (scale || 1));
      const trilha = trilhaEmPonto({ nos, trilhas }, ponto, tolerancia);
      if (trilha && onClicarTrilha) { onClicarTrilha(trilha); return; }
    }

    if (onClicarVazio) onClicarVazio(ponto);
  }, [ferramenta, paraMundo, nos, trilhas, scale, onClicarNo, onClicarTrilha, onClicarVazio]);

  /* ── Punho da curva ────────────────────────────────────────────────── */
  const trilhaSelecionada = selecao?.tipo === "trilha"
    ? trilhas.find((t) => t.id === selecao.id)
    : null;
  const punho = trilhaSelecionada ? pontoDeControle(trilhaSelecionada, nos) : null;

  const iniciarArrasteDoPunho = useCallback((e) => {
    if (somenteLeitura || !trilhaSelecionada || e.button !== 0) return;
    e.stopPropagation();
    punhoRef.current = { id: trilhaSelecionada.id, moveu: false };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
  }, [somenteLeitura, trilhaSelecionada]);

  /* ── Render ────────────────────────────────────────────────────────── */
  const transformDaCamera = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
  const larguraDoMundo = mundo?.largura || 0;
  const alturaDoMundo = mundo?.altura || 0;

  return (
    <div
      ref={ligarPalco}
      className="wme-palco"
      data-ferramenta={ferramenta}
      data-testid="wm-palco"
      role="application"
      aria-label="Mapa do molde: lugares e trilhas"
      style={{
        height: altura,
        minHeight: 320,
        borderRadius: R.card,
        background: "radial-gradient(circle at 50% 40%, #171720, #0b0b11 70%)",
        /* A moldura colorida É o aviso de que a visão não é a do mestre (AC-5).
           Ícone aceso num canto se esquece no meio da sessão; moldura em volta
           do mapa inteiro, não. */
        border: destaque ? `2px solid ${destaque}` : "1px solid rgba(255,255,255,0.10)",
        boxShadow: destaque ? `inset 0 0 0 1px ${destaque}33, 0 0 24px ${destaque}22` : undefined,
      }}
      {...juntarHandlers(handlers, {
        onPointerDown: aoDescer,
        onPointerMove: aoMover,
        onPointerUp: aoSubir,
        onPointerCancel: aoSubir,
        onPointerLeave: () => setAnel(null),
      })}
      onClick={aoClicarPalco}
    >
      {/* ── Camada 0 · ilustração vetorial do mapa padrão (AC-13) ────── */}
      {Cartografia && larguraDoMundo > 0 ? (
        <div
          className="wme-camada"
          aria-hidden="true"
          style={{
            width: larguraDoMundo,
            height: alturaDoMundo,
            transform: transformDaCamera,
            pointerEvents: "none",
          }}
        >
          <Cartografia idPrefix="wme-carta" style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
        </div>
      ) : null}

      {/* ── Camada 1 · canvas: fundo do usuário + trilhas ─────────────── */}
      <canvas
        ref={canvasRef}
        className="wme-tela"
        data-testid="wm-canvas"
        aria-hidden="true"
        style={{ width: "100%", height: "100%" }}
      />

      {/* ── Camada 2 · névoa (canvas) ─────────────────────────────────── */}
      {nevoa ? (
        <CamadaDeNevoa
          {...nevoa}
          pan={pan}
          scale={scale}
          largura={tamanho.largura}
          altura={tamanho.altura}
        />
      ) : null}

      {/* ── Camada 3 · nós (DOM, virtualizados) + punho da curva ──────── */}
      <div className="wme-camada" style={{ transform: transformDaCamera, width: 1, height: 1 }}>
        {visiveis.map((no) => (
          <NoDoMapa
            key={no.id}
            no={no}
            escala={scale}
            selecionado={selecao?.tipo === "no" && selecao.id === no.id}
            ligando={ligandoDe === no.id}
            recemCriado={recemCriadoId === no.id}
            arrastando={arrastandoId === no.id}
            onPointerDown={iniciarArrasteDoNo(no)}
            onClicar={(e) => {
              e.stopPropagation();
              cliqueRef.current = null;
              // Arraste que virou movimento não deve também "selecionar e abrir".
              if (arrasteRef.current?.moveu) return;
              if (onClicarNo) onClicarNo(no);
            }}
            onTeclado={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                if (onClicarNo) onClicarNo(no);
              }
            }}
          />
        ))}

        {/* ── Selos de evento (F5 · AC-8) ─────────────────────────────
            Ficam ACIMA dos nós de propósito: o evento é o que o mestre
            precisa achar no meio da sessão, e um selo escondido atrás de
            um ícone de cidade é um evento esquecido. O deslocamento para
            cima e para a direita evita cobrir o nó que ele marca. */}
        {eventos.map((ev) => (
          <div
            key={ev.id}
            className="wme-ancora"
            style={{
              left: ev.x,
              top: ev.y,
              transform: `translate(-50%,-50%) scale(${1 / (scale || 1)})`,
              zIndex: 3,
            }}
          >
            <button
              type="button"
              className="wme-no wme-focus"
              data-testid={`wm-evento-${ev.id}`}
              aria-label={ev.rotulo}
              aria-pressed={eventoSelecionadoId === ev.id || undefined}
              title={ev.titulo}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                cliqueRef.current = null;
                if (onClicarEvento) onClicarEvento(ev.id);
              }}
              style={{
                position: "relative",
                width: ALVO_MINIMO,
                height: ALVO_MINIMO,
                marginLeft: 16,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  lineHeight: 1,
                  /* Violeta é a cor do que é só do mestre no Nexus (a mesma da
                     trilha secreta). O evento com texto de mestre veste o
                     violeta cheio; o resto fica dourado. */
                  color: ev.secreto ? "#0b0b11" : "#0b0b11",
                  background: ev.secreto ? "#a99bec" : "var(--gold2,var(--gold))",
                  border: `2px solid ${eventoSelecionadoId === ev.id ? "#fff" : "rgba(10,10,16,0.85)"}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,.7)",
                }}
              >
                ✦
              </span>
            </button>
          </div>
        ))}

        {punho && !somenteLeitura ? (
          <div
            className="wme-ancora"
            style={{
              left: punho.x,
              top: punho.y,
              transform: `translate(-50%,-50%) scale(${1 / (scale || 1)})`,
            }}
          >
            <button
              type="button"
              className="wme-punho"
              data-testid="wm-punho-da-curva"
              aria-label="Punho da curva: arraste para entortar a trilha"
              onPointerDown={iniciarArrasteDoPunho}
              onClick={(e) => e.stopPropagation()}
              style={{ width: ALVO_MINIMO, height: ALVO_MINIMO, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "var(--gold2,var(--gold))",
                  border: "2px solid rgba(10,10,16,0.8)",
                  boxShadow: "0 2px 8px rgba(0,0,0,.7)",
                }}
              />
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Anel do pincel de névoa ───────────────────────────────────
          Mostra o tamanho REAL do pincel antes de ele tocar o mapa. Sem
          isso, "tamanho ajustável" vira um número abstrato num slider. */}
      {pincelAtivo && anel ? (
        <div
          aria-hidden="true"
          data-testid="wm-nevoa-anel"
          style={{
            position: "absolute",
            left: anel.x,
            top: anel.y,
            width: pincel.raio * 2 * scale,
            height: pincel.raio * 2 * scale,
            marginLeft: -pincel.raio * scale,
            marginTop: -pincel.raio * scale,
            borderRadius: "50%",
            border: `1.5px solid ${pincel.modo === "cobrir" ? "rgba(160,170,210,0.85)" : "var(--gold2,var(--gold))"}`,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.55)",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {/* ── Dica flutuante do estado da ligação ───────────────────────── */}
      {ligandoDe ? (
        <div
          role="status"
          style={{
            position: "absolute",
            left: "50%",
            bottom: SP.x4,
            transform: "translateX(-50%)",
            padding: `${SP.x2}px ${SP.x4}px`,
            borderRadius: R.pill,
            background: "rgba(10,10,16,0.9)",
            border: "1px solid var(--border2)",
            ...T.meta,
            color: "var(--text)",
            pointerEvents: "none",
          }}
        >
          Agora clique no segundo lugar para fechar a trilha. Esc cancela.
        </div>
      ) : null}
    </div>
  );
}
