import { useState } from "react";

/* ═══════════════════════════════
   CHARACTER SHEET
═══════════════════════════════ */
function Sheet({ system }) {
  const accent = system?.accent || "var(--gold)";
  const isOP = system?.id === "op";
  const isDnD = system?.id === "dnd";
  const [hp, setHp] = useState(isOP ? 18 : isDnD ? 58 : 18);
  const [pe, setPe] = useState(isOP ? 12 : 10);
  const [san, setSan] = useState(isOP ? 9 : 10);
  const hpMax = isOP ? 24 : isDnD ? 72 : 24;
  const peMax = isOP ? 16 : 12;
  const sanMax = isOP ? 12 : 10;

  const Ctrl = ({val, set, max, color, label, icon}) => (
    <div style={{background:"var(--card)", border:"1px solid var(--border)", borderRadius:8, padding:16}}>
      <div style={{display:"flex", gap:6, alignItems:"center", marginBottom:8}}>
        <span>{icon}</span>
        <span style={{fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase"}}>{label}</span>
      </div>
      <div style={{display:"flex", alignItems:"baseline", gap:4, marginBottom:10}}>
        <span style={{fontFamily:"'Cinzel Decorative',serif", fontSize:30, color}}>{val}</span>
        <span style={{fontFamily:"Cinzel,serif", fontSize:14, color:"var(--muted)"}}>/{max}</span>
      </div>
      <div style={{height:5, background:"rgba(255,255,255,0.06)", borderRadius:3, marginBottom:10, overflow:"hidden"}}>
        <div style={{height:"100%", width:`${(val/max)*100}%`, background:color, borderRadius:3, transition:"width 0.3s"}}/>
      </div>
      <div style={{display:"flex", gap:6}}>
        {[-1,+1].map(d=>(
          <button key={d} onClick={()=>set(v=>Math.max(0,Math.min(max,v+d)))} style={{
            flex:1, padding:"5px 0", cursor:"pointer",
            background:"rgba(255,255,255,0.03)", border:"1px solid var(--border)",
            borderRadius:4, color:"var(--text)", fontFamily:"Cinzel,serif", fontSize:14,
            transition:"all 0.15s",
          }}>{d<0?"−":"+"}</button>
        ))}
      </div>
    </div>
  );

  const attrs = isOP
    ? [{n:"Força",v:12},{n:"Agilidade",v:15},{n:"Intelecto",v:17},{n:"Presença",v:9},{n:"Vigor",v:11}]
    : isDnD
    ? [{n:"Força",v:16},{n:"Destreza",v:14},{n:"Constituição",v:15},{n:"Inteligência",v:10},{n:"Sabedoria",v:12},{n:"Carisma",v:8}]
    : [{n:"Atributo 1",v:12},{n:"Atributo 2",v:10},{n:"Atributo 3",v:14}];

  const skills2 = isOP
    ? [{n:"Investigação",b:"+4",p:4},{n:"Ocultismo",b:"+3",p:3},{n:"Percepção",b:"+3",p:3},{n:"Furtividade",b:"+2",p:2},{n:"Medicina",b:"+2",p:2},{n:"Atletismo",b:"+1",p:1},{n:"Persuasão",b:"+1",p:1}]
    : isDnD
    ? [{n:"Percepção",b:"+5",p:4},{n:"Sobrevivência",b:"+4",p:3},{n:"Atletismo",b:"+5",p:3},{n:"Furtividade",b:"+4",p:2},{n:"Natureza",b:"+2",p:2},{n:"Persuasão",b:"+1",p:1}]
    : [{n:"Perícia 1",b:"+3",p:3},{n:"Perícia 2",b:"+2",p:2},{n:"Perícia 3",b:"+1",p:1}];

  return (
    <div className="fade" style={{display:"flex", flexDirection:"column", gap:20}}>
      {/* Hero */}
      <div style={{
        background:"var(--card)", border:"1px solid var(--border2)",
        borderRadius:10, padding:24, display:"flex", gap:20, position:"relative", overflow:"hidden",
      }}>
        <div style={{position:"absolute",top:0,right:0,width:300,height:"100%",
          background:"linear-gradient(to left,rgba(201,168,76,0.03),transparent)",pointerEvents:"none"}}/>
        <div style={{
          width:76, height:76, borderRadius:10, flexShrink:0,
          background:"linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.05))",
          border:"2px solid var(--border2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32,
          boxShadow:"0 0 24px rgba(201,168,76,0.15)",
        }}>🕵️</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:3, color:"var(--muted)", textTransform:"uppercase", marginBottom:5}}>
            {isOP ? "Agente · Ordem Paranormal · NEEx São Paulo" : isDnD ? "Herói · D&D 5ª Edição · Campanha do Rei Sombrio" : `Personagem · ${system?.name}`}
          </div>
          <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:20, color:"var(--text)", marginBottom:4, animation:"flicker 8s infinite"}}>Dra. Helena Voss</div>
          <div style={{fontFamily:"Crimson Pro,serif", fontSize:14, color:"var(--muted2)", fontStyle:"italic", marginBottom:10}}>Pesquisadora do Sobrenatural · Trilha: Especialista</div>
          <div style={{display:"flex", gap:6}}>
            {["NEX 45%","Veterana","Paranóica"].map(t=>(
              <span key={t} style={{
                fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:1,
                padding:"3px 10px", borderRadius:20,
                border:"1px solid var(--border2)", color:"var(--gold)",
              }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"Cinzel,serif", fontSize:8, color:"var(--muted)", letterSpacing:2, textTransform:"uppercase", marginBottom:4}}>XP</div>
          <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:28, color:"var(--gold)"}}>3.2k</div>
          <div style={{fontFamily:"Cinzel,serif", fontSize:8, color:"var(--muted)"}}>/ 4.000</div>
        </div>
      </div>

      {/* Vitals */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
        <Ctrl val={hp} set={setHp} max={hpMax} color="#b03020" label="Pontos de Vida" icon="❤️"/>
        <Ctrl val={pe} set={setPe} max={peMax} color={accent} label={isOP?"Pontos de Esforço":"Pontos de Magia"} icon="⚡"/>
        <Ctrl val={san} set={setSan} max={sanMax} color="#7a5ea8" label={isOP?"Sanidade":"Inspiração"} icon={isOP?"🧠":"✨"}/>
      </div>

      {/* Attrs + Skills */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <div style={{background:"var(--card)", border:"1px solid var(--border)", borderRadius:8, padding:18}}>
          <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--gold)", textTransform:"uppercase", marginBottom:14}}>Atributos</div>
          {attrs.map(a=>(
            <div key={a.n} style={{marginBottom:10}}>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:4}}>
                <span style={{fontFamily:"Crimson Pro,serif", fontSize:14, color:"var(--text)"}}>{a.n}</span>
                <span style={{fontFamily:"Cinzel,serif", fontSize:12, color:"var(--gold)"}}>{a.v}</span>
              </div>
              <div style={{height:4, background:"rgba(255,255,255,0.05)", borderRadius:2, overflow:"hidden"}}>
                <div style={{height:"100%", width:`${(a.v/20)*100}%`, background:"linear-gradient(90deg,var(--gold3),var(--gold2))", borderRadius:2}}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{background:"var(--card)", border:"1px solid var(--border)", borderRadius:8, padding:18}}>
          <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--gold)", textTransform:"uppercase", marginBottom:14}}>Perícias</div>
          {skills2.map(s=>(
            <div key={s.n} style={{display:"flex", alignItems:"center", gap:8, marginBottom:9}}>
              <div style={{width:6, height:6, borderRadius:"50%", background: s.p>2?"var(--gold)":"var(--muted)", flexShrink:0}}/>
              <span style={{fontFamily:"Crimson Pro,serif", fontSize:14, color:"var(--text)", flex:1}}>{s.n}</span>
              <span style={{fontFamily:"Cinzel,serif", fontSize:11, color:"var(--gold)", minWidth:24}}>{s.b}</span>
              <div style={{display:"flex", gap:2}}>
                {[0,1,2,3,4].map(i=>(
                  <div key={i} style={{width:7, height:7, borderRadius:1, background: i<s.p?"var(--gold)":"rgba(255,255,255,0.06)"}}/>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rituais */}
      <div style={{background:"var(--card)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:8, padding:18}}>
        <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--gold)", textTransform:"uppercase", marginBottom:14}}>Rituais Conhecidos</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {[{n:"Visão do Além",c:"2 PE",d:"Enxerga entidades e rastros do Outro Lado por 1 cena."},{n:"Escudo Paranormal",c:"3 PE",d:"Barreira etérea que absorve dano de entidades."},{n:"Âncora Espiritual",c:"4 PE",d:"Impede manifestação de entidades por toda a cena."}].map(r=>(
            <div key={r.n} style={{
              display:"flex", gap:14, padding:"10px 14px",
              background:"rgba(201,168,76,0.04)", border:"1px solid rgba(201,168,76,0.12)",
              borderRadius:6,
            }}>
              <span style={{fontFamily:"Cinzel,serif", fontSize:9, color:"var(--gold)", border:"1px solid var(--border2)", borderRadius:3, padding:"3px 8px", height:"fit-content", whiteSpace:"nowrap"}}>{r.c}</span>
              <div>
                <div style={{fontFamily:"Cinzel,serif", fontSize:12, color:"var(--text)", marginBottom:2}}>{r.n}</div>
                <div style={{fontFamily:"Crimson Pro,serif", fontSize:13, color:"var(--muted2)", fontStyle:"italic"}}>{r.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Sheet;
