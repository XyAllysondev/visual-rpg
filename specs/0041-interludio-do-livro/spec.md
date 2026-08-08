---
name: spec-0041-interludio-do-livro
description: Spec 0041 — a cena de Interlúdio com os valores reais do livro, e a correção de duas regras que a spec 0040 subiu erradas (uma ação em vez de duas; seis ações em vez de sete). Puxe ao mexer em interludio.js, InterludioTab ou na seção interludio do regras-oficiais.json.
alwaysApply: false
---

# Spec 0041 — O interlúdio do livro

> **Fonte da verdade.** Status: **entregue** (implementação em `1e14ac6`, spec escrita depois — ver
> a nota de processo no fim).
> Origem: o Andre autorizou transcrever a tabela de recuperação do livro oficial (PDF v1.4,
> `Desktop/Livros ordem paranormal`), que a spec 0040 havia declarado fora de escopo.

## O que a transcrição revelou

A 0040 entregou o Interlúdio assumindo que `regras-oficiais.json` era a fonte completa e que só os
**valores numéricos** faltavam. Ao abrir o livro, **duas regras estavam erradas — e já em
produção**:

1. **A 0040 travava UMA ação por interlúdio.** O livro diz, literalmente: *"um personagem pode
   fazer até **DUAS** das ações a seguir"*. O AC-5 da 0040 codificou o oposto do texto.
2. **Faltava uma ação inteira e uma tinha o nome errado.** A transcrição da spec 0026 lista seis;
   o livro tem **sete**. Faltava **Exercitar-se**, e o que estava como "Consertar" chama-se
   **Manutenção**.

**A causa raiz, que é a lição desta spec:** as entradas do JSON diziam `(Resumo — valores no
livro.)`. Eu leio isso como *"falta um número"* e segui. O que aquilo de fato significava era *"esta
regra está resumida"* — e o resumo tinha omitido o número de ações permitidas.

> **Regra que passa a valer:** `(Resumo — …)` num arquivo de conteúdo é aviso de que a **regra
> inteira** precisa ser conferida na fonte antes de virar comportamento, não só de que falta um
> valor. Nenhuma mecânica nova deve ser derivada de uma entrada marcada como resumo.

## E os valores eram calculáveis desde sempre

O livro: dormir recupera PV e PE iguais ao **limite de PE por rodada**, multiplicado pela condição
do descanso. O nosso `deriveStats().peTurno` **já é esse limite** — o exemplo do livro (NEX 35% →
limite 7 → recupera 7 PV e 7 PE) confere exatamente com `1 + nexLevel(35)` = 7.

Ou seja: **a 0040 pediu ao jogador um número que a ficha já sabia calcular.** Não era falta de dado,
era falta de ter lido a fonte.

## Critérios de aceite

### AC-1: Até duas ações por interlúdio
- **Dado** a sub-aba Interlúdio
- **Quando** o jogador escolhe ações
- **Então** cabem **duas**, e a terceira é recusada com o motivo vindo da regra
- **E** clicar numa ação já escolhida a desmarca, liberando a vaga
- **E** o contador mostra `N de 2`

### AC-2: As sete ações do livro, e só elas
- **Dado** `ACOES_INTERLUDIO`
- **Quando** a lista é lida
- **Então** são sete: Dormir, Relaxar, Alimentar-se, Exercitar-se, Ler, Revisar o Caso, Manutenção
- **E** nome e descrição vêm de `regras-oficiais.json`, comparados **caractere a caractere** por teste
- **E** a entrada da cena (`interludio-geral`) não é escolhível

### AC-3: Repetição só onde o livro permite
- **Dado** uma ação já escolhida
- **Quando** o jogador tenta escolhê-la de novo
- **Então** só **Revisar o Caso** aceita — o livro diz isso dela, e só dela
- **E** Dormir, Relaxar e Alimentar-se recusam ("uma vez por interlúdio")

### AC-4: A recuperação é calculada, não digitada
- **Dado** um agente cujo limite de PE por rodada é 7
- **Quando** ele dorme em condição normal
- **Então** recupera 7 PV e 7 PE — o exemplo literal do livro
- **E** relaxar recupera Sanidade com a mesma base, e não PV nem PE
- **E** as ações sem recuperação (Ler, Exercitar-se, Manutenção, Revisar) recuperam zero

