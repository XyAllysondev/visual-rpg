/* ════════════════════════════════════════════════════════════════════
 *  O CARTÃO DE PERGAMINHO  (spec 0035 · F3 · M5 · AC-12)
 *  --------------------------------------------------------------------
 *  Uma casca só, dois consumidores: o cartão de DESCOBERTA (o lugar que
 *  acabou de entrar no mapa) e o painel de ENCONTRO do mestre. Antes eram
 *  dois retângulos escuros de painel; agora são o mesmo pedaço de papel,
 *  porque na mesa os dois são a MESMA coisa — a carta contando algo.
 *
 *  ── POR QUE UMA CASCA, E NÃO DOIS COMPONENTES PARECIDOS ─────────────
 *  Porque "parecido" apodrece. Duas caixas com o mesmo pergaminho escritas
 *  em dois arquivos divergem no primeiro ajuste de padding, e o jogador vê
 *  duas peças que QUASE combinam — que é pior do que duas que não combinam.
 *
 *  ── O CONTRATO DE SEGREDO ATRAVESSA ESTE ARQUIVO ────────────────────
 *  `CartaoDeDescoberta` recebe **a projeção do jogador** (`projecaoDoNo`,
 *  `mesaStore.js:353`) e lê dela apenas `name` e `description`. Não recebe
 *  o nó do molde, não espalha `...no` em lugar nenhum, e não tem acesso ao
 *  que a lista branca não deixou passar. Se um dia alguém lhe entregar o
 *  molde cru, um `{...no}` esquecido imprimiria `gmNotes` no DOM — daí o
 *  gate varrer o DOM serializado atrás de cada nome de `CAMPOS_VENENOSOS`.
 *
 *  ── CONTRASTE ───────────────────────────────────────────────────────
 *  A tinta do corpo sobre o papel dá ~11:1, e continua acima de 4,5:1 com
 *  qualquer das quatro tintas do dia composta por cima. Na prática nenhuma
 *  o alcança (o cartão é um portal em `document.body`, fora do palco), mas
 *  o piso é medido assim mesmo — em `__tests__/cartao-pergaminho.test.js`,
 *  contra os MESMOS números de `TINTA_DO_DIA`.
 *
 *  ── MOVIMENTO ───────────────────────────────────────────────────────
 *  A entrada do cartão é uma classe (`.wmm-pergaminho`), definida em
 *  `MesaStyles.jsx` e cortada pelo `data-anima="nao"` do palco e pelo
 *  `prefers-reduced-motion` — nenhum keyframe mora aqui.
 * ══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FF, FS, FW, HIT, LS, R, SP } from "../Atelier/ui";

/**
 * As cores do papel, em RGB puro.
 *
 * Exportadas porque o gate de contraste mede ESTES números — não uma cópia
 * deles escrita no teste, que poderia divergir em silêncio. É a mesma
 * disciplina do `PALETA`/`TINTA_DO_DIA` em `animacaoUi.js`.
 */
export const PERGAMINHO = Object.freeze({
  /** O miolo do papel, e a beirada tostada. */
  papel: Object.freeze([232, 220, 192]),
  papelBorda: Object.freeze([201, 180, 138]),
  /** A tinta do corpo — a cor que a conta de contraste protege. */
  tinta: Object.freeze([46, 36, 21]),
  /**
   * O título: a tinta MAIS FECHADA da carta, não a mais clara.
   *
   * A primeira versão fazia o contrário (um sépia acima do corpo), e o gate de
   * contraste pegou: com a tinta da madrugada composta sobre a beirada tostada
   * do papel, o título caía para 4,42:1. Além de reprovar no piso, estava
   * errado de desenho — num impresso o cabeçalho é onde a pena carrega mais.
   */
  titulo: Object.freeze([36, 27, 14]),
  /** O filete duplo e a moldura. */
  filete: Object.freeze([138, 111, 60]),
});

const cor = (t) => `rgb(${t[0]},${t[1]},${t[2]})`;
const corA = (t, a) => `rgba(${t[0]},${t[1]},${t[2]},${a})`;

/** Tudo que pode receber foco dentro do cartão, na ordem do documento. */
const FOCAVEIS = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),'
  + 'select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

