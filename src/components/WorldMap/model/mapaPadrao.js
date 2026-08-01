/**
 * Mapa-Múndi — MAPA PADRÃO (spec 0028, AC-13).
 *
 * O molde autoral que já vem pronto dentro de Mapas-Múndi: o mestre abre a aba
 * pela primeira vez e **já tem um mapa jogável**, com ilustração e grafo, sem
 * desenhar nada nem subir arte. Se quiser o dele, cria do lado — este não atrapalha.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AMBIENTAÇÃO — *Coroa de Cinzas*, a mesma da Forja do Mestre
 *
 * Não inventamos um segundo mundo. Os Locais e Rotas do mundo demo
 * (`MasterSuite/model/demoWorld.js`) viram nós e trilhas aqui: Vila Candeia, a
 * Serra da Boca Seca, o Forte da Barra Negra, a Estrada dos Tropeiros Mudos, a
 * Ordem das Velas Tortas, o Corta-Sono e o Dono do Escuro. Quem criou o mundo
 * demo na Forja reconhece o mapa — as duas features contam a mesma história.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * TRÊS REGRAS QUE O AC-13 IMPÕE E ESTE ARQUIVO GARANTE
 *
 * 1. **Não consome cota** (`MAPA_PADRAO_CONSOME_COTA === false`). A cota do free
 *    é de **1 mapa** (`model/quotas.js`); se o padrão contasse, o mestre free
 *    nasceria sem poder criar o dele. Quem ligar isto na UI **não** pode somar o
 *    padrão em `canCreateMap(plan, mapCount)` — `mapCount` é só o que está em
 *    `users/{uid}/worldmaps`, e o padrão **não mora no Firestore**: ele é código.
 *
 * 2. **Cópia ao usar.** Mexer no padrão nunca altera o original — a UI chama
 *    `clonarMapaPadrao()` e grava a cópia como mapa do usuário (essa cópia SIM
 *    consome cota, porque virou um mapa dele). Recomeçar é só clonar de novo.
 *
 * 3. **Ilustração vetorial** (`CartografiaPadrao.jsx`), não dado de usuário: não
 *    pesa no Firestore, não esbarra no teto de 900 KB do base64 e fica nítida em
 *    qualquer zoom. `mapa.background` é `null` de propósito — o campo de imagem
 *    fica livre para o mestre trocar a arte se quiser (AC-13).
 *
 * DETERMINISMO: sem `Date.now()`, sem `Math.random()`, ids locais estáveis
 * (`padrao-no-1`, `padrao-trilha-1`). Duas chamadas devolvem estruturas idênticas
 * — e objetos NOVOS, para que quem grava carimbe datas sem contaminar o seed.
 *
 * Gate: `__tests__/mapaPadrao.test.js`.
 */

import { criarNo, criarTrilha } from "./graph";

/**
 * Id reservado do padrão. Não é um id de documento do Firestore — o padrão não
 * é documento. Serve para a lista distinguir "o mapa que já vem no app" dos
 * mapas do mestre, e para as telas roteadas por id não confundirem os dois.
 * O prefixo `nexus-` torna a colisão com um id gerado pelo Firestore impossível
 * na prática (ids do Firestore são 20 caracteres alfanuméricos sem hífen).
 */
export const MAPA_PADRAO_ID = "nexus-mapa-padrao";

/** O padrão nunca entra na conta da cota do plano (AC-3 + AC-13). */
export const MAPA_PADRAO_CONSOME_COTA = false;

/**
 * Sistema de coordenadas do mundo. **Estes dois números são o contrato** entre o
 * grafo e a ilustração: `CartografiaPadrao.jsx` importa daqui e usa como
 * `viewBox="0 0 2400 1600"`. Mudou aqui, mudou lá — e todos os `x`/`y` dos nós
 * abaixo foram posicionados sobre este desenho.
 */
export const MAPA_PADRAO_LARGURA = 2400;
export const MAPA_PADRAO_ALTURA = 1600;

/** Raio de revelação padrão dos nós deste mapa, em unidades de mundo. */
const RAIO = 190;

/** Prefixo dos ids do clone quando quem chama não informa outro. */
const PREFIXO_CLONE_PADRAO = "copia";

