/**
 * Gate do TESTE DE DESCOBERTA (spec 0028 · F5 · AC-9).
 *
 * Escrito **antes** de `model/descoberta.js`.
 *
 * A invariante que este arquivo existe para travar é uma só, e é dura:
 *
 *   > "a falha **não revela a existência da trilha**"
 *
 * Não basta a mensagem de falha ser vaga. Ela tem de ser **idêntica** — mesma
 * string, mesmo objeto — à de um teste feito num lugar onde não há trilha
 * secreta nenhuma. Se as duas diferirem em um caractere, em uma chave a mais ou
 * num campo `undefined`, o jogador aprende a diferença e o segredo vaza pela
 * resposta. Daí `MENSAGEM_SEM_ACHADO` ser constante única, usada nos dois casos.
 *
 * A **rolagem vem de fora** (`src/domain/dice.js`, motor único do projeto — o
 * AC-9 proíbe motor paralelo). Este módulo recebe o resultado, nunca o dado.
 */
import { criarGrafo, criarNo, criarTrilha } from "../model/graph";
import { criarEstado, estadoDaTrilha, estadoDoNo } from "../model/revelacao";
import {
  MENSAGEM_ACHADO,
  MENSAGEM_SEM_ACHADO,
  aplicarDescoberta,
  resultadoDaDescoberta,
  testesDisponiveis,
} from "../model/descoberta";

/* ═══════════════════════════════════════════════════════════════════════
 *     praca ── t1 (aberta) ── porto ── t2 (SECRETA, teste CD 20) ── gruta
 *                              │
 *                              └── t4 (SECRETA, SEM teste) ── cripta
 *
 *     ermida — nó sem trilha secreta nenhuma (o caso "não há o que achar")
 * ═══════════════════════════════════════════════════════════════════════ */

function grafoBase() {
  const nos = [
    criarNo({ id: "praca", x: 0, y: 0, name: "Praça das Velas" }),
    criarNo({ id: "porto", x: 400, y: 0, name: "Porto Cinza" }),
    criarNo({ id: "gruta", x: 800, y: 0, name: "Gruta do Corta-Sono", type: "secret" }),
    criarNo({ id: "cripta", x: 400, y: 400, name: "Cripta Rasa", type: "secret" }),
    criarNo({ id: "ermida", x: 0, y: 400, name: "Ermida Torta" }),
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
    criarTrilha({ id: "t3", fromId: "praca", toId: "ermida", travelHours: 2 }),
    criarTrilha({ id: "t4", fromId: "porto", toId: "cripta", travelHours: 1, isSecret: true }),
  ];
  return criarGrafo({ nos, trilhas });
}

const trilhaDe = (grafo, id) => grafo.trilhas.find((t) => t.id === id);

/* ═══════════════════════════════════════════════════════════════════════
 * 1. testesDisponiveis — o lado do MESTRE
 * ═══════════════════════════════════════════════════════════════════════ */

