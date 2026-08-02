/**
 * Mapa-Múndi — ILUSTRAÇÃO DO MAPA PADRÃO (spec 0028, AC-13).
 *
 * A carta desenhada à mão do sertão da *Coroa de Cinzas*: costa recortada, o Rio
 * Ferrugem com afluentes, a Serra da Boca Seca em glifos de montanha, o charco
 * do Rebanho Murcho, a mata fechada do sul e a Estrada dos Tropeiros Mudos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE SVG E NÃO IMAGEM (AC-13)
 *
 * O fundo dos mapas do usuário vai em base64 no Firestore, com teto de 900 KB
 * (`worldMapStore.LIMITE_FUNDO_BYTES`), porque o Firebase Storage está fora do ar
 * no plano gratuito (ADR-0008/0009). O padrão contorna os dois problemas de uma
 * vez: **vetor embutido no bundle**. Não trafega, não ocupa documento, não tem
 * teto de bytes e fica nítido em qualquer zoom da câmera.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * CONTRATO COM O GRAFO
 *
 * `viewBox="0 0 2400 1600"` vem de `MAPA_PADRAO_LARGURA`/`MAPA_PADRAO_ALTURA`, os
 * mesmos números que `mapaPadrao.js` grava em `mapa.width`/`mapa.height`. Os
 * `x`/`y` dos doze nós foram posicionados sobre ESTE desenho: Vila Candeia na
 * curva do rio, a Boca do Dono no alto da serra, a Cova do Corta-Sono no fundo
 * da mata. Mexer nas dimensões aqui desloca o grafo inteiro.
 *
 * DETERMINISMO: a irregularidade (o tremido das montanhas, a dispersão das
 * árvores, os tufos do charco) vem de um gerador congruencial com **semente
 * constante**, calculado uma única vez na carga do módulo. Nada de `Math.random()`
 * — duas renderizações desenham exatamente a mesma carta.
 *
 * MOVIMENTO: só a maré respira, e apenas quando `prefers-reduced-motion` permite
 * (AC-11). Nada mais anima.
 */

import React from "react";
import { MAPA_PADRAO_LARGURA, MAPA_PADRAO_ALTURA } from "./mapaPadrao";

/* ═══════════════════════════════════════════════════════════════════════════
 * Ruído determinístico — mulberry32 com semente fixa.
 * Substitui `Math.random()` com a mesma sensação de "desenhado à mão" e a
 * garantia de que a carta é sempre idêntica.
 * ═══════════════════════════════════════════════════════════════════════════ */
