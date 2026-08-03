---
name: spec-onda-3-fronteiras-e-quirks
description: Contrato da onda 3 — validação nas fronteiras e conserto dos comportamentos que as ondas 1 e 2 preservaram de propósito. Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Onda 3: fronteiras validadas e quirks resolvidos

> **Fonte da verdade.** Status: aprovado (Andre, 2026-08-02 — "faça tudo e só pare quando
> terminar todas as fases")

## Resumo

As ondas 1, 1.5 e 2 foram **refatorações a comportamento constante**: nada do que estava torto
foi endireitado, para que qualquer regressão fosse atribuível à mudança de estrutura. Cada
comportamento estranho encontrado ficou registrado, com teste que o trava.

Esta onda é o oposto: **ela muda comportamento de propósito**, e cada mudança é um item
numerado com justificativa e teste. Mais a validação de schema nas fronteiras.

## ⚠ Esta é a única onda que altera o que o usuário vê

As ondas anteriores podiam ser validadas com "está tudo igual?". Esta não. Os itens Q1–Q4
abaixo mudam resultado observável. Se algum não for desejado, é só dizer — cada um é
independente e reversível isoladamente.

## Critérios de aceite

### AC-1 (Q1): O teto de campanhas passa a valer para campanhas antigas
- **Dado** um mestre com 3 campanhas ativas do mesmo sistema, **uma delas sem o campo
  `isActive`** (criada antes do campo existir)
- **Quando** ele tenta criar a quarta
- **Então** é barrado

> Hoje ele **não** é: `countActiveByMasterAndSystem` filtra `isActive` na query, e documento
> sem o campo não casa com `where("isActive","==",true)` — some da contagem. A função irmã,
> `countActiveByMemberAndSystem`, filtra em memória e conta certo. Resultado atual: o mesmo
> mestre fura o teto ao CRIAR e é barrado ao ENTRAR pelo código de convite. As duas passam a
> filtrar em memória.

### AC-2 (Q2): O feed de rolagens mostra as mais recentes
- **Dado** uma campanha com mais de 80 rolagens no período
- **Quando** o feed lateral e a gaveta do mestre carregam
- **Então** aparecem as **80 mais recentes**

> Hoje a query é `where("type","==","roll")` + `limit(80)` **sem `orderBy`**: o Firestore
> ordena por ID de documento, e o corte traz 80 rolagens arbitrárias. As telas reordenam em
> memória, o que mascara o problema até a campanha passar de 80 rolagens. Exige **índice
> composto** — criá-lo faz parte da entrega, e sem ele a query falha com link de criação no erro.

### AC-3 (Q3): Criatura caída continua caída
- **Dado** uma criatura do bestiário com `hpCurrent === 0`
- **Quando** a ficha dela é aberta ou o PV é ajustado
- **Então** o PV atual lido é **0**, não o máximo

> Hoje `currentHp` faz `parseInt(hpCurrent ?? hpMax) || hpMax`, e `0` é falsy — a criatura
> abatida "revive" com PV cheio na próxima leitura. É o quirk mais claramente indesejado dos
> quatro.

### AC-4 (Q4): O autosave do mapa não perde alteração em silêncio
- **Dado** que a publicação de elementos falha (rede, permissão, cota)
- **Quando** o autosave roda
- **Então** a baseline **não avança**, a alteração continua pendente e é reenviada; se falhar
  repetidamente, o usuário é avisado

> Hoje `MapEditor/index.jsx` avança `lastPubRef.current` **antes** de publicar, sem `await`, e
> o commit do lote tem o erro engolido. Se a escrita falha, a alteração nunca mais entra num
> diff e **nunca mais é reenviada** — o mestre perde trabalho sem nenhum aviso. O mesmo padrão
> está em `saveSceneMeta`, no upload de imagem e em `createScene` (que devolve o id mesmo com o
> `setDoc` falhando, deixando a mesa apontando para documento inexistente).
> Está registrado no `STATE.md` como "CRÍTICO, pré-existente" desde 2026-07-25, sem conserto
> porque exigia **decidir política de retry**. A política fica definida aqui.

### AC-5: `Timestamp` não atravessa mais a fronteira
- **Dado** qualquer dado que sai de um repositório
- **Então** campos de data são **epoch-ms numérico**, nunca `Timestamp` do SDK

> Dívida registrada no ADR-0010. Hoje a UI lê `msg.timestamp.seconds` e `.toMillis()` em vários
> pontos — todos passam a ler número. É a última primitiva do SDK que ainda vaza.

### AC-6: Fronteiras validadas
- **Dado** um documento vindo do Firestore com campo faltando ou de tipo errado
- **Quando** ele atravessa o repositório
- **Então** é **normalizado ou rejeitado de forma explícita** — nunca chega à UI como
  `undefined` que só quebra três telas depois
- **Dado** o payload trocado com `api/` (pagamento, IA)
- **Então** é validado nas duas pontas

> Sem dependência nova: validação em JavaScript puro, no estilo de `src/domain/`. Adotar uma
> biblioteca de schema é decisão própria e não entra de carona.

### AC-7: Cada mudança de comportamento tem teste que a prova
- Para Q1–Q4, um teste que **falha no comportamento antigo e passa no novo** — e o teste que
  hoje trava o quirk é **atualizado com comentário explicando a virada**, não apagado.

## Fora de escopo

- Adotar biblioteca de validação (zod, yup) — decisão própria, ADR próprio.
- Migrar CRA → Vite; introduzir TypeScript.
- Mexer em visual ou em regra de RPG.
- Os itens que dependem do plano Blaze (Storage, Cloud Functions) — o Andre decidiu subir só ao
  finalizar o projeto (ADR-0009).

## Rastreabilidade

- ADR: [../../docs/architecture/adr/0010-camada-de-infraestrutura.md](../../docs/architecture/adr/0010-camada-de-infraestrutura.md) (dívida do `Timestamp`)
- Origem dos quirks: [../0029-camada-de-infraestrutura/spec.md](../0029-camada-de-infraestrutura/spec.md) AC-7
- Origem do Q4: `docs/STATE.md`, entrada de 2026-07-25 (revisão por agentes)
