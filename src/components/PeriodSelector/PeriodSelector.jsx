import { FiCalendar, FiChevronDown } from "react-icons/fi";
import "./PeriodSelector.css";
import { getMonthOptions, getYearOptions } from "@/utils/date";

function PeriodSelector({ year, month, onYearChange, onMonthChange }) {
  return (
    <div className="ps-wrapper">
      <span className="ps-mark" aria-hidden="true">
        <FiCalendar />
      </span>

      <span className="ps-field">
        <select aria-label="Ay" value={month} onChange={(e) => onMonthChange(Number(e.target.value))}>
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
        <select aria-label="Yıl" value={year} onChange={(e) => onYearChange(Number(e.target.value))}>
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
