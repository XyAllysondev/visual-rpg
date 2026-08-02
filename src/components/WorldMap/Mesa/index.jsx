/* ════════════════════════════════════════════════════════════════════
 *  A MESA DO MAPA-MÚNDI  (spec 0028 · F4)
 *  AC-6 · AC-7 · AC-8 · AC-10 · AC-11 · AC-12 — design §2 e §5.4
 *  --------------------------------------------------------------------
 *  Uma tela, dois papéis. O mestre orquestra; o jogador viaja.
 *
 *  ── QUEM LÊ O QUÊ (AC-1, e é estrutural) ────────────────────────────
 *   · o MESTRE assina o MOLDE (`useGrafo` em `users/{uid}/worldmaps/…`) e
 *     é o único cliente capaz de rodar a revelação — é ele quem enxerga o
 *     que está oculto para poder acendê-lo;
 *   · o JOGADOR assina só `revealed/`, e o grafo dele é montado do que já
 *     está lá (`grafoDoRevelado`). O que ele não descobriu não chega no
 *     cliente dele — não é escondido no render, não existe na rede.
 *   · o mestre ESPIANDO usa `projecaoDoJogador(estado, molde)`: a mesma
 *     função que o store usa para gravar, então a prévia é fiel por
 *     construção, e não por um segundo desenho que poderia divergir.
 *
 *  ── A VIAGEM (o pedido do Andre) ────────────────────────────────────
 *  *"a animação no mapa mundi deles seguindo pela linha e ir indo
 *  desbloqueando o mapa aos pouquinhos"*:
 *
 *    comecar() → useViagem roda rAF com dt real
 *              → a cada quadro: nevoaDaViagem() abre a névoa sobre o
 *                trecho JÁ PERCORRIDO  ← "aos pouquinhos"
 *              → ao chegar: aoConcluirViagem() (AC-6), o raio abre, o
 *                relógio anda, a comida cai, o mestre publica.
 *
 *  A viagem do OUTRO cliente também anima: quando `party.currentNodeId`
 *  muda por fora, a mesa refaz o percurso localmente com `{remoto:true}` —
 *  e uma viagem remota NÃO regrava o movimento (senão os dois clientes
 *  ficariam se empurrando).
 *
 *  ── O QUE NÃO ESTÁ AQUI ─────────────────────────────────────────────
 *  Eventos e gatilhos (F5), encontros e acampamento (F6), deltas de névoa
 *  e as cinco animações completas (F7). E nada de `MapEditor` — o
 *  mapa-múndi é componente irmão (AC-12).
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useMapCamera from "../../../hooks/useMapCamera";
import {
  useInstancias, useReveladoNaMesa, useParty, useFogDaMesa,
  publicarRevelacao, moverGrupo, atualizarParty, salvarFogDaMesa, getFundoDaMesa,
  mestreDaInstancia,
} from "../mesaStore";
import { useGrafo } from "../worldMapStore";
import { construirMapaPadrao, ehMapaPadrao } from "../model/mapaPadrao";
import CartografiaPadrao from "../model/CartografiaPadrao";
import { limitesDoGrafo } from "../model/graph";
import { mascaraParaOMundo, revelarCirculo } from "../model/fogMask";
import {
  aoConcluirViagem, destinosPossiveis, podeViajarPara,
  projecaoDoJogador, revelarManualmente, RAIO_DE_REVELACAO_PADRAO,
} from "../model/revelacao";
import { avancarRelogio, consumirSuprimentos, nevoaDaViagem, trechoPercorrido } from "../model/viagem";
import { MUNDO_DE_RESERVA } from "../Editor/editorUi";
import { COR_DA_VISAO_DE_JOGADOR } from "../Editor/ControlesDaNevoa";
import { mensagemDeErro, SP, R, T, LINE, FS, FF, FW, btnStyle, DANGER_TEXT_AA } from "../Atelier/ui";
import MesaStyles from "./MesaStyles";
import TelaDaMesa from "./TelaDaMesa";
import PainelDoGrupo from "./PainelDoGrupo";
import ConsoleDoMestre from "./ConsoleDoMestre";
import useViagem from "./useViagem";
import {
  consumoPorDia, estadoDoRevelado, estoqueOculto, grafoDoRevelado, moldeDaInstancia,
  nomeNaMesa, raioDaEstrada, relogioDe, resumoDaRevelacao,
} from "./mesaUi";

/** Quanto tempo o pulso de "acabou de ser revelado" dura na tela. */
const PISCA_DA_REVELACAO = 900;

