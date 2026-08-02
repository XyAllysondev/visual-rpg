/* ════════════════════════════════════════════════════════════════════
 *  EVENTOS E PROCURA NA MESA  (spec 0028 · F5 · AC-1, AC-8, AC-9)
 *  --------------------------------------------------------------------
 *  Três coisas são provadas aqui, e a terceira é a que importa:
 *
 *   1. o disparo — chegar num nó avalia os gatilhos, publica o texto
 *      público, marca o id em `gm.triggeredEventIds` e não redispara;
 *   2. a fila do mestre (AC-8) — o que disparou, o que está armado, o que
 *      ele segurou, com o `gmText` só no lado dele;
 *   3. **a procura (AC-9)** — a opção existe em qualquer nó, e o fracasso
 *      num lugar COM segredo produz, no cliente do jogador, um HTML
 *      IDÊNTICO caractere a caractere ao de um lugar onde não há nada.
 *      Não "parecido": igual. É a comparação do §5 deste arquivo.
 *
 *  Fronteira mockada: só o I/O (`../mesaStore`, `../worldMapStore`). Todo o
 *  modelo (`model/eventos.js`, `model/descoberta.js`, `model/revelacao.js`)
 *  e o motor de dados (`src/domain/dice.js`) rodam de VERDADE — a rolagem é
 *  fixada por `jest.spyOn(Math, "random")`, que é exatamente o gancho que
 *  `dice.js` promete no cabeçalho dele.
 * ════════════════════════════════════════════════════════════════════ */

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../mesaStore", () => ({
  useInstancias: jest.fn(),
  useReveladoNaMesa: jest.fn(),
  useParty: jest.fn(),
  useFogDaMesa: jest.fn(),
  useGmDaMesa: jest.fn(),
  publicarRevelacao: jest.fn(),
  moverGrupo: jest.fn(),
  atualizarParty: jest.fn(),
  atualizarGm: jest.fn(),
  getFundoDaMesa: jest.fn(),
  mestreDaInstancia: jest.fn(),
  atualizarViagem: jest.fn(),
  concluirViagem: jest.fn(),
  projecaoDaViagem: jest.fn(),
  reservarPendencia: jest.fn(),
  resolverPendencia: jest.fn(),
  salvarDeltaDaNevoa: jest.fn(),
  consolidarNevoaDaMesa: jest.fn(),
}));

jest.mock("../worldMapStore", () => ({
  useGrafo: jest.fn(),
  useEventos: jest.fn(),
}));

import MesaDoMapaMundi from "../Mesa";
import {
  useInstancias, useReveladoNaMesa, useParty, useFogDaMesa, useGmDaMesa,
  publicarRevelacao, moverGrupo, atualizarParty, atualizarGm,
  getFundoDaMesa, mestreDaInstancia,
} from "../mesaStore";
import {
  atualizarViagem, concluirViagem, projecaoDaViagem, reservarPendencia, resolverPendencia,
  salvarDeltaDaNevoa, consolidarNevoaDaMesa,
} from "../mesaStore";
import { useGrafo, useEventos } from "../worldMapStore";
import { criarEvento } from "../model/eventos";
import { MENSAGEM_ACHADO, MENSAGEM_SEM_ACHADO } from "../model/descoberta";
import {
  GATILHOS_NA_MAO, ID_DA_PROCURA, PEDIDO_DE_PROCURA, TITULO_DA_PROCURA,
  contextoDoPasso, filaDoMestre, flagsComAsNovas,
} from "../Mesa/eventosUi";

/* ── Cenário ─────────────────────────────────────────────────────────── */

const RETANGULO = {
  left: 0, top: 0, width: 900, height: 560, right: 900, bottom: 560, x: 0, y: 0,
  toJSON() { return this; },
};

const MESTRE = "mestre-1";
const JOGADOR = "jogador-9";
const CAMPANHA = "camp-1";
const INSTANCIA = `${MESTRE}~mapa-1`;

const INSTANCIAS = [{
  id: INSTANCIA, name: "As Terras Partidas", width: 2400, height: 1600,
  fogEnabled: false, masterUid: MESTRE, startNodeId: "n1", ilustracao: null,
  backgroundRef: null, backgroundUrl: null,
}];

