/* ════════════════════════════════════════════════════════════════════
 *  ÚLTIMA VISITA — a memória mais barata do Painel
 *  --------------------------------------------------------------------
 *  O módulo tem UM contrato, e é o de não atrapalhar: grava se der, lê se
 *  fizer sentido, e em qualquer dúvida devolve `null` — nunca uma exceção,
 *  nunca um objeto meio preenchido. Quem consome escreve um `if` e pronto.
 *
 *  Por isso a suíte tem mais casos torto do que caso feliz: o valor do
 *  arquivo está justamente em não explodir quando o mundo está errado
 *  (Safari privado, JSON mexido à mão, relógio do PC adiantado).
 *
 *  Nada aqui olha para `Date.now()`: `registrar` e `ler` recebem `agora`
 *  injetável de propósito, e teste que depende de relógio é teste que
 *  falha sozinho numa terça-feira.
 * ════════════════════════════════════════════════════════════════════ */
import {
  CHAVE,
  VALIDADE_MS,
  TIPOS,
  ROTULO_DO_TIPO,
  registrar,
  ler,
  limpar,
} from "../lastVisit";

/** Relógio congelado. Qualquer instante serve — o que não pode é ser "agora". */
const T0 = Date.UTC(2026, 0, 15, 12, 0, 0);
const DIA = 24 * 60 * 60 * 1000;

const DESTINO = { kind: "campanha", id: "camp-1", label: "Coroa de Cinzas" };

/** Grava direto na chave, sem passar pela validação de `registrar` — é assim
 *  que se simula versão antiga do app ou usuário curioso no DevTools. */
const gravarCru = (valor) => localStorage.setItem(CHAVE, valor);

/**
 * Roda `fn` com um `localStorage` hostil.
 *
 * @param {"metodos"|"getter"} modo `metodos` = objeto cujos métodos lançam
 *   (cota estourada, storage desabilitado); `getter` = ler `window.localStorage`
 *   já lança, que é o caso do Safari privado / iframe com cookie bloqueado.
 */
function comStorageHostil(modo, fn) {
  const anterior = Object.getOwnPropertyDescriptor(window, "localStorage");
  const explode = () => { throw new Error("localStorage indisponível"); };
  const descritor =
    modo === "getter"
      ? { configurable: true, get: explode }
      : {
          configurable: true,
          get: () => ({ getItem: explode, setItem: explode, removeItem: explode }),
        };

  Object.defineProperty(window, "localStorage", descritor);
  try {
    return fn();
  } finally {
    if (anterior) Object.defineProperty(window, "localStorage", anterior);
    else delete window.localStorage;
  }
}

beforeEach(() => localStorage.clear());

describe("lastVisit · constantes", () => {
  it("expõe os três tipos que valem retomar, congelados", () => {
    expect(TIPOS).toEqual(["campanha", "mapa", "mundo"]);
    expect(Object.isFrozen(TIPOS)).toBe(true);
  });

  it("tem rótulo para todo tipo aceito", () => {
    TIPOS.forEach((tipo) => expect(typeof ROTULO_DO_TIPO[tipo]).toBe("string"));
    expect(Object.isFrozen(ROTULO_DO_TIPO)).toBe(true);
  });

  it("dá trinta dias de validade ao registro", () => {
    expect(VALIDADE_MS).toBe(30 * DIA);
  });
});

describe("lastVisit · ida e volta", () => {
  it("grava um destino e devolve exatamente o que foi gravado", () => {
    expect(registrar(DESTINO, T0)).toBe(true);
    expect(ler(T0)).toEqual({ ...DESTINO, at: T0 });
  });

  it("aceita os três tipos", () => {
    TIPOS.forEach((kind) => {
      expect(registrar({ kind, id: "x", label: "Alvo" }, T0)).toBe(true);
      expect(ler(T0)).toMatchObject({ kind });
    });
  });

  it("apara os espaços das pontas antes de gravar", () => {
    expect(registrar({ kind: "  mapa  ", id: " m-9 ", label: "  Vale Fundo " }, T0)).toBe(true);
    expect(ler(T0)).toEqual({ kind: "mapa", id: "m-9", label: "Vale Fundo", at: T0 });
  });

  it("guarda só o último destino, não um histórico", () => {
    registrar({ kind: "mundo", id: "w-1", label: "Primeiro" }, T0);
    registrar({ kind: "mapa", id: "m-2", label: "Segundo" }, T0 + 1000);
    expect(ler(T0 + 1000)).toEqual({ kind: "mapa", id: "m-2", label: "Segundo", at: T0 + 1000 });
  });
});

