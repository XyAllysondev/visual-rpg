---
name: spec-mapa-mundi
description: Contrato do Mapa-Múndi com exploração e névoa — ateliê do mestre na aba Mapas, mesa na campanha, revelação progressiva, segredo garantido por separação de documento.
alwaysApply: true
---

# Spec — Mapa-Múndi com Exploração e Névoa

> **Fonte da verdade.** Tier **arquitetural** — novo bounded context (*Mundo Explorável*), decisão
> difícil de reverter. Ver [F0-descoberta.md](./F0-descoberta.md) e [design.md](./design.md).
> Referência de mecânica: mapa-múndi de *Pathfinder: Wrath of the Righteous*.

## Resumo

O mestre constrói mapas-múndi no **Ateliê** (aba Mapas, privado) e os leva para a **Mesa**
(campanha), onde o grupo explora: o mapa se desenha conforme o grupo viaja, a névoa recua, e
eventos escondidos disparam. O mestre orquestra; os jogadores veem e participam.

## Linguagem ubíqua

| Termo | Significado |
|---|---|
| **Molde** | O mapa-múndi autoral, em `users/{uid}/worldmaps/{mapId}`. Privado do mestre. |
| **Instância** | O molde levado a uma campanha. Guarda o progresso daquele grupo. |
| **Nó** | Um local no mapa (cidade, masmorra, acampamento, ponto de interesse…). |
| **Trilha** | Aresta entre dois nós, com custo de viagem em horas. |
| **Revelação** | Ato de tornar um nó/trilha/evento visível ao grupo. Nunca regride sozinha. |
| **Ateliê** | A aba Mapas. Onde se constrói. Sem jogadores. |
| **Mesa** | A campanha. Onde se joga. Com jogadores e tempo real. |

## Critérios de aceite

### AC-1: Segredo é estrutural, não visual `[F1–F4]`
- **Dado** um jogador autenticado, membro da campanha, com DevTools aberto
- **Então** ele **não consegue obter** nome, posição, descrição ou notas de nó `hidden`, de trilha
  secreta, nem o texto de mestre de evento não disparado — **inspecionando o tráfego de rede real**
- **Porque** esses dados vivem em `users/{uid}/worldmaps/**`, que as rules negam a qualquer outro
  uid; a campanha só recebe documentos criados **no ato da revelação**
- **E** `gmNotes`/`gmText` nunca são copiados para a projeção pública — o campo não existe no payload
- **Gate:** teste de rules (deny) + verificação manual de payload no DevTools

### AC-2: O Ateliê é o lugar do mestre `[F1]`
- **Dado** um mestre na aba **Mapas**
- **Então** vê três sub-abas: **Mesas Táticas**, **Mapas-Múndi** e **Tokens**
- **E** o editor tático e o construtor de tokens continuam funcionando **sem regressão**
- **Quando** entra em Mapas-Múndi, lista seus moldes, cria, renomeia e exclui
- **E** sobe a ilustração de fundo, persistida em **base64 no Firestore**, num documento separado
  do doc do mapa (a lista não trafega a imagem inteira), com downscale em dois estágios e recusa
  explícita quando não couber
  > **Mudança consciente de contrato (2026-08-01).** A spec dizia Firebase Storage. O bucket **não
  > existe** e criá-lo exige plano Blaze (ADR-0008, provado por HTTP 404). Decisão do Andre: *"vamos
  > fazer no gratuito hoje, quando estivermos finalizando o desenvolvimento eu faço isso"*. O
  > caminho do Storage permanece implementado atrás de `fundoDisponivel()`; quando o plano subir,
  > este AC volta a ser Storage e o dado migra.
- **Gate:** `worldMapStore.test.js` + smoke de render + as 8 suítes do MapEditor verdes

### AC-3: Cota por plano `[F1]`
- **Dado** um mestre no plano **free**
- **Então** pode ter **1 mapa-múndi** com no máximo **25 nós**
- **Dado** um mestre no plano **pago**
- **Então** pode ter mapas ilimitados com até **500 nós** cada
- **E** ao atingir o limite, a interface explica o limite e o caminho, sem falhar em silêncio
- **Gate:** `quotas.test.js` (lógica pura) + rules recusando além do teto

### AC-13: Mapa padrão pronto para usar `[F2]`
- **Dado** um mestre que abre **Mapas-Múndi** pela primeira vez
- **Então** já existe **um mapa padrão** disponível, com ilustração e um grafo autoral pronto
  (nós e trilhas), utilizável na hora — sem precisar desenhar nem subir arte
