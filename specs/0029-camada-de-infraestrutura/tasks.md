---
name: tasks-camada-de-infraestrutura
description: Breakdown de tasks da camada de infraestrutura. Puxe ao implementar os repositórios.
alwaysApply: false
---

# Tasks — Camada de infraestrutura

## Estado: TODAS AS 8 TASKS CONCLUÍDAS (2026-08-02)

Gate final: **1848 testes / 78 suítes verdes**, `npm run build` **exit 0**.

| Task | Estado | Evidência |
|---|---|---|
| 1 · `paths.js` + `client.js` | ✅ | `paths.test.js` |
| 2 · `usersRepo` + `charactersRepo` | ✅ | `useAuth`/`useCharacter` migrados |
| 3 · `campaignsRepo` | ✅ | 33 testes; `useCampaign` migrado |
| 4 · `publicSheetsRepo` | ✅ | 6 operações; bloco `fs*` do App.jsx removido |
| 5 · `messagesRepo` | ✅ | 31 testes; chat, typing e 2 feeds de rolagem migrados |
| 6 · `sharedSheetsRepo` | ✅ | 24 testes, **inclui o teste dedicado ao AC-3** |
| 7 · `bestiaryRepo` | ✅ | 14 + 11 (`domain/creature.js`) |
| 8 · fronteira por lint | ✅ | regra **provada nos dois sentidos** (ver abaixo) |

**Verificação executável do AC-1** — não retorna nada:
`grep -rn "firebase/firestore" src/App.jsx src/hooks/`

**Verificação do AC-5** — a regra não é config morta (armadilha que este projeto já registrou
4 vezes): um arquivo temporário fora da fronteira foi criado, o ESLint acusou
`no-restricted-imports`, `usersRepo.js` (na exceção) passou limpo, e o arquivo foi apagado.

### Desvios conscientes em relação ao plano original
1. **`messagesRepo` nasceu na Task 3**, não na 5: `useCampaign.joinCampaign` publica a mensagem
   de sistema, e deixar essa escrita dentro do `campaignsRepo` cruzaria agregados.
2. **`domain/campaign.js` e `domain/creature.js` foram criados** — não estavam no plano. O código
   de convite estava DUPLICADO (useCampaign + App.jsx) e o clamp de PV é regra, não persistência.
3. **`bestiaryRepo.create/update` devolvem booleano.** Como a política é `silent` (nunca rejeita),
   sem isso o modal fecharia mesmo com a escrita falhando e o mestre perderia o que digitou.
4. **`sharedSheetsRepo.updateCharacterData` tem `{fallbackName}` opcional** — o live-sync cai para
   `"Sem nome"`, mas o painel cai para o nome que a ficha já tinha. Diferença herdada (AC-7).
5. **`usersRepo.watchSubscribedSystems` sempre entrega array**, inclusive com o doc ausente (o
   legado não chamava o setter nesse caso). Divergência mínima e mais segura: doc apagado não
   deixa plano pago fantasma na tela.

---

> **Implementar na ordem.** Gate entre cada task:
> `npm test -- --watchAll=false --ci` verde **e** `npm run build` exit 0.
> Uma task só começa com a anterior verde — é o que permite saber qual passo quebrou.

## Task 1 — `paths.js` + `client.js`

**AC coberto:** AC-2, AC-4

1. `src/infrastructure/firestore/paths.js` — toda string de coleção, uma vez só:
   `USERS`, `characters(uid)`, `CAMPAIGNS`, `messages(id)`, `typing(id)`,
   `sharedSheets(id)`, `bestiary(id)`, `PUBLIC_SHEETS`, `pendingEdits(charId)`.
2. `src/infrastructure/firestore/client.js` — reexporta `db` e expõe os dois envelopes de
   política de erro: `silent(tag, fallback, fn)` e `strict(fn)`.
3. Teste: `paths.test.js` trava as strings (renomear coleção quebra teste, não produção).

**Sem consumidor ainda** — esta task não pode quebrar nada.

---

## Task 2 — `usersRepo` + `charactersRepo`, migrar `useAuth` e `useCharacter`

**AC coberto:** AC-1, AC-2, AC-4, AC-6, AC-7

1. `usersRepo`: `ensureDoc(uid,email)` · `getMusicLinks(uid)` · `setMusicLink` ·
   `deleteMusicLink` · `watchSubscribedSystems(uid,cb)`.
2. `charactersRepo`: `listBySystem(uid,systemId)` (**strict** — `useCharacter` distingue
   "sem fichas" de "falhou") · `save(uid,character)` (strict) · `remove(uid,character)` (strict).
3. Migrar `src/hooks/useAuth.js` e `src/hooks/useCharacter.js`; apagar os `fs*` locais.
4. **Deletar `fsGetUserPlan` (`App.jsx:94-100`) — código morto**, confirmado por grep: definido,
   nunca chamado. Já registrado como achado no `STATE.md` de 2026-08-01.
5. Testes dos dois repos.

---

## Task 3 — `campaignsRepo`, migrar `useCampaign`

**AC coberto:** AC-1, AC-2, AC-4, AC-6, AC-7

