---
name: adr-0008-fundo-do-mapa-mundi-storage-bloqueado
description: Decisão — onde mora a ilustração de fundo do mapa-múndi. Escopa (não revoga) o ADR-0005; registra que o Firebase Storage está indisponível no plano Spark e deixa a escolha entre Blaze e base64 pendente do Andre. Puxar ao mexer no fundo do mapa-múndi ou ao reavaliar Storage.
alwaysApply: false
---

# ADR-0008 — Fundo do mapa-múndi: Storage escolhido, Storage indisponível

- **Status:** proposto — **bloqueado**, aguardando decisão do Andre
- **Data:** 2026-08-01
- **Decisores:** Andre (pendente) · agente da F1 da spec 0028
- **Relação com o ADR-0005:** **escopa, não revoga.** O ADR-0005 rejeitou o Firebase
  Storage para as imagens do mapa da mesa; este ADR trata apenas do **fundo do
  mapa-múndi**. Fichas, avatares, imagens do editor tático e assets continuam em
  base64 no Firestore, sem alteração.

## Contexto

A spec 0028 (Mapa-Múndi) precisa de uma ilustração de fundo por molde. Os fatos
levantados na F0 e no design:

- O app inteiro guarda imagem como **base64 dataURL no Firestore**, com teto
  auto-imposto de ~900 KB e dois estágios de downscale
  (`src/components/MapEditor/sync/campaignSync2.js:82-101`). Zero ocorrências de
  `firebase/storage` em `src/`.
- Um mapa-múndi é uma ilustração grande. 900 KB é apertado, a imagem viaja
  inteira no snapshot, e ela existiria **N+1 vezes** (molde + uma cópia por
  campanha) se ficasse embutida.
- `src/firebase.js:9` já **declara** `storageBucket: "nexus-rpg-app.firebasestorage.app"`,
  mas o Storage **nunca foi instanciado** em código.
- Por isso o `design.md` §5.1 registrou, em 2026-08-01: *"DECIDIDO pelo Andre:
  adotar Firebase Storage, só para isto"*.

### O que a verificação empírica mostrou (passo 0 da F1)

A decisão do design foi tomada sem testar o bucket. Antes de escrever código, a
F1 testou — autenticando com a conta de QA e tentando `uploadBytes` em
`worldmaps/{uid}/probe.txt`:

| Verificação | Resultado |
|---|---|
| SDK `firebase@12`, `uploadBytes` | `storage/unknown`, `serverResponse` **vazio** |
| HTTP cru — `POST /v0/b/nexus-rpg-app.firebasestorage.app/o` | **404 `Not Found`** |
| HTTP cru — `GET  /v0/b/nexus-rpg-app.firebasestorage.app/o` | **404 `Not Found`** |
| Idem no bucket legado `nexus-rpg-app.appspot.com` | **404 `Not Found`** |
| `firebase apphosting:backends:list --project nexus-rpg-app` | recusado: *"must be on the **Blaze** plan"* |

**Leitura:** `404` é o bucket **não existir**. Uma negativa de regra devolveria
`403 Permission denied`; uma queda de rede não devolveria JSON do Google. O
`storage/unknown` do SDK é só a tradução pobre do 404.

**Causa:** desde outubro de 2024 o Firebase exige o **plano Blaze** para
provisionar o bucket padrão do Cloud Storage. O projeto está no **Spark** — o que
o comando do App Hosting confirma de forma independente. A string em
`src/firebase.js:9` é um nome de bucket que nunca foi criado.

Ou seja: **a decisão registrada no design §5.1 não é executável hoje.** Não é uma
questão de regras, de SDK ou de código — é billing.

## Decisão

**Bloqueada.** Nenhuma das duas saídas pode ser escolhida por um agente: uma
custa dinheiro do Andre, a outra rebaixa a qualidade do produto. Fica registrado
para ele decidir:

### Opção A — subir o projeto para o plano Blaze
- Mantém a decisão do design §5.1 intacta: fundo em
  `worldmaps/{uid}/{mapId}/background.{ext}`, instância guarda a **URL**, e a
  duplicação por campanha desaparece.
- Ilustração em resolução alta, sem teto prático.
- Custo: Blaze é pós-pago por uso (com camada gratuita generosa para este
  volume), e passa a existir uma **nova superfície de billing**.
- Destrava, de quebra, Cloud Functions — que é o que resolveria de verdade o
  C1 da F0 (*"segredo é do servidor" não tem servidor*) e a exploração
  assíncrona que a spec hoje declara fora de escopo.

### Opção B — plano B: fundo em base64 no Firestore
- Segue o que o resto do app já faz, sem infra nova e sem custo.
- Reusa o downscale de dois estágios de `campaignSync2.js:82-101` e o teto de
  ~900 KB por documento.
- Custos aceitos: resolução modesta para uma ilustração de mapa-múndi; a imagem
  viaja inteira no snapshot do molde; e a cópia por campanha volta a existir
  (N+1), a menos que a instância aponte para o molde — o que não pode, porque
  jogador não lê o molde (AC-1).
- Exigiria **corrigir o design §5.1**, que hoje afirma o contrário.

**Recomendação do agente:** A, se o Andre aceitar o Blaze — ela resolve mais do
que o fundo do mapa. B é uma degradação consciente e reversível, não um erro.

## Alternativas rejeitadas

- **Provisionar o bucket por outro caminho** (gsutil, console do GCP, outro
  bucket avulso do Cloud Storage): o gate é de plano, não de ferramenta, e um
  bucket fora do Firebase ficaria sem `storage.rules` — a autorização viraria
  código nosso, o oposto do que o AC-1 pede.
- **Hospedar a ilustração fora** (Vercel Blob, CDN de terceiro, URL colada pelo
  mestre): tira o controle de acesso do Firebase, cria uma segunda superfície de
  autenticação e transforma o fundo num link que pode sumir. Rejeitado.
- **Deixar `uploadBackground` com um contorno silencioso** (ex.: cair em base64
  sozinho quando o Storage falha): esconderia do Andre exatamente a decisão que
  ele precisa tomar, e é o tipo de fallback que o projeto já proíbe.

## Consequências

- **−** A F1 entrega o Ateliê **sem upload de fundo**. `worldMapStore.js` não
  exporta `uploadBackground`; `backgroundUrl`/`backgroundPath` existem no modelo
  e ficam `null`. O `deleteWorldMap` ainda não apaga arquivo nenhum — não há
  arquivo.
- **−** `storage.rules` **não foi criado** e o bloco `storage` **não foi
  declarado** em `firebase.json`. Declarar rules para um bucket inexistente faz o
  `firebase deploy` falhar; entra junto com a decisão A.
- **−** O `design.md` §5.1 fica com um aviso de bloqueio até a decisão. Se sair
  B, ele precisa ser corrigido — não basta anexar o aviso.
- **+** O modelo de dados já nasce agnóstico: `backgroundUrl` + `backgroundPath`
  atendem às duas opções (em B, `backgroundUrl` guarda o dataURL e
  `backgroundPath` fica `null`). Nenhuma migração de schema em qualquer cenário.
- **+** O resto da F1 (CRUD do molde, cotas, rules de AC-1) não depende disto e
  está entregue.
- **+** O ADR-0005 continua válido no que decidiu; este ADR só recorta o caso do
  fundo do mapa-múndi.
