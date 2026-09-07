import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddExpense.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useCurrentBuilding } from "@/hooks/useSession";
import { showAlert } from "@/utils/alert";
import { getToday } from "@/utils/date";

function AddExpense() {
  const navigate = useNavigate();
  const building = useCurrentBuilding();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState(() => getToday());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();

    const cleanDescription = description.trim();
    const parsedAmount = Math.round(Number(amount) * 100) / 100;
    const buildingId = building?.id;

    if (!buildingId) {
      showAlert.error("Bina Seçilmedi", "Lütfen önce bir bina seçin.");
      return;
    }

    if (isNaN(parsedAmount) || !cleanDescription || !date) {
      showAlert.warning("Uyarı", "Lütfen tüm alanları doldurun!");
      return;
    }

    if (parsedAmount <= 0) {
      showAlert.warning("Geçersiz Miktar", "Gider miktarı 0'dan büyük olmalıdır!");
      return;
    }

    if (date > getToday()) {
      showAlert.warning("Geçersiz Tarih", "İleri bir tarih seçilemez.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.addExpense({
        amount: parsedAmount,
        description: cleanDescription,
        category,
        date,
        buildingId: buildingId,
      });

      if (res.success) {
        setAmount("");
        setDescription("");
        setCategory("other");
        setDate(getToday());
        showAlert.toast(res.message);
        navigate("/dashboard");
      } else {
        showAlert.error("Hata Oluştu", res.message || "Gider kaydedilemedi.");
      }
    } catch (err) {
      console.error("[AddExpense] addExpense:", err);
      showAlert.error("Hata", "Beklenmedik bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="expense-wrapper">
      <div className="expense-container">
        <div className="account-menu-row">
          <AccountMenu />
        </div>

        <h2 className="title">Yeni Gider Ekle</h2>

        <form className="expense-form" onSubmit={handleExpenseSubmit}>
          <div className="form-group">
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

          <div className="form-group">
            <label htmlFor="expenseCategory">Kategori</label>
            <select id="expenseCategory" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="maintenance">Bakım & Onarım</option>
              <option value="cleaning">Temizlik</option>
              <option value="utility">Fatura / Abonelik</option>
              <option value="staff">Personel</option>
              <option value="other">Diğer</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="expenseDate">Tarih</label>
            <input
              type="date"
              id="expenseDate"
              value={date}
              max={getToday()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="expenseDescription">Açıklama</label>
            <textarea
              id="expenseDescription"
              placeholder="Giderin detayını yazın (Örn: Çevre aydınlatma ampul değişimi)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              required
            />
            {description.length > 0 && (
              <span
                className={`char-counter${description.length >= 290 ? " danger" : description.length >= 270 ? " warning" : ""}`}
              >
                {description.length}/300
              </span>
            )}
          </div>

          <button type="submit" className="submit-btn" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Gideri Kaydet"}
          </button>
          <button
            type="button"
            className="back-btn"
            aria-label="Ana sayfaya geri dön"
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