describe("testesDisponiveis", () => {
  const grafo = grafoBase();
  const estado = criarEstado({ nos: { porto: "visited" }, trilhas: { t1: "traveled" } });

  it("lista as trilhas secretas com teste ligadas ao nó atual", () => {
    const r = testesDisponiveis(estado, grafo, "porto");
    expect(r.map((x) => x.trilhaId)).toEqual(["t2"]);
    expect(r[0].teste).toEqual({ skill: "Percepção", dc: 20 });
    expect(r[0].outroId).toBe("gruta");
  });

  it("ignora trilha aberta — não há o que descobrir nela", () => {
    expect(testesDisponiveis(estado, grafo, "praca").map((x) => x.trilhaId)).toEqual([]);
  });

  it("ignora trilha secreta SEM teste — essa só sai por gatilho ou pela mão do mestre", () => {
    expect(testesDisponiveis(estado, grafo, "porto").map((x) => x.trilhaId)).not.toContain("t4");
  });

  it("ignora trilha secreta que já foi revelada", () => {
    const jaAchou = criarEstado({ trilhas: { t2: "revealed" } });
    expect(testesDisponiveis(jaAchou, grafo, "porto")).toEqual([]);
  });

  it("nó sem trilha secreta nenhuma devolve lista vazia", () => {
    expect(testesDisponiveis(estado, grafo, "ermida")).toEqual([]);
  });

  it("nó inexistente ou entrada torta devolve lista vazia, sem explodir", () => {
    expect(testesDisponiveis(estado, grafo, "fantasma")).toEqual([]);
    expect(testesDisponiveis(null, null, null)).toEqual([]);
    expect(testesDisponiveis(estado, grafo, "")).toEqual([]);
  });

  it("não muta o grafo nem o estado", () => {
    const antes = JSON.parse(JSON.stringify(grafo));
    testesDisponiveis(estado, grafo, "porto");
    expect(JSON.parse(JSON.stringify(grafo))).toEqual(antes);
    expect(estado.trilhas.t2).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 2. A MENSAGEM — o coração do AC-9
 * ═══════════════════════════════════════════════════════════════════════ */

describe("MENSAGEM_SEM_ACHADO", () => {
  it("é a frase neutra do AC-9", () => {
    expect(MENSAGEM_SEM_ACHADO).toBe("Você não encontra nada.");
  });

  it("não denuncia que havia algo para achar", () => {
    const proibido = ["secret", "secreta", "passagem", "oculta", "escondid", "falh", "trilha"];
    const texto = MENSAGEM_SEM_ACHADO.toLowerCase();
    proibido.forEach((palavra) => expect(texto).not.toContain(palavra));
  });
});

describe("resultadoDaDescoberta", () => {
  const grafo = grafoBase();
  const secreta = trilhaDe(grafo, "t2");

  it("passa no teste quando a rolagem alcança a CD", () => {
    expect(resultadoDaDescoberta(secreta, 20)).toEqual({ sucesso: true, mensagem: MENSAGEM_ACHADO });
    expect(resultadoDaDescoberta(secreta, 21).sucesso).toBe(true);
  });

  it("falha abaixo da CD", () => {
    expect(resultadoDaDescoberta(secreta, 19).sucesso).toBe(false);
  });

  it("aceita o resultado da rolagem como número ou como o objeto do motor de dados", () => {
    expect(resultadoDaDescoberta(secreta, { total: 22 }).sucesso).toBe(true);
    expect(resultadoDaDescoberta(secreta, { total: 3 }).sucesso).toBe(false);
  });

  /* ── A IGUALDADE QUE É O AC-9 ─────────────────────────────────────── */

  it("a falha numa trilha secreta REAL é idêntica à de um lugar sem trilha nenhuma", () => {
    const falhouNoSegredo = resultadoDaDescoberta(secreta, 5);
    const semSegredoNenhum = resultadoDaDescoberta(null, 5);

    expect(falhouNoSegredo).toEqual(semSegredoNenhum);
    expect(JSON.stringify(falhouNoSegredo)).toBe(JSON.stringify(semSegredoNenhum));
    expect(Object.keys(falhouNoSegredo).sort()).toEqual(Object.keys(semSegredoNenhum).sort());
    expect(falhouNoSegredo.mensagem).toBe(MENSAGEM_SEM_ACHADO);
  });

  it("a falha também é idêntica à de uma trilha aberta e à de uma secreta sem teste", () => {
    const referencia = resultadoDaDescoberta(null, 5);
    [
      trilhaDe(grafo, "t1"),      // trilha aberta
      trilhaDe(grafo, "t4"),      // secreta, mas sem teste
      undefined,
      {},
    ].forEach((entrada) => {
      expect(resultadoDaDescoberta(entrada, 5)).toEqual(referencia);
    });
  });

  it("a falha por rolagem ausente ou torta também usa a mesma frase", () => {
    const referencia = resultadoDaDescoberta(null, 5);
    [undefined, null, NaN, "vinte", {}, { total: "x" }].forEach((rolagem) => {
      expect(resultadoDaDescoberta(secreta, rolagem)).toEqual(referencia);
    });
  });

  it("a saída tem exatamente duas chaves — campo a mais entregaria o segredo", () => {
    expect(Object.keys(resultadoDaDescoberta(secreta, 5)).sort()).toEqual(["mensagem", "sucesso"]);
    expect(Object.keys(resultadoDaDescoberta(secreta, 25)).sort()).toEqual(["mensagem", "sucesso"]);
  });

  it("nada do molde vaza pela mensagem de falha", () => {
    const json = JSON.stringify(resultadoDaDescoberta(secreta, 1));
    ["t2", "gruta", "porto", "Percepção", "20"].forEach((v) => expect(json).not.toContain(v));
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 3. aplicarDescoberta
 * ═══════════════════════════════════════════════════════════════════════ */

describe("aplicarDescoberta", () => {
  const grafo = grafoBase();

  it("no sucesso, revela a trilha e descobre as duas pontas", () => {
    const antes = criarEstado({ nos: { porto: "visited" } });
    const r = aplicarDescoberta(antes, grafo, "t2", true);

    expect(estadoDaTrilha(r.estado, "t2")).toBe("revealed");
    expect(estadoDoNo(r.estado, "gruta")).toBe("discovered");
    expect(estadoDoNo(r.estado, "porto")).toBe("visited"); // o max não regride
    expect(r.mudou).toBe(true);
  });

  it("no fracasso devolve o MESMO estado por referência — nada mudou, nada vazou", () => {
    const antes = criarEstado({ nos: { porto: "visited" } });
    const r = aplicarDescoberta(antes, grafo, "t2", false);

    expect(r.estado).toBe(antes);
    expect(r.mudou).toBe(false);
    expect(r.estado.trilhas.t2).toBeUndefined();
  });

  it("o fracasso não deixa rastro no estado, nem como chave vazia", () => {
    const antes = criarEstado();
    const r = aplicarDescoberta(antes, grafo, "t2", false);
    expect(JSON.stringify(r.estado)).toBe(JSON.stringify(antes));
    expect(Object.keys(r.estado.trilhas)).toEqual([]);
  });

  it("trilha inexistente não muda nada, mesmo com sucesso", () => {
    const antes = criarEstado();
    const r = aplicarDescoberta(antes, grafo, "fantasma", true);
    expect(r.mudou).toBe(false);
    expect(Object.keys(r.estado.trilhas)).toEqual([]);
  });

  it("não muta o estado de entrada no sucesso", () => {
    const antes = criarEstado();
    aplicarDescoberta(antes, grafo, "t2", true);
    expect(antes.trilhas).toEqual({});
    expect(antes.nos).toEqual({});
  });

  it("entrada torta não explode", () => {
    const r = aplicarDescoberta(null, null, null, true);
    expect(r.mudou).toBe(false);
    expect(r.estado).toEqual({ nos: {}, trilhas: {} });
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 4. Nada de motor de dados paralelo (AC-9)
 * ═══════════════════════════════════════════════════════════════════════ */

describe("o módulo não rola dado", () => {
  it("é puro: mesma entrada, mesma saída, sempre", () => {
    const grafo = grafoBase();
    const secreta = trilhaDe(grafo, "t2");
    const primeira = resultadoDaDescoberta(secreta, 19);
    for (let i = 0; i < 50; i++) {
      expect(resultadoDaDescoberta(secreta, 19)).toEqual(primeira);
    }
  });

  it("o código-fonte não usa Math.random nem inventa rolagem", () => {
    // eslint-disable-next-line global-require
    const fonte = require("fs").readFileSync(
      require("path").join(__dirname, "..", "model", "descoberta.js"),
      "utf8",
    );
    expect(fonte).not.toContain("Math.random");
    expect(fonte).not.toContain("Date.now");
  });
});
