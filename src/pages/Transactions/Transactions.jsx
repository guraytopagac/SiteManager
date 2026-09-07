import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Transactions.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import PeriodSelector from "@/components/PeriodSelector/PeriodSelector";
import { useSession, useCurrentBuilding } from "@/hooks/useSession";
import { showAlert } from "@/utils/alert";
import { formatDate, formatMonthYear, getCurrentYear, getCurrentMonth, clampMonth } from "@/utils/date";
import { formatSignedCurrency } from "@/utils/currency";

const TYPE_LABELS = { income: "Gelir", expense: "Gider" };

const CATEGORY_LABELS = {
  dues: "Aidat",
  rent: "Kira",
  parking: "Otopark",
  donation: "Bağış",
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

function Transactions() {
  const navigate = useNavigate();
  const session = useSession();
  const building = useCurrentBuilding();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [year, setYear] = useState(() => getCurrentYear());
  const [month, setMonth] = useState(() => getCurrentMonth());
  const [totals, setTotals] = useState({ totalIncome: 0, totalExpense: 0, net: 0 });

  const handleYearChange = (selectedYear) => {
    setYear(selectedYear);
    setMonth((prev) => clampMonth(selectedYear, prev));
  };

  const fetchTransactions = useCallback(async () => {
    if (!building?.id) {
      navigate("/", { replace: true });
      return;
    }
    try {
      const res = await window.electronAPI.getTransactions({
        buildingId: building.id,
        period: { year, month },
      });
      if (res.success) {
        setTransactions(res.data);
        setTotals(res.totals);
      } else {
        showAlert.error("Hata", res.message || "İşlem geçmişi alınamadı.");
      }
    } catch (err) {
      console.error("[Transactions] getTransactions:", err);
      showAlert.error("Hata", "Beklenmedik bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, [building, navigate, year, month]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (!building?.id) {
        navigate("/", { replace: true });
        return;
      }
      setLoading(true);
      try {
        const res = await window.electronAPI.getTransactions({
          buildingId: building.id,
          period: { year, month },
        });
        if (!isMounted) return;
        if (res.success) {
          setTransactions(res.data);
          setTotals(res.totals);
        } else {
          showAlert.error("Hata", res.message || "İşlem geçmişi alınamadı.");
        }
      } catch (err) {
        console.error("[Transactions] getTransactions:", err);
        if (isMounted) showAlert.error("Hata", "Beklenmedik bir hata oluştu.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [building, navigate, year, month]);

  const handleCancel = useCallback(
    async (t) => {
      const reason = await showAlert.cancelReason(`${t.type === "income" ? "Geliri" : "Gideri"} İptal Et`);
      if (!reason) return;

      const cancelTransaction =
        t.type === "income" ? window.electronAPI.cancelIncome : window.electronAPI.cancelExpense;

      try {
        const res = await cancelTransaction({ id: t.id, buildingId: building.id, userId: session.id, reason });
        if (res.success) {
          showAlert.toast(res.message);
          fetchTransactions();
        } else {
          showAlert.error("Hata", res.message);
        }
      } catch (err) {
        console.error("[Transactions] cancelTransaction:", err);
        showAlert.error("Hata", "Beklenmedik bir hata oluştu.");
      }
    },
    [building, session, fetchTransactions],
  );

  const filtered = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((t) => t.type === filter)),
    [transactions, filter],
  );

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="transactions-container">
      <div className="account-menu-row">
        <AccountMenu />
      </div>

      <div className="transactions-header">
        <div className="transactions-title-group">
          <h2>İşlem Geçmişi</h2>
          <span className="transactions-period-label">{formatMonthYear(year, month)}</span>
        </div>
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

      <div className="transactions-period">
        <PeriodSelector year={year} month={month} onYearChange={handleYearChange} onMonthChange={setMonth} />
      </div>

      <div className="transactions-summary">
        <div className="summary-card income">
          <span className="summary-label">Toplam Gelir</span>
          <span className="summary-amount">{formatSignedCurrency(totals.totalIncome)}</span>
        </div>
        <div className="summary-card expense">
          <span className="summary-label">Toplam Gider</span>
          <span className="summary-amount">{formatSignedCurrency(-totals.totalExpense)}</span>
        </div>
        <div className={`summary-card net ${totals.net >= 0 ? "positive" : "negative"}`}>
          <span className="summary-label">Net</span>
          <span className="summary-amount">{formatSignedCurrency(totals.net)}</span>
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
                  {formatSignedCurrency(t.type === "income" ? t.amount : -t.amount)}
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
        <button onClick={() => navigate("/dashboard")} className="back-btn" aria-label="Ana sayfaya geri dön">
          Geri Dön
        </button>
      </div>
    </div>
  );
}

export default Transactions;
