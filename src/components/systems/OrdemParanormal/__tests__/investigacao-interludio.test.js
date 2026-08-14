/* Spec 0040 — Investigação e Interlúdio.
 *
 * As duas páginas que a referência anuncia como "em breve". Aqui elas existem —
 * e o Interlúdio é construído sobre as 7 regras que a spec 0026 já transcreveu
 * em `regras-oficiais.json`, não sobre número inventado.
 *
 * A asserção que mais importa é a do CLAMP: o livro diz "nenhuma recuperação
 * ultrapassa o máximo do personagem", e é a única parte da regra de recuperação
 * que temos por escrito no repo.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrdemParanormalSheet from "../OrdemParanormalSheet";
import REGRAS_OFICIAIS from "../../../../data/ordemParanormal/regras-oficiais.json";
import {
  ACOES_INTERLUDIO, REGRA_DA_CENA, MAX_ACOES, acaoPorId, condicaoPorId,
  recuperacaoBase, calcularRecuperacao, podeAdicionarAcao,
  aplicarInterludio, registroVazio, historicoDeInterludios,
} from "../interludio";
import {
  ESTADOS_PISTA, novaPista, mudarEstadoPista, removerPista,
  contarPistas, pistasOrdenadas,
} from "../investigacao";

beforeAll(() => {
  window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
});

const fichaBase = {
  id: "t40",
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

/** Abre a aba Descrição (agora Dossiê) e depois a sub-aba pedida. */
const abrirDossie = (subAba, extra = {}, props = {}) => {
  const r = renderFicha(extra, props);
  fireEvent.click(screen.getByRole("tab", { name: /descri/i }));
  if (subAba) fireEvent.click(screen.getByRole("tab", { name: subAba }));
  return r;
};

/* ════════════════════════════════════════════════════════════════════════
 *  INTERLÚDIO — domínio
 * ════════════════════════════════════════════════════════════════════════ */

describe("ACOES_INTERLUDIO — sai do livro, não do componente (AC-4)", () => {
  /* ⚠ A spec 0040 travou SEIS ações e faltava "Exercitar-se"; e chamava
   * "Manutenção" de "Consertar". A 0041 corrigiu a transcrição. */
  it("são as sete ações da transcrição oficial", () => {
    expect(ACOES_INTERLUDIO).toHaveLength(7);
    expect(ACOES_INTERLUDIO.map((a) => a.id)).toEqual([
      "interludio-dormir", "interludio-relaxar", "interludio-alimentar",
      "interludio-exercitar", "interludio-ler", "interludio-revisar",
      "interludio-manutencao",
    ]);
  });

  it("a regra da cena diz DUAS ações, não uma", () => {
    expect(MAX_ACOES).toBe(2);
    expect(REGRA_DA_CENA.descricao).toMatch(/até DUAS/);
  });

  it("a cena em si NÃO é uma ação escolhível", () => {
    expect(ACOES_INTERLUDIO.find((a) => a.id === "interludio-geral")).toBeUndefined();
    expect(REGRA_DA_CENA.id).toBe("interludio-geral");
  });

  /* Se alguém reescrever a descrição no componente, isto reprova — é o que
   * impede uma segunda régua para a mesma regra. */
  it("nome e descrição são idênticos ao JSON, caractere a caractere", () => {
    const doJson = Object.values(REGRAS_OFICIAIS).filter((r) => r.secao === "interludio" && r.id !== "interludio-geral");
    for (const a of ACOES_INTERLUDIO) {
      const fonte = doJson.find((r) => r.id === a.id);
      expect(a.nome).toBe(fonte.nome);
      expect(a.descricao).toBe(fonte.descricao);
    }
  });
});

/* ⚠ O EXEMPLO DO LIVRO É O ORÁCULO DESTA CONTA.
 * "um personagem de NEX 35% (limite de PE 7) recupera 7 PV e 7 PE" — e o nosso
 * `deriveStats().peTurno` para NEX 35% é `1 + nexLevel(35)` = 7. É essa
 * coincidência que autoriza calcular a recuperação em vez de pedir o número. */
