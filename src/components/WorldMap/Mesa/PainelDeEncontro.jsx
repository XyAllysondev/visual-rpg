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
 * ══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DECISOES } from "./encontrosUi";
import {
  DANGER_TEXT_AA, ELEV, FF, FS, FW, HIT, LINE, R, SP, SURF, T, btnStyle, campoStyle,
} from "../Atelier/ui";

/** Tudo que pode receber foco dentro do diálogo, na ordem do documento. */
const FOCAVEIS = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),'
  + 'select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

const Linha = ({ rotulo, valor, destaque = false }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ ...T.section, fontSize: FS.micro }}>{rotulo}</div>
    <div
      style={{
        fontFamily: FF.data, fontSize: FS.body, fontWeight: FW.semi,
        color: destaque ? "var(--gold2,var(--gold))" : "var(--text)",
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
}) {
  const [trocando, setTrocando] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoTexto, setNovoTexto] = useState("");

  const caixaRef = useRef(null);
  const gatilhoRef = useRef(null);

  /* O foco entra na CAIXA, não num botão: o leitor de tela lê o título e o
     resultado antes de qualquer ação, e um Enter distraído não solta um
     encontro na mesa sem o mestre ter lido o que ele é. */
  useEffect(() => {
    gatilhoRef.current = typeof document !== "undefined" ? document.activeElement : null;
    const t = setTimeout(() => { if (caixaRef.current) caixaRef.current.focus(); }, 30);
    return () => {
      clearTimeout(t);
      const el = gatilhoRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, []);

  const adiar = useCallback(() => { if (!ocupado && onAdiar) onAdiar(); }, [ocupado, onAdiar]);

  /* Esc fecha; Tab fica preso. O laço do Tab é feito à mão porque o projeto
     não tem (e não vai ganhar) dependência de foco — ADR-0004. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); adiar(); return; }
      if (e.key !== "Tab") return;
      const caixa = caixaRef.current;
      if (!caixa) return;
      const alvos = Array.from(caixa.querySelectorAll(FOCAVEIS));
      if (alvos.length === 0) { e.preventDefault(); caixa.focus(); return; }
      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];
      const atual = document.activeElement;
      if (!caixa.contains(atual)) { e.preventDefault(); primeiro.focus(); return; }
      if (e.shiftKey && atual === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && atual === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [adiar]);

  const decidir = (valor) => {
    if (!onDecidir || ocupado) return;
    if (valor !== "trocar") { onDecidir(valor); return; }
    const t = novoTitulo.trim();
    const p = novoTexto.trim();
    if (!p) return;                       // sem texto do jogador não há o que publicar
    onDecidir("trocar", { title: t || "Encontro na estrada", playerText: p });
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) adiar(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 430, padding: SP.x4,
        background: "rgba(8,8,14,0.84)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wmm-enc-tit"
        aria-describedby="wmm-enc-desc"
        data-testid="wmm-encontro-do-mestre"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(520px,100%)", maxHeight: "88vh", overflowY: "auto",
          background: SURF.raised, border: `1px solid ${LINE.gold}`,
          borderRadius: R.panel, boxShadow: ELEV.e3, padding: SP.x5,
          display: "flex", flexDirection: "column", gap: SP.x4, outline: "none",
        }}
      >
        <div>
          <div style={{ ...T.section, fontSize: FS.micro }}>
            Só você está vendo isto
          </div>
          <h2
            id="wmm-enc-tit"
            style={{
              ...T.hero, fontSize: FS.h3, margin: `${SP.x1}px 0 0`,
              color: "var(--gold2,var(--gold))",
            }}
          >
            Um encontro na estrada
          </h2>
          {contexto ? (
            <div style={{ ...T.data, fontSize: FS.micro, marginTop: SP.x1 }}>{contexto}</div>
          ) : null}
        </div>

        {/* ── A CONTA, ABERTA ────────────────────────────────────────
            O mestre decide melhor sabendo de onde a rolagem veio. Esconder
            a chance faria a decisão dele virar palpite sobre o próprio jogo. */}
        <div
          data-testid="wmm-encontro-rolagem"
          style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.x3,
            padding: SP.x3, borderRadius: R.ctl,
            background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE.hair}`,
          }}
        >
          <Linha rotulo="Chance" valor={chance} />
          <Linha rotulo="Rolou" valor={rolagem} destaque />
        </div>

        {/* ── O QUE SAIU ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
          <div style={T.section}>O que saiu</div>
          <div
            data-testid="wmm-encontro-sugestao"
            style={{
              padding: SP.x3, borderRadius: R.ctl,
              border: `1px solid ${LINE.hair}`, background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ ...T.body, fontWeight: FW.semi }}>{titulo}</div>
            <p id="wmm-enc-desc" style={{ ...T.meta, margin: `${SP.x2}px 0 0`, color: "var(--text)" }}>
              {texto || "Sem texto do jogador — o grupo veria um cartão vazio."}
            </p>
          </div>
          <p style={{ ...T.meta, margin: 0 }}>
            O grupo ainda não viu nada disto. A viagem está parada até você decidir.
          </p>
        </div>

        {/* ── A TROCA ────────────────────────────────────────────────── */}
        {trocando ? (
          <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
            <div style={T.section}>No lugar dele, acontece</div>
            {alternativas.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: SP.x2 }}>
                {alternativas.map((nome) => (
                  <button
                    key={nome}
                    type="button"
                    className="wmm-acao"
                    onClick={() => setNovoTitulo(nome)}
                    style={{ ...btnStyle("quiet", "sm"), textTransform: "none" }}
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
              className="wmm-focus"
              style={{ ...campoStyle(false), fontSize: FS.body }}
            />
            <textarea
              value={novoTexto}
              onChange={(e) => setNovoTexto(e.target.value)}
              rows={3}
              placeholder="O que o grupo lê"
              aria-label="O texto que o grupo vai ler"
              data-testid="wmm-encontro-texto"
              className="wmm-focus"
              style={{ ...campoStyle(false), fontSize: FS.body, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: SP.x2, flexWrap: "wrap" }}>
              <button
                type="button"
                className="wmm-acao"
                data-testid="wmm-encontro-confirmar-troca"
                disabled={ocupado || !novoTexto.trim()}
                onClick={() => decidir("trocar")}
                style={{ ...btnStyle("primary"), minHeight: HIT.mobile }}
              >
                Trocar por este
              </button>
              <button
                type="button"
                className="wmm-acao"
                disabled={ocupado}
                onClick={() => setTrocando(false)}
                style={{ ...btnStyle("quiet"), minHeight: HIT.mobile }}
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
                  className="wmm-acao"
                  data-testid={`wmm-encontro-${d.valor}`}
                  /* Sem sugestão não há o que aceitar. O botão fica ali,
                     desabilitado e explicado — sumir com ele faria o mestre
                     achar que a interface está quebrada. */
                  disabled={ocupado || (d.valor === "aceitar" && semSugestao)}
                  title={d.dica}
                  onClick={() => (d.valor === "trocar" ? setTrocando(true) : decidir(d.valor))}
                  style={{
                    ...btnStyle(d.valor === "aceitar" ? "primary" : "quiet"),
                    minHeight: HIT.mobile, flex: "1 1 120px",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: SP.x1 }}>
              {DECISOES.map((d) => (
                <li key={d.valor} style={{ ...T.meta, fontSize: FS.micro }}>
                  <strong style={{ color: "var(--text)" }}>{d.label}</strong> —{" "}
                  {d.valor === "aceitar" && semSugestao
                    ? "não há sugestão para aceitar desta vez."
                    : d.dica}
                </li>
              ))}
            </ul>
          </div>
        )}

        {falha ? (
          <p role="alert" data-testid="wmm-encontro-falha" style={{ margin: 0, ...T.meta, color: DANGER_TEXT_AA }}>
            {falha}
          </p>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="wmm-acao"
            data-testid="wmm-encontro-adiar"
            disabled={ocupado}
            onClick={adiar}
            style={{ ...btnStyle("ghost", "sm") }}
          >
            Decidir depois
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
