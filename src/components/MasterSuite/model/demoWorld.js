/* Forja do Mestre — MUNDO DEMO (spec 0027, AC-7).
 *
 * Seed autoral de fantasia sombria brasileira: sertão alagado, casa-grande em decadência,
 * irmandade de coveiros e uma coisa antiga dormindo debaixo da serra. Conteúdo 100% inventado
 * pra esta spec — nenhum nome vem do WorldCraft nem de outra obra.
 *
 * Regras do seed (AC-7):
 *   · ids locais e ESTÁVEIS (`demo-<tipo>-<n>`), sem Date.now() e sem Math.random();
 *   · toda conexão passa por makeConnection — nada de autoligação nem ponta fantasma;
 *   · cobre os 11 tipos e as três categorias fortes (família, aliança, conflito), com laços de
 *     progenitor/parceria já prontos pra genealogia da Fase 6;
 *   · cada chamada devolve objetos NOVOS (o store carimba datas sem contaminar o seed).
 */

import { makeConnection } from "./connections";

/* ids numa tabela só — a lista de conexões fica legível e renomear é seguro */
const ID = {
  sono: "demo-conceito-1",
  cortaSono: "demo-criatura-1",
  rebanho: "demo-criatura-2",
  donoEscuro: "demo-divindade-1",
  noiteSemGalo: "demo-evento-1",
  cheiaDeSangue: "demo-evento-2",
  vela: "demo-item-1",
  facao: "demo-item-2",
  vila: "demo-local-1",
  serra: "demo-local-2",
  forte: "demo-local-3",
  aldravao: "demo-organizacao-1",
  sertorio: "demo-organizacao-2",
  ordem: "demo-organizacao-3",
  herculana: "demo-personagem-1",
  bento: "demo-personagem-2",
  rosalva: "demo-personagem-3",
  zacarias: "demo-personagem-4",
  firmina: "demo-personagem-5",
  cinzentos: "demo-raca-1",
  sessao1: "demo-resumo-1",
  estrada: "demo-rota-1",
};

const ent = (id, type, name, description, tags = [], attributes = {}) => ({
  id,
  type,
  name,
  description,
  tags: [...tags],
  attributes: { ...attributes },
  folderId: null,
});

const conn = (fromId, toId, relation) => makeConnection({ fromId, toId, relation });

