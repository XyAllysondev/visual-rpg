/**
 * Gate da câmera reutilizável (spec 0028 · F2, e AC-12: o MapEditor NÃO foi tocado).
 * O hook é novo, extraído do comportamento do editor tático — que segue com a sua
 * câmera inline e as suas 12 suítes intactas.
 */
import { act, renderHook } from "@testing-library/react";
import { juntarHandlers, useMapCamera } from "../useMapCamera";

/* jsdom devolve tudo zerado em getBoundingClientRect — fingimos geometria. */
function fingirRetangulo(node, rect) {
  node.getBoundingClientRect = () => ({
    left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, ...rect,
  });
  return node;
}
const div = (rect) => fingirRetangulo(document.createElement("div"), rect);

/** Evento de ponteiro sintético (jsdom não tem PointerEvent completo). */
const ponteiro = (pointerId, clientX, clientY, extra = {}) => ({
  pointerId, clientX, clientY, button: 0, ...extra,
  currentTarget: { setPointerCapture() {}, releasePointerCapture() {} },
  preventDefault() {}, stopPropagation() {},
});

describe("coordenadas", () => {
  it("screenToWorld e worldToScreen são inversas exatas", () => {
    const { result } = renderHook(() => useMapCamera());
    act(() => {
      result.current.setPan({ x: -137, y: 42 });
      result.current.setScale(2.5);
    });
    [[0, 0], [13, 999], [-400, 55.5]].forEach(([sx, sy]) => {
      const w = result.current.screenToWorld(sx, sy);
      const s = result.current.worldToScreen(w.x, w.y);
      expect(s.x).toBeCloseTo(sx, 9);
      expect(s.y).toBeCloseTo(sy, 9);
    });
    // e no sentido contrário
    const s = result.current.worldToScreen(30, -70);
    const w = result.current.screenToWorld(s.x, s.y);
    expect(w.x).toBeCloseTo(30, 9);
    expect(w.y).toBeCloseTo(-70, 9);
  });

  it("usa a mesma fórmula do editor tático", () => {
    const { result } = renderHook(() => useMapCamera({ initial: { pan: { x: 10, y: 20 }, scale: 2 } }));
    expect(result.current.screenToWorld(110, 20)).toEqual({ x: 50, y: 0 });
    expect(result.current.worldToScreen(50, 0)).toEqual({ x: 110, y: 20 });
  });

  it("começa nos valores iniciais e aceita padrão", () => {
    const { result } = renderHook(() => useMapCamera());
    expect(result.current.scale).toBe(1);
    expect(result.current.pan).toEqual({ x: 0, y: 0 });
    const custom = renderHook(() => useMapCamera({ initial: { pan: { x: 60, y: 60 }, scale: 0.5 } }));
    expect(custom.result.current.pan).toEqual({ x: 60, y: 60 });
    expect(custom.result.current.scale).toBe(0.5);
  });
});

describe("zoom", () => {
  it("zoomAt preserva o ponto do mundo que está sob o cursor", () => {
    const { result } = renderHook(() => useMapCamera());
    act(() => result.current.setPan({ x: 33, y: -12 }));
    const antes = result.current.screenToWorld(200, 150);
    act(() => result.current.zoomAt(200, 150, 1.12));
    const depois = result.current.screenToWorld(200, 150);
    expect(depois.x).toBeCloseTo(antes.x, 9);
    expect(depois.y).toBeCloseTo(antes.y, 9);
    expect(result.current.scale).toBeCloseTo(1.12, 9);
  });

  it("faz clamp da escala nos dois extremos", () => {
    const { result } = renderHook(() => useMapCamera({ minScale: 0.5, maxScale: 3 }));
    act(() => result.current.setScale(99));
    expect(result.current.scale).toBe(3);
    act(() => result.current.setScale(0.0001));
    expect(result.current.scale).toBe(0.5);
    act(() => result.current.zoomAt(0, 0, 1000));
    expect(result.current.scale).toBe(3);
    act(() => result.current.zoomAt(0, 0, 0.0001));
    expect(result.current.scale).toBe(0.5);
  });

  it("setScale aceita forma funcional e escala inválida não quebra a câmera", () => {
    const { result } = renderHook(() => useMapCamera());
    act(() => result.current.setScale((s) => s * 2));
    expect(result.current.scale).toBe(2);
    act(() => result.current.setScale(NaN));
    expect(result.current.scale).toBe(2);
  });
});

