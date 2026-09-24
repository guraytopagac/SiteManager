// Adds or edits one record, with the role arriving as a prop from the panel tab. The occupancy switch is
// drawn only without an active tenant, and starts off so it never reports occupancy nobody claimed.

import { useState } from "react";
import { FiCheck, FiHome, FiUser, FiX } from "react-icons/fi";
import "./ResidentsModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { showDialog } from "@/components/Dialog/dialogStore";
import { EMPTY_RESIDENT_FORM, RESIDENT_TYPE_LABELS, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { phoneDigits } from "@/utils/phoneNumber";
import ResidentFieldset from "./ResidentFieldset";

function ResidentFormModal({ apartment, resident, residentType, hasTenant, building, onClose, onSaved }) {
  const isEdit = Boolean(resident);
  const isOwnerForm = residentType === "owner";
  const roleLabel = RESIDENT_TYPE_LABELS[residentType];
  const asksOccupancy = isOwnerForm && !hasTenant;
  const RoleIcon = isOwnerForm ? FiHome : FiUser;

  const [form, setForm] = useState(() =>
    resident
      ? {
          full_name: resident.full_name || "",
          phone: phoneDigits(resident.phone),
          email: resident.email || "",
          national_id: resident.national_id || "",
          household_size: resident.household_size == null ? "" : String(resident.household_size),
          is_occupant: Boolean(resident.is_occupant),
        }
      : EMPTY_RESIDENT_FORM,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previousName = (resident?.full_name || "").trim();
  const nextName = form.full_name.trim();
  const isRename = isEdit && previousName !== "" && nextName !== previousName;

  // This form overwrites the active record, so a rename rewrites that person out of every month. The service
  // cannot tell a typo from a new occupant, so an edited name asks first and points to the proper route.
  const confirmRename = () => {
    const change = nextName ? `${previousName} yerine ${nextName} yazılacak.` : `${previousName} adı silinecek.`;
    const advice = isOwnerForm
      ? "Daire el değiştirdiyse bu form yerine Malik Değiştir işlemini kullanın."
      : "Daireye başka biri taşındıysa bu form yerine Kiracı Çıkışı işlemini kullanın.";

    return showDialog.confirm(
      `${roleLabel} adı değişiyor`,
      `${change} Eski ad hiçbir yerde kalmaz. ${advice}`,
      "Vazgeç",
      "Adı Güncelle",
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isRename && !(await confirmRename())) return;

    setIsSubmitting(true);

    try {
      const residentData = {
        ...form,
        resident_type: residentType,
        // Explicit, because an empty string would become zero and be stored as a size instead of unknown.
        household_size: form.household_size === "" ? null : Number(form.household_size),
      };

      const res = isEdit
        ? await window.electronAPI.updateResident({
            residentId: resident.id,
            buildingId: building.id,
            ...residentData,
          })
        : await window.electronAPI.addResident({
            apartmentId: apartment.apartment_id,
            buildingId: building.id,
            ...residentData,
          });

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[ResidentFormModal] saveResident:", err);
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
    <div className="rs-md-overlay">
      <form className="rs-md-box" onSubmit={handleSubmit}>
        <div className="rs-md-head">
          <span className="rs-md-mark" aria-hidden="true">
            <RoleIcon />
          </span>
          <div className="rs-md-identity">
            <h2 className="rs-md-title">{isEdit ? `${roleLabel} Bilgilerini Düzenle` : `${roleLabel} Ekle`}</h2>
            <span className="rs-md-scope">
              Daire {apartment.apartment_no} · {roleLabel} kaydı
            </span>
          </div>
          <button
            type="button"
            className="rs-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="rs-md-body">
          <ResidentFieldset
            idPrefix="resident"
            form={form}
            setForm={setForm}
            residentType={residentType}
            asksOccupancy={asksOccupancy}
          />

          <button type="submit" className="rs-md-btn-solid rs-md-submit" disabled={isSubmitting}>
            <FiCheck aria-hidden="true" />
            {isSubmitting ? "Kaydediliyor..." : isEdit ? "Değişiklikleri Kaydet" : `${roleLabel} Ekle`}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ResidentFormModal;
