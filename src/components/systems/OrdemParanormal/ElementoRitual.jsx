/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — RITUAL DE AFINIDADE (transição pós-escolha)
 *  Cada elemento tem coreografia própria — antes daqui os cinco compartilhavam
 *  o mesmo scale-up (`op-el-erupt`), então escolher Sangue ou Conhecimento
 *  produzia a mesma cena. A coreografia carrega o lore de `elementos.jsx`:
 *  Sangue pulsa e sangra · Morte desenrola espirais e vira cinza ·
 *  Conhecimento monta runas e abre o olho · Energia sobrecarrega e estoura ·
 *  Medo se materializa aos solavancos e fecha a névoa.
 *
 *  Puro SVG/CSS — sem asset externo, nítido em qualquer DPI, tematizado pelas
 *  cores do próprio elemento. `RITUAL_MS` é a fonte da verdade da duração: a
 *  ficha agenda a persistência por ele, então animação e commit não divergem.
 *  Props: id (elemento) · onDone (opcional; chamado ao fim)
 * ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";
import { getElementTheme } from "./elementos";

/** Duração total do ritual. A ficha usa isto para agendar a persistência. */
export const RITUAL_MS = 2600;

/* Sob prefers-reduced-motion o ritual não é encurtado, é substituído: um
 * quadro estático segurando o símbolo. Encurtar só tornaria o movimento mais
 * abrupto — quem pede menos movimento não quer o mesmo choque mais rápido. */

const rand = (seed) => {
  // PRNG determinístico: as fagulhas precisam ser estáveis entre re-renders
  // do mesmo ritual, senão cada render redesenha um céu diferente.
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

const motes = (n, seed) => {
  const r = rand(seed);
  return Array.from({ length: n }, () => ({
    x: r() * 100,
    y: r() * 100,
    d: 0.9 + r() * 1.6,
    delay: r() * 0.9,
    size: 1.5 + r() * 2.5,
  }));
};

const RUNAS = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒ".split("");

export default function ElementoRitual({ id, onDone }) {
  const t = getElementTheme(id);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!doneRef.current) return undefined;
    const timer = setTimeout(() => doneRef.current?.(), RITUAL_MS);
    return () => clearTimeout(timer);
  }, [id]);

  return (
    <div
      className={`op-ritual op-ritual-${id || "base"}`}
      style={{ "--r-primary": t.primary, "--r-accent": t.accent, "--r-glow": t.glow, "--r-deep": t.bg }}
      role="status"
      aria-live="polite"
      aria-label={`Manifestando afinidade com ${t.name}`}
    >
      <RitualStyles />

      {/* Camada 0 — o breu de onde tudo sai */}
      <div className="op-ritual-void" />

      {id === "sangue" && <Sangue />}
      {id === "morte" && <Morte />}
      {id === "conhecimento" && <Conhecimento />}
      {id === "energia" && <Energia />}
      {id === "medo" && <Medo />}

      {/* Nome do elemento emergindo no fim de todas as coreografias */}
      <div className="op-ritual-nome">{t.name}</div>
    </div>
  );
}

