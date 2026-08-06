---
name: quick-task-004-repaginacao-heraldica
description: Quick task 004 — repaginação visual do app inteiro (pele heráldica "ferro e brasão").
alwaysApply: false
---

# Quick Task — 004-repaginacao-heraldica

> **Estourou o tier trivial de propósito, com o dono ciente.** São 8 arquivos e uma troca de
> paleta que atravessa o app. Não virou spec formal porque é **apresentação**: nenhuma regra
> de negócio, nenhum dado, nenhuma decisão difícil de reverter (a paleta antiga são 30 linhas
> de `themes/index.js` no histórico). Se a próxima mexida encostar em comportamento, sobe.

- **O quê:** trocar a pele do Nexus inteiro — preto forjado, ouro brunido de luz de vela e
  carmesim de brasão, com material (bisel, grão, cantoneiras), ornamento e movimento.
- **Por quê / origem:** pedido do Andre em 2026-08-05: *"mude todo o visual do nexus, o deixe
  impecável, lindo de irreconhecível com animações, deixe-o pique Game of Thrones"*.

## A estratégia (é o que evita 40 arquivos editados)

O app funila tudo por poucas superfícies. Repintar ESSAS repinta todas as telas — inclusive
as que ninguém abriu:

1. **Tokens** (`src/themes/index.js`) — a escala de cor. As CSS vars já eram lidas por todo
   o app, então trocar aqui repinta o que usa `var(--…)`.
2. **Camada heráldica** (`src/themes/heraldica.jsx`, nova) — material, ornamento e movimento
   por SELETOR: `.nx-*`, `.btn-gold`, `input`, `.sidebar-desktop`, barra de rolagem. O JSX
   dessas telas não foi tocado.
3. **Tela** (`components/Painel/painelStyles.jsx`) — o que é só da entrada.

## Passos

- [x] `src/themes/index.js` — paleta nova do OP + escada de superfícies realinhada nos 3 sistemas
- [x] `src/themes/ThemeProvider.jsx` — expõe `--brasao*` (a cor de identidade só existia em JS)
- [x] `src/themes/heraldica.jsx` — a camada global (+ `<HeraldicAmbience/>`, que substituiu o `<Deco/>`)
- [x] `src/App.jsx` — monta a camada no `Shell`, emblema do OP repintado, 174 literais de roxo varridos
- [x] `src/components/Painel/*` — folha reescrita + **esfera armilar** girando atrás do título
- [x] `src/demo/demoMode.js` — capas e acento da demo saem do registry, não de literal
- [x] `scripts/checar-templates-css.mjs` — gate novo (ver abaixo)
- [x] `src/themes/__tests__/systems-accent.test.js` — SPEC_DEVIATION registrada

## Gate

| Gate | Resultado |
|---|---|
| Suíte completa (`--maxWorkers=2`) | **2133 verdes**, 1 falha herdada (`creature.test.js`) |
| `craco build` | compila, zero avisos nos arquivos novos |
| `scripts/checar-templates-css.mjs` | limpo |
| Navegação dirigida (Playwright, 8 telas) | **0 erros de console** em todas |

> **Rode a suíte com `--maxWorkers=2`.** Com o paralelismo padrão, `forja-render`,
> `painel-render` e os testes do WorldMap estouram o timeout de 5 s do `findBy*` e falham
> por carga, não por defeito — deu 9 suítes "vermelhas" que passam sozinhas.

## SPEC_DEVIATION — spec 0017 AC-6

O AC-6 fixava a identidade de card do OP em **roxo arcano**. A repaginação trocou para
**carmesim de brasão**, por decisão do dono. O que o AC-6 realmente protege — *uma fonte só,
nenhuma cor de card escrita à mão, identidade de seleção ≠ chrome interno* — **continua
valendo e testado**. O teste foi reescrito em camadas: primeiro a regra (sobrevive a qualquer
repaginação), depois os literais atuais (para pegar troca acidental).

## O que a spec 0023 pegou e obrigou a consertar

Escurecer só o tema padrão **quebrou dois contratos** — e os testes acusaram antes de virar
tela feia:

1. `surfaces-ladder` AC-2: D&D e Tormenta ficaram 4,6 L* fora da escada. Consertado trazendo
   os dois para a escada nova, **mantendo a matiz de cada um**.
