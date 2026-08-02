/**
 * Gate do AC-1 e AC-9 da spec 0027 — a IA saiu da aba do mestre e a suíte não incha o App.jsx.
 * Lê o fonte como texto de propósito: o contrato aqui é sobre o que NÃO pode existir no arquivo.
 */
import fs from "fs";
import path from "path";

const SRC = path.join(__dirname, "..", "..", "..");
const read = (rel) => fs.readFileSync(path.join(SRC, rel), "utf8");

describe("AC-1 — a IA saiu do Ajudante do Mestre", () => {
  const app = read("App.jsx");

  test.each([
    ["MasterAssistant", /MasterAssistant/],
    ["prompts da NEXUS-IA", /NEXUS-IA/],
    ["chamada ao Gemini", /callGemini/],
    ["gerador de imagem por IA", /pollinations/i],
    ["SYSTEM_PROMPTS", /SYSTEM_PROMPTS/],
  ])("App.jsx não contém mais %s", (_rotulo, padrao) => {
    expect(app).not.toMatch(padrao);
  });

  test("nenhuma cópia de plano promete Ajudante de IA", () => {
    expect(app).not.toMatch(/Ajudante de IA/);
  });

  test("o roadmap não anuncia o ajudante como recurso de IA", () => {
    expect(read("roadmapData.js")).not.toMatch(/Ajudante do Mestre com IA/);
  });
});

describe("AC-9 — a suíte vive fora do App.jsx", () => {
  const app = read("App.jsx");

  test("a aba master renderiza a MasterSuite", () => {
    expect(app).toMatch(/case\s+"master":\s*return\s*<MasterSuite/);
  });

  test("a MasterSuite é importada de components/MasterSuite", () => {
    expect(app).toMatch(/import\s+MasterSuite\s+from\s+['"]\.\/components\/MasterSuite['"]/);
  });
});
