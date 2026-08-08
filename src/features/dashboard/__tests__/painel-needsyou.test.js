/* ════════════════════════════════════════════════════════════════════
 *  PAINEL — "PRECISA DE VOCÊ"
 *  --------------------------------------------------------------------
 *  O bloco existe para carregar DECISÃO PENDENTE ou EVENTO VIVO. Os três
 *  contratos que ele não pode quebrar: ordem por urgência, corte em 4, e
 *  desaparecer inteiro quando não há nada — nunca um "Tudo em dia ✓".
 * ════════════════════════════════════════════════════════════════════ */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import NeedsYou, { montarPendencias } from "../NeedsYou";

const charDe = (id, nome) => ({ id, form: { personagem: nome } });

describe("montarPendencias", () => {
  it("põe edições sugeridas antes de ficha ao vivo e vaga por último", () => {
    const itens = montarPendencias({
      uid: "u1",
      pendentes: [{ charId: "10", charNome: "Marcos Vidal", quantidade: 2 }],
      liveSheets: { 20: [{ campaignId: "c1", sheetId: "s1" }] },
      characters: [charDe(10, "Marcos Vidal"), charDe(20, "Nadia")],
      campaigns: [{ id: "c1", name: "A Casa de Vidro", masterId: "u1", members: ["u1"], maxPlayers: 4 }],
    });
    expect(itens.map(i => i.tipo)).toEqual(["edicao", "vivo", "vaga"]);
    expect(itens[0].texto).toContain("Marcos Vidal");
    expect(itens[1].texto).toContain("A Casa de Vidro");
  });

  it("corta em 4 itens", () => {
    const pendentes = Array.from({ length: 7 }, (_, i) => ({
      charId: String(i), charNome: `Ficha ${i}`, quantidade: 7 - i,
    }));
    expect(montarPendencias({ pendentes })).toHaveLength(4);
  });

  it("oferece no máximo UMA campanha com vaga", () => {
    const campanhas = [
      { id: "a", name: "Uma", masterId: "u1", members: [], maxPlayers: 5 },
      { id: "b", name: "Outra", masterId: "u1", members: [], maxPlayers: 5 },
    ];
    const itens = montarPendencias({ uid: "u1", campaigns: campanhas });
    expect(itens.filter(i => i.tipo === "vaga")).toHaveLength(1);
  });

  it("ignora campanha lotada, arquivada ou de outro mestre", () => {
    const itens = montarPendencias({
      uid: "u1",
      campaigns: [
        { id: "a", name: "Lotada", masterId: "u1", members: [1, 2, 3], maxPlayers: 3 },
        { id: "b", name: "Arquivada", masterId: "u1", members: [], maxPlayers: 4, isActive: false },
        { id: "c", name: "De outro", masterId: "u9", members: [], maxPlayers: 4 },
      ],
    });
    expect(itens).toHaveLength(0);
  });

  it("ignora entrada de liveSheets com lista vazia", () => {
    expect(montarPendencias({ liveSheets: { 10: [] } })).toHaveLength(0);
  });
});

describe("<NeedsYou/>", () => {
  it("não renderiza nada quando não há pendência (sem 'tudo em dia')", () => {
    const { container } = render(<NeedsYou pendentes={[]} liveSheets={{}} campaigns={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o título e uma linha por item", () => {
    render(
      <NeedsYou
        uid="u1"
        pendentes={[{ charId: "10", charNome: "Marcos Vidal", quantidade: 2 }]}
        liveSheets={{}}
        characters={[charDe(10, "Marcos Vidal")]}
        campaigns={[]}
      />
    );
    expect(screen.getByText("Precisa de você")).toBeInTheDocument();
    expect(screen.getByText(/2 edições sugeridas/)).toBeInTheDocument();
    expect(screen.getByText("Revisar")).toBeInTheDocument();
  });
});
