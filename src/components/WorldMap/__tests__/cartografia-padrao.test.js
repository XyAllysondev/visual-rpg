/**
 * Gate da CARTOGRAFIA PADRÃO EVOLUÍDA (spec 0035 · F2 · M8 · AC-11).
 *
 * O AC-11 tem duas metades, e as duas são mensuráveis:
 *
 *  · **"continua nítida em qualquer escala entre 0,08 e 6"** — porque é VETOR.
 *    Um `<image>` ou um `data:image` no meio da carta desfaz a promessa em
 *    silêncio: no zoom de 6 o pixel aparece, e ninguém percebe até a mesa
 *    estar aberta. Aqui isso vira asserção.
 *  · **"o arquivo não passa de 60 KB"** — medido no FONTE com `fs.statSync`.
 *    A carta mora no bundle (`main.js` já carrega 2,1 MB); ilustração que
 *    engorda sem gate engorda para sempre.
 *
 * E a terceira invariante, herdada do cabeçalho do módulo: **nada de
 * `Math.random()`**. O teste varre o fonte atrás dele em vez de confiar em
 * duas renderizações iguais por sorte — uma chamada de `Math.random()` numa
 * borda rara passaria despercebida por comparação de HTML.
 *
 * ⚠️ Este projeto NÃO tem `src/setupTests.js`: cada suíte de render importa o
 * `@testing-library/jest-dom` por conta própria.
 */
import fs from "fs";
import path from "path";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import CartografiaPadrao from "../model/CartografiaPadrao";
import { MAPA_PADRAO_LARGURA, MAPA_PADRAO_ALTURA } from "../model/mapaPadrao";

const CAMINHO_DO_FONTE = path.join(__dirname, "..", "model", "CartografiaPadrao.jsx");
const FONTE = fs.readFileSync(CAMINHO_DO_FONTE, "utf8");

/* O cabeçalho do módulo PROÍBE `Math.random()` — escrevendo o nome dele. Varrer
   o fonte cru acusaria a própria proibição, então o que se varre é o código
   sem comentário. */
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** O teto do AC-11, em bytes. */
const TETO_BYTES = 60 * 1024;

/** A faixa de zoom que o AC-11 nomeia. */
const ESCALAS = [0.08, 0.25, 1, 2.5, 6];

/* A área onde os doze nós do `mapaPadrao.js` moram (x 300–2130, y 200–1330).
   As anotações têm de ficar FORA dela: dentro, brigariam com os rótulos dos
   lugares, que são informação viva da mesa. */
const MIOLO = { x1: 300, y1: 200, x2: 2130, y2: 1330 };

/** `translate(x y) rotate(g)` → `{x, y}`. */
function posicaoDe(grupo) {
  const t = grupo.getAttribute("transform") || "";
  const m = t.match(/translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
}

/** Os quatro números de um traço reto `M x1 y1 L x2 y2`, ou `null`. */
function retaDe(d) {
  const m = String(d).match(/^M\s(-?[\d.]+)\s(-?[\d.]+)\sL\s(-?[\d.]+)\s(-?[\d.]+)$/);
  return m ? m.slice(1).map(Number) : null;
}

describe("AC-11 — a carta continua vetorial e cabe no bundle", () => {
  it("não passa de 60 KB de fonte", () => {
    const bytes = fs.statSync(CAMINHO_DO_FONTE).size;
    expect(bytes).toBeLessThanOrEqual(TETO_BYTES);
  });

  it("é vetor puro: nenhum raster, nenhum base64, nenhum <image>", () => {
    const { container } = render(<CartografiaPadrao />);
    expect(container.querySelectorAll("image")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/data:image/);
    expect(container.innerHTML).not.toMatch(/\.(png|jpe?g|webp|gif)/i);
  });

  it("a nitidez não depende da escala: o desenho é o MESMO em 0,08 e em 6", () => {
    /* O jsdom não rasteriza, então a pergunta honesta não é "ficou nítido?" e
       sim "o desenho depende da escala?". Se o SVG for o mesmo em toda a
       faixa, o navegador o rasteriza no tamanho pedido — que é a definição
       operacional de nítido, para vetor. */
    const desenhos = ESCALAS.map((escala) => {
      const { container, unmount } = render(
        <div style={{ transform: `scale(${escala})` }}>
          <CartografiaPadrao />
        </div>,
      );
      const svg = container.querySelector("svg");
      const marca = {
        viewBox: svg.getAttribute("viewBox"),
        paths: svg.querySelectorAll("path").length,
        html: svg.innerHTML,
      };
      unmount();
      return marca;
    });

    desenhos.forEach((d) => {
      expect(d.viewBox).toBe(`0 0 ${MAPA_PADRAO_LARGURA} ${MAPA_PADRAO_ALTURA}`);
      expect(d.paths).toBe(desenhos[0].paths);
      expect(d.html).toBe(desenhos[0].html);
    });
  });

  it("o svg escala com o contêiner — sem largura fixa em pixel", () => {
    const { container } = render(<CartografiaPadrao />);
    const svg = container.querySelector("svg");
    /* Largura/altura em px congelariam a carta num tamanho, e o zoom passaria
       a esticar o que o navegador já rasterizou. */
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.getAttribute("height")).toBeNull();
    expect(svg.style.width).toBe("100%");
    expect(svg.style.height).toBe("100%");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });
});

