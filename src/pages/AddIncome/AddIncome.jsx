import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddIncome.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";

function AddIncome() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleIncomeSubmit = async (e) => {
    e.preventDefault();

    const cleanDescription = description.trim();

    if (Number(amount) <= 0) {
      alert.warning("Geçersiz Miktar", "Gelir miktarı 0'dan büyük olmalıdır!");
      return;
    }

    const managerId = currentUser.id;
    if (!managerId) {
      alert.error("Oturum Hatası", "Yönetici bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
      return;
    }

    if (!amount || !cleanDescription) {
      alert.warning("Uyarı", "Lütfen tüm alanları doldurun!");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    setIsSubmitting(true);
    const response = await window.electronAPI.addIncome({
      amount: Number(amount),
      description: cleanDescription,
      date: today,
      manager_id: managerId,
    });

    setIsSubmitting(false);

    if (response.success) {
      alert.success("Gelir Eklendi!", response.message);
      setAmount("");
      setDescription("");
    } else {
      alert.error("Hata Oluştu", response.message || "Gelir kaydedilemedi.");
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

          <button type="submit" id="incomeButton" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Geliri Kaydet"}
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
