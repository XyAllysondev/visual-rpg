/* ════════════════════════════════════════════════════════════════════
 *  ATELIÊ DO MESTRE — SMOKE TESTS DE RENDERIZAÇÃO  (spec 0028 · F1)
 *  --------------------------------------------------------------------
 *  Prova que a interface do AC-2 (listar, criar, renomear, excluir, subir
 *  ilustração) e a do AC-3 (cota que explica, nunca falha em silêncio)
 *  acontecem de verdade no DOM.
 *
 *  Fronteira mockada: só `../worldMapStore` — é o I/O (Firestore/Storage).
 *  `../model/quotas` roda de VERDADE: quem decide se cabe outro mapa aqui é
 *  o código de produção, não um dublê.
 * ════════════════════════════════════════════════════════════════════ */

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

/* ── A fronteira de I/O ─────────────────────────────────────────────── */
jest.mock("../worldMapStore", () => ({
  useWorldMaps: jest.fn(),
  createWorldMap: jest.fn(),
  updateWorldMap: jest.fn(),
  deleteWorldMap: jest.fn(),
  uploadBackground: jest.fn(),
  getBackground: jest.fn(),
  fundoDisponivel: jest.fn(),
  LIMITE_FUNDO_BYTES: 900_000,
  AVISO_FUNDO_NO_DOCUMENTO:
    "Enquanto o armazenamento de arquivos do Nexus não é ligado, a ilustração fica guardada dentro do próprio mapa. Ela é reduzida automaticamente e precisa caber em cerca de 0,9 MB.",
}));

import Atelier from "../Atelier";
import {
  useWorldMaps, createWorldMap, updateWorldMap, deleteWorldMap, uploadBackground,
  getBackground, fundoDisponivel,
} from "../worldMapStore";

/* ── Acervo de teste ────────────────────────────────────────────────── */

const AGORA = Date.now();
const h = (n) => AGORA - n * 3600 * 1000;

const MOLDE = {
  id: "m1",
  name: "As Terras Partidas",
  description: "Um continente rachado ao meio pelo Incidente.",
  nodeCount: 7,
  updatedAt: h(2),
};

const OUTRO = { id: "m2", name: "Vale do Sino", nodeCount: 0, updatedAt: h(30) };

/* O preset do CRA roda com `resetMocks: true`: toda implementação some entre
 * testes. O estado "de fábrica" do store é remontado aqui, sempre. */
beforeEach(() => {
  useWorldMaps.mockReturnValue({ maps: [], loading: false, error: null });
  createWorldMap.mockResolvedValue("novo-1");
  updateWorldMap.mockResolvedValue(undefined);
  deleteWorldMap.mockResolvedValue(undefined);
  uploadBackground.mockResolvedValue({ url: "https://exemplo/f.png", path: "p", width: 10, height: 10 });
  getBackground.mockResolvedValue(null);
  /* Padrão dos testes: o mundo em que o Storage está de pé (plano Blaze). O
   * mundo de HOJE — Storage indisponível, ilustração em base64 dentro do
   * documento (ADR-0008, opção B) — tem testes próprios mais abaixo, porque as
   * duas realidades precisam continuar cobertas quando o Andre subir de plano. */
  fundoDisponivel.mockReturnValue(true);
});

const comMoldes = (maps) => useWorldMaps.mockReturnValue({ maps, loading: false, error: null });

/* ════════════════════════════════════════════════════════════════════
 *  1 · CASCA E ESTADO VAZIO  (AC-2)
 * ════════════════════════════════════════════════════════════════════ */
