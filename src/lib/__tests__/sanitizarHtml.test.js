/* Gate do sanitizador do texto rico (revisão de 2026-08-07).
 *
 * O que estes testes protegem, em uma frase: a ficha aceita HTML de gente que
 * NÃO é o dono (link de editor da ficha pública, "qualquer pessoa edita" na
 * mesa) e devolve esse HTML à tela com `dangerouslySetInnerHTML` — inclusive
 * para visitantes sem login. */
import { sanitizarHtml } from "../sanitizarHtml";

describe("o que o editor da ficha escreve continua funcionando", () => {
  it("mantém negrito, itálico, sublinhado e quebra", () => {
    const html = "<b>Custo:</b> 2 PE<br><i>reação</i> e <u>alcance curto</u>";
    expect(sanitizarHtml(html)).toBe(html);
  });
  it("mantém parágrafos e listas", () => {
    const html = "<p>um</p><ul><li>a</li><li>b</li></ul>";
    expect(sanitizarHtml(html)).toBe(html);
  });
  it("texto puro atravessa intacto", () => {
    expect(sanitizarHtml("2d6 de dano de Morte")).toBe("2d6 de dano de Morte");
  });
  it("vazio, nulo e indefinido viram string vazia", () => {
    expect(sanitizarHtml("")).toBe("");
    expect(sanitizarHtml(null)).toBe("");
    expect(sanitizarHtml(undefined)).toBe("");
  });
});

describe("o que um editor convidado NÃO consegue injetar", () => {
  it("script some inteiro — código não é texto do jogador", () => {
    expect(sanitizarHtml('<script>alert(1)</script>')).toBe("");
    expect(sanitizarHtml('texto<script>fetch("//x")</script>fim')).toBe("textofim");
  });

  it("o clássico img/onerror não sobra nada", () => {
    const saida = sanitizarHtml('<img src=x onerror="alert(document.cookie)">');
    expect(saida).not.toMatch(/onerror/i);
    expect(saida).not.toMatch(/<img/i);
  });

  it("manipulador de evento em tag PERMITIDA também cai", () => {
    const saida = sanitizarHtml('<b onclick="roubar()">negrito</b>');
    expect(saida).toBe("<b>negrito</b>");
    expect(saida).not.toMatch(/onclick/i);
  });

  it("link com javascript: não vira link", () => {
    const saida = sanitizarHtml('<a href="javascript:alert(1)">clique</a>');
    expect(saida).not.toMatch(/href/i);
    expect(saida).toBe("clique");   // o texto do jogador sobrevive; a tag não
  });

  it("style e iframe somem com conteúdo e tudo", () => {
    expect(sanitizarHtml('<style>body{display:none}</style>ok')).toBe("ok");
    expect(sanitizarHtml('<iframe src="//mal"></iframe>ok')).toBe("ok");
  });

  it("atributo sem aspas — onde regex erra e o parser acerta", () => {
    const saida = sanitizarHtml('<b onmouseover=alert(1)>x</b>');
    expect(saida).toBe("<b>x</b>");
  });

  it("svg com onload não passa", () => {
    const saida = sanitizarHtml('<svg onload="alert(1)"><circle r="9"/></svg>');
    expect(saida).not.toMatch(/onload|svg|circle/i);
  });

  it("comentário HTML não fica na saída", () => {
    expect(sanitizarHtml("a<!-- nota -->b")).toBe("ab");
  });

  it("tag desconhecida some, texto fica — não se perde dado do jogador", () => {
    expect(sanitizarHtml("<blink>importante</blink>")).toBe("importante");
    expect(sanitizarHtml("<div><marquee>o vilão</marquee></div>")).toBe("<div>o vilão</div>");
  });

  it("sanitizar duas vezes dá o mesmo resultado (idempotente)", () => {
    const uma = sanitizarHtml('<b onclick="x()">a</b><script>y()</script>');
    expect(sanitizarHtml(uma)).toBe(uma);
  });
});
