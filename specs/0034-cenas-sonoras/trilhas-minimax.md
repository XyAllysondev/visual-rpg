---
name: trilhas-minimax
description: Briefings prontos das oito trilhas de Ordem Paranormal para o music_generation do MiniMax. Use ao gerar o áudio, quando o MCP estiver conectado.
alwaysApply: false
---

# Trilhas das cenas — briefings para o MiniMax

> **Estado: GERADO em 2026-08-03.** As oito faixas saíram do `music_generation` do MiniMax com os
> briefings abaixo e estão em **`Desktop/Nexus RPG/trilhas-op/`**, nomeadas `1-investigacao.mp3`
> … `8-interludio.mp3`. ~11,9 MB no total, mp3 44,1 kHz / 256 kbps, cerca de 1 min cada.
>
> **ARMADILHA — o destino estava errado na primeira rodada.** O `MINIMAX_MCP_BASE_PATH` apontava
> para `nexus-rpg/public/media`, e tudo em `public/` **entra no build**: seriam ~12 MB embarcados no
> deploy para todo usuário baixar, sem motivo — a spec 0034 estabelece que o app NÃO serve acervo
> próprio (o mestre importa os MP3 na aba Local e eles ficam no IndexedDB dele). Os arquivos foram
> movidos para fora do repositório e o `.mcp.json` foi corrigido para `Nexus RPG/midia-gerada`.
> **Se for gerar mais áudio, confira o destino antes.**

## A restrição que moldou estes textos

`music_generation` do MiniMax exige **dois** campos, os dois obrigatórios:

| Campo | Regra |
|---|---|
| `prompt` | 10–300 caracteres. Estilo, clima, cena. |
| `lyrics` | 10–600 caracteres. Linhas separadas por `\n`. Aceita `[Intro]`, `[Verse]`, `[Chorus]`, `[Bridge]`, `[Outro]`. |

Não há como pedir instrumental puro. A saída — que foi ideia do Andre — é **letra mínima**: o
texto abaixo é quase todo marcador de seção, com poucas palavras soltas para o modelo sussurrar ou
sustentar. O resultado tende a ficar instrumental com voz usada como textura, que é o que a mesa
precisa: nada que dispute com a narração do mestre.

Todas as letras estão em português e evitam nome próprio do cenário — o objetivo é ambiência, não
canção temática.

## Parâmetros comuns

```
format : mp3
sample_rate: 44100
bitrate: 256000
output_directory: nexus-rpg/public/media   (já configurado em MINIMAX_MCP_BASE_PATH)
```

Cada faixa gerada deve ser importada pelo mestre na aba **Local** da tela de Trilhas e vinculada à
cena correspondente (spec 0034). O app **não** serve acervo próprio — ver a seção "Por que não foi
gerado áudio com IA" na `spec.md`.

---

## 1 · Investigação

**prompt**
> Ambiência noir lenta: piano solitário com sustain longo, contrabaixo em surdina, chiado de vinil,
> cordas paradas ao fundo. Sem percussão, sem clímax, sem resolução.

**lyrics**
```
[Intro]
[Verse]
o que ficou
na sala vazia
[Outro]
```

## 2 · Tensão

**prompt**
> Drone grave crescendo muito devagar, sinos abafados ao longe, respiração de sintetizador,
> dissonância leve que nunca resolve. Suspense contido, sem susto.

**lyrics**
```
[Intro]
[Verse]
alguma coisa
está errada
[Outro]
```

## 3 · Terror

**prompt**
> Cordas em cluster agudo, metais graves rasgados, percussão irregular como passo apressado,
> ruído branco pulsando. Horror aberto, instável, sujo.

**lyrics**
```
[Intro]
[Chorus]
corre
não olha
corre
[Outro]
```

## 4 · Combate

**prompt**
> Percussão pesada em ostinato, baixo distorcido, cordas em staccato, metais curtos. Andamento
> rápido e constante, energia de perseguição armada. Rock orquestral sombrio.

**lyrics**
```
[Intro]
[Chorus]
agora
agora
[Bridge]
[Outro]
```

## 5 · Perseguição

**prompt**
> Bateria eletrônica acelerada, arpejo de sintetizador subindo, baixo pulsante, respiração
> ofegante ao fundo. Urgência contínua, sem pausa, industrial.

**lyrics**
```
[Intro]
[Chorus]
não para
não para
[Outro]
```

## 6 · Ritual

**prompt**
> Coro grave em bocca chiusa, tambor cerimonial lento, sino de bronze, cordas microtonais.
> Sagrado e errado ao mesmo tempo. Ritmo de procissão.

**lyrics**
```
[Intro]
[Verse]
abre
o que estava fechado
[Outro]
```

## 7 · O Outro Lado

**prompt**
> Textura ambiente sem pulso, vozes reversas distantes, piano tocado dentro do corpo do
> instrumento, graves infrassônicos. Sensação de espaço errado, sem chão, sem tempo.

**lyrics**
```
[Intro]
[Verse]
aqui
não é aqui
[Outro]
```

## 8 · Interlúdio

**prompt**
> Violão dedilhado, piano elétrico morno, cordas suaves, chuva leve ao fundo. Melancólico e
> calmo, respiro entre missões. Sem tensão.

**lyrics**
```
[Intro]
[Verse]
por enquanto
está tudo bem
[Outro]
```

---

## Ao gerar

1. Confirme que o MCP `minimax` está na sessão antes de qualquer coisa.
2. Gere **uma** faixa primeiro (sugestão: Interlúdio, a mais barata de avaliar) e mostre ao Andre.
   Só depois dispare as sete restantes — o custo é por geração e o gosto dele é o critério.
3. Se a voz aparecer demais em alguma, corte a letra para só os marcadores mais uma palavra.
