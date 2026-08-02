/* ════════════════════════════════════════════════════════════════════
 *  EVENTOS NO ATELIÊ — GATE DA FERRAMENTA  (spec 0028 · F5 · AC-1, AC-8)
 *  --------------------------------------------------------------------
 *  Prova que o mestre consegue mesmo: ancorar um evento clicando, escolher
 *  o gatilho entre os seis, escrever os DOIS textos, marcar o que ele
 *  revela — e que o painel avisa em português o que falta antes da mesa.
 *
 *  Fronteira mockada: SÓ `../worldMapStore`, que é o I/O. `model/eventos.js`,
 *  `Editor/editorUi.js` e `Editor/PainelDoEvento.jsx` rodam de verdade —
 *  quem decide o que é um evento válido aqui é o código de produção.
 *
 *  O preset do CRA roda com `resetMocks: true`: as implementações são
 *  reinstaladas a cada teste no `beforeEach`.
 * ════════════════════════════════════════════════════════════════════ */

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../worldMapStore", () => ({
  useGrafo: jest.fn(),
  createNode: jest.fn(),
  updateNode: jest.fn(),
  deleteNode: jest.fn(),
  createEdge: jest.fn(),
  updateEdge: jest.fn(),
  deleteEdge: jest.fn(),
  useEventos: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
}));

import EditorDoGrafo from "../Editor";
import {
  useGrafo, useEventos, createEvent, updateEvent, deleteEvent,
} from "../worldMapStore";
import { criarNo, criarTrilha } from "../model/graph";
import { criarEvento } from "../model/eventos";
import { ondeOEventoEsta, posicaoDoEvento, rotuloDoEvento } from "../Editor/editorUi";
import { marcasDaLinha, patchDoEvento } from "../Editor/PainelDoEvento";

const RETANGULO = {
  left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500, x: 0, y: 0,
  toJSON() { return this; },
};

const MOLDE = {
  id: "m1", name: "As Terras Partidas", width: 2400, height: 1600,
  defaultRevealRadius: 150, nodeCount: 2,
};

const VILA = criarNo({ id: "n1", x: 100, y: 100, name: "Vila Candeia", type: "town" });
const COVA = criarNo({ id: "n2", x: 300, y: 200, name: "Cova do Corta-Sono", type: "secret" });
const ESTRADA = criarTrilha({ id: "t1", fromId: "n1", toId: "n2", travelHours: 4 });
const ATALHO = criarTrilha({ id: "t2", fromId: "n2", toId: "n1", isSecret: true, travelHours: 9 });

/** Um evento já salvo: ancorado na vila, com texto de mestre. */
const CARROCAO = criarEvento({
  id: "ev1",
  anchor: { type: "node", refId: "n1" },
  title: "O carroção tombado",
  playerText: "Na curva da estrada, um carroção tombado.",
  gmText: "Três golens de carne debaixo da lona.",
  trigger: "on_arrival",
});

const comGrafo = (nos, trilhas = []) =>
  useGrafo.mockReturnValue({ nos, trilhas, loading: false, error: null });
const comEventos = (eventos) =>
  useEventos.mockReturnValue({ eventos, loading: false, error: null });

beforeEach(() => {
  window.PointerEvent = window.MouseEvent;
  jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RETANGULO);
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([]); }
    disconnect() {}
  };
  comGrafo([VILA, COVA], [ESTRADA, ATALHO]);
  comEventos([]);
  createEvent.mockResolvedValue("ev-novo");
  updateEvent.mockResolvedValue(undefined);
  deleteEvent.mockResolvedValue(undefined);
});

afterEach(() => { delete global.ResizeObserver; delete window.PointerEvent; });

const montar = (props = {}) => render(
  <EditorDoGrafo uid="mestre-1" molde={MOLDE} plan="pago" {...props} />,
);

const palco = () => screen.getByTestId("wm-palco");

function clicarNoPalco(x, y) {
  const alvo = palco();
  fireEvent.pointerDown(alvo, { clientX: x, clientY: y, button: 0, pointerId: 1 });
  fireEvent.pointerUp(alvo, { clientX: x, clientY: y, button: 0, pointerId: 1 });
  fireEvent.click(alvo, { clientX: x, clientY: y, button: 0 });
}

const ferramentaDeEvento = () => screen.getByRole("button", { name: /novo evento/i });

