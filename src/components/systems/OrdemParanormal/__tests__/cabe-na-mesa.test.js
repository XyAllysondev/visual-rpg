/* Spec 0038 — "A ficha que cabe na mesa".
 *
 * Três coisas: o jogador esconde as perícias que não usa, a mesa desliga a
 * Sanidade de verdade, e a criação de personagem termina numa assinatura.
 *
 * O corte que esta suíte também trava: das QUATRO regras opcionais da referência,
 * só uma entra. Ver o AC-7 — interruptor que não faz nada é a promessa falsa que
 * a spec 0036 foi escrita para matar.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrdemParanormalSheet from "../OrdemParanormalSheet";
import { assinaturaDe } from "../../../../domain/character";
import CharacterCreator from "../../../../features/ficha/CharacterCreator";

beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
});

const fichaBase = {
  id: "t38",
  form: { personagem: "Agente de Teste" },
  attrs: { AGI: 3, FOR: 1, INT: 1, PRE: 1, VIG: 1 },
  classe: { id: "combatente", name: "Combatente" },
  nex: 5,
  skillTreino: {},
  skillOutros: {},
};

const renderFicha = (extra = {}, props = {}) =>
  render(
    <OrdemParanormalSheet
      character={{ ...fichaBase, ...extra }}
      onBack={() => {}} onUpdate={() => {}} onRoll={() => {}}
      {...props}
    />,
  );

/* Sem provider de i18n, `t("op.pericias.X")` devolve a própria chave — convenção
 * das suítes de OP deste repo. Os matchers ancoram no que não depende de
 * tradução (ver o mesmo comentário em `mostrar-a-conta.test.js`). */
const OCULTAR = (base) => new RegExp(`^Ocultar .*${base}$`);
const REEXIBIR = (base) => new RegExp(`^Reexibir .*${base}$`);
const GRAU = (base, grau) => new RegExp(`${base}: ${grau}$`);

/* ════════════════════════════════════════════════════════════════════════
 *  A1 · OCULTAR PERÍCIA
 * ════════════════════════════════════════════════════════════════════════ */

describe("Ocultar perícia (AC-1)", () => {
  it("o controle de ocultar só existe em Modo de Edição", () => {
    renderFicha();
    expect(screen.queryByLabelText(OCULTAR("Acrobacia"))).not.toBeInTheDocument();
  });

  it("em edição o controle aparece e a perícia sai da lista", () => {
    renderFicha({}, { defaultEditMode: true });
    fireEvent.click(screen.getByLabelText(OCULTAR("Acrobacia")));
    expect(screen.queryByLabelText(GRAU("Acrobacia", "Destreinado"))).not.toBeInTheDocument();
  });

  it("ficha que já vem com perícia oculta abre sem ela na lista", () => {
    renderFicha({ periciasOcultas: ["Acrobacia"] });
    expect(screen.queryByLabelText(GRAU("Acrobacia", "Destreinado"))).not.toBeInTheDocument();
  });

  it("perícia já oculta oferece reexibir, não ocultar de novo", () => {
    renderFicha({ periciasOcultas: ["Acrobacia"] }, { defaultEditMode: true });
    expect(screen.queryByLabelText(OCULTAR("Acrobacia"))).not.toBeInTheDocument();
  });
});

describe("Nada é escondido sem deixar rastro (AC-2)", () => {
  it("a faixa diz quantas estão ocultas", () => {
    renderFicha({ periciasOcultas: ["Acrobacia", "Adestramento"] });
    expect(screen.getByText("2 perícias ocultas")).toBeInTheDocument();
  });

  it("uma oculta usa o singular", () => {
    renderFicha({ periciasOcultas: ["Acrobacia"] });
    expect(screen.getByText("1 perícia oculta")).toBeInTheDocument();
  });

  it("sem nada oculto a faixa não aparece", () => {
    renderFicha();
    expect(screen.queryByText(/perícia[s]? oculta/)).not.toBeInTheDocument();
  });

  /* O ponto do AC-2: ocultar pede ficha destravada, DESCOBRIR não pode pedir
   * nada. Quem abre a ficha de outra pessoa precisa ver que a lista está
   * incompleta sem ter permissão de editar. */
  it("o caminho de volta existe em Modo de JOGO", () => {
    renderFicha({ periciasOcultas: ["Acrobacia"] });
    fireEvent.click(screen.getByText("mostrar"));
    expect(screen.getByLabelText(REEXIBIR("Acrobacia"))).toBeInTheDocument();
  });

  it("reexibir devolve a perícia para a lista", () => {
    renderFicha({ periciasOcultas: ["Acrobacia"] });
    fireEvent.click(screen.getByText("mostrar"));
    fireEvent.click(screen.getByLabelText(REEXIBIR("Acrobacia")));
    expect(screen.getByLabelText(GRAU("Acrobacia", "Destreinado"))).toBeInTheDocument();
    expect(screen.queryByText(/perícia[s]? oculta/)).not.toBeInTheDocument();
  });
});

