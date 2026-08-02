/**
 * Gate do MODELO DE ENCONTROS (spec 0028 · F6 · AC-8, AC-1, AC-9).
 *
 * Escrito **antes** da implementação (`model/encontros.js`), como a spec exige
 * para o núcleo puro do Mapa-Múndi.
 *
 * A regra que este arquivo existe para travar é a do briefing §9:
 *
 *   > "Ao disparar, pausa a viagem e notifica o mestre com o resultado rolado;
 *   > **o mestre decide** aceitar, trocar ou ignorar antes de o jogador ver
 *   > qualquer coisa. Nada de encontro aparecendo sem o mestre saber."
 *
 * Traduzida em invariantes verificáveis:
 *
 *  1. **Sortear não publica.** `sortearEncontro` devolve `{ houve, chance,
 *     rolagem }` — três valores numéricos/booleanos e nada mais. Não há texto
 *     nenhum na saída, então não existe nada ali que a UI possa mostrar ao
 *     jogador, nem por engano.
 *  2. **Só `decidirEncontro` produz `publicar`.** Uma varredura chama TODAS as
 *     exports do módulo e falha se qualquer outra devolver a projeção do
 *     jogador ou uma chave `publicar`.
 *  3. **`ignorar` publica `null`.** Não é texto vazio, não é objeto vazio: é a
 *     ausência do documento.
 *  4. **AC-1 aqui:** `projecaoDoEncontro` devolve `{ id, title, playerText }`.
 *     A varredura do JSON serializado falha se `gmText`, `chance`, `rolagem` ou
 *     `sugestao` aparecerem de qualquer forma.
 */
import * as encontros from "../model/encontros";
import {
  CHANCE_POR_HORA,
  DECISOES,
  PERIODOS,
  chanceDeEncontro,
  decidirEncontro,
  getPeriodo,
  montarPendencia,
  periodoDe,
  pesoDoPeriodo,
  projecaoDoEncontro,
  sorteioDeD100,
  sortearEncontro,
} from "../model/encontros";

/* ═══════════════════════════════════════════════════════════════════════
 * Marcadores. Se qualquer um destes aparecer num payload de jogador, o
 * teste falha — é o mesmo truque de `eventos.test.js`.
 * ═══════════════════════════════════════════════════════════════════════ */

const SEGREDO = "SEGREDO-DO-MESTRE-NAO-PODE-VAZAR";
const TEXTO_DO_JOGADOR = "Vultos se movem entre as árvores.";

function encontroDeApoio(extra) {
  return {
    id: "enc-1",
    title: "Batedores na estrada",
    playerText: TEXTO_DO_JOGADOR,
    gmText: SEGREDO,
    dificuldade: 3,
    tabela: [SEGREDO],
    ...extra,
  };
}

function pendenciaDeApoio(extra) {
  return montarPendencia({
    trilhaId: "t1",
    noId: "praca",
    periodo: "noite",
    chance: 0.4,
    rolagem: 0.1,
    sugestao: encontroDeApoio(),
    ...extra,
  });
}

/* ═══════════════════════════════════════════════════════════════════════
 * PERÍODOS
 * ═══════════════════════════════════════════════════════════════════════ */

