/* ════════════════════════════════════════════════════════════════════
 *  A NÉVOA AO VIVO — quem transmite, quando e o quê  (spec 0028 · F7 · AC-10)
 *  --------------------------------------------------------------------
 *  *"a névoa trafega em deltas, com flush consolidado — nunca o bitmap
 *  inteiro a cada passo"*.
 *
 *  Este hook é o único lugar da mesa que escreve névoa. A POLÍTICA (delta
 *  ou consolidação) não mora aqui: mora em `model/fogDelta.js`, que é
 *  lógica pura e testável sem React nem Firebase. Aqui mora só o ritmo —
 *  o throttle, o retry e o fecho.
 *
 *  ── O RITMO, E POR QUE ESTES NÚMEROS ────────────────────────────────
 *  · **300 ms, trailing** entre deltas. É a cadência com que o editor
 *    tático já publica a posição do token do jogador. A viagem chama a
 *    névoa a CADA QUADRO (60 Hz); sem o throttle isso seria uma escrita
 *    por quadro, que é exatamente o que o AC-10 proíbe.
 *  · **10 s (ou 20 deltas)** entre consolidações. Ver
 *    `INTERVALO_DA_CONSOLIDACAO_MS`.
 *  · **`fim: true`** força a consolidação na chegada e ao sair da tela.
 *
 *  ── FALHA DE REDE NÃO PODE TRAVAR A MESA ────────────────────────────
 *  Se a escrita falha, a névoa **já está aplicada localmente** e o grupo
 *  já a viu; o que não avança é o `enviada` (o que sabemos que o servidor
 *  tem). Como o próximo delta é sempre calculado contra `enviada`, a
 *  revelação perdida entra no delta seguinte sozinha — sem fila, sem
 *  retry explícito, sem estado a mais. É a mesma propriedade de união que
 *  faz o delta ser idempotente.
 *
 *  Isso é o oposto do bug conhecido do editor tático, onde `lastPubRef`
 *  avança ANTES do commit e a alteração some para sempre (STATE, 2026-07-25).
 *
 *  ── O QUE O DELTA CONTA ─────────────────────────────────────────────
 *  Nada além de geometria: bits de células que acenderam, no mesmo formato
 *  da F3. Não carrega nome de lugar, trilha, evento nem texto de mestre —
 *  o segredo continua sendo garantido pela separação de documento (AC-1),
 *  e a névoa nunca foi o mecanismo dele.
 *
 *  Gate: `__tests__/f7-fog-delta.test.js` e `__tests__/f7-tempo-real.test.js`.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef } from "react";
import { clonar, mesclar, mesmaGrade } from "../model/fogMask";
import {
  INTERVALO_DA_CONSOLIDACAO_MS, INTERVALO_DO_DELTA_MS, MAXIMO_DE_DELTAS,
  TIPO_CONSOLIDADO, TIPO_DELTA, planejarTransmissao,
} from "../model/fogDelta";
import { consolidarNevoaDaMesa, salvarDeltaDaNevoa } from "../mesaStore";

/** Sessão desta aba — entra no id do delta para duas abas não se colidirem. */
export function novaSessao() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * @param {object} opcoes
 * @param {string} opcoes.campaignId
 * @param {string} opcoes.instanciaId
 * @param {object|null} opcoes.mascara a máscara VIVA da mesa (mutada em lugar).
 * @param {number} opcoes.revisao contador que muda quando a máscara muda.
 * @param {boolean} [opcoes.ativo] falso desliga a transmissão (jogador que não
 *   escreve névoa, mesa sem névoa, instância ainda não escolhida).
 * @param {(erro:Error)=>void} [opcoes.aoFalhar]
 * @param {number} [opcoes.intervalo] janela do throttle (teste).
 * @param {()=>number} [opcoes.agora] relógio injetável (teste).
 * @returns {{transmitir:(opcoes?:{fim?:boolean})=>Promise<object>,
 *            registrarRemota:(mascara:object|null, substituiu?:boolean)=>void,
 *            pendentes:()=>number}}
 */
