/**
 * Gate da MÁQUINA DE REVELAÇÃO (spec 0028 · AC-6, AC-7, AC-8 · F4).
 *
 * Escrito **antes** da implementação — é o que o AC-6 exige literalmente:
 * "`aoChegarEm` é função pura com teste exaustivo, escrita antes".
 *
 * Lógica pura: nada de React, Firebase, DOM, `Date.now()` ou `Math.random()`.
 */
import { criarGrafo, criarNo, criarTrilha } from "../model/graph";
import {
  ESTADOS_NO,
  ESTADOS_TRILHA,
  ESTADO_INICIAL_DA_TRILHA,
  ESTADO_INICIAL_DO_NO,
  MOTIVO_SEM_CAMINHO,
  RAIO_DE_REVELACAO_PADRAO,
  aoChegarEm,
  aoConcluirViagem,
  criarEstado,
  destinosPossiveis,
  ehMaior,
  estadoDaTrilha,
  estadoDoNo,
  maxEstado,
  minEstado,
  podeViajarPara,
  projecaoDoJogador,
  rebaixarPeloMestre,
  revelarManualmente,
  revelarPorDescoberta,
} from "../model/revelacao";

/* ═══════════════════════════════════════════════════════════════════════
 * O grafo de apoio — desenhado para exercitar TODA a regra do AC-6.
 *
 *              t1 (4h)                t2 (SECRETA, 6h)
 *     praca ─────────────── porto ───────────────── gruta
 *       │                     │
 *       │ t3 (mão única        └── t4 ── "fantasma" (nó que não existe: órfã)
 *       │     praca → ermida)
 *     ermida                        ilha (sem trilha nenhuma)
 * ═══════════════════════════════════════════════════════════════════════ */

const NOTA_SECRETA = "SEGREDO-DO-MESTRE-NAO-PODE-VAZAR";

function grafoBase() {
  const nos = [
    criarNo({ id: "praca", x: 0, y: 0, name: "Praça das Velas", gmNotes: NOTA_SECRETA }),
    criarNo({ id: "porto", x: 400, y: 0, name: "Porto Cinza", revealRadius: 250 }),
    criarNo({
      id: "gruta",
      x: 800,
      y: 0,
      name: "Gruta do Corta-Sono",
      type: "secret",
      description: "Cheira a maresia velha.",
      rumorLabel: "Dizem que algo respira lá dentro",
      gmNotes: NOTA_SECRETA,
      linkedSceneId: "cena-99",
    }),
    criarNo({ id: "ermida", x: 0, y: 300, name: "Ermida Torta" }),
    criarNo({ id: "ilha", x: 900, y: 900, name: "Ilha Sem Nome" }),
  ];
  const trilhas = [
    criarTrilha({ id: "t1", fromId: "praca", toId: "porto", travelHours: 4 }),
    criarTrilha({
      id: "t2",
      fromId: "porto",
      toId: "gruta",
      travelHours: 6,
      isSecret: true,
      discoveryCheck: { pericia: "Percepção", cd: 20 },
    }),
    criarTrilha({ id: "t3", fromId: "praca", toId: "ermida", travelHours: 2, isOneWay: true }),
    criarTrilha({ id: "t4", fromId: "porto", toId: "fantasma", travelHours: 1 }),
  ];
  return criarGrafo({ nos, trilhas });
}

const estadoDe = (nos, trilhas) => criarEstado({ nos, trilhas });

/* ═══════════════════════════════════════════════════════════════════════
 * 1. Os enums e a ordem que os define
 * ═══════════════════════════════════════════════════════════════════════ */

describe("enums de estado", () => {
  it("o nó vai de hidden a visited, nessa ordem", () => {
    expect(ESTADOS_NO).toEqual(["hidden", "rumored", "discovered", "visited"]);
  });

  it("a trilha vai de hidden a traveled, nessa ordem", () => {
    expect(ESTADOS_TRILHA).toEqual(["hidden", "revealed", "traveled"]);
  });

  it("tudo nasce hidden — a mesa começa às escuras", () => {
    expect(ESTADO_INICIAL_DO_NO).toBe("hidden");
    expect(ESTADO_INICIAL_DA_TRILHA).toBe("hidden");
  });

  it("as listas não podem ser mexidas por quem as lê", () => {
    expect(Object.isFrozen(ESTADOS_NO)).toBe(true);
    expect(Object.isFrozen(ESTADOS_TRILHA)).toBe(true);
  });
});

