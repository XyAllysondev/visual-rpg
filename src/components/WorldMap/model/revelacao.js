/* ════════════════════════════════════════════════════════════════════
 *  A MÁQUINA DE REVELAÇÃO  (spec 0028 · F4 · AC-6, AC-7, AC-8)
 *  --------------------------------------------------------------------
 *  Este arquivo é **o coração do produto**. O AC-6 chama a regra daqui de
 *  "a regra que define o produto", e exige que `aoChegarEm` seja função
 *  PURA com teste exaustivo escrito ANTES da implementação — foi o que
 *  aconteceu (`__tests__/revelacao.test.js`).
 *
 *  ── O QUE É "ESTADO" AQUI ───────────────────────────────────────────
 *  Um objeto chato de propósito:
 *
 *      { nos: { [noId]: 'hidden'|'rumored'|'discovered'|'visited' },
 *        trilhas: { [trilhaId]: 'hidden'|'revealed'|'traveled' } }
 *
 *  É a projeção em memória do que a mesa já revelou. Quem persiste é o
 *  `mesaStore` (um documento por revelação, em
 *  `campaigns/{cid}/worldmaps/{iid}/revealed/`), e quem desenha é a Mesa.
 *  Este módulo não sabe que Firestore existe.
 *
 *  ── A ORDEM DOS ENUMS É A REGRA ─────────────────────────────────────
 *  `hidden < rumored < discovered < visited` e `hidden < revealed < traveled`.
 *  Toda revelação é um `max`. É isso — e só isso — que garante a invariante
 *  do AC-6: **estado nunca regride automaticamente**. Não existe atribuição
 *  direta de estado neste arquivo fora de `rebaixarPeloMestre`, que é a
 *  única porta para trás e existe porque o mestre é dono da ficção.
 *
 *  ── PUREZA ──────────────────────────────────────────────────────────
 *  Sem React, sem Firebase, sem DOM, sem `Date.now()`, sem `Math.random()`.
 *  Nada muta a entrada: toda função devolve estado novo — ou **a mesma
 *  referência** quando nada mudou, para o React poder pular o render.
 *
 *  Gate: `__tests__/revelacao.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { pontasDaTrilha, vizinhos } from "./graph";

/* ── Os enums, e a ordem que os define ──────────────────────────────── */

/** Estados de um nó, do mais oculto ao mais conhecido. A ordem É a regra. */
export const ESTADOS_NO = Object.freeze(["hidden", "rumored", "discovered", "visited"]);

/** Estados de uma trilha, do mais oculto ao mais percorrido. */
export const ESTADOS_TRILHA = Object.freeze(["hidden", "revealed", "traveled"]);

/** Tudo nasce oculto: a mesa começa às escuras (AC-7). */
export const ESTADO_INICIAL_DO_NO = "hidden";
export const ESTADO_INICIAL_DA_TRILHA = "hidden";

/**
 * Raio de revelação quando nem o nó nem o mapa dizem qual é.
 *
 * Espelha `RAIO_DE_REVELACAO_PADRAO` de `worldMapStore.js` de propósito: lá o
 * número mora junto do documento do molde, aqui ele mora junto da regra pura.
 * Importar o store aqui traria o Firebase junto e quebraria a pureza — o preço
 * de duplicar um número é menor que o de sujar o coração do produto.
 */
export const RAIO_DE_REVELACAO_PADRAO = 120;

/** O que `podeViajarPara` responde quando não há caminho conhecido.
 *
 * **É a mesma frase para "não existe trilha" e para "existe, mas é secreta"** —
 * essa igualdade é o AC-9 do lado da navegação: a recusa não pode denunciar a
 * existência do segredo. Há teste travando isso. */
export const MOTIVO_SEM_CAMINHO = "Não há caminho conhecido daqui até lá.";

const MOTIVO_MESMO_NO = "O grupo já está nesse lugar.";
const MOTIVO_MAO_UNICA = "Essa trilha só pode ser percorrida no outro sentido.";

