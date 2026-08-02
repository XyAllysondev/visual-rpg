import { isFresh, makeThrottle, STALE_MS, PING_MS } from '../sync/live';

describe('isFresh', () => {
  it('fresco dentro da janela, velho fora', () => {
    const now = 100000;
    expect(isFresh({ at: now - 1000 }, now)).toBe(true);
    expect(isFresh({ at: now - STALE_MS - 1 }, now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
    expect(isFresh({}, now)).toBe(false);
  });
  it('janela custom (ping 3s)', () => {
    const now = 50000;
    expect(isFresh({ at: now - PING_MS + 1 }, now, PING_MS)).toBe(true);
    expect(isFresh({ at: now - PING_MS - 1 }, now, PING_MS)).toBe(false);
  });
});

describe('makeThrottle (trailing)', () => {
  it('1ª chamada dispara já; seguidas na janela agrupam com o último argumento', () => {
    let t = 0;
    const timers = [];
    const calls = [];
    const th = makeThrottle((v) => calls.push(v), 250, () => t,
      { set: (fn, ms) => { timers.push({ fn, due: t + ms }); return timers.length; }, clear: () => {} });
    th('a');                    // dispara imediato
    expect(calls).toEqual(['a']);
    t = 100; th('b');           // dentro da janela → agenda trailing
    t = 200; th('c');           // atualiza pending, não re-agenda
    expect(calls).toEqual(['a']);
    t = 250; timers[0].fn();    // trailing dispara com o último valor
    expect(calls).toEqual(['a', 'c']);
    t = 600; th('d');           // janela livre → imediato
    expect(calls).toEqual(['a', 'c', 'd']);
  });

  /* Regressão: mesa tática abria em tela preta com `TypeError: Illegal invocation`.
   * O `timers` padrão era `{ set: setTimeout }`, então `timers.set(fire, wait)` chamava o
   * `setTimeout` do navegador com `this` = objeto literal. A WebIDL exige o global como
   * receptor e o Chrome lança. O jsdom aceita qualquer receptor, então o teste emula a
   * regra do navegador. */
  it('agenda o trailing com os timers PADRÃO sem quebrar o receptor do setTimeout', () => {
    const setTimeoutReal = global.setTimeout;
    const agendados = [];
    function setTimeoutComoNoNavegador(cb, ms) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      agendados.push({ cb, ms });
      return agendados.length;
    }
    global.setTimeout = setTimeoutComoNoNavegador;
    try {
      let t = 0;
      const calls = [];
      const th = makeThrottle((v) => calls.push(v), 250, () => t); // sem injetar timers
      th('a');                                   // imediata, não agenda
      expect(calls).toEqual(['a']);
      t = 100;
      expect(() => th('b')).not.toThrow();       // aqui estourava o Illegal invocation
      expect(agendados).toHaveLength(1);
      expect(agendados[0].ms).toBe(150);
      agendados[0].cb();
      expect(calls).toEqual(['a', 'b']);
    } finally {
      global.setTimeout = setTimeoutReal;
    }
  });
});
