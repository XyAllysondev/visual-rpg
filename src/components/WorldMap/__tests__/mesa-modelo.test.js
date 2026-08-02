/* ════════════════════════════════════════════════════════════════════
 *  A MESA — A MATEMÁTICA  (spec 0028 · F4 · AC-6, AC-8, AC-10, AC-11)
 *  --------------------------------------------------------------------
 *  Lógica pura de `Mesa/mesaUi.js`: a tradução de `revealed/` para grafo,
 *  o estoque do "Revelar agora", o relógio, a comida e o ritmo da viagem.
 *
 *  Nada aqui monta React nem toca no Firestore — é o gate barato que
 *  protege as decisões que a tela só encena.
 * ════════════════════════════════════════════════════════════════════ */

/* `mesaUi` é puro de propósito e NÃO importa o store (traria o Firebase para
   dentro de um módulo que a tela mocka). O preço é ter três constantes de
   formato repetidas — e o teste abaixo é quem cobra esse preço, comparando com
   o que o store realmente exporta. */
jest.mock("../../../firebase", () => ({ db: { __db: true }, auth: {} }));

import {
  CONSUMO_PADRAO_POR_DIA, DURACAO_MAXIMA, DURACAO_MINIMA,
  consumoPorDia, duracaoDaViagem, estadoDoRevelado, estoqueOculto,
  formatarRelogio, formatarSuprimentos, grafoDoRevelado, moldeDaInstancia,
  nomeNaMesa, periodoDoDia, pintarPercurso, raioDaEstrada, relogioDe,
  resumoDaRevelacao, rotuloNaMesa, velocidadeDaViagem,
} from "../Mesa/mesaUi";
import { MOTIVO_SEM_CAMINHO, destinosPossiveis, podeViajarPara } from "../model/revelacao";
import { iniciarViagem } from "../model/viagem";
import {
  SEPARADOR_DA_INSTANCIA, PREFIXO_DO_NO, PREFIXO_DA_TRILHA,
  idDaInstancia, idReveladoDoNo, idReveladoDaTrilha,
} from "../mesaStore";

/* ── Uma mesa de mentirinha, mas com a forma exata do store ──────────── */

const doc = (extra) => ({ ...extra });

const REVELADO = [
  doc({
    id: "no_n1", kind: "node", nodeId: "n1", name: "Vila Candeia", type: "town",
    x: 100, y: 100, icon: null, color: "#c9a84c", state: "visited", description: "",
  }),
  doc({
    id: "no_n2", kind: "node", nodeId: "n2", name: "Capela Velha", type: "poi",
    x: 400, y: 260, icon: null, color: null, state: "discovered", description: "",
  }),
  doc({
    id: "no_n3", kind: "node", nodeId: "n3", x: 700, y: 120, state: "rumored",
    rumorLabel: "Dizem que há fogo no morro.",
  }),
  doc({
    id: "tr_t1", kind: "edge", edgeId: "t1", fromNodeId: "n1", toNodeId: "n2",
    pathPoints: [{ x: 250, y: 220 }], travelHours: 6, state: "revealed",
  }),
  /* Trilha cuja outra ponta não chegou: desenhar a linha entregaria a posição
     do que está escondido. Fica de fora — e o teste trava isso. */
  doc({
    id: "tr_t9", kind: "edge", edgeId: "t9", fromNodeId: "n2", toNodeId: "n99",
    pathPoints: [], travelHours: 2, state: "revealed",
  }),
];

const MOLDE = {
  nos: [
    { id: "n1", name: "Vila Candeia", type: "town", x: 100, y: 100 },
    { id: "n2", name: "Capela Velha", type: "poi", x: 400, y: 260 },
    { id: "n3", name: "Morro do Fogo", type: "poi", x: 700, y: 120, rumorLabel: "Dizem que há fogo no morro." },
    { id: "n4", name: "Cripta Selada", type: "secret", x: 900, y: 500 },
  ],
  trilhas: [
    { id: "t1", fromNodeId: "n1", toNodeId: "n2", travelHours: 6 },
    { id: "t2", fromNodeId: "n2", toNodeId: "n3", travelHours: 3 },
    { id: "t3", fromNodeId: "n2", toNodeId: "n4", travelHours: 1, isSecret: true },
  ],
};

