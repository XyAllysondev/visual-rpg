---
name: spec-0026-conteudo-livro-v14
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Conteúdo do livro v1.4: poderes paranormais, equipamento geral, modificações e Servidor Público

> **Fonte da verdade.** Status: aprovado (Andre, 2026-07-25 — forneceu o PDF oficial
> "Ordem Paranormal 1.4 (2).pdf" na área de trabalho para desbloquear os itens 1/3/4 da
> auditoria; spec 0025 os registrava como bloqueados por fonte).
> **Fonte primária:** livro v1.4 (330 pg., camada de texto extraída). Todo texto do produto é
> PARAFRASEADO (licença — spec 0003). O PDF NÃO entra no repositório.

## Verificação de fontes (2026-07-25 — livro v1.4, páginas)

| Conteúdo | Página (v1.4) |
|---|---|
| Poderes Paranormais: 2 gerais (Aprender Ritual, Resistir a Elemento) + 5 por elemento ×4 = 22 | 122–124 |
| Afinidade elemental (NEX 50%): benefícios e linha "Afinidade" dos poderes | 122 |
| Equipamento geral: 3 acessórios + 5 explosivos + 16 operacionais (tabela 3.8) | 63–66 |
| Modificações: armas (tab. 3.5), proteções (3.7), acessórios (3.9); regra +I categoria | 60–64 |
| Origem Servidor Público: Intuição e Vontade; Espírito Cívico (ajudar, 1 PE → bônus +2) | 20–21 |

## Critérios de aceite

### AC-1: Poderes Paranormais no modal de habilidades
- **Dado** `src/data/ordemParanormal/poderes-paranormais.json` (novo, 22 poderes:
  `{id, elemento: geral|conhecimento|energia|morte|sangue, nome, prereq, descricao, afinidade}`)
- **Quando** a categoria "Poderes Paranormais" do modal Adicionar Habilidades é aberta
- **Então** o placeholder dá lugar a chips por elemento (Gerais/Conhecimento/Energia/Morte/
  Sangue) listando os poderes com pré-requisito e efeito (+ linha Afinidade), adicionáveis à
  ficha como cópia (mesmo fluxo AbilityRow/onAdd dos poderes de classe).

### AC-2: Equipamento geral do livro
- **Dado** `itens-oficiais.json`
- **Quando** a feature conclui
- **Então** contém os itens da tabela 3.8 que faltavam (21 novos: 3 acessórios, 4 explosivos,
  14 operacionais — granada de fumaça, máscara de gás e traje hazmat JÁ existiam sob
  municao/protecao; corda, lanterna e soqueira idem), `tipo:"geral"`, com categoria (0/I) e
  espaços do livro, descrição parafraseada. Itens curados existentes são mantidos (38 gerais).

### AC-3: Catálogo de modificações
- **Dado** `src/data/ordemParanormal/modificacoes-oficiais.json` (novo, 23:
  `{id, aplica: armas|armas_fogo|municao|protecao|acessorio, nome, efeito}`)
- **Quando** a aba Armas da biblioteca renderiza
- **Então** exibe ao final a seção "Modificações" agrupada por aplicação, com a regra geral
  (cada modificação aumenta a categoria do item em I; iguais não acumulam).

### AC-4: Origem Servidor Público
- **Dado** `ORIGENS` (App.jsx)
- **Quando** a criação de personagem lista origens
- **Então** inclui Servidor Público (Intuição e Vontade; Espírito Cívico: ao fazer teste para
  ajudar, pode gastar 1 PE para aumentar o bônus concedido em +2) — 25 origens no total.

### AC-5: Cobertura
- Testes estruturais dos dois JSONs novos (contagens, elementos/aplicações válidos, campos) e
  da expansão de gerais. Gate executável verde.

## Casos de borda
- Poder com pré-requisito de elemento (ex.: "Morte 2") → exibido como texto; o app não valida
  (mesmo padrão dos poderes de classe — referência, não enforcement).
- Categoria "0" nos itens novos (livro usa 0 para itens livres) → string "0", exibida como as
  demais; limites por patente já tratam cat. 0 como ilimitada (PATENTES[x].limiteItens[0]=null).
- "Soqueira" já existe como arma → não duplicada em gerais.

## Fora de escopo
> Vinculante. Itens amaldiçoados adicionais do v1.4 (curadoria própria já existe; volume);
> munições da tabela 3.4 (JSON já tem 13); enforcement de pré-requisitos; UI de aplicar
> modificação a item do inventário (arsenal 0020 já tem campo livre `melhorias`); demais
> diferenças v1.1→v1.4 (auditoria futura).

## Rastreabilidade
- Livro oficial v1.4 (PDF do Andre, fora do repo). Auditoria de lacunas 2026-07-25.
- Specs: 0024 (conteúdo OP), 0025 (fonte única — desbloqueio registrado), 0003 (licença).
