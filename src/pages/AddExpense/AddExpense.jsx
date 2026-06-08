import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddExpense.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";

function AddExpense() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();

    const cleanDescription = description.trim();

    if (Number(amount) <= 0) {
      alert.warning("Geçersiz Miktar", "Gider miktarı 0'dan büyük olmalıdır!");
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
    const response = await window.electronAPI.addExpense({
      amount: Number(amount),
      description: cleanDescription,
      date: today,
      manager_id: managerId,
    });

    setIsSubmitting(false);

    if (response.success) {
      alert.success("Gider Eklendi!", response.message || "Gider kaydı başarıyla oluşturuldu.");
      setAmount("");
      setDescription("");
    } else {
      alert.error("Hata Oluştu", response.message || "Gider kaydedilemedi.");
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
              required
            />
          </div>

          <div className="formGroup">
            <label htmlFor="expenseDescription">Açıklama</label>
            <textarea
              id="expenseDescription"
              placeholder="Giderin detayını yazın (Örn: Çevre aydınlatma ampul değişimi)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <button type="submit" id="expenseButton" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Gideri Kaydet"}
          </button>
          <button type="button" id="backButton" onClick={() => navigate("/dashboard")}>
            Geri Dön
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddExpense;
