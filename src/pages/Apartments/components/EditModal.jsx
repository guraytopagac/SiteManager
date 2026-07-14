import { useState } from "react";
import PropTypes from "prop-types";
import { showAlert } from "@/utils/alert";
import { APARTMENT_TYPES } from "../constants";

function EditModal({ apartment, currentUser, onClose, onSaved }) {
  const [form, setForm] = useState({
    apartment_no: apartment.apartment_no || "",
    floor: apartment.floor ?? "",
    type: apartment.type || "1+1",
    square_meters: apartment.square_meters ?? "",
    due_amount: apartment.due_amount ?? "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await window.electronAPI.updateApartment(apartment.apartment_id, {
      ...form,
      floor: Number(form.floor),
      square_meters: form.square_meters ? Number(form.square_meters) : null,
      due_amount: Number(form.due_amount),
      managerId: currentUser.id,
    });
    setIsSubmitting(false);

    if (res.success) {
      await showAlert.success("Güncellendi", res.message);
      onSaved();
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Daireyi Düzenle</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <h4 className="modal-section-title">Daire Bilgileri</h4>

          <div className="edit-form-grid">
            <div className="form-row">
              <label>Daire No</label>
              <input type="text" value={form.apartment_no} onChange={set("apartment_no")} required />
            </div>
            <div className="form-row">
              <label>Kat</label>
              <input type="number" value={form.floor} onChange={set("floor")} required />
            </div>
            <div className="form-row">
              <label>Tip</label>
              <select value={form.type} onChange={set("type")}>
                {APARTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>m²</label>
              <input type="number" step="0.1" value={form.square_meters} onChange={set("square_meters")} />
            </div>
            <div className="form-row">
              <label>Aidat (₺)</label>
              <input type="number" step="0.01" value={form.due_amount} onChange={set("due_amount")} required />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              İptal
            </button>
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

EditModal.propTypes = {
  apartment: PropTypes.object.isRequired,
  currentUser: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default EditModal;
