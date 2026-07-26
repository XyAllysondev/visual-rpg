---
name: spec-tema-grafite
description: Contrato do clareamento da paleta — de quase-preto para grafite, nos 3 sistemas, com escala única entre telas de entrada e shell logado e contraste AA preservado.
alwaysApply: true
---

# Spec — Tema grafite (clarear a paleta)

> **Fonte da verdade.** Tier: **pequeno** (troca de valores + uma mudança de montagem; sem nova
> fronteira de domínio, reversível por commit). Pedido do Andre em 2026-07-25: *"está muito escuro,
> quero um layout um pouco mais claro"*.

## Resumo

O fundo do app é `#07070d` — quase preto (L\* 2,0). Os cards ficam em `#121220` (L\* 6,0), a apenas
**1,15:1** do fundo: a hierarquia de superfícies existe no código mas o olho não a enxerga. Esta spec
sobe a escala inteira ~2 níveis de luminância (grafite), mantendo o tema escuro e a identidade gótica
de cada sistema, e unifica as **duas escalas divergentes** que existem hoje.

Decisões tomadas com o Andre (fechadas): **grafite sutil** (não é tema claro), **app inteiro**,
**trocando o padrão** (sem toggle claro/escuro, sem persistência de modo).

## Critérios de aceite

### AC-1: Escada de superfícies clareada nos 3 sistemas
- **Dado** o registry `src/themes/index.js`
- **Então** `op`, `dnd` e `tormenta` expõem `bg/surface/card/card2` na escada de luminância
  **L\* ≈ 6,6 / 10,7 / 14,6 / 18,5**, cada sistema preservando a sua tonalidade (op frio-arroxeado,
  dnd quente-marrom, tormenta esverdeado)
- **Gate:** teste `surfaces-ladder` — todo tema expõe as 4 superfícies como hex válido e
  `L*(bg) < L*(surface) < L*(card) < L*(card2)`

### AC-2: Uma escala só no app inteiro
- **Dado** que hoje Login/Seleção/Criador usam o `:root` do bloco `G` (`--bg:#0d0d0d`) e o shell
  logado usa o registry (`--bg:#07070d`)
- **Quando** o usuário navega de qualquer tela de entrada para o app logado
- **Então** `--bg` tem o **mesmo valor** nas duas — o `<style>` do registry passa a ser montado em
  todas as telas, e o `:root` do `G` vira fallback de boot espelhando a escala do sistema padrão
- **Gate:** teste `surfaces-ladder` — cada degrau dos temas `dnd`/`tormenta` fica a ±1,0 L\* do
  degrau correspondente do `op`; verificação visual: `getComputedStyle` de `--bg` no login

### AC-3: Contraste AA preservado
- **Dado** o fundo mais claro
- **Então** `text`, `muted` e `muted2` mantêm **≥ 4,5:1** contra a superfície mais clara (`card2`) em
  todos os sistemas — `muted` sobe de valor porque cairia para ~4,2:1
- **Gate:** teste `surfaces-ladder` calcula a razão de contraste e falha abaixo de 4,5:1

### AC-4: Superfícies hardcoded acompanham
- **Dado** que ~1/3 das cores não passa por token
- **Então** as superfícies **grandes** que hoje são literais escuros acompanham a escala nova —
  modais (incl. o compartilhado de todas as abas OP), topbar, bottom-nav, selects, fundo das duas
  fichas, paleta de fundo por elemento do OP e o editor de mapas
- **Então** nenhuma delas destoa por mais de ~4 L\* do degrau equivalente
- Verificação: checklist visual (não há harness de pixel neste projeto)

### AC-5: Elevação continua legível
- **Dado** o fundo mais claro
- **Então** sombras pretas fortes (`rgba(0,0,0,α≥0.5)`) em superfície grande são reduzidas ~30% e os
  hovers brancos dos helpers compartilhados sobem um passo de alpha — o app não fica chapado nem sujo
- **Então** a separação `bg → card2` **aumenta** de 1,15:1 para ~1,33:1
- Verificação: checklist visual

### AC-6: Zero regressão
- **Dado** as 21 suítes/158 testes e o build atuais
- **Então** seguem verdes, incluindo `systems-accent.test.js` — prova de que a identidade (accents)
  não foi tocada, só as superfícies
- **Gate:** `npm test` + `npm run build`

## Casos de borda

- **`IntroScreen`** retorna sem o bloco de estilo global — quem pinta o primeiro frame é o
  `public/index.html`; precisa acompanhar, senão o app abre preto e clareia depois.
- **`<option>`** é renderizado pelo compositor nativo do SO; `var()` herdado é instável ali — é a
  única superfície que fica com hex literal, deliberadamente.
- **Transição de elemento na ficha OP** parte de `#000` no keyframe; com o fundo mais claro o salto
  fica mais visível.
- **Cor com significado** (elemento OP, cor de sistema, dano/crítico, letterbox de vídeo) não vira
  token: no máximo é recalculada preservando matiz e saturação.

## Fora de escopo (vinculante)

- Tema claro de verdade e qualquer toggle/persistência de modo.
- Os ~500 hardcodes que pintam **traços, ícones, badges e gradientes de acento** — não são superfície.
- `src/tailwind.css` (`--sh-*`): inerte hoje (só `ui/button.jsx`, que ninguém importa).
- Corrigir o accent de D&D/Tormenta usado como **cor de texto** (2,8:1 e 3,0:1 sobre o card novo).
  Gap conhecido e documentado; a regra correta é *accent preenche, accent2 escreve*. As fichas desses
  dois sistemas são placeholder — fica para uma spec própria.
- Reescrever/decompor `App.jsx`.

## Rastreabilidade

- Plano aprovado: `~/.claude/plans/est-muito-escuro-eu-effervescent-forest.md`
- Fontes: `src/themes/index.js`, `src/themes/ThemeProvider.jsx`, `src/App.jsx` (`G`, early-returns),
  `public/index.html`, `public/manifest.json`, `ordemStyles.jsx`, `elementos.jsx`, `modalStyles.js`,
  `DnDSheetStyles.jsx`, `MapEditor/index.jsx`
- Tasks e gates: `./tasks.md`
