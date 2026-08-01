/* ════════════════════════════════════════════════════════════════════
 *  FORJA DO MESTRE — SMOKE TESTS DE RENDERIZAÇÃO  (spec 0027)
 *  --------------------------------------------------------------------
 *  Os outros gates da suíte provam LÓGICA (model/) e CONTRATO (worldsStore).
 *  Este aqui prova que a UI monta e que o comportamento visível dos
 *  AC-2, AC-3, AC-4, AC-5 e AC-6 acontece de verdade no DOM.
 *
 *  Fronteira mockada: só `../worldsStore` (é o I/O — Firestore). Todo o
 *  `model/` roda de verdade: quem filtra, ordena e conta aqui é o código
 *  de produção, não um dublê.
 * ════════════════════════════════════════════════════════════════════ */

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

/* ── A fronteira de I/O ─────────────────────────────────────────────── */
jest.mock("../worldsStore", () => ({
  /* leitura */
  useWorlds: jest.fn(),
  useEntities: jest.fn(),
  useConnections: jest.fn(),
  useFolders: jest.fn(),
  useActiveWorld: jest.fn(),
  /* escrita */
  createWorld: jest.fn(),
  updateWorld: jest.fn(),
  deleteWorld: jest.fn(),
  touchWorld: jest.fn(),
  getWorld: jest.fn(),
  seedDemoWorld: jest.fn(),
  createEntity: jest.fn(),
  updateEntity: jest.fn(),
  deleteEntity: jest.fn(),
  createConnection: jest.fn(),
  deleteConnection: jest.fn(),
  createFolder: jest.fn(),
  updateFolder: jest.fn(),
  deleteFolder: jest.fn(),
}));

import MasterSuite from "../index";
import Dashboard from "../Dashboard";
import Wiki from "../Wiki";
import {
  useWorlds, useEntities, useConnections, useFolders, useActiveWorld,
} from "../worldsStore";

/* ── Acervo de teste ────────────────────────────────────────────────── */

const AGORA = Date.UTC(2026, 6, 31, 12, 0, 0);
const h = (n) => AGORA - n * 3600 * 1000;

const MUNDO = {
  id: "w1",
  name: "Cinzas de Aurum",
  genre: "Fantasia sombria",
  description: "Um império de ouro que virou pó, e o que ficou vivo nas cinzas.",
  ownerUid: "mestre-1",
};

/* 6 entidades, 5 tipos — o bastante pra exercitar contagem, busca e filtro
 * sem virar um fixture que ninguém lê. */
const ENTIDADES = [
  {
    id: "e1",
    type: "character",
    name: "Sétimo Guardião",
    description: "O último vigia do portão norte, cego de um olho.",
    tags: ["vigia", "veterano"],
    attributes: [{ key: "Idade", value: "61 anos" }],
    updatedAt: h(1),
  },
  {
    id: "e2",
    type: "location",
    name: "Muralha Cinzenta",
    description: "Quarenta metros de pedra fria separando o império do que veio depois.",
    tags: ["fronteira"],
    attributes: [
      { key: "Altura", value: "40 metros" },
      { key: "Erguida em", value: "Terceira Era" },
    ],
    updatedAt: h(2),
  },
  {
    id: "e3",
    type: "organization",
    name: "Ordem do Véu",
    description: "Cultuam o silêncio entre dois mundos.",
    tags: ["culto"],
    updatedAt: h(3),
  },
  {
    id: "e4",
    type: "item",
    name: "Selo de Aurum",
    description: "Disco de ouro que ainda queima quem mente segurando ele.",
    tags: ["relíquia"],
    updatedAt: h(4),
  },
  {
    id: "e5",
    type: "creature",
    name: "Vermes da Névoa",
    description: "Sobem do chão quando a bruma cobre o vale.",
    tags: [],
    updatedAt: h(5),
  },
  {
    id: "e6",
    type: "character",
    name: "Dama do Sino",
    description: "Toca o sino quando alguém atravessa sem permissão.",
    tags: ["vigia"],
    updatedAt: h(6),
  },
];

/* e1 GUARDA e2 ⇒ do lado de e2 a mesma aresta se lê "GUARDADO POR" (AC-5). */
const CONEXOES = [
  {
    id: "c1",
    fromId: "e1",
    toId: "e2",
    relation: "GUARDA",
    inverse: "GUARDADO POR",
    kind: "other",
  },
];

const nada = () => {};