/** O molde: a cripta só se alcança pela trilha secreta, e ela tem teste. */
const MOLDE = {
  nos: [
    { id: "n1", name: "Vila Candeia", type: "town", x: 200, y: 200 },
    { id: "n2", name: "Capela Velha", type: "poi", x: 800, y: 400 },
    { id: "n3", name: "Cripta Selada", type: "secret", x: 900, y: 900 },
  ],
  trilhas: [
    { id: "t1", fromNodeId: "n1", toNodeId: "n2", travelHours: 6, pathPoints: [] },
    {
      id: "t2", fromNodeId: "n2", toNodeId: "n3", travelHours: 1, pathPoints: [],
      isSecret: true, discoveryCheck: { skill: "Investigação", dc: 15 },
    },
  ],
};

/** O mesmo mapa, mas sem nada para achar na Capela. */
const MOLDE_SEM_SEGREDO = {
  nos: MOLDE.nos.filter((n) => n.id !== "n3"),
  trilhas: [MOLDE.trilhas[0]],
};

const REVELADO = [
  { id: "no_n1", kind: "node", nodeId: "n1", name: "Vila Candeia", type: "town", x: 200, y: 200, state: "visited", description: "", icon: null, color: null },
  { id: "no_n2", kind: "node", nodeId: "n2", name: "Capela Velha", type: "poi", x: 800, y: 400, state: "discovered", description: "", icon: null, color: null },
  { id: "tr_t1", kind: "edge", edgeId: "t1", fromNodeId: "n1", toNodeId: "n2", pathPoints: [], travelHours: 6, state: "revealed" },
];

const EV_CHEGADA = criarEvento({
  id: "ev-chegada",
  anchor: { type: "node", refId: "n2" },
  title: "O sino range",
  playerText: "O sino da capela range sozinho.",
  gmText: "O sino é a corda de uma armadilha de queda.",
  trigger: "on_arrival",
});

const EV_MAO = criarEvento({
  id: "ev-mao",
  anchor: { type: "point", x: 500, y: 500 },
  title: "O mendigo insistente",
  playerText: "Um homem magro puxa a sua manga.",
  gmText: "É o informante do Conde.",
  trigger: "manual",
  reveals: { nodeIds: [], edgeIds: [], flags: ["o-conde-sabe"] },
});

const EV_TESTE = criarEvento({
  id: "ev-teste",
  anchor: { type: "node", refId: "n2" },
  title: "A inscrição na pedra",
  playerText: "Há letras gastas na soleira.",
  gmText: "Diz o nome verdadeiro do santo.",
  trigger: "on_check",
  triggerConfig: { check: { skill: "Ocultismo", dc: 12 } },
});

/* Ancorado longe de qualquer nó de propósito: aqui ele serve para provar a
   GAVETA "armado" (gatilho que age sozinho), não o disparo por proximidade —
   e um evento que saísse no meio dos outros testes embaralharia as asserções. */
const EV_ARMADO = criarEvento({
  id: "ev-armado",
  anchor: { type: "point", x: 9000, y: 9000 },
  title: "A carroça de feno",
  playerText: "Uma carroça atravanca a rua.",
  trigger: "on_proximity",
  triggerConfig: { radius: 50 },
});

const EVENTOS = [EV_CHEGADA, EV_MAO, EV_TESTE, EV_ARMADO];

const partyEm = (noId) => ({
  id: "estado", currentNodeId: noId, x: 0, y: 0,
  inGameDatetime: null, supplies: 5, speedModifier: 1, flags: {},
});

/* ── Montagem ────────────────────────────────────────────────────────── */

