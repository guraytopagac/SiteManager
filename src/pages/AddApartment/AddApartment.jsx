import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddApartment.css";
import Swal from "sweetalert2";

function AddApartment() {
  const navigate = useNavigate();
  const [apartmentData, setApartmentData] = useState({
    apartment_no: "",
    floor: "",
    type: "1+1",
    square_meters: "",
    due_amount: "",
  });

  const handleAddApartment = async (e) => {
    e.preventDefault();
    const currentUser = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
    const userId = currentUser.id;
    const response = await window.electronAPI.addApartment({
      ...apartmentData,
      manager_id: userId,
    });

    if (response.success) {
      Swal.fire({
        icon: "success",
        title: "Başarılı!",
        text: response.message,
        confirmButtonText: "Tamam",
        heightAuto: false,
      }).then(() => {
        navigate("/dashboard");
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "Hata",
        text: response.message,
        heightAuto: false,
      });
    }
  };
  return (
    <div className="form-container">
      <h2>Yeni Daire Ekle</h2>
      <form onSubmit={handleAddApartment} className="apartment-form">
        <div className="input-group">
          <label>Daire No</label>
          <input
            type="text"
            required
            onChange={(e) =>
              setApartmentData({
                ...apartmentData,
                apartment_no: e.target.value,
              })
            }
          />
        </div>
        <div className="input-group">
          <label>Kat</label>
          <input
            type="number"
            required
            onChange={(e) => setApartmentData({ ...apartmentData, floor: e.target.value })}
          />
        </div>
        <div className="input-group">
          <label>Daire Tipi</label>
          <select onChange={(e) => setApartmentData({ ...apartmentData, type: e.target.value })}>
            <option value="1+1">1+1</option>
            <option value="2+1">2+1</option>
            <option value="3+1">3+1</option>
            <option value="4+1">4+1</option>
          </select>
        </div>
        <div className="input-group">
          <label>Metrekare</label>
          <input
            type="number"
            step="0.1"
            onChange={(e) =>
              setApartmentData({
                ...apartmentData,
                square_meters: e.target.value,
              })
            }
          />
        </div>
        <div className="input-group">
          <label>Aidat Tutarı (₺)</label>
          <input
            type="number"
            required
            onChange={(e) => setApartmentData({ ...apartmentData, due_amount: e.target.value })}
          />
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
