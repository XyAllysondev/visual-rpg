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
 *  ── OS EVENTOS E A PROCURA (F5) ─────────────────────────────────────
 *  A chegada avalia os seis gatilhos (`avaliarGatilhos`) com o molde em
 *  mãos, publica só `{id,title,playerText}` e anota o id em
 *  `gm.triggeredEventIds`. A procura (AC-9) é oferecida em TODO nó e o
 *  fracasso responde a mesma frase de um lugar vazio — a régua está no
 *  cabeçalho de `EventosDoGrupo.jsx` e o gate em `evento-mesa.test.js`.
 *
 *  ── O QUE NÃO ESTÁ AQUI ─────────────────────────────────────────────
 *  Encontros e acampamento (F6), deltas de névoa e as cinco animações
 *  completas (F7). O pedido de procura FEITO PELO JOGADOR também é F6:
 *  hoje ele avisa a mesa e o mestre resolve, porque o cliente dele não lê
 *  o molde e as rules não lhe dão canal de escrita (design §3). E nada de
 *  `MapEditor` — o mapa-múndi é componente irmão (AC-12).
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useMapCamera from "../../../hooks/useMapCamera";
import {
  useInstancias, useReveladoNaMesa, useParty, useFogDaMesa,
  publicarRevelacao, moverGrupo, atualizarParty, getFundoDaMesa,
  mestreDaInstancia, useGmDaMesa, atualizarGm,
  atualizarViagem, concluirViagem, projecaoDaViagem, projecaoDoNo, reservarPendencia, resolverPendencia,
} from "../mesaStore";
import { useGrafo, useEventos } from "../worldMapStore";
import {
  aplicarEvento, avaliarGatilhos, dispararManualmente, dispararPorTeste, projecaoDoEvento,
} from "../model/eventos";
import {
  aplicarDescoberta, resultadoDaDescoberta, testesDisponiveis,
} from "../model/descoberta";
import {
  PERICIA_DA_ESQUIVA, bonusDaEsquiva, melhorFurtividade, resultadoDaEsquiva,
} from "../model/esquiva";
import { rollDice } from "../../../domain/dice";
import { construirMapaPadrao, ehMapaPadrao } from "../model/mapaPadrao";
import CartografiaPadrao from "../model/CartografiaPadrao";
import { limitesDoGrafo } from "../model/graph";
import { clonar, mascaraParaOMundo, mesmaGrade, revelarCirculo } from "../model/fogMask";
import { absorver } from "../model/fogDelta";
import {
  aoConcluirViagem, destinosPossiveis, podeViajarPara,
  projecaoDoJogador, revelarManualmente, RAIO_DE_REVELACAO_PADRAO,
} from "../model/revelacao";
import { avancarRelogio, consumirSuprimentos, nevoaDaViagem, trechoPercorrido, trechoRestante } from "../model/viagem";
import {
  chanceDeEncontro, decidirEncontro, montarPendencia, periodoDe, sortearEncontro, sorteioDeD100,
} from "../model/encontros";
import { acampar, descansoRecuperado, podeAcampar } from "../model/acampamento";
import { MUNDO_DE_RESERVA } from "../Editor/editorUi";
import { COR_DA_VISAO_DE_JOGADOR } from "../Editor/ControlesDaNevoa";
import { mensagemDeErro, SP, R, T, LINE, FS, FF, FW, btnStyle, DANGER_TEXT_AA } from "../Atelier/ui";
import MesaStyles from "./MesaStyles";
import TelaDaMesa from "./TelaDaMesa";
import PainelDoGrupo from "./PainelDoGrupo";
import ConsoleDoMestre from "./ConsoleDoMestre";
import FilaDeEventos from "./FilaDeEventos";
import EventosDoGrupo from "./EventosDoGrupo";
import PainelDeEncontro from "./PainelDeEncontro";
import { CartaoDeDescoberta } from "./CartaoDePergaminho";
import { useMovimentoReduzido } from "../Editor/animacao";
import Acampamento from "./Acampamento";
import useViagem from "./useViagem";
import useNevoaAoVivo, { novaSessao } from "./useNevoaAoVivo";
import {
  ID_DA_PROCURA, PEDIDO_DE_PROCURA, TITULO_DA_PROCURA,
  anuncioDoEvento, contextoDoPasso, flagsComAsNovas,
} from "./eventosUi";
import {
  MARCA_DO_PERIGO, TEXTO_DA_PAUSA,
  anuncioDaDecisao, assinaturaDaPendencia, contextoDaPendencia,
  flagsComPausa, formatarChance, formatarRolagem, idDaPendencia, idDoEncontro, nomesSugeridos,
  perigoDaRegiao, sugestaoDeEncontro, temPendencia, textoDoEncontro, tituloDoEncontro,
  viagemPausada,
} from "./encontrosUi";
import {
  consumoPorDia, estadoDoRevelado, estoqueOculto, grafoDoRevelado, moldeDaInstancia,
  nomeNaMesa, raioDaEstrada, relogioDe, resumoDaRevelacao,
} from "./mesaUi";

/** Quanto tempo o pulso de "acabou de ser revelado" dura na tela. */
const PISCA_DA_REVELACAO = 900;

/** De quantas unidades de mundo o grupo precisa andar para a visão atual mudar. */
const PASSO_DA_VISAO = 24;

/**
 * De quanto em quanto tempo o andamento da viagem é gravado, em ms (F7).
 *
 * A viagem anda a 60 quadros por segundo e a mesa **não grava por quadro** —
 * o marco de 2 s é o suficiente para um F5 no meio da estrada devolver o
 * grupo praticamente onde ele estava, ao custo de duas ou três escritas por
 * percurso. É deliberadamente mais lento que os 300 ms do delta de névoa:
 * a névoa é o que o grupo VÊ acontecer; o andamento só importa quando alguém
 * recarrega a página.
 */
const INTERVALO_DO_PROGRESSO_MS = 2000;

const listaDe = (v) => (Array.isArray(v) ? v : []);

/**
 * @param {object} props
 * @param {string} props.campaignId
 * @param {string} props.uid quem está olhando.
 * @param {boolean} props.isMaster papel REAL (nunca a visão).
 * @param {number|null} [props.altura] altura do palco, em px. O PADRÃO é `null`:
 *   o palco toma a altura da caixa disponível. Quem passa número continua
 *   mandando — a assinatura não mudou, só o default deixou de ser 560, que
 *   sobrava em telas altas e faltava em todas as outras.
 * @param {()=>void} [props.onSair]
 * @param {(sceneId:string, evento:object)=>void} [props.onEntrarNaCena] leva a
 *   mesa para a cena tática vinculada a um evento (F5). Sem esta prop o atalho
 *   simplesmente não aparece — o mapa-múndi não sabe navegar sozinho, e fingir
 *   um botão que não leva a lugar nenhum seria pior do que não tê-lo.
 */
