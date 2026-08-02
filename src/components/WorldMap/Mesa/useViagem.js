/* ════════════════════════════════════════════════════════════════════
 *  A VIAGEM NA TELA  (spec 0028 · F4 · AC-6, AC-8, AC-11 · design §5.4)
 *  --------------------------------------------------------------------
 *  O pedido do Andre, literal:
 *
 *    "eu quero que tenha a animação no mapa mundi deles seguindo pela linha
 *     e ir indo desbloqueando o mapa aos pouquinhos"
 *
 *  Este hook é a metade "seguindo pela linha"; o "desbloqueando aos
 *  pouquinhos" é o `aoAndar` que quem chama passa — a cada quadro ele
 *  recebe a viagem e abre a névoa sobre o trecho JÁ PERCORRIDO
 *  (`nevoaDaViagem`). A névoa não espera a chegada.
 *
 *  ── POR QUE dt REAL, E NÃO UM PASSO FIXO ────────────────────────────
 *  `requestAnimationFrame` não promete 60 Hz: a aba em segundo plano cai
 *  para 1 Hz, um monitor de 144 Hz sobe para 144. Com passo fixo a viagem
 *  duraria coisas diferentes em máquinas diferentes — e a névoa (que é
 *  estado de jogo, não enfeite) abriria em ritmo diferente para cada um.
 *  Com `dt` real ela dura o que `velocidadeDaViagem` mandou, em qualquer
 *  máquina. O `dt` é grampeado em `DT_MAXIMO` porque o quadro perdido de
 *  uma aba que volta do segundo plano chegaria com segundos acumulados e
 *  teleportaria o marcador.
 *
 *  ── MOVIMENTO REDUZIDO (AC-11) ──────────────────────────────────────
 *  `prefers-reduced-motion` **não cancela a viagem** — cancela o percurso
 *  animado. A névoa abre igual (uma chamada só, sobre o caminho inteiro) e
 *  a chegada acontece igual. Quem pediu menos movimento pediu menos
 *  movimento, não menos jogo.
 *
 *  ── PARAR NO MEIO DA ESTRADA (F7) ───────────────────────────────────
 *  `pausar()` desliga o laço mas **mantém a viagem**: o marcador fica onde
 *  parou e o grupo passa a estar *em trânsito* — que é o estado que o
 *  acampamento da F6 exigia e nunca teve (`podeAcampar({viajando:true})`
 *  só era verdade durante os poucos segundos da animação). `retomar()`
 *  religa o laço de onde estava.
 *
 *  Daí a separação entre `viagem` (existe um percurso em curso) e
 *  `viajando` (o marcador está se movendo AGORA). Quem desabilita botão
 *  olha `viajando`; quem pergunta "o grupo está entre dois lugares?" olha
 *  `viagem`.
 *
 *  ── RETOMAR DEPOIS DE UM RECARREGAMENTO (F7 · AC-10) ────────────────
 *  `comecar(..., { progresso })` começa a viagem já andada. É o que faz o
 *  F5 no meio da estrada devolver o grupo onde ele estava, em vez de
 *  teleportá-lo para o destino ou fazê-lo recomeçar o trecho.
 *
 *  ── DESMONTAGEM ─────────────────────────────────────────────────────
 *  O quadro pendente é cancelado no unmount, e um `vivo` de guarda impede
 *  que um `aoChegar` em voo escreva no Firestore depois que a tela morreu.
 *
 *  Gate: `__tests__/viagem.test.js` e `__tests__/f7-tempo-real.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { avancarViagem, iniciarViagem } from "../model/viagem";
import { velocidadeDaViagem } from "./mesaUi";

/** Teto do `dt` de um quadro, em segundos. Aba que volta do sono não teleporta. */
export const DT_MAXIMO = 0.1;

