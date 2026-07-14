import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { showAlert } from "@/utils/alert";
import { getToday } from "@/utils/format";
import { MONTHS, PAYMENT_METHOD_LABELS, OVERPAY_TOLERANCE } from "../constants";

function PaymentModal({ due, year, month, currentUser, onClose, onPaymentSaved }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(() => getToday());
  const [note, setNote] = useState("");
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
    let cancelled = false;

    (async () => {
      setHistoryLoading(true);
      const res = await window.electronAPI.getPaymentHistory(due.id);
      if (cancelled) return;
      if (res.success) setHistory(res.data);
      setHistoryLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [due.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      showAlert.warning("Geçersiz Tutar", "Lütfen geçerli bir tutar girin.");
      return;
    }

    const remaining = due.due_amount - due.paid_amount;
    if (parsedAmount > remaining + OVERPAY_TOLERANCE) {
      showAlert.warning("Fazla Ödeme", `Kalan borç ${remaining.toLocaleString("tr-TR")} ₺. Daha fazlası girilemez.`);
      return;
    }

    setIsSubmitting(true);
    const res = await window.electronAPI.recordPayment({
      apartmentId: due.apartment_id,
      year,
      month,
      paymentData: {
        amount: parsedAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        note: note || null,
        collected_by: currentUser.id,
      },
    });
    setIsSubmitting(false);

    if (res.success) {
      showAlert.success("Kaydedildi", res.message);
      setAmount("");
      setNote("");
      setPaymentMethod("cash");
      setPaymentDate(getToday());
      onPaymentSaved();
      fetchHistory();
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  const handleCancel = async (paymentId) => {
    const { value: reason } = await showAlert.cancelInput(
      "Ödemeyi İptal Et",
      "İptal Nedeni",
      "Lütfen iptal nedenini yazın...",
    );

    if (!reason) return;

    const res = await window.electronAPI.cancelPayment({ paymentId, userId: currentUser.id, reason });
    if (res.success) {
      showAlert.success("İptal Edildi", res.message, 1800);
      onPaymentSaved();
      fetchHistory();
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  const remaining = due.due_amount - due.paid_amount;
  const isPaid = due.status === "paid";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
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
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required max={getToday()} />
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
            <button type="submit" className="button button-full-width" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
            </button>
          </form>
        )}

        {isPaid && <div className="paid-notice">Bu aya ait aidat tamamen ödenmiştir.</div>}

        <div className="payment-history">
          <h4 className="modal-section-title">Ödeme Geçmişi</h4>
          {historyLoading ? (
            <p className="history-empty">Yükleniyor...</p>
          ) : history.length === 0 ? (
            <p className="history-empty">Henüz ödeme kaydı yok.</p>
          ) : (
            <ul className="history-list">
              {history.map((p) => (
                <li key={p.id} className={`history-item ${p.cancel_reason ? "cancelled" : ""}`}>
                  <div className="history-main">
                    <span className="history-amount">{p.amount.toLocaleString("tr-TR")} ₺</span>
                    <span className="history-method">{PAYMENT_METHOD_LABELS[p.payment_method]}</span>
                    <span className="history-date">{p.payment_date}</span>
                  </div>
                  <div className="history-meta">
                    <span>Tahsil eden: {p.collected_by_username}</span>
                    {p.note && <span> · {p.note}</span>}
                    {p.cancel_reason && (
                      <span className="cancel-reason">
                        {" "}· İptal: {p.cancel_reason}
                        {p.cancelled_by_username && ` (${p.cancelled_by_username})`}
                      </span>
                    )}
                  </div>
                  {!p.cancel_reason && (
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

PaymentModal.propTypes = {
  due: PropTypes.object.isRequired,
  year: PropTypes.number.isRequired,
  month: PropTypes.number.isRequired,
  currentUser: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onPaymentSaved: PropTypes.func.isRequired,
};

export default PaymentModal;
