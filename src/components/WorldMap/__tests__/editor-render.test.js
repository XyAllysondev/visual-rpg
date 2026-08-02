/* ════════════════════════════════════════════════════════════════════
 *  EDITOR DO GRAFO — INTERAÇÃO DE VERDADE NO DOM  (spec 0028 · F2 · AC-4)
 *  --------------------------------------------------------------------
 *  Prova que o mestre consegue mesmo: plantar um lugar clicando, movê-lo,
 *  ligar dois por uma trilha, editar os campos do design §3 e apagar com
 *  confirmação — e que o teto do plano (AC-3) explica em vez de falhar
 *  calado.
 *
 *  Fronteira mockada: SÓ `../worldMapStore`, que é o I/O. A câmera, o grafo,
 *  as cotas, a virtualização e a pintura rodam de verdade — quem decide se
 *  a trilha é duplicata aqui é o código de produção, não um dublê.
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
  /* F5: os eventos entraram no editor. O dublê precisa acompanhar, senão o
     hook chega `undefined` e a tela quebra antes de qualquer asserção. O gate
     dos eventos é `evento-atelie.test.js`; aqui eles só não podem atrapalhar. */
  useEventos: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
}));

import EditorDoGrafo from "../Editor";
import {
  useGrafo, createNode, updateNode, deleteNode, createEdge, updateEdge, deleteEdge,
  useEventos,
} from "../worldMapStore";
import { criarNo, criarTrilha } from "../model/graph";
import { MAPA_PADRAO_ID } from "../model/mapaPadrao";

/* ── Geometria fingida: o jsdom devolve tudo zerado ─────────────────────
   Sem medida não há virtualização a provar (a caixa vira `null` e tudo é
   desenhado, que é o fallback documentado). Aqui o palco tem 800×500. */
const RETANGULO = {
  left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500, x: 0, y: 0,
  toJSON() { return this; },
};

const MOLDE = {
  id: "m1",
  name: "As Terras Partidas",
  width: 2400,
  height: 1600,
  defaultRevealRadius: 150,
  nodeCount: 2,
};

const VILA = criarNo({ id: "n1", x: 100, y: 100, name: "Vila Candeia", type: "town" });
const COVA = criarNo({ id: "n2", x: 300, y: 200, name: "Cova do Corta-Sono", type: "secret" });
const LONGE = criarNo({ id: "n3", x: 90000, y: 90000, name: "Fora da tela" });

const ESTRADA = criarTrilha({ id: "t1", fromId: "n1", toId: "n2", travelHours: 4, dangerLevel: 2 });
const ATALHO = criarTrilha({
  id: "t2", fromId: "n2", toId: "n1", isSecret: true, travelHours: 12,
  discoveryCheck: { skill: "Ocultismo", dc: 22 },
});

const comGrafo = (nos, trilhas = []) =>
  useGrafo.mockReturnValue({ nos, trilhas, loading: false, error: null });

beforeEach(() => {
  jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(RETANGULO);
  /* O jsdom não implementa canvas e reclama alto a cada chamada. O `null` é
     exatamente o que o navegador devolveria sem contexto 2D — e `pintarMapa`
     trata isso como no-op de propósito (ver o JSDoc lá). Aqui o dublê só cala
     o ruído; o contrato da pintura tem gate próprio em `editor-modelo`. */
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([]); }
    disconnect() {}
  };
  comGrafo([VILA, COVA]);
  useEventos.mockReturnValue({ eventos: [], loading: false, error: null });
  createNode.mockResolvedValue("novo-1");
  updateNode.mockResolvedValue(undefined);
  deleteNode.mockResolvedValue({ trilhasRemovidas: 0 });
  createEdge.mockResolvedValue("nova-t");
  updateEdge.mockResolvedValue(undefined);
  deleteEdge.mockResolvedValue(undefined);
});

afterEach(() => { delete global.ResizeObserver; });

const montar = (props = {}) => render(
  <EditorDoGrafo uid="mestre-1" molde={MOLDE} plan="pago" {...props} />,
);

const palco = () => screen.getByTestId("wm-palco");

/** Clique no vazio do palco: o editor exige ponteiro parado (senão é pan). */
function clicarNoPalco(x, y) {
  const alvo = palco();
  fireEvent.pointerDown(alvo, { clientX: x, clientY: y, button: 0, pointerId: 1 });
  fireEvent.pointerUp(alvo, { clientX: x, clientY: y, button: 0, pointerId: 1 });
  fireEvent.click(alvo, { clientX: x, clientY: y, button: 0 });
}

const noDoMapa = (nome) => screen.getByRole("button", { name: new RegExp(nome, "i") });

