---
name: spec-0040-investigacao-e-interludio
description: Spec 0040 — as abas de Investigação (dossiê do caso, pistas) e Interlúdio (a cena de descanso do livro, com recuperação grampeada ao máximo) dentro da aba Descrição, que vira Dossiê. Puxe ao mexer nessas abas ou no livro-razão de interlúdios.
alwaysApply: false
---

# Spec 0040 — Investigação e Interlúdio

> **Fonte da verdade.** Status: **em implementação**
> Origem: pedido do Andre (2026-08-08) — *"quero que tenha isso no nexus em ordemparanormal, a de
> investigação e interludio… essas abas podem ficar junto lá de descrição"*, a partir das duas
> páginas que a RPGpedia anuncia como "em breve".

## O que a referência tem: dois modais de "em breve"

Nem Investigação nem Interlúdio existem lá. **Não há o que copiar** — só o nome e a intenção:
anotações do caso, e fazer/revisar as ações do agente durante um Interlúdio. O resto sai do livro
e do que este repo já tem.

## O que já temos, e que decide o desenho

1. **As 7 regras de interlúdio JÁ ESTÃO transcritas** em
   `src/data/ordemParanormal/regras-oficiais.json` (`secao: "interludio"`): a cena em si e as seis
   ações — Dormir, Relaxar, Alimentar-se, Ler, Revisar o Caso, Consertar. **A aba lê de lá**, não
   duplica texto de regra.
2. **Os valores de recuperação NÃO estão no repo.** As entradas dizem literalmente
   `(Resumo — valores no livro.)`. Então **a aba não inventa número**: quem informa o quanto
   recuperou é o jogador/mestre, e o app aplica **grampeando ao máximo** — que é a parte da regra
   que nós temos por escrito (`interludio-geral`: *"Nenhuma recuperação ultrapassa o máximo do
   personagem"*).
3. **A barra de abas quebra com seis.** O `STATE` registra o conserto
   (`fix(ficha): abas somem quando são seis`). Duas abas novas no topo dariam **oito** e
   reintroduziriam o defeito. É por isso que a sugestão do Andre — juntar com Descrição — é o
   desenho certo, não um atalho: a aba `descricao` vira **Dossiê**, com três sub-abas
   (**Agente** · **Investigação** · **Interlúdio**) na gramática de pílula deslizante do app.
4. **`RichTextEditor` + `sanitizarHtml`** já existem e são obrigatórios em texto rico — a ficha é
   lida por visitante sem login na visão pública (XSS armazenado, fechado na spec 0036).

## Problema

**Investigação.** A aba Descrição cobre o *personagem* (aparência, personalidade, histórico). Não
existe lugar para o **caso**: as pistas que a mesa levantou, de onde vieram e quais já foram
descartadas. Hoje isso vira uma bola de texto em "Anotações" — e uma pista descartada fica
indistinguível de uma pista viva, que é justamente a confusão que trava investigação na mesa.

**Interlúdio.** É uma cena com regra própria no livro, e a ficha não a conhece. O jogador recupera
PV/SAN/PE editando as barras à mão, sem registro de qual ação de interlúdio gerou aquilo. Duas
consequências: não há como revisar o que o agente fez entre as missões (o pedido explícito:
*"fazer e revisar as ações"*), e nada impede a recuperação de passar do máximo.

## Fora de escopo (vinculante)

- **Transcrever os valores de recuperação do livro.** É conteúdo, exige o PDF e paráfrase
  cuidadosa — spec própria. Até lá o campo é do jogador e o clamp é nosso.
- **Notas do Mestre.** Segue proibida pelo motivo já escrito no `DescricaoTab`: a ficha da mesa é
  legível por qualquer membro da campanha pela regra do Firestore. Exige documento separado + ADR.
- **Ligar pista a nó do mapa-múndi ou a ficha de PNJ.** Acoplamento novo entre agregados; ADR antes.
- **Sétima e oitava aba no topo.** Ver o item 3 acima.

## Critérios de aceite

### AC-1: A aba Descrição virou Dossiê, sem aba nova no topo
- **Dado** a ficha de Ordem Paranormal
- **Quando** as abas do topo são contadas
- **Então** continuam **seis**
- **E** a aba de descrição hospeda três sub-abas: Agente, Investigação e Interlúdio
- **E** o conteúdo que existia antes está sob **Agente**, intacto

### AC-2: Pista tem origem e estado
- **Dado** a sub-aba Investigação
- **Quando** o jogador registra uma pista com texto e origem
- **Então** ela entra na lista com estado **aberta**
- **E** pode ir para **confirmada** ou **descartada**
- **E** pista descartada é visivelmente distinta de pista aberta, por algo além de cor
- **E** tudo sobrevive a recarregar a ficha

### AC-3: A contagem conta o que importa
- **Dado** pistas em estados diferentes
- **Quando** a sub-aba é renderizada
- **Então** o cabeçalho mostra quantas estão **abertas**, não o total
- **E** com zero pistas o lugar diz o que fazer, em vez de mostrar "0"

### AC-4: As ações de interlúdio saem do livro, não de mim
- **Dado** a sub-aba Interlúdio
- **Quando** as ações são listadas
- **Então** são exatamente as seis de `regras-oficiais.json` (`secao: "interludio"`, menos a
  entrada da cena em si), com o texto vindo do JSON
- **E** nenhuma descrição de regra é reescrita no componente

### AC-5: Uma ação por interlúdio
- **Dado** o registro de um interlúdio
- **Quando** o jogador escolhe uma ação
- **Então** só uma pode ficar escolhida — trocar substitui, não acumula
- **E** sem ação escolhida não é possível registrar o interlúdio

### AC-6: A recuperação nunca passa do máximo
- **Dado** PV 18/20 e um interlúdio informando +9 de PV
- **Quando** o interlúdio é aplicado
- **Então** o PV vai a 20, não a 27
- **E** o registro guarda o que foi **efetivamente** recuperado (2), não o que foi pedido (9)
- **E** valor negativo ou lixo não vira recuperação

### AC-7: O interlúdio é revisável
- **Dado** interlúdios já aplicados
- **Quando** a sub-aba é renderizada
- **Então** existe um histórico com a ação, o que foi recuperado e a nota de cada um
- **E** o mais recente aparece primeiro

### AC-8: Texto rico não vira vetor de XSS
- **Dado** uma nota de caso contendo `<img src=x onerror=alert(1)>`
- **Quando** ela é exibida
- **Então** o atributo de evento não chega ao DOM — passa por `sanitizarHtml`, como o resto da ficha

### AC-9: A ficha somente-leitura não deixa escrever
- **Dado** a ficha aberta em modo somente-leitura (visão pública)
- **Quando** as sub-abas são renderizadas
- **Então** não há controle de criar pista nem de registrar interlúdio
- **E** o que já existe continua legível
