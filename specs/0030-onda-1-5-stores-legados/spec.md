---
name: spec-onda-1-5-stores-legados
description: Contrato da onda 1.5 — os 7 stores de feature deixam de falar com o SDK Firestore. Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Onda 1.5: stores legados atrás da fronteira

> **Fonte da verdade.** Status: aprovado (Andre, 2026-08-02 — "faça tudo e só pare quando
> terminar todas as fases")
>
> ⚠ Este arquivo foi **apagado por uma reversão acidental do working tree** durante a execução
> e recriado depois. Dois agentes reportaram "a spec não existe" e trabalharam pelo briefing da
> tarefa + ADR-0010 — o que entregaram está conferido contra os ACs abaixo.

## Resumo

Os **7 stores de feature** que a spec 0029 deixou como exceção nominal no ESLint passam a
consumir repositórios em `src/infrastructure/firestore/`. A lista de exceção do
`no-restricted-imports` fica **vazia**: nenhum arquivo fora de `src/infrastructure/` importa
`firebase/firestore`.

Não é mudança de decisão — é a conclusão do ADR-0010, que já declarou a regra e listou estes
arquivos como dívida datada.

## Estado inicial (medido em 2026-08-02)

| Arquivo | Linhas | Chamadas ao SDK |
|---|---:|---:|
| `WorldMap/worldMapStore.js` | 1125 | 80 |
| `WorldMap/mesaStore.js` | 1474 | 63 |
| `MasterSuite/worldsStore.js` | 621 | 68 |
| `MapEditor/sync/campaignSync2.js` | 177 | 33 |
| `WorldMap/fogStore.js` | 250 | 6 |
| `MapEditor/sync/live.js` | 41 | 7 |
| `MapEditor/assets/assetLib.js` | 52 | 7 |
| **Total** | **3740** | **264** |

## Critérios de aceite

### AC-1: Exceção do ESLint zerada
- **Dado** o bloco `eslintConfig.overrides` do `package.json`
- **Quando** se procura o grupo dos stores legados
- **Então** ele **não existe mais** — restam só `src/infrastructure/**`, `src/firebase.js` e
  `**/__tests__/**`

### AC-2: Um repositório por agregado, nunca por arquivo
- **Então** existem `worldMapsRepo`, `mesaRepo`, `fogRepo`, `worldsRepo`, `assetsRepo` e
  `mapSyncRepo`, cada um com seus caminhos declarados **só** em `paths.js`

### AC-3: A LÓGICA fica no store; só o acesso a dados desce
- **Dado** qualquer algoritmo hoje nos stores — RLE+varint da névoa, redução de imagem em dois
  estágios, dedup por hash SHA-256, diff de elementos, `writeBatch` de semeadura
- **Então** ele continua **no store ou em `src/domain/`**, não no repositório.

> O repositório é burro por decisão (ADR-0010). Um `fogRepo` que soubesse comprimir névoa
> deixaria de ser porta e viraria segunda implementação da feature.

### AC-4: Nenhuma primitiva do SDK atravessa a fronteira
- **Então** não há `DocumentReference`, `QuerySnapshot`, `Timestamp`, `WriteBatch` nem
  FieldValue nas assinaturas. Lotes viram **lista de operações simples** que o repositório
  traduz.

### AC-5: Política de erro declarada
- Cada operação é `@policy strict` ou `@policy silent`, com tag `[<repo>.<op>]` e fallback
  documentado. **Preservar o comportamento atual** de cada store.

### AC-6: Repositórios testados
- Cada repositório novo tem teste verde: caminho feliz, caminho de erro e caminho de coleção.

### AC-7: Zero regressão
- **As suítes existentes destes módulos passam sem edição.** Se um teste precisar mudar, o
  comportamento mudou: parar e relatar.

## Fora de escopo

- Quebrar `App.jsx` (onda 2, spec 0031) e validação de schema (onda 3, spec 0032).
- Reescrever a lógica dos stores.
- Consertar os quirks herdados e a perda silenciosa do autosave — todos na spec 0032.
- Mexer no `MapEditor/index.jsx`: ele não importa o SDK.

## Rastreabilidade

- ADR: [../../docs/architecture/adr/0010-camada-de-infraestrutura.md](../../docs/architecture/adr/0010-camada-de-infraestrutura.md)
- Antecessora: [../0029-camada-de-infraestrutura/spec.md](../0029-camada-de-infraestrutura/spec.md)
- Sucessoras: [../0031-onda-2-split-app-jsx/spec.md](../0031-onda-2-split-app-jsx/spec.md) · [../0032-onda-3-fronteiras-e-quirks/spec.md](../0032-onda-3-fronteiras-e-quirks/spec.md)
