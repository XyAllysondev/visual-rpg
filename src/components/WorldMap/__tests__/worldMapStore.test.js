/**
 * Contrato da camada de persistência do Mapa-Múndi (spec 0028 · F1 · gate do AC-2).
 *
 * O Firestore é 100% mockado: o que está sob teste é o CONTRATO do store — o que
 * ele grava, ONDE grava, o que apaga junto e o que se recusa a fazer. Segue o
 * padrão de `MasterSuite/__tests__/worldsStore.test.js`.
 *
 * Nota: o CRA liga `resetMocks: true`, então as implementações dos mocks são
 * reinstaladas a cada teste via `__mock.install()`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOBRE OS DUBLÊS DE IMAGEM
 *
 * O jsdom não carrega imagem (`img.onload` nunca dispara) nem desenha canvas
 * (`getContext('2d')` não existe de verdade). Sem dublê, NENHUM caminho do
 * `uploadBackground` base64 seria testável — e é justamente ele que está no ar
 * hoje (plano B do ADR-0008). Os dublês abaixo imitam só o que o navegador faz:
 * ler o arquivo como dataURL, redesenhar num canvas menor e devolver JPEG.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { renderHook, act } from "@testing-library/react";
import * as firestore from "firebase/firestore";
import { canCreateMap } from "../model/quotas";
import {
  createWorldMap, updateWorldMap, deleteWorldMap, getWorldMap,
  uploadBackground, getBackground, useWorldMaps,
  fundoDisponivel, FUNDO_REF, LIMITE_FUNDO_BYTES, TETO_MINIATURA_BYTES,
  ESTAGIOS_DE_REDUCAO, BATCH_LIMIT, RAIO_DE_REVELACAO_PADRAO,
} from "../worldMapStore";

jest.mock("../../../firebase", () => ({
  db: { __db: true },
  auth: { currentUser: { uid: "mestre-1" } },
}));

jest.mock("firebase/firestore", () => {
  const state = { batches: [], listeners: [], autoId: 0 };
  const fns = {
    collection: jest.fn(), doc: jest.fn(), query: jest.fn(), orderBy: jest.fn(),
    onSnapshot: jest.fn(), getDocs: jest.fn(), getDoc: jest.fn(), setDoc: jest.fn(),
    addDoc: jest.fn(), updateDoc: jest.fn(), serverTimestamp: jest.fn(), writeBatch: jest.fn(),
  };
  const install = () => {
    state.batches.length = 0;
    state.listeners.length = 0;
    state.autoId = 0;
    fns.collection.mockImplementation((_db, ...path) => ({ __type: "collection", path: path.join("/") }));
    fns.doc.mockImplementation((first, ...rest) => {
      if (first && first.__type === "collection") {
        state.autoId += 1;
        return { __type: "doc", id: `auto-${state.autoId}`, path: `${first.path}/auto-${state.autoId}` };
      }
      return { __type: "doc", id: rest[rest.length - 1], path: rest.join("/") };
    });
    fns.query.mockImplementation((ref, ...clauses) => ({ __type: "query", ref, clauses }));
    fns.orderBy.mockImplementation((field, dir = "asc") => ({ __type: "orderBy", field, dir }));
    fns.onSnapshot.mockImplementation((q, next, error) => {
      const unsub = jest.fn();
      state.listeners.push({ q, next, error, unsub });
      return unsub;
    });
    fns.getDocs.mockResolvedValue({ docs: [], empty: true, size: 0 });
    fns.getDoc.mockResolvedValue({ exists: () => false, id: "x", data: () => ({}) });
    fns.setDoc.mockResolvedValue(undefined);
    fns.updateDoc.mockResolvedValue(undefined);
    fns.addDoc.mockImplementation(async () => {
      state.autoId += 1;
      return { id: `new-${state.autoId}` };
    });
    fns.serverTimestamp.mockReturnValue("__ts__");
    fns.writeBatch.mockImplementation(() => {
      const batch = { sets: [], updates: [], deletes: [], committed: false };
      batch.set = jest.fn((ref, data) => batch.sets.push({ ref, data }));
      batch.update = jest.fn((ref, data) => batch.updates.push({ ref, data }));
      batch.delete = jest.fn((ref) => batch.deletes.push(ref));
      batch.commit = jest.fn(async () => { batch.committed = true; });
      state.batches.push(batch);
      return batch;
    });
  };
  install();
  return { ...fns, __mock: { state, install } };
});

/* ── Utilidades ──────────────────────────────────────────────────────────── */

