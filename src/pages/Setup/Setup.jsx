import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import logoImgWebp from "../../../assets/logo.webp";
import "./Setup.css";
import FormField from "@/components/FormField/FormField";
import PageLoader from "@/components/PageLoader/PageLoader";
import PasswordStrength from "@/components/PasswordStrength/PasswordStrength";
import { useNeedsSetup } from "@/hooks/useNeedsSetup";
import { MIN_PASSWORD_LENGTH } from "@/utils/passwordStrength";
import {
  FiCheck,
  FiCopy,
  FiLock,
  FiUser,
  FiAlertCircle,
  FiArrowRight,
  FiArrowLeft,
  FiLogIn,
} from "react-icons/fi";

const USERNAME_RE = /^[A-Za-z0-9_]{3,}$/;
const COPY_FEEDBACK_MS = 5000;
const TOTAL_STEPS = 2;

const SETUP_STEPS = [
  {
    title: "Hesap bilgileri",
    text: "Adınız ve giriş için kullanacağınız kullanıcı adı.",
  },
  {
    title: "Hesap güvenliği",
    text: "Şifreniz ve bir kez gösterilecek kurtarma kodunuz.",
  },
];

function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [managerName, setManagerName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const copyResetTimer = useRef(null);
  const isSetupNeeded = useNeedsSetup();

  useEffect(() => () => clearTimeout(copyResetTimer.current), []);

  if (isSetupNeeded === null && !result) {
    return <PageLoader message="Yükleniyor..." fullscreen />;
  }

  if (!isSetupNeeded && !result) {
    return <Navigate to="/login" replace />;
  }

  const hasMinLength = password.length >= MIN_PASSWORD_LENGTH;

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
      setError(
        "Kullanıcı adı en az 3 karakter olmalı, yalnızca İngilizce harf, rakam ve alt çizgi içermelidir."
      );
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
    const trimmedManagerName = managerName.trim();
    const res = await window.electronAPI.completeSetup({
      username: trimmedUsername,
      password,
      managerName: trimmedManagerName,
    });

    if (!res.success) {
      setIsSubmitting(false);
      setError(res.message);
      return;
    }

    setIsSubmitting(false);
    setResult({ code: res.recoveryCode, username: trimmedUsername });
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

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (step < TOTAL_STEPS) {
      goNext();
    } else {
      submitSetup();
    }
  };

  if (result) {
    return (
      <div className="setup-page-bg">
        <div className="setup-card">
          <aside className="setup-welcome">
            <div className="setup-brand">
              <img className="setup-logo" src={logoImgWebp} alt="Mavikent Site Yönetimi" />
              <div className="setup-brand-text">
                <h1 className="setup-welcome-title">Kurulum Tamamlandı</h1>
                <span className="setup-brand-sub">Mavikent Site Yönetimi</span>
              </div>
            </div>

            <div className="setup-progress">
              <span className="setup-progress-text">
                Adım {TOTAL_STEPS} / {TOTAL_STEPS}
              </span>
              <span className="setup-progress-track">
                <span className="setup-progress-fill" style={{ width: "100%" }} />
              </span>
            </div>

            <ol className="setup-overview">
              {SETUP_STEPS.map((item) => (
                <li key={item.title} className="is-done">
                  <span className="setup-overview-marker">
                    <FiCheck size={17} />
                  </span>
                  <div className="setup-overview-body">
                    <span className="setup-overview-title">{item.title}</span>
                    <span className="setup-overview-text">{item.text}</span>
                  </div>
                </li>
              ))}
            </ol>

            <p className="setup-welcome-note">Bu hesap yalnızca bu bilgisayarda geçerlidir.</p>
          </aside>

          <section key="setup-done" className="setup-form-panel setup-done-panel">
            <h2 className="setup-form-title setup-done-title">
              <span className="setup-done-mark">
                <FiCheck size={17} strokeWidth={3} />
              </span>
              Hesabınız oluşturuldu.
            </h2>
            <p className="setup-form-sub setup-done-sub">
              Kurtarma kodunuz yalnızca <b>1 kez</b> gösterilecektir. Lütfen güvenli bir yere kaydedin. Bu kodu
              kaybederseniz hesabınıza erişim geri getirilemez.
            </p>

            <div className="setup-done-body">
              <div className="setup-code-surface">
                <span className="setup-code-surface-label">Kurtarma kodunuz</span>
                <span className="setup-code-surface-value">{result.code}</span>
                <button type="button" className="setup-btn-back setup-copy-btn" onClick={handleCopyCode}>
                  <FiCopy size={18} />
                  <span className="setup-copy-label">{isCopied ? "Kopyalandı" : "Kodu Kopyala"}</span>
                </button>
              </div>

              {error && (
                <div className="setup-error" role="alert">
                  <FiAlertCircle className="setup-error-icon" size={15} />
                  {error}
                </div>
              )}
            </div>

            <div className="setup-actions">
              <button
                type="button"
                className="setup-btn"
                onClick={() => navigate("/login", { replace: true, state: { username: result.username } })}
              >
                Giriş Ekranına Git
                <FiArrowRight className="setup-btn-arrow" size={18} strokeWidth={2.5} />
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-page-bg">
      <div className="setup-card">
        <aside className="setup-welcome">
          <div className="setup-brand">
            <img className="setup-logo" src={logoImgWebp} alt="Mavikent Site Yönetimi" />
            <div className="setup-brand-text">
              <h1 className="setup-welcome-title">İlk Kurulum</h1>
              <span className="setup-brand-sub">Mavikent Site Yönetimi</span>
            </div>
          </div>

          <div className="setup-progress">
            <span className="setup-progress-text">
              Adım {step} / {TOTAL_STEPS}
            </span>
            <span className="setup-progress-track">
              <span className="setup-progress-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
            </span>
          </div>

          <ol className="setup-overview">
            {SETUP_STEPS.map((item, i) => {
              const stepNumber = i + 1;
              const state = step === stepNumber ? "is-active" : step > stepNumber ? "is-done" : "is-upcoming";
              return (
                <li key={item.title} className={state}>
                  <span className="setup-overview-marker">
                    {step > stepNumber ? <FiCheck size={17} /> : stepNumber}
                  </span>
                  <div className="setup-overview-body">
                    <span className="setup-overview-title">{item.title}</span>
                    <span className="setup-overview-text">{item.text}</span>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="setup-welcome-note">Bu hesap yalnızca bu bilgisayarda geçerlidir.</p>
        </aside>

        <section className="setup-form-panel">
          <h2 className="setup-form-title">{step === 1 ? "Hesap Bilgileri" : "Şifre Oluşturma"}</h2>
          <p className="setup-form-sub">
            {step === 1 ? "Adınızı ve kullanıcı adınızı belirleyin." : "Hesabınız için güçlü bir şifre belirleyin."}
          </p>

          <form key={step} className="setup-form" onSubmit={handleFormSubmit}>
            {step === 1 && (
              <>
                <FormField
                  id="setup-name"
                  label="Ad Soyad"
                  icon={FiUser}
                  placeholder="Örn. Ahmet Yılmaz"
                  autoComplete="name"
                  autoFocus
                  value={managerName}
                  onChange={(e) => {
                    setManagerName(e.target.value);
                    setError("");
                  }}
                  hint="Uygulama size bu adla hitap eder."
                />

                <FormField
                  id="setup-username"
                  label="Kullanıcı Adı"
                  icon={FiLogIn}
                  placeholder="Örn. ahmetyilmaz"
                  autoComplete="username"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  hint="Hesabınızın giriş adıdır, giriş ekranında otomatik dolar. En az 3 karakter olmalıdır, Türkçe karakter ve boşluk içeremez."
                />
              </>
            )}

            {step === 2 && (
              <>
                <FormField
                  id="setup-password"
                  label="Şifre"
                  icon={FiLock}
                  type="password"
                  placeholder="Şifrenizi girin"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                />

                <FormField
                  id="setup-password-confirm"
                  label="Şifre Tekrar"
                  icon={FiLock}
                  type="password"
                  placeholder="Şifrenizi tekrar girin"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError("");
                  }}
                />

                <PasswordStrength password={password} confirmPassword={confirmPassword} iconSize={13} />
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
                {step < TOTAL_STEPS ? (
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
