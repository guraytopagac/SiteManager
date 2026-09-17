// Pays an employee's severance out of the fund. When the amount is above the balance the difference comes
// from the main cash in the same step, so the user is told the figure before and asked to confirm it.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./SeveranceFundModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { showDialog } from "@/utils/dialog";
import { getToday } from "@/utils/date";

const MAX_PAYOUT = 5000000;
const MAX_NOTE_LENGTH = 300;

function toCents(value) {
  return Math.round(Number(value) * 100);
}

function PayoutModal({ building, employee, balance, userId, onClose, onSaved }) {
  const estimatedAmount = Math.round(employee.liability * 100) / 100;
  const [amountInput, setAmountInput] = useState(estimatedAmount > 0 ? String(estimatedAmount) : "");
  const [date, setDate] = useState(() => getToday());
  const [endDate, setEndDate] = useState(() => getToday());
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shortfallCents = amountInput === "" ? 0 : toCents(amountInput) - Math.max(toCents(balance), 0);
  const shortfall = shortfallCents > 0 ? shortfallCents / 100 : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const amount = toCents(amountInput) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      showDialog.warning("Geçersiz Tutar", "Tazminat tutarı 0'dan büyük olmalıdır.");
      return;
    }
    if (endDate < employee.start_date) {
      showDialog.warning("Geçersiz Tarih", "Ayrılış tarihi işe giriş tarihinden önce olamaz.");
      return;
    }
    if (shortfall > 0) {
      const confirmed = await showDialog.confirm(
        "Tazminat Kasası Yetersiz",
        `Tazminat kasasında ${formatCurrency(balance)} var. Eksik kalan ${formatCurrency(shortfall)} ana kasadan aktarılacak.`,
        "Vazgeç",
        "Ödemeyi Kaydet",
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.recordSeverancePayout({
        buildingId: building.id,
        employeeId: employee.id,
        userId,
        amount,
        date,
        end_date: endDate,
        note: note.trim(),
      });
      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[PayoutModal] recordSeverancePayout:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useEscapeKey(handleClose);

  return (
    <div className="sf-md-overlay">
      <form className="sf-md-box" onSubmit={handleSubmit}>
        <div className="sf-md-head">
          <div className="sf-md-identity">
            <h2 className="sf-md-title">Tazminat Öde</h2>
            <span className="sf-md-scope" title={employee.full_name}>
              {employee.full_name}
            </span>
          </div>
          <button
            type="button"
            className="sf-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="sf-md-body">
          <div className="sf-md-sum">
            <div>
              <span>Tahmini Tazminat</span>
              <b>{employee.is_eligible ? formatCurrency(employee.liability) : "Hak doğmadı"}</b>
            </div>
            <div>
              <span>Tazminat Kasası Bakiyesi</span>
              <b>{formatCurrency(balance)}</b>
            </div>
          </div>

          <div className="sf-md-grid">
            <div className="sf-md-field sf-md-field--wide">
              <label htmlFor="sf-md-amount">Ödenen Tutar (₺)</label>
              <input
                id="sf-md-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={MAX_PAYOUT}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
                required
                autoFocus
              />
              <span className="sf-md-hint">
                Tahmini tazminat yasal tavanı, ihbar tazminatını ve kesintileri içermez.
              </span>
              {shortfall > 0 ? (
                <span className="sf-md-warning">
                  Tazminat kasası yetmiyor. Eksik kalan {formatCurrency(shortfall)} ana kasadan aktarılacak.
                </span>
              ) : null}
            </div>

            <div className="sf-md-field">
              <label htmlFor="sf-md-end-date">Ayrılış Tarihi</label>
              <input
                id="sf-md-end-date"
                type="date"
                min={employee.start_date}
                max={getToday()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <div className="sf-md-field">
              <label htmlFor="sf-md-date">Ödeme Tarihi</label>
              <input
                id="sf-md-date"
                type="date"
                max={getToday()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="sf-md-field sf-md-field--wide">
              <label htmlFor="sf-md-note">Not (isteğe bağlı)</label>
              <textarea
                id="sf-md-note"
                maxLength={MAX_NOTE_LENGTH}
                placeholder="Örn. Emeklilik nedeniyle ayrıldı"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="sf-btn-solid sf-md-submit" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PayoutModal;