/**
 * Ids numa tabela só — igual ao mundo demo. Deixa a lista de trilhas legível e
 * renomear um nó não vira caça ao literal espalhado.
 */
const ID = {
  serra: "padrao-no-1",
  boca: "padrao-no-2",
  pouso: "padrao-no-3",
  capela: "padrao-no-4",
  vila: "padrao-no-5",
  rancho: "padrao-no-6",
  passo: "padrao-no-7",
  charco: "padrao-no-8",
  cova: "padrao-no-9",
  salinas: "padrao-no-10",
  forte: "padrao-no-11",
  celas: "padrao-no-12",
};

/**
 * Os doze nós, na ordem em que aparecem no mapa de oeste para leste.
 *
 * `rumorLabel` é o que o grupo lê ANTES de descobrir o lugar — na F4 é ele que
 * aparece no nó `rumored`, e por isso nunca entrega o nome verdadeiro.
 * `gmNotes` é o que a F4 tem de **proteger**: nada disso pode chegar ao cliente
 * do jogador, então cada nota aqui é uma coisa que estraga a mesa se vazar.
 */
const NOS = [
  {
    id: ID.serra,
    type: "poi",
    x: 430,
    y: 330,
    name: "Serra da Boca Seca",
    rumorLabel: "A serra onde o gado volta diferente",
    description:
      "Espinhaço de pedra escura no alto do sertão. O vento passa pelas fendas chamando gente pelo "
      + "nome, e o gado que sobe volta sem sombra — quando volta.",
    gmNotes:
      "É o teto do Dono do Escuro. Cada dia que o grupo passa acima da cota de pedra, uma vela "
      + "torta se apaga sozinha lá na capela — o Padre Zacarias sabe contar quantas, e é assim que "
      + "ele vai descobrir que alguém andou na serra.",
  },
  {
    id: ID.boca,
    type: "dungeon",
    x: 300,
    y: 200,
    name: "Boca do Dono",
    rumorLabel: "Uma fresta na pedra que respira",
    description:
      "Fenda estreita no alto da serra, larga o bastante para um homem de lado. Sopra ar morno com "
      + "cheiro de cinza molhada, e nenhuma pedra jogada lá dentro faz barulho de fundo.",
    gmNotes:
      "Aqui dorme o Dono do Escuro. Descer é possível; o que não é possível é descer sem que ele "
      + "note. A partir da terceira hora lá embaixo, todo teste de dormir falha automaticamente "
      + "pelo resto da campanha — e Firmina Aldravão, na vila, acorda gritando o nome de quem desceu.",
  },
  {
    id: ID.pouso,
    type: "camp",
    x: 740,
    y: 470,
    name: "Pouso dos Tropeiros Mudos",
    rumorLabel: "Um curral velho no pé da serra",
    description:
      "Curral de pedra seca e um telheiro caindo, no pé da serra, onde a tropa para antes da "
      + "subida. Ninguém fala alto: os tropeiros juram que a serra guarda voz e devolve depois.",
    gmNotes:
      "Quem dorme aqui recupera normalmente, mas rola um dado de encontro a mais. O telheiro tem "
      + "um alçapão com o diário do tropeiro Sinval, que anotou a data exata da Noite Sem Galo e o "
      + "nome de quem mandou apagar as velas: Herculana. Este é o caminho mais barato de entregar "
      + "o segredo da matriarca — só entregue quando a mesa merecer.",
  },
  {
    id: ID.capela,
    type: "poi",
    x: 930,
    y: 760,
    name: "Capela do Cemitério Velho",
    rumorLabel: "A capela que nunca apaga a luz",
    description:
      "Capela caiada no meio das covas, sede da Ordem das Velas Tortas. Trinta e sete irmãos "
      + "revezam a vigília para que a cera batida com gordura de defunto jamais deixe de arder.",
    gmNotes:
      "O Padre Zacarias Curió recebe bem qualquer um, e mente sobre três coisas: o número de "
      + "velas que restam (nove, não trinta), o que há debaixo da sacristia (a boca da vala dos "
      + "sem-nome) e o ódio dele por Herculana. Se o grupo se aliar à Ordem, ele pede a cabeça "
      + "dela como preço da ajuda.",
  },
  {
    id: ID.vila,
    type: "town",
    x: 1120,
    y: 830,
    name: "Vila Candeia",
    rumorLabel: "A vila das velas acesas",
    description:
      "Oitocentas almas de barro e cal na margem do Rio Ferrugem, acesas dia e noite por velas que "
      + "ninguém tem coragem de assoprar. É a porta do sertão e o único lugar com botica, ferreiro "
      + "e cama seca.",
    gmNotes:
      "Nó inicial recomendado. Dona Herculana Aldravão manda aqui e sabe que o grupo chegou antes "
      + "de o grupo largar a mochila. Firmina, a caçula cinzenta, procura os agentes na segunda "
      + "noite para dizer o que ouve debaixo do chão — e ela está certa. Se o grupo entregar "
      + "Firmina à mãe, a vila perde o único aviso que tem.",
  },
  {
    id: ID.rancho,
    type: "camp",
    x: 1330,
    y: 1120,
    name: "Rancho da Vela Acesa",
    rumorLabel: "Uma luz sozinha do lado do charco",
    description:
      "Rancho de taipa na borda do charco, com uma vela na janela que a viúva Sinhá Tomásia troca "
      + "toda madrugada. Quem chega antes do sol tem café; quem chega depois encontra a porta trancada.",
    gmNotes:
      "Acampamento seguro — o único do sul, e o Corta-Sono realmente não entra enquanto a vela "
      + "arder. Tomásia é irmã leiga da Ordem e passa recado para Zacarias sobre tudo que o grupo "
      + "fala à mesa dela. Se a vela apagar por descuido do grupo, o rancho vira encontro fixo com "
      + "o Corta-Sono na noite seguinte.",
  },
  {
    id: ID.passo,
    type: "quest",
    x: 1480,
    y: 700,
    name: "Passo da Cheia de Sangue",
    rumorLabel: "O vau onde o rio virou vermelho",
    description:
      "Vau de pedra chata onde o Ferrugem transbordou vermelho por três dias. O limo escuro nunca "
      + "saiu das paredes do barranco, e o cheiro de ferro pega na roupa de quem atravessa.",
    gmNotes:
      "Trinta e um mortos daquela cheia estão enterrados no barranco sem cova nem nome — é daqui "
      + "que a Ordem tira a gordura da cera, e é por isso que Zacarias insiste que o vau é "
      + "amaldiçoado e ninguém deve cavar. Cavar revela ossos com marca de facão, não de água.",
  },
  {
    id: ID.charco,
    type: "poi",
    x: 980,
    y: 1200,
    name: "Charco do Rebanho Murcho",
    rumorLabel: "O alagado onde o gado sem sombra pasta",
    description:
      "Léguas de água parada até a cintura, capim cortante e ilhas de mata que mudam de lugar na "
      + "cheia. É aqui que o Rebanho Murcho pasta ao meio-dia sem projetar nada no chão.",
    gmNotes:
      "Terreno difícil de verdade: cada travessia consome o dobro de suprimento. O rebanho é "
      + "inofensivo até alguém abater uma rês — aí todas viram a cabeça juntas, e o Corta-Sono "
      + "sabe onde o grupo está pelo resto da noite.",
  },
  {
    id: ID.cova,
    type: "secret",
    x: 700,
    y: 1330,
    name: "Cova do Corta-Sono",
    rumorLabel: "Onde o mato fecha e o bicho não canta",
    description:
      "Mata fechada no fundo do charco, onde as árvores crescem tortas para o mesmo lado. No meio "
      + "há um buraco forrado de terra fina, do tamanho exato de um homem magro deitado.",
    gmNotes:
      "É onde o Corta-Sono se recolhe de dia — e onde ele guarda o sono que rouba, em punhados de "
      + "terra com fio de cabelo. Queimar a cova mata a criatura, mas devolve a insônia inteira de "
      + "uma vez a quem estiver por perto: teste ou 1d4 dias sem dormir. Nunca revele este nó por "
      + "acidente; ele existe para premiar quem procurou.",
  },
  {
    id: ID.salinas,
    type: "town",
    x: 1830,
    y: 1080,
    name: "Salinas da Barra",
    rumorLabel: "As tábuas brancas perto do mar",
    description:
      "Tabuleiros de sal quadriculando a beira da barra, sede da Casa Sertório. Cheira a maresia e "
      + "a peixe curado, e todo mundo sorri demais para quem chega de fora.",
    gmNotes:
      "Rosalva Sertório recebe o grupo com honras e compra qualquer informação sobre os Aldravão "
      + "por peso de prata. Ela é casada com Bento e joga nos dois times — e sabe que o marido não "
      + "sabe o que a sogra fez. Se o grupo entregar o diário do Sinval aqui em vez de na vila, a "
      + "guerra entre as casas começa em três dias.",
  },
  {
    id: ID.forte,
    type: "town",
    x: 1980,
    y: 700,
    name: "Forte da Barra Negra",
    rumorLabel: "A pedra quadrada na foz",
    description:
      "Forte colonial de pedra na foz do Ferrugem, quarenta soldados e um canhão que ninguém viu "
      + "disparar. Guarda a barra por cima e cobra pedágio de tudo que desce o rio.",
    gmNotes:
      "Capitão Bento Aldravão comanda e é honesto — o que o torna útil e perigoso: se souber do "
      + "que a mãe fez, ele age, e a ação dele é prender Herculana em público. O forte é o único "
      + "lugar do mapa com cirurgião, pólvora e cama de verdade; use isso para puxar o grupo "
      + "de volta ao leste quando a mesa esfriar.",
  },
  {
    id: ID.celas,
    type: "dungeon",
    x: 2130,
    y: 850,
    name: "Celas Alagadas",
    rumorLabel: "O que o forte guarda por baixo",
    description:
      "Dois lances de escada abaixo da linha da maré, num corredor de celas que enche até o peito "
      + "duas vezes por dia. A água entra limpa e sai preta.",
    gmNotes:
      "Na cela do fundo está o primeiro Cinzento, preso desde a Noite Sem Galo, e ele fala pela "
      + "boca do Dono do Escuro quando a maré sobe. Bento não sabe quem é o preso — o registro "
      + "está no nome de Herculana. A escada só desce: com a maré cheia é impossível voltar por "
      + "ela, e a saída é pela grade do mar (trilha de mão única, de propósito).",
  },
];

