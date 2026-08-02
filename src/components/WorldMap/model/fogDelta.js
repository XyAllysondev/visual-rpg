/* ════════════════════════════════════════════════════════════════════
 *  O DELTA DA NÉVOA — a política de transmissão  (spec 0028 · F7 · AC-10)
 *  --------------------------------------------------------------------
 *  Lógica pura: nenhum React, nenhum Firebase, nenhum relógio próprio. O
 *  tempo entra por parâmetro (`agora`), como em todo o resto do domínio
 *  desta spec.
 *
 *  ── O PROBLEMA QUE ISTO RESOLVE ─────────────────────────────────────
 *  Até a F6 a máscara inteira era regravada a cada chegada e a cada
 *  revelação. Uma viagem abre névoa a cada quadro; consolidar o bitmap
 *  inteiro nesse ritmo é insustentável — e o AC-10 proíbe por escrito:
 *  *"a névoa trafega em deltas, com flush consolidado — nunca o bitmap
 *  inteiro a cada passo"*.
 *
 *  ── O CONTRATO, EM UMA LINHA ────────────────────────────────────────
 *      mesclar(antes, diferenca(antes, depois)) === depois
 *
 *  `model/fogMask.js` já entrega as duas metades e tem teste provando a
 *  igualdade. Ela só vale **enquanto a revelação não regride** — que é
 *  justamente a invariante do AC-6.
 *
 *  ── E QUANDO REGRIDE? ───────────────────────────────────────────────
 *  Recobrir névoa (o pincel do mestre, `cobrirCirculo`/`cobrirTudo`) APAGA
 *  bits. `diferenca` só captura o que ACENDEU: um delta jamais consegue
 *  expressar um apagamento, e transmitir um delta depois de recobrir
 *  deixaria o outro cliente com a névoa antiga — pior, com a névoa antiga
 *  achando que está em dia.
 *
 *  Por isso a decisão de "delta ou consolidado" **não é do chamador**: é
 *  de `planejarTransmissao`, que compara as duas máscaras e devolve
 *  `consolidado` sempre que enxerga regressão. Quem chama obedece.
 *  Ver `houveRegressao` — ela é a única barreira contra esse erro, e o
 *  gate dela está em `__tests__/f7-fog-delta.test.js`.
 *
 *  ── POR QUE UNIÃO SALVA A REDE RUIM ─────────────────────────────────
 *  Aplicar delta é `mesclar`, que é união: idempotente e comutativa. Logo
 *  o mesmo delta chegando duas vezes, ou fora de ordem, ou junto com a
 *  consolidação que já o continha, dá SEMPRE o mesmo resultado. É o que
 *  permite não guardar número de sequência nem exigir entrega ordenada:
 *  o pior caso de uma rede ruim é trabalho repetido, nunca névoa errada.
 *
 *  A recíproca também vale e é o que protege a revelação já aplicada
 *  localmente: `aplicarRemota` MESCLA o que chega com o que já existe
 *  aqui, em vez de substituir. Uma escrita que falhou não desfaz o que o
 *  grupo já viu na tela; ela volta a ser transmitida na consolidação
 *  seguinte, porque a consolidação parte da máscara local inteira.
 *
 *  A única exceção é a consolidação marcada como **recobertura**: ali o
 *  mestre APAGOU névoa de propósito, e mesclar preservaria exatamente o
 *  que ele quis tirar. Essa — e só essa — substitui.
 *
 *  Gate: `__tests__/f7-fog-delta.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { clonar, diferenca, iguais, mesclar, mesmaGrade, vazia } from "./fogMask";

/* ── Os intervalos, e o porquê de cada número ────────────────────────── */

/**
 * Janela do throttle que transmite delta durante a viagem, em ms.
 *
 * 300 ms é a mesma cadência com que o editor tático publica a posição do
 * token do jogador (`MapEditor/index.jsx`, "sync ao vivo com throttle
 * ~300ms"). É a mesma natureza de dado — "onde o grupo está e o que isso
 * abriu" — então usar outro número aqui seria inventar um segundo ritmo
 * para a mesma coisa. O canal `live_` do editor usa 250 ms; a diferença é
 * de propósito: aquele é efêmero (ponteiro, régua), este é estado de jogo.
 */
