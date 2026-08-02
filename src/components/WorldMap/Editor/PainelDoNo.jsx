/* ════════════════════════════════════════════════════════════════════
 *  EDITOR DO GRAFO — PAINEL DO NÓ  (spec 0028 · F2 · AC-4)
 *  --------------------------------------------------------------------
 *  "edita nome, tipo, ícone, rumor, descrição pública, notas do mestre,
 *   cena vinculada e raio de revelação" — mais cor e viagem rápida, que o
 *  modelo do design §3 já prevê (`color`, `isFastTravel`).
 *
 *  RASCUNHO, NÃO GRAVAÇÃO A CADA TECLA. O painel edita uma cópia local e
 *  só chama `onSalvar` quando o mestre confirma. Gravar a cada tecla seria
 *  uma escrita de Firestore por caractere — e deixaria o mestre sem o
 *  direito de desistir do que começou a escrever.
 *
 *  OS TRÊS CAMPOS QUE A F4 VAI PROTEGER estão visualmente separados do
 *  resto (bloco "Só o mestre vê"): `gmNotes` nunca é copiado para a
 *  projeção pública (AC-1), e o mestre precisa saber disso enquanto
 *  escreve, não depois.
 * ════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { NODE_TYPES, getNodeType } from "../model/graph";
import { ICONES_POR_TIPO, iconeDoNo } from "./TelaDoMapa";
import { Bloco, AreaDeTexto, Escolha, Interruptor, Numero, Texto } from "./Campos";
import { SP, R, FS, T, LINE, btnStyle, DANGER_TEXT_AA } from "../Atelier/ui";

/** Os campos que o painel edita — a lista que decide "mudou alguma coisa?". */
const CAMPOS = [
  "name", "type", "icon", "color", "rumorLabel", "description", "gmNotes",
  "linkedSceneId", "revealRadius", "isFastTravel",
];

/** Cópia editável do nó, com os defaults do modelo já aplicados. */
function rascunhoDe(no) {
  return {
    name: no?.name ?? "",
    type: no?.type ?? "poi",
    icon: no?.icon ?? "",
    color: no?.color ?? getNodeType(no?.type).color,
    rumorLabel: no?.rumorLabel ?? "",
    description: no?.description ?? "",
    gmNotes: no?.gmNotes ?? "",
    linkedSceneId: no?.linkedSceneId ?? "",
    revealRadius: Number.isFinite(no?.revealRadius) ? no.revealRadius : null,
    isFastTravel: !!no?.isFastTravel,
  };
}

/** O patch normalizado que vai para o store — nunca o rascunho cru. */
export function patchDoNo(rascunho) {
  return {
    name: (rascunho.name || "").trim() || "Novo local",
    type: rascunho.type,
    icon: (rascunho.icon || "").trim() || null,
    color: rascunho.color || getNodeType(rascunho.type).color,
    rumorLabel: (rascunho.rumorLabel || "").trim(),
    description: (rascunho.description || "").trim(),
    gmNotes: (rascunho.gmNotes || "").trim(),
    linkedSceneId: (rascunho.linkedSceneId || "").trim() || null,
    revealRadius: Number.isFinite(rascunho.revealRadius) ? rascunho.revealRadius : null,
    isFastTravel: !!rascunho.isFastTravel,
  };
}

/**
 * @param {object} props
 * @param {object} props.no o nó selecionado.
 * @param {number} [props.raioPadraoDoMapa] usado como placeholder do raio.
 * @param {Array<{id:string,name:string}>} [props.cenas] cenas táticas do mestre.
 * @param {boolean} [props.somenteLeitura]
 * @param {(patch:object)=>Promise<any>} props.onSalvar
 * @param {()=>void} props.onRemover
 * @param {()=>void} props.onFechar
 */
