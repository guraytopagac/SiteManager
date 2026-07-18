import PropTypes from "prop-types";
import { MONTHS } from "@/utils/date";

function MonthYearSelector({ selectedMonth, selectedYear, onMonthChange, onYearChange, yearOptions }) {
  return (
    <div className="month-selector">
      <select value={selectedMonth} onChange={(e) => onMonthChange(Number(e.target.value))}>
        {MONTHS.map((name, i) => (
          <option key={i + 1} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select value={selectedYear} onChange={(e) => onYearChange(Number(e.target.value))}>
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

MonthYearSelector.propTypes = {
  selectedMonth: PropTypes.number.isRequired,
  selectedYear: PropTypes.number.isRequired,
  onMonthChange: PropTypes.func.isRequired,
  onYearChange: PropTypes.func.isRequired,
  yearOptions: PropTypes.arrayOf(PropTypes.number).isRequired,
};

export default MonthYearSelector;
