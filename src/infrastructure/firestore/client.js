/**
 * Ponto de contato com o SDK do Firestore. Nada fora de `src/infrastructure/` importa
 * `firebase/firestore` (spec 0029 AC-1, defendido por ESLint no AC-5).
 *
 * Expõe duas coisas: como endereçar um documento (`docAt`/`colAt`, sempre a partir de
 * `paths.js`) e a POLÍTICA DE ERRO (AC-4).
 *
 * ## Política de erro
 * Toda função de repositório declara no JSDoc `@policy strict` ou `@policy silent`:
 *
 * - `strict` — a Promise rejeita. Quem chama decide o que mostrar. Escreva a função normal,
 *   sem envelope; o `@policy strict` é a documentação. Use quando perder o dado importa
 *   (ex.: salvar ficha — `useCharacter` precisa distinguir "sem fichas" de "falhou").
 * - `silent` — envolve com `silent()`: loga com prefixo `[repo.op]` e devolve o fallback
 *   documentado. Use SÓ onde o legado já engolia o erro; a spec 0029 preserva comportamento
 *   (AC-7), não conserta falha silenciosa — isso é decisão da onda 3.
 *
 * @see ../../../specs/0029-camada-de-infraestrutura/design.md
 */
import { doc, collection } from "firebase/firestore";
import { db } from "../../firebase";

export { db };

/** @param {string[]} segments caminho vindo de `paths.js` */
export const docAt = (segments) => doc(db, ...segments);

/** @param {string[]} segments caminho vindo de `paths.js` */
export const colAt = (segments) => collection(db, ...segments);

/**
 * Envelope da política `silent`: nunca rejeita, loga e devolve `fallback`.
 *
 * O `tag` NÃO é decorativo — é o que torna a falha silenciosa rastreável no console.
 * Use sempre `"<repo>.<operação>"` (ex.: `"publicSheetsRepo.save"`).
 *
 * @template T
 * @param {string} tag        prefixo do log, no formato `repo.operação`
 * @param {T} fallback        valor devolvido quando falha (documente-o no JSDoc de quem chama)
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function silent(tag, fallback, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`[${tag}] falhou:`, e);
    return fallback;
  }
}

/**
 * Converte QUALQUER forma de data vinda do Firestore em **epoch-ms numérico** (spec 0032 AC-5).
 *
 * Nenhum campo de data sai de um repositório como primitiva do SDK — era a última que ainda
 * atravessava a fronteira (dívida registrada no ADR-0010). Quem consome lê `number`, e só.
 *
 * Aceita as três formas que existem hoje no banco:
 * - `Timestamp` do SDK (tem `.toMillis()`) — o caminho normal de um snapshot ao vivo;
 * - objeto cru `{seconds, nanoseconds}` ou `{_seconds, _nanoseconds}` — é assim que a data
 *   volta de cache/serialização, quando o SDK não reidrata a classe;
 * - `number` — campo que já nasceu epoch-ms, ou valor que passou por aqui duas vezes
 *   (a função é IDEMPOTENTE de propósito: normalizar o normalizado devolve o mesmo número).
 *
 * ## "Sem data" é `null`, não `0` nem `Date.now()`
 * O caso que manda nessa escolha é a **escrita otimista**: quem envia uma mensagem recebe o
 * próprio documento de volta ANTES de o servidor carimbar o `serverTimestamp()`, e nesse
 * instante o campo chega `null`. Devolver `0` colocaria a mensagem em 1970 (sumiria pelo corte
 * do TTL); devolver `Date.now()` mentiria uma data que o repositório não tem e apagaria a
 * informação "ainda não carimbada". `null` preserva o fato, e quem consome aplica o fallback
 * que já aplicava — exatamente o que o `?? Date.now()` do chat sempre fez.
 *
 * @param {unknown} valor
 * @returns {number|null} epoch-ms, ou `null` quando não há data legível
 */
export function paraEpochMs(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (!valor || typeof valor !== "object") return null;
  if (valor instanceof Date) {
    const ms = valor.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof valor.toMillis === "function") {
    const ms = valor.toMillis();
    return typeof ms === "number" && Number.isFinite(ms) ? ms : null;
  }
  const seg = typeof valor.seconds === "number" ? valor.seconds
    : typeof valor._seconds === "number" ? valor._seconds
      : null;
  if (seg === null || !Number.isFinite(seg)) return null;
  const nano = typeof valor.nanoseconds === "number" ? valor.nanoseconds
    : typeof valor._nanoseconds === "number" ? valor._nanoseconds
      : 0;
  return seg * 1000 + Math.floor((Number.isFinite(nano) ? nano : 0) / 1e6);
}

/**
 * Aplica `paraEpochMs` aos campos de data de um documento já achatado.
 *
 * Campo AUSENTE continua ausente — normalizar criaria uma chave `timestamp: null` em documentos
 * (`typing`, por exemplo) que nunca a tiveram, e quem faz `toEqual` na borda veria diferença.
 *
 * @param {object} dados
 * @param {string[]} campos nomes dos campos de data do agregado
 */
export function comDatasEmMs(dados, campos) {
  const saida = { ...dados };
  for (const campo of campos) {
    if (campo in saida) saida[campo] = paraEpochMs(saida[campo]);
  }
  return saida;
}

/**
 * Cancelamento inerte, para os `watch*` que retornam cedo (uid nulo etc.).
 * Existir evita `if (unsub) unsub()` espalhado nos `useEffect` — quem chama sempre
 * recebe uma função, e chamá-la duas vezes é seguro.
 */
export const NOOP_UNSUBSCRIBE = () => {};
