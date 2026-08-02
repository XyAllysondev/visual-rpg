/**
 * A POLÍTICA DE TRANSMISSÃO DA NÉVOA (spec 0028 · F7 · gate do AC-10).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O TESTE MAIS IMPORTANTE DESTE ARQUIVO
 *
 * `recobrir vai CONSOLIDADO, nunca como delta`. Um delta só sabe dizer o que
 * ACENDEU; se o mestre apaga névoa e isso viaja como delta, o outro cliente
 * continua com o mapa aberto — e pior, achando que está em dia. Aqui isso é
 * verificado por MUTAÇÃO: o teste do fim quebra a barreira de propósito
 * (`diferenca` no lugar de `planejarTransmissao`) e mostra que sem ela o
 * recobrimento simplesmente desaparece do que seria transmitido.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Lógica pura: nenhum React, nenhum Firebase, nenhum relógio real.
 */
import {
  clonar, cobrirCirculo, contarReveladas, criarMascara, iguais, mesclar,
  revelarCirculo, revelarTudo, vazia, diferenca,
} from "../model/fogMask";
import {
  INTERVALO_DA_CONSOLIDACAO_MS, INTERVALO_DO_DELTA_MS, MAXIMO_DE_DELTAS, MOTIVOS,
  TIPO_CONSOLIDADO, TIPO_DELTA, TIPO_NADA,
  absorver, aplicarDelta, aplicarRemota, ehDelta, houveRegressao, idDoDelta,
  mesclarRecebidos, planejarTransmissao, precisaConsolidar,
} from "../model/fogDelta";

const MUNDO = { largura: 1200, altura: 800 };
const nova = () => criarMascara(MUNDO.largura, MUNDO.altura);

/** Uma máscara com um círculo aberto — o que uma chegada produz. */
const comClareira = (x = 300, y = 300, raio = 90) => {
  const m = nova();
  revelarCirculo(m, x, y, raio);
  return m;
};

/* ════════════════════════════════════════════════════════════════════
 *  1 · O CONTRATO: delta aplicado reproduz o estado
 * ══════════════════════════════════════════════════════════════════ */

