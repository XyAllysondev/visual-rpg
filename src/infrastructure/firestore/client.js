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
 * Cancelamento inerte, para os `watch*` que retornam cedo (uid nulo etc.).
 * Existir evita `if (unsub) unsub()` espalhado nos `useEffect` — quem chama sempre
 * recebe uma função, e chamá-la duas vezes é seguro.
 */
export const NOOP_UNSUBSCRIBE = () => {};
