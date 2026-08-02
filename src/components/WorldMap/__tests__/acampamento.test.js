/**
 * Gate do MODELO DE ACAMPAMENTO (spec 0028 · F6 · AC-8).
 *
 * Escrito **antes** da implementação (`model/acampamento.js`).
 *
 * Acampar é: passar o tempo, gastar comida e correr o risco de alguém chegar
 * enquanto o grupo dorme. As três coisas são separadas de propósito, e a
 * terceira segue a MESMA regra do encontro de viagem (briefing §9):
 *
 *   > "o mestre decide aceitar, trocar ou ignorar antes de o jogador ver
 *   > qualquer coisa."
 *
 * O que este arquivo trava:
 *
 *  1. **A emboscada é pendência, não resultado.** `acampar` devolve o objeto
 *     que vai para `gm.pendingEncounter` — nunca o documento do jogador.
 *     Publicar continua exigindo `decidirEncontro`, de `encontros.js`.
 *  2. **O tempo e a comida saem de `viagem.js`.** Sem relógio paralelo, sem
 *     aritmética duplicada. Suprimento esgotado é propagado como veio
 *     (`esgotou`/`deficit`), sem penalidade inventada.
 *  3. **Não se inventa regra de sistema.** `descansoRecuperado` devolve horas e
 *     um rótulo. O que isso faz na ficha é de outro módulo, de outra fase.
 */
import { NODE_TYPES } from "../model/graph";
import { avancarRelogio, consumirSuprimentos } from "../model/viagem";
import { decidirEncontro } from "../model/encontros";
import * as acampamento from "../model/acampamento";
import {
  HORAS_DE_DESCANSO_LONGO,
  MOTIVO_LUGAR_ERRADO,
  TIPO_DE_ACAMPAMENTO,
  acampar,
  descansoRecuperado,
  podeAcampar,
} from "../model/acampamento";

const SEGREDO = "SEGREDO-DO-MESTRE-NAO-PODE-VAZAR";
const TEXTO_DO_JOGADOR = "Passos na borda da fogueira.";

const emboscadaDeApoio = () => ({
  id: "emb-1",
  title: "Visitantes na madrugada",
  playerText: TEXTO_DO_JOGADOR,
  gmText: SEGREDO,
});

const partyDeApoio = (extra) => ({
  currentNodeId: "praca",
  x: 10,
  y: 20,
  inGameDatetime: { dia: 1, hora: 20, minuto: 0 },
  supplies: 3,
  speedModifier: 1,
  flags: [],
  ...extra,
});

/* ═══════════════════════════════════════════════════════════════════════
 * podeAcampar — "em trânsito ou em nó do tipo camp" (briefing §9)
 * ═══════════════════════════════════════════════════════════════════════ */

