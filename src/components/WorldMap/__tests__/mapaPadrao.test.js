/**
 * Mapa-Múndi — GATE DO MAPA PADRÃO (spec 0028, AC-13).
 *
 * O AC-13 define o gate literalmente: *"o seed tem ≥8 nós e ≥8 trilhas, nenhuma
 * trilha aponta para nó inexistente, nenhuma autoligação, e ≥1 trilha secreta
 * (para exercitar a mecânica da F4)"*. Cada bloco abaixo é um desses itens, mais
 * as garantias que o resto do AC-13 exige: determinismo, cópia ao usar com ids
 * novos, e o padrão fora da cota.
 *
 * Sem Firebase. O grosso é lógica pura; no fim há um smoke da ilustração
 * (`CartografiaPadrao.jsx`), porque o AC-13 exige que o `viewBox` dela **case**
 * com o `width`/`height` que o molde declara — os `x`/`y` dos nós vivem nesse
 * sistema de coordenadas, e se os dois divergirem o grafo sai do desenho sem
 * ninguém perceber.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import CartografiaPadrao from "../model/CartografiaPadrao";
import {
  MAPA_PADRAO_ID,
  MAPA_PADRAO_CONSOME_COTA,
  MAPA_PADRAO_LARGURA,
  MAPA_PADRAO_ALTURA,
  CAMPO_DISPENSA,
  construirMapaPadrao,
  clonarMapaPadrao,
  ehMapaPadrao,
  moldeDoMapaPadrao,
  padraoDispensado,
  listaComPadrao,
  contarParaCota,
} from "../model/mapaPadrao";
import { canCreateMap } from "../model/quotas";
import { validarGrafo, tipoConhecido } from "../model/graph";

/** Tipos que o AC-4 prevê para um nó. O padrão precisa cobrir vários. */
const TIPOS = ["town", "dungeon", "poi", "camp", "quest", "secret"];

describe("mapa padrão — gate do AC-13", () => {
  const { nos, trilhas } = construirMapaPadrao();
  const ids = new Set(nos.map((n) => n.id));

  test("tem pelo menos 8 nós", () => {
    expect(nos.length).toBeGreaterThanOrEqual(8);
  });

  test("tem pelo menos 8 trilhas", () => {
    expect(trilhas.length).toBeGreaterThanOrEqual(8);
  });

  test("nenhuma trilha aponta para nó inexistente", () => {
    const orfas = trilhas.filter((t) => !ids.has(t.fromNodeId) || !ids.has(t.toNodeId));
    expect(orfas.map((t) => `${t.id}: ${t.fromNodeId} → ${t.toNodeId}`)).toEqual([]);
  });

  test("nenhuma trilha é autoligação", () => {
    const laco = trilhas.filter((t) => t.fromNodeId === t.toNodeId);
    expect(laco.map((t) => t.id)).toEqual([]);
  });

  test("tem pelo menos uma trilha secreta com teste de descoberta (perícia + CD)", () => {
    const secretas = trilhas.filter((t) => t.isSecret);
    expect(secretas.length).toBeGreaterThanOrEqual(1);

    secretas.forEach((t) => {
      expect(t.discoveryCheck).toBeTruthy();
      expect(typeof t.discoveryCheck.skill).toBe("string");
      expect(t.discoveryCheck.skill.trim().length).toBeGreaterThan(0);
      expect(Number.isFinite(t.discoveryCheck.dc)).toBe(true);
      expect(t.discoveryCheck.dc).toBeGreaterThan(0);
    });
  });
});

