/* ════════════════════════════════════════════════════════════════════
 *  EDITOR DO GRAFO — TOKENS, VIRTUALIZAÇÃO E PINTURA  (spec 0028 · F2 · AC-4)
 *  --------------------------------------------------------------------
 *  Só valores e funções puras: nenhum JSX, nenhum hook, nenhum I/O. É aqui
 *  que mora a matemática do render híbrido do design §5.3 — quais nós viram
 *  DOM (virtualização) e como as trilhas são pintadas no canvas.
 *
 *  A geometria de grafo e de curva NÃO é reimplementada aqui: vem de
 *  `model/graph.js` e `model/curves.js`, que já são lógica pura testada.
 *  Este arquivo é a ponte entre aquela matemática e os pixels.
 *
 *  Gate: `__tests__/editor-virtualizacao.test.js` e `editor-pintura.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { pontosDaTrilha, pontasDaTrilha, getNodeType } from "../model/graph";
import { controlePadrao } from "../model/curves";
import { MAPA_PADRAO_ID, ehMapaPadrao } from "../model/mapaPadrao";

/** Mundo assumido quando o molde ainda não tem ilustração nem dimensões. */
export const MUNDO_DE_RESERVA = { largura: 2400, altura: 1600 };

/**
 * A carta vetorial do mapa padrão (`CartografiaPadrao`) serve a este molde?
 *
 * Dois casos, e só dois (AC-13):
 *  · **o próprio padrão** — a ilustração dele é o SVG embutido, sempre;
 *  · **uma cópia do padrão** que ainda não ganhou arte própria — herdar a
 *    carta é o que impede a cópia de nascer sobre um fundo preto vazio.
 *
 * Mapa do usuário sem marca de origem nunca herda: a carta é a paisagem da
 * *Coroa de Cinzas*, e desenhá-la sob o mundo de outra pessoa seria mentira.
 */
export function usaCartografiaPadrao(molde, temFundoProprio) {
  if (!molde) return false;
  if (ehMapaPadrao(molde.id)) return true;
  return molde.origem === MAPA_PADRAO_ID && !temFundoProprio;
}

/* ── FERRAMENTAS ──────────────────────────────────────────────────────
 * Quatro, e só quatro. Cada uma tem uma tecla de atalho de uma letra, no
 * padrão de qualquer editor gráfico — e a `dica` é a frase que explica o
 * que ela faz, porque "Trilha" sozinho não ensina ninguém a usar. */
export const FERRAMENTAS = [
  {
    id: "selecionar",
    label: "Selecionar",
    atalho: "V",
    icone: "⬉",
    dica: "Clique para escolher um lugar ou uma trilha. Arraste um lugar para movê-lo. Delete apaga.",
  },
  {
    id: "no",
    label: "Novo lugar",
    atalho: "N",
    icone: "◆",
    dica: "Clique no mapa para plantar um lugar novo. O painel de edição abre em seguida.",
  },
  {
    id: "trilha",
    label: "Nova trilha",
    atalho: "T",
    icone: "⤳",
    dica: "Clique em dois lugares para ligá-los. Depois arraste o punho da curva para entortar o caminho.",
  },
  {
    id: "mao",
    label: "Mover o mapa",
    atalho: "H",
    icone: "✥",
    dica: "Arraste para deslocar o mapa. A roda do mouse dá zoom em qualquer ferramenta.",
  },
  {
    id: "nevoa",
    label: "Pincel de névoa",
    atalho: "F",
    icone: "🌫",
    dica: "Arraste sobre o mapa para abrir ou fechar a névoa. O tamanho e o que ele faz ficam na barra da névoa.",
  },
  {
    id: "evento",
    label: "Novo evento",
    atalho: "E",
    icone: "✦",
    dica: "Clique num lugar, numa trilha ou no vazio para ancorar um evento ali. O painel abre para escolher o gatilho.",
  },
];

