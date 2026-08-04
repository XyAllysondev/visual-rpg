import {
  getDocs, addDoc, updateDoc, onSnapshot,
  query, where, serverTimestamp, arrayUnion, arrayRemove,
} from "firebase/firestore";
import * as campaignsRepo from "../campaignsRepo";

jest.mock("firebase/firestore");
jest.mock("../../../firebase", () => ({ db: {}, auth: {} }));

const fs = () => require("firebase/firestore");

/** Documento cru do Firestore, como o SDK entrega — `id` fora, dados atrás de `data()`. */
const docOf = (id, data) => ({ id, data: () => data });

// O preset Jest do CRA usa `resetMocks: true`: o que a fábrica do jest.mock instala é
// apagado antes de cada teste. Tudo o que o repo precisa é reinstalado aqui.
beforeEach(() => {
  fs().doc.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  fs().collection.mockImplementation((_db, ...seg) => ({ path: seg.join("/") }));
  query.mockImplementation((ref, ...rest) => ({ ref, rest }));
  where.mockImplementation((f, op, v) => `${f} ${op} ${v}`);
  serverTimestamp.mockReturnValue("<serverTimestamp>");
  arrayUnion.mockImplementation((v) => ({ arrayUnion: v }));
  arrayRemove.mockImplementation((v) => ({ arrayRemove: v }));
  addDoc.mockResolvedValue({ id: "camp-nova" });
  updateDoc.mockResolvedValue(undefined);
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("campaignsRepo.watchByMember", () => {
  it("entrega as campanhas em que o usuário é membro, com o id do documento junto", () => {
    let entregue;
    onSnapshot.mockImplementation((_q, next) => {
      next({ docs: [docOf("c1", { name: "A Ordem" })] });
      return () => {};
    });

    campaignsRepo.watchByMember("u1", (list) => { entregue = list; });

    // O `id` não está em `data()`: sem juntá-lo aqui, a UI não teria como abrir a campanha.
    expect(entregue).toEqual([{ id: "c1", name: "A Ordem" }]);
    expect(query).toHaveBeenCalledWith({ path: "campaigns" }, "members array-contains u1");
  });

  it("avisa quem chamou quando a assinatura falha", () => {
    const erro = new Error("permission-denied");
    onSnapshot.mockImplementation((_q, _next, onSnapError) => { onSnapError(erro); return () => {}; });
    const onError = jest.fn();

    campaignsRepo.watchByMember("u1", () => {}, onError);

    // Este callback é o gancho do backoff de 5 s do `useCampaign`: se o repo engolisse o
    // erro, a lista ficaria vazia para sempre depois de uma negativa das rules.
    expect(onError).toHaveBeenCalledWith(erro);
  });

  it("não quebra quando quem chamou não passou onError", () => {
    onSnapshot.mockImplementation((_q, _next, onSnapError) => {
      onSnapError(new Error("offline"));
      return () => {};
    });
    expect(() => campaignsRepo.watchByMember("u1", () => {})).not.toThrow();
  });

  it("sem uid, devolve um unsubscribe inerte e não assina nada", () => {
    const unsub = campaignsRepo.watchByMember(null, () => {});
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(() => { unsub(); unsub(); }).not.toThrow(); // idempotente
  });
});

describe("campaignsRepo.listByMember", () => {
  it("lê a coleção raiz `campaigns` filtrando por membro", async () => {
    getDocs.mockResolvedValue({ docs: [docOf("c1", { name: "A Ordem" })] });

    await expect(campaignsRepo.listByMember("u1")).resolves.toEqual([{ id: "c1", name: "A Ordem" }]);
    expect(query).toHaveBeenCalledWith({ path: "campaigns" }, "members array-contains u1");
  });

  it("sem uid, devolve [] sem tocar a rede", async () => {
    await expect(campaignsRepo.listByMember(null)).resolves.toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("@policy strict — erro REJEITA em vez de virar lista vazia", async () => {
    // Devolver [] aqui faria o jogador ver "nenhuma campanha" e criar outra do zero.
    getDocs.mockRejectedValue(new Error("unavailable"));
    await expect(campaignsRepo.listByMember("u1")).rejects.toThrow("unavailable");
  });
});

describe("campaignsRepo.countActiveByMasterAndSystem", () => {
  /* VIRADA DE COMPORTAMENTO — spec 0032 (Q1).
     Até a spec 0031 esta função mandava `isActive == true` NA QUERY, e este teste travava
     isso. O efeito era uma assimetria absurda com a função irmã: campanha antiga sem o campo
     sumia daqui e contava lá, então o MESMO mestre furava o teto ao CRIAR e era barrado ao
     ENTRAR por convite. Agora as duas filtram em memória, com a mesma regra de domínio. */
  it("conta campanha ANTIGA sem `isActive` — o filtro saiu da query (Q1)", async () => {
    getDocs.mockResolvedValue({
      docs: [
        docOf("legada", { masterId: "u1", system: "ordemParanormal" }),                     // sem isActive
        docOf("nova", { masterId: "u1", system: "ordemParanormal", isActive: true }),
        docOf("arquivada", { masterId: "u1", system: "ordemParanormal", isActive: false }), // não conta
      ],
    });

    await expect(campaignsRepo.countActiveByMasterAndSystem("u1", "ordemParanormal")).resolves.toBe(2);
  });

  it("a query NÃO filtra isActive — senão a campanha legada sumiria de novo", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await campaignsRepo.countActiveByMasterAndSystem("u1", "ordemParanormal");

    expect(query).toHaveBeenCalledWith(
      { path: "campaigns" },
      "masterId == u1",
      "system == ordemParanormal"
    );
    // Asserção negativa de propósito: quebra se alguém "otimizar" o filtro de volta para dentro
    // da query, que é exatamente o bug que o Q1 consertou.
    expect(where).not.toHaveBeenCalledWith("isActive", "==", true);
  });

  it("sem uid, devolve 0 sem tocar a rede", async () => {
    await expect(campaignsRepo.countActiveByMasterAndSystem(null, "ordemParanormal")).resolves.toBe(0);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("@policy strict — erro REJEITA; contar 0 liberaria criar acima do teto", async () => {
    getDocs.mockRejectedValue(new Error("unavailable"));
    await expect(campaignsRepo.countActiveByMasterAndSystem("u1", "x")).rejects.toThrow("unavailable");
  });
});

describe("campaignsRepo.countActiveByMemberAndSystem", () => {
  it("conta campanha ANTIGA sem o campo `isActive` — por isso o filtro é em memória", async () => {
    // Este é o teste que protege a decisão: se `isActive` fosse para a query, o Firestore
    // não devolveria o documento que não tem o campo, e a campanha antiga sumiria da
    // contagem — o jogador furaria o teto de 3 por sistema sem perceber.
    getDocs.mockResolvedValue({
      docs: [
        docOf("legada", { system: "ordemParanormal" }),                    // sem isActive
        docOf("nova", { system: "ordemParanormal", isActive: true }),
        docOf("arquivada", { system: "ordemParanormal", isActive: false }), // não conta
        docOf("outra", { system: "dnd", isActive: true }),                  // outro sistema
      ],
    });

    await expect(
      campaignsRepo.countActiveByMemberAndSystem("u1", "ordemParanormal")
    ).resolves.toBe(2);

    // A query NÃO pode carregar o filtro de isActive — só o de membro.
    expect(query).toHaveBeenCalledWith({ path: "campaigns" }, "members array-contains u1");
    expect(where).not.toHaveBeenCalledWith("isActive", "==", true);
  });

  it("campanha sem `system` conta no balde 'Genérico'", async () => {
    // Mesmo fallback de `systemOf` usado na criação — se divergisse, a campanha contaria
    // num balde e apareceria em outro.
    getDocs.mockResolvedValue({ docs: [docOf("c1", {})] });
    await expect(campaignsRepo.countActiveByMemberAndSystem("u1", "Genérico")).resolves.toBe(1);
  });

  it("sem uid, devolve 0 sem tocar a rede", async () => {
    await expect(campaignsRepo.countActiveByMemberAndSystem(null, "x")).resolves.toBe(0);
    expect(getDocs).not.toHaveBeenCalled();
  });
});

describe("campaignsRepo.create", () => {
  it("grava na coleção raiz, carimba createdAt e devolve o id novo", async () => {
    const id = await campaignsRepo.create({ name: "A Ordem", masterId: "u1" });

    expect(id).toBe("camp-nova");
    expect(addDoc).toHaveBeenCalledWith(
      { path: "campaigns" },
      { name: "A Ordem", masterId: "u1", createdAt: "<serverTimestamp>" }
    );
    // `serverTimestamp()` é FieldValue do SDK: só pode nascer dentro da infraestrutura,
    // senão o hook precisaria importar `firebase/firestore` (AC-1/AC-3).
    expect(serverTimestamp).toHaveBeenCalled();
  });

  it("devolve o ID em string — DocumentReference não atravessa a fronteira (AC-3)", async () => {
    const id = await campaignsRepo.create({ name: "X" });
    expect(typeof id).toBe("string");
  });

  it("@policy strict — falha ao criar REJEITA", async () => {
    addDoc.mockRejectedValue(new Error("quota"));
    await expect(campaignsRepo.create({ name: "X" })).rejects.toThrow("quota");
  });
});

describe("campaignsRepo.findActiveByInviteCode", () => {
  it("acha o código digitado em minúsculas", async () => {
    getDocs.mockResolvedValue({ docs: [docOf("c1", { inviteCode: "ABC234", isActive: true })] });

    await expect(campaignsRepo.findActiveByInviteCode("abc234")).resolves.toEqual({
      id: "c1", inviteCode: "ABC234", isActive: true,
    });
    // A comparação no Firestore é literal: sem normalizar aqui, quem cola o código de um
    // print recebe "campanha não encontrada".
    expect(where).toHaveBeenCalledWith("inviteCode", "==", "ABC234");
  });

  it("normaliza espaço colado no código", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await campaignsRepo.findActiveByInviteCode("  abc234 ");
    expect(where).toHaveBeenCalledWith("inviteCode", "==", "ABC234");
  });

  it("ignora campanha arquivada e devolve a ativa de mesmo código", async () => {
    getDocs.mockResolvedValue({
      docs: [
        docOf("velha", { inviteCode: "ABC234", isActive: false }),
        docOf("viva", { inviteCode: "ABC234", isActive: true }),
      ],
    });
    await expect(campaignsRepo.findActiveByInviteCode("ABC234")).resolves.toMatchObject({ id: "viva" });
  });

  it("aceita campanha antiga que não tem o campo `isActive`", async () => {
    // Mesma razão da contagem: o campo nasceu depois. Recusar entrada aqui quebraria
    // convites de mesas que já rodavam.
    getDocs.mockResolvedValue({ docs: [docOf("legada", { inviteCode: "ABC234" })] });
    await expect(campaignsRepo.findActiveByInviteCode("ABC234")).resolves.toMatchObject({ id: "legada" });
  });

  it("devolve null quando nenhuma campanha ativa tem o código", async () => {
    // `null` é o "não achei" — distinto de rejeitar, que seria "não deu para procurar".
    getDocs.mockResolvedValue({ docs: [] });
    await expect(campaignsRepo.findActiveByInviteCode("ZZZ999")).resolves.toBeNull();

    getDocs.mockResolvedValue({ docs: [docOf("velha", { inviteCode: "ABC234", isActive: false })] });
    await expect(campaignsRepo.findActiveByInviteCode("ABC234")).resolves.toBeNull();
  });

  it("@policy strict — erro de leitura REJEITA em vez de virar 'código inválido'", async () => {
    getDocs.mockRejectedValue(new Error("unavailable"));
    await expect(campaignsRepo.findActiveByInviteCode("ABC234")).rejects.toThrow("unavailable");
  });
});

describe("campaignsRepo — membros e admins", () => {
  it("addMember entra na lista e registra o nome de exibição", async () => {
    await campaignsRepo.addMember("c1", "u2", "Bruno");

    expect(updateDoc).toHaveBeenCalledWith(
      { path: "campaigns/c1" },
      { members: { arrayUnion: "u2" }, "memberNames.u2": "Bruno" }
    );
    // `arrayUnion` é FieldValue: nasce e morre dentro do repo. Quem chama passou só strings.
    expect(arrayUnion).toHaveBeenCalledWith("u2");
  });

  it("removeMember tira de `members` E de `admins` na mesma escrita", async () => {
    await campaignsRepo.removeMember("c1", "u2");

    // Deixar o uid em `admins` devolveria poder de mestre a quem saísse e voltasse depois
    // pelo código de convite — o jogador reentraria como jogador e sairia admin.
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "campaigns/c1" },
      { members: { arrayRemove: "u2" }, admins: { arrayRemove: "u2" } }
    );
    expect(arrayRemove).toHaveBeenCalledTimes(2);
  });

  it("setAdmin promove com arrayUnion e rebaixa com arrayRemove", async () => {
    await campaignsRepo.setAdmin("c1", "u2", true);
    expect(updateDoc).toHaveBeenLastCalledWith(
      { path: "campaigns/c1" }, { admins: { arrayUnion: "u2" } }
    );

    await campaignsRepo.setAdmin("c1", "u2", false);
    expect(updateDoc).toHaveBeenLastCalledWith(
      { path: "campaigns/c1" }, { admins: { arrayRemove: "u2" } }
    );
  });

  it("@policy strict — falha ao sair da campanha REJEITA", async () => {
    updateDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(campaignsRepo.removeMember("c1", "u2")).rejects.toThrow("permission-denied");
  });
});

describe("campaignsRepo.update", () => {
  it("atualiza o doc raiz com os campos recebidos prontos", async () => {
    await campaignsRepo.update("c1", { isActive: false });
    expect(updateDoc).toHaveBeenCalledWith({ path: "campaigns/c1" }, { isActive: false });
  });

  it("@policy strict", async () => {
    updateDoc.mockRejectedValue(new Error("denied"));
    await expect(campaignsRepo.update("c1", { name: "X" })).rejects.toThrow("denied");
  });
});

describe("campaignsRepo.setNarracao", () => {
  const payload = { texto: "A porta range." };

  it("modo teste grava em `narracaoTest` marcado como ensaio", async () => {
    await campaignsRepo.setNarracao("c1", payload, { testMode: true });

    // O campo separado e o `test: true` são o que impede o ensaio do mestre de aparecer
    // na tela da mesa inteira.
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "campaigns/c1" }, { narracaoTest: { ...payload, test: true } }
    );
  });

  it("sem alvos definidos, narra para a mesa inteira em `narracao`", async () => {
    await campaignsRepo.setNarracao("c1", payload);
    expect(updateDoc).toHaveBeenCalledWith({ path: "campaigns/c1" }, { narracao: payload });
  });

  it("com alvos, grava um campo por jogador em `narracaoPrivada`", async () => {
    await campaignsRepo.setNarracao("c1", payload, { targetIds: ["u2", "u3"] });

    // Um campo por uid (e não um objeto inteiro) é o que permite narrar para um jogador
    // sem apagar a narração privada que o outro ainda não leu.
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "campaigns/c1" },
      { "narracaoPrivada.u2": payload, "narracaoPrivada.u3": payload }
    );
  });

  it("lista de alvos vazia não escreve nada", async () => {
    // Sem esta guarda, `updateDoc` receberia `{}` e ainda assim tocaria a rede.
    await campaignsRepo.setNarracao("c1", payload, { targetIds: [] });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it("@policy strict — falha ao narrar REJEITA", async () => {
    updateDoc.mockRejectedValue(new Error("denied"));
    await expect(
      campaignsRepo.setNarracao("c1", payload, { targetIds: ["u2"] })
    ).rejects.toThrow("denied");
  });
});

