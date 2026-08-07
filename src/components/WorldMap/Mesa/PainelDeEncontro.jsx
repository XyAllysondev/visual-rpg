/* ════════════════════════════════════════════════════════════════════
 *  A DECISÃO DO MESTRE  (spec 0028 · F6 · AC-8 · briefing §9)
 *  --------------------------------------------------------------------
 *  *"pausa a viagem e notifica o mestre com o resultado rolado; o mestre
 *  decide aceitar, trocar ou ignorar antes de o jogador ver qualquer
 *  coisa."*
 *
 *  ── POR QUE ISTO É UM DIÁLOGO, E NÃO MAIS UM CARTÃO NO CONSOLE ──────
 *  Porque a mesa está PARADA esperando esta decisão. Um cartão a mais num
 *  painel de rolagem é fácil de não ver — e um encontro não visto vira uma
 *  mesa travada sem ninguém entender por quê. O diálogo é a forma honesta
 *  de dizer "isto está te esperando".
 *
 *  ── ESC NÃO DECIDE ──────────────────────────────────────────────────
 *  Fechar não é "ignorar". Esc só tira o diálogo da frente: a pendência
 *  continua em `gm/estado`, a pausa continua, e o console mostra o botão de
 *  reabrir. Fazer Esc equivaler a ignorar transformaria um toque de tecla
 *  num descarte silencioso de conteúdo — e o mestre nunca saberia o que
 *  perdeu, porque ele não chegou a ler.
 *
 *  ── ESTE COMPONENTE NÃO SABE SEGREDO NENHUM ─────────────────────────
 *  Ele recebe texto já pronto (`titulo`, `texto`, `chance`, `rolagem`) e
 *  devolve a decisão. É montado só no cliente do mestre — mas, mesmo que
 *  alguém o montasse noutro lugar, não haveria pendência para lhe passar:
 *  ela vive num documento que o jogador não lê.
 *
 *  ── O RESTYLE DA 0035 (F3 · M5) ─────────────────────────────────────
 *  A casca (portal, armadilha de foco, Esc, clique fora, título em
 *  versalete, filete duplo, botão único) saiu daqui e virou
 *  `CartaoDePergaminho.jsx`, compartilhada com o cartão de descoberta.
 *  **O comportamento não mudou uma vírgula**: os mesmos `data-testid`, as
 *  mesmas decisões, a mesma regra do Esc. O que mudou foi o papel embaixo
 *  — e, com ele, a tinta do conteúdo, que passou a ser escura sobre claro.
 *  Manter `var(--text)` aqui deixaria texto claro sobre pergaminho claro.
 * ══════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { DECISOES } from "./encontrosUi";
import CartaoDePergaminho, { PERGAMINHO } from "./CartaoDePergaminho";
import { FF, FS, FW, HIT, LS, R, SP } from "../Atelier/ui";

const cor = (t) => `rgb(${t[0]},${t[1]},${t[2]})`;
const corA = (t, a) => `rgba(${t[0]},${t[1]},${t[2]},${a})`;

/* ── A tinta do conteúdo sobre o papel ────────────────────────────────
   Nenhuma var de tema aqui, de propósito: as vars foram calibradas para a
   escada grafite do app, e o pergaminho é claro. Um `var(--muted)` viraria
   cinza-claro sobre bege — some. */
const TINTA = {
  corpo: cor(PERGAMINHO.tinta),
  /* A "fraca" não é transparente: é a tinta do corpo, cheia. Rebaixar texto
     com alfa sobre pergaminho custa contraste justamente no que já é pequeno
     — e foi assim que o título reprovou no gate na primeira tentativa. */
  fraca: cor(PERGAMINHO.tinta),
  titulo: cor(PERGAMINHO.titulo),
  filete: corA(PERGAMINHO.filete, 0.55),
  campo: corA(PERGAMINHO.papel, 0.55),
};

/** Vermelho de erro com ≥4,5:1 SOBRE PERGAMINHO — o `DANGER_TEXT_AA` do
 *  ateliê é claro, calibrado para fundo escuro, e aqui sumiria. */
const PERIGO_NO_PAPEL = "#8c1d1d";

