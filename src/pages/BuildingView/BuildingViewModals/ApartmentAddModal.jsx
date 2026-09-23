// Adds one apartment, opened from a floor slot with that floor prefilled or from the empty state. The floor
// stays editable, the only route to a floor that is not drawn yet.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./BuildingViewModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { showDialog } from "@/components/Dialog/dialogStore";
import { APARTMENT_TYPES, MAX_DUE_AMOUNT } from "@/utils/constants";

function ApartmentAddModal({ building, initialFloor, onClose, onSaved }) {
  const [apartmentNo, setApartmentNo] = useState("");
  const [floor, setFloor] = useState(initialFloor);
  const [type, setType] = useState("");
  const [squareMeters, setSquareMeters] = useState("");
  const [dueAmount, setDueAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await window.electronAPI.addApartment({
        buildingId: building.id,
        apartment_no: apartmentNo,
        floor: Number(floor),
        type,
        square_meters: squareMeters !== "" ? Number(squareMeters) : null,
        due_amount: Number(dueAmount),
      });

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[ApartmentAddModal] addApartment:", err);
      showDialog.error("Hata", "Daire eklenemedi.");
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
    <div className="bv-md-overlay">
      <form className="bv-md-box" onSubmit={handleSubmit}>
        <div className="bv-md-head">
          <div className="bv-md-identity">
            <h2 className="bv-md-title">Yeni Daire Ekle</h2>
            <span className="bv-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button
            type="button"
            className="bv-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="bv-md-body">
          <div className="bv-md-form-grid">
            <div className="bv-md-field">
              <label htmlFor="add-no">Daire No</label>
              <input
                id="add-no"
                type="text"
                maxLength={10}
                placeholder="Örn. 5"
                value={apartmentNo}
                onChange={(e) => setApartmentNo(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="bv-md-field">
              <label htmlFor="add-floor">Kat</label>
              <input
                id="add-floor"
                type="number"
                min="-2"
                max="99"
                step="1"
                placeholder="Örn. 2"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                required
              />
            </div>

            <div className="bv-md-field">
              <label htmlFor="add-type">Tip</label>
              <select id="add-type" value={type} onChange={(e) => setType(e.target.value)} required>
                <option value="">Seçiniz</option>
                {APARTMENT_TYPES.map((apartmentType) => (
                  <option key={apartmentType} value={apartmentType}>
                    {apartmentType}
                  </option>
                ))}
              </select>
            </div>

            <div className="bv-md-field">
              <label htmlFor="add-square-meters">
                Alan (m²) <span className="bv-md-optional">isteğe bağlı</span>
              </label>
              <input
                id="add-square-meters"
                type="number"
                min="0.1"
                max="1000"
                step="0.1"
                placeholder="Örn. 85"
                value={squareMeters}
                onChange={(e) => setSquareMeters(e.target.value)}
              />
            </div>

            <div className="bv-md-field bv-md-field--wide">
              <label htmlFor="add-due-amount">Aylık Aidat (₺)</label>
              <input
                id="add-due-amount"
                type="number"
                min="0.01"
                max={MAX_DUE_AMOUNT}
                step="0.01"
                placeholder="Örn. 1500"
                value={dueAmount}
                onChange={(e) => setDueAmount(e.target.value)}
                required
              />
              <p className="bv-md-note">
                Aidat tahakkuku <b>bu aydan itibaren</b> başlar. Tutarı sonradan daire bazında değiştirebilirsiniz.
              </p>
            </div>
          </div>

          <button type="submit" className="bv-md-btn-solid bv-md-submit" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Daireyi Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ApartmentAddModal;
