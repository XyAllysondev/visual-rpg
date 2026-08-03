/* ════════════════════════════════════════════════════════════════════
 *  fogRepo — CONTRATO DA PORTA DA NÉVOA  (spec 0030 · onda 1.5)
 *  --------------------------------------------------------------------
 *  O SDK é 100% mockado: o que está sob teste é ONDE grava, O QUE grava
 *  (byte a byte — o repo não transforma névoa), a política de erro e o
 *  retorno cedo quando falta id.
 *
 *  O preset Jest do CRA usa `resetMocks: true`: as implementações passadas
 *  na fábrica do `jest.mock` são apagadas antes de cada teste, então elas
 *  são reinstaladas no `beforeEach`.
 * ════════════════════════════════════════════════════════════════════ */
import { getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import * as fogRepo from "../fogRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

const CAMINHO = "users/mestre-1/worldmaps/m1/media/fog";
const snapshotOf = (data) => ({ exists: () => data != null, data: () => data });

beforeEach(() => {
  require("firebase/firestore").doc.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  serverTimestamp.mockReturnValue("<serverTimestamp>");
  setDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  getDoc.mockResolvedValue(snapshotOf(null));
});

/* ── 1 · CAMINHO ─────────────────────────────────────────────────────── */
describe("fogRepo — o caminho do documento", () => {
  it("todas as operações endereçam o MESMO doc singleton do ateliê", async () => {
    await fogRepo.get("mestre-1", "m1");
    await fogRepo.save("mestre-1", "m1", { data: "x" });
    await fogRepo.remove("mestre-1", "m1");
    onSnapshot.mockReturnValue(() => {});
    fogRepo.watch("mestre-1", "m1", () => {});

    expect(getDoc.mock.calls[0][0]).toEqual({ path: CAMINHO });
    expect(setDoc.mock.calls[0][0]).toEqual({ path: CAMINHO });
    expect(deleteDoc.mock.calls[0][0]).toEqual({ path: CAMINHO });
    expect(onSnapshot.mock.calls[0][0]).toEqual({ path: CAMINHO });
  });

  it("é doc PRÓPRIO sob `media/`, não o doc raiz do molde", async () => {
    await fogRepo.get("mestre-1", "m1");
    /* No raiz, a grade do Ateliê baixaria a névoa de todo mapa a cada snapshot. */
    expect(getDoc.mock.calls[0][0].path).not.toBe("users/mestre-1/worldmaps/m1");
  });
});

/* ── 2 · O REPO NÃO TRANSFORMA A NÉVOA (AC-3) ────────────────────────── */
describe("fogRepo.save", () => {
  const REGISTRO = { data: "R7f~aQ", largura: 2400, altura: 1600, escala: 4, bytes: 6 };

  it("grava EXATAMENTE o que o store passou, mais o carimbo de hora", async () => {
    await fogRepo.save("mestre-1", "m1", REGISTRO);
    /* A igualdade é estrita de propósito: se o repo começar a comprimir, medir ou
       normalizar a névoa, ele deixa de ser porta e vira segunda implementação de
       `model/fogMask.js`. Este teste é o que impede isso. */
    expect(setDoc).toHaveBeenCalledWith(
      { path: CAMINHO },
      { ...REGISTRO, updatedAt: "<serverTimestamp>" }
    );
  });

  it("não faz merge — a máscara se reescreve inteira", async () => {
    await fogRepo.save("mestre-1", "m1", REGISTRO);
    // Um merge deixaria para trás campos de uma névoa de outro tamanho.
    expect(setDoc.mock.calls[0]).toHaveLength(2);
  });

  it("`serverTimestamp` não atravessa a fronteira (AC-4): quem chama não o passa", async () => {
    await fogRepo.save("mestre-1", "m1", REGISTRO);
    expect(serverTimestamp).toHaveBeenCalled();
    expect(REGISTRO.updatedAt).toBeUndefined();
  });

  it("@policy strict — a falha de escrita rejeita, não é engolida", async () => {
    setDoc.mockRejectedValue(new Error("caiu a rede"));
    await expect(fogRepo.save("mestre-1", "m1", REGISTRO)).rejects.toThrow("caiu a rede");
  });
});

/* ── 3 · LEITURA ─────────────────────────────────────────────────────── */
describe("fogRepo.get", () => {
  it("devolve o registro plano, com `data` intacto", async () => {
    getDoc.mockResolvedValue(snapshotOf({ data: "R7f~aQ", largura: 2400, altura: 1600, escala: 4, bytes: 6 }));
    await expect(fogRepo.get("mestre-1", "m1")).resolves.toEqual({
      data: "R7f~aQ", largura: 2400, altura: 1600, escala: 4, bytes: 6,
    });
  });

  it("o `updatedAt` (Timestamp do SDK) NÃO atravessa a fronteira (AC-4)", async () => {
    getDoc.mockResolvedValue(snapshotOf({ data: "x", updatedAt: { seconds: 1, nanoseconds: 0 } }));
    const registro = await fogRepo.get("mestre-1", "m1");
    expect(registro).not.toHaveProperty("updatedAt");
  });

  it("não valida o payload — névoa corrompida sai como veio, para o store recusar", async () => {
    getDoc.mockResolvedValue(snapshotOf({ data: "lixo" }));
    // Quem sabe se um bitmap é válido é `model/fogMask.js`, não o repositório.
    await expect(fogRepo.get("mestre-1", "m1")).resolves.toMatchObject({ data: "lixo" });
  });

  it("documento inexistente é ausência de névoa (`null`), não erro", async () => {
    await expect(fogRepo.get("mestre-1", "m1")).resolves.toBeNull();
  });

  it("@policy strict — a falha de leitura rejeita", async () => {
    getDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(fogRepo.get("mestre-1", "m1")).rejects.toThrow("permission-denied");
  });
});

/* ── 4 · REMOÇÃO ─────────────────────────────────────────────────────── */
describe("fogRepo.remove", () => {
  it("apaga só a máscara — o doc do molde não é tocado", async () => {
    await fogRepo.remove("mestre-1", "m1");
    expect(deleteDoc).toHaveBeenCalledTimes(1);
    expect(deleteDoc.mock.calls[0][0].path).toContain("media/fog");
  });

  it("@policy strict — a falha rejeita", async () => {
    deleteDoc.mockRejectedValue(new Error("offline"));
    await expect(fogRepo.remove("mestre-1", "m1")).rejects.toThrow("offline");
  });
});

/* ── 5 · TEMPO REAL ──────────────────────────────────────────────────── */
describe("fogRepo.watch", () => {
  it("entrega o registro quando o doc existe e `null` quando não existe", () => {
    const vistos = [];
    onSnapshot.mockImplementation((_ref, aoDado) => {
      aoDado(snapshotOf({ data: "abc", bytes: 3 }));
      aoDado(snapshotOf(null));
      return () => {};
    });
    fogRepo.watch("mestre-1", "m1", (r) => vistos.push(r));
    expect(vistos).toEqual([{ data: "abc", largura: undefined, altura: undefined, escala: undefined, bytes: 3 }, null]);
  });

  it("@policy strict — o erro chega CRU a quem assina, sem log e sem fallback", () => {
    const falha = Object.assign(new Error("x"), { code: "permission-denied" });
    onSnapshot.mockImplementation((_ref, _aoDado, aoErro) => { aoErro(falha); return () => {}; });
    let recebido = null;
    fogRepo.watch("mestre-1", "m1", () => {}, (e) => { recebido = e; });
    /* Identidade, não igualdade: a tela lê `error.code` para distinguir
       "sem permissão" de "caiu a rede". */
    expect(recebido).toBe(falha);
  });

  it("sem `aoErro`, um erro do listener não derruba o app", () => {
    onSnapshot.mockImplementation((_ref, _aoDado, aoErro) => { aoErro(new Error("x")); return () => {}; });
    expect(() => fogRepo.watch("mestre-1", "m1", () => {})).not.toThrow();
  });

  it("devolve o unsubscribe do SDK", () => {
    const cancelar = jest.fn();
    onSnapshot.mockReturnValue(cancelar);
    fogRepo.watch("mestre-1", "m1", () => {})();
    expect(cancelar).toHaveBeenCalled();
  });
});

/* ── 6 · IDS FALSY ───────────────────────────────────────────────────── */
describe("fogRepo — id ausente não toca a rede", () => {
  it.each([
    ["", "m1"],
    ["mestre-1", ""],
    [null, null],
    [undefined, "m1"],
  ])("uid=%p mapId=%p: nenhuma operação chega ao SDK", async (uid, mapId) => {
    await expect(fogRepo.get(uid, mapId)).resolves.toBeNull();
    await fogRepo.save(uid, mapId, { data: "x" });
    await fogRepo.remove(uid, mapId);
    expect(getDoc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it("`watch` devolve um cancelamento inerte e IDEMPOTENTE — não assina nada", () => {
    /* Sem molde aberto não é erro: é o MAPA PADRÃO, que não existe no Firestore
       e ainda assim chama o hook sem condicional. */
    const unsub = fogRepo.watch("", "", () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow();
  });
});
