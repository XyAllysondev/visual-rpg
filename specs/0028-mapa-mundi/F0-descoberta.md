---
name: f0-descoberta-mapa-mundi
description: Relatório da Fase 0 (descoberta) do Mapa-Múndi com exploração e névoa — inventário técnico do que existe, contradições com o documento de requisitos e decisões pendentes do Andre.
alwaysApply: false
---

# F0 — Descoberta · Mapa-Múndi com Exploração e Névoa

> **Nenhum código de produção foi escrito.** Este documento responde às 6 perguntas da seção 2 do
> briefing, lista as contradições encontradas e as decisões que dependem do Andre.
> Levantamento feito em 2026-08-01 por três agentes de exploração, com citação de arquivo:linha.

---

## 1. Stack e roteamento

| Item | Realidade |
|---|---|
| Framework | React 18.2, CRA 5 com **craco** (`package.json`) |
| Estado | `useState`/`useReducer` puro — **não há Redux, Zustand, Jotai ou Context global** |
| UI | **Inline styles + CSS custom properties.** Tailwind e shadcn estão instalados mas **não são usados** nos componentes (ADR-0004) |
| Roteamento | **Não existe react-router.** Navegação por estado (`screen`/`setScreen`, App.jsx:11631) com URL sincronizada à mão via `window.history` (App.jsx:11717-11779) |
| Rotas especiais | `/p/:id` e `/cast/:id` por regex no pathname, **antes** do shell (App.jsx:11955-11965) |
| Backend | **Não existe backend de aplicação.** Ver seção 4 |

---

## 2. Renderização do mapa atual

**Tecnologia: DOM absolutamente posicionado + SVG. Não há Canvas 2D de render, nem Konva, nem Pixi.**

- Container único transformado — `MapEditor/index.jsx:1613`:
  `transform: translate(${pan.x}px,${pan.y}px) scale(${scale})`, `transformOrigin:'0 0'`.
- Tokens, imagens e notas são `<div>`; grade, desenhos e névoa são `<svg>`. Tudo filho do mesmo
  container, num único contexto de empilhamento (`mapHelpers.js:19-22`).
- Os únicos `getContext('2d')` do módulo são **offscreen, para downscale de imagem antes de
  persistir** (`index.jsx:625`, `campaignSync2.js:56-70`) — não pintam cena.
- **Não existe game-loop.** Há dois `requestAnimationFrame`, ambos one-shot: coalescência de
  arraste (`index.jsx:249-252`) e medição de textarea (`TextItem.jsx:95`). O render é re-render do
  React; durante o arraste as posições vivem em refs e um `setDragTick` força o repaint.
- **Câmera**: `pan` e `scale` em `useState` (`index.jsx:107-108`), espelhados num ref para os
  handlers (`index.jsx:208`). `screenToWorld` está **inline no index.jsx:210-213**, não em
  `mapHelpers.js`. **`worldToScreen` não existe** — a inversa está duplicada em dois lugares
  (`index.jsx:1326` e `1659`).
- **Camadas**: 7 fixas, embutidas no doc da cena (`schema.js:12-20`). Ordem do array = ordem de
  render. Z-order por aritmética de janela (`mapHelpers.js:11-17`: `li*100000 + 50000 + z`),
  travado por teste de DOM real (`__tests__/renderStack.test.jsx`).
- O render **não itera camadas** — itera por tipo de elemento em 5 blocos e deixa o `z-index` CSS
  ordenar (`index.jsx:1616, 1682, 1721, 1766, 1792`).

**Limite de escala desta arquitetura**: cada elemento é um nó do DOM. Um mapa-múndi com milhares
de ícones não cabe aqui sem virar canvas.

### Névoa existente — incompatível com o que o briefing pede

