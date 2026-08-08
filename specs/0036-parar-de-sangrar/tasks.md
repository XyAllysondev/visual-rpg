---
name: tasks-0036-parar-de-sangrar
description: Quebra de tasks da spec 0036. Puxe ao retomar o trabalho de honestidade do produto.
alwaysApply: false
---

# Tasks — 0036 Parar de sangrar

**Gate:** `CI=true npx craco test --runInBand --watchAll=false` · `npm run build`

| Marco | Suítes | Testes | Build |
|---|---|---|---|
| Antes da 0036 (fim da 0035) | 103 | 2.460 | exit 0 |
| **Onda 1 — rodapé, links, source maps** | **104** | **2.468** | exit 0 |

> ⚠️ `CI=true npm run build` reprova por avisos **pré-existentes** (`App.jsx`,
> `DungeonsAndDragonsSheet.jsx`, `OrdemParanormalSheet.jsx`, `Editor/CamadaDeNevoa.jsx`,
> `model/viagem.js`). `npm run build` sai 0 e nenhum arquivo desta spec produz aviso.

## Onda 1 — o que não dependia de ninguém ✅

| # | Task | Arquivo | AC | Status |
|---|------|---------|----|--------|
| 1 | `GENERATE_SOURCEMAP=false` — o código-fonte para de ir para produção | `.env.production` | AC-8 | ✅ |
| 2 | `.gitignore` cobre `.env.local` e `.env.*.local` (o `.env` pelado casa só com o nome exato) | `.gitignore` | — | ✅ |
| 3 | `lib/links.js` — o lugar único de todo endereço externo, com a data de expiração do convite | `src/lib/links.js` (novo) | AC-2 | ✅ |
| 4 | Rodapé: 3 `<span>` mortos viram 2 `<a>` reais + 1 `<button>` de navegação | `src/ui/AppFooter.jsx`, `src/App.jsx:493` | AC-1 | ✅ |
| 5 | Os 2 convites literais passam a importar do lugar único | `RoadmapScreen.jsx:173`, `SystemSelect.jsx:270` | AC-2 | ✅ |
| 6 | Gate dos links e do rodapé (8 testes), com **alarme de expiração** | `src/lib/__tests__/links.test.js` (novo) | AC-1, AC-2 | ✅ |

> **O alarme é o ponto da Onda 1.** O convite antigo morreu em silêncio e ficou meses convidando
> para uma porta fechada. Agora `DISCORD_EXPIRA_EM` (hoje `2026-09-06`, lido do `expires_at` da
> API do Discord) faz o gate **falhar uma semana antes** — o convite morre num build vermelho, não
> na cara de um visitante. Com um convite permanente, `null` desliga o alarme.

## Onda 2 — bloqueada em insumo do Andre

| # | Task | Bloqueio |
|---|------|----------|
| 7 | Convite permanente do Discord | Gerar com `Expira após: Nunca` · `Usos: Sem limite` e trocar `DISCORD_URL` |
| 8 | `suporte@playnexusrpg.com` roteando | Cloudflare → Email → Email Routing. **Bloqueia o deploy:** o `mailto:` já está no código, e caixa que não existe é o mesmo defeito, só que silencioso |
| 9 | Firebase Analytics (N1·04) | Falta `measurementId` — o `firebaseConfig` tem 6 chaves e nenhuma é essa |

## Onda 3 — o que falta, na ordem do crítico

| # | Task | Arquivo | AC | Status |
|---|------|---------|----|--------|
| 10 | Roadmap público para de negar o que foi entregue (7 itens errados, não 4) | `src/roadmapData.js` | AC-3 | ⬜ |
| 11 | **Roteamento lê a URL antes do estado** — reescrita do bloco, sozinha | `src/App.jsx:88, 197-234` | AC-7 | ⬜ |
| 12 | Um limite de fichas, uma fonte (`charLimitFor` no domínio) | `domain/character.js`, `App.jsx:280,391`, `SheetList.jsx:41-47` | AC-4 | ⬜ |
| 13 | "✦ Plano Pro" deixa de ser hardcoded para todo mundo | `src/ui/Topbar.jsx:243` | AC-5 | ⬜ |
| 14 | Planos: lista de espera no lugar da venda de sistema fechado; copy sem "IA sem restrições" nem "ilimitadas" | `PlansScreen.jsx:60,13-36,134-145`, `UpgradeModal.jsx:24` | AC-6 | ⬜ |
| 15 | Mural "Novidades": 7 itens falsos, 14 `<a href="#">`, pontinho permanente | `src/ui/Topbar.jsx:9-58,351-374` | AC-1, AC-6 | ⬜ |
| 16 | "Higgsfield" prometido em 2 telas sem integração | `FullSheet.jsx:383`, `CharacterCreator.jsx:352,380` | AC-6 | ⬜ |
| 17 | Barra inferior do celular rola antes de ganhar itens | `appShell.jsx:287-299`, `MobileBottomNav.jsx:12` | AC-9 | ⬜ |

**Ordem obrigatória:** 11 antes de 12 (mesmo arquivo, e 11 reescreve bloco); 12 antes de 14 (é o 12
que fixa a verdade "até 5 fichas" que a copy tem de refletir); 17 depois de 11 (dar porta mobile ao
`/roadmap` é inútil enquanto rota colada não sobrevive); analytics por último, porque o `page_view`
mora dentro do bloco que a 11 reescreve.
