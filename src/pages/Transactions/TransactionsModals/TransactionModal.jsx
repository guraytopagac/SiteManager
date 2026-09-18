// Records one income or one expense, the type arriving as a prop. Everything that differs lives in the table
// below, so the only comparison against the type is the line that picks the endpoint.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./TransactionsModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  EXPENSE_CATEGORY_GROUPS,
  INCOME_CATEGORY_GROUPS,
  OTHER_CATEGORY,
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
    categoryGroups: INCOME_CATEGORY_GROUPS,
    otherHint: "Listede olmayan gelirler",
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
    categoryGroups: EXPENSE_CATEGORY_GROUPS,
    otherHint: "Listede olmayan giderler",
    asksPaymentMethod: false,
  },
};

// Every category stays in view in its own column of the modal. A dropdown of eighteen items could not fit the
// modal vertically: floating above the form it ran off the screen, placed in the flow it made the modal jump in
// size. The catch-all sits apart below the groups, so it reads as the answer for what the list does not cover.
function CategoryList({ labelId, value, onChange, groups, otherHint }) {
  const renderOption = (option) => (
    <button
      key={option.value}
      type="button"
      className={option.value === value ? "tx-pick-option tx-pick-option--active" : "tx-pick-option"}
      aria-pressed={option.value === value}
      onClick={() => onChange(option.value)}
    >
      {option.label}
    </button>
  );

  const isGrouped = groups.some((group) => group.label);

  return (
    <div className="tx-pick-panel" role="group" aria-labelledby={labelId}>
      <div className={isGrouped ? "tx-pick-groups tx-pick-groups--columns" : "tx-pick-groups"}>
        {groups.map((group) => (
          <div key={group.label ?? "loose"} className="tx-pick-group">
            {group.label ? <span className="tx-pick-group-title">{group.label}</span> : null}
            {group.categories.map(renderOption)}
          </div>
        ))}
      </div>
      <div className="tx-pick-other">
        <button
          type="button"
          className={value === OTHER_CATEGORY.value ? "tx-pick-option tx-pick-option--active" : "tx-pick-option"}
          aria-pressed={value === OTHER_CATEGORY.value}
          onClick={() => onChange(OTHER_CATEGORY.value)}
        >
          {OTHER_CATEGORY.label}
          <span className="tx-pick-other-hint">{otherHint}</span>
        </button>
      </div>
    </div>
  );
}

function TransactionModal({ type, building, onClose, onSaved }) {
  const text = TYPES[type];
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
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

    if (category === "") {
      showDialog.warning("Kategori Seçilmedi", "Kayıt için bir kategori seçin.");
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
      <form className="tx-md-box tx-md-box--split" onSubmit={handleSubmit}>
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

        <div className="tx-md-body tx-md-split">
          <div className="tx-md-main">
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
            </div>

            {text.asksPaymentMethod ? (
              <div className="tx-md-field">
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

            <div className="tx-md-field tx-md-field--grow">
              <label htmlFor="tx-description">Açıklama (isteğe bağlı)</label>
              <textarea
                id="tx-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={text.descriptionPlaceholder}
                maxLength={MAX_DESCRIPTION_LENGTH}
              />
            </div>
          </div>

          <div className="tx-md-side">
            <span className="tx-md-legend" id="tx-category-label">
              Kategori
            </span>
            <CategoryList
              labelId="tx-category-label"
              value={category}
              onChange={setCategory}
              groups={text.categoryGroups}
              otherHint={text.otherHint}
            />
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
