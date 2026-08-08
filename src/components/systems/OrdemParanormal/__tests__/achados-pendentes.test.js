/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — GATE DOS 5 ACHADOS PENDENTES (2026-08-07)
 *  ------------------------------------------------------------------------
 *  A primeira rodada da revisão deixou cinco itens fora do código, por serem
 *  decisão e não defeito óbvio. Este arquivo trava as decisões tomadas:
 *
 *    1. A mesa abre a ficha DO SISTEMA da ficha compartilhada.
 *    2. "Notas do Mestre" não existe mais na aba Descrição — e não pode
 *       voltar sem documento separado (a regra do Firestore deixa todo membro
 *       da campanha ler o doc inteiro).
 *    3. `AttrPentagon.jsx` foi apagado (código morto).
 *    4. O teto de itens homebrew é COBRADO, não só exibido.
 *    5. Avisos de lint — gate é `npm run build`, não este arquivo.
 * ════════════════════════════════════════════════════════════════════════ */
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { fichaDoSistema, OrdemParanormalSheet, DungeonsAndDragonsSheet } from "../../../../lib/lazySystemSheets";
import DescricaoTab from "../Tabs/DescricaoTab";
import InventarioTab from "../Tabs/InventarioTab";

describe("A mesa abre a ficha do sistema certo (achado 1)", () => {
  it("Ordem Paranormal → ficha-dossiê", () => {
    expect(fichaDoSistema({ systemId: "op" })).toBe(OrdemParanormalSheet);
  });
  it("ficha antiga, sem systemId, também é de Ordem Paranormal", () => {
    expect(fichaDoSistema({})).toBe(OrdemParanormalSheet);
    expect(fichaDoSistema(null)).toBe(OrdemParanormalSheet);
  });
  it("D&D → ficha de D&D", () => {
    expect(fichaDoSistema({ systemId: "dnd" })).toBe(DungeonsAndDragonsSheet);
  });
  it("sistema sem ficha própria → null, e quem chama decide", () => {
    expect(fichaDoSistema({ systemId: "outro-qualquer" })).toBeNull();
  });
});

describe("Descrição não tem mais Notas do Mestre (achado 2)", () => {
  const abrir = (descricao) => {
    render(<DescricaoTab descricao={descricao} setDescricao={() => {}} />);
  };

  it("mostra as cinco seções do jogador", () => {
    abrir({});
    ["Anotações", "Aparência", "Personalidade", "Histórico", "Objetivo"].forEach((s) =>
      expect(screen.getByText(s)).toBeInTheDocument());
  });

  it("nem com nota legada gravada a seção do mestre reaparece", () => {
    /* Ficha antiga pode ter `notas_mestre` no documento. O dado fica onde está;
     * o que não pode é a ficha exibir um campo com promessa de sigilo que a
     * regra `allow read: if isMember(campaignId)` não sustenta. */
    abrir({ notas_mestre: "<p>o vilão é o prefeito</p>" });
    expect(screen.queryByText(/Notas do Mestre/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/o vilão é o prefeito/i)).not.toBeInTheDocument();
  });
});

/* ── Achado 4: o teto de homebrew do inventário ────────────────────────── */
function CascaInventario({ itensIniciais, espiao }) {
  const [inv, setInv] = useState({ itens: itensIniciais, pontos_prestigio: 0 });
  espiao.current = inv;
  return <InventarioTab inventario={inv} setInventario={setInv} onRollDados={() => {}} attrs={{ FOR: 2 }} nex={5} />;
}
const itensHomebrew = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, nome: `Item ${i + 1}`, tipo: "geral", categoria: "I", espacos: 0, is_homebrew: true }));

describe("Inventário cobra o teto de itens próprios (achado 4)", () => {
  it("abaixo do teto, criar item funciona e o contador acompanha", () => {
    const espiao = { current: null };
    render(<CascaInventario itensIniciais={itensHomebrew(3)} espiao={espiao} />);
    expect(screen.getByText("3/50 próprios")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Arma" }));
    expect(espiao.current.itens).toHaveLength(4);
  });

  it("no teto, os botões de criar ficam desligados e o clique não cria nada", () => {
    const espiao = { current: null };
    render(<CascaInventario itensIniciais={itensHomebrew(50)} espiao={espiao} />);
    expect(screen.getByText("50/50 próprios")).toBeInTheDocument();

    const botao = screen.getByRole("button", { name: "Arma" });
    expect(botao).toBeDisabled();
    fireEvent.click(botao);
    expect(espiao.current.itens).toHaveLength(50);
  });

  it("item da biblioteca oficial não conta para o teto de homebrew", () => {
    const espiao = { current: null };
    const oficiais = itensHomebrew(50).map((it) => ({ ...it, is_homebrew: false }));
    render(<CascaInventario itensIniciais={oficiais} espiao={espiao} />);
    expect(screen.getByText("0/50 próprios")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arma" })).not.toBeDisabled();
  });
});
