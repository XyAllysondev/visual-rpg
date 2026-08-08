/* ════════════════════════════════════════════════════════════════════
 *  DADOS DO PAINEL  (plano "Painel — de índice de recursos a estado do jogo")
 *  --------------------------------------------------------------------
 *  DECISÃO DE PROJETO, e é a mais importante deste arquivo:
 *  o Painel abre ZERO listeners novos.
 *
 *  A tela inicial é onde o app passa mais tempo ocioso. Se ela assinasse
 *  rolagens, presença e party de cada campanha, seriam ~4 assinaturas por
 *  campanha — 12 abertas com três campanhas, queimando cota do Firestore
 *  para desenhar informação que ninguém está olhando.
 *
 *  Então aqui só existem duas coisas:
 *   · `getDocs` ONE-SHOT (contagem de mapas, edições pendentes);
 *   · derivação de dado que o App JÁ tem em memória (fichas, campanhas).
 *
 *  Regra 0029 AC-1: nada em `features/**` importa `firebase/firestore`.
 *  Toda leitura passa por repositório.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { contarMapas } from "../../infrastructure/firestore/worldMapsRepo";
import { listPendingEdits } from "../../infrastructure/firestore/publicSheetsRepo";
import { CHAVE_PREP_DONE } from "./PrepChecklist";

/** Cache da contagem de mapas: `sessionStorage`, uma leitura por aba. */
export const PREFIXO_CACHE_MAPAS = "nx_mapcount_";

/** Os quatro passos, na ordem do MESTRE — foi a escolha do Andre: ele abre o
 *  Nexus principalmente para preparar. Constrói o mundo, desenha o mapa,
 *  abre a mesa, e só então a ficha. Um checklist na ordem errada ensina o
 *  caminho errado. */
export const PASSOS = Object.freeze([
  { id: "mundo",    label: "Montar seu mundo na Forja",     nav: "master" },
  { id: "mapa",     label: "Desenhar um mapa",              nav: "map"    },
  { id: "campanha", label: "Criar ou entrar numa campanha", nav: "party"  },
  { id: "ficha",    label: "Criar sua primeira ficha",      nav: "sheet"  },
]);

const lista = (v) => (Array.isArray(v) ? v : []);

function pegarSession(chave) {
  try {
    const v = window.sessionStorage?.getItem(chave);
    const n = Number(v);
    return v !== null && Number.isFinite(n) ? n : null;
  } catch { return null; }
}
function porSession(chave, valor) {
  try { window.sessionStorage?.setItem(chave, String(valor)); } catch { /* cota/privado */ }
}
function prepJaConcluido() {
  try { return window.localStorage?.getItem(CHAVE_PREP_DONE) === "1"; } catch { return false; }
}
export function marcarPrepConcluido() {
  try { window.localStorage?.setItem(CHAVE_PREP_DONE, "1"); } catch { /* idem */ }
}

/** Sinal barato de "já mexeu na Forja": a chave do mundo ativo, que a
 *  própria Forja grava ao abrir um mundo (`worldsStore`). Contar mundos de
 *  verdade custaria uma leitura a mais no cabeçalho de uma tela que o mestre
 *  veterano nem olha — e o checklist some assim que os quatro passos fecham.
 *  Sinal barato para dado descartável. */
function temMundoNaForja(uid) {
  try {
    const v = window.localStorage?.getItem(`nexus.forja.activeWorld.${uid}`);
    return typeof v === "string" && v.trim().length > 0;
  } catch { return false; }
}

/** Fichas que existem publicamente e por isso PODEM receber sugestão de
 *  edição. Consultar as outras seria leitura garantidamente vazia. */
const idsPublicos = (characters) =>
  lista(characters)
    .filter((c) => c && c.public && c.id)
    .map((c) => c.id);

/**
 * @param {{uid:string, characters:Array, campaigns:Array}} entrada
 * @returns {{mapCount:number, pendentes:Array, prep:Array, prepConcluido:boolean, carregando:boolean}}
 */