describe("recuperacaoBase — a escada de condições do livro", () => {
  it("normal recupera o limite de PE cheio (exemplo do livro: 7)", () => {
    expect(recuperacaoBase(7, "normal")).toBe(7);
  });

  it("precária é metade, confortável dobra, luxuosa triplica", () => {
    expect(recuperacaoBase(7, "precaria")).toBe(3);     // metade, para baixo
    expect(recuperacaoBase(7, "confortavel")).toBe(14);
    expect(recuperacaoBase(7, "luxuosa")).toBe(21);
  });

  /* Decisão registrada, não regra do livro: metade de ímpar arredonda para
   * baixo, porque meio PV não existe e para cima seria mais generoso do que o
   * texto autoriza. */
  it("metade de ímpar arredonda para baixo", () => {
    expect(recuperacaoBase(5, "precaria")).toBe(2);
  });

  it("condição desconhecida cai em normal, o padrão do livro", () => {
    expect(recuperacaoBase(7, "cama-de-faquir")).toBe(7);
    expect(condicaoPorId("nada").id).toBe("normal");
  });

  it("sem limite de PE não recupera nada", () => {
    for (const v of [0, -3, null, undefined, "abc"]) expect(recuperacaoBase(v, "luxuosa")).toBe(0);
  });
});

describe("calcularRecuperacao — o que cada ação faz", () => {
  const ficha = { peTurno: 7 };

  it("dormir recupera PV e PE, e não Sanidade", () => {
    expect(calcularRecuperacao(ficha, { acoes: ["interludio-dormir"], condicao: "normal" }))
      .toEqual({ pv: 7, san: 0, pe: 7 });
  });

  it("relaxar recupera Sanidade, e não PV nem PE", () => {
    // 7 de base + 1 pelo próprio personagem que relaxou
    expect(calcularRecuperacao(ficha, { acoes: ["interludio-relaxar"], condicao: "normal" }))
      .toEqual({ pv: 0, san: 8, pe: 0 });
  });

  it("cada personagem que relaxa no mesmo interlúdio soma 1 SAN para todos", () => {
    const r = calcularRecuperacao(ficha, { acoes: ["interludio-relaxar"], condicao: "normal", relaxantes: 4 });
    expect(r.san).toBe(11); // 7 + 4
  });

  it("prato nutritivo sobe um degrau só no PV", () => {
    const r = calcularRecuperacao(ficha, {
      acoes: ["interludio-dormir", "interludio-alimentar"], condicao: "normal", prato: "nutritivo",
    });
    expect(r.pv).toBe(14); // normal → confortável
    expect(r.pe).toBe(7);  // intocado
  });

  it("prato energético sobe um degrau só no PE", () => {
    const r = calcularRecuperacao(ficha, {
      acoes: ["interludio-dormir", "interludio-alimentar"], condicao: "confortavel", prato: "energetico",
    });
    expect(r.pv).toBe(14);
    expect(r.pe).toBe(21); // confortável → luxuosa, o exemplo literal do livro
  });

  it("o degrau não passa do topo da escada", () => {
    const r = calcularRecuperacao(ficha, {
      acoes: ["interludio-dormir", "interludio-alimentar"], condicao: "luxuosa", prato: "nutritivo",
    });
    expect(r.pv).toBe(21); // já era luxuosa
  });

  it("prato favorito dá +2 SAN a quem relaxa", () => {
    const r = calcularRecuperacao(ficha, {
      acoes: ["interludio-relaxar", "interludio-alimentar"], condicao: "normal", prato: "favorito",
    });
    expect(r.san).toBe(10); // 7 + 1 + 2
  });

  it("prato só vale se a ação alimentar-se foi escolhida", () => {
    const r = calcularRecuperacao(ficha, { acoes: ["interludio-dormir"], condicao: "normal", prato: "nutritivo" });
    expect(r.pv).toBe(7); // o prato é ignorado
  });

  it("as ações sem recuperação não recuperam nada", () => {
    for (const id of ["interludio-ler", "interludio-exercitar", "interludio-manutencao", "interludio-revisar"]) {
      expect(calcularRecuperacao(ficha, { acoes: [id] })).toEqual({ pv: 0, san: 0, pe: 0 });
    }
  });
});

