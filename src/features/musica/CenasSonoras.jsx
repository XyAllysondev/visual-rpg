/* ════════════════════════════════════════════════════════════════════════
 *  TIRA DE CENAS SONORAS
 *  ------------------------------------------------------------------------
 *  A parte da tela de Trilhas feita para ser usada COM A MESA RODANDO: oito
 *  botões, um por tipo de cena de Ordem Paranormal, cada um ligado a uma
 *  playlist que o mestre já montou. Um clique troca a trilha.
 *
 *  Duas decisões que valem explicar:
 *
 *  · O modo de edição é separado do de tocar. Com a mesa rodando, um clique
 *    errado não pode reconfigurar nada — fora do modo edição, clicar SÓ toca.
 *  · Cena sem trilha continua na tira, apagada. Sumindo, ninguém aprende que
 *    ela existe; visível e vazia, ela convida a vincular.
 * ════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { montarTira, contarVinculadas, CENAS_OP } from "./cenas";
import { localAccent } from "./musicaUtils";

const NOME_SVC = { local: "Local", youtube: "YouTube", spotify: "Spotify" };

export default function CenasSonoras({
  vinculos,
  playlistsPorServico = {},
  nowPlaying,
  onTocar,
  onVincular,
  onDesvincular,
}) {
  const [editando, setEditando] = useState(false);
  const tira = montarTira(vinculos, playlistsPorServico, nowPlaying);
  const vinculadas = contarVinculadas(vinculos);

  /* Todas as playlists dos três serviços numa lista só, com o serviço junto:
     o mestre pensa "a playlist do combate", não "a playlist local do combate". */
  const todas = ["local", "youtube", "spotify"].flatMap((svc) =>
    (playlistsPorServico[svc] || []).map((p) => ({
      svc,
      id: String(p.id),
      name: p.name || p.snippet?.title || "Sem nome",
    })),
  );

  const S = {
    grade: {
      display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(178px,1fr))", gap: 8,
    },
    chip: (c) => ({
      display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start",
      padding: "11px 13px", borderRadius: 8, textAlign: "left", width: "100%",
      cursor: editando ? "default" : c.disponivel ? "pointer" : "default",
      background: c.tocando ? "rgba(201,168,76,0.12)" : "var(--card)",
      border: `1px solid ${c.tocando ? "var(--gold)" : "var(--border)"}`,
      opacity: c.vinculo ? 1 : 0.55,
      transition: "border-color .18s, background .18s, opacity .18s",
    }),
    topo: { display: "flex", alignItems: "center", gap: 7, width: "100%" },
    icone: (c) => ({
      fontSize: 13, lineHeight: 1, flexShrink: 0,
      color: c.tocando ? "var(--gold)" : c.vinculo ? localAccent(c.vinculo.playlistName) : "var(--muted)",
    }),
    nome: {
      fontFamily: "Cinzel,serif", fontSize: 12.5, color: "var(--text)", letterSpacing: "0.02em",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
    },
    trilha: (ok) => ({
      fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, lineHeight: 1.35,
      color: ok ? "var(--muted2)" : "#c98a8a",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%",
    }),
    vazio: {
      fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5,
      color: "var(--muted)", fontStyle: "italic",
    },
    select: {
      width: "100%", padding: "5px 7px", fontSize: 12, borderRadius: 4,
      background: "rgba(0,0,0,0.35)", color: "var(--text)",
      border: "1px solid var(--border2)", cursor: "pointer",
    },
    ondaTocando: {
      display: "inline-block", width: 5, height: 5, borderRadius: "50%",
      background: "var(--gold)", flexShrink: 0,
    },
  };

  return (
    <section style={{ marginBottom: 22 }}>
      <div className="nx-sec">
        <span className="nx-sec-t">
          Cenas da mesa · {vinculadas}/{CENAS_OP.length}
        </span>
        <button className="nx-sec-a" onClick={() => setEditando((v) => !v)}>
          {editando ? "Concluir" : "Vincular trilhas"}
        </button>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, margin: "8px 0 12px", maxWidth: "62ch" }}>
        {editando
          ? "Escolha qual playlist toca em cada momento da sessão. Uma mesma playlist pode servir a mais de uma cena."
          : "Com a mesa rodando, um clique troca a trilha. Nada aqui reconfigura sem entrar em “Vincular trilhas”."}
      </p>

      {todas.length === 0 && editando && (
        <div style={{ ...S.trilha(true), color: "var(--muted)", marginBottom: 12 }}>
          Você ainda não tem nenhuma playlist. Importe MP3 na aba Local ou conecte YouTube/Spotify.
        </div>
      )}

      <div style={S.grade}>
        {tira.map((c) => {
          const podeTocar = !editando && c.disponivel;
          const extras = podeTocar
            ? {
                role: "button",
                tabIndex: 0,
                title: `Tocar ${c.vinculo.playlistName}`,
                onKeyDown: (e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTocar?.(c.vinculo); }
                },
              }
            : {};
          return (
            <div
              key={c.id}
              style={S.chip(c)}
              onClick={() => podeTocar && onTocar?.(c.vinculo)}
              onMouseEnter={(e) => { if (podeTocar && !c.tocando) e.currentTarget.style.borderColor = "var(--border2)"; }}
              onMouseLeave={(e) => { if (!c.tocando) e.currentTarget.style.borderColor = "var(--border)"; }}
              {...extras}
            >
              <div style={S.topo}>
                <span aria-hidden="true" style={S.icone(c)}>{c.icone}</span>
                <span style={S.nome}>{c.nome}</span>
                {c.tocando && <span style={S.ondaTocando} aria-label="tocando agora" />}
              </div>

              {editando ? (
                <>
                  <select
                    aria-label={`Trilha da cena ${c.nome}`}
                    style={S.select}
                    value={c.vinculo ? `${c.vinculo.svc}:${c.vinculo.playlistId}` : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) { onDesvincular?.(c.id); return; }
                      const [svc, ...resto] = val.split(":");
                      const id = resto.join(":");           // id do YouTube pode conter ":"
                      const alvo = todas.find((p) => p.svc === svc && p.id === id);
                      if (alvo) onVincular?.(c.id, alvo);
                    }}
                  >
                    <option value="">— sem trilha —</option>
                    {todas.map((p) => (
                      <option key={`${p.svc}:${p.id}`} value={`${p.svc}:${p.id}`}>
                        {p.name} ({NOME_SVC[p.svc]})
                      </option>
                    ))}
                  </select>
                  <span style={{ ...S.vazio, fontStyle: "normal" }}>{c.desc}</span>
                </>
              ) : c.vinculo ? (
                <span style={S.trilha(c.disponivel)}>
                  {c.disponivel ? c.vinculo.playlistName : `⚠ ${c.vinculo.playlistName} — playlist removida`}
                </span>
              ) : (
                <span style={S.vazio}>sem trilha</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
