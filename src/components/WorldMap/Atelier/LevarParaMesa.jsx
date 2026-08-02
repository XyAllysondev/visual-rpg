/* ════════════════════════════════════════════════════════════════════
 *  ATELIÊ → MESA  (spec 0028 · F4 · AC-7)
 *  --------------------------------------------------------------------
 *  O botão que fecha o ciclo do design §2: *"Levar para a mesa →", que
 *  publica o molde numa campanha*.
 *
 *  O que ele NÃO faz, e é o ponto inteiro: não copia o molde. Cria uma
 *  instância vazia de revelações, com o grupo no nó inicial e a névoa
 *  fechada. Tudo que o jogador vai ver nasce depois, no ato da revelação
 *  (AC-1). Quem faz isso é o `mesaStore` — esta tela só escolhe a mesa e
 *  conta o que aconteceu, em português.
 *
 *  A lista de campanhas vem de `useCampanhasDoMestre` e não de uma prop:
 *  o Ateliê é montado pelo `App.jsx` com `uid` e `plan` apenas, e passar a
 *  lista de campanhas por ali obrigaria a mexer no `App.jsx` só para
 *  desenhar um seletor. A prop `campanhas` existe para quando o `App.jsx`
 *  já tiver a lista em mãos — aí ela vence e nenhuma leitura extra acontece.
 * ════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { levarParaMesa, sincronizarMolde, useCampanhasDoMestre } from "../mesaStore";
import { SP, R, FS, T, SURF, LINE, HIT, btnStyle, mensagemDeErro, DANGER_TEXT_AA } from "./ui";

/**
 * @param {object} props
 * @param {string} props.uid mestre dono do molde.
 * @param {object} props.molde molde aberto.
 * @param {Array} [props.campanhas] lista pronta, quando quem monta já a tem.
 */
