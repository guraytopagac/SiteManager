import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Login.css";
import logoImgWebp from "../../../assets/app-logo.webp";
import { savedUsername, setSession } from "@/hooks/session";
import AuthField from "@/components/AuthField/AuthField";
import { FiUser, FiLock, FiAlertCircle, FiArrowRight } from "react-icons/fi";

const ERROR_ID = "login-error";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialUsername = location.state?.username ?? savedUsername() ?? "";
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        setSession(user);
        navigate("/select-building", { replace: true });
        return;
      }

      setError(message);
    } catch {
      setError("Giriş yapılamadı. Lütfen tekrar deneyin.");
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
          <AuthField
            id="login-username"
            label="Kullanıcı Adı"
            icon={FiUser}
            placeholder="Kullanıcı adınızı girin"
            autoComplete="username"
            autoFocus={!initialUsername}
            spellCheck={false}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              clearError();
            }}
            errorId={error ? ERROR_ID : undefined}
          />

          <AuthField
            id="login-password"
            ref={passwordRef}
            label="Şifre"
            icon={FiLock}
            type="password"
            placeholder="Şifrenizi girin"
            autoComplete="current-password"
            autoFocus={Boolean(initialUsername)}
            spellCheck={false}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError();
            }}
            errorId={error ? ERROR_ID : undefined}
          />

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

          <div className="login-foot">
            <p className="login-foot-text">Şifrenizi mi unuttunuz?</p>
            <button type="button" className="login-forgot" onClick={() => navigate("/recover")}>
              Kurtarma kodu ile sıfırlayın
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
