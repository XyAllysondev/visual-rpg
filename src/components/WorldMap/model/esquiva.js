/* ════════════════════════════════════════════════════════════════════
 *  A ESQUIVA DO ENCONTRO  (spec 0035 · F3 · M6 · AC-13/14/15)
 *  --------------------------------------------------------------------
 *  O encontro foi sorteado. Antes de ele acontecer, o grupo tem uma
 *  chance de passar sem ser notado — um teste de **Furtividade** contra
 *  uma DT tirada do perigo da trilha. Na referência (*Pathfinder: WotR*)
 *  isso sai sozinho na tela: *"Camellia: Falhou no teste de Furtividade"*.
 *
 *  Este arquivo é **clone estrutural de `model/descoberta.js`**, e as duas
 *  razões que moldaram aquele moldam este:
 *
 *  ── ESTE MÓDULO NÃO ROLA DADO ───────────────────────────────────────
 *  O AC-9 da 0028 é literal: *"a rolagem usa o motor de dados já existente
 *  do projeto — nenhum motor paralelo"*. Então `resultadoDaEsquiva`
 *  recebe **o resultado** da rolagem (de `src/domain/dice.js`), nunca o
 *  dado. Não há aleatoriedade aqui, nem relógio: mesma entrada, mesma
 *  saída, sempre (AC-15).
 *
 *  ── A FALHA NÃO PODE DELATAR O QUE VINHA VINDO ──────────────────────
 *  *"segredo não vaza pelo dado, vaza pela DIFERENÇA."* A saída de um
 *  teste falhado é **idêntica** — mesma string, mesmas chaves, mesmo JSON
 *  — à de um trecho onde não havia encontro nenhum. Se a frase mudasse
 *  conforme o que foi sorteado, o jogador leria o texto e saberia o que
 *  quase o pegou; se mudasse só de tamanho, ele contaria as letras.
 *
 *  Daí `MENSAGEM_NAO_ESCAPOU` ser **constante única**, usada nos dois
 *  casos, e a saída ter exatamente três chaves — sempre as mesmas três,
 *  sempre preenchidas. Nada de campo que só aparece às vezes: um
 *  `undefined` a mais é um oráculo.
 *
 *  ── ESTE MÓDULO NÃO CONHECE FIRESTORE ───────────────────────────────
 *  `melhorFurtividade` recebe uma lista de objetos JavaScript comuns e
 *  devolve um número. Quem busca as fichas é o repositório
 *  (`infrastructure/firestore/sharedSheetsRepo.js`), na camada de
 *  infraestrutura — ADR-0012, que registra este acoplamento entre
 *  agregados e o contém nesta única porta pura.
 *
 *  Gate: `__tests__/esquiva.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

/**
 * **A frase única.**
 *
 * É a resposta de uma esquiva que falhou numa trilha perigosa **e** a de um
 * trecho onde não havia encontro para escapar. As duas têm de ser a mesma
 * string, senão a diferença entrega o que vinha vindo. Não mencione o
 * encontro, o bicho, o perigo nem o fracasso aqui — o texto não pode admitir
 * que havia algo.
 */
export const MENSAGEM_NAO_ESCAPOU = "O grupo segue pela estrada.";

/** A resposta do escape. Só aparece quando o teste passou de verdade. */
export const MENSAGEM_ESCAPOU = "O grupo passa sem ser notado.";

/** A perícia da esquiva. Uma constante, não um parâmetro: a mecânica é esta. */
export const PERICIA_DA_ESQUIVA = "Furtividade";

