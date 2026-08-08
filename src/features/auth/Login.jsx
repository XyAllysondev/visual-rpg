import { useState } from "react";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider,
  sendPasswordResetEmail, updateProfile,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from "firebase/auth";
import { auth } from "../../firebase";
import NexusLogo from "../../lib/NexusLogo";
import AmbientBackdrop from "../../ui/AmbientBackdrop";
import Deco from "../../ui/Deco";
import NexusSigilRing from "../../ui/NexusSigilRing";
import NexusQuote from "../../ui/NexusQuote";

/* Autenticação (spec 0031, onda D). Saiu do App.jsx porque é FEATURE, não casca: tem
 * fluxo próprio (entrar / criar conta / recuperar senha / Google), decide a persistência
 * da sessão e traduz os códigos de erro do Firebase para português. A casca que ela
 * monta em volta (névoa, ornamentos, anel do sigilo, citações) vem de `src/ui/`. */
const googleProvider = new GoogleAuthProvider();

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(() => localStorage.getItem("nx_keep") !== "0");
  const [showPass, setShowPass] = useState(false);

  const applyPersistence = () => {
    const persistence = keepLoggedIn ? browserLocalPersistence : browserSessionPersistence;
    localStorage.setItem("nx_keep", keepLoggedIn ? "1" : "0");
    return setPersistence(auth, persistence);
  };

  const friendlyError = (code) => {
    if (["auth/invalid-credential","auth/wrong-password","auth/user-not-found","auth/invalid-login-credentials"].includes(code))
      return "E-mail ou senha incorretos.";
    if (code === "auth/email-already-in-use") return "Este e-mail já está em uso.";
    if (code === "auth/weak-password") return "Senha muito fraca (mínimo 6 caracteres).";
    if (code === "auth/invalid-email") return "E-mail inválido.";
    if (code === "auth/too-many-requests") return "Muitas tentativas. Tente novamente mais tarde.";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Login com Google cancelado.";
    if (code === "auth/network-request-failed") return "Erro de conexão. Verifique sua internet.";
    return "Ocorreu um erro. Tente novamente.";
  };

  const handle = async () => {
    setError("");
    if (!email || !pass) return;
    setLoading(true);
    try {
      await applyPersistence();
      if (tab === "login") {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        if (name) await updateProfile(cred.user, { displayName: name });
      }
      onLogin();
    } catch (e) {
      console.error("auth error:", e.code, e.message);
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await applyPersistence();
      await signInWithPopup(auth, googleProvider);
      onLogin();
    } catch (e) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError("Digite seu e-mail para recuperar a senha."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError("");
    } catch (e) {
      setError(friendlyError(e.code));
    }
  };

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)", position:"relative", overflow:"hidden"}}>
      <AmbientBackdrop />
      <Deco />

      <div className="login-layout">

        {/* ── LEFT PANEL (desktop only) ── */}
        <div className="login-left">
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 60% 50%,rgba(201,168,76,0.07) 0%,transparent 65%)",pointerEvents:"none"}}/>
          <div style={{position:"relative",zIndex:1}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
              <NexusSigilRing size={160}><NexusLogo size={160} /></NexusSigilRing>
            </div>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:38,fontWeight:700,
                background:"linear-gradient(135deg,#c9a84c,#e8c96d,#a07830)",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
                backgroundClip:"text",letterSpacing:8,marginBottom:10}}>⚔ NEXUS</div>
              <div style={{fontFamily:"Cinzel,serif",fontSize:10,letterSpacing:4,color:"var(--muted)",textTransform:"uppercase"}}>
                Sistemas de RPG · Inteligência Sobrenatural
              </div>
            </div>

            <div className="nx-stagger" style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {[
                {icon:"◈",title:"Fichas Digitais",desc:"Gerencie personagens com atributos, perícias e inventário completos"},
                {icon:"◉",title:"Ajudante do Mestre",desc:"Wiki do mundo, conexões, diário e ferramentas de mesa para suas campanhas"},
                {icon:"⬙",title:"Mapas Interativos",desc:"Crie e explore mapas colaborativos com sua mesa"},
                {icon:"♪",title:"Trilhas Sonoras",desc:"Atmosfera imersiva com músicas e ambientações para cada cena"},
              ].map(({icon,title,desc},i)=>(
                <div key={title} style={{display:"flex",gap:16,alignItems:"flex-start","--i":i}}>
                  <div style={{width:40,height:40,borderRadius:8,background:"rgba(201,168,76,0.08)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,color:"var(--gold)"}}>
                    {icon}
                  </div>
                  <div>
                    <div style={{fontFamily:"Cinzel,serif",fontSize:11,color:"var(--gold2)",letterSpacing:1,marginBottom:4}}>{title}</div>
                    <div style={{fontFamily:"Crimson Pro,serif",fontSize:14,color:"var(--muted2)",lineHeight:1.55}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <NexusQuote />
          </div>
        </div>

        {/* ── RIGHT PANEL (form) ── */}
        <div className="login-right">
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
            width:600,height:600,borderRadius:"50%",
            background:"radial-gradient(circle,rgba(201,168,76,0.04) 0%,transparent 70%)",
            pointerEvents:"none"}}/>

          <div className="fade login-card" style={{
            width:"100%", maxWidth:440,
            background:"var(--card)", border:"1px solid var(--border2)",
            borderRadius:12, padding:"44px 48px", position:"relative", zIndex:1,
            boxShadow:"0 0 60px rgba(201,168,76,0.08), 0 40px 80px rgba(0,0,0,0.55)",
            animation:"borderGlow 4s ease-in-out infinite",
          }}>
            {/* Logo block — hidden on desktop */}
            <div className="login-logo-mobile" style={{textAlign:"center", marginBottom:32}}>
              <div style={{display:"flex", justifyContent:"center", marginBottom:14, animation:"float 4s ease-in-out infinite"}}>
                <NexusSigilRing size={72}><NexusLogo size={72} /></NexusSigilRing>
              </div>
              <div style={{fontFamily:"'Cinzel Decorative',serif", fontSize:26, fontWeight:700,
                background:"linear-gradient(135deg,#c9a84c,#e8c96d,#a07830)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                backgroundClip:"text", letterSpacing:4, marginBottom:4}}>⚔ NEXUS</div>
              <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:4, color:"var(--muted)", textTransform:"uppercase"}}>
                Sistemas de RPG · Inteligência Sobrenatural
              </div>
            </div>

            {/* Tabs */}
            <div style={{display:"flex", borderBottom:"1px solid var(--border)", marginBottom:28}}>
              {["login","register"].map(t => (
                <button key={t} onClick={()=>setTab(t)} style={{
                  flex:1, padding:"10px 0", background:"none", border:"none", cursor:"pointer",
                  fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:2, textTransform:"uppercase",
                  color: tab===t?"var(--gold)":"var(--muted)",
                  borderBottom: tab===t?"2px solid var(--gold)":"2px solid transparent",
                  transition:"all 0.2s", marginBottom:-1,
                }}>{t==="login"?"Entrar":"Criar Conta"}</button>
              ))}
            </div>

            <div style={{display:"flex", flexDirection:"column", gap:14}}>
              {tab==="register" && (
                <div>
                  <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--muted2)", textTransform:"uppercase", marginBottom:7}}>Nome de Agente</div>
                  <div className="nx-field"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome ou codinome" /></div>
                </div>
              )}
              <div>
                <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--muted2)", textTransform:"uppercase", marginBottom:7}}>E-mail</div>
                <div className="nx-field"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="agente@ordo.com" onKeyDown={e=>e.key==="Enter"&&handle()} /></div>
              </div>
              <div>
                <div style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:2, color:"var(--muted2)", textTransform:"uppercase", marginBottom:7}}>Senha</div>
                <div className="nx-field" style={{position:"relative"}}>
                  <input type={showPass?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handle()} style={{paddingRight:42,width:"100%"}} />
                  <button type="button" onClick={()=>setShowPass(v=>!v)} aria-label={showPass?"Ocultar senha":"Mostrar senha"} style={{
                    position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                    background:"none", border:"none", cursor:"pointer", padding:4,
                    color:"var(--muted)", display:"flex", alignItems:"center", lineHeight:1,
                  }}>
                    {showPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {tab==="login" && (
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <label htmlFor="keep-logged-in" style={{display:"flex", alignItems:"center", gap:7, cursor:"pointer", userSelect:"none"}}>
                    <input type="checkbox" id="keep-logged-in" checked={keepLoggedIn} onChange={e=>setKeepLoggedIn(e.target.checked)}
                      style={{position:"absolute", opacity:0, width:0, height:0}} />
                    <div style={{
                      width:16, height:16, borderRadius:3, border:"1.5px solid",
                      borderColor: keepLoggedIn ? "var(--gold)" : "var(--border2)",
                      background: keepLoggedIn ? "rgba(201,168,76,0.15)" : "transparent",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      flexShrink:0, transition:"all 0.15s",
                    }}>
                      {keepLoggedIn && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 3.5L4 6.5L9 1" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{fontFamily:"Cinzel,serif", fontSize:10, letterSpacing:1, color: keepLoggedIn ? "var(--gold2)" : "var(--muted2)"}}>Manter conectado</span>
                  </label>
                  <span onClick={handleReset} style={{fontFamily:"Cinzel,serif", fontSize:9, letterSpacing:1, color:"var(--muted)", cursor:"pointer", textDecoration:"underline"}}>Esqueci minha senha</span>
                </div>
              )}
              {resetSent && <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#7aad6e",textAlign:"center"}}>E-mail de recuperação enviado!</div>}
              {error && <div style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#c96a6a",textAlign:"center"}}>{error}</div>}
              <button className="btn-gold nx-shimmer" onClick={handle} disabled={loading} style={{marginTop:8, width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8}}>
                {loading ? (
                  <div style={{width:16,height:16,border:"2px solid rgba(0,0,0,0.3)",borderTopColor:"#050505",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
                ) : (tab==="login"?"Acessar o Nexus":"Registrar Agente")}
              </button>
              <div style={{display:"flex", gap:10, alignItems:"center", margin:"4px 0"}}>
                <div style={{flex:1, height:1, background:"var(--border)"}}/><span style={{fontFamily:"Cinzel,serif", fontSize:9, color:"var(--muted)"}}>ou</span><div style={{flex:1, height:1, background:"var(--border)"}}/>
              </div>
              <button className="btn-ghost" onClick={handleGoogle} disabled={loading} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continuar com Google
              </button>
              {tab==="login" && (
                <p style={{textAlign:"center",fontFamily:"Cinzel,serif",fontSize:10,color:"var(--muted)",marginTop:4}}>
                  Não tem conta?{" "}
                  <span onClick={()=>setTab("register")} style={{color:"var(--gold)",cursor:"pointer",textDecoration:"underline"}}>
                    Crie uma agora
                  </span>
                </p>
              )}
            </div>

            {/* Quote — hidden on desktop */}
            <div className="login-quote-mobile">
              <NexusQuote />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Login;
