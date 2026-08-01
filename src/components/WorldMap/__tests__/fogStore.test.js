/* ════════════════════════════════════════════════════════════════════
 *  PERSISTÊNCIA DA NÉVOA — CONTRATO  (spec 0028 · F3 · AC-5, AC-10)
 *  --------------------------------------------------------------------
 *  O Firestore é 100% mockado: o que está sob teste é o CONTRATO —
 *  ONDE grava, O QUE grava, o que se recusa a gravar e como o debounce
 *  se comporta. Mesmo padrão de `worldMapStore.test.js`.
 *
 *  O CRA liga `resetMocks: true`; as implementações voltam no `beforeEach`.
 * ════════════════════════════════════════════════════════════════════ */

import { renderHook, act } from "@testing-library/react";
import * as firestore from "firebase/firestore";
import {
  FOG_DOC_ID, MEDIA, WORLDMAPS, USERS, ESPERA_DA_NEVOA,
  apagarFog, lerFog, salvarFog, useFog, useSalvarFog,
} from "../fogStore";
import {
  criarMascara, estaRevelado, revelarCirculo, serializar,
} from "../model/fogMask";

jest.mock("../../../firebase", () => ({ db: { __db: true }, auth: { currentUser: { uid: "mestre-1" } } }));

jest.mock("firebase/firestore", () => {
  const estado = { listeners: [] };
  return {
    __estado: estado,
    doc: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
    deleteDoc: jest.fn(),
    onSnapshot: jest.fn(),
    serverTimestamp: jest.fn(),
  };
});

const MUNDO = { largura: 2400, altura: 1600 };
const caminho = (...partes) => partes.join("/");

