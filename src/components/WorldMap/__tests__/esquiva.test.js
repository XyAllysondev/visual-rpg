/**
 * Gate da ESQUIVA DO ENCONTRO (spec 0035 · F3 · M6 · AC-13/14/15).
 *
 * Três invariantes, herdadas do irmão `descoberta.test.js`:
 *
 *  1. **O módulo não rola dado.** O AC-9 da 0028 é literal — o motor é
 *     `src/domain/dice.js` e não há paralelo. Aqui isso vira duas asserções:
 *     o fonte não contém `Math.random`, e o mesmo par (perigo, rolagem)
 *     devolve sempre a mesma saída (AC-15).
 *  2. **A falha não delata.** A saída de uma esquiva falhada tem de ser
 *     idêntica — `toEqual` E `JSON.stringify`, chave a chave — à de um trecho
 *     onde não havia encontro. Qualquer diferença observável vira oráculo:
 *     compara-se duas respostas e sabe-se onde havia bicho.
 *  3. **Sem ficha, nada muda.** Campanha sem ficha compartilhada continua com
 *     o bônus digitado pelo mestre (AC-13). `null` é resposta legítima, não
 *     erro — ADR-0011.
 */
import fs from "fs";
import path from "path";
/* Sem `src/setupTests.js` neste projeto: quem renderiza importa o jest-dom. */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import FilaDeEventos from "../Mesa/FilaDeEventos";
import {
  DT_POR_PERIGO, MENSAGEM_ESCAPOU, MENSAGEM_NAO_ESCAPOU, PERICIA_DA_ESQUIVA,
  PERIGO_MAXIMO_DA_ESQUIVA, bonusDaEsquiva, dtDaEsquiva, furtividadeDaFicha,
  melhorFurtividade, resultadoDaEsquiva,
} from "../model/esquiva";
import { CHANCE_POR_HORA, PERIGO_MAXIMO } from "../model/encontros";

const FONTE = fs.readFileSync(
  path.join(__dirname, "..", "model", "esquiva.js"),
  "utf8",
);

/** Uma ficha compartilhada, no formato que `sharedSheetsRepo.share` grava. */
const fichaCom = (furtividade, extras = {}) => ({
  uid: `u-${furtividade}`,
  userName: `Jogador ${furtividade}`,
  isLive: true,
  character: {
    name: `Personagem ${furtividade}`,
    skillTreino: { [PERICIA_DA_ESQUIVA]: furtividade },
    skillOutros: {},
    ...extras,
  },
});

describe("a tabela de DT", () => {
  it("cobre a MESMA escala de perigo que o sorteio do encontro", () => {
    /* Se as duas escalas divergirem, existe um `dangerLevel` que sorteia
       encontro e não tem DT — ou uma DT que nunca é usada. */
    expect(DT_POR_PERIGO).toHaveLength(CHANCE_POR_HORA.length);
    expect(PERIGO_MAXIMO_DA_ESQUIVA).toBe(PERIGO_MAXIMO);
  });

  it("perigo 0 não tem DT — estrada segura não sorteia encontro", () => {
    expect(DT_POR_PERIGO[0]).toBeNull();
    expect(dtDaEsquiva(0)).toBeNull();
    expect(CHANCE_POR_HORA[0]).toBe(0);
  });

  it("é monótona: mais perigo nunca fica mais fácil de escapar", () => {
    const dts = DT_POR_PERIGO.slice(1);
    dts.forEach((dt, i) => {
      expect(Number.isFinite(dt)).toBe(true);
      if (i > 0) expect(dt).toBeGreaterThan(dts[i - 1]);
    });
  });

  it("perigo fora da escala é grampeado, não recusado", () => {
    /* Molde antigo com `dangerLevel: 9` não pode travar a mesa. */
    expect(dtDaEsquiva(9)).toBe(DT_POR_PERIGO[PERIGO_MAXIMO_DA_ESQUIVA]);
    expect(dtDaEsquiva(3.4)).toBe(DT_POR_PERIGO[3]);
    expect(dtDaEsquiva(-2)).toBeNull();
    expect(dtDaEsquiva(NaN)).toBeNull();
    expect(dtDaEsquiva(undefined)).toBeNull();
  });
});

