import {
  parseInline, parseRichText, plainText, previewLabel,
  toggleWrap, toggleLinePrefix, fontCss, FONTS,
} from '../richText';

const texts = spans => spans.map(s => s.text);

describe('inline: negrito e itálico', () => {
  it('texto simples vira um span sem estilo', () => {
    expect(parseInline('oi')).toEqual([{ text: 'oi', bold: false, italic: false }]);
  });

  it('**negrito** marca só o trecho entre os marcadores', () => {
    const s = parseInline('a **b** c');
    expect(texts(s)).toEqual(['a ', 'b', ' c']);
    expect(s.map(x => x.bold)).toEqual([false, true, false]);
  });

  it('*itálico* marca só o trecho entre os marcadores', () => {
    const s = parseInline('a *b* c');
    expect(texts(s)).toEqual(['a ', 'b', ' c']);
    expect(s.map(x => x.italic)).toEqual([false, true, false]);
  });

  it('negrito e itálico se combinam', () => {
    const s = parseInline('**a *b* c**');
    const meio = s.find(x => x.text === 'b');
    expect(meio).toEqual({ text: 'b', bold: true, italic: true });
  });

  it('marcador sem fechamento fica literal (você ainda está digitando)', () => {
    expect(texts(parseInline('a **b'))).toEqual(['a **b']);
    expect(texts(parseInline('a *b'))).toEqual(['a *b']);
  });

  it('linha vazia devolve um span vazio, não array vazio', () => {
    expect(parseInline('')).toEqual([{ text: '', bold: false, italic: false }]);
  });
});

describe('blocos', () => {
  it('# e ## viram títulos', () => {
    const b = parseRichText('# Grande\n## Menor');
    expect(b.map(x => x.type)).toEqual(['h1', 'h2']);
    expect(texts(b[0].spans)).toEqual(['Grande']);
    expect(texts(b[1].spans)).toEqual(['Menor']);
  });

  it('## não é confundido com #', () => {
    expect(parseRichText('## x')[0].type).toBe('h2');
    expect(parseRichText('# x')[0].type).toBe('h1');
  });

  it('linhas de lista consecutivas viram UM bloco', () => {
    const b = parseRichText('- um\n- dois\n- três');
    expect(b).toHaveLength(1);
    expect(b[0].type).toBe('ul');
    expect(b[0].items).toHaveLength(3);
    expect(texts(b[0].items[1])).toEqual(['dois']);
  });

  it('aceita * e - como marcador', () => {
    expect(parseRichText('* a')[0].type).toBe('ul');
    expect(parseRichText('- a')[0].type).toBe('ul');
  });

  it('lista numerada guarda o número inicial', () => {
    const b = parseRichText('3. um\n4. dois');
    expect(b[0].type).toBe('ol');
    expect(b[0].start).toBe(3);
    expect(b[0].items).toHaveLength(2);
  });

  it('listas de tipos diferentes não se fundem', () => {
    const b = parseRichText('- a\n1. b');
    expect(b.map(x => x.type)).toEqual(['ul', 'ol']);
  });

  it('linha em branco vira espaçador', () => {
    const b = parseRichText('a\n\nb');
    expect(b.map(x => x.type)).toEqual(['p', 'space', 'p']);
  });

  it('estilo inline funciona dentro de título e de item de lista', () => {
    expect(parseRichText('# **forte**')[0].spans[0].bold).toBe(true);
    expect(parseRichText('- *leve*')[0].items[0][0].italic).toBe(true);
  });

  it('entrada vazia ou inválida devolve []', () => {
    expect(parseRichText('')).toEqual([]);
    expect(parseRichText(null)).toEqual([]);
    expect(parseRichText(undefined)).toEqual([]);
  });

  it('normaliza CRLF', () => {
    expect(parseRichText('a\r\nb').map(x => x.type)).toEqual(['p', 'p']);
  });
});