describe("o delta reproduz o estado", () => {
  test("mesclar(antes, delta) é exatamente `depois` — bit a bit", () => {
    const antes = comClareira(200, 200, 80);
    const depois = clonar(antes);
    revelarCirculo(depois, 700, 400, 120);

    const plano = planejarTransmissao(antes, depois, { deltas: 0, desde: null });
    expect(plano.tipo).toBe(TIPO_DELTA);

    const reconstruida = mesclar(antes, plano.mascara);
    expect(iguais(reconstruida, depois)).toBe(true);
    expect(contarReveladas(reconstruida)).toBe(contarReveladas(depois));
  });

  test("o delta carrega SÓ o que nasceu agora — não é a máscara inteira", () => {
    const antes = comClareira(200, 200, 120);
    const depois = clonar(antes);
    revelarCirculo(depois, 900, 500, 40);

    const plano = planejarTransmissao(antes, depois, { deltas: 0, desde: null });
    const noDelta = contarReveladas(plano.mascara);
    expect(noDelta).toBeGreaterThan(0);
    expect(noDelta).toBeLessThan(contarReveladas(antes));   // muito menor que o todo
  });

  test("a ordem de chegada não importa, e repetir não muda nada (união)", () => {
    const base = comClareira(150, 150, 60);
    const passo1 = clonar(base); revelarCirculo(passo1, 400, 300, 60);
    const passo2 = clonar(passo1); revelarCirculo(passo2, 800, 600, 60);

    const d1 = diferenca(base, passo1);
    const d2 = diferenca(passo1, passo2);

    const naOrdem = mesclarRecebidos(base, [d1, d2]);
    const aoContrario = mesclarRecebidos(base, [d2, d1]);
    const repetido = mesclarRecebidos(base, [d2, d1, d1, d2]);

    expect(iguais(naOrdem, passo2)).toBe(true);
    expect(iguais(aoContrario, passo2)).toBe(true);
    expect(iguais(repetido, passo2)).toBe(true);
  });

  test("delta vazio não é transmitido — nada mudou, nada sai", () => {
    const m = comClareira();
    const plano = planejarTransmissao(m, clonar(m), { deltas: 0, desde: null });
    expect(plano.tipo).toBe(TIPO_NADA);
    expect(plano.motivo).toBe(MOTIVOS.SEM_MUDANCA);
    expect(plano.mascara).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · RECOBRIR NÃO CABE EM DELTA  (o item mais importante)
 * ══════════════════════════════════════════════════════════════════ */

describe("recobrir vai consolidado, nunca como delta", () => {
  test("o pincel do mestre apagando névoa força a máscara inteira", () => {
    const antes = nova();
    revelarTudo(antes);
    const depois = clonar(antes);
    cobrirCirculo(depois, 600, 400, 150);          // o mestre recobre

    expect(houveRegressao(antes, depois)).toBe(true);

    const plano = planejarTransmissao(antes, depois, { deltas: 0, desde: null });
    expect(plano.tipo).toBe(TIPO_CONSOLIDADO);
    expect(plano.motivo).toBe(MOTIVOS.RECOBERTURA);
    expect(plano.regrediu).toBe(true);
    expect(iguais(plano.mascara, depois)).toBe(true);
  });

  test("a regressão vence QUALQUER atalho de janela — ela é testada antes", () => {
    const antes = nova();
    revelarTudo(antes);
    const depois = clonar(antes);
    cobrirCirculo(depois, 200, 200, 60);

    /* Janela recém-aberta, nenhum delta pendente: a política diria "delta"
       para qualquer outra mudança. Aqui não pode. */
    const plano = planejarTransmissao(antes, depois, {
      deltas: 0, desde: 1_000, agora: 1_010, intervalo: INTERVALO_DA_CONSOLIDACAO_MS,
    });
    expect(plano.tipo).toBe(TIPO_CONSOLIDADO);
    expect(plano.motivo).toBe(MOTIVOS.RECOBERTURA);
  });

  test("revelar e recobrir NA MESMA leva ainda é regressão", () => {
    const antes = comClareira(200, 200, 90);
    const depois = clonar(antes);
    revelarCirculo(depois, 900, 600, 90);          // acendeu aqui
    cobrirCirculo(depois, 200, 200, 90);           // e apagou ali

    expect(houveRegressao(antes, depois)).toBe(true);
    expect(planejarTransmissao(antes, depois, {}).tipo).toBe(TIPO_CONSOLIDADO);
  });

  /* ── A MUTAÇÃO: por que a barreira precisa existir ─────────────────── */
  test("PROVA POR MUTAÇÃO: mandar delta depois de recobrir perde o recobrimento", () => {
    const antes = nova();
    revelarTudo(antes);
    const depois = clonar(antes);
    cobrirCirculo(depois, 600, 400, 150);

    /* Isto é o código ERRADO — o que aconteceria se alguém trocasse
       `planejarTransmissao` por um `diferenca` direto. */
    const deltaIngenuo = diferenca(antes, depois);
    expect(vazia(deltaIngenuo)).toBe(true);                       // não diz nada
    const doOutroLado = mesclar(antes, deltaIngenuo);
    expect(iguais(doOutroLado, depois)).toBe(false);              // ficou aberto
    expect(contarReveladas(doOutroLado)).toBeGreaterThan(contarReveladas(depois));

    /* E o caminho certo, no mesmo cenário, repara tudo. */
    const plano = planejarTransmissao(antes, depois, {});
    expect(iguais(plano.mascara, depois)).toBe(true);
  });

  test("houveRegressao é falso quando a revelação só cresce (invariante do AC-6)", () => {
    const antes = comClareira(300, 300, 70);
    const depois = clonar(antes);
    revelarCirculo(depois, 305, 305, 140);
    expect(houveRegressao(antes, depois)).toBe(false);
  });

  test("grade diferente conta como regressão — delta nenhum descreve outro mapa", () => {
    const pequena = criarMascara(400, 400);
    const grande = criarMascara(1200, 800);
    expect(houveRegressao(pequena, grande)).toBe(true);
    expect(planejarTransmissao(pequena, grande, {}).tipo).toBe(TIPO_CONSOLIDADO);
    expect(planejarTransmissao(pequena, grande, {}).motivo).toBe(MOTIVOS.GRADE_NOVA);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · QUANDO CONSOLIDAR
 * ══════════════════════════════════════════════════════════════════ */

describe("a janela da consolidação", () => {
  test("sem base gravada, a primeira transmissão é a máscara inteira", () => {
    const plano = planejarTransmissao(null, comClareira(), {});
    expect(plano.tipo).toBe(TIPO_CONSOLIDADO);
    expect(plano.motivo).toBe(MOTIVOS.SEM_BASE);
  });

  test("dentro da janela e com poucos deltas, sai delta", () => {
    const antes = comClareira();
    const depois = clonar(antes); revelarCirculo(depois, 800, 500, 50);
    const plano = planejarTransmissao(antes, depois, {
      deltas: 3, desde: 0, agora: INTERVALO_DA_CONSOLIDACAO_MS - 1,
    });
    expect(plano.tipo).toBe(TIPO_DELTA);
    expect(plano.motivo).toBe(MOTIVOS.PASSO);
  });

  test("passada a janela, consolida", () => {
    const antes = comClareira();
    const depois = clonar(antes); revelarCirculo(depois, 800, 500, 50);
    const plano = planejarTransmissao(antes, depois, {
      deltas: 1, desde: 0, agora: INTERVALO_DA_CONSOLIDACAO_MS,
    });
    expect(plano.tipo).toBe(TIPO_CONSOLIDADO);
    expect(plano.motivo).toBe(MOTIVOS.PERIODO);
  });

  test("deltas demais consolidam mesmo com o relógio parado", () => {
    const antes = comClareira();
    const depois = clonar(antes); revelarCirculo(depois, 800, 500, 50);
    const plano = planejarTransmissao(antes, depois, {
      deltas: MAXIMO_DE_DELTAS, desde: 0, agora: 1,
    });
    expect(plano.tipo).toBe(TIPO_CONSOLIDADO);
    expect(plano.motivo).toBe(MOTIVOS.ACUMULO);
  });

  test("`fim` (a chegada) consolida, mesmo dentro da janela", () => {
    const antes = comClareira();
    const depois = clonar(antes); revelarCirculo(depois, 800, 500, 50);
    const plano = planejarTransmissao(antes, depois, { deltas: 1, desde: 0, agora: 5, fim: true });
    expect(plano.tipo).toBe(TIPO_CONSOLIDADO);
    expect(plano.motivo).toBe(MOTIVOS.FIM);
  });

  test("nunca consolidou nesta sessão: o relógio não corre, só o acúmulo", () => {
    expect(precisaConsolidar({ deltas: 5, desde: null, agora: 10 ** 9 })).toBe(false);
    expect(precisaConsolidar({ deltas: MAXIMO_DE_DELTAS, desde: null })).toBe(true);
  });

  test("sem delta pendente, o tempo sozinho não consolida", () => {
    expect(precisaConsolidar({ deltas: 0, desde: 0, agora: 10 ** 9 })).toBe(false);
  });

  test("os intervalos são os da casa: 300 ms de delta, 10 s de consolidação", () => {
    /* 300 ms é a cadência com que o editor tático publica a posição do token
       do jogador; mudar isto sem mudar lá cria dois ritmos para a mesma coisa. */
    expect(INTERVALO_DO_DELTA_MS).toBe(300);
    expect(INTERVALO_DA_CONSOLIDACAO_MS).toBe(10_000);
    expect(MAXIMO_DE_DELTAS).toBeGreaterThan(0);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · O QUE CHEGA: mesclar, não substituir
 * ══════════════════════════════════════════════════════════════════ */

describe("aplicar o que chega do outro cliente", () => {
  test("a revelação local NÃO some quando um snapshot antigo chega", () => {
    const local = comClareira(200, 200, 80);
    revelarCirculo(local, 900, 600, 80);       // isto ainda não foi transmitido
    const remota = comClareira(200, 200, 80);  // o servidor só tem a primeira

    const juntas = aplicarRemota(local, remota);
    expect(contarReveladas(juntas)).toBe(contarReveladas(local));
  });

  test("a consolidação de RECOBERTURA substitui — é o único caso", () => {
    const local = nova();
    revelarTudo(local);
    const remota = nova();
    revelarCirculo(remota, 300, 300, 60);      // o mestre fechou quase tudo

    expect(contarReveladas(aplicarRemota(local, remota))).toBe(contarReveladas(local));
    expect(contarReveladas(aplicarRemota(local, remota, { substituir: true })))
      .toBe(contarReveladas(remota));
  });

  test("absorver muta em lugar, devolve quantas acenderam e não repinta à toa", () => {
    const local = comClareira(200, 200, 60);
    const remota = clonar(local);
    expect(absorver(local, remota)).toBe(0);   // nada novo: a mesa não repinta

    revelarCirculo(remota, 800, 500, 60);
    const antes = contarReveladas(local);
    const acesas = absorver(local, remota);
    expect(acesas).toBeGreaterThan(0);
    expect(contarReveladas(local)).toBe(antes + acesas);
    expect(iguais(local, remota)).toBe(true);
  });

  test("delta de outro mapa é ignorado, não derruba a mesa", () => {
    const local = comClareira();
    const deOutroMundo = criarMascara(400, 400);
    revelarCirculo(deOutroMundo, 100, 100, 50);
    expect(aplicarDelta(local, deOutroMundo)).toBe(local);
    expect(absorver(local, deOutroMundo)).toBe(0);
  });

  test("sem base, os deltas sozinhos já descrevem o que há", () => {
    const d1 = comClareira(100, 100, 40);
    const d2 = comClareira(900, 700, 40);
    const soma = mesclarRecebidos(null, [d1, d2]);
    expect(contarReveladas(soma)).toBe(contarReveladas(d1) + contarReveladas(d2));
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · O ID DO DELTA
 * ══════════════════════════════════════════════════════════════════ */

describe("o id do delta", () => {
  test("carrega a sessão: duas abas no mesmo contador não se sobrescrevem", () => {
    expect(idDoDelta("abc123", 7)).not.toBe(idDoDelta("zzz999", 7));
  });

  test("é reconhecível e ordena legível no console do Firestore", () => {
    const id = idDoDelta("abc", 7);
    expect(ehDelta(id)).toBe(true);
    expect(ehDelta("estado")).toBe(false);
    expect(idDoDelta("abc", 2) < idDoDelta("abc", 10)).toBe(true);
  });

  test("sessão suja não vira id inválido para o Firestore", () => {
    const id = idDoDelta("a/b#c d", 1);
    expect(id).not.toMatch(/[/#\s]/);
    expect(ehDelta(id)).toBe(true);
  });
});
