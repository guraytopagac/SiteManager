import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Residents.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import HistoryModal from "./ResidentsModals/HistoryModal";
import MoveOutModal from "./ResidentsModals/MoveOutModal";
import ResidentFormModal from "./ResidentsModals/ResidentFormModal";
import { useCurrentBuilding } from "@/hooks/useSession";
import { RESIDENT_TYPE_LABELS } from "@/utils/constants";
import { formatDate } from "@/utils/date";

function Residents() {
  const navigate = useNavigate();
  const building = useCurrentBuilding();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [formTarget, setFormTarget] = useState(null);
  const [moveOutTarget, setMoveOutTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchOverview = useCallback(async () => {
    if (!building?.id) {
      navigate("/", { replace: true });
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await window.electronAPI.getResidentsOverview({ buildingId: building.id });
      if (!isMountedRef.current) return;
      if (res.success) {
        setRows(res.data);
      } else {
        setErrorMessage(res.message || "Veriler alınamadı.");
      }
    } catch (err) {
      console.error("[Residents] getResidentsOverview:", err);
      if (isMountedRef.current) setErrorMessage("Beklenmedik bir hata oluştu.");
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [building, navigate]);

  useEffect(() => {
    (async () => {
      await fetchOverview();
    })();
  }, [fetchOverview]);

  const handleSaved = useCallback(() => {
    setFormTarget(null);
    setMoveOutTarget(null);
    fetchOverview();
  }, [fetchOverview]);

  if (loading) return <div className="residents-container loading">Sakin verileri yükleniyor...</div>;
  if (errorMessage)
    return (
      <div className="residents-container loading">
        {errorMessage}{" "}
        <button className="button" onClick={fetchOverview}>
          Yeniden Dene
        </button>
      </div>
    );

  const occupiedCount = rows.filter((r) => r.resident_id).length;
  const vacantCount = rows.length - occupiedCount;

  return (
    <div className="residents-container">
      <div className="residents-header">
        <h2>Sakin Yönetimi</h2>
        <AccountMenu />
      </div>

      <div className="residents-summary">
        <div className="summary-item occupied">
          <span className="summary-count">{occupiedCount}</span>
          <span className="summary-label">Dolu</span>
        </div>
        <div className="summary-item vacant">
          <span className="summary-count">{vacantCount}</span>
          <span className="summary-label">Boş</span>
        </div>
      </div>

      <table className="resident-table">
        <thead>
          <tr>
            <th>Daire No</th>
            <th>Sakin</th>
            <th>Tür</th>
            <th>Kişi</th>
            <th>Telefon</th>
            <th>Giriş</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="table-empty-cell">
                Kayıtlı daire bulunamadı.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.apartment_id}>
                <td>{r.apartment_no}</td>
                <td>{r.full_name || <span className="resident-empty">— Boş —</span>}</td>
                <td>{r.resident_type ? RESIDENT_TYPE_LABELS[r.resident_type] : "—"}</td>
                <td>{r.resident_id ? r.household_size : "—"}</td>
                <td>{r.phone || "—"}</td>
                <td>{formatDate(r.move_in_date)}</td>
                <td className="action-cell">
                  {r.resident_id ? (
                    <>
                      <button className="button button-secondary button-sm" onClick={() => setFormTarget(r)}>
                        Düzenle
                      </button>
                      <button className="button button-secondary button-sm" onClick={() => setMoveOutTarget(r)}>
                        Çıkış
                      </button>
                    </>
                  ) : (
                    <button className="button button-sm" onClick={() => setFormTarget(r)}>
                      Sakin Ekle
                    </button>
                  )}
                  <button className="button button-secondary button-sm" onClick={() => setHistoryTarget(r)}>
                    Geçmiş
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <hr className="section-divider" />

      <div className="return-link">
        <button onClick={() => navigate("/dashboard")} className="button">
          Geri Dön
        </button>
      </div>

      {formTarget && (
        <ResidentFormModal
          apartment={formTarget}
          building={building}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {moveOutTarget && (
        <MoveOutModal
          apartment={moveOutTarget}
          building={building}
          onClose={() => setMoveOutTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {historyTarget && (
        <HistoryModal apartment={historyTarget} building={building} onClose={() => setHistoryTarget(null)} />
      )}
    </div>
  );
}

export default Residents;
