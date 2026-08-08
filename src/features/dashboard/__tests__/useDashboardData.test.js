/* ════════════════════════════════════════════════════════════════════
 *  PAINEL — CAMADA DE DADOS  (`useDashboardData`)
 *  --------------------------------------------------------------------
 *  A decisão que este arquivo protege é a mais cara do Painel: a tela
 *  inicial abre ZERO listeners e faz o MÍNIMO de leituras one-shot. É a
 *  tela onde o app mais fica ocioso — leitura repetida aqui vira conta no
 *  fim do mês, não bug visível. Nenhum desses casos falha na tela; todos
 *  falham na fatura. Por isso viram teste.
 *
 *  Três guardas valem por toda a suíte:
 *   · a contagem de mapas é UMA por aba (`sessionStorage`);
 *   · só ficha pública é consultada — as outras dariam leitura vazia;
 *   · re-render do App com array `characters` NOVO e mesmos ids públicos
 *     não pode disparar leitura (RISCO 1 do plano — o loop clássico).
 *
 *  O preset do CRA usa `resetMocks: true`: as implementações dos mocks são
 *  zeradas antes de cada teste e reinstaladas no `beforeEach`.
 * ════════════════════════════════════════════════════════════════════ */
import { act, renderHook, waitFor } from "@testing-library/react";

import useDashboardData, {
  PASSOS,
  PREFIXO_CACHE_MAPAS,
  marcarPrepConcluido,
} from "../useDashboardData";
import { CHAVE_PREP_DONE } from "../PrepChecklist";
import { contarMapas } from "../../../infrastructure/firestore/worldMapsRepo";
import { listPendingEdits } from "../../../infrastructure/firestore/publicSheetsRepo";

/* Repositórios mockados: a camada de dados é testada pelo CONTRATO com eles
 * (quem é chamado, quantas vezes, com quê), nunca pelo Firestore. */
jest.mock("../../../infrastructure/firestore/worldMapsRepo", () => ({
  contarMapas: jest.fn(),
}));
jest.mock("../../../infrastructure/firestore/publicSheetsRepo", () => ({
  listPendingEdits: jest.fn(),
}));

const UID = "u-1";
const CACHE = PREFIXO_CACHE_MAPAS + UID;
const CHAVE_MUNDO = `nexus.forja.activeWorld.${UID}`;

const ficha = (id, extra = {}) => ({ id, public: true, form: { personagem: id }, ...extra });

function montar(props = {}) {
  return renderHook((p) => useDashboardData(p), {
    initialProps: { uid: UID, characters: [], campaigns: [], ...props },
  });
}

/** Deixa TODA a fila de microtarefas dos efeitos assentar. Um `setTimeout(0)`
 *  é uma barreira de macrotarefa, não uma espera cronometrada: quando ele roda,
 *  as promessas pendentes já resolveram. Determinístico, sem relógio. */
const assentar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const idsDe = (prep) => prep.map((p) => p.id);
const feitosDe = (prep) => prep.filter((p) => p.done).map((p) => p.id);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  contarMapas.mockResolvedValue(0);
  listPendingEdits.mockResolvedValue([]);
});