describe("Ateliê · casca e estado vazio (AC-2)", () => {
  it("pede login quando não há uid, sem tentar ler molde nenhum", () => {
    render(<Atelier />);

    expect(screen.getByRole("heading", { name: /entre para abrir o ateliê/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /novo mapa-múndi/i })).not.toBeInTheDocument();
  });

  it("o vazio explica o que é um mapa-múndi e convida a criar o primeiro", () => {
    render(<Atelier uid="mestre-1" plan="free" />);

    expect(screen.getByRole("heading", { name: /nenhum mapa-múndi ainda/i })).toBeInTheDocument();
    expect(screen.getByText(/a névoa recua/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar meu primeiro mapa-múndi" })).toBeInTheDocument();
  });

  it("a falha de leitura fala português, sem erro cru do Firebase", () => {
    const erro = new Error("Missing or insufficient permissions.");
    erro.code = "permission-denied";
    useWorldMaps.mockReturnValue({ maps: [], loading: false, error: erro });

    render(<Atelier uid="mestre-1" />);

    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent(/os mapas não carregaram/i);
    expect(alerta).not.toHaveTextContent(/Missing or insufficient permissions/i);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · LISTA DE MOLDES  (AC-2)
 * ════════════════════════════════════════════════════════════════════ */
describe("Ateliê · lista de moldes (AC-2)", () => {
  it("mostra um card por molde, com nome, contagem de nós e data", () => {
    comMoldes([MOLDE, OUTRO]);
    render(<Atelier uid="mestre-1" plan="pro" />);

    expect(screen.getByText("As Terras Partidas")).toBeInTheDocument();
    expect(screen.getByText(/7 nós/)).toBeInTheDocument();
    expect(screen.getByText("Vale do Sino")).toBeInTheDocument();
    /* mapa recém-criado não diz "0 nós" — diz que ainda não tem nenhum */
    expect(screen.getByText(/nenhum nó/)).toBeInTheDocument();
    expect(screen.getByText(/há 2 h/)).toBeInTheDocument();
  });

  it("cada card oferece abrir, renomear e excluir com rótulo próprio", () => {
    comMoldes([MOLDE]);
    render(<Atelier uid="mestre-1" plan="pro" />);

    expect(screen.getByRole("button", { name: "Abrir mapa-múndi: As Terras Partidas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Renomear As Terras Partidas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir As Terras Partidas" })).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · CRIAR  (AC-2)
 * ════════════════════════════════════════════════════════════════════ */
describe("Ateliê · criar molde (AC-2)", () => {
  const abrirModal = () => {
    render(<Atelier uid="mestre-1" plan="pro" />);
    fireEvent.click(screen.getByRole("button", { name: /novo mapa-múndi/i }));
    return screen.getByRole("dialog");
  };

  it("o modal exige nome e mantém a descrição opcional", async () => {
    const modal = abrirModal();

    /* sem nome, não há o que salvar */
    expect(within(modal).getByRole("button", { name: "Criar mapa" })).toBeDisabled();

    fireEvent.change(within(modal).getByLabelText(/^Nome/), { target: { value: "Mar de Ferro" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Criar mapa" }));

    await waitFor(() => expect(createWorldMap).toHaveBeenCalledWith(
      "mestre-1", { name: "Mar de Ferro", description: "", plan: "pro" },
    ));
  });

  it("leva a descrição junto quando o mestre escreve uma", async () => {
    const modal = abrirModal();

    fireEvent.change(within(modal).getByLabelText(/^Nome/), { target: { value: "Mar de Ferro" } });
    fireEvent.change(within(modal).getByLabelText(/^Descrição/), { target: { value: "Água que enferruja." } });
    fireEvent.click(within(modal).getByRole("button", { name: "Criar mapa" }));

    await waitFor(() => expect(createWorldMap).toHaveBeenCalledWith(
      "mestre-1", { name: "Mar de Ferro", description: "Água que enferruja.", plan: "pro" },
    ));
  });

  it("Esc fecha o modal limpo e devolve o foco a quem abriu", async () => {
    render(<Atelier uid="mestre-1" plan="pro" />);
    const gatilho = screen.getByRole("button", { name: /novo mapa-múndi/i });
    /* `fireEvent.click` não move o foco no jsdom; o navegador move. Focar
     * antes reproduz o clique de verdade — é dele que o modal precisa lembrar. */
    gatilho.focus();
    fireEvent.click(gatilho);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(gatilho);
  });

  it("a recusa do store aparece no modal — nunca falha em silêncio (AC-3)", async () => {
    createWorldMap.mockRejectedValue(new Error("Seu plano permite 1 mapa-múndi. Exclua um antes de criar outro."));
    const modal = abrirModal();

    fireEvent.change(within(modal).getByLabelText(/^Nome/), { target: { value: "Mar de Ferro" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Criar mapa" }));

    expect(await within(modal).findByRole("alert")).toHaveTextContent(/permite 1 mapa-múndi/i);
    /* o modal continua aberto: o mestre não perde o que digitou */
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · COTA POR PLANO  (AC-3)
 *  --------------------------------------------------------------------
 *  `model/quotas` roda de verdade aqui: free = 1 mapa (spec AC-3).
 * ════════════════════════════════════════════════════════════════════ */
describe("Ateliê · cota por plano (AC-3)", () => {
  it("no limite do plano free a interface explica o limite e o caminho", () => {
    comMoldes([MOLDE]);
    render(<Atelier uid="mestre-1" plan="free" />);

    const aviso = screen.getByRole("status");
    expect(aviso).toHaveTextContent(/limite do plano/i);
    expect(aviso).toHaveTextContent(/planos/i);
    expect(screen.getByRole("button", { name: /novo mapa-múndi/i }))
      .toHaveAttribute("aria-disabled", "true");
  });

  it("clicar no botão bloqueado explica em vez de abrir o modal", () => {
    comMoldes([MOLDE]);
    render(<Atelier uid="mestre-1" plan="free" />);

    fireEvent.click(screen.getByRole("button", { name: /novo mapa-múndi/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(createWorldMap).not.toHaveBeenCalled();
  });

  it("o plano pago não é barrado com um mapa na conta", () => {
    comMoldes([MOLDE]);
    render(<Atelier uid="mestre-1" plan="pro" />);

    expect(screen.getByRole("button", { name: /novo mapa-múndi/i }))
      .not.toHaveAttribute("aria-disabled");
    expect(screen.queryByText(/limite do plano/i)).not.toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · RENOMEAR E EXCLUIR  (AC-2)
 * ════════════════════════════════════════════════════════════════════ */
describe("Ateliê · renomear e excluir (AC-2)", () => {
  it("renomear abre o modal já preenchido e grava o patch", async () => {
    comMoldes([MOLDE]);
    render(<Atelier uid="mestre-1" plan="pro" />);

    fireEvent.click(screen.getByRole("button", { name: "Renomear As Terras Partidas" }));
    const modal = await screen.findByRole("dialog");
    expect(within(modal).getByLabelText(/^Nome/)).toHaveValue("As Terras Partidas");

    fireEvent.change(within(modal).getByLabelText(/^Nome/), { target: { value: "As Terras Inteiras" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateWorldMap).toHaveBeenCalledWith(
      "mestre-1", "m1",
      { name: "As Terras Inteiras", description: MOLDE.description },
    ));
  });

  it("excluir pede confirmação — cancelar não apaga nada", async () => {
    comMoldes([MOLDE]);
    render(<Atelier uid="mestre-1" plan="pro" />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir As Terras Partidas" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(dialogo).toHaveTextContent(/excluir mapa-múndi\?/i);

    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(deleteWorldMap).not.toHaveBeenCalled();
  });

  it("confirmar apaga o molde", async () => {
    comMoldes([MOLDE]);
    render(<Atelier uid="mestre-1" plan="pro" />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir As Terras Partidas" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(deleteWorldMap).toHaveBeenCalledWith("mestre-1", "m1"));
  });

  it("a falha da exclusão vira frase, não tela quebrada", async () => {
    comMoldes([MOLDE]);
    const erro = new Error("Missing or insufficient permissions.");
    erro.code = "permission-denied";
    deleteWorldMap.mockRejectedValue(erro);
    render(<Atelier uid="mestre-1" plan="pro" />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir As Terras Partidas" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }));

    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(/não é seu|removido/i);
    /* o card continua na lista (o nome também aparece dentro do diálogo) */
    expect(screen.getAllByText("As Terras Partidas").length).toBeGreaterThan(0);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  6 · MOLDE ABERTO E ILUSTRAÇÃO DE FUNDO  (AC-2)
 * ════════════════════════════════════════════════════════════════════ */
describe("Ateliê · molde aberto (AC-2)", () => {
  const abrirMolde = () => {
    comMoldes([MOLDE]);
    render(<Atelier uid="mestre-1" plan="pro" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir mapa-múndi: As Terras Partidas" }));
  };

  const arquivo = (nome = "mapa.png", tipo = "image/png") =>
    new File(["conteudo-binario"], nome, { type: tipo });

  it("abre o molde e é honesto sobre o que ainda não existe (Fase 2)", () => {
    abrirMolde();

    expect(screen.getByRole("heading", { name: "As Terras Partidas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /nós e trilhas/i })).toBeInTheDocument();
    expect(screen.getByText(/chega na\s+próxima fase/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /todos os mapas/i })).toBeInTheDocument();
  });

  it("oferece a zona de envio da ilustração de fundo", () => {
    abrirMolde();

    expect(screen.getByRole("heading", { name: /ilustração de fundo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escolher imagem" })).toBeInTheDocument();
    /* nada sobe antes de o mestre mandar */
    expect(screen.queryByRole("button", { name: /enviar ilustração/i })).not.toBeInTheDocument();
  });

  it("mostra a prévia local antes de subir e só então envia", async () => {
    abrirMolde();

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [arquivo()] } });

    const enviar = await screen.findByRole("button", { name: "Enviar ilustração" });
    expect(await screen.findByAltText(/prévia da ilustração/i)).toBeInTheDocument();
    expect(uploadBackground).not.toHaveBeenCalled();

    fireEvent.click(enviar);

    await waitFor(() => expect(uploadBackground).toHaveBeenCalledWith(
      "mestre-1", "m1", expect.any(File),
    ));
    expect(await screen.findByRole("status")).toHaveTextContent(/ilustração enviada/i);
  });

  it("recusa arquivo que não é imagem, antes de gastar rede", async () => {
    abrirMolde();

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(["x"], "ficha.pdf", { type: "application/pdf" })] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/arquivo de imagem/i);
    expect(uploadBackground).not.toHaveBeenCalled();
  });

  /* RISCO DE F0 §5.1: o projeto está no plano Spark e o Storage pode não
   * estar disponível. A falha precisa virar frase, não tela branca. */
  it("Storage indisponível vira aviso em português, não tela quebrada", async () => {
    const erro = new Error("Firebase Storage: An unknown error occurred");
    erro.code = "storage/unknown";
    uploadBackground.mockRejectedValue(erro);
    const gritos = jest.spyOn(console, "error").mockImplementation(() => {});
    abrirMolde();

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [arquivo()] } });
    fireEvent.click(await screen.findByRole("button", { name: "Enviar ilustração" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/a ilustração não subiu/i);
    expect(alerta).toHaveTextContent(/Firebase Storage pode não estar habilitado/i);
    expect(alerta).not.toHaveTextContent(/An unknown error occurred/);
    /* a tela continua de pé, com o molde aberto */
    expect(screen.getByRole("heading", { name: "As Terras Partidas" })).toBeInTheDocument();
    gritos.mockRestore();
  });

  /* ── O MUNDO DE HOJE: ilustração em base64 (ADR-0008, opção B) ──────
   * O bucket do projeto não existe (plano Spark) e o Andre decidiu ficar no
   * gratuito por enquanto. O envio CONTINUA funcionando — o que muda é onde a
   * imagem mora e o teto de tamanho. A tela precisa dizer isso ANTES, não
   * bloquear o mestre nem deixá-lo descobrir o limite depois de esperar. */
  it("sem Storage, o envio continua liberado e o limite é dito antes da escolha", () => {
    fundoDisponivel.mockReturnValue(false);
    abrirMolde();

    expect(screen.getByRole("button", { name: "Escolher imagem" })).toBeEnabled();
    const avisos = screen.getAllByRole("status").map((el) => el.textContent).join(" ");
    expect(avisos).toMatch(/dentro do próprio mapa/i);
    /* o teto aparece junto dos formatos aceitos, antes de qualquer upload */
    expect(screen.getByText(/precisa caber em 0,9 MB dentro do mapa/i)).toBeInTheDocument();
  });

  it("sem Storage, a imagem escolhida sobe pelo mesmo caminho da tela", async () => {
    fundoDisponivel.mockReturnValue(false);
    uploadBackground.mockResolvedValue({
      url: "data:image/jpeg;base64,AAAA", path: null, width: 1600, height: 1067,
    });
    abrirMolde();

    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [arquivo()] } });
    /* espera a prévia local aparecer antes de enviar — é o que o mestre faz, e
     * evita o `FileReader` resolver depois do envio e repor a prévia */
    await screen.findByAltText(/prévia da ilustração/i);
    fireEvent.click(await screen.findByRole("button", { name: "Enviar ilustração" }));

    await waitFor(() => expect(uploadBackground).toHaveBeenCalledWith("mestre-1", "m1", expect.any(File)));
    /* a dataURL devolvida vira o fundo mostrado, sem esperar o snapshot */
    expect(await screen.findByAltText(/ilustração de fundo de as terras partidas/i))
      .toHaveAttribute("src", "data:image/jpeg;base64,AAAA");
  });

  it("a recusa por tamanho explica o porquê e o que fazer", async () => {
    fundoDisponivel.mockReturnValue(false);
    uploadBackground.mockRejectedValue(new Error(
      "Esta imagem não cabe no mapa nem depois de reduzida automaticamente (o limite é de cerca "
      + "de 0,9 MB por ilustração). Escolha uma imagem menor, com menos detalhe, ou recorte só a "
      + "área que importa — nada foi salvo.",
    ));
    const gritos = jest.spyOn(console, "error").mockImplementation(() => {});
    abrirMolde();

    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [arquivo()] } });
    fireEvent.click(await screen.findByRole("button", { name: "Enviar ilustração" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/não cabe no mapa/i);
    expect(alerta).toHaveTextContent(/imagem menor|recorte/i);
    gritos.mockRestore();
  });

  /* O doc do molde só carrega a MINIATURA; a ilustração cheia é lida sob
   * demanda. Se este teste cair, ou a lista voltou a trafegar a imagem inteira,
   * ou o molde aberto ficou exibindo 200px borrados. */
  it("busca a ilustração cheia quando o molde aponta para o documento de mídia", async () => {
    getBackground.mockResolvedValue("data:image/jpeg;base64,CHEIA");
    comMoldes([{ ...MOLDE, backgroundRef: "media/background", backgroundThumb: "data:image/jpeg;base64,MINI" }]);
    render(<Atelier uid="mestre-1" plan="pro" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir mapa-múndi: As Terras Partidas" }));

    await waitFor(() => expect(getBackground).toHaveBeenCalledWith("mestre-1", "m1"));
    expect(await screen.findByAltText(/ilustração de fundo de as terras partidas/i))
      .toHaveAttribute("src", "data:image/jpeg;base64,CHEIA");
  });

  it("volta do molde para a lista", async () => {
    comMoldes([MOLDE, OUTRO]);
    render(<Atelier uid="mestre-1" plan="pro" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir mapa-múndi: As Terras Partidas" }));
    fireEvent.click(screen.getByRole("button", { name: /todos os mapas/i }));

    await waitFor(() => expect(screen.getByText("Vale do Sino")).toBeInTheDocument());
  });
});
