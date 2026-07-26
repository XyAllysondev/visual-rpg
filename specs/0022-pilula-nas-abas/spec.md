---
name: spec-pilula-nas-abas
description: Contrato do indicador deslizante (shared-layout) nas barras de abas das fichas, do modal de Ajustes e da secnav mobile do OP — reusa o hook useSlidingPill da 0017.
alwaysApply: true
---

# Spec — Pílula deslizante nas barras de abas

> **Fonte da verdade.** Tier: **pequeno** (feature isolada, sem decisão difícil de reverter —
> puro CSS/React sobre componentes existentes, aditivo). Deriva da 0017 (AC-4), que entregou
> o indicador deslizante na nav principal e deixou as **fichas explicitamente fora de escopo**.
> Esta spec é o escopo novo que autoriza levar o mesmo padrão até lá.

## Resumo

Hoje a nav principal (sidebar desktop + bottom-nav mobile) usa um **único realce que desliza**
até o item ativo. As **barras de abas** ainda trocam seco: cada botão pinta e apaga o próprio
fundo e sublinhado. Esta spec unifica a linguagem de movimento aplicando o mesmo indicador
`shared-layout` nas quatro barras restantes, reusando `useSlidingPill` (`src/hooks/`) e
extraindo a apresentação do realce para um componente único.

## Superfícies em escopo

| # | Superfície | Marcação | Estilo do ativo hoje |
|---|------------|----------|----------------------|
| 1 | Abas da ficha OP | `OrdemParanormalSheet.jsx:978` (`.op-tabs-row`/`.op-tab`) | fundo + `border-bottom` por botão |
| 2 | Secnav mobile do OP | `OrdemParanormalSheet.jsx:733` (`.op-mobile-secnav`) | `border-bottom-color` por botão |
| 3 | Abas da ficha D&D | `DungeonsAndDragonsSheet.jsx:1326` (`.dnd-tabs`/`.dnd-tab`) | fundo + `border-bottom` + `::before` |
| 4 | Abas do modal de Ajustes | `App.jsx` (`["ficha","stream","idioma"]`) | `border-bottom` inline por botão |

## Critérios de aceite

### AC-1: Um único realce desliza em cada barra
- **Dado** qualquer das quatro barras acima
- **Quando** o usuário troca de aba
- **Então** um **único** elemento posicionado absolutamente desliza (via `transform`) da aba
  anterior até a nova; nenhum botão acende/apaga fundo ou sublinhado próprio — a diferença
  que resta no botão é **cor e peso do texto**

### AC-2: O realce acompanha o layout real
- **Dado** uma barra rolável horizontalmente (`.op-tabs-row`, `.dnd-tabs`)
- **Quando** a barra é rolada, a janela redimensionada, o idioma trocado ou a webfont carrega
- **Então** o realce continua alinhado à aba ativa — herdando o `ResizeObserver` +
  `document.fonts.ready` do `useSlidingPill`; barras roláveis posicionam o realce **dentro**
  do container rolável, para que ele role junto com o conteúdo

### AC-3: `prefers-reduced-motion` respeitado
- **Dado** "reduzir movimento" ativo no SO
- **Então** o realce **não desliza** (o bloco `@media` global já zera `transition-duration`),
  e o estado ativo continua legível — cor, peso e sublinhado permanecem

### AC-4: Acessibilidade intacta
- **Dado** as barras que declaram `role="tablist"`/`role="tab"`/`aria-selected`
- **Então** esses atributos permanecem inalterados e o elemento do realce é `aria-hidden="true"`
  (decoração pura, fora da árvore de acessibilidade)

### AC-5: Apresentação do realce em um só lugar
- **Dado** as seis superfícies com indicador (as 4 desta spec + as 2 navs da 0017)
- **Então** todas renderizam o realce pelo **mesmo componente** (`SlidingTabPill`),
  parametrizado por accent/fundo/raio — nenhuma cópia inline do `<div>` posicionado
- **Gate:** `npm test -- SlidingTabPill` verde + nenhuma cópia inline remanescente do realce
  nos componentes (busca por `pill.left` fora de `SlidingTabPill.jsx`)

## Casos de borda

- **Aba ativa fora da barra** (não deve ocorrer aqui, mas o hook cobre): realce some no lugar
  (`opacity:0`), sem saltar para a origem.
- **Barra rolada com aba ativa fora da viewport:** o realce fica na posição correta do conteúdo;
  esta spec **não** implementa scroll-into-view automático (fora de escopo).
- **Peso da fonte muda no ativo** (600→700): a largura das abas muda; o hook mede depois do
  render, então a geometria já reflete o novo peso.

## Fora de escopo (vinculante)

- Rolar a barra automaticamente até a aba ativa (`scrollIntoView`).
- Mudar cores, tipografia, ordem, rótulos ou conteúdo de qualquer aba.
- Gestos de swipe para trocar de aba.
- Qualquer outra tela: mapa, dashboard, login, seleção de sistema.
- Reescrever/decompor `App.jsx` ou as fichas.

## Rastreabilidade

- Origem: `specs/0017-redesign-animado/spec.md` AC-4 (nav principal) — fichas eram fora de escopo lá.
- Reusa: `src/hooks/useSlidingPill.js`, `src/themes/motion.js` (`EASE_HOVER`, `DUR_ENTER`).
- Tasks e gates: `./tasks.md`.
