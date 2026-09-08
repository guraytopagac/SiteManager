import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./DuesModals.css";
import { showDialog } from "@/utils/dialog";
import { formatCurrency } from "@/utils/currency";
import { searchKey } from "@/utils/searchKey";

function SingleUpdateModal({ dues, building, onClose, onSaved }) {
  const [apartmentId, setApartmentId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [amount, setAmount] = useState("");
  const [applyCurrentMonth, setApplyCurrentMonth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedDue = dues.find((due) => due.apartment_id === apartmentId) || null;

  const term = searchKey(searchTerm).trim();
  const matches = dues.filter((due) => {
    if (!term) return true;
    return searchKey(due.apartment_no).includes(term) || searchKey(due.resident_name).includes(term);
  });

  const handleSelect = (due) => {
    setApartmentId(due.apartment_id);
    setAmount(String(due.due_amount));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedDue) {
      showDialog.warning("Daire Seçilmedi", "Lütfen aidatını güncelleyeceğiniz daireyi seçin.");
      return;
    }

    const dueAmount = parseFloat(amount);
    if (!dueAmount || dueAmount <= 0) {
      showDialog.warning("Geçersiz Tutar", "Lütfen geçerli bir aidat tutarı girin.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await window.electronAPI.updateApartment({
        id: selectedDue.apartment_id,
        buildingId: building.id,
        apartment_no: selectedDue.apartment_no,
        floor: selectedDue.floor,
        type: selectedDue.type,
        square_meters: selectedDue.square_meters,
        due_amount: dueAmount,
        applyCurrentMonth,
      });

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[SingleUpdateModal] updateApartment:", err);
      showDialog.error("Hata", "Aidat tutarı güncellenemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <div className="du-md-overlay" onClick={handleClose}>
      <form className="du-md-box" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
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
                      due.apartment_id === apartmentId ? "du-unit-option du-unit-option--active" : "du-unit-option"
                    }
                    aria-pressed={due.apartment_id === apartmentId}
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
            <label htmlFor="single-amount">
              {selectedDue ? `Daire ${selectedDue.apartment_no} için yeni tutar (₺)` : "Yeni Aidat Tutarı (₺)"}
            </label>
            <div className="du-amount-row">
              <input
                id="single-amount"
                type="number"
                min="1"
                max="50000"
                step="1"
                placeholder="Örn: 2000"
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

export default SingleUpdateModal;
