import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddApartment.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useCurrentBuilding } from "@/hooks/useCurrentBuilding";
import { APARTMENT_TYPES } from "@/pages/Apartments/constants";
import { showAlert } from "@/utils/alert";

const INITIAL_DATA = {
  apartment_no: "",
  floor: "",
  type: "",
  square_meters: "",
  due_amount: "",
};

function AddApartment() {
  const navigate = useNavigate();
  const building = useCurrentBuilding();
  const [submitting, setSubmitting] = useState(false);
  const [apartmentData, setApartmentData] = useState(INITIAL_DATA);

  const set = (field) => (e) => setApartmentData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleAddApartment = async (e) => {
    e.preventDefault();

    if (!apartmentData.apartment_no.trim()) {
      return showAlert.error("Hata", "Daire numarası boş bırakılamaz.");
    }
    if (!apartmentData.type) {
      return showAlert.error("Hata", "Lütfen daire tipini seçin.");
    }
    if (Number(apartmentData.due_amount) <= 0) {
      return showAlert.error("Hata", "Aidat tutarı sıfırdan büyük olmalıdır.");
    }

    setSubmitting(true);
    const response = await window.electronAPI.addApartment({
      ...apartmentData,
      floor: apartmentData.floor !== "" ? Number(apartmentData.floor) : null,
      square_meters: apartmentData.square_meters !== "" ? Number(apartmentData.square_meters) : null,
      due_amount: Number(apartmentData.due_amount),
      buildingId: building.id,
    });
    setSubmitting(false);

    if (response.success) {
      const addAnother = await showAlert.confirm("Başarılı!", response.message, "Ana Sayfaya Dön", "Başka Daire Ekle");
      if (addAnother) {
        setApartmentData(INITIAL_DATA);
      } else {
        navigate("/dashboard");
      }
    } else {
      showAlert.error("Hata", response.message);
    }
  };

  const handleCancel = () => {
    const hasData = Object.values(apartmentData).some((v) => v !== "");
    if (!hasData) return navigate("/dashboard");
    showAlert
      .confirm("İptal", "Girilen bilgiler kaybolacak. Emin misiniz?", "Vazgeç", "Evet, Çık")
      .then((confirmed) => {
        if (confirmed) navigate("/dashboard");
      });
  };

  return (
    <div className="add-apartment-container">
      <div className="account-menu-row">
        <AccountMenu />
      </div>

      <form onSubmit={handleAddApartment}>
        <section className="form-card">
          <h3 className="form-section-title">Daire Bilgileri</h3>

          <div className="form-grid">
            <div className="input-group span-full">
              <label>
                Daire No <span className="req">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Örn: 5"
                value={apartmentData.apartment_no}
                onChange={set("apartment_no")}
              />
            </div>
            <div className="input-group">
              <label>
                Kat <span className="req">*</span>
              </label>
              <input
                type="number"
                required
                min="-2"
                placeholder="Örn: 2"
                value={apartmentData.floor}
                onChange={set("floor")}
              />
            </div>
            <div className="input-group">
              <label>
                Daire Tipi <span className="req">*</span>
              </label>
              <select value={apartmentData.type} onChange={set("type")} required>
                <option value="">— Seçiniz —</option>
                {APARTMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>
                Metrekare <span className="optional-label">(isteğe bağlı)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Örn: 85"
                value={apartmentData.square_meters}
                onChange={set("square_meters")}
              />
            </div>
            <div className="input-group">
              <label>
                Aidat Tutarı (₺) <span className="req">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                placeholder="Örn: 1500"
                value={apartmentData.due_amount}
                onChange={set("due_amount")}
              />
            </div>
          </div>
        </section>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={handleCancel}>
            İptal
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Kaydediliyor..." : "Daireyi Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddApartment;