export default function PainelDoNo({
  no,
  raioPadraoDoMapa,
  cenas = [],
  somenteLeitura = false,
  onSalvar,
  onRemover,
  onFechar,
}) {
  const [rascunho, setRascunho] = useState(() => rascunhoDe(no));
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState("");
  const idBase = `wme-no-${no?.id || "novo"}`;

  /* Trocar de nó recomeça o rascunho. Sem isto o painel mostraria o texto do
     nó anterior sobre o nó novo — o bug clássico de formulário reaproveitado. */
  useEffect(() => {
    setRascunho(rascunhoDe(no));
    setFalha("");
  }, [no?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* O foco entra no campo Nome ao abrir: quem plantou um lugar com a
     ferramenta já está com a mão no teclado e quer batizá-lo. */
  useEffect(() => {
    const alvo = `${idBase}-nome`;
    const t = setTimeout(() => {
      if (typeof document === "undefined") return;
      const el = document.getElementById(alvo);
      if (el && typeof el.focus === "function") { el.focus(); el.select?.(); }
    }, 40);
    return () => clearTimeout(t);
  }, [idBase]);

  const sujo = useMemo(() => {
    const original = rascunhoDe(no);
    return CAMPOS.some((c) => original[c] !== rascunho[c]);
  }, [no, rascunho]);

  const trocar = (campo) => (valor) => setRascunho((r) => ({ ...r, [campo]: valor }));

  const trocarTipo = (tipo) => setRascunho((r) => {
    const anterior = getNodeType(r.type).color;
    return {
      ...r,
      type: tipo,
      // A cor acompanha o tipo enquanto o mestre não escolheu uma própria.
      color: r.color === anterior ? getNodeType(tipo).color : r.color,
    };
  });

  const salvar = async () => {
    if (!onSalvar) return;
    setFalha("");
    setSalvando(true);
    try {
      await onSalvar(patchDoNo(rascunho));
    } catch (err) {
      setFalha(err?.message || "Não foi possível salvar este lugar.");
    } finally {
      setSalvando(false);
    }
  };

  const tipo = getNodeType(rascunho.type);

  return (
    <aside
      className="wme-painel"
      aria-label={`Editar lugar: ${no?.name || "sem nome"}`}
      style={{ display: "flex", flexDirection: "column", gap: SP.x4 }}
    >
      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: SP.x3 }}>
        <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>
          {iconeDoNo({ ...no, ...rascunho })}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...T.section, fontSize: 10 }}>Lugar</div>
          <div style={{ ...T.cardTitle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {rascunho.name || "Sem nome"}
          </div>
        </div>
        <button type="button" className="wme-focus" onClick={onFechar} aria-label="Fechar o painel do lugar"
          style={{ ...btnStyle("quiet", "sm") }}>
          ✕
        </button>
      </div>

      {somenteLeitura ? (
        <div role="status" style={{
          padding: SP.x3, borderRadius: R.card, ...T.meta, color: "var(--text)",
          background: "rgba(201,168,76,0.08)", border: "1px solid var(--border2)",
        }}>
          Este é o mapa que já vem no Nexus. Faça uma cópia para poder editá-lo — o original
          continua intacto para você recomeçar quando quiser.
        </div>
      ) : null}

      {/* ── Identidade ────────────────────────────────────────────── */}
      <Bloco titulo="Identidade">
        <Texto
          id={`${idBase}-nome`}
          label="Nome"
          valor={rascunho.name}
          aoMudar={trocar("name")}
          placeholder="Vila Candeia"
          maxLength={80}
        />

        <Escolha
          id={`${idBase}-tipo`}
          label="Tipo"
          dica={tipo.hint}
          valor={rascunho.type}
          aoMudar={trocarTipo}
          opcoes={NODE_TYPES.map((t) => ({ value: t.id, label: t.label }))}
        />

        <div style={{ display: "flex", gap: SP.x3, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 140px", minWidth: 0 }}>
            <Texto
              id={`${idBase}-icone`}
              label="Ícone"
              dica={`Um emoji. Vazio usa o do tipo (${ICONES_POR_TIPO[rascunho.type] || ICONES_POR_TIPO.poi}).`}
              valor={rascunho.icon}
              aoMudar={trocar("icon")}
              placeholder={ICONES_POR_TIPO[rascunho.type] || "🧭"}
              maxLength={4}
            />
          </div>
          <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: SP.x1 }}>
            <label htmlFor={`${idBase}-cor`} style={{ ...T.section, fontSize: 10 }}>Cor</label>
            <input
              id={`${idBase}-cor`}
              type="color"
              className="wme-focus"
              value={rascunho.color || tipo.color}
              onChange={(e) => trocar("color")(e.target.value)}
              style={{
                width: 56, height: 44, padding: 2, cursor: "pointer",
                background: "rgba(255,255,255,0.05)", borderRadius: R.input,
                border: `1px solid ${LINE.raise}`,
              }}
            />
            <button type="button" className="wme-focus"
              onClick={() => trocar("color")(tipo.color)}
              style={{ ...T.meta, fontSize: FS.micro, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
              usar a do tipo
            </button>
          </div>
        </div>
      </Bloco>

      {/* ── O que o grupo vê ──────────────────────────────────────── */}
      <Bloco titulo="O que o grupo vê">
        <Texto
          id={`${idBase}-rumor`}
          label="Rumor"
          dica="O que o grupo lê ANTES de descobrir o lugar. Nunca entrega o nome verdadeiro."
          valor={rascunho.rumorLabel}
          aoMudar={trocar("rumorLabel")}
          placeholder="A vila das velas acesas"
          maxLength={120}
        />
        <AreaDeTexto
          id={`${idBase}-descricao`}
          label="Descrição pública"
          dica="O texto que os jogadores leem depois de chegar."
          valor={rascunho.description}
          aoMudar={trocar("description")}
          placeholder="Oitocentas almas de barro e cal na margem do Rio Ferrugem…"
          linhas={4}
        />
      </Bloco>

      {/* ── Segredo do mestre ─────────────────────────────────────── */}
      <Bloco titulo="🔒 Só o mestre vê">
        <AreaDeTexto
          id={`${idBase}-notas`}
          label="Notas do mestre"
          dica="Nunca sai daqui: este campo não é copiado para a mesa quando o lugar é revelado."
          valor={rascunho.gmNotes}
          aoMudar={trocar("gmNotes")}
          placeholder="Quem manda aqui, o que mente, e o que acontece se o grupo mexer nisso."
          linhas={5}
          perigoso
        />
      </Bloco>

      {/* ── Mecânica ──────────────────────────────────────────────── */}
      <Bloco titulo="Mecânica">
        {cenas.length > 0 ? (
          <Escolha
            id={`${idBase}-cena`}
            label="Cena tática vinculada"
            dica="Quando o grupo chegar, é esta mesa tática que abre."
            valor={rascunho.linkedSceneId || ""}
            aoMudar={trocar("linkedSceneId")}
            opcoes={[{ value: "", label: "— nenhuma —" }, ...cenas.map((c) => ({ value: c.id, label: c.name || c.id }))]}
          />
        ) : (
          <Texto
            id={`${idBase}-cena`}
            label="Cena tática vinculada"
            dica="Cole aqui o identificador da cena. A lista de cenas entra quando a mesa tática for ligada ao mapa."
            valor={rascunho.linkedSceneId}
            aoMudar={trocar("linkedSceneId")}
            placeholder="—"
            maxLength={64}
          />
        )}

        <Numero
          id={`${idBase}-raio`}
          label="Raio de revelação"
          dica={`Quanto de névoa abre ao chegar. Vazio usa o do mapa${
            Number.isFinite(raioPadraoDoMapa) ? ` (${raioPadraoDoMapa})` : ""}.`}
          valor={rascunho.revealRadius}
          aoMudar={trocar("revealRadius")}
          min={0}
          max={4000}
          passo={10}
          placeholder={Number.isFinite(raioPadraoDoMapa) ? String(raioPadraoDoMapa) : "—"}
          sufixo="unidades do mapa"
        />

        <Interruptor
          id={`${idBase}-viagem`}
          label="Viagem rápida"
          dica="O grupo pode voltar direto para cá depois de já ter estado aqui."
          marcado={rascunho.isFastTravel}
          aoMudar={trocar("isFastTravel")}
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
        <div style={{ display: "flex", gap: SP.x2, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="wme-focus" onClick={salvar} disabled={salvando || !sujo}
            style={{ ...btnStyle("primary", "sm"), opacity: (salvando || !sujo) ? 0.5 : 1 }}>
            {salvando ? "Salvando…" : "Salvar alterações"}
          </button>
          <button type="button" className="wme-focus" onClick={onRemover}
            style={{ ...btnStyle("danger", "sm") }}>
            Apagar lugar
          </button>
          {sujo ? (
            <span style={{ ...T.meta, fontSize: FS.micro }}>alterações ainda não salvas</span>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
