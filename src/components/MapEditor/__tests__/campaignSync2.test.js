/* spec 0032 Q4 / AC-4 — a fronteira de escrita da mesa PROPAGA a falha.
 *
 * Até a onda 2 estas três funções engoliam o erro (`commitBatchSilent` no `publishElements`,
 * `@policy silent` no `saveSceneMeta`). Combinado com o autosave do `index.jsx`, que avançava
 * a baseline antes de publicar, isso significava perder trabalho do mestre em silêncio.
 *
 * Estes testes travam o lado do módulo de sync; o comportamento do autosave (baseline que não
 * avança + reenvio + aviso) está em `syncRetry.test.jsx`. */
import * as repo from '../../../infrastructure/firestore/mapSyncRepo';
import { publishElements, saveSceneMeta, createScene } from '../sync/campaignSync2';

jest.mock('../../../infrastructure/firestore/mapSyncRepo');

const EL = (id) => ({
  id, type: 'token', layerId: 'layer-character', x: 0, y: 0, size: 40,
  color: '#4ade80', label: id, z: 0,
});

// O preset Jest do CRA usa `resetMocks: true` — reinstalar tudo aqui.
beforeEach(() => {
  repo.elementPath.mockImplementation((cid, sid, elId) => ['campaigns', cid, 'map', sid, 'elements', elId]);
  repo.mapDocPath.mockImplementation((cid, ...seg) => ['campaigns', cid, 'map', ...seg]);
  repo.commitBatch.mockResolvedValue(undefined);
  repo.saveSceneMeta.mockResolvedValue(undefined);
});

describe('publishElements', () => {
  it('escreve o diff com `commitBatch` — o lote strict, não o antigo silencioso', async () => {
    const ok = await publishElements({}, 'c1', 's1', {}, { a: EL('a') });

    expect(ok).toBe(true);
    expect(repo.commitBatch).toHaveBeenCalledTimes(1);
    // A garantia estrutural: a variante que engolia o erro não existe mais no repositório.
    expect(repo.commitBatchSilent).toBeUndefined();
  });

  it('REJEITA quando o lote falha — antes resolvia e a alteração sumia do diff', async () => {
    repo.commitBatch.mockRejectedValue(new Error('resource-exhausted'));

    await expect(publishElements({}, 'c1', 's1', {}, { a: EL('a') }))
      .rejects.toThrow('resource-exhausted');
  });

  it('sem diff não vai à rede', async () => {
    const mesmo = { a: EL('a') };
    expect(await publishElements({}, 'c1', 's1', mesmo, { ...mesmo })).toBe(false);
    expect(repo.commitBatch).not.toHaveBeenCalled();
  });
});

describe('saveSceneMeta', () => {
  it('REJEITA quando a meta não grava', async () => {
    repo.saveSceneMeta.mockRejectedValue(new Error('denied'));

    await expect(saveSceneMeta({}, 'c1', 'u1', { id: 's1', name: 'Cripta', elements: [] }))
      .rejects.toThrow('denied');
  });
});

describe('createScene', () => {
  it('devolve o id quando a cena grava', async () => {
    const id = await createScene({}, 'c1', 'u1', 'Cripta');

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(repo.saveSceneMeta).toHaveBeenCalledWith('c1', id, expect.any(Object), 'u1');
  });

  it('NÃO devolve id quando o `setDoc` falha — a mesa apontaria para documento inexistente', async () => {
    // Este era o quarto ponto do bug: `saveSceneMeta` silencioso + `return sc.id` incondicional
    // faziam o `addScene` gravar o ponteiro `map/state` para uma cena que nunca existiu.
    repo.saveSceneMeta.mockRejectedValue(new Error('unavailable'));

    await expect(createScene({}, 'c1', 'u1', 'Cripta')).rejects.toThrow('unavailable');
  });
});
