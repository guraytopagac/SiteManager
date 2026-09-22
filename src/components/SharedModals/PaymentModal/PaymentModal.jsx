// Collection for one apartment and one month: summary, entry form and payment history. Both charges are
// collected here, dueType says which one, and the wording follows it. The right column stays out of the row
// measurement, so the form alone sets the height as payments accumulate.

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCheck, FiFileText, FiPaperclip, FiUpload, FiX } from "react-icons/fi";
import "./PaymentModal.css";
import CancelReasonModal from "@/components/SharedModals/CancelReasonModal/CancelReasonModal";
import { showDialog } from "@/components/Dialog/dialogStore";
import DocumentModal from "@/components/SharedModals/DocumentModal/DocumentModal";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  EMPTY_OWNER_LABEL,
  EMPTY_RESIDENT_LABEL,
  PAYMENT_METHOD_LABELS,
  UNEXPECTED_ERROR_MESSAGE,
} from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { formatDate, formatMonthYear, getMinDate, getToday } from "@/utils/date";

const RECEIPT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

// Everything that reads differently per charge. The monthly dues are owed by whoever lives in the flat, the
// fund contribution by its owner, so even the person named in the scope line comes from here.
const CHARGE_TYPES = {
  regular: {
    title: "Aidat Tahsilatı",
    summaryLabel: "Aidat",
    paidTitle: "Bu aya ait aidat tamamen ödenmiştir.",
    personOf: (due) => due.resident_name || EMPTY_RESIDENT_LABEL,
  },
  investment: {
    title: "Yatırım Aidatı Tahsilatı",
    summaryLabel: "Yatırım Aidatı",
    paidTitle: "Bu aya ait yatırım aidatı tamamen ödenmiştir.",
    personOf: (due) => due.owner_name || EMPTY_OWNER_LABEL,
  },
};

