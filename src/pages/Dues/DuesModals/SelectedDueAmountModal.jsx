// Sets the due amount of one or more selected apartments, with the same period cards as the bulk modal.
// No confirmation step: undoing a selection is just another edit.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./DuesModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { showDialog } from "@/components/Dialog/dialogStore";
import { MAX_DUE_AMOUNT } from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { searchKey } from "@/utils/searchKey";

function SelectedDueAmountModal({ dues, building, onClose, onSaved }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [amount, setAmount] = useState("");
  const [applyCurrentMonth, setApplyCurrentMonth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The amount label names the selection, since selected rows can drop out of the list as the search narrows.
  const selectedDues = dues.filter((due) => selectedIds.includes(due.apartment_id));

  // A searchable list instead of a dropdown, which meant scrolling through fifty entries. The fixed height
  // keeps the box from resizing on every keystroke.
  const term = searchKey(searchTerm);
  const matches = dues.filter((due) => {
    if (!term) return true;
    return searchKey(due.apartment_no).includes(term) || searchKey(due.resident_name).includes(term);
  });

  // A second click removes the apartment from the selection. The first pick still fills in its current amount.
  const handleSelect = (due) => {
    if (selectedIds.includes(due.apartment_id)) {
      setSelectedIds(selectedIds.filter((id) => id !== due.apartment_id));
      return;
    }
    if (selectedIds.length === 0) {
      setAmount(String(due.due_amount));
    }
    setSelectedIds([...selectedIds, due.apartment_id]);
  };

  const amountLabel = () => {
    if (selectedDues.length === 0) return "Yeni Aidat Tutarı (₺)";
    if (selectedDues.length === 1) return `Daire ${selectedDues[0].apartment_no} için yeni tutar (₺)`;
    return `${selectedDues.length} daire için yeni tutar (₺)`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedDues.length === 0) {
      showDialog.warning("Daire Seçilmedi", "Lütfen aidatını güncelleyeceğiniz daireleri seçin.");
      return;
    }

    const dueAmount = parseFloat(amount);
    if (!dueAmount || dueAmount <= 0) {
      showDialog.warning("Geçersiz Tutar", "Lütfen geçerli bir aidat tutarı girin.");
      return;
    }

    setIsSubmitting(true);

    try {
      // One request for the whole selection, so the service writes all of them or none.
      const res = await window.electronAPI.updateDueAmounts({
        buildingId: building.id,
        apartmentIds: selectedIds,
        amount: dueAmount,
        applyCurrentMonth,
      });

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[SelectedDueAmountModal] updateDueAmounts:", err);
      showDialog.error("Hata", "Aidat tutarı güncellenemedi.");
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
    <div className="du-md-overlay">
      <form className="du-md-box" onSubmit={handleSubmit}>
        <div className="du-md-head">
          <div className="du-md-identity">
            <h2 className="du-md-title">Daire Aidatı Güncelleme</h2>
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

        <div className="du-md-body du-md-stack">
          <div className="du-md-field">
            <label htmlFor="single-search">Daire</label>
            <input
              id="single-search"
              type="text"
              placeholder="Daire no veya sakin ara"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            <div className="du-unit-list">
              {matches.length === 0 ? (
                <p className="du-unit-empty">Eşleşen daire yok.</p>
              ) : (
                matches.map((due) => (
                  <button
                    key={due.apartment_id}
                    type="button"
                    className={
                      selectedIds.includes(due.apartment_id)
                        ? "du-unit-option du-unit-option--active"
                        : "du-unit-option"
                    }
                    aria-pressed={selectedIds.includes(due.apartment_id)}
                    onClick={() => handleSelect(due)}
                  >
                    <span className="du-unit-option-no">Daire {due.apartment_no}</span>
                    <span className="du-unit-option-name" title={due.resident_name || undefined}>
                      {due.resident_name || "Sakin yok"}
                    </span>
                    <span className="du-unit-option-amount">{formatCurrency(due.due_amount)}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="du-scope">
            <span className="du-scope-legend" id="single-scope-label">
              Geçerlilik Dönemi
            </span>
            <div className="du-scope-cards" role="radiogroup" aria-labelledby="single-scope-label">
              <label className={applyCurrentMonth ? "du-scope-card" : "du-scope-card du-scope-card--active"}>
                <input
                  type="radio"
                  name="single-scope"
                  checked={!applyCurrentMonth}
                  onChange={() => setApplyCurrentMonth(false)}
                />
                <b>Gelecek ay</b>
                <span>Bu ay dahil tahakkuk etmiş aylar değişmez.</span>
              </label>
              <label className={applyCurrentMonth ? "du-scope-card du-scope-card--active" : "du-scope-card"}>
                <input
                  type="radio"
                  name="single-scope"
                  checked={applyCurrentMonth}
                  onChange={() => setApplyCurrentMonth(true)}
                />
                <b>Bu ay</b>
                <span>Bu ay ödeme alınmışsa eski tutarda kalır.</span>
              </label>
            </div>
          </div>

          <div className="du-md-field">
            <label htmlFor="single-amount">{amountLabel()}</label>
            <div className="du-amount-row">
              <input
                id="single-amount"
                type="number"
                min="1"
                max={MAX_DUE_AMOUNT}
                step="1"
                placeholder="Örn. 2000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <button type="submit" className="du-md-btn-solid du-amount-submit" disabled={isSubmitting}>
                {isSubmitting ? "Güncelleniyor..." : "Güncelle"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default SelectedDueAmountModal;
