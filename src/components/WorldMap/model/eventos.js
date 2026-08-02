/* ════════════════════════════════════════════════════════════════════
 *  OS EVENTOS DO MAPA-MÚNDI  (spec 0028 · F5 · AC-1, AC-9)
 *  --------------------------------------------------------------------
 *  Um evento é o que o mestre ancora no mapa para acontecer quando o
 *  grupo passar por perto. O documento vive no molde — em
 *  `users/{uid}/worldmaps/{mapId}/events/{eventId}` (design §3) — e tem
 *  a forma:
 *
 *      { id, anchor: { type:'node'|'edge'|'point', refId?, x?, y? },
 *        title, playerText, gmText,
 *        trigger, triggerConfig, isRepeatable, linkedSceneId,
 *        reveals: { nodeIds[], edgeIds[], flags[] } }
 *
 *  ── AS DUAS INVARIANTES DESTE ARQUIVO ───────────────────────────────
 *
 *  1. **O gatilho é determinístico.** `avaliarGatilhos` é função pura. A
 *     chance do `on_travel` é resolvida pelo `sorteio` que vem no
 *     contexto — nunca por aleatoriedade interna. Quem chama (o cliente
 *     do mestre) é quem sorteia; aqui só se compara número. É o que
 *     permite testar chance sem mock e reproduzir uma sessão.
 *
 *  2. **AC-1: o segredo é estrutural.** `projecaoDoEvento` devolve
 *     `{ id, title, playerText }` e mais nada. `gmText`, `trigger`,
 *     `triggerConfig` e `reveals` **não existem como chave** no payload
 *     que vai para `campaigns/.../revealed/`. Não é filtro de render: o
 *     campo não é copiado. `__tests__/eventos.test.js` varre o JSON
 *     serializado e falha se qualquer um deles aparecer.
 *
 *  ── PUREZA ──────────────────────────────────────────────────────────
 *  Sem React, sem Firebase, sem DOM, sem `Date.now()`, sem aleatoriedade
 *  interna. Nada muta a entrada. Quando nada muda, devolve-se **a mesma
 *  referência** — o padrão que `revelacao.js` já usa.
 *
 *  Gate: `__tests__/eventos.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { distanciaAteCurva } from "./curves";
import { pontosDaTrilha } from "./graph";
import { revelarManualmente } from "./revelacao";

/* ── Os seis gatilhos do briefing ───────────────────────────────────── */

/**
 * Os seis tipos de gatilho, na ordem do briefing. `label` e `hint` são para
 * a tela do ateliê — o mestre escolhe por aqui.
 */
export const GATILHOS = Object.freeze(
  [
    {
      id: "on_arrival",
      label: "Ao chegar",
      hint: "Dispara quando o grupo chega ao nó onde o evento está ancorado.",
    },
    {
      id: "on_proximity",
      label: "Por proximidade",
      hint: "Dispara quando o grupo entra no raio em volta da âncora, mesmo sem parar lá.",
    },
    {
      id: "on_check",
      label: "Por teste de perícia",
      hint: "Não acontece sozinho: só quando o mestre resolve um teste e ele passa.",
    },
    {
      id: "on_travel",
      label: "Ao percorrer a trilha",
      hint: "Dispara durante a viagem pela trilha ancorada, sujeito à chance definida.",
    },
    {
      id: "manual",
      label: "À mão do mestre",
      hint: "Fica armado e só sai quando o mestre solta na mesa.",
    },
    {
      id: "flag",
      label: "Por marca do grupo",
      hint: "Dispara quando a marca escolhida está ativa nas flags do grupo.",
    },
  ].map((g) => Object.freeze(g)),
);

/**
 * Por que o evento disparou, em português, pronto para a fila do mestre
 * (design §2, S2: "fila de eventos: o que disparou, o que está armado").
 */
