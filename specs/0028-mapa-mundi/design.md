---
name: design-mapa-mundi
description: Arquitetura do Mapa-Múndi — separação entre Ateliê (aba Mapas, onde o mestre constrói) e Mesa (campanha, onde o grupo joga), modelo de dados que garante segredo sem servidor, e as três superfícies de uso.
alwaysApply: false
---

# Design — Mapa-Múndi · Ateliê e Mesa

> Tier **arquitetural**: novo bounded context (*Mundo Explorável*) e decisão difícil de reverter.
> Depende de [F0-descoberta.md](./F0-descoberta.md). **Nenhum código antes da aprovação.**
> Pedido do Andre em 2026-08-01: *"tem que ter onde o mestre orquestra as coisas e onde os players
> veem e participam"*.

---

## 1. A pergunta que define a arquitetura

> *"Dentro da campanha é interessante, mas aí tem que ter relação do mestre com os mapas — se não,
> pra que vai servir aquela aba de mapa ali?"*

A resposta é separar **autoria** de **jogo**. São dois momentos diferentes, com donos diferentes,
públicos diferentes e ciclos de vida diferentes:

| | **Ateliê** (aba Mapas) | **Mesa** (campanha) |
|---|---|---|
| Quem entra | Só o mestre, sozinho | Mestre + jogadores, juntos |
| Quando | Preparando a sessão | Durante a sessão |
| O que é | O **molde**: nós, trilhas, eventos, notas, segredos | A **partida**: onde o grupo está, o que já descobriu |
| Dono | `users/{uid}` — pessoal, privado | `campaigns/{cid}` — do grupo |
| Reuso | Um mapa serve **N campanhas** | Cada mesa tem o seu progresso |
| Tempo real | Não precisa | Essencial |

O próprio briefing já pedia isso sem nomear, na seção 5:

> *"`map_visibility` é por grupo/campanha, não global. O mesmo mapa reaproveitado em outra mesa
> começa do zero."*

Se a visibilidade é por mesa e o mapa é reaproveitável, então **o mapa não pertence à mesa** —
pertence ao mestre. A aba Mapas passa a ser o lugar onde ele mora.

E há precedente no próprio Nexus: `users/{uid}/assets` já é a biblioteca pessoal reutilizável entre
campanhas, com a regra que diz literalmente *"jogadores nunca leem daqui"*
(`firestore.rules:29-31`).

---

## 2. As três superfícies

### S1 · Ateliê do Mestre — aba **Mapas** (global, privada)

A aba Mapas deixa de ser dois cards soltos e vira a **oficina**, com sub-abas:

```
Mapas
├── Mesas Táticas      (o editor Owlbear que já existe — sem mudança de comportamento)
├── Mapas-Múndi        ← NOVO: lista, cria e edita moldes de mapa-múndi
└── Tokens             (o Construtor de Tokens que já existe)
```

Em **Mapas-Múndi** o mestre faz tudo que a seção 8 do briefing pede: sobe a ilustração, planta nós,
desenha trilhas curvas, ancora eventos, escreve notas que só ele lê, pinta névoa à mão, e vincula
nós a cenas táticas. Aqui **não há jogador nenhum** — nada é ao vivo, nada vaza, e ele pode
trabalhar com o mapa inteiro aberto.

O botão que fecha o ciclo: **"Levar para a mesa →"**, que publica o molde numa campanha.

### S2 · Mesa, lado do mestre — campanha › Mapas › Mapa-Múndi

Aqui o mestre **orquestra**. Ele vê o mapa completo (é dono do molde), mais um painel de comando
que não existe no ateliê:

- **Onde o grupo está** e para onde pode ir.
- **Revelar agora**: nó, trilha ou região, para todos, imediatamente.
- **Fila de eventos**: o que disparou, o que está armado, o que ele segurou.
- **Encontro aguardando decisão**: a rolagem já saiu, o jogador ainda não viu, e ele aceita, troca
  ou ignora (seção 9 do briefing).
- **Alternar Visão do Mestre / Visão do Jogador**, reusando o padrão `asViewer` da spec 0012.

### S3 · Mesa, lado do jogador — mesma tela, papel diferente

O jogador vê a ilustração sob a névoa, os nós descobertos, as trilhas reveladas, o marcador do
grupo, o relógio e os suprimentos. **Participa**: clica num nó adjacente para viajar, propõe
acampar, pede um teste de investigação numa trilha suspeita.

O que ele **não** tem: painel de cenas, painel de camadas, ferramentas de autoria — coerente com a
spec 0007 AC-2, que já fixou isso para a mesa tática.