export default function LevarParaMesa({ uid, molde, campanhas }) {
  const prontas = Array.isArray(campanhas) ? campanhas : null;

  /* A lista só é assinada quando o mestre ABRE o painel. Não é economia de
     bytes: é não pendurar um listener de campanhas em toda abertura de molde,
     no ateliê, onde 9 em cada 10 visitas são para desenhar o mapa e não para
     publicá-lo. Quem já recebeu `campanhas` por prop não assina nada nunca. */
  const [aberto, setAberto] = useState(false);
  const { campanhas: doHook, loading, error } = useCampanhasDoMestre(
    prontas || !aberto ? "" : uid,
  );

  const mesas = useMemo(() => {
    const todas = prontas || doHook || [];
    return todas.filter((c) => c && c.id && c.isActive !== false);
  }, [prontas, doHook]);

  const [ocupado, setOcupado] = useState("");   // id da campanha em andamento
  const [aviso, setAviso] = useState("");
  const [falha, setFalha] = useState("");

  const moldeId = molde?.id;

  const levar = async (campanha) => {
    if (!uid || !moldeId || ocupado) return;
    setAviso("");
    setFalha("");
    setOcupado(campanha.id);
    try {
      await levarParaMesa(uid, moldeId, campanha.id);
      setAviso(
        `"${molde?.name || "O mapa"}" está na mesa de ${campanha.name || "sua campanha"}. `
        + "O grupo começa no lugar inicial, com a névoa fechada e nada revelado — "
        + "você revela conforme eles chegarem.",
      );
    } catch (err) {
      console.error("[ateliê] levar para a mesa falhou:", err);
      setFalha(mensagemDeErro(err));
    } finally {
      setOcupado("");
    }
  };

  const sincronizar = async (campanha) => {
    if (!uid || !moldeId || ocupado) return;
    setAviso("");
    setFalha("");
    setOcupado(campanha.id);
    try {
      const { atualizados, orfaos } = await sincronizarMolde(uid, moldeId, campanha.id);
      setAviso(
        `Mesa de ${campanha.name || "sua campanha"} sincronizada: ${atualizados} `
        + `${atualizados === 1 ? "lugar atualizado" : "lugares atualizados"}. `
        + "Nada do que o grupo já descobriu foi desfeito"
        + (orfaos > 0
          ? ` — e ${orfaos} ${orfaos === 1 ? "lugar que você apagou continua" : "lugares que você apagou continuam"} na mesa, porque já eram do grupo.`
          : "."),
      );
    } catch (err) {
      console.error("[ateliê] sincronizar a mesa falhou:", err);
      setFalha(mensagemDeErro(err));
    } finally {
      setOcupado("");
    }
  };

  return (
    <div style={{
      background: SURF.rail, border: `1px solid ${LINE.edge}`,
      borderRadius: R.panel, padding: SP.x5,
    }}>
      <h3 style={{ ...T.section, margin: `0 0 ${SP.x2}px` }}>Levar para a mesa</h3>
      <p style={{ ...T.meta, margin: `0 0 ${SP.x4}px`, maxWidth: "62ch" }}>
        Publica este mapa numa campanha sua. O grupo entra no lugar inicial, com a névoa
        fechada e <strong>nada revelado</strong> — seus segredos continuam só aqui no ateliê.
        O mesmo mapa em duas mesas guarda dois progressos separados.
      </p>

      {!aberto && !prontas ? (
        <button type="button" className="wm-focus" onClick={() => setAberto(true)}
          style={{ ...btnStyle("primary", "sm"), minHeight: HIT.mobile }}>
          Escolher a mesa →
        </button>
      ) : null}

      {loading && !prontas ? (
        <div style={{ ...T.meta, fontSize: FS.micro }}>Procurando suas mesas…</div>
      ) : null}

      {/* `status` e não `alert`: falhar ao LISTAR não é a falha de uma ação que
          o mestre pediu — é um aviso do estado da tela. */}
      {error && !prontas ? (
        <div role="status" style={{ ...T.meta, fontSize: FS.micro }}>
          Não deu para listar suas campanhas agora. {mensagemDeErro(error)}
        </div>
      ) : null}

      {(aberto || prontas) && !loading && mesas.length === 0 ? (
        <div style={{ ...T.meta, fontSize: FS.micro, maxWidth: "56ch" }}>
          Você ainda não é mestre de nenhuma campanha ativa. Crie uma campanha para poder
          levar este mapa até ela.
        </div>
      ) : null}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: SP.x2 }}>
        {mesas.map((c) => (
          <li key={c.id} style={{
            display: "flex", alignItems: "center", gap: SP.x3, flexWrap: "wrap",
            padding: SP.x3, borderRadius: R.card,
            background: SURF.card, border: `1px solid ${LINE.hair}`,
          }}>
            <span style={{ ...T.cardTitle, flex: "1 1 180px", minWidth: 0 }}>
              {c.name || "Campanha sem nome"}
            </span>
            <button
              type="button" className="wm-focus" onClick={() => levar(c)}
              disabled={!!ocupado}
              aria-label={`Levar ${molde?.name || "este mapa"} para a mesa de ${c.name || "campanha sem nome"}`}
              style={{ ...btnStyle("primary", "sm"), minHeight: HIT.mobile, opacity: ocupado ? 0.6 : 1 }}
            >
              {ocupado === c.id ? "Levando…" : "Levar para a mesa →"}
            </button>
            <button
              type="button" className="wm-focus" onClick={() => sincronizar(c)}
              disabled={!!ocupado}
              aria-label={`Sincronizar a mesa de ${c.name || "campanha sem nome"} com este mapa`}
              style={{ ...btnStyle("ghost", "sm"), minHeight: HIT.mobile }}
            >
              Sincronizar
            </button>
          </li>
        ))}
      </ul>

      {falha ? (
        <div role="alert" style={{
          marginTop: SP.x3, padding: SP.x3, borderRadius: R.card,
          background: "rgba(139,26,26,0.10)", border: "1px solid rgba(216,90,90,0.34)",
          ...T.meta, color: "var(--text)",
        }}>
          <strong style={{ color: DANGER_TEXT_AA }}>Não deu certo. </strong>{falha}
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
  );
}
