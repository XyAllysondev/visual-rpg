---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Memória de trabalho **entre sessões** (humanos e agentes). É **volátil**: atualizada o tempo
> todo. Diferente do **ADR** (decisão durável e imutável). Decisão estrutural → ADR; estado do
> trabalho → aqui. Atualize ao **pausar/encerrar**; leia ao **retomar**. Use a skill `/handoff`.

**Última atualização:** 2026-07-21 por Claude (Tailwind+shadcn ADITIVO instalado — ADR-0007; build+testes verdes; NÃO deployado)

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
