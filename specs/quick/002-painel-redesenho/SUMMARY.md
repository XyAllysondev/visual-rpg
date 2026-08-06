---
name: quick-summary-002-painel-redesenho
description: Resumo da quick task 002 concluída (redesenho visual do Painel).
alwaysApply: false
---

# Summary — 002: Redesenho visual do Painel

**Concluída:** 2026-08-05 · **Resultado:** ✅

- **Feito:** a tela `dashboard` saiu de dentro do `App.jsx` e virou `src/components/Painel/`.
  Ganhou hero atmosférico (aurora à deriva, grão, brasas, varredura de luz), faixa "continuar
  de onde parou", bloco "precisa de você", números com contagem animada + medidor de cota,
  campanhas com capa e zoom, e o preparo do mundo com anel de progresso — tudo com entrada
  escalonada e desligado por `prefers-reduced-motion`.
- **Arquivos:** `src/components/Painel/index.jsx` (novo) ·
  `src/components/Painel/painelStyles.jsx` (novo) ·
  `src/components/Painel/__tests__/painel-render.test.js` (novo) ·
  `src/App.jsx` (−196 linhas: a função `Dashboard` e o import órfão de `DossierCard`).
- **Gate:** `CI=true npx craco test --watchAll=false --testPathPattern Painel` → **16/16** ·
  suíte completa **2133 verdes** (eram 2117) · `npx craco build` compilou sem nenhum aviso
  nos arquivos novos.
- **Decisão relevante?** Não — é apresentação. A única escolha que merece registro está no
  `TASK.md`: o Painel passa a ser **exceção** à régua `nx-*` de 2026-08-02, a pedido do dono,
  e as outras telas continuam como estão.
- **Dados novos lidos pela tela:** `worldMapsRepo.contarMapas` (contagem única) e
  `worldsRepo.watchWorldsByOwner` (listener, desligado no unmount — tem teste).
- **STATE atualizado?** Sim.

## Pendência herdada (não é desta task)

`src/domain/__tests__/creature.test.js:31` falha desde antes: o teste ainda cobra o quirk
legado (`hpCurrent: 0` lido como PV cheio) que o `currentHp` **conserta de propósito** hoje —
o comentário no `src/domain/creature.js` diz que o conserto era escopo daquela spec. É o
teste que ficou velho, não o código. Precisa de uma decisão do dono da spec para ser
atualizado; não foi tocado aqui.