/* ── SANGUE: sístole. O símbolo bate, veias crescem, o sangue inunda. ── */
function Sangue() {
  const gotas = motes(22, 7331);
  return (
    <>
      <svg className="op-ritual-svg" viewBox="0 0 200 200" aria-hidden="true">
        {/* veias irradiando do centro — desenhadas por dashoffset */}
        <g className="op-sg-veias" stroke="var(--r-primary)" fill="none" strokeLinecap="round">
          {Array.from({ length: 12 }, (_, i) => {
            const ang = (i / 12) * Math.PI * 2;
            const x = 100 + Math.cos(ang) * 96;
            const y = 100 + Math.sin(ang) * 96;
            const cx = 100 + Math.cos(ang + 0.5) * 52;
            const cy = 100 + Math.sin(ang + 0.5) * 52;
            return <path key={i} d={`M100 100 Q${cx} ${cy} ${x} ${y}`} strokeWidth={2.4 - (i % 3) * 0.6} style={{ animationDelay: `${0.15 + i * 0.045}s` }} />;
          })}
        </g>
        {/* a cruz de sangue batendo */}
        <g className="op-sg-cruz" stroke="var(--r-accent)" fill="none" strokeWidth="4" strokeLinecap="round">
          <line x1="100" y1="52" x2="100" y2="148" />
          <line x1="64" y1="100" x2="136" y2="100" />
          <rect x="54" y="54" width="16" height="16" />
          <rect x="130" y="54" width="16" height="16" />
          <rect x="54" y="130" width="16" height="16" />
          <rect x="130" y="130" width="16" height="16" />
        </g>
      </svg>
      {gotas.map((g, i) => (
        <span key={i} className="op-sg-gota" style={{ left: `${g.x}%`, animationDelay: `${g.delay}s`, animationDuration: `${g.d + 0.6}s`, height: `${g.size * 5}px` }} />
      ))}
      <div className="op-sg-mare" />
    </>
  );
}

/* ── MORTE: as espirais se desenrolam, tudo perde cor e vira cinza. ── */
function Morte() {
  const cinzas = motes(30, 991);
  const espiral = (turns, maxR, offset) => {
    let d = "";
    const steps = turns * 44;
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const ang = p * turns * 2 * Math.PI + offset;
      const r = p * maxR;
      d += `${i === 0 ? "M" : "L"} ${(100 + Math.cos(ang) * r).toFixed(1)} ${(100 + Math.sin(ang) * r).toFixed(1)} `;
    }
    return d;
  };
  return (
    <>
      <svg className="op-ritual-svg" viewBox="0 0 200 200" aria-hidden="true">
        <g fill="none" strokeLinecap="round">
          <path className="op-mt-espiral op-mt-e1" d={espiral(4, 88, 0)} stroke="var(--r-accent)" strokeWidth="2.2" />
          <path className="op-mt-espiral op-mt-e2" d={espiral(4, 70, Math.PI)} stroke="var(--r-primary)" strokeWidth="1.6" />
        </g>
        <circle className="op-mt-anel" cx="100" cy="100" r="92" fill="none" stroke="var(--r-accent)" strokeWidth="1" />
        <circle className="op-mt-nucleo" cx="100" cy="100" r="4" fill="var(--r-accent)" />
      </svg>
      {cinzas.map((c, i) => (
        <span key={i} className="op-mt-cinza" style={{ left: `${c.x}%`, top: `${c.y}%`, width: c.size, height: c.size, animationDelay: `${c.delay}s`, animationDuration: `${1.6 + c.d}s` }} />
      ))}
      <div className="op-mt-palidez" />
    </>
  );
}

/* ── CONHECIMENTO: runas convergem, o triângulo se desenha, o olho abre. ── */
function Conhecimento() {
  return (
    <>
      <svg className="op-ritual-svg" viewBox="0 0 200 200" aria-hidden="true">
        <circle className="op-cn-anel op-cn-anel1" cx="100" cy="100" r="86" fill="none" stroke="var(--r-accent)" strokeWidth="1.4" />
        <circle className="op-cn-anel op-cn-anel2" cx="100" cy="100" r="70" fill="none" stroke="var(--r-primary)" strokeWidth="0.9" opacity="0.55" />
        <polygon className="op-cn-tri" points="100,38 160,146 40,146" fill="none" stroke="var(--r-accent)" strokeWidth="2.4" strokeLinejoin="round" />
        <g className="op-cn-olho">
          <path d="M70 108 Q100 82 130 108 Q100 134 70 108 Z" fill="none" stroke="var(--r-accent)" strokeWidth="2" />
          <circle cx="100" cy="108" r="9" fill="var(--r-accent)" />
        </g>
      </svg>
      <div className="op-cn-runas" aria-hidden="true">
        {RUNAS.map((r, i) => {
          const ang = (i / RUNAS.length) * Math.PI * 2;
          return (
            <span
              key={i}
              className="op-cn-runa"
              style={{
                "--rx": `${(Math.cos(ang) * 42).toFixed(2)}vmin`,
                "--ry": `${(Math.sin(ang) * 42).toFixed(2)}vmin`,
                "--rx0": `${(Math.cos(ang) * 110).toFixed(2)}vmin`,
                "--ry0": `${(Math.sin(ang) * 110).toFixed(2)}vmin`,
                animationDelay: `${i * 0.05}s`,
              }}
            >
              {r}
            </span>
          );
        })}
      </div>
    </>
  );
}

