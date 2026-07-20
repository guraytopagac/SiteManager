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

export default MonthYearSelector;
