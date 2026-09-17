// Adds or edits an employee. A null employee means a new one. The leaving date is asked only on an edit and
// stays locked once a payout exists, since the payout owns it.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./SeveranceFundModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { showDialog } from "@/utils/dialog";
import { getToday } from "@/utils/date";

const MAX_WAGE = 1000000;

function EmployeeModal({ building, employee, onClose, onSaved }) {
  const isEdit = Boolean(employee);
  const isPaid = Boolean(employee?.payout_id);

  const [form, setForm] = useState(() => ({
    full_name: employee?.full_name ?? "",
    role: employee?.role ?? "",
    start_date: employee?.start_date ?? "",
    gross_wage: employee ? String(employee.gross_wage) : "",
    end_date: employee?.end_date ?? "",
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    const grossWage = Math.round(Number(form.gross_wage) * 100) / 100;
    if (!Number.isFinite(grossWage) || grossWage <= 0) {
      showDialog.warning("Geçersiz Tutar", "Brüt ücret 0'dan büyük olmalıdır.");
      return;
    }
    if (form.end_date && form.end_date < form.start_date) {
      showDialog.warning("Geçersiz Tarih", "Ayrılış tarihi işe giriş tarihinden önce olamaz.");
      return;
    }

    const payload = {
      buildingId: building.id,
      full_name: form.full_name,
      role: form.role,
      start_date: form.start_date,
      gross_wage: grossWage,
    };

    setIsSubmitting(true);
    try {
      const res = isEdit
        ? await window.electronAPI.updateEmployee({
            ...payload,
            employeeId: employee.id,
            end_date: form.end_date || null,
          })
        : await window.electronAPI.addEmployee(payload);
      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[EmployeeModal] saveEmployee:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showDialog.confirmDanger(
      "Çalışanı Sil",
      `${employee.full_name} kaydı silinecek. Bu işlem geri alınamaz.`,
      "Vazgeç",
      "Sil",
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.deleteEmployee({ buildingId: building.id, employeeId: employee.id });
      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[EmployeeModal] deleteEmployee:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useEscapeKey(handleClose);

  return (
    <div className="sf-md-overlay">
      <form className="sf-md-box" onSubmit={handleSubmit}>
        <div className="sf-md-head">
          <div className="sf-md-identity">
            <h2 className="sf-md-title">{isEdit ? "Çalışanı Düzenle" : "Çalışan Ekle"}</h2>
            <span className="sf-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button
            type="button"
            className="sf-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="sf-md-body">
          <div className="sf-md-grid">
            <div className="sf-md-field">
              <label htmlFor="sf-md-name">Ad Soyad</label>
              <input
                id="sf-md-name"
                type="text"
                maxLength={60}
                placeholder="Örn. Hasan Kılıç"
                value={form.full_name}
                onChange={setField("full_name")}
                required
                autoFocus
              />
            </div>

            <div className="sf-md-field">
              <label htmlFor="sf-md-role">Görev</label>
              <input
                id="sf-md-role"
                type="text"
                maxLength={40}
                placeholder="Örn. Kapıcı"
                value={form.role}
                onChange={setField("role")}
                required
              />
            </div>

            <div className="sf-md-field">
              <label htmlFor="sf-md-start">İşe Giriş Tarihi</label>
              <input
                id="sf-md-start"
                type="date"
                max={getToday()}
                value={form.start_date}
                onChange={setField("start_date")}
                required
              />
            </div>

            <div className="sf-md-field">
              <label htmlFor="sf-md-wage">Aylık Brüt Ücret (₺)</label>
              <input
                id="sf-md-wage"
                type="number"
                step="0.01"
                min="0.01"
                max={MAX_WAGE}
                placeholder="Örn. 40000"
                value={form.gross_wage}
                onChange={setField("gross_wage")}
                onKeyDown={(e) => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
                required
              />
            </div>

            {isEdit ? (
              <div className="sf-md-field sf-md-field--wide">
                <label htmlFor="sf-md-end">Ayrılış Tarihi (isteğe bağlı)</label>
                <input
                  id="sf-md-end"
                  type="date"
                  min={form.start_date || undefined}
                  max={getToday()}
                  value={form.end_date}
                  onChange={setField("end_date")}
                  disabled={isPaid}
                />
                <span className="sf-md-hint">
                  {isPaid
                    ? "Tazminatı ödenmiş çalışanın ayrılış tarihi ödeme iptal edilmeden değiştirilemez."
                    : "Tazminat ödenmeden ayrılan çalışan için girilir. Tazminat ödenecekse Öde butonunu kullanın."}
                </span>
              </div>
            ) : null}
          </div>

          <div className="sf-md-actions">
            {isEdit ? (
              <button type="button" className="sf-md-btn-danger" onClick={handleDelete} disabled={isSubmitting}>
                Çalışanı Sil
              </button>
            ) : null}
            <button type="submit" className="sf-btn-solid" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : isEdit ? "Değişiklikleri Kaydet" : "Çalışanı Ekle"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default EmployeeModal;
