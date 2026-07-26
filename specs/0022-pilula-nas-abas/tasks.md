---
name: tasks
description: Decomposição e gates da pílula deslizante nas barras de abas. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Pílula deslizante nas barras de abas

> Cada task mapeia AC(s) e tem gate executável. `[P]` = paralelizável.

| # | Task | Cobre AC | Depende de | Gate | Status |
|---|------|----------|------------|------|--------|
| 1 | `src/components/SlidingTabPill.jsx` — realce apresentacional (accent/fundo/raio/sublinhado) + teste | AC-5 | — | `npm test -- SlidingTabPill` | **feito** (6 testes) |
| 2 | Migrar as 2 navs da 0017 (`Sidebar`, `MobileBottomNav`) para o componente | AC-5 | 1 | `npm run build` | **feito** |
| 3 | Abas da ficha OP (`.op-tabs-row`) `[P]` | AC-1,2,3,4 | 1 | `npm run build` + checklist visual | **feito** |
| 4 | Secnav mobile do OP (`.op-mobile-secnav`) `[P]` | AC-1,3 | 1 | `npm run build` + checklist visual | **feito** |
| 5 | Abas da ficha D&D (`.dnd-tabs`) `[P]` | AC-1,2,3 | 1 | `npm run build` + checklist visual | **feito** |
| 6 | Abas do modal de Ajustes `[P]` | AC-1,3 | 1 | `npm run build` + checklist visual | **feito** (novo `SettingsTabs` em App.jsx) |
| 7 | Regressão: suíte completa + build verdes | todos | 2–6 | `npm test` + `npm run build` | **feito** (21 suítes/158 testes, build exit 0) |

## Plano de teste

- **Unidade:** `SlidingTabPill` (não renderiza sem `pill`; aplica transform/tamanho; é
  `aria-hidden`; sublinhado só quando pedido). `useSlidingPill` já coberto pela 0017.
- **Integração:** `npm run build` verde a cada task.
- **Aceite:** AC-5 por gate executável; AC-1/2/3/4 por checklist visual documentado abaixo
  (padrão do projeto para UI).

## Checklist visual (ACs de UI)

- [ ] Ficha OP: trocar Combate→Habilidades→Rituais→Inventário→Descrição — o realce **desliza**
- [ ] Ficha OP em tela estreita: rolar a barra de abas — o realce rola junto, colado na aba ativa
- [ ] Secnav mobile do OP (Ficha | Perícias | Ações): sublinhado desliza
- [ ] Ficha D&D: idem nas 6 abas, com a linha dourada superior acompanhando
- [ ] Modal de Ajustes: Ficha | Stream | Idioma — sublinhado roxo desliza
- [ ] Reduced-motion ligado: sem deslize, aba ativa continua óbvia
- [ ] Leitor de tela / DOM: `role="tab"`/`aria-selected` intactos, realce `aria-hidden`

## Divergências (SPEC_DEVIATION)

- [ ] (registrar aqui se surgir)

## Definition of Done

- [ ] AC-5 verde pelo gate executável
- [ ] AC-1/2/3/4 verdes pelo checklist visual do Andre
- [ ] `npm test` + `npm run build` verdes, sem regressão nas suítes existentes
- [ ] `docs/STATE.md` atualizado
