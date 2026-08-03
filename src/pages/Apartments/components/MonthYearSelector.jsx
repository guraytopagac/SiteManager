import { getMonthOptions } from "@/utils/date";

function MonthYearSelector({ selectedMonth, selectedYear, onMonthChange, onYearChange, yearOptions }) {
  const monthOptions = getMonthOptions(selectedYear);

  return (
    <div className="month-selector">
      <select value={selectedMonth} onChange={(e) => onMonthChange(Number(e.target.value))}>
        {monthOptions.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
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