describe("maxEstado — exaustivo, todas as combinações", () => {
  it("cobre as 16 combinações de estado de nó", () => {
    ESTADOS_NO.forEach((a, i) => {
      ESTADOS_NO.forEach((b, j) => {
        expect(maxEstado(a, b)).toBe(ESTADOS_NO[Math.max(i, j)]);
      });
    });
  });

  it("cobre as 9 combinações de estado de trilha", () => {
    ESTADOS_TRILHA.forEach((a, i) => {
      ESTADOS_TRILHA.forEach((b, j) => {
        expect(maxEstado(a, b)).toBe(ESTADOS_TRILHA[Math.max(i, j)]);
      });
    });
  });

  it("é comutativo", () => {
    ESTADOS_NO.forEach((a) => {
      ESTADOS_NO.forEach((b) => {
        expect(maxEstado(a, b)).toBe(maxEstado(b, a));
      });
    });
  });

  it("ausência conta como hidden — dado que ainda não existe é o mais baixo", () => {
    expect(maxEstado(null, "rumored")).toBe("rumored");
    expect(maxEstado(undefined, undefined)).toBe("hidden");
    expect(maxEstado("", "visited")).toBe("visited");
  });

  it("recusa estado inventado em vez de adivinhar", () => {
    expect(() => maxEstado("quase-visto", "visited")).toThrow(/estado/i);
  });

  it("recusa comparar estado de nó com estado de trilha", () => {
    expect(() => maxEstado("visited", "traveled")).toThrow(/nó|no\b/i);
    expect(() => maxEstado("revealed", "rumored")).toThrow();
  });
});

describe("minEstado — o único caminho para trás, e só na mão do mestre", () => {
  it("devolve o menor dos dois em todas as combinações de nó", () => {
    ESTADOS_NO.forEach((a, i) => {
      ESTADOS_NO.forEach((b, j) => {
        expect(minEstado(a, b)).toBe(ESTADOS_NO[Math.min(i, j)]);
      });
    });
  });

  it("ausência continua sendo hidden", () => {
    expect(minEstado(null, "visited")).toBe("hidden");
  });
});

