import { useState } from "react";
import { showAlert } from "@/utils/alert";
import { formatCurrency } from "@/utils/currency";

function BulkUpdateModal({ building, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      showAlert.warning("Geçersiz Tutar", "Lütfen geçerli bir aidat tutarı girin.");
      return;
    }

    const confirmed = await showAlert.confirm(
      "Toplu Aidat Güncelleme",
      {
        html: `Tüm dairelerin aidat tutarı <b>${formatCurrency(parsed)}</b> olarak güncellenecek.<br><br>
               Yeni tutar <b>gelecek ayın</b> aidatlarında geçerli olur; <b>bu ay dahil</b> tahakkuk etmiş aylar eski
               tutarda kalır.`,
      },
      "Evet, Güncelle",
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    const res = await window.electronAPI.bulkUpdateDueAmount(building.id, parsed);
    setIsSubmitting(false);

    if (res.success) {
      showAlert.toast("Güncellendi", res.message);
      onSaved();
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Toplu Aidat Güncelleme</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="modal-description">
          Tüm dairelerinizin aidat tutarını tek seferde güncelleyin. Yeni tutar <strong>gelecek ayın</strong>{" "}
          aidatlarında geçerli olur. <strong>Bu ay dahil</strong>, hâlihazırda tahakkuk etmiş aylar eski tutarda kalır ve
          ödeme kayıtları etkilenmez.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Yeni Aidat Tutarı (₺)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="Örn: 2000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              İptal
            </button>
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? "Güncelleniyor..." : "Güncelle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BulkUpdateModal;