/**
 * A DT para escapar, por nível de perigo da trilha — **tabela explícita, sem
 * fórmula mágica**.
 *
 * O índice é o `dangerLevel` (0–5), a mesma escala de `CHANCE_POR_HORA` em
 * `model/encontros.js` e de `NIVEIS_DE_PERIGO` no editor. Uma tabela em vez de
 * `10 + perigo × 3` porque:
 *
 *  · **perigo 0 não tem DT.** Estrada segura não sorteia encontro (regra dura
 *    de `chanceDeEncontro`), então não há do que escapar — `null`, e não um
 *    número que ninguém vai usar;
 *  · a curva do meio é **mais apertada do que linear** de propósito: entre
 *    perigo 2 e 3 está a fronteira entre "estrada ruim" e "lugar errado", e é
 *    ali que a esquiva precisa deixar de ser rotina;
 *  · uma fórmula esconderia essa intenção atrás de dois números, e o próximo a
 *    mexer nela não saberia o que estava desafinando.
 */
export const DT_POR_PERIGO = Object.freeze([
  null, // 0 · estrada segura — não há encontro para esquivar
  12,   // 1 · movimentada
  15,   // 2 · ermo
  19,   // 3 · perigosa
  22,   // 4 · muito perigosa
  25,   // 5 · não se atravessa de noite
]);

/** O teto da escala, derivado da tabela — nunca escrito duas vezes. */
export const PERIGO_MAXIMO_DA_ESQUIVA = DT_POR_PERIGO.length - 1;

const ehObjeto = (v) => !!v && typeof v === "object";
const listaDe = (v) => (Array.isArray(v) ? v : []);
const inteiro = (v) => (Number.isFinite(v) ? Math.round(v) : null);

/**
 * A DT de um nível de perigo, ou `null` quando não há esquiva a fazer.
 *
 * Perigo fora da escala é **grampeado**, não recusado: um molde antigo com
 * `dangerLevel: 9` não pode travar a mesa, e o tratamento honesto é lê-lo como
 * o pior perigo que a tabela conhece.
 *
 * @param {number} perigo o `dangerLevel` da trilha.
 * @returns {number|null}
 */
export function dtDaEsquiva(perigo) {
  const n = inteiro(perigo);
  if (n === null || n <= 0) return null;
  return DT_POR_PERIGO[Math.min(PERIGO_MAXIMO_DA_ESQUIVA, n)];
}

/** O total da rolagem, venha ele como número ou como o objeto do motor de dados. */
function totalDaRolagem(rolagem) {
  const bruto = ehObjeto(rolagem) ? rolagem.total : rolagem;
  return Number.isFinite(bruto) ? bruto : null;
}

/**
 * O grupo escapou?
 *
 * **A rolagem vem de fora** — `rollDice`/`rollOP` de `src/domain/dice.js`, o
 * motor único do projeto (AC-9). Aceita o total cru (`18`) ou o objeto do motor
 * (`{ total: 18 }`), porque o console do mestre tem os dois na mão.
 *
 * Todo caminho que não seja um escape comprovado cai **na mesma saída**: perigo
 * 0, perigo torto, rolagem torta ou rolagem abaixo da DT devolvem, todos,
 * `{ escapou:false, mensagem: MENSAGEM_NAO_ESCAPOU, dt }` — as mesmas três
 * chaves, na mesma ordem. É essa igualdade que faz o encontro continuar
 * desconhecido para quem não o viu.
 *
 * `dt` sai junto porque quem chama é o **console do mestre**, que mostra a
 * conta aberta (mesma escolha do painel de encontro: o mestre decide melhor
 * sabendo de onde a rolagem veio). Ela nunca acompanha a mensagem até o
 * jogador — quem publica para o grupo é a mesa, e ela publica só o texto.
 *
 * @param {number} perigo o `dangerLevel` da trilha.
 * @param {number|{total:number}} rolagem o resultado já rolado.
 * @returns {{escapou:boolean, mensagem:string, dt:number|null}} sempre três chaves.
 */