export default function useNevoaAoVivo({
  campaignId,
  instanciaId,
  mascara,
  revisao,
  ativo = true,
  aoFalhar,
  intervalo = INTERVALO_DO_DELTA_MS,
  agora,
}) {
  const dados = useRef({
    enviada: null,     // o que sabemos que o servidor tem
    deltas: [],        // ids dos deltas pendentes de consolidação
    desde: null,       // quando foi a última consolidação
    n: 0,              // contador local, só para o id ficar legível
    sessao: novaSessao(),
    timer: 0,
    esperando: false,  // há transmissão agendada?
    emVoo: false,      // há escrita em andamento? (não empilhar)
    sujo: false,       // mudou enquanto escrevia (ou a escrita falhou)
  });

  const ctx = useRef({});
  ctx.current = { campaignId, instanciaId, mascara, ativo, aoFalhar, agora };

  /* Trocar de mapa zera tudo: a névoa do próximo não tem nada a ver com a
     deste, e um `enviada` sobrevivente faria o primeiro delta do mapa novo
     ser calculado contra o mapa antigo. */
  useEffect(() => {
    const d = dados.current;
    d.enviada = null;
    d.deltas = [];
    d.desde = null;
    d.sujo = false;
    return () => {
      if (d.timer) clearTimeout(d.timer);
      d.timer = 0;
      d.esperando = false;
    };
  }, [campaignId, instanciaId]);

  /**
   * Transmite agora, se houver o que transmitir.
   *
   * @param {{fim?:boolean}} [opcoes] `fim` força a consolidação (chegada,
   *   troca de mapa, saída da tela).
   * @returns {Promise<{tipo:string, motivo:string, bytes:number}>}
   */
  const transmitir = useCallback(async (opcoes = {}) => {
    const c = ctx.current;
    const d = dados.current;
    if (!c.ativo || !c.campaignId || !c.instanciaId || !c.mascara) {
      return { tipo: "nada", motivo: "sem-mesa", bytes: 0 };
    }
    if (d.emVoo) { d.sujo = true; return { tipo: "nada", motivo: "em-voo", bytes: 0 }; }

    const relogio = typeof c.agora === "function" ? c.agora : Date.now;
    const plano = planejarTransmissao(d.enviada, c.mascara, {
      deltas: d.deltas.length,
      desde: d.desde,
      agora: relogio(),
      fim: !!opcoes.fim,
      intervalo: INTERVALO_DA_CONSOLIDACAO_MS,
      maximo: MAXIMO_DE_DELTAS,
    });
    if (plano.tipo !== TIPO_DELTA && plano.tipo !== TIPO_CONSOLIDADO) {
      return { tipo: plano.tipo, motivo: plano.motivo, bytes: 0 };
    }

    /* A foto do que está sendo enviado é tirada AGORA: a máscara é mutável e
       pode ganhar células durante o `await`. Avançar `enviada` para a máscara
       viva no fim da escrita marcaria como entregue algo que nunca saiu. */
    const foto = clonar(c.mascara);
    d.emVoo = true;
    d.sujo = false;

    try {
      let bytes = 0;
      if (plano.tipo === TIPO_DELTA) {
        d.n += 1;
        const r = await salvarDeltaDaNevoa(c.campaignId, c.instanciaId, plano.mascara, {
          sessao: d.sessao, n: d.n,
        });
        d.deltas.push(r.id);
        bytes = r.bytes;
      } else {
        const r = await consolidarNevoaDaMesa(c.campaignId, c.instanciaId, plano.mascara, {
          deltas: d.deltas.slice(),
          regrediu: plano.regrediu,
        });
        d.deltas = [];
        d.desde = relogio();
        bytes = r.bytes;
      }
      d.enviada = foto;
      return { tipo: plano.tipo, motivo: plano.motivo, bytes };
    } catch (err) {
      /* Nada de avançar `enviada`: o que falhou volta no próximo delta. A mesa
         não trava e a revelação já aplicada na tela continua lá. */
      d.sujo = true;
      console.error("[mesa do mapa] a névoa não pôde ser transmitida:", err);
      if (c.aoFalhar) c.aoFalhar(err);
      return { tipo: "falhou", motivo: plano.motivo, bytes: 0 };
    } finally {
      d.emVoo = false;
    }
  }, []);

  /** Agenda uma transmissão no fim da janela (trailing, uma por janela). */
  const agendar = useCallback(() => {
    const d = dados.current;
    if (d.esperando) return;
    d.esperando = true;
    d.timer = setTimeout(() => {
      d.esperando = false;
      d.timer = 0;
      transmitir().then((r) => {
        /* Mudou durante a escrita (ou a escrita falhou): reabre a janela em vez
           de esperar a próxima pincelada, senão a última revelação de uma
           viagem ficaria só na tela de quem a fez. */
        if (dados.current.sujo && !dados.current.esperando) agendar();
        return r;
      });
    }, Math.max(0, intervalo));
  }, [transmitir, intervalo]);

  /* Cada mudança da máscara agenda; o throttle é que decide quando sai. */
  useEffect(() => {
    if (!ativo || !revisao) return;
    agendar();
  }, [revisao, ativo, agendar]);

  /* Sair da tela consolida o que ficou pendente. Não dá para esperar a promessa
     num cleanup — dispara e segue, e isso é o certo: o delta já gravado
     sobrevive de qualquer forma, porque consolidar é COMPACTAR, não durar.
     Sem `campaignId`/`instanciaId` nas dependências de propósito: na troca de
     mapa o `ctx` já aponta para o mapa NOVO, e consolidar ali gravaria a névoa
     de um mundo no documento do outro. */
  useEffect(() => () => {
    const d = dados.current;
    if (d.timer) clearTimeout(d.timer);
    d.esperando = false;
    transmitir({ fim: true });
  }, [transmitir]);

  /**
   * Anota o que CHEGOU do servidor: aquilo já está lá e não precisa ser
   * reenviado. Sem isto, um cliente que recebe a consolidação de outro
   * continuaria mandando deltas com células que o servidor já tem.
   *
   * @param {object|null} remota a máscara lida do servidor (base + deltas).
   * @param {boolean} [substituiu] a mesa trocou a máscara local por esta
   *   (recobertura). Aí `enviada` é exatamente ela, não a união.
   */
  const registrarRemota = useCallback((remota, substituiu = false) => {
    const d = dados.current;
    if (!remota || !remota.bits) return;
    if (substituiu || !d.enviada || !mesmaGrade(d.enviada, remota)) {
      d.enviada = clonar(remota);
      return;
    }
    d.enviada = mesclar(d.enviada, remota);
  }, []);

  return {
    transmitir,
    registrarRemota,
    pendentes: () => dados.current.deltas.length,
  };
}
