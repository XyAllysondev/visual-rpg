/* Logo do Nexus. Saiu do App.jsx (spec 0031, onda C) porque é usado por telas de DOIS
   contextos: App (login, sidebar, seleção de sistema, rodapé) e ficha (criador de
   personagem, visão pública). */

/* ─── LOGO IMAGE — NEXUS N ─── */
const NexusLogo = ({ size = 40, animate = false }) => (
  <img
    src="/Logo Nexus.jpg"
    alt="Nexus RPG"
    width={size}
    height={size}
    className={animate ? "logo-float" : ""}
    style={{ display:"block", objectFit:"contain" }}
  />
);

export default NexusLogo;
