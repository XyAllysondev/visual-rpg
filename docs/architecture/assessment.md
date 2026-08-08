---
name: assessment
description: Retrato as-is do Nexus RPG (brownfield). Puxe ao mapear ou avaliar o codebase.
alwaysApply: false
---

# Assessment (as-is) — Nexus RPG

> Mapa do estado atual gerado no kickoff (2026-06-22). Fotografa o que existe.

## Visão geral
Nexus RPG é uma SPA React em produção no Firebase Hosting. Permite autenticação, criação de
personagens (sistema Ordem Paranormal), gerenciamento de campanhas com chat em tempo real,
rolagem de dados e pagamento PIX para plano pago. Em funcionamento com usuários reais.

## Stack detectada
| Camada            | Tecnologia atual                          | Observação                                     |
|-------------------|-------------------------------------------|------------------------------------------------|
| Linguagem/runtime | JavaScript (ES2022+), Node 18 (build)     | Sem TypeScript                                 |
| Framework UI      | React 18.2 (CRA / react-scripts 5)       | CRA: legado, build lento                       |
| Estilização       | Inline styles (`style={{…}}`)             | Sem CSS-in-JS lib, sem Tailwind, sem CSS Modules |
| Persistência      | Firebase Firestore (NoSQL)                | Coleções: users, characters, publicSheets, campaigns |
| Auth              | Firebase Auth (email+senha, Google OAuth) | Persist: localStorage por padrão               |
| Infra/deploy      | Firebase Hosting + Firebase CLI           | predeploy: `npm run build`                     |
| Pagamentos        | PIX via API externa (`API_BASE`)          | Endpoint `/api/create-payment`                 |
| Fontes/UI         | Cinzel, Crimson Pro (Google Fonts)        | Tema dark gothic                               |

## Arquitetura atual
SPA monolítica com `App.jsx` como orquestrador central (~2500+ linhas). Toda a lógica de
negócio, estado, chamadas Firebase e UI coexistem neste único arquivo. Sheets de sistema
(OrdemParanormalSheet) são code-split via `React.lazy`, mas a fronteira termina aí.

Padrões reais:
- **Fail-silent helpers**: todas as funções `fs*` capturam erros silenciosamente (`catch (_) {}`).
  Garante que o app não quebre, mas torna debugging muito difícil.
- **Estado global em App.jsx**: auth state, character list, campaign data, chat, UI mode —
  todos em `useState` no componente raiz.
- **Sem gerenciador de estado externo**: sem Zustand, Redux, Context estruturado.

## Estrutura de pastas
```
src/
  App.jsx                          ← orquestrador monolítico (maior dívida técnica)
  roadmapData.js                   ← dados do roadmap da UI
  index.js
  themes/
    index.js                       ← definição dos temas por sistema
    ThemeProvider.jsx
  components/
    systems/
      OrdemParanormal/
        OrdemParanormalSheet.jsx   ← ficha completa (lazy-loaded)
        DossierCard.jsx            ← card de personagem no dashboard
        VitalSign.jsx              ← HP, sanidade, esforço
        AttrConstellation.jsx      ← visualização de atributos
        AttributeCircle.jsx
        ElementoAfinidadeModal.jsx
        ElementoSymbol.jsx
        elementos.jsx
        ordemStyles.jsx            ← estilos inline centralizados
        rules.js                   ← regras de cálculo do sistema
        Tabs/
          DescricaoTab.jsx
          HabilidadesTab.jsx
          InventarioTab.jsx
          ProgressaoTab.jsx
          RituaisTab.jsx
          shared/
            ElementoBadge.jsx
            modalStyles.js
            RichTextEditor.jsx
```

## Convenções de código
- Funções `fs*` = helpers de Firestore (ex: `fsSaveCharacter`, `fsLoadCharacters`)
- Tudo em português (nomes de variáveis, comentários, UI)
- Inline styles com objeto JS literal em cada componente
- Sem prop-types, sem TypeScript — tipagem implícita
- Sem padrão de tratamento de erros além do fail-silent
- Lazy load de sheets: `const OrdemParanormalSheet = lazy(() => import(…))`

## Bounded contexts implícitos
| Contexto (inferido)    | Onde vive no código                  | Core/Support/Generic | Fronteira clara? |
|------------------------|--------------------------------------|----------------------|------------------|
| Identidade (Auth)      | `App.jsx` (fsEnsureUserDoc, auth)    | Support              | não              |
| Ficha (Character)      | `App.jsx` + `OrdemParanormal/`       | **Core**             | parcial          |
| Campanha               | `App.jsx` (fsCreateCampaign, chat)   | **Core**             | não              |
| Plano / Monetização    | `App.jsx` (fsGetUserPlan, PIX)       | Support              | não              |
| Tabletop               | *(não existe ainda)*                 | **Core futuro**      | —                |
| IA                     | *(incipiente — AI assistant)*        | Core futuro          | não              |

## Testes & CI
- **Testes:** nenhum teste automatizado presente
- **CI/CD:** nenhum pipeline configurado (deploy manual via Firebase CLI)
- **Lint:** ESLint padrão CRA (não customizado)
- **Type-check:** inexistente (JS puro)

## Integrações
| Integração          | Tipo       | Como é usada                               | Risco/acoplamento |
|---------------------|------------|--------------------------------------------|-------------------|
| Firebase Auth       | SDK        | Login email/Google, persistência           | alto (acoplado direto) |
| Firebase Firestore  | SDK        | CRUD de users, characters, campaigns, chat | alto (sem abstração) |
| Firebase Hosting    | CLI/deploy | Deploy da SPA                              | baixo             |
| API externa PIX     | REST       | `POST /api/create-payment`                 | médio (URL via `API_BASE`) |
| Google Fonts        | CDN        | Cinzel, Crimson Pro                        | baixo             |

## Maturidade nos 5 eixos
| Eixo            | Estado atual                                          | Gap vs padrão SDD                         | Risco |
|-----------------|-------------------------------------------------------|-------------------------------------------|-------|
| Tech stack      | React 18 + JS + Firebase — stack válida              | Sem TS, CRA legado                        | médio |
| Arquitetura     | SPA monolítica, App.jsx como orquestrador único      | Sem separação de camadas, sem bounded ctx | alto  |
| Infra           | Firebase Hosting, deploy manual                       | Sem ambientes separados, sem IaC          | médio |
| Qualidade       | Zero testes, zero CI, lint padrão                     | Testes, CI/CD, análise estática           | alto  |
| Observabilidade | Fail-silent (erros engolidos), sem logs estruturados  | Logs, métricas, alertas                   | alto  |

## Dívidas e riscos principais
1. **App.jsx monolítico** — impossível testar, difícil de navegar, qualquer mudança arrisca regressão
2. **Fail-silent em todo Firestore** — erros de banco são silenciados; impossível saber quando algo falha em produção
3. **Sem CI/CD** — deploy manual, sem gate de qualidade antes de ir para produção
4. **Firebase SDK acoplado diretamente** — sem abstração; impossível mockar para testes
5. **Sem TypeScript** — contratos de dados não verificados em tempo de build

## Decisões históricas capturadas como ADR
- [x] Uso do Firebase como backend completo → ADR-0002
- [x] React CRA como bundler → ADR-0003
- [x] Inline styles como estratégia de estilização → ADR-0004
