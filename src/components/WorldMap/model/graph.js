/**
 * Mapa-Múndi — O GRAFO (spec 0028, AC-4 · F2).
 *
 * Nós e trilhas do **molde** (o mapa autoral do mestre, em
 * `users/{uid}/worldmaps/{mapId}` — design §3). Lógica pura: sem React, sem
 * Firebase, sem DOM, sem `Math.random()` nem `Date.now()`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOBRE OS NOMES DOS CAMPOS DA TRILHA — leia antes de mexer
 *
 * O documento persistido usa `fromNodeId`/`toNodeId` (design §3), e é isso que
 * `criarTrilha` devolve. Mas a UI e boa parte do código falam `fromId`/`toId`,
 * que é mais curto. Em vez de escolher um e quebrar o outro, este módulo:
 *
 *   · **aceita os dois** na entrada de `criarTrilha`;
 *   · **grava sempre** o par canônico `fromNodeId`/`toNodeId`;
 *   · **lê os dois** em toda função de consulta, via `pontasDaTrilha`.
 *
 * Ou seja: nunca leia `trilha.fromNodeId` na mão — chame `pontasDaTrilha`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SOBRE IDS: nada aqui inventa id. `criarNo`/`criarTrilha` devolvem `id: null`
 * quando o chamador não passa um. Quem batiza é o Firestore (`addDoc` devolve o
 * id do documento) ou o seed do mapa padrão, que precisa de ids fixos. É o que
 * mantém o módulo determinístico e testável.
 *
 * Gate: `__tests__/graph.test.js`.
 */

import { distanciaAteCurva, pontosDaCurva } from "./curves";

/**
 * Os seis tipos de nó do briefing (§5). `color` é a cor de referência do ícone
 * — o mestre pode sobrescrever por nó. `hint` é a explicação de uma linha que
 * aparece ao escolher o tipo.
 */
export const NODE_TYPES = [
  {
    id: "town",
    label: "Cidade",
    color: "#e0b34a",
    hint: "Assentamento com gente, comércio e descanso seguro.",
  },
  {
    id: "dungeon",
    label: "Masmorra",
    color: "#c0453c",
    hint: "Perigo concentrado: ruínas, covis e o que dorme lá dentro.",
  },
  {
    id: "poi",
    label: "Ponto de interesse",
    color: "#5aa9c9",
    hint: "Marco do cenário — ruína, santuário, monumento, curiosidade.",
  },
  {
    id: "camp",
    label: "Acampamento",
    color: "#7fb069",
    hint: "Parada de descanso no caminho, sem muros nem garantias.",
  },
  {
    id: "quest",
    label: "Missão",
    color: "#c77dbb",
    hint: "Onde uma trama do grupo acontece ou espera para acontecer.",
  },
  {
    id: "secret",
    label: "Segredo",
    color: "#8a7ad6",
    hint: "Só existe para o mestre até ser descoberto ou revelado.",
  },
];

/**
 * Tipo assumido quando não dá para saber qual é. `poi` é o neutro: não promete
 * cidade nem ameaça masmorra.
 */
export const TIPO_PADRAO = "poi";

/** Nome de um nó recém-plantado, antes de o mestre batizá-lo. */
export const NOME_PADRAO_DO_NO = "Novo local";

/** Raio padrão de acerto ao clicar num nó, em unidades de mundo. */
export const RAIO_DE_TOQUE_PADRAO = 18;

/** Tolerância padrão ao clicar numa trilha, em unidades de mundo. */
export const TOLERANCIA_DA_TRILHA_PADRAO = 8;

const ehNumero = (n) => Number.isFinite(n);
const ehPonto = (p) => !!p && typeof p === "object" && ehNumero(p.x) && ehNumero(p.y);
const listaDe = (v) => (Array.isArray(v) ? v : []);
const idValido = (v) => typeof v === "string" && v.trim() !== "";

/**
 * O tipo de nó pelo id, sempre com fallback seguro — id desconhecido, vazio,
 * nulo ou de outro tipo cai em `TIPO_PADRAO`. Devolve **cópia**: mexer no
 * resultado não corrompe a tabela.
 *
 * @param {string} id
 * @returns {{id:string,label:string,color:string,hint:string}}
 */
