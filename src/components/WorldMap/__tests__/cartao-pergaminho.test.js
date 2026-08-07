/**
 * Gate do CARTÃO DE PERGAMINHO (spec 0035 · F3 · M5 · AC-12).
 *
 * ── O QUE ESTE ARQUIVO PROTEGE ──────────────────────────────────────────
 * 1. **O contrato de segredo.** O cartão de descoberta só pode mostrar o que
 *    `projecaoDoNo` deixou passar. O teste não confia na inspeção do JSX: ele
 *    entrega ao componente um nó do MOLDE, com todos os `CAMPOS_VENENOSOS`
 *    preenchidos com valores procuráveis, e varre o DOM serializado atrás de
 *    cada um deles. Um `{...no}` esquecido num refactor futuro cai aqui.
 * 2. **O contraste.** ≥4,5:1 do corpo sobre o papel, e ainda ≥4,5:1 com
 *    qualquer das quatro tintas do dia composta por cima. As cores vêm de
 *    `PERGAMINHO` e `TINTA_DO_DIA`, os MESMOS objetos que a tela usa — cópia
 *    de número dentro de um teste é como as duas versões divergem em silêncio.
 * 3. **A casca é uma só.** O painel de encontro passou a montar o mesmo
 *    componente, e o comportamento dele (Esc adia, os três botões, a troca)
 *    continua idêntico.
 *
 * ⚠️ Este projeto NÃO tem `src/setupTests.js`: cada suíte de render importa o
 * `@testing-library/jest-dom` por conta própria.
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import CartaoDePergaminho, {
  CartaoDeDescoberta, FileteDuplo, PERGAMINHO,
} from "../Mesa/CartaoDePergaminho";
import PainelDeEncontro from "../Mesa/PainelDeEncontro";
import { CAMPOS_VENENOSOS, projecaoDoNo } from "../mesaStore";
import { PERIODOS, TINTA_DO_DIA } from "../Mesa/animacaoUi";

/* ── Contraste (WCAG 2.1) ─────────────────────────────────────────────── */
const canal = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminancia = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
function contraste(a, b) {
  const [alto, baixo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (alto + 0.05) / (baixo + 0.05);
}
/** `fg` com alfa `a` composto sobre `bg` opaco. */
const compor = (fg, a, bg) => bg.map((c, i) => Math.round(fg[i] * a + c * (1 - a)));

/** O piso de acessibilidade da casa. */
const PISO = 4.5;

/* ── Um nó do MOLDE, com todo o veneno preenchido ─────────────────────── */
const NO_DO_MOLDE = {
  id: "no-cova",
  name: "Cova do Corta-Sono",
  description: "Uma boca de pedra no fundo da mata. Ninguém entra à noite.",
  type: "dungeon",
  x: 700,
  y: 1330,
  /* Tudo abaixo é do MESTRE, e nada disto pode chegar ao DOM. Os valores são
     procuráveis de propósito: se algum vazar, o teste diz QUAL vazou. */
  gmNotes: "VENENO-gmNotes: o corta-sono dorme na terceira câmara",
  gmText: "VENENO-gmText",
  gmScratch: "VENENO-gmScratch",
  isSecret: true,
  discoveryCheck: { skill: "Percepção", dc: 22 },
  trigger: "on_arrival",
  triggerConfig: { check: { dc: 19 } },
  reveals: ["no-capela"],
  anchor: "VENENO-anchor",
  isRepeatable: true,
  linkedSceneId: "VENENO-linkedSceneId",
  revealRadius: 480,
  dangerLevel: 4,
  isFastTravel: true,
};

describe("AC-12 — o cartão de descoberta não vaza campo de mestre", () => {
  it("mostra name e description da projeção, e nada mais", () => {
    render(<CartaoDeDescoberta no={projecaoDoNo(NO_DO_MOLDE, "discovered")} onFechar={() => {}} />);
    const cartao = screen.getByTestId("wmm-cartao-descoberta");
    expect(cartao).toHaveTextContent("Cova do Corta-Sono");
    expect(cartao).toHaveTextContent("Uma boca de pedra no fundo da mata");
    expect(cartao).toHaveTextContent("Nova localização descoberta");
  });

  it("nenhum nome de CAMPOS_VENENOSOS aparece no DOM serializado", () => {
    const { container } = render(
      <CartaoDeDescoberta no={projecaoDoNo(NO_DO_MOLDE, "discovered")} onFechar={() => {}} />,
    );
    /* O portal vai para `document.body`, não para o `container` — varrer só o
       container daria um verde falso. */
    const dom = `${container.innerHTML}${document.body.innerHTML}`;
    expect(CAMPOS_VENENOSOS.length).toBeGreaterThan(10);
    CAMPOS_VENENOSOS.forEach((campo) => {
      expect(dom).not.toContain(campo);
      expect(dom).not.toContain(`VENENO-${campo}`);
    });
    expect(dom).not.toContain("VENENO");
    expect(dom).not.toContain("terceira câmara");
  });

  it("mesmo recebendo o MOLDE cru por engano, o veneno não chega ao DOM", () => {
    /* A defesa real é a projeção lá em cima, na mesa. Esta asserção trava a
       segunda linha: o componente lê `name`/`description` nominalmente e não
       espalha o objeto — então nem o molde inteiro imprime segredo. */
    const { container } = render(<CartaoDeDescoberta no={NO_DO_MOLDE} onFechar={() => {}} />);
    const dom = `${container.innerHTML}${document.body.innerHTML}`;
    expect(dom).toContain("Cova do Corta-Sono");
    expect(dom).not.toContain("VENENO");
    CAMPOS_VENENOSOS.forEach((campo) => expect(dom).not.toContain(campo));
  });

  it("lugar sem descrição não vira caixa vazia nem inventa texto", () => {
    const projetado = projecaoDoNo({ id: "n1", name: "Marco de Pedra", x: 1, y: 2 }, "discovered");
    render(<CartaoDeDescoberta no={projetado} onFechar={() => {}} />);
    const cartao = screen.getByTestId("wmm-cartao-descoberta");
    expect(cartao).toHaveTextContent("Marco de Pedra");
    expect(cartao).toHaveTextContent("O lugar entra no mapa");
  });

  it("nó sem nome não imprime 'undefined' na carta", () => {
    render(<CartaoDeDescoberta no={{}} onFechar={() => {}} />);
    const cartao = screen.getByTestId("wmm-cartao-descoberta");
    expect(cartao).toHaveTextContent("Um lugar sem nome");
    expect(cartao.innerHTML).not.toContain("undefined");
  });
});

describe("M5 — a casca de pergaminho", () => {
  it("tem chapéu, título em versalete, filete duplo, corpo serifado e UM botão", () => {
    render(
      <CartaoDePergaminho
        chapeu="Chapéu"
        titulo="O Título"
        corpo="O corpo da carta."
        onFechar={() => {}}
      />,
    );
    const cartao = screen.getByTestId("wmm-pergaminho");
    expect(cartao.querySelector('[data-parte="chapeu"]')).toHaveTextContent("Chapéu");

    const titulo = cartao.querySelector('[data-parte="titulo"]');
    expect(titulo).toHaveTextContent("O Título");
    /* Versalete = caixa alta com entreletra aberta. Sem o `uppercase` o título
       vira mais um h2 de app. */
    expect(titulo.style.textTransform).toBe("uppercase");
    expect(parseFloat(titulo.style.letterSpacing)).toBeGreaterThan(0);

    /* O filete é DUPLO: linha grossa, vão, linha fina. */
    const filete = cartao.querySelector('[data-parte="filete"]');
    expect(filete).not.toBeNull();
    expect(filete.children).toHaveLength(3);

    const corpo = cartao.querySelector('[data-parte="corpo"]');
    expect(corpo).toHaveTextContent("O corpo da carta.");
    expect(corpo.style.fontFamily).toMatch(/serif/);

    /* UM botão: o cartão informa, não é tela de decisão. */
    expect(cartao.querySelectorAll("button")).toHaveLength(1);
  });

  it("o filete duplo é decorativo para o leitor de tela", () => {
    const { container } = render(<FileteDuplo />);
    expect(container.firstChild.getAttribute("aria-hidden")).toBe("true");
  });

  it("Esc, clique fora e o botão chamam o MESMO fechar", () => {
    const fechar = jest.fn();
    render(<CartaoDePergaminho titulo="T" onFechar={fechar} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(fechar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("wmm-pergaminho-fechar"));
    expect(fechar).toHaveBeenCalledTimes(2);
  });

  it("ocupado tranca o fechamento — inclusive o Esc", () => {
    const fechar = jest.fn();
    render(<CartaoDePergaminho titulo="T" onFechar={fechar} ocupado />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(fechar).not.toHaveBeenCalled();
    expect(screen.getByTestId("wmm-pergaminho-fechar")).toBeDisabled();
  });

  it("é um diálogo modal, anunciado pelo próprio título", () => {
    render(<CartaoDePergaminho titulo="A Carta" onFechar={() => {}} />);
    const cartao = screen.getByTestId("wmm-pergaminho");
    expect(cartao.getAttribute("role")).toBe("dialog");
    expect(cartao.getAttribute("aria-modal")).toBe("true");
    expect(cartao.getAttribute("aria-label")).toBe("A Carta");
  });

  it("encaminha o interruptor de movimento do palco — AC-8", () => {
    /* O cartão é portal em `document.body`: o `data-anima` do `.wmm-palco`
       não o alcança por descendência, então ele carrega o seu. */
    const { rerender } = render(<CartaoDePergaminho titulo="T" onFechar={() => {}} />);
    expect(screen.getByTestId("wmm-pergaminho").getAttribute("data-anima")).toBe("sim");
    rerender(<CartaoDePergaminho titulo="T" onFechar={() => {}} anima={false} />);
    expect(screen.getByTestId("wmm-pergaminho").getAttribute("data-anima")).toBe("nao");
  });
});

describe("M5 — contraste do texto sobre o pergaminho", () => {
  it("o corpo sobre o papel passa folgado do piso de 4,5:1", () => {
    expect(contraste(PERGAMINHO.tinta, PERGAMINHO.papel)).toBeGreaterThanOrEqual(PISO);
    expect(contraste(PERGAMINHO.tinta, PERGAMINHO.papelBorda)).toBeGreaterThanOrEqual(PISO);
    expect(contraste(PERGAMINHO.titulo, PERGAMINHO.papel)).toBeGreaterThanOrEqual(PISO);
    expect(contraste(PERGAMINHO.titulo, PERGAMINHO.papelBorda)).toBeGreaterThanOrEqual(PISO);
  });

  it("nos QUATRO períodos do dia o papel do cartão NÃO é tingido", () => {
    /* ── POR QUE ESTE TESTE MEDE A ESTRUTURA, E NÃO A COMPOSIÇÃO ────────
       A primeira versão dele compunha cada parada de `TINTA_DO_DIA` sobre o
       pergaminho e exigia 4,5:1. Reprovou — e reprovou por um motivo que
       nenhum ajuste de cor resolve: a tinta da MADRUGADA é escura
       (`rgb(16,26,66)` a 36%), e tinta escura sobre papel claro derruba o
       papel para perto da tinta do texto. Escurecer mais as letras não
       ajuda; o que caiu foi o FUNDO.

       A conta estava errada porque a premissa estava errada. `.wmm-tinta`
       é `position:absolute; inset:0` DENTRO do `.wmm-palco`; o cartão é um
       `createPortal` para `document.body`, `position:fixed`, z-index 430 —
       acima da vinheta (6) e da barra do cartógrafo (7), e fora do palco.
       Nenhum período o alcança, então a única conta que existe de verdade é
       tinta-sobre-papel, medida no teste acima (~13:1).

       O que precisa de gate, então, é a PREMISSA: se alguém um dia mover o
       cartão para dentro do palco, o texto passa a sumir ao anoitecer e
       ninguém descobre até a mesa estar aberta. É isso que se trava aqui. */
    expect(PERIODOS).toHaveLength(4);
    PERIODOS.forEach((periodo) => expect(TINTA_DO_DIA[periodo].paradas.length).toBeGreaterThan(0));

    render(<CartaoDeDescoberta no={{ name: "Vila Candeia" }} onFechar={() => {}} />);
    const cartao = screen.getByTestId("wmm-cartao-descoberta");

    /* Fora do palco: nenhuma camada de tinta é ancestral do cartão. */
    expect(cartao.closest(".wmm-palco")).toBeNull();
    expect(cartao.closest(".wmm-tinta")).toBeNull();

    /* E o véu do cartão é `fixed` em `document.body`, acima de tudo que o
       palco desenha (a vinheta está em 6, a barra do cartógrafo em 7). */
    const veu = cartao.parentElement;
    expect(veu.parentElement).toBe(document.body);
    expect(veu.style.position).toBe("fixed");
    expect(Number(veu.style.zIndex)).toBeGreaterThan(7);
  });

  it("mesmo o pior período não derrubaria o texto se o papel fosse tingido de LUZ", () => {
    /* Manhã e tarde são tintas CLARAS — as únicas que poderiam compor sobre
       o cartão sem escurecer o papel. Sobre elas o piso continua de pé, o
       que mostra que a folga do pergaminho é real e não sorte. */
    ["manhã", "tarde"].forEach((periodo) => {
      TINTA_DO_DIA[periodo].paradas.forEach((parada) => {
        [PERGAMINHO.papel, PERGAMINHO.papelBorda].forEach((papel) => {
          const tingido = compor(parada.cor, parada.alfa, papel);
          expect(contraste(PERGAMINHO.tinta, tingido)).toBeGreaterThanOrEqual(PISO);
          expect(contraste(PERGAMINHO.titulo, tingido)).toBeGreaterThanOrEqual(PISO);
        });
      });
    });
  });
});

describe("M5 — o painel de encontro veste a mesma casca, sem mudar de comportamento", () => {
  const props = {
    titulo: "Lobos na neblina",
    texto: "Três vultos acompanham o grupo a distância.",
    chance: "40%",
    rolagem: "12",
    contexto: "Estrada dos Tropeiros · madrugada",
  };

  it("é o cartão de pergaminho — mesmo diálogo, mesmos testids de sempre", () => {
    render(<PainelDeEncontro {...props} onDecidir={() => {}} onAdiar={() => {}} />);
    const dialogo = screen.getByTestId("wmm-encontro-do-mestre");
    expect(dialogo).toHaveClass("wmm-pergaminho");
    expect(dialogo.getAttribute("role")).toBe("dialog");
    expect(screen.getByTestId("wmm-encontro-rolagem")).toHaveTextContent("40%");
    expect(screen.getByTestId("wmm-encontro-sugestao")).toHaveTextContent("Lobos na neblina");
    ["aceitar", "trocar", "ignorar"].forEach((d) => {
      expect(screen.getByTestId(`wmm-encontro-${d}`)).toBeInTheDocument();
    });
    expect(screen.getByTestId("wmm-encontro-adiar")).toBeInTheDocument();
  });

  it("Esc continua ADIANDO, nunca decidindo", () => {
    const decidir = jest.fn();
    const adiar = jest.fn();
    render(<PainelDeEncontro {...props} onDecidir={decidir} onAdiar={adiar} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(adiar).toHaveBeenCalledTimes(1);
    expect(decidir).not.toHaveBeenCalled();
  });

  it("a troca continua exigindo o texto do jogador antes de publicar", () => {
    const decidir = jest.fn();
    render(<PainelDeEncontro {...props} onDecidir={decidir} onAdiar={() => {}} />);
    fireEvent.click(screen.getByTestId("wmm-encontro-trocar"));
    expect(screen.getByTestId("wmm-encontro-confirmar-troca")).toBeDisabled();
    fireEvent.change(screen.getByTestId("wmm-encontro-texto"), {
      target: { value: "Alguém toca um sino, três vezes." },
    });
    fireEvent.click(screen.getByTestId("wmm-encontro-confirmar-troca"));
    expect(decidir).toHaveBeenCalledWith("trocar", {
      title: "Encontro na estrada",
      playerText: "Alguém toca um sino, três vezes.",
    });
  });

  it("sem sugestão, 'aceitar' fica desabilitado e explicado", () => {
    render(<PainelDeEncontro {...props} semSugestao onDecidir={() => {}} onAdiar={() => {}} />);
    expect(screen.getByTestId("wmm-encontro-aceitar")).toBeDisabled();
    expect(screen.getByTestId("wmm-encontro-trocar")).toBeEnabled();
    expect(screen.getByTestId("wmm-encontro-do-mestre"))
      .toHaveTextContent("não há sugestão para aceitar desta vez");
  });
});
