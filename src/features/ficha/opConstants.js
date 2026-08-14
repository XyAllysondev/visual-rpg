/* Constantes de regra de Ordem Paranormal (origens, trilhas, habilidades, classes) e as
   listas do criador genérico de D&D 5e. Dados puros, sem JSX — vivem separados porque o
   criador de personagem e a ficha completa consomem os mesmos objetos. */

const ORIGENS = [
  { id:"academico",    name:"Acadêmico",              skills:["Ciências","Investigação"],      power:"Saber é Poder. Quando faz um teste usando Intelecto, pode gastar 2 PE para receber +5 nesse teste." },
  { id:"saude",        name:"Agente de Saúde",         skills:["Intuição","Medicina"],          power:"Técnica Medicinal. Sempre que cura um personagem, adiciona seu Intelecto no total de PV curados." },
  { id:"artista",      name:"Artista",                 skills:["Artes","Enganação"],            power:"Magnum Opus. Uma vez por missão, pode fazer um personagem te reconhecer, recebendo +5 em testes de Presença contra ele." },
  { id:"atleta",       name:"Atleta",                  skills:["Acrobacia","Atletismo"],        power:"110%. Quando faz um teste de perícia usando Força ou Agilidade (exceto Luta e Pontaria) pode gastar 2 PE para receber +5." },
  { id:"criminoso",    name:"Criminoso",               skills:["Crime","Furtividade"],          power:"O Crime Compensa. No final de uma missão, escolha um item encontrado. Na próxima missão, inclua-o no inventário sem contar no limite." },
  { id:"cultista",     name:"Cultista Arrependido",    skills:["Ocultismo","Religião"],         power:"Traços do Outro Lado. Você possui um poder paranormal à sua escolha. Porém, começa com metade da Sanidade normal." },
  { id:"desgarrado",   name:"Desgarrado",              skills:["Fortitude","Sobrevivência"],    power:"Calejado. Você recebe +1 PV para cada 5% de NEX." },
  { id:"engenheiro",   name:"Engenheiro",              skills:["Profissão","Tecnologia"],       power:"Ferramenta Favorita. Um item à sua escolha (exceto armas) conta como uma categoria abaixo." },
  { id:"executivo",    name:"Executivo",               skills:["Diplomacia","Profissão"],       power:"Processo Otimizado. Em testes estendidos ou para revisar documentos, pode gastar 2 PE para receber +5." },
  { id:"investigador", name:"Investigador",            skills:["Investigação","Percepção"],     power:"Faro para Pistas. Uma vez por cena, quando procurar pistas, pode gastar 1 PE para receber +5 no teste." },
  { id:"lutador",      name:"Lutador",                 skills:["Luta","Reflexos"],              power:"Mão Pesada. Você recebe +2 em rolagens de dano com ataques corpo a corpo." },
  { id:"magnata",      name:"Magnata",                 skills:["Diplomacia","Pilotagem"],       power:"Patrocinador da Ordem. Seu limite de crédito é sempre considerado um acima do atual." },
  { id:"mercenario",   name:"Mercenário",              skills:["Iniciativa","Intimidação"],     power:"Posição de Combate. No primeiro turno de cada cena de ação, pode gastar 2 PE para receber uma ação de movimento adicional." },
  { id:"militar",      name:"Militar",                 skills:["Pontaria","Tática"],            power:"Para Bellum. Você recebe +2 em rolagens de dano com armas de fogo." },
  { id:"policial",     name:"Policial",                skills:["Percepção","Pontaria"],         power:"Patrulha. Você recebe +2 em Defesa." },
  { id:"religioso",    name:"Religioso",               skills:["Religião","Vontade"],           power:"Acalentar. Recebe +5 em testes de Religião para acalmar. Quando acalma uma pessoa, ela recebe 1d6 + Presença de SAN." },
  { id:"servidor",     name:"Servidor Público",        skills:["Intuição","Vontade"],           power:"Espírito Cívico. Sempre que faz um teste para ajudar, pode gastar 1 PE para aumentar o bônus concedido em +2." },
  { id:"ti",           name:"T.I.",                    skills:["Investigação","Tecnologia"],    power:"Motor de Busca. Com acesso à internet, pode gastar 2 PE para substituir qualquer perícia por um teste de Tecnologia." },
  { id:"universitario",name:"Universitário",           skills:["Atualidades","Investigação"],  power:"Dedicação. Recebe +1 PE, mais 1 PE a cada NEX ímpar. Seu limite de PE por turno aumenta em 1." },
  { id:"vitima",       name:"Vítima",                  skills:["Reflexos","Vontade"],           power:"Cicatrizes Psicológicas. Você recebe +1 de Sanidade para cada 5% de NEX." },
  { id:"amnésico",     name:"Amnésico",                skills:["À escolha","À escolha"],        power:"Vislumbres do Passado. Uma vez por sessão, teste de Intelecto (DT 10) para reconhecer pessoas/lugares. Se passar, recebe 1d4 PE temporários." },
  { id:"chef",         name:"Chef",                    skills:["Fortitude","Profissão"],         power:"Ingrediente Secreto. Uma vez por missão, durante uma ação de interlúdio, prepare uma refeição especial. Todos que comerem recebem 1d6 + Presença de PV temporários que duram até o início da próxima cena de ação." },
  { id:"operario",     name:"Operário",                skills:["Atletismo","Profissão"],          power:"Mão na Massa. Você reduz em 2 horas o tempo necessário para trabalhar em tarefas manuais e recebe +2 em testes de perícia para construir, reparar ou modificar objetos." },
  { id:"teorico",      name:"Teórico da Conspiração",  skills:["Investigação","Ocultismo"],       power:"Eu Já Sabia. Você não se abala tanto com entidades ou anomalias. Afinal, sempre soube que isso tudo existia. Você recebe resistência a dano mental igual ao seu Intelecto." },
  { id:"rural",        name:"Trabalhador Rural",        skills:["Adestramento","Sobrevivência"],   power:"Desbravador. Quando faz um teste de Adestramento, Atletismo ou Sobrevivência em terrenos abertos, pode gastar 1 PE para receber +5 nesse teste." },
];

