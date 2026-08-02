/* ════════════════════════════════════════════════════════════════════
 *  A MESA — TOKENS, TRADUÇÕES E MATEMÁTICA DA VIAGEM
 *  (spec 0028 · F4 · AC-6, AC-8, AC-10, AC-11 · design §2 e §5.4)
 *  --------------------------------------------------------------------
 *  Só valores e funções puras: nenhum JSX, nenhum hook, nenhum I/O. É a
 *  ponte entre o que o `mesaStore` grava (documentos de `revealed/`, o doc
 *  do grupo) e o que a tela precisa desenhar e anunciar.
 *
 *  A REGRA DE OURO DESTE ARQUIVO: nada aqui inventa segredo nem o esconde
 *  por render. O grafo do jogador é montado **a partir dos documentos que
 *  ele já lê por direito** (`revealed/`); o do mestre vem do molde, que só
 *  ele alcança. Duas fontes, duas leituras — nunca um filtro no meio.
 *
 *  Gate: `__tests__/mesa-modelo.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { pontasDaTrilha } from "../model/graph";
import { estadoDoNo, estadoDaTrilha, ESTADOS_NO, ESTADOS_TRILHA } from "../model/revelacao";
import { HORAS_POR_DIA } from "../model/viagem";
import { formatarHoras } from "../Editor/editorUi";

const lista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (typeof v === "string" ? v.trim() : "");

/* As três constantes de formato do `mesaStore`, repetidas aqui de propósito —
 * mesma decisão (e mesmo preço) de `RAIO_DE_REVELACAO_PADRAO` em
 * `model/revelacao.js`: importar o store traria o Firebase inteiro para dentro
 * de um módulo puro, e a tela mocka o store nos testes de render. São formato
 * de id, não regra de negócio; `__tests__/mesa-modelo.test.js` trava as duas
 * pontas comparando com o que o store exporta. */
const SEPARADOR_DA_INSTANCIA = "~";
const PREFIXO_DO_NO = "no_";
const PREFIXO_DA_TRILHA = "tr_";

/* ════════════════════════════════════════════════════════════════════
 *  IDENTIDADE DA INSTÂNCIA
 * ══════════════════════════════════════════════════════════════════ */

/**
 * O id do molde escondido dentro do id da instância (`{uid}~{mapId}`).
 *
 * O `mesaStore` já exporta `mestreDaInstancia` para a outra metade; esta é a
 * simétrica, e existe aqui porque quem precisa dela é a tela — é com o `mapId`
 * que o cliente do mestre assina o grafo do ateliê para poder revelar.
 *
 * @param {string} instanceId
 * @returns {string} `""` quando o id não segue o formato.
 */
export function moldeDaInstancia(instanceId) {
  const id = texto(instanceId);
  const corte = id.indexOf(SEPARADOR_DA_INSTANCIA);
  return corte > 0 ? id.slice(corte + SEPARADOR_DA_INSTANCIA.length) : "";
}

/* ════════════════════════════════════════════════════════════════════
 *  DE `revealed/` PARA O GRAFO DO JOGADOR
 *  --------------------------------------------------------------------
 *  Os documentos de `revealed/` guardam `nodeId`/`edgeId` e `state`, porque
 *  o id do documento é prefixado (`no_`/`tr_`) para nó e trilha poderem
 *  conviver na mesma coleção. O grafo do resto do módulo fala `id` e
 *  `estado`. A tradução mora aqui, num lugar só — e devolve exatamente a
 *  MESMA FORMA que `projecaoDoJogador` produz, para a Mesa não ter dois
 *  desenhos diferentes conforme quem está olhando.
 * ══════════════════════════════════════════════════════════════════ */

/**
 * O grafo que o jogador enxerga, montado dos documentos de `revealed/`.
 *
 * Trilha cuja outra ponta ainda não chegou fica de fora: desenhar a linha
 * entregaria a posição do que está escondido (é a mesma regra de
 * `projecaoDoJogador`, e aqui ela vale de novo porque a coleção pode chegar
 * pela metade num snapshot intermediário).
 *
 * @param {Array} revelado documentos de `useReveladoNaMesa`.
 * @returns {{nos:Array, trilhas:Array}}
 */
