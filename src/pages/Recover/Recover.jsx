// Password recovery. Three states in one screen rather than three routes: enter the code, set a new
// password, then a finished state that shows the freshly issued code once.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Recover.css";
import AuthField from "@/components/AuthField/AuthField";
import PasswordStrength from "@/components/PasswordStrength/PasswordStrength";
import { useCopyFeedback } from "@/hooks/useCopyFeedback";
import { MIN_PASSWORD_LENGTH } from "@/utils/passwordPolicy";
import { FiAlertCircle, FiArrowLeft, FiArrowRight, FiCheck, FiCopy, FiInfo, FiLock } from "react-icons/fi";

// The four look-alike characters are absent, matching the alphabet the code is generated from.
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_LENGTH = 16;
const RECOVERY_GROUP_SIZE = 4;
const EXCLUDED_HINT = "Kurtarma kodunda I, O, 0 ve 1 karakterleri bulunmaz.";
const ERROR_ID = "recover-error";
const HINT_ID = "recover-code-hint";
const CODE_PLACEHOLDER = "ABCD-EFGH-JKLP-QRST";

// State holds the bare characters and the grouping is produced on render, the same split the phone field uses.
// Anything outside the alphabet is dropped as it is typed, which is what the hint below explains.
function toRecoveryDigits(input) {
  return input
    .toUpperCase()
    .split("")
    .filter((char) => RECOVERY_ALPHABET.includes(char))
    .slice(0, RECOVERY_LENGTH)
    .join("");
}

function formatRecoveryCode(digits) {
  const groups = [];
  for (let i = 0; i < digits.length; i += RECOVERY_GROUP_SIZE) {
    groups.push(digits.slice(i, i + RECOVERY_GROUP_SIZE));
  }
  return groups.join("-");
}

function hasExcludedCharacter(input) {
  return /[IO01]/.test(input.toUpperCase());
}

function ErrorNotice({ message, id }) {
  if (!message) return null;

  return (
    <div className="recover-status" id={id} role="alert">
      <span className="recover-status-icon" aria-hidden="true">
        <FiAlertCircle size={16} />
      </span>
      {message}
    </div>
  );
}