/* ════════════════════ 1 · contagem de mapas ════════════════════ */
describe("useDashboardData · contagem de mapas", () => {
  it("busca a contagem no repositório e a expõe em mapCount", async () => {
    contarMapas.mockResolvedValue(4);
    const { result } = montar();

    await waitFor(() => expect(result.current.mapCount).toBe(4));
    expect(contarMapas).toHaveBeenCalledWith(UID);
    expect(contarMapas).toHaveBeenCalledTimes(1);
  });

  it("guarda a contagem no sessionStorage, por uid", async () => {
    contarMapas.mockResolvedValue(7);
    const { result } = montar();

    await waitFor(() => expect(result.current.mapCount).toBe(7));
    expect(sessionStorage.getItem(CACHE)).toBe("7");
  });

  it("não consulta o repositório de novo numa segunda montagem", async () => {
    contarMapas.mockResolvedValue(4);
    const primeira = montar();
    await waitFor(() => expect(primeira.result.current.mapCount).toBe(4));
    primeira.unmount();

    const segunda = montar();
    await assentar();

    expect(contarMapas).toHaveBeenCalledTimes(1);
    expect(segunda.result.current.mapCount).toBe(4);
  });

  it("respeita cache já existente na aba sem chamar o repositório", async () => {
    sessionStorage.setItem(CACHE, "12");
    const { result } = montar();
    await assentar();

    expect(contarMapas).not.toHaveBeenCalled();
    expect(result.current.mapCount).toBe(12);
  });

  it("cache é por usuário — outro uid faz sua própria leitura", async () => {
    sessionStorage.setItem(CACHE, "12");
    contarMapas.mockResolvedValue(3);
    const { result } = montar({ uid: "u-2" });

    await waitFor(() => expect(result.current.mapCount).toBe(3));
    expect(contarMapas).toHaveBeenCalledWith("u-2");
    expect(sessionStorage.getItem(PREFIXO_CACHE_MAPAS + "u-2")).toBe("3");
  });

  it("trata retorno inválido do repositório como zero", async () => {
    contarMapas.mockResolvedValue(undefined);
    const { result } = montar();
    await assentar();

    expect(result.current.mapCount).toBe(0);
  });

  it("recarregarMapas invalida o cache da aba", async () => {
    contarMapas.mockResolvedValue(4);
    const { result } = montar();
    await waitFor(() => expect(sessionStorage.getItem(CACHE)).toBe("4"));

    act(() => result.current.recarregarMapas());
    expect(sessionStorage.getItem(CACHE)).toBeNull();

    /* Invalidado o cache, a próxima montagem volta a ler. */
    montar();
    await waitFor(() => expect(contarMapas).toHaveBeenCalledTimes(2));
  });
});

/* ════════════════════ 2 · edições pendentes ════════════════════ */
describe("useDashboardData · edições pendentes", () => {
  it("consulta só as fichas públicas — a privada nunca é lida", async () => {
    const chars = [
      ficha("publica-1"),
      ficha("privada-1", { public: false }),
      ficha("sem-id", { id: "" }),
    ];
    montar({ characters: chars });
    await assentar();

    expect(listPendingEdits).toHaveBeenCalledTimes(1);
    expect(listPendingEdits).toHaveBeenCalledWith("publica-1");
  });

  it("não consulta nada quando nenhuma ficha é pública", async () => {
    montar({ characters: [ficha("a", { public: false }), ficha("b", { public: false })] });
    await assentar();

    expect(listPendingEdits).not.toHaveBeenCalled();
  });

  it("array characters NOVO com os mesmos ids públicos NÃO refaz leitura", async () => {
    /* RISCO 1 do plano. O `useEffect` depende de uma STRING estável de ids,
     * não do array — senão cada render do App custaria N leituras. Este é o
     * teste que segura a decisão inteira. */
    const antes = [ficha("a"), ficha("b")];
    const { rerender } = montar({ characters: antes });
    await waitFor(() => expect(listPendingEdits).toHaveBeenCalledTimes(2));

    /* Array novo, objetos novos, um deles até renomeado — mesmos ids públicos. */
    const depois = [
      { id: "a", public: true, form: { personagem: "Nome Novo" } },
      { id: "b", public: true, form: { personagem: "Outro Nome" } },
    ];
    rerender({ uid: UID, characters: depois, campaigns: [] });
    await assentar();
    rerender({ uid: UID, characters: [...depois], campaigns: [] });
    await assentar();

    expect(listPendingEdits).toHaveBeenCalledTimes(2);
  });

  it("refaz a leitura quando o conjunto de fichas públicas muda de verdade", async () => {
    const { rerender } = montar({ characters: [ficha("a")] });
    await waitFor(() => expect(listPendingEdits).toHaveBeenCalledTimes(1));

    rerender({ uid: UID, characters: [ficha("a"), ficha("c")], campaigns: [] });
    await waitFor(() => expect(listPendingEdits).toHaveBeenCalledTimes(3));
    expect(listPendingEdits).toHaveBeenCalledWith("c");
  });

  it("só entrega quem tem quantidade maior que zero", async () => {
    listPendingEdits.mockImplementation((id) =>
      Promise.resolve(id === "a" ? [{ status: "pending" }, { status: "pending" }] : []),
    );
    const { result } = montar({ characters: [ficha("a"), ficha("b")] });

    await waitFor(() => expect(result.current.pendentes).toHaveLength(1));
    expect(result.current.pendentes[0]).toMatchObject({ charId: "a", quantidade: 2 });
  });

  it("resolve charNome a partir de form.personagem", async () => {
    listPendingEdits.mockResolvedValue([{ status: "pending" }]);
    const chars = [{ id: "a", public: true, form: { personagem: "Marcos Vidal" } }];
    const { result } = montar({ characters: chars });

    await waitFor(() => expect(result.current.pendentes).toHaveLength(1));
    expect(result.current.pendentes[0].charNome).toBe("Marcos Vidal");
  });

  it("cai para 'ficha' quando a ficha não tem nome nenhum", async () => {
    listPendingEdits.mockResolvedValue([{ status: "pending" }]);
    const { result } = montar({ characters: [{ id: "a", public: true }] });

    await waitFor(() => expect(result.current.pendentes).toHaveLength(1));
    expect(result.current.pendentes[0].charNome).toBe("ficha");
  });

  it("marca carregando durante a busca e desmarca ao terminar", async () => {
    let liberar;
    listPendingEdits.mockReturnValue(new Promise((r) => { liberar = r; }));
    const { result } = montar({ characters: [ficha("a")] });

    await waitFor(() => expect(result.current.carregando).toBe(true));
    await act(async () => { liberar([{ status: "pending" }]); });

    expect(result.current.carregando).toBe(false);
    expect(result.current.pendentes).toHaveLength(1);
  });

  it("não fica carregando quando não há ficha pública para consultar", async () => {
    const { result } = montar();
    await assentar();
    expect(result.current.carregando).toBe(false);
  });
});

