---
name: spec
description: Contrato da feature Cartografia Viva (0035) — direção de arte do mapa-múndi no nível do Pathfinder WotR. Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Cartografia Viva (mapa-múndi no nível de Pathfinder: WotR)

> **Fonte da verdade.** Status: **F1, F2 e F3 entregues** (2026-08-05)
> Referência visual: gravação de *Pathfinder: Wrath of the Righteous* fornecida pelo Andre em
> 2026-08-05. A spec 0028 **já declarava o WotR como referência de mecânica** (`0028/spec.md:11`);
> esta spec fecha a distância que sobrou, que é quase toda de **direção de arte**.

## Resumo
O mapa-múndi passa a se parecer com um artefato de cartógrafo: a rota mostra em duas cores o que já
foi andado e o que falta, a fronteira da névoa ganha franja de tinta em vez de desfoque, e o palco
ganha moldura e vinheta.

## O que NÃO muda (leia antes de codar)
A mecânica do mapa-múndi está **completa** — F0 a F7 da spec 0028, 29 suítes e 1.074 testes. Viagem
com velocidade constante em curva, tempo que avança, encontros por `dangerLevel` com peso por
período, névoa em cápsula ao longo do caminho e acampamento **já existem e não se tocam**. Esta spec
veste um motor pronto.

## Critérios de aceite

### AC-1: A rota mostra o percorrido e o que falta
- **Dado** um grupo viajando por uma trilha, com progresso `t` conhecido
- **Quando** a mesa repinta o palco
- **Então** a trilha é desenhada em dois traços: do início até `t` na cor de acento do tema, de `t`
  até o fim na cor normal de trilha — e os dois compartilham **o mesmo ponto de corte**, sem vão

### AC-2: O corte é medido por comprimento de arco, não por índice de vértice
- **Dado** uma polilinha cujos segmentos têm comprimentos diferentes
- **Quando** `partirNoProgresso(pontos, t)` é chamado
- **Então** o comprimento de `percorrido` é `t × comprimentoDaCurva(pontos)`, dentro da tolerância
  de ponto flutuante — e o ponto de corte é **interpolado dentro do segmento**, nunca arredondado
  para o vértice mais próximo

### AC-3: As pontas degeneradas não quebram a rota
- **Dado** `t = 0`, `t = 1`, `t` inválido, polilinha de um ponto só ou lista vazia
- **Quando** `partirNoProgresso` é chamado
- **Então** devolve `{percorrido, restante}` sempre, sem lançar: em `t=0` o percorrido tem o ponto
  inicial e o restante a curva inteira; em `t=1` o inverso

### AC-4: O contorno da névoa é só a casca
- **Dado** uma máscara com uma região revelada
- **Quando** `contornoDaMascara(mascara)` roda
- **Então** devolve **apenas** as células reveladas que têm ao menos um vizinho coberto (4-vizinhança),
  nunca as do miolo — e uma célula na borda do bitmap conta o lado de fora como coberto

### AC-5: A franja é determinística
- **Dado** a mesma máscara e a mesma semente
- **Quando** `tracosDaFranja` roda duas vezes
- **Então** os traços são idênticos por comparação profunda — **não há `Math.random()` no módulo**

### AC-6: Máscara vazia ou cheia não produz franja
- **Dado** uma máscara sem nada revelado, ou com tudo revelado
- **Quando** a franja é pedida
- **Então** devolve lista vazia e nada é desenhado no canvas

### AC-7: A franja sai da máscara do jogador, nunca do molde
- **Dado** a visão do jogador
- **Quando** a franja é calculada
- **Então** a entrada é exclusivamente a máscara que o jogador já possui — se a franja mudasse de
  forma por causa de um segredo do molde, o segredo teria vazado pelo pixel (design 0028 §3)

### AC-8: Movimento reduzido corta tudo que é novo
- **Dado** `prefers-reduced-motion: reduce`
- **Quando** a mesa renderiza
- **Então** nenhum movimento novo desta spec sobrevive — mas a rota bicolor e a franja **continuam
  visíveis** no estado final: são informação, não enfeite. A viagem não é cancelada, só o percurso
  animado (regra já existente em `useViagem.js:186-197`)

### AC-9: O gate legado continua verde sem edição
- **Dado** as 29 suítes e 1.074 testes do WorldMap
- **Quando** `npm test -- --runInBand` roda
- **Então** todas passam **sem que nenhuma tenha sido editada** — suíte legada que precisou mudar é
  sinal de regressão, não de progresso

### AC-11: A cartografia padrão continua vetorial e cabe no bundle
- **Dado** o mapa padrão sem fundo do usuário
- **Quando** o palco renderiza em qualquer escala entre 0,08 e 6
- **Então** a cartografia continua nítida (é SVG, não bitmap) e o arquivo não passa de 60 KB

### AC-12: O cartão de descoberta só mostra o que o jogador pode saber
- **Dado** um nó revelado durante a viagem
- **Quando** o cartão aparece
- **Então** o texto exibido vem **exclusivamente** de `projecaoDoNo` (`mesaStore.js:353`), e o teste
  varre o DOM serializado atrás de cada nome de `CAMPOS_VENENOSOS` (`mesaStore.js:279-283`)

### AC-13: Sem ficha compartilhada, o mestre continua digitando
- **Dado** uma campanha sem ficha compartilhada
- **Quando** o encontro é sorteado
- **Então** o console do mestre mostra o campo de bônus manual, como hoje — a mecânica nova não
  bloqueia mesa nenhuma

### AC-14: A esquiva usa a melhor Furtividade da mesa
- **Dado** fichas com Furtividade +3 e +7
- **Quando** a esquiva roda
- **Então** o bônus usado é +7

### AC-15: A esquiva é determinística
- **Dado** a mesma entrada
- **Quando** `resultadoDaEsquiva` roda duas vezes
- **Então** a saída é idêntica — o módulo **não rola dado** (o motor é `src/domain/dice.js`, AC-9
  da 0028)

## Casos de borda e erros
- Polilinha com ponto inválido no meio → filtrada, como as demais funções de `curves.js` já fazem
- Segmento de comprimento zero → não trava a travessia acumulativa (divisão por zero grampeada)
- `ctx` nulo (jsdom) → no-op, mantendo a guarda que o módulo de névoa já tem
- Máscara sem `bits` ou com dimensões inválidas → contorno vazio, sem lançar

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- **`src/components/MapEditor/`** — intocado, AC-12 da spec 0028 (`git diff` vazio)
- Reescrever a pilha de render (canvas/DOM híbrido fica como está)
- Acervo de mapas gerado por IA

## Rastreabilidade
- Spec de origem: `specs/0028-mapa-mundi/spec.md` e `design.md`
- ADRs relacionados: ADR-0004 (inline style + CSS vars), ADR-0011 (a fronteira garante tipo, nunca
  inventa presença)