describe("resultadoDaEsquiva — recebe o resultado, NUNCA rola", () => {
  it("não existe Math.random() no módulo", () => {
    expect(FONTE).not.toMatch(/Math\.random/);
  });

  it("aceita o total cru e o objeto do motor de dados, com o mesmo veredito", () => {
    expect(resultadoDaEsquiva(2, 15).escapou).toBe(true);
    expect(resultadoDaEsquiva(2, { total: 15 }).escapou).toBe(true);
    expect(resultadoDaEsquiva(2, 14).escapou).toBe(false);
    expect(resultadoDaEsquiva(2, { total: 14 }).escapou).toBe(false);
  });

  it("escapar é rolar IGUAL ou acima da DT", () => {
    const dt = DT_POR_PERIGO[3];
    expect(resultadoDaEsquiva(3, dt - 1).escapou).toBe(false);
    expect(resultadoDaEsquiva(3, dt).escapou).toBe(true);
    expect(resultadoDaEsquiva(3, dt + 40).escapou).toBe(true);
  });

  it("o sucesso diz que passou; a falha não admite que havia algo", () => {
    expect(resultadoDaEsquiva(1, 99).mensagem).toBe(MENSAGEM_ESCAPOU);
    expect(resultadoDaEsquiva(1, 0).mensagem).toBe(MENSAGEM_NAO_ESCAPOU);
    /* A frase da falha não pode nomear o que vinha vindo. */
    expect(MENSAGEM_NAO_ESCAPOU).not.toMatch(/encontro|perigo|falh|test|bicho|escap/i);
  });

  it("AC-15 · a mesma entrada devolve a MESMA saída, sempre", () => {
    const entradas = [[0, 10], [1, 12], [3, 18], [5, 25], [4, { total: 22 }]];
    entradas.forEach(([perigo, rolagem]) => {
      const a = resultadoDaEsquiva(perigo, rolagem);
      const b = resultadoDaEsquiva(perigo, rolagem);
      expect(a).toEqual(b);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });

  it("a saída tem SEMPRE as mesmas três chaves — campo que falta é oráculo", () => {
    [[0, 10], [2, 30], [2, 1], [5, null], [null, 20]].forEach(([p, r]) => {
      expect(Object.keys(resultadoDaEsquiva(p, r)).sort())
        .toEqual(["dt", "escapou", "mensagem"]);
    });
  });

  it("a falha numa trilha perigosa é IDÊNTICA à de uma rolagem que não veio", () => {
    /* Esta é a asserção que protege o segredo. Se as duas divergirem em
       qualquer caractere, comparam-se as respostas e sabe-se onde havia algo. */
    const falhouComPerigo = resultadoDaEsquiva(4, 3);
    const rolagemTorta = resultadoDaEsquiva(4, "dezoito");
    expect(rolagemTorta).toEqual(falhouComPerigo);
    expect(JSON.stringify(rolagemTorta)).toBe(JSON.stringify(falhouComPerigo));
    expect(falhouComPerigo.mensagem).toBe(MENSAGEM_NAO_ESCAPOU);
  });
});

describe("o bônus vem da ficha — AC-14", () => {
  it("lê treino + outros, e NÃO soma o atributo", () => {
    /* Em OP o atributo decide quantos d20 saem, não um modificador plano.
       Somá-lo aqui contaria o atributo duas vezes. */
    const ficha = fichaCom(5, {
      skillOutros: { [PERICIA_DA_ESQUIVA]: 2 },
      attrs: { AGI: 4 },
      skillAttr: { [PERICIA_DA_ESQUIVA]: "AGI" },
    });
    expect(furtividadeDaFicha(ficha)).toBe(7);
  });

  it("aceita a ficha crua e o documento compartilhado, com o mesmo número", () => {
    const cru = { skillTreino: { [PERICIA_DA_ESQUIVA]: 10 }, skillOutros: {} };
    expect(furtividadeDaFicha(cru)).toBe(10);
    expect(furtividadeDaFicha({ character: cru })).toBe(10);
  });

  it("AC-14 · com Furtividade +3 e +7 na mesa, o bônus usado é +7", () => {
    const fichas = [fichaCom(3), fichaCom(7)];
    expect(melhorFurtividade(fichas)).toBe(7);
    /* E a ordem da lista não decide nada. */
    expect(melhorFurtividade([...fichas].reverse())).toBe(7);
    expect(bonusDaEsquiva(fichas, 99)).toEqual({ bonus: 7, automatico: true });
  });

  it("bônus negativo continua sendo bônus — o melhor pode ser o menos ruim", () => {
    expect(melhorFurtividade([fichaCom(-2), fichaCom(-5)])).toBe(-2);
  });

  it("destreinado (zero) é um bônus, não uma ausência", () => {
    expect(furtividadeDaFicha(fichaCom(0))).toBe(0);
    expect(melhorFurtividade([fichaCom(0)])).toBe(0);
    expect(bonusDaEsquiva([fichaCom(0)], 4)).toEqual({ bonus: 0, automatico: true });
  });

  it("ficha que não fala da perícia é ignorada, não conta como zero", () => {
    const muda = { uid: "u-x", character: { name: "Sem perícias" } };
    expect(furtividadeDaFicha(muda)).toBeNull();
    expect(melhorFurtividade([muda, fichaCom(2)])).toBe(2);
    expect(melhorFurtividade([muda])).toBeNull();
  });

  it("entrada torta não derruba a mesa", () => {
    [null, undefined, 42, "ficha", []].forEach((x) => {
      expect(furtividadeDaFicha(x)).toBeNull();
    });
    [null, undefined, "lista", {}].forEach((x) => {
      expect(melhorFurtividade(x)).toBeNull();
    });
  });
});

describe("AC-13 — sem ficha compartilhada, o mestre continua digitando", () => {
  it("lista vazia devolve null, e null é o sinal do campo manual", () => {
    expect(melhorFurtividade([])).toBeNull();
    expect(bonusDaEsquiva([], 4)).toEqual({ bonus: 4, automatico: false });
  });

  it("sem ficha e sem número digitado, o bônus é zero e o modo é manual", () => {
    expect(bonusDaEsquiva([], undefined)).toEqual({ bonus: 0, automatico: false });
    expect(bonusDaEsquiva(null, NaN)).toEqual({ bonus: 0, automatico: false });
  });

  it("o número digitado é ignorado assim que existe ficha", () => {
    /* O contrário deixaria o mestre alterar em silêncio o teste do jogador. */
    expect(bonusDaEsquiva([fichaCom(1)], 20)).toEqual({ bonus: 1, automatico: true });
  });
});

describe("AC-13 — o console do mestre, na tela", () => {
  /* O AC-13 fala do CONSOLE, não só da função: "o console do mestre mostra o
     campo de bônus manual, como hoje". Então ele se verifica na tela. */
  it("sem ficha compartilhada, o campo de bônus manual continua lá", () => {
    render(
      <FilaDeEventos
        eventos={[]}
        disparados={[]}
        onDisparar={() => {}}
        onResolverTeste={() => {}}
        bonusDaFicha={melhorFurtividade([])}
      />,
    );
    expect(screen.getByTestId("wmm-bonus-do-teste")).toBeInTheDocument();
    expect(screen.queryByTestId("wmm-bonus-da-ficha")).not.toBeInTheDocument();
  });

  it("com ficha, o número vem dela e o campo manual some", () => {
    /* Campo que não manda em nada é pior do que campo nenhum: o mestre
       digitaria um número e o teste sairia com outro. */
    render(
      <FilaDeEventos
        eventos={[]}
        disparados={[]}
        onDisparar={() => {}}
        onResolverTeste={() => {}}
        bonusDaFicha={melhorFurtividade([fichaCom(3), fichaCom(7)])}
      />,
    );
    expect(screen.queryByTestId("wmm-bonus-do-teste")).not.toBeInTheDocument();
    expect(screen.getByTestId("wmm-bonus-da-ficha")).toHaveTextContent("+7");
    expect(screen.getByTestId("wmm-bonus-da-ficha")).toHaveTextContent(/Furtividade/);
  });
});

describe("a fronteira de dados", () => {
  it("o módulo não importa Firestore nem primitiva do SDK", () => {
    expect(FONTE).not.toMatch(/from\s+["']firebase/);
    ["DocumentReference", "Timestamp", "WriteBatch", "serverTimestamp"].forEach((p) => {
      expect(FONTE).not.toMatch(new RegExp(`\\b${p}\\b`));
    });
  });

  it("não importa a ficha nem a campanha — lê dois campos e mais nada", () => {
    /* O acoplamento do ADR-0012 é com o DADO, não com o agregado. */
    expect(FONTE).not.toMatch(/^import /m);
  });
});