const idValido = (v) => typeof v === "string" && v.trim() !== "";
const listaDe = (v) => (Array.isArray(v) ? v : []);
const ausente = (v) => v === null || v === undefined || v === "";

/* ── Álgebra dos estados ────────────────────────────────────────────── */

/**
 * Em qual das duas escalas este estado vive?
 * `hidden` é comum às duas — não define escala sozinho.
 */
function escalaDe(estado) {
  if (ausente(estado) || estado === "hidden") return null;
  if (ESTADOS_NO.includes(estado)) return ESTADOS_NO;
  if (ESTADOS_TRILHA.includes(estado)) return ESTADOS_TRILHA;
  throw new Error(`Estado desconhecido: "${estado}".`);
}

function escalaComum(a, b) {
  const ea = escalaDe(a);
  const eb = escalaDe(b);
  if (ea && eb && ea !== eb) {
    throw new Error("Não dá para comparar um estado de nó com um estado de trilha.");
  }
  return ea || eb || ESTADOS_NO; // dois `hidden`: a escala não muda a resposta
}

/** Índice do estado na escala. Ausente = `hidden` = 0. */
function ordemNa(escala, estado) {
  if (ausente(estado)) return 0;
  const i = escala.indexOf(estado);
  if (i < 0) throw new Error(`Estado desconhecido: "${estado}".`);
  return i;
}

/**
 * O mais avançado dos dois — **a operação que sustenta o AC-6**.
 *
 * Ausência (`null`, `undefined`, `""`) conta como `hidden`, que é o caso comum:
 * o estado só existe no mapa depois da primeira revelação. Já um texto que não
 * é estado nenhum **lança** — dado torto tem de aparecer, não virar `hidden` em
 * silêncio.
 *
 * @param {string|null} a
 * @param {string|null} b
 * @returns {string}
 * @throws {Error} estado desconhecido, ou mistura de escala (nó × trilha).
 */
export function maxEstado(a, b) {
  const escala = escalaComum(a, b);
  return escala[Math.max(ordemNa(escala, a), ordemNa(escala, b))];
}

/**
 * O menos avançado dos dois. Só `rebaixarPeloMestre` usa — é a única operação
 * do módulo que anda para trás, e por isso é explicitamente manual.
 */
export function minEstado(a, b) {
  const escala = escalaComum(a, b);
  return escala[Math.min(ordemNa(escala, a), ordemNa(escala, b))];
}

/** `a` é **estritamente** mais avançado que `b`? */
export function ehMaior(a, b) {
  const escala = escalaComum(a, b);
  return ordemNa(escala, a) > ordemNa(escala, b);
}

/* ── Leitura do estado ──────────────────────────────────────────────── */

/**
 * Normaliza qualquer coisa para `{ nos, trilhas }`, sem guardar a referência de
 * quem chamou (senão mexer no objeto de fora mexeria no estado da mesa).
 */
export function criarEstado(parcial) {
  return {
    nos: { ...(parcial?.nos || {}) },
    trilhas: { ...(parcial?.trilhas || {}) },
  };
}

function lerEstado(mapa, id, escala) {
  const bruto = mapa?.[id];
  if (ausente(bruto)) return escala[0];
  return escala.includes(bruto) ? bruto : escala[0]; // dado torto degrada para oculto
}

/** Estado do nó, com padrão `hidden`. */
export function estadoDoNo(estado, noId) {
  return lerEstado(estado?.nos, noId, ESTADOS_NO);
}

/** Estado da trilha, com padrão `hidden`. */
export function estadoDaTrilha(estado, trilhaId) {
  return lerEstado(estado?.trilhas, trilhaId, ESTADOS_TRILHA);
}

/* ── O motor de aplicação (interno) ─────────────────────────────────── */

/**
 * Acumula mudanças sobre cópias e, no fim, decide se houve mudança de verdade.
 * Quando não houve, devolve **a referência original** — é o que permite ao
 * React comparar por identidade e pular o render.
 */
