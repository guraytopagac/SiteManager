import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./ResidentsModals.css";
import { showDialog } from "@/utils/dialog";
import { getToday } from "@/utils/date";

function MoveOutModal({ apartment, building, onClose, onSaved }) {
  const [moveOutDate, setMoveOutDate] = useState(() => getToday());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.moveOutResident({
        residentId: apartment.resident_id,
        buildingId: building.id,
        moveOutDate,
      });

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[MoveOutModal] moveOutResident:", err);
      showDialog.error("Hata", "Beklenmedik bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rs-md-overlay" onClick={onClose}>
      <form className="rs-md-box rs-md-box--sm" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="rs-md-head">
          <div>
            <span className="rs-md-eyebrow">Daire {apartment.apartment_no}</span>
            <h2 className="rs-md-title">Sakin Çıkışı</h2>
          </div>
          <button type="button" className="rs-md-close" onClick={onClose} aria-label="Kapat">
            <FiX />
          </button>
        </div>

        <div className="rs-md-body">
          <p className="rs-md-note">
            <b>{apartment.full_name || "Sakin"}</b> çıkış yapmış olarak işaretlenecek. Geçmiş kaydı korunur. Gelecekteki
            bir tarih girerseniz sakin o tarihe kadar aktif kalır.
          </p>

          <div className="rs-md-field">
            <label htmlFor="move-out-date">Çıkış Tarihi</label>
            <input
              id="move-out-date"
              type="date"
              value={moveOutDate}
              onChange={(e) => setMoveOutDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="rs-md-foot">
          <button type="button" className="rs-md-btn-ghost" onClick={onClose}>
            İptal
          </button>
          <button type="submit" className="rs-md-btn-solid" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Çıkış Yaptır"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default MoveOutModal;