/** De quantas unidades de mundo o grupo precisa andar para a visão atual mudar. */
const PASSO_DA_VISAO = 24;

const listaDe = (v) => (Array.isArray(v) ? v : []);

/**
 * @param {object} props
 * @param {string} props.campaignId
 * @param {string} props.uid quem está olhando.
 * @param {boolean} props.isMaster papel REAL (nunca a visão).
 * @param {number} [props.altura] altura do palco, em px.
 * @param {()=>void} [props.onSair]
 */
export default function MesaDoMapaMundi({
  campaignId,
  uid,
  isMaster = false,
  altura = 560,
  onSair,
}) {
  /* ── Qual mapa desta mesa ──────────────────────────────────────────── */
  const { instancias, loading: carregandoInstancias, error: erroInstancias } = useInstancias(campaignId);
  const [escolhida, setEscolhida] = useState("");
  const instancia = useMemo(
    () => instancias.find((i) => i.id === escolhida) || instancias[0] || null,
    [instancias, escolhida],
  );
  const instanciaId = instancia?.id || "";

  const mapId = useMemo(() => moldeDaInstancia(instanciaId), [instanciaId]);
  const donoDoMolde = useMemo(() => mestreDaInstancia(instanciaId), [instanciaId]);
  /* Ler o molde exige ser o dono dele. Mestre de outra campanha, ou mestre que
     não criou este mapa, joga com a projeção — como o jogador. */
  const podeVerMolde = !!uid && isMaster && uid === donoDoMolde;
  const ehPadrao = ehMapaPadrao(mapId);

  /* ── As duas fontes ────────────────────────────────────────────────── */
  const remoto = useGrafo(podeVerMolde && !ehPadrao ? donoDoMolde : "", podeVerMolde && !ehPadrao ? mapId : "");
  const seed = useMemo(() => (podeVerMolde && ehPadrao ? construirMapaPadrao() : null), [podeVerMolde, ehPadrao]);

  const molde = useMemo(() => {
    if (!podeVerMolde) return null;
    if (seed) return { nos: seed.nos, trilhas: seed.trilhas };
    return { nos: remoto.nos, trilhas: remoto.trilhas };
  }, [podeVerMolde, seed, remoto.nos, remoto.trilhas]);

  const { revelado, loading: carregandoRevelado } = useReveladoNaMesa(campaignId, instanciaId);
  const { party } = useParty(campaignId, instanciaId);

  const estado = useMemo(() => estadoDoRevelado(revelado), [revelado]);
  const doRevelado = useMemo(() => grafoDoRevelado(revelado), [revelado]);

  /* ── Visão (padrão da F3: dois estados que se unem só no render) ───── */
  const [espiando, setEspiando] = useState(false);
  useEffect(() => { setEspiando(false); }, [instanciaId]);
  const comoJogador = !podeVerMolde || espiando;

  /** O grafo DESENHADO. Espiando, é a projeção — a mesma que o store grava. */
  const grafoVisivel = useMemo(() => {
    if (!podeVerMolde) return doRevelado;
    if (espiando) return projecaoDoJogador(estado, molde);
    return molde;
  }, [podeVerMolde, espiando, doRevelado, estado, molde]);

  /** O grafo que decide NAVEGAÇÃO. O mestre navega pelo molde mesmo espiando:
   *  espiar é ver com os olhos do jogador, não perder as próprias mãos. */
  const grafoDeNavegacao = podeVerMolde ? molde : doRevelado;

  /* ── Mundo, ilustração e câmera ────────────────────────────────────── */
  const mundo = useMemo(() => {
    const largura = Number.isFinite(instancia?.width) && instancia.width > 0 ? instancia.width : 0;
    if (!largura) return MUNDO_DE_RESERVA;
    return { largura, altura: instancia.height || largura };
  }, [instancia?.width, instancia?.height]);

  const Cartografia = instancia?.ilustracao === "CartografiaPadrao" ? CartografiaPadrao : null;

  const [imagemFundo, setImagemFundo] = useState(null);
  const [fundoUrl, setFundoUrl] = useState("");

  useEffect(() => {
    let ativo = true;
    setFundoUrl("");
    if (!instanciaId) return () => { ativo = false; };
    if (instancia?.backgroundUrl) { setFundoUrl(instancia.backgroundUrl); return () => { ativo = false; }; }
    if (!instancia?.backgroundRef) return () => { ativo = false; };
    getFundoDaMesa(campaignId, instanciaId)
      .then((data) => { if (ativo && data) setFundoUrl(data); })
      .catch((e) => console.warn("[mesa do mapa] a ilustração não pôde ser lida:", e));
    return () => { ativo = false; };
  }, [campaignId, instanciaId, instancia?.backgroundRef, instancia?.backgroundUrl]);

  useEffect(() => {
    if (!fundoUrl || typeof Image === "undefined") { setImagemFundo(null); return undefined; }
    let ativo = true;
    const img = new Image();
    img.onload = () => { if (ativo) setImagemFundo(img); };
    img.onerror = () => { if (ativo) setImagemFundo(null); };
    img.src = fundoUrl;
    return () => { ativo = false; };
  }, [fundoUrl]);

  const camera = useMapCamera({ initial: { scale: 0.5 } });
  const { fitToScreen } = camera;

  const jaEnquadrou = useRef(false);
  useEffect(() => { jaEnquadrou.current = false; }, [instanciaId]);
  useEffect(() => {
    if (jaEnquadrou.current || !instanciaId || carregandoRevelado) return undefined;
    jaEnquadrou.current = true;
    const caixa = limitesDoGrafo(listaDe(grafoVisivel?.nos));
    const t = setTimeout(() => fitToScreen(caixa && caixa.largura > 0 ? caixa : mundo), 60);
    return () => clearTimeout(t);
  }, [instanciaId, carregandoRevelado, grafoVisivel, mundo, fitToScreen]);

  /* ── Névoa da mesa ─────────────────────────────────────────────────── */
  const nevoaLigada = instancia?.fogEnabled !== false;
  const fog = useFogDaMesa(campaignId, nevoaLigada ? instanciaId : "");
  const [mascara, setMascara] = useState(null);
  const [revisaoDaNevoa, setRevisaoDaNevoa] = useState(0);

  useEffect(() => {
    if (!nevoaLigada || !instanciaId) { setMascara(null); return; }
    if (fog.loading) return;
    setMascara((atual) => mascaraParaOMundo(fog.mascara || atual, mundo));
    setRevisaoDaNevoa((r) => r + 1);
  }, [nevoaLigada, instanciaId, fog.mascara, fog.loading, mundo]);

  /** Muta a máscara em lugar e só repinta quando algo mudou de verdade. */
  const mexerNaNevoa = useCallback((aplicar) => {
    const m = mascara;
    if (!m) return false;
    const antes = m.revisao;
    aplicar(m);
    if (m.revisao === antes) return false;
    setRevisaoDaNevoa((r) => r + 1);
    return true;
  }, [mascara]);

  /* ── Estado da viagem e da conversa com o grupo ────────────────────── */
  const [noExibido, setNoExibido] = useState(null);
  const [anuncio, setAnuncio] = useState("");
  const [aviso, setAviso] = useState("");
  const [falha, setFalha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [recemRevelados, setRecemRevelados] = useState([]);

  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const anunciar = useCallback((texto) => { if (vivo.current) setAnuncio(texto); }, []);

  /* Refs para os handlers da viagem lerem o estado ATUAL sem reiniciar o laço. */
  const contexto = useRef({});
  contexto.current = {
    campaignId, instanciaId, uid, podeVerMolde, molde, estado, revelado, party, mascara,
  };

  /* ── O pulso da revelação (design §5.4, movimento 2) ───────────────── */
  const vistos = useRef(null);
  useEffect(() => {
    const agora = new Set(Object.keys(estado.nos));
    if (vistos.current === null) { vistos.current = agora; return undefined; }
    const novos = [...agora].filter((id) => !vistos.current.has(id));
    vistos.current = agora;
    if (novos.length === 0) return undefined;
    setRecemRevelados(novos);
    const t = setTimeout(() => { if (vivo.current) setRecemRevelados([]); }, PISCA_DA_REVELACAO);
    return () => clearTimeout(t);
  }, [estado]);

  useEffect(() => { vistos.current = null; }, [instanciaId]);

  /* ════════════════════════════════════════════════════════════════════
   *  A VIAGEM
   * ══════════════════════════════════════════════════════════════════ */

  /* O raio vem do MAPA quando o mestre o configurou no ateliê; o padrão do
   * módulo é só o último recurso. Sem isto, o ajuste dele no ateliê não teria
   * efeito na mesa — e ajuste que não age é pior que ajuste que não existe. */
  const raioDeChegada = Number.isFinite(instancia?.defaultRevealRadius)
    && instancia.defaultRevealRadius > 0
      ? instancia.defaultRevealRadius
      : RAIO_DE_REVELACAO_PADRAO;

  /** Cada quadro: a névoa abre sobre o que já foi andado. "Aos pouquinhos." */
  const aoAndar = useCallback((v) => {
    mexerNaNevoa((m) => nevoaDaViagem(m, v, raioDaEstrada(raioDeChegada)));
  }, [mexerNaNevoa, raioDeChegada]);

  /** A chegada: AC-6 inteiro, mais o relógio, a comida e a publicação. */
  const aoChegar = useCallback(async (v) => {
    const c = contexto.current;
    setNoExibido(v.paraId);

    const nome = nomeNaMesa(listaDe(grafoVisivel?.nos).find((n) => n?.id === v.paraId))
      || nomeNaMesa(listaDe(c.molde?.nos).find((n) => n?.id === v.paraId));
    anunciar(`O grupo chegou a ${nome}.`);

    if (!c.podeVerMolde || !c.molde) return;   // só o mestre revela (design §3)

    try {
      setOcupado(true);
      const r = aoConcluirViagem(c.estado, c.molde, v.trilhaId, v.paraId, { raioPadrao: raioDeChegada });

      if (r.nevoa) mexerNaNevoa((m) => revelarCirculo(m, r.nevoa.x, r.nevoa.y, r.nevoa.raio));

      const nos = r.nosAlterados
        .map(({ id, para }) => ({ no: c.molde.nos.find((n) => n?.id === id), state: para }))
        .filter((x) => x.no);
      const trilhas = r.trilhasAlteradas
        .map(({ id, para }) => ({ trilha: c.molde.trilhas.find((t) => t?.id === id), state: para }))
        .filter((x) => x.trilha);

      if (nos.length + trilhas.length > 0) {
        await publicarRevelacao(c.campaignId, c.instanciaId, { nos, trilhas }, { existentes: c.revelado });
        const resumo = resumoDaRevelacao(r.nosAlterados, r.trilhasAlteradas);
        if (resumo) anunciar(`O grupo chegou a ${nome}. Revelado: ${resumo}.`);
      }

      /* Relógio e comida — o custo da estrada (AC-10 guarda os dois). */
      const horas = Number.isFinite(v.horas) ? v.horas : 0;
      if (horas > 0) {
        const patch = { inGameDatetime: avancarRelogio(relogioDe(c.party), horas) };
        if (Number.isFinite(c.party?.supplies)) {
          patch.supplies = consumirSuprimentos(c.party.supplies, horas, consumoPorDia(c.party)).restante;
        }
        await atualizarParty(c.campaignId, c.instanciaId, patch);
      }

      if (c.mascara) await salvarFogDaMesa(c.campaignId, c.instanciaId, c.mascara);
    } catch (err) {
      console.error("[mesa do mapa] a chegada não pôde ser publicada:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    } finally {
      if (vivo.current) setOcupado(false);
    }
  }, [anunciar, grafoVisivel, mexerNaNevoa, raioDeChegada]);

  const viagemCtl = useViagem({
    aoAndar,
    aoChegar,
    aoFalhar: (mensagem) => setAviso(mensagem),
  });
  const { viagem, viajando, comecar } = viagemCtl;

  /* ── Quem manda no marcador quando ninguém está viajando ───────────── */
  const noDoGrupo = noExibido || party?.currentNodeId || null;

  const marcador = useMemo(() => {
    if (viagem?.posicao) return viagem.posicao;
    const no = listaDe(grafoVisivel?.nos).find((n) => n?.id === noDoGrupo)
      || listaDe(grafoDeNavegacao?.nos).find((n) => n?.id === noDoGrupo);
    if (no && Number.isFinite(no.x)) return { x: no.x, y: no.y };
    if (Number.isFinite(party?.x) && Number.isFinite(party?.y)) return { x: party.x, y: party.y };
    return null;
  }, [viagem, grafoVisivel, grafoDeNavegacao, noDoGrupo, party?.x, party?.y]);

  const rastro = useMemo(() => (viagem ? trechoPercorrido(viagem) : []), [viagem]);

  /* ── Movimento vindo de outro cliente (AC-10) ──────────────────────── */
  useEffect(() => {
    const alvo = party?.currentNodeId || null;
    if (!alvo || viajando) return;
    if (noExibido === alvo) return;
    if (!noExibido) { setNoExibido(alvo); return; }   // primeira carga: sem percurso
    const ok = comecar(grafoDeNavegacao, noExibido, alvo, undefined, { remoto: true });
    if (!ok) setNoExibido(alvo);                       // sem trilha conhecida: salta
  }, [party?.currentNodeId, viajando, noExibido, comecar, grafoDeNavegacao]);

  /* ── Viajar (AC-8) ─────────────────────────────────────────────────── */
  const destinos = useMemo(
    () => (noDoGrupo ? destinosPossiveis(estado, grafoDeNavegacao, noDoGrupo) : []),
    [estado, grafoDeNavegacao, noDoGrupo],
  );

  const gravarMovimento = useCallback(async (noId, posicao) => {
    try {
      await moverGrupo(campaignId, instanciaId, {
        nodeId: noId,
        x: Number.isFinite(posicao?.x) ? posicao.x : 0,
        y: Number.isFinite(posicao?.y) ? posicao.y : 0,
        quem: uid,
      });
    } catch (err) {
      console.error("[mesa do mapa] o movimento do grupo não foi gravado:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    }
  }, [campaignId, instanciaId, uid]);

  const viajar = useCallback((destino) => {
    if (!destino?.noId || viajando || !noDoGrupo) return;
    setAviso("");
    const r = podeViajarPara(estado, grafoDeNavegacao, noDoGrupo, destino.noId);
    if (!r.ok) { setAviso(r.motivo); anunciar(r.motivo); return; }

    const alvo = listaDe(grafoDeNavegacao?.nos).find((n) => n?.id === destino.noId);
    const ritmo = Number.isFinite(party?.speedModifier) ? party.speedModifier : 1;

    /* O anúncio da partida vem ANTES de `comecar`: com movimento reduzido a
       viagem é instantânea e o `aoChegar` dispara ainda dentro desta linha —
       anunciar depois apagaria a chegada com a partida. */
    anunciar(`O grupo partiu para ${nomeNaMesa(alvo)}.`);
    if (!comecar(grafoDeNavegacao, noDoGrupo, destino.noId, r.trilha, { ritmo })) return;

    /* O movimento é gravado NA PARTIDA: assim o outro cliente anima junto, em
       vez de o grupo teleportar quando a viagem daqui termina. */
    gravarMovimento(destino.noId, { x: alvo?.x, y: alvo?.y });
  }, [viajando, noDoGrupo, estado, grafoDeNavegacao, comecar, party?.speedModifier, anunciar, gravarMovimento]);

  /* ── Mover à força: o mestre conduz a mesa ─────────────────────────── */
  const moverPara = useCallback((noId) => {
    if (!podeVerMolde || !noId || viajando) return;
    const alvo = listaDe(molde?.nos).find((n) => n?.id === noId);
    if (!alvo) return;
    setAviso("");
    /* Com trilha no molde (mesmo secreta ou oculta), o grupo ANDA — o mestre
       conduzindo continua sendo viagem. Sem trilha, ele salta: é a mão do
       mestre, e fingir uma estrada que não existe seria pior. */
    const seguiu = noDoGrupo
      ? comecar(molde, noDoGrupo, noId, undefined, { ritmo: 1 })
      : false;
    if (!seguiu) {
      setNoExibido(noId);
      if (mascara) mexerNaNevoa((m) => revelarCirculo(m, alvo.x, alvo.y, raioDeChegada));
      anunciar(`O mestre levou o grupo para ${nomeNaMesa(alvo)}.`);
    }
    gravarMovimento(noId, { x: alvo.x, y: alvo.y });
  }, [podeVerMolde, viajando, molde, noDoGrupo, comecar, mascara, mexerNaNevoa, raioDeChegada, anunciar, gravarMovimento]);

  /* ── Revelar agora (AC-8) ──────────────────────────────────────────── */
  const estoque = useMemo(
    () => (podeVerMolde ? estoqueOculto(estado, molde) : { nos: [], trilhas: [], total: 0, ocultos: 0 }),
    [podeVerMolde, estado, molde],
  );

  const revelarAgora = useCallback(async (pedido) => {
    if (!podeVerMolde || !molde) return;
    setFalha("");
    const r = revelarManualmente(estado, pedido);
    if (!r.mudou) {
      anunciar("Isso já estava revelado para o grupo.");
      return;
    }

    try {
      setOcupado(true);
      const nos = r.nosAlterados
        .map(({ id, para }) => ({ no: molde.nos.find((n) => n?.id === id), state: para }))
        .filter((x) => x.no);
      const trilhas = r.trilhasAlteradas
        .map(({ id, para }) => ({ trilha: molde.trilhas.find((t) => t?.id === id), state: para }))
        .filter((x) => x.trilha);

      await publicarRevelacao(campaignId, instanciaId, { nos, trilhas }, { existentes: revelado });

      /* A "região" do AC-8: abrir a névoa em volta do que foi liberado. Sem
         isso, o lugar acenderia debaixo de uma cortina fechada. */
      let mexeu = false;
      if (pedido?.abrirNevoa) {
        nos.forEach(({ no }) => {
          const raio = Number.isFinite(no.revealRadius) && no.revealRadius > 0 ? no.revealRadius : raioDeChegada;
          if (mexerNaNevoa((m) => revelarCirculo(m, no.x, no.y, raio))) mexeu = true;
        });
      }
      if (mexeu && mascara) await salvarFogDaMesa(campaignId, instanciaId, mascara);

      const resumo = resumoDaRevelacao(r.nosAlterados, r.trilhasAlteradas);
      anunciar(`Revelado para o grupo: ${resumo}.`);
    } catch (err) {
      console.error("[mesa do mapa] a revelação não foi publicada:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    } finally {
      if (vivo.current) setOcupado(false);
    }
  }, [podeVerMolde, molde, estado, campaignId, instanciaId, revelado, mexerNaNevoa, mascara, raioDeChegada, anunciar]);

  /* ── Relógio e comida na mão do mestre ─────────────────────────────── */
  const ajustarGrupo = useCallback(async (patch) => {
    if (!podeVerMolde) return;
    setFalha("");
    const dados = {};
    if (Number.isFinite(patch?.horas)) {
      dados.inGameDatetime = avancarRelogio(relogioDe(party), patch.horas);
    }
    if ("supplies" in (patch || {})) {
      dados.supplies = Number.isFinite(patch.supplies) ? Math.max(0, patch.supplies) : null;
    }
    if (Object.keys(dados).length === 0) return;
    try {
      await atualizarParty(campaignId, instanciaId, dados);
    } catch (err) {
      console.error("[mesa do mapa] o estado do grupo não foi gravado:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    }
  }, [podeVerMolde, party, campaignId, instanciaId]);

  /* ── Clique no palco ───────────────────────────────────────────────── */
  const aoClicarNo = useCallback((no, ctx) => {
    if (!no) { setSelecionadoId(null); return; }
    setSelecionadoId(no.id);
    if (ctx?.aqui) { setAviso(""); return; }
    const destino = destinos.find((d) => d.noId === no.id);
    if (destino) { viajar(destino); return; }
    /* A recusa vem de `podeViajarPara`, PALAVRA POR PALAVRA — ela é a mesma
       para "não há trilha", "a trilha é secreta" e "o destino está oculto",
       e reescrevê-la aqui denunciaria qual dos três é o caso (AC-9). */
    const r = podeViajarPara(estado, grafoDeNavegacao, noDoGrupo, no.id);
    setAviso(r.motivo);
    anunciar(r.motivo);
  }, [destinos, viajar, estado, grafoDeNavegacao, noDoGrupo, anunciar]);

  /* ── A "visão atual" do grupo, para a névoa de 45% (AC-5) ──────────── */
  const chaveDaVisao = marcador
    ? `${Math.round(marcador.x / PASSO_DA_VISAO)}:${Math.round(marcador.y / PASSO_DA_VISAO)}`
    : "";
  const mascaraAtual = useMemo(() => {
    if (!mascara || !marcador || !comoJogador) return null;
    const vista = mascaraParaOMundo(null, mundo, mascara.escala);
    revelarCirculo(vista, marcador.x, marcador.y, raioDeChegada);
    return vista;
    // `chaveDaVisao` é a régua: recalcular a cada pixel andado seria varrer a
    // grade 60 vezes por segundo para mudar quase nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascara, comoJogador, mundo, raioDeChegada, chaveDaVisao]);

  /* ════════════════════════════════════════════════════════════════════
   *  RENDER
   * ══════════════════════════════════════════════════════════════════ */

  const noAtualDesenhado = listaDe(grafoVisivel?.nos).find((n) => n?.id === noDoGrupo) || null;
  const semMapa = !carregandoInstancias && instancias.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.x3, minHeight: 0 }}>
      <MesaStyles />

      {/* ── Cabeçalho ──────────────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", gap: SP.x3, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FF.display, fontSize: FS.h3, color: "var(--gold2,var(--gold))" }}>
            {instancia?.name || "Mapa-múndi"}
          </div>
          <div style={T.section}>
            {comoJogador ? "Visão do jogador" : "Visão do mestre"}
            {instancias.length > 1 ? ` · ${instancias.length} mapas nesta mesa` : ""}
          </div>
        </div>

        {instancias.length > 1 ? (
          <label className="wmm-focus" style={{ ...T.meta, display: "inline-flex", alignItems: "center", gap: SP.x2 }}>
            Mapa
            <select
              value={instanciaId}
              onChange={(e) => setEscolhida(e.target.value)}
              aria-label="Qual mapa-múndi desta mesa"
              style={{
                minHeight: 40, padding: `0 ${SP.x2}px`, borderRadius: R.ctl,
                background: "var(--card2,var(--card))", color: "var(--text)",
                border: `1px solid ${LINE.raise}`, fontFamily: FF.ui, fontSize: FS.meta,
              }}
            >
              {instancias.map((i) => (
                <option key={i.id} value={i.id}>{i.name || "Mapa-múndi"}</option>
              ))}
            </select>
          </label>
        ) : null}

        {onSair ? (
          <button type="button" className="wmm-acao" onClick={onSair} style={btnStyle("quiet", "sm")}>
            ← Voltar
          </button>
        ) : null}
      </header>

      {/* ── O que o leitor de tela ouve (AC-8, AC-11) ───────────────── */}
      <p
        role="status"
        aria-live="polite"
        data-testid="wmm-anuncio"
        style={{
          margin: 0, minHeight: 20, ...T.meta,
          color: anuncio ? "var(--text)" : "var(--muted)",
        }}
      >
        {anuncio}
      </p>

      {erroInstancias ? (
        <p role="alert" style={{ ...T.meta, color: DANGER_TEXT_AA, margin: 0 }}>
          {mensagemDeErro(erroInstancias)}
        </p>
      ) : null}

      {semMapa ? (
        <div
          data-testid="wmm-sem-mapa"
          style={{
            padding: SP.x6, textAlign: "center", borderRadius: R.panel,
            background: "var(--card)", border: `1px solid ${LINE.edge}`,
          }}
        >
          <div style={{ fontSize: 40, opacity: 0.4 }} aria-hidden="true">🧭</div>
          <p style={{ ...T.body, margin: `${SP.x3}px 0 0` }}>
            Nenhum mapa-múndi nesta mesa ainda.
          </p>
          <p style={{ ...T.meta, margin: `${SP.x2}px 0 0` }}>
            {isMaster
              ? "Abra a aba Mapas › Mapas-Múndi, escolha um mapa e use \"Levar para a mesa\"."
              : "O mestre ainda não trouxe um mapa-múndi para esta campanha."}
          </p>
        </div>
      ) : (
        <div
          className="wmm-layout"
          style={{
            display: "grid",
            gridTemplateColumns: podeVerMolde ? "minmax(0,1fr) 340px" : "minmax(0,1fr) 300px",
            gap: SP.x4, alignItems: "start", minHeight: 0,
          }}
        >
          <TelaDaMesa
            nos={listaDe(grafoVisivel?.nos)}
            trilhas={listaDe(grafoVisivel?.trilhas)}
            camera={camera}
            mundo={mundo}
            imagemFundo={imagemFundo}
            Cartografia={Cartografia}
            nevoa={nevoaLigada && mascara ? {
              mascara,
              mascaraAtual,
              papel: comoJogador ? "jogador" : "mestre",
              deriva: true,
              revisao: revisaoDaNevoa,
            } : null}
            noAtualId={noDoGrupo}
            destinos={destinos}
            marcador={marcador}
            rastro={rastro}
            viajando={viajando}
            selecionadoId={selecionadoId}
            recemRevelados={recemRevelados}
            onClicarNo={aoClicarNo}
            altura={altura}
            destaque={espiando ? COR_DA_VISAO_DE_JOGADOR : null}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: SP.x3, minWidth: 0 }}>
            {podeVerMolde ? (
              <ConsoleDoMestre
                noAtual={noAtualDesenhado || listaDe(molde?.nos).find((n) => n?.id === noDoGrupo) || null}
                destinos={destinos}
                onViajar={viajar}
                estoque={estoque}
                onRevelar={revelarAgora}
                onMoverPara={moverPara}
                espiando={espiando}
                onEspiar={setEspiando}
                party={party}
                onAjustarGrupo={ajustarGrupo}
                ocupado={ocupado || viajando}
                falha={falha}
              />
            ) : null}

            <PainelDoGrupo
              party={party}
              noAtual={noAtualDesenhado}
              destinos={destinos}
              onViajar={viajar}
              viajando={viajando}
              podeMover
              aviso={aviso}
            />

            {!podeVerMolde && isMaster ? (
              <p style={{ ...T.meta, margin: 0 }}>
                Este mapa foi trazido por outro mestre. Você joga com o que o grupo já descobriu.
              </p>
            ) : null}

            {!isMaster ? (
              <p style={{ ...T.meta, margin: 0, fontWeight: FW.med }}>
                O mapa se desenha conforme o grupo viaja. O que ainda não foi descoberto não está
                aqui — nem escondido na tela.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