/* ════════════════════════════════════════════════════════════════════ */

describe("as constantes de formato repetidas em `mesaUi`", () => {
  it("continuam idênticas às do store — se ele mudar, este teste cai antes da tela", () => {
    expect(SEPARADOR_DA_INSTANCIA).toBe("~");
    expect(PREFIXO_DO_NO).toBe("no_");
    expect(PREFIXO_DA_TRILHA).toBe("tr_");
  });

  it("a leitura de `mesaUi` desfaz exatamente a escrita do store", () => {
    const instanceId = idDaInstancia("abc123", "mapa-1");
    expect(moldeDaInstancia(instanceId)).toBe("mapa-1");
    expect(idReveladoDoNo("n1").replace(PREFIXO_DO_NO, "")).toBe("n1");
    expect(idReveladoDaTrilha("t1").replace(PREFIXO_DA_TRILHA, "")).toBe("t1");
  });
});

describe("o id da instância", () => {
  it("devolve o molde escondido em `{uid}~{mapId}`", () => {
    expect(moldeDaInstancia("abc123~mapa-1")).toBe("mapa-1");
  });

  it("devolve vazio quando o id não segue o formato", () => {
    expect(moldeDaInstancia("semseparador")).toBe("");
    expect(moldeDaInstancia("")).toBe("");
    expect(moldeDaInstancia(null)).toBe("");
  });
});

describe("de `revealed/` para o grafo do jogador", () => {
  it("traduz `nodeId`/`state` para `id`/`estado`", () => {
    const { nos } = grafoDoRevelado(REVELADO);
    const vila = nos.find((n) => n.id === "n1");
    expect(vila).toMatchObject({ id: "n1", name: "Vila Candeia", estado: "visited" });
  });

  it("não desenha trilha cuja outra ponta ainda está oculta (AC-1)", () => {
    const { trilhas } = grafoDoRevelado(REVELADO);
    expect(trilhas.map((t) => t.id)).toEqual(["t1"]);
  });

  it("monta o estado de visibilidade que a máquina de revelação consome", () => {
    expect(estadoDoRevelado(REVELADO)).toEqual({
      nos: { n1: "visited", n2: "discovered", n3: "rumored" },
      trilhas: { t1: "revealed", t9: "revealed" },
    });
  });

  it("aguenta coleção vazia e lixo sem explodir", () => {
    expect(grafoDoRevelado(null)).toEqual({ nos: [], trilhas: [] });
    expect(estadoDoRevelado(undefined)).toEqual({ nos: {}, trilhas: {} });
    expect(grafoDoRevelado([{ kind: "node" }, { kind: "edge" }]).nos).toHaveLength(0);
  });
});

describe("o que o jogador consegue clicar (AC-8)", () => {
  const estado = estadoDoRevelado(REVELADO);
  const grafo = grafoDoRevelado(REVELADO);

  it("um nó ligado por trilha revelada é destino", () => {
    expect(destinosPossiveis(estado, grafo, "n1").map((d) => d.noId)).toEqual(["n2"]);
  });

  it("um nó visível sem trilha revelada NÃO é destino", () => {
    /* n3 aparece no mapa (é rumor) mas nenhuma trilha revelada chega até ele —
       da capela só dá para voltar. Ver e poder ir são coisas diferentes. */
    const daCapela = destinosPossiveis(estado, grafo, "n2").map((d) => d.noId);
    expect(daCapela).toEqual(["n1"]);
    expect(daCapela).not.toContain("n3");
  });

  it("a recusa é a mesma frase para 'não há trilha' e para 'é secreta'", () => {
    const semTrilha = podeViajarPara(estado, grafo, "n1", "n3");
    expect(semTrilha.ok).toBe(false);
    expect(semTrilha.motivo).toBe(MOTIVO_SEM_CAMINHO);
  });
});

