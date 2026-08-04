import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Recover.css";
import FormField from "@/components/FormField/FormField";
import PasswordStrength from "@/components/PasswordStrength/PasswordStrength";
import { MIN_PASSWORD_LENGTH } from "@/utils/passwordStrength";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiCopy,
  FiInfo,
  FiLock,
} from "react-icons/fi";

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_LENGTH = 16;
const RECOVERY_GROUP_SIZE = 4;
const EXCLUDED_HINT = "Kurtarma kodunda I, O, 0 ve 1 karakterleri bulunmaz.";
const CODE_PLACEHOLDER = "ABCD-EFGH-JKLP-QRST";
const COPY_FEEDBACK_MS = 5000;

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

function StatusMessage({ variant, message }) {
  if (!message) return null;

  return (
    <div className={`recover-status recover-status--${variant}`} role={variant === "error" ? "alert" : undefined}>
      <span className="recover-status-icon" aria-hidden="true">
        {variant === "error" ? <FiAlertCircle size={16} /> : <FiCheck size={16} strokeWidth={2.5} />}
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
  const [result, setResult] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const copyResetTimer = useRef(null);

  useEffect(() => () => clearTimeout(copyResetTimer.current), []);

  const isCodeComplete = recoveryDigits.length === RECOVERY_LENGTH;

  const handleCodeChange = (e) => {
    const enteredCode = e.target.value;
    setHint(hasExcludedCharacter(enteredCode) ? EXCLUDED_HINT : "");
    setRecoveryDigits(toRecoveryDigits(enteredCode));
    setError("");
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (!isCodeComplete) {
      setError(`Kurtarma kodu ${RECOVERY_LENGTH} karakter olmalıdır.`);
      return;
    }

    setIsVerifying(true);
    setError("");

    let verifyResult;
    try {
      verifyResult = await window.electronAPI.verifyRecoveryCode({ recoveryCode: recoveryDigits });
    } catch {
      setError("Kurtarma kodu doğrulanamadı. Lütfen tekrar deneyin.");
      return;
    } finally {
      setIsVerifying(false);
    }

    if (!verifyResult.success) {
      setError(verifyResult.message || "Kurtarma kodu hatalı.");
      return;
    }

    setHint("");
    setStep(2);
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

    let resetResult;
    try {
      resetResult = await window.electronAPI.resetAccountPassword({
        recoveryCode: recoveryDigits,
        newPassword: password,
      });
    } catch {
      setError("Şifre sıfırlanamadı. Lütfen tekrar deneyin.");
      return;
    } finally {
      setIsSubmitting(false);
    }

    if (!resetResult.success) {
      const failureMessage = resetResult.message || "Şifre sıfırlanamadı.";
      if (resetResult.code === "INVALID_RECOVERY_CODE") {
        setStep(1);
        setError(failureMessage);
        return;
      }
      setError(failureMessage);
      return;
    }

    setResult({ code: resetResult.recoveryCode, username: resetResult.username });
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(result.code);
      setIsCopied(true);
      clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setIsCopied(false), COPY_FEEDBACK_MS);
    } catch {
      setError("Kod panoya kopyalanamadı. Kodu elle not alın.");
    }
  };

  if (result) {
    return (
      <div className="recover-page-bg">
        <div className="recover-container">
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
              <span className="recover-code-surface-value">{result.code}</span>
              <button type="button" className="recover-btn-secondary" onClick={handleCopyCode}>
                <FiCopy size={18} />
                <span className="recover-copy-label">{isCopied ? "Kopyalandı" : "Kodu Kopyala"}</span>
              </button>
            </div>

            {error && <StatusMessage variant="error" message={error} />}
          </div>

          <div className="recover-band recover-step">
            <button
              type="button"
              className="recover-btn recover-btn--block"
              onClick={() => navigate("/login", { replace: true, state: { username: result.username } })}
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
    <div className="recover-page-bg">
      <div className="recover-container">
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
          <form key="step-1" className="recover-step" onSubmit={handleCodeSubmit}>
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
                  aria-describedby="recover-code-hint"
                  required
                />
                <strong className="recover-code-count" aria-hidden="true">
                  {recoveryDigits.length}/{RECOVERY_LENGTH}
                </strong>
              </div>
              {hint && (
                <p className="recover-code-hint" id="recover-code-hint">
                  {hint}
                </p>
              )}

              <StatusMessage variant="error" message={error} />
            </div>

            <div className="recover-band recover-actions">
              <button
                type="button"
                className="recover-btn-secondary"
                onClick={() => navigate("/login")}
                disabled={isVerifying}
              >
                <FiArrowLeft size={18} strokeWidth={2.5} />
                Girişe dön
              </button>
              <button type="submit" className="recover-btn" disabled={isVerifying}>
                {isVerifying ? (
                  <>
                    <span className="recover-spinner" aria-hidden="true" />
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

            <div className="recover-band recover-band--note">
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
          <form key="step-2" className="recover-step" onSubmit={handlePasswordSubmit}>
            <div className="recover-band">
              <h2 className="recover-task-title">Yeni şifrenizi belirleyin.</h2>
              <p className="recover-task-note">
                Kimliğiniz doğrulandı. Yeni şifrenizi girin ve hesabınıza yeniden erişin.
              </p>

              <div className="recover-fields">
                <FormField
                  id="recover-password"
                  label="Yeni Şifre"
                  icon={FiLock}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Yeni şifrenizi girin"
                  value={password}
                  autoFocus
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                />
                <FormField
                  id="recover-confirm"
                  label="Yeni Şifre (Tekrar)"
                  icon={FiLock}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Şifrenizi tekrar girin"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError("");
                  }}
                />
              </div>
            </div>

            <div className="recover-band">
              <PasswordStrength password={password} confirmPassword={confirmPassword} />

              <StatusMessage variant="error" message={error} />
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
              <button type="submit" className="recover-btn" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="recover-spinner" aria-hidden="true" />
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
