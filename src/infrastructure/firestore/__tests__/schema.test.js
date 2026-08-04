import { criarNormalizador, lista, mapa, texto, numero, naoDescartado } from "../schema";

// O preset Jest do CRA usa `resetMocks: true`: o espião do console é apagado antes de cada
// teste, então ele é reinstalado aqui — e não uma vez só no topo do arquivo.
let aviso;
let erro;
beforeEach(() => {
  aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
  erro = jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("coercitores — o contrato da identidade", () => {
  /* Todo coercitor devolve a PRÓPRIA referência quando não há nada a corrigir. É essa
     identidade que o normalizador usa para decidir se clona e se loga: sem ela, cada
     documento íntegro do chat seria clonado 50 vezes por snapshot. */
  it("devolvem a mesma referência para valor já do tipo certo", () => {
    const arr = [1, 2];
    const obj = { a: 1 };
    expect(lista(arr)).toBe(arr);
    expect(mapa(obj)).toBe(obj);
    expect(texto("oi")).toBe("oi");
    expect(numero(7)).toBe(7);
  });

  it("`lista` conserta qualquer não-array, inclusive `null`", () => {
    // `members: null` quebra `.includes` igual a um número quebraria, e nenhuma escrita
    // deste app grava lista nula de propósito — por isso `null` NÃO passa aqui.
    expect(lista(null)).toEqual([]);
    expect(lista("u1,u2")).toEqual([]);
    expect(lista({ 0: "u1" })).toEqual([]);
    expect(lista(3)).toEqual([]);
  });

  it("`mapa` conserta array e escalar, e recusa `null`", () => {
    expect(mapa(null)).toEqual({});
    expect(mapa([])).toEqual({});
    expect(mapa("ficha")).toEqual({});
  });

  it("`texto` converte escalar sem perda e apaga objeto", () => {
    expect(texto(13)).toBe("13");
    expect(texto(true)).toBe("true");
    // Objeto renderizado direto derruba a árvore do React; "" deixa a bolha vazia e o log.
    expect(texto({ html: "<b>" })).toBe("");
    expect(texto([1, 2])).toBe("");
  });

  it("`numero` lê string numérica e devolve `null` no ilegível", () => {
    expect(numero("8")).toBe(8);   // `<input>` grava string
    expect(numero(" 8 ")).toBe(8);
    expect(numero("oito")).toBeNull();
    expect(numero(NaN)).toBeNull();
    expect(numero(Infinity)).toBeNull();
  });

  it("AUSENTE continua ausente em todos eles — a fronteira não inventa dado", () => {
    // Preencher campo que a campanha legada nunca teve mudaria o que a tela mostra
    // (`CampaignCard` esconde o selo do sistema com `{campaign.system && …}`).
    expect(lista(undefined)).toBeUndefined();
    expect(mapa(undefined)).toBeUndefined();
    expect(texto(undefined)).toBeUndefined();
    expect(numero(undefined)).toBeUndefined();
  });

  it("`null` passa nos escalares — é o idioma do banco para 'sem valor'", () => {
    expect(texto(null)).toBeNull();   // `userPhoto: null` é gravado assim de propósito
    expect(numero(null)).toBeNull();
  });
});

describe("criarNormalizador", () => {
  const normalizar = criarNormalizador("repoDeTeste.saida", {
    members: lista,
    memberNames: mapa,
    name: texto,
    maxPlayers: numero,
  });

  it("documento ÍNTEGRO sai pela MESMA referência, sem log", () => {
    // Regra 1 da spec: zero mudança visível — e zero custo — para dado bem-formado.
    const doc = { members: ["u1"], memberNames: { u1: "Ana" }, name: "A Ordem", maxPlayers: 6 };
    expect(normalizar(doc, "c1")).toBe(doc);
    expect(aviso).not.toHaveBeenCalled();
    expect(erro).not.toHaveBeenCalled();
  });

  it("campo de TIPO ERRADO é normalizado, sem tocar no resto do documento", () => {
    const doc = { members: "u1", name: "A Ordem", extra: { intocado: true } };
    const saida = normalizar(doc, "c1");

    expect(saida.members).toEqual([]);
    expect(saida.name).toBe("A Ordem");
    expect(saida.extra).toBe(doc.extra);   // o resto passa por referência
    expect(doc.members).toBe("u1");        // e o documento de origem não é mutado
  });

  it("campo AUSENTE não vira chave nova", () => {
    // É o que garante que a validação não muda o que a UI vê num documento legado.
    const saida = normalizar({ name: "A Ordem" }, "c1");
    expect(saida).toEqual({ name: "A Ordem" });
    expect("members" in saida).toBe(false);
    expect("maxPlayers" in saida).toBe(false);
  });

  it("valor LEGADO conhecido atravessa intocado", () => {
    // Campanha criada antes de `isActive`/`maxPlayers` existirem: nada declarado, nada mexido.
    const doc = { name: "Mesa de 2024", inviteCode: "ABC234" };
    expect(normalizar(doc, "legada")).toBe(doc);
    expect(aviso).not.toHaveBeenCalled();
  });

  it("LOGA com a tag do repo, o id do documento e o campo — a rastreabilidade é o ponto", () => {
    /* Sem este teste o log seria código morto, e a rastreabilidade — que é o valor inteiro
       do AC-6 — não estaria provada. O projeto já registrou essa armadilha 4 vezes. */
    normalizar({ members: 3 }, "c-torta");

    expect(aviso).toHaveBeenCalledTimes(1);
    const msg = aviso.mock.calls[0][0];
    expect(msg).toContain("[repoDeTeste.saida]");
    expect(msg).toContain("c-torta");
    expect(msg).toContain("members");
    expect(msg).toContain("number(3)");   // o que veio
    expect(msg).toContain("array(0)");    // no que virou
  });

  it("loga UMA vez por campo torto, e não uma por documento", () => {
    normalizar({ members: 3, memberNames: [], name: "ok" }, "c1");
    expect(aviso).toHaveBeenCalledTimes(2);
  });

  it("DESCARTA (e loga como erro) o documento cujo corpo não é objeto", () => {
    /* `d.data()` pode devolver `undefined`, e `{id, ...undefined}` produz um objeto só com
       `id` — que a UI trata como registro válido e vazio. Esse é o único caso realmente
       inutilizável; campo faltando NUNCA é motivo de descarte, senão o usuário perderia
       acesso ao próprio conteúdo legado. */
    expect(normalizar(undefined, "fantasma")).toBeNull();
    expect(normalizar(null, "nulo")).toBeNull();
    expect(normalizar("corrompido", "texto")).toBeNull();
    expect(normalizar([1, 2], "array")).toBeNull();

    expect(erro).toHaveBeenCalledTimes(4);
    expect(erro.mock.calls[0][0]).toContain("[repoDeTeste.saida]");
    expect(erro.mock.calls[0][0]).toContain("fantasma");
    expect(erro.mock.calls[0][0]).toContain("DESCARTADO");
  });

  it("`naoDescartado` filtra só os `null`", () => {
    expect([{ a: 1 }, null, { b: 2 }].filter(naoDescartado)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("trunca string longa no log, para não despejar a ficha inteira no console", () => {
    normalizar({ members: "u".repeat(200) }, "c1");
    expect(aviso.mock.calls[0][0]).toContain("…");
    expect(aviso.mock.calls[0][0].length).toBeLessThan(200);
  });
});
