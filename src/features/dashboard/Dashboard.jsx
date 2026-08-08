import { useLocale } from "../../i18n/useLocale";
import DossierCard from "../../components/systems/OrdemParanormal/DossierCard";
import { getActiveAvatar } from "../../domain/character";
import { MAX_CAMPAIGNS_PER_SYSTEM } from "../../domain/campaign";
import CampaignCard from "../campanha/CampaignCard";
import ResumeBar from "./ResumeBar";
import NeedsYou from "./NeedsYou";
import PrepChecklist from "./PrepChecklist";
import { ler as lerUltimaVisita } from "../../lib/lastVisit";

/* ═══════════════════════════════
   PAINEL
═══════════════════════════════ */
/* O Painel era um ÍNDICE DE RECURSOS: dois contadores sem teto, uma lista de no
 * máximo 5 fichas e três atalhos que repetiam literalmente a barra lateral —
 * um terço da largura gasto duplicando navegação. Agora ele é ESTADO DO JOGO,
 * na ordem em que a pergunta aparece:
 *
 *   1. Retomar          — "o que eu estava fazendo?"   (localStorage, zero I/O)
 *   2. Precisa de você  — "o que espera por mim?"      (some quando vazio)
 *   3. Números com teto — "quanto do meu plano usei?"
 *   4. Corpo            — campanhas e personagens; trilho com o preparo
 *
 * A ORDEM DO DOM É A ORDEM DO MOBILE. Não há `order:` em media query em lugar
 * nenhum: se a ordem precisasse de CSS para fazer sentido, a ordem estaria
 * errada.
 *
 * `sessions` NÃO é recebida: `setSessions` nunca era chamado no App e o
 * contador "Sessões" que saía dali era 0 permanente com cara de dado. O estado
 * morto saiu do App junto com esta prop.
 * `campaignCount` também saiu: o número agora vem de `campaigns`, que o Painel
 * precisa inteiro para desenhar a grade. */
