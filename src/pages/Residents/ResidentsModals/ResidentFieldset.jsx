// The field set two modals must write alike, so a length cap, placeholder or phone mask cannot drift apart.
// Exports the component alone, which is why the shared empty form lives with the renderer constants.

import { FiCreditCard, FiInfo, FiMail, FiPhone, FiUser, FiUsers } from "react-icons/fi";
import "./ResidentsModals.css";
import { formatPhone, phoneDigits } from "@/utils/phoneNumber";

function IconInput({ icon: Icon, ...inputProps }) {
  return (
    <div className="rs-md-input">
      <Icon aria-hidden="true" />
      <input {...inputProps} />
    </div>
  );
}

function ResidentFieldset({ idPrefix, form, setForm, residentType, asksOccupancy }) {
  const isOwnerForm = residentType === "owner";
  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // Whether the slot exists and whether its content is visible are separate: a hidden field keeps its grid
  // cell, so the box does not resize on every toggle.
  const asksHouseholdSize = !isOwnerForm || asksOccupancy;
  const showsHouseholdSize = asksHouseholdSize && (!isOwnerForm || form.is_occupant);

  const householdClass = [
    "rs-md-field",
    asksOccupancy ? "" : "rs-md-field--wide",
    showsHouseholdSize ? "" : "rs-md-field--blank",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="rs-md-sections">
      <section className="rs-md-group" aria-labelledby={`${idPrefix}-group-person`}>
        <h3 className="rs-md-group-title" id={`${idPrefix}-group-person`}>
          Kişi Bilgileri
        </h3>
        <div className="rs-md-form-grid">
          <div className="rs-md-field">
            <label htmlFor={`${idPrefix}-full-name`}>Ad Soyad</label>
            <IconInput
              icon={FiUser}
              id={`${idPrefix}-full-name`}
              type="text"
              maxLength={60}
              placeholder="Örn. Ahmet Yılmaz"
              value={form.full_name}
              onChange={(e) => updateField("full_name", e.target.value)}
              autoFocus
            />
          </div>
          <div className="rs-md-field">
            <label htmlFor={`${idPrefix}-national-id`}>TC Kimlik No</label>
            <IconInput
              icon={FiCreditCard}
              id={`${idPrefix}-national-id`}
              type="text"
              inputMode="numeric"
              maxLength={11}
              placeholder="Örn. 58471209364"
              value={form.national_id}
              onChange={(e) => updateField("national_id", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="rs-md-group" aria-labelledby={`${idPrefix}-group-contact`}>
        <h3 className="rs-md-group-title" id={`${idPrefix}-group-contact`}>
          İletişim
        </h3>
        <div className="rs-md-form-grid">
          <div className="rs-md-field">
            <label htmlFor={`${idPrefix}-phone`}>Telefon</label>
            <IconInput
              icon={FiPhone}
              id={`${idPrefix}-phone`}
              type="tel"
              inputMode="numeric"
              maxLength={13}
              placeholder="Örn. 5XX XXX XX XX"
              // State holds bare digits and the input shows the grouped form, so a pasted number normalises in
              // place. The real limit is the ten digit trim inside the helper, not the length cap.
              value={formatPhone(form.phone)}
              onChange={(e) => updateField("phone", phoneDigits(e.target.value))}
            />
          </div>
          <div className="rs-md-field">
            <label htmlFor={`${idPrefix}-email`}>E-posta</label>
            <IconInput
              icon={FiMail}
              id={`${idPrefix}-email`}
              type="email"
              maxLength={254}
              placeholder="Örn. ahmet@example.com"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="rs-md-group" aria-labelledby={`${idPrefix}-group-household`}>
        <h3 className="rs-md-group-title" id={`${idPrefix}-group-household`}>
          Hane
        </h3>

        {asksHouseholdSize ? (
          <div className="rs-md-form-grid">
            {asksOccupancy && (
              <button
                type="button"
                role="switch"
                aria-checked={form.is_occupant}
                className={form.is_occupant ? "rs-md-switch rs-md-switch--on" : "rs-md-switch"}
                onClick={() => updateField("is_occupant", !form.is_occupant)}
              >
                <span className="rs-md-switch-track" aria-hidden="true">
                  <span className="rs-md-switch-thumb" />
                </span>
                Dairede oturuyor
              </button>
            )}

            <div className={householdClass}>
              <label htmlFor={`${idPrefix}-household-size`}>Dairede Yaşayan Kişi Sayısı</label>
              <IconInput
                icon={FiUsers}
                id={`${idPrefix}-household-size`}
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                placeholder="Bilinmiyorsa boş bırakın"
                value={form.household_size}
                onChange={(e) => updateField("household_size", e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="rs-md-info">
            <span className="rs-md-info-icon" aria-hidden="true">
              <FiInfo />
            </span>
            <p>
              Dairede kiracı oturuyor, yaşayan kişi sayısı <b>kiracı kaydında</b> tutulur. Bu kayıt malikin iletişim
              bilgilerini taşır.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default ResidentFieldset;