export const INTERVALO_DO_DELTA_MS = 300;

/**
 * De quanto em quanto tempo a máscara inteira é consolidada, em ms.
 *
 * Dez segundos é folgado: durante uma viagem contínua isso é uma escrita
 * cheia a cada ~33 deltas possíveis, e a máscara cheia medida na F3 é de
 * 2,3 KB numa sessão típica. Consolidar serve a três coisas ao mesmo tempo
 * — quem entra na mesa agora lê poucos documentos, o acumulado de deltas
 * não cresce sem limite, e uma sequência de deltas perdida por rede ruim
 * se corrige sozinha no flush seguinte.
 */
export const INTERVALO_DA_CONSOLIDACAO_MS = 10_000;

/**
 * Teto de deltas pendentes antes de consolidar, independente do relógio.
 *
 * O tempo sozinho não basta: uma revelação de região grande abre muita
 * névoa em poucos segundos. Vinte documentos é o ponto em que ler a
 * coleção inteira começa a custar mais do que reler a máscara.
 */
export const MAXIMO_DE_DELTAS = 20;

/* ── Motivos (o que a UI e o teste leem, em vez de string solta) ─────── */

export const TIPO_NADA = "nada";
export const TIPO_DELTA = "delta";
export const TIPO_CONSOLIDADO = "consolidado";

export const MOTIVOS = Object.freeze({
  SEM_MUDANCA: "sem-mudanca",
  SEM_BASE: "sem-base",
  GRADE_NOVA: "grade-nova",
  RECOBERTURA: "recobertura",
  PERIODO: "periodo",
  ACUMULO: "acumulo",
  FIM: "fim",
  PASSO: "passo",
});

/* ── Regressão ──────────────────────────────────────────────────────── */

/**
 * Alguma célula APAGOU de `antes` para `depois`?
 *
 * É a pergunta que decide entre delta e consolidação. A implementação é a
 * própria `diferenca` com os argumentos trocados: o que existe em `antes` e
 * não existe em `depois` é exatamente a névoa que voltou.
 *
 * Grades diferentes devolvem `true`: um mapa que mudou de tamanho não tem
 * como ser descrito por delta nenhum, e tratar isso como "não regrediu"
 * mandaria um delta que o outro cliente não conseguiria aplicar.
 *
 * @param {object|null} antes
 * @param {object|null} depois
 * @returns {boolean}
 */
export function houveRegressao(antes, depois) {
  if (!antes || !depois) return false;
  if (!mesmaGrade(antes, depois)) return true;
  return !vazia(diferenca(depois, antes));
}

/* ── A decisão ──────────────────────────────────────────────────────── */

const numero = (v, padrao = 0) => (Number.isFinite(v) ? v : padrao);

/**
 * Já passou tempo (ou deltas) o bastante para consolidar?
 *
 * `desde` é o instante da última consolidação; `null` significa "nunca
 * consolidou nesta sessão", e aí o relógio ainda não corre — quem manda é
 * o acúmulo. Sem isso, abrir a mesa e revelar uma célula gravaria a
 * máscara inteira de cara, que é o oposto do que o AC-10 pede.
 *
 * @param {{deltas?:number, desde?:number|null, agora?:number,
 *          intervalo?:number, maximo?:number}} situacao
 * @returns {boolean}
 */
export function precisaConsolidar(situacao = {}) {
  const deltas = numero(situacao.deltas, 0);
  const maximo = numero(situacao.maximo, MAXIMO_DE_DELTAS);
  if (deltas >= maximo) return true;

  const desde = Number.isFinite(situacao.desde) ? situacao.desde : null;
  if (desde === null) return false;
  if (deltas <= 0) return false;    // nada pendente: consolidar não diria nada novo

  const agora = numero(situacao.agora, desde);
  const intervalo = numero(situacao.intervalo, INTERVALO_DA_CONSOLIDACAO_MS);
  return agora - desde >= intervalo;
}