---

## 3. Modelo de dados

A separação Ateliê/Mesa **é** o mecanismo de segredo. Não é preciso servidor: basta que o molde
viva onde o jogador não alcança.

```
┌─ ATELIÊ (privado do mestre) ────────────────────────────────────────────┐
│ users/{uid}/worldmaps/{mapId}                                           │
│   name, background (ver §5), width, height, fogEnabled, defaultRadius   │
│                                                                          │
│ users/{uid}/worldmaps/{mapId}/nodes/{nodeId}                            │
│   name, rumorLabel, description, gmNotes, type, x, y, icon, color,      │
│   linkedSceneId, revealRadius, isFastTravel                             │
│                                                                          │
│ users/{uid}/worldmaps/{mapId}/edges/{edgeId}                            │
│   fromNodeId, toNodeId, pathPoints[], travelHours, isSecret,            │
│   discoveryCheck, isOneWay, dangerLevel                                 │
│                                                                          │
│ users/{uid}/worldmaps/{mapId}/events/{eventId}                          │
│   anchor, title, playerText, gmText, trigger, triggerConfig,            │
│   isRepeatable, linkedSceneId, reveals                                  │
│                                                                          │
│ REGRA: allow read, write: if request.auth.uid == uid;                   │
│        — nenhum jogador jamais lê daqui. O segredo nunca sai do ateliê. │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                        "Levar para a mesa →"
                                    ▼
┌─ MESA (do grupo) ───────────────────────────────────────────────────────┐
│ campaigns/{cid}/worldmaps/{instanceId}                                  │
│   sourceUid, sourceMapId        ← ponteiro para o molde                 │
│   name, background, width, height, fogEnabled                           │
│   REGRA: read if isMember() · write if isMaster()                       │
│                                                                          │
│ campaigns/{cid}/worldmaps/{instanceId}/revealed/{nodeId|edgeId}         │
│   ── SÓ O QUE JÁ FOI REVELADO. Documento criado no ato da revelação.    │
│   nós:     { kind:'node', name, description, type, x, y, icon, color,   │
│              state:'rumored'|'discovered'|'visited', rumorLabel? }      │
│   arestas: { kind:'edge', fromNodeId, toNodeId, pathPoints[],           │
│              travelHours, state:'revealed'|'traveled' }                 │
│   eventos: { kind:'event', title, playerText }   ← só o texto público   │
│   REGRA: read if isMember() · write if isMaster()                       │
│                                                                          │
│ campaigns/{cid}/worldmaps/{instanceId}/party                            │
│   currentNodeId, x, y, inGameDatetime, supplies, speedModifier, flags   │
│   REGRA: read if isMember() · write if isMaster() OU jogador movendo    │
│                                                                          │
│ campaigns/{cid}/worldmaps/{instanceId}/fog                              │
│   mask (ver §5), updatedAt                                              │
│                                                                          │
│ campaigns/{cid}/worldmaps/{instanceId}/gm                               │
│   triggeredEventIds[], pendingEncounter, gmScratch                      │
│   REGRA: read, write: if isMaster()   ← o jogador nem lê o documento    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Por que isto satisfaz a Regra de Ouro

O critério de aceite nº 1 do briefing — *"um jogador com DevTools não consegue obter nome, posição
ou descrição de nó `hidden`"* — passa por construção:

- O nó `hidden` **não existe** em nenhum documento que o jogador possa ler. Ele mora em
  `users/{uid}/...`, negado pelas rules.
- A trilha secreta idem: só nasce em `revealed/` quando o mestre revela.
- `gmNotes` e `gmText` **nunca** são copiados na projeção pública. O campo não existe no payload,
  como o briefing exige.
- Não há filtro de render envolvido. Não há o que inspecionar no DevTools.

Isto é o oposto do que o Nexus faz hoje, onde névoa e tokens `hidden` viajam inteiros para o
cliente do jogador e são só escondidos na pintura (F0 §4).

### Quem executa a revelação

O cliente do **mestre** — é o único que consegue ler o molde. Quando o grupo chega a um nó, o
cliente dele roda `aoChegarEm()` e grava os documentos novos em `revealed/`.

**Consequência aceita e explícita**: a exploração exige o mestre online. Isso é natural — é uma
mecânica de sessão ao vivo, e o Nexus já assume o mestre presente (o editor tático só publica
elementos no efeito `isMaster`). Se o mestre cair, o jogador vê o mapa parar e uma mensagem honesta,
não um erro.

Alternativa avaliada e **descartada**: deixar o jogador gravar a revelação com as rules validando.
Não funciona — para revelar a trilha ele precisaria primeiro **ler** a trilha oculta, que é o
segredo. Não há como validar sem vazar.

---

## 4. O ciclo Ateliê → Mesa

```
   ATELIÊ                                    MESA
   ──────                                    ────
   cria o molde
        │
        ├── "Levar para a mesa" ──────────►  instância criada (vazia de revelações)
        │                                     party no nó inicial
        │                                     névoa fechada
        │
   edita o molde                              o grupo viaja
        │                                          │
        └── "Sincronizar" ────────────────►   nós novos entram como hidden;
            (opcional, explícito)              o que já foi revelado NÃO regride