function transacao(estado) {
  const original = estado && typeof estado === "object" ? estado : null;
  const nos = { ...(original?.nos || {}) };
  const trilhas = { ...(original?.trilhas || {}) };
  const nosAlterados = [];
  const trilhasAlteradas = [];

  const aplicar = (mapa, alterados, escala, id, alvo, combinar) => {
    if (!idValido(id) || ausente(alvo)) return;
    const de = lerEstado(mapa, id, escala);
    const para = combinar(de, alvo);
    if (para === de) return;
    mapa[id] = para;
    alterados.push({ id, de, para });
  };

  return {
    subirNo: (id, alvo) => aplicar(nos, nosAlterados, ESTADOS_NO, id, alvo, maxEstado),
    subirTrilha: (id, alvo) => aplicar(trilhas, trilhasAlteradas, ESTADOS_TRILHA, id, alvo, maxEstado),
    descerNo: (id, alvo) => aplicar(nos, nosAlterados, ESTADOS_NO, id, alvo, minEstado),
    descerTrilha: (id, alvo) => aplicar(trilhas, trilhasAlteradas, ESTADOS_TRILHA, id, alvo, minEstado),
    noAtual: (id) => lerEstado(nos, id, ESTADOS_NO),
    fechar: (extra) => {
      const mudou = nosAlterados.length > 0 || trilhasAlteradas.length > 0;
      return {
        estado: mudou ? { nos, trilhas } : (original ?? { nos, trilhas }),
        mudou,
        nosAlterados,
        trilhasAlteradas,
        ...extra,
      };
    },
  };
}

/* ── aoChegarEm — o centro de tudo ──────────────────────────────────── */

/** O raio a abrir ao chegar: o do nó, senão o do mapa, senão o do módulo. */
function raioDoNo(no, opcoes) {
  const doNo = no?.revealRadius;
  if (Number.isFinite(doNo) && doNo > 0) return doNo;
  const doMapa = opcoes?.raioPadrao;
  if (Number.isFinite(doMapa) && doMapa > 0) return doMapa;
  return RAIO_DE_REVELACAO_PADRAO;
}

/**
 * **A REGRA QUE DEFINE O PRODUTO** (AC-6, literal):
 *
 * > o nó vira `visited`; a névoa abre no raio dele; para cada trilha ligada ao
 * > nó — se for **secreta**, pula; senão `trilha = max(trilha, 'revealed')` e
 * > `nó do outro lado = max(nó, 'discovered')`. **E nada além disso.**
 *
 * Três decisões que o texto do AC não explicita e que os testes travam:
 *
 * 1. **Mão única não filtra revelação.** Chegar pelo lado de trás de uma trilha
 *    `isOneWay` revela a trilha e descobre o outro nó. Ver o caminho e poder
 *    percorrê-lo são coisas diferentes: quem barra a travessia é
 *    `podeViajarPara`. Filtrar aqui esconderia a estrada de quem está parado
 *    nela.
 * 2. **Trilha órfã é ignorada.** Se a outra ponta não existe no grafo, não há
 *    o que desenhar nem para onde ir — revelar geraria uma linha para lugar
 *    nenhum. `validarGrafo` já acusa isso no ateliê como `trilha-orfa`.
 * 3. **Trilha sem id é ignorada.** Sem id não há como gravar nem rastrear o
 *    estado dela; revelar seria revelar algo que ninguém consegue reencontrar.
 *
 * A névoa é **descrita, não aplicada**: este módulo é puro e a máscara muta em
 * lugar (decisão da F3). Quem chama aplica `revelarCirculo(mascara, x, y, raio)`.
 *
 * @param {{nos:object,trilhas:object}} estado estado de visibilidade da mesa.
 * @param {{nos:Array,trilhas:Array}} grafo o molde inteiro (só o mestre o tem).
 * @param {string} noId o nó onde o grupo chegou.
 * @param {{raioPadrao?:number}} [opcoes] `raioPadrao` = `defaultRevealRadius` do mapa.
 * @returns {{estado:object, mudou:boolean, nevoa:{x,y,raio}|null,
 *            nosAlterados:Array<{id,de,para}>,
 *            trilhasAlteradas:Array<{id,de,para}>,
 *            secretasIgnoradas:string[]}}
 */
