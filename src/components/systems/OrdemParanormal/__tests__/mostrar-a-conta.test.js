/* Spec 0037 — "Mostrar a conta".
 *
 * A ficha executava a regra de rolagem de Ordem Paranormal corretamente e não a
 * mostrava: os N d20 saíam todos com o mesmo peso visual e o dado que venceu era
 * DESCARTADO DO ESTADO (`base.result` sobrescrito por `base.result + bonus`).
 * Estes testes travam as funções puras que passaram a guardar a conta.
 *
 * Nenhum teste aqui rola dado de verdade sem semente: o rng do `domain/dice.js` é
 * injetável, e é por ele que a integração com `rollOP` é verificada.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  bonusDeModificadores,
  boloDeDados,
  notacaoDeDados,
  termosDaConta,
  totalDaConta,
  rollPayload,
  TREINO_TIERS,
} from "../rules";
import { rollOP } from "../../../../domain/dice";
import RollCard from "../RollCard";
import OrdemParanormalSheet from "../OrdemParanormalSheet";

/* A ficha desenha o retrato num canvas, que o jsdom não implementa. */
beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
});

const fichaBase = {
  id: "t37",
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

/* ⚠ Sem o provider de i18n, `t("op.pericias.Acrobacia")` devolve a própria
 * CHAVE — o nome da perícia chega como "op.pericias.Acrobacia". As demais
 * suítes de OP montam a ficha do mesmo jeito, então isto é convenção do repo,
 * não defeito desta spec.
 *
 * Estes matchers ancoram no que NÃO depende de tradução (o grau de treino e o
 * prefixo do campo) e deixam o nome livre no meio. Não os troque por string
 * exata: com o provider ligado o nome vira "Acrobacia" e o teste passaria a
 * reprovar por causa da tradução, não por causa do comportamento. */
const GRAU = (grau) => new RegExp(`Acrobacia: ${grau}$`);
const CAMPO = (prefixo) => new RegExp(`^${prefixo} .*Acrobacia$`);

describe("bonusDeModificadores — só o que está ativo entra na conta", () => {
  const banca = [
    { id: "m1", nome: "Sob efeito de Sangue", dados: 1, valor: 0, ativo: true },
    { id: "m2", nome: "Cobertura", dados: 0, valor: 2, ativo: true },
    { id: "m3", nome: "Ferido", dados: 0, valor: -5, ativo: false },
  ];

  it("soma dados e valor apenas dos ativos", () => {
    expect(bonusDeModificadores(banca)).toEqual({
      dados: 1,
      valor: 2,
      nomes: ["Sob efeito de Sangue", "Cobertura"],
    });
  });

  it("desativar remove da conta sem apagar da banca (AC-6)", () => {
    const desligado = banca.map((m) => (m.id === "m1" ? { ...m, ativo: false } : m));
    expect(bonusDeModificadores(desligado).dados).toBe(0);
    expect(desligado).toHaveLength(3); // continua na banca
  });

  it("aceita lixo sem explodir — a banca vem do Firestore", () => {
    expect(bonusDeModificadores(null)).toEqual({ dados: 0, valor: 0, nomes: [] });
    expect(bonusDeModificadores([null, undefined, {}])).toEqual({ dados: 0, valor: 0, nomes: [] });
    expect(bonusDeModificadores([{ ativo: true, dados: "2", valor: "3" }])).toMatchObject({ dados: 2, valor: 3 });
  });

  it("modificador ativo sem nome não vira string vazia na tela", () => {
    expect(bonusDeModificadores([{ ativo: true, nome: "   ", valor: 1 }]).nomes).toEqual(["Modificador"]);
  });
});

describe("boloDeDados — quantos d20, e o que o rollOP recebe", () => {
  it("atributo 3 sem bônus lança 3d20 e fica com o melhor", () => {
    expect(boloDeDados(3, 0)).toEqual({ n: 3, worst: false, bonusIgnorado: false, attrEfetivo: 3 });
  });

  it("dado de bônus engorda o bolo quando o atributo é maior que 0 (AC-6)", () => {
    expect(boloDeDados(2, 1)).toMatchObject({ n: 3, attrEfetivo: 3, worst: false });
  });

  /* AC-7: a decisão de regra da spec. Atributo 0 é o caso invertido do livro e o
   * livro não resolve o que um dado de bônus faz nele — então não faz nada, e a
   * interface diz que não fez. */
  it("atributo 0 lança 2d20, fica com o PIOR e ignora dado de bônus (AC-7)", () => {
    expect(boloDeDados(0, 2)).toEqual({ n: 2, worst: true, bonusIgnorado: true, attrEfetivo: 0 });
  });

  it("atributo 0 sem bônus não acusa bônus ignorado", () => {
    expect(boloDeDados(0, 0).bonusIgnorado).toBe(false);
  });

  it("bônus negativo não encolhe o bolo", () => {
    expect(boloDeDados(2, -5)).toMatchObject({ n: 2, attrEfetivo: 2 });
  });

  it("entrada suja cai no caso de atributo 0, não em NaN dados", () => {
    expect(boloDeDados(undefined).n).toBe(2);
    expect(boloDeDados("abc").n).toBe(2);
    expect(boloDeDados(-3).n).toBe(2);
  });

  /* ⚠ ESTE É O TESTE QUE JUSTIFICA `attrEfetivo` EXISTIR.
   * `rollOP` decide o "pior" a partir do NÚMERO que recebe (`attrVal === 0`), não
   * de uma flag. Mandar `n` em vez de `attrEfetivo` faria o atributo 0 rolar 2
   * dados e ficar com o MELHOR — o oposto da regra, e sem erro nenhum na tela. */
  it("attrEfetivo preserva o pior-de-dois; passar `n` ao rollOP inverteria a regra", () => {
    const bolo = boloDeDados(0, 0);

    const dados = [0.95, 0.05]; // 20 e 2
    const certo = rollOP(bolo.attrEfetivo, { rng: () => dados.shift() });
    expect(certo.rolls).toEqual([20, 2]);
    expect(certo.result).toBe(2); // ficou com o pior
    expect(certo.worst).toBe(true);

    // A mesma semente, mandando `n`: mesmo par de dados, regra invertida.
    const outros = [0.95, 0.05];
    const errado = rollOP(bolo.n, { rng: () => outros.shift() });
    expect(errado.rolls).toEqual([20, 2]);
    expect(errado.worst).toBe(false);
    expect(errado.result).toBe(20);
  });

  it("com atributo > 0 o rollOP recebe o bolo inteiro e fica com o melhor", () => {
    const dados = [0.45, 0.05, 0.95]; // 10, 2, 20
    const bolo = boloDeDados(2, 1); // 2 de atributo + 1 de bônus
    const res = rollOP(bolo.attrEfetivo, { rng: () => dados.shift() });
    expect(res.rolls).toHaveLength(3);
    expect(res.result).toBe(20);
    expect(res.worst).toBe(false);
  });
});

describe("notacaoDeDados — a coluna 'Dados' mostra dados (AC-4)", () => {
  it("mostra a contagem real do bolo", () => {
    expect(notacaoDeDados(boloDeDados(3))).toBe("3d20");
    expect(notacaoDeDados(boloDeDados(0))).toBe("2d20");
    expect(notacaoDeDados(boloDeDados(2, 1))).toBe("3d20");
  });

  it("não quebra sem bolo", () => {
    expect(notacaoDeDados(undefined)).toBe("1d20");
  });
});

describe("termosDaConta — a aritmética que o verso do card mostra (AC-3)", () => {
  it("nomeia o dado conforme a regra aplicada", () => {
    expect(termosDaConta({ kept: 13 })[0]).toMatchObject({ rotulo: "Melhor d20", valor: 13, dado: true });
    expect(termosDaConta({ kept: 2, worst: true })[0]).toMatchObject({ rotulo: "Pior d20", valor: 2 });
  });

  it("traz o grau do treino por extenso, não só o número", () => {
    const [, treino] = termosDaConta({ kept: 10, treino: 10 });
    expect(treino).toEqual({ rotulo: `Treino · ${TREINO_TIERS[10].label}`, valor: 10 });
    expect(treino.rotulo).toContain("Veterano");
  });

  it("omite termo que vale 0 e não traz dado — 'Outros +0' é ruído", () => {
    const termos = termosDaConta({ kept: 9, treino: 0, outros: 0 });
    expect(termos).toHaveLength(1);
  });

  it("cita o modificador ativo pelo nome (AC-6)", () => {
    const termos = termosDaConta({
      kept: 11,
      treino: 5,
      mods: [
        { nome: "Sob efeito de Sangue", dados: 1, valor: 0, ativo: true },
        { nome: "Ferido", valor: -5, ativo: false },
      ],
    });
    const rotulos = termos.map((x) => x.rotulo);
    expect(rotulos).toContain("Sob efeito de Sangue");
    expect(rotulos).not.toContain("Ferido");
  });

  it("modificador que só dá dado aparece na lista, mesmo somando 0", () => {
    const termos = termosDaConta({ kept: 8, mods: [{ nome: "Ajuda", dados: 1, valor: 0, ativo: true }] });
    expect(termos.map((x) => x.rotulo)).toContain("Ajuda");
    expect(termos.find((x) => x.rotulo === "Ajuda")).toMatchObject({ dados: 1, valor: 0 });
  });

  it("não quebra sem argumento", () => {
    expect(termosDaConta()).toHaveLength(1);
  });
});

describe("totalDaConta — kept + bonus === result (AC-1)", () => {
  it("soma os valores dos termos", () => {
    const termos = termosDaConta({ kept: 13, treino: 5, outros: 2 });
    expect(totalDaConta(termos)).toBe(20);
  });

  it("dado de bônus não soma valor — ele já entrou no bolo", () => {
    const termos = termosDaConta({ kept: 13, mods: [{ nome: "Ajuda", dados: 2, valor: 0, ativo: true }] });
    expect(totalDaConta(termos)).toBe(13);
  });

  it("fecha com a conta que a ficha exibe", () => {
    const kept = 13, treino = 5, outros = 2;
    const mods = [{ nome: "Cobertura", valor: 2, ativo: true }];
    const { valor } = bonusDeModificadores(mods);
    const result = kept + treino + outros + valor;
    expect(totalDaConta(termosDaConta({ kept, treino, outros, mods }))).toBe(result);
  });
});

/* AC-10: o payload persistido não pode ganhar campo por causa desta spec.
 * `messages` é documento no Firestore lido pelo feed da campanha; campo novo ali
 * é mudança de contrato, não detalhe de UI. */
describe("rollPayload — o contrato do Firestore não mudou (AC-10)", () => {
  it("expõe exatamente os campos de antes da spec 0037", () => {
    const payload = rollPayload(
      "Acrobacia (AGI)",
      { rolls: [10, 13, 9], result: 18, kept: 13, bonus: 5, worst: false, crit: false, rollType: "skill" },
      "Kael",
      "sangue",
    );
    expect(Object.keys(payload).sort()).toEqual(
      [
        "attr", "charName", "crit", "dano", "danoRolls", "dice", "elemento",
        "expr", "kind", "name", "result", "rollType", "rolls", "worst",
      ].sort(),
    );
  });

  it("kept e bonus NÃO atravessam a fronteira", () => {
    const payload = rollPayload("x", { rolls: [1], result: 1, kept: 1, bonus: 0 }, "n", null);
    expect(payload).not.toHaveProperty("kept");
    expect(payload).not.toHaveProperty("bonus");
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  INTERFACE — o que o jogador vê
 * ════════════════════════════════════════════════════════════════════════ */

describe("RollCard — o dado descartado é visivelmente descartado (AC-2)", () => {
  const rolagem = {
    attr: "Acrobacia (AGI)",
    rolls: [10, 13, 9],
    result: 18,
    kept: 13,
    bonus: 5,
    worst: false,
    conta: termosDaConta({ kept: 13, treino: 5 }),
  };

  it("marca o mantido e os descartados por rótulo, não só por cor", () => {
    render(<RollCard roll={rolagem} onClose={() => {}} />);
    expect(screen.getByLabelText("13, mantido")).toBeInTheDocument();
    expect(screen.getByLabelText("10, descartado")).toBeInTheDocument();
    expect(screen.getByLabelText("9, descartado")).toBeInTheDocument();
  });

  it("o descartado ganha risco — redundância além do matiz", () => {
    render(<RollCard roll={rolagem} onClose={() => {}} />);
    expect(screen.getByLabelText("10, descartado")).toHaveStyle({ textDecoration: "line-through" });
    expect(screen.getByLabelText("13, mantido")).toHaveStyle({ textDecoration: "none" });
  });

  it("com atributo 0 o destaque cai no menor dado e a etiqueta diz 'pior'", () => {
    const pior = { ...rolagem, rolls: [17, 4], kept: 4, result: 4, worst: true, conta: termosDaConta({ kept: 4, worst: true }) };
    render(<RollCard roll={pior} onClose={() => {}} />);
    expect(screen.getByLabelText("4, mantido")).toBeInTheDocument();
    expect(screen.getByLabelText("17, descartado")).toBeInTheDocument();
    expect(screen.getByText("pior")).toBeInTheDocument();
  });

  it("dado repetido não destaca dois — o empate é indistinguível, e o primeiro leva", () => {
    const empate = { ...rolagem, rolls: [13, 13, 9], kept: 13 };
    render(<RollCard roll={empate} onClose={() => {}} />);
    expect(screen.getAllByLabelText("13, mantido")).toHaveLength(1);
    expect(screen.getAllByLabelText("13, descartado")).toHaveLength(1);
  });
});

describe("RollCard — o verso mostra a conta (AC-3)", () => {
  const rolagem = {
    attr: "Acrobacia (AGI)",
    rolls: [10, 13, 9],
    result: 20,
    kept: 13,
    bonus: 7,
    worst: false,
    conta: termosDaConta({
      kept: 13, treino: 5,
      mods: [{ nome: "Cobertura", valor: 2, ativo: true }],
    }),
  };

  it("a frente mostra o total e esconde a conta", () => {
    render(<RollCard roll={rolagem} onClose={() => {}} />);
    expect(screen.getByText("resultado")).toBeInTheDocument();
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
  });

  it("virar revela os termos e cita o modificador pelo nome", () => {
    render(<RollCard roll={rolagem} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText("Ver a conta"));
    expect(screen.getByText("Melhor d20")).toBeInTheDocument();
    expect(screen.getByText(/Treino · Treinado/)).toBeInTheDocument();
    expect(screen.getByText("Cobertura")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("o mesmo controle volta para a frente, com aria-pressed acompanhando", () => {
    render(<RollCard roll={rolagem} onClose={() => {}} />);
    const btn = screen.getByLabelText("Ver a conta");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    const volta = screen.getByLabelText("Ver o resultado");
    expect(volta).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(volta);
    expect(screen.getByText("resultado")).toBeInTheDocument();
  });

  it("fechar está disponível nas duas faces", () => {
    const onClose = jest.fn();
    render(<RollCard roll={rolagem} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Fechar"));
    fireEvent.click(screen.getByLabelText("Ver a conta"));
    fireEvent.click(screen.getByLabelText("Fechar"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  /* Botão de virar que revela vazio é pior que botão ausente. */
  it("rolagem sem conta não oferece o controle de virar", () => {
    render(<RollCard roll={{ attr: "2D6+3", rolls: [4, 2], result: 9 }} onClose={() => {}} />);
    expect(screen.queryByLabelText("Ver a conta")).not.toBeInTheDocument();
  });

  it("avisa quando o dado de bônus não se aplicou (AC-7)", () => {
    render(<RollCard roll={{ ...rolagem, worst: true, bonusIgnorado: true }} onClose={() => {}} />);
    expect(screen.getByText(/não se aplica a atributo 0/i)).toBeInTheDocument();
  });
});

describe("Linha de perícia — a coluna 'Dados' mostra dados (AC-4 e AC-5)", () => {
  it("mostra a contagem de d20 do atributo, não a sigla", () => {
    renderFicha(); // AGI 3
    // Acrobacia é AGI: 3 de atributo → 3d20.
    expect(screen.getAllByText("3d20").length).toBeGreaterThan(0);
  });

  it("atributo 0 mostra 2d20 com a marca de pior", () => {
    renderFicha({ attrs: { AGI: 0, FOR: 1, INT: 1, PRE: 1, VIG: 1 } });
    expect(screen.getAllByText("2d20↓").length).toBeGreaterThan(0);
  });

  it("a sigla do atributo não se perde — migrou para a segunda linha", () => {
    renderFicha();
    expect(screen.getAllByLabelText(GRAU("Destreinado")).length).toBeGreaterThan(0);
    // A segunda linha carrega "AGI · <grau>"; é ela que herdou a sigla.
    expect(screen.getAllByText(/AGI/).length).toBeGreaterThan(0);
  });

  it("o grau de treino é legível como texto, não só como cor", () => {
    renderFicha({ skillTreino: { Acrobacia: 10 } });
    expect(screen.getByLabelText(GRAU("Veterano"))).toBeInTheDocument();
  });

  it("destreinado também se anuncia", () => {
    renderFicha({ skillTreino: {} });
    expect(screen.getAllByLabelText(GRAU("Destreinado")).length).toBeGreaterThan(0);
  });
});

describe("Modo de Jogo protege os números da perícia (AC-8)", () => {
  it("travada: treino e outros são readOnly", () => {
    renderFicha();
    expect(screen.getByLabelText(CAMPO("Treino"))).toHaveAttribute("readonly");
    expect(screen.getByLabelText(CAMPO("Outros"))).toHaveAttribute("readonly");
  });

  it("travada: o grau não cicla ao clicar", () => {
    renderFicha({ skillTreino: { Acrobacia: 5 } });
    fireEvent.click(screen.getByLabelText(GRAU("Treinado")));
    expect(screen.getByLabelText(GRAU("Treinado"))).toBeInTheDocument();
    expect(screen.queryByLabelText(GRAU("Veterano"))).not.toBeInTheDocument();
  });

  it("em edição: os campos liberam e o grau cicla", () => {
    renderFicha({ skillTreino: { Acrobacia: 5 } }, { defaultEditMode: true });
    expect(screen.getByLabelText(CAMPO("Treino"))).not.toHaveAttribute("readonly");
    fireEvent.click(screen.getByLabelText(GRAU("Treinado")));
    expect(screen.getByLabelText(GRAU("Veterano"))).toBeInTheDocument();
  });

  /* ⚠ O dado tem de ser fixado: 3d20 tira 20 em ~14% das rolagens, e um 20 manda
   * a ficha para o MODAL DE CRÍTICO, que não desenha o rótulo "resultado". Sem a
   * semente este teste reprovaria uma vez a cada sete execuções — e gate que
   * pisca ensina o time a reexecutar até passar, que é como regressão de verdade
   * passa batida. `rollOP` resolve `Math.random` a cada chamada exatamente para
   * que o spy funcione (ver o comentário em `domain/dice.js`). */
  it("travada, rolar a perícia continua funcionando", () => {
    const dado = jest.spyOn(Math, "random").mockReturnValue(0.5); // 11 em d20
    try {
      renderFicha();
      fireEvent.click(screen.getByLabelText(/^Rolar .*Acrobacia$/));
      expect(screen.getByText("resultado")).toBeInTheDocument();
      expect(screen.getByLabelText("11, mantido")).toBeInTheDocument();
    } finally {
      dado.mockRestore();
    }
  });
});

describe("Banca de modificadores — registrar, ligar, desligar (AC-6)", () => {
  it("começa fechada e sem nada ativo", () => {
    renderFicha();
    expect(screen.getByText("nenhum ativo")).toBeInTheDocument();
  });

  it("um modificador salvo aparece com seu bônus somado no resumo", () => {
    renderFicha({ modificadores: [{ id: "m1", nome: "Cobertura", dados: 1, valor: 2, ativo: true }] });
    expect(screen.getByText("+1d20 +2")).toBeInTheDocument();
  });

  it("desativado sai do resumo e continua na banca", () => {
    renderFicha({ modificadores: [{ id: "m1", nome: "Cobertura", dados: 1, valor: 2, ativo: true }] });
    fireEvent.click(screen.getByText(/▸ Modificadores|▾ Modificadores/));
    fireEvent.click(screen.getByLabelText("Cobertura ativo"));
    expect(screen.getByText("nenhum ativo")).toBeInTheDocument();
    expect(screen.getByTitle("Cobertura")).toBeInTheDocument();
  });

  it("o dado de bônus engorda o bolo exibido na coluna Dados", () => {
    renderFicha({ modificadores: [{ id: "m1", nome: "Ajuda", dados: 1, valor: 0, ativo: true }] });
    // AGI 3 + 1 de bônus → 4d20
    expect(screen.getAllByText("4d20").length).toBeGreaterThan(0);
  });

  it("a ficha somente-leitura não mostra a banca", () => {
    renderFicha({}, { readOnly: true });
    expect(screen.queryByText(/Modificadores/)).not.toBeInTheDocument();
  });
});
