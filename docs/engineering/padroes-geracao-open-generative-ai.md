# Padrões extraídos do Open-Generative-AI

Fonte: `Desktop/Nexus RPG/Open-Generative-AI` (MIT, Anil-matcha). É um front-end de estúdio
generativo (imagem, vídeo, lip sync, cinema) que fala com a API paga da MuAPI. Ele **não roda
modelo local por padrão** — todo o valor pro Nexus está na camada de UX/estado de geração
assíncrona, não no backend.

Isto é um catálogo de padrões para portar sob demanda. Nada aqui foi aplicado ao Nexus ainda.

---

## 1. Submit → poll → normalize (o núcleo)

`src/lib/muapi.js` (557 linhas) tem um método por modalidade (`generateImage`, `generateVideo`,
`generateI2I`, `generateI2V`, `processV2V`, `processLipSync`) e todos seguem o mesmo esqueleto:

1. POST no endpoint do modelo → resposta traz `request_id`
2. `pollForResult(requestId, key, maxAttempts, interval)` — GET a cada 2s até
   `status ∈ {completed, succeeded, success}`
3. Normaliza a saída com `result.outputs?.[0] || result.url || result.output?.url`

Três detalhes que valem copiar:

- **5xx no poll não aborta** — `if (response.status >= 500) continue;`. Só erro 4xx mata o job.
- **Orçamento de tempo por modalidade** — imagem usa 60 tentativas (~2 min), vídeo/lipsync usa
  900 (~30 min). Mesma função, parâmetro diferente.
- **`onRequestId` callback** — dispara assim que o id chega, *antes* do poll começar, para o
  chamador persistir o job. Isso é o que torna o padrão 2 possível.

## 2. Jobs pendentes que sobrevivem ao reload

`src/lib/pendingJobs.js` (33 linhas — o arquivo mais barato/valioso do repo).

Um array em `localStorage['muapi_pending_jobs']`, chaveado por `requestId`, com
`{requestId, studioType, submittedAt, interval, maxAttempts, historyMeta}`.

Na montagem do estúdio (`ImageStudio.js:1080+`), ele:
- lê `getPendingJobs('image')`
- **recalcula o orçamento restante** a partir do relógio, não do zero:
  `attemptsLeft = maxAttempts - floor((Date.now() - submittedAt) / interval)`
- mostra um banner "Resumindo N gerações pendentes…" que decrementa e some sozinho
- `removePendingJob` no `finally` — sucesso ou falha, o job sai da fila

Esse é o padrão mais diretamente aproveitável no Nexus: qualquer geração de arte de token/NPC que
leve minutos precisa sobreviver a um F5 do mestre no meio da sessão.

## 3. Histórico com teto e thumbnails locais

- `localStorage['muapi_history']`, `slice(0, 50)` na escrita — teto explícito, sem GC separado.
- `src/lib/uploadHistory.js` gera o thumb no cliente: canvas 80×80, **center-crop quadrado**
  (`size = min(w,h)`, offset centralizado), `toDataURL('image/jpeg', 0.6)`. Guarda 20 uploads.
  Evita segurar a imagem cheia em base64 no storage.
- Sidebar de histórico só aparece quando há ≥1 entrada; o item ativo é marcado por borda.
- Download faz `fetch → blob → <a download>`, com fallback `window.open` se o CORS barrar.

## 4. Catálogo de modelos declarativo

`packages/studio/src/models.js` é **gerado** a partir de `models_dump.json` (75 KB). Cada modelo
declara `{id, name, endpoint, provider, inputs}` onde `inputs` é um mini-JSON-Schema por campo
(`type`, `enum`, `default`, `description`, `examples`).

O cliente nunca hardcoda o formato do payload — ele lê o descritor. Campos-chave:

- `endpoint` — a rota real, separada do `id` de UI
- `imageField` / `lastImageField` / `videoField` — **qual chave do payload recebe o asset**, porque
  cada provedor batizou diferente (`image_url` vs `images_list` vs `end_image_url`)
- `hasPrompt` — se o modelo aceita texto

É a lição de arquitetura mais forte do repo: a divergência entre provedores vira dado, não `if`.
Se o Nexus for falar com Higgsfield + Morpfix + MiniMax, esse é o formato a adotar.

## 5. Composição de prompt por controles, não por texto livre

`src/lib/promptUtils.js` mapeia escolhas de UI para fragmentos de linguagem natural:
`CAMERA_MAP`, `LENS_MAP`, `FOCAL_PERSPECTIVE` (8/14/24/35/50/85mm), `APERTURE_EFFECT`.
`buildNanoBananaPrompt()` concatena base + câmera + lente + perspectiva + abertura + tags de
qualidade, filtrando vazios.

Também há `QUICK_PROMPTS` (8 presets: Portrait, Fantasy, Sci-Fi…) e `ENHANCE_TAGS` agrupadas por
eixo (quality / lighting / mood / style) para o usuário empilhar sem escrever prompt.

Aplicação óbvia no Nexus: um seletor de "estilo de token" / "clima da cena" que compila prompt
consistente com a identidade gótica, em vez de deixar o mestre escrever prompt cru.

## 6. Proxy server-side pra chave de API

`app/api/api/v1/[[...path]]/route.js` reencaminha pro provedor removendo `host`, `connection` e
`cookie` e repassando só o `x-api-key`. Tem dois comentários de correção de segurança no código:
auth por cookie foi removida (CWE-522) e log de credencial foi removido (CWE-200).

Contraponto importante: **no modo browser a chave fica em `localStorage['muapi_key']`**
(`muapi.js:10`). Isso é aceitável num app Electron de uso pessoal e é inaceitável no Nexus, que é
multiusuário — se portarmos qualquer coisa daqui, a chave tem que viver só no servidor
(Firebase Function), com o cliente chamando nossa rota, nunca a do provedor.

---

## O que NÃO aproveitar

- **DOM imperativo.** `ImageStudio.js` (1322 linhas) e `VideoStudio.js` (1311) montam a UI com
  `document.createElement` + `innerHTML` + classes Tailwind em string. O Nexus é React; portar
  esses arquivos seria retrocesso. Extraia a lógica, redesenhe a view.
- **`innerHTML` com dado de usuário.** `renderHistory()` interpola `entry.prompt` e `entry.url`
  direto em template string. Num app multiusuário isso é XSS.
- **Acoplamento à MuAPI.** Todo o `muapi.js` presume o contrato deles (`x-api-key`,
  `/api/v1/predictions/:id/result`). O padrão submit/poll é geral; o transporte não é.
- **Electron/electron-builder, workspaces e os 3 submódulos** (Vibe-Workflow, Open-Poe-AI,
  Open-AI-Design-Agent) — escopo totalmente fora do Nexus.

## Ordem sugerida de adoção

1. `pendingJobs` + `pollForResult` (com o recálculo por relógio) — resolve geração longa hoje
2. Descritor de modelos declarativo — antes de plugar o 2º provedor, não depois
3. Compilador de prompt por controles — casa com a identidade visual do Nexus
4. Histórico com teto + thumb local — só quando houver volume de geração pra justificar