/**
 * Ferramentas que só fazem sentido com a névoa ligada.
 *
 * A barra as esconde quando o molde está sem névoa — oferecer um pincel que
 * não pinta nada seria mentira. Ver `ferramentasDisponiveis`.
 */
export const FERRAMENTAS_DE_NEVOA = ["nevoa"];

/**
 * As ferramentas que a barra deve mostrar agora.
 *
 * Em somente leitura sobram as duas que não escrevem no molde (escolher e
 * mover). Sem névoa, o pincel some. As duas regras se somam.
 *
 * @param {{somenteLeitura?:boolean, comNevoa?:boolean}} contexto
 * @returns {Array} subconjunto de `FERRAMENTAS` (as mesmas referências).
 */
export function ferramentasDisponiveis({ somenteLeitura = false, comNevoa = false } = {}) {
  return FERRAMENTAS.filter((f) => {
    if (somenteLeitura) return f.id === "selecionar" || f.id === "mao";
    if (FERRAMENTAS_DE_NEVOA.includes(f.id)) return comNevoa;
    return true;
  });
}

/** Ferramenta assumida ao abrir o editor. */
export const FERRAMENTA_PADRAO = "selecionar";

/** A ferramenta pelo id, com fallback seguro. Devolve **cópia**. */
export function getFerramenta(id) {
  const achada = FERRAMENTAS.find((f) => f.id === id);
  return { ...(achada || FERRAMENTAS[0]) };
}

/** Id da ferramenta cujo atalho é a tecla informada, ou `null`. */
export function ferramentaPorTecla(tecla) {
  if (typeof tecla !== "string" || tecla.length !== 1) return null;
  const alvo = tecla.toUpperCase();
  const achada = FERRAMENTAS.find((f) => f.atalho === alvo);
  return achada ? achada.id : null;
}

/* ── NÍVEL DE PERIGO (0–5) ────────────────────────────────────────────
 * O design §3 guarda `dangerLevel` como número. Número sozinho não diz
 * nada ao mestre no meio da sessão — a escala abaixo é o que a tela mostra. */
export const NIVEIS_DE_PERIGO = [
  { valor: 0, label: "Seguro", hint: "Estrada batida, sem rolagem de encontro." },
  { valor: 1, label: "Tranquilo", hint: "Movimento de gente honesta; o risco é o tempo." },
  { valor: 2, label: "Atento", hint: "Vale manter vigília. Encontro possível, raramente fatal." },
  { valor: 3, label: "Arriscado", hint: "Terreno ruim ou território de alguém. Encontro provável." },
  { valor: 4, label: "Perigoso", hint: "Quem passa aqui paga em suprimento, sangue ou sono." },
  { valor: 5, label: "Mortal", hint: "Só quem não tem escolha, ou quem já sabe o que mora aqui." },
];

/** Rótulo do nível de perigo, grampeado em 0–5. */
export function rotuloDoPerigo(nivel) {
  const n = Number.isFinite(nivel) ? Math.max(0, Math.min(5, Math.round(nivel))) : 0;
  return NIVEIS_DE_PERIGO[n];
}

/* ── GEOMETRIA DO VIEWPORT ────────────────────────────────────────────
 * Toda a virtualização do design §5.3 depende de uma pergunta só: que
 * pedaço do MUNDO cabe hoje na tela? */

/**
 * A caixa de mundo visível no container, com folga.
 *
 * A margem é dada em **pixels de tela** e convertida para mundo pela escala —
 * assim a folga é sempre a mesma faixa visual, com zoom aproximado ou afastado.
 * É o que evita o nó "pipocar" na borda ao arrastar o mapa.
 *
 * @param {{x:number,y:number}} pan
 * @param {number} scale
 * @param {number} largura largura do container, em px.
 * @param {number} altura altura do container, em px.
 * @param {number} [margem=160] folga em px de tela.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}}
 */