describe("podeAdicionarAcao — o teto de duas ações (AC-5)", () => {
  it("cabem duas", () => {
    expect(podeAdicionarAcao([], "interludio-dormir")).toBe(true);
    expect(podeAdicionarAcao(["interludio-dormir"], "interludio-ler")).toBe(true);
  });

  it("a terceira não cabe", () => {
    expect(podeAdicionarAcao(["interludio-dormir", "interludio-ler"], "interludio-relaxar")).toBe(false);
  });

  it("dormir/relaxar/alimentar não repetem — o livro diz uma vez por interlúdio", () => {
    for (const id of ["interludio-dormir", "interludio-relaxar", "interludio-alimentar"]) {
      expect(podeAdicionarAcao([id], id)).toBe(false);
    }
  });

  it("Revisar o Caso repete — o livro diz isso dela, e só dela", () => {
    expect(podeAdicionarAcao(["interludio-revisar"], "interludio-revisar")).toBe(true);
  });

  it("ação inexistente nunca entra", () => {
    expect(podeAdicionarAcao([], "interludio-teletransporte")).toBe(false);
  });
});

describe("aplicarInterludio — o clamp é a regra (AC-6)", () => {
  const vitais = { pv: 18, pvMax: 20, san: 5, sanMax: 12, pe: 2, peMax: 4, peTurno: 7 };

  it("recuperar além do máximo para no máximo", () => {
    const r = aplicarInterludio(vitais, { acoes: ["interludio-dormir"], condicao: "normal" });
    expect(r.ok).toBe(true);
    expect(r.vitais.pv).toBe(20); // 18 + 7 seria 25
    expect(r.vitais.pe).toBe(4);  // 2 + 7 seria 9
  });

  it("o registro guarda o que RECUPEROU, não o que a conta pediu", () => {
    const r = aplicarInterludio(vitais, { acoes: ["interludio-dormir"], condicao: "normal" });
    expect(r.registro.pv).toBe(2); // 18 → 20
    expect(r.registro.pe).toBe(2); // 2 → 4
  });

  it("sem máximo conhecido não recupera — deixar passar seria furar o teto", () => {
    const r = aplicarInterludio({ pv: 5, pvMax: 0, peTurno: 7 }, { acoes: ["interludio-dormir"] });
    expect(r.vitais.pv).toBe(5);
    expect(r.registro.pv).toBe(0);
  });

  it("sem ação escolhida não aplica nada (AC-5)", () => {
    const r = aplicarInterludio(vitais, {});
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/ao menos uma ação/i);
    expect(r.vitais).toBeUndefined();
  });

  it("mais de duas ações é recusado, com o motivo do livro", () => {
    const r = aplicarInterludio(vitais, {
      acoes: ["interludio-dormir", "interludio-ler", "interludio-exercitar"],
    });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/até 2 ações/i);
  });

  it("ação inexistente é filtrada e sozinha derruba o registro", () => {
    expect(aplicarInterludio(vitais, { acoes: ["interludio-teletransporte"] }).ok).toBe(false);
  });

  it("o registro carrega os nomes legíveis das ações", () => {
    const r = aplicarInterludio(vitais, {
      acoes: ["interludio-revisar", "interludio-ler"], nota: "reabrimos o caso",
    });
    expect(r.registro.acoesNomes).toEqual([acaoPorId("interludio-revisar").nome, acaoPorId("interludio-ler").nome]);
    expect(r.registro.nota).toBe("reabrimos o caso");
  });

  it("condição e prato só entram no registro quando fazem sentido", () => {
    const semDescanso = aplicarInterludio(vitais, { acoes: ["interludio-ler"], condicao: "luxuosa", prato: "favorito" });
    expect(semDescanso.registro.condicao).toBeNull();
    expect(semDescanso.registro.prato).toBeNull();

    const comDescanso = aplicarInterludio(vitais, { acoes: ["interludio-dormir"], condicao: "luxuosa" });
    expect(comDescanso.registro.condicao).toBe("luxuosa");
  });

  it("nota gigante é cortada, não gravada inteira", () => {
    const r = aplicarInterludio(vitais, { acoes: ["interludio-ler"], nota: "x".repeat(900) });
    expect(r.registro.nota).toHaveLength(500);
  });

  it("interlúdio sem recuperação é um resultado legítimo", () => {
    const r = aplicarInterludio(vitais, { acoes: ["interludio-manutencao"] });
    expect(r.ok).toBe(true);
    expect(registroVazio(r.registro)).toBe(true);
  });

  /* A pré-visualização da tela e a aplicação têm de concordar — se divergissem,
   * o jogador confirmaria um número e receberia outro. */
  it("a conta da prévia é a MESMA que a aplicada, antes do clamp", () => {
    const folgado = { pv: 0, pvMax: 99, san: 0, sanMax: 99, pe: 0, peMax: 99, peTurno: 7 };
    const escolha = { acoes: ["interludio-dormir"], condicao: "confortavel" };
    const previa = calcularRecuperacao(folgado, escolha);
    const r = aplicarInterludio(folgado, escolha);
    expect(r.registro.pv).toBe(previa.pv);
    expect(r.registro.pe).toBe(previa.pe);
  });
});

