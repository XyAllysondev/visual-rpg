---
name: adr-0010-camada-de-infraestrutura
description: ADR — acesso ao Firestore centralizado em repositórios por agregado em src/infrastructure/. Puxe ao escrever/ler dados, criar coleção nova, ou mexer em App.jsx/hooks.
alwaysApply: false
---

# ADR-0010: Acesso a dados via repositórios por agregado

- **Status:** aceito
- **Data:** 2026-08-02
- **Decisores:** Andre (Andrey Lucas de Andrade Nonardo)

## Contexto

O `CLAUDE.md` declara desde o início a regra de dependência
`interfaces → application → domain ← infrastructure`. O código não a cumpria na fatia de dados:

- `src/App.jsx` (11.454 linhas, 122 componentes) faz **63 chamadas diretas ao Firestore**.
- O SDK `firebase/firestore` é importado em **17 arquivos**.
- Caminhos de coleção são strings literais repetidas — `"campaigns", id, "sharedSheets"`
  aparece 8× em pontos distintos do mesmo arquivo.
- Primitivas do SDK vazam para o estado do React: `App.jsx:11842` guarda `DocumentReference`
  cru num `useRef` e escreve nele mil linhas depois (`:12057`).
- A política de erro é decidida caso a caso na UI: há `catch(_) {}` mudo ao lado de
  `catch(e){console.error(e)}` para operações de importância equivalente.

O ADR-0002 decidiu **qual** backend (Firebase como BaaS, sem servidor próprio). Ele não diz
**como** o código o acessa — e sem essa decisão, "Firebase" virou uma dependência difusa
espalhada pela camada de interface. Trocar de backend, ou até só renomear uma coleção, exigiria
varredura por texto em 17 arquivos.

A spec 0002 (split de App.jsx) já havia identificado o problema e o deixou **explicitamente
fora de escopo** ("Extrair utilitários `fsXxx` para arquivo separado"). A dívida ficou aberta
desde então.

## Decisão

Vamos concentrar todo acesso ao Firestore em **repositórios por agregado** sob
`src/infrastructure/firestore/`, um módulo de funções por agregado, com `paths.js` como único
lugar onde caminho de coleção vira string. `App.jsx` e `src/hooks/` deixam de importar
`firebase/firestore`; a fronteira é defendida por `no-restricted-imports` no ESLint.

Três regras que dão o valor da decisão:

1. **Nenhuma primitiva do SDK atravessa a fronteira** — nem `DocumentReference`, nem
   `QuerySnapshot`, nem `arrayUnion`/`serverTimestamp`. A borda fala em IDs de string e objetos
   planos. É isso que torna o repositório uma porta, e não um atalho de sintaxe.
2. **A política de erro é declarada, não improvisada** — cada operação é `strict` (rejeita, quem
   chama decide) ou `silent` (loga com prefixo e devolve fallback documentado).
3. **O repositório é burro** — caminho, escrita, leitura, política de erro. Regra de negócio
   (limite de campanhas por plano) e política de UI (backoff de reassinatura) ficam na camada
   de aplicação.

### Alternativas descartadas

| Alternativa | Por quê não |
|---|---|
| Manter os `fsXxx` soltos, só movidos para um arquivo | Move o problema de lugar: caminhos e primitivas continuariam cruzando a fronteira |
| `services/` com classes e injeção de dependência | Cerimônia sem ganho num app solo sem segunda implementação prevista; e o nome divergiria da camada que o `CLAUDE.md` já batizou de `infrastructure` |
| Um cliente genérico `firestoreClient.get(path)` | Os caminhos continuariam sendo montados na UI — o acoplamento sobrevive disfarçado |
| Migrar de uma vez também os stores de feature (`WorldMap`, `MasterSuite`, `MapEditor`) | Dobra o diff e mistura risco. Eles **já** encapsulam Firestore por conta própria; convergir vira onda seguinte |
| Adotar TypeScript junto, para tipar os contratos | Decisão independente e muito maior; misturar impediria saber o que quebrou |

## Consequências

- **+** Um único lugar para trocar/instrumentar acesso a dados (cache, retry, telemetria,
  emulador em teste) — antes seriam 17 arquivos.
- **+** Renomear coleção passa a quebrar **teste**, não produção: `paths.js` é a fonte única.
- **+** Fecha o vazamento de `DocumentReference` no estado do React, que era uma bomba silenciosa
  (a ref sobrevive à desmontagem do listener que a produziu).
- **+** A borda fica testável sem SDK: mockar um módulo de funções é trivial perto de mockar
  a árvore `doc/collection/query`.
- **−** Uma indireção a mais: ler "o que essa tela grava" agora exige abrir dois arquivos.
- **−** **Dívida aceita:** `Timestamp` de leitura continua atravessando a fronteira cru. A UI já
  lê `msg.timestamp.seconds` em vários pontos; normalizar seria mudança de comportamento, e a
  spec 0029 é de refatoração a comportamento constante. **Fica para a onda 3** (validação de
  schema nas fronteiras).
- **−** **Dívida aceita:** 7 arquivos legados seguem importando o SDK direto (`WorldMap/*Store`,
  `MasterSuite/worldsStore`, `MapEditor/sync/*`, `assetLib`). Estão listados **nominalmente** no
  `overrides` do ESLint — a exceção é visível e datada, não silenciosa. Onda 1.5.
- **−** As falhas silenciosas herdadas foram **preservadas**, não consertadas (AC-7). O
  repositório agora as torna visíveis e inventariáveis num só lugar — que é a pré-condição para
  consertá-las, mas o conserto é decisão de outra spec.

## Relacionados

- Preenche a lacuna deixada por [spec 0002](../../../specs/0002-split-app-jsx/spec.md)
- Complementa [ADR-0002](./0002-firebase-backend.md) (escolha do backend)
- Spec: [0029-camada-de-infraestrutura](../../../specs/0029-camada-de-infraestrutura/spec.md)
