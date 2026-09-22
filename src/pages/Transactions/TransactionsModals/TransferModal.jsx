// Moves money between the two accounts of the main cash. A deposit takes cash to the bank, a withdrawal
// brings it back. Neither is income or expense, the total stays the same and only the split changes.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./TransactionsModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { CASH_ACCOUNT_LABELS, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { showDialog } from "@/components/Dialog/dialogStore";
import { getMinDate, getToday } from "@/utils/date";

const MAX_AMOUNT = 1000000;

const MAX_DESCRIPTION_LENGTH = 300;

// Keyed by the account the money goes into. The source is the other one.
const DIRECTIONS = {
  bank: { label: "Bankaya Yatır", source: "cash" },
  cash: { label: "Bankadan Çek", source: "bank" },
};

function TransferModal({ building, userId, balances, onClose, onSaved }) {
  const [toAccount, setToAccount] = useState("bank");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => getToday());
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const source = DIRECTIONS[toAccount].source;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const enteredAmount = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      showDialog.warning("Geçersiz Tutar", "Aktarım tutarı 0'dan büyük olmalıdır.");
      return;
    }

    if (date > getToday()) {
      showDialog.warning("Geçersiz Tarih", "İleri bir tarih seçilemez.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await window.electronAPI.addCashTransfer({
        buildingId: building.id,
        userId,
        to_account: toAccount,
        amount: enteredAmount,
        date,
        description: description.trim(),
      });

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[TransferModal] addCashTransfer:", err);
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
    <div className="tx-md-overlay">
      <form className="tx-md-box" onSubmit={handleSubmit}>
        <div className="tx-md-head">
          <div className="tx-md-identity">
            <h2 className="tx-md-title">Hesaplar Arası Aktarım</h2>
            <span className="tx-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button
            type="button"
            className="tx-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="tx-md-body">
          <div className="tx-md-main">
            <div className="tx-md-field">
              <span className="tx-md-legend" id="tx-transfer-direction">
                Aktarım Yönü
              </span>
              <div className="tx-cat-list tx-account-list" role="radiogroup" aria-labelledby="tx-transfer-direction">
                {Object.entries(DIRECTIONS).map(([value, direction]) => (
                  <label key={value} className={toAccount === value ? "tx-cat tx-cat--active" : "tx-cat"}>
                    <input
                      type="radio"
                      name="tx-transfer-direction"
                      checked={toAccount === value}
                      onChange={() => setToAccount(value)}
                    />
                    {direction.label}
                  </label>
                ))}
              </div>
              <p className="tx-md-hint">
                {CASH_ACCOUNT_LABELS[source]} hesabında şu an {formatCurrency(balances[source])} görünüyor.
              </p>
            </div>

            <div className="tx-md-form-grid">
              <div className="tx-md-field">
                <label htmlFor="tx-transfer-amount">Tutar (₺)</label>
                <input
                  id="tx-transfer-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={MAX_AMOUNT}
                  placeholder="Örn. 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
                  required
                  autoFocus
                />
              </div>

              <div className="tx-md-field">
                <label htmlFor="tx-transfer-date">Tarih</label>
                <input
                  id="tx-transfer-date"
                  type="date"
                  value={date}
                  min={getMinDate()}
                  max={getToday()}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="tx-md-field">
              <label htmlFor="tx-transfer-description">Açıklama (isteğe bağlı)</label>
              <textarea
                id="tx-transfer-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Örn. Eylül tahsilatları bankaya yatırıldı"
                maxLength={MAX_DESCRIPTION_LENGTH}
              />
            </div>
          </div>

          <button type="submit" className="tx-md-btn-solid tx-md-submit" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Aktarımı Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default TransferModal;