export function caixaDoViewport(pan, scale, largura, altura, margem = 160) {
  const px = Number.isFinite(pan?.x) ? pan.x : 0;
  const py = Number.isFinite(pan?.y) ? pan.y : 0;
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const w = Number.isFinite(largura) && largura > 0 ? largura : 0;
  const h = Number.isFinite(altura) && altura > 0 ? altura : 0;
  const folga = (Number.isFinite(margem) ? margem : 0) / s;

  return {
    minX: (0 - px) / s - folga,
    minY: (0 - py) / s - folga,
    maxX: (w - px) / s + folga,
    maxY: (h - py) / s + folga,
  };
}

/**
 * **A virtualização** (design §5.3): só os nós dentro da caixa viram DOM.
 *
 * Com 500 nós no mapa (cota do plano pago, AC-3) e algumas dezenas em tela, o
 * custo de DOM fica constante em vez de crescer com o mapa. Nó sem coordenada
 * válida fica de fora — não há onde desenhá-lo.
 *
 * Container ainda não medido (`largura`/`altura` zerados no primeiro render)
 * devolveria caixa vazia e a tela nasceria sem nó nenhum. Por isso a caixa
 * `null` significa "não sei o que é visível ainda" e devolve tudo: é melhor
 * pintar demais por um quadro do que piscar vazio.
 *
 * @param {Array} nos
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} caixa
 * @returns {Array} subconjunto de `nos` (as mesmas referências).
 */
export function nosVisiveis(nos, caixa) {
  const lista = Array.isArray(nos) ? nos : [];
  if (!caixa || !Number.isFinite(caixa.minX) || caixa.maxX <= caixa.minX || caixa.maxY <= caixa.minY) {
    return lista.filter((n) => Number.isFinite(n?.x) && Number.isFinite(n?.y));
  }
  return lista.filter((n) => (
    Number.isFinite(n?.x) && Number.isFinite(n?.y)
    && n.x >= caixa.minX && n.x <= caixa.maxX
    && n.y >= caixa.minY && n.y <= caixa.maxY
  ));
}

/**
 * O ponto de controle da curva de uma trilha, em coordenadas de mundo.
 *
 * `pathPoints[0]` quando o mestre já entortou a trilha; senão o controle
 * sugerido por `controlePadrao` — que é determinístico, então o punho nasce
 * sempre no mesmo lugar e arrastá-lo é a primeira curvatura, não um salto.
 *
 * @param {object} trilha
 * @param {Array} nos
 * @returns {{x:number,y:number}|null} `null` quando alguma ponta não existe.
 */
export function pontoDeControle(trilha, nos) {
  const [de, para] = pontasDaTrilha(trilha);
  const lista = Array.isArray(nos) ? nos : [];
  const a = lista.find((n) => n?.id === de);
  const b = lista.find((n) => n?.id === para);
  if (!a || !b || !Number.isFinite(a.x) || !Number.isFinite(b.x)) return null;

  const primeiro = Array.isArray(trilha?.pathPoints) ? trilha.pathPoints[0] : null;
  if (primeiro && Number.isFinite(primeiro.x) && Number.isFinite(primeiro.y)) {
    return { x: primeiro.x, y: primeiro.y };
  }
  return controlePadrao({ x: a.x, y: a.y }, { x: b.x, y: b.y });
}

/* ── RÓTULOS PARA GENTE (e para leitor de tela) ───────────────────────── */

/** "0,5 h" · "9 h" · "1 dia e 2 h" — horas de viagem em português. */
export function formatarHoras(horas) {
  if (!Number.isFinite(horas) || horas < 0) return "—";
  if (horas === 0) return "imediato";
  if (horas < 1) {
    const minutos = Math.round(horas * 60);
    return `${minutos} min`;
  }
  if (horas < 24) {
    const texto = Number.isInteger(horas) ? String(horas) : String(horas).replace(".", ",");
    return `${texto} h`;
  }
  const dias = Math.floor(horas / 24);
  const resto = Math.round(horas - dias * 24);
  const parteDias = dias === 1 ? "1 dia" : `${dias} dias`;
  return resto > 0 ? `${parteDias} e ${resto} h` : parteDias;
}

