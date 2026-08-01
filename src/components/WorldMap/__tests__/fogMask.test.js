/* ════════════════════════════════════════════════════════════════════
 *  A MÁSCARA DE NÉVOA — GATE DO AC-5  (spec 0028 · F3)
 *  --------------------------------------------------------------------
 *  Lógica pura, nada mockado: aqui não existe React, canvas nem Firestore
 *  para dublar. O que se prova:
 *
 *   1. revelar e cobrir, inclusive nas bordas e fora do mapa;
 *   2. a revelação ao longo de uma polilinha — **o que a F4 usa para a
 *      névoa abrir durante a viagem**;
 *   3. ida e volta da serialização, EXATA, byte a byte;
 *   4. os dois casos extremos do RLE: tudo coberto e tudo revelado;
 *   5. `mesclar` idempotente (o delta pode chegar duas vezes);
 *   6. `mesclar(antes, diferenca(antes, depois)) === depois` — a igualdade
 *      de que a F7 depende para trafegar delta em vez do bitmap inteiro.
 * ════════════════════════════════════════════════════════════════════ */

import {
  ESCALA_PADRAO, MARCA, TETO_DA_MASCARA_BYTES,
  base64ParaBytes, bytesParaBase64, cabeNoDocumento, clonar, cobrirAoLongoDe,
  cobrirCirculo, cobrirTudo, contarReveladas, criarMascara, desserializar,
  diferenca, estaRevelado, fracaoRevelada, iguais, mesclar, mesmaGrade,
  revelarAoLongoDe, revelarCirculo, revelarTudo, serializar,
  tamanhoSerializado, vazia,
} from "../model/fogMask";

/* O tamanho que o editor usa quando o molde ainda não tem ilustração
   (`MUNDO_DE_RESERVA` em `editorUi.js`) — é o mapa "típico" da spec. */
const MUNDO = { largura: 2400, altura: 1600 };

const nova = (l = MUNDO.largura, a = MUNDO.altura, e = ESCALA_PADRAO) => criarMascara(l, a, e);

/* ════════════════════════════════════════════════════════════════════
 *  1 · NASCIMENTO
 * ════════════════════════════════════════════════════════════════════ */
