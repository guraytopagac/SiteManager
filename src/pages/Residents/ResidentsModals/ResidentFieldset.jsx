import "./ResidentsModals.css";
import { formatPhone, phoneDigits } from "@/utils/phoneNumber";

function ResidentFieldset({ idPrefix, form, setForm, residentType, asksOccupancy }) {
  const isOwnerForm = residentType === "owner";
  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const asksHouseholdSize = !isOwnerForm || asksOccupancy;
  const showsHouseholdSize = asksHouseholdSize && (!isOwnerForm || form.is_occupant);

  return (
    <>
      <div className="rs-md-form-grid">
        <div className="rs-md-field">
          <label htmlFor={`${idPrefix}-full-name`}>Ad Soyad</label>
          <input
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
          <label htmlFor={`${idPrefix}-phone`}>Telefon</label>
          <input
            id={`${idPrefix}-phone`}
            type="tel"
            inputMode="numeric"
            maxLength={13}
            placeholder="Örn. 5XX XXX XX XX"
            value={formatPhone(form.phone)}
            onChange={(e) => updateField("phone", phoneDigits(e.target.value))}
          />
        </div>
        <div className="rs-md-field">
          <label htmlFor={`${idPrefix}-email`}>E-posta</label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            maxLength={254}
            placeholder="Örn. ahmet@example.com"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
        </div>
        <div className="rs-md-field">
          <label htmlFor={`${idPrefix}-national-id`}>TC Kimlik No</label>
          <input
            id={`${idPrefix}-national-id`}
            type="text"
            inputMode="numeric"
            maxLength={11}
            placeholder="Örn. 58471209364"
            value={form.national_id}
            onChange={(e) => updateField("national_id", e.target.value)}
          />
        </div>

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

        {asksHouseholdSize && (
          <div className={showsHouseholdSize ? "rs-md-field" : "rs-md-field rs-md-field--blank"}>
            <label htmlFor={`${idPrefix}-household-size`}>Dairede Yaşayan Kişi Sayısı</label>
            <input
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
        )}
      </div>

      {isOwnerForm && !asksOccupancy && (
        <p className="rs-md-note">
          Dairede kiracı oturuyor, yaşayan kişi sayısı kiracı kaydında tutulur. Bu kayıt malikin iletişim bilgilerini
          taşır.
        </p>
      )}
    </>
  );
}

export default ResidentFieldset;