const secao = {
  fontFamily: FF.title, fontSize: FS.label, fontWeight: FW.bold,
  letterSpacing: LS.label, textTransform: "uppercase", color: cor(PERGAMINHO.titulo),
};
const meta = { fontFamily: FF.ui, fontSize: FS.meta, lineHeight: 1.5, color: TINTA.fraca };
const corpoSerif = {
  fontFamily: "var(--font-title,'Cinzel',Georgia,serif)",
  fontSize: FS.body, lineHeight: 1.65, color: TINTA.corpo,
};

const campoNoPapel = {
  width: "100%", boxSizing: "border-box",
  minHeight: HIT.mobile, padding: `10px ${SP.x3}px`,
  background: TINTA.campo,
  border: `1px solid ${corA(PERGAMINHO.filete, 0.6)}`,
  borderRadius: R.input, color: TINTA.corpo,
  fontFamily: FF.ui, fontSize: FS.input, outline: "none",
};

/** Botão de decisão, na gramática do selo. `forte` é o "Aceitar". */
const botaoNoPapel = (forte) => ({
  minHeight: HIT.mobile, padding: `0 ${SP.x4}px`, borderRadius: R.ctl, cursor: "pointer",
  background: forte ? corA(PERGAMINHO.filete, 0.42) : corA(PERGAMINHO.filete, 0.14),
  border: `1px solid ${corA(PERGAMINHO.filete, forte ? 0.95 : 0.62)}`,
  color: TINTA.titulo,
  fontFamily: FF.title, fontSize: FS.tag, fontWeight: FW.bold,
  letterSpacing: LS.tag, textTransform: "uppercase",
});

const Linha = ({ rotulo, valor, destaque = false }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ ...secao, fontSize: FS.micro }}>{rotulo}</div>
    <div
      style={{
        fontFamily: FF.data, fontSize: FS.body, fontWeight: FW.semi,
        color: destaque ? TINTA.titulo : TINTA.corpo,
      }}
    >
      {valor}
    </div>
  </div>
);

/**
 * @param {object} props
 * @param {string} props.titulo o que foi sorteado.
 * @param {string} props.texto o que o GRUPO leria se o mestre aceitar.
 * @param {string} props.chance já formatada ("38%").
 * @param {string} props.rolagem já formatada.
 * @param {string} [props.contexto] onde/quando/perigo, em uma linha.
 * @param {string[]} [props.alternativas] outros nomes da tabela, se houver.
 * @param {(decisao:"aceitar"|"trocar"|"ignorar", substituto?:object)=>void} props.onDecidir
 * @param {()=>void} props.onAdiar fecha sem decidir — a pendência fica.
 * @param {boolean} [props.ocupado]
 * @param {string} [props.falha]
 * @param {boolean} [props.anima] encaminha o interruptor de movimento do palco.
 */