export function resultadoDaEsquiva(perigo, rolagem) {
  const dt = dtDaEsquiva(perigo);
  const naoEscapou = { escapou: false, mensagem: MENSAGEM_NAO_ESCAPOU, dt };

  if (dt === null) return naoEscapou;

  const total = totalDaRolagem(rolagem);
  if (total === null) return naoEscapou;
  if (total < dt) return naoEscapou;

  return { escapou: true, mensagem: MENSAGEM_ESCAPOU, dt };
}

/**
 * O bônus de Furtividade de UMA ficha, ou `null`.
 *
 * A conta é a de Ordem Paranormal, **lida da ficha e não inventada aqui**:
 * `skillTreino[perícia] + skillOutros[perícia]`
 * (`OrdemParanormalSheet.jsx:429-435`). O atributo NÃO entra — em OP ele decide
 * quantos d20 o `rollOP` lança, não um modificador plano. Somá-lo aqui seria
 * contar o atributo duas vezes.
 *
 * Aceita tanto a ficha crua quanto o documento de ficha compartilhada, que
 * guarda o personagem em `character` (`sharedSheetsRepo.share`).
 *
 * @param {object} ficha
 * @returns {number|null} `null` quando a ficha não diz nada sobre a perícia.
 */
export function furtividadeDaFicha(ficha) {
  const personagem = ehObjeto(ficha?.character) ? ficha.character : ficha;
  if (!ehObjeto(personagem)) return null;

  const treino = ehObjeto(personagem.skillTreino)
    ? personagem.skillTreino[PERICIA_DA_ESQUIVA]
    : undefined;
  const outros = ehObjeto(personagem.skillOutros)
    ? personagem.skillOutros[PERICIA_DA_ESQUIVA]
    : undefined;

  /* Ficha que não fala da perícia devolve `null`, não zero. Zero é um bônus
     legítimo (destreinado), e confundir os dois faria uma campanha SEM ficha
     parecer uma campanha com um personagem péssimo — a fronteira garante tipo,
     nunca inventa presença (ADR-0011). */
  const t = Number.isFinite(treino) ? treino : null;
  const o = Number.isFinite(outros) ? outros : null;
  if (t === null && o === null) return null;

  return (t || 0) + (o || 0);
}

/**
 * A melhor Furtividade entre as fichas compartilhadas da campanha.
 *
 * **É o melhor, não a média nem o pior.** Quem guia o grupo pelo mato é quem
 * sabe andar no mato; a mesa não perde a esquiva porque o combatente de
 * armadura também está ali. (Se um dia a regra virar "o pior do grupo", ela
 * muda AQUI e o teste do AC-14 muda junto — que é exatamente o ponto de a conta
 * ter um lugar só.)
 *
 * **Sem ficha compartilhada devolve `null`** — e `null` é a instrução para o
 * console do mestre manter o campo de bônus manual, como sempre foi (AC-13). A
 * mecânica nova não pode travar mesa nenhuma.
 *
 * @param {Array<object>} fichas as fichas compartilhadas da campanha.
 * @returns {number|null}
 */
export function melhorFurtividade(fichas) {
  const bonus = listaDe(fichas)
    .map(furtividadeDaFicha)
    .filter((b) => b !== null);

  if (bonus.length === 0) return null;
  return bonus.reduce((maior, b) => (b > maior ? b : maior), bonus[0]);
}

/**
 * O bônus que a esquiva vai usar, e de onde ele veio.
 *
 * Uma função só, para o console do mestre não precisar decidir isto na tela —
 * é regra, e regra mora no modelo.
 *
 * @param {Array<object>} fichas as fichas compartilhadas.
 * @param {number} manual o número digitado pelo mestre (usado só sem ficha).
 * @returns {{bonus:number, automatico:boolean}}
 */
export function bonusDaEsquiva(fichas, manual = 0) {
  const daFicha = melhorFurtividade(fichas);
  if (daFicha === null) {
    return { bonus: Number.isFinite(manual) ? manual : 0, automatico: false };
  }
  return { bonus: daFicha, automatico: true };
}
