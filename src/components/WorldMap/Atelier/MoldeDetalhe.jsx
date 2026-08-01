/* ════════════════════════════════════════════════════════════════════
 *  ATELIÊ — MOLDE ABERTO  (spec 0028 · F1 · AC-2)
 *  --------------------------------------------------------------------
 *  A Fase 1 entrega a IDENTIDADE do molde: nome, descrição, ilustração de
 *  fundo e as ações de renomear/excluir. O editor de grafo (nós e trilhas)
 *  é a Fase 2 — e o lugar dele na tela diz isso com todas as letras, em vez
 *  de fingir que a tela está pronta.
 *
 *  Upload: preview local ANTES de subir (o mestre confere o enquadramento
 *  sem gastar banda), e a falha do envio chega como frase em português.
 *
 *  ONDE A ILUSTRAÇÃO É GUARDADA (decisão do Andre, 2026-08-01): enquanto o
 *  projeto está no plano Spark, o fundo vai em base64 num documento próprio
 *  do Firestore (plano B do ADR-0008) — o envio FUNCIONA, com um teto de
 *  tamanho. Por isso esta tela não bloqueia mais o botão: ela diz o limite
 *  ANTES de o mestre escolher o arquivo, e explica a recusa quando a imagem
 *  não couber nem depois da redução automática. Quando o Blaze entrar, o
 *  store troca sozinho para o Storage e esta tela não muda.
 * ════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  uploadBackground, getBackground, fundoDisponivel,
  LIMITE_FUNDO_BYTES, AVISO_FUNDO_NO_DOCUMENTO,
} from "../worldMapStore";
import { PLAN_QUOTAS } from "../model/quotas";
import EditorDoGrafo from "../Editor";
import {
  SP, R, FS, T, SURF, LINE, HIT, btnStyle, contarNos, tempoRelativo,
  mensagemDeErro, DANGER_TEXT_AA,
} from "./ui";

const MAX_MB = 8;

/**
 * O plano do mestre, para a cota de nós do editor (AC-3).
 *
 * O ateliê entrega `limiteNos` (o teto já calculado), não o identificador do
 * plano — e o editor precisa do identificador, porque quem valida a cota é
 * `canAddNode(plan, ...)` no store, do outro lado da rede. Enquanto o ateliê
 * não repassar `plan` direto, o teto é o suficiente para reconstruí-lo, e o
 * lado errado desta conta é sempre o restritivo: qualquer coisa que não seja
 * exatamente o teto do plano pago vira `free`.
 */
export function planoPeloLimite(plan, limiteNos) {
  if (typeof plan === "string" && plan.trim()) return plan;
  return limiteNos === PLAN_QUOTAS.pro.nodes ? "pago" : "free";
}

/** "0,9 MB" — o teto do store dito em português, sem o mestre ver bytes. */
export const LIMITE_EM_MB = `${(LIMITE_FUNDO_BYTES / 1_000_000).toFixed(1).replace(".", ",")} MB`;

/**
 * URL do fundo GUARDADO no documento do molde — o que dá para mostrar sem
 * nenhuma leitura extra.
 *
 * Ordem: `backgroundUrl` (caminho Storage, imagem cheia) → `backgroundThumb`
 * (caminho base64: o doc raiz só carrega a miniatura, e a ilustração cheia vem
 * de `getBackground`) → a forma agrupada `background:{url}`, aceita por
 * compatibilidade. O card da lista usa exatamente isto, e é por isso que a
 * grade do Ateliê não baixa fundo nenhum inteiro.
 */
export function urlDoFundo(molde) {
  if (molde?.backgroundUrl) return molde.backgroundUrl;
  if (molde?.backgroundThumb) return molde.backgroundThumb;
  const bg = molde?.background;
  if (!bg) return "";
  return typeof bg === "string" ? bg : (bg.url || "");
}

/**
 * @param {object} props
 * @param {object} props.molde
 * @param {string} props.uid
 * @param {number} props.limiteNos   teto de nós do plano (AC-3)
 * @param {string} [props.plan]      identificador do plano, quando o ateliê o tiver
 * @param {Array}  [props.cenas]     cenas táticas do mestre, para vincular a um lugar
 * @param {Function} [props.onUsarComoBase] cria uma cópia editável do mapa padrão (AC-13)
 * @param {Function} props.onVoltar
 * @param {Function} props.onRenomear
 * @param {Function} props.onExcluir
 */
