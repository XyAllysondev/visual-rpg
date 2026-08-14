/* spec 0032 Q4 / AC-4 — o autosave da mesa não perde alteração em silêncio.
 *
 * Teste de INTEGRAÇÃO: renderiza o MapEditor de verdade em modo campanha, com o módulo de
 * sync mockado, e mede o que o componente MANDA para o Firestore.
 *
 * Por que integração e não unidade: o bug não estava numa função, estava na ORDEM entre duas
 * linhas do efeito de autosave —
 *
 *     lastPubRef.current = next;                     // baseline avançava PRIMEIRO
 *     publishElements(db, cid, sc.id, prev, next);   // sem await; falha engolida
 *
 * — e nessa ordem uma escrita que falhava nunca mais entrava num diff. Só dá para provar
 * observando a SEGUNDA publicação: ela precisa carregar o mesmo `prev` da primeira.
 *
 * Comportamento antigo x novo (o que cada teste derruba se o conserto for revertido):
 *  - "reenvia o mesmo diff": antes só havia UMA chamada, e com a baseline já adiantada.
 *  - "não reenvia quando confirma": antes também não reenviava, mas por não ter retry nenhum.
 *  - "avisa depois de N falhas": o aviso não existia.
 *  - "imagem que não sobe é tentada de novo": antes o id entrava em `uploadedRef` antes da
 *    escrita, então a segunda varredura pulava a imagem.
 */
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import MapEditor from '../index.jsx';
import * as sync from '../sync/campaignSync2.js';
import { DEFAULT_LAYERS_V2, defaultGrid, SCHEMA_V } from '../schema';

jest.mock('../sync/campaignSync2.js');
jest.mock('../../../firebase', () => ({ db: {}, auth: {} }));
jest.mock('../sync/live.js', () => ({
  makeLivePublisher: () => ({ publish: () => {}, destroy: () => {} }),
  subscribeLive: () => () => {},
  isFresh: () => false,
  STALE_MS: 12000,
  PING_MS: 3000,
}));
jest.mock('../assets/assetLib.js', () => {
  const real = jest.requireActual('../assets/assetLib.js');
  return { ...real, subscribeAssets: () => () => {}, saveAsset: () => {}, deleteAsset: () => {} };
});

const TOKEN = {
  id: 'tk', type: 'token', layerId: 'layer-character', x: 100, y: 100, size: 40,
  color: '#4ade80', label: 'Z', z: 5, conditions: [],
  hidden: false, locked: false, spectre: false, ownerId: null, parentId: null, rotation: 0,
};

const META = {
  id: 's1', name: 'Cena 1', schemaV: SCHEMA_V,
  layers: DEFAULT_LAYERS_V2,
  grid: defaultGrid(),
  fog: { v: 2, fillAll: false, color: '#000000', shapes: [] },
  permissions: {},
  bgSize: { w: 1000, h: 800 },
};

let cbState, cbScenes, cbEls;

// O preset Jest do CRA usa `resetMocks: true`: o automock é zerado antes de cada teste.
beforeEach(() => {
  jest.useFakeTimers();
  cbState = cbScenes = cbEls = null;
  sync.migrateFirestoreV2.mockResolvedValue({ v: 2, activeSceneId: 's1' });
  sync.subscribeMapState.mockImplementation((db, cid, cb) => { cbState = cb; return () => {}; });
  sync.subscribeScenes.mockImplementation((db, cid, cb) => { cbScenes = cb; return () => {}; });
  sync.subscribeElements.mockImplementation((db, cid, sid, cb) => { cbEls = cb; return () => {}; });
  sync.publishElements.mockResolvedValue(true);
  sync.saveSceneMeta.mockResolvedValue(undefined);
  sync.saveImage.mockResolvedValue({ imageId: 'img_1', data: 'd' });
  sync.getImage.mockResolvedValue(null);
  sync.getCampaignMembers.mockResolvedValue([]);
  sync.setActiveScene.mockResolvedValue(undefined);
  sync.createScene.mockResolvedValue('s2');
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => { cleanup(); jest.useRealTimers(); localStorage.clear(); });

const passar = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); };

