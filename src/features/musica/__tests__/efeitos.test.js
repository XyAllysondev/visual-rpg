/* Mesa de efeitos — lógica pura do acervo.
 * Como em cenas.js, boa parte dos casos é sobre entrada suja: a lista vem do
 * localStorage, que é editável à mão e sobrevive a versões do app. */

import {
  CHAVE_EFEITOS, VOLUME_PADRAO, SUGESTOES, limitarVolume, normalizarEfeitos,
  lerEfeitos, gravarEfeitos, adicionarEfeito, removerEfeito, renomearEfeito,
  definirVolume, nomeAmigavel, arquivosEmUso,
} from "../efeitos";

const fakeStorage = (inicial = {}) => {
  const mapa = { ...inicial };
  return {
    getItem: (k) => (k in mapa ? mapa[k] : null),
    setItem: (k, v) => { mapa[k] = String(v); },
    _dump: () => mapa,
  };
};

const ef = (id, nome = "Efeito", fileId = `f${id}`) => ({ id, nome, fileId, volume: VOLUME_PADRAO });

describe("sugestões", () => {
  it("cobrem os quatro grupos e citam o que o Andre pediu", () => {
    expect(SUGESTOES.map((g) => g.grupo)).toEqual(["Vozes", "Ambiente", "Impacto", "Paranormal"]);
    const todos = SUGESTOES.flatMap((g) => g.itens);
    expect(todos).toEqual(expect.arrayContaining([
      "Criança falando oi", "Criança chorando", "Mulher gritando",
    ]));
  });
});

describe("limitarVolume", () => {
  it("prende entre 0 e 1", () => {
    expect(limitarVolume(-3)).toBe(0);
    expect(limitarVolume(0.5)).toBe(0.5);
    expect(limitarVolume(9)).toBe(1);
  });
  it("valor não numérico cai no padrão", () => {
    expect(limitarVolume("alto")).toBe(VOLUME_PADRAO);
    expect(limitarVolume(undefined)).toBe(VOLUME_PADRAO);
    expect(limitarVolume(NaN)).toBe(VOLUME_PADRAO);
  });
});

describe("normalizarEfeitos", () => {
  it("descarta item sem id, sem arquivo ou de tipo errado", () => {
    const out = normalizarEfeitos([
      { id: "1", nome: "Grito", fileId: "a" },
      { nome: "sem id", fileId: "b" },
      { id: "2", nome: "sem arquivo" },
      null,
      "texto",
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("1");
  });

  it("id repetido entra uma vez só — key duplicada quebraria a lista no React", () => {
    const out = normalizarEfeitos([ef("1", "Primeiro"), ef("1", "Segundo")]);
    expect(out).toHaveLength(1);
    expect(out[0].nome).toBe("Primeiro");
  });

  it("coage id e fileId a string e corta nome gigante", () => {
    const out = normalizarEfeitos([{ id: 7, fileId: 1712345, nome: "x".repeat(200) }]);
    expect(out[0].id).toBe("7");
    expect(out[0].fileId).toBe("1712345");
    expect(out[0].nome).toHaveLength(60);
  });

  it("volume fora da faixa é corrigido, não descartado", () => {
    expect(normalizarEfeitos([{ id: "1", fileId: "a", volume: 12 }])[0].volume).toBe(1);
  });

  it("lixo total vira lista vazia", () => {
    expect(normalizarEfeitos(null)).toEqual([]);
    expect(normalizarEfeitos({})).toEqual([]);
    expect(normalizarEfeitos("nada")).toEqual([]);
  });
});

describe("persistência", () => {
  it("grava e lê pela chave nx_efeitos", () => {
    const s = fakeStorage();
    gravarEfeitos([ef("1", "Grito")], s);
    expect(Object.keys(s._dump())).toEqual([CHAVE_EFEITOS]);
    expect(lerEfeitos(s)[0].nome).toBe("Grito");
  });

  it("JSON corrompido vira lista vazia, não exceção", () => {
    const s = fakeStorage({ [CHAVE_EFEITOS]: "[isso nao e json" });
    expect(() => lerEfeitos(s)).not.toThrow();
    expect(lerEfeitos(s)).toEqual([]);
  });

  it("storage que estoura cota não derruba a sessão", () => {
    const explode = { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); } };
    expect(() => gravarEfeitos([ef("1")], explode)).not.toThrow();
  });
});

describe("operações", () => {
  it("adicionar não muta a lista recebida", () => {
    const antes = [ef("1")];
    const depois = adicionarEfeito(antes, ef("2", "Novo"));
    expect(antes).toHaveLength(1);
    expect(depois).toHaveLength(2);
  });

  it("adicionar o mesmo id duas vezes não duplica", () => {
    const lista = adicionarEfeito(adicionarEfeito([], ef("1")), ef("1"));
    expect(lista).toHaveLength(1);
  });

  it("adicionar sem arquivo é ignorado", () => {
    expect(adicionarEfeito([], { id: "9", nome: "sem arquivo" })).toEqual([]);
  });

  it("dois efeitos PODEM apontar para o mesmo arquivo", () => {
    let l = adicionarEfeito([], { id: "1", nome: "Grito curto", fileId: "mesmo" });
    l = adicionarEfeito(l, { id: "2", nome: "Grito alto", fileId: "mesmo" });
    expect(l).toHaveLength(2);
    expect(arquivosEmUso(l).size).toBe(1);
  });

  it("remover tira só o pedido", () => {
    const l = removerEfeito([ef("1"), ef("2")], "1");
    expect(l.map((e) => e.id)).toEqual(["2"]);
  });

  it("renomear troca o rótulo; nome vazio não apaga", () => {
    const l = renomearEfeito([ef("1", "Antigo")], "1", "  Criança falando oi  ");
    expect(l[0].nome).toBe("Criança falando oi");
    expect(renomearEfeito(l, "1", "   ")[0].nome).toBe("Criança falando oi");
  });

  it("volume por efeito é independente e fica na faixa", () => {
    let l = [ef("1"), ef("2")];
    l = definirVolume(l, "1", 0.2);
    l = definirVolume(l, "2", 5);
    expect(l[0].volume).toBe(0.2);
    expect(l[1].volume).toBe(1);
  });
});

describe("nomeAmigavel", () => {
  it("tira extensão, numeração e separadores", () => {
    expect(nomeAmigavel("3-porta_rangendo.MP3")).toBe("Porta rangendo");
    expect(nomeAmigavel("crianca-falando-oi.wav")).toBe("Crianca falando oi");
    expect(nomeAmigavel("01_grito.ogg")).toBe("Grito");
  });
  it("nome que sobra vazio não vira string vazia", () => {
    expect(nomeAmigavel("12-.mp3")).toBe("Efeito");
    expect(nomeAmigavel("")).toBe("Efeito");
    expect(nomeAmigavel(null)).toBe("Efeito");
  });
  it("preserva nome já legível", () => {
    expect(nomeAmigavel("Mulher gritando.mp3")).toBe("Mulher gritando");
  });
});
