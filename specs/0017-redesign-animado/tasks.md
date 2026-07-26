---
name: tasks
description: Decomposição e gates do redesign animado. Puxe ao implementar (após aprovação do design.md).
alwaysApply: false
---

# Tasks — Redesign animado (gótico-arcano)

> Cada task mapeia AC(s) e tem gate executável. `[P]` = paralelizável.
> **Não iniciar antes do `design.md` aprovado** (tier arquitetural). Um commit por task.

## Plano — Onda 1 (CSS puro, sem custo)

| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)                                   | Status |
|----|-------------------------------------------------------------|----------|------------|--------------------------------------------------|--------|
| 1  | `src/themes/motion.js` — tokens + `staggerDelay` + testes   | AC-1/AC-7 | —          | `npm test -- motion`                             | **feito** (2026-07-08) |
| 2  | Bloco global de keyframes/utilitárias + `@media reduced-motion` no `<style>` de `G` | AC-1,5 | 1 | `npm run build` (verde)                          | **feito** (2026-07-08) |
| 3  | Reconciliar accent: `SYSTEMS` deriva de `getTheme` + teste  | AC-6     | —          | `npm test -- systems-accent`                     | **feito** (2026-07-08) |
| 4  | Login: stagger, underline no focus, shimmer, progress dots  | AC-2     | 2          | `npm run build` + checklist visual login         | **feito** (2026-07-09) |
| 5  | SystemSelect: stagger, hover glow por sistema, skeleton `[P]`| AC-3     | 2,3        | `npm run build` + checklist visual seleção        | **feito** (2026-07-09) |
| 6  | Dashboard: nav animada, tilt, crossfade, skeletons `[P]`    | AC-4     | 2,3        | `npm run build` + checklist visual dashboard      | **feito** — pílula deslizante no `Sidebar`; tilt 3D **vetado pelo Andre** |
| 7  | Guard JS do tilt/parallax por `matchMedia` reduced-motion   | AC-5     | 2,6        | checklist com "reduzir movimento" ligado          | **feito** (`prefersReducedMotion` + `useReducedMotion`) |
| 8  | Regressão: suíte completa + build verdes, telas fora de escopo intactas | todos | 4,5,6,7 | `npm test` + `npm run build`                | **feito** (20 suítes/152 testes + build exit 0) |
| 8b | Extrair a pílula p/ `hooks/useSlidingPill.js` (dedup Sidebar+bottom-nav) + re-medida por `ResizeObserver`/`fonts.ready` | AC-4 | 6 | `npm test -- useSlidingPill` | **feito** (2026-07-25) |

## Plano — Onda 2 (Higgsfield, GATED — não iniciar sem orçamento aprovado)

| #  | Task                                                        | Cobre AC | Depende de | Gate                                             | Status |
|----|-------------------------------------------------------------|----------|------------|--------------------------------------------------|--------|
| 9  | ADR da integração Higgsfield (decisão durável)              | —        | Onda 1     | ADR em `docs/architecture/adr/`                  | **PENDENTE** — a Onda 2 rodou sem ADR (último é o 0007/Tailwind) |
| 10 | `balance` + confirmar orçamento + conjunto mínimo (fog, emblema OP, loop névoa) | — | 9 | aprovação explícita do Andre por chamada | **feito** (~55,6 créditos gastos, 44,4 restantes) |
| 11 | Baixar → `public/assets/higgsfield/` → otimizar (`.webp`/`.webm`) + poster | — | 10 | assets versionados + fallback estático | **feito** (`manifest.json` com os job IDs) |
| 12 | Integrar assets nas telas (com reduced-motion + poster)     | AC-2,3   | 11         | checklist visual + Lighthouse sem regressão      | **feito, exceto** `audio/narracao-mestre.mp3` (falta decisão de UX de onde toca) |

## Plano de teste

- Unidade: `motion.js` (tokens presentes, `staggerDelay` monotônico/clamp); `systems-accent`
  (card accent === `getTheme(id).colors.accent`).
- Integração: `npm run build` verde a cada task de UI.
- Aceite: AC-1/6/7 por teste executável; AC-2/3/4/5 por checklist visual documentado
  (padrão do projeto p/ UI, como nas specs do mapa).

## Checklist visual (ACs de UI)

- [ ] Login: recursos em stagger · anel de runas desenha+respira · underline no focus ·
      shimmer do botão · progress dots
- [ ] Seleção: cards em stagger · hover eleva + glow na cor do sistema · seta desliza ·
      indisponível com skeleton
- [ ] Dashboard: nav ativa transiciona · ~~tilt no card~~ (vetado) · ONLINE respira · PRO shimmer ·
      skeletons · crossfade entre seções
- [ ] **Pílula (regressão da task 8b):** recolher/expandir a sidebar — a pílula acompanha a
      largura durante os 300ms da transição (antes ela congelava na largura antiga) · trocar de
      idioma mantém o alinhamento · girar o celular realinha a pílula da bottom-nav · recarregar
      com cache frio (Cinzel entrando depois) não deixa a pílula deslocada
- [ ] Reduced-motion ligado: parallax/tilt/loops OFF, só fades essenciais
- [ ] Nenhuma tela fora de escopo (fichas/mapa) regrediu

## Divergências (SPEC_DEVIATION)

- [ ] (registrar aqui se surgir)

## Checklist de Definition of Done (Onda 1)

- [ ] AC-1/6/7 verdes pelo gate executável (`npm test`)
- [ ] AC-2/3/4/5 verdes pelo checklist visual documentado
- [ ] `npm run build` verde · suíte existente sem regressão
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `docs/STATE.md` atualizado (próximo passo / decisões)
- [ ] Q1 (accent OP) resolvida antes da task 3
