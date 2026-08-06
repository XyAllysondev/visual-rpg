/* ════════════════════════════════════════════════════════════════════════
 *  PAINEL — FOLHA DE ESTILO (pele heráldica, 2026-08-05)
 *  ------------------------------------------------------------------------
 *  Prefixo `px-` (painel). O global mora em `themes/heraldica.jsx`; aqui fica
 *  só o que é da tela de entrada.
 *
 *  Duas cores governam, e são as do registry de temas — nenhuma escrita à
 *  mão: `--px-accent` (o brasão do sistema; carmesim em Ordem Paranormal) e
 *  `--px-glow`, a mesma cor em rgba baixo. O ouro vem de `--gold`.
 *
 *  A regra que separa as duas: OURO é o que responde ao clique e o que
 *  titula; CARMESIM é atmosfera e identidade. Quando as duas disputam o
 *  mesmo elemento, o ouro ganha — senão a tela vira um alarme.
 *
 *  Movimento: tudo CSS, nenhum loop de JS. `prefers-reduced-motion` no fim
 *  desliga e entrega a MESMA tela, parada.
 * ════════════════════════════════════════════════════════════════════════ */

export default function PainelStyles() {
  return (
    <style>{`
    .px{
      --px-accent:var(--gold);
      --px-glow:var(--gold-glow);
      --px-ease:cubic-bezier(.2,.85,.3,1);
      position:relative;display:flex;flex-direction:column;gap:30px;
      width:100%;max-width:1240px;margin:0 auto;
    }

    @keyframes pxIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
    .px-in{opacity:0;animation:pxIn .68s var(--px-ease) forwards;animation-delay:var(--d,0s)}

    /* ══ HERO — a placa de bronze ═══════════════════════════════════════
       Chapa forjada com bisel, cantoneiras gravadas, esfera armilar girando
       atrás do título e brasas subindo. O degradê sozinho seria só um
       retângulo bonito; o bisel + o grão é o que dá material. */
    .px-hero{
      position:relative;isolation:isolate;overflow:hidden;
      border-radius:5px;border:1px solid var(--border2);
      background:
        radial-gradient(120% 150% at 88% -10%, var(--px-glow) 0%, transparent 52%),
        radial-gradient(90% 120% at 6% 110%, var(--gold-dim) 0%, transparent 55%),
        linear-gradient(168deg, var(--card) 0%, var(--surface) 62%, var(--bg) 100%);
      padding:46px 40px 34px;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.07), inset 0 -1px 0 rgba(0,0,0,.6),
        0 34px 70px -40px #000;
    }
    /* cantoneiras: quatro esquadros de ouro, como canto de placa rebitada */
    .px-hero-canto{position:absolute;width:26px;height:26px;pointer-events:none;opacity:.55;z-index:2}
    .px-hero-canto.tl{top:12px;left:12px;border-top:1px solid var(--gold);border-left:1px solid var(--gold)}
    .px-hero-canto.tr{top:12px;right:12px;border-top:1px solid var(--gold);border-right:1px solid var(--gold)}
    .px-hero-canto.bl{bottom:12px;left:12px;border-bottom:1px solid var(--gold);border-left:1px solid var(--gold)}
    .px-hero-canto.br{bottom:12px;right:12px;border-bottom:1px solid var(--gold);border-right:1px solid var(--gold)}

    /* ── Esfera armilar ────────────────────────────────────────────────
       Três anéis concêntricos girando em velocidades diferentes, com marcas
       de graduação. É o motivo da abertura de Game of Thrones: mecanismo de
       latão sobre preto. Fica à direita, atrás do texto, recortado. */
    .px-armila{position:absolute;right:-90px;top:50%;translate:0 -50%;
      width:520px;height:520px;z-index:-1;pointer-events:none;opacity:.5}
    .px-armila svg{width:100%;height:100%;overflow:visible}
    .px-anel{transform-origin:50% 50%;transform-box:fill-box}
    .px-anel-1{animation:pxGira 190s linear infinite}
    .px-anel-2{animation:pxGira 130s linear infinite reverse}
    .px-anel-3{animation:pxGira 76s linear infinite}
    @keyframes pxGira{to{transform:rotate(360deg)}}
    /* o núcleo pulsa como brasa dentro do mecanismo */
    .px-nucleo{animation:pxBrasa 6.5s ease-in-out infinite}
    @keyframes pxBrasa{0%,100%{opacity:.5}50%{opacity:1}}

    .px-aura{position:absolute;inset:-45%;z-index:-2;pointer-events:none;filter:blur(78px);opacity:.5}
    .px-aura i{position:absolute;display:block;border-radius:50%;mix-blend-mode:screen;
      animation:pxDeriva 30s ease-in-out infinite}
    @keyframes pxDeriva{
      0%,100%{transform:translate3d(0,0,0) scale(1)}
      34%{transform:translate3d(6%,-8%,0) scale(1.16)}
      67%{transform:translate3d(-7%,5%,0) scale(.9)}
    }

    .px-grao{position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.055;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='170'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='4'/%3E%3C/filter%3E%3Crect width='170' height='170' filter='url(%23n)'/%3E%3C/svg%3E")}

    .px-motes{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
    .px-motes span{position:absolute;bottom:-8px;width:2px;height:2px;border-radius:50%;
      opacity:0;animation:pxSobe linear infinite}
    @keyframes pxSobe{
      0%{opacity:0;transform:translateY(0) scale(.5)}
      15%{opacity:.75}70%{opacity:.45}
      100%{opacity:0;transform:translateY(-300px) scale(1.15)}
    }

    .px-eyebrow{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.3em;
      text-transform:uppercase;color:var(--muted2);display:flex;align-items:center;gap:12px}
    .px-eyebrow::before{content:"◈";color:var(--gold);font-size:9px;letter-spacing:0}
    .px-eyebrow::after{content:"";height:1px;width:62px;
      background:linear-gradient(90deg,var(--gold),transparent);opacity:.8}

    /* Título gravado: base em pergaminho + um brilho de luz de vela que corre
       pelo metal. O degradê é SÓ o realce que passa — não uma pintura
       colorida no texto. */
    .px-title{
      font-family:'Cinzel Decorative',serif;font-weight:900;
      font-size:clamp(34px,5.2vw,64px);line-height:1;letter-spacing:.045em;
      margin-top:14px;text-transform:uppercase;color:var(--text);
      background:linear-gradient(100deg,var(--gold-face) 0%,var(--gold-face) 38%,#fffaea 47%,var(--gold2) 51%,var(--gold-face) 60%,var(--gold-face) 100%);
      background-size:300% 100%;-webkit-background-clip:text;background-clip:text;
      -webkit-text-fill-color:transparent;
      filter:drop-shadow(0 2px 0 rgba(0,0,0,.55)) drop-shadow(0 0 26px var(--gold-glow));
      animation:pxSheen 9s ease-in-out 1.4s infinite;
    }
    @keyframes pxSheen{0%{background-position:190% 0}48%,100%{background-position:-90% 0}}

    .px-sub{font-size:15.5px;color:var(--muted2);line-height:1.6;margin-top:13px;max-width:52ch}

    .px-orn{display:flex;align-items:center;gap:14px;margin-top:26px;max-width:640px}
    .px-orn i{flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--border2),transparent)}
    .px-orn b{font-family:'Cinzel',serif;font-size:9px;letter-spacing:.42em;
      color:var(--gold);opacity:.9;font-weight:400}

    .px-hero-act{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:28px}
    /* Selo do plano: pastilha de cera com o filete gravado */
    .px-plan{font-family:'Cinzel',serif;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;
      padding:7px 14px;border-radius:2px;color:var(--muted);
      border:1px solid var(--border2);background:rgba(0,0,0,.35);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
    .px-plan.on{color:var(--gold2);border-color:var(--gold);
      background:linear-gradient(180deg,var(--gold-wash),var(--gold-veil));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 0 22px -8px var(--gold-glow);
      animation:pxSelo 5s ease-in-out infinite}
    @keyframes pxSelo{0%,100%{box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 0 22px -10px var(--gold-glow)}
      50%{box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 0 30px -6px var(--gold-glow)}}

    /* Botão principal: chapa de latão batido (mesma liga do .btn-gold global) */
    .px-cta{position:relative;overflow:hidden;isolation:isolate;
      font-family:'Cinzel',serif;font-size:11.5px;letter-spacing:.18em;
      text-transform:uppercase;font-weight:700;color:#17120a;
      padding:14px 30px;border-radius:3px;cursor:pointer;
      border:1px solid rgba(0,0,0,.5);
      background:linear-gradient(178deg,var(--gold2) 0%,var(--gold) 28%,var(--gold-mid) 72%,var(--gold-deep) 100%);
      text-shadow:0 1px 0 rgba(255,255,255,.28);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -1px 0 rgba(0,0,0,.5),
        0 2px 0 rgba(0,0,0,.55),0 16px 34px -14px var(--gold-cast);
      transition:transform .18s var(--px-ease),box-shadow .25s,filter .25s}
    .px-cta::after{content:"";position:absolute;inset:0;z-index:-1;
      background:linear-gradient(100deg,transparent 34%,rgba(255,255,255,.6) 50%,transparent 66%);
      transform:translateX(-130%);transition:transform .75s var(--px-ease)}
    .px-cta:hover:not(:disabled)::after{transform:translateX(130%)}
    .px-cta:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.08)}
    .px-cta:active:not(:disabled){transform:translateY(1px)}
    .px-cta:disabled{opacity:.4;cursor:not-allowed;filter:grayscale(.5)}

    /* ══ RETOMAR — a faixa de convocação ════════════════════════════════ */
    .px-resume{position:relative;overflow:hidden;display:flex;align-items:center;gap:20px;
      width:100%;text-align:left;cursor:pointer;padding:20px 24px;border-radius:4px;
      border:1px solid var(--border);
      background:linear-gradient(100deg,rgba(255,255,255,.05),rgba(255,255,255,.012));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05),inset 0 -1px 0 rgba(0,0,0,.45);
      transition:border-color .3s,transform .3s var(--px-ease),box-shadow .3s}
    .px-resume::before{content:"";position:absolute;left:0;top:50%;translate:0 -50%;
      width:2px;height:0;background:linear-gradient(180deg,transparent,var(--gold),transparent);
      transition:height .38s var(--px-ease)}
    .px-resume:hover{transform:translateX(5px);border-color:var(--gold);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 22px 46px -28px #000,0 0 34px -18px var(--gold-glow)}
    .px-resume:hover::before{height:66%}
    .px-resume::after{content:"";position:absolute;inset:0;pointer-events:none;
      background:linear-gradient(100deg,transparent 32%,rgba(255,255,255,.06) 50%,transparent 68%);
      transform:translateX(-100%);transition:transform .9s var(--px-ease)}
    .px-resume:hover::after{transform:translateX(100%)}
    .px-resume-cap{font-family:'Cinzel',serif;font-size:9px;letter-spacing:.24em;
      text-transform:uppercase;color:var(--gold)}
    .px-resume-t{font-family:'Cinzel Decorative',serif;font-size:19px;color:var(--text);margin-top:6px;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .px-resume-m{font-size:13px;color:var(--muted);margin-top:5px}
    .px-go{flex-shrink:0;color:var(--muted);transition:transform .3s var(--px-ease),color .3s}
    .px-resume:hover .px-go,.px-alert:hover .px-go,.px-tool:hover .px-go,.px-row:hover .px-go{
      transform:translateX(6px);color:var(--gold2)}

    /* Medalhão do retomar: anel de latão com brasa dentro */
    .px-sigil{width:52px;height:52px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;
      color:var(--gold2);border:1px solid var(--gold);
      background:radial-gradient(circle at 36% 30%,var(--gold-sel),rgba(0,0,0,.6) 72%);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 0 20px -6px var(--gold-glow);
      animation:pxHalo 4.5s ease-in-out infinite}
    @keyframes pxHalo{0%,100%{box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 0 18px -8px var(--gold-glow)}
      50%{box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 0 30px -4px var(--gold-glow)}}

    /* ══ CONVOCAÇÕES — "precisa de você" ════════════════════════════════ */
    .px-alert{display:flex;align-items:center;gap:16px;width:100%;text-align:left;cursor:pointer;
      padding:15px 16px;border:none;background:none;
      border-bottom:1px solid var(--border);transition:background .25s,padding-left .25s}
    .px-alert:hover{background:linear-gradient(90deg,var(--brasao-dim),transparent 60%);padding-left:24px}
    .px-alert-t{flex:1;min-width:0;font-size:15px;color:var(--text);line-height:1.4}
    .px-alert-a{font-family:'Cinzel',serif;font-size:9.5px;letter-spacing:.16em;
      text-transform:uppercase;color:var(--muted);flex-shrink:0}
    /* o ponto é CARMESIM: é o único lugar da tela onde o brasão vira alarme */
    .px-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--brasao2);
      box-shadow:0 0 8px var(--brasao-glow);animation:pxPing 2.8s ease-out infinite}
    .px-dot.idle{background:var(--muted);animation:none;box-shadow:none;opacity:.5}
    @keyframes pxPing{0%{box-shadow:0 0 8px var(--brasao-glow),0 0 0 0 var(--brasao-glow)}
      70%,100%{box-shadow:0 0 8px var(--brasao-glow),0 0 0 12px transparent}}

    /* ══ NÚMEROS — chapas gravadas ══════════════════════════════════════ */
    .px-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
    .px-stat{position:relative;overflow:hidden;text-align:left;cursor:pointer;
      padding:22px 20px 18px;border-radius:4px;border:1px solid var(--border);
      background:linear-gradient(168deg,rgba(255,255,255,.05),rgba(255,255,255,.012) 45%,rgba(0,0,0,.2));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.055),inset 0 -1px 0 rgba(0,0,0,.5);
      transition:transform .3s var(--px-ease),border-color .3s,box-shadow .3s}
    .px-stat::before{content:"";position:absolute;top:0;left:16%;right:16%;height:1px;opacity:.4;
      background:linear-gradient(90deg,transparent,var(--gold),transparent);
      transition:opacity .3s,left .3s,right .3s}
    .px-stat:hover{transform:translateY(-5px);border-color:var(--gold);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 28px 52px -30px #000,0 0 38px -16px var(--gold-glow)}
    .px-stat:hover::before{opacity:1;left:0;right:0}
    .px-stat-ghost{position:absolute;right:-2px;bottom:-30px;pointer-events:none;
      font-family:'Cinzel',serif;font-weight:700;font-size:92px;line-height:1;
      color:var(--gold);opacity:.045}
    /* Cinzel, NAO Cinzel Decorative: o algarismo 1 da Decorative e um I sem pe,
       e '1/3' virava 'I/3'. Num bloco cuja funcao inteira e mostrar numero,
       isso nao e estilo, e defeito. */
    .px-stat-num{font-family:'Cinzel',serif;font-weight:600;font-size:34px;
      line-height:1;color:var(--text);display:flex;align-items:baseline;gap:2px;
      text-shadow:0 2px 0 rgba(0,0,0,.5)}
    .px-stat-den{font-family:'Cinzel',serif;font-size:17px;color:var(--muted)}
    .px-stat-cap{font-family:'Cinzel',serif;font-size:9.5px;letter-spacing:.2em;
      text-transform:uppercase;color:var(--muted);margin-top:10px;display:block}
    .px-meter{height:3px;border-radius:0;background:rgba(0,0,0,.5);overflow:hidden;margin-top:14px;
      box-shadow:inset 0 1px 2px rgba(0,0,0,.7)}
    .px-meter i{display:block;height:100%;width:0;
      background:linear-gradient(90deg,var(--gold3),var(--gold) 55%,var(--gold2));
      box-shadow:0 0 10px -1px var(--gold-glow);
      animation:pxFill 1.2s .4s var(--px-ease) forwards}
    @keyframes pxFill{to{width:var(--w,0%)}}

    /* ══ ESTRUTURA ══════════════════════════════════════════════════════ */
    .px-split{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(0,1fr);gap:36px;align-items:start}
    .px-col{display:flex;flex-direction:column;gap:32px;min-width:0}
    .px-rail{display:flex;flex-direction:column;gap:32px;min-width:0}

    .px-sec{position:relative;display:flex;align-items:baseline;justify-content:space-between;
      gap:14px;padding-bottom:12px;margin-bottom:18px}
    .px-sec::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;
      background:linear-gradient(90deg,var(--gold),var(--border2) 22%,transparent 78%)}
    .px-sec-t{position:relative;padding-left:18px;font-family:'Cinzel',serif;font-size:11px;
      letter-spacing:.22em;text-transform:uppercase;color:var(--muted2)}
    .px-sec-t::before{content:"◆";position:absolute;left:0;top:0;font-size:8px;color:var(--gold)}
    .px-sec-a{font-family:'Cinzel',serif;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
      color:var(--muted);background:none;border:none;cursor:pointer;transition:color .2s}
    .px-sec-a:hover{color:var(--gold2)}

    /* ══ CAMPANHAS — estandartes ════════════════════════════════════════ */
    .px-camps{display:grid;grid-template-columns:repeat(auto-fill,minmax(238px,1fr));gap:18px}
    .px-camp{position:relative;overflow:hidden;border-radius:4px;cursor:pointer;padding:0;
      border:1px solid var(--border);background:var(--card);aspect-ratio:16/11;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 14px 30px -22px #000;
      transition:transform .38s var(--px-ease),border-color .38s,box-shadow .38s}
    .px-camp:hover{transform:translateY(-7px);border-color:var(--gold);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 34px 60px -30px #000,0 0 46px -22px var(--gold-glow)}
    .px-camp-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
      transition:transform .9s var(--px-ease),filter .5s;filter:saturate(.7) contrast(1.05)}
    .px-camp:hover .px-camp-img{transform:scale(1.1);filter:saturate(1) contrast(1.1)}
    .px-camp-scrim{position:absolute;inset:0;
      background:linear-gradient(to top,rgba(0,0,0,.94) 4%,rgba(0,0,0,.5) 48%,rgba(0,0,0,.06) 100%)}
    .px-camp-body{position:absolute;left:0;right:0;bottom:0;padding:15px 17px 16px;text-align:left}
    .px-camp-t{font-family:'Cinzel Decorative',serif;font-size:16px;font-weight:700;color:#fff;
      line-height:1.25;text-shadow:0 2px 8px rgba(0,0,0,.9);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .px-camp-m{display:flex;align-items:center;gap:9px;margin-top:7px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      font-family:'Cinzel',serif;font-size:9px;letter-spacing:.14em;text-transform:uppercase;
      color:rgba(255,255,255,.6)}
    .px-tag{position:absolute;top:11px;padding:4px 10px;border-radius:2px;
      font-family:'Cinzel',serif;font-size:8px;letter-spacing:.16em;text-transform:uppercase;
      backdrop-filter:blur(6px)}
    .px-tag.l{left:11px;background:rgba(0,0,0,.6);color:rgba(255,255,255,.8);
      border:1px solid rgba(255,255,255,.14)}
    /* selo de mestre: cera carmesim com a borda do brasão */
    .px-tag.r{right:11px;color:#fff;border:1px solid var(--brasao2);
      background:linear-gradient(180deg,var(--brasao2),var(--brasao));
      box-shadow:0 2px 10px -2px var(--brasao-glow),inset 0 1px 0 rgba(255,255,255,.25)}
    .px-camp-fall{position:absolute;inset:0;display:grid;place-items:center;
      background:radial-gradient(circle at 50% 34%,var(--px-glow),transparent 62%),
                 linear-gradient(168deg,rgba(255,255,255,.05),rgba(255,255,255,0))}
    .px-camp-fall span{font-family:'Cinzel Decorative',serif;font-size:56px;color:#fff;opacity:.12}

    /* ══ LINHAS ═════════════════════════════════════════════════════════ */
    .px-row{position:relative;display:flex;align-items:center;gap:16px;width:100%;text-align:left;
      cursor:pointer;padding:15px 12px;background:none;border:none;
      border-bottom:1px solid var(--border);transition:background .24s,padding-left .24s}
    .px-row::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;
      background:linear-gradient(180deg,transparent,var(--gold),transparent);
      opacity:0;transition:opacity .24s}
    .px-row:hover{background:linear-gradient(90deg,var(--gold-veil),transparent 62%);padding-left:18px}
    .px-row:hover::before{opacity:1}
    .px-row-t{font-family:'Cinzel',serif;font-size:15px;color:var(--text);line-height:1.25;
      letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .px-row-m{font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.4}

    .px-ava{width:48px;height:48px;border-radius:3px;flex-shrink:0;overflow:hidden;display:grid;
      place-items:center;font-size:20px;background:rgba(0,0,0,.4);
      border:1px solid var(--border2);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
      transition:border-color .25s,box-shadow .25s}
    .px-row:hover .px-ava{border-color:var(--gold);box-shadow:0 0 20px -6px var(--gold-glow)}
    .px-ava img{width:100%;height:100%;object-fit:cover}

    .px-tool{position:relative;display:flex;align-items:center;gap:15px;width:100%;text-align:left;
      cursor:pointer;padding:14px 13px;border-radius:3px;background:none;
      border:1px solid transparent;transition:background .25s,border-color .25s,transform .25s var(--px-ease)}
    .px-tool:hover{background:linear-gradient(100deg,var(--gold-veil),transparent);
      border-color:var(--border2);transform:translateX(4px)}
    .px-tool-i{width:36px;height:36px;border-radius:3px;flex-shrink:0;display:grid;place-items:center;
      color:var(--gold2);background:rgba(0,0,0,.42);border:1px solid var(--border2);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.06);transition:box-shadow .25s,border-color .25s}
    .px-tool:hover .px-tool-i{border-color:var(--gold);box-shadow:0 0 22px -6px var(--gold-glow)}

    /* ══ PREPARO DO MUNDO ═══════════════════════════════════════════════ */
    .px-prep{display:flex;align-items:center;gap:20px;padding:4px 0 20px}
    .px-ring-v{transform:rotate(-90deg);transform-origin:50% 50%;
      stroke-dashoffset:var(--c);animation:pxRing 1.6s .45s var(--px-ease) forwards;
      filter:drop-shadow(0 0 6px var(--gold-glow))}
    @keyframes pxRing{to{stroke-dashoffset:var(--o)}}
    .px-prep-n{font-family:'Cinzel',serif;font-size:15px;color:var(--text);letter-spacing:.04em}
    .px-prep-c{font-size:13px;color:var(--muted);line-height:1.5;margin-top:5px}

    .px-step{display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:13px 9px;
      background:none;border:none;border-bottom:1px solid var(--border);
      transition:background .24s,padding-left .24s}
    button.px-step{cursor:pointer}
    button.px-step:hover{background:linear-gradient(90deg,var(--gold-veil),transparent 60%);padding-left:16px}
    .px-step-b{width:22px;height:22px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;
      border:1.5px solid var(--border2);color:#17120a;background:rgba(0,0,0,.4);
      transition:background .3s,border-color .3s,box-shadow .3s}
    .px-step-b.on{background:linear-gradient(178deg,var(--gold2),var(--gold3));border-color:var(--gold);
      box-shadow:0 0 16px -3px var(--gold-glow),inset 0 1px 0 rgba(255,255,255,.4)}
    .px-step-t{flex:1;min-width:0;font-size:14px;color:var(--text);line-height:1.4}
    .px-step.done .px-step-t{color:var(--muted);text-decoration:line-through;opacity:.6}
    .px-check{stroke-dasharray:22;stroke-dashoffset:22;animation:pxDraw .55s var(--px-ease) forwards;
      animation-delay:var(--d,.5s)}
    @keyframes pxDraw{to{stroke-dashoffset:0}}

    /* ══ NOTA / VAZIO ═══════════════════════════════════════════════════ */
    .px-note{padding:16px 17px;border-radius:4px;border:1px solid var(--border);
      background:linear-gradient(168deg,rgba(255,255,255,.045),rgba(255,255,255,.008));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05),inset 0 -1px 0 rgba(0,0,0,.45);
      font-size:13.5px;color:var(--muted2);line-height:1.55}
    .px-note-k{display:block;font-family:'IBM Plex Mono',monospace;font-size:10.5px;
      letter-spacing:.1em;color:var(--gold);opacity:.85;margin-bottom:7px}
    .px-empty{position:relative;padding:30px 24px 32px;border-radius:4px;
      border:1px solid var(--border);
      background:radial-gradient(90% 130% at 10% 0%,var(--gold-veil),transparent 60%)}
    .px-empty-t{font-family:'Cinzel Decorative',serif;font-size:16px;color:var(--text);margin-bottom:10px}
    .px-empty-d{font-size:14px;color:var(--muted);line-height:1.6;max-width:52ch;margin-bottom:18px}
    .px-btn{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase;
      padding:12px 20px;border-radius:3px;cursor:pointer;color:var(--muted2);
      background:linear-gradient(168deg,rgba(255,255,255,.045),rgba(255,255,255,.012));
      border:1px solid var(--border2);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
      transition:color .22s,border-color .22s,box-shadow .22s,transform .2s var(--px-ease)}
    .px-btn:hover{color:var(--text);border-color:var(--gold);transform:translateY(-1px);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 26px -10px var(--gold-glow)}

    .px :focus-visible{outline:2px solid var(--gold);outline-offset:2px;border-radius:3px}

    /* ══ RESPONSIVO ═════════════════════════════════════════════════════ */
    @media(max-width:1200px){ .px-armila{right:-190px;opacity:.32} }
    @media(max-width:980px){
      .px-split{grid-template-columns:1fr;gap:32px}
      .px-armila{display:none}
    }
    @media(max-width:640px){
      .px-hero{padding:30px 20px 26px}
      .px-hero-canto{display:none}
      .px-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .px-stat{padding:16px 14px 14px}
      .px-stat-num{font-size:26px}
      .px-camps{grid-template-columns:1fr}
      .px-hero-act{width:100%}
      .px-cta{flex:1}
    }

    /* ══ MOVIMENTO REDUZIDO ═════════════════════════════════════════════ */
    @media(prefers-reduced-motion:reduce){
      .px *,.px *::before,.px *::after{
        animation-duration:.001ms!important;animation-iteration-count:1!important;
        transition-duration:.001ms!important}
      .px-in{opacity:1!important;transform:none!important}
      .px-aura,.px-motes,.px-armila{display:none}
      .px-title{-webkit-text-fill-color:var(--text);background:none}
      .px-meter i{width:var(--w,0%)}
      .px-ring-v{stroke-dashoffset:var(--o)}
      .px-check{stroke-dashoffset:0}
    }
    `}</style>
  );
}
