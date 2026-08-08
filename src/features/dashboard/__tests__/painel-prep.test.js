/* ════════════════════════════════════════════════════════════════════
 *  PAINEL — CHECKLIST "PREPARO DO MUNDO"
 *  --------------------------------------------------------------------
 *  Contrato: rasura o que está feito, só oferece `→` no que dá para fazer,
 *  e SOME quando os quatro passos terminam. Painel que ainda ensina o
 *  básico ao usuário de seis meses envelheceu mal.
 * ════════════════════════════════════════════════════════════════════ */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import PrepChecklist, { CHAVE_PREP_DONE } from "../PrepChecklist";

const PASSOS = [
  { id: "mundo",    label: "Crie seu mundo na Forja", done: true,  nav: "master" },
  { id: "mapa",     label: "Desenhe um mapa",         done: false, nav: "map" },
  { id: "campanha", label: "Abra uma campanha",       done: false, nav: "party" },
  { id: "ficha",    label: "Crie uma ficha",          done: false, nav: "sheet" },
];

beforeEach(() => localStorage.clear());

describe("<PrepChecklist/>", () => {
  it("mostra o progresso em texto, sem barra", () => {
    const { container } = render(<PrepChecklist passos={PASSOS} />);
    expect(screen.getByText("1/4")).toBeInTheDocument();
    expect(container.querySelector("progress")).toBeNull();
  });

  it("rasura o passo feito e não o torna clicável", () => {
    render(<PrepChecklist passos={PASSOS} />);
    const feito = screen.getByText("Crie seu mundo na Forja");
    expect(feito).toHaveStyle("text-decoration: line-through");
    /* 3 pendentes clicáveis; o feito é <li>, não <button> */
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("navega ao clicar num passo pendente", () => {
    const onNav = jest.fn();
    render(<PrepChecklist passos={PASSOS} onNav={onNav} />);
    fireEvent.click(screen.getByText("Desenhe um mapa").closest("button"));
    expect(onNav).toHaveBeenCalledWith("map");
  });

  it("some quando os quatro estão feitos, e marca para não voltar", () => {
    const todos = PASSOS.map(p => ({ ...p, done: true }));
    const { container } = render(<PrepChecklist passos={todos} />);
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem(CHAVE_PREP_DONE)).toBe("1");
  });

  it("some quando o hook já diz que foi concluído", () => {
    const { container } = render(<PrepChecklist passos={PASSOS} concluido />);
    expect(container).toBeEmptyDOMElement();
  });
});
