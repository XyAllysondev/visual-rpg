/**
 * Contrato da cota por plano do Mapa-Múndi (spec 0028, AC-3).
 *
 * Lógica pura — nada de Firebase, nada de React. O que está sob teste é o
 * oráculo que a tela e o `worldMapStore` consultam antes de deixar criar.
 */
import {
  PLAN_QUOTAS, PLANO_PADRAO, SINONIMOS_PAGO, SINONIMOS_FREE,
  quotaFor, planoConhecido, canCreateMap, canAddNode,
} from "../model/quotas";

/** Toda mensagem que vai para a tela precisa ser uma frase de verdade em PT-BR. */
const frasePtBr = (texto) => {
  expect(typeof texto).toBe("string");
  expect(texto.trim().length).toBeGreaterThan(0);
  // Nada de `Infinity`/`NaN`/`undefined` vazando do cálculo para o mestre ler.
  expect(texto).not.toMatch(/infinity|nan|undefined|null/i);
};

describe("PLAN_QUOTAS", () => {
  it("fixa os limites que a spec exige (AC-3)", () => {
    expect(PLAN_QUOTAS.free).toEqual({ maps: 1, nodes: 25 });
    expect(PLAN_QUOTAS.pro).toEqual({ maps: Infinity, nodes: 500 });
  });

  it("assume o plano gratuito como padrão", () => {
    expect(PLANO_PADRAO).toBe("free");
  });
});

describe("quotaFor", () => {
  it("devolve a cota do plano gratuito", () => {
    expect(quotaFor("free")).toEqual({ maps: 1, nodes: 25 });
  });

  it("devolve a cota do plano pago", () => {
    expect(quotaFor("pro")).toEqual({ maps: Infinity, nodes: 500 });
  });

  // Os identificadores REAIS de assinatura do projeto (`subscribedSystems` guarda
  // ids de sistema; a cobrança usa `planName: 'ordem'`) — ver cabeçalho de quotas.js.
  it.each(SINONIMOS_PAGO)("reconhece %s como plano pago", (nome) => {
    expect(quotaFor(nome)).toEqual({ maps: Infinity, nodes: 500 });
  });

  it.each(SINONIMOS_FREE)("reconhece %s como plano gratuito", (nome) => {
    expect(quotaFor(nome)).toEqual({ maps: 1, nodes: 25 });
  });

  it("ignora caixa e espaços em volta", () => {
    expect(quotaFor("  PRO  ")).toEqual({ maps: Infinity, nodes: 500 });
    expect(quotaFor("Free")).toEqual({ maps: 1, nodes: 25 });
    expect(quotaFor("  Ordem ")).toEqual({ maps: Infinity, nodes: 500 });
  });

  it.each([
    ["plano inventado", "lendario"],
    ["string vazia", ""],
    ["só espaços", "   "],
    ["undefined", undefined],
    ["null", null],
    ["número", 7],
    ["objeto", { plan: "pro" }],
    ["array", ["pro"]],
    ["booleano", true],
  ])("cai no plano mais restritivo quando o plano é %s", (_rotulo, entrada) => {
    expect(quotaFor(entrada)).toEqual(PLAN_QUOTAS.free);
  });

  it("devolve uma cópia — mexer no resultado não corrompe a tabela", () => {
    const q = quotaFor("free");
    q.maps = 999;
    expect(PLAN_QUOTAS.free.maps).toBe(1);
    expect(quotaFor("free").maps).toBe(1);
  });
});

describe("planoConhecido", () => {
  it("separa identificador reconhecido de chute", () => {
    expect(planoConhecido("free")).toBe(true);
    expect(planoConhecido("pro")).toBe(true);
    expect(planoConhecido("op")).toBe(true);
    expect(planoConhecido("lendario")).toBe(false);
    expect(planoConhecido("")).toBe(false);
    expect(planoConhecido(undefined)).toBe(false);
  });
});

