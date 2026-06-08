import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddApartment.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";

function AddApartment() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [apartmentData, setApartmentData] = useState({
    apartment_no: "",
    floor: "",
    type: "1+1",
    square_meters: "",
    due_amount: "",
    resident_name: "",
    resident_phone: "",
    resident_email: "",
  });

  const set = (field) => (e) => setApartmentData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleAddApartment = async (e) => {
    e.preventDefault();
    const response = await window.electronAPI.addApartment({
      ...apartmentData,
      manager_id: currentUser.id,
    });

    if (response.success) {
      await alert.success("Başarılı!", response.message);
      navigate("/dashboard");
    } else {
      alert.error("Hata", response.message);
    }
  };

  return (
    <div className="add-apartment-container">
      <h2 className="page-title">Yeni Daire Ekle</h2>
      <form onSubmit={handleAddApartment}>
        <div className="form-card">
          <h3 className="form-section-title">Daire Bilgileri</h3>
          <div className="form-grid">
            <div className="input-group">
              <label>Daire No</label>
              <input type="text" required placeholder="Örn: 5" onChange={set("apartment_no")} />
            </div>
            <div className="input-group">
              <label>Kat</label>
              <input type="number" required placeholder="Örn: 2" onChange={set("floor")} />
            </div>
            <div className="input-group">
              <label>Daire Tipi</label>
              <select onChange={set("type")}>
                <option value="1+1">1+1</option>
                <option value="2+1">2+1</option>
                <option value="3+1">3+1</option>
                <option value="4+1">4+1</option>
              </select>
            </div>
            <div className="input-group">
              <label>Metrekare</label>
              <input type="number" step="0.1" placeholder="Örn: 85" onChange={set("square_meters")} />
            </div>
            <div className="input-group span-full">
              <label>Aidat Tutarı (₺)</label>
              <input type="number" required placeholder="Örn: 1500" onChange={set("due_amount")} />
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
              <input type="text" placeholder="Sakin adı soyadı" onChange={set("resident_name")} />
            </div>
            <div className="input-group">
              <label>Telefon</label>
              <input type="tel" placeholder="0555 000 00 00" onChange={set("resident_phone")} />
            </div>
            <div className="input-group">
              <label>E-posta</label>
              <input type="email" placeholder="ornek@email.com" onChange={set("resident_email")} />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate("/dashboard")}>
            İptal
          </button>
          <button type="submit" className="btn-primary">
            Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddApartment;
