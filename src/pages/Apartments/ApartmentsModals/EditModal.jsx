import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./ApartmentsModals.css";
import { showAlert } from "@/utils/alert";
import { APARTMENT_TYPES } from "@/utils/constants";

function EditModal({ apartment, building, onClose, onSaved }) {
  const [apartmentNo, setApartmentNo] = useState(apartment.apartment_no || "");
  const [floor, setFloor] = useState(apartment.floor ?? "");
  const [type, setType] = useState(apartment.type || "1+1");
  const [squareMeters, setSquareMeters] = useState(apartment.square_meters ?? "");
  const [dueAmount, setDueAmount] = useState(apartment.due_amount ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await window.electronAPI.updateApartment({
        id: apartment.apartment_id,
        buildingId: building.id,
        apartment_no: apartmentNo,
        floor: floor !== "" ? Number(floor) : null,
        type,
        square_meters: squareMeters ? Number(squareMeters) : null,
        due_amount: Number(dueAmount),
      });

      if (res.success) {
        showAlert.toast(res.message);
        onSaved();
      } else {
        showAlert.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[EditModal] updateApartment:", err);
      showAlert.error("Hata", "Daire güncellenemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <div className="ap-md-overlay" onClick={handleClose}>
      <form className="ap-md-box ap-md-box--sm" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="ap-md-head">
          <div className="ap-md-identity">
            <h2 className="ap-md-title">Daireyi Düzenle</h2>
            <span className="ap-md-scope">Daire {apartment.apartment_no}</span>
          </div>
          <button
            type="button"
            className="ap-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="ap-md-body">
          <div className="ap-md-form-grid">
            <div className="ap-md-field">
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
            <div className="ap-md-field">
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
            <div className="ap-md-field">
              <label htmlFor="edit-type">Tip</label>
              <select id="edit-type" value={type} onChange={(e) => setType(e.target.value)}>
                {APARTMENT_TYPES.map((apartmentType) => (
                  <option key={apartmentType} value={apartmentType}>
                    {apartmentType}
                  </option>
                ))}
              </select>
            </div>
            <div className="ap-md-field">
              <label htmlFor="edit-square-meters">
                Alan (m²) <span className="ap-md-optional">isteğe bağlı</span>
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
            <div className="ap-md-field ap-md-field--wide">
              <label htmlFor="edit-due-amount">Aylık Aidat (₺)</label>
              <input
                id="edit-due-amount"
                type="number"
                min="0.01"
                max="50000"
                step="0.01"
                value={dueAmount}
                onChange={(e) => setDueAmount(e.target.value)}
                required
              />
              <p className="ap-md-note">
                Yeni tutar <b>bu aydan itibaren</b> geçerli olur. Geçmiş aylar ve bu ay ödeme alınmış daireler eski
                tutarda kalır.
              </p>
            </div>
          </div>

          <button type="submit" className="ap-md-btn-solid ap-md-submit" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditModal;
