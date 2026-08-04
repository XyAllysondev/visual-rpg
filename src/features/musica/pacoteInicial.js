/* ════════════════════════════════════════════════════════════════════════
 *  PACOTE INICIAL DE EFEITOS — vozes servidas pelo app
 *  ------------------------------------------------------------------------
 *  Oito falas de terror geradas para Ordem Paranormal, em `public/sfx/`.
 *
 *  Por que ESTES podem morar no app e as TRILHAS não: são 539 KB no total
 *  (clipes de 1 a 7 segundos) contra ~12 MB de música. Arquivo em `public/`
 *  não entra no bundle JS — ele só engorda o artefato de deploy, e meio mega
 *  para todo mundo começar com uma mesa cheia é troca boa. Doze não seria.
 *
 *  O mestre carrega com um clique; a partir daí os arquivos vivem no
 *  IndexedDB dele como qualquer efeito importado, e podem ser renomeados,
 *  ter volume próprio ou ser apagados. O pacote não é especial depois de
 *  carregado — é só um atalho para a mesa não nascer vazia.
 * ════════════════════════════════════════════════════════════════════════ */

export const PASTA_PACOTE = "sfx";

/* `id` fixo e prefixado: recarregar o pacote não duplica botão, porque
 * `adicionarEfeito` recusa id repetido. */
export const PACOTE_INICIAL = [
  { id: "pk_crianca_oi",       arquivo: "1-crianca-oi.mp3",             nome: "Criança: “oi”",             volume: 0.85 },
  { id: "pk_crianca_chorando", arquivo: "2-crianca-chorando.mp3",       nome: "Criança chorando",           volume: 0.8 },
  { id: "pk_crianca_cantando", arquivo: "3-crianca-cantando.mp3",       nome: "Criança cantando",           volume: 0.7 },
  { id: "pk_mulher_gritando",  arquivo: "4-mulher-gritando.mp3",        nome: "Mulher gritando",            volume: 0.9 },
  { id: "pk_mulher_ajuda",     arquivo: "5-mulher-pedindo-ajuda.mp3",   nome: "Mulher pedindo ajuda",       volume: 0.8 },
  { id: "pk_sussurro",         arquivo: "6-sussurro-atras-de-voce.mp3", nome: "Sussurro: “atrás de você”",  volume: 0.75 },
  { id: "pk_entidade",         arquivo: "7-entidade.mp3",               nome: "Entidade fala",              volume: 0.85 },
  { id: "pk_radio_ordem",      arquivo: "8-radio-da-ordem.mp3",         nome: "Rádio da Ordem",             volume: 0.8 },
];

/** URL pública do clipe. `PUBLIC_URL` respeita deploy em subpasta. */
export const urlDoPacote = (arquivo) =>
  `${process.env.PUBLIC_URL || ""}/${PASTA_PACOTE}/${arquivo}`;

/** Quais itens do pacote ainda não estão na mesa. */
export const faltandoDoPacote = (efeitos) => {
  const tem = new Set((efeitos || []).map((e) => e.id));
  return PACOTE_INICIAL.filter((p) => !tem.has(p.id));
};
