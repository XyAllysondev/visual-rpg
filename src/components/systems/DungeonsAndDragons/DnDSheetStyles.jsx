/* D&D 5e — TOME OF ADVENTURE  ·  complete design system */
export const DnDSheetStyles = () => (
  <style>{`
    /* ══════════════════════════════════════════════════
       ROOT VARIABLES
    ══════════════════════════════════════════════════ */
    .dnd-root {
      --gold:      #c9a84c;
      --gold-hi:   #f0d278;
      --gold-dim:  rgba(201,168,76,0.22);
      --gold-line: rgba(201,168,76,0.28);
      --cream:     #ede0c4;
      --cream-dim: #9a8a74;
      --ink:       #1a1722;
      --stone:     #1e1a2a;
      --parch-bg:  rgba(210,185,140,0.06);
      --accent:    var(--dnd-accent, #c9a84c);
      --glow:      var(--dnd-glow,   #f0d278);
      --crisis:    var(--dnd-crisis,  rgba(196,30,58,0.42));
      color: var(--cream);
      font-family: 'Crimson Pro','IM Fell English',Georgia,serif;
    }

    /* ── Dungeon-stone background ── */
    .dnd-bg {
      background:
        radial-gradient(ellipse 80% 60% at 50% -10%, rgba(140,100,40,0.08) 0%, transparent 70%),
        radial-gradient(ellipse 60% 50% at 80% 110%, rgba(80,40,120,0.07) 0%, transparent 70%),
        linear-gradient(180deg, #141019 0%, #1a1722 60%, #131017 100%);
      min-height: 100%;
    }
    /* stone noise */
    .dnd-grain::before {
      content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
      opacity:0.028; mix-blend-mode:overlay;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    /* d20 background watermark */
    .dnd-d20-bg {
      position:fixed; inset:0; pointer-events:none; z-index:0;
      display:flex; align-items:center; justify-content:center; overflow:hidden;
    }
    .dnd-d20-bg svg { opacity:0.022; width:min(800px,90vmin); height:min(800px,90vmin); }

    /* ══════════════════════════════════════════════════
       HEADER / BANNER
    ══════════════════════════════════════════════════ */
    .dnd-banner {
      background:linear-gradient(180deg, rgba(20,16,25,0.98) 0%, rgba(26,23,34,0.95) 100%);
      border-bottom:1px solid var(--gold-line);
      position:relative; overflow:hidden;
    }
    /* rune scroll at bottom of banner */
    .dnd-banner::after {
      content:"ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ";
      position:absolute; bottom:0; left:0; right:0;
      font-size:9px; letter-spacing:0.38em; color:rgba(201,168,76,0.065);
      white-space:nowrap; overflow:hidden; line-height:1.8;
      font-family:monospace; padding:0 10px;
    }
    .dnd-name-glitch { position:relative; }
    .dnd-name-glitch.on { animation:dndGlitch 3s steps(1) infinite; }
    @keyframes dndGlitch {
      0%,100%{text-shadow:none;transform:none}
      88%{text-shadow:none}
      90%{text-shadow:-2px 0 #e53935,2px 0 #2bd1c4;transform:translate(1px,0)}
      92%{text-shadow:2px 0 #e53935,-2px 0 #2bd1c4;transform:translate(-1px,0)}
      94%{text-shadow:-1px 0 #e53935;transform:none}
    }

    /* ornamental divider line */
    .dnd-orn-line {
      display:flex; align-items:center; gap:10px;
    }
    .dnd-orn-line::before,.dnd-orn-line::after {
      content:""; flex:1; height:1px;
    }
    .dnd-orn-line.gold::before { background:linear-gradient(90deg,transparent,var(--gold)); }
    .dnd-orn-line.gold::after  { background:linear-gradient(90deg,var(--gold),transparent); }
    .dnd-orn-line.dim::before  { background:linear-gradient(90deg,transparent,rgba(201,168,76,0.45)); }
    .dnd-orn-line.dim::after   { background:linear-gradient(90deg,rgba(201,168,76,0.45),transparent); }

    /* ══════════════════════════════════════════════════
       CLASS SEAL
    ══════════════════════════════════════════════════ */
    .dnd-seal {
      width:70px; height:70px; border-radius:50%; flex-shrink:0;
      border:2px solid var(--gold);
      display:flex; align-items:center; justify-content:center;
      position:relative; overflow:hidden;
      background:radial-gradient(circle,rgba(30,22,46,0.95) 60%,rgba(10,8,20,0.98) 100%);
      box-shadow:0 0 0 5px rgba(201,168,76,0.08),0 0 36px -8px var(--accent,#c9a84c);
    }
    .dnd-seal::before {
      content:""; position:absolute; inset:4px; border-radius:50%;
      border:1px dashed rgba(201,168,76,0.3);
      animation:dndSealSpin 50s linear infinite;
    }
    .dnd-seal::after {
      content:""; position:absolute; inset:8px; border-radius:50%;
      border:1px dotted rgba(201,168,76,0.12);
      animation:dndSealSpin 80s linear infinite reverse;
    }
    @keyframes dndSealSpin { to{transform:rotate(360deg)} }

    /* ══════════════════════════════════════════════════
       ORNATE PANEL (with SVG borders)
    ══════════════════════════════════════════════════ */
    .dnd-card {
      position:relative;
      background:linear-gradient(145deg,rgba(18,14,28,0.95),rgba(12,10,20,0.97));
      border:1px solid rgba(201,168,76,0.2); border-radius:2px;
    }
    .dnd-card-parch {
      background:linear-gradient(145deg,rgba(22,17,32,0.93),rgba(15,12,24,0.96));
    }

    /* ══════════════════════════════════════════════════
       OCTAGONAL PORTRAIT
    ══════════════════════════════════════════════════ */
    .dnd-portrait-wrap { position:relative; }
    .dnd-oct-clip {
      clip-path:polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%);
    }
    .dnd-portrait-aura {
      animation:dndPortraitPulse 3.5s ease-in-out infinite;
    }
    @keyframes dndPortraitPulse {
      0%,100%{opacity:0.45} 50%{opacity:0.75}
    }

    /* ══════════════════════════════════════════════════
       ATTRIBUTE BOXES — carved stone
    ══════════════════════════════════════════════════ */
    .dnd-attr-box {
      display:flex; flex-direction:column; align-items:center; gap:0;
      cursor:pointer; user-select:none; position:relative;
      background:linear-gradient(170deg,rgba(26,20,40,0.97) 0%,rgba(14,11,24,0.99) 100%);
      border:1px solid rgba(201,168,76,0.28); border-radius:3px;
      padding:10px 6px 8px;
      box-shadow:inset 0 2px 6px rgba(0,0,0,0.7),inset 0 -1px 2px rgba(255,255,255,0.03),
        0 4px 16px rgba(0,0,0,0.5);
      transition:transform 0.18s,box-shadow 0.18s;
      overflow:hidden;
    }
    .dnd-attr-box::before {
      content:""; position:absolute; inset:0;
      background:radial-gradient(ellipse at 40% 30%,rgba(255,255,255,0.04) 0%,transparent 65%);
      pointer-events:none;
    }
    .dnd-attr-box:hover {
      transform:translateY(-4px) scale(1.03);
      box-shadow:inset 0 2px 6px rgba(0,0,0,0.7),0 8px 30px rgba(0,0,0,0.6),
        0 0 0 1px rgba(201,168,76,0.5),0 0 24px -4px var(--accent,#c9a84c);
    }
    .dnd-attr-box:hover .dnd-attr-mod { border-color:var(--accent,#c9a84c); box-shadow:0 0 16px var(--accent,#c9a84c); }
    .dnd-attr-abbr {
      font-family:'Cinzel',serif; font-size:8.5px; letter-spacing:0.25em; text-transform:uppercase;
      color:var(--gold); font-weight:700; margin-bottom:5px;
      text-shadow:0 1px 4px rgba(0,0,0,0.9),0 0 10px rgba(201,168,76,0.35);
    }
    .dnd-attr-score {
      font-family:'Cinzel Decorative','Cinzel',serif; font-size:32px; font-weight:700; line-height:1;
      color:var(--cream); text-shadow:0 3px 10px rgba(0,0,0,0.95);
    }
    .dnd-attr-mod {
      margin-top:5px; width:38px; height:38px; border-radius:50%;
      border:1.5px solid rgba(201,168,76,0.3);
      display:flex; align-items:center; justify-content:center;
      font-family:'Cinzel',serif; font-size:13.5px; font-weight:700;
      background:linear-gradient(180deg,rgba(35,26,52,0.9),rgba(18,14,30,0.95));
      box-shadow:inset 0 1px 3px rgba(0,0,0,0.7),0 0 0 1px rgba(0,0,0,0.5);
      transition:all 0.2s;
    }

    /* ══════════════════════════════════════════════════
       HP CRYSTAL BAR
    ══════════════════════════════════════════════════ */
    .dnd-hp-crystal {
      height:18px; border-radius:2px; overflow:hidden; position:relative;
      background:rgba(0,0,0,0.65); border:1px solid rgba(201,168,76,0.18);
    }
    .dnd-hp-fill {
      height:100%; border-radius:1px; position:relative;
      transition:width 0.5s cubic-bezier(.4,.1,.3,1);
    }
    .dnd-hp-fill::before {
      content:""; position:absolute; top:0; left:0; right:0; height:40%;
      background:rgba(255,255,255,0.14); border-radius:2px 2px 0 0;
    }
    .dnd-hp-fill::after {
      content:""; position:absolute; inset:0;
      background-image:repeating-linear-gradient(
        90deg,rgba(0,0,0,0.12) 0,rgba(0,0,0,0.12) 1px,transparent 1px,transparent 16px);
    }
    .dnd-hp-num {
      font-family:'Cinzel Decorative','Cinzel',serif; font-size:44px;
      font-weight:700; line-height:1; letter-spacing:-1px;
    }

    /* ══════════════════════════════════════════════════
       SHIELD CA
    ══════════════════════════════════════════════════ */
    .dnd-shield-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; cursor:default; }

    /* ══════════════════════════════════════════════════
       TABS — illuminated book tabs
    ══════════════════════════════════════════════════ */
    /* O realce do ativo é a pílula deslizante (spec 0022): fundo, sublinhado e a
       linha dourada do topo vivem no <SlidingTabPill>; o botão só muda cor/peso. */
    .dnd-tabs {
      display:flex; overflow-x:auto; scrollbar-width:none; gap:1px;
      border-bottom:1px solid var(--gold-line);
      background:rgba(6,4,11,0.95); position:relative;
    }
    .dnd-tabs::-webkit-scrollbar{display:none}
    .dnd-tab {
      flex:0 0 auto; padding:11px 18px; cursor:pointer;
      font-family:'Cinzel',serif; font-size:10px; font-weight:600;
      letter-spacing:0.14em; text-transform:uppercase; white-space:nowrap;
      background:transparent; border:none; border-bottom:2px solid transparent;
      color:var(--cream-dim); position:relative; z-index:1; transition:color 0.18s;
    }
    .dnd-tab:hover { color:var(--cream); background:rgba(201,168,76,0.04); }
    .dnd-tab.on {
      color:var(--gold-hi); font-weight:700;
    }

    /* ══════════════════════════════════════════════════
       SCROLL DICE INPUT
    ══════════════════════════════════════════════════ */
    .dnd-scroll-inp {
      font-family:'Cinzel',serif; font-size:13px; letter-spacing:0.08em;
      background:rgba(8,6,16,0.92);
      border:1px solid rgba(201,168,76,0.38); color:var(--gold-hi);
      border-radius:2px; padding:12px 14px; width:100%;
      box-shadow:inset 0 0 24px rgba(0,0,0,0.75);
      transition:border-color 0.2s,box-shadow 0.2s;
    }
    .dnd-scroll-inp::placeholder { color:rgba(201,168,76,0.28); font-family:'Crimson Pro',serif; font-size:15px; }
    .dnd-scroll-inp:focus {
      outline:none; border-color:rgba(201,168,76,0.72);
      box-shadow:inset 0 0 28px rgba(0,0,0,0.8),0 0 18px rgba(201,168,76,0.14);
    }
    .dnd-roll-btn-main {
      font-family:'Cinzel',serif; font-size:11px; letter-spacing:0.14em; font-weight:700;
      background:linear-gradient(135deg,#8a6218,#c9a84c,#7a5218);
      color:#06040b; border:none; border-radius:2px;
      padding:12px 22px; cursor:pointer; white-space:nowrap;
      box-shadow:0 4px 20px rgba(201,168,76,0.3),inset 0 1px 0 rgba(255,255,255,0.15);
      transition:filter 0.18s,transform 0.1s;
      display:flex; align-items:center; gap:9px;
    }
    .dnd-roll-btn-main:hover { filter:brightness(1.14); }
    .dnd-roll-btn-main:active { transform:scale(0.97); animation:dndBtnShake 0.3s; }
    @keyframes dndBtnShake {
      0%,100%{transform:translate(0,0) rotate(0)}
      25%{transform:translate(-3px,1px) rotate(-2deg)}
      50%{transform:translate(3px,-1px) rotate(2deg)}
      75%{transform:translate(-2px,0) rotate(-1deg)}
    }
    .dnd-die-btn {
      font-family:'Cinzel',serif; font-size:10px; letter-spacing:0.06em;
      color:var(--gold); background:rgba(201,168,76,0.06);
      border:1px solid rgba(201,168,76,0.28); border-radius:2px;
      padding:9px 4px; cursor:pointer; text-align:center; transition:all 0.18s;
    }
    .dnd-die-btn:hover { background:rgba(201,168,76,0.16); box-shadow:0 0 14px rgba(201,168,76,0.25); transform:translateY(-2px); }

    /* ══════════════════════════════════════════════════
       SKILL ROWS
    ══════════════════════════════════════════════════ */
    .dnd-skill-row {
      display:grid; grid-template-columns:16px minmax(0,1fr) 30px 44px 22px;
      gap:0 6px; align-items:center; padding:5px 12px;
      border-bottom:1px solid rgba(201,168,76,0.04);
      font-family:'Crimson Pro',serif; font-size:14px;
      transition:background 0.12s; cursor:pointer;
    }
    .dnd-skill-row:hover { background:rgba(201,168,76,0.055); }
    .dnd-roll-sm { background:none; border:none; cursor:pointer; font-size:12px; opacity:0.5; transition:all 0.15s; }
    .dnd-roll-sm:hover { opacity:1; transform:scale(1.3) rotate(14deg); }

    /* ══════════════════════════════════════════════════
       VIGNETTE & CRISIS
    ══════════════════════════════════════════════════ */
    .dnd-vignette {
      position:fixed; inset:0; pointer-events:none; z-index:40;
      box-shadow:inset 0 0 160px transparent; transition:box-shadow 0.8s;
    }
    .dnd-vignette.on {
      box-shadow:inset 0 0 220px 60px var(--crisis,rgba(196,30,58,0.42));
      animation:dndVigPulse 3s ease-in-out infinite;
    }
    @keyframes dndVigPulse {
      0%,100%{box-shadow:inset 0 0 180px 40px var(--crisis,rgba(196,30,58,0.32))}
      50%{box-shadow:inset 0 0 260px 80px var(--crisis,rgba(196,30,58,0.56))}
    }
    .dnd-watermark {
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      pointer-events:none; z-index:2; transform:rotate(-12deg);
      font-family:'Cinzel Decorative',serif;
      font-size:clamp(48px,10vw,110px);
      color:rgba(196,30,58,0.052); letter-spacing:0.12em; text-transform:uppercase;
    }

    /* ══════════════════════════════════════════════════
       ENTRANCE ANIMATIONS
    ══════════════════════════════════════════════════ */
    .dnd-stagger>*{ animation:dndRise 0.42s ease both; }
    .dnd-stagger>*:nth-child(1){animation-delay:.04s}.dnd-stagger>*:nth-child(2){animation-delay:.10s}
    .dnd-stagger>*:nth-child(3){animation-delay:.16s}.dnd-stagger>*:nth-child(4){animation-delay:.22s}
    .dnd-stagger>*:nth-child(5){animation-delay:.28s}.dnd-stagger>*:nth-child(6){animation-delay:.34s}
    .dnd-stagger>*:nth-child(7){animation-delay:.40s}.dnd-stagger>*:nth-child(8){animation-delay:.46s}
    @keyframes dndRise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

    /* ══════════════════════════════════════════════════
       DICE OVERLAY
    ══════════════════════════════════════════════════ */
    .dnd-overlay {
      position:fixed; inset:0; z-index:9000;
      display:flex; align-items:center; justify-content:center;
      background:radial-gradient(circle at 50% 45%,rgba(12,8,22,0.9),rgba(4,3,8,0.98) 70%);
      backdrop-filter:blur(5px); animation:dndFadeIn 0.22s ease;
    }
    @keyframes dndFadeIn{from{opacity:0}to{opacity:1}}
    .dnd-roll-card {
      position:relative; width:min(500px,94vw);
      background:linear-gradient(160deg,rgba(18,13,28,0.99),rgba(10,8,18,0.99));
      border:1px solid var(--gold-line); border-radius:3px;
      padding:26px 30px 22px; overflow:hidden;
      box-shadow:0 0 70px rgba(0,0,0,0.95),0 0 30px rgba(201,168,76,0.1);
      animation:dndCardIn 0.28s ease;
    }
    .dnd-roll-card.crit { border-color:var(--gold-hi); box-shadow:0 0 90px rgba(201,168,76,0.22),0 0 40px rgba(0,0,0,0.95); }
    @keyframes dndCardIn{from{opacity:0;transform:scale(0.88)}to{opacity:1;transform:scale(1)}}
    .dnd-result-num {
      font-family:'Cinzel Decorative',serif; font-size:76px;
      font-weight:700; line-height:1; animation:dndResultIn 0.42s ease-out;
    }
    @keyframes dndResultIn{
      from{opacity:0;transform:scale(0.5) translateY(28px);letter-spacing:0.5em}
      to{opacity:1;transform:scale(1) translateY(0);letter-spacing:0}
    }
    .dnd-crit-badge {
      font-family:'Cinzel',serif; font-size:11px; letter-spacing:0.32em;
      text-transform:uppercase; text-align:center; margin-bottom:6px;
      background:linear-gradient(90deg,var(--gold) 0%,#fff 50%,var(--gold) 100%);
      background-size:200% 100%; -webkit-background-clip:text; background-clip:text;
      -webkit-text-fill-color:transparent;
      animation:dndShimmer 1.4s linear infinite;
    }
    @keyframes dndShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .dnd-d20-spin { animation:dndTumble 0.8s cubic-bezier(.4,.1,.3,1); }
    @keyframes dndTumble{
      0%{transform:rotateY(0) rotateX(0) scale(0.3)}
      100%{transform:rotateY(720deg) rotateX(540deg) scale(1)}
    }
    .dnd-corner-card {
      position:fixed; bottom:24px; right:24px; width:310px; max-width:calc(100vw - 32px);
      z-index:9000;
      background:linear-gradient(160deg,rgba(16,12,26,0.99),rgba(10,8,18,0.99));
      border:1px solid var(--gold-line); border-radius:3px;
      box-shadow:0 0 22px rgba(201,168,76,0.18),0 12px 40px rgba(0,0,0,0.75);
      padding:16px 20px; animation:dndSlideIn 0.28s ease-out;
    }
    @keyframes dndSlideIn{from{opacity:0;transform:translateX(50px)}to{opacity:1;transform:translateX(0)}}

    /* Spell row */
    .dnd-spell-row {
      border:1px solid rgba(255,255,255,0.07); border-radius:3px;
      overflow:hidden; transition:border-color 0.18s;
    }
    .dnd-spell-row:hover { border-color:rgba(201,168,76,0.35); }

    /* Item row */
    .dnd-item-row {
      display:flex; align-items:center; gap:10px; padding:9px 12px;
      background:rgba(255,255,255,0.018); border:1px solid rgba(255,255,255,0.06);
      border-radius:2px; transition:border-color 0.18s;
    }
    .dnd-item-row:hover { border-color:rgba(201,168,76,0.32); }

    /* Save pip */
    .dnd-save-pip {
      width:14px; height:14px; border-radius:50%;
      border:1.5px solid currentColor; cursor:pointer;
      transition:background 0.15s,box-shadow 0.15s;
    }
    .dnd-save-pip.on { box-shadow:0 0 8px currentColor; }

    /* mini button */
    .mn-btn {
      background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.09);
      border-radius:2px; color:var(--cream-dim); cursor:pointer;
      padding:0 8px; height:26px; font-family:'Cinzel',serif; font-size:13px;
      transition:all 0.15s; line-height:1;
    }
    .mn-btn:hover { background:rgba(201,168,76,0.1); border-color:rgba(201,168,76,0.4); color:var(--gold); }

    /* ══════════════════════════════════════════════════
       LAYOUT
    ══════════════════════════════════════════════════ */
    .dnd-layout {
      display:grid; grid-template-columns:300px 1fr; gap:16px;
      align-items:start; position:relative; z-index:1;
    }
    .dnd-sidebar { display:flex; flex-direction:column; gap:10px; }
    .dnd-main    { display:flex; flex-direction:column; min-width:0; }

    @media(min-width:769px){
      .dnd-root.dnd-fill { flex:1 1 auto; min-height:0; height:100%; display:flex; flex-direction:column; overflow:hidden; }
      .dnd-layout { flex:1; min-height:0; align-items:stretch; }
      .dnd-sidebar,.dnd-main { overflow-y:auto; min-height:0; padding-right:2px; }
      .dnd-sidebar::-webkit-scrollbar,.dnd-main::-webkit-scrollbar { width:5px; }
      .dnd-sidebar::-webkit-scrollbar-thumb,.dnd-main::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.22); border-radius:2px; }
    }
    @media(max-width:1120px) and (min-width:769px){ .dnd-layout{grid-template-columns:272px 1fr;} }

    /* mobile */
    .dnd-mob-nav { display:none; }
    .dnd-mob-btn {
      flex:1; padding:11px 6px; font-family:'Cinzel',serif; font-size:10px;
      font-weight:600; letter-spacing:0.08em; text-transform:uppercase;
      background:none; border:none; border-bottom:2px solid transparent;
      color:var(--cream-dim); cursor:pointer; min-height:44px; transition:color 0.15s;
      -webkit-tap-highlight-color:transparent;
    }
    .dnd-mob-btn.on { color:var(--gold); border-bottom-color:var(--gold); }
    @media(max-width:768px){
      .dnd-layout { grid-template-columns:1fr; }
      .dnd-root.dnd-fill { height:auto; overflow:visible; }
      .dnd-sidebar,.dnd-main { overflow:visible; max-height:none; }
      .dnd-mob-nav { display:flex; border-top:1px solid var(--gold-line); }
      .dnd-mob-hide { display:none!important; }
      .dnd-corner-card { bottom:72px; right:12px; width:calc(100vw - 24px); }
    }
  `}</style>
);