```

**Duas regras que evitam o pesadelo clássico de template vs instância:**

1. **A instância nunca é sobrescrita.** Sincronizar só acrescenta; revelação nunca regride
   automaticamente (é a regra `max` da seção 6 do briefing). Só o mestre rebaixa, manualmente.
2. **A instância guarda cópia, não referência viva.** `revealed/` contém os dados copiados no ato
   da revelação. Se o mestre apagar o molde, a mesa continua jogável — o que já foi revelado é do
   grupo.

Um mesmo molde levado a três campanhas gera três instâncias independentes, cada uma com seu
progresso. É exatamente o que o briefing pediu.

---

## 5. Duas questões técnicas que o modelo obriga a decidir

### 5.1 A ilustração de fundo

F0 apurou: o Nexus guarda imagem como **base64 no Firestore**, teto de ~900 KB, sem usar Storage.
Um mapa-múndi é uma ilustração grande — 900 KB é apertado, e a imagem viaja no snapshot.

Agrava aqui: a imagem existiria **duas vezes** (molde + instância), ou N+1 vezes com N campanhas.

> **REVISADO em 2026-08-01, depois da verificação empírica.** O bucket **não existe** (HTTP 404 em
> `firebasestorage.app` e no legado `appspot.com`; 404 é bucket inexistente, 403 seria regra). O
> Firebase exige **plano Blaze** para provisionar, e o projeto está no **Spark**.
>
> **Decisão do Andre:** *"vamos fazer no gratuito hoje, quando estivermos finalizando o
> desenvolvimento do projeto eu faço isso"*. Vale o **plano B** — base64 no Firestore, em documento
> separado do doc do mapa, com o downscale de `campaignSync2.js:82-101`. O caminho do Storage segue
> implementado atrás de `fundoDisponivel()`: quando o plano subir, o interruptor vira e a migração
> dos fundos existentes entra junto. Ver ADR-0008.
>
> Texto original da recomendação, mantido por rastreabilidade:

**Recomendação original (adotar Firebase Storage, só para isto).** O resto do app
continua em base64 — nada muda no editor tático, nas fichas ou nos avatares.

> ### ⛔ BLOQUEADO na F1 (2026-08-01) — a decisão acima não é executável hoje
>
> A decisão foi tomada sem testar o bucket. O passo 0 da F1 testou, e **o bucket não existe**:
>
> | Verificação | Resultado |
> |---|---|
> | SDK `firebase@12`, `uploadBytes` em `worldmaps/{uid}/probe.txt` | `storage/unknown`, `serverResponse` vazio |
> | HTTP cru `POST`/`GET` em `/v0/b/nexus-rpg-app.firebasestorage.app/o` | **404 `Not Found`** |
> | Idem no bucket legado `nexus-rpg-app.appspot.com` | **404 `Not Found`** |
> | `firebase apphosting:backends:list --project nexus-rpg-app` | recusado: *"must be on the **Blaze** plan"* |
>
> `404` é o bucket **não existir** — regra negada devolveria `403`. Desde out/2024 o Firebase
> exige **plano Blaze** para provisionar o bucket padrão do Cloud Storage, e o projeto está no
> **Spark**. A string em `src/firebase.js:9` é um nome de bucket que nunca foi criado.
>
> **Duas saídas, ambas dependem do Andre — ver [ADR-0008](../../docs/architecture/adr/0008-fundo-do-mapa-mundi-storage-bloqueado.md):**
> - **A — subir para Blaze:** mantém esta seção como está e destrava também Cloud Functions
>   (que resolveria o C1 da F0 e a exploração assíncrona hoje fora de escopo). Custo: billing.
> - **B — plano B, base64 no Firestore:** teto de ~900 KB e o downscale de dois estágios que
>   `MapEditor/sync/campaignSync2.js:82-101` já faz. Sem custo, sem infra nova — mas **esta seção
>   §5.1 passa a estar errada e precisa ser reescrita**, e a duplicação por campanha volta.
>
> **O que a F1 entregou sob o bloqueio:** CRUD do molde, cotas e as rules do AC-1 — tudo o que não
> depende do fundo. Ficaram de fora `uploadBackground`, o `storage.rules` e o bloco `storage` do
> `firebase.json` (declarar rules para bucket inexistente faz o `firebase deploy` falhar).
> `backgroundUrl`/`backgroundPath` já existem no modelo e servem às duas opções — em B,
> `backgroundUrl` guarda o dataURL e `backgroundPath` fica `null`. Nenhuma migração em qualquer cenário.

- Caminho: `worldmaps/{uid}/{mapId}/background.{ext}` no bucket já configurado
  (`src/firebase.js:9`, hoje declarado e nunca instanciado).
- A instância na campanha guarda a **URL**, não os bytes — a duplicação por campanha desaparece.
- Exige `storage.rules` (não existe hoje): escrita só do dono; leitura para o dono e para membros
  das campanhas onde o mapa foi publicado. Como as regras de Storage não conseguem consultar o
  Firestore, a leitura será **por URL de download assinada**, guardada na instância.
- Exige **ADR novo** que revisita o ADR-0005 (*"Firebase Storage para imagens: rejeitado para a v1
  do mapa"*) — a decisão não é revogada, é escopada: vale para o fundo do mapa-múndi, não para o
  resto.

### 5.2 A máscara de névoa

F0 apurou: a névoa atual é lista de formas vetoriais em máscara SVG, gravada dentro do doc da cena —
cada corte reescreve o documento inteiro. Insustentável para revelação contínua durante a viagem.

**Recomendação: bitmap, como o briefing especifica.** Canvas offscreen com
`globalCompositeOperation='destination-out'`, persistido em Storage (downscale 4×, só o canal
alpha), com **deltas** pelo tempo real e flush consolidado periódico.

É subsistema novo — não reuso. O que se herda do existente é o **pincel manual** (`fog.js`
`toggleCut`/`joinShapes`) para a ferramenta do mestre, e o padrão GM-translúcido/jogador-opaco.

### 5.3 Escala do render — **decidida**

**Andre (2026-08-01): plano free = poucos nós; plano pago = centenas.**

Centenas de nós matam a arquitetura DOM+SVG atual se todos forem nó do DOM **animado**. Mas jogar
tudo para canvas custaria acessibilidade — nó de mapa é elemento interativo, precisa de foco,
teclado e rótulo para leitor de tela.

**Decisão: render híbrido, dividido por natureza.**

| Camada | Tecnologia | Porquê |
|---|---|---|
| Ilustração de fundo | **Canvas** | uma imagem, pintada uma vez |
| Névoa | **Canvas** (bitmap) | exigência da mecânica — §5.2 |
| Trilhas (curvas) | **Canvas** | centenas de curvas em SVG são caras; não são focáveis |
| Nós | **DOM**, virtualizados por viewport | interativos: foco, teclado, `aria-label`, tooltip |
| Marcador do grupo, seleção, tooltips | **DOM** | poucos, e precisam de semântica |

Virtualização: só os nós dentro do viewport (mais uma margem) viram DOM. Com centenas no mapa e
dezenas em tela, o custo fica constante.

**Cota por plano** — o limite vira regra de produto, validada nas rules (contagem no doc do mapa):

| Plano | Nós por mapa | Mapas-múndi |
|---|---|---|
| Free | **25** | 1 |
| Pago | **500** | ilimitado |

> Números **propostos**, não decididos. Preciso que o Andre confirme ou corrija — eles entram na
> spec como critério de aceite e na cópia dos planos (`App.jsx:4986-5006`).

---

## 5.4 Animação — o mapa precisa respirar

**Pedido do Andre: *"coloque uma animaçãozinha no mapa-múndi também"*.**

Curadoria enxuta: mapa que se mexe demais compete com a informação. Cinco movimentos, todos ligados
à mecânica — nenhum é enfeite solto.

1. **Deriva da névoa** — textura de ruído com deslocamento lento (~40 s por ciclo) e viés frio,
   contra o dourado dos ícones. É o que faz a névoa parecer névoa, e não cinza chapado.
2. **Revelação** (~600 ms, ease-out) — a névoa recua, o ícone entra com fade e leve escala.
   **É o momento de recompensa da mecânica inteira** — é aqui que vale gastar cuidado.
3. **Nó `rumored`** — brilho difuso que respira devagar (~3 s), com "?" em vez de ícone concreto.
   Comunica "tem algo ali, você não sabe o quê" sem precisar de texto.
4. **Marcador do grupo** — flutua sutilmente parado; ao viajar, percorre a curva da trilha no ritmo
   das horas da aresta, com a névoa abrindo continuamente ao longo do caminho.
5. **Tinta de hora do dia** — a ilustração recebe uma camada de cor puxada de
   `party.inGameDatetime`: quente ao meio-dia, âmbar no poente, fria e azulada à noite. Amarra o
   relógio da seção 9 do briefing a algo visível, em vez de um número no canto.

**Regras de execução:**
- Tudo em `transform` e `opacity` (compostas na GPU). Nada de animar `left`/`top`/`width`.
- A deriva roda no canvas que já existe; não cria camada nova.
- **`prefers-reduced-motion` corta a deriva, o respiro e a tinta**, e troca a revelação por corte
  seco. O briefing exige na seção 11 e o Nexus já respeita a preferência em outras telas.
- Nada anima fora do viewport, e nada anima enquanto o mestre edita no ateliê — lá o mapa fica
  parado, porque ele está trabalhando.

---

## 6. Onde isso encosta no que já existe

**Reusar sem reescrever:**
- `useSlidingPill` + `SlidingTabPill` para as sub-abas de Mapas e da campanha.
- O par `viewer`/`previewPlayer` → `asViewer` (spec 0012 AC-5) para o toggle de visão.
- O selo *"🧪 Modo Teste — só você está vendo"* como precedente de rotular modo simulado.
- `fsSendMessage` + `RollFeed` como transporte dos testes de descoberta e encontros.
- `campaignSync2`/`live.js` como padrão de assinatura, throttle e supressão de eco.

**Extrair antes (pré-requisito, ver F0 D4):**
- `rollDice`/`rollOP` → `src/domain/dice.js`. O briefing proíbe motor de dados paralelo, e hoje
  são 5 implementações duplicadas inline no App.jsx, nenhuma exportada.
- A câmera do editor (pan/zoom/`screenToWorld`) → hook reutilizável.

**Não tocar:**
- O `MapEditor` atual. O mapa-múndi é **componente irmão** (`WorldMap/`), não uma segunda
  modalidade dentro das 2.382 linhas do editor tático (F0 C3).
- O modelo de cenas da spec 0009/ADR-0006.

---

## 7. Fases (revisão da seção 12 do briefing)

| Fase | Entrega | Observação |
|---|---|---|
| **F0** | Descoberta | ✅ feito |
| **F1** | Ateliê: sub-abas em Mapas + CRUD do molde + upload p/ Storage | §5.1 + `storage.rules` + ADR |
| **F2** | Render do grafo + editor de nós e trilhas (no ateliê) | componente irmão |
| **F3** | Névoa bitmap + pincel + toggle de visão + deriva da névoa | §5.2, §5.4 |
| **F4** | **Levar para a mesa** + máquina de estados + viagem + revelação | *o coração* |
| **F5** | Eventos, gatilhos e testes de descoberta | exige `dice.js` extraído |
| **F6** | Tempo, suprimentos, encontros, acampamento | painel de orquestração |
| **F7** | Tempo real com deltas + as 5 animações + polimento | §5.4 |

F4 é a fase que define o produto. `aoChegarEm` e o motor de encontros são **funções puras
testáveis**, escritas com teste antes.

---

## 8. Decisões pendentes

| # | Decisão | Recomendação |
|---|---|---|
| **D1** | Onde vive | **Ateliê + Mesa** (esta proposta) — resolve "pra que serve a aba Mapas" |
| **D2** | Como garantir segredo | **Separação por documento**, sem servidor. Custo: mestre precisa estar online |
| **D3** | Fundo do mapa | ✅ **DECIDIDO**: Firebase Storage só para isto (§5.1) |
| **D4** | Extrair `dice.js` e câmera antes | **Sim**, é pré-requisito de F5 |
| **D5** | DOM+SVG ou canvas | ✅ **DECIDIDO**: híbrido — canvas pinta, DOM interage (§5.3) |
| **D6** | Cota de nós por plano | ⏳ **números propostos** (free 25 / pago 500) — confirmar |

**Bugs preexistentes a tratar em separado** (F0 §7): `campaigns/{id}/bestiary` sem regra (deny-all,
provável quebra em produção) e `campaigns/{id}` legível por qualquer autenticado, incluindo o
código de convite.
