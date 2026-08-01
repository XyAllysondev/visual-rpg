/**
 * Forja do Mestre — ERRO DE INFRA VIRA FRASE DE GENTE (spec 0027, AC-8).
 *
 * O SDK do Firebase fala inglês e fala com o programador: "Missing or insufficient
 * permissions" não diz ao mestre o que aconteceu nem o que fazer. Esta é a ÚNICA
 * tradução da suíte — casca, Wiki e modais importam daqui, ninguém duplica.
 *
 * Regras:
 *  · toda mensagem traz CAUSA e SAÍDA (o que houve, o que fazer agora);
 *  · texto cru do SDK nunca chega à tela (fica no console, para depuração);
 *  · erro nosso (o `worldsStore` lança `new Error("…")` em português) passa direto.
 */

/** Última linha de defesa: nem código conhecido, nem mensagem nossa. */
export const MENSAGEM_GENERICA =
  "Algo deu errado ao falar com o servidor. Tente de novo em instantes; se insistir, recarregue a página.";

/** Código do Firebase → causa + saída, em português do Brasil. */
export const MENSAGENS = {
  "permission-denied":
    "Este mundo não é seu — ou foi removido enquanto você olhava. Escolha outro mundo no topo da Forja, ou entre de novo com a conta que criou este.",
  unavailable:
    "O servidor não respondeu: a conexão caiu ou está instável demais. Confira a internet e tente de novo em instantes — o que já foi salvo continua salvo.",
  "failed-precondition":
    "Esta consulta depende de um índice que ainda não existe no banco. Não dá para resolver desta tela: avise a equipe do Nexus para criar o índice.",
  "not-found":
    "Este registro não está mais no banco — ele foi apagado aqui ou em outro dispositivo. Volte para a lista e recarregue para ver o estado atual.",
  "already-exists":
    "Já existe um registro igual a este. Mude o nome (ou a relação) e salve de novo.",
  "resource-exhausted":
    "O limite de uso do banco foi atingido por agora. Espere alguns minutos e tente de novo; se continuar assim, avise a equipe do Nexus.",
  unauthenticated:
    "Sua sessão expirou. Entre de novo na sua conta para continuar de onde parou.",
  cancelled: "A operação foi interrompida antes de terminar. Tente de novo.",
  "deadline-exceeded":
    "O servidor demorou demais para responder e a operação foi cortada. Tente de novo em instantes.",
  aborted:
    "Outra escrita mexeu nos mesmos dados ao mesmo tempo e esta foi desfeita. Abra de novo e repita a alteração.",
  "invalid-argument":
    "O servidor recusou algum campo do formulário. Revise o que você preencheu e salve de novo.",
  "out-of-range":
    "Algum valor ficou fora do que o servidor aceita. Revise o formulário e salve de novo.",
  "network-request-failed":
    "A rede falhou no meio do caminho. Confira a internet e tente de novo em instantes.",
  internal: MENSAGEM_GENERICA,
  unknown: MENSAGEM_GENERICA,
};

const texto = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Código normalizado do erro do Firebase, sem o prefixo de produto.
 * `auth/network-request-failed` → `network-request-failed`; `permission-denied` → igual.
 * @returns {string} código em minúsculas, ou "" quando não é erro do SDK.
 */
export function codigoDeErro(e) {
  const bruto = texto(e && e.code).toLowerCase();
  if (!bruto) return "";
  const barra = bruto.indexOf("/");
  return barra === -1 ? bruto : bruto.slice(barra + 1);
}

/**
 * Mensagem em PT-BR para qualquer erro que a suíte precise mostrar.
 * @param {unknown} e erro do Firebase, `Error` nosso, ou texto já pronto.
 * @returns {string} sempre uma frase em português — nunca vazia, nunca do SDK.
 */
export function mensagemDeErro(e) {
  const direto = texto(e);
  if (direto) return direto; // a UI às vezes passa uma frase já escrita

  const codigo = codigoDeErro(e);
  if (codigo) return MENSAGENS[codigo] || MENSAGEM_GENERICA;

  /* Sem código do SDK: só confiamos na mensagem quando ela é NOSSA. O
   * `worldsStore` lança `new Error("…")` em português (name === "Error"); um
   * TypeError ou erro de biblioteca fala inglês e fica só no console. */
  const nossa = e instanceof Error && e.name === "Error" ? texto(e.message) : "";
  return nossa || MENSAGEM_GENERICA;
}

export default mensagemDeErro;
