import {
  generateInviteCode,
  normalizeInviteCode,
  isActiveCampaign,
  systemOf,
  isFull,
  DEFAULT_SYSTEM,
  DEFAULT_MAX_PLAYERS,
} from "../campaign";

/* Regras puras da Campanha (spec 0029 AC-6): o `campaignsRepo` decide o que grava a
   partir daqui, então um erro nestas funções vira dado errado no Firestore. */

describe("generateInviteCode", () => {
  it("gera um código de 6 caracteres", () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it("nunca sorteia I, O, 0 nem 1 — o código é DITADO em voz alta na mesa", () => {
    // "I" vira "1" e "O" vira "0" na transcrição de quem ouve; o jogador receberia
    // "código inválido" sem entender por quê. 500 sorteios × 6 posições é amostra
    // suficiente para pegar um caractere ambíguo que tivesse voltado ao alfabeto.
    for (let i = 0; i < 500; i += 1) {
      expect(generateInviteCode()).not.toMatch(/[IO01]/);
    }
  });

  it("respeita as duas pontas do alfabeto, sem estourar o índice", () => {
    // Sorteio determinístico nas bordas: prova que o índice mínimo cai na primeira
    // letra e o máximo na última — um off-by-one aqui devolveria `undefined` e o
    // código sairia com "undefined" no meio.
    const random = jest.spyOn(Math, "random");
    random.mockReturnValue(0);
    expect(generateInviteCode()).toBe("AAAAAA");
    random.mockReturnValue(0.999999);
    expect(generateInviteCode()).toBe("999999");
    random.mockRestore();
  });
});

describe("normalizeInviteCode", () => {
  it("acha o mesmo código independente de caixa e de espaço colado", () => {
    // O jogador cola o código de um print ou digita em minúsculas; a comparação no
    // Firestore é literal, então a normalização é o que evita "código inválido".
    expect(normalizeInviteCode("  abc234 ")).toBe("ABC234");
    expect(normalizeInviteCode("AbC234")).toBe("ABC234");
  });

  it("vira string vazia quando não veio código — nunca 'null' nem 'undefined'", () => {
    // Se virasse a string "null", a query casaria com um documento corrompido.
    expect(normalizeInviteCode(null)).toBe("");
    expect(normalizeInviteCode(undefined)).toBe("");
    expect(normalizeInviteCode("")).toBe("");
  });
});

describe("isActiveCampaign", () => {
  it("campanha SEM o campo `isActive` é ativa", () => {
    // O campo nasceu depois das primeiras campanhas. Tratar ausência como inativa
    // faria as campanhas antigas sumirem da lista e recusarem entrada por convite.
    expect(isActiveCampaign({})).toBe(true);
    expect(isActiveCampaign({ name: "Mesa antiga" })).toBe(true);
  });

  it("só `isActive: false` desativa", () => {
    expect(isActiveCampaign({ isActive: true })).toBe(true);
    expect(isActiveCampaign({ isActive: false })).toBe(false);
  });
});

describe("systemOf", () => {
  it("devolve o sistema da campanha", () => {
    expect(systemOf({ system: "ordemParanormal" })).toBe("ordemParanormal");
  });

  it("cai em 'Genérico' quando não há sistema", () => {
    // O fallback precisa ser o MESMO na criação, na entrada e na contagem de limite:
    // se divergisse, a campanha contaria num balde e apareceria em outro.
    expect(systemOf({})).toBe(DEFAULT_SYSTEM);
    expect(systemOf({ system: "" })).toBe(DEFAULT_SYSTEM);
    expect(systemOf(null)).toBe(DEFAULT_SYSTEM);
    expect(DEFAULT_SYSTEM).toBe("Genérico");
  });
});

describe("isFull", () => {
  it("lota exatamente no teto declarado, não depois", () => {
    // A borda é o que interessa: com `>` em vez de `>=` entraria um jogador a mais.
    expect(isFull({ members: ["a"], maxPlayers: 2 })).toBe(false);
    expect(isFull({ members: ["a", "b"], maxPlayers: 2 })).toBe(true);
    expect(isFull({ members: ["a", "b", "c"], maxPlayers: 2 })).toBe(true);
  });

  it("campanha sem `maxPlayers` usa o teto padrão de 6", () => {
    const membros = (n) => Array.from({ length: n }, (_, i) => `u${i}`);
    expect(DEFAULT_MAX_PLAYERS).toBe(6);
    expect(isFull({ members: membros(5) })).toBe(false);
    expect(isFull({ members: membros(6) })).toBe(true);
  });

  it("campanha sem membros nunca está lotada", () => {
    expect(isFull({})).toBe(false);
    expect(isFull({ members: [] })).toBe(false);
    expect(isFull(null)).toBe(false);
  });
});
