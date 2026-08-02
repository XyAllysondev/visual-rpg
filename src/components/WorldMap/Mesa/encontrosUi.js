/* ════════════════════════════════════════════════════════════════════
 *  A MESA — ENCONTRO, ACAMPAMENTO E A PAUSA  (spec 0028 · F6 · AC-8)
 *  --------------------------------------------------------------------
 *  Só valores e funções puras: nenhum JSX, nenhum hook, nenhum I/O.
 *
 *  ── A REGRA QUE MANDA NESTE ARQUIVO (briefing §9) ───────────────────
 *  *"pausa a viagem e notifica o mestre com o resultado rolado; o mestre
 *  decide aceitar, trocar ou ignorar ANTES DE O JOGADOR VER QUALQUER
 *  COISA."*
 *
 *  Disso saem duas consequências que este módulo existe para garantir:
 *
 *  1. **A pendência mora em `gm/estado`**, documento que o cliente do
 *     jogador nem assina (`useGmDaMesa` só liga o listener para o mestre, e
 *     as rules negam a leitura). Nada aqui projeta pendência para o grupo.
 *
 *  2. **A pausa é MUDA.** O jogador precisa saber que a viagem parou — sem
 *     isso a mesa trava sem explicação — mas o MOTIVO nunca é gravado.
 *     Por isso a marca é um booleano só (`viagemPausada`), sem campo de
 *     razão, sem carimbo de origem: um `motivo: "encontro"` no documento do
 *     grupo seria o mesmo que contar o segredo por outro caminho.
 *
 *     E é por isso que o mestre também pausa A MÃO, quando quiser: se a
 *     pausa só existisse com encontro, a própria EXISTÊNCIA dela viraria o
 *     aviso. Pausa que só acontece por um motivo denuncia o motivo.
 *
 *  Gate: `__tests__/mesa-f6-encontros.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { formatarHoras } from "../Editor/editorUi";
import { PERIGO_MAXIMO, getPeriodo } from "../model/encontros";
import { relogioDe } from "./mesaUi";

const lista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (typeof v === "string" ? v.trim() : "");

/* ════════════════════════════════════════════════════════════════════
 *  A PAUSA — o que o GRUPO vê, e é tudo o que ele vê
 * ══════════════════════════════════════════════════════════════════ */

/**
 * A marca da pausa em `party.flags`. Fica em `flags` de propósito: é campo
 * que `atualizarParty` já permite e que as rules já deixam o grupo LER —
 * criar um campo novo exigiria mexer nas rules para ganhar nada.
 */
export const MARCA_DA_PAUSA = "viagemPausada";

/**
 * A frase que o grupo lê durante a pausa. **Uma só, para todos os motivos.**
 *
 * Não diz "aguardando o mestre decidir um encontro" — isso entregaria que
 * houve encontro, que é exatamente o que o AC-8 proíbe. Também não diz
 * "nada aconteceu", que seria mentira quando algo aconteceu. Diz o que é
 * verdade nos dois casos: a viagem está parada e a mesa está com o mestre.
 */
export const TEXTO_DA_PAUSA = "A viagem está parada. A mesa está com o mestre.";

/** O rótulo curto, para o cabeçalho do bloco de pausa. */
export const TITULO_DA_PAUSA = "Viagem parada";

/** A viagem está pausada para este grupo? */
export function viagemPausada(party) {
  return party?.flags?.[MARCA_DA_PAUSA] === true;
}

/**
 * As bandeiras do grupo com a pausa ligada ou desligada.
 *
 * Devolve `null` quando nada mudaria — a mesma disciplina de
 * `flagsComAsNovas`: escrita à toa no documento do grupo é tráfego em tempo
 * real que todos os clientes pagam.
 *
 * Desligar **apaga a chave** em vez de gravar `false`. Um `false` gravado
 * contaria que houve uma pausa ali antes; a ausência não conta nada.
 *
 * @param {object|null} flags `party.flags`.
 * @param {boolean} pausada
 * @returns {object|null}
 */
export function flagsComPausa(flags, pausada) {
  const base = flags && typeof flags === "object" && !Array.isArray(flags) ? flags : {};
  const estava = base[MARCA_DA_PAUSA] === true;
  if (!!pausada === estava) return null;
  const proximo = { ...base };
  if (pausada) proximo[MARCA_DA_PAUSA] = true;
  else delete proximo[MARCA_DA_PAUSA];
  return proximo;
}