- **E** ele pode **criar o seu próprio** mapa a qualquer momento, ou trocar a ilustração do padrão
- **E** o mapa padrão **não consome a cota** do plano free (senão o mestre free ficaria sem poder
  criar o dele — a cota é 1 mapa)
- **E** o padrão é **cópia ao usar**: mexer nele não altera o original, e sempre dá para recomeçar
- **E** o mestre pode **excluir o mapa padrão** da sua lista, como excluiria qualquer outro — a
  oferta do sistema não pode ser imposta
  > **Como, sem virar dado:** o padrão continua sendo código (não consome cota, não pesa no
  > Firestore). "Excluir" grava uma marca de dispensa **no perfil do mestre**, e a lista deixa de
  > oferecê-lo. Não é exclusão de verdade porque não há o que apagar.
- **E** a exclusão **não é porta de mão única**: existe um caminho visível para trazer o padrão de
  volta (no estado vazio da lista e/ou nas opções), porque descartar por engano não pode custar o
  conteúdo para sempre
- **E** a marca de dispensa é **por mestre**, não global — um mestre descartar não afeta os outros
- **E** a ilustração do padrão é **vetorial embutida no app** (SVG), não dado de usuário: não pesa
  no Firestore, não tem o teto de 900 KB e fica nítida em qualquer zoom
- **Gate:** `mapaPadrao.test.js` — o seed tem ≥8 nós e ≥8 trilhas, nenhuma trilha aponta para nó
  inexistente, nenhuma autoligação, e ≥1 trilha secreta (para exercitar a mecânica da F4);
  mais: dispensar esconde o padrão da lista, restaurar o traz de volta, e a marca **não** conta
  como mapa na cota

### AC-4: Grafo — nós e trilhas `[F2]`
- **Dado** um molde aberto no ateliê
- **Então** o mestre planta nós clicando, move arrastando, e edita nome, tipo, ícone, rumor,
  descrição pública, notas do mestre, cena vinculada e raio de revelação
- **E** cria trilhas ligando dois nós, curva-as por pontos de controle, e define horas de viagem,
  secreta (sim/não), teste de descoberta (perícia + CD), nível de perigo e mão única
- **Gate:** `graph.test.js` (lógica pura de grafo) + smoke de interação

### AC-5: Névoa `[F3]`
- **Dado** um mapa com névoa ligada
- **Então** a máscara é **bitmap** revelado por círculo com borda suave
- **E** é persistida **comprimida no Firestore**, em documento próprio: só o canal alfa, 1 bit por
  pixel, com downscale de 4× e codificação por repetição (RLE). Num mapa de 3000×2000 isso vira
  750×500 = 46 KB crus, e névoa real (áreas contíguas) comprime muito abaixo disso — cabe folgado
  no teto de 1 MB do Firestore, sem depender do Storage.
  > **Por que não Storage:** o bucket não existe e exige Blaze (ADR-0008). E aqui a máscara muda o
  > tempo todo durante a viagem — reescrever documento grande a cada passo seria insustentável de
  > qualquer forma. Daí o AC-10 exigir **deltas** no tempo real e flush consolidado. Quando o Blaze
  > entrar, o bitmap cru pode migrar para lá; a compressão continua valendo.
- **E** o mestre a vê a ~15% de opacidade (enxerga o oculto sem perder a noção do que está oculto);
  o jogador vê opaca no nunca visto e ~45% no já revelado onde não está agora
- **E** o mestre pinta e apaga névoa à mão, com pincel de tamanho ajustável
- **Gate:** `fogMask.test.js` (lógica pura de máscara) + verificação visual

### AC-6: A regra que define o produto `[F4]`
- **Dado** o grupo chegando a um nó
- **Então** o nó vira `visited`, a névoa abre no raio dele
- **E** cada trilha **não secreta** ligada a ele vira `revealed`, e o nó do outro lado vira
  `discovered` — **e nada além disso**
- **E** trilha **secreta** permanece invisível até teste bem-sucedido, gatilho ou revelação manual
- **E** estado **nunca regride** automaticamente (`max` na ordem dos enums); só o mestre rebaixa
- **Gate:** `aoChegarEm` é função pura com teste exaustivo — **escrita antes da implementação**

