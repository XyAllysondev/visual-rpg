import { useState, lazy, Suspense } from "react";
import { db } from "../../firebase";
import MapEditor from "../../components/MapEditor";
import { saveAsset } from "../../components/MapEditor/assets/assetLib";
/* O "Entrar na cena" do mapa-múndi (spec 0028 F5/F6) reusa o MESMO canal que o
   MapEditor já usa para trocar de cena em modo campanha: o doc `map/state`. Não
   é navegação nova — é a que existe, chamada de outro lugar. */
import { setActiveScene as apontarCenaDaCampanha } from "../../components/MapEditor/sync/campaignSync2";
import TokenBuilder from "../../lib/lazyTokenBuilder";

// A MESA do mapa-múndi (spec 0028 F4) — só carrega quando o grupo a abre.
const MesaDoMapaMundi = lazy(() => import("../../components/WorldMap/Mesa"));

/* ── CAMPAIGN MAP TAB ── */
/* ── Mesa tática (spec 0007 / ADR 0005): o MapEditor é o mapa oficial da campanha.
   O tile-based foi aposentado; o doc legado map/current é ignorado. */
/* `fichasCompartilhadas` só ATRAVESSA esta aba: quem as observa é o
   `CampaignDetail` (uma assinatura só), e quem as usa é a mesa do mapa-múndi,
   para tirar delas a melhor Furtividade da esquiva (spec 0035 · M6 · ADR-0012).
   Vazio é o caso comum e não degrada nada — sem ficha, o mestre digita o bônus
   como sempre digitou. */