function Recover() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [recoveryDigits, setRecoveryDigits] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [renewedCredentials, setRenewedCredentials] = useState(null);
  const { isCopied, copy } = useCopyFeedback();

  const handleFieldChange = (setValue) => (e) => {
    setValue(e.target.value);
    setError("");
  };

  const handleCodeChange = (e) => {
    const enteredCode = e.target.value;
    setHint(hasExcludedCharacter(enteredCode) ? EXCLUDED_HINT : "");
    setRecoveryDigits(toRecoveryDigits(enteredCode));
    setError("");
  };

  // A side effect free check, so the user is not made to choose a new password before finding out the code
  // is wrong. The authoritative check still happens inside the reset call below.
  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (recoveryDigits.length !== RECOVERY_LENGTH) {
      setError(`Kurtarma kodu ${RECOVERY_LENGTH} karakter olmalıdır.`);
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const res = await window.electronAPI.verifyRecoveryCode({ recoveryCode: recoveryDigits });

      if (res.success) {
        setHint("");
        setStep(2);
      } else {
        setError(res.message);
      }
    } catch (err) {
      console.error("[Recover] verifyRecoveryCode:", err);
      setError("Kurtarma kodu doğrulanamadı. Lütfen tekrar deneyin.");
    }

    setIsVerifying(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await window.electronAPI.resetAccountPassword({
        recoveryCode: recoveryDigits,
        newPassword: password,
      });

      if (res.success) {
        // Same early return as the sign in screen: the flag stays raised because the finished state takes
        // over the render, and a reset here would briefly re-enable a form that is about to disappear.
        setRenewedCredentials({ recoveryCode: res.recoveryCode, username: res.username });
        return;
      }

      setError(res.message);
    } catch (err) {
      console.error("[Recover] resetAccountPassword:", err);
      setError("Şifre sıfırlanamadı. Lütfen tekrar deneyin.");
    }

    setIsSubmitting(false);
  };

  const handleCopyCode = async () => {
    const copied = await copy(renewedCredentials.recoveryCode);
    setError(copied ? "" : "Kod panoya kopyalanamadı. Kodu elle not alın.");
  };

  if (renewedCredentials) {
    return (
      <div className="auth-page">
        <div className="auth-card recover-container">
          <div className="recover-band recover-band--context">
            <span className="recover-eyebrow">Hesap Kurtarma</span>
            <h1 className="recover-title">Kurtarma Tamamlandı</h1>
          </div>

          <ol className="recover-band recover-rail" aria-label="Sıfırlama adımları">
            <li className="is-done">
              <span className="recover-rail-no">
                <FiCheck size={16} strokeWidth={2.5} title="Tamamlandı" />
              </span>
              Kimlik doğrulama
            </li>
            <li className="recover-rail-line is-filled" aria-hidden="true" />
            <li className="is-done">
              <span className="recover-rail-no">
                <FiCheck size={16} strokeWidth={2.5} title="Tamamlandı" />
              </span>
              Yeni şifre
            </li>
          </ol>

          <div className="recover-band recover-step">
            <h2 className="recover-task-title recover-done-title">
              <span className="recover-done-mark">
                <FiCheck size={17} strokeWidth={3} />
              </span>
              Şifreniz yenilendi.
            </h2>
            <p className="recover-task-note">
              Yeni kurtarma kodunuz yalnızca <b>1 kez</b> gösterilecektir. Lütfen güvenli bir yere kaydedin. Eski
              kodunuz artık geçerli değildir.
            </p>

            <div className="recover-code-surface">
              <span className="recover-code-surface-label">Yeni kurtarma kodunuz</span>
              <span className="recover-code-surface-value">{renewedCredentials.recoveryCode}</span>
              <button type="button" className="recover-btn-secondary" onClick={handleCopyCode}>
                <FiCopy size={18} />
                <span className="recover-copy-label">{isCopied ? "Kopyalandı" : "Kodu Kopyala"}</span>
              </button>
            </div>

            <ErrorNotice message={error} />
          </div>

          <div className="recover-band recover-step">
            <button
              type="button"
              className="recover-btn recover-btn--block auth-btn auth-shine"
              onClick={() => navigate("/login", { replace: true, state: { username: renewedCredentials.username } })}
            >
              Giriş Ekranına Dön
              <FiArrowRight className="recover-btn-icon" size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card recover-container">
        <div className="recover-band recover-band--context">
          <span className="recover-eyebrow">Hesap Kurtarma</span>
          <h1 className="recover-title">Hesabınıza yeniden erişin.</h1>
        </div>

        <ol className="recover-band recover-rail" aria-label="Sıfırlama adımları">
          <li className={step === 1 ? "is-active" : "is-done"} aria-current={step === 1 ? "step" : undefined}>
            <span className="recover-rail-no">
              {step === 1 ? "01" : <FiCheck size={16} strokeWidth={2.5} title="Tamamlandı" />}
            </span>
            Kimlik doğrulama
          </li>
          <li className={step === 1 ? "recover-rail-line" : "recover-rail-line is-filled"} aria-hidden="true" />
          <li className={step === 2 ? "is-active" : ""} aria-current={step === 2 ? "step" : undefined}>
            <span className="recover-rail-no">02</span>
            Yeni şifre
          </li>
        </ol>

        {step === 1 && (
          <form className="recover-step" onSubmit={handleCodeSubmit}>
            <div className="recover-band">
              <h2 className="recover-task-title">Kurtarma kodunuzu girin.</h2>
              <p className="recover-task-note">
                Kurulum sırasında size verilen {RECOVERY_LENGTH} karakterlik kodu kullanın.
              </p>

              <label className="recover-code-label" htmlFor="recover-code">
                Kurtarma Kodu
              </label>
              <div className="recover-code-wrapper">
                <input
                  id="recover-code"
                  className="recover-code-input"
                  type="text"
                  placeholder={CODE_PLACEHOLDER}
                  autoComplete="off"
                  spellCheck="false"
                  autoFocus
                  value={formatRecoveryCode(recoveryDigits)}
                  onChange={handleCodeChange}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={`${HINT_ID} ${ERROR_ID}`}
                  required
                />
                <strong className="recover-code-count" aria-hidden="true">
                  {recoveryDigits.length}/{RECOVERY_LENGTH}
                </strong>
              </div>
              {hint && (
                <p className="recover-code-hint" id={HINT_ID}>
                  {hint}
                </p>
              )}

              <ErrorNotice message={error} id={ERROR_ID} />
            </div>

            <div className="recover-band recover-actions">
              <button
                type="button"
                className="recover-btn-secondary"
                onClick={() => navigate("/login", { replace: true })}
                disabled={isVerifying}
              >
                <FiArrowLeft size={18} strokeWidth={2.5} />
                Girişe dön
              </button>
              <button type="submit" className="recover-btn auth-btn auth-shine" disabled={isVerifying}>
                {isVerifying ? (
                  <>
                    <span className="auth-spinner" aria-hidden="true" />
                    Doğrulanıyor...
                  </>
                ) : (
                  <>
                    Kodu Doğrula
                    <FiArrowRight className="recover-btn-icon" size={18} strokeWidth={2.5} />
                  </>
                )}
              </button>
            </div>

            <div className="recover-band">
              <aside className="recover-note">
                <span className="recover-note-icon" aria-hidden="true">
                  <FiInfo size={18} />
                </span>
                <div>
                  <p className="recover-note-title">Kurtarma kodunuz elinizde değil mi?</p>
                  <p className="recover-note-body">
                    Giriş yapabiliyorsanız Profil sayfasından yeni kod üretebilirsiniz. Şifre ve kurtarma kodu birlikte
                    kaybolursa hesap kurtarılamaz.
                  </p>
                </div>
              </aside>
            </div>
          </form>
        )}

        {step === 2 && (
          <form className="recover-step" onSubmit={handlePasswordSubmit}>
            <div className="recover-band">
              <h2 className="recover-task-title">Yeni şifrenizi belirleyin.</h2>

              <div className="recover-fields">
                <AuthField
                  id="recover-password"
                  label="Yeni Şifre"
                  icon={FiLock}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Yeni şifrenizi girin"
                  value={password}
                  autoFocus
                  onChange={handleFieldChange(setPassword)}
                  errorId={error ? ERROR_ID : undefined}
                />
                <AuthField
                  id="recover-confirm"
                  label="Yeni Şifre (Tekrar)"
                  icon={FiLock}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Şifrenizi tekrar girin"
                  value={confirmPassword}
                  onChange={handleFieldChange(setConfirmPassword)}
                  errorId={error ? ERROR_ID : undefined}
                />
              </div>
            </div>

            <div className="recover-band">
              <PasswordStrength password={password} confirmPassword={confirmPassword} />

              <ErrorNotice message={error} id={ERROR_ID} />
            </div>

            <div className="recover-band recover-actions">
              <button
                type="button"
                className="recover-btn-secondary"
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
                disabled={isSubmitting}
              >
                <FiArrowLeft size={18} strokeWidth={2.5} />
                Geri
              </button>
              <button type="submit" className="recover-btn auth-btn auth-shine" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="auth-spinner" aria-hidden="true" />
                    Sıfırlanıyor...
                  </>
                ) : (
                  <>
                    Şifreyi Yenile
                    <FiArrowRight className="recover-btn-icon" size={18} strokeWidth={2.5} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Recover;