/* ════════════════════════════════════════════════════════════════════
 *  1 · A GEOMETRIA DA ÂNCORA  (lógica pura)
 * ════════════════════════════════════════════════════════════════════ */
describe("posicaoDoEvento — onde o selo é desenhado", () => {
  const grafo = { nos: [VILA, COVA], trilhas: [ESTRADA] };

  it("âncora de ponto usa a própria coordenada", () => {
    expect(posicaoDoEvento({ anchor: { type: "point", x: 42, y: 7 } }, grafo)).toEqual({ x: 42, y: 7 });
  });

  it("âncora de nó fica em cima do nó", () => {
    expect(posicaoDoEvento({ anchor: { type: "node", refId: "n1" } }, grafo)).toEqual({ x: 100, y: 100 });
  });

  it("âncora de trilha fica no MEIO DA CURVA, entre as duas pontas", () => {
    const p = posicaoDoEvento({ anchor: { type: "edge", refId: "t1" } }, grafo);
    expect(p).not.toBeNull();
    expect(p.x).toBeGreaterThan(100);
    expect(p.x).toBeLessThan(300);
    expect(p.y).toBeGreaterThan(100);
    expect(p.y).toBeLessThan(200);
  });

  it("âncora órfã não ganha selo — chutar posição mostraria o evento no lugar errado", () => {
    expect(posicaoDoEvento({ anchor: { type: "node", refId: "sumiu" } }, grafo)).toBeNull();
    expect(posicaoDoEvento({ anchor: { type: "edge", refId: "sumiu" } }, grafo)).toBeNull();
    expect(posicaoDoEvento({ anchor: { type: "point" } }, grafo)).toBeNull();
    expect(posicaoDoEvento({}, grafo)).toBeNull();
    expect(posicaoDoEvento(null, grafo)).toBeNull();
  });

  it("ondeOEventoEsta fala português, e admite quando a âncora sumiu", () => {
    expect(ondeOEventoEsta({ anchor: { type: "node", refId: "n1" } }, grafo)).toBe("no lugar Vila Candeia");
    expect(ondeOEventoEsta({ anchor: { type: "point", x: 1, y: 1 } }, grafo)).toBe("num ponto do mapa");
    expect(ondeOEventoEsta({ anchor: { type: "edge", refId: "t1" } }, grafo)).toMatch(/^na trilha /);
    expect(ondeOEventoEsta({ anchor: { type: "node", refId: "x" } }, grafo))
      .toBe("num lugar que não existe mais");
  });

  it("rotuloDoEvento diz o título, a âncora e o gatilho — é rótulo do ateliê", () => {
    const r = rotuloDoEvento(CARROCAO, grafo, "Ao chegar");
    expect(r).toContain("O carroção tombado");
    expect(r).toContain("no lugar Vila Candeia");
    expect(r).toContain("ao chegar");
    expect(r).toContain("com texto só seu");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · O PATCH QUE VAI PARA O STORE  (lógica pura)
 * ════════════════════════════════════════════════════════════════════ */
describe("patchDoEvento — a normalização do painel", () => {
  const base = {
    title: "T", playerText: "P", gmText: "G", trigger: "manual",
    ancoraTipo: "node", ancoraRef: "n1", ancoraX: null, ancoraY: null,
    raio: 200, pericia: "", cd: null, marca: "", chancePorcento: 100,
    isRepeatable: false, linkedSceneId: "", revelaNos: [], revelaTrilhas: [],
    revelaMarcas: "",
  };

  it("cada gatilho grava SÓ a sua configuração — nada de dado morto", () => {
    expect(patchDoEvento({ ...base, trigger: "manual" }).triggerConfig).toBeNull();
    expect(patchDoEvento({ ...base, trigger: "on_arrival" }).triggerConfig).toBeNull();
    expect(patchDoEvento({ ...base, trigger: "on_proximity", raio: 250 }).triggerConfig)
      .toEqual({ radius: 250 });
    expect(patchDoEvento({ ...base, trigger: "flag", marca: "porta-aberta" }).triggerConfig)
      .toEqual({ flagKey: "porta-aberta" });
  });

  it("a chance é digitada em PORCENTAGEM e gravada como fração de 0 a 1", () => {
    expect(patchDoEvento({ ...base, trigger: "on_travel", chancePorcento: 30 }).triggerConfig)
      .toEqual({ chance: 0.3 });
    expect(patchDoEvento({ ...base, trigger: "on_travel", chancePorcento: 100 }).triggerConfig)
      .toEqual({ chance: 1 });
    /* Fora da faixa é grampeado, não recusado: o campo tem min/max, mas a
       normalização não pode confiar no navegador. */
    expect(patchDoEvento({ ...base, trigger: "on_travel", chancePorcento: 400 }).triggerConfig)
      .toEqual({ chance: 1 });
    expect(patchDoEvento({ ...base, trigger: "on_travel", chancePorcento: -5 }).triggerConfig)
      .toEqual({ chance: 0 });
  });

  it("o teste do on_check só é gravado inteiro — meia perícia não vira config", () => {
    expect(patchDoEvento({ ...base, trigger: "on_check", pericia: "Investigação", cd: 20 }).triggerConfig)
      .toEqual({ check: { skill: "Investigação", dc: 20 } });
    expect(patchDoEvento({ ...base, trigger: "on_check", pericia: "Investigação", cd: null }).triggerConfig)
      .toBeNull();
    expect(patchDoEvento({ ...base, trigger: "on_check", pericia: "  ", cd: 20 }).triggerConfig)
      .toBeNull();
  });

  it("a âncora de ponto carrega x e y; a de nó e a de trilha, o refId", () => {
    expect(patchDoEvento({ ...base, ancoraTipo: "point", ancoraX: 9, ancoraY: 8 }).anchor)
      .toEqual({ type: "point", refId: null, x: 9, y: 8 });
    expect(patchDoEvento({ ...base, ancoraTipo: "edge", ancoraRef: "t1" }).anchor)
      .toEqual({ type: "edge", refId: "t1", x: null, y: null });
  });

  it("as marcas saem de uma linha com vírgulas, sem sobras nem vazios", () => {
    expect(marcasDaLinha(" porta-aberta ,, o-conde-sabe , ")).toEqual(["porta-aberta", "o-conde-sabe"]);
    expect(marcasDaLinha("")).toEqual([]);
    expect(patchDoEvento({ ...base, revelaMarcas: "a, b" }).reveals.flags).toEqual(["a", "b"]);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · ANCORAR PELO PALCO  (briefing §8)
 * ════════════════════════════════════════════════════════════════════ */
describe("a ferramenta de evento", () => {
  it("está na barra, com atalho, e não aparece em somente leitura", () => {
    montar();
    const botao = ferramentaDeEvento();
    expect(botao).toHaveAttribute("aria-keyshortcuts", "E");
    expect(botao).toHaveAttribute("aria-pressed", "false");
  });

  it("clicar num lugar ancora o evento NELE", async () => {
    montar();
    fireEvent.click(ferramentaDeEvento());
    fireEvent.click(screen.getByTestId("wm-no-n1"));

    await waitFor(() => expect(createEvent).toHaveBeenCalled());
    const [, , dados] = createEvent.mock.calls[0];
    expect(dados.anchor).toEqual({ type: "node", refId: "n1" });
  });

  it("clicar no vazio ancora num PONTO, com as coordenadas de mundo", async () => {
    montar();
    fireEvent.click(ferramentaDeEvento());
    clicarNoPalco(400, 300);

    await waitFor(() => expect(createEvent).toHaveBeenCalled());
    const [, , dados] = createEvent.mock.calls[0];
    expect(dados.anchor.type).toBe("point");
    expect(Number.isFinite(dados.anchor.x)).toBe(true);
    expect(Number.isFinite(dados.anchor.y)).toBe(true);
  });

  it("o evento nasce à mão do mestre — um rascunho nunca surpreende a mesa", async () => {
    montar();
    fireEvent.click(ferramentaDeEvento());
    fireEvent.click(screen.getByTestId("wm-no-n1"));

    await waitFor(() => expect(createEvent).toHaveBeenCalled());
    /* Quem carimba o `manual` é `criarEvento` no store (GATILHO_PADRAO). A tela
       não manda gatilho nenhum, e é isso que este teste trava. */
    const [, , dados] = createEvent.mock.calls[0];
    expect(dados.trigger).toBeUndefined();
    expect(criarEvento(dados).trigger).toBe("manual");
  });

  it("depois de ancorar, a ferramenta volta para Selecionar — plantar em série seria armadilha", async () => {
    montar();
    fireEvent.click(ferramentaDeEvento());
    fireEvent.click(screen.getByTestId("wm-no-n1"));
    await waitFor(() => expect(createEvent).toHaveBeenCalled());
    await waitFor(() => expect(ferramentaDeEvento()).toHaveAttribute("aria-pressed", "false"));
  });

  it("no mapa padrão (somente leitura) a ferramenta some", () => {
    render(<EditorDoGrafo uid="" molde={MOLDE} plan="pago" />);
    expect(screen.queryByRole("button", { name: /novo evento/i })).not.toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · O SELO NO PALCO — "visualmente óbvio onde há evento"
 * ════════════════════════════════════════════════════════════════════ */
describe("o selo do evento no mapa", () => {
  it("aparece com rótulo que diz título, âncora e gatilho", () => {
    comEventos([CARROCAO]);
    montar();
    const selo = screen.getByTestId("wm-evento-ev1");
    expect(selo).toHaveAttribute("aria-label", expect.stringContaining("O carroção tombado"));
    expect(selo).toHaveAttribute("aria-label", expect.stringContaining("no lugar Vila Candeia"));
  });

  it("clicar no selo abre o painel do evento", () => {
    comEventos([CARROCAO]);
    montar();
    fireEvent.click(screen.getByTestId("wm-evento-ev1"));
    expect(screen.getByTestId("wme-painel-do-evento")).toBeInTheDocument();
    expect(screen.getByTestId("wme-evento-resumo")).toHaveTextContent(/Ao chegar/);
  });

  it("evento de âncora órfã não é desenhado, mas continua na contagem", () => {
    comEventos([CARROCAO, criarEvento({ id: "ev2", anchor: { type: "node", refId: "sumiu" } })]);
    montar();
    expect(screen.queryByTestId("wm-evento-ev2")).not.toBeInTheDocument();
    expect(screen.getByTestId("wme-contagem-de-eventos")).toHaveTextContent("2 eventos");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · O PAINEL: OS DOIS TEXTOS, O GATILHO E O QUE REVELA
 * ════════════════════════════════════════════════════════════════════ */
describe("o painel do evento", () => {
  const abrir = () => {
    comEventos([CARROCAO]);
    montar();
    fireEvent.click(screen.getByTestId("wm-evento-ev1"));
    return screen.getByTestId("wme-painel-do-evento");
  };

  it("separa o texto do jogador do texto do mestre, e diz qual é qual", () => {
    const painel = abrir();
    const doJogador = within(painel).getByLabelText(/texto do jogador/i);
    const doMestre = within(painel).getByLabelText(/texto do mestre/i);

    expect(doJogador).toHaveValue("Na curva da estrada, um carroção tombado.");
    expect(doMestre).toHaveValue("Três golens de carne debaixo da lona.");
    /* A promessa está escrita na tela, não só no código. */
    expect(painel).toHaveTextContent(/Nunca sai daqui/i);
    expect(painel).toHaveTextContent(/só isto — que chega ao cliente do grupo/i);
  });

  it("oferece os SEIS gatilhos do briefing, em português", () => {
    const painel = abrir();
    const seletor = within(painel).getByLabelText(/^gatilho$/i);
    const rotulos = Array.from(seletor.options).map((o) => o.textContent);
    expect(rotulos).toEqual([
      "Ao chegar", "Por proximidade", "Por teste de perícia",
      "Ao percorrer a trilha", "À mão do mestre", "Por marca do grupo",
    ]);
  });

  it("cada gatilho pede a sua configuração, e só ela", () => {
    const painel = abrir();
    const seletor = within(painel).getByLabelText(/^gatilho$/i);

    fireEvent.change(seletor, { target: { value: "on_proximity" } });
    expect(within(painel).getByLabelText(/^raio$/i)).toBeInTheDocument();
    expect(within(painel).queryByLabelText(/^cd$/i)).not.toBeInTheDocument();

    fireEvent.change(seletor, { target: { value: "on_check" } });
    expect(within(painel).getByLabelText(/perícia do teste/i)).toBeInTheDocument();
    expect(within(painel).getByLabelText(/^cd$/i)).toBeInTheDocument();
    expect(within(painel).queryByLabelText(/^raio$/i)).not.toBeInTheDocument();

    fireEvent.change(seletor, { target: { value: "flag" } });
    expect(within(painel).getByLabelText(/marca do grupo/i)).toBeInTheDocument();

    fireEvent.change(seletor, { target: { value: "on_travel" } });
    expect(within(painel).getByLabelText(/^chance$/i)).toBeInTheDocument();
  });

  it("salva o evento inteiro, com gatilho, configuração e revelações", async () => {
    const painel = abrir();

    fireEvent.change(within(painel).getByLabelText(/^gatilho$/i), { target: { value: "on_proximity" } });
    fireEvent.change(within(painel).getByLabelText(/^raio$/i), { target: { value: "250" } });
    fireEvent.change(within(painel).getByLabelText(/^título$/i), { target: { value: "A emboscada" } });
    fireEvent.change(within(painel).getByLabelText(/texto do jogador/i), { target: { value: "Passos atrás de você." } });
    fireEvent.change(within(painel).getByLabelText(/texto do mestre/i), { target: { value: "Quatro bandidos." } });
    /* Revela a cova e a trilha secreta. */
    fireEvent.click(within(painel).getByLabelText("Cova do Corta-Sono"));
    fireEvent.click(within(painel).getByLabelText(/^🔒 Cova do Corta-Sono/));
    fireEvent.change(within(painel).getByLabelText(/marcas que acende/i), { target: { value: "emboscados" } });

    fireEvent.click(screen.getByTestId("wme-salvar-evento"));

    await waitFor(() => expect(updateEvent).toHaveBeenCalled());
    const [uid, mapId, eventId, patch] = updateEvent.mock.calls[0];
    expect([uid, mapId, eventId]).toEqual(["mestre-1", "m1", "ev1"]);
    expect(patch.trigger).toBe("on_proximity");
    expect(patch.triggerConfig).toEqual({ radius: 250 });
    expect(patch.title).toBe("A emboscada");
    expect(patch.playerText).toBe("Passos atrás de você.");
    expect(patch.gmText).toBe("Quatro bandidos.");
    expect(patch.reveals.nodeIds).toEqual(["n2"]);
    expect(patch.reveals.edgeIds).toEqual(["t2"]);
    expect(patch.reveals.flags).toEqual(["emboscados"]);
  });

  it("a trilha secreta é marcada com cadeado na lista do que se revela", () => {
    const painel = abrir();
    const lista = within(painel).getByLabelText("Trilhas que o evento revela");
    expect(lista).toHaveTextContent("🔒");
  });

  it("mostra os problemas em PT-BR ANTES de salvar, sem impedir a gravação", async () => {
    const painel = abrir();
    /* Gatilho por teste sem perícia nem CD: `validarEvento` acusa. */
    fireEvent.change(within(painel).getByLabelText(/^gatilho$/i), { target: { value: "on_check" } });

    const problemas = screen.getByTestId("wme-evento-problemas");
    expect(problemas).toHaveTextContent(/precisa dizer qual perícia e qual dificuldade/i);

    /* E ainda assim salva — diagnóstico, não bloqueio. */
    fireEvent.click(screen.getByTestId("wme-salvar-evento"));
    await waitFor(() => expect(updateEvent).toHaveBeenCalled());
  });

  it("acusa a âncora órfã e a revelação de coisa que não existe", () => {
    comEventos([criarEvento({
      id: "ev9",
      anchor: { type: "node", refId: "n1" },
      title: "Fantasma",
      trigger: "manual",
      reveals: { nodeIds: ["nao-existe"], edgeIds: [], flags: [] },
    })]);
    montar();
    fireEvent.click(screen.getByTestId("wm-evento-ev9"));
    expect(screen.getByTestId("wme-evento-problemas"))
      .toHaveTextContent(/revela um nó que não existe no mapa/i);
  });

  it("avisa quando o evento não tem título — o grupo veria um cartão sem nome", () => {
    comEventos([criarEvento({ id: "ev8", anchor: { type: "point", x: 10, y: 10 }, trigger: "manual" })]);
    montar();
    fireEvent.click(screen.getByTestId("wm-evento-ev8"));
    expect(screen.getByTestId("wme-evento-problemas")).toHaveTextContent(/ainda não tem título/i);
  });

  it("apagar pede confirmação e só então remove", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /apagar evento/i }));
    expect(deleteEvent).not.toHaveBeenCalled();

    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: /apagar evento/i }));
    await waitFor(() => expect(deleteEvent).toHaveBeenCalledWith("mestre-1", "m1", "ev1"));
  });
});
