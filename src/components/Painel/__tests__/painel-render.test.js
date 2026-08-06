/* ════════════════════════════════════════════════════════════════════
 *  PAINEL — SMOKE TESTS DE RENDERIZAÇÃO
 *  --------------------------------------------------------------------
 *  O Painel é uma tela de resumo: o risco dele não é lógica complicada,
 *  é MOSTRAR NÚMERO QUE NÃO EXISTE. Por isso o que está travado aqui é a
 *  correspondência entre estado real e o que aparece no DOM — contadores,
 *  cota, pendências e os passos do preparo.
 *
 *  Fronteira mockada: só os dois repositórios de I/O (mapas do Ateliê e
 *  mundos da Forja). Todo o resto — filtro por sistema, cota do plano,
 *  ordenação do retomar — roda o código de produção.
 *
 *  `matchMedia` responde "movimento reduzido" de propósito: assim a
 *  contagem animada escreve o valor final de uma vez e a asserção não
 *  depende de quantos frames o jsdom resolveu rodar.
 * ════════════════════════════════════════════════════════════════════ */

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../../../infrastructure/firestore/worldMapsRepo", () => ({
  contarMapas: jest.fn(),
}));
jest.mock("../../../infrastructure/firestore/worldsRepo", () => ({
  watchWorldsByOwner: jest.fn(),
}));

import Painel from "../index";
import { LocaleProvider } from "../../../i18n/useLocale";
import { contarMapas } from "../../../infrastructure/firestore/worldMapsRepo";
import { watchWorldsByOwner } from "../../../infrastructure/firestore/worldsRepo";

const UID = "mestre-1";
const SISTEMA = { id: "op", name: "Ordem Paranormal", accent: "#b030d8", desc: "Enfrente o Outro Lado." };

const ficha = (id, nome, extra = {}) => ({
  id, systemId: "op", nex: 15,
  form: { personagem: nome },
  classe: { name: "Combatente" }, origem: { name: "Militar" },
  pv: 20, pvMax: 20, san: 12, sanMax: 12,
  ...extra,
});

const mesa = (id, nome, extra = {}) => ({
  id, name: nome, isActive: true, masterId: UID,
  members: [UID], maxPlayers: 6, system: "Ordem Paranormal",
  ...extra,
});

function montar(props = {}) {
  return render(
    <LocaleProvider>
      <Painel system={SISTEMA} uid={UID} characters={[]} campaigns={[]} sessions={[]}
        userPlans={[]} {...props} />
    </LocaleProvider>,
  );
}

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: q.includes("prefers-reduced-motion"),
    media: q, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  }));
});

beforeEach(() => {
  contarMapas.mockResolvedValue(0);
  watchWorldsByOwner.mockImplementation((uid, onChange) => { onChange([]); return () => {}; });
});

afterEach(() => jest.clearAllMocks());

describe("Painel — montagem", () => {
  it("monta a tela e o cabeçalho do sistema ativo", async () => {
    montar();
    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(screen.getByText(/Bem-vindo de volta/i)).toBeInTheDocument();
    expect(screen.getByText(SISTEMA.desc)).toBeInTheDocument();
  });

  it("conta mundo vazio sem inventar número: nenhum vazio vira '—' ou placeholder", async () => {
    montar();
    expect(await screen.findByText("Nenhuma mesa ativa")).toBeInTheDocument();
    expect(screen.getByText("Nenhum agente ainda")).toBeInTheDocument();
  });
});

describe("Painel — números", () => {
  it("fichas mostram a cota do plano livre (1) e as mesas separam mestre de jogador", async () => {
    contarMapas.mockResolvedValue(2);
    montar({
      characters: [ficha(1, "Alma")],
      campaigns: [mesa("c1", "Dragon Tale"), mesa("c2", "Outra", { masterId: "outro", members: ["outro", UID] })],
    });

    const fichasBtn = await screen.findByTitle("Ver todas as fichas");
    expect(fichasBtn).toHaveTextContent("1/1");

    expect(screen.getByTitle("Mesas ativas que você mestra")).toHaveTextContent("1/3");
    expect(screen.getByTitle("Mesas em que você joga")).toHaveTextContent("1");
    await waitFor(() => expect(screen.getByTitle("Abrir os mapas")).toHaveTextContent("2"));
  });

  it("assinante do sistema enxerga cota de 5 fichas", async () => {
    montar({ characters: [ficha(1, "Alma")], userPlans: ["op"] });
    expect(await screen.findByTitle("Ver todas as fichas")).toHaveTextContent("1/5");
  });

  it("campanha arquivada não conta como mesa ativa", async () => {
    montar({ campaigns: [mesa("c1", "Encerrada", { isActive: false })] });
    expect(await screen.findByTitle("Mesas ativas que você mestra")).toHaveTextContent("0/3");
  });
});

