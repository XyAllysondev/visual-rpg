/* ════════════════════════════════════════════════════════════════════════
 *  HERÁLDICA — a pele global do Nexus
 *  ------------------------------------------------------------------------
 *  Repaginação 2026-08-05. O app inteiro passa a ter material, ornamento e
 *  peso: ferro forjado, ouro brunido, carmesim de brasão e pergaminho.
 *
 *  POR QUE ISTO É UMA CAMADA E NÃO 40 ARQUIVOS EDITADOS
 *  O app já funila tudo por poucas superfícies: as CSS vars do registry de
 *  temas (`--bg`, `--gold`, `--card`…), as classes compartilhadas (`.nx-*`,
 *  `.btn-gold`, `.nav-item`, `input`) e o casco (sidebar/topbar/rodapé).
 *  Repintar ESSAS superfícies repinta todas as telas de uma vez — inclusive
 *  as que ninguém abriu para editar. Reescrever estilo inline tela por tela
 *  daria o mesmo resultado visual com 30x mais risco de regressão.
 *
 *  As três camadas, nesta ordem:
 *    1. tokens   → `src/themes/index.js` (a escala de cor)
 *    2. ESTA     → material, ornamento, movimento
 *    3. tela     → o Painel tem a sua (`components/Painel/painelStyles.jsx`)
 *
 *  MOVIMENTO: tudo em CSS, nenhum loop de JS pintando frame. O bloco
 *  `prefers-reduced-motion` no fim desliga e entrega a MESMA tela parada.
 * ════════════════════════════════════════════════════════════════════════ */

/* ── Texturas ────────────────────────────────────────────────────────────
   SVG embutido: nenhum arquivo novo, nenhuma requisição. O grão é o que
   separa "superfície de metal" de "retângulo com degradê". */
