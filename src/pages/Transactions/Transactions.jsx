import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Transactions.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";

const TYPE_LABELS = { income: "Gelir", expense: "Gider" };
const FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "income", label: "Gelirler" },
  { value: "expense", label: "Giderler" },
];

function Transactions() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!currentUser?.id) {
        navigate("/", { replace: true });
        return;
      }

      const response = await window.electronAPI.getTransactions(currentUser.id);
      if (response.success) {
        setTransactions(response.data);
      } else {
        alert.error("Hata", response.message || "İşlem geçmişi alınamadı.");
      }
      setLoading(false);
    };

    fetchTransactions();
  }, [currentUser?.id, navigate]);

  const filtered = filter === "all" ? transactions : transactions.filter((t) => t.type === filter);

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpense;

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="transactions-container">
      <div className="transactions-header">
        <h2>İşlem Geçmişi</h2>
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`filter-tab ${filter === f.value ? "active" : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="transactions-summary">
        <div className="summary-card income">
          <span className="summary-label">Toplam Gelir</span>
          <span className="summary-amount">+{totalIncome.toLocaleString("tr-TR")} ₺</span>
        </div>
        <div className="summary-card expense">
          <span className="summary-label">Toplam Gider</span>
          <span className="summary-amount">-{totalExpense.toLocaleString("tr-TR")} ₺</span>
        </div>
        <div className={`summary-card net ${net >= 0 ? "positive" : "negative"}`}>
          <span className="summary-label">Net</span>
          <span className="summary-amount">
            {net >= 0 ? "+" : ""}
            {net.toLocaleString("tr-TR")} ₺
          </span>
        </div>
      </div>

      <table className="transactions-table">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Tür</th>
            <th>Açıklama</th>
            <th style={{ textAlign: "right" }}>Tutar</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: "center", padding: "32px", opacity: 0.6 }}>
                Kayıt bulunamadı.
              </td>
            </tr>
          ) : (
            filtered.map((t) => (
              <tr key={`${t.type}-${t.id}`}>
                <td className="date-cell">{t.date}</td>
                <td>
                  <span className={`type-badge type-${t.type}`}>{TYPE_LABELS[t.type]}</span>
                </td>
                <td className="description-cell">{t.description}</td>
                <td className={`amount-cell amount-${t.type}`} style={{ textAlign: "right" }}>
                  {t.type === "income" ? "+" : "-"}
                  {t.amount.toLocaleString("tr-TR")} ₺
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <hr style={{ margin: "40px 0", opacity: 0.2 }} />

      <div className="return-link">
        <button onClick={() => navigate("/dashboard")} className="button">
          Geri Dön
        </button>
      </div>
    </div>
  );
}

export default Transactions;
