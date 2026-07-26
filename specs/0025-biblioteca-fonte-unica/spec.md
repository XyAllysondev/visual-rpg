---
name: spec-0025-biblioteca-fonte-unica
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Biblioteca do mestre com fonte única (rituais/armas oficiais)

> **Fonte da verdade.** Status: aprovado (Andre, 2026-07-25 — "FAÇA ISSO" sobre a auditoria de
> lacunas pós-0024, item 2). Problema: o BestiaryTab usa datasets INLINE legados (`OP_RITUAIS`
> ~100 entradas, `OP_ARMAS` 29) divergentes dos JSONs oficiais que a ficha usa — mestre e
> jogador veem números diferentes para o mesmo conteúdo (ex.: Katana 1d8 vs 1d10 crít. 18).

## Critérios de aceite

### AC-1: Aba Rituais consome rituais-oficiais.json
- **Dado** a aba Rituais da biblioteca do mestre
- **Quando** renderiza/filtra (busca, elemento, círculo)
- **Então** a lista vem de `src/data/ordemParanormal/rituais-oficiais.json` (85 rituais, mesmos
  da ficha); o custo em PE exibido deriva do círculo (1º=1 · 2º=3 · 3º=6 · 4º=10 PE) e a
  `descricao` (HTML curado próprio) renderiza como na ficha (RituaisTab, dangerouslySetInnerHTML).

### AC-2: Aba Armas consome itens-oficiais.json
- **Dado** a aba Armas
- **Quando** renderiza/filtra por proficiência
- **Então** a lista vem dos itens `tipo === "arma"` do JSON oficial (28), agrupados por
  proficiência (Armas Táticas / Armas de Fogo / Armas Pesadas), exibindo dano, crítico
  (margem/multiplicador), tipo de dano, alcance, categoria e espaços. Botão de rolagem mantido.

### AC-3: Datasets legados removidos
- **Dado** `App.jsx`
- **Quando** a feature conclui
- **Então** `OP_RITUAIS` e `OP_ARMAS` não existem mais (zero referências) — fonte única.

### AC-4: Cobertura
- Teste estrutural garantindo os campos que a biblioteca consome nos dois JSONs
  (rituais: id/nome/elemento válido/círculo 1-4/descricao; armas: dano/critico/multiplicador/
  tipo_dano/proficiencia válida). Gate executável verde.

## Casos de borda
- Rituais de Medo: continuam listados (filtro Medo) — são referência do mestre.
- `resistencia: "—"` ou vazia → linha RESISTÊNCIA omitida (comportamento atual preservado).
- Filtro de proficiência antigo ('Simples/Tática/Pesada') migra para os valores oficiais.

## Fora de escopo
> Vinculante. Itens 1/3/4 da auditoria (poderes paranormais por elemento, expansão de
> equipamentos gerais/modificações, origem Servidor Público) — BLOQUEADOS por fonte verificável
> (livro cap. 3+; ver rastreabilidade). Proteções/munições/amaldiçoados na biblioteca (a aba é
> de armas; ampliar é decisão futura). Bestiário de criaturas oficial.

## Rastreabilidade
- Auditoria de lacunas 2026-07-25 (conversa; itens 1/3/4 bloqueados: fontes do livro disponíveis
  cortam no cap. 2 — pdfcoffee/anyflip; wikis só têm homebrew. Desbloqueio: PDF do livro do Andre).
- Specs relacionadas: 0024 (conteúdo OP), 0006 (fidelidade), 0003 (licença).
