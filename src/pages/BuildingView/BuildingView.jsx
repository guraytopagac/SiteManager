// Draws the building as a facade and owns the apartment lifecycle: add, edit and delete live here only.
// The wizard's facade shares the look but no code, since this one is built from real, irregular rows.

import { useState } from "react";
import {
  FiAlertTriangle,
  FiCalendar,
  FiEdit2,
  FiGrid,
  FiHome,
  FiPlus,
  FiRefreshCw,
  FiSkipBack,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import "./BuildingView.css";
import DetailRow from "@/components/DetailRow/DetailRow";
import { showDialog } from "@/components/Dialog/dialogStore";
import PageHeader from "@/components/PageHeader/PageHeader";
import PeriodSelector from "@/components/PeriodSelector/PeriodSelector";
import ApartmentAddModal from "./BuildingViewModals/ApartmentAddModal";
import ApartmentEditModal from "./BuildingViewModals/ApartmentEditModal";
import { useIpcData } from "@/hooks/useIpcData";
import { useCurrentBuilding } from "@/hooks/useSession";
import {
  DUES_STATUS_LABELS,
  DUES_STATUS_ORDER,
  EMPTY_RESIDENT_LABEL,
  UNEXPECTED_ERROR_MESSAGE,
} from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { clampMonth, formatMonthYear, getCurrentMonth, getCurrentYear } from "@/utils/date";
import { floorLabel } from "@/utils/floorLabel";

function countByStatus(units, status) {
  return units.filter((unit) => unit.status === status).length;
}

function floorTag(floor) {
  return floor === 0 ? "Z" : String(floor);
}

function areaLabel(squareMeters) {
  return squareMeters == null ? "—" : `${squareMeters} m²`;
}

function groupByFloor(units) {
  return [...Map.groupBy(units, (unit) => unit.floor)]
    .sort(([leftFloor], [rightFloor]) => rightFloor - leftFloor)
    .map(([floor, floorUnits]) => ({ floor, tag: floorTag(floor), title: floorLabel(floor), units: floorUnits }));
}

// Two step confirmation: a deleted apartment drops out of every read and would take its debt with it, so the
// service refuses while a balance is unpaid. Both calls share one result and no busy flag, so no helper.
async function deleteApartmentFlow(unit, buildingId, onDone) {
  const confirmed = await showDialog.confirmDanger(
    "Daireyi Sil",
    <>
      <b>Daire {unit.apartment_no}</b> apartmanınızdan silinecek. Yalnızca bu daire apartmanınızda bulunmuyorsa bu
      işlemi gerçekleştiriniz. Bu işlem geri alınamaz.
    </>,
    "Vazgeç",
    "Evet, Sil",
  );

  if (!confirmed) return;

  try {
    let res = await window.electronAPI.deleteApartment({ id: unit.apartment_id, buildingId });

    if (res.code === "HAS_UNPAID_DUES") {
      const forced = await showDialog.confirmDanger(
        "Ödenmemiş Aidat Var",
        <>
          <b>Daire {unit.apartment_no}</b> için <b>{formatCurrency(res.unpaidTotal)}</b> borç görünüyor.
        </>,
        "Vazgeç",
        "Yine de Sil",
      );

      if (!forced) return;

      res = await window.electronAPI.deleteApartment({ id: unit.apartment_id, buildingId, force: true });
    }

    if (res.success) {
      showDialog.toast(res.message);
      onDone();
    } else {
      showDialog.error("Hata", res.message);
    }
  } catch (err) {
    console.error("[BuildingView] deleteApartment:", err);
    showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
  }
}

// Reads the same endpoint the dues list uses. One call already returns apartment fields, the period's
// resident and the period's status, so the facade can be drawn and coloured without a second query.
function useBuildingUnits(buildingId, year, month) {
  const [res, loadUnits] = useIpcData("getDuesForMonth", { buildingId, year, month });

  return {
    units: res.success ? res.data : [],
    start: res.success ? res.start : null,
    errorMessage: res.success ? "" : res.message || "Veriler alınamadı.",
    loadUnits,
  };
}

// Always visible while the mode is on, never revealed by hover. Empty slots are not inferred, since nothing
// records how many apartments a floor should hold, so each floor gets exactly one add point.
function AddUnitButton({ floor, onAdd }) {
  const label = `${floorLabel(floor)} için daire ekle`;

  return (
    <button
      type="button"
      className="bv-unit bv-unit--add"
      title={label}
      aria-label={label}
      onClick={() => onAdd(floor)}
    >
      <FiPlus />
    </button>
  );
}

// Off by default, and it governs the add slots alone: edit and delete in the panel stay visible either way.
// Positioned absolutely over the scene, so it costs the tightly measured card no vertical room.
function EditModeToggle({ isOn, onToggle }) {
  return (
    <button
      type="button"
      className={isOn ? "bv-mode bv-mode--on" : "bv-mode"}
      role="switch"
      aria-checked={isOn}
      title="Açıkken her katın sonunda daire ekleme kutusu görünür"
      onClick={onToggle}
    >
      Düzenleme Modu
      <span className="bv-mode-track" aria-hidden="true">
        <span className="bv-mode-thumb" />
      </span>
    </button>
  );
}

function UnitButton({ unit, isSelected, onSelect }) {
  return (
    <button
      type="button"
      className={isSelected ? `bv-unit bv-unit--${unit.status} bv-unit--selected` : `bv-unit bv-unit--${unit.status}`}
      title={`Daire ${unit.apartment_no} · ${DUES_STATUS_LABELS[unit.status]}`}
      aria-pressed={isSelected}
      onClick={() => onSelect(unit.apartment_id)}
    >
      {unit.apartment_no}
    </button>
  );
}

function Facade({ levelCount, children }) {
  return (
    <div className="bv-scene">
      <div className="bv-yard">
        <figure className="bv-facade" style={{ "--bv-levels": levelCount }}>
          <div className="bv-wall">
            {children}
            <div className="bv-lobby" aria-hidden="true">
              <span className="bv-door" />
            </div>
          </div>
          <span className="bv-shadow" aria-hidden="true" />
        </figure>
        <span className="bv-ground" aria-hidden="true" />
      </div>
    </div>
  );
}

// A status summary rather than a legend, so the count comes before the label. The order is shared with the
// filter pills on the dues page, so the two never list the same three states differently.
function StatusSummary({ units }) {
  return (
    <div className="bv-summary">
      <span className="bv-summary-total">{units.length} daire</span>
      <span className="bv-summary-items">
        {DUES_STATUS_ORDER.map((status) => (
          <span className="bv-summary-item" key={status}>
            <span className={`bv-summary-dot bv-summary-dot--${status}`} aria-hidden="true" />
            <b className="bv-summary-count">{countByStatus(units, status)}</b>
            {DUES_STATUS_LABELS[status]}
          </span>
        ))}
      </span>
    </div>
  );
}

function StagePlaceholder({ tone, icon, title, body, actionIcon, actionLabel, onAction }) {
  return (
    <div className="bv-state" role={tone === "error" ? "alert" : undefined}>
      <span className={`bv-state-mark bv-state-mark--${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span className="bv-state-text">
        <span className="bv-state-title">{title}</span>
        <span className="bv-state-body">{body}</span>
      </span>
      {onAction && (
        <button type="button" className="bv-state-action" onClick={onAction}>
          {actionIcon}
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function BuildingPlan({ levels, units, selectedId, isEditMode, onSelect, onAdd }) {
  return (
    <>
      <Facade levelCount={levels.length}>
        {levels.map((level) => (
          <div className="bv-level" key={level.floor}>
            <span className="bv-floor" title={level.title}>
              {level.tag}
            </span>
            <span className="bv-units">
              {level.units.map((unit) => (
                <UnitButton
                  key={unit.apartment_id}
                  unit={unit}
                  isSelected={unit.apartment_id === selectedId}
                  onSelect={onSelect}
                />
              ))}
              {isEditMode && <AddUnitButton floor={level.floor} onAdd={onAdd} />}
            </span>
          </div>
        ))}
      </Facade>

      <StatusSummary units={units} />
    </>
  );
}

function DetailPanel({ unit, onClear, onEdit, onDelete }) {
  if (!unit) {
    return (
      <aside className="bv-panel" aria-label="Daire detayı">
        <div className="bv-panel-empty">
          <span className="bv-panel-mark" aria-hidden="true">
            <FiGrid />
          </span>
          <span className="bv-panel-empty-title">Daire seçilmedi</span>
          <span className="bv-panel-empty-body">Soldaki plandan bir daire seçtiğinizde bilgileri burada görünür.</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="bv-panel bv-panel--filled" aria-label={`Daire ${unit.apartment_no} detayı`}>
      <div className="bv-panel-head">
        <div className="bv-panel-identity">
          <h2 className="bv-panel-no">Daire {unit.apartment_no}</h2>
          <span className="bv-panel-floor">{floorLabel(unit.floor)}</span>
        </div>
        <button type="button" className="bv-panel-close" onClick={onClear} aria-label="Seçimi kaldır">
          <FiX />
        </button>
      </div>

      <div className="bv-panel-body">
        <section className="bv-section">
          <div className="bv-section-head">
            <span className="bv-section-title">Aidat Bilgileri</span>
          </div>
          <dl>
            <DetailRow label="Aidat" value={formatCurrency(unit.due_amount)} />
            <DetailRow label="Ödenen" value={formatCurrency(unit.paid_amount)} />
            <DetailRow label="Kalan" value={formatCurrency(unit.due_amount - unit.paid_amount)} />
            <DetailRow
              label="Durum"
              value={<span className={`bv-status bv-status--${unit.status}`}>{DUES_STATUS_LABELS[unit.status]}</span>}
            />
          </dl>
        </section>

        <section className="bv-section">
          <div className="bv-section-head">
            <span className="bv-section-title">Daire Bilgileri</span>
          </div>
          <dl>
            <DetailRow label="Tip" value={unit.type} />
            <DetailRow label="Alan" value={areaLabel(unit.square_meters)} />
            <DetailRow
              label="Sakin"
              value={unit.resident_name || EMPTY_RESIDENT_LABEL}
              title={unit.resident_name || undefined}
            />
          </dl>
        </section>
      </div>

      <div className="bv-panel-actions">
        <button type="button" className="bv-panel-action" onClick={onEdit}>
          <FiEdit2 />
          Düzenle
        </button>
        <button type="button" className="bv-panel-action bv-panel-action--danger" onClick={onDelete}>
          <FiTrash2 />
          Sil
        </button>
      </div>
    </aside>
  );
}

function BuildingView() {
  const building = useCurrentBuilding();
  const [year, setYear] = useState(getCurrentYear());
  const [month, setMonth] = useState(getCurrentMonth());
  const [addTarget, setAddTarget] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const { units, start, errorMessage, loadUnits } = useBuildingUnits(building.id, year, month);

  const levels = groupByFloor(units);
  const hasPlan = !errorMessage && units.length > 0;
  const selectedUnit = units.find((unit) => unit.apartment_id === selectedId) ?? null;

  const handleYearChange = (nextYear) => {
    setYear(nextYear);
    setMonth((current) => clampMonth(nextYear, current));
  };

  const goToStartPeriod = () => {
    setYear(start.year);
    setMonth(start.month);
  };

  const openAddModal = (floor) => setAddTarget({ floor });

  const handleSelect = (apartmentId) => {
    setSelectedId((current) => (current === apartmentId ? null : apartmentId));
  };

  const renderStage = () => {
    if (errorMessage) {
      return (
        <StagePlaceholder
          tone="error"
          icon={<FiAlertTriangle />}
          title="Bina planı okunamadı"
          body={errorMessage}
          actionIcon={<FiRefreshCw />}
          actionLabel="Yeniden Dene"
          onAction={loadUnits}
        />
      );
    }

    if (units.length === 0) {
      if (start) {
        return (
          <StagePlaceholder
            tone="muted"
            icon={<FiCalendar />}
            title="Bu dönemde kayıtlı daire yok"
            body={`Bu binanın daire kayıtları ${formatMonthYear(start.year, start.month)} ayında başlıyor.`}
            actionIcon={<FiSkipBack />}
            actionLabel="Kayıtların Başladığı Aya Git"
            onAction={goToStartPeriod}
          />
        );
      }

      return (
        <StagePlaceholder
          tone="accent"
          icon={<FiHome />}
          title="Bu binada henüz daire yok"
          body="İlk daireyi ekleyin, bina planı burada oluşsun."
          actionIcon={<FiPlus />}
          actionLabel="Yeni Daire Ekle"
          onAction={() => openAddModal("")}
        />
      );
    }

    return (
      <BuildingPlan
        levels={levels}
        units={units}
        selectedId={selectedId}
        isEditMode={isEditMode}
        onSelect={handleSelect}
        onAdd={(floor) => openAddModal(String(floor))}
      />
    );
  };

  return (
    <div className="bv-container">
      <PageHeader title="Bina Görünümü" />

      <section className="page-band bv-stage-band" aria-label="Bina planı">
        <div className="bv-stage-split">
          <div className="bv-period">
            <PeriodSelector year={year} month={month} onYearChange={handleYearChange} onMonthChange={setMonth} />
          </div>
          <div className="bv-stage">
            {hasPlan && <EditModeToggle isOn={isEditMode} onToggle={() => setIsEditMode((current) => !current)} />}
            {renderStage()}
          </div>
          <DetailPanel
            unit={selectedUnit}
            onClear={() => setSelectedId(null)}
            onEdit={() => setIsEditModalOpen(true)}
            onDelete={() =>
              deleteApartmentFlow(selectedUnit, building.id, () => {
                setSelectedId(null);
                loadUnits();
              })
            }
          />
        </div>
      </section>

      {addTarget && (
        <ApartmentAddModal
          building={building}
          initialFloor={addTarget.floor}
          onClose={() => setAddTarget(null)}
          onSaved={() => {
            setAddTarget(null);
            loadUnits();
          }}
        />
      )}

      {isEditModalOpen && selectedUnit && (
        <ApartmentEditModal
          apartment={selectedUnit}
          building={building}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={() => {
            setIsEditModalOpen(false);
            loadUnits();
          }}
        />
      )}
    </div>
  );
}

export default BuildingView;