export function grafoDoRevelado(revelado) {
  const visiveis = new Set();

  const nos = lista(revelado).reduce((acc, doc) => {
    if (doc?.kind !== "node") return acc;
    const id = texto(doc.nodeId) || texto(doc.id).replace(PREFIXO_DO_NO, "");
    if (!id || !Number.isFinite(doc.x) || !Number.isFinite(doc.y)) return acc;
    visiveis.add(id);
    acc.push({
      id,
      kind: "node",
      x: doc.x,
      y: doc.y,
      type: doc.type,
      name: doc.name,
      description: doc.description || "",
      icon: doc.icon ?? null,
      color: doc.color,
      rumorLabel: doc.rumorLabel || "",
      estado: ESTADOS_NO.includes(doc.state) ? doc.state : "discovered",
    });
    return acc;
  }, []);

  const trilhas = lista(revelado).reduce((acc, doc) => {
    if (doc?.kind !== "edge") return acc;
    const id = texto(doc.edgeId) || texto(doc.id).replace(PREFIXO_DA_TRILHA, "");
    const de = texto(doc.fromNodeId);
    const para = texto(doc.toNodeId);
    if (!id || !visiveis.has(de) || !visiveis.has(para)) return acc;
    acc.push({
      id,
      kind: "edge",
      fromNodeId: de,
      toNodeId: para,
      pathPoints: lista(doc.pathPoints).map((p) => ({ x: p.x, y: p.y })),
      travelHours: Number.isFinite(doc.travelHours) ? doc.travelHours : 0,
      isOneWay: !!doc.isOneWay,
      estado: ESTADOS_TRILHA.includes(doc.state) ? doc.state : "revealed",
    });
    return acc;
  }, []);

  return { nos, trilhas };
}

/**
 * O estado de visibilidade da mesa (`{nos, trilhas}`), lido de `revealed/`.
 *
 * É o insumo de TODA a máquina de `model/revelacao.js`. O documento que
 * existe é a revelação; o que não existe é `hidden` — a ausência É o estado,
 * e é por isso que o AC-1 se sustenta sem filtro nenhum.
 *
 * @param {Array} revelado
 * @returns {{nos:object, trilhas:object}}
 */
export function estadoDoRevelado(revelado) {
  const nos = {};
  const trilhas = {};
  lista(revelado).forEach((doc) => {
    if (doc?.kind === "node") {
      const id = texto(doc.nodeId) || texto(doc.id).replace(PREFIXO_DO_NO, "");
      if (id && ESTADOS_NO.includes(doc.state)) nos[id] = doc.state;
    } else if (doc?.kind === "edge") {
      const id = texto(doc.edgeId) || texto(doc.id).replace(PREFIXO_DA_TRILHA, "");
      if (id && ESTADOS_TRILHA.includes(doc.state)) trilhas[id] = doc.state;
    }
  });
  return { nos, trilhas };
}

/* ════════════════════════════════════════════════════════════════════
 *  O QUE AINDA ESTÁ OCULTO — o estoque do "Revelar agora" (AC-8)
 *  --------------------------------------------------------------------
 *  *"o mestre decide o que liberar para eles de extra que está oculto"*.
 *  Para decidir, ele precisa ENXERGAR o que tem para dar. Esta função é a
 *  lista dessa gaveta: tudo que o grupo ainda não viu, com nome, com o
 *  estado atual e com o aviso de que é segredo.
 * ══════════════════════════════════════════════════════════════════ */

/** Rótulo em português de cada estado, para o mestre ler sem decorar enum. */
export const NOME_DO_ESTADO_DO_NO = {
  hidden: "oculto",
  rumored: "rumor",
  discovered: "descoberto",
  visited: "visitado",
};

export const NOME_DO_ESTADO_DA_TRILHA = {
  hidden: "oculta",
  revealed: "revelada",
  traveled: "percorrida",
};

