---
name: spec-camada-de-infraestrutura
description: Contrato da camada de infraestrutura (repositórios Firestore). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Camada de infraestrutura (repositórios Firestore)

> **Fonte da verdade.** Status: aprovado (Andre, 2026-08-02 — "quero")

## Resumo

Todo acesso ao Firestore feito de `App.jsx` e de `src/hooks/` passa a atravessar **repositórios
por agregado** em `src/infrastructure/firestore/`. O SDK do Firebase deixa de ser importado
nesses arquivos: eles passam a falar com funções de domínio (`campaignsRepo.leave(...)`) em vez
de primitivas de banco (`updateDoc(doc(db,"campaigns",id), {members: arrayRemove(uid)})`).

Isso materializa a regra de dependência que o `CLAUDE.md` já declara
(`interfaces → application → domain ← infrastructure`) na fatia onde ela estava mais violada.

## Motivação

- `src/App.jsx` tem **63 chamadas diretas ao Firestore** espalhadas por 122 componentes.
- O SDK é importado em **17 arquivos**. Não existe ponto único de acesso a dados.
- Caminhos de coleção são strings repetidas (`"campaigns", id, "sharedSheets"` aparece 8×):
  um erro de digitação só aparece em runtime, e renomear uma coleção é caça ao texto.
- Política de erro é decidida caso a caso no meio da UI — há `catch(_) {}` mudo ao lado de
  `catch(e){console.error(e)}` para operações de importância equivalente.

## Critérios de aceite

### AC-1: Zero import do SDK Firestore em App.jsx e hooks
- **Dado** o código de `src/App.jsx` e de `src/hooks/*.js`
- **Quando** se procura por `from "firebase/firestore"`
- **Então** não há nenhuma ocorrência — o acesso a dados é só via `src/infrastructure/`

### AC-2: Repositório por agregado
- **Dado** os agregados hoje acessados por App.jsx e hooks
- **Quando** se lista `src/infrastructure/firestore/`
- **Então** existe um repositório por agregado — `usersRepo`, `charactersRepo`,
  `campaignsRepo`, `messagesRepo`, `sharedSheetsRepo`, `bestiaryRepo`, `publicSheetsRepo` —
  e cada caminho de coleção é declarado **uma única vez**, em `paths.js`

### AC-3: Nenhuma primitiva do Firestore atravessa a fronteira
- **Dado** qualquer função exportada por um repositório
- **Quando** se inspeciona seu retorno e seus parâmetros
- **Então** não há `DocumentReference`, `QuerySnapshot`, `Timestamp` nem `FieldValue`
  (`arrayUnion`/`arrayRemove`/`serverTimestamp`) — só dados simples, IDs em string e callbacks
  que recebem objetos planos. Assinaturas de `watch*` devolvem a função de cancelamento.

> Fecha um vazamento real: `App.jsx:11842` guarda **`DocumentReference` cru em estado do React**
> (`liveSheetRefsRef`) e escreve com `updateDoc(ref, …)` mil linhas depois.

### AC-4: Política de erro explícita e uniforme
- **Dado** uma escrita que falha no Firestore
- **Quando** ela passa por um repositório
- **Então** o repositório aplica uma das duas políticas **declaradas no JSDoc**:
  `strict` (rejeita a Promise; quem chama decide) ou `silent` (loga com prefixo
  `[<repo>.<op>]` e devolve um fallback documentado). Nenhum `catch` vazio novo.

### AC-5: Fronteira defendida por lint
- **Dado** um arquivo fora de `src/infrastructure/`
- **Quando** ele tenta `import ... from "firebase/firestore"`
- **Então** o ESLint acusa erro (`no-restricted-imports`), com as exceções legadas
  listadas nominalmente e datadas

### AC-6: Repositórios testados isoladamente
- **Dado** `jest.mock('firebase/firestore')`
- **Quando** se roda a suíte dos repositórios
- **Então** cada repositório tem teste verde cobrindo caminho feliz, caminho de erro
  (política do AC-4) e o caminho de coleção usado

### AC-7: Zero regressão de comportamento
- **Dado** qualquer fluxo existente (login, ficha, campanha, chat, bestiário, ficha pública)
- **Quando** o usuário executa o fluxo depois da migração
- **Então** o comportamento é idêntico — **inclusive as falhas silenciosas atuais**, que são
  preservadas como `silent` em vez de "consertadas" nesta spec

## Casos de borda

- `uid`/`campaignId` nulo → repositório retorna cedo com o fallback documentado, sem tocar a rede
- `watch*` chamado e desmontado antes do primeiro snapshot → `unsubscribe` é idempotente
- Erro de permissão na assinatura (rules) → o callback de erro do repositório é chamado; o
  comportamento de retry que hoje vive em `useCampaign` (backoff de 5 s) **continua no hook**,
  não desce para a infraestrutura

## Fora de escopo

- **Migrar os stores de feature existentes** (`WorldMap/*Store.js`, `MasterSuite/worldsStore.js`,
  `MapEditor/sync/*`, `assetLib.js`). Já encapsulam Firestore por conta própria e serão
  convergidos numa spec seguinte (onda 1.5). Entram no AC-5 como exceção **datada**.
- Quebrar `App.jsx` em componentes/pastas — é a **onda 2** (spec própria).
- Validação de schema nas fronteiras — é a **onda 3** (spec própria).
- Trocar Firebase por outro backend, ou introduzir TypeScript.
- Consertar as falhas silenciosas herdadas (AC-7 as preserva de propósito). O inventário delas
  vira insumo da onda 3.

## Rastreabilidade

- Design: [./design.md](./design.md)
- Tasks: [./tasks.md](./tasks.md)
- ADR: [../../docs/architecture/adr/0010-camada-de-infraestrutura.md](../../docs/architecture/adr/0010-camada-de-infraestrutura.md)
- Antecessora: [../0002-split-app-jsx/spec.md](../0002-split-app-jsx/spec.md) — deixou
  "extrair utilitários `fsXxx` para arquivo separado" explicitamente fora de escopo
