import * as paths from "../paths";

/**
 * Estes testes existem para que renomear uma coleção quebre AQUI, e não em produção
 * (spec 0029 AC-2). Os caminhos abaixo são os que já estão gravados no Firestore de
 * produção e nas `firestore.rules` — mudá-los sem migração perde dado de usuário.
 */
describe("paths — caminhos de coleção", () => {
  it("endereça o documento do usuário", () => {
    expect(paths.userDoc("u1")).toEqual(["users", "u1"]);
  });

  it("endereça personagens sob o dono", () => {
    expect(paths.charactersCol("u1")).toEqual(["users", "u1", "characters"]);
    expect(paths.characterDoc("u1", "c9")).toEqual(["users", "u1", "characters", "c9"]);
  });

  it("endereça a campanha e suas subcoleções", () => {
    expect(paths.campaignsCol()).toEqual(["campaigns"]);
    expect(paths.campaignDoc("k1")).toEqual(["campaigns", "k1"]);
    expect(paths.messagesCol("k1")).toEqual(["campaigns", "k1", "messages"]);
    expect(paths.typingCol("k1")).toEqual(["campaigns", "k1", "typing"]);
    expect(paths.typingDoc("k1", "u1")).toEqual(["campaigns", "k1", "typing", "u1"]);
    expect(paths.sharedSheetsCol("k1")).toEqual(["campaigns", "k1", "sharedSheets"]);
    expect(paths.sharedSheetDoc("k1", "s1")).toEqual(["campaigns", "k1", "sharedSheets", "s1"]);
    expect(paths.bestiaryCol("k1")).toEqual(["campaigns", "k1", "bestiary"]);
    expect(paths.bestiaryDoc("k1", "b1")).toEqual(["campaigns", "k1", "bestiary", "b1"]);
  });

  it("endereça a ficha pública e suas edições pendentes", () => {
    expect(paths.publicSheetDoc("c9")).toEqual(["publicSheets", "c9"]);
    expect(paths.pendingEditsCol("c9")).toEqual(["publicSheets", "c9", "pendingEdits"]);
    expect(paths.pendingEditDoc("c9", "e1")).toEqual(["publicSheets", "c9", "pendingEdits", "e1"]);
  });

  /**
   * O legado passava `character.id || character.createdAt` — número em fichas antigas.
   * `doc(db, ...)` exige string; converter no caminho evita repetir `String(...)` nos repos.
   */
  it("normaliza IDs numéricos para string", () => {
    expect(paths.characterDoc("u1", 1754150400000)).toEqual([
      "users", "u1", "characters", "1754150400000",
    ]);
    expect(paths.publicSheetDoc(1754150400000)).toEqual(["publicSheets", "1754150400000"]);
  });

  it("não deixa nenhum segmento vazio escapar para o SDK", () => {
    // Segmento vazio vira caminho inválido silencioso no Firestore ("users//characters").
    // Este teste documenta que a validação NÃO acontece aqui — é responsabilidade de cada
    // repo retornar cedo com uid/campaignId falsy (spec 0029, "Casos de borda").
    expect(paths.userDoc("")).toEqual(["users", ""]);
  });
});