/** O papel: dois tons manchados, sem um pixel de bitmap. */
const FUNDO_DO_PAPEL =
  `radial-gradient(120% 90% at 26% 12%, ${cor(PERGAMINHO.papel)} 0%,`
  + ` ${cor(PERGAMINHO.papel)} 46%, ${cor(PERGAMINHO.papelBorda)} 100%)`;

/**
 * O filete duplo — a linha grossa, o vão, a linha fina. É o acabamento que
 * diz "isto foi impresso", e não "isto é uma div".
 */
export function FileteDuplo({ style }) {
  return (
    <div aria-hidden="true" data-parte="filete" style={style}>
      <div style={{ height: 2, background: corA(PERGAMINHO.filete, 0.85) }} />
      <div style={{ height: 3 }} />
      <div style={{ height: 1, background: corA(PERGAMINHO.filete, 0.55) }} />
    </div>
  );
}

/**
 * A casca. Fundo de pergaminho, título em versalete, corpo serifado, filete
 * duplo e **um** botão — um só, de propósito: o cartão informa, ele não é
 * uma tela de decisão. Quem precisa de mais controles (o painel do mestre)
 * os passa em `children`, abaixo do filete.
 *
 * @param {object} props
 * @param {string} props.titulo o cabeçalho em versalete.
 * @param {string} [props.chapeu] a linha pequena acima do título.
 * @param {import('react').ReactNode} [props.corpo] o texto serifado.
 * @param {import('react').ReactNode} [props.children] o que vem abaixo do filete.
 * @param {string} [props.rotuloDoBotao]
 * @param {()=>void} [props.onFechar] fecha; é também o que o Esc e o clique
 *   fora chamam. Sem ele o cartão não ganha botão e não fecha sozinho.
 * @param {boolean} [props.ocupado]
 * @param {string} [props.testId]
 * @param {string} [props.rotuloAcessivel] o `aria-label` do diálogo.
 * @param {string} [props.descritoPor] id do elemento que descreve o diálogo.
 */
