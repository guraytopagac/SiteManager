// First run account creation: two steps, then a finished state that shows the recovery code once. The step
// form is keyed by the step number, so it remounts and autofocus lands on the new step's first field.

import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import logoImgWebp from "../../../assets/app-logo.webp";
import "./Setup.css";
import AuthField from "@/components/AuthField/AuthField";
import PasswordStrength from "@/components/PasswordStrength/PasswordStrength";
import { useCopyFeedback } from "@/hooks/useCopyFeedback";
import { markSetupComplete, needsSetup } from "@/hooks/useSession";
import { UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { MIN_PASSWORD_LENGTH } from "@/utils/passwordPolicy";
import { FiAlertCircle, FiArrowLeft, FiArrowRight, FiCheck, FiCopy, FiLock, FiLogIn, FiUser } from "react-icons/fi";

const ERROR_ID = "setup-error";
// Mirrors the rule the handler enforces. This copy only moves the message earlier, it is not the boundary.
const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
// The side rail and the panel heading read from one table, so the two descriptions of a step cannot drift
// apart as the wording changes.
const SETUP_STEPS = [
  {
    title: "Hesap bilgileri",
    text: "Adınız ve giriş için kullanacağınız kullanıcı adı.",
    heading: "Hesap Bilgileri",
    sub: "Adınızı ve kullanıcı adınızı belirleyin.",
  },
  {
    title: "Hesap güvenliği",
    text: "Şifreniz ve bir kez gösterilecek kurtarma kodunuz.",
    heading: "Şifre Oluşturma",
    sub: "Hesabınız için güçlü bir şifre belirleyin.",
  },
];

const TOTAL_STEPS = SETUP_STEPS.length;

function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [managerNameInput, setManagerNameInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdAccount, setCreatedAccount] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const { isCopied, copy } = useCopyFeedback();

  // Read synchronously, no loading branch. The second half keeps the finished panel alive after the flag
  // flips, otherwise completing setup would redirect away from the code that is shown only once.
  if (!needsSetup() && !createdAccount) {
    return <Navigate to="/login" replace />;
  }

  const goBack = () => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  };

  const goNext = () => {
    const managerName = managerNameInput.trim();
    if (managerName.length < 2 || managerName.length > 60) {
      setError("Ad soyad 2 ile 60 karakter arasında olmalıdır.");
      return;
    }
    const username = usernameInput.trim();
    if (!USERNAME_RE.test(username)) {
      setError("Kullanıcı adı 3-30 karakter, İngilizce harf, rakam ve alt çizgi olmalıdır.");
      return;
    }
    setError("");
    setStep((s) => s + 1);
  };

  const submitSetup = async () => {
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

    const username = usernameInput.trim();
    const managerName = managerNameInput.trim();

    // The try wraps the call alone, deliberately breaking the usual shape: the success branch puts a value on
    // screen that is never shown again, and a throw inside it would report a failure and lose the code.
    let res;
    try {
      res = await window.electronAPI.completeSetup({
        username,
        password,
        managerName,
      });
    } catch (err) {
      console.error("[Setup] completeSetup:", err);
      setError("Hesap oluşturulamadı. Lütfen tekrar deneyin.");
      return;
    } finally {
      setIsSubmitting(false);
    }

    if (!res.success) {
      setError(res.message);
      return;
    }

    markSetupComplete(username);
    setCreatedAccount({ recoveryCode: res.recoveryCode, username });
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setError("");
    try {
      const res = await window.electronAPI.restoreOnSetup();
      if (!res.success && !res.cancelled) {
        setError(res.message);
      }
    } catch (err) {
      console.error("[Setup] restoreOnSetup:", err);
      setError(UNEXPECTED_ERROR_MESSAGE);
    }
    setIsRestoring(false);
  };

  const handleCopyCode = async () => {
    const copied = await copy(createdAccount.recoveryCode);
    setError(copied ? "" : "Kod panoya kopyalanamadı. Kodu elle not alın.");
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (step < TOTAL_STEPS) {
      goNext();
    } else {
      submitSetup();
    }
  };

  const isDone = Boolean(createdAccount);

  return (
    <div className="setup-page-bg">
      <div className="setup-card">
        <aside className="setup-welcome">
          <div className="setup-brand">
            <img className="setup-logo" src={logoImgWebp} alt="Mavikent Site Yönetimi" />
            <div className="setup-brand-text">
              <h1 className="setup-welcome-title">{isDone ? "Kurulum Tamamlandı" : "İlk Kurulum"}</h1>
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

          <ol className="setup-overview" aria-label="Kurulum adımları">
            {SETUP_STEPS.map((item, i) => {
              const stepNumber = i + 1;
              const isStepActive = !isDone && step === stepNumber;
              const isStepDone = isDone || step > stepNumber;
              return (
                <li
                  key={item.title}
                  className={isStepActive ? "is-active" : isStepDone ? "is-done" : "is-upcoming"}
                  aria-current={isStepActive ? "step" : undefined}
                >
                  <span className="setup-overview-marker">{isStepDone ? <FiCheck size={17} /> : stepNumber}</span>
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

        {isDone ? (
          <section className="setup-form-panel setup-done-panel">
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
                <span className="setup-code-surface-value">{createdAccount.recoveryCode}</span>
                <button type="button" className="setup-btn-back" onClick={handleCopyCode}>
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
                className="setup-btn auth-shine"
                onClick={() => navigate("/login", { replace: true, state: { username: createdAccount.username } })}
              >
                Giriş Ekranına Git
                <FiArrowRight className="setup-btn-arrow" size={18} strokeWidth={2.5} />
              </button>
            </div>
          </section>
        ) : (
          <section className="setup-form-panel">
            <h2 className="setup-form-title">{SETUP_STEPS[step - 1].heading}</h2>
            <p className="setup-form-sub">{SETUP_STEPS[step - 1].sub}</p>

            <form key={step} className="setup-form" onSubmit={handleFormSubmit}>
              {step === 1 && (
                <>
                  <AuthField
                    id="setup-name"
                    label="Ad Soyad"
                    icon={FiUser}
                    placeholder="Örn. Ahmet Yılmaz"
                    autoComplete="name"
                    autoFocus
                    value={managerNameInput}
                    onChange={(e) => {
                      setManagerNameInput(e.target.value);
                      setError("");
                    }}
                    errorId={error ? ERROR_ID : undefined}
                    hint="Adınızı ve soyadınızı yazın, uygulama size bu adla hitap eder."
                  />

                  <AuthField
                    id="setup-username"
                    label="Kullanıcı Adı"
                    icon={FiLogIn}
                    placeholder="Örn. ahmetyilmaz"
                    autoComplete="username"
                    spellCheck={false}
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      setError("");
                    }}
                    errorId={error ? ERROR_ID : undefined}
                    hint="Giriş ekranında kullanacağınız adı belirleyin."
                  />
                </>
              )}

              {step === 2 && (
                <>
                  <AuthField
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
                    errorId={error ? ERROR_ID : undefined}
                  />

                  <AuthField
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
                    errorId={error ? ERROR_ID : undefined}
                  />

                  <div className="setup-password-meter">
                    <PasswordStrength password={password} confirmPassword={confirmPassword} />
                  </div>
                </>
              )}

              {/* The error rides with the buttons at the bottom of the panel, so it lands right above them
                  instead of under the last field with the panel's free space in between. */}
              <div className="setup-submit">
                {error && (
                  <div className="setup-error" id={ERROR_ID} role="alert">
                    <FiAlertCircle className="setup-error-icon" size={15} />
                    {error}
                  </div>
                )}

                <div className="setup-actions">
                  {step > 1 && (
                    <button type="button" className="setup-btn-back" onClick={goBack} disabled={isSubmitting}>
                      <FiArrowLeft size={18} strokeWidth={2.5} />
                      Geri
                    </button>
                  )}
                  <button type="submit" className="setup-btn auth-shine" disabled={isSubmitting}>
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
              </div>
            </form>

            {step === 1 && (
              <div className="setup-foot">
                <p className="setup-foot-text">Devir ya da yedek dosyanız var mı?</p>
                <button
                  type="button"
                  className="setup-restore"
                  onClick={handleRestore}
                  disabled={isRestoring}
                  aria-busy={isRestoring}
                >
                  {isRestoring ? "Yükleniyor..." : "Dosyadan yükleyin"}
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default Setup;
