/* ════════════════════════════════════════════════════════════════════════
 *  MODO DEMO — o app rodando sem login e sem Firestore
 *  ------------------------------------------------------------------------
 *  Para QUE serve: ver e clicar o app inteiro localmente sem criar conta,
 *  sem rede e sem tocar no banco de produção. É ambiente de teste visual,
 *  não um "modo convidado" do produto.
 *
 *  COMO LIGA: `http://localhost:3000/?demo=1` — fica ligado no resto da aba
 *  (sessionStorage). `?demo=0` desliga e limpa os dados semeados.
 *
 *  ONDE NÃO LIGA: num build de produção. `NODE_ENV === "production"` só
 *  aceita o modo se o build tiver sido feito de propósito com
 *  `REACT_APP_DEMO=1`. Sem isso, o `?demo=1` no site publicado não faz nada
 *  — é a trava que impede alguém de entrar sem conta na Vercel.
 *
 *  ONDE ELE TOCA (os quatro pontos, todos com o mesmo `if (DEMO_ON)`):
 *    · `hooks/useAuth`      — usuário falso, sem `onAuthStateChanged`
 *    · `hooks/useCharacter` — pula a leitura/escrita no Firestore
 *    · `hooks/useCampaign`  — serve as mesas daqui, sem listener
 *    · `components/Painel`  — contagens de mapas/mundos daqui
 *  Fora do modo demo, TODOS esses caminhos são exatamente os de antes.
 *
 *  As fichas vão para o localStorage porque é de lá que o `useCharacter` já
 *  lê quando não há nuvem — então criar, editar e excluir ficha funciona de
 *  verdade no modo demo, e sobrevive ao F5.
 * ════════════════════════════════════════════════════════════════════════ */

import { getCardAccent } from "../themes";

const CHAVE_SESSAO = "nx_demo";

/* Produção só entra em demo se o build pediu. Em `npm start` (development)
   basta a query. */
const permitido =
  process.env.NODE_ENV !== "production" || process.env.REACT_APP_DEMO === "1";

const leQuery = () => {
  try { return new URLSearchParams(window.location.search).get("demo"); }
  catch { return null; }
};

const sessao = {
  get: () => { try { return sessionStorage.getItem(CHAVE_SESSAO) === "1"; } catch { return false; } },
  set: (v) => {
    try {
      if (v) sessionStorage.setItem(CHAVE_SESSAO, "1");
      else sessionStorage.removeItem(CHAVE_SESSAO);
    } catch { /* aba sem storage */ }
  },
};

/* Declarados ANTES do IIFE de `DEMO_ON` de propósito: o caminho `?demo=0`
   chama `limparSemente()` durante a inicialização do módulo, e um `const`
   declarado depois estaria na zona morta temporal. */
const CHAVES_SEMEADAS = [
  "nexus_system", "nexus_screen", "nexus_characters_op",
  "nexus_profile_name", "nexus_demo_semeado",
];

function limparSemente() {
  try { CHAVES_SEMEADAS.forEach((k) => localStorage.removeItem(k)); }
  catch { /* sem storage: nada a limpar */ }
}

export const DEMO_ON = (() => {
  if (!permitido || typeof window === "undefined") return false;
  const q = leQuery();
  if (q === "1") { sessao.set(true);  return true;  }
  if (q === "0") { sessao.set(false); limparSemente(); return false; }
  return sessao.get();
})();

/* ── Usuário ─────────────────────────────────────────────────────────────*/
export const USUARIO_DEMO = {
  uid: "demo-agente-0001",
  email: "demo@nexus.local",
  displayName: "Agente Demo",
  photoURL: "",
};

/* ── Capas ───────────────────────────────────────────────────────────────
   SVG embutido em vez de arquivo: a demo não depende de rede nem de asset
   novo no repositório, e ainda assim exercita o caminho real de <img>.

   SEM o nome da campanha desenhado dentro: o card já escreve o título por
   cima da capa. Capa de verdade é arte, não letreiro — uma que trouxesse o
   nome embutido colidiria com o texto do card, que foi exatamente o que
   aconteceu na primeira versão desta função. */
