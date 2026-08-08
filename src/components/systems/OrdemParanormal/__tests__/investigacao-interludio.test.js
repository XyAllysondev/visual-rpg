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
  ACOES_INTERLUDIO, REGRA_DA_CENA, acaoPorId,
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
  it("são as seis ações da transcrição oficial", () => {
    expect(ACOES_INTERLUDIO).toHaveLength(6);
    expect(ACOES_INTERLUDIO.map((a) => a.id)).toEqual([
      "interludio-dormir", "interludio-relaxar", "interludio-alimentar",
      "interludio-ler", "interludio-revisar", "interludio-consertar",
    ]);
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

describe("aplicarInterludio — o clamp é a regra (AC-6)", () => {
  const vitais = { pv: 18, pvMax: 20, san: 5, sanMax: 12, pe: 2, peMax: 4 };

  it("recuperar além do máximo para no máximo", () => {
    const r = aplicarInterludio(vitais, { acao: "interludio-dormir", pv: 9 });
    expect(r.ok).toBe(true);
    expect(r.vitais.pv).toBe(20); // não 27
  });

  it("o registro guarda o que RECUPEROU, não o que foi pedido", () => {
    const r = aplicarInterludio(vitais, { acao: "interludio-dormir", pv: 9 });
    expect(r.registro.pv).toBe(2); // 18 → 20
  });

  it("recupera os três de uma vez, cada um no seu teto", () => {
    const r = aplicarInterludio(vitais, { acao: "interludio-dormir", pv: 1, san: 99, pe: 1 });
    expect(r.vitais).toMatchObject({ pv: 19, san: 12, pe: 3 });
    expect(r.registro).toMatchObject({ pv: 1, san: 7, pe: 1 });
  });

  it("valor negativo, zero e lixo não recuperam nada", () => {
    for (const v of [-5, 0, "abc", null, undefined, NaN]) {
      const r = aplicarInterludio(vitais, { acao: "interludio-relaxar", pv: v });
      expect(r.vitais.pv).toBe(18);
      expect(r.registro.pv).toBe(0);
    }
  });

  it("sem máximo conhecido não recupera — deixar passar seria furar o teto", () => {
    const r = aplicarInterludio({ pv: 5, pvMax: 0 }, { acao: "interludio-dormir", pv: 10 });
    expect(r.vitais.pv).toBe(5);
    expect(r.registro.pv).toBe(0);
  });

  it("sem ação escolhida não aplica nada (AC-5)", () => {
    const r = aplicarInterludio(vitais, { pv: 5 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/escolha uma ação/i);
    expect(r.vitais).toBeUndefined();
  });

  it("ação inexistente é recusada", () => {
    expect(aplicarInterludio(vitais, { acao: "interludio-teletransporte" }).ok).toBe(false);
  });

  it("o registro carrega o nome legível da ação", () => {
    const r = aplicarInterludio(vitais, { acao: "interludio-revisar", nota: "reabrimos o caso" });
    expect(r.registro.acaoNome).toBe(acaoPorId("interludio-revisar").nome);
    expect(r.registro.nota).toBe("reabrimos o caso");
  });

  it("nota gigante é cortada, não gravada inteira", () => {
    const r = aplicarInterludio(vitais, { acao: "interludio-ler", nota: "x".repeat(900) });
    expect(r.registro.nota).toHaveLength(500);
  });

  it("interlúdio sem recuperação é um resultado legítimo", () => {
    const r = aplicarInterludio(vitais, { acao: "interludio-consertar" });
    expect(r.ok).toBe(true);
    expect(registroVazio(r.registro)).toBe(true);
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

  it("lista as seis ações com o texto do JSON", () => {
    abrirDossie(/^Interlúdio$/);
    for (const a of ACOES_INTERLUDIO) {
      expect(screen.getByText(a.nome.toUpperCase(), { exact: false })).toBeInTheDocument();
      expect(screen.getByText(a.descricao)).toBeInTheDocument();
    }
  });

  it("só uma ação fica escolhida — trocar substitui (AC-5)", () => {
    abrirDossie(/^Interlúdio$/);
    fireEvent.click(screen.getByLabelText("Dormir"));
    expect(screen.getByLabelText("Dormir (escolhida)")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByLabelText("Relaxar"));
    expect(screen.getByLabelText("Relaxar (escolhida)")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Dormir")).toHaveAttribute("aria-pressed", "false");
  });

  it("sem ação escolhida não dá para registrar (AC-5)", () => {
    abrirDossie(/^Interlúdio$/);
    expect(screen.getByLabelText("Registrar interlúdio")).toBeDisabled();
  });

  it("registrar aplica o clamp de verdade e entra no histórico (AC-6, AC-7)", () => {
    abrirDossie(/^Interlúdio$/, { pv: 18, pvMax: 20, sanMax: 12, peMax: 4 });
    fireEvent.click(screen.getByLabelText("Dormir"));
    fireEvent.change(screen.getByLabelText("Recuperação de PV"), { target: { value: "9" } });
    fireEvent.click(screen.getByLabelText("Registrar interlúdio"));
    // O histórico guarda o efetivo (2), não o pedido (9).
    expect(screen.getByText("+2 PV")).toBeInTheDocument();
    expect(screen.queryByText("+9 PV")).not.toBeInTheDocument();
  });

  it("sem histórico, diz para que serve", () => {
    abrirDossie(/^Interlúdio$/);
    expect(screen.getByText(/revisar o que o agente fez entre as missões/i)).toBeInTheDocument();
  });

  it("interlúdio sem recuperação aparece marcado como tal", () => {
    abrirDossie(/^Interlúdio$/, { interludios: [{ id: "i1", acao: "interludio-ler", acaoNome: "Ler", pv: 0, san: 0, pe: 0 }] });
    expect(screen.getByText("sem recuperação")).toBeInTheDocument();
  });

  it("somente-leitura mostra o histórico e esconde o registro (AC-9)", () => {
    abrirDossie(/^Interlúdio$/, { interludios: [{ id: "i1", acao: "interludio-dormir", acaoNome: "Dormir", pv: 3 }] }, { readOnly: true });
    expect(screen.getByText("+3 PV")).toBeInTheDocument();
    expect(screen.queryByLabelText("Registrar interlúdio")).not.toBeInTheDocument();
  });
});
