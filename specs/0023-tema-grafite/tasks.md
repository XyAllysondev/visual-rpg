---
name: tasks
description: Fatias, gates e checklist visual do tema grafite. Puxe ao implementar a 0023.
alwaysApply: false
---

# Tasks — Tema grafite

> Uma fatia por commit. Cada fatia deixa o app coerente e testável sozinha.

| # | Fatia | Cobre AC | Gate | Status |
|---|-------|----------|------|--------|
| 1 | Escala nova nos 3 temas + `--muted` + `:root` do `G` + `Shell` (registry em todas as telas) + `index.html`/`manifest.json` | AC-1,2,3 | `npm test` + `npm run build` | **feito** |
| 2 | Teste `surfaces-ladder.test.js` (completude · monotonicidade · coerência ±1 L\* · AA 4,5:1) | AC-1,2,3 | `npm test -- surfaces-ladder` | **feito** (12 asserções) |
| 3 | Modais e chrome global (`modalStyles`, topbar, bottom-nav, modal de Ajustes, selects, `<option>`) | AC-4 | build + checklist visual | **feito** |
| 4 | Ficha OP (`--el-deep`/`--el-bg`, `.op-ink`, sombras, `elementos.jsx`) | AC-4,5 | build + checklist visual | **feito** (+ piso do `op-el-fade` subiu de `#000`) |
| 5 | Ficha D&D (`--ink`/`--stone`, gradiente `.dnd-bg`, banner) | AC-4 | build + checklist visual | **feito** |
| 6 | Editor de mapas (literais +~8 L\*) | AC-4 | build + checklist visual | **feito** (19 literais) |
| 7 | Sombras (×0,7) e hovers brancos dos helpers compartilhados | AC-5 | build + checklist visual | **feito** (33 sombras em App.jsx + 6 no OP) |
| 8 | Regressão final | AC-6 | `npm test` + `npm run build` | **feito** (23 suítes/216 testes, build exit 0) |

## Regra de decisão (aplicar em todas as fatias)

> **Esse hex preenche uma superfície que contém outro conteúdo?**

- **SIM → token**, escolhido pela *elevação*: página=`--bg` · chrome fixo/painel nível 1=`--surface` ·
  card/textarea=`--card` · modal/dropdown/input/popover=`--card2`.
- **NÃO → não troca** (traço, divisor, ícone, badge, gradiente de acento). Só clareia o literal se
  ficaria a menos de ~4 L\* do fundo novo.
- **Cor com significado** nunca vira token — recalcula preservando matiz e saturação.
- **`<option>`**: hex literal (compositor nativo do SO ignora `var()` herdado de forma confiável).

## Checklist visual (ACs de UI)

- [ ] Painel: fundo grafite, cards visivelmente destacados do fundo
- [ ] Login e seleção de sistema com o **mesmo** fundo do painel (sem degrau ao entrar)
- [ ] Primeiro carregamento não pisca preto antes de clarear
- [ ] Modal de Ajustes e modais das abas OP na nova escala (não mais cinza genérico `#111`)
- [ ] Ficha OP: cards legíveis, sem a mancha escura do `inset shadow`; trocar de elemento não pisca preto
- [ ] Ficha D&D e editor de mapas coerentes com o resto
- [ ] Textos pequenos (labels 9-11px) continuam legíveis
- [ ] Trocar de sistema (OP → D&D → Tormenta) mantém a mesma sensação de luminosidade

## Divergências (SPEC_DEVIATION)

- [ ] (registrar aqui se surgir)

## Definition of Done

- [ ] AC-1/2/3/6 verdes pelos gates executáveis
- [ ] AC-4/5 verdes pelo checklist visual do Andre
- [ ] `docs/STATE.md` atualizado
- [ ] Gap documentado: accent de D&D/Tormenta como cor de texto (< 3:1) fica para spec própria