function comCenario({
  molde = MOLDE, eventos = EVENTOS, revelado = REVELADO,
  party = partyEm("n1"), gm = null,
} = {}) {
  useInstancias.mockReturnValue({ instancias: INSTANCIAS, loading: false, error: null });
  useReveladoNaMesa.mockReturnValue({
    revelado,
    nos: revelado.filter((d) => d.kind === "node"),
    trilhas: revelado.filter((d) => d.kind === "edge"),
    eventos: revelado.filter((d) => d.kind === "event"),
    loading: false,
    error: null,
  });
  useParty.mockReturnValue({ party, loading: false, error: null });
  useFogDaMesa.mockReturnValue({ mascara: null, bytes: 0, loading: false, error: null });
  useGmDaMesa.mockReturnValue({ gm, loading: false, error: null });
  useGrafo.mockReturnValue({ nos: molde.nos, trilhas: molde.trilhas, loading: false, error: null });
  useEventos.mockReturnValue({ eventos, loading: false, error: null });
}

const montarMestre = (props = {}) => render(
  <MesaDoMapaMundi campaignId={CAMPANHA} uid={MESTRE} isMaster {...props} />,
);
const montarJogador = (props = {}) => render(
  <MesaDoMapaMundi campaignId={CAMPANHA} uid={JOGADOR} isMaster={false} {...props} />,
);

/** Fixa o d20: `dice.js` lê `Math.random` a cada chamada, de propósito. */
const comDado = (valor) => jest.spyOn(Math, "random").mockReturnValue(valor);
const DADO_1 = 0;        // Math.floor(0 * 20) + 1  = 1
const DADO_20 = 0.999;   // Math.floor(.999*20) + 1 = 20

/** Só as chamadas de `publicarRevelacao` que carregam evento. */
const eventosPublicados = () => publicarRevelacao.mock.calls
  .flatMap(([, , conteudo]) => conteudo.eventos || []);

beforeEach(() => {
  window.PointerEvent = window.MouseEvent;
  /* Movimento reduzido: a viagem vira corte seco e o `aoChegar` roda dentro do
     clique. É o caminho honesto de testar a chegada sem bombear rAF à mão. */
  window.matchMedia = jest.fn().mockReturnValue({ matches: true, addListener() {}, removeListener() {} });
  jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RETANGULO);
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([]); }
    disconnect() {}
  };
  global.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);

  mestreDaInstancia.mockImplementation((id) => String(id || "").split("~")[0]);
  publicarRevelacao.mockResolvedValue({ gravados: 1, pulados: 0 });
  moverGrupo.mockResolvedValue(undefined);
  atualizarParty.mockResolvedValue(undefined);
  atualizarGm.mockResolvedValue(undefined);
  getFundoDaMesa.mockResolvedValue(null);
  /* ── F7 (tempo real) ───────────────────────────────────────────────
     A chegada agora fecha `party.viagem` por transação e a decisão do
     encontro é reivindicada antes de publicar. Sem estes dublês nada disso
     resolve, e a mesa para na primeira estrada. */
  concluirViagem.mockResolvedValue({ aplicou: true, motivo: "" });
  atualizarViagem.mockResolvedValue(undefined);
  projecaoDaViagem.mockImplementation((v, extra = {}) => ({ ...(v || {}), ...extra }));
  reservarPendencia.mockImplementation(async (_c, _i, p) => ({ reservada: true, motivo: "", pendencia: p }));
  resolverPendencia.mockImplementation(async () => ({ decidida: true, motivo: "", pendencia: null }));
  salvarDeltaDaNevoa.mockResolvedValue({ id: "d_000001_teste", bytes: 12 });
  consolidarNevoaDaMesa.mockResolvedValue({ bytes: 120, apagados: 0 });
  comCenario();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.ResizeObserver;
  delete global.IntersectionObserver;
  delete window.PointerEvent;
  delete window.matchMedia;
});

/* ════════════════════════════════════════════════════════════════════
 *  1 · A ARRUMAÇÃO DA FILA  (lógica pura · AC-8)
 * ════════════════════════════════════════════════════════════════════ */
