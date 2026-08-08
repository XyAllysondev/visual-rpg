/**
 * Validação de fronteira na SAÍDA dos repositórios (spec 0032 AC-6).
 *
 * O problema que isto resolve tem nome neste projeto: **a tela quebra longe da origem**.
 * Um documento com `members` gravado errado atravessa o repositório cru, some dentro de um
 * `useState`, e reaparece três telas depois como `campaign.members.includes is not a function`
 * — num arquivo que não tem nada a ver com o dado. O rastro não aponta para a origem.
 *
 * Aqui o dado é conferido no ÚNICO ponto por onde ele entra no app, e qualquer surpresa vira
 * log com o prefixo do repositório e o ID do documento. O bug passa a ter endereço.
 *
 * ## Sem biblioteca de schema, de propósito
 * A spec 0032 põe zod/yup explicitamente fora de escopo: adotar dependência é decisão própria,
 * com ADR próprio. Isto é JavaScript puro no estilo de `paraEpochMs`/`comDatasEmMs` — funções
 * pequenas, declarativas e testáveis sem SDK.
 *
 * ## As duas regras que decidem o desenho
 *
 * **1. Corrige TIPO, nunca inventa PRESENÇA.** Campo presente com o tipo errado é coagido para
 * o tipo declarado. Campo AUSENTE continua ausente — é a mesma regra que `comDatasEmMs` já
 * adotou, e não é preguiça: a UI usa a ausência como informação. `CampaignCard` renderiza o
 * selo do sistema com `{campaign.system && …}`; preencher `system: "Genérico"` faria aparecer
 * um selo em campanhas que nunca escolheram sistema — mudança visível causada pela validação,
 * exatamente o que a spec proíbe. Preencher campo ausente seria INVENTAR dado, e um dado
 * inventado é indistinguível de um dado real três telas depois.
 *
 * **2. `undefined` é ausência; `null` depende do tipo.** `null` é o idioma deste banco para
 * "sem valor" em escalares (`userPhoto: null`, `coverImage: null`, e `paraEpochMs` devolvendo
 * `null` para "sem data") — então `texto`/`numero` deixam `null` passar. Já `members: null`
 * não é idioma nenhum: ninguém grava lista nula de propósito, e ela quebra `.includes` do
 * mesmo jeito que um número quebraria. Por isso `lista`/`mapa` coagem `null` para vazio.
 *
 * ## Rejeição
 * Só existe UM caso inutilizável de verdade, e ele não é campo faltando: é o documento cujo
 * `data()` não devolve objeto. `{ id, ...undefined }` produz um objeto só com `id`, que a UI
 * trata como registro válido e vazio. Esse é descartado da lista e logado. Rejeitar documento
 * legado por campo faltando seria PIOR que o problema — o usuário perderia acesso ao próprio
 * conteúdo (campanha sem `isActive`, ficha sem `id`, PV como `"18 (2d8+4)"` são todos legado
 * conhecido e legítimo).
 *
 * ## Custo
 * `watchRecent` entrega 50 mensagens a cada snapshot. O laço é N campos (3 a 7) de `in` +
 * uma chamada por campo, e **o objeto só é clonado quando algo mudou** — documento íntegro sai
 * pela mesma referência que entrou, sem alocação nenhuma.
 *
 * @see ./client.js — `paraEpochMs`/`comDatasEmMs`, o mesmo estilo
 * @see ../../../specs/0032-onda-3-fronteiras-e-quirks/spec.md AC-6
 */

/* ── Coercitores ───────────────────────────────────────────────────────────
 * Contrato de todos: devolver o PRÓPRIO valor recebido (identidade `===`) quando não há nada
 * a corrigir. É essa identidade que o normalizador usa para saber se mudou algo — sem ela,
 * cada documento íntegro seria clonado e logado à toa.
 */

