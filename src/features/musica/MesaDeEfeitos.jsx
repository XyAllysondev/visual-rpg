/* ════════════════════════════════════════════════════════════════════════
 *  MESA DE EFEITOS — interface
 *  ------------------------------------------------------------------------
 *  Botões de um toque que soam POR CIMA da trilha, sem pausá-la.
 *
 *  Por que não passa pelo player de música: o player tem fila, faixa atual e
 *  um único <audio>. Efeito não tem nada disso — ele precisa sobrepor. Cada
 *  disparo cria seu PRÓPRIO elemento de áudio, toca e se descarta, que é
 *  também o que permite dois efeitos soarem juntos (um grito por cima de um
 *  choro) sem um cortar o outro.
 *
 *  Detalhes que existem por causa da mesa ao vivo:
 *  · teclas 1-9 disparam os nove primeiros — o mestre não caça o mouse
 *  · "Parar tudo" (Esc) corta os disparos e NÃO encosta na música
 *  · o Blob de cada arquivo é criado uma vez e reaproveitado; sem isso o
 *    IndexedDB seria lido a cada clique e o efeito atrasaria
 * ════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from "react";
import { audioDBSave, audioDBGet, audioDBDelete } from "./audioDb";
import {
  SUGESTOES, adicionarEfeito, removerEfeito, renomearEfeito,
  definirVolume, nomeAmigavel, arquivosEmUso,
} from "./efeitos";
import { urlDoPacote, faltandoDoPacote } from "./pacoteInicial";

export default function MesaDeEfeitos({ efeitos, onMudar }) {
  const [editando, setEditando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef(null);

  const urlsRef = useRef({});           // fileId → objectURL (criado uma vez)
  const tocandoRef = useRef(new Set()); // <audio> vivos, para o "Parar tudo"

  /* Solta tudo ao desmontar: um objectURL não revogado segura o Blob inteiro
     na memória, e a tela de Trilhas fica montada a sessão toda. */
  useEffect(() => {
    const urls = urlsRef.current;
    const tocando = tocandoRef.current;
    return () => {
      tocando.forEach((a) => { a.pause(); });
      tocando.clear();
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const urlDe = async (fileId) => {
    if (urlsRef.current[fileId]) return urlsRef.current[fileId];
    const reg = await audioDBGet(fileId);
    if (!reg?.buf) return null;
    const url = URL.createObjectURL(new Blob([reg.buf]));
    urlsRef.current[fileId] = url;
    return url;
  };

  const disparar = async (efeito) => {
    try {
      const url = await urlDe(efeito.fileId);
      if (!url) { setErro(`O arquivo de "${efeito.nome}" não está mais na biblioteca.`); return; }
      const a = new Audio(url);
      a.volume = efeito.volume;
      tocandoRef.current.add(a);
      a.addEventListener("ended", () => tocandoRef.current.delete(a), { once: true });
      await a.play();
      setErro("");
    } catch (e) {
      setErro("Não deu para tocar o efeito: " + e.message);
    }
  };

  const pararTudo = () => {
    tocandoRef.current.forEach((a) => { a.pause(); a.currentTime = 0; });
    tocandoRef.current.clear();
  };

  /* Teclas 1-9 — só fora do modo de edição e nunca enquanto se digita.
     Sem lista de deps de propósito: o handler precisa enxergar o `efeitos`
     e o `editando` do render atual. */
  useEffect(() => {
    if (editando) return undefined;
    const aoTeclar = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const alvo = e.target?.tagName;
      if (alvo === "INPUT" || alvo === "TEXTAREA" || alvo === "SELECT" || e.target?.isContentEditable) return;
      if (e.key === "Escape") { pararTudo(); return; }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 9) return;
      const alvoEfeito = efeitos[n - 1];
      if (alvoEfeito) { e.preventDefault(); disparar(alvoEfeito); }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  });

  const importar = async (files) => {
    if (!files?.length) return;
    setImportando(true); setErro("");
    let lista = efeitos;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!/^audio\//.test(f.type) && !/\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(f.name)) continue;
        const fileId = `ef_${Date.now()}_${i}`;
        await audioDBSave(fileId, f.name, await f.arrayBuffer());
        lista = adicionarEfeito(lista, { id: fileId, fileId, nome: nomeAmigavel(f.name) });
      }
      onMudar(lista);
    } catch (e) {
      setErro("Falha ao importar: " + e.message);
    } finally {
      setImportando(false);
    }
  };

  /* Puxa as vozes que o app serve em `public/sfx/` para o IndexedDB do mestre.
     Depois de carregadas elas são efeitos comuns — renomeáveis, com volume
     próprio, apagáveis. O id fixo `pk_*` faz um segundo clique não duplicar. */
  const carregarPacote = async () => {
    const faltando = faltandoDoPacote(efeitos);
    if (faltando.length === 0) return;
    setImportando(true); setErro("");
    let lista = efeitos;
    const falhas = [];
    for (const item of faltando) {
      try {
        const r = await fetch(urlDoPacote(item.arquivo));
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await audioDBSave(item.id, item.arquivo, await r.arrayBuffer());
        lista = adicionarEfeito(lista, { id: item.id, fileId: item.id, nome: item.nome, volume: item.volume });
      } catch (e) {
        falhas.push(`${item.nome} (${e.message})`);
      }
    }
    onMudar(lista);
    setImportando(false);
    if (falhas.length) setErro(`Não deu para carregar: ${falhas.join(", ")}.`);
  };

  const apagar = async (efeito) => {
    const restante = removerEfeito(efeitos, efeito.id);
    /* Só apaga o binário se NENHUM outro efeito usar o mesmo arquivo. */
    if (!arquivosEmUso(restante).has(efeito.fileId)) {
      const u = urlsRef.current[efeito.fileId];
      if (u) { URL.revokeObjectURL(u); delete urlsRef.current[efeito.fileId]; }
      await audioDBDelete(efeito.fileId);
    }
    onMudar(restante);
  };

  const S = {
    grade: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 },
    botao: {
      display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start", textAlign: "left",
      width: "100%", padding: "12px 13px", borderRadius: 8, cursor: editando ? "default" : "pointer",
      background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)",
      transition: "border-color .15s, background .15s, transform .06s",
    },
    tecla: {
      fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "var(--muted)",
      border: "1px solid var(--border)", borderRadius: 3, padding: "0 4px", lineHeight: 1.5,
    },
    nome: {
      fontFamily: "Cinzel,serif", fontSize: 12.5, lineHeight: 1.25, flex: 1, minWidth: 0,
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    },
    campo: {
      width: "100%", padding: "4px 6px", fontSize: 12, borderRadius: 4,
      background: "rgba(0,0,0,0.35)", color: "var(--text)", border: "1px solid var(--border2)",
    },
    zona: {
      padding: "18px 14px", borderRadius: 8, marginBottom: 12, textAlign: "center",
      border: `1px dashed ${arrastando ? "var(--gold)" : "var(--border2)"}`,
      background: arrastando ? "rgba(201,168,76,0.06)" : "transparent",
      fontSize: 12.5, color: "var(--muted)",
    },
  };

  return (
    <section style={{ marginBottom: 22 }}>
      <div className="nx-sec">
        <span className="nx-sec-t">Mesa de efeitos · {efeitos.length}</span>
        <div style={{ display: "flex", gap: 14 }}>
          {faltandoDoPacote(efeitos).length > 0 && (
            <button className="nx-sec-a" onClick={carregarPacote} disabled={importando}
              style={{ color: "var(--gold)" }}
              title="Traz as vozes que já vêm com o Nexus para a sua mesa">
              {importando ? "Carregando…" : `Carregar ${faltandoDoPacote(efeitos).length} vozes`}
            </button>
          )}
          {efeitos.length > 0 && (
            <button className="nx-sec-a" onClick={pararTudo} title="Corta os efeitos; a música continua (Esc)">
              Parar tudo
            </button>
          )}
          <button className="nx-sec-a" onClick={() => setEditando((v) => !v)}>
            {editando ? "Concluir" : "Editar"}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, margin: "8px 0 12px", maxWidth: "62ch" }}>
        {editando
          ? "Renomeie, ajuste o volume de cada efeito ou remova. Dois botões podem usar o mesmo arquivo com volumes diferentes."
          : "Um clique dispara por cima da trilha, sem pausá-la. As teclas 1 a 9 acionam os nove primeiros; Esc corta todos."}
      </p>

      {editando && (
        <div
          style={S.zona}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); importar(e.dataTransfer.files); }}
        >
          <input ref={inputRef} type="file" multiple accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus"
            style={{ display: "none" }}
            onChange={(e) => { importar(e.target.files); e.target.value = ""; }} />
          {importando
            ? "Importando…"
            : <>Arraste arquivos de áudio aqui ou <button className="nx-sec-a" style={{ padding: 0 }} onClick={() => inputRef.current?.click()}>escolha do computador</button>.</>}
        </div>
      )}

      {erro && (
        <div style={{ padding: "8px 12px", borderRadius: 6, marginBottom: 10, fontSize: 12,
          background: "rgba(216,90,90,0.08)", border: "1px solid rgba(216,90,90,0.25)", color: "#e2a1a1" }}>
          {erro}
        </div>
      )}

      {efeitos.length === 0 ? (
        <div style={{ padding: "4px 0 8px" }}>
          <p style={{ fontSize: 13, color: "var(--muted2)", lineHeight: 1.6, marginBottom: 14, maxWidth: "62ch" }}>
            A mesa está vazia. Clique em <b>Carregar vozes</b> acima para trazer as oito falas que já
            vêm com o Nexus — criança, mulher gritando, sussurro, entidade e o rádio da Ordem. Para
            somar as suas, use <b>Editar</b>: o nome do arquivo já vira o rótulo do botão. O que
            costuma completar uma mesa de Ordem Paranormal:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>
            {SUGESTOES.map((g) => (
              <div key={g.grupo}>
                <div className="nx-sec-t" style={{ fontSize: 10, marginBottom: 5 }}>{g.grupo}</div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {g.itens.map((i) => (
                    <li key={i} style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={S.grade}>
          {efeitos.map((e, i) => {
            const extras = editando ? {} : {
              role: "button", tabIndex: 0, title: `Disparar ${e.nome}`,
              onClick: () => disparar(e),
              onMouseDown: (ev) => { ev.currentTarget.style.transform = "translateY(1px)"; },
              onMouseUp: (ev) => { ev.currentTarget.style.transform = "none"; },
              onKeyDown: (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); disparar(e); } },
            };
            return (
              <div key={e.id} style={S.botao}
                onMouseEnter={(ev) => { if (!editando) ev.currentTarget.style.borderColor = "var(--gold)"; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = "var(--border)"; ev.currentTarget.style.transform = "none"; }}
                {...extras}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
                  {!editando && i < 9 && <span style={S.tecla}>{i + 1}</span>}
                  {editando
                    ? <input style={S.campo} value={e.nome} aria-label={`Nome do efeito ${e.nome}`}
                        onChange={(ev) => onMudar(renomearEfeito(efeitos, e.id, ev.target.value))} />
                    : <span style={S.nome}>{e.nome}</span>}
                </div>

                {editando && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                    <input type="range" min="0" max="1" step="0.05" value={e.volume}
                      aria-label={`Volume de ${e.nome}`} style={{ flex: 1, padding: 0 }}
                      onChange={(ev) => onMudar(definirVolume(efeitos, e.id, ev.target.value))} />
                    <span style={{ ...S.tecla, border: "none" }}>{Math.round(e.volume * 100)}%</span>
                    <button className="nx-sec-a" style={{ padding: 0, color: "#c98a8a" }}
                      onClick={() => apagar(e)} title="Remover este efeito">remover</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
