---
name: spec-0036-parar-de-sangrar
description: Spec 0036 — tirar do ar o que está quebrado ou mentindo em produção. Puxe ao mexer em rodapé, Topbar, planos, roteamento, roadmap público ou limite de fichas.
alwaysApply: false
---

# Spec 0036 — Parar de sangrar

> **Fonte da verdade.** Status: **em implementação**
> Origem: dossiê de auditoria de 2026-08-05 (`playnexusrpg.com`), Nível 0 + N1·04, mais cinco
> achados da mesma classe encontrados na reverificação de 2026-08-06.

## Problema

O produto tem profundidade de regra melhor que qualquer concorrente brasileiro e **mente ao
usuário em quatorze superfícies diferentes**. Botão que não faz nada, plano que vende sistema
fechado, mural de notícias de outro produto, "✦ Plano Pro" para quem é gratuito, convite de
Discord morto, roadmap que nega o que já foi entregue.

Nada aqui é funcionalidade nova. É dívida de honestidade — e ela custa credibilidade a cada
visita. **É pré-requisito de qualquer campanha de aquisição:** não adianta trazer gente para uma
casa nesse estado, nem medir uma campanha sem analytics.

## Princípio que rege esta spec

**Apagar a promessa é melhor do que fingi-la.** Sempre que um controle não tem destino real, a
saída certa é removê-lo, não inventar um destino plausível. Botão que não responde é o sinal mais
rápido de produto abandonado — e um destino inventado é o segundo mais rápido.

Corolário: **nenhum endereço externo entra literal no meio de um componente.** Tudo que aponta
para fora do app (Discord, e-mail de suporte, licença) mora em `src/lib/links.js`, para que trocar
seja uma linha e para que ninguém precise caçar duplicata quando o convite expirar de novo.

## Critérios de aceite

### AC-1: Nenhum controle morto no rodapé
- **Dado** qualquer tela interna do app
- **Quando** o rodapé é renderizado
- **Então** todo item com aparência clicável (cursor, hover) tem destino real — `href`, `onClick`
  ou navegação — e nenhum é `<span>` decorativo

### AC-2: Um endereço externo, um lugar
- **Dado** o código-fonte
- **Quando** se procura por `discord.gg`, `discord.com/invite` ou por um `mailto:`
- **Então** a única ocorrência literal está em `src/lib/links.js`; todo consumidor importa de lá

### AC-3: O roadmap público não nega o que foi entregue
- **Dado** `src/roadmapData.js`
- **Quando** um item aparece como `planned` ou `backlog`
- **Então** não existe spec entregue que o implemente — e o teste trava a lista de itens já
  entregues contra o status exibido

### AC-4: Um limite de fichas, uma fonte
- **Dado** um usuário no plano gratuito
- **Quando** o Painel e a tela de Fichas mostram a cota
- **Então** os dois mostram o MESMO número, e esse número é o que de fato bloqueia a criação

### AC-5: O plano exibido é o plano que a pessoa tem
- **Dado** um usuário sem plano pago
- **Quando** ele abre o menu do avatar
- **Então** não lê "Plano Pro" — lê o plano real, e o rótulo vem da mesma fonte que aplica o teto

### AC-6: Nenhuma cópia vende o que não existe
- **Dado** qualquer tela de preço, upgrade ou configuração
- **Quando** o texto promete um recurso
- **Então** o recurso existe e está acessível — sem "IA sem restrições" (removida na 0027), sem
  "fichas ilimitadas" (o teto é 5), sem "Higgsfield" (não integrado)

### AC-7: Links colados funcionam
- **Dado** um endereço do app colado na barra do navegador (`/campanhas`, `/planos`, `/p/{id}`)
- **Quando** a página monta
- **Então** a tela exibida é a do endereço, e o endereço não é reescrito

### AC-8: O código-fonte não vai para produção
- **Dado** um build de produção
- **Quando** se pede `main.*.js.map`
- **Então** o arquivo não existe

### AC-9: Toda tela é alcançável no celular
- **Dado** um viewport de 390px
- **Quando** a barra inferior é renderizada
- **Então** nenhum item fica cortado e existe caminho para todas as telas do menu

## Fora de escopo
> Vinculante.
- **Cobrança.** As páginas do Catarse devolvem 404 e `api/payment-webhook.js:114` recusa ativar
  plano por Catarse; `createPixPayment` não tem call site. **Não existe caminho compra → ativação
  no produto.** Isso é maior que uma spec de honestidade e vira spec própria — aqui só se garante
  que nenhuma tela prometa o que o checkout não entrega (AC-6).
- **Home pública, compêndio indexável, Open Graph** — Fase 2 do plano de 90 dias, spec própria.
- **`src/components/MapEditor/`** — intocado.
