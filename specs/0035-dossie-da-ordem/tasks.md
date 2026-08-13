---
name: 0035-tasks
description: Passos atômicos da 0035 (dossiê da Ordem) e o gate executável de cada um.
alwaysApply: false
---

# 0035 — Tarefas

**Gate executável (roda antes de fechar qualquer tarefa):**

```
node scripts/checar-templates-css.mjs
CI=true npx react-scripts test --watchAll=false --maxWorkers=2
```

> O `--maxWorkers=2` não é gosto: no paralelismo padrão os testes do WorldMap e do Painel
> falham por TIMEOUT sob carga, não por defeito. Ver STATE.

| # | Tarefa | AC | Estado |
|---|---|---|---|
| T1 | Módulo `dossie.jsx`: material de papel (fibra com direção, borda gasta, vinco, mancha) aplicado por SELETOR sobre `.op-ink` | AC-1 | ☑ |
| T2 | Gramática de formulário: `.dos-campo` (rótulo · pontilhado · valor), versalete, algarismo tabular | AC-2 | ☑ |
| T3 | Timbre: cabeçalho do dossiê com nº de processo derivado do `id` da ficha + classificação | AC-3 | ☑ |
| T4 | Datilografia reusando `Courier Prime` já importada — sem `family=` novo | AC-4 | ☑ |
| T5 | Varrer os 34 literais da paleta velha em `ordemStyles.jsx` → tokens | AC-5 | ☑ |
| T6 | Carimbo e tarja de censura como ornamento reusável | AC-1 | ◐ carimbo feito; tarja de censura NÃO |
| T7 | Conferir AA no papel e a paridade de movimento reduzido | AC-6, AC-7 | ☑ |
| T8 | Verificar no navegador (pacote servido, não dev server) e refazer o pacote de teste | todos | ◐ conferido no NAVEGADOR (dev server + headless Chrome, 2026-08-08); falta conferir o pacote SERVIDO |

**O que a tela pegou que os gates não pegaram (T8, 2026-08-08):** o vinco. A faixa de 3% de
largura com sombra a 0,34 lia como LINHA vertical clara cortando o painel — artefato de
render, não dobra. Virou gradiente largo (34%→68%) com sombra rasa em dois degraus (0,10 →
0,22) e fio de luz a 0,035. É exatamente o tipo de defeito que motiva o T8: passa em todo
teste e fica errado na tela. Conferido também: timbre com processo derivado do id
(`N.º 5521-A/49` na ficha demo), carimbo, pontilhado no `--muted` novo, fibra a 0.055,
`tabular-nums` computado nos valores — e zero erros de console.

**Gate rodado em 2026-08-08:** `checar-templates-css.mjs` ✓ · suíte **2146 verdes**
(2137 + 9 novos em `__tests__/dossie.test.js`) + a falha herdada do `creature.test.js`.

## O que a verificação adversarial pegou (2026-08-08)

Rodada de 28 agentes contra os ACs. Três ACs voltaram **reprovados** e foram consertados —
vale registrar porque os três defeitos eram invisíveis a olho nu:

1. **AC-6 · o pontilhado reprovava.** `--dos-guia` saía de `var(--border2)`, que composto
   sobre o card mede **2,12:1** — abaixo do piso de 3:1 que o próprio AC exige de régua e
   pontilhado que carregam informação. Passou a `var(--muted)` (**5,76:1**). A vinheta do
   `::after` também baixou de 0,30 para 0,18: ela pinta POR CIMA do texto, então cada ponto
   de escurecimento saía do contraste medido.
2. **AC-2 · o `tabular-nums` não alcançava número nenhum.** As duas instâncias de `<Field>`
   renderizam TEXTO (jogador e proteção). A cláusula de propósito do AC — "colunas de números
   alinham na vertical" — não era exercida em lugar nenhum. Agora o algarismo tabular é
   aplicado por seletor sobre `.op-skill`, `.op-attr-val`, `.op-data` e `.op-dial-num`, que é
   onde há coluna de número de verdade.
3. **AC-7 · `.op-stagger` não era neutralizado.** Sob `prefers-reduced-motion` os blocos da
   folha ainda entravam em cascata por ~0,46 s.

E dois literais da paleta velha **sobreviveram à varredura do T5 por estarem em decimal**:
`rgba(232,228,217,0.3)` (é o `#e8e4d9`) e `rgba(214,184,74,0.12)`. A varredura original só
procurou hex. Ambos tokenizados.

## Fica em aberto (não bloqueia o merge, mas não some sozinho)

- **A tarja de censura do T6 não foi feita** — só o carimbo.
- **T8 não foi conferido no navegador.** O pacote foi refeito, mas ninguém OLHOU a tela.
  Material, vinco e carimbo são exatamente o tipo de coisa que passa no teste e fica feia.
- **92 ocorrências da paleta velha em 16 outros arquivos do OP** (`OrdemParanormalSheet.jsx`,
  `Tabs/`, `VitalSign.jsx`…). Fora do AC-5, que fala só de `ordemStyles.jsx` — mas é a mesma
  dívida, e agora está medida.
- **`.dos-campo-entrada` é sobrescrito por `heraldica` com `!important`** — o campo em modo
  edição não é a régua descrita na spec.
- **O versalete sai sintetizado:** `Cinzel` é família caps-only e não expõe a feature `smcp`.
- **AC-2 alcança 5 pares de ~30.** `<Field>` (2) + `Readout` (3). Os candidatos restantes
  estão listados no relatório: Defesa, Bloqueio, Esquiva, Resistências, Proficiências, NEX,
  Afinidade e os rótulos do `VitalSign`. `Stat` e `LabeledMini` parecem candidatos mas são
  **código morto** — converter não muda um pixel.

**Dependência real:** T5 antes de T1 dar por fechado. Aplicar material novo por cima de 34
literais da paleta velha produz uma tela que briga consigo mesma — foi exatamente o defeito
que a repaginação 004 deixou passar e a 005 teve de consertar.

**SPEC_DEVIATION:** nenhuma até agora.