/**
 * O `aria-label` do nó — o que o leitor de tela anuncia.
 *
 * Diz o tipo antes do nome (é a informação que orienta), e sinaliza o que é
 * segredo do mestre. Um nó do tipo `secret` sem esse aviso soaria como
 * qualquer outro lugar do mapa.
 */
export function rotuloDoNo(no) {
  const tipo = getNodeType(no?.type);
  const nome = (typeof no?.name === "string" && no.name.trim()) || "Lugar sem nome";
  const partes = [`${tipo.label}: ${nome}`];
  if (no?.type === "secret") partes.push("segredo do mestre");
  if (no?.isFastTravel) partes.push("viagem rápida");
  if (no?.linkedSceneId) partes.push("com cena tática vinculada");
  return partes.join(", ");
}

/** "Vila Candeia ↔ Capela do Cemitério Velho" — a trilha dita pelas pontas. */
export function nomeDaTrilha(trilha, nos) {
  const [de, para] = pontasDaTrilha(trilha);
  const lista = Array.isArray(nos) ? nos : [];
  const nome = (id) => {
    const n = lista.find((x) => x?.id === id);
    return (typeof n?.name === "string" && n.name.trim()) || "lugar desconhecido";
  };
  const seta = trilha?.isOneWay ? "→" : "↔";
  return `${nome(de)} ${seta} ${nome(para)}`;
}

/** O `aria-label` da trilha: pontas, tempo, segredo e perigo, nessa ordem. */
export function rotuloDaTrilha(trilha, nos) {
  const partes = [`Trilha ${nomeDaTrilha(trilha, nos)}`, formatarHoras(trilha?.travelHours)];
  if (trilha?.isSecret) partes.push("secreta");
  if (trilha?.isOneWay) partes.push("mão única");
  const perigo = rotuloDoPerigo(trilha?.dangerLevel);
  if (perigo.valor > 0) partes.push(`perigo ${perigo.label.toLowerCase()}`);
  return partes.join(", ");
}

/* ── EVENTOS ANCORADOS (F5 · AC-1, AC-8) ──────────────────────────────
 * O evento não é geometria: ele PEGA CARONA na geometria do grafo. Um
 * evento de nó fica onde o nó está; um de trilha, no meio da curva dela;
 * um de ponto tem coordenada própria. Traduzir isso em pixels é problema
 * de tela, e por isso mora aqui — puro, testável sem DOM. */

/** O selo do evento no mapa. Um só, para o mestre reconhecer de relance. */
export const ICONE_DO_EVENTO = "✦";

/**
 * Onde o selo do evento é desenhado, em coordenadas de mundo.
 *
 * - **ponto** — a coordenada guardada na âncora;
 * - **nó** — em cima do nó ancorado;
 * - **trilha** — no MEIO DA CURVA amostrada, não no meio da corda entre as
 *   pontas: numa trilha bem entortada as duas coisas ficam longe uma da outra,
 *   e o selo apareceria fora do caminho que ele marca.
 *
 * Âncora que não resolve devolve `null` — o selo simplesmente não é desenhado,
 * e o painel acusa `ancora-orfa` por `validarEvento`. Chutar uma posição seria
 * pior: o mestre veria o evento num lugar onde ele não acontece.
 *
 * @param {object} evento
 * @param {{nos:Array, trilhas:Array}} grafo
 * @returns {{x:number,y:number}|null}
 */
