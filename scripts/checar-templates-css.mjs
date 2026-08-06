#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
 *  CHECAR TEMPLATES DE CSS — crase dentro de <style>{`...`}
 *  ------------------------------------------------------------------------
 *  O projeto escreve CSS dentro de template literal JS. Uma crase num
 *  COMENTÁRIO do CSS (o hábito natural de citar uma variável ou um seletor)
 *  fecha o template no meio e derruba o build com um erro de sintaxe que
 *  aponta para a linha errada. Aconteceu TRÊS vezes na repaginação de
 *  2026-08-05, sempre custando um ciclo de build para descobrir.
 *
 *  Uso:  node scripts/checar-templates-css.mjs
 *  Sai com código 1 se achar algo — serve como gate de CI.
 *
 *  COMO ACHA (e por que não é por linha): um arquivo pode ter vários blocos
 *  <style>, e casar o fechamento por regex de linha erra feio — a primeira
 *  versão deste script deu 71 falsos positivos porque perdeu o fim de um
 *  bloco e passou a acusar o arquivo inteiro. Aqui o scanner anda caractere
 *  a caractere a partir da abertura, respeita `${...}` aninhado e a crase
 *  escapada, e para exatamente na crase que fecha.
 * ════════════════════════════════════════════════════════════════════════ */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/* fileURLToPath, e não `.pathname`: o repositório vive em "Área de Trabalho",
   e o pathname da URL vem percent-encoded ("%C3%81rea"), que o fs não abre. */
const RAIZ = fileURLToPath(new URL("../src", import.meta.url));
const CRASE = "`";
const ABERTURA = /<style[^>]*>\s*\{\s*`/g;

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(jsx?|mjs)$/.test(nome) ? [caminho] : [];
  });
}

const linhaDe = (texto, idx) => texto.slice(0, idx).split("\n").length;

/** Devolve o índice logo APÓS a crase que fecha o template aberto em `ini`. */
function fimDoTemplate(txt, ini) {
  let i = ini;
  let profundidade = 0;              // aninhamento de ${ ... }
  while (i < txt.length) {
    const c = txt[i];
    if (c === "\\") { i += 2; continue; }
    if (profundidade === 0 && c === CRASE) return i;
    if (c === "$" && txt[i + 1] === "{") { profundidade++; i += 2; continue; }
    if (profundidade > 0 && c === "}") profundidade--;
    i++;
  }
  return -1;                          // template não fechado: outro problema
}

const achados = [];

for (const caminho of arquivos(RAIZ)) {
  const txt = readFileSync(caminho, "utf8");
  ABERTURA.lastIndex = 0;
  let m;
  while ((m = ABERTURA.exec(txt)) !== null) {
    const ini = m.index + m[0].length;
    const fim = fimDoTemplate(txt, ini);
    if (fim === -1) {
      achados.push({ caminho, linha: linhaDe(txt, ini), texto: "<style> aberto e nunca fechado" });
      break;
    }
    /* O TESTE, e ele é sutil: não adianta procurar "crase sobrando dentro do
       corpo", porque para o parser a crase solta JÁ É o fim do template — o
       corpo termina nela e não sobra nada. O que denuncia é o que vem DEPOIS
       da crase de fechamento: um fim legítimo é sempre `}</style>. Se o que
       segue é texto de CSS, aquela crase não fechava nada, era um acidente.
       (A primeira versão deste script procurava dentro do corpo e passava
       reto pelo próprio caso que ele existe para pegar — pego pelo
       auto-teste no fim deste arquivo.) */
    const depois = txt.slice(fim + 1, fim + 40);
    if (!/^\s*\}/.test(depois)) {
      achados.push({
        caminho, linha: linhaDe(txt, fim),
        texto: txt.split("\n")[linhaDe(txt, fim) - 1].trim().slice(0, 96),
      });
    }
    ABERTURA.lastIndex = fim + 1;
  }
}

if (achados.length === 0) {
  console.log("✓ nenhuma crase solta dentro de template de CSS");
  process.exit(0);
}

console.error(`✗ ${achados.length} crase(s) dentro de template de CSS — isso QUEBRA o build:\n`);
for (const a of achados) {
  console.error(`  ${relative(process.cwd(), a.caminho)}:${a.linha}`);
  console.error(`    ${a.texto}`);
}
console.error("\nTroque a crase por aspas ou remova — o CSS todo vive num template literal.");
process.exit(1);