function formatFileSize(bytes) {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 0.1) return `${megabytes.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// The file is read here and crosses as bytes, so the bridge gains no file system capability. Type and size
// are left to the handler, the accept list only narrows the picker.
async function toReceiptPayload(file) {
  return { name: file.name, data: new Uint8Array(await file.arrayBuffer()) };
}

function PaymentSummary({ due, remaining, label }) {
  return (
    <div className="pay-sum">
      <div className="pay-sum-item">
        <span className="pay-sum-label">{label}</span>
        <span className="pay-sum-value">{formatCurrency(due.due_amount)}</span>
      </div>
      <div className="pay-sum-item">
        <span className="pay-sum-label">Ödenen</span>
        <span className="pay-sum-value pay-sum-value--paid">{formatCurrency(due.paid_amount)}</span>
      </div>
      <div className="pay-sum-item">
        <span className="pay-sum-label">Kalan</span>
        <span className={remaining > 0 ? "pay-sum-value pay-sum-value--due" : "pay-sum-value pay-sum-value--paid"}>
          {formatCurrency(remaining)}
        </span>
      </div>
    </div>
  );
}

// Every action of an entry sits in one bottom strip. A cancelled payment keeps only the button that opens
// its receipt, and a read failure shows in the list's own place since the box is already open. The printed
// receipt covers the whole month rather than one payment, so its button heads the list instead of a card.
function PaymentHistory({ history, loading, errorMessage, onCancel, onOpenReceipt, onAttachReceipt, onCreateReceipt }) {
  return (
    <>
      <div className="pay-history-head">
        <h3 className="pay-md-section-title">Ödeme Geçmişi</h3>
        {onCreateReceipt ? (
          <button type="button" className="pay-history-action" onClick={onCreateReceipt}>
            <FiFileText aria-hidden="true" />
            Makbuz Oluştur
          </button>
        ) : null}
      </div>
      {loading ? (
        <p className="pay-history-empty">Yükleniyor...</p>
      ) : errorMessage ? (
        <p className="pay-history-empty">{errorMessage}</p>
      ) : history.length === 0 ? (
        <p className="pay-history-empty">Henüz ödeme kaydı yok.</p>
      ) : (
        <ul className="pay-history">
          {history.map((payment) => (
            <li
              key={payment.id}
              className={payment.cancel_reason ? "pay-history-item pay-history-item--cancelled" : "pay-history-item"}
            >
              <div className="pay-history-top">
                <span className="pay-history-amount">{formatCurrency(payment.amount)}</span>
                <span className="pay-history-method">{PAYMENT_METHOD_LABELS[payment.payment_method]}</span>
                <span className="pay-history-date">{formatDate(payment.payment_date)}</span>
              </div>
              {payment.note && (
                <p className="pay-history-note">
                  Açıklama: <span className="pay-history-value">{payment.note}</span>
                </p>
              )}
              {payment.cancel_reason && (
                <div className="pay-history-cancel-reason">
                  İptal: {payment.cancel_reason} ({formatDate(payment.cancelled_at)})
                </div>
              )}
              <p className="pay-history-collector">
                Tahsil eden: <span className="pay-history-value">{payment.collector_name}</span>
              </p>
              {(payment.receipt_name || !payment.cancel_reason) && (
                <div className="pay-history-actions">
                  {payment.receipt_name && (
                    <button
                      type="button"
                      className="pay-history-action"
                      onClick={() => onOpenReceipt(payment.id)}
                      title={payment.receipt_name}
                    >
                      <FiPaperclip aria-hidden="true" />
                      Dekontu Aç
                    </button>
                  )}
                  {!payment.cancel_reason && (
                    <button type="button" className="pay-history-action" onClick={() => onAttachReceipt(payment.id)}>
                      <FiUpload aria-hidden="true" />
                      {payment.receipt_name ? "Değiştir" : "Dekont Ekle"}
                    </button>
                  )}
                  {!payment.cancel_reason && (
                    <button
                      type="button"
                      className="pay-history-action pay-history-action--cancel"
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

function PaymentModal({ due, dueType, year, month, session, building, onClose, onPaymentSaved }) {
  const charge = CHARGE_TYPES[dueType];
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
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [receiptIncomeId, setReceiptIncomeId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  // An effect rather than the suspending reader: a modal opening is not a transition, so a suspense boundary
  // would delay the whole box by its minimum placeholder span for a query that takes milliseconds.
  const fetchHistory = useCallback(async () => {
    try {
      const res = await window.electronAPI.getPaymentHistory({ dueId: due.id, buildingId: building.id });
      if (res.success) {
        setHistory(res.data);
        setHistoryError("");
      } else {
        setHistoryError(res.message || "Ödeme geçmişi alınamadı.");
      }
    } catch (err) {
      console.error("[PaymentModal] getPaymentHistory:", err);
      setHistoryError(UNEXPECTED_ERROR_MESSAGE);
    }

    // Only true on the first read, so a refresh after a payment keeps the existing entries in place.
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
        dueType,
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

  // Reports whether the payment was cancelled, so the reason box stays open when the service refuses.
  const cancelPayment = async (reason) => {
    try {
      const res = await window.electronAPI.cancelPayment({
        paymentId: cancelTarget,
        buildingId: building.id,
        userId: session.id,
        reason,
      });

      if (res.success) {
        showDialog.toast(res.message);
        setCancelTarget(null);
        onPaymentSaved();
        fetchHistory();
        return true;
      }
      showDialog.error("Hata", res.message);
    } catch (err) {
      console.error("[PaymentModal] cancelPayment:", err);
      showDialog.error("Hata", "Ödeme iptal edilemedi.");
    }
    return false;
  };

  const clearReceiptFile = () => {
    setReceiptFile(null);
    formReceiptRef.current.value = "";
  };

  // One hidden input serves the whole history, with the target payment held in a ref. The value is cleared
  // before opening, so picking the same file twice still fires a change.
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

  const handleOpenReceipt = async (paymentId) => {
    try {
      const res = await window.electronAPI.openReceipt({ paymentId, buildingId: building.id });
      if (!res.success) showDialog.error("Hata", res.message);
    } catch (err) {
      console.error("[PaymentModal] openReceipt:", err);
      showDialog.error("Hata", "Dekont açılamadı.");
    }
  };

  // The document and cancel boxes listen for Escape too, and one key press must close only that top layer.
  const handleClose = () => {
    if (isSubmitting || receiptIncomeId || cancelTarget) return;
    onClose();
  };

  useEscapeKey(handleClose);

  // Any live payment of the month opens the same receipt, since the document gathers all of them.
  const liveIncomeId = history.find((payment) => !payment.cancel_reason && payment.income_id != null)?.income_id;

  const remaining = due.due_amount - due.paid_amount;
  const isPaid = due.status === "paid";
  const period = formatMonthYear(due.year, due.month);
  const scope = `Daire ${due.apartment_no} · ${charge.personOf(due)} · ${period}`;

  return (
    <>
      <div className="pay-md-overlay">
        <form className="pay-md-box pay-md-box--wide" onSubmit={handleSubmit}>
          <div className="pay-md-head">
            <div className="pay-md-identity">
              <h2 className="pay-md-title">{charge.title}</h2>
              <span className="pay-md-scope" title={scope}>
                {scope}
              </span>
            </div>
            <button
              type="button"
              className="pay-md-close"
              onClick={handleClose}
              disabled={isSubmitting}
              aria-label="Kapat"
            >
              <FiX />
            </button>
          </div>

          <div className="pay-md-body pay-body">
            <div className="pay-main">
              <PaymentSummary due={due} remaining={remaining} label={charge.summaryLabel} />

              {/* The form stays mounted once the month is paid and is only hidden, so the left column that
                  sizes the box keeps its height and the notice takes the same cell. */}
              <div className="pay-entry">
                <div className={isPaid ? "pay-form pay-form--blank" : "pay-form"} inert={isPaid}>
                  <h3 className="pay-md-section-title">Ödeme Ekle</h3>
                  <div className="pay-md-form-grid">
                    <div className="pay-md-field">
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
                    <div className="pay-md-field">
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
                    <div className="pay-md-field">
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
                    <div className="pay-md-field">
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
                    <div className="pay-md-field pay-md-field--wide">
                      <label htmlFor="payment-note">Açıklama</label>
                      <textarea
                        id="payment-note"
                        placeholder="İsteğe bağlı not"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </div>
                    <div className="pay-md-field pay-md-field--wide">
                      <label htmlFor="payment-receipt">
                        Dekont <span className="pay-md-optional">(isteğe bağlı)</span>
                      </label>
                      <input
                        id="payment-receipt"
                        ref={formReceiptRef}
                        type="file"
                        accept={RECEIPT_ACCEPT}
                        onChange={(e) => setReceiptFile(e.target.files[0] ?? null)}
                        hidden
                      />
                      <div className="pay-receipt-picker">
                        <button
                          type="button"
                          className="pay-receipt-trigger"
                          onClick={() => formReceiptRef.current.click()}
                        >
                          <FiUpload aria-hidden="true" />
                          Dosya Seç
                        </button>
                        {receiptFile ? (
                          <span className="pay-receipt-chip" title={receiptFile.name}>
                            <FiPaperclip aria-hidden="true" />
                            <span className="pay-receipt-name">{receiptFile.name}</span>
                            <span className="pay-receipt-size">{formatFileSize(receiptFile.size)}</span>
                            <button
                              type="button"
                              className="pay-receipt-clear"
                              onClick={clearReceiptFile}
                              aria-label="Seçilen dekontu kaldır"
                            >
                              <FiX />
                            </button>
                          </span>
                        ) : (
                          <span className="pay-receipt-hint">PDF, JPG, PNG veya WEBP · en fazla 5 MB</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="pay-md-btn-solid pay-md-submit" disabled={isSubmitting}>
                    {isSubmitting ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
                  </button>
                </div>

                {isPaid ? (
                  <div className="pay-paid-notice">
                    <span className="pay-paid-mark">
                      <FiCheck aria-hidden="true" />
                    </span>
                    <p className="pay-paid-title">{charge.paidTitle}</p>
                    <p className="pay-paid-body">Bir ödeme iptal edilirse ödeme formu yeniden açılır.</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="pay-side">
              <PaymentHistory
                history={history}
                loading={historyLoading}
                errorMessage={historyError}
                onCancel={setCancelTarget}
                onOpenReceipt={handleOpenReceipt}
                onAttachReceipt={handleAttachReceipt}
                onCreateReceipt={liveIncomeId ? () => setReceiptIncomeId(liveIncomeId) : null}
              />
              <input
                ref={historyReceiptRef}
                type="file"
                accept={RECEIPT_ACCEPT}
                onChange={handleReceiptPicked}
                hidden
              />
            </div>
          </div>
        </form>
      </div>
      {receiptIncomeId ? (
        <DocumentModal
          transaction={{ id: receiptIncomeId, type: "income" }}
          building={building}
          onClose={() => setReceiptIncomeId(null)}
          onSaved={() => setReceiptIncomeId(null)}
        />
      ) : null}
      {cancelTarget ? (
        <CancelReasonModal
          title="Ödemeyi İptal Et"
          scope={scope}
          onClose={() => setCancelTarget(null)}
          onConfirm={cancelPayment}
        />
      ) : null}
    </>
  );
}

export default PaymentModal;