export function getNodeType(id) {
  const achado = NODE_TYPES.find((t) => t.id === id);
  const tipo = achado || NODE_TYPES.find((t) => t.id === TIPO_PADRAO) || NODE_TYPES[0];
  return { ...tipo };
}

/** `true` se o id é um dos seis tipos conhecidos. */
export function tipoConhecido(id) {
  return NODE_TYPES.some((t) => t.id === id);
}

/**
 * Normaliza um grafo: `{ nos, trilhas }` com arrays garantidos.
 * @param {{nos?:Array,trilhas?:Array}} [grafo]
 * @returns {{nos:Array,trilhas:Array}}
 */
export function criarGrafo(grafo) {
  return { nos: listaDe(grafo?.nos), trilhas: listaDe(grafo?.trilhas) };
}

/**
 * Um nó do molde. Campos conforme o design §3.
 *
 * @param {object} dados `{ id?, x, y, type?, name?, ... }`
 * @returns {object} nó novo (nunca a referência de entrada).
 * @throws {Error} mensagem em PT-BR quando falta o essencial.
 */
export function criarNo(dados) {
  if (!dados || typeof dados !== "object") {
    throw new Error("Não dá para criar um nó sem os dados dele.");
  }
  const { id = null, x, y, type, name, color } = dados;

  if (!ehNumero(x) || !ehNumero(y)) {
    throw new Error("O nó precisa de coordenadas x e y numéricas.");
  }
  if (type != null && !tipoConhecido(type)) {
    throw new Error(`Tipo de nó desconhecido: "${type}".`);
  }
  if (name != null && typeof name !== "string") {
    throw new Error("O nome do nó precisa ser um texto.");
  }

  const tipo = type == null ? TIPO_PADRAO : type;
  const nome = name == null || name.trim() === "" ? NOME_PADRAO_DO_NO : name;

  return {
    id: idValido(id) ? id : null,
    x,
    y,
    type: tipo,
    name: nome,
    color: typeof color === "string" && color ? color : getNodeType(tipo).color,
    icon: dados.icon ?? null,
    rumorLabel: dados.rumorLabel ?? "",
    description: dados.description ?? "",
    gmNotes: dados.gmNotes ?? "",
    linkedSceneId: dados.linkedSceneId ?? null,
    revealRadius: ehNumero(dados.revealRadius) ? dados.revealRadius : null,
    isFastTravel: !!dados.isFastTravel,
  };
}

/**
 * As duas pontas de uma trilha, aceitando os dois pares de nomes (ver o
 * cabeçalho deste arquivo).
 * @returns {[string|null, string|null]}
 */
export function pontasDaTrilha(trilha) {
  if (!trilha || typeof trilha !== "object") return [null, null];
  const de = trilha.fromNodeId ?? trilha.fromId ?? null;
  const para = trilha.toNodeId ?? trilha.toId ?? null;
  return [de ?? null, para ?? null];
}

/**
 * Uma trilha do molde. Campos conforme o design §3.
 *
 * `pathPoints` são **pontos de controle** da curva (ver `curves.js`), não a
 * polilinha inteira — a polilinha se recalcula a cada render a partir das
 * posições vivas dos nós, então mover um nó arrasta a trilha junto.
 *
 * @param {object} dados `{ id?, fromId|fromNodeId, toId|toNodeId, ... }`
 * @returns {object} trilha nova, sempre com `fromNodeId`/`toNodeId`.
 * @throws {Error} mensagem em PT-BR: ids faltando, autoligação, horas inválidas.
 */
