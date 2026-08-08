---
name: tasks-0040-investigacao-e-interludio
description: Tasks da spec 0040. Puxe junto com a spec 0040 ao mexer nas sub-abas do Dossiê, no livro-razão de interlúdios ou nas pistas do caso.
alwaysApply: false
---

# Tasks — Spec 0040 (Investigação e Interlúdio)

**Gate executável:**
```
npm test -- --runInBand
CI=true npm run build
```
Partida: 112 suítes / 2.621 testes (fim da spec 0039).
Chegada: **113 suítes / 2.666 testes**, build limpo.

Suíte desta spec: `src/components/systems/OrdemParanormal/__tests__/investigacao-interludio.test.js`

---

## T1 · `interludio.js` — domínio puro ✔
`ACOES_INTERLUDIO` é **derivada** de `regras-oficiais.json` (`secao: "interludio"`, menos a entrada
da cena). Nome e descrição não são reescritos — há teste que compara caractere a caractere com o
JSON, e ele reprova se alguém duplicar o texto no componente.

`aplicarInterludio(vitais, pedido)` recebe o número de quem tem o livro e aplica **o clamp**, que é
a única parte da regra de recuperação que temos por escrito (`interludio-geral`). O `registro`
guarda o **efetivamente recuperado**, não o pedido — histórico com número que não aconteceu é
mentira no livro-razão.

> ⚠ **`attrEfetivo`-style trap evitada:** sem máximo conhecido (`pvMax` 0/ausente) a função **não
> recupera nada**. Deixar passar seria a única forma de a recuperação furar o teto.

**AC:** 4, 5, 6, 7.

## T2 · `investigacao.js` — domínio puro ✔
Pista nasce **aberta** — pista que já entra confirmada não foi investigada, foi assumida. Estado
fora dos três conhecidos é ignorado (o Firestore é schemaless e uma string errada não pode virar um
quarto estado). `contarPistas` expõe `abertas` separado do `total`, e `pistasOrdenadas` põe aberta
primeiro e descartada por último — a lista se ordena pelo que ainda exige ação.
**AC:** 2, 3.

## T3 · `InvestigacaoTab.jsx` ✔
Pistas com estado por **marca** (`?` / `✓` / `✕`) e descartada **riscada** — não só cor, mesma
lição do grau de treino da spec 0037. Notas do caso e da campanha em `RichTextEditor`, que já passa
por `sanitizarHtml` na saída (AC-8, herdado da 0036).
**AC:** 2, 3, 8, 9.

## T4 · `InterludioTab.jsx` ✔
A regra da cena e as seis ações vêm do módulo puro. Uma ação por vez (`aria-pressed`, trocar
substitui). Campos de recuperação **sem valor sugerido** — a transcrição diz "(Resumo — valores no
livro.)", e preencher um número "provável" seria inventar regra. Histórico com o mais recente
primeiro; interlúdio sem recuperação aparece como "sem recuperação", porque descansar e não mudar
nada é um resultado.
**AC:** 4, 5, 6, 7, 9.

## T5 · `DossieTab.jsx` — três sub-abas, zero aba nova no topo ✔
> ⚠ **POR QUE NÃO SÃO ABAS DE TOPO.** A barra de abas da ficha **já quebrou com seis**
> (`fix(ficha): abas somem quando são seis`, no histórico do repo). Investigação e Interlúdio no
> topo dariam **oito** e reintroduziriam o defeito. O Andre apontou o caminho ("podem ficar junto lá
> de descrição") e ele é o certo: as três tratam do mesmo objeto. Há teste travando as seis abas.

Sub-abas na gramática de pílula deslizante (`useSlidingPill`), como o resto do app. `DescricaoTab`
**não foi tocada** — virou a sub-aba "Agente".
**AC:** 1.

## T6 · Ligação na ficha ✔
Estado `investigacao` e `interludios`, aditivos no `snapshot` e nas dependências do autosave.
`aplicarInterludio` na ficha só **grava** o que o módulo puro devolveu — não reaplica `Math.min`,
porque uma segunda opinião sobre a mesma regra é como duas réguas divergem.

## T7 · Gate + STATE ✔

---

## Ordem executada
T1 → T2 → T3 → T4 → T5 → T6 → T7. Domínio antes de JSX: o clamp e o estado da pista são as
decisões, o resto é desenho.
