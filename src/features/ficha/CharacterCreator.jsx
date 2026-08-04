import { useState, useRef } from "react";
import NexusLogo from "../../lib/NexusLogo";
import AttrDiagram from "./AttrDiagram";
import StepBar from "./StepBar";
import { ORIGENS, CLASSES } from "./opConstants";


/* ═══════════════════════════════
   CHARACTER CREATOR — OP NEXUS
═══════════════════════════════ */

function CharacterCreator({ onFinish, onCancel }) {
  const [step, setStep] = useState(0);
  const [attrs, setAttrs] = useState({ AGI:1, FOR:1, INT:1, PRE:1, VIG:1 });
  const [pontos, setPontos] = useState(4);
  const [origem, setOrigem] = useState(null);
  const [classe, setClasse] = useState(null);
  const [form, setForm] = useState({ personagem:"", jogador:"", aparencia:"", personalidade:"", historico:"", objetivo:"", avatar:"" });
  const avatarInputRef = useRef(null);
  const aiArtEnabled = localStorage.getItem("nexus_ai_art") === "1";
  const [aiComingSoon, setAiComingSoon] = useState(false);
  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, avatar: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const totalUsed = Object.values(attrs).reduce((a,b)=>a+b,0) - 5;
  const pontosRestantes = 4 - totalUsed;

  const changeAttr = (key, delta) => {
    const next = attrs[key] + delta;
    if (next < 0 || next > 3) return;
    if (delta > 0 && pontosRestantes <= 0) return;
    setAttrs(a => ({ ...a, [key]: next }));
  };

  const S = { // shared styles
    section: { background:"var(--card)", border:"1px solid var(--border)", borderRadius:10, padding:24 },
    label: { fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase", marginBottom:6, display:"block" },
    h2: { fontFamily:"'Cinzel Decorative',serif", fontSize:24, background:"linear-gradient(135deg,#c9a84c,#e8c96d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", marginBottom:14 },
    desc: { fontFamily:"Crimson Pro,serif", fontSize:18, color:"var(--muted2)", lineHeight:1.8, fontStyle:"italic" },
  };

  /* STEP 0 — ATRIBUTOS */
  const StepAtributos = () => (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, alignItems:"start"}}>
      <div>
        <div style={S.h2}>Distribua seus Atributos</div>
        <p style={S.desc}>
          Quando você cria um personagem, todos os seus atributos começam em <strong style={{color:"var(--gold)"}}>1</strong> e você recebe <strong style={{color:"var(--gold)"}}>4 pontos</strong> para distribuir entre eles como quiser. Você também pode reduzir um atributo para 0 para receber <strong style={{color:"var(--gold)"}}>1 ponto adicional</strong>. O valor máximo inicial que você pode ter em cada atributo é <strong style={{color:"var(--gold)"}}>3</strong>.<br/><br/>
          <em>Ao rolar um teste, você rola N dados d20 iguais ao valor do atributo e usa o <strong style={{color:"var(--gold)"}}>maior resultado</strong>. Se o atributo for 0, rola 2d20 e usa o <strong style={{color:"#c05050"}}>pior</strong>.</em>
        </p>
        <div style={{marginTop:24, display:"flex", flexDirection:"column", gap:12}}>
          {/* Points remaining */}
          <div style={{
            display:"flex", alignItems:"center", gap:12,
            padding:"12px 16px", borderRadius:8,
            background: pontosRestantes > 0 ? "rgba(201,168,76,0.07)" : pontosRestantes === 0 ? "rgba(76,175,80,0.07)" : "rgba(139,32,32,0.1)",
            border: `1px solid ${pontosRestantes > 0 ? "rgba(201,168,76,0.3)" : pontosRestantes === 0 ? "rgba(76,175,80,0.3)" : "rgba(200,50,50,0.4)"}`,
          }}>
            <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:28, color: pontosRestantes>0?"var(--gold)":pontosRestantes===0?"#4caf50":"#c03020"}}>{Math.max(0,pontosRestantes)}</div>
            <div>
              <div style={{fontFamily:"Cinzel,serif", fontSize:13, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase"}}>Pontos Restantes</div>
              <div style={{fontFamily:"Crimson Pro,serif", fontSize:16, color:"var(--muted2)", fontStyle:"italic"}}>
                {pontosRestantes>0?"Distribua os pontos nos atributos →":pontosRestantes===0?"✓ Todos os pontos distribuídos":"Você reduziu atributos e ganhou pontos extras"}
              </div>
            </div>
          </div>
          {/* Attr list for mobile/reference */}
          {Object.entries(attrs).map(([k,v])=>{
            const labels = { AGI:"Agilidade", FOR:"Força", INT:"Intelecto", PRE:"Presença", VIG:"Vigor" };
            return (
              <div key={k} style={{display:"flex", alignItems:"center", gap:10}}>
                <span style={{fontFamily:"Cinzel,serif", fontSize:13, color:"var(--gold)", width:36}}>{k}</span>
                <span style={{fontFamily:"Crimson Pro,serif", fontSize:17, color:"var(--muted2)", flex:1}}>{labels[k]}</span>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <button onClick={()=>changeAttr(k,-1)} style={{width:30,height:30,borderRadius:4,border:"1px solid var(--border2)",background:"transparent",color:"var(--gold)",cursor:"pointer",fontFamily:"serif",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                  <div style={{width:36,textAlign:"center",fontFamily:"Cinzel,serif",fontSize:20,color:"var(--text)",fontWeight:600}}>{v}</div>
                  <button onClick={()=>changeAttr(k,+1)} style={{width:30,height:30,borderRadius:4,border:"1px solid var(--border2)",background:"transparent",color:"var(--gold)",cursor:"pointer",fontFamily:"serif",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                </div>
                <div style={{width:60,height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(v/5)*100}%`,background:"linear-gradient(90deg,var(--gold3),var(--gold2))",borderRadius:2,transition:"width 0.2s"}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* SVG Diagram */}
      <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:16}}>
        <AttrDiagram attrs={attrs} onChange={changeAttr} onRoll={null}/>
        <div style={{fontFamily:"Cinzel,serif", fontSize:11, letterSpacing:2, color:"var(--muted)", textTransform:"uppercase", textAlign:"center"}}>
          Clique nos botões do diagrama ou use a lista
        </div>
      </div>
    </div>
  );

  /* STEP 1 — ORIGEM */
  const StepOrigem = () => {
    const [search, setSearch] = useState("");
    const filtered = ORIGENS.filter(o=>o.name.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="fade" style={{display:"flex", flexDirection:"column", gap:20}}>
        <div>
          <div style={S.h2}>Escolha sua Origem</div>
          <p style={S.desc}>
            O que seu personagem fazia antes de se envolver com o paranormal e ingressar na Ordem da Realidade? A origem representa como a vida pregressa influencia sua carreira de investigador.<br/>
            <strong style={{color:"var(--gold)", fontStyle:"normal"}}>Ao escolher uma origem, você recebe duas perícias treinadas e um poder da origem.</strong>
          </p>
          <div style={{marginTop:16, padding:"10px 14px", background:"var(--gold-dim)", border:"1px solid var(--border)", borderRadius:6}}>
            <span style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1, color:"var(--muted2)"}}>Perícias concedidas serão adicionadas automaticamente. Perícias opcionais podem ser adicionadas ao agente após sua criação.</span>
          </div>
        </div>
        {/* Search */}
        <div style={{position:"relative"}}>
          <span style={{position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", fontSize:16}}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar origem..." style={{paddingLeft:38}}/>
        </div>
        {/* Origem cards */}
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {filtered.map(o=>{
            const isSelected = origem?.id === o.id;
            return (
              <div key={o.id} style={{
                borderRadius:8, overflow:"hidden",
                border:`1px solid ${isSelected?"rgba(201,168,76,0.5)":"var(--border)"}`,
                background: isSelected?"rgba(201,168,76,0.05)":"var(--card)",
                transition:"all 0.2s",
              }}>
                <div style={{
                  display:"flex", alignItems:"center", gap:12,
                  padding:"14px 18px", cursor:"pointer",
                }} onClick={()=>setOrigem(o)}>
                  <div style={{
                    width:8, height:8, borderRadius:"50%",
                    background: isSelected?"var(--gold)":"var(--muted)",
                    transition:"background 0.2s", flexShrink:0,
                  }}/>
                  <span style={{fontFamily:"Cinzel,serif", fontSize:14, color:"var(--text)", flex:1}}>{o.name}</span>
                  <div style={{display:"flex", gap:6}}>
                    {o.skills.map(s=>(
                      <span key={s} style={{fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:1, padding:"2px 8px", borderRadius:20, border:"1px solid rgba(201,168,76,0.2)", color:"var(--muted2)"}}>{s}</span>
                    ))}
                  </div>
                  <button style={{
                    padding:"6px 16px", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2,
                    textTransform:"uppercase", cursor:"pointer", borderRadius:4, transition:"all 0.2s",
                    background: isSelected?"linear-gradient(135deg,#c9a84c,#e8c96d,#a07830)":"transparent",
                    border: isSelected?"none":"1px solid var(--border2)",
                    color: isSelected?"#050505":"var(--gold)",
                    fontWeight: isSelected?"700":"400",
                  }} onClick={(e)=>{e.stopPropagation();setOrigem(o);}}>
                    {isSelected?"✓ Escolhida":"Escolher"}
                  </button>
                </div>
                {/* Expanded info */}
                {isSelected && (
                  <div style={{padding:"0 18px 14px 38px", borderTop:"1px solid var(--border)"}}>
                    <div style={{paddingTop:12, fontFamily:"Crimson Pro,serif", fontSize:14, color:"var(--muted2)", fontStyle:"italic", lineHeight:1.65}}>
                      <strong style={{color:"var(--gold)", fontStyle:"normal"}}>Poder: </strong>{o.power}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* STEP 2 — CLASSE */
  const ClassIcon = ({id}) => {
    if (id === "combatente") return (
      <svg viewBox="0 0 80 96" width="68" height="68" fill="none">
        {/* left wing */}
        <path d="M38 44 C30 36 16 33 4 18 C13 23 21 23 27 30 C19 21 13 11 16 3 C23 14 28 23 34 35" fill="#8B1A1A"/>
        <path d="M34 35 C28 28 20 26 14 30 C20 30 27 33 35 40" fill="#7B1414" opacity="0.7"/>
        {/* right wing */}
        <path d="M42 44 C50 36 64 33 76 18 C67 23 59 23 53 30 C61 21 67 11 64 3 C57 14 52 23 46 35" fill="#8B1A1A"/>
        <path d="M46 35 C52 28 60 26 66 30 C60 30 53 33 45 40" fill="#7B1414" opacity="0.7"/>
        {/* blade */}
        <polygon points="40,3 44,46 40,55 36,46" fill="#C0392B"/>
        {/* blood drip tip */}
        <path d="M40 55 L37 60 L40 68 L43 60 Z" fill="#E74C3C" opacity="0.85"/>
        {/* cross guard */}
        <path d="M26 48 C33 45 47 45 54 48 C47 51 33 51 26 48Z" fill="#922B21"/>
        {/* handle */}
        <rect x="38" y="51" width="4" height="18" rx="2" fill="#7B241C"/>
        {/* pommel */}
        <ellipse cx="40" cy="72" rx="6" ry="5" fill="#922B21"/>
        <ellipse cx="40" cy="72" rx="3" ry="2.5" fill="#C0392B" opacity="0.6"/>
      </svg>
    );
    if (id === "especialista") return (
      <svg viewBox="0 0 80 80" width="68" height="68" fill="none">
        {/* outer star / sunburst */}
        <polygon points="40,2 43,28 62,14 49,34 76,34 52,44 68,66 42,52 44,78 40,54 36,78 38,52 12,66 28,44 4,34 31,34 18,14 37,28" fill="none" stroke="#7B2FBE" strokeWidth="1.2" opacity="0.8"/>
        {/* inner ring */}
        <circle cx="40" cy="40" r="14" fill="none" stroke="#9B59B6" strokeWidth="1.5"/>
        {/* eye outline */}
        <path d="M26 40 Q40 28 54 40 Q40 52 26 40Z" fill="#4A235A" stroke="#9B59B6" strokeWidth="1"/>
        {/* iris */}
        <circle cx="40" cy="40" r="7" fill="#7B2FBE"/>
        {/* pupil */}
        <circle cx="40" cy="40" r="4" fill="#1a0828"/>
        {/* spiral in pupil */}
        <path d="M40 38 Q42 38 42 40 Q42 42 40 42 Q38 42 38 40 Q38 39 39 38.5" fill="none" stroke="#9B59B6" strokeWidth="0.8"/>
        {/* corner glows */}
        <circle cx="40" cy="4"  r="2" fill="#A569BD" opacity="0.7"/>
        <circle cx="76" cy="40" r="2" fill="#A569BD" opacity="0.7"/>
        <circle cx="40" cy="76" r="2" fill="#A569BD" opacity="0.7"/>
        <circle cx="4"  cy="40" r="2" fill="#A569BD" opacity="0.7"/>
      </svg>
    );
    /* ocultista */
    return (
      <svg viewBox="0 0 80 80" width="68" height="68" fill="none">
        {/* outer rune ring */}
        <circle cx="40" cy="40" r="37" stroke="#6C3483" strokeWidth="1" strokeDasharray="3 4" opacity="0.9"/>
        <circle cx="40" cy="40" r="31" stroke="#7D3C98" strokeWidth="0.8" opacity="0.6"/>
        {/* dark void */}
        <circle cx="40" cy="40" r="11" fill="#12052a"/>
        <circle cx="40" cy="40" r="11" stroke="#8E44AD" strokeWidth="1.5"/>
        {/* cardinal flame spikes */}
        <path d="M40 29 C37 23 32 18 35 11 C38 18 40 23 40 29Z" fill="#7B2FBE"/>
        <path d="M40 29 C43 23 48 18 45 11 C42 18 40 23 40 29Z" fill="#6C3483"/>
        <path d="M51 40 C57 37 62 32 69 35 C62 38 57 40 51 40Z" fill="#7B2FBE"/>
        <path d="M51 40 C57 43 62 48 69 45 C62 42 57 40 51 40Z" fill="#6C3483"/>
        <path d="M40 51 C37 57 32 62 35 69 C38 62 40 57 40 51Z" fill="#7B2FBE"/>
        <path d="M40 51 C43 57 48 62 45 69 C42 62 40 57 40 51Z" fill="#6C3483"/>
        <path d="M29 40 C23 37 18 32 11 35 C18 38 23 40 29 40Z" fill="#7B2FBE"/>
        <path d="M29 40 C23 43 18 48 11 45 C18 42 23 40 29 40Z" fill="#6C3483"/>
        {/* diagonal spikes */}
        <path d="M32 32 C26 25 23 18 17 17 C22 23 27 28 32 32Z" fill="#8E44AD" opacity="0.8"/>
        <path d="M48 32 C54 25 57 18 63 17 C58 23 53 28 48 32Z" fill="#8E44AD" opacity="0.8"/>
        <path d="M48 48 C54 55 57 62 63 63 C58 57 53 52 48 48Z" fill="#8E44AD" opacity="0.8"/>
        <path d="M32 48 C26 55 23 62 17 63 C22 57 27 52 32 48Z" fill="#8E44AD" opacity="0.8"/>
        {/* rune ticks on outer ring */}
        {[0,30,60,90,120,150,180,210,240,270,300,330].map(a=>(
          <line key={a}
            x1={40+34*Math.cos(a*Math.PI/180)} y1={40+34*Math.sin(a*Math.PI/180)}
            x2={40+37*Math.cos(a*Math.PI/180)} y2={40+37*Math.sin(a*Math.PI/180)}
            stroke="#9B59B6" strokeWidth="1.5" opacity="0.7"/>
        ))}
      </svg>
    );
  };

  const StepClasse = () => (
    <div className="fade" style={{display:"flex", flexDirection:"column", gap:20}}>
      <div>
        <div style={S.h2}>Escolha sua Classe</div>
        <p style={S.desc}>
          Sua classe indica o treinamento que você recebeu na Ordem para enfrentar os perigos do Outro Lado. Em termos de jogo, é a sua característica mais importante, pois define o que você faz e qual é o seu papel no grupo de investigadores.
        </p>
        <p style={{...S.desc, marginTop:10}}>
          <strong style={{color:"var(--gold)", fontStyle:"normal"}}>Perícias concedidas serão adicionadas automaticamente.</strong> Como uma alternativa, você pode não escolher uma classe e começar como <span style={{color:"var(--gold)"}}>Mundano</span>.
        </p>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16}}>
        {CLASSES.map(c=>{
          const isSel = classe?.id === c.id;
          return (
            <div key={c.id} onClick={()=>setClasse(c)} style={{
              background: isSel?"rgba(201,168,76,0.06)":"var(--card)",
              border:`1px solid ${isSel?"rgba(201,168,76,0.5)":"var(--border)"}`,
              borderRadius:10, padding:22, cursor:"pointer",
              transition:"all 0.25s",
              transform: isSel?"translateY(-2px)":"none",
              boxShadow: isSel?"0 8px 30px rgba(201,168,76,0.1)":"none",
              position:"relative", overflow:"hidden",
            }}>
              {isSel && <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,var(--gold),transparent)"}}/>}
              <div style={{marginBottom:14}}><ClassIcon id={c.id}/></div>
              <div style={{fontFamily:"Cinzel,serif", fontSize:20, fontWeight:600, color:"var(--text)", marginBottom:8, borderBottom:`1px solid ${isSel?"rgba(201,168,76,0.3)":"var(--border)"}`, paddingBottom:10}}>{c.name}</div>
              <p style={{fontFamily:"Crimson Pro,serif", fontSize:16, color:"var(--text)", fontWeight:600, lineHeight:1.65, marginBottom:10}}>{c.desc}</p>
              <p style={{fontFamily:"Crimson Pro,serif", fontSize:15, color:"var(--muted2)", lineHeight:1.7, marginBottom:14, fontStyle:"italic"}}>{c.detail}</p>
              <div style={{fontFamily:"Cinzel,serif", fontSize:11, letterSpacing:1.5, color:"var(--gold)", textTransform:"uppercase", padding:"8px 12px", borderRadius:4, border:"1px solid rgba(201,168,76,0.2)", background:"rgba(201,168,76,0.05)"}}>{c.bonus}</div>
              {isSel && (
                <div style={{marginTop:12}}>
                  <button className="btn-gold" style={{width:"100%", padding:"8px 0", fontSize:11, letterSpacing:2}}>✓ Classe Selecionada</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* STEP 3 — TOQUES FINAIS — renderizado inline para evitar perda de foco */
  const renderStepFinal = () => (
    <div className="fade" style={{display:"flex", flexDirection:"column", gap:20}}>
      <div style={{display:"flex", flexWrap:"wrap", justifyContent:"space-between", alignItems:"flex-start", gap:12}}>
        <div style={{flex:1, minWidth:200}}>
          <div style={S.h2}>Toques Finais</div>
          <p style={S.desc}>
            Até aqui, você definiu as características mecânicas de sua ficha — mas um bom personagem é mais do que apenas números. Agora, vamos trabalhar na descrição de seu agente, definindo aspectos como nome, gênero e idade.
          </p>
        </div>
        <button className="btn-gold" onClick={()=>{ if(form.personagem) onFinish({attrs,origem,classe,form}); }} style={{flexShrink:0}}>
          Finalizar Ficha
        </button>
      </div>

      {/* Avatar upload */}
      <div style={{display:"flex", alignItems:"center", gap:20}}>
        <input ref={avatarInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatarFile}/>
        <div
          onClick={()=>avatarInputRef.current?.click()}
          style={{
            width:100, height:100, borderRadius:10, flexShrink:0,
            background:"rgba(201,168,76,0.08)", border:"2px dashed rgba(201,168,76,0.35)",
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", overflow:"hidden", transition:"border-color 0.2s",
            position:"relative",
          }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(201,168,76,0.7)"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(201,168,76,0.35)"}
          title="Clique para enviar imagem do personagem"
        >
          {form.avatar ? (
            <img src={form.avatar} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          ) : (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:32}}>🕵️</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:9,color:"var(--muted2)",letterSpacing:1,marginTop:4}}>FOTO</div>
            </div>
          )}
        </div>
        <div>
          <div style={{fontFamily:"Cinzel,serif",fontSize:13,color:"var(--gold)",marginBottom:4}}>Imagem do Personagem</div>
          <div style={{fontFamily:"Crimson Pro,serif",fontSize:13,color:"var(--muted2)",marginBottom:10}}>
            Clique no quadro para enviar uma foto ou ilustração do seu agente.
          </div>
          <div style={{display:"flex", flexWrap:"wrap", gap:8, alignItems:"center"}}>
            {form.avatar && (
              <button onClick={()=>setForm(f=>({...f,avatar:""}))} style={{
                background:"none", border:"1px solid rgba(255,255,255,0.12)", borderRadius:4,
                color:"var(--muted2)", cursor:"pointer", fontFamily:"Cinzel,serif",
                fontSize:10, letterSpacing:1, padding:"5px 12px",
              }}>Remover imagem</button>
            )}
            {aiArtEnabled && (
              <div>
                <button
                  onClick={() => setAiComingSoon(s => !s)}
                  style={{
                    background: aiComingSoon
                      ? "linear-gradient(135deg,#3b1f6a,#5b2d9e)"
                      : "linear-gradient(135deg,#2a1550,#4a2080)",
                    border:"1px solid #8b5cf660",
                    borderRadius:4, cursor:"pointer",
                    fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:1,
                    color:"#c4a0f5", padding:"5px 14px",
                    display:"flex", alignItems:"center", gap:6,
                    transition:"all 0.2s",
                  }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#8b5cf6"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#8b5cf660"}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Gerar com IA
                </button>
                {aiComingSoon && (
                  <div style={{
                    marginTop:8, padding:"10px 14px",
                    background:"rgba(139,92,246,0.08)", border:"1px solid rgba(139,92,246,0.25)",
                    borderRadius:6, maxWidth:260,
                  }}>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:1,color:"#8b5cf6",marginBottom:4}}>✦ EM DESENVOLVIMENTO</div>
                    <div style={{fontFamily:"Crimson Pro,serif",fontSize:13,color:"var(--muted2)",lineHeight:1.5}}>
                      Integração Higgsfield chegando em breve. Você poderá descrever seu agente e gerar um retrato com IA.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <div>
          <label style={S.label}>Personagem</label>
          <input value={form.personagem} onChange={e=>setForm(f=>({...f,personagem:e.target.value}))} placeholder="Nome do personagem"/>
        </div>
        <div>
          <label style={S.label}>Jogador</label>
          <input value={form.jogador} onChange={e=>setForm(f=>({...f,jogador:e.target.value}))} placeholder="Nome do jogador"/>
        </div>
      </div>
      <div>
        <label style={S.label}>Aparência</label>
        <textarea value={form.aparencia} onChange={e=>setForm(f=>({...f,aparencia:e.target.value}))} placeholder="Nome, gênero, idade, descrição física..." rows={4} style={{resize:"vertical"}}/>
      </div>
      <div>
        <label style={S.label}>Personalidade</label>
        <textarea value={form.personalidade} onChange={e=>setForm(f=>({...f,personalidade:e.target.value}))} placeholder="Traços marcantes, opiniões, ideais..." rows={4} style={{resize:"vertical"}}/>
      </div>
      <div>
        <label style={S.label}>Histórico</label>
        <textarea value={form.historico} onChange={e=>setForm(f=>({...f,historico:e.target.value}))} placeholder="Infância, relação com a família, contato com o Paranormal, eventos bons e ruins..." rows={4} style={{resize:"vertical"}}/>
      </div>
      <div>
        <label style={S.label}>Objetivo</label>
        <textarea value={form.objetivo} onChange={e=>setForm(f=>({...f,objetivo:e.target.value}))} placeholder="Por que ele faz parte da Ordem? Por que luta contra o Outro Lado?" rows={3} style={{resize:"vertical"}}/>
      </div>
    </div>
  );

  const canNext = [
    pontosRestantes === 0,
    origem !== null,
    classe !== null,
    true,
  ][step];

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", overflowY:"auto" }}>
      {/* Header */}
      <div style={{
        padding:"18px 32px", borderBottom:"1px solid var(--border2)",
        display:"flex", alignItems:"center", gap:16,
        background:"rgba(8,8,8,0.97)", backdropFilter:"blur(10px)",
        position:"sticky", top:0, zIndex:50,
      }}>
        <NexusLogo size={28}/>
        <div style={{fontFamily:"Cinzel,serif", fontSize:13, color:"var(--gold2)", letterSpacing:1}}>Nova Ficha de Agente</div>
        <div style={{height:1, flex:1, background:"var(--border2)"}}/>
        <span style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"#d870f8", textTransform:"uppercase", textShadow:"0 0 10px rgba(180,50,220,0.7)"}}>
          🌀 Ordem Paranormal · 2ª Ed.
        </span>
        <button onClick={onCancel} style={{background:"none", border:"1px solid var(--border2)", borderRadius:4, color:"var(--muted2)", cursor:"pointer", fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, textTransform:"uppercase", padding:"6px 14px", transition:"all 0.2s"}}
          onMouseEnter={e=>{e.currentTarget.style.color="var(--gold)";e.currentTarget.style.borderColor="var(--gold)";}}
          onMouseLeave={e=>{e.currentTarget.style.color="var(--muted2)";e.currentTarget.style.borderColor="var(--border2)";}}
        >Cancelar</button>
      </div>

      <div style={{maxWidth:900, margin:"0 auto", padding:"40px 28px"}}>
        <StepBar current={step}/>

        {/* Step content */}
        <div style={{marginBottom:32}}>
          {step===0 && <StepAtributos/>}
          {step===1 && <StepOrigem/>}
          {step===2 && <StepClasse/>}
          {step===3 && renderStepFinal()}
        </div>

        {/* Navigation */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:24, borderTop:"1px solid var(--border)"}}>
          <button onClick={()=>step>0&&setStep(s=>s-1)} style={{
            background:"none", border:"1px solid var(--border)", borderRadius:4,
            color: step>0?"var(--muted2)":"var(--muted)", cursor: step>0?"pointer":"not-allowed",
            fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:2, textTransform:"uppercase", padding:"10px 20px",
            opacity: step>0?1:0.3,
          }}>← Voltar</button>

          <div style={{display:"flex", gap:8}}>
            {[0,1,2,3].map(i=>(
              <div key={i} style={{width:i===step?20:6,height:6,borderRadius:3,background:i<=step?"var(--gold)":"rgba(201,168,76,0.2)",transition:"all 0.3s"}}/>
            ))}
          </div>

          {step < 3 ? (
            <button onClick={()=>canNext&&setStep(s=>s+1)} className={canNext?"btn-gold":""} style={!canNext?{
              background:"rgba(201,168,76,0.05)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:4,
              color:"var(--muted)", cursor:"not-allowed", fontFamily:"Cinzel,serif", fontSize:10,
              letterSpacing:2, textTransform:"uppercase", padding:"10px 24px",
            }:{}}>
              Próximo →
            </button>
          ) : (
            <button className="btn-gold" onClick={()=>{ if(form.personagem) onFinish({attrs,origem,classe,form}); }}
              style={{opacity: form.personagem?1:0.4, cursor:form.personagem?"pointer":"not-allowed"}}>
              Criar Agente ✦
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CharacterCreator;
