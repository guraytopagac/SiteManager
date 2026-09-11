import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCalendar,
  FiClock,
  FiEdit2,
  FiGrid,
  FiHome,
  FiLogOut,
  FiRefreshCw,
  FiRepeat,
  FiSearch,
  FiSkipBack,
  FiUser,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";
import "./Residents.css";
import DetailRow from "@/components/DetailRow/DetailRow";
import PageHeader from "@/components/PageHeader/PageHeader";
import Pager from "@/components/Pager/Pager";
import PeriodSelector from "@/components/PeriodSelector/PeriodSelector";
import SearchBox from "@/components/SearchBox/SearchBox";
import UnitCell from "@/components/UnitCell/UnitCell";
import ResidentChangeModal from "./ResidentsModals/ResidentChangeModal";
import ResidentFormModal from "./ResidentsModals/ResidentFormModal";
import ResidentHistoryModal from "./ResidentsModals/ResidentHistoryModal";
import { useCurrentBuilding } from "@/hooks/useSession";
import {
  EMPTY_RESIDENT_LABEL,
  RESIDENT_TYPE_LABELS,
  UNEXPECTED_ERROR_MESSAGE,
  UNNAMED_RESIDENT_LABEL,
} from "@/utils/constants";
import { clampMonth, formatDate, formatMonthYear, getCurrentMonth, getCurrentYear } from "@/utils/date";
import { floorLabel } from "@/utils/floorLabel";
import { formatPhone } from "@/utils/phoneNumber";
import { searchKey } from "@/utils/searchKey";

const PAGE_SIZE = 5;

const COLUMNS = ["Daire", "Oturan", "Malik", "Yaşayan Kişi"];

const FILTER_PILLS = [
  { key: "all", label: "Tümü" },
  { key: "occupied", label: "Dolu" },
  { key: "vacant", label: "Boş" },
];

const ROLE_ORDER = ["tenant", "owner"];

const ROLES = {
  tenant: {
    label: RESIDENT_TYPE_LABELS.tenant,
    emptyTitle: "Kiracı kaydı yok",
    emptyBody: "Daire kiraya verildiyse kiracının iletişim bilgilerini kaydedin.",
    closedNote: "Çıktı",
    scheduledNote: "Çıkış",
    pendingLabel: "Sıradaki kiracı",
    tellsOccupancy: false,
    addAction: "Kiracı Ekle",
    moveOutAction: "Kiracı Çıkışı",
    moveOutIcon: <FiLogOut />,
    scheduleAction: "Çıkışı Düzenle",
  },
  owner: {
    label: RESIDENT_TYPE_LABELS.owner,
    emptyTitle: "Malik kaydı yok",
    emptyBody: "Daire sahibinin iletişim bilgilerini kaydedin.",
    closedNote: "Devredildi",
    scheduledNote: "Devir",
    pendingLabel: "Sıradaki malik",
    tellsOccupancy: true,
    addAction: "Malik Ekle",
    moveOutAction: "Malik Değiştir",
    moveOutIcon: <FiRepeat />,
    scheduleAction: "Devri Düzenle",
  },
};

function residentAt(unit, scope) {
  const id = unit[`${scope}_id`];
  if (!id) return null;

  return {
    id,
    full_name: unit[`${scope}_full_name`],
    phone: unit[`${scope}_phone`],
    email: unit[`${scope}_email`],
    national_id: unit[`${scope}_national_id`],
    household_size: unit[`${scope}_household_size`],
    is_occupant: Boolean(unit[`${scope}_is_occupant`]),
    move_out_date: unit[`${scope}_move_out_date`],
    start_date: unit[`${scope}_start_date`],
    is_active: Boolean(unit[`${scope}_is_active`]),
  };
}

function toRoleState(role, record, pending) {
  const isOpen = Boolean(record && record.is_active);

  return {
    role,
    text: ROLES[role],
    record,
    pending,
    isOpen,
    openRecord: isOpen ? record : null,
    isScheduled: isOpen && Boolean(record.move_out_date),
  };
}

