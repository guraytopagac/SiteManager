import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import logoImgWebp from "../../../assets/logo.webp";
import "./Setup.css";
import CapsLockIndicator from "@/components/CapsLockIndicator/CapsLockIndicator";
import PageLoader from "@/components/PageLoader/PageLoader";
import { showAlert } from "@/utils/alert";
import { MIN_PASSWORD_LENGTH, buildPasswordRules, buildStrengthMeter, scorePassword } from "@/utils/passwordStrength";
import {
  FiCheck,
  FiEye,
  FiEyeOff,
  FiLock,
  FiUser,
  FiAlertCircle,
  FiShield,
  FiArrowRight,
  FiArrowLeft,
  FiLogIn,
  FiMinus,
  FiX,
} from "react-icons/fi";

const USERNAME_RE = /^[A-Za-z0-9_]{3,}$/;

const SETUP_STEPS = [
  {
    icon: FiUser,
    title: "Hesap bilgileri",
    text: "Adınız ve soyadınız, uygulamanın size nasıl hitap edeceğini belirler. Kullanıcı adınız ise uygulamaya her girişte kullanacağınız addır.",
  },
  {
    icon: FiShield,
    title: "Hesap güvenliği",
    text: "Güçlü bir şifre hesabınızı korur. Şifrenizi unutursanız, kurulum sonunda bir kez gösterilecek kurtarma koduyla yeni bir şifre oluşturursunuz. Bu kodu güvenli bir yerde saklayın.",
  },
];

