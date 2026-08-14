/**
 * Gate do ROADMAP PÚBLICO (spec 0036 · AC-3).
 *
 * A tela `/roadmap` é também o "Changelog" do rodapé — é a página onde alguém
 * de fora decide se o produto está vivo. Ela estava anunciando como PLANEJADO
 * cinco coisas que já estavam no ar havia meses.
 *
 * ── O QUE ESTE ARQUIVO TRAVA ────────────────────────────────────────────
 * A honestidade nos DOIS sentidos, porque o defeito tem duas faces:
 *
 *  · **Negar o entregue** — item `planned`/`backlog` cujo código existe.
 *    Custa credibilidade: o visitante lê que o produto é menor do que é.
 *  · **Prometer o inexistente** — item `done` sem código atrás. Custa mais
 *    caro ainda: quem entra procurando não acha, e aí não é modéstia, é
 *    propaganda enganosa.
 *
 * A amarração é por EVIDÊNCIA no código, não por lista de nomes decorada: se
 * `grid.js` deixar de exportar os tipos de hex, o item volta a ser mentira e o
 * teste avisa. É por isso que cada linha aponta para um símbolo real.
 */
import fs from "fs";
import path from "path";
import { roadmapData } from "../roadmapData";

const RAIZ_SRC = path.join(__dirname, "..");
const ler = (rel) => {
  const alvo = path.join(RAIZ_SRC, rel);
  return fs.existsSync(alvo) ? fs.readFileSync(alvo, "utf8") : null;
};

/** Todo item do roadmap, achatado com o nome da fase. */
const ITENS = roadmapData.flatMap((fase) =>
  fase.sections.flatMap((s) => s.items.map((i) => ({ ...i, fase: fase.nome }))),
);

const itemPorNome = (nome) => ITENS.find((i) => i.nome === nome);

/**
 * O que ESTÁ entregue, com a evidência que prova. `prova` recebe o conteúdo do
 * arquivo e devolve `true` quando o recurso está lá de verdade.
 */
const ENTREGUES = [
  {
    nome: "Módulo Tabletop com grid hexagonal",
    arquivo: "components/MapEditor/grid.js",
    prova: (t) => /hexVertical/.test(t) && /hexHorizontal/.test(t),
  },
  {
    nome: "Controle de clima em tempo real",
    arquivo: "components/MapEditor/index.jsx",
    prova: (t) => /weather === 'rain'/.test(t) && /weather === 'snow'/.test(t),
  },
  {
    nome: "Fog of war",
    arquivo: "components/MapEditor/FogLayer.jsx",
    prova: (t) => t.length > 0,
  },
  {
    nome: "Upload de mapa customizado",
    arquivo: "components/MapEditor/index.jsx",
    prova: (t) => /accept="image\/\*"/.test(t) && /loadBg/.test(t),
  },
  {
    nome: "Campanhas compartilhadas",
    arquivo: "infrastructure/firestore/sharedSheetsRepo.js",
    prova: (t) => /export function watchByCampaign/.test(t),
  },
  {
    nome: "Multiplayer na campanha (até 6 jogadores)",
    arquivo: "domain/campaign.js",
    prova: (t) => /DEFAULT_MAX_PLAYERS\s*=\s*6/.test(t),
  },
];

/**
 * O que NÃO está entregue, e o símbolo que apareceria se estivesse. Se um
 * destes começar a existir, o teste falha pedindo a promoção do status — é
 * assim que o roadmap deixa de envelhecer sozinho.
 */
const NAO_ENTREGUES = [
  { nome: "Iluminação dinâmica", padrao: /lightLayer|dynamicLight/ },
  { nome: "Dado 3D (d4–d100)", padrao: /dice3d|dado3d/ },
  { nome: "Tokens animados com aura e status", padrao: /auraRadius|tokenAura/ },
  /* Cuidado: "initiative" existe como CAMPO na ficha de criatura do bestiário.
     O que não existe é ordem de turno — por isso o padrão é o tracker. */
  { nome: "Tracker de iniciativa", padrao: /initiativeTracker|ordemDeTurno|turnOrder/ },
];

/* ⚠️ A VARREDURA IGNORA COMENTÁRIOS, E ISSO NÃO É DETALHE.
   Este gate falhou na primeira execução porque `roadmapData.js` documenta, em
   comentário, POR QUE cada item continua `planned` — e para explicar cita o
   símbolo que procuramos ("nenhum `lightLayer`/`dynamicLight` no código").
   O texto que enuncia a regra casava com ela.

   É a terceira vez que esta armadilha aparece no projeto: `Math.random` no
   cabeçalho da `CartografiaPadrao` (0035) e `mailto:` no do `AppFooter`
   (0036). A regra geral: **teste que varre o fonte atrás da AUSÊNCIA de um
   símbolo tem de remover comentários antes**, senão ele proíbe documentar. */
const semComentarios = (texto) => texto
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Todo o código de `src/`, menos testes — para a varredura dos não-entregues. */
function fontes(dir = RAIZ_SRC, saida = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const alvo = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === "__tests__") continue;
      fontes(alvo, saida);
    } else if (/\.(js|jsx)$/.test(item.name)) {
      saida.push(alvo);
    }
  }
  return saida;
}

describe("AC-3 — o roadmap não nega o que foi entregue", () => {
  it.each(ENTREGUES.map((e) => [e.nome, e]))(
    "%s — o código existe, logo o status é 'done'",
    (_nome, { nome, arquivo, prova }) => {
      const conteudo = ler(arquivo);
      expect(conteudo).not.toBeNull();
      expect(prova(conteudo)).toBe(true);

      const item = itemPorNome(nome);
      expect(item).toBeDefined();
      expect(item.status).toBe("done");
    },
  );
});

describe("AC-3 — o roadmap também não promete o que não existe", () => {
  it.each(NAO_ENTREGUES.map((e) => [e.nome, e]))(
    "%s — não há código, logo o status NÃO é 'done'",
    (_nome, { nome, padrao }) => {
      const item = itemPorNome(nome);
      expect(item).toBeDefined();

      const existe = fontes()
        .some((f) => padrao.test(semComentarios(fs.readFileSync(f, "utf8"))));
      /* Se alguém implementar de verdade, este teste falha pedindo a promoção
         — o roadmap para de envelhecer em silêncio. */
      expect(existe).toBe(false);
      expect(item.status).not.toBe("done");
    },
  );
});

describe("a forma da lista continua válida", () => {
  it("todo item tem nome e um status conhecido", () => {
    expect(ITENS.length).toBeGreaterThan(20);
    ITENS.forEach((i) => {
      expect(typeof i.nome).toBe("string");
      expect(i.nome.trim().length).toBeGreaterThan(3);
      expect(["done", "planned", "backlog"]).toContain(i.status);
    });
  });

  it("nenhum número no texto contradiz o código", () => {
    /* "até 8 jogadores" com o código aplicando 6, e "6 sistemas" com um só
       aberto, foram exatamente as duas mentiras numéricas encontradas. */
    expect(ler("domain/campaign.js")).toMatch(/DEFAULT_MAX_PLAYERS\s*=\s*6/);
    const textoTodo = ITENS.map((i) => i.nome).join(" | ");
    expect(textoTodo).not.toMatch(/até 8 jogadores/i);
    expect(textoTodo).not.toMatch(/\(6 sistemas\)/i);
  });
});