function unitRoles(unit) {
  const occupantIsTenant = unit.occupant_resident_type === "tenant";

  return {
    tenant: toRoleState(
      "tenant",
      occupantIsTenant ? residentAt(unit, "occupant") : null,
      residentAt(unit, "pending_tenant"),
    ),
    owner: toRoleState("owner", residentAt(unit, "owner"), residentAt(unit, "pending_owner")),
  };
}

function defaultRole(roles) {
  if (roles.tenant.record) return "tenant";
  return roles.owner.record ? "owner" : "tenant";
}

function roleNote(roleState, hasOpenTenant) {
  const { record, text } = roleState;

  if (!record.is_active) return `${text.closedNote} · ${formatDate(record.move_out_date)}`;
  if (record.move_out_date) return `${text.scheduledNote} · ${formatDate(record.move_out_date)}`;
  if (!text.tellsOccupancy || hasOpenTenant) return null;
  return record.is_occupant ? "Dairede oturuyor" : "Dairede oturmuyor";
}

function roleActions(roleState, { onForm, onMoveOut, onEditSchedule }) {
  const { role, text, isOpen, isScheduled } = roleState;

  if (!isOpen) {
    return [{ icon: <FiUserPlus />, label: text.addAction, isWide: true, onClick: () => onForm(role) }];
  }

  return [
    { icon: <FiEdit2 />, label: "Düzenle", onClick: () => onForm(role) },
    isScheduled
      ? { icon: <FiCalendar />, label: text.scheduleAction, onClick: () => onEditSchedule(role) }
      : { icon: text.moveOutIcon, label: text.moveOutAction, onClick: () => onMoveOut(role) },
  ];
}

function useResidents(buildingId, year, month) {
  const [units, setUnits] = useState([]);
  const [start, setStart] = useState(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadResidents = useCallback(async () => {
    setErrorMessage("");

    try {
      const res = await window.electronAPI.getResidentsOverview({ buildingId, year, month });
      if (res.success) {
        setUnits(res.data);
        setStart(res.start);
      } else {
        setErrorMessage(res.message || "Veriler alınamadı.");
      }
    } catch (err) {
      console.error("[Residents] getResidentsOverview:", err);
      setErrorMessage(UNEXPECTED_ERROR_MESSAGE);
    }

    setIsFirstLoad(false);
  }, [buildingId, year, month]);

  useEffect(() => {
    (async () => {
      await loadResidents();
    })();
  }, [loadResidents]);

  return { units, start, isFirstLoad, errorMessage, loadResidents };
}

function TableShell({ overlay, spacerCount = 0, children }) {
  const isPlaceholder = Boolean(overlay);
  const spacers = [];

  for (let index = 0; index < spacerCount; index += 1) {
    spacers.push(
      <tr className="rs-row-spacer" aria-hidden="true" key={`spacer-${index}`}>
        <td colSpan={COLUMNS.length}>
          <span className="unit-cell">
            <span className="unit-tag">&nbsp;</span>
            <span className="unit-floor">&nbsp;</span>
          </span>
        </td>
      </tr>,
    );
  }

  return (
    <div className={isPlaceholder ? "rs-table-surface rs-table-placeholder" : "rs-table-surface"}>
      <table className="rs-table" aria-hidden={isPlaceholder ? "true" : undefined}>
        <thead>
          <tr>
            {COLUMNS.map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          {spacers}
        </tbody>
      </table>
      {overlay}
    </div>
  );
}

function NameCell({ id, name, emptyLabel }) {
  const hasName = Boolean(id && name);

  return (
    <td className={hasName ? "rs-name" : "rs-name rs-name-empty"} title={name || undefined}>
      {id ? name || UNNAMED_RESIDENT_LABEL : emptyLabel}
    </td>
  );
}

function HouseholdCell({ occupantId, size }) {
  if (!occupantId) return <td className="rs-muted">—</td>;
  if (size == null)
    return (
      <td className="rs-muted" title="Bilinmiyor">
        ?
      </td>
    );

  return <td className="rs-count">{size}</td>;
}

function UnitRow({ unit, isSelected, onSelect }) {
  return (
    <tr
      className={isSelected ? "rs-row rs-row--selected" : "rs-row"}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onSelect();
      }}
    >
      <td>
        <UnitCell apartmentNo={unit.apartment_no} floor={unit.floor} />
      </td>
      <NameCell id={unit.occupant_id} name={unit.occupant_full_name} emptyLabel={EMPTY_RESIDENT_LABEL} />
      <NameCell id={unit.owner_id} name={unit.owner_full_name} emptyLabel="—" />
      <HouseholdCell occupantId={unit.occupant_id} size={unit.occupant_household_size} />
    </tr>
  );
}