/**
 * O que o mestre ainda pode liberar: nós abaixo de `visited` e trilhas abaixo
 * de `traveled`, com o rótulo pronto.
 *
 * Ordena o mais oculto primeiro — é o que ele procura quando abre o painel.
 *
 * @param {{nos:object,trilhas:object}} estado
 * @param {{nos:Array,trilhas:Array}} grafo o MOLDE (só o mestre o tem).
 * @returns {{nos:Array, trilhas:Array, total:number, ocultos:number}}
 */
export function estoqueOculto(estado, grafo) {
  const nosDoGrafo = lista(grafo?.nos);
  const nomeDoNo = (id) => {
    const n = nosDoGrafo.find((x) => x?.id === id);
    return texto(n?.name) || "lugar sem nome";
  };

  const nos = nosDoGrafo
    .filter((n) => texto(n?.id) && estadoDoNo(estado, n.id) !== "visited")
    .map((n) => ({
      id: n.id,
      tipo: "no",
      nome: texto(n.name) || "Lugar sem nome",
      estado: estadoDoNo(estado, n.id),
      secreto: n.type === "secret",
      x: n.x,
      y: n.y,
    }))
    .sort((a, b) => ESTADOS_NO.indexOf(a.estado) - ESTADOS_NO.indexOf(b.estado)
      || a.nome.localeCompare(b.nome, "pt-BR"));

  const trilhas = lista(grafo?.trilhas)
    .filter((t) => texto(t?.id) && estadoDaTrilha(estado, t.id) !== "traveled")
    .map((t) => {
      const [de, para] = pontasDaTrilha(t);
      return {
        id: t.id,
        tipo: "trilha",
        nome: `${nomeDoNo(de)} ${t.isOneWay ? "→" : "↔"} ${nomeDoNo(para)}`,
        estado: estadoDaTrilha(estado, t.id),
        secreto: !!t.isSecret,
        horas: Number.isFinite(t.travelHours) ? t.travelHours : 0,
      };
    })
    .sort((a, b) => ESTADOS_TRILHA.indexOf(a.estado) - ESTADOS_TRILHA.indexOf(b.estado)
      || a.nome.localeCompare(b.nome, "pt-BR"));

  const ocultos = nos.filter((n) => n.estado === "hidden").length
    + trilhas.filter((t) => t.estado === "hidden").length;

  return { nos, trilhas, total: nos.length + trilhas.length, ocultos };
}

/* ════════════════════════════════════════════════════════════════════
 *  O RELÓGIO E A COMIDA  (design §5.4 movimento 5; AC-10)
 * ══════════════════════════════════════════════════════════════════ */

/** O relógio neutro: a mesa começa no dia 1, à meia-noite. */
export const RELOGIO_INICIAL = Object.freeze({ dia: 1, hora: 0, minuto: 0 });

/**
 * O relógio gravado, normalizado. `null` (o estado em que a instância nasce)
 * vira o dia 1 — a mesa tem de mostrar uma hora, não um traço.
 */
export function relogioDe(party) {
  const bruto = party?.inGameDatetime;
  if (typeof bruto === "number" && Number.isFinite(bruto)) return bruto;
  if (!bruto || typeof bruto !== "object") return { ...RELOGIO_INICIAL };
  return {
    dia: Number.isFinite(bruto.dia) ? bruto.dia : 1,
    hora: Number.isFinite(bruto.hora) ? bruto.hora : 0,
    minuto: Number.isFinite(bruto.minuto) ? bruto.minuto : 0,
  };
}