/* ════════════════════ 3 · rede caindo ════════════════════ */
describe("useDashboardData · falha de rede", () => {
  it("contagem de mapas que falha vira zero, sem quebrar o hook", async () => {
    contarMapas.mockRejectedValue(new Error("offline"));
    const { result } = montar();
    await assentar();

    expect(result.current.mapCount).toBe(0);
    expect(sessionStorage.getItem(CACHE)).toBeNull();
    expect(result.current.prep).toHaveLength(PASSOS.length);
  });

  it("edição pendente que falha não derruba as outras", async () => {
    listPendingEdits.mockImplementation((id) =>
      id === "a" ? Promise.reject(new Error("permissão")) : Promise.resolve([{ status: "pending" }]),
    );
    const { result } = montar({ characters: [ficha("a"), ficha("b")] });

    await waitFor(() => expect(result.current.pendentes).toHaveLength(1));
    expect(result.current.pendentes[0].charId).toBe("b");
    expect(result.current.carregando).toBe(false);
  });

  it("as duas fontes caindo juntas ainda devolvem estado neutro", async () => {
    contarMapas.mockRejectedValue(new Error("offline"));
    listPendingEdits.mockRejectedValue(new Error("offline"));
    const { result } = montar({ characters: [ficha("a")] });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.mapCount).toBe(0);
    expect(result.current.pendentes).toEqual([]);
  });
});

/* ════════════════════ 4 · preparo do mundo ════════════════════ */
describe("useDashboardData · checklist de preparo", () => {
  it("mantém a ordem do mestre: mundo → mapa → campanha → ficha", async () => {
    const { result } = montar();
    await assentar();
    expect(idsDe(result.current.prep)).toEqual(["mundo", "mapa", "campanha", "ficha"]);
  });

  it("com usuário zerado nenhum passo está feito", async () => {
    const { result } = montar();
    await assentar();
    expect(feitosDe(result.current.prep)).toEqual([]);
  });

  it("mundo vem da chave do mundo ativo da Forja no localStorage", async () => {
    localStorage.setItem(CHAVE_MUNDO, "w-1");
    const { result } = montar();
    await assentar();
    expect(feitosDe(result.current.prep)).toEqual(["mundo"]);
  });

  it("mundo de OUTRO usuário não conta", async () => {
    localStorage.setItem("nexus.forja.activeWorld.outro", "w-1");
    const { result } = montar();
    await assentar();
    expect(feitosDe(result.current.prep)).toEqual([]);
  });

  it("mundo em branco não conta como mundo montado", async () => {
    localStorage.setItem(CHAVE_MUNDO, "   ");
    const { result } = montar();
    await assentar();
    expect(feitosDe(result.current.prep)).toEqual([]);
  });

  it("mapa é derivado da contagem, campanha e ficha do que o App já tem", async () => {
    contarMapas.mockResolvedValue(2);
    const { result } = montar({ campaigns: [{ id: "c" }], characters: [ficha("a")] });

    await waitFor(() => expect(result.current.mapCount).toBe(2));
    expect(feitosDe(result.current.prep)).toEqual(["mapa", "campanha", "ficha"]);
  });

  it("cada passo carrega o destino de navegação do passo canônico", async () => {
    const { result } = montar();
    await assentar();
    expect(result.current.prep.map((p) => p.nav)).toEqual(PASSOS.map((p) => p.nav));
    expect(result.current.prep.map((p) => p.label)).toEqual(PASSOS.map((p) => p.label));
  });
});