export function criarTrilha(dados) {
  if (!dados || typeof dados !== "object") {
    throw new Error("Não dá para criar uma trilha sem os dados dela.");
  }
  const [de, para] = pontasDaTrilha(dados);

  if (!idValido(de) || !idValido(para)) {
    throw new Error("A trilha precisa de um nó de origem e um nó de destino.");
  }
  if (de === para) {
    throw new Error("Uma trilha não pode ligar um nó a ele mesmo.");
  }

  const horas = dados.travelHours == null ? 1 : dados.travelHours;
  if (!ehNumero(horas) || horas < 0) {
    throw new Error("As horas de viagem precisam ser um número maior ou igual a zero.");
  }

  const pathPoints = dados.pathPoints == null ? [] : dados.pathPoints;
  if (!Array.isArray(pathPoints) || !pathPoints.every(ehPonto)) {
    throw new Error("Os pontos de controle da trilha precisam ser uma lista de { x, y } numéricos.");
  }

  const perigo = dados.dangerLevel == null ? 0 : dados.dangerLevel;
  if (!ehNumero(perigo) || perigo < 0) {
    throw new Error("O nível de perigo da trilha precisa ser um número maior ou igual a zero.");
  }

  return {
    id: idValido(dados.id) ? dados.id : null,
    fromNodeId: de,
    toNodeId: para,
    pathPoints: pathPoints.map((p) => ({ x: p.x, y: p.y })),
    travelHours: horas,
    isSecret: !!dados.isSecret,
    discoveryCheck: dados.discoveryCheck ?? null,
    isOneWay: !!dados.isOneWay,
    dangerLevel: perigo,
  };
}

/**
 * Já existe trilha ligando essa mesma dupla, em qualquer sentido?
 *
 * Uma trilha com o mesmo `id` da candidata é ignorada — senão reavaliar uma
 * trilha existente a acusaria de duplicar a si mesma.
 *
 * @param {Array} trilhas
 * @param {object} candidata objeto com as duas pontas (e opcionalmente `id`).
 * @returns {boolean}
 */
export function trilhaDuplicada(trilhas, candidata) {
  const [de, para] = pontasDaTrilha(candidata);
  if (!idValido(de) || !idValido(para)) return false;
  const mesmoId = candidata && idValido(candidata.id) ? candidata.id : null;

  return listaDe(trilhas).some((t) => {
    if (mesmoId && t?.id === mesmoId) return false;
    const [a, b] = pontasDaTrilha(t);
    return (a === de && b === para) || (a === para && b === de);
  });
}

/**
 * Trilhas incidentes num nó, com o nó do outro lado já resolvido.
 *
 * Devolve **todas** as trilhas que tocam o nó, inclusive as `isOneWay` que
 * chegam nele e as `isSecret`. Direção e segredo são regra de jogo (F4/F5),
 * não de topologia — filtrar aqui esconderia a trilha do próprio mestre no
 * ateliê.
 *
 * @param {{nos:Array,trilhas:Array}} grafo
 * @param {string} noId
 * @returns {Array<{trilha:object, outroId:string}>}
 */
export function vizinhos(grafo, noId) {
  if (!idValido(noId)) return [];
  return listaDe(grafo?.trilhas).reduce((acc, trilha) => {
    const [de, para] = pontasDaTrilha(trilha);
    if (de === noId) acc.push({ trilha, outroId: para });
    else if (para === noId) acc.push({ trilha, outroId: de });
    return acc;
  }, []);
}

/**
 * Hit-test de nó: o mais próximo do ponto dentro do raio, ou `null`.
 *
 * @param {Array} nos
 * @param {{x:number,y:number}} ponto em coordenadas de **mundo**.
 * @param {number} [raio=RAIO_DE_TOQUE_PADRAO]
 * @returns {object|null}
 */
export function noEmPonto(nos, ponto, raio = RAIO_DE_TOQUE_PADRAO) {
  if (!ehPonto(ponto)) return null;
  const r = ehNumero(raio) && raio >= 0 ? raio : RAIO_DE_TOQUE_PADRAO;

  let melhor = null;
  let menor = Infinity;
  listaDe(nos).forEach((no) => {
    if (!ehPonto(no)) return;
    const d = Math.hypot(ponto.x - no.x, ponto.y - no.y);
    if (d <= r && d < menor) {
      menor = d;
      melhor = no;
    }
  });
  return melhor;
}

/**
 * A polilinha da trilha em coordenadas de mundo, montada a partir das posições
 * vivas dos nós + os pontos de controle.
 *
 * @param {object} trilha
 * @param {Array} nos
 * @returns {Array<{x:number,y:number}>} vazio quando alguma ponta não existe.
 */
