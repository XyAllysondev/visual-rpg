import { addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import * as bestiaryRepo from "../bestiaryRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

// O preset Jest do CRA usa `resetMocks: true` — toda implementação some antes de cada
// teste. Reinstalar aqui é obrigatório, não é boilerplate opcional.
beforeEach(() => {
  const fs = require("firebase/firestore");
  fs.doc.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  fs.collection.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  query.mockImplementation((ref, ...rest) => ({ ref, rest }));
  orderBy.mockImplementation((field, dir) => `${field} ${dir}`);
  serverTimestamp.mockReturnValue("<serverTimestamp>");
  addDoc.mockResolvedValue({ id: "novo" });
  updateDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  onSnapshot.mockReturnValue(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("bestiaryRepo.watchByCampaign", () => {
  it("assina a subcoleção da campanha, da criatura mais nova para a mais velha", () => {
    bestiaryRepo.watchByCampaign("camp1", () => {});
    expect(onSnapshot.mock.calls[0][0]).toEqual({
      ref: { path: "campaigns/camp1/bestiary" },
      rest: ["createdAt desc"],
    });
  });

  it("entrega objetos planos {id, ...dados} — nenhum snapshot atravessa a fronteira (AC-3)", () => {
    onSnapshot.mockImplementation((_q, next) => {
      next({ docs: [{ id: "c1", data: () => ({ name: "Zumbi", hpMax: "18" }) }] });
      return () => {};
    });
    const seen = [];
    bestiaryRepo.watchByCampaign("camp1", (list) => seen.push(list));
    expect(seen).toEqual([[{ id: "c1", name: "Zumbi", hpMax: "18" }]]);
  });

  it("sem campaignId, devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = bestiaryRepo.watchByCampaign(null, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();  // idempotente
  });

  it("erro na assinatura loga com o prefixo do repo e não derruba a tela", () => {
    onSnapshot.mockImplementation((_q, _next, onError) => {
      onError(new Error("permission-denied"));
      return () => {};
    });
    expect(() => bestiaryRepo.watchByCampaign("camp1", () => {})).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(
      "[bestiaryRepo.watchByCampaign] falhou:", expect.any(Error)
    );
  });
});

describe("bestiaryRepo.create", () => {
  it("grava na subcoleção certa carimbando createdAt do servidor", async () => {
    await bestiaryRepo.create("camp1", { name: "Zumbi" });
    expect(addDoc).toHaveBeenCalledWith(
      { path: "campaigns/camp1/bestiary" },
      { name: "Zumbi", createdAt: "<serverTimestamp>" }
    );
  });

  it("devolve `true`, nunca o DocumentReference do addDoc (AC-3)", async () => {
    await expect(bestiaryRepo.create("camp1", { name: "Zumbi" })).resolves.toBe(true);
  });

  it("@policy silent — falha vira `false` + log, sem rejeitar (o legado tinha catch mudo)", async () => {
    addDoc.mockRejectedValue(new Error("quota"));
    await expect(bestiaryRepo.create("camp1", { name: "Zumbi" })).resolves.toBe(false);
    expect(console.error).toHaveBeenCalledWith("[bestiaryRepo.create] falhou:", expect.any(Error));
  });
});

describe("bestiaryRepo.update", () => {
  it("escreve no doc da criatura, sem recarimbar createdAt", async () => {
    await bestiaryRepo.update("camp1", "c1", { name: "Zumbi Alfa" });
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "campaigns/camp1/bestiary/c1" }, { name: "Zumbi Alfa" }
    );
    expect(serverTimestamp).not.toHaveBeenCalled();
  });

  it("@policy silent — falha vira `false`, para o formulário poder ficar aberto", async () => {
    updateDoc.mockRejectedValue(new Error("denied"));
    await expect(bestiaryRepo.update("camp1", "c1", { name: "x" })).resolves.toBe(false);
    expect(console.error).toHaveBeenCalledWith("[bestiaryRepo.update] falhou:", expect.any(Error));
  });
});

describe("bestiaryRepo.remove", () => {
  it("apaga o mesmo doc que `update` escreveria", async () => {
    await bestiaryRepo.remove("camp1", "c1");
    expect(deleteDoc).toHaveBeenCalledWith({ path: "campaigns/camp1/bestiary/c1" });
  });

  it("@policy silent — falha só loga (era `.catch(console.error)` no legado)", async () => {
    deleteDoc.mockRejectedValue(new Error("denied"));
    await expect(bestiaryRepo.remove("camp1", "c1")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[bestiaryRepo.remove] falhou:", expect.any(Error));
  });
});

describe("bestiaryRepo.setHp", () => {
  it("grava só o hpCurrent recebido — o repo não recalcula nada", async () => {
    await bestiaryRepo.setHp("camp1", "c1", 7);
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "campaigns/camp1/bestiary/c1" }, { hpCurrent: 7 }
    );
  });

  it("@policy silent — falha só loga; o snapshot seguinte reconcilia a tela", async () => {
    updateDoc.mockRejectedValue(new Error("offline"));
    await expect(bestiaryRepo.setHp("camp1", "c1", 7)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[bestiaryRepo.setHp] falhou:", expect.any(Error));
  });
});

/* ════════════════════════════════════════════════
 *  FRONTEIRA VALIDADA — spec 0032 AC-6
 * ════════════════════════════════════════════════ */

describe("bestiaryRepo — validação de fronteira (AC-6)", () => {
  const entrega = (docs) => {
    let visto;
    onSnapshot.mockImplementation((_q, next) => { next({ docs }); return () => {}; });
    bestiaryRepo.watchByCampaign("camp1", (l) => { visto = l; });
    return visto;
  };

  it("criatura ÍNTEGRA sai idêntica, sem log", () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    const crua = { name: "Zumbi", system: "Ordem Paranormal", hpMax: "18", hpCurrent: 0 };

    expect(entrega([{ id: "c1", data: () => ({ ...crua }) }])).toEqual([{ id: "c1", ...crua }]);
    expect(aviso).not.toHaveBeenCalled();
  });

  it("PV como STRING LIVRE do formulário atravessa INTOCADO — é dado válido, não erro", () => {
    /* `"18 (2d8+4)"` é o que o mestre digita, e existe assim nas fichas já cadastradas.
       Coagir para número aqui apagaria a nota de rolagem dele. A régua do PV é
       `domain/creature.js`, que já é total sobre string livre. */
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});

    const lista = entrega([{ id: "c1", data: () => ({ name: "Ghoul", hpMax: "18 (2d8+4)", hpCurrent: "" }) }]);

    expect(lista[0].hpMax).toBe("18 (2d8+4)");
    expect(lista[0].hpCurrent).toBe("");
    expect(aviso).not.toHaveBeenCalled();
  });

  it("`name` numérico vira texto — a busca do bestiário faz `.toLowerCase()` nele", () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});

    const lista = entrega([{ id: "c1", data: () => ({ name: 13, hpMax: "8" }) }]);

    expect(lista[0].name).toBe("13");
    expect(() => lista[0].name.toLowerCase()).not.toThrow();
    expect(aviso.mock.calls[0][0]).toContain('[bestiaryRepo.saida] "c1".name');
  });

  it("documento com corpo não-objeto é descartado do bestiário, com log", () => {
    const lista = entrega([
      { id: "boa", data: () => ({ name: "Zumbi" }) },
      { id: "fantasma", data: () => null },
    ]);

    expect(lista).toEqual([{ id: "boa", name: "Zumbi" }]);
    expect(console.error.mock.calls.map((c) => c[0]).join("\n")).toContain("fantasma");
  });
});
