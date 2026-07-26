---
name: tasks-0025-biblioteca-fonte-unica
description: Quebra de tasks da spec 0025. Gate executável ao final.
alwaysApply: false
---

# Tasks — 0025 biblioteca fonte única

> Gate executável: `npm test -- --watchAll=false` + `npm run build` (exit 0).

- [x] T1 (AC-1): App.jsx — importar `rituais-oficiais.json`; trocar `filteredRituais` e o
      render da aba Rituais (custo por círculo 1/3/6/10; descricao via dangerouslySetInnerHTML).
- [x] T2 (AC-2): App.jsx — importar `itens-oficiais.json`; aba Armas agrupada por proficiência
      oficial com dano/crítico/tipo/alcance/categoria/espaços.
- [x] T3 (AC-3): removidos `OP_RITUAIS` (107 linhas) e `OP_ARMAS` (29) — zero referências.
- [x] T4 (AC-4): `__tests__/biblioteca-0025.test.js` (4 testes). Gate: 27 suítes / 317 testes
      PASS + build exit 0 (2026-07-25; warnings pré-existentes em código legado intocado).
- [x] T5: STATE.md atualizado (incl. itens 1/3/4 bloqueados por fonte).
