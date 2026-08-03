---
name: tasks-0033
description: Plano de execução da spec 0033 (progressão automática de Ordem Paranormal), com o gate executável.
alwaysApply: false
---

# Tasks — Spec 0033 · Progressão automática de Ordem Paranormal

## Gate executável
```
cd nexus-rpg
CI=true npx craco test --watchAll=false --runInBand
CI=true npx craco build
```
Medido nesta leva: **84 suítes / 2082 testes PASS** (54 deles em `progressao.test.js`), exit 0.

> **Armadilha do runner:** no modo paralelo padrão, 4 suítes (`mesaStore`, `f7-mesa-store`,
> `forja-render`, `editor-store`) falham com `ReferenceError: onSnapshot is not defined` vindo de
> `worldMapStore.js` — refactor em andamento das specs 0030-0032, mais o `resetMocks: true` do
> preset do CRA. Elas passam isoladas e passam com `--runInBand`. Nada disso importa Ordem
> Paranormal. Use `--runInBand` como gate até aquele refactor fechar.

## Tarefas

| # | Task | Cobre AC | Status |
|---|---|---|---|
| 1 | Extrair a camada de texto do PDF oficial e conferir as tabelas 1.2-1.5 página a página | AC-1..AC-9 | feito |
| 2 | `progressao/tabelas.js` — transcrição das tabelas, marcos por classe, pré-requisitos e bônus de origem | AC-1..AC-9, AC-13 | feito |
| 3 | `progressao/motor.js` — `derivar`, `pendencias`, `aplicar`, `planoDeAvanco`, `reverterPara`, `linhaDoTempo` | AC-1..AC-13, AC-15 | feito |
| 4 | `__tests__/progressao.test.js` — 54 casos, um por regra citada na spec | todos | feito |
| 5 | `EvolucaoModal.jsx` — assistente passo a passo, modos avanço e auditoria | AC-14, AC-15 | feito |
| 6 | `Tabs/ProgressaoTab.jsx` — painel de controle (a aba existia e estava **órfã**) | AC-14 | feito |
| 7 | Ligar a aba na ficha, trocar `nexStats` por `derivar`, selo de pendências, i18n pt/en | AC-1, AC-13, AC-14 | feito |
| 8 | Corrigir `rules.js`: `defaultTrainedSet` fiel ao livro, `nexStats` lendo a tabela única, pré-requisitos de Combate Defensivo e Combater com Duas Armas | AC-3, AC-4, AC-7 | feito |

## Divergências encontradas entre o código e o livro (corrigidas)

| Onde | Estava | Livro | Efeito |
|---|---|---|---|
| Grau de Treinamento | 5+INT para as três classes | 2+Int combatente, 5+Int especialista, 3+Int ocultista | combatente e ocultista ganhavam perícias a mais |
| `defaultTrainedSet` | 5 perícias fixas inventadas por classe | escolha do jogador (só o ocultista tem 2 fixas) | ficha nascia com treinos que o livro não dá |
| Combate Defensivo | Pré: INT 1 | Int 2 | pré-requisito frouxo |
| Combater com Duas Armas | Pré: AGI 2 | Agi 3 + treinado em Luta ou Pontaria | pré-requisito frouxo |
| Poderes repetidos | sem checagem | "não pode escolher o mesmo poder mais de uma vez" | achado por TESTE, não por leitura |
| Calejado / Cicatrizes / Dedicação | não afetavam número nenhum | escalam com o NEX | três origens eram só texto decorativo |
| Aba Progressão | existia e **nenhum componente a importava** | — | código morto virou a tela principal da feature |

## Aberto

- [x] **DECIDIDO pelo Andre — "é veterano mesmo".** O grau +10 voltou a se chamar **Veterano**
      (AC-16). Trocado em `TREINO_TIERS`, no `tLabel` da ficha, no `ROTULO_GRAU` do motor, em
      `regras-oficiais.json`, nos textos de Competência/Expert em Perícia e Engenhosidade, e no
      teste `conteudo-0024.test.js`. O AC-3 da spec 0024 fica **substituído** por este.
- [ ] **Validação no navegador (só o Andre faz):** abrir uma ficha OP, aba Progressão, subir um
      degrau pelo assistente e conferir que PV/PE/SAN, habilidades e perícias chegam certos; depois
      "Voltar" um degrau e conferir que a anotação própria continua lá.
- [ ] Catálogo de pré-requisitos: mapeados os que aparecem no texto de `CLASS_POWERS`. Os poderes
      cujo texto do app não cita pré-requisito ficam sem trava — auditar contra o livro numa leva
      futura (o livro tem poderes que o catálogo do app ainda não traz com o texto exato).
- [ ] Textos de "5+INT" em `CLASS_BASE_ABILITIES`, `NEX_LADDER` e `regras-oficiais.json` ainda
      dizem a conta antiga. `CLASS_BASE_ABILITIES` ficou sem consumidor (a aba nova não a usa);
      `NEX_LADDER` aparece no modal ⇅ e `regras-oficiais.json` na Biblioteca do Mestre.