2. `surfaces-ladder` AC-3: no primeiro corte a escala ficou tão escura que `bg`→`card2` caiu
   para **1,20:1** — a hierarquia de superfícies sumia na tela. A escada foi levantada
   (degraus em L* 2,3 / 7,4 / 11,6 / 16,2) e o `muted` do OP clareou para manter AA 4,5:1.

## O furo que quase passou: ouro do OP cravado na camada "global"

Primeira versão da `heraldica.jsx` e da folha do Painel tinha **23 literais** do ouro do
Ordem Paranormal (`rgba(198,164,92,…)`, `#f2ddab`, `#a9863c`…) nos hovers, nas paradas do
degradê da chapa e na sombra dos botões. A camada se dizia global e não era: entrar no D&D
deixaria botões e hovers **dourados no meio de uma paleta vermelha**.

Consertado derivando tudo no `ThemeProvider` — degraus de alfa (`--gold-veil/-wash/-sel/
-cast`) e a liga do metal (`--gold-mid`, `--gold-deep`, `--gold-face`, com helpers de
`escurecer`/`misturar`). Hoje há **zero** literal de cor de tema nas duas folhas.

**Verificado, não presumido:** com o `data-nexus-system` forçado para `dnd` e `tormenta`, a
mesma tela foi fotografada — chapa do botão, medidores, cantoneiras, esfera armilar e
ornamentos viram vermelho de taverna e verde de Arton, sem sobra de ouro.

## Segunda fonte da verdade encontrada: `PLAN_DEFS` (fechada em 2026-08-06)

A tela de **Planos** carregava a própria cópia da cor de cada sistema: D&D **azul**
(`#4a6fa5`) e Tormenta **laranja** (`#d4621e`), contra o vermelho e o verde que o registry
define para os mesmos sistemas em todo o resto do app. A spec 0017 matou esse literal na tela
de SELEÇÃO — o teste da AC-6 cita o `#4a6fa5` nominalmente como "the old hardcoded blue" —
mas a tela de Planos ficou para trás. Como os dois sistemas estão em `available: false`,
ninguém notou até a repaginação deixar gritante.

Consertado apagando a cópia: `PLAN_DEFS` agora faz `.map(p => ({...p, ...getCardAccent(p.systemId)}))`.
**Travado com 3 testes** que leem o fonte e falham se `accent:`/`accentGlow:` ou os literais
antigos voltarem ao bloco. (O guarda acusou o próprio comentário que explicava o conserto na
primeira execução — foi corrigido para ignorar comentários: guarda de fonte olha CÓDIGO.)

**Decisão do Andre (2026-08-06):** os dois **continuam visíveis** — "EM BREVE" na seleção e
como card nos Planos. Servem de vitrine do roadmap. A flag `hidden` segue disponível se um
dia mudar de ideia.

## Emblema do OP na tela de seleção

Ali o emblema é um `.webp` (assets/higgsfield), não o SVG da topbar — continuava roxo depois
da repaginação. Tratado com filtro em `.sys-emblem[data-sys="op"]`, **declarado como remendo**
no CSS: se a arte for reexportada em ouro/carmesim, apagar o bloco.

## Decisões de cor (a regra que impede virar sopa)

- **ouro** = o que responde ao clique e o que titula
- **carmesim** = identidade e atmosfera (aura, selo de mestre, ponto de convocação)
- **aço** = informação fria
- **violeta** = SÓ o Outro Lado (rituais, afinidade). É semântica de jogo — sobreviveu à troca.

## Roxo que ficou de propósito

64 ocorrências de `#a855f7` / `rgba(168,85,247,…)` no **editor de mapas**: é a cor de
**seleção**. Ela precisa destoar da paleta para o elemento selecionado saltar — combinar com
o ouro seria perder a affordance. Nas abas da ficha o mesmo literal era só o *fallback* de
`var(--el-accent, …)` e foi trocado.

## Gate novo: `scripts/checar-templates-css.mjs`

O CSS do projeto vive dentro de template literal JS. Uma crase num **comentário** do CSS
fecha o template e derruba o build com erro apontando a linha errada. Aconteceu **três vezes**
nesta task. O script acha em milissegundos, tem auto-teste nos dois sentidos (com defeito
plantado → falha; limpo → passa) e sai com código 1, pronto para CI.
