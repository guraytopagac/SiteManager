import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Apartments.css";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDues } from "./useDues";
import DuesSummary from "./components/DuesSummary";
import DuesTable from "./components/DuesTable";
import MonthYearSelector from "./components/MonthYearSelector";

function Apartments() {
  const navigate = useNavigate();
  const now = new Date();
  const currentUser = useCurrentUser();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const { dues, loading, errorMessage, refetch } = useDues(currentUser?.id, selectedYear, selectedMonth);

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) yearOptions.push(y);

  if (loading) return <div className="loading">Verileriniz Yükleniyor...</div>;
  if (errorMessage)
    return (
      <div className="loading">
        {errorMessage}{" "}
        <button className="button" onClick={refetch}>
          Yeniden Dene
        </button>
      </div>
    );

  return (
    <div className="apartments-container">
      <div className="apartments-header">
        <h2>Daire Listesi</h2>
        <div className="header-actions">
          <MonthYearSelector
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
            yearOptions={yearOptions}
          />
        </div>
      </div>

      <DuesSummary dues={dues} />

      <DuesTable dues={dues} />

      <hr className="section-divider" />

      <div className="return-link">
        <button onClick={() => navigate("/dashboard")} className="button">
          Geri Dön
        </button>
      </div>
    </div>
  );
}

export default Apartments;