/* ── Ordem Paranormal: Trilhas por classe ── */
const CLASS_TRAILS = {
  combatente:  [{id:"atirador_c",name:"Atirador"},{id:"chefe",name:"Chefe"},{id:"guerreiro",name:"Guerreiro"}],
  especialista:[{id:"atirador_e",name:"Atirador de Elite"},{id:"medico",name:"Médico de Campo"},{id:"negociador",name:"Negociador"}],
  ocultista:   [{id:"iluminado",name:"Iluminado"},{id:"graduado",name:"Graduado"},{id:"intuitivo",name:"Intuitivo"}],
};

/* ── Habilidades de Trilha ── */
const TRAIL_ABILITIES = {
  atirador_c:{
    10:{name:"Tiro Preciso",     cost:"—",          desc:"Você ignora bônus de cobertura em seus ataques com armas de disparo e pode atacar além do alcance normal sem penalidade."},
    40:{name:"Ponto Fraco",      cost:"2 PE",        desc:"Uma vez por rodada, ao acertar com arma de disparo, gaste 2 PE para causar dano adicional igual ao seu valor de Agilidade."},
    65:{name:"Tiro Mortal",      cost:"—",           desc:"Seus ataques com armas de disparo ignoram resistência a dano físico dos alvos."},
    99:{name:"Bala de Prata",    cost:"5 PE",        desc:"Uma vez por cena, faça um ataque com arma de disparo com vantagem. Se acertar, causa o dano máximo possível."},
  },
  chefe:{
    10:{name:"Inspirar Confiança",cost:"2 PE (reação)",desc:"Faça um aliado em alcance curto rolar novamente um teste recém realizado."},
    40:{name:"Estrategista",      cost:"1 PE/aliado", desc:"Use uma ação padrão para direcionar aliados (limitado pelo INT). No próximo turno deles, ganham uma ação de movimento adicional."},
    65:{name:"Brecha na Guarda",  cost:"2 PE (reação)",desc:"Quando um aliado causar dano em um inimigo no alcance curto, você ou outro aliado pode fazer um ataque adicional contra o mesmo inimigo."},
    99:{name:"Oficial Comandante",cost:"5 PE",        desc:"Cada aliado em alcance médio recebe uma ação padrão adicional no próximo turno."},
  },
  guerreiro:{
    10:{name:"Técnica Letal",   cost:"—",           desc:"+2 na margem de ameaça com todos os ataques corpo a corpo."},
    40:{name:"Revidar",         cost:"2 PE (reação)",desc:"Sempre que bloquear um ataque, faça um ataque corpo a corpo no inimigo que o atacou."},
    65:{name:"Força Opressora", cost:"1 PE",         desc:"Quando acerta um ataque corpo a corpo, realize uma manobra derrubar ou empurrar como ação livre."},
    99:{name:"Potência Máxima", cost:"—",            desc:"Quando usa Ataque Especial com armas corpo a corpo, todos os dados de dano são considerados o resultado máximo."},
  },
  atirador_e:{
    10:{name:"Foco Total",       cost:"—",     desc:"Quando usa a ação mirar, você recebe +5 no teste de ataque e +1d6 na rolagem de dano."},
    40:{name:"Execução",         cost:"—",     desc:"Se um alvo está inconsciente ou não sabe que você está lá, seu ataque causa dano máximo."},
    65:{name:"Tiro Perfurante",  cost:"—",     desc:"Seus ataques com armas de fogo podem atingir todos os alvos em linha reta no alcance da arma."},
    99:{name:"Sniper Lendário",  cost:"5 PE",  desc:"Uma vez por cena, faça um ataque que ignora todos os bônus de Defesa, resistência e cobertura do alvo."},
  },
  medico:{
    10:{name:"Paramédico",      cost:"2 PE",   desc:"Use uma ação padrão e 2 PE para curar 2d10 PV de si mesmo ou de um aliado adjacente. Em NEX 40%, 65% e 99%, cura +1d10 PV por +1 PE."},
    40:{name:"Equipe de Trauma",cost:"2 PE",   desc:"Use uma ação padrão e 2 PE para remover uma condição negativa (exceto morrendo) de um aliado adjacente."},
    65:{name:"Resgate",         cost:"—",      desc:"Uma vez por rodada, se em alcance curto de aliado machucado ou morrendo, aproxime-se como ação livre. Ao curar, você e o aliado recebem +5 na Defesa até o próximo turno."},
    99:{name:"Reanimação",      cost:"10 PE",  desc:"Uma vez por cena, gaste uma ação completa e 10 PE para trazer de volta à vida um personagem que morreu na mesma cena (exceto dano massivo)."},
  },
  negociador:{
    10:{name:"Eloquência",          cost:"1 PE/alvo",desc:"Use uma ação completa e 1 PE por alvo para afetá-los com sua fala. Faça Diplomacia, Enganação ou Intimidação contra a Vontade deles."},
    40:{name:"Persuasão Profunda",  cost:"—",       desc:"Quando usa Eloquência e vence por 10 ou mais, o alvo fica sob efeito por toda a cena."},
    65:{name:"Psicologia Aplicada", cost:"3 PE",    desc:"Uma vez por cena, teste de Intuição (DT 15) para descobrir uma fraqueza ou motivação. Receba +5 em testes de Presença contra esse personagem."},
    99:{name:"Mestre das Palavras", cost:"—",       desc:"Você pode usar Eloquência como ação padrão. Aliados em alcance curto recebem +5 em testes de Presença."},
  },
  iluminado:{
    10:{name:"Canalizar Energia", cost:"1 PE",    desc:"Gaste uma ação padrão e 1 PE para canalizar energia paranormal, recebendo PE temporários igual ao círculo do ritual utilizado."},
    40:{name:"Toque do Outro Lado",cost:"+2 PE",  desc:"Ao lançar um ritual, gaste 2 PE extras para aumentar seu efeito em 50% (dano, cura, duração ou área)."},
    65:{name:"Transcender a Dor", cost:"1 PE/5dmg",desc:"Quando recebe dano, pode gastar 1 PE por 5 pontos de dano para convertê-lo de PV para Sanidade."},
    99:{name:"Medo Tangível",     cost:"—",       desc:"Você aprende o ritual Medo Tangível."},
  },
  graduado:{
    10:{name:"Saber Ampliado",       cost:"—", desc:"Aprenda um ritual de 1° círculo adicional. Toda vez que ganha acesso a um novo círculo, aprende um ritual adicional daquele círculo."},
    40:{name:"Grimório Ritualístico", cost:"—", desc:"Crie um grimório especial. Aprenda rituais de 1° ou 2° círculos iguais ao seu INT. O grimório ocupa 1 espaço no inventário."},
    65:{name:"Rituais Eficientes",    cost:"—", desc:"A DT para resistir a todos os seus rituais aumenta em +5."},
    99:{name:"Conhecendo o Medo",     cost:"—", desc:"Você aprende o ritual Conhecendo o Medo."},
  },
  intuitivo:{
    10:{name:"Mente Sã",       cost:"—",    desc:"Você recebe resistência paranormal +5 (+5 em testes de resistência contra efeitos paranormais)."},
    40:{name:"Barreira Mental", cost:"—",   desc:"Quando passa em um teste de resistência contra efeito paranormal, recupera 1d6 de Sanidade."},
    65:{name:"Vontade de Ferro",cost:"2 PE",desc:"Role novamente um teste de resistência contra efeito paranormal. Seu valor máximo de Sanidade aumenta em 10."},
    99:{name:"Além do Alcance", cost:"—",  desc:"Imune a efeitos de medo paranormal e sua Sanidade não pode ser reduzida abaixo de 1 por efeitos paranormais."},
  },
};

