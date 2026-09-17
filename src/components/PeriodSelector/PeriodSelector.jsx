// The period control of the four period aware screens. Both option lists come from the date layer, and the
// month list stopping at the current month is what makes a future period unreachable from the interface.

import { FiCalendar, FiChevronDown } from "react-icons/fi";
import "./PeriodSelector.css";
import { getMonthOptions, getYearOptions } from "@/utils/date";

// A field that cannot affect the current screen is disabled rather than removed, so the control keeps its width.
function PeriodSelector({ year, month, onYearChange, onMonthChange, isMonthDisabled = false, isYearDisabled = false }) {
  return (
    <div className="ps-wrapper">
      <span className="ps-mark" aria-hidden="true">
        <FiCalendar />
      </span>

      <span className="ps-field">
        <select
          aria-label="Ay"
          value={month}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          disabled={isMonthDisabled}
        >
          {getMonthOptions(year).map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <span className="ps-chevron" aria-hidden="true">
          <FiChevronDown />
        </span>
      </span>

      <span className="ps-divider" aria-hidden="true" />

      <span className="ps-field">
        <select
          aria-label="Yıl"
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          disabled={isYearDisabled}
        >
          {getYearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="ps-chevron" aria-hidden="true">
          <FiChevronDown />
        </span>
      </span>
    </div>
  );
}

export default PeriodSelector;
