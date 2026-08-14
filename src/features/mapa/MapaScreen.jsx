import { useState, Suspense } from "react";
import { db } from "../../firebase";
import { useSlidingPill } from "../../hooks/useSlidingPill";
import SlidingTabPill from "../../components/SlidingTabPill";
import MapEditor from "../../components/MapEditor";
import WorldMapAtelier from "../../components/WorldMap/Atelier";
import { saveAsset } from "../../components/MapEditor/assets/assetLib";
// Construtor de tokens: o `lazy` é compartilhado com a aba Mapas da campanha.
import TokenBuilder from "../../lib/lazyTokenBuilder";

/* Tela de Mapas do menu lateral: escolhe entre a mesa tática e o construtor
   de tokens. Fora de campanha o construtor salva na biblioteca do usuário. */
/* As três superfícies do ateliê (spec 0028 · design §2 · AC-2). "Mesas
   Táticas" e "Tokens" são o que já existia, agora com endereço próprio;
   "Mapas-Múndi" é o componente IRMÃO — nada disso entra no MapEditor. */
const MAPAS_SUBABAS = [
  { id:'mesas',  rotulo:'Mesas Táticas' },
  { id:'mundi',  rotulo:'Mapas-Múndi'  },
  { id:'tokens', rotulo:'Tokens'       },
];

