/* Helpers puros do Editor de Mapas (spec 0019) — sem React, sem DOM, testáveis.
 * Extraídos para corrigir bugs de snap, empilhamento e vazamento de imagens. */

/* `cellCenterSnap` viveu aqui até o grid.js virar a fonte única da geometria de grade.
 * Use `cellCenter(scene, x, y)` do grid.js: ele respeita o offset de alinhamento e o tipo
 * de grid (hex incluso), coisas que a versão só-por-gridSize não sabia fazer. */

/** zIndex de render: a ordem da camada domina; o `z` do elemento desempata dentro dela.
 *  Assim "trazer para frente/enviar para trás" tem efeito mesmo entre tipos diferentes,
 *  e a ordem das camadas é sempre respeitada (spec 0019 AC-3). */
export function layerZIndex(layerIdx, z = 0) {
  const li = Number.isFinite(layerIdx) ? Math.max(0, Math.floor(layerIdx)) : 0;
  const zz = Number.isFinite(z) ? z : 0;
  // z fica numa janela de ±50000 para não invadir a camada vizinha.
  const clamped = Math.max(-49999, Math.min(49999, zz));
  return li * 100000 + 50000 + clamped;
}

/* ── Pilha de render do canvas ──
 * Todo o conteúdo do canvas é filho absoluto do MESMO container transformado, ou seja um único
 * contexto de empilhamento: os z-index competem direto. Grade, névoa e overlays precisam ser
 * DERIVADOS de `layerZIndex`, nunca fixos.
 *
 * Estavam fixos (grade 6, névoa 200, pings 300) e o efeito era um bug sério: a névoa ficava
 * abaixo de todo token, então um inimigo em sala coberta aparecia para o jogador — a névoa só
 * escondia o mapa. A grade em 6 ficava sob a própria imagem do mapa. */

/** Grade: no topo da camada Mapa (idx 0) e abaixo da camada Desenho (idx 1). */
export const gridZIndex = () => layerZIndex(0, 49999) + 1;

/** Névoa: acima de TODAS as camadas de elementos. `layerCount` = quantas camadas a cena tem. */
export const fogZIndex = (layerCount) => layerZIndex(Math.max(1, Number(layerCount) || 1), 0);

/** Régua, pings, apontador, draft de névoa e editor de texto: acima da névoa. */
export const overlayZIndex = (layerCount) => fogZIndex(layerCount) + 1000;

/** IDs de imagem em `imageStore` que nenhum elemento (nem id de cena legado) referencia mais.
 *  Usado para varrer órfãos e não estourar a quota do localStorage (spec 0019 AC-11). */
export function collectOrphanImageIds(scenes, imageStore) {
  const used = new Set();
  for (const sc of scenes || []) {
    if (sc && sc.id) used.add(sc.id); // fundo legado por id de cena
    for (const el of (sc && sc.elements) || []) {
      if (el && el.imageId) used.add(el.imageId);
    }
  }
  return Object.keys(imageStore || {}).filter((id) => !used.has(id));
}
