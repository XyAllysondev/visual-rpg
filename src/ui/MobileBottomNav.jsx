import { useLocale } from "../i18n/useLocale";
import { useSlidingPill } from "../hooks/useSlidingPill";
import SlidingTabPill from "../components/SlidingTabPill";
import { useViewportWidth } from "../lib/useViewport";
import navItems from "./navItems";

/* Barra de navegação inferior do mobile (spec 0031, onda D). Casca pura: recebe a tela
 * ativa e o callback de navegação por PROPS, como já era dentro do App (AC-4 — nenhum
 * Context ou store global foi introduzido nesta migração). */
function MobileBottomNav({ active, onNav }) {
  const { t } = useLocale();
  const items = navItems.slice(0, 6);
  // Shared-layout pill (paridade com o Sidebar desktop, spec 0017 AC-4): um único
  // realce desliza horizontalmente até o item ativo, em vez de cada botão acender/
  // apagar de golpe. O hook re-mede sozinho (ResizeObserver + fonts.ready); o
  // viewportW cobre browsers sem ResizeObserver ao girar o device.
  const viewportW = useViewportWidth();
  const { containerRef, setItemRef, pill } = useSlidingPill(active, String(viewportW));
  return (
    <div ref={containerRef} className="bottomnav" style={{ position: "fixed", isolation: "isolate" }}>
      <SlidingTabPill pill={pill} radius={12}
        background="rgba(201,168,76,0.12)"
        boxShadow="inset 0 0 0 1px rgba(201,168,76,0.3)" />
      {items.map(item => (
        <button key={item.id} ref={setItemRef(item.id)}
          className={active === item.id ? "active" : ""} onClick={() => onNav(item.id)}
          style={{ position: "relative", zIndex: 1 }}>
          <span style={{display:"flex",alignItems:"center",justifyContent:"center"}}>{item.svg}</span>
          <span>{t("nav."+item.id)}</span>
        </button>
      ))}
    </div>
  );
}

export default MobileBottomNav;
