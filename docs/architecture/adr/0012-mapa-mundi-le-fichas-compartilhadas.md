---
name: adr-0012-mapa-mundi-le-fichas-compartilhadas
description: ADR — o mapa-múndi passa a LER as fichas compartilhadas da campanha para tirar o bônus de Furtividade da esquiva do encontro, por uma porta pura. Puxe ao mexer em model/esquiva.js, no console do mestre ou em qualquer leitura de ficha fora da aba de ficha.
alwaysApply: false
---

# ADR-0012: O mapa-múndi lê as fichas compartilhadas, por uma porta pura

- **Status:** aceito
- **Data:** 2026-08-05
- **Decisores:** Andre (Andrey Lucas de Andrade Nonardo)
- **Relação:** aplica o [ADR-0010](./0010-camada-de-infraestrutura.md) (fronteira de dados) e o
  [ADR-0011](./0011-dividas-do-adr-0010-quitadas.md) (a fronteira garante tipo, nunca inventa
  presença). Não substitui nenhum dos dois.

## Contexto

A spec 0035 (M6) pede que a **esquiva do encontro** deixe de depender de um número digitado pelo
mestre. Na referência (*Pathfinder: WotR*) o teste sai sozinho — *"Camellia: Falhou no teste de
Furtividade"* — e só então o encontro acontece.

Isso exige um dado que o mapa-múndi **não possui**: a Furtividade dos personagens. Hoje o módulo
`src/components/WorldMap/` toca exatamente três repositórios — `fogRepo`, `mesaRepo` e
`worldMapsRepo` —, todos do próprio agregado. A Furtividade mora nas **fichas compartilhadas da
campanha**, um agregado vizinho, cujo repositório é `infrastructure/firestore/sharedSheetsRepo.js` e
cujos consumidores até hoje são só `App.jsx` e as telas de `features/campanha/`.

Ou seja: **é acoplamento novo entre agregados.** As forças em jogo:

1. **A fronteira de dados é dura.** O `no-restricted-imports` do `package.json` reprova o build se
   qualquer arquivo fora de `src/infrastructure/` importar `firebase/firestore`, e nenhuma primitiva
   do SDK (`DocumentReference`, `Timestamp`, `WriteBatch`, `serverTimestamp`) pode atravessar. Seja
   qual for a decisão, a leitura passa pelo repositório.
2. **Nem toda mesa tem ficha.** Campanha sem ficha compartilhada é caso comum, não borda: o mestre
   pode estar jogando com fichas de papel. A mecânica nova **não pode travar mesa nenhuma** (AC-13).
3. **O motor de dados é único.** O AC-9 da spec 0028 é literal: a rolagem sai de `src/domain/dice.js`
   e não existe motor paralelo. Um módulo de esquiva que rolasse dado seria o segundo motor.
4. **A regra de perícia mora em Ordem Paranormal.** O total de uma perícia é
   `skillTreino[base] + skillOutros[base]`; o atributo decide **quantos d20** `rollOP` lança, não um
   modificador plano (`OrdemParanormalSheet.jsx:429-435`). Duplicar essa conta no mapa-múndi criaria
   uma segunda fonte da verdade sobre a ficha.

## Decisão

**Vamos deixar o mapa-múndi ler as fichas compartilhadas da campanha, e vamos conter o acoplamento
numa porta pura em vez de espalhá-lo pelo módulo.**

Concretamente:

1. **A leitura continua sendo do repositório.** Quem fala com o Firestore é
   `infrastructure/firestore/sharedSheetsRepo.js`, que já existe e já é observado pela casca do app.
   O mapa-múndi **não ganha repositório novo** e **não importa `firebase/firestore`**.
2. **A conta é pura e mora em `model/esquiva.js`.** `melhorFurtividade(fichas)` recebe uma lista de
   objetos JavaScript comuns e devolve um número, ou `null` quando não há ficha. Não conhece
   Firestore, não conhece React, não tem relógio e não tem sorteio — clone estrutural de
   `model/descoberta.js`, inclusive na regra de **não rolar dado**: `resultadoDaEsquiva` recebe **o
   resultado** de `src/domain/dice.js`.
3. **A dependência aponta para o DADO, não para o agregado.** `model/esquiva.js` não importa nada de
   `features/campanha/` nem de `components/systems/OrdemParanormal/`. Ele lê dois campos de um
   objeto — `skillTreino` e `skillOutros` — e o nome da perícia entra como constante local. Trocar o
   sistema de ficha quebra uma função, não o mapa.
4. **Sem ficha, nada muda.** `melhorFurtividade` devolvendo `null` é a instrução para o console do
   mestre manter o campo de bônus manual exatamente como hoje (AC-13). A ausência é um valor
   legítimo, não um erro — é o ADR-0011 aplicado: **a fronteira garante tipo, nunca inventa
   presença.**

### Alternativas descartadas

- **Copiar a Furtividade para dentro do documento da mesa.** Criaria uma segunda fonte da verdade
  sobre a ficha, que envelheceria em silêncio: o jogador sobe o treino e a esquiva continua rolando
  com o número velho. Pior do que o acoplamento.
- **Criar um repositório novo no mapa-múndi para ler fichas.** Dois repositórios lendo a mesma
  coleção é o começo de duas regras de leitura divergentes. O `sharedSheetsRepo` já faz isso, e faz
  em um lugar só.
- **Deixar como está (mestre digita sempre).** É o que a spec pediu para mudar, e o custo real
  aparece na mesa: o mestre precisa abrir a ficha de outro jogador para descobrir um número que o
  app já tem.
- **Rolar o dado dentro de `esquiva.js`.** Violaria o AC-9 da 0028 de forma direta, e tornaria a
  função não determinística — impossível de travar no gate (AC-15).

## Consequências

- **+** A esquiva sai sozinha, com o número certo, sem o mestre abrir ficha de ninguém.
- **+** O acoplamento tem UMA porta e ela é pura: `melhorFurtividade(fichas) → number|null`. Dá para
  testar sem Firestore, sem React e sem mesa.
- **+** Campanha sem ficha compartilhada continua funcionando idêntica ao que era — o caminho de
  hoje não é um *fallback* degradado, é o mesmo caminho.
- **−** O mapa-múndi passa a depender do **formato** da ficha de Ordem Paranormal
  (`skillTreino`/`skillOutros`). Se um dia o Nexus ganhar um segundo sistema com outra gramática de
  perícia, `melhorFurtividade` precisa de um ramo — e o lugar certo para ele é ali, não espalhado.
- **−** O `context-map.md` ganha uma aresta nova (mapa-múndi → fichas compartilhadas, **somente
  leitura**). Ela precisa continuar sendo só de leitura: o mapa-múndi **nunca** escreve em ficha.

## Como isto é verificado

- `src/components/WorldMap/__tests__/esquiva.test.js` — a tabela de DT, o determinismo (AC-15), a
  escolha do melhor bônus (AC-14) e a ausência de ficha (AC-13).
- O `no-restricted-imports` do `package.json` reprova o build se `model/esquiva.js` — ou qualquer
  outro arquivo fora de `src/infrastructure/` — importar `firebase/firestore`.
