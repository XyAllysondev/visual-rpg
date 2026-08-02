/* ════════════════════════════════════════════════════════════════════
 *  EDITOR DO GRAFO — A LÓGICA PURA  (spec 0028 · F2 · gate do AC-4)
 *  --------------------------------------------------------------------
 *  Sem React e sem I/O: aqui está sob teste a matemática do render híbrido
 *  do design §5.3 — a virtualização por viewport, a pintura das trilhas no
 *  canvas — e os rótulos em português que o mestre e o leitor de tela leem.
 *
 *  O contexto 2D é um dublê: o que importa provar não são pixels, é QUE
 *  caminho foi traçado, com que espessura, tracejado ou contínuo. Pixel é
 *  verificação visual (AC-11); contrato é isto.
 * ════════════════════════════════════════════════════════════════════ */

import {
  FERRAMENTAS, NIVEIS_DE_PERIGO, TRACO_SECRETO,
  caixaDoViewport, espessuraDaTrilha, ferramentaPorTecla, ferramentasDisponiveis,
  formatarHoras,
  getFerramenta, nomeDaTrilha, nosVisiveis, pintarMapa, pontoDeControle,
  rotuloDaTrilha, rotuloDoNo, rotuloDoPerigo, usaCartografiaPadrao,
} from "../Editor/editorUi";
import { patchDoNo } from "../Editor/PainelDoNo";
import { patchDaTrilha } from "../Editor/PainelDaTrilha";
import { iconeDoNo } from "../Editor/TelaDoMapa";
import { MAPA_PADRAO_ID } from "../model/mapaPadrao";
import { criarNo, criarTrilha } from "../model/graph";
import { controlePadrao } from "../model/curves";

/* ── Acervo ──────────────────────────────────────────────────────────── */

const no = (id, x, y, extra = {}) => criarNo({ id, x, y, ...extra });

const NOS = [
  no("a", 0, 0, { name: "Vila Candeia", type: "town" }),
  no("b", 400, 300, { name: "Boca do Dono", type: "dungeon" }),
  no("c", 9000, 9000, { name: "Longe demais" }),
];

const trilha = (extra = {}) => criarTrilha({ id: "t1", fromId: "a", toId: "b", ...extra });

/* ════════════════════════════════════════════════════════════════════
 *  1 · VIRTUALIZAÇÃO POR VIEWPORT  (design §5.3)
 * ════════════════════════════════════════════════════════════════════ */
