import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Login.css";
import logoImgWebp from "../../../assets/logo.webp";
import { showAlert } from "@/utils/alert";
import { setCurrentUser, homePathFor } from "@/hooks/useCurrentUser";
import CapsLockIndicator from "@/components/CapsLockIndicator/CapsLockIndicator";
import { FiUser, FiLock, FiEye, FiEyeOff, FiAlertCircle, FiArrowRight } from "react-icons/fi";

const ERROR_ID = "login-error";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState(location.state?.username ?? "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const passwordRef = useRef(null);

  const clearError = () => setError("");

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    const trimmedUsername = username.trim();

    setIsSubmitting(true);
    setError("");

    try {
      const { success, user, message } = await window.electronAPI.login({
        username: trimmedUsername,
        password,
      });

      if (success) {
        setCurrentUser(user);
        showAlert.toast("Hoş Geldiniz, " + user.username, message);
        navigate(homePathFor(user), { replace: true });
        return;
      }

      setError(message);
    } catch {
      setError("Giriş yapılamadı. Lütfen uygulamayı yeniden başlatıp tekrar deneyin.");
    }

    setIsSubmitting(false);
    setPassword("");
    passwordRef.current?.focus();
  };

  return (
    <div className="login-page-bg">
      <div className="login-container">
        <header className="login-header">
          <img
            className="login-logo"
            src={logoImgWebp}
            alt=""
            width={88}
            height={88}
            decoding="async"
            draggable={false}
          />
          <h1 className="login-title">
            <span className="login-title-brand">Mavikent</span>
            <span className="login-title-context">Site Yönetimi</span>
          </h1>
          <p className="login-subtitle">Hesabınıza giriş yapın</p>
        </header>

        <form className="login-form" onSubmit={handleLoginSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="login-username">
              Kullanıcı Adı
            </label>
            <div className="login-input-wrapper">
              <FiUser className="login-icon" size={20} />
              <input
                id="login-username"
                className="login-input"
                type="text"
                placeholder="Kullanıcı adınızı girin"
                autoComplete="username"
                autoFocus={!location.state?.username}
                spellCheck={false}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearError();
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? ERROR_ID : undefined}
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">
              Şifre
            </label>
            <div className="login-input-wrapper">
              <FiLock className="login-icon" size={20} />
              <input
                id="login-password"
                ref={passwordRef}
                className="login-password-input"
                type={showPassword ? "text" : "password"}
                placeholder="Şifrenizi girin"
                autoComplete="current-password"
                autoFocus={!!location.state?.username}
                spellCheck={false}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? ERROR_ID : undefined}
                required
              />
              <CapsLockIndicator />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPassword ? (
                  <FiEyeOff className="login-toggle-icon" size={20} />
                ) : (
                  <FiEye className="login-toggle-icon" size={20} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" id={ERROR_ID} role="alert">
              <FiAlertCircle className="login-error-icon" size={17} />
              {error}
            </div>
          )}

          <button type="submit" id="loginButton" className="login-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                Giriş yapılıyor...
              </>
            ) : (
              <>
                Giriş Yap
                <FiArrowRight className="login-btn-icon" size={20} strokeWidth={2.5} />
              </>
            )}
          </button>

          <button type="button" className="login-forgot" onClick={() => navigate("/recover")}>
            Şifremi unuttum?
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
