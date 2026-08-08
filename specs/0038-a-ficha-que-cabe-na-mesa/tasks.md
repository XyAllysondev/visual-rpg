---
name: tasks-0038-a-ficha-que-cabe-na-mesa
description: Tasks da spec 0038. Puxe junto com a spec 0038 ao mexer em visibilidade de perícia, regras opcionais ou no fecho do criador de personagem.
alwaysApply: false
---

# Tasks — Spec 0038 (A ficha que cabe na mesa)

**Gate executável:**
```
npm test -- --runInBand
CI=true npm run build
```
Partida: 110 suítes / 2.573 testes (fim da spec 0037).
Chegada: **111 suítes / 2.598 testes**, build limpo.

Suíte desta spec: `src/components/systems/OrdemParanormal/__tests__/cabe-na-mesa.test.js`

---

## T1 · `assinaturaDe` no domínio — `domain/character.js` ✔
Pura, sem React. Primeiro nome inteiro + iniciais dos sobrenomes; partículas de ligação
(`de/da/do/dos/das/e/del/von/van`) **não** viram inicial. Nome vazio → `""`, que o chamador lê como
"não há o que assinar".
Mora em `domain/` e não em `OrdemParanormal/rules.js` porque o consumidor é o
`features/ficha/CharacterCreator` — feature não deve importar regra de um sistema.
**AC:** 9.

## T2 · Estado e persistência na ficha ✔
`periciasOcultas: string[]` (guarda o `base` da perícia, **nunca o índice** — a ordem de `PERICIAS`
pode mudar) e `regrasOpcionais: {semSanidade?: boolean}`. Ambos entram no `snapshot` e na lista de
dependências do autosave. Aditivos; Firestore é schemaless.
**AC:** 1, 6.

## T3 · Ocultar / reexibir perícia ✔
- 8ª coluna no grid **só em Modo de Edição**, via `.op-col-panel[data-edit="true"]` nas três faixas
  (base, ≤768, ≤480). Em Modo de Jogo a coluna não é reservada, senão a tabela mudaria de largura
  ao destravar.
- `renderSkillRowOculta` para a linha oculta (apagada, com o caminho de volta).
- Faixa "N perícias ocultas · mostrar" no rodapé da coluna, **visível nos dois modos**.
- Filtro de texto fura o oculto: procurar pelo nome acha, marcado.
**AC:** 1, 2, 3, 4.

## T4 · Jogando sem Sanidade ✔
`breach` passou a nascer `!semSanidade && sanPct < 0.3` — **desarma na raiz**. Os cinco efeitos
(classe `op-breach`, camada `op-outrolado`, glifos, selo SURTO, botão de sussurro) já dependiam de
`breach`, então nenhum ponto de uso precisou saber da regra. O `VitalSign` de SAN sai da tela; o
valor **não** é zerado nem recalculado.
> Cinco `&&` espalhados é como se esquece o sexto. Não mova esta checagem para os pontos de uso.
**AC:** 5, 6.

## T5 · O interruptor no painel de Configurações ✔
Reusa o padrão DESLIGADO/LIGADO que o ajuste de Arte com IA já usa (rótulos `USANDO`/`SEM`).
**⚠ SÓ ESTA REGRA ENTRA.** O comentário no código explica por que Munição, NEX & Experiência e
Evolução por Patente ficaram fora, e o AC-7 tem teste que **reprova** se alguém as adicionar sem a
spec que as implemente.
**AC:** 7.

## T6 · A assinatura no fecho da criação ✔
O botão "Finalizar Ficha" do topo do passo foi **removido** — dois caminhos para a mesma ação é
convite a manter só o feio. O fecho é uma linha de assinatura em cursiva ao fim do passo, com a
assinatura derivada do nome; sem nome, não há o que acionar.
**AC:** 8.

## T7 · Gate + STATE ✔

---

## Ordem executada
T1 → T2 → T4 → T3 → T5 → T6 → T7.
T4 antes de T3 porque `breach` é uma linha e libera a verificação dos cinco efeitos cedo; T3 é o
que mexe no grid em três faixas de CSS.
