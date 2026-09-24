// The fund's settings: the monthly amount and whether the fund is still collecting. The opening balance is
// entered once, when the fund starts, and is not offered here. A new amount reaches either the month in
// progress or the next one, asked the same way the dues page asks it. Stopping and starting collection
// again skips the months in between.

import { useState } from "react";
import { FiInfo, FiX } from "react-icons/fi";
import "./InvestmentModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { showDialog } from "@/components/Dialog/dialogStore";
import { MAX_DUE_AMOUNT, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";

function roundToCents(value) {
  return Math.round(Number(value) * 100) / 100;
}

// Each field's consequence sits in a framed box with a mark, so it reads as guidance rather than as more form.
function FieldNote({ children }) {
  return (
    <div className="iv-md-note">
      <span className="iv-md-note-icon" aria-hidden="true">
        <FiInfo />
      </span>
      <p>{children}</p>
    </div>
  );
}

function FundSettingsModal({ fund, building, onClose, onSaved }) {
  const [monthlyInput, setMonthlyInput] = useState(String(fund.monthly_amount));
  const [applyCurrentMonth, setApplyCurrentMonth] = useState(false);
  const [isCollecting, setIsCollecting] = useState(fund.is_collecting === 1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const monthlyAmount = roundToCents(monthlyInput);
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0 || monthlyAmount > MAX_DUE_AMOUNT) {
      showDialog.warning("Geçersiz Tutar", "Aylık tutar 0'dan büyük olmalı ve 50.000₺'yi geçmemelidir.");
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
        applyCurrentMonth,
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
          </div>

          <div className="iv-scope">
            <span className="iv-scope-legend" id="fund-scope-label">
              Geçerlilik Dönemi
            </span>
            <div className="iv-scope-cards" role="radiogroup" aria-labelledby="fund-scope-label">
              <label className={applyCurrentMonth ? "iv-scope-card" : "iv-scope-card iv-scope-card--active"}>
                <input
                  type="radio"
                  name="fund-scope"
                  checked={!applyCurrentMonth}
                  onChange={() => setApplyCurrentMonth(false)}
                />
                <b>Gelecek ay</b>
                <span>Bu ay dahil tahakkuk etmiş aylar değişmez.</span>
              </label>
              <label className={applyCurrentMonth ? "iv-scope-card iv-scope-card--active" : "iv-scope-card"}>
                <input
                  type="radio"
                  name="fund-scope"
                  checked={applyCurrentMonth}
                  onChange={() => setApplyCurrentMonth(true)}
                />
                <b>Bu ay</b>
                <span>Ödeme alınmış daireler eski tutarda kalır.</span>
              </label>
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
            <FieldNote>
              Durdurulduğunda <b>yeni ay tahakkuk etmez</b>, tahakkuk etmiş aylar tahsil edilmeye devam eder.
            </FieldNote>
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
