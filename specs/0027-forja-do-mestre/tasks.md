---
name: tasks-forja-do-mestre
description: Quebra em tarefas atômicas da Fase 1 da Forja do Mestre (remoção da IA, hub, mundos, wiki, painel, mundo demo), com o gate executável de cada uma.
alwaysApply: false
---

# Tasks — Forja do Mestre · Fase 1 (Fundação)

**Gate executável do conjunto:**
```bash
cd nexus-rpg && npx craco test --watchAll=false --testPathPattern=MasterSuite
npx craco build
```

`[P]` = paralelizável (delegável a subagente).

## Bloco A — Remoção da IA (AC-1, AC-9)

- [x] **A1.** Remover o bloco `MASTER AI ASSISTANT` de `src/App.jsx` (comentário, `RPG_ONLY_RULE`,
      `SYSTEM_PROMPTS`, `callGemini`, `generateSceneImage`, `MasterAssistant`) — 577 linhas.
- [x] **A2.** Remover o import órfão de `TEXTO_IA` em `src/App.jsx` (a constante segue viva em
      `components/LicencaOP.jsx`, usada pela ficha OP).
- [x] **A3.** Trocar `case "master"` por `<MasterSuite system={activeSystem} uid={…} />` e importar
      de `./components/MasterSuite`.
- [x] **A4.** Atualizar cópia de produto: card do dashboard, 3 planos, `roadmapData.js`.
- [x] **A5.** Gate `__tests__/forja-sem-ia.test.js` — 9 testes, verde.

## Bloco B — Lógica pura `model/` (AC-3, AC-4, AC-5, AC-6, AC-7) `[P]`

- [x] **B1.** `model/entityTypes.js` — os 11 tipos (id, rótulo PT, plural, cor, dica) + `getEntityType`.
- [x] **B2.** `model/entityFilters.js` — `normalize`, `searchEntities`, `filterEntities`,
      `sortEntities`, `countByType`, `collectTags`.
- [x] **B3.** `model/connections.js` — presets de relação com inverso e categoria, `makeConnection`,
      `isDuplicate`, `connectionsOf`, `orphanEntities`, `graphData`, `graphInsights`.
- [x] **B4.** `model/dashboardStats.js` — `worldStats`, `firstSteps`.
- [x] **B5.** `model/demoWorld.js` — seed autoral (≥14 entidades, ≥6 tipos, ≥10 conexões).
- [x] **B6.** Testes de B1–B5 em `__tests__/`.

## Bloco C — Persistência `worldsStore.js` (AC-2, AC-3, AC-5, AC-7) `[P]`

- [x] **C1.** CRUD de mundo + `useWorlds` (onSnapshot) + `useActiveWorld` (localStorage por uid).
- [x] **C2.** CRUD de entidade com `nameLower` derivado; apagar entidade limpa as conexões dela.
- [x] **C3.** CRUD de conexão e de pasta (apagar pasta devolve as entidades à raiz).
- [x] **C4.** `seedDemoWorld` em `writeBatch`, mapeando ids locais do seed → ids do Firestore.
- [x] **C5.** Teste de contrato com `firebase/firestore` mockado.

## Bloco D — Interface (AC-2, AC-3, AC-4, AC-6, AC-8)

- [x] **D1.** Direção de UI/UX (wireframes, tokens, ícones dos 11 tipos, estados) `[P]`.
- [x] **D2.** `index.jsx` — casca: seletor de mundo, navegação entre ferramentas, estado vazio,
      `React.lazy` por ferramenta.
- [x] **D3.** `Dashboard/` — contagens, recentes, primeiros passos, atalhos.
- [x] **D4.** `Wiki/` — grade/lista, filtros por tipo e tag, busca, ordenação, pastas.
- [x] **D5.** `Wiki/EntityPage` — descrição, atributos, conexões, editar/apagar.
- [x] **D6.** `Wiki/EntityForm` — modal de criar/editar (tipo, nome, descrição, tags, atributos).
- [x] **D7.** Ferramentas das fases 2–8 aparecem na navegação como **Em breve** (sem entrar).

## Bloco E — Qualidade (AC-8)

- [x] **E1.** Auditoria de acessibilidade (teclado, foco, contraste, alvo ≥44px) `[P]`.
- [x] **E2.** Revisão React (hooks, re-render, chaves de lista, cleanup de listener) `[P]`.
- [x] **E3.** `npx craco build` verde e chunk da suíte separado.
- [ ] **E4.** Verificação manual do fluxo AC-2 → AC-7 com o app rodando.
- [x] **E5.** Atualizar `docs/STATE.md`.

## Resultado da Fase 1

**Gate: 36 suítes / 485 testes PASS · `npx craco build` → Compiled.**

- 27 arquivos em `src/components/MasterSuite/`; `App.jsx` encolheu de 12.586 para 12.014 linhas.
- Testes da suíte: 161 (91 de lógica pura, 36 de contrato do store, 25 de renderização, 9 do gate anti-IA).
- **E4 (verificação manual no navegador) segue PENDENTE** — exige login do Andre no app.

### Pendências manuais do Andre
1. `firebase deploy --only firestore:rules` — o bloco `worlds` só vale após o deploy.
2. Índice composto no Firestore: coleção `worlds`, `ownerUid` ASC + `updatedAt` DESC.
