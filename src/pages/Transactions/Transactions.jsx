import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import "./Transactions.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";
import { formatDate } from "../../utils/date";

const TYPE_LABELS = { income: "Gelir", expense: "Gider" };

const CATEGORY_LABELS = {
  dues: "Aidat",
  maintenance: "Bakım & Onarım",
  cleaning: "Temizlik",
  utility: "Fatura / Abonelik",
  staff: "Personel",
  other: "Diğer",
};
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

  const fetchTransactions = useCallback(async () => {
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
  }, [currentUser?.id, navigate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleCancel = useCallback(
    async (t) => {
      const { value: reason } = await Swal.fire({
        title: `${t.type === "income" ? "Geliri" : "Gideri"} İptal Et`,
        input: "textarea",
        inputLabel: "İptal Nedeni",
        inputPlaceholder: "Lütfen iptal nedenini yazın...",
        showCancelButton: true,
        confirmButtonText: "İptal Et",
        cancelButtonText: "Vazgeç",
        confirmButtonColor: "#dc2626",
        heightAuto: false,
        preConfirm: (val) => {
          if (!val?.trim()) Swal.showValidationMessage("İptal nedeni zorunludur.");
          return val?.trim();
        },
      });
      if (!reason) return;

      const fn = t.type === "income" ? window.electronAPI.cancelIncome : window.electronAPI.cancelExpense;
      const res = await fn({ id: t.id, userId: currentUser.id, reason });
      if (res.success) {
        alert.success("İptal Edildi", res.message, 1800);
        fetchTransactions();
      } else {
        alert.error("Hata", res.message);
      }
    },
    [currentUser?.id, fetchTransactions],
  );

  const filtered = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((t) => t.type === filter)),
    [transactions, filter],
  );

  const { totalIncome, totalExpense, net } = useMemo(() => {
    const totalIncome = transactions.filter((t) => t.type === "income" && !t.is_cancelled).reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter((t) => t.type === "expense" && !t.is_cancelled).reduce((s, t) => s + t.amount, 0);
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
            <th>Kategori</th>
            <th>Açıklama</th>
            <th className="amount-header">Tutar</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr className="empty-row">
              <td colSpan={6}>Kayıt bulunamadı.</td>
            </tr>
          ) : (
            filtered.map((t) => (
              <tr key={`${t.type}-${t.id}`} className={t.is_cancelled ? "row-cancelled" : ""}>
                <td className="date-cell">{formatDate(t.date)}</td>
                <td>
                  <span className={`type-badge type-${t.type}`}>{TYPE_LABELS[t.type]}</span>
                </td>
                <td className="category-cell">{CATEGORY_LABELS[t.category] ?? t.category}</td>
                <td className="description-cell">
                  {t.description}
                  {t.is_cancelled && t.cancel_reason && (
                    <span className="cancel-reason-inline"> · İptal: {t.cancel_reason}</span>
                  )}
                </td>
                <td className={`amount-cell amount-${t.type} ${t.is_cancelled ? "amount-cancelled" : ""}`}>
                  {t.type === "income" ? "+" : "-"}
                  {formatCurrency(t.amount)}
                </td>
                <td className="action-cell-tx">
                  {t.is_cancelled ? (
                    <span className="cancelled-badge">İptal</span>
                  ) : t.type === "expense" || t.category !== "dues" ? (
                    <button className="cancel-tx-btn" onClick={() => handleCancel(t)} title="İptal Et">
                      İptal
                    </button>
                  ) : null}
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
