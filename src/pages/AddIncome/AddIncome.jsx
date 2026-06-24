import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddIncome.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";
import { getToday } from "../../utils/date";

function AddIncome() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleIncomeSubmit = async (e) => {
    e.preventDefault();

    const cleanDescription = description.trim();
    const parsedAmount = Math.round(Number(amount) * 100) / 100;
    const today = getToday();
    const managerId = currentUser?.id;

    if (!managerId) {
      alert.error("Oturum Hatası", "Yönetici bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
      return;
    }

    if (isNaN(parsedAmount) || !cleanDescription) {
      alert.warning("Uyarı", "Lütfen tüm alanları doldurun!");
      return;
    }

    if (parsedAmount <= 0) {
      alert.warning("Geçersiz Miktar", "Gelir miktarı 0'dan büyük olmalıdır!");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await window.electronAPI.addIncome({
        amount: parsedAmount,
        description: cleanDescription,
        category: "other",
        date: today,
        manager_id: managerId,
      });

      if (response.success) {
        setAmount("");
        setDescription("");
        alert.success("Gelir Eklendi!", response.message).then(() => navigate("/dashboard"));
      } else {
        alert.error("Hata Oluştu", response.message || "Gelir kaydedilemedi.");
      }
    } catch {
      alert.error("Hata", "Beklenmedik bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
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
              onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
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
              maxLength={300}
              required
            />
            <span
              className={`charCounter${description.length >= 290 ? " danger" : description.length >= 270 ? " warning" : ""}`}
            >
              {description.length}/300
            </span>
          </div>

          <button type="submit" className="submitButton" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Geliri Kaydet"}
          </button>
          <button
            type="button"
            className="backButton"
            aria-label="Dashboard'a geri dön"
            onClick={() => navigate("/dashboard")}
          >
            Geri Dön
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddIncome;