/** `prefers-reduced-motion: reduce` está ligado? (jsdom sem matchMedia → não) */
export function movimentoReduzido() {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return !!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * @param {object} opcoes
 * @param {(viagem:object)=>void} [opcoes.aoAndar] chamado a cada quadro, com a
 *   viagem já avançada. É aqui que a névoa abre ao longo do caminho.
 * @param {(viagem:object)=>void} [opcoes.aoChegar] chamado uma vez, no fim.
 * @param {(mensagem:string)=>void} [opcoes.aoFalhar] recusa em PT-BR.
 * @param {boolean} [opcoes.reduzido] força o corte seco (o padrão consulta a
 *   preferência do sistema).
 * @returns {{viagem:object|null, viajando:boolean,
 *            comecar:(grafo:object,deId:string,paraId:string,trilha?:object,extra?:object)=>boolean,
 *            pausar:()=>void, retomar:()=>boolean, cancelar:()=>void}}
 */
export default function useViagem({ aoAndar, aoChegar, aoFalhar, reduzido } = {}) {
  const [viagem, setViagem] = useState(null);
  const [andando, setAndando] = useState(false);
  const quadro = useRef(0);
  const curso = useRef(null);   // { viagem, velocidade, ultimo }
  const vivo = useRef(true);

  /* Callbacks em ref: trocar de handler não pode reiniciar o laço no meio da
     viagem (e eles mudam a cada render, porque fecham sobre o estado da mesa). */
  const andarRef = useRef(aoAndar);
  const chegarRef = useRef(aoChegar);
  const falharRef = useRef(aoFalhar);
  andarRef.current = aoAndar;
  chegarRef.current = aoChegar;
  falharRef.current = aoFalhar;

  /** Desliga o laço. `manter` preserva o curso para um `retomar()` depois. */
  const parar = useCallback((manter = false) => {
    if (quadro.current && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(quadro.current);
    }
    quadro.current = 0;
    if (!manter) curso.current = null;
    else if (curso.current) curso.current.ultimo = null;   // o dt não conta a pausa
    setAndando(false);
  }, []);

  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; parar(); };
  }, [parar]);

  const cancelar = useCallback(() => {
    parar();
    setViagem(null);
  }, [parar]);

  const passo = useCallback((agora) => {
    const atual = curso.current;
    if (!atual || !vivo.current) return;

    const marca = Number.isFinite(agora) ? agora : 0;
    const dt = atual.ultimo === null ? 0 : Math.min(DT_MAXIMO, Math.max(0, (marca - atual.ultimo) / 1000));
    atual.ultimo = marca;

    const proxima = avancarViagem(atual.viagem, dt, atual.velocidade);
    atual.viagem = proxima;
    setViagem(proxima);
    if (andarRef.current) andarRef.current(proxima);

    if (proxima.chegou) {
      parar();
      setViagem(null);
      if (chegarRef.current) chegarRef.current(proxima);
      return;
    }
    quadro.current = requestAnimationFrame(passo);
  }, [parar]);

  /** Para o marcador SEM encerrar a viagem: o grupo fica em trânsito (F7). */
  const pausar = useCallback(() => {
    if (!quadro.current) return;
    parar(true);
  }, [parar]);

  /** Religa o laço de onde a pausa deixou. `false` se não havia o que retomar. */
  const retomar = useCallback(() => {
    const atual = curso.current;
    if (!atual || quadro.current || !vivo.current) return false;
    atual.ultimo = null;
    setAndando(true);
    quadro.current = requestAnimationFrame(passo);
    return true;
  }, [passo]);

  /**
   * Começa a viagem. Devolve `false` (e chama `aoFalhar`) quando o grafo não
   * comporta o percurso — a recusa vem em português do `model/viagem.js`.
   *
   * `extra` é mesclado na viagem e sobrevive a `avancarViagem` (que espalha o
   * objeto): é assim que a Mesa marca `{ remoto: true }` para uma viagem que
   * nasceu do movimento de OUTRO cliente e não deve ser regravada.
   */
  const comecar = useCallback((grafo, deId, paraId, trilha, extra) => {
    let inicial;
    try {
      inicial = { ...iniciarViagem(grafo, deId, paraId, trilha), ...(extra || {}) };
      /* Retomada (F7): `extra.progresso` chega de `party.viagem`, e a posição
         tem de ser recalculada ANTES do primeiro quadro — senão o marcador
         pisca uma vez no começo da estrada antes de saltar para onde o grupo
         realmente está. `avancarViagem(_, 0)` faz exatamente isso e nada mais:
         ele não anda, só resolve a posição do progresso informado. */
      if (Number.isFinite(extra?.progresso) && extra.progresso > 0) {
        inicial = { ...avancarViagem(inicial, 0), ...(extra || {}) };
        inicial.chegou = inicial.progresso >= 1;
      }
    } catch (err) {
      if (falharRef.current) falharRef.current(err?.message || "Não deu para começar a viagem.");
      return false;
    }

    parar();

    const semPercurso = reduzido === undefined ? movimentoReduzido() : !!reduzido;

    /* Corte seco: a viagem inteira num passo. A névoa abre sobre o caminho
       completo (o `aoAndar` recebe a viagem já em t=1) e a chegada acontece —
       o que não acontece é o marcador rastejar pela curva. */
    if (semPercurso || !(inicial.comprimento > 0)) {
      const final = avancarViagem(inicial, 1);
      setViagem(null);
      if (andarRef.current) andarRef.current(final);
      if (chegarRef.current) chegarRef.current(final);
      return true;
    }

    curso.current = {
      viagem: inicial,
      velocidade: velocidadeDaViagem(inicial, extra?.ritmo),
      ultimo: null,
    };
    setViagem(inicial);
    setAndando(true);
    if (andarRef.current) andarRef.current(inicial);
    quadro.current = requestAnimationFrame(passo);
    return true;
  }, [parar, passo, reduzido]);

  /* `viagem` é "existe um percurso em curso" (inclusive parado, em trânsito);
     `viajando` é "o marcador está andando AGORA". Ver o cabeçalho. */
  return { viagem, viajando: andando && !!viagem, emTransito: !!viagem && !andando, comecar, pausar, retomar, cancelar };
}
