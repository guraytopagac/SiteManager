import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./ApartmentsModals.css";
import { showAlert } from "@/utils/alert";
import { formatCurrency } from "@/utils/currency";

function BulkUpdateModal({ building, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [applyCurrentMonth, setApplyCurrentMonth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dueAmount = parseFloat(amount);
    if (!dueAmount || dueAmount <= 0) {
      showAlert.warning("Geçersiz Tutar", "Lütfen geçerli bir aidat tutarı girin.");
      return;
    }

    const periodNote = applyCurrentMonth
      ? "Yeni tutar, bu ay ödeme alınmamış dairelerin tahakkukuna da işlenecek."
      : "Yeni tutar gelecek ayın tahakkukunda geçerli olacak.";
    const confirmed = await showAlert.confirm(
      "Toplu Aidat Güncelleme",
      {
        html: `Tüm dairelerin aidat tutarı <b>${formatCurrency(dueAmount)}</b> olarak güncellenecek. ${periodNote}`,
      },
      "Vazgeç",
      "Evet, Güncelle",
    );
    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      const res = await window.electronAPI.bulkUpdateDueAmount({
        buildingId: building.id,
        amount: dueAmount,
        applyCurrentMonth,
      });

      if (res.success) {
        showAlert.toast(res.message);
        onSaved();
      } else {
        showAlert.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[BulkUpdateModal] bulkUpdateDueAmount:", err);
      showAlert.error("Hata", "Aidat tutarları güncellenemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <div className="ap-md-overlay" onClick={handleClose}>
      <form className="ap-md-box ap-md-box--sm" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="ap-md-head">
          <div className="ap-md-identity">
            <h2 className="ap-md-title">Toplu Aidat Güncelleme</h2>
            <span className="ap-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button
            type="button"
            className="ap-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="ap-md-body">
          <div className="ap-bulk-scope">
            <span className="ap-bulk-legend" id="bulk-scope-label">
              Geçerlilik Dönemi
            </span>
            <div className="ap-bulk-cards" role="radiogroup" aria-labelledby="bulk-scope-label">
              <label className={applyCurrentMonth ? "ap-bulk-card" : "ap-bulk-card ap-bulk-card--active"}>
                <input
                  type="radio"
                  name="bulk-scope"
                  checked={!applyCurrentMonth}
                  onChange={() => setApplyCurrentMonth(false)}
                />
                <b>Gelecek ay</b>
                <span>Bu ay dahil tahakkuk etmiş aylar değişmez.</span>
              </label>
              <label className={applyCurrentMonth ? "ap-bulk-card ap-bulk-card--active" : "ap-bulk-card"}>
                <input
                  type="radio"
                  name="bulk-scope"
                  checked={applyCurrentMonth}
                  onChange={() => setApplyCurrentMonth(true)}
                />
                <b>Bu ay</b>
                <span>Ödeme alınmış daireler eski tutarda kalır.</span>
              </label>
            </div>
          </div>

          <div className="ap-md-field">
            <label htmlFor="bulk-amount">Yeni Aidat Tutarı (₺)</label>
            <div className="ap-bulk-row">
              <input
                id="bulk-amount"
                type="number"
                min="1"
                max="50000"
                step="1"
                placeholder="Örn: 2000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
              <button type="submit" className="ap-md-btn-solid ap-bulk-submit" disabled={isSubmitting}>
                {isSubmitting ? "Güncelleniyor..." : "Güncelle"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default BulkUpdateModal;
