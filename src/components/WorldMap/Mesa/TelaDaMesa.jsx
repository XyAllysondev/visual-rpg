/* ════════════════════════════════════════════════════════════════════
 *  A MESA — O PALCO  (spec 0028 · F4 · AC-8, AC-11 · design §2 e §5.3)
 *  --------------------------------------------------------------------
 *  Mesma pilha híbrida do ateliê (`Editor/TelaDoMapa.jsx`), com duas
 *  camadas a mais e nenhuma ferramenta de autoria:
 *
 *   ┌─ camada 0 · DOM ──── ilustração vetorial (mapa padrão) ───────────┐
 *   ├─ camada 1 · CANVAS ─ ilustração + trilhas + RASTRO DA VIAGEM ─────┤
 *   ├─ camada 1½ · DOM ─── TINTA DE HORA DO DIA (F7, movimento 5) ──────┤
 *   ├─ camada 2 · CANVAS ─ névoa (reusa `Editor/CamadaDeNevoa`) ────────┤
 *   ├─ camada 3 · DOM ──── nós virtualizados + MARCADOR DO GRUPO ───────┤
 *   └───────────────────────────────────────────────────────────────────┘
 *
 *  A tinta entra em 1½ — acima da ilustração, ABAIXO da névoa e dos nós. É
 *  essa posição que mantém a cor dos ícones e dos rótulos intocada em
 *  qualquer período (AC-11); ver `TintaDoDia.jsx` e `animacaoUi.js`.
 *
 *  O que este componente NÃO tem, de propósito (design §2, S3 e spec 0007
 *  AC-2): painel de cenas, painel de camadas, plantar nó, curvar trilha,
 *  pincel. Na mesa não se constrói — na mesa se joga.
 *
 *  ── O QUE É CLICÁVEL (AC-8) ─────────────────────────────────────────
 *  Só quem está em `destinos` leva o grupo a algum lugar. O nó descoberto
 *  sem trilha revelada continua no mapa, focável e anunciado pelo leitor
 *  de tela — mas com `aria-disabled` e sem viagem. Ele NÃO deixa de existir
 *  na tela porque o jogador precisa vê-lo (é a isca da exploração); ele
 *  deixa de ser porta.
 *
 *  A recusa que aparece ao clicar vem de `podeViajarPara`, palavra por
 *  palavra: "não há trilha", "a trilha é secreta" e "o destino está oculto"
 *  devolvem a MESMA frase de propósito. Reescrevê-la aqui vazaria segredo.
 *
 *  Este componente não fala com o Firestore: desenha e avisa o que houve.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { juntarHandlers } from "../../../hooks/useMapCamera";
import { getNodeType } from "../model/graph";
import { caixaDoViewport, nosVisiveis, pintarMapa, CORES_DA_TRILHA } from "../Editor/editorUi";
import { ICONES_POR_TIPO, ZOOM_PARA_ROTULO } from "../Editor/TelaDoMapa";
import CamadaDeNevoa, { COR_DA_NEVOA } from "../Editor/CamadaDeNevoa";
import { useAnimacaoAtiva } from "../Editor/animacao";
import { nomeNaMesa, rotuloNaMesa } from "./mesaUi";
import { inclinacaoDoMarcador, pintarRastro } from "./animacaoUi";
import TintaDoDia from "./TintaDoDia";
import { FF, FS, FW, R, SP, T } from "../Atelier/ui";

/** Diâmetro do disco do nó em px de TELA — não encolhe com o zoom. */
const TAMANHO_DO_NO = 30;

/** Alvo de toque mínimo: a mesa é jogada no celular, com o dedo. */
const ALVO_MINIMO = 44;

/** Deslocamento em px de tela abaixo do qual o gesto ainda conta como clique. */
const TOLERANCIA_DE_CLIQUE = 4;

/** A névoa, em `rgb()`, para os degradês do recuo (o canvas usa o mesmo tom). */
const NEVOA_RGB = `${COR_DA_NEVOA.r},${COR_DA_NEVOA.g},${COR_DA_NEVOA.b}`;