/** @returns {{world:object, entities:Array, connections:Array}} seed determinístico e completo */
export function buildDemoWorld() {
  const world = {
    id: "demo-mundo-1",
    name: "Coroa de Cinzas",
    genre: "Fantasia sombria brasileira",
    description:
      "No sertão alagado do Rio Ferrugem o gado volta da serra sem sombra e as famílias queimam "
      + "vela de defunto pra segurar o que dorme debaixo da terra. Mundo de exemplo da Forja do "
      + "Mestre — mexa, quebre e reescreva à vontade.",
    demo: true,
  };

  const entities = [
    /* ── conceito ─────────────────────────────────────────────────────────── */
    ent(ID.sono, "concept", "O Sono",
      "O acordo silencioso que mantém o Dono do Escuro adormecido sob a serra: enquanto arder "
      + "vela torta em Vila Candeia, ele não abre os olhos.",
      ["pacto", "maldição"],
      { "Sustentado por": "Ordem das Velas Tortas", "Sinal de quebra": "galo que não canta" }),

    /* ── criaturas ────────────────────────────────────────────────────────── */
    ent(ID.cortaSono, "creature", "Corta-Sono",
      "Vulto magro de braços compridos que entra pela fresta e leva o sono das casas. Quem ele "
      + "visita acorda com terra debaixo da unha.",
      ["horror", "noite"],
      { Ameaça: "Alta", Fraqueza: "luz de vela torta" }),
    ent(ID.rebanho, "creature", "Rebanho Murcho",
      "O gado que subiu a serra e voltou sem sombra: anda, muge e come, mas não projeta nada no "
      + "chão do meio-dia.",
      ["presságio"],
      { Ameaça: "Baixa", Origem: "Serra da Boca Seca" }),

    /* ── divindade ────────────────────────────────────────────────────────── */
    ent(ID.donoEscuro, "deity", "O Dono do Escuro",
      "Coisa antiga que dorme sob a Serra da Boca Seca. Não pede oração, pede silêncio — e cobra "
      + "em cinza quando não recebe.",
      ["antigo", "maldição"],
      { Domínio: "Silêncio e cinza", Culto: "proibido em Vila Candeia" }),

    /* ── eventos ──────────────────────────────────────────────────────────── */
    ent(ID.noiteSemGalo, "event", "A Noite Sem Galo",
      "A madrugada em que nenhum galo cantou de Vila Candeia até a foz. O Sono rachou e, desde "
      + "então, cada família conta um parente a menos.",
      ["marco", "maldição"],
      { Quando: "há 19 invernos", Consequência: "o nascimento dos Cinzentos" }),
    ent(ID.cheiaDeSangue, "event", "A Cheia de Sangue",
      "O Rio Ferrugem transbordou vermelho por três dias, deixou limo escuro nas paredes e um "
      + "cheiro de ferro que não saiu mais da roupa.",
      ["marco", "rio"],
      { Quando: "há 4 invernos", Mortos: "trinta e um" }),

    /* ── itens ────────────────────────────────────────────────────────────── */
    ent(ID.vela, "item", "Vela Torta de Sete Pavios",
      "Cera batida com gordura de defunto e sete pavios trançados. Enquanto ela arde, o Dono do "
      + "Escuro continua deitado.",
      ["relíquia", "ritual"],
      { Raridade: "Única", Guarda: "Ordem das Velas Tortas" }),
    ent(ID.facao, "item", "Facão do Meio-Dia",
      "Lâmina de aço branco da Casa Aldravão, temperada ao meio-dia em água de salina. Corta "
      + "sombra como corta capim.",
      ["arma", "herança"],
      { Raridade: "Rara", Dono: "Capitão Bento Aldravão" }),

    /* ── locais ───────────────────────────────────────────────────────────── */
    ent(ID.vila, "location", "Vila Candeia",
      "Vila de barro e cal na beira do Rio Ferrugem, iluminada dia e noite por velas que ninguém "
      + "tem coragem de deixar apagar.",
      ["vila", "rio"],
      { População: "800 almas", Governo: "Casa Aldravão" }),
    ent(ID.serra, "location", "Serra da Boca Seca",
      "Serra de pedra escura onde o vento fala em nomes próprios e o gado que sobe volta "
      + "diferente — quando volta.",
      ["ermo", "perigo"],
      { Clima: "seco e sem bicho", Acesso: "Estrada dos Tropeiros Mudos" }),
    ent(ID.forte, "location", "Forte da Barra Negra",
      "Forte colonial de pedra na foz do Ferrugem. Guarda a barra do rio por cima e, por baixo, "
      + "guarda coisa pior nas celas alagadas.",
      ["fortaleza", "rio"],
      { Guarnição: "40 soldados", Comando: "Capitão Bento Aldravão" }),

    /* ── organizações ─────────────────────────────────────────────────────── */
    ent(ID.aldravao, "organization", "Casa Aldravão",
      "Família de tropeiros que virou senhora de terra à força de facão e casamento. Manda em "
      + "Vila Candeia desde a primeira cheia.",
      ["casa nobre", "poder"],
      { Lema: "O gado passa, a terra fica", Sede: "Vila Candeia" }),
    ent(ID.sertorio, "organization", "Casa Sertório",
      "Casa rival, dona das salinas e da estrada do sal. Educada na frente, venenosa nas costas.",
      ["casa nobre", "poder"],
      { Lema: "Tudo se conserva no sal", Sede: "Salinas da Barra" }),
    ent(ID.ordem, "organization", "Ordem das Velas Tortas",
      "Irmandade de rezadores e coveiros que fabrica a cera e mantém o Sono aceso. Perdoa "
      + "qualquer pecado, menos deixar a vela apagar.",
      ["ordem", "ritual"],
      { Membros: "37 irmãos", Sede: "Capela do Cemitério Velho" }),

    /* ── personagens ──────────────────────────────────────────────────────── */
    ent(ID.herculana, "character", "Dona Herculana Aldravão",
      "Matriarca da Casa Aldravão. Enterrou dois maridos, três filhos e nenhuma dívida. Foi ela "
      + "que mandou apagar as velas na Noite Sem Galo — e nunca disse por quê.",
      ["matriarca", "segredo"],
      { Idade: "71 anos", Papel: "Cabeça da Casa Aldravão" }),
    ent(ID.bento, "character", "Capitão Bento Aldravão",
      "Filho mais velho de Herculana e comandante do Forte da Barra Negra. Leal à mãe até o dia "
      + "em que descobrir o que ela fez.",
      ["militar", "herdeiro"],
      { Idade: "38 anos", Papel: "Comandante do forte" }),
    ent(ID.rosalva, "character", "Rosalva Sertório",
      "Herdeira das salinas e esposa de Bento. Casou pra fazer as pazes entre as casas e ficou "
      + "com um pé em cada trincheira.",
      ["nobre", "espiã"],
      { Idade: "34 anos", Papel: "Elo entre as casas" }),
    ent(ID.zacarias, "character", "Padre Zacarias Curió",
      "Rezador magro que lidera a Ordem das Velas Tortas. Cheira a cera e a cova. Culpa Herculana "
      + "pela racha do Sono e reza pra que ela pague antes de morrer.",
      ["rezador", "rival"],
      { Idade: "63 anos", Papel: "Guardião do Sono" }),
    ent(ID.firmina, "character", "Firmina Aldravão",
      "Caçula da Casa, nascida na Noite Sem Galo. Enxerga no escuro, dorme pouco e ouve o que "
      + "conversa debaixo do chão da vila.",
      ["cinzenta", "vidente"],
      { Idade: "19 anos", Papel: "Ouvido da vila" }),

    /* ── raça, rota e resumo de sessão ────────────────────────────────────── */
    ent(ID.cinzentos, "race", "Os Cinzentos",
      "Gente nascida na Noite Sem Galo: pele de cinza fina, sono curto e um ouvido a mais pro que "
      + "fala debaixo da terra.",
      ["povo", "maldição"],
      { População: "cerca de 40", Marca: "olhos sem branco" }),
    ent(ID.estrada, "route", "Estrada dos Tropeiros Mudos",
      "Trilha de gado que liga Vila Candeia à foz, passando pelo pé da serra. Quem fala alto nela "
      + "chega no fim falando sozinho.",
      ["estrada", "perigo"],
      { Extensão: "três dias de tropa", Risco: "alto à noite" }),
    ent(ID.sessao1, "sessionSummary", "Sessão 1 — O Sino Rachado",
      "Os agentes chegaram a Vila Candeia no enterro do sineiro, viram o sino rachar sozinho ao "
      + "meio-dia e ouviram o Corta-Sono raspando a janela da pensão a noite inteira.",
      ["sessão", "abertura"],
      { Data: "Sessão 1", Presentes: "toda a mesa" }),
  ];

  const connections = [
    /* família — a genealogia da Fase 6 já nasce desenhada */
    conn(ID.herculana, ID.bento, "parent"),
    conn(ID.herculana, ID.firmina, "parent"),
    conn(ID.bento, ID.firmina, "sibling"),
    conn(ID.bento, ID.rosalva, "partner"),

    /* aliança — quem manda em quem */
    conn(ID.herculana, ID.aldravao, "leader"),
    conn(ID.bento, ID.aldravao, "member"),
    conn(ID.bento, ID.forte, "leader"),
    conn(ID.rosalva, ID.sertorio, "member"),
    conn(ID.zacarias, ID.ordem, "leader"),
    conn(ID.firmina, ID.cinzentos, "member"),

    /* conflito — o que move a campanha */
    conn(ID.aldravao, ID.sertorio, "enemy"),
    conn(ID.zacarias, ID.herculana, "enemy"),

    /* geografia e sobrenatural */
    conn(ID.serra, ID.vila, "contains"),
    conn(ID.donoEscuro, ID.serra, "lives"),
    conn(ID.cortaSono, ID.serra, "lives"),
    conn(ID.cortaSono, ID.rebanho, "created"),
    conn(ID.ordem, ID.sono, "guards"),
    conn(ID.ordem, ID.vela, "owns"),
    conn(ID.bento, ID.facao, "owns"),
    conn(ID.estrada, ID.vila, "connects"),
    conn(ID.estrada, ID.forte, "connects"),

    /* história e mesa */
    conn(ID.noiteSemGalo, ID.vila, "happened"),
    conn(ID.cheiaDeSangue, ID.vila, "happened"),
    conn(ID.cortaSono, ID.noiteSemGalo, "participated"),
    conn(ID.cinzentos, ID.noiteSemGalo, "participated"),
    conn(ID.sessao1, ID.vila, "mentions"),
    conn(ID.sessao1, ID.cortaSono, "mentions"),
  ];

  return { world, entities, connections };
}