### AC-5: A escada de condições, na ordem que faz o exemplo do livro fechar
- **Dado** as quatro condições
- **Quando** o multiplicador é aplicado
- **Então** precária vale metade, normal uma vez, confortável dobra e luxuosa triplica
- **E** o prato nutritivo/energético **sobe um degrau** nessa escada (confortável → triplicada, que é
  o exemplo do livro), sem passar do topo
- **E** condição desconhecida cai em normal, o padrão do livro

### AC-6: Os quatro pratos
- **Dado** a ação Alimentar-se escolhida
- **Quando** um prato é escolhido
- **Então** favorito dá +2 Sanidade a quem relaxa; nutritivo sobe um degrau no PV ao dormir;
  energético sobe um degrau no PE ao dormir; rápido registra +5 no teste de revisar o caso
- **E** o prato é ignorado se a ação Alimentar-se não foi escolhida

### AC-7: O bônus coletivo de relaxar
- **Dado** que N personagens relaxaram no mesmo interlúdio
- **Quando** a Sanidade é calculada
- **Então** entra +1 por personagem que relaxou, contando o próprio
- **E** o padrão é 1, não 0

### AC-8: O clamp continua sendo a regra
- **Dado** PV 19/20 e uma recuperação calculada de 3
- **Quando** o interlúdio é aplicado
- **Então** o PV vai a 20 e o registro guarda **1**, o efetivamente recuperado
- **E** sem máximo conhecido não se recupera nada

### AC-9: A prévia não pode mentir
- **Dado** a mesma escolha
- **Quando** a interface pré-visualiza e depois aplica
- **Então** os dois números saem da **mesma** função
- **E** existe teste que reprova se divergirem

### AC-10: Registro antigo não desaparece
- **Dado** um interlúdio gravado pela spec 0040, no formato `acao` singular
- **Quando** o histórico é renderizado
- **Então** ele aparece, convertido
- **E** isso importa porque **esses registros estão em produção** — sumir com eles seria o jogador
  perder o próprio histórico num deploy

### AC-11: Nada do PDF além de regra parafraseada
- **Dado** o texto extraído do PDF, que carrega marca d'água com nome e e-mail do comprador
- **Quando** o repo é varrido
- **Então** nenhum dado pessoal do PDF aparece em arquivo nenhum
- **E** as descrições são paráfrases, não transcrição literal

## Decisão que NÃO é regra do livro

A condição precária vale **"metade"**, e meio ponto de PV não existe. **Arredondo para baixo.** O
livro que temos não diz o sentido, e para cima seria mais generoso do que o texto autoriza.
**Pendente de decisão do Andre** — é ajuste de uma linha em `recuperacaoBase`, mas é decisão de
produto, não efeito colateral de implementação.

## Fora de escopo

- **Aplicar os bônus de Exercitar-se e Ler** (+1d6 em testes até o fim da missão, acumuláveis até
  Vigor/Intelecto). Exige um registro de bônus pendentes que o motor de rolagem consuma — feature
  própria, e toca a banca de modificadores da spec 0037.
- **O teste de Revisar o Caso** (perícia, DT das regras de investigação, pista complementar). Exige
  ligar interlúdio a cena de investigação — acoplamento novo.
- **Manutenção devolvendo PV a um item.** Depende de item ter PV no nosso inventário.

## Nota de processo (o que deu errado aqui)

**Esta spec foi escrita DEPOIS da implementação**, o que o `CLAUDE.md` não autoriza — e o efeito foi
concreto: `interludio.js`, `InterludioTab.jsx`, `OrdemParanormalSheet.jsx` e a suíte de testes
citavam "spec 0041" enquanto `specs/` só tinha até a 0040. Sete referências órfãs, apontando para um
documento que não existia, com o código já em produção.

Registrado aqui em vez de silenciosamente corrigido porque a 0040 e a 0041 juntas mostram o padrão:
**pular o gate da spec foi exatamente o que deixou as duas regras erradas passarem.** A spec é onde
"o livro diz uma ação ou duas?" teria sido uma pergunta escrita, e não uma suposição.