function SkeletonRows() {
  const skeletons = [];

  for (let index = 0; index < PAGE_SIZE; index += 1) {
    skeletons.push(
      <tr key={`skeleton-${index}`}>
        <td>
          <span className="unit-cell">
            <span className="unit-tag rs-skeleton">&nbsp;</span>
            <span className="unit-floor rs-skeleton rs-skeleton-floor" />
          </span>
        </td>
        <td>
          <div className="rs-skeleton rs-skeleton-name" />
        </td>
        <td>
          <div className="rs-skeleton rs-skeleton-name" />
        </td>
        <td>
          <div className="rs-skeleton rs-skeleton-count" />
        </td>
      </tr>,
    );
  }

  return skeletons;
}

function ListPlaceholder({ icon, tone, title, body, actionIcon, actionLabel, onAction, role }) {
  return (
    <TableShell
      overlay={
        <div className="rs-placeholder-body">
          <div className="rs-state" role={role}>
            <span className={tone ? `rs-state-mark rs-state-mark--${tone}` : "rs-state-mark"} aria-hidden="true">
              {icon}
            </span>
            <span className="rs-state-text">
              <span className="rs-state-title">{title}</span>
              <span className="rs-state-body">{body}</span>
            </span>
            {onAction && (
              <button type="button" className="rs-state-action" onClick={onAction}>
                {actionIcon}
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      }
      spacerCount={PAGE_SIZE}
    />
  );
}

function PanelEmpty({ title, body }) {
  return (
    <div className="rs-panel-empty">
      <span className="rs-panel-mark" aria-hidden="true">
        <FiUser />
      </span>
      <span className="rs-panel-empty-title">{title}</span>
      <span className="rs-panel-empty-body">{body}</span>
    </div>
  );
}

function OccupancySummary({ units, isFirstLoad, hasError }) {
  const occupied = units.filter((unit) => unit.occupant_id).length;
  const people = units.reduce((sum, unit) => sum + (unit.occupant_id ? unit.occupant_household_size || 0 : 0), 0);
  const occupancyPercent = units.length > 0 ? Math.round((occupied / units.length) * 100) : null;
  const hasPercent = !hasError && occupancyPercent !== null;
  const skeletonClass = isFirstLoad ? " rs-skeleton" : "";
  const summaryText = isFirstLoad
    ? ""
    : hasError
      ? "Doluluk okunamadı"
      : occupancyPercent === null
        ? "Binada kayıtlı daire yok"
        : `${occupied} / ${units.length} daire dolu · ${people} kişi`;

  return (
    <div className="rs-summary">
      <div className="rs-summary-top">
        <span className="rs-summary-label">
          <span className="rs-summary-mark" aria-hidden="true">
            <FiUsers />
          </span>
          Doluluk
        </span>
        <span className={`rs-summary-value${hasPercent ? "" : " rs-summary-value--blank"}${skeletonClass}`}>
          {isFirstLoad ? "" : hasPercent ? `%${occupancyPercent}` : "—"}
        </span>
      </div>
      {(isFirstLoad || hasPercent) && (
        <span className={`rs-summary-meter${skeletonClass}`} aria-hidden="true">
          <span style={{ width: `${Math.min(occupancyPercent ?? 0, 100)}%` }} />
        </span>
      )}
      <span className={`rs-summary-amounts${skeletonClass}`}>{summaryText}</span>
    </div>
  );
}

function PanelActions({ roleState, isReadOnly, readOnlyNote, onForm, onMoveOut, onEditSchedule, onHistory }) {
  return (
    <div className="rs-panel-actions">
      {isReadOnly ? (
        <p className="rs-panel-note">{readOnlyNote}</p>
      ) : (
        roleActions(roleState, { onForm, onMoveOut, onEditSchedule }).map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.isWide ? "rs-panel-action rs-panel-action--wide" : "rs-panel-action"}
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </button>
        ))
      )}
      <button type="button" className="rs-panel-action rs-panel-action--wide" onClick={onHistory}>
        <FiClock />
        Daire Geçmişi
      </button>
    </div>
  );
}

