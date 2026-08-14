---
name: adr-0011-dividas-do-adr-0010-quitadas
description: ADR — as três dívidas aceitas no ADR-0010 foram quitadas; a fronteira de dados agora é total. Puxe ao ler o ADR-0010 ou ao mexer em datas vindas do Firestore.
alwaysApply: false
---

# ADR-0011: As dívidas do ADR-0010 foram quitadas

- **Status:** aceito
- **Data:** 2026-08-02
- **Decisores:** Andre (Andrey Lucas de Andrade Nonardo)
- **Relação:** complementa o [ADR-0010](./0010-camada-de-infraestrutura.md); **não o substitui** — a
  decisão dele continua válida. Este registra que suas três dívidas foram pagas.

## Contexto

O ADR-0010 criou a camada de repositórios e aceitou **conscientemente** três dívidas, porque a
spec 0029 era refatoração a comportamento constante:

1. `Timestamp` do SDK continuava atravessando a fronteira na leitura.
2. Sete stores de feature seguiam importando `firebase/firestore` direto.
3. As falhas silenciosas herdadas foram preservadas, não consertadas.

Registrar dívida é honesto; deixá-la sem prazo é como ela apodrece. As specs 0030, 0031 e 0032
as liquidaram.

## Decisão

Consideramos as três encerradas, com estas regras passando a valer sem exceção:

**1. Nenhum arquivo fora de `src/infrastructure/` fala com o Firestore.** A lista de exceção do
`no-restricted-imports` foi de 7 arquivos a **zero** — restam apenas `src/infrastructure/**`,
`src/firebase.js` e os testes. Os 7 stores (3.740 linhas, 264 chamadas ao SDK) passaram a
consumir `worldMapsRepo`, `mesaRepo`, `fogRepo`, `worldsRepo`, `assetsRepo` e `mapSyncRepo`.

**2. Data que sai de repositório é epoch-ms numérico.** `paraEpochMs`/`comDatasEmMs`
(`client.js`) normalizam na saída. "Sem data" é **`null`** — não `0` (jogaria a mensagem para
1970 e ela sumiria pelo corte de TTL) nem `Date.now()` (inventaria uma data que o repositório
não tem, apagando a informação "ainda não carimbada" da escrita otimista).

**3. A fronteira garante TIPO, mas nunca inventa PRESENÇA.** É a regra mais importante deste
ADR, e a menos óbvia. Campo com tipo errado é coagido; campo **ausente continua ausente**.
Motivo concreto: `CampaignCard` renderiza o selo do sistema com `{campaign.system && …}` —
preencher `system: "Genérico"` faria surgir um selo em campanha que nunca escolheu sistema.
Dado inventado é indistinguível do real três telas depois.
A única rejeição é documento cujo corpo não é objeto: `{id, ...undefined}` produzia um registro
"válido e vazio" na tela.

**4. As falhas silenciosas foram resolvidas onde mudavam o resultado, não em bloco.** Quatro
comportamentos viraram, cada um com teste que falha no antigo e passa no novo (spec 0032):
contagem de campanhas assimétrica, feed de rolagens sem ordenação, criatura com 0 PV lida como
PV cheio, e a perda silenciosa do autosave do mapa.

### Alternativas descartadas

| Alternativa | Por quê não |
|---|---|
| Adotar zod/yup para a validação | Dependência nova é decisão própria, com ADR próprio. A validação atual é JavaScript puro no estilo de `src/domain/`, e cabe em um arquivo |
| Rejeitar documento incompleto | Há dados legados reais em produção (campanha sem `isActive`, ficha sem `id`, PV como string livre). O usuário perderia acesso ao próprio conteúdo — pior que o problema |
| Preencher campo ausente com padrão | Inventa dado. Ver a regra 3 |
| Normalizar `Timestamp` na UI | Manteria a borda conhecendo o formato do banco, que é justamente o acoplamento que o ADR-0010 existe para cortar |
| Converter `hpMax`/`hpCurrent` para número na fronteira | `"18 (2d8+4)"` é dado válido digitado pelo mestre; coagir apagaria a nota de rolagem dele. A régua fica em `domain/creature.js`, que é total sobre string livre |

## Consequências

- **+** A troca de backend passa a ser um trabalho localizado: nenhuma tela sabe o que é
  `Timestamp`, `DocumentReference` ou caminho de coleção.
- **+** Dado torto aparece com endereço na origem (`[<repo>.saida] "c1".members veio como null…`),
  em vez de quebrar três telas adiante.
- **+** Documento íntegro sai pela **mesma referência**, sem alocação nem log — o chat entrega
  50 mensagens por snapshot e não paga por isso.
- **−** **Dívida nova, pequena e datada:** `worldMapsRepo.observarPerfil` e
  `mapSyncRepo.getCampaignDoc` leem documentos de agregados alheios (`users`, `campaigns`) e
  ainda passam data crua. Nenhum consumidor lê essas datas hoje. Devem ser encaminhados aos
  repositórios donos.
- **−** `watchRolls` passou a exigir **índice composto** (`messages`: `type` ASC + `timestamp`
  DESC). O índice está em `firestore.indexes.json` e **precisa estar no ar antes do código** —
  senão o feed de rolagens fica vazio.
- **−** A validação cobre 5 agregados, não 13. Foi decisão: os do mapa-múndi já validam na
  escrita (`criarNo`/`criarTrilha`) e não têm corpus legado; uma segunda régua mais fraca na
  leitura só criaria divergência.

## Relacionados

- [ADR-0010](./0010-camada-de-infraestrutura.md) — a decisão que criou a camada
- Specs: [0030](../../../specs/0030-onda-1-5-stores-legados/spec.md) ·
  [0031](../../../specs/0031-onda-2-split-app-jsx/spec.md) ·
  [0032](../../../specs/0032-onda-3-fronteiras-e-quirks/spec.md)