function ruido(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arredonda para 1 casa: encurta o `d` dos paths sem diferença visível. */
const r1 = (n) => Math.round(n * 10) / 10;

/* ═══════════════════════════════════════════════════════════════════════════
 * PALETA — pergaminho envelhecido com o dourado do tema como acento.
 * O dourado sai de `--gold`/`--accent` (registro em `src/themes/index.js`), com
 * o dourado corrompido de Ordem Paranormal como reserva. O resto é tinta de
 * carta antiga: sépia, ferrugem, verde-musgo — cores da carta, não do app.
 * ═══════════════════════════════════════════════════════════════════════════ */
const COR = {
  papel: "#e4d5b3",
  papelClaro: "#f0e4c6",
  papelSombra: "#c9b48a",
  tinta: "#4a3a26",
  tintaFraca: "#7b6544",
  mar: "#9fb0ac",
  rio: "#6f7f86",
  mata: "#6b7448",
  charco: "#8a9068",
  serra: "#5a4a34",
  estrada: "#8a6a3e",
  ouro: "var(--gold, var(--accent, #c9a84c))",
};

/* ═══════════════════════════════════════════════════════════════════════════
 * GEOMETRIA — calculada UMA vez na carga do módulo, com semente constante.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Glifos de montanha ao longo do espinhaço da Serra da Boca Seca. */
const SERRA = (() => {
  const rnd = ruido(0x5e88a);
  /* Espinhaço: noroeste alto, descendo para o sudeste (o pé da serra é o Pouso). */
  const cume = [
    [180, 470], [250, 400], [320, 330], [300, 235], [390, 285], [460, 350],
    [415, 232], [500, 195], [560, 268], [630, 340], [590, 240], [680, 300],
    [745, 372], [700, 262], [790, 330], [855, 400], [230, 300], [520, 430],
    [620, 452], [720, 466], [370, 452], [455, 300],
  ];
  return cume.map(([x, y]) => {
    const largura = 44 + rnd() * 34;
    const altura = 40 + rnd() * 40;
    const inclina = (rnd() - 0.5) * 16;
    return {
      x: r1(x),
      y: r1(y),
      w: r1(largura),
      h: r1(altura),
      k: r1(inclina),
      hachuras: 2 + Math.floor(rnd() * 3),
    };
  });
})();

/** Massas de mata: uma silhueta grande e copas soltas por cima (não árvore a árvore). */
const MATA = (() => {
  const rnd = ruido(0x1a7ee);
  const nucleos = [
    [560, 1300, 250, 150], [790, 1400, 220, 130], [430, 1180, 160, 110],
    [900, 1240, 150, 95], [1660, 400, 170, 105], [1830, 300, 130, 85],
    [1250, 1400, 190, 110],
  ];
  const copas = [];
  nucleos.forEach(([cx, cy, rx, ry], i) => {
    const quantas = 7 + Math.floor(rnd() * 4);
    for (let k = 0; k < quantas; k += 1) {
      const ang = (k / quantas) * Math.PI * 2 + rnd() * 0.7;
      const dist = 0.25 + rnd() * 0.7;
      copas.push({
        x: r1(cx + Math.cos(ang) * rx * dist),
        y: r1(cy + Math.sin(ang) * ry * dist),
        r: r1(14 + rnd() * 12),
        g: i,
      });
    }
  });
  return { nucleos, copas };
})();

/** Tufos do charco: o símbolo clássico de alagado (três traços e um capim). */
const CHARCO = (() => {
  const rnd = ruido(0xc4a2c0);
  const tufos = [];
  for (let i = 0; i < 46; i += 1) {
    const x = 700 + rnd() * 700;
    const y = 1040 + rnd() * 330;
    tufos.push({ x: r1(x), y: r1(y), w: r1(22 + rnd() * 20) });
  }
  return tufos;
})();

/** Ondas paralelas à costa — o hachurado de carta antiga que "acalma" o mar. */
const ONDAS = (() => {
  const rnd = ruido(0x0cea7);
  return [0, 1, 2, 3].map((i) => {
    const d = 26 + i * 30;
    const j = () => (rnd() - 0.5) * 10;
    return `M ${r1(2185 + d + j())} 0`
      + ` C ${r1(2150 + d + j())} 190, ${r1(2205 + d + j())} 330, ${r1(2158 + d + j())} 470`
      + ` C ${r1(2118 + d + j())} 590, ${r1(2040 + d + j())} 648, ${r1(2060 + d + j())} 768`
      + ` C ${r1(2080 + d + j())} 890, ${r1(2202 + d + j())} 946, ${r1(2180 + d + j())} 1088`
      + ` C ${r1(2158 + d + j())} 1228, ${r1(2018 + d + j())} 1304, ${r1(2040 + d + j())} 1464`
      + ` C ${r1(2050 + d + j())} 1544, ${r1(2100 + d + j())} 1572, ${r1(2124 + d + j())} 1600`;
  });
})();

/* ── Traçados fixos: costa, rio, afluentes e estradas ─────────────────────── */

/** Linha de costa (leste). O `feDisplacementMap` é quem a torna irregular. */
const COSTA =
  "M 2185 0 C 2150 190, 2205 330, 2158 470"
  + " C 2118 590, 2040 648, 2060 768"
  + " C 2080 890, 2202 946, 2180 1088"
  + " C 2158 1228, 2018 1304, 2040 1464"
  + " C 2050 1544, 2100 1572, 2124 1600";

/** Mar: a costa fechada pela borda leste da carta. */
const MAR = `${COSTA} L 2400 1600 L 2400 0 Z`;

/** Rio Ferrugem — nasce na serra, passa em Vila Candeia e deságua na barra. */
const RIO =
  "M 372 288 C 470 392, 596 452, 742 548"
  + " C 878 640, 1004 764, 1136 838"
  + " C 1266 910, 1382 786, 1498 722"
  + " C 1652 636, 1856 692, 2058 764";

/** Afluentes: três da serra, um do charco. Finos, para o olho ler a hierarquia. */
const AFLUENTES = [
  "M 214 452 C 320 470, 430 496, 546 470 C 632 452, 690 500, 748 552",
  "M 556 262 C 616 340, 668 400, 700 470 C 722 516, 736 534, 746 550",
  "M 866 404 C 908 470, 930 540, 962 608 C 998 682, 1064 782, 1136 836",
  "M 1010 1128 C 1064 1042, 1108 950, 1138 856",
  "M 1466 1010 C 1420 916, 1450 820, 1494 726",
];

/** Estrada dos Tropeiros Mudos e o ramal do sal. Traço interrompido, à moda antiga. */
const ESTRADAS = [
  "M 742 470 C 830 570, 960 700, 1120 830",           // pé da serra → vila
  "M 1120 830 C 1250 800, 1370 740, 1480 700",         // vila → passo do vau
  "M 1480 700 C 1640 660, 1830 664, 1980 700",         // passo → forte
  "M 1120 830 C 1180 950, 1250 1050, 1330 1120",       // vila → rancho
  "M 1330 1120 C 1500 1140, 1690 1120, 1830 1080",     // rancho → salinas
  "M 1830 1080 C 1920 990, 1960 850, 1980 700",        // salinas → forte
];

/* ═══════════════════════════════════════════════════════════════════════════
 * COMPONENTE
 * ═══════════════════════════════════════════════════════════════════════════ */

const ROTULO_ACESSIVEL =
  "Carta desenhada à mão do sertão da Coroa de Cinzas: a Serra da Boca Seca a noroeste, o Rio "
  + "Ferrugem cortando o mapa até a foz a leste, Vila Candeia na curva do rio, o charco do Rebanho "
  + "Murcho ao sul com a mata fechada além dele, e a Estrada dos Tropeiros Mudos ligando a serra "
  + "ao Forte da Barra Negra, na barra.";

/**
 * A ilustração do mapa padrão.
 *
 * @param {object} props
 * @param {string} [props.idPrefix] prefixo dos ids internos de `<defs>`. Só
 *   precisa mudar se duas cartas forem renderizadas na mesma página (miniatura +
 *   mapa aberto, por exemplo) — ids duplicados fariam a segunda usar os filtros
 *   da primeira.
 * @param {string} [props.className]
 * @param {object} [props.style]
 */
export default function CartografiaPadrao({
  idPrefix = "cartografia-padrao",
  className,
  style,
  ...resto
}) {
  const gid = (n) => `${idPrefix}-${n}`;
  const u = (n) => `url(#${gid(n)})`;

  return (
    <svg
      viewBox={`0 0 ${MAPA_PADRAO_LARGURA} ${MAPA_PADRAO_ALTURA}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ROTULO_ACESSIVEL}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
      {...resto}
    >
      <title>{ROTULO_ACESSIVEL}</title>

      {/* A maré é o único movimento, e some com prefers-reduced-motion (AC-11). */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .${idPrefix}-mare { animation: ${idPrefix}-mare 14s ease-in-out infinite; }
          @keyframes ${idPrefix}-mare {
            0%, 100% { opacity: .30; transform: translateX(0); }
            50%      { opacity: .52; transform: translateX(-7px); }
          }
        }
      `}</style>

      <defs>
        {/* Pergaminho: dois tons manchados por turbulência, sem um único pixel raster. */}
        <radialGradient id={gid("papel")} cx="42%" cy="38%" r="78%">
          <stop offset="0%" stopColor={COR.papelClaro} />
          <stop offset="62%" stopColor={COR.papel} />
          <stop offset="100%" stopColor={COR.papelSombra} />
        </radialGradient>

        <filter id={gid("fibra")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="17" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="cinza" />
          <feComponentTransfer in="cinza">
            <feFuncA type="linear" slope="0.36" intercept="0" />
          </feComponentTransfer>
        </filter>

        {/* Manchas largas de umidade e sol — a "idade" do papel. */}
        <filter id={gid("mancha")} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="41" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" result="cinza" />
          <feComponentTransfer in="cinza">
            <feFuncA type="table" tableValues="0 0 0.10 0.30 0.52" />
          </feComponentTransfer>
        </filter>

        {/* Tremido de pena: desloca o traço com ruído — nenhuma linha sai reta. */}
        <filter id={gid("pena")} x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.021" numOctaves="3" seed="29" result="t" />
          <feDisplacementMap
            in="SourceGraphic" in2="t" scale="9"
            xChannelSelector="R" yChannelSelector="G"
          />
        </filter>

        {/* Costa: mesmo princípio, mais forte — recorta enseadas e pontas. */}
        <filter id={gid("costa")} x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.026" numOctaves="4" seed="7" result="t" />
          <feDisplacementMap
            in="SourceGraphic" in2="t" scale="26"
            xChannelSelector="R" yChannelSelector="G"
          />
        </filter>

        {/* Vinheta queimada nas bordas da carta. */}
        <radialGradient id={gid("vinheta")} cx="50%" cy="50%" r="72%">
          <stop offset="55%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#3a2a16" stopOpacity="0.42" />
        </radialGradient>

        <linearGradient id={gid("marGrad")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={COR.mar} stopOpacity="0.42" />
          <stop offset="100%" stopColor={COR.rio} stopOpacity="0.62" />
        </linearGradient>
      </defs>

      {/* ── 1. O papel ──────────────────────────────────────────────────── */}
      <rect width={MAPA_PADRAO_LARGURA} height={MAPA_PADRAO_ALTURA} fill={u("papel")} />
      <rect
        width={MAPA_PADRAO_LARGURA} height={MAPA_PADRAO_ALTURA}
        filter={u("mancha")} fill="#6b4a22" opacity="0.30"
      />
      <rect
        width={MAPA_PADRAO_LARGURA} height={MAPA_PADRAO_ALTURA}
        filter={u("fibra")} fill="#3a2a16" opacity="0.13"
      />

      {/* ── 2. O mar e a costa ──────────────────────────────────────────── */}
      <g filter={u("costa")}>
        <path d={MAR} fill={u("marGrad")} />
        <path d={COSTA} fill="none" stroke={COR.tinta} strokeWidth="4.5" strokeLinecap="round" />
      </g>
      <g
        className={`${idPrefix}-mare`}
        fill="none" stroke={COR.rio} strokeWidth="2" opacity="0.34"
        style={{ transformOrigin: "center" }}
      >
        {ONDAS.map((d, i) => <path key={`onda-${i}`} d={d} strokeDasharray={i % 2 ? "26 22" : "0"} />)}
      </g>

      {/* ── 3. Rio Ferrugem e afluentes ─────────────────────────────────── */}
      <g filter={u("pena")} fill="none" strokeLinecap="round">
        {AFLUENTES.map((d, i) => (
          <path key={`afl-${i}`} d={d} stroke={COR.rio} strokeWidth="5" opacity="0.72" />
        ))}
        <path d={RIO} stroke={COR.papelSombra} strokeWidth="20" opacity="0.5" />
        <path d={RIO} stroke={COR.rio} strokeWidth="11" opacity="0.9" />
        <path d={RIO} stroke={COR.mar} strokeWidth="4" opacity="0.55" />
      </g>

      {/* ── 4. Charco do Rebanho Murcho ─────────────────────────────────── */}
      <g>
        <path
          d="M 706 1178 C 760 1062, 930 1018, 1078 1042 C 1230 1066, 1348 1030, 1428 1078
             C 1508 1126, 1470 1268, 1338 1330 C 1206 1392, 1006 1400, 872 1362
             C 738 1324, 660 1272, 706 1178 Z"
          fill={COR.charco} opacity="0.26" filter={u("pena")}
        />
        <g stroke={COR.tintaFraca} strokeWidth="2.6" strokeLinecap="round" opacity="0.66">
          {CHARCO.map((t, i) => (
            <g key={`charco-${i}`}>
              <path d={`M ${t.x} ${t.y} h ${t.w}`} />
              <path d={`M ${r1(t.x + 6)} ${t.y + 9} h ${r1(t.w - 12)}`} />
              <path d={`M ${r1(t.x + t.w / 2)} ${t.y} v -13`} />
              <path d={`M ${r1(t.x + t.w / 2 - 6)} ${t.y - 2} l -4 -11`} />
              <path d={`M ${r1(t.x + t.w / 2 + 6)} ${t.y - 2} l 4 -11`} />
            </g>
          ))}
        </g>
      </g>

      {/* ── 5. Mata fechada ─────────────────────────────────────────────── */}
      <g>
        {MATA.nucleos.map(([cx, cy, rx, ry], i) => (
          <ellipse
            key={`massa-${i}`} cx={cx} cy={cy} rx={rx} ry={ry}
            fill={COR.mata} opacity="0.22" filter={u("pena")}
          />
        ))}
        <g filter={u("pena")}>
          {MATA.copas.map((c, i) => (
            <g key={`copa-${i}`}>
              <circle cx={c.x} cy={c.y} r={c.r} fill={COR.mata} opacity="0.5" />
              <circle
                cx={c.x} cy={c.y} r={c.r}
                fill="none" stroke={COR.tinta} strokeWidth="2" opacity="0.55"
              />
              <path
                d={`M ${c.x} ${r1(c.y + c.r * 0.6)} v ${r1(c.r * 0.75)}`}
                stroke={COR.tinta} strokeWidth="2.4" opacity="0.6"
              />
            </g>
          ))}
        </g>
      </g>

      {/* ── 6. Serra da Boca Seca — glifos de montanha desenhados ───────── */}
      <g filter={u("pena")} strokeLinecap="round" strokeLinejoin="round">
        {SERRA.map((m, i) => {
          const pico = `M ${r1(m.x - m.w)} ${m.y} L ${r1(m.x + m.k)} ${r1(m.y - m.h)} L ${r1(m.x + m.w)} ${m.y}`;
          const hachuras = [];
          for (let h = 1; h <= m.hachuras; h += 1) {
            const t = h / (m.hachuras + 1);
            const px = r1(m.x + m.k + (m.w - m.k) * t);
            const py = r1(m.y - m.h + m.h * t);
            hachuras.push(`M ${px} ${py} L ${r1(px - m.w * 0.16)} ${r1(py + m.h * 0.3)}`);
          }
          return (
            <g key={`serra-${i}`}>
              <path d={`${pico} Z`} fill={COR.papelSombra} opacity="0.4" />
              <path d={pico} fill="none" stroke={COR.serra} strokeWidth="4.6" />
              {hachuras.map((d, k) => (
                <path key={`h-${k}`} d={d} fill="none" stroke={COR.serra} strokeWidth="2.2" opacity="0.6" />
              ))}
            </g>
          );
        })}
      </g>

      {/* ── 7. Estrada dos Tropeiros Mudos ──────────────────────────────── */}
      <g filter={u("pena")} fill="none" strokeLinecap="round">
        {ESTRADAS.map((d, i) => (
          <g key={`estrada-${i}`}>
            <path d={d} stroke={COR.papelClaro} strokeWidth="12" opacity="0.55" />
            <path d={d} stroke={COR.estrada} strokeWidth="4" strokeDasharray="20 16" opacity="0.88" />
          </g>
        ))}
      </g>

      {/* ── 8. Rosa dos ventos e escala ─────────────────────────────────── */}
      <g transform="translate(1905 235)" opacity="0.85">
        <circle r="92" fill="none" stroke={COR.tinta} strokeWidth="2.4" opacity="0.5" />
        <circle r="66" fill="none" stroke={COR.tinta} strokeWidth="1.6" opacity="0.35" />
        <path d="M 0 -88 L 20 0 L 0 88 L -20 0 Z" fill={COR.ouro} opacity="0.75" />
        <path d="M 0 -88 L 20 0 L 0 88 L -20 0 Z" fill="none" stroke={COR.tinta} strokeWidth="2.4" />
        <path d="M -88 0 L 0 -16 L 88 0 L 0 16 Z" fill={COR.papelSombra} opacity="0.85" />
        <path d="M -88 0 L 0 -16 L 88 0 L 0 16 Z" fill="none" stroke={COR.tinta} strokeWidth="2.4" />
        <path d="M -54 -54 L 0 0 L 54 -54 M -54 54 L 0 0 L 54 54" stroke={COR.tinta} strokeWidth="1.6" fill="none" opacity="0.45" />
        <circle r="9" fill={COR.tinta} />
        <text
          x="0" y="-104" textAnchor="middle" fill={COR.tinta}
          fontSize="40" fontFamily="var(--font-title, 'Cinzel', serif)" letterSpacing="3"
        >
          N
        </text>
      </g>

      <g transform="translate(150 1452)" opacity="0.8">
        <path d="M 0 0 h 300" stroke={COR.tinta} strokeWidth="3.4" />
        <path d="M 0 -11 v 22 M 100 -8 v 16 M 200 -8 v 16 M 300 -11 v 22" stroke={COR.tinta} strokeWidth="3.4" />
        <path d="M 0 0 h 100 v 9 h -100 Z" fill={COR.tinta} opacity="0.7" />
        <path d="M 200 0 h 100 v 9 h -100 Z" fill={COR.tinta} opacity="0.7" />
        <text
          x="150" y="-22" textAnchor="middle" fill={COR.tinta}
          fontSize="30" fontFamily="var(--font-body, 'Inter', sans-serif)" letterSpacing="1"
        >
          três dias de tropa
        </text>
      </g>

      {/* ── 9. Cartela do título ────────────────────────────────────────── */}
      <g transform="translate(300 190)" opacity="0.92">
        <rect
          x="-244" y="-72" width="488" height="150" rx="8"
          fill={COR.papelClaro} opacity="0.62" stroke={COR.tinta} strokeWidth="2.6"
        />
        <rect
          x="-232" y="-60" width="464" height="126" rx="4"
          fill="none" stroke={COR.ouro} strokeWidth="2" opacity="0.85"
        />
        <text
          x="0" y="-8" textAnchor="middle" fill={COR.tinta}
          fontSize="56" fontFamily="var(--font-display, 'Cinzel Decorative', serif)" letterSpacing="2"
        >
          Coroa de Cinzas
        </text>
        <text
          x="0" y="42" textAnchor="middle" fill={COR.tintaFraca}
          fontSize="28" fontFamily="var(--font-body, 'Inter', sans-serif)" letterSpacing="4"
        >
          SERTÃO DO RIO FERRUGEM
        </text>
      </g>

      {/* ── 10. Moldura e vinheta ───────────────────────────────────────── */}
      <rect
        x="18" y="18" width={MAPA_PADRAO_LARGURA - 36} height={MAPA_PADRAO_ALTURA - 36}
        fill="none" stroke={COR.tinta} strokeWidth="6" opacity="0.55" filter={u("pena")}
      />
      <rect
        x="34" y="34" width={MAPA_PADRAO_LARGURA - 68} height={MAPA_PADRAO_ALTURA - 68}
        fill="none" stroke={COR.ouro} strokeWidth="2.4" opacity="0.65" filter={u("pena")}
      />
      <rect
        width={MAPA_PADRAO_LARGURA} height={MAPA_PADRAO_ALTURA}
        fill={u("vinheta")} pointerEvents="none"
      />
    </svg>
  );
}