export function pontosDaTrilha(trilha, nos) {
  const [de, para] = pontasDaTrilha(trilha);
  const lista = listaDe(nos);
  const a = lista.find((n) => n?.id === de);
  const b = lista.find((n) => n?.id === para);
  if (!ehPonto(a) || !ehPonto(b)) return [];
  return pontosDaCurva({ x: a.x, y: a.y }, { x: b.x, y: b.y }, trilha?.pathPoints);
}

/**
 * Hit-test de trilha: a mais próxima do ponto dentro da tolerância, ou `null`.
 *
 * A geometria da trilha depende das posições dos nós, então o grafo inteiro é
 * necessário. Duas formas de chamar, ambas válidas:
 *
 *   trilhaEmPonto(grafo, ponto, tolerancia)
 *   trilhaEmPonto(trilhas, ponto, tolerancia, nos)
 *
 * Sem nós não há como resolver a curva: devolve `null` em vez de chutar sobre
 * a reta (numa trilha curvada, chutar erraria o clique).
 *
 * @returns {object|null}
 */
export function trilhaEmPonto(grafoOuTrilhas, ponto, tolerancia = TOLERANCIA_DA_TRILHA_PADRAO, nos) {
  const trilhas = Array.isArray(grafoOuTrilhas) ? grafoOuTrilhas : listaDe(grafoOuTrilhas?.trilhas);
  const lista = Array.isArray(grafoOuTrilhas) ? listaDe(nos) : listaDe(grafoOuTrilhas?.nos);
  if (!ehPonto(ponto) || trilhas.length === 0 || lista.length === 0) return null;
  const tol = ehNumero(tolerancia) && tolerancia >= 0 ? tolerancia : TOLERANCIA_DA_TRILHA_PADRAO;

  let melhor = null;
  let menor = Infinity;
  trilhas.forEach((trilha) => {
    const pts = pontosDaTrilha(trilha, lista);
    if (pts.length === 0) return;
    const d = distanciaAteCurva(ponto, pts);
    if (d <= tol && d < menor) {
      menor = d;
      melhor = trilha;
    }
  });
  return melhor;
}

/**
 * Move um nó, sem mutar nada. Devolve **o mesmo array** quando o nó não existe
 * — assim quem renderiza pode comparar por referência e pular o re-render.
 *
 * @param {Array} nos
 * @param {string} noId
 * @param {{x:number,y:number}} destino
 * @returns {Array}
 * @throws {Error} quando o destino não é numérico.
 */
export function moverNo(nos, noId, destino) {
  const lista = listaDe(nos);
  if (!ehPonto(destino)) {
    throw new Error("O nó precisa de coordenadas x e y numéricas para ser movido.");
  }
  if (!lista.some((n) => n?.id === noId)) return nos;
  return lista.map((n) => (n?.id === noId ? { ...n, x: destino.x, y: destino.y } : n));
}

/**
 * Remove um nó **e todas as trilhas que o tocam** — trilha órfã não pode
 * sobreviver a um nó apagado.
 *
 * @param {{nos:Array,trilhas:Array}} grafo
 * @param {string} noId
 * @returns {{nos:Array,trilhas:Array}} grafo novo; o original não é mutado.
 */
export function removerNo(grafo, noId) {
  const { nos, trilhas } = criarGrafo(grafo);
  return {
    nos: nos.filter((n) => n?.id !== noId),
    trilhas: trilhas.filter((t) => {
      const [de, para] = pontasDaTrilha(t);
      return de !== noId && para !== noId;
    }),
  };
}

/**
 * Remove uma trilha. Os nós continuam onde estavam — apagar o caminho não
 * apaga os lugares.
 *
 * @param {{nos:Array,trilhas:Array}} grafo
 * @param {string} trilhaId
 * @returns {{nos:Array,trilhas:Array}} grafo novo; o original não é mutado.
 */
export function removerTrilha(grafo, trilhaId) {
  const { nos, trilhas } = criarGrafo(grafo);
  return { nos: nos.slice(), trilhas: trilhas.filter((t) => t?.id !== trilhaId) };
}

