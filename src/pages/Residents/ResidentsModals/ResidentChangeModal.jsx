// Closes a record and opens its replacement in one request and one transaction: the date, then the person.
// Only a tenant may leave with nobody lined up, since an apartment always belongs to someone.

import { useState } from "react";
import { FiX } from "react-icons/fi";
import "./ResidentsModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { showDialog } from "@/utils/dialog";
import { getToday } from "@/utils/date";
import { EMPTY_RESIDENT_FORM, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { phoneDigits } from "@/utils/phoneNumber";
import ResidentFieldset from "./ResidentFieldset";

const ROLE_TEXT = {
  owner: {
    title: "Malik Değiştir",
    editTitle: "Devri Düzenle",
    dateLabel: "Devir Tarihi",
    fallbackName: "Malik",
    note: "kaydı girdiğiniz tarihte kapanır ve yeni malik aynı gün devreye girer. İleri bir tarih seçerseniz mevcut kayıt o güne kadar geçerli kalır.",
    editNote:
      "kaydının kapanacağı tarihi ve yerine geçecek malikin bilgilerini güncelleyebilirsiniz. Tarihi bugüne çekerseniz devir hemen uygulanır.",
    continueAction: "Yeni Malik Gir",
    cancelAction: "Devri İptal Et",
    stepTitle: "Yeni malik bilgileri",
    finishAction: "Devri Tamamla",
    editFinishAction: "Devri Güncelle",
    blankMessage: "Yeni malik için en az bir bilgi girin.",
    cancelTitle: "Planlanan devir iptal edilsin mi?",
    cancelBody: "Devir tarihi silinecek ve sıradaki malik kaydı kaldırılacak.",
  },

  tenant: {
    title: "Kiracı Çıkışı",
    editTitle: "Çıkışı Düzenle",
    dateLabel: "Çıkış Tarihi",
    fallbackName: "Kiracı",
    note: "girdiğiniz tarihte çıkmış sayılır, varsa yerine gelen kiracı da aynı gün devreye girer. İleri bir tarih seçerseniz mevcut kiracı o güne kadar listede kalır.",
    editNote:
      "kaydının kapanacağı tarihi ve varsa yerine gelecek kiracının bilgilerini güncelleyebilirsiniz. Tarihi bugüne çekerseniz çıkış hemen uygulanır.",
    continueAction: "Yeni Kiracı Gir",
    skipAction: "Yeni Kiracısız Kaydet",
    cancelAction: "Çıkışı İptal Et",
    stepTitle: "Yeni kiracı bilgileri",
    finishAction: "Çıkışı Tamamla",
    editFinishAction: "Çıkışı Güncelle",
    blankMessage:
      "Yeni kiracı için en az bir bilgi girin. Yerine kimse gelmiyorsa geri dönüp Yeni Kiracısız Kaydet butonunu kullanın.",
    cancelTitle: "Planlanan çıkış iptal edilsin mi?",
    cancelBody: "Çıkış tarihi silinecek ve sıradaki kiracı kaydı kaldırılacak.",
  },
};

function formOf(pending) {
  if (!pending) return EMPTY_RESIDENT_FORM;

  return {
    full_name: pending.full_name || "",
    phone: phoneDigits(pending.phone),
    email: pending.email || "",
    national_id: pending.national_id || "",
    household_size: pending.household_size == null ? "" : String(pending.household_size),
    is_occupant: Boolean(pending.is_occupant),
  };
}

function ResidentChangeModal({
  apartment,
  resident,
  residentType,
  hasTenant,
  pending,
  isScheduleEdit,
  building,
  onClose,
  onSaved,
}) {
  const [moveOutDate, setMoveOutDate] = useState(() => (isScheduleEdit ? resident.move_out_date : getToday()));
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => formOf(pending));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = residentType === "owner";
  const roleText = ROLE_TEXT[residentType];
  const asksOccupancy = isOwner && !hasTenant;
  const canSkipReplacement = !isOwner;

  const nextRecord = () => {
    const data = {
      ...form,
      resident_type: residentType,
      household_size: form.household_size === "" ? null : Number(form.household_size),
    };
    // An owner recorded beside a tenant is a contact, not an occupant. For a tenant the service forces the flag.
    if (isOwner && !asksOccupancy) data.is_occupant = false;
    return data;
  };

  const save = async (next) => {
    setIsSubmitting(true);
    try {
      const payload = { residentId: resident.id, buildingId: building.id, moveOutDate, next };
      const res = isScheduleEdit
        ? await window.electronAPI.updateScheduledMoveOut(payload)
        : await window.electronAPI.moveOutResident(payload);

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[ResidentChangeModal] saveMoveOut:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelSchedule = async () => {
    const confirmed = await showDialog.confirm(roleText.cancelTitle, roleText.cancelBody, "Vazgeç", "İptal Et");
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.cancelScheduledMoveOut({
        residentId: resident.id,
        buildingId: building.id,
      });

      if (res.success) {
        showDialog.toast(res.message);
        onSaved();
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[ResidentChangeModal] cancelScheduledMoveOut:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  // The second step may not be submitted empty: it is reached by advancing, so a blank record could open by
  // accident. Editing a plan is the exception, where clearing every field drops the queued replacement.
  const isBlank = !form.full_name.trim() && !form.phone && !form.email.trim() && !form.national_id.trim();

  const handleSubmit = (e) => {
    e.preventDefault();

    // The first step advances rather than saves, so Enter moves forward and skipping needs its own button.
    if (step === 1) {
      setStep(2);
      return;
    }

    const dropsReplacement = isBlank && isScheduleEdit && canSkipReplacement;
    if (isBlank && !dropsReplacement) {
      showDialog.error("Eksik bilgi", roleText.blankMessage);
      return;
    }

    save(dropsReplacement ? null : nextRecord());
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
          <div className="rs-md-identity">
            <h2 className="rs-md-title">{isScheduleEdit ? roleText.editTitle : roleText.title}</h2>
            <span className="rs-md-scope">Daire {apartment.apartment_no}</span>
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
          {step === 1 ? (
            <>
              <p className="rs-md-note">
                <b>{resident.full_name || roleText.fallbackName}</b>{" "}
                {isScheduleEdit ? roleText.editNote : roleText.note}
              </p>

              <div className="rs-md-field">
                <label htmlFor="move-out-date">{roleText.dateLabel}</label>
                <input
                  id="move-out-date"
                  type="date"
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                  required
                  // The visible half of the service's check: a record starts the day it was entered, or on
                  // its handover day when it was queued.
                  min={resident.start_date || undefined}
                  autoFocus
                />
              </div>

              <div className="rs-md-actions">
                {isScheduleEdit ? (
                  <button type="button" className="rs-md-btn-outline" onClick={cancelSchedule} disabled={isSubmitting}>
                    {roleText.cancelAction}
                  </button>
                ) : (
                  canSkipReplacement && (
                    <button
                      type="button"
                      className="rs-md-btn-outline"
                      onClick={() => save(null)}
                      disabled={isSubmitting}
                    >
                      {roleText.skipAction}
                    </button>
                  )
                )}
                <button type="submit" className="rs-md-btn-solid" disabled={isSubmitting}>
                  {roleText.continueAction}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="rs-md-step-title">{roleText.stepTitle}</p>

              <ResidentFieldset
                idPrefix="next-resident"
                form={form}
                setForm={setForm}
                residentType={residentType}
                asksOccupancy={asksOccupancy}
              />

              <div className="rs-md-actions">
                <button
                  type="button"
                  className="rs-md-btn-outline rs-md-back"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  Geri
                </button>
                <button type="submit" className="rs-md-btn-solid" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Kaydediliyor..."
                    : isScheduleEdit
                      ? roleText.editFinishAction
                      : roleText.finishAction}
                </button>
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

export default ResidentChangeModal;
