// Records one income or one expense, the type arriving as a prop. Everything that differs lives in the table
// below, so the only comparison against the type is the line that picks the endpoint. An income asks how it
// was paid and its account follows from that, an expense asks which account paid it. An advance and its
// repayment also name the employee, and saving without one is refused. Neither account may go below zero,
// so the expense form shows what the picked one holds before the service refuses the record.

import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import "./TransactionsModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  ADVANCE_CATEGORIES,
  CASH_ACCOUNT_LABELS,
  EXPENSE_CATEGORY_GROUPS,
  INCOME_CATEGORY_GROUPS,
  OTHER_CATEGORY,
  PAYMENT_METHOD_LABELS,
  UNEXPECTED_ERROR_MESSAGE,
} from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { showDialog } from "@/components/Dialog/dialogStore";
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
    employee: {
      label: "Avansı İade Eden Çalışan",
      placeholder: "Çalışan seçin",
      emptyNote: "Açık avansı olan bir çalışan bulunmuyor.",
      // Only someone who still owes can pay back, and the open amount helps pick the right figure.
      isListed: (employee) => employee.advance_balance > 0,
      optionLabel: (employee) => `${employee.full_name} · açık avans ${formatCurrency(employee.advance_balance)}`,
    },
    choice: {
      legend: "Ödeme Şekli",
      field: "payment_method",
      labels: PAYMENT_METHOD_LABELS,
      listClass: "tx-method-list",
    },
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
    employee: {
      label: "Avans Verilen Çalışan",
      placeholder: "Çalışan seçin",
      emptyNote: "Kayıtlı çalışan bulunmuyor. Önce Personel sayfasından çalışan ekleyin.",
      // An advance goes to someone still working there.
      isListed: (employee) => !employee.end_date,
      optionLabel: (employee) =>
        employee.advance_balance > 0
          ? `${employee.full_name} · açık avans ${formatCurrency(employee.advance_balance)}`
          : employee.full_name,
    },
    choice: {
      legend: "Ödeme Tipi",
      field: "account",
      labels: CASH_ACCOUNT_LABELS,
      listClass: "tx-account-list",
      // Same sentence the transfer modal writes for its source account.
      hint: (account, balances) =>
        `${CASH_ACCOUNT_LABELS[account]} hesabında şu an ${formatCurrency(balances[account])} görünüyor.`,
    },
    // Only an expense can be paid out of the investment fund, so an income carries no such field.
    fund: {
      legend: "Ödeme Kaynağı",
      onLabel: "Yatırım fonundan",
      offLabel: "Ana kasadan",
      lockedNote: "Bu kalem yatırım fonundan ödenemez.",
    },
  },
};

// A severance transfer and a staff advance belong to a ledger of their own, so neither can come out of the
// investment fund. The schema and the handler refuse it too, this only keeps the switch from offering it.
const FUND_LOCKED_CATEGORIES = ["severance_fund", ...ADVANCE_CATEGORIES];

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

function TransactionModal({ type, building, balances, onClose, onSaved }) {
  const text = TYPES[type];
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [choice, setChoice] = useState("cash");
  const [date, setDate] = useState(() => getToday());
  const [description, setDescription] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState(null);
  const [fundChecked, setFundChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdvance = ADVANCE_CATEGORIES.includes(category);
  const listedEmployees = employees?.filter(text.employee.isListed) ?? [];

  // Read once when the modal opens, like the other modal lists, so the box opens without waiting for it.
  useEffect(() => {
    let isActive = true;
    window.electronAPI
      .getSeveranceEmployees({ buildingId: building.id })
      .then((res) => {
        if (isActive) setEmployees(res.success ? res.data : []);
      })
      .catch((err) => {
        console.error("[TransactionModal] getSeveranceEmployees:", err);
        if (isActive) setEmployees([]);
      });
    return () => {
      isActive = false;
    };
  }, [building.id]);

  // Kept apart from the derived value below: switching to a locked category turns the switch off without
  // forgetting what was picked before it.
  const isFundLocked = FUND_LOCKED_CATEGORIES.includes(category);
  const isFromFund = fundChecked && !isFundLocked;

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

    if (isAdvance && employeeId === "") {
      showDialog.warning("Çalışan Seçilmedi", "Avans kaydı için bir çalışan seçin.");
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
        [text.choice.field]: choice,
        employee_id: isAdvance ? Number(employeeId) : null,
        ...(text.fund ? { is_investment: isFromFund } : {}),
      });

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else if (res.code === "REPAYMENT_EXCEEDS_ADVANCE") {
        showDialog.warning(
          "Tutar Fazla",
          `İade tutarı çalışanın açık avansından fazla olamaz. Açık avans: ${formatCurrency(res.remaining)}`,
        );
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

            <div className="tx-md-field">
              <span className="tx-md-legend" id="tx-choice-label">
                {text.choice.legend}
              </span>
              <div
                className={`tx-cat-list ${text.choice.listClass}`}
                role="radiogroup"
                aria-labelledby="tx-choice-label"
              >
                {Object.entries(text.choice.labels).map(([value, label]) => (
                  <label key={value} className={choice === value ? "tx-cat tx-cat--active" : "tx-cat"}>
                    <input type="radio" name="tx-choice" checked={choice === value} onChange={() => setChoice(value)} />
                    {label}
                  </label>
                ))}
              </div>
              {text.choice.hint ? <p className="tx-md-hint">{text.choice.hint(choice, balances)}</p> : null}
            </div>

            {text.fund ? (
              <div className="tx-md-field">
                <span className="tx-md-legend">{text.fund.legend}</span>
                <button
                  type="button"
                  className={isFromFund ? "tx-switch tx-switch--on" : "tx-switch"}
                  role="switch"
                  aria-checked={isFromFund}
                  onClick={() => setFundChecked((value) => !value)}
                  disabled={isFundLocked}
                >
                  <span className="tx-switch-track" aria-hidden="true">
                    <span className="tx-switch-knob" />
                  </span>
                  {isFromFund ? text.fund.onLabel : text.fund.offLabel}
                </button>
                {isFundLocked ? <span className="tx-md-hint">{text.fund.lockedNote}</span> : null}
              </div>
            ) : null}

            {isAdvance ? (
              <div className="tx-md-field">
                <label htmlFor="tx-employee">{text.employee.label}</label>
                {employees !== null && listedEmployees.length === 0 ? (
                  <p className="tx-md-hint">{text.employee.emptyNote}</p>
                ) : (
                  <select
                    id="tx-employee"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    disabled={employees === null}
                  >
                    <option value="">{employees === null ? "Yükleniyor..." : text.employee.placeholder}</option>
                    {listedEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {text.employee.optionLabel(employee)}
                      </option>
                    ))}
                  </select>
                )}
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
