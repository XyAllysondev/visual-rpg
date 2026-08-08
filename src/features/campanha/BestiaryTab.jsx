import { useState, useEffect } from "react";
import * as bestiaryRepo from "../../infrastructure/firestore/bestiaryRepo";
import { clampHp } from "../../domain/creature";
import { rollNotation } from "../../domain/dice";
import { sanitizarHtml } from "../../lib/sanitizarHtml";
import REGRAS_OFICIAIS from "../../data/ordemParanormal/regras-oficiais.json";
import RITUAIS_LIB from "../../data/ordemParanormal/rituais-oficiais.json";
import ITENS_LIB from "../../data/ordemParanormal/itens-oficiais.json";
import MODS_LIB from "../../data/ordemParanormal/modificacoes-oficiais.json";
import TOKENS_LIB from "../../data/ordemParanormal/tokens-oficiais.json";
import TokenFichaFX, { TOKEN_FX } from "./TokenFichaFX";

/* ── BESTIARY TAB ── */
const BESTIARY_SYSTEMS = ['Genérico','Ordem Paranormal','Tormenta 20','D&D 5e'];
const EMPTY_CREATURE   = { name:'', system:'Genérico', hp:'', ac:'', initiative:'', description:'', attacks:'' };
const EMPTY_OP_CREATURE = {
  name:'', system:'Ordem Paranormal',
  imageUrl:'', vd:'', category:'',
  hpMax:'', hpCurrent:'',
  agi:'', atFor:'', atInt:'', pre:'', vig:'',
  defesa:'', deslocamento:'',
  perPercepcao:'', perIniciativa:'', perFortitude:'', perReflexos:'', perVontade:'',
  sentidos:'', elementosSecundarios:'',
  imunidades:'', resBalistico:'', resImpacto:'', resPerfuracao:'',
  vulnerabilidades:'', presencaPerturbadora:'',
  acoes:[], poderes:[], descricaoTexto:'', enigmas:[],
};


// Condições fiéis ao livro base de Ordem Paranormal (spec 0021). Textos verificados contra
// as fontes oficiais/compilações (Guia Rápido de Regras). São de referência (o app não aplica
// as penalidades automaticamente). Perturbado/Enlouquecendo/Pasmo/Debilitado seguem o homebrew
// que o Andre optou por manter.
const OP_CONDICOES = [
  { nome:'Abalado', cor:'#e09050', descricao:'-2 em testes de perícia. Se ficar abalado novamente, fica Apavorado.' },
  { nome:'Agarrado', cor:'#e09050', descricao:'Fica desprevenido e imóvel, sofre -2 em testes de ataque e só pode atacar com armas leves.' },
  { nome:'Alquebrado', cor:'#b030d8', descricao:'O custo em PE das habilidades e rituais aumenta em +1.' },
  { nome:'Apavorado', cor:'#e07070', descricao:'-5 em testes de perícia e deve fugir da fonte do medo. Se não puder fugir, pode agir, mas não pode se aproximar dela voluntariamente.' },
  { nome:'Atordoado', cor:'#e07070', descricao:'Fica desprevenido e não pode fazer ações.' },
  { nome:'Caído', cor:'#e09050', descricao:'Deitado. -5 em ataques corpo a corpo; deslocamento 1,5m. Ataques CaC contra você recebem +5; à distância, -5. Levantar custa metade do deslocamento.' },
  { nome:'Cego', cor:'#e07070', descricao:'Fica desprevenido e lento; não pode fazer testes de Percepção para observar; -5 em perícias de Força/Agilidade. Seus alvos têm camuflagem total.' },
  { nome:'Confuso', cor:'#e09050', descricao:'Age de modo aleatório: role 1d6 no início do turno para determinar o comportamento (fugir, balbuciar, atacar o mais próximo ou agir normalmente).' },
  { nome:'Debilitado', cor:'#e09050', descricao:'Pode realizar apenas 1 ação por turno (padrão OU movimento). [homebrew]' },
  { nome:'Desprevenido', cor:'#e07070', descricao:'Despreparado para reagir. Sofre -5 na Defesa.' },
  { nome:'Enjoado', cor:'#e09050', descricao:'-2 em ataques e testes de perícia.' },
  { nome:'Exausto', cor:'#e09050', descricao:'Deslocamento reduzido à metade. -5 em testes de ataque e de perícia (também conta como Fatigado).' },
  { nome:'Fatigado', cor:'#f0c040', descricao:'-2 em testes de ataque e de perícia.' },
  { nome:'Imóvel', cor:'#e09050', descricao:'Todas as formas de deslocamento são reduzidas a 0m.' },
  { nome:'Inconsciente', cor:'#e07070', descricao:'Fica indefeso e não pode fazer ações. Acordá-lo gasta uma ação padrão.' },
  { nome:'Indefeso', cor:'#e07070', descricao:'É considerado desprevenido e sofre -10 na Defesa; falha automaticamente em Reflexos e pode sofrer golpe de misericórdia.' },
  { nome:'Lento', cor:'#f0c040', descricao:'Deslocamento reduzido à metade (arredonda p/ baixo). Não pode correr nem fazer investida.' },
  { nome:'Machucado', cor:'#f0c040', descricao:'Com metade ou menos dos PV totais. Pré-requisito para certas habilidades; sem penalidade direta.' },
  { nome:'Morrendo', cor:'#e07070', descricao:'PV em 0. Se iniciar 3 turnos morrendo na mesma cena, morre. Encerrado por Medicina DT 20 ou efeito específico.' },
  { nome:'Paralisado', cor:'#e07070', descricao:'Fica imóvel e indefeso; só pode realizar ações puramente mentais.' },
  { nome:'Pasmo', cor:'#e09050', descricao:'Perde a próxima ação padrão. [homebrew]' },
  { nome:'Perturbado', cor:'#b030d8', descricao:'SAN abaixo da metade. Alucinações e percepção distorcida. [homebrew]' },
  { nome:'Petrificado', cor:'#e07070', descricao:'Fica inconsciente e recebe resistência a dano 10.' },
  { nome:'Sangrando', cor:'#e07070', descricao:'No início do turno, faça um teste de Vigor (DT 15): se falhar, perde 1d6 PV e continua sangrando; se passar, remove a condição.' },
  { nome:'Enlouquecendo', cor:'#e07070', descricao:'SAN chegou a 0. Removido da cena; pode se tornar criatura paranormal a critério do mestre. [homebrew]' },
  { nome:'Surdo', cor:'#f0c040', descricao:'Não pode ouvir. Falha automática em testes que dependam de audição.' },
  { nome:'Vulnerável', cor:'#e09050', descricao:'Sofre dano dobrado de um tipo específico (indicado pelo efeito causador).' },
];

/* Extrai o que der do texto da ficha (docx) — tudo opcional, texto manda. */
function parseFichaOP(texto) {
  if (!texto) return { stats: [], sections: [] };
  const grab = (re) => { const m = texto.match(re); return m ? m[1].trim() : null; };
  const stats = [];
  const pv = grab(/(?:\bPV\b|PONTOS DE VIDA)\s*[:\-–]?\s*(\d+)/i);
  const def = grab(/\bDEFESA\b\s*[:\-–]?\s*(\d+)/i);
  const desl = grab(/\bDESLOCAMENTO\b\s*[:\-–]?\s*([0-9]+\s*m?[^\n,;.]{0,18})/i);
  if (pv) stats.push(['PV', pv]); if (def) stats.push(['Defesa', def]); if (desl) stats.push(['Desloc.', desl]);
  ['AGI','FOR','INT','PRE','VIG'].forEach(k => {
    const v = grab(new RegExp(`\\b${k}\\b\\s*[:\\-–]?\\s*(\\d+)`));
    if (v) stats.push([k, v]);
  });
  /* Seções: linha curta em CAIXA-ALTA (ou palavra-chave) vira cabeçalho. */
  const KEYW = /^(AÇÕES|AÇÃO|HABILIDADES|PODERES|ATAQUES?|ESTRATAGEMAS?|DESCRIÇÃO|EQUIPAMENTOS?|RITUAIS|PERÍCIAS|VARIAÇÕES|TESOURO|SANIDADE|PRESENÇA PERTURBADORA|ESTATÍSTICAS)\b/i;
  const sections = [{ title: null, lines: [] }];
  texto.split(/\n/).forEach(raw => {
    const l = raw.trim();
    if (!l) return;
    const isHead = (l.length <= 48 && /[A-ZÀ-Ú]/.test(l) && l === l.toUpperCase() && !/\d{2,}/.test(l)) || KEYW.test(l);
    if (isHead && l.length <= 60) sections.push({ title: l.replace(/[:.]$/, ''), lines: [] });
    else sections[sections.length - 1].lines.push(l);
  });
  return { stats, sections: sections.filter(s => s.title || s.lines.length) };
}

