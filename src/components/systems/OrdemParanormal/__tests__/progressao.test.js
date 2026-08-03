/* Motor de progressão automática — fidelidade ao livro e comportamento.
 * Os números vêm das tabelas 1.2 a 1.5 (pgs. 23, 25, 29 e 33) e das páginas
 * de características de classe (24, 28, 32). Cada bloco cita a fonte. */

import {
  CLASSES, MARCOS, NEX_STEPS, ELEMENTOS_AFINIDADE, BONUS_ORIGEM,
} from "../progressao/tabelas";
import {
  derivar, pendencias, aplicar, reverterPara, planoDeAvanco, linhaDoTempo,
  circuloMaximo, normalizarNex, proximoNex, nivelDeNex, checarPreRequisito,
  sincronizarHabilidades, habilidadesEsperadas, tipoDaPendencia,
} from "../progressao/motor";

const attrs = (over = {}) => ({ AGI: 1, FOR: 1, INT: 1, PRE: 1, VIG: 1, ...over });

const ficha = (over = {}) => ({
  nex: 5,
  classe: { id: "combatente", name: "Combatente" },
  attrs: attrs(),
  skillTreino: {},
  habilidades: [],
  rituais: [],
  ...over,
});

/* ════════════════════════════════════════════════════════════════════════ */
describe("tabelas — fidelidade ao livro", () => {
  it("PV/PE/SAN iniciais e por NEX batem com as pgs. 24, 28 e 32", () => {
    expect(CLASSES.combatente.pv).toMatchObject({ base: 20, porNex: 4, vig: true });
    expect(CLASSES.combatente.pe).toMatchObject({ base: 2, porNex: 2, pre: true });
    expect(CLASSES.combatente.san).toMatchObject({ base: 12, porNex: 3 });

    expect(CLASSES.especialista.pv).toMatchObject({ base: 16, porNex: 3 });
    expect(CLASSES.especialista.pe).toMatchObject({ base: 3, porNex: 3 });
    expect(CLASSES.especialista.san).toMatchObject({ base: 16, porNex: 4 });

    expect(CLASSES.ocultista.pv).toMatchObject({ base: 12, porNex: 2 });
    expect(CLASSES.ocultista.pe).toMatchObject({ base: 4, porNex: 4 });
    expect(CLASSES.ocultista.san).toMatchObject({ base: 20, porNex: 5 });
  });

  it("Grau de Treinamento tem contas DIFERENTES por classe (2/5/3 + Int)", () => {
    expect(CLASSES.combatente.grauTreinamento(3)).toBe(5);
    expect(CLASSES.especialista.grauTreinamento(3)).toBe(8);
    expect(CLASSES.ocultista.grauTreinamento(3)).toBe(6);
  });

  it("perícias treinadas de classe seguem o livro", () => {
    /* combatente: uma de Luta/Pontaria, uma de Fortitude/Reflexos, +1+Int */
    expect(CLASSES.combatente.periciasEscolhaUma).toEqual([
      ["Luta", "Pontaria"], ["Fortitude", "Reflexos"],
    ]);
    expect(CLASSES.combatente.periciasLivres(2)).toBe(3);
    /* especialista: 7 + Int, sem fixas */
    expect(CLASSES.especialista.periciasLivres(2)).toBe(9);
    expect(CLASSES.especialista.periciasFixas).toEqual([]);
    /* ocultista: Ocultismo e Vontade + 3 + Int */
    expect(CLASSES.ocultista.periciasFixas).toEqual(["Ocultismo", "Vontade"]);
    expect(CLASSES.ocultista.periciasLivres(2)).toBe(5);
  });

  it("cada classe tem os 20 degraus e os quatro marcos de trilha", () => {
    for (const id of ["combatente", "especialista", "ocultista"]) {
      const nexUsados = new Set(MARCOS[id].map((m) => m.nex));
      expect([...nexUsados].sort((a, b) => a - b)).toEqual(NEX_STEPS);
      const trilhas = MARCOS[id].filter((m) => m.tipo === "trilha" || m.tipo === "habilidade_trilha");
      expect(trilhas.map((t) => t.nex)).toEqual([10, 40, 65, 99]);
    }
  });

  it("aumento de atributo em 20/50/80/95 e grau de treinamento em 35/70", () => {
    for (const id of ["combatente", "especialista", "ocultista"]) {
      expect(MARCOS[id].filter((m) => m.tipo === "aumento_atributo").map((m) => m.nex)).toEqual([20, 50, 80, 95]);
      expect(MARCOS[id].filter((m) => m.tipo === "grau_treinamento").map((m) => m.nex)).toEqual([35, 70]);
      expect(MARCOS[id].filter((m) => m.tipo === "versatilidade").map((m) => m.nex)).toEqual([50]);
    }
  });

  it("Medo não é elemento de afinidade (o livro é explícito)", () => {
    expect(ELEMENTOS_AFINIDADE).toEqual(["conhecimento", "energia", "morte", "sangue"]);
    expect(ELEMENTOS_AFINIDADE).not.toContain("medo");
  });
});

