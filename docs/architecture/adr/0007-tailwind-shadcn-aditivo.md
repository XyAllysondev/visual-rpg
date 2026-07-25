---
name: adr-0007-tailwind-shadcn-aditivo
description: ADR — adoção ADITIVA de Tailwind CSS + shadcn/ui ao lado dos inline styles. Puxe ao criar telas novas com muitos componentes, avaliar a UI de um SaaS, ou mexer no build (CRACO/PostCSS).
alwaysApply: false
---

# ADR-0007: Tailwind CSS + shadcn/ui como camada aditiva

- **Status:** aceito
- **Data:** 2026-07-21
- **Decisores:** Andre (Andrey Lucas de Andrade Nonardo)
- **Emenda a:** [[adr-0004-inline-styles]] (não o revoga — ver Decisão)

## Contexto
O NEXUS caminha para um SaaS com muitas jornadas e telas ricas em componentes
(tabelas, checkboxes, dialogs, forms). Construir e revisar cada um desses componentes
do zero em inline styles (ADR-0004) é lento e inconsistente. O shadcn/ui oferece uma
biblioteca open-source de componentes acessíveis e padronizados (Radix + Tailwind),
com CLI/MCP para o LLM puxar componentes prontos em vez de reinventá-los, e é
totalmente customizável pelo tema da marca. O bloqueio: shadcn exige Tailwind, e o
ADR-0004 havia descartado Tailwind.

## Decisão
Adotar **Tailwind CSS v3 + shadcn/ui de forma ADITIVA**, convivendo com os inline
styles — **não** é uma migração big-bang. O ADR-0004 continua válido para o app
existente; Tailwind é a ferramenta preferida para **telas/componentes novos** e para
padronizar UI de produto.

Decisões de implementação (o que trava a segurança da coexistência):
- **`corePlugins.preflight: false`** — o reset global do Tailwind quebraria o visual de
  todo o app inline-styled. Sem preflight, utilities e componentes shadcn convivem sem
  resetar nada. Um `@layer base` escopado a classes com `border`/`box-border`
  (`src/tailwind.css`) restaura só o essencial que as utilities assumem — atinge apenas
  componentes shadcn, pois o app usa `style` inline, não classNames.
- **Tokens namespaced `--sh-*`** — o tema shadcn não colide com os `--purple`/`--gold`
  existentes. Paleta afinada ao gótico do NEXUS (primary = dourado, accent = roxo).
- **CRA via CRACO** — react-scripts 5 não lê `tailwind.config.js` sozinho e não permite
  config custom de PostCSS sem `eject`. `@craco/craco` injeta o Tailwind no PostCSS e
  registra o alias `@` → `src` (usado pelos imports do shadcn). Scripts npm passam a
  `craco start/build/test`; `eject` segue em react-scripts.
- **Config shadcn** em `components.json` (style new-york, tsx:false, iconLibrary lucide)
  → `npx shadcn@latest add <componente>` / MCP escrevem em `src/components/ui/`.

Alternativas descartadas: migrar CRA→Vite agora (shadcn suporta Vite nativamente, mas é
uma troca de build maior e arriscada — adiada, ver Consequências); Tailwind v4 (mudou
todo o setup, frágil com CRA+CRACO); reescrever tudo em Tailwind (perde o que já
funciona, risco altíssimo).

## Consequências
- **+** Componentes prontos, acessíveis e consistentes; o LLM puxa do registry em vez de
  reinventar. Base para a UI do SaaS.
- **+** Aditivo e reversível: o app existente não muda; dá para adotar tela a tela.
- **+** Customização total via tokens `--sh-*` (tema da marca por cima).
- **−** Dois paradigmas de estilo no mesmo repo (inline styles + Tailwind) — exige
  disciplina: inline no legado, Tailwind/shadcn no novo. Documentar em cada PR.
- **−** Dependência de CRACO (CRA está deprecado). Dívida técnica registrada: **migrar
  para Vite** quando fizer sentido — aí shadcn fica no caminho oficial e o CRACO sai.
- **−** preflight OFF significa que componentes shadcn podem precisar de pequenos ajustes
  (ex.: `box-border`, `border-solid`) que o reset daria de graça — já tratado no
  `@layer base` escopado.
- **−** +~3 kB gzip no bundle (cva/clsx/tailwind-merge/radix-slot) + CSS purgado por uso.