const state = firestore.__mock.state;

const fakeDoc = (id, data = {}) => ({ id, data: () => data, ref: { __type: "doc", id } });
const fakeSnap = (docs) => ({ docs, empty: docs.length === 0, size: docs.length });
const snapCom = (data) => ({ exists: () => true, id: "background", data: () => data });

const allDeletes = () => state.batches.flatMap((b) => b.deletes);
const caminhos = (refs) => refs.map((r) => r.path);

/** dataURL de tamanho controlado — só o comprimento importa para o teto. */
const dataUrlDe = (bytes) => `data:image/jpeg;base64,${"A".repeat(Math.max(1, bytes - 23))}`;

/* Dublê do FileReader: entrega o dataURL que o teste combinou, do mesmo jeito
 * que o navegador entregaria o conteúdo do arquivo. */
let dataUrlDoArquivo = dataUrlDe(200);
class LeitorDuble {
  readAsDataURL() {
    Promise.resolve().then(() => {
      this.result = dataUrlDoArquivo;
      if (this.onload) this.onload();
    });
  }
}

/* Dublê do <img>: dataURL carrega, o resto falha — como no navegador. */
class ImagemDuble {
  constructor() { this.width = 2400; this.height = 1600; }
  set src(v) {
    this._src = v;
    Promise.resolve().then(() => {
      if (typeof v === "string" && v.startsWith("data:")) { if (this.onload) this.onload(); }
      else if (this.onerror) this.onerror();
    });
  }
  get src() { return this._src; }
}

/**
 * Dublê do canvas. `saidas` é a fila de TAMANHOS que cada `toDataURL` devolve,
 * na ordem das chamadas (estágio 1, estágio 2, miniatura). Devolve o registro
 * das chamadas para o teste provar que os dois estágios aconteceram.
 */
function instalarCanvas(saidas = []) {
  const chamadas = [];
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: jest.fn() });
  jest.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function toData(_tipo, q) {
    const bytes = saidas.length ? saidas.shift() : 2_000;
    chamadas.push({ qualidade: q, width: this.width, height: this.height, bytes });
    return dataUrlDe(bytes);
  });
  return chamadas;
}

const arquivo = (nome = "mapa.png", tipo = "image/png") => new File(["x"], nome, { type: tipo });