export function aoChegarEm(estado, grafo, noId, opcoes) {
  const nos = listaDe(grafo?.nos);
  const no = idValido(noId) ? nos.find((n) => n?.id === noId) : null;
  if (!no) {
    // Chegar a lugar nenhum não revela nada — e não inventa estado.
    return {
      estado: estado && typeof estado === "object" ? estado : criarEstado(),
      mudou: false,
      nevoa: null,
      nosAlterados: [],
      trilhasAlteradas: [],
      secretasIgnoradas: [],
    };
  }

  const t = transacao(estado);
  const secretasIgnoradas = [];

  t.subirNo(noId, "visited");

  vizinhos(grafo, noId).forEach(({ trilha, outroId }) => {
    if (trilha?.isSecret) {
      // Secreta só por teste, gatilho ou revelação manual (AC-6).
      if (idValido(trilha?.id)) secretasIgnoradas.push(trilha.id);
      return;
    }
    if (!idValido(trilha?.id)) return;                       // não rastreável
    if (!nos.some((n) => n?.id === outroId)) return;          // órfã
    t.subirTrilha(trilha.id, "revealed");
    t.subirNo(outroId, "discovered");
  });

  return t.fechar({
    nevoa: { x: no.x, y: no.y, raio: raioDoNo(no, opcoes) },
    secretasIgnoradas,
  });
}

/**
 * Chegada **pelo fim de uma viagem**: a trilha percorrida vira `traveled` e
 * depois vale a regra inteira do AC-6 no nó de destino.
 *
 * Existe porque `aoChegarEm` é literal ao AC-6 e não sabe por onde o grupo veio
 * — e `traveled` precisa de alguém que o atribua. É composição, não exceção:
 * continua sendo `max`, continua sem regredir, e a trilha percorrida pode ser
 * secreta (se o grupo a percorreu, ela já tinha sido descoberta).
 *
 * @returns {object} o mesmo formato de `aoChegarEm`.
 */
export function aoConcluirViagem(estado, grafo, trilhaId, paraId, opcoes) {
  const marcada = revelarManualmente(estado, { trilhas: [trilhaId], ateEstado: "traveled" });
  const chegada = aoChegarEm(marcada.estado, grafo, paraId, opcoes);
  return {
    ...chegada,
    mudou: marcada.mudou || chegada.mudou,
    nosAlterados: [...marcada.nosAlterados, ...chegada.nosAlterados],
    trilhasAlteradas: [...marcada.trilhasAlteradas, ...chegada.trilhasAlteradas],
  };
}

/* ── Revelação manual e por descoberta ──────────────────────────────── */

/** `ateEstado` aceita string (a escala decide a quem ela se aplica) ou `{no, trilha}`. */
function alvosDe(ateEstado, padraoNo, padraoTrilha) {
  if (ateEstado && typeof ateEstado === "object") {
    return {
      no: ausente(ateEstado.no) ? padraoNo : ateEstado.no,
      trilha: ausente(ateEstado.trilha) ? padraoTrilha : ateEstado.trilha,
    };
  }
  if (ausente(ateEstado)) return { no: padraoNo, trilha: padraoTrilha };
  const escala = escalaDe(ateEstado); // lança se for texto inventado
  if (escala === ESTADOS_TRILHA) return { no: padraoNo, trilha: ateEstado };
  if (escala === ESTADOS_NO) return { no: ateEstado, trilha: padraoTrilha };
  return { no: "hidden", trilha: "hidden" }; // ateEstado === 'hidden'
}

