/* ════════════════════════════════════════════════════════════════════════
 *  PAINEL — a primeira tela depois do login
 *  ------------------------------------------------------------------------
 *  Substitui o antigo `Dashboard` que morava dentro do App.jsx (redesenho
 *  visual pedido pelo Andre em 2026-08-05). O que mudou de fato:
 *
 *   · HERO ATMOSFÉRICO — aurora à deriva, grão de filme, brasas subindo e
 *     uma varredura de luz. Tudo em CSS (ver `painelStyles.jsx`), nenhum
 *     loop de JS pintando frame.
 *   · RETOMAR — a linha "continuar de onde parou", que é o motivo real de
 *     alguém abrir esta tela.
 *   · PRECISA DE VOCÊ — o que está esperando uma ação sua AGORA (vaga
 *     aberta na mesa, cota estourada, nenhum agente criado).
 *   · NÚMEROS — contagem animada, cota com medidor e algarismo-fantasma.
 *   · CAMPANHAS — capa de verdade, com zoom e brilho no hover.
 *   · PREPARO DO MUNDO — anel de progresso + checklist que sai do estado
 *     REAL (fichas, campanhas, mapas do Ateliê, mundos da Forja).
 *
 *  REGRA QUE NÃO SE QUEBRA: nada aqui é número decorativo. Todo valor sai
 *  de estado real — props do App ou uma leitura de repositório. Um painel
 *  com contador inventado parece dado e não é; é o pior defeito possível
 *  numa tela de resumo. Se um dado não existe, o bloco não aparece.
 * ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import PainelStyles from "./painelStyles";
import DossierCard from "../systems/OrdemParanormal/DossierCard";
import { getActiveAvatar } from "../../domain/character";
import { isActiveCampaign } from "../../domain/campaign";
import { useLocale } from "../../i18n/useLocale";
import { contarMapas } from "../../infrastructure/firestore/worldMapsRepo";
import { watchWorldsByOwner } from "../../infrastructure/firestore/worldsRepo";
import { DEMO_ON, CONTAGENS_DEMO } from "../../demo/demoMode";

/* Teto de mesas que um mestre pode manter ativas — o MESMO número que a tela
   de Campanhas mostra (App.jsx, CampaignList). Não é constante nova. */
const COTA_MESTRE = 3;
const LOTACAO_PADRAO = 6;

const semMovimento = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── Contagem animada ────────────────────────────────────────────────────
   Sobe de 0 até o valor com desaceleração cúbica. Com movimento reduzido
   (ou valor zero) escreve o número direto — sem animação pendurada. */