function DetailPanel({ unit, roles, isReadOnly, period, onClose, onForm, onMoveOut, onEditSchedule, onHistory }) {
  const [role, setRole] = useState(() => defaultRole(roles));
  const [roleKey, setRoleKey] = useState(unit.apartment_id);

  if (roleKey !== unit.apartment_id) {
    setRoleKey(unit.apartment_id);
    setRole(defaultRole(roles));
  }

  const roleState = roles[role];
  const note = roleState.record ? roleNote(roleState, roles.tenant.isOpen) : null;
  const readOnlyNote = `${formatMonthYear(period.year, period.month)} kaydı görüntüleniyor, geçmiş dönem değiştirilemez.`;

  return (
    <>
      <div className="rs-panel-head">
        <div className="rs-panel-identity">
          <h2 className="rs-panel-no">Daire {unit.apartment_no}</h2>
          <span className="rs-panel-floor">{floorLabel(unit.floor)}</span>
        </div>
        <button type="button" className="rs-panel-close" onClick={onClose} aria-label="Kapat">
          <FiX />
        </button>
      </div>
      <div className="rs-panel-body">
        <div className="rs-roles">
          {ROLE_ORDER.map((key) => {
            const isActive = role === key;

            return (
              <button
                key={key}
                type="button"
                className={isActive ? "rs-role rs-role--active" : "rs-role"}
                onClick={() => setRole(key)}
                aria-pressed={isActive}
              >
                {roles[key].record && <span className="rs-role-mark" aria-hidden="true" />}
                {roles[key].text.label}
              </button>
            );
          })}
        </div>

        {roleState.record ? (
          <section className="rs-section rs-section--fill">
            {note && <span className="rs-section-note">{note}</span>}
            {roleState.isScheduled && roleState.pending && (
              <span className="rs-section-note">
                {roleState.text.pendingLabel}: {roleState.pending.full_name || UNNAMED_RESIDENT_LABEL}
              </span>
            )}
            <dl>
              <DetailRow label="Ad Soyad" value={roleState.record.full_name} />
              <DetailRow label="Telefon" value={formatPhone(roleState.record.phone)} />
              <DetailRow label="E-posta" value={roleState.record.email} />
              <DetailRow label="TC Kimlik" value={roleState.record.national_id} />
            </dl>
          </section>
        ) : (
          <PanelEmpty title={roleState.text.emptyTitle} body={roleState.text.emptyBody} />
        )}
      </div>
      <PanelActions
        roleState={roleState}
        isReadOnly={isReadOnly}
        readOnlyNote={readOnlyNote}
        onForm={onForm}
        onMoveOut={onMoveOut}
        onEditSchedule={onEditSchedule}
        onHistory={onHistory}
      />
    </>
  );
}

