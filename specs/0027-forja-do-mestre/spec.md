---
name: spec-forja-do-mestre
description: Contrato da Forja do Mestre — substitui o chat de IA da aba "Ajudante do Mestre" por uma suíte de worldbuilding (mundos, wiki de entidades, conexões, grafo, diário, cronos, calendário, ideias, genealogia) e ferramentas de sessão, espelhando o WorldCraft.
alwaysApply: true
---

# Spec — Forja do Mestre (Ajudante do Mestre 2.0)

> **Fonte da verdade.** Tier: **arquitetural** — introduz um bounded context novo (*Mundo*) com
> persistência própria, e é decisão difícil de reverter (remove um produto existente e cria um
> modelo de dados novo). Pedido do Andre em 2026-07-31: *"eu quero que o ajudante do mestre não
> seja mais uma IA, eu quero que ele ajude o mestre com a sessão, porém dessa forma igual desse
> site https://worldcraft.com.br — clone todas suas funcionalidades e adapte"*.

## Resumo

A aba `master` hoje renderiza `MasterAssistant` (App.jsx) — um chat com a NEXUS-IA. Ela sai por
completo e dá lugar à **Forja do Mestre**: uma suíte onde o mestre constrói e consulta o **mundo**
da sua campanha e conduz a sessão.

Referência funcional levantada no próprio WorldCraft (sessão logada, mundo demo): wiki de entidades
com 11 tipos, conexões tipadas entre entidades, grafo interativo, genealogia, diário estilo Notion,
quadro de ideias, linhas do tempo, calendário fictício, dashboard do mundo, busca global e um hub de
ferramentas de mesa (soundboard, iniciativa, dados, timer).

**Fora de escopo (decidido):** qualquer IA (o "Cérebro do Mundo" do WorldCraft não é clonado),
billing/planos, guildas e VTT multiplayer (o Nexus já tem *Campanhas*), compêndio/biblioteca de
livros de terceiros (o Nexus já tem a sua biblioteca OP).

## Linguagem ubíqua

| Termo | Significado |
|---|---|
| **Mundo** | Agregado raiz. Um cenário de campanha do mestre. Contém tudo abaixo. |
| **Entidade** | Qualquer verbete do mundo (personagem, local, item…). Tem `tipo`, atributos e tags. |
| **Conexão** | Aresta tipada e direcionada entre duas entidades (`CONTÉM`, `ALIANÇA`, `PROGENITOR_DE`…). |
| **Pasta** | Agrupamento manual de entidades (wiki) ou páginas (diário). |
| **Página** | Documento de texto rico do Diário. |
| **Ferramenta** | Cada módulo da suíte (Painel, Wiki, Grafo, Diário, Cronos, Calendário, Ideias, Genealogia, Mesa). |

## Critérios de aceite

### AC-1: A IA sai por completo
- **Dado** o app buildado
- **Então** não existe mais o componente `MasterAssistant`, os prompts de sistema da NEXUS-IA, a
  chamada `callGemini` a partir desta aba, nem o botão de gerar imagem por IA
- **E** nenhuma cópia visível ao usuário promete "Ajudante de IA" (planos, roadmap, i18n)
- **Gate:** `forja-sem-ia.test.js` — varre `src/App.jsx` e falha se encontrar `MasterAssistant`,
  `NEXUS-IA` ou `pollinations`; e falha se `roadmapData.js`/`i18n` citarem IA na aba do mestre

### AC-2: Mundos são criados, listados, trocados e removidos
- **Dado** um mestre autenticado sem nenhum mundo
- **Quando** abre a Forja do Mestre
- **Então** vê o estado vazio com "Criar meu primeiro mundo" e "Criar mundo demo"
- **Quando** cria um mundo (nome obrigatório; descrição e gênero opcionais)
- **Então** o mundo é persistido em `worlds/{worldId}` com `ownerUid` e passa a ser o mundo ativo,
  e o seletor no topo lista todos os mundos do mestre
- **E** o mundo ativo sobrevive a um reload (persistido localmente por usuário)
- **Gate:** `worldsStore.test.js` (contrato do store, Firestore mockado) + verificação manual

### AC-3: Wiki — CRUD das 11 espécies de entidade
- **Dado** um mundo ativo
- **Quando** o mestre cria uma entidade
- **Então** escolhe um `tipo` entre exatamente: **conceito, criatura, divindade, evento, item,
  local, organização, personagem, raça, resumo de sessão, rota**
- **E** informa nome (obrigatório), descrição, tags livres e atributos chave/valor arbitrários
- **Então** a entidade aparece na wiki, é editável e removível
- **Gate:** `entityTypes.test.js` (os 11 tipos, rótulo PT, ícone e cor) + `entityFilters.test.js`