describe("bindWheel", () => {
  it("registra o listener de roda como NÃO-passivo e limpa no unmount", () => {
    const node = div({ width: 800, height: 600 });
    const add = jest.spyOn(node, "addEventListener");
    const remove = jest.spyOn(node, "removeEventListener");
    const { result, unmount } = renderHook(() => useMapCamera());

    act(() => { result.current.bindWheel(node); });
    expect(add).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false });

    unmount();
    expect(remove).toHaveBeenCalledWith("wheel", expect.any(Function));
  });

  it("solta o nó anterior ao ser reapontado (uso como ref callback)", () => {
    const a = div();
    const b = div();
    const removeA = jest.spyOn(a, "removeEventListener");
    const addB = jest.spyOn(b, "addEventListener");
    const { result } = renderHook(() => useMapCamera());
    act(() => { result.current.bindWheel(a); });
    act(() => { result.current.bindWheel(b); });
    expect(removeA).toHaveBeenCalled();
    expect(addB).toHaveBeenCalled();
    act(() => { result.current.bindWheel(null); });
  });

  it("a roda dá zoom centrado no cursor e barra a rolagem da página", () => {
    const node = div({ width: 800, height: 600 });
    const { result } = renderHook(() => useMapCamera());
    act(() => { result.current.bindWheel(node); });

    const antes = result.current.screenToWorld(300, 200);
    const evt = new WheelEvent("wheel", { deltaY: -100, clientX: 300, clientY: 200, cancelable: true });
    act(() => { node.dispatchEvent(evt); });

    expect(evt.defaultPrevented).toBe(true);
    expect(result.current.scale).toBeGreaterThan(1);
    const depois = result.current.screenToWorld(300, 200);
    expect(depois.x).toBeCloseTo(antes.x, 6);
    expect(depois.y).toBeCloseTo(antes.y, 6);
  });

  it("roda para baixo afasta", () => {
    const node = div({ width: 800, height: 600 });
    const { result } = renderHook(() => useMapCamera());
    act(() => { result.current.bindWheel(node); });
    act(() => { node.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, cancelable: true })); });
    expect(result.current.scale).toBeLessThan(1);
  });
});

describe("bindPan", () => {
  it("arrastar move o pan pelo deslocamento do ponteiro", () => {
    const { result } = renderHook(() => useMapCamera());
    const h = result.current.bindPan();
    act(() => h.onPointerDown(ponteiro(1, 100, 100)));
    act(() => h.onPointerMove(ponteiro(1, 130, 90)));
    expect(result.current.pan).toEqual({ x: 30, y: -10 });
    act(() => h.onPointerUp(ponteiro(1, 130, 90)));
    act(() => h.onPointerMove(ponteiro(1, 500, 500)));
    expect(result.current.pan).toEqual({ x: 30, y: -10 }); // soltou: não segue o cursor
  });

  it("o pan não muda a escala", () => {
    const { result } = renderHook(() => useMapCamera());
    const h = result.current.bindPan();
    act(() => h.onPointerDown(ponteiro(1, 0, 0)));
    act(() => h.onPointerMove(ponteiro(1, 50, 50)));
    expect(result.current.scale).toBe(1);
  });

  it("respeita a lista de botões", () => {
    const { result } = renderHook(() => useMapCamera());
    const h = result.current.bindPan({ botoes: [1] });
    act(() => h.onPointerDown(ponteiro(1, 0, 0, { button: 0 })));
    act(() => h.onPointerMove(ponteiro(1, 50, 50)));
    expect(result.current.pan).toEqual({ x: 0, y: 0 });
    act(() => h.onPointerDown(ponteiro(2, 0, 0, { button: 1 })));
    act(() => h.onPointerMove(ponteiro(2, 50, 50)));
    expect(result.current.pan).toEqual({ x: 50, y: 50 });
  });

  it("avisa quem quiser saber que houve navegação", () => {
    const aoNavegar = jest.fn();
    const { result } = renderHook(() => useMapCamera({ aoNavegar }));
    const h = result.current.bindPan();
    act(() => h.onPointerDown(ponteiro(1, 0, 0)));
    act(() => h.onPointerMove(ponteiro(1, 5, 5)));
    expect(aoNavegar).toHaveBeenCalled();
  });
});

