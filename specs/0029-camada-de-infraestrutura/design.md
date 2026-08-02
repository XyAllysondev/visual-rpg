---
name: design-camada-de-infraestrutura
description: Decisão de design dos repositórios Firestore — forma, política de erro e ordem de migração. Puxe ao implementar ou revisar a camada de dados.
alwaysApply: false
---

# Design — Camada de infraestrutura

> **Status:** aprovado

## Solução

**Repositório por agregado**, módulo simples exportando funções (sem classe, sem DI container).
O projeto é solo, sem múltiplas implementações previstas; interface + fábrica seria cerimônia
sem ganho. A porta é a **assinatura da função**, não um objeto de interface.

```
src/infrastructure/firestore/
  client.js          ← reexporta `db`; `docAt`/`colAt`; envelope `silent()` da política de erro
  paths.js           ← ÚNICO lugar onde caminho de coleção vira string
  usersRepo.js       ← users/{uid}                         (perfil, plano, musicLinks)
  charactersRepo.js  ← users/{uid}/characters              (fichas do dono)
  campaignsRepo.js   ← campaigns/{id}                      (doc raiz + membros)
  messagesRepo.js    ← campaigns/{id}/messages, .../typing (chat)
  sharedSheetsRepo.js← campaigns/{id}/sharedSheets         (fichas na mesa)
  bestiaryRepo.js    ← campaigns/{id}/bestiary             (criaturas do mestre)
  publicSheetsRepo.js← publicSheets/{charId}[/pendingEdits](ficha por link)
  index.js           ← barrel: um import só em App.jsx
```

`messagesRepo` cobre `messages` **e** `typing` de propósito: `typing` não é agregado próprio,
é estado efêmero do mesmo ato (digitar → enviar). Separar daria um repo de 2 funções que só
tem sentido junto do outro.

## Forma das funções

Três verbos, e o nome já diz a política:

| Prefixo | Retorna | Erro |
|---|---|---|
| `get*` / `list*` | Promise de dado simples | `strict` **ou** `silent` — declarado no JSDoc |
| `watch*` | função `unsubscribe` (síncrona) | via callback `onError` opcional |
| verbo de ação (`send`, `leave`, `remove`, `setHp`…) | Promise `void`/id | idem `get*` |

Regra de tradução do legado: **se o `fsXxx` de hoje engolia o erro, o repo nasce `silent`; se
propagava, nasce `strict`.** A spec preserva comportamento (AC-7); mudar política é decisão de
outra spec. Cada `silent` carrega no JSDoc o fallback que devolve.

## As duas primitivas que NÃO podem vazar (AC-3)

1. **`DocumentReference`.** Hoje `App.jsx:11842` guarda `d.ref` de um snapshot num `useRef`
   (`liveSheetRefsRef`) e escreve nele em `App.jsx:12057`. O repo passa a expor
   `sharedSheetsRepo.watchLiveRefsByCharacter(campaignIds, uid, cb)` devolvendo
   `{ [characterId]: [{campaignId, sheetId}] }` — coordenadas em string, não handles do SDK —
   e `updateCharacterData({campaignId, sheetId}, …)` para a escrita.
2. **`FieldValue`.** `arrayUnion`/`arrayRemove`/`serverTimestamp`/`deleteField` ficam dentro
   do repo. A borda pede `campaignsRepo.removeMember(campaignId, memberId)`, não um operador.

`Timestamp` de leitura é caso à parte: os docs de mensagem **já vêm** com `timestamp` do tipo
`Timestamp` e a UI lê `msg.timestamp.seconds` em vários pontos. Convertê-lo seria mudança de
comportamento (AC-7). **Decisão: o campo passa cru nesta onda**, e a normalização entra na
onda 3 junto com a validação de schema. Registrado como dívida no ADR-0010.

## Onde a lógica de negócio fica

O repositório é **burro de propósito**: caminho, escrita, leitura, política de erro. Regra fica
fora. Dois casos herdados precisam de decisão explícita:

- **Limite de 3 campanhas por sistema** (`useCampaign.js:28` e `:66`) — é regra de negócio, mas
  depende de uma consulta. Fica no hook (camada de aplicação), que chama
  `campaignsRepo.countActiveByMasterAndSystem()` / `listByMember()`. O repo só conta.
- **Backoff de 5 s ao falhar a assinatura** (`useCampaign.js:103`) — política de UI, fica no hook.

## Alternativas descartadas

| Alternativa | Por que descartada |
|---|---|
| `services/` com classes + injeção | Cerimônia sem ganho num app solo; nome também diverge do `CLAUDE.md`, que já nomeia a camada `infrastructure` |
| Um `firestoreClient.js` único com CRUD genérico | Só move o problema: os caminhos continuariam montados na UI |
| Migrar também os stores de feature agora | Dobra o diff e mistura risco; `WorldMap`/`MasterSuite` já estão encapsulados. Vira onda 1.5 |
| Reescrever `App.jsx` de uma vez | É a onda 2. Misturar as duas impede saber o que quebrou |
| Repositório retornando snapshot cru | Mantém o vazamento que o AC-3 existe para fechar |

## Ordem de implementação (minimiza risco)

Do menos acoplado ao mais, com o gate rodando entre cada passo:

1. `paths.js` + `client.js` + testes — nenhum consumidor ainda
2. `usersRepo` + `charactersRepo` → migra `useAuth` e `useCharacter` (3 call sites)
3. `campaignsRepo` → migra `useCampaign` (5 call sites)
4. `publicSheetsRepo` → migra o bloco `fsXxx` de `App.jsx:64-100` + `PublicSheetView`
5. `messagesRepo` → migra `CampaignChat` e os dois feeds de rolagem
6. `sharedSheetsRepo` → migra os 4 pontos + **fecha o vazamento de `DocumentReference`**
7. `bestiaryRepo` → migra `BestiaryTab`
8. Regra ESLint + varredura final de `firebase/firestore` em App.jsx/hooks

Cada passo termina com `npx jest` verde e `npm run build` exit 0 antes do seguinte.
