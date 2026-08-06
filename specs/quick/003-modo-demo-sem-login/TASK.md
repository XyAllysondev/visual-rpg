---
name: quick-task-003-modo-demo-sem-login
description: Quick task 003 — ambiente de teste local que roda o app sem login e sem Firestore.
alwaysApply: false
---

# Quick Task — 003-modo-demo-sem-login

- **O quê:** um modo demo ligado por `?demo=1` que entra no app com usuário falso,
  dados fictícios e **zero** chamadas ao Firestore — para ver e clicar o app localmente
  sem criar conta e sem tocar no banco de produção.
- **Por quê / origem:** pedido do Andre em 2026-08-05, logo depois do redesenho do Painel
  (quick 002): *"eu quero testar o site como está agora, faça um ambiente teste sem
  precisar de login"*.
- **Passos:**
  - [x] `src/demo/demoMode.js` — a trava, a semente e os dados fictícios
  - [x] `src/demo/DemoBadge.jsx` — selo fixo "modo demo · dados fictícios" + botão sair
  - [x] `src/index.js` — `prepararDemo()` antes do React montar + o selo
  - [x] `src/hooks/useAuth.js` — usuário falso, sem `onAuthStateChanged`
  - [x] `src/hooks/useCharacter.js` — pula leitura/escrita no Firestore (localStorage já era o fallback)
  - [x] `src/hooks/useCampaign.js` — mesas do módulo demo; criar/entrar/sair em memória, pelas MESMAS regras de domínio
  - [x] `src/App.jsx` — plano e o listener de fichas ao vivo saem do módulo demo
  - [x] `src/components/Painel/index.jsx` — contagens de mapas/mundos do módulo demo
  - [x] `testar-nexus-demo.bat` — atalho, no mesmo formato do `iniciar-nexus.bat`
- **Gate:** suíte completa **2133 verdes** · `craco build` sem avisos nos arquivos novos ·
  navegação dirigida por Playwright nas 8 telas do menu → **0 erros de console** ·
  build de produção servido em `:3100` com `?demo=1` → **cai no /login** (a trava vale).

## A trava (é o ponto mais importante desta task)

```
permitido = NODE_ENV !== "production" || REACT_APP_DEMO === "1"
```

No site publicado, `NODE_ENV` é `production` e `REACT_APP_DEMO` não existe → `permitido`
é falso e o `?demo=1` **não faz nada**. Verificado servindo o build real, não por leitura
de código. Para gerar de propósito um build de demonstração (uma preview na Vercel, por
exemplo), builde com `REACT_APP_DEMO=1` — é escolha consciente, não acidente.

## O que funciona e o que não funciona no modo demo

| Tela | Estado |
|---|---|
| Painel | completo — 2 fichas, 2 mesas, preparo 3/4, pendências |
| Fichas | completo — criar/editar/excluir persistem no localStorage |
| Campanhas | completo — criar/entrar/sair em memória, com as regras de cota e lotação |
| Trilhas · Roadmap · Planos | completo (são estáticas ou de serviço externo) |
| Mapas | só o hub. Entrar numa mesa tática ou mapa-múndi ainda vai ao Firestore |
| Ajudante do Mestre (Forja) | mostra "não foi possível carregar seus mundos" |

Fechar esses dois últimos exige falsificar o `worldsStore` (8 funções) e os repositórios do
Ateliê (`worldMapsRepo`, `mesaRepo`, `fogRepo`, `assetsRepo`, `mapSyncRepo`) — é uma task
própria, não cabia nesta.

## Custo aceito

Os dados fictícios (~3 KB) **entram no bundle de produção** — o `DEMO_ON` é falso lá, mas
as constantes são importadas pelos hooks e não são removidas pelo tree-shaking. Se isso
incomodar, o caminho é um `import()` dinâmico atrás da trava.
