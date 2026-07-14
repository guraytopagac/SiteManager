import { useState } from "react";
import PropTypes from "prop-types";
import { showAlert } from "@/utils/alert";

function BulkUpdateModal({ currentUser, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      showAlert.warning("Geçersiz Tutar", "Lütfen geçerli bir aidat tutarı girin.");
      return;
    }

    const confirm = await showAlert.confirm(
      "Toplu Aidat Güncelleme",
      `Tüm dairelerin aidat tutarı ${parsed.toLocaleString("tr-TR")} ₺ olarak güncellenecek. Onaylıyor musunuz?`,
      "Evet, Güncelle",
    );
    if (!confirm.isConfirmed) return;

    setIsSubmitting(true);
    const res = await window.electronAPI.bulkUpdateDueAmount(currentUser.id, parsed);
    setIsSubmitting(false);

    if (res.success) {
      await showAlert.success("Güncellendi", res.message);
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
          Tüm dairelerinizin aidat tutarını tek seferde güncelleyin. Bu işlem mevcut daire aidat tutarlarını değiştirir;
          önceki ödeme kayıtları etkilenmez.
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

BulkUpdateModal.propTypes = {
  currentUser: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default BulkUpdateModal;
