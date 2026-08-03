import { onSnapshot, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import * as assetsRepo from "../assetsRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

const fs = () => require("firebase/firestore");

/** Documento cru do Firestore: `id` fora, dados atrás de `data()`. */
const docOf = (id, data) => ({ id, ref: `ref/${id}`, data: () => data });

// O preset Jest do CRA usa `resetMocks: true`: o que a fábrica do jest.mock instala é
// apagado antes de cada teste. Tudo o que o repo precisa é reinstalado aqui.
beforeEach(() => {
  fs().doc.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  fs().collection.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  serverTimestamp.mockReturnValue("<serverTimestamp>");
  setDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("assetsRepo.watchAll", () => {
  it("assina a biblioteca do DONO, não uma coleção global", () => {
    // `users/{uid}/assets` é o que faz as rules autorizarem por dono sem `get()`. Uma
    // coleção global com campo `ownerId` exigiria consulta extra em toda leitura.
    onSnapshot.mockImplementation((_ref, next) => { next({ docs: [] }); return () => {}; });

    assetsRepo.watchAll("u1", () => {});

    expect(onSnapshot.mock.calls[0][0]).toEqual({ path: "users/u1/assets" });
  });

  it("entrega o id do DOCUMENTO por cima de um campo `id` divergente no corpo", () => {
    // Asset importado/copiado à mão pode ter um `id` velho no corpo; se ele vencesse, a
    // doca mandaria apagar/salvar um documento que não existe.
    let entregue;
    onSnapshot.mockImplementation((_ref, next) => {
      next({ docs: [docOf("as_novo", { id: "as_velho", name: "Goblin" })] });
      return () => {};
    });

    assetsRepo.watchAll("u1", (list) => { entregue = list; });

    expect(entregue).toEqual([{ id: "as_novo", name: "Goblin" }]);
  });

  it("falha na assinatura só loga com o prefixo do repo", () => {
    const erro = new Error("permission-denied");
    onSnapshot.mockImplementation((_ref, _next, onError) => { onError(erro); return () => {}; });

    expect(() => assetsRepo.watchAll("u1", () => {})).not.toThrow();
    expect(console.error).toHaveBeenCalledWith("[assetsRepo.watchAll] falhou:", erro);
  });

  it("sem uid, devolve um unsubscribe inerte e não assina nada", () => {
    // Acontece de verdade: a doca monta antes do `onAuthStateChanged` resolver.
    const unsub = assetsRepo.watchAll(null, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow(); // idempotente
  });
});

describe("assetsRepo.save", () => {
  it("grava em `users/{uid}/assets/{id}` com o horário do servidor", async () => {
    await assetsRepo.save("u1", { id: "as_1", type: "character", name: "Goblin", data: "data:img" });

    expect(setDoc).toHaveBeenCalledWith(
      { path: "users/u1/assets/as_1" },
      { id: "as_1", type: "character", name: "Goblin", data: "data:img", updatedAt: "<serverTimestamp>" }
    );
    // O relógio é do servidor: dois dispositivos do mesmo usuário com relógios diferentes
    // embaralhariam a ordem da biblioteca.
    expect(serverTimestamp).toHaveBeenCalled();
  });

  it("substitui o documento inteiro — sem merge", async () => {
    // Salvar de novo é "esta é a versão nova do asset". Com merge, uma tag removida pelo
    // usuário voltaria do documento antigo.
    await assetsRepo.save("u1", { id: "as_1", tags: [] });
    expect(setDoc.mock.calls[0]).toHaveLength(2); // sem o 3º argumento `{ merge: true }`
  });

  it("@policy silent — falha ao salvar não rejeita, só loga", async () => {
    // Comportamento herdado (AC-7): a doca de assets nunca caiu por um asset que não subiu.
    setDoc.mockRejectedValue(new Error("resource-exhausted"));

    await expect(assetsRepo.save("u1", { id: "as_1" })).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[assetsRepo.save] falhou:", expect.any(Error));
  });
});

describe("assetsRepo.remove", () => {
  it("apaga o asset do dono", async () => {
    await assetsRepo.remove("u1", "as_1");
    expect(deleteDoc).toHaveBeenCalledWith({ path: "users/u1/assets/as_1" });
  });

  it("@policy silent — falha ao apagar não rejeita, só loga", async () => {
    deleteDoc.mockRejectedValue(new Error("denied"));
    await expect(assetsRepo.remove("u1", "as_1")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("[assetsRepo.remove] falhou:", expect.any(Error));
  });
});
