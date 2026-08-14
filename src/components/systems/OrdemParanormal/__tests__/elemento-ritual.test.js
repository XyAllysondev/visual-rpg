/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — GATE DO RITUAL DE AFINIDADE
 *  ------------------------------------------------------------------------
 *  O defeito que originou este arquivo: os cinco elementos compartilhavam a
 *  mesma transição (um scale-up do símbolo), então escolher Sangue ou
 *  Conhecimento produzia exatamente a mesma cena. Os testes aqui falham
 *  naquela versão e passam nesta.
 *
 *    1. Cada elemento monta uma coreografia própria, não uma compartilhada.
 *    2. As cores da cena vêm do tema do elemento escolhido.
 *    3. A ficha agenda a persistência pela duração do ritual — animação e
 *       commit não podem divergir (era um 1500 solto na ficha).
 * ════════════════════════════════════════════════════════════════════════ */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import fs from "fs";
import path from "path";
import ElementoRitual, { RITUAL_MS } from "../ElementoRitual";
import { ELEMENTOS } from "../elementos";

const cena = (container) => container.querySelector(".op-ritual");

/** Classes de coreografia presentes na cena, ignorando o invólucro comum. */
const coreografia = (container) => {
  const prefixos = ["op-sg-", "op-mt-", "op-cn-", "op-en-", "op-md-"];
  const achadas = new Set();
  container.querySelectorAll("*").forEach((el) => {
    // SVGElement.className não é string — className.baseVal é.
    const cls = typeof el.className === "string" ? el.className : el.className?.baseVal || "";
    cls.split(/\s+/).forEach((c) => {
      if (prefixos.some((p) => c.startsWith(p))) achadas.add(c);
    });
  });
  return achadas;
};

describe("Ritual de afinidade — coreografia por elemento", () => {
  it("dá a cada elemento uma coreografia própria, sem reaproveitar a do vizinho", () => {
    const porElemento = Object.keys(ELEMENTOS).map((id) => {
      const { container, unmount } = render(<ElementoRitual id={id} />);
      const classes = coreografia(container);
      unmount();
      return { id, classes };
    });

    porElemento.forEach(({ id, classes }) => {
      expect({ id, temCoreografia: classes.size > 0 }).toEqual({ id, temCoreografia: true });
    });

    // Nenhuma classe de coreografia é compartilhada entre dois elementos —
    // é exatamente isto que a transição antiga violava.
    for (let i = 0; i < porElemento.length; i++) {
      for (let j = i + 1; j < porElemento.length; j++) {
        const par = `${porElemento[i].id}×${porElemento[j].id}`;
        const comuns = [...porElemento[i].classes].filter((c) => porElemento[j].classes.has(c));
        expect({ par, comuns }).toEqual({ par, comuns: [] });
      }
    }
  });

  it("pinta a cena com as cores do elemento escolhido", () => {
    Object.values(ELEMENTOS).forEach((el) => {
      const { container, unmount } = render(<ElementoRitual id={el.id} />);
      const style = cena(container).getAttribute("style") || "";
      expect({ id: el.id, accent: style.includes(el.accent), primary: style.includes(el.primary) })
        .toEqual({ id: el.id, accent: true, primary: true });
      unmount();
    });
  });

  it("anuncia o elemento para leitor de tela em vez de ser puro enfeite", () => {
    const { container } = render(<ElementoRitual id="sangue" />);
    const el = cena(container);
    expect(el).toHaveAttribute("role", "status");
    expect(el.getAttribute("aria-label")).toContain("Sangue");
  });

  it("chama onDone exatamente ao fim do ritual", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    render(<ElementoRitual id="energia" onDone={onDone} />);

    jest.advanceTimersByTime(RITUAL_MS - 1);
    expect(onDone).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("não dispara onDone depois de desmontado", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    const { unmount } = render(<ElementoRitual id="morte" onDone={onDone} />);
    unmount();
    jest.advanceTimersByTime(RITUAL_MS * 2);
    expect(onDone).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("faz a ficha agendar o commit pela duração do ritual, não por um número solto", () => {
    const ficha = fs.readFileSync(path.join(__dirname, "..", "OrdemParanormalSheet.jsx"), "utf8");
    expect(ficha).toMatch(/setTimeout\([\s\S]{0,400}?\}, RITUAL_MS\)/);
  });
});
