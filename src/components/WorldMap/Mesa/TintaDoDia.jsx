/* ════════════════════════════════════════════════════════════════════
 *  A TINTA DE HORA DO DIA  (spec 0028 · F7 · AC-11 · design §5.4, mov. 5)
 *  --------------------------------------------------------------------
 *  *"a ilustração recebe uma camada de cor puxada de `party.inGameDatetime`:
 *  quente ao meio-dia, âmbar no poente, fria e azulada à noite. Amarra o
 *  relógio a algo visível, em vez de um número no canto."*
 *
 *  ── POR QUE QUATRO CAMADAS, E NÃO UMA QUE MUDA DE COR ────────────────
 *  Transição de `background-color` é interpolação de PINTURA: o navegador
 *  repinta a camada inteira a cada quadro, e numa camada do tamanho do palco
 *  isso é o oposto do que o AC-11 pede. Quatro camadas fixas, empilhadas, com
 *  uma só variando de `opacity`, é composição pura na GPU — mesma regra da
 *  deriva da névoa (design §5.4: *"tudo em `transform` e `opacity`"*).
 *
 *  Custa três elementos vazios a mais no DOM, todos em `opacity:0`, todos
 *  `pointer-events:none`. É barato, e é o preço de não repintar.
 *
 *  ── ONDE ELA ENTRA NA PILHA ─────────────────────────────────────────
 *      camada 0 · DOM    ilustração vetorial
 *      camada 1 · CANVAS ilustração do usuário + trilhas + rastro
 *   →  camada 1½ · DOM   **A TINTA**
 *      camada 2 · CANVAS névoa
 *      camada 3 · DOM    nós, rótulos e marcador
 *
 *  ABAIXO da névoa (a névoa é fria por natureza e não deve virar âmbar) e
 *  ABAIXO dos nós — é isso que mantém a cor dos ícones e dos rótulos
 *  intocada em qualquer período, e reduz a conta de contraste a
 *  figura-contra-fundo. Ver o cabeçalho de `animacaoUi.js` para os números.
 *
 *  ── OS TRÊS DESLIGAMENTOS (AC-11) ───────────────────────────────────
 *   1. `prefers-reduced-motion` **corta a tinta** — não é "corta a
 *      transição": o AC lista a tinta junto da deriva e do respiro. Quem
 *      pediu menos movimento vê o mapa na cor da ilustração, e nada mais;
 *   2. fora do viewport a travessia não roda (o palco desliga pelo
 *      `data-anima`, ver `MesaStyles.jsx`);
 *   3. sem relógio, sem tinta — `periodoDaTinta` devolve `null`.
 * ════════════════════════════════════════════════════════════════════ */

import { PERIODOS, TINTA_DO_DIA, periodoDaTinta } from "./animacaoUi";

/**
 * @param {object} props
 * @param {number|object|null} [props.relogio] o `party.inGameDatetime` CRU.
 * @param {boolean} [props.ligada] `false` = corte seco (movimento reduzido,
 *   ou quem embute a mesa querendo o mapa parado).
 */
export default function TintaDoDia({ relogio = null, ligada = true }) {
  const periodo = ligada ? periodoDaTinta(relogio) : null;
  if (!ligada) return null;

  return (
    <div
      className="wmm-tinta"
      data-testid="wmm-tinta"
      data-periodo={periodo || "neutro"}
      aria-hidden="true"
    >
      {PERIODOS.map((p) => (
        <span
          key={p}
          className="wmm-tinta-camada"
          data-periodo={p}
          data-acesa={p === periodo ? "sim" : undefined}
          style={{ background: TINTA_DO_DIA[p].fundo, opacity: p === periodo ? 1 : 0 }}
        />
      ))}
    </div>
  );
}
