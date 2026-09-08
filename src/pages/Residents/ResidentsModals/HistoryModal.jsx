import { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";
import "./ResidentsModals.css";
import { showDialog } from "@/utils/dialog";
import { RESIDENT_TYPE_LABELS } from "@/utils/constants";
import { formatDate } from "@/utils/date";

function HistoryModal({ apartment, building, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await window.electronAPI.getResidentHistory({
          apartmentId: apartment.apartment_id,
          buildingId: building.id,
        });
        if (!isMounted) return;
        if (res.success) {
          setHistory(res.data);
        } else {
          showDialog.error("Hata", res.message || "Sakin geçmişi alınamadı.");
        }
      } catch (err) {
        console.error("[HistoryModal] getResidentHistory:", err);
        if (isMounted) showDialog.error("Hata", "Beklenmedik bir hata oluştu.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [apartment.apartment_id, building.id]);

  return (
    <div className="rs-md-overlay" onClick={onClose}>
      <div className="rs-md-box" onClick={(e) => e.stopPropagation()}>
        <div className="rs-md-head">
          <div>
            <span className="rs-md-eyebrow">Daire {apartment.apartment_no}</span>
            <h2 className="rs-md-title">Sakin Geçmişi</h2>
          </div>
          <button type="button" className="rs-md-close" onClick={onClose} aria-label="Kapat">
            <FiX />
          </button>
        </div>

        <div className="rs-md-body">
          {loading ? (
            <p className="history-empty">Yükleniyor...</p>
          ) : history.length === 0 ? (
            <p className="history-empty">Bu daire için sakin kaydı yok.</p>
          ) : (
            <ul className="resident-history-list">
              {history.map((r) => (
                <li key={r.id} className={`resident-history-item ${r.is_active ? "active" : ""}`}>
                  <span className="rh-name">{r.full_name || "—"}</span>
                  {r.resident_type && <span className="rh-type">{RESIDENT_TYPE_LABELS[r.resident_type]}</span>}
                  <span className="rh-type">{r.household_size} kişi</span>
                  <span className="rh-dates">
                    {formatDate(r.move_in_date)} → {r.move_out_date ? formatDate(r.move_out_date) : "…"}
                  </span>
                  {r.is_active ? <span className="rh-active-badge">Aktif</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default HistoryModal;