/**
 * As dezesseis trilhas.
 *
 * `travelHours` e `dangerLevel` (1–5) seguem a geografia do desenho, não o gosto:
 * a estrada dos tropeiros é rápida e razoavelmente segura; o charco é lento e
 * perigoso; o que é subterrâneo e secreto é o pior dos dois mundos.
 */
const TRILHAS = [
  // ── Estrada dos Tropeiros Mudos: o eixo do mapa, do pé da serra até a foz ──
  { id: "padrao-trilha-1", de: ID.vila, para: ID.capela, horas: 0.5, perigo: 1,
    nota: "Caminho de cova: meia hora de vila, ladeado de vela acesa." },
  { id: "padrao-trilha-2", de: ID.vila, para: ID.pouso, horas: 9, perigo: 2,
    nota: "Estrada dos Tropeiros Mudos, trecho de subida. Boa em dia de sol, muda em noite de lua." },
  { id: "padrao-trilha-3", de: ID.pouso, para: ID.serra, horas: 7, perigo: 3,
    nota: "Ladeira de pedra solta. Tropa não sobe: daqui em diante é a pé." },
  { id: "padrao-trilha-4", de: ID.vila, para: ID.passo, horas: 5, perigo: 2,
    nota: "Margem firme do Ferrugem, com barranco alto do lado direito." },
  { id: "padrao-trilha-5", de: ID.passo, para: ID.forte, horas: 8, perigo: 2,
    nota: "Último trecho da estrada, já com cheiro de maresia." },
  { id: "padrao-trilha-6", de: ID.pouso, para: ID.passo, horas: 11, perigo: 3,
    nota: "Atalho pela margem alta que corta a vila fora. Mais curto no mapa, mais longo nas pernas." },

  // ── Sul: charco, mata e sal — devagar e caro ──────────────────────────────
  { id: "padrao-trilha-7", de: ID.vila, para: ID.rancho, horas: 4, perigo: 2,
    nota: "Carreiro de gado seco, ainda em terra firme." },
  { id: "padrao-trilha-8", de: ID.capela, para: ID.charco, horas: 8, perigo: 3,
    nota: "Descida pelo capinzal até a beira da água parada." },
  { id: "padrao-trilha-9", de: ID.vila, para: ID.charco, horas: 10, perigo: 4,
    nota: "Travessia do charco pela boca norte: água na cintura, capim que corta, sem ponto seco." },
  { id: "padrao-trilha-10", de: ID.charco, para: ID.rancho, horas: 9, perigo: 4,
    nota: "Ilhas de mata que mudam de lugar na cheia — o guia de ontem não serve hoje." },
  { id: "padrao-trilha-11", de: ID.rancho, para: ID.salinas, horas: 6, perigo: 2,
    nota: "Estrada do sal, batida por carro de boi e vigiada pela Casa Sertório." },
  { id: "padrao-trilha-12", de: ID.salinas, para: ID.forte, horas: 5, perigo: 1,
    nota: "Beira de praia dura, com o forte à vista o tempo todo." },

  // ── Secretas: o que só existe depois que alguém procura (AC-6, F4) ────────
  { id: "padrao-trilha-13", de: ID.serra, para: ID.boca, horas: 4, perigo: 5,
    secreta: true, teste: { skill: "Investigação", dc: 20 },
    nota: "Fenda atrás de uma laje que parece parede. Só quem procura a fresta certa acha a boca." },
  { id: "padrao-trilha-14", de: ID.charco, para: ID.cova, horas: 6, perigo: 5,
    secreta: true, teste: { skill: "Percepção", dc: 18 },
    nota: "Corredor de árvores tortas que só fica evidente quando se repara para onde elas apontam." },
  { id: "padrao-trilha-15", de: ID.capela, para: ID.cova, horas: 12, perigo: 4,
    secreta: true, teste: { skill: "Ocultismo", dc: 22 },
    nota: "A vala dos sem-nome, cavada pela Ordem debaixo da sacristia. Sai no meio da mata fechada." },

  // ── Mão única: desce fácil, sobe nunca ────────────────────────────────────
  { id: "padrao-trilha-16", de: ID.forte, para: ID.celas, horas: 0.5, perigo: 4, maoUnica: true,
    nota: "Escada de maré. Com a água subindo, a volta por ela é impossível — a saída é pela grade do mar." },
];

