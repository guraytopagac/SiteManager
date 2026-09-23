// Records one income or one expense, the type arriving as a prop. Everything that differs lives in the table
// below, so the only comparison against the type is the line that picks the endpoint. An income asks how it
// was paid and its account follows from that, an expense asks which account paid it. An advance and its
// repayment also name the employee, and saving without one is refused. Neither account may go below zero,
// so the expense form shows what the picked one holds before the service refuses the record.

import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import "./CashBookModals.css";
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
      listClass: "cb-method-list",
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
      listClass: "cb-account-list",
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
      className={option.value === value ? "cb-pick-option cb-pick-option--active" : "cb-pick-option"}
      aria-pressed={option.value === value}
      onClick={() => onChange(option.value)}
    >
      {option.label}
    </button>
  );

  const isGrouped = groups.some((group) => group.label);

  return (
    <div className="cb-pick-panel" role="group" aria-labelledby={labelId}>
      <div className={isGrouped ? "cb-pick-groups cb-pick-groups--columns" : "cb-pick-groups"}>
        {groups.map((group) => (
          <div key={group.label ?? "loose"} className="cb-pick-group">
            {group.label ? <span className="cb-pick-group-title">{group.label}</span> : null}
            {group.categories.map(renderOption)}
          </div>
        ))}
      </div>
      <div className="cb-pick-other">
        <button
          type="button"
          className={value === OTHER_CATEGORY.value ? "cb-pick-option cb-pick-option--active" : "cb-pick-option"}
          aria-pressed={value === OTHER_CATEGORY.value}
          onClick={() => onChange(OTHER_CATEGORY.value)}
        >
          {OTHER_CATEGORY.label}
          <span className="cb-pick-other-hint">{otherHint}</span>
        </button>
      </div>
    </div>
  );
}

function RecordModal({ type, building, balances, onClose, onSaved }) {
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
      .getEmployees({ buildingId: building.id })
      .then((res) => {
        if (isActive) setEmployees(res.success ? res.data : []);
      })
      .catch((err) => {
        console.error("[RecordModal] getEmployees:", err);
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
      console.error("[RecordModal] saveTransaction:", err);
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
    <div className="cb-md-overlay">
      <form className="cb-md-box cb-md-box--split" onSubmit={handleSubmit}>
        <div className="cb-md-head">
          <div className="cb-md-identity">
            <h2 className="cb-md-title">{text.title}</h2>
            <span className="cb-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button
            type="button"
            className="cb-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="cb-md-body cb-md-split">
          <div className="cb-md-main">
            <div className="cb-md-form-grid">
              <div className="cb-md-field">
                <label htmlFor="cb-amount">{text.amountLabel}</label>
                <input
                  id="cb-amount"
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

              <div className="cb-md-field">
                <label htmlFor="cb-date">Tarih</label>
                <input
                  id="cb-date"
                  type="date"
                  value={date}
                  min={getMinDate()}
                  max={getToday()}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="cb-md-field">
              <span className="cb-md-legend" id="cb-choice-label">
                {text.choice.legend}
              </span>
              <div
                className={`cb-cat-list ${text.choice.listClass}`}
                role="radiogroup"
                aria-labelledby="cb-choice-label"
              >
                {Object.entries(text.choice.labels).map(([value, label]) => (
                  <label key={value} className={choice === value ? "cb-cat cb-cat--active" : "cb-cat"}>
                    <input type="radio" name="cb-choice" checked={choice === value} onChange={() => setChoice(value)} />
                    {label}
                  </label>
                ))}
              </div>
              {text.choice.hint ? <p className="cb-md-hint">{text.choice.hint(choice, balances)}</p> : null}
            </div>

            {text.fund ? (
              <div className="cb-md-field">
                <span className="cb-md-legend">{text.fund.legend}</span>
                <button
                  type="button"
                  className={isFromFund ? "cb-switch cb-switch--on" : "cb-switch"}
                  role="switch"
                  aria-checked={isFromFund}
                  onClick={() => setFundChecked((value) => !value)}
                  disabled={isFundLocked}
                >
                  <span className="cb-switch-track" aria-hidden="true">
                    <span className="cb-switch-knob" />
                  </span>
                  {isFromFund ? text.fund.onLabel : text.fund.offLabel}
                </button>
                {isFundLocked ? <span className="cb-md-hint">{text.fund.lockedNote}</span> : null}
              </div>
            ) : null}

            {isAdvance ? (
              <div className="cb-md-field">
                <label htmlFor="cb-employee">{text.employee.label}</label>
                {employees !== null && listedEmployees.length === 0 ? (
                  <p className="cb-md-hint">{text.employee.emptyNote}</p>
                ) : (
                  <select
                    id="cb-employee"
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

            <div className="cb-md-field cb-md-field--grow">
              <label htmlFor="cb-description">Açıklama (isteğe bağlı)</label>
              <textarea
                id="cb-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={text.descriptionPlaceholder}
                maxLength={MAX_DESCRIPTION_LENGTH}
              />
            </div>
          </div>

          <div className="cb-md-side">
            <span className="cb-md-legend" id="cb-category-label">
              Kategori
            </span>
            <CategoryList
              labelId="cb-category-label"
              value={category}
              onChange={setCategory}
              groups={text.categoryGroups}
              otherHint={text.otherHint}
            />
          </div>

          <button type="submit" className="cb-md-btn-solid cb-md-submit" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : text.submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export default RecordModal;
