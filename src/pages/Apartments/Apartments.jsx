import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import "./Apartments.css";

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const STATUS_LABELS = {
  unpaid: "Ödenmedi",
  partial: "Kısmen Ödendi",
  paid: "Ödendi",
};

const PAYMENT_METHOD_LABELS = {
  cash: "Nakit",
  transfer: "Havale / EFT",
  credit_card: "Kredi Kartı",
  other: "Diğer",
};

const today = new Date().toISOString().slice(0, 10);

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({ due, currentUser, onClose, onPaymentSaved }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(today);
  const [note, setNote] = useState("");
  const [receiptPath, setReceiptPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    const res = await window.electronAPI.getPaymentHistory(due.id);
    if (res.success) setHistory(res.data);
    setHistoryLoading(false);
  }, [due.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setReceiptPath(file.path);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Geçersiz Tutar",
        text: "Lütfen geçerli bir tutar girin.",
        heightAuto: false,
      });
      return;
    }

    const remaining = due.due_amount - due.paid_amount;
    if (parsedAmount > remaining + 0.01) {
      Swal.fire({
        icon: "warning",
        title: "Fazla Ödeme",
        text: `Kalan borç ${remaining.toLocaleString("tr-TR")} ₺. Daha fazlası girilemez.`,
        heightAuto: false,
      });
      return;
    }

    setIsSubmitting(true);
    const res = await window.electronAPI.recordPayment(due.id, {
      amount: parsedAmount,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      receipt_path: receiptPath || null,
      note: note || null,
      collected_by: currentUser.id,
    });

    setIsSubmitting(false);

    if (res.success) {
      Swal.fire({
        icon: "success",
        title: "Kaydedildi",
        text: res.message,
        timer: 1800,
        showConfirmButton: false,
        heightAuto: false,
      });
      setAmount("");
      setNote("");
      setReceiptPath("");
      setPaymentMethod("cash");
      setPaymentDate(today);
      onPaymentSaved();
      fetchHistory();
    } else {
      Swal.fire({ icon: "error", title: "Hata", text: res.message, heightAuto: false });
    }
  };

  const handleCancel = async (paymentId) => {
    const { value: reason } = await Swal.fire({
      title: "Ödemeyi İptal Et",
      input: "textarea",
      inputLabel: "İptal Nedeni",
      inputPlaceholder: "Lütfen iptal nedenini yazın...",
      inputAttributes: { required: true },
      showCancelButton: true,
      confirmButtonText: "İptal Et",
      cancelButtonText: "Vazgeç",
      confirmButtonColor: "#dc2626",
      heightAuto: false,
      preConfirm: (val) => {
        if (!val || !val.trim()) {
          Swal.showValidationMessage("İptal nedeni zorunludur.");
        }
        return val?.trim();
      },
    });

    if (!reason) return;

    const res = await window.electronAPI.cancelPayment(paymentId, reason);
    if (res.success) {
      Swal.fire({
        icon: "success",
        title: "İptal Edildi",
        text: res.message,
        timer: 1800,
        showConfirmButton: false,
        heightAuto: false,
      });
      onPaymentSaved();
      fetchHistory();
    } else {
      Swal.fire({ icon: "error", title: "Hata", text: res.message, heightAuto: false });
    }
  };

  const remaining = due.due_amount - due.paid_amount;
  const isPaid = due.status === "paid";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <p className="modal-subtitle">
              {MONTHS[due.month - 1]} {due.year}
            </p>
            <h3 className="modal-title">Daire {due.apartment_no}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Due summary */}
        <div className="modal-due-summary">
          <div className="due-summary-item">
            <span>Aidat</span>
            <strong>{due.due_amount.toLocaleString("tr-TR")} ₺</strong>
          </div>
          <div className="due-summary-item">
            <span>Ödenen</span>
            <strong className="color-paid">{due.paid_amount.toLocaleString("tr-TR")} ₺</strong>
          </div>
          <div className="due-summary-item">
            <span>Kalan</span>
            <strong className={remaining > 0 ? "color-unpaid" : "color-paid"}>
              {remaining.toLocaleString("tr-TR")} ₺
            </strong>
          </div>
        </div>

        {/* Payment Form */}
        {!isPaid && (
          <form className="payment-form" onSubmit={handleSubmit}>
            <h4 className="modal-section-title">Ödeme Ekle</h4>

            <div className="form-row">
              <label>Ödeme Yöntemi</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label>Ödenen Tutar (₺)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={remaining}
                placeholder={`Maks. ${remaining.toLocaleString("tr-TR")} ₺`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <label>Ödeme Tarihi</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
            </div>

            <div className="form-row">
              <label>Açıklama / Not</label>
              <textarea
                rows={2}
                placeholder="İsteğe bağlı not..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {paymentMethod === "transfer" && (
              <div className="form-row">
                <label>Dekont Yükle</label>
                <input type="file" accept="image/*,.pdf" onChange={handleFileChange} />
                {receiptPath && <span className="receipt-name">{receiptPath.split(/[\\/]/).pop()}</span>}
              </div>
            )}

            <button type="submit" className="button" disabled={isSubmitting} style={{ width: "100%", marginTop: 8 }}>
              {isSubmitting ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
            </button>
          </form>
        )}

        {isPaid && <div className="paid-notice">Bu aya ait aidat tamamen ödenmiştir.</div>}

        {/* Payment History */}
        <div className="payment-history">
          <h4 className="modal-section-title">Ödeme Geçmişi</h4>

          {historyLoading ? (
            <p className="history-empty">Yükleniyor...</p>
          ) : history.length === 0 ? (
            <p className="history-empty">Henüz ödeme kaydı yok.</p>
          ) : (
            <ul className="history-list">
              {history.map((p) => (
                <li key={p.id} className={`history-item ${p.is_cancelled ? "cancelled" : ""}`}>
                  <div className="history-main">
                    <span className="history-amount">{p.amount.toLocaleString("tr-TR")} ₺</span>
                    <span className="history-method">{PAYMENT_METHOD_LABELS[p.payment_method]}</span>
                    <span className="history-date">{p.payment_date}</span>
                  </div>
                  <div className="history-meta">
                    <span>Tahsil eden: {p.collected_by_username}</span>
                    {p.note && <span> · {p.note}</span>}
                    {p.is_cancelled && <span className="cancel-reason"> · İptal: {p.cancel_reason}</span>}
                  </div>
                  {!p.is_cancelled && (
                    <button className="cancel-btn" onClick={() => handleCancel(p.id)}>
                      İptal Et
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Apartments() {
  const navigate = useNavigate();
  const now = new Date();

  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedDue, setSelectedDue] = useState(null);

  const currentUser = JSON.parse(sessionStorage.getItem("currentUser") || "{}");

  const fetchDues = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    if (!currentUser?.id) {
      navigate("/", { replace: true });
      return;
    }

    const response = await window.electronAPI.getDuesForMonth(currentUser.id, selectedYear, selectedMonth);

    if (response.success) {
      setDues(response.data);
    } else {
      setErrorMessage(response.message || "Veriler alınamadı.");
    }

    setLoading(false);
  }, [currentUser?.id, selectedYear, selectedMonth, navigate]);

  useEffect(() => {
    fetchDues();
  }, [fetchDues]);

  // After a payment is saved/cancelled, refresh the due row in state
  const handlePaymentSaved = useCallback(async () => {
    if (!currentUser?.id) return;
    const response = await window.electronAPI.getDuesForMonth(currentUser.id, selectedYear, selectedMonth);
    if (response.success) {
      setDues(response.data);
      // Keep modal open but update the selectedDue with fresh data
      setSelectedDue((prev) => (prev ? response.data.find((d) => d.id === prev.id) || prev : null));
    }
  }, [currentUser?.id, selectedYear, selectedMonth]);

  const totalDue = dues.reduce((sum, d) => sum + d.due_amount, 0);
  const totalPaid = dues.reduce((sum, d) => sum + d.paid_amount, 0);
  const paidCount = dues.filter((d) => d.status === "paid").length;
  const partialCount = dues.filter((d) => d.status === "partial").length;
  const unpaidCount = dues.filter((d) => d.status === "unpaid").length;

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
    yearOptions.push(y);
  }

  if (loading) return <div className="loading">Verileriniz Yükleniyor...</div>;
  if (errorMessage) return <div className="loading">{errorMessage}</div>;

  return (
    <div className="apartments-container">
      <div className="apartments-header">
        <h2>Daire Listesi</h2>
        <div className="month-selector">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {MONTHS.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="dues-summary">
        <div className="summary-item paid">
          <span className="summary-count">{paidCount}</span>
          <span className="summary-label">Ödendi</span>
        </div>
        <div className="summary-item partial">
          <span className="summary-count">{partialCount}</span>
          <span className="summary-label">Kısmen Ödendi</span>
        </div>
        <div className="summary-item unpaid">
          <span className="summary-count">{unpaidCount}</span>
          <span className="summary-label">Ödenmedi</span>
        </div>
        <div className="summary-item total">
          <span className="summary-count">{totalPaid.toLocaleString("tr-TR")} ₺</span>
          <span className="summary-label">/ {totalDue.toLocaleString("tr-TR")} ₺ Tahsilat</span>
        </div>
      </div>

      <table className="apartment-table">
        <thead>
          <tr>
            <th>Daire No</th>
            <th>Kat</th>
            <th>Tip</th>
            <th>m²</th>
            <th>Aidat</th>
            <th>Ödenen</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {dues.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "32px", opacity: 0.6 }}>
                Kayıtlı daire bulunamadı.
              </td>
            </tr>
          ) : (
            dues.map((due) => (
              <tr key={due.id}>
                <td>{due.apartment_no}</td>
                <td>{due.floor}</td>
                <td>{due.type}</td>
                <td>{due.square_meters}</td>
                <td>{due.due_amount.toLocaleString("tr-TR")} ₺</td>
                <td>{due.paid_amount.toLocaleString("tr-TR")} ₺</td>
                <td>
                  <button className={`status-badge status-${due.status}`} onClick={() => setSelectedDue(due)}>
                    {STATUS_LABELS[due.status]}
                  </button>
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

      {selectedDue && (
        <PaymentModal
          due={selectedDue}
          currentUser={currentUser}
          onClose={() => setSelectedDue(null)}
          onPaymentSaved={handlePaymentSaved}
        />
      )}
    </div>
  );
}

export default Apartments;