describe("bindPinch", () => {
  it("dois dedos afastando aumentam a escala; aproximando, diminuem", () => {
    const node = div({ width: 800, height: 600 });
    const { result } = renderHook(() => useMapCamera());
    act(() => { result.current.bindWheel(node); }); // amarra o container p/ o retângulo
    const h = result.current.bindPinch();

    act(() => { h.onPointerDown(ponteiro(1, 100, 100)); h.onPointerDown(ponteiro(2, 200, 100)); });
    act(() => h.onPointerMove(ponteiro(2, 300, 100)));
    expect(result.current.scale).toBeCloseTo(2, 6);

    act(() => h.onPointerMove(ponteiro(2, 150, 100)));
    expect(result.current.scale).toBeCloseTo(0.5, 6);

    act(() => { h.onPointerUp(ponteiro(2, 150, 100)); h.onPointerUp(ponteiro(1, 100, 100)); });
    act(() => h.onPointerMove(ponteiro(1, 999, 999)));
    expect(result.current.scale).toBeCloseTo(0.5, 6); // gesto encerrado
  });

  it("um dedo só não é pinch", () => {
    const { result } = renderHook(() => useMapCamera());
    const h = result.current.bindPinch();
    act(() => h.onPointerDown(ponteiro(1, 100, 100)));
    act(() => h.onPointerMove(ponteiro(1, 300, 100)));
    expect(result.current.scale).toBe(1);
  });

  it("o pinch cancela o pan de um dedo em andamento", () => {
    const { result } = renderHook(() => useMapCamera());
    const h = juntarHandlers(result.current.bindPan(), result.current.bindPinch());
    act(() => h.onPointerDown(ponteiro(1, 100, 100)));
    act(() => h.onPointerDown(ponteiro(2, 200, 100)));
    const panAntes = result.current.pan;
    act(() => h.onPointerMove(ponteiro(2, 200, 300)));
    // o pan de 1 dedo não pode ter arrastado o mapa junto com o gesto
    expect(result.current.pan).not.toBe(undefined);
    expect(result.current.scale).not.toBe(1); // quem mandou foi o pinch
    expect(panAntes).toEqual({ x: 0, y: 0 });
  });
});

describe("fitToScreen", () => {
  it("enquadra o mundo no container, com margem, e centraliza", () => {
    const node = div({ width: 820, height: 620 });
    const { result } = renderHook(() => useMapCamera());
    act(() => { result.current.bindWheel(node); });
    act(() => result.current.fitToScreen({ w: 1000, h: 1000 }));
    // (820-80)/1000 = 0.74 ; (620-80)/1000 = 0.54 → o menor manda
    expect(result.current.scale).toBeCloseTo(0.54, 9);
    expect(result.current.pan.x).toBeCloseTo((820 - 540) / 2, 9);
    expect(result.current.pan.y).toBeCloseTo((620 - 540) / 2, 9);
  });

  it("aceita os limites do grafo (minX/minY/maxX/maxY)", () => {
    const { result } = renderHook(() => useMapCamera());
    act(() => result.current.fitToScreen(
      { minX: 100, minY: 100, maxX: 1100, maxY: 1100 },
      { viewport: { width: 820, height: 620 }, margem: 80 },
    ));
    expect(result.current.scale).toBeCloseTo(0.54, 9);
    // o canto do conteúdo (100,100) tem que cair dentro da tela
    const canto = result.current.worldToScreen(100, 100);
    expect(canto.x).toBeCloseTo((820 - 540) / 2, 9);
    expect(canto.y).toBeCloseTo((620 - 540) / 2, 9);
  });

  it("respeita o clamp de escala", () => {
    const { result } = renderHook(() => useMapCamera({ maxScale: 1.5 }));
    act(() => result.current.fitToScreen({ w: 10, h: 10 }, { viewport: { width: 800, height: 600 } }));
    expect(result.current.scale).toBe(1.5);
  });

  it("sem container medível, volta ao estado inicial em vez de gerar NaN", () => {
    const { result } = renderHook(() => useMapCamera({ initial: { pan: { x: 60, y: 60 }, scale: 1 } }));
    act(() => result.current.setScale(3));
    act(() => result.current.fitToScreen({ w: 1000, h: 1000 }));
    expect(result.current.scale).toBe(1);
    expect(result.current.pan).toEqual({ x: 60, y: 60 });
  });

  it("mundo inválido não mexe na câmera", () => {
    const { result } = renderHook(() => useMapCamera());
    act(() => result.current.setScale(2));
    act(() => result.current.fitToScreen(null, { viewport: { width: 800, height: 600 } }));
    expect(result.current.scale).toBe(2);
  });
});

describe("juntarHandlers", () => {
  it("chama todos os handlers do mesmo nome, na ordem", () => {
    const ordem = [];
    const j = juntarHandlers(
      { onPointerDown: () => ordem.push("a"), onPointerUp: () => ordem.push("u") },
      { onPointerDown: () => ordem.push("b") },
      null,
    );
    j.onPointerDown({});
    j.onPointerUp({});
    expect(ordem).toEqual(["a", "b", "u"]);
  });
});
