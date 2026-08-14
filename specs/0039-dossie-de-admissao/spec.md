---
name: spec-0039-dossie-de-admissao
description: Spec 0039 — a criação de agente passa a se ler como um documento da Ordo Realitas, na linguagem visual que o Nexus já tem (grafite + ouro corrompido, Cinzel, IBM Plex Mono). Puxe ao mexer no CharacterCreator, no StepBar ou na moldura de documento.
alwaysApply: false
---

# Spec 0039 — O dossiê de admissão

> **Fonte da verdade.** Status: **em implementação**
> Origem: item 7 do Tier A do teardown da RPGpedia, o único que sobrou depois da spec 0038.
> **Decisão do Andre (2026-08-08):** *"em relação a arte, eu quero que você adapte para o visual do
> nexus hoje"*. Portanto **não** se copia o visual da referência — copia-se a **estrutura**.

## O que se copia e o que não se copia

A referência resolve a criação de personagem como um **documento oficial sendo preenchido**. Essa
ideia é boa e é o que entra. O acabamento dela — papel amassado beige sobre mesa de madeira,
datilografia, polaroides, abas de pasta suspensa — **não entra**, porque o Nexus já tem identidade
própria e trocá-la por outra seria regressão de marca, não melhoria.

**A tradução, token por token,** usando o que `themes/index.js` e `ordemStyles.jsx` já definem:

| Ideia da referência | Como o Nexus a diz |
|---|---|
| Papel amassado beige | superfície grafite (`--card`) com o grão que a ficha já usa (`op-grain`) |
| Mesa de madeira escura | o fundo do app (`--bg`, `#14141c`) — sem cenário novo |
| Datilografia (Courier) | `IBM Plex Mono` (a fonte `data` do tema) nos metadados do documento |
| Título em serifa larga | `Cinzel` / `Cinzel Decorative` (as fontes `title`/`display`) |
| Filete de tinta preta | filete dourado (`--border2`, ouro corrompido a 34%) |
| Linha pontilhada de preencher | mesma linha pontilhada, em ouro |
| Selo/brasão | o `ElementoSymbol` e o `NexusLogo` que já existem |
| Cor do texto do documento | `--text` (`#e8e4d9`) — o tema já a chama "aged paper" |

Nenhuma fonte nova, nenhuma textura nova, nenhum asset novo. É por isso que esta spec é de
implementação e não de aquisição de arte.

## Problema

O criador de personagem é **uma coluna de formulários com um cabeçalho**. Ele produz uma ficha de
agente de uma organização secreta e não se parece com nada disso: os passos são rótulos
sublinhados (`StepBar`), cada passo é um bloco de campos, e nada na tela diz que aquilo é um
documento sendo emitido.

Três consequências:

1. **O momento mais importante do personagem não tem peso.** Distribuir atributos e escolher
   classe decidem a campanha inteira do jogador, e a tela tem o mesmo peso visual de um formulário
   de cadastro.
2. **Não existe página de admissão.** O jogador cai direto em "Distribua seus Atributos" sem
   nenhum enquadramento de ficção. A referência abre com um termo de boas-vindas da organização, e
   é ele que transforma "preencher formulário" em "ser recrutado".
3. **O `StepBar` está fora da gramática do próprio app.** O Nexus já tem indicador deslizante
   (`useSlidingPill`, spec 0022) usado nas abas da ficha e da mesa; o criador usa sublinhado
   estático, que é a única barra de passos do app que não fala a língua das outras.

## Princípio que rege esta spec

**Moldura, não cenário.** O que entra é a *casca de documento* em volta do conteúdo que já existe —
cabeçalho de emissão, filete, número de registro, tipografia de documento. Não entra ilustração de
mesa, de papel rasgado ou de objeto físico. Cenário desenhado é o que faria a tela parecer arte
gerada em vez de documento, e este projeto já registrou essa lição no `OrdemParanormalSheet`
(o comentário sobre o halo dourado atrás do nome, redesign de 2026-08-02).

Corolário: **o número de registro não pode ser aleatório.** Documento cujo número muda a cada
render não é documento. Ele é derivado do nome do agente, de forma determinística.

## Fora de escopo (vinculante)

- **Polaroides / seletor de livro-fonte como objeto físico.** Não vendemos pacotes de conteúdo;
  não há o que escolher.
- **Abas de pasta suspensa.** O app já tem `SlidingTabPill`; duas gramáticas de aba seria pior que
  uma.
- **Pentagrama como formulário.** O `AttrDiagram` do criador já é o formulário, com `+`/`−` por
  vértice — já estamos à frente da referência aqui.
- **Cartão-resumo do agente no passo final** e **regra opcional no ato da criação.** Bons, mas são
  conteúdo/comportamento, não a moldura. Ficam para uma próxima onda.
- **Fontes e texturas novas.** Ver o princípio.

## Critérios de aceite

### AC-1: Cada passo é um documento emitido
- **Dado** qualquer passo do criador
- **Quando** ele é renderizado
- **Então** existe um cabeçalho de documento com o emissor (`ORDO REALITAS`), a natureza do
  documento e o número de registro
- **E** o cabeçalho usa a tipografia de título do tema, e o número usa a de dados
- **E** o corpo do passo fica dentro da moldura, separado do cabeçalho por um filete

### AC-2: O número de registro é derivado, não sorteado
- **Dado** o nome "Kael Nightingale"
- **Quando** o número de dossiê é calculado duas vezes
- **Então** o resultado é o mesmo nas duas
- **E** nomes diferentes produzem números diferentes
- **E** o formato é `NNNNNN/NNN`

### AC-3: Sem nome, o documento não está emitido
- **Dado** um agente ainda sem nome
- **Quando** o cabeçalho é renderizado
- **Então** o lugar do número mostra um traçado vazio, não um número inventado
- **E** o traçado tem a mesma largura do número, para o cabeçalho não pular quando o nome chegar

### AC-4: A barra de passos fala a língua do app
- **Dado** a barra de passos do criador
- **Quando** o passo muda
- **Então** o indicador desliza entre os passos, pelo mesmo mecanismo das outras barras do app
  (`useSlidingPill`)
- **E** passo já cumprido, passo atual e passo futuro são distinguíveis por algo além de cor

### AC-5: Existe uma página de admissão antes dos números
- **Dado** o criador recém-aberto
- **Quando** a primeira tela aparece
- **Então** ela é um termo de admissão da Ordo Realitas, com o que a organização espera do agente
- **E** dela se avança para os atributos
- **E** o texto é autoral — nada transcrito da referência

### AC-6: Nada do fluxo existente regrediu
- **Dado** o criador com a página de admissão adicionada
- **Quando** o jogador percorre os passos
- **Então** as travas de avanço continuam nos mesmos pontos (atributos zerados, origem escolhida,
  classe escolhida)
- **E** a assinatura da spec 0038 continua sendo o único jeito de finalizar