describe("filaDoMestre — as três gavetas do AC-8", () => {
  it("separa o que disparou, o que está armado e o que ele segurou", () => {
    const fila = filaDoMestre(EVENTOS, ["ev-chegada"]);
    expect(fila.disparados.map((i) => i.evento.id)).toEqual(["ev-chegada"]);
    expect(fila.armados.map((i) => i.evento.id)).toEqual(["ev-armado"]);
    expect(fila.naMao.map((i) => i.evento.id)).toEqual(["ev-mao", "ev-teste"]);
    expect(fila.total).toBe(4);
  });

  it("manual e por teste nunca contam como armados — não saem sozinhos", () => {
    expect(GATILHOS_NA_MAO).toEqual(["manual", "on_check"]);
    const fila = filaDoMestre(EVENTOS, []);
    expect(fila.armados.every((i) => !GATILHOS_NA_MAO.includes(i.evento.trigger))).toBe(true);
  });

  it("evento sem id fica fora das três — não haveria como marcá-lo como disparado", () => {
    const fila = filaDoMestre([{ title: "órfão", trigger: "manual" }, EV_MAO], []);
    expect(fila.total).toBe(1);
  });

  it("aceita Set e lista em `jaDisparados`, e sobrevive a entrada torta", () => {
    expect(filaDoMestre(EVENTOS, new Set(["ev-mao"])).disparados).toHaveLength(1);
    expect(filaDoMestre(null, null).total).toBe(0);
    expect(filaDoMestre(EVENTOS, undefined).disparados).toHaveLength(0);
  });
});

