/* ════════════════════════════════════════════════════════════════════
 *  PAINEL — GATE DE IMPORTS  (regra 0029 · AC-1)
 *  --------------------------------------------------------------------
 *  Nada em `src/features/dashboard/**` fala com o SDK do Firestore direto.
 *  Todo acesso a dados passa por `src/infrastructure/firestore/`. Este é o
 *  tipo de regra que morre em silêncio no primeiro `import { getDocs }`
 *  escrito com pressa — por isso ela vira teste, não comentário.
 * ════════════════════════════════════════════════════════════════════ */
import fs from "fs";
import path from "path";

const DIR = path.join(__dirname, "..");

function arquivosDeCodigo(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : arquivosDeCodigo(p);
    return /\.(js|jsx)$/.test(e.name) ? [p] : [];
  });
}

describe("features/dashboard", () => {
  it("não importa firebase/firestore em lugar nenhum", () => {
    const infratores = arquivosDeCodigo(DIR).filter(p =>
      /from\s+["']firebase\/firestore["']|require\(\s*["']firebase\/firestore["']\s*\)/.test(
        fs.readFileSync(p, "utf8")
      )
    );
    expect(infratores).toEqual([]);
  });

  it("tem arquivos para conferir (o gate não pode passar por diretório vazio)", () => {
    expect(arquivosDeCodigo(DIR).length).toBeGreaterThan(3);
  });
});
