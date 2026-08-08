---
name: spec-0038-a-ficha-que-cabe-na-mesa
description: Spec 0038 — o jogador esconde o que não usa, a regra opcional que existe funciona de verdade, e a criação termina com assinatura. Puxe ao mexer em visibilidade de perícia, regras opcionais da ficha de OP ou no passo final do criador de personagem.
alwaysApply: false
---

# Spec 0038 — A ficha que cabe na mesa

> **Fonte da verdade.** Status: **em implementação**
> Origem: Tier A do teardown da RPGpedia (2026-08-08), auditado item por item contra o código.
> Continuação da spec 0037. Teardown em `memory/rpgpedia-ficha-op-referencia.md`.

## O que a auditoria descobriu (e encolheu o escopo)

Dos seis itens do Tier A, **dois já estavam entregues** e ninguém sabia:

- **Matriz de limite de itens, carga, patente e prestígio** já existe em `Tabs/InventarioTab.jsx`
  (`limiteItens`, `patenteForPrestigio`, `cargaMaxima`, `cargaTeto`). O relato anterior de que
  "nosso inventário é um botão vazio" descrevia a **`FullSheet` legada**, que está inalcançável.
- **Carrossel mobile de três seções** já existe (`mobileSec` + `useSlidingPill`), com barra de
  pílula deslizante em vez de setas e pontinhos. Equivalente, não lacuna.

Restaram três, e um deles teve de ser cortado ao meio (abaixo).

## Problema

**1. A ficha mostra 29 perícias e o agente usa oito.** `PERICIAS` tem 29 entradas e todas
aparecem sempre. O jogador rola Luta, Percepção e Ocultismo a noite inteira e percorre a lista
inteira para chegar nelas. Existe filtro por texto e colapso por grupo, mas nada que diga
"esta perícia não é do meu personagem".

**2. Não existe regra opcional na ficha.** `regrasOpcionais` tem **zero ocorrências no projeto**.
Ordem Paranormal tem regras que a mesa liga ou desliga, e a mais consequente delas — jogar sem
Sanidade — muda cinco coisas na nossa ficha (`breach` governa a classe `op-breach`, a camada
`op-outrolado`, os glifos, o selo de SURTO e o sussurro). A mesa que não usa Sanidade convive com
um sinal vital morto e com efeitos de tela disparando por um número que ela não joga.

**3. A criação termina num botão.** O último passo do `CharacterCreator` é "Toques Finais" com um
botão comum. O documento que acabou de nascer é uma ficha de agente da Ordo Realitas — e o gesto
que a fecha devia ser assinar, não clicar em "Criar".

## O corte: três das quatro regras opcionais NÃO entram, e o motivo importa

A referência oferece quatro (NEX & Experiência, Contagem de Munição, Jogando sem Sanidade,
Evolução por Patente). **Só a terceira liga em algo que existe aqui:**

- **Contagem de Munição** — `municao|ammo` tem **zero ocorrências** em `rules.js` e na ficha.
  Não há campo de munição em ataque nenhum. O interruptor não teria o que contar. (A própria
  RPGpedia ainda não a entregou — está no roadmap deles.)
- **NEX & Experiência** e **Evolução por Patente** — trocam o motor de progressão inteiro
  (`progressao/motor.js` + `tabelas.js`, spec 0033). Cada uma é uma spec, não um interruptor.

**Princípio herdado da spec 0036: apagar a promessa é melhor do que fingi-la.** Quatro
interruptores dos quais três não fazem nada é o defeito que aquela spec foi escrita para matar.
Entra **um**, que funciona. Os outros três não aparecem na interface — nem desabilitados, nem
"em breve", porque interruptor cinzento também promete.

## Fora de escopo (vinculante)

- **Criação de agente como dossiê** (papel amassado, datilografia, polaroids, abas de pasta,
  pentagrama como formulário). É redesign de direção de arte com necessidade de assets e fontes
  novas — spec própria, com o Andre decidindo a direção. Só a **assinatura** entra aqui, porque é
  comportamento, não arte.
- **`FullSheet.jsx` legada.** Inalcançável em produção; não tocar.
- **Texto de regra por perícia** (segue fora, herdado da 0037).
- **Contagem de munição, NEX & Experiência, Evolução por Patente** — ver o corte acima.

## Critérios de aceite

### AC-1: O jogador esconde a perícia que não usa
- **Dado** a ficha em Modo de Edição
- **Quando** o jogador aciona o controle de ocultar de uma perícia
- **Então** a perícia sai da lista
- **E** a escolha sobrevive a recarregar a ficha
- **E** em Modo de Jogo o controle de ocultar não aparece

### AC-2: Nada é escondido sem deixar rastro
- **Dado** uma ficha com perícias ocultas
- **Quando** a coluna de perícias é renderizada
- **Então** existe indicação visível de quantas estão ocultas e um caminho para revê-las
- **E** esse caminho aparece **também em Modo de Jogo** — quem herda a ficha de outra pessoa
  precisa poder descobrir que falta coisa sem destravar nada

### AC-3: Perícia oculta continua existindo
- **Dado** uma perícia oculta com treino 10 e "outros" 2
- **Quando** ela é reexibida
- **Então** o treino e o "outros" estão intactos
- **E** enquanto oculta ela nunca deixou de contar para nada que a leia fora da lista
  (Esquiva lê Reflexos; ocultar Reflexos não pode mexer na Esquiva)

### AC-4: Ocultar não é apagar, e o filtro fura o oculto
- **Dado** uma perícia oculta
- **Quando** o jogador digita o nome dela no filtro de texto
- **Então** ela aparece no resultado, marcada como oculta
- **E** dá para reexibi-la a partir dali

### AC-5: Jogando sem Sanidade desliga o sinal vital e os efeitos
- **Dado** a regra opcional "Jogando sem Sanidade" ligada
- **Quando** a ficha é renderizada
- **Então** o sinal vital de Sanidade não aparece
- **E** os cinco efeitos de `breach` ficam desarmados (classe de trepidação, camada do Outro Lado,
  glifos, selo de SURTO e o botão de sussurro), **mesmo com a Sanidade em zero**

### AC-6: A regra opcional persiste e é reversível
- **Dado** a regra ligada e a Sanidade em 3/12
- **Quando** a regra é desligada
- **Então** o sinal vital volta com 3/12 — o número não foi zerado nem recalculado
- **E** o estado da regra sobrevive a recarregar a ficha

### AC-7: Só a regra que funciona aparece
- **Dado** o painel de Configurações da ficha
- **Quando** ele é aberto
- **Então** "Jogando sem Sanidade" está lá
- **E** não existe controle para Contagem de Munição, NEX & Experiência ou Evolução por Patente —
  nem ativo, nem desabilitado

### AC-8: A criação termina numa assinatura
- **Dado** o último passo do criador de personagem com o nome preenchido
- **Quando** o jogador olha o fecho do documento
- **Então** existe uma linha de assinatura, e a assinatura exibida é derivada do nome
- **E** assinar cria o personagem
- **E** sem nome não há assinatura para acionar

### AC-9: A assinatura não inventa nome
- **Dado** um nome de uma palavra ("Kael") e um de várias ("Kael de Souza Nightingale")
- **Quando** a assinatura é derivada
- **Então** a de uma palavra é o próprio nome e a de várias abrevia os sobrenomes
- **E** nome só com espaços não produz assinatura
