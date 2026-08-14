---
name: tasks-0037-mostrar-a-conta
description: Tasks da spec 0037. Puxe junto com a spec 0037 ao implementar rolagem, linha de perícia ou modo de edição da ficha de OP.
alwaysApply: false
---

# Tasks — Spec 0037 (Mostrar a conta)

**Gate executável:**
```
npm test -- --runInBand
CI=true npm run build
```
Partida: 108 suítes / 2.518 testes (medida de 2026-08-07 no `STATE.md`).

Suíte desta spec: `src/components/systems/OrdemParanormal/__tests__/mostrar-a-conta.test.js`

---

## T1 · Domínio: a conta vira dado, não desenho — `rules.js`
Funções puras, sem React, testadas antes de qualquer JSX.

- `bonusDeModificadores(mods)` → `{dados, valor, nomes[]}`, somando só os `ativo`.
- `boloDeDados(attrVal, dadosBonus)` → `{n, worst, bonusIgnorado}`.
  Implementa a **decisão de regra** da spec: `attrVal === 0` → `{n:2, worst:true,
  bonusIgnorado: dadosBonus > 0}`; senão `{n: attrVal + dadosBonus, worst:false,
  bonusIgnorado:false}`.
- `termosDaConta({kept, treino, outros, mods})` → lista ordenada `[{rotulo, valor}]` para o verso
  do card. É o **único** lugar que decide a ordem e o rótulo dos termos.
- **AC coberto:** AC-7 (por teste puro), base de AC-1/AC-3/AC-6.
- **Proibido:** chamar `Math.random` aqui (AC-9).

## T2 · `fireRoll` para de jogar fora o dado que ficou — `OrdemParanormalSheet.jsx`
- `rollSkill` passa `kept: base.result` e `bonus: tBonus + other + valorDosMods`, mantendo
  `result: kept + bonus`.
- `rollAttr` passa `kept: res.result` e `bonus: 0` (o teste de atributo puro não soma).
- `rollOP` é chamado com `boloDeDados(...).n`; nada de aritmética de dado solta.
- `rollPayload` **não muda** (AC-10) — os campos novos ficam no estado local.
- **AC coberto:** AC-1, AC-10.

## T3 · Card de rolagem: dado destacado + verso com a conta
- Novo `RollCard.jsx` no diretório de OP, consumido pelo corner card **e** pelo modal de crítico.
- Frente: total + os d20 individuais; o `kept` com marca de forma (moldura/anel) além da cor, os
  descartados com opacidade reduzida e `aria-label` dizendo "descartado".
- Verso: `termosDaConta` termo a termo + total. Controle de virar com `aria-pressed`.
- Fechar disponível nas duas faces.
- **Crítico não vira sozinho** — o modal de crítico já é espetáculo; ele mostra a conta aberta.
- **AC coberto:** AC-2, AC-3.

## T4 · Linha de perícia: coluna "Dados" honesta + pips de grau
- Coluna 3 passa a renderizar `3d20` (de `boloDeDados`), com `2d20` + indicação de pior quando o
  atributo é 0. A sigla do atributo migra para o `title`/segunda linha do nome — **não desaparece**.
- Coluna 1: o hexágono vira 0–3 pips (`TREINO_TIERS`), com o rótulo do grau em `aria-label`.
- `--skill-cols` ajustado em `ordemStyles.jsx` nas três faixas (base, ≤768, ≤480). A regra de
  ≤480 que esconde a coluna 5 continua valendo.
- **AC coberto:** AC-4, AC-5.

## T5 · Banca de modificadores — persistida
- Estado `modificadores` lido de `character.modificadores ?? []`, entrando no mesmo objeto de
  autosave dos outros campos (aditivo; Firestore é schemaless).
- UI compacta no cabeçalho da coluna de perícias: nome, dados, valor, ativar/desativar, remover.
- Alimenta `rollSkill` e `rollAttr` por `bonusDeModificadores`.
- Aviso visível quando há dado de bônus e o atributo do teste é 0.
- **AC coberto:** AC-6, AC-7.

## T6 · Fechar os vazamentos do Modo de Edição
- Os dois `input type="number"` da linha ganham `readOnly={!editMode}`; o hexágono/pips só ciclam
  com `editMode`.
- A banca (T5) é edição de jogo, **não** de estrutura: continua liberada em Modo de Jogo. Está
  escrito no código para ninguém "consertar" isso de volta.
- **AC coberto:** AC-8.

## T7 · Gate + STATE
- Rodar as duas linhas do gate.
- `docs/STATE.md`: o que entrou, a decisão de regra do atributo 0, e o que ficou fora
  (texto de regra por perícia, Tier A/B).

---

## Ordem
T1 → T2 → T3 → T4 → T6 → T5 → T7.
T5 depois de T4 porque a banca mora no cabeçalho da mesma coluna que T4 mexe; T6 antes de T5
porque é o menor e evita conflito na mesma linha de JSX.