function Dashboard({
  system, onCreateChar, characters, onSelectChar, onNav,
  userPlans = [], onShowUpgrade,
  uid = "", campaigns = [], liveSheets = {}, dados = {},
  onOpenCampaign, onCreateCampaign,
}) {
  const locale = useLocale();
  const sT = locale.t;
  const accent = system?.accent || "var(--gold)";
  const isSubscribed = userPlans.includes(system?.id);
  const charLimit = isSubscribed ? 5 : 1;

  const sysChars = characters.filter(c =>
    c.systemId === system?.id || (!c.systemId && system?.id === 'op')
  );

  const atLimit = sysChars.length >= charLimit;
  const campsAtivas = campaigns.filter(c => c.isActive !== false);
  const campsNoTeto = campsAtivas.length >= MAX_CAMPAIGNS_PER_SYSTEM;

  const { mapCount = 0, pendentes = [], prep = [], prepConcluido = false } = dados;

  /* O DossierCard (usado só em OP) tem borda e canto arredondado próprios;
     empilhado num .nx-list — que separa por filete, sem espaço — dois cartões
     encostam, as bordas de 1px se somam num traço duplo e os cantos se pinçam.
     `nx-list-cards` troca o filete por respiro. A lista de LINHAS dos outros
     sistemas continua sem gap, que é o certo para ela. */
  const classeDaLista = system?.id === "op" ? "nx-list nx-list-cards" : "nx-list";

  /* ── Faixa de números ──
     Todos com TETO. Denominador transforma contador em semáforo de cota: "2"
     não diz nada, "2/3" diz que resta uma. "Mapas" fica sem denominador porque
     a cota de mapas depende do plano e é decidida noutra camada — inventar um
     teto aqui seria número falso, exatamente o vício que esta tela expulsou
     quando "Sessões" e "Horas jogadas" saíram. */
  const stats = [
    { label:"Fichas",    val:`${sysChars.length}/${charLimit}`, nav:"sheet", hint:"Ver todas as fichas" },
    { label:"Campanhas", val:`${campsAtivas.length}/${MAX_CAMPAIGNS_PER_SYSTEM}`, nav:"party", hint:"Ver campanhas" },
    { label:"Mapas",     val:String(mapCount), nav:"map", hint:"Abrir o editor de mapas" },
  ];

  /* ── Ação contextual do cabeçalho ──
     UM botão preenchido por tela, e ele muda de destino conforme o que falta.
     A precedência segue o uso principal declarado (preparar como mestre) e
     nunca deixa o usuário num beco: a única variante inerte é aquela em que
     realmente não há para onde ir.
       1 · sem campanha e abaixo do teto → criar campanha  (o mestre começa aqui)
       2 · abaixo da cota de fichas      → nova ficha
       3 · cota cheia e SEM assinar      → ver planos (ATIVO: é a saída)
       4 · cota cheia, assinante, com espaço de campanha → nova campanha
       5 · nada a fazer                  → inerte, e só aqui */
  const acao = (() => {
    if (campsAtivas.length === 0 && !campsNoTeto && onCreateCampaign)
      return { rotulo:"+ Nova campanha", onClick:onCreateCampaign, titulo:"Criar sua primeira campanha" };
    if (!atLimit)
      return { rotulo:"+ Nova ficha", onClick:onCreateChar, titulo:"" };
    if (!isSubscribed)
      return { rotulo:"Ver planos", onClick:()=>onShowUpgrade?.(), titulo:"Assine este sistema para criar mais fichas" };
    if (!campsNoTeto && onCreateCampaign)
      return { rotulo:"+ Nova campanha", onClick:onCreateCampaign, titulo:"Criar mais uma campanha" };
    return { rotulo:`Limite ${charLimit}/${charLimit}`, onClick:null, titulo:`Limite de ${charLimit} fichas atingido` };
  })();

  return (
    <div className="fade nx-page">

      {/* ── Cabeçalho ──
          Sobrancelha, título, subtítulo, filete — o mesmo de todas as outras
          telas. A identidade do sistema vive na migalha da topbar, não num
          herói de 100px com brilho radial. */}
      <div className="nx-head">
        <div className="nx-head-txt">
          <div className="nx-eyebrow">{sT("dashboard.welcome")}</div>
          <h1 className="nx-h1">Painel</h1>
          {system?.desc && <p className="nx-sub">{system.desc}</p>}
        </div>
        <div className="nx-head-actions">
          {/* Selo de plano: informação, não enfeite — texto ao lado do botão. */}
          <span title={isSubscribed ? "Assinante deste sistema" : "Plano gratuito"}
            style={{fontFamily:"Cinzel,serif", fontSize:9.5, letterSpacing:"0.14em",
              textTransform:"uppercase", color: isSubscribed ? "var(--gold)" : "var(--muted)"}}>
            {isSubscribed ? "✦ Pro" : "Livre"}
          </span>
          <button
            className="btn-gold"
            disabled={!acao.onClick}
            style={{opacity: acao.onClick ? 1 : 0.45, cursor: acao.onClick ? "pointer" : "not-allowed"}}
            onClick={() => acao.onClick?.()}
            title={acao.titulo}
          >
            {acao.rotulo}
          </button>
        </div>
      </div>

      {/* 1 · Retomar — não renderiza se não há alvo, ou se o alvo sumiu */}
      <ResumeBar alvo={lerUltimaVisita()} campaigns={campaigns}
        onNav={onNav} onOpenCampaign={onOpenCampaign}/>

      {/* 2 · Precisa de você — some inteiro quando não há nada pendente */}
      <NeedsYou pendentes={pendentes} liveSheets={liveSheets} characters={characters}
        campaigns={campaigns} uid={uid}
        onSelectChar={onSelectChar} onOpenCampaign={onOpenCampaign}/>

      {/* 3 · Números — chapados, separados por filete vertical */}
      <div className="nx-stats" style={{"--nx-cols": stats.length}}>
        {stats.map((s)=>(
          <button key={s.label} className="nx-stat" title={s.hint} onClick={()=>onNav && onNav(s.nav)}>
            <span className="nx-stat-num">{s.val}</span>
            <span className="nx-stat-cap">{s.label}</span>
          </button>
        ))}
      </div>

      {/* 4 · Corpo 2/1 — conteúdo do usuário à esquerda, preparo à direita. */}
      <div className="nx-split">

        <div style={{display:"flex", flexDirection:"column", gap:26, minWidth:0}}>

          {/* ── Campanhas ──
              Ganharam a coluna principal, acima dos personagens: é o
              preenchimento honesto do vazio que sobrava aqui — conteúdo do
              usuário, não widget. O `CampaignCard` entra COMO ESTÁ; ele tem
              sombra e translateY, vocabulário anterior ao `.nx-*`, mas é
              conteúdo com capa (exceção legítima). Não propagar. */}
          {campaigns.length > 0 && (
            <section>
              <div className="nx-sec">
                <span className="nx-sec-t">Suas campanhas</span>
                <button className="nx-sec-a" onClick={()=>onNav && onNav("party")}>Ver todas →</button>
              </div>
              <div className="nx-cards">
                {campaigns.slice(0, 4).map(c => (
                  <CampaignCard key={c.id} campaign={c} uid={uid}
                    onClick={()=>onOpenCampaign ? onOpenCampaign(c) : onNav?.("party")}/>
                ))}
              </div>
            </section>
          )}

          {/* ── Personagens — intacta ── */}
          <section>
            <div className="nx-sec">
              <span className="nx-sec-t">Seus personagens</span>
              {sysChars.length > 0 && (
                <button className="nx-sec-a" onClick={()=>onNav && onNav("sheet")}>Ver todas →</button>
              )}
            </div>

            {sysChars.length === 0 ? (
              /* Vazio alinhado à esquerda, com UM caminho. O anterior era um
                 pôster centralizado com ícone de 52px e um segundo botão dourado
                 que disputava com o do cabeçalho — dois CTAs primários idênticos
                 na mesma tela. */
              <div className="nx-empty">
                <div className="nx-empty-t">Nenhum agente ainda</div>
                <p className="nx-empty-d">
                  A ficha é o ponto de partida: atributos, perícias, inventário e rituais
                  ficam todos nela.
                </p>
                <button className="nx-btn" onClick={onCreateChar}>Criar primeiro agente</button>
              </div>
            ) : (
              <div className={classeDaLista}>
                {sysChars.map((c,i)=> system?.id === "op"
                  ? <DossierCard key={i} character={c} systemAccent={system?.accent} onClick={()=>onSelectChar && onSelectChar(c)} />
                  : (
                  <button key={i} className="nx-row" onClick={()=>onSelectChar && onSelectChar(c)}>
                    <div style={{
                      width:44, height:44, borderRadius:4, flexShrink:0,
                      background:"rgba(255,255,255,0.04)", border:"1px solid var(--border)",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:19,
                      overflow:"hidden",
                    }}>
                      {getActiveAvatar(c)
                        ? <img src={getActiveAvatar(c)} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                        : "🕵️"}
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div className="nx-row-t">{c.form?.personagem || "Sem nome"}</div>
                      <div className="nx-row-m">{c.classe?.name || "—"} · {c.origem?.name || "—"}</div>
                    </div>
                    <div style={{display:"flex", flexDirection:"column", gap:6, width:104, flexShrink:0}}>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace", fontSize:10.5, color:"var(--muted)", letterSpacing:"0.04em"}}>
                        NEX {c.nex ?? 5}%
                      </span>
                      {/* filete chapado no lugar do degradê de duas paradas */}
                      <div style={{height:2, background:"rgba(255,255,255,0.07)"}}>
                        <div style={{height:"100%", width:`${c.nex ?? 5}%`, background:accent}}/>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Trilho de contexto ──
            As "Ferramentas" saíram: eram os mesmos três destinos da barra
            lateral, escritos de novo. No lugar entra o preparo — que some
            sozinho quando o usuário não precisa mais dele. */}
        <aside className="nx-rail">
          <PrepChecklist passos={prep} concluido={prepConcluido} onNav={onNav}/>

          <div>
            <div className="nx-sec"><span className="nx-sec-t">Seu plano</span></div>
            <div className="nx-note">
              <span className="nx-note-k">FICHAS {sysChars.length}/{charLimit}</span>
              <span>{isSubscribed
                ? "Assinatura ativa neste sistema."
                : "O plano livre permite uma ficha por sistema."}</span>
            </div>
            {!isSubscribed && (
              <button className="nx-sec-a" style={{marginTop:12, padding:0}} onClick={()=>onNav && onNav("planos")}>
                Ver planos →
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Dashboard;