/**
 * O que transmitir agora: nada, um delta, ou a máscara inteira.
 *
 * **Esta função é a política inteira do AC-10.** Quem chama não escolhe: ela
 * é que sabe que recobrir não cabe em delta, que máscara nova não tem base
 * de comparação, e que de tempos em tempos o bitmap tem de fechar a conta.
 *
 * @param {object|null} antes a última máscara que o servidor tem (a base).
 * @param {object} depois a máscara local, agora.
 * @param {{deltas?:number, desde?:number|null, agora?:number, fim?:boolean,
 *          intervalo?:number, maximo?:number}} [situacao]
 *   `fim: true` é o fecho da viagem (ou o desmonte da tela): consolida
 *   mesmo dentro da janela, porque deixar a última pincelada só em delta
 *   depende de todos os clientes terem recebido todos eles.
 * @returns {{tipo:string, mascara:object|null, motivo:string, regrediu:boolean}}
 */
export function planejarTransmissao(antes, depois, situacao = {}) {
  if (!depois || !depois.bits) {
    return { tipo: TIPO_NADA, mascara: null, motivo: MOTIVOS.SEM_MUDANCA, regrediu: false };
  }

  if (!antes || !antes.bits) {
    return {
      tipo: TIPO_CONSOLIDADO, mascara: clonar(depois), motivo: MOTIVOS.SEM_BASE, regrediu: false,
    };
  }

  if (!mesmaGrade(antes, depois)) {
    return {
      tipo: TIPO_CONSOLIDADO, mascara: clonar(depois), motivo: MOTIVOS.GRADE_NOVA, regrediu: false,
    };
  }

  if (iguais(antes, depois)) {
    return { tipo: TIPO_NADA, mascara: null, motivo: MOTIVOS.SEM_MUDANCA, regrediu: false };
  }

  /* A ORDEM IMPORTA: a regressão é testada ANTES de qualquer atalho de
     janela. Um recobrimento nunca pode sair como delta, nem quando o
     relógio diz que ainda não é hora de consolidar. */
  if (houveRegressao(antes, depois)) {
    return {
      tipo: TIPO_CONSOLIDADO, mascara: clonar(depois), motivo: MOTIVOS.RECOBERTURA, regrediu: true,
    };
  }

  if (situacao.fim) {
    return { tipo: TIPO_CONSOLIDADO, mascara: clonar(depois), motivo: MOTIVOS.FIM, regrediu: false };
  }

  if (precisaConsolidar(situacao)) {
    const porAcumulo = numero(situacao.deltas, 0) >= numero(situacao.maximo, MAXIMO_DE_DELTAS);
    return {
      tipo: TIPO_CONSOLIDADO,
      mascara: clonar(depois),
      motivo: porAcumulo ? MOTIVOS.ACUMULO : MOTIVOS.PERIODO,
      regrediu: false,
    };
  }

  return {
    tipo: TIPO_DELTA,
    mascara: diferenca(antes, depois),
    motivo: MOTIVOS.PASSO,
    regrediu: false,
  };
}

/* ── Aplicação do que chega ─────────────────────────────────────────── */

/**
 * Aplica um delta recebido sobre a máscara local.
 *
 * Delta de outra grade é **ignorado** em vez de lançar: ele fala de um mapa
 * que não é este (o mestre trocou a ilustração por uma de outro tamanho, e a
 * consolidação seguinte vai trazer a máscara certa). Derrubar a mesa por
 * causa de um documento velho seria trocar um pixel errado por uma tela
 * preta.
 *
 * @param {object|null} local
 * @param {object|null} delta
 * @returns {object|null} máscara nova, ou a própria local quando nada muda.
 */
export function aplicarDelta(local, delta) {
  if (!delta || !delta.bits) return local;
  if (!local || !local.bits) return delta;
  if (!mesmaGrade(local, delta)) return local;
  if (vazia(delta)) return local;
  return mesclar(local, delta);
}

/**
 * A máscara que o servidor está descrevendo: a base mais todos os deltas.
 *
 * A ordem dos deltas não importa (união é comutativa), então não há
 * ordenação a garantir nem sequência a esperar. Delta de grade diferente da
 * base é descartado pelo mesmo motivo de `aplicarDelta`.
 *
 * @param {object|null} base
 * @param {Array<object>} deltas
 * @returns {object|null}
 */
