---
name: spec-0033
description: Contrato do motor de progressão automática de Ordem Paranormal (NEX, marcos, pendências). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec 0033 — Progressão automática de Ordem Paranormal

> **Fonte da verdade.** Status: implementado
> Fonte primária: livro de regras oficial (v1.2, mai/2023), fora do repo — tabelas 1.2 a 1.5
> (pgs. 23, 25, 29, 33), características de classe (pgs. 24, 28, 32), origens (pgs. 19-21) e
> afinidade (pg. 116). Todo texto é **parafraseado** (spec 0003, conformidade de licença).

## Resumo
Ao subir de NEX, o sistema aplica sozinho tudo que o livro determina (PV/PE/SAN máximos, limite de
PE por turno, círculo de ritual, DT, habilidades de classe e de trilha, poderes de origem que
escalam) e pergunta ao jogador **apenas** o que o livro manda ele escolher — com as opções
inválidas já bloqueadas e o motivo à mostra.

## Escopo
**Só Ordem Paranormal.** D&D e Tormenta não são tocados (decisão do Andre).

## Critérios de aceite

### AC-1: os números do livro nunca são digitados
- **Dado** uma ficha com classe, atributos e NEX
- **Quando** o motor deriva a ficha
- **Então** PV/PE/SAN máximos, limite de PE por turno, círculo máximo de ritual e DT de rituais
  saem das tabelas oficiais, sem entrada manual
- **E** os valores batem com o livro: combatente 20+Vig / 4+Vig por NEX, 2+Pre / 2+Pre, 12 / 3;
  especialista 16+Vig / 3+Vig, 3+Pre / 3+Pre, 16 / 4; ocultista 12+Vig / 2+Vig, 4+Pre / 4+Pre, 20 / 5

### AC-2: o limite de PE por turno segue a Tabela 1.2
- **Dado** qualquer NEX
- **Quando** o motor deriva a ficha
- **Então** o limite é NEX÷5, com o NEX 99% valendo 20 (não 19,8)

### AC-3: Grau de Treinamento usa a conta CERTA de cada classe
- **Dado** um personagem no NEX 35% ou 70%
- **Quando** o motor emite a pendência de grau de treinamento
- **Então** a quantidade é **2 + Intelecto** para combatente, **5 + Intelecto** para especialista
  e **3 + Intelecto** para ocultista
- **E** só perícias já treinadas (grau 5 ou 10) são oferecidas

### AC-4: perícias de classe são ESCOLHA, não conjunto fixo
- **Dado** um personagem recém-criado
- **Quando** o motor lista as pendências
- **Então** o combatente escolhe uma entre Luta/Pontaria, uma entre Fortitude/Reflexos e mais
  1+Int livres; o especialista escolhe 7+Int; o ocultista recebe Ocultismo e Vontade fixos e
  escolhe mais 3+Int
- **E** as duas perícias da origem já entram treinadas sem perguntar

### AC-5: as habilidades de texto fixo entram sozinhas e as versões antigas são aposentadas
- **Dado** um combatente que chega ao NEX 25%
- **Quando** o avanço é aplicado
- **Então** a ficha tem **uma** habilidade "Ataque Especial", com o texto de 3 PE
- **E** o mesmo vale para Perito (1d6→1d8→1d10→1d12) e Escolhido pelo Outro Lado (1º→4º círculo)

### AC-6: escolher a trilha concede os quatro poderes nos NEX certos
- **Dado** um personagem que escolheu uma trilha no NEX 10%
- **Quando** ele atinge 40%, 65% e 99%
- **Então** os poderes correspondentes entram na ficha sem nova pergunta

### AC-7: pré-requisito não cumprido bloqueia com motivo escrito
- **Dado** a lista de poderes de classe
- **Quando** um poder tem pré-requisito não atendido (atributo, NEX, perícia treinada ou outro poder)
- **Então** a opção vem `disponivel: false` com o motivo em texto ("Falta: NEX 30%.")
- **E** nenhum poder pode ser escolhido duas vezes, salvo os que o livro marca como repetíveis
  (Transcender, Treinamento em Perícia, Ritual Predileto)

### AC-8: afinidade elemental no NEX 50%
- **Dado** um personagem que atinge NEX 50% sem elemento
- **Quando** o motor lista as pendências
- **Então** existe uma escolha de afinidade entre Conhecimento, Energia, Morte e Sangue
- **E** Medo **não** é oferecido (o livro proíbe afinidade com Medo)

### AC-9: rituais do ocultista
- **Dado** um ocultista
- **Quando** o motor lista as pendências
- **Então** há 3 rituais de 1º círculo na criação e 1 ritual por degrau de NEX depois
- **E** cada pendência só oferece rituais de círculo que aquele NEX já permite conjurar

### AC-10: idempotência
- **Dado** uma ficha já processada pelo motor
- **Quando** `aplicar` roda de novo sem novas escolhas
- **Então** nada é duplicado — a lista de habilidades tem o mesmo tamanho e nenhum nome repetido

### AC-11: o que o jogador escreveu é intocável
- **Dado** uma ficha com habilidades criadas à mão (sem carimbo do motor)
- **Quando** o motor sincroniza
- **Então** elas passam intactas (nome, texto, dados, imagem)
- **E** uma habilidade digitada à mão com o mesmo nome de uma concedida é **adotada** (ganha o
  carimbo e o texto do livro) em vez de virar cópia dupla

