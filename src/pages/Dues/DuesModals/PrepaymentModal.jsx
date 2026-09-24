// Dues paid ahead of time, both ways. Collecting pays every month of the chosen range in full, refunding hands
// back every paid month of it. The months are listed on the right in both modes and the range is picked there,
// first click the start and second click the end, so the manager sees what the total covers before saving.

import { useEffect, useState } from "react";
import { FiCheck, FiChevronDown, FiX } from "react-icons/fi";
import "./DuesModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { showDialog } from "@/components/Dialog/dialogStore";
import { CASH_ACCOUNT_LABELS, PAYMENT_METHOD_LABELS, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { formatMonthYear, getMinDate, getToday, toPeriod } from "@/utils/date";
import { searchKey } from "@/utils/searchKey";

// Everything that differs between the two modes. Collecting counts what is still owed in the chosen range,
// refunding counts what was paid in it.
const MODES = {
  collect: {
    label: "Tahsilat",
    listTitle: "Kapsanan Aylar",
    emptyMessage: "Seçilen ayların tamamı zaten ödenmiş.",
    submitLabel: "Peşin Ödemeyi Kaydet",
    amountOf: (item) => item.remaining,
  },
  refund: {
    label: "İade",
    listTitle: "İade Edilecek Aylar",
    emptyMessage: "Seçilen aylarda iade edilecek ödeme yok.",
    submitLabel: "İadeyi Kaydet",
    amountOf: (item) => item.paid_amount,
  },
};

// Both modes start with no month picked, since a preselected range left the manager unsure what to do.
const EMPTY_RANGE = { start: null, end: null };

// A first click sets the start, a second one the end, and a third starts over. A second click before the start
// swaps the two, so the range never runs backwards. With only the start picked the range is that one month.
function nextRange(range, period) {
  if (range.start === null || range.end !== null) return { start: period, end: null };
  if (period < range.start) return { start: period, end: range.start };
  return { start: range.start, end: period };
}

// Kept short, since the hint shares one line with the list title in a 340px column.
function rangeHint(range) {
  if (range.start === null) return "İlk ayı seçin";
  if (range.end === null) return "Son ayı seçin";
  return "Aralık seçildi";
}

// The months as the confirmation reads them: one month by name, a range with its count.
function coverPhrase(covered) {
  if (covered.length === 1) return `${monthSpan(covered)} ayının`;
  return `${monthSpan(covered)} arası ${covered.length} ayın`;
}

function monthSpan(covered) {
  const first = covered[0];
  const last = covered[covered.length - 1];
  return covered.length === 1
    ? formatMonthYear(first.year, first.month)
    : `${formatMonthYear(first.year, first.month)} - ${formatMonthYear(last.year, last.month)}`;
}

function PrepaymentModal({ dues, session, building, onClose, onSaved }) {
  const [mode, setMode] = useState("collect");
  const [apartmentId, setApartmentId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [months, setMonths] = useState([]);
  const [planError, setPlanError] = useState("");
  const [range, setRange] = useState(EMPTY_RANGE);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [collector, setCollector] = useState(session.managerName);
  const [payee, setPayee] = useState(session.managerName);
  const [account, setAccount] = useState("cash");
  const [date, setDate] = useState(getToday());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const text = MODES[mode];
  const selectedDue = dues.find((due) => due.apartment_id === apartmentId) || null;

  const term = searchKey(searchTerm);
  const matches = dues.filter((due) => {
    if (!term) return true;
    return searchKey(due.apartment_no).includes(term) || searchKey(due.resident_name).includes(term);
  });

  // An effect rather than the suspending reader, the same exception every modal list takes. The flag drops a
  // reply that arrives after another apartment was picked.
  useEffect(() => {
    if (apartmentId === null) return undefined;
    let isCurrent = true;

    (async () => {
      try {
        const res = await window.electronAPI.getPrepaymentPlan({ apartmentId, buildingId: building.id });
        if (!isCurrent) return;
        if (res.success) {
          setMonths(res.data);
          setPlanError("");
        } else {
          setMonths([]);
          setPlanError(res.message || "Peşin ödeme bilgileri alınamadı.");
        }
      } catch (err) {
        console.error("[PrepaymentModal] getPrepaymentPlan:", err);
        if (isCurrent) {
          setMonths([]);
          setPlanError(UNEXPECTED_ERROR_MESSAGE);
        }
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [apartmentId, building.id]);

  const rangeEnd = range.end ?? range.start;
  const isInRange = (period) => range.start !== null && period >= range.start && period <= rangeEnd;
  const rangeMonths = months.filter((item) => isInRange(toPeriod(item.year, item.month)) && text.amountOf(item) > 0);
  const rangeTotal = rangeMonths.reduce((sum, item) => sum + Math.round(text.amountOf(item) * 100), 0) / 100;

  const handleSelect = (due) => {
    if (due.apartment_id === apartmentId) return;
    setApartmentId(due.apartment_id);
    setMonths([]);
    setPlanError("");
    setRange(EMPTY_RANGE);
  };

  // The two modes count different amounts, so a range picked for one is not carried over to the other.
  const changeMode = (key) => {
    setMode(key);
    setRange(EMPTY_RANGE);
  };

  const selectMonth = (period) => {
    setRange((current) => nextRange(current, period));
  };

  const collect = () =>
    window.electronAPI.recordPrepayment({
      apartmentId: selectedDue.apartment_id,
      buildingId: building.id,
      startYear: rangeMonths[0].year,
      startMonth: rangeMonths[0].month,
      endYear: rangeMonths[rangeMonths.length - 1].year,
      endMonth: rangeMonths[rangeMonths.length - 1].month,
      paymentData: {
        payment_method: paymentMethod,
        payment_date: date,
        note: `Peşin ödeme: ${monthSpan(rangeMonths)}`,
        collector_name: collector.trim() || null,
        collected_by: session.id,
      },
    });

  const refund = () =>
    window.electronAPI.refundPrepayment({
      apartmentId: selectedDue.apartment_id,
      buildingId: building.id,
      userId: session.id,
      startYear: rangeMonths[0].year,
      startMonth: rangeMonths[0].month,
      endYear: rangeMonths[rangeMonths.length - 1].year,
      endMonth: rangeMonths[rangeMonths.length - 1].month,
      refund: { payee_name: payee, account, date },
    });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedDue) {
      showDialog.warning("Daire Seçilmedi", "Lütfen işlem yapılacak daireyi seçin.");
      return;
    }
    if (range.start === null) {
      showDialog.warning("Ay Seçilmedi", "Lütfen listeden başlangıç ve bitiş ayını seçin.");
      return;
    }
    if (rangeMonths.length === 0) {
      showDialog.warning("Kapsanan Ay Yok", text.emptyMessage);
      return;
    }
    if (mode === "refund" && payee.trim().length < 2) {
      showDialog.warning("İade Edilen Kişi", "Lütfen parayı geri alan kişinin adını girin.");
      return;
    }

    const confirmed =
      mode === "collect"
        ? await showDialog.confirm(
            "Peşin Ödeme",
            <>
              <b>Daire {selectedDue.apartment_no}</b> için {coverPhrase(rangeMonths)} aidatı{" "}
              <b>{formatCurrency(rangeTotal)}</b> olarak tahsil edilecek.
            </>,
            "Vazgeç",
            "Kaydet",
          )
        : await showDialog.confirmDanger(
            "Aidat İadesi",
            <>
              <b>Daire {selectedDue.apartment_no}</b> için {coverPhrase(rangeMonths)} ödemesi,{" "}
              <b>{formatCurrency(rangeTotal)}</b> olarak <b>{payee.trim()}</b> adına iade edilecek. Bu işlem geri
              alınamaz.
            </>,
            "Vazgeç",
            "İade Et",
          );
    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      const res = await (mode === "collect" ? collect() : refund());
      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[PrepaymentModal] submit:", err);
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

  // A month with nothing to count says why: paid in full when collecting, never paid when refunding.
  const renderMonthState = (item) => {
    const amount = text.amountOf(item);
    if (mode === "collect" && amount <= 0) {
      return (
        <span className="du-pre-month-paid">
          <FiCheck aria-hidden="true" />
          Ödendi
        </span>
      );
    }
    if (mode === "refund" && amount <= 0) {
      return <span className="du-pre-month-none">Ödeme yok</span>;
    }
    return <span className="du-pre-month-amount">{formatCurrency(amount)}</span>;
  };

  const renderMonths = () => {
    if (!selectedDue) {
      return <p className="du-pre-empty">Daire seçildiğinde aylar burada listelenir.</p>;
    }
    if (planError) {
      return (
        <p className="du-pre-empty" role="alert">
          {planError}
        </p>
      );
    }
    if (months.length === 0) {
      return <p className="du-pre-empty">Yükleniyor...</p>;
    }

    return (
      <div className="du-pre-list">
        {months.map((item) => {
          const period = toPeriod(item.year, item.month);
          const isCovered = isInRange(period) && text.amountOf(item) > 0;
          const isEdge = period === range.start || period === range.end;
          const classes = ["du-pre-month"];
          if (isCovered) classes.push(`du-pre-month--${mode}`);
          if (isEdge) classes.push("du-pre-month--edge");

          return (
            <button
              key={period}
              type="button"
              className={classes.join(" ")}
              aria-pressed={isEdge}
              onClick={() => selectMonth(period)}
            >
              <span className="du-pre-month-name">{formatMonthYear(item.year, item.month)}</span>
              {renderMonthState(item)}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="du-md-overlay">
      <form className="du-md-box du-md-box--wide" onSubmit={handleSubmit}>
        <div className="du-md-head">
          <div className="du-md-identity">
            <h2 className="du-md-title">Peşin Aidat</h2>
            <span className="du-md-scope" title={building.name}>
              {building.name}
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

        <div className="du-md-body du-pre-body">
          <div className="du-md-stack">
            <div className="du-pre-modes" role="group" aria-label="İşlem türü">
              {Object.entries(MODES).map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  className={key === mode ? "du-pre-mode du-pre-mode--active" : "du-pre-mode"}
                  aria-pressed={key === mode}
                  onClick={() => changeMode(key)}
                  disabled={isSubmitting}
                >
                  {value.label}
                </button>
              ))}
            </div>

            <div className="du-md-field">
              <label htmlFor="prepay-search">Daire</label>
              <input
                id="prepay-search"
                type="text"
                placeholder="Daire no veya sakin ara"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              <div className="du-unit-list du-unit-list--tall">
                {matches.length === 0 ? (
                  <p className="du-unit-empty">Eşleşen daire yok.</p>
                ) : (
                  matches.map((due) => (
                    <button
                      key={due.apartment_id}
                      type="button"
                      className={
                        due.apartment_id === apartmentId ? "du-unit-option du-unit-option--active" : "du-unit-option"
                      }
                      aria-pressed={due.apartment_id === apartmentId}
                      onClick={() => handleSelect(due)}
                    >
                      <span className="du-unit-option-no">Daire {due.apartment_no}</span>
                      <span className="du-unit-option-name" title={due.resident_name || undefined}>
                        {due.resident_name || "Sakin yok"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {mode === "collect" ? (
              <>
                <div className="du-amount-row">
                  <div className="du-md-field">
                    <label htmlFor="prepay-method">Ödeme Yöntemi</label>
                    <div className="du-select">
                      <select
                        id="prepay-method"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <FiChevronDown aria-hidden="true" />
                    </div>
                  </div>
                  <div className="du-md-field">
                    <label htmlFor="prepay-date">Ödeme Tarihi</label>
                    <input
                      id="prepay-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      min={getMinDate()}
                      max={getToday()}
                    />
                  </div>
                </div>
                <div className="du-md-field">
                  <label htmlFor="prepay-collector">Tahsil Eden</label>
                  <input
                    id="prepay-collector"
                    type="text"
                    maxLength={60}
                    placeholder="Parayı teslim alan kişi"
                    value={collector}
                    onChange={(e) => setCollector(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="du-amount-row">
                  <div className="du-md-field">
                    <label htmlFor="refund-account">Ödeme Yöntemi</label>
                    <div className="du-select">
                      <select id="refund-account" value={account} onChange={(e) => setAccount(e.target.value)}>
                        {Object.entries(CASH_ACCOUNT_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <FiChevronDown aria-hidden="true" />
                    </div>
                  </div>
                  <div className="du-md-field">
                    <label htmlFor="refund-date">İade Tarihi</label>
                    <input
                      id="refund-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      min={getMinDate()}
                      max={getToday()}
                    />
                  </div>
                </div>
                <div className="du-md-field">
                  <label htmlFor="refund-payee">İade Edilen Kişi</label>
                  <input
                    id="refund-payee"
                    type="text"
                    maxLength={100}
                    placeholder="Örn. Ahmet Yılmaz"
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                  />
                </div>
              </>
            )}

            <button type="submit" className="du-md-btn-solid" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : text.submitLabel}
            </button>
          </div>

          <section className="du-pre-side" aria-label="Kapsanan aylar">
            <div className="du-pre-side-head">
              <span className="du-pre-side-title">{text.listTitle}</span>
              <span className="du-pre-side-hint">{rangeHint(range)}</span>
            </div>
            {renderMonths()}
            <div className="du-pre-total">
              <span>{rangeMonths.length > 0 ? `${rangeMonths.length} ay` : "Toplam"}</span>
              <b>{formatCurrency(rangeTotal)}</b>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}

export default PrepaymentModal;
