/* ════════════════════════════════════════════════════════════════════
 *  EDITOR VISUAL DO MAPA-MÚNDI  (spec 0028 · F2 · AC-4)
 *  --------------------------------------------------------------------
 *  O molde aberto no ateliê: plantar lugares, movê-los, ligá-los por
 *  trilhas curvas, e editar tudo que o design §3 guarda em `nodes` e
 *  `edges`.
 *
 *  ── QUEM FAZ O QUÊ ──────────────────────────────────────────────────
 *  · `model/graph.js` + `model/curves.js` — a matemática e as REGRAS.
 *    Autoligação, duplicata, remoção em cascata e hit-test vêm de lá.
 *    Nada disso é reimplementado aqui; este arquivo só mostra a recusa.
 *  · `worldMapStore.js` — o I/O. Nenhum `firebase/firestore` neste módulo.
 *  · `model/quotas.js` — o teto de nós do plano (AC-3).
 *  · `TelaDoMapa.jsx` — o render híbrido canvas/DOM (design §5.3).
 *  · aqui — orquestração: ferramenta ativa, seleção, otimismo local,
 *    debounce da gravação e as frases que o mestre lê.
 *
 *  ── OTIMISMO LOCAL E DEBOUNCE ───────────────────────────────────────
 *  Arrastar um lugar não pode gravar a cada pixel. A posição vive em
 *  estado local (`posicoes`) enquanto o mestre arrasta, o desenho segue o
 *  dedo, e o Firestore só recebe o valor final — depois de `ESPERA_DA_GRAVACAO`
 *  parado. A sobreposição local só é descartada quando a gravação confirma,
 *  senão o nó daria um pulo para trás no intervalo entre o `updateDoc` e o
 *  snapshot voltar.
 *
 *  ── O MAPA PADRÃO (AC-13) ───────────────────────────────────────────
 *  Ele NÃO mora no Firestore: é código (`model/mapaPadrao.js`), e a
 *  ilustração é vetorial (`model/CartografiaPadrao.jsx`). Aberto aqui, o
 *  editor lê o grafo do seed e entra em modo somente leitura — "cópia ao
 *  usar" é a regra do AC-13, e mexer no original não pode ser possível.
 *  Um mapa do usuário CLONADO do padrão (marca `origem`) continua usando a
 *  mesma carta vetorial enquanto o mestre não subir arte própria.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useMapCamera from "../../../hooks/useMapCamera";
import {
  useGrafo, createNode, updateNode, deleteNode,
  createEdge, updateEdge, deleteEdge, updateWorldMap,
  useEventos, createEvent, updateEvent, deleteEvent,
} from "../worldMapStore";
import { getGatilho } from "../model/eventos";
import { useFog, useSalvarFog } from "../fogStore";
import {
  cobrirAoLongoDe, cobrirTudo, fracaoRevelada, mascaraParaOMundo,
  revelarAoLongoDe, revelarTudo, tamanhoSerializado,
} from "../model/fogMask";
import { canAddNode } from "../model/quotas";
import { limitesDoGrafo, pontasDaTrilha, trilhaDuplicada, vizinhos } from "../model/graph";
import { construirMapaPadrao, ehMapaPadrao } from "../model/mapaPadrao";
import CartografiaPadrao from "../model/CartografiaPadrao";
import EditorStyles from "./EditorStyles";
import TelaDoMapa from "./TelaDoMapa";
import BarraDeFerramentas from "./BarraDeFerramentas";
import PainelDoNo from "./PainelDoNo";
import PainelDaTrilha from "./PainelDaTrilha";
import PainelDoEvento from "./PainelDoEvento";
import ConfirmarRemocao from "./ConfirmarRemocao";
import ControlesDaNevoa, { COR_DA_VISAO_DE_JOGADOR, RAIO_PADRAO } from "./ControlesDaNevoa";
import {
  FERRAMENTA_PADRAO, MUNDO_DE_RESERVA, ferramentaPorTecla, nomeDaTrilha,
  posicaoDoEvento, rotuloDoEvento, rotuloDoNo, usaCartografiaPadrao,
} from "./editorUi";
import { SP, R, FS, T, SURF, LINE, btnStyle, mensagemDeErro, DANGER_TEXT_AA } from "../Atelier/ui";

/** Quanto tempo o mestre precisa ficar parado antes de a posição ir ao banco. */
export const ESPERA_DA_GRAVACAO = 420;

/** Passo do empurrão por seta do teclado, em unidades de mundo. */
export const PASSO_DO_TECLADO = 6;

/* `usaCartografiaPadrao` e `MUNDO_DE_RESERVA` moram em `editorUi.js` — são
   lógica pura e precisam ser testáveis sem arrastar o Firebase junto. */

/**
 * @param {object} props
 * @param {string} props.uid dono do molde.
 * @param {object} props.molde documento do mapa-múndi aberto.
 * @param {string} [props.plan] plano do usuário — cota de nós (AC-3).
 * @param {string} [props.fundoUrl] ilustração já carregada pelo ateliê.
 * @param {Array<{id:string,name:string}>} [props.cenas] cenas táticas do mestre.
 * @param {()=>void} [props.onUsarComoBase] cria uma cópia editável do mapa padrão.
 * @param {number} [props.altura] altura do palco em px.
 * @param {boolean} [props.visaoDeJogador] o papel REAL de quem está olhando. No
 *   ateliê é sempre `false` (só o mestre entra aqui); a F4 passa `true` na mesa.
 *   Ver o cabeçalho de `ControlesDaNevoa.jsx`: este estado é separado da
 *   PREVISÃO do mestre, e os dois só se juntam no render.
 */
