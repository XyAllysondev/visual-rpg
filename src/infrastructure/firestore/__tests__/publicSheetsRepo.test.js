import { getDoc, setDoc, deleteDoc, getDocs } from "firebase/firestore";
import * as publicSheetsRepo from "../publicSheetsRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

const fs = () => require("firebase/firestore");

/** Instante congelado: sem isso, `_updatedAt` e o ID da proposta seriam inasseveráveis. */
const AGORA = 1754150400000;

const snapshotOf = (data) => ({ exists: () => data != null, data: () => data });

/** Doc de snapshot com `.ref` SENTINELA: se algo do SDK vazar, aparece no payload (AC-3). */
const docSentinela = (data) => ({ data: () => data, ref: { __sdk: true } });

// O preset Jest do CRA usa `resetMocks: true` — toda implementação some antes de cada
// teste, inclusive a dos spies. Reinstalar aqui é obrigatório, não zelo.
beforeEach(() => {
  fs().doc.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  fs().collection.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  getDoc.mockResolvedValue(snapshotOf(null));
  getDocs.mockResolvedValue({ docs: [] });
  setDoc.mockResolvedValue(undefined);
  deleteDoc.mockResolvedValue(undefined);
  jest.spyOn(Date, "now").mockReturnValue(AGORA);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

// `Date.now` é global: sem restaurar, os spies vazariam para outras suítes do mesmo worker.
afterAll(jest.restoreAllMocks);

describe("publicSheetsRepo.get", () => {
  it("lê a ficha em publicSheets/{charId} e devolve os dados planos", async () => {
    getDoc.mockResolvedValue(snapshotOf({ nome: "Agente Vermelho", public: true }));

    await expect(publicSheetsRepo.get("c1")).resolves.toEqual({
      nome: "Agente Vermelho",
      public: true,
    });
    expect(getDoc).toHaveBeenCalledWith({ path: "publicSheets/c1" });
  });

  it("devolve null tanto quando a ficha não existe quanto quando a leitura falha", async () => {
    // Os dois casos são indistinguíveis DE PROPÓSITO (JSDoc do repo): a tela pública mostra
    // "ficha não encontrada" nos dois, então diferenciar aqui não mudaria nada para o usuário.
    // O que separa um do outro é só o log — a falha fica rastreável, o "não existe" não polui.
    getDoc.mockResolvedValue(snapshotOf(null));
    await expect(publicSheetsRepo.get("c1")).resolves.toBeNull();
    expect(console.error).not.toHaveBeenCalled();

    getDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(publicSheetsRepo.get("c1")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "[publicSheetsRepo.get] falhou:", expect.any(Error)
    );
  });

  it("sem charId, não toca a rede", async () => {
    await expect(publicSheetsRepo.get(null)).resolves.toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("ID legado numérico vira string no caminho — o link antigo continua abrindo", async () => {
    // Fichas criadas antes do `id` em string usam o `createdAt` epoch-ms como identificador;
    // se o número chegasse cru ao `doc()`, o SDK recusaria o segmento e o link quebraria.
    await publicSheetsRepo.get(AGORA);
    expect(getDoc).toHaveBeenCalledWith({ path: "publicSheets/1754150400000" });
  });
});

describe("publicSheetsRepo.save", () => {
  it("publica marcando public:true e carimbando _updatedAt como número", async () => {
    await publicSheetsRepo.save("c1", { nome: "Agente Vermelho" }, "u1");

    const [ref, payload] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: "publicSheets/c1" });
    expect(payload).toEqual({
      nome: "Agente Vermelho",
      public: true,
      _updatedAt: AGORA,
      ownerUid: "u1",
    });
    // Epoch-ms, NÃO `Timestamp` do SDK: quem lê a ficha pública não está autenticado e
    // compara datas sem o Firebase carregado.
    expect(typeof payload._updatedAt).toBe("number");
  });

  it("omite ownerUid quando ele é falsy, em vez de gravar undefined", async () => {
    // Gravar `ownerUid: undefined` faz o Firestore RECUSAR a escrita inteira — a ficha
    // legada (publicada antes do campo existir) deixaria de ser republicável.
    await publicSheetsRepo.save("c1", { nome: "Sem dono" }, undefined);

    const payload = setDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty("ownerUid");
    expect(Object.keys(payload)).toEqual(["nome", "public", "_updatedAt"]);
  });

  it("sem charId, não escreve nada", async () => {
    await publicSheetsRepo.save(null, { nome: "x" }, "u1");
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("@policy silent — falhar ao publicar não derruba a ficha do usuário", async () => {
    // A ficha continua salva localmente e no charactersRepo; publicar é acessório (AC-7).
    setDoc.mockRejectedValue(new Error("quota-exceeded"));
    await expect(publicSheetsRepo.save("c1", { nome: "x" }, "u1")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[publicSheetsRepo.save] falhou:", expect.any(Error)
    );
  });
});

describe("publicSheetsRepo.remove", () => {
  it("despublica apagando o mesmo doc que `save` escreveria", async () => {
    await publicSheetsRepo.remove("c1");
    expect(deleteDoc).toHaveBeenCalledWith({ path: "publicSheets/c1" });
  });

  it("sem charId, não escreve nada", async () => {
    await publicSheetsRepo.remove(undefined);
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it("@policy silent — falha só loga com o prefixo do repo", async () => {
    deleteDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(publicSheetsRepo.remove("c1")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[publicSheetsRepo.remove] falhou:", expect.any(Error)
    );
  });
});

describe("publicSheetsRepo.savePendingEdit", () => {
  it("usa o instante da proposta como ID do documento, com status pendente", async () => {
    await publicSheetsRepo.savePendingEdit("c1", { pv: 12 }, "Visitante");

    const [ref, payload] = setDoc.mock.calls[0];
    // O ID SER o timestamp é o que dá ordenação natural sem contador e evita colisão.
    expect(ref).toEqual({ path: "publicSheets/c1/pendingEdits/1754150400000" });
    expect(payload).toEqual({
      id: "1754150400000",
      proposedData: { pv: 12 },
      editorName: "Visitante",
      timestamp: AGORA,
      status: "pending",
    });
  });

  it("o `id` gravado e o campo `timestamp` são SEMPRE o mesmo instante", async () => {
    // Invariante prometida pelo JSDoc. O legado lia o relógio duas vezes; na virada de
    // milissegundo entre as leituras o ID divergia do `timestamp`, e a ordem por ID deixava
    // de bater com a ordem por data. Um relógio que ANDA a cada leitura expõe isso: se o
    // repo chamar `Date.now()` mais de uma vez, os dois campos discordam e o teste cai.
    Date.now.mockReturnValueOnce(AGORA).mockReturnValueOnce(AGORA + 1);

    await publicSheetsRepo.savePendingEdit("c1", { pv: 12 }, "Visitante");

    const [ref, payload] = setDoc.mock.calls[0];
    expect(payload.id).toBe(String(payload.timestamp));
    expect(ref.path.endsWith(`/${payload.id}`)).toBe(true);
    expect(Date.now).toHaveBeenCalledTimes(1);
  });

  it("editor sem nome vira 'Anônimo' — o dono precisa ver algo na lista de propostas", async () => {
    await publicSheetsRepo.savePendingEdit("c1", { pv: 12 }, "");
    expect(setDoc.mock.calls[0][1].editorName).toBe("Anônimo");

    await publicSheetsRepo.savePendingEdit("c1", { pv: 12 }, undefined);
    expect(setDoc.mock.calls[1][1].editorName).toBe("Anônimo");
  });

  it("sem charId, não escreve nada", async () => {
    await publicSheetsRepo.savePendingEdit(null, { pv: 12 }, "Visitante");
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("@policy silent — a proposta se perde calada, sem quebrar a tela pública", async () => {
    setDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(
      publicSheetsRepo.savePendingEdit("c1", { pv: 12 }, "Visitante")
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[publicSheetsRepo.savePendingEdit] falhou:", expect.any(Error)
    );
  });
});

describe("publicSheetsRepo.listPendingEdits", () => {
  it("lê a subcoleção da ficha, descarta o que já foi resolvido e põe a mais nova primeiro", async () => {
    // Decrescente porque o dono revisa de cima para baixo: aprovar uma proposta velha por
    // cima de uma nova reverteria trabalho já feito.
    getDocs.mockResolvedValue({
      docs: [
        docSentinela({ id: "2", timestamp: 200, status: "pending" }),
        docSentinela({ id: "1", timestamp: 100, status: "approved" }),
        docSentinela({ id: "3", timestamp: 300, status: "pending" }),
        docSentinela({ id: "4", timestamp: 400, status: "rejected" }),
      ],
    });

    const lista = await publicSheetsRepo.listPendingEdits("c1");

    expect(getDocs).toHaveBeenCalledWith({ path: "publicSheets/c1/pendingEdits" });
    expect(lista.map((e) => e.id)).toEqual(["3", "2"]);
    // Nenhum objeto do SDK atravessa a fronteira (AC-3).
    expect(JSON.stringify(lista)).not.toContain("__sdk");
  });

  it("devolve [] quando não há nada pendente — nunca null", async () => {
    getDocs.mockResolvedValue({
      docs: [docSentinela({ id: "1", timestamp: 100, status: "approved" })],
    });
    await expect(publicSheetsRepo.listPendingEdits("c1")).resolves.toEqual([]);
  });

  it("@policy silent — falha devolve [] (fallback documentado), não rejeita", async () => {
    // Quem chama faz `.map` direto na lista; um null aqui viraria crash na renderização.
    getDocs.mockRejectedValue(new Error("permission-denied"));
    await expect(publicSheetsRepo.listPendingEdits("c1")).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "[publicSheetsRepo.listPendingEdits] falhou:", expect.any(Error)
    );
  });

  it("sem charId, devolve [] sem tocar a rede", async () => {
    await expect(publicSheetsRepo.listPendingEdits(null)).resolves.toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});

describe("publicSheetsRepo.resolvePendingEdit", () => {
  it("grava só o status, por merge, preservando o proposedData da proposta", async () => {
    // Sem `merge:true` o setDoc apagaria `proposedData` e o histórico da proposta resolvida
    // ficaria ilegível — o dono não conseguiria mais auditar o que aprovou.
    await publicSheetsRepo.resolvePendingEdit("c1", "e1", "approved");

    expect(setDoc).toHaveBeenCalledWith(
      { path: "publicSheets/c1/pendingEdits/e1" },
      { status: "approved" },
      { merge: true }
    );
  });

  it("editId numérico é normalizado para string no caminho", async () => {
    // O `editId` É o timestamp da proposta: quem chama tem o número em mãos.
    await publicSheetsRepo.resolvePendingEdit("c1", AGORA, "rejected");
    expect(setDoc.mock.calls[0][0]).toEqual({
      path: "publicSheets/c1/pendingEdits/1754150400000",
    });
  });

  it("sem editId (ou sem charId), não escreve nada", async () => {
    await publicSheetsRepo.resolvePendingEdit("c1", null, "approved");
    await publicSheetsRepo.resolvePendingEdit(null, "e1", "approved");
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("@policy silent — falha não rejeita; o próximo carregamento da lista reconcilia", async () => {
    setDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(
      publicSheetsRepo.resolvePendingEdit("c1", "e1", "approved")
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[publicSheetsRepo.resolvePendingEdit] falhou:", expect.any(Error)
    );
  });
});