1. `campaignsRepo`: `watchByMember` · `listByMember` · `countActiveByMasterAndSystem` ·
   `create` · `findByInviteCode` · `addMember` · `removeMember` · `leave` · `update` ·
   `toggleAdmin` · `setInviteCode` · `setActive` · `setCoverImage` · `setNarracao`.
2. `arrayUnion`/`arrayRemove` **não saem do repo** (AC-3).
3. Migrar `useCampaign.js`. **Limite de 3 campanhas e backoff de 5 s ficam no hook** — o repo
   só conta e assina (design §"Onde a lógica de negócio fica").
4. Testes: caminho feliz, limite atingido, código inválido, campanha lotada.

---

## Task 4 — `publicSheetsRepo`, migrar o bloco `fsXxx` de App.jsx

**AC coberto:** AC-1, AC-2, AC-4, AC-6, AC-7

1. `publicSheetsRepo`: `get(charId)` · `save(charId,data,ownerUid)` · `remove(charId)` ·
   `savePendingEdit` · `listPendingEdits` · `resolvePendingEdit`. **Todas `silent`** — é o
   comportamento atual (`App.jsx:64-91`), preservado por AC-7.
2. Substituir `App.jsx:64-91` e o `getDoc` de `PublicSheetView` (`App.jsx:11645`).

---

## Task 5 — `messagesRepo`, migrar chat e feeds de rolagem

**AC coberto:** AC-1, AC-2, AC-3, AC-4, AC-6, AC-7

1. `messagesRepo`: `send` · `watchRecent(campaignId,{limit},cb)` · `loadOlder(campaignId,cursor)` ·
   `watchRolls` · `clearAll` · `cleanOlderThanTtl` · `setTyping` · `watchTyping`.
2. `Timestamp`, `writeBatch`, `startAfter` e `serverTimestamp` **ficam dentro do repo**. O cursor
   de paginação é opaco para quem chama (AC-3): `loadOlder` devolve `{messages, cursor}`.
3. `MSG_TTL_MS` (24 h) muda de `App.jsx:290` para o repo — é regra de retenção do dado.
4. Migrar `CampaignChat` (`App.jsx:2094-2178`) e os dois feeds de rolagem (`:2837`, `:2971`).

---

## Task 6 — `sharedSheetsRepo` e o vazamento de `DocumentReference`

**AC coberto:** AC-1, AC-2, **AC-3**, AC-4, AC-6, AC-7

1. `sharedSheetsRepo`: `share` · `watchByCampaign` · `updateCharacterData` · `remove` ·
   `applyElement` · `watchLiveRefsByCharacter(campaignIds,uid,cb)`.
2. **O ponto crítico:** `App.jsx:11842` guarda `DocumentReference` cru em `useRef` e escreve
   nele em `App.jsx:12057`. `watchLiveRefsByCharacter` passa a devolver
   `{ [characterId]: [{campaignId, sheetId}] }` — coordenadas em string. A escrita vira
   `updateCharacterData({campaignId, sheetId}, char)`.
3. Migrar os pontos: `:2381`, `:2400`, `:2419`, `:2438`, `:4435`, `:4463`, `:4956`, `:4970`.
4. Teste dedicado provando que **nenhum objeto do SDK atravessa o callback** (asserção sobre a
   forma do payload, não sobre o mock).

---

## Task 7 — `bestiaryRepo`, migrar `BestiaryTab`

**AC coberto:** AC-1, AC-2, AC-4, AC-6, AC-7

1. `bestiaryRepo`: `watchByCampaign` · `create` · `update` · `remove` · `setHp`.
2. Migrar `App.jsx:3434`, `:3487`, `:3489`, `:3498`, `:3505`.

---

## Task 8 — Fronteira por lint + varredura final

**AC coberto:** **AC-1, AC-5**

1. `no-restricted-imports` de `firebase/firestore` em `package.json → eslintConfig`, com
   `overrides` permitindo `src/infrastructure/**`.
2. Exceções legadas **nominais e datadas** (onda 1.5): `WorldMap/worldMapStore.js`,
   `WorldMap/mesaStore.js`, `WorldMap/fogStore.js`, `MasterSuite/worldsStore.js`,
   `MapEditor/assets/assetLib.js`, `MapEditor/sync/live.js`, `MapEditor/sync/campaignSync2.js`.
3. Verificação executável do AC-1 (deve não retornar nada):
   ```bash
   grep -rn "firebase/firestore" src/App.jsx src/hooks/
   ```
4. Gate final: suíte completa + `npm run build` + atualizar `docs/STATE.md` e
   `docs/architecture/context-map.md`.

---

## Mapeamento AC → Task

| AC | Task(s) |
|---|---|
| AC-1: zero import do SDK em App.jsx/hooks | 2, 3, 4, 5, 6, 7, **8 (verificação)** |
| AC-2: repositório por agregado | 1, 2, 3, 4, 5, 6, 7 |
| AC-3: nenhuma primitiva vaza | **6 (crítico)**, 5 |
| AC-4: política de erro explícita | 1 (envelopes), 2–7 (aplicação) |
| AC-5: fronteira por lint | **8** |
| AC-6: repositórios testados | 1–7 |
| AC-7: zero regressão | gate de todas; validação no browser fica com o Andre |

## Rastreabilidade

- Spec: [./spec.md](./spec.md)
- Design: [./design.md](./design.md)
