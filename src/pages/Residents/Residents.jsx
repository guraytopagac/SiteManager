import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Residents.css";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { showAlert } from "@/utils/alert";
import { formatDateShort, getToday } from "@/utils/date";

const RESIDENT_TYPE_LABELS = {
  owner: "Malik",
  tenant: "Kiracı",
};

const EMPTY_FORM = {
  full_name: "",
  phone: "",
  email: "",
  national_id: "",
  resident_type: "",
  move_in_date: "",
  move_out_date: "",
  notes: "",
};

function ResidentFormModal({ apartment, currentUser, onClose, onSaved }) {
  const isEdit = Boolean(apartment.resident_id);
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          full_name: apartment.full_name || "",
          phone: apartment.phone || "",
          email: apartment.email || "",
          national_id: apartment.national_id || "",
          resident_type: apartment.resident_type || "",
          move_in_date: apartment.move_in_date || "",
          move_out_date: apartment.move_out_date || "",
          notes: apartment.notes || "",
        }
      : EMPTY_FORM,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const res = isEdit
      ? await window.electronAPI.updateResident({
          residentId: apartment.resident_id,
          managerId: currentUser.id,
          ...form,
        })
      : await window.electronAPI.addResident({
          apartmentId: apartment.apartment_id,
          managerId: currentUser.id,
          ...form,
        });

    setIsSubmitting(false);

    if (res.success) {
      await showAlert.success(isEdit ? "Güncellendi" : "Eklendi", res.message);
      onSaved();
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-subtitle">Daire {apartment.apartment_no}</p>
            <h3 className="modal-title">{isEdit ? "Sakini Düzenle" : "Yeni Sakin"}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Ad Soyad</label>
            <input type="text" placeholder="İsteğe bağlı" value={form.full_name} onChange={set("full_name")} />
          </div>
          <div className="form-row">
            <label>Telefon</label>
            <input type="tel" placeholder="İsteğe bağlı" value={form.phone} onChange={set("phone")} />
          </div>
          <div className="form-row">
            <label>E-posta</label>
            <input type="email" placeholder="İsteğe bağlı" value={form.email} onChange={set("email")} />
          </div>
          <div className="form-row">
            <label>TC Kimlik No</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={11}
              placeholder="11 haneli TC kimlik"
              value={form.national_id}
              onChange={set("national_id")}
            />
          </div>
          <div className="form-row">
            <label>Sakin Türü</label>
            <select value={form.resident_type} onChange={set("resident_type")}>
              <option value="">— Seçiniz —</option>
              <option value="tenant">Kiracı</option>
              <option value="owner">Malik</option>
            </select>
          </div>
          <div className="form-row">
            <label>Giriş Tarihi</label>
            <input type="date" value={form.move_in_date} onChange={set("move_in_date")} />
          </div>
          <div className="form-row">
            <label>Çıkış Tarihi</label>
            <input type="date" value={form.move_out_date} onChange={set("move_out_date")} />
          </div>
          <div className="form-row">
            <label>Notlar</label>
            <textarea rows={2} placeholder="Sakin hakkında not" value={form.notes} onChange={set("notes")} />
          </div>

          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              İptal
            </button>
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MoveOutModal({ apartment, currentUser, onClose, onSaved }) {
  const [moveOutDate, setMoveOutDate] = useState(() => getToday());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await window.electronAPI.moveOutResident({
      residentId: apartment.resident_id,
      managerId: currentUser.id,
      moveOutDate,
    });
    setIsSubmitting(false);

    if (res.success) {
      await showAlert.success("Kaydedildi", res.message);
      onSaved();
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-subtitle">Daire {apartment.apartment_no}</p>
            <h3 className="modal-title">Sakin Çıkışı</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="modal-description">
          <strong>{apartment.full_name || "Sakin"}</strong> çıkış yapmış olarak işaretlenecek. Geçmiş kaydı korunur.
          Gelecekteki bir tarih girerseniz sakin o tarihe kadar aktif kalır.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Çıkış Tarihi</label>
            <input type="date" value={moveOutDate} onChange={(e) => setMoveOutDate(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              İptal
            </button>
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : "Çıkış Yaptır"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryModal({ apartment, currentUser, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await window.electronAPI.getResidentHistory(apartment.apartment_id, currentUser.id);
      if (cancelled) return;
      if (res.success) setHistory(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [apartment.apartment_id, currentUser.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-subtitle">Daire {apartment.apartment_no}</p>
            <h3 className="modal-title">Sakin Geçmişi</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

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
                <span className="rh-dates">
                  {formatDateShort(r.move_in_date)} → {r.move_out_date ? formatDateShort(r.move_out_date) : "…"}
                </span>
                {r.is_active ? <span className="rh-active-badge">Aktif</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Residents() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [formTarget, setFormTarget] = useState(null);
  const [moveOutTarget, setMoveOutTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    if (!currentUser?.id) {
      navigate("/", { replace: true });
      return;
    }

    const res = await window.electronAPI.getResidentsOverview(currentUser.id);
    if (res.success) {
      setRows(res.data);
    } else {
      setErrorMessage(res.message || "Veriler alınamadı.");
    }
    setLoading(false);
  }, [currentUser, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMessage("");

      if (!currentUser?.id) {
        navigate("/", { replace: true });
        return;
      }

      const res = await window.electronAPI.getResidentsOverview(currentUser.id);
      if (cancelled) return;
      if (res.success) {
        setRows(res.data);
      } else {
        setErrorMessage(res.message || "Veriler alınamadı.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, navigate]);

  const handleSaved = useCallback(() => {
    setFormTarget(null);
    setMoveOutTarget(null);
    fetchOverview();
  }, [fetchOverview]);

  const occupiedCount = rows.filter((r) => r.resident_id).length;
  const vacantCount = rows.length - occupiedCount;

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

  return (
    <div className="residents-container">
      <div className="residents-header">
        <h2>Sakin Yönetimi</h2>
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
            <th>Telefon</th>
            <th>Giriş</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="table-empty-cell">
                Kayıtlı daire bulunamadı.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.apartment_id}>
                <td>{r.apartment_no}</td>
                <td>{r.full_name || <span className="resident-empty">— Boş —</span>}</td>
                <td>{r.resident_type ? RESIDENT_TYPE_LABELS[r.resident_type] : "—"}</td>
                <td>{r.phone || "—"}</td>
                <td>{r.move_in_date || "—"}</td>
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
          currentUser={currentUser}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {moveOutTarget && (
        <MoveOutModal
          apartment={moveOutTarget}
          currentUser={currentUser}
          onClose={() => setMoveOutTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {historyTarget && (
        <HistoryModal
          apartment={historyTarget}
          currentUser={currentUser}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}

export default Residents;