/**
 * O **"Revelar agora"** do mestre (AC-8): acende nós e trilhas escolhidos a
 * dedo, inclusive trilha secreta — é o caminho legítimo para revelá-la.
 *
 * Respeita o `max`: pedir `rumored` para um nó já `visited` não o rebaixa (e
 * `mudou` volta `false`). Para descer existe `rebaixarPeloMestre`.
 *
 * @param {object} estado
 * @param {{nos?:string[], trilhas?:string[], ateEstado?:string|{no?:string,trilha?:string}}} pedido
 *   `ateEstado` omitido = `discovered` para nós e `revealed` para trilhas.
 * @returns {{estado:object, mudou:boolean, nosAlterados:Array, trilhasAlteradas:Array}}
 */
export function revelarManualmente(estado, pedido) {
  const { no: alvoNo, trilha: alvoTrilha } = alvosDe(pedido?.ateEstado, "discovered", "revealed");
  const t = transacao(estado);
  listaDe(pedido?.nos).forEach((id) => t.subirNo(id, alvoNo));
  listaDe(pedido?.trilhas).forEach((id) => t.subirTrilha(id, alvoTrilha));
  return t.fechar();
}

/**
 * A trilha secreta que **passou no teste** de descoberta (AC-9): a trilha vira
 * `revealed` e os nós das duas pontas viram `max(estado, 'discovered')`.
 *
 * As duas pontas, e não "a de lá": o nó de onde o grupo veio já está `visited`,
 * e o `max` o deixa quieto. Isso dispensa dizer de onde se olha — e faz a função
 * servir igual para descoberta por teste, por gatilho e por revelação remota.
 *
 * @param {object} estado
 * @param {{nos:Array,trilhas:Array}|object} grafoOuTrilha o grafo (com `trilhaId`)
 *   ou a própria trilha. Mesma dupla-forma de `trilhaEmPonto` em `graph.js`.
 * @param {string} [trilhaId]
 * @returns {{estado:object, mudou:boolean, nosAlterados:Array, trilhasAlteradas:Array}}
 */
export function revelarPorDescoberta(estado, grafoOuTrilha, trilhaId) {
  const ehGrafo = Array.isArray(grafoOuTrilha?.trilhas) || Array.isArray(grafoOuTrilha?.nos);
  const trilha = ehGrafo
    ? listaDe(grafoOuTrilha?.trilhas).find((x) => x?.id === trilhaId)
    : grafoOuTrilha;

  const id = trilha?.id ?? trilhaId;
  if (!trilha || !idValido(id)) return transacao(estado).fechar();

  const [de, para] = pontasDaTrilha(trilha);
  const t = transacao(estado);
  t.subirTrilha(id, "revealed");
  if (idValido(de)) t.subirNo(de, "discovered");
  if (idValido(para)) t.subirNo(para, "discovered");
  return t.fechar();
}

/**
 * **A única porta para trás** (AC-6: "só o mestre rebaixa").
 *
 * É `min`, não atribuição: pedir `visited` para um nó que está `rumored` não o
 * promove — para promover existe `revelarManualmente`. Assim as duas funções
 * são inequívocas, e nenhuma delas consegue fazer o trabalho da outra por
 * engano.
 *
 * @param {object} estado
 * @param {{nos?:string[], trilhas?:string[], ateEstado?:string|{no?:string,trilha?:string}}} pedido
 *   `ateEstado` omitido = `hidden` (esconde de vez).
 */
export function rebaixarPeloMestre(estado, pedido) {
  const { no: alvoNo, trilha: alvoTrilha } = alvosDe(pedido?.ateEstado, "hidden", "hidden");
  const t = transacao(estado);
  listaDe(pedido?.nos).forEach((id) => t.descerNo(id, alvoNo));
  listaDe(pedido?.trilhas).forEach((id) => t.descerTrilha(id, alvoTrilha));
  return t.fechar();
}

