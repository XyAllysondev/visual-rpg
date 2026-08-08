---
name: spec-0037-mostrar-a-conta
description: Spec 0037 — a ficha de OP passa a mostrar a conta, não só o resultado (card de rolagem com o dado que ficou, coluna Dados honesta, banca de modificadores, modo de jogo que protege os números). Puxe ao mexer em rolagem, linha de perícia ou modo de edição da ficha de Ordem Paranormal.
alwaysApply: false
---

# Spec 0037 — Mostrar a conta

> **Fonte da verdade.** Status: **em implementação**
> Origem: exploração completa da ficha de Ordem Paranormal da **RPGpedia** (concorrente assinado
> pelo Andre), 2026-08-08. Prints em `Desktop/Nexus RPG/op-ficha-*.png`; teardown em
> `memory/rpgpedia-ficha-op-referencia.md`.

## Problema

Ordem Paranormal tem uma mecânica de rolagem que **é uma escolha entre dados**: você rola tantos
d20 quanto o valor do atributo e fica com o melhor (com atributo 0, rola 2 e fica com o pior). É a
regra mais característica do sistema — e a nossa ficha a executa corretamente e **não a mostra**.

Hoje o jogador vê `[10 · 13 · 9]` e um total `13`. Os três números têm o mesmo peso visual, e
**qual deles sobreviveu é uma dedução**, não uma informação. Pior: quando há bônus de treino, o
total exibido não é nenhum dos dados — `base.result` é sobrescrito por `base.result + tBonus +
other` em `rollSkill`, e o dado que ficou **é descartado do estado**. Não existe como a interface
mostrar a conta porque a conta não é guardada.

Três consequências na mesa:

1. **O jogador não aprende a regra jogando.** A vantagem de ter atributo 3 em vez de 2 é
   invisível; o que ele vê é "saiu 13".
2. **A coluna chamada "Dados" não mostra dados.** O cabeçalho da tabela de perícias diz
   `Dados` (`i18n/locales/pt.js:114`) e a célula abaixo mostra a sigla do atributo — `AGI`
   (`OrdemParanormalSheet.jsx:643`). O cabeçalho promete uma coisa e a célula entrega outra.
3. **O grau de treino é informado por cor sozinha.** `treinoColor` distingue Destreinado /
   Treinado / Veterano / Expert por matiz (`rules.js:88`), sem redundância — quem não separa
   verde de azul lê a mesma linha para dois graus diferentes.

E há um quarto problema, de classe diferente: a ficha **tem** um Modo de Edição
(`editMode`, `OrdemParanormalSheet.jsx:287`) que a linha de perícia **ignora**. Os dois campos
numéricos e o hexágono de grau aceitam alteração com a ficha travada. A trava existe, o rótulo
promete, e os números que mais importam ficam de fora dela.

## Princípio que rege esta spec

**Guardar a conta é pré-requisito de mostrar a conta.** Nenhum dos itens abaixo é um problema de
CSS: os três primeiros exigem que o estado da rolagem pare de jogar fora o dado que sobreviveu.
Primeiro o dado sobrevive no estado, depois a tela o desenha.

Corolário: **o motor não se duplica.** `rollOP` (`src/domain/dice.js`) continua sendo a única
fonte de rolagem — o AC-9 da spec 0028 proíbe motor paralelo. Esta spec **lê** o `rolls` e o
`result` que ele já devolve; não recalcula nada.

## Fora de escopo (vinculante)

- **Texto de regra por perícia** ("regras na ponta do dedo" do teardown). `regras-oficiais.json`
  tem 33 regras gerais e **nenhuma descrição por perícia** — as ~20 perícias com seus usos
  ("Amortecer Queda", "Equilíbrio", "Escapar"…) são conteúdo novo a parafrasear do livro, e
  conteúdo é spec própria. Nada de inventar texto de regra aqui.
- **Criação de agente como dossiê**, assinatura, abas de pasta suspensa, matriz de limite de
  itens, carrossel mobile, selos de paywall. Tier A e B do teardown.
- **`FullSheet.jsx` legada.** Está inalcançável em produção (só OP é selecionável e OP tem ficha
  própria) — ver o achado de 2026-08-07 no `STATE.md`. Não tocar.
- **Trocar o payload de rolagem do Firestore.** `rollPayload` (`rules.js:556`) escolhe campo por
  campo e alimenta documento persistido; os campos novos vivem no estado local da ficha.

## Decisão de regra que NÃO foi inventada

