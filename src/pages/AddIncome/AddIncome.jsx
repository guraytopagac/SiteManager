import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddIncome.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useCurrentBuilding } from "@/hooks/useSession";
import { showDialog } from "@/utils/dialog";
import { getMinDate, getToday } from "@/utils/date";

function AddIncome() {
  const navigate = useNavigate();
  const building = useCurrentBuilding();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [date, setDate] = useState(() => getToday());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleIncomeSubmit = async (e) => {
    e.preventDefault();

    const cleanDescription = description.trim();
    const parsedAmount = Math.round(Number(amount) * 100) / 100;
    const buildingId = building?.id;

    if (!buildingId) {
      showDialog.error("Bina Seçilmedi", "Lütfen önce bir bina seçin.");
      return;
    }

    if (isNaN(parsedAmount) || !cleanDescription || !date) {
      showDialog.warning("Uyarı", "Lütfen tüm alanları doldurun!");
      return;
    }

    if (parsedAmount <= 0) {
      showDialog.warning("Geçersiz Miktar", "Gelir miktarı 0'dan büyük olmalıdır!");
      return;
    }

    if (date > getToday()) {
      showDialog.warning("Geçersiz Tarih", "İleri bir tarih seçilemez.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.addIncome({
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
        showDialog.toast(res.message);
        navigate("/dashboard");
      } else {
        showDialog.error("Hata Oluştu", res.message || "Gelir kaydedilemedi.");
      }
    } catch (err) {
      console.error("[AddIncome] addIncome:", err);
      showDialog.error("Hata", "Beklenmedik bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="income-wrapper">
      <div className="income-container">
        <div className="account-menu-row">
          <AccountMenu />
        </div>

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
            <label htmlFor="incomeCategory">Kategori</label>
            <select id="incomeCategory" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="rent">Kira</option>
              <option value="parking">Otopark</option>
              <option value="donation">Bağış</option>
              <option value="other">Diğer</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="incomeDate">Tarih</label>
            <input
              type="date"
              id="incomeDate"
              value={date}
              min={getMinDate()}
              max={getToday()}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="incomeDescription">Açıklama</label>
            <p className="form-hint">
              Aidat tahsilatları buradan girilmez; daire üzerinden kaydedilir ve gelire otomatik işlenir.
            </p>
            <textarea
              id="incomeDescription"
              placeholder="Gelirin kaynağını yazın (Örn: Çatı katı deposu, Temmuz)"
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
            {isSubmitting ? "Kaydediliyor..." : "Geliri Kaydet"}
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

export default AddIncome;
