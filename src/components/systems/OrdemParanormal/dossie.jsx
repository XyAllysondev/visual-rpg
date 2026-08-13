/* ════════════════════════════════════════════════════════════════════════
 *  ORDEM PARANORMAL — DOSSIÊ (spec 0035)
 *  ------------------------------------------------------------------------
 *  O MATERIAL da ficha: papel de arquivo escuro, fibra com direção, vinco e
 *  a gramática de formulário datilografado. Renderize DEPOIS de
 *  <OrdemSheetStyles/> — esta folha sobrescreve `.op-ink` de propósito.
 *
 *  Por que uma folha separada e não mais linhas no ordemStyles: o material é
 *  uma CAMADA (aplicada por seletor sobre as classes que já existem), do
 *  mesmo jeito que `themes/heraldica` é a pele global. O JSX das telas de
 *  conteúdo não precisa saber que virou papel.
 *
 *  Sem literal de cor de identidade: tudo sai de token do tema (AC-5). Só
 *  preto e branco de sombra/realce aparecem crus — são LUZ, não identidade,
 *  e é o que a spec abre como exceção.
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * Número de processo do dossiê, derivado do id da ficha (spec 0035 AC-3).
 *
 * DETERMINÍSTICO por contrato: o mesmo id devolve sempre o mesmo número, em
 * qualquer sessão e em qualquer máquina. É o ponto inteiro do AC — um número
 * que PARECE dado e não é (Math.random, contador de render, Date.now) é o
 * pior defeito possível numa tela que se apresenta como documento oficial.
 * Foi a mesma regra que o Painel já seguia.
 *
 * Sem id não há processo: devolve null e o campo simplesmente não aparece,
 * em vez de inventar um placeholder.
 *
 * @param {string|undefined} charId id da ficha (o mesmo que vai em /p/:id)
 * @returns {string|null} algo como "4471-A/88", ou null se não houver id
 */
export function numeroDeProcesso(charId) {
  if (!charId) return null;
  const s = String(charId);
  if (!s) return null;
  /* FNV-1a 32 bits. Escolhido por ser curto, sem dependência e bem
     distribuído para strings curtas — que é exatamente o formato de um id
     de documento do Firestore. Math.imul mantém a multiplicação em 32 bits
     inteiros; sem ele o valor estoura o float e o hash deixa de ser estável. */
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  /* Três fatias de bits pouco sobrepostas. Derivar os três campos do mesmo
     resto (h%10000 e h%100) faria o "ano" repetir os dois últimos dígitos da
     série — "4471-A/71" — e a repetição denuncia que o número é derivado. */
  const serie = String(h % 10000).padStart(4, "0");
  const letra = String.fromCharCode(65 + ((h >>> 20) % 26));
  const ano = String((h >>> 12) % 100).padStart(2, "0");
  return serie + "-" + letra + "/" + ano;
}

