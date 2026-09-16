import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./TransactionsModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHOD_LABELS,
  UNEXPECTED_ERROR_MESSAGE,
} from "@/utils/constants";
import { showDialog } from "@/utils/dialog";
import { getMinDate, getToday } from "@/utils/date";

const MAX_AMOUNT = 1000000;

const MAX_DESCRIPTION_LENGTH = 500;

const TYPES = {
  income: {
    title: "Gelir Ekle",
    amountLabel: "Gelir Tutarı (₺)",
    amountPlaceholder: "Örn. 1500",
    amountWarning: "Gelir tutarı 0'dan büyük olmalıdır.",
    descriptionPlaceholder: "Örn. Çatı katı deposu kirası",
    submitLabel: "Geliri Kaydet",
    errorMessage: "Gelir kaydedilemedi.",
    categories: INCOME_CATEGORIES,
    asksPaymentMethod: true,
  },
  expense: {
    title: "Gider Ekle",
    amountLabel: "Gider Tutarı (₺)",
    amountPlaceholder: "Örn. 450",
    amountWarning: "Gider tutarı 0'dan büyük olmalıdır.",
    descriptionPlaceholder: "Örn. Çevre aydınlatma ampul değişimi",
    submitLabel: "Gideri Kaydet",
    errorMessage: "Gider kaydedilemedi.",
    categories: EXPENSE_CATEGORIES,
    asksPaymentMethod: false,
  },
};

function counterClass(length) {
  if (length >= MAX_DESCRIPTION_LENGTH - 10) return "tx-md-counter tx-md-counter--danger";
  if (length >= MAX_DESCRIPTION_LENGTH - 50) return "tx-md-counter tx-md-counter--warning";
  return "tx-md-counter";
}

function TransactionModal({ type, building, onClose, onSaved }) {
  const text = TYPES[type];
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [date, setDate] = useState(() => getToday());
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const enteredAmount = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      showDialog.warning("Geçersiz Tutar", text.amountWarning);
      return;
    }

    if (date > getToday()) {
      showDialog.warning("Geçersiz Tarih", "İleri bir tarih seçilemez.");
      return;
    }

    setIsSubmitting(true);

    try {
      const saveTransaction = type === "income" ? window.electronAPI.addIncome : window.electronAPI.addExpense;
      const res = await saveTransaction({
        buildingId: building.id,
        amount: enteredAmount,
        category,
        date,
        description: description.trim(),
        ...(text.asksPaymentMethod ? { payment_method: paymentMethod } : {}),
      });

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message || text.errorMessage);
      }
    } catch (err) {
      console.error("[TransactionModal] saveTransaction:", err);
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
            <h2 className="tx-md-title">{text.title}</h2>
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
          <div className="tx-md-form-grid">
            <div className="tx-md-field">
              <label htmlFor="tx-amount">{text.amountLabel}</label>
              <input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={MAX_AMOUNT}
                placeholder={text.amountPlaceholder}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
                required
                autoFocus
              />
            </div>

            <div className="tx-md-field">
              <label htmlFor="tx-date">Tarih</label>
              <input
                id="tx-date"
                type="date"
                value={date}
                min={getMinDate()}
                max={getToday()}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="tx-md-field tx-md-field--wide">
              <span className="tx-md-legend" id="tx-category-label">
                Kategori
              </span>
              <div className="tx-cat-list" role="radiogroup" aria-labelledby="tx-category-label">
                {text.categories.map((option) => (
                  <label key={option.value} className={category === option.value ? "tx-cat tx-cat--active" : "tx-cat"}>
                    <input
                      type="radio"
                      name="tx-category"
                      checked={category === option.value}
                      onChange={() => setCategory(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {text.asksPaymentMethod ? (
              <div className="tx-md-field tx-md-field--wide">
                <span className="tx-md-legend" id="tx-method-label">
                  Ödeme Şekli
                </span>
                <div className="tx-cat-list tx-method-list" role="radiogroup" aria-labelledby="tx-method-label">
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <label key={value} className={paymentMethod === value ? "tx-cat tx-cat--active" : "tx-cat"}>
                      <input
                        type="radio"
                        name="tx-method"
                        checked={paymentMethod === value}
                        onChange={() => setPaymentMethod(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="tx-md-field tx-md-field--wide">
              <label htmlFor="tx-description">Açıklama (isteğe bağlı)</label>
              <textarea
                id="tx-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={text.descriptionPlaceholder}
                maxLength={MAX_DESCRIPTION_LENGTH}
              />
              <span className={counterClass(description.length)}>
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
          </div>

          <button type="submit" className="tx-md-btn-solid tx-md-submit" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : text.submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export default TransactionModal;
