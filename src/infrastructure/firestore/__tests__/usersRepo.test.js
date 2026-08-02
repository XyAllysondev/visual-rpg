import { getDoc, setDoc, updateDoc, onSnapshot, deleteField } from "firebase/firestore";
import * as usersRepo from "../usersRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

// O preset Jest do CRA usa `resetMocks: true` — implementações passadas na fábrica do
// jest.mock são apagadas antes de cada teste. Reinstalar aqui é obrigatório.
const snapshotOf = (data) => ({ exists: () => data != null, data: () => data });

beforeEach(() => {
  require("firebase/firestore").doc.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  deleteField.mockReturnValue("<deleteField>");
  setDoc.mockResolvedValue(undefined);
  updateDoc.mockResolvedValue(undefined);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("usersRepo.ensureDoc", () => {
  it("cria o doc com plano free quando o usuário é novo", async () => {
    getDoc.mockResolvedValue(snapshotOf(null));
    await usersRepo.ensureDoc("u1", "a@b.c");
    expect(setDoc).toHaveBeenCalledWith({ path: "users/u1" }, { email: "a@b.c", plan: "free" });
  });

  it("NÃO reescreve plan quando o doc já existe — só sincroniza e-mail mudado", async () => {
    getDoc.mockResolvedValue(snapshotOf({ email: "velho@b.c", plan: "pago" }));
    await usersRepo.ensureDoc("u1", "novo@b.c");
    // merge:true e payload só com email — é o que impede o login de resetar o plano pago
    // de quem já pagou (spec 0004 AC-1/AC-2).
    expect(setDoc).toHaveBeenCalledWith({ path: "users/u1" }, { email: "novo@b.c" }, { merge: true });
  });

  it("não escreve nada quando o e-mail não mudou", async () => {
    getDoc.mockResolvedValue(snapshotOf({ email: "a@b.c", plan: "free" }));
    await usersRepo.ensureDoc("u1", "a@b.c");
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("sem uid, não toca a rede", async () => {
    await usersRepo.ensureDoc(null, "a@b.c");
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("@policy silent — falha não rejeita, só loga com o prefixo do repo", async () => {
    getDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(usersRepo.ensureDoc("u1", "a@b.c")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[usersRepo.ensureDoc] falhou:", expect.any(Error)
    );
  });
});

describe("usersRepo — links de música", () => {
  it("lê os links, devolvendo {} quando o doc não existe", async () => {
    getDoc.mockResolvedValue(snapshotOf(null));
    await expect(usersRepo.getMusicLinks("u1")).resolves.toEqual({});
  });

  it("@policy silent — devolve {} em erro (fallback documentado)", async () => {
    getDoc.mockRejectedValue(new Error("offline"));
    await expect(usersRepo.getMusicLinks("u1")).resolves.toEqual({});
  });

  it("grava por merge para não apagar os outros serviços", async () => {
    await usersRepo.setMusicLink("u1", "spotify", { url: "x" });
    expect(setDoc).toHaveBeenCalledWith(
      { path: "users/u1" }, { musicLinks: { spotify: { url: "x" } } }, { merge: true }
    );
  });

  it("apaga o campo com deleteField — a FieldValue não vaza para a borda (AC-3)", async () => {
    await usersRepo.deleteMusicLink("u1", "spotify");
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "users/u1" }, { "musicLinks.spotify": "<deleteField>" }
    );
  });
});

describe("usersRepo.watchSubscribedSystems", () => {
  it("entrega SEMPRE um array — inclusive com o doc ausente", () => {
    const seen = [];
    onSnapshot.mockImplementation((_ref, next) => {
      next(snapshotOf(null));
      next(snapshotOf({}));
      next(snapshotOf({ subscribedSystems: ["ordemParanormal"] }));
      return () => {};
    });
    usersRepo.watchSubscribedSystems("u1", (s) => seen.push(s));
    expect(seen).toEqual([[], [], ["ordemParanormal"]]);
  });

  it("sem uid, devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = usersRepo.watchSubscribedSystems(null, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();  // idempotente
  });
});