export default function MoldeDetalhe({
  molde, uid, limiteNos, plan, cenas = [], onUsarComoBase,
  onVoltar, onRenomear, onExcluir,
}) {
  const [preview, setPreview] = useState("");     // dataURL local, antes de subir
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState("");
  const [aviso, setAviso] = useState("");
  const [fundoCheio, setFundoCheio] = useState(""); // ilustração de verdade (base64)
  const inputRef = useRef(null);
  const vivo = useRef(true);

  useEffect(() => () => { vivo.current = false; }, []);

  const fundoAtual = urlDoFundo(molde);
  const moldeId = molde?.id;
  const refDoFundo = molde?.backgroundRef;

  /* O doc do molde carrega só a MINIATURA (~200px) para a lista não trafegar a
   * ilustração inteira. Aqui, com o molde aberto, vale a pena pedir a imagem
   * cheia — uma vez, com cache no store. Sem `backgroundRef` não há o que
   * pedir: ou o mapa não tem fundo, ou o fundo está no Storage (URL direta). */
  useEffect(() => {
    if (!uid || !moldeId || !refDoFundo) { setFundoCheio(""); return undefined; }
    let ativo = true;
    getBackground(uid, moldeId)
      .then((data) => { if (ativo && data) setFundoCheio(data); })
      .catch((err) => {
        console.error("[ateliê] leitura da ilustração falhou:", err);
        if (ativo) setFalha(mensagemDeErro(err));
      });
    return () => { ativo = false; };
  }, [uid, moldeId, refDoFundo]);

  const escolher = useCallback((file) => {
    setFalha("");
    setAviso("");
    if (!file) return;
    if (!/^image\//.test(file.type || "")) {
      setFalha("Escolha um arquivo de imagem (PNG, JPG ou WebP).");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setFalha(`A imagem tem mais de ${MAX_MB} MB. Reduza antes de enviar.`);
      return;
    }
    setArquivo(file);
    /* Preview local por FileReader — nada sobe ainda. */
    try {
      const reader = new FileReader();
      reader.onload = () => { if (vivo.current) setPreview(String(reader.result || "")); };
      reader.onerror = () => { if (vivo.current) setPreview(""); };
      reader.readAsDataURL(file);
    } catch {
      setPreview("");
    }
  }, []);

  const descartar = () => { setArquivo(null); setPreview(""); setFalha(""); };

  const enviar = async () => {
    if (!arquivo || !molde?.id) return;
    setFalha("");
    setAviso("");
    setEnviando(true);
    try {
      const subida = await uploadBackground(uid, molde.id, arquivo);
      if (!vivo.current) return;
      setArquivo(null);
      setPreview("");
      /* O retorno já traz a imagem que ficou gravada (dataURL no caminho base64,
       * download URL no do Storage): mostrar isto evita esperar o snapshot e
       * evita cair na miniatura de 200px depois de subir uma arte inteira. */
      if (subida?.url) setFundoCheio(subida.url);
      setAviso("Ilustração enviada. Ela já é o fundo deste mapa.");
    } catch (err) {
      if (!vivo.current) return;
      console.error("[ateliê] envio da ilustração falhou:", err);
      setFalha(mensagemDeErro(err));
    } finally {
      if (vivo.current) setEnviando(false);
    }
  };

  const mostrando = preview || fundoCheio || fundoAtual;
  /* `fundoDisponivel()` NÃO decide mais se o mestre pode enviar — os dois
     caminhos do store enviam. Ele decide só o que a tela PROMETE: com o Storage
     de pé, a arte sobe em alta; sem ele, a ilustração mora dentro do documento
     do mapa e tem teto de tamanho. Dizer isso antes é o que evita o mestre
     escolher uma arte de 12 MB e descobrir o limite depois de esperar. */
  const noDocumento = !fundoDisponivel();
  const planoEfetivo = planoPeloLimite(plan, limiteNos);

  return (
    <section aria-label={`Mapa-múndi: ${molde?.name || "sem nome"}`}
      style={{ display: "flex", flexDirection: "column", gap: SP.x5 }}>

      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: SP.x3, flexWrap: "wrap" }}>
        <button type="button" className="wm-focus" onClick={onVoltar}
          style={{ ...btnStyle("quiet", "sm"), flexShrink: 0 }}>
          ← Todos os mapas
        </button>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <h2 style={{ ...T.hero, fontSize: FS.h2, margin: 0 }}>{molde?.name || "Sem nome"}</h2>
          <div style={{ ...T.data, marginTop: SP.x1 }}>
            {contarNos(molde?.nodeCount)} · atualizado {tempoRelativo(molde?.updatedAt)}
          </div>
        </div>
        <div style={{ display: "flex", gap: SP.x2, flexShrink: 0 }}>
          <button type="button" className="wm-focus wm-act" onClick={onRenomear} style={btnStyle("ghost", "sm")}>
            Renomear
          </button>
          <button type="button" className="wm-focus wm-act" onClick={onExcluir} style={btnStyle("danger", "sm")}>
            Excluir
          </button>
        </div>
      </div>

      {molde?.description ? (
        <p style={{ ...T.body, margin: 0, color: "var(--muted2)", maxWidth: "68ch" }}>{molde.description}</p>
      ) : null}

      {/* ── Ilustração de fundo ───────────────────────────────────── */}
      <div style={{
        background: SURF.rail, border: `1px solid ${LINE.edge}`,
        borderRadius: R.panel, padding: SP.x5,
      }}>
        <h3 style={{ ...T.section, margin: `0 0 ${SP.x3}px` }}>Ilustração de fundo</h3>

        {noDocumento && (
          <div role="status" style={{
            display: "flex", alignItems: "flex-start", gap: SP.x3, marginBottom: SP.x3,
            padding: SP.x3, borderRadius: R.card,
            background: "rgba(201,168,76,0.08)", border: "1px solid var(--border2)",
            ...T.meta, color: "var(--text)",
          }}>
            <span aria-hidden="true" style={{ flexShrink: 0 }}>🗜️</span>
            <span>{AVISO_FUNDO_NO_DOCUMENTO}</span>
          </div>
        )}

        <div className="wm-drop" style={{
          display: "flex", flexDirection: "column", gap: SP.x3,
          border: `1px dashed ${LINE.raise}`, borderRadius: R.card, padding: SP.x4,
        }}>
          {mostrando ? (
            <img
              src={mostrando}
              alt={preview ? "Prévia da ilustração escolhida" : `Ilustração de fundo de ${molde?.name || "mapa"}`}
              style={{
                display: "block", width: "100%", maxHeight: 320, objectFit: "contain",
                borderRadius: R.input, background: "rgba(0,0,0,0.35)",
              }}
            />
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: SP.x2, minHeight: 140, textAlign: "center",
            }}>
              <span aria-hidden="true" style={{ fontSize: 34, opacity: 0.4 }}>🖼️</span>
              <div style={{ ...T.meta, maxWidth: "46ch" }}>
                Suba a arte do continente, da região ou da cidade. É sobre ela que os nós e as
                trilhas vão ser plantados.
              </div>
            </div>
          )}

          {/* O input fica fora da ordem de tabulação: quem navega por teclado
              alcança o BOTÃO abaixo, que é rotulado e tem alvo de 44px. */}
          <input
            ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
            tabIndex={-1} aria-hidden="true"
            onChange={(e) => { escolher(e.target.files?.[0] || null); e.target.value = ""; }}
            style={{ display: "none" }}
          />

          <div style={{ display: "flex", gap: SP.x2, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="wm-focus" onClick={() => inputRef.current?.click()}
              disabled={enviando}
              style={{ ...btnStyle("ghost", "sm"), minHeight: HIT.mobile }}>
              {mostrando ? "Trocar imagem" : "Escolher imagem"}
            </button>

            {arquivo ? (
              <>
                <button type="button" className="wm-focus" onClick={enviar} disabled={enviando}
                  style={{ ...btnStyle("primary", "sm"), minHeight: HIT.mobile, opacity: enviando ? 0.6 : 1 }}>
                  {enviando ? "Enviando…" : "Enviar ilustração"}
                </button>
                <button type="button" className="wm-focus" onClick={descartar} disabled={enviando}
                  style={{ ...btnStyle("quiet", "sm"), minHeight: HIT.mobile }}>
                  Descartar
                </button>
                <span style={{ ...T.meta, fontSize: FS.micro }}>{arquivo.name}</span>
              </>
            ) : (
              /* O limite dito ANTES da escolha, sem eufemismo: o mestre precisa
                 saber que a arte é reduzida e qual é o teto real do que fica
                 gravado — não só o teto do arquivo que ele pode selecionar. */
              <span style={{ ...T.meta, fontSize: FS.micro }}>
                PNG, JPG ou WebP, até {MAX_MB} MB
                {noDocumento
                  ? ` — a imagem é reduzida automaticamente e precisa caber em ${LIMITE_EM_MB} dentro do mapa.`
                  : "."}
              </span>
            )}
          </div>
        </div>

        {falha ? (
          <div role="alert" style={{
            marginTop: SP.x3, padding: SP.x3, borderRadius: R.card,
            background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
            ...T.meta, color: "var(--text)",
          }}>
            <strong style={{ color: DANGER_TEXT_AA }}>A ilustração não subiu. </strong>{falha}
          </div>
        ) : null}

        {aviso ? (
          <div role="status" style={{
            marginTop: SP.x3, padding: SP.x3, borderRadius: R.card,
            background: "rgba(106,170,122,0.12)", border: "1px solid rgba(106,170,122,0.35)",
            ...T.meta, color: "#8fd3a0",
          }}>
            {aviso}
          </div>
        ) : null}
      </div>

      {/* ── Lugares e trilhas — o editor visual (F2 · AC-4) ───────── */}
      <div style={{
        background: SURF.rail, border: `1px solid ${LINE.edge}`,
        borderRadius: R.panel, padding: SP.x5,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: SP.x3, flexWrap: "wrap", marginBottom: SP.x4 }}>
          <h3 style={{ ...T.section, margin: 0 }}>Lugares e trilhas</h3>
          <span style={{ ...T.meta, fontSize: FS.micro }}>
            Seu plano permite até {limiteNos ?? "—"} lugares neste mapa.
          </span>
        </div>

        <EditorDoGrafo
          uid={uid}
          molde={molde}
          plan={planoEfetivo}
          fundoUrl={fundoCheio || fundoAtual}
          cenas={cenas}
          onUsarComoBase={onUsarComoBase}
        />
      </div>
    </section>
  );
}