function ResidentsControlBar({
  units,
  statusFilter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  isFirstLoad,
}) {
  const occupied = units.filter((unit) => unit.occupant_id).length;
  const counts = { all: units.length, occupied, vacant: units.length - occupied };

  return (
    <section className="page-band rs-control-row" aria-label="Filtre ve arama">
      {FILTER_PILLS.map((pill) => {
        const isActive = statusFilter === pill.key;
        const modifier = pill.key === "all" ? "" : ` rs-pill--${pill.key}`;

        return (
          <button
            key={pill.key}
            type="button"
            className={`rs-pill${modifier}${isActive ? " rs-pill--active" : ""}`}
            onClick={() => onFilterChange(pill.key)}
            disabled={isFirstLoad}
            aria-pressed={isActive}
          >
            {pill.key !== "all" && <span className="rs-pill-dot" aria-hidden="true" />}
            {pill.label}
            {!isFirstLoad && <span className="rs-pill-count">{counts[pill.key]}</span>}
          </button>
        );
      })}

      <SearchBox
        label="Daire, sakin veya malik ara"
        value={searchTerm}
        disabled={isFirstLoad}
        onChange={onSearchChange}
      />

      <PeriodSelector
        year={selectedYear}
        month={selectedMonth}
        onYearChange={onYearChange}
        onMonthChange={onMonthChange}
      />
    </section>
  );
}

