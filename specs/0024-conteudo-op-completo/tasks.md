---
name: tasks-0024-conteudo-op-completo
description: Quebra de tasks da spec 0024. Gate executável ao final.
alwaysApply: false
---

# Tasks — 0024 conteúdo OP completo

> Gate executável: `npm test -- --watchAll=false` + `npm run build` (exit 0).

- [x] T1 (AC-1): `rules.js` — adicionar `infiltrador` e `tecnico` a `CLASS_TRAILS.especialista`
      e seus 4 poderes (10/40/65/99) em `TRAIL_ABILITIES`, texto parafraseado.
- [x] T2 (AC-2): `rules.js` — substituir `CLASS_POWERS` pelas listas oficiais do livro base
      (18 Combatente / 15 Especialista / 16 Ocultista), ids estáveis onde já existiam.
- [x] T3 (AC-3): `rules.js` — `TREINO_TIERS[10].label` "Veterano" → "Competente" (+
      `tLabel` em OrdemParanormalSheet.jsx:165 e desc de Engenhosidade; "Veterano" de
      ProgressaoTab/NEX_LADDER é patamar decorativo de NEX, não grau — mantido).
- [x] T4 (AC-4): novo `src/data/ordemParanormal/regras-oficiais.json` (32 entradas em 6 seções).
- [x] T5 (AC-4): `App.jsx` BestiaryTab — aba "Regras" consumindo o JSON, no padrão da aba
      Condições.
- [x] T6 (AC-5): testes em `__tests__/conteudo-0024.test.js` (10 testes). Gate: 26 suítes /
      313 testes PASS + build exit 0 (2026-07-25).
- [x] T7: atualizar `docs/STATE.md` (+ CLAUDE.md/glossário não mudam).