export const MOTIVOS = Object.freeze({
  on_arrival: "O grupo chegou ao lugar onde o evento está ancorado.",
  on_proximity: "O grupo entrou no raio do evento.",
  on_check: "Um teste de perícia resolveu o evento.",
  on_travel: "O grupo percorreu a trilha onde o evento está ancorado.",
  manual: "O mestre soltou o evento na mesa.",
  flag: "A marca que arma o evento está ativa no grupo.",
});

/** Os três jeitos de ancorar um evento no mapa (design §3). */
export const TIPOS_DE_ANCORA = Object.freeze(["node", "edge", "point"]);

/**
 * Raio de proximidade quando o `triggerConfig` não diz qual é.
 * Mesmo número do raio de revelação padrão, e pela mesma razão: é a distância
 * em que "estar perto" começa a significar alguma coisa neste mapa.
 */
export const RAIO_DE_PROXIMIDADE_PADRAO = 120;

/**
 * Gatilho de um evento recém-criado. `manual` de propósito: é o único que
 * **não dispara sozinho**, então um evento meio escrito nunca surpreende a mesa.
 */
export const GATILHO_PADRAO = "manual";

/** Gatilhos que não fazem sentido sem uma âncora no mapa. */
const GATILHOS_ANCORADOS = ["on_arrival", "on_proximity", "on_travel"];