| | Névoa atual | Briefing (seção 7) |
|---|---|---|
| Modelo | **Lista ordenada de formas vetoriais** em coords de mundo (`schema.js:33`, `fog.js:2-3`) | **Bitmap** em canvas offscreen |
| Render | **Máscara SVG** (`FogLayer.jsx:56-64`) | `globalCompositeOperation='destination-out'` |
| Persistência | Dentro do doc meta da cena | PNG/WebP downscale 4x |
| Por jogador | **Não existe** — estado único, global por cena | Máscara acumulada por grupo |
| GM vs jogador | Só **opacidade**: 0.88 mestre / 0.98 jogador (`FogLayer.jsx:49`) | GM a ~15% |

O briefing diz "reaproveite o stack de render já usado no editor tático" — **não é possível
literalmente**, porque não há stack de canvas. E a lista vetorial é o modelo que o próprio briefing
proíbe ("não persista lista de círculos — cresce sem limite"), o que se agrava com revelação
contínua ao longo da viagem.

O que **vale herdar**: o padrão GM-translúcido/jogador-opaco, e o pincel manual de névoa
(`fog.js` `toggleCut`/`joinShapes`) para a ferramenta da seção 8.

---

## 3. Modelo de dados atual

```
campaigns/{cid}                              masterId, members[], admins[], inviteCode, narracao…
campaigns/{cid}/map/state                    { v:2, activeSceneId }
campaigns/{cid}/map/{sceneId}                CENA (kind:'scene') — layers, grid, fog, permissions
campaigns/{cid}/map/{sceneId}/elements/{id}  TOKEN/ELEMENTO (1 doc cada)
campaigns/{cid}/map/img_a_{hash16}           imagem (kind:'image')
campaigns/{cid}/map/live_{uid}               presença/ping/câmera (kind:'live')
campaigns/{cid}/bestiary/{id}                bestiário — SEM REGRA (ver §7, achado 2)
users/{uid}/assets/{assetId}                 biblioteca pessoal de mapa
```

- Cena, imagem e canal live **compartilham a coleção `map/`**, discriminados pelo campo `kind` —
  é o que permite uma única `match /map/{docId}` cobrir os três (`firestore.rules:108`).
- **Imagens são base64 dataURL no Firestore. Firebase Storage NÃO é usado** (zero ocorrências de
  `firebase/storage` em `src/`). Teto auto-imposto de 900 KB por doc, com dois estágios de
  downscale (`campaignSync2.js:54, 84-85`) e content-addressing com dedup por SHA-256 (`:73-94`).
  Decisão registrada em `adr/0005-mapa-da-mesa-no-firestore.md`.
- **Versionamento existe e é maduro**: `SCHEMA_V=3`, migrações puras e idempotentes
  (`migrations.js`), pipeline no reducer (`reducer.js:12-38`) e migração de topologia lazy no
  Firestore, retomável, só do mestre (`campaignSync2.js:174-203`).

**Consequência para o mapa-múndi**: a ilustração de fundo de um mapa-múndi costuma ser grande.
Com base64 e teto de ~900 KB, a resolução máxima é modesta. Adotar Firebase Storage é uma decisão
nova de billing/rules (ver §7, decisão D3).

---

## 4. Autorização — **o achado mais importante**

### Não existe servidor no caminho dos dados

- **Sem Cloud Functions**: não há pasta `functions/`; `firebase.json` declara só `hosting` e
  `firestore`. Cloud Functions exigem o **plano Blaze**, e o projeto está no **Spark** (confirmado
  quando um comando do Firebase recusou por plano).
- `api/` são 4 funções serverless da **Vercel**, todas fora do fluxo de jogo: `_lib.js` (CORS +
  verificação de ID token), `ai.js` (órfão após a spec 0027), `create-payment.js`,
  `payment-webhook.js` (único caminho privilegiado, via service account).
- Todo dado de campanha/mapa/ficha é lido e escrito pelo SDK Firebase **no browser**.
  ADR-0002 registra: *"SDK acoplado diretamente nos componentes"*.

### Papéis

