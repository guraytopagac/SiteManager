import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Login.css";
import logoImgWebp from "../../../assets/logo.webp";
import { showAlert } from "@/utils/alert";
import { setCurrentUser, isUserRole } from "@/hooks/useCurrentUser";
import { FiUser, FiLock, FiEye, FiEyeOff, FiAlertCircle, FiArrowRight } from "react-icons/fi";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  // Prefilled with "admin" when arriving from the first-run setup screen.
  const [username, setUsername] = useState(location.state?.username ?? "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleForgotPassword = async () => {
    const formValues = await showAlert.adminRecoveryForm();
    if (!formValues) return;

    const res = await window.electronAPI.resetAdminPassword(formValues);
    if (res.success) {
      await showAlert.resetCode(res.recoveryCode);
    } else {
      showAlert.error("Hata", res.message);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    const { success, user, message } = await window.electronAPI.login({
      username: cleanUsername,
      password,
    });

    if (success) {
      setCurrentUser(user);
      showAlert.toast(user.username + " — Hoş Geldiniz", message);
      navigate(isUserRole(user, "admin") ? "/admin" : "/dashboard");
    } else {
      setIsSubmitting(false);
      setError(message);
      setPassword("");
    }
  };

  return (
    <div className="login-page-bg">
      <div className="login-container">
        <img src={logoImgWebp} alt="Mavikent Logo" />
        <h1 className="login-title">Mavikent Site Yönetimi</h1>
        <p className="login-subtitle">Hesabınıza giriş yapın</p>

        <form className="login-form" onSubmit={handleLoginSubmit}>
          <div className="login-input-wrapper">
            <FiUser className="login-icon" size={18} />
            <input
              className="login-input"
              type="text"
              placeholder="Kullanıcı adınızı girin"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              required
            />
          </div>
          <div className="login-password-wrapper">
            <FiLock className="login-icon" size={18} />
            <input
              className="login-password-input"
              type={showPassword ? "text" : "password"}
              placeholder="Şifrenizi girin"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              required
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>

          {error && (
            <div className="login-error">
              <FiAlertCircle size={15} />
              {error}
            </div>
          )}

          <button type="submit" id="loginButton" className="login-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              "Giriş yapılıyor..."
            ) : (
              <>
                Giriş Yap
                <FiArrowRight size={18} strokeWidth={2.5} />
              </>
            )}
          </button>

          <button type="button" className="login-forgot" onClick={handleForgotPassword}>
            Admin şifremi unuttum?
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