/* ════════════════════ 5 · conclusão pegajosa ════════════════════ */
describe("useDashboardData · prepConcluido", () => {
  const tudoFeito = { campaigns: [{ id: "c" }], characters: [ficha("a")] };

  it("começa falso e vira verdadeiro quando os quatro passos fecham", async () => {
    localStorage.setItem(CHAVE_MUNDO, "w-1");
    contarMapas.mockResolvedValue(1);
    const { result } = montar(tudoFeito);

    await waitFor(() => expect(result.current.prepConcluido).toBe(true));
    expect(localStorage.getItem(CHAVE_PREP_DONE)).toBe("1");
  });

  it("não marca nada enquanto falta um passo", async () => {
    contarMapas.mockResolvedValue(1);
    const { result } = montar(tudoFeito); // falta o mundo
    await assentar();

    expect(result.current.prepConcluido).toBe(false);
    expect(localStorage.getItem(CHAVE_PREP_DONE)).toBeNull();
  });

  it("continua verdadeiro na montagem seguinte mesmo com os passos desfeitos", async () => {
    /* O onboarding não ressuscita: apagar a última campanha não faz o app
     * achar que o mestre esqueceu como usar. */
    localStorage.setItem(CHAVE_MUNDO, "w-1");
    contarMapas.mockResolvedValue(1);
    const primeira = montar(tudoFeito);
    await waitFor(() => expect(primeira.result.current.prepConcluido).toBe(true));
    primeira.unmount();

    localStorage.removeItem(CHAVE_MUNDO);
    sessionStorage.clear();
    contarMapas.mockResolvedValue(0);
    const segunda = montar();
    await assentar();

    expect(feitosDe(segunda.result.current.prep)).toEqual([]);
    expect(segunda.result.current.prepConcluido).toBe(true);
  });

  it("nasce verdadeiro quando a marca já existe de outra sessão", async () => {
    marcarPrepConcluido();
    const { result } = montar();
    expect(result.current.prepConcluido).toBe(true);
    await assentar();
  });
});

/* ════════════════════ 6 · sem usuário ════════════════════ */
describe("useDashboardData · uid vazio", () => {
  it("não faz leitura nenhuma e devolve tudo neutro", async () => {
    const { result } = montar({ uid: "", characters: [ficha("a")], campaigns: [{ id: "c" }] });
    await assentar();

    expect(contarMapas).not.toHaveBeenCalled();
    expect(listPendingEdits).not.toHaveBeenCalled();
    expect(result.current.mapCount).toBe(0);
    expect(result.current.pendentes).toEqual([]);
    expect(result.current.carregando).toBe(false);
    expect(result.current.prepConcluido).toBe(false);
  });

  it("sem uid o passo do mundo nunca aparece como feito", async () => {
    localStorage.setItem("nexus.forja.activeWorld.", "w-1");
    const { result } = montar({ uid: "" });
    await assentar();

    expect(result.current.prep.find((p) => p.id === "mundo").done).toBe(false);
  });

  it("entrada totalmente ausente não quebra o hook", async () => {
    const { result } = renderHook(() => useDashboardData());
    await assentar();

    expect(result.current.mapCount).toBe(0);
    expect(result.current.pendentes).toEqual([]);
    expect(idsDe(result.current.prep)).toEqual(["mundo", "mapa", "campanha", "ficha"]);
    expect(typeof result.current.recarregarMapas).toBe("function");
  });
});
