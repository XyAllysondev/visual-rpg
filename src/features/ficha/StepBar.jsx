
/* ── Step progress bar ── */
const StepBar = ({ current }) => {
  const steps = ["Atributos","Origem","Classe","Toques Finais"];
  return (
    <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:0, marginBottom:36}}>
      {steps.map((s,i)=>(
        <div key={s} style={{display:"flex", alignItems:"center"}}>
          <div style={{
            fontFamily:"Cinzel,serif", fontSize:12, letterSpacing:1.5,
            color: i===current?"var(--gold)":i<current?"var(--muted2)":"var(--muted)",
            fontWeight: i===current?"600":"400",
            borderBottom: i===current?"2px solid var(--gold)":"2px solid transparent",
            paddingBottom:4, transition:"all 0.3s",
          }}>{s}</div>
          {i<steps.length-1 && (
            <div style={{width:50,height:1,margin:"0 14px",background:i<current?"rgba(201,168,76,0.5)":"rgba(201,168,76,0.15)"}}/>
          )}
        </div>
      ))}
    </div>
  );
};

export default StepBar;
