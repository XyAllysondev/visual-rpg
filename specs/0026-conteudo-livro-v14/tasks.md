---
name: tasks-0026-conteudo-livro-v14
description: Quebra de tasks da spec 0026. Gate executável ao final.
alwaysApply: false
---

# Tasks — 0026 conteúdo do livro v1.4

> Gate executável: `npm test -- --watchAll=false` + `npm run build` (exit 0).

- [x] T1 (AC-1): `poderes-paranormais.json` (22, parafraseados) ligado no HabilidadesTab
      (chips Gerais/Conhecimento/Energia/Morte/Sangue no lugar do placeholder; add como cópia).
- [x] T2 (AC-2): 21 equipamentos gerais da tabela 3.8 no `itens-oficiais.json` (3 já
      existiam sob municao/protecao) — 38 gerais / 97 itens no total.
- [x] T3 (AC-3): `modificacoes-oficiais.json` (23: 5/8/2/4/4) + seção "Modificações" na aba
      Armas da biblioteca, com a regra +I de categoria.
- [x] T4 (AC-4): origem Servidor Público em `ORIGENS` (25 origens).
- [x] T5 (AC-5): `conteudo-0026.test.js` (6 testes). Gate: 28 suítes / 324 testes PASS +
      build exit 0 (2026-07-25).
- [x] T6: STATE.md.
