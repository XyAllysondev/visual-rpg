/**
 * Forja do Mestre — TRADUÇÃO DOS ERROS (spec 0027, AC-8).
 *
 * Gate do BUG-3 do E2E: o mestre via "Missing or insufficient permissions" na tela.
 * Lógica pura, sem mock nenhum: o que está sob teste é o contrato de que NENHUM
 * texto do SDK escapa e de que toda mensagem tem causa e saída, em português.
 */
import { mensagemDeErro, codigoDeErro, MENSAGENS, MENSAGEM_GENERICA } from "../model/erros";

/** Imita o `FirebaseError` que o SDK joga na aplicação. */
function firebaseError(code, message) {
  const e = new Error(message);
  e.name = "FirebaseError";
  e.code = code;
  return e;
}

describe("codigoDeErro", () => {
  it("normaliza o código e descarta o prefixo do produto", () => {
    expect(codigoDeErro(firebaseError("permission-denied"))).toBe("permission-denied");
    expect(codigoDeErro(firebaseError("auth/network-request-failed")))
      .toBe("network-request-failed");
    expect(codigoDeErro(firebaseError("PERMISSION-DENIED"))).toBe("permission-denied");
  });

  it("devolve vazio para o que não é erro do SDK", () => {
    expect(codigoDeErro(new Error("qualquer coisa"))).toBe("");
    expect(codigoDeErro(null)).toBe("");
    expect(codigoDeErro(undefined)).toBe("");
  });
});

describe("mensagemDeErro", () => {
  const OBRIGATORIOS = [
    "permission-denied",
    "unavailable",
    "failed-precondition",
    "not-found",
    "already-exists",
    "resource-exhausted",
    "unauthenticated",
  ];

  it.each(OBRIGATORIOS)("traduz %s para português, com saída", (codigo) => {
    const texto = mensagemDeErro(firebaseError(codigo, "Missing or insufficient permissions"));

    expect(texto).toBe(MENSAGENS[codigo]);
    expect(texto).not.toMatch(/Missing or insufficient permissions/i);
    /* causa + saída: a frase nunca é um rótulo seco */
    expect(texto.length).toBeGreaterThan(40);
    expect(texto).toMatch(/[.!?]$/);
  });

  it("nunca deixa o texto cru do SDK chegar à tela", () => {
    const bruto = "Missing or insufficient permissions.";
    expect(mensagemDeErro(firebaseError("permission-denied", bruto))).not.toContain(bruto);
    /* código desconhecido também não vaza a mensagem em inglês */
    expect(mensagemDeErro(firebaseError("bizarro-novo", "Some brand new SDK failure")))
      .toBe(MENSAGEM_GENERICA);
  });

  it("índice faltando (failed-precondition) explica que não dá para resolver da tela", () => {
    expect(mensagemDeErro(firebaseError("failed-precondition"))).toMatch(/índice/i);
  });

  it("deixa passar o erro NOSSO, que já está em português", () => {
    expect(mensagemDeErro(new Error("Dê um nome ao mundo antes de criá-lo.")))
      .toBe("Dê um nome ao mundo antes de criá-lo.");
  });

  it("erro de biblioteca (TypeError) vira frase genérica, não inglês solto", () => {
    expect(mensagemDeErro(new TypeError("undefined is not a function")))
      .toBe(MENSAGEM_GENERICA);
  });

  it("sempre devolve alguma frase, mesmo sem erro nenhum", () => {
    expect(mensagemDeErro(null)).toBe(MENSAGEM_GENERICA);
    expect(mensagemDeErro(undefined)).toBe(MENSAGEM_GENERICA);
    expect(mensagemDeErro({})).toBe(MENSAGEM_GENERICA);
    expect(mensagemDeErro("Selecione um mundo antes de salvar.")).toBe(
      "Selecione um mundo antes de salvar.",
    );
  });
});
