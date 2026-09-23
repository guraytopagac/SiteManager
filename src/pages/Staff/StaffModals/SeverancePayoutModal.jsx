// Pays an employee's severance out of the fund. When the amount is above the balance the difference comes
// from the main cash in the same step, so the user is told the figure before and asked to confirm it, and
// picks which account of the main cash pays it. An open advance is only mentioned, it is never deducted.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./StaffModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { CASH_ACCOUNT_LABELS, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { showDialog } from "@/components/Dialog/dialogStore";
import { getToday } from "@/utils/date";

const MAX_PAYOUT = 5000000;
const MAX_NOTE_LENGTH = 300;

function toCents(value) {
  return Math.round(Number(value) * 100);
}

function SeverancePayoutModal({ building, employee, balance, userId, onClose, onSaved }) {
  const estimatedAmount = Math.round(employee.liability * 100) / 100;
  const [amountInput, setAmountInput] = useState(estimatedAmount > 0 ? String(estimatedAmount) : "");
  const [date, setDate] = useState(() => getToday());
  const [endDate, setEndDate] = useState(() => getToday());
  const [note, setNote] = useState("");
  const [topUpAccount, setTopUpAccount] = useState("bank");
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
        `Tazminat kasasında ${formatCurrency(balance)} var. Eksik kalan ${formatCurrency(shortfall)} ana kasanın ${CASH_ACCOUNT_LABELS[topUpAccount]} hesabından aktarılacak.`,
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
        top_up_account: topUpAccount,
      });
      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[SeverancePayoutModal] recordSeverancePayout:", err);
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
    <div className="st-md-overlay">
      <form className="st-md-box" onSubmit={handleSubmit}>
        <div className="st-md-head">
          <div className="st-md-identity">
            <h2 className="st-md-title">Tazminat Öde</h2>
            <span className="st-md-scope" title={employee.full_name}>
              {employee.full_name}
            </span>
          </div>
          <button
            type="button"
            className="st-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="st-md-body">
          <div className="st-md-sum">
            <div>
              <span>Tahmini Tazminat</span>
              <b>{employee.is_eligible ? formatCurrency(employee.liability) : "Hak doğmadı"}</b>
            </div>
            <div>
              <span>Tazminat Kasası Bakiyesi</span>
              <b>{formatCurrency(balance)}</b>
            </div>
          </div>

          <div className="st-md-grid">
            <div className="st-md-field st-md-field--wide">
              <label htmlFor="st-md-amount">Ödenen Tutar (₺)</label>
              <input
                id="st-md-amount"
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
              <span className="st-md-hint">
                Tahmini tazminat yasal tavanı, ihbar tazminatını ve kesintileri içermez.
              </span>
              {employee.advance_balance > 0 ? (
                <span className="st-md-hint">
                  Çalışanın {formatCurrency(employee.advance_balance)} açık avansı var. Tutardan kendiliğinden düşülmez.
                </span>
              ) : null}
              {shortfall > 0 ? (
                <span className="st-md-warning">
                  Tazminat kasası yetmiyor. Eksik kalan {formatCurrency(shortfall)} ana kasadan aktarılacak.
                </span>
              ) : null}
            </div>

            {shortfall > 0 ? (
              <div className="st-md-field st-md-field--wide">
                <label htmlFor="st-md-top-up-account">Eksik Tutarın Çıkacağı Hesap</label>
                <select
                  id="st-md-top-up-account"
                  value={topUpAccount}
                  onChange={(e) => setTopUpAccount(e.target.value)}
                >
                  {Object.entries(CASH_ACCOUNT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="st-md-field">
              <label htmlFor="st-md-end-date">Ayrılış Tarihi</label>
              <input
                id="st-md-end-date"
                type="date"
                min={employee.start_date}
                max={getToday()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <div className="st-md-field">
              <label htmlFor="st-md-date">Ödeme Tarihi</label>
              <input
                id="st-md-date"
                type="date"
                max={getToday()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="st-md-field st-md-field--wide">
              <label htmlFor="st-md-note">Not (isteğe bağlı)</label>
              <textarea
                id="st-md-note"
                maxLength={MAX_NOTE_LENGTH}
                placeholder="Örn. Emeklilik nedeniyle ayrıldı"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="st-btn-solid st-md-submit" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SeverancePayoutModal;