const GRAO =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function HeraldicStyles() {
  return (
    <style data-nexus-heraldica>{`
    /* ══════════════════════════════════════════════════════════════════
       1. VARIÁVEIS DE MATERIAL
       Derivam dos tokens do tema — trocar de sistema continua repintando
       tudo sozinho. Nenhuma cor literal daqui para baixo, salvo o preto e
       o branco de sombra/realce, que são luz e não identidade.
       ══════════════════════════════════════════════════════════════════ */
    :root{
      --h-ease:cubic-bezier(.2,.85,.3,1);
      --h-slow:cubic-bezier(.16,1,.3,1);
      /* chapa forjada: realce em cima, sombra embaixo — o bisel */
      --h-bevel: inset 0 1px 0 rgba(255,255,255,.055), inset 0 -1px 0 rgba(0,0,0,.5);
      --h-plate: linear-gradient(168deg, rgba(255,255,255,.045) 0%, rgba(255,255,255,.012) 42%, rgba(0,0,0,.16) 100%);
      --h-lift: 0 26px 52px -30px rgba(0,0,0,.95);
    }

    /* ══════════════════════════════════════════════════════════════════
       2. FUNDO — a forja
       Uma luz de vela no alto, brasa fria embaixo, vinheta nas bordas e
       grão por cima de tudo. O elemento body deixa de ser um retângulo
       chapado. (Sem crases neste bloco — o CSS todo vive num template.)
       ══════════════════════════════════════════════════════════════════ */
    body{
      background:
        radial-gradient(120% 70% at 50% -10%, var(--gold-veil) 0%, transparent 60%),
        radial-gradient(90% 60% at 12% 108%, var(--brasao-dim) 0%, transparent 62%),
        var(--bg) !important;
      background-attachment: fixed;
    }

    /* ══════════════════════════════════════════════════════════════════
       3. AMBIENTE — brasas, vinheta, grão (o <HeraldicAmbience/>)
       ══════════════════════════════════════════════════════════════════ */
    .h-amb{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
    .h-amb-grao{position:absolute;inset:0;opacity:.05;background-image:${GRAO}}
    .h-amb-vinheta{position:absolute;inset:0;
      background:radial-gradient(120% 100% at 50% 45%, transparent 52%, rgba(0,0,0,.55) 100%)}
    .h-amb-brasa{position:absolute;bottom:-14px;width:2px;height:2px;border-radius:50%;
      opacity:0;animation:hBrasa linear infinite}
    @keyframes hBrasa{
      0%{opacity:0;transform:translate3d(0,0,0) scale(.4)}
      10%{opacity:.55}
      55%{opacity:.35}
      100%{opacity:0;transform:translate3d(var(--dx,14px),-100vh,0) scale(1.1)}
    }
    /* fio de luz que atravessa a tela de vez em quando, como reflexo em lâmina */
    .h-amb-lamina{position:absolute;top:0;bottom:0;width:180px;
      background:linear-gradient(90deg,transparent,var(--gold-veil),transparent);
      animation:hLamina 26s ease-in-out infinite}
    @keyframes hLamina{0%{left:-220px}55%,100%{left:110%}}

    /* ══════════════════════════════════════════════════════════════════
       4. TIPOGRAFIA — gravada em metal
       ══════════════════════════════════════════════════════════════════ */
    h1,h2,h3,.nx-h1,.nx-sec-t,.nx-eyebrow{
      text-shadow:0 1px 0 rgba(0,0,0,.6);
    }
    /* Luz de vela: o ouro respira. Amplitude minúscula de propósito — piscar
       forte lê como defeito de render, não como chama. */
    @keyframes hVela{0%,100%{opacity:1}42%{opacity:.94}68%{opacity:.985}}

    /* ══════════════════════════════════════════════════════════════════
       5. BOTÕES — chapa de latão batido
       ══════════════════════════════════════════════════════════════════ */
    .btn-gold{
      position:relative;overflow:hidden;isolation:isolate;
      border-radius:3px !important;
      background:linear-gradient(178deg,var(--gold2) 0%,var(--gold) 28%,var(--gold-mid) 72%,var(--gold-deep) 100%) !important;
      color:#17120a !important;font-weight:700 !important;
      letter-spacing:.16em !important;
      border:1px solid rgba(0,0,0,.5) !important;
      text-shadow:0 1px 0 rgba(255,255,255,.28) !important;
      box-shadow:
        var(--h-bevel),
        0 2px 0 rgba(0,0,0,.55),
        0 14px 30px -14px var(--gold-cast) !important;
      transition:transform .18s var(--h-ease),box-shadow .25s,filter .25s !important;
    }
    .btn-gold::after{content:"";position:absolute;inset:0;z-index:-1;
      background:linear-gradient(100deg,transparent 34%,rgba(255,255,255,.6) 50%,transparent 66%);
      transform:translateX(-130%);transition:transform .75s var(--h-ease)}
    .btn-gold:hover:not(:disabled)::after{transform:translateX(130%)}
    .btn-gold:hover:not(:disabled){
      transform:translateY(-1px);filter:brightness(1.08) !important;
      box-shadow:var(--h-bevel),0 3px 0 rgba(0,0,0,.55),0 20px 40px -14px var(--gold-cast) !important}
    /* prensar: a chapa afunda no lugar dela */
    .btn-gold:active:not(:disabled){transform:translateY(1px);
      box-shadow:var(--h-bevel),0 0 0 rgba(0,0,0,.55),0 8px 18px -10px var(--gold-cast) !important}

    .btn-ghost,.nx-btn{
      border-radius:3px !important;
      background:var(--h-plate) !important;
      border:1px solid var(--border2) !important;
      box-shadow:var(--h-bevel) !important;
      transition:color .2s,border-color .2s,box-shadow .25s,transform .18s var(--h-ease) !important;
    }
    .btn-ghost:hover,.nx-btn:hover{
      transform:translateY(-1px);
      border-color:var(--gold) !important;
      box-shadow:var(--h-bevel),0 0 26px -10px var(--gold-glow) !important}

    /* ══════════════════════════════════════════════════════════════════
       6. CAMPOS — pergaminho encaixado no metal (afundado, não elevado)
       ══════════════════════════════════════════════════════════════════ */
    input,textarea,select{
      border-radius:3px !important;
      background:rgba(0,0,0,.34) !important;
      border:1px solid var(--border) !important;
      box-shadow:inset 0 2px 5px rgba(0,0,0,.6), inset 0 -1px 0 rgba(255,255,255,.04) !important;
      transition:border-color .2s,box-shadow .25s !important;
    }
    input:focus,textarea:focus,select:focus{
      border-color:var(--gold) !important;
      box-shadow:inset 0 2px 5px rgba(0,0,0,.6), 0 0 0 3px var(--gold-dim) !important}

    /* ══════════════════════════════════════════════════════════════════
       7. CASCO — barra lateral, topo e rodapé
       Reestilizados por SELETOR: o JSX deles continua intocado.
       ══════════════════════════════════════════════════════════════════ */
    .sidebar-desktop{
      position:relative;
      background:
        linear-gradient(90deg, rgba(255,255,255,.028) 0%, transparent 42%),
        linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%) !important;
      box-shadow:inset -1px 0 0 rgba(0,0,0,.6), 6px 0 26px -18px #000;
    }
    /* filete de ouro na borda direita: o gume da lâmina que separa a barra do conteúdo */
    .sidebar-desktop::after{content:"";position:absolute;top:0;right:0;bottom:0;width:1px;
      background:linear-gradient(180deg,transparent,var(--border2) 18%,var(--border2) 82%,transparent);
      pointer-events:none}
    .sidebar-desktop .nav-item,.sidebar-desktop nav button{border-radius:3px !important}

    /* topbar: chapa mais escura que o conteúdo, com brilho de vela no topo */
    .topbar-sys{letter-spacing:.06em}
    /* Dois emblemas, dois caminhos:
       · TOPBAR — é o SVG inline (OPEnergyIcon, em App.jsx). Foi repintado na
         origem, então nada a fazer aqui.
       · TELA DE SELEÇÃO — é um .webp (assets/higgsfield). Arte pronta não se
         repinta por código; sem reexportar o arquivo, o filtro é o único
         caminho. Vale SÓ para o Ordem Paranormal, que era roxo: D&D e
         Tormenta já têm emblema na cor dos próprios sistemas.
       Se um dia o .webp for reexportado em ouro/carmesim, apague este bloco. */
    .sys-emblem[data-sys="op"]{
      filter:sepia(.85) saturate(2.4) hue-rotate(-24deg) brightness(.95) contrast(1.08)}

    /* ══════════════════════════════════════════════════════════════════
       8. GRAMÁTICA NX — as telas de conteúdo (Fichas, Campanhas, Planos…)
       ══════════════════════════════════════════════════════════════════ */
    /* Cabeçalho de tela vira um brasão: sobrancelha com filete, título gravado
       e uma régua dupla embaixo (grosso + fino), como gravação em placa. */
    .nx-head{position:relative;padding-bottom:20px !important;border-bottom:none !important}
    .nx-head::before{content:"";position:absolute;left:0;right:0;bottom:3px;height:1px;
      background:linear-gradient(90deg,var(--border2),transparent 72%)}
    .nx-head::after{content:"";position:absolute;left:0;bottom:0;width:120px;height:1px;
      background:linear-gradient(90deg,var(--gold),transparent)}
    .nx-eyebrow{position:relative;padding-left:18px;color:var(--muted2) !important}
    .nx-eyebrow::before{content:"◈";position:absolute;left:0;top:-1px;
      font-size:9px;color:var(--gold);opacity:.9}
    .nx-h1{font-family:'Cinzel Decorative',serif !important;font-weight:700 !important;
      letter-spacing:.03em !important;color:var(--text) !important;
      font-size:clamp(24px,2.6vw,34px) !important;animation:hVela 7s ease-in-out infinite}

    /* Título de seção vira faixa: losango + rótulo + régua que corre até a ponta */
    .nx-sec{position:relative;border-bottom:none !important;padding-bottom:11px !important}
    .nx-sec::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;
      background:linear-gradient(90deg,var(--border2),rgba(255,255,255,.05) 40%,transparent)}
    .nx-sec-t{position:relative;padding-left:17px;color:var(--muted2) !important;letter-spacing:.2em !important}
    .nx-sec-t::before{content:"◆";position:absolute;left:0;top:0;font-size:8px;color:var(--gold)}

    /* Faixa de números: cada bloco vira uma chapa gravada */
    .nx-stats{border:none !important;display:grid;gap:12px}
    .nx-stat{
      background:var(--h-plate) !important;border:1px solid var(--border) !important;
      border-radius:4px !important;box-shadow:var(--h-bevel);
      padding:16px 18px !important;
      transition:transform .28s var(--h-ease),border-color .28s,box-shadow .28s !important}
    .nx-stat:first-child{padding-left:18px !important}
    .nx-stat:hover{transform:translateY(-3px);border-color:var(--gold) !important;
      box-shadow:var(--h-bevel),var(--h-lift),0 0 32px -14px var(--gold-glow)}
    /* Cinzel, NÃO Cinzel Decorative: o algarismo 1 da Decorative é um I sem
       pé, e "1/3" virava "I/3" na faixa de cotas. Num bloco cuja função
       inteira é mostrar número, isso não é estilo — é defeito. */
    .nx-stat-num{font-family:'Cinzel',serif !important;font-weight:600 !important;
      color:var(--text) !important}

    /* Linhas: o filete de acento vira gume de ouro, e a linha desliza ao passar */
    .nx-row{border-bottom:1px solid var(--border) !important;border-radius:3px}
    .nx-row::before{background:linear-gradient(180deg,transparent,var(--gold),transparent) !important;
      width:2px !important}
    .nx-row:hover{background:linear-gradient(90deg,var(--gold-veil),transparent 62%) !important}
    .nx-row-t{font-family:'Cinzel',serif !important;letter-spacing:.02em}

    .nx-note{background:var(--h-plate);border:1px solid var(--border);
      border-radius:4px;padding:13px 15px !important;box-shadow:var(--h-bevel)}
    .nx-empty{border-bottom:none !important;position:relative;
      background:radial-gradient(90% 120% at 12% 0%, var(--gold-veil), transparent 60%);
      border:1px solid var(--border);border-radius:4px;padding:28px 24px 30px !important}

    /* ══════════════════════════════════════════════════════════════════
       9. CARTÕES GENÉRICOS — qualquer superfície que use --card ganha bisel
       Escopo estreito de propósito: só quem já declara a var, para não
       biselar overlay, modal de foto e canvas de mapa por acidente.
       ══════════════════════════════════════════════════════════════════ */
    .stat-card{box-shadow:var(--h-bevel) !important;border-radius:4px !important}

    /* ══════════════════════════════════════════════════════════════════
       10. BARRA DE ROLAGEM — trilho de latão
       ══════════════════════════════════════════════════════════════════ */
    ::-webkit-scrollbar{width:9px;height:9px}
    ::-webkit-scrollbar-track{background:rgba(0,0,0,.42)}
    ::-webkit-scrollbar-thumb{
      background:linear-gradient(180deg,var(--gold),var(--gold3));
      border-radius:0;border:2px solid var(--bg);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
    ::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,var(--gold2),var(--gold))}

    /* ══════════════════════════════════════════════════════════════════
       11. SELEÇÃO E FOCO
       ══════════════════════════════════════════════════════════════════ */
    ::selection{background:var(--gold-sel);color:var(--text)}
    :focus-visible{outline:2px solid var(--gold) !important;outline-offset:2px !important}

    /* ══════════════════════════════════════════════════════════════════
       12. ORNAMENTOS REUSÁVEIS
       ══════════════════════════════════════════════════════════════════ */
    /* cantoneiras de placa — aplique .h-cantos num container relativo */
    .h-cantos::before,.h-cantos::after{content:"";position:absolute;width:16px;height:16px;
      pointer-events:none;opacity:.65}
    .h-cantos::before{top:7px;left:7px;border-top:1px solid var(--gold);border-left:1px solid var(--gold)}
    .h-cantos::after{bottom:7px;right:7px;border-bottom:1px solid var(--gold);border-right:1px solid var(--gold)}

    /* régua ornamental — <div class="h-regua"><i/><b>◈</b><i/></div> */
    .h-regua{display:flex;align-items:center;gap:14px}
    .h-regua i{flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--border2),transparent)}
    .h-regua b{font-family:'Cinzel',serif;font-size:9px;letter-spacing:.4em;
      color:var(--gold);font-weight:400;opacity:.9}

    /* ══════════════════════════════════════════════════════════════════
       13. MOVIMENTO REDUZIDO — mesma tela, parada
       ══════════════════════════════════════════════════════════════════ */
    @media(prefers-reduced-motion:reduce){
      .h-amb-brasa,.h-amb-lamina{display:none}
      .nx-h1{animation:none}
      .btn-gold::after{display:none}
      *,*::before,*::after{animation-duration:.001ms !important;transition-duration:.001ms !important}
    }
    `}</style>
  );
}

