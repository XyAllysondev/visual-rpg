/* Cenas sonoras — lógica pura do vínculo cena → playlist.
 * O valor vem do localStorage, que é editável à mão e sobrevive a versões do
 * app; por isso boa parte destes casos é sobre entrada suja. */

import {
  CENAS_OP, CHAVE_CENAS, ehCenaValida, cenaPorId, normalizarVinculos,
  lerVinculos, gravarVinculos, vincular, desvincular, cenaTocando,
  montarTira, contarVinculadas,
} from "../cenas";

/* localStorage sintético — o jsdom tem um, mas queremos controlar o conteúdo
   bruto (inclusive JSON inválido) sem depender do ambiente. */
const fakeStorage = (inicial = {}) => {
  const mapa = { ...inicial };
  return {
    getItem: (k) => (k in mapa ? mapa[k] : null),
    setItem: (k, v) => { mapa[k] = String(v); },
    _dump: () => mapa,
  };
};

const pl = (id, name, svc = "local") => ({ id, name, svc });

describe("catálogo de cenas", () => {
  it("tem oito cenas, com id único e nome", () => {
    expect(CENAS_OP).toHaveLength(8);
    const ids = CENAS_OP.map((c) => c.id);
    expect(new Set(ids).size).toBe(8);
    expect(CENAS_OP.every((c) => c.nome && c.desc)).toBe(true);
  });

  it("usa os termos do livro para os momentos que ele nomeia", () => {
    const ids = CENAS_OP.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["investigacao", "combate", "interludio", "ritual", "outro_lado"]));
  });

  it("valida e resolve id", () => {
    expect(ehCenaValida("combate")).toBe(true);
    expect(ehCenaValida("churrasco")).toBe(false);
    expect(cenaPorId("ritual").nome).toBe("Ritual");
    expect(cenaPorId("nada")).toBeNull();
  });
});

describe("normalizarVinculos — entrada suja não derruba a tela", () => {
  it("descarta cena inexistente, serviço desconhecido e id vazio", () => {
    const sujo = {
      combate: { svc: "local", playlistId: "1", playlistName: "Batalha" },
      churrasco: { svc: "local", playlistId: "9" },        // cena não existe
      ritual: { svc: "napster", playlistId: "2" },          // serviço inválido
      terror: { svc: "local", playlistId: "" },             // sem id
      tensao: null,                                         // nulo
      perseguicao: "string solta",                          // tipo errado
    };
    expect(normalizarVinculos(sujo)).toEqual({
      combate: { svc: "local", playlistId: "1", playlistName: "Batalha" },
    });
  });

  it("aceita os três serviços e completa o nome ausente", () => {
    const out = normalizarVinculos({
      combate: { svc: "youtube", playlistId: "a" },
      ritual: { svc: "spotify", playlistId: "b", playlistName: "Conjuração" },
    });
    expect(out.combate.playlistName).toBe("Playlist");
    expect(out.ritual.playlistName).toBe("Conjuração");
  });

  it("devolve mapa vazio para lixo total", () => {
    expect(normalizarVinculos(null)).toEqual({});
    expect(normalizarVinculos([1, 2])).toEqual({});
    expect(normalizarVinculos("texto")).toEqual({});
  });

  it("coage playlistId a string — o id do YouTube é texto, o local é número", () => {
    const out = normalizarVinculos({ combate: { svc: "local", playlistId: 1712345 } });
    expect(out.combate.playlistId).toBe("1712345");
  });
});

describe("persistência", () => {
  it("grava e lê pela chave nx_cenas_op", () => {
    const s = fakeStorage();
    gravarVinculos({ combate: { svc: "local", playlistId: "7", playlistName: "Batalha" } }, s);
    expect(Object.keys(s._dump())).toEqual([CHAVE_CENAS]);
    expect(lerVinculos(s).combate.playlistName).toBe("Batalha");
  });

  it("JSON corrompido no localStorage vira mapa vazio, não exceção", () => {
    const s = fakeStorage({ [CHAVE_CENAS]: "{nao é json" });
    expect(() => lerVinculos(s)).not.toThrow();
    expect(lerVinculos(s)).toEqual({});
  });

  it("chave ausente vira mapa vazio", () => {
    expect(lerVinculos(fakeStorage())).toEqual({});
  });

  it("grava já normalizado — lixo não persiste", () => {
    const s = fakeStorage();
    gravarVinculos({ churrasco: { svc: "local", playlistId: "1" } }, s);
    expect(JSON.parse(s._dump()[CHAVE_CENAS])).toEqual({});
  });

  it("storage que estoura cota não derruba o mestre no meio da sessão", () => {
    const explode = { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); } };
    expect(() => gravarVinculos({ combate: { svc: "local", playlistId: "1" } }, explode)).not.toThrow();
  });
});