export function posicaoDoEvento(evento, grafo) {
  const anchor = evento?.anchor;
  if (!anchor || typeof anchor !== "object") return null;
  const nos = Array.isArray(grafo?.nos) ? grafo.nos : [];
  const trilhas = Array.isArray(grafo?.trilhas) ? grafo.trilhas : [];

  if (anchor.type === "point") {
    return Number.isFinite(anchor.x) && Number.isFinite(anchor.y)
      ? { x: anchor.x, y: anchor.y }
      : null;
  }
  if (anchor.type === "node") {
    const no = nos.find((n) => n?.id === anchor.refId);
    return no && Number.isFinite(no.x) && Number.isFinite(no.y) ? { x: no.x, y: no.y } : null;
  }
  if (anchor.type === "edge") {
    const trilha = trilhas.find((t) => t?.id === anchor.refId);
    if (!trilha) return null;
    const pontos = pontosDaTrilha(trilha, nos);
    if (pontos.length === 0) return null;
    /* Com número ÍMPAR de amostras há um ponto do meio; com número par (o caso
       da trilha reta, que vem só com as duas pontas) o meio fica ENTRE dois, e
       pegar um índice qualquer colocaria o selo em cima de um dos nós. */
    const i = Math.floor(pontos.length / 2);
    const meio = pontos.length % 2 === 1
      ? pontos[i]
      : { x: (pontos[i - 1].x + pontos[i].x) / 2, y: (pontos[i - 1].y + pontos[i].y) / 2 };
    return meio && Number.isFinite(meio.x) ? { x: meio.x, y: meio.y } : null;
  }
  return null;
}

/** "no lugar Vila Candeia" · "na trilha X ↔ Y" · "num ponto do mapa". */
export function ondeOEventoEsta(evento, grafo) {
  const anchor = evento?.anchor;
  const nos = Array.isArray(grafo?.nos) ? grafo.nos : [];
  const trilhas = Array.isArray(grafo?.trilhas) ? grafo.trilhas : [];

  if (anchor?.type === "node") {
    const no = nos.find((n) => n?.id === anchor.refId);
    return no ? `no lugar ${(no.name || "").trim() || "sem nome"}` : "num lugar que não existe mais";
  }
  if (anchor?.type === "edge") {
    const trilha = trilhas.find((t) => t?.id === anchor.refId);
    return trilha ? `na trilha ${nomeDaTrilha(trilha, nos)}` : "numa trilha que não existe mais";
  }
  if (anchor?.type === "point") return "num ponto do mapa";
  return "sem âncora";
}

/**
 * O `aria-label` do selo do evento — o que o leitor de tela anuncia no palco.
 *
 * Diz o título, onde ele está ancorado e por qual gatilho ele sai. **É rótulo
 * do ATELIÊ**: pode falar de gatilho e de segredo à vontade, porque só o mestre
 * entra aqui (design §2, S1). Nada disto vai para a mesa do jogador.
 */
export function rotuloDoEvento(evento, grafo, gatilhoLabel) {
  const titulo = (typeof evento?.title === "string" && evento.title.trim()) || "Evento sem título";
  const partes = [`Evento: ${titulo}`, ondeOEventoEsta(evento, grafo)];
  if (gatilhoLabel) partes.push(gatilhoLabel.toLocaleLowerCase("pt-BR"));
  if (evento?.gmText) partes.push("com texto só seu");
  return partes.join(", ");
}

/* ── PINTURA DAS TRILHAS (canvas) ─────────────────────────────────────
 * Design §5.3: as trilhas vão para o CANVAS. Centenas de curvas em SVG
 * custam caro, e trilha não é elemento focável — quem precisa de foco,
 * teclado e rótulo é o nó, e o nó é DOM.
 *
 * A função recebe o `ctx` de fora e é pura em relação a ele: nada de
 * `document`, nada de estado. É o que permite testá-la com um dublê de
 * contexto e contar exatamente o que foi pintado. */

