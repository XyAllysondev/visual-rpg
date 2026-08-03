---
name: glossary
description: Linguagem ubíqua. Puxe ao nomear, modelar domínio ou escrever specs.
alwaysApply: false
---

# Glossário — Linguagem Ubíqua

> A fonte única do vocabulário do sistema. O mesmo termo aparece aqui, na spec e no código.
> Termo novo introduzido por uma feature → adicione no mesmo PR. Sem sinônimos.

| Termo              | Definição                                                                              | NÃO confundir com         | Contexto          |
|--------------------|----------------------------------------------------------------------------------------|---------------------------|-------------------|
| **Agente**         | IA com personalidade e regras específicas da campanha (futuro: NPCs com memória)      | Jogador                   | IA                |
| **Campanha**       | Espaço compartilhado de jogo criado pelo Mestre, com código de convite e chat          | Mesa física               | Campanha          |
| **Cascata de provedores** | Lista ordenada de provedores de IA (`PROVIDER_CHAIN`) tentados em sequência quando o atual falha por disponibilidade | Roteamento por qualidade | IA |
| **DossierCard**    | Card visual resumido do personagem exibido no dashboard e na visão do Mestre           | Ficha completa            | Ficha             |
| **Elemento**       | Afinidade paranormal do personagem em Ordem Paranormal (Sangue, Morte, Energia…)      | Atributo                  | Ficha / OP        |
| **Elo (fallback)** | Um par provedor+modelo específico dentro de uma cascata de IA (ex.: Groq, NVIDIA-Mistral) | Provedor (um provedor pode ter vários elos) | IA |
| **Esquiva**        | Valor derivado de Defesa + bônus de Reflexos (cálculo em `rules.js`)                  | Defesa, Armadura          | Ficha / OP        |
| **Ficha**          | Conjunto completo de dados de um personagem (atributos, perícias, inventário, etc.)   | DossierCard               | Ficha             |
| **fs\***           | Prefixo das funções de Firestore em `App.jsx` (ex: `fsSaveCharacter`)                 | —                         | Infra             |
| **Jogador**        | Usuário participante de uma campanha (não é o Mestre)                                 | Mestre, Personagem        | Campanha          |
| **Livro-razão**    | Registro em `ficha.progressao.marcos` do que o motor concedeu em cada degrau de NEX; é o que torna a progressão idempotente e reversível | Histórico de rolagens | Progressão / OP |
| **Marco**          | Uma concessão do livro num degrau de NEX específico (poder, trilha, atributo, grau de treinamento…) | Degrau (o NEX em si) | Progressão / OP |
| **Mestre**         | Usuário criador da campanha; tem acesso à visão de todas as fichas dos jogadores       | Jogador                   | Campanha          |
| **Motor de progressão** | Módulo puro que deriva os números do livro e aplica os marcos de NEX na ficha     | `rules.js` (catálogo)     | Progressão / OP   |
| **NEX**            | Nível de Exposição ao Outro — determina progressão de atributos em Ordem Paranormal    | Nível (D&D)               | Ficha / OP        |
| **Pendência**      | Escolha que o livro deve ao personagem e ainda não foi feita (poder, atributo, perícia, ritual, afinidade) | Marco automático | Progressão / OP |
| **OP**             | Abreviação de Ordem Paranormal (sistema de RPG)                                        | —                         | Ficha             |
| **Personagem**     | Entidade de jogo criada e controlada por um Jogador                                   | Jogador (usuário real)    | Ficha             |
| **Plano**          | Nível de assinatura do usuário: `free` ou `ordem` (pago via PIX)                      | Campanha                  | Monetização       |
| **PublicSheet**    | Versão publicada de uma ficha, acessível via URL sem login                             | Ficha privada             | Ficha             |
| **Sistema**        | Conjunto de regras de RPG suportado (ex: Ordem Paranormal, genérico)                  | Campanha                  | Ficha             |
| **VitalSign**      | Componente que exibe HP, Sanidade e Esforço com barras visuais                        | Atributo                  | Ficha / UI        |

<!-- Mantenha em ordem alfabética. Cada linha deve ter um dono mental claro. -->
