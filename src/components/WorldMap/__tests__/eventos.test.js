/**
 * Gate do MODELO DE EVENTOS (spec 0028 · F5 · AC-1, AC-9).
 *
 * Escrito **antes** da implementação (`model/eventos.js`), como a spec exige
 * para o núcleo puro do Mapa-Múndi.
 *
 * As duas coisas que este arquivo trava:
 *
 *  1. **O gatilho é determinístico.** `avaliarGatilhos` é função pura: a
 *     aleatoriedade do `on_travel` entra pelo `sorteio` do contexto, nunca por
 *     `Math.random()`. Dá para testar chance sem mockar nada.
 *  2. **AC-1 — o segredo é estrutural.** `projecaoDoEvento` devolve `{ id,
 *     title, playerText }` e nada mais. Há uma varredura do JSON serializado
 *     que falha se `gmText`, `trigger`, `triggerConfig` ou `reveals` aparecerem
 *     de qualquer forma.
 */
import { criarGrafo, criarNo, criarTrilha } from "../model/graph";
import {
  criarEstado,
  estadoDaTrilha,
  estadoDoNo,
} from "../model/revelacao";
import {
  GATILHOS,
  MOTIVOS,
  RAIO_DE_PROXIMIDADE_PADRAO,
  aplicarEvento,
  avaliarGatilhos,
  criarEvento,
  dispararManualmente,
  dispararPorTeste,
  projecaoDoEvento,
  validarEvento,
} from "../model/eventos";

/* ═══════════════════════════════════════════════════════════════════════
 * O grafo de apoio.
 *
 *     praca ──── t1 (4h) ──── porto ──── t2 (SECRETA) ──── gruta
 *       │
 *       └── t3 (curvada, controle em (200, 400)) ──── ermida
 * ═══════════════════════════════════════════════════════════════════════ */

const SEGREDO = "SEGREDO-DO-MESTRE-NAO-PODE-VAZAR";

function grafoBase() {
  const nos = [
    criarNo({ id: "praca", x: 0, y: 0, name: "Praça das Velas" }),
    criarNo({ id: "porto", x: 400, y: 0, name: "Porto Cinza" }),
    criarNo({ id: "gruta", x: 800, y: 0, name: "Gruta do Corta-Sono", type: "secret" }),
    criarNo({ id: "ermida", x: 400, y: 600, name: "Ermida Torta" }),
  ];
  const trilhas = [
    criarTrilha({ id: "t1", fromId: "praca", toId: "porto", travelHours: 4 }),
    criarTrilha({
      id: "t2",
      fromId: "porto",
      toId: "gruta",
      travelHours: 6,
      isSecret: true,
      discoveryCheck: { skill: "Percepção", dc: 20 },
    }),
    criarTrilha({
      id: "t3",
      fromId: "praca",
      toId: "ermida",
      travelHours: 2,
      pathPoints: [{ x: 400, y: 100 }],
    }),
  ];
  return criarGrafo({ nos, trilhas });
}

const evento = (extra) =>
  criarEvento({
    id: "ev",
    title: "Uma voz no nevoeiro",
    playerText: "Alguém chama seu nome.",
    gmText: SEGREDO,
    ...extra,
  });

const ids = (disparos) => disparos.map((d) => d.evento.id);

/* ═══════════════════════════════════════════════════════════════════════
 * 1. A tabela de gatilhos
 * ═══════════════════════════════════════════════════════════════════════ */