beforeEach(() => {
  firestore.__estado.listeners = [];
  firestore.doc.mockImplementation((_db, ...partes) => ({ __path: caminho(...partes) }));
  firestore.serverTimestamp.mockReturnValue("__agora__");
  firestore.setDoc.mockResolvedValue(undefined);
  firestore.deleteDoc.mockResolvedValue(undefined);
  firestore.getDoc.mockResolvedValue({ exists: () => false, data: () => null });
  firestore.onSnapshot.mockImplementation((ref, aoDado, aoErro) => {
    firestore.__estado.listeners.push({ ref, aoDado, aoErro });
    return jest.fn();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  1 · ONDE A NÉVOA MORA
 * ════════════════════════════════════════════════════════════════════ */
describe("o caminho do documento", () => {
  it("é um documento PRÓPRIO, fora do doc raiz do molde", async () => {
    await salvarFog("mestre-1", "m1", criarMascara(MUNDO.largura, MUNDO.altura));
    const [ref] = firestore.setDoc.mock.calls[0];
    expect(ref.__path).toBe(caminho(USERS, "mestre-1", WORLDMAPS, "m1", MEDIA, FOG_DOC_ID));
    /* Se morasse no raiz, a grade do Ateliê baixaria a névoa de todo mapa a
       cada snapshot — ver o cabeçalho de `fogStore.js`. */
    expect(ref.__path).not.toBe(caminho(USERS, "mestre-1", WORLDMAPS, "m1"));
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  2 · GRAVAR
 * ════════════════════════════════════════════════════════════════════ */
describe("salvarFog", () => {
  it("grava a máscara SERIALIZADA, com dimensões e peso em campos soltos", async () => {
    const m = revelarCirculo(criarMascara(MUNDO.largura, MUNDO.altura), 800, 600, 200);
    const { bytes } = await salvarFog("mestre-1", "m1", m);

    const [, dados] = firestore.setDoc.mock.calls[0];
    expect(dados.data).toBe(serializar(m));
    expect(dados.largura).toBe(2400);
    expect(dados.altura).toBe(1600);
    expect(dados.escala).toBe(4);
    expect(dados.bytes).toBe(dados.data.length);
    expect(dados.updatedAt).toBe("__agora__");
    expect(bytes).toBe(dados.data.length);
  });

  it("RECUSA em português quando o payload não cabe — e não grava nada", async () => {
    /* O teto real é 900 KB e nenhuma névoa plausível chega perto (uma névoa de
       sessão inteira dá ~2 KB — ver `fogMask.test.js`). Apertar o teto é o
       jeito honesto de exercer a recusa sem construir um monstro de memória:
       o parâmetro existe porque a F4 vai precisar dele no doc da campanha. */
    const m = revelarCirculo(criarMascara(MUNDO.largura, MUNDO.altura), 800, 600, 300);
    await expect(salvarFog("mestre-1", "m1", m, { teto: 64 })).rejects.toThrow(/grande demais/i);
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it("recusa sem autenticação, sem mapa ou sem máscara", async () => {
    const m = criarMascara(100, 100);
    await expect(salvarFog("", "m1", m)).rejects.toThrow(/autenticado/i);
    await expect(salvarFog("mestre-1", "", m)).rejects.toThrow(/de qual mapa/i);
    await expect(salvarFog("mestre-1", "m1", null)).rejects.toThrow(/não há névoa/i);
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it("apagarFog remove só a máscara — o molde continua de pé", async () => {
    await apagarFog("mestre-1", "m1");
    const [ref] = firestore.deleteDoc.mock.calls[0];
    expect(ref.__path).toContain(`${MEDIA}/${FOG_DOC_ID}`);
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  3 · LER
 * ════════════════════════════════════════════════════════════════════ */
describe("lerFog", () => {
  it("devolve a máscara desserializada, idêntica à gravada", async () => {
    const m = revelarCirculo(criarMascara(MUNDO.largura, MUNDO.altura), 1000, 700, 150);
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ data: serializar(m) }) });

    const volta = await lerFog("mestre-1", "m1");
    expect(estaRevelado(volta, 1000, 700)).toBe(true);
    expect(estaRevelado(volta, 100, 100)).toBe(false);
  });

  it("documento inexistente é ausência de névoa, não erro", async () => {
    expect(await lerFog("mestre-1", "m1")).toBeNull();
  });

  it("payload corrompido NÃO derruba a tela: vira `null` e vai para o console", async () => {
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ data: "lixo" }) });
    expect(await lerFog("mestre-1", "m1")).toBeNull();
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  4 · TEMPO REAL
 * ════════════════════════════════════════════════════════════════════ */
describe("useFog", () => {
  it("sem uid ou sem mapa não assina nada — não é erro, é 'não há molde aberto'", () => {
    const { result } = renderHook(() => useFog("", ""));
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
    expect(result.current).toEqual({ mascara: null, bytes: 0, loading: false, error: null });
  });

  it("entrega a máscara quando o snapshot chega", () => {
    const m = revelarCirculo(criarMascara(MUNDO.largura, MUNDO.altura), 500, 500, 120);
    const { result } = renderHook(() => useFog("mestre-1", "m1"));
    expect(result.current.loading).toBe(true);

    act(() => {
      firestore.__estado.listeners[0].aoDado({
        exists: () => true,
        data: () => ({ data: serializar(m), bytes: 42 }),
      });
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.bytes).toBe(42);
    expect(estaRevelado(result.current.mascara, 500, 500)).toBe(true);
  });

  it("o erro de leitura sobe cru, para quem chama traduzir", () => {
    const { result } = renderHook(() => useFog("mestre-1", "m1"));
    const falha = Object.assign(new Error("x"), { code: "permission-denied" });
    act(() => { firestore.__estado.listeners[0].aoErro(falha); });
    expect(result.current.error).toBe(falha);
    expect(result.current.mascara).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════
 *  5 · DEBOUNCE  (a razão de o pincel não derrubar a rede)
 * ════════════════════════════════════════════════════════════════════ */
describe("useSalvarFog", () => {
  it("dezenas de pinceladas viram UMA gravação", async () => {
    jest.useFakeTimers();
    try {
      const m = criarMascara(MUNDO.largura, MUNDO.altura);
      const { result } = renderHook(() => useSalvarFog("mestre-1", "m1"));

      act(() => {
        for (let i = 0; i < 30; i += 1) {
          revelarCirculo(m, 100 + i * 20, 400, 60);
          result.current.agendar(m);
        }
      });
      expect(firestore.setDoc).not.toHaveBeenCalled();
      expect(result.current.pendente).toBe(true);

      await act(async () => { jest.advanceTimersByTime(ESPERA_DA_NEVOA + 10); });
      expect(firestore.setDoc).toHaveBeenCalledTimes(1);
      /* E o que foi ao banco é o estado FINAL do traço, não um retrato do meio. */
      expect(firestore.setDoc.mock.calls[0][1].data).toBe(serializar(m));
    } finally {
      jest.useRealTimers();
    }
  });

  it("salvarAgora atropela o debounce", async () => {
    jest.useFakeTimers();
    try {
      const m = revelarCirculo(criarMascara(MUNDO.largura, MUNDO.altura), 300, 300, 80);
      const { result } = renderHook(() => useSalvarFog("mestre-1", "m1"));
      act(() => { result.current.agendar(m); });
      await act(async () => { await result.current.salvarAgora(); });
      expect(firestore.setDoc).toHaveBeenCalledTimes(1);

      /* E o timer pendente não dispara uma segunda gravação. */
      await act(async () => { jest.advanceTimersByTime(ESPERA_DA_NEVOA * 2); });
      expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("a falha vira `erro` para a tela mostrar, e some quando limpa", async () => {
    const console_ = jest.spyOn(console, "error").mockImplementation(() => {});
    firestore.setDoc.mockRejectedValue(new Error("caiu a rede"));
    const m = criarMascara(MUNDO.largura, MUNDO.altura);
    const { result } = renderHook(() => useSalvarFog("mestre-1", "m1"));

    await act(async () => { await result.current.salvarAgora(m); });
    expect(result.current.erro).toBeTruthy();

    act(() => { result.current.limparErro(); });
    expect(result.current.erro).toBeNull();
    console_.mockRestore();
  });

  it("desmontar no meio de um traço FAZ o flush — o traço não se perde", async () => {
    jest.useFakeTimers();
    try {
      const m = revelarCirculo(criarMascara(MUNDO.largura, MUNDO.altura), 900, 900, 100);
      const { result, unmount } = renderHook(() => useSalvarFog("mestre-1", "m1"));
      act(() => { result.current.agendar(m); });
      expect(firestore.setDoc).not.toHaveBeenCalled();

      unmount();
      expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
