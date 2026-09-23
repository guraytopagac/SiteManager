// The fund's settings: the monthly amount, the opening balance and whether the fund is still collecting.
// A new amount reaches the months accrued from now on, never the ones already charged, so no period is
// asked here. Stopping and starting collection again skips the months in between.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./InvestmentModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { showDialog } from "@/components/Dialog/dialogStore";
import { MAX_DUE_AMOUNT, MAX_OPENING_BALANCE, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";

function roundToCents(value) {
  return Math.round(Number(value) * 100) / 100;
}

function FundSettingsModal({ fund, building, onClose, onSaved }) {
  const [monthlyInput, setMonthlyInput] = useState(String(fund.monthly_amount));
  const [openingInput, setOpeningInput] = useState(String(fund.opening_balance));
  const [isCollecting, setIsCollecting] = useState(fund.is_collecting === 1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const monthlyAmount = roundToCents(monthlyInput);
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0 || monthlyAmount > MAX_DUE_AMOUNT) {
      showDialog.warning("Geçersiz Tutar", "Aylık tutar 0'dan büyük olmalı ve 50.000₺'yi geçmemelidir.");
      return;
    }

    const openingBalance = openingInput === "" ? 0 : roundToCents(openingInput);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      showDialog.warning("Geçersiz Tutar", "Açılış bakiyesi 0 ya da daha büyük olmalıdır.");
      return;
    }

    // Resuming skips the months collection was stopped, and that is not obvious from the switch alone.
    if (isCollecting && fund.is_collecting === 0) {
      const confirmed = await showDialog.confirm(
        "Toplamaya Yeniden Başla",
        "Yatırım aidatı bu aydan itibaren yeniden tahakkuk edecek. Toplamanın durduğu aylar için tahakkuk oluşturulmaz.",
        "Vazgeç",
        "Evet, Başlat",
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.updateInvestmentFund({
        buildingId: building.id,
        monthlyAmount,
        openingBalance,
        isCollecting,
      });
      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[FundSettingsModal] updateInvestmentFund:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    }
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useEscapeKey(handleClose);

  return (
    <div className="iv-md-overlay">
      <form className="iv-md-box" onSubmit={handleSubmit}>
        <div className="iv-md-head">
          <div className="iv-md-identity">
            <h2 className="iv-md-title">Fon Ayarları</h2>
            <span className="iv-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button
            type="button"
            className="iv-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="iv-md-body iv-md-stack">
          <div className="iv-md-grid">
            <div className="iv-md-field">
              <label htmlFor="fund-monthly">Daire Başına Aylık Tutar (₺)</label>
              <input
                id="fund-monthly"
                type="number"
                step="0.01"
                min="0.01"
                max={MAX_DUE_AMOUNT}
                placeholder="Örn. 500"
                value={monthlyInput}
                onChange={(e) => setMonthlyInput(e.target.value)}
                required
                autoFocus
              />
              <span className="iv-md-hint">Yeni tutar gelecek ayın tahakkukunda geçerli olur.</span>
            </div>

            <div className="iv-md-field">
              <label htmlFor="fund-opening">Açılış Bakiyesi (₺)</label>
              <input
                id="fund-opening"
                type="number"
                step="0.01"
                min="0"
                max={MAX_OPENING_BALANCE}
                placeholder="Örn. 25000"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
              />
              <span className="iv-md-hint">Fon başlamadan önce ayrılmış para.</span>
            </div>
          </div>

          <div className="iv-md-field">
            <span className="iv-md-label">Aidat Toplama</span>
            <button
              type="button"
              className={isCollecting ? "iv-switch iv-switch--on" : "iv-switch"}
              role="switch"
              aria-checked={isCollecting}
              onClick={() => setIsCollecting((value) => !value)}
            >
              <span className="iv-switch-track" aria-hidden="true">
                <span className="iv-switch-knob" />
              </span>
              {isCollecting ? "Aidat toplanıyor" : "Toplama durduruldu"}
            </button>
            <span className="iv-md-hint">
              Durdurulduğunda yeni ay tahakkuk etmez, tahakkuk etmiş aylar tahsil edilmeye devam eder.
            </span>
          </div>

          <button type="submit" className="iv-md-btn-solid iv-md-submit" disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default FundSettingsModal;