/** Metadados do molde. Sem `background`: a ilustração é o SVG embutido (AC-13). */
const molde = () => ({
  id: MAPA_PADRAO_ID,
  name: "Coroa de Cinzas — Sertão do Rio Ferrugem",
  description:
    "Mapa que já vem pronto no Nexus: o sertão alagado da Coroa de Cinzas, da Serra da Boca Seca "
    + "até a foz do Ferrugem. Doze lugares, dezesseis trilhas e três caminhos que só existem para "
    + "quem procura. Use como está, mexa à vontade ou tome de exemplo para o seu.",
  width: MAPA_PADRAO_LARGURA,
  height: MAPA_PADRAO_ALTURA,
  fogEnabled: true,
  defaultRevealRadius: RAIO,
  nodeCount: NOS.length,
  /* Ilustração vetorial: quem renderiza monta `<CartografiaPadrao />` em vez de
   * buscar imagem. Os quatro campos de fundo do documento ficam nulos. */
  ilustracao: "CartografiaPadrao",
  backgroundUrl: null,
  backgroundPath: null,
  backgroundRef: null,
  backgroundThumb: null,
  /* Onde o grupo começa quando o molde vira instância na mesa (AC-7). */
  startNodeId: ID.vila,
  /* Marca de origem: sobrevive ao clone e diz de onde aquele mapa do usuário veio. */
  origem: MAPA_PADRAO_ID,
  demo: true,
});