### AC-4: Wiki — navegação por filtro, busca, ordenação, pastas e visão
- **Dado** uma wiki com entidades
- **Então** o mestre filtra por tipo (com contagem por tipo), filtra por tag, busca por texto
  (insensível a acento e caixa), ordena (A→Z, Z→A, recentes, antigos) e alterna grade/lista
- **E** contagem zero desabilita o filtro daquele tipo (não some — informa que está vazio)
- **Gate:** `entityFilters.test.js` cobre filtro por tipo, por tag, busca com acento, ordenações

### AC-5: Conexões tipadas entre entidades
- **Dado** duas entidades do mesmo mundo
- **Quando** o mestre cria uma conexão com um rótulo de relação
- **Então** a conexão aparece nas **duas** páginas de entidade, com o sentido correto
  (`A CONTÉM B` aparece em B como `CONTIDO EM A`)
- **E** o mestre remove a conexão de qualquer um dos lados
- **E** o sistema nunca cria conexão de uma entidade com ela mesma nem duplicata da mesma relação
- **Gate:** `connections.test.js` — inverso, deduplicação, autoligação, órfãs

### AC-6: Painel do mundo
- **Dado** um mundo ativo
- **Então** o Painel mostra contagem por tipo, as entidades editadas recentemente (com filtro por
  tipo) e um checklist de primeiros passos que reflete o estado real do mundo
- **Gate:** `dashboardStats.test.js` — agregação de contagens e recentes a partir da lista

### AC-7: Mundo demo popula o mundo com conteúdo coerente
- **Quando** o mestre clica em "Criar mundo demo"
- **Então** um mundo é criado com entidades de vários tipos e conexões entre elas, suficiente para
  exercitar wiki, grafo e genealogia sem digitação
- **Gate:** `demoWorld.test.js` — o seed tem ≥1 entidade de ≥5 tipos, ≥8 conexões, nenhuma conexão
  aponta para id inexistente

### AC-8: Identidade visual e acessibilidade preservadas
- **Dado** qualquer tela da suíte
- **Então** ela usa as CSS vars do tema ativo (`--bg/--surface/--card/--card2/--border/--accent/…`),
  as fontes da identidade (Cinzel/Inter/IBM Plex Mono) e respeita a escada de superfícies da spec 0023
- **E** todo controle é alcançável por teclado com foco visível, e alvos de toque têm ≥44px no mobile
- **E** o texto mantém contraste ≥ 4,5:1
- **Gate:** revisão do agente de acessibilidade + checklist visual (não há harness de pixel)

### AC-9: A suíte não incha o App.jsx
- **Dado** o código-fonte
- **Então** toda a Forja vive em `src/components/MasterSuite/**` e o `App.jsx` só a referencia
  (import + `case "master"`), ficando **menor** do que antes desta spec
- **Gate:** `forja-sem-ia.test.js` verifica que o case renderiza `MasterSuite`

## Fora de escopo

- Chat/IA de qualquer natureza nesta aba.
- Multiplayer/realtime da suíte (o mundo é do mestre; compartilhar por link é a Fase 8).
- Migrar as Campanhas existentes para dentro do modelo de Mundo (apenas referência opcional).
- Substituir o Bestiário OP, as Fichas ou o Editor de Mapas — a suíte **integra**, não duplica.

## Faseamento (cada fase entrega valor sozinha)

| Fase | Entrega | Status |
|---|---|---|
| 1 | Remoção da IA · Hub · Mundos · Wiki (CRUD/filtros/pastas) · Painel · Mundo demo | **em andamento** |
| 2 | Conexões na UI · Grafo interativo (filtros, órfãs, vistas salvas, export) | a fazer |
| 3 | Diário (páginas/pastas/texto rico) · Busca global Ctrl+K | a fazer |
| 4 | Cronos (eras/eventos) · Calendário fictício por template | a fazer |
| 5 | Mesa: Iniciativa & Combate · Dados · Timer de Cena · Soundboard | a fazer |
| 6 | Genealogia · Quadro de Ideias | a fazer |
| 7 | Cartografia integrada (marcador ↔ entidade no MapEditor) | a fazer |
| 8 | Compartilhar mundo por link / publicar entidades | a fazer |

## Verificação

```bash
npm test -- --watchAll=false     # gates automáticos
npm run build                    # sem erro; chunks lazy da suíte separados
npm start                        # abrir a aba "Forja do Mestre" e percorrer o fluxo do AC-2 ao AC-7
```