beforeEach(() => {
  firestore.__mock.install();
  dataUrlDoArquivo = dataUrlDe(200);
  global.FileReader = LeitorDuble;
  global.Image = ImagemDuble;
  /* Hash determinístico: o `crypto.subtle` do jsdom não existe, e sem ele o
   * store cai no valor aleatório (dedup desligado). Aqui o dedup É o contrato
   * sob teste, então o digest vira função do conteúdo. `defineProperty` porque
   * `window.crypto` é somente-leitura no jsdom. */
  Object.defineProperty(global, "crypto", {
    configurable: true,
    writable: true,
    value: {
      subtle: {
        digest: async (_alg, bytes) => new Uint8Array(
          Array.from({ length: 32 }, (_, i) => (bytes.length + i) % 256),
        ).buffer,
      },
    },
  });
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

/* O jsdom do CRA não expõe `TextEncoder` (o navegador expõe). Sem ele, o hash
 * do store cairia no valor aleatório e o dedup ficaria de fora do teste. */
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = require("util").TextEncoder; // eslint-disable-line global-require
}

afterEach(() => {
  jest.restoreAllMocks();
});

/* ════════════════════════════════════════════════════════════════════════
 *  CRIAR MOLDE  (AC-2 / AC-3)
 * ════════════════════════════════════════════════════════════════════════ */

describe("createWorldMap", () => {
  it("exige nome e usuário autenticado, sem tocar no banco", async () => {
    await expect(createWorldMap("mestre-1", { name: "   " })).rejects.toThrow(/nome/i);
    await expect(createWorldMap("mestre-1", {})).rejects.toThrow(/nome/i);
    await expect(createWorldMap("", { name: "Aurora" })).rejects.toThrow(/autenticado/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it("grava o molde com os quatro campos de fundo vazios e os padrões da spec", async () => {
    const id = await createWorldMap("mestre-1", { name: "  As Terras Partidas  ", plan: "pro" });

    expect(id).toBe("new-1");
    const [ref, data] = firestore.addDoc.mock.calls[0];
    expect(ref.path).toBe("users/mestre-1/worldmaps");
    expect(data).toMatchObject({
      name: "As Terras Partidas",
      description: "",
      backgroundUrl: null,
      backgroundPath: null,
      backgroundRef: null,
      backgroundThumb: null,
      width: 0,
      height: 0,
      fogEnabled: true,
      defaultRevealRadius: RAIO_DE_REVELACAO_PADRAO,
      nodeCount: 0,
      createdAt: "__ts__",
      updatedAt: "__ts__",
    });
    /* `plan` é insumo da cota, nunca campo do documento. */
    expect(data).not.toHaveProperty("plan");
  });

  it("recusa por cota com a MESMA frase de model/quotas.js (AC-3)", async () => {
    firestore.getDocs.mockResolvedValue(fakeSnap([fakeDoc("m-1")]));

    const esperada = canCreateMap("free", 1).motivo;
    await expect(createWorldMap("mestre-1", { name: "Segundo mapa", plan: "free" }))
      .rejects.toThrow(esperada);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  /* Decidido na F1: plano ausente vale como `free`, o mais restritivo. É melhor
   * recusar um mestre pagante (que reclama e é destravado) do que estourar a
   * cota calado — se isto inverter, a cota deixa de valer para quem chama sem
   * `plan`, que é o caminho mais fácil de esquecer. */
  it("sem `plan` assume o plano free (o mais restritivo)", async () => {
    firestore.getDocs.mockResolvedValue(fakeSnap([fakeDoc("m-1")]));

    await expect(createWorldMap("mestre-1", { name: "Segundo mapa" }))
      .rejects.toThrow(canCreateMap("free", 1).motivo);
    expect(firestore.getDocs).toHaveBeenCalledTimes(1); // contou antes de decidir
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it("não conta os mapas quando o plano não tem teto", async () => {
    await createWorldMap("mestre-1", { name: "Mar de Ferro", plan: "pro" });
    expect(firestore.getDocs).not.toHaveBeenCalled();
    expect(firestore.addDoc).toHaveBeenCalledTimes(1);
  });

  /* Sem saber a contagem não dá para afirmar que cabe mais um: a falha da
   * leitura CANCELA a criação em vez de liberar o teto por omissão. */
  it("cancela a criação quando a contagem de mapas falha", async () => {
    const boom = new Error("Missing or insufficient permissions.");
    boom.code = "permission-denied";
    firestore.getDocs.mockRejectedValue(boom);

    await expect(createWorldMap("mestre-1", { name: "Terceiro", plan: "free" }))
      .rejects.toThrow(/cancelada/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled(); // nada falha em silêncio
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  ATUALIZAR / LER
 * ════════════════════════════════════════════════════════════════════════ */

describe("updateWorldMap", () => {
  it("carimba updatedAt, normaliza os campos e nunca persiste `plan`", async () => {
    await updateWorldMap("mestre-1", "m1", {
      name: "  Terras Inteiras  ", description: "  ", fogEnabled: false,
      defaultRevealRadius: -5, plan: "pro",
    });

    const [ref, data] = firestore.updateDoc.mock.calls[0];
    expect(ref.path).toBe("users/mestre-1/worldmaps/m1");
    expect(data).toMatchObject({
      name: "Terras Inteiras",
      description: "",
      fogEnabled: false,
      defaultRevealRadius: RAIO_DE_REVELACAO_PADRAO,
      updatedAt: "__ts__",
    });
    expect(data).not.toHaveProperty("plan");
  });

  it("recusa nome vazio e mapa sem id", async () => {
    await expect(updateWorldMap("mestre-1", "m1", { name: "  " })).rejects.toThrow(/nome/i);
    await expect(updateWorldMap("mestre-1", "", { name: "X" })).rejects.toThrow(/mapa/i);
  });
});

describe("getWorldMap", () => {
  it("devolve null quando o molde não existe", async () => {
    expect(await getWorldMap("mestre-1", "m1")).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  EXCLUIR  (AC-2)
 * ════════════════════════════════════════════════════════════════════════ */

describe("deleteWorldMap", () => {
  it("apaga as subcoleções em lote, o doc de mídia e o molde por último", async () => {
    firestore.getDocs
      .mockResolvedValueOnce(fakeSnap([fakeDoc("n-1"), fakeDoc("n-2")]))  // nodes
      .mockResolvedValueOnce(fakeSnap([fakeDoc("e-1")]))                  // edges
      .mockResolvedValueOnce(fakeSnap([]));                               // events

    await deleteWorldMap("mestre-1", "m1");

    const apagados = allDeletes();
    expect(apagados).toHaveLength(5); // 3 filhos + mídia + molde
    /* A ilustração sai junto: se ficasse para trás, continuaria ocupando
     * espaço num mapa que o mestre acha que sumiu. */
    expect(caminhos(apagados)).toContain("users/mestre-1/worldmaps/m1/media/background");
    /* O molde por último: se a varredura cair no meio, o mapa ainda aparece na
     * lista e o mestre tenta de novo, em vez de ficar com órfãos invisíveis. */
    expect(apagados[apagados.length - 1].path).toBe("users/mestre-1/worldmaps/m1");
    expect(state.batches.every((b) => b.committed)).toBe(true);
  });

  it("respeita o limite de 500 operações por lote", async () => {
    firestore.getDocs
      .mockResolvedValueOnce(fakeSnap(Array.from({ length: 700 }, (_, i) => fakeDoc(`n-${i}`))))
      .mockResolvedValueOnce(fakeSnap([]))
      .mockResolvedValueOnce(fakeSnap([]));

    await deleteWorldMap("mestre-1", "m1");

    expect(state.batches).toHaveLength(2);
    expect(state.batches[0].deletes).toHaveLength(BATCH_LIMIT);
    expect(allDeletes()).toHaveLength(702); // 700 nós + mídia + molde
  });

  it("exige autenticação e id", async () => {
    await expect(deleteWorldMap("", "m1")).rejects.toThrow(/autenticado/i);
    await expect(deleteWorldMap("mestre-1", "")).rejects.toThrow(/mapa/i);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  FUNDO DO MAPA — CAMINHO BASE64  (plano B do ADR-0008)
 * ════════════════════════════════════════════════════════════════════════ */

describe("uploadBackground · validação de entrada", () => {
  it("exige uid, mapa e arquivo antes de qualquer I/O", async () => {
    await expect(uploadBackground("", "m1", arquivo())).rejects.toThrow(/autenticado/i);
    await expect(uploadBackground("mestre-1", "", arquivo())).rejects.toThrow(/mapa/i);
    await expect(uploadBackground("mestre-1", "m1", null)).rejects.toThrow(/escolha uma imagem/i);
    expect(firestore.setDoc).not.toHaveBeenCalled();
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });
});

describe("uploadBackground · caminho base64", () => {
  /* Hoje o bucket do projeto não existe (Spark, 404 comprovado no ADR-0008), e
   * o Andre decidiu ficar no gratuito por enquanto: é ESTE caminho que roda. */
  it("está no caminho do Firestore enquanto o Storage não estiver de pé", () => {
    expect(fundoDisponivel()).toBe(false);
  });

  it("reduz em dois estágios e RECUSA em português quando ainda não cabe", async () => {
    const canvas = instalarCanvas([LIMITE_FUNDO_BYTES + 300_000, LIMITE_FUNDO_BYTES + 50_000]);
    dataUrlDoArquivo = dataUrlDe(LIMITE_FUNDO_BYTES + 900_000);

    await expect(uploadBackground("mestre-1", "m1", arquivo()))
      .rejects.toThrow(/não cabe no mapa|imagem menor/i);

    /* Os DOIS estágios foram tentados, na ordem e com as qualidades da casa. */
    expect(canvas.map((c) => c.qualidade)).toEqual([
      ESTAGIOS_DE_REDUCAO[0].qualidade, ESTAGIOS_DE_REDUCAO[1].qualidade,
    ]);
    expect(canvas[0].width).toBe(ESTAGIOS_DE_REDUCAO[0].maxDim);
    expect(canvas[1].width).toBe(ESTAGIOS_DE_REDUCAO[1].maxDim);

    /* E NADA foi gravado: documento acima do teto é recusado inteiro pelo
     * Firestore — o mestre receberia um erro do SDK, em inglês. */
    expect(firestore.setDoc).not.toHaveBeenCalled();
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it("recusa também quando o navegador não consegue reduzir (canvas indisponível)", async () => {
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    dataUrlDoArquivo = dataUrlDe(LIMITE_FUNDO_BYTES + 10);

    await expect(uploadBackground("mestre-1", "m1", arquivo())).rejects.toThrow(/não cabe/i);
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it("recusa arquivo que não vira imagem", async () => {
    dataUrlDoArquivo = "";
    await expect(uploadBackground("mestre-1", "m1", arquivo("x.pdf", "application/pdf")))
      .rejects.toThrow(/imagem válida/i);
  });

  it("aceita a imagem que cabe: cheia no doc de mídia, ponteiro no molde", async () => {
    instalarCanvas([700_000, 3_000]);          // estágio 1 resolveu; depois a miniatura
    dataUrlDoArquivo = dataUrlDe(LIMITE_FUNDO_BYTES + 400_000);

    const resultado = await uploadBackground("mestre-1", "m2", arquivo());

    /* Contrato estável: no base64 a `url` é a própria dataURL e `path` é null. */
    expect(resultado.path).toBeNull();
    expect(resultado.url.startsWith("data:image/")).toBe(true);
    expect(resultado.width).toBe(ESTAGIOS_DE_REDUCAO[0].maxDim);
    expect(resultado.height).toBeGreaterThan(0);

    const [refMidia, midia] = firestore.setDoc.mock.calls[0];
    expect(refMidia.path).toBe("users/mestre-1/worldmaps/m2/media/background");
    expect(midia.kind).toBe("background");
    expect(midia.data).toBe(resultado.url);
    expect(midia.bytes).toBe(resultado.url.length);
    expect(midia.hash).toEqual(expect.any(String));
    expect(midia.updatedAt).toBe("__ts__");
  });

  /* ─────────────────────────────────────────────────────────────────────
   * O TESTE QUE SEGURA A PERFORMANCE DO ATELIÊ
   *
   * `useWorldMaps` assina os docs raiz em tempo real. Se a ilustração cheia
   * escorregar para lá, TODA a grade do Ateliê passa a baixar todos os fundos
   * inteiros a cada snapshot. O doc raiz carrega só ponteiro + miniatura.
   * ───────────────────────────────────────────────────────────────────── */
  it("NÃO deixa a imagem grande entrar no documento raiz do mapa", async () => {
    instalarCanvas([700_000, 3_000]);
    dataUrlDoArquivo = dataUrlDe(LIMITE_FUNDO_BYTES + 400_000);

    await uploadBackground("mestre-1", "m3", arquivo());

    const [refMolde, raiz] = firestore.updateDoc.mock.calls[0];
    expect(refMolde.path).toBe("users/mestre-1/worldmaps/m3");
    expect(raiz.backgroundRef).toBe(FUNDO_REF);
    expect(raiz).not.toHaveProperty("data");
    expect(raiz.backgroundThumb.startsWith("data:image/")).toBe(true);
    expect(raiz.backgroundThumb.length).toBeLessThanOrEqual(TETO_MINIATURA_BYTES);
    /* Nenhum campo do doc raiz chega perto do tamanho da ilustração. */
    for (const valor of Object.values(raiz)) {
      if (typeof valor === "string") expect(valor.length).toBeLessThanOrEqual(TETO_MINIATURA_BYTES);
    }
    expect(JSON.stringify(raiz).length).toBeLessThan(LIMITE_FUNDO_BYTES / 10);
    /* E o caminho do Storage é limpo: a fonte da verdade é uma só. */
    expect(raiz.backgroundUrl).toBeNull();
    expect(raiz.backgroundPath).toBeNull();
  });

  it("descarta a miniatura acima do teto em vez de inchar a lista", async () => {
    instalarCanvas([700_000, TETO_MINIATURA_BYTES + 5_000]);
    dataUrlDoArquivo = dataUrlDe(LIMITE_FUNDO_BYTES + 400_000);

    await uploadBackground("mestre-1", "m4", arquivo());

    const [, raiz] = firestore.updateDoc.mock.calls[0];
    expect(raiz.backgroundThumb).toBeNull();
    expect(console.warn).toHaveBeenCalled(); // avisa, não engole
    expect(firestore.setDoc).toHaveBeenCalledTimes(1); // a ilustração subiu mesmo assim
  });

  /* Content-addressing: o payload só é reescrito quando muda de verdade. */
  it("não reescreve a ilustração quando o hash é o mesmo (dedup)", async () => {
    instalarCanvas([700_000, 3_000, 700_000, 3_000]);
    dataUrlDoArquivo = dataUrlDe(LIMITE_FUNDO_BYTES + 400_000);

    await uploadBackground("mestre-1", "m5", arquivo());
    const { hash } = firestore.setDoc.mock.calls[0][1];
    expect(hash).toEqual(expect.any(String));

    /* segunda vez, com a MESMA imagem já gravada */
    firestore.getDoc.mockResolvedValue(snapCom({ hash }));
    await uploadBackground("mestre-1", "m5", arquivo());

    expect(firestore.setDoc).toHaveBeenCalledTimes(1); // não reescreveu ~700 KB
    /* mas o molde é atualizado: miniatura e dimensões podem ter mudado */
    expect(firestore.updateDoc).toHaveBeenCalledTimes(2);
  });

  it("sobe mesmo assim quando a leitura de dedup falha (só desliga o dedup)", async () => {
    instalarCanvas([700_000, 3_000]);
    dataUrlDoArquivo = dataUrlDe(LIMITE_FUNDO_BYTES + 400_000);
    firestore.getDoc.mockRejectedValue(new Error("unavailable"));

    await uploadBackground("mestre-1", "m6", arquivo());

    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalled();
  });

  it("deixa a falha de escrita subir para quem chamou", async () => {
    instalarCanvas([700_000, 3_000]);
    dataUrlDoArquivo = dataUrlDe(LIMITE_FUNDO_BYTES + 400_000);
    const boom = new Error("Missing or insufficient permissions.");
    boom.code = "permission-denied";
    firestore.setDoc.mockRejectedValue(boom);

    await expect(uploadBackground("mestre-1", "m7", arquivo())).rejects.toThrow(boom);
  });
});

describe("getBackground", () => {
  it("lê a ilustração cheia do documento de mídia", async () => {
    firestore.getDoc.mockResolvedValue(snapCom({ data: "data:image/jpeg;base64,AAA" }));

    const url = await getBackground("mestre-1", "m-leitura");

    expect(firestore.getDoc.mock.calls[0][0].path)
      .toBe("users/mestre-1/worldmaps/m-leitura/media/background");
    expect(url).toBe("data:image/jpeg;base64,AAA");
  });

  it("devolve null quando o mapa não tem ilustração em base64", async () => {
    expect(await getBackground("mestre-1", "m-vazio")).toBeNull();
  });

  it("exige uid e id", async () => {
    await expect(getBackground("", "m1")).rejects.toThrow(/autenticado/i);
    await expect(getBackground("mestre-1", "")).rejects.toThrow(/mapa/i);
  });
});

/* ════════════════════════════════════════════════════════════════════════
 *  HOOK  (AC-2)
 * ════════════════════════════════════════════════════════════════════════ */

describe("useWorldMaps", () => {
  it("assina os moldes do mestre ordenados por updatedAt e cancela no unmount", () => {
    const { result, unmount } = renderHook(() => useWorldMaps("mestre-1"));

    expect(state.listeners[0].q.ref.path).toBe("users/mestre-1/worldmaps");
    expect(firestore.orderBy).toHaveBeenCalledWith("updatedAt", "desc");
    expect(result.current.loading).toBe(true);

    act(() => {
      state.listeners[0].next({
        docs: [{ id: "m1", data: () => ({ name: "As Terras Partidas" }) }],
        empty: false, size: 1,
      });
    });
    expect(result.current.maps).toEqual([{ id: "m1", name: "As Terras Partidas" }]);
    expect(result.current.loading).toBe(false);

    /* Listener vivo depois da desmontagem é vazamento: a tela sai, a assinatura
     * fica cobrando leitura e tentando `setState` em componente morto. */
    const { unsub } = state.listeners[0];
    expect(unsub).not.toHaveBeenCalled();
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it("não assina nada sem uid", () => {
    const { result } = renderHook(() => useWorldMaps(null));
    expect(firestore.onSnapshot).not.toHaveBeenCalled();
    expect(result.current.maps).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("expõe o erro do listener em vez de engolir", () => {
    const { result } = renderHook(() => useWorldMaps("mestre-1"));
    const boom = new Error("permission-denied");
    act(() => { state.listeners[0].error(boom); });
    expect(result.current.error).toBe(boom);
    expect(result.current.maps).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
