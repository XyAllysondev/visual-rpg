/* ─── DECORATIVE LINES ─── */
const Deco = () => (
  <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:"50%",width:1,height:"100%",background:"linear-gradient(to bottom,transparent,rgba(201,168,76,0.05),transparent)"}}/>
    <div style={{position:"absolute",top:"50%",left:0,width:"100%",height:1,background:"linear-gradient(to right,transparent,rgba(201,168,76,0.04),transparent)"}}/>
    {/* Corner ornaments */}
    {[["top:0,left:0","0,0,20,0 0,0 0,20"],["top:0,right:0","100,0 80,0 100,0 100,20"],["bottom:0,left:0","0,100 20,100 0,100 0,80"],["bottom:0,right:0","100,100 80,100 100,100 100,80"]].map(([pos],i)=>(
      <div key={i} style={{position:"absolute",...Object.fromEntries(pos.split(",").map(p=>p.split(":"))),width:40,height:40}}>
        <svg width="40" height="40" viewBox="0 0 40 40"><polyline points={["0,0 20,0 0,0 0,20","40,0 20,0 40,0 40,20","0,40 20,40 0,40 0,20","40,40 20,40 40,40 40,20"][i]} fill="none" stroke="rgba(201,168,76,0.2)" strokeWidth="1"/></svg>
      </div>
    ))}
  </div>
);

export default Deco;
