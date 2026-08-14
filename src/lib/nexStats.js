/* Progressão de NEX (Ordem Paranormal 2ª Ed.) — PV/SAN/PE derivados da classe e dos
   atributos. Saiu do App.jsx (spec 0031) porque é compartilhado por DOIS contextos: a
   ficha (`FullSheet`/criador, ainda no App) e o card de ficha compartilhada da campanha
   (`features/campanha/SharedSheetCard`). Cópia seria divergência garantida. */
function nexStats(nexVal, classId, attrs) {
  const base = {
    combatente:   { pv: 20 + attrs.VIG, san: 12, pe: 2 + attrs.PRE },
    especialista: { pv: 16 + attrs.VIG, san: 16, pe: 3 + attrs.PRE },
    ocultista:    { pv: 12 + attrs.VIG, san: 20, pe: 4 + attrs.PRE },
  }[classId] ?? { pv: 12 + attrs.VIG, san: 20, pe: 4 + attrs.PRE };
  const perNex = {
    combatente:   { pv: 4 + attrs.VIG, san: 3, pe: 2 + attrs.PRE },
    especialista: { pv: 3 + attrs.VIG, san: 4, pe: 3 + attrs.PRE },
    ocultista:    { pv: 2 + attrs.VIG, san: 5, pe: 4 + attrs.PRE },
  }[classId] ?? { pv: 2 + attrs.VIG, san: 5, pe: 4 + attrs.PRE };
  const lvl = nexVal === 99 ? 19 : (nexVal - 5) / 5;
  return { pv: base.pv + lvl*perNex.pv, san: base.san + lvl*perNex.san, pe: base.pe + lvl*perNex.pe };
}

export { nexStats };
