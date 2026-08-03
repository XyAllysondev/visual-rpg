---
name: spec-0024-conteudo-op-completo
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Conteúdo OP completo: trilhas de Especialista, poderes oficiais e compêndio de regras

> **Fonte da verdade.** Status: aprovado (Andre, 2026-07-25 — "FAÇA ISSO" sobre o plano
> trilhas → poderes → compêndio, proposto após o levantamento de lacunas do conteúdo OP).
> Método (mesmo da spec 0006): verificação contra fontes secundárias do livro v1.1 ANTES de
> codificar; texto sempre **parafraseado** (obrigação da licença — spec 0003).

## Verificação de fontes (2026-07-25)

| Fato | Fonte | Confiança |
|---|---|---|
| Trilhas de Especialista do livro base = Atirador de Elite, **Infiltrador**, Médico de Campo, Negociador, **Técnico** | Wiki oficial da comunidade (Fandom, página Classes) | Alta |
| Infiltrador 10/40/65/99 = Ataque Furtivo / Gatuno / Assassinar / Sombra Fugaz; escalada +1d6→2d6→4d6→8d6 | Fandom + wiki Ordem Extermínio (nomes e escalada idênticos ao oficial) | Alta (nomes) / Média (números finos) |
| Técnico 10/40/65/99 = Inventário Otimizado / Remendão / Improvisar / Preparado para Tudo | Studocu (guia do livro) + texto do livro (pdfcoffee) — duas fontes | Alta |
| Poderes de classe oficiais (18 Combatente, 15 Especialista, 16 Ocultista) | Texto do livro (pdfcoffee, extração dirigida) | Alta (nomes) / Média (detalhe fino) |
| Graus de treino oficiais: Destreinado/Treinado/**Competente**/Expert (0/+5/+10/+15) | Texto do livro | Alta |
| Ações de combate (padrão/movimento/completa/livre/reação) e manobras (agarrar, derrubar, desarmar, empurrar, quebrar) | Texto do livro | Alta |
| Ações de interlúdio: Dormir, Relaxar (diretas); Ler, Revisar o Caso, Consertar (citadas por habilidades que as usam); Alimentar-se | Texto do livro (parcial) | Média |

**Não verificado (fica FORA):** DTs finas de dano massivo/sangramento em combate; efeitos
numéricos exatos de cada ação de interlúdio. O compêndio descreve essas regras em nível
qualitativo e o texto marca o que é resumo.

## Critérios de aceite

### AC-1: Trilhas de Especialista completas
- **Dado** `CLASS_TRAILS.especialista`
- **Quando** `rules.js` é importado
- **Então** contém as 5 trilhas do livro base (atirador_e, infiltrador, medico, negociador,
  tecnico) e `TRAIL_ABILITIES.infiltrador` / `TRAIL_ABILITIES.tecnico` têm os 4 poderes
  (chaves 10/40/65/99) com os nomes oficiais e descrições parafraseadas.

### AC-2: Catálogo de poderes de classe fiel ao livro
- **Dado** `CLASS_POWERS`
- **Quando** o modal "Adicionar Habilidades" lista os poderes da classe
- **Então** o catálogo contém exatamente os poderes oficiais do livro base (18/15/16 por
  classe), com pré-requisito no texto e custo em PE quando houver. Entradas antigas sem
  correspondência oficial saem do catálogo. **Fichas existentes não mudam** — habilidades já
  adicionadas são cópias persistidas na ficha (HabilidadesTab linha ~297), não referências.

### AC-3: Graus de treinamento com nomes oficiais
- **Dado** `TREINO_TIERS`
- **Quando** a ficha exibe o grau de uma perícia
> ⚠ **AC-3 SUBSTITUÍDO pela spec 0033 (AC-16), 2026-08-02.** Este AC adotou "Competente" a partir
> de fonte secundária. Com o PDF oficial em mãos (v1.2), o nome do grau +10 é **Veterano**, e o
> Andre confirmou. O código e os testes seguem a 0033; o texto abaixo fica só como histórico.

- **Então** os rótulos são Destreinado/Treinado/Competente/Expert (o +10 deixa de se chamar
  "Veterano"). Bônus (0/5/10/15) e cores não mudam.

### AC-4: Compêndio de regras OP
- **Dado** `src/data/ordemParanormal/regras-oficiais.json` (novo)
- **Quando** a biblioteca do mestre (BestiaryTab) é aberta
- **Então** existe a aba "Regras" (ao lado de Criaturas/Rituais/Condições/Armas) listando as
  seções: Testes, Ações de Combate, Manobras, Recursos (PE/SAN/morte), Interlúdio e Rituais
  (regras gerais), cada uma com entradas `{ id, secao, nome, descricao }` parafraseadas.
  Condições continuam na aba própria (spec 0021) — sem duplicação.

### AC-5: Cobertura
- Testes em `rules.test.js` (ou novo arquivo) cobrindo AC-1 (trilhas com 4 poderes), AC-2
  (amostras de poderes oficiais presentes; ausência de entradas removidas) e validade
  estrutural do JSON do AC-4. Gate executável verde.

## Casos de borda e erros
- Ficha antiga com habilidade copiada de entrada removida do catálogo → permanece intacta
  (cópia na ficha); apenas não aparece mais para NOVA adição.
- `TRAIL_ABILITIES` de trilha sem um dos marcos → UI já filtra `null` (HabilidadesTab L214).
- Busca no modal por nome antigo removido → lista vazia com estado vazio já existente.

## Fora de escopo
> Vinculante.
- Trilhas de suplementos (Sobrevivendo ao Horror, Arquivos Secretos) — só livro base.
- FullSheet legado do App.jsx (`CLASS_TRAILS`/`TRAIL_ABILITIES` locais, OP_RITUAIS/OP_ARMAS) —
  precedente da spec 0006.
- Aplicação automática de regras/condições (compêndio é referência, como as condições).
- Bestiário oficial de criaturas (licença + volume; decisão própria).
- Poderes Paranormais por elemento (expansão futura já sinalizada na UI).
- DTs finas não verificadas (dano massivo etc.) — entram qualitativas, sem números inventados.

## Rastreabilidade
- Conversa 2026-07-25 (levantamento de lacunas OP → aprovação "FAÇA ISSO").
- Specs relacionadas: 0003 (licença/paráfrase), 0006 (método de verificação + fora-de-escopo
  que esta spec agora fecha), 0021 (condições — padrão de referência não-automática).
- Fontes: ordemparanormal.fandom.com (Classes), ordem-exterminio.fandom.com (nomes de poderes
  de Infiltrador), studocu/pdfcoffee (texto do livro v1.1 — extração dirigida, 2026-07-25).