describe("historicoDeInterludios — o mais recente primeiro (AC-7)", () => {
  it("inverte a ordem de gravação", () => {
    const h = historicoDeInterludios([{ acao: "a" }, { acao: "b" }, { acao: "c" }]);
    expect(h.map((x) => x.acao)).toEqual(["c", "b", "a"]);
  });

  it("descarta lixo do Firestore", () => {
    expect(historicoDeInterludios([null, {}, { acao: "a" }, undefined])).toHaveLength(1);
    expect(historicoDeInterludios("nada")).toEqual([]);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  INVESTIGAÇÃO — domínio
 * ════════════════════════════════════════════════════════════════════════ */

describe("novaPista (AC-2)", () => {
  it("nasce aberta — pista que já entra confirmada não foi investigada", () => {
    expect(novaPista({ texto: "Marca de queimadura", origem: "Cena do crime" })).toMatchObject({
      texto: "Marca de queimadura", origem: "Cena do crime", estado: "aberta",
    });
  });

  it("sem texto não existe pista", () => {
    for (const t of ["", "   ", null, undefined]) expect(novaPista({ texto: t })).toBeNull();
  });

  it("origem é opcional", () => {
    expect(novaPista({ texto: "Só isso" }).origem).toBe("");
  });

  it("texto e origem gigantes são cortados", () => {
    const p = novaPista({ texto: "a".repeat(500), origem: "b".repeat(300) });
    expect(p.texto).toHaveLength(300);
    expect(p.origem).toHaveLength(120);
  });
});

describe("mudarEstadoPista", () => {
  const pistas = [{ id: "p1", texto: "x", estado: "aberta" }, { id: "p2", texto: "y", estado: "aberta" }];

  it("muda só a pista pedida", () => {
    const r = mudarEstadoPista(pistas, "p1", "descartada");
    expect(r[0].estado).toBe("descartada");
    expect(r[1].estado).toBe("aberta");
  });

  it("estado desconhecido é ignorado — não pode virar um quarto estado", () => {
    expect(mudarEstadoPista(pistas, "p1", "resolvidissima")[0].estado).toBe("aberta");
  });

  it("os três estados do sistema", () => {
    expect(ESTADOS_PISTA.map((e) => e.id)).toEqual(["aberta", "confirmada", "descartada"]);
  });

  it("cada estado tem MARCA além da cor", () => {
    for (const e of ESTADOS_PISTA) expect(e.marca).toBeTruthy();
  });
});

describe("contarPistas — conta o que ainda exige ação (AC-3)", () => {
  const pistas = [
    { id: "a", estado: "aberta" }, { id: "b", estado: "confirmada" },
    { id: "c", estado: "descartada" }, { id: "d", estado: "aberta" },
  ];

  it("separa por estado", () => {
    expect(contarPistas(pistas)).toEqual({ total: 4, abertas: 2, confirmadas: 1, descartadas: 1 });
  });

  it("estado ausente conta como aberta — não desaparece da conta", () => {
    expect(contarPistas([{ id: "x" }]).abertas).toBe(1);
  });

  it("lixo não quebra", () => {
    expect(contarPistas(null)).toMatchObject({ total: 0, abertas: 0 });
  });
});

describe("pistasOrdenadas — abertas primeiro, descartadas por último", () => {
  it("ordena por urgência, não por digitação", () => {
    const r = pistasOrdenadas([
      { id: "d", estado: "descartada" }, { id: "c", estado: "confirmada" }, { id: "a", estado: "aberta" },
    ]);
    expect(r.map((p) => p.id)).toEqual(["a", "c", "d"]);
  });
});

describe("removerPista", () => {
  it("remove por id e tolera lixo", () => {
    expect(removerPista([{ id: "a" }, { id: "b" }], "a")).toEqual([{ id: "b" }]);
    expect(removerPista(null, "a")).toEqual([]);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  INTERFACE
 * ════════════════════════════════════════════════════════════════════════ */

describe("O Dossiê não criou aba nova no topo (AC-1)", () => {
  it("as abas do topo continuam seis — sete quebraria a barra", () => {
    renderFicha();
    expect(screen.getAllByRole("tab").filter((t) => !t.closest('[aria-label="Seções do dossiê"]'))).toHaveLength(6);
  });

  it("a aba de descrição hospeda as três sub-abas", () => {
    abrirDossie(null);
    for (const nome of [/^Agente$/, /^Investigação$/, /^Interlúdio$/]) {
      expect(screen.getByRole("tab", { name: nome })).toBeInTheDocument();
    }
  });

  it("o conteúdo antigo está sob Agente, intacto", () => {
    abrirDossie(/^Agente$/);
    expect(screen.getByText("Aparência")).toBeInTheDocument();
    expect(screen.getByText("Personalidade")).toBeInTheDocument();
  });
});

describe("Investigação na tela", () => {
  it("sem pistas, diz o que fazer em vez de mostrar zero (AC-3)", () => {
    abrirDossie(/^Investigação$/);
    expect(screen.getByText(/Registre o que a mesa levantou/i)).toBeInTheDocument();
  });

  it("registrar uma pista a coloca na lista como aberta", () => {
    abrirDossie(/^Investigação$/);
    fireEvent.change(screen.getByLabelText("Texto da pista"), { target: { value: "Porta arranhada" } });
    fireEvent.change(screen.getByLabelText("Origem da pista"), { target: { value: "Apartamento 4B" } });
    fireEvent.click(screen.getByLabelText("Registrar pista"));
    expect(screen.getByText("Porta arranhada")).toBeInTheDocument();
    /* Estado e origem são nós irmãos, não um texto só — asserção por peça, que
     * também prova que o estado tem nome acessível. */
    expect(screen.getByLabelText("Estado: Aberta")).toBeInTheDocument();
    expect(screen.getByText(/Apartamento 4B/)).toBeInTheDocument();
    expect(screen.getByText("1 aberta · 1 no total")).toBeInTheDocument();
  });

  it("o botão de registrar fica travado sem texto", () => {
    abrirDossie(/^Investigação$/);
    expect(screen.getByLabelText("Registrar pista")).toBeDisabled();
  });

  it("pista descartada fica riscada — marca, não só cor (AC-2)", () => {
    abrirDossie(/^Investigação$/, { investigacao: { pistas: [{ id: "p1", texto: "Pista falsa", estado: "aberta" }] } });
    fireEvent.click(screen.getByLabelText('Marcar "Pista falsa" como Descartada'));
    expect(screen.getByText("Pista falsa")).toHaveStyle({ textDecoration: "line-through" });
  });

  it("a contagem do cabeçalho mostra abertas, não o total", () => {
    abrirDossie(/^Investigação$/, {
      investigacao: { pistas: [
        { id: "a", texto: "1", estado: "aberta" },
        { id: "b", texto: "2", estado: "descartada" },
        { id: "c", texto: "3", estado: "confirmada" },
      ] },
    });
    expect(screen.getByText("1 aberta · 3 no total")).toBeInTheDocument();
  });

  it("somente-leitura não oferece como escrever (AC-9)", () => {
    abrirDossie(/^Investigação$/, { investigacao: { pistas: [{ id: "p1", texto: "Visível", estado: "aberta" }] } }, { readOnly: true });
    expect(screen.getByText("Visível")).toBeInTheDocument();
    expect(screen.queryByLabelText("Registrar pista")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Remover/)).not.toBeInTheDocument();
  });
});

describe("Interlúdio na tela", () => {
  it("mostra a regra da cena vinda do livro", () => {
    abrirDossie(/^Interlúdio$/);
    expect(screen.getByText(REGRA_DA_CENA.descricao)).toBeInTheDocument();
  });

  /* O nome da ação aparece no botão E no histórico, então o botão se identifica
   * pelo `aria-label`; a descrição é única e vale como prova de que o texto vem
   * do JSON. */
  it("lista as sete ações com o texto do JSON", () => {
    abrirDossie(/^Interlúdio$/);
    for (const a of ACOES_INTERLUDIO) {
      expect(screen.getByLabelText(a.nome)).toBeInTheDocument();
      expect(screen.getByText(a.descricao)).toBeInTheDocument();
    }
  });

  it("cabem DUAS ações — a regra que a spec 0040 tinha errado (AC-5)", () => {
    abrirDossie(/^Interlúdio$/);
    fireEvent.click(screen.getByLabelText("Dormir"));
    fireEvent.click(screen.getByLabelText("Ler"));
    expect(screen.getByLabelText("Dormir (escolhida)")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Ler (escolhida)")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(`2 de ${MAX_ACOES}`)).toBeInTheDocument();
  });

  it("a terceira é recusada, com o motivo do livro", () => {
    abrirDossie(/^Interlúdio$/);
    fireEvent.click(screen.getByLabelText("Dormir"));
    fireEvent.click(screen.getByLabelText("Ler"));
    fireEvent.click(screen.getByLabelText("Exercitar-se"));
    expect(screen.getByLabelText("Exercitar-se")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/permite até 2 ações/i)).toBeInTheDocument();
  });

  it("clicar de novo desmarca, liberando a vaga", () => {
    abrirDossie(/^Interlúdio$/);
    fireEvent.click(screen.getByLabelText("Dormir"));
    fireEvent.click(screen.getByLabelText("Dormir (escolhida)"));
    expect(screen.getByLabelText("Dormir")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(`0 de ${MAX_ACOES}`)).toBeInTheDocument();
  });

  it("sem ação escolhida não dá para registrar (AC-5)", () => {
    abrirDossie(/^Interlúdio$/);
    expect(screen.getByLabelText("Registrar interlúdio")).toBeDisabled();
  });

  it("a condição do descanso só aparece se dormir ou relaxar", () => {
    abrirDossie(/^Interlúdio$/);
    expect(screen.queryByLabelText(/^Confortável/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Dormir"));
    expect(screen.getByLabelText(/^Confortável/)).toBeInTheDocument();
  });

  it("a refeição só aparece se alimentar-se", () => {
    abrirDossie(/^Interlúdio$/);
    expect(screen.queryByLabelText(/^Prato Nutritivo/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Alimentar-se"));
    expect(screen.getByLabelText(/^Prato Nutritivo/)).toBeInTheDocument();
  });

  /* NEX 5% → peTurno = 1 + nexLevel(5) = 1. Dormir normal recupera 1 PV e 1 PE. */
  it("a prévia mostra a conta antes de confirmar", () => {
    abrirDossie(/^Interlúdio$/);
    fireEvent.click(screen.getByLabelText("Dormir"));
    expect(screen.getByText(/limite de PE por rodada \(1\)/)).toBeInTheDocument();
  });

  it("registrar aplica o clamp de verdade e entra no histórico (AC-6, AC-7)", () => {
    // peTurno 1 (NEX 5%), condição luxuosa → 3 PV; com PV 19/20 só entra 1.
    abrirDossie(/^Interlúdio$/, { pv: 19, pvMax: 20, san: 12, sanMax: 12, pe: 4, peMax: 4 });
    fireEvent.click(screen.getByLabelText("Dormir"));
    fireEvent.click(screen.getByLabelText(/^Luxuosa/));
    fireEvent.click(screen.getByLabelText("Registrar interlúdio"));
    expect(screen.getByText("+1 PV")).toBeInTheDocument();
    expect(screen.queryByText("+3 PV")).not.toBeInTheDocument();
  });

  it("sem histórico, diz para que serve", () => {
    abrirDossie(/^Interlúdio$/);
    expect(screen.getByText(/revisar o que o agente fez entre as missões/i)).toBeInTheDocument();
  });

  it("interlúdio sem recuperação aparece marcado como tal", () => {
    abrirDossie(/^Interlúdio$/, { interludios: [{ id: "i1", acoes: ["interludio-ler"], acoesNomes: ["Ler"], pv: 0, san: 0, pe: 0 }] });
    expect(screen.getByText("sem recuperação")).toBeInTheDocument();
  });

  it("as duas ações do registro aparecem juntas no histórico", () => {
    abrirDossie(/^Interlúdio$/, {
      interludios: [{ id: "i1", acoes: ["interludio-dormir", "interludio-alimentar"], acoesNomes: ["Dormir", "Alimentar-se"], condicao: "luxuosa", prato: "nutritivo", pv: 5, pe: 3 }],
    });
    expect(screen.getByText("Dormir + Alimentar-se")).toBeInTheDocument();
    expect(screen.getByText("Luxuosa")).toBeInTheDocument();
    expect(screen.getByText("Prato Nutritivo")).toBeInTheDocument();
  });

  /* ⚠ Interlúdios gravados pela spec 0040 usam `acao` no singular. Eles estão em
   * PRODUÇÃO — se o histórico os ignorasse, o jogador veria o registro dele
   * desaparecer depois de um deploy. */
  it("registro no formato antigo (acao singular) continua aparecendo", () => {
    abrirDossie(/^Interlúdio$/, { interludios: [{ id: "velho", acao: "interludio-dormir", acaoNome: "Dormir", pv: 3 }] });
    // "Dormir" também é o rótulo do botão de ação — o que prova o histórico é a
    // recuperação gravada, que só existe no registro.
    expect(screen.getAllByText("Dormir").length).toBeGreaterThan(1);
    expect(screen.getByText("+3 PV")).toBeInTheDocument();
  });

  it("somente-leitura mostra o histórico e esconde o registro (AC-9)", () => {
    abrirDossie(/^Interlúdio$/, { interludios: [{ id: "i1", acoes: ["interludio-dormir"], acoesNomes: ["Dormir"], pv: 3 }] }, { readOnly: true });
    expect(screen.getByText("+3 PV")).toBeInTheDocument();
    expect(screen.queryByLabelText("Registrar interlúdio")).not.toBeInTheDocument();
  });
});