describe("mapa padrão — integridade do grafo", () => {
  const { nos, trilhas } = construirMapaPadrao();

  test("ids de nó são únicos", () => {
    const ids = nos.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("ids de trilha são únicos", () => {
    const ids = trilhas.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("não há trilha duplicada entre o mesmo par de nós", () => {
    const pares = trilhas.map((t) => [t.fromNodeId, t.toNodeId].sort().join("↔"));
    expect(new Set(pares).size).toBe(pares.length);
  });

  test("todo nó está ligado a pelo menos uma trilha — nenhum ilhado", () => {
    const tocados = new Set();
    trilhas.forEach((t) => {
      tocados.add(t.fromNodeId);
      tocados.add(t.toNodeId);
    });
    const ilhados = nos.filter((n) => !tocados.has(n.id)).map((n) => n.name);
    expect(ilhados).toEqual([]);
  });

  test("validarGrafo não acha um único problema no seed", () => {
    /* O mesmo oráculo que o ateliê usa para avisar o mestre: órfã, autoligação,
     * trilha repetida, nó duplicado e nó isolado. O padrão tem de sair limpo. */
    expect(validarGrafo({ nos, trilhas })).toEqual([]);
  });

  test("o grafo é conexo pelas trilhas (contando as secretas)", () => {
    const vizinhos = new Map(nos.map((n) => [n.id, []]));
    trilhas.forEach((t) => {
      vizinhos.get(t.fromNodeId).push(t.toNodeId);
      vizinhos.get(t.toNodeId).push(t.fromNodeId);
    });
    const vistos = new Set([nos[0].id]);
    const fila = [nos[0].id];
    while (fila.length) {
      const atual = fila.shift();
      vizinhos.get(atual).forEach((v) => {
        if (!vistos.has(v)) {
          vistos.add(v);
          fila.push(v);
        }
      });
    }
    expect(vistos.size).toBe(nos.length);
  });
});

describe("mapa padrão — conteúdo autoral", () => {
  const { mapa, nos, trilhas } = construirMapaPadrao();

  test("cobre vários tipos de nó, todos reconhecidos por graph.js", () => {
    const usados = new Set(nos.map((n) => n.type));
    usados.forEach((tipo) => {
      expect(TIPOS).toContain(tipo);
      expect(tipoConhecido(tipo)).toBe(true);
    });
    expect(usados.size).toBeGreaterThanOrEqual(4);
  });

  test("todo nó tem nome, rumor, descrição pública e notas do mestre", () => {
    nos.forEach((n) => {
      expect(typeof n.name).toBe("string");
      expect(n.name.trim().length).toBeGreaterThan(0);
      expect(n.rumorLabel.trim().length).toBeGreaterThan(0);
      expect(n.description.trim().length).toBeGreaterThan(0);
      expect(n.gmNotes.trim().length).toBeGreaterThan(0);
    });
  });

  test("o rumor nunca entrega o nome verdadeiro do nó", () => {
    /* O rumor é o que o grupo lê ANTES de descobrir o lugar (F4). Se ele
     * repetisse o nome, o segredo já estaria dado no primeiro olhar. */
    nos.forEach((n) => {
      expect(n.rumorLabel.toLowerCase()).not.toContain(n.name.toLowerCase());
    });
  });

  test("os nós ficam dentro das dimensões declaradas do mapa", () => {
    expect(mapa.width).toBe(MAPA_PADRAO_LARGURA);
    expect(mapa.height).toBe(MAPA_PADRAO_ALTURA);
    nos.forEach((n) => {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(MAPA_PADRAO_LARGURA);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(MAPA_PADRAO_ALTURA);
    });
  });

  test("o nó inicial existe no grafo", () => {
    expect(nos.some((n) => n.id === mapa.startNodeId)).toBe(true);
  });

  test("toda trilha tem horas de viagem, nível de perigo e nota do mestre", () => {
    trilhas.forEach((t) => {
      expect(t.travelHours).toBeGreaterThan(0);
      expect(t.dangerLevel).toBeGreaterThanOrEqual(1);
      expect(t.dangerLevel).toBeLessThanOrEqual(5);
      expect(t.gmNotes.trim().length).toBeGreaterThan(0);
    });
  });

  test("atravessar o charco é mais lento e perigoso que a estrada", () => {
    const porId = new Map(trilhas.map((t) => [t.id, t]));
    const estrada = porId.get("padrao-trilha-5");   // passo do vau → forte, pela estrada
    const charco = porId.get("padrao-trilha-9");    // vila → charco, água na cintura
    expect(charco.travelHours).toBeGreaterThan(estrada.travelHours);
    expect(charco.dangerLevel).toBeGreaterThan(estrada.dangerLevel);
  });

  test("a ambientação é a mesma da Forja do Mestre (Coroa de Cinzas)", () => {
    /* O mapa e o mundo demo contam a MESMA história — é isso que liga as duas
     * features. Se alguém trocar o cenário, este teste avisa. */
    const nomes = nos.map((n) => n.name).join(" | ");
    expect(mapa.name).toContain("Coroa de Cinzas");
    ["Vila Candeia", "Serra da Boca Seca", "Forte da Barra Negra"].forEach((lugar) => {
      expect(nomes).toContain(lugar);
    });
  });
});

describe("mapa padrão — determinismo", () => {
  test("duas chamadas geram estrutura idêntica", () => {
    expect(construirMapaPadrao()).toEqual(construirMapaPadrao());
  });

  test("mas devolve objetos novos — mexer no resultado não contamina a próxima chamada", () => {
    const a = construirMapaPadrao();
    a.nos[0].name = "ESTRAGADO";
    a.trilhas[0].travelHours = 999;
    a.mapa.name = "ESTRAGADO";

    const b = construirMapaPadrao();
    expect(b.nos[0].name).not.toBe("ESTRAGADO");
    expect(b.trilhas[0].travelHours).not.toBe(999);
    expect(b.mapa.name).not.toBe("ESTRAGADO");
  });

  test("os ids são locais e estáveis, sem carimbo de tempo nem sorteio", () => {
    const { nos, trilhas } = construirMapaPadrao();
    nos.forEach((n, i) => expect(n.id).toBe(`padrao-no-${i + 1}`));
    trilhas.forEach((t, i) => expect(t.id).toBe(`padrao-trilha-${i + 1}`));
  });
});

describe("mapa padrão — identidade e cota", () => {
  test("ehMapaPadrao reconhece só o id reservado", () => {
    expect(ehMapaPadrao(MAPA_PADRAO_ID)).toBe(true);
    expect(ehMapaPadrao(` ${MAPA_PADRAO_ID} `)).toBe(true);
    expect(ehMapaPadrao("aB3xY7kQz1mN0pL2rS4t")).toBe(false);
    expect(ehMapaPadrao("")).toBe(false);
    expect(ehMapaPadrao(null)).toBe(false);
    expect(ehMapaPadrao(undefined)).toBe(false);
    expect(ehMapaPadrao({ id: MAPA_PADRAO_ID })).toBe(false);
  });

  test("o padrão não consome cota — o mestre free ainda pode criar o dele", () => {
    /* A cota do free é 1 mapa (`quotas.js`). Se o padrão contasse, `mapCount`
     * já nasceria 1 e o mestre free nunca criaria o próprio mapa. */
    expect(MAPA_PADRAO_CONSOME_COTA).toBe(false);
    const mapasNoFirestore = 0; // o padrão é código, não documento
    expect(canCreateMap("free", mapasNoFirestore).ok).toBe(true);
  });

  test("o mapa padrão traz a ilustração vetorial, não um fundo de usuário", () => {
    const { mapa } = construirMapaPadrao();
    expect(mapa.ilustracao).toBe("CartografiaPadrao");
    expect(mapa.backgroundUrl).toBeNull();
    expect(mapa.backgroundPath).toBeNull();
    expect(mapa.backgroundRef).toBeNull();
    expect(mapa.backgroundThumb).toBeNull();
  });
});

describe("mapa padrão — cópia ao usar (clonarMapaPadrao)", () => {
  const padrao = construirMapaPadrao();
  const clone = clonarMapaPadrao();

  test("gera ids novos, nenhum colidindo com os do padrão", () => {
    const antigos = new Set([
      ...padrao.nos.map((n) => n.id),
      ...padrao.trilhas.map((t) => t.id),
    ]);
    [...clone.nos, ...clone.trilhas].forEach((x) => {
      expect(antigos.has(x.id)).toBe(false);
    });
  });

  test("as trilhas do clone apontam para os nós DO CLONE", () => {
    const idsClone = new Set(clone.nos.map((n) => n.id));
    clone.trilhas.forEach((t) => {
      expect(idsClone.has(t.fromNodeId)).toBe(true);
      expect(idsClone.has(t.toNodeId)).toBe(true);
    });
  });

  test("o clone sai sem o id reservado — quem grava recebe o id do Firestore", () => {
    expect(clone.mapa.id).toBeUndefined();
    expect(ehMapaPadrao(clone.mapa.id)).toBe(false);
  });

  test("guarda de onde veio e recomeça do nó inicial equivalente", () => {
    expect(clone.mapa.origem).toBe(MAPA_PADRAO_ID);
    expect(clone.nos.some((n) => n.id === clone.mapa.startNodeId)).toBe(true);
  });

  test("preserva o grafo inteiro: mesma contagem, mesmas secretas", () => {
    expect(clone.nos).toHaveLength(padrao.nos.length);
    expect(clone.trilhas).toHaveLength(padrao.trilhas.length);
    expect(clone.trilhas.filter((t) => t.isSecret)).toHaveLength(
      padrao.trilhas.filter((t) => t.isSecret).length,
    );
    clone.trilhas.filter((t) => t.isSecret).forEach((t) => {
      expect(t.discoveryCheck).toBeTruthy();
      expect(typeof t.discoveryCheck.skill).toBe("string");
    });
  });

  test("mexer no clone não altera o original (cópia ao usar, AC-13)", () => {
    const c = clonarMapaPadrao();
    c.nos[0].name = "ESTRAGADO";
    c.trilhas[0].isSecret = !c.trilhas[0].isSecret;
    c.trilhas.find((t) => t.discoveryCheck).discoveryCheck.dc = 999;

    const original = construirMapaPadrao();
    expect(original.nos[0].name).not.toBe("ESTRAGADO");
    expect(original.trilhas.find((t) => t.discoveryCheck).discoveryCheck.dc).not.toBe(999);
  });

  test("dois clones com prefixos diferentes não colidem entre si", () => {
    const a = clonarMapaPadrao({ prefixo: "mesa-a" });
    const b = clonarMapaPadrao({ prefixo: "mesa-b" });
    const idsA = new Set([...a.nos, ...a.trilhas].map((x) => x.id));
    [...b.nos, ...b.trilhas].forEach((x) => expect(idsA.has(x.id)).toBe(false));
    expect(a.nos[0].id).toBe("mesa-a-no-1");
    expect(b.trilhas[0].id).toBe("mesa-b-trilha-1");
  });

  test("prefixo vazio ou inválido cai no padrão, sem gerar id quebrado", () => {
    [undefined, {}, { prefixo: "" }, { prefixo: "   " }, { prefixo: 42 }].forEach((op) => {
      const c = op === undefined ? clonarMapaPadrao() : clonarMapaPadrao(op);
      expect(c.nos[0].id).toBe("copia-no-1");
      expect(c.trilhas[0].id).toBe("copia-trilha-1");
    });
  });

  test("o clone se distingue do padrão na lista", () => {
    expect(clone.mapa.name).not.toBe(padrao.mapa.name);
    expect(clone.mapa.name).toContain("cópia");
    expect(clone.mapa.demo).toBe(false);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  DISPENSAR E RESTAURAR O PADRÃO  (AC-13)
 *  -----------------------------------------------------------------------
 *  *"o mestre pode excluir o mapa padrão da sua lista, como excluiria
 *  qualquer outro"*, *"a exclusão não é porta de mão única"*, *"a marca é por
 *  mestre"* e *"a marca não conta como mapa na cota"*.
 *
 *  Aqui mora a metade PURA do gate: dispensar esconde, restaurar traz de
 *  volta, e a contagem da cota ignora o padrão. A metade de tela está em
 *  `atelier-render.test.js`; a de persistência, no `worldMapStore`.
 * ══════════════════════════════════════════════════════════════════════ */
describe("mapa padrão — dispensa (AC-13)", () => {
  const MEU = { id: "m1", name: "As Terras Partidas" };
  const OUTRO = { id: "m2", name: "Vale do Sino" };

  test("moldeDoMapaPadrao devolve o card sem montar o grafo, e sempre novo", () => {
    const a = moldeDoMapaPadrao();
    const b = moldeDoMapaPadrao();
    expect(a.id).toBe(MAPA_PADRAO_ID);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    a.name = "ESTRAGADO";
    expect(moldeDoMapaPadrao().name).not.toBe("ESTRAGADO");
  });

  test("só `true` literal dispensa — perfil ausente ou lixo mantém a oferta", () => {
    expect(padraoDispensado({ [CAMPO_DISPENSA]: true })).toBe(true);
    expect(padraoDispensado({ [CAMPO_DISPENSA]: false })).toBe(false);
    expect(padraoDispensado({})).toBe(false);
    expect(padraoDispensado(null)).toBe(false);
    expect(padraoDispensado(undefined)).toBe(false);
    /* o lado seguro é OFERECER: valor estranho não pode esconder conteúdo */
    expect(padraoDispensado({ [CAMPO_DISPENSA]: "sim" })).toBe(false);
    expect(padraoDispensado({ [CAMPO_DISPENSA]: 1 })).toBe(false);
    expect(padraoDispensado("true")).toBe(false);
  });

  test("sem a marca, a lista oferece o padrão — por último, como oferta", () => {
    const lista = listaComPadrao([MEU, OUTRO], { dispensado: false });
    expect(lista).toHaveLength(3);
    expect(lista.map((m) => m.id)).toEqual([MEU.id, OUTRO.id, MAPA_PADRAO_ID]);
  });

  test("com a marca, a lista deixa de oferecê-lo e nada mais muda", () => {
    const lista = listaComPadrao([MEU, OUTRO], { dispensado: true });
    expect(lista.map((m) => m.id)).toEqual([MEU.id, OUTRO.id]);
  });

  test("dispensar e restaurar são exatamente o inverso um do outro", () => {
    const escondida = listaComPadrao([MEU], { dispensado: true });
    const devolvida = listaComPadrao([MEU], { dispensado: false });
    expect(escondida.some((m) => ehMapaPadrao(m.id))).toBe(false);
    expect(devolvida.some((m) => ehMapaPadrao(m.id))).toBe(true);
    /* a volta é idêntica à oferta original: nada se perde no caminho */
    expect(devolvida.find((m) => ehMapaPadrao(m.id))).toEqual(moldeDoMapaPadrao());
  });

  test("mestre sem mapa nenhum e sem a marca vê só o padrão", () => {
    expect(listaComPadrao([], {}).map((m) => m.id)).toEqual([MAPA_PADRAO_ID]);
    expect(listaComPadrao(undefined, {})).toHaveLength(1);
    expect(listaComPadrao([], { dispensado: true })).toEqual([]);
  });

  test("não duplica o padrão se um documento com o id reservado aparecer", () => {
    const intruso = { id: MAPA_PADRAO_ID, name: "Falsificação" };
    const lista = listaComPadrao([MEU, intruso], { dispensado: false });
    expect(lista.filter((m) => ehMapaPadrao(m.id))).toHaveLength(1);
    expect(lista.find((m) => ehMapaPadrao(m.id)).name).not.toBe("Falsificação");
  });

  test("a lista devolvida é nova — a do mestre não é tocada", () => {
    const minhas = [MEU];
    const lista = listaComPadrao(minhas, { dispensado: false });
    expect(lista).not.toBe(minhas);
    expect(minhas).toHaveLength(1);
  });

  /* ── A cota: o motivo de tudo isto existir ─────────────────────────
     O free tem 1 mapa. Se o padrão contasse, o mestre free nasceria sem
     poder criar o dele — e a dispensa viraria uma forma de comprar vaga. */
  test("o padrão não conta na cota, esteja ou não na lista", () => {
    expect(contarParaCota(listaComPadrao([], { dispensado: false }))).toBe(0);
    expect(contarParaCota(listaComPadrao([], { dispensado: true }))).toBe(0);
    expect(contarParaCota(listaComPadrao([MEU], { dispensado: false }))).toBe(1);
    expect(contarParaCota(listaComPadrao([MEU], { dispensado: true }))).toBe(1);
    expect(contarParaCota(undefined)).toBe(0);
  });

  test("com o padrão à mostra, o mestre free ainda pode criar o dele", () => {
    const lista = listaComPadrao([], { dispensado: false });
    expect(lista).toHaveLength(1);              // há um card na tela…
    expect(canCreateMap("free", contarParaCota(lista)).ok).toBe(true); // …e a vaga está livre
  });

  test("dispensar não compra vaga: quem já tem 1 mapa no free continua no teto", () => {
    const comMapa = listaComPadrao([MEU], { dispensado: true });
    expect(canCreateMap("free", contarParaCota(comMapa)).ok).toBe(false);
  });

  test("a marca é um campo de perfil, não um mapa — nome estável para a persistência", () => {
    /* Se este nome mudar, a marca de todo mestre que já dispensou some e o
       padrão reaparece sozinho. É contrato com o Firestore, não detalhe. */
    expect(CAMPO_DISPENSA).toBe("mapaPadraoDispensado");
    expect(MAPA_PADRAO_CONSOME_COTA).toBe(false);
  });
});

describe("ilustração padrão — CartografiaPadrao", () => {
  test("o viewBox casa com as dimensões que o molde declara (AC-13)", () => {
    const { mapa } = construirMapaPadrao();
    const { container } = render(<CartografiaPadrao />);
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${mapa.width} ${mapa.height}`);
    expect(mapa.width).toBe(MAPA_PADRAO_LARGURA);
    expect(mapa.height).toBe(MAPA_PADRAO_ALTURA);
  });

  test("é acessível: role de imagem com descrição do mapa", () => {
    render(<CartografiaPadrao />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toMatch(/Coroa de Cinzas/);
    expect(img.getAttribute("aria-label")).toMatch(/Rio Ferrugem/);
  });

  test("é vetorial: nenhuma imagem raster, nenhum base64 embutido", () => {
    /* O AC-13 escolhe SVG justamente para não pesar no Firestore nem esbarrar no
     * teto de 900 KB do base64. Um <image> ou um data:image aqui desfaz isso. */
    const { container } = render(<CartografiaPadrao />);
    expect(container.querySelectorAll("image")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/data:image/);
  });

  test("desenha os elementos que a carta promete", () => {
    const { container } = render(<CartografiaPadrao />);
    /* Textura de pergaminho por filtro SVG, não por bitmap. */
    expect(container.querySelectorAll("feTurbulence").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll("feDisplacementMap").length).toBeGreaterThanOrEqual(2);
    /* Massas de mata, glifos de serra, tufos de charco, costa, rio e estradas. */
    expect(container.querySelectorAll("ellipse").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("path").length).toBeGreaterThan(100);
  });

  test("é determinística: duas renderizações produzem exatamente o mesmo desenho", () => {
    const a = render(<CartografiaPadrao />).container.innerHTML;
    const b = render(<CartografiaPadrao />).container.innerHTML;
    expect(a).toBe(b);
  });

  test("idPrefix isola os ids de <defs> quando há duas cartas na página", () => {
    const { container } = render(<CartografiaPadrao idPrefix="miniatura" />);
    expect(container.querySelector("#miniatura-papel")).not.toBeNull();
    expect(container.querySelector("#cartografia-padrao-papel")).toBeNull();
  });
});
