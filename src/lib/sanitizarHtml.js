/* ════════════════════════════════════════════════════════════════════════
 *  SANITIZAÇÃO DO TEXTO RICO
 *  ------------------------------------------------------------------------
 *  O editor de texto rico da ficha (`Tabs/shared/RichTextEditor`) guarda HTML,
 *  e oito lugares do app devolvem esse HTML à tela com `dangerouslySetInnerHTML`
 *  — habilidades, itens, rituais, anotações de ataque, bestiário.
 *
 *  Enquanto quem escreve é o dono da ficha, isso é só confiança em si mesmo.
 *  Mas o texto NÃO vem só do dono:
 *
 *    · o link de editor da ficha pública (`/p/:id?editor=…`) deixa um convidado
 *      montar a ficha inteira e mandá-la como sugestão;
 *    · na mesa, "permitir que qualquer pessoa edite" abre a ficha para qualquer
 *      membro da campanha;
 *    · e a ficha pública é lida por qualquer visitante, sem login.
 *
 *  Ou seja: um `<img src=x onerror=…>` escrito por um convidado e aprovado pelo
 *  dono viraria script rodando no navegador de todo mundo que abrisse a ficha —
 *  XSS armazenado clássico. Sanitizar na SAÍDA (e não só na entrada) é o que
 *  protege também o que já está gravado no Firestore hoje.
 *
 *  A limpeza usa o parser do próprio navegador (`DOMParser`), não expressão
 *  regular: parsear HTML com regex erra em casos que o navegador aceita
 *  (atributo sem aspas, tag malformada, entidade dupla) — e é justamente neles
 *  que o ataque mora. O documento criado pelo DOMParser é INERTE: nada é
 *  baixado nem executado durante a análise.
 * ════════════════════════════════════════════════════════════════════════ */

/* Tudo que o editor da ficha consegue produzir (negrito, itálico, sublinhado,
 * parágrafo, quebra, listas) mais o que os textos oficiais já usam. Qualquer
 * outra tag some, mas o TEXTO dela fica: apagar o conteúdo junto transformaria
 * uma tag errada em perda de dado do jogador. */
const TAGS_PERMITIDAS = new Set([
  "B", "STRONG", "I", "EM", "U", "S", "P", "BR", "DIV", "SPAN", "UL", "OL", "LI",
]);

/* Nenhum atributo passa. O editor não escreve atributo nenhum, e é em atributo
 * que vivem `onerror`, `href="javascript:"` e `style` com `url(...)`. Sem
 * allowlist de atributo não há brecha para revisar depois. */
const ATRIBUTOS_PERMITIDOS = new Set([]);

/* Tags cujo conteúdo NÃO deve sobreviver: aqui o texto interno é código, não
 * texto do jogador — mantê-lo viraria lixo visível na ficha. */
const TAGS_APAGADAS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT"]);

/**
 * Devolve o mesmo HTML sem nada executável.
 * @param {string} html
 * @returns {string} HTML seguro para `dangerouslySetInnerHTML`
 */
export function sanitizarHtml(html) {
  if (html === null || html === undefined) return "";
  const texto = String(html);
  if (!texto) return "";

  /* Sem DOM (Node puro, SSR): não dá para parsear com segurança, então
   * devolve o texto ESCAPADO — degrada a formatação, nunca a segurança. */
  if (typeof DOMParser === "undefined") return escaparTexto(texto);

  const doc = new DOMParser().parseFromString(`<body>${texto}</body>`, "text/html");
  limpar(doc.body);
  return doc.body.innerHTML;
}

/** Percorre em profundidade removendo o que não está na allowlist. */
function limpar(no) {
  /* Cópia da lista: o laço remove filhos e `childNodes` é uma coleção viva. */
  for (const filho of [...no.childNodes]) {
    if (filho.nodeType === 8 /* comentário */) { filho.remove(); continue; }
    if (filho.nodeType !== 1 /* elemento */) continue;

    const tag = filho.tagName;

    if (TAGS_APAGADAS.has(tag)) { filho.remove(); continue; }

    if (!TAGS_PERMITIDAS.has(tag)) {
      /* Tag desconhecida cai fora, mas o texto dela sobe para o lugar dela. */
      limpar(filho);
      filho.replaceWith(...filho.childNodes);
      continue;
    }

    for (const attr of [...filho.attributes]) {
      if (!ATRIBUTOS_PERMITIDOS.has(attr.name.toLowerCase())) filho.removeAttribute(attr.name);
    }
    limpar(filho);
  }
}

function escaparTexto(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default sanitizarHtml;