/**
 * O grafo autoral do mapa padrão (AC-13).
 *
 * Determinística e sem efeito colateral: cada chamada monta objetos novos a
 * partir das tabelas acima, então quem grava no Firestore pode carimbar
 * `createdAt`/`updatedAt` sem contaminar o seed da próxima chamada.
 *
 * @returns {{ mapa: object, nos: Array<object>, trilhas: Array<object> }}
 */
export function construirMapaPadrao() {
  const nos = NOS.map((n) => criarNo({
    id: n.id,
    name: n.name,
    rumorLabel: n.rumorLabel,
    description: n.description,
    gmNotes: n.gmNotes,
    type: n.type,
    x: n.x,
    y: n.y,
    revealRadius: RAIO,
  }));

  /* `gmNotes` na trilha é acréscimo do padrão sobre a forma de `criarTrilha` — o
   * design §3 não prevê o campo na aresta. Vai como NOTA DO MESTRE de propósito:
   * é a mesma palavra que a F4 já trata como veneno, e `gmNotes` nunca é copiado
   * para a projeção pública (AC-1). Se um dia a aresta ganhar campo público de
   * descrição, ele nasce com outro nome — este aqui é do mestre. */
  const trilhas = TRILHAS.map((t) => ({
    ...criarTrilha({
      id: t.id,
      fromNodeId: t.de,
      toNodeId: t.para,
      travelHours: t.horas,
      dangerLevel: t.perigo,
      isSecret: t.secreta === true,
      discoveryCheck: t.teste ? { ...t.teste } : null,
      isOneWay: t.maoUnica === true,
    }),
    gmNotes: t.nota,
  }));

  return { mapa: molde(), nos, trilhas };
}

