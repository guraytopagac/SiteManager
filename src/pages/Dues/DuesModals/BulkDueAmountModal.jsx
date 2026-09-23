// Sets one due amount across every apartment of the building. The period is asked by two cards that state
// their own consequence, defaulting to the coming month like the single apartment modal.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./DuesModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { showDialog } from "@/components/Dialog/dialogStore";
import { MAX_DUE_AMOUNT } from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";

function BulkDueAmountModal({ building, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [applyCurrentMonth, setApplyCurrentMonth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dueAmount = parseFloat(amount);
    if (!dueAmount || dueAmount <= 0) {
      showDialog.warning("Geçersiz Tutar", "Lütfen geçerli bir aidat tutarı girin.");
      return;
    }

    const periodNote = applyCurrentMonth
      ? "Yeni tutar, bu ay ödeme alınmamış dairelerin tahakkukuna da işlenecek."
      : "Yeni tutar gelecek ayın tahakkukunda geçerli olacak.";
    const confirmed = await showDialog.confirm(
      "Toplu Aidat Güncelleme",
      <>
        Tüm dairelerin aidat tutarı <b>{formatCurrency(dueAmount)}</b> olarak güncellenecek. {periodNote}
      </>,
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
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[BulkDueAmountModal] bulkUpdateDueAmount:", err);
      showDialog.error("Hata", "Aidat tutarları güncellenemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useEscapeKey(handleClose);

  return (
    <div className="du-md-overlay">
      <form className="du-md-box du-md-box--sm" onSubmit={handleSubmit}>
        <div className="du-md-head">
          <div className="du-md-identity">
            <h2 className="du-md-title">Toplu Aidat Güncelleme</h2>
            <span className="du-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button
            type="button"
            className="du-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="du-md-body du-md-stack">
          <div className="du-scope">
            <span className="du-scope-legend" id="bulk-scope-label">
              Geçerlilik Dönemi
            </span>
            <div className="du-scope-cards" role="radiogroup" aria-labelledby="bulk-scope-label">
              <label className={applyCurrentMonth ? "du-scope-card" : "du-scope-card du-scope-card--active"}>
                <input
                  type="radio"
                  name="bulk-scope"
                  checked={!applyCurrentMonth}
                  onChange={() => setApplyCurrentMonth(false)}
                />
                <b>Gelecek ay</b>
                <span>Bu ay dahil tahakkuk etmiş aylar değişmez.</span>
              </label>
              <label className={applyCurrentMonth ? "du-scope-card du-scope-card--active" : "du-scope-card"}>
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

          <div className="du-md-field">
            <label htmlFor="bulk-amount">Yeni Aidat Tutarı (₺)</label>
            <div className="du-amount-row">
              <input
                id="bulk-amount"
                type="number"
                min="1"
                max={MAX_DUE_AMOUNT}
                step="1"
                placeholder="Örn. 2000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
              <button type="submit" className="du-md-btn-solid du-amount-submit" disabled={isSubmitting}>
                {isSubmitting ? "Güncelleniyor..." : "Güncelle"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default BulkDueAmountModal;
