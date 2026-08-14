import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { resizeCoverImage } from "./campanhaHelpers";

function CoverPreviewModal({ image: initialImage, onConfirm, onClose }) {
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const lastMouse = useRef({ x: 0, y: 0 });

  const [image, setImage] = useState(initialImage);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imgNatural, setImgNatural] = useState({ w: 640, h: 420 });
  const [contSize, setContSize] = useState({ w: 540, h: 304 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, [image]);

  useEffect(() => { setZoom(1); setPos({ x: 0, y: 0 }); }, [image]);

  const baseScale = imgNatural.w > 0
    ? Math.max(contSize.w / imgNatural.w, contSize.h / imgNatural.h)
    : 1;
  const totalScale = baseScale * zoom;

  const clamp = (x, y, scale) => {
    const hw = Math.max(0, (imgNatural.w * scale - contSize.w) / 2);
    const hh = Math.max(0, (imgNatural.h * scale - contSize.h) / 2);
    return { x: Math.max(-hw, Math.min(hw, x)), y: Math.max(-hh, Math.min(hh, y)) };
  };

  const onImgLoad = (e) => setImgNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight });

  const onMouseDown = (e) => { e.preventDefault(); setIsDragging(true); lastMouse.current = { x: e.clientX, y: e.clientY }; };
  const onMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPos(prev => clamp(prev.x + dx, prev.y + dy, totalScale));
  };
  const onMouseUp = () => setIsDragging(false);

  const onTouchStart = (e) => { if (e.touches.length===1) { setIsDragging(true); lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } };
  const onTouchMove = (e) => {
    if (!isDragging || e.touches.length!==1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - lastMouse.current.x;
    const dy = e.touches[0].clientY - lastMouse.current.y;
    lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setPos(prev => clamp(prev.x + dx, prev.y + dy, totalScale));
  };

  const onZoom = (v) => { setZoom(v); setPos(prev => clamp(prev.x, prev.y, baseScale * v)); };

  const handleConfirm = () => {
    const OUT_W = 640, OUT_H = 360;
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W; canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      const sx = OUT_W / contSize.w, sy = OUT_H / contSize.h;
      ctx.translate(OUT_W/2 + pos.x * sx, OUT_H/2 + pos.y * sy);
      ctx.scale(totalScale * sx, totalScale * sy);
      ctx.drawImage(img, -img.naturalWidth/2, -img.naturalHeight/2);
      onConfirm(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = image;
  };

  const handleNewFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try { setImage(await resizeCoverImage(file)); } catch(_) {}
    e.target.value = "";
  };

  return createPortal(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.62)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--card2)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,width:"100%",maxWidth:600,overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,0.55)"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <span style={{fontFamily:"Cinzel,serif",fontSize:11,letterSpacing:"0.12em",color:"#ccc",textTransform:"uppercase"}}>Ajustar Imagem de Capa</span>
          <span onClick={onClose} style={{cursor:"pointer",opacity:0.45,fontSize:20,color:"#fff",lineHeight:1}}>×</span>
        </div>

        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {/* Crop area */}
          <div
            ref={containerRef}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}
            style={{width:"100%",aspectRatio:"16/9",overflow:"hidden",position:"relative",
              borderRadius:8,background:"#000",cursor:isDragging?"grabbing":"grab",userSelect:"none"}}>
            <img
              src={image} alt="" onLoad={onImgLoad} draggable={false}
              style={{position:"absolute",left:"50%",top:"50%",maxWidth:"none",pointerEvents:"none",userSelect:"none",
                transform:`translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${totalScale})`,
                transformOrigin:"center center"}}
            />
            <div style={{position:"absolute",inset:0,border:"2px solid rgba(176,48,216,0.4)",borderRadius:8,pointerEvents:"none"}}/>
          </div>

          {/* Zoom */}
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#888",letterSpacing:"0.06em",minWidth:36,textTransform:"uppercase"}}>Zoom</span>
            <input type="range" min={1} max={3} step={0.02} value={zoom}
              onChange={e=>onZoom(+e.target.value)}
              style={{flex:1,accentColor:"#9333ea",cursor:"pointer"}}/>
            <span style={{fontFamily:"Cinzel,serif",fontSize:10,color:"#888",minWidth:36,textAlign:"right"}}>{Math.round(zoom*100)}%</span>
          </div>
          <div style={{fontFamily:"'Crimson Pro',serif",fontSize:13,color:"#666",textAlign:"center",fontStyle:"italic"}}>
            Arraste para reposicionar · Use o slider para ajustar o zoom
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <button onClick={()=>fileInputRef.current?.click()}
            style={{background:"none",border:"none",color:"#999",fontFamily:"Cinzel,serif",fontSize:11,cursor:"pointer",letterSpacing:"0.05em",padding:0,textDecoration:"underline",textUnderlineOffset:3}}>
            Escolher outra imagem
          </button>
          <button onClick={handleConfirm}
            style={{background:"#9333ea",border:"none",color:"#fff",fontFamily:"Cinzel,serif",fontSize:12,fontWeight:700,letterSpacing:"0.08em",padding:"10px 28px",borderRadius:8,cursor:"pointer"}}>
            Confirmar
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleNewFile}/>
      </div>
    </div>
  , document.body);
}

export default CoverPreviewModal;
