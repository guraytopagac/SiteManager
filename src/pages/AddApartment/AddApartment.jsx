import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddApartment.css";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { showAlert } from "@/utils/alert";

const INITIAL_DATA = {
  apartment_no: "",
  floor: "",
  type: "1+1",
  square_meters: "",
  due_amount: "",
  resident_name: "",
  resident_phone: "",
  resident_email: "",
  resident_national_id: "",
  resident_type: "",
  resident_move_in_date: "",
  resident_move_out_date: "",
  resident_notes: "",
};

function AddApartment() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [submitting, setSubmitting] = useState(false);
  const [apartmentData, setApartmentData] = useState(INITIAL_DATA);

  const set = (field) => (e) => setApartmentData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleAddApartment = async (e) => {
    e.preventDefault();

    if (!apartmentData.apartment_no.trim()) {
      return showAlert.error("Hata", "Daire numarası boş bırakılamaz.");
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
      manager_id: currentUser.id,
    });
    setSubmitting(false);

    if (response.success) {
      const result = await showAlert.confirm("Başarılı!", response.message, "Başka Daire Ekle", false, "Dashboard'a Dön");
      if (result.isConfirmed) {
        setApartmentData(INITIAL_DATA);
      } else {
        navigate("/dashboard");
      }
    } else {
      showAlert.error("Hata", response.message);
    }
  };

  const handleCancel = () => {
    const hasData = Object.entries(apartmentData).some(
      ([k, v]) => v !== "" && !(k === "type" && v === "1+1"),
    );
    if (!hasData) return navigate("/dashboard");
    showAlert.confirm("İptal", "Girilen bilgiler kaybolacak. Emin misiniz?", "Evet, Çık").then((r) => {
      if (r.isConfirmed) navigate("/dashboard");
    });
  };

  return (
    <div className="add-apartment-container">
      <h2 className="page-title">Yeni Daire Ekle</h2>
      <form onSubmit={handleAddApartment}>
        <div className="form-columns">
          <div className="form-card">
            <h3 className="form-section-title">Daire Bilgileri</h3>
            <div className="form-grid">
              <div className="input-group">
                <label>Daire No</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: 5"
                  value={apartmentData.apartment_no}
                  onChange={set("apartment_no")}
                />
              </div>
              <div className="input-group">
                <label>Kat</label>
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
                <label>Daire Tipi</label>
                <select value={apartmentData.type} onChange={set("type")}>
                  <option value="0+1">0+1</option>
                  <option value="1+1">1+1</option>
                  <option value="2+1">2+1</option>
                  <option value="3+1">3+1</option>
                  <option value="4+1">4+1</option>
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
              <div className="input-group span-full">
                <label>Aidat Tutarı (₺)</label>
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
          </div>

          <div className="form-card form-card-optional">
            <h3 className="form-section-title">
              Sakin Bilgileri <span className="optional-label">(isteğe bağlı)</span>
            </h3>

            <div className="form-grid">
              <div className="input-group span-full">
                <label>Ad Soyad</label>
                <input
                  type="text"
                  placeholder="Sakin adı soyadı"
                  value={apartmentData.resident_name}
                  onChange={set("resident_name")}
                />
              </div>
              <div className="input-group">
                <label>Telefon</label>
                <input
                  type="tel"
                  placeholder="0555 000 00 00"
                  value={apartmentData.resident_phone}
                  onChange={set("resident_phone")}
                />
              </div>
              <div className="input-group">
                <label>E-posta</label>
                <input
                  type="email"
                  placeholder="ornek@email.com"
                  value={apartmentData.resident_email}
                  onChange={set("resident_email")}
                />
              </div>
              <div className="input-group">
                <label>TC Kimlik No</label>
                <input
                  type="text"
                  maxLength={11}
                  placeholder="11 haneli TC kimlik"
                  value={apartmentData.resident_national_id}
                  onChange={set("resident_national_id")}
                />
              </div>
              <div className="input-group">
                <label>Sakin Türü</label>
                <select value={apartmentData.resident_type} onChange={set("resident_type")}>
                  <option value="">— Seçiniz —</option>
                  <option value="tenant">Kiracı</option>
                  <option value="owner">Malik</option>
                </select>
              </div>
              <div className="input-group">
                <label>Giriş Tarihi</label>
                <input
                  type="date"
                  value={apartmentData.resident_move_in_date}
                  onChange={set("resident_move_in_date")}
                />
              </div>
              <div className="input-group">
                <label>Çıkış Tarihi</label>
                <input
                  type="date"
                  value={apartmentData.resident_move_out_date}
                  onChange={set("resident_move_out_date")}
                />
              </div>
              <div className="input-group span-full">
                <label>Notlar</label>
                <textarea
                  placeholder="Örn: Evcil hayvanı var, sakin birisi"
                  value={apartmentData.resident_notes}
                  onChange={set("resident_notes")}
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={handleCancel}>
            İptal
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddApartment;
