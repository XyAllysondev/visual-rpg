/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — SHEET STYLES
 *  All keyframes + classes for the dossier sheet, attribute dials, EKG vital
 *  signs, critical / paranormal-breach states, dice overlay and the element
 *  affinity transition. Rendered once by the sheet. Element-specific colors
 *  come from CSS vars set on .op-sheet: --el-accent --el-glow --el-rune --el-vital.
 * ════════════════════════════════════════════════════════════════════════ */

export const OrdemSheetStyles = () => (
  <style>{`
    /* Default element-theme vars at :root so portaled modals (rendered into
       document.body, outside .op-sheet's DOM subtree) still resolve --el-*
       colors instead of falling back to invalid/transparent values. */
    :root{ --el-primary:#c9a84c; --el-accent:#e8c96d; --el-glow:#e8c96d; --el-rune:#c9a84c; --el-vital:#e8c96d;
      --el-deep:#14141c; --el-bg:#14141c; --el-border:rgba(201,168,76,0.34); }
    .op-sheet{ position:relative; color:var(--text); font-family:var(--font-body,'IM Fell English',serif);
      --el-accent:#c9a84c; --el-glow:#e8c96d; --el-rune:#c9a84c; --el-vital:#c9a84c; }
    .op-grain::before{ content:""; position:absolute; inset:0; pointer-events:none; z-index:0; opacity:0.05; mix-blend-mode:overlay;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    .op-ink{ border:1px solid var(--border2); border-radius:3px; position:relative; background:var(--card); }
    .op-ink::after{ content:""; position:absolute; inset:3px; border:1px solid rgba(201,168,76,0.10); border-radius:2px; pointer-events:none; box-shadow:inset 0 0 22px rgba(0,0,0,0.32); }
    .op-label{ font-family:Inter,'Inter var',system-ui,sans-serif; font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:var(--muted2); font-weight:600; }
    .op-data{ font-family:var(--font-data,'Share Tech Mono',monospace); font-size:13px; }
    .op-stagg0{ animation:op-rise 0.5s ease both; } .op-stagger>*{ animation:op-rise 0.5s ease both; }
    .op-stagger>*:nth-child(1){animation-delay:.04s}.op-stagger>*:nth-child(2){animation-delay:.10s}.op-stagger>*:nth-child(3){animation-delay:.16s}.op-stagger>*:nth-child(4){animation-delay:.22s}.op-stagger>*:nth-child(5){animation-delay:.28s}.op-stagger>*:nth-child(6){animation-delay:.34s}.op-stagger>*:nth-child(7){animation-delay:.40s}.op-stagger>*:nth-child(8){animation-delay:.46s}
    @keyframes op-rise{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:translateY(0); } }

    /* ── ATTRIBUTE DIAL ── */
    .op-dial{ position:relative; width:96px; height:96px; cursor:pointer; }
    .op-dial-rune{ transform-origin:50% 50%; animation:op-rune-spin 60s linear infinite; }
    .op-dial:hover .op-dial-rune{ animation-duration:24s; }
    @keyframes op-rune-spin{ from{ transform:rotate(0deg); } to{ transform:rotate(360deg); } }
    .op-dial-num{ font-family:var(--font-display,'Cinzel Decorative',serif); font-weight:700; transition:transform 0.2s ease, text-shadow 0.2s ease; }
    .op-dial:hover .op-dial-num{ transform:scale(1.05); }
    .op-dial-aura{ position:absolute; inset:8px; border-radius:50%; pointer-events:none; opacity:0; transition:opacity 0.25s ease;
      box-shadow:0 0 0 1px var(--el-glow), 0 0 22px 2px var(--el-glow); }
    .op-dial:hover .op-dial-aura{ opacity:0.55; animation:op-aura-pulse 1.6s ease-in-out infinite; }
    @keyframes op-aura-pulse{ 0%,100%{ opacity:0.35; } 50%{ opacity:0.7; } }
    .op-dial.op-emph .op-dial-ring2{ stroke:var(--el-glow); }
    .op-breach .op-dial-rune{ animation-duration:8s; }

    /* ── VITAL SIGN / EKG ── */
    .op-vital{ border:1px solid var(--border2); border-radius:3px; padding:8px 10px; background:rgba(0,0,0,0.22); position:relative; }
    .op-ekg-line{ fill:none; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
    .op-ekg-sweep{ stroke-dasharray:60 240; animation:op-ekg-sweep linear infinite; }
    @keyframes op-ekg-sweep{ from{ stroke-dashoffset:300; } to{ stroke-dashoffset:0; } }
    .op-flatband .op-ekg-line{ stroke:var(--danger-text,#d85a5a); animation:op-flat-blink 1.3s ease-in-out infinite; }
    @keyframes op-flat-blink{ 0%,100%{ opacity:0.35; } 50%{ opacity:1; } }
    .op-badge-crit{ font-family:var(--font-title,'Cinzel',serif); font-size:8px; letter-spacing:0.14em; text-transform:uppercase;
      padding:2px 6px; border-radius:2px; background:var(--danger,#8b1a1a); color:#fff; animation:op-flat-blink 1s ease-in-out infinite; }

    /* ── CRITICAL / BREACH global layers ── */
    .op-vignette{ position:fixed; inset:0; pointer-events:none; z-index:40; box-shadow:inset 0 0 160px 30px transparent; transition:box-shadow 0.8s ease; }
    .op-vignette.on{ box-shadow:inset 0 0 190px 48px var(--crisis-vignette,rgba(229,57,53,0.42)); animation:op-vig-pulse 3.4s ease-in-out infinite; }
    @keyframes op-vig-pulse{ 0%,100%{ box-shadow:inset 0 0 150px 30px var(--crisis-vignette,rgba(229,57,53,0.28)); } 50%{ box-shadow:inset 0 0 220px 64px var(--crisis-vignette,rgba(229,57,53,0.5)); } }
    /* Medo (GM-granted): subtle static over the header */
    .op-static{ position:relative; }
    .op-static::after{ content:""; position:absolute; inset:0; pointer-events:none; opacity:0.06; mix-blend-mode:screen;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23s)'/%3E%3C/svg%3E"); animation:op-static-shift 0.2s steps(2) infinite; }
    @keyframes op-static-shift{ 0%{ transform:translate(0,0); } 100%{ transform:translate(2px,-1px); } }
    .op-outrolado{ position:fixed; inset:0; pointer-events:none; z-index:-1; opacity:0; transition:opacity 1s ease;
      background:radial-gradient(circle at 50% 38%, rgba(123,31,162,0.22), transparent 62%); }
    .op-outrolado.on{ opacity:1; animation:op-flicker 5s ease-in-out infinite; }
    .op-outrolado-glyphs{ position:fixed; inset:0; pointer-events:none; z-index:-2; opacity:0; transition:opacity 1.2s ease;
      font-family:var(--font-data,'Share Tech Mono',monospace); color:rgba(155,89,182,0.10); font-size:34px; overflow:hidden; word-break:break-all; line-height:1.4; user-select:none; }
    .op-outrolado-glyphs.on{ opacity:1; animation:op-flicker 6s steps(2) infinite; }
    @keyframes op-flicker{ 0%,100%{ opacity:0.7; } 50%{ opacity:1; } 88%{ opacity:0.5; } }
    .op-glitch{ position:relative; }
    .op-glitch.on{ animation:op-glitch-anim 2.8s steps(1) infinite; }
    @keyframes op-glitch-anim{ 0%,100%{ text-shadow:none; transform:translate(0,0); }
      90%{ text-shadow:-2px 0 #e53935, 2px 0 #2bd1c4; }
      93%{ text-shadow:2px 0 #e53935, -2px 0 #2bd1c4; transform:translate(1px,0); }
      96%{ text-shadow:-1px 0 #e53935; transform:translate(-1px,0); } }
    /* nome do agente — editável no modo edição, mesma tipografia do título */
    .op-name-edit{ cursor:text; }
    .op-name-edit:hover{ text-decoration:underline; text-decoration-style:dotted; text-underline-offset:6px; text-decoration-color:var(--gold); }
    .op-name-input{ width:100%; padding:0 0 2px; border:none; border-radius:0; background:transparent;
      border-bottom:1px dashed var(--gold); color:var(--el-glow);
      font-family:var(--font-display,'Cinzel Decorative',serif); font-size:clamp(22px,3.4vw,38px); line-height:1.05; }
    .op-name-input:focus{ border-bottom-color:var(--el-accent); }
    .op-watermark{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:2;
      font-family:var(--font-display,'Cinzel Decorative',serif); font-size:clamp(34px,9vw,90px); color:rgba(229,57,53,0.07);
      letter-spacing:0.12em; transform:rotate(-14deg); text-transform:uppercase; }

    /* ── TABS (underline, scrollable) ── */
    /* O realce do ativo é a pílula deslizante (spec 0022) — os botões só mudam
       cor/peso; fundo e sublinhado vivem no <SlidingTabPill>. A borda transparente
       fica para o box-model não encolher 2px. */
    .op-tabs-row{ display:flex; width:100%; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch; position:relative; }
    .op-tabs-row::-webkit-scrollbar{ display:none; }
    .op-tab{ flex:0 0 auto; min-width:70px; text-align:center; font-family:Inter,'Inter var',system-ui,sans-serif; font-size:11.5px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; padding:11px 14px; cursor:pointer;
      border:none; border-bottom:2px solid transparent; background:transparent; color:var(--muted2); transition:color 0.18s; white-space:nowrap; position:relative; z-index:1; }
    .op-tab:hover{ color:var(--text); background:rgba(201,168,76,0.05); }
    .op-tab.active{ color:var(--el-glow); font-weight:700; }

    /* ── TERMINAL DICE ──
       O console inteiro era VERDE (#7dffb0 sobre #03100a, borda e brilho em
       #4ade80, botão num degradê de três paradas com halo verde) — o único
       bloco verde de uma ficha que só tem ouro, roxo e o vermelho do status.
       Cor que não pertence a nenhuma paleta do tema lê como peça colada de
       outro projeto, que é exatamente a sensação de "montado por IA".
       O motivo de terminal fica: monospace, fundo afundado, brilho interno e o
       prompt "›". Só a cor passa a ser a do elemento ativo (redesign de layout 2026-08-02). */
    .op-terminal{ font-family:var(--font-data,'Share Tech Mono',monospace); background:#0d0a04; border:1px solid var(--el-border,rgba(201,168,76,0.34)); color:var(--el-glow,#e8c96d); border-radius:4px; padding:11px 12px; width:100%; letter-spacing:0.08em; box-shadow:inset 0 0 18px rgba(0,0,0,0.7); }
    .op-terminal::placeholder{ color:rgba(201,168,76,0.42); }
    .op-terminal:focus{ outline:none; border-color:var(--el-accent,#c9a84c); box-shadow:inset 0 0 22px rgba(0,0,0,0.8),0 0 14px var(--el-glow,rgba(201,168,76,0.25)); }
    .op-rolar{ font-family:var(--font-title,'Cinzel',serif); font-size:11px; letter-spacing:0.14em; text-transform:uppercase; font-weight:700; color:#100c03;
      background:var(--el-accent,#c9a84c); border:none; border-radius:4px; padding:11px 18px; cursor:pointer; display:flex; align-items:center; gap:8px; transition:filter 0.2s; }
    .op-rolar:hover{ filter:brightness(1.12); }
    .op-rolar:active{ animation:op-shake 0.34s; }
    @keyframes op-shake{ 0%,100%{ transform:translate(0,0) rotate(0); } 20%{ transform:translate(-3px,1px) rotate(-3deg); } 40%{ transform:translate(3px,-1px) rotate(3deg); } 60%{ transform:translate(-2px,1px) rotate(-2deg); } 80%{ transform:translate(2px,0) rotate(1deg); } }
    .op-emrg{ font-family:var(--font-title,'Cinzel',serif); font-size:11px; letter-spacing:0.08em; font-weight:600; color:var(--el-glow); background:rgba(201,168,76,0.06); border:1px solid var(--el-accent); border-radius:4px; padding:9px 4px; cursor:pointer; transition:all 0.18s; text-align:center; }
    .op-emrg:hover{ background:rgba(201,168,76,0.16); box-shadow:0 0 14px var(--el-glow); transform:translateY(-1px); }

    /* ── PERÍCIA ROWS (PERÍCIA · DADOS · BÔNUS · TREINO · OUTROS) ── */
    .op-col-panel{ --skill-cols:22px minmax(0,1fr) 34px 38px 42px 42px 26px; }
    .op-skill,.op-skill-head{ display:grid; grid-template-columns:var(--skill-cols,22px minmax(0,1fr) 34px 38px 42px 42px 26px); gap:0 4px; align-items:center; }
    .op-skill{ padding:5px 10px; border-bottom:1px solid rgba(201,168,76,0.06); font-family:Inter,'Inter var',system-ui,sans-serif; font-size:13px; transition:background 0.15s; }
    .op-skill:hover{ background:rgba(214,184,74,0.12); }
    .op-skill-head{ padding:6px 10px; border-bottom:1px solid var(--border2); background:rgba(0,0,0,0.22); flex-shrink:0; }
    /* As 4 colunas numéricas somam 168px, mas "DADOS BÔNUS TREINO OUTROS" com o
       letter-spacing padrão do .op-label ocupava ~200px. Os rótulos vazavam da
       própria coluna e o cabeçalho inteiro escorregava para a esquerda: parecia
       que os títulos não pertenciam aos números embaixo. Sem o espaçamento
       extra cada palavra cabe na sua coluna e a tabela volta a se ler em pé. */
    .op-skill-head .op-label{ letter-spacing:0.01em; white-space:nowrap; }
    .op-skill input{ width:100%; text-align:center; background:transparent; border:none; border-bottom:1px solid transparent; color:inherit; font-family:inherit; font-size:12px; padding:2px 0; -moz-appearance:textfield; }
    .op-skill input:focus{ outline:none; border-bottom:1px solid var(--el-accent); }
    .op-skill input::-webkit-inner-spin-button,.op-skill input::-webkit-outer-spin-button{ -webkit-appearance:none; margin:0; }
    .op-roll-btn{ background:none; border:none; cursor:pointer; font-size:13px; opacity:0.55; transition:all 0.15s; }
    .op-roll-btn:hover{ opacity:1; transform:scale(1.25) rotate(12deg); }

    /* ── DICE OVERLAY ── */
    .op-overlay{ position:fixed; inset:0; z-index:120; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 50% 45%, rgba(40,8,60,0.78), rgba(3,3,7,0.95) 70%); backdrop-filter:blur(3px); animation:op-fade 0.25s ease; }
    @keyframes op-fade{ from{ opacity:0; } to{ opacity:1; } }
    .op-die{ width:88px; height:88px; position:relative; transform-style:preserve-3d; animation:op-tumble 0.8s cubic-bezier(.4,.1,.3,1); }
    @keyframes op-tumble{ 0%{ transform:rotateX(0) rotateY(0) scale(0.4); } 100%{ transform:rotateX(720deg) rotateY(540deg) scale(1); } }
    .op-die-face{ position:absolute; inset:0; border:2px solid var(--el-glow); border-radius:10px; background:linear-gradient(135deg,rgba(201,168,76,0.22),rgba(74,14,110,0.32)); display:flex; align-items:center; justify-content:center; font-family:var(--font-display,'Cinzel Decorative',serif); font-size:34px; color:var(--el-glow); box-shadow:0 0 30px var(--el-glow); }
    .op-result-num{ font-family:var(--font-display,'Cinzel Decorative',serif); animation:op-result-in 0.45s ease-out; }
    @keyframes op-result-in{ from{ opacity:0; transform:scale(0.6) translateY(20px); letter-spacing:0.4em; } to{ opacity:1; transform:scale(1) translateY(0); letter-spacing:0; } }
    .op-screenshake{ animation:op-screenshake 0.4s ease; }
    @keyframes op-screenshake{ 0%,100%{ transform:translate(0,0); } 25%{ transform:translate(-5px,2px); } 50%{ transform:translate(4px,-3px); } 75%{ transform:translate(-3px,1px); } }

    /* ── ROLL RESULT CARD ── */
    .op-roll-card{ position:relative; width:min(500px,93vw); background:#06060a; border:1px solid var(--el-accent); border-radius:12px; padding:18px 26px 14px; box-shadow:0 0 44px rgba(0,0,0,0.85), 0 0 22px var(--el-glow); overflow:hidden; animation:op-card-in 0.3s ease; }
    @keyframes op-card-in{ from{ opacity:0; transform:scale(0.92); } to{ opacity:1; transform:scale(1); } }
    .op-roll-card.op-crit{ border-color:var(--el-glow); box-shadow:0 0 70px var(--el-glow), inset 0 0 50px rgba(0,0,0,0.38); }
    .op-roll-x{ background:none; border:none; color:var(--muted2); font-size:18px; line-height:1; cursor:pointer; padding:2px 4px; }
    .op-roll-x:hover{ color:var(--el-glow); }
    .op-crit-badge{ text-align:center; font-family:var(--font-title,'Cinzel',serif); font-size:11px; letter-spacing:0.32em; text-transform:uppercase; margin-bottom:2px; position:relative; z-index:2;
      background:linear-gradient(90deg,var(--el-accent) 0%,#fff 50%,var(--el-accent) 100%); background-size:200% 100%; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; animation:op-shimmer-text 1.6s linear infinite; }
    @keyframes op-shimmer-text{ 0%{ background-position:200% 0; } 100%{ background-position:-200% 0; } }
    .op-result-num.op-cd{ animation:op-result-in 0.4s ease-out, op-crit-red 0.9s ease-in-out 0.4s infinite; }
    .op-result-num.op-cp{ animation:op-result-in 0.4s ease-out, op-crit-white 1.2s ease-in-out 0.4s infinite; }
    @keyframes op-crit-red{ 0%,100%{ color:#ff3b3b; text-shadow:0 0 30px rgba(255,40,40,0.7); } 50%{ color:#ff7a7a; text-shadow:0 0 56px rgba(255,60,60,0.95); } }
    @keyframes op-crit-white{ 0%,100%{ text-shadow:0 0 30px var(--el-glow); } 50%{ text-shadow:0 0 64px #fff, 0 0 30px var(--el-glow); } }
    .op-die-pip{ display:inline-block; opacity:0; animation:op-pip-in 0.3s ease forwards; }
    @keyframes op-pip-in{ from{ opacity:0; transform:translateY(-6px); } to{ opacity:1; transform:translateY(0); } }
    /* critical backdrop: element symbol + orbiting sigils */
    .op-crit-bg{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:0; pointer-events:none; }
    .op-crit-symbol{ animation:op-crit-pulse 1.5s ease-in-out infinite; }
    @keyframes op-crit-pulse{ 0%,100%{ transform:scale(0.95); opacity:0.15; } 50%{ transform:scale(1.05); opacity:0.35; } }
    .op-orbit{ position:absolute; left:50%; top:50%; width:0; height:0; animation:op-orbit 16s linear infinite; }
    .op-orbit .op-sigil{ position:absolute; left:0; top:0; font-family:var(--font-data,'Share Tech Mono',monospace); font-size:18px; opacity:0.4; }
    @keyframes op-orbit{ from{ transform:rotate(0); } to{ transform:rotate(360deg); } }

    /* ── CORNER CARD (rolagens normais, canto inferior direito) ── */
    .op-corner{ position:fixed; bottom:24px; right:24px; width:320px; max-width:calc(100vw - 32px); z-index:99999;
      background:var(--el-bg,#14141c); border:1px solid var(--el-border,var(--border2)); border-radius:10px;
      box-shadow:0 0 12px var(--el-glow), 0 10px 30px rgba(0,0,0,0.42); padding:14px 16px; animation:op-corner-in 0.3s ease-out; }
    @keyframes op-corner-in{ from{ opacity:0; transform:translateX(40px); } to{ opacity:1; transform:translateX(0); } }
    .op-corner-x{ background:none; border:none; color:var(--muted); font-size:15px; line-height:1; cursor:pointer; padding:0 2px; }
    .op-corner-x:hover{ color:var(--el-glow); }

    /* ── CRITICAL: vinheta + toques por elemento ── */
    @keyframes op-crit-vig{ 0%,100%{ opacity:0.7; } 50%{ opacity:1; } }
    .op-crit-energia{ animation:op-card-in 0.3s ease, op-arc 1.2s ease-in-out infinite; }
    @keyframes op-arc{ 0%,100%{ box-shadow:0 0 60px var(--el-glow), inset 0 0 50px rgba(0,0,0,0.38); } 50%{ box-shadow:0 0 95px var(--el-glow), 0 0 26px #fff, inset 0 0 50px rgba(0,0,0,0.38); } }
    .op-crit-medo{ animation:op-card-in 0.3s ease, op-medo-glitch 2.6s steps(1) infinite; }
    @keyframes op-medo-glitch{ 0%,90%,100%{ transform:translate(0,0); } 92%{ transform:translate(-2px,1px); } 95%{ transform:translate(2px,-1px); } 97%{ transform:translate(-1px,0); } }
    .op-drop{ position:absolute; top:0; width:3px; height:13px; border-radius:2px; background:#cc0000; opacity:0.6; animation:op-drop-fall linear infinite; }
    @keyframes op-drop-fall{ 0%{ transform:translateY(-24px); opacity:0; } 12%{ opacity:0.75; } 100%{ transform:translateY(400px); opacity:0; } }

    /* ── ELEMENT SELECTION + TRANSITION ── */
    .op-el-veil{ position:fixed; inset:0; z-index:200; background:#020205; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; overflow:auto; }
    .op-el-title{ font-family:var(--font-display,'Cinzel Decorative',serif); font-size:clamp(26px,5vw,48px); color:var(--gold2); text-align:center; animation:op-flicker 3.4s ease-in-out infinite; text-shadow:0 0 30px rgba(201,168,76,0.4); }
    .op-el-card{ border:1px solid var(--border2); border-radius:6px; padding:16px; cursor:pointer; background:rgba(0,0,0,0.32); transition:all 0.25s; position:relative; overflow:hidden; }
    .op-el-card:hover{ transform:translateY(-3px); }
    .op-el-particle{ position:absolute; width:3px; height:3px; border-radius:50%; opacity:0.6; animation:op-particle linear infinite; }
    @keyframes op-particle{ from{ transform:translateY(0); opacity:0; } 10%{ opacity:0.7; } to{ transform:translateY(-120px); opacity:0; } }
    .op-el-transition{ position:fixed; inset:0; z-index:210; background:#000; display:flex; align-items:center; justify-content:center; animation:op-el-fade 1.5s ease forwards; }
    /* spec 0023: o piso subiu de #000 junto com --el-deep — com o fundo grafite,
       partir do preto puro virava um piscar visível na troca de elemento. */
    @keyframes op-el-fade{ 0%{ background:#0a0a10; } 45%{ background:#0a0a10; } 100%{ background:var(--el-deep,#14141c); } }
    .op-el-erupt{ animation:op-erupt 1.5s cubic-bezier(.2,.6,.2,1) forwards; }
    @keyframes op-erupt{ 0%{ transform:scale(0) rotate(-30deg); opacity:0; } 30%{ opacity:1; } 60%{ transform:scale(1.4) rotate(8deg); } 100%{ transform:scale(8) rotate(0); opacity:0; } }

    /* ── MOBILE SECTION NAV (Ficha | Perícias | Ações) ── */
    .op-mobile-secnav{ display:none; }
    .op-mobile-secbtn{ flex:1; padding:11px 8px; font-family:var(--font-title,'Cinzel',serif); font-size:11px; font-weight:600;
      letter-spacing:0.07em; text-transform:uppercase; background:none; border:none; border-bottom:2px solid transparent;
      color:var(--muted2); cursor:pointer; white-space:nowrap; min-height:44px; -webkit-tap-highlight-color:transparent; transition:color 0.15s;
      position:relative; z-index:1; }
    /* Sublinhado do ativo = pílula deslizante (spec 0022); aqui só a cor do texto. */
    .op-mobile-secbtn.active{ color:var(--el-glow); }
    .op-mobile-secbtn:active{ background:rgba(255,255,255,0.04); }

    /* full-viewport fill + independent column scroll (desktop) */
    .op-sheet-grid{ display:grid; grid-template-columns:280px minmax(0,420px) minmax(0,1fr); gap:14px; align-items:start; }
    @media(min-width:769px){
      .op-sheet.op-fill{ flex:1 1 auto; min-height:0; height:100%; display:flex; flex-direction:column; overflow:hidden; }
      .op-sheet.op-fill .op-sheet-grid{ flex:1; min-height:0; align-items:stretch; grid-template-rows:minmax(0,1fr); }
      .op-col{ min-height:0; overflow-y:auto; padding-right:4px; }
      /* o painel de perícias encolhe até o conteúdo (sem vão morto) e só então
         vira scroll ao bater no teto da linha do grid */
      .op-col-panel{ min-height:0; max-height:100%; align-self:start; }
      .op-col::-webkit-scrollbar,.op-col-rows::-webkit-scrollbar{ width:5px; }
      .op-col::-webkit-scrollbar-thumb,.op-col-rows::-webkit-scrollbar-thumb{ background:var(--gold3); border-radius:2px; }
    }
    @media(max-width:1180px) and (min-width:769px){ .op-sheet-grid{ grid-template-columns:248px minmax(0,380px) minmax(0,1fr); } }
    @media(max-width:768px){
      .op-sheet-grid{ grid-template-columns:1fr; }
      .op-sheet.op-fill{ height:auto; overflow:visible; }
      .op-col,.op-col-panel,.op-col-rows{ overflow:visible; max-height:none; }

      /* Section switcher */
      .op-mobile-secnav{ display:flex; border-top:1px solid var(--border2); margin:8px -0px 0; position:relative; }
      .op-mobile-hidden{ display:none !important; }

      /* Header */
      .op-tab{ font-size:11px; padding:11px 12px; min-height:44px; -webkit-tap-highlight-color:transparent; }
      .op-dial{ width:76px; height:76px; }
      .op-photo-frame{ height:160px !important; }

      /* VitalSign quick-damage panel wraps on narrow screens */
      .op-vital{ padding:6px 8px; }
      .op-vital-quick{ flex-wrap:wrap; gap:4px !important; }

      /* Skills grid: tighter columns */
      .op-col-panel{ --skill-cols:20px minmax(0,1fr) 24px 32px 34px 34px 28px; }
      .op-skill{ padding:5px 6px; font-size:11px; gap:0 3px; }
      .op-skill-head{ padding:4px 6px; font-size:9px; gap:0 3px; }
      .op-skill input{ font-size:11px; }

      /* Arsenal / combat rows */
      .op-arsenal-row{ padding:7px 8px; }
      .op-arsenal-badges{ flex-wrap:wrap; gap:3px; }
      .op-arsenal-expand{ grid-template-columns:1fr 1fr !important; }

      /* Ritual cards */
      .op-ritual-header{ flex-wrap:wrap; gap:4px; }
      .op-ritual-expand{ grid-template-columns:1fr 1fr !important; }

      /* Inventory search + item rows */
      .op-inv-search-row{ flex-wrap:wrap; gap:6px; }
      .op-inv-item-row{ flex-wrap:wrap; gap:4px 8px; }

      /* Attr cards tap targets */
      .op-attr-card{ min-height:44px; }
      .op-attr-val{ font-size:16px; }

      /* Buttons & controls */
      .op-emrg{ padding:10px 4px; min-height:44px; font-size:10px; }
      .op-rolar{ padding:12px 14px; min-height:44px; }
      .op-add-row{ padding:10px 12px; }
      .op-roll-btn{ min-width:44px; min-height:44px; display:flex; align-items:center; justify-content:center; }

      /* Roll overlay cards */
      .op-corner{ bottom:80px; right:12px; width:calc(100vw - 24px); }
      .op-roll-drawer{ width:100vw; border-left:none; border-top:1px solid var(--border2); height:85vh; top:auto; bottom:0; border-radius:16px 16px 0 0; animation:op-drawer-up 0.3s cubic-bezier(.2,.7,.2,1); }
      @keyframes op-drawer-up{ from{transform:translateY(100%)} to{transform:translateY(0)} }

      /* Habilidades cards */
      .op-hab-header{ flex-wrap:wrap; gap:4px; }
    }
    @media(max-width:480px){
      .op-tab{ font-size:10px; padding:10px 8px; letter-spacing:0.05em; }
      .op-dial{ width:66px; height:66px; }
      .op-photo-frame{ height:130px !important; }
      /* Even tighter skill columns; hide "outros" bonus col */
      .op-col-panel{ --skill-cols:18px minmax(0,1fr) 22px 28px 0px 30px 26px; }
      .op-skill{ padding:5px 4px; font-size:11px; }
      .op-skill-head{ padding:4px 4px; font-size:9.5px; }
      .op-skill>*:nth-child(5),.op-skill-head>*:nth-child(5){ display:none; }
    }

    /* ── COMBATE: histórico btn, cards de atributo, arsenal ── */
    .op-hist-btn{ display:inline-flex; align-items:center; gap:6px; font-family:var(--font-title,'Cinzel',serif); font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase;
      color:var(--el-accent); background:rgba(255,255,255,0.03); border:1px solid var(--el-border); border-radius:4px; padding:4px 10px; cursor:pointer; transition:all 0.18s; }
    .op-hist-btn:hover{ background:var(--el-accent); color:#0a0a0f; box-shadow:0 0 14px var(--el-glow); }
    .op-attr-card{ display:flex; flex-direction:column; align-items:center; gap:3px; padding:9px 4px 8px; cursor:pointer;
      background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08); border-radius:5px; transition:all 0.18s; }
    .op-attr-card:hover{ border-color:var(--el-border); background:rgba(255,255,255,0.05); box-shadow:0 0 16px -2px var(--el-glow); transform:translateY(-2px); }
    .op-attr-name{ font-family:var(--font-title,'Cinzel',serif); font-size:11px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--muted2); }
    .op-attr-card:hover .op-attr-name{ color:var(--el-accent); }
    .op-attr-val{ font-family:var(--font-data,'Share Tech Mono',monospace); font-size:18px; color:var(--el-accent); line-height:1; }
    .op-arsenal-row{ padding:9px 11px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); border-radius:5px; transition:border-color 0.18s; }
    .op-arsenal-row:hover{ border-color:var(--el-border); }

    /* ── CAMPAIGN ROLL DRAWER (histórico de rolagens) ── */
    .op-drawer-overlay{ position:fixed; inset:0; z-index:300; background:rgba(2,2,6,0.62); backdrop-filter:blur(2px); animation:op-fade-in 0.25s ease; }
    @keyframes op-fade-in{ from{ opacity:0; } to{ opacity:1; } }
    .op-roll-drawer{ position:fixed; top:0; right:0; height:100vh; width:min(380px,92vw); z-index:301; background:#0a0a0f; border-left:1px solid var(--el-border);
      box-shadow:-12px 0 40px rgba(0,0,0,0.42); display:flex; flex-direction:column; animation:op-drawer-in 0.3s cubic-bezier(.2,.7,.2,1); }
    @keyframes op-drawer-in{ from{ transform:translateX(100%); } to{ transform:translateX(0); } }
    .op-roll-drawer-head{ flex-shrink:0; padding:16px 18px 12px; border-bottom:1px solid var(--border2); display:flex; align-items:center; justify-content:space-between; }
    .op-roll-drawer-body{ flex:1; min-height:0; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:14px; }
    .op-roll-drawer-body::-webkit-scrollbar{ width:5px; } .op-roll-drawer-body::-webkit-scrollbar-thumb{ background:var(--gold3); border-radius:2px; }
    .op-rollcard{ animation:op-rollcard-in 0.32s ease; }
    @keyframes op-rollcard-in{ from{ opacity:0; transform:translateY(-8px); } to{ opacity:1; transform:translateY(0); } }

    /* ── ADICIONAR modal (rituais/itens): banner, rows, +, search ── */
    .op-banner-link:hover{ text-decoration:underline; }
    .op-add-row{ background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.04); border-left:2px solid transparent; transition:background 0.15s ease, border-left-color 0.15s ease; }
    .op-add-row:hover{ background:rgba(255,255,255,0.05); border-left-color:var(--el-accent); }
    .op-add-plus{ transition:filter 0.15s ease; } .op-add-plus:hover{ filter:brightness(1.2); }
    .op-add-search::placeholder{ color:rgba(232,228,217,0.3); }
    .op-add-search:focus{ border-color:var(--el-border); }

    /* ── RICH TEXT (editor + rendered output) ── */
    /* bold renders in element accent; underline gets element color; italic off-white */
    .rte-area:empty:before{ content:attr(data-placeholder); color:var(--muted); font-style:italic; pointer-events:none; }
    .rte-area b, .rte-area strong, .op-rich-render b, .op-rich-render strong{ color:var(--el-accent); font-weight:700; }
    .rte-area u, .op-rich-render u{ text-decoration-color:var(--el-accent); }
    .rte-area i, .rte-area em, .op-rich-render i, .op-rich-render em{ color:#e8e4d9; font-style:italic; }
    .op-rich-render p{ margin:0 0 6px; } .op-rich-render p:last-child{ margin-bottom:0; }
    .op-rich-render a{ color:var(--el-accent); }
    /* Select temático (spec 0020): fundo escuro sólido + seta custom; sem branco padrão do browser */
    select.op-select{ -webkit-appearance:none; -moz-appearance:none; appearance:none;
      background-color:#12121e; color:#e8e4d9; cursor:pointer; padding-right:32px;
      background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c084fc' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>");
      background-repeat:no-repeat; background-position:right 11px center; }
    select.op-select:focus{ border-color:var(--el-accent); outline:none; }
    select.op-select option{ background-color:#12121e; color:#e8e4d9; }
  `}</style>
);