export default function useDashboardData({ uid = "", characters = [], campaigns = [] } = {}) {
  const [mapCount, setMapCount] = useState(() => pegarSession(PREFIXO_CACHE_MAPAS + uid) ?? 0);
  const [pendentes, setPendentes] = useState([]);
  const [carregando, setCarregando] = useState(false);

  /* RISCO 1 do plano: depender do ARRAY `characters` re-dispara o efeito a
   * cada render do App, e cada disparo são N leituras. A dependência é uma
   * STRING estável — só muda quando o conjunto de fichas públicas muda de
   * verdade. É o padrão que o App já usa para o listener de fichas ao vivo. */
  const chavePublicas = useMemo(() => idsPublicos(characters).join("|"), [characters]);

  /* Mapa de id → nome, para a pendência dizer "em 'Marcos Vidal'" em vez de
   * um id. Fora do efeito de rede: renomear a ficha não deve refazer leitura. */
  const nomePorId = useMemo(() => {
    const m = new Map();
    lista(characters).forEach((c) => {
      if (c?.id) m.set(c.id, c.form?.personagem || c.nome || "ficha");
    });
    return m;
  }, [characters]);

  /* ── Contagem de mapas — uma leitura por aba ────────────────────────── */
  useEffect(() => {
    if (!uid) { setMapCount(0); return undefined; }

    const cacheado = pegarSession(PREFIXO_CACHE_MAPAS + uid);
    if (cacheado !== null) { setMapCount(cacheado); return undefined; }

    let vivo = true;
    contarMapas(uid)
      .then((n) => {
        if (!vivo) return;
        const total = Number.isFinite(n) ? n : 0;
        setMapCount(total);
        porSession(PREFIXO_CACHE_MAPAS + uid, total);
      })
      /* Falha aqui não merece alarde: é um número no cabeçalho, não uma
       * ação do mestre. Fica em 0 e a tela segue inteira. */
      .catch(() => { if (vivo) setMapCount(0); });

    return () => { vivo = false; };
  }, [uid]);

  /* ── Edições pendentes — o item de maior valor do Painel ────────────── */
  useEffect(() => {
    const ids = chavePublicas ? chavePublicas.split("|") : [];
    if (!uid || ids.length === 0) { setPendentes([]); return undefined; }

    let vivo = true;
    setCarregando(true);
    Promise.all(
      ids.map((charId) =>
        listPendingEdits(charId)
          .then((edicoes) => ({ charId, quantidade: lista(edicoes).length }))
          .catch(() => ({ charId, quantidade: 0 })),
      ),
    )
      .then((res) => {
        if (!vivo) return;
        setPendentes(
          res
            .filter((r) => r.quantidade > 0)
            .map((r) => ({ ...r, charNome: nomePorId.get(r.charId) || "ficha" })),
        );
      })
      .finally(() => { if (vivo) setCarregando(false); });

    return () => { vivo = false; };
    /* `nomePorId` de propósito FORA das dependências: ele muda quando o
     * mestre renomeia a ficha, e isso não pode custar N leituras. O nome
     * é cosmético; a próxima montagem o corrige. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, chavePublicas]);

  /* ── Checklist de preparo — derivado, nenhuma leitura ───────────────── */
  const prep = useMemo(() => {
    const feito = {
      mundo: !!uid && temMundoNaForja(uid),
      mapa: mapCount > 0,
      campanha: lista(campaigns).length > 0,
      ficha: lista(characters).length > 0,
    };
    return PASSOS.map((p) => ({ ...p, done: !!feito[p.id] }));
  }, [uid, mapCount, campaigns, characters]);

  const todosFeitos = prep.every((p) => p.done);

  /* Concluído é PEGAJOSO: uma vez marcado, o bloco não volta. Sem isso, o
   * mestre que apagasse a última campanha veria o onboarding ressuscitar —
   * o app achando que ele esqueceu como usar. */
  const [prepConcluido, setPrepConcluido] = useState(prepJaConcluido);
  useEffect(() => {
    if (todosFeitos && !prepConcluido) { marcarPrepConcluido(); setPrepConcluido(true); }
  }, [todosFeitos, prepConcluido]);

  /** Invalida o cache da contagem — para quem acabou de criar um mapa. */
  const recarregarMapas = useCallback(() => {
    try { window.sessionStorage?.removeItem(PREFIXO_CACHE_MAPAS + uid); } catch { /* noop */ }
  }, [uid]);

  return { mapCount, pendentes, prep, prepConcluido, carregando, recarregarMapas };
}
