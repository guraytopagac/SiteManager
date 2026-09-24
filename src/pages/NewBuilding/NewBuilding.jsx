import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./NewBuilding.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { showDialog } from "@/components/Dialog/dialogStore";
import { setCurrentBuilding } from "@/hooks/useSession";
import { APARTMENT_TYPES, MAX_BUILDING_NAME_LENGTH, MAX_DUE_AMOUNT } from "@/utils/constants";
import { floorLabel } from "@/utils/floorLabel";
import { FiHome, FiArrowLeft, FiArrowRight, FiCheck, FiAlertCircle, FiInfo } from "react-icons/fi";

const MAX_FLOORS = 30;
const MAX_PER_FLOOR = 20;
// Trimming starts one floor above this limit, because the band replacing the hidden floors takes a row of its
// own. At the limit plus one it would hide a single floor and save no space at all.
const PREVIEW_FLOOR_LIMIT = 5;
const PREVIEW_CELL_LIMIT = 4;

const INITIAL_LAYOUT = {
  floors: "6",
  perFloor: "4",
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

// Rows come out ready to draw, labels included, so the markup only walks the list. A floor wider than the
// cell limit spends its last slot on a counter, so a row never wraps onto a second line.
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

  // The bottom two floors stay visible so the numbering is readable from both ends of the facade.
  const shown =
    floors > PREVIEW_FLOOR_LIMIT + 1
      ? [...topDown.slice(0, PREVIEW_FLOOR_LIMIT - 2), null, ...topDown.slice(-2)]
      : topDown;

  return shown.map((floorIndex) =>
    floorIndex === null
      ? { key: "gap", skippedFloors: floors - PREVIEW_FLOOR_LIMIT }
      : toPreviewRow(floorIndex, perFloor, groundFloor ? 0 : 1),
  );
}

// Step one draws the facade before any count is asked. It follows the current layout, so going back keeps the
// shape, and falls back to the initial one when step two was left with an invalid count.
const FALLBACK_PREVIEW_FLOORS = toPreviewFloors(
  Number(INITIAL_LAYOUT.floors),
  Number(INITIAL_LAYOUT.perFloor),
  INITIAL_LAYOUT.groundFloor,
);
const FALLBACK_CELL_COUNT = Math.min(Number(INITIAL_LAYOUT.perFloor), PREVIEW_CELL_LIMIT);

function validateName(value) {
  if (!value) return "Bina adı zorunludur.";
  if (value.length < 2 || value.length > MAX_BUILDING_NAME_LENGTH) {
    return `Bina adı 2 ile ${MAX_BUILDING_NAME_LENGTH} karakter arasında olmalıdır.`;
  }
  return null;
}

// Shared by the preview and by the submit, so an empty preview and a refused submit always agree on why.
// The messages name their own field, which is why no validator binds itself to an input.
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

