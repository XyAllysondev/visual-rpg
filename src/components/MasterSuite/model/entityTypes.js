/* Forja do Mestre — AS 11 ESPÉCIES DE ENTIDADE (spec 0027, AC-3).
 *
 * Fonte única da verdade do vocabulário da wiki. Módulo de LÓGICA PURA: só dados e funções,
 * nada de React, nada de Firestore. A arte (ícone SVG de cada tipo) mora em módulo separado —
 * aqui ficam apenas id, rótulo PT, plural, cor e a dica que explica o tipo pro mestre.
 *
 * A ordem do array é a ordem que a UI exibe: alfabética pelos rótulos em português.
 *
 * Cores: hex de 6 dígitos, escolhidos em matizes bem separados (≈33° entre vizinhos) e claros
 * o bastante pra passar AA sobre os fundos grafite do tema (`--bg` #14141c … `--card2` #2c2c39).
 * Nenhum deles colide com o dourado do acento OP (#c9a84c), pra chip de tipo não virar botão.
 */

export const ENTITY_TYPES = [
  {
    id: "concept",
    label: "Conceito",
    plural: "Conceitos",
    color: "#a78bfa",
    hint: "Ideias, leis, maldições e forças abstratas que movem o mundo.",
  },
  {
    id: "creature",
    label: "Criatura",
    plural: "Criaturas",
    color: "#a3e635",
    hint: "Bichos, monstros e horrores que habitam o cenário.",
  },
  {
    id: "deity",
    label: "Divindade",
    plural: "Divindades",
    color: "#fbbf24",
    hint: "Deuses, entidades e patronos cultuados pelos povos do mundo.",
  },
  {
    id: "event",
    label: "Evento",
    plural: "Eventos",
    color: "#fb7185",
    hint: "Acontecimentos que marcaram o mundo: guerras, pactos, catástrofes.",
  },
  {
    id: "item",
    label: "Item",
    plural: "Itens",
    color: "#38bdf8",
    hint: "Artefatos, relíquias e objetos com história própria.",
  },
  {
    id: "location",
    label: "Local",
    plural: "Locais",
    color: "#2dd4bf",
    hint: "Cidades, ruínas, reinos e qualquer ponto do mapa.",
  },
  {
    id: "organization",
    label: "Organização",
    plural: "Organizações",
    color: "#60a5fa",
    hint: "Casas nobres, ordens, guildas, cultos e facções.",
  },
  {
    id: "character",
    label: "Personagem",
    plural: "Personagens",
    color: "#f472b6",
    hint: "Gente do mundo: aliados, vilões e todo NPC com nome.",
  },
  {
    id: "race",
    label: "Raça",
    plural: "Raças",
    color: "#fb923c",
    hint: "Povos, linhagens e ancestralidades que habitam o mundo.",
  },
  {
    id: "sessionSummary",
    label: "Resumo de Sessão",
    plural: "Resumos de Sessão",
    color: "#cbd5e1",
    hint: "O que aconteceu na mesa, sessão a sessão, do jeito que ficou na memória.",
  },
  {
    id: "route",
    label: "Rota",
    plural: "Rotas",
    color: "#e879f9",
    hint: "Estradas, rotas comerciais e caminhos que ligam os locais.",
  },
];

export const ENTITY_TYPE_IDS = ENTITY_TYPES.map((t) => t.id);

/* Tipo genérico de segurança: entidade legada, importada ou com `type` corrompido continua
 * renderizável. NÃO entra em ENTITY_TYPES (não é escolhível no formulário). */
export const FALLBACK_ENTITY_TYPE = {
  id: "unknown",
  label: "Outro",
  plural: "Outros",
  color: "#a89a7c",
  hint: "Tipo desconhecido — provavelmente veio de uma importação.",
};

const BY_ID = ENTITY_TYPES.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, Object.create(null));

/** Resolve um tipo por id. Nunca lança e nunca devolve undefined. */
export function getEntityType(id) {
  if (typeof id !== "string") return FALLBACK_ENTITY_TYPE;
  return BY_ID[id] || FALLBACK_ENTITY_TYPE;
}
