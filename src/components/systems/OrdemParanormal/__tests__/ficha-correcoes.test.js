/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — GATE DAS CORREÇÕES DA REVISÃO DE 2026-08-07
 *  ------------------------------------------------------------------------
 *  Cada teste aqui nasceu de um defeito encontrado com a ficha na mão. Não
 *  são testes de "a tela renderiza": cada um falha na versão anterior do
 *  código e passa na atual.
 *
 *    1. Esquiva bônus era gravado, revisado e ignorado no número exibido.
 *    2. O botão "Gerar com IA" ignorava o próprio ajuste que promete ligá-lo.
 *    3. Item homebrew recém-criado perdia a marca ao ser salvo pela 1ª vez.
 *    4. Ritual da biblioteca perdia o id oficial — o motor de progressão o
 *       oferecia de novo e ele entrava duas vezes na ficha.
 *    5. Agente recém-criado aparecia INCONSCIENTE no painel, com PV 0/1.
 * ════════════════════════════════════════════════════════════════════════ */
import React, { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrdemParanormalSheet from "../OrdemParanormalSheet";
import DossierCard from "../DossierCard";
import InventarioTab from "../Tabs/InventarioTab";
import RituaisTab from "../Tabs/RituaisTab";
import RITUAIS_OFICIAIS from "../../../../data/ordemParanormal/rituais-oficiais.json";

/* A ficha desenha o retrato num canvas — que o jsdom não implementa. A
 * ausência do canvas não é o que estes testes medem. */
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
});

const fichaBase = {
  id: "t1",
  form: { personagem: "Agente de Teste" },
  attrs: { AGI: 3, FOR: 1, INT: 1, PRE: 1, VIG: 1 },
  classe: { id: "combatente", name: "Combatente" },
  nex: 5,
  skillTreino: { Reflexos: 5 },
  skillOutros: {},
};

const renderFicha = (extra = {}) =>
  render(<OrdemParanormalSheet character={{ ...fichaBase, ...extra }} onBack={() => {}} onUpdate={() => {}} onRoll={() => {}} />);

/* Casa pelo texto do nó inteiro — a fórmula da Esquiva é montada com vários
 * pedaços no mesmo elemento, e getByText com string exata não a encontra. */
const porTextoInteiro = (esperado) => (_, el) => el?.textContent?.trim() === esperado;

describe("Esquiva — o bônus persistido entra na conta (defeito 1)", () => {
  it("sem bônus: 10 + AGI + Reflexos", () => {
    renderFicha();
    expect(screen.getByText(porTextoInteiro("10+3AGI+Ref5"))).toBeInTheDocument();
    expect(screen.getAllByText("18").length).toBeGreaterThan(0); // 10+3+5
  });

  it("com esquivaBonus: soma no número E aparece na fórmula", () => {
    renderFicha({ esquivaBonus: 2 });
    expect(screen.getByText(porTextoInteiro("10+3AGI+Ref5+2"))).toBeInTheDocument();
    expect(screen.getAllByText("20").length).toBeGreaterThan(0); // 10+3+5+2
  });
});

describe("Retrato — o botão de IA obedece ao ajuste (defeito 2)", () => {
  const abrirRetrato = () => fireEvent.click(screen.getByRole("button", { name: /retrato do agente/i }));

  it("ajuste desligado: o botão não existe", () => {
    localStorage.setItem("nexus_ai_art", "0");
    renderFicha();
    abrirRetrato();
    expect(screen.getByText("Enviar arquivo")).toBeInTheDocument();
    expect(screen.queryByText(/Gerar com IA/i)).not.toBeInTheDocument();
  });

  it("ajuste ligado: o botão aparece", () => {
    localStorage.setItem("nexus_ai_art", "1");
    renderFicha();
    abrirRetrato();
    expect(screen.getByText(/Gerar com IA/i)).toBeInTheDocument();
    localStorage.setItem("nexus_ai_art", "0");
  });
});

