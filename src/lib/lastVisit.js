/* ════════════════════════════════════════════════════════════════════
 *  ÚLTIMA VISITA — a faixa "Retomar" do Painel
 *  --------------------------------------------------------------------
 *  O Painel precisa responder "o que eu faço agora?" para quem abre o app
 *  pela décima vez. A resposta mais barata do mundo: onde você estava.
 *
 *  MORA NO `localStorage`, de propósito — ZERO Firestore. É preferência de
 *  máquina, não dado de conta: não vale uma leitura por abertura do app,
 *  não precisa sincronizar entre dispositivos, e se perder não dói.
 *
 *  Só guarda o ÚLTIMO destino, não um histórico. Uma lista de "recentes"
 *  no topo do Painel competiria com o conteúdo real logo abaixo; uma linha
 *  só é um convite, cinco viram um menu.
 * ════════════════════════════════════════════════════════════════════ */

/** Chave única. Não é por usuário: `localStorage` já é por navegador, e
 *  trocar de conta na mesma máquina é raro o bastante para não valer a
 *  complexidade — o Painel valida o alvo antes de oferecer, então um
 *  registro de outra conta simplesmente não renderiza. */
export const CHAVE = "nexus_last_visit";

/** Depois disso o registro é lixo: retomar algo de mês passado não ajuda
 *  ninguém e ainda dá impressão de que o app parou no tempo. */
export const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

/** Os três destinos que valem retomar. Qualquer outro é recusado na
 *  gravação — melhor não ter faixa do que ter uma que leva a lugar torto. */
export const TIPOS = Object.freeze(["campanha", "mapa", "mundo"]);

/** Rótulo curto do tipo, para a faixa: "▸ Coroa de Cinzas · mapa · há 2 h". */
export const ROTULO_DO_TIPO = Object.freeze({
  campanha: "campanha",
  mapa: "mapa",
  mundo: "mundo",
});

const texto = (v) => (typeof v === "string" ? v.trim() : "");

/* O `localStorage` lança em Safari privado e em iframe com cookies
 * bloqueados. Nada aqui pode derrubar o app por causa de uma conveniência:
 * falhar é sempre "não tem registro", nunca uma exceção que sobe. */
function storage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Anota onde o mestre esteve pela última vez.
 * Silencioso por contrato: é conveniência, não uma operação do usuário —
 * nunca interrompe o que ele estava fazendo.
 *
 * @param {{kind:string, id:string, label:string}} destino
 * @param {number} [agora] injetável para teste determinístico
 * @returns {boolean} se gravou
 */
export function registrar({ kind, id, label } = {}, agora = Date.now()) {
  const tipo = texto(kind);
  const alvo = texto(id);
  const nome = texto(label);
  if (!TIPOS.includes(tipo) || !alvo || !nome) return false;

  const store = storage();
  if (!store) return false;
  try {
    store.setItem(CHAVE, JSON.stringify({ kind: tipo, id: alvo, label: nome, at: agora }));
    return true;
  } catch {
    return false; // cota estourada — segue a vida
  }
}

/**
 * Lê o último destino, ou `null`.
 *
 * Devolve `null` — e NÃO um objeto meio preenchido — em todos os casos de
 * dúvida: ausente, JSON corrompido, tipo desconhecido, campo faltando ou
 * velho demais. Quem consome só precisa de um `if`, e a faixa some sozinha.
 *
 * @param {number} [agora] injetável para teste determinístico
 */
export function ler(agora = Date.now()) {
  const store = storage();
  if (!store) return null;

  let cru;
  try {
    cru = store.getItem(CHAVE);
  } catch {
    return null;
  }
  if (!cru) return null;

  let dado;
  try {
    dado = JSON.parse(cru);
  } catch {
    return null; // alguém mexeu à mão, ou versão antiga incompatível
  }
  if (!dado || typeof dado !== "object") return null;

  const kind = texto(dado.kind);
  const id = texto(dado.id);
  const label = texto(dado.label);
  const at = Number(dado.at);
  if (!TIPOS.includes(kind) || !id || !label || !Number.isFinite(at)) return null;

  /* `at` no futuro acontece com relógio do sistema errado. Tratar como
   * válido é melhor que descartar: o pior caso é um "há poucos instantes"
   * impreciso, contra perder a faixa de quem só acertou a hora do PC. */
  if (agora - at > VALIDADE_MS) return null;

  return { kind, id, label, at };
}

/** Esquece o último destino. Usado quando o alvo deixa de existir. */
export function limpar() {
  const store = storage();
  if (!store) return false;
  try {
    store.removeItem(CHAVE);
    return true;
  } catch {
    return false;
  }
}