export default function MesaDoMapaMundi({
  campaignId,
  uid,
  isMaster = false,
  altura = null,
  onSair,
  onEntrarNaCena,
  /* As fichas compartilhadas da campanha, já lidas pela casca do app
     (`sharedSheetsRepo.watchByCampaign`). Chegam por prop porque o
     mapa-múndi NÃO abre listener de ficha: o acoplamento entre os dois
     agregados tem uma porta só, e ela é pura (ADR-0012). Vazio é o caso
     comum e não degrada nada — sem ficha, o mestre digita o bônus como
     sempre digitou (AC-13). */
  fichasCompartilhadas = [],
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

  const {
    revelado, eventos: eventosPublicos, loading: carregandoRevelado,
  } = useReveladoNaMesa(campaignId, instanciaId);
  const { party } = useParty(campaignId, instanciaId);

  /* ── Eventos: as DUAS pontas, e elas nunca se cruzam (AC-1) ────────
     · o MOLDE (`useEventos`) só o dono lê. É de lá que saem `gmText`,
       gatilho e revelações — e é o cliente do mestre que os avalia.
     · o PÚBLICO (`eventosPublicos`) sai de `revealed/`, e é o único que o
       jogador tem. O que ainda não disparou não existe na rede dele.
     · `gm/estado` guarda `triggeredEventIds` e o jogador NEM LÊ o documento. */
  const eventosDoMolde = useEventos(
    podeVerMolde && !ehPadrao ? donoDoMolde : "",
    podeVerMolde && !ehPadrao ? mapId : "",
  );
  const eventos = eventosDoMolde.eventos;
  const { gm } = useGmDaMesa(campaignId, instanciaId, podeVerMolde);

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

  /* Espelho da máscara para os efeitos a lerem sem entrar nas dependências —
     ela é MUTADA em lugar (contrato da F3), então pô-la numa dependência faria
     o efeito reagir à identidade do objeto, que justamente não muda. */
  const mascaraRef = useRef(null);
  mascaraRef.current = mascara;
  /** Última base consolidada considerada — evita reprocessar o mesmo snapshot. */
  const ultimaBase = useRef(0);

  /* ── A NÉVOA QUE CHEGA DO OUTRO CLIENTE (F7 · AC-10) ───────────────
     A regra é MESCLAR, nunca substituir: a revelação já aplicada aqui não
     pode sumir porque um snapshot chegou (e a união é o que torna delta
     perdido, repetido ou fora de ordem inofensivo).
     A ÚNICA exceção é a consolidação marcada `regrediu` — o mestre recobriu
     névoa de propósito, e mesclar devolveria exatamente o que ele tirou. */
  /** Identificador desta aba. Entra no id da viagem para duas abas do mesmo
   *  mestre não acharem que a viagem da outra é a sua. */
  const sessao = useRef(novaSessao()).current;

  const nevoaViva = useNevoaAoVivo({
    campaignId,
    instanciaId,
    mascara,
    revisao: revisaoDaNevoa,
    /* Só quem pode escrever na instância transmite. O jogador vê a névoa
       abrir pelo snapshot do mestre — ele não tem caminho de escrita aqui, e
       fingir que tem só produziria `permission-denied` no console dele. */
    ativo: nevoaLigada && !!uid && uid === donoDoMolde,
    /* Sem `aoFalhar`: rede caída não pode virar erro na cara da mesa. O hook
       registra no console e a revelação perdida volta no delta seguinte —
       ela continua desenhada aqui o tempo todo (AC-10). */
  });
  const { transmitir: transmitirNevoa, registrarRemota } = nevoaViva;

  useEffect(() => { ultimaBase.current = 0; }, [instanciaId]);

  useEffect(() => {
    if (!nevoaLigada || !instanciaId) { setMascara(null); return; }
    if (fog.loading) return;
    /* Eco da própria escrita (`metadata.hasPendingWrites`, o padrão de
       `campaignSync2.js`): isto já está aplicado nesta tela. */
    if (fog.local) return;

    const atual = mascaraRef.current;
    const remota = fog.mascara;

    if (!atual) {
      setMascara(mascaraParaOMundo(remota, mundo));
      setRevisaoDaNevoa((r) => r + 1);
      if (remota) registrarRemota(remota, true);
      return;
    }
    if (!remota) return;                       // ninguém gravou névoa ainda

    if (!mesmaGrade(atual, remota)) {          // o mapa mudou de tamanho
      setMascara(mascaraParaOMundo(remota, mundo));
      setRevisaoDaNevoa((r) => r + 1);
      registrarRemota(remota, true);
      return;
    }

    const recobriu = !!fog.regrediu && fog.rev > ultimaBase.current;
    if (fog.rev) ultimaBase.current = fog.rev;

    if (recobriu) {
      setMascara(clonar(remota));
      setRevisaoDaNevoa((r) => r + 1);
      registrarRemota(remota, true);
      return;
    }

    if (absorver(atual, remota) > 0) setRevisaoDaNevoa((r) => r + 1);
    registrarRemota(remota, false);
  }, [
    nevoaLigada, instanciaId, fog.mascara, fog.loading, fog.local,
    fog.rev, fog.regrediu, mundo, registrarRemota,
  ]);

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
  const [procurando, setProcurando] = useState(false);
  /* F6: o diálogo da decisão do mestre e o que o último acampamento fez. */
  const [encontroAberto, setEncontroAberto] = useState(false);
  const [resultadoDoAcampamento, setResultadoDoAcampamento] = useState(null);
  /* A frase da procura NUNCA é escrita aqui: chega pronta das constantes de
     `model/descoberta.js`. Ver o cabeçalho de `EventosDoGrupo.jsx` (AC-9). */
  const [resultadoDaProcura, setResultadoDaProcura] = useState("");

  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const anunciar = useCallback((texto) => { if (vivo.current) setAnuncio(texto); }, []);

  /* Refs para os handlers da viagem lerem o estado ATUAL sem reiniciar o laço. */
  const contexto = useRef({});
  contexto.current = {
    campaignId, instanciaId, uid, podeVerMolde, molde, estado, revelado, party, mascara,
    eventos, gm,
    /* As fichas compartilhadas entram no contexto (e não na lista de deps do
       sorteio) porque o `rolarEncontroDaEstrada` roda dentro do laço da viagem:
       recriá-lo a cada mudança de ficha reiniciaria o percurso. */
    fichas: fichasCompartilhadas,
  };

  /* Os ids já disparados vivem em `gm.triggeredEventIds` (design §3), mas o
     snapshot volta do servidor com atraso. Este espelho local é o que impede o
     mesmo evento de disparar duas vezes entre a gravação e a volta — sem ele,
     dois passos rápidos do grupo repetiriam a mesma cena. */
  const jaDisparados = useRef(new Set());
  useEffect(() => { jaDisparados.current = new Set(); }, [instanciaId]);
  useEffect(() => {
    listaDe(gm?.triggeredEventIds).forEach((id) => jaDisparados.current.add(id));
  }, [gm?.triggeredEventIds]);

  /* ════════════════════════════════════════════════════════════════════
   *  O CARTÃO DE DESCOBERTA  (spec 0035 · F3 · M5 · AC-12)
   *  ------------------------------------------------------------------
   *  O lugar que acabou de entrar no mapa merece mais do que acender um
   *  ícone: merece uma carta contando o que ele é. O cartão sai do MESMO
   *  pulso que já detecta a revelação (abaixo) — não de um gancho novo na
   *  chegada — e por isso funciona igual nos dois clientes: o do mestre,
   *  que revelou, e o do jogador, que viu o `revealed/` chegar.
   *
   *  ⚠️ **O texto passa por `projecaoDoNo` mesmo quando já veio projetado.**
   *  No cliente do JOGADOR, `grafoVisivel` já é a projeção — reprojetar é
   *  idempotente e não custa nada. No cliente do MESTRE, `grafoVisivel`
   *  pode carregar o nó do MOLDE, com `gmNotes` e companhia. Projetar aqui
   *  é o que garante que o cartão nunca imprima campo de mestre, e é o que
   *  o AC-12 mede varrendo o DOM atrás de `CAMPOS_VENENOSOS`.
   * ══════════════════════════════════════════════════════════════════ */
  const [cartaoDescoberta, setCartaoDescoberta] = useState(null);
  const semMovimento = useMovimentoReduzido();

  /* A melhor Furtividade da mesa, ou `null` quando não há ficha compartilhada
     (spec 0035 · M6 · AC-13/14). A conta inteira mora em `model/esquiva.js`;
     aqui só se decide QUANDO recalculá-la. */
  const bonusDeFurtividade = useMemo(
    () => melhorFurtividade(fichasCompartilhadas),
    [fichasCompartilhadas],
  );

  const anunciarDescoberta = useCallback((ids) => {
    /* Só `discovered`. Um nó que subiu para `rumored` não é descoberta — e
       dar-lhe cartão entregaria que existe algo ali, que é justamente o que
       o rumor não pode dizer (design 0028 §3). */
    const achado = listaDe(ids)
      .filter((id) => estado?.nos?.[id] === "discovered")
      .map((id) => listaDe(grafoVisivel?.nos).find((n) => n?.id === id))
      .find(Boolean);
    if (!achado) return;

    let projetado = null;
    try {
      projetado = projecaoDoNo(achado, "discovered");
    } catch (err) {
      /* Nó sem id ou sem coordenadas: não há cartão honesto a mostrar, e
         inventar um seria pior do que não mostrar nenhum (ADR-0011). */
      console.warn("[mesa do mapa] descoberta sem projeção possível:", err);
      return;
    }

    const nome = typeof projetado.name === "string" && projetado.name.trim()
      ? projetado.name.trim()
      : "um lugar sem nome";
    anunciar(`Nova localização descoberta: ${nome}.`);
    setCartaoDescoberta(projetado);
  }, [estado, grafoVisivel, anunciar]);

  /* ── O pulso da revelação (design §5.4, movimento 2) ───────────────── */
  const vistos = useRef(null);
  useEffect(() => {
    const agora = new Set(Object.keys(estado.nos));
    if (vistos.current === null) { vistos.current = agora; return undefined; }
    const novos = [...agora].filter((id) => !vistos.current.has(id));
    vistos.current = agora;
    if (novos.length === 0) return undefined;
    setRecemRevelados(novos);
    anunciarDescoberta(novos);
    const t = setTimeout(() => { if (vivo.current) setRecemRevelados([]); }, PISCA_DA_REVELACAO);
    return () => clearTimeout(t);
  }, [estado, anunciarDescoberta]);

  useEffect(() => { vistos.current = null; }, [instanciaId]);

  /* ════════════════════════════════════════════════════════════════════
   *  F6 · A PAUSA E A PENDÊNCIA  (AC-8 · briefing §9)
   *  ------------------------------------------------------------------
   *  A pausa mora em `party.flags` — documento que o grupo LÊ, e que não
   *  guarda motivo nenhum. A pendência mora em `gm/estado` — documento que
   *  o grupo NÃO lê (as rules negam, e `useGmDaMesa` nem abre o listener
   *  para quem não é o mestre). São dois documentos porque são dois
   *  públicos, e é essa separação — não um filtro de render — que faz o
   *  jogador não descobrir que houve um encontro.
   * ══════════════════════════════════════════════════════════════════ */
  const pausada = viagemPausada(party);
  const pendencia = podeVerMolde && temPendencia(gm) ? gm.pendingEncounter : null;

  /* O diálogo abre sozinho quando a pendência chega, e NÃO volta sozinho
     depois de o mestre dizer "decidir depois" — a assinatura é o que
     distingue "pendência nova" de "o mesmo snapshot outra vez". */
  const adiada = useRef("");
  useEffect(() => { adiada.current = ""; }, [instanciaId]);
  const assinatura = assinaturaDaPendencia(pendencia);
  useEffect(() => {
    if (!assinatura) { setEncontroAberto(false); return; }
    if (adiada.current === assinatura) return;
    setEncontroAberto(true);
  }, [assinatura]);

  /** Liga/desliga a pausa no documento do grupo. Nunca grava o porquê. */
  const marcarPausa = useCallback(async (valor) => {
    const c = contexto.current;
    const flags = flagsComPausa(c.party?.flags, valor);
    if (!flags) return;
    try {
      await atualizarParty(c.campaignId, c.instanciaId, { flags });
    } catch (err) {
      console.error("[mesa do mapa] a pausa não foi gravada:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    }
  }, []);

  /**
   * O sorteio da estrada — **primeiro degrau** do briefing §9.
   *
   * Roda só no cliente do mestre, porque é ele quem tem o molde (e portanto o
   * `dangerLevel` da trilha) e é ele quem pode escrever em `gm/`. O resultado
   * NÃO vira nada visível: vira pendência, e a viagem para.
   *
   * A rolagem passa por `sorteioDeD100`, que é a ponte para `rollDice` de
   * `src/domain/dice.js` — o motor único do projeto (AC-9). `Math.random` entra
   * por parâmetro, e é o que os testes fixam.
   */
  const rolarEncontroDaEstrada = useCallback(async (v, relogioDaPartida, horas) => {
    const c = contexto.current;
    if (!c.podeVerMolde || !c.molde) return;
    /* Uma decisão de cada vez: sobrescrever uma pendência que o mestre ainda
       não leu apagaria conteúdo que ele nunca chegou a ver. */
    if (c.gm?.pendingEncounter) return;

    const trilha = listaDe(c.molde.trilhas).find((t) => t?.id === v.trilhaId);
    const periodo = periodoDe(relogioDaPartida);
    const sorteado = sortearEncontro(
      { dangerLevel: trilha?.dangerLevel, periodo, horas },
      sorteioDeD100(Math.random),
    );
    if (!sorteado.houve) return;

    /* ── A ESQUIVA  (spec 0035 · F3 · M6 · AC-13/14/15) ────────────────
       O mundo sorteou um encontro. Antes de ele acontecer, o grupo tenta
       passar sem ser notado: Furtividade contra a DT do perigo da trilha.

       A rolagem sai de `rollDice` — o motor único (AC-9) —, e o veredito de
       `model/esquiva.js`, que não rola nada. O bônus vem da melhor
       Furtividade das fichas compartilhadas; sem ficha, `bonusDaEsquiva`
       devolve o que o mestre digitou, e o comportamento é o de sempre.

       ⚠️ **O sucesso sai por `return`, exatamente como `!sorteado.houve`.**
       Não há pendência, não há pausa, não há documento — e é por isso que
       ele é indistinguível de "não houve sorteio". Gravar qualquer marca do
       encontro que não aconteceu ("esquivado em tal trilha") daria ao
       jogador o oráculo que a spec inteira existe para negar: o segredo não
       vaza pelo dado, vaza pela DIFERENÇA. */
    const daEsquiva = bonusDaEsquiva(c.fichas, 0);
    const rolagemDaEsquiva = rollDice("1d20");
    const esquiva = resultadoDaEsquiva(
      trilha?.dangerLevel,
      (rolagemDaEsquiva?.total ?? 0) + daEsquiva.bonus,
    );
    /* O anúncio é do MESTRE — a mesa inteira o vê no leitor de tela do
       cliente dele, e só dele. É o "Camellia: Falhou no teste de
       Furtividade" da referência, e não diz o que vinha vindo. */
    anunciar(`${PERICIA_DA_ESQUIVA}: ${esquiva.mensagem}`);
    if (esquiva.escapou) return;

    const nova = {
      ...montarPendencia({
        origem: "viagem",
        trilhaId: v.trilhaId,
        noId: v.paraId,
        periodo,
        chance: sorteado.chance,
        rolagem: sorteado.rolagem,
        sugestao: sugestaoDeEncontro(c.eventos, jaDisparados.current, Math.random()),
      }),
      /* O id da pendência (F7). É por ele que `resolverPendencia` sabe que a
         decisão que chegou é sobre ESTE encontro, e não sobre um que outra aba
         já resolveu. Sem ele, duas abas decidiriam o mesmo encontro duas vezes. */
      id: idDaPendencia(sessao),
    };

    /* A ORDEM IMPORTA. A pendência vai PRIMEIRO, a pausa depois: se a rede cair
       no meio, o pior caso é uma pendência sem pausa (o mestre a resolve e
       ninguém percebe), nunca uma pausa sem pendência (a mesa travada sem nada
       que a destrave).
       `reservarPendencia` é transação: com duas abas do mestre abertas, as duas
       sorteiam, mas só a primeira grava — a segunda desiste em silêncio, em vez
       de sobrescrever um encontro que o mestre ainda nem viu. */
    const reserva = await reservarPendencia(c.campaignId, c.instanciaId, nova);
    if (!reserva?.reservada) return;
    const flags = flagsComPausa(c.party?.flags, true);
    if (flags) await atualizarParty(c.campaignId, c.instanciaId, { flags });
  }, [sessao, anunciar]);

  /**
   * **O mestre decidiu** — terceiro degrau, e a única porta para o jogador.
   *
   * `decidirEncontro` é quem sabe o que publicar; aqui só se obedece:
   *  · aceitar → publica a projeção da sugestão (três chaves, nada mais);
   *  · trocar  → publica o que o mestre escreveu, com id derivado do relógio;
   *  · ignorar → `publicar` é `null`, e **nada é escrito**. Não há documento
   *    vazio, não há marca de "houve encontro aqui", não há nada. Retomar a
   *    viagem é a única coisa que o grupo percebe — e é a mesma coisa que ele
   *    percebe quando o mestre simplesmente pausou e despausou.
   */
  const decidirOEncontro = useCallback(async (decisao, substituto) => {
    const c = contexto.current;
    const atual = c.gm?.pendingEncounter;
    if (!atual) return;
    setFalha("");

    /* O substituto nasce sem id — quem o dá é o relógio de jogo, nunca um
       contador (ver `idDoEncontro`). */
    const alvo = decisao === "trocar" && substituto
      ? { ...substituto, id: idDoEncontro(relogioDe(c.party)) }
      : substituto;

    const r = decidirEncontro(atual, decisao, alvo);
    if (r.pendencia) return;                       // decisão desconhecida: nada feito

    try {
      setOcupado(true);

      /* ── REIVINDICAR ANTES DE PUBLICAR (F7) ───────────────────────
         A ordem é o contrário da intuição, e é de propósito. `resolverPendencia`
         é uma transação que só apaga a pendência se ela ainda for ESTA: quem
         reivindica primeiro vence, e a outra aba recebe `decidida:false` e vê o
         diálogo fechar — porque a pendência realmente já não existe.
         Publicar primeiro faria as duas abas publicarem o encontro antes de
         qualquer uma limpar a pendência, que é exatamente o defeito da F6. */
      const patchDoGm = {};
      if (decisao === "aceitar" && r.publicar?.id) {
        jaDisparados.current.add(r.publicar.id);
        patchDoGm.triggeredEventIds = [...jaDisparados.current];
      }
      const reivindicacao = await resolverPendencia(
        c.campaignId, c.instanciaId, String(atual.id || ""), patchDoGm,
      );
      if (!reivindicacao?.decidida) {
        if (vivo.current) setEncontroAberto(false);
        anunciar("Este encontro já foi resolvido em outra tela.");
        return;
      }

      if (r.publicar) {
        try {
          await publicarRevelacao(
            c.campaignId, c.instanciaId, { eventos: [r.publicar] }, { existentes: c.revelado },
          );
        } catch (err) {
          /* Reivindicou e não conseguiu publicar: devolve a pendência ao lugar.
             Sem isto, o encontro sumiria da fila do mestre sem nunca ter chegado
             à mesa — a pior das duas falhas possíveis. */
          await atualizarGm(c.campaignId, c.instanciaId, {
            pendingEncounter: reivindicacao.pendencia || atual,
          }).catch(() => {});
          throw err;
        }
      }

      const flags = flagsComPausa(c.party?.flags, false);
      if (flags) await atualizarParty(c.campaignId, c.instanciaId, { flags });

      if (vivo.current) setEncontroAberto(false);
      anunciar(anuncioDaDecisao(decisao, r.publicar || atual.sugestao));
    } catch (err) {
      console.error("[mesa do mapa] a decisão do encontro não foi gravada:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    } finally {
      if (vivo.current) setOcupado(false);
    }
  }, [anunciar]);

  /**
   * Acampar (F6). O relógio anda, a comida cai e a emboscada — se houver —
   * segue **exatamente o mesmo caminho de duas etapas** do encontro da estrada:
   * `acampar` já devolve pendência, nunca documento de jogador.
   */
  const acamparAgora = useCallback(async (horas) => {
    const c = contexto.current;
    if (!c.podeVerMolde) return;
    setFalha("");

    const periodo = periodoDe(relogioDe(c.party));
    const r = acampar({
      party: c.party,
      horas,
      consumoPorDia: consumoPorDia(c.party),
      sorteio: sorteioDeD100(Math.random),
      chanceDeEmboscada: chanceDeEncontro({ dangerLevel: perigoDaRegiao(c.party), periodo, horas }),
      sugestao: sugestaoDeEncontro(c.eventos, jaDisparados.current, Math.random()),
    });

    try {
      setOcupado(true);
      const patch = { inGameDatetime: r.relogio };
      /* Mesa que não conta comida continua sem contar: `acampar` devolve
         `restante: 0` para um estoque ausente, e gravar esse zero inventaria
         uma despensa vazia onde não havia despensa nenhuma. */
      if (Number.isFinite(c.party?.supplies)) patch.supplies = r.suprimentos.restante;
      if (r.emboscada) {
        const flags = flagsComPausa(c.party?.flags, true);
        if (flags) patch.flags = flags;
      }
      await atualizarParty(c.campaignId, c.instanciaId, patch);
      if (r.emboscada) {
        /* Mesmo caminho do encontro da estrada: pendência com id, reservada por
           transação. Acampar com duas abas abertas não põe duas emboscadas. */
        await reservarPendencia(c.campaignId, c.instanciaId, {
          ...r.emboscada, id: idDaPendencia(sessao),
        });
      }

      if (vivo.current) {
        setResultadoDoAcampamento({
          suprimentos: r.suprimentos,
          descanso: descansoRecuperado({ horas }),
        });
      }
      /* O anúncio fala do TEMPO, nunca da emboscada — ele é lido em voz alta
         numa mesa presencial, e "vocês acamparam" é tudo que cabe aí. */
      anunciar(`O grupo acampou por ${horas} horas.`);
    } catch (err) {
      console.error("[mesa do mapa] o acampamento não foi gravado:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    } finally {
      if (vivo.current) setOcupado(false);
    }
  }, [anunciar, sessao]);

  /** O perigo da região, guardado nas bandeiras do grupo (só o mestre grava). */
  const ajustarPerigo = useCallback(async (valor) => {
    const c = contexto.current;
    const base = c.party?.flags && typeof c.party.flags === "object" && !Array.isArray(c.party.flags)
      ? c.party.flags
      : {};
    const n = Math.max(0, Math.min(5, Math.round(valor)));
    if (base[MARCA_DO_PERIGO] === n) return;
    try {
      await atualizarParty(c.campaignId, c.instanciaId, { flags: { ...base, [MARCA_DO_PERIGO]: n } });
    } catch (err) {
      console.error("[mesa do mapa] o perigo da região não foi gravado:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    }
  }, []);

  /* ════════════════════════════════════════════════════════════════════
   *  OS EVENTOS  (F5 · AC-1, AC-8)
   *  ------------------------------------------------------------------
   *  Só o cliente do MESTRE roda daqui para baixo — é o único que lê o
   *  molde, e portanto o único que pode saber que existe um evento antes
   *  de ele acontecer (design §3). O jogador recebe o resultado pelos
   *  documentos de `revealed/`, que é exatamente o que ele pode ver.
   * ══════════════════════════════════════════════════════════════════ */

  /**
   * Aplica uma lista de disparos: revela o que eles revelam, publica o texto
   * público, marca os ids em `gm` e acende as marcas no grupo.
   *
   * A ORDEM É PROPOSITAL. As revelações e o texto do evento vão numa escrita
   * só (`publicarRevelacao` é lote), e só DEPOIS o id entra em
   * `triggeredEventIds`. Se a rede cair no meio, o evento fica por disparar e
   * sai de novo no próximo passo — repetir uma cena é recuperável; perdê-la
   * porque o "já disparou" foi gravado antes do conteúdo, não é.
   *
   * @param {Array<{evento:object, motivo:string}>} disparos
   * @param {object} estadoBase estado de visibilidade a partir do qual revelar.
   */
  const aplicarDisparos = useCallback(async (disparos, estadoBase) => {
    const c = contexto.current;
    if (!c.podeVerMolde || !c.molde || disparos.length === 0) return;

    let corrente = estadoBase || c.estado;
    const nosPub = [];
    const trilhasPub = [];
    const marcas = [];

    disparos.forEach(({ evento }) => {
      const r = aplicarEvento(corrente, evento, c.molde);
      corrente = r.estado;
      r.nosAlterados.forEach(({ id, para }) => {
        const no = listaDe(c.molde.nos).find((n) => n?.id === id);
        if (no) nosPub.push({ no, state: para });
      });
      r.trilhasAlteradas.forEach(({ id, para }) => {
        const trilha = listaDe(c.molde.trilhas).find((t) => t?.id === id);
        if (trilha) trilhasPub.push({ trilha, state: para });
      });
      marcas.push(...r.flags);
    });

    try {
      setOcupado(true);

      /* `projecaoDoEvento` (model) devolve `{id,title,playerText}` — três
         campos escritos à mão. O store reprojeta por lista branca de novo antes
         de gravar. Duas barreiras, e nenhuma delas é "tudo menos gmText". */
      await publicarRevelacao(c.campaignId, c.instanciaId, {
        nos: nosPub,
        trilhas: trilhasPub,
        eventos: disparos.map(({ evento }) => projecaoDoEvento(evento)).filter(Boolean),
      }, { existentes: c.revelado });

      disparos.forEach(({ evento }) => jaDisparados.current.add(evento.id));
      await atualizarGm(c.campaignId, c.instanciaId, {
        triggeredEventIds: [...jaDisparados.current],
      });

      /* As marcas NÃO voltam no estado de visibilidade: elas moram em
         `party.flags` (design §3), e é de lá que o gatilho `flag` as lê. */
      const flags = flagsComAsNovas(c.party?.flags, marcas);
      if (flags) await atualizarParty(c.campaignId, c.instanciaId, { flags });

      anunciar(anuncioDoEvento(disparos.map(({ evento }) => evento)));
    } catch (err) {
      console.error("[mesa do mapa] o evento não pôde ser publicado:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    } finally {
      if (vivo.current) setOcupado(false);
    }
  }, [anunciar]);

  /**
   * Um passo do grupo: quais eventos disparam agora?
   *
   * O contexto sai de `contextoDoPasso` — inclusive o `grafo`, sem o qual a
   * proximidade **não dispara** (o modelo falha fechado de propósito). O
   * `sorteio` é `Math.random` e entra por parâmetro: `model/eventos.js` não
   * sorteia nada, e é isso que deixa a mesa reproduzível no teste.
   */
  const avaliarNoPasso = useCallback(async (passo, estadoBase) => {
    const c = contexto.current;
    if (!c.podeVerMolde || !c.molde) return;
    const disparos = avaliarGatilhos(
      c.eventos,
      contextoDoPasso(passo, { molde: c.molde, party: c.party, sorteio: Math.random }),
      jaDisparados.current,
    );
    if (disparos.length > 0) await aplicarDisparos(disparos, estadoBase);
  }, [aplicarDisparos]);

  /** O mestre solta um evento na mesa, de qualquer gatilho (AC-8). */
  const dispararAMao = useCallback(async (evento) => {
    const saida = dispararManualmente(evento);
    if (!saida) return;
    setFalha("");
    await aplicarDisparos([saida], contexto.current.estado);
  }, [aplicarDisparos]);

  /**
   * O mestre resolve o teste de um evento `on_check` (AC-9).
   *
   * A rolagem é `rollDice` de `src/domain/dice.js` — o motor único do projeto.
   * O fracasso não publica nada e não diz nada ao grupo: um evento que não
   * aconteceu não pode deixar rastro, senão o rastro vira o aviso de que havia
   * algo ali.
   */
  const resolverTesteDoEvento = useCallback(async (evento, bonus = 0) => {
    const cd = evento?.triggerConfig?.check?.dc;
    if (!Number.isFinite(cd)) return;
    const rolagem = rollDice("1d20");
    const total = (rolagem?.total ?? 0) + (Number.isFinite(bonus) ? bonus : 0);
    const saida = dispararPorTeste(evento, total >= cd);
    const pericia = evento?.triggerConfig?.check?.skill || "o teste";
    anunciar(`${pericia}: ${total} contra CD ${cd}.`);
    if (saida) await aplicarDisparos([saida], contexto.current.estado);
  }, [aplicarDisparos, anunciar]);

  /* ════════════════════════════════════════════════════════════════════
   *  A PROCURA  (F5 · AC-9)
   *  ------------------------------------------------------------------
   *  A regra dura: o botão existe em TODO nó, e o fracasso responde a
   *  MESMA frase de um lugar onde não há nada. Por isso:
   *
   *   · `testesDisponiveis` só é chamado no cliente do MESTRE. É função do
   *     lado do molde e montar tela de jogador com ela seria vazar o mapa
   *     de segredos (o próprio JSDoc dela avisa);
   *   · o resultado sai de `resultadoDaDescoberta`, que devolve o MESMO
   *     objeto de duas chaves para "não achou" e "não havia nada";
   *   · o texto é publicado num documento de id FIXO (`ID_DA_PROCURA`),
   *     nos dois desfechos. Um documento por procura contaria quantas
   *     vezes o grupo procurou; um documento só quando acha contaria onde
   *     há segredo. Um documento fixo não conta nada.
   * ══════════════════════════════════════════════════════════════════ */
  const procurar = useCallback(async () => {
    const c = contexto.current;
    setFalha("");

    /* O JOGADOR não resolve: ele não lê o molde, e não há como validar a
       descoberta sem antes ler o segredo (design §3, alternativa descartada).
       A frase é a mesma em todo lugar do mapa — não diz nada sobre o lugar. */
    /* Onde o grupo está, sem depender de `noDoGrupo` — ele é calculado mais
       abaixo neste arquivo, e citá-lo aqui estouraria a zona morta do `const`
       na hora de montar as dependências deste callback. */
    const aqui = noExibido || c.party?.currentNodeId || null;

    if (!c.podeVerMolde || !c.molde || !aqui) {
      setResultadoDaProcura(PEDIDO_DE_PROCURA);
      anunciar(PEDIDO_DE_PROCURA);
      return;
    }

    setProcurando(true);
    try {
      const rolagem = rollDice("1d20");
      const total = rolagem?.total ?? 0;

      /* Todas as trilhas testáveis daqui, na ordem: a primeira que a rolagem
         vencer é a achada. Sem nenhuma, `resultadoDaDescoberta(null, …)` cai na
         mesma saída do fracasso — é o caminho do lugar sem segredo. */
      const candidatas = testesDisponiveis(c.estado, c.molde, aqui);
      const achada = candidatas.find((x) => resultadoDaDescoberta(x.trilha, total).sucesso) || null;
      const r = resultadoDaDescoberta(achada?.trilha || null, total);

      setResultadoDaProcura(r.mensagem);
      anunciar(r.mensagem);

      const revelacao = achada
        ? aplicarDescoberta(c.estado, c.molde, achada.trilhaId, true)
        : { mudou: false, nosAlterados: [], trilhasAlteradas: [] };

      const nos = revelacao.nosAlterados
        .map(({ id, para }) => ({ no: listaDe(c.molde.nos).find((n) => n?.id === id), state: para }))
        .filter((x) => x.no);
      const trilhas = revelacao.trilhasAlteradas
        .map(({ id, para }) => ({ trilha: listaDe(c.molde.trilhas).find((t) => t?.id === id), state: para }))
        .filter((x) => x.trilha);

      /* Uma escrita só, com o mesmo formato nos dois desfechos: o cartão da
         procura sempre, o que foi achado só quando houve. */
      await publicarRevelacao(c.campaignId, c.instanciaId, {
        nos,
        trilhas,
        eventos: [{ id: ID_DA_PROCURA, title: TITULO_DA_PROCURA, playerText: r.mensagem }],
      }, { existentes: c.revelado });
    } catch (err) {
      console.error("[mesa do mapa] a procura não pôde ser publicada:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    } finally {
      if (vivo.current) setProcurando(false);
    }
  }, [anunciar, noExibido]);

  /* Trocar de lugar apaga o resultado da procura anterior: deixá-lo na tela
     faria o grupo achar que a frase é sobre onde ele está agora. */
  useEffect(() => { setResultadoDaProcura(""); }, [noExibido, instanciaId]);

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

  /* ── O ANDAMENTO PERSISTIDO (F7 · AC-10) ──────────────────────────
     `party.viagem` é o percurso em curso. Quem viaja o grava; quem chega o
     apaga. É o que faz o recarregamento retomar de onde estava, o outro
     cliente concordar sobre onde o grupo está, e "acampar em trânsito"
     deixar de ser letra morta.
     O `progresso` é gravado por MARCO, nunca por quadro: escrever a cada
     `requestAnimationFrame` seria 60 escritas por segundo. */
  const viagemLocal = useRef({ id: "", ultimoMarco: 0, gravando: false });
  useEffect(() => { viagemLocal.current = { id: "", ultimoMarco: 0, gravando: false }; }, [instanciaId]);

  /** Grava o andamento, no máximo uma vez por `INTERVALO_DO_PROGRESSO_MS`. */
  const marcarProgresso = useCallback((v, opcoes = {}) => {
    const c = contexto.current;
    const estadoLocal = viagemLocal.current;
    if (!v || !estadoLocal.id || v.id !== estadoLocal.id) return;
    if (estadoLocal.gravando) return;

    const agora = Date.now();
    if (!opcoes.forcar && agora - estadoLocal.ultimoMarco < INTERVALO_DO_PROGRESSO_MS) return;
    estadoLocal.ultimoMarco = agora;
    estadoLocal.gravando = true;

    atualizarViagem(c.campaignId, c.instanciaId, projecaoDaViagem(v, {
      id: estadoLocal.id, iniciadaEm: v.iniciadaEm, porQuem: c.uid,
    }))
      .catch((err) => console.warn("[mesa do mapa] o andamento da viagem não foi gravado:", err))
      .finally(() => { estadoLocal.gravando = false; });
  }, []);

  /** Cada quadro: a névoa abre sobre o que já foi andado. "Aos pouquinhos." */
  const aoAndar = useCallback((v) => {
    mexerNaNevoa((m) => nevoaDaViagem(m, v, raioDaEstrada(raioDeChegada)));
    if (!v?.remoto) marcarProgresso(v);
  }, [mexerNaNevoa, raioDeChegada, marcarProgresso]);

  /** A chegada: AC-6 inteiro, mais o relógio, a comida e a publicação. */
  const aoChegar = useCallback(async (v) => {
    const c = contexto.current;
    setNoExibido(v.paraId);
    /* Esta tela não tem mais percurso em curso — o documento de `party.viagem`
       é fechado logo abaixo, e só pelo cliente do mestre (design §3). */
    viagemLocal.current.id = "";

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
      /* O período é o da PARTIDA, não o da chegada: o encontro acontece na
         estrada, e a estrada começou antes de o relógio andar. É a mesma
         escolha que `acampar` faz com a hora em que a fogueira foi acesa. */
      const relogioDaPartida = relogioDe(c.party);

      /* ── FECHAR A VIAGEM, UMA VEZ SÓ (F7) ─────────────────────────
         Duas abas do mestre podem ver a mesma chegada. `concluirViagem` é
         uma transação que confere o id do percurso gravado: quem chega
         primeiro apaga `party.viagem` e paga o preço da estrada; quem
         chega depois recebe `aplicou:false` e não adianta o relógio de
         novo. A REVELAÇÃO acima não depende disso de propósito — ela é
         idempotente, e perdê-la seria muito pior do que repeti-la. */
      const patch = {};
      if (horas > 0) {
        patch.inGameDatetime = avancarRelogio(relogioDe(c.party), horas);
        if (Number.isFinite(c.party?.supplies)) {
          patch.supplies = consumirSuprimentos(c.party.supplies, horas, consumoPorDia(c.party)).restante;
        }
      }
      const fecho = await concluirViagem(c.campaignId, c.instanciaId, String(v?.id || ""), patch);
      if (!fecho?.aplicou) return;   // outra tela já pagou esta estrada

      /* A névoa da estrada fecha a conta aqui: um flush CONSOLIDADO, que
         grava o bitmap inteiro e apaga os deltas daquela viagem. Durante o
         percurso o que saiu foram só deltas (AC-10). */
      await transmitirNevoa({ fim: true });

      /* ── Os gatilhos do passo (F5) ────────────────────────────────
         Uma avaliação só, com tudo que o passo produziu: o nó em que o
         grupo parou (`on_arrival`), a trilha que ele acabou de percorrer
         (`on_travel`), onde ele está (`on_proximity`) e as marcas que ele
         carrega (`flag`). Chamar duas vezes — uma na partida e outra na
         chegada — dobraria a chance de o mesmo evento sair repetido antes
         de `gm` voltar do servidor. */
      const parou = listaDe(c.molde.nos).find((n) => n?.id === v.paraId);
      await avaliarNoPasso({
        noId: v.paraId,
        trilhaId: v.trilhaId,
        posicao: parou ? { x: parou.x, y: parou.y } : v.posicao,
      }, r.estado);

      /* ── O ENCONTRO DA ESTRADA (F6 · AC-8) ────────────────────────
         Por último, e só no cliente do MESTRE: o sorteio sai daqui e
         para em `gm.pendingEncounter`. O jogador não recebe nada — nem
         a notícia de que houve sorteio. */
      await rolarEncontroDaEstrada(v, relogioDaPartida, horas);
    } catch (err) {
      console.error("[mesa do mapa] a chegada não pôde ser publicada:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    } finally {
      if (vivo.current) setOcupado(false);
    }
  }, [
    anunciar, grafoVisivel, mexerNaNevoa, raioDeChegada,
    avaliarNoPasso, rolarEncontroDaEstrada, transmitirNevoa,
  ]);

  const viagemCtl = useViagem({
    aoAndar,
    aoChegar,
    aoFalhar: (mensagem) => setAviso(mensagem),
  });
  const { viagem, viajando, emTransito, comecar, pausar, retomar } = viagemCtl;

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
  /* A outra metade da rota bicolor (spec 0035 · AC-1). Fora de viagem é vazia:
     sem viagem não há "o que falta", e uma lista vazia não pinta nada. */
  const rotaRestante = useMemo(() => (viagem ? trechoRestante(viagem) : []), [viagem]);

  /* ════════════════════════════════════════════════════════════════════
   *  RETOMAR A VIAGEM  (F7 · AC-10)
   *  ------------------------------------------------------------------
   *  Uma porta para três situações que antes eram três comportamentos
   *  diferentes (e duas delas simplesmente não existiam):
   *
   *   1. **F5 no meio da estrada.** `party.viagem` está lá, com o
   *      progresso do último marco: a mesa recomeça o percurso de onde
   *      estava, em vez de teleportar o grupo ou refazer o trecho todo.
   *   2. **O outro cliente partiu.** O mesmo documento diz por qual
   *      trilha — antes cada cliente adivinhava um caminho a partir de
   *      `currentNodeId`, e dois clientes podiam animar estradas
   *      diferentes para o mesmo movimento.
   *   3. **Sem estado de viagem** (mesa antiga, ou movimento à força do
   *      mestre): cai no comportamento da F4, que é reconstruir o
   *      percurso pelo destino.
   *
   *  `tratada` é o que impede o eco da nossa própria partida de virar uma
   *  segunda viagem: ele guarda o id do percurso que esta tela já assumiu.
   * ══════════════════════════════════════════════════════════════════ */
  const tratada = useRef("");
  useEffect(() => { tratada.current = ""; }, [instanciaId]);

  useEffect(() => {
    if (viajando || viagem) return;          // já há percurso nesta tela

    const emCurso = party?.viagem;
    if (emCurso?.deId && emCurso?.paraId) {
      const idDela = String(emCurso.id || "");
      if (tratada.current === idDela) return;
      tratada.current = idDela;
      /* Só quem PARTIU grava o andamento. Retomando a própria viagem depois de
         um F5, esta tela volta a ser dona do marco; acompanhando a viagem de
         outra pessoa, ela só anima — senão os dois clientes gravariam o mesmo
         progresso duas vezes, com números ligeiramente diferentes. */
      const meu = !!uid && emCurso.porQuem === uid;
      viagemLocal.current = { id: meu ? idDela : "", ultimoMarco: Date.now(), gravando: false };
      const ok = comecar(grafoDeNavegacao, emCurso.deId, emCurso.paraId, undefined, {
        remoto: !meu,
        id: idDela,
        progresso: Number.isFinite(emCurso.progresso) ? emCurso.progresso : 0,
        iniciadaEm: emCurso.iniciadaEm,
      });
      if (!ok) setNoExibido(emCurso.paraId); // a trilha não é conhecida aqui: salta
      return;
    }

    const alvo = party?.currentNodeId || null;
    if (!alvo) return;
    if (noExibido === alvo) return;
    if (!noExibido) { setNoExibido(alvo); return; }   // primeira carga: sem percurso
    const ok = comecar(grafoDeNavegacao, noExibido, alvo, undefined, { remoto: true });
    if (!ok) setNoExibido(alvo);                       // sem trilha conhecida: salta
  }, [party?.currentNodeId, party?.viagem, viajando, viagem, noExibido, comecar, grafoDeNavegacao, uid]);

  /* ── A PAUSA PARA O MARCADOR NO MEIO DA ESTRADA (F7) ───────────────
     Até a F6 a pausa só recusava viagens NOVAS; quem já estava andando
     chegava assim mesmo, e "acampar em trânsito" (`podeAcampar`) nunca era
     verdade fora dos poucos segundos da animação. Agora o grupo para onde
     está, o andamento é gravado, e o acampamento passa a fazer sentido. */
  useEffect(() => {
    if (pausada && viajando) {
      pausar();
      if (viagem) marcarProgresso(viagem, { forcar: true });
      return;
    }
    if (!pausada && emTransito) retomar();
  }, [pausada, viajando, emTransito, viagem, pausar, retomar, marcarProgresso]);

  /* ── Viajar (AC-8) ─────────────────────────────────────────────────── */
  const destinos = useMemo(
    () => (noDoGrupo ? destinosPossiveis(estado, grafoDeNavegacao, noDoGrupo) : []),
    [estado, grafoDeNavegacao, noDoGrupo],
  );

  /**
   * Grava o movimento — e, quando há percurso, o **estado da viagem** (F7).
   *
   * Os dois vão na MESMA escrita de propósito: o destino e o caminho que leva
   * até ele são o mesmo fato. Gravados separados, o outro cliente veria por um
   * instante um grupo que já chegou sem ter andado.
   */
  const gravarMovimento = useCallback(async (noId, posicao, viagemEmCurso) => {
    try {
      await moverGrupo(campaignId, instanciaId, {
        nodeId: noId,
        x: Number.isFinite(posicao?.x) ? posicao.x : 0,
        y: Number.isFinite(posicao?.y) ? posicao.y : 0,
        quem: uid,
        viagem: viagemEmCurso === undefined ? undefined : (viagemEmCurso || null),
      });
    } catch (err) {
      console.error("[mesa do mapa] o movimento do grupo não foi gravado:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    }
  }, [campaignId, instanciaId, uid]);

  /**
   * Começa um percurso NESTA tela e o registra na mesa.
   *
   * O id da viagem carrega o relógio e a sessão da aba: é ele que
   * `concluirViagem` confere para a chegada acontecer uma vez só, e é ele que
   * `tratada` usa para não reagir ao eco da própria partida.
   */
  const iniciarPercurso = useCallback((grafo, deId, paraId, trilha, extra = {}) => {
    const id = `${Date.now().toString(36)}_${sessao}`;
    const iniciadaEm = Date.now();
    tratada.current = id;
    viagemLocal.current = { id, ultimoMarco: iniciadaEm, gravando: false };

    const ok = comecar(grafo, deId, paraId, trilha, { ...extra, id, iniciadaEm, porQuem: uid });
    if (!ok) {
      tratada.current = "";
      viagemLocal.current.id = "";
      return null;
    }
    return projecaoDaViagem(
      {
        deId,
        paraId,
        trilhaId: trilha?.id || null,
        horas: trilha?.travelHours,
        progresso: 0,
      },
      { id, iniciadaEm, porQuem: uid },
    );
  }, [comecar, sessao, uid]);

  const viajar = useCallback((destino) => {
    if (!destino?.noId || viajando || !noDoGrupo) return;
    /* Viagem parada é viagem parada, para os dois papéis. A recusa usa a MESMA
       frase que o grupo já lê no painel — nada aqui explica o motivo. */
    if (pausada) { setAviso(TEXTO_DA_PAUSA); anunciar(TEXTO_DA_PAUSA); return; }
    setAviso("");
    const r = podeViajarPara(estado, grafoDeNavegacao, noDoGrupo, destino.noId);
    if (!r.ok) { setAviso(r.motivo); anunciar(r.motivo); return; }

    const alvo = listaDe(grafoDeNavegacao?.nos).find((n) => n?.id === destino.noId);
    const ritmo = Number.isFinite(party?.speedModifier) ? party.speedModifier : 1;

    /* O anúncio da partida vem ANTES de `comecar`: com movimento reduzido a
       viagem é instantânea e o `aoChegar` dispara ainda dentro desta linha —
       anunciar depois apagaria a chegada com a partida. */
    anunciar(`O grupo partiu para ${nomeNaMesa(alvo)}.`);
    const percurso = iniciarPercurso(grafoDeNavegacao, noDoGrupo, destino.noId, r.trilha, { ritmo });
    if (!percurso) return;

    /* O movimento é gravado NA PARTIDA: assim o outro cliente anima junto, em
       vez de o grupo teleportar quando a viagem daqui termina. Desde a F7 vai
       junto o percurso (`party.viagem`), que é o que permite ao outro cliente
       animar a MESMA estrada e ao recarregamento retomar de onde parou. */
    gravarMovimento(destino.noId, { x: alvo?.x, y: alvo?.y }, percurso);
  }, [
    viajando, pausada, noDoGrupo, estado, grafoDeNavegacao, iniciarPercurso,
    party?.speedModifier, anunciar, gravarMovimento,
  ]);

  /* ── Mover à força: o mestre conduz a mesa ─────────────────────────── */
  const moverPara = useCallback((noId) => {
    if (!podeVerMolde || !noId || viajando) return;
    const alvo = listaDe(molde?.nos).find((n) => n?.id === noId);
    if (!alvo) return;
    setAviso("");
    /* Com trilha no molde (mesmo secreta ou oculta), o grupo ANDA — o mestre
       conduzindo continua sendo viagem. Sem trilha, ele salta: é a mão do
       mestre, e fingir uma estrada que não existe seria pior. */
    const trilha = noDoGrupo
      ? listaDe(molde?.trilhas).find((t) => {
        const de = t?.fromNodeId ?? t?.fromId;
        const para = t?.toNodeId ?? t?.toId;
        return (de === noDoGrupo && para === noId) || (de === noId && para === noDoGrupo);
      })
      : null;
    const percurso = noDoGrupo
      ? iniciarPercurso(molde, noDoGrupo, noId, trilha, { ritmo: 1 })
      : null;
    if (!percurso) {
      setNoExibido(noId);
      if (mascara) mexerNaNevoa((m) => revelarCirculo(m, alvo.x, alvo.y, raioDeChegada));
      anunciar(`O mestre levou o grupo para ${nomeNaMesa(alvo)}.`);
      /* Salto do mestre: não há estrada, logo não há viagem em curso. O `null`
         explícito apaga um percurso anterior em vez de deixá-lo pendurado. */
      gravarMovimento(noId, { x: alvo.x, y: alvo.y }, null);
      return;
    }
    gravarMovimento(noId, { x: alvo.x, y: alvo.y }, percurso);
  }, [
    podeVerMolde, viajando, molde, noDoGrupo, iniciarPercurso, mascara,
    mexerNaNevoa, raioDeChegada, anunciar, gravarMovimento,
  ]);

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
      /* A revelação manual é ato humano, esparso: consolidar aqui é barato e
         deixa a mesa em dia para quem entrar agora. Durante a VIAGEM é que
         nunca se grava o bitmap inteiro (AC-10) — lá saem deltas. */
      if (mexeu && mascara) await transmitirNevoa({ fim: true });

      const resumo = resumoDaRevelacao(r.nosAlterados, r.trilhasAlteradas);
      anunciar(`Revelado para o grupo: ${resumo}.`);
    } catch (err) {
      console.error("[mesa do mapa] a revelação não foi publicada:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    } finally {
      if (vivo.current) setOcupado(false);
    }
  }, [
    podeVerMolde, molde, estado, campaignId, instanciaId, revelado,
    mexerNaNevoa, mascara, raioDeChegada, anunciar, transmitirNevoa,
  ]);

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
  /* O nó do MOLDE — `podeAcampar` lê `type`, e a projeção do jogador pode nem
     ter o nó ainda. Só o mestre monta este painel, então usar o molde aqui não
     é vazamento: é a fonte que ele já tem. */
  const noDoMoldeAtual = listaDe(molde?.nos).find((n) => n?.id === noDoGrupo) || noAtualDesenhado;
  const semMapa = !carregandoInstancias && instancias.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.x3, flex: 1, minHeight: 0, height: "100%" }}>
      <MesaStyles />

      {/* ── Cabeçalho ──────────────────────────────────────────────── */}
      {/* UMA LINHA, não um bloco de duas. O par título+subtítulo gastava 84 px no
          desktop e 134 px no celular (título em 3 linhas) para dizer duas coisas
          que cabem em 44. O papel virou chip ao lado do nome — para de competir
          com ele — e o sufixo "(cópia)" (encanamento do clone) sai do palco;
          ele continua na lista do ateliê, onde de fato distingue. */}
      <header style={{ display: "flex", alignItems: "center", gap: SP.x3, flexWrap: "nowrap", flexShrink: 0, minHeight: 40 }}>
        <div
          style={{
            fontFamily: FF.display, fontSize: FS.lead, color: "var(--gold2,var(--gold))",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1,
          }}
          title={instancia?.name || "Mapa-múndi"}
        >
          {(instancia?.name || "Mapa-múndi").replace(/\s*\(cópia\)\s*$/i, "")}
        </div>
        <span
          style={{
            ...T.section, flexShrink: 0, padding: "3px 9px",
            borderRadius: R.pill, border: `1px solid ${LINE.raise}`, whiteSpace: "nowrap",
          }}
        >
          {comoJogador ? "Visão do jogador" : "Visão do mestre"}
        </span>

        {instancias.length > 1 ? (
          <label className="wmm-focus" style={{ ...T.meta, display: "inline-flex", alignItems: "center", gap: SP.x2, flexShrink: 0 }}>
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
          <button type="button" className="wmm-acao" onClick={onSair} style={{ ...btnStyle("quiet", "sm"), flexShrink: 0 }}>
            ← Voltar
          </button>
        ) : null}
      </header>

      {/* ── O que o leitor de tela ouve (AC-8, AC-11) ───────────────── */}
      <p
        role="status"
        aria-live="polite"
        data-testid="wmm-anuncio"
        /* Continua SEMPRE no DOM com `aria-live` — quem some é a RESERVA de
           20 px (+12 de gap) quando não há anúncio nenhum a fazer. */
        style={{
          margin: 0, minHeight: anuncio ? 20 : 0, ...T.meta, flexShrink: 0,
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
          /* `stretch` + `flex:1`: a grade ocupa a altura que sobrou, e o palco
             cresce dentro dela. Antes era `alignItems:"start"` com o palco de
             560 px fixos — sobrava 130 px em 1920 e faltavam 140 em 1440.
             A coluna do painel encolhe até 300 px, não fica travada em 340. */
          style={{
            display: "grid",
            gridTemplateColumns: podeVerMolde ? "minmax(0,1fr) clamp(300px,24vw,380px)" : "minmax(0,1fr) 300px",
            gap: SP.x4, alignItems: "stretch", flex: 1, minHeight: 0,
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
            rotaRestante={rotaRestante}
            viajando={viajando}
            selecionadoId={selecionadoId}
            recemRevelados={recemRevelados}
            onClicarNo={aoClicarNo}
            altura={altura}
            destaque={espiando ? COR_DA_VISAO_DE_JOGADOR : null}
            /* F7 · movimento 5: o relógio CRU, não o normalizado. `null` (a
               mesa que ainda não tem hora corrida) tem de chegar como `null`
               para a tinta ficar neutra — ver `Mesa/animacaoUi.js`. */
            relogio={party?.inGameDatetime ?? null}
          />

          {/* O SCROLL MORA AQUI — e só aqui. Quatro dos cinco painéis do mestre
              tinham 0 px visíveis e só eram alcançáveis rolando o pai comum, que
              levava o mapa junto. Agora a coluna rola sozinha, com o palco parado. */}
          <div
            className="wmm-coluna"
            style={{
              display: "flex", flexDirection: "column", gap: SP.x3,
              minWidth: 0, minHeight: 0,
              overflowY: "auto", overflowX: "hidden",
              paddingRight: 6, paddingBottom: SP.x4, scrollbarGutter: "stable",
            }}
          >
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
                pausada={pausada}
                onPausar={marcarPausa}
                temEncontro={!!pendencia}
                onAbrirEncontro={() => setEncontroAberto(true)}
              />
            ) : null}

            {podeVerMolde ? (
              <Acampamento
                party={party}
                consumoPorDia={consumoPorDia(party)}
                /* "Em trânsito" agora é um estado de verdade (F7): o grupo com
                   percurso em curso e o marcador parado no meio da estrada. Até
                   a F6 isto só era verdade durante os poucos segundos da
                   animação — a regra existia e nunca acontecia. */
                permissao={podeAcampar({ noAtual: noDoMoldeAtual, viajando: viajando || emTransito })}
                perigo={perigoDaRegiao(party)}
                onPerigo={ajustarPerigo}
                onAcampar={acamparAgora}
                resultado={resultadoDoAcampamento}
                ocupado={ocupado || viajando}
              />
            ) : null}

            {podeVerMolde ? (
              <FilaDeEventos
                eventos={eventos}
                disparados={listaDe(gm?.triggeredEventIds)}
                onDisparar={dispararAMao}
                onResolverTeste={resolverTesteDoEvento}
                onEntrarNaCena={onEntrarNaCena}
                ocupado={ocupado || viajando}
                carregando={eventosDoMolde.loading}
                bonusDaFicha={bonusDeFurtividade}
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
              pausada={pausada}
            />

            {/* O mural é do GRUPO: ele lê `revealed/`, nunca o molde. O mestre
                também o vê — é o que ele acabou de dar à mesa (AC-1). */}
            <EventosDoGrupo
              eventos={eventosPublicos}
              onProcurar={procurar}
              procurando={procurando}
              resultadoDaProcura={resultadoDaProcura}
              ocupado={viajando}
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

      {/* ── A DECISÃO DO MESTRE (F6 · AC-8) ──────────────────────────
          Montado só quando HÁ pendência — e a pendência só existe no
          cliente do mestre, porque o documento onde ela mora não é lido
          por mais ninguém. Não há aqui nenhum `if (isMaster)` protegendo
          segredo: o segredo é protegido pelas rules, e este `if` só evita
          desenhar um diálogo vazio. */}
      {pendencia && encontroAberto ? (
        <PainelDeEncontro
          titulo={pendencia.sugestao
            ? tituloDoEncontro(pendencia.sugestao)
            : "Nada preparado para este momento"}
          texto={pendencia.sugestao
            ? textoDoEncontro(pendencia.sugestao)
            : "Sua gaveta \"Na sua mão\" está vazia. Escreva o que acontece, ou ignore."}
          semSugestao={!pendencia.sugestao}
          chance={formatarChance(pendencia.chance)}
          rolagem={formatarRolagem(pendencia.rolagem)}
          contexto={contextoDaPendencia(pendencia, {
            nomeDoLugar: nomeNaMesa(listaDe(molde?.nos).find((n) => n?.id === pendencia.noId)),
          })}
          alternativas={nomesSugeridos(eventos, jaDisparados.current, pendencia.sugestao?.id)}
          onDecidir={decidirOEncontro}
          onAdiar={() => { adiada.current = assinatura; setEncontroAberto(false); }}
          ocupado={ocupado}
          falha={falha}
          anima={!semMovimento}
        />
      ) : null}

      {/* O CARTÃO DE DESCOBERTA (0035 · M5). Vem DEPOIS do painel do mestre
          na ordem do documento de propósito: se os dois abrirem no mesmo
          quadro, a decisão que trava a mesa é a que fica por cima. */}
      {cartaoDescoberta ? (
        <CartaoDeDescoberta
          no={cartaoDescoberta}
          onFechar={() => setCartaoDescoberta(null)}
          anima={!semMovimento}
        />
      ) : null}
    </div>
  );
}
