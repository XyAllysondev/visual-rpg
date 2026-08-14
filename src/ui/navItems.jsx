import RuneIco from "./RuneIco";

/* Itens do menu principal — a MESMA lista alimenta o `Sidebar` (desktop) e o
 * `MobileBottomNav` (que fatia os 6 primeiros). Por isso mora num módulo próprio e é
 * importada dos dois lados: copiar era o modo de falha registrado no AC-7 da spec 0031.
 * O rótulo em `label` é só fallback de leitura — quem renderiza usa `t("nav."+id)`. */
const navItems = [
  { id:"dashboard", label:"Painel",
    svg: (
      <RuneIco>
        {/* Olho da Ordem — all-seeing eye */}
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
        <circle cx="12" cy="12" r="3"/>
        <line x1="12" y1="2" x2="12" y2="5"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
      </RuneIco>
    )},
  { id:"sheet", label:"Fichas",
    svg: (
      <RuneIco>
        {/* Códex arcano — twin-tome with glyphs */}
        <path d="M2 4a2 2 0 0 1 2-2h6v20H4a2 2 0 0 1-2-2V4z"/>
        <path d="M22 4a2 2 0 0 0-2-2h-6v20h6a2 2 0 0 0 2-2V4z"/>
        <line x1="10" y1="2" x2="10" y2="22"/>
        <path d="M5.5 9l2 2-2 2"/>
        <line x1="14" y1="9" x2="18" y2="9"/>
        <line x1="14" y1="14" x2="18" y2="14"/>
      </RuneIco>
    )},
  { id:"map", label:"Mapas",
    svg: (
      <RuneIco>
        {/* Compasso proibido — 8-pointed star in circle */}
        <circle cx="12" cy="12" r="9"/>
        <polygon points="12,5 13.8,10.2 19,12 13.8,13.8 12,19 10.2,13.8 5,12 10.2,10.2"/>
      </RuneIco>
    )},
  { id:"master", label:"Ajudante do Mestre",
    svg: (
      <RuneIco>
        {/* Varinha do Ritual — wand with arcane sparks */}
        <line x1="6" y1="20" x2="18" y2="8"/>
        <path d="M14 4l2 2-8 8-2-2z"/>
        <line x1="10" y1="2" x2="10" y2="5"/>
        <line x1="14" y1="1" x2="16" y2="3"/>
        <line x1="2" y1="10" x2="5" y2="10"/>
        <line x1="1" y1="14" x2="3" y2="16"/>
        <circle cx="5.5" cy="18.5" r="2"/>
      </RuneIco>
    )},
  { id:"music", label:"Trilhas",
    svg: (
      <RuneIco>
        {/* Vórtice Sonoro — spiral frequency rune */}
        <path d="M12 21c4.97 0 9-4.03 9-9S16.97 3 12 3 3 7.03 3 12"/>
        <path d="M12 17c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5"/>
        <circle cx="12" cy="12" r="2"/>
        <line x1="3" y1="12" x2="7" y2="15"/>
        <line x1="3" y1="12" x2="7" y2="9"/>
      </RuneIco>
    )},
  { id:"party", label:"Campanhas",
    svg: (
      <RuneIco>
        {/* Círculos do Coven — three interlocked rings */}
        <circle cx="9" cy="9" r="4.5"/>
        <circle cx="15" cy="9" r="4.5"/>
        <circle cx="12" cy="15.5" r="4.5"/>
      </RuneIco>
    )},
  { id:"roadmap", label:"Roadmap",
    svg: (
      <RuneIco>
        {/* Profecia — scroll with inner sigil */}
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6"/>
        <polygon points="12,10 14,13 12,16 10,13"/>
        <line x1="8" y1="13" x2="10" y2="13"/>
        <line x1="14" y1="13" x2="16" y2="13"/>
      </RuneIco>
    )},
  { id:"planos", label:"Planos",
    svg: (
      <RuneIco>
        {/* Grimório Selado — nested diamonds */}
        <polygon points="12,2 22,12 12,22 2,12"/>
        <polygon points="12,6 18,12 12,18 6,12"/>
        <circle cx="12" cy="12" r="1.8"/>
      </RuneIco>
    )},
];

export default navItems;