/** O ícone do lugar — o rumor NÃO tem ícone concreto (design §5.4). */
export function iconeNaMesa(no) {
  if (no?.estado === "rumored") return "?";
  const proprio = typeof no?.icon === "string" ? no.icon.trim() : "";
  if (proprio) return proprio;
  return ICONES_POR_TIPO[no?.type] || ICONES_POR_TIPO.poi;
}

/** O dourado do tema, resolvido para o canvas (que ignora `var(--gold)`). */
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
 *  UM LUGAR NA MESA
 * ════════════════════════════════════════════════════════════════════ */

function LugarNaMesa({ no, escala, aqui, destino, selecionado, recemRevelado, anima, onClicar }) {
  const rumor = no.estado === "rumored";
  const tipo = getNodeType(no.type);
  const cor = (typeof no.color === "string" && no.color) || tipo.color;
  const alcancavel = !!destino;
  const mostrarRotulo = escala >= ZOOM_PARA_ROTULO;
  /* A cerimônia da revelação (movimento 2) só monta quando há movimento a
     gastar: com `prefers-reduced-motion`, ou fora do viewport, o lugar
     simplesmente aparece — o "corte seco" que o AC-11 pede. */
  const celebrar = recemRevelado && anima;

  return (
    <div
      className="wmm-ancora"
      style={{
        left: no.x,
        top: no.y,
        /* Contra-escala: o alvo de toque nunca encolhe abaixo de 44px. */
        transform: `translate(-50%,-50%) scale(${1 / (escala || 1)})`,
      }}
    >
      <button
        type="button"
        className="wmm-no"
        data-testid={`wmm-no-${no.id}`}
        data-estado={no.estado}
        data-destino={alcancavel ? "sim" : undefined}
        data-novo={recemRevelado ? "sim" : undefined}
        aria-label={rotuloNaMesa(no, { aqui, destino })}
        aria-disabled={alcancavel || aqui ? undefined : "true"}
        aria-pressed={selecionado || undefined}
        title={nomeNaMesa(no)}
        onClick={(e) => { e.stopPropagation(); onClicar(no, { alcancavel, aqui }); }}
        style={{ position: "relative", width: ALVO_MINIMO, height: ALVO_MINIMO }}
      >
        {/* ── MOVIMENTO 2 · A NÉVOA RECUANDO ─────────────────────────────
            Um disco da cor da névoa empurrado para fora. Ele fica ABAIXO do
            ícone de propósito: se cobrisse o lugar, esconderia justamente o
            que acabou de nascer. O que se lê é a névoa abrindo, não sumindo. */}
        {celebrar ? (
          <span
            aria-hidden="true"
            className="wmm-recuo"
            data-testid={`wmm-recuo-${no.id}`}
            style={{
              position: "absolute",
              width: TAMANHO_DO_NO * 2.6,
              height: TAMANHO_DO_NO * 2.6,
              borderRadius: "50%",
              background: `radial-gradient(circle at 50% 50%, rgba(${NEVOA_RGB},.96) 0%, rgba(${NEVOA_RGB},.74) 46%, rgba(${NEVOA_RGB},0) 72%)`,
              pointerEvents: "none",
            }}
          />
        ) : null}

        {/* ── MOVIMENTO 2 · O HALO DE NASCIMENTO ─────────────────────────
            O "achei!" que o ícone sozinho não diz: um anel dourado que abre
            depressa e se apaga junto com o recuo da névoa. */}
        {celebrar ? (
          <span
            aria-hidden="true"
            className="wmm-nascer"
            data-testid={`wmm-nascer-${no.id}`}
            style={{
              position: "absolute",
              width: TAMANHO_DO_NO + 10,
              height: TAMANHO_DO_NO + 10,
              borderRadius: "50%",
              border: "2px solid var(--gold2,var(--gold))",
              boxShadow: "0 0 12px var(--gold-glow,rgba(201,168,76,.5))",
              pointerEvents: "none",
            }}
          />
        ) : null}

        {/* ── MOVIMENTO 3 · O BRILHO DO RUMOR ────────────────────────────
            Dois halos difusos com ciclos que não coincidem (3 s e 4,6 s
            defasado): a irregularidade é o que faz o brilho parecer vivo em
            vez de metrônomo. Quem pulsa é o brilho — o "?" fica parado e
            legível, porque o rumor já é a informação mais frágil do mapa. */}
        {rumor ? (
          <>
            <span
              aria-hidden="true"
              className="wmm-rumor-halo"
              data-testid={`wmm-rumor-halo-${no.id}`}
              style={{
                position: "absolute",
                width: TAMANHO_DO_NO + 20,
                height: TAMANHO_DO_NO + 20,
                borderRadius: "50%",
                background: "radial-gradient(circle at 50% 50%, rgba(154,136,240,.60) 0%, rgba(154,136,240,0) 70%)",
                pointerEvents: "none",
              }}
            />
            <span
              aria-hidden="true"
              className="wmm-rumor-halo"
              data-eco="sim"
              style={{
                position: "absolute",
                width: TAMANHO_DO_NO + 34,
                height: TAMANHO_DO_NO + 34,
                borderRadius: "50%",
                background: "radial-gradient(circle at 50% 50%, rgba(122,106,206,.38) 0%, rgba(122,106,206,0) 72%)",
                pointerEvents: "none",
              }}
            />
          </>
        ) : null}

        {/* O convite: um halo que pulsa em volta do que dá para alcançar agora. */}
        {alcancavel ? (
          <span
            aria-hidden="true"
            className="wmm-convite"
            style={{
              position: "absolute",
              width: TAMANHO_DO_NO + 16,
              height: TAMANHO_DO_NO + 16,
              borderRadius: "50%",
              border: "2px solid var(--gold2,var(--gold))",
              pointerEvents: "none",
            }}
          />
        ) : null}

        <span
          aria-hidden="true"
          data-testid={`wmm-disco-${no.id}`}
          style={{
            position: "relative",
            width: TAMANHO_DO_NO,
            height: TAMANHO_DO_NO,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: rumor ? 17 : 15,
            fontFamily: rumor ? FF.title : undefined,
            fontWeight: rumor ? FW.bold : undefined,
            color: rumor ? "#e6dcff" : undefined,
            lineHeight: 1,
            /* O disco do rumor é OPACO — antes era translúcido, e o "?" ficava
               à mercê da ilustração do fundo (e, agora, da tinta do período).
               Opaco, o glifo devolve 9,6:1 em qualquer hora do dia. */
            background: rumor
              ? "radial-gradient(circle at 50% 46%, rgba(64,54,116,.97) 0%, rgba(34,28,72,.94) 74%)"
              : `radial-gradient(circle at 34% 28%, rgba(255,255,255,.22), ${cor} 68%)`,
            border: selecionado
              ? "2px solid var(--gold2,var(--gold))"
              : (rumor ? "2px solid rgba(146,130,222,.62)" : "2px solid rgba(12,12,18,0.75)"),
            boxShadow: aqui
              ? "0 0 0 3px var(--gold2,var(--gold)), 0 4px 12px rgba(0,0,0,.6)"
              : "0 3px 10px rgba(0,0,0,.62)",
          }}
        >
          {iconeNaMesa(no)}
        </span>

        {mostrarRotulo ? (
          <span
            className="wmm-rotulo"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "calc(50% + 17px)",
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: FF.ui,
              fontSize: FS.label,
              fontWeight: FW.semi,
              color: alcancavel ? "var(--gold2,var(--gold))" : "#f0ead9",
              maxWidth: 150,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {nomeNaMesa(no)}
          </span>
        ) : null}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  O MARCADOR DO GRUPO  (design §5.4, movimento 4)
 * ════════════════════════════════════════════════════════════════════ */

function MarcadorDoGrupo({ posicao, escala, viajando, ondeEsta, tombo = 0 }) {
  if (!posicao || !Number.isFinite(posicao.x) || !Number.isFinite(posicao.y)) return null;
  return (
    <div
      className="wmm-ancora"
      style={{
        left: posicao.x,
        top: posicao.y,
        transform: `translate(-50%,-50%) scale(${1 / (escala || 1)})`,
        zIndex: 3,
      }}
    >
      {/* MOVIMENTO 4 · o TOMBO. Invólucro separado porque são dois `transform`
          que não podem brigar: aqui a inclinação (transição, vem da direção da
          viagem), no disco a flutuação (keyframe). A origem em 50%/85% é o pé
          da bandeira — quem se inclina, se inclina a partir do chão. */}
      <span
        className="wmm-tombo"
        data-testid="wmm-tombo"
        data-tombo={tombo || undefined}
        style={{ transform: `rotate(${tombo}deg)` }}
      >
        <div
          className="wmm-marcador"
          data-testid="wmm-marcador"
          data-viajando={viajando ? "sim" : undefined}
          role="img"
          aria-label={viajando ? "O grupo está viajando." : `O grupo está em ${ondeEsta}.`}
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            lineHeight: 1,
            background: "radial-gradient(circle at 36% 28%, #fff6d8, var(--gold2,var(--gold)) 70%)",
            border: "2px solid rgba(10,10,16,.85)",
            boxShadow: "0 0 14px var(--gold-glow,rgba(201,168,76,.5)), 0 4px 12px rgba(0,0,0,.7)",
          }}
        >
          <span aria-hidden="true">🚩</span>
        </div>
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  O PALCO
 * ════════════════════════════════════════════════════════════════════ */

/**
 * @param {object} props
 * @param {Array} props.nos grafo já projetado para quem está olhando.
 * @param {Array} props.trilhas
 * @param {object} props.camera retorno de `useMapCamera`.
 * @param {{largura:number,altura:number}|null} props.mundo
 * @param {CanvasImageSource|null} [props.imagemFundo]
 * @param {React.ComponentType|null} [props.Cartografia]
 * @param {object|null} [props.nevoa] props de `CamadaDeNevoa`.
 * @param {string|null} props.noAtualId onde o grupo está.
 * @param {Array} props.destinos saída de `destinosPossiveis`.
 * @param {{x:number,y:number}|null} props.marcador posição do grupo.
 * @param {Array} [props.rastro] trecho já percorrido nesta viagem.
 * @param {boolean} [props.viajando]
 * @param {string|null} [props.selecionadoId]
 * @param {string[]} [props.recemRevelados] ids que acabaram de acender.
 * @param {(no:object, ctx:{alcancavel:boolean, aqui:boolean})=>void} props.onClicarNo
 * @param {number} [props.altura]
 * @param {string|null} [props.destaque] cor da moldura (Visão do Jogador).
 * @param {number|object|null} [props.relogio] `party.inGameDatetime` CRU, para
 *   a tinta de hora do dia (movimento 5). Sem ele, a mesa fica neutra.
 * @param {boolean} [props.anima] o último desligamento do AC-11 na mão de quem
 *   embute a mesa. Os outros dois (movimento reduzido, fora do viewport) o
 *   próprio palco resolve.
 */
export default function TelaDaMesa({
  nos = [],
  trilhas = [],
  camera,
  mundo = null,
  imagemFundo = null,
  Cartografia = null,
  nevoa = null,
  noAtualId = null,
  destinos = [],
  marcador = null,
  rastro = [],
  viajando = false,
  selecionadoId = null,
  recemRevelados = [],
  onClicarNo,
  /* `null` = "toma a caixa que te derem". O `ResizeObserver` logo abaixo já lê a
     caixa REAL, então a câmera passa a enquadrar no que o usuário vê — antes ela
     enquadrava em 560 px e o usuário via 420. Número explícito continua valendo. */
  altura = null,
  destaque = null,
  relogio = null,
  anima = true,
}) {
  const palcoRef = useRef(null);
  const canvasRef = useRef(null);
  const cliqueRef = useRef(null);
  const [tamanho, setTamanho] = useState({ largura: 0, altura: 0 });

  const { pan, scale } = camera;

  /* ── O portão dos cinco movimentos (AC-11) ─────────────────────────── */
  const {
    registrar: registrarAnimacao, ativo: animando, reduzido,
  } = useAnimacaoAtiva(anima);

  /* A tinta é COR, não movimento: sair do viewport tira dela a travessia (o
     `data-anima` cuida disso no CSS), não a cor. Quem a corta de vez é o
     `prefers-reduced-motion`, porque o AC-11 a lista junto da deriva e do
     respiro — e o mapa neutro é a resposta certa para quem pediu quietude. */
  const tintaLigada = !!anima && !reduzido;

  /* ── Medida do container (a virtualização depende dela) ────────────── */
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
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const caixa = useMemo(
    () => (tamanho.largura > 0 ? caixaDoViewport(pan, scale, tamanho.largura, tamanho.altura) : null),
    [pan, scale, tamanho.largura, tamanho.altura],
  );
  const visiveis = useMemo(() => nosVisiveis(nos, caixa), [nos, caixa]);

  const destinoPorId = useMemo(() => {
    const mapa = new Map();
    (Array.isArray(destinos) ? destinos : []).forEach((d) => { if (d?.noId) mapa.set(d.noId, d); });
    return mapa;
  }, [destinos]);

  const novos = useMemo(
    () => new Set(Array.isArray(recemRevelados) ? recemRevelados : []),
    [recemRevelados],
  );

  /* ── Pintura: fundo, trilhas e o rastro da viagem ──────────────────── */
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

    let ctx = null;
    try { ctx = canvas.getContext ? canvas.getContext("2d") : null; } catch { ctx = null; }

    pintarMapa(ctx, {
      largura, altura: alturaPx, dpr, pan, scale, nos, trilhas,
      imagem: imagemFundo, mundo,
      corDeAcento: lerAcento(palcoRef.current),
    });
    /* O rastro vai POR CIMA das trilhas — é o que o grupo já andou nesta
       viagem, e some quando ela termina (quem o guarda é a Mesa). Desvanece
       do começo para a ponta (movimento 4): a memória do caminho fica fraca,
       a cauda acesa puxa o olho até o marcador. */
    pintarRastro(ctx, { pontos: rastro, pan, scale });
  }, [nos, trilhas, pan, scale, tamanho, imagemFundo, mundo, rastro]);

  /* ── MOVIMENTO 4 · para que lado o grupo está indo ─────────────────── */
  const tombo = useMemo(
    () => (animando ? inclinacaoDoMarcador(rastro, viajando) : 0),
    [rastro, viajando, animando],
  );

  /* ── Câmera: roda, arraste e pinça. Sem ferramenta: o arraste é do mapa. */
  const ligarPalco = useCallback((node) => {
    palcoRef.current = node;
    camera.bindWheel(node);
    /* O mesmo nó serve de alvo ao `IntersectionObserver` do AC-11: mesa fora
       da tela, mesa parada. Um observador para os cinco movimentos. */
    registrarAnimacao(node);
  }, [camera, registrarAnimacao]);

  const handlers = useMemo(
    () => juntarHandlers(camera.bindPan({ botoes: [0, 1] }), camera.bindPinch()),
    [camera],
  );

  const aoDescer = useCallback((e) => {
    cliqueRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const aoClicarPalco = useCallback((e) => {
    const origem = cliqueRef.current;
    cliqueRef.current = null;
    if (!origem) return;
    // Arrastar o mapa não é clicar no vazio.
    if (Math.hypot(e.clientX - origem.x, e.clientY - origem.y) > TOLERANCIA_DE_CLIQUE) return;
    if (onClicarNo) onClicarNo(null, { alcancavel: false, aqui: false });
  }, [onClicarNo]);

  const transformDaCamera = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
  const larguraDoMundo = mundo?.largura || 0;
  const alturaDoMundo = mundo?.altura || 0;
  const ondeEsta = nomeNaMesa(nos.find((n) => n?.id === noAtualId));

  return (
    <div
      ref={ligarPalco}
      className="wmm-palco"
      data-testid="wmm-palco"
      data-viajando={viajando ? "sim" : undefined}
      /* O interruptor dos cinco movimentos, num atributo só (ver `MesaStyles`). */
      data-anima={animando ? "sim" : "nao"}
      role="application"
      aria-label="Mapa-múndi da mesa: lugares descobertos e trilhas reveladas"
      style={{
        height: altura ?? "100%",
        flex: altura ? "none" : 1,
        minHeight: 320,
        borderRadius: R.card,
        background: "radial-gradient(circle at 50% 40%, #171720, #0b0b11 70%)",
        /* A moldura colorida É o aviso de que a visão não é a do mestre — o
           mesmo contrato da F3 (`ControlesDaNevoa`), não um segundo idioma. */
        border: destaque ? `2px solid ${destaque}` : "1px solid rgba(255,255,255,0.10)",
        boxShadow: destaque ? `inset 0 0 0 1px ${destaque}33, 0 0 24px ${destaque}22` : undefined,
      }}
      {...juntarHandlers(handlers, { onPointerDown: aoDescer })}
      onClick={aoClicarPalco}
    >
      {/* ── Camada 0 · ilustração vetorial (mapa padrão) ──────────────── */}
      {Cartografia && larguraDoMundo > 0 ? (
        <div
          className="wmm-camada"
          aria-hidden="true"
          style={{
            width: larguraDoMundo,
            height: alturaDoMundo,
            transform: transformDaCamera,
            pointerEvents: "none",
          }}
        >
          <Cartografia idPrefix="wmm-carta" style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
        </div>
      ) : null}

      {/* ── Camada 1 · canvas: fundo, trilhas e rastro ────────────────── */}
      <canvas
        ref={canvasRef}
        className="wmm-tela"
        data-testid="wmm-canvas"
        aria-hidden="true"
        style={{ width: "100%", height: "100%" }}
      />

      {/* ── Camada 1½ · a tinta de hora do dia (movimento 5) ──────────────
          Entre a ilustração e a névoa, e ABAIXO dos nós: nenhum ícone e
          nenhum rótulo é tingido, em período nenhum. Ver `TintaDoDia.jsx`. */}
      <TintaDoDia relogio={relogio} ligada={tintaLigada} />

      {/* ── Camada 2 · névoa ──────────────────────────────────────────── */}
      {nevoa ? (
        <CamadaDeNevoa
          {...nevoa}
          pan={pan}
          scale={scale}
          largura={tamanho.largura}
          altura={tamanho.altura}
        />
      ) : null}

      {/* ── Camada 3 · lugares (DOM, virtualizados) + marcador ────────── */}
      <div className="wmm-camada" style={{ transform: transformDaCamera, width: 1, height: 1 }}>
        {visiveis.map((no) => (
          <LugarNaMesa
            key={no.id}
            no={no}
            escala={scale}
            aqui={no.id === noAtualId}
            destino={destinoPorId.get(no.id) || null}
            selecionado={selecionadoId === no.id}
            recemRevelado={novos.has(no.id)}
            anima={animando}
            onClicar={(alvo, ctx) => { if (onClicarNo) onClicarNo(alvo, ctx); }}
          />
        ))}

        <MarcadorDoGrupo
          posicao={marcador}
          escala={scale}
          viajando={viajando}
          ondeEsta={ondeEsta}
          tombo={tombo}
        />
      </div>

      {/* ── Aviso de mapa vazio ───────────────────────────────────────── */}
      {nos.length === 0 ? (
        <div
          role="status"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            maxWidth: 320,
            textAlign: "center",
            padding: `${SP.x3}px ${SP.x4}px`,
            borderRadius: R.card,
            background: "rgba(10,10,16,0.86)",
            border: "1px solid var(--border2)",
            ...T.meta,
            pointerEvents: "none",
          }}
        >
          O mapa ainda está todo na névoa. Nada foi revelado a este grupo.
        </div>
      ) : null}
    </div>
  );
}