describe("contextoDoPasso e flagsComAsNovas", () => {
  it("o contexto SEMPRE leva o grafo — sem ele a proximidade falha fechado", () => {
    const ctx = contextoDoPasso(
      { noId: "n2", trilhaId: "t1", posicao: { x: 1, y: 2 } },
      { molde: MOLDE, party: partyEm("n2"), sorteio: 0.5 },
    );
    expect(ctx.grafo).toBe(MOLDE);
    expect(ctx.noId).toBe("n2");
    expect(ctx.trilhaId).toBe("t1");
    expect(ctx.posicao).toEqual({ x: 1, y: 2 });
    expect(ctx.sorteio).toBe(0.5);
  });

  it("posição torta vira `undefined`, não NaN — evento não dispara por engano", () => {
    const ctx = contextoDoPasso({ posicao: { x: "a", y: 2 } }, {});
    expect(ctx.posicao).toBeUndefined();
  });

  it("as marcas viram sempre MAPA, e `null` quando nada mudaria", () => {
    expect(flagsComAsNovas({}, ["a"])).toEqual({ a: true });
    expect(flagsComAsNovas(["b"], ["a"])).toEqual({ a: true, b: true });
    expect(flagsComAsNovas({ a: true }, ["a"])).toBeNull();
    expect(flagsComAsNovas({ a: true }, [])).toBeNull();
    expect(flagsComAsNovas(null, ["a"])).toEqual({ a: true });
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · A FILA NA TELA, E O SEGREDO QUE NÃO ATRAVESSA  (AC-1, AC-8)
 * ════════════════════════════════════════════════════════════════════ */
describe("a fila de eventos do mestre", () => {
  it("mostra as três gavetas com o que está em cada uma", async () => {
    comCenario({ gm: { triggeredEventIds: ["ev-chegada"] } });
    montarMestre();

    const fila = await screen.findByTestId("wmm-fila-de-eventos");
    expect(within(fila).getByTestId("wmm-evento-ev-chegada")).toBeInTheDocument();
    expect(within(fila).getByTestId("wmm-evento-ev-armado")).toBeInTheDocument();
    expect(within(fila).getByTestId("wmm-evento-ev-mao")).toBeInTheDocument();
    expect(fila).toHaveTextContent("4 no mapa · 1 já aconteceram");
  });

  it("o texto do mestre fica fechado atrás de um clique — mesa é tela compartilhada", async () => {
    montarMestre();
    const detalhe = await screen.findByTestId("wmm-gmtext-ev-mao");
    expect(detalhe.tagName).toBe("DETAILS");
    expect(detalhe).not.toHaveAttribute("open");
    expect(detalhe).toHaveTextContent(/só para você/i);
  });

  it("o cliente do JOGADOR não tem fila, nem gmText, nem o que não disparou", () => {
    const { container } = montarJogador();

    expect(screen.queryByTestId("wmm-fila-de-eventos")).not.toBeInTheDocument();

    const html = container.innerHTML;
    expect(html).not.toContain("armadilha de queda");
    expect(html).not.toContain("informante do Conde");
    expect(html).not.toContain("Cripta Selada");
    expect(html).not.toContain("O sino range");
    expect(html).not.toContain("Investigação");
  });

  it("o cliente do jogador NEM ASSINA o molde nem os eventos dele (AC-1)", () => {
    montarJogador();
    /* Não é filtro de render: os hooks são chamados com id vazio, então nenhum
       listener é aberto e o segredo não chega nem pela rede. */
    expect(useGrafo).toHaveBeenCalledWith("", "");
    expect(useEventos).toHaveBeenCalledWith("", "");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · O DISPARO  (AC-1, AC-8)
 * ════════════════════════════════════════════════════════════════════ */
describe("disparar eventos", () => {
  it("o mestre solta um evento na mesa e só o texto público é publicado", async () => {
    montarMestre();
    fireEvent.click(await screen.findByTestId("wmm-disparar-ev-mao"));

    await waitFor(() => expect(publicarRevelacao).toHaveBeenCalled());
    const publicados = eventosPublicados();
    expect(publicados).toHaveLength(1);
    /* A projeção tem TRÊS chaves. Nem `gmText`, nem `trigger`, nem `reveals`,
       nem `anchor` existem no payload — não são filtrados: não são copiados. */
    expect(Object.keys(publicados[0]).sort()).toEqual(["id", "playerText", "title"]);
    expect(publicados[0]).toEqual({
      id: "ev-mao",
      title: "O mendigo insistente",
      playerText: "Um homem magro puxa a sua manga.",
    });
  });

  it("o id disparado é anotado em gm.triggeredEventIds", async () => {
    montarMestre();
    fireEvent.click(await screen.findByTestId("wmm-disparar-ev-mao"));
    await waitFor(() => expect(atualizarGm).toHaveBeenCalled());
    expect(atualizarGm).toHaveBeenCalledWith(CAMPANHA, INSTANCIA, {
      triggeredEventIds: ["ev-mao"],
    });
  });

  it("as marcas do evento vão para party.flags, não para o estado do mapa", async () => {
    montarMestre();
    fireEvent.click(await screen.findByTestId("wmm-disparar-ev-mao"));
    await waitFor(() => expect(atualizarParty).toHaveBeenCalled());
    expect(atualizarParty).toHaveBeenCalledWith(CAMPANHA, INSTANCIA, {
      flags: { "o-conde-sabe": true },
    });
  });

  it("chegar ao nó ancorado dispara o on_arrival", async () => {
    montarMestre();
    fireEvent.click(await screen.findByTestId("wmm-mestre-destino-n2"));

    await waitFor(() => expect(eventosPublicados()).toHaveLength(1));
    expect(eventosPublicados()[0].id).toBe("ev-chegada");
    await waitFor(() => expect(atualizarGm).toHaveBeenCalledWith(
      CAMPANHA, INSTANCIA, { triggeredEventIds: ["ev-chegada"] },
    ));
  });

  it("evento não repetível já disparado NÃO sai de novo", async () => {
    comCenario({ gm: { triggeredEventIds: ["ev-chegada"] } });
    montarMestre();
    fireEvent.click(await screen.findByTestId("wmm-mestre-destino-n2"));

    /* A chegada continua revelando o mapa (AC-6) — o que não acontece é o
       evento sair pela segunda vez. */
    await waitFor(() => expect(publicarRevelacao).toHaveBeenCalled());
    expect(eventosPublicados()).toHaveLength(0);
  });

  it("o teste de um on_check usa o motor de dados do projeto e só dispara se passar", async () => {
    comDado(DADO_1);                    // 1 contra CD 12 → não passa
    montarMestre();
    fireEvent.click(await screen.findByTestId("wmm-teste-ev-teste"));
    await waitFor(() => expect(screen.getByTestId("wmm-anuncio"))
      .toHaveTextContent("Ocultismo: 1 contra CD 12."));
    expect(eventosPublicados()).toHaveLength(0);

    Math.random.mockReturnValue(DADO_20);   // 20 contra CD 12 → passa
    fireEvent.click(screen.getByTestId("wmm-teste-ev-teste"));
    await waitFor(() => expect(eventosPublicados()).toHaveLength(1));
    expect(eventosPublicados()[0].id).toBe("ev-teste");
  });

  it("o mural do grupo mostra o texto público, com aria-live", () => {
    comCenario({
      revelado: [...REVELADO, {
        id: "ev_ev-mao", kind: "event", eventId: "ev-mao",
        title: "O mendigo insistente", playerText: "Um homem magro puxa a sua manga.",
        state: "revealed",
      }],
    });
    montarJogador();
    const cartao = screen.getByTestId("wmm-cartao-ev-mao");
    expect(cartao).toHaveTextContent("O mendigo insistente");
    expect(cartao).toHaveTextContent("Um homem magro puxa a sua manga.");
    expect(screen.getByTestId("wmm-anuncio")).toHaveAttribute("aria-live", "polite");
  });

  it("o atalho para a cena tática só existe quando a mesa sabe navegar", async () => {
    const comCena = criarEvento({ ...EV_MAO, linkedSceneId: "cena-7" });
    comCenario({ eventos: [comCena] });

    const { unmount } = montarMestre();
    expect(await screen.findByTestId("wmm-evento-ev-mao")).toBeInTheDocument();
    expect(screen.queryByTestId("wmm-cena-ev-mao")).not.toBeInTheDocument();
    unmount();

    const onEntrarNaCena = jest.fn();
    montarMestre({ onEntrarNaCena });
    fireEvent.click(await screen.findByTestId("wmm-cena-ev-mao"));
    expect(onEntrarNaCena).toHaveBeenCalledWith("cena-7", expect.objectContaining({ id: "ev-mao" }));
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · A PROCURA EXISTE EM TODO LUGAR  (AC-9)
 * ════════════════════════════════════════════════════════════════════ */
describe("procurar", () => {
  it("o botão está lá com ou sem segredo — e é o MESMO botão", () => {
    comCenario({ party: partyEm("n1") });        // da vila não sai trilha secreta
    const { unmount } = montarMestre();
    const semSegredo = screen.getByTestId("wmm-procurar").outerHTML;
    unmount();

    comCenario({ party: partyEm("n2") });        // da capela sai, e ela tem teste
    montarMestre();
    expect(screen.getByTestId("wmm-procurar").outerHTML).toBe(semSegredo);
  });

  it("o jogador também tem o botão, e a frase dele não fala do lugar", async () => {
    comCenario({ party: partyEm("n2") });
    montarJogador();
    fireEvent.click(screen.getByTestId("wmm-procurar"));
    await waitFor(() => expect(screen.getByTestId("wmm-resultado-da-procura"))
      .toHaveTextContent(PEDIDO_DE_PROCURA));
    /* O cliente dele não resolve nada: não há molde para resolver com. */
    expect(publicarRevelacao).not.toHaveBeenCalled();
  });

  it("achar revela a trilha secreta e os dois nós dela", async () => {
    comDado(DADO_20);                            // 20 ≥ CD 15
    comCenario({ party: partyEm("n2") });
    montarMestre();

    fireEvent.click(screen.getByTestId("wmm-procurar"));
    await waitFor(() => expect(screen.getByTestId("wmm-resultado-da-procura"))
      .toHaveTextContent(MENSAGEM_ACHADO));

    const [, , conteudo] = publicarRevelacao.mock.calls.at(-1);
    expect(conteudo.trilhas.map((t) => t.trilha.id)).toEqual(["t2"]);
    /* Só a cripta entra: a capela já estava `discovered`, e revelação nunca
       regride nem se reescreve à toa (AC-6). */
    expect(conteudo.nos.map((n) => n.no.id)).toEqual(["n3"]);
    expect(conteudo.eventos[0]).toEqual({
      id: ID_DA_PROCURA, title: TITULO_DA_PROCURA, playerText: MENSAGEM_ACHADO,
    });
  });

  it("a rolagem abaixo da CD não revela nada", async () => {
    comDado(DADO_1);                             // 1 < CD 15
    comCenario({ party: partyEm("n2") });
    montarMestre();

    fireEvent.click(screen.getByTestId("wmm-procurar"));
    await waitFor(() => expect(publicarRevelacao).toHaveBeenCalled());
    const [, , conteudo] = publicarRevelacao.mock.calls.at(-1);
    expect(conteudo.nos).toEqual([]);
    expect(conteudo.trilhas).toEqual([]);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · O GATE DO AC-9: A FALHA NÃO PODE DELATAR O SEGREDO
 *  --------------------------------------------------------------------
 *  Duas mesas. Numa, a Capela esconde uma passagem com teste; na outra,
 *  não há nada ali. Nas duas o grupo procura e falha. Se qualquer coisa
 *  observável diferir — a frase, um atributo, uma classe, um `title`, o
 *  documento publicado — o jogador compara os dois lugares e descobre onde
 *  há segredo sem nunca passar num teste. Este bloco compara o HTML.
 * ════════════════════════════════════════════════════════════════════ */
describe("AC-9 · a falha num lugar COM segredo é indistinguível de um lugar SEM", () => {
  /** Procura uma vez, do lado do mestre, e devolve o que saiu da procura. */
  async function procurarComOMestre(molde) {
    comDado(DADO_1);
    comCenario({ molde, eventos: [], party: partyEm("n2") });
    const tela = montarMestre();

    fireEvent.click(screen.getByTestId("wmm-procurar"));
    await waitFor(() => expect(publicarRevelacao).toHaveBeenCalled());

    const [, , conteudo] = publicarRevelacao.mock.calls.at(-1);
    const resultado = screen.getByTestId("wmm-resultado-da-procura").outerHTML;
    tela.unmount();
    jest.clearAllMocks();
    return { conteudo, resultado };
  }

  it("o bloco do resultado tem o MESMO HTML nos dois mapas", async () => {
    const comSegredo = await procurarComOMestre(MOLDE);
    const semSegredo = await procurarComOMestre(MOLDE_SEM_SEGREDO);

    expect(comSegredo.resultado).toBe(semSegredo.resultado);
    /* E a frase é a constante do modelo, nunca uma escrita à mão aqui. */
    expect(comSegredo.resultado).toContain(MENSAGEM_SEM_ACHADO);
    expect(comSegredo.resultado).not.toMatch(/passagem|secret|trilha|falh/i);
  });

  it("o documento publicado é byte a byte o mesmo nos dois mapas", async () => {
    const comSegredo = await procurarComOMestre(MOLDE);
    const semSegredo = await procurarComOMestre(MOLDE_SEM_SEGREDO);

    expect(JSON.stringify(comSegredo.conteudo)).toBe(JSON.stringify(semSegredo.conteudo));
    expect(comSegredo.conteudo.eventos[0]).toEqual({
      id: ID_DA_PROCURA, title: TITULO_DA_PROCURA, playerText: MENSAGEM_SEM_ACHADO,
    });
  });

  it("a TELA INTEIRA do jogador é idêntica depois das duas procuras", async () => {
    /* A prova que fecha o AC-9: o que chega ao cliente do jogador depois de uma
       procura fracassada num lugar com segredo é o mesmo documento que chega
       depois de uma procura num lugar vazio. Renderizada, a página dele não tem
       um caractere de diferença — não há o que comparar no DevTools. */
    const comSegredo = await procurarComOMestre(MOLDE);
    const semSegredo = await procurarComOMestre(MOLDE_SEM_SEGREDO);

    const paginaDoJogador = (conteudo) => {
      const doc = {
        id: `ev_${conteudo.eventos[0].id}`,
        kind: "event",
        eventId: conteudo.eventos[0].id,
        title: conteudo.eventos[0].title,
        playerText: conteudo.eventos[0].playerText,
        state: "revealed",
      };
      comCenario({ revelado: [...REVELADO, doc], party: partyEm("n2"), eventos: [] });
      const tela = montarJogador();
      const html = tela.container.innerHTML;
      tela.unmount();
      jest.clearAllMocks();
      return html;
    };

    expect(paginaDoJogador(comSegredo.conteudo)).toBe(paginaDoJogador(semSegredo.conteudo));
  });
});
