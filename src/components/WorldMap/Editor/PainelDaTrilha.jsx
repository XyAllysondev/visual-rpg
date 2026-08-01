/* ════════════════════════════════════════════════════════════════════
 *  EDITOR DO GRAFO — PAINEL DA TRILHA  (spec 0028 · F2 · AC-4)
 *  --------------------------------------------------------------------
 *  "horas de viagem, secreta (sim/não), teste de descoberta (perícia + CD),
 *   nível de perigo e mão única".
 *
 *  SEGREDO EM PRIMEIRO LUGAR, e não no fim de uma lista: é a informação que
 *  a F4 vai proteger (AC-1) e a que muda o comportamento do resto do painel
 *  — sem trilha secreta, teste de descoberta não quer dizer nada. Por isso
 *  o interruptor vem antes, o painel inteiro ganha a borda violeta quando
 *  ligado, e o teste só aparece depois dele.
 *
 *  Mesma disciplina do painel do nó: rascunho local, `onSalvar` explícito.
 * ════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { pontasDaTrilha } from "../model/graph";
import { NIVEIS_DE_PERIGO, formatarHoras, nomeDaTrilha, rotuloDoPerigo } from "./editorUi";
import { Bloco, Escolha, Interruptor, Numero, Texto } from "./Campos";
import { SP, R, FS, T, LINE, btnStyle, DANGER_TEXT_AA } from "../Atelier/ui";

const CAMPOS = ["travelHours", "isSecret", "isOneWay", "dangerLevel", "pericia", "cd"];

/** Cópia editável da trilha, com o teste de descoberta desdobrado em dois campos. */
function rascunhoDe(trilha) {
  const teste = trilha?.discoveryCheck || null;
  return {
    travelHours: Number.isFinite(trilha?.travelHours) ? trilha.travelHours : 1,
    isSecret: !!trilha?.isSecret,
    isOneWay: !!trilha?.isOneWay,
    dangerLevel: Number.isFinite(trilha?.dangerLevel) ? trilha.dangerLevel : 0,
    pericia: teste?.skill ?? "",
    cd: Number.isFinite(teste?.dc) ? teste.dc : null,
  };
}

/**
 * O patch normalizado que vai para o store.
 *
 * O teste de descoberta volta a ser UM objeto (`discoveryCheck`), como o
 * design §3 define — e some quando a trilha deixa de ser secreta: teste de
 * descoberta em trilha aberta é dado morto que a F5 iria tropeçar.
 */
export function patchDaTrilha(rascunho) {
  const secreta = !!rascunho.isSecret;
  const pericia = (rascunho.pericia || "").trim();
  const temTeste = secreta && pericia && Number.isFinite(rascunho.cd);
  return {
    travelHours: Number.isFinite(rascunho.travelHours) && rascunho.travelHours >= 0
      ? rascunho.travelHours
      : 0,
    isSecret: secreta,
    isOneWay: !!rascunho.isOneWay,
    dangerLevel: rotuloDoPerigo(rascunho.dangerLevel).valor,
    discoveryCheck: temTeste ? { skill: pericia, dc: rascunho.cd } : null,
  };
}

/**
 * @param {object} props
 * @param {object} props.trilha
 * @param {Array} props.nos para nomear as pontas.
 * @param {boolean} [props.somenteLeitura]
 * @param {(patch:object)=>Promise<any>} props.onSalvar
 * @param {()=>void} props.onRemover
 * @param {()=>void} props.onInverter troca origem e destino.
 * @param {()=>void} props.onEndireitar remove a curvatura.
 * @param {()=>void} props.onFechar
 */