describe("virtualização (design §5.3)", () => {
  it("a caixa do viewport é o inverso exato da câmera, com folga em px de tela", () => {
    const caixa = caixaDoViewport({ x: 0, y: 0 }, 1, 800, 600, 100);
    expect(caixa).toEqual({ minX: -100, minY: -100, maxX: 900, maxY: 700 });

    /* A folga é dada em pixels de TELA: com zoom de 2×, 100px viram 50 unidades
       de mundo — a faixa visual de folga continua a mesma. */
    const comZoom = caixaDoViewport({ x: 0, y: 0 }, 2, 800, 600, 100);
    expect(comZoom).toEqual({ minX: -50, minY: -50, maxX: 450, maxY: 350 });
  });

  it("a caixa acompanha o deslocamento do mapa", () => {
    const caixa = caixaDoViewport({ x: -200, y: -100 }, 1, 800, 600, 0);
    expect(caixa).toEqual({ minX: 200, minY: 100, maxX: 1000, maxY: 700 });
  });

  it("só os nós dentro da caixa viram DOM — é isso que faz 500 nós custar como 30", () => {
    const caixa = caixaDoViewport({ x: 0, y: 0 }, 1, 800, 600, 0);
    const dentro = nosVisiveis(NOS, caixa);
    expect(dentro.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("mantém a identidade dos objetos (nada de cópia por quadro)", () => {
    const caixa = caixaDoViewport({ x: 0, y: 0 }, 1, 800, 600, 0);
    expect(nosVisiveis(NOS, caixa)[0]).toBe(NOS[0]);
  });

  it("sem caixa medida devolve tudo — melhor pintar demais do que piscar vazio", () => {
    expect(nosVisiveis(NOS, null)).toHaveLength(3);
    expect(nosVisiveis(NOS, { minX: 0, minY: 0, maxX: 0, maxY: 0 })).toHaveLength(3);
  });

  it("descarta nó sem coordenada em qualquer caminho — não há onde desenhá-lo", () => {
    const torto = [{ id: "x", name: "sem lugar" }, ...NOS];
    expect(nosVisiveis(torto, null).map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(nosVisiveis(torto, caixaDoViewport({ x: 0, y: 0 }, 1, 800, 600, 0)).map((n) => n.id))
      .toEqual(["a", "b"]);
  });

  it("aguenta entrada inválida sem quebrar o render", () => {
    expect(nosVisiveis(null, null)).toEqual([]);
    expect(nosVisiveis(undefined, { minX: 0, minY: 0, maxX: 10, maxY: 10 })).toEqual([]);
    expect(caixaDoViewport(null, NaN, NaN, NaN, NaN)).toEqual({
      minX: 0, minY: 0, maxX: 0, maxY: 0,
    });
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · PUNHO DA CURVA
 * ════════════════════════════════════════════════════════════════════ */
describe("ponto de controle da curva", () => {
  it("sem curvatura, nasce onde `controlePadrao` diz — determinístico", () => {
    expect(pontoDeControle(trilha(), NOS)).toEqual(controlePadrao({ x: 0, y: 0 }, { x: 400, y: 300 }));
  });

  it("com curvatura gravada, usa o primeiro ponto de controle", () => {
    const t = trilha({ pathPoints: [{ x: 120, y: -60 }] });
    expect(pontoDeControle(t, NOS)).toEqual({ x: 120, y: -60 });
  });

  it("trilha órfã não tem punho", () => {
    expect(pontoDeControle(criarTrilha({ fromId: "a", toId: "zzz" }), NOS)).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · PINTURA NO CANVAS  (as trilhas, design §5.3)
 * ════════════════════════════════════════════════════════════════════ */

/** Dublê do contexto 2D: registra o que foi mandado desenhar. */
function ctxFalso() {
  const registro = { traços: [], tracejados: [], espessuras: [], cores: [], imagens: 0 };
  let atual = null;
  return {
    registro,
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    drawImage: jest.fn(() => { registro.imagens += 1; }),
    beginPath: jest.fn(() => { atual = []; }),
    moveTo: jest.fn((x, y) => atual.push([x, y])),
    lineTo: jest.fn((x, y) => atual.push([x, y])),
    stroke: jest.fn(function stroke() {
      registro.traços.push(atual || []);
      registro.tracejados.push(this.__dash || []);
      registro.espessuras.push(this.lineWidth);
      registro.cores.push(this.strokeStyle);
    }),
    setLineDash: jest.fn(function setLineDash(d) { this.__dash = d; }),
    closePath: jest.fn(),
    fill: jest.fn(),
    lineWidth: 1,
    strokeStyle: "",
    fillStyle: "",
    lineCap: "",
    lineJoin: "",
  };
}

describe("pintura das trilhas no canvas", () => {
  const base = {
    largura: 800, altura: 600, dpr: 1,
    pan: { x: 0, y: 0 }, scale: 1, nos: NOS,
  };

  it("contexto ausente é no-op — no jsdom não existe canvas de verdade", () => {
    expect(pintarMapa(null, base)).toEqual({ trilhasPintadas: 0, fundoPintado: false });
    expect(pintarMapa({}, base)).toEqual({ trilhasPintadas: 0, fundoPintado: false });
  });

  it("pinta uma trilha com halo + traço (dois strokes por trilha)", () => {
    const ctx = ctxFalso();
    const r = pintarMapa(ctx, { ...base, trilhas: [trilha()] });
    expect(r.trilhasPintadas).toBe(1);
    expect(ctx.registro.traços).toHaveLength(2);
    expect(ctx.clearRect).toHaveBeenCalled();
  });

  it("a trilha secreta é TRACEJADA — o segredo salta aos olhos (AC-4)", () => {
    const ctx = ctxFalso();
    pintarMapa(ctx, { ...base, trilhas: [trilha({ isSecret: true })] });
    // o halo é contínuo; o traço principal é tracejado
    expect(ctx.registro.tracejados[0]).toEqual([]);
    expect(ctx.registro.tracejados[1]).toEqual(TRACO_SECRETO);
    expect(ctx.registro.cores[1]).toBe("#8a7ad6");
  });

  it("a trilha aberta NÃO é tracejada — a distinção só vale se for exclusiva", () => {
    const ctx = ctxFalso();
    pintarMapa(ctx, { ...base, trilhas: [trilha()] });
    expect(ctx.registro.tracejados[1]).toEqual([]);
  });

  it("a trilha selecionada veste o dourado do tema, já resolvido", () => {
    const ctx = ctxFalso();
    pintarMapa(ctx, {
      ...base, trilhas: [trilha()], trilhaSelecionada: "t1", corDeAcento: "#ffcc00",
    });
    expect(ctx.registro.cores[1]).toBe("#ffcc00");
  });

  it("mão única ganha uma seta; trilha comum, não", () => {
    const comum = ctxFalso();
    pintarMapa(comum, { ...base, trilhas: [trilha()] });
    expect(comum.fill).not.toHaveBeenCalled();

    const unica = ctxFalso();
    pintarMapa(unica, { ...base, trilhas: [trilha({ isOneWay: true })] });
    expect(unica.fill).toHaveBeenCalled();
  });

  it("trilha órfã não é desenhada — e não derruba as outras", () => {
    const ctx = ctxFalso();
    const r = pintarMapa(ctx, {
      ...base,
      trilhas: [criarTrilha({ id: "orfa", fromId: "a", toId: "sumiu" }), trilha()],
    });
    expect(r.trilhasPintadas).toBe(1);
  });

  it("converte mundo→tela com a mesma conta da câmera", () => {
    const ctx = ctxFalso();
    pintarMapa(ctx, { ...base, pan: { x: 50, y: 20 }, scale: 2, trilhas: [trilha()] });
    // a (0,0) e b (400,300) viram (50,20) e (850,620)
    expect(ctx.registro.traços[0][0]).toEqual([50, 20]);
    expect(ctx.registro.traços[0][1]).toEqual([850, 620]);
  });

  it("pinta a ilustração de fundo quando ela existe, e sobrevive quando falha", () => {
    const ctx = ctxFalso();
    const r = pintarMapa(ctx, {
      ...base, trilhas: [], imagem: { falso: true }, mundo: { largura: 1000, altura: 800 },
    });
    expect(r.fundoPintado).toBe(true);
    expect(ctx.drawImage).toHaveBeenCalledWith({ falso: true }, 0, 0, 1000, 800);

    const quebrado = ctxFalso();
    quebrado.drawImage = jest.fn(() => { throw new Error("imagem meio carregada"); });
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    const r2 = pintarMapa(quebrado, {
      ...base, trilhas: [trilha()], imagem: {}, mundo: { largura: 10, altura: 10 },
    });
    expect(r2.fundoPintado).toBe(false);
    expect(r2.trilhasPintadas).toBe(1); // o mapa continua utilizável sem o fundo
    aviso.mockRestore();
  });

  it("a espessura cresce com o nível de perigo", () => {
    const seguro = espessuraDaTrilha({ dangerLevel: 0 }, 1);
    const mortal = espessuraDaTrilha({ dangerLevel: 5 }, 1);
    expect(mortal).toBeGreaterThan(seguro);
    // e nunca some nem vira faixa nos extremos de zoom
    expect(espessuraDaTrilha({ dangerLevel: 0 }, 0.01)).toBeGreaterThan(1);
    expect(espessuraDaTrilha({ dangerLevel: 5 }, 100)).toBeLessThan(20);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · FERRAMENTAS E ATALHOS
 * ════════════════════════════════════════════════════════════════════ */
describe("ferramentas", () => {
  it("são as quatro do grafo (AC-4), o pincel de névoa (AC-5) e o evento (F5), com atalho único", () => {
    expect(FERRAMENTAS.map((f) => f.id))
      .toEqual(["selecionar", "no", "trilha", "mao", "nevoa", "evento"]);
    const atalhos = FERRAMENTAS.map((f) => f.atalho);
    expect(new Set(atalhos).size).toBe(atalhos.length);
  });

  it("o pincel de névoa só é oferecido com a névoa ligada", () => {
    /* Oferecer um pincel que não pinta nada seria mentira — e em somente
       leitura (mapa padrão) sobram só as duas que não escrevem no molde.
       A ferramenta de evento (F5) escreve no molde, então segue a mesma regra
       do nó e da trilha: existe sempre, some em somente leitura. */
    expect(ferramentasDisponiveis({ comNevoa: true }).map((f) => f.id))
      .toEqual(["selecionar", "no", "trilha", "mao", "nevoa", "evento"]);
    expect(ferramentasDisponiveis({ comNevoa: false }).map((f) => f.id))
      .toEqual(["selecionar", "no", "trilha", "mao", "evento"]);
    expect(ferramentasDisponiveis({ somenteLeitura: true, comNevoa: true }).map((f) => f.id))
      .toEqual(["selecionar", "mao"]);
    expect(ferramentasDisponiveis().map((f) => f.id))
      .toEqual(["selecionar", "no", "trilha", "mao", "evento"]);
  });

  it("toda ferramenta explica o que faz, em português", () => {
    FERRAMENTAS.forEach((f) => {
      expect(f.dica.length).toBeGreaterThan(20);
      expect(f.label).toBeTruthy();
    });
  });

  it("a tecla escolhe a ferramenta, com ou sem shift", () => {
    expect(ferramentaPorTecla("v")).toBe("selecionar");
    expect(ferramentaPorTecla("N")).toBe("no");
    expect(ferramentaPorTecla("t")).toBe("trilha");
    expect(ferramentaPorTecla("h")).toBe("mao");
    expect(ferramentaPorTecla("Escape")).toBeNull();
    expect(ferramentaPorTecla("z")).toBeNull();
    expect(ferramentaPorTecla(null)).toBeNull();
  });

  it("id desconhecido cai na primeira, e devolve cópia", () => {
    const f = getFerramenta("inexistente");
    expect(f.id).toBe("selecionar");
    f.label = "mexido";
    expect(getFerramenta("selecionar").label).toBe("Selecionar");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · RÓTULOS EM PORTUGUÊS (tela e leitor de tela)
 * ════════════════════════════════════════════════════════════════════ */
describe("rótulos", () => {
  it("as horas viram tempo de gente", () => {
    expect(formatarHoras(0)).toBe("imediato");
    expect(formatarHoras(0.5)).toBe("30 min");
    expect(formatarHoras(9)).toBe("9 h");
    expect(formatarHoras(1.5)).toBe("1,5 h");
    expect(formatarHoras(24)).toBe("1 dia");
    expect(formatarHoras(26)).toBe("1 dia e 2 h");
    expect(formatarHoras(-3)).toBe("—");
    expect(formatarHoras(null)).toBe("—");
  });

  it("o perigo tem os seis níveis do AC-4, com rótulo e explicação", () => {
    expect(NIVEIS_DE_PERIGO).toHaveLength(6);
    expect(rotuloDoPerigo(3).label).toBe("Arriscado");
    // grampeia fora da faixa em vez de devolver `undefined`
    expect(rotuloDoPerigo(99).valor).toBe(5);
    expect(rotuloDoPerigo(-4).valor).toBe(0);
    expect(rotuloDoPerigo(undefined).valor).toBe(0);
  });

  it("o nó anuncia tipo, nome e o que é segredo do mestre", () => {
    expect(rotuloDoNo(NOS[0])).toBe("Cidade: Vila Candeia");
    expect(rotuloDoNo(no("s", 1, 1, { name: "Cova", type: "secret" })))
      .toBe("Segredo: Cova, segredo do mestre");
    expect(rotuloDoNo(no("f", 1, 1, { name: "Porto", isFastTravel: true })))
      .toContain("viagem rápida");
    expect(rotuloDoNo(null)).toBe("Ponto de interesse: Lugar sem nome");
  });

  it("a trilha é dita pelas pontas, com a seta certa para mão única", () => {
    expect(nomeDaTrilha(trilha(), NOS)).toBe("Vila Candeia ↔ Boca do Dono");
    expect(nomeDaTrilha(trilha({ isOneWay: true }), NOS)).toBe("Vila Candeia → Boca do Dono");
    expect(nomeDaTrilha(criarTrilha({ fromId: "a", toId: "zz" }), NOS))
      .toContain("lugar desconhecido");
  });

  it("o rótulo da trilha diz tempo, segredo e perigo, nessa ordem", () => {
    const r = rotuloDaTrilha(trilha({ travelHours: 4, isSecret: true, dangerLevel: 5 }), NOS);
    expect(r).toBe("Trilha Vila Candeia ↔ Boca do Dono, 4 h, secreta, perigo mortal");
    expect(rotuloDaTrilha(trilha({ travelHours: 2 }), NOS)).not.toContain("secreta");
  });

  it("o ícone cai no do tipo quando o mestre não escolheu um", () => {
    expect(iconeDoNo({ type: "town" })).toBe("🏘️");
    expect(iconeDoNo({ type: "town", icon: "🐐" })).toBe("🐐");
    expect(iconeDoNo({ type: "town", icon: "   " })).toBe("🏘️");
    expect(iconeDoNo({ type: "tipo-que-não-existe" })).toBe("🧭");
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  6 · O QUE OS PAINÉIS GRAVAM
 * ════════════════════════════════════════════════════════════════════ */
describe("normalização dos painéis", () => {
  it("o nó nunca é salvo sem nome, e campo vazio vira `null`, não string vazia", () => {
    const p = patchDoNo({
      name: "   ", type: "camp", icon: "  ", color: "", rumorLabel: " boato ",
      description: "  texto  ", gmNotes: " segredo ", linkedSceneId: "  ",
      revealRadius: null, isFastTravel: false,
    });
    expect(p.name).toBe("Novo local");
    expect(p.icon).toBeNull();
    expect(p.linkedSceneId).toBeNull();
    expect(p.color).toBe("#7fb069");     // a cor do tipo `camp`
    expect(p.rumorLabel).toBe("boato");
    expect(p.gmNotes).toBe("segredo");
    expect(p.revealRadius).toBeNull();   // vazio ≠ zero
  });

  it("o teste de descoberta só existe em trilha secreta", () => {
    const secreta = patchDaTrilha({
      travelHours: 4, isSecret: true, isOneWay: false, dangerLevel: 5,
      pericia: " Investigação ", cd: 20,
    });
    expect(secreta.discoveryCheck).toEqual({ skill: "Investigação", dc: 20 });

    const aberta = patchDaTrilha({
      travelHours: 4, isSecret: false, dangerLevel: 0, pericia: "Investigação", cd: 20,
    });
    expect(aberta.discoveryCheck).toBeNull();

    const semCd = patchDaTrilha({ travelHours: 1, isSecret: true, pericia: "Percepção", cd: null });
    expect(semCd.discoveryCheck).toBeNull();
  });

  it("horas e perigo inválidos são saneados antes de virar documento", () => {
    const p = patchDaTrilha({ travelHours: -5, dangerLevel: 99, isSecret: false });
    expect(p.travelHours).toBe(0);
    expect(p.dangerLevel).toBe(5);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  7 · O MAPA PADRÃO E A CARTA VETORIAL  (AC-13)
 * ════════════════════════════════════════════════════════════════════ */
describe("integração com o mapa padrão (AC-13)", () => {
  it("o padrão sempre usa a carta vetorial", () => {
    expect(usaCartografiaPadrao({ id: MAPA_PADRAO_ID }, false)).toBe(true);
    expect(usaCartografiaPadrao({ id: MAPA_PADRAO_ID }, true)).toBe(true);
  });

  it("a cópia do padrão herda a carta até o mestre subir arte própria", () => {
    expect(usaCartografiaPadrao({ id: "abc", origem: MAPA_PADRAO_ID }, false)).toBe(true);
    expect(usaCartografiaPadrao({ id: "abc", origem: MAPA_PADRAO_ID }, true)).toBe(false);
  });

  it("mapa do usuário sem origem nunca herda a carta", () => {
    expect(usaCartografiaPadrao({ id: "abc" }, false)).toBe(false);
    expect(usaCartografiaPadrao(null, false)).toBe(false);
  });
});
