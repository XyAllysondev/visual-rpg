---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Memória de trabalho **entre sessões** (humanos e agentes). É **volátil**: atualizada o tempo
> todo. Diferente do **ADR** (decisão durável e imutável). Decisão estrutural → ADR; estado do
> trabalho → aqui. Atualize ao **pausar/encerrar**; leia ao **retomar**. Use a skill `/handoff`.

**Última atualização:** 2026-08-14 — **AS DUAS LINHAS FORAM JUNTADAS.** O `visual-rpg`
(repaginação heráldica, Painel, dossiê, scriptorium, modo demo) e o `NEXUS-RPG` (specs
0033–0041, `App.jsx` quebrado em `features/`) voltaram a ser uma coisa só.

> **2026-08-14: MERGE DAS DUAS LINHAS (ancestral comum `4c5dac9`, de 02/08).** O repositório
> `XyAllysondev/visual-rpg` — o que a Vercel builda — tinha divergido do `Andreytyui/NEXUS-RPG`
> por 12 dias. Cada lado tinha o que faltava no outro:
> - **visual (2 commits):** repaginação heráldica, Painel novo, dossiê da Ordem, arquivo,
>   scriptorium, modo demo sem login. `App.jsx` seguia monolítico (663 KB).
> - **SDD (10 commits):** specs 0033–0041 (progressão, cenas sonoras, cartografia viva,
>   investigação e interlúdio), `App.jsx` quebrado em `features/` (31 KB), lint limpo.
>
> **A divergência era menor do que parecia:** 36 arquivos tocados do lado visual contra 223 do
> lado SDD, mas só **9 nos dois lados** e apenas **5 conflitos** de verdade. O `src/themes/`
> inteiro (incluindo o `heraldica.jsx` novo) atravessou sem conflito — a repaginação chegou
> quase toda de graça por ali.
>
> **O conflito real era um só:** o bloco de 9.891 linhas do `App.jsx` monolítico contra as 3
> linhas de import do lado modular. Resolvido ficando com o modular e **portando as edições
> visuais para os módulos que hoje as abrigam** (`lib/appShell.jsx` para o bloco `:root`,
> `features/` e `ui/` para o resto).
>
> **⚠ ACHADO NO CAMINHO:** o `.env.production` é lido por TODO `npm run build`, inclusive o
> predeploy do Firebase (`firebase.json:3`). Enquanto `REACT_APP_DEMO=1` estiver lá, um deploy
> do Firebase publica o mostruário **sem login** em `playnexusrpg.com` também — não só na
> Vercel. Decisão consciente do Andre (mostruário do visual); para fechar, apague a linha.

---

## Relato da linha visual (`visual-rpg`) — até 2026-08-10

**Última atualização:** 2026-08-10 — quick **008 (scriptorium)**; antes, spec **0035** +
quicks **006** e **007**.

> **2026-08-10: SCRIPTORIUM (quick `008-scriptorium`).** O Andre pediu o ROSTO DO SITE
> inteiro, "medieval, impecável", citando Pinterest. Pinterest exige login e monta por JS —
> fui às fontes primárias (bibliotecas/universidades) e o vocabulário voltou verificável:
> **pauta (ruling) era deixada À MOSTRA de propósito**, **picotagem** de margem alinhava as
> páginas, **versal** é a inicial ampliada, **rubricação** é a cor de título (aqui, o ouro),
> **iluminar** é usar ouro para parecer que há luz dentro da página. Fontes no TASK.md.
> - **Camada global (`heraldica.jsx`)**: `.nx-h1::first-letter` = **versal iluminado** (o de
>   maior impacto — pinta TODO título da casa sem tocar JSX), `.h-pauta`, `.h-picote`,
>   `.nx-card` (a chapa padrão que faltava — cada tela inventava a sua) e `.h-folio`.
> - **Telas convertidas para a gramática**: Mapas, Planos, Trilhas. **Roadmap NÃO** (canvas
>   próprio + 146 estilos inline: é reescrita, não troca de cabeçalho).
> - **Literais da paleta velha mortos em mais 2 lugares**: os `<h1>` de Mapas e Planos
>   pintavam `linear-gradient(135deg,#c9a84c,#e8c96d)` — imunes à troca de tema. Restam os
>   outros arquivos do OP (o levantamento da 0035 contou 92 em 16 arquivos).
> - **⚠ ARMADILHA DE CSS que só a foto pega:** `radial-gradient(circle at 50% 50%)` sem raio
>   explícito se ajusta à caixa do tile — a picotagem saiu como BARRA PRETA vertical.
>   Use raio fixo (`circle 3.5px at …`) em furo/ponto repetido por `background-size`.
> - Corrigido junto: o vinco do papel atravessava a FOTO do dossiê (achado do teste da 007).
> - Suíte **2146 verdes** + a herdada. Tour headless das 8 telas refeito.
> - **Ainda cru:** Roadmap; **Mapas segue com 80% de tela vazia** (é COMPOSIÇÃO, não pele —
>   trocar cor não resolve tela vazia); Ajudante do Mestre inalcançável sem login real.

> **2026-08-08 (depois da 006): ARQUIVO E CASCO (quick `007-arquivo-e-casco`).** O Andre
> testou e não viu mudança fora da ficha — correto, não havia. A 007 leva a onda para fora:
> **cards de agente viram pastas de arquivo** (aba `.h-pasta-aba` com o MESMO nº de processo
> do dossiê — `numeroDeProcesso` importada no App.jsx) e a **topbar virou chapa**
> (`.h-topbar`, gume ametista→ouro igual ao da sidebar). Ornamentos novos são REUSÁVEIS e
> token-puros, na seção 12 da heraldica. Suíte 2146 verdes + herdada. Detalhe e armadilha
> de JSX no TASK.md da quick.

> **2026-08-08 (depois da 0035): DOSSIÊ A FUNDO (quick `006-dossie-a-fundo`).** O Andre viu
> a 0035 na tela e não se surpreendeu ("força total"). Diagnóstico: o material estava certo
> e TÍMIDO — faltava o aparato que faz o olho acreditar. A quick põe: **folha de rosto** do
> processo (furos vazados até a mesa, agência, PROC. OP-NNNN grande, tarja CONFIDENCIAL com
> listras, ABERTO EM ← `createdAt` real, censura ornamental, FL. 01 · rubrica), **foto 3×4**
> (cantos de álbum, "FOTOGRAFIA NÃO ANEXADA · ANEXO I" no vazio), **grade datilografada**
> nas perícias (réguas + sublinhado duplo, só CSS), **marca d'água** única atrás das
> perícias, **sombra de papel** em todo `.op-ink` e a **censura** que faltava do T6.
> - Regra mantida: processo ← id, data ← createdAt; **sem o dado, a linha some**. Censura e
>   rubrica não afirmam dado — afirmam ausência. Ornamento é `aria-hidden`.
> - A tela pegou de novo o que gate nenhum pega: agência truncada em reticências (tracking
>   0.26→0.18em) e o processo DUPLICADO na mesma dobra (sticky + folha de rosto — o sticky
>   voltou a ser só sobrancelha). Detalhe no TASK.md da quick.
> - `onMouseLeave` do retrato: `boxShadow:""` (não `"none"`) — senão mata a sombra de papel.
> - Fora de escopo consciente: o RESTO do site. Se o Andre quiser a onda nas outras telas,
>   é a próxima quick, com ele escolhendo onde.

> **2026-08-08: DOSSIÊ DA ORDEM (spec `0035`) — T1..T5 e T7 fechados, T6 e T8 parciais.**
> A ficha do OP ganhou MATERIAL: `dossie.jsx` é uma camada nova, aplicada por SELETOR sobre
> `.op-ink` (mesmo padrão do `themes/heraldica`), montada DEPOIS do `OrdemSheetStyles` —
> a ordem é o mecanismo, não acaso. Nenhuma regra de jogo mudou.
> - **Fibra, não ruído:** `feTurbulence type='turbulence'` com `baseFrequency` ANISOTRÓPICA
>   (`0.012 0.62`) — é a frequência desigual que vira fibra deitada. O filtro declara
>   `x/y/width/height` explícitos: sem isso a região padrão é 120% e o `stitchTiles` costura
>   numa grade que **não** é a de 180px que o `background-repeat` emenda.
> - **Decisões do Andre (2026-08-08):** carimbo **fixo em "ATIVO"** (derivar de PV/SAN
>   inventaria vocabulário que nenhuma spec define) e nº de processo **aparece no link
>   público** (o id já vai na URL). As duas perguntas em aberto da spec estão RESOLVIDAS.
> - **⚠ A sessão anterior morreu no meio desta spec** — processo do Claude Code abortou com
>   `0xC0000409` (fail-fast do Windows; assinatura de OOM do V8) logo após gravar o T5.
>   Transcript de 26 MB, heap do V8 em 2,2 GB, máquina com 7,7 GB. **Compacte antes dos
>   20 MB.** O `SessionStart` ainda despeja 102 KB, 99 dos quais são ESTE arquivo — está
>   ~2× acima do orçamento de 15k tokens que o CLAUDE.md fixa. Enxugar é dívida aberta.
> - **A verificação adversarial (28 agentes) reprovou 3 ACs que passavam a olho nu:** o
>   pontilhado media 2,12:1 contra o piso de 3:1; o `tabular-nums` não alcançava número
>   nenhum (os 2 `<Field>` são texto); e `.op-stagger` não era neutralizado sob
>   reduced-motion. Todos consertados — detalhe no `tasks.md` da spec.
> - **Dois literais da paleta velha sobreviveram à varredura do T5 por estarem em DECIMAL**
>   (`rgba(232,228,217,…)` = `#e8e4d9`). Varredura por hex não pega decimal — se for repetir
>   esse tipo de limpeza em outro arquivo, procure as duas formas.
> - **Restam 92 ocorrências da paleta velha em 16 outros arquivos do OP** (fora do AC-5).
> - **NINGUÉM OLHOU A TELA AINDA (T8).** Suíte e build passam; material, vinco e carimbo são
>   exatamente o tipo de coisa que passa no gate e fica feia. É o próximo passo.
> - Suíte: **2146 verdes** (2137 + 9 novos) + a falha herdada do `creature.test.js`.

**Anterior:** 2026-08-06 — quicks 002 (Painel), 003 (modo demo), 004 (repaginação
heráldica) e 005 (**obsidiana e ametista — o roxo de volta**).

