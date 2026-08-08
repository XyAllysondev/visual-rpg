---
name: tasks-0041-interludio-do-livro
description: Tasks da spec 0041. Puxe junto com a spec 0041 ao mexer em interludio.js, InterludioTab ou na seção interludio do regras-oficiais.json.
alwaysApply: false
---

# Tasks — Spec 0041 (O interlúdio do livro)

**Gate executável:**
```
npm test -- --runInBand
CI=true npm run build
```
Partida: 113 suítes / 2.666 testes (fim da spec 0040).
Chegada: **113 suítes / 2.694 testes**, build limpo. Implementado em `1e14ac6`.

Suíte desta spec: `src/components/systems/OrdemParanormal/__tests__/investigacao-interludio.test.js`
(a mesma da 0040 — a 0041 corrige regras dela, não abre feature nova)

---

## T1 · Transcrever a fonte — `regras-oficiais.json` ✔
Sete ações no lugar de seis (**Exercitar-se** entrou; **Consertar** virou **Manutenção**), e os
`(Resumo — valores no livro.)` deram lugar aos valores parafraseados. A entrada da cena passou a
dizer **"até DUAS ações"**, que é o texto do livro.
> ⚠ Nada da marca d'água do PDF (nome e e-mail do comprador) entra no repo. Paráfrase, nunca
> transcrição literal.
**AC:** 2, 5, 6, 11.

## T2 · `interludio.js` — a conta ✔
- `CONDICOES_DESCANSO` na ordem que faz o exemplo do livro fechar (precária ½ · normal ×1 ·
  confortável ×2 · luxuosa ×3). **A ordem é funcional, não cosmética:** o prato nutritivo/energético
  "sobe um degrau" e o exemplo literal (confortável → triplicada) só fecha nessa escada.
- `PRATOS` com os quatro efeitos condicionais.
- `MAX_ACOES = 2` e `podeAdicionarAcao`, com `REPETIVEL` contendo **só** Revisar o Caso.
- `recuperacaoBase(peTurno, condicao)` — a base é o **limite de PE por rodada**, que
  `deriveStats().peTurno` já produz. Conferido contra o exemplo do livro: NEX 35% → 7.
- `calcularRecuperacao` separada de `aplicarInterludio` para a tela poder pré-visualizar **pela
  mesma função** (AC-9).
- `historicoDeInterludios` converte o formato `acao` singular da 0040 — esses registros estão em
  **produção** (AC-10).
**AC:** 1, 3, 4, 5, 6, 7, 8, 9, 10.

## T3 · `InterludioTab.jsx` — multi-seleção e prévia ✔
Contador `N de 2`, recusa da terceira com o motivo da regra, condição de descanso só quando
dormir/relaxar, refeição só quando alimentar-se, e o bloco "O que isto recupera" mostrando a conta
antes de confirmar.
**AC:** 1, 3, 5, 6, 7.

## T4 · A ficha passa o `peTurno` ✔
`OrdemParanormalSheet` inclui `peTurno: peTurno + pdBonus` em `vitais`. O `pdBonus` entra porque é o
ajuste que o próprio jogador fez no limite de PE por rodada, e é esse limite que o livro usa.
**AC:** 4.

## T5 · Gate + STATE ✔

## T6 · Spec e tasks retroativas ✔ — **dívida de processo, não feature**
As sete referências órfãs a "spec 0041" (em `interludio.js`, `InterludioTab.jsx`,
`OrdemParanormalSheet.jsx`, a suíte e o `STATE.md`) apontavam para um documento que não existia,
com o código já em produção. Fechado aqui.

---

## A lição que vale mais que as tasks

**`(Resumo — …)` num arquivo de conteúdo é aviso de que a REGRA INTEIRA precisa ser conferida na
fonte, não só de que falta um número.**

A 0040 leu aquele marcador como "os valores faltam", derivou mecânica do resumo e subiu **duas regras
erradas** para produção — uma ação em vez de duas, e seis ações em vez de sete. O gate de teste não
pegou porque os testes travavam fielmente a regra errada.

Corolário: **teste que trava uma regra não a valida.** Ele congela a interpretação de quem escreveu.
Só a fonte valida — e o oráculo desta spec passou a ser o exemplo numérico do livro (NEX 35% → 7),
que é verificável contra o nosso código.
