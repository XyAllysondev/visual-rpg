---
name: spec-0034
description: Contrato das Cenas Sonoras — trocar a trilha da mesa por tipo de cena de Ordem Paranormal em um clique.
alwaysApply: true
---

# Spec 0034 — Cenas Sonoras da mesa

> **Fonte da verdade.** Status: implementado

## Resumo
A tela de Trilhas Sonoras ganha uma tira de **oito cenas de Ordem Paranormal**; cada uma fica
vinculada a uma playlist que o mestre já montou, e um clique troca a trilha durante a narração.

## Por que não foi gerado áudio com IA
O Andre pediu trilhas e efeitos sonoros gerados. **Não é possível hoje**, e a spec registra o
motivo para ninguém tentar de novo sem checar:
- **Higgsfield** — a ferramenta de áudio só gera fala e instrui explicitamente a **recusar**
  pedidos de música/efeito sonoro; os modelos `sonilo_music` e `mirelo_text_to_audio` são
  exclusivos do pipeline de geração de jogos.
- **Morpfix** — só TTS da ElevenLabs.
- **MiniMax** (registrado em `.mcp.json`, aguardando chave + restart) — `music_generation` exige
  **letra obrigatória** (é gerador de canção, não de ambiência) e **não tem ferramenta de efeito
  sonoro** nenhuma. Serve para **voz**, que é a spec 0017.
- **Produto** — a tela é um agregador: toca playlists do YouTube/Spotify do mestre e MP3 dele no
  IndexedDB local, que por decisão registrada em `src/features/musica/audioDb.js` nunca sobem ao
  Firestore. Não há onde publicar um acervo gerado.

## Critérios de aceite

### AC-1: as oito cenas existem e usam o vocabulário do livro
- **Dado** o catálogo de cenas
- **Então** há 8 cenas com id único, e os momentos que o livro nomeia mecanicamente aparecem com
  o nome dele: investigação, combate (cena de ação), interlúdio, ritual e o Outro Lado

### AC-2: um clique troca a trilha
- **Dado** uma cena vinculada a uma playlist existente, e a mesa rodando
- **Quando** o mestre clica na cena
- **Então** a playlist entra em reprodução sem navegar para outra tela
- **E** funciona para playlist local (imediato) e para YouTube/Spotify (busca as faixas antes)

### AC-3: tocar e configurar são modos separados
- **Dado** a tira fora do modo de edição
- **Quando** o mestre clica em qualquer cena
- **Então** o clique **só toca** — nada é revinculado ou apagado
- **E** só depois de acionar "Vincular trilhas" os seletores aparecem

### AC-4: vínculo órfão avisa em vez de sumir
- **Dado** uma cena vinculada a uma playlist que foi apagada depois
- **Quando** a tira é montada
- **Então** a cena continua listada, marcada indisponível, mostrando qual playlist se perdeu

### AC-5: a mesma playlist pode servir a várias cenas
- **Dado** uma playlist de ambiência
- **Quando** o mestre a vincula a Tensão e a Terror
- **Então** as duas cenas ficam vinculadas a ela

### AC-6: dado sujo no localStorage não derruba a tela
- **Dado** `nx_cenas_op` com JSON inválido, cena inexistente, serviço desconhecido ou id vazio
- **Quando** os vínculos são lidos
- **Então** o que não é utilizável é descartado em silêncio e o resto funciona
- **E** um `setItem` que estoura cota não lança para a interface

### AC-7: cena sem trilha continua visível
- **Dado** uma cena nunca vinculada
- **Então** ela aparece na tira, apagada, com "sem trilha" — sumindo, ninguém descobre que existe

### AC-8: efeito dispara POR CIMA da trilha
- **Dado** uma trilha tocando e a Mesa de Efeitos com botões
- **Quando** o mestre aciona um efeito
- **Então** o som soa sem pausar nem trocar a música
- **E** dois efeitos acionados juntos soam juntos, um não corta o outro
- **E** "Parar tudo" (ou Esc) corta os efeitos sem encostar na trilha

### AC-9: a mesa serve com a sessão rodando
- **Dado** a Mesa fora do modo de edição
- **Quando** o mestre pressiona as teclas 1 a 9
- **Então** os nove primeiros efeitos disparam
- **E** as teclas ficam inertes enquanto se digita em campo de texto e no modo de edição

### AC-10: pacote inicial de vozes num clique
- **Dado** uma mesa sem as vozes que o app serve em `public/sfx/`
- **Quando** o mestre aciona "Carregar vozes"
- **Então** as oito falas entram no IndexedDB dele e viram botões comuns
  (renomeáveis, com volume próprio, apagáveis)
- **E** acionar de novo não duplica nada (id fixo `pk_*`)

### AC-11: volume por efeito e arquivo compartilhado
- **Dado** dois efeitos apontando para o mesmo arquivo
- **Quando** o mestre ajusta o volume de um
- **Então** o outro não muda
- **E** remover um NÃO apaga o binário enquanto o outro ainda o usa

## Casos de borda
- Nenhuma playlist no acervo → o modo de edição explica como importar/conectar
- Token do YouTube/Spotify expirado → mensagem pedindo reconexão, sem quebrar a reprodução atual
- Playlist vinculada vazia → avisa em vez de entrar em reprodução silenciosa
- Ids iguais em serviços diferentes → `cenaTocando` compara serviço **e** id
- Mestre dentro de uma playlist (`selectedPlaylist`) → a tira some para não competir com a navegação

## Fora de escopo
> Vinculante.
- Gerar áudio com IA (ver a seção acima)
- Crossfade entre cenas — exige mexer no `<audio>` do player; fica para uma leva própria
- Vincular cena a **faixa** solta (só playlist)
- Sincronizar a cena com os jogadores: hoje a trilha toca só na máquina do mestre
- Cenas por sistema: o catálogo é de Ordem Paranormal, não há variação para D&D/Tormenta

## Rastreabilidade
- Lógica pura: `src/features/musica/cenas.js`
- Interface: `src/features/musica/CenasSonoras.jsx`
- Ligação: `src/features/musica/MusicScreen.jsx`
- Gate executável: `src/features/musica/__tests__/cenas.test.js`
