// Single owner of the floor label, printed by five pages. BuildingView and NewBuilding keep their own bare
// marker (Z, 3) for the facade gutter, where a full sentence does not fit.
export function floorLabel(floor) {
  return floor === 0 ? "Zemin kat" : `${floor}. kat`;
}