describe("Ocultar é exibição, não exclusão (AC-3)", () => {
  it("treino e outros sobrevivem ao ocultar e reexibir", () => {
    renderFicha({ periciasOcultas: ["Acrobacia"], skillTreino: { Acrobacia: 10 }, skillOutros: { Acrobacia: 2 } });
    fireEvent.click(screen.getByText("mostrar"));
    fireEvent.click(screen.getByLabelText(REEXIBIR("Acrobacia")));
    expect(screen.getByLabelText(GRAU("Acrobacia", "Veterano"))).toBeInTheDocument();
    expect(screen.getByLabelText(/^Outros .*Acrobacia$/)).toHaveValue(2);
  });

  /* Reflexos alimenta a Esquiva (10 + AGI + Reflexos). Se ocultar mexesse na
   * conta, esconder uma linha mudaria um número de combate — o defeito mais
   * caro que esta feature poderia introduzir. */
  it("ocultar Reflexos não mexe na Esquiva", () => {
    renderFicha({ skillTreino: { Reflexos: 5 }, periciasOcultas: ["Reflexos"] });
    expect(screen.getAllByText("18").length).toBeGreaterThan(0); // 10 + AGI 3 + Ref 5
  });
});

describe("O filtro fura o oculto (AC-4)", () => {
  it("procurar pelo nome acha a perícia oculta, marcada como oculta", () => {
    renderFicha({ periciasOcultas: ["Acrobacia"] });
    // `/filt/i` casa com a chave crua ("…skills.filter"), com "filtrar" e com "filter".
    fireEvent.change(screen.getByPlaceholderText(/filt/i), { target: { value: "Acrobacia" } });
    expect(screen.getByLabelText(REEXIBIR("Acrobacia"))).toBeInTheDocument();
    expect(screen.getAllByText("oculta").length).toBeGreaterThan(0);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  A3 · JOGANDO SEM SANIDADE
 * ════════════════════════════════════════════════════════════════════════ */

describe("Jogando sem Sanidade (AC-5)", () => {
  it("com a regra desligada o sinal vital está lá", () => {
    renderFicha();
    expect(screen.getByText("Determinação · SAN")).toBeInTheDocument();
  });

  it("com a regra ligada o sinal vital sai da tela", () => {
    renderFicha({ regrasOpcionais: { semSanidade: true } });
    expect(screen.queryByText("Determinação · SAN")).not.toBeInTheDocument();
  });

  /* Os cinco efeitos de `breach` desarmam na RAIZ (`breach` já nasce falso), e é
   * por isso que basta checar três deles: se `breach` vazasse, vazaria em todos. */
  it("mesmo com Sanidade em zero, nada de surto", () => {
    const { container } = renderFicha({ regrasOpcionais: { semSanidade: true }, san: 0, sanMax: 12 });
    expect(container.querySelector(".op-breach")).toBeNull();
    expect(screen.queryByText("SURTO")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ouvir o Outro Lado/)).not.toBeInTheDocument();
  });

  it("sem a regra e com Sanidade em zero, o surto acontece", () => {
    const { container } = renderFicha({ san: 0, sanMax: 12 });
    expect(container.querySelector(".op-breach")).not.toBeNull();
    expect(screen.getByText(/Ouvir o Outro Lado/)).toBeInTheDocument();
  });
});

describe("A regra é reversível e não destrói o número (AC-6)", () => {
  it("desligar a regra devolve o sinal vital", () => {
    renderFicha({ regrasOpcionais: { semSanidade: true }, san: 3, sanMax: 12 });
    fireEvent.click(screen.getByLabelText("Configurações"));
    fireEvent.click(screen.getByText("USANDO"));
    expect(screen.getByText("Determinação · SAN")).toBeInTheDocument();
  });
});

/* AC-7: o corte declarado na spec, travado por teste. Se alguém adicionar os
 * outros três interruptores sem a spec que os implemente, isto reprova. */
describe("Só a regra opcional que funciona aparece (AC-7)", () => {
  it("Jogando sem Sanidade está nas Configurações", () => {
    renderFicha();
    fireEvent.click(screen.getByLabelText("Configurações"));
    expect(screen.getByText("Jogando sem Sanidade")).toBeInTheDocument();
  });

  it("não existe interruptor para as três regras que não fazem nada", () => {
    renderFicha();
    fireEvent.click(screen.getByLabelText("Configurações"));
    expect(screen.queryByText(/Contagem de Munição/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NEX & Experiência/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Evolução por Patente/i)).not.toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  A2 · ASSINATURA
 * ════════════════════════════════════════════════════════════════════════ */

describe("assinaturaDe — a assinatura não inventa nome (AC-9)", () => {
  it("um nome só fica inteiro", () => {
    expect(assinaturaDe("Kael")).toBe("Kael");
  });

  it("sobrenomes viram iniciais", () => {
    expect(assinaturaDe("Kael Nightingale")).toBe("Kael N.");
    expect(assinaturaDe("Kael Souza Nightingale")).toBe("Kael S. N.");
  });

  it("partícula de ligação não vira inicial", () => {
    expect(assinaturaDe("Kael de Souza Nightingale")).toBe("Kael S. N.");
    expect(assinaturaDe("Maria da Silva e Costa")).toBe("Maria S. C.");
  });

  it("sem nome não há assinatura", () => {
    expect(assinaturaDe("")).toBe("");
    expect(assinaturaDe("   ")).toBe("");
    expect(assinaturaDe(null)).toBe("");
    expect(assinaturaDe(undefined)).toBe("");
  });

  it("espaço repetido não produz inicial vazia", () => {
    expect(assinaturaDe("Kael    Nightingale")).toBe("Kael N.");
  });
});

describe("A criação termina numa assinatura (AC-8)", () => {
  it("o botão comum de finalizar não existe mais — um caminho só", () => {
    render(<CharacterCreator onFinish={jest.fn()} onCancel={() => {}} />);
    expect(screen.queryByText("Finalizar Ficha")).not.toBeInTheDocument();
  });
});