/**
 * Paleta das trilhas.
 *
 * Valores literais, não `var(--gold)`: o canvas 2D **não resolve CSS custom
 * properties** — `strokeStyle = "var(--gold)"` é ignorado em silêncio e a
 * trilha some. O dourado do tema entra por `corDeAcento`, que a tela lê do DOM
 * com `getComputedStyle` e passa já resolvido. Regra do ADR-0004 respeitada
 * onde ela vale (inline style + var); aqui, onde não vale, a exceção é
 * consciente e documentada.
 */
export const CORES_DA_TRILHA = {
  normal: "rgba(214,196,150,0.72)",
  secreta: "#8a7ad6",
  /** Reserva para quando o tema não puder ser lido (SSR, teste, canvas solto). */
  acentoDeReserva: "#c9a84c",
};

/** Traço da trilha secreta. Tracejado largo: dá para ver de longe (AC-4). */
export const TRACO_SECRETO = [14, 10];

/** Espessura base da trilha, em px de tela, antes do nível de perigo. */
export const ESPESSURA_BASE = 2.4;

/**
 * Espessura da trilha em px de tela. Cresce com o perigo — o mestre lê a
 * dificuldade do caminho sem clicar em nada.
 */
export function espessuraDaTrilha(trilha, escala) {
  const perigo = rotuloDoPerigo(trilha?.dangerLevel).valor;
  const s = Number.isFinite(escala) && escala > 0 ? escala : 1;
  // A espessura acompanha o zoom só até certo ponto: numa vista bem afastada a
  // trilha ainda precisa ser visível, e bem aproximada não pode virar uma faixa.
  const fator = Math.max(0.55, Math.min(2.2, s));
  return (ESPESSURA_BASE + perigo * 0.65) * fator;
}

/**
 * Pinta o mapa no canvas: a ilustração de fundo (quando é imagem) e todas as
 * trilhas visíveis.
 *
 * O que NÃO é pintado aqui, de propósito: os nós (são DOM, design §5.3) e a
 * ilustração do mapa padrão (é SVG vetorial, e rasterizá-la no canvas jogaria
 * fora a nitidez em qualquer zoom que o AC-13 promete — ela é desenhada numa
 * camada DOM atrás deste canvas).
 *
 * @param {CanvasRenderingContext2D} ctx contexto 2d. `null` é aceito e vira
 *   no-op: no jsdom não existe contexto, e o teste de render não pode quebrar
 *   por causa disso.
 * @param {object} opcoes
 * @param {number} opcoes.largura largura do canvas em px de CSS.
 * @param {number} opcoes.altura altura do canvas em px de CSS.
 * @param {number} [opcoes.dpr=1] `devicePixelRatio`.
 * @param {{x:number,y:number}} opcoes.pan
 * @param {number} opcoes.scale
 * @param {Array} opcoes.nos
 * @param {Array} opcoes.trilhas
 * @param {CanvasImageSource|null} [opcoes.imagem] ilustração de fundo já carregada.
 * @param {{largura:number,altura:number}} [opcoes.mundo] tamanho da ilustração.
 * @param {string|null} [opcoes.trilhaSelecionada] id da trilha em foco.
 * @param {string} [opcoes.corDeAcento] o dourado do tema, já resolvido.
 * @returns {{trilhasPintadas:number, fundoPintado:boolean}} o que aconteceu —
 *   é o que o teste inspeciona sem precisar de pixels.
 */
