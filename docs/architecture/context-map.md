---
name: context-map
description: Bounded contexts e relações. Puxe ao modelar ou cruzar contextos.
alwaysApply: false
---

# Context Map

> Visão DDD estratégica: os bounded contexts do sistema e como se relacionam.
> Atualize quando uma feature cria/move fronteiras. Combine com diagramas C4 se útil.

## Bounded Contexts
| Contexto          | Subdomínio              | Responsabilidade                                    | Dono  |
|-------------------|-------------------------|-----------------------------------------------------|-------|
| **Identidade**    | supporting              | Auth, perfil, plano do usuário                      | Andre |
| **Ficha**         | **core**                | Personagens, atributos, cálculos de regras por sistema | Andre |
| **Campanha**      | **core**                | Campanhas, membros, chat em tempo real              | Andre |
| **Monetização**   | supporting              | Planos, cobrança PIX, limites por plano             | Andre |
| **Tabletop**      | **core** *(futuro)*     | Grid, tokens, fog of war, iniciativa, mapas         | Andre |
| **IA**            | **core** *(futuro)*     | Assistente, mestre de voz, NPCs com memória         | Andre |

## Onde cada contexto toca o banco

Desde a **spec 0029** / **ADR-0010**, todo acesso a dados de um contexto passa pelo repositório do
seu agregado em `src/infrastructure/firestore/`. A fronteira é executável (`no-restricted-imports`),
não uma convenção: `App.jsx` e `src/hooks/` não importam mais `firebase/firestore`.

| Contexto | Repositório | Coleção |
|---|---|---|
| **Identidade** | `usersRepo` | `users/{uid}` |
| **Ficha** | `charactersRepo` · `publicSheetsRepo` | `users/{uid}/characters` · `publicSheets/{charId}` |
| **Campanha** | `campaignsRepo` · `messagesRepo` · `sharedSheetsRepo` · `bestiaryRepo` | `campaigns/{id}` e subcoleções |
| **Tabletop** | *(ainda nos stores de feature — onda 1.5, spec 0030)* | `users/{uid}/worldmaps`, `worlds/{id}`, cenas do MapEditor |
| **Monetização** | `usersRepo.watchSubscribedSystems` + `api/` (Vercel) | `users/{uid}.subscribedSystems` |

Regra de negócio **não** desce para o repositório: teto de campanhas por sistema, identidade da
ficha (`characterKey`) e clamp de PV vivem em `src/domain/`; retry e mensagem de erro vivem nos
hooks (camada de aplicação).

**Dívida aberta:** 7 stores de feature (`WorldMap/*Store`, `MasterSuite/worldsStore`,
`MapEditor/sync/*`, `assetLib`) ainda falam com o SDK direto. Estão listados nominalmente na
exceção do ESLint — a lista só pode encolher.

## Relações entre contextos
> Padrões atuais inferidos do código.

```
[Identidade] ──(Customer/Supplier)──► [Ficha]
[Identidade] ──(Customer/Supplier)──► [Campanha]
[Identidade] ──(Customer/Supplier)──► [Monetização]
[Ficha]      ──(Shared Kernel)──────► [Campanha]
[Monetização]──(Conformist)─────────► [Ficha]
[Monetização]──(Conformist)─────────► [Campanha]
```

| Upstream       | Downstream   | Padrão              | Por quê |
|----------------|--------------|---------------------|---------|
| Identidade     | Ficha        | Customer/Supplier   | Ficha precisa do UID do usuário |
| Identidade     | Campanha     | Customer/Supplier   | Campanha usa UID como masterId/memberId |
| Ficha          | Campanha     | Shared Kernel       | DossierCard compartilha estrutura de Character |
| Monetização    | Ficha        | Conformist          | Limites de personagem por plano validados no App.jsx |

## Diagramas
Os diagramas de arquitetura de alto nível (contexto C4, containers, mapa de contextos) ficam em
[`diagrams.md`](./diagrams.md) — gere/atualize com a skill `/diagramar`.
