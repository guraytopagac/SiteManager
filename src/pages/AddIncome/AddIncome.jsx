import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import "./AddIncome.css";

function AddIncome() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const handleIncomeSubmit = async (e) => {
    e.preventDefault();

    const cleanDescription = description.trim();

    if (Number(amount) <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Geçersiz Miktar",
        text: "Gelir miktarı 0'dan büyük olmalıdır!",
        confirmButtonColor: "#f59e0b",
        heightAuto: false,
      });
      return;
    }

    const currentUserRaw = sessionStorage.getItem("currentUser");
    if (!currentUserRaw) {
      Swal.fire({
        icon: "error",
        title: "Oturum Hatası",
        text: "Yönetici bilgisi bulunamadı. Lütfen tekrar giriş yapın.",
        confirmButtonColor: "#dc2626",
        heightAuto: false,
      });
      return;
    }

    const currentUser = JSON.parse(currentUserRaw);
    const managerId = currentUser.id;

    const today = new Date().toISOString().split("T")[0];

    if (amount && cleanDescription) {
      const response = await window.electronAPI.addIncome({
        amount: Number(amount),
        description: cleanDescription,
        date: today,
        manager_id: managerId,
      });

      if (response.success) {
        Swal.fire({
          icon: "success",
          title: "Gelir Eklendi!",
          text: response.message,
          timer: 2000,
          timerProgressBar: true,
          showConfirmButton: false,
          heightAuto: false,
        });
        setAmount("");
        setDescription("");
      } else {
        Swal.fire({
          icon: "error",
          title: "Hata Oluştu",
          text: response.message || "Gelir kaydedilemedi.",
          confirmButtonText: "Tamam",
          confirmButtonColor: "#dc2626",
          heightAuto: false,
        });
      }
    } else {
      Swal.fire("Uyarı", "Lütfen tüm alanları doldurun!", "warning");
    }
  };

  return (
    <div className="income-wrapper">
      <div className="incomeContainer">
        <h2 className="title">Yeni Gelir Ekle</h2>

        <form className="incomeForm" onSubmit={handleIncomeSubmit}>
          <div className="formGroup">
            <label htmlFor="incomeAmount">Gelir Miktarı (₺)</label>
            <input
              type="number"
              id="incomeAmount"
              step="0.01"
              min="0.01"
              placeholder="Miktar girin (Örn: 1500.50)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="formGroup">
            <label htmlFor="incomeDescription">Açıklama</label>
            <textarea
              id="incomeDescription"
              placeholder="Gelirin kaynağını yazın (Örn: A Blok Daire 5 Aidat Ödemesi)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <button type="submit" id="incomeButton">
            Geliri Kaydet
          </button>
          <button type="button" id="backButton" onClick={() => navigate("/dashboard")}>
            Geri Dön
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddIncome;