export default function PainelDeEncontro({
  titulo,
  texto = "",
  semSugestao = false,
  chance = "—",
  rolagem = "—",
  contexto = "",
  alternativas = [],
  onDecidir,
  onAdiar,
  ocupado = false,
  falha = "",
  anima = true,
}) {
  const [trocando, setTrocando] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoTexto, setNovoTexto] = useState("");

  const decidir = (valor) => {
    if (!onDecidir || ocupado) return;
    if (valor !== "trocar") { onDecidir(valor); return; }
    const t = novoTitulo.trim();
    const p = novoTexto.trim();
    if (!p) return;                       // sem texto do jogador não há o que publicar
    onDecidir("trocar", { title: t || "Encontro na estrada", playerText: p });
  };

  return (
    <CartaoDePergaminho
      testId="wmm-encontro-do-mestre"
      testIdDoBotao="wmm-encontro-adiar"
      chapeu="Só você está vendo isto"
      titulo="Um encontro na estrada"
      rotuloAcessivel="Um encontro na estrada"
      descritoPor="wmm-enc-desc"
      corpo={contexto || null}
      rotuloDoBotao="Decidir depois"
      /* Esc, clique fora e o botão caem todos aqui: ADIAR, nunca "ignorar". */
      onFechar={onAdiar}
      ocupado={ocupado}
      anima={anima}
    >
      {/* ── A CONTA, ABERTA ────────────────────────────────────────
          O mestre decide melhor sabendo de onde a rolagem veio. Esconder
          a chance faria a decisão dele virar palpite sobre o próprio jogo. */}
      <div
        data-testid="wmm-encontro-rolagem"
        style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.x3,
          padding: SP.x3, borderRadius: R.ctl,
          background: TINTA.campo, border: `1px solid ${TINTA.filete}`,
        }}
      >
        <Linha rotulo="Chance" valor={chance} />
        <Linha rotulo="Rolou" valor={rolagem} destaque />
      </div>

      {/* ── O QUE SAIU ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
        <div style={secao}>O que saiu</div>
        <div
          data-testid="wmm-encontro-sugestao"
          style={{
            padding: SP.x3, borderRadius: R.ctl,
            border: `1px solid ${TINTA.filete}`, background: TINTA.campo,
          }}
        >
          <div style={{ ...corpoSerif, fontWeight: FW.semi }}>{titulo}</div>
          <p id="wmm-enc-desc" style={{ ...corpoSerif, margin: `${SP.x2}px 0 0` }}>
            {texto || "Sem texto do jogador — o grupo veria um cartão vazio."}
          </p>
        </div>
        <p style={{ ...meta, margin: 0 }}>
          O grupo ainda não viu nada disto. A viagem está parada até você decidir.
        </p>
      </div>

      {/* A TROCA. O comentário fica ACIMA do ternário: em posição de
          expressão as chaves são objeto literal, e o build quebra. */}
      {trocando ? (
        <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
          <div style={secao}>No lugar dele, acontece</div>
          {alternativas.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: SP.x2 }}>
              {alternativas.map((nome) => (
                <button
                  key={nome}
                  type="button"
                  className="wmm-selo"
                  onClick={() => setNovoTitulo(nome)}
                  style={{ ...botaoNoPapel(false), minHeight: 34, textTransform: "none" }}
                >
                  {nome}
                </button>
              ))}
            </div>
          ) : null}
          <input
            type="text"
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            placeholder="Título do que acontece"
            aria-label="Título do encontro que substitui o sorteado"
            data-testid="wmm-encontro-titulo"
            className="wmm-selo"
            style={{ ...campoNoPapel, fontSize: FS.body }}
          />
          <textarea
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            rows={3}
            placeholder="O que o grupo lê"
            aria-label="O texto que o grupo vai ler"
            data-testid="wmm-encontro-texto"
            className="wmm-selo"
            style={{ ...campoNoPapel, fontSize: FS.body, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: SP.x2, flexWrap: "wrap" }}>
            <button
              type="button"
              className="wmm-selo"
              data-testid="wmm-encontro-confirmar-troca"
              disabled={ocupado || !novoTexto.trim()}
              onClick={() => decidir("trocar")}
              style={botaoNoPapel(true)}
            >
              Trocar por este
            </button>
            <button
              type="button"
              className="wmm-selo"
              disabled={ocupado}
              onClick={() => setTrocando(false)}
              style={botaoNoPapel(false)}
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
          <div style={{ display: "flex", gap: SP.x2, flexWrap: "wrap" }}>
            {DECISOES.map((d) => (
              <button
                key={d.valor}
                type="button"
                className="wmm-selo"
                data-testid={`wmm-encontro-${d.valor}`}
                /* Sem sugestão não há o que aceitar. O botão fica ali,
                   desabilitado e explicado — sumir com ele faria o mestre
                   achar que a interface está quebrada. */
                disabled={ocupado || (d.valor === "aceitar" && semSugestao)}
                title={d.dica}
                onClick={() => (d.valor === "trocar" ? setTrocando(true) : decidir(d.valor))}
                style={{ ...botaoNoPapel(d.valor === "aceitar"), flex: "1 1 120px" }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: SP.x1 }}>
            {DECISOES.map((d) => (
              <li key={d.valor} style={{ ...meta, fontSize: FS.micro }}>
                <strong style={{ color: TINTA.titulo }}>{d.label}</strong> —{" "}
                {d.valor === "aceitar" && semSugestao
                  ? "não há sugestão para aceitar desta vez."
                  : d.dica}
              </li>
            ))}
          </ul>
        </div>
      )}

      {falha ? (
        <p role="alert" data-testid="wmm-encontro-falha" style={{ ...meta, margin: 0, color: PERIGO_NO_PAPEL }}>
          {falha}
        </p>
      ) : null}
    </CartaoDePergaminho>
  );
}