/* ── Viajar: quem é destino e quem não é (AC-8) ─────────────────────── */

const trilhaTransitavel = (estado, trilha) =>
  idValido(trilha?.id) && ehMaior(estadoDaTrilha(estado, trilha.id), "hidden");

/** A trilha respeita o sentido pedido? `isOneWay` só vale de `from` para `to`. */
function sentidoOk(trilha, deId) {
  if (!trilha?.isOneWay) return true;
  const [de] = pontasDaTrilha(trilha);
  return de === deId;
}

/**
 * O grupo pode ir de `deId` até `paraId`?
 *
 * **AC-8, literal**: só por trilha `revealed` ou `traveled`. Um nó `discovered`
 * que não tenha trilha revelada ligando **não é destino** — o jogador o vê no
 * mapa e não consegue clicar.
 *
 * Duas garantias no texto da recusa:
 * - "não existe trilha" e "existe, mas está oculta/secreta" devolvem **a mesma
 *   frase e o mesmo código** (`MOTIVO_SEM_CAMINHO` / `sem-caminho`). É o AC-9
 *   aplicado à navegação: a recusa não denuncia o segredo.
 * - destino ainda `hidden` cai no mesmo caso — clicar num lugar invisível não
 *   pode ser um jeito de descobrir que ele existe.
 *
 * @returns {{ok:boolean, motivo:string, codigo:string, trilha:object|null}}
 *   `codigo`: `ok` · `mesmo-no` · `destino-inexistente` · `sem-caminho` · `mao-unica`.
 */
export function podeViajarPara(estado, grafo, deId, paraId) {
  const recusa = (codigo, motivo) => ({ ok: false, motivo, codigo, trilha: null });

  if (!idValido(deId) || !idValido(paraId)) return recusa("sem-caminho", MOTIVO_SEM_CAMINHO);
  if (deId === paraId) return recusa("mesmo-no", MOTIVO_MESMO_NO);

  const nos = listaDe(grafo?.nos);
  if (!nos.some((n) => n?.id === paraId)) {
    return recusa("destino-inexistente", "Esse lugar não existe neste mapa.");
  }
  if (!ehMaior(estadoDoNo(estado, paraId), "hidden")) {
    return recusa("sem-caminho", MOTIVO_SEM_CAMINHO);
  }

  const ligacoes = vizinhos(grafo, deId).filter(({ outroId }) => outroId === paraId);
  if (ligacoes.length === 0) return recusa("sem-caminho", MOTIVO_SEM_CAMINHO);

  const reveladas = ligacoes.filter(({ trilha }) => trilhaTransitavel(estado, trilha));
  if (reveladas.length === 0) return recusa("sem-caminho", MOTIVO_SEM_CAMINHO);

  // Entre trilhas equivalentes, a mais barata em horas — é a que o grupo pegaria.
  const viaveis = reveladas
    .filter(({ trilha }) => sentidoOk(trilha, deId))
    .sort((a, b) => (a.trilha?.travelHours ?? 0) - (b.trilha?.travelHours ?? 0));

  if (viaveis.length === 0) return recusa("mao-unica", MOTIVO_MAO_UNICA);
  return { ok: true, motivo: "", codigo: "ok", trilha: viaveis[0].trilha };
}

/**
 * Os destinos clicáveis a partir de `deId` — o insumo da UI para acender o que
 * é alcançável agora (AC-8). Um item por nó de destino, com a trilha mais barata
 * quando há mais de uma.
 *
 * `destinosPossiveis(...).map((d) => d.noId)` é o conjunto do "pode clicar".
 *
 * @returns {Array<{noId:string, no:object, trilha:object, horas:number}>}
 */