/* O tique de reenvio e o debounce do autosave são timers ENCADEADOS: o segundo só é agendado
   depois que o React re-renderiza com o tique novo. Avançar os dois de uma vez só dispararia
   o primeiro — daí os dois `passar` separados. */
const passarBackoff = async (ms) => { await passar(ms); await passar(1200); };

/** Monta a mesa como MESTRE e entrega a cena carregada, com o autosave já em repouso. */
async function montarMesa() {
  const view = render(<MapEditor campaignId="c1" uid="u1" isMaster db={{}} />);
  await act(async () => {});                         // migração + assinaturas
  await act(async () => { cbState({ v: 2, activeSceneId: 's1' }); });
  await act(async () => { cbScenes([META]); });
  await act(async () => { cbEls([TOKEN], false); }); // monta a cena → baseline = { tk }
  await passar(1500);                                // deixa o 1º ciclo de autosave passar
  sync.publishElements.mockClear();
  sync.saveSceneMeta.mockClear();
  return view;
}

/** Apaga o token pelo teclado (Ctrl+A seleciona tudo, Delete apaga) → diff pendente. */
function apagarToken() {
  fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
  fireEvent.keyDown(window, { key: 'Delete' });
}

const chamadasPublish = () => sync.publishElements.mock.calls.map(
  ([, , , prev, next]) => ({ prev: Object.keys(prev), next: Object.keys(next) })
);

/* jsdom não decodifica imagem: `new Image()` nunca dispara `onload`. O componente usa isso
   para medir o fundo, então o teste instala um decodificador falso — é o único jeito de
   exercitar o caminho real (FileReader → `bgSize` na meta → efeito de upload). */
function comImagemFalsa(fn) {
  const real = global.Image;
  global.Image = class {
    constructor() { this.width = 100; this.height = 80; this.onload = null; this.onerror = null; }
    set src(_v) { this.onload?.(); }
  };
  return Promise.resolve().then(fn).finally(() => { global.Image = real; });
}

/** Carrega um fundo pelo input de arquivo: muda a META (`bgSize`) e enfileira um upload. */
async function soltarFundo(view, nome) {
  const input = view.container.querySelector('input[type="file"]');
  const file = new File(['x'], nome, { type: 'image/png' });
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
  await passar(60);   // o FileReader do jsdom resolve fora do stack atual
}

describe('autosave de elementos — baseline x confirmação (AC-4)', () => {
  it('publicação que FALHA não avança a baseline: o mesmo diff volta no ciclo seguinte', async () => {
    await montarMesa();
    sync.publishElements.mockRejectedValue(new Error('unavailable'));

    apagarToken();
    await passar(400);                     // debounce 300ms → 1ª publicação (falha)

    expect(chamadasPublish()).toEqual([{ prev: ['tk'], next: [] }]);

    await passarBackoff(1000);             // backoff 1s → reenvio automático

    const calls = chamadasPublish();
    expect(calls.length).toBeGreaterThanOrEqual(2);
    // A prova do conserto: o REENVIO ainda parte da baseline antiga (com `tk`). No código
    // antigo `lastPubRef` já teria virado `{}` e nem haveria segunda chamada.
    calls.forEach((c) => expect(c).toEqual({ prev: ['tk'], next: [] }));
  });

  it('publicação que CONFIRMA avança a baseline: nada é reenviado', async () => {
    await montarMesa();

    apagarToken();
    await passar(400);

    expect(sync.publishElements).toHaveBeenCalledTimes(1);

    await passar(60000);                   // muito além de qualquer backoff

    expect(sync.publishElements).toHaveBeenCalledTimes(1);
  });

  it('falhas seguidas viram aviso VISÍVEL ao mestre, e sumir depois que volta a gravar', async () => {
    const { queryByTestId, getByTestId } = await montarMesa();
    sync.publishElements.mockRejectedValue(new Error('unavailable'));

    apagarToken();
    await passar(400);                     // falha 1
    expect(queryByTestId('mesa-sync-falha')).toBeNull();

    await passarBackoff(1000);             // falha 2 (backoff 1s)
    expect(queryByTestId('mesa-sync-falha')).toBeNull();

    await passarBackoff(2000);             // falha 3 (backoff 2s) → limite atingido
    expect(getByTestId('mesa-sync-falha').textContent).toMatch(/não chegaram à mesa/i);

    sync.publishElements.mockResolvedValue(true);
    await passarBackoff(4000);             // backoff 4s → reenvio bem-sucedido

    expect(queryByTestId('mesa-sync-falha')).toBeNull();
  });
});