describe("Painel — precisa de você", () => {
  it("anuncia as vagas abertas da mesa que você mestra e abre a campanha", async () => {
    const onOpenCampaign = jest.fn();
    montar({ characters: [ficha(1, "Alma")], campaigns: [mesa("c1", "Dragon Tale")], onOpenCampaign });

    const alerta = await screen.findByText(/vagas abertas/);
    expect(alerta).toHaveTextContent("Dragon Tale");
    expect(alerta).toHaveTextContent("5");          // 6 lugares − 1 membro

    fireEvent.click(alerta.closest("button"));
    expect(onOpenCampaign).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
  });

  it("mesa lotada não vira pendência", async () => {
    montar({
      characters: [ficha(1, "Alma")],
      campaigns: [mesa("c1", "Cheia", { members: [UID, "a", "b", "c", "d", "e"] })],
    });
    await screen.findByRole("heading", { name: "Painel" });
    expect(screen.queryByText(/vagas abertas/)).not.toBeInTheDocument();
  });

  it("cota estourada no plano livre aponta para os planos — a saída, não um beco", async () => {
    const onShowUpgrade = jest.fn();
    montar({ characters: [ficha(1, "Alma")], onShowUpgrade });

    const alerta = await screen.findByText(/limite de 1 ficha do plano livre/i);
    fireEvent.click(alerta.closest("button"));
    expect(onShowUpgrade).toHaveBeenCalled();
  });
});

describe("Painel — retomar", () => {
  it("aponta para a ficha mais recente e a abre", async () => {
    const onSelectChar = jest.fn();
    montar({ characters: [ficha(100, "Antiga"), ficha(900, "Recente")], userPlans: ["op"], onSelectChar });

    const faixa = await screen.findByText("Continuar de onde parou");
    expect(faixa.closest("button")).toHaveTextContent("Recente");

    fireEvent.click(faixa.closest("button"));
    expect(onSelectChar).toHaveBeenCalledWith(expect.objectContaining({ id: 900 }));
  });

  it("sem ficha nenhuma, retoma pela mesa ativa", async () => {
    montar({ campaigns: [mesa("c1", "Dragon Tale")] });
    const faixa = await screen.findByText("Continuar de onde parou");
    expect(faixa.closest("button")).toHaveTextContent("Dragon Tale");
  });

  it("mundo totalmente vazio não mostra faixa de retomar", async () => {
    montar();
    await screen.findByRole("heading", { name: "Painel" });
    expect(screen.queryByText("Continuar de onde parou")).not.toBeInTheDocument();
  });
});

describe("Painel — preparo do mundo", () => {
  it("os passos saem do estado real, não de marcação manual", async () => {
    contarMapas.mockResolvedValue(1);
    montar({ characters: [ficha(1, "Alma")], campaigns: [mesa("c1", "Dragon Tale")] });

    /* ficha ✓ · campanha ✓ · mapa ✓ · mundo da Forja ✗ = 3 de 4 */
    expect(await screen.findByText("3 de 4 prontos")).toBeInTheDocument();
    expect(screen.getByText("Montar seu mundo na Forja").closest("button")).toBeInTheDocument();
  });

  it("o passo pendente navega para a ferramenta que o resolve", async () => {
    const onNav = jest.fn();
    montar({ characters: [ficha(1, "Alma")], onNav });
    fireEvent.click((await screen.findByText("Desenhar um mapa")).closest("button"));
    expect(onNav).toHaveBeenCalledWith("map");
  });

  it("preparo cumprido some da tela — não fica um 4/4 decorativo", async () => {
    contarMapas.mockResolvedValue(3);
    watchWorldsByOwner.mockImplementation((uid, onChange) => { onChange([{ id: "w1" }]); return () => {}; });
    montar({ characters: [ficha(1, "Alma")], campaigns: [mesa("c1", "Dragon Tale")], userPlans: ["op"] });

    await screen.findByRole("heading", { name: "Painel" });
    await waitFor(() => expect(screen.queryByText("Preparo do mundo")).not.toBeInTheDocument());
  });

  it("desliga o listener de mundos ao desmontar", async () => {
    const parar = jest.fn();
    watchWorldsByOwner.mockImplementation((uid, onChange) => { onChange([]); return parar; });
    const { unmount } = montar();
    await screen.findByRole("heading", { name: "Painel" });
    unmount();
    expect(parar).toHaveBeenCalled();
  });
});

describe("Painel — campanhas", () => {
  it("mostra a capa da campanha quando existe e marca quem você mestra", async () => {
    montar({
      campaigns: [
        mesa("c1", "Dragon Tale", { coverImage: "https://exemplo/capa.webp" }),
        mesa("c2", "Mesa do outro", { masterId: "outro", members: ["outro", UID] }),
      ],
    });
    await screen.findByRole("heading", { name: "Painel" });

    /* Escopo na seção: o nome da mesa também aparece no retomar e na pendência
       de vaga aberta — três acertos legítimos para o mesmo texto. */
    const secao = within(screen.getByRole("region", { name: "Suas campanhas" }));
    expect(secao.getByRole("button", { name: /Dragon Tale/ })).toHaveTextContent("você mestra");
    expect(secao.getByRole("button", { name: /Mesa do outro/ })).toHaveTextContent("você joga");
    expect(document.querySelector(".px-camp-img")).toHaveAttribute("src", "https://exemplo/capa.webp");
  });
});
