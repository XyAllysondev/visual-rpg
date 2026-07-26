/* Teste de INTEGRAÇÃO da pilha de empilhamento — renderiza o MapEditor de verdade e mede o
 * z-index no DOM.
 *
 * Existe porque o bug não estava na matemática: `layerZIndex` sempre esteve correto. O
 * defeito era a grade e a névoa usarem constantes fixas (6 e 200) enquanto os elementos iam
 * de ~100k a ~700k — ou seja, a névoa renderizava ABAIXO de todo token e um inimigo em sala
 * coberta aparecia para o jogador. Um teste só das funções puras não pegaria isso; só medindo
 * o DOM renderizado. */
import { render, cleanup, fireEvent } from '@testing-library/react';
import MapEditor from '../index.jsx';
import { DEFAULT_LAYERS_V2, defaultGrid, SCHEMA_V } from '../schema';

const TOKEN = { id: 'tk', type: 'token', layerId: 'layer-character', x: 100, y: 100, size: 40,
  color: '#4ade80', label: 'Z', z: 5, conditions: [],
  hidden: false, locked: false, spectre: false, ownerId: null, parentId: null, rotation: 0 };

const MAPA = { id: 'mapa', type: 'image', layerId: 'layer-map', x: 0, y: 0, w: 500, h: 400,
  imageId: 'img_x', z: 0, hidden: false, locked: true, spectre: false,
  ownerId: null, parentId: null, rotation: 0 };

const cena = (over = {}) => ({
  id: 's1', name: 'Cena 1', schemaV: SCHEMA_V,
  layers: DEFAULT_LAYERS_V2,
  elements: [TOKEN],
  grid: defaultGrid(),
  fog: { v: 2, fillAll: true, color: '#000000', shapes: [] },
  permissions: {},
  bgSize: { w: 1000, h: 800 },
  ...over,
});

const zOf = (node) => Number(node.style.zIndex);
const svgDe = (container, seletorInterno) => container.querySelector(seletorInterno)?.closest('svg');
const zsDosElementos = (container) => [...container.querySelectorAll('div[style]')]
  .map(n => Number(n.style.zIndex))
  .filter(z => Number.isFinite(z) && z > 0);

function montar(over) {
  localStorage.setItem('nexus_scenes_v1', JSON.stringify([cena(over)]));
  return render(<MapEditor />);
}

afterEach(() => { cleanup(); localStorage.clear(); });

describe('pilha de empilhamento no DOM renderizado', () => {
  it('a névoa renderiza ACIMA do token — o bug que fazia inimigo aparecer em sala coberta', () => {
    const { container, getByText } = montar();

    const fog = svgDe(container, 'mask#nx-fog-mask');
    const token = getByText('Z');

    expect(fog).toBeTruthy();          // fillAll:true precisa produzir a camada de névoa
    expect(zOf(token)).toBeGreaterThan(0);
    expect(zOf(fog)).toBeGreaterThan(zOf(token));
  });

  it('a grade renderiza ABAIXO do token (ela é o chão da mesa, não um véu)', () => {
    const { container, getByText } = montar();

    const grade = svgDe(container, 'pattern#mapgrid');
    const token = getByText('Z');

    expect(grade).toBeTruthy();
    expect(zOf(grade)).toBeLessThan(zOf(token));
  });

  it('a grade fica acima da camada Mapa, então a imagem do mapa não a encobre', () => {
    const { container } = montar({ elements: [MAPA] });

    const grade = svgDe(container, 'pattern#mapgrid');
    const zs = zsDosElementos(container);

    expect(grade).toBeTruthy();
    expect(zs.length).toBeGreaterThan(0);
    expect(Math.min(...zs)).toBeLessThan(zOf(grade));
  });

  it('a névoa fica acima de TODO elemento renderizado, não só do token', () => {
    const { container } = montar({
      elements: [
        MAPA,
        TOKEN,
        { id: 'nota', type: 'note', layerId: 'layer-note', x: 200, y: 200, text: 'segredo', z: 9,
          hidden: false, locked: false, spectre: false, ownerId: null, parentId: null, rotation: 0 },
      ],
    });

    const fog = svgDe(container, 'mask#nx-fog-mask');
    const maiorElemento = Math.max(...zsDosElementos(container));

    expect(fog).toBeTruthy();
    expect(zOf(fog)).toBeGreaterThan(maiorElemento);
  });

  it('sem névoa na cena a camada nem é montada (não custa DOM à toa)', () => {
    const { container } = montar({ fog: { v: 2, fillAll: false, color: '#000000', shapes: [] } });
    expect(container.querySelector('mask#nx-fog-mask')).toBeNull();
  });
});

/* As features das ondas 2 e 3 tinham cobertura só nas funções puras (parser, toggleCut).
 * Aqui se verifica que elas chegam ao DOM — que é onde `fill:'none'` hardcoded morava. */
