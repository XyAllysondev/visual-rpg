import { SYSTEM_THEMES, getCardAccent } from "../../themes";
import OPEnergyIcon from "./OPEnergyIcon";
import DnDDemonIcon from "./DnDDemonIcon";

const SYSTEMS = [
  {
    id: "op",
    name: "Ordem Paranormal",
    subtitle: "Ordem Paranormal",
    icon: null,
    emblem: "/assets/higgsfield/img/emblem-op.webp",
    idle: "/assets/higgsfield/video/idle-op",
    svgIcon: (glow) => <OPEnergyIcon size={48} glow={glow} />,
    desc: "Enfrente o Outro Lado. Investigue o inexplicável. Sobreviva ao horror sobrenatural.",
    tags: ["Terror","Investigação","Sobrenatural"],
    /* accent derived from theme registry — see getCardAccent overlay below (spec 0017 AC-6) */
    available: true,
  },
  {
    id: "dnd",
    name: "Dungeons & Dragons",
    subtitle: "5ª Edição",
    icon: null,
    emblem: "/assets/higgsfield/img/emblem-dnd.webp",
    idle: "/assets/higgsfield/video/idle-dnd",
    svgIcon: (glow) => <DnDDemonIcon size={48} glow={glow} />,
    desc: "A aventura épica de fantasia mais jogada do mundo. Masmorras, dragões e heróis lendários.",
    tags: ["Fantasia","Combate","Épico"],
    /* accent derived from theme registry (dragon red) — getCardAccent overlay (spec 0017 AC-6) */
    available: false,   // decisão do Andre (2026-07-25): fica em "EM BREVE" até liberar
  },
  {
    id: "tormenta",
    name: "Tormenta 20",
    subtitle: "Sistema Nacional",
    icon: null,
    emblem: "/assets/higgsfield/img/emblem-tormenta.webp",
    idle: "/assets/higgsfield/video/idle-tormenta",
    svgIcon: (glow) => <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" fill={glow?"rgba(210,100,30,0.18)":"rgba(210,100,30,0.08)"} stroke={glow?"#e8622a":"#c45520"} strokeWidth={glow?2:1.5}/><path d="M24 10 L28 20 L38 20 L30 27 L33 37 L24 31 L15 37 L18 27 L10 20 L20 20 Z" fill={glow?"rgba(232,98,42,0.5)":"rgba(196,85,32,0.35)"} stroke={glow?"#ff8c42":"#e8622a"} strokeWidth="1.2"/></svg>,
    desc: "O maior RPG nacional. Fantasia épica com heróis, deuses e a sombra da Tormenta sobre Arton.",
    tags: ["Fantasia","Épico","Nacional"],
    /* accent derived from theme registry (verdant green) — getCardAccent overlay (spec 0017 AC-6) */
    available: false,   // decisão do Andre (2026-07-25): fica em "EM BREVE" até liberar
  },
  {
    id: "3det",
    name: "3D&T Alpha",
    subtitle: "Sistema Nacional",
    icon: "🎌",
    desc: "O clássico sistema brasileiro inspirado em anime e mangá. Simples, rápido e cheio de estilo.",
    tags: ["Anime","Ação","Nacional"],
    accent: "#7a4fa0",
    accentText: "#b87ee0",
    accentGlow: "rgba(122,79,160,0.25)",
    available: true,
    hidden: true,
  },
  {
    id: "call",
    name: "Call of Cthulhu",
    subtitle: "7ª Edição",
    icon: "🐙",
    desc: "Mergulhe na ficção lovecraftiana. Investigadores frágeis contra horrores cósmicos indescritíveis.",
    tags: ["Lovecraft","Horror","Investigação"],
    accent: "#3a6e5a",
    accentText: "#5ec4a0",
    accentGlow: "rgba(58,110,90,0.25)",
    available: false,
    hidden: true,
  },
  {
    id: "vampire",
    name: "Vampire: The Masquerade",
    subtitle: "5ª Edição",
    icon: "🩸",
    desc: "Política, traição e sobrevivência entre as trevas eternas da noite. Você é a criatura das sombras.",
    tags: ["Vampiro","Político","Dark"],
    accent: "#6b1a1a",
    accentText: "#d04545",
    accentGlow: "rgba(107,26,26,0.25)",
    available: false,
    hidden: true,
  },
  {
    id: "custom",
    name: "Sistema Personalizado",
    subtitle: "Em Breve",
    icon: "⚙️",
    desc: "Crie seu próprio sistema do zero. Defina atributos, mecânicas e regras como quiser.",
    tags: ["Custom","Livre","Beta"],
    accent: "#5a5a3a",
    accentText: "#a8a870",
    accentGlow: "rgba(90,90,58,0.2)",
    available: false,
    hidden: true,
  },
]
  /* `hidden` tira o card da vitrine sem apagar a definição (decisão do Andre
   * 2026-07-25: "o resto pode sumir POR ENQUANTO"). Voltar é remover a flag.
   * `available:false` continua sendo o gate de ENTRADA — ver handleSelect e a
   * restauração de `nexus_system`.
   *
   * AC-6: for every system that has a theme in the registry, its card accent is
   * DERIVED from that same registry (single source of truth) — killing the old
   * divergence (D&D card was blue, theme red). Systems without a theme yet
   * (3D&T, Call, Vampire, Custom) keep their literal accent until themed. */
  .map((s) => (SYSTEM_THEMES[s.id] ? { ...s, ...getCardAccent(s.id) } : s));

export { SYSTEMS };
export default SYSTEMS;
