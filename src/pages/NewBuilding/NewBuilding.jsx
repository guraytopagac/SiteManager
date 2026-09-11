import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./NewBuilding.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useSession, setCurrentBuilding } from "@/hooks/useSession";
import { showDialog } from "@/utils/dialog";
import { APARTMENT_TYPES, MAX_BUILDING_NAME_LENGTH, MAX_DUE_AMOUNT } from "@/utils/constants";
import { floorLabel } from "@/utils/floorLabel";
import { FiHome, FiArrowLeft, FiArrowRight, FiCheck } from "react-icons/fi";

const MAX_FLOORS = 30;
const MAX_PER_FLOOR = 20;
const PREVIEW_FLOOR_LIMIT = 5;
const PREVIEW_CELL_LIMIT = 4;

const INITIAL_LAYOUT = {
  floors: "4",
  perFloor: "2",
  groundFloor: true,
  dueAmount: "1000",
  type: "2+1",
};

function isValidCount(value, max) {
  return Number.isInteger(value) && value >= 1 && value <= max;
}

function isValidDueAmount(value) {
  return Number.isFinite(value) && value > 0 && value <= MAX_DUE_AMOUNT;
}

function toPreviewRow(floorIndex, perFloor, firstFloor) {
  const visibleCount = perFloor > PREVIEW_CELL_LIMIT ? PREVIEW_CELL_LIMIT - 1 : perFloor;
  const firstUnit = floorIndex * perFloor + 1;
  const hiddenUnits = perFloor - visibleCount;
  const floor = firstFloor + floorIndex;
  const units = [];

  for (let unitNo = firstUnit; unitNo < firstUnit + visibleCount; unitNo += 1) {
    units.push({ key: unitNo, label: unitNo });
  }

  if (hiddenUnits > 0) {
    units.push({ key: "more", label: `+${hiddenUnits}`, isMore: true });
  }

  return {
    key: floorIndex,
    floorTag: floor === 0 ? "Z" : floor,
    floorTitle: floorLabel(floor),
    units,
  };
}

function toPreviewFloors(floors, perFloor, groundFloor) {
  const topDown = [];

  for (let floorIndex = floors - 1; floorIndex >= 0; floorIndex -= 1) {
    topDown.push(floorIndex);
  }

  const shown = floors > PREVIEW_FLOOR_LIMIT + 1 ? [...topDown.slice(0, PREVIEW_FLOOR_LIMIT - 1), null, 0] : topDown;

  return shown.map((floorIndex) =>
    floorIndex === null
      ? { key: "gap", skippedFloors: floors - PREVIEW_FLOOR_LIMIT }
      : toPreviewRow(floorIndex, perFloor, groundFloor ? 0 : 1),
  );
}

function validateName(value) {
  if (!value) return "Bina adı zorunludur.";
  if (value.length < 2 || value.length > MAX_BUILDING_NAME_LENGTH) {
    return `Bina adı 2 ile ${MAX_BUILDING_NAME_LENGTH} karakter arasında olmalıdır.`;
  }
  return null;
}

function validateCounts(floors, perFloor) {
  if (!isValidCount(floors, MAX_FLOORS)) {
    return `Kat sayısı 1 ile ${MAX_FLOORS} arasında bir tam sayı olmalıdır.`;
  }
  if (!isValidCount(perFloor, MAX_PER_FLOOR)) {
    return `Kat başına daire sayısı 1 ile ${MAX_PER_FLOOR} arasında bir tam sayı olmalıdır.`;
  }
  return null;
}

function validateLayout(floors, perFloor, dueAmount) {
  const dueError = isValidDueAmount(dueAmount) ? null : "Aidat tutarı 0'dan büyük olmalı ve 50.000₺'yi geçmemelidir.";

  return validateCounts(floors, perFloor) ?? dueError;
}