describe('autosave da meta da cena (AC-4)', () => {
  it('meta que não grava não avança `lastMetaRef` — o ciclo seguinte reenvia', () =>
    comImagemFalsa(async () => {
      const view = await montarMesa();
      sync.saveSceneMeta.mockRejectedValue(new Error('denied'));

      await soltarFundo(view, 'mapa.png');   // muda `bgSize` → a meta fica suja
      await passar(1200);                    // debounce da meta é 1s

      const antes = sync.saveSceneMeta.mock.calls.length;
      expect(antes).toBeGreaterThan(0);

      await passarBackoff(1000);             // backoff 1s + debounce

      // No código antigo `lastMetaRef` já tinha sido igualado à meta suja: a gravação
      // perdida nunca voltava, e esta segunda chamada não existiria.
      expect(sync.saveSceneMeta.mock.calls.length).toBeGreaterThan(antes);
    }));
});

describe('upload de imagem (AC-4)', () => {
  it('imagem que NÃO sobe não é marcada como enviada — a varredura seguinte tenta de novo', () =>
    comImagemFalsa(async () => {
      const view = await montarMesa();
      sync.saveImage.mockResolvedValue(null);         // falha de upload

      await soltarFundo(view, 'mapa.png');
      const primeiraId = sync.saveImage.mock.calls[0]?.[2];
      expect(primeiraId).toMatch(/^img_/);

      await passar(1000);                              // ids são `img_<Date.now()>`
      await soltarFundo(view, 'outro.png');            // 2ª imagem → efeito varre as duas

      const idsTentados = sync.saveImage.mock.calls.map((c) => c[2]);
      // A primeira imagem aparece DUAS vezes: continua pendente. No código antigo o id ia
      // para `uploadedRef` antes da escrita e a segunda varredura pularia.
      expect(idsTentados.filter((id) => id === primeiraId).length).toBeGreaterThanOrEqual(2);
    }));

  it('imagem que sobe é marcada como enviada e NÃO é reenviada', () =>
    comImagemFalsa(async () => {
      const view = await montarMesa();

      await soltarFundo(view, 'mapa.png');
      const primeiraId = sync.saveImage.mock.calls[0]?.[2];
      sync.saveImage.mockResolvedValue({ imageId: primeiraId, data: 'd' });

      await passar(1000);
      await soltarFundo(view, 'outro.png');

      const idsTentados = sync.saveImage.mock.calls.map((c) => c[2]);
      expect(idsTentados.filter((id) => id === primeiraId).length).toBe(1);
    }));
});

describe('criar cena (AC-4)', () => {
  it('cena que não grava NÃO vira ponteiro da mesa', async () => {
    const { getByTitle } = await montarMesa();
    sync.createScene.mockRejectedValue(new Error('unavailable'));
    sync.setActiveScene.mockClear();

    await act(async () => { fireEvent.click(getByTitle('Nova cena')); });

    // Antes, `createScene` devolvia o id mesmo com o `setDoc` falhando e o `map/state`
    // passava a apontar para um documento inexistente.
    expect(sync.createScene).toHaveBeenCalled();
    expect(sync.setActiveScene).not.toHaveBeenCalled();
  });

  it('cena que grava vira ponteiro normalmente', async () => {
    const { getByTitle } = await montarMesa();
    sync.setActiveScene.mockClear();

    await act(async () => { fireEvent.click(getByTitle('Nova cena')); });

    expect(sync.setActiveScene).toHaveBeenCalledWith({}, 'c1', 'u1', 's2');
  });
});