describe("o estoque do 'Revelar agora' (AC-8)", () => {
  const estado = estadoDoRevelado(REVELADO);

  it("lista tudo que o grupo ainda não visitou, com nome e estado", () => {
    const e = estoqueOculto(estado, MOLDE);
    expect(e.nos.map((n) => n.id).sort()).toEqual(["n2", "n3", "n4"]);
    expect(e.nos.find((n) => n.id === "n4")).toMatchObject({
      estado: "hidden", secreto: true, nome: "Cripta Selada",
    });
  });

  it("põe o mais oculto no topo — é o que o mestre procura", () => {
    const e = estoqueOculto(estado, MOLDE);
    expect(e.nos[0].estado).toBe("hidden");
  });

  it("conta quantos estão totalmente ocultos, para o mestre ver o que tem para dar", () => {
    const e = estoqueOculto(estado, MOLDE);
    // nós: n4 oculto. trilhas: t2 e t3 ocultas.
    expect(e.ocultos).toBe(3);
    expect(e.total).toBe(e.nos.length + e.trilhas.length);
  });

  it("nomeia a trilha pelas duas pontas, com a seta do sentido", () => {
    const e = estoqueOculto(estado, MOLDE);
    expect(e.trilhas.find((t) => t.id === "t2").nome).toBe("Capela Velha ↔ Morro do Fogo");
  });

  it("some quando o grupo já visitou tudo", () => {
    const cheio = { nos: { n1: "visited", n2: "visited", n3: "visited", n4: "visited" },
      trilhas: { t1: "traveled", t2: "traveled", t3: "traveled" } };
    expect(estoqueOculto(cheio, MOLDE).total).toBe(0);
  });
});

describe("o relógio e a comida", () => {
  it("a instância nasce sem relógio e a mesa mostra o dia 1", () => {
    expect(relogioDe({ inGameDatetime: null })).toEqual({ dia: 1, hora: 0, minuto: 0 });
    expect(formatarRelogio(null)).toBe("Dia 1 · 00:00");
  });

  it("formata o relógio de jogo com dois dígitos", () => {
    expect(formatarRelogio({ dia: 3, hora: 9, minuto: 5 })).toBe("Dia 3 · 09:05");
  });

  it("aceita o formato de horas absolutas", () => {
    expect(formatarRelogio(26)).toBe("Dia 2 · 02:00");
  });

  it("diz o período do dia — é o que amarra o relógio à ficção", () => {
    expect(periodoDoDia({ dia: 1, hora: 2, minuto: 0 })).toBe("madrugada");
    expect(periodoDoDia({ dia: 1, hora: 9, minuto: 0 })).toBe("manhã");
    expect(periodoDoDia({ dia: 1, hora: 15, minuto: 0 })).toBe("tarde");
    expect(periodoDoDia({ dia: 1, hora: 21, minuto: 0 })).toBe("noite");
  });

  it("suprimento ausente é 'sem controle', nunca zero", () => {
    expect(formatarSuprimentos(null)).toBe("sem controle");
    expect(formatarSuprimentos(0)).toBe("acabou");
    expect(formatarSuprimentos(1)).toBe("1 ração");
    expect(formatarSuprimentos(4.5)).toBe("4,5 rações");
  });

  it("o consumo por dia sai das bandeiras do grupo, com padrão", () => {
    expect(consumoPorDia(null)).toBe(CONSUMO_PADRAO_POR_DIA);
    expect(consumoPorDia({ flags: { consumoPorDia: 2 } })).toBe(2);
    expect(consumoPorDia({ flags: { consumoPorDia: -3 } })).toBe(CONSUMO_PADRAO_POR_DIA);
  });
});