// The cell count is handed to CSS as a custom property and the width is computed there, so the geometry
// stays in the stylesheet and this component only supplies the number.
// The notice sits under the empty scene rather than under the name, since it explains why no building is drawn.
// The card stays on screen through both steps, so the stage never changes width and the wizard never moves.
// A blank facade keeps its floors but hides the windows and floor tags, since no unit exists yet. They stay
// mounted and only fade, so stepping back fades them out instead of dropping them in a single frame.
function BuildingPreview({ name, notice, isWarning, rows, cellCount, isBlank }) {
  return (
    <aside className="auth-card nb-preview" aria-label="Bina önizlemesi">
      <div className="nb-preview-head">
        <span className="nb-preview-eyebrow">Önizleme</span>
        <p className={name ? "nb-preview-name" : "nb-preview-name nb-preview-name--empty"} title={name || undefined}>
          {name || "Bina adı"}
        </p>
      </div>

      <div className="nb-scene">
        {rows.length > 0 ? (
          <figure className="nb-building" style={{ "--nb-cells": cellCount }}>
            <div className={isBlank ? "nb-facade nb-facade--blank" : "nb-facade"}>
              {rows.map((row) =>
                row.skippedFloors ? (
                  <div key={row.key} className="nb-skipped">
                    <span className="nb-unit-detail" aria-hidden={isBlank}>
                      +{row.skippedFloors} kat
                    </span>
                  </div>
                ) : (
                  <div key={row.key} className="nb-level">
                    <span
                      className="nb-floor nb-unit-detail"
                      title={isBlank ? undefined : row.floorTitle}
                      aria-hidden={isBlank}
                    >
                      {row.floorTag}
                    </span>
                    <span className="nb-units" aria-hidden={isBlank}>
                      {row.units.map((unit) => (
                        <span key={unit.key} className={unit.isMore ? "nb-window nb-window--more" : "nb-window"}>
                          {unit.label}
                        </span>
                      ))}
                    </span>
                  </div>
                ),
              )}
              <p className="nb-facade-note" aria-hidden={!isBlank}>
                Daireler bir sonraki adımda burada yer alır.
              </p>
              <div className="nb-lobby" aria-hidden="true">
                <span className="nb-door" />
              </div>
            </div>

            <span className="nb-shadow" aria-hidden="true" />
          </figure>
        ) : (
          <div className="nb-scene-empty">
            <div
              className={isWarning ? "nb-scene-notice nb-scene-notice--warning" : "nb-scene-notice"}
              role={isWarning ? "status" : undefined}
            >
              <p className="nb-scene-notice-title">
                {isWarning && <FiAlertCircle size={20} aria-hidden="true" />}
                Önizleme hazır değil.
              </p>
              <p className="nb-scene-notice-body">{notice}</p>
            </div>
          </div>
        )}

        <span className="nb-ground" aria-hidden="true" />
      </div>
    </aside>
  );
}

function NewBuilding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [nameInput, setNameInput] = useState("");
  const [layout, setLayout] = useState(INITIAL_LAYOUT);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The first user of an account has no list to go back to, so the way out is only offered to someone who
  // arrived from one.
  const canCancel = Boolean(location.state?.fromList);
  const floors = Number(layout.floors);
  const perFloor = Number(layout.perFloor);
  const dueAmount = Number(layout.dueAmount);
  const countError = validateCounts(floors, perFloor);
  const isLayoutBlank = layout.floors === "" && layout.perFloor === "";
  const previewNotice = isLayoutBlank ? "Kat ve daire sayısını girin, binanız burada belirsin." : countError;
  const previewFloors = countError ? [] : toPreviewFloors(floors, perFloor, layout.groundFloor);
  const cellCount = Math.min(perFloor, PREVIEW_CELL_LIMIT);
  const buildingName = nameInput.trim();
  const isBlankFallback = step === 1 && Boolean(countError);

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

  // Called both by the submit and by the secondary button, which finishes the wizard without a layout
  // rather than skipping ahead to a step that does not exist.
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
        name: buildingName,
        layout: withLayout ? { floors, perFloor, groundFloor: layout.groundFloor, dueAmount, type: layout.type } : null,
      });

      if (res.success) {
        setCurrentBuilding({ id: res.id, name: buildingName });
        showDialog.toast(
          `"${buildingName}" binası oluşturuldu.`,
          res.apartmentCount > 0
            ? `${res.apartmentCount} daire eklendi.`
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
            <section className="nb-band nb-band--fill">
              <form className="nb-form nb-form--name" onSubmit={handleNameSubmit}>
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

                <aside className="auth-note">
                  <span className="auth-note-icon" aria-hidden="true">
                    <FiInfo size={18} />
                  </span>
                  <div>
                    <p className="auth-note-title">Bina adı nerede görünür?</p>
                    <p className="auth-note-body">
                      Panoda, raporlarda, makbuz ve gider pusulalarında basılır. Sonradan Bina Seçimi ekranından
                      değiştirilebilir.
                    </p>
                  </div>
                </aside>

                {error && (
                  <p className="nb-error" role="alert">
                    <FiAlertCircle size={18} aria-hidden="true" />
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
            <section className="nb-band nb-band--fill">
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
                    <FiAlertCircle size={18} aria-hidden="true" />
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

        <BuildingPreview
          name={buildingName}
          notice={previewNotice}
          isWarning={!isLayoutBlank}
          rows={isBlankFallback ? FALLBACK_PREVIEW_FLOORS : previewFloors}
          cellCount={isBlankFallback ? FALLBACK_CELL_COUNT : cellCount}
          isBlank={step === 1}
        />
      </div>
    </div>
  );
}

export default NewBuilding;
