/* ════════════════════════════════════════════════════════════════════════
 *  CENAS SONORAS — ORDEM PARANORMAL
 *  ------------------------------------------------------------------------
 *  O problema que isto resolve: narrando ao vivo, o mestre não tem tempo de
 *  abrir a aba de Trilhas, achar a playlist certa e clicar. Ele precisa de UM
 *  botão por tipo de cena.
 *
 *  Então a mesa passa a ter CENAS — os momentos que o livro de Ordem
 *  Paranormal já nomeia (investigação, ação, interlúdio, ritual, o Outro
 *  Lado) — e cada cena fica VINCULADA a uma playlist que o próprio mestre
 *  montou. Um clique troca a trilha.
 *
 *  Lógica pura: nada de React, nada de <audio>. O vínculo mora no
 *  localStorage porque a playlist de origem também mora (o acervo local nunca
 *  sobe para o Firestore — decisão registrada em `audioDb.js`).
 * ════════════════════════════════════════════════════════════════════════ */

export const CHAVE_CENAS = "nx_cenas_op";

/* As oito cenas. Os nomes seguem o vocabulário do livro sempre que ele tem um
 * termo próprio — "cena de ação", "cena de investigação" e "interlúdio" são
 * termos mecânicos, não invenção nossa. */
export const CENAS_OP = [
  { id: "investigacao", nome: "Investigação", desc: "Procurar pistas, interrogar, vasculhar o cenário.", icone: "◍" },
  { id: "tensao",       nome: "Tensão",       desc: "Algo está errado e ninguém sabe o quê ainda.",      icone: "◔" },
  { id: "terror",       nome: "Terror",       desc: "A criatura apareceu. Testes de Sanidade.",          icone: "◑" },
  { id: "combate",      nome: "Combate",      desc: "Cena de ação, iniciativa rolada.",                  icone: "◆" },
  { id: "perseguicao",  nome: "Perseguição",  desc: "Correr atrás ou fugir — ritmo acelerado.",          icone: "▶" },
  { id: "ritual",       nome: "Ritual",       desc: "Conjuração, componentes, o símbolo aceso.",         icone: "✦" },
  { id: "outro_lado",   nome: "O Outro Lado", desc: "A Realidade fica para trás.",                       icone: "◈" },
  { id: "interludio",   nome: "Interlúdio",   desc: "Entre missões: descanso, treino, vida pessoal.",    icone: "○" },
];

export const ehCenaValida = (id) => CENAS_OP.some((c) => c.id === id);

export const cenaPorId = (id) => CENAS_OP.find((c) => c.id === id) || null;

/* ── Vínculos ─────────────────────────────────────────────────────────────
 * Forma: { [cenaId]: { svc, playlistId, playlistName } }
 *   svc: "local" | "youtube" | "spotify"
 * O nome é guardado junto de propósito: as playlists de YouTube/Spotify só
 * chegam depois de uma chamada de rede, e sem o nome em mãos a tira de cenas
 * apareceria vazia toda vez que a tela abre. */

/** Descarta qualquer coisa que não seja um vínculo utilizável. Isto existe
 *  porque o valor vem do localStorage, que é editável pelo usuário e
 *  sobrevive a mudanças de versão do app. */
export function normalizarVinculos(bruto) {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const out = {};
  for (const [cenaId, v] of Object.entries(bruto)) {
    if (!ehCenaValida(cenaId)) continue;
    if (!v || typeof v !== "object") continue;
    if (!v.playlistId || !["local", "youtube", "spotify"].includes(v.svc)) continue;
    out[cenaId] = {
      svc: v.svc,
      playlistId: String(v.playlistId),
      playlistName: String(v.playlistName || "Playlist"),
    };
  }
  return out;
}

/* Resolvido em chamada, não no parâmetro: o `globalThis` não passa no ESLint
 * do preset do CRA, e o módulo precisa continuar importável fora do browser
 * (os testes injetam o próprio storage). */
const storagePadrao = () => (typeof window !== "undefined" ? window.localStorage : null);

export function lerVinculos(storage) {
  try {
    const s = storage || storagePadrao();
    return normalizarVinculos(JSON.parse(s?.getItem(CHAVE_CENAS) || "{}"));
  } catch {
    return {};
  }
}

export function gravarVinculos(vinculos, storage) {
  try {
    const s = storage || storagePadrao();
    s?.setItem(CHAVE_CENAS, JSON.stringify(normalizarVinculos(vinculos)));
  } catch {
    /* cota cheia ou modo privado: perder o vínculo é aceitável, quebrar a
       tela do mestre no meio da sessão não é. */
  }
}

/** Devolve um mapa novo — nunca muta o recebido. */
export function vincular(vinculos, cenaId, playlist) {
  if (!ehCenaValida(cenaId) || !playlist?.id) return { ...vinculos };
  return {
    ...vinculos,
    [cenaId]: {
      svc: playlist.svc || "local",
      playlistId: String(playlist.id),
      playlistName: String(playlist.name || "Playlist"),
    },
  };
}

export function desvincular(vinculos, cenaId) {
  const out = { ...vinculos };
  delete out[cenaId];
  return out;
}

/* ── Consultas ──────────────────────────────────────────────────────────── */

/** Qual cena está tocando agora, se alguma. Compara serviço E id: duas
 *  playlists de serviços diferentes podem ter o mesmo id. */
export function cenaTocando(vinculos, nowPlaying) {
  if (!nowPlaying?.playlistId) return null;
  const achou = Object.entries(normalizarVinculos(vinculos)).find(
    ([, v]) => v.playlistId === String(nowPlaying.playlistId) && v.svc === nowPlaying.svc,
  );
  return achou ? achou[0] : null;
}

/**
 * Junta o catálogo de cenas com o que está vinculado e com as playlists que
 * existem de fato, para a interface renderizar em um `map` só.
 *
 * `disponivel: false` marca o vínculo órfão — a playlist foi apagada depois
 * de vinculada. A cena continua listada, com aviso, em vez de sumir sem
 * explicação no meio da sessão.
 */
export function montarTira(vinculos, playlistsPorServico = {}, nowPlaying = null) {
  const v = normalizarVinculos(vinculos);
  const tocando = cenaTocando(v, nowPlaying);

  return CENAS_OP.map((cena) => {
    const vinculo = v[cena.id] || null;
    if (!vinculo) return { ...cena, vinculo: null, disponivel: false, tocando: false };

    const lista = playlistsPorServico[vinculo.svc] || [];
    const existe = lista.some((p) => String(p.id) === vinculo.playlistId);
    return {
      ...cena,
      vinculo,
      disponivel: existe,
      tocando: tocando === cena.id,
    };
  });
}

/** Quantas cenas já têm trilha — usado no rótulo da seção. */
export const contarVinculadas = (vinculos) => Object.keys(normalizarVinculos(vinculos)).length;
