/**
 * Gate do grafo do Mapa-Múndi (spec 0028 · AC-4, F2).
 * Escrito ANTES da implementação. Lógica pura: nada de React, Firebase ou DOM.
 */
import {
  NODE_TYPES,
  TIPO_PADRAO,
  criarGrafo,
  criarNo,
  criarTrilha,
  getNodeType,
  limitesDoGrafo,
  moverNo,
  noEmPonto,
  pontasDaTrilha,
  pontosDaTrilha,
  removerNo,
  removerTrilha,
  trilhaDuplicada,
  trilhaEmPonto,
  validarGrafo,
  vizinhos,
} from "../model/graph";

/* Grafo de apoio:  a ── b ── c        d (solto) */
const no = (id, x, y, extra) => criarNo({ id, x, y, name: id.toUpperCase(), ...extra });
function grafoBase() {
  const nos = [no("a", 0, 0), no("b", 100, 0), no("c", 100, 100), no("d", 500, 500)];
  const trilhas = [
    criarTrilha({ id: "t1", fromId: "a", toId: "b" }),
    criarTrilha({ id: "t2", fromId: "b", toId: "c" }),
  ];
  return criarGrafo({ nos, trilhas });
}

describe("NODE_TYPES / getNodeType", () => {
  it("cobre os seis tipos do briefing", () => {
    expect(NODE_TYPES.map((t) => t.id).sort()).toEqual(
      ["camp", "dungeon", "poi", "quest", "secret", "town"],
    );
  });

  it("cada tipo tem rótulo em PT-BR, cor e dica", () => {
    NODE_TYPES.forEach((t) => {
      expect(typeof t.label).toBe("string");
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(typeof t.hint).toBe("string");
      expect(t.hint.length).toBeGreaterThan(0);
    });
  });

  it("getNodeType acha pelo id", () => {
    expect(getNodeType("dungeon").label).toBe("Masmorra");
  });

  it("getNodeType tem fallback seguro para id desconhecido, vazio ou de tipo errado", () => {
    [undefined, null, "", 42, "aldeia-do-fim"].forEach((v) => {
      expect(getNodeType(v).id).toBe(TIPO_PADRAO);
    });
  });

  it("getNodeType devolve cópia — mexer no resultado não corrompe a tabela", () => {
    const t = getNodeType("town");
    t.label = "hackeado";
    expect(getNodeType("town").label).not.toBe("hackeado");
  });
});

describe("criarNo", () => {
  it("preenche os campos do molde com padrões seguros", () => {
    const n = criarNo({ x: 10, y: 20, name: "Vila do Sino" });
    expect(n).toMatchObject({
      id: null, x: 10, y: 20, name: "Vila do Sino", type: TIPO_PADRAO,
      rumorLabel: "", description: "", gmNotes: "", linkedSceneId: null, isFastTravel: false,
    });
    expect(n.color).toBe(getNodeType(TIPO_PADRAO).color);
  });

  it("aceita id, tipo e cor explícitos", () => {
    const n = criarNo({ id: "n1", x: 0, y: 0, type: "dungeon", color: "#123456" });
    expect(n.id).toBe("n1");
    expect(n.type).toBe("dungeon");
    expect(n.color).toBe("#123456");
  });

  it("dá um nome padrão quando não vem nome", () => {
    expect(criarNo({ x: 0, y: 0 }).name.length).toBeGreaterThan(0);
  });

  it("recusa coordenadas não numéricas, em português", () => {
    expect(() => criarNo({ x: "a", y: 0 })).toThrow(/coordenadas/i);
    expect(() => criarNo({ x: 0, y: NaN })).toThrow(/coordenadas/i);
    expect(() => criarNo(null)).toThrow(/nó/i);
  });

  it("recusa tipo desconhecido explícito", () => {
    expect(() => criarNo({ x: 0, y: 0, type: "castelo" })).toThrow(/tipo de nó/i);
  });

  it("recusa nome que não é texto", () => {
    expect(() => criarNo({ x: 0, y: 0, name: 7 })).toThrow(/nome/i);
  });
});

