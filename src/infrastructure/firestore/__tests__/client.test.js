import { paraEpochMs, comDatasEmMs, silent, NOOP_UNSUBSCRIBE } from "../client";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

/* `paraEpochMs` é o contrato do AC-5 da spec 0032: NENHUM campo de data sai de um repositório
   como primitiva do SDK. Estes testes são a prova de que a fronteira fecha para as três formas
   que a data assume no Firestore — e para o lixo. */
describe("paraEpochMs", () => {
  it("converte o `Timestamp` do SDK (o caminho normal de um snapshot ao vivo)", () => {
    // Duck typing de propósito: `client.js` NÃO importa `Timestamp`, senão o normalizador
    // dependeria da classe que ele existe para esconder.
    expect(paraEpochMs({ toMillis: () => 1_700_000_000_123 })).toBe(1_700_000_000_123);
  });

  it("converte o objeto cru `{seconds, nanoseconds}` (data vinda de cache/serialização)", () => {
    // Quando o SDK não reidrata a classe, a data chega como objeto plano. Antes da spec 0032
    // cada tela resolvia isso sozinha: o chat lia `.toMillis()`, o feed de rolagens lia
    // `.seconds` — e só uma das duas leituras funcionava em cada situação.
    expect(paraEpochMs({ seconds: 1_700_000_000, nanoseconds: 123_000_000 })).toBe(1_700_000_000_123);
  });

  it("converte a variante `{_seconds, _nanoseconds}`", () => {
    expect(paraEpochMs({ _seconds: 1_700_000_000, _nanoseconds: 500_000_000 })).toBe(1_700_000_000_500);
  });

  it("nanossegundos ausentes contam como zero", () => {
    expect(paraEpochMs({ seconds: 1_700_000_000 })).toBe(1_700_000_000_000);
  });

  it("número epoch-ms passa intacto — a função é IDEMPOTENTE", () => {
    // Normalizar o já normalizado tem de ser inofensivo: é o que permite chamar `withId` em
    // qualquer ponto do repo sem rastrear se a data já passou por aqui.
    expect(paraEpochMs(1_700_000_000_123)).toBe(1_700_000_000_123);
    expect(paraEpochMs(paraEpochMs({ toMillis: () => 42 }))).toBe(42);
    expect(paraEpochMs(0)).toBe(0); // epoch 0 é data válida, não "sem data"
  });

  it("aceita `Date`, para o caso de o valor já ter sido convertido antes de chegar aqui", () => {
    expect(paraEpochMs(new Date(1_700_000_000_123))).toBe(1_700_000_000_123);
  });

  it("`null` e `undefined` viram `null` — é a ESCRITA OTIMISTA", () => {
    // Quem envia a mensagem recebe o próprio documento de volta ANTES de o servidor carimbar
    // o `serverTimestamp()`, e nesse instante o campo chega `null`. `null` (e não `0`, que
    // jogaria a mensagem para 1970 e a faria sumir pelo corte do TTL; nem `Date.now()`, que
    // inventaria uma data que o repositório não tem) preserva o fato de "ainda sem carimbo",
    // e quem consome aplica o fallback que já aplicava.
    expect(paraEpochMs(null)).toBeNull();
    expect(paraEpochMs(undefined)).toBeNull();
  });

  it("lixo vira `null` em vez de `NaN` ou de exceção", () => {
    // `NaN` atravessaria toda comparação como `false` e o defeito só apareceria três telas
    // depois (AC-6). Aqui ele morre na fronteira.
    expect(paraEpochMs("2026-08-02")).toBeNull();
    expect(paraEpochMs(NaN)).toBeNull();
    expect(paraEpochMs(Infinity)).toBeNull();
    expect(paraEpochMs({})).toBeNull();
    expect(paraEpochMs({ seconds: "muitos" })).toBeNull();
    expect(paraEpochMs([])).toBeNull();
    expect(paraEpochMs(true)).toBeNull();
    expect(paraEpochMs(new Date("data inválida"))).toBeNull();
  });

  it("`toMillis` que devolve lixo também vira `null`", () => {
    expect(paraEpochMs({ toMillis: () => undefined })).toBeNull();
    expect(paraEpochMs({ toMillis: () => NaN })).toBeNull();
  });
});

describe("comDatasEmMs", () => {
  it("normaliza só os campos declarados, deixando o resto intacto", () => {
    const saida = comDatasEmMs(
      { content: "Olá", timestamp: { toMillis: () => 10 }, criadoEm: { toMillis: () => 20 } },
      ["timestamp"]
    );
    expect(saida.timestamp).toBe(10);
    expect(saida.content).toBe("Olá");
    // `criadoEm` não foi declarado como campo de data deste agregado: sai como veio.
    expect(saida.criadoEm).toEqual({ toMillis: expect.any(Function) });
  });

  it("campo AUSENTE continua ausente — não vira `timestamp: null`", () => {
    // Um doc de `typing` não tem `timestamp`. Criar a chave mudaria a forma do objeto que a
    // UI recebe (e quebraria todo `toEqual` na borda) sem ganho nenhum.
    const saida = comDatasEmMs({ userName: "Ana" }, ["timestamp", "updatedAt"]);
    expect(saida).toEqual({ userName: "Ana" });
    expect("timestamp" in saida).toBe(false);
  });

  it("não muta o objeto de entrada", () => {
    const entrada = { timestamp: { toMillis: () => 10 } };
    comDatasEmMs(entrada, ["timestamp"]);
    expect(typeof entrada.timestamp.toMillis).toBe("function");
  });
});

describe("silent", () => {
  beforeEach(() => { jest.spyOn(console, "error").mockImplementation(() => {}); });

  it("devolve o valor no caminho feliz", async () => {
    await expect(silent("repo.op", "fallback", async () => "ok")).resolves.toBe("ok");
  });

  it("falha nunca rejeita: loga com o prefixo `[repo.op]` e devolve o fallback", async () => {
    // O `tag` é o que torna a falha silenciosa rastreável no console — sem ele, `silent`
    // seria um `catch {}` com nome bonito.
    await expect(silent("repo.op", "fallback", async () => { throw new Error("x"); }))
      .resolves.toBe("fallback");
    expect(console.error).toHaveBeenCalledWith("[repo.op] falhou:", expect.any(Error));
  });
});

describe("NOOP_UNSUBSCRIBE", () => {
  it("é idempotente — chamar duas vezes é seguro", () => {
    expect(() => { NOOP_UNSUBSCRIBE(); NOOP_UNSUBSCRIBE(); }).not.toThrow();
  });
});
