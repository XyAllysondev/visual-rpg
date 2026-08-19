/* ════════════════════════════════════════════════════════════════════════
 *  HERÁLDICA — a pele global do Nexus
 *  ------------------------------------------------------------------------
 *  Repaginação 2026-08-05 (material heráldico) · 2026-08-06 (OBSIDIANA E
 *  AMETISTA — o app inteiro passou a respirar roxo).
 *
 *  O que a segunda repaginação mudou de fato: a cor de identidade deixou de
 *  ser pontuação e virou ATMOSFERA. Antes o roxo/carmesim aparecia em três
 *  pontinhos (o dot de alerta, o selo de mestre, uma brasa a cada três).
 *  Agora ele é o ar da tela: aurora no alto, névoa no rodapé, éter subindo,
 *  o véu do Outro Lado passando devagar e um sigilo girando atrás de tudo.
 *  O ouro ficou onde sempre deveria estar — no metal que se clica e no que
 *  titula.
 *
 *  POR QUE ISTO É UMA CAMADA E NÃO 40 ARQUIVOS EDITADOS
 *  O app já funila tudo por poucas superfícies: as CSS vars do registry de
 *  temas (--bg, --gold, --brasao, --card…), as classes compartilhadas
 *  (.nx-*, .btn-gold, .nav-item, input) e o casco (sidebar/topbar/rodapé).
 *  Repintar ESSAS superfícies repinta todas as telas de uma vez — inclusive
 *  as que ninguém abriu para editar. Reescrever estilo inline tela por tela
 *  daria o mesmo resultado visual com 30x mais risco de regressão.
 *
 *  As três camadas, nesta ordem:
 *    1. tokens   → src/themes/index.js (a escala de cor)
 *    2. ESTA     → material, ornamento, movimento
 *    3. tela     → o Painel tem a sua (components/Painel/painelStyles.jsx)
 *
 *  MOVIMENTO: tudo em CSS, nenhum loop de JS pintando frame; só transform e
 *  opacity, que o compositor resolve sem relayout. O ambiente PARA quando a
 *  aba perde o foco (ver HeraldicAmbience) e o bloco prefers-reduced-motion
 *  no fim entrega a MESMA tela, parada.
 *
 *  NENHUMA COR LITERAL daqui para baixo, salvo preto e branco de sombra e
 *  realce — que são luz, não identidade. Tudo o mais sai das vars do tema,
 *  senão trocar para D&D deixaria névoa roxa numa paleta vermelha.
 * ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";

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
       2. FUNDO — obsidiana com o Outro Lado vazando
       Aurora de ametista no alto, névoa densa no rodapé, um sopro de ouro
       de vela no canto. O body deixa de ser um retângulo chapado.
       (Sem crases neste bloco — o CSS todo vive num template.)
       ══════════════════════════════════════════════════════════════════ */
    body{
      background:
        radial-gradient(128% 78% at 50% -14%, var(--brasao-nevoa) 0%, transparent 58%),
        radial-gradient(88% 52% at 88% 6%, var(--gold-veil) 0%, transparent 60%),
        radial-gradient(120% 62% at 18% 112%, var(--brasao-dim) 0%, transparent 64%),
        var(--bg) !important;
      background-attachment: fixed;
    }

    /* ══════════════════════════════════════════════════════════════════
       3. AMBIENTE — o <HeraldicAmbience/>
       Sete camadas, todas pointer-events:none e atrás de tudo.
       ══════════════════════════════════════════════════════════════════ */
    .h-amb{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;contain:strict}
    /* Aba escondida = tudo congela. Um app aberto em segundo plano não deve
       gastar GPU pintando névoa que ninguém vê. */
    .h-amb[data-parado="1"] *{animation-play-state:paused !important}

    /* Aurora: duas manchas de ametista à deriva. São radial-gradient e NÃO
       filter:blur — o degradê já nasce macio e não custa um repaint de
       desfoque a cada frame numa camada do tamanho da tela. */
    .h-amb-aurora{position:absolute;inset:-30%;opacity:.55}
    .h-amb-aurora i{position:absolute;display:block;border-radius:50%;
      animation:hDeriva 46s ease-in-out infinite}
    .h-amb-aurora i:nth-child(1){left:52%;top:-6%;width:64%;height:70%;
      background:radial-gradient(circle,var(--brasao-nevoa) 0%,transparent 66%)}
    .h-amb-aurora i:nth-child(2){left:-14%;top:24%;width:58%;height:64%;
      background:radial-gradient(circle,var(--brasao-dim) 0%,transparent 68%);
      animation-duration:62s;animation-delay:-21s}
    .h-amb-aurora i:nth-child(3){left:22%;top:58%;width:70%;height:58%;
      background:radial-gradient(circle,var(--gold-dim) 0%,transparent 70%);
      animation-duration:54s;animation-delay:-33s}
    @keyframes hDeriva{
      0%,100%{transform:translate3d(0,0,0) scale(1)}
      33%{transform:translate3d(5%,-6%,0) scale(1.14)}
      66%{transform:translate3d(-6%,4%,0) scale(.9)}
    }

    /* Névoa do rodapé: a fronteira com o Outro Lado. Sobe e desce de leve. */
    .h-amb-nevoa{position:absolute;left:-10%;right:-10%;bottom:-12%;height:46%;
      background:linear-gradient(0deg,var(--brasao-nevoa) 0%,transparent 78%);
      animation:hMare 24s ease-in-out infinite}
    @keyframes hMare{0%,100%{transform:translate3d(0,4%,0)}50%{transform:translate3d(0,-5%,0)}}

    /* Sigilo: um anel rúnico gigantesco girando atrás de tudo. É o que
       transforma o fundo de "escuro com luz" em "escuro com PRESENÇA". */
    .h-amb-sigilo{position:absolute;right:-24vmin;top:50%;width:96vmin;height:96vmin;
      translate:0 -50%;opacity:.13;animation:hGira 240s linear infinite}
    .h-amb-sigilo svg{width:100%;height:100%}
    @keyframes hGira{to{transform:rotate(360deg)}}

    /* Éter: partículas subindo. A que carrega o brasão tem halo; a de ouro
       é seca — é o que faz as duas cores lerem como materiais diferentes. */
    .h-amb-brasa{position:absolute;bottom:-14px;width:2px;height:2px;border-radius:50%;
      opacity:0;animation:hBrasa linear infinite}
    @keyframes hBrasa{
      0%{opacity:0;transform:translate3d(0,0,0) scale(.4)}
      10%{opacity:.6}
      55%{opacity:.38}
      100%{opacity:0;transform:translate3d(var(--dx,14px),-100vh,0) scale(1.1)}
    }

    /* Véu: a membrana do Outro Lado passando devagar sobre a tela. Uma
       faixa larguíssima e translúcida — quase imperceptível parada, e é
       justamente o "quase" que dá a sensação de ar em movimento. */
    .h-amb-veu{position:absolute;left:-20%;right:-20%;height:60%;
      background:linear-gradient(180deg,transparent,var(--brasao-veu) 40%,var(--brasao-veu) 60%,transparent);
      animation:hVeu 38s ease-in-out infinite}
    @keyframes hVeu{0%{transform:translate3d(0,-70%,0)}50%{transform:translate3d(0,120%,0)}100%{transform:translate3d(0,-70%,0)}}

    /* fio de luz que atravessa a tela de vez em quando, como reflexo em lâmina */
    .h-amb-lamina{position:absolute;top:0;bottom:0;left:-220px;width:200px;
      background:linear-gradient(90deg,transparent,var(--gold-veil),var(--brasao-veu),transparent);
      animation:hLamina 26s ease-in-out infinite}
    /* transform, e não a propriedade left: animar left é layout a cada frame. */
    @keyframes hLamina{0%{transform:translate3d(0,0,0)}55%,100%{transform:translate3d(calc(100vw + 240px),0,0)}}

    .h-amb-grao{position:absolute;inset:0;opacity:.05;background-image:${GRAO}}
    .h-amb-vinheta{position:absolute;inset:0;
      background:radial-gradient(120% 100% at 50% 45%, transparent 48%, rgba(0,0,0,.62) 100%)}

    /* ══════════════════════════════════════════════════════════════════
       4. TIPOGRAFIA — gravada em metal, com o Outro Lado por trás
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
        radial-gradient(80% 32% at 0% 0%, var(--brasao-dim), transparent 70%),
        linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%) !important;
      box-shadow:inset -1px 0 0 rgba(0,0,0,.6), 6px 0 26px -18px #000;
    }
    /* filete na borda direita: o gume que separa a barra do conteúdo. Sobe de
       ametista (embaixo, onde a névoa está) para ouro (em cima, na luz). */
    .sidebar-desktop::after{content:"";position:absolute;top:0;right:0;bottom:0;width:1px;
      background:linear-gradient(180deg,transparent,var(--border2) 16%,var(--gold-veil) 52%,var(--brasao-halo) 88%,transparent);
      pointer-events:none}
    .sidebar-desktop .nav-item,.sidebar-desktop nav button{border-radius:3px !important}

    /* topbar: chapa mais escura que o conteúdo, com brilho de vela no topo */
    .topbar-sys{letter-spacing:.06em}
    /* A BARRA em si (quick 007). Era var(--surface) chapado com um filete de
       borda — o único pedaço do casco que ficou sem material nas repaginações.
       Vira chapa: bisel em cima, sombra caindo sobre o conteúdo, e o filete
       de baixo repete o gradiente ametista→ouro do gume da sidebar, para o
       casco inteiro ler como UMA peça forjada. */
    .h-topbar{
      background:
        linear-gradient(180deg, rgba(255,255,255,.03) 0%, transparent 55%),
        radial-gradient(60% 100% at 100% 0%, var(--brasao-dim), transparent 70%),
        linear-gradient(180deg, var(--surface) 0%, var(--bg) 140%) !important;
      border-bottom:none !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.045), 0 10px 26px -18px #000;
    }
    .h-topbar::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;
      pointer-events:none;
      background:linear-gradient(90deg,var(--brasao-halo),var(--border2) 30%,var(--gold-veil) 68%,transparent)}
    /* O emblema do Ordem Paranormal na tela de seleção é um .webp roxo
       (assets/higgsfield). Na repaginação de 2026-08-05 ele levava um filtro
       sepia para virar ouro, porque a identidade tinha ido para o carmesim.
       Com o roxo de volta (2026-08-06) a arte original JÁ está na cor certa —
       o filtro foi removido em vez de trocado por outro. */

    /* ══════════════════════════════════════════════════════════════════
       8. GRAMÁTICA NX — as telas de conteúdo (Fichas, Campanhas, Planos…)
       ══════════════════════════════════════════════════════════════════ */
    /* Cabeçalho de tela vira um brasão: sobrancelha com filete, título gravado
       e uma régua dupla embaixo (grosso + fino), como gravação em placa. */
    .nx-head{position:relative;padding-bottom:20px !important;border-bottom:none !important}
    .nx-head::before{content:"";position:absolute;left:0;right:0;bottom:3px;height:1px;
      background:linear-gradient(90deg,var(--border2),var(--brasao-halo) 28%,transparent 74%)}
    .nx-head::after{content:"";position:absolute;left:0;bottom:0;width:120px;height:1px;
      background:linear-gradient(90deg,var(--gold),transparent)}
    .nx-eyebrow{position:relative;padding-left:18px;color:var(--muted2) !important}
    .nx-eyebrow::before{content:"◈";position:absolute;left:0;top:-1px;
      font-size:9px;color:var(--gold);opacity:.9}
    /* O título é ouro gravado com HALO DE AMETISTA — as duas cores no mesmo
       elemento, cada uma no seu papel: o metal é o ouro, a luz por trás é o
       Outro Lado. */
    .nx-h1{font-family:'Cinzel Decorative',serif !important;font-weight:700 !important;
      letter-spacing:.03em !important;color:var(--text) !important;
      font-size:clamp(24px,2.6vw,34px) !important;animation:hVela 7s ease-in-out infinite;
      text-shadow:0 1px 0 rgba(0,0,0,.6), 0 0 30px var(--brasao-glow) !important}

    /* VERSAL — REMOVIDO por decisão do Andre (2026-08-10), na mesma sessão em
       que entrou. A quick 008 aplicou ".nx-h1::first-letter" (inicial ampliada
       e iluminada, a marca da página medieval) em todo título da casa; ele viu
       na tela e pediu de volta ao que era. O título gravado do ".nx-h1" logo
       abaixo — ouro + halo de ametista — continua valendo: o que saiu foi só o
       tratamento da PRIMEIRA LETRA.

       Não recolocar sem falar com ele. Se um dia voltar, o ponto de partida
       está no histórico e no TASK.md da quick 008. */

    /* Título de seção vira faixa: losango + rótulo + régua que corre até a ponta */
    .nx-sec{position:relative;border-bottom:none !important;padding-bottom:11px !important}
    .nx-sec::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;
      background:linear-gradient(90deg,var(--border2),var(--brasao-halo) 30%,transparent)}
    .nx-sec-t{position:relative;padding-left:17px;color:var(--muted2) !important;letter-spacing:.2em !important}
    .nx-sec-t::before{content:"◆";position:absolute;left:0;top:0;font-size:8px;color:var(--gold)}

    /* Faixa de números: cada bloco vira uma chapa gravada, e o hover acende
       um filete de ametista na aresta de cima. */
    .nx-stats{border:none !important;display:grid;gap:12px}
    .nx-stat{position:relative;overflow:hidden;
      background:var(--h-plate) !important;border:1px solid var(--border) !important;
      border-radius:4px !important;box-shadow:var(--h-bevel);
      padding:16px 18px !important;
      transition:transform .28s var(--h-ease),border-color .28s,box-shadow .28s !important}
    .nx-stat::after{content:"";position:absolute;top:0;left:18%;right:18%;height:1px;opacity:0;
      background:linear-gradient(90deg,transparent,var(--brasao2),transparent);
      transition:opacity .3s,left .3s,right .3s}
    .nx-stat:first-child{padding-left:18px !important}
    .nx-stat:hover{transform:translateY(-3px);border-color:var(--gold) !important;
      box-shadow:var(--h-bevel),var(--h-lift),0 0 32px -14px var(--gold-glow)}
    .nx-stat:hover::after{opacity:.85;left:0;right:0}
    /* Cinzel, NÃO Cinzel Decorative: o algarismo 1 da Decorative é um I sem
       pé, e "1/3" virava "I/3" na faixa de cotas. Num bloco cuja função
       inteira é mostrar número, isso não é estilo — é defeito. */
    .nx-stat-num{font-family:'Cinzel',serif !important;font-weight:600 !important;
      color:var(--text) !important}

    /* Linhas: o filete de acento vira gume de ouro, e a linha desliza ao passar */
    .nx-row{border-bottom:1px solid var(--border) !important;border-radius:3px}
    .nx-row::before{background:linear-gradient(180deg,transparent,var(--gold),transparent) !important;
      width:2px !important}
    .nx-row:hover{background:linear-gradient(90deg,var(--brasao-veu),var(--gold-veil) 26%,transparent 64%) !important}
    .nx-row-t{font-family:'Cinzel',serif !important;letter-spacing:.02em}

    .nx-note{background:var(--h-plate);border:1px solid var(--border);
      border-radius:4px;padding:13px 15px !important;box-shadow:var(--h-bevel)}
    .nx-empty{border-bottom:none !important;position:relative;
      background:radial-gradient(90% 120% at 12% 0%, var(--brasao-dim), transparent 62%);
      border:1px solid var(--border);border-radius:4px;padding:28px 24px 30px !important}

    /* ══════════════════════════════════════════════════════════════════
       9. CARTÕES GENÉRICOS — qualquer superfície que use --card ganha bisel
       Escopo estreito de propósito: só quem já declara a var, para não
       biselar overlay, modal de foto e canvas de mapa por acidente.
       ══════════════════════════════════════════════════════════════════ */
    .stat-card{box-shadow:var(--h-bevel) !important;border-radius:4px !important}

    /* ══════════════════════════════════════════════════════════════════
       10. BARRA DE ROLAGEM — trilho de latão sobre poço de ametista
       ══════════════════════════════════════════════════════════════════ */
    ::-webkit-scrollbar{width:9px;height:9px}
    ::-webkit-scrollbar-track{background:var(--brasao-dim)}
    ::-webkit-scrollbar-thumb{
      background:linear-gradient(180deg,var(--gold),var(--gold3));
      border-radius:0;border:2px solid var(--bg);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
    ::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,var(--gold2),var(--gold))}

    /* ══════════════════════════════════════════════════════════════════
       11. SELEÇÃO E FOCO
       ══════════════════════════════════════════════════════════════════ */
    ::selection{background:var(--brasao-halo);color:var(--text)}
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

    /* ── PAUTA DO ESCRIBA (quick 008) ─────────────────────────────────────
       Quase todo manuscrito medieval era pautado ANTES da escrita, e as
       linhas ficavam à mostra — parte do design, não sujeira a apagar. É o
       que dá "página" a um retângulo: o olho vê o suporte, não só o texto.

       repeating-linear-gradient em vez de imagem: zero requisição, zero
       decode, e a altura da pauta acompanha a tipografia por variável.
       A linha é --gold-veil (alfa 0.07 do acento) — presente e incapaz de
       competir com o conteúdo. */
    .h-pauta{position:relative}
    .h-pauta::before{
      content:"";position:absolute;inset:0;pointer-events:none;z-index:0;
      border-radius:inherit;
      background:repeating-linear-gradient(180deg,
        transparent 0, transparent calc(var(--pauta,27px) - 1px),
        var(--gold-veil) calc(var(--pauta,27px) - 1px), var(--gold-veil) var(--pauta,27px));
      /* some nas bordas: pauta que encosta na moldura lê como listra */
      -webkit-mask-image:linear-gradient(180deg,transparent,#000 12%,#000 88%,transparent);
      mask-image:linear-gradient(180deg,transparent,#000 12%,#000 88%,transparent);
    }

    /* ── PICOTAGEM (quick 008) ────────────────────────────────────────────
       Os furos de sovela que o escriba abria na margem para a pauta bater de
       página a página. Nasceu na folha de rosto do dossiê (quick 006) por
       intuição; a fonte confirmou o nome e a função, então virou ornamento
       global. O miolo é --bg: é a mesa aparecendo pelo furo — o que faz o
       painel ler como uma coisa SOBRE outra, e não como uma cor de fundo. */
    .h-picote{position:relative}
    /* RAIO EXPLÍCITO (circle 3.5px), não porcentagem: com "circle at 50% 50%"
       o gradiente se ajusta à caixa do tile (9 x 58px) e o furo saía como uma
       BARRA vertical preta em vez de furo — pego na tela, não no gate. */
    .h-picote::after{
      content:"";position:absolute;left:10px;top:18px;bottom:18px;width:9px;
      pointer-events:none;z-index:1;
      background:radial-gradient(circle 3.5px at 4.5px 50%,
        var(--bg) 0 62%, rgba(0,0,0,.8) 78%, transparent 100%);
      background-size:9px var(--picote,58px); background-repeat:repeat-y;
    }

    /* ── CHAPA DE CARD (quick 008) ────────────────────────────────────────
       A superfície padrão que faltava: até aqui CADA tela inventava o seu
       card com estilo inline, e é por isso que Planos, Trilhas e Mapas
       pareciam de outro app. Uma classe, e todas passam a ser a mesma peça. */
    .nx-card{
      position:relative;border-radius:4px;
      background:var(--h-plate);border:1px solid var(--border);
      box-shadow:var(--h-bevel), 0 12px 26px -16px rgba(0,0,0,.6);
      transition:transform .28s var(--h-ease),border-color .28s,box-shadow .28s}
    /* filete iluminado na aresta de cima, como o das chapas de número */
    .nx-card::before{content:"";position:absolute;top:0;left:16%;right:16%;height:1px;
      opacity:.45;pointer-events:none;transition:opacity .3s,left .3s,right .3s;
      background:linear-gradient(90deg,transparent,var(--brasao2) 32%,var(--gold) 72%,transparent)}
    .nx-card:hover{transform:translateY(-3px);border-color:var(--gold);
      box-shadow:var(--h-bevel),var(--h-lift),0 0 34px -16px var(--brasao-glow)}
    .nx-card:hover::before{opacity:1;left:0;right:0}
    /* z-index:1 porque a pauta é um ::before em z-index:0 — sem isto o
       título ficaria DEBAIXO das linhas do escriba em vez de sobre elas. */
    .nx-card-t{position:relative;z-index:1;margin-bottom:8px;
      font-family:'Cinzel Decorative',serif;font-size:18px;
      text-shadow:0 1px 0 rgba(0,0,0,.6)}

    /* ── FÓLIO (quick 008) ────────────────────────────────────────────────
       A assinatura de rodapé de página do códice. Discreto por definição —
       fólio serve ao encadernador, não ao leitor. */
    .h-folio{font-family:'Courier Prime','IBM Plex Mono',monospace;font-size:8.5px;
      letter-spacing:.2em;text-transform:uppercase;color:var(--muted);opacity:.75}

    /* PASTA DE ARQUIVO (quick 007) — aplique .h-pasta num card relativo e
       ponha <span class="h-pasta-aba">…</span> como primeiro filho: vira a
       aba que sobe da pasta, com o rótulo datilografado. Nasceu para a
       listagem de fichas carregar o MESMO número de processo que o dossiê
       mostra lá dentro — a pasta na estante e o documento dentro dela são o
       mesmo processo, e o olho liga as duas telas sem ninguém explicar.
       Token puro: em D&D a aba fica ferro-e-brasa sozinha. */
    .h-pasta{position:relative}
    .h-pasta-aba{position:absolute;top:0;left:14px;transform:translateY(-100%);z-index:2;
      max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-family:'Courier Prime','IBM Plex Mono',monospace;font-size:9.5px;
      letter-spacing:.12em;color:var(--muted2);
      background:linear-gradient(180deg,var(--card2),var(--card));
      border:1px solid var(--border2);border-bottom:none;border-radius:4px 4px 0 0;
      padding:3px 11px 2px;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
    /* a aba acende junto com o hover do card — é a mesma pasta, não um chip */
    .h-pasta:hover .h-pasta-aba{color:var(--gold2);border-color:var(--gold)}

    /* ══════════════════════════════════════════════════════════════════
       13. MOVIMENTO REDUZIDO — mesma tela, parada
       ══════════════════════════════════════════════════════════════════ */
    @media(prefers-reduced-motion:reduce){
      .h-amb-brasa,.h-amb-lamina,.h-amb-veu,.h-amb-sigilo{display:none}
      .h-amb-aurora i,.h-amb-nevoa{animation:none}
      .nx-h1{animation:none}
      .btn-gold::after{display:none}
      *,*::before,*::after{animation-duration:.001ms !important;transition-duration:.001ms !important}
    }
    `}</style>
  );
}

/* Éter: posição, deriva e duração FIXAS por índice. Nada de Math.random(),
   que re-sortearia a cada render e faria a partícula saltar de lugar. */
const BRASAS = [4, 11, 19, 27, 34, 42, 51, 58, 66, 73, 81, 88, 94, 15, 63];

/* Marcas de graduação do sigilo, geradas por índice. */
const dentes = (qtd, raio, comp) =>
  Array.from({ length: qtd }, (_, i) => {
    const a = (i * 2 * Math.PI) / qtd;
    const cos = Math.cos(a);
    const sen = Math.sin(a);
    return {
      k: i,
      x1: 200 + cos * raio, y1: 200 + sen * raio,
      x2: 200 + cos * (raio + comp), y2: 200 + sen * (raio + comp),
    };
  });

/**
 * Marca a subárvore com `data-parado` quando a aba perde a visibilidade, para
 * o CSS congelar as animações dela (`animation-play-state:paused`).
 *
 * Existe porque `animation-play-state` não tem gatilho em CSS puro —
 * `document.hidden` é a única fonte. Sem isto, um app deixado em segundo
 * plano segue queimando GPU para pintar névoa, éter e anéis que ninguém está
 * vendo. É um listener só, e o atributo entra por `dataset`: nenhum re-render
 * do React, nenhum estado.
 *
 * @returns {import('react').RefObject<HTMLElement>} ref para o elemento raiz
 *   da subárvore animada.
 */
export function usePausaSeOculto() {
  const ref = useRef(null);

  useEffect(() => {
    const sincronizar = () => {
      const el = ref.current;
      if (el) el.dataset.parado = document.hidden ? "1" : "0";
    };
    sincronizar();
    document.addEventListener("visibilitychange", sincronizar);
    return () => document.removeEventListener("visibilitychange", sincronizar);
  }, []);

  return ref;
}

/**
 * Ambiente do Outro Lado: aurora de ametista à deriva, névoa no rodapé, um
 * sigilo girando atrás de tudo, éter subindo, o véu passando e o grão por
 * cima. Fica atrás de todo o conteúdo (`z-index:0`, `pointer-events:none`) e
 * congela inteiro quando a aba some (ver `usePausaSeOculto`).
 */
export function HeraldicAmbience({ semSigilo = false } = {}) {
  const ref = usePausaSeOculto();

  return (
    <div className="h-amb" ref={ref} aria-hidden="true">
      <div className="h-amb-aurora"><i /><i /><i /></div>
      {/* `semSigilo`: a vitrine de sistemas troca este hexagrama genérico pelo
          brasão da casa (features/sistemas/CarrosselDeBrasoes). Dois sigilos
          girando um sobre o outro viraria sopa — quem tem brasão próprio não
          precisa do ornamento neutro. */}
      {semSigilo ? null : (
      <div className="h-amb-sigilo">
        <svg viewBox="0 0 400 400" fill="none">
          <g stroke="var(--brasao2)" strokeWidth="1">
            <circle cx="200" cy="200" r="196" />
            <circle cx="200" cy="200" r="182" opacity="0.6" />
            <circle cx="200" cy="200" r="118" opacity="0.5" />
            {dentes(64, 182, 14).map((m) => (
              <line key={m.k} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2}
                opacity={m.k % 8 === 0 ? 1 : 0.32} />
            ))}
            {dentes(8, 118, 78).map((m) => (
              <line key={`r${m.k}`} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} opacity="0.4" />
            ))}
          </g>
          <g stroke="var(--gold)" strokeWidth="1.2" opacity="0.55">
            <circle cx="200" cy="200" r="60" />
            <path d="M200 140 L252 230 L148 230 Z" />
            <path d="M200 260 L148 170 L252 170 Z" />
          </g>
        </svg>
      </div>
      )}
      <div className="h-amb-nevoa" />
      <div className="h-amb-veu" />
      <div className="h-amb-lamina" />
      {BRASAS.map((esq, i) => (
        <span
          key={`${esq}-${i}`}
          className="h-amb-brasa"
          style={{
            left: `${esq}%`,
            "--dx": `${(i % 2 ? 1 : -1) * (8 + (i % 4) * 9)}px`,
            /* duas em cada três são do Outro Lado, e essas carregam halo —
               é o que faz o éter roxo parecer luz e o ouro parecer faísca */
            background: i % 3 === 0 ? "var(--gold2)" : "var(--brasao2)",
            boxShadow: i % 3 === 0 ? "none" : "0 0 7px 1px var(--brasao-halo)",
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