describe("Painel — agente recém-criado não nasce inconsciente (defeito 5)", () => {
  /* O criador grava só atributos, origem, classe e NEX. Sem os máximos no
   * documento, o card lia 0/1 e carimbava INCONSCIENTE. */
  const recemCriado = {
    id: 1, nex: 5, form: { personagem: "Novato" },
    attrs: { AGI: 1, FOR: 1, INT: 1, PRE: 2, VIG: 3 },
    classe: { id: "combatente", name: "Combatente" },
    origem: { id: "militar", name: "Militar" },
  };

  it("mostra PV/SAN cheios pela tabela da classe, e status ESTÁVEL", () => {
    render(<DossierCard character={recemCriado} onClick={() => {}} />);
    expect(screen.getByText("ESTÁVEL")).toBeInTheDocument();
    expect(screen.queryByText("INCONSCIENTE")).not.toBeInTheDocument();
    expect(screen.getByText("23/23")).toBeInTheDocument(); // PV combatente: 20 + VIG 3
    expect(screen.getByText("12/12")).toBeInTheDocument(); // SAN combatente no NEX 5%
  });

  it("ficha com vitais gravados continua mandando no que mostra", () => {
    render(<DossierCard character={{ ...recemCriado, pv: 0, pvMax: 23, san: 5, sanMax: 12 }} onClick={() => {}} />);
    expect(screen.getByText("INCONSCIENTE")).toBeInTheDocument();
    expect(screen.getByText("0/23")).toBeInTheDocument();
  });
});

/* ── Inventário ──────────────────────────────────────────────────────────
 * Casca com estado real: o defeito só aparece no CICLO criar → salvar, que é
 * onde a lista e o modal precisavam apontar para o mesmo objeto. */
function CascaInventario({ espiao }) {
  const [inv, setInv] = useState({ itens: [], pontos_prestigio: 0 });
  espiao.current = inv;
  return <InventarioTab inventario={inv} setInventario={setInv} onRollDados={() => {}} attrs={{ FOR: 2 }} nex={5} />;
}

describe("Inventário — item novo continua homebrew depois de salvo (defeito 3)", () => {
  it("criar e salvar preserva is_homebrew", () => {
    const espiao = { current: null };
    render(<CascaInventario espiao={espiao} />);

    fireEvent.click(screen.getByRole("button", { name: "Arma" }));
    expect(espiao.current.itens).toHaveLength(1);
    expect(espiao.current.itens[0].is_homebrew).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(espiao.current.itens).toHaveLength(1);
    expect(espiao.current.itens[0].is_homebrew).toBe(true);
  });
});

/* ── Rituais ─────────────────────────────────────────────────────────── */
function CascaRituais({ espiao }) {
  const [rituais, setRituais] = useState([]);
  espiao.current = rituais;
  return <RituaisTab rituais={rituais} setRituais={setRituais} dtBase={11} dtBonus={0} setDtBonus={() => {}} onRollDados={() => {}} nex={5} />;
}

describe("Rituais — o id oficial sobrevive à adição (defeito 4)", () => {
  const oficial = RITUAIS_OFICIAIS[0];
  const abrirBiblioteca = () => fireEvent.click(screen.getByRole("button", { name: "+ Adicionar" }));
  /* Procura a linha DENTRO do modal: depois de adicionado, o mesmo nome também
   * existe no card do ritual na ficha, atrás do modal. */
  const linhaDo = (nome) =>
    [...document.querySelectorAll(".op-add-row")].find((el) => el.textContent.includes(nome));

  it("o ritual entra com o id do livro, não com um número novo", () => {
    const espiao = { current: null };
    render(<CascaRituais espiao={espiao} />);
    abrirBiblioteca();
    fireEvent.change(screen.getByPlaceholderText("Buscar ritual…"), { target: { value: oficial.nome } });
    fireEvent.click(within(linhaDo(oficial.nome)).getByTitle("Adicionar à ficha"));

    expect(espiao.current).toHaveLength(1);
    expect(espiao.current[0].id).toBe(oficial.id);
  });

  it("ritual já conhecido não entra de novo — e o botão diz isso", () => {
    const espiao = { current: null };
    render(<CascaRituais espiao={espiao} />);
    abrirBiblioteca();
    fireEvent.change(screen.getByPlaceholderText("Buscar ritual…"), { target: { value: oficial.nome } });
    fireEvent.click(within(linhaDo(oficial.nome)).getByTitle("Adicionar à ficha"));

    // o "+" some e vira o selo de já-está-na-ficha
    expect(within(linhaDo(oficial.nome)).queryByTitle("Adicionar à ficha")).not.toBeInTheDocument();
    expect(within(linhaDo(oficial.nome)).getByTitle("Já está na ficha")).toBeInTheDocument();
    expect(espiao.current).toHaveLength(1);
  });
});