describe('texto puro e rótulo', () => {
  it('remove a marcação', () => {
    expect(plainText('# Cripta\n- **tocha** acesa')).toBe('Cripta tocha acesa');
  });

  it('rótulo trunca com reticências', () => {
    expect(previewLabel('# Salão dos Ossos Antigos e Esquecidos')).toBe('Salão dos Ossos Antigos…');
    expect(previewLabel('curto')).toBe('curto');
  });

  it('texto vazio tem rótulo padrão', () => {
    expect(previewLabel('')).toBe('Texto');
    expect(previewLabel('   ')).toBe('Texto');
  });
});

describe('toggleWrap (Ctrl+B / Ctrl+I)', () => {
  it('envolve a seleção e reposiciona a seleção sobre o conteúdo', () => {
    const r = toggleWrap('abc', 1, 2, '**');
    expect(r.text).toBe('a**b**c');
    expect(r.text.slice(r.start, r.end)).toBe('b');
  });

  it('desfaz quando a seleção já inclui os marcadores', () => {
    const r = toggleWrap('a**b**c', 1, 6, '**');
    expect(r.text).toBe('abc');
    expect(r.text.slice(r.start, r.end)).toBe('b');
  });

  it('desfaz quando os marcadores estão logo fora da seleção', () => {
    const r = toggleWrap('a**b**c', 3, 4, '**');
    expect(r.text).toBe('abc');
    expect(r.text.slice(r.start, r.end)).toBe('b');
  });

  it('sem seleção insere o par com o cursor no meio', () => {
    const r = toggleWrap('ac', 1, 1, '**');
    expect(r.text).toBe('a****c');
    expect(r.start).toBe(3);
    expect(r.end).toBe(3);
  });

  it('funciona com itálico (marcador de 1 caractere)', () => {
    const r = toggleWrap('abc', 1, 2, '*');
    expect(r.text).toBe('a*b*c');
    expect(r.text.slice(r.start, r.end)).toBe('b');
  });

  it('tolera índices fora do texto', () => {
    expect(toggleWrap('ab', -5, 99, '*').text).toBe('*ab*');
    expect(toggleWrap(null, 0, 0, '*').text).toBe('**');
  });
});

describe('toggleLinePrefix (títulos e listas)', () => {
  it('aplica prefixo na linha do cursor', () => {
    expect(toggleLinePrefix('abc', 1, 1, '# ').text).toBe('# abc');
  });

  it('reaplicar o mesmo prefixo remove', () => {
    expect(toggleLinePrefix('# abc', 3, 3, '# ').text).toBe('abc');
  });

  it('troca um prefixo por outro em vez de acumular', () => {
    expect(toggleLinePrefix('# abc', 3, 3, '## ').text).toBe('## abc');
    expect(toggleLinePrefix('- abc', 3, 3, '# ').text).toBe('# abc');
  });

  it('aplica em todas as linhas tocadas pela seleção', () => {
    const r = toggleLinePrefix('a\nb\nc', 0, 5, '- ');
    expect(r.text).toBe('- a\n- b\n- c');
  });

  it('seleção que termina antes da última linha não a inclui', () => {
    // índice 3 é o \n depois do "b": a seleção cobre só "a" e "b"
    expect(toggleLinePrefix('a\nb\nc', 0, 3, '- ').text).toBe('- a\n- b\nc');
  });

  it('lista numerada renumera conforme a posição', () => {
    const r = toggleLinePrefix('a\nb\nc', 0, 5, '1. ');
    expect(r.text).toBe('1. a\n2. b\n3. c');
  });

  it('remove a numeração quando todas as linhas já são numeradas', () => {
    const r = toggleLinePrefix('1. a\n2. b', 0, 9, '1. ');
    expect(r.text).toBe('a\nb');
  });

  it('não mexe nas linhas fora da seleção', () => {
    const r = toggleLinePrefix('a\nb\nc', 2, 3, '# ');
    expect(r.text).toBe('a\n# b\nc');
  });
});

describe('fontes', () => {
  it('resolve o css de cada fonte conhecida', () => {
    FONTS.forEach(f => expect(fontCss(f.id)).toBe(f.css));
  });
  it('id desconhecido cai numa fonte válida', () => {
    expect(fontCss('nao-existe')).toBe(fontCss('inter'));
  });
});