> **2026-08-06 (mesmo dia, DEPOIS da 004): OBSIDIANA E AMETISTA (quick
> `005-obsidiana-ametista`).** O Andre pediu roxo — "ordem paranormal deve ter um tom roxo" —
> e uma melhoria "extrema" no visual. **Isto SUBSTITUI a paleta e a regra de cor da 004
> descrita logo abaixo; leia esta primeiro.** Nenhuma regra de negócio mudou.
> - **A escala inteira virou obsidiana violeta**, não só o acento. Foi a decisão que fez a
>   tela ler como roxa: trocar só o acento pintaria uma faixa roxa num app cinza. Os L* dos
>   quatro degraus são os MESMOS de antes (2,27 · 7,34 · 11,64 · 16,16) — só a matiz girou,
>   e por isso D&D e Tormenta continuaram dentro do ±1,0 da spec 0023 AC-2 sem serem tocados.
> - **A SPEC_DEVIATION da 004 no AC-6 está RESOLVIDA por retorno.** O `cardAccent` do OP
>   voltou ao `#b030d8` que a spec 0017 escolhia. O código voltou ao que a spec dizia — não
>   foi a spec que mudou. Segue divergindo só o ouro de chrome (`#c9a84c` → `#c6a45c`).
> - **A regra de cor nova** (topo de `themes/index.js`): ouro = clique/título · **ametista =
>   identidade e atmosfera** · aço = informação fria · Outro Lado = violeta-magenta em
>   PREENCHIMENTO SATURADO + halo. O roxo deixou de ser exclusivo do Outro Lado; o que separa
>   agora é a INTENSIDADE (fill vs véu), não a matiz. A regra antiga ("violeta = só o Outro
>   Lado") morreu junto com a 004 — não a cite.
> - **Ambiente novo, e ele PARA com a aba escondida** (`usePausaSeOculto` em
>   `themes/heraldica.jsx` → `data-parado` → `animation-play-state:paused`).
>   `animation-play-state` não tem gatilho em CSS puro; `document.hidden` é a única fonte.
> - **Dois defeitos meus que só a tela mostrou** (sirvam de aviso ao próximo que trocar de
>   paleta): (1) `--gold-face` derivava de `muted2`+`text`, e com a tipografia esfriando o
>   título gravado saiu PRATA — passou a derivar da liga do ouro; (2) o halo do selo
>   compartilhava os keyframes do núcleo e a animação sobrescrevia o `opacity=.14` do
>   atributo, levando um disco de 460px a opacidade 1 — **amplitude de animação é escala**,
>   o que é discreto num núcleo de 56px é uma mancha num halo oito vezes maior.
> - **Literais de App.jsx revertidos por script**, casando cada linha com a versão anterior à
>   varredura (commit `4c5dac9`) para devolver o roxo EXATO que cada uma tinha — 101 linhas
>   exatas, 7 por similaridade, 8 no padrão. Cor de regra de jogo (elementos, condições) não
>   foi tocada. O filtro sépia do emblema do OP foi REMOVIDO: a arte original já é roxa.
> - Suíte: **2137 verdes** + a falha herdada do `creature.test.js`. Sempre `--maxWorkers=2`.

> **2026-08-06: REPAGINAÇÃO HERÁLDICA (quick `004-repaginacao-heraldica`).**
> ⚠ **Superada pela 005 acima** no que toca a paleta e à regra de cor. O resto (a arquitetura
> de 3 camadas, o gate de crase, o aviso do `--maxWorkers`) continua valendo.
> O app inteiro trocou de pele: preto forjado + ouro brunido + carmesim de brasão, com
> material (bisel, grão, cantoneiras), ornamento e movimento. **Nenhuma regra de negócio
> mudou** — é apresentação.
> - **Como foi feito:** 3 camadas — tokens (`themes/index.js`), camada global nova
>   (`themes/heraldica.jsx`, aplicada por SELETOR nas classes compartilhadas) e a folha do
>   Painel. O JSX das telas de conteúdo NÃO foi tocado.
> - **A regra de cor** (está no topo de `themes/index.js`, siga-a): ouro = clique/título ·
>   carmesim = identidade/atmosfera · aço = informação fria · violeta = SÓ o Outro Lado.
> - **SPEC_DEVIATION na spec 0017 AC-6:** a identidade de card do OP saiu do roxo arcano para
>   o carmesim. O mecanismo do AC-6 continua valendo e testado; só a matiz mudou, por decisão
>   do Andre. Registrada no `TASK.md` da quick e no próprio teste.
> - **A spec 0023 barrou dois erros meus** antes de virarem tela feia: a escada de superfícies
>   ficou fora de sincronia entre sistemas, e no primeiro corte `bg`→`card2` caiu para 1,20:1
>   (hierarquia invisível). A escada nova é L* 2,3 / 7,4 / 11,6 / 16,2 nos três sistemas.
> - **Gate novo:** `node scripts/checar-templates-css.mjs` — acha crase dentro de template de
>   CSS, que quebra o build apontando a linha errada. Custou 3 ciclos de build nesta task.
> - **⚠ Rode a suíte com `--maxWorkers=2`.** No paralelismo padrão, `forja-render`,
>   `painel-render` e os testes do WorldMap falham por TIMEOUT sob carga, não por defeito.
>   Suíte: **2133 verdes** + a falha herdada do `creature.test.js`.
> - **Roxo que ficou de propósito:** 64 literais no editor de mapas — é cor de SELEÇÃO, tem
>   que destoar da paleta. Não "esqueceram" dela.
> - **A pele é de TODOS os sistemas, não só do OP.** A camada global não tem literal de cor:
>   tudo deriva do registry (inclusive a liga do metal, via `--gold-mid/-deep/-face` e os
>   degraus de alfa `--gold-veil/-wash/-sel/-cast` no `ThemeProvider`). Verificado forçando
>   `data-nexus-system` para `dnd`/`tormenta` e fotografando: vira vermelho de taverna e verde
>   de Arton sem sobra de ouro. **Se for escrever CSS novo na pele, use as vars** — literal ali
>   crava o OP no que deveria ser global.
> - **O que NÃO foi redesenhado:** a PALETA de D&D e Tormenta. Eles só tiveram a escada de
>   superfícies realinhada (obrigatório) e mantêm o acento próprio (vermelho/verde). Quando
>   saírem do "EM BREVE" (`available: false` no `SYSTEMS`), vale desenhar o par heráldico de
>   cada um — hoje o carmesim de brasão só existe para o OP.
> - **2026-08-06 — 2ª fonte da verdade fechada:** `PLAN_DEFS` (tela de Planos) tinha a própria
>   cópia da cor de sistema — D&D **azul** `#4a6fa5` e Tormenta **laranja**, contra o vermelho
>   e o verde do registry. É o mesmo literal que a spec 0017 já proibia na tela de SELEÇÃO;
>   Planos nunca foi migrada junto. Agora deriva de `getCardAccent`, com **3 testes** que leem
>   o fonte e barram a volta da cópia.
> - **Decisão do Andre (2026-08-06):** D&D e Tormenta **continuam visíveis** ("EM BREVE" na
>   seleção, card nos Planos) como vitrine do roadmap. A flag `hidden` fica disponível.
> - O emblema do OP na tela de seleção é um `.webp` roxo (≠ o SVG da topbar): tratado por
>   filtro em `.sys-emblem[data-sys="op"]`, marcado como remendo — apagar se reexportarem a arte.

> **2026-08-05: MODO DEMO (quick `003-modo-demo-sem-login`).**
> `http://localhost:3000/?demo=1` entra no app sem login e sem Firestore, com dados
> fictícios e um selo fixo "modo demo · dados fictícios". `?demo=0` sai e limpa.
> Atalho: `testar-nexus-demo.bat`.
> - **A trava:** `NODE_ENV !== "production" || REACT_APP_DEMO === "1"`. No site publicado
>   o `?demo=1` não faz nada — verificado servindo o build real, não só lendo o código.
> - **Não cobre** a Forja (Ajudante do Mestre) nem entrar numa mesa/mapa-múndi: essas
>   telas ainda vão ao Firestore e mostram o erro de carregamento. Falsificar o
>   `worldsStore` e os repos do Ateliê é uma task própria.
> - Custo aceito: ~3 KB de dados fictícios entram no bundle de produção (inertes).

> **2026-08-05: PAINEL REDESENHADO (quick `002-painel-redesenho`).**
> A tela `dashboard` saiu do `App.jsx` (−196 linhas) e virou `src/components/Painel/`, com
> hero animado, "continuar de onde parou", "precisa de você", números com cota e o preparo do
> mundo em anel de progresso. **Todo valor sai de estado real** — inclusive dois dados novos
> na tela: `worldMapsRepo.contarMapas` e `worldsRepo.watchWorldsByOwner`.
> - Gate: 16 testes novos em `src/components/Painel/__tests__/` · suíte **2133 verdes**
>   (eram 2117) · `craco build` limpo nos arquivos novos.
> - **Atenção ao retomar:** o Painel é **exceção** à régua `nx-*` (redesenho de 2026-08-02) —
>   foi pedido explícito do Andre. As demais telas continuam no `nx-*`; não propague o estilo
>   do Painel para elas sem falar com ele.
> - **Divergência aberta com o print do Andre:** o print que originou o pedido mostrava blocos
>   que NÃO existiam neste working tree ("Continuar em…", "Precisa de você", "1/1 Fichas",
>   "Suas campanhas", "Preparo do mundo"). O redesenho entregou todos eles, mas **confirme com
>   ele de onde vinha aquele print** — pode existir uma versão do app à frente deste repo.
> - **Herdado, não resolvido:** `src/domain/__tests__/creature.test.js:31` falha desde antes
>   (o teste cobra o quirk que `currentHp` conserta de propósito). Decisão do dono da spec.

> **2026-08-02** — DUAS SESSÕES trabalharam em paralelo neste dia: SPEC 0033
(progressão automática de OP) e as SPECS 0029/0030/0031 (arquitetura em camadas). Ambas verdes.

---

## Relato da linha SDD (`NEXUS-RPG`) — até 2026-08-08

**Última atualização:** 2026-08-08 (5) — **SPEC 0041 ENTREGUE (corrige 2 regras erradas da 0040).**
Gate: **113 suítes / 2.694 testes verdes** (`--runInBand`) e **`CI=true npm run build` compila
limpo**.

> **2026-08-08 (5): SPEC 0041 — OS VALORES DO INTERLÚDIO, DO LIVRO.** O Andre autorizou transcrever
> a tabela de recuperação. **E a transcrição provou que a spec 0040 tinha implementado DUAS REGRAS
> ERRADAS, já em produção.**
>
> **⚠ OS DOIS ERROS QUE A 0040 SUBIU:**
> 1. **"Cada personagem escolhe UMA ação de interlúdio"** — o livro diz literalmente *"um personagem
>    pode fazer até **DUAS** das ações a seguir"*. O AC-5 da 0040 travava em uma.
> 2. **Faltava a ação "Exercitar-se"**, e **"Consertar" chama-se "Manutenção"**. A transcrição da
>    spec 0026 tinha 6 ações; são **7**.
>
> Lição: a 0040 tratou `regras-oficiais.json` como fonte completa. Ele é uma **transcrição parcial**
> — as entradas diziam `(Resumo — valores no livro.)` e eu li isso como "os valores faltam", quando
> na verdade **a regra inteira estava resumida**, inclusive o número de ações. Resumo declarado é
> aviso de que falta conferir a fonte, não só de que falta um número.
>
> **⚠ E OS VALORES ERAM CALCULÁVEIS DESDE SEMPRE.** O livro: dormir recupera PV e PE iguais ao
> **limite de PE por rodada**, vezes a condição do descanso. O nosso `deriveStats().peTurno` **JÁ É
> esse limite** — o exemplo do livro (NEX 35% → limite 7 → recupera 7 PV e 7 PE) confere exatamente
> com `1 + nexLevel(35)` = 7. A 0040 pediu o número ao jogador quando a ficha já sabia calculá-lo.
>
> - **Escada de condições:** precária ½ · normal ×1 · confortável ×2 · luxuosa ×3. A ORDEM importa —
>   o prato nutritivo/energético "sobe um degrau", e o exemplo do livro (confortável → triplicada)
>   só fecha com essa escada.
> - **Relaxar** usa a mesma base, mas em Sanidade, + 1 SAN por personagem que relaxou no mesmo
>   interlúdio (inclusive o próprio — por isso o padrão é 1, não 0).
> - **Os quatro pratos** de Alimentar-se entraram com seus efeitos condicionais.
> - **Só Revisar o Caso repete** no mesmo interlúdio; o livro diz isso dela, e só dela.
> - **A prévia e a aplicação chamam a MESMA função** (`calcularRecuperacao`). Se divergissem, o
>   jogador confirmaria um número e receberia outro — há teste travando a igualdade.
> - **Compatibilidade com o que já está gravado:** interlúdios da 0040 usam `acao` no singular e
>   estão em PRODUÇÃO. `historicoDeInterludios` os converte, senão o jogador veria o próprio
>   registro desaparecer depois do deploy. Há teste.
>
> **DECISÃO REGISTRADA, NÃO REGRA DO LIVRO:** a condição precária vale "metade", e meio PV não
> existe — **arredondo para baixo**. O livro que temos não diz o sentido, e para cima seria mais
> generoso do que o texto autoriza. Se a mesa preferir o contrário, é uma linha, mas é decisão de
> produto.
>
> **PII:** o texto extraído do PDF carrega a marca d'água com nome e e-mail do comprador.
> **Nada disso entrou no repo** — só regra parafraseada.
>
> **Arquivos:** `regras-oficiais.json` (7 ações, textos com os valores reais),
> `interludio.js` (reescrito: escada, pratos, `calcularRecuperacao`, teto de 2 ações),
> `Tabs/InterludioTab.jsx` (reescrito: multi-seleção, condição, prato, prévia),
> `__tests__/investigacao-interludio.test.js` (73 testes), `OrdemParanormalSheet.jsx` (passa `peTurno`).
>
> **PENDENTE DO ANDRE:** validar no navegador (escolher Dormir + Alimentar-se com prato nutritivo e
> conferir que o PV sobe um degrau; tentar uma terceira ação e ver a recusa) e **decidir o
> arredondamento da condição precária**.

> **2026-08-08 (4): SPEC 0040 — INVESTIGAÇÃO E INTERLÚDIO.** O Andre pediu as duas páginas que a
> RPGpedia anuncia como "em breve", *"trabalhe 100% nisso"*, e sugeriu juntá-las com Descrição.
>
> **NÃO HAVIA O QUE COPIAR** — lá as duas são modais de "em breve". O que existe de verdade é no
> nosso repo: **as 7 regras de interlúdio JÁ ESTAVAM transcritas** em `regras-oficiais.json`
> (`secao: "interludio"`, spec 0026). A aba **lê de lá** e há teste comparando nome e descrição
> **caractere a caractere** com o JSON — se alguém reescrever a regra no componente, reprova. Era o
> risco real: o `STATE` já registra duas réguas divergentes de trilha em `opConstants.js`.
>
> - **⚠ OS VALORES DE RECUPERAÇÃO NÃO EXISTEM NO REPO.** As entradas dizem literalmente
>   `(Resumo — valores no livro.)`. Então **não inventei número**: quem informa quanto recuperou é
>   quem tem o livro, e o app aplica **a parte da regra que temos por escrito** —
>   `interludio-geral`: *"Nenhuma recuperação ultrapassa o máximo do personagem"*. Preencher um
>   valor "provável" seria inventar regra de sistema publicado.
> - **O registro guarda o EFETIVAMENTE recuperado, não o pedido.** PV 18/20 com +9 informado grava
>   `+2`. Histórico com número que não aconteceu é mentira no livro-razão — e o histórico é
>   exatamente o que o pedido chamava de "revisar as ações".
> - **Armadilha fechada:** sem máximo conhecido (`pvMax` 0 ou ausente) a função **não recupera
>   nada**. Deixar passar seria a única forma de a recuperação furar o teto.
> - **A SUGESTÃO DO ANDRE ERA O DESENHO CERTO, NÃO UM ATALHO.** A barra de abas da ficha **já
>   quebrou com seis** (`fix(ficha): abas somem quando são seis`). Investigação e Interlúdio no topo
>   dariam **oito** e reintroduziriam o defeito. Viraram sub-abas de um **Dossiê** (Agente ·
>   Investigação · Interlúdio) na gramática de pílula deslizante. **Há teste travando as seis abas
>   do topo.** `DescricaoTab` não foi tocada — virou a sub-aba "Agente".
> - **Pista tem ESTADO, e é o ponto todo.** Aberta / confirmada / descartada, com **marca**
>   (`?`/`✓`/`✕`) e riscado na descartada — não só cor. Numa bola de texto em "Anotações", pista
>   descartada fica indistinguível de pista viva, e é essa confusão que faz o grupo perseguir o que
>   já eliminou. Pista nasce **aberta**: pista que entra confirmada não foi investigada, foi assumida.
> - **O cabeçalho conta ABERTAS, não o total** — total inclui trabalho encerrado e não diz quanto
>   falta perseguir.
> - **Estado fora dos três conhecidos é ignorado** — o Firestore é schemaless e uma string errada
>   não pode virar um quarto estado.
> - A ficha só **grava** o que o módulo puro devolveu; não reaplica `Math.min`. Segunda opinião sobre
>   a mesma regra é como duas réguas divergem.
>
> **Arquivos:** `specs/0040-investigacao-e-interludio/{spec,tasks}.md`, `interludio.js` e
> `investigacao.js` (novos, puros), `Tabs/{DossieTab,InvestigacaoTab,InterludioTab}.jsx` (novos),
> `__tests__/investigacao-interludio.test.js` (novo, 45 testes), `OrdemParanormalSheet.jsx`.
>
> **FORA DE ESCOPO, declarado:** transcrever os valores de recuperação do livro (é conteúdo, spec
> própria); Notas do Mestre (segue proibida pela regra do Firestore — precisa de documento separado
> + ADR); ligar pista a nó do mapa-múndi ou a PNJ (acoplamento entre agregados, ADR antes).
>
> **PENDENTE DO ANDRE:** validar no navegador (registrar duas pistas e descartar uma; registrar um
> interlúdio pedindo mais PV do que cabe e conferir que o histórico grava o efetivo) e **commitar/
> deployar**.

> **2026-08-08 (3): SPECS 0037, 0038 e 0039 — ENTREGUES E EM PRODUÇÃO.**
> Commits `777250f` (0036–0039) e `616e057` (conserto do modal) em
> `feat/redesign-layout-nx`, empurrados para `Andreytyui/NEXUS-RPG`, e **deployados no Firebase
> Hosting** (`nexus-rpg-app`) — `playnexusrpg.com` e `nexus-rpg-app.web.app` respondendo 200.
> **`main` continua em `efeb973`, ATRÁS de produção** — decisão do Andre pendente (PR ou
> fast-forward).
>
> **⚠ DEFEITO DE PRODUÇÃO ACHADO E CORRIGIDO NO MESMO DIA (`616e057`):** o modal do retrato abria
> fora da vista e exigia rolar a página. O CSS estava **certo** (`position: fixed; inset: 0`) e o
> bug existia assim mesmo: a raiz da ficha carrega a classe global `.fade`, cujo `fadeIn` termina em
> `transform: translateY(0)` com `forwards` — e **ancestral com `transform` diferente de `none` vira
> o bloco de contenção dos filhos `position: fixed`**. O `inset: 0` se resolvia contra a ficha
> inteira. O `Modal` local passou a portalar para `document.body`, o que consertou os três usos
> (matriz de NEX, retrato, retrato com IA). O teste **não** checa `position: fixed` — checa que o
> modal está FORA da `.op-sheet`. Provado por mutação.
> **Lição:** `position: fixed` não é confiável dentro desta ficha; modal novo aqui **nasce portalado**.
>
> **Verificação de deploy que quase virou relato errado:** `main.js.map` respondeu **HTTP 200** e
> parecia vazamento de código-fonte. Não era — o `rewrite "**" → /index.html` devolve 200 para
> qualquer caminho inexistente; o conteúdo era `<!doctype html>`. **Status code não prova ausência
> de arquivo em SPA com fallback** — confira o conteúdo.

> **2026-08-08 (3): SPEC 0039 — O DOSSIÊ DE ADMISSÃO.** Último item do Tier A. O Andre decidiu a
> direção: *"em relação a arte, eu quero que você adapte para o visual do nexus hoje"* — então
> **copiou-se a ESTRUTURA da referência, não o acabamento**.
>
> **A tradução está escrita na spec, token por token:** papel amassado beige → superfície grafite
> (`--card`) com o `op-grain` que a ficha já tem; mesa de madeira → o próprio `--bg`, sem cenário
> novo; datilografia Courier → `IBM Plex Mono` (a fonte `data` do tema); serifa larga → `Cinzel`;
> filete de tinta preta → filete de ouro corrompido (`--border2`). **Zero fonte nova, zero textura
> nova, zero asset novo** — é por isso que isto virou spec de implementação e não de compra de arte.
>
> - **`DocPanel.jsx` (novo)** — a casca de documento: emissor `ORDO REALITAS`, natureza do documento
>   e número de registro, filete, corpo. Cada passo do criador virou uma **página do mesmo dossiê**
>   (`Termo de admissão` → `Anexo I · Aptidões` → `Anexo II · Vida pregressa` → `Anexo III ·
>   Treinamento` → `Autenticação do agente`).
> - **⚠ MOLDURA, NÃO CENÁRIO — está escrito no topo do componente.** Cenário ilustrado é o que faz a
>   tela parecer arte gerada em vez de documento, lição que este projeto já pagou no
>   `OrdemParanormalSheet` (o halo dourado atrás do nome, 2026-08-02).
> - **`numeroDeDossie` é determinístico por contrato.** Hash FNV-1a do nome → `NNNNNN/NNN`. A
>   tentação era `Math.random()`, e documento cujo número muda a cada render não é documento. Sem
>   nome não há número: o cabeçalho desenha um traçado de **exatamente 10 caracteres** (a largura de
>   `000000/000`) para não pular quando o nome chegar, com `aria-label` dizendo "ainda não emitido" —
>   senão o leitor de tela leria uma fileira de travessões como conteúdo.
> - **A série nunca começa em 0** (`h % 900000 + 100000`): `000123/456` não leria como registro.
> - **`StepBar` reescrito sobre `useSlidingPill`.** Era a **única barra do Nexus** fora da gramática
>   do indicador deslizante que as abas da ficha e da mesa usam desde a spec 0022. Cumprido / atual /
>   pendente agora se distinguem por **marca** (`✓`, número em destaque, número apagado) além da cor —
>   mesma lição do grau de treino na spec 0037. Clique só volta para passo cumprido; pular para
>   frente contornaria o `canNext`.
> - **Passo de Admissão novo**, com as cinco obrigações do agente. **Texto autoral** — nada
>   transcrito da referência.
>
> **⚠ ACHEI UM DEFEITO MEU DA SPEC 0038 AO FAZER ESTA.** A 0038 declarou que a assinatura era o
> **único** jeito de finalizar e removeu o botão `Finalizar Ficha` do topo do passo. **Havia um
> segundo botão** — `Criar Agente ✦`, na barra de navegação inferior — e o teste da 0038 passou
> porque procurava pelo rótulo do primeiro. Removido; no último passo a barra só diz "Assine ao pé
> do documento". O teste novo assere a ausência dos **dois** rótulos em **todos** os cinco passos.
>
> **LIÇÃO REGISTRADA (vale mais que a spec):** *teste de ausência precisa enumerar todos os rótulos
> possíveis e varrer todos os estados.* `queryByText("Finalizar Ficha")` provou que **aquele** botão
> sumiu, não que **o caminho** era único — e o AC falava de unicidade. Quando o AC diz "único", a
> asserção tem de varrer os estados e todos os nomes que a ação já teve.
>
> **FICOU PARA UMA PRÓXIMA ONDA** (declarado como fora de escopo): cartão-resumo do agente ao lado
> da assinatura e a regra opcional da 0038 surgindo no ato da criação. Fora por não serem moldura:
> polaroides de livro-fonte (não vendemos pacotes de conteúdo), abas de pasta suspensa (o app já tem
> `SlidingTabPill`) e pentagrama como formulário (o `AttrDiagram` já é o formulário, com `+`/`−` por
> vértice — aqui já estávamos à frente da referência).
>
> **Arquivos:** `specs/0039-dossie-de-admissao/{spec,tasks}.md`,
> `features/ficha/DocPanel.jsx` (novo), `features/ficha/StepBar.jsx` (reescrito),
> `features/ficha/__tests__/dossie-de-admissao.test.js` (novo, 21 testes),
> `domain/character.js` (+`numeroDeDossie`), `features/ficha/CharacterCreator.jsx`.
>
> **PENDENTE DO ANDRE:** (1) validar no navegador — abrir "nova ficha", ler a página de admissão,
> conferir que o número do dossiê só aparece quando o nome é digitado e que ele **não muda** ao
> continuar digitando outras coisas, e criar um agente assinando; (2) **commitar**.

> **2026-08-08 (2): SPEC 0038 — A FICHA QUE CABE NA MESA (Tier A do teardown da RPGpedia).**
>
> **A AUDITORIA MATOU DOIS DOS SEIS ITENS ANTES DE EU ESCREVER UMA LINHA — os dois já estavam
> entregues e ninguém sabia:**
> - **Limite de itens por categoria, carga, patente e prestígio** já existem em
>   `Tabs/InventarioTab.jsx` (`limiteItens`, `patenteForPrestigio`, `cargaMaxima`, `cargaTeto`). Meu
>   relato anterior de que "o inventário é um botão vazio" descrevia a **`FullSheet` legada**.
> - **Carrossel mobile de três seções** já existe (`mobileSec` + `useSlidingPill`).
>
> **O CORTE QUE VALE MAIS QUE O CÓDIGO: três das quatro regras opcionais NÃO entraram.**
> `regrasOpcionais` tinha **zero ocorrências no projeto**, então tudo era do zero — e ao olhar o que
> cada interruptor ligaria: **Contagem de Munição** não tem o que contar (`municao|ammo` = 0
> ocorrências em `rules.js` e na ficha; a própria RPGpedia ainda não entregou), e **NEX &
> Experiência** e **Evolução por Patente** trocam o motor de progressão inteiro (spec 0033) — cada
> uma é uma spec. Entregar quatro chaves das quais três não fazem nada é exatamente o defeito que a
> **spec 0036** foi escrita para matar. Entrou **uma que funciona**. O AC-7 tem teste que **reprova
> se alguém adicionar as outras três**, e o motivo está escrito no código.
>
> - **Jogando sem Sanidade desarma na RAIZ.** `breach` passou a nascer `!semSanidade && sanPct < 0.3`.
>   Os cinco efeitos que ele governa (classe `op-breach`, camada `op-outrolado`, glifos, selo SURTO,
>   botão de sussurro) já dependiam dele, então **nenhum ponto de uso precisou saber da regra** —
>   cinco `&&` espalhados é como se esquece o sexto. O valor de `san` não é zerado nem recalculado:
>   desligar a regra devolve o sinal vital com o mesmo número.
> - **Ocultar perícia guarda o `base`, nunca o índice** — a ordem de `PERICIAS` pode mudar e um
>   índice passaria a esconder a perícia errada.
> - **A assimetria é deliberada e está escrita:** ocultar exige Modo de Edição; **descobrir o que
>   está oculto não exige nada**. Quem abre a ficha de outra pessoa precisa ver que a lista está
>   incompleta sem permissão de editar. A faixa "N perícias ocultas · mostrar" aparece nos dois
>   modos, e o filtro de texto **fura** o oculto (procurar pelo nome acha, marcado) — senão a
>   perícia pareceria apagada, e ela não está.
> - **O teste que protege o número de combate:** Reflexos alimenta a Esquiva (10 + AGI + Reflexos).
>   Ocultar Reflexos não pode mexer nela — seria o defeito mais caro que esta feature poderia
>   introduzir, e tem teste travando.
> - **A 8ª coluna do grid só existe em Modo de Edição** (`.op-col-panel[data-edit="true"]`, três
>   faixas). Reservá-la sempre faria a tabela mudar de largura ao destravar.
> - **A criação terminou de virar documento:** o botão "Finalizar Ficha" foi **removido** e o fecho é
>   uma linha de assinatura em cursiva, derivada do nome (`assinaturaDe` em `domain/character.js` —
>   "Kael de Souza Nightingale" → "Kael S. N."; partícula de ligação não vira inicial). Sem nome não
>   há assinatura para acionar. Dois caminhos para a mesma ação é convite a manter só o feio.
>
> **FORA DE ESCOPO, declarado:** **criação de agente como dossiê** (papel amassado, datilografia,
> polaroids, abas de pasta suspensa, pentagrama como formulário) — é redesign de direção de arte com
> assets e fontes novas, **spec própria, e precisa do Andre decidir a direção**. Segue fora também o
> texto de regra por perícia (herdado da 0037).
>
> **Arquivos:** `specs/0038-a-ficha-que-cabe-na-mesa/{spec,tasks}.md`,
> `__tests__/cabe-na-mesa.test.js` (novo, 25 testes), `domain/character.js` (+`assinaturaDe`),
> `OrdemParanormalSheet.jsx`, `ordemStyles.jsx`, `features/ficha/CharacterCreator.jsx`.
>
> **PENDENTE DO ANDRE:** (1) validar no navegador — ocultar duas perícias, recarregar, procurar uma
> delas no filtro, ligar "Jogando sem Sanidade" com a SAN baixa e conferir que o surto morre, e criar
> um agente assinando; (2) decidir a direção de arte do dossiê (spec 0039); (3) **commitar**.

> **2026-08-08: SPEC 0037 — MOSTRAR A CONTA.** Andre assinou a **RPGpedia** e pediu para explorar
> a ficha de Ordem Paranormal dela por completo e trazer o que fosse bom. Explorei o fluxo inteiro
> (criação em 5 passos + ficha) logado na conta dele; o teardown virou
> `memory/rpgpedia-ficha-op-referencia.md` e 20 prints em `Desktop/Nexus RPG/op-ficha-*.png`.
> Ele escolheu começar pelo **Tier S**.
>
> **DOIS DOS SEIS ITENS DO TIER S JÁ EXISTIAM, e o alvo era o arquivo errado.** O plano inicial
> mirava a `FullSheet.jsx` — que este STATE já registrava como **inalcançável em produção**. A
> ficha real é `systems/OrdemParanormal/OrdemParanormalSheet.jsx`, e nela o **Modo de Edição**
> (`editMode`) e a **fórmula da Defesa exposta** já estavam prontos. Sobraram quatro itens reais.
>
> - **O PROBLEMA CENTRAL NÃO ERA DE CSS: a ficha jogava a conta fora.** `rollSkill` fazia
>   `result: base.result + tBonus + other`, sobrescrevendo `base.result` — **o d20 que venceu era
>   descartado do estado**. Não havia como a tela mostrar qual dado sobreviveu porque o dado não
>   era guardado. `fireRoll` passou a carregar `kept`, `bonus` e `conta`, com a invariante
>   `kept + bonus === result`.
> - **⚠ A ARMADILHA QUE JUSTIFICA `attrEfetivo` EXISTIR.** `rollOP` decide o "fica com o pior" a
>   partir do NÚMERO que recebe (`attrVal === 0`), não de uma flag. Com dado de bônus, a tentação é
>   mandar a contagem do bolo — e `rollOP(2)` lança 2 dados e fica com o **melhor**, o oposto da
>   regra de atributo 0, **sem erro nenhum na tela**. `boloDeDados` devolve `n` (para exibir) e
>   `attrEfetivo` (para rolar), separados, com o teste que prova a inversão.
> - **DECISÃO DE REGRA QUE NÃO INVENTEI — PRECISA DO ANDRE SE DISCORDAR.** Dado de bônus sobre
>   atributo 0: o livro que temos **não resolve o caso**. Escolhi não aplicar (a regra do
>   pior-de-dois fica intacta) e a interface **diz em voz alta** que o bônus não entrou. A outra
>   leitura (bônus cancela a penalidade) é decisão de produto, não efeito colateral de código.
> - **A coluna "Dados" mostrava o atributo.** O cabeçalho dizia `Dados` (`i18n/pt.js:114`) e a
>   célula entregava `AGI`. Agora mostra `3d20` (`2d20↓` no atributo 0); a sigla migrou para a
>   segunda linha do nome (`.op-skill-sub`), que some no celular para não dobrar a altura da linha.
> - **O grau de treino dependia de cor sozinha.** `treinoColor` separava Destreinado/Treinado/
>   Veterano/Expert só por matiz. Virou 0–3 marcas + o grau no `aria-label`. Ganho de
>   acessibilidade que veio de graça no mesmo lugar.
> - **A trava de edição vazava.** Os dois campos numéricos e o hexágono da linha de perícia
>   aceitavam alteração com a ficha em Modo de Jogo. Fechados. **A banca de modificadores NÃO ficou
>   atrás da trava, de propósito** — ligar "estou em cobertura" é jogar, não montar personagem, e o
>   motivo está escrito no código para ninguém "consertar" isso de volta.
> - **`RollCard.jsx` novo**, consumido pelo corner card (com verso que abre a conta termo a termo) e
>   pelo modal de crítico (que mostra a conta **aberta** — um flip lá brigaria com a animação). Dado
>   mantido com moldura, descartados apagados **e riscados**: redundância além do matiz. Empate
>   (`[13,13,9]`) é indistinguível por construção — o primeiro leva, e o teste trava isso.
> - **AC-10 travado por teste:** `rollPayload` não ganhou campo. `kept`/`bonus` não atravessam para
>   o Firestore; o contrato do feed de rolagens é o mesmo.
>
> **⚠ CAÍ NA ARMADILHA DAS CRASES DE NOVO** (a 4ª vez neste projeto): pus uma crase em volta de
> `aria-label` num comentário dentro do `ordemStyles.jsx`, cujo CSS mora em **template literal** —
> a crase fechou a string e o build quebrou. O comentário agora avisa, no próprio arquivo, para não
> usar crase ali.
>
> **DOIS ACHADOS DE TESTE que valem mais que os testes:**
> (a) **Sem provider de i18n, `t("op.pericias.Acrobacia")` devolve a própria chave.** As outras
> suítes de OP montam a ficha assim, então é convenção do repo — mas asserção com string exata
> passaria a reprovar por tradução quando o provider entrar. Os matchers ancoram no que não
> depende de i18n, com o motivo escrito.
> (b) **Um teste meu era instável e eu peguei antes do gate:** 3d20 tira 20 em ~14% das rolagens, e
> um 20 manda a ficha para o modal de crítico, que não desenha "resultado". Fixei o dado com spy —
> `rollOP` resolve `Math.random` a cada chamada exatamente para isso.
>
> **FORA DE ESCOPO, declarado na spec:** **texto de regra por perícia** ("regras na ponta do dedo"
> da referência) — `regras-oficiais.json` tem 33 regras gerais e **zero descrição por perícia**; as
> ~20 perícias com seus usos são conteúdo a parafrasear do livro, e conteúdo é spec própria. Também
> fora: criação como dossiê, assinatura para finalizar, matriz de limite de itens, carrossel mobile
> e selos de paywall (Tier A e B do teardown).
>
> **Arquivos:** `specs/0037-mostrar-a-conta/{spec,tasks}.md`, `RollCard.jsx` (novo),
> `__tests__/mostrar-a-conta.test.js` (novo, 49 testes), `rules.js` (+5 exports puros),
> `OrdemParanormalSheet.jsx`, `ordemStyles.jsx`.
>
> **PENDENTE DO ANDRE:** (1) validar no navegador — rolar uma perícia e virar o card, conferir a
> coluna `3d20`, ligar um modificador com dado de bônus e checar o bolo, e testar uma perícia com
> atributo 0; (2) decidir a leitura do dado de bônus sobre atributo 0; (3) **commitar**.

> **2026-08-07 (3): a varredura dos arquivos que faltavam achou o defeito mais grave da revisão.**
>
> - **⚠ XSS ARMAZENADO — o texto rico voltava à tela sem sanitização.** Oito lugares usam
>   `dangerouslySetInnerHTML` com HTML gravado pelo editor da ficha. Enquanto quem escreve é o
>   dono, é confiança em si mesmo — mas o texto **não vem só do dono**: o link de editor da ficha
>   pública (`/p/:id?editor=…`) deixa um convidado montar a ficha inteira e mandá-la como
>   sugestão; na mesa, "permitir que qualquer pessoa edite" abre para qualquer membro; e a ficha
>   pública é lida por **visitante sem login**. Um `<img src=x onerror=…>` aprovado pelo dono
>   viraria script no navegador de todo mundo. Novo `lib/sanitizarHtml.js` com allowlist de tags,
>   **zero atributos** e parser do navegador (`DOMParser`, inerte) — nada de regex, que erra
>   justamente nos casos malformados onde o ataque mora. Aplicado nos 8 pontos; sanitiza na
>   **saída**, o que protege também o que já está gravado no Firestore. 14 testes.
> - **O "← Voltar" da ficha pública em modo editor não fazia nada** — `onBack` ia `null` e a ficha
>   desenha o botão sempre. Agora sai, confirmando antes (o editor perderia a sugestão não enviada).
> - **Layout:** o seletor de elemento (NEX 50%) tinha `repeat(4, 1fr)` FIXO — quatro cartões de
>   ~78px num celular de 360px, na tela que marca o momento mais importante do personagem. E o
>   criador de personagem tinha `repeat(3,1fr)` para as classes. Ambos viraram `auto-fit`+`minmax`:
>   desktop igual, celular quebra em duas colunas.
> - **O gate parou de piscar.** Duas suítes reprovaram de forma intermitente em rodadas diferentes
>   (`WorldMap/f7-tempo-real`, `MasterSuite/forja-render`) e passavam 3/3 isoladas: o timeout de
>   `findBy*` é 1000ms e a suíte inteira leva ~160s sob carga. Novo `src/setupTests.js` sobe
>   `asyncUtilTimeout` para 4s (e o `jest.setTimeout` junto, senão o erro vira "Exceeded timeout"
>   em vez de dizer QUAL elemento faltou). Gate reprovando por relógio ensina o time a reexecutar
>   até passar — que é como uma regressão de verdade passa batida.
>
> **ACHADO NOVO, PARA O ANDRE DECIDIR (não mexi):** com **D&D e Tormenta em `available: false`**
> (`features/sistemas/systems.jsx`), só Ordem Paranormal é selecionável — então a **`FullSheet`
> legada (~1.500 linhas) ficou inalcançável na prática**, e junto dela a metade OP do
> `opConstants.js`, que tem uma **segunda régua de trilhas divergente da `rules.js`** (combatente:
> atirador/chefe/guerreiro lá, aniquilador/comandante/guerreiro/op_especiais/tropa_choque cá).
> Duas fontes de verdade para a mesma regra é dívida esperando para morder — mas apagar 1.500
> linhas é decisão de produto, não de revisão.
>
> **Ainda NÃO revisados linha a linha** (passaram por lint, testes e varredura dirigida por padrões
> de defeito, sem achados): `TokenBuilder.jsx` (445), `SheetList.jsx` (232), `modalStyles.js` (144),
> `ElementoSymbol.jsx` (101).

> **2026-08-07 (2): os 5 achados que a primeira rodada deixou em aberto.**
>
> - **1 · A mesa passou a abrir a ficha do sistema certo.** `SharedSheetsPanel` montava a
>   `FullSheet` legada para TODA ficha compartilhada — um agente de Ordem Paranormal aparecia
>   para a campanha sem elemento de afinidade, sem aba de progressão e sem arsenal v2, enquanto a
>   visão pública já roteava certo. O roteamento virou `fichaDoSistema()` em `lib/lazySystemSheets`
>   (junto dos `lazy()`, que é quem já sabia de sistema), com `null` para "sem ficha própria" —
>   a mesa é quem decide cair na FullSheet. **Os três ajustes de privacidade** (`isPrivate`,
>   `allowMasterEdit`, `allowAnyEdit`) **moravam DENTRO da ficha legada**: se a troca fosse só
>   trocar o componente, o dono perderia o único lugar do app onde mexe neles. Viraram a
>   `BarraPrivacidade`, no topo do visualizador, visível só para o dono. O visualizador também
>   passou a ler a versão VIVA do documento (`sharedSheets.find(...)`), senão o ajuste só
>   apareceria ao fechar e reabrir.
> - **2 · "Notas do Mestre" foi APAGADA, não ligada — e a regra do Firestore é o motivo.**
>   `campaigns/{id}/sharedSheets/{id}` tem `allow read: if isMember(campaignId)`: **todo jogador da
>   campanha lê o documento inteiro pelo SDK**. Ligar a seção (ela dependia de `viewerIsMaster`,
>   prop que nada no código jamais produziu) seria gravar nota de mestre exatamente onde o rótulo
>   "visível apenas ao Mestre" promete que ela não está. Fazer de verdade exige documento separado
>   (`campaigns/{id}/gmNotes/{charId}`) com regra de leitura restrita — decisão de fronteira, ADR
>   antes do código, como o mapa-múndi fez no ADR-0012. O motivo está escrito no topo do
>   `DescricaoTab.jsx`, para ninguém "consertar" isso de volta sem ler.
> - **3 · `AttrPentagon.jsx` apagado** (151 linhas, zero importadores). O
>   `docs/architecture/assessment.md` foi atualizado.
> - **4 · O teto de itens homebrew passou a ser cobrado.** O inventário exibia "x/50" e nunca
>   barrava nada — a aba de Rituais já desligava o botão no limite. Agora os botões "Novo:"
>   desligam com o motivo no `title` e o contador fica vermelho. Item da biblioteca oficial não
>   conta para o teto.
> - **5 · Zero avisos de lint no projeto.** `App.jsx` (8 variáveis mortas + 5 listas de dependência
>   documentadas), `DungeonsAndDragonsSheet.jsx`, `WorldMap/Editor/CamadaDeNevoa.jsx` e
>   `WorldMap/model/viagem.js`. No D&D o achado era real: os cantos do cartão de rolagem eram dois
>   `map` aninhados sobre arrays de strings que ninguém lia — oito delas com `${GOLD}` **literal**
>   dentro de aspas comuns, que nunca interpolaram nada. Mesma renderização, quatro posições ditas
>   uma vez.
>
> **Testes:** `__tests__/achados-pendentes.test.js` (+9). ⚠ `f7-tempo-real.test.js` falhou UMA vez
> numa rodada e passou isolado e em todas as seguintes — é sensível a tempo, não regressão.
>
> **PRÓXIMO PASSO — PENDENTE DO ANDRE:** validar no navegador (principalmente a ficha de OP aberta
> pela mesa, que é o caminho novo) e **commitar**.

> **2026-08-07: revisão total da parte de Ordem Paranormal (a pedido do Andre).**
> Varredura de `systems/OrdemParanormal/` (ficha, regras, motor de progressão, 5 abas, arsenal),
> `features/ficha/` e `features/campanha/`. Sete defeitos **reproduzíveis** corrigidos; cada um
> tem um teste que falha na versão anterior (`__tests__/ficha-correcoes.test.js`, +1 suíte,
> +9 testes; mais 6 casos de `attackSkillBonus` em `arsenal.test.js`).
>
> - **O ataque valia menos que a perícia, com os dois números na mesma tela.** `rollAttack`
>   somava só `skillTreino[pericia]` e ignorava `skillOutros` — o mesmo bônus que o teste de
>   perícia da coluna do meio soma desde sempre (e que `WorldMap/model/esquiva.js` documenta como
>   a fórmula do sistema). Virou `attackSkillBonus()` em `rules.js`, função pura e testada.
> - **Esquiva bônus era gravado, revisado e ignorado.** O campo aparece no painel de revisões
>   (`buildDiff` → "Esquiva bônus"), era persistido e **não entrava na conta exibida**. O revisor
>   aprovava um número que a ficha nunca mostrava. Agora soma e aparece na fórmula.
> - **O ajuste "Geração de Arte com IA" não ajustava nada.** O texto promete "habilita o botão
>   'Gerar com IA' no upload de retrato"; o botão aparecia sempre. O `CharacterCreator` já fazia
>   certo (`aiArtEnabled`) — a ficha passou a fazer igual.
> - **Item homebrew recém-criado sumia de "Meus Itens".** `novoItem` empurrava para a lista um
>   objeto com `is_homebrew` e mandava para o modal uma cópia SEM a marca; como `saveItem`
>   substitui a entrada inteira, o primeiro "Salvar" apagava a marca.
> - **Ritual da biblioteca perdia o id oficial.** `addRitual` trocava `"amaldicoar_arma_conhecimento"`
>   por `Date.now()+Math.random()` — e é por esse id que `progressao/motor.js` sabe o que o agente
>   já conhece. Resultado: o motor reoferecia o ritual como pendência e ele entrava duas vezes.
>   Agora o id do livro é preservado, ritual conhecido não entra de novo e o "+" vira "✓ já está
>   na ficha" em vez de um botão que não faz nada.
> - **Agente recém-criado nascia INCONSCIENTE no painel.** O criador grava só atributos, origem,
>   classe e NEX; o `DossierCard` lia `pvMax ?? 1` e `pv ?? 0` → "PV 0/1, INCONSCIENTE" logo
>   depois de criar o personagem. Passou a cair em `lib/nexStats` (o mesmo cálculo do card de
>   ficha compartilhada) quando o documento ainda não tem vitais.
> - **Com 0 PV o traçado continuava batendo.** `vitalState(pct, dead)` recebia `false` cravado
>   nos dois sinais vitais; só o PE fazia certo. Agora 0 PV dá linha reta e o selo **MORRENDO**
>   (nome da condição no livro, `regras-oficiais.json` › `pv-morrendo`).
> - **Layout:** as media queries de `.op-dial` (76px em ≤768, 66px em ≤480) eram **letra morta** —
>   o tamanho ia inline no elemento e estilo inline vence `@media`. Os dials ficavam do mesmo
>   tamanho no desktop e no celular. O tamanho passou para o JS (`AttrConstellation` +
>   `useIsMobile`), e o comentário do CSS de ≤480px, que dizia esconder a coluna "outros" quando
>   esconde a de "treino", foi corrigido para descrever o que o seletor faz.
>
> **ACHADOS NÃO CORRIGIDOS — decisão do Andre, não defeito óbvio:**
> - **A ficha compartilhada na mesa abre a `FullSheet` LEGADA** (`SharedSheetsPanel.jsx:193`),
>   não a ficha-dossiê. O `PublicSheetView` já usa a nova. Trocar não é mecânico: a legada é que
>   tem os controles de privacidade (`isPrivate`, `allowMasterEdit`, `allowAnyEdit`) que a mesa lê.
> - **"Notas do Mestre" (aba Descrição) nunca renderiza:** depende de `character.viewerIsMaster`,
>   que **nenhum lugar do código produz**. Ou liga-se o caminho (mestre vendo ficha de jogador) ou
>   apaga-se a seção.
> - **`AttrPentagon.jsx` (151 linhas) é código morto** — ninguém importa.
> - **`HOMEBREW_LIMIT` do inventário é exibido (`x/50`) e nunca aplicado** (nos rituais é).
> - **Avisos de lint FORA do escopo OP** (o `CI=true npm run build` segue reprovando por eles):
>   `App.jsx` (13), `DungeonsAndDragonsSheet.jsx` (11 — incluindo 8 `${...}` dentro de string
>   comum, que provavelmente é bug de verdade), `WorldMap/Editor/CamadaDeNevoa.jsx` (2),
>   `WorldMap/model/viagem.js` (1).
>
> **PRÓXIMO PASSO — PENDENTE DO ANDRE:** validar no navegador e **commitar**.

> **2026-08-05 (3): SPEC 0035 — M8 (fecha a F2) + F3 INTEIRA (M5 e M6).**
> Partida em 100 suítes / 2.399 testes; chegada em **103 / 2.460** (+3 suítes, +61 testes).
> **Nenhuma suíte legada foi editada** — o AC-9 chama isso de regressão, não de progresso.
>
> - **M8 · A carta ganhou mão.** `model/CartografiaPadrao.jsx` foi de 23,7 KB para **39,8 KB**
>   (teto do AC-11: 60 KB, medido por `fs.statSync` no gate). Três hachuras com **gramáticas
>   diferentes de propósito** — relevo perpendicular à crista e caindo pelo lado que desce, mata em
>   pares inclinados sob as copas, água em fiadas horizontais interrompidas. Iguais, o olho leria
>   "textura de preenchimento"; diferentes, ele lê "relevo, mata, água". A rosa dos ventos chapada
>   virou pipas partidas ao meio (um lado em tinta cheia, o outro num `<pattern>` de trama), com 32
>   rumos e **N/L/S/O** — Leste com E seria anglicismo dentro de um objeto de ficção em português.
>   E cinco anotações em cursiva nas margens, na mão de quem USOU a carta, nunca sobre o miolo onde
>   os doze nós moram (x 300–2130, y 200–1330) — ali brigariam com os rótulos dos lugares.
> - **M5 · O cartão de pergaminho.** Casca única (`Mesa/CartaoDePergaminho.jsx`) com portal,
>   armadilha de foco, Esc, título em versalete, filete duplo e UM botão. Dois consumidores: o
>   cartão de descoberta e o `PainelDeEncontro`, cujo **comportamento não mudou uma vírgula** (os
>   `data-testid` legados e a regra "Esc adia, nunca decide" seguem intactos; as quatro suítes que o
>   exercitam passaram sem edição).
> - **⚠ O CARTÃO PROJETA MESMO RECEBENDO PROJEÇÃO.** No cliente do jogador `grafoVisivel` já é a
>   projeção; no do MESTRE ele pode carregar o nó do MOLDE, com `gmNotes`. Passar por `projecaoDoNo`
>   é o que garante que nenhum campo de mestre chegue ao DOM — e o gate entrega um nó com todos os
>   `CAMPOS_VENENOSOS` preenchidos com valores procuráveis e varre o DOM serializado **incluindo
>   `document.body`**, senão o portal escaparia da varredura e o verde seria falso.
> - **⚠ O TESTE DE CONTRASTE PEGOU UM DEFEITO MEU, E DEPOIS UMA PREMISSA MINHA.** Primeiro: o título
>   estava mais CLARO que o corpo e caía a 4,42:1 — além de reprovar no piso, estava errado de
>   desenho, porque num impresso o cabeçalho é onde a pena carrega mais. Depois: exigir 4,5:1 com as
>   quatro tintas do dia compostas sobre o papel é **impossível por construção** (a tinta da
>   madrugada é escura, e escurecer o fundo o aproxima do texto — nenhum ajuste de cor resolve). A
>   premissa é que estava errada: o cartão é portal em `document.body`, `position:fixed`, z-index
>   430 — acima da vinheta (6) e da barra do cartógrafo (7), **fora do palco** onde `.wmm-tinta`
>   vive. O teste passou a travar a PREMISSA em vez de medir uma composição que não acontece.
> - **M6 · A esquiva.** `model/esquiva.js` é clone estrutural de `descoberta.js`: **não rola dado**
>   (o motor é `src/domain/dice.js`, AC-9 literal) e a saída do fracasso é idêntica caractere a
>   caractere à de uma rolagem que não veio. `DT_POR_PERIGO` é tabela explícita (12/15/19/22/25),
>   não fórmula: entre perigo 2 e 3 está a fronteira "estrada ruim → lugar errado", e uma fórmula
>   esconderia essa intenção atrás de dois números. **O sucesso sai por `return`**, exatamente como
>   "não houve sorteio" — sem pendência, sem pausa, sem documento. Marca de encontro que não
>   aconteceu é oráculo.
> - **⚠ ISTO EXIGIU UM ADR, E O BRIEFING MANDAVA PARAR ANTES DE CODAR.** O mapa-múndi só tocava
>   `fogRepo`, `mesaRepo` e `worldMapsRepo`; ler Furtividade é **acoplamento novo entre agregados**.
>   Virou o **[ADR-0012](architecture/adr/0012-mapa-mundi-le-fichas-compartilhadas.md)**: a leitura
>   continua no repositório (`sharedSheetsRepo`), o mapa **não** abre listener de ficha (elas entram
>   por prop), e a conta mora numa porta pura — `melhorFurtividade(fichas) → number|null`.
> - **A fórmula da perícia foi LIDA, não inventada:** `skillTreino[p] + skillOutros[p]`
>   (`OrdemParanormalSheet.jsx:429-435`). O atributo **não** entra — em OP ele decide quantos d20 o
>   `rollOP` lança, não um modificador plano; somá-lo contaria o atributo duas vezes.
> - **Sem ficha compartilhada, nada mudou** (AC-13): `melhorFurtividade` devolve `null`, e `null` é
>   a instrução para o campo manual continuar na tela. Não é modo degradado — é o mesmo caminho de
>   antes. E zero **não** é ausência: destreinado é um bônus legítimo, e confundir os dois faria uma
>   campanha sem ficha parecer uma campanha com um personagem péssimo.
> - **⚠ `CI=true npm run build` REPROVA, e não é por causa desta spec.** Com `CI=true` os avisos
>   viram erro, e há avisos **pré-existentes** em `App.jsx`, `DungeonsAndDragonsSheet.jsx`,
>   `OrdemParanormalSheet.jsx`, `Editor/CamadaDeNevoa.jsx` e `model/viagem.js`. `npm run build` sai
>   0, e **nenhum arquivo tocado aqui produz aviso**. Limpar os outros é escopo de outra spec.
> - **A casca do app ficou ligada, com UMA assinatura.** O `CampaignDetail` já observava
>   `sharedSheetsRepo.watchByCampaign` para o live-sync, mas guardava o resultado num ref **filtrado
>   pelo dono** — e a esquiva é do GRUPO. A lista inteira passou a cair também num `useState`, que
>   desce por `CampaignMapTab` até a mesa. Abrir uma segunda assinatura seria pagar duas vezes pelo
>   mesmo snapshot; o caminho do live-sync ficou intocado.
> - **PRÓXIMO PASSO — PENDENTE DO ANDRE:** validar no navegador e **commitar**. Nada foi commitado
>   em nenhuma das três sessões desta spec — são ~10 arquivos novos e ~10 tocados.

> **2026-08-05 (2): SPEC 0035 — F2 (runas autorais + barra do cartógrafo).**
> - **M3 · As runas.** `model/marcadores.jsx` novo: seis runas SVG (vila, masmorra, marco,
>   acampamento, missão, segredo) em traço, no dialeto do `RuneIco` — **sem importar o `RuneIco`**,
>   que mora na casca do app (`src/ui/`) e está fora da fronteira do mapa-múndi. Emoji saiu do
>   padrão dos dois palcos (ateliê e mesa).
>   **`ICONES_POR_TIPO` e `iconeDoNo` ficaram INTOCADOS de propósito:** `editor-modelo.test.js:337-340`
>   trava `iconeDoNo({type:"town"})` com `.toBe("🏘️")`, e o AC-9 proíbe editar suíte legada. A runa
>   entrou como camada nova por cima — o ícone que o MESTRE escolhe continua mandando, e o nó
>   `rumored` continua mostrando só "?" (se ganhasse runa, o desenho entregaria o tipo do lugar que
>   o jogador não pode conhecer).
> - **M4 · Barra do cartógrafo.** `Mesa/BarraDoCartografo.jsx` novo: lugar à esquerda, mostrador de
>   dia/noite girando pela hora ao centro, relógio à direita. Fica FORA da camada da câmera (não
>   encolhe com o zoom) e ACIMA da vinheta (informação, não cenário).
> - **⚠ O PLANO DIZIA "DATA GREGORIANA EM PT-BR". O DADO DESMENTIU O PLANO, E O DADO GANHOU.**
>   `party.inGameDatetime` é `{dia,hora,minuto}` ou número de horas corridas — **contador de dias de
>   campanha, não data de calendário**. Formatar como "05/08/2026" seria inventar ficção que o Nexus
>   não tem. Reusei `formatarRelogio` ("Dia 3 · 14:05") e `periodoDoDia`, que já existiam — uma fonte
>   só, sem tabela paralela de limites de hora. Sem relógio (`null`), a barra esconde mostrador e
>   hora em vez de inventar data (ADR-0011).
> - **ARMADILHA:** não existe `src/setupTests.js` neste projeto — **cada suíte de render importa
>   `@testing-library/jest-dom` por conta própria**. Sem isso, `toHaveTextContent` e
>   `toHaveAttribute` falham com "is not a function", que foi como 8 testes meus caíram.
> - **M8 NÃO FOI FEITO** — a `CartografiaPadrao.jsx` (hachura de terreno, rosa dos ventos em tinta,
>   anotações manuscritas) segue como escopo aberto da F2, junto da F3 inteira (cartão de
>   pergaminho e esquiva do encontro por teste de Furtividade).
> - **PENDENTE DO ANDRE:** validar no navegador e commitar. **NADA foi commitado** nas duas fases.

> **2026-08-05: SPEC 0035 — CARTOGRAFIA VIVA, F1 (rota bicolor + franja de tinta + moldura).**
> Andre gravou 48 s de *Pathfinder: WotR* e pediu o mapa-múndi "nesse nível". Achado que definiu o
> escopo: **a spec 0028 JÁ declarava o WotR como referência** (`0028/spec.md:11`) e a mecânica toda
> está entregue — viagem em velocidade constante na curva, relógio que avança, encontro por
> `dangerLevel` com peso por período, névoa em cápsula, acampamento. **A distância era quase toda de
> direção de arte.** Das 11 diferenças levantadas frame a frame, 9 são arte e 2 são mecânica.
> - **M1 · Rota bicolor.** `partirNoProgresso(pontos, t)` novo em `model/curves.js` (corte por
>   comprimento de arco, ponto **interpolado** dentro do segmento) e `trechoRestante` em
>   `model/viagem.js`, irmão de `trechoPercorrido`. **As duas metades compartilham o ponto de corte**
>   — é o que evita vão de meio pixel bem embaixo do marcador, que é onde o olho está.
>   `pintarRotaBicolor` em `Mesa/animacaoUi.js` pinta o restante em dourado e **delega o percorrido
>   ao `pintarRastro`**, só trocando a tinta pelo acento (parâmetro `rgb` novo, opcional) — sem
>   reimplementar as faixas de desvanecimento e sem deixar código morto.
> - **M2 · Franja de tinta.** `model/franja.js` novo: `contornoDaMascara` devolve só a casca
>   (4-vizinhança; **o lado de fora da grade conta como coberto**, senão a névoa na margem terminaria
>   sem contorno) e `tracosDaFranja` gera os riscos de pena. **A semente sai da POSIÇÃO da célula, não
>   do índice na lista** — sem isso a franja inteira se redesenharia a cada revelação e a borda antiga
>   piscaria. Cache por `mascara.revisao` no `CamadaDeNevoa`: varrer 240 000 células por quadro
>   derrubaria a mesa. `celulaAcesa` foi promovida a export do `fogMask` para o layout do bit
>   (`cy*colunas+cx`) continuar morando num lugar só.
> - **M7 · Moldura.** Vinheta + filete dourado em `.wmm-palco::after`. Só escurece, nunca clareia —
>   por isso não mexe nas medições de contraste do `f7-anim-tinta`.
> - **UM TESTE MEU PEGOU UMA IMPRECISÃO MINHA:** a asserção do desvio lateral media a distância crua
>   do meio do traço ao centro da célula, misturando o desvio lateral com a assimetria deliberada do
>   traço (0,35 para dentro, 0,65 para fora — pena que marca fronteira morde para fora). Corrigida
>   para projetar na perpendicular, e ganhou uma irmã que trava a assimetria.
> - **ARMADILHA CONFIRMADA:** o canvas 2D não resolve `var(--…)`. O acento chega resolvido por
>   `getComputedStyle`, mas resolvido pode ser `#c9a84c` **ou** `rgb(201, 168, 76)` conforme o
>   navegador — daí `rgbDeCor` aceitar os dois e cair numa reserva em vez de devolver cor inválida.
> - **PENDENTE DO ANDRE:** validar no navegador (viajar por uma trilha longa e conferir a rota
>   bicolor e a franja acompanhando a névoa) e commitar. **NADA foi commitado.**
> - **F2 e F3 NÃO foram iniciadas** — placas de local, runas autorais, barra do cartógrafo,
>   cartão de pergaminho e esquiva do encontro por Furtividade seguem como escopo aberto na
>   `specs/0035-cartografia-viva/tasks.md`.

> **2026-08-02: AS TRÊS ONDAS DE ARQUITETURA ESTÃO FECHADAS.** Ponto de partida: `App.jsx` com
> 11.454 linhas, 63 chamadas diretas ao Firestore e o SDK importado em 17 arquivos.
>
> | | Antes | Depois |
> |---|---|---|
> | `src/App.jsx` | 11.454 linhas | **439** |
> | Arquivos com `firebase/firestore` fora da infraestrutura | 17 | **0** |
> | Suítes / testes | 71 / 1.694 | **89 / 2.196** |
>
> - **Onda 1 (spec 0029)** — 7 repositórios por agregado, `paths.js` como única fonte de caminho,
>   política de erro `strict`/`silent` declarada em JSDoc. Fechou o vazamento de
>   `DocumentReference` guardado em `useRef`.
> - **Onda 1.5 (spec 0030)** — os 7 stores de feature (264 chamadas ao SDK) atrás da fronteira.
>   Exceção do ESLint de 7 arquivos a **zero**.
> - **Onda 2 (spec 0031)** — `App.jsx` virou orquestrador. `src/features/` com 9 contextos,
>   `src/ui/` com a casca, `src/lib/` com o compartilhado. **AC-1 atingido com folga (439 < 800).**
> - **Onda 3 (spec 0032)** — os 4 quirks corrigidos, `Timestamp` fora da fronteira, validação de
>   schema. Ver **ADR-0011**, que registra as dívidas do ADR-0010 como quitadas.
>
> **REGRA QUE VALE MAIS QUE O RESTO (ADR-0011):** a fronteira garante **TIPO**, nunca inventa
> **PRESENÇA**. Campo com tipo errado é coagido; campo ausente continua ausente. Preencher
> `system: "Genérico"` faria o `CampaignCard` (que renderiza com `{campaign.system && …}`) mostrar
> um selo em campanha que nunca escolheu sistema. Dado inventado é indistinguível do real.
>
> **⚠ ORDEM DE DEPLOY OBRIGATÓRIA:** `watchRolls` agora exige índice composto
> (`messages`: `type` ASC + `timestamp` DESC), declarado em `firestore.indexes.json`.
> **`firebase deploy --only firestore:indexes` PRIMEIRO, o build depois** — senão o feed de
> rolagens fica vazio.
>
> **BUG CRÍTICO DE 2026-07-25 FECHADO (Q4):** o autosave do mapa avançava a baseline ANTES de
> publicar e engolia o erro do commit — alteração que falhava nunca mais entrava num diff e o
> mestre perdia trabalho sem aviso. Agora a baseline só avança quando a escrita confirma, com
> backoff reusando o próprio ciclo do autosave, e aviso visível após 3 falhas seguidas.
> Cada conserto foi **provado por teste de mutação** (desfazer o conserto derruba o teste novo).
>
> **DÍVIDAS NOVAS, pequenas e datadas:** (a) `worldMapsRepo.observarPerfil` e
> `mapSyncRepo.getCampaignDoc` leem agregados alheios e ainda passam data crua (sem consumidor
> hoje); (b) `NavIco` (`src/ui/`) é **código morto** — nenhum chamador o monta, o menu usa
> `RuneIco`; (c) a validação cobre 5 dos 13 agregados, por decisão registrada no ADR-0011.
>
> **PENDENTE DO ANDRE:** validar no navegador e commitar. **NADA foi commitado.**

> **⚠ 2026-08-02: DUAS SESSÕES SIMULTÂNEAS NO MESMO WORKING TREE — leia isto antes de confiar
> no histórico abaixo.** Uma sessão fazia a spec 0033 (ficha de OP) e outra as specs 0029/0030/
> 0031 (camadas). Cada uma reescreveu este arquivo por cima da outra pelo menos duas vezes, e
> uma delas chegou a apagar `specs/0030/spec.md` inteira e o `__tests__/publicSheetsRepo.test.js`.
> **Nenhum código se perdeu** (os arquivos-fonte eram disjuntos), mas os registros se perderam e
> foram reconstruídos. **Sintoma para detectar isso:** a contagem de testes CAI entre duas
> execuções. Se for retomar com mais de uma sessão, dê a cada uma um worktree separado.

> **2026-08-02: SPEC 0030 — ONDA 1.5 ENTREGUE. A FRONTEIRA ESTÁ FECHADA DE VERDADE.**
> Os 7 stores de feature (3.740 linhas, **264 chamadas ao SDK**) passaram a consumir
> repositórios. **Nenhum arquivo fora de `src/infrastructure/` importa `firebase/firestore`** —
> verificado por grep, e a lista de exceção do ESLint foi de 7 arquivos a **ZERO**
> (restam só `src/infrastructure/**`, `src/firebase.js` e os testes).
> - Repositórios novos: `worldMapsRepo` (61 testes), `mesaRepo`, `fogRepo` (18),
>   `worldsRepo` (44), `assetsRepo` (9), `mapSyncRepo` (44).
> - **A LÓGICA FICOU NOS STORES (AC-3)**, que era o risco da onda: RLE+varint da névoa,
>   redução de imagem em 2 estágios, dedup por hash, `seedDemoWorld`, diff de elementos,
>   cotas por plano, validações PT-BR. Os repos só endereçam, leem e gravam.
> - **`writeBatch` não vazou.** `worldsRepo`/`mapSyncRepo` expõem `commitBatch(ops)` com
>   `{op,path,data}`; o `worldMapsRepo` preferiu 3 funções de alto nível
>   (`apagarMapaEmCascata`, `apagarNoComTrilhas`, `semearGrafo`) porque uma lista genérica
>   obrigaria o store a remontar endereços — o oposto do que o ADR-0010 quer.
> - **`increment()` e `serverTimestamp()` também não atravessam**: viraram `{delta, absoluto}`
>   e sentinelas traduzidos na borda (`SERVER_TIME` como Symbol no `mapSyncRepo`, para não
>   colidir com texto de nota do usuário).
> - **Índices compostos preservados** com teste dedicado (`where("ownerUid","==")` +
>   `orderBy("updatedAt","desc")`).
> - **TODAS as suítes legadas passaram SEM EDIÇÃO** — é a evidência do AC-7.
>
> **GANHO IMPREVISTO PARA A ONDA 3:** a perda silenciosa de dados do autosave ficou **isolada
> num ponto só** — `mapSyncRepo.commitBatchSilent`, com o problema documentado no JSDoc. Antes
> estava espalhada por 4 lugares. O Q4 da spec 0032 ficou muito mais simples de executar.

> **2026-08-02: SPEC 0029 — CAMADA DE INFRAESTRUTURA (repositórios Firestore). ENTREGUE.**
> O `App.jsx` tinha **63 chamadas diretas ao Firestore** e o SDK era importado em 17 arquivos.
> - Nova camada `src/infrastructure/firestore/`: `paths.js` (único lugar com string de coleção),
>   `client.js` (`docAt`/`colAt` + envelope `silent`) e 7 repositórios por agregado.
> - **AC-5 — a fronteira é executável**: `no-restricted-imports` no `package.json`, **provado
>   nos dois sentidos** (arquivo fora da fronteira → erro; arquivo isento → limpo). A armadilha
>   "config morta" já mordeu este projeto 4 vezes.
> - **VAZAMENTO FECHADO:** o `App.jsx` guardava `DocumentReference` cru num `useRef`
>   (`liveSheetRefsRef`) e escrevia nele ~200 linhas depois — ref que sobrevive à desmontagem do
>   listener. Agora atravessa `{campaignId, sheetId}` em string, com teste que asserta sobre a
>   FORMA do payload.
> - **Domínio extraído:** `characterKey`/`isSameCharacter`, `domain/campaign.js` (código de
>   convite, que estava DUPLICADO) e `domain/creature.js` (`clampHp`).
> - **3 bugs pré-existentes que quebravam o build** foram corrigidos (crase dentro de template
>   literal de CSS; `{/* */}` em posição de expressão, 2×).
> - **QUIRKS PRESERVADOS DE PROPÓSITO (AC-7), cada um com teste que os trava** — e que a spec
>   0032 vai virar: contagem de campanhas assimétrica, `watchRolls` sem `orderBy`, e
>   `hpCurrent === 0` lendo `hpMax` (`parseInt(...) || max`, e `0` é falsy).

> **2026-08-02: SPEC 0031 — ONDA 2 (quebrar o App.jsx) INICIADA.**
> `App.jsx`: **11.454 → 10.704 linhas**. Primeira feature extraída: `src/features/musica/`
> (as 3 telas + `audioDb`, `musicaApi`, `musicaUtils`). Faltam ~63 componentes de topo; o alvo
> do AC-1 é **< 800 linhas**. Specs 0031 e 0032 escritas e prontas para execução.

> **2026-08-03 (2): SPEC 0034 — MESA DE EFEITOS + PACOTE DE VOZES.** Andre pediu efeitos sonoros
> "lá dentro" (mulher gritando, criança chorando, criança falando oi, sons de terror).
> - **A mesa é mecanismo DIFERENTE da trilha, e isso define o módulo:** trilha substitui o que
>   toca; efeito dispara POR CIMA. Por isso `MesaDeEfeitos.jsx` não passa pelo player — cada
>   disparo cria seu próprio `<audio>`, toca e morre, o que também deixa dois efeitos soarem
>   juntos. Teclas 1-9 disparam, Esc corta tudo sem encostar na música. Volume por efeito.
> - **`efeitos.js`** puro, 21 testes. Acervo em `nx_efeitos` (localStorage) + binário no IndexedDB
>   `nexus_audio` já usado pelas playlists.
> - **PACOTE INICIAL EMBUTIDO** (`public/sfx/`, 8 vozes, **539 KB**): botão "Carregar vozes" puxa
>   para o IndexedDB do mestre com um clique. **Por que ESTES podem morar no app e as TRILHAS
>   não:** meio mega contra ~12 MB. Arquivo em `public/` não entra no bundle JS, só engorda o
>   artefato de deploy. Doze megas seria abuso; meio não é.
> - **AS VOZES NÃO SAÍRAM DO MINIMAX.** O MCP dele caiu no meio da sessão e a **Higgsfield está
>   SEM CRÉDITO** (plano free — as 8 submissões voltaram "Out of credits"). Gerei pela **Morpfix
>   (ElevenLabs multilingual)**, que tinha saldo. Português bom, mas outro motor.
> - **NÃO EXISTE VOZ DE CRIANÇA** em provedor nenhum — usei a feminina mais jovem (Juniper). Soa
>   como mulher jovem. Se incomodar, tentar MiniMax ou clonagem de voz.
> - **FOLEY CONTINUA IMPOSSÍVEL** (porta, vidro, passos, estática): nenhum provedor conectado gera
>   efeito sonoro. Não é limitação de prompt. Saída = fonte livre de direitos.
> - Gate: **97 suítes / 2333 testes** com `--runInBand`, build compilado, 8 arquivos em `build/sfx`.

> **2026-08-03: SPEC 0034 — CENAS SONORAS DA MESA.** Andre pediu trilhas e efeitos sonoros de
> Ordem Paranormal gerados por IA. **NÃO DÁ — e o motivo está registrado na spec para ninguém
> tentar de novo sem checar:** a ferramenta de áudio da Higgsfield só gera FALA e manda recusar
> pedidos de música/SFX (os modelos `sonilo_music`/`mirelo_text_to_audio` são exclusivos do
> pipeline de jogos); a Morpfix só tem TTS da ElevenLabs; e o **MiniMax não resolve** — seu
> `music_generation` exige LETRA obrigatória (gerador de canção, não de ambiência) e ele **não tem
> ferramenta de efeito sonoro nenhuma**. Some-se o produto: a tela de Trilhas é um AGREGADOR
> (playlists do YouTube/Spotify do mestre + MP3 dele no IndexedDB local, que nunca sobem ao
> Firestore) — não há onde publicar acervo gerado.
> - **O que foi entregue no lugar, escolhido pelo Andre:** oito **cenas** de OP (Investigação,
>   Tensão, Terror, Combate, Perseguição, Ritual, O Outro Lado, Interlúdio — os nomes seguem o
>   vocabulário mecânico do livro), cada uma vinculada a uma playlist que ele já tem. Um clique
>   troca a trilha durante a narração.
> - **`cenas.js`** é lógica pura (26 testes; metade sobre entrada suja, porque o vínculo mora no
>   localStorage, que é editável à mão). **`CenasSonoras.jsx`** é a tira. Ligado no `MusicScreen`,
>   acima da grade, sumindo quando o mestre entra numa playlist.
> - **Decisão de UX que vale manter:** tocar e configurar são **modos separados**. Com a mesa
>   rodando, clicar numa cena SÓ toca; nada revincula sem entrar em "Vincular trilhas".
> - **Vínculo órfão avisa em vez de sumir:** playlist apagada depois de vinculada deixa a cena
>   listada, marcada indisponível, dizendo qual se perdeu.
> - **ARMADILHA:** `globalThis` **não passa** no ESLint do preset do CRA (`no-undef`) — quebrou o
>   build. Módulo puro que precisa de `localStorage` resolve o padrão em chamada, com guarda de
>   `typeof window`, e aceita storage injetado (que é o que os testes usam).
> - **`.mcp.json` ganhou o servidor `minimax`** com `${MINIMAX_API_KEY}` (padrão do
>   `${GITHUB_TOKEN}`; nenhum segredo no arquivo). Falta a chave no ambiente + restart. Vale para
>   **voz do mestre** (spec 0017) e nada mais — não para trilha, não para SFX.
> - Gate: **90 suítes / 2222 testes** com `--runInBand`, build "ready to be deployed".

> **2026-08-02: SPEC 0033 — PROGRESSÃO AUTOMÁTICA DE ORDEM PARANORMAL.** Andre pediu que a evolução
> seja automática "de acordo com as regras do livro", para o jogador não precisar preencher tudo, e
> apontou o PDF oficial no Desktop. **Só Ordem Paranormal** (D&D e Tormenta intocados).
> - **Camada de texto do PDF extraída** (330 pg., pypdf, para o scratchpad — o PDF continua FORA do
>   repo). A capa diz **v1.2** (mai/2023), embora o arquivo se chame "1.4": o registro de
>   atualizações da pg. 8 é o da 1.2. Tabelas 1.2 a 1.5 conferidas linha a linha.
> - **Módulo novo `progressao/`**: `tabelas.js` (transcrição pura do livro: PV/PE/SAN por classe,
>   os 20 marcos de NEX de cada classe, pré-requisitos de poder, bônus de origem que escalam) e
>   `motor.js` (`derivar` · `pendencias` · `aplicar` · `planoDeAvanco` · `reverterPara` ·
>   `linhaDoTempo`). Puro, sem React e sem Firestore. **54 testes** próprios.
> - **A ideia central:** o motor separa o que o livro DECIDE do que o livro manda ESCOLHER. O que é
>   decidido entra sozinho; o que é escolha vira uma "pendência" com as opções já validadas — e as
>   inválidas vêm com o motivo escrito ("Falta: NEX 30%.").
> - **Livro-razão** (`ficha.progressao.marcos`, aditivo, Firestore é schemaless): guarda o que foi
>   concedido em cada degrau. É ele que torna o motor **idempotente** (rodar 2× não duplica) e
>   **reversível** (baixar o NEX desfaz só o que o motor deu). Habilidades ganham
>   `origem:{marco,ref,motor}` — sem esse carimbo, o motor nunca toca.
> - **UI:** `EvolucaoModal.jsx` (assistente passo a passo, modos "avanço" e "auditoria") e a aba
>   **Progressão** — que **já existia no repo e estava ÓRFÃ** (`ProgressaoTab.jsx` não era importado
>   por ninguém; a lista de abas da ficha nunca a incluiu). Agora é o painel de controle.
> - **SEIS DIVERGÊNCIAS DO CÓDIGO CONTRA O LIVRO, corrigidas:** (1) Grau de Treinamento era 5+INT
>   para as três classes; o livro dá **2+Int combatente, 5+Int especialista, 3+Int ocultista**.
>   (2) `defaultTrainedSet` inventava 5 perícias fixas por classe; o livro faz disso uma **escolha**
>   (só o ocultista tem 2 fixas). (3) Combate Defensivo pedia INT 1, o livro pede **Int 2**.
>   (4) Combater com Duas Armas pedia AGI 2, o livro pede **Agi 3 + treinado em Luta ou Pontaria**.
>   (5) Não havia checagem de poder repetido — o livro proíbe salvo indicação; **isso foi achado por
>   um teste que escrevi esperando que já funcionasse, e falhou**. (6) Calejado (Desgarrado),
>   Cicatrizes Psicológicas (Vítima) e Dedicação (Universitário) escalam com o NEX e **não mexiam em
>   número nenhum** — eram texto decorativo; agora entram em `derivar`.
> - **`nexStats` deixou de ter tabela própria** e lê `progressao/tabelas.js` (mesmos números); a
>   ficha passou a usar `derivar()` nos dois pontos onde chamava `nexStats`, o que traz junto os
>   bônus de origem.
> - **ARMADILHA DO RUNNER (não é desta leva):** no modo paralelo padrão, 4 suítes falham
>   (`mesaStore`, `f7-mesa-store`, `forja-render`, `editor-store`) com `ReferenceError: onSnapshot is
>   not defined` vindo de `worldMapStore.js` — do refactor em andamento das specs **0030-0032** que
>   está na árvore sem commit. Elas **passam isoladas** e o run inteiro **passa com `--runInBand`:
>   84 suítes / 2082 testes, exit 0**. Use `--runInBand` como gate até aquilo fechar.
> - **A REVERSÃO ACIDENTAL DESCRITA ABAIXO ME ATINGIU TAMBÉM:** a pasta `progressao/` inteira e o
>   `progressao.test.js` foram **apagados do disco** depois de criados e testados com sucesso (os 54
>   testes já tinham rodado verdes). Recriei os arquivos. **Confira que
>   `src/components/systems/OrdemParanormal/progressao/` existe** antes de confiar num build.
> - **"É VETERANO MESMO" (decisão do Andre, mesma sessão).** O grau +10 voltou a se chamar
>   **Veterano** — nome do livro oficial. O **AC-3 da spec 0024 fica SUBSTITUÍDO** pelo AC-16 da
>   0033 (aviso inserido na spec 0024, sem apagar o texto histórico). Trocado em `TREINO_TIERS`,
>   no `tLabel` da ficha, no `ROTULO_GRAU` do motor, em `regras-oficiais.json`, nos textos de
>   Competência em Perícia / Expert em Perícia / Engenhosidade e no `conteudo-0024.test.js`.
>   **Lição:** a 0024 renomeou Veterano→Competente a partir de fonte secundária porque o livro
>   ainda não estava disponível; com o PDF em mãos, a fonte secundária estava errada.
> - **Pendente do Andre:** (1) validar no navegador (subir um degrau pelo assistente, conferir
>   PV/PE/SAN e habilidades, depois "Voltar" um degrau e conferir que a anotação própria continua
>   lá); (2) commitar/deployar.
>
> **MESMA SESSÃO — PAINEL (`/painel`) + MCP DO MINIMAX.** Andre pediu para usar o MiniMax da
> assinatura dele no layout do painel. **O MiniMax não faz isso:** o MCP oficial expõe 10
> ferramentas (`text_to_audio`, `voice_clone`, `voice_design`, `music_generation`, `text_to_image`,
> `generate_video`…) e **nenhuma desenha layout ou escreve código**. Registrado em `.mcp.json` mesmo
> assim, com `${MINIMAX_API_KEY}` (padrão do `${GITHUB_TOKEN}`, nenhum segredo no arquivo) — vale
> para o que ele É bom e está parado no roadmap: **voz do mestre** (`narracao-mestre.mp3`, item
> aberto da 0017) e **trilhas sonoras**. Precisa da chave em env + restart do Claude Code.
> - **ACHADO — mais um número inventado sobreviveu à limpeza anterior.** O comentário do
>   `Dashboard.jsx` dizia que sobraram "só os três que saem de estado real"; **"Sessões" não sai**.
>   `setSessions` NUNCA é chamado no App.jsx (só o inicializador e o efeito que regrava o mesmo
>   array vazio no localStorage) — era 0 permanente com cara de dado. Removido; a faixa agora tem
>   DOIS números e os dois são verdadeiros. `Dashboard` deixou de receber a prop `sessions`.
> - **`.nx-list-cards` novo:** o DossierCard tem borda e raio próprios, mas era empilhado num
>   `.nx-list` que separa por filete e **sem gap** — dois cartões encostados somavam bordas num
>   traço duplo. A lista de OP passa a usar a variante com respiro; a de linhas segue sem gap.
> - **Faixa de números não empilha mais no celular** (media query 640px): três blocos empilhados
>   custavam ~150px de altura, jogando "Seus personagens" abaixo da dobra por causa de contadores
>   de um dígito. Agora ficam lado a lado, com tipo e padding menores.
> - **ARMADILHA (caí nela, e ela já estava documentada nesta mesma STATE):** pus `{/* … */}` em
>   posição de EXPRESSÃO (depois de `) : (`), onde `{}` é objeto literal e não comentário JSX — o
>   build quebrou com "Unexpected token, expected ','". Resolvido hoistando a classe para uma const
>   com comentário JS normal. **Se precisar comentar ali, comente ACIMA do ternário.**
> - Gate: **89 suítes / 2196 testes** com `--runInBand`, build "ready to be deployed".

> **⚠ 2026-08-02: REVERSÃO PARCIAL ACIDENTAL DO WORKING TREE — leia antes de confiar no histórico.**
> No meio da sessão, um conjunto de arquivos voltou a um estado anterior **sem que ninguém pedisse**.
> O CÓDIGO migrado sobreviveu (`src/infrastructure/` inteiro e o `App.jsx` sem SDK), mas voltaram
> atrás: a regra ESLint do `package.json`, esta entrada do STATE, a seção nova do `context-map.md`,
> o bloco de status do `tasks.md` da 0029, a correção do `Date.now()` no `publicSheetsRepo.js` e o
> arquivo `__tests__/publicSheetsRepo.test.js` (apagado). Tudo foi **reaplicado**. Detectado pela
> queda na contagem de testes (78/1848 → 77/1820) — vale conferir essa contagem ao retomar.

> **2026-08-02: SPEC 0029 — CAMADA DE INFRAESTRUTURA (repositórios Firestore). ENTREGUE.**
> Andre perguntou se o back/front estavam separados com camadas de serviço. Resposta honesta era
> "parcialmente": `domain/`, hooks e stores de feature existiam, mas o **App.jsx tinha 63 chamadas
> diretas ao Firestore** e o SDK era importado em 17 arquivos.
> - **Nova camada `src/infrastructure/firestore/`**: `paths.js` (único lugar com string de coleção),
>   `client.js` (`docAt`/`colAt` + envelope `silent` da política de erro) e **7 repositórios por
>   agregado** — users, characters, campaigns, messages, sharedSheets, bestiary, publicSheets.
> - **AC-1 cumprido e VERIFICADO**: `grep "firebase/firestore" src/App.jsx src/hooks/` não retorna
>   nada.
> - **AC-5 — a fronteira agora é executável**: `no-restricted-imports` no `package.json`.
>   **Provado nos dois sentidos** (a armadilha "config morta" já mordeu este projeto 4 vezes):
>   arquivo temporário fora da fronteira → erro do lint; `usersRepo.js` (exceção) → limpo.
> - **VAZAMENTO FECHADO (o motivo principal da spec):** `App.jsx` guardava `DocumentReference` cru
>   num `useRef` (`liveSheetRefsRef`) e escrevia nele ~200 linhas depois. A ref sobrevive à
>   desmontagem do listener que a produziu. Agora atravessa `{campaignId, sheetId}` em string, com
>   teste dedicado que asserta sobre a FORMA do payload (docs semeados com `.ref = {__sdk:true}`).
> - **Domínio extraído**: `characterKey`/`isSameCharacter` (a regra `id || createdAt` que mantém
>   ficha legada acessível), `domain/campaign.js` (código de convite — estava **duplicado** em
>   useCampaign e App.jsx —, teto de 3, `isFull`) e `domain/creature.js` (`clampHp`).
> - **CÓDIGO MORTO REMOVIDO:** `fsGetUserPlan` e `fsGetMusicLinks` (definidos, nunca chamados).
>
> **TRÊS BUGS PRÉ-EXISTENTES QUE QUEBRAVAM O BUILD** — vinham de trabalho não-commitado da sessão
> anterior (fluidez do hero de campanha), provados por `git diff` (linhas com `+`), não meus:
> (1) comentário com **crases dentro do template literal** de CSS do `G` — a crase fecha a string;
> (2) `{/* … */}` em posição de **expressão** (após `? (` e `return (`), onde `{}` vira objeto
> literal — 2 ocorrências. Corrigidos, com comentário explicando a armadilha em cada ponto.
>
> **QUIRKS DO LEGADO PRESERVADOS DE PROPÓSITO (AC-7), cada um com teste que os trava:**
> (a) `countActiveByMasterAndSystem` filtra `isActive` NA QUERY e `countActiveByMemberAndSystem`
> filtra EM MEMÓRIA — campanha antiga sem o campo é invisível numa e visível na outra, então o
> mestre fura o teto ao CRIAR e é barrado ao ENTRAR; (b) `watchRolls` limita **sem `orderBy`**, logo
> o corte traz rolagens arbitrárias, não as mais recentes; (c) `currentHp` de criatura com
> `hpCurrent === 0` devolve `hpMax` (o legado fazia `parseInt(...) || max`, e `0` é falsy).
> Consertar qualquer um MUDA o que o usuário vê — foi adiado para a onda 3.
>
> **PARALELISMO QUE FUNCIONOU:** agentes com **arquivos exclusivos**, e o `App.jsx` reservado ao
> orquestrador. Nenhum atropelo (contraste com a spec 0027, onde dois agentes na mesma pasta se
> sobrescreveram). O agente de testes **encontrou uma violação real do AC-3** que passara batido:
> `messagesRepo.send` devolvia o `DocumentReference` do `addDoc` no caminho feliz. Corrigido.
>
> - **PENDENTE DO ANDRE:** validar no navegador (login, ficha, campanha, chat, bestiário, ficha
>   pública por link, elemento pelo painel do mestre) e commitar/deployar. **Nada foi commitado.**

> **2026-08-01 (tarde): SPEC 0028 — FUNDO DO MAPA-MÚNDI DESTRAVADO PELO PLANO B.** O Andre decidiu:
> *"vamos fazer no gratuito hoje, quando estivermos finalizando o desenvolvimento do projeto eu faço
> isso"* (subir para Blaze). Registrado no **ADR-0009**, que resolve o ADR-0008 escolhendo a opção B.
> - `uploadBackground` agora tem **dois caminhos** com o mesmo contrato
>   (`{url, path, width, height}`), escolhidos por `fundoDisponivel()`: Storage (escrito, com
>   `import()` dinâmico, esperando o Blaze) e **base64 no Firestore** (o que roda hoje).
> - Base64 segue o padrão da casa (`campaignSync2.js`): dois estágios de redução (1600/q0.82 →
>   1200/q0.7), teto `LIMITE_FUNDO_BYTES = 900.000`, dedup por hash SHA-256, cache de módulo.
>   Acima do teto, **recusa em PT-BR** — nada é gravado pela metade.
> - A ilustração mora em documento **separado** (`.../worldmaps/{mapId}/media/background`); o doc
>   raiz guarda só `backgroundRef` + miniatura de ~200px. Isso é o que impede `useWorldMaps` de
>   trafegar todos os fundos inteiros a cada snapshot — **tem teste de regressão dedicado**.
> - **Lacuna fechada:** `WorldMap/__tests__/worldMapStore.test.js` existe (29 testes). Total:
>   **627 testes / 40 suítes**, build Compiled, `MapEditor/` intocado (AC-12).
> - **Próximo passo:** F2 (editor de grafo — nós e trilhas). Quando o Andre subir para Blaze, ver a
>   lista de 5 itens em ADR-0009 §"O que muda quando o Andre subir para o Blaze".

> **2026-08-02: SPEC 0028 — MAPA-MÚNDI, F2 a F6 ENTREGUES E NO AR.** Gate: **63 suítes / 1550
> testes**, build Compiled, `MapEditor/` intocado em toda fase (git diff vazio — AC-12).
> - **F2** editor de grafo + MAPA PADRÃO (12 nós / 16 trilhas, ambientado na mesma *Coroa de
>   Cinzas* do mundo demo da Forja; carta VETORIAL de 23 KB embutida, sem peso no Firestore).
>   Render híbrido: canvas pinta fundo e trilhas, DOM carrega os nós virtualizados.
>   **ARMADILHA:** o padrão foi criado na F2 mas NÃO era oferecido na lista — só virou visível na
>   F3. Eu afirmei ao Andre que já aparecia; estava errado.
> - **F3** névoa em bitmap (1 bit/px, downscale 4x, RLE+varint). MEDIDO: névoa típica de sessão
>   **2,3 KB**, mapa vazio **21 B** — 390× abaixo do teto de 900 KB. O Storage bloqueado não faz
>   falta. Mais o padrão dispensável/restaurável (marca em `users/{uid}`, FORA da coleção de
>   mapas: doc de config ali contaria na cota e o mestre free perderia a vaga dele).
> - **F4** a mesa: viagem animada pela curva em velocidade constante, névoa abrindo ao longo do
>   trecho percorrido, console de "Revelar agora". Rules: o teto de **20 access calls por lote**
>   (o bug que esvaziou o mundo demo da Forja) foi resolvido pondo o uid do mestre NO ID da
>   instância — a regra faz split de string, zero `get()`.
> - **F5** eventos com os 6 gatilhos + procura por passagens secretas. Extraído
>   `src/domain/dice.js`: havia **SEIS** cópias de rolagem inline no App.jsx (uma a mais que o
>   levantamento achou). Diferenças reais preservadas (dialeto com/sem contagem, 3 regras de
>   crítico, tetos que só uma tinha).
> - **F6** encontros e acampamento, sempre em DUAS etapas: sorteio no cliente do mestre →
>   `gm.pendingEncounter` (que o jogador nem lê) → decisão → só então publica.
>
> **O PADRÃO DE SEGREDO QUE SE REPETIU EM TODA FASE** (vale para quem continuar): segredo não
> vaza pelo dado, vaza pela DIFERENÇA. Por isso: a recusa de viagem é a mesma frase para "não há
> trilha", "é secreta" e "está oculta"; a falha da procura é idêntica à de um lugar vazio; o botão
> "Procurar aqui" aparece em TODO nó (se só surgisse onde há segredo, ele seria a resposta); a
> pausa do encontro é neutra ("a mesa está com o mestre"), e desligar APAGA a flag em vez de
> gravar `false`. Vários desses foram verificados por MUTAÇÃO — quebrar o código de propósito e
> conferir que o teste cai.
>
> **PENDÊNCIAS CONHECIDAS:** (1) acampar em trânsito é letra morta — exige estado de viagem
> persistido (F7); (2) `pendingEncounter` não tem tempo real — duas abas do mestre podem se
> sobrescrever; (3) bônus de rolagem é digitado pelo mestre: a ficha do personagem não chega ao
> mapa-múndi; (4) o pedido de procura do JOGADOR só avisa a mesa — validar no cliente dele exigiria
> ler o segredo (alternativa descartada no design §3).
>
> **AINDA VALE:** Storage segue bloqueado (Spark); o Andre decidiu subir para Blaze só ao
> finalizar o projeto. Fundo em base64, ADR-0009.

> **2026-08-01: SPEC 0028 — MAPA-MÚNDI (exploração + névoa), FASE 1 ENTREGUE.** Briefing do Andre
> pedindo mapa-múndi estilo Pathfinder: WotR, com visão de mestre e de jogador.
> - **F0 (descoberta)** achou 5 contradições com o briefing. A maior: **não existe servidor** — sem
>   Cloud Functions, cliente fala direto com o Firestore, e rules são tudo-ou-nada por documento.
>   Hoje o Nexus **não tem segredo real**: névoa e tokens `hidden` viajam inteiros ao jogador e são
>   só filtrados no render.
> - **Arquitetura ATELIÊ/MESA** (design.md), aprovada pelo Andre: o molde vive em
>   `users/{uid}/worldmaps` (privado; a aba Mapas vira a oficina do mestre) e a campanha recebe uma
>   INSTÂNCIA com só o que foi revelado. **A separação de documento É o mecanismo de segredo** —
>   satisfaz o AC-1 sem servidor e sem Blaze.
> - **F1 entregue:** aba Mapas com 3 sub-abas (Mesas Táticas / Mapas-Múndi / Tokens), CRUD do molde,
>   cotas por plano, rules do ateliê. **595 testes / 39 suítes verdes**, build Compiled,
>   `MapEditor/` intocado (git diff vazio — AC-12).
> - **BLOQUEIO PARA O ANDRE — Firebase Storage não existe.** Provado por HTTP cru: 404 (bucket
>   inexistente), não 403. `firebase.js:9` declara um bucket nunca provisionado; criar exige
>   **plano Blaze** (projeto está no Spark). Opções no ADR-0008: (A) subir para Blaze — destrava
>   também Cloud Functions e a exploração assíncrona; (B) base64 no Firestore, teto ~900 KB.
>   O upload está implementado atrás de `fundoDisponivel()`; quando o bucket subir, o flag vira.
> - **Achado:** não existe string de plano pago no código. Só `'free'` é real; quem pagou é
>   detectado por `users/{uid}.subscribedSystems`. `fsGetUserPlan` (App.jsx:86) é código morto.
> - **Lacuna assumida:** falta `worldMapStore.test.js` (o gate do AC-2 pede).
> - **Próximo passo:** decisão do Andre sobre Blaze; depois F2 (editor de grafo).

> **2026-07-31: SPEC 0027 — FORJA DO MESTRE (Ajudante do Mestre 2.0), FASE 1.** Andre pediu que
> o Ajudante do Mestre deixe de ser IA e vire uma suíte de worldbuilding/sessão "igual ao
> WorldCraft" (worldcraft.com.br), clonando TODAS as funcionalidades. O site foi explorado
> logado (mundo demo) e o inventário está na spec. Fase 1 (Fundação) em andamento:
> - **IA REMOVIDA**: 577 linhas do App.jsx (bloco MASTER AI ASSISTANT: RPG_ONLY_RULE,
>   SYSTEM_PROMPTS, callGemini, generateSceneImage, MasterAssistant). App.jsx 12.586 → 12.011.
>   Cópia de produto ajustada (card do dashboard, 3 planos, roadmapData). Gate
>    impede o retorno da IA.
>   **ARMADILHA**:  vivia DENTRO desse bloco e é usado pelo fluxo PIX
>   (createPixPayment) — foi restaurado perto do uso. Confira antes de remover blocos grandes.
> - **Camadas prontas** ():  puro (entityTypes 11 tipos,
>   entityFilters, connections, dashboardStats, demoWorld) +  (Firestore:
>   worlds/{id}/{entities,connections,folders}, hooks onSnapshot, seedDemoWorld em writeBatch).
> - **UI ENTREGUE**: casca (seletor de mundo, rail de 9 ferramentas com 7 marcadas "Em breve",
>   estado vazio, React.lazy + error boundary), Painel (11 contadores, recentes, primeiros passos)
>   e Wiki completa (grade/lista, filtros, busca sem acento, pastas, detalhe com conexões pelo
>   lado certo, modal de criar/editar). 27 arquivos em `src/components/MasterSuite/`.
> - **Gate final: 36 suítes / 485 testes PASS**, build "Compiled" (warnings pré-existentes de
>   outros arquivos). Testes da suíte: 161 (91 lógica pura + 36 store + 25 renderização + 9 anti-IA).
> - **ARMADILHA DE PARALELISMO**: dois agentes na mesma pasta se atropelaram — o da casca gravou
>   um placeholder por cima do `Wiki/index.jsx` do outro. Ao paralelizar, dê a cada agente uma
>   pasta exclusiva.
> - **ARMADILHA DE TESTE**: o preset Jest do CRA usa `resetMocks: true` — implementações passadas
>   na fábrica do `jest.mock` são apagadas antes de cada teste; reinstale no `beforeEach`.
> - **Correção de bug pré-existente**:  (peer do RTL 16) não estava
>   instalado — 3 suítes RTL estavam vermelhas. Instalado em devDependencies.
> - **PENDÊNCIAS MANUAIS DO ANDRE (não feitas por mim):**
>   1. [1m[37m===[39m Deploying to 'nexus-rpg-app'...[22m

[36m[1mi [22m[39m deploying [1mfirestore[22m
[36m[1mi  firestore:[22m[39m ensuring required API [1mfirestore.googleapis.com[22m is enabled...
[36m[1mi  firestore:[22m[39m ensuring required API [1mfirestore.googleapis.com[22m is enabled...
[36m[1mi  cloud.firestore:[22m[39m checking [1mfirestore.rules[22m for compilation errors...
[32m[1m+  cloud.firestore:[22m[39m rules file [1mfirestore.rules[22m compiled successfully
[36m[1mi  firestore:[22m[39m uploading rules [1mfirestore.rules[22m...
[36m[1mi [22m[39m [1m[36mfirestore: [39m[22mdeploying indexes...
[32m[1m+  firestore:[22m[39m released rules [1mfirestore.rules[22m to [1mcloud.firestore[22m

[32m[1m+ [22m[39m [1m[4mDeploy complete![24m[22m

[1mProject Console:[22m https://console.firebase.google.com/project/nexus-rpg-app/overview — as regras novas do bloco  só valem
>      após o deploy.
>   2. **Índice composto** no Firestore: coleção , .
>      Sem ele o  falha (o erro traz o link de criação).
> - **Próximo passo:** Andre validar no navegador (E4, único item aberto da Fase 1); depois
>   Fase 2 (Grafo interativo de conexões).

> **2026-07-25 (11): SPEC 0026 — CONTEÚDO DO LIVRO v1.4 (itens antes bloqueados por fonte).**
> Andre forneceu o PDF oficial ("Ordem Paranormal 1.4 (2).pdf", Desktop/livros ordem paranormal,
> 330 pg. — FORA do repo). Camada de texto extraída e verificada página a página. Entregue:
> - **Poderes Paranormais** (novo `poderes-paranormais.json`, 22: Aprender Ritual + Resistir a
>   Elemento + 5 por elemento, pgs 122-124, parafraseados) — o placeholder "aguarde expansão"
>   do HabilidadesTab virou lista real com chips por elemento; destrava o Transcender.
> - **Equipamento geral** (tabela 3.8, pg 63): +21 itens `tipo:geral` → 38 gerais / 97 itens.
> - **Modificações** (novo `modificacoes-oficiais.json`, 23 das tabelas 3.5/3.7/3.9) + seção
>   "Modificações" na aba Armas da biblioteca (regra: cada modificação = +I categoria).
> - **Origem Servidor Público** (pg 20-21): Intuição/Vontade, Espírito Cívico → 25 origens.
> - Gate: 28 suítes/324 testes PASS, build exit 0. Specs `specs/0026-conteudo-livro-v14/`.
> - **Aberto p/ auditoria futura:** diffs v1.1→v1.4 no conteúdo já codificado (rules.js foi
>   verificado contra v1.1; o livro agora está disponível para conferência fina — ex.: notação
>   de dados ±O do v1.4, texto exato de poderes de classe/trilhas).

> **2026-07-25 (10): SPEC 0025 — BIBLIOTECA DO MESTRE COM FONTE ÚNICA.** Auditoria pós-0024
> achou 4 lacunas; Andre aprovou ("FAÇA ISSO"). Entregue o item 2 (consistência):
> - **Aba Rituais** do BestiaryTab agora consome `rituais-oficiais.json` (85, os mesmos da
>   ficha; custo derivado do círculo 1/3/6/10 PE; descricao HTML via dangerouslySetInnerHTML,
>   padrão do RituaisTab). **Aba Armas** consome as 28 armas de `itens-oficiais.json`
>   agrupadas por proficiência oficial, com crítico/categoria/espaços.
> - **OP_RITUAIS (107 linhas) e OP_ARMAS (29) REMOVIDOS** do App.jsx — mestre e jogador viam
>   números divergentes (ex.: Katana 1d8 vs 1d10 crít. 18). Fonte única agora.
> - Gate: 27 suítes/317 testes PASS, build exit 0 (warnings pré-existentes: fs* legados no
>   App.jsx L44-89 e tStat importado sem uso no RituaisTab — NENHUM introduzido nesta leva).
> **BLOQUEADOS POR FONTE (itens 1/3/4 da auditoria — NÃO implementados, decisão consciente):**
> - **Poderes Paranormais por elemento** (placeholder na UI continua; Transcender referencia
>   escolha que não existe no app), **equipamentos gerais/modificações de armas** (17 vs ~40 do
>   livro) e **origem Servidor Público** (existe no livro, mecânica não confirmada).
> - Motivo: as fontes públicas do livro cortam no cap. 2 (pdfcoffee/anyflip ofuscado); wikis só
>   têm homebrew. Regra do projeto: NUNCA inventar (CLAUDE.md). **Desbloqueio: Andre fornecer o
>   PDF do livro** (colocar na pasta do projeto) → extrair, parafrasear (licença, spec 0003) e
>   fechar os 3 itens numa spec 0026.

> **2026-07-25 (9): SPEC 0024 — CONTEÚDO OP COMPLETO (trilhas + poderes oficiais + compêndio).**
> Andre perguntou se "todas as regras do livro estão no sistema"; levantamento mostrou lacunas e
> ele aprovou o plano ("FAÇA ISSO"). Entregue:
> - **Trilhas de Especialista completas** (rules.js): + Infiltrador (Ataque Furtivo/Gatuno/
>   Assassinar/Sombra Fugaz) e + Técnico (Inventário Otimizado/Remendão/Improvisar/Preparado
>   para Tudo). Nomes verificados em 2+ fontes (Fandom, texto do livro via pdfcoffee).
> - **CLASS_POWERS substituído pelo catálogo oficial** (18/15/16 por classe, parafraseado).
>   Entradas antigas sem lastro no livro (Ataque Giratório, Wards Protetoras…) saíram do
>   catálogo — fichas existentes NÃO mudam (habilidades adicionadas são cópias, HabilidadesTab).
> - **Grau +10 renomeado "Veterano"→"Competente"** (nome oficial; TREINO_TIERS + tLabel).
> - **Compêndio de regras** novo: `data/ordemParanormal/regras-oficiais.json` (32 entradas:
>   testes, ações, manobras, recursos, interlúdio, rituais) + aba "Regras" no BestiaryTab.
> - **Fora (vinculante na spec):** trilhas de suplementos, bestiário oficial, DTs finas não
>   verificadas (dano massivo etc. — texto qualitativo marcado "Resumo"), FullSheet legado.
> - Gate: 26 suítes / 313 testes PASS, build exit 0. Specs em `specs/0024-conteudo-op-completo/`.

> **2026-07-25 (8): REVISÃO POR AGENTES — 3 subagentes acharam defeitos na Onda 4, incluindo um que
> eu tinha declarado como FUNCIONANDO. Correções aplicadas.**
> **CORREÇÃO DE ALGO QUE EU AFIRMEI ERRADO:** eu disse que os 3 eixos de permissão (mover/criar/
> apagar) estavam ligados. **Estavam furados.** (a) O filtro de `canDelete` que adicionei no handler de
> teclado era **inalcançável** — `index.jsx:951` faz `if (viewer) { ...; return; }` bem antes dele; era
> código morto, exatamente a armadilha que eu vinha criticando. (b) Pior: **o jogador não tem caminho
> de escrita para criar/apagar** — `publishElements` só roda no efeito `isMaster`, e a única escrita do
> jogador é `updateElementPos` (x/y). Ligar `create` daria a ferramenta, o jogador desenharia e o
> objeto sumiria no próximo snapshot. (c) `canMove`/`canDelete` aceitam `'all'`, mas `firestore.rules`
> linhas 124 e 128 exigem literalmente `== 'owner'` — a UI liberaria e o servidor negaria em silêncio
> (divergência PRÉ-EXISTENTE, não introduzida agora).
> **Ação: REVERTIDO** o painel para o eixo único `update` que de fato funciona, e removido o filtro
> morto. `permissions.js` e seus 22 testes ficam (lógica pura correta, pronta para quando existir o
> caminho de escrita do jogador). Expor controle que não funciona é pior que não ter controle.
> **Outros defeitos corrigidos (todos meus):** (1) **vazamento da transmissão** — `castRef` nunca era
> fechado no unmount, então sair da tela do mapa com a transmissão ligada deixava a janela órfã e sem
> botão para fechar; agora tem cleanup. (2) **`key` por spread** em `FogLayer.shapeOutline` — virou
> item de `.map()` nesta leva e o React deprecia essa forma; agora é atributo literal. (3) **rAF sem
> cancelamento** no editor de texto (Ctrl+B + concluir no mesmo frame tocava nó desmontado). (4)
> **acessibilidade**: `aria-label` no textarea e `aria-pressed` nos toggles de cor/contorno. (5) **rota
> `/cast` depois do gate da intro** — como `introPlayed` vem do sessionStorage (por aba), a janela de
> TV sempre mostraria a animação de abertura antes do mapa; `/p/` e `/cast/` foram movidas para antes.
> **ACHADOS NÃO CORRIGIDOS (precisam de decisão do Andre):**
> - **Perda de dados silenciosa no autosave (CRÍTICO, pré-existente).** `index.jsx:504` avança
>   `lastPubRef.current = next` ANTES de `publishElements`, sem await; e `campaignSync2.js:124` engole o
>   erro do `batch.commit()`. Se a escrita falha, a baseline já avançou → a alteração **nunca mais entra
>   num diff e nunca é reenviada**, sem aviso. Mesmo padrão em `saveSceneMeta` (metadados), no upload de
>   imagem (`uploadedRef` marca antes do `saveImage` resolver) e em `createScene` (retorna o id mesmo
>   com o setDoc falhando → a mesa aponta para documento inexistente). Conserto exige decidir política
>   de retry — não fiz por conta própria.
> - **`pruneContained` pode apagar a preparação de névoa.** Ele remove um `add` contido em outro `add`
>   e roda em todo commit. Se o mestre cobrir a área com um retângulo grande e desenhar as salas por
>   cima, cada sala some ao soltar o mouse, sem aviso. O fluxo novo só é seguro usando "Cobrir tudo"
>   (fillAll) como base.
> - **Forma de névoa sob um token fica inalcançável:** `onElementDown` dá `stopPropagation` antes de
>   checar a ferramenta, então o clique seleciona o token e não a forma.
> **Gates após as correções: 25 suítes/303 testes + build exit 0, zero warning nos arquivos tocados.**

> **2026-07-25 (7): PARIDADE OWLBEAR — ONDA 4 (CORREÇÕES DE FUNDO + PERMISSÕES + DESENHO).** Andre deu
> mandato aberto ("faça o que achar melhor, não pare"). A auditoria por subagentes finalmente fechou
> (69 min, 13 agentes, **424 features: 117 done / 92 partial / 215 missing**) e revelou dois defeitos
> que valiam mais que qualquer feature nova.
> **BUG 1 — A NÉVOA NÃO ESCONDIA TOKENS.** Tudo no canvas é filho do MESMO container transformado
> (index.jsx L1526), ou seja um único contexto de empilhamento. A grade estava em `zIndex:6`, a névoa
> em `200` e os pings em `300`, enquanto os ELEMENTOS usam `layerZIndex` = idx*100000+50000±49999, ou
> seja 100k a 700k. **Todo token renderizava ACIMA da névoa** — um inimigo em sala coberta aparecia
> para o jogador, e a névoa só escondia o mapa. A grade em 6 ficava sob a própria imagem do mapa.
> **Fix:** `gridZIndex`/`fogZIndex(layerCount)`/`overlayZIndex(layerCount)` novos em `mapHelpers.js`,
> derivados de `layerZIndex` (nada de número mágico — a próxima camada nova quebraria de novo), com
> **6 testes** travando a ordem: grade acima do Mapa e abaixo de Desenho, névoa acima de TODAS as
> camadas, overlays acima da névoa, e névoa acompanhando `layers.length`. `FogLayer` e `PingsOverlay`
> passaram a receber `zIndex` por prop.
> **BUG 2 — "Cobrir tudo" APAGAVA a preparação.** `coverFog` gravava `shapes: []`. Com o fluxo de
> Cortar/Recobrir da Onda 3 isso destrói o trabalho todo. Agora "Cobrir tudo" só liga `fillAll` e
> preserva as formas (é o Fill Fog da doc: sala cortada vira buraco na névoa infinita), e "Revelar
> tudo" marca tudo como `cut` em vez de deletar.
> **PERMISSÕES (doc /docs/permissions):** `canCreate` e `canDelete` existiam em `permissions.js`, COM
> teste, e **nunca eram chamados** — só `canMove` era importado (4ª ocorrência do padrão "campo/função
> no código ≠ feature", junto de grid.js órfão, `folder` sempre null e `rotation` da nota). Agora:
> `canDelete` aceita `'all'` além de `'owner'`; novos `nextPerm`/`creatableLayers`/`PERM_LABELS`
> (**11 testes**); painel de camadas ganhou os **3 eixos** (mover/criar/apagar) no lugar de só mover; e
> **as ferramentas do jogador saem das permissões** — antes eram 3 fixas (select/measure/pointer) e ele
> não podia criar nada. Delete do jogador filtra por `canDelete` com aviso, senão o eixo novo seria
> config morta.
> **NOTA LEGADA — beco sem saída fechado:** a nota era criada e NUNCA editável (sem menu de contexto,
> clique-direito engolido pelo `onElementDown`, duplo-clique só pingava). Agora duplo-clique e botão na
> barra de ações abrem edição; o modal de prompt ganhou campo **multilinha** (Enter quebra linha,
> Ctrl+Enter confirma) usado na criação e na edição; texto vazio apaga a nota; e o `rotation` que o
> migrations gravava e o render ignorava passou a ser aplicado.
> **DESENHO (doc /docs/drawing):** `fill:'none'` era hardcoded — desenho só fazia contorno, nunca área
> de efeito de magia. Agora tem **preenchimento** (cor do traço + opacidade 5-90%) e **estilo de traço**
> (sólido/tracejado/pontilhado, com dash proporcional à espessura). Traço livre com preenchimento vira
> `polygon` (polyline aberta não pinta área). O preview ao vivo mostra os dois.
> **Também:** Ctrl/Cmd segurado desliga o snap **só durante o gesto** (docs de images e fog); `alt` nas
> 2 imagens sem alt; `no-loop-func` do `fogCellsToShapes` resolvido (ids atribuídos após o laço).
> **Gates: 24 suítes/286 testes + build exit 0. O MapEditor agora não emite NENHUM warning** (eram 3).
> **VERIFICADO POR TESTE DE INTEGRAÇÃO (não por checklist manual).** Andre mandou "então faça os
> testes". Playwright não serve aqui: o MCP entrou no meio da sessão (tools só após restart) e o app
> exige login Firebase. Em vez disso, novo **`renderStack.test.jsx`** (RTL, 11 testes) que semeia
> `localStorage` com uma cena sintética, **renderiza o MapEditor de verdade** e mede o z-index no DOM.
> **O bug foi provado empiricamente por mutação:** revertendo a névoa para o `zIndex:200` original o
> teste falha com `Expected: > 650009, Received: 200` — a nota da camada Notas estava em **650.009** e
> a névoa em **200**, três ordens de grandeza abaixo. Depois de restaurar, passa. Cobre: névoa acima do
> token e de TODO elemento, grade abaixo do token e acima da camada Mapa, névoa não montada sem fog,
> desenho com/sem preenchimento, dasharray proporcional à espessura, e o texto rico virando blocos
> (`# Cripta` vira título, marcação não vaza para a tela, negrito vira peso 700).
> **NÃO verificável por teste automatizado (continua com o Andre):** aparência (cores, layout,
> legibilidade) e o painel de camadas com os 3 eixos, que só existe em modo campanha e exigiria
> Firestore no teste.
> **Pendente do Andre:** olhar o visual e commitar/deployar — **nada foi commitado nem deployado desde
> a 0022**.
> **PRÓXIMOS (do relatório da auditoria):** Asset Manager de verdade (hoje **não dá para adicionar à
> biblioteca sem antes pôr a imagem numa cena**, e `folder` é gravado null e nunca lido); single-layer
> fog + Trim geométrico; edição de pontos de desenho; régua permanente e modo movimento; importador de
> imagem com defaults.

> **2026-07-25 (6): PARIDADE OWLBEAR — ONDA 3 (NÉVOA: FLUXO DE ENCONTRO) IMPLEMENTADA.** Após ler as
> 9 docs que faltavam, o maior gap não era feature solta: **o Nexus não tinha o fluxo de encontro da
> névoa**. No Owlbear você pré-desenha a névoa de todas as salas ANTES da sessão e, conforme os
> jogadores entram, alterna cada forma entre coberta e cortada. No Nexus cobrir/cortar eram **modos de
> pincel** e o sub-modo de edição só apagava — não havia toggle por forma, então a névoa não era
> preparável.
> **Achado que corrige o histórico:** o plano/ADR descartou Join/Trim alegando que "máscara binária
> torna união um no-op visual". A doc mostra que o propósito do Join **não é visual** — é agrupar
> formas para que **um Cut revele todas de uma vez**. A premissa do descarte estava errada.
> **Feito, tudo em `fog.js` (puro, testado):** `toggleCut` vira o `op` da forma existente
> ('add'↔'cut') **e move a forma para o FIM do array** — a mask é sequencial, então um `cut` no índice
> 0 não revelaria nada que um `add` posterior cobrisse; sem reordenar, o botão seria um no-op visual em
> metade dos casos (tem teste dedicado). Seleção mista vira TODA cortada (revelar é a intenção
> dominante). `joinShapes`/`splitShapes`/`expandGroups` implementam o Join via campo novo `groupId`:
> alternar/apagar um membro alcança o grupo inteiro; juntar num grupo existente absorve os dois.
> `fogFill` converte a cor (hex #rgb/#rrggbb) e **cai no preto em valor inválido** — errar a cor nunca
> pode deixar a névoa transparente e vazar o mapa.
> **UI:** sub-toolbar de névoa em modo edição ganhou **Cortar/Recobrir**, **Juntar**, **Separar**,
> contador de seleção e Apagar (plural). **Shift+clique acumula** seleção (`fogSel` virou `Set`).
> Fora do modo edição entrou a **cor da névoa** (5 opções). No `FogLayer` o modo edição agora
> **contorna TODAS as formas por estado — âmbar = coberta, verde = revelada, roxo = selecionada**;
> sem isso preparar a névoa antes da sessão era adivinhação.
> **SCHEMA (aditivo, sem migração):** forma de fog ganha `groupId?` opcional e `scene.fog` ganha
> `color`. Opacidade deliberadamente NÃO é campo — sai do papel de quem olha (mestre 0,88 para
> trabalhar, jogador 0,98).
> **Gates: 24 suítes/269 testes + build exit 0** (18 testes novos de fog), zero warning novo.
> **NÃO ENTREGUE da névoa:** single-layer fog (forma nova se recortando automaticamente contra as
> existentes, que no Owlbear dá meia-lua de graça) e seu toggle multicamada; Trim de verdade
> (subtração geométrica); modos triângulo/hexágono; modo Grab para mover/duplicar forma de névoa
> (Alt-arrastar) e rotacionar.
> **Pendente do Andre:** validar no browser — desenhar 2-3 salas, entrar no modo edição e ver os
> contornos âmbar, Cortar uma e conferir que o jogador passa a ver (usar o preview 👁), Shift+clique em
> duas + Juntar e conferir que cortar uma revela as duas.

> **2026-07-25 (5): PARIDADE OWLBEAR — ONDA 2 (TEXTO RICO + TRANSMISSÃO) IMPLEMENTADA.** Andre pediu
> "OS DOIS" entre as duas áreas da lista dele que tinham lacuna TOTAL.
> **TEXTO (doc `/docs/text`):** novo módulo puro **`richText.js`** — o texto é guardado como STRING
> markdown-ish (não árvore de nós), então o dado que vai pro Firestore continua simples e não precisa
> migração quando o render mudar. Parser de títulos 1/2, lista com marcador, lista numerada (guarda o
> número inicial), parágrafo e inline `**negrito**`/`*itálico*` — marcador não fechado fica LITERAL,
> que é o comportamento certo enquanto se digita. Mais `toggleWrap` (Ctrl+B/I, com desfazer nos dois
> casos: marcadores dentro e fora da seleção) e `toggleLinePrefix` (toggle de verdade: reaplicar
> remove, trocar prefixo não acumula, lista numerada renumera). **`TextItem.jsx`** novo (componente,
> como FogLayer/PingsOverlay): `TextItem` desenha os blocos e `TextEditorOverlay` é o editor in-place
> — textarea + barra com 7 cores, 3 fontes, 6 tamanhos, B/I/H1/H2/•/1., contorno 0-4px e "Pronto".
> Contorno via `-webkit-text-stroke` + `paint-order`, senão o traço come a letra. Ferramenta **Texto
> (E)** na toolbar; clicar cria e já abre o editor; **duplo-clique reedita**; Shift+Enter e Esc
> concluem; texto vazio ao concluir se autodeleta (não deixa item fantasma). O `onKeyDown` do textarea
> dá `stopPropagation` — sem isso os atalhos de 1 tecla do canvas (V/T/D/F…) disparariam ao digitar.
> Digitação coalesce em **1 passo de undo** via `updateElText` + `coalesceKey` (reusa o mecanismo do
> arrasto de fog da 0019 AC-7); sem isso cada tecla viraria um passo e o Ctrl+Z ficaria inútil.
> **TRANSMISSÃO (doc `/docs/casting`):** rota nova **`/cast/{campaignId}`** no App.jsx (mesmo padrão
> de early-return da `/p/{charId}` já existente; o `firebase.json` já tem rewrite catch-all, então a
> rota serve sem mudança de infra). Novo **`CastView`** renderiza a mesa com **`isMaster={false}`
> mesmo logado como mestre** — é o ponto: a névoa fica OPACA na TV, igual ao Owlbear, onde o
> dispositivo de transmissão entra como jogador. Como a sessão do Firebase é a mesma origem, não
> precisou fluxo de admissão. Botão **Transmitir** na toolbar usa a **Presentation API** quando o
> navegador oferece (Chrome/Edge com tela ESTENDIDA — espelhada não conta — ou Chromecast) e cai para
> `window.open` que o mestre arrasta para a TV, com aviso se o pop-up for bloqueado; botão vira Parar.
> A câmera na TV acompanha pelo **Sync View que já existia** (a TV não recebe input).
> **Gates: 24 suítes/251 testes + build exit 0** (35 testes novos de richText), zero warning novo.
> **NÃO ENTREGUE:** (1) **one-shot do Sync View** — a doc de casting descreve o botão dividido, onde o
> lado direito puxa TODOS os jogadores para a visão do mestre de uma vez; o Nexus só tem o toggle
> contínuo. Exige sinal novo nas duas pontas (um contador no payload do canal ao vivo que o jogador
> obedece mesmo com `followMaster=false`). (2) Do texto: seletor de emoji e o item "Editar Texto" no
> context menu (o duplo-clique e o Shift+Enter cobrem a reedição).
> **Pendente do Andre:** validar no browser — criar texto com `# título` e `- lista`, Ctrl+B, duplo-
> clique reeditando, Ctrl+Z desfazendo a digitação inteira de uma vez; e abrir Transmitir numa segunda
> tela conferindo que a névoa aparece OPACA lá. Depois commitar/deployar.

> **2026-07-25 (4): SPEC 0023 (TEMA GRAFITE) IMPLEMENTADA.** Andre viu o Painel e disse "está muito
> escuro, quero um layout um pouco mais claro". Decidido com ele: **grafite sutil** (não tema claro),
> **app inteiro**, **trocando o padrão** (sem toggle). O fundo era `#07070d` (L\* 2,0) com cards a
> `#121220` — separação de **1,15:1**, invisível a olho nu.
> **Achado que redefiniu a fatia 1:** existiam **duas escalas de luminância vivas** — o `:root` do bloco
> `G` (`--bg:#0d0d0d`) pintava login/seleção/criadores e o registry (`--bg:#07070d`) pintava o shell,
> porque `<ThemeStyles/>` só era montado no shell logado, embora `data-nexus-system` já fosse escrito
> sempre. Novo **`Shell` = `<G/>` + `<ThemeStyles/>`** (escopo de módulo, não dentro de `App()` — declarar
> lá criaria um tipo novo a cada render e remontaria as `<style>`) usado nos 6 pontos de entrada + no
> `PublicSheetView`. O `:root` do `G` virou **fallback de boot** espelhando a escala do OP.
> **Escala nova** (mesma escada de L\* 6,6/10,7/14,6/18,5 nos 3 sistemas, tonalidade preservada): OP
> `#14141c/#1c1c26/#24242f/#2c2c39`, D&D `#1a140f/#231b13/#2d231a/#372b1f`, Tormenta
> `#10170f/#161f15/#1e281d/#243023`. **`--muted` subiu** nos 3 (cairia para ~4,2:1 sobre o card2 novo —
> abaixo do AA, e ele é usado em labels de 9-11px): `#a89a7c` / `#a89678` / `#94a87a`. **Alphas de
> `--border`/`--border2` NÃO mudaram** — recalculado, a borda dourada mantém o mesmo contraste.
> Separação bg→card2 subiu para **1,33:1**: clarear aqui aumentou a elevação percebida.
> **Também clareados:** `index.html` (`theme-color` + `body`) e `manifest.json` (primeiro frame/PWA),
> `modalStyles.js` (um `background` pinta TODOS os modais das abas OP), topbar (agora `var(--surface)` —
> elevada, não recessada), bottom-nav, modal de Ajustes e família (`#111`/`#1a1a1a`/`#333` → tokens;
> `<option>` ficou com **hex literal** de propósito: o compositor nativo do SO ignora `var()` herdado),
> ficha OP (`--el-deep`/`--el-bg`, `.op-ink` inset 0,55→0,32, os 6 `bg` de `elementos.jsx` preservando
> matiz), ficha D&D (`--ink`/`--stone`/gradiente) e as 19 superfícies literais do editor de mapas
> (decisão: **não tokenizar** — identidade própria, 0 `var()`). Sombras pretas ≥0,5 reduzidas ~30% (33 em
> App.jsx) e o piso do keyframe `op-el-fade` subiu de `#000` para `#0a0a10` (com fundo claro, partir do
> preto virava piscar visível). **Teste novo `surfaces-ladder.test.js`** (12 asserções) trava a escada
> para sempre: completude, monotonicidade, coerência ±1 L\* entre sistemas e AA 4,5:1 de
> text/muted/muted2 sobre card2. **Gates: 23 suítes/216 testes + build exit 0.**
> **NÃO verificado por mim:** a checagem visual no browser — o MCP do Playwright não expôs as ferramentas
> `browser_*` nesta sessão. **Pendente do Andre:** olhar o app (dev server rodando), aprovar e commitar.
> **Gap documentado (fora de escopo, vira spec própria):** accent de D&D (2,8:1) e Tormenta (3,0:1) como
> **cor de texto** sobre o card novo — a regra correta é *accent preenche, accent2 escreve*.

> **2026-07-25 (3): PARIDADE OWLBEAR — ONDA 1 (FUNDAÇÃO DE GRID) IMPLEMENTADA. Andre mandou as 10
> páginas da doc do Owlbear e pediu "traga TODAS essas funcionalidades".** Achado que redefiniu a
> onda: **`grid.js` era MÓDULO ÓRFÃO** (nenhum import) e o `index.jsx` duplicava a matemática inline
> (`gridSize` L147, snap L166-173, medição `Math.hypot` L1203, stroke da grade hardcoded L1437) — logo
> `grid.type`, `grid.offset`, `grid.measurement`, `grid.color`, `grid.opacity` e `grid.lineWidth` eram
> **config morta**: só `size` tinha efeito, e o único ajuste de grade na UI estava escondido dentro da
> sub-toolbar de névoa. **Docs baixadas via Firecrawl** para `scratchpad/owlbear/` (13 páginas — o
> WebFetch toma **403** no site do Owlbear; o `map` do Firecrawl revelou 17 páginas, 3 relevantes que
> o Andre não listou: getting-started, rooms, troubleshooting).
> **Feito:** `grid.js` reescrito como fonte única (~260 l) — hex **pointy-top e flat-top** (axial +
> arredondamento de cubo), 4 modos de medição em quadrado (**chessboard/alternating/euclidean/
> manhattan**) e 2 em hex, `offset` de alinhamento normalizado para [0,g), `cellSizeFromColumns/Rows`
> (o controle manual linhas×colunas do Owlbear), `parseGridFromFilename` ("mapa_49x28.jpg" → 49×28,
> rejeitando resolução tipo 1920x1080), `parseScale`/`formatScale` com **precisão derivada dos
> decimais digitados** ("5.00mi" → 2 casas) e `gridPattern` (tile SVG do favo de mel, 5 hexágonos
> por tile). **`index.jsx` wired**: snap/snapToken/medição/render passam pelo módulo; grade honra
> color/opacity/lineWidth/offset/tipo; fog "retângulo por células" ficou offset-aware (e em hex cobre
> a área crua, pois célula retangular não existe em favo). **Painel novo "CONTROLES DE GRADE"**
> (botão `target` na toolbar): tipo, colunas/linhas, célula ±1px, offset X/Y (±1/±5 + zerar), modo de
> medição filtrado pelo tipo, escala digitável e opacidade/espessura. **Alinhamento automático pelo
> nome do arquivo** no `loadBg`.
> **SCHEMA v2 → v3** (`migrateSceneV3`, idempotente): `grid.offset` e `scale.digits` novos, e
> `measurement:'euclidean'` (config morta, nunca lida por ninguém) vira **'chessboard'** (padrão D&D 5e
> — Andre aprovou a migração: "MIGRE SIM"). `SCHEMA_V2` ganhou constante própria porque a v2 gravava
> `schemaV: SCHEMA_V`, e subir a constante sem isso faria toda cena v2 re-executar a migração v1→v2.
> Teste explícito garante que **escolher euclidiana DEPOIS de migrar não é revertido** (guard de
> schemaV). **Dívida quitada:** `mapHelpers.cellCenterSnap` REMOVIDO (superado por `grid.cellCenter`);
> o AC-9 da 0019 segue rastreável — o teste foi reapontado para o grid.js.
> **Gates: 23 suítes/216 testes + build exit 0**, zero warning novo (os do MapEditor — alt-text no
> index.jsx, no-loop-func em migrations.js:21 — são pré-existentes).
> **NÃO ENTREGUE da área aligning-a-map:** as **réguas visuais de alinhamento** (arrastar canto,
> escalar, trilho de precisão por eixo com Shift). Entreguei o controle manual + nudge de offset, que
> resolve mapa com dimensão conhecida; mapa com grade desconhecida ainda exige tentativa e erro.
> **PRÓXIMAS ONDAS (docs já em disco, ler de `scratchpad/owlbear/`):** ferramenta de **texto** (doc
> `text.md` — nunca implementada), **casting/segunda tela** (`casting.md` — nunca implementada),
> régua **permanente** e modo **movimento** (`measure.md`: hoje a régua só existe durante o arrasto),
> refinos de `images`/`scenes`/`fog`/`drawing`/`managing-assets`/`permissions`.
> **Pendente do Andre:** validar no browser (grade quadrada não deslocou; hex desenha fechado; offset
> alinha; medição muda com o modo; nome "40x22" auto-alinha) + commitar/deployar. Uma auditoria por
> subagentes das 10 áreas ficou rodando e **não foi usada** — 12 agentes numa máquina de 4 núcleos
> serializa em 2, erro de dimensionamento meu; as docs foram lidas direto do disco.

> **2026-07-25 (2): SPEC 0022 (pílula nas abas) IMPLEMENTADA — mesma leva, escopo novo aprovado pelo
> Andre.** A 0017 deixou fichas explicitamente fora de escopo, então abri `specs/0022-pilula-nas-abas/`
> (tier pequeno: spec + tasks) antes de codar. Novo **`src/components/SlidingTabPill.jsx`** (apresentação
> pura do realce: fundo/raio/sombra/sublinhado/linha de topo; sublinhado é filho absoluto, NÃO
> `border-bottom`, pra borda não inflar a caixa onde não há `border-box`) + 6 testes. As **6 superfícies**
> agora usam o mesmo par hook+componente: sidebar desktop, bottom-nav mobile, **abas da ficha OP**,
> **secnav mobile do OP**, **abas da ficha D&D** e **abas do modal de Ajustes** (extraídas para um
> `SettingsTabs` em App.jsx). Nos CSS (`ordemStyles.jsx`, `DnDSheetStyles.jsx`) o ativo perdeu
> fundo/`border-bottom` colorido/`::before` — sobrou cor e peso do texto; a borda transparente ficou para
> o box-model não encolher 2px, e os botões ganharam `position:relative;z-index:1` pra ficar acima do
> realce. Barras roláveis receberam `position:relative` para o realce rolar junto com o conteúdo (AC-2).
> **Gates: 21 suítes/158 testes + build exit 0.** AC-1/2/3/4 são checklist visual do Andre (tasks.md da
> 0022). **Pendente do Andre:** validar no browser as 6 barras + commitar/deployar as duas levas de hoje.

> **2026-07-25: PÍLULA DE NAV — o item estava FEITO; o que faltava era robustez + docs.** O handoff
> da sessão anterior listava "pílula de nav deslizante" como pendência, mas o `tasks.md` da 0017 é que
> estava desatualizado (tudo marcado `todo` mesmo com a Onda 1 entregue e deployada em `f90a316`): a
> pílula já existia no `Sidebar` desktop e na `MobileBottomNav` (commit `baae1b3`). **Feito nesta leva:**
> (1) as duas cópias inline viraram **`src/hooks/useSlidingPill.js`** (`measurePill`/`samePill` puros +
> hook), com **6 casos de teste** novos (`useSlidingPill.test.js`, RTL + fake ResizeObserver + offsets
> simulados por `data-*`, já que o jsdom devolve 0 em todo offset); (2) **bug real corrigido** — a medida
> só acontecia no `useLayoutEffect`, ou seja ANTES da transição `width 0.3s` da sidebar e ANTES das
> webfonts (Cinzel) trocarem as métricas: ao recolher/expandir, a pílula congelava na largura antiga até
> a próxima troca de aba. Agora re-mede via **ResizeObserver** (container + item ativo) e no
> **`document.fonts.ready`**, com guarda de igualdade (`samePill`) pra não entrar em laço de render.
> **Gates: 20 suítes/152 testes + `npm run build` exit 0** (com `CI=true` o build falha por warnings
> **pré-existentes** de outros arquivos — `no-unused-vars`/`exhaustive-deps` em App.jsx, sheets de
> OP/D&D; nenhum vem desta leva). `tasks.md` da 0017 reconciliado com a realidade (status por task +
> checklist visual da regressão da pílula). **Achado:** a **task 9 (ADR do Higgsfield) nunca foi escrita**
> — a Onda 2 rodou sem ADR (o último é o 0007/Tailwind). **Pendente do Andre:** conferir no browser
> (recolher/expandir a sidebar + girar o celular) e commitar/deployar. **0017 ainda em aberto:** voz do
> Ajudante do Mestre (`narracao-mestre.mp3`, falta decidir onde toca), ADR do Higgsfield, explainer 30s
> (adiado), trilha/SFX (impossíveis neste conector). **Fora da 0017 (precisa decisão):** as **abas** ainda
> trocam seco — ficha OP (`.op-tab`), ficha D&D (`.dnd-tab`), modal de Ajustes e a secnav mobile do OP;
> a spec 0017 põe fichas explicitamente fora de escopo, então levar a pílula até lá é escopo novo.

> **2026-07-21 (5): TAILWIND + shadcn/ui ADOTADO (aditivo) — ADR-0007. Build via CRACO exit 0 + 19
> suítes/142 testes verdes. NÃO deployado ainda (mudança de build+CSS global no app inteiro — precisa
> validação visual do Andre antes do deploy).** Andre: "coloque o shadcn no projeto pra usar". Caminho:
> **CRACO** (CRA não lê tailwind.config sozinho) + **Tailwind v3** + **preflight OFF** (crítico — o reset
> global quebraria o app inline-styled; `@layer base` escopado a `border`/`box-border` restaura só o
> essencial dos componentes shadcn). Tokens **`--sh-*`** (não colidem com `--purple`/`--gold`). Alias
> `@`→src no CRACO+jsconfig. Arquivos novos: `craco.config.js`, `tailwind.config.js`, `jsconfig.json`,
> `components.json`, `src/tailwind.css`, `src/lib/utils.js` (cn), `src/components/ui/button.jsx` (prova).
> `src/index.js` importa o CSS; scripts npm → `craco`. **PENDENTE Andre:** (1) rodar `npm start` local e
> conferir que NADA do visual atual mudou (o preflight-off deve garantir; CSS emitido = só 354B); depois
> **deploy**. (2) **restart do Claude Code + aprovar o MCP shadcn** (já em `../.mcp.json`) para puxar mais
> componentes via `npx shadcn@latest add <x>` ou MCP. **DÍVIDA registrada no ADR:** migrar CRA→Vite um dia
> (tira o CRACO, shadcn no caminho oficial). Regra nova: legado = inline styles; **telas novas = shadcn**.

> **2026-07-21 (4): MOBILE "virar app" — FATIA 2 FEITA + DEPLOYADA (commit `baae1b3`, build exit 0,
> 19 suítes/142 testes).** (1) **Pílula deslizante na bottom-nav** — portada a shared-layout do desktop
> (0017 AC-4) p/ `MobileBottomNav`; novo hook **`useViewportWidth`** (listener resize/orientation,
> coalescido por rAF) + `useIsMobile`. (2) **isMobile reativo** na ficha OP (`App.jsx` ~L8439, agora
> `useIsMobile()`) — reflui ao girar. (3) **fontes OP <480px** (perícia 10→11, head 8→9.5). **FATIA 3
> (backlog mobile restante):** **service worker** (offline/cache — CRA não registra; maior item p/
> "app de verdade"); alvos de toque do MapEditor (menus/toolbar 12-13px); outras leituras de
> `window.innerWidth` sem listener no canvas (auditoria citou ~L11406/11421 — reconferir nºs atuais e,
> se em corpo de componente, trocar por `useIsMobile`); revisar demais fontes <11px pelo app.

> **2026-07-21 (3): NOVO WORKSTREAM "VIRAR APP" (mobile fácil+eficiente) — FATIA 1 FEITA + DEPLOYADA
> (commit `6f851fc`, build exit 0, 19 suítes/142 testes).** Andre: "faça a versão mobile extremamente
> fácil de mexer e eficiente, vai virar app". Rodei auditoria mobile (subagente) → backlog priorizado.
> **Fatia 1 (fundação, feita):** (1) **PWA instalável** — `public/manifest.json` (standalone, ícones
> 192/512+maskable gerados do logo via ffmpeg), `viewport-fit=cover` (safe-area real no iPhone), metas
> `apple-mobile-web-app-*` + apple-touch-icon no `index.html`; (2) **fim do zoom iOS** — inputs globais
> 15→16px (`App.jsx`) e de modal OP 14→16px (`modalStyles.js`); (3) **nav legível** — bottom-nav label
> 7→10px, abas de campanha 9→12px. **FATIA 2 (backlog mobile, próxima):** `isMobile` reativo (hook com
> listener resize/orientation — hoje `window.innerWidth<768` sem listener em `App.jsx:8400`, canvas
> `:11406/11421`); **pílula deslizante na bottom-nav** (paridade com a do desktop `App.jsx:1136-1150`,
> hoje `.active` abrupto `:443`); fontes minúsculas da ficha OP <480px (`ordemStyles.jsx:252-255`);
> alvos de toque do MapEditor (menus/toolbar 12-13px); **service worker** (offline/cache — CRA não
> registra hoje). Auditoria completa foi via subagente (não gravada em arquivo; re-rodar se precisar).

> **2026-07-21 (2): §B FOLLOW-UPS FECHADOS — §B do assessment-0021 está COMPLETO (build exit 0,
> 19 suítes/142 testes, NÃO deployado/pushado; commit `53ecead`).** (1) **Emojis residuais → MapIcon**:
> permissão de camada 👤👥🚷, badges 🔒 dos elementos, placeholders 🗺, botão 🖼 de token, glyphs ▭◯⬠╱✏
> das sub-toolbars — TODOS convertidos (13 ícones novos em `icons.jsx` no total das 2 levas). (2)
> **aria-label** nos botões só-ícone convertidos. (3) **Perf do arraste**: `setDragTick` agora coalesce
> em 1 re-render por frame via `requestAnimationFrame` (`scheduleDragRender`; rAF cancelado no `onUp`) —
> as posições ao vivo vivem em refs, sem risco de correção. **Deliberadamente FORA de escopo:** memoização
> por elemento (não re-renderizar o componente inteiro no arraste) — refactor grande, risco alto, exige
> extrair componentes + validação de browser. **§B do assessment agora 100%** exceto essa memoização.
> **PRÓXIMO na fila:** §C **PIX** (Andre = "é bug, consertar ponta a ponta" — env vars `MERCADOPAGO_*`
> na Vercel) + §C catches silenciosos + i18n EN. **Pendente do Andre:** `git push` + deploy (Firebase
> Hosting) de todas as levas desta sessão (8 commits: `e225119`→`53ecead`); validar em tablet/2 navegadores.

> **2026-07-21: LEVA §A+§B COMMITADA + §B POLISH FEITO (build exit 0, 19 suítes/142 testes, NÃO
> deployado/pushado).** Retomada da sessão anterior: os itens funcionais §A (sobrecarga/círculo NEX) e
> §B (toque, clima, camadas, estado-vazio) estavam prontos e verdes mas NÃO commitados — **commitados em
> 3 partes** (`e225119` OP §A, `277c623` mapas §B, `f1cd653` docs). Depois, **§B polish** (Andre pediu):
> (1) `window.prompt/alert` → modal/toast in-app (`askPrompt` promise-based; commit `17168f7`); (2) loading
> "Carregando a mesa…" até 1ª hidratação Firestore (flag `stateLoaded`) + top-bar responsiva (labels
> colapsam <720/<560px, nome da cena trunca) — `e3e67a9`; (3) emojis dos context-menus + botões de cena
> → MapIcon SVG (6 ícones novos em `icons.jsx`) — `7eb8268`. **§B RESTA (follow-up):** `setDragTick`
> re-render por frame (perf, risco de regressão — único funcional aberto), emojis restantes (permissão
> 👤👥🚷, badges 🔒, glyphs ▭◯⬠ das sub-toolbars), aria-label explícito nos demais botões só-ícone.
> **PRÓXIMO na fila:** §C **PIX** (Andre = "é bug, consertar ponta a ponta" — precisa env vars
> `MERCADOPAGO_*` na Vercel) e §C catches silenciosos. **Pendente do Andre:** push (`git push`) + deploy
> (Firebase Hosting) de TODAS as levas §A+§B+polish quando quiser publicar; validar toque/gestos em
> tablet e o novo modal/loading em 2 navegadores.

> **2026-07-20 (3): ASSESSMENT-0021 §B — mais 3 itens FUNCIONAIS FEITOS (build exit 0, NÃO deployado).**
> (1) **Clima sincroniza** — movido de state local `weather` para `scene.weather`; o menu de clima faz
> `dispatch(PATCH_SCENE {weather})` e `saveSceneMeta` propaga p/ a mesa (mesmo caminho do `loadBg`). Antes
> o mestre ligava chuva e o jogador não via. (2) **Fallback de camadas** — `index.jsx` agora usa
> `DEFAULT_LAYERS_V2` (7 camadas do schema) em vez das 4 v1 do `reducer.js` em todos os `scene.layers||…`.
> (3) **Estado-vazio do viewer** — jogador vê "AGUARDANDO O MESTRE PREPARAR A CENA" no lugar de "Adicionar
> Imagem" (que não pode). **Bônus:** `replaceImage()` já tinha downscale (fix veio na 0019 — assessment
> desatualizado; marcado como resolvido). Build exit 0. **§B RESTA (só polish, próxima sessão p/ resetar
> custo):** `window.prompt`→modais (nota/cena/rótulo/asset), emojis residuais→MapIcon, aria-labels,
> top-bar em tela estreita, `setDragTick` re-render por frame, loading até 1ª hidratação Firestore.
> **Pendente do Andre:** validar toque+clima em 2 navegadores/tablet + deploy (Hosting) das levas §A+§B.

> **2026-07-20 (2): ASSESSMENT-0021 §B — TOQUE NO EDITOR DE MAPAS FEITO (maior item de "usável de
> verdade"; build exit 0, NÃO deployado).** Migrei `MapEditor/index.jsx` de Mouse Events para **Pointer
> Events**: container + `onElementDown` + alças de resize/rotate + nota agora usam `onPointer*`;
> `touch-action:none` no container; `setPointerCapture` no container em todo down (elemento e canvas) —
> o arrasto sobrevive ao sair da viewport, o que **elimina o bug do arraste que soltava ao encostar na
> toolbar** (removido o `onMouseLeave={onUp}`). Como `touch-action:none` mata o pan/zoom nativo, adicionei
> **pinch-zoom + pan de 2 dedos** (novos refs `pointersRef`/`pinchRef` + helpers `beginPinch`/`applyPinch`
> no topo de onDown/onMove/onUp; o 2º dedo cancela a ação de 1 dedo sem efetivar e assume o gesto). Gestos
> soltam o Sync View do jogador (AC-6). Gates: 9 suítes/67 testes MapEditor + build exit 0. **Fora de
> escopo/follow-up:** double-tap (ping) por toque não garantido; demais itens §B (replaceImage downscale,
> clima não sincroniza, emojis residuais, top-bar estreita, window.prompt→modais, estado-vazio viewer).
> **Pendente do Andre:** validar em tablet/celular de verdade + deploy (Firebase Hosting) das levas §A+§B.

> **2026-07-20: ASSESSMENT-0021 §A (regras OP) — 3 itens FEITOS (build exit 0, NÃO deployado ainda).**
> Continuei o backlog do programa "Nexus impecável" pela ordem (regras OP = prioridade 1). Fechados:
> (1) **Sobrecarga** (`InventarioTab`): helper puro `cargaTeto(attrs)`=2× carga máxima; barra de carga
> agora exibe teto absoluto + efeito oficial (−5 Atletismo/Furtividade, −3m deslocamento) quando
> sobrecarregado + estado "ACIMA DO TETO" quando > teto (não trava, só informa). (2) **Aviso de círculo
> de ritual por NEX** (`RituaisTab`): helper puro `circuloMaxNex(nex)` (1º=5/2º=25/3º=55/4º=85%); badge
> "⚠ NEX BAIXO" + tooltip no RitualCard quando círculo > permitido, SEM travar (decisão Andre = autonomia).
> `nex` propagado da sheet. (3) **Código morto** `deriveStats().esquiva/.bloqueio` REMOVIDOS de `rules.js`
> (só `.peTurno` era consumido; Esquiva homebrew 10+AGI+Reflexos segue na própria ficha, intocada).
> Helpers novos testados (rules.test.js: cargaTeto + circuloMaxNex). **Gates: 19 suítes/142 testes + build
> exit 0.** ACs de UI (badges/barra) = checklist visual do Andre. **PRÓXIMOS na fila (assessment §A resta):**
> rituais gate visual está feito; falta o **PIX** (§C, decisão Andre = É BUG, consertar fluxo ponta a ponta)
> e a §B Mapas (**toque/Pointer Events** = maior item de "usável de verdade"). **Pendente do Andre:** deploy
> (Firebase Hosting) desta leva §A quando quiser publicar.

> **2026-07-09: PROGRAMA "NEXUS IMPECÁVEL" INICIADO.** Andre deu mandato aberto ("melhore tudo,
> impecável, OP + Mapas + tudo"). Rodei 3 auditorias (subagentes): regras OP, mapas, bug-hunt geral.
> **Backlog priorizado consolidado em `docs/architecture/assessment-0021.md`** — ler esse arquivo pra
> continuar (é a fila de trabalho durável entre sessões). **Decisões do Andre:** manter homebrew do
> Cellbit (Esquiva 10+AGI+Reflexos e Proficiência +2..+6 FICAM, NÃO mexer); regras de OP primeiro.
> **FEITO nesta leva (spec 0021, DEPLOYADO):** condições de OP reescritas fiéis ao livro em `App.jsx`
> `OP_CONDICOES` — corrigidas Abalado/Apavorado/Atordoado/Cego (estavam contaminadas por D&D),
> "Exposto" (inexistente) virou **Desprevenido**, e adicionadas Agarrado/Alquebrado/Caído/Confuso/
> Indefeso/Petrificado/Sangrando (fontes web oficiais citadas no assessment). Build exit 0.
> **PRÓXIMOS na fila (ver assessment):** [A] sobrecarga sem efeito/teto (InventarioTab); rituais sem
> gate de círculo; [B] **toque no editor de mapas (Pointer Events) — maior item de "usável de verdade"**,
> replaceImage sem downscale, clima não sincroniza, emojis residuais; [C] catches silenciosos de save
> de ficha/arquivar campanha (perda de sync silenciosa). **Pendências que precisam do Andre:** perícias
> "só treinado" (Sobrevivência?), rituais trava vs aviso, PIX morto (abandonado de propósito?).

> **2026-07-09: SPEC 0020 (Arsenal v2) IMPLEMENTADA + DEPLOYADA.** Andre reclamou que criar ataque
> na ficha OP era "horrível" (card inline apertado) e mandou referência de modal completo, pedindo
> melhor. Feito: novo `AttackModal` (reusa `ModalShell` + `RichTextEditor` de Tabs/shared) com Nome,
> Dano, Crítico (margem), Multiplicador, Ataque Bônus, Perícia, Atributo de Dano, Tipo de Dano
> (dropdown `TIPOS_DANO`), Alcance, lista de **Dano Extra** {dano,tipo}, Imagem (downscale 128px),
> Anotações rich-text. `ArsenalCard` v2 colapsável (thumb + resumo "Dano · Crítico margem/xMult" +
> 🎲; expande com detalhes + Editar/Remover). `rollAttack` reescrito com a mecânica correta:
> `critMargin`/`isCritical` (margem de ameaça de verdade) + `combineDamage` (multiplicador no crit,
> dano extra somado e agrupado por tipo). Tudo em `rules.js` (puro, testado: arsenal.test.js 8 testes)
> + `OrdemParanormalSheet.jsx`. Shape v2 aditivo/retrocompatível (ataque antigo continua rolando).
> Gates: **19 suítes/140 testes** + build exit 0. ACs de UI (1/5/6) = checklist do Andre no tasks.md.

> **2026-07-09: SPEC 0019 (correções do Editor de Mapas) IMPLEMENTADA + DEPLOYADA.** Andre reportou
> "as funções não funcionam direito", prioridade em CAMADAS e ÍCONES ilegíveis. 3 explorações
> auditaram camadas/ferramentas/persistência. Corrigido em 5 grupos (AC-1..12): **A-camadas** (toast
> ao clicar em camada travada; reordenar ↑/↓ via `REORDER_LAYERS` que estava morto; zIndex agora
> `layerZIndex(idx,z)` — empilha entre tipos; furos de lock em clique/subtree); **B-seleção** (imagem
> clicável quando camada destravada; desenho só o traço é clicável via `visiblePainted`);
> **C-ferramentas** (régua limpa no soltar; fog/opacidade coalescem em 1 undo via `coalesceKey` no
> `historyReducer`; wheel vira listener não-passivo; +/− e ⌂ centram/enquadram; snap de token no
> centro da célula + snap ON por padrão); **D-persistência** (catches de `localStorage` agora logam
> + toast de quota; `loadBg` faz downscale 2048/JPEG; `collectOrphanImageIds` varre imagens órfãs no
> mount); **E-ícones** novo `icons.jsx` (SVG) substitui os emojis nas toolbars/painel/action-bar.
> Novos puros testados: `mapHelpers.js` (snap/zindex/orphan, 10 testes) + `reducer.test.js` (coalesce/
> reorder, 6 testes). Gates: **18 suítes/132 testes** + build exit 0. ACs de UI (1..9/12) = checklist
> manual do Andre no `tasks.md`. **Deixado como follow-up:** emojis do context-menu e condições de token
> (secundários); criar/deletar camada (fora de escopo — 7 fixas Owlbear).

> **2026-07-09: FIX — Editor de Mapas quebrado (regressão da spec 0017, commit `852d5e1`, DEPLOYADO
> no Firebase Hosting).** Sintoma: ao abrir o Editor de Mapas, só aparecia o header + canvas vazio;
> toolbars/painéis sumiam e o header do app continuava visível por cima (MapEditor não cobria a
> viewport). Causa: o wrapper de crossfade `<div key={screen} className="fade">` (introduzido na 0017,
> L~12071) anima `transform: translateY` com `forwards` — o `translateY(0)` retido cria containing
> block e prende descendentes `position:fixed`; o MapEditor é `position:fixed inset:0 z-index:500` e
> ficava confinado dentro do wrapper. Fix cirúrgico: nova classe `.fade-screen` (só opacity, sem
> transform) no wrapper de telas; as 20+ entradas `.fade` com slide-up ficam intactas. Gates: build
> exit 0 + 16 suítes/118 testes. **Lição:** transform em wrapper de tela quebra qualquer filho
> `position:fixed` full-screen — não reusar `.fade` (com transform) em volta de `renderScreen()`.

> **2026-07-09: SPEC 0018 (fallback de IA multi-provider) IMPLEMENTADA** — `/api/ai` agora
> tenta Groq (primário) → NVIDIA-Mistral (fallback) em cascata antes de reportar erro. Novo
> `src/server/aiFallback.js` (puro, testado — 13/13 `npm test`); `api/ai.js` reescrito com o
> laço de cascata (auth/rate-limit da spec 0004 AC-6 inalterados). Verificado fim a fim com
> smoke test de `fetch` mockado (5 cenários: sucesso, fallback, não-cascateio em 4xx≠429,
> ambos falham → 503 amigável, chave ausente → propaga erro exato da Groq). Gates: 16
> suítes/118 testes + `npm run build` exit 0. **Achado técnico documentado:** o Jest do CRA
> trava `roots` em `src/`, por isso a lógica pura mora em `src/server/` (não em `api/`) —
> ver `design.md` da 0018.
> Andre configurou `NVIDIA_API_KEY` na Vercel e fez o redeploy manual — **DEPLOYADO em produção**
> (commit `dee9934` → `30f3b8b`, ver achado abaixo). **Fora de escopo desta onda:** 3º elo da
> cascata (DeepSeek/GLM/MiniMax) — IDs de modelo não verificados na doc oficial da NVIDIA, ver
> Q1 do `design.md` da 0018.

> **2026-07-09: BUG DE INFRA PRÉ-EXISTENTE ACHADO E CORRIGIDO (`vercel.json`, commit `30f3b8b`)**
> — `api.playnexusrpg.com/api/*` (TODAS as functions: `ai.js`, `create-payment.js`,
> `payment-webhook.js`) estava servindo `index.html` (405/200 conforme método) em vez de rotear
> pras serverless functions — **o Ajudante do Mestre e o webhook de pagamento estavam fora do ar
> em produção**, achado ao tentar verificar a 0018 em produção. Causa raiz: `vercel.json` usava
> o formato legado (`"builds"` + `"routes"`), que conflita com a auto-detecção de framework da
> Vercel (Framework Preset "Create React App" configurado no dashboard) — o catch-all pra
> `index.html` intercepta `/api/*` antes da rota específica, mesmo ela vindo primeiro na lista.
> Confirmado contra um relato idêntico na comunidade Vercel (mesma causa, mesma correção).
> **Fix:** removido `"builds"` (functions em `api/*.js` são auto-detectadas por convenção, sem
> config), `"routes"` virou `"rewrites"` (formato moderno). Verificado em produção pós-deploy:
> `GET/POST /api/ai` e `POST /api/payment-webhook` agora respondem com os headers/status do
> próprio código (405/401/200), não mais `index.html`. **Não sei há quanto tempo esse bug
> existia** — não investigado quando começou; se pagamentos via PIX pararam de ativar planos
> recentemente, essa pode ser a causa.

> **2026-07-09: DEPLOY 0017** — commit `f90a316` em `origin/main` (github.com/Andreytyui/NEXUS-RPG,
> 28 arquivos) + `firebase deploy --only firestore:rules,hosting` no projeto `nexus-rpg-app`
> (nexus-rpg-app.web.app / playnexusrpg.com). Regras já estavam up-to-date no servidor ("skipping
> upload" — o todo de deploy das rules 0013 estava obsoleto, já estavam no ar); rules recompiladas
> e re-lançadas OK; 30 arquivos de hosting no ar (inclui `public/assets/higgsfield/`). Build via
> predeploy exit 0. Toda a Onda 1 do 0017 está em produção.

> **2026-07-08: SPEC 0017 (redesign animado gótico-arcano) — spec escrita + Onda 2 (ativos) FEITA;
> Onda 1 (CSS) parcial e integração PENDENTES (bloqueio: Node quebrado).**
> `specs/0017-redesign-animado/` (product+spec+design+tasks). Reconciliado com a realidade: o brief
> assumia Vite/Framer/"bug do roxo" — nada procede (theming reativo por sistema JÁ existe; App.jsx já
> tem 16 keyframes). Decisões com Andre: **CSS puro sem deps novas**, **Higgsfield gated**, **Tormenta
> segue verde**, **OP card mantém roxo arcano** (novo campo `cardAccent` no registry). Q1 resolvida.
> **Onda 1 (CSS) — tasks 1 e 3 escritas mas NÃO verificadas:** `src/themes/motion.js` (+test),
> `getCardAccent`/`cardAccent` em `themes/index.js`, `SYSTEMS` em App.jsx deriva accent via overlay
> `getCardAccent` (+ `systems-accent` test). Tasks 2,4-8 (keyframes globais + telas) PENDENTES.
> **Onda 2 (Higgsfield) — COMPLETA (~55,6 créditos, 44,4 restantes):** `public/assets/higgsfield/`
> img/ (fog-embers, emblem-op/dnd/tormenta, logo-n — .webp c/ alfa), video/ (fog-loop, idle-op/dnd/
> tormenta, logo-n — .mp4+.webm 720p, kling3_0_turbo image-to-video dos emblemas), audio/
> (narracao-mestre.mp3, voz 'Vlad' seed_audio PT-BR). `manifest.json` tem os job IDs. GLB 3D do item 5
> virou vídeo giratório (GLB exigiria three.js). **Itens 11 (trilha) e 12 (SFX) IMPOSSÍVEIS neste
> conector** (generate_audio só faz fala). Item 8 (explainer 30s) adiado por orçamento.
> **Node RESTAURADO** (v24.18.0 via Chocolatey; `node.exe` de volta em `C:\Program Files\nodejs`, mas
> ainda não no PATH do sistema — reabrir terminal p/ `npm start` achar sozinho; nos comandos do agente
> uso PATH inline). **Onda 1 tasks 1 e 3 VERIFICADAS** (13 testes verdes) + **INTEGRAÇÃO FEITA e
> verificada:** `AmbientBackdrop` (vídeo fog + poster, reduced-motion) no login e na seleção;
> `useReducedMotion` hook; cards da seleção agora mostram o emblema `.webp` por sistema + **loop idle
> em vídeo no hover**; logo N animado (`NexusLogoAnimated`) no login; stagger na lista de features;
> bloco global de CSS de motion + `@media(prefers-reduced-motion)` no `<style>` de `G`. **Gates: build
> compila (exit 0) + 15 suítes/105 testes verdes.** Ativos em `public/assets/higgsfield/` (manifest.json).
> **Feito também:** shimmer no botão de login (`nx-shimmer`), progress dots do carrossel que preenchem
> no tempo (`nx-progress-dot`), e **crossfade entre seções** do app (`key={screen}` + `.fade` no wrapper
> de `renderScreen()` ~L11971). Logo N animada foi REVERTIDA (Andre não gostou; assets ficam no disco).
> Tilt 3D no card foi VETADO por Andre. **Onda 1 CSS COMPLETA:** pílula de nav deslizante FEITA
> (shared-layout no `Sidebar` — indicador único mede a posição do item ativo via refs/offsets e
> desliza com `transform`+`EASE_HOVER`/`DUR_ENTER`; primeiro consumidor real de `themes/motion.js`;
> reduced-motion coberto pelo `@media` global). **2026-07-09: fechadas as 2 lacunas visuais objetivas
> que ainda faltavam:** (AC-3) cards de sistema `available:false` agora usam **skeleton shimmer** (barras
> `.skeleton` no lugar de desc+tags; opacity 0.55→0.9) em vez de só dimmar; (AC-4) **selo PRO/Livre** novo
> no header do Dashboard — ouro com `nx-shimmer` quando `isSubscribed`, estático "Livre" senão (antes NÃO
> existia selo de assinatura nenhum). Gates: build exit 0 + 15 suítes/105 testes verdes.
> **2026-07-09: fechados também os 2 sub-itens do AC-2** — (1) inputs do login ganharam **underline
> dourado que "desenha"** no `:focus` (`.nx-field::after` com `scaleX(0)→1`; focus é essencial, sob
> reduced-motion só snapa); (2) **anel de runas NOVO** em volta do logo do login (`NexusSigilRing`:
> SVG que se desenha via `stroke-dashoffset`, depois respira em opacity + ticks giram devagar) —
> aplicado nos 2 logos (hero desktop 160 + card mobile 72); logo agora sem `animate`/float, a graça é
> o anel. **ATENÇÃO Andre:** o anel é elemento decorativo NOVO (o design assumiu que já existia um; não
> existia — o logo é um `.jpg`). Como você reverteu o logo-N animado antes, este anel é candidato a veto
> — veja renderizado e me diga. Gates: build exit 0 + 15 suítes/105 testes verdes. Onda 1 100% coberta.
> **Não integrado:** voz do Ajudante do Mestre
> (`audio/narracao-mestre.mp3`) — precisa de decisão de UX de onde plugar. Itens 8 (explainer) e 11/12
> (trilha/SFX — impossíveis neste conector) pendentes. Gates verdes: build exit 0. **Ver `specs/0017`.**

> **2026-07-05 (6): 0013 (biblioteca de assets) IMPLEMENTADA** — coleção do usuário
> `users/{uid}/assets/{assetId}` (`{type,name,tags[],folder,data,hash,w,h}`), reutilizável entre
> campanhas. Dock inferior 🎒 (AssetDock.jsx): abas por tipo (mapa/prop/montaria/personagem/
> anexo/nota), busca por nome + chips de tag (client-side via `filterAssets`/`assetTags`), grid de
> miniaturas draggable. "🎒 Salvar na biblioteca" no ctx menu de token/imagem (reduz a ~256px +
> `saveAsset`, respeita `ASSET_SOFT_CAP=300`). `placeAsset` cria elemento na camada certa
> (mapa/prop/montaria→image; personagem/anexo→token c/ imagem; nota→note) por clique/drop;
> em campanha copia a imagem via `saveImage(db,cid,null,data)` → **dedup por hash** `img_a_<hash16>`
> (reusa 0009; jogador lê da campanha, nunca de `users/`); modo pessoal grava direto no
> `imageStore`. Novos: `assets/assetLib.js` (puro + Firestore, 9 testes) + `AssetDock.jsx`.
> Gates: 13 suítes/92 testes + build verdes. **Rule NOVA (`users/{uid}/assets`) — precisa
> `firebase deploy --only firestore:rules` ANTES do app (manual do Andre).** Pendência: validação
> de mesa (checklist tasks.md 0013: salvar→dock · arrastar cria · mesmo asset 2×=1 img_a · jogador vê · busca/tag).
> **2026-07-05 (4): 0012 (fog avançada) IMPLEMENTADA** — formas círculo (arrasto centro→raio),
> polígono (clique-a-clique; fecha no 1º ponto/duplo-clique/Enter; Esc cancela) e traço livre
> (Douglas-Peucker ε=4px) em Cobrir/Cortar; poda por contenção no commit (substituiu Join/Trim
> — ratificado no plano: mask binária torna união no-op visual); sub-modo edição 🧽 (clique
> seleciona forma de fog, Delete/botão apaga); preview 👁 visão do jogador (asViewer, pixel-
> igual). Novos: fog.js (geometria pura, 11 testes) + FogLayer.jsx (mask memoizada extraída
> do index.jsx — decomposição transversal avançou). Gates: 12 suítes/83 testes + build verdes.
> **Sem mudança de rules/schema.** Pendência: validação de mesa (checklist tasks.md 0012).
> **2026-07-05 (5): DEPLOY** — commits `6456999` (F7 App.jsx) + `efd7e11` (Owlbear 0009-0012)
> em `origin/main` (github.com/Andreytyui/NEXUS-RPG); Firebase Hosting deployado
> (nexus-rpg-app.web.app / playnexusrpg.com). Rules v2 já estavam no ar desde a 0009. Próximo:
> fase 0013 (biblioteca de assets).

> **2026-07-05 (3): 0011 (camadas Owlbear + anexos) IMPLEMENTADA** — auto-grudar (anexo→
> personagem, personagem→montaria) por drop; mover pai arrasta a subárvore; apagar pai
> DESANEXA filhos (reducer); duplicar leva a subárvore com vínculos remapeados; z-order
> (frente/trás por camada); ctx menu ampliado (desanexar, z-order, substituir imagem AC-7).
> Novo módulo puro attach.js (findAttachTarget/subtreeIds/wouldCycle/dupSubtree) + teste.
> Guard de ciclo e hidden/camada-invisível cobertos. Gates: 11 suítes/72 testes + build
> verdes. **Sem mudança de rules.** Task 4 (extrair LayersPanel.jsx) ADIADA — decomposição é
> meta transversal, não AC; comportamento entregue completo. **Pendência:** validação de mesa.

> **2026-07-05 (2): 0010 (interação do jogador) IMPLEMENTADA** — jogador com ferramentas
> Selecionar/Régua/Apontar, move o PRÓPRIO token (throttle 300ms + final, gated por
> `canMove` no cliente e rules v2 no servidor), ping por duplo-clique, apontador e régua
> compartilhados (canal `live_{uid}`, throttle 250ms, staleness 6s), Sync View (mestre 📡 →
> jogador segue até pan manual), "Atribuir a…" no ctx menu do token, ciclo de permissão por
> camada no painel (🚷/👤/👥). Novos: permissions.js, sync/live.js, PingsOverlay.jsx (+2
> suítes de teste; bug real de throttle pego pelo teste). Gates: 10 suítes/63 testes + build
> verdes. **Sem mudança de rules** (0009 já cobria). **Pendência:** validação de mesa com 2
> navegadores (checklist na Task 5 do tasks.md da 0010) + deploy do hosting.

> **2026-07-05: PLANO MESTRE OWLBEAR aprovado (specs 0009–0016)** — paridade com Owlbear Rodeo
> no editor de mapas; plano em `~/.claude/plans/o-owlbear-foi-analisado-keen-steele.md`.
> **0009 (fundação de dados v2, ARQUITETURAL) IMPLEMENTADA + rules DEPLOYADAS:** ADR 0006
> aceito; elementos em docs próprios (`map/{sceneId}/elements/*`), multi-cena com ponteiro
> `map/state`, 7 camadas Owlbear, fog por shapes (SVG mask), grid objeto, migração lazy
> idempotente (Firestore, pelo mestre ao abrir) + fase 3 do migrateScene (localStorage).
> Novos módulos: schema.js, migrations.js, grid.js, sync/campaignSync2.js, sync/elementDiff.js;
> campaignSync.js v1 REMOVIDO. Gates: 8 suítes/49 testes + build verdes.
> **Pendência 0009:** validação manual das rules (AC-5, checklist no tasks.md da 0009) e da
> mesa com 2 navegadores (AC-1/3/6); deploy do app (hosting) após validação.
> **Próximas fases:** 0010 (interação do jogador) e 0011 (camadas/anexos) — podem rodar em
> paralelo, ambas só dependem da 0009.

> **0008 (editor Owlbear fase 1) implementada 2026-07-04:** ferramenta de desenho
> (livre/linha/retângulo/círculo, cor+espessura, preview), tokens com imagem (`img_tok_*`),
> tamanhos P/M/G/E, condições por emoji (ctx menu), névoa por retângulo de arrasto, atalhos
> V/T/D/F/R/N/M/G. Gate: 7 suítes/41 testes + build verdes. Fase 2 (backlog): ping, barra de
> HP, fog poligonal, resize/rotate de desenhos, biblioteca de assets.
> Domínio próprio no ar: playnexusrpg.com (Firebase) + api.playnexusrpg.com (Vercel), Cloudflare DNS.
> **2026-07-04 (2):** rules do mapa endurecidas e DEPLOYADAS — escrita só do mestre (ADR 0005 §4
> fechado). Trilhas de Especialista (Infiltrador/Técnico) **BLOQUEADAS**: textos oficiais dos
> poderes 40/65/99% não verificáveis via web com confiança — parafrasear do livro físico (Andre).
> **2026-07-04 (3): F7 CONCLUÍDA** — spec 0002 fechada: footer extraído p/ `AppFooter` (módulo),
> função `App()` = 385 linhas (AC-4 verde via comando da spec). Gates: build + 7 suítes/41 testes
> verdes. AC-5 (regressão zero) aguarda teste manual no browser (login → ficha → campanha).
> **Bug em produção descoberto 2026-07-04:** login Google falha em playnexusrpg.com —
> domínio não está em Authorized domains do Firebase Auth (Console → Authentication →
> Settings → Authorized domains → adicionar `playnexusrpg.com`). Manual do Andre.

## Em andamento / próximo passo
- **Ritual de afinidade por elemento (2026-08-08):** a transição pós-escolha era a mesma para os
  cinco elementos (`op-el-erupt`, scale-up do símbolo, 1,5s). Agora cada um tem coreografia
  própria em `ElementoRitual.jsx` (Sangue pulsa e inunda · Morte desenrola espirais e vira cinza ·
  Conhecimento converge runas e abre o olho · Energia sobrecarrega e estoura · Medo materializa
  aos solavancos e fecha a névoa), 2,6s, SVG/CSS puro, com `prefers-reduced-motion`. `RITUAL_MS`
  virou fonte única: a ficha agenda a persistência por ele (era `1500` solto). CSS morto removido
  de `ordemStyles.jsx`. Gate: 108 suítes/2518 testes verdes + 6 testes novos.
  **Pendente:** validação visual no browser (não conferida — só o gate automatizado rodou).
- **Missão SaaS — plano F1→F7 (aprovado 2026-07-02):** F1–F6 implementadas
- **F6 (mesa tática multiplayer, spec 0007 + ADR 0005) implementada 2026-07-04:** MapEditor é o
  mapa oficial da campanha (mestre edita → `campaigns/{id}/map/scene` + `map/img_*`; jogador vê
  ao vivo read-only com fog opaca); tile-based REMOVIDO do CampaignMapTab (−16,8KB). Gate:
  7 suítes/41 testes + build verdes. **Pendências:** (1) validação manual na mesa com 2
  navegadores (mestre+jogador) — registrar aqui; (2) Andre ratificar ADR 0005
- **Tipografia OP (AC-6 da 0007, pedido do Andre 2026-07-04):** `--font-body` IM Fell English→Inter,
  `--font-data` Share Tech Mono→IBM Plex Mono; nome do personagem (Cinzel Decorative) e títulos
  (Cinzel) intocados
- **AINDA PENDENTE (Vercel, manual do Andre):** env vars `FIREBASE_WEB_API_KEY` (obrigatória —
  sem ela `/api/ai` falha fechado) e `MERCADOPAGO_WEBHOOK_SECRET` (recomendada)
- **Próximo passo:** validações manuais do Andre — (1) mesa com 2 navegadores, (2) fluxos pós-F7
  no browser (AC-5 da 0002), (3) domínio `playnexusrpg.com` nos Authorized domains do Firebase
  Auth, (4) env vars Vercel; backlog: trilhas de Especialista faltantes
- `0002-split-app-jsx` **CONCLUÍDA 2026-07-04** (F7): hooks useAuth/useCharacter/useCampaign +
  App() enxuto (385 linhas, AC-4); AC-5 pendente de teste manual no browser

## Decisões recentes
- 2026-07-03: F5 (spec 0006) — verificação contra o oficial REFUTOU a auditoria em PV/PE/peTurno (código já era fiel; **migração de máximos descartada**). Fixes reais: DT de rituais agora calculada (10 + NEX/5 + PRE + bônus; campo manual legado migra p/ bônus, idempotente), deslocamento oficial 9m/6q (era 6+AGI), NEX_LADDER com marcos oficiais (trilha 10/40/65/99, atributo 20/50/80/95, afinidade só no 50), PATENTES = tabela oficial de 5 por Pontos de Prestígio (`patenteForPrestigio`; `patenteForNex` removido)
- 2026-07-03: F2 implementada (spec 0004) — rules protegem `plan`/`subscribedSystems` (fecha paywall burlável), `publicSheets` com dono (legados reivindicáveis), regra p/ subcoleção `map` (destrava sync); webhook verifica pagamento na API do MP + HMAC opcional, Catarse vira ativação manual; `/api/ai` exige ID token + rate limit; CORS allowlist; fix: login não reseta mais `plan` (`useAuth`). Deploy manual pendente.
- 2026-07-02: Auditoria FASE 0 (frentes A–E) + plano F1→F7 aprovado. Críticos: violações da licença OP, paywall burlável (`users/{uid}` write), webhook sem assinatura/formato Catarse≠MP, dois sistemas de mapa (novo é localStorage-only, sem regra Firestore p/ `campaigns/{id}/map`)
- 2026-07-02: F1 implementada — selo + texto obrigatório (`src/components/LicencaOP.jsx`), rótulos "Conteúdo oficial" renomeados, avisos de IA (flag `form.avatarAI`), checklist em `docs/product/conformidade-licenca-op.md`
- 2026-07-02: Decisões de produto aprovadas: rules.js fiel ao livro oficial (F5, com migração de máximos); MapEditor novo vira o mapa multiplayer oficial e o tile-based será aposentado (F6, exigirá ADR); IA tratada como recurso gratuito até validação jurídica (licença proíbe IA em conteúdo comercial)
- 2026-06-24: Spec `0002-split-app-jsx` completa — product.md, design.md, domain.md, spec.md, tasks.md criados
- 2026-06-24: Chat UI redesenhado — bubbles mais claras, fonte 17px, input 42px, botão roxo
- 2026-06-24: Correção de join de campanha — multi-where Firestore → single-where + filtro client-side
- 2026-06-24: Regra Firestore adicionada — não-membros podem se adicionar via inviteCode
- 2026-06-23: CI/CD criado em `.github/workflows/ci.yml` — build + testes + cobertura como artefato
- 2026-06-22: Firebase como backend — [ADR-0002](architecture/adr/0002-firebase-backend.md)
- 2026-06-22: React CRA como bundler — [ADR-0003](architecture/adr/0003-react-cra.md)
- 2026-06-22: Inline styles como estratégia — [ADR-0004](architecture/adr/0004-inline-styles.md)

## Bloqueios
- Nenhum bloqueio ativo

## Ideias adiadas / backlog técnico
- Cobertura mínima (%) — definir após primeiros testes dos hooks
- Migração de CRA para Vite → após split de App.jsx
- TypeScript → quando base de testes estiver sólida

## Todos soltos
- [x] F1: conformidade da licença OP (spec 0003) — implementada 2026-07-02; validar com `/validar`
- [x] F2: segurança e pagamentos (spec 0004) — implementada 2026-07-03
- [x] Deploy F2 (Firebase): `firebase deploy --only firestore:rules` + hosting — feito 2026-07-03
- [ ] Deploy F2 (Vercel): env vars `FIREBASE_WEB_API_KEY` e `MERCADOPAGO_WEBHOOK_SECRET` no painel (manual)
- [ ] Trilhas de Especialista faltantes (Infiltrador, Técnico) + revisão paráfrase×cópia dos textos de poderes (fora de escopo da 0006)
- [ ] Pendência jurídica: IA × conteúdo comercial (ver `docs/product/conformidade-licenca-op.md`)
- [ ] Revisar `src/data/ordemParanormal/*.json` — paráfrase vs texto copiado do livro
- [x] Task 1: criar `src/hooks/useAuth.js`
- [x] Task 2: criar `src/hooks/useCharacter.js`
- [x] Task 3: criar `src/hooks/useCampaign.js`
- [x] Task 4: refatorar App.jsx para < 400 linhas — feito 2026-07-04 (App() = 385 linhas)
- [x] Task 5: rodar testes — 7 suítes/41 testes verdes, cobertura em `coverage/` (2026-07-04)
- [ ] Adicionar `playnexusrpg.com` aos Authorized domains (Firebase Console → Authentication → Settings) — login Google quebrado em produção até lá (manual)
- [x] Spec `0002-split-app-jsx` — todos os artefatos criados
- [x] Configurar GitHub Actions (ci.yml — build + testes + cobertura)
- [x] Secrets do Firebase configurados no GitHub
- [ ] Adicionar testes para `rules.js` (cálculos OP) — pós-split
- [ ] Deploy 0013 (Firebase): `firebase deploy --only firestore:rules` (regra nova `users/{uid}/assets`) ANTES do app + hosting (manual do Andre)