/* ════════════════════════════════════════════════════════════════════════ */
describe("derivar — números que o jogador nunca digita", () => {
  it("NEX 99% é o vigésimo degrau (nível 19), não 19,8", () => {
    expect(nivelDeNex(5)).toBe(0);
    expect(nivelDeNex(50)).toBe(9);
    expect(nivelDeNex(99)).toBe(19);
  });

  it("combatente VIG 2: 22 PV no NEX 5% e 76 no NEX 50%", () => {
    const f = ficha({ attrs: attrs({ VIG: 2 }) });
    expect(derivar(f).pvMax).toBe(22);
    expect(derivar({ ...f, nex: 50 }).pvMax).toBe(22 + 9 * 6);
  });

  it("ocultista PRE 3: PE 7 no NEX 5% e SAN 20 → 115 no 99%", () => {
    const f = ficha({ classe: { id: "ocultista" }, attrs: attrs({ PRE: 3 }) });
    expect(derivar(f).peMax).toBe(7);
    expect(derivar({ ...f, nex: 99 }).peMax).toBe(7 + 19 * 7);
    expect(derivar({ ...f, nex: 99 }).sanMax).toBe(20 + 19 * 5);
  });

  it("limite de PE por turno segue a Tabela 1.2 (5%→1 … 99%→20)", () => {
    const f = ficha();
    expect(derivar({ ...f, nex: 5 }).limitePeTurno).toBe(1);
    expect(derivar({ ...f, nex: 30 }).limitePeTurno).toBe(6);
    expect(derivar({ ...f, nex: 95 }).limitePeTurno).toBe(19);
    expect(derivar({ ...f, nex: 99 }).limitePeTurno).toBe(20);
  });

  it("círculo de ritual abre em 5/25/55/85", () => {
    expect(circuloMaximo(5)).toBe(1);
    expect(circuloMaximo(24)).toBe(1);
    expect(circuloMaximo(25)).toBe(2);
    expect(circuloMaximo(55)).toBe(3);
    expect(circuloMaximo(85)).toBe(4);
    expect(circuloMaximo(99)).toBe(4);
  });

  it("Calejado (Desgarrado) soma +1 PV a cada 5% de NEX", () => {
    const base = ficha({ nex: 50, attrs: attrs({ VIG: 2 }) });
    const comOrigem = { ...base, origem: { id: "desgarrado" } };
    expect(derivar(comOrigem).pvMax - derivar(base).pvMax).toBe(10);
    expect(derivar(comOrigem).bonusOrigem.poder).toBe("Calejado");
  });

  it("Cicatrizes Psicológicas (Vítima) soma +1 SAN a cada 5% de NEX", () => {
    const base = ficha({ nex: 40 });
    const comOrigem = { ...base, origem: { id: "vitima" } };
    expect(derivar(comOrigem).sanMax - derivar(base).sanMax).toBe(8);
  });

  it("Dedicação (Universitário) dá +1 PE por NEX ímpar e +1 no limite por turno", () => {
    const f = (nex) => ({ ...ficha({ nex }), origem: { id: "universitario" } });
    expect(BONUS_ORIGEM.universitario.pe(5)).toBe(1);
    expect(BONUS_ORIGEM.universitario.pe(15)).toBe(2);
    expect(BONUS_ORIGEM.universitario.pe(25)).toBe(3);
    expect(derivar(f(5)).limitePeTurno).toBe(2);
    expect(derivar(f(50)).limitePeTurno).toBe(11);
  });

  it("normalizarNex prende nos degraus válidos", () => {
    expect(normalizarNex(0)).toBe(5);
    expect(normalizarNex(37)).toBe(35);
    expect(normalizarNex(120)).toBe(99);
    expect(normalizarNex("abacaxi")).toBe(5);
    expect(proximoNex(95)).toBe(99);
    expect(proximoNex(99)).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════════ */
describe("pendências — só o que o livro manda ESCOLHER", () => {
  it("combatente recém-criado deve as duas perícias de grupo e as livres", () => {
    const ps = pendencias(ficha({ attrs: attrs({ INT: 2 }) }));
    const ids = ps.map((p) => p.id);
    expect(ids).toContain("5:pericia_grupo_0");
    expect(ids).toContain("5:pericia_grupo_1");
    expect(ps.find((p) => p.id === "5:pericias_livres").quantidade).toBe(3); // 1 + Int 2
  });

  it("grupo de perícia só oferece as duas do livro", () => {
    const p = pendencias(ficha()).find((x) => x.id === "5:pericia_grupo_0");
    expect(p.opcoes.map((o) => o.id)).toEqual(["Luta", "Pontaria"]);
  });

  it("as perícias fixas do ocultista já contam como treinadas", () => {
    const p = pendencias(ficha({ classe: { id: "ocultista" } })).find((x) => x.id === "5:pericias_livres");
    expect(p.opcoes.find((o) => o.id === "Ocultismo").disponivel).toBe(false);
    expect(p.opcoes.find((o) => o.id === "Vontade").disponivel).toBe(false);
    expect(p.opcoes.find((o) => o.id === "Luta").disponivel).toBe(true);
  });

  it("trilha aparece no NEX 10% e some depois de escolhida", () => {
    const f = ficha({ nex: 10 });
    expect(pendencias(f).some((p) => p.id === "10:trilha_10")).toBe(true);
    const depois = aplicar(f, { "10:trilha_10": "guerreiro" });
    expect(pendencias(depois).some((p) => p.id === "10:trilha_10")).toBe(false);
    expect(depois.trilha).toMatchObject({ id: "guerreiro" });
  });

  it("aumento de atributo bloqueia quem já está em 5", () => {
    const f = ficha({ nex: 20, attrs: attrs({ FOR: 5 }) });
    const p = pendencias(f).find((x) => x.tipo === "aumento_atributo");
    const forOpt = p.opcoes.find((o) => o.id === "FOR");
    expect(forOpt.disponivel).toBe(false);
    expect(forOpt.motivo).toMatch(/máximo/i);
  });

  it("grau de treinamento só oferece perícias já treinadas", () => {
    const f = ficha({ nex: 35, attrs: attrs({ INT: 2 }), skillTreino: { Luta: 5, Atletismo: 15 } });
    const p = pendencias(f).find((x) => x.tipo === "grau_treinamento");
    expect(p.quantidade).toBe(4); // combatente: 2 + Int 2
    expect(p.opcoes.find((o) => o.id === "Luta").disponivel).toBe(true);
    expect(p.opcoes.find((o) => o.id === "Atletismo").disponivel).toBe(false); // já expert
    expect(p.opcoes.find((o) => o.id === "Pontaria").disponivel).toBe(false); // destreinada
  });

  it("versatilidade oferece poderes da classe e o 1º poder das OUTRAS trilhas", () => {
    const f = aplicar(ficha({ nex: 50 }), { "10:trilha_10": "guerreiro" });
    const p = pendencias(f).find((x) => x.tipo === "versatilidade");
    const idsTrilha = p.opcoes.filter((o) => o.id.startsWith("trilha:")).map((o) => o.id);
    expect(idsTrilha).not.toContain("trilha:guerreiro");
    expect(idsTrilha).toContain("trilha:aniquilador");
  });

  it("afinidade só surge no NEX 50% e some quando o elemento existe", () => {
    expect(pendencias(ficha({ nex: 45 })).some((p) => p.tipo === "afinidade")).toBe(false);
    expect(pendencias(ficha({ nex: 50 })).some((p) => p.tipo === "afinidade")).toBe(true);
    expect(pendencias(ficha({ nex: 50, elementoAfinidade: "morte" })).some((p) => p.tipo === "afinidade")).toBe(false);
  });

  it("ocultista deve 3 rituais de 1º círculo na criação e 1 por NEX depois", () => {
    const ps = pendencias(ficha({ classe: { id: "ocultista" }, nex: 25 }));
    const iniciais = ps.find((p) => p.id === "5:rituais_iniciais");
    expect(iniciais.quantidade).toBe(3);
    expect(iniciais.opcoes.every((o) => o.circulo === 1)).toBe(true);
    expect(ps.filter((p) => p.ref === "ritual").map((p) => p.nex)).toEqual([10, 15, 20, 25]);
    /* no NEX 25 o 2º círculo já está aberto */
    expect(ps.find((p) => p.id === "25:ritual").opcoes.some((o) => o.circulo === 2)).toBe(true);
    expect(ps.find((p) => p.id === "20:ritual").opcoes.some((o) => o.circulo === 2)).toBe(false);
  });

  it("ficha sem classe não gera pendência nenhuma", () => {
    expect(pendencias({ nex: 50 })).toEqual([]);
  });
});

/* ════════════════════════════════════════════════════════════════════════ */
describe("pré-requisitos", () => {
  it("Proteção Pesada exige NEX 30% e diz o motivo", () => {
    const abaixo = checarPreRequisito("protecao_pesada", ficha({ nex: 25 }));
    expect(abaixo.ok).toBe(false);
    expect(abaixo.motivo).toMatch(/NEX 30%/);
    expect(checarPreRequisito("protecao_pesada", ficha({ nex: 30 })).ok).toBe(true);
  });

  it("Tanque de Guerra exige o poder Proteção Pesada", () => {
    const f = ficha({ nex: 45 });
    expect(checarPreRequisito("tanque_guerra", f, []).ok).toBe(false);
    expect(checarPreRequisito("tanque_guerra", f, ["protecao_pesada"]).ok).toBe(true);
  });

  it("Combater com Duas Armas exige AGI 3 e treino em Luta ou Pontaria", () => {
    const semNada = checarPreRequisito("comb_duas_armas", ficha({ attrs: attrs({ AGI: 2 }) }));
    expect(semNada.ok).toBe(false);
    expect(semNada.motivo).toMatch(/Agilidade 3/);
    const ok = checarPreRequisito("comb_duas_armas", ficha({ attrs: attrs({ AGI: 3 }), skillTreino: { Luta: 5 } }));
    expect(ok.ok).toBe(true);
  });

  it("nenhum poder é repetível salvo indicação; Transcender é a exceção", () => {
    const f = ficha({ nex: 45 });
    expect(checarPreRequisito("golpe_pesado", f, ["golpe_pesado"]).ok).toBe(false);
    expect(checarPreRequisito("transcender", f, ["transcender"]).ok).toBe(true);
  });

  it("a lista de poderes já vem com os bloqueados marcados", () => {
    const p = pendencias(ficha({ nex: 15 })).find((x) => x.tipo === "poder_classe");
    expect(p.opcoes.find((o) => o.id === "protecao_pesada").disponivel).toBe(false);
    expect(p.opcoes.some((o) => o.disponivel)).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════════════ */
describe("aplicar — o motor escreve a ficha", () => {
  it("escolher a trilha já concede o poder de trilha do NEX 10%", () => {
    const f = aplicar(ficha({ nex: 10 }), { "10:trilha_10": "aniquilador" });
    expect(f.habilidades.some((h) => h.nome === "Ataque Poderoso")).toBe(true);
  });

  it("os poderes de trilha de 40/65/99 entram sozinhos ao subir o NEX", () => {
    const base = aplicar(ficha({ nex: 10 }), { "10:trilha_10": "aniquilador" });
    const nomes = aplicar(base, {}, { nex: 65 }).habilidades.map((h) => h.nome);
    expect(nomes).toEqual(expect.arrayContaining(["Ataque Poderoso", "Destruidor", "Incontível"]));
    expect(nomes).not.toContain("Força Bruta"); // só no 99%
  });

  it("é idempotente: aplicar duas vezes não duplica nada", () => {
    const um = aplicar(ficha({ nex: 15 }), { "10:trilha_10": "guerreiro", "15:poder_15": "golpe_pesado" });
    const dois = aplicar(um, {});
    expect(dois.habilidades).toHaveLength(um.habilidades.length);
    const nomes = dois.habilidades.map((h) => h.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("Ataque Especial 2 PE é APOSENTADO pela versão de 3 PE no NEX 25%", () => {
    const f5 = aplicar(ficha({ nex: 5 }), {});
    expect(f5.habilidades.filter((h) => h.nome === "Ataque Especial")).toHaveLength(1);
    expect(f5.habilidades.find((h) => h.nome === "Ataque Especial").descricao).toMatch(/2 PE/);

    const aes = aplicar(f5, {}, { nex: 25 }).habilidades.filter((h) => h.nome === "Ataque Especial");
    expect(aes).toHaveLength(1);
    expect(aes[0].descricao).toMatch(/3 PE/);
  });

  it("Perito do especialista sobe 1d6 → 1d12 sem acumular cópias", () => {
    const peritos = aplicar(ficha({ classe: { id: "especialista" }, nex: 85 }), {})
      .habilidades.filter((h) => h.nome === "Perito");
    expect(peritos).toHaveLength(1);
    expect(peritos[0].descricao).toMatch(/1d12/);
  });

  it("aumento de atributo soma 1 e respeita o teto 5", () => {
    const f = aplicar(ficha({ nex: 20, attrs: attrs({ FOR: 2 }) }), { "20:atributo_20": "FOR" });
    expect(f.attrs.FOR).toBe(3);
    const noTeto = aplicar(ficha({ nex: 20, attrs: attrs({ FOR: 5 }) }), { "20:atributo_20": "FOR" });
    expect(noTeto.attrs.FOR).toBe(5);
    expect(noTeto.progressao.marcos["20:atributo_20"]).toBeUndefined();
  });

  it("grau de treinamento sobe de 5 em 5 e ignora destreinada", () => {
    const f = aplicar(
      ficha({ nex: 35, skillTreino: { Luta: 5, Fortitude: 10 } }),
      { "35:grau_35": ["Luta", "Fortitude", "Pilotagem"] },
    );
    expect(f.skillTreino.Luta).toBe(10);
    expect(f.skillTreino.Fortitude).toBe(15);
    expect(f.skillTreino.Pilotagem).toBeUndefined();
  });

  it("perícias escolhidas viram treinadas (+5)", () => {
    const f = aplicar(ficha(), { "5:pericia_grupo_0": "Luta", "5:pericias_livres": ["Atletismo", "Tática"] });
    expect(f.skillTreino).toMatchObject({ Luta: 5, Atletismo: 5, "Tática": 5 });
  });

  it("afinidade grava o elemento e recusa Medo", () => {
    expect(aplicar(ficha({ nex: 50 }), { "50:afinidade": "morte" }).elementoAfinidade).toBe("morte");
    expect(aplicar(ficha({ nex: 50 }), { "50:afinidade": "medo" }).elementoAfinidade).toBeUndefined();
  });

  it("ritual escolhido entra na ficha com o objeto oficial completo", () => {
    const f = aplicar(
      ficha({ classe: { id: "ocultista" }, nex: 5 }),
      { "5:rituais_iniciais": ["amaldicoar_arma_conhecimento"] },
    );
    expect(f.rituais).toHaveLength(1);
    expect(f.rituais[0]).toMatchObject({ id: "amaldicoar_arma_conhecimento", circulo: 1 });
    expect(f.rituais[0].descricao).toBeTruthy();
  });

  it("PV/PE/SAN máximos são gravados e o valor atual é aparado", () => {
    const f = aplicar(ficha({ nex: 5, attrs: attrs({ VIG: 2 }), pv: 999 }), {}, { nex: 10 });
    expect(f.pvMax).toBe(28); // 22 + 1 × (4+2)
    expect(f.pv).toBe(28);
  });

  it("o poder da origem entra sozinho na lista de habilidades", () => {
    const f = aplicar(ficha({
      origem: { id: "lutador", name: "Lutador", power: "Mão Pesada. Você recebe +2 em rolagens de dano com ataques corpo a corpo." },
    }), {});
    expect(f.habilidades.some((h) => h.nome === "Mão Pesada")).toBe(true);
  });

  it("as perícias da origem já entram treinadas, sem escolha", () => {
    const f = aplicar(ficha({ origem: { id: "investigador", skills: ["Investigação", "Percepção"] } }), {});
    expect(f.skillTreino).toMatchObject({ "Investigação": 5, "Percepção": 5 });
  });
});

/* ════════════════════════════════════════════════════════════════════════ */
describe("habilidades manuais são intocáveis", () => {
  it("o que o jogador escreveu não é apagado nem reescrito", () => {
    const minha = { id: 1, nome: "Truque da casa", descricao: "homebrew do mestre", dados: "1d6" };
    const f = aplicar(ficha({ nex: 25, habilidades: [minha] }), {});
    expect(f.habilidades.find((h) => h.id === 1)).toMatchObject(minha);
  });

  it("ADOÇÃO: entrada digitada à mão com o mesmo nome não vira cópia dupla", () => {
    const digitada = { id: 7, nome: "Ataque Especial", descricao: "texto antigo", dados: "", imagem_url: "" };
    const aes = aplicar(ficha({ nex: 5, habilidades: [digitada] }), {})
      .habilidades.filter((h) => h.nome === "Ataque Especial");
    expect(aes).toHaveLength(1);
    expect(aes[0].id).toBe(7);                 // manteve a entrada do jogador
    expect(aes[0].origem.motor).toBeTruthy();  // agora sob controle do motor
    expect(aes[0].descricao).toMatch(/2 PE/);  // e com o texto do livro
  });

  it("sincronizar é estável quando nada mudou", () => {
    const f = aplicar(ficha({ nex: 30 }), { "10:trilha_10": "guerreiro", "15:poder_15": "golpe_pesado" });
    expect(sincronizarHabilidades(f)).toHaveLength(f.habilidades.length);
    expect(habilidadesEsperadas(f).length).toBeGreaterThan(0);
  });
});

/* ════════════════════════════════════════════════════════════════════════ */
describe("planoDeAvanco", () => {
  it("mostra os ganhos automáticos do degrau", () => {
    const plano = planoDeAvanco(ficha({ nex: 5, attrs: attrs({ VIG: 2, PRE: 1 }) }), 10);
    expect(plano.automaticos.find((x) => x.rotulo === "Pontos de Vida")).toMatchObject({ de: 22, para: 28, ganho: 6 });
    expect(plano.automaticos.find((x) => x.rotulo === "Limite de PE por turno")).toMatchObject({ de: 1, para: 2 });
  });

  it("traz só as escolhas do intervalo, não as antigas", () => {
    const f = aplicar(ficha({ nex: 15 }), { "10:trilha_10": "guerreiro" });
    expect(planoDeAvanco(f, 20).escolhas.map((e) => e.id)).toEqual(["20:atributo_20"]);
  });

  it("anuncia o círculo novo do ocultista", () => {
    const plano = planoDeAvanco(ficha({ classe: { id: "ocultista" }, nex: 20 }), 25);
    expect(plano.automaticos.some((x) => x.rotulo === "Círculo máximo de ritual")).toBe(true);
    expect(plano.habilidadesAutomaticas.some((h) => /2º círculo/.test(h.nome))).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════════════ */
describe("reverter — baixar o NEX sem estragar a ficha", () => {
  const construir = () =>
    aplicar(
      ficha({
        nex: 35, attrs: attrs({ FOR: 2, INT: 1 }), skillTreino: { Luta: 5 },
        habilidades: [{ id: 9, nome: "Anotação minha", descricao: "x" }],
      }),
      {
        "10:trilha_10": "guerreiro",
        "15:poder_15": "golpe_pesado",
        "20:atributo_20": "FOR",
        "35:grau_35": ["Luta"],
      },
    );

  it("devolve o ponto de atributo e o grau de treinamento", () => {
    const alto = construir();
    expect(alto.attrs.FOR).toBe(3);
    expect(alto.skillTreino.Luta).toBe(10);

    const baixo = reverterPara(alto, 15);
    expect(baixo.nex).toBe(15);
    expect(baixo.attrs.FOR).toBe(2);
    expect(baixo.skillTreino.Luta).toBe(5);
  });

  it("tira as habilidades concedidas acima do NEX e mantém as do jogador", () => {
    const nomes = reverterPara(construir(), 10).habilidades.map((h) => h.nome);
    expect(nomes).toContain("Anotação minha");
    expect(nomes).toContain("Técnica Letal");   // trilha do NEX 10 permanece
    expect(nomes).not.toContain("Golpe Pesado"); // poder do 15 sai
  });

  it("restaura a versão anterior de uma habilidade que havia sido aposentada", () => {
    const alto = aplicar(ficha({ nex: 25 }), {});
    expect(alto.habilidades.find((h) => h.nome === "Ataque Especial").descricao).toMatch(/3 PE/);
    const ae = reverterPara(alto, 5).habilidades.filter((h) => h.nome === "Ataque Especial");
    expect(ae).toHaveLength(1);
    expect(ae[0].descricao).toMatch(/2 PE/);
  });

  it("limpa trilha e afinidade quando o marco delas é desfeito", () => {
    const alto = aplicar(ficha({ nex: 50 }), { "10:trilha_10": "guerreiro", "50:afinidade": "sangue" });
    const baixo = reverterPara(alto, 5);
    expect(baixo.trilha).toBeNull();
    expect(baixo.elementoAfinidade).toBeNull();
  });

  it("remove os rituais aprendidos acima do NEX alvo", () => {
    const oc = aplicar(
      ficha({ classe: { id: "ocultista" }, nex: 10 }),
      { "5:rituais_iniciais": ["amaldicoar_arma_conhecimento"], "10:ritual": ["compreensao_paranormal"] },
    );
    expect(oc.rituais).toHaveLength(2);
    expect(reverterPara(oc, 5).rituais.map((r) => r.id)).toEqual(["amaldicoar_arma_conhecimento"]);
  });
});

/* ════════════════════════════════════════════════════════════════════════ */
describe("linha do tempo e utilidades", () => {
  it("marca alcançado, atual e pendente", () => {
    const linha = linhaDoTempo(ficha({ nex: 15 }));
    expect(linha).toHaveLength(NEX_STEPS.length);
    expect(linha.find((l) => l.nex === 10).alcancado).toBe(true);
    expect(linha.find((l) => l.nex === 15).atual).toBe(true);
    expect(linha.find((l) => l.nex === 20).alcancado).toBe(false);
    expect(linha.find((l) => l.nex === 10).itens.some((i) => i.pendente)).toBe(true);
  });

  it("tipoDaPendencia classifica todos os ids emitidos", () => {
    expect(tipoDaPendencia("5:pericia_grupo_0", "combatente")).toBe("pericia");
    expect(tipoDaPendencia("5:pericias_livres", "combatente")).toBe("pericia");
    expect(tipoDaPendencia("10:trilha_10", "combatente")).toBe("trilha");
    expect(tipoDaPendencia("40:trilha_40", "combatente")).toBe("habilidade_trilha");
    expect(tipoDaPendencia("15:poder_15", "combatente")).toBe("poder_classe");
    expect(tipoDaPendencia("50:versatilidade_50", "combatente")).toBe("versatilidade");
    expect(tipoDaPendencia("20:atributo_20", "combatente")).toBe("aumento_atributo");
    expect(tipoDaPendencia("35:grau_35", "combatente")).toBe("grau_treinamento");
    expect(tipoDaPendencia("50:afinidade", "combatente")).toBe("afinidade");
    expect(tipoDaPendencia("25:ritual", "ocultista")).toBe("ritual");
  });
});