### AC-12: reversão não destrói
- **Dado** uma ficha em NEX alto com progressão registrada
- **Quando** o NEX é baixado
- **Então** o motor devolve os pontos de atributo, baixa os graus de treinamento, remove os
  rituais aprendidos e as habilidades concedidas acima do alvo, restaura a versão anterior de
  uma habilidade aposentada e limpa trilha/afinidade se o marco delas foi desfeito
- **E** nada sem carimbo do motor é apagado

### AC-13: poderes de origem que escalam com o NEX entram na conta
- **Dado** uma origem Desgarrado, Vítima ou Universitário
- **Quando** o motor deriva a ficha
- **Então** Calejado soma +1 PV por 5% de NEX, Cicatrizes Psicológicas +1 SAN por 5% de NEX e
  Dedicação +1 PE (mais 1 por NEX ímpar) e +1 no limite de PE por turno
- **E** a interface mostra de onde veio o acréscimo

### AC-14: a ficha ganha uma aba Progressão funcional
- **Dado** a ficha de Ordem Paranormal aberta
- **Quando** o jogador abre a aba Progressão
- **Então** vê a barra de NEX, os valores derivados com a conta, a classe/trilha/proficiências, a
  linha do tempo dos 20 degraus e os botões de evoluir / resolver pendências / voltar um degrau
- **E** um selo de aviso aparece no cartão de NEX quando há pendências

### AC-15: fichas antigas são auditáveis
- **Dado** uma ficha preenchida à mão antes desta feature
- **Quando** o motor calcula as pendências
- **Então** todas as escolhas que o livro deve ao personagem aparecem de uma vez, e o modo
  "auditoria" as resolve sem alterar o NEX

### AC-16: o grau +10 chama-se Veterano
- **Dado** os graus de treinamento do livro
- **Quando** qualquer tela exibe o nome do grau +10
- **Então** ele aparece como **Veterano** (não "Competente")
- **E** isso vale em `TREINO_TIERS`, no rótulo de diff da ficha, nas opções de grau de treinamento
  do assistente, no compêndio `regras-oficiais.json` e nos textos de poder que citam o grau
- **Nota:** substitui o AC-3 da spec 0024, que adotou "Competente" a partir de fonte secundária.
  Com o PDF oficial em mãos o nome correto é Veterano, e o Andre confirmou ("é veterano mesmo").

## Matriz de decisão — o que é automático e o que é escolha

| Concessão | NEX | Automático | Escolha | AC |
|---|---|---|---|---|
| PV/PE/SAN máximos | todos | sim | — | AC-1 |
| Limite de PE por turno | todos | sim | — | AC-2 |
| Círculo de ritual (ocultista) | 5/25/55/85 | sim | — | AC-1 |
| Habilidade de classe de texto fixo | 5/25/40/55/75/85 | sim | — | AC-5 |
| Trilha | 10 | — | 1 de 5 | AC-6 |
| Poder de trilha | 40/65/99 | sim (da trilha escolhida) | — | AC-6 |
| Poder de classe | 15/30/45/60/75/90 | — | 1 da lista, com pré-requisito | AC-7 |
| Aumento de atributo | 20/50/80/95 | — | 1 dos 5, teto 5 | — |
| Grau de treinamento | 35/70 | — | N + Int perícias | AC-3 |
| Versatilidade | 50 | — | poder de classe ou 1º de outra trilha | AC-7 |
| Afinidade elemental | 50 | — | 1 de 4 elementos | AC-8 |
| Ritual do ocultista | todos | — | 1 por degrau | AC-9 |
| Perícias da origem | criação | sim | — | AC-4 |
| Perícias da classe | criação | só as fixas | grupos + livres | AC-4 |

## Casos de borda e erros
- NEX fora dos degraus (37, 0, 120, texto) → normalizado para o degrau válido imediatamente abaixo
- Ficha sem classe → o motor não emite pendência nenhuma e a aba mostra um aviso
- Atributo já em 5 → a opção de aumento vem bloqueada, e aplicar mesmo assim não altera nada
- Perícia destreinada escolhida num grau de treinamento → ignorada, sem quebrar o resto
- Elemento inválido (ex.: "medo") em afinidade → recusado silenciosamente, ficha inalterada
- Ritual já conhecido → marcado como indisponível e não duplicado
- Escolha deixada pendente no assistente → o avanço acontece e a pendência continua listada

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Qualquer sistema que não seja Ordem Paranormal (D&D, Tormenta)
- Trilhas e poderes de **suplementos** (só o livro base)
- Regras de interlúdio, patente/prestígio e inventário — a progressão não os toca
- Migração automática de fichas existentes: a adoção acontece na primeira vez que o motor roda
  naquela ficha, não em lote

## Rastreabilidade
- Motor: `src/components/systems/OrdemParanormal/progressao/motor.js`
- Tabelas do livro: `src/components/systems/OrdemParanormal/progressao/tabelas.js`
- Assistente: `src/components/systems/OrdemParanormal/EvolucaoModal.jsx`
- Painel: `src/components/systems/OrdemParanormal/Tabs/ProgressaoTab.jsx`
- Gate executável: `src/components/systems/OrdemParanormal/__tests__/progressao.test.js`
- Specs relacionadas: 0006 (regras fiéis ao oficial), 0024/0026 (conteúdo do livro), 0003 (licença)