function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [managerName, setManagerName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isSetupNeeded, setIsSetupNeeded] = useState(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const res = await window.electronAPI.getSetupState();
        if (!isMounted) return;
        setIsSetupNeeded(Boolean(res?.needsSetup));
      } catch {
        if (isMounted) setIsSetupNeeded(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const strength = scorePassword(password);
  const hasMinLength = password.length >= MIN_PASSWORD_LENGTH;
  const meter = buildStrengthMeter(password, strength);
  const rules = buildPasswordRules({ password, confirmPassword, strength });

  const goBack = () => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  };

  const goNext = () => {
    if (step === 1 && managerName.trim().length < 2) {
      setError("Ad soyad en az 2 karakter olmalıdır.");
      return;
    }
    if (step === 1 && !USERNAME_RE.test(username.trim())) {
      setError("Kullanıcı adı en az 3 karakter olmalı, yalnızca İngilizce harf, rakam ve _ içermelidir.");
      return;
    }
    setError("");
    setStep((s) => s + 1);
  };

  const submitSetup = async () => {
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

    const trimmedUsername = username.trim();
    const res = await window.electronAPI.completeSetup({
      username: trimmedUsername,
      password,
      managerName: managerName.trim(),
    });

    if (!res.success) {
      setIsSubmitting(false);
      setError(res.message);
      return;
    }

    await showAlert.setupCode(res.recoveryCode);

    showAlert.toast("Kurulum tamamlandı", "Artık giriş yapabilirsiniz.");
    navigate("/login", { replace: true, state: { username: trimmedUsername } });
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (step < 2) {
      goNext();
    } else {
      submitSetup();
    }
  };

  if (isSetupNeeded === null) {
    return <PageLoader message="Yükleniyor..." fullscreen />;
  }

  if (!isSetupNeeded) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="setup-page-bg">
      <div className="setup-card">
        <aside className="setup-welcome">
          <div className="setup-brand">
            <img className="setup-logo" src={logoImgWebp} alt="Mavikent Site Yönetimi" />
            <h1 className="setup-welcome-title">İlk Kurulum</h1>
          </div>
          <p className="setup-welcome-lead">
            <strong>Hoş geldiniz.</strong> Hesabınızı iki adımda oluşturun.
          </p>
          <ol className="setup-overview">
            {SETUP_STEPS.map((item, i) => {
              const n = i + 1;
              const state = step === n ? "is-active" : step > n ? "is-done" : "is-upcoming";
              const ItemIcon = item.icon;
              return (
                <li key={item.title} className={state}>
                  <span className="setup-overview-marker">
                    {step > n ? <FiCheck size={18} /> : <ItemIcon size={18} />}
                  </span>
                  <div className="setup-overview-body">
                    <span className="setup-overview-title">{item.title}</span>
                    <span className="setup-overview-text">{item.text}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="setup-form-panel">
          <h2 className="setup-form-title">{step === 1 ? "Hesap Bilgileri" : "Şifre Oluşturma"}</h2>

          <form key={step} className="setup-form" onSubmit={handleFormSubmit}>
            {step === 1 && (
              <>
                <p className="setup-form-sub">Devam etmek için ad soyad ve kullanıcı adınızı girin.</p>
                <div className="setup-field">
                  <div className="setup-input-wrapper">
                    <FiUser className="setup-icon" size={18} />
                    <input
                      id="setup-name"
                      className="setup-input"
                      type="text"
                      placeholder="Örn. Ahmet Yılmaz"
                      autoComplete="name"
                      autoFocus
                      value={managerName}
                      onChange={(e) => {
                        setManagerName(e.target.value);
                        setError("");
                      }}
                      required
                    />
                    <label className="setup-float-label" htmlFor="setup-name">
                      Ad Soyad
                    </label>
                  </div>
                </div>
                <div className="setup-field">
                  <div className="setup-input-wrapper">
                    <FiLogIn className="setup-icon" size={18} />
                    <input
                      id="setup-username"
                      className="setup-input"
                      type="text"
                      placeholder="Örn. ahmetyilmaz"
                      autoComplete="username"
                      spellCheck={false}
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError("");
                      }}
                      required
                    />
                    <label className="setup-float-label" htmlFor="setup-username">
                      Kullanıcı Adı
                    </label>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="setup-form-sub">Hesabınız için güçlü bir şifre belirleyin.</p>
                <div className="setup-field">
                  <div className="setup-input-wrapper">
                    <FiLock className="setup-icon" size={18} />
                    <input
                      id="setup-password"
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
                    <label className="setup-float-label" htmlFor="setup-password">
                      Şifre
                    </label>
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
                </div>

                <div className="setup-field">
                  <div className="setup-input-wrapper">
                    <FiLock className="setup-icon" size={18} />
                    <input
                      id="setup-password-confirm"
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
                    <label className="setup-float-label" htmlFor="setup-password-confirm">
                      Şifre Tekrar
                    </label>
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
                </div>

                <div className={`setup-strength ${meter.variant}`}>
                  <div className="setup-strength-segments">
                    {[1, 2, 3, 4, 5].map((segment) => (
                      <span key={segment} className={segment <= strength.score ? "on" : ""} />
                    ))}
                  </div>
                  <span className="setup-strength-label">{meter.label}</span>
                </div>

                <ul className="setup-rules">
                  {rules.map((rule) => {
                    const ruleState = rule.isMet ? "valid" : rule.isPending ? "pending" : "failed";
                    const RuleIcon = { valid: FiCheck, pending: FiMinus, failed: FiX }[ruleState];
                    return (
                      <li key={rule.id} className={`setup-rule-${ruleState}`}>
                        <RuleIcon className="setup-rule-icon" size={13} />
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {error && (
              <div className="setup-error" role="alert">
                <FiAlertCircle className="setup-error-icon" size={15} />
                {error}
              </div>
            )}

            <div className="setup-actions">
              {step > 1 && (
                <button type="button" className="setup-btn-back" onClick={goBack}>
                  <FiArrowLeft size={18} strokeWidth={2.5} />
                  Geri
                </button>
              )}
              <button type="submit" className="setup-btn" disabled={isSubmitting}>
                {step < 2 ? (
                  <>
                    İleri
                    <FiArrowRight className="setup-btn-arrow" size={18} strokeWidth={2.5} />
                  </>
                ) : isSubmitting ? (
                  "Hesabınız oluşturuluyor..."
                ) : (
                  <>
                    Hesabı Oluştur
                    <FiArrowRight className="setup-btn-arrow" size={18} strokeWidth={2.5} />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Setup;