function BuildingPreview({ name, notice, rows, cellCount }) {
  return (
    <aside className="auth-card nb-preview" aria-label="Bina önizlemesi">
      <div className="nb-preview-head">
        <span className="nb-preview-eyebrow">Önizleme</span>
        <p className="nb-preview-name" title={name}>
          {name}
        </p>

        {notice && <p className="nb-preview-meta">{notice}</p>}
      </div>

      <div className="nb-scene">
        {rows.length > 0 ? (
          <figure className="nb-building" style={{ "--nb-cells": cellCount }}>
            <div className="nb-facade">
              {rows.map((row) =>
                row.skippedFloors ? (
                  <div key={row.key} className="nb-skipped">
                    <span className="nb-skipped-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    +{row.skippedFloors} kat
                  </div>
                ) : (
                  <div key={row.key} className="nb-level">
                    <span className="nb-floor" title={row.floorTitle}>
                      {row.floorTag}
                    </span>
                    <span className="nb-units">
                      {row.units.map((unit) => (
                        <span key={unit.key} className={unit.isMore ? "nb-window nb-window--more" : "nb-window"}>
                          {unit.label}
                        </span>
                      ))}
                    </span>
                  </div>
                ),
              )}
              <div className="nb-lobby" aria-hidden="true">
                <span className="nb-door" />
              </div>
            </div>

            <span className="nb-shadow" aria-hidden="true" />
          </figure>
        ) : (
          <p className="nb-scene-empty">Önizleme hazır değil.</p>
        )}

        <span className="nb-ground" aria-hidden="true" />
      </div>
    </aside>
  );
}

