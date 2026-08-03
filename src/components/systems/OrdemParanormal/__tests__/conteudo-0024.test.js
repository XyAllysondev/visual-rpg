/* Testes da spec 0024 — conteúdo OP completo (trilhas de Especialista, catálogo
 * oficial de poderes de classe e compêndio de regras). */
import {
  CLASS_TRAILS, TRAIL_ABILITIES, CLASS_POWERS, TREINO_TIERS,
} from "../rules";
import REGRAS_OFICIAIS from "../../../../data/ordemParanormal/regras-oficiais.json";

describe("CLASS_TRAILS — AC-1 (5 trilhas de Especialista do livro base)", () => {
  it("contém as 5 trilhas na ordem do livro", () => {
    expect(CLASS_TRAILS.especialista.map((t) => t.id)).toEqual([
      "atirador_e", "infiltrador", "medico", "negociador", "tecnico",
    ]);
  });

  it("toda trilha de toda classe tem os 4 poderes (10/40/65/99)", () => {
    for (const classe of Object.keys(CLASS_TRAILS)) {
      for (const { id } of CLASS_TRAILS[classe]) {
        const ta = TRAIL_ABILITIES[id];
        expect(ta).toBeDefined();
        for (const nex of [10, 40, 65, 99]) {
          expect(ta[nex]?.name).toBeTruthy();
          expect(ta[nex]?.desc).toBeTruthy();
        }
      }
    }
  });

  it("Infiltrador e Técnico têm os poderes oficiais", () => {
    expect([10, 40, 65, 99].map((n) => TRAIL_ABILITIES.infiltrador[n].name)).toEqual([
      "Ataque Furtivo", "Gatuno", "Assassinar", "Sombra Fugaz",
    ]);
    expect([10, 40, 65, 99].map((n) => TRAIL_ABILITIES.tecnico[n].name)).toEqual([
      "Inventário Otimizado", "Remendão", "Improvisar", "Preparado para Tudo",
    ]);
  });
});

describe("CLASS_POWERS — AC-2 (catálogo fiel ao livro base)", () => {
  it("tem 18/15/16 poderes por classe", () => {
    expect(CLASS_POWERS.combatente).toHaveLength(18);
    expect(CLASS_POWERS.especialista).toHaveLength(15);
    expect(CLASS_POWERS.ocultista).toHaveLength(16);
  });

  it("amostras oficiais presentes; entradas antigas sem lastro removidas", () => {
    const names = (c) => CLASS_POWERS[c].map((p) => p.name);
    expect(names("combatente")).toEqual(expect.arrayContaining([
      "Golpe Pesado", "Saque Rápido", "Tiro Certeiro", "Transcender",
    ]));
    expect(names("especialista")).toEqual(expect.arrayContaining([
      "Hacker", "Kit Aprimorado", "Primeira Impressão",
    ]));
    expect(names("ocultista")).toEqual(expect.arrayContaining([
      "Identificação Paranormal", "Ritual Predileto", "Tatuagem Ritualística",
    ]));
    // Removidas (sem correspondência no livro):
    expect(names("combatente")).not.toContain("Ataque Giratório");
    expect(names("especialista")).not.toContain("Esquiva de Experto");
    expect(names("ocultista")).not.toContain("Wards Protetoras");
  });

  it("todo poder tem id, name, cost e desc", () => {
    for (const classe of Object.keys(CLASS_POWERS)) {
      for (const p of CLASS_POWERS[classe]) {
        expect(p.id).toBeTruthy();
        expect(p.name).toBeTruthy();
        expect(p.cost).toBeTruthy();
        expect(p.desc).toBeTruthy();
      }
    }
  });
});

describe("TREINO_TIERS — AC-3 (nomes oficiais dos graus)", () => {
  /* Spec 0033: o grau +10 voltou a se chamar VETERANO — nome do livro oficial (v1.2), com o PDF
   * em mãos e confirmado pelo Andre. O AC-3 da 0024 tinha adotado "Competente" por fonte
   * secundária. Este teste agora trava o nome certo. */
  it("usa Destreinado/Treinado/Veterano/Expert", () => {
    expect([0, 5, 10, 15].map((k) => TREINO_TIERS[k].label)).toEqual([
      "Destreinado", "Treinado", "Veterano", "Expert",
    ]);
  });
});

describe("regras-oficiais.json — AC-4 (compêndio estrutural)", () => {
  const SECOES = ["testes", "acoes", "manobras", "recursos", "interludio", "rituais"];

  it("toda entrada tem id/secao/nome/descricao e seção válida", () => {
    for (const r of REGRAS_OFICIAIS) {
      expect(r.id).toBeTruthy();
      expect(SECOES).toContain(r.secao);
      expect(r.nome).toBeTruthy();
      expect(r.descricao).toBeTruthy();
    }
  });

  it("todas as 6 seções têm pelo menos uma entrada", () => {
    for (const s of SECOES) {
      expect(REGRAS_OFICIAIS.some((r) => r.secao === s)).toBe(true);
    }
  });

  it("ids são únicos", () => {
    const ids = REGRAS_OFICIAIS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