/** "Dia 3 · 14:05" — o relógio de jogo em linguagem de mesa. */
export function formatarRelogio(dataHora) {
  if (typeof dataHora === "number") {
    const dia = Math.floor(dataHora / HORAS_POR_DIA) + 1;
    const hora = Math.floor(dataHora % HORAS_POR_DIA);
    const minuto = Math.round((dataHora % 1) * 60) % 60;
    return `Dia ${dia} · ${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
  }
  const r = relogioDe({ inGameDatetime: dataHora });
  return `Dia ${r.dia} · ${String(r.hora).padStart(2, "0")}:${String(r.minuto).padStart(2, "0")}`;
}

/** Madrugada, manhã, tarde ou noite — o que amarra o relógio à ficção. */
export function periodoDoDia(dataHora) {
  const hora = typeof dataHora === "number"
    ? Math.floor(dataHora % HORAS_POR_DIA)
    : relogioDe({ inGameDatetime: dataHora }).hora;
  if (hora < 5) return "madrugada";
  if (hora < 12) return "manhã";
  if (hora < 18) return "tarde";
  return "noite";
}

/** Quanto o grupo come por dia. Mora em `party.flags` — campo já permitido. */
export const CONSUMO_PADRAO_POR_DIA = 1;

export function consumoPorDia(party) {
  const v = party?.flags?.consumoPorDia;
  return Number.isFinite(v) && v >= 0 ? v : CONSUMO_PADRAO_POR_DIA;
}

/**
 * "12 rações" · "sem controle" — os suprimentos como o jogador os lê.
 * `null` é legítimo: a instância nasce sem controle de comida (é da F6), e
 * dizer "0" seria mentir sobre o grupo estar passando fome.
 */
export function formatarSuprimentos(supplies) {
  if (!Number.isFinite(supplies)) return "sem controle";
  const n = Math.max(0, Math.round(supplies * 10) / 10);
  if (n === 0) return "acabou";
  return n === 1 ? "1 ração" : `${String(n).replace(".", ",")} rações`;
}

/* ════════════════════════════════════════════════════════════════════
 *  O RITMO DA VIAGEM  (design §5.4, movimento 4)
 *  --------------------------------------------------------------------
 *  *"percorre a curva da trilha no ritmo das horas da aresta"*. Ritmo, não
 *  duração literal: uma trilha de 9 horas não pode levar 9 horas de tela.
 *  A conta abaixo é a tradução — proporcional às horas, com piso (senão a
 *  viagem curta vira um piscar) e teto (senão a longa vira espera).
 * ══════════════════════════════════════════════════════════════════ */

export const DURACAO_MINIMA = 0.9;   // segundos
export const DURACAO_MAXIMA = 5.5;   // segundos
export const SEGUNDOS_POR_HORA_DE_VIAGEM = 0.32;

/**
 * Quantos segundos de tela custa uma viagem de `horas` de jogo.
 *
 * @param {number} horas
 * @param {number} [ritmo=1] `speedModifier` do grupo: 2 = o dobro da pressa.
 * @returns {number} segundos, sempre entre `DURACAO_MINIMA` e `DURACAO_MAXIMA`.
 */
export function duracaoDaViagem(horas, ritmo = 1) {
  const h = Number.isFinite(horas) && horas > 0 ? horas : 0;
  const r = Number.isFinite(ritmo) && ritmo > 0 ? ritmo : 1;
  const bruta = (h * SEGUNDOS_POR_HORA_DE_VIAGEM) / r;
  return Math.max(DURACAO_MINIMA, Math.min(DURACAO_MAXIMA, bruta));
}

/**
 * A velocidade a passar para `avancarViagem`, em unidades de mundo por
 * segundo: o comprimento inteiro dividido pela duração desejada.
 *
 * É isto que faz o marcador andar em velocidade CONSTANTE mesmo em curva —
 * `pontoNaFracao` já mede o `t` no comprimento real (ver `model/viagem.js`).
 *
 * @param {object} viagem retorno de `iniciarViagem`.
 * @param {number} [ritmo=1]
 * @returns {number}
 */
export function velocidadeDaViagem(viagem, ritmo = 1) {
  const comprimento = Number.isFinite(viagem?.comprimento) ? viagem.comprimento : 0;
  if (!(comprimento > 0)) return 0;
  return comprimento / duracaoDaViagem(viagem?.horas, ritmo);
}

/**
 * O raio da névoa que a viagem abre ao longo do caminho.
 *
 * Metade do raio de chegada, com piso: viajar é enxergar a beira da estrada,
 * não o horizonte inteiro. O horizonte é a recompensa de CHEGAR (AC-6).
 */
export const RAIO_MINIMO_DA_ESTRADA = 60;

export function raioDaEstrada(raioPadrao) {
  const r = Number.isFinite(raioPadrao) && raioPadrao > 0 ? raioPadrao : 120;
  return Math.max(RAIO_MINIMO_DA_ESTRADA, r * 0.5);
}

/* ════════════════════════════════════════════════════════════════════
 *  RÓTULOS PARA GENTE (e para leitor de tela)
 * ══════════════════════════════════════════════════════════════════ */

/** Como um lugar se chama na mesa — o rumor não entrega o nome (AC-1). */
export function nomeNaMesa(no) {
  if (!no) return "lugar desconhecido";
  if (no.estado === "rumored") return texto(no.rumorLabel) || "Alguma coisa por aqui";
  return texto(no.name) || "Lugar sem nome";
}

/**
 * O `aria-label` de um nó na mesa: onde está o grupo, para onde dá para ir,
 * e o que é só boato.
 *
 * @param {object} no
 * @param {{aqui?:boolean, destino?:object|null}} contexto
 */
export function rotuloNaMesa(no, contexto = {}) {
  const partes = [nomeNaMesa(no)];
  if (no?.estado === "rumored") partes.push("apenas um rumor");
  if (contexto.aqui) partes.push("o grupo está aqui");
  else if (contexto.destino) partes.push(`viajar, ${formatarHoras(contexto.destino.horas)}`);
  else partes.push("sem caminho conhecido daqui");
  return partes.join(", ");
}

/** "3 lugares e 2 trilhas" — o resumo do que a revelação acabou de acender. */
export function resumoDaRevelacao(nosAlterados, trilhasAlteradas) {
  const n = lista(nosAlterados).length;
  const t = lista(trilhasAlteradas).length;
  const pedacos = [];
  if (n > 0) pedacos.push(n === 1 ? "1 lugar" : `${n} lugares`);
  if (t > 0) pedacos.push(t === 1 ? "1 trilha" : `${t} trilhas`);
  if (pedacos.length === 0) return "";
  return pedacos.join(" e ");
}

/* ════════════════════════════════════════════════════════════════════
 *  O PERCURSO NO CANVAS
 *  --------------------------------------------------------------------
 *  O rastro do que o grupo já andou nesta viagem. Vai no canvas, junto das
 *  trilhas (design §5.3) — não é focável, não precisa de DOM.
 * ══════════════════════════════════════════════════════════════════ */

/** Dourado do rastro, literal: canvas 2D não resolve `var(--gold)`. */
export const COR_DO_RASTRO = "rgba(233,213,160,0.95)";

/**
 * Pinta o trecho já percorrido por cima da trilha.
 *
 * @param {CanvasRenderingContext2D|null} ctx `null` é no-op (jsdom).
 * @param {{pontos:Array, pan:{x,y}, scale:number, cor?:string}} opcoes
 * @returns {{pintou:boolean}}
 */
export function pintarPercurso(ctx, opcoes = {}) {
  const pontos = lista(opcoes.pontos).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!ctx || typeof ctx.beginPath !== "function" || pontos.length < 2) return { pintou: false };

  const s = Number.isFinite(opcoes.scale) && opcoes.scale > 0 ? opcoes.scale : 1;
  const px = Number.isFinite(opcoes.pan?.x) ? opcoes.pan.x : 0;
  const py = Number.isFinite(opcoes.pan?.y) ? opcoes.pan.y : 0;

  ctx.save?.();
  if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = opcoes.cor || COR_DO_RASTRO;
  ctx.lineWidth = Math.max(2.5, 4.2 * Math.max(0.55, Math.min(2.2, s)));
  ctx.beginPath();
  ctx.moveTo(pontos[0].x * s + px, pontos[0].y * s + py);
  for (let i = 1; i < pontos.length; i += 1) {
    ctx.lineTo(pontos[i].x * s + px, pontos[i].y * s + py);
  }
  ctx.stroke();
  ctx.restore?.();
  return { pintou: true };
}