function MapaScreen({ uid, plan = 'free', onBack }) {
  const [aba, setAba] = useState('mesas');   // 'mesas' | 'mundi' | 'tokens'
  const [mesaAberta, setMesaAberta] = useState(false);
  const [flash, setFlash] = useState("");
  const pill = useSlidingPill(aba);

  const salvarToken = async ({ nome, dataUrl }) => {
    if (!uid) { setFlash('Faça login para salvar na biblioteca. Use "Baixar PNG" enquanto isso.'); return; }
    try {
      await saveAsset(db, uid, { type:'character', name:nome, tags:['construtor'], folder:null, data:dataUrl, w:512, h:512 });
      setFlash(`"${nome}" salvo — abra a mesa tática e use a Biblioteca de assets.`);
    } catch (e) {
      console.error('[construtor] salvar token falhou:', e);
      setFlash('Não foi possível salvar. Use "Baixar PNG" como alternativa.');
    }
  };

  /* O MapEditor monta em `position:fixed; inset:0` — é tela cheia por
     construção (F0 §6). O rail de sub-abas não o comporta: abrir a mesa
     continua sendo um early-return, exatamente como antes. */
  if (mesaAberta) return <MapEditor uid={uid} db={db} onBack={()=>setMesaAberta(false)} />;

  /* Teclado do rail: setas movem e ativam, Home/End vão às pontas. */
  const onRailKeyDown = (e) => {
    if (!["ArrowRight","ArrowLeft","Home","End"].includes(e.key)) return;
    const box = pill.containerRef.current;
    if (!box) return;
    const abas = Array.from(box.querySelectorAll('[role="tab"]'));
    if (!abas.length) return;
    const atual = abas.indexOf(document.activeElement);
    const base = atual === -1 ? abas.findIndex(el => el.getAttribute("aria-selected") === "true") : atual;
    let alvo = base;
    if (e.key === "ArrowRight") alvo = (base + 1) % abas.length;
    else if (e.key === "ArrowLeft") alvo = (base - 1 + abas.length) % abas.length;
    else if (e.key === "Home") alvo = 0;
    else alvo = abas.length - 1;
    e.preventDefault();
    const el = abas[alvo];
    el.focus();
    const id = el.getAttribute('data-aba');
    if (id) setAba(id);
  };

  const Card = ({ icone, titulo, texto, cor, onClick }) => (
    <button onClick={onClick} style={{
      flex:'1 1 260px', maxWidth:340, padding:'28px 24px', borderRadius:14, cursor:'pointer', textAlign:'left',
      background:`linear-gradient(160deg, ${cor}18, transparent)`, border:`1px solid ${cor}44`, transition:'all .18s',
    }}
      onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.borderColor=`${cor}99`; e.currentTarget.style.boxShadow=`0 8px 26px rgba(0,0,0,0.45)`; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.borderColor=`${cor}44`; e.currentTarget.style.boxShadow='none'; }}>
      <div style={{ fontSize:40, marginBottom:12 }}>{icone}</div>
      <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:18, color:cor, marginBottom:8 }}>{titulo}</div>
      <div style={{ fontFamily:"var(--font-body,'Crimson Pro',serif)", fontSize:15, color:'var(--muted2)', lineHeight:1.6 }}>{texto}</div>
    </button>
  );

  return (
    <div className="fade" style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div>
        <div style={{ fontFamily:'Cinzel,serif', fontSize:11, letterSpacing:'0.14em', color:'var(--muted)', textTransform:'uppercase', marginBottom:6 }}>Ateliê do Mestre</div>
        <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:'clamp(20px,2.4vw,26px)', fontWeight:700,
          background:'linear-gradient(135deg,#c9a84c,#e8c96d)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Mapas</h1>
      </div>

      {/* ── Sub-abas (pill deslizante — o padrão da casa, spec 0017 AC-4) ── */}
      <div ref={pill.containerRef} role="tablist" aria-label="Seções de Mapas" onKeyDown={onRailKeyDown}
        style={{ display:'flex', gap:2, borderBottom:'1px solid var(--border)', position:'relative',
          overflowX:'auto', scrollbarWidth:'none', WebkitOverflowScrolling:'touch', flexShrink:0 }}>
        <SlidingTabPill pill={pill.pill} radius={8} background="var(--gold-dim)" underline="var(--gold)"/>
        {MAPAS_SUBABAS.map(t => {
          const on = aba === t.id;
          return (
            <button key={t.id} type="button" role="tab" data-aba={t.id}
              id={`mapas-aba-${t.id}`} aria-selected={on} aria-controls="mapas-painel"
              tabIndex={on ? 0 : -1}
              ref={pill.setItemRef(t.id)} onClick={()=>setAba(t.id)}
              style={{
                position:'relative', zIndex:1, flexShrink:0, minHeight:44, padding:'0 16px',
                border:'none', background:'transparent', cursor:'pointer',
                fontFamily:'Cinzel,serif', fontSize:11.5, letterSpacing:'0.08em', textTransform:'uppercase',
                fontWeight: on ? 600 : 400,
                color: on ? 'var(--gold2, #e8c96d)' : 'rgba(255,255,255,0.46)',
                transition:'color 0.2s',
              }}
              onMouseEnter={e=>{ if(!on) e.currentTarget.style.color='rgba(255,255,255,0.78)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.color = on ? 'var(--gold2, #e8c96d)' : 'rgba(255,255,255,0.46)'; }}>
              {t.rotulo}
            </button>
          );
        })}
      </div>

      {/* ── Painel ── */}
      <div id="mapas-painel" role="tabpanel" aria-labelledby={`mapas-aba-${aba}`}
        style={ aba === 'tokens'
          ? { display:'flex', flexDirection:'column', height:'calc(100vh - 260px)', minHeight:460, gap:12 }
          : { display:'flex', flexDirection:'column', gap:16 } }>

        {aba === 'mesas' && (
          <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
            <Card icone="🗺️" titulo="Mesa Tática" cor="#b030d8" onClick={()=>setMesaAberta(true)}
              texto="Monte o mapa com imagens, tokens, camadas de névoa e grade — tudo sincronizado com a mesa." />
          </div>
        )}

        {aba === 'mundi' && <WorldMapAtelier uid={uid} plan={plan} />}

        {aba === 'tokens' && (
          <>
            <div style={{ flexShrink:0 }}>
              <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:18, color:'#e0c8ff' }}>Construtor de Tokens</div>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1.4, textTransform:'uppercase', color:'var(--muted)' }}>
                Monte o agente camada por camada
              </div>
            </div>
            <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontFamily:'Crimson Pro,serif' }}>Carregando peças…</div>}>
              <TokenBuilder onSalvar={salvarToken} onFechar={()=>setAba('mesas')} />
            </Suspense>
          </>
        )}
      </div>

      {flash && (
        <div role="status" style={{ padding:'10px 16px', borderRadius:8, background:'rgba(106,170,122,0.12)', border:'1px solid rgba(106,170,122,0.35)',
          color:'#8fd3a0', fontFamily:'Crimson Pro,serif', fontSize:15, maxWidth:520 }}>{flash}</div>
      )}
    </div>
  );
}

export default MapaScreen;