export default function EditorDoGrafo({
  uid,
  molde,
  plan = "free",
  fundoUrl = "",
  cenas = [],
  onUsarComoBase,
  altura = 560,
  visaoDeJogador = false,
}) {
  const moldeId = molde?.id || "";
  const ehPadrao = ehMapaPadrao(moldeId);

  /* ── Fonte do grafo ────────────────────────────────────────────────
     O padrão vem do seed (não existe no Firestore); o resto, das
     subcoleções. `useGrafo` é chamado sempre — com `mapId` nulo ele não
     assina nada, então não há hook condicional. */
  const remoto = useGrafo(ehPadrao ? "" : uid, ehPadrao ? "" : moldeId);
  const seed = useMemo(() => (ehPadrao ? construirMapaPadrao() : null), [ehPadrao]);

  const nosBrutos = ehPadrao ? seed.nos : remoto.nos;
  const trilhasBrutas = ehPadrao ? seed.trilhas : remoto.trilhas;
  const carregando = ehPadrao ? false : remoto.loading;

  /* Os eventos vivem numa subcoleção própria (F5). O mapa padrão não tem —
     ele é código, e um evento que não pode ser editado não serve de exemplo. */
  const eventosRemotos = useEventos(ehPadrao ? "" : uid, ehPadrao ? "" : moldeId);
  const eventos = eventosRemotos.eventos;

  /* ── Estado da edição ──────────────────────────────────────────────── */
  const [ferramenta, setFerramenta] = useState(FERRAMENTA_PADRAO);
  const [selecao, setSelecao] = useState(null);        // {tipo:'no'|'trilha', id}
  const [ligandoDe, setLigandoDe] = useState(null);
  const [posicoes, setPosicoes] = useState({});        // sobreposição otimista
  const [controles, setControles] = useState({});      // idem, para a curva
  const [recemCriadoId, setRecemCriadoId] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const [falha, setFalha] = useState("");
  const [aviso, setAviso] = useState("");
  const [imagemFundo, setImagemFundo] = useState(null);

  const temporizadores = useRef(new Map());
  const vivo = useRef(true);
  useEffect(() => () => {
    vivo.current = false;
    temporizadores.current.forEach((t) => clearTimeout(t));
    temporizadores.current.clear();
  }, []);

  const somenteLeitura = ehPadrao || !uid;

  /* ── Grafo com o otimismo local aplicado ───────────────────────────── */
  const nos = useMemo(() => (
    nosBrutos.map((n) => (posicoes[n.id] ? { ...n, ...posicoes[n.id] } : n))
  ), [nosBrutos, posicoes]);

  const trilhas = useMemo(() => (
    trilhasBrutas.map((t) => (controles[t.id] ? { ...t, pathPoints: [controles[t.id]] } : t))
  ), [trilhasBrutas, controles]);

  /* ── Câmera ────────────────────────────────────────────────────────── */
  const camera = useMapCamera({ initial: { scale: 0.5 } });
  const { fitToScreen, zoomAt, scale } = camera;

  const mundo = useMemo(() => {
    if (Number.isFinite(molde?.width) && molde.width > 0) {
      return { largura: molde.width, altura: molde.height || molde.width };
    }
    return MUNDO_DE_RESERVA;
  }, [molde?.width, molde?.height]);

  const enquadrar = useCallback(() => {
    const caixa = limitesDoGrafo(nos);
    /* Com nós, enquadra o que EXISTE (é o que o mestre quer ver); sem nós,
       enquadra a ilustração inteira, que é tudo o que há para olhar. */
    fitToScreen(caixa && caixa.largura > 0 ? caixa : mundo);
  }, [fitToScreen, nos, mundo]);

  /* Primeiro enquadramento: uma vez, quando o grafo chega. Refazer a cada
     mudança tiraria a câmera das mãos do mestre no meio do trabalho. */
  const jaEnquadrou = useRef(false);
  useEffect(() => {
    if (jaEnquadrou.current || carregando) return;
    jaEnquadrou.current = true;
    // Um quadro de folga: o container precisa ter sido medido.
    const t = setTimeout(enquadrar, 60);
    return () => clearTimeout(t);
  }, [carregando, enquadrar]);

  useEffect(() => { jaEnquadrou.current = false; }, [moldeId]);

  /* ── Ilustração de fundo ───────────────────────────────────────────── */
  const Cartografia = usaCartografiaPadrao(molde, !!fundoUrl) ? CartografiaPadrao : null;

  useEffect(() => {
    if (!fundoUrl || typeof Image === "undefined") { setImagemFundo(null); return undefined; }
    let ativo = true;
    const img = new Image();
    img.onload = () => { if (ativo) setImagemFundo(img); };
    img.onerror = () => {
      if (!ativo) return;
      setImagemFundo(null);
      console.warn("[editor do mapa] a ilustração de fundo não carregou.");
    };
    img.src = fundoUrl;
    return () => { ativo = false; };
  }, [fundoUrl]);

  /* ════════════════════════════════════════════════════════════════════
   *  NÉVOA  (F3 · AC-5)
   *  ------------------------------------------------------------------
   *  O mapa PADRÃO fica de fora: ele é somente leitura e não existe no
   *  Firestore (AC-13), então não há onde gravar máscara nenhuma. Oferecer
   *  um pincel que não persiste seria pior do que não oferecer.
   *
   *  A máscara vive em `useState` mas é MUTADA EM LUGAR pelas funções de
   *  `model/fogMask` (ver o cabeçalho de lá: copiar 30 KB por movimento do
   *  ponteiro seria desperdício). Quem avisa o React que ela mudou é
   *  `revisaoDaNevoa` — um contador, não a identidade do objeto.
   * ════════════════════════════════════════════════════════════════════ */
  const podeTerNevoa = !!uid && !ehPadrao;
  const [nevoaLocal, setNevoaLocal] = useState(null);   // otimismo do interruptor
  const nevoaLigada = podeTerNevoa
    && (nevoaLocal !== null ? nevoaLocal : molde?.fogEnabled === true);

  const fog = useFog(
    podeTerNevoa && nevoaLigada ? uid : "",
    podeTerNevoa && nevoaLigada ? moldeId : "",
  );
  const gravacaoDaNevoa = useSalvarFog(uid, moldeId);

  const [mascara, setMascara] = useState(null);
  const [revisaoDaNevoa, setRevisaoDaNevoa] = useState(0);
  const [modoDoPincel, setModoDoPincel] = useState("revelar");
  const [raioDoPincel, setRaioDoPincel] = useState(RAIO_PADRAO);
  const [previsaoDeJogador, setPrevisaoDeJogador] = useState(false);

  /* O otimismo do interruptor some assim que o documento confirma. */
  useEffect(() => {
    if (nevoaLocal !== null && molde?.fogEnabled === nevoaLocal) setNevoaLocal(null);
  }, [nevoaLocal, molde?.fogEnabled]);

  useEffect(() => { setNevoaLocal(null); setPrevisaoDeJogador(false); }, [moldeId]);

  /* Semeadura: a gravada, se couber no mundo atual; senão uma nova, coberta.
     A decisão mora em `mascaraParaOMundo` — trocar a ilustração por uma de
     outro tamanho não pode esticar o revelado para o lugar errado. */
  useEffect(() => {
    if (!nevoaLigada) { setMascara(null); return; }
    if (fog.loading) return;
    setMascara((atual) => mascaraParaOMundo(fog.mascara || atual, mundo));
    setRevisaoDaNevoa((r) => r + 1);
  }, [nevoaLigada, fog.mascara, fog.loading, mundo]);

  const comoJogador = visaoDeJogador || previsaoDeJogador;   // spec 0012: só no render
  const papelDaNevoa = comoJogador ? "jogador" : "mestre";

  const mexerNaNevoa = useCallback((aplicar) => {
    if (!mascara || somenteLeitura || !nevoaLigada) return;
    const antes = mascara.revisao;
    aplicar(mascara);
    if (mascara.revisao === antes) return;   // nada mudou: não repinta nem grava
    setRevisaoDaNevoa((r) => r + 1);
    gravacaoDaNevoa.agendar(mascara);
  }, [mascara, somenteLeitura, nevoaLigada, gravacaoDaNevoa]);

  const aoPincelar = useCallback((de, para) => {
    mexerNaNevoa((m) => {
      if (modoDoPincel === "cobrir") cobrirAoLongoDe(m, [de, para], raioDoPincel);
      else revelarAoLongoDe(m, [de, para], raioDoPincel);
    });
  }, [mexerNaNevoa, modoDoPincel, raioDoPincel]);

  const aoLigarNevoa = useCallback(async (ligar) => {
    if (somenteLeitura) return;
    setFalha(""); setAviso("");
    setNevoaLocal(ligar);
    if (!ligar) setPrevisaoDeJogador(false);
    try {
      if (typeof updateWorldMap === "function") {
        await updateWorldMap(uid, moldeId, { fogEnabled: ligar });
      }
    } catch (err) {
      console.error("[editor do mapa] não deu para mudar a névoa:", err);
      if (vivo.current) { setNevoaLocal(null); setFalha(mensagemDeErro(err)); }
    }
  }, [somenteLeitura, uid, moldeId]);

  /* O peso e a fração são recalculados só quando a névoa muda de verdade —
     serializar a cada render seria varrer 240.000 bits à toa. */
  const estadoDaNevoa = useMemo(() => {
    if (!mascara) return { fracao: 0, bytes: 0 };
    try { return { fracao: fracaoRevelada(mascara), bytes: tamanhoSerializado(mascara) }; }
    catch { return { fracao: 0, bytes: 0 }; }
  }, [mascara, revisaoDaNevoa]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cota (AC-3) ───────────────────────────────────────────────────── */
  const cota = useMemo(() => {
    try { return canAddNode(plan, nosBrutos.length); }
    catch { return { ok: true, limite: undefined, motivo: "" }; }
  }, [plan, nosBrutos.length]);

  /* ── Gravação com debounce ─────────────────────────────────────────── */
  const agendar = useCallback((chave, tarefa) => {
    const anterior = temporizadores.current.get(chave);
    if (anterior) clearTimeout(anterior);
    const t = setTimeout(() => {
      temporizadores.current.delete(chave);
      Promise.resolve()
        .then(tarefa)
        .catch((err) => {
          console.error("[editor do mapa] gravação falhou:", err);
          if (vivo.current) setFalha(mensagemDeErro(err));
        });
    }, ESPERA_DA_GRAVACAO);
    temporizadores.current.set(chave, t);
  }, []);

  const limpar = useCallback(() => { setFalha(""); setAviso(""); }, []);

  /** Zoom pelos botões: centrado no meio do palco, como a roda faria ali. */
  const zoomNoCentro = useCallback((fator) => {
    const r = camera.containerRef.current?.getBoundingClientRect?.();
    zoomAt((r?.width || 640) / 2, (r?.height || 420) / 2, fator);
  }, [camera, zoomAt]);

  /* ── Ações ─────────────────────────────────────────────────────────── */

  const plantarNo = useCallback(async (ponto) => {
    if (somenteLeitura) return;
    limpar();
    if (!cota.ok) {
      /* AC-3: o teto explica o limite e o caminho — nunca falha em silêncio. */
      setFalha(cota.motivo);
      return;
    }
    try {
      const id = await createNode(uid, moldeId, { x: ponto.x, y: ponto.y }, {
        plan,
        nodeCount: nosBrutos.length,
      });
      if (!vivo.current) return;
      setRecemCriadoId(id);
      setSelecao({ tipo: "no", id });
      setFerramenta("selecionar");
      setAviso("Lugar plantado. Dê um nome a ele no painel ao lado.");
    } catch (err) {
      console.error("[editor do mapa] não deu para plantar o nó:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    }
  }, [somenteLeitura, cota, uid, moldeId, plan, nosBrutos.length, limpar]);

  const ligar = useCallback(async (destinoId) => {
    if (somenteLeitura || !ligandoDe) return;
    limpar();
    const origem = ligandoDe;
    setLigandoDe(null);

    /* As duas recusas do AC-4 são checadas AQUI antes de gastar rede — e de
       novo no store, que é quem realmente protege o documento. Não é regra
       duplicada: as duas chamadas são as MESMAS funções puras de
       `model/graph.js`. O que muda é o momento — o mestre merece o "não" no
       mesmo instante do clique, não depois de uma ida ao servidor. */
    if (origem === destinoId) {
      setFalha("Uma trilha não pode ligar um lugar a ele mesmo. Escolha dois lugares diferentes.");
      return;
    }
    if (trilhaDuplicada(trilhasBrutas, { fromId: origem, toId: destinoId })) {
      setFalha("Já existe uma trilha ligando esses dois lugares. Edite a que existe em vez de criar outra.");
      return;
    }

    try {
      const id = await createEdge(uid, moldeId, { fromId: origem, toId: destinoId }, {
        trilhas: trilhasBrutas,
      });
      if (!vivo.current) return;
      setSelecao({ tipo: "trilha", id });
      setFerramenta("selecionar");
      setAviso("Trilha criada. Arraste o punho dourado para entortá-la.");
    } catch (err) {
      if (vivo.current) setFalha(err?.message || mensagemDeErro(err));
    }
  }, [somenteLeitura, ligandoDe, uid, moldeId, trilhasBrutas, limpar]);

  /**
   * Ancora um evento novo onde o mestre clicou (briefing §8).
   *
   * Nasce com o gatilho `manual` (padrão de `criarEvento`) — o único que não
   * dispara sozinho. Um evento meio escrito nunca pode surpreender a mesa, e
   * escolher o gatilho é a primeira coisa que o painel pede.
   */
  const ancorarEvento = useCallback(async (anchor) => {
    if (somenteLeitura) return;
    limpar();
    try {
      const id = await createEvent(uid, moldeId, { anchor });
      if (!vivo.current) return;
      setSelecao({ tipo: "evento", id });
      setFerramenta("selecionar");
      setAviso("Evento ancorado. Escolha o gatilho e escreva os dois textos no painel ao lado.");
    } catch (err) {
      console.error("[editor do mapa] não deu para ancorar o evento:", err);
      if (vivo.current) setFalha(mensagemDeErro(err));
    }
  }, [somenteLeitura, uid, moldeId, limpar]);

  const aoClicarNo = useCallback((no) => {
    limpar();
    if (ferramenta === "trilha" && !somenteLeitura) {
      if (!ligandoDe) { setLigandoDe(no.id); setSelecao({ tipo: "no", id: no.id }); return; }
      ligar(no.id);
      return;
    }
    if (ferramenta === "evento" && !somenteLeitura) {
      ancorarEvento({ type: "node", refId: no.id });
      return;
    }
    setSelecao({ tipo: "no", id: no.id });
  }, [ferramenta, somenteLeitura, ligandoDe, ligar, ancorarEvento, limpar]);

  const aoClicarVazio = useCallback((ponto) => {
    limpar();
    if (ferramenta === "no") { plantarNo(ponto); return; }
    if (ferramenta === "evento" && !somenteLeitura) {
      ancorarEvento({ type: "point", x: ponto.x, y: ponto.y });
      return;
    }
    if (ligandoDe) { setLigandoDe(null); setAviso("Trilha cancelada."); return; }
    setSelecao(null);
  }, [ferramenta, somenteLeitura, ligandoDe, plantarNo, ancorarEvento, limpar]);

  const aoClicarTrilha = useCallback((trilha) => {
    limpar();
    if (ferramenta === "evento" && !somenteLeitura) {
      ancorarEvento({ type: "edge", refId: trilha.id });
      return;
    }
    setSelecao({ tipo: "trilha", id: trilha.id });
  }, [ferramenta, somenteLeitura, ancorarEvento, limpar]);

  /* Arraste: a posição só existe em estado local até o dedo parar. */
  const aoArrastarNo = useCallback((noId, ponto) => {
    setPosicoes((p) => ({ ...p, [noId]: ponto }));
  }, []);

  const aoSoltarNo = useCallback((noId, ponto) => {
    if (somenteLeitura) return;
    agendar(`no:${noId}`, async () => {
      await updateNode(uid, moldeId, noId, { x: ponto.x, y: ponto.y });
      if (!vivo.current) return;
      setPosicoes((p) => { const { [noId]: _, ...resto } = p; return resto; });
    });
  }, [somenteLeitura, agendar, uid, moldeId]);

  const aoCurvarTrilha = useCallback((trilhaId, ponto) => {
    setControles((c) => ({ ...c, [trilhaId]: ponto }));
  }, []);

  const aoSoltarCurva = useCallback((trilhaId, ponto) => {
    if (somenteLeitura) return;
    agendar(`trilha:${trilhaId}`, async () => {
      await updateEdge(uid, moldeId, trilhaId, { pathPoints: [{ x: ponto.x, y: ponto.y }] });
      if (!vivo.current) return;
      setControles((c) => { const { [trilhaId]: _, ...resto } = c; return resto; });
    });
  }, [somenteLeitura, agendar, uid, moldeId]);

  /* ── Seleção resolvida ─────────────────────────────────────────────── */
  const noSelecionado = selecao?.tipo === "no" ? nos.find((n) => n.id === selecao.id) : null;
  const trilhaSelecionada = selecao?.tipo === "trilha" ? trilhas.find((t) => t.id === selecao.id) : null;
  const eventoSelecionado = selecao?.tipo === "evento" ? eventos.find((e) => e.id === selecao.id) : null;

  /* Seleção que sumiu (apagada em outra aba) não pode deixar painel fantasma. */
  useEffect(() => {
    if (!selecao) return;
    const colecao = selecao.tipo === "no" ? nosBrutos
      : selecao.tipo === "trilha" ? trilhasBrutas
        : eventos;
    const existe = colecao.some((x) => x.id === selecao.id);
    /* O evento acabou de ser criado e o snapshot ainda não voltou: esperar o
       `loading` dele evita o painel piscar e fechar sozinho. */
    const aindaChegando = selecao.tipo === "evento" ? eventosRemotos.loading : carregando;
    if (!existe && !aindaChegando) setSelecao(null);
  }, [selecao, nosBrutos, trilhasBrutas, eventos, carregando, eventosRemotos.loading]);

  /* ── Selos de evento no palco ──────────────────────────────────────
     A âncora vira pixel aqui, não na tela: `posicaoDoEvento` é pura e tem
     teste próprio. Evento de âncora órfã não ganha selo (o painel acusa). */
  const marcadoresDeEvento = useMemo(() => (
    eventos.reduce((saida, ev) => {
      const p = posicaoDoEvento(ev, { nos, trilhas });
      if (!p) return saida;
      saida.push({
        id: ev.id,
        x: p.x,
        y: p.y,
        titulo: (ev.title || "").trim() || "Evento sem título",
        rotulo: rotuloDoEvento(ev, { nos, trilhas }, getGatilho(ev.trigger)?.label),
        secreto: !!(ev.gmText || "").trim(),
      });
      return saida;
    }, [])
  ), [eventos, nos, trilhas]);

  /* ── Remoção ───────────────────────────────────────────────────────── */
  const pedirRemocao = useCallback(() => {
    if (somenteLeitura || !selecao) return;
    limpar();
    if (selecao.tipo === "no") {
      const no = nosBrutos.find((n) => n.id === selecao.id);
      if (!no) return;
      const ligadas = vizinhos({ nos: nosBrutos, trilhas: trilhasBrutas }, no.id).length;
      setConfirmando({
        titulo: "Apagar este lugar?",
        rotulo: "Apagar lugar",
        descricao: (
          <>
            <strong style={{ color: "var(--text)" }}>{no.name || "Este lugar"}</strong> some do mapa
            {ligadas > 0 ? (
              <>
                {" "}e leva junto{" "}
                <strong style={{ color: DANGER_TEXT_AA }}>
                  {ligadas === 1 ? "1 trilha" : `${ligadas} trilhas`}
                </strong>{" "}
                que chegam nele — trilha sem as duas pontas não pode existir.
              </>
            ) : null}
            . Não dá para desfazer.
          </>
        ),
        executar: async () => {
          await deleteNode(uid, moldeId, no.id, {
            trilhas: trilhasBrutas,
            nodeCount: nosBrutos.length,
          });
          if (!vivo.current) return;
          setConfirmando(null);
          setSelecao(null);
          setAviso(`"${no.name || "Lugar"}" apagado.`);
        },
      });
      return;
    }

    if (selecao.tipo === "evento") {
      const ev = eventos.find((e) => e.id === selecao.id);
      if (!ev) return;
      setConfirmando({
        titulo: "Apagar este evento?",
        rotulo: "Apagar evento",
        descricao: (
          <>
            O evento <strong style={{ color: "var(--text)" }}>{(ev.title || "").trim() || "sem título"}</strong>{" "}
            some do mapa, com os dois textos. Os lugares e as trilhas continuam onde estão.
            Não dá para desfazer.
          </>
        ),
        executar: async () => {
          await deleteEvent(uid, moldeId, ev.id);
          if (!vivo.current) return;
          setConfirmando(null);
          setSelecao(null);
          setAviso("Evento apagado.");
        },
      });
      return;
    }

    const trilha = trilhasBrutas.find((t) => t.id === selecao.id);
    if (!trilha) return;
    setConfirmando({
      titulo: "Apagar esta trilha?",
      rotulo: "Apagar trilha",
      descricao: (
        <>
          A trilha <strong style={{ color: "var(--text)" }}>{nomeDaTrilha(trilha, nos)}</strong> some.
          Os dois lugares continuam onde estão.
        </>
      ),
      executar: async () => {
        await deleteEdge(uid, moldeId, trilha.id);
        if (!vivo.current) return;
        setConfirmando(null);
        setSelecao(null);
        setAviso("Trilha apagada.");
      },
    });
  }, [somenteLeitura, selecao, nosBrutos, trilhasBrutas, eventos, nos, uid, moldeId, limpar]);

  /* ── Teclado ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e) => {
      const alvo = e.target;
      /* Digitar "n" num campo de texto não pode trocar de ferramenta. */
      if (alvo && typeof alvo.closest === "function"
        && alvo.closest("input,textarea,select,[contenteditable='true']")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Escape") {
        if (ligandoDe) { setLigandoDe(null); setAviso("Trilha cancelada."); e.preventDefault(); return; }
        if (selecao) { setSelecao(null); e.preventDefault(); }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selecao) {
        e.preventDefault();
        pedirRemocao();
        return;
      }

      /* Empurrão fino do lugar selecionado — quem não usa mouse também
         precisa posicionar o nó, não só selecioná-lo. */
      if (selecao?.tipo === "no" && e.key.startsWith("Arrow") && !somenteLeitura) {
        const no = nos.find((n) => n.id === selecao.id);
        if (!no) return;
        e.preventDefault();
        const passo = PASSO_DO_TECLADO * (e.shiftKey ? 5 : 1);
        const destino = {
          x: no.x + (e.key === "ArrowRight" ? passo : e.key === "ArrowLeft" ? -passo : 0),
          y: no.y + (e.key === "ArrowDown" ? passo : e.key === "ArrowUp" ? -passo : 0),
        };
        aoArrastarNo(no.id, destino);
        aoSoltarNo(no.id, destino);
        return;
      }

      const ferramentaDaTecla = ferramentaPorTecla(e.key);
      /* O atalho da névoa não pode acender uma ferramenta que a barra esconde:
         sem névoa ligada, o pincel não existe. */
      if (ferramentaDaTecla === "nevoa" && !nevoaLigada) return;
      if (ferramentaDaTecla && !(somenteLeitura && ferramentaDaTecla !== "selecionar" && ferramentaDaTecla !== "mao")) {
        e.preventDefault();
        setFerramenta(ferramentaDaTecla);
        setLigandoDe(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ligandoDe, selecao, nos, somenteLeitura, pedirRemocao, aoArrastarNo, aoSoltarNo, nevoaLigada]);

  /* ── Render ────────────────────────────────────────────────────────── */
  const painelAberto = !!(noSelecionado || trilhaSelecionada || eventoSelecionado);

  return (
    <section
      aria-label="Editor do mapa-múndi"
      style={{ display: "flex", flexDirection: "column", gap: SP.x3 }}
    >
      <EditorStyles />

      {/* ── Mapa padrão: cópia ao usar (AC-13) ─────────────────────── */}
      {ehPadrao ? (
        <div role="status" style={{
          display: "flex", alignItems: "center", gap: SP.x3, flexWrap: "wrap",
          padding: SP.x4, borderRadius: R.card,
          background: "rgba(201,168,76,0.08)", border: "1px solid var(--border2)",
        }}>
          <span aria-hidden="true" style={{ fontSize: 18 }}>📜</span>
          <div style={{ flex: "1 1 280px", minWidth: 0, ...T.meta, color: "var(--text)" }}>
            Este mapa já vem no Nexus e serve de exemplo. Ele fica intacto: para plantar, mover ou
            esconder qualquer coisa, faça uma cópia — e recomece dela quantas vezes quiser.
          </div>
          {onUsarComoBase ? (
            <button type="button" className="wme-focus" onClick={onUsarComoBase}
              style={{ ...btnStyle("primary", "sm"), flexShrink: 0 }}>
              Fazer uma cópia para editar
            </button>
          ) : null}
        </div>
      ) : null}

      <BarraDeFerramentas
        ferramenta={ferramenta}
        onFerramenta={(id) => { setFerramenta(id); setLigandoDe(null); limpar(); }}
        onEnquadrar={enquadrar}
        onZoom={zoomNoCentro}
        escala={scale}
        somenteLeitura={somenteLeitura}
        comNevoa={nevoaLigada}
      />

      {/* ── Névoa (AC-5) ───────────────────────────────────────────── */}
      {podeTerNevoa ? (
        <ControlesDaNevoa
          ligada={nevoaLigada}
          onLigar={aoLigarNevoa}
          modo={modoDoPincel}
          onModo={(m) => { setModoDoPincel(m); setFerramenta("nevoa"); }}
          raio={raioDoPincel}
          onRaio={setRaioDoPincel}
          previsaoDeJogador={previsaoDeJogador}
          onPrevisao={setPrevisaoDeJogador}
          onCobrirTudo={() => mexerNaNevoa(cobrirTudo)}
          onRevelarTudo={() => mexerNaNevoa(revelarTudo)}
          fracao={estadoDaNevoa.fracao}
          bytes={estadoDaNevoa.bytes}
          gravando={gravacaoDaNevoa.gravando}
          pendente={gravacaoDaNevoa.pendente}
          somenteLeitura={somenteLeitura}
        />
      ) : null}

      {gravacaoDaNevoa.erro ? (
        <div role="alert" style={{
          padding: SP.x3, borderRadius: R.card, ...T.meta, color: "var(--text)",
          background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
        }}>
          <strong>A névoa não foi gravada. </strong>{mensagemDeErro(gravacaoDaNevoa.erro)}
        </div>
      ) : null}

      {/* ── Cota (AC-3): o teto explicado ANTES do clique que falha ─── */}
      {!cota.ok && !somenteLeitura ? (
        <div role="status" style={{
          display: "flex", alignItems: "flex-start", gap: SP.x3, padding: SP.x4,
          background: "rgba(201,168,76,0.08)", border: "1px solid var(--border2)",
          borderRadius: R.card,
        }}>
          <span aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }}>🔒</span>
          <div>
            <div style={{ ...T.section, fontSize: 10, marginBottom: SP.x1 }}>Limite de lugares</div>
            <div style={{ ...T.meta, color: "var(--text)" }}>{cota.motivo}</div>
          </div>
        </div>
      ) : null}

      {/* ── Palco + painel ─────────────────────────────────────────── */}
      <div
        className="wme-layout"
        style={{
          display: "grid",
          gridTemplateColumns: painelAberto ? "minmax(0,1fr) 340px" : "minmax(0,1fr)",
          gap: SP.x3,
          alignItems: "start",
        }}
      >
        <TelaDoMapa
          nos={nos}
          trilhas={trilhas}
          camera={camera}
          ferramenta={ferramenta}
          selecao={selecao}
          ligandoDe={ligandoDe}
          recemCriadoId={recemCriadoId}
          imagemFundo={imagemFundo}
          mundo={mundo}
          Cartografia={Cartografia}
          somenteLeitura={somenteLeitura}
          onClicarNo={aoClicarNo}
          onClicarVazio={aoClicarVazio}
          onClicarTrilha={aoClicarTrilha}
          onArrastarNo={aoArrastarNo}
          onSoltarNo={aoSoltarNo}
          onCurvarTrilha={aoCurvarTrilha}
          onSoltarCurva={aoSoltarCurva}
          altura={altura}
          nevoa={nevoaLigada && mascara ? {
            mascara,
            papel: papelDaNevoa,
            /* AC-11 / design §5.4: nada anima enquanto o mestre edita no
               ateliê. "Editar" aqui é ter uma ferramenta de ESCRITA na mão —
               plantar, ligar ou pincelar. Com a mão ou a seleção ele está
               olhando o mapa, não trabalhando nele, e é aí que a névoa
               respira. (Os outros dois desligamentos — movimento reduzido e
               fora do viewport — moram em `CamadaDeNevoa`.) */
            deriva: comoJogador || ferramenta === "selecionar" || ferramenta === "mao",
          } : null}
          pincel={nevoaLigada && !somenteLeitura && ferramenta === "nevoa"
            ? { raio: raioDoPincel, modo: modoDoPincel }
            : null}
          onPincel={aoPincelar}
          destaque={comoJogador ? COR_DA_VISAO_DE_JOGADOR : null}
          eventos={marcadoresDeEvento}
          eventoSelecionadoId={eventoSelecionado?.id || null}
          onClicarEvento={(id) => { limpar(); setSelecao({ tipo: "evento", id }); }}
        />

        {painelAberto ? (
          <div style={{
            background: SURF.rail, border: `1px solid ${LINE.edge}`,
            borderRadius: R.panel, padding: SP.x4,
            maxHeight: altura, overflowY: "auto",
          }}>
            {noSelecionado ? (
              <PainelDoNo
                no={noSelecionado}
                raioPadraoDoMapa={molde?.defaultRevealRadius}
                cenas={cenas}
                somenteLeitura={somenteLeitura}
                onSalvar={async (patch) => {
                  await updateNode(uid, moldeId, noSelecionado.id, patch);
                  if (vivo.current) setAviso("Lugar salvo.");
                }}
                onRemover={pedirRemocao}
                onFechar={() => setSelecao(null)}
              />
            ) : eventoSelecionado ? (
              <PainelDoEvento
                evento={eventoSelecionado}
                nos={nos}
                trilhas={trilhas}
                cenas={cenas}
                somenteLeitura={somenteLeitura}
                onSalvar={async (patch) => {
                  await updateEvent(uid, moldeId, eventoSelecionado.id, patch);
                  if (vivo.current) setAviso("Evento salvo.");
                }}
                onRemover={pedirRemocao}
                onFechar={() => setSelecao(null)}
              />
            ) : (
              <PainelDaTrilha
                trilha={trilhaSelecionada}
                nos={nos}
                somenteLeitura={somenteLeitura}
                onSalvar={async (patch) => {
                  await updateEdge(uid, moldeId, trilhaSelecionada.id, patch);
                  if (vivo.current) setAviso("Trilha salva.");
                }}
                onRemover={pedirRemocao}
                onInverter={async () => {
                  const [de, para] = pontasDaTrilha(trilhaSelecionada);
                  try {
                    await updateEdge(uid, moldeId, trilhaSelecionada.id, {
                      fromNodeId: para, toNodeId: de,
                    });
                    if (vivo.current) setAviso("Sentido invertido.");
                  } catch (err) { if (vivo.current) setFalha(mensagemDeErro(err)); }
                }}
                onEndireitar={async () => {
                  try {
                    await updateEdge(uid, moldeId, trilhaSelecionada.id, { pathPoints: [] });
                    if (!vivo.current) return;
                    setControles((c) => { const { [trilhaSelecionada.id]: _, ...r } = c; return r; });
                    setAviso("Trilha endireitada.");
                  } catch (err) { if (vivo.current) setFalha(mensagemDeErro(err)); }
                }}
                onFechar={() => setSelecao(null)}
              />
            )}
          </div>
        ) : null}
      </div>

      {/* ── Estado do grafo, em uma linha ──────────────────────────── */}
      <div style={{ display: "flex", gap: SP.x4, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ ...T.data }}>
          {nos.length === 1 ? "1 lugar" : `${nos.length} lugares`}
          {" · "}
          {trilhas.length === 1 ? "1 trilha" : `${trilhas.length} trilhas`}
          {trilhas.some((t) => t.isSecret) ? (
            <span style={{ color: "#a99bec" }}>
              {" · "}
              {trilhas.filter((t) => t.isSecret).length} secreta(s)
            </span>
          ) : null}
          {eventos.length > 0 ? (
            <span data-testid="wme-contagem-de-eventos">
              {" · "}
              {eventos.length === 1 ? "1 evento" : `${eventos.length} eventos`}
            </span>
          ) : null}
        </span>
        {Number.isFinite(cota.limite) && !somenteLeitura ? (
          <span style={{ ...T.meta, fontSize: FS.micro }}>
            seu plano permite {cota.limite} lugares neste mapa
          </span>
        ) : null}
        {carregando ? <span style={{ ...T.meta, fontSize: FS.micro }}>carregando o grafo…</span> : null}
      </div>

      {remoto.error ? (
        <div role="alert" style={{
          padding: SP.x3, borderRadius: R.card, ...T.meta, color: "var(--text)",
          background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
        }}>
          <strong>Os lugares e as trilhas não carregaram. </strong>{mensagemDeErro(remoto.error)}
        </div>
      ) : null}

      {falha ? (
        <div role="alert" style={{
          padding: SP.x3, borderRadius: R.card, ...T.meta, color: "var(--text)",
          background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
        }}>{falha}</div>
      ) : null}

      {aviso ? (
        <div role="status" style={{
          padding: SP.x3, borderRadius: R.card, ...T.meta, color: "#8fd3a0",
          background: "rgba(106,170,122,0.12)", border: "1px solid rgba(106,170,122,0.35)",
        }}>{aviso}</div>
      ) : null}

      {/* Rótulo do que está selecionado, para leitor de tela — o palco é
          `role="application"` e não anuncia seleção sozinho. */}
      <div aria-live="polite" style={{
        position: "absolute", width: 1, height: 1, overflow: "hidden",
        clip: "rect(0 0 0 0)", whiteSpace: "nowrap",
      }}>
        {noSelecionado ? `Selecionado — ${rotuloDoNo(noSelecionado)}` : null}
        {trilhaSelecionada ? `Selecionada — trilha ${nomeDaTrilha(trilhaSelecionada, nos)}` : null}
        {eventoSelecionado
          ? `Selecionado — ${rotuloDoEvento(eventoSelecionado, { nos, trilhas }, getGatilho(eventoSelecionado.trigger)?.label)}`
          : null}
      </div>

      {/* A moldura violeta avisa quem enxerga; isto avisa quem ouve. */}
      {podeTerNevoa ? (
        <div aria-live="polite" style={{
          position: "absolute", width: 1, height: 1, overflow: "hidden",
          clip: "rect(0 0 0 0)", whiteSpace: "nowrap",
        }}>
          {comoJogador
            ? "Visão do jogador: o mapa está sendo mostrado como o grupo o vê."
            : "Visão do mestre: você está vendo o mapa inteiro."}
        </div>
      ) : null}

      {confirmando ? (
        <ConfirmarRemocao
          titulo={confirmando.titulo}
          descricao={confirmando.descricao}
          rotuloConfirmar={confirmando.rotulo}
          onFechar={() => setConfirmando(null)}
          onConfirmar={confirmando.executar}
        />
      ) : null}
    </section>
  );
}