describe("podeAcampar", () => {
  test("o tipo de nó é o mesmo `camp` do editor — sem string solta", () => {
    expect(TIPO_DE_ACAMPAMENTO).toBe("camp");
    expect(NODE_TYPES.some((t) => t.id === TIPO_DE_ACAMPAMENTO)).toBe(true);
  });

  test("em trânsito, pode — mesmo sem nó nenhum embaixo do grupo", () => {
    expect(podeAcampar({ viajando: true })).toEqual({ ok: true, motivo: "" });
    expect(podeAcampar({ viajando: true, noAtual: { id: "praca", type: "city" } }).ok).toBe(true);
  });

  test("num nó de acampamento, pode", () => {
    expect(podeAcampar({ noAtual: { id: "n1", type: "camp" } })).toEqual({ ok: true, motivo: "" });
  });

  test("parado em qualquer outro tipo de nó, não pode — e a recusa explica", () => {
    ["city", "dungeon", "poi", "secret", undefined, null].forEach((type) => {
      const r = podeAcampar({ noAtual: { id: "n1", type }, viajando: false });
      expect(r.ok).toBe(false);
      expect(r.motivo).toBe(MOTIVO_LUGAR_ERRADO);
    });
  });

  test("sem contexto nenhum, não pode — falha fechado, sem explodir", () => {
    expect(podeAcampar().ok).toBe(false);
    expect(podeAcampar(null).ok).toBe(false);
    expect(podeAcampar({}).ok).toBe(false);
  });

  test("devolve exatamente { ok, motivo }", () => {
    expect(Object.keys(podeAcampar({ viajando: true })).sort()).toEqual(["motivo", "ok"]);
    expect(Object.keys(podeAcampar({})).sort()).toEqual(["motivo", "ok"]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * acampar — tempo e comida
 * ═══════════════════════════════════════════════════════════════════════ */

describe("acampar — o relógio e os suprimentos", () => {
  test("avança o relógio pelas horas acampadas, com a aritmética de viagem.js", () => {
    const party = partyDeApoio();
    const r = acampar({ party, horas: 8, consumoPorDia: 3 });
    expect(r.relogio).toEqual(avancarRelogio(party.inGameDatetime, 8));
    expect(r.relogio).toEqual({ dia: 2, hora: 4, minuto: 0 });
    expect(r.party.inGameDatetime).toEqual(r.relogio);
  });

  test("consome suprimento pelo tempo, com a conta de viagem.js", () => {
    const r = acampar({ party: partyDeApoio(), horas: 8, consumoPorDia: 3 });
    expect(r.suprimentos).toEqual(consumirSuprimentos(3, 8, 3));
    expect(r.suprimentos.consumido).toBeCloseTo(1, 10);
    expect(r.party.supplies).toBeCloseTo(2, 10);
  });

  test("sem consumo declarado, ninguém passa fome — só o relógio anda", () => {
    const r = acampar({ party: partyDeApoio(), horas: 8 });
    expect(r.suprimentos.consumido).toBe(0);
    expect(r.party.supplies).toBe(3);
    expect(r.party.inGameDatetime).toEqual({ dia: 2, hora: 4, minuto: 0 });
  });

  test("suprimento esgotado é propagado como veio — sem penalidade inventada", () => {
    const r = acampar({ party: partyDeApoio({ supplies: 0.5 }), horas: 24, consumoPorDia: 3 });
    expect(r.suprimentos.esgotou).toBe(true);
    expect(r.suprimentos.deficit).toBeCloseTo(2.5, 10);
    expect(r.party.supplies).toBe(0);
    // Nada de condição, dano ou exaustão: isso é da ficha, não do mapa.
    expect(r.party).not.toHaveProperty("exausto");
    expect(r.party).not.toHaveProperty("condicoes");
    expect(r).not.toHaveProperty("penalidade");
  });

  test("o estoque nunca fica negativo", () => {
    const r = acampar({ party: partyDeApoio({ supplies: 0 }), horas: 48, consumoPorDia: 5 });
    expect(r.party.supplies).toBe(0);
    expect(r.suprimentos.restante).toBe(0);
  });

  test("não muta a party de entrada", () => {
    const party = partyDeApoio();
    const copia = JSON.parse(JSON.stringify(party));
    acampar({ party, horas: 8, consumoPorDia: 3 });
    expect(JSON.parse(JSON.stringify(party))).toEqual(copia);
  });

  test("preserva os campos que não são dele (posição, flags, modificador)", () => {
    const r = acampar({ party: partyDeApoio(), horas: 8, consumoPorDia: 3 });
    expect(r.party.currentNodeId).toBe("praca");
    expect(r.party.x).toBe(10);
    expect(r.party.y).toBe(20);
    expect(r.party.speedModifier).toBe(1);
    expect(r.party.flags).toEqual([]);
  });

  test("horas zero ou negativas: MESMA REFERÊNCIA de party — nada mudou", () => {
    const party = partyDeApoio();
    expect(acampar({ party, horas: 0, consumoPorDia: 3 }).party).toBe(party);
    expect(acampar({ party, horas: -8, consumoPorDia: 3 }).party).toBe(party);
    expect(acampar({ party, consumoPorDia: 3 }).party).toBe(party);
  });

  test("party ausente não explode: devolve uma party normalizada", () => {
    const r = acampar({ horas: 8 });
    expect(r.party.inGameDatetime).toEqual({ dia: 1, hora: 8, minuto: 0 });
    expect(r.party.supplies).toBe(0);
    expect(acampar().party).toBeTruthy();
  });

  test("devolve exatamente { party, emboscada, relogio, suprimentos }", () => {
    expect(Object.keys(acampar({ party: partyDeApoio(), horas: 8 })).sort())
      .toEqual(["emboscada", "party", "relogio", "suprimentos"]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * acampar — a emboscada, que é do mestre primeiro
 * ═══════════════════════════════════════════════════════════════════════ */

describe("acampar — a emboscada", () => {
  const base = () => ({
    party: partyDeApoio(),
    horas: 8,
    consumoPorDia: 3,
    sugestao: emboscadaDeApoio(),
  });

  test("sem chance declarada, não rola nada", () => {
    expect(acampar({ ...base(), sorteio: 0 }).emboscada).toBeNull();
  });

  test("chance zero não emboscará nem com a melhor rolagem", () => {
    expect(acampar({ ...base(), chanceDeEmboscada: 0, sorteio: 0 }).emboscada).toBeNull();
  });

  test("sem sorteio, não dispara — o módulo não sorteia por conta própria", () => {
    expect(acampar({ ...base(), chanceDeEmboscada: 0.9 }).emboscada).toBeNull();
  });

  test("o sorteio entra por parâmetro, número ou função", () => {
    expect(acampar({ ...base(), chanceDeEmboscada: 0.5, sorteio: 0.1 }).emboscada).not.toBeNull();
    expect(acampar({ ...base(), chanceDeEmboscada: 0.5, sorteio: () => 0.1 }).emboscada).not.toBeNull();
    expect(acampar({ ...base(), chanceDeEmboscada: 0.5, sorteio: 0.9 }).emboscada).toBeNull();
  });

  test("quando dispara, devolve a PENDÊNCIA do mestre — não o resultado publicado", () => {
    const sugestao = emboscadaDeApoio();
    const { emboscada } = acampar({ ...base(), sugestao, chanceDeEmboscada: 0.5, sorteio: 0.1 });

    expect(emboscada.origem).toBe("acampamento");
    expect(emboscada.noId).toBe("praca");
    expect(emboscada.periodo).toBe("noite"); // o período em que o grupo montou acampamento
    expect(emboscada.chance).toBeCloseTo(0.5, 10);
    expect(emboscada.rolagem).toBeCloseTo(0.1, 10);
    expect(emboscada.sugestao).toBe(sugestao);
    expect(JSON.stringify(emboscada)).toContain(SEGREDO);
  });

  test("INVARIANTE: a emboscada não é publicável — só decidirEncontro publica", () => {
    const { emboscada } = acampar({ ...base(), chanceDeEmboscada: 1, sorteio: 0 });
    expect(emboscada).not.toHaveProperty("publicar");
    expect(Object.keys(emboscada).sort()).not.toEqual(["id", "playerText", "title"]);

    const decidido = decidirEncontro(emboscada, "aceitar");
    expect(decidido.publicar).toEqual({
      id: "emb-1",
      title: "Visitantes na madrugada",
      playerText: TEXTO_DO_JOGADOR,
    });
    expect(JSON.stringify(decidido.publicar)).not.toContain(SEGREDO);
  });

  test("o mestre ignorando a emboscada não deixa nada para o jogador", () => {
    const { emboscada } = acampar({ ...base(), chanceDeEmboscada: 1, sorteio: 0 });
    expect(decidirEncontro(emboscada, "ignorar").publicar).toBeNull();
  });

  test("emboscada sem sugestão vira pendência vazia — o mestre escreve na hora", () => {
    const { emboscada } = acampar({
      party: partyDeApoio(), horas: 8, chanceDeEmboscada: 1, sorteio: 0,
    });
    expect(emboscada.sugestao).toBeNull();
    expect(decidirEncontro(emboscada, "aceitar").publicar).toBeNull();
  });

  test("acampar é puro: mesma entrada, mesma saída", () => {
    const arg = { ...base(), chanceDeEmboscada: 0.5, sorteio: 0.1 };
    const a = acampar(arg);
    const b = acampar(arg);
    expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)));
  });

  test("nenhuma export deste módulo devolve `publicar` ou a projeção do jogador", () => {
    const chamadas = {
      acampar: [{ ...base(), chanceDeEmboscada: 1, sorteio: 0 }],
      podeAcampar: [{ viajando: true }],
      descansoRecuperado: [{ horas: 8 }],
    };
    const funcoes = Object.entries(acampamento)
      .filter(([, v]) => typeof v === "function")
      .map(([nome]) => nome)
      .sort();
    expect(funcoes).toEqual(Object.keys(chamadas).sort());

    Object.entries(chamadas).forEach(([nome, args]) => {
      const saida = acampamento[nome](...args);
      expect(saida).not.toHaveProperty("publicar");
      expect(Object.keys(saida).sort()).not.toEqual(["id", "playerText", "title"]);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * descansoRecuperado — genérico de propósito
 * ═══════════════════════════════════════════════════════════════════════ */

describe("descansoRecuperado", () => {
  test("devolve as horas e um rótulo — e nada de regra de sistema", () => {
    const r = descansoRecuperado({ horas: 8 });
    expect(Object.keys(r).sort()).toEqual(["horas", "longo", "rotulo"]);
    expect(r.horas).toBe(8);
    expect(r.longo).toBe(true);
    expect(typeof r.rotulo).toBe("string");
  });

  test("não devolve PV, PE, dado de vida, condição nem nada de ficha", () => {
    const json = JSON.stringify(descansoRecuperado({ horas: 8 }));
    ["pv", "PV", "pe", "PE", "vida", "hp", "sanidade", "condic", "cura", "dano"]
      .forEach((proibido) => expect(json).not.toContain(proibido));
  });

  test("o limiar do descanso longo é constante exportada e ajustável", () => {
    expect(HORAS_DE_DESCANSO_LONGO).toBe(8);
    expect(descansoRecuperado({ horas: 4, limiarLongo: 4 }).longo).toBe(true);
    expect(descansoRecuperado({ horas: 8, limiarLongo: 12 }).longo).toBe(false);
  });

  test("os três rótulos, sem repetição", () => {
    const nenhum = descansoRecuperado({ horas: 0 });
    const curto = descansoRecuperado({ horas: 2 });
    const longo = descansoRecuperado({ horas: 10 });
    expect(nenhum.longo).toBe(false);
    expect(curto.longo).toBe(false);
    expect(longo.longo).toBe(true);
    expect(new Set([nenhum.rotulo, curto.rotulo, longo.rotulo]).size).toBe(3);
  });

  test("horas negativas ou tortas viram zero", () => {
    expect(descansoRecuperado({ horas: -5 }).horas).toBe(0);
    expect(descansoRecuperado({ horas: NaN }).horas).toBe(0);
    expect(descansoRecuperado({}).horas).toBe(0);
    expect(descansoRecuperado().horas).toBe(0);
  });

  test("limiar torto cai no padrão", () => {
    expect(descansoRecuperado({ horas: 8, limiarLongo: NaN }).longo).toBe(true);
    expect(descansoRecuperado({ horas: 8, limiarLongo: 0 }).longo).toBe(true);
    expect(descansoRecuperado({ horas: 8, limiarLongo: -3 }).longo).toBe(true);
  });
});
