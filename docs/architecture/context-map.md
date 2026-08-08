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
| **Tabletop** | `worldMapsRepo` · `mesaRepo` · `fogRepo` · `mapSyncRepo` · `assetsRepo` | `users/{uid}/worldmaps` (ateliê) · `campaigns/{id}/worldmaps` (mesa) · `campaigns/{id}/map` (cenas) · `users/{uid}/assets` |
| **Forja do Mestre** | `worldsRepo` | `worlds/{id}` + `entities`/`connections`/`folders` |
| **Monetização** | `usersRepo.watchSubscribedSystems` + `api/` (Vercel) | `users/{uid}.subscribedSystems` |

Regra de negócio **não** desce para o repositório: teto de campanhas por sistema, identidade da
ficha (`characterKey`), clamp de PV e a codificação RLE da névoa vivem em `src/domain/` ou nos
stores; retry e mensagem de erro vivem na camada de aplicação.

**A fronteira está fechada** (specs 0030/0032, ADR-0011): nenhum arquivo fora de
`src/infrastructure/` importa `firebase/firestore`, e a lista de exceção do ESLint está vazia.
Nem `Timestamp`, nem `DocumentReference`, nem FieldValue atravessam — datas saem como epoch-ms.

## Como a UI se organiza

Desde a **spec 0031**, o `App.jsx` é só orquestrador (439 linhas). Os componentes vivem em
`src/features/<contexto>/`, espelhando os bounded contexts desta página:

```
src/features/   auth · campanha · dashboard · ficha · institucional · mapa · monetizacao · musica · sistemas
src/ui/         casca sem regra de negócio (Sidebar, Topbar, MobileBottomNav, ornamentos)
src/lib/        compartilhado entre contextos (appShell, NexusLogo, useViewport, nexStats…)
```

O critério de fronteira: se tem regra de negócio, é `features/`; se é casca reusável, é `ui/`;
se é usado por dois contextos e não é nenhum dos dois, é `lib/`.

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