/* Brasas: posição, deriva e duração FIXAS por índice. Nada de Math.random(),
   que re-sortearia a cada render e faria a partícula saltar de lugar. */
const BRASAS = [4, 11, 19, 27, 34, 42, 51, 58, 66, 73, 81, 88, 94, 15, 63];

/**
 * Ambiente da forja: brasas subindo, uma lâmina de luz atravessando devagar,
 * grão e vinheta. Fica atrás de tudo (`z-index:0`, `pointer-events:none`) e
 * substitui o antigo `<Deco/>` de linhas cruzadas.
 */
export function HeraldicAmbience() {
  return (
    <div className="h-amb" aria-hidden="true">
      <div className="h-amb-lamina" />
      {BRASAS.map((esq, i) => (
        <span
          key={`${esq}-${i}`}
          className="h-amb-brasa"
          style={{
            left: `${esq}%`,
            "--dx": `${(i % 2 ? 1 : -1) * (8 + (i % 4) * 9)}px`,
            background: i % 3 === 0 ? "var(--brasao2)" : "var(--gold2)",
            animationDuration: `${17 + (i % 6) * 4}s`,
            animationDelay: `${-(i * 2.6)}s`,
          }}
        />
      ))}
      <div className="h-amb-grao" />
      <div className="h-amb-vinheta" />
    </div>
  );
}
