/* Testes da spec 0026 — conteúdo do livro v1.4 (poderes paranormais, equipamento
 * geral, modificações). Origem Servidor Público fica em ORIGENS (App.jsx, sem teste). */
import PODERES from "../../../../data/ordemParanormal/poderes-paranormais.json";
import MODS from "../../../../data/ordemParanormal/modificacoes-oficiais.json";
import ITENS from "../../../../data/ordemParanormal/itens-oficiais.json";

describe("poderes-paranormais.json — AC-1", () => {
  it("tem 22 poderes: 2 gerais + 5 por elemento", () => {
    expect(PODERES).toHaveLength(22);
    const porElemento = PODERES.reduce((acc, p) => {
      acc[p.elemento] = (acc[p.elemento] || 0) + 1;
      return acc;
    }, {});
    expect(porElemento).toEqual({ geral: 2, conhecimento: 5, energia: 5, morte: 5, sangue: 5 });
  });

  it("todo poder tem id/nome/prereq/descricao e ids únicos", () => {
    for (const p of PODERES) {
      expect(p.id).toBeTruthy();
      expect(p.nome).toBeTruthy();
      expect(p.prereq).toBeTruthy();
      expect(p.descricao).toBeTruthy();
      expect(typeof p.afinidade).toBe("string");
    }
    expect(new Set(PODERES.map((p) => p.id)).size).toBe(PODERES.length);
  });
});

describe("modificacoes-oficiais.json — AC-3", () => {
  const APLICACOES = ["armas", "armas_fogo", "municao", "protecao", "acessorio"];

  it("tem 23 modificações em aplicações válidas (5/8/2/4/4)", () => {
    expect(MODS).toHaveLength(23);
    const porAplica = MODS.reduce((acc, m) => {
      expect(APLICACOES).toContain(m.aplica);
      acc[m.aplica] = (acc[m.aplica] || 0) + 1;
      return acc;
    }, {});
    expect(porAplica).toEqual({ armas: 5, armas_fogo: 8, municao: 2, protecao: 4, acessorio: 4 });
  });

  it("toda modificação tem id/nome/efeito e ids únicos", () => {
    for (const m of MODS) {
      expect(m.id).toBeTruthy();
      expect(m.nome).toBeTruthy();
      expect(m.efeito).toBeTruthy();
    }
    expect(new Set(MODS.map((m) => m.id)).size).toBe(MODS.length);
  });
});

describe("itens-oficiais.json — AC-2 (equipamento geral do livro)", () => {
  it("tem 38 itens gerais (17 curados + 21 da tabela 3.8)", () => {
    expect(ITENS.filter((i) => i.tipo === "geral")).toHaveLength(38);
  });

  it("amostras do livro presentes com categoria/espaços", () => {
    const byId = Object.fromEntries(ITENS.map((i) => [i.id, i]));
    expect(byId.granada_fragmentacao).toMatchObject({ tipo: "geral", categoria: "I", espacos: 1 });
    expect(byId.mochila_militar).toMatchObject({ tipo: "geral", espacos: 0 });
    expect(byId.taser.descricao).toMatch(/atordoado/i);
    expect(byId.kit_pericia.categoria).toBe("0");
  });

  it("ids únicos no catálogo inteiro", () => {
    const ids = ITENS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