/* ════════════════════════════════════════════════
 *  FRONTEIRA VALIDADA — spec 0032 AC-6
 * ════════════════════════════════════════════════ */

describe("campaignsRepo — validação de fronteira (AC-6)", () => {
  it("campanha ÍNTEGRA sai idêntica, sem log nenhum", () => {
    // Regra 1 da spec: a validação não pode mudar nada para dado bem-formado.
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    const doc = {
      name: "A Ordem", system: "Ordem Paranormal", members: ["u1"],
      memberNames: { u1: "Ana" }, admins: [], maxPlayers: 6, isActive: true,
    };
    let entregue;
    onSnapshot.mockImplementation((_q, next) => { next({ docs: [docOf("c1", doc)] }); return () => {}; });

    campaignsRepo.watchByMember("u1", (l) => { entregue = l; });

    expect(entregue).toEqual([{ id: "c1", ...doc }]);
    expect(aviso).not.toHaveBeenCalled();
  });

  it("`members` de tipo errado NÃO chega à borda como não-array", async () => {
    /* É o crash concreto que o AC-6 mira: `useCampaign.entrarNaCampanha` faz
       `camp.members.includes(uid)` SEM guarda. Com `members` gravado errado, a tela quebra
       com "includes is not a function" num arquivo que não tem nada a ver com o dado. */
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    getDocs.mockResolvedValue({
      docs: [docOf("c1", { inviteCode: "ABC234", isActive: true, members: null, memberNames: "Ana" })],
    });

    const camp = await campaignsRepo.findActiveByInviteCode("ABC234");

    expect(Array.isArray(camp.members)).toBe(true);
    expect(() => camp.members.includes("u9")).not.toThrow();
    expect(camp.memberNames).toEqual({});
    // E o problema fica rastreável NA ORIGEM, com o id do documento (o ponto do AC-6).
    expect(aviso.mock.calls.map((c) => c[0]).join("\n"))
      .toContain('[campaignsRepo.saida] "c1".members');
  });

  it("`maxPlayers` gravado como string vira número — o `<input>` grava texto", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    getDocs.mockResolvedValue({ docs: [docOf("c1", { name: "A Ordem", maxPlayers: "8" })] });
    const [camp] = await campaignsRepo.listByMember("u1");
    expect(camp.maxPlayers).toBe(8);
  });

  it("campanha LEGADA sem `isActive`, sem `system` e sem `maxPlayers` atravessa intocada", async () => {
    /* Rejeitar — ou preencher — documento legado seria PIOR que o problema: `CampaignCard`
       esconde o selo do sistema com `{campaign.system && …}`, então inventar "Genérico" faria
       aparecer um selo que nunca existiu. Ausente continua ausente. */
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    getDocs.mockResolvedValue({ docs: [docOf("legada", { name: "Mesa de 2024", inviteCode: "ABC234" })] });

    const [camp] = await campaignsRepo.listByMember("u1");

    expect(camp).toEqual({ id: "legada", name: "Mesa de 2024", inviteCode: "ABC234" });
    expect(aviso).not.toHaveBeenCalled();
  });

  it("documento cujo corpo não é objeto é DESCARTADO da lista, com log de erro", () => {
    /* `d.data()` pode devolver `undefined`; `{id, ...undefined}` viraria um registro válido
       e vazio na tela de campanhas. É o único caso inutilizável de verdade. */
    let entregue;
    onSnapshot.mockImplementation((_q, next) => {
      next({ docs: [docOf("boa", { name: "A Ordem" }), docOf("fantasma", undefined)] });
      return () => {};
    });

    campaignsRepo.watchByMember("u1", (l) => { entregue = l; });

    expect(entregue).toEqual([{ id: "boa", name: "A Ordem" }]);
    expect(console.error.mock.calls.map((c) => c[0]).join("\n")).toContain("fantasma");
  });
});
