---
name: tasks
description: Quebra executável da 0035 em tarefas atômicas, com o AC que cada uma cobre e o gate.
alwaysApply: false
---

# Tasks — 0035 Cartografia Viva

**Gate executável (roda ao fim de CADA fase):**
```
npm test -- --runInBand
npm run build
git diff --stat src/components/MapEditor/     # tem que sair VAZIO (AC-12 da 0028)
```

**Placar do gate, por fase.** Baseline da 0028: 29 suítes / 1.074 testes no WorldMap.

| Fim de | Suítes | Testes | Build |
|---|---|---|---|
| F1 + F2 | 100 | 2.399 | `npm run build` exit 0 |
| **F3 — spec fechada** | **103** | **2.460** | `npm run build` exit 0 |

> ⚠️ `CI=true npm run build` (avisos viram erro) reprova por avisos **pré-existentes** em
> `App.jsx`, `DungeonsAndDragonsSheet.jsx`, `OrdemParanormalSheet.jsx`, `Editor/CamadaDeNevoa.jsx`
> e `model/viagem.js`. **Nenhum arquivo desta spec produz aviso** — limpar os outros é trabalho de
> outra spec, e fazê-lo aqui inflaria um diff que já é grande.

## F1 — A rota e a névoa ✅

| # | Task | Arquivo | Cobre AC | Status |
|---|------|---------|----------|--------|
| 1 | `partirNoProgresso(pontos, t)` — corte por comprimento de arco, ponto interpolado | `model/curves.js` (só adição) | AC-2, AC-3 | ✅ |
| 2 | Testes de `partirNoProgresso` | `__tests__/curves.test.js` (adição ao fim) | AC-2, AC-3 | ✅ |
| 3 | Pintar a rota bicolor durante a viagem | `Mesa/animacaoUi.js` | AC-1 | ✅ |
| 4 | Ligar a rota bicolor no palco | `Mesa/TelaDaMesa.jsx` | AC-1, AC-8 | ✅ |
| 5 | `contornoDaMascara` + `tracosDaFranja` (LCG determinístico) | `model/franja.js` (novo) | AC-4, AC-5, AC-6 | ✅ |
| 6 | Suíte da franja | `__tests__/franja.test.js` (novo) | AC-4, AC-5, AC-6, AC-7 | ✅ |
| 7 | Desenhar a franja, com cache por `mascara.revisao` | `Editor/CamadaDeNevoa.jsx` | AC-4, AC-7 | ✅ |
| 8 | Moldura e vinheta do palco | `Mesa/MesaStyles.jsx` | AC-8 | ✅ |
| 9 | Gate da F1 | — | AC-9 | ✅ |

## F2 — Marcadores e chrome ✅

| # | Task | Arquivo | Cobre AC | Status |
|---|------|---------|----------|--------|
| M3 | As seis runas autorais, em traço | `model/marcadores.jsx` (novo) | AC-8 | ✅ |
| M4 | Barra do cartógrafo (lugar · mostrador dia/noite · relógio) | `Mesa/BarraDoCartografo.jsx` (novo) | AC-8 | ✅ |
| M8 | **Cartografia padrão evoluída** — hachura de terreno (relevo, mata, água), rosa dos ventos em traço de tinta, anotações manuscritas nas margens | `model/CartografiaPadrao.jsx` | **AC-11** | ✅ |
| M8b | Suíte da carta evoluída (18 testes) | `__tests__/cartografia-padrao.test.js` (novo) | AC-11 | ✅ |

> **M3/M4:** `ICONES_POR_TIPO` e `iconeDoNo` ficaram INTOCADOS — `editor-modelo.test.js:337-340`
> trava `iconeDoNo({type:"town"})` em `"🏘️"`, e o AC-9 proíbe editar suíte legada. A runa entrou
> como camada nova por cima.
> **M8:** as três hachuras têm gramáticas diferentes de propósito (relevo perpendicular à crista,
> mata inclinada, água horizontal) — igual, o olho leria "textura", não "terreno". O fonte foi de
> 23,7 KB para **39,8 KB**; o teto de 60 KB do AC-11 é medido por `fs.statSync` no gate, não
> conferido a olho.

