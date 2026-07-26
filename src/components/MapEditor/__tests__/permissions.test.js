import { canMove, canCreate, canDelete, nextPerm, creatableLayers } from '../permissions';

const scene = {
  layers: [
    { id: 'layer-character', locked: false },
    { id: 'layer-map', locked: true },
    { id: 'layer-prop', locked: false },
  ],
  permissions: {
    'layer-character': { update: 'owner', delete: 'owner' },
    'layer-prop': { update: 'all', create: true },
  },
};
const own   = { id: 'a', layerId: 'layer-character', ownerId: 'p1', locked: false };
const alien = { id: 'b', layerId: 'layer-character', ownerId: 'p2', locked: false };

describe('canMove', () => {
  it('mestre sempre pode', () => expect(canMove(scene, alien, 'gm', true)).toBe(true));
  it('dono move o próprio em camada owner', () => expect(canMove(scene, own, 'p1', false)).toBe(true));
  it('não move token alheio em camada owner', () => expect(canMove(scene, alien, 'p1', false)).toBe(false));
  it('modo all libera qualquer membro', () =>
    expect(canMove(scene, { ...alien, layerId: 'layer-prop' }, 'p1', false)).toBe(true));
  it('camada sem permissão bloqueia', () =>
    expect(canMove(scene, { ...own, layerId: 'layer-map' }, 'p1', false)).toBe(false));
  it('elemento locked bloqueia', () => expect(canMove(scene, { ...own, locked: true }, 'p1', false)).toBe(false));
  it('camada locked bloqueia mesmo com owner', () =>
    expect(canMove({ ...scene, layers: [{ id: 'layer-character', locked: true }] }, own, 'p1', false)).toBe(false));
});

describe('canCreate / canDelete', () => {
  it('create true na camada libera', () => expect(canCreate(scene, 'layer-prop', 'p1', false)).toBe(true));
  it('create ausente bloqueia', () => expect(canCreate(scene, 'layer-character', 'p1', false)).toBe(false));
  it('delete owner só do dono', () => {
    expect(canDelete(scene, own, 'p1', false)).toBe(true);
    expect(canDelete(scene, alien, 'p1', false)).toBe(false);
  });
  it('mestre deleta qualquer', () => expect(canDelete(scene, alien, 'gm', true)).toBe(true));
});

/* Estes eixos existiam em permissions.js COM teste, mas nada no editor os chamava — só
 * canMove era importado. O ciclo da UI e a liberação de ferramentas fecham essa ponta. */
describe('canDelete aceita "all" além de "owner"', () => {
  const sc = {
    layers: [{ id: 'L', locked: false }],
    permissions: { L: { delete: 'all' } },
  };
  const meu    = { id: 'a', layerId: 'L', ownerId: 'p1', locked: false };
  const alheio = { id: 'b', layerId: 'L', ownerId: 'p2', locked: false };

  it('modo all deixa qualquer membro apagar', () => {
    expect(canDelete(sc, alheio, 'p1', false)).toBe(true);
  });
  it('modo owner continua restrito ao dono (retrocompatível)', () => {
    const owner = { ...sc, permissions: { L: { delete: 'owner' } } };
    expect(canDelete(owner, meu, 'p1', false)).toBe(true);
    expect(canDelete(owner, alheio, 'p1', false)).toBe(false);
  });
  it('elemento ou camada travada bloqueia mesmo em all', () => {
    expect(canDelete(sc, { ...alheio, locked: true }, 'p1', false)).toBe(false);
    expect(canDelete({ ...sc, layers: [{ id: 'L', locked: true }] }, alheio, 'p1', false)).toBe(false);
  });
});

describe('nextPerm — ciclo da UI', () => {
  it('mover: none → owner → all → none', () => {
    expect(nextPerm('update', 'none')).toBe('owner');
    expect(nextPerm('update', 'owner')).toBe('all');
    expect(nextPerm('update', 'all')).toBe('none');
  });
  it('apagar cicla nos mesmos 3 modos', () => {
    expect(nextPerm('delete', 'none')).toBe('owner');
    expect(nextPerm('delete', 'all')).toBe('none');
  });
  it('criar é booleano', () => {
    expect(nextPerm('create', false)).toBe(true);
    expect(nextPerm('create', true)).toBe(false);
    expect(nextPerm('create', undefined)).toBe(true);
  });
  it('valor desconhecido entra no ciclo pelo começo', () => {
    expect(nextPerm('update', 'lixo')).toBe('none');
    expect(nextPerm('update', undefined)).toBe('none');
  });
});

describe('creatableLayers — quais ferramentas o jogador recebe', () => {
  const sc = {
    layers: [{ id: 'A', locked: false }, { id: 'B', locked: false }, { id: 'C', locked: true }],
    permissions: { A: { create: true }, C: { create: true } },
  };
  it('lista só as camadas com create liberado', () => {
    expect(creatableLayers(sc, 'p1', false)).toEqual(['A']);
  });
  it('camada travada não conta nem com create true', () => {
    expect(creatableLayers(sc, 'p1', false)).not.toContain('C');
  });
  it('sem uid não cria nada', () => {
    expect(creatableLayers(sc, null, false)).toEqual([]);
  });
  it('mestre cria em todas, inclusive travadas', () => {
    expect(creatableLayers(sc, 'gm', true)).toEqual(['A', 'B', 'C']);
  });
});