function CampaignMapTab({ campaignId, uid, isMaster, fichasCompartilhadas = [] }) {
  const [mesaAberta, setMesaAberta] = useState(false);
  const [builderAberto, setBuilder] = useState(false);
  /* A MESA do mapa-múndi (spec 0028 F4). Componente irmão do MapEditor, nunca
     uma modalidade dentro dele (AC-12) — e aberto pelos DOIS papéis: o mestre
     orquestra, o jogador viaja (AC-8). */
  const [mundoAberto, setMundoAberto] = useState(false);
  const [flash, setFlash] = useState("");

  /* ── "Entrar na cena" (spec 0028 · F5/F6) ──────────────────────────
     O evento do mapa-múndi guarda `linkedSceneId`. Levar a mesa até lá é
     exatamente o que o MapEditor já faz quando o mestre troca de cena em
     modo campanha: gravar `activeSceneId` no doc `map/state`, que todos os
     clientes assinam. Aqui o mapa-múndi só aponta esse mesmo interruptor e
     abre a mesa tática por cima (ela é `position:fixed`), então o "← Voltar"
     do MapEditor devolve o mestre ao mapa-múndi onde ele estava.

     Só o MESTRE aponta a cena — a regra da spec 0007 nega a escrita ao
     jogador, e o atalho só existe no painel dele. */
  const entrarNaCena = (sceneId) => {
    if (!sceneId || !isMaster) return;
    apontarCenaDaCampanha(db, campaignId, uid, sceneId);
    setMesaAberta(true);
  };

  /* Token construído entra na biblioteca de assets do usuário como
     'character' — o mesmo tipo que o MapEditor coloca na mesa (spec 0013). */
  const salvarTokenNaBiblioteca = async ({ nome, dataUrl }) => {
    try {
      await saveAsset(db, uid, {
        type: 'character', name: nome, tags: ['construtor'], folder: null,
        data: dataUrl, w: 512, h: 512,
      });
      setFlash(`"${nome}" salvo na biblioteca — abra a mesa tática e use a Biblioteca de assets.`);
      setBuilder(false);
    } catch (e) {
      console.error('[construtor] salvar token falhou:', e);
      setFlash('Não foi possível salvar. Use "Baixar PNG" como alternativa.');
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, overflow:'hidden' }}>
      {builderAberto ? (
        <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:17, color:'#e0c8ff' }}>Construtor de Tokens</div>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1.4, textTransform:'uppercase', color:'var(--muted)' }}>
                Monte o agente camada por camada
              </div>
            </div>
            <button onClick={()=>setBuilder(false)}
              style={{ padding:'7px 14px', borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1 }}>
              ← Voltar
            </button>
          </div>
          <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontFamily:'Crimson Pro,serif' }}>Carregando peças…</div>}>
            <TokenBuilder onSalvar={salvarTokenNaBiblioteca} onFechar={()=>setBuilder(false)} />
          </Suspense>
        </div>
      ) : mundoAberto ? (
        /* O scroll NÃO mora aqui. Este é o pai comum do mapa e do painel do
           mestre: com `overflowY:auto` rolar o console levava o palco para
           fora da tela (`palco.top: -285`). Quem rola é a coluna direita da
           `.wmm-layout` — ver `Mesa/index.jsx` (`.wmm-coluna`).
           Comentário JS puro, sem chaves: aqui é posição de EXPRESSÃO do
           ternário, e a forma com chaves seria lida como objeto literal. */
        <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, overflow:'hidden' }}>
          <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontFamily:'Crimson Pro,serif' }}>Abrindo o mapa-múndi…</div>}>
            <MesaDoMapaMundi campaignId={campaignId} uid={uid} isMaster={isMaster}
              fichasCompartilhadas={fichasCompartilhadas}
              onSair={() => setMundoAberto(false)}
              onEntrarNaCena={isMaster ? entrarNaCena : undefined} />
          </Suspense>
        </div>
      ) : (
        /* Três destinos, três cartões. O título dizia "Mesa tática" — o nome de
           UM dos três — e só esse um tinha explicação; os outros dois eram
           botões nus. Centralizado vertical, a tela ainda empurrava tudo para
           o meio de uma caixa alta; agora começa no alto e respira. */
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', flex:1, minHeight:0, overflowY:'auto', gap:16, textAlign:'center', paddingTop:48, paddingBottom:24 }}>
          <div style={{ fontSize:58, opacity:0.35 }}>🗺️</div>
          <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:17, color:'var(--gold)', opacity:0.7 }}>Mapas da campanha</div>
          <div style={{ fontFamily:"var(--font-body,'Crimson Pro',serif)", fontSize:14, color:'var(--muted)', maxWidth:420, lineHeight:1.8 }}>
            {isMaster
              ? 'Escolha por onde começar — os jogadores acompanham cada mudança ao vivo.'
              : 'O mapa da sessão abre aqui em tempo real, conforme o Mestre edita.'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, maxWidth:760, width:'100%', marginTop:8 }}>
            {[
              { id:'mesa',  onClick:()=>setMesaAberta(true),  emoji:'🗺️', titulo:'Mesa tática',
                linha:'Imagens, tokens, camadas e névoa, ao vivo para a mesa.',
                cor:'rgba(176,48,216,0.5)', texto:'#e0c8ff' },
              { id:'mundi', onClick:()=>setMundoAberto(true), emoji:'🧭', titulo:'Mapa-múndi',
                linha:'A viagem entre lugares, com relógio, suprimentos e névoa.',
                cor:'rgba(201,168,76,0.5)', texto:'var(--gold2)' },
              { id:'token', onClick:()=>setBuilder(true),     emoji:'🎭', titulo:'Construtor de Tokens',
                linha:'Monte um agente camada por camada e salve na biblioteca.',
                cor:'rgba(201,168,76,0.5)', texto:'var(--gold2)' },
            ].map(d => (
              <button key={d.id} onClick={d.onClick} className="camp-mapa-card"
                style={{ padding:'18px 16px', borderRadius:10, border:'1px solid var(--border2)',
                  background:'rgba(255,255,255,0.03)', minHeight:132, textAlign:'left', cursor:'pointer',
                  display:'flex', flexDirection:'column', gap:8, transition:'border-color .18s ease, background .18s ease' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=d.cor;e.currentTarget.style.background='rgba(255,255,255,0.055)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='rgba(255,255,255,0.03)';}}>
                <span style={{ fontSize:20, lineHeight:1 }} aria-hidden="true">{d.emoji}</span>
                <span style={{ fontFamily:'Cinzel,serif', fontSize:14, letterSpacing:0.6, color:d.texto }}>{d.titulo}</span>
                <span style={{ fontFamily:"var(--font-body,'Crimson Pro',serif)", fontSize:13, lineHeight:1.5, color:'var(--muted)' }}>{d.linha}</span>
              </button>
            ))}
          </div>
          {flash && (
            <div style={{ marginTop:6, padding:'8px 14px', borderRadius:8, background:'rgba(106,170,122,0.12)', border:'1px solid rgba(106,170,122,0.35)',
              color:'#8fd3a0', fontFamily:'Crimson Pro,serif', fontSize:14, maxWidth:420 }}>{flash}</div>
          )}
        </div>
      )}
      {mesaAberta && (
        <MapEditor campaignId={campaignId} uid={uid} isMaster={isMaster} db={db}
          onBack={() => setMesaAberta(false)} />
      )}
    </div>
  );
}

export default CampaignMapTab;
