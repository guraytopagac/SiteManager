// Edits the monthly transfer and the opening balance. The months up to this one are already written, so a
// new monthly amount is first moved in the month the fund reports as the next transfer.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./SeveranceFundModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { showDialog } from "@/utils/dialog";
import { formatMonthYear } from "@/utils/date";

const MAX_OPENING_BALANCE = 100000000;
const MAX_MONTHLY_AMOUNT = 1000000;

function FundSettingsModal({ building, fund, onClose, onSaved }) {
  const [openingBalanceInput, setOpeningBalanceInput] = useState(String(fund.openingBalance));
  const [monthlyAmountInput, setMonthlyAmountInput] = useState(String(fund.monthlyAmount));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const openingBalance = openingBalanceInput === "" ? 0 : Math.round(Number(openingBalanceInput) * 100) / 100;
    const monthlyAmount = monthlyAmountInput === "" ? 0 : Math.round(Number(monthlyAmountInput) * 100) / 100;
    if (
      !Number.isFinite(openingBalance) ||
      openingBalance < 0 ||
      !Number.isFinite(monthlyAmount) ||
      monthlyAmount < 0
    ) {
      showDialog.warning("Geçersiz Tutar", "Tutarlar 0 ya da daha büyük olmalıdır.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.updateSeveranceFund({
        buildingId: building.id,
        openingBalance,
        monthlyAmount,
      });
      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[FundSettingsModal] updateSeveranceFund:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
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
    <div className="sf-md-overlay">
      <form className="sf-md-box" onSubmit={handleSubmit}>
        <div className="sf-md-head">
          <div className="sf-md-identity">
            <h2 className="sf-md-title">Tazminat Kasası Ayarları</h2>
            <span className="sf-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button
            type="button"
            className="sf-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="sf-md-body">
          <div className="sf-md-grid">
            <div className="sf-md-field sf-md-field--wide">
              <label htmlFor="sf-md-monthly">Aylık Aktarım Tutarı (₺)</label>
              <input
                id="sf-md-monthly"
                type="number"
                step="0.01"
                min="0"
                max={MAX_MONTHLY_AMOUNT}
                value={monthlyAmountInput}
                onChange={(e) => setMonthlyAmountInput(e.target.value)}
                onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
                autoFocus
              />
              <span className="sf-md-hint">
                Yeni tutar {formatMonthYear(fund.nextTransfer.year, fund.nextTransfer.month)} aktarımından itibaren
                uygulanır. 0 girilirse aktarım durur.
              </span>
            </div>

            <div className="sf-md-field sf-md-field--wide">
              <label htmlFor="sf-md-opening">Açılış Bakiyesi (₺)</label>
              <input
                id="sf-md-opening"
                type="number"
                step="0.01"
                min="0"
                max={MAX_OPENING_BALANCE}
                value={openingBalanceInput}
                onChange={(e) => setOpeningBalanceInput(e.target.value)}
                onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
              />
              <span className="sf-md-hint">
                Tazminat kasası başlatılmadan önce ayrılmış paradır, ana kasayı etkilemez.
              </span>
            </div>
          </div>

          <button type="submit" className="sf-btn-solid sf-md-submit" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default FundSettingsModal;