describe("o ritmo da viagem (design §5.4, movimento 4)", () => {
  it("é proporcional às horas, com piso e teto", () => {
    expect(duracaoDaViagem(0)).toBe(DURACAO_MINIMA);
    expect(duracaoDaViagem(1000)).toBe(DURACAO_MAXIMA);
    const media = duracaoDaViagem(6);
    expect(media).toBeGreaterThan(DURACAO_MINIMA);
    expect(media).toBeLessThan(DURACAO_MAXIMA);
  });

  it("um grupo mais rápido chega antes", () => {
    expect(duracaoDaViagem(10, 2)).toBeLessThan(duracaoDaViagem(10, 1));
  });

  it("a velocidade percorre o comprimento inteiro na duração escolhida", () => {
    const v = iniciarViagem(MOLDE, "n1", "n2");
    const velocidade = velocidadeDaViagem(v);
    expect(velocidade * duracaoDaViagem(v.horas)).toBeCloseTo(v.comprimento, 4);
  });

  it("trilha de comprimento zero não divide por zero", () => {
    expect(velocidadeDaViagem({ comprimento: 0, horas: 4 })).toBe(0);
    expect(velocidadeDaViagem(null)).toBe(0);
  });

  it("a névoa da estrada é menor que a da chegada — viajar não é enxergar o horizonte", () => {
    expect(raioDaEstrada(400)).toBeLessThan(400);
    expect(raioDaEstrada(10)).toBeGreaterThanOrEqual(60);
  });
});

describe("as palavras da mesa", () => {
  it("o rumor não entrega o nome do lugar (AC-1)", () => {
    const { nos } = grafoDoRevelado(REVELADO);
    const rumor = nos.find((n) => n.id === "n3");
    expect(rumor.name).toBeUndefined();
    expect(nomeNaMesa(rumor)).toBe("Dizem que há fogo no morro.");
    expect(rotuloNaMesa(rumor, {})).toContain("apenas um rumor");
  });

  it("o rótulo diz quando dá para viajar, e quando não dá", () => {
    const { nos } = grafoDoRevelado(REVELADO);
    const capela = nos.find((n) => n.id === "n2");
    expect(rotuloNaMesa(capela, { destino: { horas: 6 } })).toContain("viajar");
    expect(rotuloNaMesa(capela, {})).toContain("sem caminho conhecido daqui");
    expect(rotuloNaMesa(capela, { aqui: true })).toContain("o grupo está aqui");
  });

  it("resume a revelação em português", () => {
    expect(resumoDaRevelacao([{ id: "a" }], [{ id: "b" }, { id: "c" }])).toBe("1 lugar e 2 trilhas");
    expect(resumoDaRevelacao([], [])).toBe("");
  });
});

describe("o rastro da viagem no canvas", () => {
  const dubleDeContexto = () => ({
    chamadas: [],
    save() { this.chamadas.push("save"); },
    restore() { this.chamadas.push("restore"); },
    beginPath() { this.chamadas.push("beginPath"); },
    moveTo() { this.chamadas.push("moveTo"); },
    lineTo() { this.chamadas.push("lineTo"); },
    stroke() { this.chamadas.push("stroke"); },
    setLineDash() {},
  });

  it("pinta a polilinha já percorrida, em coordenadas de tela", () => {
    const ctx = dubleDeContexto();
    const r = pintarPercurso(ctx, {
      pontos: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }],
      pan: { x: 5, y: 5 },
      scale: 2,
    });
    expect(r.pintou).toBe(true);
    expect(ctx.chamadas.filter((c) => c === "lineTo")).toHaveLength(2);
  });

  it("um ponto só não vira traço, e `ctx` nulo é no-op (jsdom)", () => {
    expect(pintarPercurso(dubleDeContexto(), { pontos: [{ x: 0, y: 0 }] }).pintou).toBe(false);
    expect(pintarPercurso(null, { pontos: [] }).pintou).toBe(false);
  });
});