describe("criarTrilha", () => {
  it("preenche os campos da aresta com padrões seguros", () => {
    const t = criarTrilha({ fromId: "a", toId: "b" });
    expect(t).toMatchObject({
      id: null, fromNodeId: "a", toNodeId: "b", pathPoints: [],
      travelHours: 1, isSecret: false, discoveryCheck: null, isOneWay: false, dangerLevel: 0,
    });
  });

  it("aceita também os nomes do modelo persistido (fromNodeId/toNodeId)", () => {
    expect(criarTrilha({ fromNodeId: "a", toNodeId: "b" })).toMatchObject({
      fromNodeId: "a", toNodeId: "b",
    });
  });

  it("recusa autoligação", () => {
    expect(() => criarTrilha({ fromId: "a", toId: "a" })).toThrow(/ela mesma|ele mesmo/i);
  });

  it("recusa ids faltando", () => {
    expect(() => criarTrilha({ fromId: "a" })).toThrow(/origem|destino/i);
    expect(() => criarTrilha({ toId: "b" })).toThrow(/origem|destino/i);
    expect(() => criarTrilha({})).toThrow(/origem|destino/i);
    expect(() => criarTrilha(null)).toThrow(/trilha/i);
  });

  it("recusa horas de viagem negativas ou não numéricas", () => {
    expect(() => criarTrilha({ fromId: "a", toId: "b", travelHours: -2 })).toThrow(/horas/i);
    expect(() => criarTrilha({ fromId: "a", toId: "b", travelHours: "seis" })).toThrow(/horas/i);
    expect(criarTrilha({ fromId: "a", toId: "b", travelHours: 0 }).travelHours).toBe(0);
  });

  it("recusa pontos de controle malformados", () => {
    expect(() => criarTrilha({ fromId: "a", toId: "b", pathPoints: "curva" })).toThrow(/controle/i);
    expect(() => criarTrilha({ fromId: "a", toId: "b", pathPoints: [{ x: 1 }] })).toThrow(/controle/i);
    expect(criarTrilha({ fromId: "a", toId: "b", pathPoints: [{ x: 1, y: 2 }] }).pathPoints)
      .toEqual([{ x: 1, y: 2 }]);
  });

  it("pontasDaTrilha lê os dois nomes de campo", () => {
    expect(pontasDaTrilha({ fromNodeId: "a", toNodeId: "b" })).toEqual(["a", "b"]);
    expect(pontasDaTrilha({ fromId: "a", toId: "b" })).toEqual(["a", "b"]);
    expect(pontasDaTrilha(null)).toEqual([null, null]);
  });
});

describe("trilhaDuplicada", () => {
  const trilhas = [criarTrilha({ id: "t1", fromId: "a", toId: "b" })];

  it("pega a mesma dupla nos dois sentidos", () => {
    expect(trilhaDuplicada(trilhas, { fromId: "a", toId: "b" })).toBe(true);
    expect(trilhaDuplicada(trilhas, { fromId: "b", toId: "a" })).toBe(true);
  });

  it("dupla diferente não é duplicada", () => {
    expect(trilhaDuplicada(trilhas, { fromId: "a", toId: "c" })).toBe(false);
    expect(trilhaDuplicada([], { fromId: "a", toId: "b" })).toBe(false);
  });

  it("não conta a própria trilha ao reavaliar (mesmo id)", () => {
    expect(trilhaDuplicada(trilhas, { id: "t1", fromId: "a", toId: "b" })).toBe(false);
  });

  it("entrada inútil devolve false em vez de explodir", () => {
    expect(trilhaDuplicada(null, { fromId: "a", toId: "b" })).toBe(false);
    expect(trilhaDuplicada(trilhas, null)).toBe(false);
  });
});

describe("vizinhos", () => {
  it("devolve trilha + o nó do outro lado, nos dois sentidos", () => {
    const g = grafoBase();
    const vb = vizinhos(g, "b");
    expect(vb.map((v) => v.outroId).sort()).toEqual(["a", "c"]);
    expect(vb.every((v) => v.trilha && v.trilha.id)).toBe(true);
    expect(vizinhos(g, "a").map((v) => v.outroId)).toEqual(["b"]);
  });

  it("nó isolado ou inexistente devolve lista vazia", () => {
    const g = grafoBase();
    expect(vizinhos(g, "d")).toEqual([]);
    expect(vizinhos(g, "zzz")).toEqual([]);
    expect(vizinhos(null, "a")).toEqual([]);
  });
});

