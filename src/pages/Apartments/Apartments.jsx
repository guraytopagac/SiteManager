import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import "./Apartments.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useSession, useCurrentBuilding } from "@/hooks/useSession";
import { showAlert } from "@/utils/alert";
import { formatCurrency } from "@/utils/currency";
import { getCurrentYear, getCurrentMonth, getYearOptions, clampMonth } from "@/utils/date";
import { useDues } from "./useDues";
import DuesSummary from "./components/DuesSummary";
import DuesTable from "./components/DuesTable";
import MonthYearSelector from "./components/MonthYearSelector";
import EditModal from "./components/EditModal";
import PaymentModal from "./components/PaymentModal";
import BulkUpdateModal from "./components/BulkUpdateModal";

function Apartments() {
  const navigate = useNavigate();
  const session = useSession();
  const building = useCurrentBuilding();

  const [selectedYear, setSelectedYear] = useState(() => getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth());
  const [selectedApartmentId, setSelectedApartmentId] = useState(null);
  const [editingApartment, setEditingApartment] = useState(null);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);

  const { dues, loading, errorMessage, refetch } = useDues(building?.id, selectedYear, selectedMonth);

  const handleYearChange = (year) => {
    setSelectedYear(year);
    setSelectedMonth((month) => clampMonth(year, month));
  };

  const selectedDue = useMemo(
    () => (selectedApartmentId ? dues.find((d) => d.apartment_id === selectedApartmentId) || null : null),
    [dues, selectedApartmentId],
  );

  const handlePaymentSaved = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleDelete = async (due) => {
    const confirmed = await showAlert.confirmDanger(
      "Daireyi Sil",
      { html: `<b>Daire ${due.apartment_no}</b> pasife alınacak ve listeden kaldırılacak.` },
      "Vazgeç",
      "Evet, Sil",
    );

    if (!confirmed) return;

    const res = await window.electronAPI.deleteApartment({ id: due.apartment_id, buildingId: building.id });
    if (res.success) {
      showAlert.toast("Pasife Alındı", res.message);
      refetch();
      return;
    }

    if (res.code !== "HAS_UNPAID_DUES") {
      showAlert.error("Hata", res.message);
      return;
    }

    const forced = await showAlert.confirmDanger(
      "Ödenmemiş Aidat Var",
      {
        html: `<b>Daire ${due.apartment_no}</b> için <b>${formatCurrency(res.unpaidTotal)}</b> ödenmemiş aidat bulunuyor. Daire pasife alınırsa bu borç tahsilat oranından ve raporlardan çıkar, kayıtlar veritabanında korunur.`,
      },
      "Vazgeç",
      "Yine de Pasife Al",
    );

    if (!forced) return;

    const forcedRes = await window.electronAPI.deleteApartment({
      id: due.apartment_id,
      buildingId: building.id,
      force: true,
    });

    if (forcedRes.success) {
      showAlert.toast("Pasife Alındı", forcedRes.message);
      refetch();
    } else {
      showAlert.error("Hata", forcedRes.message);
    }
  };

  if (loading) return <div className="loading">Verileriniz Yükleniyor...</div>;
  if (errorMessage)
    return (
      <div className="loading">
        {errorMessage}{" "}
        <button className="button" onClick={refetch}>
          Yeniden Dene
        </button>
      </div>
    );

  const yearOptions = getYearOptions();

  return (
    <div className="apartments-container">
      <div className="apartments-header">
        <h2>Daireler ve Aidat</h2>
        <div className="header-actions">
          <MonthYearSelector
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={handleYearChange}
            yearOptions={yearOptions}
          />
          <AccountMenu />
        </div>
      </div>

      <DuesSummary dues={dues} />

      <DuesTable
        dues={dues}
        onStatusClick={(due) => setSelectedApartmentId(due.apartment_id)}
        renderRowActions={(due) => (
          <>
            <button
              className={due.status === "paid" ? "collect-btn collect-btn-done" : "collect-btn"}
              onClick={() => setSelectedApartmentId(due.apartment_id)}
            >
              {due.status === "paid" ? "Detay" : "Tahsil Et"}
            </button>
            <span className="action-separator" aria-hidden="true" />
            <button
              className="action-btn edit-btn"
              onClick={() => setEditingApartment(due)}
              title="Daireyi düzenle"
              aria-label={`Daire ${due.apartment_no} bilgilerini düzenle`}
            >
              <FiEdit2 size={16} />
            </button>
            <button
              className="action-btn delete-btn"
              onClick={() => handleDelete(due)}
              title="Daireyi sil"
              aria-label={`Daire ${due.apartment_no} kaydını sil`}
            >
              <FiTrash2 size={16} />
            </button>
          </>
        )}
      />

      <hr className="section-divider" />

      <div className="apartments-footer-actions">
        <button className="button button-secondary button-sm" onClick={() => setShowBulkUpdate(true)}>
          Toplu Aidat Güncelle
        </button>
      </div>

      <div className="return-link">
        <button onClick={() => navigate("/dashboard")} className="button">
          Geri Dön
        </button>
      </div>

      {selectedDue && (
        <PaymentModal
          due={selectedDue}
          year={selectedYear}
          month={selectedMonth}
          session={session}
          building={building}
          onClose={() => setSelectedApartmentId(null)}
          onPaymentSaved={handlePaymentSaved}
        />
      )}

      {editingApartment && (
        <EditModal
          apartment={editingApartment}
          building={building}
          onClose={() => setEditingApartment(null)}
          onSaved={() => {
            setEditingApartment(null);
            refetch();
          }}
        />
      )}

      {showBulkUpdate && (
        <BulkUpdateModal
          building={building}
          onClose={() => setShowBulkUpdate(false)}
          onSaved={() => {
            setShowBulkUpdate(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

export default Apartments;