describe("M8 — hachura de terreno", () => {
  it("desenha as três famílias: relevo, mata e água", () => {
    const { container } = render(<CartografiaPadrao />);
    ["hachura-relevo", "hachura-mata", "hachura-agua"].forEach((camada) => {
      const g = container.querySelector(`[data-camada="${camada}"]`);
      expect(g).not.toBeNull();
      expect(g.querySelectorAll("path").length).toBeGreaterThan(8);
    });
  });

  it("a hachura de relevo cai pelo lado da encosta, não em leque aleatório", () => {
    /* Os traços de uma mesma crista apontam todos para o MESMO lado. Se a
       direção fosse sorteada, a hachura viraria textura e pararia de dizer
       para onde o morro desce — que é a única razão de ela existir. */
    const { container } = render(<CartografiaPadrao />);
    const retas = Array.from(
      container.querySelectorAll('[data-camada="hachura-relevo"] path'),
    )
      .map((p) => retaDe(p.getAttribute("d")))
      .filter(Boolean);

    expect(retas.length).toBeGreaterThan(40);

    /* A crista da saia da serra (x 168–402, y ~500) desce: o y de destino é
       sempre maior que o de origem. */
    const daSaia = retas.filter(([x1, y1]) => x1 >= 160 && x1 <= 410 && y1 > 480 && y1 < 530);
    expect(daSaia.length).toBeGreaterThan(4);
    daSaia.forEach(([, y1, , y2]) => expect(y2).toBeGreaterThan(y1));

    /* A crista do alto da serra (x 214–388, y ~200) sobe: lado oposto. */
    const doAlto = retas.filter(([x1, y1]) => x1 >= 200 && x1 <= 400 && y1 > 160 && y1 < 250);
    expect(doAlto.length).toBeGreaterThan(4);
    doAlto.forEach(([, y1, , y2]) => expect(y2).toBeLessThan(y1));
  });

  it("a hachura de água é horizontal — é assim que o olho lê lâmina parada", () => {
    const { container } = render(<CartografiaPadrao />);
    const traços = Array.from(
      container.querySelectorAll('[data-camada="hachura-agua"] path'),
    ).map((p) => p.getAttribute("d"));
    expect(traços.length).toBeGreaterThan(8);
    /* `H` é o comando de linha horizontal: nenhuma fiada da lâmina inclina. */
    traços.forEach((d) => expect(d).toMatch(/^M\s-?[\d.]+\s-?[\d.]+\sH\s-?[\d.]+$/));
  });

  it("a trama de pena é <pattern> vetorial, não bitmap de textura", () => {
    const { container } = render(<CartografiaPadrao />);
    const trama = container.querySelector("#cartografia-padrao-trama");
    expect(trama).not.toBeNull();
    expect(trama.tagName.toLowerCase()).toBe("pattern");
    expect(trama.querySelectorAll("image")).toHaveLength(0);
  });
});

