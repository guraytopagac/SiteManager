// Changing the password, with the same reveal button, caps lock badge and strength meter as every other entry.
// Only length and matching are checked here, the rest is the service's answer. Errors show inside the box.

import { useRef, useState } from "react";
import { FiKey, FiLock, FiX } from "react-icons/fi";
import "./ProfileModals.css";
import AuthField from "@/components/AuthField/AuthField";
import { showDialog } from "@/components/Dialog/dialogStore";
import PasswordStrength from "@/components/PasswordStrength/PasswordStrength";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { MIN_PASSWORD_LENGTH } from "@/utils/passwordPolicy";

const ERROR_ID = "password-modal-error";

function validatePasswordForm(oldPassword, newPassword, confirmPassword) {
  if (!oldPassword) return "Mevcut şifrenizi girin.";
  if (newPassword.length < MIN_PASSWORD_LENGTH) return `Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`;
  if (newPassword !== confirmPassword) return "Yeni şifre ve tekrarı eşleşmiyor.";
  return null;
}

function PasswordModal({ userId, username, onClose }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstFieldRef = useRef(null);

  // Focus is given when the opening animation ends, not through autofocus: focusing in the same frame starts
  // the floating label transition inside a moving box, which stutters with hardware acceleration off. Only the
  // box's own animation counts, and a field the user already clicked keeps its focus.
  const focusFirstField = (e) => {
    if (e.target !== e.currentTarget || e.currentTarget.contains(document.activeElement)) return;
    firstFieldRef.current.focus();
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useEscapeKey(handleClose);

  const handleFieldChange = (setter) => (e) => {
    setter(e.target.value);
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validatePasswordForm(oldPassword, newPassword, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await window.electronAPI.changePassword({ userId, oldPassword, newPassword });
      if (res.success) {
        showDialog.toast(res.message);
        onClose();
      } else {
        setError(res.message);
      }
    } catch (err) {
      console.error("[PasswordModal] changePassword:", err);
      setError(UNEXPECTED_ERROR_MESSAGE);
    }
    setIsSubmitting(false);
  };

  const errorId = error ? ERROR_ID : undefined;

  return (
    <div className="pf-md-overlay">
      <form className="pf-md-box" onSubmit={handleSubmit} onAnimationEnd={focusFirstField}>
        <div className="pf-md-head">
          <div className="pf-md-identity">
            <h2 className="pf-md-title">Şifre Değiştir</h2>
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
          <AuthField
            id="profile-old-password"
            label="Mevcut Şifre"
            icon={FiLock}
            type="password"
            autoComplete="current-password"
            placeholder="Mevcut şifrenizi girin"
            value={oldPassword}
            ref={firstFieldRef}
            onChange={handleFieldChange(setOldPassword)}
            errorId={errorId}
          />

          <div className="pf-md-divider" />

          <AuthField
            id="profile-new-password"
            label="Yeni Şifre"
            icon={FiKey}
            type="password"
            autoComplete="new-password"
            placeholder="En az 8 karakter"
            value={newPassword}
            onChange={handleFieldChange(setNewPassword)}
            errorId={errorId}
          />
          <AuthField
            id="profile-confirm-password"
            label="Yeni Şifre Tekrar"
            icon={FiKey}
            type="password"
            autoComplete="new-password"
            placeholder="Yeni şifreyi tekrar girin"
            value={confirmPassword}
            onChange={handleFieldChange(setConfirmPassword)}
            errorId={errorId}
          />

          <PasswordStrength password={newPassword} confirmPassword={confirmPassword} />

          {error && (
            <p className="pf-md-error" id={ERROR_ID} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="pf-md-submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Şifreyi Değiştir"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PasswordModal;
