---
name: quick-task-002-painel-redesenho
description: Quick task 002 — redesenho visual do Painel (tela dashboard), com animação.
alwaysApply: false
---

# Quick Task — 002-painel-redesenho

> **Trilha leve.** Mudança de APRESENTAÇÃO de uma tela só, sem decisão difícil de reverter e
> sem fronteira de domínio nova. Não virou spec formal por isso — mas ficou perto do teto:
> 4 arquivos e um gate próprio. Se o Painel voltar a crescer (ex.: sessão ao vivo, convites,
> feed da mesa), a próxima mexida sobe de tier.

- **O quê:** trocar a tela `dashboard` por um Painel novo — hero atmosférico animado, faixa
  "continuar de onde parou", bloco "precisa de você", números com contagem animada e cota,
  campanhas com capa e o preparo do mundo com anel de progresso.
- **Por quê / origem:** pedido do Andre em 2026-08-05 — *"melhore visualmente esse painel em
  diversas formas, o deixe irreconhecível, coloque até animação se precisar"*.
- **Passos:**
  - [x] `src/components/Painel/painelStyles.jsx` — folha `px-*` com as animações
  - [x] `src/components/Painel/index.jsx` — a tela, lendo estado real
  - [x] `src/App.jsx` — remover a função `Dashboard` (196 linhas) e apontar as duas rotas
        (`case "dashboard"` e `default`) para `<Painel/>`, agora com `uid` e `campaigns`
  - [x] `src/components/Painel/__tests__/painel-render.test.js` — 16 testes de renderização
- **Gate:** `CI=true npx craco test --watchAll=false --testPathPattern Painel` → 16/16 verdes ·
  `npx craco build` → compila sem nenhum aviso nos arquivos novos.

## Decisões tomadas aqui

- **Nenhum número decorativo.** Todo valor do Painel sai de estado real: props do App (fichas,
  campanhas, sessões, planos) ou repositório (`worldMapsRepo.contarMapas`,
  `worldsRepo.watchWorldsByOwner`). Os quatro passos do preparo são verificáveis um a um; se
  um dado não existe, o bloco não aparece em vez de mostrar zero decorativo.
- **A cota de mesas é a MESMA da tela de Campanhas** (3 como mestre) — não é constante nova.
- **`prefers-reduced-motion` desliga tudo** e mostra a mesma tela parada: nada de conteúdo
  preso em `opacity:0` esperando animação que não vai rodar.
- **Contra a régua `nx-*`.** O redesenho de 2026-08-02 tinha tirado hero, brilho e degradê
  destas telas de propósito. O Painel agora anda na direção oposta — **a pedido do dono**, e
  só ele: `SheetList`, `CampaignList` e as outras seguem no `nx-*`. Não é a gramática nova
  do app, é a exceção da tela de entrada.
