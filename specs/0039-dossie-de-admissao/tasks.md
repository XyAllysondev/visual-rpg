---
name: tasks-0039-dossie-de-admissao
description: Tasks da spec 0039. Puxe junto com a spec 0039 ao mexer no CharacterCreator, no StepBar ou no DocPanel.
alwaysApply: false
---

# Tasks — Spec 0039 (O dossiê de admissão)

**Gate executável:**
```
npm test -- --runInBand
CI=true npm run build
```
Partida: 111 suítes / 2.598 testes (fim da spec 0038).
Chegada: **112 suítes / 2.619 testes**, build limpo.

Suíte desta spec: `src/features/ficha/__tests__/dossie-de-admissao.test.js`

---

## T1 · `numeroDeDossie` — `domain/character.js` ✔
Hash FNV-1a de 32 bits do nome → `NNNNNN/NNN`. **Determinístico por contrato**: documento cujo
número muda a cada render não é documento. Nome vazio → `""`, e o cabeçalho desenha o traçado de
"ainda não emitido" em vez de inventar dígitos. A série nunca começa em 0 (`h % 900000 + 100000`),
senão `000123/456` não leria como registro.
**AC:** 2, 3.

## T2 · `DocPanel` — a moldura ✔
`features/ficha/DocPanel.jsx`, novo. Cabeçalho de emissão (`ORDO REALITAS` em Cinzel + número e
natureza em IBM Plex Mono) + filete dourado + corpo.
> **⚠ MOLDURA, NÃO CENÁRIO.** Nenhuma textura de papel, nenhuma mesa de madeira, nenhuma fonte
> nova. Só `--card`, `op-grain`, `--border2` e as fontes que o tema já carrega. Cenário ilustrado é
> o que faz a tela parecer arte gerada em vez de documento.
O traçado de "não emitido" tem **exatamente** 10 caracteres, a largura de `000000/000`, para o
cabeçalho não pular quando o nome chegar.
**AC:** 1, 3.

## T3 · `StepBar` na gramática do app ✔
Reescrito sobre `useSlidingPill` + `SlidingTabPill` — era a única barra do Nexus fora dessa
gramática. Passa a exportar `PASSOS` (cinco). Cumprido/atual/pendente por **marca** (`✓` / número
em destaque / número apagado), não só por matiz, e o estado vai no `aria-label`.
Clique só volta para passo **cumprido** — pular para frente contornaria o `canNext`.
**AC:** 4.

## T4 · Passo de Admissão ✔
Novo primeiro passo: termo de admissão da Ordo Realitas com as cinco obrigações do agente.
**Texto autoral** — nada transcrito da referência. Os índices dos passos existentes deslocaram em
+1 e o `canNext` ganhou a entrada `true` na frente.
**AC:** 5, 6.

## T5 · O botão de finalizar duplicado ✔ — **defeito da spec 0038**
A 0038 afirmou que a assinatura era o único caminho de finalização e removeu o `Finalizar Ficha`
do topo do passo. **Havia um segundo botão**, `Criar Agente ✦`, na barra de navegação inferior — e
o teste de lá passou porque procurava pelo rótulo do primeiro. Removido; no último passo a barra
agora só diz "Assine ao pé do documento". O teste novo assere a ausência dos **dois** rótulos em
**todos** os passos.
**AC:** 6.

## T6 · Gate + STATE ✔

---

## Lição que vale mais que as tasks
**Teste de ausência precisa enumerar todos os rótulos possíveis, não um.** `queryByText("Finalizar
Ficha")` provou que *aquele* botão sumiu, não que *o caminho* era único — e o AC dizia "único".
Quando o AC fala de unicidade, a asserção tem de varrer os estados (aqui: os cinco passos) e todos
os nomes que a ação já teve.