/* ════════════════════════════════════════════════════════════════════
 *  A PENDÊNCIA NA TELA DO MESTRE
 *  --------------------------------------------------------------------
 *  `model/encontros.js` monta a pendência; aqui ela vira texto. A leitura é
 *  DEFENSIVA (`?.`, `Number.isFinite`) porque a pendência volta do Firestore
 *  — um documento gravado por uma versão anterior do app não pode derrubar a
 *  mesa do mestre no meio da sessão.
 * ══════════════════════════════════════════════════════════════════ */

/** As três decisões do AC-8, na ordem em que o mestre as encara. */
export const DECISOES = Object.freeze([
  {
    valor: "aceitar",
    label: "Aceitar",
    dica: "O encontro sorteado vai para a mesa como está.",
  },
  {
    valor: "trocar",
    label: "Trocar",
    dica: "Você escreve o que acontece no lugar do sorteado.",
  },
  {
    valor: "ignorar",
    label: "Ignorar",
    dica: "Nada aconteceu. A viagem segue e o grupo não fica sabendo de nada.",
  },
]);

/** Há uma pendência de verdade para o mestre resolver? */
export function temPendencia(gm) {
  const p = gm?.pendingEncounter;
  return !!p && typeof p === "object";
}

/**
 * A identidade de uma pendência, em texto.
 *
 * Existe por um motivo prático e chato: o `onSnapshot` do Firestore devolve um
 * OBJETO NOVO a cada snapshot, mesmo quando nada mudou. Sem uma assinatura
 * estável, o "decidir depois" do mestre seria desfeito no snapshot seguinte —
 * o diálogo voltaria sozinho para a frente dele, em laço.
 *
 * @param {object} pendencia
 * @returns {string} `""` quando não há pendência.
 */
export function assinaturaDaPendencia(pendencia) {
  if (!pendencia || typeof pendencia !== "object") return "";
  return [
    pendencia.origem,
    pendencia.trilhaId,
    pendencia.noId,
    pendencia.periodo,
    pendencia.chance,
    pendencia.rolagem,
    pendencia.sugestao?.id,
  ].map((v) => (v === undefined || v === null ? "" : String(v))).join("|");
}

/**
 * "38%" — a chance que o modelo calculou, como o mestre a lê.
 *
 * Aceita fração (0–1) e percentual (0–100), porque as duas convenções são
 * plausíveis e adivinhar errado mostraria "0%" numa mesa que rolou 38.
 */
export function formatarChance(chance) {
  if (!Number.isFinite(chance) || chance < 0) return "—";
  const pct = chance <= 1 ? chance * 100 : chance;
  const arredondado = Math.round(pct * 10) / 10;
  return `${String(arredondado).replace(".", ",")}%`;
}

/** A rolagem crua, na mesma régua da chance — para o mestre conferir a conta. */
export function formatarRolagem(rolagem) {
  if (!Number.isFinite(rolagem)) return "—";
  const pct = rolagem <= 1 ? rolagem * 100 : rolagem;
  return String(Math.round(pct * 10) / 10).replace(".", ",");
}

/** O título do que foi sorteado, sem nunca ficar vazio na tela do mestre. */
export function tituloDoEncontro(encontro) {
  return texto(encontro?.title) || texto(encontro?.nome) || texto(encontro?.name)
    || "Encontro sem título";
}

/** O texto que o GRUPO leria — o mestre precisa vê-lo antes de aceitar. */
export function textoDoEncontro(encontro) {
  return texto(encontro?.playerText) || texto(encontro?.texto) || "";
}

/**
 * A linha de contexto da pendência: onde, quando e com quanto de perigo.
 * Serve ao mestre para julgar o sorteio — é ele quem decide, e decidir sem
 * saber de onde veio a rolagem é só carimbar.
 *
 * @param {object} pendencia
 * @param {{nomeDoLugar?:string}} [opcoes]
 */
export function contextoDaPendencia(pendencia, opcoes = {}) {
  const partes = [];
  partes.push(pendencia?.origem === "acampamento" ? "No acampamento" : "Na estrada");
  const lugar = texto(opcoes.nomeDoLugar);
  if (lugar) partes.push(lugar);
  const periodo = getPeriodo(pendencia?.periodo);
  if (periodo) partes.push(periodo.label);
  if (Number.isFinite(opcoes.horas) && opcoes.horas > 0) partes.push(formatarHoras(opcoes.horas));
  return partes.join(" · ");
}

