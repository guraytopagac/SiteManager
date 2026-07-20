import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logoImgWebp from "../../../assets/logo.webp";
import "./Setup.css";
import CapsLockIndicator from "@/components/CapsLockIndicator/CapsLockIndicator";
import { showAlert } from "@/utils/alert";
import { MIN_PASSWORD_LENGTH, buildPasswordRules, buildStrengthMeter, scorePassword } from "@/utils/passwordStrength";
import {
  FiCheck,
  FiEye,
  FiEyeOff,
  FiLock,
  FiCreditCard,
  FiFileText,
  FiHardDrive,
  FiDownload,
  FiUser,
  FiAlertCircle,
  FiShield,
  FiKey,
  FiZap,
  FiArrowRight,
  FiMinus,
  FiX,
} from "react-icons/fi";

function Setup() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const strength = scorePassword(password);
  const hasMinLength = password.length >= MIN_PASSWORD_LENGTH;
  const meter = buildStrengthMeter(password, strength);
  const rules = buildPasswordRules({ password, confirmPassword, strength });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasMinLength) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const res = await window.electronAPI.completeAdminSetup(password);

    if (!res.success) {
      setIsSubmitting(false);
      setError(res.message);
      return;
    }

    await showAlert.setupCode(res.recoveryCode);

    showAlert.toast("Kurulum tamamlandı", "Artık giriş yapabilirsiniz.");
    navigate("/login", { replace: true, state: { username: "admin" } });
  };

  return (
    <div className="setup-page-bg">
      <div className="setup-card">
        <aside className="setup-welcome">
          <div className="setup-brand">
            <img className="setup-logo" src={logoImgWebp} alt="Mavikent Site Yönetimi" />
            <h1 className="setup-welcome-title">İlk Kurulum</h1>
          </div>
          <p className="setup-welcome-lead">Sistem yöneticisi hesabınızı oluşturun.</p>

          <div className="setup-notice">
            <p className="setup-notice-title">
              <FiShield className="setup-notice-icon" size={20} />
              Başlamadan Önce
            </p>
            <ul className="setup-notice-list">
              <li>
                <FiLock className="setup-notice-item-icon" />
                <span>
                  Sistem yöneticisi hesabı uygulamadaki <strong>tüm yetkilere</strong> sahiptir. Şifresini kimseyle
                  paylaşmayın.
                </span>
              </li>
              <li>
                <FiKey className="setup-notice-item-icon" />
                <span>
                  Kurulum bitince bir <strong>kurtarma kodu</strong> verilecek. Şifrenizi unutursanız yeni şifreyi
                  yalnızca bu kodla belirleyebilirsiniz, kodu güvenli bir yerde saklayın.
                </span>
              </li>
            </ul>
          </div>

          <p className="setup-adv-label">
            <FiZap className="setup-notice-icon" size={20} />
            Kurulumdan Sonra
          </p>
          <ul className="setup-steps">
            <li>
              <FiCreditCard className="setup-step-icon" />
              <span>Aidat, gelir ve giderleri tek ekrandan yönetin</span>
            </li>
            <li>
              <FiFileText className="setup-step-icon" />
              <span>Detaylı PDF raporlarını anında oluşturun</span>
            </li>
            <li>
              <FiHardDrive className="setup-step-icon" />
              <span>Verileriniz bu bilgisayardan dışarı çıkmaz</span>
            </li>
            <li>
              <FiDownload className="setup-step-icon" />
              <span>Yedekleyerek verilerinizi güvence altına alın</span>
            </li>
          </ul>
        </aside>

        <section className="setup-form-panel">
          <h2 className="setup-form-title">Sistem yöneticisi şifrenizi belirleyin</h2>
          <p className="setup-form-sub">Kullanıcı adı değiştirilemez, yalnızca şifrenizi belirleyin.</p>

          <form className="setup-form" onSubmit={handleSubmit}>
            <div className="setup-input-wrapper">
              <FiUser className="setup-icon" size={18} />
              <input
                className="setup-input setup-input-locked"
                type="text"
                value="admin"
                readOnly
                tabIndex={-1}
                aria-label="Kullanıcı adı (sabit)"
                title="Kullanıcı adı değiştirilemez"
              />
              <span className="setup-lock">
                <FiLock size={16} />
              </span>
            </div>

            <div className="setup-input-wrapper">
              <FiLock className="setup-icon" size={18} />
              <input
                className="setup-input has-toggle"
                type={showPassword ? "text" : "password"}
                placeholder="Şifrenizi girin"
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
                className="setup-toggle"
                onClick={() => setShowPassword((isVisible) => !isVisible)}
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>

            <div className={`setup-strength ${meter.variant}`}>
              <div className="setup-strength-segments">
                {[1, 2, 3, 4, 5].map((segment) => (
                  <span key={segment} className={segment <= strength.score ? "on" : ""} />
                ))}
              </div>
              <span className="setup-strength-label">{meter.label}</span>
            </div>

            <div className="setup-input-wrapper">
              <FiLock className="setup-icon" size={18} />
              <input
                className="setup-input has-toggle"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Şifrenizi tekrar girin"
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
                className="setup-toggle"
                onClick={() => setShowConfirmPassword((isVisible) => !isVisible)}
                aria-label={showConfirmPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>

            <ul className="setup-rules">
              {rules.map((rule) => {
                const state = rule.isMet ? "valid" : rule.isPending ? "pending" : "failed";
                const RuleIcon = { valid: FiCheck, pending: FiMinus, failed: FiX }[state];
                return (
                  <li key={rule.id} className={`setup-rule-${state}`}>
                    <RuleIcon className="setup-rule-icon" size={13} />
                    {rule.label}
                  </li>
                );
              })}
            </ul>

            {error && (
              <div className="setup-error" role="alert">
                <FiAlertCircle className="setup-error-icon" size={15} />
                {error}
              </div>
            )}

            <button type="submit" className="setup-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                "Hesap oluşturuluyor..."
              ) : (
                <>
                  Hesabı Oluştur
                  <FiArrowRight className="setup-btn-arrow" size={18} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          <div className="setup-form-foot">
            <p>
              <FiLock className="setup-foot-icon" size={13} />
              İpucu: Uzun bir şifre, kısa ve karmaşık olandan daha güvenlidir.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Setup;