`isMaster = campaign.masterId === uid`, calculado no cliente (`App.jsx:4748`) e descido por props.
Há um terceiro papel, `admin` (`App.jsx:4749`), **que as rules desconhecem**.
`permissions.js:1-2` declara a divisão honestamente: *"Espelham as rules — o gate real é o
Firestore; aqui é UX"*.

As rules **impõem de verdade** as escritas do mapa, inclusive no nível de campo: o jogador só
escreve `x`, `y`, `rotation` do próprio token (`firestore.rules:122-125`).

### Rules NÃO escondem campos

Firestore Rules são **tudo-ou-nada por documento** na leitura. Elas inspecionam campos para
decidir, e restringem quais campos uma escrita toca — mas **não devolvem documento parcial**.

**Hoje o projeto não tem segredo real.** Todos os casos de "o mestre vê e o jogador não" são
filtro de render no cliente:

| Segredo | Como é feito | Vazamento |
|---|---|---|
| Névoa | Mesmo doc para todos; muda só o alpha (`FogLayer.jsx:49`) | O jogador **recebe a geometria completa** da névoa |
| `hidden` / `spectre` | `.filter()` no render (`index.jsx:1616, 1682, 1721`) | O token secreto do mestre **está no cliente do jogador** |
| Ficha privada | Filtro no cliente (`App.jsx:2320`) | Rule libera todo `sharedSheets` a qualquer membro |
| Narração de teste | `isMaster ? campaign.narracaoTest : null` (`App.jsx:4672`) | Campo no doc que **qualquer autenticado** lê |
| Rolagem oculta do mestre | **Correto por acidente**: fica em estado React, nunca vai ao Firestore (`App.jsx:4284-4288`) | — |

Isto é exatamente o que a Regra de Ouro do briefing proíbe. O critério de aceite nº 1 do briefing
("um jogador com DevTools não consegue obter nome, posição ou descrição de nó hidden")
**não é atingível** com o modelo atual.

---

## 5. Tempo real

- **Firestore `onSnapshot`**. Não há WebSocket próprio, Realtime Database nem Socket.io.
- Canais **por campanha**, cena como subdivisão: `map/state` (ponteiro), query `kind=='scene'`,
  coleção `elements` da cena ativa (re-assinada na troca), query `kind=='live'`.
- Presença/ping/câmera: doc `map/live_{uid}` com throttle trailing de 250 ms e descarte por
  staleness de 6 s (`sync/live.js`).
- **Conflito: last-write-wins, sem detecção.** Mitigado por diff por id (`elementDiff.js`),
  supressão de eco via `metadata.hasPendingWrites` (`index.jsx:462`) e segregação de escrita por
  papel. Dois mestres simultâneos se sobrescrevem em silêncio.
- Granularidade: meta da cena = doc inteiro, debounce 1 s; elementos = 1 doc cada, só o diff,
  batch ≤400, debounce 300 ms; posição do jogador = merge de `{x,y}`, throttle 300 ms.
- **A névoa não tem granularidade própria**: cada corte reescreve o doc meta da cena inteiro.
  Para revelação contínua durante viagem isso é insustentável — confirma a necessidade de canal
  próprio com deltas, como o briefing pede na seção 10.

---

## 6. Estrutura de abas

### A aba "Mapas" global não tem campanha, nem mestre, nem jogador

