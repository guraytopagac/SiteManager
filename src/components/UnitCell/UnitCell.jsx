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
