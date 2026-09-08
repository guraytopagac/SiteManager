import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./ResidentsModals.css";
import { showDialog } from "@/utils/dialog";

const EMPTY_FORM = {
  full_name: "",
  phone: "",
  email: "",
  national_id: "",
  resident_type: "",
  household_size: "1",
  move_in_date: "",
  notes: "",
};

function ResidentFormModal({ apartment, building, onClose, onSaved }) {
  const isEdit = Boolean(apartment.resident_id);
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          full_name: apartment.full_name || "",
          phone: apartment.phone || "",
          email: apartment.email || "",
          national_id: apartment.national_id || "",
          resident_type: apartment.resident_type || "",
          household_size: String(apartment.household_size || 1),
          move_in_date: apartment.move_in_date || "",
          notes: apartment.notes || "",
        }
      : EMPTY_FORM,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const residentData = { ...form, household_size: Number(form.household_size) };
      const res = isEdit
        ? await window.electronAPI.updateResident({
            residentId: apartment.resident_id,
            buildingId: building.id,
            ...residentData,
          })
        : await window.electronAPI.addResident({
            apartmentId: apartment.apartment_id,
            buildingId: building.id,
            ...residentData,
          });

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[ResidentFormModal] saveResident:", err);
      showDialog.error("Hata", "Beklenmedik bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rs-md-overlay" onClick={onClose}>
      <form className="rs-md-box" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="rs-md-head">
          <div>
            <span className="rs-md-eyebrow">Daire {apartment.apartment_no}</span>
            <h2 className="rs-md-title">{isEdit ? "Sakini Düzenle" : "Yeni Sakin"}</h2>
          </div>
          <button type="button" className="rs-md-close" onClick={onClose} aria-label="Kapat">
            <FiX />
          </button>
        </div>

        <div className="rs-md-body">
          <div className="rs-md-form-grid">
            <div className="rs-md-field rs-md-field--wide">
              <label htmlFor="resident-full-name">Ad Soyad</label>
              <input
                id="resident-full-name"
                type="text"
                maxLength={60}
                placeholder="İsteğe bağlı"
                value={form.full_name}
                onChange={set("full_name")}
              />
            </div>
            <div className="rs-md-field">
              <label htmlFor="resident-phone">Telefon</label>
              <input
                id="resident-phone"
                type="tel"
                maxLength={20}
                placeholder="İsteğe bağlı"
                value={form.phone}
                onChange={set("phone")}
              />
            </div>
            <div className="rs-md-field">
              <label htmlFor="resident-email">E-posta</label>
              <input
                id="resident-email"
                type="email"
                maxLength={254}
                placeholder="İsteğe bağlı"
                value={form.email}
                onChange={set("email")}
              />
            </div>
            <div className="rs-md-field">
              <label htmlFor="resident-national-id">TC Kimlik No</label>
              <input
                id="resident-national-id"
                type="text"
                inputMode="numeric"
                maxLength={11}
                placeholder="11 haneli TC kimlik"
                value={form.national_id}
                onChange={set("national_id")}
              />
            </div>
            <div className="rs-md-field">
              <label htmlFor="resident-type">Sakin Türü</label>
              <select id="resident-type" value={form.resident_type} onChange={set("resident_type")}>
                <option value="">— Seçiniz —</option>
                <option value="tenant">Kiracı</option>
                <option value="owner">Malik</option>
              </select>
            </div>
            <div className="rs-md-field">
              <label htmlFor="resident-household-size">Dairede Yaşayan Kişi Sayısı</label>
              <input
                id="resident-household-size"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={form.household_size}
                onChange={set("household_size")}
              />
            </div>
            <div className="rs-md-field">
              <label htmlFor="resident-move-in">Giriş Tarihi</label>
              <input id="resident-move-in" type="date" value={form.move_in_date} onChange={set("move_in_date")} />
            </div>
            <div className="rs-md-field rs-md-field--wide">
              <label htmlFor="resident-notes">Notlar</label>
              <textarea
                id="resident-notes"
                maxLength={500}
                placeholder="Sakin hakkında not"
                value={form.notes}
                onChange={set("notes")}
              />
            </div>
          </div>
        </div>

        <div className="rs-md-foot">
          <button type="button" className="rs-md-btn-ghost" onClick={onClose}>
            İptal
          </button>
          <button type="submit" className="rs-md-btn-solid" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ResidentFormModal;