describe("canCreateMap", () => {
  it("deixa o mestre do plano gratuito criar o primeiro mapa", () => {
    const r = canCreateMap("free", 0);
    expect(r.ok).toBe(true);
    expect(r.limite).toBe(1);
    frasePtBr(r.motivo);
  });

  // Borda: n-1, n, n+1 em cima do limite de 1 mapa do plano gratuito.
  it.each([
    [0, true],
    [1, false],
    [2, false],
  ])("plano gratuito com %i mapa(s) → ok=%s", (quantos, esperado) => {
    const r = canCreateMap("free", quantos);
    expect(r.ok).toBe(esperado);
    expect(r.limite).toBe(1);
    frasePtBr(r.motivo);
  });

  it("explica o limite e o caminho ao recusar (AC-3: não falha em silêncio)", () => {
    const r = canCreateMap("free", 1);
    expect(r.ok).toBe(false);
    frasePtBr(r.motivo);
    expect(r.motivo).toMatch(/plano/i);
    expect(r.motivo).toMatch(/assine|apague/i); // o caminho de saída
  });

  it("nunca trava o plano pago, por mais mapas que ele tenha", () => {
    for (const quantos of [0, 1, 25, 500, 10000]) {
      const r = canCreateMap("pro", quantos);
      expect(r.ok).toBe(true);
      expect(r.limite).toBe(Infinity);
      frasePtBr(r.motivo);
    }
  });

  it("plano desconhecido é tratado como o mais restritivo", () => {
    expect(canCreateMap("lendario", 1).ok).toBe(false);
    expect(canCreateMap(undefined, 1).ok).toBe(false);
    expect(canCreateMap("lendario", 0)).toMatchObject({ ok: true, limite: 1 });
  });

  it("contagem inválida é tratada como zero, sem NaN vazando", () => {
    for (const ruim of [undefined, null, NaN, -3, "muitos", {}]) {
      const r = canCreateMap("free", ruim);
      expect(r.ok).toBe(true);
      frasePtBr(r.motivo);
    }
  });
});

describe("canAddNode", () => {
  // Borda: n-1, n, n+1 em cima do limite de 25 nós do plano gratuito.
  it.each([
    [24, true],
    [25, false],
    [26, false],
  ])("plano gratuito com %i nó(s) → ok=%s", (quantos, esperado) => {
    const r = canAddNode("free", quantos);
    expect(r.ok).toBe(esperado);
    expect(r.limite).toBe(25);
    frasePtBr(r.motivo);
  });

  // Borda: n-1, n, n+1 em cima do limite de 500 nós do plano pago.
  it.each([
    [499, true],
    [500, false],
    [501, false],
  ])("plano pago com %i nó(s) → ok=%s", (quantos, esperado) => {
    const r = canAddNode("pro", quantos);
    expect(r.ok).toBe(esperado);
    expect(r.limite).toBe(500);
    frasePtBr(r.motivo);
  });

  it("deixa plantar o primeiro nó em qualquer plano", () => {
    expect(canAddNode("free", 0).ok).toBe(true);
    expect(canAddNode("pro", 0).ok).toBe(true);
  });

  it("aponta o teto do plano pago ao recusar no gratuito", () => {
    const r = canAddNode("free", 25);
    expect(r.ok).toBe(false);
    frasePtBr(r.motivo);
    expect(r.motivo).toMatch(/500/);
    expect(r.motivo).toMatch(/assine|apague/i);
  });

  it("não promete upgrade quando já está no teto pago", () => {
    const r = canAddNode("pro", 500);
    expect(r.ok).toBe(false);
    frasePtBr(r.motivo);
    expect(r.motivo).not.toMatch(/assine/i);
  });

  it("plano desconhecido é tratado como o mais restritivo", () => {
    expect(canAddNode("lendario", 25).ok).toBe(false);
    expect(canAddNode("lendario", 24).ok).toBe(true);
    expect(canAddNode(undefined, 25).limite).toBe(25);
  });

  it("contagem inválida é tratada como zero, sem NaN vazando", () => {
    for (const ruim of [undefined, null, NaN, -3, "muitos", {}]) {
      const r = canAddNode("free", ruim);
      expect(r.ok).toBe(true);
      frasePtBr(r.motivo);
    }
  });
});