describe("vincular / desvincular", () => {
  it("vincula sem mutar o mapa recebido", () => {
    const antes = {};
    const depois = vincular(antes, "combate", pl("7", "Batalha"));
    expect(antes).toEqual({});
    expect(depois.combate).toEqual({ svc: "local", playlistId: "7", playlistName: "Batalha" });
  });

  it("revincular a mesma cena troca a playlist", () => {
    let v = vincular({}, "combate", pl("7", "Batalha"));
    v = vincular(v, "combate", pl("9", "Outra"));
    expect(v.combate.playlistId).toBe("9");
    expect(Object.keys(v)).toHaveLength(1);
  });

  it("a MESMA playlist pode servir a duas cenas", () => {
    let v = vincular({}, "tensao", pl("7", "Ambiente"));
    v = vincular(v, "terror", pl("7", "Ambiente"));
    expect(contarVinculadas(v)).toBe(2);
  });

  it("cena inválida ou playlist sem id não vinculam nada", () => {
    expect(vincular({}, "churrasco", pl("7", "x"))).toEqual({});
    expect(vincular({}, "combate", { name: "sem id" })).toEqual({});
  });

  it("desvincular remove só a cena pedida", () => {
    let v = vincular(vincular({}, "combate", pl("1", "A")), "ritual", pl("2", "B"));
    v = desvincular(v, "combate");
    expect(Object.keys(v)).toEqual(["ritual"]);
  });
});

describe("cenaTocando", () => {
  const v = {
    combate: { svc: "local", playlistId: "7", playlistName: "Batalha" },
    ritual: { svc: "youtube", playlistId: "7", playlistName: "Conjuração" },
  };

  it("acha a cena pela playlist em reprodução", () => {
    expect(cenaTocando(v, { svc: "local", playlistId: "7" })).toBe("combate");
  });

  it("NÃO confunde ids iguais de serviços diferentes", () => {
    expect(cenaTocando(v, { svc: "youtube", playlistId: "7" })).toBe("ritual");
  });

  it("nada tocando, ou playlist fora das cenas, devolve null", () => {
    expect(cenaTocando(v, null)).toBeNull();
    expect(cenaTocando(v, { svc: "local", playlistId: "99" })).toBeNull();
  });
});

describe("montarTira", () => {
  const acervo = { local: [pl("7", "Batalha")], youtube: [], spotify: [] };

  it("devolve as oito cenas mesmo sem vínculo nenhum", () => {
    const tira = montarTira({}, acervo, null);
    expect(tira).toHaveLength(8);
    expect(tira.every((c) => c.vinculo === null && c.disponivel === false)).toBe(true);
  });

  it("marca disponível quando a playlist existe no acervo", () => {
    const v = vincular({}, "combate", pl("7", "Batalha"));
    const combate = montarTira(v, acervo, null).find((c) => c.id === "combate");
    expect(combate.disponivel).toBe(true);
    expect(combate.vinculo.playlistName).toBe("Batalha");
  });

  it("VÍNCULO ÓRFÃO: playlist apagada mantém a cena listada, marcada indisponível", () => {
    const v = vincular({}, "combate", pl("7", "Batalha"));
    const semAcervo = montarTira(v, { local: [] }, null).find((c) => c.id === "combate");
    expect(semAcervo.vinculo).not.toBeNull();   // o mestre ainda vê o que perdeu
    expect(semAcervo.disponivel).toBe(false);
  });

  it("marca a cena que está tocando", () => {
    const v = vincular({}, "combate", pl("7", "Batalha"));
    const tira = montarTira(v, acervo, { svc: "local", playlistId: "7" });
    expect(tira.find((c) => c.id === "combate").tocando).toBe(true);
    expect(tira.filter((c) => c.tocando)).toHaveLength(1);
  });

  it("acervo ausente não quebra — só marca tudo indisponível", () => {
    const v = vincular({}, "combate", pl("7", "Batalha"));
    expect(() => montarTira(v, undefined, null)).not.toThrow();
    expect(montarTira(v, {}, null).find((c) => c.id === "combate").disponivel).toBe(false);
  });

  it("mantém sempre a ordem do catálogo", () => {
    const ordem = montarTira({ terror: { svc: "local", playlistId: "7" } }, acervo, null).map((c) => c.id);
    expect(ordem).toEqual(CENAS_OP.map((c) => c.id));
  });
});
