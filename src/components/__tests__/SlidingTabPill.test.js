import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import SlidingTabPill from "../SlidingTabPill";

const PILL = { left: 70, top: 0, width: 96, height: 40, visible: true };
const el = (container) => container.querySelector(".nx-tab-pill");

describe("SlidingTabPill", () => {
  it("não renderiza nada sem geometria", () => {
    const { container } = render(<SlidingTabPill pill={null} />);
    expect(el(container)).toBeNull();
  });

  it("posiciona e dimensiona pela geometria recebida", () => {
    const { container } = render(<SlidingTabPill pill={PILL} />);
    expect(el(container)).toHaveStyle({
      transform: "translate(70px, 0px)",
      width: "96px",
      height: "40px",
      opacity: "1",
    });
  });

  it("fica invisível sem perder a posição quando `visible` é false", () => {
    const { container } = render(<SlidingTabPill pill={{ ...PILL, visible: false }} />);
    expect(el(container)).toHaveStyle({ opacity: "0", transform: "translate(70px, 0px)" });
  });

  it("é decoração pura — fora da árvore de acessibilidade (AC-4)", () => {
    const { container } = render(<SlidingTabPill pill={PILL} />);
    expect(el(container)).toHaveAttribute("aria-hidden", "true");
  });

  it("desenha sublinhado e linha de topo só quando pedidos", () => {
    const { container: semExtras } = render(<SlidingTabPill pill={PILL} />);
    expect(el(semExtras).children).toHaveLength(0);

    const { container } = render(
      <SlidingTabPill pill={PILL} underline="#c9a84c" underlineSize={3} topLine="linear-gradient(90deg,#000,#fff)" />
    );
    expect(el(container).children).toHaveLength(2);
    expect(el(container).children[1]).toHaveStyle({ height: "3px", background: "#c9a84c" });
  });

  it("anima só transform/opacity (0017 AC-1)", () => {
    const { container } = render(<SlidingTabPill pill={PILL} />);
    const transition = el(container).style.transition;
    expect(transition).toMatch(/transform/);
    expect(transition).toMatch(/opacity/);
    expect(transition).not.toMatch(/width|height|box-shadow|background/);
  });
});