describe("GATILHOS", () => {
  it("traz os seis tipos do briefing, nessa ordem", () => {
    expect(GATILHOS.map((g) => g.id)).toEqual([
      "on_arrival",
      "on_proximity",
      "on_check",
      "on_travel",
      "manual",
      "flag",
    ]);
  });

  it("todo gatilho tem rótulo e dica em português", () => {
    GATILHOS.forEach((g) => {
      expect(typeof g.label).toBe("string");
      expect(g.label.trim().length).toBeGreaterThan(0);
      expect(typeof g.hint).toBe("string");
      expect(g.hint.trim().length).toBeGreaterThan(0);
    });
  });

  it("a tabela não pode ser mexida por quem a lê", () => {
    expect(Object.isFrozen(GATILHOS)).toBe(true);
    expect(() => {
      GATILHOS.push({ id: "invasor" });
    }).toThrow();
  });

  it("todo gatilho tem um motivo em português para a fila do mestre", () => {
    GATILHOS.forEach((g) => {
      expect(typeof MOTIVOS[g.id]).toBe("string");
      expect(MOTIVOS[g.id].trim().length).toBeGreaterThan(0);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 2. criarEvento — a normalização
 * ═══════════════════════════════════════════════════════════════════════ */

describe("criarEvento", () => {
  it("preenche o essencial e nasce como `manual` (o gatilho que não dispara sozinho)", () => {
    const e = criarEvento({ id: "ev" });
    expect(e.trigger).toBe("manual");
    expect(e.isRepeatable).toBe(false);
    expect(e.reveals).toEqual({ nodeIds: [], edgeIds: [], flags: [] });
    expect(e.anchor).toBeNull();
  });

  it("não muta a entrada nem guarda a referência dela", () => {
    const entrada = {
      id: "ev",
      anchor: { type: "node", refId: "praca" },
      reveals: { nodeIds: ["gruta"], edgeIds: ["t2"], flags: ["ouviu-a-voz"] },
      triggerConfig: { radius: 90 },
    };
    const copia = JSON.parse(JSON.stringify(entrada));
    const e = criarEvento(entrada);

    e.reveals.nodeIds.push("invasor");
    e.anchor.refId = "outro";
    e.triggerConfig.radius = 1;

    expect(entrada).toEqual(copia);
  });

  it("descarta id inválido dentro de reveals", () => {
    const e = criarEvento({
      id: "ev",
      reveals: { nodeIds: ["gruta", "", null, 7], edgeIds: ["t2", "  "], flags: ["f", ""] },
    });
    expect(e.reveals).toEqual({ nodeIds: ["gruta"], edgeIds: ["t2"], flags: ["f"] });
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 3. avaliarGatilhos — o centro
 * ═══════════════════════════════════════════════════════════════════════ */

describe("avaliarGatilhos · on_arrival", () => {
  it("dispara ao chegar no nó ancorado", () => {
    const e = evento({ trigger: "on_arrival", anchor: { type: "node", refId: "porto" } });
    const r = avaliarGatilhos([e], { noId: "porto" }, []);
    expect(ids(r)).toEqual(["ev"]);
    expect(r[0].motivo).toBe(MOTIVOS.on_arrival);
  });

  it("não dispara em outro nó", () => {
    const e = evento({ trigger: "on_arrival", anchor: { type: "node", refId: "porto" } });
    expect(avaliarGatilhos([e], { noId: "praca" }, [])).toEqual([]);
  });

  it("não dispara sem nó nenhum no contexto", () => {
    const e = evento({ trigger: "on_arrival", anchor: { type: "node", refId: "porto" } });
    expect(avaliarGatilhos([e], {}, [])).toEqual([]);
  });

  it("âncora que não é de nó nunca dispara por chegada", () => {
    const e = evento({ trigger: "on_arrival", anchor: { type: "point", x: 0, y: 0 } });
    expect(avaliarGatilhos([e], { noId: "praca" }, [])).toEqual([]);
  });
});

describe("avaliarGatilhos · on_proximity", () => {
  const emPonto = (extra) =>
    evento({
      trigger: "on_proximity",
      anchor: { type: "point", x: 100, y: 0 },
      triggerConfig: { radius: 50 },
      ...extra,
    });

  it("dispara quando a posição entra no raio", () => {
    const r = avaliarGatilhos([emPonto()], { posicao: { x: 130, y: 0 } }, []);
    expect(ids(r)).toEqual(["ev"]);
    expect(r[0].motivo).toBe(MOTIVOS.on_proximity);
  });

  it("não dispara fora do raio", () => {
    expect(avaliarGatilhos([emPonto()], { posicao: { x: 200, y: 0 } }, [])).toEqual([]);
  });

  it("a borda do raio conta como dentro", () => {
    expect(ids(avaliarGatilhos([emPonto()], { posicao: { x: 150, y: 0 } }, []))).toEqual(["ev"]);
  });

  it("sem raio no triggerConfig, vale o raio padrão do módulo", () => {
    const e = evento({
      trigger: "on_proximity",
      anchor: { type: "point", x: 0, y: 0 },
      triggerConfig: null,
    });
    const dentro = { posicao: { x: RAIO_DE_PROXIMIDADE_PADRAO - 1, y: 0 } };
    const fora = { posicao: { x: RAIO_DE_PROXIMIDADE_PADRAO + 1, y: 0 } };
    expect(ids(avaliarGatilhos([e], dentro, []))).toEqual(["ev"]);
    expect(avaliarGatilhos([e], fora, [])).toEqual([]);
  });

  it("sem posição no contexto, não dispara", () => {
    expect(avaliarGatilhos([emPonto()], { noId: "praca" }, [])).toEqual([]);
  });

  it("âncora de nó mede a distância até o nó — mas exige o grafo no contexto", () => {
    const e = evento({
      trigger: "on_proximity",
      anchor: { type: "node", refId: "porto" },
      triggerConfig: { radius: 60 },
    });
    const perto = { posicao: { x: 440, y: 0 }, grafo: grafoBase() };
    expect(ids(avaliarGatilhos([e], perto, []))).toEqual(["ev"]);
    // sem grafo não há como saber onde o nó está: não dispara em vez de chutar
    expect(avaliarGatilhos([e], { posicao: { x: 440, y: 0 } }, [])).toEqual([]);
  });

  it("âncora de trilha mede a distância até a CURVA, não até a corda", () => {
    const e = evento({
      trigger: "on_proximity",
      anchor: { type: "edge", refId: "t3" },
      triggerConfig: { radius: 40 },
    });
    const grafo = grafoBase();
    // t3 vai de (0,0) a (400,600) com controle em (400,100): a curva passa
    // perto de (300,200) e longe da reta que liga as pontas.
    const naCorda = { posicao: { x: 200, y: 300 }, grafo };
    const naCurva = { posicao: { x: 300, y: 200 }, grafo };
    expect(avaliarGatilhos([e], naCorda, [])).toEqual([]);
    expect(ids(avaliarGatilhos([e], naCurva, []))).toEqual(["ev"]);
  });
});

describe("avaliarGatilhos · on_travel", () => {
  const naTrilha = (triggerConfig) =>
    evento({ trigger: "on_travel", anchor: { type: "edge", refId: "t1" }, triggerConfig });

  it("dispara ao percorrer a trilha ancorada", () => {
    const r = avaliarGatilhos([naTrilha({ chance: 1 })], { trilhaId: "t1" }, []);
    expect(ids(r)).toEqual(["ev"]);
    expect(r[0].motivo).toBe(MOTIVOS.on_travel);
  });

  it("não dispara em outra trilha", () => {
    expect(avaliarGatilhos([naTrilha({ chance: 1 })], { trilhaId: "t2" }, [])).toEqual([]);
  });

  it("sem chance declarada, é certeza — não precisa de sorteio", () => {
    expect(ids(avaliarGatilhos([naTrilha(null)], { trilhaId: "t1" }, []))).toEqual(["ev"]);
  });

  it("a chance é resolvida pelo sorteio do contexto, não por Math.random", () => {
    const e = naTrilha({ chance: 0.5 });
    expect(ids(avaliarGatilhos([e], { trilhaId: "t1", sorteio: 0.4 }, []))).toEqual(["ev"]);
    expect(avaliarGatilhos([e], { trilhaId: "t1", sorteio: 0.6 }, [])).toEqual([]);
    // a borda pertence ao lado de fora: sorteio 0.5 com chance 0.5 não dispara
    expect(avaliarGatilhos([e], { trilhaId: "t1", sorteio: 0.5 }, [])).toEqual([]);
  });

  it("o sorteio também pode ser uma função", () => {
    const e = naTrilha({ chance: 0.5 });
    expect(ids(avaliarGatilhos([e], { trilhaId: "t1", sorteio: () => 0.1 }, []))).toEqual(["ev"]);
    expect(avaliarGatilhos([e], { trilhaId: "t1", sorteio: () => 0.9 }, [])).toEqual([]);
  });

  it("chance menor que 1 sem sorteio não dispara — nada de aleatório escondido", () => {
    expect(avaliarGatilhos([naTrilha({ chance: 0.9 })], { trilhaId: "t1" }, [])).toEqual([]);
  });

  it("chance zero (ou negativa) nunca dispara, mesmo com sorteio favorável", () => {
    const ctx = { trilhaId: "t1", sorteio: 0 };
    expect(avaliarGatilhos([naTrilha({ chance: 0 })], ctx, [])).toEqual([]);
    expect(avaliarGatilhos([naTrilha({ chance: -3 })], ctx, [])).toEqual([]);
  });

  it("a mesma avaliação com o mesmo sorteio devolve sempre o mesmo resultado", () => {
    const e = naTrilha({ chance: 0.5 });
    const ctx = { trilhaId: "t1", sorteio: 0.42 };
    const a = avaliarGatilhos([e], ctx, []);
    const b = avaliarGatilhos([e], ctx, []);
    expect(ids(a)).toEqual(ids(b));
  });
});

describe("avaliarGatilhos · on_check e manual não disparam sozinhos", () => {
  it("on_check não dispara nem no nó certo, nem com flag, nem com sorteio bom", () => {
    const e = evento({
      trigger: "on_check",
      anchor: { type: "node", refId: "porto" },
      triggerConfig: { check: { skill: "Investigação", dc: 18 } },
    });
    const ctx = {
      noId: "porto",
      trilhaId: "t1",
      posicao: { x: 400, y: 0 },
      flags: ["tudo"],
      sorteio: 0,
      grafo: grafoBase(),
    };
    expect(avaliarGatilhos([e], ctx, [])).toEqual([]);
  });

  it("manual não dispara por contexto nenhum", () => {
    const e = evento({ trigger: "manual", anchor: { type: "node", refId: "porto" } });
    const ctx = { noId: "porto", trilhaId: "t1", posicao: { x: 400, y: 0 }, sorteio: 0 };
    expect(avaliarGatilhos([e], ctx, [])).toEqual([]);
  });
});

describe("avaliarGatilhos · flag", () => {
  const porFlag = () =>
    evento({ trigger: "flag", triggerConfig: { flagKey: "sino-tocou" }, anchor: null });

  it("dispara quando a marca está na lista de flags", () => {
    const r = avaliarGatilhos([porFlag()], { flags: ["sino-tocou"] }, []);
    expect(ids(r)).toEqual(["ev"]);
    expect(r[0].motivo).toBe(MOTIVOS.flag);
  });

  it("aceita flags como objeto (só as verdadeiras contam)", () => {
    expect(ids(avaliarGatilhos([porFlag()], { flags: { "sino-tocou": true } }, []))).toEqual(["ev"]);
    expect(avaliarGatilhos([porFlag()], { flags: { "sino-tocou": false } }, [])).toEqual([]);
  });

  it("não dispara sem a marca", () => {
    expect(avaliarGatilhos([porFlag()], { flags: ["outra"] }, [])).toEqual([]);
    expect(avaliarGatilhos([porFlag()], {}, [])).toEqual([]);
  });

  it("sem flagKey no triggerConfig, não dispara", () => {
    const e = evento({ trigger: "flag", triggerConfig: null });
    expect(avaliarGatilhos([e], { flags: ["sino-tocou"] }, [])).toEqual([]);
  });
});

describe("avaliarGatilhos · repetição", () => {
  const chegada = (extra) =>
    evento({ trigger: "on_arrival", anchor: { type: "node", refId: "porto" }, ...extra });

  it("evento já disparado e não repetível nunca dispara de novo", () => {
    expect(avaliarGatilhos([chegada()], { noId: "porto" }, ["ev"])).toEqual([]);
  });

  it("evento repetível dispara sempre", () => {
    const e = chegada({ isRepeatable: true });
    expect(ids(avaliarGatilhos([e], { noId: "porto" }, ["ev"]))).toEqual(["ev"]);
  });

  it("jaDisparados aceita array ou Set", () => {
    expect(avaliarGatilhos([chegada()], { noId: "porto" }, new Set(["ev"]))).toEqual([]);
  });
});

describe("avaliarGatilhos · pureza e robustez", () => {
  it("preserva a ordem de entrada e junta tudo que disparou", () => {
    const a = criarEvento({
      id: "a",
      trigger: "on_arrival",
      anchor: { type: "node", refId: "porto" },
    });
    const b = criarEvento({ id: "b", trigger: "flag", triggerConfig: { flagKey: "k" } });
    const c = criarEvento({
      id: "c",
      trigger: "on_travel",
      anchor: { type: "edge", refId: "t1" },
    });
    const r = avaliarGatilhos([a, b, c], { noId: "porto", trilhaId: "t1", flags: ["k"] }, []);
    expect(ids(r)).toEqual(["a", "b", "c"]);
  });

  it("evento sem id não dispara — não haveria como marcá-lo como disparado", () => {
    const e = criarEvento({ trigger: "on_arrival", anchor: { type: "node", refId: "porto" } });
    expect(avaliarGatilhos([e], { noId: "porto" }, [])).toEqual([]);
  });

  it("gatilho desconhecido não dispara", () => {
    const e = evento({ trigger: "quando_der_na_telha", anchor: { type: "node", refId: "porto" } });
    expect(avaliarGatilhos([e], { noId: "porto" }, [])).toEqual([]);
  });

  it("entrada torta devolve lista vazia em vez de explodir", () => {
    expect(avaliarGatilhos(null, null, null)).toEqual([]);
    expect(avaliarGatilhos([null, 7, "x"], { noId: "porto" }, [])).toEqual([]);
    expect(avaliarGatilhos([], undefined, undefined)).toEqual([]);
  });

  it("não muta os eventos nem o contexto", () => {
    const e = evento({
      trigger: "on_arrival",
      anchor: { type: "node", refId: "porto" },
      reveals: { nodeIds: ["gruta"], edgeIds: ["t2"], flags: ["f"] },
    });
    const antesEvento = JSON.parse(JSON.stringify(e));
    const ctx = { noId: "porto", flags: ["f"], posicao: { x: 1, y: 2 } };
    const antesCtx = JSON.parse(JSON.stringify(ctx));

    avaliarGatilhos([e], ctx, []);

    expect(JSON.parse(JSON.stringify(e))).toEqual(antesEvento);
    expect(JSON.parse(JSON.stringify(ctx))).toEqual(antesCtx);
  });

  it("devolve o próprio evento, não uma cópia — quem chama precisa dos textos de mestre", () => {
    const e = evento({ trigger: "on_arrival", anchor: { type: "node", refId: "porto" } });
    expect(avaliarGatilhos([e], { noId: "porto" }, [])[0].evento).toBe(e);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 4. aplicarEvento
 * ═══════════════════════════════════════════════════════════════════════ */

describe("aplicarEvento", () => {
  const grafo = grafoBase();
  const comReveals = () =>
    evento({
      reveals: { nodeIds: ["gruta"], edgeIds: ["t2"], flags: ["ouviu-a-voz"] },
    });

  it("revela nós e trilhas do reveals, inclusive a trilha secreta", () => {
    const r = aplicarEvento(criarEstado(), comReveals(), grafo);
    expect(estadoDoNo(r.estado, "gruta")).toBe("discovered");
    expect(estadoDaTrilha(r.estado, "t2")).toBe("revealed");
    expect(r.revelou).toBe(true);
  });

  it("devolve as flags novas do evento", () => {
    expect(aplicarEvento(criarEstado(), comReveals(), grafo).flags).toEqual(["ouviu-a-voz"]);
  });

  it("respeita o max: não regride quem já está mais adiante", () => {
    const antes = criarEstado({ nos: { gruta: "visited" }, trilhas: { t2: "traveled" } });
    const r = aplicarEvento(antes, comReveals(), grafo);
    expect(estadoDoNo(r.estado, "gruta")).toBe("visited");
    expect(estadoDaTrilha(r.estado, "t2")).toBe("traveled");
    expect(r.revelou).toBe(false);
    expect(r.estado).toBe(antes); // mesma referência: nada mudou
  });

  it("evento sem reveals não muda nada e devolve o mesmo estado", () => {
    const antes = criarEstado({ nos: { praca: "visited" } });
    const r = aplicarEvento(antes, evento({}), grafo);
    expect(r.estado).toBe(antes);
    expect(r.revelou).toBe(false);
    expect(r.flags).toEqual([]);
  });

  it("ignora id que não existe no grafo — revelação fantasma não entra no estado", () => {
    const e = evento({ reveals: { nodeIds: ["nao-existe"], edgeIds: ["t9"], flags: [] } });
    const antes = criarEstado();
    const r = aplicarEvento(antes, e, grafo);
    expect(r.estado).toBe(antes);
    expect(r.estado.nos["nao-existe"]).toBeUndefined();
  });

  it("sem grafo, aplica o que o evento pediu (o chamador é o cliente do mestre)", () => {
    const r = aplicarEvento(criarEstado(), comReveals(), null);
    expect(estadoDoNo(r.estado, "gruta")).toBe("discovered");
  });

  it("não muta o estado de entrada", () => {
    const antes = criarEstado();
    aplicarEvento(antes, comReveals(), grafo);
    expect(antes.nos).toEqual({});
    expect(antes.trilhas).toEqual({});
  });

  it("entrada torta não explode", () => {
    const r = aplicarEvento(null, null, null);
    expect(r.flags).toEqual([]);
    expect(r.revelou).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 5. Disparo à mão e por teste
 * ═══════════════════════════════════════════════════════════════════════ */

describe("dispararManualmente", () => {
  it("devolve o disparo com o motivo do mestre", () => {
    const e = evento({ trigger: "manual" });
    const d = dispararManualmente(e);
    expect(d.evento).toBe(e);
    expect(d.motivo).toBe(MOTIVOS.manual);
  });

  it("o mestre é dono da ficção: solta qualquer evento, seja qual for o gatilho", () => {
    expect(dispararManualmente(evento({ trigger: "on_check" }))).not.toBeNull();
    expect(dispararManualmente(evento({ trigger: "flag" }))).not.toBeNull();
  });

  it("evento sem id (ou torto) não gera disparo", () => {
    expect(dispararManualmente(criarEvento({ trigger: "manual" }))).toBeNull();
    expect(dispararManualmente(null)).toBeNull();
  });
});

describe("dispararPorTeste", () => {
  const doTeste = () =>
    evento({
      trigger: "on_check",
      triggerConfig: { check: { skill: "Investigação", dc: 18 } },
    });

  it("o sucesso dispara", () => {
    const d = dispararPorTeste(doTeste(), true);
    expect(d.motivo).toBe(MOTIVOS.on_check);
  });

  it("o fracasso não dispara", () => {
    expect(dispararPorTeste(doTeste(), false)).toBeNull();
  });

  it("só resolve evento de gatilho on_check", () => {
    expect(dispararPorTeste(evento({ trigger: "on_arrival" }), true)).toBeNull();
    expect(dispararPorTeste(null, true)).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 6. projecaoDoEvento — O AC-1 DO LADO DO CÓDIGO
 * ═══════════════════════════════════════════════════════════════════════ */

describe("projecaoDoEvento (AC-1)", () => {
  const cheio = () =>
    criarEvento({
      id: "ev",
      title: "Uma voz no nevoeiro",
      playerText: "Alguém chama seu nome.",
      gmText: SEGREDO,
      trigger: "on_proximity",
      triggerConfig: { radius: 90, flagKey: "sino-tocou", check: { skill: "Ocultismo", dc: 22 } },
      anchor: { type: "node", refId: "gruta" },
      isRepeatable: true,
      linkedSceneId: "cena-99",
      reveals: { nodeIds: ["gruta"], edgeIds: ["t2"], flags: ["ouviu-a-voz"] },
    });

  it("devolve exatamente { id, title, playerText } — nada mais", () => {
    expect(Object.keys(projecaoDoEvento(cheio())).sort()).toEqual(["id", "playerText", "title"]);
  });

  it("o texto do mestre não sai", () => {
    expect(JSON.stringify(projecaoDoEvento(cheio()))).not.toContain(SEGREDO);
  });

  it("varredura do JSON: nenhum campo de mestre aparece, como chave nem como valor", () => {
    const json = JSON.stringify(projecaoDoEvento(cheio()));
    [
      "gmText",
      "gmNotes",
      "trigger",
      "triggerConfig",
      "reveals",
      "anchor",
      "nodeIds",
      "edgeIds",
      "flagKey",
      "linkedSceneId",
      "isRepeatable",
      "radius",
      "on_proximity",
      "cena-99",
      "sino-tocou",
      "ouviu-a-voz",
      "Ocultismo",
      "gruta",
      "t2",
    ].forEach((proibido) => {
      expect(json).not.toContain(proibido);
    });
  });

  it("a projeção de um mapa inteiro de eventos continua limpa", () => {
    const lista = [
      cheio(),
      criarEvento({ id: "b", gmText: SEGREDO, trigger: "on_check", reveals: { edgeIds: ["t2"] } }),
      criarEvento({ id: "c", gmText: SEGREDO, trigger: "flag", triggerConfig: { flagKey: "x" } }),
    ];
    const json = JSON.stringify(lista.map(projecaoDoEvento));
    expect(json).not.toContain(SEGREDO);
    expect(json).not.toContain("triggerConfig");
    expect(json).not.toContain("reveals");
  });

  it("texto de jogador ausente vira string vazia, nunca undefined no payload", () => {
    const p = projecaoDoEvento(criarEvento({ id: "ev", gmText: SEGREDO }));
    expect(p).toEqual({ id: "ev", title: "", playerText: "" });
  });

  it("evento sem id não gera projeção — não há documento onde gravá-lo", () => {
    expect(projecaoDoEvento(criarEvento({ title: "x" }))).toBeNull();
    expect(projecaoDoEvento(null)).toBeNull();
  });

  it("a projeção é objeto novo: mexer nela não mexe no molde", () => {
    const e = cheio();
    const p = projecaoDoEvento(e);
    p.title = "alterado";
    expect(e.title).toBe("Uma voz no nevoeiro");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 7. validarEvento
 * ═══════════════════════════════════════════════════════════════════════ */

describe("validarEvento", () => {
  const grafo = grafoBase();
  const tipos = (problemas) => problemas.map((p) => p.tipo);

  it("evento bem formado não tem problema nenhum", () => {
    const e = criarEvento({
      id: "ev",
      title: "Voz",
      trigger: "on_arrival",
      anchor: { type: "node", refId: "porto" },
      reveals: { nodeIds: ["gruta"], edgeIds: ["t2"], flags: ["k"] },
    });
    expect(validarEvento(e, grafo)).toEqual([]);
  });

  it("acusa âncora ausente ou de tipo desconhecido", () => {
    expect(tipos(validarEvento(criarEvento({ id: "ev", trigger: "on_arrival" }), grafo)))
      .toContain("ancora-invalida");
    const torta = criarEvento({
      id: "ev",
      trigger: "on_arrival",
      anchor: { type: "constelacao", refId: "porto" },
    });
    expect(tipos(validarEvento(torta, grafo))).toContain("ancora-invalida");
  });

  it("acusa âncora de nó/trilha sem refId e âncora de ponto sem coordenada", () => {
    const semRef = criarEvento({ id: "ev", trigger: "on_arrival", anchor: { type: "node" } });
    expect(tipos(validarEvento(semRef, grafo))).toContain("ancora-invalida");
    const semPonto = criarEvento({ id: "ev", trigger: "on_proximity", anchor: { type: "point" } });
    expect(tipos(validarEvento(semPonto, grafo))).toContain("ancora-invalida");
  });

  it("acusa âncora apontando para nó ou trilha que não existe", () => {
    const e = criarEvento({
      id: "ev",
      trigger: "on_arrival",
      anchor: { type: "node", refId: "fantasma" },
    });
    expect(tipos(validarEvento(e, grafo))).toContain("ancora-orfa");
  });

  it("acusa gatilho desconhecido", () => {
    const e = criarEvento({ id: "ev", trigger: "quando_der_na_telha" });
    expect(tipos(validarEvento(e, grafo))).toContain("gatilho-desconhecido");
  });

  it("acusa on_check sem teste declarado", () => {
    const semTeste = criarEvento({ id: "ev", trigger: "on_check" });
    expect(tipos(validarEvento(semTeste, grafo))).toContain("teste-ausente");

    const semCd = criarEvento({
      id: "ev",
      trigger: "on_check",
      triggerConfig: { check: { skill: "Investigação" } },
    });
    expect(tipos(validarEvento(semCd, grafo))).toContain("teste-ausente");

    const completo = criarEvento({
      id: "ev",
      trigger: "on_check",
      triggerConfig: { check: { skill: "Investigação", dc: 18 } },
    });
    expect(tipos(validarEvento(completo, grafo))).not.toContain("teste-ausente");
  });

  it("acusa reveals apontando para id inexistente", () => {
    const e = criarEvento({
      id: "ev",
      trigger: "manual",
      reveals: { nodeIds: ["fantasma"], edgeIds: ["t9"], flags: [] },
    });
    const p = validarEvento(e, grafo);
    expect(tipos(p).filter((t) => t === "revelacao-inexistente")).toHaveLength(2);
  });

  it("acusa evento sem id", () => {
    expect(tipos(validarEvento(criarEvento({ trigger: "manual" }), grafo)))
      .toContain("evento-sem-id");
  });

  it("sem grafo, pula só as checagens que dependem dele", () => {
    const e = criarEvento({
      id: "ev",
      trigger: "manual",
      reveals: { nodeIds: ["fantasma"], edgeIds: [], flags: [] },
    });
    expect(validarEvento(e)).toEqual([]);
  });

  it("toda mensagem sai em português e pronta para a tela", () => {
    const e = criarEvento({ trigger: "quando_der_na_telha", anchor: { type: "constelacao" } });
    const p = validarEvento(e, grafo);
    expect(p.length).toBeGreaterThan(0);
    p.forEach((problema) => {
      expect(typeof problema.mensagem).toBe("string");
      expect(problema.mensagem.trim().length).toBeGreaterThan(0);
      expect(problema).toHaveProperty("tipo");
      expect(problema).toHaveProperty("id");
    });
  });

  it("entrada torta devolve problema, não exceção", () => {
    expect(Array.isArray(validarEvento(null, grafo))).toBe(true);
    expect(validarEvento(null, grafo).length).toBeGreaterThan(0);
  });
});
