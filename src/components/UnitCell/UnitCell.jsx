// The apartment cell of the two list tables. The table shell writes the same markup once more for its
// placeholder rows, so the sizing lives in the shared stylesheet: an invisible row has to match exactly.

import "./UnitCell.css";
import { floorLabel } from "@/utils/floorLabel";

function UnitCell({ apartmentNo, floor }) {
  return (
    <span className="unit-cell">
      <span className="unit-tag">{apartmentNo}</span>
      <span className="unit-floor">{floorLabel(floor)}</span>
    </span>
  );
}

export default UnitCell;