/* ════════════════════════════════════════════════════════════════════
 *  DE ONDE VEM A SUGESTÃO
 *  --------------------------------------------------------------------
 *  `montarPendencia` recebe a `sugestao` de fora — `model/encontros.js` não
 *  tem tabela de bestas, e inventar uma aqui seria escrever conteúdo de
 *  jogo dentro da interface (e fora do escopo da spec).
 *
 *  A fonte honesta já existe: os eventos que o MESTRE escreveu e está
 *  segurando na gaveta "Na sua mão" (gatilho `manual`, ainda não
 *  disparados). Sortear um deles é o que um mestre faz de verdade quando o
 *  dado pede encontro — e continua sendo SUGESTÃO: ela não vai à mesa sem
 *  o clique dele, que é o AC-8 inteiro.
 *
 *  Sem nenhum evento na gaveta, a pendência chega **vazia** e o mestre
 *  escreve o encontro na hora (o próprio `acampamento.js` prevê esse caso).
 *  Nunca se inventa um monstro para preencher o silêncio.
 * ══════════════════════════════════════════════════════════════════ */

/** O gatilho de onde as sugestões saem. */
export const GATILHO_DA_SUGESTAO = "manual";

/** Os eventos elegíveis a virar sugestão, na ordem do molde. */
export function candidatosAEncontro(eventos, jaDisparados) {
  const fora = jaDisparados instanceof Set
    ? jaDisparados
    : new Set(lista(jaDisparados));
  return lista(eventos).filter((e) => e
    && texto(e.id)
    && e.trigger === GATILHO_DA_SUGESTAO
    && !fora.has(e.id));
}

/**
 * Sorteia UM candidato. O `sorteio` entra por parâmetro (número de 0 a 1 ou
 * função) — este módulo não conhece `Math.random`, pela mesma razão de
 * `model/eventos.js`: mesa reproduzível no teste.
 *
 * @returns {object|null} `null` quando a gaveta está vazia.
 */
export function sugestaoDeEncontro(eventos, jaDisparados, sorteio) {
  const candidatos = candidatosAEncontro(eventos, jaDisparados);
  if (candidatos.length === 0) return null;
  const bruto = typeof sorteio === "function" ? sorteio() : sorteio;
  const fracao = Number.isFinite(bruto) ? Math.min(0.9999, Math.max(0, bruto)) : 0;
  return candidatos[Math.floor(fracao * candidatos.length)] || candidatos[0];
}

/** Os outros títulos da gaveta — atalhos para o mestre trocar sem digitar. */
export function nomesSugeridos(eventos, jaDisparados, exceto) {
  return candidatosAEncontro(eventos, jaDisparados)
    .filter((e) => e.id !== exceto)
    .map(tituloDoEncontro);
}

/* ── O perigo da região, para a emboscada do acampamento ────────────── */

/**
 * Onde o mestre guarda o perigo da REGIÃO. A emboscada não tem aresta de
 * onde tirar `dangerLevel` (o grupo está parado), e `acampar` exige a chance
 * pronta — então quem a informa é o mestre, explicitamente. Chutar um número
 * por ele seria decidir o tom da campanha às escondidas.
 */
export const MARCA_DO_PERIGO = "perigoDaRegiao";

/** O padrão: perigo 1. Baixo, mas não zero — zero desligaria a mecânica. */
export const PERIGO_PADRAO_DA_REGIAO = 1;

export function perigoDaRegiao(party) {
  const v = party?.flags?.[MARCA_DO_PERIGO];
  if (!Number.isFinite(v)) return PERIGO_PADRAO_DA_REGIAO;
  return Math.max(0, Math.min(PERIGO_MAXIMO, Math.round(v)));
}

/* ════════════════════════════════════════════════════════════════════
 *  O ACAMPAMENTO — o antes e o depois
 *  --------------------------------------------------------------------
 *  A tela mostra as DUAS colunas porque acampar é uma troca: horas por
 *  descanso, comida por horas. Mostrar só o depois esconderia o preço.
 * ══════════════════════════════════════════════════════════════════ */

/** As durações oferecidas. Oito horas é o descanso cheio; as outras são escolha. */
export const HORAS_DE_ACAMPAMENTO = Object.freeze([4, 8, 12]);

/** A duração padrão do botão. */
export const HORAS_PADRAO_DE_ACAMPAMENTO = 8;

/**
 * A frase honesta sobre a comida depois de acampar.
 *
 * **Nenhuma penalidade de regra é inventada aqui.** O sistema do Nexus não
 * define o que fome faz, e escrever "-2 em tudo" seria criar regra na
 * interface. O que a tela faz é dizer a verdade — acabou, e faltou tanto —
 * e devolver a decisão ao mestre, que é de quem ela é.
 *
 * @param {{esgotou?:boolean, deficit?:number, restante?:number}} consumo
 *   saída de `consumirSuprimentos` (ou o pedaço equivalente de `acampar`).
 * @returns {string} `""` quando não há nada a dizer.
 */
