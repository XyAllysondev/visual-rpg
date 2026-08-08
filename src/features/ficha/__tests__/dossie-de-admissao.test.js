/* Spec 0039 — "O dossiê de admissão".
 *
 * A criação de agente passa a se ler como um documento emitido pela Ordo
 * Realitas — na linguagem visual que o Nexus JÁ TEM. Decisão do Andre: adaptar,
 * não copiar o acabamento da referência.
 *
 * Um destes testes existe por causa de um defeito meu: a spec 0038 afirmou que a
 * assinatura era o único jeito de finalizar, e havia um segundo botão
 * ("Criar Agente ✦") na barra de navegação. O teste da 0038 não pegou porque
 * procurava pelo rótulo do OUTRO botão. Ver "um caminho só".
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import CharacterCreator from "../CharacterCreator";
import DocPanel from "../DocPanel";
import { PASSOS } from "../StepBar";
import { numeroDeDossie } from "../../../domain/character";

const abrir = (props = {}) =>
  render(<CharacterCreator onFinish={jest.fn()} onCancel={jest.fn()} {...props} />);

/* ════════════════════════════════════════════════════════════════════════
 *  O NÚMERO DE REGISTRO
 * ════════════════════════════════════════════════════════════════════════ */

describe("numeroDeDossie — derivado, nunca sorteado (AC-2)", () => {
  it("o mesmo nome emite sempre o mesmo número", () => {
    expect(numeroDeDossie("Kael Nightingale")).toBe(numeroDeDossie("Kael Nightingale"));
  });

  it("nomes diferentes emitem números diferentes", () => {
    expect(numeroDeDossie("Kael")).not.toBe(numeroDeDossie("Kaela"));
  });

  it("o formato é NNNNNN/NNN", () => {
    expect(numeroDeDossie("Kael Nightingale")).toMatch(/^\d{6}\/\d{3}$/);
  });

  it("a série nunca começa em zero — 000123/456 não parece registro", () => {
    for (const nome of ["a", "Kael", "Zé", "Agente de Teste", "ᚠᚢᚦ"]) {
      expect(numeroDeDossie(nome)).toMatch(/^[1-9]\d{5}\/\d{3}$/);
    }
  });

  it("sem nome não há número", () => {
    expect(numeroDeDossie("")).toBe("");
    expect(numeroDeDossie("   ")).toBe("");
    expect(numeroDeDossie(null)).toBe("");
    expect(numeroDeDossie(undefined)).toBe("");
  });

  it("espaço nas pontas não muda o número", () => {
    expect(numeroDeDossie("  Kael  ")).toBe(numeroDeDossie("Kael"));
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  A MOLDURA
 * ════════════════════════════════════════════════════════════════════════ */

describe("DocPanel — o documento emitido (AC-1 e AC-3)", () => {
  it("traz emissor, natureza e número", () => {
    render(<DocPanel natureza="Anexo I · Aptidões" numero="904312/518"><p>corpo</p></DocPanel>);
    expect(screen.getByText("Ordo Realitas")).toBeInTheDocument();
    expect(screen.getByText("Anexo I · Aptidões")).toBeInTheDocument();
    expect(screen.getByLabelText("Documento número 904312/518")).toBeInTheDocument();
  });

  it("o corpo fica dentro da moldura", () => {
    render(<DocPanel natureza="x" numero="904312/518"><p>corpo do anexo</p></DocPanel>);
    expect(screen.getByText("corpo do anexo")).toBeInTheDocument();
  });

  /* Sem isto, um leitor de tela leria a fileira de travessões como conteúdo. */
  it("sem número, o lugar dele é um traçado anunciado como não emitido", () => {
    render(<DocPanel natureza="x" numero=""><p>corpo</p></DocPanel>);
    expect(screen.getByLabelText("Documento ainda não emitido")).toBeInTheDocument();
  });

  it("o traçado tem a mesma largura do número, para o cabeçalho não pular", () => {
    render(<DocPanel natureza="x" numero=""><p>corpo</p></DocPanel>);
    const tracado = screen.getByLabelText("Documento ainda não emitido").textContent;
    expect(tracado).toHaveLength("000000/000".length);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  A BARRA DE PASSOS
 * ════════════════════════════════════════════════════════════════════════ */

describe("StepBar — fala a língua do app (AC-4)", () => {
  it("os cinco passos aparecem, com Admissão primeiro", () => {
    abrir();
    expect(PASSOS[0]).toBe("Admissão");
    expect(PASSOS).toHaveLength(5);
    for (const p of PASSOS) {
      expect(screen.getByLabelText(new RegExp(`${p} \\(`))).toBeInTheDocument();
    }
  });

  it("cumprido, atual e pendente se distinguem por texto, não só por cor", () => {
    abrir();
    expect(screen.getByLabelText(/Admissão \(atual\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Atributos \(pendente\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Próximo →"));
    expect(screen.getByLabelText(/Admissão \(cumprido\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Atributos \(atual\)/)).toBeInTheDocument();
  });

  it("o passo atual é anunciado como passo corrente", () => {
    abrir();
    expect(screen.getByLabelText(/Admissão \(atual\)/)).toHaveAttribute("aria-current", "step");
  });

  /* Voltar por clique é atalho legítimo; pular para frente contornaria o
   * `canNext` e deixaria criar agente sem distribuir atributos. */
  it("passo pendente não é clicável — o atalho não fura as travas", () => {
    abrir();
    expect(screen.getByLabelText(/Classe \(pendente\)/)).toBeDisabled();
  });

  it("passo cumprido é clicável e volta para ele", () => {
    abrir();
    fireEvent.click(screen.getByText("Próximo →"));
    const admissao = screen.getByLabelText(/Admissão \(cumprido\)/);
    expect(admissao).not.toBeDisabled();
    fireEvent.click(admissao);
    expect(screen.getByLabelText(/Admissão \(atual\)/)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  O FLUXO
 * ════════════════════════════════════════════════════════════════════════ */

describe("A página de admissão (AC-5)", () => {
  it("é a primeira tela, e é um termo, não um formulário", () => {
    abrir();
    expect(screen.getByText("Termo de Admissão")).toBeInTheDocument();
    expect(screen.getByText("O que esperamos de você")).toBeInTheDocument();
  });

  it("o cabeçalho do documento acompanha o passo", () => {
    abrir();
    expect(screen.getByText("Termo de admissão")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Próximo →"));
    expect(screen.getByText("Anexo I · Aptidões")).toBeInTheDocument();
  });

  it("dela se avança para os atributos sem trava", () => {
    abrir();
    fireEvent.click(screen.getByText("Próximo →"));
    expect(screen.getByText("Distribua seus Atributos")).toBeInTheDocument();
  });
});

describe("Nada regrediu (AC-6)", () => {
  it("a trava dos atributos continua onde estava", () => {
    abrir();
    fireEvent.click(screen.getByText("Próximo →")); // → Atributos
    // Recém-aberto há 4 pontos a distribuir, então "Próximo" está travado.
    fireEvent.click(screen.getByText("Próximo →"));
    expect(screen.getByText("Distribua seus Atributos")).toBeInTheDocument();
  });

  /* ⚠ ESTE TESTE NASCEU DE UM DEFEITO MEU NA SPEC 0038.
   * A 0038 afirmou que a assinatura era o único caminho de finalização e removeu
   * o botão "Finalizar Ficha" — mas havia um SEGUNDO botão, "Criar Agente ✦", na
   * barra de navegação. O teste de lá procurava pelo rótulo errado e passou.
   * Aqui a asserção é sobre a AUSÊNCIA DOS DOIS rótulos, em todos os passos. */
  it("um caminho só: nenhum botão de finalizar fora da assinatura", () => {
    abrir();
    for (let i = 0; i < PASSOS.length; i++) {
      expect(screen.queryByText("Criar Agente ✦")).not.toBeInTheDocument();
      expect(screen.queryByText("Finalizar Ficha")).not.toBeInTheDocument();
      const proximo = screen.queryByText("Próximo →");
      if (proximo) fireEvent.click(proximo);
    }
  });

  it("cancelar continua saindo", () => {
    const onCancel = jest.fn();
    abrir({ onCancel });
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalled();
  });
});
