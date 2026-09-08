import { useState, useEffect, useCallback, useRef } from "react";
import { FiCheck, FiPaperclip, FiUpload, FiX } from "react-icons/fi";
import "./DuesModals.css";
import { showDialog } from "@/utils/dialog";
import { formatCurrency } from "@/utils/currency";
import { formatDate, formatMonthYear, getMinDate, getToday } from "@/utils/date";

const PAYMENT_METHOD_LABELS = {
  cash: "Nakit",
  bank_transfer: "Havale / EFT",
  card: "Kredi Kartı",
  other: "Diğer",
};

const RECEIPT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

function formatFileSize(bytes) {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 0.1) return `${megabytes.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function toReceiptPayload(file) {
  return { name: file.name, data: new Uint8Array(await file.arrayBuffer()) };
}

function PaymentSummary({ due, remaining }) {
  return (
    <div className="du-sum">
      <div className="du-sum-item">
        <span className="du-sum-label">Aidat</span>
        <span className="du-sum-value">{formatCurrency(due.due_amount)}</span>
      </div>
      <div className="du-sum-item">
        <span className="du-sum-label">Ödenen</span>
        <span className="du-sum-value du-sum-value--paid">{formatCurrency(due.paid_amount)}</span>
      </div>
      <div className="du-sum-item">
        <span className="du-sum-label">Kalan</span>
        <span className={remaining > 0 ? "du-sum-value du-sum-value--due" : "du-sum-value du-sum-value--paid"}>
          {formatCurrency(remaining)}
        </span>
      </div>
    </div>
  );
}

function PaymentHistory({ history, loading, onCancel, onOpenReceipt, onAttachReceipt }) {
  return (
    <>
      <h3 className="du-md-section-title">Ödeme Geçmişi</h3>
      {loading ? (
        <p className="du-history-empty">Yükleniyor...</p>
      ) : history.length === 0 ? (
        <p className="du-history-empty">Henüz ödeme kaydı yok.</p>
      ) : (
        <ul className="du-history">
          {history.map((payment) => (
            <li
              key={payment.id}
              className={payment.cancel_reason ? "du-history-item du-history-item--cancelled" : "du-history-item"}
            >
              <div className="du-history-top">
                <span className="du-history-amount">{formatCurrency(payment.amount)}</span>
                <span className="du-history-method">{PAYMENT_METHOD_LABELS[payment.payment_method]}</span>
                <span className="du-history-date">{formatDate(payment.payment_date)}</span>
              </div>
              {payment.note && (
                <p className="du-history-note">
                  Açıklama: <span className="du-history-value">{payment.note}</span>
                </p>
              )}
              {payment.cancel_reason && (
                <div className="du-history-cancel-reason">
                  İptal: {payment.cancel_reason} ({formatDate(payment.cancelled_at)})
                </div>
              )}
              <p className="du-history-collector">
                Tahsil eden: <span className="du-history-value">{payment.collector_name}</span>
              </p>
              {(payment.receipt_name || !payment.cancel_reason) && (
                <div className="du-history-actions">
                  {payment.receipt_name && (
                    <button
                      type="button"
                      className="du-history-action"
                      onClick={() => onOpenReceipt(payment.id)}
                      title={payment.receipt_name}
                    >
                      <FiPaperclip aria-hidden="true" />
                      Dekontu Aç
                    </button>
                  )}
                  {!payment.cancel_reason && (
                    <button type="button" className="du-history-action" onClick={() => onAttachReceipt(payment.id)}>
                      <FiUpload aria-hidden="true" />
                      {payment.receipt_name ? "Değiştir" : "Dekont Ekle"}
                    </button>
                  )}
                  {!payment.cancel_reason && (
                    <button
                      type="button"
                      className="du-history-action du-history-action--cancel"
                      onClick={() => onCancel(payment.id)}
                    >
                      İptal Et
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PaymentModal({ due, year, month, session, building, onClose, onPaymentSaved }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(getToday());
  const [note, setNote] = useState("");
  const [collector, setCollector] = useState(session.managerName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [receiptFile, setReceiptFile] = useState(null);
  const formReceiptRef = useRef(null);
  const historyReceiptRef = useRef(null);
  const receiptTargetRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);

    try {
      const res = await window.electronAPI.getPaymentHistory({ dueId: due.id, buildingId: building.id });
      if (res.success) {
        setHistory(res.data);
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[PaymentModal] getPaymentHistory:", err);
      showDialog.error("Hata", "Ödeme geçmişi alınamadı.");
    }

    setHistoryLoading(false);
  }, [due.id, building.id]);

  useEffect(() => {
    (async () => {
      await fetchHistory();
    })();
  }, [fetchHistory]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      showDialog.warning("Geçersiz Tutar", "Lütfen geçerli bir tutar girin.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await window.electronAPI.recordPayment({
        apartmentId: due.apartment_id,
        buildingId: building.id,
        year,
        month,
        paymentData: {
          amount: paymentAmount,
          payment_method: paymentMethod,
          payment_date: paymentDate,
          note: note || null,
          collector_name: collector.trim() || null,
          collected_by: session.id,
          receipt: receiptFile ? await toReceiptPayload(receiptFile) : null,
        },
      });

      if (res.success) {
        showDialog.toast(res.message);
        setAmount("");
        setNote("");
        clearReceiptFile();
        onPaymentSaved();
        fetchHistory();
      } else if (res.code === "OVERPAYMENT") {
        showDialog.warning("Fazla Ödeme", `Kalan borç ${formatCurrency(res.remaining)}. Daha fazlası girilemez.`);
        onPaymentSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[PaymentModal] recordPayment:", err);
      showDialog.error("Hata", "Ödeme kaydedilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (paymentId) => {
    const reason = await showDialog.cancelReason("Ödemeyi İptal Et");

    if (!reason) return;

    try {
      const res = await window.electronAPI.cancelPayment({
        paymentId,
        buildingId: building.id,
        userId: session.id,
        reason,
      });

      if (res.success) {
        showDialog.toast(res.message);
        onPaymentSaved();
        fetchHistory();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[PaymentModal] cancelPayment:", err);
      showDialog.error("Hata", "Ödeme iptal edilemedi.");
    }
  };

  // The input is reset too, or picking the same file again fires no change event.
  const clearReceiptFile = () => {
    setReceiptFile(null);
    formReceiptRef.current.value = "";
  };

  // The history list shares one hidden input. The row that asked for it is kept in a ref.
  const handleAttachReceipt = (paymentId) => {
    receiptTargetRef.current = paymentId;
    historyReceiptRef.current.value = "";
    historyReceiptRef.current.click();
  };

  const handleReceiptPicked = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const res = await window.electronAPI.attachReceipt({
        paymentId: receiptTargetRef.current,
        buildingId: building.id,
        receipt: await toReceiptPayload(file),
      });

      if (res.success) {
        showDialog.toast(res.message);
        fetchHistory();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[PaymentModal] attachReceipt:", err);
      showDialog.error("Hata", "Dekont kaydedilemedi.");
    }
  };

  // The file opens in the default app of the system, so there is nothing to report on success.
  const handleOpenReceipt = async (paymentId) => {
    try {
      const res = await window.electronAPI.openReceipt({ paymentId, buildingId: building.id });
      if (!res.success) showDialog.error("Hata", res.message);
    } catch (err) {
      console.error("[PaymentModal] openReceipt:", err);
      showDialog.error("Hata", "Dekont açılamadı.");
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const remaining = due.due_amount - due.paid_amount;
  const isPaid = due.status === "paid";
  const period = formatMonthYear(due.year, due.month);
  const scope = due.resident_name
    ? `Daire ${due.apartment_no} · ${due.resident_name} · ${period}`
    : `Daire ${due.apartment_no} · ${period}`;

  return (
    <div className="du-md-overlay" onClick={handleClose}>
      <form className="du-md-box du-md-box--wide" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="du-md-head">
          <div className="du-md-identity">
            <h2 className="du-md-title">Aidat Tahsilatı</h2>
            <span className="du-md-scope" title={scope}>
              {scope}
            </span>
          </div>
          <button
            type="button"
            className="du-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="du-md-body du-pay-body">
          <div className="du-pay-main">
            <PaymentSummary due={due} remaining={remaining} />

            {isPaid ? (
              <div className="du-paid-notice">
                <FiCheck aria-hidden="true" />
                Bu aya ait aidat tamamen ödenmiştir.
              </div>
            ) : (
              <>
                <h3 className="du-md-section-title">Ödeme Ekle</h3>
                <div className="du-md-form-grid">
                  <div className="du-md-field">
                    <label htmlFor="payment-method">Ödeme Yöntemi</label>
                    <select
                      id="payment-method"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="du-md-field">
                    <label htmlFor="payment-amount">Ödenen Tutar (₺)</label>
                    <input
                      id="payment-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={remaining}
                      placeholder={`Maks. ${formatCurrency(remaining)}`}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="du-md-field">
                    <label htmlFor="payment-date">Ödeme Tarihi</label>
                    <input
                      id="payment-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                      min={getMinDate()}
                      max={getToday()}
                    />
                  </div>
                  <div className="du-md-field">
                    <label htmlFor="payment-collector">Tahsil Eden</label>
                    <input
                      id="payment-collector"
                      type="text"
                      maxLength={60}
                      placeholder="Parayı teslim alan kişi"
                      value={collector}
                      onChange={(e) => setCollector(e.target.value)}
                    />
                  </div>
                  <div className="du-md-field du-md-field--wide">
                    <label htmlFor="payment-note">Açıklama</label>
                    <textarea
                      id="payment-note"
                      placeholder="İsteğe bağlı not"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  <div className="du-md-field du-md-field--wide">
                    <label htmlFor="payment-receipt">
                      Dekont <span className="du-md-optional">(isteğe bağlı)</span>
                    </label>
                    <input
                      id="payment-receipt"
                      ref={formReceiptRef}
                      type="file"
                      accept={RECEIPT_ACCEPT}
                      onChange={(e) => setReceiptFile(e.target.files[0] ?? null)}
                      hidden
                    />
                    <div className="du-receipt-picker">
                      <button
                        type="button"
                        className="du-receipt-trigger"
                        onClick={() => formReceiptRef.current.click()}
                      >
                        <FiUpload aria-hidden="true" />
                        Dosya Seç
                      </button>
                      {receiptFile ? (
                        <span className="du-receipt-chip" title={receiptFile.name}>
                          <FiPaperclip aria-hidden="true" />
                          <span className="du-receipt-name">{receiptFile.name}</span>
                          <span className="du-receipt-size">{formatFileSize(receiptFile.size)}</span>
                          <button
                            type="button"
                            className="du-receipt-clear"
                            onClick={clearReceiptFile}
                            aria-label="Seçilen dekontu kaldır"
                          >
                            <FiX />
                          </button>
                        </span>
                      ) : (
                        <span className="du-receipt-hint">PDF, JPG, PNG veya WEBP · en fazla 5 MB</span>
                      )}
                    </div>
                  </div>
                </div>

                <button type="submit" className="du-md-btn-solid du-md-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
                </button>
              </>
            )}
          </div>

          <div className="du-pay-side">
            <PaymentHistory
              history={history}
              loading={historyLoading}
              onCancel={handleCancel}
              onOpenReceipt={handleOpenReceipt}
              onAttachReceipt={handleAttachReceipt}
            />
            <input ref={historyReceiptRef} type="file" accept={RECEIPT_ACCEPT} onChange={handleReceiptPicked} hidden />
          </div>
        </div>
      </form>
    </div>
  );
}

export default PaymentModal;
