import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { measurePill, samePill, useSlidingPill } from "../useSlidingPill";

/* jsdom devolve 0 em todos os offsets de layout. Espelhamos `data-offset*`
   nas props reais para simular geometria sem precisar de browser. */
const OFFSET_ATTRS = {
  offsetLeft: "offsetleft",
  offsetTop: "offsettop",
  offsetWidth: "offsetwidth",
  offsetHeight: "offsetheight",
};

beforeAll(() => {
  Object.entries(OFFSET_ATTRS).forEach(([prop, ds]) => {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get() { return Number(this.dataset[ds] || 0); },
    });
  });
});

/* ResizeObserver não existe no jsdom — fake que guarda os callbacks. */
let observers = [];
beforeEach(() => {
  observers = [];
  global.ResizeObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => { delete global.ResizeObserver; });

const fireResize = () => act(() => { observers.forEach(o => o.cb([])); });

function Nav({ active, items, depsKey }) {
  const { containerRef, setItemRef, pill } = useSlidingPill(active, depsKey);
  return (
    <div ref={containerRef}>
      {pill && (
        <div data-testid="pill" style={{
          width: pill.width, height: pill.height,
          transform: `translate(${pill.left}px, ${pill.top}px)`,
          opacity: pill.visible ? 1 : 0,
        }} />
      )}
      {items.map(it => (
        <button key={it.id} ref={setItemRef(it.id)}
          data-offsetleft={it.left} data-offsettop={it.top}
          data-offsetwidth={it.width} data-offsetheight={it.height}>{it.id}</button>
      ))}
    </div>
  );
}

const ITEMS = [
  { id: "fichas", left: 0, top: 0, width: 200, height: 40 },
  { id: "mapas", left: 0, top: 44, width: 200, height: 40 },
];

describe("measurePill", () => {
  it("devolve null sem elemento", () => {
    expect(measurePill(null)).toBeNull();
    expect(measurePill(undefined)).toBeNull();
  });

  it("lê a geometria do elemento", () => {
    expect(measurePill({ offsetLeft: 8, offsetTop: 44, offsetWidth: 204, offsetHeight: 40 }))
      .toEqual({ left: 8, top: 44, width: 204, height: 40, visible: true });
  });
});

describe("samePill", () => {
  const a = { left: 0, top: 44, width: 200, height: 40, visible: true };

  it("é true para geometrias idênticas", () => {
    expect(samePill(a, { ...a })).toBe(true);
  });

  it("é false quando qualquer dimensão muda", () => {
    expect(samePill(a, { ...a, width: 60 })).toBe(false);
    expect(samePill(a, { ...a, top: 0 })).toBe(false);
    expect(samePill(a, { ...a, visible: false })).toBe(false);
  });

  it("é false com qualquer lado ausente", () => {
    expect(samePill(null, a)).toBe(false);
    expect(samePill(a, null)).toBe(false);
  });
});

describe("useSlidingPill", () => {
  it("posiciona o realce sobre o item ativo no primeiro render", () => {
    render(<Nav active="fichas" items={ITEMS} />);
    const pill = screen.getByTestId("pill");
    expect(pill).toHaveStyle({ transform: "translate(0px, 0px)", width: "200px", height: "40px" });
  });

  it("desliza ao trocar de item ativo", () => {
    const { rerender } = render(<Nav active="fichas" items={ITEMS} />);
    rerender(<Nav active="mapas" items={ITEMS} />);
    expect(screen.getByTestId("pill")).toHaveStyle({ transform: "translate(0px, 44px)" });
  });

  it("some no lugar quando a seção ativa não está na barra", () => {
    const { rerender } = render(<Nav active="mapas" items={ITEMS} />);
    rerender(<Nav active="configuracoes" items={ITEMS} />);
    const pill = screen.getByTestId("pill");
    expect(pill).toHaveStyle({ opacity: "0" });
    expect(pill).toHaveStyle({ transform: "translate(0px, 44px)" });
  });

  it("re-mede quando o layout muda depois do commit (sidebar recolhendo)", () => {
    render(<Nav active="fichas" items={ITEMS} />);
    expect(screen.getByTestId("pill")).toHaveStyle({ width: "200px" });

    // A largura só encolhe DURANTE a transição CSS, depois do layout effect.
    screen.getByText("fichas").dataset.offsetwidth = "44";
    fireResize();

    expect(screen.getByTestId("pill")).toHaveStyle({ width: "44px" });
  });

  it("observa container e item ativo", () => {
    render(<Nav active="fichas" items={ITEMS} />);
    expect(observers.length).toBeGreaterThan(0);
  });
});
