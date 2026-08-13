---
name: quick-task-007-arquivo-e-casco
description: Quick task 007 — a onda visual fora da ficha: listagem de agentes vira arquivo de pastas (aba com o nº de processo do dossiê) e a topbar vira chapa. Pedido "força total" do Andre, parte 2.
alwaysApply: false
---

# Quick Task — 007-arquivo-e-casco

**Data:** 2026-08-08 · **Pedido:** Andre — *"não percebi mudança aqui e em outros lugares"*,
olhando o Painel depois da quick 006. **Tier:** trivial (3 arquivos, apresentação pura).

## Diagnóstico

A 006 concentrou tudo dentro da ficha — correto pela 0035 ("só a ficha primeiro"), mas
invisível de fora. As telas restantes já carregam a pele heráldica desde 004/005, que é a
LINHA DE BASE do Andre: para ele sentir mudança, tinha que mexer no que se vê primeiro.
Duas alavancas:

1. **Listagem de agentes → arquivo de pastas.** Cada card ganhou aba de pasta de arquivo
   com o **mesmo nº de processo que o dossiê mostra por dentro** (mesma `numeroDeProcesso`
   sobre o mesmo id). A estante e o documento se reconhecem — é continuidade de história,
   não decoração. Raio de canto 14→4 (pasta é austera), sombra de papel da 006.
2. **Topbar → chapa.** Era o único pedaço do casco sem material: `--surface` chapado com
   filete. Ganhou bisel, sopro de ametista e o gume ametista→ouro embaixo — o mesmo
   gradiente do gume da sidebar, para o casco ler como UMA peça forjada.

## Onde vive

- `themes/heraldica.jsx` — `.h-topbar` (seção 7) e `.h-pasta`/`.h-pasta-aba` (seção 12,
  ornamento REUSÁVEL: token puro, em D&D vira ferro-e-brasa sozinho).
- `App.jsx` — classe na topbar, wrapper `.h-pasta` + aba nos cards, import de
  `numeroDeProcesso`. Nenhuma cor nova em JSX.

## Fora de escopo (consciente)

Mapas, Forja, Trilhas, Campanhas (tela cheia), seleção de sistema e o Painel (que já tem
folha própria rica). Se o Andre quiser a onda nessas, é a próxima quick — tela a tela.

## Gate

crase ✓ · suíte **2146 verdes** + herdada do `creature.test.js` · tela conferida
(screenshot: abas com números distintos por ficha, mesmos números dos dossiês).

## Teste de aceite executado (2026-08-10) — 21/22

Driver headless (`scratchpad/teste.js`) percorreu o roteiro inteiro e ASSERTOU, não só
fotografou: topbar com 3 camadas de gradiente + gume; 2 abas de pasta com processos
DISTINTOS no formato `OP-NNNN-L/AA` em Courier Prime; **o número da aba idêntico ao da folha
de rosto do dossiê** (`OP-5521-A/49` = `OP-5521-A/49` — a prova de que estante e documento
são o mesmo processo); 2 furos; tarja; censura; carimbo ATIVO; marca d'água; `border-bottom:
double` no cabeçalho de perícias; réguas `solid` entre colunas; `tabular-nums` computado;
`ABERTO EM` = `02/08/26` do `createdAt` real; e o upload de retrato aplicando moldura de 3px
em `rgb(237,231,246)` (`--text`), cantos de álbum por cima e o estado "não anexada" sumindo.

**O único FAIL é alheio ao visual:** enviar o retrato dispara
`publicSheetsRepo.remove` (App.jsx — `handleSheetUpdate` chama em TODO save de ficha não
pública) e o Firestore devolve `Missing or insufficient permissions` no console. É lacuna do
MODO DEMO (quick 003), que falsifica os dados mas não os repos de escrita — o STATE já
registrava o buraco para a Forja e as mesas; agora se sabe que **a própria ficha escreve**.
Pré-existente, não regressão: nada nas quicks 006/007 toca repositório.

## Observação de material que a foto revelou

O vinco do `.op-ink::after` atravessa TAMBÉM a fotografia colada. Uma foto presa por cantos
não teria a dobra do papel de arquivo passando por dentro dela. É sutil e não reprova nada,
mas se um dia o retrato ganhar tratamento próprio, o vinco deve parar na borda da foto.

## Armadilha registrada

O wrapper da pasta exige **dois** fechamentos no fim do card do map — o diagnóstico do IDE
acusou desequilíbrio no meio da edição e assustou; o juiz é o webpack do dev server
("compiled with 1 warning" = os avisos pré-existentes).
