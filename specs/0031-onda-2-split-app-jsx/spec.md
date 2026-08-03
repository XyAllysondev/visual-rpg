---
name: spec-onda-2-split-app-jsx
description: Contrato da onda 2 — App.jsx deixa de ser monólito e vira orquestrador; componentes vão para src/features/. Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Onda 2: App.jsx deixa de ser monólito

> **Fonte da verdade.** Status: aprovado (Andre, 2026-08-02 — "faça tudo e só pare quando
> terminar todas as fases")

## Resumo

`src/App.jsx` tem **11.4 mil linhas** e **64 componentes de topo** (mais dezenas aninhados).
Eles saem para `src/features/<contexto>/` e `src/ui/`, e o `App.jsx` fica só com providers,
roteamento de tela e a composição dos hooks.

A spec **0002** já tentou isto e parou no meio: reduziu a *função* `App()` para menos de 400
linhas, mas registrou um `SPEC_DEVIATION` assumindo que os componentes inline ficavam fora de
escopo. Esta spec fecha aquela dívida.

## Por que agora

A onda 1 tirou o acesso a dados de dentro do arquivo. O que sobrou é UI — e só agora dá para
mover componente sem arrastar junto um pedaço de Firestore. A ordem importava.

## Critérios de aceite

### AC-1: App.jsx abaixo de 800 linhas
- **Dado** `src/App.jsx` depois da migração
- **Quando** se conta as linhas do arquivo (não só da função `App()`)
- **Então** são **menos de 800** — imports, `Shell`, roteamento de tela e composição de hooks

> O alvo é o ARQUIVO, ao contrário da spec 0002, que só media a função e por isso pôde declarar
> vitória com 11 mil linhas em volta.

### AC-2: Um diretório por contexto, alinhado ao context-map
- **Dado** `src/features/`
- **Então** os diretórios espelham os bounded contexts já documentados —
  `auth/`, `campanha/`, `ficha/`, `dashboard/`, `monetizacao/`, `musica/`, `mapa/`,
  `sistemas/`, `institucional/` — e nenhum nome novo é inventado sem entrar no glossário

### AC-3: O que é reusável vai para `src/ui/`, não para uma feature
- **Dado** componentes de casca sem regra de negócio (logo, ícones, ornamentos, `Sidebar`,
  `Topbar`, `MobileBottomNav`, rodapé)
- **Então** vivem em `src/ui/`, ao lado do `SlidingTabPill` e do `button.jsx` que já estão lá

### AC-4: Nada de estado global novo
- **Dado** a extração
- **Então** ela é feita por **props**, como já é hoje. Nenhum Context, Redux ou store global é
  introduzido — isso é decisão arquitetural própria, não efeito colateral de mover arquivo.
  Se um componente exigir 6+ props repassadas, **registre** e siga; a decisão fica para depois.

### AC-5: Zero mudança de comportamento
- **Dado** qualquer tela
- **Então** o comportamento é idêntico. **As suítes existentes passam sem edição.**
  `npm run build` continua exit 0 e sem warning novo.

### AC-6: Extração em ondas, com gate entre elas
- **Dado** o tamanho do arquivo
- **Então** a migração é feita em **grupos coesos**, com suíte verde + build entre cada um.
  Um grupo só começa com o anterior verde — é o que permite saber qual passo quebrou.

### AC-7: Nenhum código duplicado na saída
- **Dado** helpers de escopo de módulo hoje compartilhados por vários componentes (objetos de
  estilo, constantes, formatadores)
- **Então** eles vão para um módulo compartilhado e são **importados**, nunca copiados.
  Duplicar para "facilitar a extração" é o modo de falha desta spec.

## Casos de borda

- **`Shell` não pode ser declarado dentro de `App()`.** O `STATE.md` registra o motivo: declarar
  lá cria um tipo novo a cada render e **remonta as tags `<style>`**. Mantenha em escopo de módulo.
- As rotas `/p/{charId}` e `/cast/{campaignId}` fazem *early-return* **antes** do gate da intro.
  Essa ordem é deliberada (senão a janela de transmissão toca a animação de abertura). Preserve.
- Componentes carregados com `React.lazy` (fichas OP/D&D, TokenBuilder, Mesa do mapa-múndi)
  continuam lazy — mover não pode transformar em import estático, ou o bundle inicial cresce.

## Fora de escopo

- Reescrever componente, mudar visual, ou trocar inline styles por Tailwind (ADR-0004/0007).
- Introduzir TypeScript ou Context API.
- Migrar CRA → Vite (dívida registrada no ADR-0007).
- Quebrar componentes grandes em menores. Mover primeiro; dividir é outra decisão.
- Validação de schema e os quirks herdados — onda 3.

## Rastreabilidade

- Antecessora: [../0002-split-app-jsx/spec.md](../0002-split-app-jsx/spec.md) (fecha o SPEC_DEVIATION dela)
- Depende de: [../0029-camada-de-infraestrutura/spec.md](../0029-camada-de-infraestrutura/spec.md) e [../0030-onda-1-5-stores-legados/spec.md](../0030-onda-1-5-stores-legados/spec.md)
- Context map: [../../docs/architecture/context-map.md](../../docs/architecture/context-map.md)