### AC-7: Ateliê → Mesa `[F4]`
- **Quando** o mestre leva um molde para uma campanha
- **Então** nasce uma instância com o grupo no nó inicial, névoa fechada e nenhuma revelação
- **E** o mesmo molde levado a duas campanhas gera **dois progressos independentes**
- **E** sincronizar o molde depois **só acrescenta**: o que já foi revelado não regride
- **E** apagar o molde **não quebra** a mesa — o revelado é cópia, não referência
- **Gate:** `instancia.test.js`

### AC-8: Mestre orquestra, jogador participa `[F4, F6]`
- **Dado** a mesa aberta
- **Então** o mestre tem: posição do grupo, **Revelar agora**, fila de eventos, e o alternador
  **Visão do Mestre / Visão do Jogador** (reusando `asViewer` da spec 0012)
- **E** o jogador clica em nó adjacente por trilha revelada para viajar; nó descoberto mas não
  conectado **não é clicável**
- **E** todo **encontro aleatório** é apresentado **primeiro ao mestre**, que aceita, troca ou
  ignora antes de o jogador ver qualquer coisa
- **E** o jogador **não** tem painel de cenas nem de camadas (coerente com a spec 0007 AC-2)
- **Gate:** `encontros.test.js` (função pura) + smoke dos dois papéis

### AC-9: Testes de descoberta reusam o motor existente `[F5]`
- **Dado** o grupo num nó com trilha secreta que tenha teste
- **Então** a rolagem usa o motor de dados **já existente** do projeto — nenhum motor paralelo
- **E** a falha **não revela a existência da trilha** ("você não encontra nada", nunca "você falhou
  em achar a passagem secreta")
- **Gate:** `dice.test.js` no módulo extraído + `descoberta.test.js`

### AC-10: Persistência e tempo real `[F4, F7]`
- **Dado** um recarregamento da página
- **Então** névoa, posição, relógio, suprimentos e eventos disparados são preservados
- **E** revelações e movimento do grupo chegam aos outros clientes em tempo real
- **E** a névoa trafega em **deltas**, com flush consolidado — nunca o bitmap inteiro a cada passo
- **Gate:** verificação E2E com dois navegadores

### AC-11: O mapa respira `[F3, F7]`
- **Então** existem cinco movimentos: deriva da névoa, revelação (~600 ms ease-out), respiro do nó
  `rumored`, flutuação/percurso do marcador do grupo, e tinta de hora do dia vinda do relógio
- **E** `prefers-reduced-motion` corta a deriva, o respiro e a tinta, e troca a revelação por corte seco
- **E** nada anima fora do viewport, nem enquanto o mestre edita no ateliê
- **Gate:** revisão de acessibilidade + verificação visual

### AC-12: Nada do que existe regride `[todas]`
- **Então** o editor tático de cenas continua funcionando sem regressão
- **E** o mapa-múndi é **componente irmão** (`src/components/WorldMap/`), não uma segunda
  modalidade dentro do `MapEditor`
- **Gate:** as 8 suítes do MapEditor + build verdes em toda fase

## Fora de escopo

- Exploração assíncrona (sem o mestre online). A revelação depende do cliente do mestre — decisão
  consciente do design §3. Mudar isso exige servidor e plano Blaze.
- Substituir a névoa vetorial do editor tático. O bitmap é só do mapa-múndi.
- Migrar as imagens do resto do app para Storage. A adoção é escopada ao fundo do mapa-múndi, e
  está **adiada** até o Andre subir para o plano Blaze (ADR-0008).
- Migração dos fundos já gravados em base64 para o Storage. Entra junto com a subida de plano.

## Faseamento

| Fase | Entrega | Status |
|---|---|---|
| F0 | Descoberta | ✅ |
| F1 | Ateliê: sub-abas + CRUD do molde + upload do fundo + cotas | ✅ |
| F2 | Render do grafo + editor de nós e trilhas + mapa padrão | ✅ |
| F3 | Névoa bitmap + pincel + toggle de visão + deriva + dispensar o padrão | ✅ |
| F4 | Levar para a mesa + máquina de estados + viagem + revelação | ✅ |
| F5 | Eventos, gatilhos, testes de descoberta (+ `domain/dice.js` extraído) | ✅ |
| F6 | Tempo, suprimentos, encontros, acampamento | ✅ |
| **F7** | Tempo real com deltas + as 5 animações + polimento | **próxima** |

## Verificação

```bash
npx craco test --watchAll=false
npx craco build
```
