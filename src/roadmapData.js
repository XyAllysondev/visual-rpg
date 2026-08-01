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
          { nome: "Seleção de sistema (6 sistemas)", status: "done" },
          { nome: "Dashboard com personagens e sessões", status: "done" },
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
          { nome: "Módulo Tabletop com grid hexagonal", status: "planned" },
          { nome: "Tokens animados com aura e status", status: "planned" },
          { nome: "Controle de clima em tempo real", status: "planned" },
          { nome: "Fog of war", status: "planned" },
          { nome: "Tracker de iniciativa", status: "planned" },
          { nome: "Dado 3D (d4–d100)", status: "planned" },
        ],
      },
      {
        label: "Mapas",
        items: [
          { nome: "Editor de mapas com tiles por bioma", status: "planned" },
          { nome: "Iluminação dinâmica", status: "planned" },
          { nome: "Upload de mapa customizado", status: "planned" },
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
          { nome: "Multiplayer até 8 jogadores", status: "backlog" },
          { nome: "Campanhas compartilhadas", status: "backlog" },
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