`MapaScreen` (`App.jsx:2915-2985`) tem **70 linhas**: dois cards ("Mesa Tática" e "Construtor de
Tokens") e um `useState('modo')`. **Não** tem sub-abas, **não** lê Firestore, **não** conhece
`campaignId` nem `isMaster`. Monta o editor sem `campaignId` (`App.jsx:2931`), o que o joga em
modo **localStorage pessoal** — quem abre ali é sempre "mestre" de um sandbox privado.

O `case "map"` passa só duas props: `uid` e `onBack` (`App.jsx:11921`).

A versão multiplayer é **outra tela**: `CampaignMapTab` (`App.jsx:2987-3059`), dentro de
`CampaignDetail`, que tem `campaignId` e `isMaster`.

### Padrões prontos para reusar

- **Abas**: `useSlidingPill` + `SlidingTabPill`, 6 usos no projeto. O precedente mais próximo do
  pedido é `CampaignDetail` (`App.jsx:4811-4820, 4941-4972`), que já faz **abas condicionais por
  papel** e defende com dupla checagem no render.
- **"Ver como o jogador vê"**: já existe e é maduro, da **spec 0012 AC-5**.
  `viewer` (papel real, corta interação) e `previewPlayer` (só visual) são estados separados que se
  unem **apenas no render**: `const asViewer = viewer || previewPlayer` (`index.jsx:1419`).
  O mestre vê como jogador **sem perder as ferramentas**. Toggle em `index.jsx:2115`.
- **Nome canônico**: `spectre`, não `gmOnly` (que não existe no projeto).
- **Selo de modo simulado**: "🧪 Modo Teste — só você está vendo" (`App.jsx:4716-4720`).
- **Forçar papel por prop**: `/cast` monta o mesmo editor com `isMaster={false}` (`App.jsx:11447`).

### Motor de dados: existe, mas fragmentado

**Cinco implementações duplicadas, todas inline no App.jsx, nenhuma exportada, nenhuma testada.**
As canônicas são `rollDice` (`App.jsx:110-120`, parser `NdM±K` com caps) e `rollOP`
(`App.jsx:6820-6825`, regra de Ordem Paranormal: N d20 pega o maior, atributo 0 → 2d20 pega o pior).
Transporte e feed já prontos e reusáveis: `fsSendMessage` (`App.jsx:285`), `RollFeed`
(`App.jsx:2722`), `SheetRollPanel` (`App.jsx:2686`).

O briefing (seção 9) exige reusar o motor existente. Hoje "reusar" significa importar de um arquivo
de 12 mil linhas onde nada é exportado — **é preciso extrair antes** para `src/domain/dice.js`
(alinhado com a spec 0002, já no backlog).

---

## 7. Contradições, achados e decisões pendentes

### Contradições com o briefing

**C1 — "Segredo é do servidor" (seção 4) não tem servidor.**
Os DTOs `WorldMapGMDto`/`WorldMapPlayerDto` "montados no servidor" não têm onde ser montados, e as
rules não filtram campos. **Sem mudança, o critério de aceite nº 1 falha.**

**C2 — "Reaproveite o stack de render" (seção 7) não se aplica.**
Não há canvas. A névoa atual é vetorial em máscara SVG; o briefing especifica bitmap com
`destination-out`. Para revelação contínua ao longo da viagem, o bitmap é a escolha certa — logo é
**subsistema novo**, não reuso.

**C3 — "Reutilize os componentes do editor tático" (seção 8) não existem como componentes.**
Travar/ocultar/duplicar/deletar são JSX inline num arquivo de 2.382 linhas. Não há `Token.jsx` nem
menu de contexto extraído. Reusar exige extrair, e isso mexe no editor tático, que tem 8 suítes de
teste em cima (incluindo `renderStack.test.jsx`, que monta o componente real).

**C4 — A aba pedida não tem contexto de mestre/jogador.**
O briefing pede a aba em Mapas → Mesa Tática, com visão de mestre e de jogador. A aba Mapas global
é um sandbox pessoal sem campanha. Ver decisão D1.

**C5 — Névoa por grupo não existe.**
`map_visibility` é "por grupo/campanha, não global" no briefing. A névoa atual é única e global por
cena. É feature nova, não adaptação.

### Achados fora do escopo do briefing (bugs preexistentes)

1. **`campaigns/{id}` é legível por QUALQUER autenticado** (`firestore.rules:43`), não só membros —
   incluindo `inviteCode`, `memberNames` e `narracaoTest`. Destoa do resto do bloco, que usa
   `isMember()`.
2. **`campaigns/{id}/bestiary` NÃO TEM REGRA.** O código usa a subcoleção (`App.jsx:3240, 3293,
   3304`), mas não há `match` para ela e subcoleção não herda regra do pai — está em **deny-all**.
   Provável quebra em produção. **Vale confirmar com o Andre antes de qualquer coisa.**
3. O papel `admin` é client-side puro; as rules o desconhecem, então um admin é barrado ao editar.
4. `api/ai.js` ficou órfão após a remoção da IA (spec 0027).

### Decisões que dependem do Andre

**D1 — Onde o mapa-múndi vive?**
   a) Dentro da **campanha** (`CampaignMapTab`), onde já há `campaignId`, `isMaster`, tempo real e
      membros. **Recomendado** — é o único lugar onde "visão do mestre e dos players" faz sentido.
   b) Na aba **Mapas global**, passando contexto de campanha novo para `MapaScreen` (exige escolher
      a campanha ali, e a aba deixa de ser sandbox).
   c) Nos dois, com o sandbox pessoal sem jogadores.

