import {
  addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import * as sharedSheetsRepo from "../sharedSheetsRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

const fs = () => require("firebase/firestore");

// O preset Jest do CRA usa `resetMocks: true` — toda implementação some antes de cada
// teste. Reinstalar aqui é obrigatório, não zelo.
beforeEach(() => {
  fs().doc.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  fs().collection.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  addDoc.mockResolvedValue({ id: "sheet-novo" });
  updateDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  serverTimestamp.mockReturnValue("<serverTimestamp>");
  jest.spyOn(console, "error").mockImplementation(() => {});
});

/** Doc de snapshot com uma `.ref` SENTINELA: se algo do SDK vazar, ela aparece no payload. */
const docSentinela = (id, data) => ({ id, data: () => data, ref: { __sdk: true, id } });

/** Um snapshot só chama o listener uma vez; guarda os callbacks por ordem de assinatura. */
const assinaturas = () => {
  const feitas = [];
  onSnapshot.mockImplementation((ref, next, onError) => {
    const unsub = jest.fn();
    feitas.push({ ref, next, onError, unsub });
    return unsub;
  });
  return feitas;
};

describe("sharedSheetsRepo.share", () => {
  it("grava o doc na coleção da campanha e devolve o ID gerado pelo Firestore", async () => {
    const character = { id: "c1", form: { personagem: "Agente Vermelho" } };

    const sheetId = await sharedSheetsRepo.share("camp1", {
      uid: "u1", userName: "Andre", character, isLive: true,
    });

    expect(sheetId).toBe("sheet-novo");
    const [col, payload] = addDoc.mock.calls[0];
    expect(col).toEqual({ path: "campaigns/camp1/sharedSheets" });
    expect(payload).toEqual({
      characterId: "c1",
      ownerId: "u1",
      ownerName: "Andre",
      characterName: "Agente Vermelho",
      characterData: character,
      isLive: true,
      sharedAt: "<serverTimestamp>",
      permissions: { canView: "members" },
    });
  });

  it("o characterId vem da regra de domínio: ficha legada sem `id` usa o createdAt", async () => {
    // Mesmo critério do `charactersRepo` — se divergisse, o live-sync não acharia a ficha.
    await sharedSheetsRepo.share("camp1", {
      uid: "u1", userName: "Andre", character: { createdAt: 1754150400000 }, isLive: false,
    });
    expect(addDoc.mock.calls[0][1].characterId).toBe("1754150400000");
  });

  it("ficha sem nome cai para 'Sem nome' em vez de gravar undefined", async () => {
    await sharedSheetsRepo.share("camp1", {
      uid: "u1", userName: "Andre", character: { id: "c1", form: { personagem: "" } }, isLive: true,
    });
    expect(addDoc.mock.calls[0][1].characterName).toBe("Sem nome");
  });

  it("@policy silent — falha devolve null (fallback do legado) e loga com o prefixo do repo", async () => {
    addDoc.mockRejectedValue(new Error("permission-denied"));

    await expect(sharedSheetsRepo.share("camp1", {
      uid: "u1", userName: "Andre", character: { id: "c1" }, isLive: true,
    })).resolves.toBeNull();

    expect(console.error).toHaveBeenCalledWith(
      "[sharedSheetsRepo.share] falhou:", expect.any(Error)
    );
  });
});

describe("sharedSheetsRepo.watchByCampaign", () => {
  it("entrega objetos planos {id, ...dados} — o snapshot não atravessa a fronteira", () => {
    const feitas = assinaturas();
    const vistos = [];

    sharedSheetsRepo.watchByCampaign("camp1", (s) => vistos.push(s));
    feitas[0].next({ docs: [docSentinela("s1", { ownerId: "u1", isLive: true })] });

    expect(feitas[0].ref).toEqual({ path: "campaigns/camp1/sharedSheets" });
    expect(vistos).toEqual([[{ id: "s1", ownerId: "u1", isLive: true }]]);
  });

  it("erro na assinatura loga e repassa ao onError de quem chama", () => {
    const feitas = assinaturas();
    const onError = jest.fn();
    sharedSheetsRepo.watchByCampaign("camp1", () => {}, onError);

    feitas[0].onError(new Error("permission-denied"));

    expect(console.error).toHaveBeenCalledWith(
      "[sharedSheetsRepo.watchByCampaign] falhou:", expect.any(Error)
    );
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("sem campaignId, devolve unsubscribe inerte e não assina nada", () => {
    const unsub = sharedSheetsRepo.watchByCampaign(null, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();
  });
});

describe("sharedSheetsRepo.updateCharacterData", () => {
  it("escreve pela COORDENADA em string, sem nenhum DocumentReference", async () => {
    const character = { id: "c1", form: { personagem: "Agente Vermelho" }, pv: 12 };

    await sharedSheetsRepo.updateCharacterData(
      { campaignId: "camp1", sheetId: "s1" }, character
    );

    expect(updateDoc).toHaveBeenCalledWith(
      { path: "campaigns/camp1/sharedSheets/s1" },
      { characterData: character, characterName: "Agente Vermelho" }
    );
  });

  it("sem nome na ficha usa 'Sem nome', ou o fallbackName quando quem chama passa um", async () => {
    await sharedSheetsRepo.updateCharacterData({ campaignId: "camp1", sheetId: "s1" }, {});
    expect(updateDoc.mock.calls[0][1].characterName).toBe("Sem nome");

    // O painel de edição prefere manter o nome que já estava no doc (legado App.jsx:2432).
    await sharedSheetsRepo.updateCharacterData(
      { campaignId: "camp1", sheetId: "s1" }, {}, { fallbackName: "Nome antigo" }
    );
    expect(updateDoc.mock.calls[1][1].characterName).toBe("Nome antigo");
  });

  it("@policy silent — falha não rejeita", async () => {
    updateDoc.mockRejectedValue(new Error("offline"));
    await expect(
      sharedSheetsRepo.updateCharacterData({ campaignId: "camp1", sheetId: "s1" }, {})
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[sharedSheetsRepo.updateCharacterData] falhou:", expect.any(Error)
    );
  });
});

describe("sharedSheetsRepo.remove", () => {
  it("apaga o doc da mesa", async () => {
    await sharedSheetsRepo.remove("camp1", "s1");
    expect(deleteDoc).toHaveBeenCalledWith({ path: "campaigns/camp1/sharedSheets/s1" });
  });

  it("@policy silent", async () => {
    deleteDoc.mockRejectedValue(new Error("denied"));
    await expect(sharedSheetsRepo.remove("camp1", "s1")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[sharedSheetsRepo.remove] falhou:", expect.any(Error)
    );
  });
});

describe("sharedSheetsRepo.applyElement", () => {
  it("grava os campos aninhados com notação de ponto — nunca o characterData inteiro", async () => {
    await sharedSheetsRepo.applyElement("camp1", "s1", { elemento: "medo", uid: "mestre1" });

    const [ref, payload] = updateDoc.mock.calls[0];
    expect(ref).toEqual({ path: "campaigns/camp1/sharedSheets/s1" });
    expect(payload).toMatchObject({
      "characterData.elementoAfinidade": "medo",
      "characterData.elementoGmOverride": true,
      "characterData.elementoConcedidoPor": "mestre1",
    });
    // Epoch-ms local, como no legado — não é `serverTimestamp`, e a UI lê como número.
    expect(typeof payload["characterData.elementoEscolhidoEm"]).toBe("number");
    expect(serverTimestamp).not.toHaveBeenCalled();
  });

  it("elemento diferente de 'medo' não é imposição do mestre e não registra quem concedeu", async () => {
    await sharedSheetsRepo.applyElement("camp1", "s1", { elemento: "sangue", uid: "mestre1" });
    expect(updateDoc.mock.calls[0][1]).toMatchObject({
      "characterData.elementoAfinidade": "sangue",
      "characterData.elementoGmOverride": false,
      "characterData.elementoConcedidoPor": null,
    });
  });

  it("@policy silent", async () => {
    updateDoc.mockRejectedValue(new Error("denied"));
    await expect(
      sharedSheetsRepo.applyElement("camp1", "s1", { elemento: "medo", uid: "m1" })
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[sharedSheetsRepo.applyElement] falhou:", expect.any(Error)
    );
  });
});

describe("sharedSheetsRepo.watchLiveRefsByCharacter", () => {
  it("AC-3 — o payload é só coordenada em string; NENHUM objeto do SDK atravessa", () => {
    const feitas = assinaturas();
    let mapa = null;

    sharedSheetsRepo.watchLiveRefsByCharacter(["camp1"], "u1", (m) => { mapa = m; });
    feitas[0].next({
      docs: [docSentinela("s1", { ownerId: "u1", characterId: "c1", isLive: true })],
    });

    // Asserção sobre a FORMA do que foi entregue — não sobre o mock.
    expect(mapa).toEqual({ c1: [{ campaignId: "camp1", sheetId: "s1" }] });
    const valores = Object.values(mapa).flat();
    valores.forEach((coord) => {
      expect(Object.keys(coord).sort()).toEqual(["campaignId", "sheetId"]);
      expect(typeof coord.campaignId).toBe("string");
      expect(typeof coord.sheetId).toBe("string");
    });
    // A sentinela `__sdk` da `d.ref` não pode existir em lugar nenhum do payload.
    expect(JSON.stringify(mapa)).not.toContain("__sdk");
  });

  it("filtra por ownerId === uid && isLive", () => {
    const feitas = assinaturas();
    let mapa = null;

    sharedSheetsRepo.watchLiveRefsByCharacter(["camp1"], "u1", (m) => { mapa = m; });
    feitas[0].next({
      docs: [
        docSentinela("s1", { ownerId: "u1", characterId: "c1", isLive: true }),
        docSentinela("s2", { ownerId: "u1", characterId: "c2", isLive: false }), // não ao vivo
        docSentinela("s3", { ownerId: "outro", characterId: "c3", isLive: true }), // de outro dono
      ],
    });

    expect(mapa).toEqual({ c1: [{ campaignId: "camp1", sheetId: "s1" }] });
  });

  it("acumula a MESMA ficha viva em campanhas diferentes", () => {
    const feitas = assinaturas();
    let mapa = null;

    sharedSheetsRepo.watchLiveRefsByCharacter(["camp1", "camp2"], "u1", (m) => { mapa = m; });
    feitas[0].next({ docs: [docSentinela("s1", { ownerId: "u1", characterId: "c1", isLive: true })] });
    feitas[1].next({ docs: [docSentinela("s9", { ownerId: "u1", characterId: "c1", isLive: true })] });

    // Uma edição da ficha `c1` precisa chegar às duas mesas.
    expect(mapa).toEqual({
      c1: [
        { campaignId: "camp1", sheetId: "s1" },
        { campaignId: "camp2", sheetId: "s9" },
      ],
    });
  });

  it("desligar o 'ao vivo' tira a coordenada e some com o characterId sem nenhuma sobrando", () => {
    const feitas = assinaturas();
    let mapa = null;

    sharedSheetsRepo.watchLiveRefsByCharacter(["camp1"], "u1", (m) => { mapa = m; });
    feitas[0].next({ docs: [docSentinela("s1", { ownerId: "u1", characterId: "c1", isLive: true })] });
    expect(mapa).toEqual({ c1: [{ campaignId: "camp1", sheetId: "s1" }] });

    feitas[0].next({ docs: [docSentinela("s1", { ownerId: "u1", characterId: "c1", isLive: false })] });
    expect(mapa).toEqual({});
  });

  it("não duplica a coordenada quando o mesmo doc chega em snapshots seguidos", () => {
    const feitas = assinaturas();
    let mapa = null;

    sharedSheetsRepo.watchLiveRefsByCharacter(["camp1"], "u1", (m) => { mapa = m; });
    const doc = docSentinela("s1", { ownerId: "u1", characterId: "c1", isLive: true });
    feitas[0].next({ docs: [doc] });
    feitas[0].next({ docs: [doc] });

    expect(mapa.c1).toHaveLength(1);
  });

  it("o unsubscribe agregado cancela TODAS as assinaturas e é idempotente", () => {
    const feitas = assinaturas();

    const unsub = sharedSheetsRepo.watchLiveRefsByCharacter(
      ["camp1", "camp2", "camp3"], "u1", () => {}
    );
    expect(feitas).toHaveLength(3);

    unsub();
    feitas.forEach((a) => expect(a.unsub).toHaveBeenCalledTimes(1));

    unsub(); // segunda chamada não pode cancelar de novo
    feitas.forEach((a) => expect(a.unsub).toHaveBeenCalledTimes(1));
  });

  it("sem uid ou sem campanhas, devolve unsubscribe inerte e não assina nada", () => {
    assinaturas();

    const semUid = sharedSheetsRepo.watchLiveRefsByCharacter(["camp1"], null, () => {});
    const semCamps = sharedSheetsRepo.watchLiveRefsByCharacter([], "u1", () => {});
    const semNada = sharedSheetsRepo.watchLiveRefsByCharacter(undefined, "u1", () => {});

    expect(onSnapshot).not.toHaveBeenCalled();
    [semUid, semCamps, semNada].forEach((u) => expect(() => { u(); u(); }).not.toThrow());
  });

  it("erro na assinatura de uma campanha loga e não derruba as outras", () => {
    const feitas = assinaturas();
    let mapa = null;

    sharedSheetsRepo.watchLiveRefsByCharacter(["camp1", "camp2"], "u1", (m) => { mapa = m; });
    feitas[0].onError(new Error("permission-denied"));
    feitas[1].next({ docs: [docSentinela("s9", { ownerId: "u1", characterId: "c1", isLive: true })] });

    expect(console.error).toHaveBeenCalledWith(
      "[sharedSheetsRepo.watchLiveRefsByCharacter] falhou:", expect.any(Error)
    );
    expect(mapa).toEqual({ c1: [{ campaignId: "camp2", sheetId: "s9" }] });
  });

  it("entrega uma CÓPIA do mapa — mexer no que a UI recebeu não corrompe o estado interno", () => {
    const feitas = assinaturas();
    const entregues = [];

    sharedSheetsRepo.watchLiveRefsByCharacter(["camp1"], "u1", (m) => entregues.push(m));
    feitas[0].next({ docs: [docSentinela("s1", { ownerId: "u1", characterId: "c1", isLive: true })] });

    delete entregues[0].c1; // consumidor desatento
    feitas[0].next({ docs: [docSentinela("s1", { ownerId: "u1", characterId: "c1", isLive: true })] });

    expect(entregues[1]).toEqual({ c1: [{ campaignId: "camp1", sheetId: "s1" }] });
  });
});

/* ════════════════════════════════════════════════
 *  FRONTEIRA VALIDADA — spec 0032 AC-6
 * ════════════════════════════════════════════════ */

describe("sharedSheetsRepo — validação de fronteira (AC-6)", () => {
  const entrega = (docs) => {
    const feitas = assinaturas();
    let visto;
    sharedSheetsRepo.watchByCampaign("camp1", (l) => { visto = l; });
    feitas[0].next({ docs });
    return visto;
  };

  it("ficha da mesa ÍNTEGRA sai idêntica, sem log", () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    const crua = {
      characterId: "c1", ownerId: "u1", ownerName: "Ana", characterName: "Agente Vermelho",
      characterData: { form: { personagem: "Agente Vermelho" } }, isLive: true,
    };

    expect(entrega([docSentinela("s1", crua)])).toEqual([{ id: "s1", ...crua }]);
    expect(aviso).not.toHaveBeenCalled();
  });

  it("`characterData` de tipo errado não chega à borda — a mesa a indexa sem guarda", () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});

    const lista = entrega([docSentinela("s1", { characterId: "c1", characterData: "Agente Vermelho" })]);

    expect(lista[0].characterData).toEqual({});
    expect(() => lista[0].characterData.form).not.toThrow();
    expect(aviso.mock.calls[0][0]).toContain('[sharedSheetsRepo.saida] "s1".characterData');
  });

  it("`characterId` numérico vira texto — ele é comparado com `characterKey`, que é String()", () => {
    /* Quando o `characterId` não casa com a chave da ficha do dono, o "ao vivo" simplesmente
       para de sincronizar, SEM erro nenhum na tela. É o pior tipo de falha deste agregado. */
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const lista = entrega([docSentinela("s1", { characterId: 1700000000000, characterData: {} })]);
    expect(lista[0].characterId).toBe("1700000000000");
  });

  it("ficha compartilhada LEGADA, sem `isLive` nem `permissions`, atravessa intocada", () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    const legada = { characterId: "c1", ownerId: "u1", characterData: { form: {} } };

    expect(entrega([docSentinela("s1", legada)])).toEqual([{ id: "s1", ...legada }]);
    expect(aviso).not.toHaveBeenCalled();
  });

  it("documento com corpo não-objeto é descartado da mesa, com log de erro", () => {
    const lista = entrega([
      docSentinela("boa", { characterId: "c1", characterData: {} }),
      docSentinela("fantasma", undefined),
    ]);

    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe("boa");
    expect(console.error.mock.calls.map((c) => c[0]).join("\n")).toContain("fantasma");
  });
});
