import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import logoImgWebp from "../../../assets/logo.webp";
import { showAlert } from "../../utils/alert";
import { SESSION_USER_KEY } from "../../utils/constants";
import { FiUser, FiLock, FiEye, FiEyeOff, FiAlertCircle, FiArrowRight } from "react-icons/fi";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubPrefillLogin = window.electronAPI.onPrefillLogin(({ username, password }) => {
      setUsername(username);
      setPassword(password);
    });
    return () => {
      unsubPrefillLogin();
    };
  }, []);

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
      const { id, username: loggedInUsername, email, role, last_login } = user;
      sessionStorage.setItem(
        SESSION_USER_KEY,
        JSON.stringify({ id, username: loggedInUsername, email, role, last_login }),
      );
      window.dispatchEvent(new Event("user-session-changed"));
      showAlert.toast(loggedInUsername + " — Hoş Geldiniz", message);
      navigate(role === "admin" ? "/admin" : "/dashboard");
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
              tabIndex={-1}
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
        </form>
      </div>
    </div>
  );
}

export default Login;
