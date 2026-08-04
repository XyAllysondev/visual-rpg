import NexusLogo from "../lib/NexusLogo";
import LicencaOP from "../components/LicencaOP";
import FooterDivider from "./FooterDivider";

const AppFooter = ({ system }) => (
  <div className="nexus-footer" style={{
    borderTop:"1px solid var(--border2)", padding:"12px 24px",
    display:"flex", alignItems:"center", columnGap:18, rowGap:10, flexWrap:"wrap",
    background:"rgba(6,6,6,0.72)",
  }}>
    <div style={{display:"flex", gap:10, alignItems:"center", flexShrink:0}}>
      <NexusLogo size={18}/>
      <span style={{
        fontFamily:"var(--font-title,'Cinzel'),serif", fontSize:11, fontWeight:600,
        letterSpacing:"0.14em", color:"var(--muted2)", textTransform:"uppercase",
        whiteSpace:"nowrap",
      }}>Nexus RPG · v0.1 Beta</span>
    </div>
    {system?.id === "op" && (
      <>
        <FooterDivider/>
        <LicencaOP variant="footer" style={{ flex:"1 1 300px", minWidth:0 }}/>
      </>
    )}
    <div style={{marginLeft:"auto", display:"flex", gap:2, alignItems:"center", flexShrink:0}}>
      {[
        {label:"Suporte", icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>},
        {label:"Discord", icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.045.03.06a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>},
        {label:"Changelog", icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>},
      ].map(({label,icon})=>(
        <span key={label} style={{
          fontFamily:"var(--font-body,'Inter'),sans-serif", fontSize:11, fontWeight:500,
          letterSpacing:"0.07em", color:"var(--muted2)",
          cursor:"pointer", textTransform:"uppercase", whiteSpace:"nowrap",
          display:"flex", alignItems:"center", gap:7,
          padding:"7px 12px", borderRadius:6,
          border:"1px solid transparent",
          transition:"color .18s ease, border-color .18s ease, background .18s ease",
        }}
          onMouseEnter={e=>{e.currentTarget.style.color="var(--gold)";e.currentTarget.style.borderColor="rgba(201,168,76,0.3)";e.currentTarget.style.background="rgba(201,168,76,0.08)";}}
          onMouseLeave={e=>{e.currentTarget.style.color="var(--muted2)";e.currentTarget.style.borderColor="transparent";e.currentTarget.style.background="none";}}
        >
          {icon}{label}
        </span>
      ))}
    </div>
  </div>
);

export default AppFooter;