export function destinosPossiveis(estado, grafo, deId) {
  const nos = listaDe(grafo?.nos);
  const vistos = new Set();
  const saida = [];

  vizinhos(grafo, deId).forEach(({ outroId }) => {
    if (vistos.has(outroId)) return;
    vistos.add(outroId);
    const r = podeViajarPara(estado, grafo, deId, outroId);
    if (!r.ok) return;
    saida.push({
      noId: outroId,
      no: nos.find((n) => n?.id === outroId) || null,
      trilha: r.trilha,
      horas: r.trilha?.travelHours ?? 0,
    });
  });

  return saida;
}

/* ── projecaoDoJogador — o AC-1 do lado do código ───────────────────── */

/**
 * O que o jogador pode ver — **e só isso**.
 *
 * O AC-1 diz que o segredo é estrutural: o jogador não recebe o que não pode
 * ver, em vez de receber e a tela esconder. As rules e a separação de documento
 * garantem isso do lado do Firestore; **esta função é a garantia do lado do
 * código**, porque é ela que monta o payload que o `mesaStore` grava em
 * `revealed/`. Se ela vazar, as rules não têm como consertar: o dado já foi
 * copiado para um documento que o jogador lê por direito.
 *
 * O que ela garante, com teste varrendo o JSON serializado:
 * - nó `hidden` **não existe** na saída — nem id, nem nome, nem posição;
 * - nó `rumored` sai **sem nome, sem descrição e sem tipo** — só o `rumorLabel`
 *   (o design §5.3 pede "?" no lugar do ícone concreto: sem tipo não há ícone);
 * - `gmNotes`, `gmText`, `isSecret`, `discoveryCheck`, `linkedSceneId`,
 *   `revealRadius` e `dangerLevel` **não existem como chave** em lugar nenhum;
 * - trilha `hidden` não aparece;
 * - **trilha visível cujo nó da outra ponta ainda está oculto também não
 *   aparece** — desenhar a linha entregaria a posição do que está escondido.
 *
 * Os campos seguem a lista do design §3 para `revealed/{id}`. A única adição é
 * `isOneWay` na trilha: sem ele o cliente do jogador não consegue decidir o que
 * é clicável (AC-8), e ele não é segredo — a trilha já está revelada.
 *
 * @param {object} estado
 * @param {{nos:Array,trilhas:Array}} grafo
 * @returns {{nos:Array, trilhas:Array}} estruturas novas; o molde não é tocado.
 */
export function projecaoDoJogador(estado, grafo) {
  const visiveis = new Set();

  const nos = listaDe(grafo?.nos).reduce((acc, no) => {
    if (!idValido(no?.id)) return acc;
    const situacao = estadoDoNo(estado, no.id);
    if (situacao === "hidden") return acc;
    visiveis.add(no.id);

    if (situacao === "rumored") {
      // Rumor é boato: o jogador sabe que HÁ algo ali, não o que é.
      acc.push({
        id: no.id,
        kind: "node",
        x: no.x,
        y: no.y,
        estado: situacao,
        rumorLabel: no.rumorLabel || "",
      });
      return acc;
    }

    acc.push({
      id: no.id,
      kind: "node",
      x: no.x,
      y: no.y,
      type: no.type,
      name: no.name,
      description: no.description || "",
      icon: no.icon ?? null,
      color: no.color,
      estado: situacao,
    });
    return acc;
  }, []);

  const trilhas = listaDe(grafo?.trilhas).reduce((acc, trilha) => {
    if (!idValido(trilha?.id)) return acc;
    const situacao = estadoDaTrilha(estado, trilha.id);
    if (situacao === "hidden") return acc;
    const [de, para] = pontasDaTrilha(trilha);
    if (!visiveis.has(de) || !visiveis.has(para)) return acc;

    acc.push({
      id: trilha.id,
      kind: "edge",
      fromNodeId: de,
      toNodeId: para,
      pathPoints: listaDe(trilha.pathPoints).map((p) => ({ x: p.x, y: p.y })),
      travelHours: trilha.travelHours ?? 0,
      isOneWay: !!trilha.isOneWay,
      estado: situacao,
    });
    return acc;
  }, []);

  return { nos, trilhas };
}