describe("noEmPonto", () => {
  const nos = [no("a", 0, 0), no("b", 100, 0)];

  it("acha o nó dentro do raio", () => {
    expect(noEmPonto(nos, { x: 5, y: 5 }, 20).id).toBe("a");
  });

  it("devolve null fora do raio", () => {
    expect(noEmPonto(nos, { x: 50, y: 50 }, 20)).toBeNull();
  });

  it("com dois candidatos, ganha o mais perto", () => {
    expect(noEmPonto(nos, { x: 60, y: 0 }, 200).id).toBe("b");
  });

  it("entrada inútil devolve null", () => {
    expect(noEmPonto(null, { x: 0, y: 0 }, 10)).toBeNull();
    expect(noEmPonto(nos, null, 10)).toBeNull();
  });
});

describe("trilhaEmPonto", () => {
  const g = grafoBase();

  it("acha a trilha clicada, aceitando o grafo inteiro", () => {
    expect(trilhaEmPonto(g, { x: 50, y: 2 }, 10).id).toBe("t1");
  });

  it("aceita também (trilhas, ponto, tolerância, nos)", () => {
    expect(trilhaEmPonto(g.trilhas, { x: 50, y: 2 }, 10, g.nos).id).toBe("t1");
  });

  it("devolve null longe de qualquer trilha", () => {
    expect(trilhaEmPonto(g, { x: 50, y: 400 }, 10)).toBeNull();
  });

  it("respeita a curvatura dos pontos de controle", () => {
    const curvo = criarGrafo({
      nos: [no("a", 0, 0), no("b", 100, 0)],
      trilhas: [criarTrilha({ id: "t", fromId: "a", toId: "b", pathPoints: [{ x: 50, y: 100 }] })],
    });
    // sobre a reta: já não há trilha ali
    expect(trilhaEmPonto(curvo, { x: 50, y: 0 }, 6)).toBeNull();
    // sobre a barriga da curva: há
    expect(trilhaEmPonto(curvo, { x: 50, y: 50 }, 6).id).toBe("t");
  });

  it("sem nós não há geometria — devolve null em vez de chutar", () => {
    expect(trilhaEmPonto(g.trilhas, { x: 50, y: 2 }, 10)).toBeNull();
    expect(trilhaEmPonto(null, { x: 0, y: 0 }, 10)).toBeNull();
  });

  it("pontosDaTrilha resolve a polilinha em coordenadas de mundo", () => {
    expect(pontosDaTrilha(g.trilhas[0], g.nos)).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(pontosDaTrilha(g.trilhas[0], [])).toEqual([]);
  });
});

describe("moverNo", () => {
  it("move e devolve um array novo, sem mutar o antigo", () => {
    const nos = [no("a", 0, 0), no("b", 100, 0)];
    const depois = moverNo(nos, "a", { x: 7, y: 8 });
    expect(depois).not.toBe(nos);
    expect(depois[0]).toMatchObject({ x: 7, y: 8 });
    expect(nos[0]).toMatchObject({ x: 0, y: 0 });
    expect(depois[1]).toBe(nos[1]); // os outros nós não são recriados
  });

  it("nó inexistente devolve o mesmo array", () => {
    const nos = [no("a", 0, 0)];
    expect(moverNo(nos, "zzz", { x: 1, y: 1 })).toBe(nos);
  });

  it("recusa destino não numérico", () => {
    const nos = [no("a", 0, 0)];
    expect(() => moverNo(nos, "a", { x: "x", y: 0 })).toThrow(/coordenadas/i);
  });
});

describe("removerNo / removerTrilha", () => {
  it("remover nó leva junto as trilhas dele", () => {
    const g = removerNo(grafoBase(), "b");
    expect(g.nos.map((n) => n.id)).toEqual(["a", "c", "d"]);
    expect(g.trilhas).toEqual([]);
  });

  it("remover nó de ponta preserva as outras trilhas", () => {
    const g = removerNo(grafoBase(), "a");
    expect(g.trilhas.map((t) => t.id)).toEqual(["t2"]);
  });

  it("remover nó inexistente não muda nada", () => {
    const base = grafoBase();
    const g = removerNo(base, "zzz");
    expect(g.nos).toHaveLength(4);
    expect(g.trilhas).toHaveLength(2);
  });

  it("remover trilha não mexe nos nós", () => {
    const g = removerTrilha(grafoBase(), "t1");
    expect(g.trilhas.map((t) => t.id)).toEqual(["t2"]);
    expect(g.nos).toHaveLength(4);
  });

  it("não muta o grafo original", () => {
    const base = grafoBase();
    removerNo(base, "b");
    removerTrilha(base, "t1");
    expect(base.nos).toHaveLength(4);
    expect(base.trilhas).toHaveLength(2);
  });
});

