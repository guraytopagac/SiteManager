import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Transactions.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";
import { formatDate } from "../../utils/date";

const TYPE_LABELS = { income: "Gelir", expense: "Gider" };
const FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "income", label: "Gelirler" },
  { value: "expense", label: "Giderler" },
];

const formatCurrency = (n) => `${n.toLocaleString("tr-TR")} ₺`;

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

      try {
        const response = await window.electronAPI.getTransactions(currentUser.id);
        if (response.success) {
          setTransactions(response.data);
        } else {
          alert.error("Hata", response.message || "İşlem geçmişi alınamadı.");
        }
      } catch {
        alert.error("Hata", "Beklenmedik bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [currentUser?.id, navigate]);

  const filtered = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((t) => t.type === filter)),
    [transactions, filter],
  );

  const { totalIncome, totalExpense, net } = useMemo(() => {
    const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { totalIncome, totalExpense, net: totalIncome - totalExpense };
  }, [transactions]);

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
          <span className="summary-amount">+{formatCurrency(totalIncome)}</span>
        </div>
        <div className="summary-card expense">
          <span className="summary-label">Toplam Gider</span>
          <span className="summary-amount">-{formatCurrency(totalExpense)}</span>
        </div>
        <div className={`summary-card net ${net >= 0 ? "positive" : "negative"}`}>
          <span className="summary-label">Net</span>
          <span className="summary-amount">
            {net >= 0 ? "+" : ""}
            {formatCurrency(net)}
          </span>
        </div>
      </div>

      <table className="transactions-table">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Tür</th>
            <th>Açıklama</th>
            <th className="amount-header">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr className="empty-row">
              <td colSpan={4}>Kayıt bulunamadı.</td>
            </tr>
          ) : (
            filtered.map((t) => (
              <tr key={`${t.type}-${t.id}`}>
                <td className="date-cell">{formatDate(t.date)}</td>
                <td>
                  <span className={`type-badge type-${t.type}`}>{TYPE_LABELS[t.type]}</span>
                </td>
                <td className="description-cell">{t.description}</td>
                <td className={`amount-cell amount-${t.type}`}>
                  {t.type === "income" ? "+" : "-"}
                  {formatCurrency(t.amount)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <hr className="transactions-divider" />

      <div className="return-link">
        <button onClick={() => navigate("/dashboard")} className="backButton" aria-label="Dashboard'a geri dön">
          Geri Dön
        </button>
      </div>
    </div>
  );
}

export default Transactions;