/**
 * Caixa que enquadra todos os nós — insumo do "enquadrar tudo"
 * (`useMapCamera.fitToScreen` aceita este formato direto).
 *
 * Nós com coordenadas inválidas são ignorados; se não sobrar nenhum, devolve
 * `null` (não existe caixa de nada).
 *
 * @param {Array} nos
 * @returns {{minX,minY,maxX,maxY,largura,altura,centro:{x,y}}|null}
 */
export function limitesDoGrafo(nos) {
  const validos = listaDe(nos).filter(ehPonto);
  if (validos.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  validos.forEach((n) => {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    largura: maxX - minX,
    altura: maxY - minY,
    centro: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}

/**
 * Problemas do grafo, em português, prontos para a tela.
 *
 * É **diagnóstico, não bloqueio**: um nó isolado pode ser proposital (o mestre
 * ainda vai ligar), e a lista existe para o ateliê avisar, não para impedir de
 * salvar. Quem bloqueia é `criarNo`/`criarTrilha`, na criação.
 *
 * Tipos devolvidos: `trilha-orfa`, `trilha-autoligacao`, `trilha-repetida`,
 * `no-duplicado`, `no-isolado`.
 *
 * @param {{nos:Array,trilhas:Array}} grafo
 * @param {{tolerancia?:number}} [opcoes] distância abaixo da qual dois nós são
 *   considerados "na mesma posição" (padrão 1 unidade de mundo).
 * @returns {Array<{tipo:string, id:string|null, mensagem:string}>}
 */
export function validarGrafo(grafo, opcoes) {
  const { nos, trilhas } = criarGrafo(grafo);
  const tolerancia = ehNumero(opcoes?.tolerancia) ? opcoes.tolerancia : 1;
  const problemas = [];

  const nomeDe = (id) => {
    const n = nos.find((x) => x?.id === id);
    return n?.name || id;
  };

  /* Trilhas: órfã, autoligação e repetição. */
  const vistas = new Set();
  trilhas.forEach((trilha) => {
    const [de, para] = pontasDaTrilha(trilha);
    const id = trilha?.id ?? null;

    if (de === para && idValido(de)) {
      problemas.push({
        tipo: "trilha-autoligacao",
        id,
        mensagem: `A trilha liga "${nomeDe(de)}" a ele mesmo.`,
      });
      return;
    }

    const faltando = [de, para].filter((p) => !nos.some((n) => n?.id === p));
    if (faltando.length > 0) {
      problemas.push({
        tipo: "trilha-orfa",
        id,
        mensagem: `A trilha aponta para um nó que não existe (${faltando.join(", ") || "sem id"}).`,
      });
      return;
    }

    const chave = [de, para].slice().sort().join("↔");
    if (vistas.has(chave)) {
      problemas.push({
        tipo: "trilha-repetida",
        id,
        mensagem: `Já existe uma trilha entre "${nomeDe(de)}" e "${nomeDe(para)}".`,
      });
    }
    vistas.add(chave);
  });

  /* Nós na mesma posição — clique ambíguo e desenho ilegível. */
  for (let i = 0; i < nos.length; i++) {
    const a = nos[i];
    if (!ehPonto(a)) continue;
    for (let j = i + 1; j < nos.length; j++) {
      const b = nos[j];
      if (!ehPonto(b)) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) <= tolerancia) {
        problemas.push({
          tipo: "no-duplicado",
          id: b?.id ?? null,
          mensagem: `"${a.name || a.id}" e "${b.name || b.id}" estão na mesma posição do mapa.`,
        });
      }
    }
  }

  /* Nós que nenhuma trilha alcança. */
  const tocados = new Set();
  trilhas.forEach((t) => {
    const [de, para] = pontasDaTrilha(t);
    tocados.add(de);
    tocados.add(para);
  });
  nos.forEach((n) => {
    if (!n || tocados.has(n.id)) return;
    problemas.push({
      tipo: "no-isolado",
      id: n.id ?? null,
      mensagem: `"${n.name || n.id}" não tem nenhuma trilha ligada — o grupo não consegue chegar lá.`,
    });
  });

  return problemas;
}
