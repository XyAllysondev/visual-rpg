/* ════════════════════════════════════════════════════════════════════════
 *  MESA DE EFEITOS — lógica pura
 *  ------------------------------------------------------------------------
 *  Efeito sonoro NÃO é trilha, e a diferença define o módulo inteiro:
 *
 *    trilha  → substitui o que está tocando, dura a cena, tem fila
 *    efeito  → dispara POR CIMA, dura um segundo, não interrompe nada
 *
 *  Por isso a mesa não passa pelo player de música. Cada disparo cria seu
 *  próprio elemento de áudio, toca e morre — o que também é o jeito de dois
 *  efeitos soarem juntos (um grito por cima de um choro) sem um cortar o
 *  outro. Essa parte é imperativa e vive no componente; aqui fica só o que é
 *  puro: o acervo, a validação e o volume.
 *
 *  O arquivo em si reusa o IndexedDB `nexus_audio` das playlists locais — o
 *  mestre importa MP3 do computador do mesmo jeito, e nada sobe para o
 *  Firestore.
 * ════════════════════════════════════════════════════════════════════════ */

export const CHAVE_EFEITOS = "nx_efeitos";

export const VOLUME_PADRAO = 0.8;

/* Sugestões de nome, agrupadas pelo uso na mesa de Ordem Paranormal. Isto é
 * só um cardápio para a tela mostrar quando o acervo está vazio — não é
 * catálogo fechado, o mestre nomeia como quiser. */
export const SUGESTOES = [
  { grupo: "Vozes", itens: ["Criança falando oi", "Criança chorando", "Criança cantando", "Mulher gritando", "Sussurro sem dono", "Riso distante"] },
  { grupo: "Ambiente", itens: ["Porta rangendo", "Passos no corredor", "Vidro quebrando", "Estática de rádio", "Telefone tocando", "Chuva na janela"] },
  { grupo: "Impacto", itens: ["Batida na porta", "Trovão", "Queda", "Tiro", "Metal arrastando"] },
  { grupo: "Paranormal", itens: ["Membrana rasgando", "Coro invertido", "Batimento cardíaco", "Zumbido agudo", "Respiração atrás de você"] },
];

/* ── Acervo ───────────────────────────────────────────────────────────────
 * Forma: [{ id, nome, fileId, volume }]
 *   id     — identidade do efeito na mesa
 *   fileId — chave do arquivo no IndexedDB `nexus_audio`
 *   volume — 0 a 1, por efeito (um grito e um sussurro não pedem o mesmo) */

export const limitarVolume = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return VOLUME_PADRAO;
  return Math.min(1, Math.max(0, n));
};

/** Descarta o que não é utilizável. O valor vem do localStorage, que é
 *  editável à mão e sobrevive a mudanças de versão do app. */
export function normalizarEfeitos(bruto) {
  if (!Array.isArray(bruto)) return [];
  const vistos = new Set();
  const out = [];
  for (const e of bruto) {
    if (!e || typeof e !== "object") continue;
    if (!e.id || !e.fileId) continue;
    const id = String(e.id);
    if (vistos.has(id)) continue;      // id repetido quebraria a key do React
    vistos.add(id);
    out.push({
      id,
      fileId: String(e.fileId),
      nome: String(e.nome || "Efeito").slice(0, 60),
      volume: limitarVolume(e.volume ?? VOLUME_PADRAO),
    });
  }
  return out;
}

/* Resolvido em chamada, não no parâmetro: `globalThis` não passa no ESLint do
 * preset do CRA, e o módulo precisa continuar importável fora do browser. */
const storagePadrao = () => (typeof window !== "undefined" ? window.localStorage : null);

export function lerEfeitos(storage) {
  try {
    const s = storage || storagePadrao();
    return normalizarEfeitos(JSON.parse(s?.getItem(CHAVE_EFEITOS) || "[]"));
  } catch {
    return [];
  }
}

export function gravarEfeitos(lista, storage) {
  try {
    const s = storage || storagePadrao();
    s?.setItem(CHAVE_EFEITOS, JSON.stringify(normalizarEfeitos(lista)));
  } catch {
    /* cota cheia ou modo privado: perder o acervo é ruim, derrubar a tela do
       mestre no meio da sessão é pior. */
  }
}

/* ── Operações (todas devolvem lista nova, nunca mutam) ─────────────────── */

export function adicionarEfeito(lista, efeito) {
  if (!efeito?.id || !efeito?.fileId) return normalizarEfeitos(lista);
  const atual = normalizarEfeitos(lista);
  if (atual.some((e) => e.id === String(efeito.id))) return atual;
  return [...atual, {
    id: String(efeito.id),
    fileId: String(efeito.fileId),
    nome: String(efeito.nome || "Efeito").slice(0, 60),
    volume: limitarVolume(efeito.volume ?? VOLUME_PADRAO),
  }];
}

export const removerEfeito = (lista, id) =>
  normalizarEfeitos(lista).filter((e) => e.id !== String(id));

export function renomearEfeito(lista, id, nome) {
  const limpo = String(nome || "").trim();
  if (!limpo) return normalizarEfeitos(lista);   // nome vazio não apaga o rótulo
  return normalizarEfeitos(lista).map((e) =>
    e.id === String(id) ? { ...e, nome: limpo.slice(0, 60) } : e);
}

export const definirVolume = (lista, id, volume) =>
  normalizarEfeitos(lista).map((e) =>
    e.id === String(id) ? { ...e, volume: limitarVolume(volume) } : e);

/* ── Apoio ────────────────────────────────────────────────────────────────
 * "3-porta_rangendo.MP3" → "Porta rangendo". O mestre importa em lote; sem
 * isto ele renomearia trinta botões à mão. */
export function nomeAmigavel(nomeArquivo) {
  const semExt = String(nomeArquivo || "").replace(/\.[a-z0-9]{1,5}$/i, "");
  const limpo = semExt
    .replace(/^[\d\s._-]+/, "")        // numeração de ordem no começo
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!limpo) return "Efeito";
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

/** Ids dos arquivos que a mesa usa — para não apagar do IndexedDB um arquivo
 *  que ainda é efeito quando o mestre limpa a biblioteca de música. */
export const arquivosEmUso = (lista) =>
  new Set(normalizarEfeitos(lista).map((e) => e.fileId));