/* ── Habilidades Base por Classe (excluindo trilha) ── */
const CLASS_BASE_ABILITIES = {
  combatente:[
    {nex:5,  name:"Ataque Especial",    cost:"2 PE",  desc:"Quando faz um ataque, gaste 2 PE para receber +5 no teste de ataque ou na rolagem de dano."},
    {nex:10, name:"Habilidade de Trilha",cost:"—",   desc:"Escolha uma trilha de Combatente e receba seu 1° poder."},
    {nex:15, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:20, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo à sua escolha em +1 (máximo 5)."},
    {nex:25, name:"Ataque Especial ↑",  cost:"3 PE", desc:"Gaste 3 PE para receber +10 (em bônus de +5) no ataque ou dano."},
    {nex:30, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:35, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; seu grau de treinamento nelas aumenta em um."},
    {nex:40, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 2° poder da sua trilha de Combatente."},
    {nex:45, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:50, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:50, name:"Versatilidade",      cost:"—",    desc:"Escolha um poder de combatente ou o 1° poder de uma trilha que não a sua."},
    {nex:55, name:"Ataque Especial ↑",  cost:"4 PE", desc:"Gaste 4 PE para receber +15 no ataque ou dano."},
    {nex:60, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:65, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 3° poder da sua trilha de Combatente."},
    {nex:70, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:75, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:80, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:85, name:"Ataque Especial ↑",  cost:"5 PE", desc:"Gaste 5 PE para receber +20 no ataque ou dano."},
    {nex:90, name:"Poder de Combatente",cost:"—",    desc:"Escolha um poder de combatente da lista."},
    {nex:95, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:99, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 4° e último poder da sua trilha de Combatente."},
  ],
  especialista:[
    {nex:5,  name:"Eclético",           cost:"2 PE",  desc:"Gaste 2 PE para receber os benefícios de ser treinado em qualquer perícia usada."},
    {nex:5,  name:"Perito (1d6)",       cost:"2 PE",  desc:"Escolha duas perícias treinadas. Gaste 2 PE para somar +1d6 no resultado do teste."},
    {nex:10, name:"Habilidade de Trilha",cost:"—",   desc:"Escolha uma trilha de Especialista e receba seu 1° poder."},
    {nex:15, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:20, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:25, name:"Perito (1d8)",       cost:"3 PE",  desc:"Gaste 3 PE para somar +1d8 no resultado do teste."},
    {nex:30, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:35, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:40, name:"Engenhosidade",      cost:"+2 PE", desc:"Ao usar Eclético, gaste +2 PE adicionais para receber os benefícios de veterano na perícia."},
    {nex:40, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 2° poder da sua trilha de Especialista."},
    {nex:45, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:50, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:50, name:"Versatilidade",      cost:"—",    desc:"Escolha um poder de especialista ou o 1° poder de uma trilha que não a sua."},
    {nex:55, name:"Perito (1d10)",      cost:"4 PE",  desc:"Gaste 4 PE para somar +1d10 no resultado do teste."},
    {nex:60, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:65, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 3° poder da sua trilha de Especialista."},
    {nex:70, name:"Grau de Treinamento",cost:"—",    desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:75, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:75, name:"Engenhosidade Avançada",cost:"+4 PE",desc:"Ao usar Eclético, gaste +4 PE adicionais para receber benefícios de expert na perícia."},
    {nex:80, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:85, name:"Perito (1d12)",      cost:"5 PE",  desc:"Gaste 5 PE para somar +1d12 no resultado do teste."},
    {nex:90, name:"Poder de Especialista",cost:"—",  desc:"Escolha um poder de especialista da lista."},
    {nex:95, name:"Aumento de Atributo",cost:"—",    desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:99, name:"Habilidade de Trilha",cost:"—",  desc:"Receba o 4° e último poder da sua trilha de Especialista."},
  ],
  ocultista:[
    {nex:5,  name:"Escolhido pelo Outro Lado",cost:"—", desc:"Lança rituais de 1° círculo. Começa com 3 rituais de 1° círculo. Aprende 1 ritual adicional a cada NEX."},
    {nex:10, name:"Habilidade de Trilha",     cost:"—", desc:"Escolha uma trilha de Ocultista e receba seu 1° poder."},
    {nex:15, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:20, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:25, name:"Rituais de 2° Círculo",    cost:"—", desc:"Você agora pode lançar rituais de 2° círculo."},
    {nex:30, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:35, name:"Grau de Treinamento",      cost:"—", desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:40, name:"Habilidade de Trilha",     cost:"—", desc:"Receba o 2° poder da sua trilha de Ocultista."},
    {nex:45, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:50, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:50, name:"Versatilidade",            cost:"—", desc:"Escolha um poder de ocultista ou o 1° poder de uma trilha que não a sua."},
    {nex:55, name:"Rituais de 3° Círculo",    cost:"—", desc:"Você agora pode lançar rituais de 3° círculo."},
    {nex:60, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:65, name:"Habilidade de Trilha",     cost:"—", desc:"Receba o 3° poder da sua trilha de Ocultista."},
    {nex:70, name:"Grau de Treinamento",      cost:"—", desc:"Escolha (5+INT) perícias treinadas; grau de treinamento aumenta em um."},
    {nex:75, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:80, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:85, name:"Rituais de 4° Círculo",    cost:"—", desc:"Você agora pode lançar rituais de 4° círculo."},
    {nex:90, name:"Poder de Ocultista",       cost:"—", desc:"Escolha um poder de ocultista da lista."},
    {nex:95, name:"Aumento de Atributo",      cost:"—", desc:"Aumente um atributo em +1 (máximo 5)."},
    {nex:99, name:"Habilidade de Trilha",     cost:"—", desc:"Receba o 4° e último poder da sua trilha de Ocultista."},
  ],
};

const CLASSES = [
  {
    id:"combatente", name:"Combatente", icon:"⚔️",
    desc:"Treinado para lutar com todo tipo de armas, e com a força e a coragem para encarar os perigos de frente.",
    detail:"Do mercenário especialista em armas de fogo até o perito em espadas, combatentes apresentam uma gama enorme de habilidades e técnicas especiais que aprimoram sua eficiência no campo de batalha.",
    bonus:"PV +4 · Ataque +2 · Resistência Física",
  },
  {
    id:"especialista", name:"Especialista", icon:"🔬",
    desc:"Um agente que confia mais em esperteza do que em força bruta. Se vale de conhecimento técnico e raciocínio rápido.",
    detail:"Cientistas, inventores, pesquisadores e técnicos de vários tipos são exemplos de especialistas, tão variados quanto as áreas do conhecimento e da tecnologia.",
    bonus:"PE +4 · Perícia +2 · Conhecimento Amplo",
  },
  {
    id:"ocultista", name:"Ocultista", icon:"🌀",
    desc:"O Outro Lado é misterioso, perigoso e, de certa forma, cativante. Possui talento para se conectar com elementos paranormais.",
    detail:"Ao contrário da crença popular, ocultistas não são intrinsecamente malignos. São agentes que buscam compreender e dominar os mistérios paranormais para usá-los contra o próprio Outro Lado.",
    bonus:"SAN +4 · Rituais +2 · Afinidade Paranormal",
  },
];

/* ── D&D 5e / generic character creator ─────────────────────────────── */
const DND_CLASSES = ["Bárbaro","Bardo","Bruxo","Clérigo","Druida","Feiticeiro","Guerreiro","Ladino","Mago","Monge","Paladino","Patrulheiro"];
const DND_RACES   = ["Anão","Elfo","Halfling","Humano","Draconato","Gnomo","Meio-Elfo","Meio-Orc","Tiefling"];
const DND_THEMES  = { Bárbaro:"#e53935",Bardo:"#ab47bc",Bruxo:"#7e57c2",Clérigo:"#f9a825",Druida:"#43a047",Feiticeiro:"#ef6c00",Guerreiro:"#1976d2",Ladino:"#546e7a",Mago:"#5c6bc0",Monge:"#00838f",Paladino:"#f57f17",Patrulheiro:"#2e7d32" };

/* ── NEX progression (Ordem Paranormal 2ª Ed.) ── */
const NEX_STEPS = [5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,99];

export { ORIGENS, CLASS_TRAILS, TRAIL_ABILITIES, CLASS_BASE_ABILITIES, CLASSES, DND_CLASSES, DND_RACES, DND_THEMES, NEX_STEPS };