/**
 * Lista. `undefined` (ausente) passa; qualquer outro não-array vira `[]`.
 *
 * `null` NÃO passa aqui de propósito: `campaign.members` nulo quebra `.includes` igual a um
 * número, e nenhum caminho de escrita deste app grava lista nula intencionalmente.
 */
export const lista = (v) => (Array.isArray(v) || v === undefined ? v : []);

/** Mapa de chave→valor (`memberNames`, `characterData`, `form`). Mesma regra de `lista`. */
export const mapa = (v) =>
  ((v !== null && typeof v === "object" && !Array.isArray(v)) || v === undefined ? v : {});

/**
 * Texto.
 *
 * Número e booleano viram string — é conversão sem perda, e conserta o caso real de um `name`
 * numérico quebrando o `.toLowerCase()` de um filtro de busca. Objeto/array viram `""`: não há
 * texto ali, e renderizar objeto direto derruba a árvore do React ("Objects are not valid as a
 * React child"), que é o crash mais caro desta família.
 *
 * `null` passa: é o idioma do banco para "sem valor" (`userPhoto: null`).
 */
export const texto = (v) => {
  if (typeof v === "string" || v === undefined || v === null) return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
};

/**
 * Número finito.
 *
 * String numérica é coagida (`maxPlayers: "8"` → `8`) porque `<input>` grava string e a
 * comparação `members.length >= "8"` só funciona por acidente. Presente e ilegível vira
 * `null`, e não um padrão inventado: quem lê já faz `|| DEFAULT_MAX_PLAYERS`, então `null`
 * cai no mesmo lugar sem que a fronteira precise conhecer a regra de negócio.
 */
export const numero = (v) => {
  if ((typeof v === "number" && Number.isFinite(v)) || v === undefined || v === null) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

/** Descrição curta e segura de um valor, para o log não despejar a ficha inteira no console. */
function descreva(v) {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return `array(${v.length})`;
  const t = typeof v;
  if (t === "object") return "objeto";
  if (t === "string") return v.length > 40 ? `string("${v.slice(0, 40)}…")` : `string("${v}")`;
  return `${t}(${String(v)})`;
}

/**
 * Monta o normalizador de um agregado. Chame no topo do módulo do repositório: os pares
 * campo→coercitor são resolvidos UMA vez, não a cada documento.
 *
 * @param {string} tag prefixo do log no padrão do projeto, `"<repo>.<op>"`
 *   (ex.: `"campaignsRepo.saida"`). Não é decorativo — é o que faz o dado torto ter endereço.
 * @param {Record<string, (v: unknown) => unknown>} tipos campo → coercitor.
 * @returns {(dados: unknown, id?: string) => object|null} o documento normalizado (a MESMA
 *   referência quando não havia nada a corrigir), ou `null` quando é para descartar.
 */
export function criarNormalizador(tag, tipos) {
  const regras = Object.entries(tipos);

  return function normalizar(dados, id) {
    if (dados === null || typeof dados !== "object" || Array.isArray(dados)) {
      console.error(
        `[${tag}] documento "${id}" DESCARTADO: o corpo veio como ${descreva(dados)}, não objeto.`
      );
      return null;
    }

    let saida = dados;
    for (let i = 0; i < regras.length; i += 1) {
      const campo = regras[i][0];
      if (!(campo in saida)) continue; // ausente continua ausente (ver cabeçalho)
      const antes = saida[campo];
      const depois = regras[i][1](antes);
      if (depois === antes) continue; // caminho quente: documento íntegro não paga nada
      if (saida === dados) saida = { ...dados };
      saida[campo] = depois;
      console.warn(
        `[${tag}] "${id}".${campo} veio como ${descreva(antes)} `
        + `e foi normalizado para ${descreva(depois)}.`
      );
    }
    return saida;
  };
}

/** Filtro dos documentos descartados. Existe para o `.filter(naoDescartado)` dos repos ler bem. */
export const naoDescartado = (doc) => doc !== null;