const idValido = (v) => typeof v === "string" && v.trim() !== "";
const listaDe = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (typeof v === "string" ? v : "");
const ehObjeto = (v) => !!v && typeof v === "object";
const ehPonto = (p) => ehObjeto(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
const listaDeIds = (v) => listaDe(v).filter(idValido);

/** O gatilho existe na tabela? */
export function gatilhoConhecido(id) {
  return GATILHOS.some((g) => g.id === id);
}

/** O gatilho pela id, ou `null`. Devolve a entrada congelada da tabela. */
export function getGatilho(id) {
  return GATILHOS.find((g) => g.id === id) || null;
}

/* ── criarEvento — a normalização ───────────────────────────────────── */

function normalizarAncora(a) {
  if (!ehObjeto(a)) return null;
  return {
    type: typeof a.type === "string" ? a.type : null,
    refId: idValido(a.refId) ? a.refId : null,
    x: Number.isFinite(a.x) ? a.x : null,
    y: Number.isFinite(a.y) ? a.y : null,
  };
}

function normalizarConfig(tc) {
  if (!ehObjeto(tc)) return null;
  const copia = { ...tc };
  if (ehObjeto(tc.check)) copia.check = { ...tc.check };
  return copia;
}

/**
 * Um evento do molde, com todos os campos do design §3 garantidos.
 *
 * Nunca guarda a referência da entrada — `anchor`, `triggerConfig` e `reveals`
 * saem copiados, para o editor poder mexer no resultado sem corromper o
 * documento de origem. Ids tortos dentro de `reveals` são descartados em
 * silêncio: revelar um id que não é id não revela nada.
 *
 * Não inventa `id` (o Firestore batiza) e não valida — quem acusa é
 * `validarEvento`, que é diagnóstico e não bloqueio, como `validarGrafo`.
 *
 * @param {object} [dados]
 * @returns {object} evento novo.
 */
export function criarEvento(dados) {
  const d = ehObjeto(dados) ? dados : {};
  return {
    id: idValido(d.id) ? d.id : null,
    anchor: normalizarAncora(d.anchor),
    title: texto(d.title),
    playerText: texto(d.playerText),
    gmText: texto(d.gmText),
    trigger: idValido(d.trigger) ? d.trigger : GATILHO_PADRAO,
    triggerConfig: normalizarConfig(d.triggerConfig),
    isRepeatable: !!d.isRepeatable,
    linkedSceneId: idValido(d.linkedSceneId) ? d.linkedSceneId : null,
    reveals: {
      nodeIds: listaDeIds(d.reveals?.nodeIds),
      edgeIds: listaDeIds(d.reveals?.edgeIds),
      flags: listaDeIds(d.reveals?.flags),
    },
  };
}

/* ── Geometria da proximidade ───────────────────────────────────────── */

/**
 * Distância da posição do grupo até a âncora do evento.
 *
 * - **ponto**: distância euclidiana até `{x, y}`;
 * - **nó**: até a posição do nó — exige o grafo no contexto;
 * - **trilha**: até a **curva** amostrada, não até a corda entre as pontas —
 *   numa trilha bem curvada as duas coisas ficam longe uma da outra.
 *
 * Sem como resolver a âncora, devolve `Infinity`: o evento **não dispara**, em
 * vez de chutar uma posição. Falhar fechado é a postura certa aqui — um chute
 * dispararia evento na hora errada e queimaria a cena do mestre.
 */
function distanciaAteAncora(anchor, posicao, grafo) {
  if (!ehPonto(posicao) || !ehObjeto(anchor)) return Infinity;

  if (anchor.type === "point") {
    if (!ehPonto(anchor)) return Infinity;
    return Math.hypot(posicao.x - anchor.x, posicao.y - anchor.y);
  }

  if (!idValido(anchor.refId)) return Infinity;

  if (anchor.type === "node") {
    const no = listaDe(grafo?.nos).find((n) => n?.id === anchor.refId);
    if (!ehPonto(no)) return Infinity;
    return Math.hypot(posicao.x - no.x, posicao.y - no.y);
  }

  if (anchor.type === "edge") {
    const trilha = listaDe(grafo?.trilhas).find((t) => t?.id === anchor.refId);
    if (!trilha) return Infinity;
    const pontos = pontosDaTrilha(trilha, listaDe(grafo?.nos));
    if (pontos.length === 0) return Infinity;
    return distanciaAteCurva(posicao, pontos);
  }

  return Infinity;
}

function raioDe(triggerConfig) {
  const r = triggerConfig?.radius;
  return Number.isFinite(r) && r > 0 ? r : RAIO_DE_PROXIMIDADE_PADRAO;
}

/* ── A chance do on_travel — aleatoriedade por parâmetro ────────────── */

/** O sorteio pode chegar como número já sorteado ou como função sem argumento. */
function valorDoSorteio(sorteio) {
  const v = typeof sorteio === "function" ? sorteio() : sorteio;
  return Number.isFinite(v) ? v : null;
}

/**
 * A chance passou?
 *
 * `chance` é **fração de 0 a 1**. Sem chance declarada, é certeza (1) — o caso
 * comum de um evento roteirizado na trilha. Chance menor que 1 **exige** o
 * `sorteio` no contexto: sem ele o evento não dispara, porque a alternativa
 * seria este módulo sortear por conta própria e deixar de ser puro.
 *
 * A borda pertence ao lado de fora (`valor < chance`), como em todo intervalo
 * meio-aberto: com `chance` 0 nada dispara, com `chance` 1 tudo dispara.
 */
function chancePassou(triggerConfig, sorteio) {
  const bruta = triggerConfig?.chance;
  const chance = Number.isFinite(bruta) ? bruta : 1;
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  const valor = valorDoSorteio(sorteio);
  if (valor === null) return false;
  return valor < chance;
}

/** As flags do grupo chegam como lista de marcas ou como mapa `{marca: bool}`. */
function temFlag(flags, chave) {
  if (!idValido(chave)) return false;
  if (Array.isArray(flags)) return flags.includes(chave);
  if (ehObjeto(flags)) return !!flags[chave];
  return false;
}

/* ── avaliarGatilhos — o centro ─────────────────────────────────────── */

function conjuntoDe(jaDisparados) {
  if (jaDisparados instanceof Set) return jaDisparados;
  return new Set(listaDeIds(jaDisparados));
}

function disparouPeloContexto(evento, gatilho, ctx) {
  const anchor = evento.anchor;
  const tc = evento.triggerConfig;

  switch (gatilho) {
    case "on_arrival":
      return (
        anchor?.type === "node" &&
        idValido(anchor.refId) &&
        idValido(ctx.noId) &&
        anchor.refId === ctx.noId
      );

    case "on_proximity":
      return distanciaAteAncora(anchor, ctx.posicao, ctx.grafo) <= raioDe(tc);

    case "on_travel":
      return (
        anchor?.type === "edge" &&
        idValido(anchor.refId) &&
        idValido(ctx.trilhaId) &&
        anchor.refId === ctx.trilhaId &&
        chancePassou(tc, ctx.sorteio)
      );

    case "flag":
      return temFlag(ctx.flags, tc?.flagKey);

    /* `on_check` e `manual` não acontecem sozinhos — por definição. Só saem
     * por `dispararPorTeste` e `dispararManualmente`. */
    case "on_check":
    case "manual":
    default:
      return false;
  }
}

/**
 * **O centro do modelo de eventos.** Quais eventos disparam neste instante?
 *
 * Função pura: o mesmo `contexto` devolve sempre a mesma lista. A aleatoriedade
 * do `on_travel` entra pelo `contexto.sorteio` — este módulo não sorteia nada.
 *
 * Regras, uma por gatilho:
 * - `on_arrival` — o grupo chegou ao nó ancorado;
 * - `on_proximity` — a posição do grupo entrou no `radius` do `triggerConfig`
 *   (âncora de ponto, de nó ou de trilha; as duas últimas exigem `contexto.grafo`);
 * - `on_travel` — o grupo percorre a trilha ancorada e a `chance` passou;
 * - `on_check` — **nunca** aqui: só por `dispararPorTeste`;
 * - `manual` — **nunca** aqui: só por `dispararManualmente`;
 * - `flag` — `contexto.flags` contém a `flagKey` do `triggerConfig`.
 *
 * E, acima de todas: **evento já disparado e não repetível nunca dispara de
 * novo**. Evento sem `id` também não dispara — não haveria como marcá-lo como
 * disparado em `gm.triggeredEventIds` (design §3), e ele voltaria a cada passo.
 *
 * @param {Array<object>} eventos os eventos do molde (só o mestre os tem).
 * @param {{noId?:string, trilhaId?:string, posicao?:{x:number,y:number},
 *          flags?:string[]|object, sorteio?:number|Function,
 *          grafo?:{nos:Array,trilhas:Array}}} contexto
 * @param {string[]|Set<string>} jaDisparados ids já disparados nesta mesa.
 * @returns {Array<{evento:object, motivo:string}>} na ordem de entrada.
 *   `evento` é **a referência original** — quem chama é o cliente do mestre e
 *   precisa do `gmText` e do `reveals` para orquestrar.
 */
export function avaliarGatilhos(eventos, contexto, jaDisparados) {
  const ctx = ehObjeto(contexto) ? contexto : {};
  const disparados = conjuntoDe(jaDisparados);

  return listaDe(eventos).reduce((saida, evento) => {
    if (!ehObjeto(evento) || !idValido(evento.id)) return saida;
    if (disparados.has(evento.id) && !evento.isRepeatable) return saida;

    const gatilho = evento.trigger;
    if (!gatilhoConhecido(gatilho)) return saida;
    if (!disparouPeloContexto(evento, gatilho, ctx)) return saida;

    saida.push({ evento, motivo: MOTIVOS[gatilho] });
    return saida;
  }, []);
}

/* ── Disparo à mão e por teste ──────────────────────────────────────── */

/**
 * O mestre solta o evento na mesa (design §2, S2).
 *
 * Aceita **qualquer** gatilho de propósito: o mestre é dono da ficção e pode
 * antecipar um `on_arrival` ou soltar um `on_check` sem pedir rolagem.
 *
 * @returns {{evento:object, motivo:string}|null} `null` para evento sem id.
 */
export function dispararManualmente(evento) {
  if (!ehObjeto(evento) || !idValido(evento.id)) return null;
  return { evento, motivo: MOTIVOS.manual };
}

/**
 * O resultado de um teste de perícia resolve um evento `on_check` (AC-9).
 *
 * **A rolagem vem de fora** — `src/domain/dice.js`, o motor único do projeto.
 * Aqui só chega o veredito. O fracasso devolve `null`: nada dispara, e nada é
 * dito ao jogador, que é o que mantém o segredo de pé.
 *
 * @param {object} evento precisa ser de gatilho `on_check`.
 * @param {boolean} sucesso o veredito do teste.
 * @returns {{evento:object, motivo:string}|null}
 */
export function dispararPorTeste(evento, sucesso) {
  if (!sucesso) return null;
  if (!ehObjeto(evento) || !idValido(evento.id)) return null;
  if (evento.trigger !== "on_check") return null;
  return { evento, motivo: MOTIVOS.on_check };
}

/* ── aplicarEvento ──────────────────────────────────────────────────── */

/** Só ids que existem no grafo. Sem grafo, passa tudo — o chamador é o mestre. */
function filtrarPeloGrafo(ids, colecao) {
  const lista = listaDeIds(ids);
  if (!Array.isArray(colecao)) return lista;
  return lista.filter((id) => colecao.some((x) => x?.id === id));
}

/**
 * Aplica o `reveals` do evento ao estado de visibilidade da mesa.
 *
 * A revelação passa por `revelarManualmente`, então herda o `max` de
 * `revelacao.js`: **nunca regride**. Um evento que "revela" um nó já `visited`
 * não o rebaixa — devolve o estado inalterado, **pela mesma referência**.
 *
 * Ids que não existem no grafo são descartados: revelação fantasma criaria
 * entrada de estado para algo que ninguém consegue desenhar.
 *
 * As **flags não são aplicadas aqui** — elas vivem em `party.flags` (design §3)
 * e este módulo não conhece a party. A função devolve as marcas novas para o
 * chamador gravar junto com a posição do grupo, numa escrita só.
 *
 * @param {{nos:object,trilhas:object}} estado
 * @param {object} evento
 * @param {{nos:Array,trilhas:Array}} [grafo]
 * @returns {{estado:object, flags:string[], revelou:boolean,
 *            nosAlterados:Array, trilhasAlteradas:Array}}
 */
export function aplicarEvento(estado, evento, grafo) {
  const reveals = ehObjeto(evento) ? evento.reveals : null;
  const nos = filtrarPeloGrafo(reveals?.nodeIds, grafo?.nos);
  const trilhas = filtrarPeloGrafo(reveals?.edgeIds, grafo?.trilhas);
  const flags = [...new Set(listaDeIds(reveals?.flags))];

  const r = revelarManualmente(estado, { nos, trilhas });

  return {
    estado: r.estado,
    flags,
    revelou: r.mudou,
    nosAlterados: r.nosAlterados,
    trilhasAlteradas: r.trilhasAlteradas,
  };
}

/* ── projecaoDoEvento — o AC-1 do lado do código ────────────────────── */

/**
 * O que o jogador pode ver de um evento — **e só isso**.
 *
 * É esta função que monta o documento `{ kind:'event', title, playerText }` de
 * `campaigns/{cid}/worldmaps/{iid}/revealed/` (design §3). Se ela vazar, as
 * rules não têm como consertar: o dado já foi copiado para um documento que o
 * jogador lê por direito. Daí a construção ser **por lista branca literal** —
 * três campos escritos à mão, sem espalhamento de objeto, sem `delete`, sem
 * "tudo menos". Campo novo no molde não escorrega para cá por acidente.
 *
 * Fora, para sempre: `gmText`, `trigger`, `triggerConfig`, `reveals`, `anchor`,
 * `linkedSceneId` e `isRepeatable`. O teste varre o JSON serializado.
 *
 * @param {object} evento
 * @returns {{id:string, title:string, playerText:string}|null} objeto novo;
 *   `null` quando o evento não tem id (não há documento onde gravá-lo).
 */
export function projecaoDoEvento(evento) {
  if (!ehObjeto(evento) || !idValido(evento.id)) return null;
  return {
    id: evento.id,
    title: texto(evento.title),
    playerText: texto(evento.playerText),
  };
}

/* ── validarEvento ──────────────────────────────────────────────────── */

/**
 * Problemas do evento, em português, prontos para a tela do ateliê.
 *
 * É **diagnóstico, não bloqueio** — mesma postura de `validarGrafo`: um evento
 * pela metade é trabalho em andamento, não erro fatal. A lista existe para o
 * ateliê avisar antes de a mesa começar.
 *
 * Tipos devolvidos: `evento-sem-id`, `gatilho-desconhecido`, `ancora-invalida`,
 * `ancora-orfa`, `teste-ausente`, `revelacao-inexistente`.
 *
 * @param {object} evento
 * @param {{nos:Array,trilhas:Array}} [grafo] sem ele, as checagens que dependem
 *   do mapa (âncora órfã e revelação inexistente) são puladas.
 * @returns {Array<{tipo:string, id:string|null, mensagem:string}>}
 */
export function validarEvento(evento, grafo) {
  const e = ehObjeto(evento) ? evento : {};
  const id = idValido(e.id) ? e.id : null;
  const problemas = [];
  const acusar = (tipo, mensagem) => problemas.push({ tipo, id, mensagem });

  if (!id) {
    acusar("evento-sem-id", "O evento precisa de um identificador para ser rastreado na mesa.");
  }

  const gatilho = e.trigger;
  if (!gatilhoConhecido(gatilho)) {
    acusar(
      "gatilho-desconhecido",
      `O gatilho "${texto(gatilho) || "(vazio)"}" não é um dos seis conhecidos.`,
    );
  }

  /* ── Âncora ──────────────────────────────────────────────────────── */
  const anchor = e.anchor;
  const precisaDeAncora = GATILHOS_ANCORADOS.includes(gatilho);

  if (!ehObjeto(anchor)) {
    if (precisaDeAncora) {
      acusar("ancora-invalida", "Este gatilho precisa de uma âncora: um nó, uma trilha ou um ponto do mapa.");
    }
  } else if (!TIPOS_DE_ANCORA.includes(anchor.type)) {
    acusar("ancora-invalida", "A âncora precisa ser de nó, de trilha ou de ponto do mapa.");
  } else if (anchor.type === "point") {
    if (!ehPonto(anchor)) {
      acusar("ancora-invalida", "A âncora de ponto precisa de uma posição (x e y) no mapa.");
    }
  } else if (!idValido(anchor.refId)) {
    acusar(
      "ancora-invalida",
      anchor.type === "node"
        ? "A âncora precisa dizer em qual nó o evento está preso."
        : "A âncora precisa dizer em qual trilha o evento está preso.",
    );
  } else if (grafo) {
    const colecao = anchor.type === "node" ? listaDe(grafo.nos) : listaDe(grafo.trilhas);
    if (!colecao.some((x) => x?.id === anchor.refId)) {
      acusar(
        "ancora-orfa",
        anchor.type === "node"
          ? `O evento está ancorado num nó que não existe mais (${anchor.refId}).`
          : `O evento está ancorado numa trilha que não existe mais (${anchor.refId}).`,
      );
    }
  }

  /* ── on_check exige o teste ──────────────────────────────────────── */
  if (gatilho === "on_check") {
    const check = e.triggerConfig?.check;
    if (!ehObjeto(check) || !idValido(check.skill) || !Number.isFinite(check.dc)) {
      acusar(
        "teste-ausente",
        "Um evento por teste precisa dizer qual perícia e qual dificuldade (CD).",
      );
    }
  }

  /* ── reveals apontando para o vazio ──────────────────────────────── */
  if (grafo) {
    const conferir = (ids, colecao, rotulo) => {
      listaDeIds(ids).forEach((alvo) => {
        if (listaDe(colecao).some((x) => x?.id === alvo)) return;
        acusar("revelacao-inexistente", `O evento revela ${rotulo} que não existe no mapa (${alvo}).`);
      });
    };
    conferir(e.reveals?.nodeIds, grafo.nos, "um nó");
    conferir(e.reveals?.edgeIds, grafo.trilhas, "uma trilha");
  }

  return problemas;
}