/* ════════════════════════════════════════════════════════════════════
 *  1 · RENDER HÍBRIDO  (design §5.3)
 * ════════════════════════════════════════════════════════════════════ */
describe("render híbrido canvas/DOM (design §5.3)", () => {
  it("as trilhas vão para o CANVAS e os nós para o DOM", () => {
    comGrafo([VILA, COVA], [ESTRADA]);
    montar();

    /* Um canvas — é onde a ilustração e as curvas são pintadas. */
    expect(screen.getByTestId("wm-canvas")).toBeInTheDocument();

    /* Os nós são botões de verdade: focáveis, rotulados, com alvo próprio.
       Isso é o que canvas não entrega e o design §5.3 exige. */
    expect(noDoMapa("Cidade: Vila Candeia")).toBeInTheDocument();
    expect(noDoMapa("Segredo: Cova do Corta-Sono, segredo do mestre")).toBeInTheDocument();
  });

  it("virtualiza: o nó fora do viewport não vira DOM", () => {
    comGrafo([VILA, COVA, LONGE]);
    montar();

    expect(screen.getByTestId("wm-no-n1")).toBeInTheDocument();
    expect(screen.queryByTestId("wm-no-n3")).not.toBeInTheDocument();
  });

  it("o nó é alcançável por teclado e anuncia o que é", () => {
    montar();
    const no = screen.getByTestId("wm-no-n2");
    expect(no.tagName).toBe("BUTTON");
    expect(no).toHaveAttribute("aria-label", "Segredo: Cova do Corta-Sono, segredo do mestre");

    fireEvent.keyDown(no, { key: "Enter" });
    expect(screen.getByRole("complementary", { name: /editar lugar/i })).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · FERRAMENTAS
 * ════════════════════════════════════════════════════════════════════ */
describe("ferramentas", () => {
  it("mostra as quatro, com a de seleção ligada e a dica visível", () => {
    montar();
    const barra = screen.getByRole("toolbar", { name: /ferramentas do mapa/i });
    expect(within(barra).getByRole("button", { name: /^selecionar/i })).toHaveAttribute("aria-pressed", "true");
    expect(within(barra).getByRole("button", { name: /novo lugar/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/arraste um lugar para movê-lo/i)).toBeInTheDocument();
  });

  it("a tecla de atalho troca a ferramenta", () => {
    montar();
    fireEvent.keyDown(document, { key: "n" });
    const barra = screen.getByRole("toolbar", { name: /ferramentas do mapa/i });
    expect(within(barra).getByRole("button", { name: /novo lugar/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("o enquadrar tudo existe e não quebra sem nós", () => {
    comGrafo([]);
    montar();
    fireEvent.click(screen.getByRole("button", { name: /enquadrar tudo/i }));
    expect(screen.getByTestId("wm-palco")).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · PLANTAR UM LUGAR  (AC-4) E A COTA  (AC-3)
 * ════════════════════════════════════════════════════════════════════ */
describe("plantar lugares", () => {
  it("com a ferramenta de lugar, o clique planta nas coordenadas de MUNDO", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /novo lugar/i }));
    clicarNoPalco(200, 150);

    await waitFor(() => expect(createNode).toHaveBeenCalled());
    const [uid, mapId, dados, opcoes] = createNode.mock.calls[0];
    expect(uid).toBe("mestre-1");
    expect(mapId).toBe("m1");
    /* Câmera inicial: pan (0,0), escala 0,5 → tela (200,150) = mundo (400,300). */
    expect(dados).toEqual({ x: 400, y: 300 });
    expect(opcoes).toEqual({ plan: "pago", nodeCount: 2 });
  });

  it("com a ferramenta de seleção, clicar no vazio NÃO planta nada", () => {
    montar();
    clicarNoPalco(200, 150);
    expect(createNode).not.toHaveBeenCalled();
  });

  it("no teto do plano, explica o limite e o caminho — e não grava (AC-3)", async () => {
    /* Free = 25 nós. Com 25 no mapa, o 26º tem de ser recusado com frase. */
    const cheio = Array.from({ length: 25 }, (_, i) =>
      criarNo({ id: `n${i}`, x: 10 + i, y: 10, name: `Lugar ${i}` }));
    comGrafo(cheio);
    montar({ plan: "free" });

    expect(screen.getByText(/limite de lugares/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /novo lugar/i }));
    clicarNoPalco(200, 150);

    await waitFor(() => {
      expect(screen.getAllByText(/assine um plano para chegar a 500 nós por mapa/i).length)
        .toBeGreaterThan(0);
    });
    expect(createNode).not.toHaveBeenCalled();
  });

  it("a falha de gravação vira frase em português, nunca silêncio", async () => {
    createNode.mockRejectedValue(new Error("O nó precisa de coordenadas x e y numéricas."));
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    montar();
    fireEvent.click(screen.getByRole("button", { name: /novo lugar/i }));
    clicarNoPalco(120, 120);

    expect(await screen.findByRole("alert")).toHaveTextContent(/coordenadas x e y/i);
    erro.mockRestore();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · TRILHAS  (AC-4)
 * ════════════════════════════════════════════════════════════════════ */
describe("ligar dois lugares por uma trilha", () => {
  const ligar = (primeiro, segundo) => {
    fireEvent.click(screen.getByRole("button", { name: /nova trilha/i }));
    fireEvent.click(screen.getByTestId(primeiro));
    fireEvent.click(screen.getByTestId(segundo));
  };

  it("clicar em dois lugares cria a trilha", async () => {
    montar();
    ligar("wm-no-n1", "wm-no-n2");

    await waitFor(() => expect(createEdge).toHaveBeenCalled());
    const [, , dados] = createEdge.mock.calls[0];
    expect(dados).toEqual({ fromId: "n1", toId: "n2" });
  });

  it("depois do primeiro clique, a tela diz o que fazer em seguida", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /nova trilha/i }));
    fireEvent.click(screen.getByTestId("wm-no-n1"));
    expect(screen.getByText(/clique no segundo lugar/i)).toBeInTheDocument();
  });

  it("recusa a autoligação com mensagem em PT-BR, sem gastar rede", async () => {
    montar();
    ligar("wm-no-n1", "wm-no-n1");

    expect(await screen.findByRole("alert"))
      .toHaveTextContent(/não pode ligar um lugar a ele mesmo/i);
    expect(createEdge).not.toHaveBeenCalled();
  });

  it("recusa a duplicata — inclusive no sentido contrário", async () => {
    comGrafo([VILA, COVA], [ESTRADA]); // já existe n1 ↔ n2
    montar();
    ligar("wm-no-n2", "wm-no-n1");     // tentativa ao contrário

    expect(await screen.findByRole("alert"))
      .toHaveTextContent(/já existe uma trilha ligando esses dois lugares/i);
    expect(createEdge).not.toHaveBeenCalled();
  });

  it("Esc cancela a trilha em construção", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /nova trilha/i }));
    fireEvent.click(screen.getByTestId("wm-no-n1"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText(/clique no segundo lugar/i)).not.toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · PAINEL DO LUGAR  (AC-4 · os campos do design §3)
 * ════════════════════════════════════════════════════════════════════ */
describe("painel do lugar", () => {
  const abrir = () => { montar(); fireEvent.click(screen.getByTestId("wm-no-n1")); };

  it("traz todos os campos que o AC-4 exige", () => {
    abrir();
    expect(screen.getByLabelText("Nome")).toHaveValue("Vila Candeia");
    expect(screen.getByLabelText("Tipo")).toHaveValue("town");
    expect(screen.getByLabelText("Ícone")).toBeInTheDocument();
    expect(screen.getByLabelText("Cor")).toBeInTheDocument();
    expect(screen.getByLabelText("Rumor")).toBeInTheDocument();
    expect(screen.getByLabelText("Descrição pública")).toBeInTheDocument();
    expect(screen.getByLabelText("Notas do mestre")).toBeInTheDocument();
    expect(screen.getByLabelText("Cena tática vinculada")).toBeInTheDocument();
    expect(screen.getByLabelText("Raio de revelação")).toBeInTheDocument();
    expect(screen.getByLabelText("Viagem rápida")).toBeInTheDocument();
  });

  it("as notas do mestre avisam que nunca saem daqui (AC-1)", () => {
    abrir();
    expect(screen.getByText(/só o mestre vê/i)).toBeInTheDocument();
    expect(screen.getByText(/não é copiado para a mesa/i)).toBeInTheDocument();
  });

  it("salva o rascunho só quando o mestre manda, e normalizado", async () => {
    abrir();
    expect(screen.getByRole("button", { name: /salvar alterações/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "  Vila Nova  " } });
    fireEvent.change(screen.getByLabelText("Notas do mestre"), { target: { value: "Herculana manda aqui." } });
    expect(updateNode).not.toHaveBeenCalled(); // nada de gravar por tecla

    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() => expect(updateNode).toHaveBeenCalled());
    const [, , nodeId, patch] = updateNode.mock.calls[0];
    expect(nodeId).toBe("n1");
    expect(patch.name).toBe("Vila Nova");
    expect(patch.gmNotes).toBe("Herculana manda aqui.");
  });

  it("a lista de cenas aparece quando o mestre tem cenas", () => {
    montar({ cenas: [{ id: "c1", name: "Praça da Vila" }] });
    fireEvent.click(screen.getByTestId("wm-no-n1"));
    const campo = screen.getByLabelText("Cena tática vinculada");
    expect(campo.tagName).toBe("SELECT");
    expect(within(campo).getByRole("option", { name: "Praça da Vila" })).toBeInTheDocument();
  });

  it("fecha e limpa a seleção", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /fechar o painel do lugar/i }));
    expect(screen.queryByRole("complementary", { name: /editar lugar/i })).not.toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  6 · PAINEL DA TRILHA  (AC-4) E O SEGREDO VISÍVEL
 * ════════════════════════════════════════════════════════════════════ */
describe("painel da trilha", () => {
  /* A trilha vive no canvas: a seleção acontece pelo hit-test geométrico do
     clique. A reta n1(100,100) → n2(300,200) passa pelo mundo (200,150), que
     com pan (0,0) e escala 0,5 é a tela (100,75). */
  const selecionarTrilha = () => clicarNoPalco(100, 75);

  it("clicar sobre a trilha no canvas a seleciona", async () => {
    comGrafo([VILA, COVA], [ESTRADA]);
    montar();
    selecionarTrilha();
    expect(await screen.findByRole("complementary", { name: /editar trilha/i })).toBeInTheDocument();
  });

  it("traz os campos do AC-4 e destaca o que é secreto", async () => {
    comGrafo([VILA, COVA], [ATALHO]);
    montar();
    selecionarTrilha();

    await screen.findByRole("complementary", { name: /editar trilha/i });
    expect(screen.getByLabelText("Horas de viagem")).toBeInTheDocument();
    expect(screen.getByLabelText("Trilha secreta")).toBeChecked();
    expect(screen.getByLabelText("Perícia do teste")).toHaveValue("Ocultismo");
    expect(screen.getByLabelText("CD")).toHaveValue(22);
    expect(screen.getByLabelText("Nível de perigo")).toBeInTheDocument();
    expect(screen.getByLabelText("Mão única")).toBeInTheDocument();
    /* O segredo se anuncia no cabeçalho do painel, não só num campo perdido. */
    expect(screen.getByText("Trilha secreta", { selector: "div" })).toBeInTheDocument();
  });

  it("o teste de descoberta só aparece na trilha secreta", async () => {
    comGrafo([VILA, COVA], [ESTRADA]);
    montar();
    selecionarTrilha();

    await screen.findByRole("complementary", { name: /editar trilha/i });
    expect(screen.queryByLabelText("Perícia do teste")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Trilha secreta"));
    expect(screen.getByLabelText("Perícia do teste")).toBeInTheDocument();
  });

  it("salva o segredo e o teste como um objeto só (design §3)", async () => {
    comGrafo([VILA, COVA], [ESTRADA]);
    montar();
    selecionarTrilha();

    await screen.findByRole("complementary", { name: /editar trilha/i });
    fireEvent.click(screen.getByLabelText("Trilha secreta"));
    fireEvent.change(screen.getByLabelText("Perícia do teste"), { target: { value: "Percepção" } });
    fireEvent.change(screen.getByLabelText("CD"), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    await waitFor(() => expect(updateEdge).toHaveBeenCalled());
    const [, , edgeId, patch] = updateEdge.mock.calls[0];
    expect(edgeId).toBe("t1");
    expect(patch.isSecret).toBe(true);
    expect(patch.discoveryCheck).toEqual({ skill: "Percepção", dc: 18 });
  });

  it("inverter o sentido troca as pontas", async () => {
    comGrafo([VILA, COVA], [ESTRADA]);
    montar();
    selecionarTrilha();

    await screen.findByRole("complementary", { name: /editar trilha/i });
    fireEvent.click(screen.getByRole("button", { name: /inverter sentido/i }));

    await waitFor(() => expect(updateEdge).toHaveBeenCalled());
    expect(updateEdge.mock.calls[0][3]).toEqual({ fromNodeId: "n2", toNodeId: "n1" });
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  7 · APAGAR, COM CONFIRMAÇÃO
 * ════════════════════════════════════════════════════════════════════ */
describe("apagar", () => {
  it("apagar um lugar avisa quantas trilhas vão junto, e só então apaga", async () => {
    comGrafo([VILA, COVA], [ESTRADA, ATALHO]); // as duas tocam a Vila
    montar();
    fireEvent.click(screen.getByTestId("wm-no-n1"));
    fireEvent.click(screen.getByRole("button", { name: /apagar lugar/i }));

    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent(/2 trilhas/i);
    expect(deleteNode).not.toHaveBeenCalled();

    fireEvent.click(within(dialogo).getByRole("button", { name: /^apagar lugar$/i }));
    await waitFor(() => expect(deleteNode).toHaveBeenCalled());
    expect(deleteNode.mock.calls[0][2]).toBe("n1");
  });

  it("o Delete do teclado pede a mesma confirmação", async () => {
    montar();
    fireEvent.click(screen.getByTestId("wm-no-n1"));
    fireEvent.keyDown(document, { key: "Delete" });
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(/apagar este lugar/i);
  });

  it("Esc fecha o diálogo sem apagar nada", async () => {
    montar();
    fireEvent.click(screen.getByTestId("wm-no-n1"));
    fireEvent.click(screen.getByRole("button", { name: /apagar lugar/i }));
    await screen.findByRole("alertdialog");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(deleteNode).not.toHaveBeenCalled();
  });

  it("apagar a trilha não leva os lugares junto", async () => {
    comGrafo([VILA, COVA], [ESTRADA]);
    montar();
    clicarNoPalco(100, 75);
    await screen.findByRole("complementary", { name: /editar trilha/i });
    fireEvent.click(screen.getByRole("button", { name: /apagar trilha/i }));

    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent(/os dois lugares continuam onde estão/i);
    fireEvent.click(within(dialogo).getByRole("button", { name: /^apagar trilha$/i }));
    await waitFor(() => expect(deleteEdge).toHaveBeenCalledWith("mestre-1", "m1", "t1"));
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  8 · MOVER O LUGAR  (com debounce — AC-4)
 * ════════════════════════════════════════════════════════════════════ */
describe("mover um lugar", () => {
  it("o teclado empurra o lugar e a gravação é adiada, não imediata", async () => {
    jest.useFakeTimers();
    try {
      montar();
      const no = screen.getByTestId("wm-no-n1");
      fireEvent.click(no);
      fireEvent.keyDown(document, { key: "ArrowRight" });

      /* Nada foi gravado ainda: o mestre pode continuar empurrando. */
      expect(updateNode).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);
      await Promise.resolve();
      expect(updateNode).toHaveBeenCalledWith("mestre-1", "m1", "n1", { x: 106, y: 100 });
    } finally {
      jest.useRealTimers();
    }
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  9 · O MAPA PADRÃO  (AC-13: cópia ao usar)
 * ════════════════════════════════════════════════════════════════════ */
describe("mapa padrão (AC-13)", () => {
  const PADRAO = { id: MAPA_PADRAO_ID, name: "Coroa de Cinzas", width: 2400, height: 1600 };

  it("desenha o grafo do seed sem tocar no Firestore", () => {
    render(<EditorDoGrafo uid="mestre-1" molde={PADRAO} plan="free" />);
    /* O seed tem doze lugares; o hook do Firestore é chamado sem mapa. */
    expect(useGrafo).toHaveBeenCalledWith("", "");
    expect(screen.getByRole("button", { name: /Cidade: Vila Candeia/i })).toBeInTheDocument();
  });

  it("é somente leitura e oferece a cópia", () => {
    const clonar = jest.fn();
    render(<EditorDoGrafo uid="mestre-1" molde={PADRAO} onUsarComoBase={clonar} />);

    expect(screen.getByText(/este mapa já vem no nexus/i)).toBeInTheDocument();
    /* Nem plantar nem ligar: as ferramentas de escrita somem. */
    expect(screen.queryByRole("button", { name: /novo lugar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nova trilha/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /fazer uma cópia para editar/i }));
    expect(clonar).toHaveBeenCalled();
  });

  it("o painel do lugar abre, mas sem botão de salvar nem de apagar", () => {
    render(<EditorDoGrafo uid="mestre-1" molde={PADRAO} />);
    fireEvent.click(screen.getByRole("button", { name: /Cidade: Vila Candeia/i }));

    expect(screen.getByRole("complementary", { name: /editar lugar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salvar alterações/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apagar lugar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/faça uma cópia para poder editá-lo/i)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  10 · FALHA DE LEITURA
 * ════════════════════════════════════════════════════════════════════ */
describe("falhas", () => {
  it("erro do Firestore vira frase em português", () => {
    useGrafo.mockReturnValue({
      nos: [], trilhas: [], loading: false,
      error: Object.assign(new Error("x"), { code: "permission-denied" }),
    });
    montar();
    expect(screen.getByRole("alert")).toHaveTextContent(/não carregaram/i);
  });
});
