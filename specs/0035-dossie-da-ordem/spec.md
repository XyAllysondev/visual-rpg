---
name: 0035-dossie-da-ordem
description: Material de dossiê na ficha do Ordem Paranormal — papel de arquivo, formulário datilografado, timbre e carimbo. Puxe quando mexer na apresentação da ficha do OP.
alwaysApply: false
---

# 0035 — Dossiê da Ordem

**Tier:** Pequeno (uma tela, só apresentação, nenhuma decisão irreversível).
**Pedido:** Andre, 2026-08-07 — *"melhorando o visual, deixando com cara verídica de RPG"*,
com a bifurcação resolvida por ele: **Dossiê da Ordem** (não grimório) e **só a ficha primeiro**.

## Problema

A ficha do Ordem Paranormal parece **aplicativo**, não documento. Três causas, todas
verificadas no código antes de escrever isto:

1. **Material simulado.** `.op-grain` (ordemStyles.jsx:18) é um `feTurbulence` chapado a 5% de
   opacidade sobre um retângulo. Ruído não é fibra: não tem direção, não tem borda gasta, não
   tem vinco. O olho lê "vidro escuro com chuvisco", não "papel".
2. **Sem gramática de formulário.** Rótulo e valor são só dois `<span>` lado a lado. Documento
   impresso tem régua, pontilhado de preenchimento, versalete e algarismo tabular — é isso que
   faz uma folha ler como *formulário preenchido* em vez de *lista renderizada*.
3. **A ficha não acompanhou a repaginação.** Ela ainda carrega **34 literais da paleta velha**
   (`#c9a84c` ×8, `#e8c96d` ×5, `rgba(201,168,76,…)` ×19, `#14141c` ×4, `#12121e` ×2,
   `#e8e4d9` ×3). O app virou obsidiana e ametista na 005; a ficha ficou no ouro grafite. Isso
   é dívida da repaginação anterior, não escopo novo — mas conserta aqui, senão o material
   novo briga com a cor velha.

## Decisão de material — papel de arquivo ESCURO

O dossiê é **papel fotografado sobre a mesa, em luz baixa** — não folha branca sob lâmpada.

Foi decisão consciente, e contra a alternativa mais óbvia. Papel claro (manila creme) seria
mais literal, mas a coluna de identidade da ficha é feita de **SVG desenhado para fundo
escuro**: os mostradores de atributo (`AttributeCircle.jsx`, `AttrPentagon.jsx`), o EKG dos
sinais vitais (`VitalSign.jsx`) e as auras usam traço claro sobre preto. Em papel claro eles
sumiriam, e "verídico" viraria "quebrado". Papel escuro entrega o material sem custar um
único componente.

A mesa escura do app passa a ser a mesa de verdade; a ficha é o documento sobre ela.

## Critérios de aceite

**AC-1 · Fibra, não ruído**
Dado que a ficha do OP está aberta,
Quando qualquer painel `.op-ink` é pintado,
Então ele tem fibra de papel com direção (turbulência deslocada, não `fractalNoise` isotrópico),
E o efeito é rasterizado em fundo estático — **nenhum filtro SVG animado por frame**.

**AC-2 · Formulário, não lista**
Dado um par rótulo/valor no dossiê,
Quando renderizado,
Então há pontilhado de preenchimento ligando o rótulo ao valor, o rótulo é versalete e o valor
usa algarismo tabular (`font-variant-numeric: tabular-nums`), de modo que colunas de números
alinhem na vertical.

**AC-3 · Timbre com dado real**
Dado que a ficha tem `id`,
Quando o timbre do dossiê é montado,
Então o número de processo **deriva do `id` da ficha** — nunca de `Math.random()` nem de
contador decorativo. Sem `id`, o campo não aparece.
*(É a regra do Painel, repetida: número que parece dado e não é, é o pior defeito de uma tela
de resumo.)*

**AC-4 · Datilografia sem custo de rede**
Dado que o dossiê usa tipografia de máquina,
Quando as fontes são resolvidas,
Então ele reusa uma família **já importada pelo registry** (`Courier Prime`, hoje servida pelo
tema do D&D), sem acrescentar um `family=` novo ao `@import`.

**AC-5 · Paleta única**
Dado o arquivo `ordemStyles.jsx`,
Quando varrido por literal de cor,
Então **nenhum** dos 34 literais da paleta velha sobrevive — todos saem de token do tema.
Exceção: preto e branco de sombra e realce, que são luz, não identidade.

**AC-6 · Contraste**
Dado qualquer texto do dossiê sobre o papel,
Então contraste ≥ 4,5:1; e ≥ 3:1 para régua, pontilhado e moldura que carreguem informação.

**AC-7 · Movimento reduzido**
Dado `prefers-reduced-motion: reduce`,
Então o dossiê entrega **a mesma folha, parada** — material, timbre, carimbo e pontilhado
continuam; só o movimento sai.

## Fora de escopo (vinculante)

- **Regra de jogo.** `rules.js`, motor de progressão, esquema do Firestore e `firestore.rules`
  não são tocados. Se o dossiê precisar de um dado que a ficha não tem, **para e pergunta**.
- **Cor de semântica de jogo:** elementos, condições e o roxo de seleção do editor de mapas.
- **D&D e Tormenta** seguem placeholder.
- **Papel claro nos anexos** (mostradores, perícias, abas) — é a segunda passada, e depende de
  redesenhar os SVG que hoje são claro-sobre-escuro. Não entra aqui.
- **Dado com peso** (a queda física do d20) — o Andre escolheu "só a ficha primeiro".

## Perguntas em aberto — RESOLVIDAS (Andre, 2026-08-08)

1. ~~O número de processo deve aparecer para ficha compartilhada por link público (`/p/:id`)?~~
   **SIM, aparece.** O `id` já vai na própria URL em `/p/:id`, então o número não expõe nada
   que o link já não exponha. O timbre fica completo para quem recebe o link.
2. ~~O carimbo deve refletir estado real (ATIVO / BAIXA / DESAPARECIDO a partir de PV e SAN)?~~
   **NÃO — o carimbo é fixo em "ATIVO".** Derivar o estado de PV e SAN inventaria vocabulário
   que nenhuma spec do sistema define, e um carimbo que *parece* refletir estado sem refletir
   é o mesmo defeito que o AC-3 proíbe no número de processo, só que em palavra em vez de
   número. Por isso o carimbo é `aria-hidden`: é ornamento de material, não informação.

   Se um dia o estado do agente virar vocabulário de verdade (numa spec própria, com os termos
   e os limiares definidos), o carimbo é o lugar natural para exibi-lo — e aí deixa de ser
   ornamento e passa a precisar de contraste de texto (4,5:1), não de gráfico (3:1).