export function mesclarRecebidos(base, deltas) {
  const lista = Array.isArray(deltas) ? deltas.filter((d) => d && d.bits) : [];
  if (!base || !base.bits) {
    if (lista.length === 0) return null;
    return lista.slice(1).reduce((acc, d) => aplicarDelta(acc, d), clonar(lista[0]));
  }
  return lista.reduce((acc, d) => aplicarDelta(acc, d), base);
}

/**
 * Reconcilia o que chegou do servidor com o que já existe nesta tela.
 *
 * **Mescla, não substitui** — é a regra que faz falha de rede não perder
 * revelação já aplicada localmente (AC-10). O único caso de substituição é
 * `substituir: true`, que a Mesa liga quando a consolidação recebida veio de
 * uma RECOBERTURA: ali o mestre apagou névoa de propósito, e mesclar
 * devolveria exatamente o que ele acabou de tirar.
 *
 * @param {object|null} local
 * @param {object|null} remota
 * @param {{substituir?:boolean}} [opcoes]
 * @returns {object|null}
 */
export function aplicarRemota(local, remota, opcoes = {}) {
  if (!remota || !remota.bits) return local;
  if (!local || !local.bits) return remota;
  if (!mesmaGrade(local, remota)) return remota;   // o mundo mudou de tamanho
  if (opcoes.substituir) return remota;
  if (iguais(local, remota)) return local;
  return mesclar(local, remota);
}

/**
 * Absorve o que chegou **mutando a máscara local** — a variante em lugar de
 * `aplicarRemota`, para o caminho quente da mesa.
 *
 * A F3 já decidiu que a máscara é mutável de propósito (`fogMask.js`,
 * "MUTAÇÃO EM LUGAR"): a mesa guarda UMA máscara, mexe nela e repinta por
 * `revisao`. Criar 30 KB novos a cada snapshot que chega do outro cliente
 * andaria na contramão disso — e trocaria a identidade do objeto que o render
 * usa para decidir se precisa repintar.
 *
 * @param {object} local mutada em lugar.
 * @param {object|null} remota
 * @returns {number} quantas células acenderam (0 = nada mudou, não repinte).
 */
export function absorver(local, remota) {
  if (!local || !local.bits || !remota || !remota.bits) return 0;
  if (!mesmaGrade(local, remota)) return 0;
  let acesas = 0;
  for (let i = 0; i < local.bits.length; i += 1) {
    const novo = local.bits[i] | remota.bits[i];
    if (novo !== local.bits[i]) {
      let diff = novo & ~local.bits[i] & 0xff;
      while (diff) { acesas += diff & 1; diff >>= 1; }
      local.bits[i] = novo;
    }
  }
  if (acesas > 0) local.revisao = (local.revisao || 0) + 1;
  return acesas;
}

/* ── Identidade dos documentos de delta ─────────────────────────────── */

/** Prefixo do id dos documentos de delta dentro da coleção `fog`. */
export const PREFIXO_DO_DELTA = "d_";

/**
 * Id de um documento de delta.
 *
 * Carrega a SESSÃO de quem escreveu, e não só um contador: duas abas do
 * mesmo mestre revelando ao mesmo tempo escolheriam o mesmo número, e uma
 * sobrescreveria a névoa da outra — que é perda silenciosa de revelação. Com
 * a sessão no id, as duas coexistem e a união resolve.
 *
 * O contador entra zero-preenchido só para o console do Firestore listar em
 * ordem legível; nada no código depende dessa ordem.
 *
 * @param {string} sessao identificador curto e aleatório desta aba.
 * @param {number} n contador local, crescente.
 * @returns {string}
 */
export function idDoDelta(sessao, n) {
  const conta = Math.max(0, Math.round(numero(n, 0)));
  const marca = String(sessao || "x").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "x";
  return `${PREFIXO_DO_DELTA}${String(conta).padStart(6, "0")}_${marca}`;
}

/** Este id é de um delta (e não da base consolidada)? */
export function ehDelta(id) {
  return typeof id === "string" && id.startsWith(PREFIXO_DO_DELTA);
}