function Residents() {
  const navigate = useNavigate();
  const building = useCurrentBuilding();

  const [selectedYear, setSelectedYear] = useState(() => getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth());
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageKey, setPageKey] = useState("");
  const [selectedApartmentId, setSelectedApartmentId] = useState(null);
  const [formTarget, setFormTarget] = useState(null);
  const [moveOutTarget, setMoveOutTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  const { units, start, isFirstLoad, errorMessage, loadResidents } = useResidents(
    building.id,
    selectedYear,
    selectedMonth,
  );

  const isReadOnly = selectedYear !== getCurrentYear() || selectedMonth !== getCurrentMonth();

  const handleYearChange = (year) => {
    setSelectedYear(year);
    setSelectedMonth((month) => clampMonth(year, month));
  };

  const goToStartPeriod = () => {
    setSelectedYear(start.year);
    setSelectedMonth(start.month);
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setSearchTerm("");
  };

  const handleSaved = () => {
    setFormTarget(null);
    setMoveOutTarget(null);
    loadResidents();
  };

  const term = searchKey(searchTerm).trim();
  const filteredUnits = units.filter((unit) => {
    if (statusFilter === "occupied" && !unit.occupant_id) return false;
    if (statusFilter === "vacant" && unit.occupant_id) return false;
    if (!term) return true;
    return (
      searchKey(unit.apartment_no).includes(term) ||
      searchKey(unit.occupant_full_name).includes(term) ||
      searchKey(unit.owner_full_name).includes(term)
    );
  });

  const nextPageKey = `${statusFilter}|${searchTerm}|${selectedYear}|${selectedMonth}`;
  if (pageKey !== nextPageKey) {
    setPageKey(nextPageKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(filteredUnits.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedUnits = filteredUnits.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectedUnit = units.find((unit) => unit.apartment_id === selectedApartmentId) || null;
  const panelUnit = errorMessage ? null : selectedUnit;
  const panelRoles = panelUnit ? unitRoles(panelUnit) : null;
  const panelTarget = (role, extra) => ({ unit: panelUnit, roles: panelRoles, role, ...extra });

  const renderList = () => {
    if (isFirstLoad) {
      return (
        <TableShell>
          <SkeletonRows />
        </TableShell>
      );
    }

    if (errorMessage) {
      return (
        <ListPlaceholder
          icon={<FiAlertTriangle />}
          title="Sakin listesi okunamadı"
          body={errorMessage}
          actionIcon={<FiRefreshCw />}
          actionLabel="Yeniden Dene"
          onAction={loadResidents}
          role="alert"
        />
      );
    }

    if (units.length === 0) {
      if (start) {
        return (
          <ListPlaceholder
            icon={<FiCalendar />}
            tone="muted"
            title="Bu dönemde kayıtlı daire yok"
            body={`Bu binanın daire kayıtları ${formatMonthYear(start.year, start.month)} ayında başlıyor.`}
            actionIcon={<FiSkipBack />}
            actionLabel="Kayıtların Başladığı Aya Git"
            onAction={goToStartPeriod}
          />
        );
      }

      return (
        <ListPlaceholder
          icon={<FiHome />}
          tone="accent"
          title="Bu binada henüz daire yok"
          body="Sakin kaydı ilk daireyi ekledikten sonra başlar."
          actionIcon={<FiGrid />}
          actionLabel="Bina Görünümü"
          onAction={() => navigate("/building-view")}
        />
      );
    }

    if (filteredUnits.length === 0) {
      return (
        <ListPlaceholder
          icon={<FiSearch />}
          tone="muted"
          title="Eşleşen daire yok"
          body="Seçili filtre ve arama ile listelenecek daire bulunamadı."
          actionIcon={<FiRefreshCw />}
          actionLabel="Filtreyi Temizle"
          onAction={clearFilters}
        />
      );
    }

    return (
      <TableShell spacerCount={PAGE_SIZE - pagedUnits.length}>
        {pagedUnits.map((unit) => (
          <UnitRow
            key={unit.apartment_id}
            unit={unit}
            isSelected={unit.apartment_id === selectedApartmentId}
            onSelect={() =>
              setSelectedApartmentId((current) => (current === unit.apartment_id ? null : unit.apartment_id))
            }
          />
        ))}
      </TableShell>
    );
  };

  return (
    <div className="residents-container">
      <PageHeader title="Sakinler" />

      <ResidentsControlBar
        units={units}
        statusFilter={statusFilter}
        onFilterChange={setStatusFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onYearChange={handleYearChange}
        onMonthChange={setSelectedMonth}
        isFirstLoad={isFirstLoad}
      />

      <section className="page-band" aria-label="Sakin listesi">
        <div className="rs-list-split">
          <div className="rs-list-main">{renderList()}</div>

          <div className="rs-rail">
            <section className="rs-panel">
              {panelUnit ? (
                <DetailPanel
                  unit={panelUnit}
                  roles={panelRoles}
                  isReadOnly={isReadOnly}
                  period={{ year: selectedYear, month: selectedMonth }}
                  onClose={() => setSelectedApartmentId(null)}
                  onForm={(role) => setFormTarget(panelTarget(role))}
                  onMoveOut={(role) => setMoveOutTarget(panelTarget(role))}
                  onEditSchedule={(role) => setMoveOutTarget(panelTarget(role, { isEdit: true }))}
                  onHistory={() => setHistoryTarget(panelUnit)}
                />
              ) : (
                <>
                  <OccupancySummary units={units} isFirstLoad={isFirstLoad} hasError={Boolean(errorMessage)} />
                  <PanelEmpty
                    title="Daire seçilmedi"
                    body="Listeden bir daire seçin, sakin bilgileri burada görünür."
                  />
                </>
              )}
            </section>
          </div>

          <Pager currentPage={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      </section>

      {formTarget && (
        <ResidentFormModal
          apartment={formTarget.unit}
          resident={formTarget.roles[formTarget.role].openRecord}
          residentType={formTarget.role}
          hasTenant={formTarget.roles.tenant.isOpen}
          building={building}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {moveOutTarget && (
        <ResidentChangeModal
          apartment={moveOutTarget.unit}
          resident={moveOutTarget.roles[moveOutTarget.role].openRecord}
          residentType={moveOutTarget.role}
          hasTenant={moveOutTarget.roles.tenant.isOpen}
          pending={moveOutTarget.roles[moveOutTarget.role].pending}
          isScheduleEdit={Boolean(moveOutTarget.isEdit)}
          building={building}
          onClose={() => setMoveOutTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {historyTarget && (
        <ResidentHistoryModal apartment={historyTarget} building={building} onClose={() => setHistoryTarget(null)} />
      )}
    </div>
  );
}

export default Residents;
