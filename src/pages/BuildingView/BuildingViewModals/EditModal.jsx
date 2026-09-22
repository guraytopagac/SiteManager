// Edits the identity of an apartment only. No due amount: the figure on this page is the frozen amount of the
// viewed month, and sending it would silently pull the current amount back to an old one.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./BuildingViewModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { showDialog } from "@/components/Dialog/dialogStore";
import { APARTMENT_TYPES } from "@/utils/constants";

function EditModal({ apartment, building, onClose, onSaved }) {
  const [apartmentNo, setApartmentNo] = useState(apartment.apartment_no || "");
  const [floor, setFloor] = useState(apartment.floor);
  const [type, setType] = useState(apartment.type || "1+1");
  const [squareMeters, setSquareMeters] = useState(apartment.square_meters ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await window.electronAPI.updateApartment({
        id: apartment.apartment_id,
        buildingId: building.id,
        apartment_no: apartmentNo,
        floor: Number(floor),
        type,
        square_meters: squareMeters ? Number(squareMeters) : null,
      });

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[EditModal] updateApartment:", err);
      showDialog.error("Hata", "Daire güncellenemedi.");
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
            <h2 className="bv-md-title">Daireyi Düzenle</h2>
            <span className="bv-md-scope">Daire {apartment.apartment_no}</span>
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
              <label htmlFor="edit-apartment-no">Daire No</label>
              <input
                id="edit-apartment-no"
                type="text"
                maxLength={10}
                value={apartmentNo}
                onChange={(e) => setApartmentNo(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="bv-md-field">
              <label htmlFor="edit-floor">Kat</label>
              <input
                id="edit-floor"
                type="number"
                min="-2"
                max="99"
                step="1"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                required
              />
            </div>

            <div className="bv-md-field">
              <label htmlFor="edit-type">Tip</label>
              <select id="edit-type" value={type} onChange={(e) => setType(e.target.value)}>
                {APARTMENT_TYPES.map((apartmentType) => (
                  <option key={apartmentType} value={apartmentType}>
                    {apartmentType}
                  </option>
                ))}
              </select>
            </div>

            <div className="bv-md-field">
              <label htmlFor="edit-square-meters">
                Alan (m²) <span className="bv-md-optional">isteğe bağlı</span>
              </label>
              <input
                id="edit-square-meters"
                type="number"
                min="0.1"
                max="1000"
                step="0.1"
                value={squareMeters}
                onChange={(e) => setSquareMeters(e.target.value)}
              />
            </div>

            <p className="bv-md-note bv-md-field--wide">
              Bu form yalnızca daireyi değiştirir. Aidat tutarı <b>Aidat Takibi</b>, sakin bilgileri <b>Sakinler</b>{" "}
              sayfasından güncellenir.
            </p>
          </div>

          <button type="submit" className="bv-md-btn-solid bv-md-submit" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditModal;