function BestiaryTab({ campaignId }) {
  const [creatures,    setCreatures]   = useState([]);
  const [search,       setSearch]      = useState('');
  const [filterSys,    setFilterSys]   = useState('Todos');
  const [modal,        setModal]       = useState(null);
  const [form,         setForm]        = useState(EMPTY_CREATURE);
  const [saving,       setSaving]      = useState(false);
  const [viewCreature, setViewCreature]= useState(null);
  const [rollResult,   setRollResult]  = useState(null);
  const [opTab,        setOpTab]       = useState('STATUS');
  const [opCombTab,    setOpCombTab]   = useState('AÇÕES');
  const [opExpAcao,    setOpExpAcao]   = useState(null);
  const [bestedTab,    setBestedTab]   = useState('criaturas');
  const [ritualElem,   setRitualElem]  = useState('Todos');
  const [ritualCirc,   setRitualCirc]  = useState(0);
  const [ritualSearch, setRitualSearch]= useState('');
  const [ritualExp,    setRitualExp]   = useState(null);
  const [armaFilter,   setArmaFilter]  = useState('Todos');
  /* Biblioteca de tokens oficiais (importados dos packs de criaturas) */
  const [tokenElem,    setTokenElem]   = useState('Todos');
  const [tokenSearch,  setTokenSearch] = useState('');
  const [tokenView,    setTokenView]   = useState(null);   // criatura da biblioteca aberta
  const [tokenVariant, setTokenVariant]= useState(0);      // variante de token selecionada
  const [tokenTab,     setTokenTab]    = useState('tokens'); // 'tokens' | 'moldes' (variantes MOLDE separadas)

  const SYS_COLORS = { 'Genérico':'#8888aa', 'Ordem Paranormal':'#b030d8', 'Tormenta 20':'#d4621e', 'D&D 5e':'#4a6fa5' };
  const OPC = '#b030d8';
  const isOP = sys => sys === 'Ordem Paranormal';

  useEffect(() => {
    const unsub = bestiaryRepo.watchByCampaign(campaignId, setCreatures);
    return () => unsub();
  }, [campaignId]);

  function openNew() { setForm(EMPTY_CREATURE); setModal('new'); }

  /* Cria uma criatura a partir da biblioteca de tokens oficiais: pré-preenche
     nome, VD, token escolhido (caminho estático leve — a imagem vive em
     /public/bestiary-tokens, o Firestore guarda só a URL) e o texto da ficha. */
  function addFromToken(tk, vi = 0) {
    setForm({
      ...EMPTY_OP_CREATURE,
      name: tk.nome,
      vd: tk.vd || '',
      imageUrl: (tk.tokens[vi] || tk.tokens[0]).src,
      descricaoTexto: tk.ficha || '',
    });
    setTokenView(null);
    setModal('new');
  }
  function openEdit(c) {
    if (isOP(c.system)) {
      setForm({
        name:c.name||'', system:'Ordem Paranormal',
        imageUrl:c.imageUrl||'', vd:c.vd||'', category:c.category||'',
        hpMax:c.hpMax||'', hpCurrent:c.hpCurrent||'',
        agi:c.agi||'', atFor:c.atFor||'', atInt:c.atInt||'', pre:c.pre||'', vig:c.vig||'',
        defesa:c.defesa||'', deslocamento:c.deslocamento||'',
        perPercepcao:c.perPercepcao||'', perIniciativa:c.perIniciativa||'',
        perFortitude:c.perFortitude||'', perReflexos:c.perReflexos||'',
        perVontade:c.perVontade||'',
        sentidos:c.sentidos||'', elementosSecundarios:c.elementosSecundarios||'',
        imunidades:c.imunidades||'', resBalistico:c.resBalistico||'',
        resImpacto:c.resImpacto||'', resPerfuracao:c.resPerfuracao||'',
        vulnerabilidades:c.vulnerabilidades||'', presencaPerturbadora:c.presencaPerturbadora||'',
        acoes:c.acoes||[], poderes:c.poderes||[], descricaoTexto:c.descricaoTexto||'', enigmas:c.enigmas||[],
      });
    } else {
      setForm({ name:c.name||'', system:c.system||'Genérico', hp:c.hp||'', ac:c.ac||'', initiative:c.initiative||'', description:c.description||'', attacks:c.attacks||'' });
    }
    setModal(c);
  }

  async function saveCreature() {
    if (!form.name.trim()) return;
    setSaving(true);
    const data = { ...form, name: form.name.trim() };
    // O repo é `silent` e nunca rejeita, então o booleano é o que decide fechar o modal.
    // Sem ele, uma falha de escrita fecharia o formulário e o mestre perderia o que digitou
    // — o legado mantinha o modal aberto porque o `setModal(null)` vivia dentro do `try`.
    const ok = modal === 'new'
      ? await bestiaryRepo.create(campaignId, data)
      : await bestiaryRepo.update(campaignId, modal.id, data);
    if (ok) setModal(null);
    setSaving(false);
  }

  async function deleteCreature(id) {
    if (!window.confirm('Remover esta criatura do bestiário?')) return;
    await bestiaryRepo.remove(campaignId, id);
  }

  async function updateHP(creature, delta) {
    // O teto/piso de PV é regra de domínio (`clampHp`), não do banco.
    const next = clampHp(creature, delta);
    await bestiaryRepo.setHp(campaignId, creature.id, next);
    setViewCreature(v => v && v.id === creature.id ? { ...v, hpCurrent: next } : v);
  }

  // Bestiário: dialeto permissivo com contagem obrigatória ("d6" nunca foi aceito aqui).
  // A UI consome { total, rolls, notation } — adaptado aqui, não no domínio.
  function doRoll(notation) {
    const r = rollNotation(notation, { requireCount: true });
    if (r) setRollResult({ total: r.total, rolls: r.rolls, notation });
  }

  const filtered = creatures.filter(c =>
    (filterSys === 'Todos' || c.system === filterSys) &&
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const sL = { fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif', letterSpacing:1, textTransform:'uppercase', display:'block', marginBottom:3 };
  const sI = { background:'var(--card2)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)', padding:'7px 10px', fontFamily:'Cinzel,serif', fontSize:12, outline:'none', width:'100%', boxSizing:'border-box' };
  const sT = { ...sI, fontFamily:'Crimson Pro,serif', fontSize:13, resize:'vertical', minHeight:52 };

  function fld(label, key, opts={}) {
    const val = form[key] !== undefined ? form[key] : '';
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
        <span style={sL}>{label}</span>
        {opts.textarea
          ? <textarea value={val} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} rows={opts.rows||3} style={sT}/>
          : <input value={val} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
              type={opts.type||'text'} placeholder={opts.placeholder||''}
              style={{ ...sI, ...(opts.mono ? {fontFamily:'monospace',fontSize:13} : {}) }}/>
        }
      </div>
    );
  }

  // OP action helpers
  function opAddAcao()       { setForm(p=>({...p,acoes:[...(p.acoes||[]),{tipo:'PADRÃO',nome:'',conteudo:'texto',descricao:'',ataques:[]}]})); }
  function opRemAcao(i)      { setForm(p=>({...p,acoes:(p.acoes||[]).filter((_,j)=>j!==i)})); }
  function opSetAcao(i,k,v)  { setForm(p=>{ const a=[...(p.acoes||[])]; a[i]={...a[i],[k]:v}; return {...p,acoes:a}; }); }
  function opAddAtk(ai)      { setForm(p=>{ const a=[...(p.acoes||[])]; a[ai]={...a[ai],ataques:[...(a[ai].ataques||[]),{arma:'',alcance:'Corpo a corpo',hits:'',teste:'',dano:'',critico:''}]}; return {...p,acoes:a}; }); }
  function opRemAtk(ai,ji)   { setForm(p=>{ const a=[...(p.acoes||[])]; a[ai]={...a[ai],ataques:(a[ai].ataques||[]).filter((_,j)=>j!==ji)}; return {...p,acoes:a}; }); }
  function opSetAtk(ai,ji,k,v){ setForm(p=>{ const a=[...(p.acoes||[])]; const atk=[...a[ai].ataques]; atk[ji]={...atk[ji],[k]:v}; a[ai]={...a[ai],ataques:atk}; return {...p,acoes:a}; }); }
  function opAddPod()        { setForm(p=>({...p,poderes:[...(p.poderes||[]),{nome:'',desc:''}]})); }
  function opRemPod(i)       { setForm(p=>({...p,poderes:(p.poderes||[]).filter((_,j)=>j!==i)})); }
  function opSetPod(i,k,v)   { setForm(p=>{ const pd=[...(p.poderes||[])]; pd[i]={...pd[i],[k]:v}; return {...p,poderes:pd}; }); }
  function opAddEni()        { setForm(p=>({...p,enigmas:[...(p.enigmas||[]),{titulo:'',texto:''}]})); }
  function opRemEni(i)       { setForm(p=>({...p,enigmas:(p.enigmas||[]).filter((_,j)=>j!==i)})); }
  function opSetEni(i,k,v)   { setForm(p=>{ const en=[...(p.enigmas||[])]; en[i]={...en[i],[k]:v}; return {...p,enigmas:en}; }); }

  const DiceBtn = ({n}) => (
    <button onClick={()=>doRoll(n)} title={`Rolar ${n}`}
      style={{ background:'transparent', border:'none', cursor:'pointer', padding:'2px 3px', color:OPC, display:'inline-flex', alignItems:'center', lineHeight:1 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
    </button>
  );
  const SecH  = ({children}) => <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:14, color:'var(--text)', margin:'14px 0 7px' }}>{children}</div>;
  const InfoL = ({children}) => <div style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', marginBottom:3 }}>{children}</div>;
  const SecF  = ({children}) => <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:2, textTransform:'uppercase', color:OPC, borderBottom:`1px solid rgba(176,48,216,0.3)`, paddingBottom:5, marginBottom:8, marginTop:6 }}>{children}</div>;

  const vc = viewCreature;
  const vcHpMax = vc ? parseInt(vc.hpMax)||0 : 0;
  const vcHpCur = vc ? parseInt(vc.hpCurrent != null ? vc.hpCurrent : vc.hpMax)||vcHpMax : 0;
  const vcHpPct = vcHpMax > 0 ? vcHpCur/vcHpMax : 1;
  const OP_PERICIAS = [['PERCEPÇÃO','perPercepcao'],['INICIATIVA','perIniciativa'],['FORTITUDE','perFortitude'],['REFLEXOS','perReflexos'],['VONTADE','perVontade']];
  const OP_ATTRS    = [['AGI','agi'],['FOR','atFor'],['INT','atInt'],['PRE','pre'],['VIG','vig']];

  const ELEM_COLORS = { Conhecimento:'#f0c040', Energia:'#4080e0', Morte:'#808080', Sangue:'#e04040', Medo:'#b030d8' };
  /* Biblioteca consome os MESMOS dados oficiais da ficha (spec 0025 — fonte única). */
  const CUSTO_CIRCULO = { 1:1, 2:3, 3:6, 4:10 };
  const capElem = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : s;
  const filteredRituais = RITUAIS_LIB.filter(r=>
    (ritualElem==='Todos'||capElem(r.elemento)===ritualElem) &&
    (ritualCirc===0||r.circulo===ritualCirc) &&
    (!ritualSearch||r.nome.toLowerCase().includes(ritualSearch.toLowerCase())||(r.descricao||'').toLowerCase().includes(ritualSearch.toLowerCase())||(r.efeito||'').toLowerCase().includes(ritualSearch.toLowerCase()))
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>

      {/* Roll result overlay */}
      {rollResult && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200 }}
          onClick={()=>setRollResult(null)}>
          <div style={{ background:'var(--card)', border:`1px solid ${OPC}55`, borderRadius:12, padding:'28px 36px', textAlign:'center', minWidth:200 }}>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:2, color:'var(--muted)', marginBottom:6 }}>RESULTADO</div>
            <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:52, color:OPC, lineHeight:1 }}>{rollResult.total}</div>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:11, color:'var(--muted)', marginTop:5 }}>{rollResult.notation}</div>
            <div style={{ fontFamily:'Crimson Pro,serif', fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:5 }}>[{rollResult.rolls.join(', ')}]</div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:12 }}>clique para fechar</div>
          </div>
        </div>
      )}

      {/* OP Sheet View Modal */}
      {vc && isOP(vc.system) && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, width:'100%', maxWidth:500, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* Header */}
            <div style={{ position:'relative', height: vc.imageUrl ? 130 : 70, flexShrink:0 }}>
              {vc.imageUrl && <img src={vc.imageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>}
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0.85) 100%)' }}/>
              <div style={{ position:'absolute', top:10, left:12 }}>
                <button onClick={()=>{ setViewCreature(null); openEdit(vc); }}
                  style={{ background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:5, color:'rgba(255,255,255,0.75)', cursor:'pointer', padding:'3px 9px', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>✏️ Editar</button>
              </div>
              <button onClick={()=>{ setViewCreature(null); setOpTab('STATUS'); setOpCombTab('AÇÕES'); setOpExpAcao(null); }}
                style={{ position:'absolute', top:10, right:12, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, color:'rgba(255,255,255,0.8)', cursor:'pointer', padding:'4px 10px', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1 }}>✕</button>
              <div style={{ position:'absolute', bottom:10, left:14 }}>
                <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:17, color:'#fff', textShadow:'0 1px 6px rgba(0,0,0,0.9)', lineHeight:1.2 }}>{vc.name}</div>
                {(vc.vd||vc.category) && <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, color:'rgba(255,255,255,0.7)', marginTop:2 }}>
                  {vc.vd && `VD: ${vc.vd}`}{vc.vd&&vc.category&&' · '}{vc.category}
                </div>}
              </div>
            </div>
            {/* HP Bar */}
            {vcHpMax > 0 && (
              <div style={{ background:'rgba(0,0,0,0.4)', padding:'8px 14px', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', background:'var(--card)', borderRadius:8, overflow:'hidden' }}>
                  <button onClick={()=>updateHP(vc,-10)} style={{ padding:'8px 11px', background:'rgba(255,255,255,0.06)', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14, fontFamily:'monospace' }}>«</button>
                  <button onClick={()=>updateHP(vc,-1)}  style={{ padding:'8px 8px',  background:'rgba(255,255,255,0.04)', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14, fontFamily:'monospace' }}>‹</button>
                  <div style={{ flex:1, position:'relative', textAlign:'center', padding:'8px 0' }}>
                    <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${vcHpPct*100}%`, background:'linear-gradient(90deg,#8b1c1c,#b02020)', opacity:0.7, transition:'width .2s' }}/>
                    <span style={{ position:'relative', fontFamily:'Cinzel,serif', fontSize:15, letterSpacing:2, color:'#fff', fontWeight:600 }}>{vcHpCur} / {vcHpMax}</span>
                  </div>
                  <button onClick={()=>updateHP(vc,1)}   style={{ padding:'8px 8px',  background:'rgba(255,255,255,0.04)', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14, fontFamily:'monospace' }}>›</button>
                  <button onClick={()=>updateHP(vc,10)}  style={{ padding:'8px 11px', background:'rgba(255,255,255,0.06)', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontSize:14, fontFamily:'monospace' }}>»</button>
                </div>
              </div>
            )}
            {/* Sheet Tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
              {['STATUS','COMBATE','DESCRIÇÃO'].map(t=>(
                <button key={t} onClick={()=>setOpTab(t)}
                  style={{ flex:1, padding:'10px 4px', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, border:'none', background:'transparent', cursor:'pointer', color:opTab===t?'#fff':'var(--muted)', borderBottom:opTab===t?`2px solid ${OPC}`:'2px solid transparent', transition:'color .15s' }}>
                  {t}
                </button>
              ))}
            </div>
            {/* Content */}
            <div style={{ flex:1, overflowY:'auto', padding:'0 16px 16px' }}>
              {opTab==='STATUS' && (
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, padding:'14px 0 10px' }}>
                    {OP_ATTRS.map(([l,k])=> vc[k] ? (
                      <div key={k} style={{ textAlign:'center' }}>
                        <div style={{ fontSize:8, color:'var(--muted)', fontFamily:'Cinzel,serif', letterSpacing:1, textTransform:'uppercase', marginBottom:3 }}>{l}</div>
                        <div style={{ fontFamily:'Cinzel,serif', fontSize:22, color:'var(--text)', fontWeight:700 }}>{vc[k]}</div>
                      </div>
                    ) : null)}
                  </div>
                  {(vc.defesa||vc.deslocamento) && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>
                      {vc.defesa && <div style={{ textAlign:'center' }}><div style={sL}>DEFESA</div><div style={{ fontFamily:'Cinzel,serif', fontSize:26, color:'var(--text)', fontWeight:700 }}>{vc.defesa}</div></div>}
                      {vc.deslocamento && <div style={{ textAlign:'center' }}><div style={sL}>DESLOCAMENTO</div><div style={{ fontFamily:'Cinzel,serif', fontSize:17, color:'var(--text)', fontWeight:600, marginTop:4 }}>{vc.deslocamento}</div></div>}
                    </div>
                  )}
                  {OP_PERICIAS.some(([,k])=>vc[k]) && (
                    <div>
                      <SecH>Perícias</SecH>
                      {OP_PERICIAS.filter(([,k])=>vc[k]).map(([l,k])=>(
                        <div key={k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'rgba(255,255,255,0.04)', borderRadius:6, marginBottom:4 }}>
                          <span style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, textTransform:'uppercase', color:'rgba(255,255,255,0.7)' }}>{l}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                            <span style={{ fontFamily:'Cinzel,serif', fontSize:13, color:'var(--text)' }}>{vc[k]}</span>
                            <DiceBtn n={vc[k]}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {vc.sentidos && <div><SecH>Sentidos</SecH>{vc.sentidos.split('\n').map((l,i)=>l.trim()&&<InfoL key={i}>{l}</InfoL>)}</div>}
                  {vc.elementosSecundarios && <div><SecH>Elementos secundários</SecH>{vc.elementosSecundarios.split('\n').map((l,i)=>l.trim()&&<InfoL key={i}>{l}</InfoL>)}</div>}
                  {vc.imunidades && <div><SecH>Imunidades</SecH>{vc.imunidades.split('\n').map((l,i)=>l.trim()&&<InfoL key={i}>{l}</InfoL>)}</div>}
                  {(vc.resBalistico||vc.resImpacto||vc.resPerfuracao) && (
                    <div><SecH>Resistências</SecH>
                      {vc.resBalistico&&<InfoL>BALÍSTICO: {vc.resBalistico}</InfoL>}
                      {vc.resImpacto&&<InfoL>IMPACTO: {vc.resImpacto}</InfoL>}
                      {vc.resPerfuracao&&<InfoL>PERFURAÇÃO: {vc.resPerfuracao}</InfoL>}
                    </div>
                  )}
                  {vc.vulnerabilidades && <div><SecH>Vulnerabilidades</SecH>{vc.vulnerabilidades.split('\n').map((l,i)=>l.trim()&&<InfoL key={i}>{l}</InfoL>)}</div>}
                </div>
              )}
              {opTab==='COMBATE' && (
                <div style={{ paddingTop:12 }}>
                  {vc.presencaPerturbadora && (
                    <div style={{ marginBottom:14 }}>
                      <div style={sL}>PRESENÇA PERTURBADORA</div>
                      <div style={{ fontFamily:'Crimson Pro,serif', fontSize:14, color:'var(--text)' }}>{vc.presencaPerturbadora}</div>
                    </div>
                  )}
                  <div style={{ display:'flex', gap:14, marginBottom:14 }}>
                    {['AÇÕES','PODERES'].map(ct=>(
                      <button key={ct} onClick={()=>setOpCombTab(ct)}
                        style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, border:'none', background:'transparent', cursor:'pointer', color:opCombTab===ct?OPC:'var(--muted)', borderBottom:opCombTab===ct?`1px solid ${OPC}`:'1px solid transparent', padding:'2px 2px 4px' }}>
                        {ct}
                      </button>
                    ))}
                  </div>
                  {opCombTab==='AÇÕES' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {(vc.acoes||[]).length===0 && <div style={{ color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:14, padding:16, textAlign:'center' }}>Nenhuma ação registrada.</div>}
                      {(vc.acoes||[]).map((acao,i)=>{
                        const exp = opExpAcao===i;
                        return (
                          <div key={i} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer' }} onClick={()=>setOpExpAcao(exp?null:i)}>
                              <span style={{ fontSize:13, color:OPC }}>{exp?'∧':'∨'}</span>
                              <span style={{ fontFamily:'Cinzel,serif', fontSize:12, color:'var(--text)', flex:1 }}>
                                <span style={{ color:'rgba(255,255,255,0.45)' }}>{acao.tipo}</span> - {acao.nome}
                              </span>
                            </div>
                            {exp && (
                              <div style={{ padding:'0 14px 12px', borderTop:'1px solid var(--border)' }}>
                                {acao.conteudo==='texto' ? (
                                  <div style={{ fontFamily:'Crimson Pro,serif', fontSize:14, color:'var(--text)', lineHeight:1.7, paddingTop:10 }}>{acao.descricao}</div>
                                ) : (
                                  <div style={{ paddingTop:10, display:'flex', flexDirection:'column', gap:12 }}>
                                    {(acao.ataques||[]).map((atk,j)=>(
                                      <div key={j} style={{ paddingBottom:j<(acao.ataques.length-1)?12:0, borderBottom:j<(acao.ataques.length-1)?'1px solid rgba(255,255,255,0.06)':'none' }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                                          <span style={{ fontFamily:'Cinzel,serif', fontSize:11, color:'var(--text)', textTransform:'uppercase', letterSpacing:0.5 }}>{atk.arma}</span>
                                          {atk.alcance&&<span style={{ fontFamily:'Cinzel,serif', fontSize:9, color:'var(--muted)', letterSpacing:1 }}>{atk.alcance}</span>}
                                          {atk.hits&&<span style={{ fontFamily:'Cinzel,serif', fontSize:9, color:'var(--muted)' }}>{atk.hits}</span>}
                                          {atk.teste&&<DiceBtn n={atk.teste}/>}
                                        </div>
                                        {atk.teste&&<div style={{ fontFamily:'Cinzel,serif', fontSize:10, color:OPC, marginBottom:2 }}>Teste: {atk.teste}</div>}
                                        {atk.dano&&<div>
                                          <div style={{ fontFamily:'Cinzel,serif', fontSize:9, color:OPC, letterSpacing:1 }}>Dano</div>
                                          <div style={{ fontFamily:'Crimson Pro,serif', fontSize:14, color:'var(--text)' }}>{atk.dano}</div>
                                        </div>}
                                        {atk.critico&&<div style={{ fontFamily:'Cinzel,serif', fontSize:10, color:OPC }}>Crítico: {atk.critico}</div>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {opCombTab==='PODERES' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {(vc.poderes||[]).length===0&&<div style={{ color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:14, padding:16, textAlign:'center' }}>Nenhum poder registrado.</div>}
                      {(vc.poderes||[]).map((p,i)=>(
                        <div key={i} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px' }}>
                          {p.nome&&<div style={{ fontFamily:'Cinzel,serif', fontSize:12, color:'var(--text)', marginBottom:4 }}>{p.nome}</div>}
                          {p.desc&&<div style={{ fontFamily:'Crimson Pro,serif', fontSize:14, color:'rgba(255,255,255,0.8)', lineHeight:1.6 }}>{p.desc}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {opTab==='DESCRIÇÃO' && (
                <div style={{ paddingTop:12 }}>
                  {vc.imageUrl&&<img src={vc.imageUrl} alt={vc.name} style={{ width:'100%', borderRadius:8, marginBottom:16, objectFit:'cover', maxHeight:280 }}/>}
                  {vc.descricaoTexto&&<div style={{ fontFamily:'Crimson Pro,serif', fontSize:15, color:'var(--text)', lineHeight:1.8, textAlign:'justify', marginBottom:16, whiteSpace:'pre-wrap' }}>{vc.descricaoTexto}</div>}
                  {(vc.enigmas||[]).map((e,i)=>(
                    <div key={i} style={{ marginBottom:16 }}>
                      {e.titulo&&<div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:14, color:'var(--text)', marginBottom:6, borderBottom:'1px solid var(--border)', paddingBottom:6 }}>{e.titulo}</div>}
                      {e.texto&&<div style={{ fontFamily:'Crimson Pro,serif', fontSize:15, color:'var(--text)', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{e.texto}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {[['criaturas','Criaturas'],['tokens','Tokens'],['rituais','Rituais'],['condicoes','Condições'],['armas','Armas'],['regras','Regras']].map(([k,l])=>(
          <button key={k} onClick={()=>setBestedTab(k)}
            style={{ flex:1, padding:'9px 4px', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, border:'none', background:'transparent', cursor:'pointer', color:bestedTab===k?'#fff':'var(--muted)', borderBottom:bestedTab===k?`2px solid ${OPC}`:'2px solid transparent', textTransform:'uppercase', transition:'color .15s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* CRIATURAS */}
      {bestedTab==='criaturas' && (<>
        <div style={{ display:'flex', gap:8, padding:'8px 4px', alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar criatura…"
            style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'6px 12px', fontFamily:'Crimson Pro,serif', fontSize:14, outline:'none', flex:1, minWidth:140 }}/>
          <select value={filterSys} onChange={e=>setFilterSys(e.target.value)}
            style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', padding:'6px 10px', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, outline:'none', cursor:'pointer' }}>
            <option value="Todos">Todos</option>
            {[...new Set(creatures.map(c=>c.system).filter(Boolean))].map(s=><option key={s}>{s}</option>)}
          </select>
          <button onClick={openNew}
            style={{ padding:'7px 16px', borderRadius:6, border:`1px solid rgba(176,48,216,0.5)`, background:'rgba(176,48,216,0.15)', color:'#e0c8ff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, whiteSpace:'nowrap' }}>
            + Adicionar Criatura
          </button>
        </div>
        <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:6, paddingRight:2 }}>
          {filtered.length===0 && (
            <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:15 }}>
              {creatures.length===0 ? 'Nenhuma criatura no bestiário. Clique em "+ Adicionar Criatura" para começar.' : 'Nenhuma criatura encontrada.'}
            </div>
          )}
          {filtered.map(c=>{
            const col = SYS_COLORS[c.system]||'#8888aa';
            const hpM = parseInt(c.hpMax)||0;
            const hpC = parseInt(c.hpCurrent != null ? c.hpCurrent : c.hpMax)||hpM;
            const hpColor = hpC<=hpM*0.25?'#e07070':hpC<=hpM*0.5?'#e0a050':'#70c870';
            return (
              <div key={c.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', flexShrink:0, transition:'border-color .15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(176,48,216,0.3)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', cursor: isOP(c.system)?'pointer':'default' }}
                  onClick={()=>{ if(isOP(c.system)){ setOpTab('STATUS'); setOpCombTab('AÇÕES'); setOpExpAcao(null); setViewCreature(c); } }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:col, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'Cinzel,serif', fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                    <div style={{ display:'flex', gap:8, marginTop:2, alignItems:'center', flexWrap:'wrap' }}>
                      <span style={{ fontSize:9, color:col, fontFamily:'Cinzel,serif', letterSpacing:1 }}>{c.system}</span>
                      {isOP(c.system) ? (
                        <>
                          {c.vd&&<span style={{ fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>VD {c.vd}</span>}
                          {c.category&&<span style={{ fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>{c.category}</span>}
                          {hpM>0&&<span style={{ fontSize:9, color:hpColor, fontFamily:'Cinzel,serif' }}>HP {hpC}/{hpM}</span>}
                        </>
                      ) : (
                        <>
                          {c.hp&&<span style={{ fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>HP {c.hp}</span>}
                          {c.ac&&<span style={{ fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>CA {c.ac}</span>}
                          {c.initiative&&<span style={{ fontSize:9, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>Init {c.initiative}</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={e=>{e.stopPropagation();openEdit(c);}}
                      style={{ padding:'3px 8px', borderRadius:4, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:10 }}>✏️</button>
                    <button onClick={e=>{e.stopPropagation();deleteCreature(c.id);}}
                      style={{ padding:'3px 8px', borderRadius:4, border:'1px solid rgba(139,32,32,0.3)', background:'transparent', color:'#e07070', cursor:'pointer', fontSize:10 }}>🗑</button>
                  </div>
                  {isOP(c.system)&&<span style={{ fontSize:9, color:'var(--muted)', letterSpacing:1 }}>ver ▶</span>}
                </div>
              </div>
            );
          })}
        </div>
      </>)}

      {/* TOKENS OFICIAIS — biblioteca importada dos packs de criaturas */}
      {bestedTab==='tokens' && (()=>{
        const filteredTokens = TOKENS_LIB.filter(tk=>
          (tokenElem==='Todos'||tk.elemento===tokenElem) &&
          (!tokenSearch||tk.nome.toLowerCase().includes(tokenSearch.toLowerCase()))
        );
        const elemCol = (el)=>ELEM_COLORS[el]||'#c9a84c';
        return (<>
        <div style={{ padding:'8px 4px', display:'flex', gap:6, flexShrink:0, flexWrap:'wrap', alignItems:'center' }}>
          <input value={tokenSearch} onChange={e=>setTokenSearch(e.target.value)} placeholder="Buscar criatura…"
            style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'6px 12px', fontFamily:'Crimson Pro,serif', fontSize:14, outline:'none', flex:1, minWidth:140 }}/>
          <select value={tokenElem} onChange={e=>setTokenElem(e.target.value)}
            style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', padding:'6px 10px', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1, outline:'none', cursor:'pointer' }}>
            <option value="Todos">Todos Elementos</option>
            {['Conhecimento','Energia','Medo','Morte','Sangue','Extras'].map(e=><option key={e}>{e}</option>)}
          </select>
          <span style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, color:'var(--muted)' }}>{filteredTokens.length} criaturas</span>
        </div>
        <div style={{ overflowY:'auto', flex:1, paddingRight:2 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8 }}>
            {filteredTokens.map(tk=>(
              <button key={tk.id} onClick={()=>{ setTokenVariant(0); setTokenTab('tokens'); setTokenView(tk); }}
                style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:0, cursor:'pointer', overflow:'hidden', textAlign:'left', transition:'border-color .15s, transform .15s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=elemCol(tk.elemento)+'70';e.currentTarget.style.transform='translateY(-2px)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';}}>
                <div style={{ aspectRatio:'1', background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                  <img src={tk.tokens[0].src} alt={tk.nome} loading="lazy" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }}/>
                </div>
                <div style={{ padding:'8px 10px' }}>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:11.5, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tk.nome}</div>
                  <div style={{ display:'flex', gap:6, marginTop:4, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:8.5, color:elemCol(tk.elemento), fontFamily:'Cinzel,serif', letterSpacing:1, textTransform:'uppercase' }}>{tk.elemento}</span>
                    {tk.vd && <span style={{ fontSize:8.5, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>VD {tk.vd}</span>}
                    {tk.tokens.length>1 && <span style={{ fontSize:8.5, color:'var(--muted)', fontFamily:'Cinzel,serif' }}>{tk.tokens.length} tokens</span>}
                    {tk.ficha && (tk.homebrew
                      ? <span title="Ficha não-oficial, criada pelo Nexus" style={{ fontSize:8.5, color:'#c9a84c', fontFamily:'Cinzel,serif' }}>ficha ◆</span>
                      : <span title="Ficha do pack oficial" style={{ fontSize:8.5, color:'#70c870', fontFamily:'Cinzel,serif' }}>ficha ✓</span>)}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {filteredTokens.length===0 && (
            <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:15 }}>Nenhuma criatura encontrada.</div>
          )}
        </div>

        {/* Ficha-dossiê da criatura da biblioteca — tema animado por elemento */}
        {tokenView && (()=>{
          const fx = TOKEN_FX[tokenView.elemento] || TOKEN_FX.Extras;
          const parsed = parseFichaOP(tokenView.ficha);
          const curTok = tokenView.tokens[tokenVariant] || tokenView.tokens[0];
          /* partículas determinísticas por índice (posição/duração/atraso estáveis) */
          const parts = Array.from({length:14},(_,i)=>({
            left:(i*37+11)%94, dur:5.5+(i*1.7)%4.5, delay:(i*0.9)%6,
            size:9+(i*5)%10, glyph:fx.glyphs[i%fx.glyphs.length], drift:((i%2?1:-1)*(6+(i*3)%14)),
          }));
          return (
          <div style={{ position:'fixed', inset:0, background:`radial-gradient(80% 80% at 50% 50%, color-mix(in srgb, ${fx.c} 7%, rgba(0,0,0,0.88)), rgba(0,0,0,0.92))`, display:'flex', alignItems:'center', justifyContent:'center', zIndex:1150, padding:16 }}
            onClick={()=>setTokenView(null)}>
            <TokenFichaFX/>
            <div onClick={e=>e.stopPropagation()} className="fade"
              style={{ '--fxc':fx.c, background:'#0c0a14', border:`1px solid color-mix(in srgb, ${fx.c} 40%, transparent)`,
                borderRadius:14, width:'100%', maxWidth:560, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden',
                boxShadow:`0 24px 90px rgba(0,0,0,0.7), 0 0 40px color-mix(in srgb, ${fx.c} 18%, transparent)` }}>

              {/* HERO animado */}
              <div className={`tokfx-hero${fx.mode==='fall'?' tokfx-fall':''}${fx.beat?' tokfx-beat':''}`}>
                {fx.fog && <>
                  <div className="tokfx-fog" style={{ left:'-10%', bottom:'-18%' }}/>
                  <div className="tokfx-fog" style={{ right:'-10%', bottom:'-8%', animationDelay:'-4.5s' }}/>
                </>}
                {fx.flicker && <div className="tokfx-flick"/>}
                <div className="tokfx-shimmer"/>
                {parts.map((p,i)=>(
                  <span key={i} className="tokfx-p" aria-hidden="true"
                    style={{ left:`${p.left}%`, fontSize:p.size, '--dur':`${p.dur}s`, '--delay':`${p.delay}s`, '--drift':`${p.drift}px` }}>
                    {p.glyph}
                  </span>
                ))}
                <img className="tokfx-img" src={curTok.src} alt={tokenView.nome}/>
                <button onClick={()=>setTokenView(null)} aria-label="Fechar"
                  style={{ position:'absolute', top:10, right:12, zIndex:3, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:7, color:'rgba(255,255,255,0.85)', cursor:'pointer', padding:'5px 11px', fontFamily:'Cinzel,serif', fontSize:10, backdropFilter:'blur(4px)' }}>✕</button>
                {/* nome sobre o hero */}
                <div style={{ position:'absolute', left:0, right:0, bottom:0, padding:'26px 18px 12px', background:'linear-gradient(to top, rgba(6,4,10,0.92), transparent)', zIndex:2 }}>
                  <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:'clamp(17px,3vw,23px)', color:'#fff', lineHeight:1.15,
                    textShadow:`0 0 22px color-mix(in srgb, ${fx.c} 70%, transparent), 0 2px 8px rgba(0,0,0,0.9)` }}>{tokenView.nome}</div>
                  <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                    <span style={{ fontFamily:'Cinzel,serif', fontSize:8.5, letterSpacing:1.4, textTransform:'uppercase', color:fx.c,
                      padding:'3px 9px', borderRadius:20, background:'rgba(0,0,0,0.5)', border:`1px solid color-mix(in srgb, ${fx.c} 45%, transparent)` }}>
                      ◈ {tokenView.elemento}
                    </span>
                    {tokenView.vd && <span style={{ fontFamily:'Cinzel,serif', fontSize:8.5, letterSpacing:1.4, textTransform:'uppercase', color:'rgba(255,255,255,0.8)', padding:'3px 9px', borderRadius:20, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.16)' }}>VD {tokenView.vd}</span>}
                    {tokenView.homebrew && <span title="Ficha não-oficial, criada pelo Nexus" style={{ fontFamily:'Cinzel,serif', fontSize:8.5, letterSpacing:1.4, textTransform:'uppercase', color:'#c9a84c', padding:'3px 9px', borderRadius:20, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(201,168,76,0.4)' }}>◆ Nexus</span>}
                    <span style={{ fontFamily:'Cinzel,serif', fontSize:8.5, letterSpacing:1.4, textTransform:'uppercase', color:'rgba(255,255,255,0.55)', padding:'3px 9px', borderRadius:20, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.1)' }}>{curTok.label}</span>
                  </div>
                </div>
              </div>

              <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', scrollbarWidth:'thin' }}>
                {/* stats extraídos da ficha */}
                {parsed.stats.length>0 && (
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14, '--fxc':fx.c }}>
                    {parsed.stats.map(([l,v])=>(
                      <div key={l} className="tokfx-statpill">
                        <span style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1.5, color:'rgba(255,255,255,0.65)', textTransform:'uppercase' }}>{l}</span>
                        <span style={{ fontFamily:'Cinzel,serif', fontSize:19, fontWeight:700, color:fx.c, textShadow:`0 0 12px color-mix(in srgb, ${fx.c} 40%, transparent)` }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* variantes de token — MOLDES (bases de impressão/recorte) ficam em aba própria */}
                {tokenView.tokens.length>1 && (()=>{
                  const isMolde = (v)=>/molde/i.test(v.src)||/molde/i.test(v.label||'');
                  const idx = tokenView.tokens.map((v,i)=>({ ...v, i }));
                  const grupos = { tokens: idx.filter(v=>!isMolde(v)), moldes: idx.filter(isMolde) };
                  const ativo = grupos[tokenTab].length ? tokenTab : 'tokens';
                  return (<>
                  {grupos.moldes.length>0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, padding:'8px 10px', borderRadius:10,
                      background:'rgba(255,255,255,0.04)', border:`1px solid color-mix(in srgb, ${fx.c} 25%, transparent)` }}>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:'var(--muted)', flexShrink:0 }}>Galeria:</span>
                      {[['tokens',`◉ Tokens (${grupos.tokens.length})`],['moldes',`▤ Moldes (${grupos.moldes.length})`]].map(([id,lbl])=>(
                        <button key={id} onClick={()=>{ setTokenTab(id); const g=grupos[id]; if(g.length) setTokenVariant(g[0].i); }}
                          style={{ flex:1, padding:'9px 14px', borderRadius:8, cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:11.5, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase',
                            background: ativo===id?fx.c:'transparent',
                            border: ativo===id?`1px solid ${fx.c}`:'1px solid var(--border)',
                            color: ativo===id?'#0c0a14':'var(--muted2)',
                            boxShadow: ativo===id?`0 0 16px color-mix(in srgb, ${fx.c} 55%, transparent)`:'none',
                            transition:'all .15s' }}
                          onMouseEnter={e=>{ if(ativo!==id) e.currentTarget.style.color='#fff'; }}
                          onMouseLeave={e=>{ e.currentTarget.style.color=ativo===id?'#0c0a14':'var(--muted2)'; }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:8, marginBottom:12, scrollbarWidth:'thin' }}>
                    {grupos[ativo].map((v)=>(
                      <button key={v.src} onClick={()=>setTokenVariant(v.i)} title={v.label}
                        style={{ width:54, height:54, flexShrink:0, borderRadius:8, padding:3, cursor:'pointer', background:'rgba(0,0,0,0.4)',
                          border: v.i===tokenVariant?`2px solid ${fx.c}`:'1px solid var(--border)',
                          boxShadow: v.i===tokenVariant?`0 0 12px color-mix(in srgb, ${fx.c} 45%, transparent)`:'none', transition:'all .15s' }}>
                        <img src={v.src} alt={v.label} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
                      </button>
                    ))}
                  </div>
                  </>);
                })()}
                {/* ficha em seções */}
                {parsed.sections.length>0 ? parsed.sections.map((sec,si)=>(
                  <div key={si} style={{ marginBottom:16 }}>
                    {sec.title && (
                      <div style={{ fontFamily:'Cinzel,serif', fontSize:13, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:fx.c,
                        borderBottom:`1px solid color-mix(in srgb, ${fx.c} 40%, transparent)`, paddingBottom:6, marginBottom:10,
                        textShadow:`0 0 14px color-mix(in srgb, ${fx.c} 40%, transparent)` }}>{sec.title}</div>
                    )}
                    {sec.lines.map((ln,li)=>{
                      const m = ln.match(/^([A-ZÀ-Úa-zà-ú][\wÀ-ú' ,()-]{2,44})[.:]\s+(.{10,})/);
                      return (
                        <p key={li} style={{ fontFamily:'Crimson Pro,serif', fontSize:16.5, color:'rgba(240,235,245,0.92)', lineHeight:1.7, margin:'0 0 9px' }}>
                          {m ? <><strong style={{ color:'#fff', fontFamily:'Cinzel,serif', fontSize:13.5 }}>{m[1]}.</strong> {m[2]}</> : ln}
                        </p>
                      );
                    })}
                  </div>
                )) : (
                  <div style={{ textAlign:'center', padding:'22px 12px', color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:14, fontStyle:'italic' }}>
                    Este pack não trouxe ficha em texto — só os tokens. Adicione ao bestiário e preencha os atributos.
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:8, padding:'12px 16px', borderTop:`1px solid color-mix(in srgb, ${fx.c} 25%, transparent)`, flexShrink:0, justifyContent:'flex-end', background:'rgba(0,0,0,0.3)' }}>
                <button onClick={()=>setTokenView(null)} style={{ padding:'8px 16px', borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1 }}>Fechar</button>
                <button onClick={()=>addFromToken(tokenView, tokenVariant)}
                  style={{ padding:'8px 18px', borderRadius:7, cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:1,
                    border:`1px solid color-mix(in srgb, ${fx.c} 55%, transparent)`, background:`color-mix(in srgb, ${fx.c} 20%, transparent)`,
                    color:'#fff', textShadow:`0 0 10px color-mix(in srgb, ${fx.c} 60%, transparent)`, transition:'all .18s' }}
                  onMouseEnter={e=>e.currentTarget.style.background=`color-mix(in srgb, ${fx.c} 34%, transparent)`}
                  onMouseLeave={e=>e.currentTarget.style.background=`color-mix(in srgb, ${fx.c} 20%, transparent)`}>
                  + Adicionar ao Bestiário
                </button>
              </div>
            </div>
          </div>
          );
        })()}
        </>);
      })()}

      {/* RITUAIS */}
      {bestedTab==='rituais' && (<>
          <div style={{ padding:'8px 4px', display:'flex', gap:6, flexShrink:0, flexWrap:'wrap' }}>
            <input value={ritualSearch} onChange={e=>setRitualSearch(e.target.value)} placeholder="Buscar ritual…"
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'5px 10px', fontFamily:'Crimson Pro,serif', fontSize:13, outline:'none', flex:1, minWidth:120 }}/>
            <select value={ritualElem} onChange={e=>setRitualElem(e.target.value)}
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', padding:'5px 8px', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, outline:'none', cursor:'pointer' }}>
              <option value="Todos">Todos Elementos</option>
              {['Conhecimento','Energia','Morte','Sangue','Medo'].map(e=><option key={e}>{e}</option>)}
            </select>
            <select value={ritualCirc} onChange={e=>setRitualCirc(Number(e.target.value))}
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', padding:'5px 8px', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, outline:'none', cursor:'pointer' }}>
              <option value={0}>Todos Círculos</option>
              {[1,2,3,4].map(c=><option key={c} value={c}>{c}° Círculo</option>)}
            </select>
          </div>
          <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:4, padding:'0 4px 8px' }}>
            {filteredRituais.length===0 && (
              <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontFamily:'Crimson Pro,serif', fontSize:14 }}>Nenhum ritual encontrado.</div>
            )}
            {filteredRituais.map((r,i)=>{
              const rKey = r.id || (r.elemento+'|'+r.nome+'|'+r.circulo);
              const exp = ritualExp===rKey;
              const ec = ELEM_COLORS[capElem(r.elemento)]||OPC;
              return (
                <div key={rKey+i} style={{ background:'var(--card)', border:`1px solid ${exp ? ec+'55' : 'var(--border)'}`, borderRadius:8, overflow:'hidden', flexShrink:0 /* sem shrink: overflow:hidden zera o min-height e o flex column comprimia os cards em listras */ }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', cursor:'pointer' }} onClick={()=>setRitualExp(exp?null:rKey)}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:ec, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:12, color:'var(--text)' }}>{r.nome}</span>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:9, color:ec, marginLeft:8, letterSpacing:1 }}>{capElem(r.elemento)}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:9, color:'var(--muted)', letterSpacing:1 }}>{r.circulo}° circ.</span>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:9, color:OPC }}>{CUSTO_CIRCULO[r.circulo]} PE</span>
                      <span style={{ fontSize:11, color:'var(--muted)' }}>{exp?'∧':'∨'}</span>
                    </div>
                  </div>
                  {exp && (
                    <div style={{ padding:'0 12px 12px', borderTop:'1px solid var(--border)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px', padding:'8px 0', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>
                        <div><span style={{ color:'var(--muted)' }}>EXECUÇÃO </span><span style={{ color:'var(--text)' }}>{r.execucao}</span></div>
                        <div><span style={{ color:'var(--muted)' }}>ALCANCE </span><span style={{ color:'var(--text)' }}>{r.alcance}</span></div>
                        <div><span style={{ color:'var(--muted)' }}>ALVO </span><span style={{ color:'var(--text)' }}>{r.alvo}</span></div>
                        <div><span style={{ color:'var(--muted)' }}>DURAÇÃO </span><span style={{ color:'var(--text)' }}>{r.duracao}</span></div>
                        {r.resistencia&&r.resistencia!=='-'&&r.resistencia!=='—'&&<div style={{ gridColumn:'1/-1' }}><span style={{ color:'var(--muted)' }}>RESISTÊNCIA </span><span style={{ color:'var(--text)' }}>{r.resistencia}</span></div>}
                      </div>
                      <div style={{ fontFamily:'Crimson Pro,serif', fontSize:13, color:'rgba(255,255,255,0.85)', lineHeight:1.6, marginTop:4 }}
                        dangerouslySetInnerHTML={{ __html: sanitizarHtml(r.descricao || r.efeito || '') }} />
                      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                        <button onClick={()=>doRoll('1d20')} title="Rolar 1d20 para conjurar"
                          style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:5, border:`1px solid ${ec}44`, background:`${ec}11`, color:ec, cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
                          1d20
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      </>)}

      {/* CONDIÇÕES */}
      {bestedTab==='condicoes' && (
        <div style={{ overflowY:'auto', flex:1, padding:'8px 4px' }}>
          <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:2, color:'var(--muted)', textTransform:'uppercase', padding:'4px 2px 10px' }}>Referência de Condições — Ordem Paranormal</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {OP_CONDICOES.map(c=>(
              <div key={c.nome} style={{ display:'flex', alignItems:'flex-start', gap:10, background:'var(--card)', border:`1px solid ${c.cor}33`, borderRadius:8, padding:'10px 12px' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:c.cor, flexShrink:0, marginTop:4 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:11, color:c.cor, letterSpacing:1, marginBottom:3 }}>{c.nome}</div>
                  <div style={{ fontFamily:'Crimson Pro,serif', fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.5 }}>{c.descricao}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REGRAS (spec 0024 — compêndio de referência, como Condições) */}
      {bestedTab==='regras' && (
        <div style={{ overflowY:'auto', flex:1, padding:'8px 4px' }}>
          <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:2, color:'var(--muted)', textTransform:'uppercase', padding:'4px 2px 10px' }}>Regras Básicas — Ordem Paranormal (material não oficial, parafraseado)</div>
          {[['testes','Testes e Dificuldade'],['acoes','Ações de Combate'],['manobras','Manobras'],['recursos','Recursos e Dano'],['interludio','Interlúdio'],['rituais','Rituais — Regras Gerais']].map(([sec,titulo])=>(
            <div key={sec} style={{ marginBottom:16 }}>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:11, color:OPC, letterSpacing:2, textTransform:'uppercase', borderBottom:'1px solid var(--border)', padding:'4px 2px 6px', marginBottom:8 }}>{titulo}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {REGRAS_OFICIAIS.filter(r=>r.secao===sec).map(r=>(
                  <div key={r.id} style={{ display:'flex', alignItems:'flex-start', gap:10, background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:'Cinzel,serif', fontSize:11, color:'var(--text)', letterSpacing:1, marginBottom:3 }}>{r.nome}</div>
                      <div style={{ fontFamily:'Crimson Pro,serif', fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.5 }}>{r.descricao}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ARMAS */}
      {bestedTab==='armas' && (<>
          <div style={{ padding:'8px 4px 4px', flexShrink:0 }}>
            <select value={armaFilter} onChange={e=>setArmaFilter(e.target.value)}
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', padding:'5px 8px', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, outline:'none', cursor:'pointer' }}>
              <option value="Todos">Todas Proficiências</option>
              {['Armas Táticas','Armas de Fogo','Armas Pesadas'].map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ overflowY:'auto', flex:1, padding:'4px 4px 8px' }}>
            <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:2, color:'var(--muted)', textTransform:'uppercase', padding:'4px 2px 8px' }}>Tabela de Armas — Ordem Paranormal</div>
            {['Armas Táticas','Armas de Fogo','Armas Pesadas'].filter(p=>armaFilter==='Todos'||armaFilter===p).map(prof=>{
              /* Mesmos dados oficiais da ficha (spec 0025 — fonte única). */
              const armas = ITENS_LIB.filter(a=>a.tipo==='arma'&&a.proficiencia===prof);
              return (
                <div key={prof} style={{ marginBottom:16 }}>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:2, color:OPC, textTransform:'uppercase', marginBottom:6, borderBottom:`1px solid ${OPC}33`, paddingBottom:4 }}>{prof}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {armas.map(a=>(
                      <div key={a.id} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, padding:'7px 10px', alignItems:'center' }}>
                        <div>
                          <div style={{ fontFamily:'Cinzel,serif', fontSize:11, color:'var(--text)' }}>{a.nome}</div>
                          <div style={{ fontFamily:'Cinzel,serif', fontSize:8, color:'var(--muted)', letterSpacing:1, marginTop:1 }}>
                            {a.tipo_arma} · {a.empunhadura}{a.alcance&&a.alcance!=='—'?` · ${a.alcance}`:''} · Cat. {a.categoria} · {a.espacos} esp.
                          </div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontFamily:'Cinzel,serif', fontSize:13, color:'var(--text)', fontWeight:600 }}>{a.dano}</div>
                          <div style={{ fontFamily:'Cinzel,serif', fontSize:8, color:'var(--muted)', letterSpacing:1 }}>
                            {a.tipo_dano}{(a.critico<20||a.multiplicador>2)?` · crít. ${a.critico}${a.critico<20?'+':''}/×${a.multiplicador}`:''}
                          </div>
                        </div>
                        <button onClick={()=>doRoll(a.dano)} title={`Rolar dano de ${a.nome}`}
                          style={{ background:'transparent', border:'none', cursor:'pointer', padding:'2px 4px', color:OPC, display:'flex', alignItems:'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Modificações (spec 0026 — tabelas 3.5/3.7/3.9 do livro, parafraseadas) */}
            <div style={{ marginTop:8, marginBottom:16 }}>
              <div style={{ fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:2, color:OPC, textTransform:'uppercase', marginBottom:4, borderBottom:`1px solid ${OPC}33`, paddingBottom:4 }}>Modificações</div>
              <div style={{ fontFamily:'Crimson Pro,serif', fontSize:12, color:'var(--muted)', marginBottom:8 }}>
                Cada modificação aumenta a categoria do item em I. Modificações iguais não se acumulam.
              </div>
              {[['armas','Armas (corpo a corpo e disparo)'],['armas_fogo','Armas de Fogo'],['municao','Munições'],['protecao','Proteções'],['acessorio','Acessórios']].map(([apl,titulo])=>(
                <div key={apl} style={{ marginBottom:10 }}>
                  <div style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase', margin:'6px 0 4px' }}>{titulo}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    {MODS_LIB.filter(m=>m.aplica===apl).map(m=>(
                      <div key={m.id} style={{ display:'flex', gap:8, background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 10px', alignItems:'baseline' }}>
                        <span style={{ fontFamily:'Cinzel,serif', fontSize:10, color:'var(--text)', whiteSpace:'nowrap' }}>{m.nome}</span>
                        <span style={{ fontFamily:'Crimson Pro,serif', fontSize:12, color:'rgba(255,255,255,0.75)', lineHeight:1.4 }}>{m.efeito}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
      </>)}

      {/* Add/Edit Modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:24, width: isOP(form.system)?560:460, maxHeight:'90vh', display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontFamily:'Cinzel Decorative,serif', fontSize:15, color:'var(--gold)', flexShrink:0 }}>
              {modal==='new' ? 'Nova Criatura' : `Editar: ${modal.name}`}
            </div>
            {modal==='new' && (
              <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
                <span style={sL}>Sistema</span>
                <select value={BESTIARY_SYSTEMS.includes(form.system) ? form.system : '__custom__'} onChange={e=>{
                  const sys=e.target.value;
                  if (sys==='__custom__') setForm({...EMPTY_CREATURE, system:'', name:form.name});
                  else if (isOP(sys)) setForm({...EMPTY_OP_CREATURE, name:form.name});
                  else setForm({...EMPTY_CREATURE, system:sys, name:form.name});
                }} style={sI}>
                  {BESTIARY_SYSTEMS.map(s=><option key={s}>{s}</option>)}
                  <option value="__custom__">Outro (personalizado)…</option>
                </select>
                {!BESTIARY_SYSTEMS.includes(form.system) && (
                  <input value={form.system} onChange={e=>setForm(p=>({...p,system:e.target.value}))}
                    placeholder="Ex: Call of Cthulhu, Vampiro, Pathfinder…"
                    style={{...sI, marginTop:4}}/>
                )}
              </div>
            )}
            <div style={{ overflowY:'auto', flex:1, paddingRight:4, display:'flex', flexDirection:'column', gap:10 }}>
              {isOP(form.system) ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <SecF>Identificação</SecF>
                  {fld('Nome','name',{placeholder:'Nome da criatura'})}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {fld('VD','vd',{placeholder:'ex: 400'})}
                    {fld('Categoria','category',{placeholder:'ex: Relíquia - Médio'})}
                  </div>
                  {fld('URL da Imagem','imageUrl',{placeholder:'https://...'})}
                  <SecF>Pontos de Vida</SecF>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {fld('HP Máximo','hpMax',{placeholder:'ex: 1666'})}
                    {fld('HP Atual','hpCurrent',{placeholder:'igual ao máximo'})}
                  </div>
                  <SecF>Atributos</SecF>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
                    {[['AGI','agi'],['FOR','atFor'],['INT','atInt'],['PRE','pre'],['VIG','vig']].map(([l,k])=>(
                      <div key={k} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <span style={{...sL,textAlign:'center'}}>{l}</span>
                        <input value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                          placeholder="0" style={{...sI,textAlign:'center',fontFamily:'Cinzel,serif',fontSize:16,fontWeight:700}}/>
                      </div>
                    ))}
                  </div>
                  <SecF>Combate Básico</SecF>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {fld('Defesa','defesa',{placeholder:'ex: 66'})}
                    {fld('Deslocamento','deslocamento',{placeholder:'ex: 18m / 12q'})}
                  </div>
                  <SecF>Perícias</SecF>
                  {[['PERCEPÇÃO','perPercepcao'],['INICIATIVA','perIniciativa'],['FORTITUDE','perFortitude'],['REFLEXOS','perReflexos'],['VONTADE','perVontade']].map(([l,k])=>(
                    <div key={k} style={{ display:'grid', gridTemplateColumns:'110px 1fr', gap:8, alignItems:'center' }}>
                      <span style={{ fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, color:'rgba(255,255,255,0.6)', textTransform:'uppercase' }}>{l}</span>
                      <input value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                        placeholder="ex: 6d20+25" style={{...sI,fontFamily:'monospace',fontSize:12}}/>
                    </div>
                  ))}
                  <SecF>Propriedades</SecF>
                  {fld('Sentidos','sentidos',{textarea:true,rows:2})}
                  {fld('Elementos Secundários','elementosSecundarios',{textarea:true,rows:2})}
                  {fld('Imunidades','imunidades',{textarea:true,rows:2})}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                    {fld('Res. Balístico','resBalistico',{placeholder:'20'})}
                    {fld('Res. Impacto','resImpacto',{placeholder:'20'})}
                    {fld('Res. Perfuração','resPerfuracao',{placeholder:'20'})}
                  </div>
                  {fld('Vulnerabilidades','vulnerabilidades',{textarea:true,rows:2})}
                  <SecF>Combate</SecF>
                  {fld('Presença Perturbadora','presencaPerturbadora',{textarea:true,rows:2,placeholder:'ex: DT 45 - 10d8 mental'})}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={sL}>AÇÕES</span>
                    <button onClick={opAddAcao} style={{ padding:'3px 10px', borderRadius:5, border:`1px solid rgba(176,48,216,0.4)`, background:'rgba(176,48,216,0.12)', color:'#e0c8ff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>+ Ação</button>
                  </div>
                  {(form.acoes||[]).map((acao,i)=>(
                    <div key={i} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, padding:10 }}>
                      <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                        <select value={acao.tipo} onChange={e=>opSetAcao(i,'tipo',e.target.value)}
                          style={{...sI,width:'auto',flex:'0 0 auto',fontFamily:'Cinzel,serif',fontSize:9}}>
                          {['PADRÃO','PADRÃO COMPLETO','LIVRE','MOVIMENTO','REAÇÃO'].map(t=><option key={t}>{t}</option>)}
                        </select>
                        <input value={acao.nome} onChange={e=>opSetAcao(i,'nome',e.target.value)} placeholder="Nome da ação" style={{...sI,flex:1}}/>
                        <button onClick={()=>opRemAcao(i)} style={{ padding:'4px 7px', borderRadius:4, border:'1px solid rgba(200,80,80,0.3)', background:'transparent', color:'#e07070', cursor:'pointer', fontSize:10, flexShrink:0 }}>✕</button>
                      </div>
                      <div style={{ display:'flex', gap:14, marginBottom:8 }}>
                        {[['texto','Descrição'],['ataques','Ataques']].map(([v,l])=>(
                          <label key={v} style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1, color:'var(--muted)', textTransform:'uppercase' }}>
                            <input type="radio" checked={acao.conteudo===v} onChange={()=>opSetAcao(i,'conteudo',v)} style={{ cursor:'pointer' }}/>
                            {l}
                          </label>
                        ))}
                      </div>
                      {acao.conteudo==='texto' ? (
                        <textarea value={acao.descricao||''} onChange={e=>opSetAcao(i,'descricao',e.target.value)}
                          placeholder="Descrição da ação..." rows={3} style={sT}/>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          {(acao.ataques||[]).map((atk,j)=>(
                            <div key={j} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:6, padding:8 }}>
                              <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                                <input value={atk.arma} onChange={e=>opSetAtk(i,j,'arma',e.target.value)} placeholder="Nome da arma"
                                  style={{...sI,flex:2,fontFamily:'Cinzel,serif',fontSize:10,textTransform:'uppercase'}}/>
                                <input value={atk.alcance} onChange={e=>opSetAtk(i,j,'alcance',e.target.value)} placeholder="Alcance"
                                  style={{...sI,flex:1,fontSize:10}}/>
                                <input value={atk.hits} onChange={e=>opSetAtk(i,j,'hits',e.target.value)} placeholder="Hits"
                                  style={{...sI,width:52,flex:'none',fontSize:10}}/>
                                <button onClick={()=>opRemAtk(i,j)} style={{ padding:'4px 7px', borderRadius:4, border:'1px solid rgba(200,80,80,0.3)', background:'transparent', color:'#e07070', cursor:'pointer', fontSize:10, flexShrink:0 }}>✕</button>
                              </div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                                <div><span style={sL}>Teste</span><input value={atk.teste} onChange={e=>opSetAtk(i,j,'teste',e.target.value)} placeholder="6d20+45" style={{...sI,fontFamily:'monospace',fontSize:11}}/></div>
                                <div><span style={sL}>Dano</span><input value={atk.dano} onChange={e=>opSetAtk(i,j,'dano',e.target.value)} placeholder="2d10 Sangue" style={{...sI,fontFamily:'monospace',fontSize:11}}/></div>
                                <div><span style={sL}>Crítico</span><input value={atk.critico} onChange={e=>opSetAtk(i,j,'critico',e.target.value)} placeholder="x3" style={{...sI,fontFamily:'monospace',fontSize:11}}/></div>
                              </div>
                            </div>
                          ))}
                          <button onClick={()=>opAddAtk(i)} style={{ padding:'5px 10px', borderRadius:5, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)', color:'var(--muted)', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>+ Ataque</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
                    <span style={sL}>PODERES</span>
                    <button onClick={opAddPod} style={{ padding:'3px 10px', borderRadius:5, border:`1px solid rgba(176,48,216,0.4)`, background:'rgba(176,48,216,0.12)', color:'#e0c8ff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>+ Poder</button>
                  </div>
                  {(form.poderes||[]).map((p,i)=>(
                    <div key={i} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, padding:10 }}>
                      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                        <input value={p.nome} onChange={e=>opSetPod(i,'nome',e.target.value)} placeholder="Nome do poder" style={{...sI,flex:1}}/>
                        <button onClick={()=>opRemPod(i)} style={{ padding:'4px 7px', borderRadius:4, border:'1px solid rgba(200,80,80,0.3)', background:'transparent', color:'#e07070', cursor:'pointer', fontSize:10, flexShrink:0 }}>✕</button>
                      </div>
                      <textarea value={p.desc} onChange={e=>opSetPod(i,'desc',e.target.value)} placeholder="Descrição..." rows={3} style={sT}/>
                    </div>
                  ))}
                  <SecF>Descrição</SecF>
                  {fld('Texto de Lore','descricaoTexto',{textarea:true,rows:5})}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={sL}>SEÇÕES / ENIGMAS</span>
                    <button onClick={opAddEni} style={{ padding:'3px 10px', borderRadius:5, border:`1px solid rgba(176,48,216,0.4)`, background:'rgba(176,48,216,0.12)', color:'#e0c8ff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:9, letterSpacing:1 }}>+ Seção</button>
                  </div>
                  {(form.enigmas||[]).map((e,i)=>(
                    <div key={i} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, padding:10 }}>
                      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                        <input value={e.titulo} onChange={ev=>opSetEni(i,'titulo',ev.target.value)} placeholder="Título (ex: Enigma do Medo)"
                          style={{...sI,flex:1,fontFamily:'Cinzel Decorative,serif',fontSize:11}}/>
                        <button onClick={()=>opRemEni(i)} style={{ padding:'4px 7px', borderRadius:4, border:'1px solid rgba(200,80,80,0.3)', background:'transparent', color:'#e07070', cursor:'pointer', fontSize:10, flexShrink:0 }}>✕</button>
                      </div>
                      <textarea value={e.texto} onChange={ev=>opSetEni(i,'texto',ev.target.value)} placeholder="Texto..." rows={4} style={sT}/>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {modal!=='new' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <span style={sL}>Sistema</span>
                      <select value={BESTIARY_SYSTEMS.includes(form.system) ? form.system : '__custom__'}
                        onChange={e=>{ const v=e.target.value; setForm(p=>({...p,system:v==='__custom__'?'':v})); }} style={sI}>
                        {BESTIARY_SYSTEMS.map(s=><option key={s}>{s}</option>)}
                        <option value="__custom__">Outro (personalizado)…</option>
                      </select>
                      {!BESTIARY_SYSTEMS.includes(form.system) && (
                        <input value={form.system} onChange={e=>setForm(p=>({...p,system:e.target.value}))}
                          placeholder="Ex: Call of Cthulhu, Vampiro, Pathfinder…"
                          style={{...sI, marginTop:4}}/>
                      )}
                    </div>
                  )}
                  {fld('Nome','name')}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                    {fld('HP','hp',{placeholder:'ex: 45'})}
                    {fld('CA / Defesa','ac',{placeholder:'ex: 14'})}
                    {fld('Iniciativa','initiative',{placeholder:'ex: +3'})}
                  </div>
                  {fld('Descrição','description',{textarea:true,rows:3})}
                  {fld('Ataques / Habilidades','attacks',{textarea:true,rows:4})}
                </>
              )}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexShrink:0, marginTop:4 }}>
              <button onClick={()=>setModal(null)} style={{ padding:'7px 16px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:11 }}>Cancelar</button>
              <button onClick={saveCreature} disabled={saving||!form.name.trim()}
                style={{ padding:'7px 16px', borderRadius:6, border:`1px solid rgba(176,48,216,0.5)`, background:'rgba(176,48,216,0.2)', color:'#e0c8ff', cursor:'pointer', fontFamily:'Cinzel,serif', fontSize:11, opacity:saving||!form.name.trim()?0.5:1 }}>
                {saving?'Salvando…':'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BestiaryTab;