export const DossieStyles = () => (
  <style data-op-dossie>{`
    /* ── TOKENS DO MATERIAL ────────────────────────────────────────────────
       Um lugar só para o papel. Trocar o tema (ou o sistema) repinta o
       dossiê inteiro sem ninguém editar regra. */
    .op-sheet{
      /* Datilografia. 'Courier Prime' JÁ vem no @import — o ThemeStyles
         importa o googleFonts de TODOS os sistemas, não só do ativo
         (ThemeProvider.jsx), então o tema do D&D a serve para o OP de
         graça. É o que o AC-4 pede: nenhuma family= nova. */
      --dos-tipo:'Courier Prime','Courier New',ui-monospace,monospace;
      /* Pontilhado de preenchimento. Era var(--border2) — rgba(198,164,92,0.38)
         composto sobre o card dá 2,12:1, ABAIXO do 3:1 que o AC-6 exige de
         régua e pontilhado que carregam informação (e este carrega: é ele que
         liga o rótulo ao valor). var(--muted) sobre o card mede 5,76:1, com
         folga para a vinheta do ::after escurecer por cima. E grafite lê como
         formulário melhor que ouro: o guia é preenchimento, não ornamento. */
      --dos-guia:var(--muted);
      /* O vinco é um GRADIENTE LARGO (34%→68% da largura), não uma faixa de
         3%. Visto na tela (T8, 2026-08-08): a faixa estreita com sombra 0,34
         virava uma LINHA vertical clara cortando o painel — lia como artefato
         de render, não como dobra. Dobra de papel é sombra rasa e larga que
         aprofunda devagar até a charneira e solta um fio de luz na saída. */
      --dos-vinco-sombra:rgba(0,0,0,0.10);
      --dos-vinco-sombra2:rgba(0,0,0,0.22);
      --dos-vinco-luz:rgba(255,255,255,0.035);
      --dos-fibra:0.055;                  /* opacidade da fibra sobre a folha */
    }

    /* ── AC-1 · FIBRA, NÃO RUÍDO ──────────────────────────────────────────
       Três diferenças para o ".op-grain" que isto substitui:
       1. type='turbulence', não 'fractalNoise'. O fractalNoise é isotrópico
          — mesma energia em toda direção — e é por isso que lia como
          chuvisco de TV em vez de material.
       2. baseFrequency ANISOTRÓPICA ('0.012 0.62'): frequência quase nula em
          X e alta em Y estica cada célula de ruído na horizontal. É isso que
          vira FIBRA DEITADA, com direção, em vez de poeira.
       3. stitchTiles='stitch' costura o tile: sem isso a emenda de 180px
          aparece como grade regular assim que o painel passa dessa largura.
          E o filtro declara x/y/width/height EXPLÍCITOS de propósito — sem
          isso valem os padrões do SVG (x=-10% y=-10% width=120% height=120%),
          a região do filtro fica 216x216 em (-18,-18), e o stitchTiles passa
          a costurar numa grade que NÃO é a de 180px que o background-repeat
          emenda. O atributo custaria sem entregar: a descontinuidade continua
          exatamente em x=180 / y=180, que é onde a imagem se repete.

       Rasterizado em fundo estático e SEM animação — o AC-1 proíbe filtro
       SVG por frame, e com razão: feTurbulence animado é das coisas mais
       caras que um browser pode repintar. */
    .op-ink::before{
      content:""; position:absolute; inset:0; pointer-events:none;
      border-radius:inherit; opacity:var(--dos-fibra); mix-blend-mode:overlay;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='f' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.012 0.62' numOctaves='4' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E");
      background-size:180px 180px;
    }
    /* O modal de upload usa "op-ink op-grain" no mesmo nó — os dois querem o
       ::before. A fibra vence por ORDEM DE ORIGEM (mesma especificidade 0,1,1;
       o <style> do dossiê monta depois do <style> do ordemStyles), não por
       esta regra. O que ela existe para fazer é anular o resíduo que a fibra
       NÃO redeclara: o z-index:0 do .op-grain::before, que sobrevive à
       colisão e cria um contexto de empilhamento desnecessário no pseudo. */
    .op-ink.op-grain::before{ z-index:auto; }

    /* VINCO + BORDA GASTA no ::after, que já era a moldura interna.
       O vinco é uma dobra só, com a charneira fora do centro (~51%): dobra
       exatamente no meio lê como espelhamento de CSS, não como papel dobrado
       à mão. A vinheta escurece os cantos — é onde a folha encosta na mesa e
       some na luz.

       A vinheta para em 0,18 e só começa a 74% do raio: este ::after pinta POR
       CIMA do texto (é pseudo posicionado num pai de conteúdo estático), então
       cada ponto de escurecimento aqui sai do contraste medido no AC-6. A 0,18
       o texto (--text sobre --card, 13,66:1 limpo) fica em ~9:1 no pior canto,
       e o pontilhado a 5,76:1 continua acima do piso de 3:1. Escurecer mais
       ficaria bonito e reprovaria o AC. */
    .op-ink::after{
      background-image:
        linear-gradient(90deg, transparent 34%, var(--dos-vinco-sombra) 48.5%, var(--dos-vinco-sombra2) 51%, var(--dos-vinco-luz) 52.8%, transparent 68%),
        radial-gradient(130% 92% at 50% -8%, transparent 74%, rgba(0,0,0,0.18) 100%);
    }

    /* ── AC-2 · FORMULÁRIO, NÃO LISTA ─────────────────────────────────────
       Rótulo · pontilhado · valor na MESMA linha, alinhados pela baseline.
       É o pontilhado que faz o olho ler "campo preenchido": ele prova que o
       espaço entre o rótulo e o valor é um vão a ser preenchido, e não só
       margem. Lista renderizada empilha; formulário impresso liga. */
    .dos-campo{ display:flex; align-items:baseline; width:100%; gap:0; min-width:0; }
    .dos-campo-rotulo{
      flex:0 0 auto; font-family:var(--font-title,'Cinzel',serif);
      font-variant-caps:small-caps; font-size:12px; letter-spacing:0.08em;
      color:var(--muted2); white-space:nowrap;
    }
    /* O guia é um elemento próprio, não um border no rótulo: assim ele come
       exatamente o espaço sobrando (flex:1) e o valor fica colado à direita,
       que é como um formulário de verdade se comporta em qualquer largura. */
    .dos-campo-guia{
      flex:1 1 auto; min-width:14px; margin:0 7px;
      border-bottom:1px dotted var(--dos-guia);
      transform:translateY(-3px);
    }
    .dos-campo-valor{
      flex:0 1 auto; min-width:0; font-family:var(--dos-tipo); font-size:13px;
      color:var(--text); text-align:right;
      /* Algarismo tabular: sem isto o "1" é mais estreito que o "8" e uma
         coluna de números datilografados sai serrilhada na vertical. */
      font-variant-numeric:tabular-nums lining-nums;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    /* No modo edição o campo continua sendo o mesmo campo — só ganha cursor.
       Trocar a tipografia entre ler e editar faz o valor "pular", e o usuário
       lê isso como se o dado tivesse mudado. */
    .dos-campo-entrada{
      flex:0 1 auto; min-width:0; width:auto; font-family:var(--dos-tipo); font-size:13px;
      font-variant-numeric:tabular-nums lining-nums; text-align:right;
      color:var(--text); background:transparent; border:none;
      border-bottom:1px solid var(--border2); padding:1px 2px;
    }
    .dos-campo-entrada:focus{ outline:none; border-bottom-color:var(--gold); }

    /* ── AC-3 · TIMBRE ────────────────────────────────────────────────────
       A linha de cabeçalho do dossiê: sobrancelha, número de processo e
       classificação. O número sai do id da ficha (ver numeroDeProcesso
       abaixo) — nunca de random nem de contador. Tabular porque é número
       de protocolo: os dígitos têm que ficar em pé debaixo uns dos outros
       quando duas fichas aparecem em sequência. */
    .dos-timbre{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .dos-processo{
      font-family:var(--dos-tipo); font-size:10px; letter-spacing:0.16em;
      color:var(--muted); font-variant-numeric:tabular-nums lining-nums;
      white-space:nowrap;
    }
    .dos-classificacao{
      font-family:var(--font-title,'Cinzel',serif); font-size:9px; font-weight:700;
      letter-spacing:0.22em; text-transform:uppercase; color:var(--brasao2);
      border:1px solid var(--brasao); border-radius:2px; padding:1px 6px;
      white-space:nowrap;
    }

    /* ── T6 · CARIMBO ─────────────────────────────────────────────────────
       Ornamento, e ASSUMIDAMENTE ornamento: o texto é fixo em ATIVO por
       decisão do Andre (2026-08-08). A alternativa — derivar ATIVO/BAIXA/
       DESAPARECIDO de PV e SAN — foi recusada porque inventaria vocabulário
       de estado que nenhuma spec do sistema define. Um carimbo que PARECE
       refletir estado sem refletir seria o mesmo defeito que o AC-3 proíbe
       no número de processo, só que em palavra em vez de número.

       Rotação e opacidade ficam abaixo de 1 de propósito: carimbo entintado
       à mão não sai chapado nem alinhado à grade. A 0,72 sobre o card mede
       3,62:1 — acima do piso de 3:1 do AC-6 para elemento gráfico. */
    .dos-carimbo{
      position:absolute; right:10px; bottom:8px; pointer-events:none; user-select:none;
      transform:rotate(-11deg); opacity:0.72; z-index:2;
      font-family:var(--font-title,'Cinzel',serif); font-size:13px; font-weight:700;
      letter-spacing:0.28em; text-transform:uppercase; color:var(--brasao2);
      border:2px solid var(--brasao2); border-radius:3px; padding:3px 9px 3px 13px;
      box-shadow:0 0 0 1px rgba(0,0,0,0.35) inset;
    }

    /* ═══ QUICK 006 · O DOSSIÊ LEVADO AO FIM ═════════════════════════════
       A 0035 pôs o material; isto põe o APARATO — folha de rosto, foto
       presa, censura, grade datilografada. É o aparato que faz o olho
       acreditar. Mesmos canais da 0035: seletor sobre classe existente,
       token sempre, ornamento é aria-hidden no JSX. */

    /* ── FOLHA DE ROSTO ───────────────────────────────────────────────────
       O painel-capa do processo, primeiro da coluna esquerda. O padding
       esquerdo maior (30px) é a margem de arquivamento — o respiro que os
       furos pedem num fichário de verdade. */
    .dos-rosto{ overflow:hidden; }
    /* Furo de arquivo VAZADO: o miolo é var(--bg) — a mesa aparecendo
       através do papel furado. É um detalhe que ninguém nota conscientemente
       e todo mundo lê: o papel é uma coisa SOBRE outra. */
    .dos-furo{
      position:absolute; left:9px; width:11px; height:11px; border-radius:50%;
      background:radial-gradient(circle at 38% 32%, var(--bg) 62%, rgba(0,0,0,0.88) 100%);
      box-shadow:inset 0 1px 2px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.05);
    }
    /* Tracking 0.18em, não mais: a 0.26em a linha estourava os 204px úteis
       da coluna de 248px (media ≤1180) e truncava em reticências — e timbre
       de agência NÃO trunca; encolher o respiro é o custo certo. */
    .dos-agencia{
      font-family:var(--font-title,'Cinzel',serif); font-size:8px; font-weight:600;
      letter-spacing:0.18em; text-transform:uppercase; color:var(--muted2);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    /* O número do processo em corpo de carimbo de protocolo. --text sobre o
       card mede 13,66:1 — o número é o herói da folha e lê a metros. */
    .dos-processo-hero{
      font-family:var(--dos-tipo); font-size:17px; font-weight:700; color:var(--text);
      letter-spacing:0.1em; font-variant-numeric:tabular-nums lining-nums; line-height:1.15;
    }
    /* Listras de segurança na tarja: repeating-gradient no véu do brasão.
       O texto em --brasao2 sobre o card mede 5,93:1 (calculado, não estimado)
       — acima dos 4,5:1, então a tarja é LEGÍVEL, não só decorativa. */
    .dos-tarja{
      display:inline-block; font-family:var(--font-title,'Cinzel',serif);
      font-size:9px; font-weight:700; letter-spacing:0.3em; text-transform:uppercase;
      color:var(--brasao2); border:1px solid var(--brasao); border-radius:2px;
      padding:2px 8px 2px 10px;
      background:repeating-linear-gradient(45deg, transparent 0 6px, var(--brasao-veu) 6px 12px);
      white-space:nowrap;
    }
    /* ── CENSURA (fecha o T6 da 0035) ─────────────────────────────────────
       Tarja de redação: um bloco de tinta preta. Ela NÃO cobre dado real —
       cobre um campo que não existe, e é isso que a mantém honesta: censura
       afirma ausência de acesso, não presença de informação. Sempre
       aria-hidden no JSX; largura fixa em ch no uso (nada de random). */
    .dos-censura{
      display:inline-block; height:0.95em; vertical-align:text-bottom; min-width:3ch;
      background:linear-gradient(180deg, rgba(0,0,0,0.92), rgba(0,0,0,0.8));
      border-radius:1px; box-shadow:0 0 0 1px rgba(255,255,255,0.04);
    }
    .dos-rodape{
      margin-top:8px; font-family:var(--dos-tipo); font-size:8.5px;
      letter-spacing:0.14em; color:var(--muted); text-transform:uppercase;
      display:flex; align-items:baseline; gap:5px;
    }
    .dos-rubrica{ display:inline-block; width:54px; height:8px; border-bottom:1px solid var(--dos-guia); }

    /* ── FOTO 3×4 ─────────────────────────────────────────────────────────
       Cantos de álbum: oito tiras pretas (duas por canto) desenhadas por
       background — nenhum elemento extra além do overlay. Preto é luz de
       material (os cantos são o que prende a foto), dentro da exceção. */
    .dos-cantos{
      position:absolute; inset:6px; pointer-events:none; z-index:2;
      background:
        linear-gradient(rgba(0,0,0,0.78),rgba(0,0,0,0.78)) left 0 top 0/16px 3px no-repeat,
        linear-gradient(rgba(0,0,0,0.78),rgba(0,0,0,0.78)) left 0 top 0/3px 16px no-repeat,
        linear-gradient(rgba(0,0,0,0.78),rgba(0,0,0,0.78)) right 0 top 0/16px 3px no-repeat,
        linear-gradient(rgba(0,0,0,0.78),rgba(0,0,0,0.78)) right 0 top 0/3px 16px no-repeat,
        linear-gradient(rgba(0,0,0,0.78),rgba(0,0,0,0.78)) left 0 bottom 0/16px 3px no-repeat,
        linear-gradient(rgba(0,0,0,0.78),rgba(0,0,0,0.78)) left 0 bottom 0/3px 16px no-repeat,
        linear-gradient(rgba(0,0,0,0.78),rgba(0,0,0,0.78)) right 0 bottom 0/16px 3px no-repeat,
        linear-gradient(rgba(0,0,0,0.78),rgba(0,0,0,0.78)) right 0 bottom 0/3px 16px no-repeat;
    }
    /* Papel fotográfico é MAIS CLARO que o papel do arquivo — a moldura em
       --text é contraste de intenção, não acidente. Só quando há foto. */
    .dos-foto img{ border:3px solid var(--text); box-sizing:border-box; }
    /* O vinco e a vinheta do papel de arquivo NÃO atravessam a fotografia:
       uma foto presa por cantos está SOBRE a folha, não impressa nela, e a
       dobra do papel passando por dentro dela denunciava o truque. Achado do
       teste de aceite da quick 007, corrigido na 008. A moldura interna
       (border/box-shadow do ::after) fica — essa é da folha, não da foto. */
    .dos-foto::after{ background-image:none; }
    /* Sem foto: a área demarcada onde a foto DEVERIA estar. O tracejado no
       --dos-guia (5,76:1) é régua informativa: diz "cole aqui". */
    .dos-foto-vazia{
      position:absolute; inset:14px; border:1px dashed var(--dos-guia); border-radius:2px;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px;
      pointer-events:none;
    }
    .dos-anexo{
      position:absolute; top:7px; right:8px; z-index:2; pointer-events:none;
      font-family:var(--dos-tipo); font-size:8px; letter-spacing:0.18em;
      color:var(--muted); text-transform:uppercase;
      background:rgba(0,0,0,0.55); padding:2px 5px; border-radius:2px;
    }

    /* ── GRADE DATILOGRAFADA (perícias) ───────────────────────────────────
       Réguas verticais finas entre as colunas numéricas e sublinhado DUPLO
       no cabeçalho — a assinatura de tabela batida à máquina. Ornamento
       (o alinhamento é quem informa), por isso pode ser sutil. Só CSS:
       nenhuma linha de JSX na tabela. */
    .op-skill>*:nth-child(n+3), .op-skill-head>*:nth-child(n+3){
      border-left:1px solid var(--gold-veil); padding-left:3px;
    }
    .op-skill-head{ border-bottom:3px double var(--border2); }

    /* ── MARCA D'ÁGUA ─────────────────────────────────────────────────────
       Uma vez só (restraint: repetida em cada painel viraria papel de
       parede). Ametista a 4% — atmosfera, não informação. */
    .dos-marca{
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      pointer-events:none; user-select:none; z-index:0; overflow:hidden;
      font-family:var(--font-display,'Cinzel Decorative',serif);
      font-size:clamp(30px,4.6vw,54px); letter-spacing:0.18em; text-transform:uppercase;
      color:var(--brasao); opacity:0.045; transform:rotate(-22deg); white-space:nowrap;
    }

    /* ── SOMBRA DE PAPEL ──────────────────────────────────────────────────
       Cada painel é uma folha sobre a mesa: fio de luz na aresta de cima
       (onde a luz baixa pega) e sombra macia caindo por baixo. Preto e
       branco puros — é luz, a exceção que a spec abre. */
    .op-ink{
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.035), 0 12px 26px -16px rgba(0,0,0,0.6);
    }

    /* ── AC-2 · O ALGARISMO TABULAR PRECISA ALCANÇAR UM NÚMERO ────────────
       Declarar tabular-nums só em .dos-campo-valor deixava a cláusula ociosa:
       as duas instâncias de <Field> renderizam TEXTO (jogador e proteção), e
       ainda por cima vivem em painéis diferentes — nunca formam a coluna
       vertical que o AC pede como resultado observável.

       A coluna de números de verdade é a tabela de perícias; os mostradores
       de atributo e os sinais vitais são o resto. Aplicado por SELETOR sobre
       as classes que já existem, do mesmo jeito que o material: nenhum JSX
       precisa mudar para a ficha ganhar alinhamento vertical de dígito. */
    .op-skill, .op-skill input, .op-skill-head,
    .op-attr-val, .op-data, .op-dial-num, .op-result-num{
      font-variant-numeric:tabular-nums lining-nums;
    }

    /* ── AC-7 · MOVIMENTO REDUZIDO ────────────────────────────────────────
       A MESMA folha, parada. O material é estático por construção, mas a
       folha em volta não era: .op-stagg0 e .op-stagger>* animam op-rise, que
       parte de opacity:0 com fill "both" — sob reduced-motion os blocos ainda
       entravam em cascata por ~0,46s, que é exatamente o movimento que o AC
       manda sair.

       O "animation:none" devolve o estilo base (opacity padrão 1), e a folha
       aparece INTEIRA e de uma vez. O opacity/transform explícitos são cinto e
       suspensório: se alguém puser opacity:0 no estado base depois, o AC-7 não
       vira uma ficha em branco silenciosamente. */
    @media (prefers-reduced-motion: reduce){
      .op-ink::before, .op-ink::after{ animation:none; }
      .op-sheet .op-stagg0, .op-sheet .op-stagger>*{
        animation:none; opacity:1; transform:none;
      }
    }
  `}</style>
);
