import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Apartments.css";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { showAlert } from "@/utils/alert";
import { getCurrentYear, getCurrentMonth } from "@/utils/date";
import { useDues } from "./useDues";
import DuesSummary from "./components/DuesSummary";
import DuesTable from "./components/DuesTable";
import MonthYearSelector from "./components/MonthYearSelector";
import EditModal from "./components/EditModal";
import PaymentModal from "./components/PaymentModal";
import BulkUpdateModal from "./components/BulkUpdateModal";

function ApartmentsManage() {
  const navigate = useNavigate();
  const currentYear = getCurrentYear();
  const currentUser = useCurrentUser();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonth());
  const [selectedApartmentId, setSelectedApartmentId] = useState(null);
  const [editingApartment, setEditingApartment] = useState(null);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);

  const { dues, loading, errorMessage, refetch } = useDues(currentUser?.id, selectedYear, selectedMonth);

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
      "Evet, Sil",
    );

    if (!confirmed) return;

    const res = await window.electronAPI.deleteApartment(due.apartment_id, currentUser.id);
    if (res.success) {
      await showAlert.success("Silindi", res.message);
      refetch();
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 3; y--) yearOptions.push(y);

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

  return (
    <div className="apartments-container">
      <div className="apartments-header">
        <h2>Daire İşlemleri</h2>
        <div className="header-actions">
          <button className="button button-secondary button-sm" onClick={() => setShowBulkUpdate(true)}>
            Toplu Aidat Güncelle
          </button>
          <MonthYearSelector
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
            yearOptions={yearOptions}
          />
        </div>
      </div>

      <DuesSummary dues={dues} />

      <DuesTable
        dues={dues}
        onStatusClick={(due) => setSelectedApartmentId(due.apartment_id)}
        renderRowActions={(due) => (
          <>
            <button className="action-btn edit-btn" onClick={() => setEditingApartment(due)} title="Düzenle">
              ✏️
            </button>
            <button className="action-btn delete-btn" onClick={() => handleDelete(due)} title="Sil">
              🗑️
            </button>
          </>
        )}
      />

      <hr className="section-divider" />

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
          currentUser={currentUser}
          onClose={() => setSelectedApartmentId(null)}
          onPaymentSaved={handlePaymentSaved}
        />
      )}

      {editingApartment && (
        <EditModal
          apartment={editingApartment}
          currentUser={currentUser}
          onClose={() => setEditingApartment(null)}
          onSaved={() => {
            setEditingApartment(null);
            refetch();
          }}
        />
      )}

      {showBulkUpdate && (
        <BulkUpdateModal
          currentUser={currentUser}
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

export default ApartmentsManage;