describe("limitesDoGrafo", () => {
  it("devolve a caixa que enquadra tudo", () => {
    expect(limitesDoGrafo([no("a", -10, 5), no("b", 30, 100)])).toEqual({
      minX: -10, minY: 5, maxX: 30, maxY: 100,
      largura: 40, altura: 95, centro: { x: 10, y: 52.5 },
    });
  });

  it("um nó só devolve caixa de área zero centrada nele", () => {
    expect(limitesDoGrafo([no("a", 4, 6)])).toMatchObject({
      largura: 0, altura: 0, centro: { x: 4, y: 6 },
    });
  });

  it("sem nós devolve null", () => {
    expect(limitesDoGrafo([])).toBeNull();
    expect(limitesDoGrafo(null)).toBeNull();
  });

  it("ignora nós com coordenadas inválidas", () => {
    expect(limitesDoGrafo([{ id: "x" }, no("a", 1, 2)])).toMatchObject({ minX: 1, maxX: 1 });
  });
});

describe("validarGrafo", () => {
  it("grafo saudável não tem problemas", () => {
    const g = criarGrafo({
      nos: [no("a", 0, 0), no("b", 100, 0)],
      trilhas: [criarTrilha({ id: "t1", fromId: "a", toId: "b" })],
    });
    expect(validarGrafo(g)).toEqual([]);
  });

  it("acusa trilha órfã", () => {
    const g = criarGrafo({
      nos: [no("a", 0, 0)],
      trilhas: [criarTrilha({ id: "t1", fromId: "a", toId: "fantasma" })],
    });
    const problemas = validarGrafo(g);
    expect(problemas.some((p) => p.tipo === "trilha-orfa")).toBe(true);
    expect(problemas.find((p) => p.tipo === "trilha-orfa").mensagem).toMatch(/não existe/i);
    expect(problemas.find((p) => p.tipo === "trilha-orfa").id).toBe("t1");
  });

  it("acusa nós duplicados na mesma posição", () => {
    const g = criarGrafo({ nos: [no("a", 10, 10), no("b", 10, 10)], trilhas: [] });
    expect(validarGrafo(g).some((p) => p.tipo === "no-duplicado")).toBe(true);
  });

  it("acusa nó isolado", () => {
    const problemas = validarGrafo(grafoBase());
    const isolados = problemas.filter((p) => p.tipo === "no-isolado");
    expect(isolados).toHaveLength(1);
    expect(isolados[0].id).toBe("d");
    expect(isolados[0].mensagem).toMatch(/nenhuma trilha/i);
  });

  it("acusa autoligação e trilha repetida", () => {
    const g = {
      nos: [no("a", 0, 0), no("b", 100, 0)],
      trilhas: [
        { id: "t1", fromNodeId: "a", toNodeId: "b" },
        { id: "t2", fromNodeId: "b", toNodeId: "a" },
        { id: "t3", fromNodeId: "a", toNodeId: "a" },
      ],
    };
    const tipos = validarGrafo(g).map((p) => p.tipo);
    expect(tipos).toContain("trilha-repetida");
    expect(tipos).toContain("trilha-autoligacao");
  });

  it("todas as mensagens são texto em português, não código", () => {
    const problemas = validarGrafo(grafoBase());
    problemas.forEach((p) => {
      expect(typeof p.mensagem).toBe("string");
      expect(p.mensagem).toMatch(/[áâãéêíóôõúç ]/i);
    });
  });

  it("grafo vazio ou inútil não quebra", () => {
    expect(validarGrafo(null)).toEqual([]);
    expect(validarGrafo(criarGrafo())).toEqual([]);
  });
});

describe("criarGrafo", () => {
  it("normaliza entrada faltando", () => {
    expect(criarGrafo()).toEqual({ nos: [], trilhas: [] });
    expect(criarGrafo({ nos: null, trilhas: undefined })).toEqual({ nos: [], trilhas: [] });
  });
});
