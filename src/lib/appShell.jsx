/* Casca visual de TODA tela — o bloco global de CSS (`G`) e o `Shell` que o casa com as
   CSS vars do tema ativo. Saiu do App.jsx (spec 0031, onda C) porque DOIS contextos o
   montam: o próprio App (login, seleção de sistema, criadores, shell logado, `CastView`)
   e a visão pública da ficha (`features/ficha/PublicSheetView`), que é servida por
   early-return antes do gate da intro. Copiar seria divergência garantida (AC-7).

   O `Shell` continua em ESCOPO DE MÓDULO de propósito: declarar dentro de um componente
   criaria um tipo novo a cada render e remontaria as tags <style>. */
import { ThemeStyles } from "../themes/ThemeProvider";

/* ─── FONTS & GLOBAL CSS ─── */
const G = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;500;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{-webkit-text-size-adjust:100%}
    /* Fallback de boot (spec 0023). O registry (themes/index.js, via <ThemeStyles/>)
       vence por especificidade — :root[data-nexus-system] é (0,2,0) contra (0,1,0).
       Estes valores espelham a escala grafite do sistema padrão (op) para que o
       primeiro frame e a IntroScreen (que não monta este bloco) não pisquem escuro. */
    :root{
      --bg:#14141c;
      --surface:#1c1c26;
      --card:#24242f;
      --card2:#2c2c39;
      --border:rgba(201,168,76,0.18);
      --border2:rgba(201,168,76,0.34);
      --gold:#c9a84c;
      --gold2:#e8c96d;
      --gold3:#a07830;
      --gold-glow:rgba(201,168,76,0.22);
      --gold-dim:rgba(201,168,76,0.09);
      --text:#e8e4d9;
      --muted:#a89a7c;
      --muted2:#c8b48e;
      --danger:#8b2020;
      --purple:#8e6dbf;
      --purple2:#c8a8f0;
      --purple-glow:rgba(142,109,191,0.3);
      --purple-dim:rgba(142,109,191,0.12);
    }
    body{background:var(--bg);font-family:'Crimson Pro',serif;overflow-x:hidden}
    ::-webkit-scrollbar{width:3px}
    ::-webkit-scrollbar-thumb{background:var(--gold3);border-radius:2px}

    input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
    input[type=number]{-moz-appearance:textfield}
    @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(201,168,76,0.15)}50%{box-shadow:0 0 40px rgba(201,168,76,0.35)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    @keyframes flicker{0%,100%{opacity:1}92%{opacity:1}93%{opacity:0.7}94%{opacity:1}97%{opacity:.85}98%{opacity:1}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes borderGlow{0%,100%{border-color:rgba(201,168,76,0.2)}50%{border-color:rgba(201,168,76,0.6)}}
    @keyframes critAura{0%,100%{box-shadow:0 0 8px 3px rgba(255,215,0,0.9),0 0 22px 8px rgba(255,180,0,0.55),0 0 44px 16px rgba(201,168,76,0.25);color:#ffe86a}50%{box-shadow:0 0 16px 6px rgba(255,215,0,1),0 0 40px 14px rgba(255,180,0,0.8),0 0 70px 28px rgba(201,168,76,0.45);color:#fff5a0}}
    @keyframes critPopupGlow{0%,100%{box-shadow:0 0 0 1px rgba(255,200,0,0.6),0 6px 32px rgba(0,0,0,0.9),0 0 20px rgba(255,180,0,0.25)}50%{box-shadow:0 0 0 1px rgba(255,215,0,0.9),0 6px 32px rgba(0,0,0,0.9),0 0 40px rgba(255,180,0,0.55),0 0 80px rgba(201,168,76,0.2)}}
    @keyframes statCardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes skeletonPulse{0%,100%{opacity:0.35}50%{opacity:0.6}}
    @keyframes live-dot{0%,49%{opacity:1;text-shadow:0 0 6px #4ade80}50%,100%{opacity:0;text-shadow:none}}
    @keyframes live-badge-glow{0%,100%{box-shadow:0 0 0 rgba(74,222,128,0)}50%{box-shadow:0 0 10px rgba(74,222,128,0.5),0 0 20px rgba(74,222,128,0.15)}}
    .logo-float{animation:float 4s ease-in-out infinite}
    .stat-card{cursor:pointer;transition:transform 0.2s ease,box-shadow 0.2s ease,border-color 0.2s ease}
    .stat-card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,0.4);border-color:rgba(255,255,255,0.22)!important}
    .stat-card:hover span[aria-hidden]{opacity:0.9}
    .stat-card:active{transform:translateY(0)}
    .stat-card:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
    .skeleton{background:linear-gradient(90deg,rgba(255,255,255,0.05) 25%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.05) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:4px}
    [role="button"]:focus-visible{outline:2px solid rgba(201,168,76,0.8);outline-offset:3px;border-radius:10px}
    a:focus-visible{outline:2px solid rgba(201,168,76,0.8);outline-offset:2px;border-radius:3px}

    .fade{animation:fadeIn 0.5s ease forwards}
    /* Crossfade do wrapper de telas (spec 0017): SO opacity, sem transform. Um transform
       aqui (mesmo o translateY(0) final retido pelo fill-mode forwards) criaria containing
       block e prenderia descendentes position:fixed (ex.: MapEditor inset:0) dentro do
       wrapper, quebrando o modo tela-cheia. Por isso NAO reusa a classe .fade. */
    @keyframes fadeScreen{from{opacity:0}to{opacity:1}}
    .fade-screen{animation:fadeScreen 0.5s ease}

    .btn-gold{
      font-family:'Cinzel',serif;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;
      padding:12px 24px;border-radius:4px;cursor:pointer;transition:all 0.25s;
      background:linear-gradient(135deg,#c9a84c,#e8c96d,#a07830);
      border:none;color:#050505;font-weight:700;
      box-shadow:0 4px 20px rgba(201,168,76,0.3);
    }
    .btn-gold:hover{filter:brightness(1.15);transform:translateY(-1px);box-shadow:0 6px 30px rgba(201,168,76,0.5)}
    .btn-ghost{
      font-family:'Cinzel',serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;
      padding:11px 22px;border-radius:4px;cursor:pointer;transition:all 0.25s;
      background:transparent;border:1px solid var(--border2);color:var(--gold);
    }
    .btn-ghost:hover{background:var(--gold-dim);border-color:var(--gold)}
    .nav-item{
      font-family:'Cinzel',serif;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;
      padding:8px 14px;border-radius:3px;cursor:pointer;border:none;
      background:transparent;color:var(--muted2);transition:all 0.2s;display:flex;align-items:center;gap:7px;
    }
    .nav-item:hover{background:rgba(255,255,255,0.06);color:var(--text)}
    .nav-item.active{color:var(--purple2);background:var(--purple-dim)}
    input,textarea{
      font-family:'Crimson Pro',serif;font-size:16px;
      background:var(--card2);border:1px solid var(--border);border-radius:5px;
      color:var(--text);outline:none;transition:border-color 0.2s;
      padding:11px 14px;width:100%;
    }
    input:focus,textarea:focus{border-color:rgba(201,168,76,0.5)}
    input::placeholder{color:var(--muted)}

    /* ══════════════════════════════════════════════════════════════════
       NX LAYOUT — gramática editorial única para as telas de conteúdo.

       Por que existe: cada tela desenhava o próprio cabeçalho, os próprios
       cards e os próprios espaçamentos inline. O resultado era o sintoma
       clássico de tela montada peça por peça — a mesma informação em três
       lugares, cards dentro de cards, e um número diferente de pixels de
       respiro em cada seção. Aqui a régua é uma só:

         · UMA faixa de cabeçalho por tela (sobrancelha + título + ação)
         · separador = filete de 1px, NÃO uma caixa
         · profundidade se ganha com espaço em branco, não com borda+sombra
         · o acento é pontuação, não tinta de fundo
       ══════════════════════════════════════════════════════════════════ */
    .nx-page{display:flex;flex-direction:column;gap:26px;width:100%;max-width:1180px;margin:0 auto}

    /* Cabeçalho de tela — some a "caixa herói"; o filete abaixo é o que separa */
    .nx-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
      flex-wrap:wrap;padding-bottom:16px;border-bottom:1px solid var(--border)}
    .nx-head-txt{min-width:0;flex:1}
    .nx-eyebrow{font-family:'Cinzel',serif;font-size:10px;letter-spacing:0.2em;
      text-transform:uppercase;color:var(--muted);line-height:1}
    /* Peso 500, não 700: título de página é hierarquia, não grito.
       Sem background-clip/gradiente — texto com degradê é a impressão
       digital mais reconhecível de layout cuspido por IA. */
    .nx-h1{font-family:'Cinzel',serif;font-weight:500;color:var(--text);
      font-size:clamp(21px,2.1vw,27px);line-height:1.16;letter-spacing:0.015em;margin-top:8px}
    .nx-sub{font-size:14.5px;color:var(--muted);line-height:1.5;margin-top:7px;max-width:60ch}
    .nx-head-actions{display:flex;align-items:center;gap:14px;flex-shrink:0;padding-bottom:3px}

    /* Faixa de números — blocos separados por filete vertical, sem caixa nenhuma */
    .nx-stats{display:grid;grid-template-columns:repeat(var(--nx-cols,3),minmax(0,1fr));
      border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
    .nx-stat{display:flex;flex-direction:column;gap:7px;padding:16px 20px;text-align:left;
      background:none;border:none;border-left:1px solid var(--border);cursor:pointer;
      transition:background 0.18s ease}
    .nx-stat:first-child{border-left:none;padding-left:2px}
    .nx-stat:hover{background:rgba(255,255,255,0.022)}
    .nx-stat:focus-visible{outline:2px solid var(--gold);outline-offset:-2px}
    .nx-stat-num{font-family:'IBM Plex Mono','Share Tech Mono',monospace;font-size:27px;
      font-weight:400;color:var(--text);line-height:1;font-variant-numeric:tabular-nums}
    .nx-stat-cap{font-family:'Cinzel',serif;font-size:9.5px;letter-spacing:0.16em;
      text-transform:uppercase;color:var(--muted);line-height:1}

    /* Corpo 2/1 — conteúdo à esquerda, trilho de contexto à direita.
       É o que impede a tela de terminar no meio e deixar 300px de vazio. */
    .nx-split{display:grid;grid-template-columns:minmax(0,1.85fr) minmax(0,1fr);
      gap:34px;align-items:start}

    /* Título de seção — mesmo filete do cabeçalho, um nível abaixo */
    .nx-sec{display:flex;align-items:baseline;justify-content:space-between;gap:14px;
      padding-bottom:9px;border-bottom:1px solid var(--border);margin-bottom:2px}
    .nx-sec-t{font-family:'Cinzel',serif;font-size:11px;letter-spacing:0.16em;
      text-transform:uppercase;color:var(--muted)}
    .nx-sec-a{font-family:'Cinzel',serif;font-size:10px;letter-spacing:0.1em;
      text-transform:uppercase;color:var(--muted);background:none;border:none;
      cursor:pointer;transition:color 0.18s}
    .nx-sec-a:hover{color:var(--gold)}

    /* Lista — linhas separadas por filete. Sem card por item: 8 cards
       empilhados viram 8 retângulos competindo; 8 linhas viram uma tabela. */
    .nx-list{display:flex;flex-direction:column}
    /* Variante para itens que JÁ são cartão (DossierCard): eles trazem borda e
       raio próprios, então o filete do .nx-row não serve — encostados, duas
       bordas de 1px viram um traço duplo e os cantos arredondados se pinçam.
       Aqui a separação é espaço, não linha. */
    .nx-list-cards{gap:10px}
    .nx-row{display:flex;align-items:center;gap:14px;width:100%;text-align:left;
      padding:13px 8px;background:none;border:none;border-bottom:1px solid var(--border);
      cursor:pointer;transition:background 0.18s ease,padding-left 0.18s ease;position:relative}
    .nx-row:hover{background:rgba(255,255,255,0.03);padding-left:13px}
    .nx-row:focus-visible{outline:2px solid var(--gold);outline-offset:-2px}
    .nx-row::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;
      background:var(--gold);opacity:0;transition:opacity 0.18s}
    .nx-row:hover::before{opacity:0.85}
    .nx-row-t{font-family:'Cinzel',serif;font-size:15px;color:var(--text);line-height:1.25;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .nx-row-m{font-size:12.5px;color:var(--muted);margin-top:3px;line-height:1.3;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    /* Trilho lateral — painéis de contexto, sem caixa */
    .nx-rail{display:flex;flex-direction:column;gap:24px}
    .nx-note{display:flex;flex-direction:column;gap:5px;padding:11px 0;
      border-bottom:1px solid var(--border);font-size:13px;color:var(--muted2);line-height:1.45}
    .nx-note-k{font-family:'IBM Plex Mono','Share Tech Mono',monospace;font-size:10.5px;
      letter-spacing:0.06em;color:var(--muted)}

    /* Vazio — um bloco de texto alinhado à esquerda com a lista, não um
       pôster centralizado com ícone gigante e dois botões concorrentes */
    /* o filete acompanha a coluna inteira (é o mesmo separador da lista que
       viria aqui); só o TEXTO é medido em 52ch para não virar linha larga */
    .nx-empty{padding:30px 8px 34px;border-bottom:1px solid var(--border)}
    .nx-empty-t{font-family:'Cinzel',serif;font-size:15px;color:var(--text);margin-bottom:8px}
    .nx-empty-d{font-size:14px;color:var(--muted);line-height:1.55;margin-bottom:18px;max-width:52ch}

    /* Botão secundário de texto — o par calmo do .btn-gold. Existe para que
       a tela tenha UM botão preenchido; o resto é texto com filete. */
    .nx-btn{font-family:'Cinzel',serif;font-size:10px;letter-spacing:0.12em;
      text-transform:uppercase;padding:11px 18px;border-radius:4px;cursor:pointer;
      background:none;border:1px solid var(--border2);color:var(--muted2);
      transition:color 0.2s,border-color 0.2s}
    .nx-btn:hover{color:var(--text);border-color:var(--gold)}

    /* Faixa "Retomar" — UMA linha entre dois filetes. Não é card: não tem
       fundo, raio nem sombra. É o mesmo separador da lista usado duas vezes. */
    .nx-resume{display:flex;align-items:center;gap:10px;width:100%;text-align:left;
      padding:12px 8px;min-height:44px;background:none;cursor:pointer;
      border:none;border-top:1px solid var(--border);border-bottom:1px solid var(--border);
      transition:background 0.18s ease,padding-left 0.18s ease}
    .nx-resume:hover{background:rgba(255,255,255,0.03);padding-left:13px}
    .nx-resume:focus-visible{outline:2px solid var(--gold);outline-offset:-2px}

    /* Grade de campanhas — o CampaignCard já traz capa e borda próprias */
    .nx-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;padding-top:14px}

    /* Checklist de preparo — linha de item, alvo de 44px, sem barra de progresso */
    .nx-check{display:flex;align-items:center;gap:12px;width:100%;text-align:left;
      min-height:44px;padding:0 4px;background:none;border:none;
      border-bottom:1px solid var(--border);transition:background 0.18s ease}
    .nx-check:focus-visible{outline:2px solid var(--gold);outline-offset:-2px}
    button.nx-check{cursor:pointer}
    button.nx-check:hover{background:rgba(255,255,255,0.03)}

    @media(max-width:900px){
      .nx-split{grid-template-columns:1fr;gap:26px}
    }
    @media(max-width:640px){
      /* A faixa NÃO empilha mais. Empilhada, dois ou três números viravam
         ~150px de altura antes de "Seus personagens" — no celular o conteúdo
         que importa nascia abaixo da dobra por causa de contadores de um
         dígito. Eles continuam lado a lado, só menores. */
      .nx-stat{padding:13px 10px}
      .nx-stat-num{font-size:21px}
      .nx-stat-cap{font-size:8.5px;letter-spacing:0.1em}
      .nx-head{align-items:flex-start}
      .nx-head-actions{width:100%}
      /* Uma coluna: 230px de mínimo não cabe em 390px sem estourar */
      .nx-cards{grid-template-columns:1fr}
    }

    /* ── MOBILE BOTTOM NAV ── */
    .sidebar-desktop{display:flex}
    .bottomnav{display:none}

    /* ── RESPONSIVE LAYOUTS ── */
    .sheet-grid{display:grid;grid-template-columns:300px 1fr 1fr;gap:14px;align-items:start}
    .dash-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .dash-sessions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .creator-attrs{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start}
    .creator-classes{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
    .system-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
    .topbar-sys{display:flex}
    .main-pad{padding:28px}
    .step-bar{display:flex}
    .step-bar-mobile{display:none}
    .char-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:4px 16px}

    @media(max-width:768px){
      .sidebar-desktop{display:none !important}
      /* hero da campanha: no mobile os botões overlay viram só ícone */
      .camp-hero-btn-label{display:none}
      /* ── HERO COMPACTO SEMPRE, NO CELULAR ──────────────────────────
         458 px é tudo o que sobra de app em 390×844. Uma capa de 200 px
         come 38% disso. Aqui ela é sempre a faixa de 56 px, em qualquer
         aba — e a linha única é também o que resolve a colisão medida
         entre "← VOLTAR" e o nome da campanha em 350 px de largura. */
      .camp-hero{height:56px !important;display:flex !important;align-items:center;gap:8px;padding:0 10px !important}
      .camp-hero-img{opacity:0.4 !important}
      .camp-hero-topo{position:static !important;flex-shrink:0}
      .camp-hero-base{position:static !important;flex:1 !important;min-width:0;align-items:center !important}
      .camp-hero-titulo{font-size:15px !important}
      .camp-hero-chips{display:none !important}
      /* O "display:flex" inline do AppFooter vencia esta classe e o rodapé
         continuava no celular, colado na barra inferior. 55 px de volta.
         NÃO use crase aqui: este bloco é um template literal, e a crase
         fecha a string — foi o que quebrou o build (spec 0029, gate da Task 2). */
      .nexus-footer{display:none !important}
      .bottomnav{
        display:flex;position:fixed;bottom:0;left:0;right:0;z-index:200;
        background:rgba(26,26,35,0.94);border-top:1px solid var(--border);
        backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
        padding:0 0 env(safe-area-inset-bottom,0);
        box-shadow:0 -4px 20px rgba(0,0,0,0.35);
      }
      .bottomnav button{
        flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:3px;padding:10px 2px 8px;background:none;border:none;cursor:pointer;
        font-family:'Cinzel',serif;font-size:10px;letter-spacing:0.4px;text-transform:uppercase;
        color:var(--muted);transition:all 0.2s;min-height:58px;-webkit-tap-highlight-color:transparent;
      }
      .bottomnav button svg{width:20px;height:20px;opacity:0.7;transition:opacity 0.2s}
      .bottomnav button.active{color:var(--gold)}
      .bottomnav button.active svg{opacity:1;filter:drop-shadow(0 0 5px var(--gold))}
      .bottomnav button:active{background:rgba(255,255,255,0.05)}
      .sheet-grid{grid-template-columns:1fr !important}
      .dash-stats{grid-template-columns:1fr}
      .dash-sessions{grid-template-columns:1fr}
      .creator-attrs{grid-template-columns:1fr}
      .creator-classes{grid-template-columns:1fr}
      .system-grid{grid-template-columns:1fr}
      .topbar-sys{display:none}
      .main-pad{padding:16px 12px;padding-bottom:80px}
      .step-bar{display:none}
      .step-bar-mobile{display:flex;overflow-x:auto;gap:0;padding:0 16px;scrollbar-width:none}
      .step-bar-mobile::-webkit-scrollbar{display:none}
      .char-meta{grid-template-columns:repeat(2,1fr)}
      .btn-gold{padding:10px 18px;font-size:0.75rem;letter-spacing:0.08em}
      .btn-ghost{padding:10px 16px}
      .login-card{padding:28px 20px !important;max-width:100% !important}
      main{padding-bottom:calc(72px + env(safe-area-inset-bottom,0)) !important}
      .nexus-footer{display:none}
    }

    @media(max-width:480px){
      .dash-stats{grid-template-columns:1fr}
      .char-meta{grid-template-columns:1fr 1fr}
    }

    /* ── DOSSIER CARD (dashboard OP) ── */
    .op-dossier-card{ -webkit-tap-highlight-color:transparent; }
    @media(max-width:500px){
      .op-dossier-card{ flex-wrap:wrap; padding:10px 12px; gap:10px; }
      .op-dossier-vitals{ min-width:0 !important; width:100%; flex-direction:row !important; align-items:center; gap:12px !important; }
      .op-dossier-vitals>:last-child{ margin-left:auto; }
    }

    /* ── DESKTOP LOGIN LAYOUT ── */
    .login-layout{display:flex;min-height:100vh}
    .login-left{display:none;flex-direction:column;justify-content:center;width:56%;padding:40px 64px;position:relative;overflow-y:auto;border-right:1px solid var(--border)}
    .login-right{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 20px;position:sticky;top:0;height:100vh;overflow-y:auto}

    @media(min-width:1024px){
      .login-left{display:flex}
      .login-right{padding:60px 48px}
      .login-card{max-width:400px !important;width:100% !important}
      .login-logo-mobile{display:none !important}
      .login-quote-mobile{display:none !important}
    }

    /* ── LOGIN MOBILE (<1024px): rola sem cortar ──
       O container antigo (height:100vh + overflow-y:auto + align-items:center) cortava o
       TOPO do card quando ele passava da altura da tela (bug clássico de flex-center com
       overflow). Aqui o container cresce (min-height:100dvh, sem altura fixa) e o card
       centraliza por margin:auto — que, ao contrário de align-items:center, mantém o topo
       rolável quando o conteúdo é mais alto que a viewport. 100dvh evita a barra de URL. */
    @media(max-width:1023px){
      .login-layout{display:block;min-height:100dvh}
      .login-right{
        position:relative !important; height:auto !important; min-height:100dvh;
        overflow:hidden !important; align-items:flex-start;
        padding:calc(20px + env(safe-area-inset-top,0)) 16px calc(24px + env(safe-area-inset-bottom,0)) !important;
      }
      .login-card{margin:auto !important; animation:none !important}
    }

    /* ══ SPEC 0017 — MOTION LANGUAGE + AMBIENT (Higgsfield assets) ══ */
    /* Ambient video/poster backdrop (login + seleção) */
    .nx-ambient{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
    .nx-ambient video,.nx-ambient img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.45}
    .nx-ambient::after{content:"";position:absolute;inset:0;
      background:radial-gradient(ellipse at 50% 25%,transparent 0%,var(--bg) 88%),
                 linear-gradient(to bottom,rgba(0,0,0,0.55),transparent 35%,var(--bg))}
    /* Staggered entrance — parent sets --i on children via inline style */
    @keyframes nx-stagger-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    .nx-stagger>*{opacity:0;animation:nx-stagger-in 0.5s cubic-bezier(0.16,1,0.3,1) both;
      animation-delay:calc(var(--i,0)*70ms)}
    /* Diagonal shimmer sweep (botão / selo) via pseudo-element */
    @keyframes nx-shimmer{0%{transform:translateX(-130%) skewX(-18deg)}60%,100%{transform:translateX(240%) skewX(-18deg)}}
    .nx-shimmer{position:relative;overflow:hidden}
    .nx-shimmer::after{content:"";position:absolute;top:0;left:0;height:100%;width:38%;
      background:linear-gradient(100deg,transparent,rgba(255,255,255,0.35),transparent);
      transform:translateX(-130%) skewX(-18deg);animation:nx-shimmer 4.5s ease-in-out infinite;pointer-events:none}
    /* Per-system idle video inside the selection card icon, revealed on hover */
    .card-idle-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
      opacity:0;transition:opacity 0.35s ease}
    .sys-card:hover .card-idle-vid,.sys-card:focus-visible .card-idle-vid{opacity:1}
    /* Carrossel: dot ativo preenche com o tempo (7s = intervalo do quote) */
    @keyframes nx-dot-fill{from{width:0}to{width:100%}}
    .nx-progress-dot{position:relative;overflow:hidden}
    .nx-progress-dot::after{content:"";position:absolute;left:0;top:0;bottom:0;width:0;
      background:linear-gradient(90deg,var(--gold3),var(--gold2));border-radius:3px;
      animation:nx-dot-fill 7s linear forwards}
    /* Login field — gold underline that DRAWS in on focus (AC-2); focus is essential so it stays under reduced-motion, just snaps */
    .nx-field{position:relative}
    .nx-field::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;border-radius:2px;
      background:linear-gradient(90deg,var(--gold3),var(--gold2),var(--gold3));
      transform:scaleX(0);transform-origin:center;pointer-events:none;
      transition:transform 0.35s cubic-bezier(0.16,1,0.3,1)}
    .nx-field:focus-within::after{transform:scaleX(1)}
    /* Login sigil ring — draws itself once, then breathes; ticks rotate slowly (AC-2) */
    @keyframes nx-sigil-draw{from{stroke-dashoffset:290}to{stroke-dashoffset:0}}
    @keyframes nx-sigil-breathe{0%,100%{opacity:0.5}50%{opacity:0.92}}
    @keyframes nx-sigil-spin{to{transform:rotate(360deg)}}
    .nx-sigil-ring{stroke-dasharray:290;stroke-dashoffset:0;
      animation:nx-sigil-draw 1.5s cubic-bezier(0.16,1,0.3,1) both,nx-sigil-breathe 5s ease-in-out 1.6s infinite}
    .nx-sigil-ticks{transform-origin:50% 50%;animation:nx-sigil-spin 44s linear infinite}

    /* AC-5 — respeitar prefers-reduced-motion: corta movimento ambiente/loops/stagger */
    @media(prefers-reduced-motion:reduce){
      *,*::before,*::after{animation-duration:0.001ms !important;animation-iteration-count:1 !important;
        transition-duration:0.001ms !important;scroll-behavior:auto !important}
      .nx-ambient video{display:none}
      .nx-shimmer::after{display:none}
      .nx-stagger>*{opacity:1 !important;transform:none !important}
      .card-idle-vid{display:none}
    }
  `}</style>
);

/* Estilos base de TODA tela (spec 0023 AC-2): o bloco global + as CSS vars do
   sistema ativo. Antes o <ThemeStyles/> só era montado no shell logado, então
   login/seleção/criadores rodavam numa escala de luminância diferente do resto
   do app. Fica em escopo de módulo de propósito — declarar dentro de App()
   criaria um tipo de componente novo a cada render e remontaria as <style>. */
const Shell = () => (<><G/><ThemeStyles/></>);

export default Shell;
