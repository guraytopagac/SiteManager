// The optional contact address on the account. A plain input rather than the session field, because that one
// bakes required in and an empty box is a valid answer here: it removes the stored address.

import { useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import "./ProfileModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { showDialog } from "@/components/Dialog/dialogStore";

const ERROR_ID = "email-modal-error";
const MAX_EMAIL_LENGTH = 254;

function validateEmail(value) {
  if (!value) return null;
  if (value.length < 5 || value.length > MAX_EMAIL_LENGTH) return "Geçerli bir e-posta adresi girin.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return "Geçerli bir e-posta adresi girin.";
  return null;
}

function EmailModal({ userId, username, email: savedEmail, onClose, onSaved }) {
  const [emailInput, setEmailInput] = useState(savedEmail || "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fieldRef = useRef(null);

  const focusField = (e) => {
    if (e.target !== e.currentTarget || e.currentTarget.contains(document.activeElement)) return;
    fieldRef.current.focus();
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useEscapeKey(handleClose);

  const handleChange = (e) => {
    setEmailInput(e.target.value);
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = emailInput.trim();
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.updateEmail({ userId, email });
      if (res.success) {
        showDialog.toast(res.message);
        onSaved(res.email);
        return;
      }
      setError(res.message);
    } catch (err) {
      console.error("[EmailModal] updateEmail:", err);
      setError(UNEXPECTED_ERROR_MESSAGE);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="pf-md-overlay">
      <form className="pf-md-box" onSubmit={handleSubmit} onAnimationEnd={focusField}>
        <div className="pf-md-head">
          <div className="pf-md-identity">
            <h2 className="pf-md-title">E-posta Adresi</h2>
            <span className="pf-md-scope" title={username}>
              {username}
            </span>
          </div>
          <button
            type="button"
            className="pf-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="pf-md-body">
          <div className="pf-md-field">
            <label htmlFor="profile-email">E-posta</label>
            <input
              id="profile-email"
              ref={fieldRef}
              type="email"
              autoComplete="email"
              spellCheck={false}
              maxLength={MAX_EMAIL_LENGTH}
              placeholder="Örn. ahmet@example.com"
              value={emailInput}
              onChange={handleChange}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? ERROR_ID : undefined}
            />
            <p className="pf-md-hint">Boş bırakırsanız kayıtlı adres kaldırılır.</p>
          </div>

          {error && (
            <p className="pf-md-error" id={ERROR_ID} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="pf-md-submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EmailModal;