/* ── ENERGIA: o diamante carrega, os arcos golpeiam, o branco estoura. ── */
function Energia() {
  const arcos = [0, 60, 120, 180, 240, 300];
  return (
    <>
      <svg className="op-ritual-svg" viewBox="0 0 200 200" aria-hidden="true">
        <g className="op-en-arcos" stroke="var(--r-accent)" fill="none" strokeWidth="1.8" strokeLinecap="round">
          {arcos.map((deg, i) => (
            <path
              key={deg}
              d="M100 100 L104 74 L94 68 L102 40 L96 16"
              transform={`rotate(${deg} 100 100)`}
              style={{ animationDelay: `${0.5 + i * 0.075}s` }}
            />
          ))}
        </g>
        <g className="op-en-diamante" stroke="var(--r-accent)" fill="none" strokeWidth="3">
          <rect x="46" y="46" width="108" height="108" transform="rotate(45 100 100)" />
        </g>
        <rect className="op-en-nucleo" x="76" y="76" width="48" height="48" fill="none" stroke="var(--r-primary)" strokeWidth="2" />
      </svg>
      <div className="op-en-flash" />
    </>
  );
}

/* ── MEDO: a névoa sobe, o glifo pisca aos solavancos, o azul fecha. ── */
function Medo() {
  return (
    <>
      <div className="op-md-nevoa" />
      <div className="op-md-nevoa op-md-nevoa2" />
      <svg className="op-ritual-svg op-md-glifo" viewBox="0 0 200 200" aria-hidden="true">
        <g stroke="var(--r-accent)" fill="none" strokeWidth="3" strokeLinecap="round">
          <path d="M100 18 L128 66 L102 92 L144 102 L114 138 L138 182" />
          <path d="M100 18 L72 62 L98 90 L56 102 L88 134 L62 182" opacity="0.7" />
          <path d="M68 102 L132 102" opacity="0.5" />
          <circle cx="100" cy="102" r="8" fill="var(--r-accent)" stroke="none" opacity="0.85" />
        </g>
      </svg>
      <div className="op-md-vinheta" />
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 *  Keyframes colocados com o componente (mesmo padrão de ElementoSymbol):
 *  só existem durante o ritual, então não precisam viver no CSS da ficha.
 * ════════════════════════════════════════════════════════════════════════ */
function RitualStyles() {
  return (
    <style>{`
    .op-ritual{ position:fixed; inset:0; z-index:210; overflow:hidden; display:flex; align-items:center; justify-content:center;
      background:#05050a; animation:op-r-fundo ${RITUAL_MS}ms ease forwards; }
    @keyframes op-r-fundo{ 0%{ background:#05050a; } 62%{ background:#05050a; } 100%{ background:var(--r-deep,var(--bg)); } }

    .op-ritual-void{ position:absolute; inset:0; background:radial-gradient(circle at 50% 50%, var(--r-glow) 0%, transparent 58%);
      opacity:0; animation:op-r-void ${RITUAL_MS}ms ease-out forwards; }
    @keyframes op-r-void{ 0%{ opacity:0; transform:scale(0.2); } 40%{ opacity:0.45; } 72%{ opacity:0.75; transform:scale(1.1); } 100%{ opacity:0; transform:scale(2.2); } }

    .op-ritual-svg{ position:relative; width:min(62vmin,520px); height:min(62vmin,520px); overflow:visible; }

    .op-ritual-nome{ position:absolute; bottom:14%; left:0; right:0; text-align:center; letter-spacing:0.42em; text-indent:0.42em;
      font-family:var(--font-display,'Cinzel Decorative',serif); font-size:clamp(20px,4.4vw,42px); color:var(--r-accent);
      text-shadow:0 0 34px var(--r-glow); opacity:0; animation:op-r-nome ${RITUAL_MS}ms ease-out forwards; }
    @keyframes op-r-nome{ 0%,58%{ opacity:0; transform:translateY(14px); letter-spacing:0.9em; } 78%{ opacity:1; transform:translateY(0); letter-spacing:0.42em; } 100%{ opacity:0.9; } }

    /* ── SANGUE ── */
    .op-sg-veias path{ stroke-dasharray:160; stroke-dashoffset:160; opacity:0.85;
      animation:op-sg-veia 1.5s cubic-bezier(.2,.7,.3,1) forwards; }
    @keyframes op-sg-veia{ to{ stroke-dashoffset:0; } }
    .op-sg-cruz{ transform-origin:100px 100px; animation:op-sg-batida 0.86s ease-in-out 3; filter:drop-shadow(0 0 18px var(--r-glow)); }
    @keyframes op-sg-batida{ 0%,100%{ transform:scale(0.94); } 14%{ transform:scale(1.1); } 28%{ transform:scale(0.98); } 42%{ transform:scale(1.05); } }
    .op-sg-gota{ position:absolute; top:-6%; width:3px; border-radius:2px; background:var(--r-primary);
      box-shadow:0 0 9px var(--r-glow); opacity:0; animation:op-sg-cair linear forwards; }
    @keyframes op-sg-cair{ 0%{ transform:translateY(0); opacity:0; } 10%{ opacity:0.9; } 100%{ transform:translateY(112vh); opacity:0.15; } }
    .op-sg-mare{ position:absolute; left:0; right:0; bottom:0; height:100%; background:linear-gradient(to top, var(--r-primary), transparent);
      transform:translateY(100%); opacity:0.85; animation:op-sg-inundar ${RITUAL_MS}ms cubic-bezier(.4,0,.2,1) forwards; }
    @keyframes op-sg-inundar{ 0%,55%{ transform:translateY(100%); } 100%{ transform:translateY(38%); } }

    /* ── MORTE ── */
    .op-mt-espiral{ stroke-dasharray:1400; stroke-dashoffset:1400; transform-origin:100px 100px; }
    .op-mt-e1{ animation:op-mt-desenrola 1.9s ease-out forwards, op-mt-gira 12s linear infinite; }
    .op-mt-e2{ animation:op-mt-desenrola 2.2s ease-out 0.18s forwards, op-mt-gira-rev 16s linear infinite; opacity:0.6; }
    @keyframes op-mt-desenrola{ to{ stroke-dashoffset:0; } }
    @keyframes op-mt-gira{ to{ transform:rotate(360deg); } }
    @keyframes op-mt-gira-rev{ to{ transform:rotate(-360deg); } }
    .op-mt-anel{ transform-origin:100px 100px; opacity:0; animation:op-mt-colapso ${RITUAL_MS}ms ease-in forwards; }
    @keyframes op-mt-colapso{ 0%{ opacity:0; transform:scale(1.6); } 30%{ opacity:0.6; } 100%{ opacity:0; transform:scale(0.15); } }
    .op-mt-nucleo{ animation:op-mt-pulso 1.4s ease-in-out infinite; transform-origin:100px 100px; }
    @keyframes op-mt-pulso{ 0%,100%{ opacity:0.4; transform:scale(1); } 50%{ opacity:1; transform:scale(1.5); } }
    .op-mt-cinza{ position:absolute; border-radius:50%; background:#d8d8d8; opacity:0;
      animation:op-mt-subir ease-out infinite; }
    @keyframes op-mt-subir{ 0%{ transform:translateY(0) scale(1); opacity:0; } 18%{ opacity:0.55; } 100%{ transform:translateY(-26vh) scale(0.3); opacity:0; } }
    .op-mt-palidez{ position:absolute; inset:0; backdrop-filter:grayscale(1); opacity:0;
      animation:op-mt-esvair ${RITUAL_MS}ms ease forwards; pointer-events:none; }
    @keyframes op-mt-esvair{ 0%{ opacity:0; } 70%{ opacity:0.9; } 100%{ opacity:0.5; } }

    /* ── CONHECIMENTO ── */
    .op-cn-anel{ transform-origin:100px 100px; }
    .op-cn-anel1{ animation:op-cn-gira 26s linear infinite, op-cn-surge 1s ease-out forwards; }
    .op-cn-anel2{ animation:op-cn-gira-rev 34s linear infinite, op-cn-surge 1s ease-out 0.15s forwards; }
    @keyframes op-cn-gira{ to{ transform:rotate(360deg); } }
    @keyframes op-cn-gira-rev{ to{ transform:rotate(-360deg); } }
    @keyframes op-cn-surge{ from{ opacity:0; } to{ opacity:1; } }
    .op-cn-tri{ stroke-dasharray:420; stroke-dashoffset:420; filter:drop-shadow(0 0 14px var(--r-glow));
      animation:op-cn-tracar 1.5s cubic-bezier(.3,.7,.3,1) 0.7s forwards; }
    @keyframes op-cn-tracar{ to{ stroke-dashoffset:0; } }
    .op-cn-olho{ transform-origin:100px 108px; opacity:0; animation:op-cn-abrir 1.1s cubic-bezier(.2,.8,.3,1) 1.5s forwards; }
    @keyframes op-cn-abrir{ 0%{ opacity:0; transform:scaleY(0.02); } 60%{ opacity:1; transform:scaleY(1.12); } 100%{ opacity:1; transform:scaleY(1); } }
    .op-cn-runas{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
    .op-cn-runa{ position:absolute; font-size:clamp(15px,2.5vmin,26px); color:var(--r-accent); text-shadow:0 0 12px var(--r-glow);
      opacity:0; animation:op-cn-convergir 1.6s cubic-bezier(.2,.8,.3,1) forwards; }
    @keyframes op-cn-convergir{
      0%{ opacity:0; transform:translate(var(--rx0),var(--ry0)) scale(2.2); }
      35%{ opacity:1; }
      70%{ opacity:1; transform:translate(var(--rx),var(--ry)) scale(1); }
      100%{ opacity:0.55; transform:translate(var(--rx),var(--ry)) scale(0.9); } }

    /* ── ENERGIA ── */
    .op-en-diamante{ transform-origin:100px 100px; filter:drop-shadow(0 0 16px var(--r-glow));
      animation:op-en-carregar 1.5s cubic-bezier(.3,.7,.3,1) forwards; }
    @keyframes op-en-carregar{ 0%{ opacity:0; transform:scale(0.25) rotate(-90deg); } 55%{ opacity:1; transform:scale(1.08) rotate(6deg); } 100%{ opacity:1; transform:scale(1) rotate(0); } }
    .op-en-nucleo{ transform-origin:100px 100px; animation:op-en-vibrar 0.22s steps(2) infinite; opacity:0.75; }
    @keyframes op-en-vibrar{ 0%,100%{ transform:rotate(45deg) translate(0,0); } 50%{ transform:rotate(45deg) translate(1.5px,-1.5px); } }
    .op-en-arcos path{ stroke-dasharray:120; stroke-dashoffset:120; opacity:0;
      animation:op-en-raio 0.5s steps(4) forwards; filter:drop-shadow(0 0 10px var(--r-glow)); }
    @keyframes op-en-raio{ 0%{ stroke-dashoffset:120; opacity:0; } 30%{ opacity:1; } 100%{ stroke-dashoffset:0; opacity:0.9; } }
    .op-en-flash{ position:absolute; inset:0; background:#fff; opacity:0;
      animation:op-en-estouro ${RITUAL_MS}ms ease-out forwards; }
    @keyframes op-en-estouro{ 0%,54%{ opacity:0; } 58%{ opacity:0.92; } 62%{ opacity:0.1; } 65%{ opacity:0.6; } 100%{ opacity:0; } }

    /* ── MEDO ── */
    .op-md-nevoa{ position:absolute; inset:-20%; opacity:0;
      background:radial-gradient(ellipse at 30% 80%, rgba(90,130,220,0.42), transparent 62%);
      animation:op-md-rolar 7s ease-in-out infinite, op-md-erguer ${RITUAL_MS}ms ease forwards; }
    .op-md-nevoa2{ background:radial-gradient(ellipse at 72% 65%, rgba(40,70,180,0.4), transparent 58%); animation-delay:-3.2s, 0.3s; }
    @keyframes op-md-rolar{ 0%,100%{ transform:translate(-4%,2%) scale(1); } 50%{ transform:translate(5%,-3%) scale(1.14); } }
    @keyframes op-md-erguer{ 0%{ opacity:0; } 45%{ opacity:0.85; } 100%{ opacity:1; } }
    .op-md-glifo{ opacity:0; filter:drop-shadow(0 0 22px var(--r-glow));
      animation:op-md-materializar ${RITUAL_MS}ms steps(1) forwards; }
    @keyframes op-md-materializar{
      0%,12%{ opacity:0; transform:translate(0,0) scale(0.8); }
      14%{ opacity:1; transform:translate(-7px,3px) scale(1.05); }
      17%{ opacity:0; }
      22%{ opacity:1; transform:translate(6px,-4px) scale(0.94); }
      26%{ opacity:0.15; }
      34%{ opacity:1; transform:translate(-3px,0) scale(1.02); }
      38%{ opacity:0.4; }
      48%{ opacity:1; transform:translate(0,0) scale(1); }
      62%{ opacity:0.55; transform:translate(2px,1px) scale(1); }
      70%,100%{ opacity:1; transform:translate(0,0) scale(1); } }
    .op-md-vinheta{ position:absolute; inset:0; pointer-events:none; opacity:0;
      box-shadow:inset 0 0 min(30vmin,240px) min(9vmin,70px) rgba(4,10,40,0.95);
      animation:op-md-fechar ${RITUAL_MS}ms ease-in forwards; }
    @keyframes op-md-fechar{ 0%,30%{ opacity:0; } 100%{ opacity:1; } }

    /* Menos movimento: o ritual vira um quadro estático. O símbolo ainda
       aparece e o nome ainda está lá — a informação é preservada, o choque não. */
    @media(prefers-reduced-motion:reduce){
      .op-ritual *{ animation:none !important; }
      .op-ritual{ animation:none; background:var(--r-deep,var(--bg)); }
      .op-ritual-void{ opacity:0.3; }
      .op-sg-gota,.op-mt-cinza,.op-en-flash,.op-sg-mare,.op-mt-palidez{ display:none; }
      .op-sg-veias path,.op-mt-espiral,.op-cn-tri,.op-en-arcos path{ stroke-dashoffset:0; }
      .op-cn-runa,.op-cn-olho,.op-md-glifo,.op-en-diamante,.op-mt-anel,.op-ritual-nome{ opacity:1; }
      .op-cn-runa{ transform:translate(var(--rx),var(--ry)); }
      .op-cn-olho{ transform:none; }
      .op-md-vinheta{ opacity:1; }
    }
  `}</style>
  );
}