A banca de modificadores permite somar **dados** ao teste (o "Dados Bônus" da referência). Em OP
isso significa mais d20 no bolo. Mas **atributo 0 é um caso especial invertido** — rola 2d20 e
fica com o *pior*. O que um dado de bônus faz sobre um atributo 0 **não está resolvido no livro
que temos**, e adivinhar mudaria uma regra de personagem inválido para todos.

**Decisão:** dado de bônus só se aplica quando o atributo é maior que 0. Com atributo 0, a regra
do pior-de-dois fica intacta e a banca informa por escrito que o dado de bônus não entrou.
Bônus de **valor** (soma plana) continua valendo nos dois casos. Se o Andre quiser a outra
leitura, é decisão de produto e vira AC novo — não efeito colateral de implementação.

## Critérios de aceite

### AC-1: O dado que ficou sobrevive no estado
- **Dado** um teste de perícia com atributo 3 e treino 5
- **Quando** `rollSkill` dispara
- **Então** o objeto de rolagem carrega `kept` (o valor do d20 que venceu) e `bonus` (a soma plana
  aplicada), e `kept + bonus === result`
- **E** `rolls` continua com os três d20 na ordem rolada

### AC-2: Os dados descartados são visivelmente descartados
- **Dado** uma rolagem de `3d20` que saiu `[10, 13, 9]`
- **Quando** o card de rolagem é renderizado
- **Então** o `13` aparece destacado e o `10` e o `9` aparecem apagados
- **E** o dado destacado é marcado por algo além da cor (não pode ser só matiz)
- **E** com atributo 0 o destaque cai no **menor** dado, com a etiqueta de que ficou o pior

### AC-3: O card mostra a conta quando pedido
- **Dado** um card de rolagem de perícia na tela
- **Quando** o jogador acionar o controle de virar
- **Então** o verso mostra a aritmética termo a termo (dado que ficou, treino, outros,
  modificadores ativos) e o total
- **E** o verso volta para a frente pelo mesmo controle
- **E** o card fecha pelo botão de fechar em qualquer das duas faces

### AC-4: A coluna "Dados" mostra dados
- **Dado** uma perícia cujo atributo vale 3
- **Quando** a linha é renderizada
- **Então** a coluna rotulada `Dados` mostra `3d20`
- **E** com o atributo em 0 mostra `2d20` com a indicação de que fica com o pior
- **E** a sigla do atributo continua legível na linha (não se perde informação)

### AC-5: O grau de treino não depende de cor
- **Dado** as quatro faixas de treino (0 / 5 / 10 / 15)
- **Quando** a linha é renderizada
- **Então** o grau é legível por forma/contagem além da cor, com 0, 1, 2 e 3 marcas
- **E** o rótulo do grau (`Destreinado`/`Treinado`/`Veterano`/`Expert`) segue disponível como
  texto acessível

### AC-6: Modificador nomeado entra na conta e persiste
- **Dado** um modificador `{nome: "Sob efeito de Sangue", dados: 1, valor: 0, ativo: true}`
- **Quando** um teste de perícia com atributo 2 é rolado
- **Então** o bolo tem 3 d20
- **E** o verso do card cita o modificador pelo nome
- **E** o modificador sobrevive a recarregar a ficha
- **E** desativá-lo o remove da conta sem apagá-lo da banca

### AC-7: Atributo 0 ignora dado de bônus, e diz que ignorou
- **Dado** um atributo 0 e um modificador com `dados: 2`
- **Quando** o teste é rolado
- **Então** o bolo tem exatamente 2 d20 e fica com o pior
- **E** a interface informa que o dado de bônus não se aplica a atributo 0

### AC-8: Modo de Jogo protege os números da perícia
- **Dado** a ficha com `editMode` desligado
- **Quando** o jogador tenta alterar o treino ou o "outros" de uma perícia, por campo ou pelo
  hexágono
- **Então** o valor não muda
- **E** rolar a perícia continua funcionando
- **E** com `editMode` ligado os três caminhos de edição voltam a funcionar

### AC-9: O motor de dados não se duplicou
- **Dado** o código-fonte de `systems/OrdemParanormal/`
- **Quando** se procura por geração de número aleatório
- **Então** nenhum arquivo novo desta spec chama `Math.random` para produzir face de dado — todos
  passam por `src/domain/dice.js`

### AC-10: O documento persistido não ganhou campo de rolagem
- **Dado** `rollPayload`
- **Quando** uma rolagem é enviada para a campanha
- **Então** o conjunto de campos do payload é o mesmo de antes desta spec
