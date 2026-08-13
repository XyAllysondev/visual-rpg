/**
 * spec 0035 — Dossiê da Ordem.
 * Gate executável do AC-3 (timbre com dado real) e do AC-4 (datilografia sem
 * custo de rede). Os demais ACs são de apresentação e não têm oráculo aqui.
 */
import fs from "fs";
import path from "path";
import { numeroDeProcesso } from "../dossie";
import { SYSTEM_THEMES } from "../../../../themes";

const FONTE_DOSSIE = fs.readFileSync(
  path.join(__dirname, "..", "dossie.jsx"),
  "utf8"
);

/**
 * Fonte sem comentários. Os testes que proíbem uma construção (Math.random,
 * @import) precisam olhar só o CÓDIGO: o arquivo DOCUMENTA por que não usa
 * essas coisas, e uma busca no texto cru acusaria a própria explicação.
 * O segundo replace preserva "://" para não estropiar o data-URI do SVG.
 */
const semComentarios = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CODIGO_DOSSIE = semComentarios(FONTE_DOSSIE);

describe("spec 0035 AC-3 · timbre com dado real", () => {
  it("deriva o número do id da ficha e é DETERMINÍSTICO", () => {
    // O ponto inteiro do AC: mesma ficha, mesmo número, sempre.
    const a = numeroDeProcesso("abc123XYZ");
    const b = numeroDeProcesso("abc123XYZ");
    expect(a).toBe(b);
    expect(a).toBeTruthy();
  });

  it("ids diferentes produzem números diferentes (não é constante decorativa)", () => {
    const ids = ["abc123", "abc124", "zzz999", "0", "ficha-do-andre", "Xy7"];
    const nums = ids.map(numeroDeProcesso);
    expect(new Set(nums).size).toBe(ids.length);
  });

  it("sem id o campo NÃO aparece — devolve null em vez de placeholder", () => {
    expect(numeroDeProcesso(undefined)).toBeNull();
    expect(numeroDeProcesso(null)).toBeNull();
    expect(numeroDeProcesso("")).toBeNull();
  });

  it("respeita o formato de protocolo NNNN-L/AA", () => {
    expect(numeroDeProcesso("qualquer-id")).toMatch(/^\d{4}-[A-Z]\/\d{2}$/);
  });

  it("NÃO usa fonte de valor não-determinística", () => {
    // O AC-3 nomeia Math.random explicitamente; Date.now e contador de render
    // teriam o mesmo defeito — um número que parece dado e não é.
    expect(CODIGO_DOSSIE).not.toMatch(/Math\.random/);
    expect(CODIGO_DOSSIE).not.toMatch(/Date\.now/);
    expect(CODIGO_DOSSIE).not.toMatch(/new Date\(/);
  });

  it("sobrevive a Math.random travado — prova que não o consulta", () => {
    const real = Math.random;
    try {
      Math.random = () => 0.42;
      const a = numeroDeProcesso("ficha-x");
      Math.random = () => 0.99;
      const b = numeroDeProcesso("ficha-x");
      expect(a).toBe(b);
    } finally {
      Math.random = real;
    }
  });
});

describe("spec 0035 AC-4 · datilografia sem custo de rede", () => {
  it("usa uma família já servida pelo registry, sem family= novo", () => {
    // Courier Prime vem do tema do D&D, e o ThemeStyles importa o googleFonts
    // de TODOS os sistemas — não só do ativo. Por isso ela existe no OP de
    // graça. Se alguém remover Courier Prime do D&D, este teste cai junto e
    // avisa antes da ficha aparecer em Courier New do sistema.
    expect(FONTE_DOSSIE).toMatch(/Courier Prime/);
    const importados = Object.values(SYSTEM_THEMES)
      .map((t) => t.googleFonts)
      .join("&");
    expect(importados).toMatch(/Courier\+Prime/);
  });

  it("o dossiê não acrescenta @import nem family= próprio", () => {
    expect(CODIGO_DOSSIE).not.toMatch(/@import/);
    expect(CODIGO_DOSSIE).not.toMatch(/fonts\.googleapis\.com/);
  });
});

describe("spec 0035 AC-5 · paleta única", () => {
  it("o dossiê não crava literal de cor de identidade", () => {
    // Exceção da spec: preto e branco de sombra/realce são LUZ, não
    // identidade. Qualquer outro rgb() cravaria o Ordem Paranormal numa
    // camada que precisa repintar junto com o tema.
    const literais = FONTE_DOSSIE
      // comentários explicam de onde veio o token e podem citar o valor antigo
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g) || [];
    const identidade = literais.filter((l) => {
      const [r, g, b] = l.match(/\d+/g).map(Number);
      const preto = r === 0 && g === 0 && b === 0;
      const branco = r === 255 && g === 255 && b === 255;
      return !preto && !branco;
    });
    expect(identidade).toEqual([]);
  });
});
