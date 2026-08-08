---
name: tasks-0034
description: Plano de execução da spec 0034 (cenas sonoras da mesa), com o gate executável.
alwaysApply: false
---

# Tasks — Spec 0034 · Cenas Sonoras da mesa

## Gate executável
```
cd nexus-rpg
CI=true npx craco test --watchAll=false --runInBand
CI=true npx craco build
```
Medido nesta leva: **90 suítes / 2222 testes PASS** (26 em `cenas.test.js`), build "ready to be
deployed", zero warning novo. Use `--runInBand`: no modo paralelo, 4 suítes de WorldMap/MasterSuite
falham por poluição entre workers vinda do refactor das specs 0030-0032 — nada a ver com esta.

## Tarefas

| # | Task | Cobre AC | Status |
|---|---|---|---|
| 1 | Levantar o que os MCPs conectados realmente geram (áudio) e registrar o bloqueio | — | feito |
| 2 | `cenas.js` — catálogo das 8 cenas, vínculos, normalização defensiva, consultas | AC-1, AC-4..AC-7 | feito |
| 3 | `__tests__/cenas.test.js` — 26 casos, metade sobre entrada suja | AC-1, AC-4..AC-7 | feito |
| 4 | `CenasSonoras.jsx` — a tira, com modo de edição separado do de tocar | AC-3, AC-4, AC-7 | feito |
| 5 | Ligar no `MusicScreen`: estado, persistência e `tocarCena` (local + YT/Spotify) | AC-2, AC-5 | feito |

## Armadilhas encontradas

- **`globalThis` não passa no ESLint do preset do CRA** (`no-undef`). Um módulo puro que precisa
  de `localStorage` deve resolver o padrão em chamada, com guarda de `typeof window`, e aceitar
  storage injetado — que é o que os testes usam.
- A tira vive **acima** da grade e some quando `selectedPlaylist` está setado. Sem isso ela
  competiria com a navegação do acervo justamente quando o mestre está montando playlist.

## Aberto

- [ ] **Validação do Andre no navegador:** entrar em Trilhas, "Vincular trilhas", ligar duas cenas
      a playlists diferentes, sair do modo de edição e conferir que um clique troca a trilha e que
      o ponto dourado marca a cena que está tocando.
- [ ] **Crossfade** entre cenas (fora de escopo aqui): hoje a troca é seca. Exige mexer no
      `<audio>` do `LocalMusicBar`/`MusicPlayerBar` e decidir a curva de fade.
- [ ] **Sincronizar com os jogadores:** a trilha toca só na máquina do mestre. Levar a cena para a
      campanha (como o mapa-múndi faz) é uma spec própria.
- [ ] **Voz do mestre com MiniMax** (spec 0017): destravada assim que o Andre puser
      `MINIMAX_API_KEY` no ambiente e reiniciar o Claude Code.