describe("ehMaior", () => {
  it("é estrito: igual não é maior", () => {
    expect(ehMaior("visited", "visited")).toBe(false);
    expect(ehMaior("visited", "discovered")).toBe(true);
    expect(ehMaior("discovered", "visited")).toBe(false);
    expect(ehMaior("traveled", "revealed")).toBe(true);
    expect(ehMaior("hidden", "hidden")).toBe(false);
  });

  it("ausência é menor que qualquer coisa revelada", () => {
    expect(ehMaior("rumored", undefined)).toBe(true);
    expect(ehMaior(undefined, "rumored")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 2. Leitura do estado
 * ═══════════════════════════════════════════════════════════════════════ */

describe("criarEstado / estadoDoNo / estadoDaTrilha", () => {
  it("normaliza qualquer entrada para { nos, trilhas }", () => {
    expect(criarEstado()).toEqual({ nos: {}, trilhas: {} });
    expect(criarEstado(null)).toEqual({ nos: {}, trilhas: {} });
    expect(criarEstado({ nos: { a: "visited" } })).toEqual({ nos: { a: "visited" }, trilhas: {} });
  });

  it("não guarda a referência de quem chamou", () => {
    const nos = { a: "visited" };
    const e = criarEstado({ nos });
    expect(e.nos).not.toBe(nos);
    nos.a = "hidden";
    expect(e.nos.a).toBe("visited");
  });

  it("o que não foi tocado é hidden", () => {
    const e = estadoDe({ praca: "visited" }, { t1: "revealed" });
    expect(estadoDoNo(e, "praca")).toBe("visited");
    expect(estadoDoNo(e, "gruta")).toBe("hidden");
    expect(estadoDoNo(undefined, "gruta")).toBe("hidden");
    expect(estadoDaTrilha(e, "t1")).toBe("revealed");
    expect(estadoDaTrilha(e, "t2")).toBe("hidden");
    expect(estadoDaTrilha(null, "t2")).toBe("hidden");
  });

  it("valor gravado inválido degrada para hidden, não explode a mesa", () => {
    const e = estadoDe({ praca: "quase" }, {});
    expect(estadoDoNo(e, "praca")).toBe("hidden");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 3. aoChegarEm — o centro de tudo (AC-6, literal)
 * ═══════════════════════════════════════════════════════════════════════ */

describe("aoChegarEm — a regra que define o produto", () => {
  it("o nó em que o grupo chega vira visited", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "porto");
    expect(estadoDoNo(r.estado, "porto")).toBe("visited");
  });

  it("a névoa abre no raio do nó quando ele tem raio próprio", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "porto");
    expect(r.nevoa).toEqual({ x: 400, y: 0, raio: 250 });
  });

  it("sem raio próprio, usa o raio padrão do mapa", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "praca", { raioPadrao: 90 });
    expect(r.nevoa).toEqual({ x: 0, y: 0, raio: 90 });
  });

  it("sem raio próprio nem padrão do mapa, cai no padrão do módulo", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "praca");
    expect(r.nevoa.raio).toBe(RAIO_DE_REVELACAO_PADRAO);
  });

  it("raio zero ou negativo no nó é campo vazio, não escolha — cai no padrão", () => {
    const grafo = criarGrafo({
      nos: [criarNo({ id: "a", x: 10, y: 20, revealRadius: 0 })],
      trilhas: [],
    });
    expect(aoChegarEm(criarEstado(), grafo, "a", { raioPadrao: 77 }).nevoa.raio).toBe(77);
  });

  it("cada trilha NÃO secreta ligada ao nó vira revealed", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "praca");
    expect(estadoDaTrilha(r.estado, "t1")).toBe("revealed");
    expect(estadoDaTrilha(r.estado, "t3")).toBe("revealed");
  });

  it("o nó do outro lado vira discovered — e só discovered", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "praca");
    expect(estadoDoNo(r.estado, "porto")).toBe("discovered");
    expect(estadoDoNo(r.estado, "ermida")).toBe("discovered");
  });

  it("E NADA ALÉM DISSO: o vizinho do vizinho continua hidden", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "praca");
    expect(estadoDoNo(r.estado, "gruta")).toBe("hidden");
    expect(estadoDaTrilha(r.estado, "t2")).toBe("hidden");
  });

  it("nó sem trilha nenhuma só revela a si mesmo", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "ilha");
    expect(r.estado.nos).toEqual({ ilha: "visited" });
    expect(r.estado.trilhas).toEqual({});
  });

  /* ── A trilha secreta ─────────────────────────────────────────────── */

  it("trilha SECRETA não é revelada por chegada", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "porto");
    expect(estadoDaTrilha(r.estado, "t2")).toBe("hidden");
  });

  it("e o nó do outro lado da secreta continua hidden — o segredo é dos dois", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "porto");
    expect(estadoDoNo(r.estado, "gruta")).toBe("hidden");
  });

  it("a secreta pulada é reportada ao mestre, para ele saber que existe algo ali", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "porto");
    expect(r.secretasIgnoradas).toEqual(["t2"]);
  });

  it("chegar do outro lado da secreta também não a revela", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "gruta");
    expect(estadoDaTrilha(r.estado, "t2")).toBe("hidden");
    expect(estadoDoNo(r.estado, "porto")).toBe("hidden");
    expect(estadoDoNo(r.estado, "gruta")).toBe("visited");
  });

  /* ── Mão única: revelar é ver, não é poder passar ─────────────────── */

  it("chegar pelo lado de trás de uma trilha de mão única revela a trilha e o outro nó", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "ermida");
    expect(estadoDaTrilha(r.estado, "t3")).toBe("revealed");
    expect(estadoDoNo(r.estado, "praca")).toBe("discovered");
  });

  /* ── Trilha órfã ──────────────────────────────────────────────────── */

  it("trilha que aponta para nó inexistente é ignorada — não dá para desenhar caminho para lugar nenhum", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "porto");
    expect(estadoDaTrilha(r.estado, "t4")).toBe("hidden");
    expect(r.estado.nos.fantasma).toBeUndefined();
  });

  /* ── Pureza e invariantes ─────────────────────────────────────────── */

  it("não muta o estado recebido", () => {
    const antes = estadoDe({ praca: "rumored" }, {});
    const copia = JSON.parse(JSON.stringify(antes));
    aoChegarEm(antes, grafoBase(), "praca");
    expect(antes).toEqual(copia);
  });

  it("não muta o grafo recebido", () => {
    const grafo = grafoBase();
    const copia = JSON.parse(JSON.stringify(grafo));
    aoChegarEm(criarEstado(), grafo, "praca");
    expect(grafo).toEqual(copia);
  });

  it("chegar duas vezes é idempotente", () => {
    const g = grafoBase();
    const um = aoChegarEm(criarEstado(), g, "praca");
    const dois = aoChegarEm(um.estado, g, "praca");
    expect(dois.estado).toEqual(um.estado);
    expect(dois.mudou).toBe(false);
    expect(dois.nosAlterados).toEqual([]);
    expect(dois.trilhasAlteradas).toEqual([]);
  });

  it("quando nada muda, devolve a MESMA referência de estado (o React pode pular o render)", () => {
    const g = grafoBase();
    const um = aoChegarEm(criarEstado(), g, "praca");
    expect(aoChegarEm(um.estado, g, "praca").estado).toBe(um.estado);
  });

  it("a névoa é reportada mesmo quando o estado não mudou — o círculo é sempre reaberto", () => {
    const g = grafoBase();
    const um = aoChegarEm(criarEstado(), g, "praca");
    expect(aoChegarEm(um.estado, g, "praca").nevoa).toEqual(um.nevoa);
  });

  it("ESTADO NUNCA REGRIDE: nó já visited não volta a discovered", () => {
    const g = grafoBase();
    const inicial = estadoDe({ porto: "visited" }, {});
    const r = aoChegarEm(inicial, g, "praca");
    expect(estadoDoNo(r.estado, "porto")).toBe("visited");
  });

  it("ESTADO NUNCA REGRIDE: trilha já traveled não volta a revealed", () => {
    const g = grafoBase();
    const inicial = estadoDe({}, { t1: "traveled" });
    const r = aoChegarEm(inicial, g, "praca");
    expect(estadoDaTrilha(r.estado, "t1")).toBe("traveled");
  });

  it("nó rumored sobe para discovered ao ser alcançado por trilha", () => {
    const r = aoChegarEm(estadoDe({ porto: "rumored" }, {}), grafoBase(), "praca");
    expect(estadoDoNo(r.estado, "porto")).toBe("discovered");
  });

  it("varrendo TODAS as combinações de estado anterior, nunca regride", () => {
    const g = grafoBase();
    ESTADOS_NO.forEach((estadoDoVizinho) => {
      ESTADOS_TRILHA.forEach((estadoDaAresta) => {
        const inicial = estadoDe({ porto: estadoDoVizinho }, { t1: estadoDaAresta });
        const r = aoChegarEm(inicial, g, "praca");
        expect(ehMaior(estadoDoVizinho, estadoDoNo(r.estado, "porto"))).toBe(false);
        expect(ehMaior(estadoDaAresta, estadoDaTrilha(r.estado, "t1"))).toBe(false);
      });
    });
  });

  it("relata as mudanças com o antes e o depois de cada uma", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "praca");
    expect(r.mudou).toBe(true);
    expect(r.nosAlterados).toContainEqual({ id: "praca", de: "hidden", para: "visited" });
    expect(r.nosAlterados).toContainEqual({ id: "porto", de: "hidden", para: "discovered" });
    expect(r.trilhasAlteradas).toContainEqual({ id: "t1", de: "hidden", para: "revealed" });
  });

  /* ── Entradas ruins ───────────────────────────────────────────────── */

  it("chegar a um nó que não existe não faz nada", () => {
    const e = criarEstado();
    const r = aoChegarEm(e, grafoBase(), "nao-existe");
    expect(r.estado).toBe(e);
    expect(r.mudou).toBe(false);
    expect(r.nevoa).toBeNull();
  });

  it("grafo vazio não quebra", () => {
    const r = aoChegarEm(criarEstado(), criarGrafo(), "praca");
    expect(r.mudou).toBe(false);
  });

  it("id de nó vazio não faz nada", () => {
    const r = aoChegarEm(criarEstado(), grafoBase(), "");
    expect(r.mudou).toBe(false);
  });

  it("trilha sem id não é rastreável e é ignorada", () => {
    const grafo = criarGrafo({
      nos: [criarNo({ id: "a", x: 0, y: 0 }), criarNo({ id: "b", x: 10, y: 0 })],
      trilhas: [criarTrilha({ fromId: "a", toId: "b" })],
    });
    const r = aoChegarEm(criarEstado(), grafo, "a");
    expect(r.estado.nos).toEqual({ a: "visited" });
    expect(r.estado.trilhas).toEqual({});
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 4. aoConcluirViagem — a trilha percorrida vira traveled
 * ═══════════════════════════════════════════════════════════════════════ */

describe("aoConcluirViagem", () => {
  it("marca a trilha como traveled e aplica a regra de chegada no destino", () => {
    const r = aoConcluirViagem(criarEstado(), grafoBase(), "t1", "porto");
    expect(estadoDaTrilha(r.estado, "t1")).toBe("traveled");
    expect(estadoDoNo(r.estado, "porto")).toBe("visited");
    expect(estadoDoNo(r.estado, "praca")).toBe("discovered");
  });

  it("percorrer uma trilha secreta já descoberta a marca traveled", () => {
    const inicial = estadoDe({ porto: "visited" }, { t2: "revealed" });
    const r = aoConcluirViagem(inicial, grafoBase(), "t2", "gruta");
    expect(estadoDaTrilha(r.estado, "t2")).toBe("traveled");
    expect(estadoDoNo(r.estado, "gruta")).toBe("visited");
  });

  it("não regride uma trilha já traveled", () => {
    const inicial = estadoDe({}, { t1: "traveled" });
    const r = aoConcluirViagem(inicial, grafoBase(), "t1", "porto");
    expect(estadoDaTrilha(r.estado, "t1")).toBe("traveled");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 5. Revelação manual (AC-8) e por descoberta (AC-9)
 * ═══════════════════════════════════════════════════════════════════════ */

describe("revelarManualmente — o 'Revelar agora' do mestre", () => {
  it("revela nós no estado pedido", () => {
    const r = revelarManualmente(criarEstado(), { nos: ["gruta"], ateEstado: "rumored" });
    expect(estadoDoNo(r.estado, "gruta")).toBe("rumored");
  });

  it("sem ateEstado, nó vira discovered e trilha vira revealed", () => {
    const r = revelarManualmente(criarEstado(), { nos: ["gruta"], trilhas: ["t2"] });
    expect(estadoDoNo(r.estado, "gruta")).toBe("discovered");
    expect(estadoDaTrilha(r.estado, "t2")).toBe("revealed");
  });

  it("aceita um alvo por estado: { no, trilha }", () => {
    const r = revelarManualmente(criarEstado(), {
      nos: ["gruta"],
      trilhas: ["t2"],
      ateEstado: { no: "visited", trilha: "traveled" },
    });
    expect(estadoDoNo(r.estado, "gruta")).toBe("visited");
    expect(estadoDaTrilha(r.estado, "t2")).toBe("traveled");
  });

  it("respeita o max: revelar 'rumored' não rebaixa quem já é 'visited'", () => {
    const r = revelarManualmente(estadoDe({ gruta: "visited" }, {}), {
      nos: ["gruta"],
      ateEstado: "rumored",
    });
    expect(estadoDoNo(r.estado, "gruta")).toBe("visited");
    expect(r.mudou).toBe(false);
  });

  it("revela a trilha secreta — é o caminho legítimo do mestre (AC-6)", () => {
    const r = revelarManualmente(criarEstado(), { trilhas: ["t2"] });
    expect(estadoDaTrilha(r.estado, "t2")).toBe("revealed");
  });

  it("não muta o estado recebido", () => {
    const antes = criarEstado();
    revelarManualmente(antes, { nos: ["gruta"] });
    expect(antes.nos).toEqual({});
  });

  it("lista vazia não muda nada e devolve a mesma referência", () => {
    const antes = criarEstado();
    const r = revelarManualmente(antes, {});
    expect(r.estado).toBe(antes);
    expect(r.mudou).toBe(false);
  });

  it("recusa estado inventado", () => {
    expect(() => revelarManualmente(criarEstado(), { nos: ["gruta"], ateEstado: "quase" }))
      .toThrow(/estado/i);
  });
});

describe("revelarPorDescoberta — a secreta que passou no teste", () => {
  it("revela a trilha e o nó do outro lado como discovered", () => {
    const inicial = estadoDe({ porto: "visited" }, {});
    const r = revelarPorDescoberta(inicial, grafoBase(), "t2");
    expect(estadoDaTrilha(r.estado, "t2")).toBe("revealed");
    expect(estadoDoNo(r.estado, "gruta")).toBe("discovered");
  });

  it("o nó de onde o grupo veio não regride", () => {
    const inicial = estadoDe({ porto: "visited" }, {});
    const r = revelarPorDescoberta(inicial, grafoBase(), "t2");
    expect(estadoDoNo(r.estado, "porto")).toBe("visited");
  });

  it("aceita a própria trilha em vez do grafo", () => {
    const trilha = criarTrilha({ id: "tX", fromId: "a", toId: "b", isSecret: true });
    const r = revelarPorDescoberta(criarEstado(), trilha);
    expect(estadoDaTrilha(r.estado, "tX")).toBe("revealed");
    expect(estadoDoNo(r.estado, "b")).toBe("discovered");
  });

  it("trilha inexistente não muda nada", () => {
    const antes = criarEstado();
    const r = revelarPorDescoberta(antes, grafoBase(), "nao-existe");
    expect(r.estado).toBe(antes);
    expect(r.mudou).toBe(false);
  });

  it("descobrir duas vezes é idempotente", () => {
    const g = grafoBase();
    const um = revelarPorDescoberta(criarEstado(), g, "t2");
    expect(revelarPorDescoberta(um.estado, g, "t2").mudou).toBe(false);
  });
});

describe("rebaixarPeloMestre — a ÚNICA porta para trás", () => {
  it("rebaixa um nó ao estado pedido", () => {
    const r = rebaixarPeloMestre(estadoDe({ gruta: "visited" }, {}), {
      nos: ["gruta"],
      ateEstado: "rumored",
    });
    expect(estadoDoNo(r.estado, "gruta")).toBe("rumored");
  });

  it("sem ateEstado, apaga de vez: volta a hidden", () => {
    const r = rebaixarPeloMestre(estadoDe({ gruta: "visited" }, { t2: "traveled" }), {
      nos: ["gruta"],
      trilhas: ["t2"],
    });
    expect(estadoDoNo(r.estado, "gruta")).toBe("hidden");
    expect(estadoDaTrilha(r.estado, "t2")).toBe("hidden");
  });

  it("é min, não atribuição: quem já está mais baixo não sobe", () => {
    const r = rebaixarPeloMestre(estadoDe({ gruta: "rumored" }, {}), {
      nos: ["gruta"],
      ateEstado: "visited",
    });
    expect(estadoDoNo(r.estado, "gruta")).toBe("rumored");
    expect(r.mudou).toBe(false);
  });

  it("não muta o estado recebido", () => {
    const antes = estadoDe({ gruta: "visited" }, {});
    rebaixarPeloMestre(antes, { nos: ["gruta"] });
    expect(antes.nos.gruta).toBe("visited");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 6. Viajar: quem é destino e quem não é (AC-8)
 * ═══════════════════════════════════════════════════════════════════════ */

describe("podeViajarPara", () => {
  const chegouNaPraca = () => aoChegarEm(criarEstado(), grafoBase(), "praca").estado;

  it("dá certo por trilha revealed", () => {
    const r = podeViajarPara(chegouNaPraca(), grafoBase(), "praca", "porto");
    expect(r.ok).toBe(true);
    expect(r.trilha.id).toBe("t1");
    expect(r.motivo).toBe("");
  });

  it("dá certo por trilha traveled — voltar por onde veio é sempre possível", () => {
    const e = estadoDe({ praca: "visited", porto: "visited" }, { t1: "traveled" });
    expect(podeViajarPara(e, grafoBase(), "porto", "praca").ok).toBe(true);
  });

  it("NÃO dá certo por trilha hidden, mesmo com os dois nós conhecidos", () => {
    const e = estadoDe({ porto: "visited", gruta: "discovered" }, {});
    expect(podeViajarPara(e, grafoBase(), "porto", "gruta").ok).toBe(false);
  });

  it("nó discovered mas SEM trilha revelada ligando não é destino (AC-8)", () => {
    const e = estadoDe({ praca: "visited", gruta: "discovered" }, { t1: "revealed" });
    expect(podeViajarPara(e, grafoBase(), "praca", "gruta").ok).toBe(false);
  });

  it("o motivo NÃO revela a existência da trilha secreta (AC-9)", () => {
    const g = grafoBase();
    const comSecreta = podeViajarPara(estadoDe({ porto: "visited" }, {}), g, "porto", "gruta");
    const semNada = podeViajarPara(estadoDe({ porto: "visited" }, {}), g, "porto", "ermida");
    expect(comSecreta.ok).toBe(false);
    expect(semNada.ok).toBe(false);
    expect(comSecreta.motivo).toBe(semNada.motivo);
    expect(comSecreta.codigo).toBe(semNada.codigo);
    expect(comSecreta.motivo).toBe(MOTIVO_SEM_CAMINHO);
    expect(JSON.stringify(comSecreta)).not.toMatch(/secret|t2/i);
  });

  it("mão única: passa no sentido certo", () => {
    const e = estadoDe({ praca: "visited", ermida: "discovered" }, { t3: "revealed" });
    expect(podeViajarPara(e, grafoBase(), "praca", "ermida").ok).toBe(true);
  });

  it("mão única: não passa no sentido contrário", () => {
    const e = estadoDe({ praca: "discovered", ermida: "visited" }, { t3: "revealed" });
    const r = podeViajarPara(e, grafoBase(), "ermida", "praca");
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe("mao-unica");
    expect(r.motivo).toMatch(/sentido/i);
  });

  it("viajar para onde o grupo já está não é viagem", () => {
    const r = podeViajarPara(chegouNaPraca(), grafoBase(), "praca", "praca");
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe("mesmo-no");
  });

  it("destino que não existe no grafo é recusado", () => {
    const r = podeViajarPara(chegouNaPraca(), grafoBase(), "praca", "fantasma");
    expect(r.ok).toBe(false);
  });

  it("destino ainda hidden não é destino, e o motivo é o mesmo de 'sem caminho'", () => {
    const e = estadoDe({ praca: "visited" }, { t1: "revealed" });
    const r = podeViajarPara(e, grafoBase(), "praca", "porto");
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe(MOTIVO_SEM_CAMINHO);
  });

  it("entre duas trilhas válidas, escolhe a mais curta em horas", () => {
    const grafo = criarGrafo({
      nos: [criarNo({ id: "a", x: 0, y: 0 }), criarNo({ id: "b", x: 10, y: 0 })],
      trilhas: [
        criarTrilha({ id: "longa", fromId: "a", toId: "b", travelHours: 9 }),
        criarTrilha({ id: "curta", fromId: "a", toId: "b", travelHours: 3 }),
      ],
    });
    const e = estadoDe({ a: "visited", b: "discovered" }, { longa: "revealed", curta: "revealed" });
    expect(podeViajarPara(e, grafo, "a", "b").trilha.id).toBe("curta");
  });
});

describe("destinosPossiveis", () => {
  it("lista só o que é clicável agora", () => {
    const e = aoChegarEm(criarEstado(), grafoBase(), "praca").estado;
    expect(destinosPossiveis(e, grafoBase(), "praca").map((d) => d.noId).sort())
      .toEqual(["ermida", "porto"]);
  });

  it("não lista o outro lado da trilha secreta", () => {
    const e = aoChegarEm(criarEstado(), grafoBase(), "porto").estado;
    expect(destinosPossiveis(e, grafoBase(), "porto").map((d) => d.noId)).toEqual(["praca"]);
  });

  it("não lista a origem de uma trilha de mão única", () => {
    const e = estadoDe({ praca: "discovered", ermida: "visited" }, { t3: "revealed" });
    expect(destinosPossiveis(e, grafoBase(), "ermida")).toEqual([]);
  });

  it("traz as horas e a trilha de cada destino, para a UI mostrar o custo", () => {
    const e = aoChegarEm(criarEstado(), grafoBase(), "praca").estado;
    const porto = destinosPossiveis(e, grafoBase(), "praca").find((d) => d.noId === "porto");
    expect(porto.horas).toBe(4);
    expect(porto.trilha.id).toBe("t1");
  });

  it("nó isolado não tem destino", () => {
    const e = aoChegarEm(criarEstado(), grafoBase(), "ilha").estado;
    expect(destinosPossiveis(e, grafoBase(), "ilha")).toEqual([]);
  });

  it("concorda com podeViajarPara em todo nó do grafo", () => {
    const g = grafoBase();
    const e = aoChegarEm(aoChegarEm(criarEstado(), g, "praca").estado, g, "porto").estado;
    g.nos.forEach((de) => {
      const permitidos = destinosPossiveis(e, g, de.id).map((d) => d.noId);
      g.nos.forEach((para) => {
        expect(permitidos.includes(para.id)).toBe(podeViajarPara(e, g, de.id, para.id).ok);
      });
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 7. projecaoDoJogador — o AC-1 do lado do código
 * ═══════════════════════════════════════════════════════════════════════ */

describe("projecaoDoJogador", () => {
  const CHAVES_PROIBIDAS = [
    "gmNotes", "gmText", "isSecret", "discoveryCheck",
    "linkedSceneId", "revealRadius", "dangerLevel",
  ];

  it("nó hidden não aparece — nem o id, nem o nome, nem a posição", () => {
    const p = projecaoDoJogador(estadoDe({ praca: "visited" }, {}), grafoBase());
    const texto = JSON.stringify(p);
    expect(p.nos.map((n) => n.id)).toEqual(["praca"]);
    expect(texto).not.toContain("gruta");
    expect(texto).not.toContain("Gruta do Corta-Sono");
  });

  it("trilha hidden não aparece", () => {
    const e = aoChegarEm(criarEstado(), grafoBase(), "porto").estado;
    expect(projecaoDoJogador(e, grafoBase()).trilhas.map((t) => t.id)).toEqual(["t1"]);
  });

  it("trilha revelada cujo outro nó ainda está oculto NÃO aparece — desenhar a linha entregaria a posição", () => {
    const e = estadoDe({ porto: "visited" }, { t2: "revealed" });
    const p = projecaoDoJogador(e, grafoBase());
    expect(p.trilhas).toEqual([]);
    expect(JSON.stringify(p)).not.toContain("gruta");
  });

  it("nó rumored sai SEM nome e SEM descrição — só o rumor", () => {
    const e = estadoDe({ gruta: "rumored" }, {});
    const [no] = projecaoDoJogador(e, grafoBase()).nos;
    expect(no.estado).toBe("rumored");
    expect(no.rumorLabel).toBe("Dizem que algo respira lá dentro");
    expect("name" in no).toBe(false);
    expect("description" in no).toBe(false);
    expect("type" in no).toBe(false);
    expect(no.x).toBe(800);
    expect(no.y).toBe(0);
  });

  it("nó discovered sai com nome e descrição — já é público", () => {
    const e = estadoDe({ gruta: "discovered" }, {});
    const [no] = projecaoDoJogador(e, grafoBase()).nos;
    expect(no.name).toBe("Gruta do Corta-Sono");
    expect(no.description).toBe("Cheira a maresia velha.");
    expect(no.estado).toBe("discovered");
  });

  it("NENHUMA chave de segredo existe no payload — varrendo o JSON inteiro", () => {
    const e = estadoDe(
      { praca: "visited", porto: "visited", gruta: "discovered", ermida: "rumored" },
      { t1: "traveled", t2: "revealed", t3: "revealed" },
    );
    const texto = JSON.stringify(projecaoDoJogador(e, grafoBase()));
    CHAVES_PROIBIDAS.forEach((chave) => {
      expect(texto).not.toContain(chave);
    });
    expect(texto).not.toContain(NOTA_SECRETA);
    expect(texto).not.toContain("Percepção");
  });

  it("nem mesmo com TODOS os nós e trilhas revelados o segredo vaza", () => {
    const nos = {};
    const trilhas = {};
    grafoBase().nos.forEach((n) => { nos[n.id] = "visited"; });
    grafoBase().trilhas.forEach((t) => { trilhas[t.id] = "traveled"; });
    const texto = JSON.stringify(projecaoDoJogador(estadoDe(nos, trilhas), grafoBase()));
    CHAVES_PROIBIDAS.forEach((chave) => expect(texto).not.toContain(chave));
    expect(texto).not.toContain(NOTA_SECRETA);
  });

  it("a trilha visível traz o que o jogador precisa para viajar e desenhar", () => {
    const e = aoChegarEm(criarEstado(), grafoBase(), "praca").estado;
    const t1 = projecaoDoJogador(e, grafoBase()).trilhas.find((t) => t.id === "t1");
    expect(t1).toEqual({
      id: "t1",
      kind: "edge",
      fromNodeId: "praca",
      toNodeId: "porto",
      pathPoints: [],
      travelHours: 4,
      isOneWay: false,
      estado: "revealed",
    });
  });

  it("o nó visível traz só os campos públicos do design", () => {
    const e = estadoDe({ ermida: "visited" }, {});
    const [no] = projecaoDoJogador(e, grafoBase()).nos;
    expect(Object.keys(no).sort()).toEqual(
      ["color", "description", "estado", "icon", "id", "kind", "name", "type", "x", "y"].sort(),
    );
  });

  it("projeção de estado vazio é vazia", () => {
    expect(projecaoDoJogador(criarEstado(), grafoBase())).toEqual({ nos: [], trilhas: [] });
  });

  it("não muta o grafo nem o estado", () => {
    const g = grafoBase();
    const copia = JSON.parse(JSON.stringify(g));
    projecaoDoJogador(estadoDe({ praca: "visited" }, {}), g);
    expect(g).toEqual(copia);
  });

  it("o objeto devolvido é cópia: mexer nele não mexe no molde", () => {
    const g = grafoBase();
    const p = projecaoDoJogador(estadoDe({ praca: "visited" }, {}), g);
    p.nos[0].name = "Outro nome";
    expect(g.nos[0].name).toBe("Praça das Velas");
  });
});