export default function PainelDaTrilha({
  trilha,
  nos = [],
  somenteLeitura = false,
  onSalvar,
  onRemover,
  onInverter,
  onEndireitar,
  onFechar,
}) {
  const [rascunho, setRascunho] = useState(() => rascunhoDe(trilha));
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState("");

  useEffect(() => {
    setRascunho(rascunhoDe(trilha));
    setFalha("");
  }, [trilha?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sujo = useMemo(() => {
    const original = rascunhoDe(trilha);
    return CAMPOS.some((c) => original[c] !== rascunho[c]);
  }, [trilha, rascunho]);

  const trocar = (campo) => (valor) => setRascunho((r) => ({ ...r, [campo]: valor }));

  const salvar = async () => {
    if (!onSalvar) return;
    setFalha("");
    setSalvando(true);
    try {
      await onSalvar(patchDaTrilha(rascunho));
    } catch (err) {
      setFalha(err?.message || "Não foi possível salvar esta trilha.");
    } finally {
      setSalvando(false);
    }
  };

  const idBase = `wme-trilha-${trilha?.id || "nova"}`;
  const perigo = rotuloDoPerigo(rascunho.dangerLevel);
  const [de, para] = pontasDaTrilha(trilha);
  const curvada = Array.isArray(trilha?.pathPoints) && trilha.pathPoints.length > 0;

  return (
    <aside
      className="wme-painel"
      aria-label={`Editar trilha: ${nomeDaTrilha(trilha, nos)}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SP.x4,
        /* O painel inteiro veste a cor do segredo quando a trilha é secreta —
           é o sinal de relance que o mestre precisa (AC-4). */
        ...(rascunho.isSecret ? {
          padding: SP.x3,
          margin: `-${SP.x3}px`,
          borderRadius: R.card,
          border: "1px solid rgba(138,122,214,0.45)",
          background: "rgba(138,122,214,0.06)",
        } : null),
      }}
    >
      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: SP.x3 }}>
        <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>
          {rascunho.isSecret ? "🔒" : "⤳"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...T.section, fontSize: 10 }}>
            {rascunho.isSecret ? "Trilha secreta" : "Trilha"}
          </div>
          <div style={{ ...T.cardTitle, fontSize: FS.body, lineHeight: 1.4 }}>
            {nomeDaTrilha(trilha, nos)}
          </div>
        </div>
        <button type="button" className="wme-focus" onClick={onFechar} aria-label="Fechar o painel da trilha"
          style={{ ...btnStyle("quiet", "sm") }}>
          ✕
        </button>
      </div>

      <div style={{ ...T.data }}>
        {formatarHoras(rascunho.travelHours)} · {perigo.label}
        {rascunho.isOneWay ? " · mão única" : ""}
        {curvada ? " · curvada" : ""}
      </div>

      {/* ── Segredo ───────────────────────────────────────────────── */}
      <Bloco titulo="🔒 Segredo">
        <Interruptor
          id={`${idBase}-secreta`}
          label="Trilha secreta"
          dica="Fica invisível para o grupo até um teste bem-sucedido, um gatilho, ou você revelar à mão. Chegar num dos lados não a revela."
          marcado={rascunho.isSecret}
          aoMudar={trocar("isSecret")}
          destaque
        />

        {rascunho.isSecret ? (
          <div style={{ display: "flex", gap: SP.x3, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px", minWidth: 0 }}>
              <Texto
                id={`${idBase}-pericia`}
                label="Perícia do teste"
                valor={rascunho.pericia}
                aoMudar={trocar("pericia")}
                placeholder="Investigação"
                maxLength={40}
              />
            </div>
            <div style={{ flex: "0 1 120px" }}>
              <Numero
                id={`${idBase}-cd`}
                label="CD"
                valor={rascunho.cd}
                aoMudar={trocar("cd")}
                min={1}
                max={60}
              />
            </div>
            <div style={{ flexBasis: "100%", ...T.meta, fontSize: FS.micro }}>
              Sem perícia e CD, a trilha só aparece por gatilho ou revelação manual. A falha no
              teste nunca conta ao grupo que existe alguma coisa ali.
            </div>
          </div>
        ) : null}
      </Bloco>

      {/* ── Viagem ────────────────────────────────────────────────── */}
      <Bloco titulo="Viagem">
        <Numero
          id={`${idBase}-horas`}
          label="Horas de viagem"
          dica="Quanto tempo o grupo gasta para percorrer a trilha inteira. Aceita fração (0,5 = meia hora)."
          valor={rascunho.travelHours}
          aoMudar={trocar("travelHours")}
          min={0}
          max={2000}
          passo={0.5}
          sufixo={`= ${formatarHoras(rascunho.travelHours)}`}
        />

        <Escolha
          id={`${idBase}-perigo`}
          label="Nível de perigo"
          dica={perigo.hint}
          valor={String(rascunho.dangerLevel)}
          aoMudar={(v) => trocar("dangerLevel")(Number(v))}
          opcoes={NIVEIS_DE_PERIGO.map((n) => ({ value: String(n.valor), label: `${n.valor} — ${n.label}` }))}
        />

        <Interruptor
          id={`${idBase}-maounica`}
          label="Mão única"
          dica={de && para
            ? `O grupo só percorre no sentido ${nomeDaTrilha({ ...trilha, isOneWay: true }, nos)}.`
            : "O grupo só percorre no sentido origem → destino."}
          marcado={rascunho.isOneWay}
          aoMudar={trocar("isOneWay")}
        />
      </Bloco>

      {falha ? (
        <div role="alert" style={{
          padding: SP.x3, borderRadius: R.card, ...T.meta, color: "var(--text)",
          background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
        }}>
          <strong style={{ color: DANGER_TEXT_AA }}>Não salvou. </strong>{falha}
        </div>
      ) : null}

      {/* ── Ações ─────────────────────────────────────────────────── */}
      {!somenteLeitura ? (
        <div style={{ display: "flex", flexDirection: "column", gap: SP.x2 }}>
          <div style={{ display: "flex", gap: SP.x2, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="wme-focus" onClick={salvar} disabled={salvando || !sujo}
              style={{ ...btnStyle("primary", "sm"), opacity: (salvando || !sujo) ? 0.5 : 1 }}>
              {salvando ? "Salvando…" : "Salvar alterações"}
            </button>
            <button type="button" className="wme-focus" onClick={onRemover}
              style={{ ...btnStyle("danger", "sm") }}>
              Apagar trilha
            </button>
          </div>
          <div style={{ display: "flex", gap: SP.x2, flexWrap: "wrap", paddingTop: SP.x1, borderTop: `1px solid ${LINE.hair}` }}>
            <button type="button" className="wme-focus" onClick={onInverter}
              title="Troca origem e destino — útil depois de marcar mão única no sentido errado"
              style={{ ...btnStyle("quiet", "sm") }}>
              Inverter sentido
            </button>
            <button type="button" className="wme-focus" onClick={onEndireitar} disabled={!curvada}
              title="Desfaz a curvatura e volta a trilha para a reta entre os dois lugares"
              style={{ ...btnStyle("quiet", "sm"), opacity: curvada ? 1 : 0.5 }}>
              Endireitar
            </button>
          </div>
          <div style={{ ...T.meta, fontSize: FS.micro }}>
            Para entortar a trilha, arraste o punho dourado que aparece no meio dela.
          </div>
        </div>
      ) : null}
    </aside>
  );
}