**D2 — Como cumprir a Regra de Ouro sem servidor?**
   a) **Separação por documento** (recomendado, sem infra nova): o segredo nunca entra num documento
      que o jogador consegue ler. Coleções irmãs `nodes` (público, com `state`) e `nodes_gm`
      (só mestre); rule nega leitura enquanto `state=='hidden'`; arestas secretas **não existem** na
      coleção pública até serem reveladas. Segue o padrão já usado em `users/{uid}/assets`
      (`firestore.rules:29-31`: *"jogadores nunca leem daqui"*).
      Contrapartida a decidir: **quem executa a cascata de revelação** — o cliente do mestre (exige
      mestre online, natural numa sessão ao vivo) ou escrita do jogador validada por rules.
   b) **Cloud Functions** — exige migrar para o plano **Blaze** (custo).
   c) **Vercel Functions** — `api/_lib.js` já sabe verificar ID token, mas a leitura passaria a ser
      HTTP enquanto o tempo real continua no Firestore, o que **reabre o vazamento**.

**D3 — Ilustração de fundo**: manter base64 no Firestore (teto ~900 KB, resolução modesta) ou
adotar **Firebase Storage** (nova superfície de rules e billing)? Mapas-múndi costumam ser grandes.

**D4 — Extrair antes de construir?** `rollDice`/`rollOP` para `src/domain/dice.js` e a câmera do
editor para um hook. São pré-requisitos de C3 e da seção 9. Faz parte desta entrega ou vira spec
separada (0002 já existe no backlog)?

**D5 — Escala do render**: DOM+SVG aguenta o mapa-múndi previsto, ou já nasce em canvas?
Depende de quantos nós um mapa terá. Se for dezenas, DOM serve; centenas, não.

### O que NÃO pode ser contradito (decisões já registradas)

- **0007 AC-2**: o jogador não tem painel de cenas nem de camadas.
- **0009 (ADR-0006)**: cenas vivem em `campaigns/{id}/map/{sceneId}` com ponteiro `map/state`.
  Não inventar coleção nova para cena.
- **0012 AC-5**: "ver como o jogador vê" já resolvido — reusar `asViewer`, não criar segundo
  mecanismo.
- `MapEditor/index.jsx:1533-1540` documenta uma **reversão consciente**: expor controle de
  criar/apagar ao jogador foi implementado e revertido, porque a escrita não funcionava.
  *"Expor controle que não funciona é pior que não ter controle."*

---

## Próximo passo

Aguardando decisão do Andre em **D1** e **D2** (bloqueantes), e posição sobre D3–D5.
Com elas, escrevo `spec.md` + `design.md` (tier arquitetural — novo bounded context e decisão
difícil de reverter, conforme CLAUDE.md) antes de qualquer código.
