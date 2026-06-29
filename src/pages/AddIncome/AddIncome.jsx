import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddIncome.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { showAlert } from "../../utils/alert";
import { getToday } from "../../utils/format";

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
      showAlert.error("Oturum Hatası", "Yönetici bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
      return;
    }

    if (isNaN(parsedAmount) || !cleanDescription) {
      showAlert.warning("Uyarı", "Lütfen tüm alanları doldurun!");
      return;
    }

    if (parsedAmount <= 0) {
      showAlert.warning("Geçersiz Miktar", "Gelir miktarı 0'dan büyük olmalıdır!");
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
        showAlert.success("Gelir Eklendi!", response.message).then(() => navigate("/dashboard"));
      } else {
        showAlert.error("Hata Oluştu", response.message || "Gelir kaydedilemedi.");
      }
    } catch {
      showAlert.error("Hata", "Beklenmedik bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="income-wrapper">
      <div className="income-container">
        <h2 className="title">Yeni Gelir Ekle</h2>

        <form className="income-form" onSubmit={handleIncomeSubmit}>
          <div className="form-group">
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

          <div className="form-group">
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
              className={`char-counter${description.length >= 290 ? " danger" : description.length >= 270 ? " warning" : ""}`}
            >
              {description.length}/300
            </span>
          </div>

          <button type="submit" className="submit-btn" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Geliri Kaydet"}
          </button>
          <button
            type="button"
            className="back-btn"
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