export function avisoDeSuprimentos(consumo) {
  if (!consumo || typeof consumo !== "object") return "";
  const deficit = Number.isFinite(consumo.deficit) ? consumo.deficit : 0;
  if (deficit > 0) {
    /* "faltaram 0,3 ração(ões)" é a máquina falando: o mestre precisa da
       CONSEQUÊNCIA, não do resto da divisão. A fração continua disponível —
       ver `detalheDeSuprimentos`, que a tela pendura no `title`. */
    return "A comida acabou no meio do descanso. O que isso custa ao grupo é decisão sua.";
  }
  if (consumo.esgotou || consumo.restante === 0) {
    return "Foi a última ração. O próximo dia começa sem comida.";
  }
  return "";
}

/**
 * O número cru por trás de `avisoDeSuprimentos` — para o `title`, nunca para a
 * frase. Quem quiser conferir a conta, confere; quem só quer mestrar, não lê.
 *
 * @param {{deficit?:number}} consumo
 * @returns {string} `""` quando não faltou nada.
 */
export function detalheDeSuprimentos(consumo) {
  if (!consumo || typeof consumo !== "object") return "";
  const deficit = Number.isFinite(consumo.deficit) ? consumo.deficit : 0;
  if (!(deficit > 0)) return "";
  const falta = Math.round(deficit * 10) / 10;
  return `Faltaram ${String(falta).replace(".", ",")} ração(ões).`;
}

/* ════════════════════════════════════════════════════════════════════
 *  O QUE VAI PARA O GRUPO
 * ══════════════════════════════════════════════════════════════════ */

/** O prefixo do cartão de encontro improvisado em `revealed/`. */
export const ID_DO_ENCONTRO = "encontro";

/**
 * O id do encontro que o mestre ESCREVEU na hora (a decisão "trocar"), que
 * é o único caso sem id próprio.
 *
 * Sai do **relógio de jogo**, não de um contador. Um contador (`encontro-1`,
 * `encontro-2`) faria os buracos na sequência denunciarem quantos encontros o
 * mestre ignorou — e o AC-8 diz que ignorar não deixa rastro. O relógio já é
 * público, então derivar dele não conta nada de novo.
 *
 * Dois encontros na mesma hora de jogo compartilham o id, e o segundo
 * sobrescreve o primeiro. É o comportamento certo: para o grupo, é o mesmo
 * momento da ficção.
 *
 * @param {{dia:number,hora:number,minuto:number}|number|null} dataHora
 * @returns {string}
 */
export function idDoEncontro(dataHora) {
  const r = relogioDe({ inGameDatetime: dataHora });
  if (typeof r === "number") return `${ID_DO_ENCONTRO}-h${Math.floor(r)}`;
  return `${ID_DO_ENCONTRO}-d${r.dia}-${String(r.hora).padStart(2, "0")}`;
}

/**
 * O id da PENDÊNCIA — o que identifica a decisão, não o encontro (F7 · AC-10).
 *
 * Nada a ver com `idDoEncontro` acima, e a diferença importa: aquele nomeia o
 * conteúdo que o GRUPO vai ler (e por isso sai do relógio de jogo, para não
 * contar quantos encontros o mestre ignorou); este nomeia a pergunta que está
 * na tela do MESTRE, num documento que o jogador não lê.
 *
 * É ele que `resolverPendencia` confere na transação: quem decidir primeiro
 * vence, e a segunda aba descobre que decidiu sobre algo que já não existe.
 * Carrega a sessão da aba porque duas abas sorteando ao mesmo tempo, no mesmo
 * milissegundo, escolheriam o mesmo id — e aí a transação acharia que são a
 * mesma pendência.
 *
 * @param {string} [sessao] identificador curto da aba.
 * @returns {string}
 */
export function idDaPendencia(sessao) {
  const marca = String(sessao || "x").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "x";
  return `pend-${Date.now().toString(36)}-${marca}`;
}

/**
 * O anúncio que o MESTRE ouve quando decide. O grupo não ouve nada disto —
 * o `aria-live` da mesa é compartilhado, mas quem monta a frase é o cliente,
 * e só o do mestre chega aqui.
 */
export function anuncioDaDecisao(decisao, encontro) {
  if (decisao === "ignorar") return "Encontro ignorado. A viagem segue.";
  if (decisao === "trocar") return `Você trocou o encontro por ${tituloDoEncontro(encontro)}.`;
  return `Encontro na mesa: ${tituloDoEncontro(encontro)}.`;
}
