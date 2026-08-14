/* ════════════════════════════════════════════════════════════════════
 *  O ROADMAP PÚBLICO  (spec 0036 · AC-3)
 *  --------------------------------------------------------------------
 *  Esta lista é a única fonte da tela `/roadmap`, que é também o
 *  "Changelog" do rodapé. Ela estava **se vendendo abaixo do que o produto
 *  entregou**: fog of war, grid hexagonal, controle de clima, upload de
 *  mapa e campanhas compartilhadas apareciam como PLANEJADO meses depois
 *  de estarem no ar — justamente na página que fala de futuro.
 *
 *  ── A REGRA ─────────────────────────────────────────────────────────
 *  Um item só pode ficar em `planned`/`backlog` se ele **não existe no
 *  código**. O gate `__tests__/roadmap-honesto.test.js` amarra cada item
 *  entregue ao arquivo que o implementa: se o arquivo existe e o status
 *  não é `done`, o teste reprova.
 *
 *  Vale nos DOIS sentidos. Ao conferir item por item, quatro que a
 *  auditoria dava como entregues **não estavam**: tracker de iniciativa
 *  (existe só um CAMPO "Iniciativa" na ficha de criatura do bestiário, não
 *  uma ordem de turno), iluminação dinâmica, dado 3D e aura de token.
 *  Esses continuam `planned` — marcar como pronto o que não existe é o
 *  mesmo defeito, virado do avesso.
 * ══════════════════════════════════════════════════════════════════ */

export const roadmapData = [
  {
    fase: 1,
    nome: "Fundação",
    status: "done",
    descricao: "A base do Nexus — autenticação, fichas e ferramentas do mestre.",
    sections: [
      {
        label: null,
        items: [
          { nome: "Login + autenticação", status: "done" },
          /* Eram "6 sistemas". `systems.jsx` define 7, mostra 3 e deixa entrar
             em UM (`available:true` só em `op`). O número certo é o que o
             usuário consegue abrir. */
          { nome: "Seleção de sistema (Ordem Paranormal aberto)", status: "done" },
          /* "e sessões" saiu de propósito: o contador de Sessões foi removido
             do Painel por ser 0 permanente com cara de dado real. */
          { nome: "Dashboard com personagens e campanhas", status: "done" },
          { nome: "Criador de personagem 4 etapas (Ordem Paranormal)", status: "done" },
          { nome: "Ficha completa FullSheet 3 colunas", status: "done" },
          { nome: "Progressão de atributos por NEX", status: "done" },
          { nome: "Ajudante do Mestre (suíte de mundo)", status: "done" },
        ],
      },
    ],
  },
  {
    fase: 2,
    nome: "Imersão",
    status: "current",
    descricao: "Experiência tabletop completa com mapas, tokens e dados 3D.",
    sections: [
      {
        label: "Tabletop",
        items: [
          /* `grid.js:25` — GRID_TYPES ['square','hexVertical','hexHorizontal'],
             escolhível na barra do editor (index.jsx:2072-2077). */
          { nome: "Módulo Tabletop com grid hexagonal", status: "done" },
          /* Não existe: nenhum `auraRadius`/`statusConditions` no código. */
          { nome: "Tokens animados com aura e status", status: "planned" },
          /* `scene.weather` com chuva, neve e névoa densa, sincronizado para a
             mesa; seletor em index.jsx:2417. */
          { nome: "Controle de clima em tempo real", status: "done" },
          /* `FogLayer.jsx` + a névoa em bitmap da spec 0028. */
          { nome: "Fog of war", status: "done" },
          /* Não existe ordem de turno — só um CAMPO "Iniciativa" na ficha de
             criatura do bestiário (BestiaryTab.jsx:1071). */
          { nome: "Tracker de iniciativa", status: "planned" },
          { nome: "Dado 3D (d4–d100)", status: "planned" },
        ],
      },
      {
        label: "Mapas",
        items: [
          /* O tile-based por bioma foi APOSENTADO (ADR-0005): o MapEditor com
             camadas e assets é o mapa oficial da campanha. Prometer o tile
             seria prometer o que o projeto decidiu não fazer. */
          { nome: "Editor de mapas com camadas e assets", status: "done" },
          /* Não existe: nenhum `lightLayer`/`dynamicLight` no código. */
          { nome: "Iluminação dinâmica", status: "planned" },
          /* `<input type="file" accept="image/*">` → `loadBg` (index.jsx:1571). */
          { nome: "Upload de mapa customizado", status: "done" },
        ],
      },
    ],
  },
  {
    fase: 3,
    nome: "Expansão",
    status: "future",
    descricao: "Social, IA de voz e monetização para o ecossistema Nexus.",
    sections: [
      {
        label: "Social",
        items: [
          /* Eram "até 8". `domain/campaign.js:32` — DEFAULT_MAX_PLAYERS = 6.
             O número do roadmap tem de ser o número que o código aplica. */
          { nome: "Multiplayer na campanha (até 6 jogadores)", status: "done" },
          /* `sharedSheetsRepo` + a aba de campanha, com ficha ao vivo. */
          { nome: "Campanhas compartilhadas", status: "done" },
          { nome: "Perfil público de narrador", status: "backlog" },
        ],
      },
      {
        label: "IA & Voz",
        items: [
          { nome: "Mestre de voz IA (Whisper + GPT-4o + ElevenLabs)", status: "backlog" },
          { nome: "Geração de mapa por texto", status: "backlog" },
          { nome: "NPCs com memória persistente", status: "backlog" },
        ],
      },
      {
        label: "Monetização",
        items: [
          { nome: "Paywall Stripe (Free / Pro / Mestre)", status: "backlog" },
          { nome: "Biblioteca de trilhas premium", status: "backlog" },
          { nome: "Marketplace de assets", status: "backlog" },
        ],
      },
    ],
  },
];
