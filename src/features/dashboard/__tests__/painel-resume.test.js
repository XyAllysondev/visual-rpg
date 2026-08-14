/* ════════════════════════════════════════════════════════════════════
 *  PAINEL — FAIXA "RETOMAR"
 *  --------------------------------------------------------------------
 *  Contrato: uma linha, e ela só aparece se o alvo ainda existe. Levar o
 *  usuário a uma campanha apagada é pior que não oferecer atalho nenhum.
 * ════════════════════════════════════════════════════════════════════ */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ResumeBar from "../ResumeBar";

const CAMPS = [{ id: "c1", name: "Coroa de Cinzas" }];

describe("<ResumeBar/>", () => {
  it("não renderiza sem alvo", () => {
    const { container } = render(<ResumeBar alvo={null} campaigns={CAMPS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza quando a campanha do alvo sumiu", () => {
    const { container } = render(
      <ResumeBar alvo={{ kind: "campanha", id: "sumida", label: "Sumida", at: Date.now() }} campaigns={CAMPS} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra rótulo, tipo e tempo relativo, e abre a campanha", () => {
    const onOpenCampaign = jest.fn();
    render(
      <ResumeBar
        alvo={{ kind: "campanha", id: "c1", label: "Coroa de Cinzas", at: Date.now() - 2 * 3600 * 1000 }}
        campaigns={CAMPS}
        onOpenCampaign={onOpenCampaign}
      />
    );
    expect(screen.getByText(/Coroa de Cinzas/)).toBeInTheDocument();
    /* `tempoRelativo` é o de `MasterSuite/ui/tokens` — não uma segunda cópia */
    expect(screen.getByText(/campanha · há 2 h/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpenCampaign).toHaveBeenCalledWith(CAMPS[0]);
  });

  it("mapa e mundo navegam sem depender de validação de campanha", () => {
    const onNav = jest.fn();
    render(<ResumeBar alvo={{ kind: "mapa", id: "editor", label: "Editor de Mapas", at: Date.now() }}
      campaigns={[]} onNav={onNav} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onNav).toHaveBeenCalledWith("map");
  });
});