function useContagem(alvo) {
  const fim = Number(alvo) || 0;
  /* Começa em 0 DE PROPÓSITO: é o primeiro efeito, com `anterior` ainda em 0,
     que dispara a subida na montagem. Iniciar o estado no valor final mataria
     a animação justamente na única vez em que ela importa. */
  const [n, setN] = useState(0);
  const anterior = useRef(0);

  useEffect(() => {
    if (fim === anterior.current) return;          // nada mudou: não re-anima
    if (fim <= 0 || semMovimento()) { anterior.current = fim; setN(fim); return; }
    const inicio = anterior.current;
    anterior.current = fim;
    const dur = Math.min(950, 300 + Math.abs(fim - inicio) * 110);
    let raf, t0 = null;
    const passo = (t) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(inicio + (fim - inicio) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [fim]);

  return n;
}

/* ── Estado do preparo que NÃO chega por props ───────────────────────────
   Mapas do Ateliê e mundos da Forja moram em coleções próprias. São duas
   leituras baratas: uma contagem única e um listener de uma coleção pequena.
   `null` = ainda carregando — o passo fica neutro, nunca "não feito" por
   engano (marcar como pendente algo que já existe é pior que esperar). */
function usePreparo(uid) {
  const [mapas, setMapas] = useState(null);
  const [mundos, setMundos] = useState(null);

  useEffect(() => {
    /* Demo: as contagens vêm do módulo de demonstração. Sem isso as duas
       leituras bateriam no Firestore sem credencial e voltariam zeradas —
       o preparo do mundo mentiria dizendo que nada foi feito. */
    if (DEMO_ON) { setMapas(CONTAGENS_DEMO.mapas); setMundos(CONTAGENS_DEMO.mundos); return undefined; }
    if (!uid) { setMapas(0); setMundos(0); return undefined; }
    let vivo = true;
    contarMapas(uid)
      .then((n) => { if (vivo) setMapas(n); })
      .catch(() => { if (vivo) setMapas(0); });
    const parar = watchWorldsByOwner(
      uid,
      (lista) => { if (vivo) setMundos(lista.length); },
      () => { if (vivo) setMundos(0); },
    );
    return () => { vivo = false; if (typeof parar === "function") parar(); };
  }, [uid]);

  return { mapas, mundos };
}

/* ── Ícones ──────────────────────────────────────────────────────────────
   Traço de 1.5, 24×24, `currentColor`: herdam a cor de quem os contém, que
   é o que deixa o hover acender o ícone junto com a linha. */
const Svg = ({ s = 24, children }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const IcoSeta   = ({ s }) => <Svg s={s}><path d="M5 12h13M13 6l6 6-6 6" /></Svg>;
const IcoPlay   = ({ s }) => <Svg s={s}><path d="M8 5.5v13l11-6.5z" /></Svg>;
const IcoForja  = ({ s }) => <Svg s={s}><path d="M12 3l1.9 4.6 4.6 1.9-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM18 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" /></Svg>;
const IcoMapa   = ({ s }) => <Svg s={s}><path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13" /></Svg>;
const IcoTrilha = ({ s }) => <Svg s={s}><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></Svg>;
const IcoMesa   = ({ s }) => <Svg s={s}><path d="M17 20v-1.5a4 4 0 00-4-4H6a4 4 0 00-4 4V20" /><circle cx="9.5" cy="7" r="3.5" /><path d="M22 20v-1.5a4 4 0 00-3-3.9M16 3.6a4 4 0 010 7" /></Svg>;
const IcoFicha  = ({ s }) => <Svg s={s}><path d="M6 2.5h8l4.5 4.5v14.5H6zM14 2.5V7h4.5M9 13h6M9 17h4" /></Svg>;
const Certo     = ({ atraso = 0 }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path className="px-check" style={{ "--d": `${atraso}s` }} d="M4 12.5l5.5 5.5L20 6.5" />
  </svg>
);

const FERRAMENTAS = [
  { id: "master", t: "Ajudante do Mestre", d: "Wiki, grafo e diário do seu mundo", Ico: IcoForja },
  { id: "map",    t: "Mapas",              d: "Mesas táticas e mapas-múndi",        Ico: IcoMapa },
  { id: "music",  t: "Trilhas Sonoras",    d: "Ambientação para cada cena",         Ico: IcoTrilha },
];

/* ── Esfera armilar ──────────────────────────────────────────────────────
   Três anéis concêntricos girando em velocidades diferentes, com marcas de
   graduação e um núcleo em brasa. É o mecanismo de latão da abertura de
   Game of Thrones — o único elemento puramente decorativo desta tela, e por
   isso fica atrás do texto, recortado pela borda e em opacidade baixa.

   As marcas são geradas por índice (nada de aleatório) e o SVG inteiro é
   `aria-hidden`: para quem lê a tela por leitor de tela, isto não existe. */
const marcas = (qtd, raio, comprimento) =>
  Array.from({ length: qtd }, (_, i) => {
    const a = (i * 2 * Math.PI) / qtd;
    const cos = Math.cos(a); const sen = Math.sin(a);
    return {
      k: i,
      x1: 260 + cos * raio, y1: 260 + sen * raio,
      x2: 260 + cos * (raio + comprimento), y2: 260 + sen * (raio + comprimento),
    };
  });

function Armila() {
  const OURO = "var(--gold)";
  return (
    <div className="px-armila" aria-hidden="true">
      <svg viewBox="0 0 520 520" fill="none">
        {/* anel externo — graduação fina, giro lentíssimo */}
        <g className="px-anel px-anel-1" stroke={OURO} strokeWidth="1" opacity="0.55">
          <circle cx="260" cy="260" r="238" />
          <circle cx="260" cy="260" r="228" opacity="0.5" />
          {marcas(72, 228, 10).map((m) => (
            <line key={m.k} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} opacity={m.k % 6 === 0 ? 1 : 0.4} />
          ))}
        </g>
        {/* anel médio — banda orbital inclinada, giro contrário */}
        <g className="px-anel px-anel-2" stroke={OURO} strokeWidth="1.2" opacity="0.5">
          <ellipse cx="260" cy="260" rx="186" ry="72" />
          <ellipse cx="260" cy="260" rx="186" ry="72" transform="rotate(60 260 260)" />
          <ellipse cx="260" cy="260" rx="186" ry="72" transform="rotate(120 260 260)" />
        </g>
        {/* anel interno — dentes de engrenagem */}
        <g className="px-anel px-anel-3" stroke={OURO} strokeWidth="1.4" opacity="0.65">
          <circle cx="260" cy="260" r="118" />
          {marcas(24, 118, 14).map((m) => (
            <line key={m.k} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />
          ))}
        </g>
        {/* núcleo em brasa */}
        <circle className="px-nucleo" cx="260" cy="260" r="52"
          fill="var(--brasao)" opacity="0.5" style={{ filter: "blur(26px)" }} />
        <circle cx="260" cy="260" r="26" stroke={OURO} strokeWidth="1" opacity="0.6" />
      </svg>
    </div>
  );
}

/* ── Anel de progresso ───────────────────────────────────────────────────*/
function Anel({ feitos, total }) {
  const raio = 26;
  const volta = 2 * Math.PI * raio;
  const parte = total > 0 ? feitos / total : 0;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="32" cy="32" r={raio} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      {/* Ouro, não o brasão: o anel é PROGRESSO, e progresso é da família do
          clique (o passo seguinte é clicável logo abaixo). Carmesim aqui
          faria o preparo do mundo parecer um alerta. */}
      <circle
        className="px-ring-v" cx="32" cy="32" r={raio} fill="none"
        stroke="var(--gold)" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={volta}
        style={{ "--c": volta, "--o": volta * (1 - parte) }}
      />
      <text x="32" y="36" textAnchor="middle" fill="var(--text)"
        fontFamily="'IBM Plex Mono',monospace" fontSize="14">{feitos}</text>
    </svg>
  );
}

/* ── Bloco de número ─────────────────────────────────────────────────────*/
function Numero({ valor, teto, legenda, dica, onClick, atraso }) {
  const n = useContagem(valor);
  const pct = teto ? Math.min(100, Math.round((valor / teto) * 100)) : 0;
  return (
    <button type="button" className="px-stat px-in" title={dica} onClick={onClick}
      style={{ "--d": `${atraso}s` }}>
      <span className="px-stat-ghost" aria-hidden="true">{valor}</span>
      <span className="px-stat-num">
        {n}{teto ? <span className="px-stat-den">/{teto}</span> : null}
      </span>
      <span className="px-stat-cap">{legenda}</span>
      {teto ? (
        <span className="px-meter"><i style={{ "--w": `${pct}%` }} /></span>
      ) : null}
    </button>
  );
}

/**
 * Painel do sistema ativo.
 * @param {{system:object, characters:Array, campaigns:Array, sessions:Array,
 *          uid:string, userPlans:Array<string>, onCreateChar:Function,
 *          onSelectChar:Function, onNav:Function, onOpenCampaign:Function,
 *          onShowUpgrade:Function}} props
 */
export default function Painel({
  system, characters = [], campaigns = [], sessions = [], uid = "",
  userPlans = [], onCreateChar, onSelectChar, onNav, onOpenCampaign, onShowUpgrade,
}) {
  const { t: sT } = useLocale();
  const acento = system?.accent || "var(--gold)";
  const brilho = system?.accentGlow || "rgba(201,168,76,0.32)";

  const assinante = userPlans.includes(system?.id);
  const cotaFichas = assinante ? 5 : 1;

  /* Fichas deste sistema. Ficha antiga sem `systemId` é de OP (regra que já
     existia no App — não inventar outra aqui). */
  const fichas = useMemo(
    () => characters.filter((c) => c.systemId === system?.id || (!c.systemId && system?.id === "op")),
    [characters, system?.id],
  );
  const noLimite = fichas.length >= cotaFichas;

  const ativas    = useMemo(() => campaigns.filter(isActiveCampaign), [campaigns]);
  const mestrando = useMemo(() => ativas.filter((c) => c.masterId === uid), [ativas, uid]);
  const jogando   = ativas.length - mestrando.length;

  const { mapas, mundos } = usePreparo(uid);

  /* ── Preparo: 4 passos, todos verificáveis ───────────────────────────── */
  const passos = [
    { id: "ficha", label: "Criar sua primeira ficha",     feito: fichas.length > 0,   ir: onCreateChar },
    { id: "mesa",  label: "Criar ou entrar numa campanha", feito: campaigns.length > 0, ir: () => onNav?.("party") },
    { id: "mapa",  label: "Desenhar um mapa",              feito: (mapas ?? 0) > 0,     ir: () => onNav?.("map") },
    { id: "mundo", label: "Montar seu mundo na Forja",     feito: (mundos ?? 0) > 0,    ir: () => onNav?.("master") },
  ];
  const feitos = passos.filter((p) => p.feito).length;
  const preparoAberto = feitos < passos.length;

  /* ── Retomar ─────────────────────────────────────────────────────────────
     A ficha mais recente. `id` é epoch-ms desde sempre (App carimba
     `Date.now()` na criação); fichas legadas sem `id` caem no fim da ordem.
     Sem ficha, o retomar aponta para a mesa mais recente. Sem nenhum dos
     dois, a faixa não existe — não há de onde retomar. */
  const retomar = useMemo(() => {
    const ultima = [...fichas].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0];
    if (ultima) {
      return {
        tipo: "ficha",
        titulo: ultima.form?.personagem || "Sem nome",
        meta: [ultima.classe?.name, ultima.origem?.name, `NEX ${ultima.nex ?? 5}%`].filter(Boolean).join(" · "),
        ir: () => onSelectChar?.(ultima),
      };
    }
    const mesa = ativas[0];
    if (mesa) {
      return {
        tipo: "campanha",
        titulo: mesa.name,
        meta: `campanha · ${mesa.members?.length || 0}/${mesa.maxPlayers || LOTACAO_PADRAO} agentes`,
        ir: () => onOpenCampaign?.(mesa),
      };
    }
    return null;
  }, [fichas, ativas, onSelectChar, onOpenCampaign]);

  /* ── Precisa de você ─────────────────────────────────────────────────────
     Só entra o que tem ação e sai de estado real. Máximo de três — a quarta
     linha já não é urgência, é lista. */
  const pendencias = useMemo(() => {
    const lista = [];
    mestrando.forEach((c) => {
      const vagas = (c.maxPlayers || LOTACAO_PADRAO) - (c.members?.length || 0);
      if (vagas > 0) {
        lista.push({
          id: `vaga-${c.id}`, vivo: true,
          texto: <>“{c.name}” tem <b style={{ color: "var(--gold2)", fontWeight: 400 }}>{vagas}</b> {vagas === 1 ? "vaga aberta" : "vagas abertas"}</>,
          acao: "Convidar", ir: () => onOpenCampaign?.(c),
        });
      }
    });
    if (noLimite && !assinante) {
      lista.push({
        id: "cota", vivo: true,
        texto: <>Você atingiu o limite de {cotaFichas} {cotaFichas === 1 ? "ficha" : "fichas"} do plano livre</>,
        acao: "Ver planos", ir: () => onShowUpgrade?.(),
      });
    }
    if (fichas.length === 0) {
      lista.push({
        id: "sem-ficha", vivo: false,
        texto: <>Nenhum agente registrado em {system?.name || "este sistema"}</>,
        acao: "Criar", ir: () => onCreateChar?.(),
      });
    }
    return lista.slice(0, 3);
  }, [mestrando, noLimite, assinante, cotaFichas, fichas.length, system?.name,
      onOpenCampaign, onShowUpgrade, onCreateChar]);

  const hora = new Date().getHours();
  const saudacao = hora < 5 ? "Boa madrugada" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  /* Brasas: posição/duração fixas por índice — nada de Math.random(), que
     re-sortearia a cada render e faria as partículas pularem. */
  const brasas = [7, 16, 24, 33, 41, 49, 57, 63, 71, 79, 86, 93];

  const abrirCampanhas = () => onNav?.("party");

  return (
    <div className="px fade" style={{ "--px-accent": acento, "--px-glow": brilho }}>
      <PainelStyles />

      {/* ══ HERO ══════════════════════════════════════════════════════════ */}
      <header className="px-hero px-in" style={{ "--d": "0s" }}>
        {["tl", "tr", "bl", "br"].map((c) => (
          <span key={c} className={`px-hero-canto ${c}`} aria-hidden="true" />
        ))}
        <Armila />
        <div className="px-aura" aria-hidden="true">
          <i style={{ right: "4%", top: "18%", width: 440, height: 440, background: acento, opacity: 0.42 }} />
          <i style={{ left: "6%",  top: "8%",  width: 360, height: 360, background: "var(--gold)", opacity: 0.26, animationDelay: "-11s" }} />
          <i style={{ left: "40%", top: "64%", width: 300, height: 300, background: acento, opacity: 0.18, animationDelay: "-19s" }} />
        </div>
        <div className="px-grao" aria-hidden="true" />
        <div className="px-motes" aria-hidden="true">
          {brasas.map((esq, i) => (
            <span key={esq} style={{
              left: `${esq}%`,
              animationDuration: `${10 + (i % 5) * 3}s`,
              animationDelay: `${-(i * 1.9)}s`,
              background: i % 3 === 0 ? acento : "var(--gold2)",
            }} />
          ))}
        </div>

        <div className="px-eyebrow">{sT("dashboard.welcome")} · {saudacao}</div>
        <h1 className="px-title">Painel</h1>
        {system?.desc ? <p className="px-sub">{system.desc}</p> : null}

        <div className="px-orn" aria-hidden="true"><i /><b>◈</b><i /></div>

        <div className="px-hero-act">
          <span className={`px-plan${assinante ? " on" : ""}`}
            title={assinante ? "Assinante deste sistema" : "Plano gratuito"}>
            {assinante ? "✦ Pro" : "Livre"}
          </span>
          {/* Três estados e só UM é beco sem saída — a regra do painel antigo
              continua valendo: cota cheia SEM assinar aponta para os planos e
              precisa parecer clicável, porque é a saída. */}
          {(() => {
            const inerte = noLimite && assinante;
            return (
              <button type="button" className="px-cta" disabled={inerte}
                onClick={() => { if (inerte) return; if (noLimite) onShowUpgrade?.(); else onCreateChar?.(); }}
                title={noLimite
                  ? (assinante ? `Limite de ${cotaFichas} fichas atingido` : "Assine este sistema para criar mais fichas")
                  : "Criar uma ficha nova"}>
                {noLimite ? (assinante ? `Limite ${cotaFichas}/${cotaFichas}` : "Ver planos") : "+ Nova ficha"}
              </button>
            );
          })()}
        </div>
      </header>

      {/* ══ RETOMAR ═══════════════════════════════════════════════════════ */}
      {retomar ? (
        <button type="button" className="px-resume px-in" style={{ "--d": ".08s" }} onClick={retomar.ir}>
          <span className="px-sigil" aria-hidden="true"><IcoPlay s={18} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="px-resume-cap" style={{ display: "block" }}>Continuar de onde parou</span>
            <span className="px-resume-t" style={{ display: "block" }}>{retomar.titulo}</span>
            <span className="px-resume-m" style={{ display: "block" }}>{retomar.meta}</span>
          </span>
          <span className="px-go" aria-hidden="true"><IcoSeta s={20} /></span>
        </button>
      ) : null}

      {/* ══ PRECISA DE VOCÊ ═══════════════════════════════════════════════ */}
      {pendencias.length > 0 ? (
        <section aria-labelledby="px-pend" className="px-in" style={{ "--d": ".14s" }}>
          {/* Sem contador à direita: esta seção ocupa a largura inteira, e um
              algarismo sozinho a 1500px do rótulo é ruído — as linhas abaixo
              já são contáveis a olho (o teto é três). O "3/4" do preparo fica
              porque lá a coluna é estreita e a fração diz o que falta. */}
          <div className="px-sec">
            <span className="px-sec-t" id="px-pend">Precisa de você</span>
          </div>
          {pendencias.map((p) => (
            <button type="button" key={p.id} className="px-alert" onClick={p.ir}>
              <span className={`px-dot${p.vivo ? "" : " idle"}`} aria-hidden="true" />
              <span className="px-alert-t">{p.texto}</span>
              <span className="px-alert-a">{p.acao}</span>
              <span className="px-go" aria-hidden="true"><IcoSeta s={16} /></span>
            </button>
          ))}
        </section>
      ) : null}

      {/* ══ NÚMEROS ═══════════════════════════════════════════════════════ */}
      <div className="px-stats">
        <Numero valor={fichas.length} teto={cotaFichas} legenda="Fichas" atraso={0.18}
          dica="Ver todas as fichas" onClick={() => onNav?.("sheet")} />
        <Numero valor={mestrando.length} teto={COTA_MESTRE} legenda="Como mestre" atraso={0.24}
          dica="Mesas ativas que você mestra" onClick={abrirCampanhas} />
        <Numero valor={jogando} legenda="Como jogador" atraso={0.3}
          dica="Mesas em que você joga" onClick={abrirCampanhas} />
        <Numero valor={mapas ?? 0} legenda="Mapas" atraso={0.36}
          dica="Abrir os mapas" onClick={() => onNav?.("map")} />
        {sessions.length > 0 ? (
          <Numero valor={sessions.length} legenda="Sessões" atraso={0.42}
            dica="Ver campanhas" onClick={abrirCampanhas} />
        ) : null}
      </div>

      {/* ══ CORPO 2/1 ═════════════════════════════════════════════════════ */}
      <div className="px-split">
        <div className="px-col">

          {/* ── Campanhas ─────────────────────────────────────────────── */}
          <section aria-labelledby="px-camps" className="px-in" style={{ "--d": ".44s" }}>
            <div className="px-sec">
              <span className="px-sec-t" id="px-camps">Suas campanhas</span>
              {ativas.length > 0 ? (
                <button type="button" className="px-sec-a" onClick={abrirCampanhas}>Ver todas →</button>
              ) : null}
            </div>

            {ativas.length === 0 ? (
              <div className="px-empty">
                <div className="px-empty-t">Nenhuma mesa ativa</div>
                <p className="px-empty-d">
                  Crie uma campanha para mestrar a sua mesa, ou use o código de convite
                  que o mestre te passou para entrar em uma existente.
                </p>
                <button type="button" className="px-btn" onClick={abrirCampanhas}>Ir para campanhas</button>
              </div>
            ) : (
              <div className="px-camps">
                {ativas.slice(0, 4).map((c) => {
                  const mestre = c.masterId === uid;
                  const membros = c.members?.length || 0;
                  const lotacao = c.maxPlayers || LOTACAO_PADRAO;
                  return (
                    <button type="button" key={c.id} className="px-camp" onClick={() => onOpenCampaign?.(c)}
                      title={c.description || c.name}>
                      {c.coverImage
                        ? <img className="px-camp-img" src={c.coverImage} alt="" />
                        : <span className="px-camp-fall" aria-hidden="true"><span>◈</span></span>}
                      <span className="px-camp-scrim" aria-hidden="true" />
                      <span className="px-tag l">◎ {membros}/{lotacao}</span>
                      {mestre ? <span className="px-tag r">Mestre</span> : null}
                      <span className="px-camp-body">
                        <span className="px-camp-t" style={{ display: "block" }}>{c.name}</span>
                        {/* Só o papel. O nome do sistema é o mesmo em todos os
                            cards da tela — repeti-lo em cada estandarte só
                            quebrava a legenda em duas linhas. */}
                        <span className="px-camp-m">
                          <span>{mestre ? "você mestra" : "você joga"}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Agentes ───────────────────────────────────────────────── */}
          <section aria-labelledby="px-chars" className="px-in" style={{ "--d": ".5s" }}>
            <div className="px-sec">
              <span className="px-sec-t" id="px-chars">Seus personagens</span>
              {fichas.length > 0 ? (
                <button type="button" className="px-sec-a" onClick={() => onNav?.("sheet")}>Ver todas →</button>
              ) : null}
            </div>

            {fichas.length === 0 ? (
              <div className="px-empty">
                <div className="px-empty-t">Nenhum agente ainda</div>
                <p className="px-empty-d">
                  A ficha é o ponto de partida: atributos, perícias, inventário e rituais
                  ficam todos nela.
                </p>
                <button type="button" className="px-btn" onClick={() => onCreateChar?.()}>
                  Criar primeiro agente
                </button>
              </div>
            ) : system?.id === "op" ? (
              /* 420px é o piso do DossierCard: abaixo disso o nome do agente
                 trunca e as barras de PV/SAN encostam na borda. Na coluna
                 principal isso dá UMA coluna — que é como o dossiê já era
                 antes deste redesenho — e duas só em tela larga. */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(420px,1fr))", gap: 16 }}>
                {fichas.map((c, i) => (
                  <DossierCard key={c.id || c.createdAt || i} character={c}
                    systemAccent={acento} onClick={() => onSelectChar?.(c)} />
                ))}
              </div>
            ) : (
              <div>
                {fichas.map((c, i) => (
                  <button type="button" key={c.id || c.createdAt || i} className="px-row"
                    onClick={() => onSelectChar?.(c)}>
                    <span className="px-ava">
                      {getActiveAvatar(c)
                        ? <img src={getActiveAvatar(c)} alt="" />
                        : <IcoFicha s={20} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="px-row-t" style={{ display: "block" }}>{c.form?.personagem || "Sem nome"}</span>
                      <span className="px-row-m" style={{ display: "block" }}>
                        {c.classe?.name || "—"} · {c.origem?.name || "—"}
                      </span>
                    </span>
                    <span style={{ width: 104, flexShrink: 0 }}>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5,
                        color: "var(--muted)", letterSpacing: "0.04em", display: "block", marginBottom: 6 }}>
                        NEX {c.nex ?? 5}%
                      </span>
                      <span className="px-meter" style={{ marginTop: 0, display: "block" }}>
                        <i style={{ "--w": `${Math.min(100, Number(c.nex ?? 5))}%` }} />
                      </span>
                    </span>
                    <span className="px-go" aria-hidden="true"><IcoSeta s={16} /></span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Trilho de contexto ──────────────────────────────────────── */}
        <aside className="px-rail">

          {preparoAberto ? (
            <section aria-labelledby="px-prep" className="px-in" style={{ "--d": ".56s" }}>
              <div className="px-sec">
                <span className="px-sec-t" id="px-prep">Preparo do mundo</span>
                <span className="px-sec-a" style={{ cursor: "default" }}>{feitos}/{passos.length}</span>
              </div>
              <div className="px-prep">
                <Anel feitos={feitos} total={passos.length} />
                <div style={{ minWidth: 0 }}>
                  <div className="px-prep-n">{feitos} de {passos.length} prontos</div>
                  <div className="px-prep-c">Cada passo destrava uma parte da mesa. Dá para fazer fora de ordem.</div>
                </div>
              </div>
              <div role="progressbar" aria-valuenow={feitos} aria-valuemin={0} aria-valuemax={passos.length}
                aria-label="Progresso do preparo do mundo" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }} />
              <div>
                {passos.map((p, i) => {
                  const Tag = p.feito ? "div" : "button";
                  return (
                    <Tag key={p.id} className={`px-step${p.feito ? " done" : ""}`}
                      {...(p.feito ? {} : { type: "button", onClick: p.ir })}>
                      <span className={`px-step-b${p.feito ? " on" : ""}`} aria-hidden="true">
                        {p.feito ? <Certo atraso={0.6 + i * 0.12} /> : null}
                      </span>
                      <span className="px-step-t">{p.label}</span>
                      {!p.feito ? <span className="px-go" aria-hidden="true"><IcoSeta s={15} /></span> : null}
                    </Tag>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* ── Ferramentas ────────────────────────────────────────────── */}
          <section aria-labelledby="px-tools" className="px-in" style={{ "--d": ".62s" }}>
            <div className="px-sec"><span className="px-sec-t" id="px-tools">Ferramentas</span></div>
            {FERRAMENTAS.map((f) => (
              <button type="button" key={f.id} className="px-tool" onClick={() => onNav?.(f.id)}>
                <span className="px-tool-i" aria-hidden="true"><f.Ico s={17} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="px-row-t" style={{ display: "block", fontSize: 13.5 }}>{f.t}</span>
                  <span className="px-row-m" style={{ display: "block", fontSize: 12, whiteSpace: "normal" }}>{f.d}</span>
                </span>
                <span className="px-go" aria-hidden="true"><IcoSeta s={16} /></span>
              </button>
            ))}
          </section>

          {/* ── Plano ──────────────────────────────────────────────────── */}
          <section aria-labelledby="px-plano" className="px-in" style={{ "--d": ".68s" }}>
            <div className="px-sec"><span className="px-sec-t" id="px-plano">Seu plano</span></div>
            <div className="px-note">
              <span className="px-note-k">
                FICHAS {fichas.length}/{cotaFichas} · MESAS {mestrando.length}/{COTA_MESTRE}
              </span>
              {assinante
                ? "Assinatura ativa neste sistema — até 5 fichas e campanhas sem trava."
                : "O plano livre permite uma ficha por sistema."}
            </div>
            {!assinante ? (
              <button type="button" className="px-tool" style={{ marginTop: 10 }} onClick={() => onNav?.("planos")}>
                <span className="px-tool-i" aria-hidden="true"><IcoMesa s={17} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="px-row-t" style={{ display: "block", fontSize: 13.5 }}>Ver planos</span>
                  <span className="px-row-m" style={{ display: "block", fontSize: 12, whiteSpace: "normal" }}>
                    Fichas extras, IA sem trava e mesas ilimitadas
                  </span>
                </span>
                <span className="px-go" aria-hidden="true"><IcoSeta s={16} /></span>
              </button>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
