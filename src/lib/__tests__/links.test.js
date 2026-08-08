/**
 * Gate dos ENDEREÇOS EXTERNOS e do RODAPÉ (spec 0036 · AC-1, AC-2).
 *
 * ── POR QUE ESTA SUÍTE EXISTE ───────────────────────────────────────────
 * O convite do Discord (`discord.gg/nexusrpg`) morreu e o produto continuou
 * convidando gente para uma porta fechada em três telas ao mesmo tempo,
 * durante meses. Duas coisas falharam, e cada uma vira um teste aqui:
 *
 *  1. **O endereço estava duplicado.** Não havia um lugar para olhar, então o
 *     conserto nunca aconteceu. → `AC-2`: literal só em `lib/links.js`.
 *  2. **Nada avisou.** O convite expirou em silêncio. → o teste do prazo
 *     abaixo falha uma semana ANTES da data, para o alarme tocar num build
 *     vermelho e não na cara de um visitante.
 *
 * E o rodapé tinha três `<span>` com cursor de mão que não faziam nada. →
 * `AC-1`: aparência clicável exige destino real.
 *
 * ⚠️ Este projeto NÃO tem `src/setupTests.js`: cada suíte de render importa o
 * `@testing-library/jest-dom` por conta própria.
 */
import fs from "fs";
import path from "path";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import AppFooter from "../../ui/AppFooter";
import {
  ALVO_EXTERNO, DISCORD_EXPIRA_EM, DISCORD_URL, EMAIL_SUPORTE, MAILTO_SUPORTE,
} from "../links";

const RAIZ_SRC = path.join(__dirname, "..", "..");

/** Todo arquivo de código de `src/`, menos os testes. */
function fontes(dir = RAIZ_SRC, saida = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const alvo = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === "__tests__" || item.name === "node_modules") continue;
      fontes(alvo, saida);
    } else if (/\.(js|jsx)$/.test(item.name)) {
      saida.push(alvo);
    }
  }
  return saida;
}

const relativo = (p) => path.relative(RAIZ_SRC, p).replace(/\\/g, "/");

/* A regra é sobre CÓDIGO, não sobre prosa: o cabeçalho do `AppFooter` explica
   por que o Suporte é um `mailto:`, e citar a regra não pode violá-la. Mesma
   disciplina do gate de `Math.random` na spec 0035. */
const semComentarios = (texto) => texto
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Os fontes que casam com o padrão, fora do arquivo que tem direito a ele. */
function infratores(padrao) {
  return fontes()
    .filter((f) => relativo(f) !== "lib/links.js")
    .filter((f) => padrao.test(semComentarios(fs.readFileSync(f, "utf8"))))
    .map(relativo);
}

describe("AC-2 — um endereço externo, um lugar", () => {
  it("nenhum componente tem o convite do Discord literal", () => {
    /* A regressão que este teste impede é exata: alguém cola o convite direto
       no JSX porque "é só um link", e na próxima expiração são duas mortes em
       vez de uma. */
    expect(infratores(/discord\.(gg|com\/invite)/)).toEqual([]);
  });

  it("nenhum componente tem um mailto literal", () => {
    expect(infratores(/mailto:/)).toEqual([]);
  });

  it("as constantes são endereços utilizáveis, não rascunho", () => {
    expect(DISCORD_URL).toMatch(/^https:\/\/discord\.(gg|com\/invite)\/[\w-]+$/);
    /* O convite antigo, morto na API do Discord, não pode voltar. */
    expect(DISCORD_URL).not.toMatch(/nexusrpg$/);
    expect(EMAIL_SUPORTE).toMatch(/^[^@\s]+@playnexusrpg\.com$/);
    expect(MAILTO_SUPORTE.startsWith(`mailto:${EMAIL_SUPORTE}`)).toBe(true);
    expect(ALVO_EXTERNO).toEqual({ target: "_blank", rel: "noopener noreferrer" });
  });

  it("o convite do Discord ainda não expirou — o alarme que faltou", () => {
    /* `DISCORD_EXPIRA_EM` vem do `expires_at` que a API do Discord devolve.
       Este teste fica VERMELHO uma semana antes, para dar tempo de trocar o
       convite antes de ele morrer para o usuário. Com um convite permanente,
       ponha `null` e o alarme se desliga sozinho. */
    if (DISCORD_EXPIRA_EM === null) return;

    const expira = Date.parse(`${DISCORD_EXPIRA_EM}T00:00:00Z`);
    expect(Number.isFinite(expira)).toBe(true);

    const diasQueRestam = Math.floor((expira - Date.now()) / 86400000);
    if (diasQueRestam <= 7) {
      throw new Error(
        `O convite do Discord expira em ${DISCORD_EXPIRA_EM} — faltam ${diasQueRestam} dias.\n`
        + "No Discord: Convidar pessoas → Editar link de convite → Expira após: Nunca · "
        + "Usos: Sem limite → Gerar novo link.\n"
        + "Depois troque DISCORD_URL em src/lib/links.js e ponha DISCORD_EXPIRA_EM = null.",
      );
    }
    expect(diasQueRestam).toBeGreaterThan(7);
  });
});

describe("AC-1 — nenhum controle morto no rodapé", () => {
  it("todo item com cara de clicável tem destino real", () => {
    render(<AppFooter system={{ id: "dnd" }} onIrParaRoadmap={() => {}} />);

    const suporte = screen.getByText(/Suporte/i).closest("a");
    expect(suporte).toHaveAttribute("href", MAILTO_SUPORTE);

    const discord = screen.getByText(/Discord/i).closest("a");
    expect(discord).toHaveAttribute("href", DISCORD_URL);
    expect(discord).toHaveAttribute("target", "_blank");
    /* `noopener` fecha o acesso da aba nova ao `window` desta — sem ele, um
       destino comprometido consegue reescrever a página de origem. */
    expect(discord).toHaveAttribute("rel", "noopener noreferrer");

    const changelog = screen.getByText(/Changelog/i).closest("button");
    expect(changelog).toBeInTheDocument();
    expect(changelog).toHaveAttribute("type", "button");
  });

  it("o Changelog leva ao Roadmap — que É a página de 'o que mudou'", () => {
    const ir = jest.fn();
    render(<AppFooter system={null} onIrParaRoadmap={ir} />);
    fireEvent.click(screen.getByText(/Changelog/i).closest("button"));
    expect(ir).toHaveBeenCalledTimes(1);
  });

  it("sem destino, o item NÃO é renderizado — apagar é melhor que fingir", () => {
    /* Esta é a regra da spec inteira em uma asserção. Se um dia alguém tirar o
       callback e o item continuar na tela, volta o botão morto. */
    render(<AppFooter system={null} />);
    expect(screen.queryByText(/Changelog/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Suporte/i)).toBeInTheDocument();
  });

  it("nenhum <span> clicável sobrou no rodapé", () => {
    const { container } = render(<AppFooter system={null} onIrParaRoadmap={() => {}} />);
    const falsos = Array.from(container.querySelectorAll("span"))
      .filter((s) => s.style.cursor === "pointer");
    expect(falsos).toHaveLength(0);
  });
});
