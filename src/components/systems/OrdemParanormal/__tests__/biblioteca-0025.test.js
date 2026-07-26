/* Testes da spec 0025 — biblioteca do mestre com fonte única.
 * Garante os campos que a aba Rituais/Armas do BestiaryTab consome dos JSONs oficiais. */
import RITUAIS from "../../../../data/ordemParanormal/rituais-oficiais.json";
import ITENS from "../../../../data/ordemParanormal/itens-oficiais.json";

const ELEMENTOS_VALIDOS = ["conhecimento", "energia", "morte", "sangue", "medo"];
const PROFS_VALIDAS = ["Armas Táticas", "Armas de Fogo", "Armas Pesadas"];

describe("rituais-oficiais.json — AC-1 (campos consumidos pela biblioteca)", () => {
  it("tem 85 rituais com id/nome/elemento/círculo/descrição válidos", () => {
    expect(RITUAIS).toHaveLength(85);
    for (const r of RITUAIS) {
      expect(r.id).toBeTruthy();
      expect(r.nome).toBeTruthy();
      expect(ELEMENTOS_VALIDOS).toContain(r.elemento);
      expect([1, 2, 3, 4]).toContain(r.circulo);
      expect(r.descricao || r.efeito).toBeTruthy();
    }
  });

  it("ids únicos (usados como key/estado de expansão)", () => {
    const ids = RITUAIS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("itens-oficiais.json — AC-2 (armas consumidas pela biblioteca)", () => {
  const armas = ITENS.filter((i) => i.tipo === "arma");

  it("tem 28 armas, todas com proficiência oficial", () => {
    expect(armas).toHaveLength(28);
    for (const a of armas) {
      expect(PROFS_VALIDAS).toContain(a.proficiencia);
    }
  });

  it("toda arma tem os campos exibidos/roláveis", () => {
    for (const a of armas) {
      expect(a.id).toBeTruthy();
      expect(a.nome).toBeTruthy();
      expect(a.dano).toMatch(/^\d*d\d+([+-]\d+)?$|^\d+$/i);
      expect(a.critico).toBeGreaterThanOrEqual(2);
      expect(a.critico).toBeLessThanOrEqual(20);
      expect(a.multiplicador).toBeGreaterThanOrEqual(2);
      expect(a.tipo_dano).toBeTruthy();
      expect(a.tipo_arma).toBeTruthy();
      expect(a.empunhadura).toBeTruthy();
      expect(a.categoria).toBeTruthy();
      expect(a.espacos).toBeGreaterThanOrEqual(1);
    }
  });
});