/**
 * `true` quando o id é o do mapa padrão. A lista usa isto para desenhar o selo
 * "já vem no Nexus", esconder o botão de excluir e **não somar na cota**.
 *
 * @param {string} mapId id a testar.
 */
export function ehMapaPadrao(mapId) {
  return typeof mapId === "string" && mapId.trim() === MAPA_PADRAO_ID;
}

/**
 * Uma cópia do padrão pronta para virar mapa **do usuário** (cópia ao usar, AC-13).
 *
 * O que muda em relação a `construirMapaPadrao()`:
 *  · todos os ids são novos (`copia-no-1`, `copia-trilha-1`), e as trilhas já
 *    apontam para os ids novos — nada continua referenciando o padrão;
 *  · o `mapa` sai **sem** o id reservado (quem grava recebe o id do Firestore),
 *    mas mantém `origem: MAPA_PADRAO_ID` para se saber de onde veio;
 *  · o nome ganha sufixo de cópia, para não haver dois "Coroa de Cinzas" iguais
 *    na lista.
 *
 * Esta cópia **consome cota**: virou mapa do usuário, conta como um mapa dele.
 * Quem chama deve passar por `canCreateMap` antes de gravar.
 *
 * O `prefixo` existe para o caso de o mestre clonar mais de uma vez: passe algo
 * único (o id do mapa recém-criado, por exemplo) e as duas cópias não colidem
 * entre si. Sem ele, a função continua determinística — de propósito, para o
 * teste e para o cache.
 *
 * @param {{ prefixo?: string }} [opcoes]
 * @returns {{ mapa: object, nos: Array<object>, trilhas: Array<object> }}
 */
export function clonarMapaPadrao(opcoes = {}) {
  const bruto = typeof opcoes.prefixo === "string" ? opcoes.prefixo.trim() : "";
  const prefixo = bruto || PREFIXO_CLONE_PADRAO;

  const { mapa, nos, trilhas } = construirMapaPadrao();

  /* de-para do id antigo para o novo: as trilhas são reescritas por ele, então
   * nenhuma ponta pode sobrar apontando para `padrao-no-*`. */
  const dePara = new Map();
  const novosNos = nos.map((no, i) => {
    const novoId = `${prefixo}-no-${i + 1}`;
    dePara.set(no.id, novoId);
    return { ...no, id: novoId };
  });

  const novasTrilhas = trilhas.map((t, i) => ({
    ...t,
    id: `${prefixo}-trilha-${i + 1}`,
    fromNodeId: dePara.get(t.fromNodeId) || t.fromNodeId,
    toNodeId: dePara.get(t.toNodeId) || t.toNodeId,
    discoveryCheck: t.discoveryCheck ? { ...t.discoveryCheck } : t.discoveryCheck,
  }));

  /* O id reservado NÃO vai junto: quem grava recebe o id do Firestore. */
  const semId = { ...mapa };
  delete semId.id;

  return {
    mapa: {
      ...semId,
      name: `${mapa.name} (cópia)`,
      startNodeId: dePara.get(mapa.startNodeId) || null,
      demo: false,
    },
    nos: novosNos,
    trilhas: novasTrilhas,
  };
}
