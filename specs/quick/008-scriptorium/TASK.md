---
name: quick-task-008-scriptorium
description: Quick task 008 — o rosto do site inteiro. Vocabulário de manuscrito medieval (versal, pauta visível, picotagem, rubricação) na camada global + conversão das telas cruas para a gramática nx-*.
alwaysApply: false
---

# Quick Task — 008-scriptorium

**Data:** 2026-08-10 · **Pedido:** Andre — *"melhore todo o rosto do site, deixe impecável,
isso é um site medieval, explore o pinterest, pegue ideias"*. **Tier:** pequeno (camada
global + 4 telas), apresentação pura, nenhuma regra de jogo.

## Diagnóstico medido (tour headless das 8 telas)

| Tela | Classes da gramática | Estado |
|---|---|---|
| Painel | 150 `px-*` | tratada |
| Ficha OP | dossiê inteiro | tratada (0035+006) |
| Fichas | `nx-head` + pastas | tratada (007) |
| Campanhas | `nx-head` + 3 `nx-stat` | parcial |
| **Planos · Mapas · Trilhas · Roadmap** | **ZERO** | **cruas** |
| Ajudante do Mestre | ZERO | não carrega no demo |

**Cinco de oito telas não têm nenhuma classe da pele.** Vivem de estilo inline, então pegam
só fundo/sidebar/topbar e nada por dentro. Pior: `Mapas` ainda pinta o `<h1>` com
`linear-gradient(135deg,#c9a84c,#e8c96d)` — **os literais da paleta de duas repaginações
atrás**, os mesmos que o AC-5 da 0035 expurgou da ficha.

## Sobre a referência pedida

Pinterest exige login e monta a página por JS — não é alcançável por fetch, e o que dele se
extrai são *moodboards* sem procedência. Fui às fontes primárias (bibliotecas e
universidades) e o vocabulário que voltou é melhor porque é **verificável**:

- **Pauta (ruling) deixada À MOSTRA.** Quase todo manuscrito era pautado antes da escrita e
  *as linhas ficavam como parte do design* — não eram apagadas. É a descoberta que mais rende
  aqui: pauta visível é autêntica, não sujeira.
- **Picotagem (pricking).** Furos de sovela nas margens, para a pauta bater de página a
  página. Já existia na folha de rosto do dossiê (006) por intuição; agora tem nome e vira
  ornamento global.
- **Versal / inicial.** A primeira letra maior — duas linhas de altura — destacada e
  floreada. É a marca registrada da página medieval.
- **Rubricação.** Vermelho (depois azul/verde) para títulos e divisões. Aqui o papel do
  vermelho já é do OURO, que é a nossa cor de título — a regra do projeto se mantém.
- **Iluminação.** Ouro e prata para, por luz refletida, *parecer que há luz dentro da
  página*. É literalmente o que `--gold-face` + o brilho corrido já fazem.

Fontes no fim deste arquivo.

## Escopo

**A · Vocabulário novo na camada global (`themes/heraldica.jsx`)** — pinta toda tela que use
a gramática, inclusive as que ninguém abrir para editar:
- `.nx-h1::first-letter` — **versal** em ouro iluminado.
- `.h-pauta` — pauta de escriba visível (repeating-gradient, sem custo de imagem).
- `.h-picote` — furos de margem como ornamento reusável.
- `.nx-card` — a chapa padrão de card (bisel + cantoneira + sombra), que hoje não existe:
  cada tela inventa a sua.
- `.h-folio` — numeração/assinatura de rodapé de fólio.

**B · Converter as telas cruas para a gramática (`App.jsx`)** — Mapas, Trilhas, Planos,
Roadmap passam a usar `nx-page`/`nx-head`/`nx-eyebrow`/`nx-h1`. Ganham a pele inteira de
graça e **perdem os literais da paleta velha** no caminho.

## Fora de escopo

- **Ajudante do Mestre**: não carrega no modo demo (lacuna da quick 003 — o demo falsifica
  dados, não os repos de mundo). Sem login real não há como conferir na tela, e a regra
  desta casa desde a 006 é que **gate não substitui olhar**. Fica registrado, não entregue.
- Regra de jogo, layout de Mapas (é problema de composição, não de pele — merece quick
  própria), e o resto do JSX das telas além do cabeçalho.

## Gate

```
node scripts/checar-templates-css.mjs
CI=true npx react-scripts test --watchAll=false --maxWorkers=2
```
\+ tour headless das 8 telas, comparando antes/depois.

## Estado

| Passo | Estado |
|---|---|
| A · vocabulário na camada global | ☑ versal · pauta · picotagem · `.nx-card` · fólio |
| B · conversão das telas cruas | ◐ Mapas, Planos e Trilhas ☑ · **Roadmap ☐** |
| Gates + tour | ☑ crase ✓ · 2146 verdes · tour das 8 telas refeito |

## O que a tela pegou (de novo, e feio)

**A picotagem saiu como BARRA PRETA, não como furo.** `radial-gradient(circle at 50% 50%)`
sem raio explícito ajusta o círculo à caixa do tile (9 × 58px) e vira elipse esticada —
quatro retângulos escuros na margem do card. Corrigido para `circle 3.5px at 4.5px 50%`.
Nenhum gate pegaria: o CSS é válido, os testes passam, e só a foto denuncia.

## Também corrigido aqui

O **vinco do papel atravessava a fotografia** do dossiê (achado do teste de aceite da 007).
Foto presa por cantos está SOBRE a folha, não impressa nela — `.dos-foto::after` perdeu o
`background-image`. A moldura interna fica: essa é da folha.

## Fica em aberto

- **Roadmap não foi convertido** — tem canvas animado próprio e 146 estilos inline com cor;
  é reescrita de tela, não troca de cabeçalho. Merece quick própria.
- **Ajudante do Mestre** segue inalcançável no demo (precisa de login real).
- **Mapas continua com 80% de tela vazia** — a pele entrou, a COMPOSIÇÃO não. É problema de
  layout, e trocar cor não resolve tela vazia.
- Os furos ficaram discretos a ponto de quase sumir; se o Andre quiser presença, subir
  `--picote` e o alfa é um toque só.

## Fontes

- [Pricking and Ruling — Dartmouth Ancient Books Lab](https://sites.dartmouth.edu/ancientbooks/2016/05/24/pricking-and-ruling/)
- [Laying out the text — University of Nottingham](https://www.nottingham.ac.uk/manuscriptsandspecialcollections/researchguidance/medievalbooks/layingoutthetext.aspx)
- [Decoration and illumination — University of Nottingham](https://www.nottingham.ac.uk/manuscriptsandspecialcollections/researchguidance/medievalbooks/decorationandillumination.aspx)
- [Rubrication — Britannica](https://www.britannica.com/topic/rubrication)
- [The Architecture of the Medieval Page — medievalbooks.nl](https://medievalbooks.nl/2018/09/07/the-architecture-of-the-medieval-page/)
