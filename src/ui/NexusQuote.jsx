import { useState, useEffect } from "react";

/* Bloco de citação rotativa do login (spec 0031, onda D). Saiu do App.jsx junto com a
 * tela de `Login`, que o monta DUAS vezes: no painel esquerdo (desktop) e dentro do
 * cartão do formulário (mobile). É casca decorativa, sem regra de negócio — por isso
 * `src/ui/` e não `features/auth/` (AC-3). */
const NEXUS_QUOTES = [
  { text: "O Outro Lado sempre existiu. Agora você tem as ferramentas para enfrentá-lo.", author: "Nexus · Protocolo de Iniciação" },
  { text: "Cada ficha é um agente. Cada agente carrega o peso do que não pode ser esquecido.", author: "Nexus · Arquivo 001" },
  { text: "A névoa não some — você apenas aprende a caminhar através dela.", author: "Nexus · Manual do Mestre" },
  { text: "Nenhuma sessão é igual. Nenhum horror se repete da mesma forma. Esteja preparado.", author: "Nexus · Diretriz de Campo" },
  { text: "O sistema não joga por você. Ele apenas garante que você não enfrente o escuro sozinho.", author: "Nexus · Fundação" },
  { text: "Conhecimento é a única proteção real. Documente tudo. Esqueça nada.", author: "Nexus · Protocolo Ordo" },
  { text: "Entre agentes, o silêncio é tão importante quanto a narração.", author: "Nexus · Código de Mesa" },
];

function NexusQuote() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * NEXUS_QUOTES.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % NEXUS_QUOTES.length);
        setVisible(true);
      }, 600);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const q = NEXUS_QUOTES[idx];

  return (
    <div style={{
      marginTop: 28,
      position: "relative",
    }}>
      {/* Divider ornament */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <div style={{ flex:1, height:"1px", background:"linear-gradient(to right, transparent, rgba(201,168,76,0.3))" }} />
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          <div style={{ width:3, height:3, borderRadius:"50%", background:"var(--gold)", opacity:0.4 }} />
          <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--gold)", opacity:0.7 }} />
          <div style={{ width:3, height:3, borderRadius:"50%", background:"var(--gold)", opacity:0.4 }} />
        </div>
        <div style={{ flex:1, height:"1px", background:"linear-gradient(to left, transparent, rgba(201,168,76,0.3))" }} />
      </div>

      {/* Quote block */}
      <div style={{
        position:"relative",
        padding:"20px 24px",
        background:"linear-gradient(135deg, rgba(201,168,76,0.04), rgba(201,168,76,0.02))",
        border:"1px solid rgba(201,168,76,0.15)",
        borderLeft:"3px solid rgba(201,168,76,0.5)",
        borderRadius:"0 8px 8px 0",
        transition:"opacity 0.5s ease",
        opacity: visible ? 1 : 0,
        minHeight: 90,
      }}>
        {/* Quote icon */}
        <div style={{
          position:"absolute", top:-10, left:16,
          fontFamily:"'Cinzel Decorative',serif", fontSize:28,
          color:"var(--gold)", opacity:0.3, lineHeight:1,
          pointerEvents:"none", userSelect:"none",
        }}>"</div>

        <p style={{
          fontFamily:"Crimson Pro,serif", fontSize:15, fontStyle:"italic",
          color:"var(--text)", lineHeight:1.75, margin:"0 0 10px",
          paddingLeft:8,
        }}>{q.text}</p>

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:16, height:"1px", background:"rgba(201,168,76,0.4)" }} />
          <span style={{
            fontFamily:"Cinzel,serif", fontSize:8, letterSpacing:2,
            color:"var(--gold)", textTransform:"uppercase", opacity:0.7,
          }}>{q.author}</span>
        </div>

        {/* Progress dots */}
        <div style={{ display:"flex", gap:5, justifyContent:"center", marginTop:14 }}>
          {NEXUS_QUOTES.map((_,i) => (
            <div key={i} className={i===idx ? "nx-progress-dot" : ""} onClick={() => { setVisible(false); setTimeout(()=>{ setIdx(i); setVisible(true); },300); }}
              style={{
                width: i===idx ? 16 : 5, height:5, borderRadius:3,
                background: i===idx ? "rgba(201,168,76,0.25)" : "rgba(201,168,76,0.2)",
                transition:"all 0.4s ease", cursor:"pointer",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default NexusQuote;
export { NEXUS_QUOTES };