const capa = (c1, c2) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
      <defs>
        <radialGradient id="g" cx="50%" cy="34%" r="82%">
          <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
        </radialGradient>
      </defs>
      <rect width="640" height="400" fill="url(#g)"/>
      <g fill="none" stroke="rgba(255,255,255,0.20)" stroke-width="1.5">
        <circle cx="320" cy="168" r="104"/><circle cx="320" cy="168" r="74"/>
        <path d="M320 46 L426 230 L214 230 Z"/><path d="M320 290 L214 106 L426 106 Z"/>
      </g>
      <g fill="rgba(255,255,255,0.13)">
        <circle cx="152" cy="92" r="2.5"/><circle cx="498" cy="128" r="2"/>
        <circle cx="96" cy="242" r="1.8"/><circle cx="556" cy="286" r="2.4"/>
      </g>
    </svg>`,
  );

/* ── Mesas ───────────────────────────────────────────────────────────────
   `masterId` igual ao uid demo na primeira: é ela que gera as vagas abertas
   no bloco "precisa de você". A segunda tem outro mestre, para o painel ter
   o que mostrar em "como jogador". */
export const CAMPANHAS_DEMO = [
  {
    id: "demo-camp-1",
    name: "Dragon Tale",
    description: "Uma cidade litorânea, três desaparecimentos e um farol que não apaga desde a última lua nova.",
    system: "Ordem Paranormal",
    masterId: USUARIO_DEMO.uid,
    masterName: USUARIO_DEMO.displayName,
    inviteCode: "DEMO01",
    members: [USUARIO_DEMO.uid],
    memberNames: { [USUARIO_DEMO.uid]: USUARIO_DEMO.displayName },
    isActive: true,
    maxPlayers: 6,
    coverImage: capa("#5c1417", "#0a0709"),
  },
  {
    id: "demo-camp-2",
    name: "O Segundo Turno",
    description: "Campanha de outro mestre — você entrou como jogador.",
    system: "Ordem Paranormal",
    masterId: "outro-mestre",
    masterName: "Mestre Convidado",
    inviteCode: "DEMO02",
    members: ["outro-mestre", USUARIO_DEMO.uid, "jogador-3"],
    memberNames: { [USUARIO_DEMO.uid]: USUARIO_DEMO.displayName },
    isActive: true,
    maxPlayers: 5,
    coverImage: capa("#1e3247", "#07090c"),
  },
];

/* ── Fichas ──────────────────────────────────────────────────────────────
   Mesmo formato que o `CharacterCreator` entrega (`{attrs, origem, classe,
   form}`) mais o que o App carimba na criação (`id`, `nex`, `createdAt`,
   `systemId`). `classe`/`origem` copiam a forma das listas do App.jsx. */
export const FICHAS_DEMO = [
  {
    id: 1754300000000,
    systemId: "op",
    createdAt: "02/08/26",
    nex: 25,
    attrs: { AGI: 2, FOR: 3, INT: 1, PRE: 1, VIG: 2 },
    classe: {
      id: "combatente", name: "Combatente", icon: "⚔️",
      desc: "Treinado para lutar com todo tipo de armas, e com a força e a coragem para encarar os perigos de frente.",
      bonus: "PV +4 · Ataque +2 · Resistência Física",
    },
    origem: {
      id: "militar", name: "Militar", skills: ["Fortitude", "Pontaria"],
      power: "Ordem Unida. Você recebe +2 em testes de Fortitude e Pontaria.",
    },
    form: {
      personagem: "Kléber Fontes", jogador: "Agente Demo",
      aparencia: "Cicatriz sobre o olho esquerdo, coturno gasto.",
      personalidade: "Fala pouco, decide rápido.",
      historico: "Sargento reformado, recrutado depois do incidente do porto.",
      objetivo: "Descobrir quem assinou a ordem de silêncio.", avatar: "",
    },
    pv: 22, pvMax: 28, san: 16, sanMax: 20, pe: 5, peMax: 8,
    elementoAfinidade: "sangue",
  },
  {
    id: 1754500000000,
    systemId: "op",
    createdAt: "04/08/26",
    nex: 10,
    attrs: { AGI: 1, FOR: 1, INT: 3, PRE: 2, VIG: 1 },
    classe: {
      id: "especialista", name: "Especialista", icon: "🔬",
      desc: "Um perito com talentos variados, capaz de resolver com a mente o que não se resolve na força.",
      bonus: "Perícias extras · Ferramentas",
    },
    origem: {
      id: "academico", name: "Acadêmico", skills: ["Ciências", "Investigação"],
      power: "Saber é Poder. Quando faz um teste usando Intelecto, pode gastar 2 PE para receber +5 nesse teste.",
    },
    form: {
      personagem: "Íris Nakamura", jogador: "Agente Demo",
      aparencia: "Óculos de aro fino, caderno sempre aberto.",
      personalidade: "Curiosa até onde não devia.",
      historico: "Pesquisadora de folclore litorâneo. Achou o que procurava.",
      objetivo: "Traduzir o diário encontrado no farol.", avatar: "",
    },
    pv: 14, pvMax: 14, san: 9, sanMax: 16, pe: 3, peMax: 6,
    elementoAfinidade: "conhecimento",
  },
];

/* ── Plano ───────────────────────────────────────────────────────────────
   Assinante de Ordem Paranormal: o ambiente de teste serve para percorrer o
   app, não para bater na cota de 1 ficha do plano livre a cada clique. Para
   ver o app pelos olhos de quem NÃO assina, troque para `[]`. */
export const PLANOS_DEMO = ["op", "dnd", "tormenta"];

/* ── Contagens do preparo do mundo ───────────────────────────────────────
   1 mapa e 0 mundos deixam o preparo em 3 de 4 — o passo que falta é o da
   Forja, que é justamente o que se quer ver na tela. */
export const CONTAGENS_DEMO = { mapas: 1, mundos: 0 };

/* ── Sistema pré-escolhido ───────────────────────────────────────────────
   Mesma forma que o App grava em `nexus_system` (JSON.stringify de
   `activeSystem`, que já perde as funções do card). Sem isso a demo cai na
   tela de escolher sistema — o que também funciona, só custa um clique. */
const SISTEMA_DEMO = {
  id: "op",
  name: "Ordem Paranormal",
  subtitle: "Ordem Paranormal",
  emblem: "/assets/higgsfield/img/emblem-op.webp",
  desc: "Enfrente o Outro Lado. Investigue o inexplicável. Sobreviva ao horror sobrenatural.",
  tags: ["Terror", "Investigação", "Sobrenatural"],
  available: true,
  /* As cores saem do REGISTRY, nunca escritas à mão: um literal aqui viraria
     uma segunda fonte da verdade e sobreviveria à próxima troca de paleta —
     foi exatamente o que aconteceu na repaginação de 2026-08-05. */
  ...getCardAccent("op"),
};

/**
 * Semeia o estado local UMA vez por navegador. Roda no boot (index.js),
 * antes do React montar, porque o `useCharacter` lê o localStorage no
 * primeiro render.
 *
 * Não sobrescreve o que já existe: se você criou fichas na demo e deu F5,
 * elas continuam lá. Para voltar ao estado inicial, use `?demo=0` e depois
 * `?demo=1` de novo.
 */
export function prepararDemo() {
  if (!DEMO_ON) return;
  try {
    if (localStorage.getItem("nexus_demo_semeado") === "1") return;
    localStorage.setItem("nexus_system", JSON.stringify(SISTEMA_DEMO));
    localStorage.setItem("nexus_characters_op", JSON.stringify(FICHAS_DEMO));
    localStorage.setItem("nexus_profile_name", USUARIO_DEMO.displayName);
    localStorage.setItem("nexus_demo_semeado", "1");
    /* A intro roda uma vez por aba; no ambiente de teste ela só atrasa. */
    sessionStorage.setItem("nx_intro", "1");
  } catch { /* navegador sem storage: a demo ainda monta, só sem semente */ }
}

/** Sai do modo demo, apaga o que foi semeado e recarrega no app normal. */
export function sairDoDemo() {
  sessao.set(false);
  limparSemente();
  try { window.location.replace(window.location.pathname); }
  catch { /* ambiente sem window: nada a recarregar */ }
}
