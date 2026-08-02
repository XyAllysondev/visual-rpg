import { getDocs, setDoc, deleteDoc, query, where } from "firebase/firestore";
import * as charactersRepo from "../charactersRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

const fs = () => require("firebase/firestore");

beforeEach(() => {
  fs().doc.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  fs().collection.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  query.mockImplementation((ref, ...rest) => ({ ref, rest }));
  where.mockImplementation((f, op, v) => `${f}${op}${v}`);
  setDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
});

describe("charactersRepo.listBySystem", () => {
  it("filtra pelo sistema e devolve as fichas SEM o metadado de persistência", async () => {
    getDocs.mockResolvedValue({
      docs: [{ data: () => ({ id: "c1", systemId: "ordemParanormal", _updatedAt: 1754150400000 }) }],
    });

    const list = await charactersRepo.listBySystem("u1", "ordemParanormal");

    // `_updatedAt` não pode voltar: a ficha em memória é comparada com a do localStorage,
    // que nunca teve esse campo — se vazasse, toda ficha pareceria "diferente".
    expect(list).toEqual([{ id: "c1", systemId: "ordemParanormal" }]);
    expect(query).toHaveBeenCalledWith(
      { path: "users/u1/characters" }, "systemId==ordemParanormal"
    );
  });

  it("coleção vazia devolve [] — que NÃO é a mesma coisa que erro", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await expect(charactersRepo.listBySystem("u1", "ordemParanormal")).resolves.toEqual([]);
  });

  it("@policy strict — erro real REJEITA, para o hook distinguir de 'sem fichas'", async () => {
    getDocs.mockRejectedValue(new Error("unavailable"));
    await expect(charactersRepo.listBySystem("u1", "ordemParanormal")).rejects.toThrow("unavailable");
  });

  it("sem uid, não toca a rede", async () => {
    await expect(charactersRepo.listBySystem(null, "ordemParanormal")).resolves.toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});

describe("charactersRepo.save", () => {
  it("grava sob o `id` da ficha e carimba _updatedAt", async () => {
    await charactersRepo.save("u1", { id: "c1", nome: "Agente" });
    const [ref, payload] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: "users/u1/characters/c1" });
    expect(payload).toMatchObject({ id: "c1", nome: "Agente" });
    expect(typeof payload._updatedAt).toBe("number");
  });

  it("ficha legada sem `id` continua acessível pelo createdAt", async () => {
    // Regra de domínio (`characterKey`): fichas antigas nasceram identificadas pelo epoch-ms.
    await charactersRepo.save("u1", { createdAt: 1754150400000 });
    expect(setDoc.mock.calls[0][0]).toEqual({ path: "users/u1/characters/1754150400000" });
  });

  it("@policy strict — a falha sobe para quem chama", async () => {
    setDoc.mockRejectedValue(new Error("quota"));
    await expect(charactersRepo.save("u1", { id: "c1" })).rejects.toThrow("quota");
  });

  it("sem uid ou sem ficha, não escreve", async () => {
    await charactersRepo.save(null, { id: "c1" });
    await charactersRepo.save("u1", null);
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe("charactersRepo.remove", () => {
  it("apaga o mesmo doc que `save` gravaria", async () => {
    await charactersRepo.remove("u1", { id: "c1" });
    expect(deleteDoc).toHaveBeenCalledWith({ path: "users/u1/characters/c1" });
  });

  it("@policy strict", async () => {
    deleteDoc.mockRejectedValue(new Error("denied"));
    await expect(charactersRepo.remove("u1", { id: "c1" })).rejects.toThrow("denied");
  });
});
