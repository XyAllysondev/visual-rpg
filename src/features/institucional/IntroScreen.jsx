import { useState, useRef } from "react";

export default function IntroScreen({ onDone }) {
  const [fading, setFading] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const finish = useRef(() => {
    setFading(true);
    setTimeout(() => doneRef.current(), 700);
  }).current;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "#000",
      opacity: fading ? 0 : 1,
      transition: "opacity 0.7s ease",
      pointerEvents: fading ? "none" : "auto",
    }}>
      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finish}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      >
        <source src="/intro.mp4" type="video/mp4" />
      </video>
      <span
        onClick={finish}
        style={{
          position: "absolute", bottom: 28, right: 28, zIndex: 2,
          fontFamily: "Cinzel, serif", fontSize: 11, letterSpacing: 2,
          textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
          cursor: "pointer", userSelect: "none",
          transition: "color 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.9)"}
        onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
      >
        Toque para pular
      </span>
    </div>
  );
}