export default function CartaoDePergaminho({
  titulo,
  chapeu = "",
  corpo = null,
  children = null,
  rotuloDoBotao = "Fechar",
  onFechar,
  ocupado = false,
  testId = "wmm-pergaminho",
  /* O testid do botão é separado porque o painel do mestre já tinha o dele
     antes da casca existir, e renomeá-lo quebraria suíte legada por motivo
     nenhum — o AC-9 chama isso de regressão, não de progresso. */
  testIdDoBotao,
  rotuloAcessivel,
  descritoPor,
  anima = true,
}) {
  const caixaRef = useRef(null);
  const gatilhoRef = useRef(null);

  /* O foco entra na CAIXA, não num botão: o leitor de tela lê o título e o
     corpo antes de qualquer ação, e um Enter distraído não fecha o cartão
     antes de ele ter sido lido. Mesma escolha do `PainelDeEncontro`. */
  useEffect(() => {
    gatilhoRef.current = typeof document !== "undefined" ? document.activeElement : null;
    const t = setTimeout(() => { if (caixaRef.current) caixaRef.current.focus(); }, 30);
    return () => {
      clearTimeout(t);
      const el = gatilhoRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, []);

  const fechar = useCallback(() => { if (!ocupado && onFechar) onFechar(); }, [ocupado, onFechar]);

  /* Esc fecha; Tab fica preso. O laço do Tab é feito à mão porque o projeto
     não tem (e não vai ganhar) dependência de foco — ADR-0004. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); fechar(); return; }
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
  }, [fechar]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 430, padding: SP.x4,
        background: "rgba(8,8,14,0.84)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        ref={caixaRef}
        className="wmm-pergaminho"
        /* O cartão é um portal em `document.body`: o `data-anima` do palco não
           chega aqui por descendência, então a mesa o ENCAMINHA. Sem isto o
           "mapa parado" pararia tudo menos o cartão. */
        data-anima={anima ? "sim" : "nao"}
        role="dialog"
        aria-modal="true"
        aria-label={rotuloAcessivel || titulo}
        aria-describedby={descritoPor}
        data-testid={testId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(520px,100%)", maxHeight: "88vh", overflowY: "auto",
          background: FUNDO_DO_PAPEL,
          border: `1px solid ${corA(PERGAMINHO.filete, 0.7)}`,
          /* A moldura interna de papel timbrado: um filete rente à borda, por
             dentro, que não custa um elemento a mais. */
          boxShadow: `inset 0 0 0 1px ${corA(PERGAMINHO.papel, 0.55)},`
            + ` inset 0 0 0 4px ${corA(PERGAMINHO.filete, 0.34)},`
            + " 0 24px 64px rgba(0,0,0,0.72)",
          borderRadius: R.card, padding: SP.x5,
          display: "flex", flexDirection: "column", gap: SP.x3, outline: "none",
          color: cor(PERGAMINHO.tinta),
        }}
      >
        {chapeu ? (
          <div
            data-parte="chapeu"
            style={{
              fontFamily: FF.title, fontSize: FS.micro, fontWeight: FW.bold,
              letterSpacing: LS.label, textTransform: "uppercase",
              /* Sem alfa: o chapéu é micro-tipografia em caixa alta, o texto
                 mais frágil do cartão. Rebaixá-lo com transparência o tiraria
                 da conta de contraste que o gate mede. */
              color: cor(PERGAMINHO.titulo),
            }}
          >
            {chapeu}
          </div>
        ) : null}

        {/* O TÍTULO EM VERSALETE: caixa alta com entreletra aberta, na
            serifada de display. É a voz da carta, não a voz do app. */}
        <h2
          data-parte="titulo"
          style={{
            margin: 0, fontFamily: FF.display, fontSize: FS.h2, fontWeight: FW.bold,
            letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1.2,
            color: cor(PERGAMINHO.titulo),
          }}
        >
          {titulo}
        </h2>

        <FileteDuplo />

        {corpo ? (
          <div
            data-parte="corpo"
            style={{
              fontFamily: "var(--font-title,'Cinzel',Georgia,serif)",
              fontSize: FS.body, lineHeight: 1.7, color: cor(PERGAMINHO.tinta),
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}
          >
            {corpo}
          </div>
        ) : null}

        {children}

        {onFechar ? (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: SP.x1 }}>
            <button
              type="button"
              className="wmm-selo"
              data-testid={testIdDoBotao || `${testId}-fechar`}
              disabled={ocupado}
              onClick={fechar}
              style={{
                minHeight: HIT.mobile, padding: `0 ${SP.x5}px`,
                background: corA(PERGAMINHO.filete, 0.16),
                border: `1px solid ${corA(PERGAMINHO.filete, 0.75)}`,
                borderRadius: R.ctl, cursor: "pointer",
                fontFamily: FF.title, fontSize: FS.tag, fontWeight: FW.bold,
                letterSpacing: LS.tag, textTransform: "uppercase",
                color: cor(PERGAMINHO.titulo),
              }}
            >
              {rotuloDoBotao}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * O cartão de DESCOBERTA — o lugar que acabou de entrar no mapa.
 *
 * ⚠️ `no` tem de ser **a projeção do jogador** (`projecaoDoNo`). Este
 * componente lê `name` e `description` e mais nada, e não espalha o objeto
 * em lugar nenhum — para que um molde passado por engano não consiga
 * imprimir `gmNotes` no DOM por um `{...no}` esquecido.
 *
 * @param {object} props
 * @param {{name?:string, description?:string}} props.no a PROJEÇÃO do nó.
 * @param {()=>void} props.onFechar
 */
export function CartaoDeDescoberta({ no, onFechar, anima = true }) {
  const nome = typeof no?.name === "string" && no.name.trim()
    ? no.name.trim()
    : "Um lugar sem nome";
  const descricao = typeof no?.description === "string" ? no.description.trim() : "";

  return (
    <CartaoDePergaminho
      testId="wmm-cartao-descoberta"
      chapeu="Nova localização descoberta"
      titulo={nome}
      rotuloAcessivel={`Nova localização descoberta: ${nome}`}
      /* Lugar sem descrição não ganha caixa vazia: ganha a única frase que a
         projeção autoriza — "está no mapa, e nada mais se sabe dele". */
      corpo={descricao || "O lugar entra no mapa. Não se conta mais nada dele por enquanto."}
      rotuloDoBotao="Anotar no mapa"
      onFechar={onFechar}
      anima={anima}
    />
  );
}