/** Estado padrão do store: um mestre com um mundo povoado. */
function comMundo({ entities = ENTIDADES, connections = CONEXOES } = {}) {
  useWorlds.mockReturnValue({ worlds: [MUNDO], loading: false, error: null });
  useEntities.mockReturnValue({ entities, loading: false, error: null });
  useConnections.mockReturnValue({ connections, loading: false, error: null });
}

/* O preset do CRA roda com `resetMocks: true`: toda implementação some entre
 * testes. Então o estado "de fábrica" do store é remontado aqui, sempre. */
beforeEach(() => {
  useWorlds.mockReturnValue({ worlds: [], loading: false, error: null });
  useEntities.mockReturnValue({ entities: [], loading: false, error: null });
  useConnections.mockReturnValue({ connections: [], loading: false, error: null });
  useFolders.mockReturnValue({ folders: [], loading: false, error: null });
  /* o mundo ativo guarda estado de verdade — o efeito de auto-seleção da casca
   * depende disso pra "grudar" no mundo mais recente. */
  useActiveWorld.mockImplementation(() => {
    const [activeWorldId, setActiveWorldId] = React.useState(null);
    return { activeWorldId, setActiveWorldId };
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  1 · CASCA SEM MUNDO  (AC-2)
 * ════════════════════════════════════════════════════════════════════ */
describe("Forja do Mestre · casca sem mundo (AC-2)", () => {
  it("monta sem quebrar e oferece as duas saídas do estado vazio", () => {
    render(<MasterSuite uid="mestre-1" />);

    expect(screen.getByRole("heading", { name: /a forja está fria/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar meu primeiro mundo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar mundo demo" })).toBeInTheDocument();
  });

  it("não mostra o seletor de mundo enquanto não há mundo nenhum", () => {
    render(<MasterSuite uid="mestre-1" />);

    expect(screen.queryByRole("button", { name: /trocar de mundo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Ferramentas da Forja" })).toBeInTheDocument();
  });

  it("pede login quando não há uid, sem tentar ler mundo nenhum", () => {
    render(<MasterSuite />);

    expect(screen.getByRole("heading", { name: /entre para forjar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar mundo demo" })).not.toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · CASCA COM MUNDO
 * ════════════════════════════════════════════════════════════════════ */
describe("Forja do Mestre · casca com mundo ativo", () => {
  it("mostra o mundo ativo e abre o Painel por padrão", async () => {
    comMundo();
    render(<MasterSuite uid="mestre-1" />);

    /* o nome aparece no seletor do topo e no hero do Painel (lazy) */
    expect(await screen.findAllByText("Cinzas de Aurum")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: /mundo ativo: cinzas de aurum/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /painel/i })).toHaveAttribute("aria-selected", "true");
  });

  it("resume o acervo do mundo no cabeçalho", async () => {
    comMundo();
    render(<MasterSuite uid="mestre-1" />);

    await screen.findByRole("heading", { name: "Cinzas de Aurum" });
    expect(screen.getByText("6 entidades · 1 conexão")).toBeInTheDocument();
  });

  it("lista as 9 ferramentas e marca as fases futuras como Em breve", async () => {
    comMundo();
    render(<MasterSuite uid="mestre-1" />);
    await screen.findByRole("heading", { name: "Cinzas de Aurum" });

    const rail = screen.getByRole("tablist", { name: "Ferramentas da Forja" });
    expect(within(rail).getAllByRole("tab")).toHaveLength(9);

    /* Fase 1 entrega duas: Painel e Wiki. As outras 7 informam sem prometer. */
    expect(within(rail).getAllByText("Em breve")).toHaveLength(7);
    expect(within(rail).getByRole("tab", { name: /grafo/i })).toHaveAttribute("aria-disabled", "true");
    expect(within(rail).getByRole("tab", { name: /^painel/i })).not.toHaveAttribute("aria-disabled");
    expect(within(rail).getByRole("tab", { name: /^wiki/i })).not.toHaveAttribute("aria-disabled");
  });

  it("ferramenta Em breve não navega — o Painel continua na tela", async () => {
    comMundo();
    render(<MasterSuite uid="mestre-1" />);
    await screen.findByRole("heading", { name: "Cinzas de Aurum" });

    const rail = screen.getByRole("tablist", { name: "Ferramentas da Forja" });
    fireEvent.click(within(rail).getByRole("tab", { name: /diário/i }));

    expect(within(rail).getByRole("tab", { name: /diário/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("heading", { name: "Cinzas de Aurum" })).toBeInTheDocument();
  });

  it("troca do Painel para a Wiki pelo rail", async () => {
    comMundo();
    render(<MasterSuite uid="mestre-1" />);
    await screen.findByRole("heading", { name: "Cinzas de Aurum" });

    const rail = screen.getByRole("tablist", { name: "Ferramentas da Forja" });
    fireEvent.click(within(rail).getByRole("tab", { name: /^wiki/i }));

    expect(within(rail).getByRole("tab", { name: /^wiki/i })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("searchbox")).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · PAINEL DO MUNDO  (AC-6)
 * ════════════════════════════════════════════════════════════════════ */
describe("Painel do mundo (AC-6)", () => {
  const montarPainel = (props = {}) =>
    render(
      <Dashboard
        world={MUNDO}
        entities={ENTIDADES}
        connections={[]}
        loading={false}
        onOpenType={nada}
        onOpenEntity={nada}
        onNavigate={nada}
        onNewEntity={nada}
        {...props}
      />,
    );

  it("conta as entidades por tipo, inclusive os tipos vazios", () => {
    montarPainel();

    expect(screen.getByLabelText(/^2 Personagens/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^1 Local /)).toBeInTheDocument();
    expect(screen.getByLabelText(/^1 Organização/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^1 Item /)).toBeInTheDocument();
    expect(screen.getByLabelText(/^1 Criatura /)).toBeInTheDocument();
    /* tipo sem nenhuma entidade continua no acervo, zerado (AC-4) */
    expect(screen.getByLabelText(/^0 Divindades/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^0 Rotas/)).toBeInTheDocument();
  });

  it("abre a Wiki filtrada ao clicar num contador de tipo", () => {
    const onOpenType = jest.fn();
    montarPainel({ onOpenType });

    fireEvent.click(screen.getByLabelText(/^2 Personagens/));
    expect(onOpenType).toHaveBeenCalledWith("character");
  });

  it("lista os editados recentemente, do mais novo para o mais velho", () => {
    montarPainel();

    const painel = screen.getByRole("region", { name: "Editados recentemente" });
    const nomes = within(painel)
      .getAllByRole("button")
      .map((b) => b.textContent);

    expect(nomes[0]).toContain("Sétimo Guardião");
    expect(nomes[1]).toContain("Muralha Cinzenta");
  });

  it("os primeiros passos refletem o estado real do mundo", () => {
    montarPainel();

    /* feitos: mundo criado + personagem + local ⇒ 3 de 6 */
    expect(screen.getByRole("progressbar", { name: /primeiros passos/i }))
      .toHaveAttribute("aria-valuenow", "50");

    /* passo cumprido não é clicável… */
    expect(screen.getByText("Adicionar um personagem").closest("button")).toBeNull();
    expect(screen.getByText("Criar um local").closest("button")).toBeNull();
    /* …e passo pendente com saída vira botão */
    expect(screen.getByText("Conectar duas entidades").closest("button")).toBeInTheDocument();
  });

  it("marca o passo de conexão como feito assim que existe uma aresta", () => {
    montarPainel({ connections: CONEXOES });

    expect(screen.getByRole("progressbar", { name: /primeiros passos/i }))
      .toHaveAttribute("aria-valuenow", "83");
    expect(screen.getByText("Conectar duas entidades").closest("button")).toBeNull();
  });

  it("mundo recém-criado começa o checklist só com o próprio mundo feito", () => {
    montarPainel({ entities: [], connections: [] });

    expect(screen.getByRole("progressbar", { name: /primeiros passos/i }))
      .toHaveAttribute("aria-valuenow", "17");
    expect(screen.getByText("Adicionar um personagem").closest("button")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /nada editado ainda/i })).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · WIKI — cards, busca, filtros  (AC-3 / AC-4)
 * ════════════════════════════════════════════════════════════════════ */
describe("Wiki (AC-3/AC-4)", () => {
  const montarWiki = (props = {}) =>
    render(
      <Wiki
        worldId="w1"
        entities={ENTIDADES}
        connections={CONEXOES}
        loading={false}
        initialType=""
        initialEntityId=""
        createType=""
        createSignal={0}
        {...props}
      />,
    );

  const chips = () => screen.getByRole("group", { name: "Filtrar por tipo de entidade" });

  it("mostra um card para cada entidade do mundo", () => {
    montarWiki();

    ENTIDADES.forEach((e) => {
      expect(screen.getByText(e.name)).toBeInTheDocument();
    });
  });

  it("a busca filtra por nome, ignorando a caixa", async () => {
    montarWiki();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "muralha" } });

    await waitFor(() => {
      expect(screen.getByText("Muralha Cinzenta")).toBeInTheDocument();
      expect(screen.queryByText("Sétimo Guardião")).not.toBeInTheDocument();
    });
  });

  it("a busca ignora acento — 'veu' acha 'Ordem do Véu' (AC-4)", async () => {
    montarWiki();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "veu" } });

    await waitFor(() => {
      expect(screen.getByText("Ordem do Véu")).toBeInTheDocument();
      expect(screen.queryByText("Muralha Cinzenta")).not.toBeInTheDocument();
    });
  });

  it("busca sem resultado mostra um vazio com saída, não uma tela morta", async () => {
    montarWiki();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "necromante" } });

    await waitFor(() => {
      expect(screen.queryByText("Muralha Cinzenta")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /nada|nenhum/i })).toBeInTheDocument();
  });

  it("clicar no filtro de um tipo restringe a lista", async () => {
    montarWiki();

    fireEvent.click(within(chips()).getByRole("button", { name: /^Personagem/ }));

    await waitFor(() => {
      expect(screen.queryByText("Muralha Cinzenta")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Sétimo Guardião")).toBeInTheDocument();
    expect(screen.getByText("Dama do Sino")).toBeInTheDocument();
  });

  it("tipo com contagem zero fica desabilitado, nunca escondido (AC-4)", () => {
    montarWiki();

    const divindade = within(chips()).getByRole("button", { name: /^Divindade/ });
    expect(divindade).toBeInTheDocument();
    expect(divindade).toBeDisabled();

    /* os 11 tipos + o chip "Todos" seguem na barra, cheios ou vazios */
    expect(within(chips()).getAllByRole("button")).toHaveLength(12);
  });

  it("abre já filtrada quando o Painel manda um tipo (initialType)", async () => {
    montarWiki({ initialType: "location" });

    await waitFor(() => {
      expect(screen.getByText("Muralha Cinzenta")).toBeInTheDocument();
      expect(screen.queryByText("Sétimo Guardião")).not.toBeInTheDocument();
    });
  });

  it("alterna entre grade e lista sem perder as entidades", async () => {
    montarWiki();

    fireEvent.click(screen.getByRole("button", { name: "Ver em lista" }));

    await waitFor(() => {
      expect(screen.getByText("Muralha Cinzenta")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Ver em lista" })).toHaveAttribute("aria-pressed", "true");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · DETALHE DA ENTIDADE  (AC-3 / AC-5)
 * ════════════════════════════════════════════════════════════════════ */
describe("Detalhe da entidade (AC-5)", () => {
  const abrirMuralha = () => {
    render(
      <Wiki
        worldId="w1"
        entities={ENTIDADES}
        connections={CONEXOES}
        loading={false}
        initialType=""
        initialEntityId=""
        createType=""
        createSignal={0}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Local: Muralha Cinzenta" }));
  };

  it("mostra descrição e atributos do verbete", async () => {
    abrirMuralha();

    expect(await screen.findByRole("heading", { name: "Muralha Cinzenta", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/quarenta metros de pedra fria/i)).toBeInTheDocument();
    expect(screen.getByText("Altura")).toBeInTheDocument();
    expect(screen.getByText("40 metros")).toBeInTheDocument();
    expect(screen.getByText("Erguida em")).toBeInTheDocument();
  });

  it("mostra a conexão pelo lado certo — quem GUARDA vira GUARDADO POR (AC-5)", async () => {
    abrirMuralha();

    await screen.findByRole("heading", { name: "Muralha Cinzenta", level: 1 });
    expect(screen.getByRole("heading", { name: /Conexões/ })).toHaveTextContent("1");
    expect(screen.getByText("GUARDADO POR")).toBeInTheDocument();
    expect(screen.getByText("Sétimo Guardião")).toBeInTheDocument();
  });

  it("volta do detalhe para a lista", async () => {
    abrirMuralha();

    await screen.findByRole("heading", { name: "Muralha Cinzenta", level: 1 });
    fireEvent.click(screen.getByRole("button", { name: /^wiki$/i }));

    await waitFor(() => {
      expect(screen.getByText("Sétimo Guardião")).toBeInTheDocument();
      expect(screen.getByText("Ordem do Véu")).toBeInTheDocument();
    });
  });
});
