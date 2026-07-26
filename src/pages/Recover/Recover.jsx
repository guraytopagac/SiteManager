import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Recover.css";
import { showAlert } from "@/utils/alert";
import { MIN_PASSWORD_LENGTH, buildPasswordRules, buildStrengthMeter, scorePassword } from "@/utils/passwordStrength";
import CapsLockIndicator from "@/components/CapsLockIndicator/CapsLockIndicator";
import { FiAlertCircle, FiArrowRight, FiCheck, FiEye, FiEyeOff, FiInfo, FiKey, FiLock, FiMinus, FiX } from "react-icons/fi";

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_LENGTH = 16;
const RECOVERY_GROUP_SIZE = 4;
const EXCLUDED_HINT = "Kurtarma kodunda I, O, 0 ve 1 karakterleri bulunmaz.";

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

function Recover() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [recoveryDigits, setRecoveryDigits] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");

  const strength = scorePassword(password);
  const meter = buildStrengthMeter(password, strength);
  const rules = buildPasswordRules({ password, confirmPassword, strength });
  const isCodeComplete = recoveryDigits.length === RECOVERY_LENGTH;

  const handleCodeChange = (e) => {
    const enteredCode = e.target.value;
    setHint(hasExcludedCharacter(enteredCode) ? EXCLUDED_HINT : "");
    setRecoveryDigits(toRecoveryDigits(enteredCode));
    setError("");
  };

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    if (!isCodeComplete) {
      setError(`Kurtarma kodu ${RECOVERY_LENGTH} karakter olmalıdır.`);
      return;
    }
    setHint("");
    setStep(2);
  };

  const backToCodeStep = (message) => {
    setStep(1);
    setError(message);
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
      setError("Şifre sıfırlanamadı. Lütfen uygulamayı yeniden başlatıp tekrar deneyin.");
      return;
    } finally {
      setIsSubmitting(false);
    }

    if (!resetResult.success) {
      const failureMessage = resetResult.message || "Şifre sıfırlanamadı.";
      if (resetResult.code === "INVALID_RECOVERY_CODE") {
        backToCodeStep(failureMessage);
        return;
      }
      setError(failureMessage);
      return;
    }

    await showAlert.resetCode({ code: resetResult.recoveryCode, username: resetResult.username });
    showAlert.toast("Şifre sıfırlandı", "Yeni şifrenizle giriş yapabilirsiniz.");
    navigate("/login", { replace: true });
  };

  return (
    <div className="recover-page-bg">
      <div className={step === 1 ? "recover-container is-code-step" : "recover-container"}>
        <span className="recover-badge">
          <FiKey size={28} />
        </span>
        <h1 className="recover-title">
          <span className="recover-title-role">Hesap</span>
          <span className="recover-title-action">Şifre Sıfırlama</span>
        </h1>

        <ol className="recover-steps" aria-label="Sıfırlama adımları">
          <li className={step === 1 ? "is-active" : "is-done"} aria-current={step === 1 ? "step" : undefined}>
            <span className="recover-step-no">{step === 1 ? "1" : <FiCheck size={14} title="Tamamlandı" />}</span>
            Kurtarma kodu
          </li>
          <li className={step === 2 ? "is-active" : ""} aria-current={step === 2 ? "step" : undefined}>
            <span className="recover-step-no">2</span>
            Yeni şifre
          </li>
        </ol>

        <p className="recover-subtitle">
          {step === 1
            ? "İlk kurulumda size verilen kurtarma kodunu girin."
            : "Hesabınız için yeni bir şifre belirleyin."}
        </p>

        {step === 1 ? (
          <form className="recover-form" onSubmit={handleCodeSubmit}>
            <div className="recover-field">
              <label className="recover-label" htmlFor="recover-code">
                Kurtarma Kodu
              </label>
              <div className="recover-input-wrapper">
                <FiKey className="recover-icon" size={18} />
                <input
                  id="recover-code"
                  className="recover-input recover-code-input"
                  type="text"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoComplete="off"
                  spellCheck="false"
                  autoFocus
                  value={formatRecoveryCode(recoveryDigits)}
                  onChange={handleCodeChange}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="recover-code-help"
                  required
                />
              </div>
              <p className="recover-help" id="recover-code-help">
                {hint || (recoveryDigits.length > 0 ? `${recoveryDigits.length} / ${RECOVERY_LENGTH} karakter` : "")}
              </p>
            </div>

            {error && (
              <div className="recover-error" role="alert">
                <FiAlertCircle className="recover-error-icon" size={16} />
                {error}
              </div>
            )}

            <button type="submit" className="recover-btn">
              Devam
              <FiArrowRight className="recover-btn-icon" size={18} strokeWidth={2.5} />
            </button>

            <button type="button" className="recover-back recover-back-link" onClick={() => navigate("/login")}>
              Giriş ekranına dön
            </button>

            <aside className="recover-note">
              <FiInfo className="recover-note-icon" size={18} />
              <div className="recover-note-text">
                <p className="recover-note-title">Kodunuz elinizde değil mi?</p>
                <p className="recover-note-body">
                  Hâlâ giriş yapabiliyorsanız Profil sayfasından yeni bir kod üretin. Hem şifre
                  hem kod kaybolursa hesaba erişim geri getirilemez.
                </p>
              </div>
            </aside>
          </form>
        ) : (
          <form className="recover-form" onSubmit={handlePasswordSubmit}>
            <div className="recover-field">
              <label className="recover-label" htmlFor="recover-password">
                Yeni Şifre
              </label>
              <div className="recover-input-wrapper">
                <FiLock className="recover-icon" size={18} />
                <input
                  id="recover-password"
                  className="recover-input has-toggle"
                  type={showPassword ? "text" : "password"}
                  placeholder="Yeni şifre"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  required
                />
                <CapsLockIndicator />
                <button
                  type="button"
                  className="recover-toggle"
                  onClick={() => setShowPassword((isVisible) => !isVisible)}
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>

            <div className={`recover-strength ${meter.variant}`}>
              <div className="recover-strength-segments">
                {[1, 2, 3, 4, 5].map((segment) => (
                  <span key={segment} className={segment <= strength.score ? "on" : ""} />
                ))}
              </div>
              <span className="recover-strength-label">{meter.label}</span>
            </div>

            <div className="recover-field">
              <label className="recover-label" htmlFor="recover-confirm">
                Yeni Şifre (Tekrar)
              </label>
              <div className="recover-input-wrapper">
                <FiLock className="recover-icon" size={18} />
                <input
                  id="recover-confirm"
                  className="recover-input has-toggle"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Şifreyi tekrar girin"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError("");
                  }}
                  required
                />
                <CapsLockIndicator />
                <button
                  type="button"
                  className="recover-toggle"
                  onClick={() => setShowConfirmPassword((isVisible) => !isVisible)}
                  aria-label={showConfirmPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>

            <ul className="recover-rules">
              {rules.map((rule) => {
                const state = rule.isMet ? "valid" : rule.isPending ? "pending" : "failed";
                const RuleIcon = { valid: FiCheck, pending: FiMinus, failed: FiX }[state];
                return (
                  <li key={rule.id} className={`recover-rule-${state}`}>
                    <RuleIcon className="recover-rule-icon" size={14} />
                    {rule.label}
                  </li>
                );
              })}
            </ul>

            {error && (
              <div className="recover-error" role="alert">
                <FiAlertCircle className="recover-error-icon" size={16} />
                {error}
              </div>
            )}

            <button type="submit" className="recover-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="recover-spinner" aria-hidden="true" />
                  Sıfırlanıyor...
                </>
              ) : (
                <>
                  Şifreyi Sıfırla
                  <FiArrowRight className="recover-btn-icon" size={18} strokeWidth={2.5} />
                </>
              )}
            </button>

            <button
              type="button"
              className="recover-back recover-back-link"
              onClick={() => {
                setStep(1);
                setError("");
              }}
              disabled={isSubmitting}
            >
              Kurtarma koduna dön
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Recover;