describe("PERIODOS e periodoDe", () => {
  test("são os quatro do briefing, com rótulo em PT-BR", () => {
    expect(PERIODOS.map((p) => p.id)).toEqual(["madrugada", "manha", "tarde", "noite"]);
    PERIODOS.forEach((p) => {
      expect(typeof p.label).toBe("string");
      expect(p.label.trim()).not.toBe("");
    });
    expect(PERIODOS.map((p) => p.label)).toEqual(["Madrugada", "Manhã", "Tarde", "Noite"]);
  });

  test("a tabela é congelada — ninguém reescreve o peso em tempo de execução", () => {
    expect(Object.isFrozen(PERIODOS)).toBe(true);
    PERIODOS.forEach((p) => expect(Object.isFrozen(p)).toBe(true));
  });

  test("as faixas cobrem as 24 horas sem buraco e sem sobreposição", () => {
    const cobertas = [];
    for (let h = 0; h < 24; h += 1) {
      const achados = PERIODOS.filter((p) => h >= p.horaInicial && h <= p.horaFinal);
      expect(achados).toHaveLength(1);
      cobertas.push(achados[0].id);
    }
    expect(cobertas).toHaveLength(24);
  });

  test("periodoDe classifica o relógio de jogo `{dia, hora, minuto}`", () => {
    expect(periodoDe({ dia: 1, hora: 0, minuto: 0 })).toBe("madrugada");
    expect(periodoDe({ dia: 3, hora: 5, minuto: 59 })).toBe("madrugada");
    expect(periodoDe({ dia: 1, hora: 6, minuto: 0 })).toBe("manha");
    expect(periodoDe({ dia: 1, hora: 11, minuto: 59 })).toBe("manha");
    expect(periodoDe({ dia: 1, hora: 12, minuto: 0 })).toBe("tarde");
    expect(periodoDe({ dia: 1, hora: 17, minuto: 0 })).toBe("tarde");
    expect(periodoDe({ dia: 1, hora: 18, minuto: 0 })).toBe("noite");
    expect(periodoDe({ dia: 1, hora: 23, minuto: 59 })).toBe("noite");
  });

  test("periodoDe também aceita horas absolutas, como avancarRelogio", () => {
    expect(periodoDe(0)).toBe("madrugada");
    expect(periodoDe(9)).toBe("manha");
    expect(periodoDe(24 + 14)).toBe("tarde");
    expect(periodoDe(48 + 20.5)).toBe("noite");
  });

  test("relógio ausente ou torto vale como o começo da campanha (dia 1, 00:00)", () => {
    expect(periodoDe(null)).toBe("madrugada");
    expect(periodoDe(undefined)).toBe("madrugada");
    expect(periodoDe({})).toBe("madrugada");
    expect(periodoDe("três da tarde")).toBe("madrugada");
    expect(periodoDe(NaN)).toBe("madrugada");
  });

  test("getPeriodo devolve a entrada da tabela, ou null", () => {
    expect(getPeriodo("noite").label).toBe("Noite");
    expect(getPeriodo("crepúsculo")).toBeNull();
    expect(getPeriodo(null)).toBeNull();
  });

  test("noite e madrugada pesam mais que manhã e tarde (briefing §9)", () => {
    expect(pesoDoPeriodo("madrugada")).toBeGreaterThan(pesoDoPeriodo("tarde"));
    expect(pesoDoPeriodo("noite")).toBeGreaterThan(pesoDoPeriodo("tarde"));
    expect(pesoDoPeriodo("tarde")).toBeGreaterThan(pesoDoPeriodo("manha"));
  });

  test("período desconhecido é neutro (peso 1) — não infla nem zera a chance", () => {
    expect(pesoDoPeriodo("crepúsculo")).toBe(1);
    expect(pesoDoPeriodo(undefined)).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * chanceDeEncontro — a fórmula
 * ═══════════════════════════════════════════════════════════════════════ */

describe("chanceDeEncontro", () => {
  test("perigo 0 nunca dá encontro — nem à noite, nem numa viagem de dias", () => {
    expect(chanceDeEncontro({ dangerLevel: 0, periodo: "madrugada", horas: 72 })).toBe(0);
    expect(chanceDeEncontro({ dangerLevel: 0, periodo: "noite", horas: 999 })).toBe(0);
    expect(chanceDeEncontro({ dangerLevel: 0, periodo: "noite", horas: 8, modificador: 10 })).toBe(0);
  });

  test("sem perigo declarado, o padrão é 0 — falha fechado", () => {
    expect(chanceDeEncontro({ periodo: "noite", horas: 8 })).toBe(0);
    expect(chanceDeEncontro({})).toBe(0);
    expect(chanceDeEncontro()).toBe(0);
  });

  test("mais perigo, mais chance (monotônica em dangerLevel)", () => {
    const chances = [0, 1, 2, 3, 4, 5].map((d) =>
      chanceDeEncontro({ dangerLevel: d, periodo: "tarde", horas: 4 }));
    for (let i = 1; i < chances.length; i += 1) {
      expect(chances[i]).toBeGreaterThan(chances[i - 1]);
    }
  });

  test("trecho mais longo, mais chance (monotônica em horas)", () => {
    const curta = chanceDeEncontro({ dangerLevel: 3, periodo: "tarde", horas: 2 });
    const media = chanceDeEncontro({ dangerLevel: 3, periodo: "tarde", horas: 6 });
    const longa = chanceDeEncontro({ dangerLevel: 3, periodo: "tarde", horas: 24 });
    expect(media).toBeGreaterThan(curta);
    expect(longa).toBeGreaterThan(media);
  });

  test("horas zero ou negativas não dão encontro", () => {
    expect(chanceDeEncontro({ dangerLevel: 5, periodo: "noite", horas: 0 })).toBe(0);
    expect(chanceDeEncontro({ dangerLevel: 5, periodo: "noite", horas: -8 })).toBe(0);
    expect(chanceDeEncontro({ dangerLevel: 5, periodo: "noite" })).toBe(0);
  });

  test("noite e madrugada dão mais chance que a mesma viagem de dia", () => {
    const base = { dangerLevel: 3, horas: 6 };
    const manha = chanceDeEncontro({ ...base, periodo: "manha" });
    const tarde = chanceDeEncontro({ ...base, periodo: "tarde" });
    const noite = chanceDeEncontro({ ...base, periodo: "noite" });
    const madrugada = chanceDeEncontro({ ...base, periodo: "madrugada" });
    expect(manha).toBeLessThan(tarde);
    expect(tarde).toBeLessThan(noite);
    expect(noite).toBeLessThan(madrugada);
  });

  test("a fórmula é a documentada: 1 − (1 − p)^horas, com p = base × peso × modificador", () => {
    const p = CHANCE_POR_HORA[3] * pesoDoPeriodo("noite") * 1;
    expect(chanceDeEncontro({ dangerLevel: 3, periodo: "noite", horas: 5 }))
      .toBeCloseTo(1 - (1 - p) ** 5, 10);
  });

  test("o modificador multiplica a chance por hora", () => {
    const semMod = chanceDeEncontro({ dangerLevel: 2, periodo: "tarde", horas: 4 });
    const dobro = chanceDeEncontro({ dangerLevel: 2, periodo: "tarde", horas: 4, modificador: 2 });
    const zero = chanceDeEncontro({ dangerLevel: 2, periodo: "tarde", horas: 4, modificador: 0 });
    expect(dobro).toBeGreaterThan(semMod);
    expect(zero).toBe(0);
  });

  test("modificador torto vale 1 (neutro), não zero", () => {
    const neutro = chanceDeEncontro({ dangerLevel: 2, periodo: "tarde", horas: 4 });
    expect(chanceDeEncontro({ dangerLevel: 2, periodo: "tarde", horas: 4, modificador: NaN }))
      .toBeCloseTo(neutro, 10);
    expect(chanceDeEncontro({ dangerLevel: 2, periodo: "tarde", horas: 4, modificador: -3 }))
      .toBeCloseTo(neutro, 10);
  });

  test("a saída é sempre uma fração entre 0 e 1", () => {
    [0, 1, 2, 3, 4, 5, 9, -2, NaN].forEach((d) => {
      [0, 0.5, 8, 240, -1].forEach((h) => {
        const c = chanceDeEncontro({ dangerLevel: d, periodo: "madrugada", horas: h, modificador: 50 });
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      });
    });
  });

  test("perigo acima de 5 é grampeado no teto da escala do editor", () => {
    const mortal = chanceDeEncontro({ dangerLevel: 5, periodo: "tarde", horas: 4 });
    expect(chanceDeEncontro({ dangerLevel: 42, periodo: "tarde", horas: 4 })).toBeCloseTo(mortal, 10);
  });

  test("é pura: mil chamadas com a mesma entrada dão o mesmo número", () => {
    const arg = { dangerLevel: 4, periodo: "noite", horas: 7, modificador: 1.3 };
    const primeira = chanceDeEncontro(arg);
    for (let i = 0; i < 1000; i += 1) expect(chanceDeEncontro(arg)).toBe(primeira);
  });

  test("não muta a entrada", () => {
    const arg = { dangerLevel: 3, periodo: "noite", horas: 4 };
    const copia = { ...arg };
    chanceDeEncontro(arg);
    expect(arg).toEqual(copia);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * sortearEncontro — a INVARIANTE nº 1
 * ═══════════════════════════════════════════════════════════════════════ */

describe("sortearEncontro", () => {
  const contexto = { dangerLevel: 5, periodo: "madrugada", horas: 8 };

  test("devolve exatamente { houve, chance, rolagem } — e nada mais", () => {
    const r = sortearEncontro(contexto, 0.01);
    expect(Object.keys(r).sort()).toEqual(["chance", "houve", "rolagem"]);
  });

  test("INVARIANTE: sozinho, não devolve NADA que a UI possa mostrar ao jogador", () => {
    const r = sortearEncontro(contexto, 0.01);
    // Nenhum valor de texto na saída: não há o que renderizar numa tela.
    Object.values(r).forEach((v) => expect(typeof v).not.toBe("string"));
    const json = JSON.stringify(r);
    ["title", "playerText", "gmText", "sugestao", "publicar", SEGREDO, TEXTO_DO_JOGADOR]
      .forEach((proibido) => expect(json).not.toContain(proibido));
  });

  test("o sorteio entra por parâmetro — número", () => {
    expect(sortearEncontro(contexto, 0).houve).toBe(true);
    expect(sortearEncontro(contexto, 0.999).houve).toBe(false);
  });

  test("o sorteio entra por parâmetro — função", () => {
    expect(sortearEncontro(contexto, () => 0).houve).toBe(true);
    expect(sortearEncontro(contexto, () => 0.999).houve).toBe(false);
  });

  test("a borda é meio-aberta: rolagem < chance", () => {
    const chance = chanceDeEncontro(contexto);
    expect(sortearEncontro(contexto, chance).houve).toBe(false);
    expect(sortearEncontro(contexto, chance - 1e-9).houve).toBe(true);
  });

  test("sem sorteio, não dispara — o módulo não sorteia por conta própria", () => {
    const r = sortearEncontro(contexto);
    expect(r.houve).toBe(false);
    expect(r.rolagem).toBeNull();
    expect(sortearEncontro(contexto, "muito").houve).toBe(false);
    expect(sortearEncontro(contexto, () => undefined).houve).toBe(false);
  });

  test("chance zero não dispara nem com a melhor rolagem possível", () => {
    const r = sortearEncontro({ dangerLevel: 0, periodo: "madrugada", horas: 40 }, 0);
    expect(r.houve).toBe(false);
    expect(r.chance).toBe(0);
  });

  test("chance 1 dispensa a rolagem — certeza não precisa de dado", () => {
    const r = sortearEncontro({ dangerLevel: 5, periodo: "noite", horas: 8, modificador: 99 });
    expect(r.chance).toBe(1);
    expect(r.houve).toBe(true);
  });

  test("aceita `dataHora` no lugar de `periodo` e deriva o período", () => {
    const comPeriodo = sortearEncontro({ dangerLevel: 3, periodo: "noite", horas: 6 }, 0.5);
    const comRelogio = sortearEncontro(
      { dangerLevel: 3, dataHora: { dia: 2, hora: 20, minuto: 0 }, horas: 6 }, 0.5,
    );
    expect(comRelogio.chance).toBeCloseTo(comPeriodo.chance, 10);
  });

  test("`contexto.chance` pronto entra direto (é o caso da emboscada do acampamento)", () => {
    const r = sortearEncontro({ chance: 0.25, dangerLevel: 0 }, 0.2);
    expect(r.chance).toBeCloseTo(0.25, 10);
    expect(r.houve).toBe(true);
    expect(sortearEncontro({ chance: 0.25 }, 0.3).houve).toBe(false);
  });

  test("contexto ausente não explode e não dispara", () => {
    expect(sortearEncontro().houve).toBe(false);
    expect(sortearEncontro(null, 0).houve).toBe(false);
  });

  test("não muta o contexto", () => {
    const ctx = { dangerLevel: 3, periodo: "noite", horas: 4 };
    const copia = { ...ctx };
    sortearEncontro(ctx, 0.01);
    expect(ctx).toEqual(copia);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * sorteioDeD100 — a ponte para o motor único de dados (AC-9)
 * ═══════════════════════════════════════════════════════════════════════ */

describe("sorteioDeD100", () => {
  test("usa o motor de dados do projeto, com rng por parâmetro", () => {
    expect(sorteioDeD100(() => 0)).toBeCloseTo(0, 10);      // 1 em 1d100 → 0.00
    expect(sorteioDeD100(() => 0.999)).toBeCloseTo(0.99, 10); // 100 em 1d100 → 0.99
  });

  test("a saída é sempre fração de 0 a 1, e plugável direto em sortearEncontro", () => {
    for (let i = 0; i < 100; i += 1) {
      const f = sorteioDeD100(() => i / 100);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
    const r = sortearEncontro({ dangerLevel: 5, periodo: "noite", horas: 8 }, () => sorteioDeD100(() => 0));
    expect(r.houve).toBe(true);
  });

  test("sem rng, não inventa aleatoriedade — devolve null", () => {
    expect(sorteioDeD100()).toBeNull();
    expect(sorteioDeD100("dado")).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * montarPendencia — o que SÓ o mestre vê
 * ═══════════════════════════════════════════════════════════════════════ */

describe("montarPendencia", () => {
  test("carrega o que só o mestre vê: chance, rolagem e a sugestão inteira", () => {
    const p = pendenciaDeApoio();
    expect(p.chance).toBeCloseTo(0.4, 10);
    expect(p.rolagem).toBeCloseTo(0.1, 10);
    expect(p.sugestao.gmText).toBe(SEGREDO);
    expect(p.trilhaId).toBe("t1");
    expect(p.noId).toBe("praca");
    expect(p.periodo).toBe("noite");
  });

  test("a sugestão é a referência original — o mestre precisa do documento inteiro", () => {
    const sugestao = encontroDeApoio();
    expect(pendenciaDeApoio({ sugestao }).sugestao).toBe(sugestao);
  });

  test("marca a origem: viagem por padrão, acampamento quando pedido", () => {
    expect(pendenciaDeApoio().origem).toBe("viagem");
    expect(pendenciaDeApoio({ origem: "acampamento" }).origem).toBe("acampamento");
    expect(pendenciaDeApoio({ origem: "sei lá" }).origem).toBe("viagem");
  });

  test("campos ausentes viram null, nunca undefined — o Firestore não grava undefined", () => {
    const p = montarPendencia();
    expect(p.trilhaId).toBeNull();
    expect(p.noId).toBeNull();
    expect(p.periodo).toBeNull();
    expect(p.sugestao).toBeNull();
    expect(p.rolagem).toBeNull();
    expect(p.chance).toBe(0);
    Object.values(p).forEach((v) => expect(v).not.toBeUndefined());
  });

  test("não é publicável: não existe a chave `publicar` nem a forma da projeção", () => {
    const p = pendenciaDeApoio();
    expect(p).not.toHaveProperty("publicar");
    expect(Object.keys(p).sort()).not.toEqual(["id", "playerText", "title"]);
  });

  test("não muta a entrada", () => {
    const arg = { trilhaId: "t1", noId: "praca", periodo: "noite", chance: 0.4, rolagem: 0.1 };
    const copia = { ...arg };
    montarPendencia(arg);
    expect(arg).toEqual(copia);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * decidirEncontro — a regra que não pode ser quebrada
 * ═══════════════════════════════════════════════════════════════════════ */

describe("decidirEncontro", () => {
  test("as três decisões do briefing, e só elas", () => {
    expect(DECISOES).toEqual(["aceitar", "trocar", "ignorar"]);
    expect(Object.isFrozen(DECISOES)).toBe(true);
  });

  test("aceitar publica a projeção da sugestão — e limpa a pendência", () => {
    const r = decidirEncontro(pendenciaDeApoio(), "aceitar");
    expect(r.pendencia).toBeNull();
    expect(r.publicar).toEqual({
      id: "enc-1",
      title: "Batedores na estrada",
      playerText: TEXTO_DO_JOGADOR,
    });
  });

  test("trocar publica a projeção do substituto, nunca a da sugestão original", () => {
    const substituto = encontroDeApoio({
      id: "enc-2",
      title: "Carroça quebrada",
      playerText: "Uma carroça atravessada na estrada.",
    });
    const r = decidirEncontro(pendenciaDeApoio(), "trocar", substituto);
    expect(r.pendencia).toBeNull();
    expect(r.publicar.id).toBe("enc-2");
    expect(JSON.stringify(r.publicar)).not.toContain(TEXTO_DO_JOGADOR);
  });

  test("ignorar publica NULL — a ausência do documento, não um texto vazio", () => {
    const r = decidirEncontro(pendenciaDeApoio(), "ignorar");
    expect(r.pendencia).toBeNull();
    expect(r.publicar).toBeNull();
  });

  test("decisão desconhecida NÃO decide: a pendência continua de pé e nada é publicado", () => {
    const p = pendenciaDeApoio();
    ["", null, undefined, "aceitar ", "IGNORAR", "publicar"].forEach((decisao) => {
      const r = decidirEncontro(p, decisao);
      expect(r.publicar).toBeNull();
      expect(r.pendencia).toBe(p);
    });
  });

  test("aceitar sem sugestão publica null — não inventa encontro", () => {
    const r = decidirEncontro(montarPendencia({ chance: 0.5, rolagem: 0.1 }), "aceitar");
    expect(r.pendencia).toBeNull();
    expect(r.publicar).toBeNull();
  });

  test("trocar sem substituto publica null — e não cai de volta na sugestão", () => {
    const r = decidirEncontro(pendenciaDeApoio(), "trocar");
    expect(r.pendencia).toBeNull();
    expect(r.publicar).toBeNull();
  });

  test("o publicado NUNCA leva o segredo do mestre, decida-se o que se decidir", () => {
    ["aceitar", "trocar", "ignorar", "outra coisa"].forEach((decisao) => {
      const r = decidirEncontro(pendenciaDeApoio(), decisao, encontroDeApoio({ id: "enc-2" }));
      const json = JSON.stringify(r.publicar);
      expect(json).not.toContain(SEGREDO);
      ["gmText", "chance", "rolagem", "sugestao", "dificuldade", "tabela"]
        .forEach((proibido) => expect(json ?? "").not.toContain(proibido));
    });
  });

  test("não muta a pendência", () => {
    const p = pendenciaDeApoio();
    const copia = JSON.parse(JSON.stringify(p));
    decidirEncontro(p, "aceitar");
    expect(JSON.parse(JSON.stringify(p))).toEqual(copia);
  });

  test("devolve exatamente { pendencia, publicar }", () => {
    expect(Object.keys(decidirEncontro(pendenciaDeApoio(), "aceitar")).sort())
      .toEqual(["pendencia", "publicar"]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * projecaoDoEncontro — o AC-1 aplicado aqui
 * ═══════════════════════════════════════════════════════════════════════ */

describe("projecaoDoEncontro", () => {
  test("devolve exatamente { id, title, playerText }", () => {
    expect(Object.keys(projecaoDoEncontro(encontroDeApoio())).sort())
      .toEqual(["id", "playerText", "title"]);
  });

  test("varredura do JSON: nada do lado do mestre atravessa", () => {
    const json = JSON.stringify(projecaoDoEncontro(encontroDeApoio({
      chance: 0.9,
      rolagem: 0.1,
      sugestao: { gmText: SEGREDO },
      gmNotes: SEGREDO,
      dangerLevel: 5,
    })));
    ["gmText", "gmNotes", "chance", "rolagem", "sugestao", "dificuldade", "tabela", "dangerLevel", SEGREDO]
      .forEach((proibido) => expect(json).not.toContain(proibido));
  });

  test("campo novo no documento do mestre não escorrega para o jogador", () => {
    const p = projecaoDoEncontro(encontroDeApoio({ campoInventadoAmanha: SEGREDO }));
    expect(p).not.toHaveProperty("campoInventadoAmanha");
    expect(JSON.stringify(p)).not.toContain(SEGREDO);
  });

  test("textos ausentes viram string vazia, nunca undefined", () => {
    expect(projecaoDoEncontro({ id: "enc-9" })).toEqual({ id: "enc-9", title: "", playerText: "" });
  });

  test("sem id não há documento onde gravar — devolve null", () => {
    expect(projecaoDoEncontro({ title: "sem id" })).toBeNull();
    expect(projecaoDoEncontro({ id: "  " })).toBeNull();
    expect(projecaoDoEncontro(null)).toBeNull();
    expect(projecaoDoEncontro()).toBeNull();
  });

  test("é objeto novo — não devolve a referência do molde", () => {
    const encontro = encontroDeApoio();
    expect(projecaoDoEncontro(encontro)).not.toBe(encontro);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * A VARREDURA DO MÓDULO — a INVARIANTE nº 2
 *
 * "Nenhuma função deste módulo produz algo publicável sem passar por
 *  decidirEncontro."
 * ═══════════════════════════════════════════════════════════════════════ */

describe("INVARIANTE do módulo: nada chega ao jogador sem a decisão do mestre", () => {
  const PORTAS_DE_PUBLICACAO = ["decidirEncontro", "projecaoDoEncontro"];

  /** Um argumento plausível para cada export, todos carregando o segredo. */
  const CHAMADAS = {
    chanceDeEncontro: [{ dangerLevel: 5, periodo: "madrugada", horas: 12 }],
    periodoDe: [{ dia: 1, hora: 22, minuto: 0 }],
    pesoDoPeriodo: ["noite"],
    getPeriodo: ["noite"],
    sorteioDeD100: [() => 0],
    sortearEncontro: [{ dangerLevel: 5, periodo: "noite", horas: 8, sugestao: encontroDeApoio() }, 0],
    montarPendencia: [{
      trilhaId: "t1", noId: "praca", periodo: "noite",
      chance: 0.9, rolagem: 0.01, sugestao: encontroDeApoio(),
    }],
  };

  const ehProjecao = (v) =>
    !!v && typeof v === "object" && !Array.isArray(v)
    && JSON.stringify(Object.keys(v).sort()) === JSON.stringify(["id", "playerText", "title"]);

  test("toda export deste módulo está coberta por esta varredura", () => {
    const funcoes = Object.entries(encontros)
      .filter(([, v]) => typeof v === "function")
      .map(([nome]) => nome)
      .sort();
    const cobertas = [...Object.keys(CHAMADAS), ...PORTAS_DE_PUBLICACAO].sort();
    expect(funcoes).toEqual(cobertas);
  });

  test("nenhuma função fora de decidirEncontro devolve `publicar` nem a projeção do jogador", () => {
    Object.entries(CHAMADAS).forEach(([nome, args]) => {
      const saida = encontros[nome](...args);
      expect(ehProjecao(saida)).toBe(false);
      if (saida && typeof saida === "object") {
        expect(saida).not.toHaveProperty("publicar");
      }
    });
  });

  test("o caminho inteiro: sortear → pendência → decidir. Antes de decidir, nada é publicável", () => {
    const contexto = { dangerLevel: 4, periodo: "madrugada", horas: 6 };
    const sorteado = sortearEncontro(contexto, 0);
    expect(sorteado.houve).toBe(true);

    // Passo 1 — o sorteio não produz documento nenhum.
    expect(sorteado).not.toHaveProperty("publicar");
    expect(JSON.stringify(sorteado)).not.toContain(TEXTO_DO_JOGADOR);

    // Passo 2 — a pendência é do mestre: carrega o segredo e não é publicável.
    const pendencia = montarPendencia({
      trilhaId: "t1",
      noId: "praca",
      periodo: contexto.periodo,
      chance: sorteado.chance,
      rolagem: sorteado.rolagem,
      sugestao: encontroDeApoio(),
    });
    expect(JSON.stringify(pendencia)).toContain(SEGREDO);
    expect(pendencia).not.toHaveProperty("publicar");

    // Passo 3 — só aqui nasce o que o jogador pode ver.
    const decidido = decidirEncontro(pendencia, "aceitar");
    expect(decidido.publicar).toEqual({
      id: "enc-1",
      title: "Batedores na estrada",
      playerText: TEXTO_DO_JOGADOR,
    });
    expect(JSON.stringify(decidido.publicar)).not.toContain(SEGREDO);
  });

  test("o mestre ignorando encerra o caso sem deixar rastro para o jogador", () => {
    const pendencia = pendenciaDeApoio();
    const decidido = decidirEncontro(pendencia, "ignorar");
    expect(decidido.publicar).toBeNull();
    expect(decidido.pendencia).toBeNull();
  });
});
