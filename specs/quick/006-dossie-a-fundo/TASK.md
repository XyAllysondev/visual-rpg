---
name: quick-task-006-dossie-a-fundo
description: Quick task 006 — o dossiê levado ao fim: folha de rosto do processo, foto presa, censura, grade datilografada. Segunda passada de apresentação sobre a spec 0035.
alwaysApply: false
---

# Quick Task — 006-dossie-a-fundo

**Data:** 2026-08-08 · **Pedido:** Andre — *"ainda não me surpreendi com o resultado […] força
total, melhore o visual desse site de rpg"*, dito DEPOIS de ver a 0035 na tela.
**Tier:** trivial→pequeno (2 arquivos de código, apresentação pura, nenhuma regra de jogo).

## Diagnóstico honesto

A 0035 entregou o material certo com a intensidade errada. Fibra a 5%, um vinco e uma linha
de timbre são *tecnicamente* um dossiê, mas não CONTAM a história de um. O que faz um olho
humano acreditar num documento não é a textura — é o aparato burocrático em volta dela:
a folha de rosto com o processo grande, a foto 3×4 presa por cantos, o campo censurado,
a régua da tabela datilografada. É isso que esta quick adiciona. **Nada de novo mecanismo:**
tudo entra pelos mesmos dois canais da 0035 (camada CSS por seletor + JSX pontual).

## Escopo (vinculante)

- **Folha de rosto do processo** no topo da coluna esquerda: furos de arquivo (vazados até a
  mesa), linha da agência, `PROC. OP-NNNN-L/AA` grande (derivado do id — regra AC-3 da 0035,
  sem id o bloco some), tarja CONFIDENCIAL com listras de segurança, "ABERTO EM" saindo de
  `character.createdAt` (dado REAL, já exibido na listagem; sem o campo, a linha some),
  UMA linha censurada ("OPERAÇÃO ███") como ornamento `aria-hidden`, rodapé "FL. 01 · RUBRICA ___".
- **Foto 3×4**: cantos de álbum pretos nos 4 cantos; com avatar, moldura fina em `--text`
  (papel fotográfico é mais claro que o papel do dossiê — contraste ali é intenção); sem
  avatar, área demarcada tracejada "FOTOGRAFIA NÃO ANEXADA · ANEXO I".
- **Grade datilografada nas perícias**: réguas verticais finas entre as colunas numéricas e
  sublinhado duplo no cabeçalho — só CSS, por seletor, zero JSX na tabela.
- **Marca d'água** "ORDEM PARANORMAL" atrás do painel de perícias, ametista a 4%.
- **Sombra de papel** em todos os `.op-ink` (profundidade da folha sobre a mesa).
- **Censura reusável** `.dos-censura` — fecha o resto do T6 da 0035 (a tarja que faltava).

## Fora de escopo

O RESTO do site (Painel, seleção, mapas, D&D/Tormenta): a 0035 fixou "só a ficha primeiro"
e o pedido de agora foi feito olhando a ficha. Se o Andre quiser a onda no app inteiro,
é a próxima quick — com ele escolhendo as telas.

## Regras herdadas (da 0035, valem aqui)

- Nenhum literal de identidade no CSS novo — só token. Preto/branco de luz são a exceção.
- Nenhum número/data que pareça dado sem ser (processo ← id; data ← createdAt; sem o dado,
  o campo NÃO aparece). Censura e rubrica não afirmam dado nenhum — afirmam ausência.
- Contraste: texto 4,5:1 · gráfico informativo 3:1 · ornamento puro é livre e `aria-hidden`.
- `prefers-reduced-motion`: nada disto anima, paridade é automática.

## Gate

```
node scripts/checar-templates-css.mjs
CI=true npx react-scripts test --watchAll=false --maxWorkers=2
```
E o T8 da 0035 virou lei: **olhar a tela** (driver headless + navegador do Andre) antes de dar por pronto.

## Estado

| Passo | Estado |
|---|---|
| Folha de rosto (CSS + JSX) | ☑ |
| Foto 3×4 (cantos, moldura, vazio) | ☑ |
| Grade datilografada + marca d'água | ☑ |
| Sombra de papel + censura | ☑ |
| Gates + tela | ☑ crase ✓ · tela conferida (2 rodadas de screenshot) · suíte na nota abaixo |

## O que a tela pegou (de novo)

Duas rodadas de screenshot, dois defeitos que nenhum gate pegaria:

1. **A linha da agência truncava** — "DEPTO. DE …" com reticências na coluna de 280px (e pior
   na de 248px). Timbre não trunca. Texto encurtado ("Ordem Paranormal — Operações") e
   tracking de 0.26em → 0.18em.
2. **Processo + CONFIDENCIAL duplicados na mesma dobra** — o sticky header e a folha de rosto
   mostravam os dois a ~60px de distância. Documento repete carimbo por FOLHA, não duas vezes
   na mesma vista. O sticky voltou a ser só a sobrancelha; a folha de rosto é o timbre.
   (O AC-3 da 0035 segue satisfeito: o número continua derivando do id, agora na folha de
   rosto — e os 9 testes de `dossie.test.js` não dependem de onde ele é montado.)

**Decisão de hover embutida:** o `onMouseLeave` do retrato setava `boxShadow:"none"`, o que
matava para sempre a sombra de papel nova no primeiro mouseout. Agora seta `""` (string
vazia devolve o CSS).
