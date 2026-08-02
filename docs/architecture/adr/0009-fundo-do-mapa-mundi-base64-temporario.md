---
name: adr-0009-fundo-do-mapa-mundi-base64-temporario
description: Decisão — o fundo do mapa-múndi fica em base64 no Firestore, em documento separado, enquanto o projeto estiver no plano Spark. Resolve o ADR-0008 escolhendo a opção B, com o caminho do Storage mantido em código. Puxar ao mexer no fundo do mapa-múndi, na performance da lista do Ateliê, ou ao subir para o Blaze.
alwaysApply: false
---

# ADR-0009 — Fundo do mapa-múndi em base64, por enquanto

- **Status:** aceito
- **Data:** 2026-08-01
- **Decisores:** Andre (decisão) · agente da F1 da spec 0028 (implementação)
- **Relação com o ADR-0008:** **resolve.** O ADR-0008 registrou o bloqueio e deixou
  duas saídas em aberto; esta é a escolha entre elas. Nada do que ele apurou muda —
  o bucket continua não existindo e o projeto continua no Spark.

## Contexto

O ADR-0008 provou, empiricamente, que o Firebase Storage não está disponível neste
projeto (HTTP 404 no bucket, plano Spark) e deixou a decisão para o Andre:
**A** — subir para o plano Blaze; **B** — fundo em base64 no Firestore, como o
resto do app já faz.

Em 2026-08-01 o Andre decidiu: *"vamos fazer no gratuito hoje, quando estivermos
finalizando o desenvolvimento do projeto eu faço isso"* (subir para Blaze).

## Decisão

**Opção B, explicitamente temporária.**

1. `uploadBackground(uid, mapId, file)` tem **dois caminhos**, escolhidos por
   capacidade, com **assinatura e retorno idênticos** (`{ url, path, width, height }`):
   - `fundoDisponivel() === true` → Firebase Storage (`url` = download URL,
     `path` = caminho no bucket). O código fica escrito, com `import()` dinâmico
     de `firebase/storage`, e **não deve ser apagado**.
   - `fundoDisponivel() === false` (hoje) → base64 no Firestore (`url` = dataURL,
     `path` = `null`).
2. O base64 reusa o **padrão da casa** de `MapEditor/sync/campaignSync2.js`: dois
   estágios de redução no cliente (1600px/q0.82 → 1200px/q0.7), teto de
   **900.000 bytes** por documento e dedup por hash SHA-256. Acima do teto, o
   envio é **recusado em PT-BR** — nunca se grava um documento que o Firestore
   rejeitaria inteiro.
3. A ilustração vai num **documento separado**:
   `users/{uid}/worldmaps/{mapId}/media/background`. O documento raiz do molde
   guarda só `backgroundRef`, `width`, `height` e uma **miniatura de ~200px**
   (teto de 48 KB) para o card da lista.
4. `deleteWorldMap` apaga o documento de mídia junto com as subcoleções.

### Por que documento separado (o ponto que mais dói se for ignorado)

`useWorldMaps` assina os documentos raiz **em tempo real**. Se a ilustração
morasse no raiz, a grade do Ateliê baixaria todos os fundos, inteiros, a cada
snapshot — 900 KB × número de mapas, a cada escrita de qualquer campo. O
ponteiro + miniatura mantêm o card leve e cobram a imagem cheia **uma vez**, sob
demanda (`getBackground`, com cache de módulo), só quando o molde é aberto.

Isto é **gate de teste**, não estilo: `worldMapStore.test.js` falha se a imagem
grande escorregar para o documento raiz.

## Consequências

- **−** Resolução modesta: o mestre sobe uma arte de até 8 MB, mas o que fica
  gravado cabe em ~0,9 MB (na prática, ~1600px no maior lado, JPEG q0.82). Arte
  muito detalhada perde nitidez, e a tela diz isso **antes** da escolha.
- **−** A cópia por campanha (N+1) volta a existir quando a F4 levar o molde para
  a mesa: jogador não lê o molde (AC-1), então a instância precisa da própria
  cópia da imagem. Com o Storage, seria só a URL.
- **−** Some uma leitura "de graça": o fundo não vem no snapshot da lista, então
  abrir um molde custa um `getDoc` (mitigado pelo cache de módulo).
- **+** Zero infra nova, zero custo, zero superfície de billing — que é
  exatamente o que o Andre pediu para esta fase.
- **+** O modelo não migra de schema em nenhum cenário: os quatro campos do fundo
  (`backgroundUrl`, `backgroundPath`, `backgroundRef`, `backgroundThumb`) já
  convivem, e cada caminho limpa o do outro ao gravar.
- **+** A tela não sabe onde a imagem mora. Trocar de caminho não muda um
  componente sequer.

## O que muda quando o Andre subir para o Blaze

1. Provisionar o bucket, criar `storage.rules` e declarar o bloco `storage` em
   `firebase.json` (declarar rules de bucket inexistente faz o deploy falhar —
   por isso não foram criados agora).
2. Trocar o corpo de `fundoDisponivel()` para `true`. **É o único interruptor**:
   a condição não está espalhada pela tela de propósito.
3. Escrever a migração dos `media/background` já existentes para o Storage. O
   modelo aceita os dois, mas os mapas antigos **não se movem sozinhos**.
4. `deleteWorldMap` passa a precisar de `getDoc` do molde + `deleteObject` antes
   do lote — senão o arquivo do bucket vira órfão pago.
5. Rever o teto e o aviso de tamanho na tela (`LIMITE_FUNDO_BYTES`,
   `AVISO_FUNDO_NO_DOCUMENTO`): no Storage não há teto prático de 0,9 MB.

## Alternativas rejeitadas

- **Esperar o Blaze e entregar a F1 sem upload de fundo:** era o estado anterior
  (ADR-0008). O Ateliê sem ilustração é um mapa-múndi sem mapa — a F2 planta nós
  *sobre* a arte. Não dava para seguir.
- **Guardar o base64 no documento raiz do molde** (mais simples, um `updateDoc`
  só): degrada a lista inteira do Ateliê para sempre. Ver acima.
- **Cair em base64 silenciosamente quando o Storage falhar** (o fallback que o
  ADR-0008 rejeitou): continua rejeitado. A escolha é por **capacidade
  declarada** (`fundoDisponivel()`), não por erro em tempo de execução — um
  `catch` que troca de estratégia esconde falha de infra real.
