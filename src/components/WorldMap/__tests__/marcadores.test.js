/**
 * Gate das RUNAS e da BARRA DO CARTÓGRAFO (spec 0035 · F2 · M3, M4).
 *
 * Duas invariantes valem mais que o resto aqui:
 *
 *  1. **O ícone escolhido pelo mestre continua mandando.** A runa é o padrão
 *     de cada tipo, não uma substituição do que o usuário decidiu.
 *  2. **O nó `rumored` não ganha runa.** Rumor não tem ícone concreto — se
 *     ganhasse, o desenho entregaria o tipo do lugar que o jogador não deveria
 *     conhecer. É o AC-1 da spec 0028 e o AC-6 da 0035.
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import RunaDoLugar, { TIPOS_COM_RUNA, tipoDaRuna } from "../model/marcadores";
import BarraDoCartografo, { anguloDoAstro } from "../Mesa/BarraDoCartografo";
import { iconeDoNo, ICONES_POR_TIPO } from "../Editor/TelaDoMapa";

describe("RunaDoLugar", () => {
  it("desenha uma runa para cada um dos seis tipos", () => {
    expect(TIPOS_COM_RUNA).toHaveLength(6);
    TIPOS_COM_RUNA.forEach((tipo) => {
      const { container, unmount } = render(<RunaDoLugar tipo={tipo} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg.getAttribute("data-runa")).toBe(tipo);
      // traço, não preenchimento — é o dialeto da casa
      expect(svg.getAttribute("fill")).toBe("none");
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      expect(svg.querySelectorAll("path, circle").length).toBeGreaterThan(0);
      unmount();
    });
  });

  it("tipo desconhecido cai no marco, nunca em disco vazio", () => {
    const { container } = render(<RunaDoLugar tipo="tipo-que-nao-existe" />);
    expect(container.querySelector("svg").getAttribute("data-runa")).toBe("poi");
    expect(tipoDaRuna(undefined)).toBe("poi");
    expect(tipoDaRuna("town")).toBe("town");
  });

  it("é decorativa para o leitor de tela — quem fala é o aria-label do botão", () => {
    const { container } = render(<RunaDoLugar tipo="town" />);
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
  });

  it("respeita o tamanho pedido — a contra-escala do nó depende disso", () => {
    const { container } = render(<RunaDoLugar tipo="camp" size={24} />);
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
  });
});

describe("a tabela de emoji do mestre continua intacta", () => {
  it("iconeDoNo segue sendo o que o mestre escolheu, e o emoji segue o padrão", () => {
    // A runa NÃO substituiu esta função: ela decide o ícone PRÓPRIO, e é o
    // contrato que `editor-modelo.test.js` trava desde a spec 0028.
    expect(iconeDoNo({ type: "town", icon: "🐐" })).toBe("🐐");
    expect(iconeDoNo({ type: "town" })).toBe(ICONES_POR_TIPO.town);
  });
});

describe("anguloDoAstro", () => {
  it("meia-noite embaixo, meio-dia em cima", () => {
    expect(anguloDoAstro({ dia: 1, hora: 0, minuto: 0 })).toBe(180);
    expect(anguloDoAstro({ dia: 1, hora: 12, minuto: 0 })).toBe(0);
  });

  it("aceita o relógio como número de horas corridas", () => {
    expect(anguloDoAstro(12)).toBe(0);
    expect(anguloDoAstro(36)).toBe(0); // 36 h = meio-dia do segundo dia
  });

  it("os minutos entram na conta", () => {
    expect(anguloDoAstro({ hora: 6, minuto: 30 })).toBeCloseTo(277.5, 6);
  });

  it("nunca sai de [0,360) nem devolve NaN", () => {
    [null, undefined, {}, "x", NaN, -5, 1e6].forEach((v) => {
      const a = anguloDoAstro(v);
      expect(Number.isFinite(a)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(360);
    });
  });
});

describe("BarraDoCartografo", () => {
  it("mostra onde o grupo está", () => {
    render(<BarraDoCartografo ondeEsta="Guarnição Cinzenta" relogio={{ dia: 3, hora: 14, minuto: 5 }} />);
    expect(screen.getByTestId("wmm-cartografo-lugar")).toHaveTextContent("Guarnição Cinzenta");
  });

  it("em viagem, o lugar dá lugar ao estado", () => {
    render(<BarraDoCartografo ondeEsta="Guarnição Cinzenta" viajando relogio={{ dia: 1, hora: 8 }} />);
    expect(screen.getByTestId("wmm-cartografo-lugar")).toHaveTextContent("Viagem em grupo");
  });

  it("o relógio é contador de DIAS, não data de calendário", () => {
    render(<BarraDoCartografo ondeEsta="X" relogio={{ dia: 3, hora: 14, minuto: 5 }} />);
    expect(screen.getByTestId("wmm-cartografo-hora")).toHaveTextContent("Dia 3 · 14:05");
  });

  it("SEM relógio esconde o mostrador e a hora — não inventa data (ADR-0011)", () => {
    render(<BarraDoCartografo ondeEsta="Guarnição Cinzenta" relogio={null} />);
    expect(screen.getByTestId("wmm-cartografo-lugar")).toBeInTheDocument();
    expect(screen.queryByTestId("wmm-mostrador")).toBeNull();
    expect(screen.queryByTestId("wmm-cartografo-hora")).toBeNull();
  });

  it("de dia é o sol que gira; de noite, a lua", () => {
    const { unmount } = render(<BarraDoCartografo relogio={{ dia: 1, hora: 14 }} />);
    expect(screen.getByTestId("wmm-mostrador")).toHaveAttribute("data-astro", "sol");
    unmount();

    render(<BarraDoCartografo relogio={{ dia: 1, hora: 23 }} />);
    expect(screen.getByTestId("wmm-mostrador")).toHaveAttribute("data-astro", "lua");
  });

  it("a madrugada também é noturna", () => {
    render(<BarraDoCartografo relogio={{ dia: 1, hora: 3 }} />);
    expect(screen.getByTestId("wmm-mostrador")).toHaveAttribute("data-astro", "lua");
    expect(screen.getByTestId("wmm-cartografo")).toHaveAttribute("data-periodo", "madrugada");
  });

  it("o giro do astro é `transform`, e o portão de movimento desliga a transição", () => {
    const { container, unmount } = render(<BarraDoCartografo relogio={{ dia: 1, hora: 12 }} anima={false} />);
    const astro = container.querySelector(".wmm-astro");
    expect(astro).toHaveAttribute("data-anima", "nao");
    expect(astro).toHaveStyle({ transform: "rotate(0deg)" });
    unmount();

    const outro = render(<BarraDoCartografo relogio={{ dia: 1, hora: 12 }} anima />);
    expect(outro.container.querySelector(".wmm-astro")).toHaveAttribute("data-anima", "sim");
  });

  it("sem lugar nenhum, não fica em branco", () => {
    render(<BarraDoCartografo />);
    expect(screen.getByTestId("wmm-cartografo-lugar")).toHaveTextContent("Lugar desconhecido");
  });
});