describe("M8 — rosa dos ventos em traço de tinta", () => {
  it("existe, e é desenhada a traço: cada ponta tem contorno próprio", () => {
    const { container } = render(<CartografiaPadrao />);
    const rosa = container.querySelector('[data-camada="rosa-dos-ventos"]');
    expect(rosa).not.toBeNull();
    /* Oito pontas × 2 contornos (a metade em tinta e a metade na trama), mais
       o contorno do norte. Chapada, a rosa antiga tinha dois. */
    const contornados = Array.from(rosa.querySelectorAll("path")).filter(
      (p) => p.getAttribute("stroke") && p.getAttribute("fill") === "none",
    );
    expect(contornados.length).toBeGreaterThanOrEqual(16);
  });

  it("tem o anel de 32 rumos, com uma marca longa a cada quatro", () => {
    const { container } = render(<CartografiaPadrao />);
    const rosa = container.querySelector('[data-camada="rosa-dos-ventos"]');
    /* As marcas são retas puras; as pipas e o norte são polígonos com Z. */
    const comprimentos = Array.from(rosa.querySelectorAll("path"))
      .map((p) => retaDe(p.getAttribute("d")))
      .filter(Boolean)
      .map(([x1, y1, x2, y2]) => Math.round(Math.hypot(x2 - x1, y2 - y1)));

    expect(comprimentos).toHaveLength(32);
    const maior = Math.max(...comprimentos);
    expect(comprimentos.filter((c) => c === maior)).toHaveLength(8);
  });

  it("marca os quatro ventos em português — L de Leste, não E de East", () => {
    const { container } = render(<CartografiaPadrao />);
    const rosa = container.querySelector('[data-camada="rosa-dos-ventos"]');
    const letras = Array.from(rosa.querySelectorAll("text")).map((t) => t.textContent);
    expect(letras).toEqual(["N", "L", "S", "O"]);
  });
});

describe("M8 — anotações manuscritas nas margens", () => {
  it("são cursivas, e não texto de interface disfarçado", () => {
    const { container } = render(<CartografiaPadrao />);
    const notas = container.querySelectorAll('[data-anotacao="margem"]');
    expect(notas.length).toBeGreaterThanOrEqual(4);
    notas.forEach((n) => {
      expect(n.getAttribute("font-family")).toMatch(/cursive/);
      expect(n.getAttribute("font-style")).toBe("italic");
      expect(n.textContent.trim().length).toBeGreaterThan(8);
    });
  });

  it("ficam na MARGEM — nenhuma cai sobre a área onde os nós moram", () => {
    /* Anotação em cima do miolo brigaria com o rótulo dos lugares, que é
       informação viva da mesa. A margem é o único pedaço de papel livre. */
    const { container } = render(<CartografiaPadrao />);
    const grupos = Array.from(
      container.querySelectorAll('[data-camada="anotacoes"] > g'),
    );
    expect(grupos.length).toBeGreaterThanOrEqual(4);
    grupos.forEach((g) => {
      const p = posicaoDe(g);
      expect(p).not.toBeNull();
      const dentroDoMiolo =
        p.x > MIOLO.x1 && p.x < MIOLO.x2 && p.y > MIOLO.y1 && p.y < MIOLO.y2;
      expect(dentroDoMiolo).toBe(false);
      /* E dentro do papel: fora do viewBox nada seria visto. */
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(MAPA_PADRAO_LARGURA);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(MAPA_PADRAO_ALTURA);
    });
  });

  it("o rótulo acessível conta o que foi acrescentado", () => {
    const { container } = render(<CartografiaPadrao />);
    const rotulo = container.querySelector("svg").getAttribute("aria-label");
    /* O leitor de tela lê o aria-label do <svg>, nunca as anotações soltas —
       elas são desenho. Então o que elas dizem precisa caber no rótulo. */
    expect(rotulo).toMatch(/hachurad/i);
    expect(rotulo).toMatch(/rosa dos ventos/i);
    expect(rotulo).toMatch(/anota/i);
    expect(rotulo).toMatch(/Coroa de Cinzas/);
  });
});

describe("determinismo — a carta é sempre a mesma carta", () => {
  it("não existe Math.random() no código", () => {
    expect(CODIGO).not.toMatch(/Math\.random/);
    /* E a proibição continua escrita no cabeçalho, para quem vier depois. */
    expect(FONTE).toMatch(/Math\.random/);
  });

  it("duas renderizações produzem exatamente o mesmo desenho", () => {
    const a = render(<CartografiaPadrao />).container.innerHTML;
    const b = render(<CartografiaPadrao />).container.innerHTML;
    expect(a).toBe(b);
  });

  it("o único movimento continua sendo a maré, atrás de prefers-reduced-motion", () => {
    const { container } = render(<CartografiaPadrao />);
    const css = container.querySelector("style").textContent;
    /* Uma `animation` a mais aqui escaparia do guarda de movimento reduzido —
       e o AC-8 manda cortar TODO movimento novo. */
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
    expect(css.match(/animation:/g) || []).toHaveLength(1);
    expect(css).toMatch(/mare/);
  });

  it("idPrefix isola a trama nova junto com o resto dos <defs>", () => {
    const { container } = render(<CartografiaPadrao idPrefix="miniatura" />);
    expect(container.querySelector("#miniatura-trama")).not.toBeNull();
    expect(container.querySelector("#cartografia-padrao-trama")).toBeNull();
  });
});
