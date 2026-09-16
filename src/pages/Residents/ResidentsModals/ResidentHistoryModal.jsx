import { useEffect, useState } from "react";
import { FiChevronDown, FiHome, FiUser, FiX } from "react-icons/fi";
import "./ResidentsModals.css";
import DetailRow from "@/components/DetailRow/DetailRow";
import Pager from "@/components/Pager/Pager";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePagination } from "@/hooks/usePagination";
import { RESIDENT_TYPE_LABELS, UNEXPECTED_ERROR_MESSAGE, UNNAMED_RESIDENT_LABEL } from "@/utils/constants";
import { formatDate } from "@/utils/date";
import { formatPhone } from "@/utils/phoneNumber";

const PAGE_SIZE = 5;

function householdText(resident) {
  if (!resident.is_occupant || resident.household_size == null) return null;
  return `${resident.household_size} kişi`;
}

function PlaceholderCard() {
  return (
    <li className="rs-history-item rs-history-spacer" aria-hidden="true">
      <span className="rs-history-toggle">
        <span className="rs-history-top" />
        <span className="rs-history-meta">&nbsp;</span>
      </span>
    </li>
  );
}

function ResidentHistoryModal({ apartment, building, onClose }) {
  const [history, setHistory] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.electronAPI.getResidentHistory({
          apartmentId: apartment.apartment_id,
          buildingId: building.id,
        });
        if (res.success) {
          setHistory(res.data);
        } else {
          setErrorMessage(res.message || "Sakin geçmişi alınamadı.");
        }
      } catch (err) {
        console.error("[ResidentHistoryModal] getResidentHistory:", err);
        setErrorMessage(UNEXPECTED_ERROR_MESSAGE);
      }
      setLoading(false);
    })();
  }, [apartment.apartment_id, building.id]);

  useEscapeKey(onClose);

  const { pageItems: visible, currentPage, pageCount, setPage } = usePagination(history, PAGE_SIZE);
  const message = loading
    ? "Yükleniyor..."
    : errorMessage || (history.length === 0 ? "Bu daire için sakin kaydı yok." : null);
  const spacers = [];

  for (let index = 0; index < PAGE_SIZE - visible.length; index += 1) {
    spacers.push(<PlaceholderCard key={`spacer-${index}`} />);
  }

  const changePage = (next) => {
    setPage(next);
    setExpandedId(null);
  };

  return (
    <div className="rs-md-overlay">
      <div className="rs-md-box">
        <div className="rs-md-head">
          <div className="rs-md-identity">
            <h2 className="rs-md-title">Daire Geçmişi</h2>
            <span className="rs-md-scope">Daire {apartment.apartment_no}</span>
          </div>
          <button type="button" className="rs-md-close" onClick={onClose} aria-label="Kapat">
            <FiX />
          </button>
        </div>

        <div className="rs-md-body">
          <div className="rs-history-slot">
            <ul className="rs-history-list" aria-hidden={message ? "true" : undefined}>
              {visible.map((resident) => {
                const isActive = Boolean(resident.is_active);
                const isPending = !isActive && !resident.move_out_date;
                const isExpanded = expandedId === resident.id;
                const name = resident.full_name || UNNAMED_RESIDENT_LABEL;

                return (
                  <li
                    key={resident.id}
                    className={isActive ? "rs-history-item rs-history-item--active" : "rs-history-item"}
                  >
                    <button
                      type="button"
                      className="rs-history-toggle"
                      onClick={() => setExpandedId(isExpanded ? null : resident.id)}
                      aria-expanded={isExpanded}
                      title={`${name} bilgilerini ${isExpanded ? "gizle" : "göster"}`}
                    >
                      <span className="rs-history-top">
                        <span className="rs-history-role" aria-hidden="true">
                          {resident.resident_type === "owner" ? <FiHome /> : <FiUser />}
                        </span>
                        <span className="rs-history-name">{name}</span>
                        <span className="rs-history-type">{RESIDENT_TYPE_LABELS[resident.resident_type]}</span>
                        <span className="rs-history-end">
                          {isActive ? <span className="rs-history-badge">Aktif</span> : null}
                          {isPending ? (
                            <span className="rs-history-badge rs-history-badge--pending">Sırada</span>
                          ) : null}
                          <span className="rs-history-chevron" aria-hidden="true">
                            <FiChevronDown />
                          </span>
                        </span>
                      </span>
                      <span className="rs-history-meta">
                        {isPending
                          ? `${formatDate(resident.start_date)} tarihinde başlayacak`
                          : `${formatDate(resident.start_date)} → ${resident.move_out_date ? formatDate(resident.move_out_date) : "devam ediyor"}`}
                      </span>
                    </button>
                    {isExpanded && (
                      <dl className="rs-history-detail">
                        <DetailRow label="Telefon" value={formatPhone(resident.phone)} />
                        <DetailRow label="E-posta" value={resident.email} />
                        <DetailRow label="TC Kimlik" value={resident.national_id} />
                        <DetailRow label="Yaşayan Kişi" value={householdText(resident)} />
                      </dl>
                    )}
                  </li>
                );
              })}
              {spacers}
            </ul>
            {message && <p className="rs-history-empty">{message}</p>}
          </div>

          <Pager currentPage={currentPage} pageCount={pageCount} onChange={changePage} />
        </div>
      </div>
    </div>
  );
}

export default ResidentHistoryModal;