describe("criarMascara", () => {
  it("nasce com TUDO coberto — a mesa começa às escuras", () => {
    const m = nova();
    expect(contarReveladas(m)).toBe(0);
    expect(fracaoRevelada(m)).toBe(0);
    expect(estaRevelado(m, 1200, 800)).toBe(false);
  });

  it("a grade é o mundo dividido pela escala (downscale de 4×, AC-5)", () => {
    const m = nova();
    expect(m.escala).toBe(4);
    expect(m.colunas).toBe(600);
    expect(m.linhas).toBe(400);
    /* 600 × 400 = 240.000 bits = 30.000 bytes crus. É o número da spec. */
    expect(m.bits.length).toBe(30_000);
  });

  it("arredonda para cima quando o mundo não é múltiplo da escala", () => {
    const m = nova(101, 7, 4);
    expect(m.colunas).toBe(26); // ceil(101/4)
    expect(m.linhas).toBe(2);   // ceil(7/4)
  });

  it("recusa dimensões sem sentido, em português", () => {
    expect(() => nova(0, 100)).toThrow(/largura e altura/i);
    expect(() => nova(100, -1)).toThrow(/largura e altura/i);
    expect(() => nova(100, 100, 0)).toThrow(/escala/i);
    expect(() => nova(NaN, 100)).toThrow(/largura e altura/i);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · REVELAR E COBRIR
 * ════════════════════════════════════════════════════════════════════ */
describe("revelarCirculo e cobrirCirculo", () => {
  it("acende o centro e o entorno, em coordenadas de MUNDO", () => {
    const m = nova();
    revelarCirculo(m, 1200, 800, 100);

    expect(estaRevelado(m, 1200, 800)).toBe(true);
    expect(estaRevelado(m, 1200 + 60, 800)).toBe(true);
    expect(estaRevelado(m, 1200, 800 - 60)).toBe(true);
    /* Fora do raio continua coberto — o círculo é círculo, não retângulo. */
    expect(estaRevelado(m, 1200 + 140, 800)).toBe(false);
    expect(estaRevelado(m, 1200 + 90, 800 + 90)).toBe(false); // canto do quadrado
  });

  it("cobrir é o inverso exato de revelar, no mesmo lugar", () => {
    const m = nova();
    revelarCirculo(m, 800, 600, 120);
    const quantas = contarReveladas(m);
    expect(quantas).toBeGreaterThan(0);

    cobrirCirculo(m, 800, 600, 120);
    expect(contarReveladas(m)).toBe(0);
  });

  it("na BORDA, revela só o que existe — e não estoura o array", () => {
    const m = nova();
    revelarCirculo(m, 0, 0, 200);
    expect(estaRevelado(m, 0, 0)).toBe(true);
    expect(estaRevelado(m, 100, 100)).toBe(true);
    /* O canto oposto do mundo continua intacto: nada transbordou de linha. */
    expect(estaRevelado(m, MUNDO.largura - 4, 0)).toBe(false);

    revelarCirculo(m, MUNDO.largura - 1, MUNDO.altura - 1, 60);
    expect(estaRevelado(m, MUNDO.largura - 1, MUNDO.altura - 1)).toBe(true);
  });

  it("círculo INTEIRAMENTE fora do mapa não muda nada", () => {
    const m = nova();
    revelarCirculo(m, -5000, -5000, 100);
    revelarCirculo(m, 99_999, 99_999, 100);
    expect(contarReveladas(m)).toBe(0);
  });

  it("raio menor que meia célula ainda revela a célula do centro", () => {
    /* Sem isso o pincel fininho pareceria quebrado: o mestre clica e nada
       acontece. Ver o JSDoc de `marcarDisco`. */
    const m = nova();
    revelarCirculo(m, 1000, 1000, 1);
    expect(contarReveladas(m)).toBe(1);
    expect(estaRevelado(m, 1000, 1000)).toBe(true);
  });

  it("raio zero ou negativo é no-op, não erro", () => {
    const m = nova();
    revelarCirculo(m, 1000, 1000, 0);
    revelarCirculo(m, 1000, 1000, -50);
    expect(contarReveladas(m)).toBe(0);
  });

  it("muta em lugar e devolve a MESMA máscara, com `revisao` maior", () => {
    const m = nova();
    const antes = m.revisao;
    const devolvida = revelarCirculo(m, 400, 400, 80);
    expect(devolvida).toBe(m);
    expect(m.revisao).toBe(antes + 1);
  });

  it("`revisao` NÃO sobe quando nada mudou — é o sinal de repintar", () => {
    const m = nova();
    revelarCirculo(m, 400, 400, 80);
    const marca = m.revisao;
    revelarCirculo(m, 400, 400, 80);   // já estava tudo aceso ali
    expect(m.revisao).toBe(marca);
  });

  it("estaRevelado fora do mapa é sempre falso", () => {
    const m = revelarTudo(nova());
    expect(estaRevelado(m, -1, 10)).toBe(false);
    expect(estaRevelado(m, 10, -1)).toBe(false);
    expect(estaRevelado(m, MUNDO.largura + 10, 10)).toBe(false);
    expect(estaRevelado(m, NaN, 10)).toBe(false);
  });

  it("revelarTudo e cobrirTudo são os dois extremos", () => {
    const m = nova();
    revelarTudo(m);
    expect(contarReveladas(m)).toBe(m.colunas * m.linhas);
    expect(fracaoRevelada(m)).toBe(1);
    cobrirTudo(m);
    expect(contarReveladas(m)).toBe(0);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · REVELAÇÃO AO LONGO DA VIAGEM  (o que a F4 vai usar)
 * ════════════════════════════════════════════════════════════════════ */
describe("revelarAoLongoDe", () => {
  it("abre uma faixa contínua, sem buracos entre um passo e o outro", () => {
    const m = nova();
    const raio = 60;
    revelarAoLongoDe(m, [{ x: 200, y: 800 }, { x: 2200, y: 800 }], raio);

    /* Cada 20 unidades ao longo do percurso tem de estar aberto. Com discos
       soltos (sem a amostragem por meio raio) isto falharia no meio. */
    for (let x = 200; x <= 2200; x += 20) {
      expect(estaRevelado(m, x, 800)).toBe(true);
    }
    /* E a faixa é uma faixa: longe do eixo continua coberto. */
    expect(estaRevelado(m, 1200, 800 + raio * 3)).toBe(false);
  });

  it("acompanha a polilinha inteira, não só o primeiro trecho", () => {
    const m = nova();
    const percurso = [
      { x: 200, y: 200 },
      { x: 1200, y: 300 },
      { x: 1300, y: 1300 },
    ];
    revelarAoLongoDe(m, percurso, 50);
    percurso.forEach((p) => expect(estaRevelado(m, p.x, p.y)).toBe(true));
    expect(estaRevelado(m, 1250, 800)).toBe(true);   // meio do segundo trecho
    expect(estaRevelado(m, 700, 1200)).toBe(false);  // fora do percurso
  });

  it("um ponto só vira um círculo", () => {
    const m = nova();
    revelarAoLongoDe(m, [{ x: 1000, y: 1000 }], 40);
    expect(estaRevelado(m, 1000, 1000)).toBe(true);
    expect(estaRevelado(m, 1000, 1200)).toBe(false);
  });

  it("lista vazia, pontos inválidos ou raio zero não mudam nada", () => {
    const m = nova();
    revelarAoLongoDe(m, [], 40);
    revelarAoLongoDe(m, null, 40);
    revelarAoLongoDe(m, [{ x: NaN, y: 1 }], 40);
    revelarAoLongoDe(m, [{ x: 10, y: 10 }], 0);
    expect(contarReveladas(m)).toBe(0);
  });

  it("cobrirAoLongoDe apaga a mesma faixa que revelarAoLongoDe abriu", () => {
    const m = nova();
    const traco = [{ x: 300, y: 500 }, { x: 900, y: 900 }];
    revelarAoLongoDe(m, traco, 70);
    expect(contarReveladas(m)).toBeGreaterThan(0);
    cobrirAoLongoDe(m, traco, 70);
    expect(contarReveladas(m)).toBe(0);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · SERIALIZAÇÃO — IDA E VOLTA EXATA
 * ════════════════════════════════════════════════════════════════════ */
describe("serializar / desserializar", () => {
  const ida_e_volta = (m) => {
    const texto = serializar(m);
    const volta = desserializar(texto);
    expect(volta.largura).toBe(m.largura);
    expect(volta.altura).toBe(m.altura);
    expect(volta.escala).toBe(m.escala);
    expect(volta.colunas).toBe(m.colunas);
    expect(volta.linhas).toBe(m.linhas);
    expect(Array.from(volta.bits)).toEqual(Array.from(m.bits)); // byte a byte
    expect(iguais(volta, m)).toBe(true);
    return { texto, volta };
  };

  it("máscara TODA COBERTA volta idêntica — e cabe em punhados de bytes", () => {
    const m = nova();
    const { texto } = ida_e_volta(m);
    /* Caso extremo do RLE: uma repetição só. É o estado inicial de toda mesa,
       e ele não pode custar 30 KB. */
    expect(texto.length).toBeLessThan(64);
    expect(texto.startsWith(`${MARCA}:2400:1600:4:`)).toBe(true);
  });

  it("máscara TODA REVELADA volta idêntica — o outro extremo", () => {
    const m = revelarTudo(nova());
    const { texto } = ida_e_volta(m);
    /* Duas repetições: um zero de abertura e o resto todo aceso. */
    expect(texto.length).toBeLessThan(64);
  });

  it("névoa de verdade volta idêntica, bit a bit", () => {
    const m = nova();
    revelarCirculo(m, 400, 400, 180);
    revelarCirculo(m, 1500, 900, 260);
    revelarAoLongoDe(m, [{ x: 400, y: 400 }, { x: 1500, y: 900 }], 90);
    cobrirCirculo(m, 900, 650, 60);
    ida_e_volta(m);
  });

  it("uma célula só, no primeiro pixel — o caso do zero de abertura", () => {
    const m = nova(40, 40, 4);
    revelarCirculo(m, 1, 1, 1);
    expect(estaRevelado(m, 0, 0)).toBe(true);
    ida_e_volta(m);
  });

  it("grade que não fecha em byte cheio volta idêntica", () => {
    /* 26 × 2 = 52 células: sobram 4 bits de enchimento no último byte. Se eles
       vazassem, `iguais` acusaria. */
    const m = nova(101, 7, 4);
    revelarTudo(m);
    ida_e_volta(m);
    expect(contarReveladas(m)).toBe(52);
  });

  it("alterna a cada célula — o pior caso do RLE, e ainda assim exato", () => {
    const m = nova(80, 8, 4);   // 20 × 2 = 40 células
    for (let cy = 0; cy < m.linhas; cy += 1) {
      for (let cx = 0; cx < m.colunas; cx += 1) {
        if ((cy * m.colunas + cx) % 2 === 0) revelarCirculo(m, cx * 4 + 2, cy * 4 + 2, 1);
      }
    }
    ida_e_volta(m);
  });

  it("texto vazio é ausência de névoa, não erro", () => {
    expect(desserializar("")).toBeNull();
    expect(desserializar(null)).toBeNull();
    expect(desserializar(undefined)).toBeNull();
  });

  it("texto quebrado é recusado em português, nunca silenciosamente aceito", () => {
    expect(() => desserializar("qualquer coisa")).toThrow(/formato/i);
    expect(() => desserializar("nvf9:10:10:4:AAA")).toThrow(/formato/i);
    expect(() => desserializar(42)).toThrow(/não é texto/i);
    expect(() => desserializar(`${MARCA}:2400:1600:4:@@@@`)).toThrow(/base64/i);
    /* Payload curto demais para a grade declarada: o mapa ficaria meio lido. */
    expect(() => desserializar(`${MARCA}:2400:1600:4:AQ==`)).toThrow(/não bate com o tamanho/i);
  });

  it("base64 vai e volta sem perder byte", () => {
    for (const tamanho of [0, 1, 2, 3, 4, 5, 255]) {
      const bytes = Uint8Array.from({ length: tamanho }, (_, i) => (i * 37) % 256);
      expect(Array.from(base64ParaBytes(bytesParaBase64(bytes)))).toEqual(Array.from(bytes));
    }
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · TAMANHO — O NÚMERO QUE DECIDE SE CABE
 * ════════════════════════════════════════════════════════════════════ */
describe("tamanhoSerializado e cabeNoDocumento", () => {
  it("uma névoa típica de mesa cabe folgada no documento do Firestore", () => {
    /* Uma sessão de exploração: doze clareiras e as trilhas entre elas. */
    const m = nova();
    const lugares = Array.from({ length: 12 }, (_, i) => ({
      x: 200 + (i % 4) * 640,
      y: 220 + Math.floor(i / 4) * 560,
    }));
    lugares.forEach((p) => revelarCirculo(m, p.x, p.y, 150));
    for (let i = 1; i < lugares.length; i += 1) {
      revelarAoLongoDe(m, [lugares[i - 1], lugares[i]], 70);
    }

    const bytes = tamanhoSerializado(m);
    expect(bytes).toBe(serializar(m).length);
    expect(bytes).toBeLessThan(TETO_DA_MASCARA_BYTES);
    /* Muito abaixo do bitmap cru de 30 KB — é a promessa do AC-5. */
    expect(bytes).toBeLessThan(30_000);
    expect(cabeNoDocumento(m).ok).toBe(true);
  });

  it("recusa em português quando o payload não cabe no teto informado", () => {
    const m = nova();
    revelarCirculo(m, 1200, 800, 300);
    const veredito = cabeNoDocumento(m, 10);
    expect(veredito.ok).toBe(false);
    expect(veredito.bytes).toBeGreaterThan(10);
    expect(veredito.motivo).toMatch(/grande demais/i);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  6 · CONJUNTOS — MESCLAR E DELTA  (insumo do AC-10, F7)
 * ════════════════════════════════════════════════════════════════════ */
describe("mesclar", () => {
  it("é a UNIÃO das áreas reveladas, e não muta nenhuma das duas", () => {
    const a = revelarCirculo(nova(), 400, 400, 120);
    const b = revelarCirculo(nova(), 1600, 900, 120);
    const bitsA = Array.from(a.bits);
    const bitsB = Array.from(b.bits);

    const junta = mesclar(a, b);
    expect(estaRevelado(junta, 400, 400)).toBe(true);
    expect(estaRevelado(junta, 1600, 900)).toBe(true);
    expect(Array.from(a.bits)).toEqual(bitsA);
    expect(Array.from(b.bits)).toEqual(bitsB);
  });

  it("é IDEMPOTENTE: aplicar o mesmo delta duas vezes dá o mesmo resultado", () => {
    /* O tempo real pode entregar a mesma revelação duas vezes por caminhos
       diferentes; o resultado não pode depender disso. */
    const base = revelarCirculo(nova(), 700, 700, 100);
    const delta = revelarCirculo(nova(), 1400, 500, 90);

    const uma = mesclar(base, delta);
    const duas = mesclar(uma, delta);
    expect(iguais(uma, duas)).toBe(true);
    expect(iguais(mesclar(base, base), base)).toBe(true);
  });

  it("é comutativa", () => {
    const a = revelarCirculo(nova(), 300, 300, 80);
    const b = revelarCirculo(nova(), 900, 900, 80);
    expect(iguais(mesclar(a, b), mesclar(b, a))).toBe(true);
  });

  it("recusa grades diferentes em vez de misturar mapas", () => {
    expect(() => mesclar(nova(), nova(1200, 800))).toThrow(/tamanhos diferentes/i);
    expect(mesmaGrade(nova(), nova())).toBe(true);
    expect(mesmaGrade(nova(), nova(2400, 1600, 8))).toBe(false);
  });
});

describe("diferenca", () => {
  it("o delta aplicado sobre o estado antigo REPRODUZ o estado novo", () => {
    const antes = revelarCirculo(nova(), 500, 500, 140);
    const depois = clonar(antes);
    revelarAoLongoDe(depois, [{ x: 500, y: 500 }, { x: 1800, y: 1200 }], 90);

    const delta = diferenca(antes, depois);
    expect(vazia(delta)).toBe(false);
    expect(iguais(mesclar(antes, delta), depois)).toBe(true);

    /* E o delta é MENOR que o estado inteiro — é o ponto de existir. */
    expect(tamanhoSerializado(delta)).toBeLessThan(tamanhoSerializado(depois));
  });

  it("só captura o que ACENDEU — recobrir não vira delta (AC-6)", () => {
    const antes = revelarCirculo(nova(), 800, 800, 200);
    const depois = clonar(antes);
    cobrirCirculo(depois, 800, 800, 200);

    const delta = diferenca(antes, depois);
    expect(vazia(delta)).toBe(true);
    /* Justamente por isso a igualdade acima só vale quando nada regride:
       aqui, mesclar devolve o estado ANTIGO, não o novo. */
    expect(iguais(mesclar(antes, delta), antes)).toBe(true);
  });

  it("sem mudança, o delta é vazio — nada a transmitir, nada a gravar", () => {
    const antes = revelarCirculo(nova(), 600, 600, 100);
    const delta = diferenca(antes, clonar(antes));
    expect(vazia(delta)).toBe(true);
    expect(contarReveladas(delta)).toBe(0);
  });

  it("o delta serializado sobrevive à ida e volta", () => {
    const antes = nova();
    const depois = revelarCirculo(clonar(antes), 1000, 700, 120);
    const delta = diferenca(antes, depois);
    expect(iguais(desserializar(serializar(delta)), delta)).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  7 · CLONAR
 * ════════════════════════════════════════════════════════════════════ */
describe("clonar", () => {
  it("é independente: mexer na cópia não mexe na original", () => {
    const original = revelarCirculo(nova(), 500, 500, 100);
    const copia = clonar(original);
    revelarCirculo(copia, 1800, 1200, 200);

    expect(estaRevelado(copia, 1800, 1200)).toBe(true);
    expect(estaRevelado(original, 1800, 1200)).toBe(false);
    expect(iguais(original, copia)).toBe(false);
  });

  it("recusa o que não é máscara", () => {
    expect(() => clonar(null)).toThrow(/máscara de névoa válida/i);
    expect(() => clonar({ bits: [] })).toThrow(/máscara de névoa válida/i);
  });
});