export function pintarMapa(ctx, opcoes = {}) {
  const resultado = { trilhasPintadas: 0, fundoPintado: false };
  if (!ctx || typeof ctx.clearRect !== "function") return resultado;

  const {
    largura = 0, altura = 0, dpr = 1, pan = { x: 0, y: 0 }, scale = 1,
    nos = [], trilhas = [], imagem = null, mundo = null,
    trilhaSelecionada = null, corDeAcento = "#c9a84c",
  } = opcoes;

  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const px = Number.isFinite(pan?.x) ? pan.x : 0;
  const py = Number.isFinite(pan?.y) ? pan.y : 0;
  const razao = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const paraTela = (p) => ({ x: p.x * s + px, y: p.y * s + py });

  ctx.setTransform(razao, 0, 0, razao, 0, 0);
  ctx.clearRect(0, 0, largura, altura);

  /* ── Fundo ────────────────────────────────────────────────────────── */
  if (imagem && mundo && Number.isFinite(mundo.largura) && mundo.largura > 0) {
    try {
      const canto = paraTela({ x: 0, y: 0 });
      ctx.drawImage(imagem, canto.x, canto.y, mundo.largura * s, mundo.altura * s);
      resultado.fundoPintado = true;
    } catch (e) {
      // Imagem meio carregada ou de outra origem: o mapa continua utilizável
      // sem o fundo, e o erro aparece no console em vez de derrubar o render.
      console.warn("[editor do mapa] não deu para pintar a ilustração de fundo:", e);
    }
  }

  /* ── Trilhas ──────────────────────────────────────────────────────── */
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  (Array.isArray(trilhas) ? trilhas : []).forEach((trilha) => {
    const pontos = pontosDaTrilha(trilha, nos);
    if (pontos.length < 2) return; // trilha órfã: nada a desenhar

    const tela = pontos.map(paraTela);
    const selecionada = !!trilhaSelecionada && trilha?.id === trilhaSelecionada;
    const secreta = !!trilha?.isSecret;
    const espessura = espessuraDaTrilha(trilha, s);

    const tracar = () => {
      ctx.beginPath();
      ctx.moveTo(tela[0].x, tela[0].y);
      for (let i = 1; i < tela.length; i++) ctx.lineTo(tela[i].x, tela[i].y);
      ctx.stroke();
    };

    /* Halo: separa a trilha do fundo ilustrado, que pode ter qualquer cor.
       Na secreta o halo é violeta e mais largo — é o que faz o segredo saltar
       aos olhos de longe, que é exatamente o que o mestre precisa (AC-4). */
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
    ctx.strokeStyle = secreta ? "rgba(138,122,214,0.30)" : "rgba(0,0,0,0.45)";
    ctx.lineWidth = espessura + (secreta ? 7 : 3);
    tracar();

    /* Traço principal. */
    if (typeof ctx.setLineDash === "function") {
      ctx.setLineDash(secreta ? TRACO_SECRETO.map((n) => n * Math.max(0.5, Math.min(1.6, s))) : []);
    }
    ctx.strokeStyle = selecionada
      ? corDeAcento
      : (secreta ? CORES_DA_TRILHA.secreta : CORES_DA_TRILHA.normal);
    ctx.lineWidth = selecionada ? espessura + 1.6 : espessura;
    tracar();

    /* Mão única: uma seta no meio do percurso, apontando para o destino. */
    if (trilha?.isOneWay) {
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
      desenharSeta(ctx, tela, ctx.strokeStyle, espessura);
    }

    resultado.trilhasPintadas += 1;
  });

  if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
  return resultado;
}

/**
 * Seta no meio da polilinha, apontando no sentido do percurso. Só existe para
 * a trilha de mão única — desenhar seta em toda trilha viraria ruído.
 */
function desenharSeta(ctx, pontos, cor, espessura) {
  const meio = Math.max(1, Math.floor(pontos.length / 2));
  const a = pontos[meio - 1];
  const b = pontos[meio];
  if (!a || !b) return;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  const ux = dx / len;
  const uy = dy / len;
  const tamanho = Math.max(7, espessura * 3.2);

  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - ux * tamanho - uy * tamanho * 0.5, b.y - uy * tamanho + ux * tamanho * 0.5);
  ctx.lineTo(b.x - ux * tamanho + uy * tamanho * 0.5, b.y - uy * tamanho - ux * tamanho * 0.5);
  ctx.closePath();
  ctx.fill();
}