## F3 — Cartões e perícia ✅

| # | Task | Arquivo | Cobre AC | Status |
|---|------|---------|----------|--------|
| M5 | Casca de pergaminho: papel, título em versalete, corpo serifado, filete duplo, um botão | `Mesa/CartaoDePergaminho.jsx` (novo) | AC-12 | ✅ |
| M5b | Cartão de descoberta (`name` + `description` da projeção) + log "Nova localização descoberta: X" | `Mesa/index.jsx` | AC-12 | ✅ |
| M5c | Restyle do painel de encontro na mesma casca, **comportamento intocado** | `Mesa/PainelDeEncontro.jsx` | AC-12 | ✅ |
| M5d | Entrada do cartão + selo, cortados por `data-anima` e `prefers-reduced-motion` | `Mesa/MesaStyles.jsx` | AC-8 | ✅ |
| M5e | Suíte do cartão (18 testes: veneno no DOM, contraste, casca, painel) | `__tests__/cartao-pergaminho.test.js` (novo) | AC-12 | ✅ |
| M6 | **ADR do acoplamento** mapa-múndi → fichas compartilhadas | `docs/architecture/adr/0012-mapa-mundi-le-fichas-compartilhadas.md` (novo) | AC-13, AC-14 | ✅ |
| M6b | `DT_POR_PERIGO` + `resultadoDaEsquiva` + `melhorFurtividade` — puro, sem dado, sem Firestore | `model/esquiva.js` (novo) | AC-13, AC-14, AC-15 | ✅ |
| M6c | A esquiva roda no sorteio da estrada, ANTES de virar pendência | `Mesa/index.jsx` | AC-13, AC-15 | ✅ |
| M6d | Campo manual só quando NÃO há ficha compartilhada | `Mesa/FilaDeEventos.jsx`, `Mesa/index.jsx` | AC-13 | ✅ |
| M6e | Suíte da esquiva (25 testes, model + console) | `__tests__/esquiva.test.js` (novo) | AC-13, AC-14, AC-15 | ✅ |
| M6f | A casca do app entrega as fichas à mesa, reusando a assinatura que já existia | `features/campanha/CampaignDetail.jsx`, `features/campanha/CampaignMapTab.jsx` | AC-14 | ✅ |

> **M5 — o gate pegou um defeito real.** O título estava mais CLARO que o corpo, e caía a 4,42:1 com
> a tinta da madrugada. Além de reprovar no piso, estava errado de desenho: num impresso o cabeçalho
> é onde a pena carrega mais. O título virou a tinta mais fechada da carta.
> **M5 — a segunda versão do teste de contraste.** A primeira compunha as quatro tintas do dia sobre
> o pergaminho e exigia 4,5:1. Isso é impossível por construção: a tinta da madrugada é ESCURA, e
> escurecer o fundo aproxima-o do texto — nenhum ajuste de cor resolve. A premissa é que estava
> errada: o cartão é `createPortal` para `document.body`, `position:fixed`, z-index 430 — acima da
> vinheta (6) e da barra (7), **fora do palco**, onde `.wmm-tinta` vive. O teste passou a travar a
> PREMISSA (o cartão não é descendente do palco) em vez de medir uma composição que não acontece.
> **M6 — o sucesso da esquiva sai por `return`,** exatamente como "não houve sorteio": sem
> pendência, sem pausa, sem documento. Gravar qualquer marca do encontro que não aconteceu daria ao
> jogador o oráculo que a spec existe para negar.

## Armadilhas a lembrar em cada task
1. `{/* … */}` em posição de **expressão** quebra o build — comente ACIMA do ternário.
2. Crase dentro de template literal de CSS fecha a string.
3. O canvas 2D **não** resolve `var(--…)`; cor de tema entra já resolvida por `getComputedStyle`.
4. `ctx` nulo é **no-op de propósito** (jsdom) — mantenha as guardas.
5. `Math.random()` é proibido em `model/`.
6. Rode o gate com `--runInBand`.