describe("lastVisit · gravação recusada", () => {
  it("recusa tipo fora da lista e não suja a chave", () => {
    expect(registrar({ kind: "ficha", id: "f-1", label: "Marcos Vidal" }, T0)).toBe(false);
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it.each([
    ["sem id", { kind: "mapa", id: "", label: "Vale Fundo" }],
    ["id só de espaço", { kind: "mapa", id: "   ", label: "Vale Fundo" }],
    ["sem label", { kind: "mapa", id: "m-1", label: "" }],
    ["label só de espaço", { kind: "mapa", id: "m-1", label: "  " }],
    ["sem kind", { id: "m-1", label: "Vale Fundo" }],
    ["campos não-texto", { kind: "mapa", id: 7, label: { nome: "x" } }],
  ])("recusa destino %s", (_titulo, destino) => {
    expect(registrar(destino, T0)).toBe(false);
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it("recusa chamada sem argumento nenhum", () => {
    expect(registrar()).toBe(false);
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it("não apaga o registro bom quando a gravação nova é recusada", () => {
    registrar(DESTINO, T0);
    expect(registrar({ kind: "ficha", id: "f-1", label: "Torto" }, T0 + 1000)).toBe(false);
    expect(ler(T0 + 1000)).toEqual({ ...DESTINO, at: T0 });
  });
});

describe("lastVisit · leitura defensiva", () => {
  it("devolve null quando nunca houve registro", () => {
    expect(ler(T0)).toBeNull();
  });

  it("devolve null e não lança com JSON corrompido", () => {
    gravarCru("{ isto não é json");
    expect(() => ler(T0)).not.toThrow();
    expect(ler(T0)).toBeNull();
  });

  it.each([
    ["null literal", "null"],
    ["número solto", "42"],
    ["texto solto", '"campanha"'],
    ["array", "[]"],
    ["tipo desconhecido", JSON.stringify({ kind: "ficha", id: "f", label: "L", at: T0 })],
    ["sem id", JSON.stringify({ kind: "mapa", id: "", label: "L", at: T0 })],
    ["sem label", JSON.stringify({ kind: "mapa", id: "m", label: "", at: T0 })],
    ["sem at", JSON.stringify({ kind: "mapa", id: "m", label: "L" })],
    ["at não numérico", JSON.stringify({ kind: "mapa", id: "m", label: "L", at: "ontem" })],
  ])("devolve null com payload %s", (_titulo, cru) => {
    gravarCru(cru);
    expect(ler(T0)).toBeNull();
  });
});

describe("lastVisit · validade", () => {
  it("mantém o registro de ontem", () => {
    registrar(DESTINO, T0);
    expect(ler(T0 + DIA)).toMatchObject({ id: "camp-1" });
  });

  it("mantém o registro exatamente no limite dos trinta dias", () => {
    registrar(DESTINO, T0);
    expect(ler(T0 + VALIDADE_MS)).toMatchObject({ id: "camp-1" });
  });

  it("descarta um milissegundo depois do limite", () => {
    registrar(DESTINO, T0);
    expect(ler(T0 + VALIDADE_MS + 1)).toBeNull();
  });

  it("descarta registro de mês passado", () => {
    registrar(DESTINO, T0);
    expect(ler(T0 + 40 * DIA)).toBeNull();
  });

  it("mantém registro no FUTURO — relógio do PC errado não custa a faixa", () => {
    /* Decisão documentada no módulo: o pior caso é um "há poucos instantes"
     * impreciso; descartar custaria a faixa de quem só acertou a hora. */
    registrar(DESTINO, T0 + 10 * DIA);
    expect(ler(T0)).toEqual({ ...DESTINO, at: T0 + 10 * DIA });
  });
});

describe("lastVisit · limpar", () => {
  it("esquece o destino e passa a devolver null", () => {
    registrar(DESTINO, T0);
    expect(limpar()).toBe(true);
    expect(localStorage.getItem(CHAVE)).toBeNull();
    expect(ler(T0)).toBeNull();
  });

  it("é inofensivo quando não há nada para esquecer", () => {
    expect(limpar()).toBe(true);
    expect(ler(T0)).toBeNull();
  });
});

describe("lastVisit · localStorage indisponível", () => {
  it.each(["metodos", "getter"])("nunca lança quando o storage é hostil (%s)", (modo) => {
    comStorageHostil(modo, () => {
      expect(() => registrar(DESTINO, T0)).not.toThrow();
      expect(() => ler(T0)).not.toThrow();
      expect(() => limpar()).not.toThrow();
    });
  });

  it.each(["metodos", "getter"])("degrada para 'não tem registro' (%s)", (modo) => {
    comStorageHostil(modo, () => {
      expect(registrar(DESTINO, T0)).toBe(false);
      expect(ler(T0)).toBeNull();
      expect(limpar()).toBe(false);
    });
  });

  it("volta a funcionar quando o storage volta", () => {
    comStorageHostil("getter", () => expect(registrar(DESTINO, T0)).toBe(false));
    expect(registrar(DESTINO, T0)).toBe(true);
    expect(ler(T0)).toMatchObject({ id: "camp-1" });
  });
});