describe('render dos elementos novos', () => {
  const desenho = (over = {}) => ({
    id: 'dw', type: 'drawing', layerId: 'layer-drawing', x: 0, y: 0, w: 200, h: 150,
    shape: 'rect', color: '#f87171', strokeWidth: 4, z: 1,
    points: [{ x: 0, y: 0 }, { x: 200, y: 150 }],
    hidden: false, locked: false, spectre: false, ownerId: null, parentId: null, rotation: 0,
    ...over,
  });

  it('desenho com preenchimento pinta a área (antes fill era "none" fixo)', () => {
    const { container } = montar({ elements: [desenho({ fill: '#f87171', fillOpacity: 0.4 })] });
    const rect = container.querySelector('svg rect[fill="#f87171"]');
    expect(rect).toBeTruthy();
    expect(rect.getAttribute('fill-opacity')).toBe('0.4');
  });

  it('desenho sem preenchimento continua só contorno', () => {
    const { container } = montar({ elements: [desenho({ fill: 'none' })] });
    expect(container.querySelector('svg rect[fill="#f87171"]')).toBeNull();
    expect(container.querySelector('svg rect[fill="none"]')).toBeTruthy();
  });

  it('estilo de traço tracejado vira strokeDasharray proporcional à espessura', () => {
    const { container } = montar({ elements: [desenho({ strokeStyle: 'dashed' })] });
    const rect = container.querySelector('svg rect[fill="none"]');
    expect(rect.getAttribute('stroke-dasharray')).toBe('12,8'); // 4*3 , 4*2
  });

  it('traço sólido não emite dasharray', () => {
    const { container } = montar({ elements: [desenho({ strokeStyle: 'solid' })] });
    expect(container.querySelector('svg rect[fill="none"]').getAttribute('stroke-dasharray')).toBeNull();
  });

  it('texto rico renderiza título e itens de lista como blocos, não como markdown cru', () => {
    const { container, getByText, queryByText } = montar({
      elements: [{
        id: 'tx', type: 'text', layerId: 'layer-note', x: 10, y: 10,
        text: '# Cripta\n- tocha\n- altar', color: '#f5f5f5', fontSize: 28, fontId: 'inter',
        align: 'left', outlineColor: '#000000', outlineWidth: 0, width: 340, z: 2,
        hidden: false, locked: false, spectre: false, ownerId: null, parentId: null, rotation: 0,
      }],
    });
    expect(getByText('Cripta')).toBeTruthy();
    expect(queryByText('# Cripta')).toBeNull();      // a marcação não vaza para a tela
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
  });

  it('negrito do texto vira peso 700 no span', () => {
    const { getByText } = montar({
      elements: [{
        id: 'tx', type: 'text', layerId: 'layer-note', x: 10, y: 10,
        text: 'a **forte** b', color: '#f5f5f5', fontSize: 28, fontId: 'inter',
        align: 'left', outlineColor: '#000000', outlineWidth: 0, width: 340, z: 2,
        hidden: false, locked: false, spectre: false, ownerId: null, parentId: null, rotation: 0,
      }],
    });
    expect(getByText('forte').style.fontWeight).toBe('700');
  });
});

/* Interações que só as funções puras não provam: o editor de texto in-place e o botão que
 * antes destruia a preparação da nevoa. */
describe('editor de texto in-place', () => {
  const texto = (over = {}) => ({
    id: 'tx', type: 'text', layerId: 'layer-note', x: 10, y: 10,
    text: 'antes', color: '#f5f5f5', fontSize: 28, fontId: 'inter', align: 'left',
    outlineColor: '#000000', outlineWidth: 0, width: 340, z: 2,
    hidden: false, locked: false, spectre: false, ownerId: null, parentId: null, rotation: 0,
    ...over,
  });

  it('duplo-clique abre o editor (a nota legada nunca teve esse caminho)', () => {
    const { getByText, container } = montar({ elements: [texto()] });
    expect(container.querySelector('textarea')).toBeNull();
    fireEvent.doubleClick(getByText('antes'));
    expect(container.querySelector('textarea')).toBeTruthy();
  });

  it('Shift+Enter conclui e o texto digitado fica na cena', () => {
    const { getByText, container, queryByText } = montar({ elements: [texto()] });
    fireEvent.doubleClick(getByText('antes'));
    const ta = container.querySelector('textarea');
    fireEvent.change(ta, { target: { value: 'depois' } });
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });
    expect(container.querySelector('textarea')).toBeNull();
    expect(getByText('depois')).toBeTruthy();
    expect(queryByText('antes')).toBeNull();
  });

  it('texto travado nao abre editor no duplo-clique', () => {
    const { getByText, container } = montar({ elements: [texto({ locked: true })] });
    fireEvent.doubleClick(getByText('antes'));
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('concluir com texto vazio apaga o item em vez de deixar fantasma', () => {
    const { getByText, container, queryByText } = montar({ elements: [texto()] });
    fireEvent.doubleClick(getByText('antes'));
    const ta = container.querySelector('textarea');
    fireEvent.change(ta, { target: { value: '   ' } });
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });
    expect(queryByText('antes')).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
  });
});

describe('"Cobrir tudo" nao pode destruir a preparacao da nevoa', () => {
  const comForma = {
    fog: { v: 2, fillAll: false, color: '#000000',
      shapes: [{ id: 'f1', op: 'add', type: 'rect', x: 100, y: 100, w: 200, h: 150 }] },
  };
  const formaNaMask = (c) => c.querySelector('mask#nx-fog-mask rect[width="200"]');

  it('preserva as formas ja desenhadas (antes gravava shapes: [])', () => {
    const { container, getByTitle } = montar(comForma);
    expect(formaNaMask(container)).toBeTruthy();
    fireEvent.click(getByTitle('Cobrir tudo com névoa'));
    expect(formaNaMask(container)).toBeTruthy(); // a sala pre-desenhada sobreviveu
  });

  it('"Revelar tudo" marca as formas como cortadas em vez de apagar', () => {
    const { container, getByTitle } = montar(comForma);
    fireEvent.click(getByTitle('Revelar toda a névoa'));
    const forma = formaNaMask(container);
    expect(forma).toBeTruthy();
    expect(forma.getAttribute('fill')).toBe('#000'); // #000 = cortada/revelada na mask
  });
});