function NewBuilding() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const [step, setStep] = useState(1);
  const [nameInput, setNameInput] = useState("");
  const [layout, setLayout] = useState(INITIAL_LAYOUT);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCancel = Boolean(location.state?.fromList);
  const floors = Number(layout.floors);
  const perFloor = Number(layout.perFloor);
  const dueAmount = Number(layout.dueAmount);
  const countError = validateCounts(floors, perFloor);
  const previewNotice =
    layout.floors === "" && layout.perFloor === ""
      ? "Kat ve daire sayısını girin, binanız burada belirsin."
      : countError;
  const previewFloors = countError ? [] : toPreviewFloors(floors, perFloor, layout.groundFloor);
  const cellCount = Math.min(perFloor, PREVIEW_CELL_LIMIT);
  const buildingName = nameInput.trim();

  const updateLayout = (field, value) => {
    setLayout((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleNameSubmit = (event) => {
    event.preventDefault();
    const nameError = validateName(buildingName);

    if (nameError) {
      setError(nameError);
      return;
    }
    setError(null);
    setStep(2);
  };

  const submitBuilding = async (withLayout) => {
    if (withLayout) {
      const layoutError = validateLayout(floors, perFloor, dueAmount);
      if (layoutError) {
        setError(layoutError);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = await window.electronAPI.createBuilding({
        ownerId: session.id,
        name: buildingName,
        layout: withLayout ? { floors, perFloor, groundFloor: layout.groundFloor, dueAmount, type: layout.type } : null,
      });

      if (res.success) {
        setCurrentBuilding({ id: res.id, name: buildingName });
        showDialog.toast(
          `"${buildingName}" binası oluşturuldu.`,
          res.apartmentCount > 0
            ? `${res.apartmentCount} daire eklendi. Aidat tutarını daire bazında değiştirebilirsiniz.`
            : "Daireleri Daire Ekle sayfasından ekleyebilirsiniz.",
        );
        navigate("/dashboard", { replace: true });
        return;
      }

      setError(res.message);
      setIsSubmitting(false);
    } catch (err) {
      console.error("[NewBuilding] createBuilding:", err);
      setError("Bina oluşturulamadı. Lütfen tekrar deneyin.");
      setIsSubmitting(false);
    }
  };

  const handleLayoutSubmit = (event) => {
    event.preventDefault();
    submitBuilding(true);
  };

  return (
    <div className="auth-page">
      <div className="nb-stage">
        <main className="auth-card nb-shell">
          <section className="nb-band nb-band--context">
            <div className="nb-context">
              <h1 className="nb-title">Binanızı Oluşturalım</h1>
              <AccountMenu />
            </div>
          </section>

          <ol className="nb-band nb-rail" aria-label="Kurulum adımları">
            <li className={step === 1 ? "is-active" : "is-done"} aria-current={step === 1 ? "step" : undefined}>
              <span className="nb-rail-no">
                {step === 1 ? "01" : <FiCheck size={16} strokeWidth={2.5} title="Tamamlandı" />}
              </span>
              Bina Adı
              <span className={step === 1 ? "nb-rail-line" : "nb-rail-line is-filled"} aria-hidden="true" />
            </li>
            <li className={step === 2 ? "is-active" : ""} aria-current={step === 2 ? "step" : undefined}>
              <span className="nb-rail-no">02</span>
              Daire Düzeni
            </li>
          </ol>

          {step === 1 && (
            <section className="nb-band nb-band--fill nb-step">
              <form className="nb-form" onSubmit={handleNameSubmit}>
                <div>
                  <h2 className="nb-task-title">Binanıza bir ad verin.</h2>
                  <p className="nb-task-note">Tüm aidat, gelir ve gider kayıtları bu binanın defterine işlenir.</p>
                </div>

                <div className="nb-field">
                  <label className="nb-label" htmlFor="nb-name">
                    Bina Adı
                  </label>
                  <div className="nb-input-wrap">
                    <span className="nb-input-icon" aria-hidden="true">
                      <FiHome size={20} />
                    </span>
                    <input
                      id="nb-name"
                      className="nb-input nb-input--icon"
                      value={nameInput}
                      maxLength={MAX_BUILDING_NAME_LENGTH}
                      placeholder="Örn. Mavikent Sitesi A Blok"
                      autoFocus
                      onChange={(e) => {
                        setNameInput(e.target.value);
                        setError(null);
                      }}
                    />
                  </div>
                </div>

                {error && (
                  <p className="nb-error" role="alert">
                    {error}
                  </p>
                )}

                <div className="nb-actions">
                  {canCancel && (
                    <button type="button" className="nb-btn-secondary" onClick={() => navigate("/select-building")}>
                      Vazgeç
                    </button>
                  )}
                  <button type="submit" className="nb-btn auth-btn auth-shine">
                    Devam Et
                    <FiArrowRight size={20} />
                  </button>
                </div>
              </form>
            </section>
          )}

          {step === 2 && (
            <section className="nb-band nb-band--fill nb-step">
              <form className="nb-form" onSubmit={handleLayoutSubmit}>
                <div>
                  <h2 className="nb-task-title">Binada kaç daire var?</h2>
                  <p className="nb-task-note">
                    Daire bilgilerini ve aidat tutarlarını sonradan tek tek değiştirebilirsiniz.
                  </p>
                </div>

                <div className="nb-grid">
                  <div className="nb-field">
                    <label className="nb-label" htmlFor="nb-floors">
                      Kat Sayısı
                    </label>
                    <input
                      id="nb-floors"
                      className="nb-input"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max={MAX_FLOORS}
                      value={layout.floors}
                      autoFocus
                      onChange={(e) => updateLayout("floors", e.target.value)}
                    />
                  </div>

                  <div className="nb-field">
                    <label className="nb-label" htmlFor="nb-per-floor">
                      Kattaki Daire Sayısı
                    </label>
                    <input
                      id="nb-per-floor"
                      className="nb-input"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max={MAX_PER_FLOOR}
                      value={layout.perFloor}
                      onChange={(e) => updateLayout("perFloor", e.target.value)}
                    />
                  </div>

                  <div className="nb-field">
                    <label className="nb-label" htmlFor="nb-due">
                      Aylık Aidat (₺)
                    </label>
                    <input
                      id="nb-due"
                      className="nb-input"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      max={MAX_DUE_AMOUNT}
                      placeholder="Örn. 1500"
                      value={layout.dueAmount}
                      onChange={(e) => updateLayout("dueAmount", e.target.value)}
                    />
                  </div>

                  <div className="nb-field">
                    <label className="nb-label" htmlFor="nb-type">
                      Daire Tipi
                    </label>
                    <select
                      id="nb-type"
                      className="nb-input"
                      value={layout.type}
                      onChange={(e) => updateLayout("type", e.target.value)}
                    >
                      {APARTMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="nb-check">
                  <input
                    type="checkbox"
                    checked={layout.groundFloor}
                    onChange={(e) => updateLayout("groundFloor", e.target.checked)}
                  />
                  <span>Zemin katta da daire var</span>
                </label>

                {error && (
                  <p className="nb-error" role="alert">
                    {error}
                  </p>
                )}

                <div className="nb-actions">
                  <button
                    type="button"
                    className="nb-btn-secondary"
                    onClick={() => {
                      setError(null);
                      setStep(1);
                    }}
                    disabled={isSubmitting}
                  >
                    <FiArrowLeft size={20} />
                    Geri
                  </button>
                  <button
                    type="button"
                    className="nb-btn-outline"
                    onClick={() => submitBuilding(false)}
                    disabled={isSubmitting}
                  >
                    Dairesiz Oluştur
                  </button>
                  <button type="submit" className="nb-btn auth-btn auth-shine" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <span className="auth-spinner" aria-hidden="true" />
                        Oluşturuluyor...
                      </>
                    ) : (
                      <>
                        <FiCheck size={20} />
                        Binayı Oluştur
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>
          )}
        </main>

        {step === 2 && (
          <BuildingPreview name={buildingName} notice={previewNotice} rows={previewFloors} cellCount={cellCount} />
        )}
      </div>
    </div>
  );
}

export default NewBuilding;
