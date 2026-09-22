// Producing a new recovery code: the password step first, then the code itself. The second step lives in the
// same box rather than in a separate one, so the value is shown exactly once and the box never reopens on it.

import { useRef, useState } from "react";
import { FiCopy, FiLock, FiX } from "react-icons/fi";
import "./ProfileModals.css";
import AuthField from "@/components/AuthField/AuthField";
import { useCopyFeedback } from "@/hooks/useCopyFeedback";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";

const ERROR_ID = "recovery-modal-error";

function RecoveryCodeModal({ username, onClose }) {
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fieldRef = useRef(null);
  const { isCopied, copy } = useCopyFeedback();

  const focusField = (e) => {
    if (e.target !== e.currentTarget || e.currentTarget.contains(document.activeElement)) return;
    if (fieldRef.current) fieldRef.current.focus();
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useEscapeKey(handleClose);

  const handleChange = (e) => {
    setPassword(e.target.value);
    if (error) setError("");
  };

  const handleCopy = async () => {
    const isDone = await copy(recoveryCode);
    setError(isDone ? "" : "Panoya kopyalanamadı. Lütfen kodu elle kopyalayın.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password) {
      setError("Şifrenizi girin.");
      return;
    }

    setIsSubmitting(true);
    // The try wraps the call alone: the code comes back once and a throw in the success branch would lose it
    // after the old code has already been replaced.
    let res;
    try {
      res = await window.electronAPI.regenerateRecoveryCode({ password });
    } catch (err) {
      console.error("[RecoveryCodeModal] regenerateRecoveryCode:", err);
      setError(UNEXPECTED_ERROR_MESSAGE);
      setIsSubmitting(false);
      return;
    }

    if (!res.success) {
      setError(res.message);
      setIsSubmitting(false);
      return;
    }

    setRecoveryCode(res.recoveryCode);
    setError("");
    setIsSubmitting(false);
  };

  const errorId = error ? ERROR_ID : undefined;
  const errorLine = error ? (
    <p className="pf-md-error" id={ERROR_ID} role="alert">
      {error}
    </p>
  ) : null;

  return (
    <div className="pf-md-overlay">
      <form className="pf-md-box" onSubmit={handleSubmit} onAnimationEnd={focusField}>
        <div className="pf-md-head">
          <div className="pf-md-identity">
            <h2 className="pf-md-title">{recoveryCode ? "Kurtarma Kodunuz" : "Yeni Kurtarma Kodu"}</h2>
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

        {recoveryCode ? (
          <div className="pf-md-body">
            <div className="pf-md-code">
              <span className="pf-md-code-label">Yeni kurtarma kodunuz</span>
              <span className="pf-md-code-value">{recoveryCode}</span>
              <button type="button" className="pf-md-copy" onClick={handleCopy}>
                <FiCopy size={17} />
                <span className="pf-md-copy-label">{isCopied ? "Kopyalandı" : "Kodu Kopyala"}</span>
              </button>
            </div>

            <p className="pf-md-note">
              Şifrenizi unutursanız giriş ekranından bu kodla yeni şifre belirlersiniz. Güvenli bir yerde saklayın, kod
              bir daha gösterilmeyecektir.
            </p>

            {errorLine}

            <button type="button" className="pf-md-submit" onClick={onClose}>
              Anladım
            </button>
          </div>
        ) : (
          <div className="pf-md-body">
            <p className="pf-md-note">Yeni kod üretildiğinde eski kurtarma kodunuz geçersiz olur.</p>

            <AuthField
              id="profile-recovery-password"
              label="Mevcut Şifreniz"
              icon={FiLock}
              type="password"
              autoComplete="current-password"
              placeholder="Yeni kod üretmek için şifrenizi girin"
              value={password}
              ref={fieldRef}
              onChange={handleChange}
              errorId={errorId}
            />

            {errorLine}

            <button type="submit" className="pf-md-submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? "Üretiliyor..." : "Yeni Kod Üret"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export default RecoveryCodeModal;
