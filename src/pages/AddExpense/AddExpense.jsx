import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddExpense.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";
import { getToday } from "../../utils/date";

function AddExpense() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleExpenseSubmit = async (e) => {
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
      alert.warning("Geçersiz Miktar", "Gider miktarı 0'dan büyük olmalıdır!");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await window.electronAPI.addExpense({
        amount: parsedAmount,
        description: cleanDescription,
        category,
        date: today,
        manager_id: managerId,
      });

      if (response.success) {
        setAmount("");
        setDescription("");
        setCategory("other");
        alert
          .success("Gider Eklendi!", response.message || "Gider kaydı başarıyla oluşturuldu.")
          .then(() => navigate("/dashboard"));
      } else {
        alert.error("Hata Oluştu", response.message || "Gider kaydedilemedi.");
      }
    } catch {
      alert.error("Hata", "Beklenmedik bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="expense-wrapper">
      <div className="expenseContainer">
        <h2 className="title">Yeni Gider Ekle</h2>

        <form className="expenseForm" onSubmit={handleExpenseSubmit}>
          <div className="formGroup">
            <label htmlFor="expenseAmount">Gider Miktarı (₺)</label>
            <input
              type="number"
              id="expenseAmount"
              step="0.01"
              min="0.01"
              placeholder="Miktar girin (Örn: 450.00)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
              required
            />
          </div>

          <div className="formGroup">
            <label htmlFor="expenseCategory">Kategori</label>
            <select id="expenseCategory" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="maintenance">Bakım & Onarım</option>
              <option value="cleaning">Temizlik</option>
              <option value="utility">Fatura / Abonelik</option>
              <option value="staff">Personel</option>
              <option value="other">Diğer</option>
            </select>
          </div>

          <div className="formGroup">
            <label htmlFor="expenseDescription">Açıklama</label>
            <textarea
              id="expenseDescription"
              placeholder="Giderin detayını yazın (Örn: Çevre aydınlatma ampul değişimi)"
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
            {isSubmitting ? "Kaydediliyor..." : "Gideri Kaydet"}
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

export default AddExpense;
